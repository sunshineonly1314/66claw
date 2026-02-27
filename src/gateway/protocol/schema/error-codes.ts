import type { ErrorShape } from "./types.js";
import { translateError, sanitizeErrorMessage, classifyErrorCode } from "../../error-translate.js";

export const ErrorCodes = {
  NOT_LINKED: "NOT_LINKED",
  NOT_PAIRED: "NOT_PAIRED",
  AGENT_TIMEOUT: "AGENT_TIMEOUT",
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UNAVAILABLE: "UNAVAILABLE",
  // CN: 细粒度错误码
  AUTH_FAILED: "AUTH_FAILED",
  BILLING_EXCEEDED: "BILLING_EXCEEDED",
  RATE_LIMITED: "RATE_LIMITED",
  PROVIDER_OVERLOADED: "PROVIDER_OVERLOADED",
  NETWORK_ERROR: "NETWORK_ERROR",
  CONFIG_ERROR: "CONFIG_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export function errorShape(
  code: ErrorCode,
  message: string,
  opts?: { details?: unknown; retryable?: boolean; retryAfterMs?: number },
): ErrorShape {
  return {
    code,
    message,
    ...opts,
  };
}

/**
 * CN: 根据原始错误自动生成带中文翻译的 ErrorShape。
 * 自动注入 userMessage（中文友好提示）、category（错误分类）、retryable。
 * message 会被净化，过滤掉文件路径和堆栈跟踪。
 */
export function errorShapeFromError(
  fallbackCode: ErrorCode,
  err: unknown,
  opts?: { details?: unknown; retryAfterMs?: number },
): ErrorShape {
  const translated = translateError(err);
  const code = classifyErrorCode(err) ?? fallbackCode;
  const rawMessage =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err);
  return {
    code,
    message: sanitizeErrorMessage(rawMessage),
    userMessage: translated.userMessage,
    category: translated.category,
    retryable: translated.retryable,
    ...opts,
  };
}
