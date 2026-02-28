/**
 * 环境变量自动识别模块
 * Auto-detect configuration from environment variables
 *
 * 支持从环境变量自动检测并构建配置，降低 Docker 部署门槛
 */

import type { OpenClawCNConfig } from "./types.js";

// ============================================================================
// 环境变量命名约定 (Environment Variable Naming Conventions)
// ============================================================================

/**
 * 标准环境变量前缀
 */
export const ENV_PREFIX = "OPENCLAWCN_";

/**
 * 渠道环境变量映射
 * 格式: OPENCLAWCN_{CHANNEL}_{FIELD}
 * 兼容旧前缀: CLAWDBOT_{CHANNEL}_{FIELD}
 */
export const CHANNEL_ENV_MAPPING = {
  // 飞书 (Feishu)
  OPENCLAWCN_FEISHU_APP_ID: "channels.feishu.appId",
  OPENCLAWCN_FEISHU_APP_SECRET: "channels.feishu.appSecret",
  OPENCLAWCN_FEISHU_MODE: "channels.feishu.connectionMode",
  OPENCLAWCN_FEISHU_DOMAIN: "channels.feishu.domain",
  // 飞书 - legacy CLAWDBOT_ prefix
  CLAWDBOT_FEISHU_APP_ID: "channels.feishu.appId",
  CLAWDBOT_FEISHU_APP_SECRET: "channels.feishu.appSecret",
  CLAWDBOT_FEISHU_MODE: "channels.feishu.connectionMode",
  CLAWDBOT_FEISHU_DOMAIN: "channels.feishu.domain",

  // 钉钉 (DingTalk)
  OPENCLAWCN_DINGTALK_APP_KEY: "channels.dingtalk.app.appKey",
  OPENCLAWCN_DINGTALK_APP_SECRET: "channels.dingtalk.app.appSecret",
  OPENCLAWCN_DINGTALK_ROBOT_CODE: "channels.dingtalk.app.robotCode",
  OPENCLAWCN_DINGTALK_MODE: "channels.dingtalk.mode",
  // 钉钉 - legacy CLAWDBOT_ prefix
  CLAWDBOT_DINGTALK_APP_KEY: "channels.dingtalk.app.appKey",
  CLAWDBOT_DINGTALK_APP_SECRET: "channels.dingtalk.app.appSecret",
  CLAWDBOT_DINGTALK_ROBOT_CODE: "channels.dingtalk.app.robotCode",
  CLAWDBOT_DINGTALK_MODE: "channels.dingtalk.mode",

  // 企业微信 (WeCom)
  OPENCLAWCN_WECOM_CORP_ID: "channels.wecom.app.corpId",
  OPENCLAWCN_WECOM_AGENT_ID: "channels.wecom.app.agentId",
  OPENCLAWCN_WECOM_AGENT_SECRET: "channels.wecom.app.agentSecret",
  OPENCLAWCN_WECOM_TOKEN: "channels.wecom.app.token",
  OPENCLAWCN_WECOM_ENCODING_AES_KEY: "channels.wecom.app.encodingAESKey",

  // QQ 机器人 (QQ Bot)
  OPENCLAWCN_QQBOT_APP_ID: "channels.qqbot.app.appId",
  OPENCLAWCN_QQBOT_APP_SECRET: "channels.qqbot.app.appSecret",
  OPENCLAWCN_QQBOT_TOKEN: "channels.qqbot.app.token",
  OPENCLAWCN_QQBOT_SANDBOX: "channels.qqbot.sandbox",

  // Gateway 配置
  OPENCLAWCN_GATEWAY_TOKEN: "gateway.auth.token",
  OPENCLAWCN_GATEWAY_PASSWORD: "gateway.auth.password",
  OPENCLAWCN_GATEWAY_PORT: "gateway.port",
  OPENCLAWCN_GATEWAY_BIND: "gateway.bind",

  // 模型配置
  OPENCLAWCN_MODEL_ID: "models.default.modelId",
  OPENCLAWCN_MODEL_PROVIDER: "models.default.provider",
  OPENCLAWCN_BASE_URL: "models.default.baseUrl",
  OPENCLAWCN_API_KEY: "models.default.apiKey",
} as const;

/**
 * 类型转换规则
 */
