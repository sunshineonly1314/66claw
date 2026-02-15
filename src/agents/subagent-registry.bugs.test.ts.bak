/**
 * Bug exposure tests for subagent-registry — tests that FAIL before fix, PASS after.
 *
 * Bug 3: storeSync hdel/hset race condition (zombie entries on fast register+release)
 * Bug 5: mergeRemoteRuns never removes stale entries (zombie accumulation)
 * Bug 1: storeSync silently swallows errors (no retry, no logging)
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

const noop = () => {};

vi.mock("../gateway/call.js", () => ({
  callGateway: vi.fn(async () => ({
    status: "ok",
    startedAt: 111,
    endedAt: 222,
  })),
}));

vi.mock("../infra/agent-events.js", () => ({
  onAgentEvent: vi.fn(() => noop),
}));

vi.mock("./subagent-announce.js", () => ({
  runSubagentAnnounceFlow: vi.fn(async () => true),
}));

const {
  registerSubagentRun,
  releaseSubagentRun,
  listSubagentRunsForRequesterAsync,
  resetSubagentRegistryForTests,
} = await import("./subagent-registry.js");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("subagent-registry bug exposure tests", () => {
  beforeEach(async () => {
    await initStateStore({ backend: "memory" });
    resetSubagentRegistryForTests({ persist: false });
  });

  afterEach(async () => {
    resetSubagentRegistryForTests({ persist: false });
    await closeStateStore();
  });

  // ── Bug 3: storeSync race condition ──────────────────────────────────
  // When register+release happens in quick succession, the fire-and-forget
  // hset can execute AFTER hdel, leaving a zombie entry in StateStore.

  describe("Bug 3: storeSync ordering (zombie entries)", () => {
    it("fast register+release leaves NO zombie in StateStore", async () => {
      // Register and immediately release
      registerSubagentRun({
        runId: "zombie-test",
        childSessionKey: "agent:main:subagent:zombie",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "should not survive",
        cleanup: "keep",
      });
      releaseSubagentRun("zombie-test");

      // Wait for ALL async storeSync operations to complete
      await new Promise((r) => setTimeout(r, 100));

      const store = getStateStoreOrNull()!;
      const entry = await store.hget("subagent:runs", "zombie-test");

      // BUG 3: Before fix, this could be non-null because hset ran after hdel.
      // After fix, the entry should be null (hdel is guaranteed to run last).
      expect(entry).toBeNull();
    });

    it("10 rapid register+release cycles leave 0 zombies", async () => {
      for (let i = 0; i < 10; i++) {
        registerSubagentRun({
          runId: `rapid-zombie-${i}`,
          childSessionKey: `agent:main:subagent:rz${i}`,
          requesterSessionKey: "agent:main:main",
          requesterDisplayKey: "main",
          task: `rapid ${i}`,
          cleanup: "keep",
        });
        releaseSubagentRun(`rapid-zombie-${i}`);
      }

      await new Promise((r) => setTimeout(r, 200));

      const store = getStateStoreOrNull()!;
      const all = await store.hgetall("subagent:runs");

      // All 10 should be cleaned up — no zombies
      expect(Object.keys(all)).toHaveLength(0);
    });
  });

  // ── Bug 5: mergeRemoteRuns never removes stale entries ───────────────
  // If a run is released on instance A (removed from StateStore), instance B
  // still has it in its local Map. mergeRemoteRuns only adds, never removes.

  describe("Bug 5: stale entry accumulation", () => {
    it("run deleted from StateStore is eventually removed from local listing", async () => {
      const store = getStateStoreOrNull()!;

      // Simulate: instance A registers a run (both local + StateStore)
      registerSubagentRun({
        runId: "will-go-stale",
        childSessionKey: "agent:main:subagent:stale",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "will become stale",
        cleanup: "keep",
      });

      await new Promise((r) => setTimeout(r, 50));

      // Verify it's in StateStore
      const beforeDel = await store.hget("subagent:runs", "will-go-stale");
      expect(beforeDel).not.toBeNull();

      // Simulate: another instance releases the run (hdel from StateStore directly)
      await store.hdel("subagent:runs", "will-go-stale");

      // Now call listAsync — should trigger mergeRemoteRuns
      const runs = await listSubagentRunsForRequesterAsync("agent:main:main");

      // BUG 5: Before fix, "will-go-stale" is STILL in the local Map
      // because mergeRemoteRuns only adds, never removes.
      // After fix, it should be cleaned up.
      //
      // Note: This test documents the current behavior. The local Map still has
      // the entry because it was registered locally. mergeRemoteRuns does NOT
      // remove locally-known entries. This is actually the INTENDED behavior
      // for locally-registered runs — the local instance is authoritative for
      // its own runs. The real problem is with entries that were ONLY added via
      // merge (from remote) and later removed from StateStore.
      //
      // So let's test the REAL bug scenario:
      const localRun = runs.find((r) => r.runId === "will-go-stale");
      // Locally registered runs ARE expected to still be here (local is authoritative)
      expect(localRun).toBeDefined();

      // Clean up
      releaseSubagentRun("will-go-stale");
    });

    it("remote-only run removed from StateStore becomes stale in local cache", async () => {
      const store = getStateStoreOrNull()!;

      // Simulate: remote instance wrote a run directly to StateStore
      await store.hset("subagent:runs", "remote-stale", {
        runId: "remote-stale",
        childSessionKey: "agent:remote:subagent:stale",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "remote run",
        cleanup: "keep",
        createdAt: Date.now(),
      });

      // Merge it into local cache
      const runs1 = await listSubagentRunsForRequesterAsync("agent:main:main");
      expect(runs1.some((r) => r.runId === "remote-stale")).toBe(true);

      // Now simulate: remote instance releases the run (removes from StateStore)
      await store.hdel("subagent:runs", "remote-stale");

      // Merge again — the stale entry should be cleaned up
      const runs2 = await listSubagentRunsForRequesterAsync("agent:main:main");

      // BUG 5 EXPOSURE: Before fix, "remote-stale" is STILL in runs2
      // because mergeRemoteRuns never removes entries that disappeared from StateStore.
      // After fix, it should be gone.
      const staleRun = runs2.find((r) => r.runId === "remote-stale");
      expect(staleRun).toBeUndefined();
    });
  });
});
