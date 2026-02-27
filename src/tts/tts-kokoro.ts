/**
 * Kokoro TTS — offline text-to-speech via sherpa-onnx-node.
 *
 * Kokoro 82M is a lightweight multilingual TTS model that runs on CPU.
 * Uses sherpa-onnx-node's built-in OfflineTts support.
 *
 * Model files expected at: ~/.openclawcn/voice-models/kokoro-82m/
 *   - model.onnx    (~86 MB)
 *   - voices.bin    (~34 MB)
 *   - tokens.txt    (~50 KB)
 */

import fs from "node:fs";
import path from "node:path";

import { CONFIG_DIR } from "../utils.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("tts/kokoro");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VOICE_MODELS_DIR = path.join(CONFIG_DIR, "voice-models");
const KOKORO_DIR = path.join(VOICE_MODELS_DIR, "kokoro-82m");

const REQUIRED_FILES = ["model.onnx", "voices.bin", "tokens.txt"];

/** Default Chinese female voice for Kokoro. */
const DEFAULT_VOICE = "zf_xiaoxiao";
const DEFAULT_SAMPLE_RATE = 22050;

// ---------------------------------------------------------------------------
// Lazy loader for sherpa-onnx-node
// ---------------------------------------------------------------------------

// sherpa-onnx-node does not ship TypeScript declarations.
// biome-ignore lint/suspicious/noExplicitAny: external untyped module
type SherpaModule = any;
// biome-ignore lint/suspicious/noExplicitAny: external untyped module
type OfflineTtsInstance = any;

let _sherpa: SherpaModule | null = null;
let _ttsInstance: OfflineTtsInstance | null = null;

function loadSherpa(): SherpaModule {
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

function getOrCreateTts(): OfflineTtsInstance {
  if (_ttsInstance) return _ttsInstance;

  if (!isKokoroInstalled()) {
    throw new Error("Kokoro model not installed");
  }

  const sherpa = loadSherpa();

  log.info("Loading Kokoro TTS model...");
  const start = Date.now();

  _ttsInstance = new sherpa.OfflineTts({
    offlineTtsModelConfig: {
      kokoro: {
        model: path.join(KOKORO_DIR, "model.onnx"),
        voices: path.join(KOKORO_DIR, "voices.bin"),
        tokens: path.join(KOKORO_DIR, "tokens.txt"),
        dataDir: "",
        lengthScale: 1.0,
      },
      debug: false,
      numThreads: Math.min(4, require("node:os").cpus().length || 2),
      provider: "cpu",
    },
    maxNumSentences: 0, // 0 = no limit — synthesize all sentences
  });

  log.info(`Kokoro TTS loaded in ${Date.now() - start}ms`);
  return _ttsInstance;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether the Kokoro model files are present.
 */
export function isKokoroInstalled(): boolean {
  if (!fs.existsSync(KOKORO_DIR)) return false;
  return REQUIRED_FILES.every((file) => {
    const filePath = path.join(KOKORO_DIR, file);
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
    } catch {
      return false;
    }
  });
}

/**
 * Synthesize text to speech using Kokoro via sherpa-onnx.
 *
 * @returns Base64-encoded WAV audio.
 */
export async function kokoroSynthesize(
  text: string,
  voice?: string,
): Promise<{
  ok: boolean;
  audioBase64?: string;
  format?: string;
  latencyMs?: number;
  error?: string;
}> {
  try {
    const tts = getOrCreateTts();
    const start = Date.now();

    const speakerId = voice ?? DEFAULT_VOICE;
    const audio = tts.generate({
      text,
      sid: speakerId,
      speed: 1.0,
    });

    if (!audio || !audio.samples || audio.samples.length === 0) {
      return { ok: false, error: "Kokoro returned empty audio" };
    }

    // Convert float32 samples to WAV buffer, then to base64
    const wavBuffer = float32ToWav(audio.samples, audio.sampleRate ?? DEFAULT_SAMPLE_RATE);
    const audioBase64 = wavBuffer.toString("base64");

    const latencyMs = Date.now() - start;
    log.info(`Kokoro synthesized ${text.length} chars in ${latencyMs}ms`);

    return {
      ok: true,
      audioBase64,
      format: "wav",
      latencyMs,
    };
  } catch (err) {
    const error = (err as Error).message;
    log.error(`Kokoro synthesis failed: ${error}`);
    return { ok: false, error };
  }
}

/**
 * Release the Kokoro TTS instance to free memory.
 */
export function disposeKokoro(): void {
  if (_ttsInstance) {
    try {
      if (typeof _ttsInstance.free === "function") {
        _ttsInstance.free();
      }
    } catch {
      // ignore
    }
    _ttsInstance = null;
    log.info("Kokoro TTS instance disposed");
  }
}

// ---------------------------------------------------------------------------
// WAV Encoding Helper
// ---------------------------------------------------------------------------

/**
 * Encode float32 samples into a WAV buffer (16-bit PCM).
 */
function float32ToWav(samples: Float32Array, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const headerSize = 44;

  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Convert float32 [-1, 1] to int16 [-32768, 32767]
  let offset = headerSize;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]!));
    const int16 = clamped < 0 ? clamped * 32768 : clamped * 32767;
    buffer.writeInt16LE(Math.round(int16), offset);
    offset += 2;
  }

  return buffer;
}
