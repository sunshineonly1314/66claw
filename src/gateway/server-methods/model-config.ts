/**
 * 模型设置 — 业务逻辑层
 *
 * 提供 provider 检测/配置、模型切换、健康状态、优先级排序等核心业务函数。
 * 由 capability-matrix.ts 的 v2 gateway handler 调用，不再直接注册 gateway 路由。
 */

import { loadConfig, writeConfigFile } from "../../config/config.js";
import {
  PROVIDER_CAPABILITY_MAPPINGS,
  getModelsByCapability,
  getProviderCapabilities,
  type Capability,
} from "../../config/provider-capability-mapping.js";
import type { OpenClawCNConfig } from "../../config/types.js";
import { CN_PROVIDERS } from "../../config/region-cn.js";
import type { ModelDefinitionConfig } from "../../config/types.models.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { resolveStorePath } from "../../config/sessions/paths.js";
import { updateSessionStore } from "../../config/sessions/store.js";
import { loadAuthProfileStore } from "../../agents/auth-profiles/store.js";
import { hasUserConfiguredProvider } from "../../agents/model-auth.js";
import {
  refreshProviderConfigured,
  upsertUserCard,
  removeUserCardsByProvider,
  type CapabilityKey,
  type ModelCapabilityCard,
} from "../../dispatch/capability-registry.js";
import { getProviderAliases } from "../../agents/model-selection.js";
import { ensureOpenClawCNModelsJson } from "../../agents/models-config.js";

const log = createSubsystemLogger("gateway/model-config");

/** Build `provider/model` ref without double-prefixing when modelId already starts with `provider/`. */
function buildModelRef(providerId: string, modelId: string): string {
  if (modelId.startsWith(`${providerId}/`)) return modelId;
  return `${providerId}/${modelId}`;
}

/**
 * 能力配置类型
 */
interface CapabilityModelConfig {
  providerId: string;
  modelId: string;
  auto?: boolean;
}

/**
 * 模型能力配置
 */
interface ModelCapabilityConfig {
  capabilities: Partial<Record<Capability | CapabilityKey | string, CapabilityModelConfig>>;
}

/**
 * 获取当前配置
 */
async function getModelCapabilityConfig(): Promise<ModelCapabilityConfig> {
  const config = await loadConfig();
  const modelCapability = (config as { modelCapability?: ModelCapabilityConfig }).modelCapability;

  if (!modelCapability) {
    return { capabilities: {} };
  }

  return modelCapability;
}

/**
 * FIX BUG-R2-8: 串行化 read-modify-write 操作，防止并发写入导致配置丢失。
 * 使用 Promise 链式锁确保 loadConfig → 修改 → writeConfigFile 原子化。
 */
let _modelConfigWriteLock: Promise<void> = Promise.resolve();

/**
 * 获取所有 Provider 的配置状态
 *
 * 从三个来源收集 provider 配置信息:
 * 1. models.providers: 用户自己配置的 Provider
 * 2. freeModels.accounts: ClawdbotCN 提供的免费账号
 * 3. auth-profiles.json: setup wizard 存储的凭据
 *
 * 最后，通过 getProviderAliases 将配置状态扩展到同一逻辑 provider
 * 的所有别名 ID（解决 v1 "glm" vs v2 "zhipu" 等 ID 不一致问题）。
 */
async function getProviderConfigStatus(): Promise<Map<string, boolean>> {
  const config = await loadConfig();
  const providers = new Map<string, boolean>();

  // 检查 models.providers 中已配置的 Provider (用户自己配置)
  if (config.models?.providers) {
    for (const [providerId, providerConfig] of Object.entries(config.models.providers)) {
      providers.set(providerId, !!providerConfig.apiKey);
    }
  }

  // 检查免费模型账号
  const freeModels = (
    config as { freeModels?: { accounts?: Array<{ providerId: string; enabled: boolean }> } }
  ).freeModels;
  if (freeModels?.accounts) {
    for (const account of freeModels.accounts) {
      providers.set(account.providerId, account.enabled);
    }
  }

  // 检查 auth-profiles.json 中的凭据（setup wizard 通过 upsertAuthProfile 存储 API key）
  try {
    const authStore = loadAuthProfileStore();
    if (authStore.profiles) {
      for (const [, profile] of Object.entries(authStore.profiles)) {
        const p = profile as { provider?: string; key?: string; type?: string };
        if (p.provider && p.key) {
          providers.set(p.provider, true);
        }
      }
    }
  } catch {
    // auth-profiles.json may not exist — ignore
  }

  // 将已配置的 provider 状态扩展到所有别名 ID.
  // 例如: 用户配置了 "glm" → 同时标记 "zhipu" 为已配置,
  //       用户配置了 "aliyun-bailian" → 同时标记 "qwen"、"dashscope" 为已配置.
  const extraEntries: [string, boolean][] = [];
  for (const [id, configured] of providers) {
    if (!configured) continue;
    const aliases = getProviderAliases(id);
    for (const alias of aliases) {
      if (!providers.get(alias)) {
        extraEntries.push([alias, true]);
      }
    }
  }
  for (const [alias, val] of extraEntries) {
    providers.set(alias, val);
  }

  return providers;
}

/** v2 capability key → modelCapability config storage key 映射 */
const V2_KEY_TO_LEGACY: Record<string, Capability | string | undefined> = {
  text: "text",
  code: "code", // code 独立于 text，各自可选不同模型
  vision: "image-understanding",
  imageGen: "image-generation",
  video: "video",
  videoGen: "videoGen", // 视频生成 — 独立于视频理解
  audio: "audio",
  tts: "tts",
  embedding: "embedding",
  toolCall: "toolCall",
};

/**
 * API: 获取某个能力的所有可用模型
 */
