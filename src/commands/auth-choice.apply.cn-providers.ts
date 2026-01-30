/**
 * 中国区 AI 提供商认证处理
 * China Region AI Provider Authentication Handlers
 *
 * 支持:
 * - 硅基流动 (SiliconFlow) - 聚合平台
 * - DeepSeek
 * - 智谱 GLM
 * - 阿里云百炼 (Qwen)
 * - 火山引擎 (Doubao)
 * - 腾讯混元 (Hunyuan)
 */

import { resolveEnvApiKey } from "../agents/model-auth.js";
import {
  formatApiKeyPreview,
  normalizeApiKeyInput,
  validateApiKeyInput,
} from "./auth-choice.api-key.js";
import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import {
  applyAuthProfileConfig,
  SILICONFLOW_DEFAULT_MODEL_REF,
  DEEPSEEK_DEFAULT_MODEL_REF,
  GLM_DEFAULT_MODEL_REF,
  setSiliconFlowApiKey,
  setDeepSeekApiKey,
  setGlmApiKey,
  setAliyunBailianApiKey,
  setVolcengineArkApiKey,
  setTencentHunyuanApiKey,
} from "./onboard-auth.js";
import type { ClawdbotConfig } from "../config/config.js";
import {
  discoverSiliconFlowModels,
  SILICONFLOW_BASE_URL,
  SILICONFLOW_RECOMMENDED_MODELS,
} from "../agents/siliconflow-models.js";

// ============================================================================
// 常量定义 (Constants)
// ============================================================================

// 硅基流动 (SiliconFlow)
export const SILICONFLOW_ENV_VAR = "SILICONFLOW_API_KEY";
export const SILICONFLOW_API_ENDPOINT = "https://api.siliconflow.cn/v1";

// DeepSeek
export const DEEPSEEK_ENV_VAR = "DEEPSEEK_API_KEY";
export const DEEPSEEK_API_ENDPOINT = "https://api.deepseek.com";

// 智谱 GLM
export const GLM_ENV_VAR = "ZHIPU_API_KEY";
export const GLM_API_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4";

// 阿里云百炼 (Qwen)
export const ALIYUN_BAILIAN_DEFAULT_MODEL_REF = "aliyun-bailian/qwen-max";
export const ALIYUN_BAILIAN_ENV_VAR = "DASHSCOPE_API_KEY";
export const ALIYUN_BAILIAN_API_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1";

// 火山引擎 (Doubao)
export const VOLCENGINE_ARK_DEFAULT_MODEL_REF = "volcengine-ark/doubao-pro-32k";
export const VOLCENGINE_ARK_ENV_VAR = "ARK_API_KEY";
export const VOLCENGINE_ARK_API_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3";

// 腾讯混元 (Hunyuan)
export const TENCENT_HUNYUAN_DEFAULT_MODEL_REF = "tencent-hunyuan/hunyuan-pro";
export const TENCENT_HUNYUAN_ENV_VAR = "HUNYUAN_SECRET_ID";
export const TENCENT_HUNYUAN_API_ENDPOINT = "https://hunyuan.tencentcloudapi.com";


// ============================================================================
// 配置应用函数 (Config Apply Functions)
// ============================================================================

/**
 * 应用硅基流动默认配置
 */
export function applySiliconFlowConfig(config: ClawdbotConfig): ClawdbotConfig {
  return {
    ...config,
    agents: {
      ...config.agents,
      defaults: {
        ...config.agents?.defaults,
        model: {
          ...config.agents?.defaults?.model,
          primary: SILICONFLOW_DEFAULT_MODEL_REF,
        },
      },
    },
  };
}

/**
 * 应用硅基流动提供商配置
 */
