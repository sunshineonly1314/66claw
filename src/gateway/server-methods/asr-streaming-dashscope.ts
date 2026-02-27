/**
 * DashScope Fun-ASR real-time streaming ASR via WebSocket.
 *
 * Unlike the generic API backend (asr-streaming-api.ts) which accumulates audio
 * and transcribes at end, this backend streams audio to DashScope in real time
 * and receives incremental recognition results.
 *
 * Protocol: wss://dashscope.aliyuncs.com/api-ws/v1/inference
 * Docs: https://help.aliyun.com/zh/model-studio/fun-asr-realtime-websocket-api
 */

import crypto from "node:crypto";
import WebSocket from "ws";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers } from "./types.js";

// ─── Constants ────────────────────────────────────────────────────────

const DASHSCOPE_WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference";
const MODEL = "fun-asr-realtime";
const CONNECT_TIMEOUT_MS = 8_000;
const FINISH_TIMEOUT_MS = 10_000;
const SESSION_TIMEOUT_MS = 120_000;

// ─── Session Store ────────────────────────────────────────────────────

type DashScopeSession = {
  sessionId: string;
  connId: string;
  ws: WebSocket;
  taskId: string;
  taskStarted: boolean;
  pendingChunks: Buffer[];
  finalText: string;
  currentPartial: string;
  /** Resolve for task-started wait */
  onTaskStarted: (() => void) | null;
  /** Resolve for task-finished wait */
  onTaskFinished: (() => void) | null;
  /** Broadcast helper, bound at start */
  broadcast: ((event: string, data: unknown, connIds: Set<string>) => void) | null;
  timeoutTimer: ReturnType<typeof setTimeout> | null;
  closed: boolean;
};

const sessions = new Map<string, DashScopeSession>();

function cleanupSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.closed = true;
  if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
  if (session.ws.readyState === WebSocket.OPEN || session.ws.readyState === WebSocket.CONNECTING) {
    session.ws.close();
  }
  sessions.delete(sessionId);
}

/** Clean up all DashScope sessions for a disconnected connection. */
export function cleanupDashscopeSessionsForConn(connId: string): void {
  for (const [sessionId, session] of sessions) {
    if (session.connId === connId) cleanupSession(sessionId);
  }
}

// ─── Availability Check ───────────────────────────────────────────────

let _cachedKeyAvailable: boolean | null = null;
let _cachedKeyTs = 0;
const KEY_CACHE_TTL_MS = 30_000;

/** Check if DashScope API key is available. */
export function isDashscopeStreamAvailable(): boolean {
  const now = Date.now();
  if (_cachedKeyAvailable !== null && now - _cachedKeyTs < KEY_CACHE_TTL_MS) {
    return _cachedKeyAvailable;
  }

  // Lazy import to avoid circular deps at module load time
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { collectProviderApiKeys } = require("../../agents/live-auth-keys.js") as {
      collectProviderApiKeys: (provider: string) => string[];
    };
    const keys = collectProviderApiKeys("dashscope");
    _cachedKeyAvailable = keys.length > 0;
  } catch {
    _cachedKeyAvailable = false;
  }
  _cachedKeyTs = now;
  return _cachedKeyAvailable;
}

function getDashScopeApiKey(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { collectProviderApiKeys } = require("../../agents/live-auth-keys.js") as {
      collectProviderApiKeys: (provider: string) => string[];
    };
    const keys = collectProviderApiKeys("dashscope");
    return keys[0] ?? null;
  } catch {
    return null;
  }
}

// ─── WebSocket message handler ────────────────────────────────────────

