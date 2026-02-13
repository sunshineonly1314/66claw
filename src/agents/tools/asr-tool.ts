import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Type } from "@sinclair/typebox";

import { CONFIG_DIR } from "../../utils.js";
import type { AnyAgentTool } from "./common.js";
import { readStringParam } from "./common.js";

// ─── Constants ──────────────────────────────────────────────────────

const ASR_MODELS_DIR = path.join(CONFIG_DIR, "tools", "sherpa-onnx-asr", "models");

/** Supported model architectures. */
type AsrModelKind = "senseVoice" | "paraformer";

export type AsrModelEntry = {
  kind: AsrModelKind;
  dir: string;
  label: string;
};

// ─── Schema ─────────────────────────────────────────────────────────

const AsrToolSchema = Type.Object({
  audio_path: Type.String({
    description:
      "Absolute path to an audio file (WAV 16kHz mono preferred). " +
      "Supports WAV format. The file will be transcribed to text.",
  }),
  language: Type.Optional(
    Type.String({
      description:
        'Hint language code (e.g. "zh", "en", "ja"). ' +
        "SenseVoice auto-detects language; this is optional.",
    }),
  ),
});

// ─── Lazy loader for sherpa-onnx-node ───────────────────────────────

// sherpa-onnx-node does not ship TypeScript declarations.
// biome-ignore lint/suspicious/noExplicitAny: external untyped module
type SherpaModule = any;

let _sherpa: SherpaModule | null = null;

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

// ─── Model detection ────────────────────────────────────────────────

/** Check if a path is a directory, returning false on any error. */
function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Check if a model directory contains the required files. */
function isValidModelDir(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, "model.int8.onnx")) && fs.existsSync(path.join(dir, "tokens.txt"))
  );
}

export function detectInstalledModel(): AsrModelEntry | null {
  if (!fs.existsSync(ASR_MODELS_DIR)) return null;

  let entries: string[];
  try {
    entries = fs.readdirSync(ASR_MODELS_DIR);
  } catch {
    return null;
  }

  // Two-pass: prefer SenseVoice (best multilingual), fall back to Paraformer.
  let paraformerFallback: AsrModelEntry | null = null;

  for (const entry of entries) {
    const dir = path.join(ASR_MODELS_DIR, entry);
    if (!isDir(dir) || !isValidModelDir(dir)) continue;

    if (entry.includes("sense-voice")) {
      return { kind: "senseVoice", dir, label: entry };
    }

    if (!paraformerFallback && entry.includes("paraformer") && !entry.includes("streaming")) {
      paraformerFallback = { kind: "paraformer", dir, label: entry };
    }
  }

  return paraformerFallback;
}

// ─── Recognizer cache ───────────────────────────────────────────────

type CachedRecognizer = {
  // biome-ignore lint/suspicious/noExplicitAny: sherpa-onnx-node is untyped
  recognizer: any;
  modelLabel: string;
};

let _cachedRecognizer: CachedRecognizer | null = null;

function getOrCreateRecognizer(): CachedRecognizer {
  if (_cachedRecognizer) return _cachedRecognizer;

  const model = detectInstalledModel();
  if (!model) {
    throw new Error(
      "ASR 模型未安装。请在 Skills 页面找到「本地语音识别」并下载模型文件。\n" +
        "ASR model not installed. Go to Skills page → 'sherpa-onnx-asr' → download the model files.\n\n" +
        "手动下载:\n" +
        "  mkdir -p ~/.clawdbot/tools/sherpa-onnx-asr/models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17\n" +
        "  wget https://modelscope.cn/models/pengzhendong/sherpa-onnx-sense-voice-zh-en-ja-ko-yue/resolve/master/model.int8.onnx\n" +
        "  wget https://modelscope.cn/models/pengzhendong/sherpa-onnx-sense-voice-zh-en-ja-ko-yue/resolve/master/tokens.txt",
    );
  }

  const sherpa = loadSherpa();
  const modelPath = path.join(model.dir, "model.int8.onnx");
  const tokensPath = path.join(model.dir, "tokens.txt");
  const numThreads = Math.min(os.cpus().length, 4);

  // biome-ignore lint/suspicious/noExplicitAny: sherpa-onnx config is loosely typed
  const modelConfig: any =
    model.kind === "senseVoice"
      ? {
          senseVoice: { model: modelPath, useInverseTextNormalization: 1 },
          tokens: tokensPath,
          numThreads,
          provider: "cpu",
          debug: 0,
        }
      : {
          paraformer: { model: modelPath },
          tokens: tokensPath,
          numThreads,
          provider: "cpu",
          debug: 0,
        };

  const config = {
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig,
  };

  const recognizer = new sherpa.OfflineRecognizer(config);
  _cachedRecognizer = { recognizer, modelLabel: model.label };
  return _cachedRecognizer;
}

