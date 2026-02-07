import { stripThinkingTags } from "../format";

const ENVELOPE_PREFIX = /^\[([^\]]+)\]\s*/;

// Directive tags that should be stripped from displayed messages
// These are internal markers used for reply threading, audio handling, etc.
const DIRECTIVE_TAGS_RE = /\[\[\s*(?:reply_to_current|reply_to\s*:\s*[^\]\n]*|audio_as_voice)\s*\]\]/gi;

// ClawdbotCN 免费模型通知标记
const FREE_MODEL_NOTIFICATION_RE = /<!--CLAWDBOT_FREE_MODEL_NOTIFICATION:(.+?)-->\n*/g;

// 系统内部指令 - 发给 AI 模型的内部指令，不应该显示给用户
const INTERNAL_SYSTEM_PROMPTS = [
  // 会话重置提示词（中文）
  "已通过 /new 或 /reset 开始新会话。请简短地打招呼（1-2句话）并询问用户接下来想做什么。如果运行时模型与系统提示中的 default_model 不同，请在问候语中提及默认模型。不要提及内部步骤、文件、工具或推理过程。",
];

// 用户友好的替换文本
const FRIENDLY_SESSION_START_TEXT = "/new";

/**
 * 检查文本是否为系统内部指令
 * Check if text is an internal system prompt
 */
export function isInternalSystemPrompt(text: string | null | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return INTERNAL_SYSTEM_PROMPTS.some(prompt => trimmed === prompt);
}

/**
 * 将系统内部指令替换为用户友好的文本
 * Replace internal system prompts with user-friendly text
 */
function replaceInternalPrompts(text: string): string {
  const trimmed = text.trim();
  if (INTERNAL_SYSTEM_PROMPTS.some(prompt => trimmed === prompt)) {
    return FRIENDLY_SESSION_START_TEXT;
  }
  return text;
}
const ENVELOPE_CHANNELS = [
  "WebChat",
  "WhatsApp",
  "Telegram",
  "Signal",
  "Slack",
  "Discord",
  "iMessage",
  "Teams",
  "Matrix",
  "Zalo",
  "Zalo Personal",
  "BlueBubbles",
];

const textCache = new WeakMap<object, string | null>();
const thinkingCache = new WeakMap<object, string | null>();
const freeModelNotificationCache = new WeakMap<object, FreeModelNotification | null>();

/** ClawdbotCN 免费模型通知类型 */
export type FreeModelNotification = {
  type: "started" | "switched" | "exhausted" | "fallback";
  providerName: string;
  message: string;
  showInChat: boolean;
};

/**
 * Strip internal directive tags from text before display.
 * These include [[reply_to:...]], [[reply_to_current]], [[audio_as_voice]].
 * Also strips free model notification markers.
 */
