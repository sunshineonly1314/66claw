/**
 * Capability Matrix API v2 — unified model capability & provider management for the UI.
 *
 * This is the single gateway API surface for all model/provider operations.
 * v1 `modelConfig.*` methods are deprecated and will be removed in a future release;
 * all new UI code should use `capability_matrix.*` exclusively.
 *
 * Endpoints (read):
 *   - capability_matrix.summary           — full capability matrix overview
 *   - capability_matrix.query             — query models for a specific capability
 *   - capability_matrix.providers         — get all capabilities for a provider (registry)
 *   - capability_matrix.refresh           — trigger remote capability card update
 *   - capability_matrix.models            — list switchable models for a capability
 *   - capability_matrix.providers.list    — list all providers with config status
 *   - capability_matrix.providerGroups    — provider group metadata
 *   - capability_matrix.provider.getConfig — get masked provider config
 *   - capability_matrix.health            — provider health map
 *   - capability_matrix.priority.get      — get provider priority order
 *   - capability_matrix.embeddingBinding  — vec DB embedding model binding status
 *   - capability_matrix.extractionStatus  — memory extraction LLM status
 *
 * Endpoints (write):
 *   - capability_matrix.switchModel             — switch model for a capability
 *   - capability_matrix.provider.detect         — detect & configure a provider
 *   - capability_matrix.provider.delete         — delete a provider configuration
 *   - capability_matrix.provider.addModel       — add a custom model to a provider
 *   - capability_matrix.provider.testConnection — test provider connectivity
 *   - capability_matrix.priority.save           — save provider priority order
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
// Import v1 business logic for delegation (will be inlined into v2 post-migration)
import {
  getCapabilityModels,
  switchCapabilityModel,
  detectProviderModelsWithProgress,
  listProviders,
  getProviderConfig,
  deleteProviderConfig,
  addCustomModel,
  getProvidersHealth,
  testProviderConnection,
  saveProviderPriority,
  getProviderPriority,
  getEmbeddingBindingStatus,
} from "./model-config.js";
import { getExtractionProviderStatus as _getExtractionProviderStatus } from "../../auto-reply/reply/memory-extraction.js";
import {
  PROVIDER_GROUPS,
  PROVIDER_CAPABILITY_MAPPINGS,
} from "../../config/provider-capability-mapping.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("gateway/capability-matrix");

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
  videoGen: "video-generation",
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

/**
 * Capabilities hidden from the UI in this release.
 * The underlying data/handlers are preserved; they are just filtered from API responses.
 */
