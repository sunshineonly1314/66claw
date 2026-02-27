/**
 * Capability Matrix API — unified model capability status for the UI.
 *
 * Provides the frontend with a complete view of the user's AI capability coverage,
 * powered by the unified capability registry (capability-registry.ts).
 *
 * Endpoints:
 *   - capability_matrix.summary   — full capability matrix overview
 *   - capability_matrix.query     — query models for a specific capability
 *   - capability_matrix.providers — get all capabilities for a provider
 *   - capability_matrix.refresh   — trigger remote capability card update
 */

import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import {
  getCapabilityMatrixSummary,
  queryByCapability,
  getProviderCapabilities,
  getAllCards,
  getAllCapabilityKeys,
  triggerRemoteFetch,
  type CapabilityKey,
  type RoutingPolicy,
  type EnrichedCard,
} from "../../dispatch/index.js";
import { loadConfig } from "../../config/config.js";
import { getProviderAliases } from "../../agents/model-selection.js";

/** v2 capability key → modelCapability config key */
const V2_TO_V1_KEY: Partial<Record<CapabilityKey, string>> = {
  text: "text",
  code: "code", // code 独立于 text，各自可选不同模型
  vision: "image-understanding",
  imageGen: "image-generation",
  video: "video",
  embedding: "embedding",
  audio: "audio",
  tts: "tts",
  videoGen: "videoGen",
  toolCall: "toolCall",
};

/** Chinese display names for each capability dimension. */
const CAPABILITY_DISPLAY_NAMES: Record<CapabilityKey, string> = {
  text: "文本对话",
  code: "代码生成",
  vision: "图片理解",
  imageGen: "图片生成",
  video: "视频理解",
  videoGen: "视频生成",
  audio: "语音识别",
  tts: "语音合成",
  embedding: "向量嵌入",
  toolCall: "工具调用",
};

/** Icons for each capability. */
const CAPABILITY_ICONS: Record<CapabilityKey, string> = {
  text: "chat",
  code: "code",
  vision: "eye",
  imageGen: "image",
  video: "video",
  videoGen: "film",
  audio: "mic",
  tts: "volume",
  embedding: "database",
  toolCall: "wrench",
};

/** Descriptions for each capability. */
const CAPABILITY_DESCRIPTIONS: Record<CapabilityKey, string> = {
  text: "AI 文本对话、问答、推理",
  code: "代码生成、调试、重构",
  vision: "图片和文档理解分析",
  imageGen: "文字生成图片",
  video: "视频内容理解分析",
  videoGen: "文字生成视频",
  audio: "语音识别转文字（ASR）",
  tts: "文字转语音播报（TTS）",
  embedding: "向量化存储和检索",
  toolCall: "函数调用和 MCP 工具",
};

