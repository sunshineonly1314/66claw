/**
 * Modality Capability Checker — JIT configuration support.
 *
 * 检测用户是否配置了支持特定模态的模型（图片分析、图片生成、图像编辑、视频分析等）。
 * 如果没有配置，提供友好的引导信息帮助用户配置。
 */

import { loadModelCatalog, type ModelCatalogEntry } from "./model-catalog.js";
import type { OpenClawCNConfig } from "../config/config.js";

export type ModalityCapability =
  | "image-analysis"
  | "image-generation"
  | "image-editing"
  | "video-analysis";

export type CapabilityCheckResult = {
  /** 能力类型 */
  capability: ModalityCapability;
  /** 是否有至少一个支持该能力的模型 */
  hasCapability: boolean;
  /** 支持该能力的模型列表 */
  availableModels: Array<{
    id: string;
    name: string;
    provider: string;
  }>;
  /** 如果没有能力，推荐用户配置的提示信息 */
  suggestion?: string;
};

/**
 * 检测模型是否支持图片分析能力（vision）
 */
function supportsImageAnalysis(model: ModelCatalogEntry): boolean {
  return model.input?.includes("image") ?? false;
}

/**
 * 检测模型是否支持图像编辑能力（需要原图 + 编辑指令）
 * Qwen-Image-Edit, FLUX Kontext 等
 */
function supportsImageEditing(model: ModelCatalogEntry): boolean {
  const id = model.id.toLowerCase();

  // Qwen-Image-Edit / Qwen-Image-Edit-2509
  if (id.includes("qwen-image-edit") || id.includes("qwen/qwen-image-edit")) {
    return true;
  }

  // FLUX Kontext (Black Forest Labs — editing/context-aware generation)
  if (id.includes("kontext")) {
    return true;
  }

  return false;
}

/**
 * 检测模型是否支持图片生成能力（纯文生图，不含编辑模型）
 * 目前通过模型 ID 或 provider 判断（DALL-E, Stable Diffusion, 通义万相等）
 */
function supportsImageGeneration(model: ModelCatalogEntry): boolean {
  const id = model.id.toLowerCase();
  const provider = model.provider.toLowerCase();

  // Exclude editing models — they are a separate capability
  if (supportsImageEditing(model)) {
    return false;
  }

  // OpenAI DALL-E / GPT-Image
  if (id.includes("dall-e") || id.includes("gpt-image")) {
    return true;
  }

  // 阿里通义万相 (DashScope wanx / wan2)
  if (id.includes("wanx") || id.includes("wan-x") || id.includes("wan2") || id.includes("万相")) {
    return true;
  }

  // 百度文心一格
  if (provider.includes("baidu") || provider.includes("wenxin")) {
    if (id.includes("yige") || id.includes("一格") || id.includes("ernie-vilg")) {
      return true;
    }
  }

  // Qwen Image (SiliconFlow / DashScope) — text-to-image only (not Edit)
  if (id.includes("qwen-image") || id.includes("qwen/qwen-image")) {
    return true;
  }

  // Stable Diffusion
  if (id.includes("stable-diffusion") || id.startsWith("sd-") || id.includes("sdxl")) {
    return true;
  }

  // FLUX (Black Forest Labs) — non-Kontext variants
  if (id.includes("flux")) {
    return true;
  }

  // Kolors (Kwai)
  if (id.includes("kolors")) {
    return true;
  }

  // CogView (智谱)
  if (id.includes("cogview")) {
    return true;
  }

  // Midjourney / Playground
  if (id.includes("midjourney") || id.includes("playground")) {
    return true;
  }

  return false;
}

/**
 * 检测模型是否支持视频分析能力
 * 优先通过 input 字段中是否包含 "video" 判断（标准方式）
 */
function supportsVideoAnalysis(model: ModelCatalogEntry): boolean {
  const input = model.input as Array<string> | undefined;
  return input?.includes("video") ?? false;
}

const CAPABILITY_CHECKERS: Record<
  ModalityCapability,
  { checker: (model: ModelCatalogEntry) => boolean; label: string }
> = {
  "image-analysis": { checker: supportsImageAnalysis, label: "图片分析" },
  "image-generation": { checker: supportsImageGeneration, label: "图片生成" },
  "image-editing": { checker: supportsImageEditing, label: "图像编辑" },
  "video-analysis": { checker: supportsVideoAnalysis, label: "视频分析" },
};

function checkCapabilityFromCatalog(
  capability: ModalityCapability,
  catalog: ModelCatalogEntry[],
): CapabilityCheckResult {
  const entry = CAPABILITY_CHECKERS[capability];
  if (!entry) {
    throw new Error(`Unknown capability: ${capability}`);
  }

  const availableModels = catalog
    .filter(entry.checker)
    .map((m) => ({ id: m.id, name: m.name, provider: m.provider }));

  const hasCapability = availableModels.length > 0;

  return {
    capability,
    hasCapability,
    availableModels,
    suggestion: hasCapability
      ? undefined
      : `当前未配置支持${entry.label}的模型，建议在设置中添加相应的 API Key 和模型配置。`,
  };
}

/**
 * 检查用户是否配置了支持特定能力的模型
 */
export async function checkModalityCapability(
  capability: ModalityCapability,
  config?: OpenClawCNConfig,
): Promise<CapabilityCheckResult> {
  const catalog = await loadModelCatalog({ config });
  return checkCapabilityFromCatalog(capability, catalog);
}

/**
 * 批量检查多个能力（只加载一次模型目录）
 */
export async function checkMultipleCapabilities(
  capabilities: ModalityCapability[],
  config?: OpenClawCNConfig,
): Promise<CapabilityCheckResult[]> {
  const catalog = await loadModelCatalog({ config });
  return capabilities.map((cap) => checkCapabilityFromCatalog(cap, catalog));
}

/**
 * 获取推荐的配置提示（根据缺失的能力）
 */
export function getConfigSuggestions(results: CapabilityCheckResult[]): {
  missingCapabilities: ModalityCapability[];
  suggestions: string[];
} {
  const missingCapabilities = results.filter((r) => !r.hasCapability).map((r) => r.capability);

  const suggestions: string[] = [];

  if (missingCapabilities.includes("image-analysis")) {
    suggestions.push(
      "推荐配置支持图片分析的模型：\n" +
        "   - 阿里云：qwen-vl-max (通义千问视觉版)\n" +
        "   - 字节跳动：doubao-seed-1-8 (豆包多模态)\n" +
        "   - OpenAI：gpt-4-vision-preview\n" +
        "   - 智谱 AI：glm-4v",
    );
  }

  if (missingCapabilities.includes("image-generation")) {
    suggestions.push(
      "推荐配置支持图片生成的模型：\n" +
        "   - OpenAI：dall-e-3\n" +
        "   - 阿里云：wanx-v1 (通义万相)\n" +
        "   - SiliconFlow：Qwen/Qwen-Image, FLUX.1-schnell",
    );
  }

  if (missingCapabilities.includes("image-editing")) {
    suggestions.push(
      "推荐配置支持图像编辑的模型：\n" +
        "   - SiliconFlow：Qwen/Qwen-Image-Edit (通义图像编辑)\n" +
        "   - SiliconFlow：FLUX.1-Kontext-dev (上下文感知编辑)",
    );
  }

  if (missingCapabilities.includes("video-analysis")) {
    suggestions.push(
      "推荐配置支持视频分析的模型：\n" +
        "   - 字节跳动：doubao-seed-1-8 (豆包多模态)\n" +
        "   - 其他支持视频理解的多模态大模型",
    );
  }

  return { missingCapabilities, suggestions };
}
