import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ToolSearchResult } from "../config/types.tool-discovery.js";

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
const { selectTools } = await import("./tool-selector.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCandidates(count: number): ToolSearchResult[] {
  return Array.from({ length: count }, (_, i) => ({
    entry: {
      id: `tool_${i + 1}`,
      type: "core" as const,
      name: `tool_${i + 1}`,
      description: `Description for tool ${i + 1}`,
      tags: [],
    },
    score: 1 - i * 0.01,
    matchSource: "fts" as const,
  }));
}

function baseParams(candidateCount = 20) {
  return {
    prompt: "Help me analyze this data",
    candidates: makeCandidates(candidateCount),
    intent: "data_analysis",
    complexity: "medium" as const,
    cfg: {} as Parameters<typeof selectTools>[0]["cfg"],
    agentDir: "/tmp/agent",
  };
}

beforeEach(() => {
  classifyMock.mockReset();
});

// ---------------------------------------------------------------------------
// Fast path (candidates <= maxTools)
// ---------------------------------------------------------------------------

describe("tool-selector — fast path", () => {
  it("skips LLM when candidates <= default maxTools (8)", async () => {
    const result = await selectTools(baseParams(5));
    expect(result.selectedToolIds).toHaveLength(5);
    expect(result.isFallback).toBe(false);
    expect(result.confidence).toBe(1.0);
    expect(classifyMock).not.toHaveBeenCalled();
  });

  it("skips LLM when candidates <= custom maxTools", async () => {
    const result = await selectTools({ ...baseParams(10), maxTools: 15 });
    expect(result.selectedToolIds).toHaveLength(10);
    expect(classifyMock).not.toHaveBeenCalled();
  });

  it("skips LLM when candidates exactly equals maxTools", async () => {
    const result = await selectTools({ ...baseParams(8), maxTools: 8 });
    expect(result.selectedToolIds).toHaveLength(8);
    expect(classifyMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Successful LLM selection
// ---------------------------------------------------------------------------

describe("tool-selector — LLM selection", () => {
  it("filters candidates based on LLM response", async () => {
    classifyMock.mockResolvedValue(
      JSON.stringify({ selected: [1, 3, 5], reasoning: "These are most relevant" }),
    );
    const result = await selectTools(baseParams(20));
    expect(result.selectedToolIds).toEqual(["tool_1", "tool_3", "tool_5"]);
    expect(result.reasoning).toBe("These are most relevant");
    expect(result.isFallback).toBe(false);
    expect(result.confidence).toBe(0.85);
  });

  it("strips markdown fences from LLM response", async () => {
    classifyMock.mockResolvedValue('```json\n{"selected": [2, 4], "reasoning": "fenced"}\n```');
    const result = await selectTools(baseParams(20));
    expect(result.selectedToolIds).toEqual(["tool_2", "tool_4"]);
  });

  it("caps selection at maxTools", async () => {
    classifyMock.mockResolvedValue(
      JSON.stringify({ selected: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], reasoning: "many" }),
    );
    const result = await selectTools({ ...baseParams(20), maxTools: 5 });
    expect(result.selectedToolIds).toHaveLength(5);
  });

  it("filters out-of-range indices", async () => {
    classifyMock.mockResolvedValue(
      JSON.stringify({ selected: [0, 1, 999, 3], reasoning: "some invalid" }),
    );
    const result = await selectTools(baseParams(20));
    // 0 and 999 are out of range (1-based indexing)
    expect(result.selectedToolIds).toEqual(["tool_1", "tool_3"]);
  });

  it("includes intent and complexity in prompt", async () => {
    classifyMock.mockResolvedValue(JSON.stringify({ selected: [1], reasoning: "ok" }));
    await selectTools({
      ...baseParams(20),
      intent: "code_generation",
      complexity: "high",
    });
    const call = classifyMock.mock.calls[0]![0];
    expect(call.userPrompt).toContain("code_generation");
    expect(call.userPrompt).toContain("high");
  });

  it("includes subtask description when provided", async () => {
    classifyMock.mockResolvedValue(JSON.stringify({ selected: [1], reasoning: "ok" }));
    await selectTools({
      ...baseParams(20),
      subtaskDescription: "Query the database for user records",
    });
    const call = classifyMock.mock.calls[0]![0];
    expect(call.userPrompt).toContain("Query the database for user records");
  });
});

// ---------------------------------------------------------------------------
// Fallback scenarios
// ---------------------------------------------------------------------------

describe("tool-selector — fallback", () => {
  it("falls back to top-N on LLM null response", async () => {
    classifyMock.mockResolvedValue(null);
    const result = await selectTools(baseParams(20));
    expect(result.isFallback).toBe(true);
    expect(result.selectedToolIds).toHaveLength(8); // default maxTools
    expect(result.selectedToolIds[0]).toBe("tool_1"); // top scored
    expect(result.confidence).toBe(0.5);
  });

  it("falls back to top-N on LLM exception", async () => {
    classifyMock.mockRejectedValue(new Error("Network timeout"));
    const result = await selectTools(baseParams(20));
    expect(result.isFallback).toBe(true);
    expect(result.selectedToolIds).toHaveLength(8);
  });

  it("falls back on invalid JSON response", async () => {
    classifyMock.mockResolvedValue("This is not JSON at all");
    const result = await selectTools(baseParams(20));
    expect(result.isFallback).toBe(true);
  });

  it("falls back when selected array is empty", async () => {
    classifyMock.mockResolvedValue(JSON.stringify({ selected: [], reasoning: "nothing" }));
    const result = await selectTools(baseParams(20));
    expect(result.isFallback).toBe(true);
  });

  it("falls back when all indices are out of range", async () => {
    classifyMock.mockResolvedValue(JSON.stringify({ selected: [0, -1, 999], reasoning: "bad" }));
    const result = await selectTools(baseParams(20));
    expect(result.isFallback).toBe(true);
  });

  it("respects custom maxTools in fallback", async () => {
    classifyMock.mockResolvedValue(null);
    const result = await selectTools({ ...baseParams(20), maxTools: 3 });
    expect(result.selectedToolIds).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("tool-selector — edge cases", () => {
  it("handles empty candidate list", async () => {
    const result = await selectTools({ ...baseParams(0) });
    expect(result.selectedToolIds).toEqual([]);
    expect(result.isFallback).toBe(false);
    expect(classifyMock).not.toHaveBeenCalled();
  });

  it("prefers descriptionCn over description for Chinese users", async () => {
    const cnCandidates: ToolSearchResult[] = [
      ...makeCandidates(9), // 9 candidates to exceed default maxTools (8)
    ];
    cnCandidates[0]!.entry.descriptionCn = "中文描述";
    classifyMock.mockResolvedValue(JSON.stringify({ selected: [1], reasoning: "ok" }));
    await selectTools({
      ...baseParams(9),
      candidates: cnCandidates,
    });
    const call = classifyMock.mock.calls[0]![0];
    expect(call.userPrompt).toContain("中文描述");
  });

  it("latencyMs is always positive", async () => {
    classifyMock.mockResolvedValue(JSON.stringify({ selected: [1], reasoning: "fast" }));
    const result = await selectTools(baseParams(20));
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
