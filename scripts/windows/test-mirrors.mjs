#!/usr/bin/env node
/**
 * Test ASR model mirror reachability.
 * Validates that ModelScope and hf-mirror URLs can serve model files.
 */

const urls = [
  {
    name: "ModelScope model.int8.onnx",
    url: "https://modelscope.cn/models/pengzhendong/sherpa-onnx-sense-voice-zh-en-ja-ko-yue/resolve/master/model.int8.onnx",
  },
  {
    name: "ModelScope tokens.txt",
    url: "https://modelscope.cn/models/pengzhendong/sherpa-onnx-sense-voice-zh-en-ja-ko-yue/resolve/master/tokens.txt",
  },
  {
    name: "hf-mirror model.int8.onnx",
    url: "https://hf-mirror.com/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/model.int8.onnx",
  },
  {
    name: "hf-mirror tokens.txt",
    url: "https://hf-mirror.com/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/tokens.txt",
  },
  {
    name: "gh-proxy.com (tar.bz2)",
    url: "https://gh-proxy.com/https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2",
  },
  {
    name: "GitHub direct (tar.bz2)",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2",
  },
];

console.log("=== ASR Model Mirror Reachability Test ===\n");

for (const { name, url } of urls) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const start = Date.now();
    const res = await fetch(url, {
      method: "HEAD",
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(t);
    const size = res.headers.get("content-length");
    const sizeMB = size
      ? `${(parseInt(size) / 1024 / 1024).toFixed(1)}MB`
      : "unknown size";
    const status = res.ok ? "OK" : `HTTP ${res.status}`;
    console.log(`  [${status}] ${name} — ${sizeMB} (${Date.now() - start}ms)`);
  } catch (e) {
    const msg = e.name === "AbortError" ? "Timed out (10s)" : e.message;
    console.log(`  [FAIL] ${name} — ${msg}`);
  }
}

console.log("\nDone.");