const TYPE_CONVERSIONS: Record<string, "boolean" | "number" | "string"> = {
  "channels.feishu.enabled": "boolean",
  "channels.dingtalk.enabled": "boolean",
  "channels.wecom.enabled": "boolean",
  "channels.qqbot.enabled": "boolean",
  "channels.qqbot.sandbox": "boolean",
  "channels.wecom.app.agentId": "number",
  "gateway.port": "number",
};

// ============================================================================
// 核心函数 (Core Functions)
// ============================================================================

/**
 * 从环境变量检测渠道配置
 */
export function detectChannelsFromEnv(env: NodeJS.ProcessEnv): Record<string, unknown> {
  const channels: Record<string, unknown> = {};

  // 飞书 (OPENCLAWCN_ 优先, CLAWDBOT_ 兼容)
  const feishuAppId = env.OPENCLAWCN_FEISHU_APP_ID || env.CLAWDBOT_FEISHU_APP_ID;
  const feishuAppSecret = env.OPENCLAWCN_FEISHU_APP_SECRET || env.CLAWDBOT_FEISHU_APP_SECRET;
  if (feishuAppId && feishuAppSecret) {
    channels.feishu = {
      enabled: true,
      appId: feishuAppId,
      appSecret: feishuAppSecret,
      connectionMode: env.OPENCLAWCN_FEISHU_MODE || env.CLAWDBOT_FEISHU_MODE || "websocket",
      domain: env.OPENCLAWCN_FEISHU_DOMAIN || env.CLAWDBOT_FEISHU_DOMAIN || "feishu",
    };
  }

  // 钉钉 (OPENCLAWCN_ 优先, CLAWDBOT_ 兼容)
  const dingtalkAppKey = env.OPENCLAWCN_DINGTALK_APP_KEY || env.CLAWDBOT_DINGTALK_APP_KEY;
  const dingtalkAppSecret = env.OPENCLAWCN_DINGTALK_APP_SECRET || env.CLAWDBOT_DINGTALK_APP_SECRET;
  if (dingtalkAppKey && dingtalkAppSecret) {
    channels.dingtalk = {
      enabled: true,
      mode: env.OPENCLAWCN_DINGTALK_MODE || env.CLAWDBOT_DINGTALK_MODE || "stream",
      app: {
        appKey: dingtalkAppKey,
        appSecret: dingtalkAppSecret,
        robotCode:
          env.OPENCLAWCN_DINGTALK_ROBOT_CODE || env.CLAWDBOT_DINGTALK_ROBOT_CODE || dingtalkAppKey,
      },
    };
  }

  // 企业微信
  if (env.OPENCLAWCN_WECOM_CORP_ID && env.OPENCLAWCN_WECOM_AGENT_SECRET) {
    channels.wecom = {
      enabled: true,
      app: {
        corpId: env.OPENCLAWCN_WECOM_CORP_ID,
        agentId: env.OPENCLAWCN_WECOM_AGENT_ID ? Number(env.OPENCLAWCN_WECOM_AGENT_ID) : undefined,
        agentSecret: env.OPENCLAWCN_WECOM_AGENT_SECRET,
        token: env.OPENCLAWCN_WECOM_TOKEN,
        encodingAESKey: env.OPENCLAWCN_WECOM_ENCODING_AES_KEY,
      },
    };
  }

  // QQ 机器人
  if (env.OPENCLAWCN_QQBOT_APP_ID && env.OPENCLAWCN_QQBOT_APP_SECRET) {
    channels.qqbot = {
      enabled: true,
      sandbox: env.OPENCLAWCN_QQBOT_SANDBOX === "true",
      app: {
        appId: env.OPENCLAWCN_QQBOT_APP_ID,
        appSecret: env.OPENCLAWCN_QQBOT_APP_SECRET,
        token: env.OPENCLAWCN_QQBOT_TOKEN,
      },
    };
  }

  return channels;
}

/**
 * 从环境变量检测 Gateway 配置
 */
export function detectGatewayFromEnv(env: NodeJS.ProcessEnv): Record<string, unknown> {
  const gateway: Record<string, unknown> = {};

  if (env.OPENCLAWCN_GATEWAY_TOKEN || env.OPENCLAWCN_GATEWAY_PASSWORD) {
    gateway.auth = {
      token: env.OPENCLAWCN_GATEWAY_TOKEN,
      password: env.OPENCLAWCN_GATEWAY_PASSWORD,
    };
  }

  if (env.OPENCLAWCN_GATEWAY_PORT) {
    gateway.port = Number(env.OPENCLAWCN_GATEWAY_PORT);
  }

  if (env.OPENCLAWCN_GATEWAY_BIND) {
    gateway.bind = env.OPENCLAWCN_GATEWAY_BIND;
  }

  return gateway;
}