export async function getCapabilityModels(params: { capability: Capability | string }) {
  // 支持 v2 key：先映射到旧版
  const capability = (V2_KEY_TO_LEGACY[params.capability as string] ??
    params.capability) as Capability;

  const capabilityConfig = await getModelCapabilityConfig();
  const providerStatus = await getProviderConfigStatus();

  const currentConfig = capabilityConfig.capabilities[capability];
  const allModels = getModelsByCapability(capability);

  // 用户保存的 providerId 和 v2 card 的 provider 可能是同一 provider 的不同别名
  // (如 "glm" vs "zhipu")。预先计算别名组以正确匹配 active 状态。
  const currentAliases = currentConfig?.providerId
    ? getProviderAliases(currentConfig.providerId)
    : [];
  const isActiveModel = (providerId: string, modelId: string) =>
    currentConfig?.modelId === modelId && currentAliases.includes(providerId);

  const models = allModels.map((m) => ({
    providerId: m.providerId,
    providerName: m.providerName,
    providerIcon: m.providerIcon,
    modelId: m.model.modelId,
    modelName: m.model.modelName,
    pricing: m.model.pricing,
    configured: providerStatus.get(m.providerId) || false,
    active: isActiveModel(m.providerId, m.model.modelId),
  }));

  // 合并 v2 capability registry 中存在但 v1 静态映射缺失的模型
  try {
    const { queryByCapability } = await import("../../dispatch/index.js");
    const v2Key =
      Object.entries(V2_KEY_TO_LEGACY).find(([, v]) => v === capability)?.[0] ?? capability;
    const v2Results = queryByCapability(v2Key as any, { configuredOnly: false });
    for (const card of v2Results) {
      const alreadyInList = models.some(
        (m) => m.providerId === card.provider && m.modelId === card.modelId,
      );
      if (!alreadyInList) {
        models.push({
          providerId: card.provider,
          providerName: card.displayName,
          providerIcon: "",
          modelId: card.modelId,
          modelName: card.displayName,
          pricing: { type: card.costTier === "free" ? ("free" as const) : ("paid" as const) },
          configured: providerStatus.get(card.provider) || false,
          active: isActiveModel(card.provider, card.modelId),
        });
      }
    }
  } catch {
    /* v2 registry not initialized — use v1 only */
  }

  // 合并 config.models.providers 中用户已配置但不在静态映射中的模型
  // （如 Ollama 动态发现的模型、OpenAI 兼容端点的模型）
  try {
    const userConfig = await loadConfig();
    const userProviders = userConfig.models?.providers ?? {};
    for (const [pid, provCfg] of Object.entries(userProviders)) {
      if (!provCfg.models?.length) continue;
      const mapping = PROVIDER_CAPABILITY_MAPPINGS[pid];
      const provName = mapping?.name ?? pid;
      const provIcon = mapping?.icon ?? "";
      for (const m of provCfg.models) {
        // 根据模型 input 字段推断是否匹配当前 capability
        const modelInput = m.input ?? ["text"];
        let matchesCap = false;
        if (capability === "text" && modelInput.includes("text")) matchesCap = true;
        if (capability === "image-understanding" && modelInput.includes("image")) matchesCap = true;
        if (capability === "embedding" && m.id?.includes("embed")) matchesCap = true;
        if (!matchesCap) continue;

        const alreadyInList = models.some((e) => e.providerId === pid && e.modelId === m.id);
        if (alreadyInList) continue;

        models.push({
          providerId: pid,
          providerName: provName,
          providerIcon: provIcon,
          modelId: m.id,
          modelName: m.name ?? m.id,
          pricing: { type: "paid" as const },
          configured: true,
          active: isActiveModel(pid, m.id),
        });
      }
    }
  } catch {
    /* 非关键 — 用户配置读取失败时跳过 */
  }

  // 排序：已配置的在前，免费的在前，当前使用的在最前
  models.sort((a, b) => {
    if (a.active) return -1;
    if (b.active) return 1;
    if (a.configured && !b.configured) return -1;
    if (!a.configured && b.configured) return 1;
    if (a.pricing.type === "free" && b.pricing.type !== "free") return -1;
    if (a.pricing.type !== "free" && b.pricing.type === "free") return 1;
    return 0;
  });

  return { models };
}

/**
 * API: 切换能力的当前模型
 */
export async function switchCapabilityModel(params: {
  capability: Capability | string;
  providerId: string;
  modelId: string;
}) {
  const { providerId, modelId } = params;
  // 支持 v2 capability key：先尝试映射到旧版 key
  const capability = (V2_KEY_TO_LEGACY[params.capability as string] ??
    params.capability) as Capability;

  // 验证该 Provider 是否已配置（双重检查：v1 status + v2 hasUserConfiguredProvider）
  const providerStatus = await getProviderConfigStatus();
  if (!providerStatus.get(providerId)) {
    // v1 未命中时二次确认 — 加密 store / auth-profiles 路径差异可能导致 v1 漏判
    const cfg = loadConfig();
    let store;
    try {
      store = loadAuthProfileStore();
    } catch {
      /* ignore */
    }
    if (!hasUserConfiguredProvider(providerId, cfg, store)) {
      return {
        success: false,
        error: `服务商 ${providerId} 尚未配置，请先添加配置`,
      };
    }
  }

  // 验证该模型是否支持该能力（v1 静态映射 + v2 capability registry 双重查找）
  const allModels = getModelsByCapability(capability);
  const switchAliases = getProviderAliases(providerId);
  let targetModel = allModels.find(
    (m) => switchAliases.includes(m.providerId) && m.model.modelId === modelId,
  );

  // v1 未找到时尝试 v2 capability registry — 远程卡片只在 v2 中
  if (!targetModel) {
    try {
      const { queryByCapability } = await import("../../dispatch/index.js");
      const v2Key =
        Object.entries(V2_KEY_TO_LEGACY).find(([, v]) => v === capability)?.[0] ?? capability;
      const v2Results = queryByCapability(v2Key as any, { configuredOnly: false });
      const v2Match = v2Results.find(
        (c) => switchAliases.includes(c.provider) && c.modelId === modelId,
      );
      if (v2Match) {
        // Synthesize a targetModel-like object so the rest of the function works
        targetModel = {
          providerId,
          providerName: providerId,
          providerIcon: "",
          model: {
            modelId,
            modelName: v2Match.displayName,
            capabilities: [capability],
            pricing: { type: v2Match.costTier === "free" ? ("free" as const) : ("paid" as const) },
          },
        };
      }
    } catch {
      /* v2 not available, stick with v1 result */
    }
  }

  if (!targetModel) {
    return {
      success: false,
      error: `模型 ${modelId} 不支持该能力`,
    };
  }

  // agentOnly 模型不能用于普通 chat（会 403）
  if (capability === "text" && targetModel.model.agentOnly) {
    return {
      success: false,
      error: `${targetModel.model.modelName} 是代码代理专用模型，不支持普通聊天`,
    };
  }

  // 更新配置（使用写锁保证原子性）
  const prev = _modelConfigWriteLock;
  let release: () => void;
  _modelConfigWriteLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await prev;
    const config = structuredClone(await loadConfig());
    const configWithCap = config as { modelCapability?: ModelCapabilityConfig };
    if (!configWithCap.modelCapability) configWithCap.modelCapability = { capabilities: {} };
    // 用户主动选择：标记 auto: false，防止后续优先级同步覆盖
    configWithCap.modelCapability.capabilities[capability] = { providerId, modelId, auto: false };

    // 如果是 text 能力，同步更新 agents.defaults.model.primary
    if (capability === "text") {
      if (!config.agents) config.agents = {};
      if (!config.agents.defaults) config.agents.defaults = {};
      const modelField = config.agents.defaults.model;
      const newPrimary = buildModelRef(providerId, modelId);
      if (typeof modelField === "object" && modelField !== null) {
        modelField.primary = newPrimary;
      } else {
        config.agents.defaults.model = { primary: newPrimary };
      }
    }

    await writeConfigFile(config);
  } finally {
    release!();
  }

  // 切换 text 能力时，更新所有 session 的模型覆盖，使当前会话立即生效
  if (capability === "text") {
    await updateSessionModelOverrides(providerId, modelId);
  }

  // ===== OpenClawCN: 切换模型后预热连接（消除首次请求冷启动延迟） =====
  prewarmProviderConnection(providerId);
  // ===== END =====

  return { success: true };
}

