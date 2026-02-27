import type { IncomingMessage, ServerResponse } from "node:http";
import type { GatewayAuthResult } from "./auth.js";
import { readJsonBody } from "./hooks.js";

export function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function sendText(res: ServerResponse, status: number, body: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(body);
}

export function sendMethodNotAllowed(res: ServerResponse, allow = "POST") {
  res.setHeader("Allow", allow);
  sendText(res, 405, "Method Not Allowed");
}

export function sendUnauthorized(res: ServerResponse) {
  sendJson(res, 401, {
    error: {
      message: "Unauthorized",
      userMessage: "认证失败，请检查访问凭证",
      type: "unauthorized",
    },
  });
}

export function sendRateLimited(res: ServerResponse, retryAfterMs?: number) {
  if (retryAfterMs && retryAfterMs > 0) {
    res.setHeader("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
  }
  sendJson(res, 429, {
    error: {
      message: "Too many failed authentication attempts. Please try again later.",
      userMessage: "请求过于频繁，请稍后再试",
      type: "rate_limited",
    },
  });
}

export function sendGatewayAuthFailure(res: ServerResponse, authResult: GatewayAuthResult) {
  if (authResult.rateLimited) {
    sendRateLimited(res, authResult.retryAfterMs);
    return;
  }
  sendUnauthorized(res);
}

export function sendInvalidRequest(res: ServerResponse, message: string) {
  sendJson(res, 400, {
    error: {
      message,
      userMessage: "请求参数有误，请检查后重试",
      type: "invalid_request_error",
    },
  });
}

export async function readJsonBodyOrError(
  req: IncomingMessage,
  res: ServerResponse,
  maxBytes: number,
): Promise<unknown> {
  const body = await readJsonBody(req, maxBytes);
  if (!body.ok) {
    if (body.error === "payload too large") {
      sendJson(res, 413, {
        error: {
          message: "Payload too large",
          userMessage: "请求内容过大，请减少内容后重试",
          type: "invalid_request_error",
        },
      });
      return undefined;
    }
    if (body.error === "request body timeout") {
      sendJson(res, 408, {
        error: {
          message: "Request body timeout",
          userMessage: "请求超时，请检查网络连接后重试",
          type: "invalid_request_error",
        },
      });
      return undefined;
    }
    sendInvalidRequest(res, body.error);
    return undefined;
  }
  return body.value;
}

export function writeDone(res: ServerResponse) {
  res.write("data: [DONE]\n\n");
}

export function setSseHeaders(res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
}