/**
 * 从环境变量检测模型配置
 */
export function detectModelsFromEnv(env: NodeJS.ProcessEnv): Record<string, unknown> {
  const models: Record<string, unknown> = {};

  if (env.OPENCLAWCN_API_KEY || env.OPENCLAWCN_BASE_URL) {
    models.default = {
      modelId: env.OPENCLAWCN_MODEL_ID,
      provider: env.OPENCLAWCN_MODEL_PROVIDER,
      baseUrl: env.OPENCLAWCN_BASE_URL,
      apiKey: env.OPENCLAWCN_API_KEY,
    };
  }

  return models;
}

/**
 * 从环境变量构建完整配置
 */
export function buildConfigFromEnv(env: NodeJS.ProcessEnv): Partial<OpenClawCNConfig> {
  const config: Partial<OpenClawCNConfig> = {};

  const channels = detectChannelsFromEnv(env);
  if (Object.keys(channels).length > 0) {
    config.channels = channels as OpenClawCNConfig["channels"];
  }

  const gateway = detectGatewayFromEnv(env);
  if (Object.keys(gateway).length > 0) {
    config.gateway = gateway as OpenClawCNConfig["gateway"];
  }

  const models = detectModelsFromEnv(env);
  if (Object.keys(models).length > 0) {
    config.models = models as OpenClawCNConfig["models"];
  }

  return config;
}

/**
 * 检测到的环境变量配置摘要
 */
export interface EnvConfigSummary {
  hasChannels: boolean;
  hasGateway: boolean;
  hasModels: boolean;
  channels: string[];
  detectedVars: string[];
}

/**
 * 获取环境变量配置摘要
 */
export function getEnvConfigSummary(env: NodeJS.ProcessEnv): EnvConfigSummary {
  const detectedVars: string[] = [];
  const channels: string[] = [];

  // 检测已设置的环境变量
  for (const key of Object.keys(CHANNEL_ENV_MAPPING)) {
    if (env[key]?.trim()) {
      detectedVars.push(key);
    }
  }

  // 检测渠道 (OPENCLAWCN_ 优先, CLAWDBOT_ 兼容)
  if (
    (env.OPENCLAWCN_FEISHU_APP_ID || env.CLAWDBOT_FEISHU_APP_ID) &&
    (env.OPENCLAWCN_FEISHU_APP_SECRET || env.CLAWDBOT_FEISHU_APP_SECRET)
  ) {
    channels.push("feishu");
  }
  if (
    (env.OPENCLAWCN_DINGTALK_APP_KEY || env.CLAWDBOT_DINGTALK_APP_KEY) &&
    (env.OPENCLAWCN_DINGTALK_APP_SECRET || env.CLAWDBOT_DINGTALK_APP_SECRET)
  ) {
    channels.push("dingtalk");
  }
  if (env.OPENCLAWCN_WECOM_CORP_ID && env.OPENCLAWCN_WECOM_AGENT_SECRET) {
    channels.push("wecom");
  }
  if (env.OPENCLAWCN_QQBOT_APP_ID && env.OPENCLAWCN_QQBOT_APP_SECRET) {
    channels.push("qqbot");
  }

  return {
    hasChannels: channels.length > 0,
    hasGateway: Boolean(
      env.OPENCLAWCN_GATEWAY_TOKEN ||
      env.OPENCLAWCN_GATEWAY_PASSWORD ||
      env.OPENCLAWCN_GATEWAY_PORT,
    ),
    hasModels: Boolean(env.OPENCLAWCN_API_KEY || env.OPENCLAWCN_BASE_URL),
    channels,
    detectedVars,
  };
}

/**
 * 合并环境变量配置到现有配置
 * 注意：现有配置优先，环境变量只填充缺失项
 */
