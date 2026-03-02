/**
 * CN: 网关侧错误分类与中文翻译
 *
 * 将各类原始错误（FailoverError、HTTP status、errno code、raw message）
 * 统一分类为 9 个 category 并生成用户友好的中文提示。
 *
 * 分类优先级：FailoverError.reason → HTTP status code → errno code → regex pattern
 */

import type { ErrorCode } from "./protocol/schema/error-codes.js";

// ─── 错误分类 ────────────────────────────────────────────

export type ErrorCategory =
  | "billing"
  | "auth"
  | "rate_limit"
  | "timeout"
  | "overloaded"
  | "network"
  | "config"
  | "internal"
  | "unknown";

type TranslatedError = {
  category: ErrorCategory;
  userMessage: string;
  retryable: boolean;
};

// ─── 中文提示映射 ────────────────────────────────────────

const USER_MESSAGES: Record<ErrorCategory, string> = {
  billing: "[E1003] 账户余额不足，请前往服务商充值后重试",
  auth: "[E1004] API Key 无效或已过期，请在「模型配置」中检查密钥",
  rate_limit: "[E1001] 请求频率超限，请稍后重试",
  timeout: "[E1005] 请求超时，请检查网络连接或稍后重试",
  overloaded: "[E1002] 模型服务繁忙，请稍后再试或切换其他模型",
  network: "[E1006] 网络连接失败，请检查网络设置和代理配置",
  config: "[E1007] 配置有误，请检查相关设置项",
  internal: "[E1008] 内部错误，请重试。如反复出现请查看日志或反馈",
  unknown: "[E1009] 操作失败，请稍后重试",
};

const RETRYABLE: Record<ErrorCategory, boolean> = {
  billing: false,
  auth: false,
  rate_limit: true,
  timeout: true,
  overloaded: true,
  network: true,
  config: false,
  internal: true,
  unknown: true,
};

// ─── 分类逻辑 ────────────────────────────────────────────

// FailoverReason → ErrorCategory 映射
const FAILOVER_REASON_MAP: Record<string, ErrorCategory> = {
  auth: "auth",
  billing: "billing",
  rate_limit: "rate_limit",
  timeout: "timeout",
  format: "config",
  connection: "network",
  unknown: "unknown",
};

// HTTP status code → ErrorCategory
function categoryFromStatus(status: number | undefined): ErrorCategory | null {
  if (status === undefined) return null;
  if (status === 401 || status === 403) return "auth";
  if (status === 402) return "billing";
  if (status === 429) return "rate_limit";
  if (status === 408) return "timeout";
  if (status === 503) return "overloaded";
  if (status === 502 || status === 504) return "network";
  if (status >= 500) return "internal";
  return null;
}

// errno code → ErrorCategory
const NETWORK_ERRNO_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ESOCKETTIMEDOUT",
  "ECONNABORTED",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_DNS_RESOLVE_FAILED",
  "UND_ERR_CONNECT",
  "UND_ERR_SOCKET",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

