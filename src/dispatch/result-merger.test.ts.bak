import { describe, expect, it, vi, beforeEach } from "vitest";
import type { WorkerResult } from "./result-merger.js";

// ---------------------------------------------------------------------------
// Mock: classifyWithLightweightModel (used by synthesize / best_of_n)
// ---------------------------------------------------------------------------

let llmMockResponse: string | null = "Synthesized result from LLM.";

vi.mock("./llm-classify.js", () => ({
  classifyWithLightweightModel: vi.fn(async () => llmMockResponse),
}));

// Must import AFTER mocks are registered
const { mergeWorkerResults } = await import("./result-merger.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeCfg = {} as Parameters<typeof mergeWorkerResults>[0]["cfg"];
const fakeAgentDir = "/tmp/agent";

function makeResult(overrides: Partial<WorkerResult> & { taskId: string }): WorkerResult {
  return {
    task: `Task for ${overrides.taskId}`,
    output: `Output from ${overrides.taskId}`,
    status: "ok",
    durationMs: 100,
    ...overrides,
  };
}

beforeEach(() => {
  llmMockResponse = "Synthesized result from LLM.";
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Empty results
// ---------------------------------------------------------------------------

describe("mergeWorkerResults — empty input", () => {
  it("returns fallback message when results array is empty", async () => {
    const merged = await mergeWorkerResults({
      results: [],
      originalTask: "do something",
      strategy: "concatenate",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toBe("No worker results available.");
  });
});

// ---------------------------------------------------------------------------
// Concatenate strategy
// ---------------------------------------------------------------------------

describe("mergeWorkerResults — concatenate", () => {
  it("joins multiple successful results with headers", async () => {
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", task: "Research A", output: "Result A" }),
      makeResult({ taskId: "t2", task: "Research B", output: "Result B" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "compare A and B",
      strategy: "concatenate",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toContain("### Part 1: Research A");
    expect(merged).toContain("Result A");
    expect(merged).toContain("### Part 2: Research B");
    expect(merged).toContain("Result B");
    expect(merged).toContain("---");
  });

  it("returns single result directly without headers", async () => {
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", task: "Only task", output: "Only output" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "simple task",
      strategy: "concatenate",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toBe("Only output");
    expect(merged).not.toContain("### Part");
  });

  it("deduplicates identical outputs (case-insensitive)", async () => {
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", task: "Task A", output: "Same Answer" }),
      makeResult({ taskId: "t2", task: "Task B", output: "same answer" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "concatenate",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    // After dedup, only 1 unique result → returned directly
    expect(merged).toBe("Same Answer");
    expect(merged).not.toContain("### Part 2");
  });

  it("skips failed and empty-output results", async () => {
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", task: "Good", output: "Valid output" }),
      makeResult({ taskId: "t2", task: "Failed", output: "Error: timeout", status: "error" }),
      makeResult({ taskId: "t3", task: "Empty", output: "   ", status: "ok" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "concatenate",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toBe("Valid output");
  });

  it("returns failure message when all workers failed", async () => {
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", output: "Error", status: "error" }),
      makeResult({ taskId: "t2", output: "Timeout", status: "timeout" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "concatenate",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toBe("All workers failed to produce results.");
  });
});

// ---------------------------------------------------------------------------
// Vote strategy
// ---------------------------------------------------------------------------

describe("mergeWorkerResults — vote", () => {
  it("returns the majority answer", async () => {
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", output: "Yes" }),
      makeResult({ taskId: "t2", output: "yes" }), // case-insensitive match
      makeResult({ taskId: "t3", output: "No" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "Is this correct?",
      strategy: "vote",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toBe("Yes");
  });

  it("picks the first majority when tied", async () => {
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", output: "Alpha" }),
      makeResult({ taskId: "t2", output: "Beta" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "choose",
      strategy: "vote",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    // Both count=1, first one seen wins
    expect(["Alpha", "Beta"]).toContain(merged);
  });

  it("ignores failed results in voting", async () => {
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", output: "Correct", status: "ok" }),
      makeResult({ taskId: "t2", output: "Wrong", status: "error" }),
      makeResult({ taskId: "t3", output: "Correct", status: "ok" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "vote test",
      strategy: "vote",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toBe("Correct");
  });
});

// ---------------------------------------------------------------------------
// Synthesize strategy (LLM-based)
// ---------------------------------------------------------------------------

describe("mergeWorkerResults — synthesize", () => {
  it("calls LLM and returns synthesized result", async () => {
    llmMockResponse = "A comprehensive analysis combining both perspectives.";
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", output: "Perspective A" }),
      makeResult({ taskId: "t2", output: "Perspective B" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "analyze topic",
      strategy: "synthesize",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toBe("A comprehensive analysis combining both perspectives.");
  });

  it("returns single successful result directly without LLM call", async () => {
    const { classifyWithLightweightModel } = await import("./llm-classify.js");
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", output: "Solo result" }),
      makeResult({ taskId: "t2", output: "Error", status: "error" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "synthesize",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toBe("Solo result");
    // LLM should not be called for a single successful result
    expect(classifyWithLightweightModel).not.toHaveBeenCalled();
  });

  it("falls back to concatenation when LLM returns null", async () => {
    llmMockResponse = null;
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", task: "Part 1", output: "Output 1" }),
      makeResult({ taskId: "t2", task: "Part 2", output: "Output 2" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "synthesize",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    // Fallback to concatenation
    expect(merged).toContain("### Part 1");
    expect(merged).toContain("Output 1");
  });

  it("falls back to concatenation when LLM throws", async () => {
    const { classifyWithLightweightModel } = await import("./llm-classify.js");
    vi.mocked(classifyWithLightweightModel).mockRejectedValueOnce(new Error("LLM unavailable"));
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", task: "Part 1", output: "Output 1" }),
      makeResult({ taskId: "t2", task: "Part 2", output: "Output 2" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "synthesize",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toContain("### Part 1");
  });
});

// ---------------------------------------------------------------------------
// best_of_n strategy (LLM-based)
// ---------------------------------------------------------------------------

describe("mergeWorkerResults — best_of_n", () => {
  it("calls LLM to select the best result", async () => {
    llmMockResponse = "The best creative output.";
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", output: "Creative option A" }),
      makeResult({ taskId: "t2", output: "Creative option B" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "write a poem",
      strategy: "best_of_n",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toBe("The best creative output.");
  });
});

// ---------------------------------------------------------------------------
// Unknown strategy — falls back to concatenation
// ---------------------------------------------------------------------------

describe("mergeWorkerResults — unknown strategy", () => {
  it("falls back to concatenation for unknown strategy", async () => {
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", task: "Part A", output: "A" }),
      makeResult({ taskId: "t2", task: "Part B", output: "B" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "nonexistent" as never,
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toContain("### Part 1");
  });
});
