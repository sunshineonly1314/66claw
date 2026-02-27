import { type Api, getEnvApiKey, type Model } from "@mariozechner/pi-ai";
import path from "node:path";
import type { OpenClawCNConfig } from "../config/config.js";
import type { ModelProviderAuthMode, ModelProviderConfig } from "../config/types.js";
import { formatCliCommand } from "../cli/command-format.js";
import { getShellEnvAppliedKeys } from "../infra/shell-env.js";
import {
  normalizeOptionalSecretInput,
  normalizeSecretInput,
} from "../utils/normalize-secret-input.js";
import {
  type AuthProfileStore,
  ensureAuthProfileStore,
  listProfilesForProvider,
  resolveApiKeyForProfile,
  resolveAuthProfileOrder,
  resolveAuthStorePathForDisplay,
} from "./auth-profiles.js";
import { normalizeProviderId, getProviderAliases } from "./model-selection.js";

export { ensureAuthProfileStore, resolveAuthProfileOrder } from "./auth-profiles.js";

const AWS_BEARER_ENV = "AWS_BEARER_TOKEN_BEDROCK";
const AWS_ACCESS_KEY_ENV = "AWS_ACCESS_KEY_ID";
const AWS_SECRET_KEY_ENV = "AWS_SECRET_ACCESS_KEY";
const AWS_PROFILE_ENV = "AWS_PROFILE";

function resolveProviderConfig(
  cfg: OpenClawCNConfig | undefined,
  provider: string,
): ModelProviderConfig | undefined {
  const providers = cfg?.models?.providers ?? {};
  const direct = providers[provider] as ModelProviderConfig | undefined;
  if (direct) {
    return direct;
  }
  const normalized = normalizeProviderId(provider);
  if (normalized === provider) {
    const matched = Object.entries(providers).find(
      ([key]) => normalizeProviderId(key) === normalized,
    );
    return matched?.[1];
  }
  return (
    (providers[normalized] as ModelProviderConfig | undefined) ??
    Object.entries(providers).find(([key]) => normalizeProviderId(key) === normalized)?.[1]
  );
}

export function getCustomProviderApiKey(
  cfg: OpenClawCNConfig | undefined,
  provider: string,
): string | undefined {
  const entry = resolveProviderConfig(cfg, provider);
  const key = normalizeOptionalSecretInput(entry?.apiKey);
  if (key && !/^[\x20-\x7E]+$/.test(key)) {
    // API keys must be ASCII-only; non-ASCII values (e.g. Chinese placeholder
    // text from setup wizard) would cause a ByteString error in HTTP headers.
    return undefined;
  }
  return key;
}

function resolveProviderAuthOverride(
  cfg: OpenClawCNConfig | undefined,
  provider: string,
): ModelProviderAuthMode | undefined {
  const entry = resolveProviderConfig(cfg, provider);
  const auth = entry?.auth;
  if (auth === "api-key" || auth === "aws-sdk" || auth === "oauth" || auth === "token") {
    return auth;
  }
  return undefined;
}

function resolveEnvSourceLabel(params: {
  applied: Set<string>;
  envVars: string[];
  label: string;
}): string {
  const shellApplied = params.envVars.some((envVar) => params.applied.has(envVar));
  const prefix = shellApplied ? "shell env: " : "env: ";
  return `${prefix}${params.label}`;
}

export function resolveAwsSdkEnvVarName(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env[AWS_BEARER_ENV]?.trim()) {
    return AWS_BEARER_ENV;
  }
  if (env[AWS_ACCESS_KEY_ENV]?.trim() && env[AWS_SECRET_KEY_ENV]?.trim()) {
    return AWS_ACCESS_KEY_ENV;
  }
  if (env[AWS_PROFILE_ENV]?.trim()) {
    return AWS_PROFILE_ENV;
  }
  return undefined;
}

function resolveAwsSdkAuthInfo(): { mode: "aws-sdk"; source: string } {
  const applied = new Set(getShellEnvAppliedKeys());
  if (process.env[AWS_BEARER_ENV]?.trim()) {
    return {
      mode: "aws-sdk",
      source: resolveEnvSourceLabel({
        applied,
        envVars: [AWS_BEARER_ENV],
        label: AWS_BEARER_ENV,
      }),
    };
  }
  if (process.env[AWS_ACCESS_KEY_ENV]?.trim() && process.env[AWS_SECRET_KEY_ENV]?.trim()) {
    return {
      mode: "aws-sdk",
      source: resolveEnvSourceLabel({
        applied,
        envVars: [AWS_ACCESS_KEY_ENV, AWS_SECRET_KEY_ENV],
        label: `${AWS_ACCESS_KEY_ENV} + ${AWS_SECRET_KEY_ENV}`,
      }),
    };
  }
  if (process.env[AWS_PROFILE_ENV]?.trim()) {
    return {
      mode: "aws-sdk",
      source: resolveEnvSourceLabel({
        applied,
        envVars: [AWS_PROFILE_ENV],
        label: AWS_PROFILE_ENV,
      }),
    };
  }
  return { mode: "aws-sdk", source: "aws-sdk default chain" };
}