function handleWsMessage(session: DashScopeSession, raw: WebSocket.RawData): void {
  if (session.closed) return;

  let msg: any;
  try {
    msg = JSON.parse(raw.toString("utf8"));
  } catch {
    return;
  }

  const event = msg?.header?.event as string | undefined;

  switch (event) {
    case "task-started": {
      session.taskStarted = true;
      // Flush buffered audio chunks
      for (const chunk of session.pendingChunks) {
        if (session.ws.readyState === WebSocket.OPEN) {
          session.ws.send(chunk);
        }
      }
      session.pendingChunks = [];
      session.onTaskStarted?.();
      session.onTaskStarted = null;
      break;
    }

    case "result-generated": {
      const sentence = msg?.payload?.output?.sentence;
      if (!sentence) break;

      const text = (sentence.text as string) ?? "";
      const sentenceEnd = sentence.sentence_end === true;

      if (sentenceEnd) {
        // Sentence complete — append to final text
        session.finalText += text;
        session.currentPartial = "";
      } else {
        // Intermediate result
        session.currentPartial = text;
      }

      // Broadcast to UI
      const displayText = session.finalText + session.currentPartial;
      if (session.broadcast) {
        session.broadcast(
          "asr.partial",
          {
            sessionId: session.sessionId,
            partial: displayText,
            final: "",
            isFinal: false,
          },
          new Set([session.connId]),
        );
      }
      break;
    }

    case "task-finished": {
      session.onTaskFinished?.();
      session.onTaskFinished = null;
      break;
    }

    case "task-failed": {
      const errCode = msg?.header?.error_code ?? "unknown";
      const errMsg = msg?.header?.error_message ?? "DashScope task failed";
      // Log but don't crash — the session will end gracefully
      console.error(`[dashscope-asr] task-failed: ${errCode} — ${errMsg}`);
      session.onTaskFinished?.();
      session.onTaskFinished = null;
      break;
    }
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────

export const dashscopeStreamHandlers: GatewayRequestHandlers = {
  /**
   * Start a DashScope streaming ASR session.
   */
  "asr.stream.start": async ({ respond, client, context }) => {
    const connId = typeof client?.connId === "string" ? client.connId : undefined;
    if (!connId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "no connection"));
      return;
    }

    const apiKey = getDashScopeApiKey();
    if (!apiKey) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, "未配置 DashScope API Key (DASHSCOPE_API_KEY)"),
      );
      return;
    }

    const sessionId = crypto.randomBytes(12).toString("hex");
    const taskId = crypto.randomBytes(16).toString("hex");

    // Create WebSocket connection to DashScope
    let ws: WebSocket;
    try {
      ws = new WebSocket(DASHSCOPE_WS_URL, {
        headers: { Authorization: `bearer ${apiKey}` },
        handshakeTimeout: CONNECT_TIMEOUT_MS,
      });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
      return;
    }

    const session: DashScopeSession = {
      sessionId,
      connId,
      ws,
      taskId,
      taskStarted: false,
      pendingChunks: [],
      finalText: "",
      currentPartial: "",
      onTaskStarted: null,
      onTaskFinished: null,
      broadcast: context.broadcastToConnIds.bind(context),
      timeoutTimer: null,
      closed: false,
    };

    sessions.set(sessionId, session);

    // Session timeout guard
    session.timeoutTimer = setTimeout(() => cleanupSession(sessionId), SESSION_TIMEOUT_MS);

    // Wire up WS events
    ws.on("message", (data) => handleWsMessage(session, data));
    ws.on("error", () => {
      if (!session.closed) cleanupSession(sessionId);
    });
    ws.on("close", () => {
      if (!session.closed) {
        session.closed = true;
        session.onTaskStarted?.();
        session.onTaskFinished?.();
      }
    });

    // Wait for connection open, then send run-task
    const openPromise = new Promise<boolean>((resolve) => {
      ws.on("open", () => resolve(true));
      ws.on("error", () => resolve(false));
      setTimeout(() => resolve(false), CONNECT_TIMEOUT_MS);
    });

    const connected = await openPromise;
    if (!connected || ws.readyState !== WebSocket.OPEN) {
      cleanupSession(sessionId);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "DashScope WebSocket 连接失败"));
      return;
    }

    // Send run-task directive
    const runTask = {
      header: {
        action: "run-task",
        task_id: taskId,
        streaming: "duplex",
      },
      payload: {
        task_group: "audio",
        task: "asr",
        function: "recognition",
        model: MODEL,
        parameters: {
          format: "pcm",
          sample_rate: 16000,
          semantic_punctuation_enabled: true,
          language_hints: ["zh"],
        },
        input: {},
      },
    };

    ws.send(JSON.stringify(runTask));

    // Wait for task-started (with timeout)
    const started = await new Promise<boolean>((resolve) => {
      if (session.taskStarted) {
        resolve(true);
        return;
      }
      session.onTaskStarted = () => resolve(true);
      setTimeout(() => resolve(session.taskStarted), CONNECT_TIMEOUT_MS);
    });

    if (!started || session.closed) {
      cleanupSession(sessionId);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "DashScope task 启动超时"));
      return;
    }

    respond(true, { sessionId });
  },

  /**
   * Feed PCM16 audio to DashScope.
   */
  "asr.stream.feed": async ({ params, respond }) => {
    const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
    const pcmBase64 = typeof params.pcmBase64 === "string" ? params.pcmBase64 : "";

    if (!sessionId || !pcmBase64) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "sessionId and pcmBase64 required"),
      );
      return;
    }

    const session = sessions.get(sessionId);
    if (!session || session.closed) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "session not found"));
      return;
    }

    // Decode base64 PCM16 to binary buffer
    const pcmBuffer = Buffer.from(pcmBase64, "base64");

    if (session.taskStarted && session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(pcmBuffer);
    } else {
      session.pendingChunks.push(pcmBuffer);
    }

    respond(true, { ok: true });
  },

  /**
   * End a DashScope streaming session.
   */
  "asr.stream.end": async ({ params, respond, context }) => {
    const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
    const session = sessions.get(sessionId);

    if (!session) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "session not found"));
      return;
    }

    // Send finish-task directive
    if (session.ws.readyState === WebSocket.OPEN && session.taskStarted) {
      const finishTask = {
        header: {
          action: "finish-task",
          task_id: session.taskId,
          streaming: "duplex",
        },
        payload: {
          input: {},
        },
      };
      session.ws.send(JSON.stringify(finishTask));

      // Wait for task-finished event (with timeout)
      await new Promise<void>((resolve) => {
        session.onTaskFinished = resolve;
        setTimeout(resolve, FINISH_TIMEOUT_MS);
      });
    }

    const finalText = session.finalText + session.currentPartial;

    // Broadcast final result
    context.broadcastToConnIds(
      "asr.partial",
      {
        sessionId: session.sessionId,
        partial: "",
        final: finalText,
        isFinal: true,
      },
      new Set([session.connId]),
    );

    cleanupSession(sessionId);
    respond(true, { text: finalText });
  },
};
