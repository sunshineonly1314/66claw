import crypto from "node:crypto";
import type { ExecToolDefaults } from "../../agents/bash-tools.js";
import type { OpenClawCNConfig } from "../../config/config.js";
import type { MsgContext, TemplateContext } from "../templating.js";
import type { GetReplyOptions, ReplyPayload } from "../types.js";
import type { buildCommandContext } from "./commands.js";
import type { InlineDirectives } from "./directive-handling.js";
import type { createModelSelectionState } from "./model-selection.js";
import type { TypingController } from "./typing.js";
import type { RoutingDecision } from "../../dispatch/types.js";
import { resolveSessionAuthProfileOverride } from "../../agents/auth-profiles/session-override.js";
import {
  abortEmbeddedPiRun,
  isEmbeddedPiRunActive,
  isEmbeddedPiRunStreaming,
  resolveEmbeddedSessionLane,
} from "../../agents/pi-embedded.js";
import {
  resolveGroupSessionKey,
  resolveSessionFilePath,
  resolveSessionFilePathOptions,
  type SessionEntry,
  updateSessionStore,
} from "../../config/sessions.js";
import { logVerbose } from "../../globals.js";
import { clearCommandLane, getQueueSize } from "../../process/command-queue.js";
import { normalizeMainKey } from "../../routing/session-key.js";
import { isReasoningTagProvider } from "../../utils/provider-utils.js";
import { hasControlCommand } from "../command-detection.js";
import { buildInboundMediaNote } from "../media-note.js";
import {
  type ElevatedLevel,
  formatXHighModelHint,
  normalizeThinkLevel,
  type ReasoningLevel,
  supportsXHighThinking,
  type ThinkLevel,
  type VerboseLevel,
} from "../thinking.js";
import { SILENT_REPLY_TOKEN } from "../tokens.js";
import { runMultiAgentOrchestration } from "../../dispatch/orchestrator.js";
import { runReplyAgent } from "./agent-runner.js";
import { applySessionHints } from "./body.js";
import { buildGroupIntro } from "./groups.js";
import { buildInboundMetaSystemPrompt, buildInboundUserContextPrefix } from "./inbound-meta.js";
import { resolveQueueSettings } from "./queue.js";
import { routeReply } from "./route-reply.js";
import { BARE_SESSION_RESET_PROMPT } from "./session-reset-prompt.js";
import { ensureSkillSnapshot, prependSystemEvents } from "./session-updates.js";
import { resolveTypingMode } from "./typing-mode.js";
import { appendUntrustedContext } from "./untrusted-context.js";

type AgentDefaults = NonNullable<OpenClawCNConfig["agents"]>["defaults"];
type ExecOverrides = Pick<ExecToolDefaults, "host" | "security" | "ask" | "node">;

type RunPreparedReplyParams = {
  ctx: MsgContext;
  sessionCtx: TemplateContext;
  cfg: OpenClawCNConfig;
  agentId: string;
  agentDir: string;
  agentCfg: AgentDefaults;
  sessionCfg: OpenClawCNConfig["session"];
  commandAuthorized: boolean;
  command: ReturnType<typeof buildCommandContext>;
  commandSource: string;
  allowTextCommands: boolean;
  directives: InlineDirectives;
  defaultActivation: Parameters<typeof buildGroupIntro>[0]["defaultActivation"];
  resolvedThinkLevel: ThinkLevel | undefined;
  resolvedVerboseLevel: VerboseLevel | undefined;
  resolvedReasoningLevel: ReasoningLevel;
  resolvedElevatedLevel: ElevatedLevel;
  execOverrides?: ExecOverrides;
  elevatedEnabled: boolean;
  elevatedAllowed: boolean;
  blockStreamingEnabled: boolean;
  blockReplyChunking?: {
    minChars: number;
    maxChars: number;
    breakPreference: "paragraph" | "newline" | "sentence";
    flushOnParagraph?: boolean;
  };
  resolvedBlockStreamingBreak: "text_end" | "message_end";
  modelState: Awaited<ReturnType<typeof createModelSelectionState>>;
  provider: string;
  model: string;
  perMessageQueueMode?: InlineDirectives["queueMode"];
  perMessageQueueOptions?: {
    debounceMs?: number;
    cap?: number;
    dropPolicy?: InlineDirectives["dropPolicy"];
  };
  typing: TypingController;
  opts?: GetReplyOptions;
  defaultProvider: string;
  defaultModel: string;
  timeoutMs: number;
  isNewSession: boolean;
  resetTriggered: boolean;
  systemSent: boolean;
  sessionEntry?: SessionEntry;
  sessionStore?: Record<string, SessionEntry>;
  sessionKey: string;
  sessionId?: string;
  storePath?: string;
  workspaceDir: string;
  abortedLastRun: boolean;
  /** Dispatch decision from the intelligent routing engine. */
  dispatchDecision?: RoutingDecision;
};

