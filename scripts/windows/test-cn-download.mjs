#!/usr/bin/env node
/**
 * 国内镜像实际下载测试
 *
 * 不是只测 HEAD，而是实际下载前 1MB 数据，测量真实速度。
 * 同时测试 tokens.txt 完整下载（小文件）。
 */

const mirrors = [
  {
    label: "ModelScope (阿里云)",
    model: "https://modelscope.cn/models/pengzhendong/sherpa-onnx-sense-voice-zh-en-ja-ko-yue/resolve/master/model.int8.onnx",
    tokens: "https://modelscope.cn/models/pengzhendong/sherpa-onnx-sense-voice-zh-en-ja-ko-yue/resolve/master/tokens.txt",
  },
  {
    label: "hf-mirror (HF中国镜像)",
    model: "https://hf-mirror.com/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/model.int8.onnx",
    tokens: "https://hf-mirror.com/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/tokens.txt",
  },
  {
    label: "gh-proxy (GitHub代理)",
    model: "https://gh-proxy.com/https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/model.int8.onnx",
    tokens: "https://gh-proxy.com/https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/tokens.txt",
  },
  {
    label: "HuggingFace 直连 (国外)",
    model: "https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/model.int8.onnx",
    tokens: "https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/tokens.txt",
  },
];

const DOWNLOAD_CHUNK = 1 * 1024 * 1024; // 下载前 1MB 测速
const TIMEOUT_MS = 15000; // 15秒超时

async function testPartialDownload(label, url, maxBytes) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = Date.now();

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "clawdbot/asr-downloader",
        Range: `bytes=0-${maxBytes - 1}`,
      },
    });

    if (!res.ok && res.status !== 206) {
      clearTimeout(timer);
      return { ok: false, error: `HTTP ${res.status}`, latency: Date.now() - start };
    }

    const reader = res.body.getReader();
    let downloaded = 0;
    const firstByteTime = Date.now();

    while (downloaded < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      downloaded += value.byteLength;
      if (downloaded >= maxBytes) break;
    }

    reader.cancel();
    clearTimeout(timer);

    const totalMs = Date.now() - start;
    const ttfb = firstByteTime - start;
    const speedMBs = downloaded / 1024 / 1024 / (totalMs / 1000);

    return {
      ok: true,
      downloaded,
      totalMs,
      ttfb,
      speedMBs,
    };
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") {
      return { ok: false, error: `超时 (${TIMEOUT_MS / 1000}s)`, latency: Date.now() - start };
    }
    return { ok: false, error: e.message, latency: Date.now() - start };
  }
}

async function testFullDownload(label, url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = Date.now();

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "clawdbot/asr-downloader" },
    });

    if (!res.ok) {
      clearTimeout(timer);
      return { ok: false, error: `HTTP ${res.status}`, latency: Date.now() - start };
    }

    const buf = await res.arrayBuffer();
    clearTimeout(timer);

    const totalMs = Date.now() - start;
    return {
      ok: true,
      size: buf.byteLength,
      totalMs,
    };
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") {
      return { ok: false, error: `超时 (${TIMEOUT_MS / 1000}s)`, latency: Date.now() - start };
    }
    return { ok: false, error: e.message, latency: Date.now() - start };
  }
}

console.log("=== 国内镜像实际下载测试 ===\n");
console.log(`测试方式: 下载 model.int8.onnx 前 ${DOWNLOAD_CHUNK / 1024 / 1024}MB + tokens.txt 完整下载`);
console.log(`超时: ${TIMEOUT_MS / 1000}s\n`);

const results = [];

for (const mirror of mirrors) {
  console.log(`--- ${mirror.label} ---`);

  // Test 1: Partial download of model (first 1MB)
  const modelResult = await testPartialDownload(
    mirror.label,
    mirror.model,
    DOWNLOAD_CHUNK,
  );

  if (modelResult.ok) {
    console.log(
      `  model.int8.onnx: ✅ ${(modelResult.downloaded / 1024).toFixed(0)}KB ` +
      `in ${modelResult.totalMs}ms ` +
      `(${modelResult.speedMBs.toFixed(2)} MB/s, TTFB: ${modelResult.ttfb}ms)`,
    );
  } else {
    console.log(`  model.int8.onnx: ❌ ${modelResult.error}`);
  }

  // Test 2: Full download of tokens.txt (~316KB)
  const tokensResult = await testFullDownload(mirror.label, mirror.tokens);

  if (tokensResult.ok) {
    console.log(
      `  tokens.txt:      ✅ ${(tokensResult.size / 1024).toFixed(1)}KB in ${tokensResult.totalMs}ms`,
    );
  } else {
    console.log(`  tokens.txt:      ❌ ${tokensResult.error}`);
  }

  results.push({
    label: mirror.label,
    modelOk: modelResult.ok,
    tokensOk: tokensResult.ok,
    speedMBs: modelResult.ok ? modelResult.speedMBs : 0,
    ttfb: modelResult.ok ? modelResult.ttfb : null,
    modelMs: modelResult.ok ? modelResult.totalMs : null,
    tokensMs: tokensResult.ok ? tokensResult.totalMs : null,
  });

  console.log();
}

// ─── 总结 ──────────────────────────────────────────────────────────

console.log("=== 总结 ===\n");
console.log("  镜像源                    | 模型文件 | tokens | 速度        | 预计228MB用时");
console.log("  " + "─".repeat(80));

for (const r of results) {
  const modelStatus = r.modelOk ? "✅" : "❌";
  const tokensStatus = r.tokensOk ? "✅" : "❌";
  const speed = r.speedMBs > 0 ? `${r.speedMBs.toFixed(2)} MB/s` : "N/A";
  const eta = r.speedMBs > 0 ? `~${Math.ceil(228 / r.speedMBs)}s` : "N/A";
  console.log(
    `  ${r.label.padEnd(27)} | ${modelStatus}       | ${tokensStatus}      | ${speed.padEnd(11)} | ${eta}`,
  );
}

const bestMirror = results
  .filter((r) => r.modelOk && r.tokensOk)
  .sort((a, b) => b.speedMBs - a.speedMBs)[0];

if (bestMirror) {
  console.log(`\n  🏆 最佳: ${bestMirror.label} (${bestMirror.speedMBs.toFixed(2)} MB/s)`);
} else {
  console.log("\n  ⚠️ 所有镜像都不可用！");
}
