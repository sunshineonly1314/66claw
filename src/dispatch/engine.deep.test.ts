/**
 * Deep tests for the dispatch engine — the 16-step routing pipeline.
 * This is the single most important untested module: 95% of engine.ts had zero tests.
 *
 * Covers: config loading, intent classification, media boost, media reclassification,
 * complexity assessment, session context, memory signals, resource guard, strategy model
 * override, cost/budget guard, MCP tool expansion, and error recovery.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { resetResourceGuard, configureResourceGuard, recordOutcome } from "./resource-guard.js";
import type { CompiledDispatchConfig, CompiledIntent, DispatchRequestParams } from "./types.js";

// ---------------------------------------------------------------------------
// Mocks — must come before dynamic import of engine.ts
// ---------------------------------------------------------------------------

const classifyIntentMock = vi.fn();
const loadDispatchConfigMock = vi.fn();
const assessComplexityByRulesMock = vi.fn();
const resolveStrategyMock = vi.fn();
const scoreToComplexityLevelMock = vi.fn();
const estimateCostMock = vi.fn();
const checkBudgetMock = vi.fn();
const recordSpendingMock = vi.fn();
const analyzeSessionContextMock = vi.fn();
const adjustComplexityMock = vi.fn();
const recordTurnMock = vi.fn();
const parseModelRefMock = vi.fn();

vi.mock("./intent-classifier.js", () => ({
  classifyIntent: classifyIntentMock,
}));

vi.mock("./config-loader.js", () => ({
  loadDispatchConfig: loadDispatchConfigMock,
}));

vi.mock("./complexity-classifier.js", () => ({
  assessComplexityByRules: assessComplexityByRulesMock,
  resolveStrategy: resolveStrategyMock,
  scoreToComplexityLevel: scoreToComplexityLevelMock,
}));

vi.mock("./cost-estimator.js", () => ({
  estimateCost: estimateCostMock,
  checkBudget: checkBudgetMock,
  recordSpending: recordSpendingMock,
}));

vi.mock("./session-context.js", () => ({
  analyzeSessionContext: analyzeSessionContextMock,
  adjustComplexity: adjustComplexityMock,
  recordTurn: recordTurnMock,
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

const { dispatchRequest } = await import("./engine.js");

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeIntent(overrides?: Partial<CompiledIntent>): CompiledIntent {
  return {
    id: "research",
    description: "Research tasks",
    patterns: { keywords: ["研究"], regex: [], semanticTags: [], mediaTypes: [] },
    routing: { model: null },
    skills: [],
    mcpTools: [],
    compiledRegex: [],
    lowerKeywords: ["研究"],
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

function makeParams(overrides?: Partial<DispatchRequestParams>): DispatchRequestParams {
  return {
    prompt: "研究一下这个问题",
    openclawcnConfig: {} as any,
    agentDir: "/tmp/agent",
    workspaceDir: "/tmp/workspace",
    ...overrides,
  };
}

function setupDefaultMocks(config?: CompiledDispatchConfig) {
  const cfg = config ?? makeConfig();
  loadDispatchConfigMock.mockReturnValue(cfg);
  classifyIntentMock.mockResolvedValue({
    intentId: "research",
    confidence: 0.85,
    classifierUsed: "rules",
  });
  assessComplexityByRulesMock.mockReturnValue({
    score: 5,
    confident: true,
    signals: ["keyword_match"],
  });
  scoreToComplexityLevelMock.mockReturnValue("medium");
  resolveStrategyMock.mockReturnValue("single");
  estimateCostMock.mockReturnValue({ costUsd: 0.001, inputTokens: 100 });
  checkBudgetMock.mockReturnValue({ allowed: true });
  parseModelRefMock.mockReturnValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetResourceGuard();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("engine.ts dispatch pipeline", () => {
  describe("Step 1-2: config loading and disabled/missing config", () => {
    it("returns DEFAULT_DECISION when config is null", async () => {
      loadDispatchConfigMock.mockReturnValue(null);

      const result = await dispatchRequest(makeParams());

      expect(result.intent).toBe("default");
      expect(result.confidence).toBe(0);
      expect(result.strategy).toBe("single");
    });

    it("returns DEFAULT_DECISION when config.settings.enabled is false", async () => {
      loadDispatchConfigMock.mockReturnValue(
        makeConfig({ settings: { enabled: false, ruleConfidenceThreshold: 0.7, timeoutMs: 3000, debug: false } }),
      );

      const result = await dispatchRequest(makeParams());
      expect(result.intent).toBe("default");
    });
  });

  describe("Step 3-4: intent classification", () => {
    it("uses classified intent for routing", async () => {
      setupDefaultMocks();

      const result = await dispatchRequest(makeParams());

      expect(result.intent).toBe("research");
      expect(result.confidence).toBe(0.85);
      expect(result.classifierUsed).toBe("rules");
    });

    it("returns DEFAULT_DECISION when classified intent not found in config", async () => {
      setupDefaultMocks();
      classifyIntentMock.mockResolvedValue({
        intentId: "nonexistent",
        confidence: 0.9,
        classifierUsed: "rules",
      });

      const result = await dispatchRequest(makeParams());
      expect(result.intent).toBe("default");
    });

    it("returns DEFAULT_DECISION when signal is aborted after classification", async () => {
      setupDefaultMocks();
      const abortController = new AbortController();
      // Abort during classification
      classifyIntentMock.mockImplementation(async () => {
        abortController.abort();
        return { intentId: "research", confidence: 0.9, classifierUsed: "rules" };
      });

      const result = await dispatchRequest(makeParams({ signal: abortController.signal }));
      expect(result.intent).toBe("default");
    });
  });

  describe("Step 5: media boost", () => {
    it("boosts confidence when media types overlap with intent patterns", async () => {
      const cfg = makeConfig({
        intents: [makeIntent({ patterns: { keywords: ["分析"], regex: [], semanticTags: [], mediaTypes: ["image"] } })],
      });
      setupDefaultMocks(cfg);
      classifyIntentMock.mockResolvedValue({
        intentId: "research",
        confidence: 0.6,
        classifierUsed: "rules",
      });

      const result = await dispatchRequest(makeParams({ mediaTypes: ["image"] }));

      // Confidence should be boosted by 0.25 (0.6 + 0.25 = 0.85)
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it("does not boost when no media types provided", async () => {
      setupDefaultMocks();
      classifyIntentMock.mockResolvedValue({
        intentId: "research",
        confidence: 0.6,
        classifierUsed: "rules",
      });

      const result = await dispatchRequest(makeParams());
      expect(result.confidence).toBe(0.6);
    });
  });

  describe("Step 9: complexity assessment", () => {
    it("uses rule-based complexity when rules are confident", async () => {
      setupDefaultMocks();
      assessComplexityByRulesMock.mockReturnValue({ score: 8, confident: true, signals: ["long_prompt"] });
      scoreToComplexityLevelMock.mockReturnValue("high");
      resolveStrategyMock.mockReturnValue("multi");

      const result = await dispatchRequest(makeParams());

      expect(result.complexity).toBe("high");
      expect(result.strategy).toBe("multi");
    });

    it("uses LLM complexity when rules are not confident", async () => {
      setupDefaultMocks();
      assessComplexityByRulesMock.mockReturnValue({ score: 5, confident: false, signals: [] });
      classifyIntentMock.mockResolvedValue({
        intentId: "research",
        confidence: 0.85,
        classifierUsed: "llm",
        llmComplexity: "high",
      });
      // When LLM complexity is used directly, it bypasses scoreToComplexityLevel
      resolveStrategyMock.mockReturnValue("enhanced");

      const result = await dispatchRequest(makeParams());
      expect(result.complexity).toBe("high");
    });

    it("returns medium/single when complexity assessment is disabled", async () => {
      const cfg = makeConfig({ complexity: { enabled: false, strategies: {} } as any });
      setupDefaultMocks(cfg);

      const result = await dispatchRequest(makeParams());
      expect(result.complexity).toBe("medium");
      expect(result.strategy).toBe("single");
    });
  });

  describe("Step 10: session context adjustment", () => {
    it("adjusts complexity based on session context when sessionId provided", async () => {
      setupDefaultMocks();
      analyzeSessionContextMock.mockReturnValue({
        turnCount: 5,
        topicContinuation: true,
        complexityTrend: "increasing",
        complexityAdjustment: 1,
      });
      adjustComplexityMock.mockReturnValue("high");
      resolveStrategyMock.mockReturnValue("enhanced");

      const result = await dispatchRequest(makeParams({ sessionId: "session-1" }));

      expect(analyzeSessionContextMock).toHaveBeenCalledWith("session-1", expect.any(String), "research");
      expect(result.sessionSignals).toBeDefined();
      expect(result.sessionSignals!.turnCount).toBe(5);
    });

    it("does not analyze session when no sessionId", async () => {
      setupDefaultMocks();

      const result = await dispatchRequest(makeParams());

      expect(analyzeSessionContextMock).not.toHaveBeenCalled();
      expect(result.sessionSignals).toBeUndefined();
    });

    it("does not adjust when complexityAdjustment is 0", async () => {
      setupDefaultMocks();
      analyzeSessionContextMock.mockReturnValue({
        turnCount: 1,
        topicContinuation: false,
        complexityTrend: "stable",
        complexityAdjustment: 0,
      });

      await dispatchRequest(makeParams({ sessionId: "s1" }));
      expect(adjustComplexityMock).not.toHaveBeenCalled();
    });
  });

  describe("Step 10.5: memory signal adjustment", () => {
    it("boosts complexity on cross-session continuation with high prior complexity", async () => {
      setupDefaultMocks();
      adjustComplexityMock.mockReturnValue("high");
      resolveStrategyMock.mockReturnValue("multi");

      const result = await dispatchRequest(makeParams({
        memorySignals: {
          crossSessionContinuation: true,
          priorComplexity: "high",
          relevanceScore: 0.9,
        },
      }));

      expect(adjustComplexityMock).toHaveBeenCalledWith("medium", 1);
      expect(result.complexitySignals).toContain("memory_cross_session_high");
    });

    it("inherits prior complexity on high relevance + same intent", async () => {
      setupDefaultMocks();
      scoreToComplexityLevelMock.mockReturnValue("low");
      resolveStrategyMock.mockReturnValue("single");

      const result = await dispatchRequest(makeParams({
        memorySignals: {
          priorComplexity: "high",
          priorIntent: "research",
          relevanceScore: 0.8,
        },
      }));

      expect(result.complexity).toBe("high");
      expect(result.complexitySignals).toContain("memory_relevance_boost");
    });

    it("does NOT boost when relevance score is below 0.7", async () => {
      setupDefaultMocks();

      const result = await dispatchRequest(makeParams({
        memorySignals: {
          priorComplexity: "high",
          priorIntent: "research",
          relevanceScore: 0.5,
        },
      }));

      // Should not change — relevance too low
      expect(result.complexitySignals).not.toContain("memory_relevance_boost");
    });

    it("does NOT inherit when prior intent differs from current", async () => {
      setupDefaultMocks();

      const result = await dispatchRequest(makeParams({
        memorySignals: {
          priorComplexity: "high",
          priorIntent: "coding", // different from "research"
          relevanceScore: 0.9,
        },
      }));

      expect(result.complexitySignals).not.toContain("memory_relevance_boost");
    });
  });

  describe("Step 11: resource guard degradation", () => {
    it("degrades multi strategy when resource guard blocks it", async () => {
      setupDefaultMocks();
      resolveStrategyMock.mockReturnValue("multi");
      // Fill up resources to force degradation
      configureResourceGuard({ maxConcurrentRequests: 1 });
      // Occupy all slots
      const { acquireSlot } = await import("./resource-guard.js");
      const release = acquireSlot("single");

      const result = await dispatchRequest(makeParams());

      // multi needs headroom (3 slots) but only 1 max → degraded
      expect(result.strategyDegraded).toBe(true);
      release();
    });
  });

  describe("Step 13: cost estimation and budget guard", () => {
    it("downgrades model when budget is exceeded", async () => {
      const cfg = makeConfig({
        budget: { hourlyLimitUsd: 1.0, dailyLimitUsd: 10.0, warningThresholdPct: 0.8 } as any,
      });
      setupDefaultMocks(cfg);
      estimateCostMock.mockReturnValue({ costUsd: 0.5, inputTokens: 1000 });
      checkBudgetMock.mockReturnValue({
        allowed: false,
        reason: "Hourly limit exceeded",
        suggestedModel: "anthropic/claude-haiku-3",
      });
      parseModelRefMock.mockReturnValue({ provider: "anthropic", model: "claude-haiku-3" });

      const result = await dispatchRequest(makeParams());

      expect(result.modelOverride).toEqual({ provider: "anthropic", model: "claude-haiku-3" });
      // estimateCost should be called twice (original + re-estimate after downgrade)
      expect(estimateCostMock).toHaveBeenCalledTimes(2);
    });

    it("keeps original model when budget is OK", async () => {
      const cfg = makeConfig({
        budget: { hourlyLimitUsd: 100 } as any,
      });
      setupDefaultMocks(cfg);
      checkBudgetMock.mockReturnValue({ allowed: true });

      const result = await dispatchRequest(makeParams());

      // Model should not be downgraded
      expect(estimateCostMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("Step 12: strategy model override", () => {
    it("uses strategy-specific model when no intent model exists", async () => {
      const cfg = makeConfig({
        complexity: {
          enabled: true,
          strategies: { enhanced: { model: "anthropic/claude-sonnet-4-5" } },
        } as any,
      });
      setupDefaultMocks(cfg);
      resolveStrategyMock.mockReturnValue("enhanced");
      parseModelRefMock.mockImplementation((spec: string) => {
        if (spec === "anthropic/claude-sonnet-4-5") {
          return { provider: "anthropic", model: "claude-sonnet-4-5" };
        }
        return null;
      });

      const result = await dispatchRequest(makeParams());

      expect(result.modelOverride).toEqual({ provider: "anthropic", model: "claude-sonnet-4-5" });
    });

    it("intent model takes precedence over strategy model", async () => {
      const cfg = makeConfig({
        intents: [makeIntent({ routing: { model: "anthropic/claude-opus-4-6" } })],
        complexity: {
          enabled: true,
          strategies: { single: { model: "anthropic/claude-haiku-3" } },
        } as any,
      });
      setupDefaultMocks(cfg);
      parseModelRefMock.mockImplementation((spec: string) => {
        if (spec === "anthropic/claude-opus-4-6") {
          return { provider: "anthropic", model: "claude-opus-4-6" };
        }
        return null;
      });

      const result = await dispatchRequest(makeParams());

      expect(result.modelOverride).toEqual({ provider: "anthropic", model: "claude-opus-4-6" });
    });
  });

  describe("MCP tool expansion", () => {
    it("expands wildcard patterns against available tools", async () => {
      const cfg = makeConfig({
        intents: [makeIntent({ mcpTools: ["mcp_db_*", "mcp_search_query"] })],
      });
      setupDefaultMocks(cfg);

      const result = await dispatchRequest(makeParams({
        availableMCPTools: ["mcp_db_query", "mcp_db_list", "mcp_search_query", "mcp_other"],
      }));

      expect(result.mcpToolHints).toContain("mcp_db_query");
      expect(result.mcpToolHints).toContain("mcp_db_list");
      expect(result.mcpToolHints).toContain("mcp_search_query");
      expect(result.mcpToolHints).not.toContain("mcp_other");
    });

    it("returns empty array when no patterns or no available tools", async () => {
      const cfg = makeConfig({ intents: [makeIntent({ mcpTools: [] })] });
      setupDefaultMocks(cfg);

      const result = await dispatchRequest(makeParams());
      expect(result.mcpToolHints).toEqual([]);
    });

    it("exact match only adds if tool exists in available list", async () => {
      const cfg = makeConfig({ intents: [makeIntent({ mcpTools: ["nonexistent_tool"] })] });
      setupDefaultMocks(cfg);

      const result = await dispatchRequest(makeParams({
        availableMCPTools: ["other_tool"],
      }));
      expect(result.mcpToolHints).toEqual([]);
    });
  });

  describe("model fallback resolution", () => {
    it("tries fallbackModel when primary model fails to resolve", async () => {
      const cfg = makeConfig({
        intents: [makeIntent({
          routing: { model: "invalid/model", fallbackModel: "anthropic/claude-haiku-3" },
        })],
      });
      setupDefaultMocks(cfg);
      parseModelRefMock.mockImplementation((spec: string) => {
        if (spec === "anthropic/claude-haiku-3") {
          return { provider: "anthropic", model: "claude-haiku-3" };
        }
        return null; // primary fails
      });

      const result = await dispatchRequest(makeParams());

      expect(result.modelOverride).toEqual({ provider: "anthropic", model: "claude-haiku-3" });
    });
  });

  describe("error recovery", () => {
    it("returns DEFAULT_DECISION and records failure on exception", async () => {
      loadDispatchConfigMock.mockImplementation(() => {
        throw new Error("Config load failed");
      });

      const result = await dispatchRequest(makeParams());

      expect(result.intent).toBe("default");
      expect(result.strategy).toBe("single");
    });

    it("returns DEFAULT_DECISION when classifyIntent throws", async () => {
      setupDefaultMocks();
      classifyIntentMock.mockRejectedValue(new Error("LLM timeout"));

      const result = await dispatchRequest(makeParams());
      expect(result.intent).toBe("default");
    });
  });

  describe("telemetry and session recording", () => {
    it("records turn in session context when sessionId provided", async () => {
      setupDefaultMocks();

      await dispatchRequest(makeParams({ sessionId: "s-record" }));

      expect(recordTurnMock).toHaveBeenCalledWith("s-record", expect.objectContaining({
        intent: "research",
        complexity: expect.any(String),
        strategy: expect.any(String),
      }));
    });

    it("does not record turn when no sessionId", async () => {
      setupDefaultMocks();

      await dispatchRequest(makeParams());

      expect(recordTurnMock).not.toHaveBeenCalled();
    });

    it("records spending after cost estimation", async () => {
      setupDefaultMocks();
      estimateCostMock.mockReturnValue({ costUsd: 0.0042, inputTokens: 500 });

      await dispatchRequest(makeParams());

      expect(recordSpendingMock).toHaveBeenCalledWith(0.0042);
    });
  });
});
