/**
 * Model Tier Selector — auto-selects the best model at each quality tier
 * from the user's configured providers.
 *
 * Tiers:
 *   - "sota"  : Best reasoning/quality. For complex coding, analysis, planning.
 *   - "mid"   : Good balance of quality and cost. For general conversation, summaries.
 *   - "cheap" : Fastest and cheapest. For classification, extraction, simple tasks.
 *
 * The selector scans all providers the user has set up (via config, env vars,
 * or auth profiles), ranks every model by cost, and groups them into tiers.
 * Fully automatic — zero user configuration needed.
 *
 * Used by:
 *   - Memory extractor: picks "cheap" tier for fact extraction
 *   - Dispatch engine: can use tier selection for complexity-based routing
 *   - Any subsystem that needs a quick LLM call without using the session model
 */

import type { ClawdbotConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("dispatch");

// ── Types ────────────────────────────────────────────────────────────

export type ModelTier = "sota" | "mid" | "cheap";

export type TierSelection = {
  provider: string;
  modelId: string;
  /** Total cost per 1M tokens (input + output). */
  totalCostPer1M: number;
  tier: ModelTier;
};

export type TierSelectionResult = {
  selection: TierSelection | null;
  /** All available models grouped by tier (for debugging). */
  tiers: Record<ModelTier, TierSelection[]>;
};

// ── Cost thresholds for tier boundaries (USD per 1M tokens, input+output) ──

/**
 * Tier boundaries based on total cost (input + output per 1M tokens):
 *   cheap : totalCost <= 2.0    (e.g. glm-4-flash $0, qwen-turbo $0.4, gpt-4o-mini $0.75)
 *   mid   : 2.0 < totalCost <= 20.0  (e.g. deepseek-chat $1.37, gpt-4o $12.5, claude-sonnet $18)
 *   sota  : totalCost > 20.0   (e.g. claude-opus $90, o1 $75, gpt-4-turbo $40)
 */
const TIER_CHEAP_MAX = 2.0;
const TIER_MID_MAX = 20.0;

// ── Known model quality scores (higher = better reasoning capability) ──
// Used to break ties within the same tier — prefer models with better quality.

const MODEL_QUALITY: Record<string, number> = {
  // SOTA tier
  "claude-opus-4-5": 100,
  o1: 95,
  "deepseek-reasoner": 90,
  "gpt-4-turbo": 85,

  // Mid tier
  "claude-sonnet-4-5": 80,
  "claude-sonnet-3.5": 78,
  "gpt-4o": 75,
  "qwen-max": 70,
  "moonshot-v1-128k": 65,
  "claude-haiku-3.5": 60,
  "o3-mini": 58,
  "o1-mini": 55,

  // Cheap tier
  "deepseek-chat": 50,
  "qwen-plus": 48,
  "glm-4-plus": 45,
  "moonshot-v1-8k": 42,
  "gpt-4o-mini": 40,
  "claude-haiku-3": 38,
  "qwen-turbo": 35,
  "glm-4-flash": 30,
};

/**
 * Get quality score for a model. Uses fuzzy matching (partial model name).
 * Returns 25 (low default) for unknown models.
 */
function getModelQuality(modelId: string): number {
  // Exact match
  if (MODEL_QUALITY[modelId] !== undefined) return MODEL_QUALITY[modelId]!;

  // Partial match (e.g., "claude-sonnet-4-5-20250929" matches "claude-sonnet-4-5")
  const modelLower = modelId.toLowerCase();
  const sortedKeys = Object.keys(MODEL_QUALITY).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (modelLower.includes(key)) return MODEL_QUALITY[key]!;
  }

  return 25; // Unknown model — assume low quality
}

/**
 * Classify a model into a tier based on its total cost.
 */
