import { stripEnvelope, stripMessageIdHints } from "../shared/chat-envelope.js";

export { stripEnvelope };

const HOOK_CTX_RE = /<!--HOOK_CTX_START-->[\s\S]*?<!--HOOK_CTX_END-->\s*/g;

/**
 * Legacy orchestrator prompt detection for messages written before the
 * HOOK_CTX markers were introduced. The orchestrator system prompt always
 * starts with "## 智能组队" and ends with a section containing
 * "action=\"rollback\"". We locate the end of that block and strip it.
 */
const LEGACY_ORCH_TAIL = 'action="rollback"';
const LEGACY_ORCH_HEAD = "## 智能组队";

function stripHookContext(text: string): string {
  // New-style markers
  if (text.includes("<!--HOOK_CTX_START-->")) {
    return text.replace(HOOK_CTX_RE, "");
  }
  // Legacy orchestrator prompt (no markers)
  if (text.startsWith(LEGACY_ORCH_HEAD)) {
    const tailIdx = text.indexOf(LEGACY_ORCH_TAIL);
    if (tailIdx >= 0) {
      // Find end of the line containing the tail marker, then skip whitespace
      const lineEnd = text.indexOf("\n", tailIdx);
      if (lineEnd >= 0) {
        const rest = text.substring(lineEnd).replace(/^\s+/, "");
        return rest;
      }
    }
  }
  return text;
}

function stripEnvelopeFromContent(content: unknown[]): { content: unknown[]; changed: boolean } {
  let changed = false;
  const next = content.map((item) => {
    if (!item || typeof item !== "object") {
      return item;
    }
    const entry = item as Record<string, unknown>;
    if (entry.type !== "text" || typeof entry.text !== "string") {
      return item;
    }
    const stripped = stripHookContext(stripMessageIdHints(stripEnvelope(entry.text)));
    if (stripped === entry.text) {
      return item;
    }
    changed = true;
    return {
      ...entry,
      text: stripped,
    };
  });
  return { content: next, changed };
}

export function stripEnvelopeFromMessage(message: unknown): unknown {
  if (!message || typeof message !== "object") {
    return message;
  }
  const entry = message as Record<string, unknown>;
  const role = typeof entry.role === "string" ? entry.role.toLowerCase() : "";
  if (role !== "user") {
    return message;
  }

  let changed = false;
  const next: Record<string, unknown> = { ...entry };

  if (typeof entry.content === "string") {
    const stripped = stripHookContext(stripMessageIdHints(stripEnvelope(entry.content)));
    if (stripped !== entry.content) {
      next.content = stripped;
      changed = true;
    }
  } else if (Array.isArray(entry.content)) {
    const updated = stripEnvelopeFromContent(entry.content);
    if (updated.changed) {
      next.content = updated.content;
      changed = true;
    }
  } else if (typeof entry.text === "string") {
    const stripped = stripHookContext(stripMessageIdHints(stripEnvelope(entry.text)));
    if (stripped !== entry.text) {
      next.text = stripped;
      changed = true;
    }
  }

  return changed ? next : message;
}

export function stripEnvelopeFromMessages(messages: unknown[]): unknown[] {
  if (messages.length === 0) {
    return messages;
  }
  let changed = false;
  const next = messages.map((message) => {
    const stripped = stripEnvelopeFromMessage(message);
    if (stripped !== message) {
      changed = true;
    }
    return stripped;
  });
  return changed ? next : messages;
}
