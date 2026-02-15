/**
 * Hardcore cross-module tests — Orchestrator × Resource Guard × Circuit Breaker
 *
 * Tests interaction patterns between:
 * - Circuit breaker state transitions during orchestrator failures
 * - Resource slot lifecycle across concurrent orchestrations
 * - Half-open probe behavior during multi-agent orchestrations
 * - Strategy degradation cascade under resource exhaustion
 * - Window expiry during slow orchestration
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  resetResourceGuard,
  configureResourceGuard,
  recordOutcome,
  acquireSlot,
  checkResources,
  getResourceSnapshot,
  applyResourceGuard,
} from "./resource-guard.js";
import type { RoutingDecision } from "./types.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { classifyMock, mergeWorkerResultsMock } = vi.hoisted(() => ({
  classifyMock: vi.fn<[params: Record<string, unknown>], Promise<string | null>>(),
  mergeWorkerResultsMock: vi.fn<[params: Record<string, unknown>], Promise<string>>(),
}));

vi.mock("./llm-classify.js", () => ({
  classifyWithLightweightModel: classifyMock,
}));

vi.mock("./result-merger.js", () => ({
  mergeWorkerResults: mergeWorkerResultsMock,
}));

vi.mock("./config-loader.js", () => ({
  loadDispatchConfig: vi.fn(() => null),
  invalidateDispatchConfigCache: vi.fn(),
}));

const { runMultiAgentOrchestration } = await import("./orchestrator.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeCfg = {} as Parameters<typeof runMultiAgentOrchestration>[0]["cfg"];
const fakeDecision: RoutingDecision = {
  intent: "research",
  complexity: "high",
  strategy: "multi",
  confidence: 0.95,
  signals: [],
};

function baseParams(overrides?: Partial<Parameters<typeof runMultiAgentOrchestration>[0]>) {
  return {
    task: "Hardcore test task",
    decision: fakeDecision,
    cfg: fakeCfg,
    sessionKey: "agent:test:main",
    agentId: "test-agent",
    agentDir: "/tmp/agent",
    workspaceDir: "/tmp/workspace",
    ...overrides,
  };
}

function setupDecompose(subtasks: Array<{ id: string; task: string; role?: string; depends_on?: string[] }>, strategy = "concatenate") {
  const decompose = JSON.stringify({
    subtasks: subtasks.map((s) => ({
      id: s.id,
      task: s.task,
      role: s.role ?? "worker",
      depends_on: s.depends_on ?? [],
    })),
    merge_strategy: strategy,
  });
  let decomposeDone = false;
  classifyMock.mockImplementation(async (params: Record<string, unknown>) => {
    const userPrompt = params.userPrompt as string;
    if (!decomposeDone && userPrompt.includes("Decompose this into")) {
      decomposeDone = true;
      return decompose;
    }
    return `Result for ${userPrompt}`;
  });
}

beforeEach(() => {
  classifyMock.mockReset();
  mergeWorkerResultsMock.mockReset();
  mergeWorkerResultsMock.mockResolvedValue("merged");
  resetResourceGuard();
});

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("circuit breaker poisoning via orchestrator failures", () => {
  it("repeated orchestrator LLM failures trip the circuit breaker", () => {
    configureResourceGuard({
      circuitBreakerThreshold: 0.5,
      circuitBreakerWindowMs: 60_000,
      circuitBreakerCooldownMs: 1_000,
    });

    // Record 5 failures (>= 5 results AND >= 50% failure rate)
    for (let i = 0; i < 5; i++) {
      recordOutcome(false);
    }

    const snap = getResourceSnapshot();
    expect(snap.circuitBreakerOpen).toBe(true);
    expect(snap.errorRate).toBe(1.0);

    // multi and enhanced should be blocked
    const multiCheck = checkResources("multi");
    expect(multiCheck.allowed).toBe(false);
    expect(multiCheck.degradedStrategy).toBe("single");

    const enhancedCheck = checkResources("enhanced");
    expect(enhancedCheck.allowed).toBe(false);
    expect(enhancedCheck.degradedStrategy).toBe("single");

    // single should still be allowed
    const singleCheck = checkResources("single");
    expect(singleCheck.allowed).toBe(true);
  });

  it("mixed success/failure below threshold does NOT trip circuit breaker", () => {
    configureResourceGuard({ circuitBreakerThreshold: 0.5 });

    // 3 successes, 2 failures = 40% error rate (< 50%)
    recordOutcome(true);
    recordOutcome(true);
    recordOutcome(false);
    recordOutcome(true);
    recordOutcome(false);

    expect(getResourceSnapshot().circuitBreakerOpen).toBe(false);
    expect(checkResources("multi").allowed).toBe(true);
  });

  it("circuit breaker ignores errors outside the window", async () => {
    configureResourceGuard({
      circuitBreakerThreshold: 0.5,
      circuitBreakerWindowMs: 50, // 50ms window
      circuitBreakerCooldownMs: 10_000,
    });

    // Record 5 failures
    for (let i = 0; i < 5; i++) {
      recordOutcome(false);
    }
    expect(getResourceSnapshot().circuitBreakerOpen).toBe(true);

    // Wait for the window to expire
    await new Promise((r) => setTimeout(r, 80));

    // Record a new success — old failures should be pruned from the window
    recordOutcome(true);

    // The circuit breaker was already tripped though, so it stays open until cooldown
    // But the error rate should now be low since old entries fell out
    expect(getResourceSnapshot().errorRate).toBeLessThan(0.5);
  });

  it("orchestrator exception leads to circuit breaker trip after repeated calls", async () => {
    configureResourceGuard({
      circuitBreakerThreshold: 0.5,
      circuitBreakerCooldownMs: 100,
    });

    classifyMock.mockRejectedValue(new Error("LLM permanently down"));

    // Run orchestration 5 times — each should fail and record an error outcome
    for (let i = 0; i < 5; i++) {
      const result = await runMultiAgentOrchestration(baseParams());
      expect(result).toBeUndefined();
      recordOutcome(false); // simulate the caller recording the failure
    }

    // Circuit breaker should now be open
    expect(getResourceSnapshot().circuitBreakerOpen).toBe(true);

    // New multi-agent request should be degraded
    const check = checkResources("multi");
    expect(check.allowed).toBe(false);
    expect(check.degradedStrategy).toBe("single");
  });
});

describe("resource slot lifecycle and degradation cascade", () => {
  it("multi-agent slots are tracked independently from general slots", () => {
    const release1 = acquireSlot("multi");
    const snap1 = getResourceSnapshot();
    expect(snap1.activeRequests).toBe(1);
    expect(snap1.activeMultiAgent).toBe(1);

    const release2 = acquireSlot("enhanced");
    const snap2 = getResourceSnapshot();
    expect(snap2.activeRequests).toBe(2);
    expect(snap2.activeMultiAgent).toBe(1);

    release1();
    const snap3 = getResourceSnapshot();
    expect(snap3.activeRequests).toBe(1);
    expect(snap3.activeMultiAgent).toBe(0);

    release2();
    const snap4 = getResourceSnapshot();
    expect(snap4.activeRequests).toBe(0);
    expect(snap4.activeMultiAgent).toBe(0);
  });

  it("concurrent multi-agent limit triggers degradation to enhanced", () => {
    configureResourceGuard({ maxConcurrentMultiAgent: 2, maxConcurrentRequests: 10 });

    const release1 = acquireSlot("multi");
    const release2 = acquireSlot("multi");

    // Third multi should be rejected
    const check = checkResources("multi");
    expect(check.allowed).toBe(false);
    expect(check.degradedStrategy).toBe("enhanced");

    release1();
    release2();
  });

  it("headroom check blocks multi when insufficient capacity", () => {
    configureResourceGuard({ maxConcurrentRequests: 5, maxConcurrentMultiAgent: 5 });

    // Occupy 3 slots (3 + 3 needed = 6 > 5 max)
    const releases = [acquireSlot("single"), acquireSlot("single"), acquireSlot("single")];

    const check = checkResources("multi");
    expect(check.allowed).toBe(false);
    expect(check.degradedStrategy).toBe("enhanced");
    expect(check.reason).toContain("headroom");

    releases.forEach((r) => r());
  });

  it("full degradation cascade: multi → enhanced → single under increasing load", () => {
    configureResourceGuard({ maxConcurrentRequests: 3, maxConcurrentMultiAgent: 1 });

    // Fill up general capacity
    const r1 = acquireSlot("single");
    const r2 = acquireSlot("single");
    const r3 = acquireSlot("single");

    // Multi should degrade — already at max requests, headroom insufficient
    // But first multi is not at multiAgent limit — headroom check blocks it
    const multiCheck = checkResources("multi");
    expect(multiCheck.allowed).toBe(false);

    // Enhanced should degrade to single
    const enhancedCheck = checkResources("enhanced");
    expect(enhancedCheck.allowed).toBe(false);
    expect(enhancedCheck.degradedStrategy).toBe("single");

    // Single is always allowed
    const singleCheck = checkResources("single");
    expect(singleCheck.allowed).toBe(true);

    r1(); r2(); r3();
  });

  it("applyResourceGuard acquires slot for degraded strategy, not original", () => {
    configureResourceGuard({ maxConcurrentRequests: 3, maxConcurrentMultiAgent: 1 });

    // Fill slots to force multi → enhanced degradation
    const r1 = acquireSlot("single");
    const r2 = acquireSlot("single");

    // 2 active + 3 needed > 3 max → degraded to enhanced
    const result = applyResourceGuard("multi");
    expect(result.degraded).toBe(true);
    expect(result.strategy).toBe("enhanced");

    // Should have acquired a slot (total now 3)
    expect(getResourceSnapshot().activeRequests).toBe(3);
    // But multiAgent count should NOT increment (degraded away from multi)
    expect(getResourceSnapshot().activeMultiAgent).toBe(0);

    result.release();
    r1(); r2();
  });

  it("slot double-release is idempotent", () => {
    const release = acquireSlot("multi");
    expect(getResourceSnapshot().activeRequests).toBe(1);
    expect(getResourceSnapshot().activeMultiAgent).toBe(1);

    release();
    expect(getResourceSnapshot().activeRequests).toBe(0);
    expect(getResourceSnapshot().activeMultiAgent).toBe(0);

    // Second release should be a no-op
    release();
    expect(getResourceSnapshot().activeRequests).toBe(0);
    expect(getResourceSnapshot().activeMultiAgent).toBe(0);
  });
});

describe("half-open probe + orchestrator interaction", () => {
  it("half-open allows exactly one probe, blocks rest", async () => {
    configureResourceGuard({
      circuitBreakerThreshold: 0.5,
      circuitBreakerCooldownMs: 50,
    });

    // Trip the circuit breaker
    for (let i = 0; i < 5; i++) {
      recordOutcome(false);
    }
    expect(getResourceSnapshot().circuitBreakerOpen).toBe(true);

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 80));

    // First check should allow (probe)
    const probe = checkResources("multi");
    expect(probe.allowed).toBe(true);

    // Second check should block (probe in flight)
    const blocked = checkResources("multi");
    expect(blocked.allowed).toBe(false);
    expect(blocked.degradedStrategy).toBe("single");

    // Enhanced should also be blocked during half-open with probe in flight
    const enhancedBlocked = checkResources("enhanced");
    expect(enhancedBlocked.allowed).toBe(false);
  });

  it("successful probe fully closes circuit breaker", async () => {
    configureResourceGuard({
      circuitBreakerThreshold: 0.5,
      circuitBreakerCooldownMs: 50,
    });

    // Trip
    for (let i = 0; i < 5; i++) {
      recordOutcome(false);
    }

    // Wait for cooldown → half-open
    await new Promise((r) => setTimeout(r, 80));

    // Consume probe slot
    checkResources("multi");

    // Probe succeeds
    recordOutcome(true);

    // Circuit breaker should be fully closed now
    expect(getResourceSnapshot().circuitBreakerOpen).toBe(false);

    // Both multi and enhanced should be allowed again
    expect(checkResources("multi").allowed).toBe(true);
    expect(checkResources("enhanced").allowed).toBe(true);
  });

  it("failed probe re-trips the circuit breaker immediately", async () => {
    configureResourceGuard({
      circuitBreakerThreshold: 0.5,
      circuitBreakerCooldownMs: 50,
    });

    // Trip
    for (let i = 0; i < 5; i++) {
      recordOutcome(false);
    }

    // Wait for cooldown → half-open
    await new Promise((r) => setTimeout(r, 80));

    // Consume probe slot
    checkResources("multi");

    // Probe fails
    recordOutcome(false);

    // Circuit breaker should be re-tripped (not just half-open)
    expect(getResourceSnapshot().circuitBreakerOpen).toBe(true);

    // Everything expensive should be blocked
    expect(checkResources("multi").allowed).toBe(false);
    expect(checkResources("enhanced").allowed).toBe(false);
  });

  it("two consecutive half-open cycles: trip→cooldown→fail→re-trip→cooldown→succeed→close", async () => {
    configureResourceGuard({
      circuitBreakerThreshold: 0.5,
      circuitBreakerCooldownMs: 40,
    });

    // Initial trip
    for (let i = 0; i < 5; i++) recordOutcome(false);
    expect(getResourceSnapshot().circuitBreakerOpen).toBe(true);

    // Cycle 1: cooldown → half-open → probe fails → re-trip
    await new Promise((r) => setTimeout(r, 60));
    checkResources("multi"); // consume probe
    recordOutcome(false); // probe fails
    expect(getResourceSnapshot().circuitBreakerOpen).toBe(true);

    // Cycle 2: cooldown → half-open → probe succeeds → close
    await new Promise((r) => setTimeout(r, 60));
    const probe2 = checkResources("multi");
    expect(probe2.allowed).toBe(true); // probe allowed
    recordOutcome(true); // probe succeeds
    expect(getResourceSnapshot().circuitBreakerOpen).toBe(false);
  });
});

describe("window expiry during slow orchestration", () => {
  it("error rate drops to 0 when all entries expire from the window", async () => {
    configureResourceGuard({
      circuitBreakerWindowMs: 50,
      circuitBreakerThreshold: 0.5,
      circuitBreakerCooldownMs: 10_000,
    });

    // Record 3 failures and 3 successes (50% rate but < 5 total so no trip)
    recordOutcome(false);
    recordOutcome(false);
    recordOutcome(true);
    recordOutcome(true);

    // Not enough samples to trip (< 5)
    expect(getResourceSnapshot().circuitBreakerOpen).toBe(false);

    // Wait for window expiry
    await new Promise((r) => setTimeout(r, 80));

    // Record a new outcome to trigger cleanup
    recordOutcome(true);

    // Old entries should be pruned — error rate should reflect only the new entry
    expect(getResourceSnapshot().errorRate).toBe(0);
  });

  it("slow orchestration completes after circuit breaker cooldown ends", async () => {
    configureResourceGuard({
      circuitBreakerThreshold: 0.5,
      circuitBreakerCooldownMs: 50,
    });

    // Trip the circuit breaker
    for (let i = 0; i < 5; i++) recordOutcome(false);
    expect(getResourceSnapshot().circuitBreakerOpen).toBe(true);

    // Multi is blocked right now
    expect(checkResources("multi").allowed).toBe(false);

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 80));

    // After cooldown, should be in half-open — first request allowed as probe
    const probeCheck = checkResources("multi");
    expect(probeCheck.allowed).toBe(true);
  });
});

describe("orchestrator resource slot cleanup on failure", () => {
  it("orchestrator releases slot even on decomposition LLM failure", async () => {
    classifyMock.mockRejectedValue(new Error("decomposition failed"));

    const snapBefore = getResourceSnapshot();
    await runMultiAgentOrchestration(baseParams());
    const snapAfter = getResourceSnapshot();

    expect(snapAfter.activeRequests).toBe(snapBefore.activeRequests);
    expect(snapAfter.activeMultiAgent).toBe(snapBefore.activeMultiAgent);
  });

  it("orchestrator releases slot after successful completion", async () => {
    setupDecompose([
      { id: "t1", task: "A" },
      { id: "t2", task: "B", depends_on: ["t1"] },
    ]);

    await runMultiAgentOrchestration(baseParams());

    const snap = getResourceSnapshot();
    expect(snap.activeRequests).toBe(0);
    expect(snap.activeMultiAgent).toBe(0);
  });

  it("concurrent orchestrations respect multi-agent limit", async () => {
    configureResourceGuard({ maxConcurrentMultiAgent: 1, maxConcurrentRequests: 10 });

    // Occupy the single multi-agent slot
    const holdRelease = acquireSlot("multi");

    // Trying to acquire another multi should fail
    const check = checkResources("multi");
    expect(check.allowed).toBe(false);
    expect(check.degradedStrategy).toBe("enhanced");

    holdRelease();

    // Now it should be allowed
    expect(checkResources("multi").allowed).toBe(true);
  });
});
