/**
 * Deep tests for engine.ts internal helpers — expandMCPToolPatterns,
 * applyMediaBoost, maybeReclassifyWithMedia, resolveModelWithFallback,
 * resolveStrategyModelOverride, assessComplexity.
 *
 * These test the pure/near-pure functions directly, complementing the
 * integration-level engine.deep.test.ts.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { resetResourceGuard } from "./resource-guard.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const assessComplexityByRulesMock = vi.fn();
const resolveStrategyMock = vi.fn();
const scoreToComplexityLevelMock = vi.fn();
const parseModelRefMock = vi.fn();

vi.mock("./intent-classifier.js", () => ({
  classifyIntent: vi.fn(),
}));

vi.mock("./config-loader.js", () => ({
  loadDispatchConfig: vi.fn(() => null),
}));

vi.mock("./complexity-classifier.js", () => ({
  assessComplexityByRules: assessComplexityByRulesMock,
  resolveStrategy: resolveStrategyMock,
  scoreToComplexityLevel: scoreToComplexityLevelMock,
}));

vi.mock("./cost-estimator.js", () => ({
  estimateCost: vi.fn(() => ({ costUsd: 0, inputTokens: 0 })),
  checkBudget: vi.fn(() => ({ allowed: true })),
  recordSpending: vi.fn(),
}));

vi.mock("./session-context.js", () => ({
  analyzeSessionContext: vi.fn(),
  adjustComplexity: vi.fn(),
  recordTurn: vi.fn(),
}));

vi.mock("./dispatch-telemetry.js", () => ({
  isTelemetryEnabled: vi.fn(() => false),
  setTelemetryEnabled: vi.fn(),
  buildEventFromDecision: vi.fn(() => ({})),
  recordEvent: vi.fn(() => "evt-1"),
}));

vi.mock("../agents/model-selection.js", () => ({
  parseModelRef: parseModelRefMock,
}));

vi.mock("../agents/defaults.js", () => ({
  DEFAULT_PROVIDER: "anthropic",
}));

// We need to test the internal functions. Since they're not exported,
// we test them via the public dispatchRequest API with carefully crafted inputs.
// However, expandMCPToolPatterns behavior is observable through the returned mcpToolHints.

const { dispatchRequest } = await import("./engine.js");
import type { CompiledDispatchConfig, CompiledIntent, DispatchRequestParams } from "./types.js";

function makeIntent(overrides?: Partial<CompiledIntent>): CompiledIntent {
  return {
    id: "test-intent",
    description: "Test",
    patterns: { keywords: [], regex: [], semanticTags: [] },
    routing: { model: null },
    skills: [],
    mcpTools: [],
    compiledRegex: [],
    lowerKeywords: [],
    ...overrides,
  };
}

function makeConfig(overrides?: Partial<CompiledDispatchConfig>): CompiledDispatchConfig {
  return {
    settings: { enabled: true, ruleConfidenceThreshold: 0.7, timeoutMs: 3000, debug: false },
    intents: [makeIntent()],
    complexity: { enabled: true, strategies: {} },
    ...overrides,
  } as CompiledDispatchConfig;
}

const { loadDispatchConfig: loadDispatchConfigRef } = await import("./config-loader.js");
const { classifyIntent: classifyIntentRef } = await import("./intent-classifier.js");
const loadDispatchConfigMock = vi.mocked(loadDispatchConfigRef);
const classifyIntentMock = vi.mocked(classifyIntentRef);

function setupMocks(config: CompiledDispatchConfig) {
  loadDispatchConfigMock.mockReturnValue(config);
  classifyIntentMock.mockResolvedValue({
    intentId: "test-intent",
    confidence: 0.8,
    classifierUsed: "rules",
  });
  assessComplexityByRulesMock.mockReturnValue({ score: 5, confident: true, signals: [] });
  scoreToComplexityLevelMock.mockReturnValue("medium");
  resolveStrategyMock.mockReturnValue("single");
  parseModelRefMock.mockReturnValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetResourceGuard();
});

// ---------------------------------------------------------------------------
// expandMCPToolPatterns (tested via dispatchRequest output)
// ---------------------------------------------------------------------------

describe("expandMCPToolPatterns edge cases", () => {
  it("wildcard * matches all tools with prefix", async () => {
    const cfg = makeConfig({ intents: [makeIntent({ mcpTools: ["db_*"] })] });
    setupMocks(cfg);

    const result = await dispatchRequest({
      prompt: "test",
      openclawcnConfig: {} as any,
      agentDir: "/tmp",
      workspaceDir: "/tmp",
      availableMCPTools: ["db_query", "db_list", "db_insert", "other_tool"],
    });

    expect(result.mcpToolHints).toContain("db_query");
    expect(result.mcpToolHints).toContain("db_list");
    expect(result.mcpToolHints).toContain("db_insert");
    expect(result.mcpToolHints).not.toContain("other_tool");
  });

  it("wildcard in middle of pattern works", async () => {
    const cfg = makeConfig({ intents: [makeIntent({ mcpTools: ["mcp_*_query"] })] });
    setupMocks(cfg);

    const result = await dispatchRequest({
      prompt: "test",
      openclawcnConfig: {} as any,
      agentDir: "/tmp",
      workspaceDir: "/tmp",
      availableMCPTools: ["mcp_db_query", "mcp_search_query", "mcp_db_list"],
    });

    expect(result.mcpToolHints).toContain("mcp_db_query");
    expect(result.mcpToolHints).toContain("mcp_search_query");
    expect(result.mcpToolHints).not.toContain("mcp_db_list");
  });

  it("deduplicates when multiple patterns match same tool", async () => {
    const cfg = makeConfig({ intents: [makeIntent({ mcpTools: ["mcp_*", "mcp_db_query"] })] });
    setupMocks(cfg);

    const result = await dispatchRequest({
      prompt: "test",
      openclawcnConfig: {} as any,
      agentDir: "/tmp",
      workspaceDir: "/tmp",
      availableMCPTools: ["mcp_db_query"],
    });

    // Should only appear once
    expect(result.mcpToolHints.filter((t: string) => t === "mcp_db_query")).toHaveLength(1);
  });

  it("regex special chars in pattern are escaped", async () => {
    const cfg = makeConfig({ intents: [makeIntent({ mcpTools: ["tool.name*"] })] });
    setupMocks(cfg);

    const result = await dispatchRequest({
      prompt: "test",
      openclawcnConfig: {} as any,
      agentDir: "/tmp",
      workspaceDir: "/tmp",
      availableMCPTools: ["tool.name_v1", "toolXname_v2"],
    });

    // "." should be literal, not regex any-char
    expect(result.mcpToolHints).toContain("tool.name_v1");
    expect(result.mcpToolHints).not.toContain("toolXname_v2");
  });
});

// ---------------------------------------------------------------------------
// Media reclassification (tested via dispatchRequest)
// ---------------------------------------------------------------------------

describe("maybeReclassifyWithMedia edge cases", () => {
  it("switches intent when media signal is strong and text confidence is low", async () => {
    const imageIntent = makeIntent({
      id: "image-analysis",
      patterns: { keywords: [], regex: [], semanticTags: [], mediaTypes: ["image"] },
    });
    const textIntent = makeIntent({ id: "general" });
    const cfg = makeConfig({ intents: [textIntent, imageIntent] });
    setupMocks(cfg);

    // Text classifier returns "general" with LOW confidence
    classifyIntentMock.mockResolvedValue({
      intentId: "general",
      confidence: 0.3, // below 0.5 threshold
      classifierUsed: "rules",
    });

    const result = await dispatchRequest({
      prompt: "这是什么",
      openclawcnConfig: {} as any,
      agentDir: "/tmp",
      workspaceDir: "/tmp",
      mediaTypes: ["image"],
    });

    // Should switch to image-analysis intent
    expect(result.intent).toBe("image-analysis");
  });

  it("does NOT switch when text confidence is high", async () => {
    const imageIntent = makeIntent({
      id: "image-analysis",
      patterns: { keywords: [], regex: [], semanticTags: [], mediaTypes: ["image"] },
    });
    const textIntent = makeIntent({ id: "general" });
    const cfg = makeConfig({ intents: [textIntent, imageIntent] });
    setupMocks(cfg);

    classifyIntentMock.mockResolvedValue({
      intentId: "general",
      confidence: 0.9, // above 0.5 threshold
      classifierUsed: "rules",
    });

    const result = await dispatchRequest({
      prompt: "帮我写代码",
      openclawcnConfig: {} as any,
      agentDir: "/tmp",
      workspaceDir: "/tmp",
      mediaTypes: ["image"],
    });

    // Should NOT switch — text confidence too high
    expect(result.intent).toBe("general");
  });
});
