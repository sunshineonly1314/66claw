import { describe, expect, it, vi, beforeEach } from "vitest";
import { resetResourceGuard } from "./resource-guard.js";
import type { RoutingDecision } from "./types.js";

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted to ensure mock fns exist before module evaluation
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

// Import AFTER mocks
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
    task: "Analyze the pros and cons of five frameworks",
    decision: fakeDecision,
    cfg: fakeCfg,
    sessionKey: "agent:test:main",
    agentId: "test-agent",
    agentDir: "/tmp/agent",
    workspaceDir: "/tmp/workspace",
    ...overrides,
  };
}

/** Valid decomposition JSON for 2 independent tasks with concatenate merge */
const DECOMPOSE_2_CONCAT = JSON.stringify({
  subtasks: [
    { id: "t1", task: "Research framework A", role: "researcher", depends_on: [] },
    { id: "t2", task: "Research framework B", role: "researcher", depends_on: [] },
  ],
  merge_strategy: "concatenate",
});

/** Valid decomposition JSON for 3 tasks (2 independent + 1 dependent) with synthesize */
const DECOMPOSE_3_DEP_SYNTH = JSON.stringify({
  subtasks: [
    { id: "t1", task: "Gather data on A", role: "researcher", depends_on: [] },
    { id: "t2", task: "Gather data on B", role: "researcher", depends_on: [] },
    { id: "t3", task: "Compare A and B", role: "analyst", depends_on: ["t1", "t2"] },
  ],
  merge_strategy: "synthesize",
});

/**
 * Set up classify mock to respond by content routing.
 * Since workers run in parallel (Promise.all), we match by userPrompt.
 */
function setupMockSequence(responses: Map<string, string | null>) {
  let decomposeCalled = false;
  classifyMock.mockImplementation(async (params: Record<string, unknown>) => {
    const userPrompt = params.userPrompt as string;
    const systemPrompt = params.systemPrompt as string;
    // First call with "Decompose" keyword is the decomposer
    if (!decomposeCalled && userPrompt.includes("Decompose this into")) {
      decomposeCalled = true;
      return responses.get("__decompose__") ?? null;
    }
    // Check if it's a merge call
    if (userPrompt.includes("Worker outputs:") || systemPrompt?.includes("synthesis expert") || systemPrompt?.includes("quality evaluator")) {
      return responses.get("__merge__") ?? null;
    }
    // Worker call — match by userPrompt (which is the subtask text)
    if (responses.has(userPrompt)) {
      return responses.get(userPrompt) ?? null;
    }
    return null;
  });
}

beforeEach(() => {
  classifyMock.mockReset();
  mergeWorkerResultsMock.mockReset();
  mergeWorkerResultsMock.mockImplementation(
    async (params: Record<string, unknown>) => {
      const results = params.results as Array<{ status: string }>;
      return `Merged ${results.filter((r) => r.status === "ok").length} results`;
    },
  );
  resetResourceGuard();
});

// ---------------------------------------------------------------------------
// Task Decomposition
// ---------------------------------------------------------------------------