export const capabilityMatrixHandlers: GatewayRequestHandlers = {
  /**
   * Get the full capability matrix summary.
   *
   * Returns: which capabilities are available, missing, or unconfigured,
   * with the best model for each and recommendations for unconfigured ones.
   */
  "capability_matrix.summary": async ({ respond }) => {
    try {
      const summary = getCapabilityMatrixSummary();
      const allKeys = getAllCapabilityKeys();

      // Read user's explicit model choices from modelCapability config
      const cfg = loadConfig() as {
        modelCapability?: {
          capabilities?: Record<string, { providerId: string; modelId: string; auto?: boolean }>;
        };
      };
      const userChoices = cfg.modelCapability?.capabilities ?? {};

      const capabilities = allKeys.map((key) => {
        const available = summary.available.find((a) => a.capability === key);
        const unconfigured = summary.unconfigured.find((u) => u.capability === key);
        const isMissing = summary.missing.includes(key);

        if (available) {
          // If user explicitly chose a model for this capability, use that instead of bestCard
          let card: EnrichedCard = available.bestCard;
          const v1Key = V2_TO_V1_KEY[key] ?? key;
          const userChoice = userChoices[v1Key];
          if (userChoice) {
            const configuredResults = queryByCapability(key, { configuredOnly: true });
            // User's saved providerId (e.g. "glm") may differ from the v2
            // card's provider field (e.g. "zhipu"). Use alias-aware matching.
            const choiceAliases = getProviderAliases(userChoice.providerId);
            const chosenCard = configuredResults.find(
              (c) => choiceAliases.includes(c.provider) && c.modelId === userChoice.modelId,
            );
            if (chosenCard) card = chosenCard;
          }
          return {
            key,
            name: CAPABILITY_DISPLAY_NAMES[key],
            icon: CAPABILITY_ICONS[key],
            description: CAPABILITY_DESCRIPTIONS[key],
            status: "active" as const,
            bestModel: {
              provider: card.provider,
              modelId: card.modelId,
              displayName: card.displayName,
              quality: card.capabilities[key] ?? 0,
              costTier: card.costTier,
              region: card.region,
              maxContextTokens: card.maxContextTokens,
              capabilities: card.capabilities,
              strengthTier: card.strengthTier,
            },
            alternatives: available.alternatives,
          };
        }

        if (unconfigured) {
          const rec = unconfigured.recommendation;
          return {
            key,
            name: CAPABILITY_DISPLAY_NAMES[key],
            icon: CAPABILITY_ICONS[key],
            description: CAPABILITY_DESCRIPTIONS[key],
            status: "unconfigured" as const,
            recommendation: {
              provider: rec.provider,
              modelId: rec.modelId,
              displayName: rec.displayName,
              costTier: rec.costTier,
              region: rec.region,
              requiresDownload: rec.requiresDownload ?? false,
            },
          };
        }

        return {
          key,
          name: CAPABILITY_DISPLAY_NAMES[key],
          icon: CAPABILITY_ICONS[key],
          description: CAPABILITY_DESCRIPTIONS[key],
          status: isMissing ? ("missing" as const) : ("unconfigured" as const),
        };
      });

      respond(
        true,
        {
          capabilities,
          totalCards: getAllCards().length,
          availableCount: summary.available.length,
          missingCount: summary.missing.length,
          unconfiguredCount: summary.unconfigured.length,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Query models for a specific capability.
   *
   * Params:
   *   capability: CapabilityKey (e.g., "vision", "tts", "audio")
   *   configuredOnly?: boolean (default: false)
   *   policy?: RoutingPolicy (default: "best-quality")
   */
  "capability_matrix.query": async ({ params, respond }) => {
    const {
      capability,
      configuredOnly = false,
      policy = "best-quality",
    } = params as {
      capability?: string;
      configuredOnly?: boolean;
      policy?: RoutingPolicy;
    };

    if (!capability) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "Missing parameter: capability"),
      );
      return;
    }

    const validKeys = getAllCapabilityKeys();
    if (!validKeys.includes(capability as CapabilityKey)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `Invalid capability: ${capability}. Must be one of: ${validKeys.join(", ")}`,
        ),
      );
      return;
    }

    try {
      const results = queryByCapability(
        capability as CapabilityKey,
        { configuredOnly, healthyOnly: true },
        policy,
      );

      const models = results.map((card) => ({
        provider: card.provider,
        modelId: card.modelId,
        displayName: card.displayName,
        quality: card.capabilities[capability as CapabilityKey] ?? 0,
        costTier: card.costTier,
        costPer1M: card.costPer1M,
        region: card.region,
        modelType: card.modelType,
        configured: card.runtime.configured,
        health: card.runtime.health,
        probeStatus: card.runtime.probeResults[capability as CapabilityKey] ?? "untested",
        tags: card.tags ?? [],
        languages: card.languages,
        requiresDownload: card.requiresDownload,
        maxContextTokens: card.maxContextTokens,
        strengthTier: card.strengthTier,
        capabilities: card.capabilities,
      }));

      respond(
        true,
        {
          capability,
          capabilityName: CAPABILITY_DISPLAY_NAMES[capability as CapabilityKey],
          models,
          totalCount: models.length,
          configuredCount: models.filter((m) => m.configured).length,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Get all capabilities for a specific provider.
   */
  "capability_matrix.providers": async ({ params, respond }) => {
    const { provider } = params as { provider?: string };
    if (!provider) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "Missing parameter: provider"),
      );
      return;
    }

    try {
      const cards = getProviderCapabilities(provider);
      const models = cards.map((card) => ({
        modelId: card.modelId,
        displayName: card.displayName,
        modelType: card.modelType,
        capabilities: Object.entries(card.capabilities).map(([key, score]) => ({
          key,
          name: CAPABILITY_DISPLAY_NAMES[key as CapabilityKey],
          quality: score,
        })),
        costTier: card.costTier,
        costPer1M: card.costPer1M,
        region: card.region,
        tags: card.tags ?? [],
      }));

      respond(
        true,
        {
          provider,
          models,
          totalModels: models.length,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Trigger a remote capability card refresh.
   */
  "capability_matrix.refresh": async ({ respond }) => {
    try {
      const result = await triggerRemoteFetch();
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