const TIMEOUT_ERRNO_CODES = new Set([
  "ETIMEDOUT",
  "ESOCKETTIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

// Regex patterns for message classification (lowercase matching)
type PatternEntry = { category: ErrorCategory; patterns: (RegExp | string)[] };

const MESSAGE_PATTERNS: PatternEntry[] = [
  {
    category: "billing",
    patterns: [
      /\b402\b/,
      "payment required",
      "insufficient credits",
      "insufficient credit",
      "credit balance",
      "quota exceeded",
      "exceeded your current quota",
      "余额不足",
      "额度不足",
      "账户欠费",
    ],
  },
  {
    category: "auth",
    patterns: [
      /invalid[_ ]?api[_ ]?key/i,
      "incorrect api key",
      "invalid token",
      "authentication",
      "re-authenticate",
      "oauth token refresh failed",
      "unauthorized",
      "forbidden",
      "access denied",
      "token has expired",
      /\b401\b/,
      /\b403\b/,
      "no credentials found",
      "no api key found",
      "api key 无效",
      "密钥错误",
      "认证失败",
    ],
  },
  {
    category: "rate_limit",
    patterns: [
      /rate[_ ]limit/i,
      "too many requests",
      /\b429\b/,
      "resource has been exhausted",
      "resource_exhausted",
      "usage limit",
      "请求过于频繁",
      "请求频率",
    ],
  },
  {
    category: "timeout",
    patterns: [
      "timeout",
      "timed out",
      "deadline exceeded",
      "context deadline exceeded",
      "etimedout",
      "econnreset",
      "超时",
      "no response",
      "暂未收到响应",
    ],
  },
  {
    category: "overloaded",
    patterns: [
      /overloaded_error/i,
      "overloaded",
      "server is busy",
      "service unavailable",
      /\b503\b/,
      "服务繁忙",
      "服务不可用",
    ],
  },
  {
    category: "network",
    patterns: [
      "network error",
      "fetch failed",
      "connection refused",
      "enotfound",
      "getaddrinfo",
      "网络错误",
      "连接失败",
      "连接断开",
      "disconnected",
      /\b1006\b/,
    ],
  },
  {
    category: "config",
    patterns: [
      "invalid_config",
      "invalid config",
      "配置错误",
      /missing.*config/i,
      "schema validation",
      "missing_api_key",
      "missing_credentials",
    ],
  },
  {
    category: "internal",
    patterns: [
      "internal_error",
      "internal error",
      "内部错误",
      "stack overflow",
      "heap out of memory",
    ],
  },
];

// ─── Helper extractors ───────────────────────────────────

function getStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const s = (err as { status?: unknown }).status ?? (err as { statusCode?: unknown }).statusCode;
  if (typeof s === "number") return s;
  if (typeof s === "string" && /^\d+$/.test(s)) return Number(s);
  return undefined;
}

function getCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const c = (err as { code?: unknown }).code;
  return typeof c === "string" ? c : undefined;
}

function getMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return String(err ?? "");
}

function getReason(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const r = (err as { reason?: unknown }).reason;
  return typeof r === "string" ? r : undefined;
}

function isFailoverErrorLike(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  return (err as { name?: string }).name === "FailoverError" && typeof getReason(err) === "string";
}

function classifyByMessage(message: string): ErrorCategory | null {
  if (!message) return null;
  const lower = message.toLowerCase();
  for (const entry of MESSAGE_PATTERNS) {
    const matched = entry.patterns.some((p) =>
      p instanceof RegExp ? p.test(lower) : lower.includes(p.toLowerCase()),
    );
    if (matched) return entry.category;
  }
  return null;
}

// ─── 核心导出 ────────────────────────────────────────────

/** 可选的错误上下文：服务商和模型信息，用于生成更清晰的提示。 */
export type ErrorContext = {
  provider?: string;
  model?: string;
};

/** 根据上下文给 userMessage 注入服务商/模型前缀。 */
function enrichUserMessage(base: string, context?: ErrorContext): string {
  if (!context?.provider) return base;
  const label = context.model ? `${context.provider}（${context.model}）` : context.provider;
  return `${label}: ${base}`;
}

/**
 * 对原始错误进行分类并翻译为中文友好提示。
 * @param context 可选的服务商/模型上下文，会注入到 userMessage 前缀中。
 */
