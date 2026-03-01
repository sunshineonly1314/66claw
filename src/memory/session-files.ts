import fs from "node:fs/promises";
import path from "node:path";
import { resolveSessionTranscriptsDirForAgent } from "../config/sessions/paths.js";
import { redactSensitiveText } from "../logging/redact.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { hashText } from "./internal.js";

const log = createSubsystemLogger("memory");

export type SessionFileEntry = {
  path: string;
  absPath: string;
  mtimeMs: number;
  size: number;
  hash: string;
  content: string;
  /** Maps each content line (0-indexed) to its 1-indexed JSONL source line. */
  lineMap: number[];
};

export async function listSessionFilesForAgent(agentId: string): Promise<string[]> {
  const dir = resolveSessionTranscriptsDirForAgent(agentId);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name.endsWith(".jsonl"))
      .map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

export function sessionPathForFile(absPath: string): string {
  return path.join("sessions", path.basename(absPath)).replace(/\\/g, "/");
}

/**
 * [CN-PATCH:memory-fix] Normalize session text while preserving structural cues.
 *
 * Previous behavior: collapsed ALL newlines to spaces → destroyed lists, steps,
 * paragraph breaks in assistant responses. Embedding models understand structured
 * text better than run-on prose.
 *
 * New behavior:
 * - Collapse 3+ consecutive newlines → double newline (paragraph break)
 * - Keep single/double newlines (preserves lists, numbered steps)
 * - Collapse multiple spaces → single space (within lines)
 * - Trim leading/trailing whitespace
 */
function normalizeSessionText(value: string): string {
  return value
    .replace(/\n{3,}/g, "\n\n") // 3+ newlines → paragraph break
    .replace(/[ \t]+/g, " ") // collapse horizontal whitespace only
    .replace(/^ +| +$/gm, "") // trim each line's leading/trailing spaces
    .trim();
}

export function extractSessionText(content: unknown): string | null {
  if (typeof content === "string") {
    const normalized = normalizeSessionText(content);
    return normalized ? normalized : null;
  }
  if (!Array.isArray(content)) {
    return null;
  }
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const record = block as { type?: unknown; text?: unknown };
    if (record.type !== "text" || typeof record.text !== "string") {
      continue;
    }
    const normalized = normalizeSessionText(record.text);
    if (normalized) {
      parts.push(normalized);
    }
  }
  if (parts.length === 0) {
    return null;
  }
  // [CN-PATCH:memory-fix] 用段落分隔符连接多个 text block，而非空格。
  // 空格会把前一个 block 的最后一行和后一个 block 的第一行合并成一行，
  // 破坏原始结构（如列表、步骤）。段落分隔保持各 block 的独立性。
  return parts.join("\n\n");
}

export async function buildSessionEntry(absPath: string): Promise<SessionFileEntry | null> {
  try {
    const stat = await fs.stat(absPath);
    const raw = await fs.readFile(absPath, "utf-8");
    const lines = raw.split("\n");
    const collected: string[] = [];
    const lineMap: number[] = [];

    // [CN-PATCH:memory-fix] Extract session start time from the header record
    // or first message timestamp. Embed as a date label so time-based queries
    // ("上周聊了什么", "last month's discussion") can match via both FTS and vector.
    let sessionDate: string | null = null;

    for (let jsonlIdx = 0; jsonlIdx < lines.length; jsonlIdx++) {
      const line = lines[jsonlIdx];
      if (!line.trim()) {
        continue;
      }
      let record: unknown;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      if (!record || typeof record !== "object") {
        continue;
      }

      const rec = record as { type?: unknown; timestamp?: unknown; message?: unknown };

      // Extract session date from header or first message with timestamp
      if (!sessionDate && rec.timestamp) {
        const ts = rec.timestamp;
        if (typeof ts === "string" && ts.length >= 10) {
          // ISO format: "2025-03-01T10:30:00Z" → "2025-03-01"
          sessionDate = ts.slice(0, 10);
        } else if (typeof ts === "number" && ts > 0) {
          // [CN-PATCH:memory-fix] L3: 防御性处理秒级和毫秒级时间戳。
          // 与 codebase 其他地方（如 github-copilot-token.ts）保持一致。
          const ms = ts > 1e12 ? ts : ts * 1000;
          try {
            sessionDate = new Date(ms).toISOString().slice(0, 10);
          } catch {
            /* invalid timestamp */
          }
        }
      }

      if (rec.type !== "message") {
        continue;
      }
      const message = rec.message as
        | { role?: unknown; content?: unknown; timestamp?: unknown }
        | undefined;
      if (!message || typeof message.role !== "string") {
        continue;
      }
      if (message.role !== "user" && message.role !== "assistant") {
        continue;
      }

      // Extract timestamp from individual messages as fallback
      if (!sessionDate && message.timestamp) {
        const mts = message.timestamp;
        if (typeof mts === "number" && mts > 0) {
          const ms = mts > 1e12 ? mts : mts * 1000;
          try {
            sessionDate = new Date(ms).toISOString().slice(0, 10);
          } catch {
            /* invalid timestamp */
          }
        }
      }

      const text = extractSessionText(message.content);
      if (!text) {
        continue;
      }
      const safe = redactSensitiveText(text, { mode: "tools" });
      const label = message.role === "user" ? "User" : "Assistant";
      collected.push(`${label}: ${safe}`);
      lineMap.push(jsonlIdx + 1);
    }

    // Prepend session date as a context label if available
    if (sessionDate && collected.length > 0) {
      collected.unshift(`[Session: ${sessionDate}]`);
      // lineMap entry for the synthetic date line: point to line 1 (header)
      lineMap.unshift(1);
    }

    const content = collected.join("\n");
    return {
      path: sessionPathForFile(absPath),
      absPath,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      hash: hashText(content + "\n" + lineMap.join(",")),
      content,
      lineMap,
    };
  } catch (err) {
    log.debug(`Failed reading session file ${absPath}: ${String(err)}`);
    return null;
  }
}
