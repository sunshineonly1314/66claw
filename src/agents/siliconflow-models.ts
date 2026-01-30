/**
 * 硅基流动 (SiliconFlow) 模型发现模块
 * SiliconFlow Model Discovery Module
 *
 * API 文档: https://docs.siliconflow.cn/cn/api-reference/models/get-model-list
 */

import type { ModelDefinitionConfig } from "../config/types.models.js";

// ============================================================================
// 常量定义 (Constants)
// ============================================================================

export const SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
export const SILICONFLOW_ENV_VAR = "SILICONFLOW_API_KEY";

// 默认模型配置
export const SILICONFLOW_DEFAULT_CONTEXT_WINDOW = 32000;
export const SILICONFLOW_DEFAULT_MAX_TOKENS = 4096;
export const SILICONFLOW_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

// ============================================================================
// 类型定义 (Types)
// ============================================================================

interface SiliconFlowModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface SiliconFlowModelsResponse {
  object: string;
  data: SiliconFlowModel[];
}

// 推荐的模型列表 (用于在无法获取在线列表时的默认值)
export const SILICONFLOW_RECOMMENDED_MODELS: ModelDefinitionConfig[] = [
  // DeepSeek 系列
  {
    id: "deepseek-ai/DeepSeek-V3",
    name: "DeepSeek V3",
    reasoning: false,
    input: ["text"],
    cost: SILICONFLOW_DEFAULT_COST,
    contextWindow: 64000,
    maxTokens: 8192,
  },
  {
    id: "Pro/deepseek-ai/DeepSeek-R1",
    name: "DeepSeek R1 (Pro)",
    reasoning: true,
    input: ["text"],
    cost: SILICONFLOW_DEFAULT_COST,
    contextWindow: 64000,
    maxTokens: 8192,
  },
  {
    id: "deepseek-ai/DeepSeek-R1",
    name: "DeepSeek R1",
    reasoning: true,
    input: ["text"],
    cost: SILICONFLOW_DEFAULT_COST,
    contextWindow: 64000,
    maxTokens: 8192,
  },
  {
    id: "deepseek-ai/DeepSeek-V2.5",
    name: "DeepSeek V2.5",
    reasoning: false,
    input: ["text"],
    cost: SILICONFLOW_DEFAULT_COST,
    contextWindow: 64000,
    maxTokens: 8192,
  },
  // Qwen 系列
  {
    id: "Qwen/Qwen2.5-72B-Instruct",
    name: "Qwen 2.5 72B",
    reasoning: false,
    input: ["text"],
    cost: SILICONFLOW_DEFAULT_COST,
    contextWindow: 131072,
    maxTokens: 8192,
  },
  {
    id: "Qwen/Qwen2.5-32B-Instruct",
    name: "Qwen 2.5 32B",
    reasoning: false,
    input: ["text"],
    cost: SILICONFLOW_DEFAULT_COST,
    contextWindow: 131072,
    maxTokens: 8192,
  },
  {
    id: "Qwen/Qwen2.5-Coder-32B-Instruct",
    name: "Qwen 2.5 Coder 32B",
    reasoning: false,
    input: ["text"],
    cost: SILICONFLOW_DEFAULT_COST,
    contextWindow: 131072,
    maxTokens: 8192,
  },
  {
    id: "Qwen/Qwen2.5-14B-Instruct",
    name: "Qwen 2.5 14B",
    reasoning: false,
    input: ["text"],
    cost: SILICONFLOW_DEFAULT_COST,
    contextWindow: 131072,
    maxTokens: 8192,
  },
  {
    id: "Qwen/Qwen2.5-7B-Instruct",
    name: "Qwen 2.5 7B (免费)",
    reasoning: false,
    input: ["text"],
    cost: SILICONFLOW_DEFAULT_COST,
    contextWindow: 131072,
    maxTokens: 8192,
  },
  {
    id: "Qwen/QVQ-72B-Preview",
    name: "Qwen QVQ 72B (视觉推理)",
    reasoning: true,
    input: ["text", "image"],
    cost: SILICONFLOW_DEFAULT_COST,
    contextWindow: 32000,
    maxTokens: 8192,
  },
  // GLM 系列
  {
    id: "THUDM/GLM-4-9B-0414",
    name: "GLM-4 9B",
    reasoning: false,
    input: ["text"],
    cost: SILICONFLOW_DEFAULT_COST,
    contextWindow: 128000,
    maxTokens: 4096,
  },
  // InternLM 系列
  {
    id: "internlm/internlm2_5-20b-chat",
    name: "InternLM 2.5 20B",
    reasoning: false,
    input: ["text"],
    cost: SILICONFLOW_DEFAULT_COST,
    contextWindow: 32000,
    maxTokens: 4096,
  },
  // Yi 系列
  {
    id: "01-ai/Yi-1.5-34B-Chat-16K",
    name: "Yi 1.5 34B",
    reasoning: false,
    input: ["text"],
    cost: SILICONFLOW_DEFAULT_COST,
    contextWindow: 16000,
    maxTokens: 4096,
  },
];

