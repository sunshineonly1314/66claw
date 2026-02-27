/**
 * Modality Capability API — JIT configuration support.
 *
 * 提供前端调用的 API 端点，用于检测用户是否配置了所需的多模态能力。
 */

import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import {
  checkModalityCapability,
  checkMultipleCapabilities,
  getConfigSuggestions,
  type ModalityCapability,
} from "../../agents/modality-capability-checker.js";
import { loadConfig } from "../../config/config.js";

/** 图片生成意图检测关键词（模块级常量，避免每次请求重建） */
const IMAGE_GEN_KEYWORDS = [
  "画一张",
  "画一幅",
  "生成图片",
  "生成一张图",
  "帮我画",
  "创作图片",
  "绘制",
  "draw",
  "generate image",
  "create image",
  "paint",
  "illustration",
];

/** 图像编辑意图检测关键词 */
const IMAGE_EDIT_KEYWORDS = [
  "修改图片",
  "编辑图片",
  "P图",
  "p图",
  "改一下图",
  "换个背景",
  "去掉背景",
  "去水印",
  "加滤镜",
  "edit image",
  "modify image",
  "remove background",
];

/**
 * 检查单个能力是否可用
 *
 * Request:
 * {
 *   "capability": "image-analysis" | "image-generation" | "video-analysis"
 * }
 *
 * Response:
 * {
 *   "capability": "image-analysis",
 *   "hasCapability": false,
 *   "availableModels": [],
 *   "suggestion": "当前未配置支持图片分析的模型..."
 * }
 */
export const modalityCapabilityHandlers: GatewayRequestHandlers = {
  "modality.check": async ({ params, respond }) => {
    const { capability } = params as { capability?: ModalityCapability };
    if (!capability) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "Missing parameter: capability"),
      );
      return;
    }

    const validCapabilities: ModalityCapability[] = [
      "image-analysis",
      "image-generation",
      "image-editing",
      "video-analysis",
    ];
    if (!validCapabilities.includes(capability)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `Invalid capability: ${capability}. Must be one of: ${validCapabilities.join(", ")}`,
        ),
      );
      return;
    }

    try {
      const config = loadConfig();
      const result = await checkModalityCapability(capability, config);
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * 批量检查多个能力是否可用
   *
   * Request:
   * {
   *   "capabilities": ["image-analysis", "image-generation"]
   * }
   *
   * Response:
   * {
   *   "results": [
   *     { "capability": "image-analysis", "hasCapability": false, ... },
   *     { "capability": "image-generation", "hasCapability": true, ... }
   *   ],
   *   "missingCapabilities": ["image-analysis"],
   *   "suggestions": ["💡 推荐配置支持图片分析的模型..."]
   * }
   */
  "modality.checkMultiple": async ({ params, respond }) => {
    const { capabilities } = params as { capabilities?: ModalityCapability[] };
    if (!capabilities || !Array.isArray(capabilities)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "Missing or invalid parameter: capabilities"),
      );
      return;
    }

    try {
      const config = loadConfig();
      const results = await checkMultipleCapabilities(capabilities, config);
      const { missingCapabilities, suggestions } = getConfigSuggestions(results);

      respond(
        true,
        {
          results,
          missingCapabilities,
          suggestions,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * 智能检测用户意图并返回所需能力的检查结果
   *
   * Request:
   * {
   *   "prompt": "帮我画一张猫咪的图片",
   *   "hasAttachments": false,
   *   "attachmentTypes": []
   * }
   *
   * Response:
   * {
   *   "detectedIntent": "image-generation",
   *   "requiredCapabilities": ["image-generation"],
   *   "results": [...],
   *   "needsConfiguration": true,
   *   "suggestions": [...]
   * }
   */
  "modality.detectIntent": async ({ params, respond }) => {
    const {
      prompt = "",
      hasAttachments = false,
      attachmentTypes = [],
    } = params as {
      prompt?: string;
      hasAttachments?: boolean;
      attachmentTypes?: string[];
    };

    const requiredCapabilities: ModalityCapability[] = [];

    // 检测图片附件 → 图片分析或图像编辑
    if (hasAttachments && attachmentTypes.some((type: string) => type.startsWith("image/"))) {
      const lp = prompt.toLowerCase();
      if (IMAGE_EDIT_KEYWORDS.some((kw) => lp.includes(kw.toLowerCase()))) {
        requiredCapabilities.push("image-editing");
      } else {
        requiredCapabilities.push("image-analysis");
      }
    }

    // 检测视频附件 → 需要视频分析能力
    if (hasAttachments && attachmentTypes.some((type: string) => type.startsWith("video/"))) {
      requiredCapabilities.push("video-analysis");
    }

    // 检测提示词中的图片生成/编辑意图
    const lowerPrompt = prompt.toLowerCase();
    if (IMAGE_EDIT_KEYWORDS.some((kw) => lowerPrompt.includes(kw.toLowerCase()))) {
      requiredCapabilities.push("image-editing");
    } else if (IMAGE_GEN_KEYWORDS.some((kw) => lowerPrompt.includes(kw.toLowerCase()))) {
      requiredCapabilities.push("image-generation");
    }

    // 如果没有检测到任何特殊需求，返回空结果
    if (requiredCapabilities.length === 0) {
      respond(
        true,
        {
          detectedIntent: null,
          requiredCapabilities: [],
          results: [],
          needsConfiguration: false,
          suggestions: [],
        },
        undefined,
      );
      return;
    }

    try {
      // 去重
      const uniqueCapabilities = Array.from(new Set(requiredCapabilities));

      const config = loadConfig();
      const results = await checkMultipleCapabilities(uniqueCapabilities, config);
      const { missingCapabilities, suggestions } = getConfigSuggestions(results);

      respond(
        true,
        {
          detectedIntent: uniqueCapabilities[0] ?? null,
          requiredCapabilities: uniqueCapabilities,
          results,
          needsConfiguration: missingCapabilities.length > 0,
          suggestions,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
