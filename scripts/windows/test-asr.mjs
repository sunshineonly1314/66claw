#!/usr/bin/env node
/**
 * Test script for sherpa-onnx ASR integration.
 *
 * Usage:
 *   1. Download a model first:
 *      mkdir -p ~/.clawdbot/tools/sherpa-onnx-asr/models
 *      cd ~/.clawdbot/tools/sherpa-onnx-asr/models
 *      # Download & extract SenseVoice or Paraformer model
 *
 *   2. Run this test:
 *      node scripts/windows/test-asr.mjs [path-to-wav-file]
 *
 *   If no WAV file is provided, generates a silent WAV for smoke testing.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const CONFIG_DIR = path.join(os.homedir(), ".clawdbot");
const ASR_MODELS_DIR = path.join(CONFIG_DIR, "tools", "sherpa-onnx-asr", "models");

// ─── Step 1: Check sherpa-onnx-node is installed ───────────────────

console.log("=== sherpa-onnx ASR Test ===\n");

let sherpa;
try {
  sherpa = require("sherpa-onnx-node");
  console.log(`[OK] sherpa-onnx-node loaded (version: ${sherpa.version ?? "unknown"})`);
} catch (err) {
  console.error("[FAIL] Cannot load sherpa-onnx-node:", err.message);
  console.error("  Fix: npm install sherpa-onnx-node");
  process.exit(1);
}

// ─── Step 2: Check model directory ─────────────────────────────────

console.log(`\nModel directory: ${ASR_MODELS_DIR}`);

if (!fs.existsSync(ASR_MODELS_DIR)) {
  console.error("[FAIL] Model directory does not exist.");
  console.error(`  Fix: mkdir -p "${ASR_MODELS_DIR}"`);
  console.error("  Then download a model — see skills/sherpa-onnx-asr/SKILL.md");
  process.exit(1);
}

const modelDirs = fs.readdirSync(ASR_MODELS_DIR).filter((d) => {
  return fs.statSync(path.join(ASR_MODELS_DIR, d)).isDirectory();
});

if (modelDirs.length === 0) {
  console.error("[FAIL] No model directories found.");
  console.error("  Download SenseVoice model (228MB):");
  console.error(
    "  https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2",
  );
  console.error(`  Extract to: ${ASR_MODELS_DIR}/`);
  process.exit(1);
}

console.log(`[OK] Found model directories: ${modelDirs.join(", ")}`);

// ─── Step 3: Detect and load model ─────────────────────────────────

let modelDir = null;
let modelKind = null;

for (const dir of modelDirs) {
  const fullDir = path.join(ASR_MODELS_DIR, dir);
  const modelFile = path.join(fullDir, "model.int8.onnx");
  const tokensFile = path.join(fullDir, "tokens.txt");

  if (fs.existsSync(modelFile) && fs.existsSync(tokensFile)) {
    if (dir.includes("sense-voice")) {
      modelDir = fullDir;
      modelKind = "senseVoice";
      break;
    }
    if (dir.includes("paraformer") && !dir.includes("streaming")) {
      modelDir = fullDir;
      modelKind = "paraformer";
    }
  }
}

if (!modelDir) {
  console.error("[FAIL] No compatible model found (need model.int8.onnx + tokens.txt).");
  process.exit(1);
}

console.log(`[OK] Using model: ${path.basename(modelDir)} (${modelKind})`);

// ─── Step 4: Create recognizer ─────────────────────────────────────

console.log("\nCreating recognizer...");
const startLoad = Date.now();

let config;
if (modelKind === "senseVoice") {
  config = {
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      senseVoice: {
        model: path.join(modelDir, "model.int8.onnx"),
        useInverseTextNormalization: 1,
      },
      tokens: path.join(modelDir, "tokens.txt"),
      numThreads: Math.min(os.cpus().length, 4),
      provider: "cpu",
      debug: 0,
    },
  };
} else {
  config = {
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      paraformer: {
        model: path.join(modelDir, "model.int8.onnx"),
      },
      tokens: path.join(modelDir, "tokens.txt"),
      numThreads: Math.min(os.cpus().length, 4),
      provider: "cpu",
      debug: 0,
    },
  };
}

const recognizer = new sherpa.OfflineRecognizer(config);
console.log(`[OK] Recognizer created in ${Date.now() - startLoad}ms`);

// ─── Step 5: Run ASR on audio file ─────────────────────────────────

const wavArg = process.argv[2];
let wavPath;
let isGeneratedSilence = false;

if (wavArg && fs.existsSync(wavArg)) {
  wavPath = wavArg;
  console.log(`\nUsing provided audio file: ${wavPath}`);
} else {
  // Generate a short silent WAV for smoke test
  console.log("\nNo audio file provided — generating 1s silent WAV for smoke test...");
  wavPath = path.join(os.tmpdir(), `clawdbot-asr-test-${Date.now()}.wav`);
  isGeneratedSilence = true;

  const sampleRate = 16000;
  const duration = 1; // seconds
  const numSamples = sampleRate * duration;
  const dataSize = numSamples * 2; // 16-bit PCM
  const fileSize = 44 + dataSize;

  const buf = Buffer.alloc(fileSize);
  // RIFF header
  buf.write("RIFF", 0);
  buf.writeUInt32LE(fileSize - 8, 4);
  buf.write("WAVE", 8);
  // fmt chunk
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // chunk size
  buf.writeUInt16LE(1, 20); // PCM format
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  // data chunk
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  // samples are all zeros (silence)

  fs.writeFileSync(wavPath, buf);
  console.log(`[OK] Generated: ${wavPath}`);
}

console.log("\nRunning ASR...");
const startAsr = Date.now();

try {
  const wave = sherpa.readWave(wavPath);
  console.log(
    `[OK] Audio loaded: ${wave.samples.length} samples, ${wave.sampleRate}Hz, ${(wave.samples.length / wave.sampleRate).toFixed(1)}s`,
  );

  const stream = recognizer.createStream();
  stream.acceptWaveform({ sampleRate: wave.sampleRate, samples: wave.samples });
  recognizer.decode(stream);
  const result = recognizer.getResult(stream);

  const text = typeof result === "string" ? result : result?.text ?? "";
  const elapsed = Date.now() - startAsr;

  console.log(`\n${"─".repeat(50)}`);
  if (text.trim()) {
    console.log(`  Recognized text: "${text.trim()}"`);
  } else {
    console.log(
      `  Recognized text: (empty)${isGeneratedSilence ? " — expected for silent audio" : ""}`,
    );
  }
  console.log(`  Latency: ${elapsed}ms`);
  console.log(`${"─".repeat(50)}`);

  console.log("\n[OK] ASR test completed successfully!");
} catch (err) {
  console.error(`[FAIL] ASR error: ${err.message}`);
  process.exit(1);
} finally {
  if (isGeneratedSilence && wavPath) {
    try {
      fs.unlinkSync(wavPath);
    } catch {}
  }
}
