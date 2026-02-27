import { readFileSync } from "node:fs";
import { normalizeVerboseLevel } from "../auto-reply/thinking.js";
import { isSilentReplyText, SILENT_REPLY_TOKEN } from "../auto-reply/tokens.js";
import { loadConfig } from "../config/config.js";
import { type AgentEventPayload, getAgentRunContext } from "../infra/agent-events.js";
import { resolveHeartbeatVisibility } from "../infra/heartbeat-visibility.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { maybeApplyTtsToPayload } from "../tts/tts.js";
import { isStreamTtsAvailable, unifiedStreamSynthesize } from "../voice/voice-router.js";
import { loadSessionEntry } from "./session-utils.js";
import { formatForLog } from "./ws-log.js";

const chatLog = createSubsystemLogger("gateway/server-chat");

/**
 * Check if webchat broadcasts should be suppressed for heartbeat runs.
 * Returns true if the run is a heartbeat and showOk is false.
 */
function shouldSuppressHeartbeatBroadcast(runId: string): boolean {
  const runContext = getAgentRunContext(runId);
  if (!runContext?.isHeartbeat) {
    return false;
  }

  try {
    const cfg = loadConfig();
    const visibility = resolveHeartbeatVisibility({ cfg, channel: "webchat" });
    return !visibility.showOk;
  } catch {
    // Default to suppressing if we can't load config
    return true;
  }
}

export type ChatRunEntry = {
  sessionKey: string;
  clientRunId: string;
};

export type ChatRunRegistry = {
  add: (sessionId: string, entry: ChatRunEntry) => void;
  peek: (sessionId: string) => ChatRunEntry | undefined;
  shift: (sessionId: string) => ChatRunEntry | undefined;
  remove: (sessionId: string, clientRunId: string, sessionKey?: string) => ChatRunEntry | undefined;
  clear: () => void;
};

export function createChatRunRegistry(): ChatRunRegistry {
  const chatRunSessions = new Map<string, ChatRunEntry[]>();

  const add = (sessionId: string, entry: ChatRunEntry) => {
    const queue = chatRunSessions.get(sessionId);
    if (queue) {
      queue.push(entry);
    } else {
      chatRunSessions.set(sessionId, [entry]);
    }
  };

  const peek = (sessionId: string) => chatRunSessions.get(sessionId)?.[0];

  const shift = (sessionId: string) => {
    const queue = chatRunSessions.get(sessionId);
    if (!queue || queue.length === 0) {
      return undefined;
    }
    const entry = queue.shift();
    if (!queue.length) {
      chatRunSessions.delete(sessionId);
    }
    return entry;
  };

  const remove = (sessionId: string, clientRunId: string, sessionKey?: string) => {
    const queue = chatRunSessions.get(sessionId);
    if (!queue || queue.length === 0) {
      return undefined;
    }
    const idx = queue.findIndex(
      (entry) =>
        entry.clientRunId === clientRunId && (sessionKey ? entry.sessionKey === sessionKey : true),
    );
    if (idx < 0) {
      return undefined;
    }
    const [entry] = queue.splice(idx, 1);
    if (!queue.length) {
      chatRunSessions.delete(sessionId);
    }
    return entry;
  };

  const clear = () => {
    chatRunSessions.clear();
  };

  return { add, peek, shift, remove, clear };
}

/** Sentence buffer for streaming TTS: tracks how far we've synthesized. */
export type TtsSentenceBuffer = {
  /** Cursor: index up to which text has already been submitted for TTS. */
  cursor: number;
  /** Running chunk index for tts.chunk events. */
  chunkIndex: number;
  /** Whether streaming TTS is active for this run. */
  active: boolean;
  /** Timestamp of last TTS fire (for time-based fallback). */
  lastFireAt: number;
};

