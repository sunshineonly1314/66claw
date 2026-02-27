/**
 * Model Context Window Probe
 *
 * 探测未知模型的真实 contextWindow：
 *   - Ollama: 调用 /api/show 获取 model_info["general.context_length"]
 *   - vLLM / OpenAI 兼容: 发送结构化 prompt 让模型自报 contextWindow
 *   - 名字预过滤: 跳过明显的小模型 / 非对话模型
 *   - 并发探测 + 文件缓存 (7天有效)
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("model-probe");

/** Short hash of baseUrl to distinguish different API instances in cache */
function baseUrlHash(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 8);
}

// ── Constants ────────────────────────────────────────────────────────

const PROBE_TIMEOUT_MS = 15_000;
const OLLAMA_SHOW_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_CONCURRENCY = 3;

const SELF_REPORT_PROMPT =
  'Respond with ONLY a JSON object, no markdown, no explanation:\n{"context_window":<number>}\ncontext_window = your maximum input token limit as a number.';

/** 中文 fallback — 部分中文 fine-tune 模型对英文 prompt 响应差 */
const SELF_REPORT_PROMPT_ZH =
  '只回复一个JSON对象，不要markdown，不要解释：\n{"context_window":<数字>}\ncontext_window = 你的最大输入token数量。';

const SIMPLE_PROBE_PROMPT =
  "What is your context window size in tokens? Reply with just the number.";

// ── Types ────────────────────────────────────────────────────────────

export type ProbeSource = "ollama-show" | "self-report" | "self-report-simple" | "failed";

export type ProbeCacheEntry = {
  contextWindow: number;
  probedAt: number;
  source: ProbeSource;
};

export type ProbeCache = Record<string, ProbeCacheEntry>;

export type ProbeResult = {
  modelId: string;
  contextWindow: number | null;
  source: ProbeSource;
};

// ── Name-based pre-filter ────────────────────────────────────────────

const SKIP_PATTERNS = [
  /\b[0-3]\.?\d?b\b/i, // 0.5B-3B models
  /\btiny\b/i,
  /\bnano\b/i,
  /\bembed/i,
  /\brerank/i,
  /\bwhisper\b/i,
  /\btts\b/i,
  /\bvoice\b/i,
  /\bsensevoice\b/i,
  /\bstable-diffusion\b/i,
  /\bflux\b/i,
];

const SKIP_WHITELIST = [/minimax/i, /gpt-4o-mini/i];

export function shouldSkipProbe(modelId: string): boolean {
  if (SKIP_WHITELIST.some((p) => p.test(modelId))) return false;
  return SKIP_PATTERNS.some((p) => p.test(modelId));
}

/**
 * Default contextWindow values assigned when the true value is unknown.
 * Only includes common fallback defaults (4K/8K/32K), NOT real values like 128K/200K
 * which many models genuinely have.
 */
const GUESSED_DEFAULTS = new Set([4096, 8192, 32768]);

/** Check if a contextWindow value looks like a guessed default rather than a measured value */
function isGuessedContextWindow(contextWindow: number): boolean {
  return GUESSED_DEFAULTS.has(contextWindow);
}

// ── Ollama /api/show probe ───────────────────────────────────────────

export async function probeOllamaModel(baseUrl: string, modelName: string): Promise<number | null> {
  // Ollama native API base (strip /v1 if present)
  const ollamaBase = baseUrl.replace(/\/v1\/?$/, "");
  const endpoint = `${ollamaBase}/api/show`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName }),
      signal: AbortSignal.timeout(OLLAMA_SHOW_TIMEOUT_MS),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      model_info?: Record<string, unknown>;
      parameters?: string;
    };

    // Try model_info first (modern Ollama)
    if (data.model_info) {
      for (const [key, value] of Object.entries(data.model_info)) {
        if (key.endsWith(".context_length") && typeof value === "number" && value > 0) {
          log.debug(`ollama-show: ${modelName} context_length=${value} (from model_info)`);
          return value;
        }
      }
    }

    // Fallback: parse parameters string for num_ctx
    if (typeof data.parameters === "string") {
      const match = data.parameters.match(/num_ctx\s+(\d+)/);
      if (match) {
        const numCtx = Number(match[1]);
        if (numCtx > 0) {
          log.debug(`ollama-show: ${modelName} num_ctx=${numCtx} (from parameters)`);
          return numCtx;
        }
      }
    }

    return null;
  } catch (err) {
    log.debug(`ollama-show: ${modelName} probe failed: ${err}`);
    return null;
  }
}

// ── OpenAI-compatible self-report probe ──────────────────────────────

