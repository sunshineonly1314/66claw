/**
 * 飞书 API 调用实现
 * Feishu API Implementation
 *
 * 使用官方 @larksuiteoapi/node-sdk
 * 融合自 m1heng/clawdbot-feishu
 */

import type {
  FeishuChannelConfig,
  FeishuSendResult,
  FeishuProbeResult,
  MentionTarget,
} from "./types.js";
import { createFeishuClient, resolveFeishuCredentials, clearClientCache } from "./client.js";
import { resolveReceiveIdType, normalizeFeishuTarget } from "./targets.js";
import { buildMentionedMessage, buildMentionedCardContent } from "./mention.js";

// ============================================================================
// 发送消息
// ============================================================================

export interface SendFeishuMessageParams {
  config: FeishuChannelConfig;
  to: string;
  text: string;
  replyToMessageId?: string;
  mentions?: MentionTarget[];
}

/**
 * 发送飞书文本消息 (使用官方 SDK)
 */
export async function sendFeishuMessage(
  config: FeishuChannelConfig,
  to: string,
  text: string,
  options?: {
    msgType?: "text" | "post" | "image" | "interactive";
    replyToId?: string;
    mentions?: MentionTarget[];
  },
): Promise<FeishuSendResult> {
  const client = createFeishuClient(config);
  const receiveId = normalizeFeishuTarget(to);
  if (!receiveId) {
    throw new Error(`无效的飞书目标: ${to}`);
  }

  const receiveIdType = resolveReceiveIdType(receiveId);
  const msgType = options?.msgType ?? "text";

  // 构建消息内容 (支持 @ 提及)
  let messageText = text ?? "";
  if (options?.mentions && options.mentions.length > 0) {
    messageText = buildMentionedMessage(options.mentions, messageText);
  }

  // 构建消息内容
  let content: string;
  if (msgType === "text") {
    content = JSON.stringify({ text: messageText });
  } else if (msgType === "interactive") {
    // Markdown 卡片
    let cardText = text;
    if (options?.mentions && options.mentions.length > 0) {
      cardText = buildMentionedCardContent(options.mentions, text);
    }
    content = JSON.stringify({
      config: { wide_screen_mode: true },
      elements: [{ tag: "markdown", content: cardText }],
    });
  } else {
    content = JSON.stringify({ text: messageText });
  }

  // 如果是回复消息
  if (options?.replyToId) {
    const response = await client.im.message.reply({
      path: { message_id: options.replyToId },
      data: { content, msg_type: msgType },
    });

    if (response.code !== 0) {
      throw new Error(`飞书回复消息失败: ${response.msg || `code ${response.code}`}`);
    }

    return {
      messageId: response.data?.message_id ?? "unknown",
      chatId: receiveId,
    };
  }

  // 发送新消息
  const response = await client.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: receiveId,
      content,
      msg_type: msgType,
    },
  });

  if (response.code !== 0) {
    throw new Error(`飞书发送消息失败: ${response.msg || `code ${response.code}`}`);
  }

  return {
    messageId: response.data?.message_id ?? "unknown",
    chatId: receiveId,
  };
}

// ============================================================================
// 卡片消息
// ============================================================================

/**
 * 构建 Markdown 卡片
 */
export function buildMarkdownCard(text: string): Record<string, unknown> {
  return {
    config: { wide_screen_mode: true },
    elements: [{ tag: "markdown", content: text }],
  };
}

/**
 * 发送 Markdown 卡片消息
 */
export async function sendMarkdownCardFeishu(params: {
  config: FeishuChannelConfig;
  to: string;
  text: string;
  replyToMessageId?: string;
  mentions?: MentionTarget[];
}): Promise<FeishuSendResult> {
  const { config, to, text, replyToMessageId, mentions } = params;

  let cardText = text;
  if (mentions && mentions.length > 0) {
    cardText = buildMentionedCardContent(mentions, text);
  }

  return sendFeishuMessage(config, to, cardText, {
    msgType: "interactive",
    replyToId: replyToMessageId,
  });
}

// ============================================================================
// 获取消息
// ============================================================================

export interface FeishuMessageInfo {
  messageId: string;
  chatId: string;
  senderId?: string;
  senderOpenId?: string;
  content: string;
  contentType: string;
  createTime?: number;
}

/**
 * 获取消息详情
 */
export async function getMessageFeishu(params: {
  config: FeishuChannelConfig;
  messageId: string;
}): Promise<FeishuMessageInfo | null> {
  const { config, messageId } = params;
  const client = createFeishuClient(config);

  try {
    const response = (await client.im.message.get({
      path: { message_id: messageId },
    })) as {
      code?: number;
      msg?: string;
      data?: {
        items?: Array<{
          message_id?: string;
          chat_id?: string;
          msg_type?: string;
          body?: { content?: string };
          sender?: { id?: string; id_type?: string; sender_type?: string };
          create_time?: string;
        }>;
      };
    };

    if (response.code !== 0) return null;

    const item = response.data?.items?.[0];
    if (!item) return null;

    let content = item.body?.content ?? "";
    try {
      const parsed = JSON.parse(content);
      if (item.msg_type === "text" && parsed.text) {
        content = parsed.text;
      }
    } catch {
      // 保持原始内容
    }

    return {
      messageId: item.message_id ?? messageId,
      chatId: item.chat_id ?? "",
      senderId: item.sender?.id,
      senderOpenId: item.sender?.id_type === "open_id" ? item.sender?.id : undefined,
      content,
      contentType: item.msg_type ?? "text",
      createTime: item.create_time ? parseInt(item.create_time, 10) : undefined,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// 探测连接
// ============================================================================

/**
 * 探测飞书连接
 */
export async function probeFeishuConnection(
  config: FeishuChannelConfig,
): Promise<FeishuProbeResult> {
  const creds = resolveFeishuCredentials(config);

  if (!creds) {
    return { ok: false, error: "App ID 或 App Secret 未配置" };
  }

  const startTime = Date.now();

  try {
    const client = createFeishuClient(config);

    // 获取机器人信息来验证连接
    // SDK 没有 .bot namespace，使用原始请求
    const domain = creds.domain === "lark"
      ? "https://open.larksuite.com"
      : "https://open.feishu.cn";
    const response = (await client.request({
      method: "GET",
      url: `${domain}/open-apis/bot/v3/info`,
      timeout: 10_000, // 10 秒超时，防止请求挂起
    })) as {
      code?: number;
      msg?: string;
      bot?: {
        app_name?: string;
        open_id?: string;
        activate_status?: number;
      };
    };

    const elapsedMs = Date.now() - startTime;

    if (response.code !== 0) {
      return {
        ok: false,
        error: response.msg || `code ${response.code}`,
        appId: creds.appId,
        elapsedMs,
      };
    }

    return {
      ok: true,
      appId: creds.appId,
      botName: response.bot?.app_name,
      botOpenId: response.bot?.open_id,
      elapsedMs,
    };
  } catch (err) {
    return {
      ok: false,
      error: String(err),
      appId: creds.appId,
      elapsedMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// 清除缓存
// ============================================================================

/**
 * 清除 Token 缓存
 */
export function clearFeishuTokenCache(): void {
  clearClientCache();
}

// ============================================================================
// 向后兼容导出 (旧版 API)
// ============================================================================

/**
 * @deprecated 使用 probeFeishuConnection 代替
 */
export const probeFeishu = probeFeishuConnection;
