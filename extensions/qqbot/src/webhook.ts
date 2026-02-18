/**
 * QQ 机器人 Webhook 处理器
 * QQ Bot Webhook Handler
 *
 * 处理 QQ 开放平台的回调事件
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";

import type {
  QqbotChannelConfig,
  QqbotCallbackEvent,
  QqbotMessageEvent,
} from "./types.js";
import { QqbotOpCode, QqbotEventType } from "./types.js";

// ============================================================================
// 类型定义 (Type Definitions)
// ============================================================================

export interface QqbotWebhookHandlerParams {
  config: QqbotChannelConfig;
  onMessage: (event: QqbotMessageEvent, messageType: "direct" | "group" | "channel") => Promise<void>;
  logger?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

// ============================================================================
// 辅助函数 (Helper Functions)
// ============================================================================

/**
 * 验证 Ed25519 签名 (QQ 机器人使用)
 *
 * QQ 开放平台使用 Ed25519 算法对 Webhook 请求进行签名
 * 签名验证流程:
 * 1. 将 timestamp + body 拼接作为消息
 * 2. 使用公钥验证签名
 *
 * @param publicKey - Ed25519 公钥 (hex 格式)
 * @param signature - 请求签名 (hex 格式)
 * @param timestamp - 请求时间戳
 * @param body - 请求体原始字符串
 * @returns 签名是否有效
 */
function verifyEd25519Signature(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string,
): boolean {
  try {
    // 构造待验证消息: timestamp + body
    const message = timestamp + body;

    // 使用 Node.js crypto 验证 Ed25519 签名
    const isValid = crypto.verify(
      null, // Ed25519 不需要 hash 算法
      Buffer.from(message, 'utf8'),
      {
        key: Buffer.from(publicKey, 'hex'),
        format: 'der',
        type: 'spki',
      },
      Buffer.from(signature, 'hex'),
    );

    return isValid;
  } catch (error) {
    console.error('[qqbot] Ed25519 signature verification error:', error);
    return false;
  }
}

/**
 * 验证请求时间戳是否在有效期内
 * 防止重放攻击
 *
 * @param timestamp - 请求时间戳 (秒)
 * @param maxAgeSeconds - 最大允许时间差 (默认 5 分钟)
 * @returns 时间戳是否有效
 */
function verifyTimestamp(timestamp: string, maxAgeSeconds: number = 300): boolean {
  try {
    const requestTime = Number.parseInt(timestamp, 10);
    if (Number.isNaN(requestTime)) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const age = Math.abs(now - requestTime);

    return age <= maxAgeSeconds;
  } catch {
    return false;
  }
}

/**
 * 解析请求体
 */
async function parseRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

// ============================================================================
// Webhook 处理器 (Webhook Handler)
// ============================================================================

/**
 * 创建 QQ 机器人 Webhook 处理器
 */
export function createQqbotWebhookHandler(params: QqbotWebhookHandlerParams) {
  const { config, onMessage, logger } = params;
  const log = logger ?? console;

  return async function handleWebhook(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    try {
      // 只处理 POST 请求
      if (req.method !== "POST") {
        res.writeHead(405);
        res.end("Method Not Allowed");
        return;
      }

      // 解析请求体
      const rawBody = await parseRequestBody(req);

      // 获取签名相关头部
      const signature = req.headers["x-signature-ed25519"] as string | undefined;
      const timestamp = req.headers["x-signature-timestamp"] as string | undefined;

      // ===== 签名验证 (Security Critical) =====
      const publicKey = config.app?.publicKey;

      // 如果配置了公钥，强制验证签名
      if (publicKey) {
        if (!signature || !timestamp) {
          log.warn("[qqbot] 拒绝请求: 缺少签名头部 (X-Signature-Ed25519 或 X-Signature-Timestamp)");
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing signature headers" }));
          return;
        }

        // 验证时间戳 (防止重放攻击)
        if (!verifyTimestamp(timestamp)) {
          log.warn(`[qqbot] 拒绝请求: 时间戳无效或过期 (timestamp=${timestamp})`);
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid or expired timestamp" }));
          return;
        }

        // 验证 Ed25519 签名
        const isValid = verifyEd25519Signature(publicKey, signature, timestamp, rawBody);
        if (!isValid) {
          log.warn("[qqbot] 拒绝请求: Ed25519 签名验证失败");
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid signature" }));
          return;
        }

        log.info("[qqbot] ✅ Ed25519 签名验证通过");
      } else {
        // 未配置公钥时，记录警告（向后兼容）
        log.warn("[qqbot] ⚠️ 警告: 未配置 publicKey，签名验证已跳过！建议配置以提高安全性");
      }

      // 解析事件
      let event: QqbotCallbackEvent;
      try {
        event = JSON.parse(rawBody) as QqbotCallbackEvent;
      } catch {
        res.writeHead(400);
        res.end("Invalid JSON");
        return;
      }

      // 处理不同操作码
      switch (event.op) {
        case QqbotOpCode.DISPATCH: {
          // 消息分发
          await handleDispatch(event, onMessage, log);
          break;
        }

        case QqbotOpCode.HTTP_CALLBACK_ACK: {
          // HTTP 回调确认 - URL 验证
          const payload = event.d as { plain_token?: string; event_ts?: string };
          if (payload.plain_token) {
            // 返回验证响应
            const responseBody = JSON.stringify({
              plain_token: payload.plain_token,
              signature: "", // 需要使用 Ed25519 签名
            });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(responseBody);
            return;
          }
          break;
        }

        default:
          log.info(`[qqbot] Unhandled op code: ${event.op}`);
      }

      // 返回成功响应
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: 0 }));
    } catch (error) {
      log.error(`[qqbot] Webhook error: ${error}`);
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  };
}

/**
 * 处理消息分发事件
 */
async function handleDispatch(
  event: QqbotCallbackEvent,
  onMessage: (event: QqbotMessageEvent, messageType: "direct" | "group" | "channel") => Promise<void>,
  log: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void },
): Promise<void> {
  const eventType = event.t;
  const data = event.d as QqbotMessageEvent;

  if (!eventType || !data) {
    return;
  }

  log.info(`[qqbot] Received event: ${eventType}`);

  switch (eventType) {
    case QqbotEventType.C2C_MESSAGE_CREATE:
    case QqbotEventType.DIRECT_MESSAGE_CREATE: {
      // 私聊消息
      await onMessage(data, "direct");
      break;
    }

    case QqbotEventType.GROUP_AT_MESSAGE_CREATE: {
      // 群聊 @消息
      await onMessage(data, "group");
      break;
    }

    case QqbotEventType.MESSAGE_CREATE: {
      // 频道消息
      await onMessage(data, "channel");
      break;
    }

    default:
      log.info(`[qqbot] Unhandled event type: ${eventType}`);
  }
}
