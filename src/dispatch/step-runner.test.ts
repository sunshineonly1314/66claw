import { describe, expect, it, vi, beforeEach } from "vitest";
import { createWorkspace, type ExecutionWorkspace } from "./execution-workspace.js";
import type { DagNode } from "./dag-executor.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { classifyMock } = vi.hoisted(() => ({
  classifyMock: vi.fn<[params: Record<string, unknown>], Promise<string | null>>(),
}));

vi.mock("./llm-classify.js", () => ({
  classifyWithLightweightModel: classifyMock,
}));

// Import AFTER mocks
const { runStep } = await import("./step-runner.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, deps: string[] = [], opts?: Partial<DagNode>): DagNode {
  return {
    id,
    task: `Task for ${id}`,
    role: "researcher",
    dependsOn: deps,
    ...opts,
  };
}

function baseParams(
  workspace: ExecutionWorkspace,
  node: DagNode,
  overrides?: Record<string, unknown>,
) {
  return {
    node,
    workspace,
    originalTask: "Main user task",
    model: "test-model",
    cfg: {} as Parameters<typeof runStep>[0]["cfg"],
    agentDir: "/tmp/agent",
    timeBudgetMs: 30_000,
    ...overrides,
  };
}

let workspace: ExecutionWorkspace;

beforeEach(() => {
  classifyMock.mockReset();
  workspace = createWorkspace("Main user task");
});

// ---------------------------------------------------------------------------
// Successful execution
// ---------------------------------------------------------------------------

describe("step-runner — successful execution", () => {
  it("returns ok status for valid output", async () => {
    classifyMock.mockResolvedValue("This is a valid research result with enough content.");
    const result = await runStep(baseParams(workspace, makeNode("t1")));
    expect(result.nodeId).toBe("t1");
    expect(result.status).toBe("ok");
    expect(result.output).toBe("This is a valid research result with enough content.");
    expect(result.retryCount).toBe(0);
    expect(result.validationErrors).toEqual([]);
  });

  it("passes role and original task in system prompt", async () => {
    classifyMock.mockResolvedValue("Valid output with sufficient length.");
    await runStep(baseParams(workspace, makeNode("t1", [], { role: "analyst" })));
    const call = classifyMock.mock.calls[0]![0];
    expect(call.systemPrompt).toContain("analyst");
    expect(call.systemPrompt).toContain("Main user task");
  });

  it("passes node task as userPrompt", async () => {
    classifyMock.mockResolvedValue("Valid output result for testing.");
    await runStep(baseParams(workspace, makeNode("t1")));
    const call = classifyMock.mock.calls[0]![0];
    expect(call.userPrompt).toBe("Task for t1");
  });
});

// ---------------------------------------------------------------------------
// Dependency context injection
// ---------------------------------------------------------------------------

describe("step-runner — dependency context", () => {
  it("includes dependency output in system prompt", async () => {
    workspace.setOutput("t1", {
      status: "ok",
      output: "Research data from step 1",
      durationMs: 100,
    });
    classifyMock.mockResolvedValue("Analysis based on prior data sufficient length.");
    await runStep(baseParams(workspace, makeNode("t2", ["t1"])));
    const call = classifyMock.mock.calls[0]![0];
    expect(call.systemPrompt).toContain("[Step t1]:");
    expect(call.systemPrompt).toContain("Research data from step 1");
  });

  it("includes multiple dependency outputs", async () => {
    workspace.setOutput("a", { status: "ok", output: "Data from A", durationMs: 10 });
    workspace.setOutput("b", { status: "ok", output: "Data from B", durationMs: 10 });
    classifyMock.mockResolvedValue("Combined analysis result sufficient content.");
    await runStep(baseParams(workspace, makeNode("c", ["a", "b"])));
    const call = classifyMock.mock.calls[0]![0];
    expect(call.systemPrompt).toContain("[Step a]:");
    expect(call.systemPrompt).toContain("Data from A");
    expect(call.systemPrompt).toContain("[Step b]:");
    expect(call.systemPrompt).toContain("Data from B");
  });

  it("excludes error/skipped dependency outputs", async () => {
    workspace.setOutput("a", { status: "ok", output: "Good data from A", durationMs: 10 });
    workspace.setOutput("b", { status: "error", output: "Error: failed", durationMs: 10 });
    classifyMock.mockResolvedValue("Analysis using only good data sufficient.");
    await runStep(baseParams(workspace, makeNode("c", ["a", "b"])));
    const call = classifyMock.mock.calls[0]![0];
    expect(call.systemPrompt).toContain("[Step a]:");
    expect(call.systemPrompt).not.toContain("[Step b]:");
  });

  it("no dependency context for independent nodes", async () => {
    classifyMock.mockResolvedValue("Independent work result sufficient length.");
    await runStep(baseParams(workspace, makeNode("t1")));
    const call = classifyMock.mock.calls[0]![0];
    expect(call.systemPrompt).not.toContain("Results from prior steps");
  });
});