export async function applySiliconFlowProviderConfig(
  config: ClawdbotConfig,
  apiKey?: string,
): Promise<ClawdbotConfig> {
  const models = await discoverSiliconFlowModels(apiKey);
  return {
    ...config,
    models: {
      ...config.models,
      providers: {
        ...config.models?.providers,
        siliconflow: {
          ...config.models?.providers?.siliconflow,
          baseUrl: SILICONFLOW_API_ENDPOINT,
          models: models.length > 0 ? models : SILICONFLOW_RECOMMENDED_MODELS,
        },
      },
    },
    agents: {
      ...config.agents,
      defaults: {
        ...config.agents?.defaults,
        models: {
          ...config.agents?.defaults?.models,
          [SILICONFLOW_DEFAULT_MODEL_REF]: {
            ...config.agents?.defaults?.models?.[SILICONFLOW_DEFAULT_MODEL_REF],
            alias: "SiliconFlow",
          },
        },
      },
    },
  };
}

/**
 * 应用 DeepSeek 默认配置
 */
export function applyDeepSeekConfig(config: ClawdbotConfig): ClawdbotConfig {
  return {
    ...config,
    agents: {
      ...config.agents,
      defaults: {
        ...config.agents?.defaults,
        model: {
          ...config.agents?.defaults?.model,
          primary: DEEPSEEK_DEFAULT_MODEL_REF,
        },
      },
    },
  };
}

/**
 * 应用 DeepSeek 提供商配置
 */
export function applyDeepSeekProviderConfig(config: ClawdbotConfig): ClawdbotConfig {
  return {
    ...config,
    models: {
      ...config.models,
      providers: {
        ...config.models?.providers,
        deepseek: {
          ...config.models?.providers?.deepseek,
          baseUrl: DEEPSEEK_API_ENDPOINT,
          models: [
            {
              id: "deepseek-chat",
              name: "DeepSeek Chat",
              contextWindow: 64000,
              maxTokens: 8192,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              input: ["text"],
              reasoning: false,
            },
            {
              id: "deepseek-coder",
              name: "DeepSeek Coder",
              contextWindow: 64000,
              maxTokens: 8192,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              input: ["text"],
              reasoning: false,
            },
            {
              id: "deepseek-reasoner",
              name: "DeepSeek R1 (推理)",
              contextWindow: 64000,
              maxTokens: 8192,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              input: ["text"],
              reasoning: true,
            },
          ],
        },
      },
    },
    agents: {
      ...config.agents,
      defaults: {
        ...config.agents?.defaults,
        models: {
          ...config.agents?.defaults?.models,
          [DEEPSEEK_DEFAULT_MODEL_REF]: {
            ...config.agents?.defaults?.models?.[DEEPSEEK_DEFAULT_MODEL_REF],
            alias: "DeepSeek",
          },
        },
      },
    },
  };
}

/**
 * 应用智谱 GLM 默认配置
 */
export function applyGlmConfig(config: ClawdbotConfig): ClawdbotConfig {
  return {
    ...config,
    agents: {
      ...config.agents,
      defaults: {
        ...config.agents?.defaults,
        model: {
          ...config.agents?.defaults?.model,
          primary: GLM_DEFAULT_MODEL_REF,
        },
      },
    },
  };
}

/**
 * 应用智谱 GLM 提供商配置
 */
