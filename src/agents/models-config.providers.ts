import type { ClawdbotConfig } from "../config/config.js";
import type { ModelDefinitionConfig } from "../config/types.models.js";
import {
  DEFAULT_COPILOT_API_BASE_URL,
  resolveCopilotApiToken,
} from "../providers/github-copilot-token.js";
import { ensureAuthProfileStore, listProfilesForProvider } from "./auth-profiles.js";
import { resolveAwsSdkEnvVarName, resolveEnvApiKey } from "./model-auth.js";
import { discoverBedrockModels } from "./bedrock-discovery.js";
import {
  buildSyntheticModelDefinition,
  SYNTHETIC_BASE_URL,
  SYNTHETIC_MODEL_CATALOG,
} from "./synthetic-models.js";
import { discoverVeniceModels, VENICE_BASE_URL } from "./venice-models.js";
import {
  discoverSiliconFlowModels,
  SILICONFLOW_BASE_URL,
  SILICONFLOW_RECOMMENDED_MODELS,
} from "./siliconflow-models.js";

type ModelsConfig = NonNullable<ClawdbotConfig["models"]>;
export type ProviderConfig = NonNullable<ModelsConfig["providers"]>[string];

const MINIMAX_API_BASE_URL = "https://api.minimaxi.com/anthropic";
const MINIMAX_DEFAULT_MODEL_ID = "MiniMax-M2.1";
const MINIMAX_DEFAULT_VISION_MODEL_ID = "MiniMax-VL-01";
const MINIMAX_DEFAULT_CONTEXT_WINDOW = 200000;
const MINIMAX_DEFAULT_MAX_TOKENS = 8192;
// Pricing: MiniMax doesn't publish public rates. Override in models.json for accurate costs.
const MINIMAX_API_COST = {
  input: 15,
  output: 60,
  cacheRead: 2,
  cacheWrite: 10,
};

const MOONSHOT_BASE_URL = "https://api.moonshot.cn/v1";
const MOONSHOT_DEFAULT_MODEL_ID = "kimi-latest";
const MOONSHOT_DEFAULT_CONTEXT_WINDOW = 128000;
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

const OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1";
const OLLAMA_API_BASE_URL = "http://127.0.0.1:11434";
const OLLAMA_DEFAULT_CONTEXT_WINDOW = 128000;
const OLLAMA_DEFAULT_MAX_TOKENS = 8192;
const OLLAMA_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

// ============================================================================
// 国产大模型配置 (China Domestic LLM Providers)
// ============================================================================

// 通义千问 Qwen (阿里云 DashScope)
// API 文档: https://help.aliyun.com/zh/model-studio/developer-reference/compatibility-of-openai-with-dashscope
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
// API 文档: https://www.volcengine.com/docs/82379/1298454
const DOUBAO_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const DOUBAO_DEFAULT_CONTEXT_WINDOW = 32000;
const DOUBAO_DEFAULT_MAX_TOKENS = 4096;
const DOUBAO_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

// DeepSeek
// API 文档: https://platform.deepseek.com/api-docs/
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_DEFAULT_CONTEXT_WINDOW = 64000;
const DEEPSEEK_DEFAULT_MAX_TOKENS = 8192;
const DEEPSEEK_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

// 智谱 GLM (智谱AI)
// API 文档: https://open.bigmodel.cn/dev/api/normal-model/glm-4
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

