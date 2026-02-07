/**
 * 聊天错误分类和友好提示
 * 根据错误信息分类并返回用户友好的中文提示
 */

export type ErrorCategory = 
  | "billing"      // 余额不足
  | "auth"         // 认证失败
  | "rate_limit"   // 频率限制
  | "timeout"      // 超时
  | "overloaded"   // 服务过载
  | "network"      // 网络问题
  | "unknown";     // 未知错误

/** 错误解决建议 */
export type ErrorSuggestion = {
  icon: string;
  title: string;
  desc: string;
};

/** 格式化后的错误信息 */
export type FormattedError = {
  category: ErrorCategory;
  friendlyMessage: string;
  rawError: string;
  suggestions: ErrorSuggestion[];
  canRetry: boolean;
  showConfigLink: boolean;
};

type ErrorPattern = RegExp | string;

const ERROR_PATTERNS: Record<ErrorCategory, ErrorPattern[]> = {
  billing: [
    /\b402\b/,
    "payment required",
    "insufficient credits",
    "insufficient credit",
    "credit balance",
    "plans & billing",
    "quota exceeded",
    "exceeded your current quota",
    "余额不足",
    "额度不足",
    "账户欠费",
  ],
  auth: [
    /invalid[_ ]?api[_ ]?key/i,
    "incorrect api key",
    "invalid token",
    "authentication",
    "re-authenticate",
    "oauth token refresh failed",
    "unauthorized",
    "forbidden",
    "access denied",
    "expired",
    "token has expired",
    /\b401\b/,
    /\b403\b/,
    "no credentials found",
    "no api key found",
    "api key 无效",
    "密钥错误",
    "认证失败",
  ],
  rate_limit: [
    /rate[_ ]limit/i,
    "too many requests",
    /\b429\b/,
    "resource has been exhausted",
    "resource_exhausted",
    "usage limit",
    "请求过于频繁",
    "请求频率",
  ],
  timeout: [
    "timeout",
    "timed out",
    "deadline exceeded",
    "context deadline exceeded",
    "ETIMEDOUT",
    "ECONNRESET",
    "ECONNREFUSED",
    "超时",
    "no response",
    "暂未收到响应",
  ],
  overloaded: [
    /overloaded_error/i,
    "overloaded",
    "server is busy",
    "service unavailable",
    /\b503\b/,
    "服务繁忙",
    "服务不可用",
  ],
  network: [
    "network error",
    "fetch failed",
    "connection refused",
    "ENOTFOUND",
    "getaddrinfo",
    "网络错误",
    "连接失败",
    "连接断开",
    "disconnected",
    /\b1006\b/, // WebSocket abnormal closure
  ],
  unknown: [],
};

const FRIENDLY_MESSAGES: Record<ErrorCategory, string> = {
  billing: "账户余额不足，请充值后重试",
  auth: "API Key 无效或已过期，请检查模型配置",
  rate_limit: "请求频率超限，请稍后重试",
  timeout: "请求超时，请检查以下可能原因",
  overloaded: "模型服务繁忙，请稍后重试",
  network: "网络连接失败，请检查网络设置",
  unknown: "请求失败，请稍后重试",
};

/** 每种错误类型的解决建议 */
const ERROR_SUGGESTIONS: Record<ErrorCategory, ErrorSuggestion[]> = {
  timeout: [
    { icon: "💳", title: "检查账户余额", desc: "确认模型服务商账户有足够余额或免费额度" },
    { icon: "🔑", title: "验证 API Key", desc: "检查密钥是否正确配置，是否已过期" },
    { icon: "✅", title: "完成实名认证", desc: "部分国内服务商（如阿里、百度）要求完成实名认证" },
    { icon: "🌐", title: "检查网络连接", desc: "确认网络正常，如有代理请检查代理设置" },
  ],
  billing: [
    { icon: "💳", title: "充值账户", desc: "前往模型服务商官网充值或购买套餐" },
    { icon: "🎁", title: "使用免费模型", desc: "可在「免费模型」页面配置每日免费额度" },
    { icon: "🔄", title: "切换服务商", desc: "可切换到其他有余额的模型服务商" },
  ],
  auth: [
    { icon: "🔑", title: "检查 API Key", desc: "确认密钥复制完整，没有多余空格" },
    { icon: "🔄", title: "重新获取密钥", desc: "前往服务商控制台重新生成 API Key" },
    { icon: "✅", title: "检查权限", desc: "确认 API Key 具有所需的接口调用权限" },
  ],
  rate_limit: [
    { icon: "⏳", title: "稍后重试", desc: "等待 1-2 分钟后再发送消息" },
    { icon: "📉", title: "降低频率", desc: "避免短时间内发送过多消息" },
    { icon: "⬆️", title: "升级套餐", desc: "升级服务商套餐以获得更高调用限额" },
  ],
  overloaded: [
    { icon: "⏳", title: "稍后重试", desc: "服务商服务器繁忙，请稍后再试" },
    { icon: "🔄", title: "切换模型", desc: "可尝试切换到其他可用模型" },
    { icon: "🌐", title: "检查服务状态", desc: "访问服务商官网查看服务状态" },
  ],
  network: [
    { icon: "🌐", title: "检查网络", desc: "确认设备网络连接正常" },
    { icon: "🔧", title: "检查代理", desc: "如使用代理，请确认代理配置正确" },
    { icon: "🔄", title: "重启网关", desc: "尝试重启 Clawdbot 网关服务" },
  ],
  unknown: [
    { icon: "🔄", title: "重试", desc: "点击重试按钮再次发送" },
    { icon: "📋", title: "查看日志", desc: "前往「调试」页面查看详细错误信息" },
    { icon: "💬", title: "反馈问题", desc: "如持续出现，请通过意见反馈告知我们" },
  ],
};

