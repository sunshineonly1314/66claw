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

/** Provider 健康状态信息 */
export interface ProviderHealthInfo {
  status: "normal" | "billing_error" | "auth_invalid" | "rate_limited" | "degraded" | "down" | "unknown";
  message?: string;
  lastCheckedAt: number;
}

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
  providerConfigCustomModel: string;
  providerConfigTesting: boolean;
  providerConfigTestResult: { success: boolean; message: string } | null;
  providerConfigDetecting: boolean;
  providerConfigStep: ProviderConfigStep;
  providerConfigAutoEnabled: Record<string, string> | null;

  // Provider 列表
  providers: ProviderInfo[];

  // Provider 分组
  providerGroups: ProviderGroupInfo[];

  // Provider 管理弹窗状态
  providerManageOpen: boolean;
  providerManageTarget: ProviderInfo | null;
  providerManageApiKey: string;
  providerManageDeleting: boolean;
  providerManageError: string | null;

  // OpenClawCN: Provider 健康状态
  providerHealthMap: Record<string, ProviderHealthInfo>;
  providerHealthLoading: boolean;

  // OpenClawCN: Provider 优先级排序
  providerPriority: string[];
  providerPrioritySaving: boolean;

  // OpenClawCN: 测试连接
  providerTestingId: string | null;
  providerTestResult: { providerId: string; success: boolean; status: string; message: string } | null;
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
    providerConfigCustomModel: "",
    providerConfigTesting: false,
    providerConfigTestResult: null,
    providerConfigDetecting: false,
    providerConfigStep: "guide",
    providerConfigAutoEnabled: null,
    providers: [],
    providerGroups: [],
    providerManageOpen: false,
    providerManageTarget: null,
    providerManageApiKey: "",
    providerManageDeleting: false,
    providerManageError: null,
    // OpenClawCN: Provider 健康状态
    providerHealthMap: {},
    providerHealthLoading: false,
    // OpenClawCN: Provider 优先级排序
    providerPriority: [],
    providerPrioritySaving: false,
    // OpenClawCN: 测试连接
    providerTestingId: null,
    providerTestResult: null,
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
      // text 能力切换后静默 /new，让新模型立即生效
      const isText = host.modelSelectorCapability?.capability === "text";
      closeModelSelector(host);
      await loadCapabilities(host);
      if (isText) {
        globalThis.dispatchEvent?.(new CustomEvent("openclawcn:silent-new"));
      }
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
  host.providerConfigCustomModel = "";
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
 * 更新自定义模型名
 */
export function updateProviderCustomModel(host: ModelConfigHost, customModel: string): void {
  host.providerConfigCustomModel = customModel;
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
/** 检测超时时间 (30秒) */
const DETECT_TIMEOUT_MS = 30_000;

export async function detectAndConfigureProvider(host: ModelConfigHost): Promise<void> {
  if (!host.client || !host.connected) return;
  if (!host.providerConfigProvider) return;

  host.providerConfigDetecting = true;
  host.providerConfigTestResult = null;
  host.providerConfigStep = "detecting";

  try {
    const rpcPromise = host.client.request("modelConfig.provider.detect", {
      providerId: host.providerConfigProvider.providerId,
      apiKey: host.providerConfigApiKey,
      ...(host.providerConfigCustomModel ? { customModel: host.providerConfigCustomModel.trim() } : {}),
    });

    // 超时保护：防止 Gateway 挂起导致弹窗永远卡在 detecting
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("DETECT_TIMEOUT")), DETECT_TIMEOUT_MS)
    );

    const result = await Promise.race([rpcPromise, timeoutPromise]);

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
    } else {
      host.providerConfigTestResult = {
        success: false,
        message: translateProviderError(data.error ?? "配置失败"),
      };
      host.providerConfigStep = "apikey";
    }
  } catch (err) {
    const errStr = String(err);
    const isTimeout = errStr.includes("DETECT_TIMEOUT");
    host.providerConfigTestResult = {
      success: false,
      message: isTimeout ? "检测超时，请检查网络后重试" : `配置失败: ${errStr}`,
    };
    host.providerConfigStep = "apikey";
  } finally {
    host.providerConfigDetecting = false;
  }
}

/**
 * 打开 Provider 管理弹窗
 */
export async function openProviderManage(host: ModelConfigHost, provider: ProviderInfo): Promise<void> {
  host.providerManageOpen = true;
  host.providerManageTarget = provider;
  host.providerManageApiKey = "";
  host.providerManageDeleting = false;
  host.providerManageError = null;

  // 加载脱敏 Key
  if (host.client && host.connected) {
    try {
      const result = await host.client.request("modelConfig.provider.getConfig", {
        providerId: provider.providerId,
      });
      // stale check: 弹窗可能已被关闭或切换到其他 provider
      if (host.providerManageTarget?.providerId !== provider.providerId) return;
      const data = result as { configured: boolean; maskedApiKey: string };
      host.providerManageApiKey = data.maskedApiKey ?? "";
    } catch {
      if (host.providerManageTarget?.providerId !== provider.providerId) return;
      host.providerManageApiKey = "(加载失败)";
    }
  }
}

/**
 * 关闭 Provider 管理弹窗
 */
export function closeProviderManage(host: ModelConfigHost): void {
  host.providerManageOpen = false;
  host.providerManageTarget = null;
  host.providerManageApiKey = "";
  host.providerManageDeleting = false;
  host.providerManageError = null;
}

/**
 * 删除 Provider 配置
 */
