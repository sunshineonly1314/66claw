/**
 * QQ 机器人 API 实现
 * QQ Bot API Implementation
 *
 * 基于 QQ 开放平台 API v2
 * 文档: https://q.qq.com/wiki/develop/api-v2/
 */

import type {
  QqbotChannelConfig,
  QqbotProbeResult,
  QqbotTokenResponse,
  QqbotSendMessageResponse,
} from "./types.js";

// ============================================================================
// 常量定义 (Constants)
// ============================================================================

/** 正式环境 API 地址 */
const API_BASE_URL = "https://api.sgroup.qq.com";

/** 沙箱环境 API 地址 */
const SANDBOX_API_BASE_URL = "https://sandbox.api.sgroup.qq.com";

/** Token 缓存 */
let tokenCache: {
  token: string;
  expiresAt: number;
} | null = null;

// ============================================================================
// API 函数 (API Functions)
// ============================================================================

/**
 * 获取 API 基础地址
 */
function getApiBaseUrl(sandbox?: boolean): string {
  return sandbox ? SANDBOX_API_BASE_URL : API_BASE_URL;
}

/**
 * 获取 Access Token
 */
export async function getAccessToken(config: QqbotChannelConfig): Promise<string> {
  const appId = config.app?.appId;
  const appSecret = config.app?.appSecret;

  if (!appId || !appSecret) {
    throw new Error("QQ Bot appId and appSecret are required");
  }

  // 检查缓存
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  const response = await fetch("https://bots.qq.com/app/getAppAccessToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      appId,
      clientSecret: appSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as QqbotTokenResponse;

  // 缓存 token，提前 5 分钟过期
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return data.access_token;
}

/**
 * 发送消息到用户 (C2C)
 */
export async function sendC2CMessage(
  config: QqbotChannelConfig,
  openId: string,
  content: string,
  msgId?: string,
): Promise<QqbotSendMessageResponse> {
  const token = await getAccessToken(config);
  const baseUrl = getApiBaseUrl(config.sandbox);

  const response = await fetch(`${baseUrl}/v2/users/${openId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `QQBot ${token}`,
    },
    body: JSON.stringify({
      content,
      msg_type: 0, // 文本消息
      msg_id: msgId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send C2C message: ${response.status} ${error}`);
  }

  return (await response.json()) as QqbotSendMessageResponse;
}

/**
 * 发送消息到群聊
 */
export async function sendGroupMessage(
  config: QqbotChannelConfig,
  groupOpenId: string,
  content: string,
  msgId?: string,
): Promise<QqbotSendMessageResponse> {
  const token = await getAccessToken(config);
  const baseUrl = getApiBaseUrl(config.sandbox);

  const response = await fetch(`${baseUrl}/v2/groups/${groupOpenId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `QQBot ${token}`,
    },
    body: JSON.stringify({
      content,
      msg_type: 0, // 文本消息
      msg_id: msgId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send group message: ${response.status} ${error}`);
  }

  return (await response.json()) as QqbotSendMessageResponse;
}

/**
 * 发送消息到频道
 */
export async function sendChannelMessage(
  config: QqbotChannelConfig,
  channelId: string,
  content: string,
  msgId?: string,
): Promise<QqbotSendMessageResponse> {
  const token = await getAccessToken(config);
  const baseUrl = getApiBaseUrl(config.sandbox);

  const response = await fetch(`${baseUrl}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `QQBot ${token}`,
    },
    body: JSON.stringify({
      content,
      msg_id: msgId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send channel message: ${response.status} ${error}`);
  }

  return (await response.json()) as QqbotSendMessageResponse;
}

/**
 * 通用发送消息函数
 */
export async function sendQqbotMessage(
  config: QqbotChannelConfig,
  target: string,
  content: string,
  msgId?: string,
): Promise<void> {
  // 解析目标格式: c2c:<openId> | group:<groupOpenId> | channel:<channelId>
  const [type, id] = target.split(":");

  switch (type) {
    case "c2c":
    case "user":
      await sendC2CMessage(config, id, content, msgId);
      break;
    case "group":
      await sendGroupMessage(config, id, content, msgId);
      break;
    case "channel":
      await sendChannelMessage(config, id, content, msgId);
      break;
    default:
      // 默认当作 C2C 消息
      await sendC2CMessage(config, target, content, msgId);
  }
}

/**
 * 探测 QQ 机器人连接
 */
export async function probeQqbotConnection(config: QqbotChannelConfig): Promise<QqbotProbeResult> {
  const startTime = Date.now();

  try {
    const appId = config.app?.appId;
    const appSecret = config.app?.appSecret;

    if (!appId || !appSecret) {
      return {
        ok: false,
        error: "Missing appId or appSecret",
        elapsedMs: Date.now() - startTime,
      };
    }

    // 尝试获取 access token 来验证凭证
    const token = await getAccessToken(config);
    const baseUrl = getApiBaseUrl(config.sandbox);

    // 获取机器人信息
    const response = await fetch(`${baseUrl}/users/@me`, {
      headers: {
        Authorization: `QQBot ${token}`,
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `API request failed: ${response.status}`,
        appId,
        elapsedMs: Date.now() - startTime,
      };
    }

    const botInfo = (await response.json()) as { id: string; username?: string };

    return {
      ok: true,
      appId,
      botInfo: {
        id: botInfo.id,
        username: botInfo.username,
      },
      elapsedMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - startTime,
    };
  }
}

/**
 * 清除 Token 缓存
 */
export function clearTokenCache(): void {
  tokenCache = null;
}
