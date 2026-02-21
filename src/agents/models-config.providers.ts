import type { OpenClawCNConfig } from "../config/config.js";
import type { ModelApi, ModelDefinitionConfig } from "../config/types.models.js";
import {
  DEFAULT_COPILOT_API_BASE_URL,
  resolveCopilotApiToken,
} from "../providers/github-copilot-token.js";
import { ensureAuthProfileStore, listProfilesForProvider } from "./auth-profiles.js";
import { discoverBedrockModels } from "./bedrock-discovery.js";
import {
  buildCloudflareAiGatewayModelDefinition,
  resolveCloudflareAiGatewayBaseUrl,
} from "./cloudflare-ai-gateway.js";
import {
  discoverHuggingfaceModels,
  HUGGINGFACE_BASE_URL,
  HUGGINGFACE_MODEL_CATALOG,
  buildHuggingfaceModelDefinition,
} from "./huggingface-models.js";
import { resolveAwsSdkEnvVarName, resolveEnvApiKey } from "./model-auth.js";
import { OLLAMA_NATIVE_BASE_URL } from "./ollama-stream.js";
import {
  buildSyntheticModelDefinition,
  SYNTHETIC_BASE_URL,
  SYNTHETIC_MODEL_CATALOG,
} from "./synthetic-models.js";
import {
  TOGETHER_BASE_URL,
  TOGETHER_MODEL_CATALOG,
  buildTogetherModelDefinition,
} from "./together-models.js";
import { discoverVeniceModels, VENICE_BASE_URL } from "./venice-models.js";
import {
  discoverSiliconFlowModels,
  SILICONFLOW_BASE_URL,
  SILICONFLOW_RECOMMENDED_MODELS,
} from "./siliconflow-models.js";

type ModelsConfig = NonNullable<OpenClawCNConfig["models"]>;
export type ProviderConfig = NonNullable<ModelsConfig["providers"]>[string];

const MINIMAX_PORTAL_BASE_URL = "https://api.minimax.io/anthropic";
const MINIMAX_DEFAULT_MODEL_ID = "MiniMax-M2.1";
const MINIMAX_DEFAULT_VISION_MODEL_ID = "MiniMax-VL-01";
const MINIMAX_DEFAULT_CONTEXT_WINDOW = 200000;
const MINIMAX_DEFAULT_MAX_TOKENS = 8192;
const MINIMAX_OAUTH_PLACEHOLDER = "minimax-oauth";
// Pricing: MiniMax doesn't publish public rates. Override in models.json for accurate costs.
const MINIMAX_API_COST = {
  input: 15,
  output: 60,
  cacheRead: 2,
  cacheWrite: 10,
};

const XIAOMI_BASE_URL = "https://api.xiaomimimo.com/anthropic";
export const XIAOMI_DEFAULT_MODEL_ID = "mimo-v2-flash";
const XIAOMI_DEFAULT_CONTEXT_WINDOW = 262144;
const XIAOMI_DEFAULT_MAX_TOKENS = 8192;
const XIAOMI_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const MOONSHOT_BASE_URL = "https://api.moonshot.cn/v1";
const MOONSHOT_DEFAULT_MODEL_ID = "kimi-k2.5";
const MOONSHOT_DEFAULT_CONTEXT_WINDOW = 256000;
const MOONSHOT_DEFAULT_MAX_TOKENS = 8192;
const MOONSHOT_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const KIMI_CODE_BASE_URL = "https://api.kimi.com/coding/v1";
const KIMI_CODE_MODEL_ID = "kimi-for-coding";
const KIMI_CODE_CONTEXT_WINDOW = 262144;
const KIMI_CODE_MAX_TOKENS = 32768;
const KIMI_CODE_HEADERS = { "User-Agent": "KimiCLI/0.77" } as const;
const KIMI_CODE_COMPAT = { supportsDeveloperRole: false } as const;
const KIMI_CODE_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const ANT_LING_BASE_URL = "https://api.tbox.cn/api/llm/v1";
const ANT_LING_DEFAULT_MODEL_ID = "ling-1t";
const ANT_LING_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const MEITUAN_LONGCAT_BASE_URL = "https://api.longcat.chat/openai/v1";
const MEITUAN_LONGCAT_DEFAULT_MODEL_ID = "longcat-flash-chat";
const MEITUAN_LONGCAT_DEFAULT_CONTEXT_WINDOW = 131072;
const MEITUAN_LONGCAT_DEFAULT_MAX_TOKENS = 8192;
const MEITUAN_LONGCAT_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const QWEN_PORTAL_BASE_URL = "https://portal.qwen.ai/v1";
const QWEN_PORTAL_OAUTH_PLACEHOLDER = "qwen-oauth";
const QWEN_PORTAL_DEFAULT_CONTEXT_WINDOW = 128000;
const QWEN_PORTAL_DEFAULT_MAX_TOKENS = 8192;
const QWEN_PORTAL_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const OLLAMA_BASE_URL = OLLAMA_NATIVE_BASE_URL;
const OLLAMA_API_BASE_URL = OLLAMA_BASE_URL;
const OLLAMA_DEFAULT_CONTEXT_WINDOW = 128000;
const OLLAMA_DEFAULT_MAX_TOKENS = 8192;
const OLLAMA_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const VLLM_BASE_URL = "http://127.0.0.1:8000/v1";
const VLLM_DEFAULT_CONTEXT_WINDOW = 128000;
const VLLM_DEFAULT_MAX_TOKENS = 8192;
const VLLM_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const QIANFAN_BASE_URL = "https://qianfan.baidubce.com/v2";
export const QIANFAN_DEFAULT_MODEL_ID = "deepseek-v3.2";
const QIANFAN_DEFAULT_CONTEXT_WINDOW = 98304;
const QIANFAN_DEFAULT_MAX_TOKENS = 32768;
const QIANFAN_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const NVIDIA_DEFAULT_MODEL_ID = "nvidia/llama-3.1-nemotron-70b-instruct";
const NVIDIA_DEFAULT_CONTEXT_WINDOW = 131072;
const NVIDIA_DEFAULT_MAX_TOKENS = 4096;
const NVIDIA_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

// ============================================================================
// 国产大模型配置 (China Domestic LLM Providers)
// ============================================================================

// 通义千问 Qwen (阿里云 DashScope)
const QWEN_DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const QWEN_DEFAULT_CONTEXT_WINDOW = 131072;
const QWEN_DEFAULT_MAX_TOKENS = 8192;
const QWEN_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

// 豆包 Doubao (字节跳动火山引擎)
const DOUBAO_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DOUBAO_DEFAULT_CONTEXT_WINDOW = 256000;
const DOUBAO_DEFAULT_MAX_TOKENS = 4096;
const DOUBAO_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

// DeepSeek
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_DEFAULT_CONTEXT_WINDOW = 64000;
const DEEPSEEK_DEFAULT_MAX_TOKENS = 8192;
const DEEPSEEK_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

