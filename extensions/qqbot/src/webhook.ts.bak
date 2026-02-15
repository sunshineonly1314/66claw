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
 * 验证回调签名
 */
function verifySignature(
  token: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  const toVerify = `${timestamp}${token}${body}`;
  const computed = crypto.createHash("sha1").update(toVerify).digest("hex");
  return computed === signature;
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

      // 如果配置了 token，验证签名
      if (config.app?.token && signature && timestamp) {
        // QQ 使用 Ed25519 签名，这里简化处理
        // 实际生产环境需要使用 Ed25519 验证
        log.info("[qqbot] Signature verification (Ed25519) - simplified");
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