export async function probeModelSelfReport(params: {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  headers?: Record<string, string>;
  promptOverride?: string;
}): Promise<number | null> {
  const { baseUrl, apiKey, modelId, headers, promptOverride } = params;
  // FIX CRIT-4: Normalize baseUrl for OpenAI-compatible chat/completions endpoint.
  // Some providers (like Ollama) use bare host URLs without /v1, while others
  // (like DeepSeek) omit /v1 but still work with it. Cloud providers already
  // include /v1. The /v1 path is safe to add because OpenAI-compatible servers
  // universally support it.
  let normalizedBase = baseUrl.replace(/\/+$/, "");
  if (!/\/v\d+$/.test(normalizedBase)) {
    normalizedBase += "/v1";
  }
  const endpoint = `${normalizedBase}/chat/completions`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...headers,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: promptOverride ?? SELF_REPORT_PROMPT }],
        max_tokens: 60,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data?.choices?.[0]?.message?.content ?? "";
    return parseContextWindowFromJson(content);
  } catch (err) {
    log.debug(`self-report: ${modelId} probe failed: ${err}`);
    return null;
  }
}

/** Retry with simpler prompt — just ask for a number */
export async function probeModelSelfReportSimple(params: {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  headers?: Record<string, string>;
}): Promise<number | null> {
  const { baseUrl, apiKey, modelId, headers } = params;
  // FIX CRIT-4: Same /v1 normalization as probeModelSelfReport
  let normalizedBase = baseUrl.replace(/\/+$/, "");
  if (!/\/v\d+$/.test(normalizedBase)) {
    normalizedBase += "/v1";
  }
  const endpoint = `${normalizedBase}/chat/completions`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...headers,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: SIMPLE_PROBE_PROMPT }],
        max_tokens: 30,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data?.choices?.[0]?.message?.content ?? "";
    return parseContextWindowFromText(content);
  } catch (err) {
    log.debug(`self-report-simple: ${modelId} probe failed: ${err}`);
    return null;
  }
}

// ── Response parsers ─────────────────────────────────────────────────

function parseContextWindowFromJson(raw: string): number | null {
  // FIX CRIT-3: Also match scientific notation like 1e6, 1.28e5, 128000
  const jsonMatch = raw.match(/\{[^}]*"context_window"\s*:\s*([\d][\d,_.eE+]*)\s*[^}]*\}/);
  if (!jsonMatch?.[1]) return null;
  const num = Number(jsonMatch[1].replace(/[,_]/g, ""));
  return isValidContextWindow(num) ? num : null;
}

function parseContextWindowFromText(raw: string): number | null {
  // Match a standalone number (at least 3 digits), possibly with commas/underscores
  const match = raw.match(/\b(\d[\d,_]*\d{2,})\b/);
  if (!match?.[1]) return null;
  const num = Number(match[1].replace(/[,_]/g, ""));
  return isValidContextWindow(num) ? num : null;
}

function isValidContextWindow(n: number): boolean {
  return Number.isFinite(n) && n >= 1000 && n <= 10_000_000;
}

// ── Concurrent probe orchestrator ────────────────────────────────────

