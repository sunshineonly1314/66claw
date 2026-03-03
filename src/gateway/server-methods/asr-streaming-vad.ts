/**
 * Streaming ASR — VAD + Qwen3-ASR (GPU) 分段流式语音识别 (CPU fallback)。
 *
 * 浏览器每 250ms 发送一个 base64 PCM16 块（16kHz mono），
 * 服务端用 Silero VAD (CPU) 检测语音段落，
 * 每个段落发送到 GPU voice-server (Qwen3-ASR) 进行识别，
 * 通过 "asr.partial" event 推送结果回浏览器。
 *
 * This is the fallback mode when GPU streaming (1s sliding window) is unavailable.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { CONFIG_DIR } from "../../utils.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers } from "./types.js";
import { getGpuSidecarState } from "../../voice/gpu-sidecar.js";

// ─── Types ────────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: sherpa-onnx-node is untyped
type SherpaModule = any;

// ─── Sherpa-onnx-node lazy loader ─────────────────────────────────────

let _sherpa: SherpaModule | null = null;

function getSherpaModule(): SherpaModule {
  if (_sherpa) return _sherpa;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _sherpa = require("sherpa-onnx-node");
    return _sherpa;
  } catch (err) {
    throw new Error(
      `sherpa-onnx-node not installed. Run: npm install sherpa-onnx-node\n${(err as Error).message}`,
    );
  }
}

// ─── VAD model detection ──────────────────────────────────────────────

const VAD_MODELS_DIR = path.join(CONFIG_DIR, "voice-models");

/**
 * Detect installed Silero VAD model. Returns path to model file or null.
 */
