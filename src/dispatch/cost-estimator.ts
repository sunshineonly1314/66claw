/**
 * Cost Estimator — token estimation + model pricing + budget-aware routing.
 *
 * Layer 12: Estimates the cost of a request BEFORE execution, enabling:
 *  - Budget guards: reject or downgrade if estimated cost exceeds threshold
 *  - Smart routing: choose the cheapest model that meets quality requirements
 *  - Cost tracking: log estimated vs actual for continuous calibration
 *
 * Token estimation uses a fast heuristic (no tokenizer dependency):
 *  - English: ~4 chars per token (GPT/Claude average)
 *  - CJK: ~1.5 chars per token (CJK characters are typically 1-2 tokens each)
 *  - Mixed: weighted average based on CJK ratio
 *
 * Pricing data is updated manually but structured for easy maintenance.
 */

import type { BudgetConfig, ComplexityLevel, ExecutionStrategy } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-model pricing (USD per 1M tokens). */
export type ModelPricing = {
  inputPer1M: number;
  outputPer1M: number;
  /** Cached/prompt-cached input discount (fraction, e.g. 0.1 = 90% cheaper). */
  cachedInputPer1M?: number;
};

/** Cost estimate for a single request. */
export type CostEstimate = {
  /** Estimated input tokens. */
  inputTokens: number;
  /** Estimated output tokens (based on complexity heuristic). */
  outputTokens: number;
  /** Estimated cost in USD. */
  costUsd: number;
  /** Model used for pricing. */
  model: string;
  /** Whether prompt caching discount was applied. */
  cachedInput: boolean;
};

/** Budget check result. */
export type BudgetCheckResult = {
  allowed: boolean;
  /** Reason if not allowed. */
  reason?: string;
  /** Suggested downgrade model if over budget. */
  suggestedModel?: string;
  /** Current spending in the relevant window. */
  currentSpend: number;
  /** Budget limit that was checked. */
  budgetLimit: number;
};

// ---------------------------------------------------------------------------
// Model Pricing Table (USD per 1M tokens, as of 2025)
// ---------------------------------------------------------------------------

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  "claude-opus-4-6": { inputPer1M: 15.0, outputPer1M: 75.0, cachedInputPer1M: 1.5 },
  "claude-opus-4-5": { inputPer1M: 15.0, outputPer1M: 75.0, cachedInputPer1M: 1.5 },
  "claude-sonnet-4-5": { inputPer1M: 3.0, outputPer1M: 15.0, cachedInputPer1M: 0.3 },
  "claude-haiku-4-5": { inputPer1M: 0.8, outputPer1M: 4.0, cachedInputPer1M: 0.08 },
  "claude-haiku-3": { inputPer1M: 0.25, outputPer1M: 1.25, cachedInputPer1M: 0.03 },
  "claude-haiku-3.5": { inputPer1M: 0.8, outputPer1M: 4.0, cachedInputPer1M: 0.08 },
  "claude-sonnet-3.5": { inputPer1M: 3.0, outputPer1M: 15.0, cachedInputPer1M: 0.3 },

  // OpenAI
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0, cachedInputPer1M: 1.25 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6, cachedInputPer1M: 0.075 },
  "gpt-4-turbo": { inputPer1M: 10.0, outputPer1M: 30.0 },
  "gpt-4.5-preview": { inputPer1M: 75.0, outputPer1M: 150.0, cachedInputPer1M: 37.5 },
  o1: { inputPer1M: 15.0, outputPer1M: 60.0, cachedInputPer1M: 7.5 },
  "o1-mini": { inputPer1M: 3.0, outputPer1M: 12.0, cachedInputPer1M: 1.5 },
  o3: { inputPer1M: 10.0, outputPer1M: 40.0, cachedInputPer1M: 2.5 },
  "o3-mini": { inputPer1M: 1.1, outputPer1M: 4.4, cachedInputPer1M: 0.55 },
  "o4-mini": { inputPer1M: 1.1, outputPer1M: 4.4, cachedInputPer1M: 0.55 },

  // DeepSeek
  "deepseek-chat": { inputPer1M: 0.27, outputPer1M: 1.1, cachedInputPer1M: 0.07 },
  "deepseek-reasoner": { inputPer1M: 0.55, outputPer1M: 2.19, cachedInputPer1M: 0.14 },

  // Qwen
  "qwen-max": { inputPer1M: 1.6, outputPer1M: 6.4 },
  "qwen-plus": { inputPer1M: 0.4, outputPer1M: 1.2 },
  "qwen-turbo": { inputPer1M: 0.1, outputPer1M: 0.3 },

  // GLM
  "glm-4-plus": { inputPer1M: 0.7, outputPer1M: 0.7 },
  "glm-4-flash": { inputPer1M: 0.0, outputPer1M: 0.0 }, // free tier

  // Moonshot
  "moonshot-v1-128k": { inputPer1M: 8.4, outputPer1M: 8.4 },
  "moonshot-v1-8k": { inputPer1M: 1.4, outputPer1M: 1.4 },
};