// ─── Audio conversion helper ────────────────────────────────────────

/**
 * Convert audio file to 16kHz mono WAV using ffmpeg if available.
 * Returns the path to a WAV file (either original or converted).
 */
function ensureWav(audioPath: string): { wavPath: string; needsCleanup: boolean } {
  const ext = path.extname(audioPath).toLowerCase();

  // Already a WAV — use directly
  if (ext === ".wav") {
    return { wavPath: audioPath, needsCleanup: false };
  }

  // Try ffmpeg conversion for non-WAV formats
  const tmpWav = path.join(
    os.tmpdir(),
    `clawdbot-asr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`,
  );

  try {
    execFileSync(
      "ffmpeg",
      ["-i", audioPath, "-ar", "16000", "-ac", "1", "-f", "wav", "-y", tmpWav],
      { timeout: 30000, windowsHide: true, stdio: "pipe" },
    );
    return { wavPath: tmpWav, needsCleanup: true };
  } catch {
    throw new Error(
      `Cannot process audio file "${path.basename(audioPath)}" (format: ${ext}).\n` +
        "Either provide a 16kHz mono WAV file, or install ffmpeg for auto-conversion.",
    );
  }
}

// ─── Core ASR function ──────────────────────────────────────────────

export type AsrResult = {
  success: boolean;
  text?: string;
  error?: string;
  latencyMs?: number;
  model?: string;
};

export function speechToText(audioPath: string): AsrResult {
  const startTime = Date.now();

  if (!fs.existsSync(audioPath)) {
    return { success: false, error: `Audio file not found: ${audioPath}` };
  }

  let wavPath: string;
  let needsCleanup = false;

  try {
    const converted = ensureWav(audioPath);
    wavPath = converted.wavPath;
    needsCleanup = converted.needsCleanup;
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }

  try {
    const sherpa = loadSherpa();
    const { recognizer, modelLabel } = getOrCreateRecognizer();

    const wave = sherpa.readWave(wavPath);
    const stream = recognizer.createStream();
    stream.acceptWaveform({ sampleRate: wave.sampleRate, samples: wave.samples });
    recognizer.decode(stream);
    const result = recognizer.getResult(stream);

    const text = typeof result === "string" ? result : (result?.text ?? "");

    return {
      success: true,
      text: text.trim(),
      latencyMs: Date.now() - startTime,
      model: modelLabel,
    };
  } catch (err) {
    return {
      success: false,
      error: `${(err as Error).message}`,
      latencyMs: Date.now() - startTime,
    };
  } finally {
    if (needsCleanup) {
      try {
        fs.unlinkSync(wavPath);
      } catch {
        /* ignore */
      }
    }
  }
}

// ─── Tool factory ───────────────────────────────────────────────────

export function createAsrTool(): AnyAgentTool {
  return {
    label: "ASR",
    name: "asr",
    description:
      "Transcribe audio file to text using local speech recognition (sherpa-onnx). " +
      "Supports Chinese (Mandarin), English, Japanese, Korean, Cantonese. " +
      "Input: path to audio file (WAV preferred). Output: transcribed text. " +
      "Use when the user sends a voice message or audio file that needs transcription.",
    parameters: AsrToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const audioPath = readStringParam(params, "audio_path", { required: true });

      const result = speechToText(audioPath);

      if (result.success && result.text) {
        const lines = [`Transcribed text: ${result.text}`];
        if (result.latencyMs != null) {
          lines.push(`(${result.latencyMs}ms, model: ${result.model ?? "unknown"})`);
        }
        return {
          content: [{ type: "text", text: lines.join("\n") }],
          details: {
            text: result.text,
            latencyMs: result.latencyMs,
            model: result.model,
          },
        };
      }

      return {
        content: [
          {
            type: "text",
            text: result.error ?? "Speech recognition failed",
          },
        ],
        details: { error: result.error },
      };
    },
  };
}
