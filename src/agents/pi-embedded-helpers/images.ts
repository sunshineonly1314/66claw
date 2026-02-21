import type { AgentMessage, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { ToolCallIdMode } from "../tool-call-id.js";
import { sanitizeToolCallIdsForCloudCodeAssist } from "../tool-call-id.js";
import { sanitizeContentBlocksImages } from "../tool-images.js";
import { stripThoughtSignatures } from "./bootstrap.js";

type ContentBlock = AgentToolResult<unknown>["content"][number];

export function isEmptyAssistantMessageContent(
  message: Extract<AgentMessage, { role: "assistant" }>,
): boolean {
  const content = message.content;
  if (content == null) {
    return true;
  }
  if (!Array.isArray(content)) {
    return false;
  }
  return content.every((block) => {
    if (!block || typeof block !== "object") {
      return true;
    }
    const rec = block as { type?: unknown; text?: unknown };
    if (rec.type !== "text") {
      return false;
    }
    return typeof rec.text !== "string" || rec.text.trim().length === 0;
  });
}

export async function sanitizeSessionMessagesImages(
  messages: AgentMessage[],
  label: string,
  options?: {
    sanitizeMode?: "full" | "images-only";
    sanitizeToolCallIds?: boolean;
    /**
     * Mode for tool call ID sanitization:
     * - "strict" (alphanumeric only)
     * - "strict9" (alphanumeric only, length 9)
     */
    toolCallIdMode?: ToolCallIdMode;
    preserveSignatures?: boolean;
    sanitizeThoughtSignatures?: {
      allowBase64Only?: boolean;
      includeCamelCase?: boolean;
    };
  },
): Promise<AgentMessage[]> {
  const sanitizeMode = options?.sanitizeMode ?? "full";
  const allowNonImageSanitization = sanitizeMode === "full";
  // We sanitize historical session messages because Anthropic can reject a request
  // if the transcript contains oversized base64 images (see MAX_IMAGE_DIMENSION_PX).
  const sanitizedIds = options?.sanitizeToolCallIds
    ? sanitizeToolCallIdsForCloudCodeAssist(messages, options.toolCallIdMode)
    : messages;
  const out: AgentMessage[] = [];
  for (const msg of sanitizedIds) {
    if (!msg || typeof msg !== "object") {
      out.push(msg);
      continue;
    }

    const role = (msg as { role?: unknown }).role;
    if (role === "toolResult") {
      const toolMsg = msg as Extract<AgentMessage, { role: "toolResult" }>;
      const content = Array.isArray(toolMsg.content) ? toolMsg.content : [];
      const nextContent = (await sanitizeContentBlocksImages(
        content,
        label,
      )) as unknown as typeof toolMsg.content;
      out.push({ ...toolMsg, content: nextContent });
      continue;
    }

    if (role === "user") {
      const userMsg = msg as Extract<AgentMessage, { role: "user" }>;
      const content = userMsg.content;
      if (Array.isArray(content)) {
        const nextContent = (await sanitizeContentBlocksImages(
          content as unknown as ContentBlock[],
          label,
        )) as unknown as typeof userMsg.content;
        out.push({ ...userMsg, content: nextContent });
        continue;
      }
    }

    if (role === "assistant") {
      const assistantMsg = msg as Extract<AgentMessage, { role: "assistant" }>;
      if (assistantMsg.stopReason === "error" || assistantMsg.stopReason === "aborted") {
        const content = assistantMsg.content;
        // [CN-PATCH] 跳过空内容的 error/aborted assistant 消息，防止 session 污染
        // 传播到后续 API 调用。空 assistant 会导致部分 provider 拒绝整个对话历史。
        if (Array.isArray(content)) {
          const hasRealContent = content.some((block) => {
            if (!block || typeof block !== "object") return false;
            const rec = block as { type?: string; text?: string; thinking?: string; name?: string };
            if (rec.type === "text" && typeof rec.text === "string" && rec.text.trim().length > 0)
              return true;
            if (
              rec.type === "thinking" &&
              typeof rec.thinking === "string" &&
              rec.thinking.trim().length > 0
            )
              return true;
            if (
              rec.type === "toolCall" &&
              typeof rec.name === "string" &&
              rec.name.trim().length > 0
            )
              return true;
            return false;
          });
          if (!hasRealContent) {
            // 空内容 error assistant — 从历史中移除
            continue;
          }
          const nextContent = (await sanitizeContentBlocksImages(
            content as unknown as ContentBlock[],
            label,
          )) as unknown as typeof assistantMsg.content;
          out.push({ ...assistantMsg, content: nextContent });
        } else {
          out.push(assistantMsg);
        }
        continue;
      }
      const content = assistantMsg.content;
      if (Array.isArray(content)) {
        if (!allowNonImageSanitization) {
          const nextContent = (await sanitizeContentBlocksImages(
            content as unknown as ContentBlock[],
            label,
          )) as unknown as typeof assistantMsg.content;
          out.push({ ...assistantMsg, content: nextContent });
          continue;
        }
        const strippedContent = options?.preserveSignatures
          ? content // Keep signatures for Antigravity Claude
          : stripThoughtSignatures(content, options?.sanitizeThoughtSignatures); // Strip for Gemini

        const filteredContent = strippedContent.filter((block) => {
          if (!block || typeof block !== "object") {
            return true;
          }
          const rec = block as { type?: unknown; text?: unknown };
          if (rec.type !== "text" || typeof rec.text !== "string") {
            return true;
          }
          return rec.text.trim().length > 0;
        });
        const finalContent = (await sanitizeContentBlocksImages(
          filteredContent as unknown as ContentBlock[],
          label,
        )) as unknown as typeof assistantMsg.content;
        if (finalContent.length === 0) {
          continue;
        }
        out.push({ ...assistantMsg, content: finalContent });
        continue;
      }
    }

    out.push(msg);
  }
  return out;
}