function stripDirectiveTags(text: string): string {
  return text
    .replace(FREE_MODEL_NOTIFICATION_RE, "")
    .replace(DIRECTIVE_TAGS_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Extract ClawdbotCN free model notification from message text
 */
export function extractFreeModelNotification(message: unknown): FreeModelNotification | null {
  if (!message || typeof message !== "object") return null;
  
  const obj = message as object;
  if (freeModelNotificationCache.has(obj)) {
    return freeModelNotificationCache.get(obj) ?? null;
  }
  
  const rawText = extractRawText(message);
  if (!rawText) {
    freeModelNotificationCache.set(obj, null);
    return null;
  }
  
  const match = rawText.match(/<!--CLAWDBOT_FREE_MODEL_NOTIFICATION:(.+?)-->/);
  if (!match) {
    freeModelNotificationCache.set(obj, null);
    return null;
  }
  
  try {
    const notification = JSON.parse(match[1]) as FreeModelNotification;
    freeModelNotificationCache.set(obj, notification);
    return notification;
  } catch {
    freeModelNotificationCache.set(obj, null);
    return null;
  }
}

function looksLikeEnvelopeHeader(header: string): boolean {
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z\b/.test(header)) return true;
  if (/\d{4}-\d{2}-\d{2} \d{2}:\d{2}\b/.test(header)) return true;
  return ENVELOPE_CHANNELS.some((label) => header.startsWith(`${label} `));
}

export function stripEnvelope(text: string): string {
  const match = text.match(ENVELOPE_PREFIX);
  if (!match) return text;
  const header = match[1] ?? "";
  if (!looksLikeEnvelopeHeader(header)) return text;
  return text.slice(match[0].length);
}

export function extractText(message: unknown): string | null {
  const m = message as Record<string, unknown>;
  const role = typeof m.role === "string" ? m.role : "";
  const content = m.content;
  if (typeof content === "string") {
    // 对用户消息先检查并替换系统内部指令
    // For user messages, first check and replace internal system prompts
    const maybeReplaced = role === "user" ? replaceInternalPrompts(content) : content;
    const processed = role === "assistant" ? stripThinkingTags(maybeReplaced) : stripEnvelope(maybeReplaced);
    return stripDirectiveTags(processed);
  }
  if (Array.isArray(content)) {
    const parts = content
      .map((p) => {
        const item = p as Record<string, unknown>;
        if (item.type === "text" && typeof item.text === "string") return item.text;
        return null;
      })
      .filter((v): v is string => typeof v === "string");
    if (parts.length > 0) {
      const joined = parts.join("\n");
      // 对用户消息先检查并替换系统内部指令
      const maybeReplaced = role === "user" ? replaceInternalPrompts(joined) : joined;
      const processed = role === "assistant" ? stripThinkingTags(maybeReplaced) : stripEnvelope(maybeReplaced);
      return stripDirectiveTags(processed);
    }
  }
  if (typeof m.text === "string") {
    const maybeReplaced = role === "user" ? replaceInternalPrompts(m.text) : m.text;
    const processed = role === "assistant" ? stripThinkingTags(maybeReplaced) : stripEnvelope(maybeReplaced);
    return stripDirectiveTags(processed);
  }
  return null;
}

export function extractTextCached(message: unknown): string | null {
  if (!message || typeof message !== "object") return extractText(message);
  const obj = message as object;
  if (textCache.has(obj)) return textCache.get(obj) ?? null;
  const value = extractText(message);
  textCache.set(obj, value);
  return value;
}

export function extractThinking(message: unknown): string | null {
  const m = message as Record<string, unknown>;
  const content = m.content;
  const parts: string[] = [];
  if (Array.isArray(content)) {
    for (const p of content) {
      const item = p as Record<string, unknown>;
      if (item.type === "thinking" && typeof item.thinking === "string") {
        const cleaned = item.thinking.trim();
        if (cleaned) parts.push(cleaned);
      }
    }
  }
  if (parts.length > 0) return parts.join("\n");

  // Back-compat: older logs may still have <think> tags inside text blocks.
  const rawText = extractRawText(message);
  if (!rawText) return null;
  const matches = [
    ...rawText.matchAll(
      /<\s*think(?:ing)?\s*>([\s\S]*?)<\s*\/\s*think(?:ing)?\s*>/gi,
    ),
  ];
  const extracted = matches
    .map((m) => (m[1] ?? "").trim())
    .filter(Boolean);
  return extracted.length > 0 ? extracted.join("\n") : null;
}

export function extractThinkingCached(message: unknown): string | null {
  if (!message || typeof message !== "object") return extractThinking(message);
  const obj = message as object;
  if (thinkingCache.has(obj)) return thinkingCache.get(obj) ?? null;
  const value = extractThinking(message);
  thinkingCache.set(obj, value);
  return value;
}

export function extractRawText(message: unknown): string | null {
  const m = message as Record<string, unknown>;
  const content = m.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((p) => {
        const item = p as Record<string, unknown>;
        if (item.type === "text" && typeof item.text === "string") return item.text;
        return null;
      })
      .filter((v): v is string => typeof v === "string");
    if (parts.length > 0) return parts.join("\n");
  }
  if (typeof m.text === "string") return m.text;
  return null;
}

export function formatReasoningMarkdown(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `_${line}_`);
  return lines.length ? ["_Reasoning:_", ...lines].join("\n") : "";
}