export function applyGlmProviderConfig(config: ClawdbotConfig): ClawdbotConfig {
  return {
    ...config,
    models: {
      ...config.models,
      providers: {
        ...config.models?.providers,
        glm: {
          ...config.models?.providers?.glm,
          baseUrl: GLM_API_ENDPOINT,
          models: [
            {
              id: "glm-4-plus",
              name: "GLM-4 Plus",
              contextWindow: 128000,
              maxTokens: 4096,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              input: ["text"],
              reasoning: false,
            },
            {
              id: "glm-4",
              name: "GLM-4",
              contextWindow: 128000,
              maxTokens: 4096,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              input: ["text"],
              reasoning: false,
            },
            {
              id: "glm-4-flash",
              name: "GLM-4 Flash",
              contextWindow: 128000,
              maxTokens: 4096,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              input: ["text"],
              reasoning: false,
            },
            {
              id: "glm-4v-plus",
              name: "GLM-4V Plus (视觉)",
              contextWindow: 8000,
              maxTokens: 1000,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              input: ["text", "image"],
              reasoning: false,
            },
            {
              id: "codegeex-4",
              name: "CodeGeeX-4 (代码)",
              contextWindow: 128000,
              maxTokens: 4096,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              input: ["text"],
              reasoning: false,
            },
          ],
        },
      },
    },
    agents: {
      ...config.agents,
      defaults: {
        ...config.agents?.defaults,
        models: {
          ...config.agents?.defaults?.models,
          [GLM_DEFAULT_MODEL_REF]: {
            ...config.agents?.defaults?.models?.[GLM_DEFAULT_MODEL_REF],
            alias: "GLM",
          },
        },
      },
    },
  };
}

/**
 * 应用阿里云百炼默认配置
 */
export function applyAliyunBailianConfig(config: ClawdbotConfig): ClawdbotConfig {
  return {
    ...config,
    agents: {
      ...config.agents,
      defaults: {
        ...config.agents?.defaults,
        model: {
          ...config.agents?.defaults?.model,
          primary: ALIYUN_BAILIAN_DEFAULT_MODEL_REF,
        },
      },
    },
  };
}

/**
 * 应用阿里云百炼提供商配置
 */
export function applyAliyunBailianProviderConfig(config: ClawdbotConfig): ClawdbotConfig {
  return {
    ...config,
    models: {
      ...config.models,
      providers: {
        ...config.models?.providers,
        "aliyun-bailian": {
          ...config.models?.providers?.["aliyun-bailian"],
          baseUrl: ALIYUN_BAILIAN_API_ENDPOINT,
          models: [
            {
              id: "qwen-max",
              name: "Qwen-Max",
              contextWindow: 32768,
              maxTokens: 8192,
              cost: { input: 0.04, output: 0.12, cacheRead: 0, cacheWrite: 0 },
              input: ["text"],
              reasoning: false,
            },
            {
              id: "qwen-plus",
              name: "Qwen-Plus",
              contextWindow: 131072,
              maxTokens: 8192,
              cost: { input: 0.008, output: 0.02, cacheRead: 0, cacheWrite: 0 },
              input: ["text"],
              reasoning: false,
            },
            {
              id: "qwen-turbo",
              name: "Qwen-Turbo",
              contextWindow: 131072,
              maxTokens: 8192,
              cost: { input: 0.002, output: 0.006, cacheRead: 0, cacheWrite: 0 },
              input: ["text"],
              reasoning: false,
            },
          ],
        },
      },
    },
    agents: {
      ...config.agents,
      defaults: {
        ...config.agents?.defaults,
        models: {
          ...config.agents?.defaults?.models,
          [ALIYUN_BAILIAN_DEFAULT_MODEL_REF]: {
            ...config.agents?.defaults?.models?.[ALIYUN_BAILIAN_DEFAULT_MODEL_REF],
            alias: "Qwen",
          },
        },
      },
    },
  };
}

/**
 * 应用火山引擎默认配置
 */
export function applyVolcengineArkConfig(config: ClawdbotConfig): ClawdbotConfig {
  return {
    ...config,
    agents: {
      ...config.agents,
      defaults: {
        ...config.agents?.defaults,
        model: {
          ...config.agents?.defaults?.model,
          primary: VOLCENGINE_ARK_DEFAULT_MODEL_REF,
        },
      },
    },
  };
}

/**
 * 应用火山引擎提供商配置
 */