/**
 * 将 Capability[] 转换为 ModelDefinitionConfig 的 input 数组
 * 与 setup 页面的 applyXxxProviderConfig 保持一致
 */
function capabilitiesToInput(capabilities: Capability[]): Array<"text" | "image" | "video"> {
  const input: Array<"text" | "image" | "video"> = [];
  if (capabilities.includes("text")) input.push("text");
  if (capabilities.includes("image-understanding") || capabilities.includes("image-generation"))
    input.push("image");
  if (capabilities.includes("video")) input.push("video");
  // 确保至少包含 text
  if (input.length === 0) input.push("text");
  return input;
}

/**
 * 并发探测 Provider 下所有模型，通过 broadcast 实时报告进度。
 *
 * 流程：
 *   1. 用第一个 chat 模型验证 API Key（快速失败）
 *   2. Key 有效后并发探测所有模型（concurrency=4）
 *   3. 每个模型完成后 broadcast progress 事件
 *   4. 全部完成后保存配置 + broadcast complete 事件
 */
export async function detectProviderModelsWithProgress(
  params: { providerId: string; apiKey: string; customModel?: string; baseUrl?: string },
  broadcast: (event: string, payload: unknown) => void,
): Promise<void> {
  const { providerId, apiKey, customModel, baseUrl: userBaseUrl } = params;
  const mapping = PROVIDER_CAPABILITY_MAPPINGS[providerId];
  if (!mapping) {
    broadcast("modelConfig.detect.complete", {
      success: false,
      models: [],
      autoEnabled: {},
      availableCount: 0,
      failedCount: 0,
      error: `未知的服务商: ${providerId}`,
    });
    return;
  }

  const allModels = [...mapping.models];
  if (customModel && !allModels.some((m) => m.modelId === customModel)) {
    allModels.unshift({
      modelId: customModel,
      modelName: customModel,
      capabilities: ["text"] as Capability[],
      pricing: { type: "paid" as const },
    });
  }

  // ── 预备：自定义端点模型自动发现 ──
  // 对于 openai-compatible 等无预定义模型的 Provider，尝试从 /models 端点获取模型列表
  const resolvedBaseUrl = userBaseUrl?.trim() || CN_PROVIDERS[providerId]?.apiEndpoint || "";
  if (allModels.length === 0 && resolvedBaseUrl) {
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
      const resp = await fetch(`${resolvedBaseUrl}/models`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const body = (await resp.json()) as { data?: Array<{ id: string }> };
        const models = body.data ?? [];
        for (const m of models.slice(0, 20)) {
          if (m.id && !allModels.some((e) => e.modelId === m.id)) {
            allModels.push({
              modelId: m.id,
              modelName: m.id,
              capabilities: ["text"] as Capability[],
              pricing: { type: "paid" as const },
            });
          }
        }
      }
    } catch {
      // /models 不可用 — 继续用空列表或 customModel
    }
  }

  // ── 第一阶段：快速 API Key 验证 ──
  // 找一个 chat 模型做快速验证，确认 key 有效
  const chatModel = allModels.find((m) => m.capabilities.includes("text")) ?? allModels[0];
  if (chatModel) {
    const keyCheck = await probeModel(providerId, chatModel.modelId, apiKey, userBaseUrl);
    if (!keyCheck.ok && keyCheck.fatal) {
      // Key 无效 — 不进入逐模型探测
      broadcast("modelConfig.detect.complete", {
        success: false,
        models: [],
        autoEnabled: {},
        availableCount: 0,
        failedCount: 0,
        error: keyCheck.message,
      });
      return;
    }
  }

  // ── 第二阶段：并发探测所有模型 ──
  const total = allModels.length;
  let completed = 0;
  const modelResults: Array<{
    modelId: string;
    modelName: string;
    status: "ok" | "failed" | "skipped";
    message?: string;
  }> = [];

  const tasks = allModels.map((model) => async () => {
    // 如果是第一阶段已验证过的 chat 模型，直接标记成功
    let result: Awaited<ReturnType<typeof probeModelByType>>;
    if (model === chatModel) {
      result = { ok: true, status: "ok" as const };
    } else {
      result = await probeModelByType(providerId, model, apiKey, userBaseUrl);
    }

    completed++;
    const entry = {
      modelId: model.modelId,
      modelName: model.modelName,
      status: result.status,
      message: result.ok ? undefined : (result as { message?: string }).message,
    };
    modelResults.push(entry);

    broadcast("modelConfig.detect.progress", {
      modelId: model.modelId,
      modelName: model.modelName,
      status: result.status,
      message: entry.message,
      completed,
      total,
    } satisfies DetectProgressEvent);

    return result;
  });

  await withConcurrencyLimit(tasks, 4);

  // ── 第三阶段：保存配置（只保存验证通过 + skipped 的模型） ──
  const availableModels = allModels.filter((m) => {
    const r = modelResults.find((r2) => r2.modelId === m.modelId);
    return r && (r.status === "ok" || r.status === "skipped");
  });

  const autoEnabled: Partial<Record<Capability, string>> = {};
  for (const capability of [
    "text",
    "image-understanding",
    "image-generation",
    "video",
    "embedding",
  ] as Capability[]) {
    if (customModel && capability === "text") {
      autoEnabled[capability] = customModel;
      continue;
    }
    const capModels = availableModels.filter((m) => m.capabilities.includes(capability));
    if (capModels.length > 0) {
      const freeModel = capModels.find((m) => m.pricing.type === "free");
      autoEnabled[capability] = (freeModel || capModels[0])!.modelId;
    }
  }

  // 保存配置（复用现有的写入逻辑）
  const trimmedKey = apiKey.trim();
  const cnProvider = CN_PROVIDERS[providerId];
  const baseUrl = userBaseUrl?.trim() || cnProvider?.apiEndpoint || "";

  if (!baseUrl) {
    broadcast("modelConfig.detect.complete", {
      success: false,
      models: modelResults,
      autoEnabled: {},
      availableCount: 0,
      failedCount: 0,
      error: `无法获取服务商 ${providerId} 的 API 端点，请填写 Base URL`,
    });
    return;
  }

  const prev = _modelConfigWriteLock;
  let release: () => void;
  _modelConfigWriteLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await prev;
    const config = structuredClone(await loadConfig());
    if (!config.models) config.models = { providers: {} };
    if (!config.models.providers) config.models.providers = {};

    const modelDefinitions: ModelDefinitionConfig[] = availableModels.map((m) => ({
      id: m.modelId,
      name: m.modelName,
      contextWindow: m.contextWindow ?? 32768,
      maxTokens: m.maxTokens ?? 4096,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      input: capabilitiesToInput(m.capabilities),
      reasoning: false,
    }));

    config.models.providers[providerId] = {
      ...config.models.providers[providerId],
      baseUrl,
      apiKey: trimmedKey,
      models: modelDefinitions,
    };

    const configWithCapability = config as { modelCapability?: ModelCapabilityConfig };
    if (!configWithCapability.modelCapability)
      configWithCapability.modelCapability = { capabilities: {} };
    for (const [capability, modelId] of Object.entries(autoEnabled)) {
      const cap = capability as Capability;
      if (!configWithCapability.modelCapability.capabilities[cap]) {
        configWithCapability.modelCapability.capabilities[cap] = {
          providerId,
          modelId: modelId as string,
          auto: true,
        };
      }
    }

    if (autoEnabled.text) {
      if (!config.agents) config.agents = {};
      if (!config.agents.defaults) config.agents.defaults = {};
      const newPrimary = buildModelRef(providerId, autoEnabled.text);
      const modelField = config.agents.defaults.model;
      const existingPrimary =
        typeof modelField === "object" && modelField !== null
          ? (modelField as Record<string, unknown>).primary
          : undefined;
      const shouldOverwrite =
        !existingPrimary ||
        (typeof existingPrimary === "string" && existingPrimary.startsWith("anthropic/"));
      if (shouldOverwrite) {
        if (typeof modelField === "object" && modelField !== null) {
          (modelField as Record<string, unknown>).primary = newPrimary;
        } else {
          config.agents.defaults.model = { primary: newPrimary };
        }
      }
    }

    await writeConfigFile(config);

    // 刷新 capability registry 的 isProviderConfigured 回调，
    // 让 capability_matrix API 立即反映新保存的凭据。
    try {
      const updatedConfig = await loadConfig();
      const authStore = loadAuthProfileStore();
      refreshProviderConfigured((p) => hasUserConfiguredProvider(p, updatedConfig, authStore));
    } catch {
      // 非关键 — registry 在下次 gateway 重启时会自行刷新
    }

    // 立即刷新 models.json，让新检测到的模型对 agent 运行时可见
    try {
      const refreshedConfig = await loadConfig();
      await ensureOpenClawCNModelsJson(refreshedConfig);
      log.info(`models.json refreshed after detecting ${providerId}`);
    } catch (mjErr) {
      log.warn(`models.json refresh failed (non-critical): ${mjErr}`);
    }

    // 如果有自定义模型，注入 capability registry
    if (customModel) {
      try {
        const aliases = getProviderAliases(providerId);
        const isDomestic = aliases.some((a) => !!CN_PROVIDERS[a]);
        upsertUserCard({
          provider: providerId,
          modelId: customModel,
          displayName: customModel,
          capabilities: { text: 3, code: 2 },
          modelType: "chat",
          region: isDomestic ? "domestic" : "international",
          costTier: "standard",
          costPer1M: 0,
          maxContextTokens: 32768,
        });
      } catch {
        /* 非关键 */
      }
    }
  } catch (writeErr) {
    broadcast("modelConfig.detect.complete", {
      success: false,
      models: modelResults,
      autoEnabled: {},
      availableCount: 0,
      failedCount: 0,
      error: `配置保存失败: ${writeErr instanceof Error ? writeErr.message : String(writeErr)}`,
    });
    return;
  } finally {
    release!();
  }

  const availableCount = modelResults.filter(
    (r) => r.status === "ok" || r.status === "skipped",
  ).length;
  const failedCount = modelResults.filter((r) => r.status === "failed").length;

  broadcast("modelConfig.detect.complete", {
    success: true,
    models: modelResults,
    autoEnabled,
    availableCount,
    failedCount,
  } satisfies DetectCompleteEvent);
}

