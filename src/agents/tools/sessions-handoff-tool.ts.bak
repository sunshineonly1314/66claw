/**
 * sessions_handoff — Structured agent-to-agent conversation handoff.
 *
 * Enables Agent A to transfer a conversation to Agent B with full context,
 * including conversation summary, decision reasoning, and delivery metadata.
 *
 * Unlike sessions_spawn (fire-and-forget background task), handoff is
 * designed for "I can't handle this, Agent B should take over" scenarios.
 * The target agent receives the full context and delivers directly to the
 * user's channel, not back to Agent A.
 *
 * Inspired by OpenAI Agents SDK handoff pattern.
 */

import { Type } from "@sinclair/typebox";
import crypto from "node:crypto";
import type { AnyAgentTool } from "./common.js";
import { loadConfig } from "../../config/config.js";
import { callGateway } from "../../gateway/call.js";
import { normalizeAgentId, parseAgentSessionKey } from "../../routing/session-key.js";
import { getAgentNestingDepth } from "../../sessions/session-key-utils.js";
import { normalizeDeliveryContext } from "../../utils/delivery-context.js";
import type { GatewayMessageChannel } from "../../utils/message-channel.js";
import { resolveAgentConfig } from "../agent-scope.js";
import { AGENT_LANE_SUBAGENT } from "../lanes.js";
import { registerSubagentRun } from "../subagent-registry.js";
import { jsonResult, readStringParam } from "./common.js";
import {
  resolveDisplaySessionKey,
  resolveInternalSessionKey,
  resolveMainSessionAlias,
} from "./sessions-helpers.js";

const SessionsHandoffToolSchema = Type.Object({
  /** Target agent ID to hand off to. */
  targetAgentId: Type.String(),
  /** Summary of the conversation so far and user's intent. */
  conversationSummary: Type.String(),
  /** Reason for the handoff — why Agent B is better suited. */
  reason: Type.String(),
  /** The original user request or message that triggered this conversation. */
  userRequest: Type.Optional(Type.String()),
  /** Optional structured context (key-value) to pass to the target agent. */
  context: Type.Optional(Type.Record(Type.String(), Type.String())),
  /** Optional timeout in seconds for the handoff agent run. */
  runTimeoutSeconds: Type.Optional(Type.Number({ minimum: 0 })),
});

