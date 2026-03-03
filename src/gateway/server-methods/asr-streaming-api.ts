/**
 * API Streaming ASR — cloud-based speech recognition.
 *
 * Cloud APIs (OpenAI Whisper, Groq, Deepgram, DashScope, etc.) are non-streaming,
 * so we accumulate PCM chunks during the session and transcribe at end — same
 * pattern as asr-streaming-cpu.ts (SenseVoice).
 *
 * The provider is determined by user preference in voice-prefs.json.
 */

import crypto from "node:crypto";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers } from "./types.js";

// ─── Session Store ─────────────────────────────────────────────────────

type ApiStreamSession = {
  sessionId: string;
  connId: string;
  /** Accumulated PCM samples (float32, 16kHz mono). */
  samples: number[];
  lastFeedAt: number;
  timeoutTimer: ReturnType<typeof setTimeout> | null;
};

const sessions = new Map<string, ApiStreamSession>();
const SESSION_TIMEOUT_MS = 60_000;
const MAX_CHUNK_BASE64_LENGTH = 32768;
/** 16kHz mono * 120s = 1,920,000 samples max (~15MB float64 in memory). */
const MAX_SAMPLES = 16000 * 120;
/** Max concurrent sessions to prevent memory exhaustion DoS. */
const MAX_SESSIONS = 20;

function cleanupSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
  sessions.delete(sessionId);
}

/** Clean up all API ASR sessions for a disconnected connection. */
export function cleanupApiSessionsForConn(connId: string): void {
  for (const [sessionId, session] of sessions) {
    if (session.connId === connId) cleanupSession(sessionId);
  }
}

// ─── WAV encoding ──────────────────────────────────────────────────────

/** Convert Float32 samples (16kHz mono) to a WAV Buffer. */
function samplesToWavBuffer(samples: number[]): Buffer {
  const numSamples = samples.length;
  const sampleRate = 16000;
  const bitsPerSample = 16;
  const numChannels = 1;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * (bitsPerSample / 8);

  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;

  // RIFF header
  buffer.write("RIFF", offset);
  offset += 4;
  buffer.writeUInt32LE(36 + dataSize, offset);
  offset += 4;
  buffer.write("WAVE", offset);
  offset += 4;

  // fmt sub-chunk
  buffer.write("fmt ", offset);
  offset += 4;
  buffer.writeUInt32LE(16, offset);
  offset += 4;
  buffer.writeUInt16LE(1, offset);
  offset += 2; // PCM
  buffer.writeUInt16LE(numChannels, offset);
  offset += 2;
  buffer.writeUInt32LE(sampleRate, offset);
  offset += 4;
  buffer.writeUInt32LE(byteRate, offset);
  offset += 4;
  buffer.writeUInt16LE(blockAlign, offset);
  offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset);
  offset += 2;

  // data sub-chunk
  buffer.write("data", offset);
  offset += 4;
  buffer.writeUInt32LE(dataSize, offset);
  offset += 4;

  // PCM data (float32 → int16)
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    const val = s < 0 ? s * 0x8000 : s * 0x7fff;
    buffer.writeInt16LE(Math.round(val), offset);
    offset += 2;
  }

  return buffer;
}

// ─── API Transcription ─────────────────────────────────────────────────

