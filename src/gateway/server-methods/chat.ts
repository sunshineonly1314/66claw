import { CURRENT_SESSION_VERSION, SessionManager } from "@mariozechner/pi-coding-agent";
import fs from "node:fs";
import path from "node:path";
import type { MsgContext } from "../../auto-reply/templating.js";
import type { GatewayRequestContext, GatewayRequestHandlers } from "./types.js";
import { resolveSessionAgentId } from "../../agents/agent-scope.js";
import { resolveThinkingDefault } from "../../agents/model-selection.js";
import { resolveAgentTimeoutMs } from "../../agents/timeout.js";
import { dispatchInboundMessage } from "../../auto-reply/dispatch.js";
import { createReplyDispatcher } from "../../auto-reply/reply/reply-dispatcher.js";
import { createReplyPrefixOptions } from "../../channels/reply-prefix.js";
import { resolveSessionFilePath } from "../../config/sessions.js";
import { resolveSendPolicy } from "../../sessions/send-policy.js";
import { INTERNAL_MESSAGE_CHANNEL } from "../../utils/message-channel.js";
import {
  abortChatRunById,
  abortChatRunsForSessionKey,
  isChatStopCommandText,
  resolveChatRunExpiresAtMs,
} from "../chat-abort.js";
import { type ChatImageContent, parseMessageWithAttachments } from "../chat-attachments.js";
import { stripEnvelopeFromMessages } from "../chat-sanitize.js";
import { GATEWAY_CLIENT_CAPS, hasGatewayClientCap } from "../protocol/client-info.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateChatAbortParams,
  validateChatHistoryParams,
  validateChatInjectParams,
  validateChatSendParams,
} from "../protocol/index.js";
import { getMaxChatHistoryMessagesBytes } from "../server-constants.js";
import {
  capArrayByJsonBytes,
  loadSessionEntry,
  readSessionMessages,
  resolveSessionModelRef,
} from "../session-utils.js";
import { formatForLog } from "../ws-log.js";
import { injectTimestamp, timestampOptsFromConfig } from "./agent-timestamp.js";
import {
  startPerfTrace,
  recordPerfMeasurement,
  completePerfTrace,
} from "../../infra/perf-tracker.js";
import { resolveChatImagePath, loadChatImages } from "../../media/chat-image-store.js";
import { resolveChatVideoPath, loadChatVideos } from "../../media/chat-video-store.js";

/**
 * Rehydrate image URLs in tool result messages.
 * Checks if local image files still exist and marks them accordingly.
 */
function rehydrateGeneratedImages(messages: unknown[], sessionKey: string): void {
  const safeSK = sessionKey.replace(/[^a-zA-Z0-9_\-.]/g, "_");
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    const m = msg as Record<string, unknown>;

    // Check top-level details (tool result messages)
    rehydrateDetails(m.details, safeSK);

    // Check content array for tool_result blocks
    if (Array.isArray(m.content)) {
      for (const block of m.content) {
        if (!block || typeof block !== "object") continue;
        const b = block as Record<string, unknown>;
        rehydrateDetails(b.details, safeSK);
      }
    }
  }
}

function rehydrateDetails(details: unknown, fallbackSessionKey: string): void {
  if (!details || typeof details !== "object") return;
  const d = details as Record<string, unknown>;

  // Check imageUrl
  if (typeof d.imageUrl === "string") {
    const url = d.imageUrl as string;
    if (url.includes("/api/media/chat-images/")) {
      // Extract session key and image file from URL path:
      // /api/media/chat-images/<sessionKey>/<imageFile>
      const parts = url.split("/");
      const imageFile = parts[parts.length - 1];
      // The session key in the URL may differ from the top-level sessionKey
      // (e.g. "agent:main:uuid" vs "main"). Use the URL's key for lookup.
      const urlSessionKey = parts.length >= 2 ? parts[parts.length - 2] : undefined;
      const effectiveKey = urlSessionKey || fallbackSessionKey;
      if (imageFile) {
        const localPath = resolveChatImagePath(effectiveKey, imageFile);
        d.imageAvailable = localPath !== null;
      }
    }
  }

  // Check imageUrls array
  if (Array.isArray(d.imageUrls)) {
    let allAvailable = true;
    for (const url of d.imageUrls) {
      if (typeof url === "string" && url.includes("/api/media/chat-images/")) {
        const parts = (url as string).split("/");
        const imageFile = parts[parts.length - 1];
        const urlSK = parts.length >= 2 ? parts[parts.length - 2] : undefined;
        const effectiveKey = urlSK || fallbackSessionKey;
        if (imageFile && !resolveChatImagePath(effectiveKey, imageFile)) {
          allAvailable = false;
          break;
        }
      }
    }
    d.imageAvailable = allAvailable;
  }

  // Check videoUrl
  if (typeof d.videoUrl === "string") {
    const url = d.videoUrl as string;
    if (url.includes("/api/media/videos/")) {
      const parts = url.split("/");
      const videoFile = parts[parts.length - 1];
      if (videoFile) {
        const urlSK = parts.length >= 2 ? parts[parts.length - 2] : undefined;
        const localPath = resolveChatVideoPath(urlSK || fallbackSessionKey, videoFile);
        d.videoAvailable = localPath !== null;
      }
    }
  }
}