/**
 * API: 获取所有 Provider 列表
 */
export async function listProviders() {
  const providerStatus = await getProviderConfigStatus();
  const capabilityConfig = await getModelCapabilityConfig();
  const config = await loadConfig();

  const providers = [];
  const knownProviderIds = new Set<string>();

  for (const [providerId, mapping] of Object.entries(PROVIDER_CAPABILITY_MAPPINGS)) {
    knownProviderIds.add(providerId);
    const configured = providerStatus.get(providerId) || false;

    // 计算有多少模型正在使用
    // FIX R3-10: Partial<Record> 的值可能为 undefined，需要 optional chain 防止 TypeError
    let activeModels = 0;
    for (const [capability, capConfig] of Object.entries(capabilityConfig.capabilities)) {
      if (capConfig?.providerId === providerId) {
        activeModels++;
      }
    }

    providers.push({
      providerId,
      name: mapping.name,
      icon: mapping.icon,
      group: mapping.group ?? "local-custom",
      tagline: mapping.tagline ?? "",
      apiKeyUrl: mapping.apiKeyUrl ?? "",
      apiKeyGuide: mapping.apiKeyGuide ?? [],
      capabilities: getProviderCapabilities(providerId),
      configured,
      activeModels,
      needsBaseUrl: mapping.needsBaseUrl ?? false,
      defaultBaseUrl: mapping.defaultBaseUrl ?? "",
      apiKeyOptional: mapping.apiKeyOptional ?? false,
    });
  }

  // FIX: 包含通过 setup wizard 配置的 provider（其 providerId 不在 PROVIDER_CAPABILITY_MAPPINGS 中）
  // 例如 "qwen-dashscope" 在 setup wizard 中使用，但 PROVIDER_CAPABILITY_MAPPINGS 用 "aliyun-bailian"
  if (config.models?.providers) {
    for (const [providerId, providerConfig] of Object.entries(config.models.providers)) {
      if (knownProviderIds.has(providerId)) continue;
      if (!providerConfig.apiKey) continue;

      let activeModels = 0;
      for (const [, capConfig] of Object.entries(capabilityConfig.capabilities)) {
        if (capConfig?.providerId === providerId) {
          activeModels++;
        }
      }

      // 从 provider 的 models 配置推断能力
      const caps: string[] = [];
      if (providerConfig.models?.some((m: { input?: string[] }) => m.input?.includes("text"))) {
        caps.push("text");
      }
      if (providerConfig.models?.some((m: { input?: string[] }) => m.input?.includes("image"))) {
        caps.push("image-understanding");
      }

      providers.push({
        providerId,
        name: providerId,
        icon: "🔌",
        group: "local-custom",
        tagline: "",
        apiKeyUrl: "",
        apiKeyGuide: [],
        capabilities: caps.length > 0 ? caps : ["text"],
        configured: true,
        activeModels,
      });
    }
  }

  // 排序：已配置的在前，有活跃模型的在最前
  providers.sort((a, b) => {
    if (a.activeModels > 0 && b.activeModels === 0) return -1;
    if (a.activeModels === 0 && b.activeModels > 0) return 1;
    if (a.configured && !b.configured) return -1;
    if (!a.configured && b.configured) return 1;
    return 0;
  });

  return { providers };
}

/**
 * API: 获取 Provider 的脱敏配置信息
 */
