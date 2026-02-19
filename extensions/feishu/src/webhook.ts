/**
 * 飞书 Webhook 处理
 * Feishu Webhook Handler
 *
 * 文档参考:
 * https://open.feishu.cn/document/event-subscription-guide/callback-subscription/callback-overview
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import type {
  FeishuChannelConfig,
  FeishuMessageReceiveEvent,
  FeishuUrlVerificationEvent,
  FeishuTextContent,
} from "./types.js";

export interface FeishuWebhookContext {
  config: FeishuChannelConfig;
  onMessage: (params: {
    messageId: string;
    chatId: string;
    chatType: "p2p" | "group";
    senderId: string;
    senderOpenId?: string;
    text: string;
    mentions?: Array<{ key: string; name: string; id: string }>;
    rawEvent: FeishuMessageReceiveEvent;
  }) => Promise<void>;
  log?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

/**
 * 解密飞书消息 (AES-256-CBC)
 * 飞书使用 SHA256(encrypt_key) 作为 AES key，前 16 字节作为 IV
 */
function decryptFeishuMessage(encrypt: string, encryptKey: string): string {
  const key = crypto.createHash("sha256").update(encryptKey).digest();
  const encryptedBuffer = Buffer.from(encrypt, "base64");
  // FIX R4-1: AES-256-CBC 需要 16 字节 IV + 至少 16 字节密文（1 个 AES 块）
  // 未验证长度时，短 buffer 导致 IV 不足或密文为空，造成 createDecipheriv 抛错
  if (encryptedBuffer.length < 32) {
    throw new Error(
      `[feishu] decryptFeishuMessage: encrypted payload too short (${encryptedBuffer.length} bytes, expected >= 32)`,
    );
  }
  const iv = encryptedBuffer.subarray(0, 16);
  const encrypted = encryptedBuffer.subarray(16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf-8");
}

/**
 * 发送 JSON 响应
 */
function sendJsonResponse(res: ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body, "utf-8"),
  });
  res.end(body);
}

/**
 * 读取请求体（带大小限制防止 DoS 攻击）
 * FIX BUG-R2-4
 */
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1 MB

