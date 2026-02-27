/**
 * GPU Streaming ASR — Qwen3-ASR 1s sliding window via voice-server sidecar.
 *
 * The voice-server.py manages the streaming state (buffer, audio_accum,
 * prefix rollback). Gateway just forwards PCM chunks and pushes results
 * back to the browser via "asr.partial" events.
 *
 * Key design: feed returns immediately to the caller, the GPU inference
 * result is delivered asynchronously via broadcastToConnIds("asr.partial").
 */
import type { GatewayRequestHandlers } from "./types.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { formatForLog } from "../ws-log.js";

// ─── Constants ────────────────────────────────────────────────────────

const GPU_SIDECAR_PORT = 50100;

// ─── Session tracking ─────────────────────────────────────────────────

type GpuStreamSession = {
  /** voice-server session_id */
  sessionId: string;
  /** WebSocket connection id */
  connId: string;
  /** Last known transcription text */
  lastText: string;
};

const gpuSessions = new Map<string, GpuStreamSession>();

/** Check if GPU sidecar supports stream-asr endpoints. */
export async function isGpuStreamAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${GPU_SIDECAR_PORT}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { asr?: boolean; stream_asr?: boolean };
    return data.stream_asr === true;
  } catch {
    return false;
  }
}

/** Clean up GPU stream sessions for a disconnected connection. */
export function cleanupGpuSessionsForConn(connId: string): void {
  for (const [sessionId, session] of gpuSessions) {
    if (session.connId === connId) {
      // Fire-and-forget: tell voice-server to clean up
      fetch(`http://127.0.0.1:${GPU_SIDECAR_PORT}/stream-asr/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
        signal: AbortSignal.timeout(3_000),
      }).catch(() => {});
      gpuSessions.delete(sessionId);
    }
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────

export const gpuStreamHandlers: GatewayRequestHandlers = {
  /**
   * Start a GPU streaming ASR session.
   */
  "asr.stream.start": async ({ respond, client }) => {
    const connId = typeof client?.connId === "string" ? client.connId : undefined;
    if (!connId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "no connection"));
      return;
    }

    try {
      const res = await fetch(`http://127.0.0.1:${GPU_SIDECAR_PORT}/stream-asr/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "zh", chunk_size_sec: 1.0 }),
        signal: AbortSignal.timeout(5_000),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "unknown");
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.UNAVAILABLE, `GPU stream start failed: ${detail}`),
        );
        return;
      }

      const data = (await res.json()) as { session_id?: string };
      const sessionId = data.session_id;
      if (!sessionId) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "No session_id returned"));
        return;
      }

      gpuSessions.set(sessionId, { sessionId, connId, lastText: "" });
      respond(true, { sessionId });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Feed PCM16 audio to a GPU streaming session.
   * Responds immediately; GPU result is pushed via "asr.partial" event.
   */
  "asr.stream.feed": async ({ params, respond, context }) => {
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

    const session = gpuSessions.get(sessionId);
    if (!session) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "session not found"));
      return;
    }

    // Respond immediately — non-blocking
    respond(true, { ok: true });

    // Fire-and-forget: forward to voice-server, push result when ready
    (async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${GPU_SIDECAR_PORT}/stream-asr/feed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, pcm_base64: pcmBase64 }),
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) return;

        const data = (await res.json()) as { text?: string; changed?: boolean };
        if (!data.changed) return;

        const text = data.text ?? "";
        session.lastText = text;

        context.broadcastToConnIds(
          "asr.partial",
          {
            sessionId,
            partial: text,
            final: "",
            isFinal: false,
          },
          new Set([session.connId]),
        );
      } catch {
        // GPU feed failed silently — next feed will retry
      }
    })();
  },

  /**
   * End a GPU streaming session. Flush and return final text.
   */
  "asr.stream.end": async ({ params, respond, context }) => {
    const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
    const session = gpuSessions.get(sessionId);
    if (!session) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "session not found"));
      return;
    }

    try {
      const res = await fetch(`http://127.0.0.1:${GPU_SIDECAR_PORT}/stream-asr/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
        signal: AbortSignal.timeout(15_000),
      });

      gpuSessions.delete(sessionId);

      if (!res.ok) {
        respond(true, { text: session.lastText });
        return;
      }

      const data = (await res.json()) as { text?: string };
      const finalText = data.text ?? session.lastText;

      // Push final result
      context.broadcastToConnIds(
        "asr.partial",
        {
          sessionId,
          partial: "",
          final: finalText,
          isFinal: true,
        },
        new Set([session.connId]),
      );

      respond(true, { text: finalText });
    } catch (err) {
      gpuSessions.delete(sessionId);
      respond(true, { text: session.lastText });
    }
  },
};
