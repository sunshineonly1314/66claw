/**
 * Volcengine (火山引擎) real-time streaming ASR via WebSocket binary protocol.
 *
 * Uses the 豆包流式语音识别模型2.0 (bigmodel) endpoint.
 * Binary protocol: 4-byte header + 4-byte payload size + payload.
 *
 * Protocol: wss://openspeech.bytedance.com/api/v3/sauc/bigmodel
 * Docs: https://www.volcengine.com/docs/6561/1354869
 */

import crypto from "node:crypto";
import { gzipSync } from "node:zlib";
import WebSocket from "ws";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers } from "./types.js";

// ─── Constants ────────────────────────────────────────────────────────

const VOLCENGINE_ASR_WS_URL = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel";
const CONNECT_TIMEOUT_MS = 8_000;
const FINISH_TIMEOUT_MS = 10_000;
const SESSION_TIMEOUT_MS = 120_000;

// ─── Binary protocol helpers ─────────────────────────────────────────

/**
 * Build a binary frame for the Volcengine v3 bigmodel WebSocket protocol.
 *
 * Frame layout:
 *   Header (4 bytes):
 *     Byte 0: (protocol_version << 4) | header_size   → 0x11
 *     Byte 1: (message_type << 4) | message_flags
 *     Byte 2: (serialization << 4) | compression
 *     Byte 3: 0x00 (reserved)
 *   Sequence (4 bytes, big-endian int32) — present when flags has bit 0x1
 *   Payload size (4 bytes, big-endian uint32)
 *   Payload (N bytes, gzip compressed)
 */
function buildFrameWithSeq(
  messageType: number,
  messageFlags: number,
  serialization: number,
  compression: number,
  sequence: number,
  payload: Buffer,
): Buffer {
  const header = Buffer.alloc(4);
  header[0] = 0x11; // version 1, header size 1 (×4 = 4 bytes)
  header[1] = (messageType << 4) | (messageFlags & 0x0f);
  header[2] = (serialization << 4) | (compression & 0x0f);
  header[3] = 0x00;

  const seqBuf = Buffer.alloc(4);
  seqBuf.writeInt32BE(sequence, 0);

  const sizeBuf = Buffer.alloc(4);
  sizeBuf.writeUInt32BE(payload.length, 0);

  return Buffer.concat([header, seqBuf, sizeBuf, payload]);
}

/** Build a full_client_request frame (JSON, gzip compressed, seq=1). */
function buildFullClientRequest(json: object): Buffer {
  const jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  const compressed = gzipSync(jsonBuf);
  // message_type=1, flags=0x1 (has sequence), serialization=1 (JSON), compression=1 (gzip)
  return buildFrameWithSeq(0x1, 0x1, 0x1, 0x1, 1, compressed);
}

/** Build an audio-only frame with sequence number (gzip compressed). */
function buildAudioFrame(pcmBuffer: Buffer, isLast: boolean, sequence: number): Buffer {
  const compressed = gzipSync(pcmBuffer);
  // message_type=2, flags: 0x1=has seq, 0x3=has seq + last
  // serialization=0 (raw audio), compression=1 (gzip)
  const flags = isLast ? 0x3 : 0x1;
  const seq = isLast ? -sequence : sequence;
  return buildFrameWithSeq(0x2, flags, 0x0, 0x1, seq, compressed);
}

/** Parse a server response frame header. Returns { messageType, flags, serialization, compression, payload }. */
function parseFrame(data: Buffer): {
  messageType: number;
  flags: number;
  serialization: number;
  compression: number;
  payload: Buffer;
} | null {
  if (data.length < 4) return null;
  const messageType = (data[1]! >> 4) & 0x0f;
  const flags = data[1]! & 0x0f;
  const serialization = (data[2]! >> 4) & 0x0f;
  const compression = data[2]! & 0x0f;
  const headerSize = (data[0]! & 0x0f) * 4; // header_size field × 4

  // v3 bigmodel server responses: header(4) + sequence(4) + payload_size(4) + payload
  // The 4 bytes after header are sequence number, then 4 bytes payload size
  if (data.length < headerSize + 8) return null;
  const sequence = data.readUInt32BE(headerSize);
  const payloadSize = data.readUInt32BE(headerSize + 4);
  const payloadStart = headerSize + 8;
  const payload = data.subarray(payloadStart, payloadStart + payloadSize);
  return { messageType, flags, serialization, compression, payload };
}