// Fallback pricing when model not found
const DEFAULT_PRICING: ModelPricing = {
  inputPer1M: 3.0,
  outputPer1M: 15.0,
};

// ---------------------------------------------------------------------------
// CJK detection
// ---------------------------------------------------------------------------

// Note: `g` flag is required here — String.match(re) with `g` returns ALL matches
// for counting CJK characters. Do NOT use .test() on this regex (stateful with `g`).
const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;

// ---------------------------------------------------------------------------
// Token Estimation
// ---------------------------------------------------------------------------

/**
 * Estimate token count from text length using character-based heuristics.
 *
 * Accuracy: ~±20% for most models. Good enough for cost estimation.
 * For exact counts, use a proper tokenizer (tiktoken/claude-tokenizer).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  const totalChars = text.length;

  // Count CJK characters
  const cjkMatches = text.match(CJK_RE);
  const cjkChars = cjkMatches ? cjkMatches.length : 0;
  const nonCjkChars = totalChars - cjkChars;

  // CJK: ~1.5 chars per token (each CJK char is typically 1-2 tokens)
  // Non-CJK: ~4 chars per token (English average for GPT/Claude models)
  const cjkTokens = cjkChars / 1.5;
  const nonCjkTokens = nonCjkChars / 4;

  return Math.ceil(cjkTokens + nonCjkTokens);
}

/**
 * Estimate output tokens based on complexity and strategy.
 *
 * Heuristic based on observed patterns:
 *  - simple query → ~200 tokens output
 *  - medium task → ~800 tokens output
 *  - complex task → ~2000 tokens output
 *  - multi-agent → 3x multiplier (orchestrator + workers)
 */
export function estimateOutputTokens(
  complexity: ComplexityLevel,
  strategy: ExecutionStrategy,
): number {
  const baseOutput: Record<ComplexityLevel, number> = {
    low: 200,
    medium: 800,
    high: 2000,
  };

  let tokens = baseOutput[complexity];

  // Multi-agent strategy multiplies output (orchestrator + N workers)
  if (strategy === "multi") {
    tokens *= 3;
  } else if (strategy === "enhanced") {
    tokens *= 1.5;
  }

  return Math.ceil(tokens);
}

// ---------------------------------------------------------------------------
// Cost Estimation
// ---------------------------------------------------------------------------

/**
 * Look up pricing for a model. Handles partial model name matching.
 */
export function getModelPricing(model: string): ModelPricing {
  // Exact match
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];

  // Partial match: the input model name contains a known key.
  // e.g., "claude-sonnet-4-5-20250929" contains "claude-sonnet-4-5" → match.
  // Sort keys by length descending so longer (more specific) keys match first,
  // preventing "o1" from matching before "o1-mini".
  const modelLower = model.toLowerCase();
  const sortedKeys = Object.keys(MODEL_PRICING).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (modelLower.includes(key)) {
      return MODEL_PRICING[key];
    }
  }

  return DEFAULT_PRICING;
}

