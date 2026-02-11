import { Type } from "@sinclair/typebox";

import { loadConfig } from "../../config/config.js";
import { callGateway } from "../../gateway/call.js";
import { isSubagentSessionKey, resolveAgentIdFromSessionKey } from "../../routing/session-key.js";
import { sliceUtf16Safe } from "../../utils.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";
import {
  createAgentToAgentPolicy,
  resolveSessionReference,
  resolveMainSessionAlias,
  resolveInternalSessionKey,
  stripToolMessages,
} from "./sessions-helpers.js";

// Prevent sessions_history tool from blowing up the LLM context window.
const SESSIONS_HISTORY_MAX_BYTES = 80 * 1024; // 80 KB hard cap
const SESSIONS_HISTORY_TEXT_MAX_CHARS = 4000;

function truncateHistoryText(text: string): string {
  if (text.length <= SESSIONS_HISTORY_TEXT_MAX_CHARS) return text;
  return `${sliceUtf16Safe(text, 0, SESSIONS_HISTORY_TEXT_MAX_CHARS)}… [truncated]`;
}

function sanitizeHistoryContentBlock(block: Record<string, unknown>): Record<string, unknown> {
  const out = { ...block };
  if (typeof out.text === "string") out.text = truncateHistoryText(out.text);
  if (typeof out.thinking === "string") out.thinking = truncateHistoryText(out.thinking);
  if (typeof out.partialJson === "string") out.partialJson = truncateHistoryText(out.partialJson);
  delete out.thinkingSignature;
  if (out.type === "image" && out.data) out.data = "[omitted]";
  return out;
}

function sanitizeHistoryMessage(msg: unknown): Record<string, unknown> {
  if (!msg || typeof msg !== "object") return msg as Record<string, unknown>;
  const out = { ...(msg as Record<string, unknown>) };
  delete out.details;
  delete out.usage;
  delete out.cost;
  if (typeof out.text === "string") out.text = truncateHistoryText(out.text);
  if (typeof out.content === "string") {
    out.content = truncateHistoryText(out.content);
  } else if (Array.isArray(out.content)) {
    out.content = (out.content as Record<string, unknown>[]).map(sanitizeHistoryContentBlock);
  }
  return out;
}

function jsonUtf8Bytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function enforceSessionsHistoryHardCap(
  items: Record<string, unknown>[],
  maxBytes: number,
): { items: Record<string, unknown>[]; truncated: boolean; droppedMessages: boolean } {
  const totalBytes = jsonUtf8Bytes(items);
  if (totalBytes <= maxBytes) return { items, truncated: false, droppedMessages: false };

  let kept = items;
  let dropped = false;
  while (kept.length > 1 && jsonUtf8Bytes(kept) > maxBytes) {
    kept = kept.slice(1);
    dropped = true;
  }

  if (jsonUtf8Bytes(kept) <= maxBytes) {
    return { items: kept, truncated: true, droppedMessages: dropped };
  }

  return {
    items: [{ role: "system", content: "[sessions_history omitted: message too large]" }],
    truncated: true,
    droppedMessages: true,
  };
}

const SessionsHistoryToolSchema = Type.Object({
  sessionKey: Type.String(),
  limit: Type.Optional(Type.Number({ minimum: 1 })),
  includeTools: Type.Optional(Type.Boolean()),
});

function resolveSandboxSessionToolsVisibility(cfg: ReturnType<typeof loadConfig>) {
  return cfg.agents?.defaults?.sandbox?.sessionToolsVisibility ?? "spawned";
}

async function isSpawnedSessionAllowed(params: {
  requesterSessionKey: string;
  targetSessionKey: string;
}): Promise<boolean> {
  try {
    const list = (await callGateway({
      method: "sessions.list",
      params: {
        includeGlobal: false,
        includeUnknown: false,
        limit: 500,
        spawnedBy: params.requesterSessionKey,
      },
    })) as { sessions?: Array<Record<string, unknown>> };
    const sessions = Array.isArray(list?.sessions) ? list.sessions : [];
    return sessions.some((entry) => entry?.key === params.targetSessionKey);
  } catch {
    return false;
  }
}

