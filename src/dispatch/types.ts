/**
 * Intelligent Dispatch Module — Type definitions.
 *
 * Defines the dispatch config schema, intent definitions, and routing decision types.
 */

import type { OpenClawCNConfig } from "../config/config.js";

// ---------------------------------------------------------------------------
// Dispatch Config Schema
// ---------------------------------------------------------------------------

export type DispatchPatterns = {
  keywords: string[];
  regex: string[];
  semanticTags: string[];
  /** Media types that boost this intent (e.g. "image", "audio", "video", "document"). */
  mediaTypes?: string[];
  /** Keywords that suppress this intent when present (anti-false-positive). */
  excludeKeywords?: string[];
};

export type DispatchRouting = {
  /** Provider/model string (e.g. "anthropic/claude-opus-4-6") or null for default. */
  model: string | null;
  /** Fallback model if primary is unavailable. */
  fallbackModel?: string;
};

export type IntentDefinition = {
  id: string;
  description: string;
  patterns: DispatchPatterns;
  routing: DispatchRouting;
  skills: string[];
  /** MCP tool name patterns. Supports "mcp_server_*" wildcards. */
  mcpTools: string[];
  /** Extra system prompt hint injected when this intent is matched. */
  systemHint?: string;
  /**
   * Tool binding strength for this intent.
   * - "hint": default — reorder skills + mark [推荐] on MCP tools
   * - "strong": inject strong guidance into system prompt
   * - "required": inject mandatory tool-use instruction
   */
  toolBinding?: "hint" | "strong" | "required";
  /**
   * Custom synonym groups for this intent. Each sub-array is a set of
   * semantically equivalent terms that enrich keyword matching.
   * Example: [["快速", "迅速", "rapid", "fast"]]
   */
  synonyms?: string[][];
};

export type ClassifierConfig = {
  /** Model to use for LLM classification (e.g. "anthropic/claude-haiku-3"). */
  model: string;
  maxTokens: number;
  /** System prompt template. Use {{intent_ids}} placeholder for available intent IDs. */
  systemPrompt: string;
};

export type DispatchSettings = {
  enabled: boolean;
  /** Minimum confidence from rule-based matching to skip LLM fallback. Default: 0.7 */
  ruleConfidenceThreshold: number;
  /** Maximum latency budget for dispatch (ms). Default: 3000 */
  timeoutMs: number;
  /** Log dispatch decisions for debugging. */
  debug: boolean;
};

export type DispatchDefaults = {
  model: string | null;
  skills: string[];
  mcpTools: string[];
};

/** Budget configuration for cost-aware routing. */
export type BudgetConfig = {
  /** Maximum cost per single request (USD). If exceeded, downgrade model. */
  maxPerRequestUsd: number;
  /** Maximum hourly spend (USD). If exceeded, block expensive routing. */
  maxHourlyUsd: number;
  /** Maximum daily spend (USD). Soft limit — warns but doesn't block. */
  maxDailyUsd: number;
};

export type DispatchConfig = {
  version: number;
  settings: DispatchSettings;
  classifier: ClassifierConfig;
  intents: IntentDefinition[];
  defaults: DispatchDefaults;
  /** Complexity-based routing configuration. */
  complexity?: ComplexityConfig;
  /** Budget guard configuration. When present, enables cost-aware model downgrade. */
  budget?: BudgetConfig;
};

// ---------------------------------------------------------------------------
// Classification Results
// ---------------------------------------------------------------------------

export type RuleMatchResult = {
  intentId: string;
  confidence: number;
  matchedBy: "keyword" | "regex" | "combined";
  matchDetails: string;
};

// ---------------------------------------------------------------------------
// Complexity Assessment
// ---------------------------------------------------------------------------

/** Task complexity level determined by rule-based or LLM classification. */
export type ComplexityLevel = "low" | "medium" | "high";

/**
 * Execution strategy derived from complexity + intent.
 * - "single": One agent, cheapest model adequate for the task.
 * - "enhanced": One agent, stronger model with deeper thinking.
 * - "multi": Orchestrator agent spawns parallel worker sub-agents.
 */
export type ExecutionStrategy = "single" | "enhanced" | "multi";

/** Result of rule-based complexity assessment. */
export type ComplexitySignal = {
  score: number;
  signals: string[];
  /** True when the rule-based score is decisive (very low or very high). */
  confident: boolean;
};

/** Per-strategy model/resource configuration from dispatch.yaml. */
export type ComplexityStrategyConfig = {
  single?: { model?: string };
  enhanced?: { model?: string };
  multi?: {
    orchestratorModel?: string;
    workerModel?: string;
    maxWorkers?: number;
  };
};

