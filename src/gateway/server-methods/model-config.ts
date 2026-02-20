/**
 * 模型设置 Gateway API
 *
 * 能力优先的模型管理，替代 free-models API
 */

import { loadConfig, writeConfigFile } from "../../config/config.js";
import {
  PROVIDER_CAPABILITY_MAPPINGS,
  PROVIDER_GROUPS,
  getModelsByCapability,
  getProviderCapabilities,
  CAPABILITY_NAMES,
  CAPABILITY_DESCRIPTIONS,
  CAPABILITY_ICONS,
  type Capability,
  type ProviderCapabilityMapping,
} from "../../config/provider-capability-mapping.js";
import type { OpenClawCNConfig } from "../../config/types.js";
import { CN_PROVIDERS } from "../../config/region-cn.js";
import type { ModelDefinitionConfig } from "../../config/types.models.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { resolveStorePath } from "../../config/sessions/paths.js";
import { updateSessionStore } from "../../config/sessions/store.js";

const log = createSubsystemLogger("gateway/model-config");

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
export interface ModelCapabilityConfig {
  capabilities: Partial<Record<Capability, CapabilityModelConfig>>;
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

async function saveModelCapabilityConfig(capabilityConfig: ModelCapabilityConfig): Promise<void> {
  const prev = _modelConfigWriteLock;
  let release: () => void;
  _modelConfigWriteLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await prev;
    // FIX MC-2: deep clone 防止污染 loadConfig() 的缓存对象
    // loadConfig() 返回缓存引用，直接 mutate 会导致其他读者看到未持久化的脏数据
    const config = structuredClone(await loadConfig());
    (config as { modelCapability?: ModelCapabilityConfig }).modelCapability = capabilityConfig;
    await writeConfigFile(config);
  } finally {
    release!();
  }
}

/**
 * 获取所有 Provider 的配置状态
 *
 * 注意: 这里混合了两种Provider:
 * 1. models.providers: 用户自己配置的Provider (openai, anthropic, siliconflow等)
 * 2. freeModels.accounts: ClawdbotCN提供的免费账号 (ant-ling, meituan-longcat)
 *
 * 这两者的providerId在不同的命名空间,不会冲突:
 * - PROVIDER_CAPABILITY_MAPPINGS只包含前者
 * - 免费模型的providerId不在PROVIDER_CAPABILITY_MAPPINGS中
 *
 * 因此这个混合逻辑是安全的,但需要注意未来如果要将免费模型
 * 也纳入PROVIDER_CAPABILITY_MAPPINGS,需要重新设计这部分逻辑
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

  // 检查免费模型账号 (ClawdbotCN提供,命名空间不同,不会冲突)
  const freeModels = (
    config as { freeModels?: { accounts?: Array<{ providerId: string; enabled: boolean }> } }
  ).freeModels;
  if (freeModels?.accounts) {
    for (const account of freeModels.accounts) {
      providers.set(account.providerId, account.enabled);
    }
  }

  return providers;
}

/**
 * API: 获取所有能力及其状态
 */