export async function getProviderConfig(params: { providerId: string }) {
  const { providerId } = params;
  const config = await loadConfig();
  const providerConfig = config.models?.providers?.[providerId];

  if (!providerConfig || !providerConfig.apiKey) {
    return { configured: false, maskedApiKey: "", capabilities: [] };
  }

  // 脱敏：显示前4后4位
  const key = providerConfig.apiKey;
  const masked =
    key.length > 10
      ? `${key.slice(0, 4)}${"*".repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`
      : "*".repeat(key.length);

  return {
    configured: true,
    maskedApiKey: masked,
    capabilities: getProviderCapabilities(providerId),
  };
}

/**
 * API: 删除 Provider 配置
 */
export async function deleteProviderConfig(params: { providerId: string }) {
  const { providerId } = params;

  const prev = _modelConfigWriteLock;
  let release: () => void;
  _modelConfigWriteLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await prev;
    const config = structuredClone(await loadConfig());

    // 1. 删除 provider 配置
    if (config.models?.providers?.[providerId]) {
      delete config.models.providers[providerId];
    }

    // 2. 清理使用该 provider 的 capability 绑定
    const configWithCapability = config as { modelCapability?: ModelCapabilityConfig };
    if (configWithCapability.modelCapability?.capabilities) {
      for (const [cap, binding] of Object.entries(
        configWithCapability.modelCapability.capabilities,
      )) {
        if (binding?.providerId === providerId) {
          delete configWithCapability.modelCapability.capabilities[cap];
        }
      }
    }

    // 3. 如果有 providerPriority，重新按优先级分配被清除的能力
    if (config.providerPriority?.length) {
      syncModelSelectionsFromPriority(config, config.providerPriority);
    }

    await writeConfigFile(config);

    // 立即刷新 models.json，使删除的提供商从 agent 运行时移除
    try {
      await ensureOpenClawCNModelsJson(config);
    } catch {
      /* 非关键 */
    }

    // 从 capability registry 中移除该 provider 的 user card，避免残留
    try {
      removeUserCardsByProvider(providerId);
    } catch {
      /* 非关键 */
    }
  } finally {
    release!();
  }

  return { success: true };
}

/**
 * API: 手动给已配置的 Provider 添加自定义模型
 *
 * 用于添加枚举库中没有的新模型（如服务商新上线的模型）。
 */
/**
 * 探测模型是否可用（轻量级 chat completions 请求，max_tokens=1）
 * 返回: { ok: true } 或 { ok: false, fatal: boolean, message: string }
 *  - fatal=true: 模型确定不存在（404 / model_not_found），应拒绝添加
 *  - fatal=false: 临时性错误（超时、限流等），允许添加但警告
 */
async function probeModel(
  providerId: string,
  modelId: string,
  apiKey: string,
  baseUrlOverride?: string,
): Promise<{ ok: true } | { ok: false; fatal: boolean; message: string }> {
  const cnProvider = CN_PROVIDERS[providerId];
  const baseUrl = baseUrlOverride?.trim() || cnProvider?.apiEndpoint;
  if (!baseUrl) {
    // 无端点信息，跳过探测
    return { ok: true };
  }

  // 跳过不支持标准 chat completions 探测的厂商
  const skipProbeProviders = new Set(["ollama", "tencent-hunyuan", "google", "anthropic"]);
  if (skipProbeProviders.has(providerId)) {
    return { ok: true };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  // Kimi 需要 User-Agent
  if (providerId === "kimi-code") {
    headers["User-Agent"] = "KimiCLI/0.77";
  }

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(12000),
    });

    const respText = await resp.text().catch(() => "");
    let respMsg = "";
    let respJson: Record<string, unknown> | null = null;
    try {
      respJson = JSON.parse(respText);
      respMsg = (respJson as any).error?.message ?? (respJson as any).message ?? "";
    } catch {
      respMsg = respText.substring(0, 200);
    }

    // 模型不存在的错误模式（无论 HTTP 状态码）
    const notFoundPatterns = [
      /model.*not\s*found/i,
      /does\s*not\s*exist/i,
      /invalid.*model/i,
      /unknown.*model/i,
      /不存在/,
      /无效.*模型/,
      /未找到.*模型/,
      /No available model/i,
    ];

    // 即使 HTTP 200，也要检查响应体是否有错误
    if (resp.ok) {
      // 某些 API 返回 200 但 body 里有 error
      if (respJson && (respJson as any).error) {
        if (notFoundPatterns.some((p) => p.test(respMsg))) {
          return { ok: false, fatal: true, message: `模型 "${modelId}" 不存在或该 Key 无权访问` };
        }
        return { ok: false, fatal: true, message: `模型验证失败: ${respMsg.substring(0, 100)}` };
      }
      // 检查是否有正常的 choices 响应
      if (respJson && (respJson as any).choices) {
        return { ok: true };
      }
      // 200 但没有 choices 也没有 error，可能有问题，但不阻止
      return { ok: true };
    }

    if (resp.status === 404 || notFoundPatterns.some((p) => p.test(respMsg))) {
      return { ok: false, fatal: true, message: `模型 "${modelId}" 不存在或该 Key 无权访问` };
    }

    // 认证失败
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, fatal: true, message: "API Key 无效或已过期，请先更换 Key" };
    }

    // 限流/余额不足等临时问题 — 允许添加但警告
    if (resp.status === 429) {
      return { ok: false, fatal: false, message: "请求频率受限，无法验证模型可用性" };
    }
    if (resp.status === 402) {
      return { ok: false, fatal: false, message: "账户余额不足，无法验证模型可用性" };
    }

    return {
      ok: false,
      fatal: true,
      message: `验证未通过 (HTTP ${resp.status})，模型不可用或不存在`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // 超时或网络问题 — 拒绝添加，避免添加无效模型
    return {
      ok: false,
      fatal: true,
      message: `连接验证失败（${msg.includes("timed out") || msg.includes("timeout") ? "超时" : "网络异常"}），请检查网络后重试`,
    };
  }
}

/**
 * 按模型类型选择合适的探测方式。
 * - chat/vision → POST /chat/completions（复用 probeModel）
 * - embedding   → POST /embeddings
 * - image-gen   → 跳过（API 格式不统一且会产生费用）
 */
async function probeModelByType(
  providerId: string,
  model: { modelId: string; modelName: string; capabilities: Capability[]; testEndpoint?: string },
  apiKey: string,
  baseUrlOverride?: string,
): Promise<
  | { ok: true; status: "ok" | "skipped" }
  | { ok: false; status: "failed"; fatal: boolean; message: string }
