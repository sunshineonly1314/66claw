import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateModelsListParams,
} from "../protocol/index.js";
import { CN_PROVIDERS, CN_REGION_CONFIG, type CnProviderConfig } from "../../config/region-cn.js";
import { loadConfig, writeConfigFile } from "../../config/config.js";
import type { GatewayRequestHandlers } from "./types.js";
import { ensureAuthProfileStore } from "../../agents/model-auth.js";
import {
  setSiliconFlowApiKey,
  setDeepSeekApiKey,
  setGlmApiKey,
  setAliyunBailianApiKey,
  setVolcengineArkApiKey,
  setTencentHunyuanApiKey,
  setMinimaxApiKey,
  setGeminiApiKey,
  setOpenAiApiKey,
  setAnthropicApiKey,
  setNvidiaApiKey,
  setMoonshotApiKey,
  setModelscopeApiKey,
  setKimiCodeApiKey,
  setOllamaApiKey,
} from "../../commands/onboard-auth.js";

/**
 * 提供商认证字段类型
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
 * 提供商完整信息（包含认证配置）
 */
export interface ProviderFullInfo {
  id: string;
  name: string;
  description: string;
  models: Array<{
    id: string;
    name: string;
    description?: string;
    recommended?: boolean;
    pricing?: string;
  }>;
  auth: ProviderAuthConfig;
  /** 是否已配置认证 */
  authConfigured: boolean;
}

/**
 * 检查提供商是否已配置认证
 * 检查顺序：环境变量 > auth-profiles.json > clawdbot.json auth.profiles > credentials
 */
function isProviderAuthConfigured(provider: CnProviderConfig): boolean {
  const envVar = provider.envVar;
  if (!envVar) return false;

  // 1. 检查环境变量是否已设置
  const value = process.env[envVar];
  if (value && value.trim().length > 0) {
    return true;
  }

  // 2. 检查 auth-profiles.json（setXxxApiKey 函数保存的位置）
  try {
    const authStore = ensureAuthProfileStore();
    if (authStore.profiles) {
      // 检查是否有该提供商的 profile（格式如 "deepseek:default"）
      const profileKey = `${provider.id}:default`;
      if (authStore.profiles[profileKey]) {
        return true;
      }
      // 也检查其他可能的 profile 名称
      for (const key of Object.keys(authStore.profiles)) {
        if (key.startsWith(`${provider.id}:`)) {
          return true;
        }
      }
    }
  } catch {
    // ignore auth-profiles.json load errors
  }

  // 3. 检查 clawdbot.json 中的配置（与 setup-wizard 兼容）
  try {
    const config = loadConfig();

    // 检查 auth.profiles（setup-wizard 的保存方式）
    const profiles = config.auth?.profiles as Record<string, unknown> | undefined;
    if (profiles) {
      // 检查是否有该提供商的 profile（格式如 "siliconflow:default"）
      const profileKey = `${provider.id}:default`;
      if (profiles[profileKey]) {
        return true;
      }
      // 也检查其他可能的 profile 名称
      for (const key of Object.keys(profiles)) {
        if (key.startsWith(`${provider.id}:`)) {
          return true;
        }
      }
    }

    // 兼容：检查 credentials
    const credentials = config.credentials as Record<string, string> | undefined;
    if (credentials && credentials[envVar]) {
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}

/**
 * 获取提供商和模型列表（用于 UI 模型选择器）
 * 现在包含完整的认证配置信息
 */
function getProvidersWithModels(): ProviderFullInfo[] {
  const providers: ProviderFullInfo[] = [];

  for (const providerId of CN_REGION_CONFIG.recommendedProviders) {
    const provider = CN_PROVIDERS[providerId];
    if (!provider) continue;
    providers.push({
      id: provider.id,
      name: provider.name,
      description: provider.description,
      models: provider.models.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        recommended: m.recommended,
        pricing: m.pricing,
      })),
      auth: {
        authField: provider.authField ?? "apiKey",
        authHint: provider.authHint,
        authNote: provider.authNote,
        envVar: provider.envVar,
        docsUrl: provider.docsUrl,
        apiEndpoint: provider.apiEndpoint,
      },
      authConfigured: isProviderAuthConfigured(provider),
    });
  }

  return providers;
}

/**
 * 获取默认推荐模型映射
 */
function getDefaultModels(): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const [providerId, provider] of Object.entries(CN_PROVIDERS)) {
    const recommended = provider.models.find((m) => m.recommended);
    if (recommended) {
      defaults[providerId] = recommended.id;
    } else if (provider.models.length > 0) {
      defaults[providerId] = provider.models[0].id;
    }
  }
  return defaults;
}

/**
 * 解析模型引用字符串，提取 provider 和 model
 * 格式: provider/model 或 provider/org/model
 */
function parseModelRef(ref: string): { provider: string; model: string } | null {
  if (!ref) return null;
  const parts = ref.split("/");
  if (parts.length < 2) return null;
  const provider = parts[0];
  const model = parts.slice(1).join("/");
  return { provider, model };
}