export function createSessionsHistoryTool(opts?: {
  agentSessionKey?: string;
  sandboxed?: boolean;
}): AnyAgentTool {
  return {
    label: "Session History",
    name: "sessions_history",
    description: "Fetch message history for a session.",
    parameters: SessionsHistoryToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const sessionKeyParam = readStringParam(params, "sessionKey", {
        required: true,
      });
      const cfg = loadConfig();
      const { mainKey, alias } = resolveMainSessionAlias(cfg);
      const visibility = resolveSandboxSessionToolsVisibility(cfg);
      const requesterInternalKey =
        typeof opts?.agentSessionKey === "string" && opts.agentSessionKey.trim()
          ? resolveInternalSessionKey({
              key: opts.agentSessionKey,
              alias,
              mainKey,
            })
          : undefined;
      const restrictToSpawned =
        opts?.sandboxed === true &&
        visibility === "spawned" &&
        !!requesterInternalKey &&
        !isSubagentSessionKey(requesterInternalKey);
      const resolvedSession = await resolveSessionReference({
        sessionKey: sessionKeyParam,
        alias,
        mainKey,
        requesterInternalKey,
        restrictToSpawned,
      });
      if (!resolvedSession.ok) {
        return jsonResult({ status: resolvedSession.status, error: resolvedSession.error });
      }
      // From here on, use the canonical key (sessionId inputs already resolved).
      const resolvedKey = resolvedSession.key;
      const displayKey = resolvedSession.displayKey;
      const resolvedViaSessionId = resolvedSession.resolvedViaSessionId;
      if (restrictToSpawned && !resolvedViaSessionId) {
        const ok = await isSpawnedSessionAllowed({
          requesterSessionKey: requesterInternalKey,
          targetSessionKey: resolvedKey,
        });
        if (!ok) {
          return jsonResult({
            status: "forbidden",
            error: `Session not visible from this sandboxed agent session: ${sessionKeyParam}`,
          });
        }
      }

      const a2aPolicy = createAgentToAgentPolicy(cfg);
      const requesterAgentId = resolveAgentIdFromSessionKey(requesterInternalKey);
      const targetAgentId = resolveAgentIdFromSessionKey(resolvedKey);
      const isCrossAgent = requesterAgentId !== targetAgentId;
      if (isCrossAgent) {
        if (!a2aPolicy.enabled) {
          return jsonResult({
            status: "forbidden",
            error:
              "Agent-to-agent history is disabled. Set tools.agentToAgent.enabled=true to allow cross-agent access.",
          });
        }
        if (!a2aPolicy.isAllowed(requesterAgentId, targetAgentId)) {
          return jsonResult({
            status: "forbidden",
            error: "Agent-to-agent history denied by tools.agentToAgent.allow.",
          });
        }
      }

      const limit =
        typeof params.limit === "number" && Number.isFinite(params.limit)
          ? Math.max(1, Math.floor(params.limit))
          : undefined;
      const includeTools = Boolean(params.includeTools);
      const result = (await callGateway({
        method: "chat.history",
        params: { sessionKey: resolvedKey, limit },
      })) as { messages?: unknown[] };
      const rawMessages = Array.isArray(result?.messages) ? result.messages : [];
      const filtered = includeTools ? rawMessages : stripToolMessages(rawMessages);
      const sanitized = filtered.map(sanitizeHistoryMessage);
      const {
        items: capped,
        truncated,
        droppedMessages,
      } = enforceSessionsHistoryHardCap(sanitized, SESSIONS_HISTORY_MAX_BYTES);
      const response: Record<string, unknown> = {
        sessionKey: displayKey,
        messages: capped,
        bytes: jsonUtf8Bytes(capped),
      };
      if (truncated) response.truncated = true;
      if (droppedMessages) response.droppedMessages = true;
      return jsonResult(response);
    },
  };
}