// 腾讯混元 Tencent Hunyuan
const TENCENT_HUNYUAN_BASE_URL = "https://api.hunyuan.cloud.tencent.com/v1";
const TENCENT_HUNYUAN_DEFAULT_CONTEXT_WINDOW = 32000;
const TENCENT_HUNYUAN_DEFAULT_MAX_TOKENS = 4096;
const TENCENT_HUNYUAN_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

// 智谱 GLM (智谱AI)
const GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
const GLM_DEFAULT_CONTEXT_WINDOW = 128000;
const GLM_DEFAULT_MAX_TOKENS = 4096;
const GLM_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    family?: string;
    parameter_size?: string;
  };
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

type VllmModelsResponse = {
  data?: Array<{
    id?: string;
  }>;
};

/**
 * Derive the Ollama native API base URL from a configured base URL.
 */
export function resolveOllamaApiBase(configuredBaseUrl?: string): string {
  if (!configuredBaseUrl) {
    return OLLAMA_API_BASE_URL;
  }
  const trimmed = configuredBaseUrl.replace(/\/+$/, "");
  return trimmed.replace(/\/v1$/i, "");
}

async function discoverOllamaModels(baseUrl?: string): Promise<ModelDefinitionConfig[]> {
  // Skip Ollama discovery in test environments
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return [];
  }
  try {
    const apiBase = resolveOllamaApiBase(baseUrl);
    const response = await fetch(`${apiBase}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.warn(`Failed to discover Ollama models: ${response.status}`);
      return [];
    }
    const data = (await response.json()) as OllamaTagsResponse;
    if (!data.models || data.models.length === 0) {
      console.warn("No Ollama models found on local instance");
      return [];
    }
    return data.models.map((model) => {
      const modelId = model.name;
      const isReasoning =
        modelId.toLowerCase().includes("r1") || modelId.toLowerCase().includes("reasoning");
      return {
        id: modelId,
        name: modelId,
        reasoning: isReasoning,
        input: ["text"],
        cost: OLLAMA_DEFAULT_COST,
        contextWindow: OLLAMA_DEFAULT_CONTEXT_WINDOW,
        maxTokens: OLLAMA_DEFAULT_MAX_TOKENS,
      };
    });
  } catch (error) {
    console.warn(`Failed to discover Ollama models: ${String(error)}`);
    return [];
  }
}

async function discoverVllmModels(
  baseUrl: string,
  apiKey?: string,
): Promise<ModelDefinitionConfig[]> {
  // Skip vLLM discovery in test environments
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return [];
  }

  const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  const url = `${trimmedBaseUrl}/models`;

  try {
    const trimmedApiKey = apiKey?.trim();
    const response = await fetch(url, {
      headers: trimmedApiKey ? { Authorization: `Bearer ${trimmedApiKey}` } : undefined,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.warn(`Failed to discover vLLM models: ${response.status}`);
      return [];
    }
    const data = (await response.json()) as VllmModelsResponse;
    const models = data.data ?? [];
    if (models.length === 0) {
      console.warn("No vLLM models found on local instance");
      return [];
    }

    return models
      .map((m) => ({ id: typeof m.id === "string" ? m.id.trim() : "" }))
      .filter((m) => Boolean(m.id))
      .map((m) => {
        const modelId = m.id;
        const lower = modelId.toLowerCase();
        const isReasoning =
          lower.includes("r1") || lower.includes("reasoning") || lower.includes("think");
        return {
          id: modelId,
          name: modelId,
          reasoning: isReasoning,
          input: ["text"],
          cost: VLLM_DEFAULT_COST,
          contextWindow: VLLM_DEFAULT_CONTEXT_WINDOW,
          maxTokens: VLLM_DEFAULT_MAX_TOKENS,
        } satisfies ModelDefinitionConfig;
      });
  } catch (error) {
    console.warn(`Failed to discover vLLM models: ${String(error)}`);
    return [];
  }
}

function normalizeApiKeyConfig(value: string): string {
  const trimmed = value.trim();
  const match = /^\$\{([A-Z0-9_]+)\}$/.exec(trimmed);
  return match?.[1] ?? trimmed;
}

function resolveEnvApiKeyVarName(provider: string): string | undefined {
  const resolved = resolveEnvApiKey(provider);
  if (!resolved) {
    return undefined;
  }
  const match = /^(?:env: |shell env: )([A-Z0-9_]+)$/.exec(resolved.source);
  return match ? match[1] : undefined;
}

function resolveAwsSdkApiKeyVarName(): string {
  return resolveAwsSdkEnvVarName() ?? "AWS_PROFILE";
}

function resolveApiKeyFromProfiles(params: {
  provider: string;
  store: ReturnType<typeof ensureAuthProfileStore>;
}): string | undefined {
  const ids = listProfilesForProvider(params.store, params.provider);
  for (const id of ids) {
    const cred = params.store.profiles[id];
    if (!cred) {
      continue;
    }
    if (cred.type === "api_key") {
      return cred.key;
    }
    if (cred.type === "token") {
      return cred.token;
    }
  }
  return undefined;
}

export function normalizeGoogleModelId(id: string): string {
  if (id === "gemini-3-pro") {
    return "gemini-3-pro-preview";
  }
  if (id === "gemini-3-flash") {
    return "gemini-3-flash-preview";
  }
  return id;
}

function normalizeGoogleProvider(provider: ProviderConfig): ProviderConfig {
  let mutated = false;
  const models = provider.models.map((model) => {
    const nextId = normalizeGoogleModelId(model.id);
    if (nextId === model.id) {
      return model;
    }
    mutated = true;
    return { ...model, id: nextId };
  });
  return mutated ? { ...provider, models } : provider;
}

/**
 * Normalize provider key to match runtime normalizeProviderId() mapping.
 * Duplicated here to avoid circular dependency on model-selection.ts.
 */
function normalizeProviderKey(key: string): string {
  const k = key.toLowerCase();
  if (k === "kimi-code") return "kimi-coding";
  if (k === "z.ai" || k === "z-ai") return "zai";
  if (k === "opencode-zen") return "opencode";
  if (k === "qwen") return "qwen-portal";
  return key;
}

/**
 * Infer the `api` type for a provider when the config file omits it.
 * Returns the most likely API type based on provider key / baseUrl,
 * or "openai-completions" as a safe default for unknown providers.
 */
function inferApiType(providerKey: string, baseUrl?: string): ModelApi {
  const key = providerKey.toLowerCase();
  if (key === "anthropic" || key === "minimax" || key === "minimax-portal") {
    return "anthropic-messages";
  }
  if (key === "ollama") {
    return "ollama";
  }
  if (key === "amazon-bedrock") {
    return "bedrock-converse-stream";
  }
  if (baseUrl && /anthropic\.com/i.test(baseUrl)) {
    return "anthropic-messages";
  }
  // Default: most providers (OpenAI-compatible, kimi-code, moonshot, etc.)
  return "openai-completions";
}

export function normalizeProviders(params: {
  providers: ModelsConfig["providers"];
  agentDir: string;
}): ModelsConfig["providers"] {
  const { providers } = params;
  if (!providers) {
    return providers;
  }
  const authStore = ensureAuthProfileStore(params.agentDir, {
    allowKeychainPrompt: false,
  });
  let mutated = false;
  const next: Record<string, ProviderConfig> = {};

  for (const [key, provider] of Object.entries(providers)) {
    // Normalize provider key to match runtime normalizeProviderId() mapping.
    // Without this, config "kimi-code" stays as-is in models.json but runtime
    // resolves it to "kimi-coding", causing "No API provider registered" crash.
    const trimmedKey = key.trim();
    const normalizedKey = normalizeProviderKey(trimmedKey);
    if (normalizedKey !== trimmedKey) {
      mutated = true;
    }
    let normalizedProvider = provider;

    // Fix common misconfig: apiKey set to "${ENV_VAR}" instead of "ENV_VAR".
    if (
      normalizedProvider.apiKey &&
      normalizeApiKeyConfig(normalizedProvider.apiKey) !== normalizedProvider.apiKey
    ) {
      mutated = true;
      normalizedProvider = {
        ...normalizedProvider,
        apiKey: normalizeApiKeyConfig(normalizedProvider.apiKey),
      };
    }

    // If a provider defines models, pi's ModelRegistry requires apiKey to be set.
    // Fill it from the environment or auth profiles when possible.
    const hasModels =
      Array.isArray(normalizedProvider.models) && normalizedProvider.models.length > 0;
    if (hasModels && !normalizedProvider.apiKey?.trim()) {
      const authMode =
        normalizedProvider.auth ?? (normalizedKey === "amazon-bedrock" ? "aws-sdk" : undefined);
      if (authMode === "aws-sdk") {
        const apiKey = resolveAwsSdkApiKeyVarName();
        mutated = true;
        normalizedProvider = { ...normalizedProvider, apiKey };
      } else {
        const fromEnv = resolveEnvApiKeyVarName(normalizedKey);
        const fromProfiles = resolveApiKeyFromProfiles({
          provider: normalizedKey,
          store: authStore,
        });
        const apiKey = fromEnv ?? fromProfiles;
        if (apiKey?.trim()) {
          mutated = true;
          normalizedProvider = { ...normalizedProvider, apiKey };
        }
      }
    }

    if (normalizedKey === "google") {
      const googleNormalized = normalizeGoogleProvider(normalizedProvider);
      if (googleNormalized !== normalizedProvider) {
        mutated = true;
      }
      normalizedProvider = googleNormalized;
    }

    // Kimi Coding requires User-Agent header and supportsDeveloperRole: false.
    // User config may override implicit provider and lose these critical fields.
    if (normalizedKey === "kimi-coding" && Array.isArray(normalizedProvider.models)) {
      const patchedModels = normalizedProvider.models.map((model: unknown) => {
        if (!model || typeof model !== "object") return model;
        const rec = model as Record<string, unknown>;
        let patched = false;
        const patch: Record<string, unknown> = {};
        if (!rec.headers) {
          patch.headers = KIMI_CODE_HEADERS;
          patched = true;
        }
        if (!rec.compat) {
          patch.compat = KIMI_CODE_COMPAT;
          patched = true;
        }
        return patched ? { ...rec, ...patch } : model;
      });
      if (patchedModels !== normalizedProvider.models) {
        mutated = true;
        normalizedProvider = {
          ...normalizedProvider,
          models: patchedModels as typeof normalizedProvider.models,
        };
      }
    }

    // Ensure `api` field is set — config files may omit it, causing
    // "No API provider registered for api: undefined" at runtime.
    if (!normalizedProvider.api) {
      const inferredApi = inferApiType(normalizedKey, normalizedProvider.baseUrl);
      if (inferredApi) {
        mutated = true;
        normalizedProvider = { ...normalizedProvider, api: inferredApi };
      }
    }

    next[normalizedKey] = normalizedProvider;
  }

  return mutated ? next : providers;
}

function buildMinimaxProvider(): ProviderConfig {
  return {
    baseUrl: MINIMAX_PORTAL_BASE_URL,
    api: "anthropic-messages",
    models: [
      {
        id: MINIMAX_DEFAULT_MODEL_ID,
        name: "MiniMax M2.1",
        reasoning: false,
        input: ["text"],
        cost: MINIMAX_API_COST,
        contextWindow: MINIMAX_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MINIMAX_DEFAULT_MAX_TOKENS,
      },
      {
        id: "MiniMax-M2.1-lightning",
        name: "MiniMax M2.1 Lightning",
        reasoning: false,
        input: ["text"],
        cost: MINIMAX_API_COST,
        contextWindow: MINIMAX_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MINIMAX_DEFAULT_MAX_TOKENS,
      },
      {
        id: MINIMAX_DEFAULT_VISION_MODEL_ID,
        name: "MiniMax VL 01",
        reasoning: false,
        input: ["text", "image"],
        cost: MINIMAX_API_COST,
        contextWindow: MINIMAX_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MINIMAX_DEFAULT_MAX_TOKENS,
      },
      {
        id: "MiniMax-M2.5",
        name: "MiniMax M2.5",
        reasoning: true,
        input: ["text"],
        cost: MINIMAX_API_COST,
        contextWindow: MINIMAX_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MINIMAX_DEFAULT_MAX_TOKENS,
      },
      {
        id: "MiniMax-M2.5-Lightning",
        name: "MiniMax M2.5 Lightning",
        reasoning: true,
        input: ["text"],
        cost: MINIMAX_API_COST,
        contextWindow: MINIMAX_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MINIMAX_DEFAULT_MAX_TOKENS,
      },
      {
        id: "MiniMax-M2.5-highspeed",
        name: "MiniMax M2.5 Highspeed",
        reasoning: true,
        input: ["text"],
        cost: MINIMAX_API_COST,
        contextWindow: MINIMAX_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MINIMAX_DEFAULT_MAX_TOKENS,
      },
      {
        id: "MiniMax-M2.1-highspeed",
        name: "MiniMax M2.1 Highspeed",
        reasoning: false,
        input: ["text"],
        cost: MINIMAX_API_COST,
        contextWindow: MINIMAX_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MINIMAX_DEFAULT_MAX_TOKENS,
      },
      {
        id: "MiniMax-M2",
        name: "MiniMax M2",
        reasoning: false,
        input: ["text"],
        cost: MINIMAX_API_COST,
        contextWindow: MINIMAX_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MINIMAX_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

function buildMinimaxPortalProvider(): ProviderConfig {
  return {
    baseUrl: MINIMAX_PORTAL_BASE_URL,
    api: "anthropic-messages",
    models: [
      {
        id: MINIMAX_DEFAULT_MODEL_ID,
        name: "MiniMax M2.1",
        reasoning: false,
        input: ["text"],
        cost: MINIMAX_API_COST,
        contextWindow: MINIMAX_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MINIMAX_DEFAULT_MAX_TOKENS,
      },
      {
        id: "MiniMax-M2.5",
        name: "MiniMax M2.5",
        reasoning: true,
        input: ["text"],
        cost: MINIMAX_API_COST,
        contextWindow: MINIMAX_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MINIMAX_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

function buildMoonshotProvider(): ProviderConfig {
  return {
    baseUrl: MOONSHOT_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: MOONSHOT_DEFAULT_MODEL_ID,
        name: "Kimi K2.5",
        reasoning: false,
        input: ["text"],
        cost: MOONSHOT_DEFAULT_COST,
        contextWindow: MOONSHOT_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MOONSHOT_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

function buildKimiCodeProvider(): ProviderConfig {
  return {
    baseUrl: KIMI_CODE_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: KIMI_CODE_MODEL_ID,
        name: "Kimi For Coding",
        reasoning: true,
        input: ["text"],
        cost: KIMI_CODE_DEFAULT_COST,
        contextWindow: KIMI_CODE_CONTEXT_WINDOW,
        maxTokens: KIMI_CODE_MAX_TOKENS,
        headers: KIMI_CODE_HEADERS,
        compat: KIMI_CODE_COMPAT,
      },
      // 🔥 兼容旧 setup wizard 配置的 "k2p5" model ID
      {
        id: "k2p5",
        name: "Kimi K2.5",
        reasoning: true,
        input: ["text"],
        cost: KIMI_CODE_DEFAULT_COST,
        contextWindow: KIMI_CODE_CONTEXT_WINDOW,
        maxTokens: KIMI_CODE_MAX_TOKENS,
        headers: KIMI_CODE_HEADERS,
        compat: KIMI_CODE_COMPAT,
      },
    ],
  };
}

function buildQwenPortalProvider(): ProviderConfig {
  return {
    baseUrl: QWEN_PORTAL_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: "coder-model",
        name: "Qwen Coder",
        reasoning: false,
        input: ["text"],
        cost: QWEN_PORTAL_DEFAULT_COST,
        contextWindow: QWEN_PORTAL_DEFAULT_CONTEXT_WINDOW,
        maxTokens: QWEN_PORTAL_DEFAULT_MAX_TOKENS,
      },
      {
        id: "vision-model",
        name: "Qwen Vision",
        reasoning: false,
        input: ["text", "image"],
        cost: QWEN_PORTAL_DEFAULT_COST,
        contextWindow: QWEN_PORTAL_DEFAULT_CONTEXT_WINDOW,
        maxTokens: QWEN_PORTAL_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

function buildSyntheticProvider(): ProviderConfig {
  return {
    baseUrl: SYNTHETIC_BASE_URL,
    api: "anthropic-messages",
    models: SYNTHETIC_MODEL_CATALOG.map(buildSyntheticModelDefinition),
  };
}

export function buildXiaomiProvider(): ProviderConfig {
  return {
    baseUrl: XIAOMI_BASE_URL,
    api: "anthropic-messages",
    models: [
      {
        id: XIAOMI_DEFAULT_MODEL_ID,
        name: "Xiaomi MiMo V2 Flash",
        reasoning: false,
        input: ["text"],
        cost: XIAOMI_DEFAULT_COST,
        contextWindow: XIAOMI_DEFAULT_CONTEXT_WINDOW,
        maxTokens: XIAOMI_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

function buildAntLingProvider(): ProviderConfig {
  return {
    baseUrl: ANT_LING_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: ANT_LING_DEFAULT_MODEL_ID,
        name: "蚂蚁百灵 Ling-1T",
        reasoning: false,
        input: ["text"],
        cost: ANT_LING_DEFAULT_COST,
        contextWindow: 128000,
        maxTokens: 8192,
      },
    ],
  };
}

function buildMeituanLongcatProvider(): ProviderConfig {
  return {
    baseUrl: MEITUAN_LONGCAT_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: MEITUAN_LONGCAT_DEFAULT_MODEL_ID,
        name: "LongCat Flash",
        reasoning: false,
        input: ["text"],
        cost: MEITUAN_LONGCAT_DEFAULT_COST,
        contextWindow: MEITUAN_LONGCAT_DEFAULT_CONTEXT_WINDOW,
        maxTokens: MEITUAN_LONGCAT_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

async function buildVeniceProvider(): Promise<ProviderConfig> {
  const models = await discoverVeniceModels();
  return {
    baseUrl: VENICE_BASE_URL,
    api: "openai-completions",
    models,
  };
}

async function buildOllamaProvider(configuredBaseUrl?: string): Promise<ProviderConfig> {
  const models = await discoverOllamaModels(configuredBaseUrl);
  return {
    baseUrl: resolveOllamaApiBase(configuredBaseUrl),
    api: "ollama",
    models,
  };
}

async function buildHuggingfaceProvider(apiKey?: string): Promise<ProviderConfig> {
  const resolvedSecret =
    apiKey?.trim() !== ""
      ? /^[A-Z][A-Z0-9_]*$/.test(apiKey!.trim())
        ? (process.env[apiKey!.trim()] ?? "").trim()
        : apiKey!.trim()
      : "";
  const models =
    resolvedSecret !== ""
      ? await discoverHuggingfaceModels(resolvedSecret)
      : HUGGINGFACE_MODEL_CATALOG.map(buildHuggingfaceModelDefinition);
  return {
    baseUrl: HUGGINGFACE_BASE_URL,
    api: "openai-completions",
    models,
  };
}

function buildTogetherProvider(): ProviderConfig {
  return {
    baseUrl: TOGETHER_BASE_URL,
    api: "openai-completions",
    models: TOGETHER_MODEL_CATALOG.map(buildTogetherModelDefinition),
  };
}

async function buildVllmProvider(params?: {
  baseUrl?: string;
  apiKey?: string;
}): Promise<ProviderConfig> {
  const baseUrl = (params?.baseUrl?.trim() || VLLM_BASE_URL).replace(/\/+$/, "");
  const models = await discoverVllmModels(baseUrl, params?.apiKey);
  return {
    baseUrl,
    api: "openai-completions",
    models,
  };
}

export function buildQianfanProvider(): ProviderConfig {
  return {
    baseUrl: QIANFAN_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: QIANFAN_DEFAULT_MODEL_ID,
        name: "DEEPSEEK V3.2",
        reasoning: true,
        input: ["text"],
        cost: QIANFAN_DEFAULT_COST,
        contextWindow: QIANFAN_DEFAULT_CONTEXT_WINDOW,
        maxTokens: QIANFAN_DEFAULT_MAX_TOKENS,
      },
      {
        id: "ernie-5.0-thinking-preview",
        name: "ERNIE-5.0-Thinking-Preview",
        reasoning: true,
        input: ["text", "image"],
        cost: QIANFAN_DEFAULT_COST,
        contextWindow: 119000,
        maxTokens: 64000,
      },
    ],
  };
}

export function buildNvidiaProvider(): ProviderConfig {
  return {
    baseUrl: NVIDIA_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: NVIDIA_DEFAULT_MODEL_ID,
        name: "NVIDIA Llama 3.1 Nemotron 70B Instruct",
        reasoning: false,
        input: ["text"],
        cost: NVIDIA_DEFAULT_COST,
        contextWindow: NVIDIA_DEFAULT_CONTEXT_WINDOW,
        maxTokens: NVIDIA_DEFAULT_MAX_TOKENS,
      },
      {
        id: "meta/llama-3.3-70b-instruct",
        name: "Meta Llama 3.3 70B Instruct",
        reasoning: false,
        input: ["text"],
        cost: NVIDIA_DEFAULT_COST,
        contextWindow: 131072,
        maxTokens: 4096,
      },
      {
        id: "nvidia/mistral-nemo-minitron-8b-8k-instruct",
        name: "NVIDIA Mistral NeMo Minitron 8B Instruct",
        reasoning: false,
        input: ["text"],
        cost: NVIDIA_DEFAULT_COST,
        contextWindow: 8192,
        maxTokens: 2048,
      },
    ],
  };
}

// ============================================================================
// 国产大模型构建函数 (China Domestic LLM Provider Builders)
// ============================================================================

function buildQwenDashscopeProvider(): ProviderConfig {
  return {
    baseUrl: QWEN_DASHSCOPE_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: "qwen-max",
        name: "通义千问 Max",
        reasoning: false,
        input: ["text"],
        cost: QWEN_DEFAULT_COST,
        contextWindow: 32000,
        maxTokens: QWEN_DEFAULT_MAX_TOKENS,
      },
      {
        id: "qwen-plus",
        name: "通义千问 Plus",
        reasoning: false,
        input: ["text"],
        cost: QWEN_DEFAULT_COST,
        contextWindow: QWEN_DEFAULT_CONTEXT_WINDOW,
        maxTokens: QWEN_DEFAULT_MAX_TOKENS,
      },
      {
        id: "qwen-turbo",
        name: "通义千问 Turbo",
        reasoning: false,
        input: ["text"],
        cost: QWEN_DEFAULT_COST,
        contextWindow: QWEN_DEFAULT_CONTEXT_WINDOW,
        maxTokens: QWEN_DEFAULT_MAX_TOKENS,
      },
      {
        id: "qwen-long",
        name: "通义千问 Long",
        reasoning: false,
        input: ["text"],
        cost: QWEN_DEFAULT_COST,
        contextWindow: 1000000,
        maxTokens: 6000,
      },
      {
        id: "qwen-vl-max",
        name: "通义千问 VL Max (视觉)",
        reasoning: false,
        input: ["text", "image"],
        cost: QWEN_DEFAULT_COST,
        contextWindow: 32000,
        maxTokens: 2000,
      },
      {
        id: "qwen-vl-plus",
        name: "通义千问 VL Plus (视觉)",
        reasoning: false,
        input: ["text", "image"],
        cost: QWEN_DEFAULT_COST,
        contextWindow: 8000,
        maxTokens: 2000,
      },
      {
        id: "qwen-coder-plus",
        name: "通义千问 Coder Plus",
        reasoning: false,
        input: ["text"],
        cost: QWEN_DEFAULT_COST,
        contextWindow: QWEN_DEFAULT_CONTEXT_WINDOW,
        maxTokens: QWEN_DEFAULT_MAX_TOKENS,
      },
      {
        id: "qwen-coder-turbo",
        name: "通义千问 Coder Turbo",
        reasoning: false,
        input: ["text"],
        cost: QWEN_DEFAULT_COST,
        contextWindow: QWEN_DEFAULT_CONTEXT_WINDOW,
        maxTokens: QWEN_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

function buildDoubaoProvider(): ProviderConfig {
  return {
    baseUrl: DOUBAO_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: "doubao-seed-1-8-251228",
        name: "豆包 1.8",
        reasoning: true,
        input: ["text", "image", "video"],
        cost: { input: 0.004, output: 0.016, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 256000,
        maxTokens: 32768,
      },
      {
        id: "doubao-seed-1-6-251015",
        name: "豆包 1.6",
        reasoning: true,
        input: ["text", "image", "video"],
        cost: { input: 0.008, output: 0.02, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 256000,
        maxTokens: 32768,
      },
      {
        id: "doubao-seed-1-6-lite-251015",
        name: "豆包 1.6 Lite",
        reasoning: false,
        input: ["text"],
        cost: DOUBAO_DEFAULT_COST,
        contextWindow: DOUBAO_DEFAULT_CONTEXT_WINDOW,
        maxTokens: DOUBAO_DEFAULT_MAX_TOKENS,
      },
      {
        id: "doubao-seed-1-6-flash-250828",
        name: "豆包 1.6 Flash",
        reasoning: false,
        input: ["text", "image"],
        cost: DOUBAO_DEFAULT_COST,
        contextWindow: DOUBAO_DEFAULT_CONTEXT_WINDOW,
        maxTokens: DOUBAO_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

function buildDeepSeekProvider(): ProviderConfig {
  return {
    baseUrl: DEEPSEEK_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: "deepseek-chat",
        name: "DeepSeek Chat",
        reasoning: false,
        input: ["text"],
        cost: DEEPSEEK_DEFAULT_COST,
        contextWindow: DEEPSEEK_DEFAULT_CONTEXT_WINDOW,
        maxTokens: DEEPSEEK_DEFAULT_MAX_TOKENS,
      },
      {
        id: "deepseek-coder",
        name: "DeepSeek Coder",
        reasoning: false,
        input: ["text"],
        cost: DEEPSEEK_DEFAULT_COST,
        contextWindow: DEEPSEEK_DEFAULT_CONTEXT_WINDOW,
        maxTokens: DEEPSEEK_DEFAULT_MAX_TOKENS,
      },
      {
        id: "deepseek-reasoner",
        name: "DeepSeek R1 (推理)",
        reasoning: true,
        input: ["text"],
        cost: DEEPSEEK_DEFAULT_COST,
        contextWindow: DEEPSEEK_DEFAULT_CONTEXT_WINDOW,
        maxTokens: DEEPSEEK_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

async function buildSiliconFlowProvider(apiKey?: string): Promise<ProviderConfig> {
  const models = await discoverSiliconFlowModels(apiKey);
  return {
    baseUrl: SILICONFLOW_BASE_URL,
    api: "openai-completions",
    models: models.length > 0 ? models : SILICONFLOW_RECOMMENDED_MODELS,
  };
}

function buildGLMProvider(): ProviderConfig {
  return {
    baseUrl: GLM_BASE_URL,
    api: "openai-completions",
    models: [
      // GLM-5 系列
      {
        id: "glm-5",
        name: "GLM-5",
        reasoning: false,
        input: ["text"],
        cost: GLM_DEFAULT_COST,
        contextWindow: GLM_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GLM_DEFAULT_MAX_TOKENS,
      },
      {
        id: "glm-5-code",
        name: "GLM-5-Code",
        reasoning: false,
        input: ["text"],
        cost: GLM_DEFAULT_COST,
        contextWindow: GLM_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GLM_DEFAULT_MAX_TOKENS,
      },
      // GLM-4.7 系列
      {
        id: "glm-4.7",
        name: "GLM-4.7",
        reasoning: false,
        input: ["text"],
        cost: GLM_DEFAULT_COST,
        contextWindow: GLM_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GLM_DEFAULT_MAX_TOKENS,
      },
      {
        id: "glm-4.7-flash",
        name: "GLM-4.7-Flash",
        reasoning: false,
        input: ["text"],
        cost: GLM_DEFAULT_COST,
        contextWindow: GLM_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GLM_DEFAULT_MAX_TOKENS,
      },
      // GLM-4.6 系列
      {
        id: "glm-4.6",
        name: "GLM-4.6",
        reasoning: false,
        input: ["text"],
        cost: GLM_DEFAULT_COST,
        contextWindow: GLM_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GLM_DEFAULT_MAX_TOKENS,
      },
      {
        id: "glm-4.6v",
        name: "GLM-4.6V (视觉)",
        reasoning: false,
        input: ["text", "image"],
        cost: GLM_DEFAULT_COST,
        contextWindow: GLM_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GLM_DEFAULT_MAX_TOKENS,
      },
      // GLM-4.5 系列
      {
        id: "glm-4.5",
        name: "GLM-4.5",
        reasoning: false,
        input: ["text"],
        cost: GLM_DEFAULT_COST,
        contextWindow: GLM_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GLM_DEFAULT_MAX_TOKENS,
      },
      {
        id: "glm-4.5-flash",
        name: "GLM-4.5-Flash",
        reasoning: false,
        input: ["text"],
        cost: GLM_DEFAULT_COST,
        contextWindow: GLM_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GLM_DEFAULT_MAX_TOKENS,
      },
      {
        id: "glm-4.5-air",
        name: "GLM-4.5-Air",
        reasoning: false,
        input: ["text"],
        cost: GLM_DEFAULT_COST,
        contextWindow: GLM_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GLM_DEFAULT_MAX_TOKENS,
      },
      {
        id: "glm-4.5v",
        name: "GLM-4.5V (视觉)",
        reasoning: false,
        input: ["text", "image"],
        cost: GLM_DEFAULT_COST,
        contextWindow: GLM_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GLM_DEFAULT_MAX_TOKENS,
      },
      // GLM-4 系列
      {
        id: "glm-4-plus",
        name: "GLM-4 Plus",
        reasoning: false,
        input: ["text"],
        cost: GLM_DEFAULT_COST,
        contextWindow: GLM_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GLM_DEFAULT_MAX_TOKENS,
      },
      {
        id: "glm-4",
        name: "GLM-4",
        reasoning: false,
        input: ["text"],
        cost: GLM_DEFAULT_COST,
        contextWindow: GLM_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GLM_DEFAULT_MAX_TOKENS,
      },
      {
        id: "glm-4-air",
        name: "GLM-4 Air",
        reasoning: false,
        input: ["text"],
        cost: GLM_DEFAULT_COST,
        contextWindow: GLM_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GLM_DEFAULT_MAX_TOKENS,
      },
      {
        id: "glm-4-airx",
        name: "GLM-4 AirX",
        reasoning: false,
        input: ["text"],
        cost: GLM_DEFAULT_COST,
        contextWindow: 8000,
        maxTokens: GLM_DEFAULT_MAX_TOKENS,
      },
      {
        id: "glm-4-flash",
        name: "GLM-4 Flash",
        reasoning: false,
        input: ["text"],
        cost: GLM_DEFAULT_COST,
        contextWindow: GLM_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GLM_DEFAULT_MAX_TOKENS,
      },
      {
        id: "glm-4-flashx",
        name: "GLM-4 FlashX",
        reasoning: false,
        input: ["text"],
        cost: GLM_DEFAULT_COST,
        contextWindow: GLM_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GLM_DEFAULT_MAX_TOKENS,
      },
      {
        id: "glm-4-long",
        name: "GLM-4 Long",
        reasoning: false,
        input: ["text"],
        cost: GLM_DEFAULT_COST,
        contextWindow: 1000000,
        maxTokens: GLM_DEFAULT_MAX_TOKENS,
      },
      {
        id: "glm-4v-plus",
        name: "GLM-4V Plus (视觉)",
        reasoning: false,
        input: ["text", "image"],
        cost: GLM_DEFAULT_COST,
        contextWindow: 8000,
        maxTokens: 1000,
      },
      {
        id: "glm-4v",
        name: "GLM-4V (视觉)",
        reasoning: false,
        input: ["text", "image"],
        cost: GLM_DEFAULT_COST,
        contextWindow: 2000,
        maxTokens: 1000,
      },
      {
        id: "glm-4v-flash",
        name: "GLM-4V Flash (视觉)",
        reasoning: false,
        input: ["text", "image"],
        cost: GLM_DEFAULT_COST,
        contextWindow: 8000,
        maxTokens: 1000,
      },
      {
        id: "codegeex-4",
        name: "CodeGeeX-4 (代码)",
        reasoning: false,
        input: ["text"],
        cost: GLM_DEFAULT_COST,
        contextWindow: GLM_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GLM_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

function buildTencentHunyuanProvider(): ProviderConfig {
  return {
    baseUrl: TENCENT_HUNYUAN_BASE_URL,
    api: "openai-completions",
    models: [
      {
        id: "hunyuan-turbo",
        name: "腾讯混元 Turbo",
        reasoning: false,
        input: ["text"],
        cost: TENCENT_HUNYUAN_DEFAULT_COST,
        contextWindow: TENCENT_HUNYUAN_DEFAULT_CONTEXT_WINDOW,
        maxTokens: TENCENT_HUNYUAN_DEFAULT_MAX_TOKENS,
      },
      {
        id: "hunyuan-pro",
        name: "腾讯混元 Pro",
        reasoning: false,
        input: ["text"],
        cost: TENCENT_HUNYUAN_DEFAULT_COST,
        contextWindow: TENCENT_HUNYUAN_DEFAULT_CONTEXT_WINDOW,
        maxTokens: TENCENT_HUNYUAN_DEFAULT_MAX_TOKENS,
      },
      {
        id: "hunyuan-standard",
        name: "腾讯混元 Standard",
        reasoning: false,
        input: ["text"],
        cost: TENCENT_HUNYUAN_DEFAULT_COST,
        contextWindow: TENCENT_HUNYUAN_DEFAULT_CONTEXT_WINDOW,
        maxTokens: TENCENT_HUNYUAN_DEFAULT_MAX_TOKENS,
      },
      {
        id: "hunyuan-lite",
        name: "腾讯混元 Lite",
        reasoning: false,
        input: ["text"],
        cost: TENCENT_HUNYUAN_DEFAULT_COST,
        contextWindow: TENCENT_HUNYUAN_DEFAULT_CONTEXT_WINDOW,
        maxTokens: TENCENT_HUNYUAN_DEFAULT_MAX_TOKENS,
      },
      {
        id: "hunyuan-vision",
        name: "腾讯混元 Vision (视觉)",
        reasoning: false,
        input: ["text", "image"],
        cost: TENCENT_HUNYUAN_DEFAULT_COST,
        contextWindow: TENCENT_HUNYUAN_DEFAULT_CONTEXT_WINDOW,
        maxTokens: TENCENT_HUNYUAN_DEFAULT_MAX_TOKENS,
      },
      {
        id: "hunyuan-code",
        name: "腾讯混元 Code (代码)",
        reasoning: false,
        input: ["text"],
        cost: TENCENT_HUNYUAN_DEFAULT_COST,
        contextWindow: TENCENT_HUNYUAN_DEFAULT_CONTEXT_WINDOW,
        maxTokens: TENCENT_HUNYUAN_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

export async function resolveImplicitProviders(params: {
  agentDir: string;
  explicitProviders?: Record<string, ProviderConfig> | null;
}): Promise<ModelsConfig["providers"]> {
  const providers: Record<string, ProviderConfig> = {};
  const authStore = ensureAuthProfileStore(params.agentDir, {
    allowKeychainPrompt: false,
  });

  const minimaxKey =
    resolveEnvApiKeyVarName("minimax") ??
    resolveApiKeyFromProfiles({ provider: "minimax", store: authStore });
  if (minimaxKey) {
    providers.minimax = { ...buildMinimaxProvider(), apiKey: minimaxKey };
  }

  const minimaxOauthProfile = listProfilesForProvider(authStore, "minimax-portal");
  if (minimaxOauthProfile.length > 0) {
    providers["minimax-portal"] = {
      ...buildMinimaxPortalProvider(),
      apiKey: MINIMAX_OAUTH_PLACEHOLDER,
    };
  }

  const moonshotKey =
    resolveEnvApiKeyVarName("moonshot") ??
    resolveApiKeyFromProfiles({ provider: "moonshot", store: authStore });
  if (moonshotKey) {
    providers.moonshot = { ...buildMoonshotProvider(), apiKey: moonshotKey };
  }

  const kimiCodeKey =
    resolveEnvApiKeyVarName("kimi-code") ??
    resolveApiKeyFromProfiles({ provider: "kimi-code", store: authStore });
  if (kimiCodeKey) {
    providers["kimi-code"] = { ...buildKimiCodeProvider(), apiKey: kimiCodeKey };
  }

  const syntheticKey =
    resolveEnvApiKeyVarName("synthetic") ??
    resolveApiKeyFromProfiles({ provider: "synthetic", store: authStore });
  if (syntheticKey) {
    providers.synthetic = { ...buildSyntheticProvider(), apiKey: syntheticKey };
  }

  const veniceKey =
    resolveEnvApiKeyVarName("venice") ??
    resolveApiKeyFromProfiles({ provider: "venice", store: authStore });
  if (veniceKey) {
    providers.venice = { ...(await buildVeniceProvider()), apiKey: veniceKey };
  }

  const qwenProfiles = listProfilesForProvider(authStore, "qwen-portal");
  if (qwenProfiles.length > 0) {
    providers["qwen-portal"] = {
      ...buildQwenPortalProvider(),
      apiKey: QWEN_PORTAL_OAUTH_PLACEHOLDER,
    };
  }

  const xiaomiKey =
    resolveEnvApiKeyVarName("xiaomi") ??
    resolveApiKeyFromProfiles({ provider: "xiaomi", store: authStore });
  if (xiaomiKey) {
    providers.xiaomi = { ...buildXiaomiProvider(), apiKey: xiaomiKey };
  }

  const antLingKey =
    resolveEnvApiKeyVarName("ant-ling") ??
    resolveApiKeyFromProfiles({ provider: "ant-ling", store: authStore });
  if (antLingKey) {
    providers["ant-ling"] = { ...buildAntLingProvider(), apiKey: antLingKey };
  }

  const longcatKey =
    resolveEnvApiKeyVarName("meituan-longcat") ??
    resolveApiKeyFromProfiles({ provider: "meituan-longcat", store: authStore });
  if (longcatKey) {
    providers["meituan-longcat"] = { ...buildMeituanLongcatProvider(), apiKey: longcatKey };
  }

  const cloudflareProfiles = listProfilesForProvider(authStore, "cloudflare-ai-gateway");
  for (const profileId of cloudflareProfiles) {
    const cred = authStore.profiles[profileId];
    if (cred?.type !== "api_key") {
      continue;
    }
    const accountId = cred.metadata?.accountId?.trim();
    const gatewayId = cred.metadata?.gatewayId?.trim();
    if (!accountId || !gatewayId) {
      continue;
    }
    const baseUrl = resolveCloudflareAiGatewayBaseUrl({ accountId, gatewayId });
    if (!baseUrl) {
      continue;
    }
    const apiKey = resolveEnvApiKeyVarName("cloudflare-ai-gateway") ?? cred.key?.trim() ?? "";
    if (!apiKey) {
      continue;
    }
    providers["cloudflare-ai-gateway"] = {
      baseUrl,
      api: "anthropic-messages",
      apiKey,
      models: [buildCloudflareAiGatewayModelDefinition()],
    };
    break;
  }

  // Ollama provider - only add if explicitly configured.
  const ollamaKey =
    resolveEnvApiKeyVarName("ollama") ??
    resolveApiKeyFromProfiles({ provider: "ollama", store: authStore });
  if (ollamaKey) {
    const ollamaBaseUrl = params.explicitProviders?.ollama?.baseUrl;
    providers.ollama = { ...(await buildOllamaProvider(ollamaBaseUrl)), apiKey: ollamaKey };
  }

  // vLLM provider - OpenAI-compatible local server (opt-in via env/profile).
  if (!params.explicitProviders?.vllm) {
    const vllmEnvVar = resolveEnvApiKeyVarName("vllm");
    const vllmProfileKey = resolveApiKeyFromProfiles({ provider: "vllm", store: authStore });
    const vllmKey = vllmEnvVar ?? vllmProfileKey;
    if (vllmKey) {
      const discoveryApiKey = vllmEnvVar
        ? (process.env[vllmEnvVar]?.trim() ?? "")
        : (vllmProfileKey ?? "");
      providers.vllm = {
        ...(await buildVllmProvider({ apiKey: discoveryApiKey || undefined })),
        apiKey: vllmKey,
      };
    }
  }

  const togetherKey =
    resolveEnvApiKeyVarName("together") ??
    resolveApiKeyFromProfiles({ provider: "together", store: authStore });
  if (togetherKey) {
    providers.together = {
      ...buildTogetherProvider(),
      apiKey: togetherKey,
    };
  }

  const huggingfaceKey =
    resolveEnvApiKeyVarName("huggingface") ??
    resolveApiKeyFromProfiles({ provider: "huggingface", store: authStore });
  if (huggingfaceKey) {
    const hfProvider = await buildHuggingfaceProvider(huggingfaceKey);
    providers.huggingface = {
      ...hfProvider,
      apiKey: huggingfaceKey,
    };
  }

  const qianfanKey =
    resolveEnvApiKeyVarName("qianfan") ??
    resolveApiKeyFromProfiles({ provider: "qianfan", store: authStore });
  if (qianfanKey) {
    providers.qianfan = { ...buildQianfanProvider(), apiKey: qianfanKey };
  }

  const nvidiaKey =
    resolveEnvApiKeyVarName("nvidia") ??
    resolveApiKeyFromProfiles({ provider: "nvidia", store: authStore });
  if (nvidiaKey) {
    providers.nvidia = { ...buildNvidiaProvider(), apiKey: nvidiaKey };
  }

  // ============================================================================
  // 国产大模型自动发现 (China Domestic LLM Auto-Discovery)
  // ============================================================================

  // 通义千问 Qwen (阿里云 DashScope / 百炼)
  const qwenDashscopeKey =
    resolveEnvApiKeyVarName("qwen-dashscope") ??
    resolveEnvApiKeyVarName("dashscope") ??
    resolveEnvApiKeyVarName("qwen") ??
    resolveEnvApiKeyVarName("aliyun-bailian") ??
    resolveApiKeyFromProfiles({ provider: "qwen-dashscope", store: authStore }) ??
    resolveApiKeyFromProfiles({ provider: "dashscope", store: authStore }) ??
    resolveApiKeyFromProfiles({ provider: "qwen", store: authStore }) ??
    resolveApiKeyFromProfiles({ provider: "aliyun-bailian", store: authStore });
  if (qwenDashscopeKey) {
    const qwenProvider = { ...buildQwenDashscopeProvider(), apiKey: qwenDashscopeKey };
    providers["qwen-dashscope"] = qwenProvider;
    providers["aliyun-bailian"] = qwenProvider;
  }

  // 豆包 Doubao (字节跳动火山引擎)
  const doubaoKey =
    resolveEnvApiKeyVarName("doubao") ??
    resolveEnvApiKeyVarName("ark") ??
    resolveApiKeyFromProfiles({ provider: "volcengine-ark", store: authStore }) ??
    resolveApiKeyFromProfiles({ provider: "doubao", store: authStore }) ??
    resolveApiKeyFromProfiles({ provider: "ark", store: authStore });
  if (doubaoKey) {
    const doubaoProvider = { ...buildDoubaoProvider(), apiKey: doubaoKey };
    providers.doubao = doubaoProvider;
    providers["volcengine-ark"] = doubaoProvider;
  }

  // DeepSeek
  const deepseekKey =
    resolveEnvApiKeyVarName("deepseek") ??
    resolveApiKeyFromProfiles({ provider: "deepseek", store: authStore });
  if (deepseekKey) {
    providers.deepseek = { ...buildDeepSeekProvider(), apiKey: deepseekKey };
  }

  // 智谱 GLM
  const glmKey =
    resolveEnvApiKeyVarName("glm") ??
    resolveEnvApiKeyVarName("zhipu") ??
    resolveApiKeyFromProfiles({ provider: "glm", store: authStore }) ??
    resolveApiKeyFromProfiles({ provider: "zhipu", store: authStore });
  if (glmKey) {
    providers.glm = { ...buildGLMProvider(), apiKey: glmKey };
  }

  // 硅基流动 SiliconFlow
  const siliconflowKey =
    resolveEnvApiKeyVarName("siliconflow") ??
    resolveApiKeyFromProfiles({ provider: "siliconflow", store: authStore });
  if (siliconflowKey) {
    providers.siliconflow = {
      ...(await buildSiliconFlowProvider(siliconflowKey)),
      apiKey: siliconflowKey,
    };
  }

  // 腾讯混元 Tencent Hunyuan
  const hunyuanKey =
    resolveEnvApiKeyVarName("tencent-hunyuan") ??
    resolveApiKeyFromProfiles({ provider: "tencent-hunyuan", store: authStore });
  if (hunyuanKey) {
    providers["tencent-hunyuan"] = { ...buildTencentHunyuanProvider(), apiKey: hunyuanKey };
  }

  return providers;
}

export async function resolveImplicitCopilotProvider(params: {
  agentDir: string;
  env?: NodeJS.ProcessEnv;
}): Promise<ProviderConfig | null> {
  const env = params.env ?? process.env;
  const authStore = ensureAuthProfileStore(params.agentDir, {
    allowKeychainPrompt: false,
  });
  const hasProfile = listProfilesForProvider(authStore, "github-copilot").length > 0;
  const envToken = env.COPILOT_GITHUB_TOKEN ?? env.GH_TOKEN ?? env.GITHUB_TOKEN;
  const githubToken = (envToken ?? "").trim();

  if (!hasProfile && !githubToken) {
    return null;
  }

  let selectedGithubToken = githubToken;
  if (!selectedGithubToken && hasProfile) {
    const profileId = listProfilesForProvider(authStore, "github-copilot")[0];
    const profile = profileId ? authStore.profiles[profileId] : undefined;
    if (profile && profile.type === "token") {
      selectedGithubToken = profile.token;
    }
  }

  let baseUrl = DEFAULT_COPILOT_API_BASE_URL;
  if (selectedGithubToken) {
    try {
      const token = await resolveCopilotApiToken({
        githubToken: selectedGithubToken,
        env,
      });
      baseUrl = token.baseUrl;
    } catch {
      baseUrl = DEFAULT_COPILOT_API_BASE_URL;
    }
  }

  // pi-coding-agent's ModelRegistry marks a model "available" only if its
  // `AuthStorage` has auth configured for that provider (via auth.json/env/etc).
  // Our Copilot auth lives in OpenClawCN's auth-profiles store instead, so we also
  // write a runtime-only auth.json entry for pi-coding-agent to pick up.
  //
  // This is safe because it's (1) within OpenClawCN's agent dir, (2) contains the
  // GitHub token (not the exchanged Copilot token), and (3) matches existing
  // patterns for OAuth-like providers in pi-coding-agent.
  // Note: we deliberately do not write pi-coding-agent's `auth.json` here.
  // OpenClawCN uses its own auth store and exchanges tokens at runtime.
  // `models list` uses OpenClawCN's auth heuristics for availability.

  // We intentionally do NOT define custom models for Copilot in models.json.
  // pi-coding-agent treats providers with models as replacements requiring apiKey.
  // We only override baseUrl; the model list comes from pi-ai built-ins.
  return {
    baseUrl,
    models: [],
  } satisfies ProviderConfig;
}

export async function resolveImplicitBedrockProvider(params: {
  agentDir: string;
  config?: OpenClawCNConfig;
  env?: NodeJS.ProcessEnv;
}): Promise<ProviderConfig | null> {
  const env = params.env ?? process.env;
  const discoveryConfig = params.config?.models?.bedrockDiscovery;
  const enabled = discoveryConfig?.enabled;
  const hasAwsCreds = resolveAwsSdkEnvVarName(env) !== undefined;
  if (enabled === false) {
    return null;
  }
  if (enabled !== true && !hasAwsCreds) {
    return null;
  }

  const region = discoveryConfig?.region ?? env.AWS_REGION ?? env.AWS_DEFAULT_REGION ?? "us-east-1";
  const models = await discoverBedrockModels({
    region,
    config: discoveryConfig,
  });
  if (models.length === 0) {
    return null;
  }

  return {
    baseUrl: `https://bedrock-runtime.${region}.amazonaws.com`,
    api: "bedrock-converse-stream",
    auth: "aws-sdk",
    models,
  } satisfies ProviderConfig;
}
