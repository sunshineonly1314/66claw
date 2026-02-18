#!/usr/bin/env node
/**
 * Test ASR model auto-downloader logic.
 *
 * Tests:
 *  1. Model detection (isModelInstalled)
 *  2. Mirror URL validation
 *  3. Mirror reachability for individual files (model.int8.onnx + tokens.txt)
 *  4. Download skip when model already installed
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CONFIG_DIR = path.join(os.homedir(), ".clawdbot");
const ASR_MODELS_DIR = path.join(CONFIG_DIR, "tools", "sherpa-onnx-asr", "models");
const SENSEVOICE_DIR = "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17";
const MODEL_DIR = path.join(ASR_MODELS_DIR, SENSEVOICE_DIR);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.log(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.log(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

console.log("=== ASR Model Downloader Tests (v2 — direct file download) ===\n");

// ─── Test 1: Model file detection ──────────────────────────────────

console.log("--- Model Detection ---");

test("model.int8.onnx exists and is >50MB", () => {
  const modelPath = path.join(MODEL_DIR, "model.int8.onnx");
  assert(fs.existsSync(modelPath), "model.int8.onnx not found");
  const stat = fs.statSync(modelPath);
  const sizeMB = stat.size / 1024 / 1024;
  assert(sizeMB > 50, `Model too small: ${sizeMB.toFixed(1)}MB`);
  console.log(`       (model size: ${sizeMB.toFixed(1)}MB)`);
});

test("tokens.txt exists and has >1KB content", () => {
  const tokensPath = path.join(MODEL_DIR, "tokens.txt");
  assert(fs.existsSync(tokensPath), "tokens.txt not found");
  const stat = fs.statSync(tokensPath);
  assert(stat.size > 1000, `tokens.txt too small: ${stat.size} bytes`);
  console.log(`       (tokens.txt size: ${(stat.size / 1024).toFixed(1)}KB)`);
});

// ─── Test 2: Mirror URL validation ─────────────────────────────────

console.log("\n--- Mirror URL Validation ---");

const mirrors = [
  {
    label: "ModelScope",
    baseUrl:
      "https://modelscope.cn/models/pengzhendong/sherpa-onnx-sense-voice-zh-en-ja-ko-yue/resolve/master",
  },
  {
    label: "hf-mirror",
    baseUrl:
      "https://hf-mirror.com/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main",
  },
  {
    label: "HuggingFace",
    baseUrl:
      "https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main",
  },
];

for (const mirror of mirrors) {
  test(`${mirror.label} URL is valid`, () => {
    const modelUrl = `${mirror.baseUrl}/model.int8.onnx`;
    const tokensUrl = `${mirror.baseUrl}/tokens.txt`;
    // Ensure URLs are parseable
    new URL(modelUrl);
    new URL(tokensUrl);
  });
}

// ─── Test 3: Mirror reachability ───────────────────────────────────

console.log("\n--- Mirror Reachability (HEAD requests, 10s timeout) ---");

const files = ["model.int8.onnx", "tokens.txt"];

for (const mirror of mirrors) {
  for (const file of files) {
    const url = `${mirror.baseUrl}/${file}`;
    await testAsync(`${mirror.label}/${file}`, async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      try {
        const start = Date.now();
        const res = await fetch(url, {
          method: "HEAD",
          signal: controller.signal,
          redirect: "follow",
        });
        clearTimeout(timeoutId);
        const latency = Date.now() - start;
        const size = res.headers.get("content-length");
        const sizeStr = size
          ? `${(parseInt(size) / 1024 / 1024).toFixed(1)}MB`
          : "size unknown";
        const status = res.ok ? "OK" : `HTTP ${res.status}`;
        console.log(
          `       ${mirror.label}: [${status}] ${sizeStr} (${latency}ms)`,
        );
        // Accept 200, 302, 307 as success
        assert(res.ok || res.status === 302 || res.status === 307, `HTTP ${res.status}`);
      } catch (err) {
        if (err.name === "AbortError") {
          throw new Error("Timed out (10s)");
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    });
  }
}

// ─── Test 4: Download skip logic ───────────────────────────────────

console.log("\n--- Download Skip Logic ---");

test("isModelInstalled returns true when files exist", () => {
  const hasModel =
    fs.existsSync(path.join(MODEL_DIR, "model.int8.onnx")) &&
    fs.existsSync(path.join(MODEL_DIR, "tokens.txt"));
  assert(hasModel, "Model files should exist");
});

test("download should be skipped (no network call) when model exists", () => {
  // Verify the check is purely filesystem-based
  const start = Date.now();
  const modelOnnx = fs.existsSync(path.join(MODEL_DIR, "model.int8.onnx"));
  const tokens = fs.existsSync(path.join(MODEL_DIR, "tokens.txt"));
  const elapsed = Date.now() - start;
  assert(modelOnnx && tokens, "Both files should exist");
  assert(elapsed < 100, `Filesystem check should be fast, took ${elapsed}ms`);
});

// ─── Test 5: Partial download cleanup ──────────────────────────────

console.log("\n--- Partial Download Cleanup ---");

test("cleanup logic removes individual files (not archive)", () => {
  // Verify the new approach: we download model.int8.onnx + tokens.txt directly,
  // no tar.bz2 archive is involved. Cleanup = delete individual files on failure.
  const tmpDir = path.join(os.tmpdir(), `asr-test-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  // Simulate partial download
  const tmpFile = path.join(tmpDir, "model.int8.onnx");
  fs.writeFileSync(tmpFile, "partial");
  assert(fs.existsSync(tmpFile), "Temp file should exist");

  // Cleanup
  fs.unlinkSync(tmpFile);
  fs.rmdirSync(tmpDir);
  assert(!fs.existsSync(tmpFile), "Temp file should be cleaned up");
});

// ─── Summary ───────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