export function translateError(err: unknown, context?: ErrorContext): TranslatedError {
  let category: ErrorCategory = "unknown";

  // 1. FailoverError.reason
  if (isFailoverErrorLike(err)) {
    const reason = getReason(err)!;
    category = FAILOVER_REASON_MAP[reason] ?? "unknown";
    // FailoverError 自带 provider/model，优先用 context 覆盖
    const foCtx: ErrorContext = {
      provider: context?.provider ?? (err as { provider?: string }).provider,
      model: context?.model ?? (err as { model?: string }).model,
    };
    return {
      category,
      userMessage: enrichUserMessage(USER_MESSAGES[category], foCtx),
      retryable: RETRYABLE[category],
    };
  }

  // 2. HTTP status code
  const status = getStatus(err);
  const byStatus = categoryFromStatus(status);
  if (byStatus) {
    return {
      category: byStatus,
      userMessage: enrichUserMessage(USER_MESSAGES[byStatus], context),
      retryable: RETRYABLE[byStatus],
    };
  }

  // 3. errno code
  const code = getCode(err);
  if (code) {
    if (TIMEOUT_ERRNO_CODES.has(code)) {
      return {
        category: "timeout",
        userMessage: enrichUserMessage(USER_MESSAGES.timeout, context),
        retryable: true,
      };
    }
    if (NETWORK_ERRNO_CODES.has(code)) {
      return {
        category: "network",
        userMessage: enrichUserMessage(USER_MESSAGES.network, context),
        retryable: true,
      };
    }
    if (code === "INVALID_CONFIG" || code === "MISSING_API_KEY" || code === "MISSING_CREDENTIALS") {
      return {
        category: "config",
        userMessage: enrichUserMessage(USER_MESSAGES.config, context),
        retryable: false,
      };
    }
  }

  // 4. Message regex
  const message = getMessage(err);
  const byMessage = classifyByMessage(message);
  if (byMessage) {
    return {
      category: byMessage,
      userMessage: enrichUserMessage(USER_MESSAGES[byMessage], context),
      retryable: RETRYABLE[byMessage],
    };
  }

  // 5. Check cause chain
  if (err && typeof err === "object" && "cause" in err) {
    const cause = (err as { cause?: unknown }).cause;
    if (cause && cause !== err) {
      const fromCause = translateError(cause, context);
      if (fromCause.category !== "unknown") return fromCause;
    }
  }

  return {
    category,
    userMessage: enrichUserMessage(USER_MESSAGES[category], context),
    retryable: RETRYABLE[category],
  };
}

/**
 * 根据错误自动选择合适的 ErrorCode（比一律 UNAVAILABLE 更精确）。
 * 返回 null 表示无法判断，由调用方使用 fallback code。
 */
export function classifyErrorCode(err: unknown): ErrorCode | null {
  const { category } = translateError(err);
  const CATEGORY_TO_CODE: Partial<Record<ErrorCategory, ErrorCode>> = {
    auth: "AUTH_FAILED",
    billing: "BILLING_EXCEEDED",
    rate_limit: "RATE_LIMITED",
    overloaded: "PROVIDER_OVERLOADED",
    network: "NETWORK_ERROR",
    config: "CONFIG_ERROR",
    internal: "INTERNAL_ERROR",
    timeout: "AGENT_TIMEOUT",
  };
  return CATEGORY_TO_CODE[category] ?? null;
}

// ─── 消息净化 ────────────────────────────────────────────

const SANITIZE_PATTERNS = [
  // 文件路径
  /(?:[A-Za-z]:)?(?:\/|\\)[\w./-]+(?:\.(?:ts|js|mjs|cjs|json))?(?::\d+(?::\d+)?)?/g,
  // Node.js 堆栈跟踪行
  /^\s*at\s+.+$/gm,
  // 常见冗余前缀
  /^Error:\s*/i,
  /^API Error:\s*/i,
  /^Gateway Error:\s*/i,
  /^Request failed:\s*/i,
  /^LLM request rejected:\s*/i,
];

const MAX_MESSAGE_LENGTH = 300;

/**
 * 净化错误消息：移除文件路径、堆栈跟踪、冗余前缀，截断过长内容。
 */
export function sanitizeErrorMessage(message: string): string {
  let cleaned = message;
  for (const pattern of SANITIZE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  // 合并多余空白
  cleaned = cleaned
    .replace(/\n{2,}/g, "\n")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (cleaned.length > MAX_MESSAGE_LENGTH) {
    cleaned = cleaned.slice(0, MAX_MESSAGE_LENGTH) + "...";
  }
  return cleaned || message.slice(0, MAX_MESSAGE_LENGTH);
}
