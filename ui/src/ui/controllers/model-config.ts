/**
 * 模型配置 Controller
 * 能力优先的模型管理,调用 Gateway 的 modelConfig.* API
 */

export interface Capability {
  capability: string;
  name: string;
  description: string;
  icon: string;
  status: "active" | "inactive";
  currentModel: {
    providerId: string;
    providerName: string;
    modelId: string;
    modelName: string;
    isFree: boolean;
  } | null;
  availableModels: number;
}

export interface ModelInfo {
  providerId: string;
  providerName: string;
  providerIcon: string;
  modelId: string;
  modelName: string;
  pricing: {
    type: "free" | "paid";
    details?: string;
  };
  configured: boolean;
  active: boolean;
}

export interface ProviderInfo {
  providerId: string;
  name: string;
  icon: string;
  group: string;
  tagline: string;
  apiKeyUrl: string;
  apiKeyGuide: string[];
  capabilities: string[];
  configured: boolean;
  activeModels: number;
}

export interface ProviderGroupInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultExpanded: boolean;
  order: number;
  expanded: boolean;
}

export type ProviderConfigStep = "guide" | "apikey" | "detecting" | "result";

export interface ModelConfigState {
  // 数据加载状态
  modelConfigLoading: boolean;
  modelConfigError: string | null;

  // 能力列表
  capabilities: Capability[];

  // 模型选择器状态
  modelSelectorOpen: boolean;
  modelSelectorCapability: Capability | null;
  modelSelectorModels: ModelInfo[];
  modelSelectorLoading: boolean;
  modelSelectorSwitching: boolean;

  // Provider 配置状态
  providerConfigOpen: boolean;
  providerConfigProvider: ProviderInfo | null;
  providerConfigApiKey: string;
  providerConfigTesting: boolean;
  providerConfigTestResult: { success: boolean; message: string } | null;
  providerConfigDetecting: boolean;
  providerConfigStep: ProviderConfigStep;
  providerConfigAutoEnabled: Record<string, string> | null;

  // Provider 列表
  providers: ProviderInfo[];

  // Provider 分组
  providerGroups: ProviderGroupInfo[];
}

type ModelConfigHost = ModelConfigState & {
  client: { request: (method: string, params?: unknown) => Promise<unknown> } | null;
  connected: boolean;
};

/**
 * 创建初始状态
 */
export function createInitialModelConfigState(): ModelConfigState {
  return {
    modelConfigLoading: false,
    modelConfigError: null,
    capabilities: [],
    modelSelectorOpen: false,
    modelSelectorCapability: null,
    modelSelectorModels: [],
    modelSelectorLoading: false,
    modelSelectorSwitching: false,
    providerConfigOpen: false,
    providerConfigProvider: null,
    providerConfigApiKey: "",
    providerConfigTesting: false,
    providerConfigTestResult: null,
    providerConfigDetecting: false,
    providerConfigStep: "guide",
    providerConfigAutoEnabled: null,
    providers: [],
    providerGroups: [],
  };
}

/**
 * 加载能力列表
 */
export async function loadCapabilities(host: ModelConfigHost): Promise<void> {
  if (!host.client || !host.connected) {
    host.modelConfigError = "未连接到 Gateway";
    host.modelConfigLoading = false;
    return;
  }

  host.modelConfigLoading = true;
  host.modelConfigError = null;

  try {
    const result = await host.client.request("modelConfig.capabilities.list");
    const data = result as { capabilities: Capability[] };
    host.capabilities = data.capabilities ?? [];
  } catch (err) {
    host.modelConfigError = `加载失败: ${String(err)}`;
  } finally {
    host.modelConfigLoading = false;
  }
}

/**
 * 加载 Provider 分组元数据
 */
export async function loadProviderGroups(host: ModelConfigHost): Promise<void> {
  if (!host.client || !host.connected) return;

  try {
    const result = await host.client.request("modelConfig.providerGroups.list");
    const data = result as { groups: Array<{ id: string; name: string; description: string; icon: string; defaultExpanded: boolean; order: number }> };
    host.providerGroups = (data.groups ?? []).map(g => ({
      ...g,
      expanded: g.defaultExpanded,
    }));
  } catch (err) {
    host.modelConfigError = `加载分组失败: ${String(err)}`;
  }
}

/**
 * 切换 Provider 分组的展开/收起
 */
export function toggleProviderGroup(host: ModelConfigHost, groupId: string): void {
  host.providerGroups = host.providerGroups.map(g =>
    g.id === groupId ? { ...g, expanded: !g.expanded } : g
  );
}

/**
 * 打开模型选择器
 */
export async function openModelSelector(
  host: ModelConfigHost,
  capability: Capability
): Promise<void> {
  if (!host.client || !host.connected) return;

  host.modelSelectorOpen = true;
  host.modelSelectorCapability = capability;
  host.modelSelectorModels = [];
  host.modelSelectorLoading = true;

  try {
    const result = await host.client.request("modelConfig.capability.models", {
      capability: capability.capability,
    });
    const data = result as { models: ModelInfo[] };
    host.modelSelectorModels = data.models ?? [];
  } catch (err) {
    host.modelConfigError = `加载模型列表失败: ${String(err)}`;
    closeModelSelector(host);
  } finally {
    host.modelSelectorLoading = false;
  }
}

/**
 * 关闭模型选择器
 */
export function closeModelSelector(host: ModelConfigHost): void {
  host.modelSelectorOpen = false;
  host.modelSelectorCapability = null;
  host.modelSelectorModels = [];
  host.modelSelectorLoading = false;
  host.modelSelectorSwitching = false;
}

/**
 * 切换模型
 */