// ============================================================================
// 模型发现函数 (Model Discovery Functions)
// ============================================================================

/**
 * 从 SiliconFlow API 获取可用模型列表
 * @param apiKey API Key
 * @returns 模型配置列表
 */
export async function discoverSiliconFlowModels(
  apiKey?: string,
): Promise<ModelDefinitionConfig[]> {
  // 如果没有 API Key，返回推荐模型列表
  if (!apiKey?.trim()) {
    return SILICONFLOW_RECOMMENDED_MODELS;
  }

  // 在测试环境下跳过
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return SILICONFLOW_RECOMMENDED_MODELS;
  }

  try {
    const response = await fetch(`${SILICONFLOW_BASE_URL}/models?type=text&sub_type=chat`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`Failed to discover SiliconFlow models: ${response.status}`);
      return SILICONFLOW_RECOMMENDED_MODELS;
    }

    const data = (await response.json()) as SiliconFlowModelsResponse;
    if (!data.data || data.data.length === 0) {
      return SILICONFLOW_RECOMMENDED_MODELS;
    }

    // 转换为 ModelDefinitionConfig 格式
    const models: ModelDefinitionConfig[] = data.data
      .filter((model) => {
        // 过滤掉非对话模型 (embedding, reranker 等)
        const id = model.id.toLowerCase();
        return (
          !id.includes("embedding") &&
          !id.includes("rerank") &&
          !id.includes("whisper") &&
          !id.includes("stable-diffusion") &&
          !id.includes("flux") &&
          !id.includes("sensevoice")
        );
      })
      .map((model) => {
        const modelId = model.id;
        const isReasoning =
          modelId.toLowerCase().includes("r1") ||
          modelId.toLowerCase().includes("qvq") ||
          modelId.toLowerCase().includes("reasoning");
        const isVision =
          modelId.toLowerCase().includes("vl") ||
          modelId.toLowerCase().includes("vision") ||
          modelId.toLowerCase().includes("qvq");

        // 根据模型名称推断参数
        let contextWindow = SILICONFLOW_DEFAULT_CONTEXT_WINDOW;
        let maxTokens = SILICONFLOW_DEFAULT_MAX_TOKENS;

        if (modelId.includes("Qwen")) {
          contextWindow = 131072;
          maxTokens = 8192;
        } else if (modelId.includes("DeepSeek")) {
          contextWindow = 64000;
          maxTokens = 8192;
        } else if (modelId.includes("GLM")) {
          contextWindow = 128000;
          maxTokens = 4096;
        }

        return {
          id: modelId,
          name: formatModelDisplayName(modelId),
          reasoning: isReasoning,
          input: isVision ? (["text", "image"] as const) : (["text"] as const),
          cost: SILICONFLOW_DEFAULT_COST,
          contextWindow,
          maxTokens,
        };
      });

    // 按优先级排序: Pro > DeepSeek > Qwen > 其他
    return models.sort((a, b) => {
      const getPriority = (id: string) => {
        if (id.startsWith("Pro/")) return 0;
        if (id.includes("DeepSeek-V3")) return 1;
        if (id.includes("DeepSeek-R1")) return 2;
        if (id.includes("DeepSeek")) return 3;
        if (id.includes("Qwen2.5-72B")) return 4;
        if (id.includes("Qwen")) return 5;
        if (id.includes("GLM")) return 6;
        return 10;
      };
      return getPriority(a.id) - getPriority(b.id);
    });
  } catch (error) {
    console.warn(`Failed to discover SiliconFlow models: ${String(error)}`);
    return SILICONFLOW_RECOMMENDED_MODELS;
  }
}

/**
 * 格式化模型显示名称
 */
function formatModelDisplayName(modelId: string): string {
  // 移除前缀如 "Pro/"
  let name = modelId.replace(/^Pro\//, "(Pro) ");

  // 移除组织前缀
  name = name.replace(/^[^/]+\//, "");

  // 格式化常见名称
  name = name
    .replace(/-Instruct$/, "")
    .replace(/-Chat$/, "")
    .replace(/-Preview$/, " (Preview)")
    .replace(/_/g, " ");

  return name;
}

/**
 * 获取推荐的默认模型
 */
export function getSiliconFlowDefaultModel(): string {
  return "deepseek-ai/DeepSeek-V3";
}

/**
 * 获取推荐的免费模型
 */
export function getSiliconFlowFreeModels(): string[] {
  return [
    "Qwen/Qwen2.5-7B-Instruct",
    "THUDM/GLM-4-9B-0414",
    "internlm/internlm2_5-7b-chat",
  ];
}