export async function probeProviderModels(params: {
  providerType: "ollama" | "vllm" | "openai-compat";
  baseUrl: string;
  apiKey: string;
  models: Array<{ id: string; contextWindow?: number }>;
  headers?: Record<string, string>;
  concurrency?: number;
  cacheDir?: string;
}): Promise<ProbeResult[]> {
  const {
    providerType,
    baseUrl,
    apiKey,
    models,
    headers,
    concurrency = DEFAULT_CONCURRENCY,
    cacheDir,
  } = params;

  // Load cache
  const cache = cacheDir ? await loadProbeCache(cacheDir) : {};
  const now = Date.now();
  // Cache key 包含 baseUrl hash，区分同模型不同 API 实例（如两个 Ollama 不同 num_ctx）
  const urlHash = baseUrlHash(baseUrl);
  const mkCacheKey = (modelId: string) => `${providerType}:${urlHash}:${modelId}`;

  // Filter: skip models that don't need probing
  const toProbe = models.filter((m) => {
    if (shouldSkipProbe(m.id)) return false;
    // Check cache
    const cached = cache[mkCacheKey(m.id)];
    if (cached && now - cached.probedAt < CACHE_TTL_MS) return false;
    return true;
  });

  if (toProbe.length === 0) {
    // Return cached results for all models
    return models.map((m) => {
      const cached = cache[mkCacheKey(m.id)];
      return {
        modelId: m.id,
        contextWindow: cached?.contextWindow ?? null,
        source: cached?.source ?? "failed",
      };
    });
  }

  log.debug(
    `probeProviderModels: probing ${toProbe.length}/${models.length} models ` +
      `(type=${providerType}, concurrency=${concurrency})`,
  );

  // Concurrent probe using worker pattern
  const results: ProbeResult[] = [];
  let cursor = 0;

  // FIX CRIT-1: cursor++ is safe because Node.js is single-threaded and no await
  // occurs between the read (cursor++) and the guard (idx >= length). The workers
  // only yield at the `await probeSingleModel()` below, by which point `idx` is
  // already captured. Do NOT add any async operation before the guard.
  const worker = async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= toProbe.length) return;

      const model = toProbe[idx];
      const result = await probeSingleModel({
        providerType,
        baseUrl,
        apiKey,
        modelId: model.id,
        headers,
      });

      results.push(result);

      // Update cache
      const cacheKey = mkCacheKey(model.id);
      if (result.contextWindow !== null) {
        cache[cacheKey] = {
          contextWindow: result.contextWindow,
          probedAt: now,
          source: result.source,
        };
      }
    }
  };

  const workerCount = Math.max(1, Math.min(concurrency, toProbe.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  // Save cache
  if (cacheDir) {
    await saveProbeCache(cacheDir, cache);
  }

  // Merge: probed + cached for non-probed models
  const resultMap = new Map(results.map((r) => [r.modelId, r]));
  return models.map((m) => {
    if (resultMap.has(m.id)) return resultMap.get(m.id)!;
    const cached = cache[mkCacheKey(m.id)];
    return {
      modelId: m.id,
      contextWindow: cached?.contextWindow ?? null,
      source: (cached?.source ?? "failed") as ProbeSource,
    };
  });
}

// ── Single model probe (with retry) ──────────────────────────────────

async function probeSingleModel(params: {
  providerType: "ollama" | "vllm" | "openai-compat";
  baseUrl: string;
  apiKey: string;
  modelId: string;
  headers?: Record<string, string>;
}): Promise<ProbeResult> {
  const { providerType, baseUrl, apiKey, modelId, headers } = params;

  // Ollama: use native /api/show
  if (providerType === "ollama") {
    const ctx = await probeOllamaModel(baseUrl, modelId);
    if (ctx !== null) {
      return { modelId, contextWindow: ctx, source: "ollama-show" };
    }
    // Fallback to self-report for Ollama too
  }

  // Self-report: structured JSON prompt (English)
  const ctx1 = await probeModelSelfReport({ baseUrl, apiKey, modelId, headers });
  if (ctx1 !== null) {
    log.debug(`probe: ${modelId} self-report → ${ctx1}`);
    return { modelId, contextWindow: ctx1, source: "self-report" };
  }

  // Self-report: Chinese fallback — 部分中文 fine-tune 模型对英文 prompt 响应差
  const ctx1zh = await probeModelSelfReport({
    baseUrl,
    apiKey,
    modelId,
    headers,
    promptOverride: SELF_REPORT_PROMPT_ZH,
  });
  if (ctx1zh !== null) {
    log.debug(`probe: ${modelId} self-report-zh → ${ctx1zh}`);
    return { modelId, contextWindow: ctx1zh, source: "self-report" };
  }

  // Retry: simple number prompt
  const ctx2 = await probeModelSelfReportSimple({ baseUrl, apiKey, modelId, headers });
  if (ctx2 !== null) {
    log.debug(`probe: ${modelId} self-report-simple → ${ctx2}`);
    return { modelId, contextWindow: ctx2, source: "self-report-simple" };
  }

  log.debug(`probe: ${modelId} all probes failed`);
  return { modelId, contextWindow: null, source: "failed" };
}

// ── File-based cache ─────────────────────────────────────────────────

const CACHE_FILENAME = "model-probe-cache.json";

async function loadProbeCache(dir: string): Promise<ProbeCache> {
  try {
    const filePath = path.join(dir, CACHE_FILENAME);
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as ProbeCache;
  } catch {
    return {};
  }
}

async function saveProbeCache(dir: string, cache: ProbeCache): Promise<void> {
  try {
    // FIX CRIT-7: Purge expired entries before writing to prevent unbounded cache growth
    const now = Date.now();
    const pruned: ProbeCache = {};
    for (const [key, entry] of Object.entries(cache)) {
      if (now - entry.probedAt < CACHE_TTL_MS) {
        pruned[key] = entry;
      }
    }
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, CACHE_FILENAME);
    await fs.writeFile(filePath, JSON.stringify(pruned, null, 2), "utf-8");
  } catch (err) {
    log.debug(`saveProbeCache failed: ${err}`);
  }
}
