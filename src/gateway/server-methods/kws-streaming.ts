/**
 * KWS Streaming — Wake word detection via sherpa-onnx KeywordSpotter.
 *
 * Browser sends mic PCM16 chunks; gateway runs KWS in real-time.
 * On keyword detection, broadcasts a `voicewake.detected` event.
 *
 * RPC methods:
 *   voicewake.listen.status → KWS availability check
 *   voicewake.listen.start  → start a KWS session
 *   voicewake.listen.feed   → feed PCM16 base64 chunk
 *   voicewake.listen.stop   → stop and cleanup
 */

import crypto from "node:crypto";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers } from "./types.js";
import type { KwsStreamHandle } from "../../voice/kws-engine.js";

// ─── Session management ──────────────────────────────────────────────

type KwsSession = {
  sessionId: string;
  connId: string;
  handle: KwsStreamHandle;
  lastFeedAt: number;
  timeoutTimer: ReturnType<typeof setTimeout> | null;
};

const sessions = new Map<string, KwsSession>();

/** 10 min idle timeout — KWS sessions are long-lived. */
const SESSION_TIMEOUT_MS = 600_000;
/** Max base64 chunk length (~8KB PCM = ~250ms at 16kHz). */
const MAX_CHUNK_BASE64_LENGTH = 32768;

function cleanupSession(sessionId: string): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  if (s.timeoutTimer) clearTimeout(s.timeoutTimer);
  // Release sherpa-onnx OnlineStream (C++ side allocation)
  try {
    if (typeof s.handle.stream?.free === "function") s.handle.stream.free();
  } catch {
    /* ignore */
  }
  sessions.delete(sessionId);
}

/** Clean up all KWS sessions for a disconnected connection. */
export function cleanupKwsSessionsForConn(connId: string): void {
  for (const [sessionId, session] of sessions) {
    if (session.connId === connId) cleanupSession(sessionId);
  }
}

// ─── RPC Handlers ────────────────────────────────────────────────────

export const kwsStreamingHandlers: GatewayRequestHandlers = {
  "voicewake.listen.status": async ({ respond }) => {
    try {
      const { isKwsAvailable } = await import("../../voice/kws-engine.js");
      respond(true, { available: isKwsAvailable() });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  "voicewake.listen.start": async ({ respond, client }) => {
    const connId = typeof client?.connId === "string" ? client.connId : undefined;
    if (!connId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "no connection"));
      return;
    }
    try {
      const { isKwsAvailable, createKwsStream } = await import("../../voice/kws-engine.js");
      if (!isKwsAvailable()) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "KWS model not installed"));
        return;
      }
      // Only one KWS session per connection
      cleanupKwsSessionsForConn(connId);

      const sessionId = crypto.randomUUID();
      const handle = createKwsStream(connId);
      const session: KwsSession = {
        sessionId,
        connId,
        handle,
        lastFeedAt: Date.now(),
        timeoutTimer: null,
      };
      session.timeoutTimer = setTimeout(() => cleanupSession(sessionId), SESSION_TIMEOUT_MS);
      sessions.set(sessionId, session);
      respond(true, { sessionId });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  "voicewake.listen.feed": async ({ params, respond, context }) => {
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
    if (!session) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "session not found"));
      return;
    }
    if (pcmBase64.length > MAX_CHUNK_BASE64_LENGTH) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "chunk too large"));
      return;
    }
    try {
      const { feedAndDecode } = await import("../../voice/kws-engine.js");

      // Decode base64 → Int16 → Float32 [-1, 1]
      // Copy to aligned ArrayBuffer — Buffer.from(base64) may have odd byteOffset
      // which would cause Int16Array constructor to throw RangeError.
      const buf = Buffer.from(pcmBase64, "base64");
      const aligned = new ArrayBuffer(buf.byteLength);
      new Uint8Array(aligned).set(buf);
      const int16 = new Int16Array(aligned);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i]! / 32768;
      }

      const keyword = feedAndDecode(session.handle, float32);
      session.lastFeedAt = Date.now();

      // Reset idle timeout
      if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
      session.timeoutTimer = setTimeout(
        () => cleanupSession(session.sessionId),
        SESSION_TIMEOUT_MS,
      );

      if (keyword) {
        // Keyword detected! Broadcast event to originating connection only
        context.broadcastToConnIds(
          "voicewake.detected",
          { keyword, sessionId, timestamp: Date.now() },
          new Set([session.connId]),
        );
      }
      respond(true, { ok: true });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  "voicewake.listen.stop": async ({ params, respond }) => {
    const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
    const session = sessions.get(sessionId);
    if (!session) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "session not found"));
      return;
    }
    cleanupSession(sessionId);
    respond(true, { ok: true });
  },
};