export function applyVolcengineArkProviderConfig(config: ClawdbotConfig): ClawdbotConfig {
  return {
    ...config,
    models: {
      ...config.models,
      providers: {
        ...config.models?.providers,
        "volcengine-ark": {
          ...config.models?.providers?.["volcengine-ark"],
          baseUrl: VOLCENGINE_ARK_API_ENDPOINT,
          models: [
            {
              id: "doubao-pro-32k",
              name: "豆包 Pro 32K",
              contextWindow: 32768,
              maxTokens: 4096,
              cost: { input: 0.008, output: 0.02, cacheRead: 0, cacheWrite: 0 },
              input: ["text"],
              reasoning: false,
            },
            {
              id: "doubao-lite-32k",
              name: "豆包 Lite 32K",
              contextWindow: 32768,
              maxTokens: 4096,
              cost: { input: 0.003, output: 0.006, cacheRead: 0, cacheWrite: 0 },
              input: ["text"],
              reasoning: false,
            },
            {
              id: "doubao-pro-128k",
              name: "豆包 Pro 128K",
              contextWindow: 131072,
              maxTokens: 4096,
              cost: { input: 0.05, output: 0.09, cacheRead: 0, cacheWrite: 0 },
              input: ["text"],
              reasoning: false,
            },
          ],
        },
      },
    },
    agents: {
      ...config.agents,
      defaults: {
        ...config.agents?.defaults,
        models: {
          ...config.agents?.defaults?.models,
          [VOLCENGINE_ARK_DEFAULT_MODEL_REF]: {
            ...config.agents?.defaults?.models?.[VOLCENGINE_ARK_DEFAULT_MODEL_REF],
            alias: "Doubao",
          },
        },
      },
    },
  };
}

/**
 * 应用腾讯混元默认配置
 */
export function applyTencentHunyuanConfig(config: ClawdbotConfig): ClawdbotConfig {
  return {
    ...config,
    agents: {
      ...config.agents,
      defaults: {
        ...config.agents?.defaults,
        model: {
          ...config.agents?.defaults?.model,
          primary: TENCENT_HUNYUAN_DEFAULT_MODEL_REF,
        },
      },
    },
  };
}

/**
 * 应用腾讯混元提供商配置
 */
export function applyTencentHunyuanProviderConfig(config: ClawdbotConfig): ClawdbotConfig {
  return {
    ...config,
    models: {
      ...config.models,
      providers: {
        ...config.models?.providers,
        "tencent-hunyuan": {
          ...config.models?.providers?.["tencent-hunyuan"],
          baseUrl: TENCENT_HUNYUAN_API_ENDPOINT,
          models: [
            {
              id: "hunyuan-pro",
              name: "混元 Pro",
              contextWindow: 32768,
              maxTokens: 4096,
              cost: { input: 0.03, output: 0.1, cacheRead: 0, cacheWrite: 0 },
              input: ["text"],
              reasoning: false,
            },
            {
              id: "hunyuan-standard",
              name: "混元 Standard",
              contextWindow: 32768,
              maxTokens: 4096,
              cost: { input: 0.015, output: 0.05, cacheRead: 0, cacheWrite: 0 },
              input: ["text"],
              reasoning: false,
            },
            {
              id: "hunyuan-lite",
              name: "混元 Lite",
              contextWindow: 32768,
              maxTokens: 4096,
              cost: { input: 0.008, output: 0.008, cacheRead: 0, cacheWrite: 0 },
              input: ["text"],
              reasoning: false,
            },
          ],
        },
      },
    },
    agents: {
      ...config.agents,
      defaults: {
        ...config.agents?.defaults,
        models: {
          ...config.agents?.defaults?.models,
          [TENCENT_HUNYUAN_DEFAULT_MODEL_REF]: {
            ...config.agents?.defaults?.models?.[TENCENT_HUNYUAN_DEFAULT_MODEL_REF],
            alias: "Hunyuan",
          },
        },
      },
    },
  };
}

// ============================================================================
// 主处理函数 (Main Handler)
// ============================================================================

/**
 * 处理中国区提供商认证选择
 */
