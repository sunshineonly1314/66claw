/**
 * [CN-PATCH:memory-key-resolver] Unified provider resolution for memory pipeline.
 *
 * The memory pipeline (extraction, consolidation) makes direct fetch() calls
 * to OpenAI-compatible /chat/completions endpoints. This module resolves:
 *   - API keys (3-tier: models.providers → freeModels.accounts → env vars)
 *   - Base URLs (provider config → hardcoded CN defaults)
 *   - Custom headers (e.g. kimi-coding requires User-Agent)
 *   - OpenAI-compatibility check (rejects providers that don't use /chat/completions)
 *
 * Without the freeModels.accounts bridge, users who configured free models via
 * the setup wizard (which writes to freeModels.accounts, NOT models.providers)
 * would have a completely dead memory system.
 */

import type { OpenClawCNConfig } from "../../config/config.js";
import type { FreeModelsConfig, FreeModelAccount } from "../../config/types.free-models.js";
import { getCustomProviderApiKey, resolveEnvApiKey } from "../../agents/model-auth.js";

// ── Known CN Provider Defaults ──

const KNOWN_BASE_URLS: Record<string, string> = {
  siliconflow: "https://api.siliconflow.cn/v1",
  "ant-ling": "https://api.tbox.cn/api/llm/v1",
  "meituan-longcat": "https://api.longcat.chat/openai/v1",
  modelscope: "https://api-inference.modelscope.cn/v1",
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com/v1",
  moonshot: "https://api.moonshot.cn/v1",
  "kimi-coding": "https://api.kimi.com/coding/v1",
  glm: "https://open.bigmodel.cn/api/paas/v4",
  zhipu: "https://open.bigmodel.cn/api/paas/v4",
  doubao: "https://ark.cn-beijing.volces.com/api/v3",
  "qwen-dashscope": "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "tencent-hunyuan": "https://api.hunyuan.cloud.tencent.com/v1",
  groq: "https://api.groq.com/openai/v1",
  together: "https://api.together.xyz/v1",
};

/** Providers with required custom headers for the memory pipeline's direct fetch(). */
const PROVIDER_HEADERS: Record<string, Record<string, string>> = {
  "kimi-coding": { "User-Agent": "KimiCLI/1.16.0" },
};

/**
 * Providers whose API is NOT OpenAI-compatible (/chat/completions).
 * The memory pipeline sends raw fetch() to /chat/completions — these providers
 * use different wire formats (Anthropic Messages, Ollama, Bedrock, etc.)
 * and MUST NOT be used as extraction/consolidation targets.
 */
const NON_OPENAI_COMPATIBLE_PROVIDERS = new Set([
  "anthropic",
  "minimax",
  "minimax-portal",
  "ollama",
  "amazon-bedrock",
  "synthetic",
  // xiaomi uses anthropic-messages format
  "xiaomi",
  // cloudflare-ai-gateway uses anthropic-messages when proxying Anthropic
  "cloudflare-ai-gateway",
  // Google uses its own Generative AI / Vertex AI wire format
  "google",
  "google-vertex",
]);

// ── API Key Resolution ──

/**
 * Resolve an API key for a memory pipeline provider from all available sources.
 *
 * Resolution order:
 *   1. models.providers[provider].apiKey (explicit config)
 *   2. freeModels.accounts (setup wizard free model accounts)
 *   3. Environment variable (e.g. ANT_LING_API_KEY)
 *
 * Returns null if no key is found from any source.
 */
export function resolveMemoryProviderApiKey(
  cfg: OpenClawCNConfig | undefined,
  provider: string,
  opts?: { skipEnvVar?: boolean },
): string | null {
  // 1. Explicit provider config (models.providers["ant-ling"].apiKey)
  const customKey = getCustomProviderApiKey(cfg, provider);
  if (customKey) return customKey;

  // 2. Free model accounts (freeModels.accounts[].apiKey)
  const freeModelKey = getFreeModelAccountApiKey(cfg, provider);
  if (freeModelKey) return freeModelKey;

  // 3. Environment variable (ANT_LING_API_KEY, LONGCAT_API_KEY, etc.)
  // [CN-PATCH] skipEnvVar: UI status check should only show explicitly configured providers,
  // not providers that happen to have an env var set for other purposes.
  if (!opts?.skipEnvVar) {
    const envResult = resolveEnvApiKey(provider);
    if (envResult?.apiKey) return envResult.apiKey;
  }

  return null;
}

// ── Base URL Resolution ──

/**
 * Resolve the OpenAI-compatible base URL for a provider.
 * Checks config first, falls back to known defaults.
 */
export function resolveMemoryProviderBaseUrl(
  cfg: OpenClawCNConfig | undefined,
  provider: string,
): string {
  // Check config provider entry for custom baseUrl/apiEndpoint
  const providers = cfg?.models?.providers ?? {};
  const entry = providers[provider];
  if (entry && typeof entry === "object") {
    const ep =
      (entry as Record<string, unknown>).apiEndpoint ?? (entry as Record<string, unknown>).baseUrl;
    if (typeof ep === "string" && ep.trim()) return ep.trim();
  }
  // Normalize to lowercase for map lookup — provider IDs may have mixed casing
  // from config, but KNOWN_BASE_URLS keys are all lowercase.
  const normalized = provider.toLowerCase();
  // SAFETY: Do NOT fall back to api.openai.com for unknown providers.
  // That would send a third-party provider's API key to OpenAI, leaking credentials.
  return KNOWN_BASE_URLS[normalized] ?? "";
}

// ── Custom Headers ──

/**
 * Get required custom headers for a provider's memory pipeline calls.
 * E.g. kimi-coding requires User-Agent: KimiCLI/1.16.0.
 */
export function resolveMemoryProviderHeaders(provider: string): Record<string, string> {
  return PROVIDER_HEADERS[provider] ?? PROVIDER_HEADERS[provider.toLowerCase()] ?? {};
}

// ── OpenAI Compatibility Check ──

/**
 * Check if a provider uses the OpenAI-compatible /chat/completions wire format.
 * The memory pipeline sends raw fetch() to this endpoint, so providers with
 * different APIs (Anthropic Messages, Ollama, Bedrock) cannot be used.
 */
export function isOpenAICompatibleProvider(provider: string): boolean {
  return !NON_OPENAI_COMPATIBLE_PROVIDERS.has(provider.toLowerCase());
}

// ── Internal ──

/**
 * Look up an API key from freeModels.accounts by providerId.
 * Only returns keys from enabled, active accounts with non-empty apiKey.
 */
function getFreeModelAccountApiKey(
  cfg: OpenClawCNConfig | undefined,
  provider: string,
): string | null {
  if (!cfg) return null;

  const freeModels = (cfg as { freeModels?: FreeModelsConfig }).freeModels;
  if (!freeModels?.enabled || !freeModels.accounts) return null;

  // Find matching account that is enabled and active
  const account = freeModels.accounts.find(
    (a: FreeModelAccount) =>
      a.providerId === provider && a.enabled && a.status === "active" && a.apiKey?.trim(),
  );

  return account?.apiKey?.trim() ?? null;
}