/**
 * Estimate the cost of a request.
 */
export function estimateCost(params: {
  prompt: string;
  model: string;
  complexity: ComplexityLevel;
  strategy: ExecutionStrategy;
  cachedInput?: boolean;
  /** Additional system prompt tokens (overhead). */
  systemPromptTokens?: number;
}): CostEstimate {
  const inputTokens = estimateTokens(params.prompt) + (params.systemPromptTokens ?? 500);
  const outputTokens = estimateOutputTokens(params.complexity, params.strategy);
  const pricing = getModelPricing(params.model);

  const inputRate =
    params.cachedInput && pricing.cachedInputPer1M ? pricing.cachedInputPer1M : pricing.inputPer1M;

  const costUsd =
    (inputTokens * inputRate) / 1_000_000 + (outputTokens * pricing.outputPer1M) / 1_000_000;

  return {
    inputTokens,
    outputTokens,
    costUsd: Math.max(0, Math.round(costUsd * 1_000_000) / 1_000_000), // 6 decimal places, non-negative
    model: params.model,
    cachedInput: params.cachedInput ?? false,
  };
}

// ---------------------------------------------------------------------------
// Budget Guard
// ---------------------------------------------------------------------------

/** Spending tracker — accumulates per-hour and per-day. */
let spendingLog: Array<{ timestamp: number; costUsd: number }> = [];

/**
 * Record actual spending for budget tracking.
 */
export function recordSpending(costUsd: number): void {
  spendingLog.push({ timestamp: Date.now(), costUsd });
  // Trim entries older than 24h
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  spendingLog = spendingLog.filter((e) => e.timestamp >= cutoff);
}

/**
 * Get total spending in a time window.
 */
export function getSpending(windowMs: number): number {
  const cutoff = Date.now() - windowMs;
  return spendingLog.filter((e) => e.timestamp >= cutoff).reduce((sum, e) => sum + e.costUsd, 0);
}

/**
 * Check if a request is within budget.
 * Returns allowed=true if OK, or suggests a cheaper alternative.
 */
export function checkBudget(estimatedCost: CostEstimate, budget: BudgetConfig): BudgetCheckResult {
  // Check per-request limit
  if (estimatedCost.costUsd > budget.maxPerRequestUsd) {
    return {
      allowed: false,
      reason: `Estimated cost $${estimatedCost.costUsd.toFixed(4)} exceeds per-request limit $${budget.maxPerRequestUsd.toFixed(4)}`,
      suggestedModel: findCheaperModel(estimatedCost.model, estimatedCost.inputTokens),
      currentSpend: estimatedCost.costUsd,
      budgetLimit: budget.maxPerRequestUsd,
    };
  }

  // Check hourly limit
  const hourlySpend = getSpending(60 * 60 * 1000);
  if (hourlySpend + estimatedCost.costUsd > budget.maxHourlyUsd) {
    return {
      allowed: false,
      reason: `Hourly spend $${(hourlySpend + estimatedCost.costUsd).toFixed(4)} would exceed limit $${budget.maxHourlyUsd.toFixed(4)}`,
      suggestedModel: findCheaperModel(estimatedCost.model, estimatedCost.inputTokens),
      currentSpend: hourlySpend,
      budgetLimit: budget.maxHourlyUsd,
    };
  }

  // Check daily limit (soft — warn only)
  const dailySpend = getSpending(24 * 60 * 60 * 1000);
  if (dailySpend + estimatedCost.costUsd > budget.maxDailyUsd) {
    // Soft limit — allow but log warning
    console.warn(
      `[dispatch] Daily spend warning: $${(dailySpend + estimatedCost.costUsd).toFixed(4)} ` +
        `approaching limit $${budget.maxDailyUsd.toFixed(4)}`,
    );
  }

  return {
    allowed: true,
    currentSpend: hourlySpend,
    budgetLimit: budget.maxHourlyUsd,
  };
}

