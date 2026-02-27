import type { ModelDefinitionConfig } from "../config/types.js";
import { QIANFAN_BASE_URL, QIANFAN_DEFAULT_MODEL_ID } from "../agents/models-config.providers.js";

export const DEFAULT_MINIMAX_BASE_URL = "https://api.minimax.io/v1";
export const MINIMAX_API_BASE_URL = "https://api.minimax.io/anthropic";
export const MINIMAX_CN_API_BASE_URL = "https://api.minimaxi.com/anthropic";
export const MINIMAX_HOSTED_MODEL_ID = "MiniMax-M2.1";
export const MINIMAX_HOSTED_MODEL_REF = `minimax/${MINIMAX_HOSTED_MODEL_ID}`;
export const DEFAULT_MINIMAX_CONTEXT_WINDOW = 200000;
export const DEFAULT_MINIMAX_MAX_TOKENS = 8192;

export const MOONSHOT_BASE_URL = "https://api.moonshot.ai/v1";
export const MOONSHOT_CN_BASE_URL = "https://api.moonshot.cn/v1";
export const MOONSHOT_DEFAULT_MODEL_ID = "kimi-k2.5";
export const MOONSHOT_DEFAULT_MODEL_REF = `moonshot/${MOONSHOT_DEFAULT_MODEL_ID}`;
export const MOONSHOT_DEFAULT_CONTEXT_WINDOW = 256000;
export const MOONSHOT_DEFAULT_MAX_TOKENS = 8192;
// 🔥 P0 修复: 必须与 buildKimiCodeProvider() 注册的 model ID 一致 (models-config.providers.ts)
// 之前是 "k2p5"，但 runtime 只注册了 "kimi-for-coding"，导致 setup 后 chat 找不到模型
export const KIMI_CODING_MODEL_ID = "kimi-for-coding";
export const KIMI_CODING_MODEL_REF = `kimi-coding/${KIMI_CODING_MODEL_ID}`;

export { QIANFAN_BASE_URL, QIANFAN_DEFAULT_MODEL_ID };
export const QIANFAN_DEFAULT_MODEL_REF = `qianfan/${QIANFAN_DEFAULT_MODEL_ID}`;

export const ZAI_CODING_GLOBAL_BASE_URL = "https://api.z.ai/api/coding/paas/v4";
export const ZAI_CODING_CN_BASE_URL = "https://open.bigmodel.cn/api/coding/paas/v4";
export const ZAI_GLOBAL_BASE_URL = "https://api.z.ai/api/paas/v4";
export const ZAI_CN_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
export const ZAI_DEFAULT_MODEL_ID = "glm-5";

export function resolveZaiBaseUrl(endpoint?: string): string {
  switch (endpoint) {
    case "coding-cn":
      return ZAI_CODING_CN_BASE_URL;
    case "global":
      return ZAI_GLOBAL_BASE_URL;
    case "cn":
      return ZAI_CN_BASE_URL;
    case "coding-global":
      return ZAI_CODING_GLOBAL_BASE_URL;
    default:
      return ZAI_GLOBAL_BASE_URL;
  }
}

// Pricing: MiniMax doesn't publish public rates. Override in models.json for accurate costs.
export const MINIMAX_API_COST = {
  input: 15,
  output: 60,
  cacheRead: 2,
  cacheWrite: 10,
};
export const MINIMAX_HOSTED_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};
export const MINIMAX_LM_STUDIO_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};
export const MOONSHOT_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const ZAI_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const MINIMAX_MODEL_CATALOG = {
  "MiniMax-M2.1": { name: "MiniMax M2.1", reasoning: false },
  "MiniMax-M2.1-lightning": {
    name: "MiniMax M2.1 Lightning",
    reasoning: false,
  },
  "MiniMax-M2.5": { name: "MiniMax M2.5", reasoning: true },
  "MiniMax-M2.5-Lightning": { name: "MiniMax M2.5 Lightning", reasoning: true },
} as const;

type MinimaxCatalogId = keyof typeof MINIMAX_MODEL_CATALOG;