async function discoverOllamaModels(): Promise<ModelDefinitionConfig[]> {
  // Skip Ollama discovery in test environments
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return [];
  }
  try {
    const response = await fetch(`${OLLAMA_API_BASE_URL}/api/tags`, {
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

function normalizeApiKeyConfig(value: string): string {
  const trimmed = value.trim();
  const match = /^\$\{([A-Z0-9_]+)\}$/.exec(trimmed);
  return match?.[1] ?? trimmed;
}

function resolveEnvApiKeyVarName(provider: string): string | undefined {
  const resolved = resolveEnvApiKey(provider);
  if (!resolved) return undefined;
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
    if (!cred) continue;
    if (cred.type === "api_key") return cred.key;
    if (cred.type === "token") return cred.token;
  }
  return undefined;
}

export function normalizeGoogleModelId(id: string): string {
  if (id === "gemini-3-pro") return "gemini-3-pro-preview";
  if (id === "gemini-3-flash") return "gemini-3-flash-preview";
  return id;
}

function normalizeGoogleProvider(provider: ProviderConfig): ProviderConfig {
  let mutated = false;
  const models = provider.models.map((model) => {
    const nextId = normalizeGoogleModelId(model.id);
    if (nextId === model.id) return model;
    mutated = true;
    return { ...model, id: nextId };
  });
  return mutated ? { ...provider, models } : provider;
}

export function normalizeProviders(params: {
  providers: ModelsConfig["providers"];
  agentDir: string;
}): ModelsConfig["providers"] {
  const { providers } = params;
  if (!providers) return providers;
  const authStore = ensureAuthProfileStore(params.agentDir, {
    allowKeychainPrompt: false,
  });
  let mutated = false;
  const next: Record<string, ProviderConfig> = {};

  for (const [key, provider] of Object.entries(providers)) {
    const normalizedKey = key.trim();
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
      if (googleNormalized !== normalizedProvider) mutated = true;
      normalizedProvider = googleNormalized;
    }

    next[key] = normalizedProvider;
  }

  return mutated ? next : providers;
}

function buildMinimaxProvider(): ProviderConfig {
  return {
    baseUrl: MINIMAX_API_BASE_URL,
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
        id: MINIMAX_DEFAULT_VISION_MODEL_ID,
        name: "MiniMax VL 01",
        reasoning: false,
        input: ["text", "image"],
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
      // kimi-latest - 最新推荐，自动选择上下文长度
      {
        id: "kimi-latest",
        name: "Kimi Latest (推荐)",
        reasoning: false,
        input: ["text", "image"],
        cost: MOONSHOT_DEFAULT_COST,
        contextWindow: 128000,
        maxTokens: 8192,
      },
      // kimi-k2 系列 - 超强代码和 Agent 能力
      {
        id: "kimi-k2-turbo-preview",
        name: "Kimi K2 Turbo (推荐)",
        reasoning: false,
        input: ["text"],
        cost: MOONSHOT_DEFAULT_COST,
        contextWindow: 262144,
        maxTokens: 8192,
      },
      {
        id: "kimi-k2-0905-preview",
        name: "Kimi K2 0905",
        reasoning: false,
        input: ["text"],
        cost: MOONSHOT_DEFAULT_COST,
        contextWindow: 262144,
        maxTokens: 8192,
      },
      {
        id: "kimi-k2-0711-preview",
        name: "Kimi K2 0711",
        reasoning: false,
        input: ["text"],
        cost: MOONSHOT_DEFAULT_COST,
        contextWindow: 131072,
        maxTokens: 8192,
      },
      {
        id: "kimi-k2-thinking",
        name: "Kimi K2 Thinking (深度推理)",
        reasoning: true,
        input: ["text"],
        cost: MOONSHOT_DEFAULT_COST,
        contextWindow: 262144,
        maxTokens: 8192,
      },
      {
        id: "kimi-k2-thinking-turbo",
        name: "Kimi K2 Thinking Turbo",
        reasoning: true,
        input: ["text"],
        cost: MOONSHOT_DEFAULT_COST,
        contextWindow: 262144,
        maxTokens: 8192,
      },
      // moonshot-v1 系列 - 经典稳定版本
      {
        id: "moonshot-v1-8k",
        name: "Moonshot V1 8K",
        reasoning: false,
        input: ["text"],
        cost: MOONSHOT_DEFAULT_COST,
        contextWindow: 8000,
        maxTokens: 4096,
      },
      {
        id: "moonshot-v1-32k",
        name: "Moonshot V1 32K",
        reasoning: false,
        input: ["text"],
        cost: MOONSHOT_DEFAULT_COST,
        contextWindow: 32000,
        maxTokens: 8192,
      },
      {
        id: "moonshot-v1-128k",
        name: "Moonshot V1 128K",
        reasoning: false,
        input: ["text"],
        cost: MOONSHOT_DEFAULT_COST,
        contextWindow: 128000,
        maxTokens: 8192,
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

async function buildVeniceProvider(): Promise<ProviderConfig> {
  const models = await discoverVeniceModels();
  return {
    baseUrl: VENICE_BASE_URL,
    api: "openai-completions",
    models,
  };
}

async function buildOllamaProvider(): Promise<ProviderConfig> {
  const models = await discoverOllamaModels();
  return {
    baseUrl: OLLAMA_BASE_URL,
    api: "openai-completions",
    models,
  };
}

// ============================================================================
// 国产大模型构建函数 (China Domestic LLM Provider Builders)
// ============================================================================

/**
 * 通义千问 Qwen (阿里云 DashScope)
 * 支持模型: qwen-max, qwen-plus, qwen-turbo, qwen-long, qwen-vl-max, qwen-vl-plus
 * 环境变量: DASHSCOPE_API_KEY
 */
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

/**
 * 豆包 Doubao (字节跳动火山引擎)
 * 环境变量: DOUBAO_API_KEY 或 ARK_API_KEY
 * 注意：使用前需在火山方舟控制台「开通管理」页面开通模型
 * https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement
 * 模型 ID 参考: https://www.volcengine.com/docs/82379/1330310
 * 重要：模型 ID 必须使用完整格式，如 doubao-seed-1-8-251228（不能用 doubao-seed-1-8）
 */
function buildDoubaoProvider(): ProviderConfig {
  return {
    baseUrl: DOUBAO_BASE_URL,
    api: "openai-completions",
    models: [
      // 豆包 1.8 (最新推荐)
      {
        id: "doubao-seed-1-8-251228",
        name: "豆包 1.8",
        reasoning: true,
        input: ["text", "image", "video"],
        cost: { input: 0.004, output: 0.016, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 256000,
        maxTokens: 32768,
      },
      // 豆包 1.6 系列
      {
        id: "doubao-seed-1-6-251015",
        name: "豆包 1.6",
        reasoning: true,
        input: ["text", "image", "video"],
        cost: { input: 0.008, output: 0.02, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 256000,
        maxTokens: 32768,
      },
    ],
  };
}

/**
 * DeepSeek
 * 支持模型: deepseek-chat, deepseek-coder, deepseek-reasoner
 * 环境变量: DEEPSEEK_API_KEY
 */
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

/**
 * 智谱 GLM (智谱AI)
 * 支持模型: glm-4-plus, glm-4, glm-4-air, glm-4-flash, glm-4v-plus, glm-4v
 * 环境变量: ZHIPU_API_KEY 或 GLM_API_KEY
 */
/**
 * 硅基流动 SiliconFlow
 * 支持模型: DeepSeek-V3, DeepSeek-R1, Qwen2.5-72B, GLM-4 等
 * 环境变量: SILICONFLOW_API_KEY
 * API 文档: https://docs.siliconflow.cn/cn/userguide/quickstart
 */
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

export async function resolveImplicitProviders(params: {
  agentDir: string;
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

  // Ollama provider - only add if explicitly configured
  const ollamaKey =
    resolveEnvApiKeyVarName("ollama") ??
    resolveApiKeyFromProfiles({ provider: "ollama", store: authStore });
  if (ollamaKey) {
    providers.ollama = { ...(await buildOllamaProvider()), apiKey: ollamaKey };
  }

  // ============================================================================
  // 国产大模型自动发现 (China Domestic LLM Auto-Discovery)
  // ============================================================================

  // 通义千问 Qwen (阿里云 DashScope / 百炼)
  // 环境变量: DASHSCOPE_API_KEY 或 QWEN_API_KEY
  // 提供商别名: qwen-dashscope, dashscope, qwen, aliyun-bailian
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
    // 同时注册为 aliyun-bailian，支持中国区配置向导使用的名称
    providers["aliyun-bailian"] = qwenProvider;
  }

  // 豆包 Doubao (字节跳动火山引擎)
  // 环境变量: DOUBAO_API_KEY 或 ARK_API_KEY；向导 profile: volcengine-ark:default 或 doubao/ark
  const doubaoKey =
    resolveEnvApiKeyVarName("doubao") ??
    resolveEnvApiKeyVarName("ark") ??
    resolveApiKeyFromProfiles({ provider: "volcengine-ark", store: authStore }) ??
    resolveApiKeyFromProfiles({ provider: "doubao", store: authStore }) ??
    resolveApiKeyFromProfiles({ provider: "ark", store: authStore });
  if (doubaoKey) {
    const doubaoProvider = { ...buildDoubaoProvider(), apiKey: doubaoKey };
    providers.doubao = doubaoProvider;
    // 同时注册为 volcengine-ark，与向导/中国区 UI 的 provider 名称一致
    providers["volcengine-ark"] = doubaoProvider;
  }

  // DeepSeek
  // 环境变量: DEEPSEEK_API_KEY
  const deepseekKey =
    resolveEnvApiKeyVarName("deepseek") ??
    resolveApiKeyFromProfiles({ provider: "deepseek", store: authStore });
  if (deepseekKey) {
    providers.deepseek = { ...buildDeepSeekProvider(), apiKey: deepseekKey };
  }

  // 智谱 GLM
  // 环境变量: ZHIPU_API_KEY 或 GLM_API_KEY
  const glmKey =
    resolveEnvApiKeyVarName("glm") ??
    resolveEnvApiKeyVarName("zhipu") ??
    resolveApiKeyFromProfiles({ provider: "glm", store: authStore }) ??
    resolveApiKeyFromProfiles({ provider: "zhipu", store: authStore });
  if (glmKey) {
    providers.glm = { ...buildGLMProvider(), apiKey: glmKey };
  }

  // 硅基流动 SiliconFlow
  // 环境变量: SILICONFLOW_API_KEY
  const siliconflowKey =
    resolveEnvApiKeyVarName("siliconflow") ??
    resolveApiKeyFromProfiles({ provider: "siliconflow", store: authStore });
  if (siliconflowKey) {
    providers.siliconflow = { ...(await buildSiliconFlowProvider(siliconflowKey)), apiKey: siliconflowKey };
  }

  return providers;
}

export async function resolveImplicitCopilotProvider(params: {
  agentDir: string;
  env?: NodeJS.ProcessEnv;
}): Promise<ProviderConfig | null> {
  const env = params.env ?? process.env;
  const authStore = ensureAuthProfileStore(params.agentDir, { allowKeychainPrompt: false });
  const hasProfile = listProfilesForProvider(authStore, "github-copilot").length > 0;
  const envToken = env.COPILOT_GITHUB_TOKEN ?? env.GH_TOKEN ?? env.GITHUB_TOKEN;
  const githubToken = (envToken ?? "").trim();

  if (!hasProfile && !githubToken) return null;

  let selectedGithubToken = githubToken;
  if (!selectedGithubToken && hasProfile) {
    // Use the first available profile as a default for discovery (it will be
    // re-resolved per-run by the embedded runner).
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
  // Our Copilot auth lives in Clawdbot's auth-profiles store instead, so we also
  // write a runtime-only auth.json entry for pi-coding-agent to pick up.
  //
  // This is safe because it's (1) within Clawdbot's agent dir, (2) contains the
  // GitHub token (not the exchanged Copilot token), and (3) matches existing
  // patterns for OAuth-like providers in pi-coding-agent.
  // Note: we deliberately do not write pi-coding-agent's `auth.json` here.
  // Clawdbot uses its own auth store and exchanges tokens at runtime.
  // `models list` uses Clawdbot's auth heuristics for availability.

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
  config?: ClawdbotConfig;
  env?: NodeJS.ProcessEnv;
}): Promise<ProviderConfig | null> {
  const env = params.env ?? process.env;
  const discoveryConfig = params.config?.models?.bedrockDiscovery;
  const enabled = discoveryConfig?.enabled;
  const hasAwsCreds = resolveAwsSdkEnvVarName(env) !== undefined;
  if (enabled === false) return null;
  if (enabled !== true && !hasAwsCreds) return null;

  const region = discoveryConfig?.region ?? env.AWS_REGION ?? env.AWS_DEFAULT_REGION ?? "us-east-1";
  const models = await discoverBedrockModels({ region, config: discoveryConfig });
  if (models.length === 0) return null;

  return {
    baseUrl: `https://bedrock-runtime.${region}.amazonaws.com`,
    api: "bedrock-converse-stream",
    auth: "aws-sdk",
    models,
  } satisfies ProviderConfig;
}