export async function listCapabilities() {
  const capabilityConfig = await getModelCapabilityConfig();
  const providerStatus = await getProviderConfigStatus();
  const config = await loadConfig();

  const capabilities: Capability[] = [
    "text",
    "image-understanding",
    "image-generation",
    "video",
    "embedding",
  ];

  const result = [];

  for (const capability of capabilities) {
    const currentConfig = capabilityConfig.capabilities[capability];

    // 获取该能力的所有可用模型
    const availableModels = getModelsByCapability(capability);
    const configuredModels = availableModels.filter((m) => providerStatus.get(m.providerId));

    let currentModel = null;
    if (currentConfig && providerStatus.get(currentConfig.providerId)) {
      // 找到当前使用的模型信息（先从 PROVIDER_CAPABILITY_MAPPINGS 查找）
      const modelInfo = availableModels.find(
        (m) =>
          m.providerId === currentConfig.providerId && m.model.modelId === currentConfig.modelId,
      );

      if (modelInfo) {
        currentModel = {
          providerId: modelInfo.providerId,
          providerName: modelInfo.providerName,
          modelId: modelInfo.model.modelId,
          modelName: modelInfo.model.modelName,
          isFree: modelInfo.model.pricing.type === "free",
        };
      } else {
        // FIX: Provider 可能是通过 setup wizard 配置的，其 providerId 不在
        // PROVIDER_CAPABILITY_MAPPINGS 中（如 "qwen-dashscope" vs "aliyun-bailian"）。
        // 从 config.models.providers 中获取模型信息，避免已配置的能力显示为 inactive。
        const providerModels = config.models?.providers?.[currentConfig.providerId]?.models;
        const rawModel = providerModels?.find(
          (m: { id?: string }) => m.id === currentConfig.modelId,
        );
        currentModel = {
          providerId: currentConfig.providerId,
          providerName:
            PROVIDER_CAPABILITY_MAPPINGS[currentConfig.providerId]?.name ??
            currentConfig.providerId,
          modelId: currentConfig.modelId,
          modelName: rawModel?.name ?? currentConfig.modelId,
          isFree: false,
        };
      }
    }
    // 🔥 关键修复: 移除自动fallback,必须由用户明确选择
    // 如果用户没有配置该能力,currentModel保持null
    // 前端会显示"开通这个功能"按钮,引导用户主动配置

    result.push({
      capability,
      name: CAPABILITY_NAMES[capability],
      description: CAPABILITY_DESCRIPTIONS[capability],
      icon: CAPABILITY_ICONS[capability],
      status: currentModel ? "active" : "inactive",
      currentModel,
      availableModels: configuredModels.length,
    });
  }

  return { capabilities: result };
}

/**
 * API: 获取某个能力的所有可用模型
 */