const ZAI_MODEL_CATALOG = {
  "glm-5": { name: "GLM-5", reasoning: true },
  "glm-4.7": { name: "GLM-4.7", reasoning: true },
  "glm-4.7-flash": { name: "GLM-4.7 Flash", reasoning: true },
  "glm-4.7-flashx": { name: "GLM-4.7 FlashX", reasoning: true },
} as const;

type ZaiCatalogId = keyof typeof ZAI_MODEL_CATALOG;

export function buildMinimaxModelDefinition(params: {
  id: string;
  name?: string;
  reasoning?: boolean;
  cost: ModelDefinitionConfig["cost"];
  contextWindow: number;
  maxTokens: number;
}): ModelDefinitionConfig {
  const catalog = MINIMAX_MODEL_CATALOG[params.id as MinimaxCatalogId];
  return {
    id: params.id,
    name: params.name ?? catalog?.name ?? `MiniMax ${params.id}`,
    reasoning: params.reasoning ?? catalog?.reasoning ?? false,
    input: ["text"],
    cost: params.cost,
    contextWindow: params.contextWindow,
    maxTokens: params.maxTokens,
  };
}

export function buildMinimaxApiModelDefinition(modelId: string): ModelDefinitionConfig {
  return buildMinimaxModelDefinition({
    id: modelId,
    cost: MINIMAX_API_COST,
    contextWindow: DEFAULT_MINIMAX_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MINIMAX_MAX_TOKENS,
  });
}

export function buildMoonshotModelDefinition(): ModelDefinitionConfig {
  return {
    id: MOONSHOT_DEFAULT_MODEL_ID,
    name: "Kimi K2.5",
    reasoning: false,
    input: ["text"],
    cost: MOONSHOT_DEFAULT_COST,
    contextWindow: MOONSHOT_DEFAULT_CONTEXT_WINDOW,
    maxTokens: MOONSHOT_DEFAULT_MAX_TOKENS,
  };
}

export function buildZaiModelDefinition(params: {
  id: string;
  name?: string;
  reasoning?: boolean;
  cost?: ModelDefinitionConfig["cost"];
  contextWindow?: number;
  maxTokens?: number;
}): ModelDefinitionConfig {
  const catalog = ZAI_MODEL_CATALOG[params.id as ZaiCatalogId];
  return {
    id: params.id,
    name: params.name ?? catalog?.name ?? `GLM ${params.id}`,
    reasoning: params.reasoning ?? catalog?.reasoning ?? true,
    input: ["text"],
    cost: params.cost ?? ZAI_DEFAULT_COST,
    contextWindow: params.contextWindow ?? 204800,
    maxTokens: params.maxTokens ?? 131072,
  };
}

// ============================================================================
// Coding Plan Providers
// ============================================================================

export const ALIYUN_CODEPLAN_BASE_URL = "https://coding.dashscope.aliyuncs.com/v1";
export const ALIYUN_CODEPLAN_DEFAULT_MODEL_ID = "qwen3-coder-plus";
export const ALIYUN_CODEPLAN_MODEL_REF = `aliyun-codeplan/${ALIYUN_CODEPLAN_DEFAULT_MODEL_ID}`;
export const ALIYUN_CODEPLAN_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const GLM_CODEPLAN_BASE_URL = "https://open.bigmodel.cn/api/coding/paas/v4";
export const GLM_CODEPLAN_DEFAULT_MODEL_ID = "glm-4.7";
export const GLM_CODEPLAN_MODEL_REF = `glm-codeplan/${GLM_CODEPLAN_DEFAULT_MODEL_ID}`;
export const GLM_CODEPLAN_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const MINIMAX_CODEPLAN_BASE_URL = "https://api.minimaxi.com/anthropic";
export const MINIMAX_CODEPLAN_DEFAULT_MODEL_ID = "MiniMax-M2.5";
export const MINIMAX_CODEPLAN_MODEL_REF = `minimax-codeplan/${MINIMAX_CODEPLAN_DEFAULT_MODEL_ID}`;
export const MINIMAX_CODEPLAN_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const ALIYUN_CODEPLAN_MODEL_CATALOG = {
  "qwen3.5-plus": { name: "Qwen3.5 Plus", reasoning: true, vision: true },
  "kimi-k2.5": { name: "Kimi K2.5", reasoning: false, vision: true },
  "glm-5": { name: "GLM-5", reasoning: true, vision: false },
  "MiniMax-M2.5": { name: "MiniMax M2.5", reasoning: true, vision: false },
  "qwen3-coder-plus": { name: "Qwen3 Coder Plus", reasoning: true, vision: false },
  "qwen3-coder-next": { name: "Qwen3 Coder Next", reasoning: true, vision: false },
} as const;

