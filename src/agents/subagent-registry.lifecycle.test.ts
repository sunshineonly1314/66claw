/**
 * Deep lifecycle tests for subagent-registry — cleanup flow, sweeper,
 * event listener, and state machine transitions.
 *
 * These test the internal lifecycle paths that were previously 80%+ untested.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initStateStore,
  closeStateStore,
  getStateStoreOrNull,
} from "../infra/state-store/index.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const callGatewayMock = vi.fn(async () => ({
  status: "ok",
  startedAt: 100,
  endedAt: 200,
}));

const onAgentEventMock = vi.fn(() => () => {});

vi.mock("../gateway/call.js", () => ({
  callGateway: (...args: unknown[]) => callGatewayMock(...args),
}));

vi.mock("../infra/agent-events.js", () => ({
  onAgentEvent: (...args: unknown[]) => onAgentEventMock(...args),
}));

vi.mock("./subagent-announce.js", () => ({
  runSubagentAnnounceFlow: vi.fn(async () => true),
}));

const {
  registerSubagentRun,
  releaseSubagentRun,
  addSubagentRunForTests,
  listSubagentRunsForRequester,
  listSubagentRunsForRequesterAsync,
  resetSubagentRegistryForTests,
} = await import("./subagent-registry.js");

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe("subagent-registry lifecycle tests", () => {
  beforeEach(async () => {
    await initStateStore({ backend: "memory" });
    resetSubagentRegistryForTests({ persist: false });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    resetSubagentRegistryForTests({ persist: false });
    await closeStateStore();
  });

  // ── registerSubagentRun internals ────────────────────────────────────

  describe("registerSubagentRun behavior", () => {
    it("sets createdAt to current time on register", async () => {
      const before = Date.now();
      registerSubagentRun({
        runId: "timing-1",
        childSessionKey: "agent:main:subagent:t1",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "timing test",
        cleanup: "keep",
      });

      // Use sync listing to avoid async waitForSubagentCompletion overwriting fields
      const runs = listSubagentRunsForRequester("agent:main:main");
      const run = runs.find((r) => r.runId === "timing-1");
      expect(run).toBeDefined();
      // startedAt is set initially to Date.now() but may be overwritten by async gateway response
      expect(run!.startedAt).toBeGreaterThanOrEqual(before);
      expect(run!.createdAt).toBeGreaterThanOrEqual(before);

      releaseSubagentRun("timing-1");
    });

    it("fires waitForSubagentCompletion via callGateway", async () => {
      registerSubagentRun({
        runId: "wait-1",
        childSessionKey: "agent:main:subagent:w1",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "wait test",
        cleanup: "keep",
      });

      // Give async operations time
      await new Promise((r) => setTimeout(r, 50));

      // callGateway should have been called for agent.wait
      expect(callGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "agent.wait",
          params: expect.objectContaining({ runId: "wait-1" }),
        }),
      );

      releaseSubagentRun("wait-1");
    });

    it("cleanupHandled is set to false on register (before async completion)", () => {
      registerSubagentRun({
        runId: "cleanup-flag",
        childSessionKey: "agent:main:subagent:cf",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "cleanup flag test",
        cleanup: "keep",
      });

      // Use sync listing to capture state before async completion flow runs
      const runs = listSubagentRunsForRequester("agent:main:main");
      const run = runs.find((r) => r.runId === "cleanup-flag");
      expect(run!.cleanupHandled).toBe(false);

      releaseSubagentRun("cleanup-flag");
    });
  });

  // ── releaseSubagentRun ───────────────────────────────────────────────

  describe("releaseSubagentRun edge cases", () => {
    it("releasing non-existent runId is a no-op", () => {
      // Should not throw
      releaseSubagentRun("does-not-exist");
    });

    it("double release is idempotent", async () => {
      registerSubagentRun({
        runId: "double-rel",
        childSessionKey: "agent:main:subagent:dr",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "double release",
        cleanup: "keep",
      });

      releaseSubagentRun("double-rel");
      releaseSubagentRun("double-rel"); // should not throw

      const runs = await listSubagentRunsForRequesterAsync("agent:main:main");
      expect(runs.find((r) => r.runId === "double-rel")).toBeUndefined();
    });
  });

  // ── listSubagentRunsForRequester (sync) ──────────────────────────────

  describe("listSubagentRunsForRequester (sync)", () => {
    it("returns empty array for empty key", () => {
      const runs = listSubagentRunsForRequester("");
      expect(runs).toEqual([]);
    });

    it("returns empty array for whitespace-only key", () => {
      const runs = listSubagentRunsForRequester("   ");
      expect(runs).toEqual([]);
    });

    it("filters runs by requesterSessionKey", () => {
      registerSubagentRun({
        runId: "mine",
        childSessionKey: "agent:main:subagent:mine",
        requesterSessionKey: "agent:main:me",
        requesterDisplayKey: "me",
        task: "my task",
        cleanup: "keep",
      });
      registerSubagentRun({
        runId: "theirs",
        childSessionKey: "agent:main:subagent:theirs",
        requesterSessionKey: "agent:main:them",
        requesterDisplayKey: "them",
        task: "their task",
        cleanup: "keep",
      });

      const myRuns = listSubagentRunsForRequester("agent:main:me");
      expect(myRuns).toHaveLength(1);
      expect(myRuns[0]!.runId).toBe("mine");

      releaseSubagentRun("mine");
      releaseSubagentRun("theirs");
    });
  });

  // ── addSubagentRunForTests ───────────────────────────────────────────

  describe("addSubagentRunForTests", () => {
    it("adds a run that is immediately visible in listing", () => {
      addSubagentRunForTests({
        runId: "test-add",
        childSessionKey: "agent:main:subagent:ta",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "test added",
        cleanup: "keep",
        createdAt: Date.now(),
      });

      const runs = listSubagentRunsForRequester("agent:main:main");
      expect(runs.some((r) => r.runId === "test-add")).toBe(true);

      releaseSubagentRun("test-add");
    });
  });

  // ── storeSync sequence counter (Bug 3 fix verification) ──────────────

  describe("storeSync sequence counter", () => {
    it("interleaved register/update/release leaves correct final state", async () => {
      registerSubagentRun({
        runId: "seq-test",
        childSessionKey: "agent:main:subagent:seq",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "original",
        cleanup: "keep",
      });

      // Release immediately
      releaseSubagentRun("seq-test");

      await new Promise((r) => setTimeout(r, 100));

      const store = getStateStoreOrNull()!;
      const entry = await store.hget("subagent:runs", "seq-test");
      // Should be null — release is the final operation
      expect(entry).toBeNull();
    });
  });

  // ── remoteMergedRunIds tracking ──────────────────────────────────────

  describe("remoteMergedRunIds lifecycle", () => {
    it("remote run added via merge is tracked and prunable", async () => {
      const store = getStateStoreOrNull()!;

      // Write remote run to StateStore
      await store.hset("subagent:runs", "remote-tracked", {
        runId: "remote-tracked",
        childSessionKey: "agent:remote:subagent:rt",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "remote",
        cleanup: "keep",
        createdAt: Date.now(),
      });

      // First merge — adds to local
      const runs1 = await listSubagentRunsForRequesterAsync("agent:main:main");
      expect(runs1.some((r) => r.runId === "remote-tracked")).toBe(true);

      // Remote deletes it
      await store.hdel("subagent:runs", "remote-tracked");

      // Second merge — should prune the stale entry
      const runs2 = await listSubagentRunsForRequesterAsync("agent:main:main");
      expect(runs2.some((r) => r.runId === "remote-tracked")).toBe(false);
    });

    it("locally registered run is NOT pruned even if missing from StateStore", async () => {
      registerSubagentRun({
        runId: "local-safe",
        childSessionKey: "agent:main:subagent:ls",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "local safe",
        cleanup: "keep",
      });

      await new Promise((r) => setTimeout(r, 50));

      // Directly remove from StateStore (simulating StateStore failure)
      const store = getStateStoreOrNull()!;
      await store.hdel("subagent:runs", "local-safe");

      // Merge — locally registered run should NOT be pruned
      const runs = await listSubagentRunsForRequesterAsync("agent:main:main");
      expect(runs.some((r) => r.runId === "local-safe")).toBe(true);

      releaseSubagentRun("local-safe");
    });
  });
});
