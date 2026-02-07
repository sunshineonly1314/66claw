/**
 * 环境变量自动识别模块
 * Auto-detect configuration from environment variables
 *
 * 支持从环境变量自动检测并构建配置，降低 Docker 部署门槛
 */

import type { ClawdbotConfig } from "./types.js";

// ============================================================================
// 环境变量命名约定 (Environment Variable Naming Conventions)
// ============================================================================

/**
 * 标准环境变量前缀
 */
export const ENV_PREFIX = "CLAWDBOT_";

/**
 * 渠道环境变量映射
 * 格式: CLAWDBOT_{CHANNEL}_{FIELD}
 */
export const CHANNEL_ENV_MAPPING = {
  // 飞书 (Feishu)
  CLAWDBOT_FEISHU_APP_ID: "channels.feishu.appId",
  CLAWDBOT_FEISHU_APP_SECRET: "channels.feishu.appSecret",
  CLAWDBOT_FEISHU_MODE: "channels.feishu.connectionMode",
  CLAWDBOT_FEISHU_DOMAIN: "channels.feishu.domain",

  // 钉钉 (DingTalk)
  CLAWDBOT_DINGTALK_APP_KEY: "channels.dingtalk.app.appKey",
  CLAWDBOT_DINGTALK_APP_SECRET: "channels.dingtalk.app.appSecret",
  CLAWDBOT_DINGTALK_ROBOT_CODE: "channels.dingtalk.app.robotCode",
  CLAWDBOT_DINGTALK_MODE: "channels.dingtalk.mode",

  // 企业微信 (WeCom)
  CLAWDBOT_WECOM_CORP_ID: "channels.wecom.app.corpId",
  CLAWDBOT_WECOM_AGENT_ID: "channels.wecom.app.agentId",
  CLAWDBOT_WECOM_AGENT_SECRET: "channels.wecom.app.agentSecret",
  CLAWDBOT_WECOM_TOKEN: "channels.wecom.app.token",
  CLAWDBOT_WECOM_ENCODING_AES_KEY: "channels.wecom.app.encodingAESKey",

  // QQ 机器人 (QQ Bot)
  CLAWDBOT_QQBOT_APP_ID: "channels.qqbot.app.appId",
  CLAWDBOT_QQBOT_APP_SECRET: "channels.qqbot.app.appSecret",
  CLAWDBOT_QQBOT_TOKEN: "channels.qqbot.app.token",
  CLAWDBOT_QQBOT_SANDBOX: "channels.qqbot.sandbox",

  // Gateway 配置
  CLAWDBOT_GATEWAY_TOKEN: "gateway.auth.token",
  CLAWDBOT_GATEWAY_PASSWORD: "gateway.auth.password",
  CLAWDBOT_GATEWAY_PORT: "gateway.port",
  CLAWDBOT_GATEWAY_BIND: "gateway.bind",

  // 模型配置
  CLAWDBOT_MODEL_ID: "models.default.modelId",
  CLAWDBOT_MODEL_PROVIDER: "models.default.provider",
  CLAWDBOT_BASE_URL: "models.default.baseUrl",
  CLAWDBOT_API_KEY: "models.default.apiKey",
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

  // 飞书
  if (env.CLAWDBOT_FEISHU_APP_ID && env.CLAWDBOT_FEISHU_APP_SECRET) {
    channels.feishu = {
      enabled: true,
      appId: env.CLAWDBOT_FEISHU_APP_ID,
      appSecret: env.CLAWDBOT_FEISHU_APP_SECRET,
      connectionMode: env.CLAWDBOT_FEISHU_MODE || "websocket",
      domain: env.CLAWDBOT_FEISHU_DOMAIN || "feishu",
    };
  }

  // 钉钉
  if (env.CLAWDBOT_DINGTALK_APP_KEY && env.CLAWDBOT_DINGTALK_APP_SECRET) {
    channels.dingtalk = {
      enabled: true,
      mode: env.CLAWDBOT_DINGTALK_MODE || "stream",
      app: {
        appKey: env.CLAWDBOT_DINGTALK_APP_KEY,
        appSecret: env.CLAWDBOT_DINGTALK_APP_SECRET,
        robotCode: env.CLAWDBOT_DINGTALK_ROBOT_CODE || env.CLAWDBOT_DINGTALK_APP_KEY,
      },
    };
  }

  // 企业微信
  if (env.CLAWDBOT_WECOM_CORP_ID && env.CLAWDBOT_WECOM_AGENT_SECRET) {
    channels.wecom = {
      enabled: true,
      app: {
        corpId: env.CLAWDBOT_WECOM_CORP_ID,
        agentId: env.CLAWDBOT_WECOM_AGENT_ID ? Number(env.CLAWDBOT_WECOM_AGENT_ID) : undefined,
        agentSecret: env.CLAWDBOT_WECOM_AGENT_SECRET,
        token: env.CLAWDBOT_WECOM_TOKEN,
        encodingAESKey: env.CLAWDBOT_WECOM_ENCODING_AES_KEY,
      },
    };
  }

  // QQ 机器人
  if (env.CLAWDBOT_QQBOT_APP_ID && env.CLAWDBOT_QQBOT_APP_SECRET) {
    channels.qqbot = {
      enabled: true,
      sandbox: env.CLAWDBOT_QQBOT_SANDBOX === "true",
      app: {
        appId: env.CLAWDBOT_QQBOT_APP_ID,
        appSecret: env.CLAWDBOT_QQBOT_APP_SECRET,
        token: env.CLAWDBOT_QQBOT_TOKEN,
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

  if (env.CLAWDBOT_GATEWAY_TOKEN || env.CLAWDBOT_GATEWAY_PASSWORD) {
    gateway.auth = {
      token: env.CLAWDBOT_GATEWAY_TOKEN,
      password: env.CLAWDBOT_GATEWAY_PASSWORD,
    };
  }

  if (env.CLAWDBOT_GATEWAY_PORT) {
    gateway.port = Number(env.CLAWDBOT_GATEWAY_PORT);
  }

  if (env.CLAWDBOT_GATEWAY_BIND) {
    gateway.bind = env.CLAWDBOT_GATEWAY_BIND;
  }

  return gateway;
}

/**
 * 从环境变量检测模型配置
 */
export function detectModelsFromEnv(env: NodeJS.ProcessEnv): Record<string, unknown> {
  const models: Record<string, unknown> = {};

  if (env.CLAWDBOT_API_KEY || env.CLAWDBOT_BASE_URL) {
    models.default = {
      modelId: env.CLAWDBOT_MODEL_ID,
      provider: env.CLAWDBOT_MODEL_PROVIDER,
      baseUrl: env.CLAWDBOT_BASE_URL,
      apiKey: env.CLAWDBOT_API_KEY,
    };
  }

  return models;
}

/**
 * 从环境变量构建完整配置
 */
export function buildConfigFromEnv(env: NodeJS.ProcessEnv): Partial<ClawdbotConfig> {
  const config: Partial<ClawdbotConfig> = {};

  const channels = detectChannelsFromEnv(env);
  if (Object.keys(channels).length > 0) {
    config.channels = channels as ClawdbotConfig["channels"];
  }

  const gateway = detectGatewayFromEnv(env);
  if (Object.keys(gateway).length > 0) {
    config.gateway = gateway as ClawdbotConfig["gateway"];
  }

  const models = detectModelsFromEnv(env);
  if (Object.keys(models).length > 0) {
    config.models = models as ClawdbotConfig["models"];
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

  // 检测渠道
  if (env.CLAWDBOT_FEISHU_APP_ID && env.CLAWDBOT_FEISHU_APP_SECRET) {
    channels.push("feishu");
  }
  if (env.CLAWDBOT_DINGTALK_APP_KEY && env.CLAWDBOT_DINGTALK_APP_SECRET) {
    channels.push("dingtalk");
  }
  if (env.CLAWDBOT_WECOM_CORP_ID && env.CLAWDBOT_WECOM_AGENT_SECRET) {
    channels.push("wecom");
  }
  if (env.CLAWDBOT_QQBOT_APP_ID && env.CLAWDBOT_QQBOT_APP_SECRET) {
    channels.push("qqbot");
  }

  return {
    hasChannels: channels.length > 0,
    hasGateway: Boolean(env.CLAWDBOT_GATEWAY_TOKEN || env.CLAWDBOT_GATEWAY_PASSWORD || env.CLAWDBOT_GATEWAY_PORT),
    hasModels: Boolean(env.CLAWDBOT_API_KEY || env.CLAWDBOT_BASE_URL),
    channels,
    detectedVars,
  };
}

/**
 * 合并环境变量配置到现有配置
 * 注意：现有配置优先，环境变量只填充缺失项
 */
export function mergeEnvConfig(
  existingConfig: ClawdbotConfig,
  envConfig: Partial<ClawdbotConfig>,
): ClawdbotConfig {
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
    } as ClawdbotConfig["gateway"];
  }

  // 合并模型配置
  if (envConfig.models) {
    merged.models = {
      ...envConfig.models,
      ...existingConfig.models,
    } as ClawdbotConfig["models"];
  }

  return merged;
}

/**
 * 生成环境变量示例 (.env.example 内容)
 */
export function generateEnvExample(): string {
  return `# Clawdbot 环境变量配置
# Clawdbot Environment Variables Configuration
#
# 使用方法：复制此文件为 .env 并填写相应值
# Usage: Copy this file to .env and fill in the values

# ============================================================================
# AI 模型配置 (AI Model Configuration)
# ============================================================================

# 默认模型 ID
# CLAWDBOT_MODEL_ID=gpt-4

# 模型提供商
# CLAWDBOT_MODEL_PROVIDER=openai

# API Base URL
# CLAWDBOT_BASE_URL=https://api.openai.com/v1

# API Key
# CLAWDBOT_API_KEY=sk-xxx

# ============================================================================
# Gateway 配置 (Gateway Configuration)
# ============================================================================

# Gateway 访问令牌
# CLAWDBOT_GATEWAY_TOKEN=your-secure-token

# Gateway 端口 (默认 18789)
# CLAWDBOT_GATEWAY_PORT=18789

# Gateway 绑定地址 (loopback/lan/all)
# CLAWDBOT_GATEWAY_BIND=lan

# ============================================================================
# 飞书配置 (Feishu Configuration)
# ============================================================================

# 飞书 App ID
# CLAWDBOT_FEISHU_APP_ID=cli_xxxxx

# 飞书 App Secret
# CLAWDBOT_FEISHU_APP_SECRET=xxxxx

# 连接模式: websocket (推荐) 或 webhook
# CLAWDBOT_FEISHU_MODE=websocket

# 域名: feishu (国内) 或 lark (国际)
# CLAWDBOT_FEISHU_DOMAIN=feishu

# ============================================================================
# 钉钉配置 (DingTalk Configuration)
# ============================================================================

# 钉钉 App Key (Client ID)
# CLAWDBOT_DINGTALK_APP_KEY=xxxxx

# 钉钉 App Secret (Client Secret)
# CLAWDBOT_DINGTALK_APP_SECRET=xxxxx

# 机器人 Robot Code (可选，默认与 App Key 相同)
# CLAWDBOT_DINGTALK_ROBOT_CODE=xxxxx

# 接入模式: stream (推荐) 或 webhook
# CLAWDBOT_DINGTALK_MODE=stream

# ============================================================================
# 企业微信配置 (WeCom Configuration)
# ============================================================================

# 企业 ID
# CLAWDBOT_WECOM_CORP_ID=ww1234567890abcdef

# 应用 Agent ID
# CLAWDBOT_WECOM_AGENT_ID=1000002

# 应用 Secret
# CLAWDBOT_WECOM_AGENT_SECRET=xxxxx

# 回调 Token
# CLAWDBOT_WECOM_TOKEN=xxxxx

# 回调 EncodingAESKey
# CLAWDBOT_WECOM_ENCODING_AES_KEY=xxxxx

# ============================================================================
# QQ 机器人配置 (QQ Bot Configuration)
# ============================================================================

# QQ 机器人 App ID
# CLAWDBOT_QQBOT_APP_ID=xxxxx

# QQ 机器人 App Secret
# CLAWDBOT_QQBOT_APP_SECRET=xxxxx

# QQ 机器人 Token (可选)
# CLAWDBOT_QQBOT_TOKEN=xxxxx

# 沙箱模式 (true/false)
# CLAWDBOT_QQBOT_SANDBOX=false
`;
}