type AliyunCodeplanCatalogId = keyof typeof ALIYUN_CODEPLAN_MODEL_CATALOG;

export function buildAliyunCodeplanModelDefinition(params?: {
  id?: string;
  name?: string;
  reasoning?: boolean;
  cost?: ModelDefinitionConfig["cost"];
  contextWindow?: number;
  maxTokens?: number;
}): ModelDefinitionConfig {
  const id = params?.id ?? ALIYUN_CODEPLAN_DEFAULT_MODEL_ID;
  const catalog = ALIYUN_CODEPLAN_MODEL_CATALOG[id as AliyunCodeplanCatalogId];
  return {
    id,
    name: params?.name ?? catalog?.name ?? id,
    reasoning: params?.reasoning ?? catalog?.reasoning ?? true,
    input: catalog?.vision ? (["text", "image"] as const) : (["text"] as const),
    cost: params?.cost ?? ALIYUN_CODEPLAN_DEFAULT_COST,
    contextWindow: params?.contextWindow ?? 131072,
    maxTokens: params?.maxTokens ?? 8192,
  };
}

export function buildGlmCodeplanModelDefinition(params?: {
  id?: string;
  name?: string;
  reasoning?: boolean;
  cost?: ModelDefinitionConfig["cost"];
  contextWindow?: number;
  maxTokens?: number;
}): ModelDefinitionConfig {
  const id = params?.id ?? GLM_CODEPLAN_DEFAULT_MODEL_ID;
  const catalog = ZAI_MODEL_CATALOG[id as ZaiCatalogId];
  return {
    id,
    name: params?.name ?? catalog?.name ?? `GLM ${id}`,
    reasoning: params?.reasoning ?? catalog?.reasoning ?? true,
    input: ["text"],
    cost: params?.cost ?? GLM_CODEPLAN_DEFAULT_COST,
    contextWindow: params?.contextWindow ?? 204800,
    maxTokens: params?.maxTokens ?? 131072,
  };
}

export function buildMinimaxCodeplanModelDefinition(params?: {
  id?: string;
  name?: string;
  reasoning?: boolean;
  cost?: ModelDefinitionConfig["cost"];
  contextWindow?: number;
  maxTokens?: number;
}): ModelDefinitionConfig {
  const id = params?.id ?? MINIMAX_CODEPLAN_DEFAULT_MODEL_ID;
  return {
    id,
    name: params?.name ?? "MiniMax M2.5",
    reasoning: params?.reasoning ?? true,
    input: ["text"],
    cost: params?.cost ?? MINIMAX_CODEPLAN_DEFAULT_COST,
    contextWindow: params?.contextWindow ?? 200000,
    maxTokens: params?.maxTokens ?? 8192,
  };
}

export const XAI_BASE_URL = "https://api.x.ai/v1";
export const XAI_DEFAULT_MODEL_ID = "grok-4";
export const XAI_DEFAULT_MODEL_REF = `xai/${XAI_DEFAULT_MODEL_ID}`;
export const XAI_DEFAULT_CONTEXT_WINDOW = 131072;
export const XAI_DEFAULT_MAX_TOKENS = 8192;
export const XAI_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export function buildXaiModelDefinition(): ModelDefinitionConfig {
  return {
    id: XAI_DEFAULT_MODEL_ID,
    name: "Grok 4",
    reasoning: false,
    input: ["text"],
    cost: XAI_DEFAULT_COST,
    contextWindow: XAI_DEFAULT_CONTEXT_WINDOW,
    maxTokens: XAI_DEFAULT_MAX_TOKENS,
  };
}