export type ResolvedProviderAuth = {
  apiKey?: string;
  profileId?: string;
  source: string;
  mode: "api-key" | "oauth" | "token" | "aws-sdk";
};

export async function resolveApiKeyForProvider(params: {
  provider: string;
  cfg?: OpenClawCNConfig;
  profileId?: string;
  preferredProfile?: string;
  store?: AuthProfileStore;
  agentDir?: string;
}): Promise<ResolvedProviderAuth> {
  const { provider, cfg, profileId, preferredProfile } = params;
  const store = params.store ?? ensureAuthProfileStore(params.agentDir);

  if (profileId) {
    const resolved = await resolveApiKeyForProfile({
      cfg,
      store,
      profileId,
      agentDir: params.agentDir,
    });
    if (!resolved) {
      throw new Error(`No credentials found for profile "${profileId}".`);
    }
    const mode = store.profiles[profileId]?.type;
    return {
      apiKey: resolved.apiKey,
      profileId,
      source: `profile:${profileId}`,
      mode: mode === "oauth" ? "oauth" : mode === "token" ? "token" : "api-key",
    };
  }

  const authOverride = resolveProviderAuthOverride(cfg, provider);
  if (authOverride === "aws-sdk") {
    return resolveAwsSdkAuthInfo();
  }

  const order = resolveAuthProfileOrder({
    cfg,
    store,
    provider,
    preferredProfile,
  });
  for (const candidate of order) {
    try {
      const resolved = await resolveApiKeyForProfile({
        cfg,
        store,
        profileId: candidate,
        agentDir: params.agentDir,
      });
      if (resolved) {
        const mode = store.profiles[candidate]?.type;
        return {
          apiKey: resolved.apiKey,
          profileId: candidate,
          source: `profile:${candidate}`,
          mode: mode === "oauth" ? "oauth" : mode === "token" ? "token" : "api-key",
        };
      }
    } catch {}
  }

  const envResolved = resolveEnvApiKey(provider);
  if (envResolved) {
    return {
      apiKey: envResolved.apiKey,
      source: envResolved.source,
      mode: envResolved.source.includes("OAUTH_TOKEN") ? "oauth" : "api-key",
    };
  }

  const customKey = getCustomProviderApiKey(cfg, provider);
  if (customKey) {
    return { apiKey: customKey, source: "models.json", mode: "api-key" };
  }

  const normalized = normalizeProviderId(provider);
  if (authOverride === undefined && normalized === "amazon-bedrock") {
    return resolveAwsSdkAuthInfo();
  }

  if (provider === "openai") {
    const hasCodex = listProfilesForProvider(store, "openai-codex").length > 0;
    if (hasCodex) {
      throw new Error(
        'No API key found for provider "openai". You are authenticated with OpenAI Codex OAuth. Use openai-codex/gpt-5.3-codex (OAuth) or set OPENAI_API_KEY to use openai/gpt-5.1-codex.',
      );
    }
  }

  const authStorePath = resolveAuthStorePathForDisplay(params.agentDir);
  const resolvedAgentDir = path.dirname(authStorePath);
  throw new Error(
    [
      `No API key found for provider "${provider}".`,
      `Auth store: ${authStorePath} (agentDir: ${resolvedAgentDir}).`,
      `Configure auth for this agent (${formatCliCommand("openclawcn agents add <id>")}) or copy auth-profiles.json from the main agentDir.`,
    ].join(" "),
  );
}

export type EnvApiKeyResult = { apiKey: string; source: string };
export type ModelAuthMode = "api-key" | "oauth" | "token" | "mixed" | "aws-sdk" | "unknown";

