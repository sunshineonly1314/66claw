/**
 * 钉钉 Webhook 处理
 * DingTalk Webhook Handler
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import type { DingtalkChannelConfig, DingtalkRobotMessageEvent } from "./types.js";

export interface DingtalkWebhookContext {
  config: DingtalkChannelConfig;
  onMessage: (params: {
    msgId: string;
    conversationId: string;
    conversationType: "1" | "2"; // 1=单聊, 2=群聊
    conversationTitle?: string;
    senderId: string;
    senderNick: string;
    senderStaffId?: string;
    text: string;
    isAtMe?: boolean;
    sessionWebhook?: string;
    sessionWebhookExpiredTime?: number;
    rawEvent: DingtalkRobotMessageEvent;
  }) => Promise<void>;
  log?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

/**
 * 验证钉钉签名
 */
function verifyDingtalkSignature(
  timestamp: string,
  sign: string,
  secret: string,
): boolean {
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(stringToSign);
  const expectedSign = hmac.digest("base64");
  // FIX R3-2: 使用 timingSafeEqual 防止时序攻击（之前用 === 可被逐字节推断签名）
  try {
    const signBuf = Buffer.from(sign, "utf-8");
    const expectedBuf = Buffer.from(expectedSign, "utf-8");
    if (signBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(signBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * 读取请求体（带大小限制和总超时防止 DoS 攻击）
 * FIX BUG-R2-4
 */
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1 MB
const READ_BODY_TIMEOUT_MS = 30_000; // 30 秒总超时

async function readBody(req: IncomingMessage, maxSize: number = MAX_BODY_SIZE): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      req.destroy();
      reject(new Error(`Request body read timeout after ${READ_BODY_TIMEOUT_MS}ms`));
    }, READ_BODY_TIMEOUT_MS);

    req.on("data", (chunk: Buffer) => {
      if (settled) return;
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        settled = true;
        clearTimeout(timer);
        req.destroy();
        reject(new Error(`Request body exceeds maximum size limit (${maxSize} bytes)`));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });
    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * 创建钉钉 Webhook 处理器
 */
export function createDingtalkWebhookHandler(ctx: DingtalkWebhookContext) {
  const { config, onMessage, log } = ctx;

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      // 只处理 POST
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }

      // 验证签名 (如果配置了 signSecret)
      const signSecret = config.app?.signSecret;
      if (signSecret) {
        const timestamp = req.headers["timestamp"] as string | undefined;
        const sign = req.headers["sign"] as string | undefined;

        if (!timestamp || !sign) {
          log?.warn("钉钉请求缺少签名头");
          res.statusCode = 401;
          res.end(JSON.stringify({ error: "Missing signature headers" }));
          return;
        }

        // 检查时间戳 (防重放，1小时内有效)
        const timestampMs = parseInt(timestamp, 10);
        if (Math.abs(Date.now() - timestampMs) > 3600000) {
          log?.warn("钉钉请求时间戳过期");
          res.statusCode = 401;
          res.end(JSON.stringify({ error: "Timestamp expired" }));
          return;
        }

        if (!verifyDingtalkSignature(timestamp, sign, signSecret)) {
          log?.warn("钉钉签名验证失败");
          res.statusCode = 401;
          res.end(JSON.stringify({ error: "Invalid signature" }));
          return;
        }
      }

      const rawBody = await readBody(req);
      let body: DingtalkRobotMessageEvent;

      try {
        body = JSON.parse(rawBody);
      } catch {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }

      // 快速响应
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true }));

      // 处理消息
      await handleRobotMessage(body, ctx);
    } catch (err) {
      log?.error(`钉钉 Webhook 错误: ${err}`);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    }
  };
}

/**
 * 处理机器人消息
 */
async function handleRobotMessage(
  event: DingtalkRobotMessageEvent,
  ctx: DingtalkWebhookContext,
): Promise<void> {
  const { onMessage, log } = ctx;

  // 提取文本内容
  let text = "";
  if (event.msgtype === "text" && event.text?.content) {
    text = event.text.content.trim();
  } else if (event.msgtype === "richText" && event.richText?.richTextList) {
    // 合并富文本中的文字
    text = event.richText.richTextList
      .filter((item) => item.type === "text" && item.text)
      .map((item) => item.text)
      .join("");
  } else {
    log?.info(`钉钉收到非文本消息: ${event.msgtype}`);
    return;
  }

  if (!text) {
    log?.info("钉钉消息内容为空，跳过");
    return;
  }

  log?.info(
    `钉钉消息: type=${event.conversationType === "1" ? "单聊" : "群聊"}, ` +
      `from=${event.senderNick}, text=${text.slice(0, 50)}`,
  );

  await onMessage({
    msgId: event.msgId,
    conversationId: event.conversationId,
    conversationType: event.conversationType,
    conversationTitle: event.conversationTitle,
    senderId: event.senderId,
    senderNick: event.senderNick,
    senderStaffId: event.senderStaffId,
    text,
    isAtMe: event.isAtMe,
    sessionWebhook: event.sessionWebhook,
    sessionWebhookExpiredTime: event.sessionWebhookExpiredTime,
    rawEvent: event,
  });
}