export const modelsHandlers: GatewayRequestHandlers = {
  "models.list": async ({ params, respond, context }) => {
    if (!validateModelsListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid models.list params: ${formatValidationErrors(validateModelsListParams.errors)}`,
        ),
      );
      return;
    }
    try {
      const models = await context.loadGatewayModelCatalog();
      respond(true, { models }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * 获取所有可用的提供商和模型列表（用于 UI 模型选择器）
   */
  "models.providers": async ({ respond }) => {
    try {
      const providers = getProvidersWithModels();
      const defaults = getDefaultModels();

      // 获取当前配置的主模型
      const config = loadConfig();
      const currentModel = config.agents?.defaults?.model;
      const primaryRef = typeof currentModel === "string" ? currentModel : currentModel?.primary;

      const current = primaryRef ? parseModelRef(primaryRef) : null;

      respond(
        true,
        {
          providers,
          defaults,
          current: current
            ? { provider: current.provider, model: current.model, ref: primaryRef }
            : null,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * 获取指定提供商的认证状态
   */
  "models.getAuthStatus": async ({ params, respond }) => {
    try {
      const p = params as { provider?: string };
      if (!p.provider) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing provider"));
        return;
      }

      const provider = CN_PROVIDERS[p.provider];
      if (!provider) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `unknown provider: ${p.provider}`),
        );
        return;
      }

      const configured = isProviderAuthConfigured(provider);
      respond(
        true,
        {
          provider: p.provider,
          configured,
          authField: provider.authField ?? "apiKey",
          envVar: provider.envVar,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * 设置提供商的认证信息（API Key 等）
   * 复用 setup-wizard 的保存逻辑，确保一致性
   */
  "models.setAuth": async ({ params, respond }) => {
    try {
      const p = params as {
        provider?: string;
        apiKey?: string;
        secretId?: string;
        secretKey?: string;
      };

      if (!p.provider) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing provider"));
        return;
      }

      const providerConfig = CN_PROVIDERS[p.provider];
      if (!providerConfig) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `unknown provider: ${p.provider}`),
        );
        return;
      }

      const authField = providerConfig.authField ?? "apiKey";
      let authValue: string;

      if (authField === "secretId") {
        // 腾讯云等需要 secretId + secretKey
        if (!p.secretId || !p.secretKey) {
          respond(
            false,
            undefined,
            errorShape(ErrorCodes.INVALID_REQUEST, "missing secretId or secretKey"),
          );
          return;
        }
        // 组合成 secretId:secretKey 格式存储
        authValue = `${p.secretId}:${p.secretKey}`;
      } else {
        // 标准 API Key
        if (!p.apiKey) {
          respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "missing apiKey"));
          return;
        }
        authValue = p.apiKey.trim();
      }

      // 使用与 setup-wizard 相同的保存函数
      const providerId = p.provider;
      if (providerId === "siliconflow") {
        await setSiliconFlowApiKey(authValue);
      } else if (providerId === "deepseek") {
        await setDeepSeekApiKey(authValue);
      } else if (providerId === "glm") {
        await setGlmApiKey(authValue);
      } else if (providerId === "aliyun-bailian") {
        await setAliyunBailianApiKey(authValue);
      } else if (providerId === "volcengine-ark") {
        await setVolcengineArkApiKey(authValue);
      } else if (providerId === "tencent-hunyuan") {
        await setTencentHunyuanApiKey(authValue);
      } else if (providerId === "minimax") {
        await setMinimaxApiKey(authValue);
      } else if (providerId === "moonshot") {
        await setMoonshotApiKey(authValue);
      } else if (providerId === "kimi-code") {
        await setKimiCodeApiKey(authValue);
      } else if (providerId === "modelscope") {
        await setModelscopeApiKey(authValue);
      } else if (providerId === "google") {
        await setGeminiApiKey(authValue);
      } else if (providerId === "openai") {
        await setOpenAiApiKey(authValue);
      } else if (providerId === "anthropic") {
        await setAnthropicApiKey(authValue);
      } else if (providerId === "nvidia") {
        await setNvidiaApiKey(authValue);
      } else if (providerId === "ollama") {
        await setOllamaApiKey(authValue);
      } else {
        // 未知提供商，保存到通用环境变量配置
        const config = loadConfig();
        const credentials = (config.credentials as Record<string, string>) ?? {};
        credentials[providerConfig.envVar] = authValue;
        await writeConfigFile({ ...config, credentials });
        process.env[providerConfig.envVar] = authValue;
      }

      respond(
        true,
        {
          ok: true,
          provider: p.provider,
          configured: true,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * 设置主模型
   */
  "models.setPrimary": async ({ params, respond }) => {
    try {
      const p = params as { provider?: string; model?: string; ref?: string };

      let modelRef: string;
      if (p.ref) {
        modelRef = p.ref;
      } else if (p.provider && p.model) {
        modelRef = `${p.provider}/${p.model}`;
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "missing provider/model or ref"),
        );
        return;
      }

      // 验证提供商和模型是否存在
      const parsed = parseModelRef(modelRef);
      if (!parsed) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "invalid model reference format"),
        );
        return;
      }

      const provider = CN_PROVIDERS[parsed.provider];
      if (!provider) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `unknown provider: ${parsed.provider}`),
        );
        return;
      }

      // 更新配置
      const config = loadConfig();
      const currentModel = config.agents?.defaults?.model;
      const fallbacks = typeof currentModel === "object" ? currentModel.fallbacks : undefined;

      const nextConfig = {
        ...config,
        agents: {
          ...config.agents,
          defaults: {
            ...config.agents?.defaults,
            model: {
              primary: modelRef,
              ...(fallbacks ? { fallbacks } : {}),
            },
          },
        },
      };

      await writeConfigFile(nextConfig);

      respond(
        true,
        {
          ok: true,
          model: {
            provider: parsed.provider,
            model: parsed.model,
            ref: modelRef,
          },
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