export function resolveEnvApiKey(provider: string): EnvApiKeyResult | null {
  const normalized = normalizeProviderId(provider);
  const applied = new Set(getShellEnvAppliedKeys());
  const pick = (envVar: string): EnvApiKeyResult | null => {
    const value = normalizeOptionalSecretInput(process.env[envVar]);
    if (!value) {
      return null;
    }
    const source = applied.has(envVar) ? `shell env: ${envVar}` : `env: ${envVar}`;
    return { apiKey: value, source };
  };

  if (normalized === "github-copilot") {
    return pick("COPILOT_GITHUB_TOKEN") ?? pick("GH_TOKEN") ?? pick("GITHUB_TOKEN");
  }

  if (normalized === "anthropic") {
    return pick("ANTHROPIC_OAUTH_TOKEN") ?? pick("ANTHROPIC_API_KEY");
  }

  if (normalized === "chutes") {
    return pick("CHUTES_OAUTH_TOKEN") ?? pick("CHUTES_API_KEY");
  }

  if (normalized === "zai") {
    return pick("ZAI_API_KEY") ?? pick("Z_AI_API_KEY");
  }

  if (normalized === "google-vertex") {
    const envKey = getEnvApiKey(normalized);
    if (!envKey) {
      return null;
    }
    return { apiKey: envKey, source: "gcloud adc" };
  }

  if (normalized === "opencode") {
    return pick("OPENCODE_API_KEY") ?? pick("OPENCODE_ZEN_API_KEY");
  }

  if (normalized === "qwen-portal") {
    return pick("QWEN_OAUTH_TOKEN") ?? pick("QWEN_PORTAL_API_KEY");
  }

  if (normalized === "minimax-portal") {
    return pick("MINIMAX_OAUTH_TOKEN") ?? pick("MINIMAX_API_KEY");
  }

  if (normalized === "kimi-coding") {
    return pick("KIMI_API_KEY") ?? pick("KIMICODE_API_KEY");
  }

  if (normalized === "huggingface") {
    return pick("HUGGINGFACE_HUB_TOKEN") ?? pick("HF_TOKEN");
  }

  const envMap: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    google: "GEMINI_API_KEY",
    voyage: "VOYAGE_API_KEY",
    groq: "GROQ_API_KEY",
    deepgram: "DEEPGRAM_API_KEY",
    cerebras: "CEREBRAS_API_KEY",
    xai: "XAI_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    litellm: "LITELLM_API_KEY",
    "vercel-ai-gateway": "AI_GATEWAY_API_KEY",
    "cloudflare-ai-gateway": "CLOUDFLARE_AI_GATEWAY_API_KEY",
    moonshot: "MOONSHOT_API_KEY",
    minimax: "MINIMAX_API_KEY",
    nvidia: "NVIDIA_API_KEY",
    xiaomi: "XIAOMI_API_KEY",
    synthetic: "SYNTHETIC_API_KEY",
    venice: "VENICE_API_KEY",
    mistral: "MISTRAL_API_KEY",
    opencode: "OPENCODE_API_KEY",
    together: "TOGETHER_API_KEY",
    qianfan: "QIANFAN_API_KEY",
    ollama: "OLLAMA_API_KEY",
    vllm: "VLLM_API_KEY",
    // 中国区提供商 (China Region Providers)
    siliconflow: "SILICONFLOW_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    glm: "ZHIPU_API_KEY",
    zhipu: "ZHIPU_API_KEY",
    "qwen-dashscope": "DASHSCOPE_API_KEY",
    dashscope: "DASHSCOPE_API_KEY",
    doubao: "DOUBAO_API_KEY",
    ark: "ARK_API_KEY",
    "aliyun-bailian": "DASHSCOPE_API_KEY",
    "volcengine-ark": "ARK_API_KEY",
    "tencent-hunyuan": "HUNYUAN_API_KEY",
    "ant-ling": "ANT_LING_API_KEY",
    "meituan-longcat": "LONGCAT_API_KEY",
    // Coding Plan providers
    "aliyun-codeplan": "ALIYUN_CODEPLAN_API_KEY",
    "glm-codeplan": "GLM_CODEPLAN_API_KEY",
    "minimax-codeplan": "MINIMAX_CODEPLAN_API_KEY",
  };
  const envVar = envMap[normalized];
  if (!envVar) {
    return null;
  }
  return pick(envVar);
}

