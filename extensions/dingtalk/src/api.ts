/**
 * 钉钉 API 调用实现
 * DingTalk API Implementation
 */

import type {
  DingtalkChannelConfig,
  DingtalkMessage,
} from "./types.js";

// Token 缓存
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * 获取钉钉 Access Token
 */
export async function getDingtalkAccessToken(appKey: string, appSecret: string): Promise<string> {
  // 检查缓存
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  // 使用新版 API
  const response = await fetch("https://api.dingtalk.com/v1.0/oauth2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appKey, appSecret }),
  });

  const data = (await response.json()) as {
    accessToken?: string;
    expireIn?: number;
    code?: string;
    message?: string;
  };

  if (!data.accessToken) {
    throw new Error(`获取钉钉 Token 失败: ${data.message || data.code || "unknown error"}`);
  }

  // 缓存 Token (提前 5 分钟过期)
  cachedToken = {
    token: data.accessToken,
    expiresAt: Date.now() + (data.expireIn ?? 7200) * 1000 - 300000,
  };

  return data.accessToken;
}

/**
 * 通过 Session Webhook 发送消息 (推荐方式)
 */
export async function sendDingtalkMessageViaWebhook(
  sessionWebhook: string,
  message: DingtalkMessage,
): Promise<void> {
  const response = await fetch(sessionWebhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`发送钉钉消息失败: ${response.status} ${text}`);
  }
}

/**
 * 通过机器人 API 发送消息
 */
export async function sendDingtalkMessage(
  config: DingtalkChannelConfig,
  userIds: string[],
  text: string,
  options?: {
    msgType?: "text" | "markdown";
    title?: string;
  },
): Promise<{ processQueryKey?: string }> {
  const appKey = config.app?.appKey;
  const appSecret = config.app?.appSecret;
  const robotCode = config.app?.robotCode;

  if (!appKey || !appSecret) {
    throw new Error("钉钉 AppKey 或 AppSecret 未配置");
  }
  if (!robotCode) {
    throw new Error("钉钉 RobotCode 未配置 (批量发送需要)");
  }

  const token = await getDingtalkAccessToken(appKey, appSecret);
  const msgType = options?.msgType ?? "text";

  let msgKey: string;
  let msgParam: string;

  if (msgType === "markdown") {
    msgKey = "sampleMarkdown";
    msgParam = JSON.stringify({
      title: options?.title ?? "消息",
      text,
    });
  } else {
    msgKey = "sampleText";
    msgParam = JSON.stringify({ content: text });
  }

  const response = await fetch("https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-acs-dingtalk-access-token": token,
    },
    body: JSON.stringify({
      robotCode,
      userIds,
      msgKey,
      msgParam,
    }),
  });

  const data = (await response.json()) as {
    processQueryKey?: string;
    code?: string;
    message?: string;
  };

  if (data.code) {
    throw new Error(`发送钉钉消息失败: ${data.message || data.code}`);
  }

  return { processQueryKey: data.processQueryKey };
}

/**
 * 探测钉钉连接
 */
export async function probeDingtalkConnection(
  config: DingtalkChannelConfig,
): Promise<{ ok: boolean; error?: string; appKey?: string; robotCode?: string }> {
  const appKey = config.app?.appKey;
  const appSecret = config.app?.appSecret;
  const robotCode = config.app?.robotCode;

  if (!appKey || !appSecret) {
    return { ok: false, error: "AppKey 或 AppSecret 未配置" };
  }

  try {
    await getDingtalkAccessToken(appKey, appSecret);
    return { ok: true, appKey, robotCode: robotCode ?? undefined };
  } catch (err) {
    return { ok: false, error: String(err), appKey };
  }
}

/**
 * 清除 Token 缓存
 */
export function clearDingtalkTokenCache(): void {
  cachedToken = null;
}
