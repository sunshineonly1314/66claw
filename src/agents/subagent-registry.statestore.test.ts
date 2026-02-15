/**
 * Deep tests for subagent-registry — StateStore write-through migration.
 *
 * Verifies that CRUD operations on subagent runs are mirrored to StateStore
 * via hset/hdel for cross-instance visibility.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initStateStore,
  closeStateStore,
  getStateStoreOrNull,
} from "../infra/state-store/index.js";

// ---------------------------------------------------------------------------
// Mocks — must be before imports
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

describe("subagent-registry StateStore write-through", () => {
  beforeEach(async () => {
    await initStateStore({ backend: "memory" });
    resetSubagentRegistryForTests({ persist: false });
  });

  afterEach(async () => {
    resetSubagentRegistryForTests({ persist: false });
    await closeStateStore();
  });

  it("registerSubagentRun writes to StateStore hash", async () => {
    registerSubagentRun({
      runId: "run-store-1",
      childSessionKey: "agent:main:subagent:child1",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      task: "test task",
      cleanup: "keep",
    });

    // Give async storeSync time to complete
    await new Promise((r) => setTimeout(r, 50));

    const store = getStateStoreOrNull()!;
    const stored = await store.hget<{ runId: string; task: string }>(
      "subagent:runs",
      "run-store-1",
    );
    expect(stored).not.toBeNull();
    expect(stored!.runId).toBe("run-store-1");
    expect(stored!.task).toBe("test task");
  });

  it("releaseSubagentRun removes from StateStore hash", async () => {
    registerSubagentRun({
      runId: "run-store-2",
      childSessionKey: "agent:main:subagent:child2",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      task: "will be released",
      cleanup: "keep",
    });

    await new Promise((r) => setTimeout(r, 50));

    releaseSubagentRun("run-store-2");

    await new Promise((r) => setTimeout(r, 50));

    const store = getStateStoreOrNull()!;
    const stored = await store.hget("subagent:runs", "run-store-2");
    expect(stored).toBeNull();
  });

  it("listSubagentRunsForRequesterAsync merges remote runs", async () => {
    const store = getStateStoreOrNull()!;

    // Simulate a remote run (written by another instance directly to StateStore)
    await store.hset("subagent:runs", "remote-run", {
      runId: "remote-run",
      childSessionKey: "agent:main:subagent:remote",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      task: "remote task",
      cleanup: "keep",
      createdAt: Date.now(),
    });

    // Register a local run
    registerSubagentRun({
      runId: "local-run",
      childSessionKey: "agent:main:subagent:local",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      task: "local task",
      cleanup: "keep",
    });

    await new Promise((r) => setTimeout(r, 50));

    const runs = await listSubagentRunsForRequesterAsync("agent:main:main");
    const runIds = runs.map((r) => r.runId);

    // Both local and remote should be visible
    expect(runIds).toContain("local-run");
    expect(runIds).toContain("remote-run");
  });

  it("multiple registers update StateStore incrementally", async () => {
    registerSubagentRun({
      runId: "run-a",
      childSessionKey: "agent:main:subagent:a",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      task: "task a",
      cleanup: "keep",
    });
    registerSubagentRun({
      runId: "run-b",
      childSessionKey: "agent:main:subagent:b",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      task: "task b",
      cleanup: "keep",
    });

    await new Promise((r) => setTimeout(r, 50));

    const store = getStateStoreOrNull()!;
    const all = await store.hgetall<{ runId: string }>("subagent:runs");
    const ids = Object.keys(all);
    expect(ids).toContain("run-a");
    expect(ids).toContain("run-b");
  });

  it("handles missing StateStore gracefully", async () => {
    // Close store first
    await closeStateStore();

    // These should not throw even without StateStore
    registerSubagentRun({
      runId: "run-nostore",
      childSessionKey: "agent:main:subagent:nostore",
      requesterSessionKey: "agent:main:main",
      requesterDisplayKey: "main",
      task: "no store",
      cleanup: "keep",
    });

    await new Promise((r) => setTimeout(r, 30));

    releaseSubagentRun("run-nostore");

    // Re-init for afterEach cleanup
    await initStateStore({ backend: "memory" });
  });
});
