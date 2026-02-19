/**
 * 钉钉 API 调用实现
 * DingTalk API Implementation
 */

import type {
  DingtalkChannelConfig,
  DingtalkMessage,
} from "./types.js";

// ============================================================================
// 常量
// ============================================================================

/** Token 请求超时 */
const TOKEN_TIMEOUT_MS = 10_000;

/** 消息发送超时 */
const SEND_TIMEOUT_MS = 15_000;

/** Webhook 发送重试次数 */
const WEBHOOK_RETRY_COUNT = 1;

/** Webhook 重试间隔 */
const WEBHOOK_RETRY_DELAY_MS = 1_000;

// ============================================================================
// Token 缓存 & 并发去重
// ============================================================================

let cachedToken: { token: string; expiresAt: number } | null = null;

/** 正在进行的 token 请求（防止并发重复请求）
 * 注意: 当前为模块级单例，仅适用于单账号场景。
 * 若将来扩展为多账号(不同 appKey)，需改为 Map<appKey, Promise> */
let pendingTokenRequest: Promise<string> | null = null;

/**
 * 获取钉钉 Access Token（带缓存、超时、并发去重）
 */
export async function getDingtalkAccessToken(appKey: string, appSecret: string): Promise<string> {
  // 检查缓存
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  // 并发去重：如果已有请求在进行中，等待它完成
  if (pendingTokenRequest) {
    return pendingTokenRequest;
  }

  pendingTokenRequest = fetchAccessToken(appKey, appSecret);
  try {
    return await pendingTokenRequest;
  } finally {
    pendingTokenRequest = null;
  }
}

async function fetchAccessToken(appKey: string, appSecret: string): Promise<string> {
  const response = await fetch("https://api.dingtalk.com/v1.0/oauth2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appKey, appSecret }),
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`获取钉钉 Token HTTP 错误: ${response.status} ${errText}`);
  }

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
 * 通过 Session Webhook 发送消息（带超时和重试）
 */
export async function sendDingtalkMessageViaWebhook(
  sessionWebhook: string,
  message: DingtalkMessage,
): Promise<void> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= WEBHOOK_RETRY_COUNT; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, WEBHOOK_RETRY_DELAY_MS));
      }

      const response = await fetch(sessionWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`发送钉钉消息失败: ${response.status} ${text}`);
      }
      return; // 成功
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < WEBHOOK_RETRY_COUNT) {
        // 仅网络错误或超时时重试，HTTP 4xx 不重试
        if (lastError.message.includes("发送钉钉消息失败: 4")) {
          throw lastError;
        }
      }
    }
  }

  throw lastError ?? new Error("发送钉钉消息失败: 未知错误");
}

/**
 * 通过机器人 API 发送消息（带超时）
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
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`发送钉钉消息 HTTP 错误: ${response.status} ${errText}`);
  }

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
