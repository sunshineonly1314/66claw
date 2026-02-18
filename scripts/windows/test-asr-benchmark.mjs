#!/usr/bin/env node
/**
 * Performance benchmark for ASR.
 * Measures: cold start, warm latency, per-language accuracy & speed.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const CONFIG_DIR = path.join(os.homedir(), ".clawdbot");
const ASR_MODELS_DIR = path.join(CONFIG_DIR, "tools", "sherpa-onnx-asr", "models");
const MODEL_DIR = path.join(ASR_MODELS_DIR, "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17");
const TEST_WAVS = path.join(MODEL_DIR, "test_wavs");

const sherpa = require("sherpa-onnx-node");

console.log("=== ASR Performance Benchmark ===\n");
console.log(`Platform: ${os.platform()} ${os.arch()}`);
console.log(`CPU: ${os.cpus()[0]?.model ?? "unknown"} (${os.cpus().length} cores)`);
console.log(`RAM: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`);
console.log(`Node: ${process.version}`);
console.log(`sherpa-onnx: ${sherpa.version ?? "unknown"}`);
console.log();

// ─── Cold start benchmark ───────────────────────────────────────────

console.log("--- Cold Start (model loading) ---");
const coldStart = Date.now();
const recognizer = new sherpa.OfflineRecognizer({
  featConfig: { sampleRate: 16000, featureDim: 80 },
  modelConfig: {
    senseVoice: {
      model: path.join(MODEL_DIR, "model.int8.onnx"),
      useInverseTextNormalization: 1,
    },
    tokens: path.join(MODEL_DIR, "tokens.txt"),
    numThreads: Math.min(os.cpus().length, 4),
    provider: "cpu",
    debug: 0,
  },
});
const coldStartMs = Date.now() - coldStart;
console.log(`  Model load time: ${coldStartMs}ms\n`);

// ─── Per-language benchmarks ────────────────────────────────────────

const languages = [
  { code: "zh", file: "zh.wav", expected: "开放时间" },
  { code: "en", file: "en.wav", expected: "tribal" },
  { code: "ja", file: "ja.wav", expected: null },
  { code: "ko", file: "ko.wav", expected: null },
  { code: "yue", file: "yue.wav", expected: "唔" },
];

console.log("--- Per-Language Latency & Accuracy ---");
console.log("  Lang | Duration | Latency  | Speed  | Result");
console.log("  " + "─".repeat(72));

const results = [];

for (const lang of languages) {
  const wavPath = path.join(TEST_WAVS, lang.file);
  if (!fs.existsSync(wavPath)) {
    console.log(`  ${lang.code.padEnd(4)} | SKIP — file not found`);
    continue;
  }

  // Run 3 times, take median
  const latencies = [];
  let lastText = "";

  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    const wave = sherpa.readWave(wavPath);
    const stream = recognizer.createStream();
    stream.acceptWaveform({ sampleRate: wave.sampleRate, samples: wave.samples });
    recognizer.decode(stream);
    const result = recognizer.getResult(stream);
    const elapsed = Date.now() - start;
    latencies.push(elapsed);
    lastText = typeof result === "string" ? result : result?.text ?? "";
  }

  latencies.sort((a, b) => a - b);
  const medianLatency = latencies[1];

  const wave = sherpa.readWave(wavPath);
  const durationSec = wave.samples.length / wave.sampleRate;
  const rtf = medianLatency / 1000 / durationSec;

  const containsExpected = lang.expected ? lastText.includes(lang.expected) : true;

  results.push({
    lang: lang.code,
    durationSec,
    medianLatency,
    rtf,
    text: lastText.trim(),
    accurate: containsExpected,
  });

  const durationStr = `${durationSec.toFixed(1)}s`.padEnd(8);
  const latencyStr = `${medianLatency}ms`.padEnd(8);
  const rtfStr = `${rtf.toFixed(3)}x`.padEnd(6);
  const accuracyMark = containsExpected ? "OK" : "??";
  const textPreview = lastText.trim().slice(0, 40);

  console.log(`  ${lang.code.padEnd(4)} | ${durationStr} | ${latencyStr} | ${rtfStr} | [${accuracyMark}] ${textPreview}`);
}

// ─── Throughput test ────────────────────────────────────────────────

console.log("\n--- Throughput (sequential zh × 10) ---");
{
  const zhWav = path.join(TEST_WAVS, "zh.wav");
  const wave = sherpa.readWave(zhWav);
  const totalStart = Date.now();

  for (let i = 0; i < 10; i++) {
    const stream = recognizer.createStream();
    stream.acceptWaveform({ sampleRate: wave.sampleRate, samples: wave.samples });
    recognizer.decode(stream);
    recognizer.getResult(stream);
  }

  const totalMs = Date.now() - totalStart;
  const durationSec = wave.samples.length / wave.sampleRate;
  const totalAudioSec = durationSec * 10;
  const throughput = totalAudioSec / (totalMs / 1000);

  console.log(`  10 × ${durationSec.toFixed(1)}s = ${totalAudioSec.toFixed(1)}s audio`);
  console.log(`  Total time: ${totalMs}ms`);
  console.log(`  Throughput: ${throughput.toFixed(1)}x realtime`);
  console.log(`  Avg latency: ${(totalMs / 10).toFixed(0)}ms per clip`);
}

// ─── Summary ────────────────────────────────────────────────────────

console.log("\n--- Summary ---");
console.log(`  Model load:    ${coldStartMs}ms`);

const allAccurate = results.every((r) => r.accurate);
const avgLatency = results.reduce((s, r) => s + r.medianLatency, 0) / results.length;
const avgRtf = results.reduce((s, r) => s + r.rtf, 0) / results.length;

console.log(`  Avg latency:   ${avgLatency.toFixed(0)}ms (median over 3 runs)`);
console.log(`  Avg RTF:       ${avgRtf.toFixed(3)}x (lower = faster)`);
console.log(`  Accuracy:      ${allAccurate ? "ALL OK" : "SOME ISSUES"}`);
console.log(`  Languages:     ${results.map((r) => r.lang).join(", ")}`);