export async function getCapabilityModels(params: { capability: Capability }) {
  const { capability } = params;

  const capabilityConfig = await getModelCapabilityConfig();
  const providerStatus = await getProviderConfigStatus();

  const currentConfig = capabilityConfig.capabilities[capability];
  const allModels = getModelsByCapability(capability);

  const models = allModels.map((m) => ({
    providerId: m.providerId,
    providerName: m.providerName,
    providerIcon: m.providerIcon,
    modelId: m.model.modelId,
    modelName: m.model.modelName,
    pricing: m.model.pricing,
    configured: providerStatus.get(m.providerId) || false,
    active:
      currentConfig?.providerId === m.providerId && currentConfig?.modelId === m.model.modelId,
  }));

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
  capability: Capability;
  providerId: string;
  modelId: string;
}) {
  const { capability, providerId, modelId } = params;

  // 验证该 Provider 是否已配置
  const providerStatus = await getProviderConfigStatus();
  if (!providerStatus.get(providerId)) {
    return {
      success: false,
      error: `服务商 ${providerId} 尚未配置，请先添加配置`,
    };
  }

  // 验证该模型是否支持该能力
  const allModels = getModelsByCapability(capability);
  const targetModel = allModels.find(
    (m) => m.providerId === providerId && m.model.modelId === modelId,
  );

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
      const newPrimary = `${providerId}/${modelId}`;
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
 * API: 自动检测 Provider 的所有模型
 */
export async function detectProviderModels(params: { providerId: string; apiKey: string }) {
  const { providerId, apiKey } = params;

  // 获取该 Provider 的映射配置
  const mapping = PROVIDER_CAPABILITY_MAPPINGS[providerId];
  if (!mapping) {
    return {
      success: false,
      error: `未知的服务商: ${providerId}`,
    };
  }

  // 简单验证：只测试第一个模型
  const firstModel = mapping.models[0];
  if (!firstModel) {
    return {
      success: false,
      error: `该服务商没有可用模型`,
    };
  }

  // 严格 API Key 验证 — 与 setup 页面保持一致
  // 必须验证通过才能保存配置
  const cnProvider = CN_PROVIDERS[providerId];
  const baseUrl = cnProvider?.apiEndpoint ?? "";
  const trimmedKey = apiKey.trim();

  // 基本格式验证（ollama 允许短 key）
  const minKeyLength = providerId === "ollama" ? 1 : 10;
  if (trimmedKey.length < minKeyLength) {
    return {
      success: false,
      error: "API Key 格式不正确，长度不足",
    };
  }

  // API Key 必须是 ASCII 可打印字符，非 ASCII（如中文）会导致 HTTP header ByteString 错误
  if (!/^[\x20-\x7E]+$/.test(trimmedKey)) {
    return {
      success: false,
      error: "API Key 格式不正确，包含非法字符（仅允许 ASCII 字符）",
    };
  }

  if (baseUrl) {
    // 构建 provider 特定的测试请求（与 setup-wizard-handlers 一致）
    let testUrl: string;
    let testHeaders: Record<string, string>;
    let testBody: string;
    const testModel = firstModel.modelId;

    if (providerId === "kimi-code") {
      testUrl = `${baseUrl}/chat/completions`;
      testHeaders = {
        Authorization: `Bearer ${trimmedKey}`,
        "Content-Type": "application/json",
        "User-Agent": "KimiCLI/0.77",
      };
      testBody = JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
      });
    } else if (providerId === "anthropic") {
      testUrl = `${baseUrl}/messages`;
      testHeaders = {
        "x-api-key": trimmedKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      };
      testBody = JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
      });
    } else if (providerId === "minimax") {
      testUrl = `${baseUrl}/v1/messages`;
      testHeaders = {
        "x-api-key": trimmedKey,
        Authorization: `Bearer ${trimmedKey}`,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      };
      testBody = JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
      });
    } else if (providerId === "google") {
      testUrl = `${baseUrl}/models/${testModel}:generateContent?key=${trimmedKey}`;
      testHeaders = { "Content-Type": "application/json" };
      testBody = JSON.stringify({
        contents: [{ parts: [{ text: "Hi" }] }],
      });
    } else if (providerId === "tencent-hunyuan") {
      // 腾讯混元认证方式特殊，跳过实际验证
      testUrl = "";
      testHeaders = {};
      testBody = "";
    } else if (providerId === "ollama") {
      // Ollama 本地模型：检测服务是否运行
      const ollamaBase = baseUrl.replace(/\/v1\/?$/, "");
      try {
        const tagsResp = await fetch(`${ollamaBase}/api/tags`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!tagsResp.ok) {
          return {
            success: false,
            error: `Ollama 服务响应异常 (HTTP ${tagsResp.status})，请检查 Ollama 是否正常运行`,
          };
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes("fetch failed") || errMsg.includes("ECONNREFUSED")) {
          return {
            success: false,
            error: "无法连接到 Ollama 服务，请确认 Ollama 正在运行",
          };
        }
        return {
          success: false,
          error: `Ollama 连接失败: ${errMsg}`,
        };
      }
      testUrl = "";
      testHeaders = {};
      testBody = "";
    } else {
      // 通用 OpenAI 兼容（siliconflow, deepseek, aliyun-bailian, glm, volcengine-ark, moonshot, openai, nvidia 等）
      testUrl = `${baseUrl}/chat/completions`;
      testHeaders = {
        Authorization: `Bearer ${trimmedKey}`,
        "Content-Type": "application/json",
      };
      testBody = JSON.stringify({
        model: testModel,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
      });
    }

    // 发起验证请求（跳过无需实际验证的 provider）
    if (testUrl) {
      try {
        const testResp = await fetch(testUrl, {
          method: "POST",
          headers: testHeaders,
          body: testBody,
          signal: AbortSignal.timeout(15000),
        });

        if (!testResp.ok) {
          // 非 200 响应 — 解析错误信息
          const errText = await testResp.text().catch(() => "");
          let errorMessage = "API Key 验证失败";

          try {
            const errJson = JSON.parse(errText);
            if (errJson.error?.message) {
              errorMessage = errJson.error.message;
            } else if (errJson.message) {
              errorMessage = errJson.message;
            }
          } catch {
            if (testResp.status === 401) {
              errorMessage = "API Key 无效或已过期";
            } else if (testResp.status === 403) {
              errorMessage = "API Key 权限不足";
            } else if (testResp.status === 429) {
              errorMessage = "请求频率超限，请稍后重试";
            } else if (errText) {
              errorMessage = `验证失败 (${testResp.status}): ${errText.slice(0, 200)}`;
            }
          }

          return {
            success: false,
            error: errorMessage,
          };
        }
        // response.ok → 验证通过，继续保存
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes("timeout") || errMsg.includes("ETIMEDOUT")) {
          return {
            success: false,
            error: "连接超时，请检查网络或稍后重试",
          };
        }
        return {
          success: false,
          error: `验证失败: ${errMsg}`,
        };
      }
    }
  }

  const models = mapping.models.map((model) => ({
    modelId: model.modelId,
    modelName: model.modelName,
    capabilities: model.capabilities,
    available: true,
  }));

  // 自动选择默认模型（优先免费）
  const autoEnabled: Partial<Record<Capability, string>> = {};

  for (const capability of [
    "text",
    "image-understanding",
    "image-generation",
    "video",
    "embedding",
  ] as Capability[]) {
    const capabilityModels = mapping.models.filter((m) => m.capabilities.includes(capability));
    if (capabilityModels.length > 0) {
      const freeModel = capabilityModels.find((m) => m.pricing.type === "free");
      const defaultModel = freeModel || capabilityModels[0];
      autoEnabled[capability] = defaultModel.modelId;
    }
  }

  // 🔥 关键修复: 必须保存配置到文件,否则刷新后丢失
  // 🔥 BUG #6 修复: 合并两次写入为一次原子操作,避免配置覆盖竞争
  // FIX R3-7: 使用 _modelConfigWriteLock 串行化，防止与 saveModelCapabilityConfig 并发写入导致互相覆盖
  const prev = _modelConfigWriteLock;
  let release: () => void;
  _modelConfigWriteLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await prev;

    // FIX MC-2: deep clone 防止污染 loadConfig() 的缓存对象
    // loadConfig() 返回缓存引用，直接 mutate 会导致其他读者看到未持久化的脏数据；
    // 且如果后续 writeConfigFile() 失败，缓存中的脏数据不会被回滚
    const config = structuredClone(await loadConfig());

    // 1. 保存 Provider 配置 (baseUrl + apiKey + models) 到 config.models.providers
    //    与 setup 页面保持一致: 必须包含 baseUrl 和 models,否则 Zod 校验失败
    if (!config.models) {
      config.models = { providers: {} };
    }
    if (!config.models.providers) {
      config.models.providers = {};
    }

    // baseUrl 已在函数顶部从 CN_PROVIDERS 获取（MC-4 验证也复用此值）
    if (!baseUrl) {
      return {
        success: false,
        error: `无法获取服务商 ${providerId} 的 API 端点`,
      };
    }

    // 从 PROVIDER_CAPABILITY_MAPPINGS 构建 ModelDefinitionConfig[] (与 setup 页面格式一致)
    const modelDefinitions: ModelDefinitionConfig[] = mapping.models.map((m) => ({
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

    // 2. 保存自动启用的能力配置 (在同一个config对象上操作)
    // 🔥 重要: 只在能力未配置时才自动启用,避免覆盖用户已有配置
    const configWithCapability = config as { modelCapability?: ModelCapabilityConfig };
    if (!configWithCapability.modelCapability) {
      configWithCapability.modelCapability = { capabilities: {} };
    }

    for (const [capability, modelId] of Object.entries(autoEnabled)) {
      const cap = capability as Capability;
      // 只在该能力尚未配置时才自动启用
      if (!configWithCapability.modelCapability.capabilities[cap]) {
        configWithCapability.modelCapability.capabilities[cap] = {
          providerId,
          modelId: modelId as string,
          auto: true, // 自动分配，后续优先级同步可覆盖
        };
      }
    }

    // 一次性写入,避免两次写入导致的竞争
    try {
      await writeConfigFile(config);
    } catch (writeErr) {
      // 配置写入失败（可能是 Zod 校验失败）— 返回明确错误而非静默失败
      console.error("[model-config] writeConfigFile failed:", writeErr);
      return {
        success: false,
        error: `配置保存失败: ${writeErr instanceof Error ? writeErr.message : String(writeErr)}`,
      };
    }
  } finally {
    release!();
  }

  return {
    success: true,
    models,
    autoEnabled,
  };
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
          delete configWithCapability.modelCapability.capabilities[cap as Capability];
        }
      }
    }

    // 3. 如果有 providerPriority，重新按优先级分配被清除的能力
    if (config.providerPriority?.length) {
      syncModelSelectionsFromPriority(config, config.providerPriority);
    }

    await writeConfigFile(config);
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
  } finally {
    release!();
  }

  return { success: true, modelId };
}