/** Decompress payload if gzip, then parse as JSON. */
function parseJsonPayload(payload: Buffer, compression: number): any {
  let buf = payload;
  if (compression === 0x1) {
    // gzip
    const { gunzipSync } = require("node:zlib") as typeof import("node:zlib");
    buf = gunzipSync(payload);
  }
  return JSON.parse(buf.toString("utf8"));
}

// ─── Session Store ────────────────────────────────────────────────────

type VolcengineSession = {
  sessionId: string;
  connId: string;
  ws: WebSocket;
  connected: boolean;
  pendingChunks: Buffer[];
  finalText: string;
  currentPartial: string;
  audioSeq: number; // sequence counter for audio frames
  onConnected: (() => void) | null;
  onFinished: (() => void) | null;
  broadcast: ((event: string, data: unknown, connIds: Set<string>) => void) | null;
  timeoutTimer: ReturnType<typeof setTimeout> | null;
  closed: boolean;
};

const sessions = new Map<string, VolcengineSession>();
/** Max concurrent sessions to prevent memory exhaustion DoS. */
const MAX_SESSIONS = 20;

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

/** Clean up all Volcengine sessions for a disconnected connection. */
export function cleanupVolcengineSessionsForConn(connId: string): void {
  for (const [sessionId, session] of sessions) {
    if (session.connId === connId) cleanupSession(sessionId);
  }
}

// ─── Availability Check ───────────────────────────────────────────────

let _cachedKeyAvailable: boolean | null = null;
let _cachedKeyTs = 0;
const KEY_CACHE_TTL_MS = 30_000;

/** Volcengine speech API credentials (APP ID + Access Token).
 *  Reads from unified credentials store first, falls back to env vars. */
function getVolcengineCredentials(): { appId: string; accessToken: string } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getVolcengineVoiceCredentialsSync } =
      require("../../voice/volcengine-credentials.js") as typeof import("../../voice/volcengine-credentials.js");
    const creds = getVolcengineVoiceCredentialsSync();
    if (creds) return creds;
  } catch {
    /* ignore — module may not exist yet */
  }
  // Fallback to env vars
  const appId = process.env.VOLC_APP_ID;
  const accessToken = process.env.VOLC_ACCESS_TOKEN;
  if (appId && accessToken) return { appId, accessToken };
  return null;
}

/** Reset availability cache — call after credentials are saved so next check is fresh. */
export function resetVolcengineAvailabilityCache(): void {
  _cachedKeyAvailable = null;
  _cachedKeyTs = 0;
}

/** Check if Volcengine ASR API key is available. */
export function isVolcengineStreamAvailable(): boolean {
  const now = Date.now();
  if (_cachedKeyAvailable !== null && now - _cachedKeyTs < KEY_CACHE_TTL_MS) {
    return _cachedKeyAvailable;
  }
  _cachedKeyAvailable = getVolcengineCredentials() !== null;
  _cachedKeyTs = now;
  if (_cachedKeyAvailable) {
    console.log("[volcengine-asr] credentials found (VOLC_APP_ID + VOLC_ACCESS_TOKEN)");
  }
  return _cachedKeyAvailable;
}

// ─── WebSocket message handler ────────────────────────────────────────