describe("orchestrator — task decomposition", () => {
  it("returns undefined when decomposition LLM returns null", async () => {
    classifyMock.mockResolvedValue(null);
    const result = await runMultiAgentOrchestration(baseParams());
    expect(result).toBeUndefined();
  });

  it("returns undefined when decomposition returns invalid JSON", async () => {
    classifyMock.mockResolvedValue("This is not JSON at all");
    const result = await runMultiAgentOrchestration(baseParams());
    expect(result).toBeUndefined();
  });

  it("returns undefined when decomposition has fewer than 2 subtasks", async () => {
    classifyMock.mockResolvedValue(
      JSON.stringify({
        subtasks: [{ id: "t1", task: "Only one task", role: "worker", depends_on: [] }],
        merge_strategy: "concatenate",
      }),
    );
    const result = await runMultiAgentOrchestration(baseParams());
    expect(result).toBeUndefined();
  });

  it("strips markdown code fences from decomposition response", async () => {
    const fenced = "```json\n" + DECOMPOSE_2_CONCAT + "\n```";
    setupMockSequence(
      new Map([
        ["__decompose__", fenced],
        ["Research framework A", "Worker 1 output"],
        ["Research framework B", "Worker 2 output"],
      ]),
    );
    const result = await runMultiAgentOrchestration(baseParams());
    expect(result).toBeDefined();
    expect(result).toHaveProperty("text");
  });

  it("returns undefined when subtask texts are empty strings", async () => {
    classifyMock.mockResolvedValue(
      JSON.stringify({
        subtasks: [
          { id: "t1", task: "", role: "worker", depends_on: [] },
          { id: "t2", task: "  ", role: "worker", depends_on: [] },
        ],
        merge_strategy: "concatenate",
      }),
    );
    const result = await runMultiAgentOrchestration(baseParams());
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Worker Execution
// ---------------------------------------------------------------------------

describe("orchestrator — worker execution", () => {
  it("executes workers and calls merger with results", async () => {
    // Use all-dependent layout (sequential) to avoid parallel import issues in test env
    const decompose = JSON.stringify({
      subtasks: [
        { id: "t1", task: "Step 1", role: "researcher", depends_on: [] },
        { id: "t2", task: "Step 2", role: "analyst", depends_on: ["t1"] },
      ],
      merge_strategy: "concatenate",
    });
    setupMockSequence(
      new Map([
        ["__decompose__", decompose],
        ["Step 1", "Step 1 result"],
        ["Step 2", "Step 2 result"],
      ]),
    );
    const result = await runMultiAgentOrchestration(baseParams());
    expect(result).toBeDefined();
    expect(mergeWorkerResultsMock).toHaveBeenCalledTimes(1);
    const mergeCall = mergeWorkerResultsMock.mock.calls[0]![0];
    const results = mergeCall.results as Array<{ status: string }>;
    expect(results.filter((r) => r.status === "ok")).toHaveLength(2);
  });

  it("handles 3 tasks with dependent task sequentially after independent ones", async () => {
    setupMockSequence(
      new Map([
        ["__decompose__", DECOMPOSE_3_DEP_SYNTH],
        ["Gather data on A", "Data about A"],
        ["Gather data on B", "Data about B"],
        ["Compare A and B", "Comparison result"],
      ]),
    );
    mergeWorkerResultsMock.mockResolvedValue("Final synthesized report");
    const result = await runMultiAgentOrchestration(baseParams());
    expect(result).toBeDefined();
    const text = (result as { text: string }).text;
    expect(text).toBe("Final synthesized report");
    const mergeCall = mergeWorkerResultsMock.mock.calls[0]![0];
    expect((mergeCall.results as unknown[]).length).toBe(3);
  });

  it("returns undefined when all workers fail (return null)", async () => {
    const decompose = JSON.stringify({
      subtasks: [
        { id: "t1", task: "Fail 1", role: "worker", depends_on: [] },
        { id: "t2", task: "Fail 2", role: "worker", depends_on: ["t1"] },
      ],
      merge_strategy: "concatenate",
    });
    setupMockSequence(
      new Map([
        ["__decompose__", decompose],
        ["Fail 1", null],
        ["Fail 2", null],
      ]),
    );
    const result = await runMultiAgentOrchestration(baseParams());
    expect(result).toBeUndefined();
    expect(mergeWorkerResultsMock).not.toHaveBeenCalled();
  });

  it("succeeds with partial worker results (one fails)", async () => {
    const decompose = JSON.stringify({
      subtasks: [
        { id: "t1", task: "Good task", role: "worker", depends_on: [] },
        { id: "t2", task: "Bad task", role: "worker", depends_on: ["t1"] },
      ],
      merge_strategy: "concatenate",
    });
    setupMockSequence(
      new Map([
        ["__decompose__", decompose],
        ["Good task", "Worker 1 succeeded"],
        ["Bad task", null],
      ]),
    );
    const result = await runMultiAgentOrchestration(baseParams());
    expect(result).toBeDefined();
    expect(mergeWorkerResultsMock).toHaveBeenCalledTimes(1);
  });

  it("captures worker exceptions gracefully", async () => {
    // Use sequential layout: first decompose, then t1 (throws), then t2 (succeeds)
    const decompose = JSON.stringify({
      subtasks: [
        { id: "t1", task: "Crash task", role: "worker", depends_on: [] },
        { id: "t2", task: "Ok task", role: "worker", depends_on: ["t1"] },
      ],
      merge_strategy: "concatenate",
    });
    let callCount = 0;
    classifyMock.mockImplementation(async (params: Record<string, unknown>) => {
      callCount++;
      if (callCount === 1) return decompose;
      if ((params.userPrompt as string) === "Crash task") throw new Error("Network error");
      return "Worker 2 output";
    });
    const result = await runMultiAgentOrchestration(baseParams());
    expect(result).toBeDefined();
    const mergeCall = mergeWorkerResultsMock.mock.calls[0]![0];
    const results = mergeCall.results as Array<{ status: string }>;
    expect(results.some((r) => r.status === "error")).toBe(true);
    expect(results.some((r) => r.status === "ok")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Merge strategy passthrough
// ---------------------------------------------------------------------------

describe("orchestrator — merge strategy passthrough", () => {
  it("passes concatenate strategy to merger", async () => {
    setupMockSequence(
      new Map([
        ["__decompose__", DECOMPOSE_2_CONCAT],
        ["Research framework A", "Output 1"],
        ["Research framework B", "Output 2"],
      ]),
    );
    await runMultiAgentOrchestration(baseParams());
    const mergeCall = mergeWorkerResultsMock.mock.calls[0]![0] as { strategy?: string };
    expect(mergeCall.strategy).toBe("concatenate");
  });

  it("passes synthesize strategy to merger", async () => {
    setupMockSequence(
      new Map([
        ["__decompose__", DECOMPOSE_3_DEP_SYNTH],
        ["Gather data on A", "Data A"],
        ["Gather data on B", "Data B"],
        ["Compare A and B", "Comparison"],
      ]),
    );
    await runMultiAgentOrchestration(baseParams());
    const mergeCall = mergeWorkerResultsMock.mock.calls[0]![0] as { strategy?: string };
    expect(mergeCall.strategy).toBe("synthesize");
  });

  it("defaults to synthesize for unknown merge_strategy", async () => {
    const decompose = JSON.stringify({
      subtasks: [
        { id: "t1", task: "Part A", role: "worker", depends_on: [] },
        { id: "t2", task: "Part B", role: "worker", depends_on: [] },
      ],
      merge_strategy: "invalid_strategy",
    });
    setupMockSequence(
      new Map([
        ["__decompose__", decompose],
        ["Part A", "Output A"],
        ["Part B", "Output B"],
      ]),
    );
    await runMultiAgentOrchestration(baseParams());
    const mergeCall = mergeWorkerResultsMock.mock.calls[0]![0] as { strategy?: string };
    expect(mergeCall.strategy).toBe("synthesize");
  });
});

// ---------------------------------------------------------------------------
// Resource guard integration
// ---------------------------------------------------------------------------

describe("orchestrator — resource guard", () => {
  it("returns undefined when resource guard degrades (no slot available)", async () => {
    const { configureResourceGuard, acquireSlot } = await import("./resource-guard.js");
    configureResourceGuard({ maxConcurrentMultiAgent: 1 });
    const release = acquireSlot("multi");

    const result = await runMultiAgentOrchestration(baseParams());
    expect(result).toBeUndefined();
    expect(classifyMock).not.toHaveBeenCalled();

    release();
  });
});

// ---------------------------------------------------------------------------
// Subtask capping at MAX_WORKERS (4)
// ---------------------------------------------------------------------------

describe("orchestrator — limits", () => {
  it("caps subtasks at MAX_WORKERS=4", async () => {
    // Use sequential (dependent) chain to avoid parallel mock issues
    const decompose = JSON.stringify({
      subtasks: [
        { id: "t1", task: "Task 1", role: "worker", depends_on: [] },
        { id: "t2", task: "Task 2", role: "worker", depends_on: ["t1"] },
        { id: "t3", task: "Task 3", role: "worker", depends_on: ["t2"] },
        { id: "t4", task: "Task 4", role: "worker", depends_on: ["t3"] },
        { id: "t5", task: "Task 5", role: "worker", depends_on: ["t4"] },
        { id: "t6", task: "Task 6", role: "worker", depends_on: ["t5"] },
      ],
      merge_strategy: "concatenate",
    });
    setupMockSequence(
      new Map([
        ["__decompose__", decompose],
        ["Task 1", "Output 1"],
        ["Task 2", "Output 2"],
        ["Task 3", "Output 3"],
        ["Task 4", "Output 4"],
        ["Task 5", "Output 5"],
        ["Task 6", "Output 6"],
      ]),
    );
    await runMultiAgentOrchestration(baseParams());
    // Decompose (1) + 4 workers (capped at MAX_WORKERS) = 5 classify calls
    expect(classifyMock).toHaveBeenCalledTimes(5);
  });
});

// ---------------------------------------------------------------------------
// Worker system prompt content
// ---------------------------------------------------------------------------

describe("orchestrator — worker prompts", () => {
  it("includes role and original task in worker system prompt", async () => {
    // Use sequential layout to ensure all calls go through mock
    const decompose = JSON.stringify({
      subtasks: [
        { id: "t1", task: "Analyze X", role: "analyst", depends_on: [] },
        { id: "t2", task: "Research Y", role: "researcher", depends_on: ["t1"] },
      ],
      merge_strategy: "concatenate",
    });
    const workerCalls: Array<{ systemPrompt: string; userPrompt: string }> = [];
    let decomposeDone = false;
    classifyMock.mockImplementation(async (params: Record<string, unknown>) => {
      if (!decomposeDone) {
        decomposeDone = true;
        return decompose;
      }
      workerCalls.push({
        systemPrompt: params.systemPrompt as string,
        userPrompt: params.userPrompt as string,
      });
      return `Result for ${params.userPrompt}`;
    });

    await runMultiAgentOrchestration(baseParams());

    expect(workerCalls.length).toBe(2);

    const analystCall = workerCalls.find((c) => c.userPrompt === "Analyze X");
    const researcherCall = workerCalls.find((c) => c.userPrompt === "Research Y");

    expect(analystCall).toBeDefined();
    expect(analystCall!.systemPrompt).toContain("analyst");
    expect(analystCall!.systemPrompt).toContain("Analyze the pros and cons");

    expect(researcherCall).toBeDefined();
    expect(researcherCall!.systemPrompt).toContain("researcher");
  });
});

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------

describe("orchestrator — return shape", () => {
  it("returns { text: string } on success", async () => {
    setupMockSequence(
      new Map([
        ["__decompose__", DECOMPOSE_2_CONCAT],
        ["Research framework A", "Result A"],
        ["Research framework B", "Result B"],
      ]),
    );
    const result = await runMultiAgentOrchestration(baseParams());
    expect(result).toHaveProperty("text");
    expect(typeof (result as { text: string }).text).toBe("string");
  });
});