type TranscriptAppendResult = {
  ok: boolean;
  messageId?: string;
  message?: Record<string, unknown>;
  error?: string;
};

type AppendMessageArg = Parameters<SessionManager["appendMessage"]>[0];

function stripDisallowedChatControlChars(message: string): string {
  let output = "";
  for (const char of message) {
    const code = char.charCodeAt(0);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)) {
      output += char;
    }
  }
  return output;
}

export function sanitizeChatSendMessageInput(
  message: string,
): { ok: true; message: string } | { ok: false; error: string } {
  const normalized = message.normalize("NFC");
  if (normalized.includes("\u0000")) {
    return { ok: false, error: "message must not contain null bytes" };
  }
  return { ok: true, message: stripDisallowedChatControlChars(normalized) };
}

function resolveTranscriptPath(params: {
  sessionId: string;
  storePath: string | undefined;
  sessionFile?: string;
  agentId?: string;
}): string | null {
  const { sessionId, storePath, sessionFile, agentId } = params;
  if (!storePath && !sessionFile) {
    return null;
  }
  try {
    const sessionsDir = storePath ? path.dirname(storePath) : undefined;
    return resolveSessionFilePath(
      sessionId,
      sessionFile ? { sessionFile } : undefined,
      sessionsDir || agentId ? { sessionsDir, agentId } : undefined,
    );
  } catch {
    return null;
  }
}

