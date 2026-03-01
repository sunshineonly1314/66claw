const KNOWN_ELIGIBLE_MODELS = {
  // ── DeepSeek ──
  "deepseek-chat": { contextWindow: 64e3, tier: "cheap" },
  // $1.37/1M
  "deepseek-reasoner": { contextWindow: 64e3, tier: "mid" },
  // $2.74/1M
  "deepseek-coder": { contextWindow: 64e3, tier: "cheap" },
  // ── OpenAI ──
  "gpt-4o": { contextWindow: 128e3, tier: "mid" },
  // $12.5/1M
  "gpt-4o-2024-11-20": { contextWindow: 128e3, tier: "mid" },
  "gpt-4-turbo": { contextWindow: 128e3, tier: "sota" },
  // $40/1M
  "o1": { contextWindow: 2e5, tier: "sota" },
  // $75/1M
  "o1-preview": { contextWindow: 128e3, tier: "sota" },
  "o3": { contextWindow: 2e5, tier: "sota" },
  // $50/1M
  "o3-mini": { contextWindow: 2e5, tier: "mid" },
  // $5.5/1M
  // ── Anthropic ──
  "claude-3-5-sonnet-20241022": { contextWindow: 2e5, tier: "mid" },
  // $18/1M
  "claude-sonnet-4-5": { contextWindow: 2e5, tier: "mid" },
  // $18/1M
  "claude-sonnet-4-20250514": { contextWindow: 2e5, tier: "mid" },
  "claude-3-opus-20240229": { contextWindow: 2e5, tier: "sota" },
  // $90/1M
  "claude-opus-4-20250514": { contextWindow: 2e5, tier: "sota" },
  "claude-opus-4-6": { contextWindow: 2e5, tier: "sota" },
  // ── Qwen ──
  "qwen-max": { contextWindow: 32e3, tier: "mid" },
  // $8/1M
  "qwen-plus": { contextWindow: 131072, tier: "cheap" },
  // $1.6/1M
  "qwen-turbo": { contextWindow: 131072, tier: "cheap" },
  // $0.4/1M
  "qwen-coder-plus": { contextWindow: 131072, tier: "mid" },
  "qwen-long": { contextWindow: 1e6, tier: "cheap" },
  // ── Doubao (ByteDance) ──
  "doubao-seed-1-8-251228": { contextWindow: 256e3, tier: "mid" },
  "doubao-seed-1-6-251015": { contextWindow: 256e3, tier: "mid" },
  "doubao-seed-1-6-lite-251015": { contextWindow: 256e3, tier: "cheap" },
  // ── GLM (Zhipu) ──
  "glm-5": { contextWindow: 128e3, tier: "mid" },
  "glm-5-code": { contextWindow: 128e3, tier: "mid" },
  "glm-4-plus": { contextWindow: 128e3, tier: "cheap" },
  // $1.4/1M
  "glm-4-long": { contextWindow: 1e6, tier: "cheap" },
  "glm-4.7": { contextWindow: 128e3, tier: "mid" },
  "glm-4.5": { contextWindow: 128e3, tier: "mid" },
  // ── Moonshot / Kimi ──
  "moonshot-v1-128k": { contextWindow: 128e3, tier: "mid" },
  // $16.8/1M
  "kimi-for-coding": { contextWindow: 262144, tier: "mid" },
  // ── MiniMax ──
  "minimax-m2.5": { contextWindow: 2e5, tier: "mid" },
  "minimax-m2.1": { contextWindow: 2e5, tier: "mid" },
  // ── SiliconFlow ──
  "deepseek-ai/deepseek-v3": { contextWindow: 65536, tier: "mid" },
  // ── Qianfan ──
  "ernie-5.0-thinking-preview": { contextWindow: 119e3, tier: "mid" }
};
const MIN_CONTEXT_WINDOW = 8e3;
const WARN_CONTEXT_WINDOW = 32e3;
const SUGGESTED_MODELS = [
  "deepseek-reasoner (DeepSeek, 64K context, mid tier)",
  "claude-sonnet-4-5 (Anthropic, 200K context, mid tier)",
  "gpt-4o (OpenAI, 128K context, mid tier)",
  "doubao-seed-1-8-251228 (Doubao, 256K context, mid tier)",
  "kimi-for-coding (Kimi, 262K context, mid tier)",
  "glm-5 (Zhipu, 128K context, mid tier)"
];
function checkModelEligibility(modelId, runtimeInfo) {
  const normalizedId = modelId.toLowerCase().trim();
  let contextWindow = runtimeInfo?.contextWindow;
  let tier = runtimeInfo?.tier;
  if (contextWindow === void 0 || tier === void 0) {
    const known = findKnownModel(normalizedId);
    if (known) {
      contextWindow ??= known.contextWindow;
      tier ??= known.tier;
    }
  }
  if (contextWindow === void 0) {
    return {
      eligible: true,
      modelId,
      reason: `Unknown model "${modelId}". Cannot verify context window. Proceeding with caution \u2014 orchestration quality may vary.`,
      suggestions: SUGGESTED_MODELS
    };
  }
  if (contextWindow < MIN_CONTEXT_WINDOW) {
    return {
      eligible: false,
      modelId,
      contextWindow,
      tier,
      reason: `Model "${modelId}" has ${formatTokens(contextWindow)} context window. Agent orchestration requires at least ${formatTokens(MIN_CONTEXT_WINDOW)}. The orchestrator needs to parse requirements and generate agent blueprints.`,
      suggestions: SUGGESTED_MODELS
    };
  }
  if (contextWindow < WARN_CONTEXT_WINDOW) {
    return {
      eligible: true,
      modelId,
      contextWindow,
      tier,
      reason: `Model "${modelId}" has ${formatTokens(contextWindow)} context window. Orchestration works best with 32K+ context. Complex plans with many agents may be truncated.`,
      suggestions: SUGGESTED_MODELS
    };
  }
  if (tier === "cheap") {
    return {
      eligible: false,
      modelId,
      contextWindow,
      tier,
      reason: `Model "${modelId}" is classified as "cheap" tier. Agent orchestration requires strong reasoning ability to plan effectively. Cheap-tier models produce unreliable plans and low-quality SOUL.md files.`,
      suggestions: SUGGESTED_MODELS
    };
  }
  if (tier === "mid") {
    return {
      eligible: true,
      modelId,
      contextWindow,
      tier,
      reason: `Model "${modelId}" is "mid" tier \u2014 usable but not optimal. SOTA-tier models produce significantly better orchestration plans. Consider upgrading for complex multi-agent scenarios.`
    };
  }
  return {
    eligible: true,
    modelId,
    contextWindow,
    tier
  };
}
const KNOWN_MODEL_KEYS = Object.keys(KNOWN_ELIGIBLE_MODELS).sort((a, b) => b.length - a.length);
function findKnownModel(normalizedId) {
  if (KNOWN_ELIGIBLE_MODELS[normalizedId]) {
    return KNOWN_ELIGIBLE_MODELS[normalizedId];
  }
  for (const key of KNOWN_MODEL_KEYS) {
    if (normalizedId.startsWith(key)) {
      return KNOWN_ELIGIBLE_MODELS[key];
    }
  }
  return void 0;
}
function formatTokens(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
export {
  checkModelEligibility
};
