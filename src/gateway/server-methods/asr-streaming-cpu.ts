/**
 * CPU ASR — hybrid streaming + offline architecture.
 *
 * When both streaming and offline models are installed:
 *   HYBRID MODE (best UX):
 *     - DURING recording: OnlineRecognizer (Streaming Paraformer) provides
 *       real-time incremental partial results for immediate visual feedback.
 *     - AT END: OfflineRecognizer (SenseVoice) runs on the complete accumulated
 *       audio for accurate final text. This avoids the Streaming Paraformer's
 *       inherent last-token-loss bug (IsReady gate traps last 61 frames,
 *       CIF mechanism won't emit tokens for silence padding).
 *
 * When only offline model is installed:
 *   OFFLINE FALLBACK:
 *     - Accumulates all audio, re-runs full recognition periodically (pseudo-streaming).
 *
 * Streaming models: encoder.int8.onnx + decoder.int8.onnx (Paraformer/Zipformer).
 * Offline models: model.int8.onnx (SenseVoice / offline Paraformer).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { CONFIG_DIR } from "../../utils.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers } from "./types.js";

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

// ─── Model detection ──────────────────────────────────────────────────

const ASR_MODELS_DIR = path.join(CONFIG_DIR, "tools", "sherpa-onnx-asr", "models");
const VOICE_MODELS_DIR = path.join(CONFIG_DIR, "voice-models");

type CpuAsrModel = {
  kind: "streamingParaformer" | "streamingZipformer" | "senseVoice" | "paraformer";
  dir: string;
  /** True if this model supports OnlineRecognizer (true streaming). */
  streaming: boolean;
};

/**
 * Detect installed ASR models. Prefers streaming models over offline models.
 * Scans voice-models dir first, then legacy tools dir.
 */