export function resolveModelAuthMode(
  provider?: string,
  cfg?: OpenClawCNConfig,
  store?: AuthProfileStore,
): ModelAuthMode | undefined {
  const resolved = provider?.trim();
  if (!resolved) {
    return undefined;
  }

  const authOverride = resolveProviderAuthOverride(cfg, resolved);
  if (authOverride === "aws-sdk") {
    return "aws-sdk";
  }

  const authStore = store ?? ensureAuthProfileStore();
  const profiles = listProfilesForProvider(authStore, resolved);
  if (profiles.length > 0) {
    const modes = new Set(
      profiles
        .map((id) => authStore.profiles[id]?.type)
        .filter((mode): mode is "api_key" | "oauth" | "token" => Boolean(mode)),
    );
    const distinct = ["oauth", "token", "api_key"].filter((k) =>
      modes.has(k as "oauth" | "token" | "api_key"),
    );
    if (distinct.length >= 2) {
      return "mixed";
    }
    if (modes.has("oauth")) {
      return "oauth";
    }
    if (modes.has("token")) {
      return "token";
    }
    if (modes.has("api_key")) {
      return "api-key";
    }
  }

  if (authOverride === undefined && normalizeProviderId(resolved) === "amazon-bedrock") {
    return "aws-sdk";
  }

  const envKey = resolveEnvApiKey(resolved);
  if (envKey?.apiKey) {
    return envKey.source.includes("OAUTH_TOKEN") ? "oauth" : "api-key";
  }

  if (getCustomProviderApiKey(cfg, resolved)) {
    return "api-key";
  }

  return "unknown";
}

/**
 * Lightweight synchronous check: does a provider have *any* credential source
 * (auth profile, env var, config apiKey, or aws-sdk)?
 *
 * Used by runWithModelFallback to skip candidates that will inevitably fail
 * with "No API key found", avoiding wasted time on doomed API calls.
 */
export function hasProviderCredentials(
  provider: string,
  cfg: OpenClawCNConfig | undefined,
  store?: AuthProfileStore,
): boolean {
  const normalized = normalizeProviderId(provider);

  // 1. Auth override to aws-sdk → always has credentials (sdk chain)
  const authOverride = resolveProviderAuthOverride(cfg, provider);
  if (authOverride === "aws-sdk") {
    return true;
  }

  // 2. Auth profiles exist for this provider
  if (store) {
    const profiles = listProfilesForProvider(store, provider);
    if (profiles.length > 0) {
      return true;
    }
  }

  // 3. Environment variable
  if (resolveEnvApiKey(provider)) {
    return true;
  }

  // 4. Config apiKey
  if (getCustomProviderApiKey(cfg, provider)) {
    return true;
  }

  // 5. amazon-bedrock implicit aws-sdk fallback
  if (authOverride === undefined && normalized === "amazon-bedrock") {
    return true;
  }

  return false;
}

/**
 * Check if a provider was *explicitly configured by the user* —
 * i.e. has an auth profile, a config apiKey, or an enabled freeModels account.
 *
 * Unlike hasProviderCredentials, this deliberately ignores environment
 * variables (ANTHROPIC_API_KEY etc.) so that capability cards only show
 * providers the user intentionally set up in the UI / config file.
 *
 * Checks ALL aliases in the provider's alias group so that e.g.
 * `hasUserConfiguredProvider("zhipu", ...)` returns true when the user
 * configured "glm" through the setup wizard.
 */
export function hasUserConfiguredProvider(
  provider: string,
  cfg: OpenClawCNConfig | undefined,
  store?: AuthProfileStore,
): boolean {
  const aliases = getProviderAliases(provider);

  for (const alias of aliases) {
    // 1. Auth profiles exist for this provider (or alias)
    if (store) {
      const profiles = listProfilesForProvider(store, alias);
      if (profiles.length > 0) {
        return true;
      }
    }

    // 2. Config apiKey (written by setup wizard / UI)
    if (getCustomProviderApiKey(cfg, alias)) {
      return true;
    }
  }

  // 3. freeModels.accounts — check if an enabled free-model account exists
  //    for any alias of this provider
  const freeModels = (
    cfg as
      | { freeModels?: { accounts?: Array<{ providerId: string; enabled: boolean }> } }
      | undefined
  )?.freeModels;
  if (freeModels?.accounts) {
    for (const account of freeModels.accounts) {
      if (account.enabled && aliases.includes(account.providerId.toLowerCase())) {
        return true;
      }
    }
  }

  return false;
}

export async function getApiKeyForModel(params: {
  model: Model<Api>;
  cfg?: OpenClawCNConfig;
  profileId?: string;
  preferredProfile?: string;
  store?: AuthProfileStore;
  agentDir?: string;
}): Promise<ResolvedProviderAuth> {
  return resolveApiKeyForProvider({
    provider: params.model.provider,
    cfg: params.cfg,
    profileId: params.profileId,
    preferredProfile: params.preferredProfile,
    store: params.store,
    agentDir: params.agentDir,
  });
}

export function requireApiKey(auth: ResolvedProviderAuth, provider: string): string {
  const key = normalizeSecretInput(auth.apiKey);
  if (key) {
    return key;
  }
  throw new Error(`No API key resolved for provider "${provider}" (auth mode: ${auth.mode}).`);
}