export async function transcribeViaApi(wavBuffer: Buffer): Promise<string> {
  const { getVoicePrefsSync } = await import("../../voice/voice-prefs.js");
  const { collectProviderApiKeys } = await import("../../agents/live-auth-keys.js");
  const prefs = getVoicePrefsSync();
  const provider = prefs.asrProvider ?? "auto";

  // Resolve API key for provider
  const providerKeyMap: Record<string, string> = {
    openai: "openai",
    groq: "groq",
    deepgram: "deepgram",
    google: "google",
    dashscope: "dashscope",
    volcengine: "volcengine",
  };

  const keyProvider = providerKeyMap[provider];
  if (!keyProvider) {
    throw new Error(`Unknown API ASR provider: ${provider}`);
  }

  const keys = collectProviderApiKeys(keyProvider);
  if (keys.length === 0) {
    throw new Error(
      `No API key configured for provider: ${provider}. Please add your API key in settings.`,
    );
  }
  const apiKey = keys[0]!;

  // Default models per provider
  const defaultModels: Record<string, string> = {
    openai: "gpt-4o-mini-transcribe",
    groq: "whisper-large-v3-turbo",
    deepgram: "nova-3",
    google: "gemini-3-flash-preview",
    dashscope: "sensevoice-v1",
    volcengine: "asr",
  };

  // Base URLs per provider
  const baseUrls: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    groq: "https://api.groq.com/openai/v1",
    deepgram: "https://api.deepgram.com/v1",
    dashscope: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  };

  const model = prefs.asrModel || defaultModels[provider] || "whisper-1";

  // Route to the appropriate transcription function
  if (provider === "deepgram") {
    const { transcribeDeepgramAudio } =
      await import("../../media-understanding/providers/deepgram/audio.js");
    const result = await transcribeDeepgramAudio({
      buffer: wavBuffer,
      fileName: "recording.wav",
      mime: "audio/wav",
      apiKey,
      model,
      language: "zh",
      timeoutMs: 30_000,
    });
    return result.text;
  }

  if (provider === "google") {
    const { transcribeGeminiAudio } =
      await import("../../media-understanding/providers/google/audio.js");
    const result = await transcribeGeminiAudio({
      buffer: wavBuffer,
      fileName: "recording.wav",
      mime: "audio/wav",
      apiKey,
      model,
      timeoutMs: 30_000,
    });
    return result.text;
  }

  // OpenAI-compatible providers: openai, groq, dashscope, volcengine
  const { transcribeOpenAiCompatibleAudio } =
    await import("../../media-understanding/providers/openai/audio.js");
  const result = await transcribeOpenAiCompatibleAudio({
    buffer: wavBuffer,
    fileName: "recording.wav",
    mime: "audio/wav",
    apiKey,
    baseUrl: baseUrls[provider],
    model,
    language: "zh",
    timeoutMs: 30_000,
  });
  return result.text;
}

// ─── Check availability ────────────────────────────────────────────────

/** Check if API ASR is configured (provider selected + API key exists). */
export async function isApiAsrAvailable(): Promise<boolean> {
  try {
    const { getVoicePrefsSync, isApiAsrProvider } = await import("../../voice/voice-prefs.js");
    const prefs = getVoicePrefsSync();
    if (!isApiAsrProvider(prefs.asrProvider)) return false;

    const { collectProviderApiKeys } = await import("../../agents/live-auth-keys.js");
    const providerKeyMap: Record<string, string> = {
      openai: "openai",
      groq: "groq",
      deepgram: "deepgram",
      google: "google",
      dashscope: "dashscope",
      volcengine: "volcengine",
    };
    const keyProvider = providerKeyMap[prefs.asrProvider!];
    if (!keyProvider) return false;
    return collectProviderApiKeys(keyProvider).length > 0;
  } catch {
    return false;
  }
}

// ─── Handlers ──────────────────────────────────────────────────────────

export const apiStreamHandlers: GatewayRequestHandlers = {
  "asr.stream.start": async ({ respond, client }) => {
    const connId = typeof client?.connId === "string" ? client.connId : undefined;
    if (!connId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "no connection"));
      return;
    }

    try {
      const available = await isApiAsrAvailable();
      if (!available) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "API ASR not configured"));
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

      const sessionId = crypto.randomUUID();
      const session: ApiStreamSession = {
        sessionId,
        connId,
        samples: [],
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

    if (session.samples.length >= MAX_SAMPLES) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "recording too long (max 120s)"),
      );
      return;
    }

    try {
      // Decode base64 → aligned Int16 → Float32
      const buf = Buffer.from(pcmBase64, "base64");
      const aligned = new ArrayBuffer(buf.byteLength);
      new Uint8Array(aligned).set(buf);
      const int16 = new Int16Array(aligned);
      const remaining = MAX_SAMPLES - session.samples.length;
      const count = Math.min(int16.length, remaining);
      for (let i = 0; i < count; i++) {
        session.samples.push(int16[i]! / 32768);
      }
      session.lastFeedAt = Date.now();

      // Send recording indicator
      if (session.samples.length > 0) {
        context.broadcastToConnIds(
          "asr.partial",
          {
            sessionId,
            partial: "...",
            final: "",
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

  "asr.stream.end": async ({ params, respond, context }) => {
    const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
    const session = sessions.get(sessionId);
    if (!session) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "session not found"));
      return;
    }

    try {
      // Convert accumulated samples to WAV and call API
      const wavBuffer = samplesToWavBuffer(session.samples);
      const finalText = await transcribeViaApi(wavBuffer);

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