// ===== OpenClawCN: Provider 健康状态 & 优先级 =====

import { getHealthSnapshot, type ProviderHealthStatus } from "../../dispatch/provider-health.js";

/**
 * Provider 健康信息（面向 UI）
 */
export type ProviderHealthInfo = {
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
async function getProvidersHealth(): Promise<{
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
async function testProviderConnection(params: { providerId: string }): Promise<{
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
      return { success: false, status: "down", message: `验证失败 (HTTP ${resp.status}): ${errText.substring(0, 200)}` };
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
function syncModelSelectionsFromPriority(
  config: OpenClawCNConfig,
  priority: string[],
): void {
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
        log.debug(
          `syncPriority: ${capability} → ${providerId}/${match.model.modelId} (auto)`,
        );
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
    const newPrimary = `${textBinding.providerId}/${textBinding.modelId}`;
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
async function saveProviderPriority(params: { priority: string[] }): Promise<{ success: boolean }> {
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
    const capsObj = (config as { modelCapability?: ModelCapabilityConfig }).modelCapability?.capabilities;
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
async function getProviderPriority(): Promise<{ priority: string[] }> {
  const config = await loadConfig();
  const priority = config.providerPriority ?? [];
  return { priority };
}

// ===== END OpenClawCN =====

/**
 * 注册 Gateway API handlers
 *
 * 注意: Gateway 框架要求 handler 通过 respond() 回调返回结果,
 * 而不是直接 return。这里包装每个业务函数,适配 GatewayRequestHandler 签名。
 */
export const MODEL_CONFIG_HANDLERS: Record<string, import("./types.js").GatewayRequestHandler> = {
  "modelConfig.capabilities.list": async ({ respond }) => {
    try {
      const result = await listCapabilities();
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
    }
  },
  "modelConfig.capability.models": async ({ params, respond }) => {
    try {
      const result = await getCapabilityModels(params as { capability: Capability });
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
    }
  },
  "modelConfig.capability.switchModel": async ({ params, respond }) => {
    try {
      const result = await switchCapabilityModel(
        params as { capability: Capability; providerId: string; modelId: string },
      );
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
    }
  },
  "modelConfig.provider.detect": async ({ params, respond }) => {
    try {
      const result = await detectProviderModels(params as { providerId: string; apiKey: string });
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
    }
  },
  "modelConfig.providers.list": async ({ respond }) => {
    try {
      const result = await listProviders();
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
    }
  },
  "modelConfig.providerGroups.list": async ({ respond }) => {
    try {
      respond(true, { groups: PROVIDER_GROUPS }, undefined);
    } catch (err) {
      respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
    }
  },
  "modelConfig.provider.getConfig": async ({ params, respond }) => {
    try {
      const result = await getProviderConfig(params as { providerId: string });
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
    }
  },
  "modelConfig.provider.delete": async ({ params, respond }) => {
    try {
      const result = await deleteProviderConfig(params as { providerId: string });
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
    }
  },
  "modelConfig.provider.addModel": async ({ params, respond }) => {
    try {
      const result = await addCustomModel(
        params as {
          providerId: string;
          modelId: string;
          modelName?: string;
          input?: Array<"text" | "image" | "video">;
        },
      );
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
    }
  },
  // ===== OpenClawCN: Provider 健康状态 & 优先级 API =====
  "modelConfig.providers.health": async ({ respond }) => {
    try {
      const result = await getProvidersHealth();
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
    }
  },
  "modelConfig.provider.testConnection": async ({ params, respond }) => {
    try {
      const result = await testProviderConnection(params as { providerId: string });
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
    }
  },
  "modelConfig.providers.savePriority": async ({ params, respond }) => {
    try {
      const result = await saveProviderPriority(params as { priority: string[] });
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
    }
  },
  "modelConfig.providers.getPriority": async ({ respond }) => {
    try {
      const result = await getProviderPriority();
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, { code: "INTERNAL_ERROR", message: String(err) });
    }
  },
  // ===== END OpenClawCN =====
};