// ---------------------------------------------------------------------------
// Validation and retry
// ---------------------------------------------------------------------------

describe("step-runner — validation", () => {
  it("retries on output too short", async () => {
    classifyMock
      .mockResolvedValueOnce("short") // too short (< 10 chars)
      .mockResolvedValueOnce("still short"); // retry, now valid (11 chars)
    const result = await runStep(baseParams(workspace, makeNode("t1")));
    expect(result.status).toBe("ok");
    expect(result.retryCount).toBe(1);
    expect(result.validationErrors).toContain("output_too_short");
    expect(classifyMock).toHaveBeenCalledTimes(2);
  });

  it("retries on error marker output", async () => {
    classifyMock
      .mockResolvedValueOnce("I cannot complete this task because of limitations.")
      .mockResolvedValueOnce("Here is the completed analysis with detailed findings.");
    const result = await runStep(baseParams(workspace, makeNode("t1")));
    expect(result.status).toBe("ok");
    expect(result.retryCount).toBe(1);
    expect(result.validationErrors.some((e) => e.startsWith("error_marker:"))).toBe(true);
  });

  it("retries on Chinese error marker", async () => {
    classifyMock
      .mockResolvedValueOnce("无法完成该任务，因为缺少必要信息。")
      .mockResolvedValueOnce("已完成分析，以下是详细结果报告。");
    const result = await runStep(baseParams(workspace, makeNode("t1")));
    expect(result.status).toBe("ok");
    expect(result.retryCount).toBe(1);
  });

  it("returns error after max retries exhausted", async () => {
    classifyMock.mockResolvedValue("short"); // always too short
    const result = await runStep(baseParams(workspace, makeNode("t1")));
    expect(result.status).toBe("error");
    expect(result.retryCount).toBe(2); // 0, 1, 2 = 3 attempts
    expect(classifyMock).toHaveBeenCalledTimes(3);
  });

  it("respects custom maxRetries on node", async () => {
    classifyMock.mockResolvedValue("short");
    const result = await runStep(baseParams(workspace, makeNode("t1", [], { maxRetries: 0 })));
    expect(result.status).toBe("error");
    expect(classifyMock).toHaveBeenCalledTimes(1); // no retries
  });

  it("retries on LLM null response", async () => {
    classifyMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("Valid result now with sufficient length.");
    const result = await runStep(baseParams(workspace, makeNode("t1")));
    expect(result.status).toBe("ok");
    expect(result.retryCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Exception handling
// ---------------------------------------------------------------------------

describe("step-runner — exception handling", () => {
  it("retries on LLM exception", async () => {
    classifyMock
      .mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValueOnce("Recovered result with enough content length.");
    const result = await runStep(baseParams(workspace, makeNode("t1")));
    expect(result.status).toBe("ok");
    expect(result.retryCount).toBe(1);
  });

  it("returns error status when all attempts throw", async () => {
    classifyMock.mockRejectedValue(new Error("Persistent failure"));
    const result = await runStep(baseParams(workspace, makeNode("t1")));
    expect(result.status).toBe("error");
    expect(result.output).toContain("Persistent failure");
  });
});

// ---------------------------------------------------------------------------
// Abort and timeout
// ---------------------------------------------------------------------------

describe("step-runner — abort and timeout", () => {
  it("returns timeout on abort signal", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await runStep(
      baseParams(workspace, makeNode("t1"), { signal: controller.signal }),
    );
    expect(result.status).toBe("timeout");
  });

  it("returns timeout when time budget is 0", async () => {
    const result = await runStep(baseParams(workspace, makeNode("t1"), { timeBudgetMs: 0 }));
    expect(result.status).toBe("timeout");
    expect(classifyMock).not.toHaveBeenCalled();
  });
});