export async function runPreparedReply(
  params: RunPreparedReplyParams,
): Promise<ReplyPayload | ReplyPayload[] | undefined> {
  const {
    ctx,
    sessionCtx,
    cfg,
    agentId,
    agentDir,
    agentCfg,
    sessionCfg,
    commandAuthorized,
    command,
    commandSource,
    allowTextCommands,
    directives,
    defaultActivation,
    elevatedEnabled,
    elevatedAllowed,
    blockStreamingEnabled,
    blockReplyChunking,
    resolvedBlockStreamingBreak,
    modelState,
    provider,
    model,
    perMessageQueueMode,
    perMessageQueueOptions,
    typing,
    opts,
    defaultProvider,
    defaultModel,
    timeoutMs,
    isNewSession,
    resetTriggered,
    systemSent,
    sessionKey,
    sessionId,
    storePath,
    workspaceDir,
    sessionStore,
  } = params;
  let {
    sessionEntry,
    resolvedThinkLevel,
    resolvedVerboseLevel,
    resolvedReasoningLevel,
    resolvedElevatedLevel,
    execOverrides,
    abortedLastRun,
  } = params;
  let currentSystemSent = systemSent;

  const isFirstTurnInSession = isNewSession || !currentSystemSent;
  const isGroupChat = sessionCtx.ChatType === "group";
  const wasMentioned = ctx.WasMentioned === true;
  const isHeartbeat = opts?.isHeartbeat === true;
  const typingMode = resolveTypingMode({
    configured: sessionCfg?.typingMode ?? agentCfg?.typingMode,
    isGroupChat,
    wasMentioned,
    isHeartbeat,
  });
  const shouldInjectGroupIntro = Boolean(
    isGroupChat && (isFirstTurnInSession || sessionEntry?.groupActivationNeedsSystemIntro),
  );
  const groupIntro = shouldInjectGroupIntro
    ? buildGroupIntro({
        cfg,
        sessionCtx,
        sessionEntry,
        defaultActivation,
        silentToken: SILENT_REPLY_TOKEN,
      })
    : "";
  const groupSystemPrompt = sessionCtx.GroupSystemPrompt?.trim() ?? "";
  const inboundMetaPrompt = buildInboundMetaSystemPrompt(
    isNewSession ? sessionCtx : { ...sessionCtx, ThreadStarterBody: undefined },
  );
  let extraSystemPrompt = [inboundMetaPrompt, groupIntro, groupSystemPrompt]
    .filter(Boolean)
    .join("\n\n");
  // ── [CN-PATCH:tool-discovery] 注入工具摘要到 system prompt ──
  if (params.dispatchDecision?.toolSummaryPrompt) {
    let summaryPrompt = params.dispatchDecision.toolSummaryPrompt;
    // 限制长度，防止超过上下文窗口
    const MAX_SUMMARY_LENGTH = 5000;
    if (summaryPrompt.length > MAX_SUMMARY_LENGTH) {
      summaryPrompt =
        summaryPrompt.slice(0, MAX_SUMMARY_LENGTH) + "\n... (truncated due to length)";
    }
    extraSystemPrompt = [extraSystemPrompt, summaryPrompt].filter(Boolean).join("\n\n");
  }
  const baseBody = sessionCtx.BodyStripped ?? sessionCtx.Body ?? "";
  // Use CommandBody/RawBody for bare reset detection (clean message without structural context).
  const rawBodyTrimmed = (ctx.CommandBody ?? ctx.RawBody ?? ctx.Body ?? "").trim();
  const baseBodyTrimmedRaw = baseBody.trim();
  if (
    allowTextCommands &&
    (!commandAuthorized || !command.isAuthorizedSender) &&
    !baseBodyTrimmedRaw &&
    hasControlCommand(commandSource, cfg)
  ) {
    typing.cleanup();
    return undefined;
  }
  const isBareNewOrReset = rawBodyTrimmed === "/new" || rawBodyTrimmed === "/reset";
  const isBareSessionReset =
    isNewSession &&
    ((baseBodyTrimmedRaw.length === 0 && rawBodyTrimmed.length > 0) || isBareNewOrReset);
  const baseBodyFinal = isBareSessionReset ? BARE_SESSION_RESET_PROMPT : baseBody;
  const inboundUserContext = buildInboundUserContextPrefix(
    isNewSession
      ? {
          ...sessionCtx,
          ...(sessionCtx.ThreadHistoryBody?.trim()
            ? { InboundHistory: undefined, ThreadStarterBody: undefined }
            : {}),
        }
      : { ...sessionCtx, ThreadStarterBody: undefined },
  );
  const baseBodyForPrompt = isBareSessionReset
    ? baseBodyFinal
    : [inboundUserContext, baseBodyFinal].filter(Boolean).join("\n\n");
  const baseBodyTrimmed = baseBodyForPrompt.trim();
  const hasMediaAttachment = Boolean(
    sessionCtx.MediaPath || (sessionCtx.MediaPaths && sessionCtx.MediaPaths.length > 0),
  );
  if (!baseBodyTrimmed && !hasMediaAttachment) {
    await typing.onReplyStart();
    logVerbose("Inbound body empty after normalization; skipping agent run");
    typing.cleanup();
    return {
      text: "I didn't receive any text in your message. Please resend or add a caption.",
    };
  }
  // When the user sends media without text, provide a minimal body so the agent
  // run proceeds and the image/document is injected by the embedded runner.
  const effectiveBaseBody = baseBodyTrimmed
    ? baseBodyForPrompt
    : "[User sent media without caption]";
  let prefixedBodyBase = await applySessionHints({
    baseBody: effectiveBaseBody,
    abortedLastRun,
    sessionEntry,
    sessionStore,
    sessionKey,
    storePath,
    abortKey: command.abortKey,
  });
  const isGroupSession = sessionEntry?.chatType === "group" || sessionEntry?.chatType === "channel";
  const isMainSession = !isGroupSession && sessionKey === normalizeMainKey(sessionCfg?.mainKey);
  prefixedBodyBase = await prependSystemEvents({
    cfg,
    sessionKey,
    isMainSession,
    isNewSession,
    prefixedBodyBase,
  });
  prefixedBodyBase = appendUntrustedContext(prefixedBodyBase, sessionCtx.UntrustedContext);
  const threadStarterBody = ctx.ThreadStarterBody?.trim();
  const threadHistoryBody = ctx.ThreadHistoryBody?.trim();
  const threadContextNote =
    isNewSession && threadHistoryBody
      ? `[Thread history - for context]\n${threadHistoryBody}`
      : isNewSession && threadStarterBody
        ? `[Thread starter - for context]\n${threadStarterBody}`
        : undefined;
  const skillResult = await ensureSkillSnapshot({
    sessionEntry,
    sessionStore,
    sessionKey,
    storePath,
    sessionId,
    isFirstTurnInSession,
    workspaceDir,
    cfg,
    skillFilter: opts?.skillFilter,
  });
  sessionEntry = skillResult.sessionEntry ?? sessionEntry;
  currentSystemSent = skillResult.systemSent;
  const skillsSnapshot = skillResult.skillsSnapshot;
  const prefixedBody = [threadContextNote, prefixedBodyBase].filter(Boolean).join("\n\n");
  const mediaNote = buildInboundMediaNote(ctx);
  const mediaReplyHint = mediaNote
    ? "To send an image back, prefer the message tool (media/path/filePath). If you must inline, use MEDIA:https://example.com/image.jpg (spaces ok, quote if needed) or a safe relative path like MEDIA:./image.jpg. Avoid absolute paths (MEDIA:/...) and ~ paths — they are blocked for security. Keep caption in the text body."
    : undefined;
  let prefixedCommandBody = mediaNote
    ? [mediaNote, mediaReplyHint, prefixedBody ?? ""].filter(Boolean).join("\n").trim()
    : prefixedBody;
  if (!resolvedThinkLevel && prefixedCommandBody) {
    const parts = prefixedCommandBody.split(/\s+/);
    const maybeLevel = normalizeThinkLevel(parts[0]);
    if (maybeLevel && (maybeLevel !== "xhigh" || supportsXHighThinking(provider, model))) {
      resolvedThinkLevel = maybeLevel;
      prefixedCommandBody = parts.slice(1).join(" ").trim();
    }
  }
  if (!resolvedThinkLevel) {
    resolvedThinkLevel = await modelState.resolveDefaultThinkingLevel();
  }
  if (resolvedThinkLevel === "xhigh" && !supportsXHighThinking(provider, model)) {
    const explicitThink = directives.hasThinkDirective && directives.thinkLevel !== undefined;
    if (explicitThink) {
      typing.cleanup();
      return {
        text: `Thinking level "xhigh" is only supported for ${formatXHighModelHint()}. Use /think high or switch to one of those models.`,
      };
    }
    resolvedThinkLevel = "high";
    if (sessionEntry && sessionStore && sessionKey && sessionEntry.thinkingLevel === "xhigh") {
      sessionEntry.thinkingLevel = "high";
      sessionEntry.updatedAt = Date.now();
      sessionStore[sessionKey] = sessionEntry;
      if (storePath) {
        await updateSessionStore(storePath, (store) => {
          store[sessionKey] = sessionEntry;
        });
      }
    }
  }
  if (resetTriggered && command.isAuthorizedSender) {
    // oxlint-disable-next-line typescript/no-explicit-any
    const channel = ctx.OriginatingChannel || (command.channel as any);
    const to = ctx.OriginatingTo || command.from || command.to;
    if (channel && to) {
      const modelLabel = `${provider}/${model}`;
      const defaultLabel = `${defaultProvider}/${defaultModel}`;
      const text =
        modelLabel === defaultLabel
          ? `✅ New session started · model: ${modelLabel}`
          : `✅ New session started · model: ${modelLabel} (default: ${defaultLabel})`;
      await routeReply({
        payload: { text },
        channel,
        to,
        sessionKey,
        accountId: ctx.AccountId,
        threadId: ctx.MessageThreadId,
        cfg,
      });
    }
  }
  const sessionIdFinal = sessionId ?? crypto.randomUUID();
  const sessionFile = resolveSessionFilePath(
    sessionIdFinal,
    sessionEntry,
    resolveSessionFilePathOptions({ agentId, storePath }),
  );
  const queueBodyBase = [threadContextNote, effectiveBaseBody].filter(Boolean).join("\n\n");
  const queuedBody = mediaNote
    ? [mediaNote, mediaReplyHint, queueBodyBase].filter(Boolean).join("\n").trim()
    : queueBodyBase;
  const resolvedQueue = resolveQueueSettings({
    cfg,
    channel: sessionCtx.Provider,
    sessionEntry,
    inlineMode: perMessageQueueMode,
    inlineOptions: perMessageQueueOptions,
  });
  const sessionLaneKey = resolveEmbeddedSessionLane(sessionKey ?? sessionIdFinal);
  const laneSize = getQueueSize(sessionLaneKey);
  if (resolvedQueue.mode === "interrupt" && laneSize > 0) {
    const cleared = clearCommandLane(sessionLaneKey);
    const aborted = abortEmbeddedPiRun(sessionIdFinal);
    logVerbose(`Interrupting ${sessionLaneKey} (cleared ${cleared}, aborted=${aborted})`);
  }
  const queueKey = sessionKey ?? sessionIdFinal;
  const isActive = isEmbeddedPiRunActive(sessionIdFinal);
  const isStreaming = isEmbeddedPiRunStreaming(sessionIdFinal);
  const shouldSteer = resolvedQueue.mode === "steer" || resolvedQueue.mode === "steer-backlog";
  const shouldFollowup =
    resolvedQueue.mode === "followup" ||
    resolvedQueue.mode === "collect" ||
    resolvedQueue.mode === "steer-backlog";
  const authProfileId = await resolveSessionAuthProfileOverride({
    cfg,
    provider,
    agentDir,
    sessionEntry,
    sessionStore,
    sessionKey,
    storePath,
    isNewSession,
  });
  const authProfileIdSource = sessionEntry?.authProfileOverrideSource;
  const followupRun = {
    prompt: queuedBody,
    messageId: sessionCtx.MessageSidFull ?? sessionCtx.MessageSid,
    summaryLine: baseBodyTrimmedRaw,
    enqueuedAt: Date.now(),
    // Originating channel for reply routing.
    originatingChannel: ctx.OriginatingChannel,
    originatingTo: ctx.OriginatingTo,
    originatingAccountId: ctx.AccountId,
    originatingThreadId: ctx.MessageThreadId,
    originatingChatType: ctx.ChatType,
    run: {
      agentId,
      agentDir,
      sessionId: sessionIdFinal,
      sessionKey,
      messageProvider: sessionCtx.Provider?.trim().toLowerCase() || undefined,
      agentAccountId: sessionCtx.AccountId,
      groupId: resolveGroupSessionKey(sessionCtx)?.id ?? undefined,
      groupChannel: sessionCtx.GroupChannel?.trim() ?? sessionCtx.GroupSubject?.trim(),
      groupSpace: sessionCtx.GroupSpace?.trim() ?? undefined,
      senderId: sessionCtx.SenderId?.trim() || undefined,
      senderName: sessionCtx.SenderName?.trim() || undefined,
      senderUsername: sessionCtx.SenderUsername?.trim() || undefined,
      senderE164: sessionCtx.SenderE164?.trim() || undefined,
      senderIsOwner: command.senderIsOwner,
      sessionFile,
      workspaceDir,
      config: cfg,
      skillsSnapshot,
      provider,
      model,
      authProfileId,
      authProfileIdSource,
      thinkLevel: resolvedThinkLevel,
      verboseLevel: resolvedVerboseLevel,
      reasoningLevel: resolvedReasoningLevel,
      elevatedLevel: resolvedElevatedLevel,
      execOverrides,
      bashElevated: {
        enabled: elevatedEnabled,
        allowed: elevatedAllowed,
        defaultLevel: resolvedElevatedLevel ?? "off",
      },
      timeoutMs,
      blockReplyBreak: resolvedBlockStreamingBreak,
      ownerNumbers: command.ownerList.length > 0 ? command.ownerList : undefined,
      extraSystemPrompt: extraSystemPrompt || undefined,
      ...(isReasoningTagProvider(provider) ? { enforceFinalTag: true } : {}),
    },
  };

  // ===== OpenClawCN: Multi-Agent Orchestration Branch =====
  // Guarded by cfg.dispatch — must be explicitly enabled (default off)
  const multiAgentEnabled = cfg.dispatch?.enabled === true && cfg.dispatch?.multiAgent !== false;
  if (
    multiAgentEnabled &&
    params.dispatchDecision?.strategy === "multi" &&
    !params.dispatchDecision.strategyDegraded
  ) {
    try {
      const orchestrationResult = await runMultiAgentOrchestration({
        task: prefixedCommandBody,
        decision: params.dispatchDecision,
        cfg,
        sessionKey,
        agentId,
        agentDir,
        workspaceDir,
        opts,
      });
      if (orchestrationResult !== undefined) {
        typing.cleanup();
        return orchestrationResult;
      }
      // Orchestration returned undefined (e.g. resource exhausted) — fall through to single agent
      logVerbose("[MultiAgent] Orchestration returned undefined, falling back to single agent");
    } catch (orchErr) {
      // Multi-agent failed — degrade gracefully to single agent
      logVerbose(
        `[MultiAgent] Orchestration failed, degrading to single agent: ${String(orchErr)}`,
      );
    }
  }
  // ===== END OpenClawCN: Multi-Agent Orchestration Branch =====

  return runReplyAgent({
    commandBody: prefixedCommandBody,
    followupRun,
    queueKey,
    resolvedQueue,
    shouldSteer,
    shouldFollowup,
    isActive,
    isStreaming,
    opts,
    typing,
    sessionEntry,
    sessionStore,
    sessionKey,
    storePath,
    defaultModel,
    agentCfgContextTokens: agentCfg?.contextTokens,
    resolvedVerboseLevel: resolvedVerboseLevel ?? "off",
    isNewSession,
    blockStreamingEnabled,
    blockReplyChunking,
    resolvedBlockStreamingBreak,
    sessionCtx,
    shouldInjectGroupIntro,
    typingMode,
    // ── [CN-PATCH:tool-discovery] Extract and forward tool hints from dispatch decision ──
    // FIX P1#6: Merge mcpToolHints (wildcard format) with toolHints so applyToolHints
    // can reorder MCP tools too. mcpToolHints use "mcp_{id}_*" format which
    // applyToolHints now supports via prefix matching.
    toolHints: [
      ...(params.dispatchDecision?.toolHints ?? []),
      ...(params.dispatchDecision?.mcpToolHints ?? []),
    ],
    toolFilterPolicy: params.dispatchDecision?.toolFilterPolicy,
    mcpSuggestions: params.dispatchDecision?.mcpSuggestions,
  });
}