function handleWsMessage(session: VolcengineSession, raw: WebSocket.RawData): void {
  if (session.closed) return;

  const data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
  const frame = parseFrame(data);
  if (!frame) return;

  const { messageType, compression, payload } = frame;

  // Server response with JSON (message_type 0x9)
  if (messageType === 0x9) {
    let msg: any;
    try {
      msg = parseJsonPayload(payload, compression);
    } catch {
      return;
    }

    // Extract recognition result — v3 bigmodel uses result.utterances[]
    const result = msg?.result?.utterances?.[0] ?? msg?.result?.[0] ?? msg?.payload?.result?.[0];
    if (result) {
      const text = (result.text as string) ?? "";
      const definite = result.definite === true;

      if (definite) {
        session.finalText += text;
        session.currentPartial = "";
      } else {
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
    }

    // Check if this is the last package
    if (msg?.is_last_package === true) {
      session.onFinished?.();
      session.onFinished = null;
    }
  }

  // Server error (message_type 0xF)
  if (messageType === 0xf) {
    let errMsg = "Volcengine ASR error";
    try {
      const msg = parseJsonPayload(payload, compression);
      errMsg = msg?.message ?? msg?.error ?? errMsg;
    } catch {
      /* ignore */
    }
    console.error(`[volcengine-asr] error: ${errMsg}`);
    session.onFinished?.();
    session.onFinished = null;
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────

export const volcengineStreamHandlers: GatewayRequestHandlers = {
  /**
   * Start a Volcengine streaming ASR session.
   */
  "asr.stream.start": async ({ respond, client, context }) => {
    const connId = typeof client?.connId === "string" ? client.connId : undefined;
    if (!connId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "no connection"));
      return;
    }

    const creds = getVolcengineCredentials();
    if (!creds) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          "未配置火山引擎语音凭证 (VOLC_APP_ID + VOLC_ACCESS_TOKEN)",
        ),
      );
      return;
    }
    if (sessions.size >= MAX_SESSIONS) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, "Too many concurrent ASR sessions"),
      );
      return;
    }

    const sessionId = crypto.randomBytes(12).toString("hex");
    const connectId = crypto.randomUUID();

    // Create WebSocket connection with X-Api headers
    let ws: WebSocket;
    try {
      ws = new WebSocket(VOLCENGINE_ASR_WS_URL, {
        headers: {
          "X-Api-App-Key": creds.appId,
          "X-Api-Access-Key": creds.accessToken,
          "X-Api-Resource-Id": "volc.bigasr.sauc.duration",
          "X-Api-Connect-Id": connectId,
        },
        handshakeTimeout: CONNECT_TIMEOUT_MS,
      });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
      return;
    }

    const session: VolcengineSession = {
      sessionId,
      connId,
      ws,
      connected: false,
      pendingChunks: [],
      finalText: "",
      currentPartial: "",
      audioSeq: 2, // seq=1 already used by full_client_request
      onConnected: null,
      onFinished: null,
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
        session.onConnected?.();
        session.onFinished?.();
      }
    });

    // Wait for connection open
    const openPromise = new Promise<boolean>((resolve) => {
      ws.on("open", () => resolve(true));
      ws.on("error", () => resolve(false));
      setTimeout(() => resolve(false), CONNECT_TIMEOUT_MS);
    });

    const connected = await openPromise;
    if (!connected || ws.readyState !== WebSocket.OPEN) {
      cleanupSession(sessionId);
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, "火山引擎 ASR WebSocket 连接失败"),
      );
      return;
    }

    // Send full_client_request
    const clientRequest = {
      user: { uid: connId },
      audio: {
        format: "pcm",
        rate: 16000,
        bits: 16,
        channel: 1,
        codec: "raw",
        language: "zh-CN",
      },
      request: {
        model_name: "bigmodel",
        enable_itn: true,
        enable_punc: true,
        result_type: "single",
        sequence: 1,
      },
    };

    ws.send(buildFullClientRequest(clientRequest));
    session.connected = true;

    // Flush any buffered audio
    for (const chunk of session.pendingChunks) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(buildAudioFrame(chunk, false, session.audioSeq++));
      }
    }
    session.pendingChunks = [];

    respond(true, { sessionId });
  },

  /**
   * Feed PCM16 audio to Volcengine ASR.
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

    const MAX_CHUNK_BASE64_LENGTH = 32768;
    if (pcmBase64.length > MAX_CHUNK_BASE64_LENGTH) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "chunk too large"));
      return;
    }

    const pcmBuffer = Buffer.from(pcmBase64, "base64");

    if (session.connected && session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(buildAudioFrame(pcmBuffer, false, session.audioSeq++));
    } else {
      session.pendingChunks.push(pcmBuffer);
    }

    respond(true, { ok: true });
  },

  /**
   * End a Volcengine streaming ASR session.
   */
  "asr.stream.end": async ({ params, respond, context }) => {
    const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
    const session = sessions.get(sessionId);

    if (!session) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "session not found"));
      return;
    }

    // Send last audio frame (empty, with last flag)
    if (session.ws.readyState === WebSocket.OPEN && session.connected) {
      session.ws.send(buildAudioFrame(Buffer.alloc(0), true, session.audioSeq++));

      // Wait for final result (with timeout)
      await new Promise<void>((resolve) => {
        session.onFinished = resolve;
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
