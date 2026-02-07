/**
 * 模型选择 Controller
 * 处理模型提供商列表获取和模型切换
 */

import type { GatewayBrowserClient } from "../gateway";

/**
 * 模型信息
 */
export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  recommended?: boolean;
  pricing?: string;
}

/**
 * 认证字段类型
 */
export type AuthFieldType = "apiKey" | "secretId" | "accessToken";

/**
 * 提供商认证配置
 */
export interface ProviderAuthConfig {
  /** 认证字段类型 */
  authField: AuthFieldType;
  /** 输入提示（格式说明） */
  authHint?: string;
  /** 特殊说明（如需要科学上网） */
  authNote?: string;
  /** 环境变量名 */
  envVar: string;
  /** API Key 获取链接 */
  docsUrl: string;
  /** API 端点 */
  apiEndpoint: string;
}

/**
 * 提供商信息（包含认证配置）
 */
export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  models: ModelInfo[];
  /** 认证配置 */
  auth: ProviderAuthConfig;
  /** 是否已配置认证 */
  authConfigured: boolean;
  /** @deprecated 使用 auth.authNote */
  authNote?: string;
}

/**
 * 当前模型信息
 */
export interface CurrentModelInfo {
  provider: string;
  model: string;
  ref: string;
}

/**
 * 模型提供商响应
 */
export interface ModelsProvidersResponse {
  providers: ProviderInfo[];
  defaults: Record<string, string>;
  current: CurrentModelInfo | null;
}

/**
 * API Key 验证结果
 */
export interface ApiKeyVerifyResult {
  valid: boolean;
  error?: string;
  message?: string;
}

/**
 * 模型状态
 */
export interface ModelsState {
  client: GatewayBrowserClient | null;
  connected: boolean;
  modelsLoading: boolean;
  modelsProviders: ProviderInfo[];
  modelsDefaults: Record<string, string>;
  modelsCurrent: CurrentModelInfo | null;
  modelsSaving: boolean;
  modelsError: string | null;
  /** 当前正在配置的提供商 ID */
  modelsConfiguringProvider: string | null;
  /** API Key 保存中 */
  modelsAuthSaving: boolean;
  /** API Key 验证中 */
  modelsAuthVerifying: boolean;
  /** API Key 验证结果 */
  modelsAuthVerifyResult: ApiKeyVerifyResult | null;
}

/**
 * 加载模型提供商列表
 */
export async function loadModelsProviders(state: ModelsState): Promise<void> {
  if (!state.client || !state.connected) return;
  
  state.modelsLoading = true;
  state.modelsError = null;
  
  try {
    const res = await state.client.request("models.providers", {}) as ModelsProvidersResponse;
    state.modelsProviders = res.providers ?? [];
    state.modelsDefaults = res.defaults ?? {};
    state.modelsCurrent = res.current ?? null;
  } catch (err) {
    state.modelsError = String(err);
  } finally {
    state.modelsLoading = false;
  }
}

/**
 * 设置主模型
 */
export async function setModelPrimary(
  state: ModelsState,
  provider: string,
  model: string,
): Promise<boolean> {
  if (!state.client || !state.connected) return false;
  
  state.modelsSaving = true;
  state.modelsError = null;
  
  try {
    const res = await state.client.request("models.setPrimary", {
      provider,
      model,
    }) as { ok: boolean; model?: CurrentModelInfo };
    
    if (res.ok && res.model) {
      state.modelsCurrent = res.model;
      return true;
    }
    return false;
  } catch (err) {
    state.modelsError = String(err);
    return false;
  } finally {
    state.modelsSaving = false;
  }
}

/**
 * 通过完整引用设置主模型
 */
export async function setModelPrimaryByRef(
  state: ModelsState,
  ref: string,
): Promise<boolean> {
  if (!state.client || !state.connected) return false;
  
  state.modelsSaving = true;
  state.modelsError = null;
  
  try {
    const res = await state.client.request("models.setPrimary", {
      ref,
    }) as { ok: boolean; model?: CurrentModelInfo };
    
    if (res.ok && res.model) {
      state.modelsCurrent = res.model;
      return true;
    }
    return false;
  } catch (err) {
    state.modelsError = String(err);
    return false;
  } finally {
    state.modelsSaving = false;
  }
}