/** 是否可以重试 */
const CAN_RETRY: Record<ErrorCategory, boolean> = {
  timeout: true,
  billing: false,
  auth: false,
  rate_limit: true,
  overloaded: true,
  network: true,
  unknown: true,
};

/** 是否显示配置链接 */
const SHOW_CONFIG_LINK: Record<ErrorCategory, boolean> = {
  timeout: true,
  billing: true,
  auth: true,
  rate_limit: false,
  overloaded: false,
  network: false,
  unknown: false,
};

function matchesPatterns(raw: string, patterns: ErrorPattern[]): boolean {
  if (!raw) return false;
  const value = raw.toLowerCase();
  return patterns.some((pattern) =>
    pattern instanceof RegExp ? pattern.test(value) : value.includes(pattern.toLowerCase()),
  );
}

/**
 * 分类错误信息
 */
export function classifyError(errorMessage: string | null | undefined): ErrorCategory {
  if (!errorMessage) return "unknown";
  
  const categories: ErrorCategory[] = [
    "billing",
    "auth", 
    "rate_limit",
    "timeout",
    "overloaded",
    "network",
  ];
  
  for (const category of categories) {
    if (matchesPatterns(errorMessage, ERROR_PATTERNS[category])) {
      return category;
    }
  }
  
  return "unknown";
}

/**
 * 获取友好的错误提示
 */
export function getFriendlyErrorMessage(category: ErrorCategory): string {
  return FRIENDLY_MESSAGES[category];
}

/**
 * 清理原始错误信息，使其更易读
 * 移除冗余前缀，截断过长内容
 */
export function cleanRawError(errorMessage: string | null | undefined): string {
  if (!errorMessage) return "";
  
  let cleaned = errorMessage.trim();
  
  // 移除常见的冗余前缀
  const prefixPatterns = [
    /^Error:\s*/i,
    /^API Error:\s*/i,
    /^OpenAI Error:\s*/i,
    /^Anthropic Error:\s*/i,
    /^Gateway Error:\s*/i,
    /^Request failed:\s*/i,
    /^LLM request rejected:\s*/i,
  ];
  
  for (const pattern of prefixPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }
  
  // 截断过长的错误信息（保留前 200 字符）
  const maxLength = 200;
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength) + "...";
  }
  
  return cleaned;
}

/**
 * 格式化错误提示，包含友好提示和原始错误
 * @deprecated 使用 formatErrorHintFull 获取完整信息
 */
export function formatErrorHint(errorMessage: string | null | undefined): {
  category: ErrorCategory;
  friendlyMessage: string;
  rawError: string;
} {
  const category = classifyError(errorMessage);
  return {
    category,
    friendlyMessage: getFriendlyErrorMessage(category),
    rawError: cleanRawError(errorMessage),
  };
}

/**
 * 格式化错误提示（完整版）
 * 包含友好提示、原始错误、解决建议等
 */
export function formatErrorHintFull(errorMessage: string | null | undefined): FormattedError {
  const category = classifyError(errorMessage);
  return {
    category,
    friendlyMessage: getFriendlyErrorMessage(category),
    rawError: cleanRawError(errorMessage),
    suggestions: ERROR_SUGGESTIONS[category] || ERROR_SUGGESTIONS.unknown,
    canRetry: CAN_RETRY[category] ?? true,
    showConfigLink: SHOW_CONFIG_LINK[category] ?? false,
  };
}

/**
 * 获取错误解决建议
 */
export function getErrorSuggestions(category: ErrorCategory): ErrorSuggestion[] {
  return ERROR_SUGGESTIONS[category] || ERROR_SUGGESTIONS.unknown;
}