function classifyTier(totalCostPer1M: number): ModelTier {
  if (totalCostPer1M <= TIER_CHEAP_MAX) return "cheap";
  if (totalCostPer1M <= TIER_MID_MAX) return "mid";
  return "sota";
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Scan all available providers and group models by tier.
 *
 * This is the core function. It:
 *   1. Gets all merged providers (explicit config + env vars + auth profiles)
 *   2. Extracts every model with its cost
 *   3. Groups into tiers based on cost thresholds
 *   4. Sorts within each tier by quality (best first)
 *
 * Returns all tiers so callers can pick from any tier.
 */
export async function buildModelTiers(params: {
  cfg: ClawdbotConfig;
  agentDir: string;
}): Promise<Record<ModelTier, TierSelection[]>> {
  const { cfg, agentDir } = params;

  // Dynamically import to avoid circular deps
  const { getMergedProvidersForAgent } = await import("../agents/models-config.js");

  const mergedProviders = await getMergedProvidersForAgent(cfg, agentDir);

  const allModels: TierSelection[] = [];

  for (const [providerKey, providerCfg] of Object.entries(mergedProviders)) {
    const models = (
      providerCfg as { models?: Array<{ id: string; cost?: { input: number; output: number } }> }
    ).models;
    if (!Array.isArray(models)) continue;

    for (const model of models) {
      const cost = model.cost;
      if (!cost) continue;

      const totalCost = cost.input + cost.output;
      allModels.push({
        provider: providerKey,
        modelId: model.id,
        totalCostPer1M: totalCost,
        tier: classifyTier(totalCost),
      });
    }
  }

  // Group by tier
  const tiers: Record<ModelTier, TierSelection[]> = {
    sota: [],
    mid: [],
    cheap: [],
  };

  for (const model of allModels) {
    tiers[model.tier].push(model);
  }

  // Sort within each tier: by quality descending (best reasoning first)
  for (const tier of Object.values(tiers)) {
    tier.sort((a, b) => getModelQuality(b.modelId) - getModelQuality(a.modelId));
  }

  return tiers;
}

/**
 * Select the best available model at the requested tier.
 *
 * Behavior:
 *   - Picks the highest-quality model in the requested tier
 *   - Verifies the model has a valid API key
 *   - If no model in the tier has a key, falls through to adjacent tiers:
 *       "cheap" → try "mid" → try "sota"
 *       "mid"   → try "cheap" → try "sota"
 *       "sota"  → try "mid" → try "cheap"
 *
 * This ensures users always get a result if they have ANY model configured.
 */
export async function selectModelByTier(params: {
  tier: ModelTier;
  cfg: ClawdbotConfig;
  agentDir: string;
}): Promise<TierSelectionResult> {
  const { tier, cfg, agentDir } = params;

  const tiers = await buildModelTiers({ cfg, agentDir });

  // Dynamically import model resolution
  const { resolveModel } = await import("../agents/pi-embedded-runner/model.js");
  const { getApiKeyForModel } = await import("../agents/model-auth.js");

  const cfgForModel = await buildCfgForModel(cfg, agentDir);

  // Define fallback order for each tier
  const fallbackOrder: Record<ModelTier, ModelTier[]> = {
    cheap: ["cheap", "mid", "sota"],
    mid: ["mid", "cheap", "sota"],
    sota: ["sota", "mid", "cheap"],
  };

  // Try each tier in fallback order
  for (const tryTier of fallbackOrder[tier]) {
    const candidates = tiers[tryTier];
    if (!candidates || candidates.length === 0) continue;

    for (const candidate of candidates) {
      // Verify model can be resolved
      const resolved = resolveModel(candidate.provider, candidate.modelId, agentDir, cfgForModel);
      if (!resolved.model) continue;

      // Verify API key exists
      try {
        const authInfo = await getApiKeyForModel({ model: resolved.model, cfg: cfgForModel });
        const key = authInfo.apiKey?.trim();
        if (!key) continue;

        log.debug(
          `tier-selector: selected ${candidate.provider}/${candidate.modelId} ` +
            `(tier=${candidate.tier}, requested=${tier}, cost=$${candidate.totalCostPer1M.toFixed(2)}/1M)`,
        );

        return {
          selection: candidate,
          tiers,
        };
      } catch {
        // No API key — skip
      }
    }
  }

  log.debug(`tier-selector: no models available for tier "${tier}" or any fallback`);
  return { selection: null, tiers };
}

/**
 * Quick helper: select and resolve a model ready for completeSimple() call.
 * Returns null if no model is available.
 */
export async function resolveModelForTier(params: {
  tier: ModelTier;
  cfg: ClawdbotConfig;
  agentDir: string;
}): Promise<{
  provider: string;
  modelId: string;
  model: import("@mariozechner/pi-ai").Model<import("@mariozechner/pi-ai").Api>;
  apiKey: string;
  tier: ModelTier;
  costPer1M: number;
} | null> {
  const { tier, cfg, agentDir } = params;

  const { selection } = await selectModelByTier({ tier, cfg, agentDir });
  if (!selection) return null;

  const { resolveModel } = await import("../agents/pi-embedded-runner/model.js");
  const { getApiKeyForModel, requireApiKey } = await import("../agents/model-auth.js");

  const cfgForModel = await buildCfgForModel(cfg, agentDir);
  const resolved = resolveModel(selection.provider, selection.modelId, agentDir, cfgForModel);
  if (!resolved.model) return null;

  try {
    const apiKey = requireApiKey(
      await getApiKeyForModel({ model: resolved.model, cfg: cfgForModel }),
      selection.provider,
    );

    return {
      provider: selection.provider,
      modelId: selection.modelId,
      model: resolved.model,
      apiKey,
      tier: selection.tier,
      costPer1M: selection.totalCostPer1M,
    };
  } catch {
    return null;
  }
}

// ── Internal helpers ─────────────────────────────────────────────────

async function buildCfgForModel(cfg: ClawdbotConfig, agentDir: string): Promise<ClawdbotConfig> {
  const { getMergedProvidersForAgent } = await import("../agents/models-config.js");
  const mergedProviders = await getMergedProvidersForAgent(cfg, agentDir);
  return Object.keys(mergedProviders).length > 0
    ? { ...cfg, models: { ...cfg?.models, providers: mergedProviders } }
    : cfg;
}
