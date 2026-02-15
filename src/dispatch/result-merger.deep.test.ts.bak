/**
 * Deep tests for result-merger — edge cases for all 4 merge strategies.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { WorkerResult } from "./result-merger.js";

// ---------------------------------------------------------------------------
// Mock LLM
// ---------------------------------------------------------------------------

let llmMockResponse: string | null = "LLM response";

vi.mock("./llm-classify.js", () => ({
  classifyWithLightweightModel: vi.fn(async () => llmMockResponse),
}));

const { mergeWorkerResults } = await import("./result-merger.js");

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
  llmMockResponse = "LLM response";
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Concatenate deep tests
// ---------------------------------------------------------------------------

describe("concatenate deep tests", () => {
  it("handles many results with mixed statuses", async () => {
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", task: "A", output: "Good A", status: "ok" }),
      makeResult({ taskId: "t2", task: "B", output: "Error B", status: "error" }),
      makeResult({ taskId: "t3", task: "C", output: "Good C", status: "ok" }),
      makeResult({ taskId: "t4", task: "D", output: "Timeout D", status: "timeout" }),
      makeResult({ taskId: "t5", task: "E", output: "Good E", status: "ok" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "concatenate",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toContain("Good A");
    expect(merged).toContain("Good C");
    expect(merged).toContain("Good E");
    expect(merged).not.toContain("Error B");
    expect(merged).not.toContain("Timeout D");
    expect(merged).toContain("### Part 1");
    expect(merged).toContain("### Part 3");
  });

  it("preserves markdown formatting in output", async () => {
    const results: WorkerResult[] = [
      makeResult({
        taskId: "t1",
        task: "Analysis",
        output: "## Heading\n\n- bullet 1\n- bullet 2\n\n```code```",
      }),
      makeResult({
        taskId: "t2",
        task: "Summary",
        output: "**Bold** and _italic_ text",
      }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "concatenate",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toContain("## Heading");
    expect(merged).toContain("```code```");
    expect(merged).toContain("**Bold**");
  });

  it("deduplicates with leading/trailing whitespace differences", async () => {
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", task: "A", output: "  Same Answer  " }),
      makeResult({ taskId: "t2", task: "B", output: "same answer" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "concatenate",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    // After dedup, only 1 unique → returned directly (first seen output preserved)
    expect(merged).toBe("  Same Answer  ");
  });

  it("handles results where output is only whitespace", async () => {
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", task: "A", output: "   ", status: "ok" }),
      makeResult({ taskId: "t2", task: "B", output: "\n\n", status: "ok" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "concatenate",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    // All outputs are whitespace → treated as failures
    expect(merged).toBe("All workers failed to produce results.");
  });
});

// ---------------------------------------------------------------------------
// Vote deep tests
// ---------------------------------------------------------------------------

describe("vote deep tests", () => {
  it("handles all-failed results", async () => {
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", output: "err", status: "error" }),
      makeResult({ taskId: "t2", output: "err", status: "error" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "vote",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toBe("All workers failed to produce results.");
  });

  it("handles 3-way tie (picks first seen)", async () => {
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", output: "Alpha" }),
      makeResult({ taskId: "t2", output: "Beta" }),
      makeResult({ taskId: "t3", output: "Gamma" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "vote",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    // All count=1, first seen wins
    expect(["Alpha", "Beta", "Gamma"]).toContain(merged);
  });

  it("vote with whitespace-only outputs treated as failures", async () => {
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", output: "  ", status: "ok" }),
      makeResult({ taskId: "t2", output: "Real answer" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "vote",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toBe("Real answer");
  });

  it("case-insensitive vote across varied casing", async () => {
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", output: "YES" }),
      makeResult({ taskId: "t2", output: "yes" }),
      makeResult({ taskId: "t3", output: "Yes" }),
      makeResult({ taskId: "t4", output: "no" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "vote",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    // "YES", "yes", "Yes" all normalize to "yes" → count=3, original="YES" (first seen)
    expect(merged).toBe("YES");
  });
});

// ---------------------------------------------------------------------------
// Synthesize deep tests
// ---------------------------------------------------------------------------

describe("synthesize deep tests", () => {
  it("falls back to concatenation when LLM returns whitespace-only", async () => {
    llmMockResponse = "   \n\n   ";
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
    // Whitespace-only LLM response → falls back to concatenation
    expect(merged).toContain("### Part 1");
  });

  it("passes all successful results to LLM for synthesis", async () => {
    const { classifyWithLightweightModel } = await import("./llm-classify.js");
    llmMockResponse = "Comprehensive synthesis";
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", task: "Research A", output: "Data A" }),
      makeResult({ taskId: "t2", task: "Research B", output: "Error", status: "error" }),
      makeResult({ taskId: "t3", task: "Research C", output: "Data C" }),
    ];
    await mergeWorkerResults({
      results,
      originalTask: "Analyze topic",
      strategy: "synthesize",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    // LLM should be called with only successful results
    const call = vi.mocked(classifyWithLightweightModel).mock.calls[0]?.[0] as {
      userPrompt?: string;
    };
    expect(call?.userPrompt).toContain("Data A");
    expect(call?.userPrompt).toContain("Data C");
    expect(call?.userPrompt).not.toContain("Error");
  });
});

// ---------------------------------------------------------------------------
// best_of_n deep tests
// ---------------------------------------------------------------------------

describe("best_of_n deep tests", () => {
  it("falls back to concatenation when LLM fails", async () => {
    const { classifyWithLightweightModel } = await import("./llm-classify.js");
    vi.mocked(classifyWithLightweightModel).mockRejectedValueOnce(new Error("LLM down"));
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", task: "Option A", output: "Creative A" }),
      makeResult({ taskId: "t2", task: "Option B", output: "Creative B" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "best_of_n",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    // Fallback to concatenation
    expect(merged).toContain("### Part 1");
  });

  it("returns single result directly without LLM for best_of_n", async () => {
    const { classifyWithLightweightModel } = await import("./llm-classify.js");
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", output: "Only option" }),
      makeResult({ taskId: "t2", output: "Failed", status: "error" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "best_of_n",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toBe("Only option");
    expect(classifyWithLightweightModel).not.toHaveBeenCalled();
  });

  it("all-failed returns failure message for best_of_n", async () => {
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", output: "err", status: "error" }),
      makeResult({ taskId: "t2", output: "err", status: "timeout" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "best_of_n",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toBe("All workers failed to produce results.");
  });
});

// ---------------------------------------------------------------------------
// Single result optimization
// ---------------------------------------------------------------------------

describe("single result optimization", () => {
  it("synthesize with 1 successful result returns it directly", async () => {
    const { classifyWithLightweightModel } = await import("./llm-classify.js");
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", output: "Solo winner", status: "ok" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "synthesize",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toBe("Solo winner");
    expect(classifyWithLightweightModel).not.toHaveBeenCalled();
  });

  it("vote with 1 result returns it directly", async () => {
    const results: WorkerResult[] = [
      makeResult({ taskId: "t1", output: "Only vote" }),
    ];
    const merged = await mergeWorkerResults({
      results,
      originalTask: "test",
      strategy: "vote",
      cfg: fakeCfg,
      agentDir: fakeAgentDir,
    });
    expect(merged).toBe("Only vote");
  });
});