function detectVadModel(): string | null {
  const candidates = [
    path.join(VAD_MODELS_DIR, "silero_vad.onnx"),
    path.join(CONFIG_DIR, "tools", "sherpa-onnx-asr", "silero_vad.onnx"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

type StreamingAsrSession = {
  sessionId: string;
  connId: string;
  // biome-ignore lint/suspicious/noExplicitAny: sherpa-onnx-node VAD instance
  vad: any;
  lastFeedAt: number;
  /** Accumulated final text from all recognized speech segments. */
  finalText: string;
  /** Pending samples that haven't been fed to VAD yet (need to feed in windowSize chunks). */
  pendingBuffer: number[];
  timeoutTimer: ReturnType<typeof setTimeout> | null;
};

// ─── Singleton VAD config ─────────────────────────────────────────────

const VAD_SAMPLE_RATE = 16000;
const VAD_WINDOW_SIZE = 512; // Silero VAD requires exactly this many samples per call

// ─── Session Store ─────────────────────────────────────────────────────

const sessions = new Map<string, StreamingAsrSession>();

const SESSION_TIMEOUT_MS = 35_000; // 30s max recording + 5s buffer
const MAX_CHUNK_BASE64_LENGTH = 32768; // ~24KB decoded
/** Max concurrent sessions to prevent memory exhaustion DoS. */
const MAX_SESSIONS = 20;

function cleanupSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
  // Free VAD resources
  try {
    session.vad.reset();
    session.vad.clear();
  } catch {
    /* ignore */
  }
  sessions.delete(sessionId);
}

/** Clean up all VAD sessions for a given connection (called on WS disconnect). */
export function cleanupVadSessionsForConn(connId: string): void {
  for (const [sessionId, session] of sessions) {
    if (session.connId === connId) {
      cleanupSession(sessionId);
    }
  }
}

// ─── GPU sidecar port ─────────────────────────────────────────────────

/** Dynamic port from gpu-sidecar.ts — single source of truth. */
function gpuPort(): number {
  return getGpuSidecarState().port;
}

// ─── VAD → Qwen3-ASR (GPU) recognition ───────────────────────────────

/**
 * Extract all completed speech segments from the VAD as Float32Array samples.
 */
function extractVadSegments(
  // biome-ignore lint/suspicious/noExplicitAny: sherpa-onnx VAD instance
  vad: any,
): Float32Array[] {
  const segments: Float32Array[] = [];
  while (!vad.isEmpty()) {
    const segment = vad.front();
    vad.pop();
    if (segment?.samples?.length > 0) {
      segments.push(new Float32Array(segment.samples));
    }
  }
  return segments;
}

/**
 * Send PCM float32 samples to Qwen3-ASR GPU sidecar for recognition.
 */
async function recognizeWithGpu(samples: Float32Array): Promise<string> {
  const buf = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const pcmBase64 = buf.toString("base64");

  const res = await fetch(`http://127.0.0.1:${gpuPort()}/transcribe-pcm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pcm_base64: pcmBase64, sample_rate: VAD_SAMPLE_RATE }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`GPU sidecar error: ${res.status}`);
  }

  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

/**
 * Process completed VAD segments via Qwen3-ASR GPU sidecar.
 */
async function processVadSegments(
  // biome-ignore lint/suspicious/noExplicitAny: sherpa-onnx VAD instance
  vad: any,
): Promise<string[]> {
  const segments = extractVadSegments(vad);
  if (segments.length === 0) return [];

  const texts: string[] = [];
  for (const samples of segments) {
    try {
      const text = await recognizeWithGpu(samples);
      if (text) texts.push(text);
    } catch {
      // GPU recognition failed for this segment, skip
    }
  }
  return texts;
}

// ─── Handlers ──────────────────────────────────────────────────────────

/**
 * Check if GPU sidecar is reachable and ASR-ready.
 */
async function isGpuAsrAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${gpuPort()}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { asr?: boolean };
    return data.asr === true;
  } catch {
    return false;
  }
}

export const vadStreamHandlers: GatewayRequestHandlers = {
  /**
   * Check if VAD + Qwen3-ASR streaming is available.
   */
  "asr.stream.status": async ({ respond }) => {
    try {
      const vadModelPath = detectVadModel();
      const gpuReady = await isGpuAsrAvailable();
      respond(true, {
        available: vadModelPath !== null && gpuReady,
        model: gpuReady ? "Qwen3-ASR-0.6B (GPU)" : null,
        method: "vad+qwen3-asr",
      });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Start a new streaming ASR session with VAD.
   * Returns: { sessionId }
   */
  "asr.stream.start": async ({ respond, client }) => {
    const connId = typeof client?.connId === "string" ? client.connId : undefined;
    if (!connId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "no connection"));
      return;
    }

    try {
      const vadModelPath = detectVadModel();
      if (!vadModelPath) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.UNAVAILABLE, "Silero VAD model not installed"),
        );
        return;
      }

      // Verify GPU sidecar is ready
      const gpuReady = await isGpuAsrAvailable();
      if (!gpuReady) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.UNAVAILABLE, "Qwen3-ASR GPU sidecar not ready"),
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

      const sherpa = getSherpaModule();

      const vadConfig = {
        sileroVad: {
          model: vadModelPath,
          threshold: 0.5,
          minSilenceDuration: 0.3,
          minSpeechDuration: 0.25,
          windowSize: VAD_WINDOW_SIZE,
          maxSpeechDuration: 10,
        },
        sampleRate: VAD_SAMPLE_RATE,
        numThreads: 1,
        provider: "cpu",
        debug: 0,
      };

      const vad = new sherpa.Vad(vadConfig, 30);

      const sessionId = crypto.randomUUID();
      const session: StreamingAsrSession = {
        sessionId,
        connId,
        vad,
        lastFeedAt: Date.now(),
        finalText: "",
        pendingBuffer: [],
        timeoutTimer: null,
      };

      session.timeoutTimer = setTimeout(() => {
        cleanupSession(sessionId);
      }, SESSION_TIMEOUT_MS);

      sessions.set(sessionId, session);
      respond(true, { sessionId });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * Feed a base64-encoded PCM16 chunk to an active VAD session.
   * Decodes, feeds to VAD in windowSize chunks, processes completed segments via GPU.
   */
  "asr.stream.feed": async ({ params, respond, client, context }) => {
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
      // Decode base64 → Int16 → Float32
      const buf = Buffer.from(pcmBase64, "base64");
      const aligned = new ArrayBuffer(buf.byteLength);
      new Uint8Array(aligned).set(buf);
      const int16 = new Int16Array(aligned);
      const float32Arr: number[] = [];
      for (let i = 0; i < int16.length; i++) {
        float32Arr.push(int16[i]! / 32768);
      }

      for (const s of float32Arr) {
        session.pendingBuffer.push(s);
      }
      session.lastFeedAt = Date.now();

      // Feed VAD in exact windowSize chunks
      while (session.pendingBuffer.length >= VAD_WINDOW_SIZE) {
        const chunk = new Float32Array(session.pendingBuffer.splice(0, VAD_WINDOW_SIZE));
        session.vad.acceptWaveform(chunk);
      }

      // Process completed speech segments via GPU
      const newTexts = await processVadSegments(session.vad);

      if (newTexts.length > 0) {
        for (const t of newTexts) {
          session.finalText += t;
        }

        context.broadcastToConnIds(
          "asr.partial",
          {
            sessionId,
            partial: "",
            final: session.finalText,
            isFinal: true,
          },
          new Set([session.connId]),
        );
      } else if (session.vad.isDetected?.()) {
        context.broadcastToConnIds(
          "asr.partial",
          {
            sessionId,
            partial: "...",
            final: session.finalText,
            isFinal: false,
          },
          new Set([session.connId]),
        );
      }

      respond(true, { ok: true });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  /**
   * End a streaming session. Flushes VAD and processes remaining segments via GPU.
   */
  "asr.stream.end": async ({ params, respond }) => {
    const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
    const session = sessions.get(sessionId);
    if (!session) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "session not found"));
      return;
    }

    try {
      if (session.pendingBuffer.length > 0) {
        const padded = new Float32Array(VAD_WINDOW_SIZE);
        for (let i = 0; i < session.pendingBuffer.length; i++) {
          padded[i] = session.pendingBuffer[i]!;
        }
        session.vad.acceptWaveform(padded);
        session.pendingBuffer = [];
      }

      session.vad.flush();

      const newTexts = await processVadSegments(session.vad);
      for (const t of newTexts) {
        session.finalText += (session.finalText ? "" : "") + t;
      }

      const finalText = session.finalText;
      cleanupSession(sessionId);
      respond(true, { text: finalText });
    } catch (err) {
      cleanupSession(sessionId);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
};