export function createSessionsHandoffTool(opts?: {
  agentSessionKey?: string;
  agentChannel?: GatewayMessageChannel;
  agentAccountId?: string;
  agentTo?: string;
  agentThreadId?: string | number;
  agentGroupId?: string | null;
  agentGroupChannel?: string | null;
  agentGroupSpace?: string | null;
  sandboxed?: boolean;
  requesterAgentIdOverride?: string;
}): AnyAgentTool {
  return {
    label: "Sessions",
    name: "sessions_handoff",
    description:
      "Hand off the current conversation to another agent. " +
      "Use this when another agent is better suited to handle the user's request. " +
      "The target agent receives full context and delivers directly to the user.",
    parameters: SessionsHandoffToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const targetAgentIdRaw = readStringParam(params, "targetAgentId", { required: true });
      const conversationSummary = readStringParam(params, "conversationSummary", { required: true });
      const reason = readStringParam(params, "reason", { required: true });
      const userRequest = readStringParam(params, "userRequest");
      const contextMap = params.context as Record<string, string> | undefined;
      const runTimeoutSeconds = (() => {
        const val =
          typeof params.runTimeoutSeconds === "number" && Number.isFinite(params.runTimeoutSeconds)
            ? Math.max(0, Math.floor(params.runTimeoutSeconds))
            : undefined;
        return val ?? 0;
      })();

      const cfg = loadConfig();
      const { mainKey, alias } = resolveMainSessionAlias(cfg);
      const requesterSessionKey = opts?.agentSessionKey;
      const requesterInternalKey = requesterSessionKey
        ? resolveInternalSessionKey({
            key: requesterSessionKey,
            alias,
            mainKey,
          })
        : alias;
      const requesterDisplayKey = resolveDisplaySessionKey({
        key: requesterInternalKey,
        alias,
        mainKey,
      });
      const requesterAgentId = normalizeAgentId(
        opts?.requesterAgentIdOverride ?? parseAgentSessionKey(requesterInternalKey)?.agentId,
      );
      const targetAgentId = normalizeAgentId(targetAgentIdRaw);

      // ── Validate target agent is allowed ──────────────────────────────
      if (targetAgentId !== requesterAgentId) {
        const requesterAgentConfig = resolveAgentConfig(cfg, requesterAgentId);
        const allowAgents = requesterAgentConfig?.subagents?.allowAgents ?? [];
        const allowAny = allowAgents.some((value) => value.trim() === "*");
        const normalizedTargetId = targetAgentId.toLowerCase();
        const allowSet = new Set(
          allowAgents
            .filter((value) => value.trim() && value.trim() !== "*")
            .map((value) => normalizeAgentId(value).toLowerCase()),
        );
        if (!allowAny && !allowSet.has(normalizedTargetId)) {
          return jsonResult({
            status: "forbidden",
            error: `Handoff to agent "${targetAgentId}" is not allowed (check subagents.allowAgents).`,
          });
        }
      }

      // ── Handoff chain depth check (prevent infinite A→B→A loops) ─────
      const nestingDepth = getAgentNestingDepth(requesterSessionKey);
      const maxHandoffDepth = 3;
      if (nestingDepth >= maxHandoffDepth) {
        return jsonResult({
          status: "forbidden",
          error: `Handoff chain depth limit reached (depth=${nestingDepth}, max=${maxHandoffDepth}). This prevents infinite handoff loops.`,
        });
      }

      // ── Build handoff context ─────────────────────────────────────────
      const requesterOrigin = normalizeDeliveryContext({
        channel: opts?.agentChannel,
        accountId: opts?.agentAccountId,
        to: opts?.agentTo,
        threadId: opts?.agentThreadId,
      });

      const contextLines: string[] = [];
      if (contextMap && typeof contextMap === "object") {
        for (const [key, value] of Object.entries(contextMap)) {
          if (typeof value === "string" && value.trim()) {
            contextLines.push(`- ${key}: ${value.trim()}`);
          }
        }
      }

      const handoffSystemPrompt = [
        `[Handoff from agent "${requesterAgentId}"]`,
        "",
        `You are taking over a conversation that was previously handled by agent "${requesterAgentId}".`,
        `This is a handoff — you should continue the conversation naturally with the user.`,
        "",
        `## Handoff Reason`,
        reason,
        "",
        `## Conversation Summary`,
        conversationSummary,
        ...(userRequest ? ["", "## Original User Request", userRequest] : []),
        ...(contextLines.length > 0 ? ["", "## Additional Context", ...contextLines] : []),
        "",
        `## Instructions`,
        `- Continue the conversation with the user directly.`,
        `- Do NOT mention the handoff unless the user asks.`,
        `- Use the conversation summary to understand context.`,
        `- Deliver your response to the user (this is not a background task).`,
      ]
        .join("\n")
        .trim();

      // ── Spawn the handoff session ─────────────────────────────────────
      const childSessionKey = `agent:${targetAgentId}:handoff:${crypto.randomUUID()}`;

      // Build the task message that the target agent receives
      const taskMessage = userRequest
        ? `[Handoff] Continue helping the user with: ${userRequest}`
        : `[Handoff] Continue the conversation based on the context provided.`;

      const childIdem = crypto.randomUUID();
      let childRunId: string = childIdem;
      try {
        const response = await callGateway<{ runId: string }>({
          method: "agent",
          params: {
            message: taskMessage,
            sessionKey: childSessionKey,
            channel: requesterOrigin?.channel,
            to: requesterOrigin?.to ?? undefined,
            accountId: requesterOrigin?.accountId ?? undefined,
            threadId:
              requesterOrigin?.threadId != null ? String(requesterOrigin.threadId) : undefined,
            idempotencyKey: childIdem,
            deliver: true, // Handoff delivers directly to user (unlike spawn)
            lane: AGENT_LANE_SUBAGENT,
            extraSystemPrompt: handoffSystemPrompt,
            timeout: runTimeoutSeconds > 0 ? runTimeoutSeconds : undefined,
            label: `handoff:${requesterAgentId}→${targetAgentId}`,
            spawnedBy: requesterInternalKey,
            groupId: opts?.agentGroupId ?? undefined,
            groupChannel: opts?.agentGroupChannel ?? undefined,
            groupSpace: opts?.agentGroupSpace ?? undefined,
          },
          timeoutMs: 10_000,
        });
        if (typeof response?.runId === "string" && response.runId) {
          childRunId = response.runId;
        }
      } catch (err) {
        const messageText =
          err instanceof Error ? err.message : typeof err === "string" ? err : "error";
        return jsonResult({
          status: "error",
          error: messageText,
          childSessionKey,
          runId: childRunId,
        });
      }

      // Register in subagent registry for lifecycle tracking
      registerSubagentRun({
        runId: childRunId,
        childSessionKey,
        requesterSessionKey: requesterInternalKey,
        requesterOrigin,
        requesterDisplayKey,
        task: `Handoff: ${reason}`,
        cleanup: "keep",
        label: `handoff:${requesterAgentId}→${targetAgentId}`,
        runTimeoutSeconds,
      });

      return jsonResult({
        status: "accepted",
        handoff: true,
        childSessionKey,
        runId: childRunId,
        targetAgentId,
        reason,
      });
    },
  };
}