async function readBody(req: IncomingMessage, maxSize: number = MAX_BODY_SIZE): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    req.on("data", (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        req.destroy();
        reject(new Error(`Request body exceeds maximum size limit (${maxSize} bytes)`));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

/**
 * 创建飞书 Webhook 处理器
 */
export function createFeishuWebhookHandler(ctx: FeishuWebhookContext) {
  const { config, onMessage, log } = ctx;

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      // 只处理 POST
      if (req.method !== "POST") {
        sendJsonResponse(res, 405, { error: "Method not allowed" });
        return;
      }

      log?.info(`[feishu] Webhook 收到 HTTP 请求 ${req.url ?? ""}`);
      const rawBody = await readBody(req);
      log?.info(`[feishu] 请求体摘要: ${rawBody.slice(0, 200)}`);

      let body: unknown;

      try {
        body = JSON.parse(rawBody);
      } catch {
        log?.error(`[feishu] Webhook JSON 解析失败: ${rawBody.slice(0, 100)}`);
        sendJsonResponse(res, 400, { error: "Invalid JSON" });
        return;
      }

      // 检查是否需要解密 (如果配置了 Encrypt Key)
      if (typeof body === "object" && body !== null && "encrypt" in body) {
        // 支持新版扁平配置和旧版嵌套配置
        const encryptKey = config.encryptKey ?? config.app?.encryptKey;
        if (!encryptKey) {
          log?.error("[feishu] 收到加密消息但未配置 encryptKey");
          sendJsonResponse(res, 400, { error: "Encryption key not configured" });
          return;
        }
        try {
          const decrypted = decryptFeishuMessage((body as { encrypt: string }).encrypt, encryptKey);
          log?.info(`[feishu] 消息解密成功: ${decrypted.slice(0, 200)}`);
          body = JSON.parse(decrypted);
        } catch (decryptErr) {
          log?.error(`[feishu] 消息解密失败: ${decryptErr}`);
          sendJsonResponse(res, 400, { error: "Decryption failed" });
          return;
        }
      }

      // 处理 URL 验证 (首次配置 Webhook 时飞书会发送此请求)
      if (typeof body === "object" && body !== null && "type" in body) {
        const verifyEvent = body as FeishuUrlVerificationEvent;
        if (verifyEvent.type === "url_verification") {
          log?.info(`[feishu] URL 验证请求: challenge=${verifyEvent.challenge}`);

          // 验证 token (如果配置了 verificationToken)
          // 支持新版扁平配置和旧版嵌套配置
          const verificationToken = config.verificationToken ?? config.app?.verificationToken;
          if (verificationToken && verifyEvent.token !== verificationToken) {
            log?.warn(`[feishu] 验证 Token 不匹配: 期望=${verificationToken}, 收到=${verifyEvent.token}`);
            sendJsonResponse(res, 401, { error: "Invalid verification token" });
            return;
          }

          // 返回 challenge (必须严格按照飞书要求的格式)
          log?.info(`[feishu] URL 验证成功，返回 challenge`);
          sendJsonResponse(res, 200, { challenge: verifyEvent.challenge });
          return;
        }
      }

      // 处理事件回调 (schema 2.0 格式)
      if (typeof body === "object" && body !== null && "header" in body) {
        const event = body as FeishuMessageReceiveEvent;

        // 验证 Token (支持新版扁平配置和旧版嵌套配置)
        const eventVerificationToken = config.verificationToken ?? config.app?.verificationToken;
        if (eventVerificationToken && event.header?.token !== eventVerificationToken) {
          log?.warn("[feishu] 事件 Token 不匹配");
          sendJsonResponse(res, 401, { error: "Invalid event token" });
          return;
        }

        // 快速响应 (避免飞书超时重试，飞书要求 3 秒内响应)
        sendJsonResponse(res, 200, {});

        // 异步处理消息事件
        if (event.header?.event_type === "im.message.receive_v1") {
          log?.info(`[feishu] 开始处理接收消息事件 im.message.receive_v1`);
          handleMessageEvent(event, ctx).catch((err) => {
            log?.error(`[feishu] 处理消息事件失败: ${err}`);
          });
        } else {
          log?.info(`[feishu] 收到未处理的事件类型: ${event.header?.event_type}`);
        }
        return;
      }

      // 兼容旧版 schema 1.0 格式 (部分旧应用可能使用)
      if (typeof body === "object" && body !== null && "event" in body && !("header" in body)) {
        log?.info("[feishu] 收到旧版 schema 1.0 格式事件，建议升级到 schema 2.0");
        sendJsonResponse(res, 200, {});
        return;
      }

      // 未知请求格式
      log?.warn(`[feishu] Webhook 收到未知格式: ${JSON.stringify(body).slice(0, 200)}`);
      sendJsonResponse(res, 200, {});
    } catch (err) {
      log?.error(`[feishu] Webhook 错误: ${err}`);
      if (!res.writableEnded) {
        sendJsonResponse(res, 500, { error: "Internal server error" });
      }
    }
  };
}

/**
 * 处理消息事件
 */
async function handleMessageEvent(
  event: FeishuMessageReceiveEvent,
  ctx: FeishuWebhookContext,
): Promise<void> {
  const { onMessage, log } = ctx;
  const message = event.event?.message;
  const sender = event.event?.sender;

  if (!message || !sender) {
    log?.warn("[feishu] 消息事件缺少 message 或 sender");
    return;
  }

  // 解析消息内容
  let text = "";
  if (message.message_type === "text") {
    try {
      const content = JSON.parse(message.content) as FeishuTextContent;
      text = content.text ?? "";
    } catch {
      text = message.content;
    }
  } else {
    // 非文本消息，暂时跳过
    log?.info(`[feishu] 收到非文本消息: ${message.message_type}`);
    return;
  }

  // 提取 mentions
  const mentions = message.mentions?.map((m) => ({
    key: m.key,
    name: m.name,
    id: m.id.open_id ?? m.id.user_id ?? m.id.union_id ?? "",
  }));

  // 移除 @机器人 的占位符
  // FIX R4-2: 使用 replaceAll 替换所有匹配，之前 replace() 只替换首个，
  // 导致同一 mention key 多次出现时（如多次 @机器人）后续实例保留在文本中
  if (mentions) {
    for (const m of mentions) {
      text = text.replaceAll(m.key, "").trim();
    }
  }

  const senderId = sender.sender_id.open_id ?? sender.sender_id.user_id ?? sender.sender_id.union_id ?? "unknown";

  log?.info(
    `[feishu] 解析到消息: chatType=${message.chat_type}, chatId=${message.chat_id}, from=${senderId}, text=${text.slice(0, 50)}`,
  );

  await onMessage({
    messageId: message.message_id,
    chatId: message.chat_id,
    chatType: message.chat_type,
    senderId,
    senderOpenId: sender.sender_id.open_id,
    text,
    mentions,
    rawEvent: event,
  });
}