function detectCpuAsrModel(): CpuAsrModel | null {
  const dirs = [VOICE_MODELS_DIR, ASR_MODELS_DIR];

  let offlineFallback: CpuAsrModel | null = null;

  for (const baseDir of dirs) {
    if (!fs.existsSync(baseDir)) continue;
    let entries: string[];
    try {
      entries = fs.readdirSync(baseDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const dir = path.join(baseDir, entry);
      try {
        if (!fs.statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }

      const hasTokens = fs.existsSync(path.join(dir, "tokens.txt"));
      if (!hasTokens) continue;

      // ── Check for streaming models first (encoder + decoder) ──
      const hasEncoder =
        fs.existsSync(path.join(dir, "encoder.int8.onnx")) ||
        fs.existsSync(path.join(dir, "encoder.onnx"));
      const hasDecoder =
        fs.existsSync(path.join(dir, "decoder.int8.onnx")) ||
        fs.existsSync(path.join(dir, "decoder.onnx"));

      if (hasEncoder && hasDecoder) {
        if (entry.includes("paraformer") && entry.includes("streaming")) {
          return { kind: "streamingParaformer", dir, streaming: true };
        }
        if (entry.includes("zipformer")) {
          // Zipformer transducer also needs joiner
          const hasJoiner =
            fs.existsSync(path.join(dir, "joiner.int8.onnx")) ||
            fs.existsSync(path.join(dir, "joiner.onnx"));
          if (hasJoiner) {
            return { kind: "streamingZipformer", dir, streaming: true };
          }
        }
        // Generic streaming paraformer (no "streaming" in name but has encoder+decoder)
        if (entry.includes("paraformer")) {
          return { kind: "streamingParaformer", dir, streaming: true };
        }
      }

      // ── Offline models (model.int8.onnx) ──
      const hasModel = fs.existsSync(path.join(dir, "model.int8.onnx"));
      if (!hasModel) continue;

      if (entry.includes("sense-voice") && !offlineFallback) {
        offlineFallback = { kind: "senseVoice", dir, streaming: false };
      }
      if (entry.includes("paraformer") && !entry.includes("streaming") && !offlineFallback) {
        offlineFallback = { kind: "paraformer", dir, streaming: false };
      }
    }
  }

  return offlineFallback;
}

// ─── Recognizer cache ─────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: sherpa-onnx-node is untyped
let _cachedOnlineRecognizer: any = null;
// biome-ignore lint/suspicious/noExplicitAny: sherpa-onnx-node is untyped
let _cachedOfflineRecognizer: any = null;
let _cachedIsStreaming = false;

/**
 * Get or create the OnlineRecognizer (for true streaming partial results).
 * Returns null if no streaming model is installed.
 */
function getOrCreateOnlineRecognizer(): any {
  if (_cachedOnlineRecognizer) return _cachedOnlineRecognizer;

  const model = detectCpuAsrModel();
  if (!model?.streaming) return null;

  const sherpa = getSherpaModule();
  const tokensPath = path.join(model.dir, "tokens.txt");
  const numThreads = Math.min(os.cpus().length, 4);

  const encoderPath = fs.existsSync(path.join(model.dir, "encoder.int8.onnx"))
    ? path.join(model.dir, "encoder.int8.onnx")
    : path.join(model.dir, "encoder.onnx");
  const decoderPath = fs.existsSync(path.join(model.dir, "decoder.int8.onnx"))
    ? path.join(model.dir, "decoder.int8.onnx")
    : path.join(model.dir, "decoder.onnx");

  // biome-ignore lint/suspicious/noExplicitAny: dynamic config
  const modelConfig: any = {
    tokens: tokensPath,
    numThreads,
    provider: "cpu",
    debug: 0,
  };

  if (model.kind === "streamingParaformer") {
    modelConfig.paraformer = { encoder: encoderPath, decoder: decoderPath };
  } else if (model.kind === "streamingZipformer") {
    const joinerPath = fs.existsSync(path.join(model.dir, "joiner.int8.onnx"))
      ? path.join(model.dir, "joiner.int8.onnx")
      : path.join(model.dir, "joiner.onnx");
    modelConfig.transducer = { encoder: encoderPath, decoder: decoderPath, joiner: joinerPath };
  }

  const config = {
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig,
    decodingMethod: "greedy_search",
    enableEndpoint: 0,
  };

  console.log(`[asr-cpu] Creating OnlineRecognizer: ${model.kind} from ${model.dir}`);
  _cachedOnlineRecognizer = new sherpa.OnlineRecognizer(config);
  return _cachedOnlineRecognizer;
}

/**
 * Get or create the OfflineRecognizer (for final accurate recognition).
 * Prefers SenseVoice if installed, otherwise offline Paraformer.
 */
function getOrCreateOfflineRecognizer(): any {
  if (_cachedOfflineRecognizer) return _cachedOfflineRecognizer;

  const sherpa = getSherpaModule();
  const numThreads = Math.min(os.cpus().length, 4);

  // Scan for offline model specifically (we need this even when streaming model exists)
  const dirs = [VOICE_MODELS_DIR, ASR_MODELS_DIR];
  let offlineModel: { kind: string; dir: string } | null = null;

  for (const baseDir of dirs) {
    if (!fs.existsSync(baseDir)) continue;
    let entries: string[];
    try {
      entries = fs.readdirSync(baseDir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const dir = path.join(baseDir, entry);
      try {
        if (!fs.statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }
      if (!fs.existsSync(path.join(dir, "tokens.txt"))) continue;
      if (!fs.existsSync(path.join(dir, "model.int8.onnx"))) continue;

      if (entry.includes("sense-voice")) {
        offlineModel = { kind: "senseVoice", dir };
        break; // prefer SenseVoice
      }
      if (!offlineModel && entry.includes("paraformer") && !entry.includes("streaming")) {
        offlineModel = { kind: "paraformer", dir };
      }
    }
    if (offlineModel?.kind === "senseVoice") break;
  }

  if (!offlineModel) return null;

  const tokensPath = path.join(offlineModel.dir, "tokens.txt");
  const modelPath = path.join(offlineModel.dir, "model.int8.onnx");

  // biome-ignore lint/suspicious/noExplicitAny: dynamic config
  const modelConfig: any = {
    tokens: tokensPath,
    numThreads,
    provider: "cpu",
    debug: 0,
  };

  if (offlineModel.kind === "senseVoice") {
    modelConfig.senseVoice = { model: modelPath, useInverseTextNormalization: 1 };
  } else {
    modelConfig.paraformer = { model: modelPath };
  }

  const config = {
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig,
  };

  console.log(
    `[asr-cpu] Creating OfflineRecognizer: ${offlineModel.kind} from ${offlineModel.dir}`,
  );
  _cachedOfflineRecognizer = new sherpa.OfflineRecognizer(config);
  return _cachedOfflineRecognizer;
}

/** Legacy single-recognizer getter for pure offline mode. */
function getOrCreateRecognizer() {
  const model = detectCpuAsrModel();
  if (model?.streaming) {
    const online = getOrCreateOnlineRecognizer();
    if (online) {
      _cachedIsStreaming = true;
      return online;
    }
  }
  const offline = getOrCreateOfflineRecognizer();
  if (offline) {
    _cachedIsStreaming = false;
    return offline;
  }
  throw new Error("CPU ASR model not installed");
}

// ─── Session Store ─────────────────────────────────────────────────────

type CpuStreamSession = {
  sessionId: string;
  connId: string;
  lastFeedAt: number;
  timeoutTimer: ReturnType<typeof setTimeout> | null;
} & (
  | {
      /**
       * HYBRID mode: OnlineRecognizer for real-time partials during recording,
       * OfflineRecognizer for accurate final text at end (no missing last token).
       */
      mode: "streaming";
      // biome-ignore lint/suspicious/noExplicitAny: sherpa-onnx-node is untyped
      stream: any;
      lastText: string;
      /** Accumulated raw Float32 samples for offline final recognition. */
      allSamples: Float32Array[];
      allSamplesCount: number;
    }
  | {
      /** Offline fallback session — accumulates samples. */
      mode: "offline";
      samples: number[];
      lastPartialText: string;
      samplesAtLastPartial: number;
    }
);

const sessions = new Map<string, CpuStreamSession>();
const SESSION_TIMEOUT_MS = 60_000;
const MAX_CHUNK_BASE64_LENGTH = 32768;
/** Max concurrent sessions to prevent memory exhaustion DoS. */
const MAX_SESSIONS = 20;
/** Offline mode: run partial recognition every ~2s of new audio. */
const PARTIAL_RECOGNITION_INTERVAL_SAMPLES = 32000;
/** Offline mode: max samples for partial recognition (~15s). */
const PARTIAL_MAX_SAMPLES = 240000;

function cleanupSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
  sessions.delete(sessionId);
}

export function cleanupCpuSessionsForConn(connId: string): void {
  for (const [sessionId, session] of sessions) {
    if (session.connId === connId) {
      cleanupSession(sessionId);
    }
  }
}

/** Recognize samples using OfflineRecognizer. Accepts number[] or Float32Array. */
function recognizeSamples(samples: number[] | Float32Array): string {
  if (samples.length === 0) return "";

  const recognizer = getOrCreateOfflineRecognizer();
  if (!recognizer) throw new Error("No offline ASR model available");
  const stream = recognizer.createStream();
  const wave = samples instanceof Float32Array ? samples : new Float32Array(samples);
  stream.acceptWaveform({ sampleRate: 16000, samples: wave });
  recognizer.decode(stream);
  const result = recognizer.getResult(stream);
  const text = (result?.text ?? "").trim();
  return text;
}

/** Merge multiple Float32Array chunks into a single Float32Array. */
function mergeFloat32Arrays(chunks: Float32Array[], totalLength: number): Float32Array {
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

/** Check if CPU ASR model is installed and sherpa-onnx is available. */
export function isCpuAsrAvailable(): boolean {
  try {
    getSherpaModule();
    return detectCpuAsrModel() !== null;
  } catch {
    return false;
  }
}

/** Check if a true streaming CPU model is available (for router priority). */
export function detectCpuStreamingModel(): boolean {
  try {
    getSherpaModule();
    const model = detectCpuAsrModel();
    return model?.streaming === true;
  } catch {
    return false;
  }
}

// ─── Handlers ──────────────────────────────────────────────────────────

export const cpuStreamHandlers: GatewayRequestHandlers = {
  "asr.stream.status": async ({ respond }) => {
    try {
      const available = isCpuAsrAvailable();
      const model = detectCpuAsrModel();
      const label = model
        ? model.streaming
          ? `${model.kind} (CPU, true streaming)`
          : `${model.kind} (CPU, offline)`
        : null;
      respond(true, {
        available,
        model: label,
        method: model?.streaming ? "cpu-streaming" : "cpu-offline",
      });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  "asr.stream.start": async ({ respond, client }) => {
    const connId = typeof client?.connId === "string" ? client.connId : undefined;
    if (!connId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "no connection"));
      return;
    }

    try {
      if (!isCpuAsrAvailable()) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.UNAVAILABLE, "CPU ASR model not installed"),
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

      const recognizer = getOrCreateRecognizer();
      const sessionId = crypto.randomUUID();

      let session: CpuStreamSession;

      if (_cachedIsStreaming) {
        // Hybrid mode: OnlineRecognizer for partials, OfflineRecognizer for final
        const stream = recognizer.createStream();
        session = {
          sessionId,
          connId,
          lastFeedAt: Date.now(),
          timeoutTimer: null,
          mode: "streaming",
          stream,
          lastText: "",
          allSamples: [],
          allSamplesCount: 0,
        };
        console.log(`[asr-cpu] Started hybrid streaming session ${sessionId}`);
      } else {
        // Offline fallback
        session = {
          sessionId,
          connId,
          lastFeedAt: Date.now(),
          timeoutTimer: null,
          mode: "offline",
          samples: [],
          lastPartialText: "",
          samplesAtLastPartial: 0,
        };
        console.log(`[asr-cpu] Started offline session ${sessionId}`);
      }

      session.timeoutTimer = setTimeout(() => {
        cleanupSession(sessionId);
      }, SESSION_TIMEOUT_MS);

      sessions.set(sessionId, session);
      respond(true, { sessionId });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

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
      // Decode base64 → Int16 → Float32 (use aligned copy to avoid RangeError on odd byteOffset)
      const buf = Buffer.from(pcmBase64, "base64");
      const aligned = new ArrayBuffer(buf.byteLength);
      new Uint8Array(aligned).set(buf);
      const int16 = new Int16Array(aligned);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i]! / 32768;
      }
      session.lastFeedAt = Date.now();

      if (session.mode === "streaming") {
        // ── Hybrid: OnlineRecognizer for real-time partials ──
        const recognizer = getOrCreateOnlineRecognizer();
        if (!recognizer) {
          respond(
            false,
            undefined,
            errorShape(ErrorCodes.UNAVAILABLE, "online recognizer unavailable"),
          );
          return;
        }
        session.stream.acceptWaveform({ sampleRate: 16000, samples: float32 });

        // Accumulate for offline final recognition at end
        session.allSamples.push(float32);
        session.allSamplesCount += float32.length;

        // Decode as many frames as available
        while (recognizer.isReady(session.stream)) {
          recognizer.decode(session.stream);
        }

        const result = recognizer.getResult(session.stream);
        const text = (result?.text ?? "").trim();

        // Broadcast partial result (always, serves as heartbeat)
        if (text !== session.lastText) {
          session.lastText = text;
        }
        if (text) {
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
        }
      } else {
        // ── Offline fallback: accumulate and periodically re-recognize ──
        const CPU_MAX_SAMPLES = 16000 * 120; // 120s at 16kHz
        if (session.samples.length + float32.length > CPU_MAX_SAMPLES) {
          respond(
            false,
            undefined,
            errorShape(ErrorCodes.INVALID_REQUEST, "recording too long (max 120s)"),
          );
          return;
        }
        for (let i = 0; i < float32.length; i++) {
          session.samples.push(float32[i]!);
        }

        const newSamplesSincePartial = session.samples.length - session.samplesAtLastPartial;
        if (newSamplesSincePartial >= PARTIAL_RECOGNITION_INTERVAL_SAMPLES) {
          session.samplesAtLastPartial = session.samples.length;
          try {
            const partialSamples =
              session.samples.length > PARTIAL_MAX_SAMPLES
                ? session.samples.slice(-PARTIAL_MAX_SAMPLES)
                : session.samples;
            const partialText = recognizeSamples(partialSamples);
            session.lastPartialText = partialText;

            context.broadcastToConnIds(
              "asr.partial",
              {
                sessionId,
                partial: partialText,
                final: "",
                isFinal: false,
              },
              new Set([session.connId]),
            );
          } catch (err) {
            console.warn("[asr-cpu] partial recognition failed:", formatForLog(err));
            context.broadcastToConnIds(
              "asr.partial",
              {
                sessionId,
                partial: session.lastPartialText || "...",
                final: "",
                isFinal: false,
              },
              new Set([session.connId]),
            );
          }
        } else if (session.samples.length > 0) {
          context.broadcastToConnIds(
            "asr.partial",
            {
              sessionId,
              partial: session.lastPartialText || "...",
              final: "",
              isFinal: false,
            },
            new Set([session.connId]),
          );
        }
      }

      respond(true, { ok: true });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },

  "asr.stream.end": async ({ params, respond, context }) => {
    const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
    const session = sessions.get(sessionId);
    if (!session) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "session not found"));
      return;
    }

    try {
      let finalText: string;

      if (session.mode === "streaming") {
        // ── Hybrid end: use OfflineRecognizer for accurate final text ──
        // The OnlineRecognizer (Streaming Paraformer) always loses the last
        // token due to IsReady() gate + CIF mechanism. The OfflineRecognizer
        // (SenseVoice) processes the complete audio and returns all tokens.
        const streamingText = session.lastText;
        const totalSamples = session.allSamplesCount;

        if (totalSamples === 0) {
          finalText = "";
        } else {
          const offlineRecognizer = getOrCreateOfflineRecognizer();
          if (offlineRecognizer) {
            // Merge all accumulated chunks and run offline recognition
            const merged = mergeFloat32Arrays(session.allSamples, totalSamples);
            // Offline models handle up to ~30s well; for longer audio, segment
            const MAX_OFFLINE = 480000; // 30s at 16kHz
            if (merged.length <= MAX_OFFLINE) {
              finalText = recognizeSamples(merged);
            } else {
              // Segment long audio with overlap
              const SEG = 400000; // 25s
              const OVERLAP = 32000; // 2s
              const segments: string[] = [];
              let off = 0;
              while (off < merged.length) {
                const end = Math.min(off + SEG, merged.length);
                segments.push(recognizeSamples(merged.subarray(off, end)));
                off = end - OVERLAP;
                if (end >= merged.length) break;
              }
              finalText = segments.filter(Boolean).join("");
            }
            console.log(
              `[asr-cpu] Hybrid end: streaming="${streamingText}" offline="${finalText}"`,
            );
          } else {
            // No offline model available — use streaming result as-is
            finalText = streamingText;
            console.log(`[asr-cpu] Hybrid end: no offline model, using streaming="${finalText}"`);
          }
        }

        console.log(
          `[asr-cpu] Session ${sessionId} ended (${(totalSamples / 16000).toFixed(1)}s audio): "${finalText}"`,
        );
      } else {
        // ── Offline fallback: full recognition ──
        const MAX_SEGMENT = 400000;
        const OVERLAP = 32000;
        if (session.samples.length <= 480000) {
          finalText = recognizeSamples(session.samples);
        } else {
          const segments: string[] = [];
          let offset = 0;
          while (offset < session.samples.length) {
            const end = Math.min(offset + MAX_SEGMENT, session.samples.length);
            segments.push(recognizeSamples(session.samples.slice(offset, end)));
            offset = end - OVERLAP;
            if (end >= session.samples.length) break;
          }
          finalText = segments.filter(Boolean).join("");
        }

        console.log(`[asr-cpu] Offline session ${sessionId} ended: "${finalText}"`);
      }

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

      cleanupSession(sessionId);
      respond(true, { text: finalText });
    } catch (err) {
      cleanupSession(sessionId);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
};