> {
  // image-gen 模型跳过探测（避免产生费用）
  if (model.capabilities.includes("image-generation")) {
    return { ok: true, status: "skipped" };
  }

  // embedding 模型 — 用 /embeddings 端点探测
  if (model.testEndpoint === "/embeddings" || model.capabilities.includes("embedding")) {
    const cnProvider = CN_PROVIDERS[providerId];
    const baseUrl = baseUrlOverride?.trim() || cnProvider?.apiEndpoint;
    if (!baseUrl) return { ok: true, status: "skipped" };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    try {
      const resp = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: model.modelId, input: "test" }),
        signal: AbortSignal.timeout(12000),
      });
      if (resp.ok) return { ok: true, status: "ok" };
      if (resp.status === 404)
        return {
          ok: false,
          status: "failed",
          fatal: true,
          message: `模型 "${model.modelId}" 不存在`,
        };
      if (resp.status === 401 || resp.status === 403)
        return { ok: false, status: "failed", fatal: true, message: "API Key 无效" };
      if (resp.status === 429)
        return { ok: false, status: "failed", fatal: false, message: "请求频率受限" };
      return { ok: false, status: "failed", fatal: true, message: `HTTP ${resp.status}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        status: "failed",
        fatal: true,
        message: msg.includes("timeout") ? "超时" : msg,
      };
    }
  }

  // chat/vision/video 模型 — 复用 probeModel
  const result = await probeModel(providerId, model.modelId, apiKey, baseUrlOverride);
  if (result.ok) return { ok: true, status: "ok" };
  return { ok: false, status: "failed", fatal: result.fatal, message: result.message };
}

/**
 * 并发执行任务，限制最大并发数。
 */
async function withConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIdx = 0;
  const worker = async () => {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      results[idx] = await tasks[idx]!();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}

/** 并发探测进度事件 */
interface DetectProgressEvent {
  modelId: string;
  modelName: string;
  status: "ok" | "failed" | "skipped";
  message?: string;
  completed: number;
  total: number;
}

/** 并发探测完成事件 */
interface DetectCompleteEvent {
  success: boolean;
  models: Array<{
    modelId: string;
    modelName: string;
    status: "ok" | "failed" | "skipped";
    message?: string;
  }>;
  autoEnabled: Record<string, string>;
  availableCount: number;
  failedCount: number;
}

export async function addCustomModel(params: {
  providerId: string;
  modelId: string;
  modelName?: string;
  input?: Array<"text" | "image" | "video">;
}) {
  const { providerId, modelId, modelName } = params;

  if (!providerId || !modelId) {
    throw new Error("providerId 和 modelId 不能为空");
  }
  if (modelId.length > 200) {
    throw new Error("modelId 过长");
  }
  // 格式校验：只允许字母、数字、-_./: @
  if (!/^[a-zA-Z0-9\-_.\/:@]+$/.test(modelId)) {
    throw new Error("模型 ID 格式不合法，只能包含字母、数字、-_./: 等字符");
  }
  if (modelName && modelName.length > 100) {
    throw new Error("modelName 过长（最多 100 字符）");
  }
  const VALID_INPUT_TYPES = new Set(["text", "image", "video"]);
  if (params.input) {
    for (const t of params.input) {
      if (!VALID_INPUT_TYPES.has(t)) {
        throw new Error(`无效的输入类型 "${t}"，仅支持 text/image/video`);
      }
    }
  }

  const prev = _modelConfigWriteLock;
  let release: () => void;
  _modelConfigWriteLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  let probeWarning: string | undefined;
  try {
    await prev;
    const config = structuredClone(await loadConfig());

    // 确保 provider 已配置
    const providerConfig = config.models?.providers?.[providerId];
    if (!providerConfig || !providerConfig.apiKey) {
      throw new Error(`服务商 "${providerId}" 尚未配置，请先添加 API Key`);
    }

    // 检查模型是否已存在
    const existing = providerConfig.models.find((m: { id?: string }) => m.id === modelId);
    if (existing) {
      throw new Error(`模型 "${modelId}" 已存在`);
    }

    // 探测模型可用性
    // 用户手动添加自定义模型 — 探测失败只做警告，不阻止添加。
    // 原因：非 chat 类模型（图像生成、embedding 等）不走 /chat/completions，
    // 探测必然失败，但模型确实存在。只有 API Key 无效才阻止。
    const probe = await probeModel(providerId, modelId, providerConfig.apiKey);
    if (!probe.ok) {
      // API Key 明确无效 — 仍然阻止
      if (probe.fatal && /API Key 无效|已过期/.test(probe.message)) {
        throw new Error(probe.message);
      }
      // 其余错误（模型不存在、验证未通过等）降级为警告
      probeWarning = probe.message;
    }

    // 添加模型
    const inputTypes = params.input ?? ["text"];
    providerConfig.models.push({
      id: modelId,
      name: modelName || modelId,
      reasoning: false,
      input: inputTypes,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 131072,
      maxTokens: 8192,
    });

    await writeConfigFile(config);

    // 立即刷新 models.json，使新添加的自定义模型对 agent 运行时可见
    try {
      await ensureOpenClawCNModelsJson(config);
    } catch {
      /* 非关键 */
    }

    // 将新模型注入 capability registry，使 capability_matrix.query/summary
    // 立即可见，避免用户添加模型后在模型卡片上找不到
    try {
      const caps: ModelCapabilityCard["capabilities"] = {};
      if (inputTypes.includes("text")) {
        caps.text = 3;
        caps.code = 2; // 几乎所有 text 模型都能处理代码
      }
      if (inputTypes.includes("image")) caps.vision = 2;
      // 使用 alias 体系判断国内/国际，避免 "zhipu"/"doubao" 等别名被误判
      const aliases = getProviderAliases(providerId);
      const isDomestic = aliases.some((a) => !!CN_PROVIDERS[a]);
      upsertUserCard({
        provider: providerId,
        modelId,
        displayName: modelName || modelId,
        capabilities: caps,
        modelType: "chat",
        region: isDomestic ? "domestic" : "international",
        costTier: "standard",
        costPer1M: 0,
        maxContextTokens: 131072,
      });
    } catch {
      /* 非关键 — registry 未初始化时跳过 */
    }
  } finally {
    release!();
  }

  return { success: true, modelId, probeWarning };
}

// ===== OpenClawCN: Provider 健康状态 & 优先级 =====

import { getHealthSnapshot } from "../../dispatch/provider-health.js";

/**
 * Provider 健康信息（面向 UI）
 */
type ProviderHealthInfo = {
  providerId: string;
  status:
    | "normal"
    | "billing_error"
    | "auth_invalid"
    | "rate_limited"
    | "degraded"
    | "down"
    | "unknown";
  lastCheckedAt: number;
  failureCount: number;
  message?: string;
};

/**
 * 获取所有已配置 Provider 的健康状态
 */
export async function getProvidersHealth(): Promise<{
  health: Record<string, Omit<ProviderHealthInfo, "providerId">>;
}> {
  const providerStatus = await getProviderConfigStatus();
  const healthSnapshot = getHealthSnapshot();

  const healthMap: Record<string, Omit<ProviderHealthInfo, "providerId">> = {};

  for (const [providerId, configured] of providerStatus) {
    if (!configured) continue;

    const health = healthSnapshot[providerId];
    let status: ProviderHealthInfo["status"] = "normal";
    let message: string | undefined;

    if (health) {
      const reason = health.lastFailureReason;
      if (health.status === "down") {
        if (reason === "billing") {
          status = "billing_error";
          message = "余额不足";
        } else if (reason === "auth") {
          status = "auth_invalid";
          message = "API Key 无效或已过期";
        } else if (reason === "rate_limit") {
          status = "rate_limited";
          message = "频率限制中";
        } else {
          status = "down";
          message = "服务不可用";
        }
      } else if (health.status === "degraded") {
        if (reason === "billing") {
          status = "billing_error";
          message = "余额不足";
        } else if (reason === "auth") {
          status = "auth_invalid";
          message = "API Key 无效或已过期";
        } else {
          status = "degraded";
          message = "服务不稳定";
        }
      }
    }

    healthMap[providerId] = {
      status,
      lastCheckedAt: health ? Math.max(health.lastSuccessAt, health.lastFailureAt) : 0,
      failureCount: health?.failureCount ?? 0,
      message,
    };
  }

  return { health: healthMap };
}

/**
 * 测试 Provider 连接（零消耗 — 使用 GET /models 端点验证 API Key 有效性）
 *
 * 各厂商对应的免费验证端点：
 *   - OpenAI-compatible (大多数国内厂商): GET /v1/models
 *   - Anthropic: GET /v1/models (anthropic-version header required)
 *   - Google: GET /v1/models?key=xxx
 *   - Ollama: GET /api/tags
 *   - 腾讯混元: 认证方式特殊，跳过
 */
export async function testProviderConnection(params: { providerId: string }): Promise<{
  success: boolean;
  status: ProviderHealthInfo["status"];
  message: string;
}> {
  const { providerId } = params;
  const config = await loadConfig();
  const providerConfig = config.models?.providers?.[providerId] as
    | { apiKey?: string; baseUrl?: string; models?: Array<{ id?: string }> }
    | undefined;

  if (!providerConfig || !providerConfig.apiKey) {
    return { success: false, status: "auth_invalid", message: "未配置 API Key" };
  }

  const apiKey = providerConfig.apiKey;
  const cnProvider = CN_PROVIDERS[providerId];
  const baseUrl = cnProvider?.apiEndpoint ?? providerConfig.baseUrl ?? "";

  if (!baseUrl) {
    return { success: false, status: "unknown", message: "未配置 API 端点" };
  }

  // Ollama 特殊处理
  if (providerId === "ollama") {
    const ollamaBase = baseUrl.replace(/\/v1\/?$/, "");
    try {
      const resp = await fetch(`${ollamaBase}/api/tags`, { signal: AbortSignal.timeout(8000) });
      return resp.ok
        ? { success: true, status: "normal", message: "服务正常" }
        : { success: false, status: "down", message: `服务异常 (HTTP ${resp.status})` };
    } catch (err) {
      return {
        success: false,
        status: "down",
        message: `连接失败: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // 腾讯混元跳过
  if (providerId === "tencent-hunyuan") {
    return { success: true, status: "normal", message: "认证方式特殊，跳过验证" };
  }

  // 蚂蚁百灵 / 美团 LongCat: 不支持 GET /models，用最小 chat completions 验证
  const chatOnlyProviders: Record<string, { model: string }> = {
    "ant-ling": { model: "ling-1t" },
    "meituan-longcat": { model: "longcat-flash-chat" },
  };
  if (chatOnlyProviders[providerId]) {
    try {
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: chatOnlyProviders[providerId].model,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        return { success: true, status: "normal", message: "连接正常" };
      }
      const errText = await resp.text().catch(() => "");
      if (resp.status === 401 || resp.status === 403) {
        return { success: false, status: "auth_invalid", message: "API Key 无效" };
      }
      return {
        success: false,
        status: "down",
        message: `验证失败 (HTTP ${resp.status}): ${errText.substring(0, 200)}`,
      };
    } catch (err) {
      return {
        success: false,
        status: "down",
        message: `连接失败: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // 使用 GET /models 端点（零消耗验证）
  let testUrl: string;
  let testHeaders: Record<string, string>;

  if (providerId === "anthropic") {
    testUrl = `${baseUrl}/models`;
    testHeaders = { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
  } else if (providerId === "google") {
    testUrl = `${baseUrl}/models?key=${apiKey}`;
    testHeaders = {};
  } else {
    // OpenAI-compatible: kimi-code, aliyun-bailian, volcengine-ark, etc.
    testUrl = `${baseUrl}/models`;
    testHeaders = { Authorization: `Bearer ${apiKey}` };
  }

  try {
    const resp = await fetch(testUrl, {
      method: "GET",
      headers: testHeaders,
      signal: AbortSignal.timeout(10000),
    });

    if (resp.ok) {
      return { success: true, status: "normal", message: "连接正常" };
    }

    // 分类错误
    const errText = await resp.text().catch(() => "");
    let errorMsg = "验证失败";
    try {
      const errJson = JSON.parse(errText);
      errorMsg = errJson.error?.message ?? errJson.message ?? errorMsg;
    } catch {
      /* ignore parse error */
    }

    if (resp.status === 401 || resp.status === 403) {
      return { success: false, status: "auth_invalid", message: errorMsg || "API Key 无效" };
    }
    if (resp.status === 402) {
      return { success: false, status: "billing_error", message: errorMsg || "余额不足" };
    }
    if (resp.status === 429) {
      return { success: false, status: "rate_limited", message: errorMsg || "频率限制" };
    }
    return { success: false, status: "down", message: `${errorMsg} (HTTP ${resp.status})` };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("timeout") || errMsg.includes("ETIMEDOUT")) {
      return { success: false, status: "down", message: "连接超时" };
    }
    return { success: false, status: "down", message: `连接失败: ${errMsg}` };
  }
}

// ===== OpenClawCN: 连接预热（消除首次请求 DNS+TLS 冷启动延迟） =====
/**
 * 对指定 Provider 发起一次轻量级 GET /models 请求，预热 DNS、TLS、TCP 连接池。
 * 完全 fire-and-forget：不阻塞调用方、不抛异常、不影响业务逻辑。
 * 超时 5s —— 只需建立连接即可，不需要完整响应。
 */
function prewarmProviderConnection(providerId: string): void {
  // 异步执行，不 await
  void (async () => {
    try {
      const t0 = Date.now();
      log.debug(`prewarm: starting connection warm-up for ${providerId}`);

      const config = await loadConfig();
      const providerConfig = config.models?.providers?.[providerId] as
        | { apiKey?: string; baseUrl?: string }
        | undefined;
      if (!providerConfig?.apiKey) return;

      const cnProvider = CN_PROVIDERS[providerId];
      const baseUrl = cnProvider?.apiEndpoint ?? providerConfig.baseUrl ?? "";
      if (!baseUrl) return;

      // 跳过特殊 provider
      if (providerId === "tencent-hunyuan") return;

      let warmUrl: string;
      let warmHeaders: Record<string, string>;

      if (providerId === "ollama") {
        const ollamaBase = baseUrl.replace(/\/v1\/?$/, "");
        warmUrl = `${ollamaBase}/api/tags`;
        warmHeaders = {};
      } else if (providerId === "anthropic") {
        warmUrl = `${baseUrl}/models`;
        warmHeaders = { "x-api-key": providerConfig.apiKey, "anthropic-version": "2023-06-01" };
      } else if (providerId === "google") {
        warmUrl = `${baseUrl}/models?key=${providerConfig.apiKey}`;
        warmHeaders = {};
      } else {
        warmUrl = `${baseUrl}/models`;
        warmHeaders = { Authorization: `Bearer ${providerConfig.apiKey}` };
      }

      const resp = await fetch(warmUrl, {
        method: "GET",
        headers: warmHeaders,
        signal: AbortSignal.timeout(5000),
      });
      log.debug(
        `prewarm: ${providerId} warm-up done in ${Date.now() - t0}ms (HTTP ${resp.status})`,
      );
    } catch (err) {
      log.debug(
        `prewarm: ${providerId} warm-up failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  })();
}
// ===== END =====