export function mergeEnvConfig(
  existingConfig: OpenClawCNConfig,
  envConfig: Partial<OpenClawCNConfig>,
): OpenClawCNConfig {
  const merged = { ...existingConfig };

  // 合并渠道配置
  if (envConfig.channels) {
    merged.channels = {
      ...envConfig.channels,
      ...existingConfig.channels,
    };
  }

  // 合并 Gateway 配置
  if (envConfig.gateway) {
    merged.gateway = {
      ...envConfig.gateway,
      ...existingConfig.gateway,
    } as OpenClawCNConfig["gateway"];
  }

  // 合并模型配置
  if (envConfig.models) {
    merged.models = {
      ...envConfig.models,
      ...existingConfig.models,
    } as OpenClawCNConfig["models"];
  }

  return merged;
}

/**
 * 生成环境变量示例 (.env.example 内容)
 */
export function generateEnvExample(): string {
  return `# OpenClawCN 环境变量配置
# OpenClawCN Environment Variables Configuration
#
# 使用方法：复制此文件为 .env 并填写相应值
# Usage: Copy this file to .env and fill in the values

# ============================================================================
# AI 模型配置 (AI Model Configuration)
# ============================================================================

# 默认模型 ID
# OPENCLAWCN_MODEL_ID=gpt-4

# 模型提供商
# OPENCLAWCN_MODEL_PROVIDER=openai

# API Base URL
# OPENCLAWCN_BASE_URL=https://api.openai.com/v1

# API Key
# OPENCLAWCN_API_KEY=sk-xxx

# ============================================================================
# Gateway 配置 (Gateway Configuration)
# ============================================================================

# Gateway 访问令牌
# OPENCLAWCN_GATEWAY_TOKEN=your-secure-token

# Gateway 端口 (默认 18789)
# OPENCLAWCN_GATEWAY_PORT=18789

# Gateway 绑定地址 (loopback/lan/all)
# OPENCLAWCN_GATEWAY_BIND=lan

# ============================================================================
# 飞书配置 (Feishu Configuration)
# 也支持 CLAWDBOT_FEISHU_* 前缀 (兼容旧版)
# ============================================================================

# 飞书 App ID
# OPENCLAWCN_FEISHU_APP_ID=cli_xxxxx

# 飞书 App Secret
# OPENCLAWCN_FEISHU_APP_SECRET=xxxxx

# 连接模式: websocket (推荐) 或 webhook
# OPENCLAWCN_FEISHU_MODE=websocket

# 域名: feishu (国内) 或 lark (国际)
# OPENCLAWCN_FEISHU_DOMAIN=feishu

# ============================================================================
# 钉钉配置 (DingTalk Configuration)
# 也支持 CLAWDBOT_DINGTALK_* 前缀 (兼容旧版)
# ============================================================================

# 钉钉 App Key (Client ID)
# OPENCLAWCN_DINGTALK_APP_KEY=xxxxx

# 钉钉 App Secret (Client Secret)
# OPENCLAWCN_DINGTALK_APP_SECRET=xxxxx

# 机器人 Robot Code (可选，默认与 App Key 相同)
# OPENCLAWCN_DINGTALK_ROBOT_CODE=xxxxx

# 接入模式: stream (推荐) 或 webhook
# OPENCLAWCN_DINGTALK_MODE=stream

# ============================================================================
# 企业微信配置 (WeCom Configuration)
# ============================================================================

# 企业 ID
# OPENCLAWCN_WECOM_CORP_ID=ww1234567890abcdef

# 应用 Agent ID
# OPENCLAWCN_WECOM_AGENT_ID=1000002

# 应用 Secret
# OPENCLAWCN_WECOM_AGENT_SECRET=xxxxx

# 回调 Token
# OPENCLAWCN_WECOM_TOKEN=xxxxx

# 回调 EncodingAESKey
# OPENCLAWCN_WECOM_ENCODING_AES_KEY=xxxxx

# ============================================================================
# QQ 机器人配置 (QQ Bot Configuration)
# ============================================================================

# QQ 机器人 App ID
# OPENCLAWCN_QQBOT_APP_ID=xxxxx

# QQ 机器人 App Secret
# OPENCLAWCN_QQBOT_APP_SECRET=xxxxx

# QQ 机器人 Token (可选)
# OPENCLAWCN_QQBOT_TOKEN=xxxxx

# 沙箱模式 (true/false)
# OPENCLAWCN_QQBOT_SANDBOX=false
`;
}
