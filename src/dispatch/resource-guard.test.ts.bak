import { describe, expect, it, beforeEach } from "vitest";
import {
  checkResources,
  acquireSlot,
  applyResourceGuard,
  recordOutcome,
  getResourceSnapshot,
  configureResourceGuard,
  resetResourceGuard,
} from "./resource-guard.js";

beforeEach(() => {
  resetResourceGuard();
});

// ---------------------------------------------------------------------------
// checkResources
// ---------------------------------------------------------------------------

describe("checkResources", () => {
  it("allows single strategy by default", () => {
    const result = checkResources("single");
    expect(result.allowed).toBe(true);
    expect(result.utilization).toBe(0);
  });

  it("allows multi strategy when under limits", () => {
    const result = checkResources("multi");
    expect(result.allowed).toBe(true);
  });

  it("degrades multi → enhanced when multi-agent limit reached", () => {
    configureResourceGuard({ maxConcurrentMultiAgent: 1 });
    const release = acquireSlot("multi");

    const result = checkResources("multi");
    expect(result.allowed).toBe(false);
    expect(result.degradedStrategy).toBe("enhanced");
    expect(result.reason).toContain("Multi-agent limit");

    release();
  });

  it("degrades multi → enhanced when insufficient headroom", () => {
    configureResourceGuard({ maxConcurrentRequests: 4 });
    // Acquire 2 slots → only 2 left, but multi needs 3
    const r1 = acquireSlot("single");
    const r2 = acquireSlot("single");

    const result = checkResources("multi");
    expect(result.allowed).toBe(false);
    expect(result.degradedStrategy).toBe("enhanced");

    r1();
    r2();
  });

  it("degrades enhanced → single when at concurrency limit", () => {
    configureResourceGuard({ maxConcurrentRequests: 2 });
    const r1 = acquireSlot("single");
    const r2 = acquireSlot("single");

    const result = checkResources("enhanced");
    expect(result.allowed).toBe(false);
    expect(result.degradedStrategy).toBe("single");

    r1();
    r2();
  });
});

// ---------------------------------------------------------------------------
// acquireSlot / release
// ---------------------------------------------------------------------------

describe("acquireSlot", () => {
  it("increments and decrements active counts", () => {
    expect(getResourceSnapshot().activeRequests).toBe(0);

    const release = acquireSlot("single");
    expect(getResourceSnapshot().activeRequests).toBe(1);

    release();
    expect(getResourceSnapshot().activeRequests).toBe(0);
  });

  it("tracks multi-agent slots separately", () => {
    const release = acquireSlot("multi");
    const snap = getResourceSnapshot();
    expect(snap.activeRequests).toBe(1);
    expect(snap.activeMultiAgent).toBe(1);

    release();
    const snap2 = getResourceSnapshot();
    expect(snap2.activeMultiAgent).toBe(0);
  });

  it("release is idempotent", () => {
    const release = acquireSlot("single");
    release();
    release(); // second call is a no-op
    expect(getResourceSnapshot().activeRequests).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

describe("circuit breaker", () => {
  it("trips after threshold exceeded", () => {
    configureResourceGuard({
      circuitBreakerThreshold: 0.5,
      circuitBreakerWindowMs: 60000,
      circuitBreakerCooldownMs: 100, // short for testing
    });

    // Record 5 failures → 100% error rate
    for (let i = 0; i < 5; i++) {
      recordOutcome(false);
    }

    const snap = getResourceSnapshot();
    expect(snap.circuitBreakerOpen).toBe(true);

    // Multi should be degraded
    const check = checkResources("multi");
    expect(check.allowed).toBe(false);
    expect(check.degradedStrategy).toBe("single");
    expect(check.reason).toContain("Circuit breaker");
  });

  it("does not trip with mixed results below threshold", () => {
    configureResourceGuard({ circuitBreakerThreshold: 0.5 });

    // Record 2 failures + 8 successes = 20% error rate < 50% threshold
    recordOutcome(false);
    recordOutcome(false);
    for (let i = 0; i < 8; i++) {
      recordOutcome(true);
    }

    expect(getResourceSnapshot().circuitBreakerOpen).toBe(false);
  });

  it("auto-resets after cooldown", async () => {
    configureResourceGuard({
      circuitBreakerThreshold: 0.5,
      circuitBreakerCooldownMs: 50, // 50ms cooldown
    });

    // Trip the breaker
    for (let i = 0; i < 5; i++) {
      recordOutcome(false);
    }
    expect(getResourceSnapshot().circuitBreakerOpen).toBe(true);

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 60));
    expect(getResourceSnapshot().circuitBreakerOpen).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyResourceGuard
// ---------------------------------------------------------------------------

describe("applyResourceGuard", () => {
  it("returns requested strategy when resources available", () => {
    const result = applyResourceGuard("multi");
    expect(result.strategy).toBe("multi");
    expect(result.degraded).toBe(false);
    result.release();
  });

  it("degrades and reports reason", () => {
    configureResourceGuard({ maxConcurrentMultiAgent: 0 });
    const result = applyResourceGuard("multi");
    expect(result.strategy).toBe("enhanced");
    expect(result.degraded).toBe(true);
    expect(result.reason).toBeDefined();
    result.release();
  });
});

// ---------------------------------------------------------------------------
// getResourceSnapshot
// ---------------------------------------------------------------------------

describe("getResourceSnapshot", () => {
  it("returns current state", () => {
    const snap = getResourceSnapshot();
    expect(snap.activeRequests).toBe(0);
    expect(snap.activeMultiAgent).toBe(0);
    expect(snap.utilization).toBe(0);
    expect(snap.errorRate).toBe(0);
    expect(snap.circuitBreakerOpen).toBe(false);
  });

  it("computes utilization correctly", () => {
    configureResourceGuard({ maxConcurrentRequests: 4 });
    const r1 = acquireSlot("single");
    const r2 = acquireSlot("single");

    const snap = getResourceSnapshot();
    expect(snap.utilization).toBe(0.5);

    r1();
    r2();
  });
});