/**
 * 获取提供商显示名称
 */
export function getProviderDisplayName(
  state: ModelsState,
  providerId: string,
): string {
  const provider = state.modelsProviders.find((p) => p.id === providerId);
  return provider?.name ?? providerId;
}

/**
 * 获取模型显示名称
 */
export function getModelDisplayName(
  state: ModelsState,
  providerId: string,
  modelId: string,
): string {
  const provider = state.modelsProviders.find((p) => p.id === providerId);
  if (!provider) return modelId;
  const model = provider.models.find((m) => m.id === modelId);
  return model?.name ?? modelId;
}

/**
 * 获取当前模型的友好显示名称
 */
export function getCurrentModelDisplayName(state: ModelsState): string {
  if (!state.modelsCurrent) return "未配置";
  const { provider, model } = state.modelsCurrent;
  return getModelDisplayName(state, provider, model);
}

/**
 * 获取当前提供商的友好显示名称
 */
export function getCurrentProviderDisplayName(state: ModelsState): string {
  if (!state.modelsCurrent) return "";
  return getProviderDisplayName(state, state.modelsCurrent.provider);
}

/**
 * 设置提供商的认证信息
 */
export async function setProviderAuth(
  state: ModelsState,
  provider: string,
  auth: { apiKey?: string; secretId?: string; secretKey?: string },
): Promise<boolean> {
  if (!state.client || !state.connected) return false;

  state.modelsAuthSaving = true;
  state.modelsError = null;

  try {
    const res = await state.client.request("models.setAuth", {
      provider,
      ...auth,
    }) as { ok: boolean; configured?: boolean };

    if (res.ok) {
      // 更新本地状态
      const providerData = state.modelsProviders.find((p) => p.id === provider);
      if (providerData) {
        providerData.authConfigured = true;
      }
      return true;
    }
    return false;
  } catch (err) {
    state.modelsError = String(err);
    return false;
  } finally {
    state.modelsAuthSaving = false;
  }
}

/**
 * 获取提供商信息
 */
export function getProviderById(
  state: ModelsState,
  providerId: string,
): ProviderInfo | undefined {
  return state.modelsProviders.find((p) => p.id === providerId);
}

/**
 * 验证 API Key（调用 setup-wizard 的验证端点）
 */
export async function verifyProviderApiKey(
  state: ModelsState,
  provider: string,
  apiKey: string,
  model?: string,
): Promise<ApiKeyVerifyResult> {
  state.modelsAuthVerifying = true;
  state.modelsAuthVerifyResult = null;

  try {
    // 调用 setup-wizard 的验证 API
    const response = await fetch("/api/setup/verify-apikey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey, model }),
    });

    if (!response.ok) {
      const result: ApiKeyVerifyResult = { valid: false, error: `HTTP ${response.status}` };
      state.modelsAuthVerifyResult = result;
      return result;
    }

    const json = await response.json() as { ok: boolean; data?: ApiKeyVerifyResult; error?: string };
    
    if (!json.ok) {
      const result: ApiKeyVerifyResult = { valid: false, error: json.error ?? "验证请求失败" };
      state.modelsAuthVerifyResult = result;
      return result;
    }

    const result = json.data ?? { valid: false, error: "无效响应" };
    state.modelsAuthVerifyResult = result;
    return result;
  } catch (err) {
    const result: ApiKeyVerifyResult = { valid: false, error: String(err) };
    state.modelsAuthVerifyResult = result;
    return result;
  } finally {
    state.modelsAuthVerifying = false;
  }
}

/**
 * 清除验证结果
 */
export function clearVerifyResult(state: ModelsState): void {
  state.modelsAuthVerifyResult = null;
}
