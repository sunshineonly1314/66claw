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

/**
 * 能力配置类型
 */
interface CapabilityModelConfig {
  providerId: string;
  modelId: string;
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
      // 找到当前使用的模型信息
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

  // 更新配置
  const capabilityConfig = await getModelCapabilityConfig();
  capabilityConfig.capabilities[capability] = { providerId, modelId };
  await saveModelCapabilityConfig(capabilityConfig);

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

  // FIX MC-4: 轻量级 API Key 验证 — 发送最小请求测试 key 是否有效
  // 避免无效 key 保存后，用户在实际使用时才发现错误
  const cnProvider = CN_PROVIDERS[providerId];
  const baseUrl = cnProvider?.apiEndpoint ?? "";
  if (baseUrl && apiKey) {
    try {
      const testResp = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: firstModel.modelId,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(15000),
      });
      // 401/403 = invalid key; other errors (500, 429) may be transient, allow through
      if (testResp.status === 401 || testResp.status === 403) {
        const errBody = await testResp.text().catch(() => "");
        return {
          success: false,
          error: `API Key 无效 (${testResp.status}): 请检查密钥是否正确。${errBody ? ` ${errBody.slice(0, 200)}` : ""}`,
        };
      }
    } catch (err) {
      // 网络超时/DNS 失败等：不阻塞配置保存，只记录警告
      console.warn(
        `[model-config] API key validation request failed for ${providerId}:`,
        err instanceof Error ? err.message : String(err),
      );
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
      apiKey,
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
        };
      }
    }

    // 一次性写入,避免两次写入导致的竞争
    await writeConfigFile(config);
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

  const providers = [];

  for (const [providerId, mapping] of Object.entries(PROVIDER_CAPABILITY_MAPPINGS)) {
    const configured = providerStatus.get(providerId) || false;

    // 计算有多少模型正在使用
    // FIX R3-10: Partial<Record> 的值可能为 undefined，需要 optional chain 防止 TypeError
    let activeModels = 0;
    for (const [capability, config] of Object.entries(capabilityConfig.capabilities)) {
      if (config?.providerId === providerId) {
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
      respond(false, undefined, { code: -1, message: String(err) });
    }
  },
  "modelConfig.capability.models": async ({ params, respond }) => {
    try {
      const result = await getCapabilityModels(params as { capability: Capability });
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, { code: -1, message: String(err) });
    }
  },
  "modelConfig.capability.switchModel": async ({ params, respond }) => {
    try {
      const result = await switchCapabilityModel(
        params as { capability: Capability; providerId: string; modelId: string },
      );
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, { code: -1, message: String(err) });
    }
  },
  "modelConfig.provider.detect": async ({ params, respond }) => {
    try {
      const result = await detectProviderModels(params as { providerId: string; apiKey: string });
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, { code: -1, message: String(err) });
    }
  },
  "modelConfig.providers.list": async ({ respond }) => {
    try {
      const result = await listProviders();
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, { code: -1, message: String(err) });
    }
  },
  "modelConfig.providerGroups.list": async ({ respond }) => {
    try {
      respond(true, { groups: PROVIDER_GROUPS }, undefined);
    } catch (err) {
      respond(false, undefined, { code: -1, message: String(err) });
    }
  },
};
