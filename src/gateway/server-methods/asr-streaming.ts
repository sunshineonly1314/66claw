/**
 * Streaming ASR — Tier-aware router layer.
 *
 * Routes between backends based on availability (priority order):
 *   1. CPU hybrid (Streaming Paraformer partials + SenseVoice final) — best UX
 *   2. API cloud ASR — if configured
 *   3. GPU sidecar (Qwen3-ASR 1s sliding window) — pseudo-streaming
 *   4. CPU offline (SenseVoice only) — pseudo-streaming fallback
 *
 * The session records which backend was chosen at start time,
 * and feed/end are routed accordingly.
 *
 * UI RPC interface (start/feed/end + asr.partial event) is unchanged.
 */
import {
  gpuStreamHandlers,
  isGpuStreamAvailable,
  cleanupGpuSessionsForConn,
} from "./asr-streaming-gpu.js";
import { vadStreamHandlers, cleanupVadSessionsForConn } from "./asr-streaming-vad.js";
import {
  cpuStreamHandlers,
  cleanupCpuSessionsForConn,
  isCpuAsrAvailable,
  detectCpuStreamingModel,
} from "./asr-streaming-cpu.js";
import {
  apiStreamHandlers,
  cleanupApiSessionsForConn,
  isApiAsrAvailable,
} from "./asr-streaming-api.js";
import { cleanupKwsSessionsForConn } from "./kws-streaming.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers } from "./types.js";

// ─── Session type tracking ────────────────────────────────────────────

type SessionBackend = "gpu" | "vad" | "cpu" | "api";
const sessionTypes = new Map<string, SessionBackend>();

/** Clean up all streaming sessions for a disconnected connection. */
export function cleanupSessionsForConn(connId: string): void {
  cleanupGpuSessionsForConn(connId);
  cleanupVadSessionsForConn(connId);
  cleanupCpuSessionsForConn(connId);
  cleanupApiSessionsForConn(connId);
  cleanupKwsSessionsForConn(connId);
}

// ─── Backend resolution ───────────────────────────────────────────────

/**
 * Determine the best available streaming ASR backend.
 * Priority:
 *   1. CPU true streaming (Paraformer/Zipformer OnlineRecognizer) — best UX
 *   2. API cloud ASR — if configured
 *   3. GPU sidecar (Qwen3-ASR sliding window) — pseudo-streaming
 *   4. CPU offline (SenseVoice OfflineRecognizer) — pseudo-streaming fallback
 */
async function resolveBackend(): Promise<SessionBackend | null> {
  // 0. CPU true streaming takes priority — real incremental decoding, no text deletion
  if (detectCpuStreamingModel()) return "cpu";

  // 1. User-selected API ASR provider
  if (await isApiAsrAvailable()) return "api";

  // 2. GPU streaming (Qwen3-ASR 1s sliding window)
  if (await isGpuStreamAvailable()) return "gpu";

  // 3. CPU offline (SenseVoice via sherpa-onnx)
  if (isCpuAsrAvailable()) return "cpu";

  // 4. No backend available
  return null;
}

function getHandlers(backend: SessionBackend): GatewayRequestHandlers {
  switch (backend) {
    case "gpu":
      return gpuStreamHandlers;
    case "vad":
      return vadStreamHandlers;
    case "cpu":
      return cpuStreamHandlers;
    case "api":
      return apiStreamHandlers;
  }
}

function getBackendLabel(backend: SessionBackend): string {
  switch (backend) {
    case "gpu":
      return "Qwen3-ASR-0.6B (GPU streaming)";
    case "vad":
      return "Qwen3-ASR-0.6B (VAD+GPU)";
    case "cpu":
      return detectCpuStreamingModel()
        ? "Hybrid: Streaming Paraformer + SenseVoice (CPU)"
        : "SenseVoice (CPU, offline)";
    case "api":
      return "API ASR (cloud)";
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────

export const asrStreamingHandlers: GatewayRequestHandlers = {
  /**
   * Check streaming ASR availability. Reports which backend would be used.
   */
  "asr.stream.status": async (ctx) => {
    try {
      const backend = await resolveBackend();
      if (backend) {
        ctx.respond(true, {
          available: true,
          model: getBackendLabel(backend),
          method:
            backend === "gpu"
              ? "gpu-1s-window"
              : backend === "vad"
                ? "vad+qwen3-asr"
                : backend === "api"
                  ? "api-cloud"
                  : detectCpuStreamingModel()
                    ? "cpu-streaming"
                    : "cpu-offline",
          streamingMode: backend,
        });
      } else {
        ctx.respond(true, {
          available: false,
          model: null,
          method: null,
          streamingMode: null,
        });
      }
    } catch (err) {
      ctx.respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Start a streaming session. Picks the best available backend.
   */
  "asr.stream.start": async (ctx) => {
    const { respond } = ctx;
    try {
      const backend = await resolveBackend();
      if (!backend) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.UNAVAILABLE, "没有可用的语音识别后端。请在设置页安装语音模型。"),
        );
        return;
      }

      const handlers = getHandlers(backend);
      // Wrap respond to capture sessionId and record backend type
      const originalRespond = respond;
      const wrappedCtx = {
        ...ctx,
        respond: (ok: boolean, data?: any, error?: any) => {
          if (ok && data?.sessionId) {
            sessionTypes.set(data.sessionId, backend);
          }
          originalRespond(ok, data, error);
        },
      };
      await handlers["asr.stream.start"]!(wrappedCtx as any);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Feed audio. Routes to the handler that started the session.
   */
  "asr.stream.feed": async (ctx) => {
    const sessionId = typeof ctx.params.sessionId === "string" ? ctx.params.sessionId : "";
    const backend = sessionTypes.get(sessionId);

    if (!backend) {
      ctx.respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "session not found"));
      return;
    }

    const handlers = getHandlers(backend);
    await handlers["asr.stream.feed"]!(ctx as any);
  },

  /**
   * End session. Routes to the handler that started the session.
   */
  "asr.stream.end": async (ctx) => {
    const sessionId = typeof ctx.params.sessionId === "string" ? ctx.params.sessionId : "";
    const backend = sessionTypes.get(sessionId);
    sessionTypes.delete(sessionId);

    if (!backend) {
      ctx.respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "session not found"));
      return;
    }

    const handlers = getHandlers(backend);
    await handlers["asr.stream.end"]!(ctx as any);
  },
};