/**
 * Find a cheaper model alternative, preferring the same provider family.
 * Uses price as a rough proxy for capability (most expensive cheap model first).
 */
function findCheaperModel(currentModel: string, inputTokens: number): string | undefined {
  const currentPricing = getModelPricing(currentModel);

  // Detect provider prefix for affinity (e.g. "claude-" for Anthropic, "gpt-" for OpenAI)
  const providerPrefix = detectProviderPrefix(currentModel);

  const cheaper = Object.entries(MODEL_PRICING)
    .filter(([_, p]) => p.inputPer1M < currentPricing.inputPer1M)
    // Penalize cross-provider models by sorting same-provider first
    .sort((a, b) => {
      const aLocal = providerPrefix && a[0].startsWith(providerPrefix) ? 1 : 0;
      const bLocal = providerPrefix && b[0].startsWith(providerPrefix) ? 1 : 0;
      if (aLocal !== bLocal) return bLocal - aLocal; // same provider first
      return b[1].inputPer1M - a[1].inputPer1M; // then by price descending (capability proxy)
    });

  // If inputTokens hint is available, prefer models likely to handle the context
  // (skip ultra-cheap models for very long prompts)
  if (inputTokens > 50_000 && cheaper.length > 1) {
    // For long contexts, prefer mid-range models over the cheapest
    const midRange = cheaper.find(([_, p]) => p.inputPer1M >= 0.2);
    if (midRange) return midRange[0];
  }

  if (cheaper.length > 0) {
    return cheaper[0][0];
  }
  return undefined;
}

/** Detect model name prefix for provider affinity grouping. */
function detectProviderPrefix(model: string): string | null {
  if (model.startsWith("claude-")) return "claude-";
  if (model.startsWith("gpt-")) return "gpt-";
  if (model.startsWith("o1") || model.startsWith("o3") || model.startsWith("o4")) return "o";
  if (model.startsWith("deepseek-")) return "deepseek-";
  if (model.startsWith("qwen-")) return "qwen-";
  if (model.startsWith("glm-")) return "glm-";
  if (model.startsWith("moonshot-")) return "moonshot-";
  return null;
}

/**
 * Suggest the optimal model for a given complexity level and budget.
 * Returns the most capable model within budget constraints.
 */
export function suggestModel(params: {
  complexity: ComplexityLevel;
  strategy: ExecutionStrategy;
  inputTokens: number;
  maxCostUsd: number;
}): string | null {
  // Model tiers by quality (best first)
  const tiersByComplexity: Record<ComplexityLevel, string[]> = {
    high: [
      "claude-opus-4-6",
      "claude-opus-4-5",
      "o1",
      "o3",
      "claude-sonnet-4-5",
      "gpt-4o",
      "deepseek-reasoner",
      "qwen-max",
    ],
    medium: [
      "claude-sonnet-4-5",
      "gpt-4o",
      "deepseek-chat",
      "qwen-plus",
      "claude-haiku-4-5",
      "claude-haiku-3.5",
      "gpt-4o-mini",
    ],
    low: ["claude-haiku-3", "gpt-4o-mini", "o4-mini", "qwen-turbo", "deepseek-chat", "glm-4-flash"],
  };

  const candidates = tiersByComplexity[params.complexity];
  const outputTokens = estimateOutputTokens(params.complexity, params.strategy);

  for (const model of candidates) {
    const pricing = MODEL_PRICING[model];
    if (!pricing) continue;

    const cost =
      (params.inputTokens * pricing.inputPer1M) / 1_000_000 +
      (outputTokens * pricing.outputPer1M) / 1_000_000;

    if (cost <= params.maxCostUsd) {
      return model;
    }
  }

  return null;
}

/**
 * Clear spending log. For testing.
 */
export function clearSpendingLog(): void {
  spendingLog = [];
}
