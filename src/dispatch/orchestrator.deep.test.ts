/**
 * Deep tests for orchestrator — dependency chain execution, edge cases, and
 * config-driven model/worker limits.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { resetResourceGuard } from "./resource-guard.js";
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
    task: "Deep test task",
    decision: fakeDecision,
    cfg: fakeCfg,
    sessionKey: "agent:test:main",
    agentId: "test-agent",
    agentDir: "/tmp/agent",
    workspaceDir: "/tmp/workspace",
    ...overrides,
  };
}

function setupMockSequence(responses: Map<string, string | null>) {
  let decomposeCalled = false;
  classifyMock.mockImplementation(async (params: Record<string, unknown>) => {
    const userPrompt = params.userPrompt as string;
    const systemPrompt = params.systemPrompt as string;
    if (!decomposeCalled && userPrompt.includes("Decompose this into")) {
      decomposeCalled = true;
      return responses.get("__decompose__") ?? null;
    }
    if (
      userPrompt.includes("Worker outputs:") ||
      systemPrompt?.includes("synthesis expert") ||
      systemPrompt?.includes("quality evaluator")
    ) {
      return responses.get("__merge__") ?? null;
    }
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
// Tests
// ---------------------------------------------------------------------------

describe("orchestrator deep tests", () => {
  describe("dependency chain execution", () => {
    it("executes 3-task chain: 2 parallel + 1 dependent in correct order", async () => {
      const callOrder: string[] = [];
      const decompose = JSON.stringify({
        subtasks: [
          { id: "t1", task: "Parallel A", role: "researcher", depends_on: [] },
          { id: "t2", task: "Parallel B", role: "researcher", depends_on: [] },
          { id: "t3", task: "Dependent C", role: "analyst", depends_on: ["t1", "t2"] },
        ],
        merge_strategy: "synthesize",
      });

      let decomposeDone = false;
      classifyMock.mockImplementation(async (params: Record<string, unknown>) => {
        const userPrompt = params.userPrompt as string;
        if (!decomposeDone && userPrompt.includes("Decompose this into")) {
          decomposeDone = true;
          return decompose;
        }
        callOrder.push(userPrompt);
        return `Result for ${userPrompt}`;
      });

      await runMultiAgentOrchestration(baseParams());

      // Dependent task should execute AFTER both parallel tasks
      const cIndex = callOrder.indexOf("Dependent C");
      const aIndex = callOrder.indexOf("Parallel A");
      const bIndex = callOrder.indexOf("Parallel B");
      expect(cIndex).toBeGreaterThan(aIndex);
      expect(cIndex).toBeGreaterThan(bIndex);
    });

    it("all-dependent chain executes sequentially", async () => {
      const callOrder: string[] = [];
      const decompose = JSON.stringify({
        subtasks: [
          { id: "t1", task: "Step 1", role: "worker", depends_on: [] },
          { id: "t2", task: "Step 2", role: "worker", depends_on: ["t1"] },
          { id: "t3", task: "Step 3", role: "worker", depends_on: ["t2"] },
        ],
        merge_strategy: "concatenate",
      });

      let decomposeDone = false;
      classifyMock.mockImplementation(async (params: Record<string, unknown>) => {
        const userPrompt = params.userPrompt as string;
        if (!decomposeDone && userPrompt.includes("Decompose this into")) {
          decomposeDone = true;
          return decompose;
        }
        callOrder.push(userPrompt);
        return `Done: ${userPrompt}`;
      });

      await runMultiAgentOrchestration(baseParams());

      expect(callOrder).toEqual(["Step 1", "Step 2", "Step 3"]);
    });
  });

  describe("decomposition edge cases", () => {
    it("handles subtask with missing id field", async () => {
      const decompose = JSON.stringify({
        subtasks: [
          { task: "No ID task A", role: "worker", depends_on: [] },
          { task: "No ID task B", role: "worker", depends_on: [] },
        ],
        merge_strategy: "concatenate",
      });
      setupMockSequence(
        new Map([
          ["__decompose__", decompose],
          ["No ID task A", "Result A"],
          ["No ID task B", "Result B"],
        ]),
      );
      const result = await runMultiAgentOrchestration(baseParams());
      expect(result).toBeDefined();
    });

    it("handles subtask with missing role (defaults to worker)", async () => {
      const decompose = JSON.stringify({
        subtasks: [
          { id: "t1", task: "Task A", depends_on: [] },
          { id: "t2", task: "Task B", depends_on: ["t1"] },
        ],
        merge_strategy: "concatenate",
      });
      setupMockSequence(
        new Map([
          ["__decompose__", decompose],
          ["Task A", "Output A"],
          ["Task B", "Output B"],
        ]),
      );
      const result = await runMultiAgentOrchestration(baseParams());
      expect(result).toBeDefined();
    });

    it("handles decomposition with non-array depends_on", async () => {
      const decompose = JSON.stringify({
        subtasks: [
          { id: "t1", task: "Task 1", role: "worker", depends_on: "not-array" },
          { id: "t2", task: "Task 2", role: "worker", depends_on: null },
        ],
        merge_strategy: "concatenate",
      });
      setupMockSequence(
        new Map([
          ["__decompose__", decompose],
          ["Task 1", "Output 1"],
          ["Task 2", "Output 2"],
        ]),
      );
      const result = await runMultiAgentOrchestration(baseParams());
      expect(result).toBeDefined();
    });

    it("filters subtasks with only whitespace task text", async () => {
      const decompose = JSON.stringify({
        subtasks: [
          { id: "t1", task: "Valid task", role: "worker", depends_on: [] },
          { id: "t2", task: "   ", role: "worker", depends_on: [] },
          { id: "t3", task: "Also valid", role: "worker", depends_on: ["t1"] },
        ],
        merge_strategy: "concatenate",
      });
      setupMockSequence(
        new Map([
          ["__decompose__", decompose],
          ["Valid task", "Output 1"],
          ["Also valid", "Output 2"],
        ]),
      );
      const result = await runMultiAgentOrchestration(baseParams());
      expect(result).toBeDefined();
      // Only 2 valid subtasks executed (whitespace one filtered)
      expect(mergeWorkerResultsMock).toHaveBeenCalledTimes(1);
    });

    it("returns undefined when JSON has subtasks but task values are non-string", async () => {
      classifyMock.mockResolvedValue(
        JSON.stringify({
          subtasks: [
            { id: "t1", task: 123, role: "worker", depends_on: [] },
            { id: "t2", task: null, role: "worker", depends_on: [] },
          ],
          merge_strategy: "concatenate",
        }),
      );
      const result = await runMultiAgentOrchestration(baseParams());
      // Non-string tasks become empty string → filtered → < 2 → undefined
      expect(result).toBeUndefined();
    });
  });

  describe("worker failure patterns", () => {
    it("dependent task runs even when its dependency failed", async () => {
      const decompose = JSON.stringify({
        subtasks: [
          { id: "t1", task: "Fails", role: "worker", depends_on: [] },
          { id: "t2", task: "Depends on fail", role: "worker", depends_on: ["t1"] },
        ],
        merge_strategy: "concatenate",
      });
      setupMockSequence(
        new Map([
          ["__decompose__", decompose],
          ["Fails", null],
          ["Depends on fail", "I still ran"],
        ]),
      );
      const result = await runMultiAgentOrchestration(baseParams());
      // At least 1 success → merger called
      expect(result).toBeDefined();
      expect(mergeWorkerResultsMock).toHaveBeenCalledTimes(1);
    });

    it("orchestrator exception is caught and returns undefined", async () => {
      classifyMock.mockRejectedValue(new Error("LLM down"));
      const result = await runMultiAgentOrchestration(baseParams());
      expect(result).toBeUndefined();
    });
  });

  describe("merge strategy edge cases", () => {
    it("passes all 4 valid strategies correctly", async () => {
      for (const strategy of ["synthesize", "concatenate", "vote", "best_of_n"] as const) {
        classifyMock.mockReset();
        mergeWorkerResultsMock.mockReset();
        mergeWorkerResultsMock.mockResolvedValue("merged");
        const decompose = JSON.stringify({
          subtasks: [
            { id: "t1", task: "A", role: "w", depends_on: [] },
            { id: "t2", task: "B", role: "w", depends_on: ["t1"] },
          ],
          merge_strategy: strategy,
        });
        setupMockSequence(
          new Map([
            ["__decompose__", decompose],
            ["A", "Output A"],
            ["B", "Output B"],
          ]),
        );
        resetResourceGuard();
        await runMultiAgentOrchestration(baseParams());
        const mergeCall = mergeWorkerResultsMock.mock.calls[0]?.[0] as { strategy?: string };
        expect(mergeCall?.strategy).toBe(strategy);
      }
    });
  });

  describe("resource guard integration", () => {
    it("releases resource slot even when orchestration fails", async () => {
      const { getResourceSnapshot } = await import("./resource-guard.js");
      classifyMock.mockRejectedValue(new Error("boom"));

      await runMultiAgentOrchestration(baseParams());

      // Slot should be released after error
      expect(getResourceSnapshot().activeRequests).toBe(0);
    });

    it("releases resource slot on successful orchestration", async () => {
      const { getResourceSnapshot } = await import("./resource-guard.js");
      const decompose = JSON.stringify({
        subtasks: [
          { id: "t1", task: "OK", role: "w", depends_on: [] },
          { id: "t2", task: "OK2", role: "w", depends_on: ["t1"] },
        ],
        merge_strategy: "concatenate",
      });
      setupMockSequence(
        new Map([
          ["__decompose__", decompose],
          ["OK", "result"],
          ["OK2", "result2"],
        ]),
      );

      await runMultiAgentOrchestration(baseParams());
      expect(getResourceSnapshot().activeRequests).toBe(0);
    });
  });
});