/**
 * 根据 providerPriority 顺序，自动同步 modelCapability 和 agents.defaults.model.primary。
 *
 * 规则：
 * - 对每个能力，遍历 priority 找到第一个已配置且有该能力模型的 provider
 * - 如果该能力当前绑定标记了 auto === false（用户手动选择），跳过不覆盖
 * - 如果是 text 能力，同步设置 agents.defaults.model.primary
 *
 * 注意: 此函数直接修改传入的 config 对象（caller 负责 structuredClone + writeConfigFile）。
 */
function syncModelSelectionsFromPriority(config: OpenClawCNConfig, priority: string[]): void {
  const ALL_CAPABILITIES: Capability[] = [
    "text",
    "image-understanding",
    "image-generation",
    "video",
    "embedding",
  ];

  const configWithCap = config as { modelCapability?: ModelCapabilityConfig };
  if (!configWithCap.modelCapability) {
    configWithCap.modelCapability = { capabilities: {} };
  }
  const caps = configWithCap.modelCapability.capabilities;

  // 收集已配置（有 apiKey）的 provider 集合
  const configuredProviders = new Set<string>();
  if (config.models?.providers) {
    for (const [pid, pCfg] of Object.entries(config.models.providers)) {
      if (pCfg.apiKey) configuredProviders.add(pid);
    }
  }

  for (const capability of ALL_CAPABILITIES) {
    const existing = caps[capability];

    // 只有用户明确手动选择（auto === false）的才不覆盖
    // 旧数据无 auto 字段（undefined）视为可覆盖，否则旧配置永远不会被联动
    if (existing && existing.auto === false) {
      // 但要检查该 provider 是否还存在，不存在则清除
      if (!configuredProviders.has(existing.providerId)) {
        log.debug(`syncPriority: ${capability} 绑定的 ${existing.providerId} 已不存在，清除`);
        delete caps[capability];
        // 继续往下走自动分配逻辑
      } else {
        continue; // 手动选择且 provider 仍存在，保留
      }
    }

    // 按 priority 顺序找第一个已配置且有该能力模型的 provider
    const models = getModelsByCapability(capability);
    let assigned = false;
    for (const providerId of priority) {
      if (!configuredProviders.has(providerId)) continue;

      const match = models.find((m) => m.providerId === providerId && !m.model.agentOnly);
      if (match) {
        caps[capability] = {
          providerId,
          modelId: match.model.modelId,
          auto: true,
        };
        log.debug(`syncPriority: ${capability} → ${providerId}/${match.model.modelId} (auto)`);
        assigned = true;
        break;
      }
    }

    if (!assigned && existing) {
      // priority 中没有任何 provider 能提供该能力 — 清除旧的 auto 绑定
      delete caps[capability];
    }
  }

  // 同步 text 能力到 agents.defaults.model.primary
  const textBinding = caps["text"];
  if (textBinding) {
    if (!config.agents) config.agents = {};
    if (!config.agents.defaults) config.agents.defaults = {};
    const modelField = config.agents.defaults.model;
    const newPrimary = buildModelRef(textBinding.providerId, textBinding.modelId);
    if (typeof modelField === "object" && modelField !== null) {
      modelField.primary = newPrimary;
    } else {
      config.agents.defaults.model = { primary: newPrimary };
    }
    log.debug(`syncPriority: agents.defaults.model.primary → ${newPrimary}`);
  }
}