/** Complexity section in dispatch.yaml. */
export type ComplexityConfig = {
  enabled: boolean;
  /** Rule-based score below this triggers LLM assessment. Default: 0.5 */
  ruleConfidenceThreshold: number;
  strategies: ComplexityStrategyConfig;
};

// ---------------------------------------------------------------------------
// Routing Decision (output of the dispatch engine)
// ---------------------------------------------------------------------------

export type RoutingDecision = {
  intent: string;
  confidence: number;
  classifierUsed: "rules" | "llm" | "default";
  modelOverride: { provider: string; model: string } | null;
  skillHints: string[];
  mcpToolHints: string[];
  toolHints?: string[]; // ← 新增：Core tools hints (从 30+ 核心工具中推荐)
  // ── [CN-PATCH:tool-selector] 工具筛选 Gate 结果 ──
  /** 经 tool-selector gate 筛选后的工具 ID 列表（3-8 个）。 */
  filteredToolIds?: string[];
  /** tool-selector gate 给出的筛选理由（调试用）。 */
  toolSelectionReasoning?: string;
  // ── [CN-PATCH:tool-discovery] 智能工具发现扩展字段 ──
  /** 工具摘要 prompt，注入 system prompt 给 LLM 做最终工具选择。 */
  toolSummaryPrompt?: string;
  /** MCP 安装建议详情（来自 tool-discovery 搜索结果）。 */
  mcpSuggestions?: Array<{
    serverId: string;
    friendlyName: string;
    description: string;
    npmPackage?: string;
    sseUrl?: string;
    score: number;
  }>;
  systemHint?: string;
  /** Task complexity level. Defaults to "medium" when complexity assessment is disabled. */
  complexity: ComplexityLevel;
  /** Execution strategy derived from complexity + intent. Defaults to "single". */
  strategy: ExecutionStrategy;
  /** Signals that contributed to the complexity assessment (for debugging). */
  complexitySignals?: string[];
  /** Estimated cost in USD for this request (0 if estimation disabled). */
  estimatedCostUsd?: number;
  /** Telemetry event ID for post-response enrichment. -1 if telemetry disabled. */
  telemetryEventId?: number;
  /** Whether the strategy was degraded due to resource constraints. */
  strategyDegraded?: boolean;
  /** Session context signals (for debugging). */
  sessionSignals?: {
    turnCount: number;
    topicContinuation: boolean;
    complexityTrend: string;
    complexityAdjustment: number;
  };
  /** Tool binding strength for the matched intent (forwarded from config). */
  toolBinding?: "hint" | "strong" | "required";
};

// ---------------------------------------------------------------------------
// Dispatch Engine Params
// ---------------------------------------------------------------------------

export type DispatchRequestParams = {
  prompt: string;
  openclawcnConfig: OpenClawCNConfig;
  agentDir: string;
  workspaceDir: string;
  /** Current available MCP tool names for wildcard resolution. */
  availableMCPTools?: string[];
  /** Media types attached to the message (e.g. "image", "audio", "video", "document"). */
  mediaTypes?: string[];
  /** Session identifier for multi-turn context tracking. */
  sessionId?: string;
  /** Run ID for performance tracking (optional). */
  runId?: string;
  /** AbortSignal for cancelling dispatch when timeout is reached. */
  signal?: AbortSignal;
  /** Signals from proactive memory recall to influence complexity/routing. */
  memorySignals?: {
    /** Complexity of the most relevant prior task found in memory. */
    priorComplexity?: ComplexityLevel;
    /** Intent of the most relevant prior task found in memory. */
    priorIntent?: string;
    /** Relevance score of the memory recall result (0.0–1.0). */
    relevanceScore?: number;
    /** Whether memory indicates cross-session task continuation. */
    crossSessionContinuation?: boolean;
  };
};

export type ClassifyIntentParams = {
  prompt: string;
  config: DispatchConfig;
  openclawcnConfig: OpenClawCNConfig;
  agentDir: string;
  /** AbortSignal for cancelling LLM classification when timeout is reached. */
  signal?: AbortSignal;
};

export type ClassifyIntentResult = {
  intentId: string;
  confidence: number;
  classifierUsed: "rules" | "llm" | "default";
  /** Complexity level from LLM classification (only set when LLM was used). */
  llmComplexity?: ComplexityLevel;
};

// ---------------------------------------------------------------------------
// Internal: compiled config cache
// ---------------------------------------------------------------------------

export type CompiledIntent = IntentDefinition & {
  /** Pre-compiled regex patterns for fast matching. */
  compiledRegex: RegExp[];
  /** Lowercased keywords for matching. */
  lowerKeywords: string[];
  /** Lowercased exclude keywords for false-positive suppression. Empty array when no excludes defined. */
  lowerExcludeKeywords?: string[];
};

export type CompiledDispatchConfig = Omit<DispatchConfig, "intents"> & {
  intents: CompiledIntent[];
};