const HIDDEN_CAPABILITIES = new Set<CapabilityKey>(["tts"]);

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
      const allKeys = getAllCapabilityKeys().filter((k) => !HIDDEN_CAPABILITIES.has(k));

      // Read user's explicit model choices from modelCapability config
      const cfg = (await loadConfig()) as {
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
            if (chosenCard) {
              card = chosenCard;
            } else {
              // User's model is not in the v2 card registry (e.g. a model only
              // known to v1 PROVIDER_CAPABILITY_MAPPINGS, or a user-added custom
              // model). Build a synthetic card with safe defaults instead of
              // spreading from bestCard (which belongs to a different model).
              const providerModels = (cfg as Record<string, unknown>).models as
                | { providers?: Record<string, { models?: Array<{ id?: string; name?: string }> }> }
                | undefined;
              const modelDef = providerModels?.providers?.[userChoice.providerId]?.models?.find(
                (m) => m.id === userChoice.modelId,
              );
              const aliases = getProviderAliases(userChoice.providerId);
              const isDomestic = aliases.some((a) => !!PROVIDER_CAPABILITY_MAPPINGS[a]);
              card = {
                provider: userChoice.providerId,
                modelId: userChoice.modelId,
                displayName: modelDef?.name ?? userChoice.modelId,
                capabilities: { [key]: 3 } as Record<CapabilityKey, number>,
                modelType: "chat",
                region: isDomestic ? "domestic" : "international",
                costTier: "standard",
                costPer1M: 0,
                maxContextTokens: 32768,
                strengthTier: "moderate",
                tags: [],
                languages: [],
                runtime: { configured: true, health: "unknown" as const, probeResults: {} },
              } as EnrichedCard;
            }
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
              auto: userChoice?.auto,
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

  // =========================================================================
  // v2 unified handlers — delegating to v1 business logic
  // These will eventually replace all modelConfig.* methods.
  // =========================================================================

  /**
   * List switchable models for a capability (v2 of modelConfig.capability.models).
   *
   * Merges v1 static mappings + v2 capability registry + user config models.
   */
  "capability_matrix.models": async ({ params, respond }) => {
    try {
      const { capability } = params as { capability?: string };
      if (!capability) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing parameter: capability"),
        );
        return;
      }
      const result = await getCapabilityModels({ capability });
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Switch the active model for a capability (v2 of modelConfig.capability.switchModel).
   *
   * Handles: config write lock, provider validation, session override,
   * agents.defaults.model.primary sync, connection pre-warming.
   */
  "capability_matrix.switchModel": async ({ params, respond }) => {
    try {
      const { capability, providerId, modelId, force } = params as {
        capability?: string;
        providerId?: string;
        modelId?: string;
        force?: boolean;
      };
      if (!capability || !providerId || !modelId) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "Missing required parameters: capability, providerId, modelId",
          ),
        );
        return;
      }
      const result = await switchCapabilityModel({ capability, providerId, modelId, force });
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * List all providers with config status (v2 of modelConfig.providers.list).
   */
  "capability_matrix.providers.list": async ({ respond }) => {
    try {
      const result = await listProviders();
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Provider group metadata (v2 of modelConfig.providerGroups.list).
   */
  "capability_matrix.providerGroups": async ({ respond }) => {
    try {
      respond(true, { groups: PROVIDER_GROUPS }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Detect & configure a provider (v2 of modelConfig.provider.detect).
   *
   * Responds immediately with { started, total }, then broadcasts progress events.
   */
  "capability_matrix.provider.detect": async ({ params, respond, context, client }) => {
    try {
      const { providerId, apiKey, customModel, baseUrl } = params as {
        providerId: string;
        apiKey: string;
        customModel?: string;
        baseUrl?: string;
      };
      if (!providerId || typeof providerId !== "string") {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing parameter: providerId"),
        );
        return;
      }
      if (!apiKey || typeof apiKey !== "string") {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing parameter: apiKey"),
        );
        return;
      }
      const mapping = PROVIDER_CAPABILITY_MAPPINGS[providerId];
      const totalModels = mapping
        ? mapping.models.length +
          (customModel && !mapping.models.some((m) => m.modelId === customModel) ? 1 : 0)
        : 0;

      const connIds = client?.connId ? new Set([client.connId]) : undefined;
      const broadcastFn = (event: string, payload: unknown) => {
        if (connIds) {
          context.broadcastToConnIds(event, payload, connIds);
        } else {
          context.broadcast(event, payload);
        }
      };

      respond(true, { started: true, total: totalModels }, undefined);

      void detectProviderModelsWithProgress(
        { providerId, apiKey, customModel, baseUrl },
        broadcastFn,
      ).catch((err) => {
        log.error(`detectProviderModelsWithProgress failed: ${err}`);
        broadcastFn("modelConfig.detect.complete", {
          success: false,
          models: [],
          autoEnabled: {},
          availableCount: 0,
          failedCount: 0,
          error: `检测异常: ${err instanceof Error ? err.message : String(err)}`,
        });
      });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Get masked provider config (v2 of modelConfig.provider.getConfig).
   */
  "capability_matrix.provider.getConfig": async ({ params, respond }) => {
    try {
      const { providerId } = params as { providerId?: string };
      if (!providerId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing parameter: providerId"),
        );
        return;
      }
      const result = await getProviderConfig({ providerId });
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Delete a provider configuration (v2 of modelConfig.provider.delete).
   */
  "capability_matrix.provider.delete": async ({ params, respond }) => {
    try {
      const { providerId } = params as { providerId?: string };
      if (!providerId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing parameter: providerId"),
        );
        return;
      }
      const result = await deleteProviderConfig({ providerId });
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Add a custom model to a provider (v2 of modelConfig.provider.addModel).
   */
  "capability_matrix.provider.addModel": async ({ params, respond }) => {
    try {
      const { providerId, modelId, modelName, input } = params as {
        providerId?: string;
        modelId?: string;
        modelName?: string;
        input?: Array<"text" | "image" | "video">;
      };
      if (!providerId || !modelId) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            "Missing required parameters: providerId, modelId",
          ),
        );
        return;
      }
      const result = await addCustomModel({ providerId, modelId, modelName, input });
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Provider health map (v2 of modelConfig.providers.health).
   */
  "capability_matrix.health": async ({ respond }) => {
    try {
      const result = await getProvidersHealth();
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Test provider connectivity (v2 of modelConfig.provider.testConnection).
   */
  "capability_matrix.provider.testConnection": async ({ params, respond }) => {
    try {
      const { providerId } = params as { providerId?: string };
      if (!providerId) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing parameter: providerId"),
        );
        return;
      }
      const result = await testProviderConnection({ providerId });
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Save provider priority order (v2 of modelConfig.providers.savePriority).
   */
  "capability_matrix.priority.save": async ({ params, respond }) => {
    try {
      const { priority } = params as { priority?: string[] };
      if (!Array.isArray(priority)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Missing parameter: priority (array)"),
        );
        return;
      }
      const result = await saveProviderPriority({ priority });
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Get provider priority order (v2 of modelConfig.providers.getPriority).
   */
  "capability_matrix.priority.get": async ({ respond }) => {
    try {
      const result = await getProviderPriority();
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * 查询向量库 embedding 绑定状态。
   * 返回当前绑定的模型、维度、向量数量，供 UI 展示绑定警告。
   */
  "capability_matrix.embeddingBinding": async ({ respond }) => {
    try {
      const status = getEmbeddingBindingStatus();
      respond(true, status, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * 查询记忆提取 LLM 的当前状态（哪个 provider 可用）。
   * 用于 UI "记忆" 卡片中展示记忆提取模型信息。
   */
  "capability_matrix.extractionStatus": async ({ respond }) => {
    try {
      const cfg = loadConfig();
      const status = _getExtractionProviderStatus(cfg);
      respond(true, status, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