export async function applyAuthChoiceCnProviders(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  let nextConfig = params.config;
  let agentModelOverride: string | undefined;

  const noteAgentModel = async (model: string) => {
    if (!params.agentId) return;
    await params.prompter.note(
      `默认模型已设置为 ${model}`,
      "模型配置完成",
    );
  };

  const authChoice = params.authChoice;

  // ============================================================================
  // 硅基流动 (SiliconFlow)
  // ============================================================================
  if (authChoice === "siliconflow-api-key") {
    let hasCredential = false;
    let apiKey: string | undefined;

    // 检查命令行参数
    if (
      !hasCredential &&
      params.opts?.token &&
      params.opts?.tokenProvider === "siliconflow"
    ) {
      apiKey = normalizeApiKeyInput(params.opts.token);
      await setSiliconFlowApiKey(apiKey, params.agentDir);
      hasCredential = true;
    }

    // 显示帮助信息
    if (!hasCredential) {
      await params.prompter.note(
        [
          "硅基流动是国内领先的大模型聚合平台，支持多家顶尖模型。",
          "",
          "支持模型: DeepSeek-V3/R1, Qwen2.5, GLM-4 等",
          "",
          "获取 API Key:",
          "1. 登录硅基流动控制台: https://cloud.siliconflow.cn/",
          "2. 点击「API 密钥」",
          "3. 创建并复制 API Key",
        ].join("\n"),
        "硅基流动 SiliconFlow",
      );
    }

    // 检查环境变量
    const envKey = resolveEnvApiKey("siliconflow");
    if (envKey) {
      const useExisting = await params.prompter.confirm({
        message: `使用已有的 ${SILICONFLOW_ENV_VAR} (${envKey.source}, ${formatApiKeyPreview(envKey.apiKey)})?`,
        initialValue: true,
      });
      if (useExisting) {
        apiKey = envKey.apiKey;
        await setSiliconFlowApiKey(apiKey, params.agentDir);
        hasCredential = true;
      }
    }

    // 提示输入
    if (!hasCredential) {
      const key = await params.prompter.text({
        message: "输入硅基流动 API Key",
        validate: validateApiKeyInput,
      });
      apiKey = normalizeApiKeyInput(String(key));
      await setSiliconFlowApiKey(apiKey, params.agentDir);
    }

    // 应用配置
    nextConfig = applyAuthProfileConfig(nextConfig, {
      profileId: "siliconflow:default",
      provider: "siliconflow",
      mode: "api_key",
    });

    nextConfig = await applySiliconFlowProviderConfig(nextConfig, apiKey);

    if (params.setDefaultModel) {
      nextConfig = applySiliconFlowConfig(nextConfig);
      await params.prompter.note(
        `默认模型已设置为 ${SILICONFLOW_DEFAULT_MODEL_REF}`,
        "模型配置完成",
      );
    } else {
      agentModelOverride = SILICONFLOW_DEFAULT_MODEL_REF;
      await noteAgentModel(SILICONFLOW_DEFAULT_MODEL_REF);
    }

    return { config: nextConfig, agentModelOverride };
  }

  // ============================================================================
  // DeepSeek
  // ============================================================================
  if (authChoice === "deepseek-api-key") {
    let hasCredential = false;

    // 检查命令行参数
    if (
      !hasCredential &&
      params.opts?.token &&
      params.opts?.tokenProvider === "deepseek"
    ) {
      await setDeepSeekApiKey(normalizeApiKeyInput(params.opts.token), params.agentDir);
      hasCredential = true;
    }

    // 显示帮助信息
    if (!hasCredential) {
      await params.prompter.note(
        [
          "DeepSeek 提供高性能的大语言模型。",
          "",
          "支持模型: DeepSeek-Chat, DeepSeek-Coder, DeepSeek-R1",
          "",
          "获取 API Key:",
          "1. 登录 DeepSeek 平台: https://platform.deepseek.com/",
          "2. 点击「API Keys」",
          "3. 创建并复制 API Key",
        ].join("\n"),
        "DeepSeek",
      );
    }

    // 检查环境变量
    const envKey = resolveEnvApiKey("deepseek");
    if (envKey) {
      const useExisting = await params.prompter.confirm({
        message: `使用已有的 ${DEEPSEEK_ENV_VAR} (${envKey.source}, ${formatApiKeyPreview(envKey.apiKey)})?`,
        initialValue: true,
      });
      if (useExisting) {
        await setDeepSeekApiKey(envKey.apiKey, params.agentDir);
        hasCredential = true;
      }
    }

    // 提示输入
    if (!hasCredential) {
      const key = await params.prompter.text({
        message: "输入 DeepSeek API Key",
        validate: validateApiKeyInput,
      });
      await setDeepSeekApiKey(normalizeApiKeyInput(String(key)), params.agentDir);
    }

    // 应用配置
    nextConfig = applyAuthProfileConfig(nextConfig, {
      profileId: "deepseek:default",
      provider: "deepseek",
      mode: "api_key",
    });

    nextConfig = applyDeepSeekProviderConfig(nextConfig);

    if (params.setDefaultModel) {
      nextConfig = applyDeepSeekConfig(nextConfig);
      await params.prompter.note(
        `默认模型已设置为 ${DEEPSEEK_DEFAULT_MODEL_REF}`,
        "模型配置完成",
      );
    } else {
      agentModelOverride = DEEPSEEK_DEFAULT_MODEL_REF;
      await noteAgentModel(DEEPSEEK_DEFAULT_MODEL_REF);
    }

    return { config: nextConfig, agentModelOverride };
  }

  // ============================================================================
  // 智谱 GLM
  // ============================================================================
  if (authChoice === "glm-api-key") {
    let hasCredential = false;

    // 检查命令行参数
    if (
      !hasCredential &&
      params.opts?.token &&
      params.opts?.tokenProvider === "glm"
    ) {
      await setGlmApiKey(normalizeApiKeyInput(params.opts.token), params.agentDir);
      hasCredential = true;
    }

    // 显示帮助信息
    if (!hasCredential) {
      await params.prompter.note(
        [
          "智谱 AI 提供 GLM 系列大语言模型。",
          "",
          "支持模型: GLM-4-Plus, GLM-4, GLM-4V, CodeGeeX-4",
          "",
          "获取 API Key:",
          "1. 登录智谱开放平台: https://open.bigmodel.cn/",
          "2. 点击「API Keys」",
          "3. 创建并复制 API Key",
        ].join("\n"),
        "智谱 GLM",
      );
    }

    // 检查环境变量
    const envKey = resolveEnvApiKey("glm");
    if (envKey) {
      const useExisting = await params.prompter.confirm({
        message: `使用已有的 ${GLM_ENV_VAR} (${envKey.source}, ${formatApiKeyPreview(envKey.apiKey)})?`,
        initialValue: true,
      });
      if (useExisting) {
        await setGlmApiKey(envKey.apiKey, params.agentDir);
        hasCredential = true;
      }
    }

    // 提示输入
    if (!hasCredential) {
      const key = await params.prompter.text({
        message: "输入智谱 GLM API Key",
        validate: validateApiKeyInput,
      });
      await setGlmApiKey(normalizeApiKeyInput(String(key)), params.agentDir);
    }

    // 应用配置
    nextConfig = applyAuthProfileConfig(nextConfig, {
      profileId: "glm:default",
      provider: "glm",
      mode: "api_key",
    });

    nextConfig = applyGlmProviderConfig(nextConfig);

    if (params.setDefaultModel) {
      nextConfig = applyGlmConfig(nextConfig);
      await params.prompter.note(
        `默认模型已设置为 ${GLM_DEFAULT_MODEL_REF}`,
        "模型配置完成",
      );
    } else {
      agentModelOverride = GLM_DEFAULT_MODEL_REF;
      await noteAgentModel(GLM_DEFAULT_MODEL_REF);
    }

    return { config: nextConfig, agentModelOverride };
  }

  // ============================================================================
  // 阿里云百炼 (Qwen)
  // ============================================================================
  if (authChoice === "aliyun-bailian-api-key") {
    let hasCredential = false;

    // 检查命令行参数
    if (
      !hasCredential &&
      params.opts?.token &&
      params.opts?.tokenProvider === "aliyun-bailian"
    ) {
      await setAliyunBailianApiKey(normalizeApiKeyInput(params.opts.token), params.agentDir);
      hasCredential = true;
    }

    // 显示帮助信息
    if (!hasCredential) {
      await params.prompter.note(
        [
          "阿里云百炼提供通义千问 Qwen 系列模型。",
          "",
          "获取 API Key:",
          "1. 登录阿里云百炼控制台: https://bailian.console.aliyun.com/",
          "2. 点击「API Key 管理」",
          "3. 创建并复制 API Key",
        ].join("\n"),
        "阿里云百炼",
      );
    }

    // 检查环境变量
    const envKey = resolveEnvApiKey("aliyun-bailian");
    if (envKey) {
      const useExisting = await params.prompter.confirm({
        message: `使用已有的 ${ALIYUN_BAILIAN_ENV_VAR} (${envKey.source}, ${formatApiKeyPreview(envKey.apiKey)})?`,
        initialValue: true,
      });
      if (useExisting) {
        await setAliyunBailianApiKey(envKey.apiKey, params.agentDir);
        hasCredential = true;
      }
    }

    // 提示输入
    if (!hasCredential) {
      const key = await params.prompter.text({
        message: "输入阿里云百炼 API Key",
        validate: validateApiKeyInput,
      });
      await setAliyunBailianApiKey(normalizeApiKeyInput(String(key)), params.agentDir);
    }

    // 应用配置
    nextConfig = applyAuthProfileConfig(nextConfig, {
      profileId: "aliyun-bailian:default",
      provider: "aliyun-bailian",
      mode: "api_key",
    });

    nextConfig = applyAliyunBailianProviderConfig(nextConfig);

    if (params.setDefaultModel) {
      nextConfig = applyAliyunBailianConfig(nextConfig);
      await params.prompter.note(
        `默认模型已设置为 ${ALIYUN_BAILIAN_DEFAULT_MODEL_REF}`,
        "模型配置完成",
      );
    } else {
      agentModelOverride = ALIYUN_BAILIAN_DEFAULT_MODEL_REF;
      await noteAgentModel(ALIYUN_BAILIAN_DEFAULT_MODEL_REF);
    }

    return { config: nextConfig, agentModelOverride };
  }

  // ============================================================================
  // 火山引擎 (Doubao)
  // ============================================================================
  if (authChoice === "volcengine-ark-api-key") {
    let hasCredential = false;

    if (
      !hasCredential &&
      params.opts?.token &&
      params.opts?.tokenProvider === "volcengine-ark"
    ) {
      await setVolcengineArkApiKey(normalizeApiKeyInput(params.opts.token), params.agentDir);
      hasCredential = true;
    }

    if (!hasCredential) {
      await params.prompter.note(
        [
          "火山引擎提供豆包 Doubao 系列模型。",
          "",
          "获取 API Key:",
          "1. 登录火山引擎控制台: https://console.volcengine.com/ark/",
          "2. 点击「API Key 管理」",
          "3. 创建并复制 API Key",
        ].join("\n"),
        "火山引擎",
      );
    }

    const envKey = resolveEnvApiKey("volcengine-ark");
    if (envKey) {
      const useExisting = await params.prompter.confirm({
        message: `使用已有的 ${VOLCENGINE_ARK_ENV_VAR} (${envKey.source}, ${formatApiKeyPreview(envKey.apiKey)})?`,
        initialValue: true,
      });
      if (useExisting) {
        await setVolcengineArkApiKey(envKey.apiKey, params.agentDir);
        hasCredential = true;
      }
    }

    if (!hasCredential) {
      const key = await params.prompter.text({
        message: "输入火山引擎 API Key",
        validate: validateApiKeyInput,
      });
      await setVolcengineArkApiKey(normalizeApiKeyInput(String(key)), params.agentDir);
    }

    nextConfig = applyAuthProfileConfig(nextConfig, {
      profileId: "volcengine-ark:default",
      provider: "volcengine-ark",
      mode: "api_key",
    });

    nextConfig = applyVolcengineArkProviderConfig(nextConfig);

    if (params.setDefaultModel) {
      nextConfig = applyVolcengineArkConfig(nextConfig);
      await params.prompter.note(
        `默认模型已设置为 ${VOLCENGINE_ARK_DEFAULT_MODEL_REF}`,
        "模型配置完成",
      );
    } else {
      agentModelOverride = VOLCENGINE_ARK_DEFAULT_MODEL_REF;
      await noteAgentModel(VOLCENGINE_ARK_DEFAULT_MODEL_REF);
    }

    return { config: nextConfig, agentModelOverride };
  }

  // ============================================================================
  // 腾讯混元 (Hunyuan)
  // ============================================================================
  if (authChoice === "tencent-hunyuan-api-key") {
    let hasCredential = false;

    if (
      !hasCredential &&
      params.opts?.token &&
      params.opts?.tokenProvider === "tencent-hunyuan"
    ) {
      await setTencentHunyuanApiKey(normalizeApiKeyInput(params.opts.token), params.agentDir);
      hasCredential = true;
    }

    if (!hasCredential) {
      await params.prompter.note(
        [
          "腾讯云提供混元大模型系列。",
          "",
          "获取 API Key:",
          "1. 登录腾讯云控制台: https://console.cloud.tencent.com/hunyuan/",
          "2. 点击「访问管理」->「API 密钥管理」",
          "3. 创建并复制 SecretId 和 SecretKey",
        ].join("\n"),
        "腾讯混元",
      );
    }

    const envKey = resolveEnvApiKey("tencent-hunyuan");
    if (envKey) {
      const useExisting = await params.prompter.confirm({
        message: `使用已有的 ${TENCENT_HUNYUAN_ENV_VAR} (${envKey.source}, ${formatApiKeyPreview(envKey.apiKey)})?`,
        initialValue: true,
      });
      if (useExisting) {
        await setTencentHunyuanApiKey(envKey.apiKey, params.agentDir);
        hasCredential = true;
      }
    }

    if (!hasCredential) {
      const key = await params.prompter.text({
        message: "输入腾讯混元 SecretId",
        validate: validateApiKeyInput,
      });
      await setTencentHunyuanApiKey(normalizeApiKeyInput(String(key)), params.agentDir);
    }

    nextConfig = applyAuthProfileConfig(nextConfig, {
      profileId: "tencent-hunyuan:default",
      provider: "tencent-hunyuan",
      mode: "api_key",
    });

    nextConfig = applyTencentHunyuanProviderConfig(nextConfig);

    if (params.setDefaultModel) {
      nextConfig = applyTencentHunyuanConfig(nextConfig);
      await params.prompter.note(
        `默认模型已设置为 ${TENCENT_HUNYUAN_DEFAULT_MODEL_REF}`,
        "模型配置完成",
      );
    } else {
      agentModelOverride = TENCENT_HUNYUAN_DEFAULT_MODEL_REF;
      await noteAgentModel(TENCENT_HUNYUAN_DEFAULT_MODEL_REF);
    }

    return { config: nextConfig, agentModelOverride };
  }

  return null;
}
