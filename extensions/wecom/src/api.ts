/**
 * 企业微信 API 调用实现
 * WeCom (WeChat Work) API Implementation
 *
 * 文档参考:
 * - 获取 access_token: https://developer.work.weixin.qq.com/document/path/91039
 * - 发送应用消息: https://developer.work.weixin.qq.com/document/path/90236
 */

import type {
  WecomChannelConfig,
  WecomMessage,
  WecomSendMessageResponse,
  WecomTokenResponse,
} from "./types.js";

// Token 缓存 (每个 corpId + agentId 组合一个)
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * 获取企业微信 Access Token
 *
 * @param corpId - 企业 ID
 * @param agentSecret - 应用 Secret
 * @returns Access Token
 */
export async function getWecomAccessToken(corpId: string, agentSecret: string): Promise<string> {
  const cacheKey = `${corpId}:${agentSecret.slice(0, 8)}`;

  // 检查缓存 (提前 1 分钟过期)
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.token;
  }

  // 请求新 Token
  const url = new URL("https://qyapi.weixin.qq.com/cgi-bin/gettoken");
  url.searchParams.set("corpid", corpId);
  url.searchParams.set("corpsecret", agentSecret);

  const response = await fetch(url.toString(), {
    method: "GET",
  });

  const data = (await response.json()) as WecomTokenResponse;

  if (data.errcode !== 0 || !data.access_token) {
    throw new Error(`获取企业微信 Token 失败: ${data.errmsg || `errcode=${data.errcode}`}`);
  }

  // 缓存 Token (提前 5 分钟过期)
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000 - 300000,
  });

  return data.access_token;
}

/**
 * 发送企业微信消息
 *
 * @param config - 渠道配置
 * @param toUser - 接收用户 ID (多个用 | 分隔，@all 表示全员)
 * @param text - 消息文本
 * @param options - 可选配置
 * @returns 发送结果
 */
export async function sendWecomMessage(
  config: WecomChannelConfig,
  toUser: string,
  text: string,
  options?: {
    msgType?: "text" | "markdown";
    toParty?: string;
    toTag?: string;
  },
): Promise<{ msgid?: string }> {
  const corpId = config.app?.corpId;
  const agentSecret = config.app?.agentSecret;
  const agentId = config.app?.agentId;

  if (!corpId || !agentSecret) {
    throw new Error("企业微信 CorpID 或 AgentSecret 未配置");
  }
  if (!agentId) {
    throw new Error("企业微信 AgentId 未配置");
  }

  const token = await getWecomAccessToken(corpId, agentSecret);
  const msgType = options?.msgType ?? "text";

  let message: WecomMessage;
  if (msgType === "markdown") {
    message = {
      msgtype: "markdown",
      agentid: agentId,
      touser: toUser,
      toparty: options?.toParty,
      totag: options?.toTag,
      markdown: { content: text },
      enable_duplicate_check: 0,
    };
  } else {
    message = {
      msgtype: "text",
      agentid: agentId,
      touser: toUser,
      toparty: options?.toParty,
      totag: options?.toTag,
      text: { content: text },
      enable_duplicate_check: 0,
    };
  }

  const url = new URL("https://qyapi.weixin.qq.com/cgi-bin/message/send");
  url.searchParams.set("access_token", token);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  const data = (await response.json()) as WecomSendMessageResponse;

  if (data.errcode !== 0) {
    // errcode=42001 表示 token 过期，清除缓存以便下次刷新
    if (data.errcode === 42001 && corpId && agentSecret) {
      clearWecomTokenCacheFor(corpId, agentSecret);
    }
    // 包含更多错误信息
    const details = [];
    if (data.invaliduser) details.push(`invaliduser=${data.invaliduser}`);
    if (data.invalidparty) details.push(`invalidparty=${data.invalidparty}`);
    if (data.invalidtag) details.push(`invalidtag=${data.invalidtag}`);
    if (data.unlicenseduser) details.push(`unlicenseduser=${data.unlicenseduser}`);
    const detailStr = details.length > 0 ? ` (${details.join(", ")})` : "";
    throw new Error(`发送企业微信消息失败: ${data.errmsg || `errcode=${data.errcode}`}${detailStr}`);
  }

  return { msgid: data.msgid };
}