export async function deleteProviderConfig(host: ModelConfigHost, providerId: string): Promise<void> {
  if (!host.client || !host.connected) return;

  host.providerManageDeleting = true;
  try {
    await host.client.request("modelConfig.provider.delete", { providerId });
    closeProviderManage(host);
    // 刷新数据
    await Promise.all([loadCapabilities(host), loadProviders(host)]);
  } catch (err) {
    host.providerManageDeleting = false;
    host.providerManageError = `删除失败: ${String(err)}`;
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

// ============================================================================
// OpenClawCN: Provider 健康状态
// ============================================================================

const HEALTH_STATUS_MAP: Record<string, string> = {
  normal: "正常",
  billing_error: "余额不足",
  auth_invalid: "密钥无效",
  rate_limited: "频率限制",
  degraded: "不稳定",
  down: "不可用",
  unknown: "未知",
};

export function getHealthStatusText(status: string): string {
  return HEALTH_STATUS_MAP[status] ?? status;
}

export function getHealthStatusColor(status: string): string {
  switch (status) {
    case "normal": return "#22c55e";
    case "degraded": return "#f59e0b";
    case "billing_error":
    case "auth_invalid":
    case "rate_limited":
    case "down": return "#ef4444";
    default: return "#9ca3af";
  }
}

/**
 * 加载所有已配置 Provider 的健康状态
 */
export async function loadProviderHealth(host: ModelConfigHost): Promise<void> {
  if (!host.client || !host.connected) return;

  host.providerHealthLoading = true;
  try {
    const result = await host.client.request("modelConfig.providers.health");
    const data = result as { health: Record<string, ProviderHealthInfo> };
    host.providerHealthMap = data.health ?? {};
  } catch {
    // 非关键功能，静默失败
  } finally {
    host.providerHealthLoading = false;
  }
}

/**
 * 测试单个 Provider 的连接状态
 */
export async function testProviderConnection(host: ModelConfigHost, providerId: string): Promise<void> {
  if (!host.client || !host.connected) return;

  host.providerTestingId = providerId;
  host.providerTestResult = null;

  try {
    const result = await host.client.request("modelConfig.provider.testConnection", { providerId });
    const data = result as { success: boolean; status: string; message: string };
    host.providerTestResult = {
      providerId,
      success: data.success,
      status: data.status,
      message: data.message,
    };
    // 更新健康状态 map
    if (data.status) {
      host.providerHealthMap = {
        ...host.providerHealthMap,
        [providerId]: {
          status: data.status as ProviderHealthInfo["status"],
          message: data.message,
          lastCheckedAt: Date.now(),
        },
      };
    }
  } catch (err) {
    host.providerTestResult = {
      providerId,
      success: false,
      status: "unknown",
      message: `测试失败: ${String(err)}`,
    };
  } finally {
    host.providerTestingId = null;
  }
}

// ============================================================================
// OpenClawCN: Provider 优先级排序
// ============================================================================

/**
 * 加载 Provider 优先级排序
 */
export async function loadProviderPriority(host: ModelConfigHost): Promise<void> {
  if (!host.client || !host.connected) return;

  try {
    const result = await host.client.request("modelConfig.providers.getPriority");
    const data = result as { priority: string[] };
    host.providerPriority = data.priority ?? [];
  } catch {
    // 非关键功能，静默失败
  }
}

/**
 * 保存 Provider 优先级排序
 */
export async function saveProviderPriority(host: ModelConfigHost, priority: string[]): Promise<void> {
  if (!host.client || !host.connected) return;

  // 记住当前 text 模型，用于判断是否需要 /new
  const oldTextModel = host.capabilities.find((c) => c.capability === "text")?.currentModel;
  const oldTextKey = oldTextModel ? `${oldTextModel.providerId}/${oldTextModel.modelId}` : "";

  host.providerPrioritySaving = true;
  try {
    await host.client.request("modelConfig.providers.savePriority", { priority });
    host.providerPriority = priority;
    // 优先级变更会联动 modelCapability，刷新 UI 显示（失败不影响主流程）
    try { await loadCapabilities(host); } catch { /* UI 刷新失败非关键 */ }

    // text 模型变了则静默 /new
    const newTextModel = host.capabilities.find((c) => c.capability === "text")?.currentModel;
    const newTextKey = newTextModel ? `${newTextModel.providerId}/${newTextModel.modelId}` : "";
    if (newTextKey && newTextKey !== oldTextKey) {
      globalThis.dispatchEvent?.(new CustomEvent("openclawcn:silent-new"));
    }
  } catch (err) {
    host.modelConfigError = `保存优先级失败: ${String(err)}`;
  } finally {
    host.providerPrioritySaving = false;
  }
}

/**
 * 重新排序 Providers（拖拽后调用）
 */
export async function reorderProviders(
  host: ModelConfigHost,
  fromIndex: number,
  toIndex: number,
): Promise<void> {
  const configured = host.providers
    .filter(p => p.configured)
    .sort((a, b) => {
      const ai = host.providerPriority.indexOf(a.providerId);
      const bi = host.providerPriority.indexOf(b.providerId);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

  if (fromIndex < 0 || fromIndex >= configured.length) return;
  if (toIndex < 0 || toIndex >= configured.length) return;

  const newOrder = [...configured];
  const [moved] = newOrder.splice(fromIndex, 1);
  newOrder.splice(toIndex, 0, moved);

  const priority = newOrder.map(p => p.providerId);
  await saveProviderPriority(host, priority);
}