/**
 * 将所有 session 的 modelOverride / providerOverride 更新为新模型。
 *
 * 当全局模型配置变更（拖拽优先级 / 手动切换能力模型）时调用，
 * 使得当前会话下一条消息立即使用新模型，无需用户手动 /new。
 */
async function updateSessionModelOverrides(providerId: string, modelId: string): Promise<void> {
  try {
    const storePath = resolveStorePath();
    await updateSessionStore(storePath, (store) => {
      for (const entry of Object.values(store)) {
        if (entry.providerOverride !== providerId || entry.modelOverride !== modelId) {
          entry.providerOverride = providerId;
          entry.modelOverride = modelId;
          entry.updatedAt = Date.now();
        }
      }
    });
    log.debug(`updateSessionModelOverrides: all sessions → ${providerId}/${modelId}`);
  } catch (err) {
    // 非关键操作，不影响主流程
    log.debug(`updateSessionModelOverrides: failed (non-fatal): ${err}`);
  }
}

/**
 * 保存 Provider 优先级排序
 */
export async function saveProviderPriority(params: {
  priority: string[];
}): Promise<{ success: boolean }> {
  const { priority } = params;

  if (!Array.isArray(priority)) {
    throw new Error("priority must be an array of provider IDs");
  }
  if (priority.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error("Each priority entry must be a non-empty string");
  }

  const prev = _modelConfigWriteLock;
  let release: () => void;
  _modelConfigWriteLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await prev;
    const config = structuredClone(await loadConfig());
    config.providerPriority = priority;
    // 拖拽优先级 = 用户要求重新自动分配，清除所有手动选择标记
    const capsObj = (config as { modelCapability?: ModelCapabilityConfig }).modelCapability
      ?.capabilities;
    if (capsObj) {
      for (const cap of Object.values(capsObj)) {
        if (cap && cap.auto === false) cap.auto = true;
      }
    }
    // 同步 modelCapability 和 agents.defaults.model.primary
    syncModelSelectionsFromPriority(config, priority);
    await writeConfigFile(config);

    // 读取同步后的 text 能力绑定，更新所有 session 的模型覆盖
    const configWithCap = config as { modelCapability?: ModelCapabilityConfig };
    const textBinding = configWithCap.modelCapability?.capabilities?.["text"];
    if (textBinding) {
      await updateSessionModelOverrides(textBinding.providerId, textBinding.modelId);
    }
  } finally {
    release!();
  }

  return { success: true };
}

/**
 * 获取 Provider 优先级排序
 */
export async function getProviderPriority(): Promise<{ priority: string[] }> {
  const config = await loadConfig();
  const priority = config.providerPriority ?? [];
  return { priority };
}

// ===== END OpenClawCN =====