export type ChatRunState = {
  registry: ChatRunRegistry;
  buffers: Map<string, string>;
  deltaSentAt: Map<string, number>;
  abortedRuns: Map<string, number>;
  /** TTS audio file paths keyed by clientRunId, set by deliver callback. */
  ttsMediaUrls: Map<string, string>;
  /** Tracks runs where the inbound message was voice input (enables TTS on response). */
  voiceInputRuns: Map<string, boolean>;
  /** Streaming TTS sentence buffers per clientRunId. */
  ttsSentenceBuffers: Map<string, TtsSentenceBuffer>;
  clear: () => void;
};

export function createChatRunState(): ChatRunState {
  const registry = createChatRunRegistry();
  const buffers = new Map<string, string>();
  const deltaSentAt = new Map<string, number>();
  const abortedRuns = new Map<string, number>();
  const ttsMediaUrls = new Map<string, string>();
  const voiceInputRuns = new Map<string, boolean>();
  const ttsSentenceBuffers = new Map<string, TtsSentenceBuffer>();

  const clear = () => {
    registry.clear();
    buffers.clear();
    deltaSentAt.clear();
    abortedRuns.clear();
    ttsMediaUrls.clear();
    voiceInputRuns.clear();
    ttsSentenceBuffers.clear();
  };

  return {
    registry,
    buffers,
    deltaSentAt,
    abortedRuns,
    ttsMediaUrls,
    voiceInputRuns,
    ttsSentenceBuffers,
    clear,
  };
}

export type ToolEventRecipientRegistry = {
  add: (runId: string, connId: string) => void;
  get: (runId: string) => ReadonlySet<string> | undefined;
  markFinal: (runId: string) => void;
};

type ToolRecipientEntry = {
  connIds: Set<string>;
  updatedAt: number;
  finalizedAt?: number;
};

const TOOL_EVENT_RECIPIENT_TTL_MS = 10 * 60 * 1000;
const TOOL_EVENT_RECIPIENT_FINAL_GRACE_MS = 30 * 1000;

export function createToolEventRecipientRegistry(): ToolEventRecipientRegistry {
  const recipients = new Map<string, ToolRecipientEntry>();

  const prune = () => {
    if (recipients.size === 0) {
      return;
    }
    const now = Date.now();
    for (const [runId, entry] of recipients) {
      const cutoff = entry.finalizedAt
        ? entry.finalizedAt + TOOL_EVENT_RECIPIENT_FINAL_GRACE_MS
        : entry.updatedAt + TOOL_EVENT_RECIPIENT_TTL_MS;
      if (now >= cutoff) {
        recipients.delete(runId);
      }
    }
  };

  const add = (runId: string, connId: string) => {
    if (!runId || !connId) {
      return;
    }
    const now = Date.now();
    const existing = recipients.get(runId);
    if (existing) {
      existing.connIds.add(connId);
      existing.updatedAt = now;
    } else {
      recipients.set(runId, {
        connIds: new Set([connId]),
        updatedAt: now,
      });
    }
    prune();
  };

  const get = (runId: string) => {
    const entry = recipients.get(runId);
    if (!entry) {
      return undefined;
    }
    entry.updatedAt = Date.now();
    prune();
    return entry.connIds;
  };

  const markFinal = (runId: string) => {
    const entry = recipients.get(runId);
    if (!entry) {
      return;
    }
    entry.finalizedAt = Date.now();
    prune();
  };

  return { add, get, markFinal };
}

export type ChatEventBroadcast = (
  event: string,
  payload: unknown,
  opts?: { dropIfSlow?: boolean },
) => void;

export type NodeSendToSession = (sessionKey: string, event: string, payload: unknown) => void;

export type AgentEventHandlerOptions = {
  broadcast: ChatEventBroadcast;
  broadcastToConnIds: (
    event: string,
    payload: unknown,
    connIds: ReadonlySet<string>,
    opts?: { dropIfSlow?: boolean },
  ) => void;
  nodeSendToSession: NodeSendToSession;
  agentRunSeq: Map<string, number>;
  chatRunState: ChatRunState;
  resolveSessionKeyForRun: (runId: string) => string | undefined;
  clearAgentRunContext: (runId: string) => void;
  toolEventRecipients: ToolEventRecipientRegistry;
};