/**
 * 发送企业微信群聊消息 (应用发送到群聊)
 *
 * 使用 /cgi-bin/appchat/send 接口发送到群聊
 * 文档: https://developer.work.weixin.qq.com/document/path/90248
 *
 * @param config - 渠道配置
 * @param chatId - 群聊 ID
 * @param text - 消息文本
 * @param options - 可选配置
 * @returns 发送结果
 */
export async function sendWecomGroupMessage(
  config: WecomChannelConfig,
  chatId: string,
  text: string,
  options?: { msgType?: "text" | "markdown" },
): Promise<{ errcode?: number; errmsg?: string }> {
  const corpId = config.app?.corpId;
  const agentSecret = config.app?.agentSecret;

  if (!corpId || !agentSecret) {
    throw new Error("企业微信 CorpID 或 AgentSecret 未配置");
  }

  const token = await getWecomAccessToken(corpId, agentSecret);
  const msgType = options?.msgType ?? "text";

  const message: Record<string, unknown> = {
    chatid: chatId,
    msgtype: msgType,
    safe: 0,
  };

  if (msgType === "markdown") {
    message.markdown = { content: text };
  } else {
    message.text = { content: text };
  }

  const url = new URL("https://qyapi.weixin.qq.com/cgi-bin/appchat/send");
  url.searchParams.set("access_token", token);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  const data = (await response.json()) as { errcode: number; errmsg?: string };

  if (data.errcode !== 0) {
    // errcode=42001 表示 token 过期，清除缓存
    if (data.errcode === 42001) {
      clearWecomTokenCacheFor(corpId, agentSecret);
    }
    throw new Error(`发送企业微信群聊消息失败: ${data.errmsg || `errcode=${data.errcode}`}`);
  }

  return data;
}

/**
 * 发送企业微信模板卡片消息
 *
 * @param config - 渠道配置
 * @param toUser - 接收用户 ID
 * @param card - 卡片配置
 * @returns 发送结果
 */
export async function sendWecomTemplateCard(
  config: WecomChannelConfig,
  toUser: string,
  card: {
    title: string;
    description: string;
    url?: string;
    btnText?: string;
  },
): Promise<{ msgid?: string }> {
  const corpId = config.app?.corpId;
  const agentSecret = config.app?.agentSecret;
  const agentId = config.app?.agentId;

  if (!corpId || !agentSecret || !agentId) {
    throw new Error("企业微信应用配置不完整");
  }

  const token = await getWecomAccessToken(corpId, agentSecret);

  const message = {
    msgtype: "textcard",
    agentid: agentId,
    touser: toUser,
    textcard: {
      title: card.title,
      description: card.description,
      url: card.url ?? "URL",
      btntxt: card.btnText ?? "详情",
    },
    enable_duplicate_check: 0,
  };

  const url = new URL("https://qyapi.weixin.qq.com/cgi-bin/message/send");
  url.searchParams.set("access_token", token);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  const data = (await response.json()) as WecomSendMessageResponse;

  if (data.errcode !== 0) {
    throw new Error(`发送企业微信卡片消息失败: ${data.errmsg || `errcode=${data.errcode}`}`);
  }

  return { msgid: data.msgid };
}

/**
 * 探测企业微信连接
 *
 * @param config - 渠道配置
 * @returns 探测结果
 */
export async function probeWecomConnection(
  config: WecomChannelConfig,
): Promise<{ ok: boolean; error?: string; corpId?: string; agentId?: number }> {
  const corpId = config.app?.corpId;
  const agentSecret = config.app?.agentSecret;
  const agentId = config.app?.agentId;

  if (!corpId || !agentSecret) {
    return { ok: false, error: "CorpID 或 AgentSecret 未配置" };
  }
  if (!agentId) {
    return { ok: false, error: "AgentId 未配置" };
  }

  try {
    await getWecomAccessToken(corpId, agentSecret);
    return { ok: true, corpId, agentId };
  } catch (err) {
    return { ok: false, error: String(err), corpId, agentId };
  }
}

/**
 * 清除 Token 缓存
 */
export function clearWecomTokenCache(): void {
  tokenCache.clear();
}

/**
 * 清除指定应用的 Token 缓存
 */
export function clearWecomTokenCacheFor(corpId: string, agentSecret: string): void {
  const cacheKey = `${corpId}:${agentSecret.slice(0, 8)}`;
  tokenCache.delete(cacheKey);
}
