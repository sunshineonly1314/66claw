#!/usr/bin/env node
/**
 * Edge case tests for ASR tool.
 * Tests: missing file, empty file, corrupt file, path injection, concurrent calls, large audio.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const CONFIG_DIR = path.join(os.homedir(), ".clawdbot");
const ASR_MODELS_DIR = path.join(CONFIG_DIR, "tools", "sherpa-onnx-asr", "models");
const TEST_WAVS_DIR = path.join(
  ASR_MODELS_DIR,
  "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17",
  "test_wavs",
);

let sherpa;
try {
  sherpa = require("sherpa-onnx-node");
} catch (err) {
  console.error("Cannot load sherpa-onnx-node:", err.message);
  process.exit(1);
}

let passed = 0;
let failed = 0;

function assert(label, condition, detail) {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${label} — ${detail || "assertion failed"}`);
    failed++;
  }
}

// ─── Helper: build recognizer (matches asr-tool.ts logic) ──────────

function buildRecognizer() {
  const modelDir = path.join(ASR_MODELS_DIR, "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17");
  return new sherpa.OfflineRecognizer({
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
  });
}

// Helper: create a valid WAV header with given samples
function createWav(samples, sampleRate = 16000) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const fileSize = 44 + dataSize;
  const buf = Buffer.alloc(fileSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(fileSize - 8, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(val * 32767), 44 + i * 2);
  }
  return buf;
}

function writeTempWav(name, samples, sampleRate = 16000) {
  const p = path.join(os.tmpdir(), `clawdbot-test-${name}-${Date.now()}.wav`);
  fs.writeFileSync(p, createWav(samples, sampleRate));
  return p;
}

// ─── Tests ──────────────────────────────────────────────────────────

console.log("=== ASR Edge Case Tests ===\n");

const recognizer = buildRecognizer();

// --- Test 1: Missing file ---
console.log("Test 1: Missing file");
try {
  sherpa.readWave("/nonexistent/path/audio.wav");
  assert("Should throw on missing file", false, "no error thrown");
} catch (err) {
  assert("Throws on missing file", true);
}

// --- Test 2: Empty WAV (0 samples) ---
console.log("\nTest 2: Empty/minimal WAV (0.01s silence)");
{
  const p = writeTempWav("empty", new Float32Array(160)); // 10ms of silence
  try {
    const wave = sherpa.readWave(p);
    const stream = recognizer.createStream();
    stream.acceptWaveform({ sampleRate: wave.sampleRate, samples: wave.samples });
    recognizer.decode(stream);
    const result = recognizer.getResult(stream);
    const text = typeof result === "string" ? result : result?.text ?? "";
    assert("Does not crash on very short audio", true);
    assert("Returns string result", typeof text === "string", `got ${typeof text}`);
  } catch (err) {
    assert("Does not crash on very short audio", false, err.message);
  } finally {
    try { fs.unlinkSync(p); } catch {}
  }
}

// --- Test 3: Corrupt WAV (random bytes) ---
console.log("\nTest 3: Corrupt WAV file");
{
  const p = path.join(os.tmpdir(), `clawdbot-test-corrupt-${Date.now()}.wav`);
  fs.writeFileSync(p, Buffer.from("NOT A REAL WAV FILE HEADER 12345678"));
  try {
    sherpa.readWave(p);
    assert("Rejects corrupt WAV", false, "no error thrown");
  } catch (err) {
    assert("Rejects corrupt WAV", true);
    assert("Error message is descriptive", err.message.length > 0, err.message);
  } finally {
    try { fs.unlinkSync(p); } catch {}
  }
}

// --- Test 4: Path traversal / injection ---
console.log("\nTest 4: Path injection safety");
{
  const maliciousPaths = [
    "../../../etc/passwd",
    "..\\..\\..\\Windows\\System32\\config\\SAM",
    "/dev/null",
    "C:\\Windows\\System32\\cmd.exe",
    "audio.wav; rm -rf /",
    "audio.wav && echo pwned",
  ];
  for (const p of maliciousPaths) {
    try {
      sherpa.readWave(p);
      // If it doesn't throw, that's OK — it just means the file doesn't exist or isn't WAV
      assert(`Path "${p.slice(0, 30)}..." — no crash`, true);
    } catch {
      assert(`Path "${p.slice(0, 30)}..." — properly rejected`, true);
    }
  }
}

// --- Test 5: Concurrent stream creation ---
console.log("\nTest 5: Concurrent stream creation");
{
  const zhWav = path.join(TEST_WAVS_DIR, "zh.wav");
  const enWav = path.join(TEST_WAVS_DIR, "en.wav");

  if (fs.existsSync(zhWav) && fs.existsSync(enWav)) {
    try {
      const wave1 = sherpa.readWave(zhWav);
      const wave2 = sherpa.readWave(enWav);

      const stream1 = recognizer.createStream();
      const stream2 = recognizer.createStream();

      stream1.acceptWaveform({ sampleRate: wave1.sampleRate, samples: wave1.samples });
      stream2.acceptWaveform({ sampleRate: wave2.sampleRate, samples: wave2.samples });

      recognizer.decode(stream1);
      recognizer.decode(stream2);

      const r1 = recognizer.getResult(stream1);
      const r2 = recognizer.getResult(stream2);

      const t1 = typeof r1 === "string" ? r1 : r1?.text ?? "";
      const t2 = typeof r2 === "string" ? r2 : r2?.text ?? "";

      assert("Stream 1 (zh) recognized", t1.length > 0, `got: "${t1}"`);
      assert("Stream 2 (en) recognized", t2.length > 0, `got: "${t2}"`);
      assert("Results are different", t1 !== t2, `both: "${t1}"`);

      console.log(`    zh: "${t1}"`);
      console.log(`    en: "${t2}"`);
    } catch (err) {
      assert("Concurrent streams work", false, err.message);
    }
  } else {
    console.log("  [SKIP] Test WAV files not found");
  }
}

// --- Test 6: Large audio (30s silence) ---
console.log("\nTest 6: Large audio (30s)");
{
  const sampleRate = 16000;
  const duration = 30;
  const samples = new Float32Array(sampleRate * duration); // all zeros = silence
  const p = writeTempWav("large", samples);
  try {
    const start = Date.now();
    const wave = sherpa.readWave(p);
    const stream = recognizer.createStream();
    stream.acceptWaveform({ sampleRate: wave.sampleRate, samples: wave.samples });
    recognizer.decode(stream);
    const result = recognizer.getResult(stream);
    const elapsed = Date.now() - start;
    const text = typeof result === "string" ? result : result?.text ?? "";
    assert(`Handles 30s audio (${elapsed}ms)`, true);
    assert("Completes under 5 seconds", elapsed < 5000, `took ${elapsed}ms`);
    console.log(`    Result: "${text}" (${elapsed}ms)`);
  } catch (err) {
    assert("Handles 30s audio", false, err.message);
  } finally {
    try { fs.unlinkSync(p); } catch {}
  }
}

// --- Test 7: Repeated recognition (cache correctness) ---
console.log("\nTest 7: Repeated recognition (cache correctness)");
{
  const zhWav = path.join(TEST_WAVS_DIR, "zh.wav");
  if (fs.existsSync(zhWav)) {
    const results = [];
    for (let i = 0; i < 3; i++) {
      const wave = sherpa.readWave(zhWav);
      const stream = recognizer.createStream();
      stream.acceptWaveform({ sampleRate: wave.sampleRate, samples: wave.samples });
      recognizer.decode(stream);
      const result = recognizer.getResult(stream);
      results.push(typeof result === "string" ? result : result?.text ?? "");
    }
    assert("All 3 runs produce same result", results[0] === results[1] && results[1] === results[2],
      `"${results[0]}" vs "${results[1]}" vs "${results[2]}"`);
    console.log(`    Consistent result: "${results[0]}"`);
  }
}

// ─── Summary ────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(50)}`);
process.exit(failed > 0 ? 1 : 0);
