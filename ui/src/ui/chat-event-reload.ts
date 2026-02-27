// [CN-MERGE:dc6afeb4f8] Skip unnecessary full history reloads on final events
import type { ChatEventPayload } from "./controllers/chat.ts";

export function shouldReloadHistoryForFinalEvent(payload?: ChatEventPayload): boolean {
  if (!payload || payload.state !== "final") {
    return false;
  }
  if (!payload.message || typeof payload.message !== "object") {
    return true;
  }
  const message = payload.message as Record<string, unknown>;
  const role = typeof message.role === "string" ? message.role.toLowerCase() : "";
  if (role && role !== "assistant") {
    return true;
  }
  // [CN-FIX:image-display] When the assistant message used tools (tool_use blocks in content),
  // we must reload history so that toolResult messages (with image/video gen details) are
  // available for buildChatItems to inject into the rendering. Without this, tool results
  // only exist in the JSONL but never reach chatMessages, so images/videos don't display.
  if (Array.isArray(message.content)) {
    const content = message.content as Array<Record<string, unknown>>;
    const hasToolUse = content.some(
      (block) => block.type === "tool_use" || block.type === "tool_call",
    );
    if (hasToolUse) {
      return true;
    }
  }
  return false;
}
