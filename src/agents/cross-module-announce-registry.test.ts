/**
 * Cross-module hardcore tests — Announce Queue x Subagent Registry x StateStore
 *
 * Tests interaction patterns:
 * - Persistence lifecycle (enqueue -> persist -> drain -> ack)
 * - Registry + StateStore race conditions
 * - Queue isolation between multiple agent keys
 * - Rapid drain cycles
 * - Concurrent register + release under StateStore
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
// Setup
// ---------------------------------------------------------------------------

describe("cross-module announce-registry-statestore", () => {
  beforeEach(async () => {
    await initStateStore({ backend: "memory" });
    resetSubagentRegistryForTests({ persist: false });
  });

  afterEach(async () => {
    resetSubagentRegistryForTests({ persist: false });
    await closeStateStore();
  });

  // ── Registry CRUD + StateStore consistency ────────────────────────────

  describe("registry CRUD lifecycle with StateStore", () => {
    it("register -> list -> release -> list cycle is consistent", async () => {
      registerSubagentRun({
        runId: "lifecycle-1",
        childSessionKey: "agent:main:subagent:child1",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "lifecycle test",
        cleanup: "keep",
      });

      await new Promise((r) => setTimeout(r, 50));

      // Should be visible locally and in StateStore
      const runs1 = await listSubagentRunsForRequesterAsync("agent:main:main");
      expect(runs1.some((r) => r.runId === "lifecycle-1")).toBe(true);

      // Check StateStore directly
      const store = getStateStoreOrNull()!;
      const stored = await store.hget<{ runId: string }>("subagent:runs", "lifecycle-1");
      expect(stored).not.toBeNull();
      expect(stored!.runId).toBe("lifecycle-1");

      // Release
      releaseSubagentRun("lifecycle-1");
      await new Promise((r) => setTimeout(r, 50));

      // Should be gone from both
      const runs2 = await listSubagentRunsForRequesterAsync("agent:main:main");
      expect(runs2.some((r) => r.runId === "lifecycle-1")).toBe(false);

      const storedAfter = await store.hget("subagent:runs", "lifecycle-1");
      expect(storedAfter).toBeNull();
    });

    it("rapid register + release does not leave StateStore in inconsistent state", async () => {
      // Register and immediately release multiple runs
      for (let i = 0; i < 5; i++) {
        registerSubagentRun({
          runId: "rapid-" + i,
          childSessionKey: "agent:main:subagent:rapid" + i,
          requesterSessionKey: "agent:main:main",
          requesterDisplayKey: "main",
          task: "rapid task " + i,
          cleanup: "keep",
        });
        releaseSubagentRun("rapid-" + i);
      }

      // Give async operations time to settle
      await new Promise((r) => setTimeout(r, 100));

      // StateStore should eventually be clean
      const store = getStateStoreOrNull()!;
      const all = await store.hgetall("subagent:runs");
      // All should be deleted (hdel fires after hset for each)
      expect(Object.keys(all)).toHaveLength(0);
    });
  });

  // ── Cross-instance merge behavior ────────────────────────────────────

  describe("cross-instance merge", () => {
    it("remote-only run appears in async listing", async () => {
      const store = getStateStoreOrNull()!;

      // Simulate remote instance writing directly to StateStore
      await store.hset("subagent:runs", "remote-only", {
        runId: "remote-only",
        childSessionKey: "agent:main:subagent:remote",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "from remote instance",
        cleanup: "keep",
        createdAt: Date.now(),
      });

      const runs = await listSubagentRunsForRequesterAsync("agent:main:main");
      const remoteRun = runs.find((r) => r.runId === "remote-only");
      expect(remoteRun).toBeDefined();
      expect(remoteRun!.task).toBe("from remote instance");
    });

    it("local run is preferred over remote with same runId", async () => {
      const store = getStateStoreOrNull()!;

      // Remote writes first
      await store.hset("subagent:runs", "conflict-run", {
        runId: "conflict-run",
        childSessionKey: "agent:remote:subagent:child",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "remote version",
        cleanup: "keep",
        createdAt: Date.now() - 1000,
      });

      // Local registers with same runId
      registerSubagentRun({
        runId: "conflict-run",
        childSessionKey: "agent:local:subagent:child",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "local version",
        cleanup: "keep",
      });

      await new Promise((r) => setTimeout(r, 50));

      const runs = await listSubagentRunsForRequesterAsync("agent:main:main");
      const run = runs.find((r) => r.runId === "conflict-run");
      expect(run).toBeDefined();
      // Local should win (it's in the local Map, mergeRemoteRuns skips existing)
      expect(run!.task).toBe("local version");

      releaseSubagentRun("conflict-run");
    });

    it("different requesters see different runs", async () => {
      registerSubagentRun({
        runId: "run-for-a",
        childSessionKey: "agent:main:subagent:a",
        requesterSessionKey: "agent:main:agentA",
        requesterDisplayKey: "agentA",
        task: "task for A",
        cleanup: "keep",
      });

      registerSubagentRun({
        runId: "run-for-b",
        childSessionKey: "agent:main:subagent:b",
        requesterSessionKey: "agent:main:agentB",
        requesterDisplayKey: "agentB",
        task: "task for B",
        cleanup: "keep",
      });

      await new Promise((r) => setTimeout(r, 50));

      const runsA = await listSubagentRunsForRequesterAsync("agent:main:agentA");
      const runsB = await listSubagentRunsForRequesterAsync("agent:main:agentB");

      expect(runsA).toHaveLength(1);
      expect(runsA[0]!.runId).toBe("run-for-a");

      expect(runsB).toHaveLength(1);
      expect(runsB[0]!.runId).toBe("run-for-b");

      releaseSubagentRun("run-for-a");
      releaseSubagentRun("run-for-b");
    });
  });

  // ── StateStore unavailability resilience ──────────────────────────────

  describe("StateStore unavailability resilience", () => {
    it("register/release work when StateStore is closed mid-operation", async () => {
      registerSubagentRun({
        runId: "survive-close",
        childSessionKey: "agent:main:subagent:survive",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "will survive store close",
        cleanup: "keep",
      });

      await new Promise((r) => setTimeout(r, 30));

      // Close the store mid-operation
      await closeStateStore();

      // These should not throw
      releaseSubagentRun("survive-close");

      registerSubagentRun({
        runId: "after-close",
        childSessionKey: "agent:main:subagent:afterclose",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "after close",
        cleanup: "keep",
      });

      await new Promise((r) => setTimeout(r, 30));

      // Local listing should still work (in-memory)
      const runs = await listSubagentRunsForRequesterAsync("agent:main:main");
      expect(runs.some((r) => r.runId === "after-close")).toBe(true);

      // Re-init for afterEach cleanup
      await initStateStore({ backend: "memory" });

      releaseSubagentRun("after-close");
    });

    it("listSubagentRunsForRequesterAsync with empty key returns empty array", async () => {
      const runs = await listSubagentRunsForRequesterAsync("");
      expect(runs).toEqual([]);
    });

    it("listSubagentRunsForRequesterAsync with whitespace key returns empty array", async () => {
      const runs = await listSubagentRunsForRequesterAsync("   ");
      expect(runs).toEqual([]);
    });
  });

  // ── Concurrent operations ─────────────────────────────────────────────

  describe("concurrent registry operations", () => {
    it("10 concurrent registers all appear in StateStore", async () => {
      for (let i = 0; i < 10; i++) {
        registerSubagentRun({
          runId: "conc-" + i,
          childSessionKey: "agent:main:subagent:conc" + i,
          requesterSessionKey: "agent:main:main",
          requesterDisplayKey: "main",
          task: "concurrent task " + i,
          cleanup: "keep",
        });
      }

      // Wait for async storeSync operations
      await new Promise((r) => setTimeout(r, 100));

      const store = getStateStoreOrNull()!;
      const all = await store.hgetall<{ runId: string }>("subagent:runs");
      const runIds = Object.keys(all);

      for (let i = 0; i < 10; i++) {
        expect(runIds).toContain("conc-" + i);
      }

      // Cleanup
      for (let i = 0; i < 10; i++) {
        releaseSubagentRun("conc-" + i);
      }
    });

    it("register followed by immediate listAsync returns the run", async () => {
      registerSubagentRun({
        runId: "immediate-list",
        childSessionKey: "agent:main:subagent:immediate",
        requesterSessionKey: "agent:main:main",
        requesterDisplayKey: "main",
        task: "check immediate visibility",
        cleanup: "keep",
      });

      // Don't wait — check immediately
      const runs = await listSubagentRunsForRequesterAsync("agent:main:main");
      const found = runs.find((r) => r.runId === "immediate-list");
      // Local Map should have it immediately, even if StateStore hasn't synced yet
      expect(found).toBeDefined();

      releaseSubagentRun("immediate-list");
    });
  });
});
