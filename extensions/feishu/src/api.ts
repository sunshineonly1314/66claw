/**
 * 飞书 API 调用实现
 * Feishu API Implementation
 */

import type {
  FeishuTokenResponse,
  FeishuSendMessageResponse,
  FeishuChannelConfig,
} from "./types.js";

// Token 缓存
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * 获取飞书 Tenant Access Token
 */
export async function getFeishuAccessToken(appId: string, appSecret: string): Promise<string> {
  // 检查缓存
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  const response = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    },
  );

  const data = (await response.json()) as FeishuTokenResponse;
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`获取飞书 Token 失败: ${data.msg || "unknown error"}`);
  }

  // 缓存 Token (提前 5 分钟过期)
  cachedToken = {
    token: data.tenant_access_token,
    expiresAt: Date.now() + (data.expire ?? 7200) * 1000 - 300000,
  };

  return data.tenant_access_token;
}

/**
 * 发送飞书消息
 */
export async function sendFeishuMessage(
  config: FeishuChannelConfig,
  to: string,
  text: string,
  options?: {
    msgType?: "text" | "post" | "image" | "interactive";
    replyToId?: string;
  },
): Promise<{ messageId: string; chatId: string }> {
  const appId = config.app?.appId;
  const appSecret = config.app?.appSecret;
  if (!appId || !appSecret) {
    throw new Error("飞书 App ID 或 App Secret 未配置");
  }

  const token = await getFeishuAccessToken(appId, appSecret);
  const msgType = options?.msgType ?? "text";

  // 确定 receive_id_type
  let receiveIdType = "open_id";
  if (to.startsWith("oc_")) {
    receiveIdType = "chat_id";
  } else if (to.startsWith("on_")) {
    receiveIdType = "union_id";
  }

  // 构建消息内容
  let content: string;
  if (msgType === "text") {
    content = JSON.stringify({ text });
  } else if (msgType === "interactive") {
    // Markdown 卡片
    content = JSON.stringify({
      elements: [{ tag: "markdown", content: text }],
    });
  } else {
    content = JSON.stringify({ text });
  }

  const url = new URL("https://open.feishu.cn/open-apis/im/v1/messages");
  url.searchParams.set("receive_id_type", receiveIdType);

  const body: Record<string, unknown> = {
    receive_id: to,
    msg_type: msgType,
    content,
  };

  if (options?.replyToId) {
    body.reply_in_thread = true;
    // 可以通过 uuid 参数去重
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as FeishuSendMessageResponse;
  if (data.code !== 0 || !data.data) {
    // 打印完整错误信息便于调试
    const debugInfo = `code=${data.code}, msg=${data.msg}, receive_id=${to}, receive_id_type=${receiveIdType}`;
    throw new Error(`发送飞书消息失败: ${data.msg || "unknown error"} (${debugInfo})`);
  }

  return {
    messageId: data.data.message_id,
    chatId: data.data.chat_id,
  };
}

/**
 * 探测飞书连接
 */
export async function probeFeishuConnection(
  config: FeishuChannelConfig,
): Promise<{ ok: boolean; error?: string; appId?: string }> {
  const appId = config.app?.appId;
  const appSecret = config.app?.appSecret;

  if (!appId || !appSecret) {
    return { ok: false, error: "App ID 或 App Secret 未配置" };
  }

  try {
    await getFeishuAccessToken(appId, appSecret);
    return { ok: true, appId };
  } catch (err) {
    return { ok: false, error: String(err), appId };
  }
}

/**
 * 清除 Token 缓存
 */
export function clearFeishuTokenCache(): void {
  cachedToken = null;
}