export function createAgentEventHandler({
  broadcast,
  broadcastToConnIds,
  nodeSendToSession,
  agentRunSeq,
  chatRunState,
  resolveSessionKeyForRun,
  clearAgentRunContext,
  toolEventRecipients,
}: AgentEventHandlerOptions) {
  // Sentence-level boundary detection for streaming TTS.
  // Only split on sentence-ending punctuation so each TTS call gets a complete sentence
  // with proper intonation. Commas/colons are NOT boundaries — splitting there causes
  // unnatural pauses, inconsistent speaker voice, and broken prosody.
  const SENTENCE_ENDS = new Set(["。", "！", "？", ".", "!", "?", "\n"]);
  const MIN_TTS_LENGTH = 4;
  /** If no sentence-ending punctuation appears within this time (ms), force-fire TTS on accumulated text. */
  const TTS_FORCE_FLUSH_MS = 4000;

  /**
   * Strip markdown / non-speakable content so CosyVoice2 only gets plain Chinese/English text.
   */
  const cleanTextForTts = (text: string): string => {
    let s = text;
    // Remove entire markdown table lines (separator rows AND data rows).
    // Tables are not suitable for TTS — they produce "次数，时间，问题" gibberish.
    s = s.replace(/^[ \t]*\|.*\|[ \t]*$/gm, "");
    // Remove any remaining stray pipe characters
    s = s.replace(/\|/g, "");
    // Remove markdown heading markers
    s = s.replace(/#{1,6}\s*/g, "");
    // Remove bold/italic markers
    s = s.replace(/\*{1,3}/g, "");
    // Remove markdown horizontal rules
    s = s.replace(/^-{3,}$/gm, "");
    // Remove markdown list markers at start of line
    s = s.replace(/^[\s]*[-*+]\s+/gm, "");
    // Remove markdown links: [text](url) → text
    s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    // Remove bare URLs
    s = s.replace(/https?:\/\/\S+/g, "");
    // Remove code blocks and inline code
    s = s.replace(/```[\s\S]*?```/g, "");
    s = s.replace(/`[^`]*`/g, "");
    // Remove emoji (supplementary Unicode planes)
    s = s.replace(/[\u{10000}-\u{10FFFF}]/gu, "");
    // Remove check marks, arrows, bullets, box-drawing, and misc BMP symbols/emoji
    s = s.replace(
      /[✓✗✔✘→←↑↓•·‣⬤▶►▷▸☐☑☒★☆♠♣♥♦✅❌❎⭐⭕❗❓❕❔⚠️⬆⬇⬅➡⚡☀☁☂☃☎☞☝✊✋✌✍✏✒✉✈✂✃⌛⌚⚽⚾⛄⛅⛔⛳⛵⛺⛲⚓⚒⚙⚖⚗⚛⚜⚰⚱♻♿⚫⚪🔴🔵🟢🟡🟠🔶🔷]/g,
      "",
    );
    // Remove remaining common emoji in Dingbats/Misc Symbols/Enclosed ranges (U+2000–U+2BFF)
    s = s.replace(/[\u2100-\u27FF\u2B00-\u2BFF]/g, "");
    // Remove non-CJK/non-Latin/non-punctuation characters (Korean, Thai, etc.)
    // Keep: Chinese (CJK), ASCII, common CJK punctuation, Latin extended
    s = s.replace(/[\u{AC00}-\u{D7AF}\u{1100}-\u{11FF}]/gu, ""); // Korean
    // Collapse multiple commas/spaces
    s = s.replace(/[，,]{2,}/g, "，");
    s = s.replace(/\s{2,}/g, " ");
    return s.trim();
  };

  /**
   * Fire streaming TTS for a sentence segment. Non-blocking.
   */
  const fireStreamTts = (
    sessionKey: string,
    clientRunId: string,
    sentence: string,
    sentenceBuffer: TtsSentenceBuffer,
  ) => {
    const cleaned = cleanTextForTts(sentence);
    chatLog.info(
      `[stream-tts] fireStreamTts: cleaned="${cleaned.slice(0, 40)}" len=${cleaned.length}`,
    );
    if (cleaned.length < MIN_TTS_LENGTH) {
      chatLog.info(`[stream-tts] skipped (too short: ${cleaned.length} < ${MIN_TTS_LENGTH})`);
      return;
    }
    unifiedStreamSynthesize(cleaned, (audioBase64, format, index) => {
      chatLog.info(`[stream-tts] onChunk index=${index}, b64len=${audioBase64.length}`);
      const ttsPayload = {
        event: "tts.chunk",
        runId: clientRunId,
        sessionKey,
        index: sentenceBuffer.chunkIndex + index,
        audio: { base64: audioBase64, format, sampleRate: 24000 },
        isFinal: false,
      };
      broadcast("tts.chunk", ttsPayload);
      nodeSendToSession(sessionKey, "tts.chunk", ttsPayload);
    })
      .then((result) => {
        chatLog.info(
          `[stream-tts] result: ok=${result.ok}, chunks=${result.chunks}, error=${result.error ?? "none"}`,
        );
        if (result.ok) {
          sentenceBuffer.chunkIndex += result.chunks;
        }
      })
      .catch((err) => {
        chatLog.warn(`Stream TTS error for run ${clientRunId}: ${(err as Error).message}`);
      });
  };

  /**
   * Check accumulated text for sentence boundaries and fire streaming TTS.
   * Uses sentence-ending punctuation (。！？.!?) — NOT commas/colons, because
   * splitting at commas produces unnatural speech with inconsistent voice/prosody.
   * Falls back to a time-based flush if no sentence end appears within TTS_FORCE_FLUSH_MS.
   */
  const checkSentenceBoundary = (sessionKey: string, clientRunId: string, fullText: string) => {
    // Only process if this is a voice-input run and stream TTS is available
    if (!chatRunState.voiceInputRuns.get(clientRunId)) return;
    if (!isStreamTtsAvailable()) return;

    let sentenceBuffer = chatRunState.ttsSentenceBuffers.get(clientRunId);
    if (!sentenceBuffer) {
      sentenceBuffer = { cursor: 0, chunkIndex: 0, active: true, lastFireAt: Date.now() };
      chatRunState.ttsSentenceBuffers.set(clientRunId, sentenceBuffer);
    }
    if (!sentenceBuffer.active) return;

    const remaining = fullText.slice(sentenceBuffer.cursor);
    const now = Date.now();

    // Strategy 1: Find last sentence-ending punctuation
    let lastBoundary = -1;
    for (let i = 0; i < remaining.length; i++) {
      if (SENTENCE_ENDS.has(remaining[i]!)) {
        lastBoundary = i;
      }
    }

    if (lastBoundary >= 0) {
      const sentence = remaining.slice(0, lastBoundary + 1).trim();
      if (sentence.length >= MIN_TTS_LENGTH) {
        sentenceBuffer.cursor += lastBoundary + 1;
        sentenceBuffer.lastFireAt = now;
        fireStreamTts(sessionKey, clientRunId, sentence, sentenceBuffer);
        return;
      }
    }

    // Strategy 2: Time-based force flush — if no sentence end for TTS_FORCE_FLUSH_MS,
    // fire TTS on whatever text has accumulated (so user doesn't wait forever).
    const timeSinceLastFire = now - sentenceBuffer.lastFireAt;
    if (timeSinceLastFire >= TTS_FORCE_FLUSH_MS && remaining.trim().length >= MIN_TTS_LENGTH) {
      chatLog.info(
        `[stream-tts] force-flush after ${timeSinceLastFire}ms: "${remaining.trim().slice(0, 30)}"`,
      );
      sentenceBuffer.cursor = fullText.length;
      sentenceBuffer.lastFireAt = now;
      fireStreamTts(sessionKey, clientRunId, remaining.trim(), sentenceBuffer);
    }
  };

  const emitChatDelta = (sessionKey: string, clientRunId: string, seq: number, text: string) => {
    if (isSilentReplyText(text, SILENT_REPLY_TOKEN)) {
      return;
    }
    chatRunState.buffers.set(clientRunId, text);

    // Streaming TTS: check on EVERY delta (not throttled) so we catch punctuation ASAP
    checkSentenceBoundary(sessionKey, clientRunId, text);

    // Throttle WebSocket broadcast (150ms) — but TTS check above is independent
    const now = Date.now();
    const last = chatRunState.deltaSentAt.get(clientRunId) ?? 0;
    if (now - last < 150) {
      return;
    }
    chatRunState.deltaSentAt.set(clientRunId, now);
    const payload = {
      runId: clientRunId,
      sessionKey,
      seq,
      state: "delta" as const,
      message: {
        role: "assistant",
        content: [{ type: "text", text }],
        timestamp: now,
      },
    };
    // Suppress webchat broadcast for heartbeat runs when showOk is false
    if (!shouldSuppressHeartbeatBroadcast(clientRunId)) {
      broadcast("chat", payload, { dropIfSlow: true });
    }
    nodeSendToSession(sessionKey, "chat", payload);
  };

  const emitChatFinal = async (
    sessionKey: string,
    clientRunId: string,
    seq: number,
    jobState: "done" | "error",
    error?: unknown,
  ) => {
    const text = chatRunState.buffers.get(clientRunId)?.trim() ?? "";
    const shouldSuppressSilent = isSilentReplyText(text, SILENT_REPLY_TOKEN);
    chatRunState.buffers.delete(clientRunId);
    chatRunState.deltaSentAt.delete(clientRunId);

    // Check if this was a voice-input run (enables TTS on response)
    const isVoiceInput = chatRunState.voiceInputRuns.get(clientRunId) === true;
    chatRunState.voiceInputRuns.delete(clientRunId);

    // Flush remaining text for streaming TTS
    const sentenceBuffer = chatRunState.ttsSentenceBuffers.get(clientRunId);
    chatRunState.ttsSentenceBuffers.delete(clientRunId);
    let usedStreamTts = false;

    if (sentenceBuffer?.active && jobState === "done" && text && !shouldSuppressSilent) {
      usedStreamTts = sentenceBuffer.chunkIndex > 0 || sentenceBuffer.cursor > 0;
      // Flush remaining unsynthesized text
      const remainingRaw = text.slice(sentenceBuffer.cursor).trim();
      const remaining = cleanTextForTts(remainingRaw);
      if (remaining.length >= MIN_TTS_LENGTH) {
        try {
          const flushResult = await unifiedStreamSynthesize(
            remaining,
            (audioBase64, format, index) => {
              const ttsPayload = {
                event: "tts.chunk",
                runId: clientRunId,
                sessionKey,
                index: sentenceBuffer.chunkIndex + index,
                audio: { base64: audioBase64, format, sampleRate: 24000 },
                isFinal: false,
              };
              broadcast("tts.chunk", ttsPayload);
              nodeSendToSession(sessionKey, "tts.chunk", ttsPayload);
            },
          );
          if (flushResult.ok) {
            sentenceBuffer.chunkIndex += flushResult.chunks;
            usedStreamTts = true;
          }
        } catch {
          // Flush failed, will fall back to one-shot TTS
        }
      }

      // Send final tts.chunk with isFinal=true to signal playback completion
      if (usedStreamTts) {
        const finalTtsPayload = {
          event: "tts.chunk",
          runId: clientRunId,
          sessionKey,
          index: sentenceBuffer.chunkIndex,
          audio: null,
          isFinal: true,
        };
        broadcast("tts.chunk", finalTtsPayload);
        nodeSendToSession(sessionKey, "tts.chunk", finalTtsPayload);
      }
    }

    // Read TTS audio if present (set by deliver callback via chatRunState.ttsMediaUrls)
    const ttsMediaPath = chatRunState.ttsMediaUrls.get(clientRunId);
    chatRunState.ttsMediaUrls.delete(clientRunId);
    let ttsAudio: { base64: string; format: string } | undefined;
    if (ttsMediaPath && jobState === "done") {
      try {
        const audioBuffer = readFileSync(ttsMediaPath);
        const format = ttsMediaPath.endsWith(".mp3")
          ? "mp3"
          : ttsMediaPath.endsWith(".opus")
            ? "opus"
            : "wav";
        ttsAudio = { base64: audioBuffer.toString("base64"), format };
      } catch {
        // TTS audio file not readable, skip
      }
    }

    // For voice-input agent-run path: generate one-shot TTS as fallback
    // Skip if streaming TTS already handled it
    if (
      !ttsAudio &&
      !usedStreamTts &&
      isVoiceInput &&
      jobState === "done" &&
      text &&
      !shouldSuppressSilent
    ) {
      try {
        const cfg = loadConfig();
        const ttsResult = await maybeApplyTtsToPayload({
          payload: { text },
          cfg,
          channel: "webchat",
          kind: "final",
          inboundAudio: true,
          // Force TTS auto mode to "inbound" so voice-input responses always get TTS,
          // even when the user hasn't explicitly configured messages.tts.auto.
          ttsAuto: "inbound",
        });
        if (ttsResult.mediaUrl) {
          try {
            const audioBuffer = readFileSync(ttsResult.mediaUrl);
            const format = ttsResult.mediaUrl.endsWith(".mp3")
              ? "mp3"
              : ttsResult.mediaUrl.endsWith(".opus")
                ? "opus"
                : "wav";
            ttsAudio = { base64: audioBuffer.toString("base64"), format };
          } catch {
            // TTS audio file not readable, skip
          }
        }
      } catch {
        // TTS generation failed, continue without audio
      }
    }

    if (jobState === "done") {
      const payload: Record<string, unknown> = {
        runId: clientRunId,
        sessionKey,
        seq,
        state: "final" as const,
        message:
          text && !shouldSuppressSilent
            ? {
                role: "assistant",
                content: [{ type: "text", text }],
                timestamp: Date.now(),
              }
            : undefined,
      };
      if (ttsAudio) {
        payload.ttsAudio = ttsAudio;
      }
      // Suppress webchat broadcast for heartbeat runs when showOk is false
      if (!shouldSuppressHeartbeatBroadcast(clientRunId)) {
        broadcast("chat", payload);
      }
      nodeSendToSession(sessionKey, "chat", payload);
      return;
    }
    const payload = {
      runId: clientRunId,
      sessionKey,
      seq,
      state: "error" as const,
      errorMessage: error ? formatForLog(error) : undefined,
    };
    broadcast("chat", payload);
    nodeSendToSession(sessionKey, "chat", payload);
  };

  const resolveToolVerboseLevel = (runId: string, sessionKey?: string) => {
    const runContext = getAgentRunContext(runId);
    const runVerbose = normalizeVerboseLevel(runContext?.verboseLevel);
    if (runVerbose) {
      return runVerbose;
    }
    if (!sessionKey) {
      return "off";
    }
    try {
      const { cfg, entry } = loadSessionEntry(sessionKey);
      const sessionVerbose = normalizeVerboseLevel(entry?.verboseLevel);
      if (sessionVerbose) {
        return sessionVerbose;
      }
      const defaultVerbose = normalizeVerboseLevel(cfg.agents?.defaults?.verboseDefault);
      return defaultVerbose ?? "off";
    } catch {
      return "off";
    }
  };

  return (evt: AgentEventPayload) => {
    const chatLink = chatRunState.registry.peek(evt.runId);
    const sessionKey = chatLink?.sessionKey ?? resolveSessionKeyForRun(evt.runId);
    const clientRunId = chatLink?.clientRunId ?? evt.runId;
    const isAborted =
      chatRunState.abortedRuns.has(clientRunId) || chatRunState.abortedRuns.has(evt.runId);
    // Include sessionKey so Control UI can filter tool streams per session.
    const agentPayload = sessionKey ? { ...evt, sessionKey } : evt;
    const last = agentRunSeq.get(evt.runId) ?? 0;
    const isToolEvent = evt.stream === "tool";
    const toolVerbose = isToolEvent ? resolveToolVerboseLevel(evt.runId, sessionKey) : "off";
    // Build tool payload: strip result/partialResult unless verbose=full
    const toolPayload =
      isToolEvent && toolVerbose !== "full"
        ? (() => {
            const data = evt.data ? { ...evt.data } : {};
            delete data.result;
            delete data.partialResult;
            return sessionKey ? { ...evt, sessionKey, data } : { ...evt, data };
          })()
        : agentPayload;
    if (evt.seq !== last + 1) {
      broadcast("agent", {
        runId: evt.runId,
        stream: "error",
        ts: Date.now(),
        sessionKey,
        data: {
          reason: "seq gap",
          expected: last + 1,
          received: evt.seq,
        },
      });
    }
    agentRunSeq.set(evt.runId, evt.seq);
    if (isToolEvent) {
      // Always broadcast tool events to registered WS recipients with
      // tool-events capability, regardless of verboseLevel. The verbose
      // setting only controls whether tool details are sent as channel
      // messages to messaging surfaces (Telegram, Discord, etc.).
      const recipients = toolEventRecipients.get(evt.runId);
      if (recipients && recipients.size > 0) {
        broadcastToConnIds("agent", toolPayload, recipients);
      }
    } else {
      broadcast("agent", agentPayload);
    }

    const lifecyclePhase =
      evt.stream === "lifecycle" && typeof evt.data?.phase === "string" ? evt.data.phase : null;

    if (sessionKey) {
      // Send tool events to node/channel subscribers only when verbose is enabled;
      // WS clients already received the event above via broadcastToConnIds.
      if (!isToolEvent || toolVerbose !== "off") {
        nodeSendToSession(sessionKey, "agent", isToolEvent ? toolPayload : agentPayload);
      }
      if (!isAborted && evt.stream === "assistant" && typeof evt.data?.text === "string") {
        emitChatDelta(sessionKey, clientRunId, evt.seq, evt.data.text);
      } else if (!isAborted && (lifecyclePhase === "end" || lifecyclePhase === "error")) {
        if (chatLink) {
          const finished = chatRunState.registry.shift(evt.runId);
          if (!finished) {
            clearAgentRunContext(evt.runId);
            return;
          }
          emitChatFinal(
            finished.sessionKey,
            finished.clientRunId,
            evt.seq,
            lifecyclePhase === "error" ? "error" : "done",
            evt.data?.error,
          ).catch((err) => {
            chatLog.error("emitChatFinal failed", { runId: finished.clientRunId, err });
            try {
              broadcast("chat", {
                runId: finished.clientRunId,
                sessionKey: finished.sessionKey,
                seq: evt.seq,
                state: "error",
                errorMessage: "Internal TTS error",
              });
            } catch {
              /* best effort */
            }
          });
        } else {
          emitChatFinal(
            sessionKey,
            evt.runId,
            evt.seq,
            lifecyclePhase === "error" ? "error" : "done",
            evt.data?.error,
          ).catch((err) => {
            chatLog.error("emitChatFinal failed", { runId: evt.runId, err });
            try {
              broadcast("chat", {
                runId: evt.runId,
                sessionKey,
                seq: evt.seq,
                state: "error",
                errorMessage: "Internal TTS error",
              });
            } catch {
              /* best effort */
            }
          });
        }
      } else if (isAborted && (lifecyclePhase === "end" || lifecyclePhase === "error")) {
        chatRunState.abortedRuns.delete(clientRunId);
        chatRunState.abortedRuns.delete(evt.runId);
        chatRunState.buffers.delete(clientRunId);
        chatRunState.deltaSentAt.delete(clientRunId);
        if (chatLink) {
          chatRunState.registry.remove(evt.runId, clientRunId, sessionKey);
        }
      }
    }

    if (lifecyclePhase === "end" || lifecyclePhase === "error") {
      toolEventRecipients.markFinal(evt.runId);
      clearAgentRunContext(evt.runId);
      agentRunSeq.delete(evt.runId);
      agentRunSeq.delete(clientRunId);
    }
  };
}