function ensureTranscriptFile(params: { transcriptPath: string; sessionId: string }): {
  ok: boolean;
  error?: string;
} {
  if (fs.existsSync(params.transcriptPath)) {
    return { ok: true };
  }
  try {
    fs.mkdirSync(path.dirname(params.transcriptPath), { recursive: true });
    const header = {
      type: "session",
      version: CURRENT_SESSION_VERSION,
      id: params.sessionId,
      timestamp: new Date().toISOString(),
      cwd: process.cwd(),
    };
    fs.writeFileSync(params.transcriptPath, `${JSON.stringify(header)}\n`, "utf-8");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function appendAssistantTranscriptMessage(params: {
  message: string;
  label?: string;
  sessionId: string;
  storePath: string | undefined;
  sessionFile?: string;
  agentId?: string;
  createIfMissing?: boolean;
}): TranscriptAppendResult {
  const transcriptPath = resolveTranscriptPath({
    sessionId: params.sessionId,
    storePath: params.storePath,
    sessionFile: params.sessionFile,
    agentId: params.agentId,
  });
  if (!transcriptPath) {
    return { ok: false, error: "transcript path not resolved" };
  }

  if (!fs.existsSync(transcriptPath)) {
    if (!params.createIfMissing) {
      return { ok: false, error: "transcript file not found" };
    }
    const ensured = ensureTranscriptFile({
      transcriptPath,
      sessionId: params.sessionId,
    });
    if (!ensured.ok) {
      return { ok: false, error: ensured.error ?? "failed to create transcript file" };
    }
  }

  const now = Date.now();
  const labelPrefix = params.label ? `[${params.label}]\n\n` : "";
  const usage = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
  };
  const messageBody: AppendMessageArg & Record<string, unknown> = {
    role: "assistant",
    content: [{ type: "text", text: `${labelPrefix}${params.message}` }],
    timestamp: now,
    // Pi stopReason is a strict enum; this is not model output, but we still store it as a
    // normal assistant message so it participates in the session parentId chain.
    stopReason: "stop",
    usage,
    // Make these explicit so downstream tooling never treats this as model output.
    api: "openai-responses",
    provider: "openclawcn",
    model: "gateway-injected",
  };

  try {
    // IMPORTANT: Use SessionManager so the entry is attached to the current leaf via parentId.
    // Raw jsonl appends break the parent chain and can hide compaction summaries from context.
    const sessionManager = SessionManager.open(transcriptPath);
    const messageId = sessionManager.appendMessage(messageBody);
    return { ok: true, messageId, message: messageBody };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function nextChatSeq(context: { agentRunSeq: Map<string, number> }, runId: string) {
  const next = (context.agentRunSeq.get(runId) ?? 0) + 1;
  context.agentRunSeq.set(runId, next);
  return next;
}

function broadcastChatFinal(params: {
  context: Pick<GatewayRequestContext, "broadcast" | "nodeSendToSession" | "agentRunSeq">;
  runId: string;
  sessionKey: string;
  message?: Record<string, unknown>;
  ttsAudioBase64?: string;
  ttsFormat?: string;
}) {
  const seq = nextChatSeq({ agentRunSeq: params.context.agentRunSeq }, params.runId);
  const payload: Record<string, unknown> = {
    runId: params.runId,
    sessionKey: params.sessionKey,
    seq,
    state: "final" as const,
    message: params.message,
  };
  // Attach TTS audio for web UI auto-playback (Siri-style)
  if (params.ttsAudioBase64) {
    payload.ttsAudio = {
      base64: params.ttsAudioBase64,
      format: params.ttsFormat ?? "wav",
    };
  }
  params.context.broadcast("chat", payload);
  params.context.nodeSendToSession(params.sessionKey, "chat", payload);
  params.context.agentRunSeq.delete(params.runId);
}

function broadcastChatError(params: {
  context: Pick<GatewayRequestContext, "broadcast" | "nodeSendToSession" | "agentRunSeq">;
  runId: string;
  sessionKey: string;
  errorMessage?: string;
}) {
  const seq = nextChatSeq({ agentRunSeq: params.context.agentRunSeq }, params.runId);
  const payload = {
    runId: params.runId,
    sessionKey: params.sessionKey,
    seq,
    state: "error" as const,
    errorMessage: params.errorMessage,
  };
  params.context.broadcast("chat", payload);
  params.context.nodeSendToSession(params.sessionKey, "chat", payload);
  params.context.agentRunSeq.delete(params.runId);
}

export const chatHandlers: GatewayRequestHandlers = {
  "chat.history": async ({ params, respond, context }) => {
    if (!validateChatHistoryParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid chat.history params: ${formatValidationErrors(validateChatHistoryParams.errors)}`,
        ),
      );
      return;
    }
    const { sessionKey, limit } = params as {
      sessionKey: string;
      limit?: number;
    };
    const { cfg, storePath, entry } = loadSessionEntry(sessionKey);
    const sessionId = entry?.sessionId;
    const rawMessages =
      sessionId && storePath ? readSessionMessages(sessionId, storePath, entry?.sessionFile) : [];
    const hardMax = 1000;
    const defaultLimit = 200;
    const requested = typeof limit === "number" ? limit : defaultLimit;
    const max = Math.min(hardMax, requested);
    const sliced = rawMessages.length > max ? rawMessages.slice(-max) : rawMessages;
    const sanitized = stripEnvelopeFromMessages(sliced);
    const capped = capArrayByJsonBytes(sanitized, getMaxChatHistoryMessagesBytes()).items;

    // Rehydrate generated image URLs — check if local files still exist
    rehydrateGeneratedImages(capped, sessionKey);

    let thinkingLevel = entry?.thinkingLevel;
    if (!thinkingLevel) {
      const configured = cfg.agents?.defaults?.thinkingDefault;
      if (configured) {
        thinkingLevel = configured;
      } else {
        const sessionAgentId = resolveSessionAgentId({ sessionKey, config: cfg });
        const { provider, model } = resolveSessionModelRef(cfg, entry, sessionAgentId);
        const catalog = await context.loadGatewayModelCatalog();
        thinkingLevel = resolveThinkingDefault({
          cfg,
          provider,
          model,
          catalog,
        });
      }
    }
    const verboseLevel = entry?.verboseLevel ?? cfg.agents?.defaults?.verboseDefault;
    respond(true, {
      sessionKey,
      sessionId,
      messages: capped,
      thinkingLevel,
      verboseLevel,
    });
  },
  "chat.abort": ({ params, respond, context }) => {
    if (!validateChatAbortParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid chat.abort params: ${formatValidationErrors(validateChatAbortParams.errors)}`,
        ),
      );
      return;
    }
    const { sessionKey, runId } = params as {
      sessionKey: string;
      runId?: string;
    };

    const ops = {
      chatAbortControllers: context.chatAbortControllers,
      chatRunBuffers: context.chatRunBuffers,
      chatDeltaSentAt: context.chatDeltaSentAt,
      chatAbortedRuns: context.chatAbortedRuns,
      removeChatRun: context.removeChatRun,
      agentRunSeq: context.agentRunSeq,
      broadcast: context.broadcast,
      nodeSendToSession: context.nodeSendToSession,
    };

    if (!runId) {
      const res = abortChatRunsForSessionKey(ops, {
        sessionKey,
        stopReason: "rpc",
      });
      respond(true, { ok: true, aborted: res.aborted, runIds: res.runIds });
      return;
    }

    const active = context.chatAbortControllers.get(runId);
    if (!active) {
      respond(true, { ok: true, aborted: false, runIds: [] });
      return;
    }
    if (active.sessionKey !== sessionKey) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "runId does not match sessionKey"),
      );
      return;
    }

    const res = abortChatRunById(ops, {
      runId,
      sessionKey,
      stopReason: "rpc",
    });
    respond(true, {
      ok: true,
      aborted: res.aborted,
      runIds: res.aborted ? [runId] : [],
    });
  },
  "chat.send": async ({ params, respond, context, client }) => {
    if (!validateChatSendParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid chat.send params: ${formatValidationErrors(validateChatSendParams.errors)}`,
        ),
      );
      return;
    }
    const p = params as {
      sessionKey: string;
      message: string;
      thinking?: string;
      deliver?: boolean;
      attachments?: Array<{
        type?: string;
        mimeType?: string;
        fileName?: string;
        content?: unknown;
      }>;
      timeoutMs?: number;
      idempotencyKey: string;
      /** True when the message originated from voice input (ASR). Enables TTS on response. */
      voiceInput?: boolean;
      /** True when the UI is in continuous voice conversation mode. Triggers conversational system prompt. */
      voiceMode?: boolean;
    };
    const sanitizedMessageResult = sanitizeChatSendMessageInput(p.message);
    if (!sanitizedMessageResult.ok) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, sanitizedMessageResult.error),
      );
      return;
    }
    const inboundMessage = sanitizedMessageResult.message;
    const stopCommand = isChatStopCommandText(inboundMessage);
    const normalizedAttachments =
      p.attachments
        ?.map((a) => ({
          type: typeof a?.type === "string" ? a.type : undefined,
          mimeType: typeof a?.mimeType === "string" ? a.mimeType : undefined,
          fileName: typeof a?.fileName === "string" ? a.fileName : undefined,
          content:
            typeof a?.content === "string"
              ? a.content
              : ArrayBuffer.isView(a?.content)
                ? Buffer.from(
                    a.content.buffer,
                    a.content.byteOffset,
                    a.content.byteLength,
                  ).toString("base64")
                : undefined,
        }))
        .filter((a) => a.content) ?? [];
    const rawMessage = inboundMessage.trim();
    if (!rawMessage && normalizedAttachments.length === 0) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "message or attachment required"),
      );
      return;
    }
    let parsedMessage = inboundMessage;
    let parsedImages: ChatImageContent[] = [];
    if (normalizedAttachments.length > 0) {
      try {
        const parsed = await parseMessageWithAttachments(inboundMessage, normalizedAttachments, {
          maxBytes: 5_000_000,
          log: context.logGateway,
        });
        parsedMessage = parsed.message;
        parsedImages = parsed.images;
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, String(err)));
        return;
      }
    }
    const rawSessionKey = p.sessionKey;
    const { cfg, entry, canonicalKey: sessionKey } = loadSessionEntry(rawSessionKey);
    const timeoutMs = resolveAgentTimeoutMs({
      cfg,
      overrideMs: p.timeoutMs,
    });
    const now = Date.now();
    const clientRunId = p.idempotencyKey;

    const sendPolicy = resolveSendPolicy({
      cfg,
      entry,
      sessionKey,
      channel: entry?.channel,
      chatType: entry?.chatType,
    });
    if (sendPolicy === "deny") {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "send blocked by session policy"),
      );
      return;
    }

    if (stopCommand) {
      const res = abortChatRunsForSessionKey(
        {
          chatAbortControllers: context.chatAbortControllers,
          chatRunBuffers: context.chatRunBuffers,
          chatDeltaSentAt: context.chatDeltaSentAt,
          chatAbortedRuns: context.chatAbortedRuns,
          removeChatRun: context.removeChatRun,
          agentRunSeq: context.agentRunSeq,
          broadcast: context.broadcast,
          nodeSendToSession: context.nodeSendToSession,
        },
        { sessionKey: rawSessionKey, stopReason: "stop" },
      );
      respond(true, { ok: true, aborted: res.aborted, runIds: res.runIds });
      return;
    }

    const cached = context.dedupe.get(`chat:${clientRunId}`);
    if (cached) {
      respond(cached.ok, cached.payload, cached.error, {
        cached: true,
      });
      return;
    }

    const activeExisting = context.chatAbortControllers.get(clientRunId);
    if (activeExisting) {
      respond(true, { runId: clientRunId, status: "in_flight" as const }, undefined, {
        cached: true,
        runId: clientRunId,
      });
      return;
    }

    try {
      // 🔍 Performance Tracking 开始
      startPerfTrace(clientRunId, {
        sessionKey: rawSessionKey,
        messageLength: parsedMessage.length,
        attachmentsCount: normalizedAttachments.length,
      });
      recordPerfMeasurement(clientRunId, "request_received");

      // 🔍 DEBUG: 日志1 - chat.send 请求开始
      context.logGateway.info(
        `[DEBUG-CHAT] chat.send START: runId=${clientRunId}, sessionKey=${rawSessionKey}, message="${parsedMessage.slice(0, 50)}${parsedMessage.length > 50 ? "..." : ""}", attachments=${normalizedAttachments.length}`,
      );

      const abortController = new AbortController();
      context.chatAbortControllers.set(clientRunId, {
        controller: abortController,
        sessionId: entry?.sessionId ?? clientRunId,
        sessionKey: rawSessionKey,
        startedAtMs: now,
        expiresAtMs: resolveChatRunExpiresAtMs({ now, timeoutMs }),
      });
      const ackPayload = {
        runId: clientRunId,
        status: "started" as const,
      };

      // 🔍 DEBUG: 日志2 - 发送 ACK 响应给前端
      context.logGateway.info(
        `[DEBUG-CHAT] Sending ACK to client: runId=${clientRunId}, status=started`,
      );
      respond(true, ackPayload, undefined, { runId: clientRunId });

      recordPerfMeasurement(clientRunId, "agent_session_load");

      const trimmedMessage = parsedMessage.trim();
      const injectThinking = Boolean(
        p.thinking && trimmedMessage && !trimmedMessage.startsWith("/"),
      );
      const commandBody = injectThinking ? `/think ${p.thinking} ${parsedMessage}` : parsedMessage;
      const clientInfo = client?.connect?.client;
      // Inject timestamp so agents know the current date/time.
      // Only BodyForAgent gets the timestamp — Body stays raw for UI display.
      // See: https://github.com/moltbot/moltbot/issues/3658
      const stampedMessage = injectTimestamp(parsedMessage, timestampOptsFromConfig(cfg));

      const ctx: MsgContext = {
        Body: parsedMessage,
        BodyForAgent: stampedMessage,
        BodyForCommands: commandBody,
        RawBody: parsedMessage,
        CommandBody: commandBody,
        SessionKey: sessionKey,
        Provider: INTERNAL_MESSAGE_CHANNEL,
        Surface: INTERNAL_MESSAGE_CHANNEL,
        OriginatingChannel: INTERNAL_MESSAGE_CHANNEL,
        ChatType: "direct",
        CommandAuthorized: true,
        MessageSid: clientRunId,
        SenderId: clientInfo?.id,
        SenderName: clientInfo?.displayName,
        SenderUsername: clientInfo?.displayName,
        GatewayClientScopes: client?.connect?.scopes,
        // Voice input flag: enables TTS on response (tts.auto = "inbound" mode)
        ...(p.voiceInput ? { MediaType: "audio" } : {}),
        // Voice conversation mode: triggers conversational system prompt
        ...(p.voiceMode ? { VoiceMode: true } : {}),
      };

      if (p.voiceMode) {
        context.logGateway.info(`[chat.send] voiceMode=true for run ${clientRunId}`);
      }

      const agentId = resolveSessionAgentId({
        sessionKey,
        config: cfg,
      });
      const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
        cfg,
        agentId,
        channel: INTERNAL_MESSAGE_CHANNEL,
      });
      const finalReplyParts: string[] = [];
      let ttsMediaUrl: string | undefined;
      const dispatcher = createReplyDispatcher({
        ...prefixOptions,
        onError: (err) => {
          context.logGateway.warn(`webchat dispatch failed: ${formatForLog(err)}`);
        },
        deliver: async (payload, info) => {
          if (info.kind !== "final") {
            return;
          }
          // Capture TTS audio path if present (generated by maybeApplyTtsToPayload)
          if (payload.mediaUrl && !ttsMediaUrl) {
            ttsMediaUrl = payload.mediaUrl;
            // Also store in shared state so emitChatFinal (agent-run path) can read it
            context.chatTtsMediaUrls.set(clientRunId, payload.mediaUrl);
          }
          const text = payload.text?.trim() ?? "";
          if (!text) {
            return;
          }
          finalReplyParts.push(text);
        },
      });

      // Track voice-input runs so emitChatFinal can generate TTS for agent-run path
      if (p.voiceInput) {
        context.chatVoiceInputRuns.set(clientRunId, true);
      }

      let agentRunStarted = false;

      // 🔍 DEBUG: 日志3 - 开始调用 dispatchInboundMessage
      context.logGateway.info(
        `[DEBUG-CHAT] About to call dispatchInboundMessage: runId=${clientRunId}, sessionKey=${sessionKey}, agentId=${agentId}`,
      );

      recordPerfMeasurement(clientRunId, "dispatch_start", { agentId });

      void dispatchInboundMessage({
        ctx,
        cfg,
        dispatcher,
        replyOptions: {
          runId: clientRunId,
          abortSignal: abortController.signal,
          images: parsedImages.length > 0 ? parsedImages : undefined,
          disableBlockStreaming: true,
          onAgentRunStart: (runId) => {
            agentRunStarted = true;
            recordPerfMeasurement(clientRunId, "agent_run_start", { agentRunId: runId });
            // 🔍 DEBUG: 日志4 - Agent 运行已启动
            context.logGateway.info(
              `[DEBUG-CHAT] Agent run started: agentRunId=${runId}, clientRunId=${clientRunId}`,
            );
            // Map agent-internal runId → UI clientRunId so createAgentEventHandler
            // can broadcast chat deltas/finals with the correct runId that the UI
            // is waiting for.  Without this mapping, the UI receives events with
            // mismatched runId and ignores them, resulting in empty responses.
            context.addChatRun(runId, {
              sessionKey: rawSessionKey,
              clientRunId,
            });
            const connId = typeof client?.connId === "string" ? client.connId : undefined;
            const wantsToolEvents = hasGatewayClientCap(
              client?.connect?.caps,
              GATEWAY_CLIENT_CAPS.TOOL_EVENTS,
            );
            if (connId && wantsToolEvents) {
              context.registerToolEventRecipient(runId, connId);
              // Register for any other active runs *in the same session* so
              // late-joining clients (e.g. page refresh mid-response) receive
              // in-progress tool events without leaking cross-session data.
              for (const [activeRunId, active] of context.chatAbortControllers) {
                if (activeRunId !== runId && active.sessionKey === p.sessionKey) {
                  context.registerToolEventRecipient(activeRunId, connId);
                }
              }
            }
          },
          onModelSelected,
        },
      })
        .then(() => {
          recordPerfMeasurement(clientRunId, "agent_run_complete");
          // 🔍 DEBUG: 日志5 - dispatchInboundMessage 执行完成
          context.logGateway.info(
            `[DEBUG-CHAT] dispatchInboundMessage COMPLETED: runId=${clientRunId}, agentRunStarted=${agentRunStarted}, finalReplyParts=${finalReplyParts.length}`,
          );

          if (!agentRunStarted) {
            const combinedReply = finalReplyParts
              .map((part) => part.trim())
              .filter(Boolean)
              .join("\n\n")
              .trim();
            let message: Record<string, unknown> | undefined;
            if (combinedReply) {
              const { storePath: latestStorePath, entry: latestEntry } =
                loadSessionEntry(sessionKey);
              const sessionId = latestEntry?.sessionId ?? entry?.sessionId ?? clientRunId;
              const appended = appendAssistantTranscriptMessage({
                message: combinedReply,
                sessionId,
                storePath: latestStorePath,
                sessionFile: latestEntry?.sessionFile,
                agentId,
                createIfMissing: true,
              });
              if (appended.ok) {
                message = appended.message;
              } else {
                context.logGateway.warn(
                  `webchat transcript append failed: ${appended.error ?? "unknown error"}`,
                );
                const now = Date.now();
                message = {
                  role: "assistant",
                  content: [{ type: "text", text: combinedReply }],
                  timestamp: now,
                  // Keep this compatible with Pi stopReason enums even though this message isn't
                  // persisted to the transcript due to the append failure.
                  stopReason: "stop",
                  usage: { input: 0, output: 0, totalTokens: 0 },
                };
              }
            }
            // 🔍 DEBUG: 日志6 - 广播 final 消息
            context.logGateway.info(
              `[DEBUG-CHAT] Broadcasting chat FINAL: runId=${clientRunId}, hasMessage=${!!message}, combinedReplyLength=${combinedReply.length}`,
            );

            recordPerfMeasurement(clientRunId, "agent_response_process", { hasMessage: !!message });

            // Read TTS audio file and convert to base64 for web UI playback
            let ttsAudioBase64: string | undefined;
            let ttsFormat: string | undefined;
            if (ttsMediaUrl) {
              try {
                const audioBuffer = fs.readFileSync(ttsMediaUrl);
                ttsAudioBase64 = audioBuffer.toString("base64");
                ttsFormat = ttsMediaUrl.endsWith(".mp3")
                  ? "mp3"
                  : ttsMediaUrl.endsWith(".opus")
                    ? "opus"
                    : "wav";
              } catch {
                context.logGateway.warn(`TTS audio file read failed: ${ttsMediaUrl}`);
              }
            }

            broadcastChatFinal({
              context,
              runId: clientRunId,
              sessionKey: rawSessionKey,
              message,
              ttsAudioBase64,
              ttsFormat,
            });
          }
          context.dedupe.set(`chat:${clientRunId}`, {
            ts: Date.now(),
            ok: true,
            payload: { runId: clientRunId, status: "ok" as const },
          });
        })
        .catch((err) => {
          // 🔍 DEBUG: 日志7 - dispatchInboundMessage 捕获到错误
          context.logGateway.error(
            `[DEBUG-CHAT] dispatchInboundMessage CATCH ERROR: runId=${clientRunId}, error=${String(err)}, stack=${err instanceof Error ? err.stack : "N/A"}`,
          );

          const error = errorShape(ErrorCodes.UNAVAILABLE, String(err));
          context.dedupe.set(`chat:${clientRunId}`, {
            ts: Date.now(),
            ok: false,
            payload: {
              runId: clientRunId,
              status: "error" as const,
              summary: String(err),
            },
            error,
          });

          // 🔍 DEBUG: 日志8 - 广播错误消息
          context.logGateway.info(
            `[DEBUG-CHAT] Broadcasting chat ERROR: runId=${clientRunId}, errorMessage=${String(err).slice(0, 200)}`,
          );

          broadcastChatError({
            context,
            runId: clientRunId,
            sessionKey: rawSessionKey,
            errorMessage: String(err),
          });
        })
        .finally(() => {
          // 🔍 完成性能追踪
          completePerfTrace(clientRunId, { completed: true });
          // 🔍 DEBUG: 日志9 - finally 块执行，清理资源
          context.logGateway.info(
            `[DEBUG-CHAT] dispatchInboundMessage FINALLY: runId=${clientRunId}, cleaning up abortController`,
          );
          context.chatAbortControllers.delete(clientRunId);
          // Safety cleanup: ensure voiceInputRuns doesn't leak
          context.chatVoiceInputRuns.delete(clientRunId);
        });
    } catch (err) {
      // 🔍 DEBUG: 日志10 - 外层 try-catch 捕获到同步错误
      context.logGateway.error(
        `[DEBUG-CHAT] OUTER TRY-CATCH ERROR: runId=${clientRunId}, error=${String(err)}, stack=${err instanceof Error ? err.stack : "N/A"}`,
      );

      const error = errorShape(ErrorCodes.UNAVAILABLE, String(err));
      const payload = {
        runId: clientRunId,
        status: "error" as const,
        summary: String(err),
      };
      context.dedupe.set(`chat:${clientRunId}`, {
        ts: Date.now(),
        ok: false,
        payload,
        error,
      });

      // 🔍 DEBUG: 日志11 - 发送错误响应给前端
      context.logGateway.info(
        `[DEBUG-CHAT] Sending ERROR response to client: runId=${clientRunId}, error=${String(err).slice(0, 200)}`,
      );

      respond(false, payload, error, {
        runId: clientRunId,
        error: formatForLog(err),
      });
    }
  },
  "chat.inject": async ({ params, respond, context }) => {
    if (!validateChatInjectParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid chat.inject params: ${formatValidationErrors(validateChatInjectParams.errors)}`,
        ),
      );
      return;
    }
    const p = params as {
      sessionKey: string;
      message: string;
      label?: string;
    };

    // Load session to find transcript file
    const rawSessionKey = p.sessionKey;
    const { cfg, storePath, entry } = loadSessionEntry(rawSessionKey);
    const sessionId = entry?.sessionId;
    if (!sessionId || !storePath) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "session not found"));
      return;
    }

    const appended = appendAssistantTranscriptMessage({
      message: p.message,
      label: p.label,
      sessionId,
      storePath,
      sessionFile: entry?.sessionFile,
      agentId: resolveSessionAgentId({ sessionKey: rawSessionKey, config: cfg }),
      createIfMissing: false,
    });
    if (!appended.ok || !appended.messageId || !appended.message) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `failed to write transcript: ${appended.error ?? "unknown error"}`,
        ),
      );
      return;
    }

    // Broadcast to webchat for immediate UI update
    const chatPayload = {
      runId: `inject-${appended.messageId}`,
      sessionKey: rawSessionKey,
      seq: 0,
      state: "final" as const,
      message: appended.message,
    };
    context.broadcast("chat", chatPayload);
    context.nodeSendToSession(rawSessionKey, "chat", chatPayload);

    respond(true, { ok: true, messageId: appended.messageId });
  },
  "media.list": async ({ params, respond }) => {
    const rawSessionKey = typeof params.sessionKey === "string" ? params.sessionKey : "";
    if (!rawSessionKey) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "sessionKey required"));
      return;
    }
    // Normalize the session key: bare UUIDs (from URL params) need the
    // "agent:<id>:" prefix so the media stores find the correct directory.
    const { canonicalKey } = loadSessionEntry(rawSessionKey);
    const sessionKey = canonicalKey || rawSessionKey;
    try {
      const [images, videos] = await Promise.all([
        loadChatImages(sessionKey),
        loadChatVideos(sessionKey),
      ]);
      const assets = [
        ...images.map((img) => ({
          id: img.id,
          type: "image" as const,
          url: `/api/media/chat-images/${encodeURIComponent(sessionKey)}/${encodeURIComponent(img.file)}`,
          name: img.file,
          size: img.sizeBytes,
          createdAt: new Date(img.createdAt).getTime(),
          sessionKey,
        })),
        ...videos.map((vid) => ({
          id: vid.id,
          type: "video" as const,
          url: `/api/media/videos/${encodeURIComponent(sessionKey)}/${encodeURIComponent(vid.file)}`,
          name: vid.file,
          size: vid.sizeBytes,
          createdAt: new Date(vid.createdAt).getTime(),
          sessionKey,
        })),
      ];
      // Sort by creation time descending (newest first)
      assets.sort((a, b) => b.createdAt - a.createdAt);
      respond(true, { assets });
    } catch {
      respond(true, { assets: [] });
    }
  },
};