export async function switchModel(
  host: ModelConfigHost,
  providerId: string,
  modelId: string
): Promise<void> {
  if (!host.client || !host.connected) return;
  if (!host.modelSelectorCapability) return;

  host.modelSelectorSwitching = true;

  try {
    const result = await host.client.request("modelConfig.capability.switchModel", {
      capability: host.modelSelectorCapability.capability,
      providerId,
      modelId,
    });

    const data = result as { success: boolean; error?: string };

    if (data.success) {
      closeModelSelector(host);
      await loadCapabilities(host);
    } else {
      host.modelConfigError = data.error ?? "切换失败";
    }
  } catch (err) {
    host.modelConfigError = `切换失败: ${String(err)}`;
  } finally {
    host.modelSelectorSwitching = false;
  }
}

/**
 * 加载 Provider 列表
 */
export async function loadProviders(host: ModelConfigHost): Promise<void> {
  if (!host.client || !host.connected) return;

  try {
    const result = await host.client.request("modelConfig.providers.list");
    const data = result as { providers: ProviderInfo[] };
    host.providers = data.providers ?? [];
  } catch (err) {
    host.modelConfigError = `加载 Provider 列表失败: ${String(err)}`;
  }
}

/**
 * 打开 Provider 配置弹窗
 */
export function openProviderConfig(host: ModelConfigHost, provider: ProviderInfo): void {
  host.providerConfigOpen = true;
  host.providerConfigProvider = provider;
  host.providerConfigApiKey = "";
  host.providerConfigTesting = false;
  host.providerConfigTestResult = null;
  host.providerConfigDetecting = false;
  host.providerConfigAutoEnabled = null;
  // 有引导步骤则先显示引导,否则直接到 API Key 输入
  host.providerConfigStep = (provider.apiKeyGuide && provider.apiKeyGuide.length > 0) ? "guide" : "apikey";
}

/**
 * 关闭 Provider 配置弹窗
 */
export function closeProviderConfig(host: ModelConfigHost): void {
  host.providerConfigOpen = false;
  host.providerConfigProvider = null;
  host.providerConfigApiKey = "";
  host.providerConfigTesting = false;
  host.providerConfigTestResult = null;
  host.providerConfigDetecting = false;
  host.providerConfigStep = "guide";
  host.providerConfigAutoEnabled = null;
}

/**
 * 更新 API Key
 */
export function updateProviderApiKey(host: ModelConfigHost, apiKey: string): void {
  host.providerConfigApiKey = apiKey;
  host.providerConfigTestResult = null;
}

/**
 * Provider 配置向导：进入下一步
 */
export function providerConfigNextStep(host: ModelConfigHost): void {
  if (host.providerConfigStep === "guide") {
    host.providerConfigStep = "apikey";
  }
}

/**
 * Provider 配置向导：返回上一步
 */
export function providerConfigPrevStep(host: ModelConfigHost): void {
  if (host.providerConfigStep === "apikey") {
    host.providerConfigStep = "guide";
  }
}

/**
 * 从模型选择器跳转到 Provider 配置
 */
export function navigateToProviderConfig(host: ModelConfigHost, providerId: string): void {
  const provider = host.providers.find(p => p.providerId === providerId);
  if (!provider) return;

  closeModelSelector(host);
  openProviderConfig(host, provider);
}

/**
 * 自动检测并配置 Provider
 */
export async function detectAndConfigureProvider(host: ModelConfigHost): Promise<void> {
  if (!host.client || !host.connected) return;
  if (!host.providerConfigProvider) return;

  host.providerConfigDetecting = true;
  host.providerConfigTestResult = null;
  host.providerConfigStep = "detecting";

  try {
    const result = await host.client.request("modelConfig.provider.detect", {
      providerId: host.providerConfigProvider.providerId,
      apiKey: host.providerConfigApiKey,
    });

    const data = result as {
      success: boolean;
      error?: string;
      models?: Array<{
        modelId: string;
        modelName: string;
        capabilities: string[];
        available: boolean;
      }>;
      autoEnabled?: Record<string, string>;
    };

    if (data.success) {
      const enabledCount = Object.keys(data.autoEnabled ?? {}).length;
      host.providerConfigTestResult = {
        success: true,
        message: `配置成功！已自动启用 ${enabledCount} 个能力`,
      };
      host.providerConfigAutoEnabled = (data.autoEnabled as Record<string, string>) ?? null;
      host.providerConfigStep = "result";

      // 延迟关闭弹窗,让用户看到成功提示
      setTimeout(() => {
        closeProviderConfig(host);
        loadCapabilities(host);
        loadProviders(host);
      }, 2000);
    } else {
      host.providerConfigTestResult = {
        success: false,
        message: translateProviderError(data.error ?? "配置失败"),
      };
      host.providerConfigStep = "apikey";
    }
  } catch (err) {
    host.providerConfigTestResult = {
      success: false,
      message: `配置失败: ${String(err)}`,
    };
    host.providerConfigStep = "apikey";
  } finally {
    host.providerConfigDetecting = false;
  }
}

/**
 * 翻译 Provider 错误信息
 */
function translateProviderError(error: string): string {
  const errorMap: Record<string, string> = {
    "Invalid API key": "API 密钥无效,请检查格式",
    "Unauthorized": "未授权,请检查 API 密钥",
    "Authentication failed": "认证失败,请重新获取 API 密钥",
    "fetch failed": "网络请求失败,请检查网络连接",
    "ECONNREFUSED": "无法连接到服务器,请稍后重试",
    "ETIMEDOUT": "连接超时,请稍后重试",
    "未知的服务商": "不支持的模型提供商",
    "该服务商没有可用模型": "该服务商没有可用模型",
  };

  for (const [key, value] of Object.entries(errorMap)) {
    if (error.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  return `配置失败: ${error}`;
}
