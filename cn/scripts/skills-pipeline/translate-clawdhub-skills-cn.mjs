#!/usr/bin/env node
/**
 * Translate downloaded ClawdHub skills to Simplified Chinese into a sibling ./cn directory.
 *
 * Requirements from user:
 * - Keep key content; translate descriptions/instructions to zh-CN.
 * - DO NOT translate commands; commands must remain runnable.
 * - Keep the words "agent" and "skills" untranslated (case-preserving).
 * - Write translated skills into: <CLAWDHUB_MIRROR>/cn/skills/<slug>/...
 *
 * Notes:
 * - This script uses an OpenAI-compatible Chat Completions API (many China-friendly providers
 *   support this shape, e.g. DashScope/Qwen, DeepSeek, Moonshot, etc).
 * - It preserves fenced code blocks, inline code, and "command-like" lines via placeholders
 *   and post-restore to prevent accidental translation of runnable snippets.
 *
 * Usage:
 *   node scripts/translate-clawdhub-skills-cn.mjs
 *
 * Env:
 *   CLAWDHUB_MIRROR            default: ./cn/skills-mirror
 *   CLAWDHUB_TRANSLATE_OUT     default: <mirror>/cn
 *   TRANSLATE_BASE_URL         optional (OpenAI-compatible base URL, without trailing slash)
 *   TRANSLATE_API_KEY          optional
 *   TRANSLATE_MODEL            optional
 *   DASHSCOPE_API_KEY          optional (fallback key when TRANSLATE_API_KEY missing)
 *   QWEN_API_KEY               optional (fallback key when TRANSLATE_API_KEY missing)
 *   TRANSLATE_CONCURRENCY      default: 3
 *   TRANSLATE_DELAY_MS         default: 200
 *   TRANSLATE_MAX_RETRIES      default: 3
 *   TRANSLATE_ONLY_SKILL_MD    default: false (if true, only translate SKILL.md)
 *   TRANSLATE_BATCH_MAX_FILES  default: 6 (translate multiple md files per request)
 *   TRANSLATE_BATCH_MAX_CHARS  default: 24000 (approx total input chars per request)
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const MIRROR = path.resolve(process.env.CLAWDHUB_MIRROR || "cn/skills-mirror");
const IN_SKILLS_DIR = path.join(MIRROR, "skills");
const OUT_ROOT = path.resolve(process.env.CLAWDHUB_TRANSLATE_OUT || path.join(MIRROR, "cn"));
const OUT_SKILLS_DIR = path.join(OUT_ROOT, "skills");

// Default to the repo's Qwen/DashScope OpenAI-compatible endpoint + qwen-plus.
// This matches `src/agents/models-config.providers.ts` (QWEN_DASHSCOPE_BASE_URL).
const DEFAULT_QWEN_DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const BASE_URL = (process.env.TRANSLATE_BASE_URL || DEFAULT_QWEN_DASHSCOPE_BASE_URL).replace(/\/+$/, "");
const API_KEY = process.env.TRANSLATE_API_KEY || process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY || "";
const MODEL = process.env.TRANSLATE_MODEL || "qwen-plus";
const CONCURRENCY = Math.max(1, Number(process.env.TRANSLATE_CONCURRENCY) || 3);
const DELAY_MS = Math.max(0, Number(process.env.TRANSLATE_DELAY_MS) || 200);
const MAX_RETRIES = Math.max(1, Number(process.env.TRANSLATE_MAX_RETRIES) || 3);
const ONLY_SKILL_MD = String(process.env.TRANSLATE_ONLY_SKILL_MD || "").toLowerCase() === "true";
const BATCH_MAX_FILES = Math.max(1, Number(process.env.TRANSLATE_BATCH_MAX_FILES) || 6);
const BATCH_MAX_CHARS = Math.max(2000, Number(process.env.TRANSLATE_BATCH_MAX_CHARS) || 24000);

const REPORT_PATH = path.join(OUT_ROOT, "translate-report.json");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isProbablyCommandLine(line) {
  // Heuristic: treat as command if it looks like a shell/CLI invocation.
  // We must not translate these lines.
  const s = line.trim();
  if (!s) return false;
  if (s.startsWith("```")) return false; // fenced code handled separately
  if (s.startsWith("$ ") || s.startsWith("> ")) return true;
  if (/^(sudo|curl|wget|ssh|scp|git|npm|pnpm|bunx?|node|python|pip|docker|kubectl|brew|clawdbot)\b/i.test(s)) return true;
  if (/^([A-Za-z0-9_./-]+)(\s+--?[A-Za-z0-9][A-Za-z0-9-]*([=\s][^#]+)?)$/.test(s)) return true;
  if (/\b(--help|--version|--api-key|--token|--model|--base-url)\b/i.test(s)) return true;
  return false;
}

function protectTerms(text) {
  // Protect "agent" and "skills" (case-preserving) using placeholders.
  // We only protect whole words to avoid touching "agentsmith" etc.
  const map = new Map();
  let idx = 0;

  function protectWord(word) {
    const re = new RegExp(`\\b${word}\\b`, "gi");
    return (s) =>
      s.replace(re, (m) => {
        const key = `@@TERM_${idx++}@@`;
        map.set(key, m);
        return key;
      });
  }

  let out = text;
  out = protectWord("agent")(out);
  out = protectWord("skills")(out);
  return { out, map };
}

function protectMarkdown(content) {
  // Protect fenced code blocks, inline code, and command-like lines.
  // Returns { text, placeholders }.
  const placeholders = new Map();
  let n = 0;

  function put(value) {
    const key = `@@PH_${n++}@@`;
    placeholders.set(key, value);
    return key;
  }

  let text = content;

  // 1) Protect fenced code blocks (``` ... ```), non-greedy across lines.
  text = text.replace(/```[\s\S]*?```/g, (m) => put(m));

  // 2) Protect inline code `...` (after fenced blocks removed)
  text = text.replace(/`[^`\n]+`/g, (m) => put(m));

  // 3) Protect command-like lines (after inline code protected)
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (isProbablyCommandLine(lines[i])) lines[i] = put(lines[i]);
  }
  text = lines.join("\n");

  // 4) Protect key terms
  const term = protectTerms(text);
  text = term.out;
  for (const [k, v] of term.map.entries()) placeholders.set(k, v);

  return { text, placeholders };
}

function restorePlaceholders(text, placeholders) {
  let out = text;
  // Restore repeatedly in case model moved tokens around slightly.
  // We only restore known tokens exactly.
  for (const [k, v] of placeholders.entries()) {
    out = out.split(k).join(v);
  }
  return out;
}

function chatCompletionsUrl(baseUrl) {
  // Some OpenAI-compatible providers expose:
  // - baseUrl = https://api.example.com        => POST /v1/chat/completions
  // - baseUrl = https://api.example.com/v1     => POST /chat/completions
  // DashScope compatible-mode uses the latter.
  const b = String(baseUrl || "").replace(/\/+$/, "");
  if (!b) return "";
  return b.endsWith("/v1") ? `${b}/chat/completions` : `${b}/v1/chat/completions`;
}

async function translateText(original, ctx) {
  if (!BASE_URL || !API_KEY || !MODEL) {
    throw new Error(
      "Missing translation env: set TRANSLATE_API_KEY (or DASHSCOPE_API_KEY/QWEN_API_KEY). Optional: TRANSLATE_BASE_URL, TRANSLATE_MODEL.",
    );
  }

  const { text, placeholders } = protectMarkdown(original);
  const mustHaveTokens = [...placeholders.keys()];

  const system = [
    "你是专业技术文档译者。任务：把输入的 Markdown 翻译成简体中文。",
    "",
    "硬性规则：",
    "- 只翻译自然语言说明文字；不要改变 Markdown 结构。",
    "- 任何以 @@ 开头、以 @@ 结尾的占位符都必须原样保留，不能翻译/不能增删/不能改写。",
    "- 不能翻译命令、代码、配置键、环境变量、URL、文件路径等（它们已被占位符保护，但仍需严格遵守）。",
    '- 术语 "agent" 和 "skills" 必须保持英文，不要翻译。',
    "- 输出必须只包含翻译后的 Markdown（不要加解释）。",
  ].join("\n");

  const user = [
    `文件: ${ctx.relPath}`,
    "请翻译以下内容：",
    "",
    text,
  ].join("\n");

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(chatCompletionsUrl(BASE_URL), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      if (attempt === MAX_RETRIES) throw new Error(`translate failed: ${res.status} ${raw.slice(0, 300)}`);
      await sleep(800 + attempt * 500);
      continue;
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      if (attempt === MAX_RETRIES) throw new Error(`translate: invalid JSON response: ${raw.slice(0, 200)}`);
      await sleep(800 + attempt * 500);
      continue;
    }

    const out = data?.choices?.[0]?.message?.content ?? "";
    if (!out.trim()) {
      if (attempt === MAX_RETRIES) throw new Error("translate: empty response");
      await sleep(800 + attempt * 500);
      continue;
    }

    // Validate all placeholders remain.
    const missing = mustHaveTokens.filter((t) => !out.includes(t));
    if (missing.length) {
      if (attempt === MAX_RETRIES) throw new Error(`translate: model dropped placeholders: ${missing.slice(0, 5).join(", ")}`);
      await sleep(800 + attempt * 500);
      continue;
    }

    return restorePlaceholders(out, placeholders);
  }

  throw new Error("translate: exhausted retries");
}

function protectTermsPrefixed(text, prefix) {
  // Same as protectTerms(), but prefix placeholder keys to avoid collisions in batch mode.
  const map = new Map();
  let idx = 0;

  function protectWord(word) {
    const re = new RegExp(`\\b${word}\\b`, "gi");
    return (s) =>
      s.replace(re, (m) => {
        const key = `@@${prefix}TERM_${idx++}@@`;
        map.set(key, m);
        return key;
      });
  }

  let out = text;
  out = protectWord("agent")(out);
  out = protectWord("skills")(out);
  return { out, map };
}

function protectMarkdownPrefixed(content, prefix) {
  // Same as protectMarkdown(), but prefix placeholder keys to avoid collisions in batch mode.
  const placeholders = new Map();
  let n = 0;

  function put(value) {
    const key = `@@${prefix}PH_${n++}@@`;
    placeholders.set(key, value);
    return key;
  }

  let text = content;

  // 1) Protect fenced code blocks (``` ... ```), non-greedy across lines.
  text = text.replace(/```[\s\S]*?```/g, (m) => put(m));

  // 2) Protect inline code `...` (after fenced blocks removed)
  text = text.replace(/`[^`\n]+`/g, (m) => put(m));

  // 3) Protect command-like lines (after inline code protected)
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (isProbablyCommandLine(lines[i])) lines[i] = put(lines[i]);
  }
  text = lines.join("\n");

  // 4) Protect key terms
  const term = protectTermsPrefixed(text, prefix);
  text = term.out;
  for (const [k, v] of term.map.entries()) placeholders.set(k, v);

  return { text, placeholders };
}

async function translateBatch(files) {
  // files: [{ relPath, srcText }]
  if (!BASE_URL || !API_KEY || !MODEL) {
    throw new Error("Missing translation env: set TRANSLATE_API_KEY (or DASHSCOPE_API_KEY/QWEN_API_KEY).");
  }

  const placeholders = new Map();
  const segments = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const prefix = `F${i}_`;
    const protectedOne = protectMarkdownPrefixed(f.srcText, prefix);
    for (const [k, v] of protectedOne.placeholders.entries()) placeholders.set(k, v);

    segments.push(
      [
        `<<<FILE:${f.relPath}>>>`,
        protectedOne.text,
        `<<<END_FILE:${f.relPath}>>>`,
      ].join("\n"),
    );
  }

  const mustHaveTokens = [...placeholders.keys()];

  const system = [
    "你是专业技术文档译者。任务：把输入的多段 Markdown 翻译成简体中文。",
    "",
    "硬性规则：",
    "- 只翻译自然语言说明文字；不要改变 Markdown 结构。",
    "- 任何以 @@ 开头、以 @@ 结尾的占位符都必须原样保留，不能翻译/不能增删/不能改写。",
    "- 不要翻译命令、代码、配置键、环境变量、URL、文件路径等（它们已被占位符保护，但仍需严格遵守）。",
    '- 术语 "agent" 和 "skills" 必须保持英文，不要翻译。',
    "- 必须原样保留所有分隔标记行：<<<FILE:...>>> 与 <<<END_FILE:...>>>，并且每个文件段落都要输出。",
    "- 输出必须只包含翻译后的内容（从第一个 <<<FILE:...>>> 开始到最后一个 <<<END_FILE:...>>> 结束），不要添加任何解释。",
  ].join("\n");

  const user = [
    "请逐段翻译以下内容：",
    "",
    segments.join("\n\n"),
  ].join("\n");

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(chatCompletionsUrl(BASE_URL), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      if (attempt === MAX_RETRIES) throw new Error(`translate failed: ${res.status} ${raw.slice(0, 300)}`);
      await sleep(800 + attempt * 500);
      continue;
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      if (attempt === MAX_RETRIES) throw new Error(`translate: invalid JSON response: ${raw.slice(0, 200)}`);
      await sleep(800 + attempt * 500);
      continue;
    }

    const out = data?.choices?.[0]?.message?.content ?? "";
    if (!out.trim()) {
      if (attempt === MAX_RETRIES) throw new Error("translate: empty response");
      await sleep(800 + attempt * 500);
      continue;
    }

    const missing = mustHaveTokens.filter((t) => !out.includes(t));
    if (missing.length) {
      if (attempt === MAX_RETRIES) throw new Error(`translate: model dropped placeholders: ${missing.slice(0, 5).join(", ")}`);
      await sleep(800 + attempt * 500);
      continue;
    }

    const results = new Map();
    for (const f of files) {
      const start = `<<<FILE:${f.relPath}>>>`;
      const end = `<<<END_FILE:${f.relPath}>>>`;
      const si = out.indexOf(start);
      const ei = out.indexOf(end);
      if (si === -1 || ei === -1 || ei < si) {
        if (attempt === MAX_RETRIES) throw new Error(`translate: missing segment markers for ${f.relPath}`);
        await sleep(800 + attempt * 500);
        continue;
      }
      const inner = out.slice(si + start.length, ei).replace(/^\s*\n/, "").replace(/\n\s*$/, "");
      results.set(f.relPath, restorePlaceholders(inner, placeholders));
    }

    if (results.size !== files.length) {
      if (attempt === MAX_RETRIES) throw new Error("translate: parsed segment count mismatch");
      await sleep(800 + attempt * 500);
      continue;
    }

    return results;
  }

  throw new Error("translate: exhausted retries");
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function copyFile(src, dst) {
  await ensureDir(path.dirname(dst));
  await fsp.copyFile(src, dst);
}

async function* walk(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      yield* walk(full);
    } else if (ent.isFile()) {
      yield full;
    }
  }
}

function relFromSkills(absPath) {
  return path.relative(IN_SKILLS_DIR, absPath);
}

function outPathFor(absPath) {
  return path.join(OUT_SKILLS_DIR, relFromSkills(absPath));
}

function shouldTranslateFile(absPath) {
  const rel = relFromSkills(absPath);
  if (ONLY_SKILL_MD) return path.basename(rel).toLowerCase() === "skill.md";
  // translate markdown docs; copy other files as-is
  return rel.toLowerCase().endsWith(".md");
}

async function translateOneFile(absPath, report) {
  const rel = relFromSkills(absPath);
  const dst = outPathFor(absPath);

  // Skip if already exists to allow resume.
  if (fs.existsSync(dst)) {
    report.skipped.push(rel);
    return;
  }

  if (!shouldTranslateFile(absPath)) {
    await copyFile(absPath, dst);
    report.copied.push(rel);
    return;
  }

  const srcText = await fsp.readFile(absPath, "utf8");
  const translated = await translateText(srcText, { relPath: rel });
  await ensureDir(path.dirname(dst));
  await fsp.writeFile(dst, translated, "utf8");
  report.translated.push(rel);
}

async function runQueue(items, worker) {
  let i = 0;
  const running = new Set();
  const next = async () => {
    if (i >= items.length) return;
    const item = items[i++];
    const p = (async () => worker(item))()
      .catch((e) => {
        // rethrow to surface, but ensure removal from running
        throw e;
      })
      .finally(() => running.delete(p));
    running.add(p);
    if (running.size >= CONCURRENCY) await Promise.race(running);
    if (DELAY_MS) await sleep(DELAY_MS);
    return next();
  };
  await next();
  await Promise.allSettled([...running]);
}

async function main() {
  if (!fs.existsSync(IN_SKILLS_DIR)) {
    console.error("Input skills dir not found:", IN_SKILLS_DIR);
    process.exit(1);
  }

  // Fail fast if auth is missing.
  if (!API_KEY) {
    console.error(
      [
        "Missing translation env. Please set one of:",
        "- TRANSLATE_API_KEY (explicit)",
        "- DASHSCOPE_API_KEY (recommended for qwen-plus)",
        "- QWEN_API_KEY",
        "",
        "Optional overrides:",
        "- TRANSLATE_BASE_URL",
        "- TRANSLATE_MODEL",
        "- TRANSLATE_BATCH_MAX_FILES, TRANSLATE_BATCH_MAX_CHARS",
        "",
        "Then re-run: node scripts/translate-clawdhub-skills-cn.mjs",
      ].join("\n"),
    );
    process.exit(1);
  }

  await ensureDir(OUT_SKILLS_DIR);

  const files = [];
  for await (const f of walk(IN_SKILLS_DIR)) files.push(f);

  const report = {
    ts: new Date().toISOString(),
    mirror: MIRROR,
    out: OUT_ROOT,
    counts: { total_files: files.length, translated: 0, copied: 0, skipped: 0, failed: 0 },
    translated: [],
    copied: [],
    skipped: [],
    failed: [],
  };

  console.log("Input:", IN_SKILLS_DIR);
  console.log("Output:", OUT_SKILLS_DIR);
  console.log("Total files:", files.length, "Concurrency:", CONCURRENCY);
  console.log("Translate baseUrl:", BASE_URL);
  console.log("Translate model:", MODEL);
  console.log("Batch max files:", BATCH_MAX_FILES, "Batch max chars:", BATCH_MAX_CHARS);

  let done = 0;
  const toTranslate = [];

  // Phase 1: copy non-md files (and record skipped), collect md files for translation.
  for (const absPath of files) {
    const rel = relFromSkills(absPath);
    const dst = outPathFor(absPath);

    if (fs.existsSync(dst)) {
      report.skipped.push(rel);
      done += 1;
      continue;
    }

    if (!shouldTranslateFile(absPath)) {
      try {
        await copyFile(absPath, dst);
        report.copied.push(rel);
      } catch (e) {
        report.failed.push({ file: rel, message: (e?.message || String(e)).slice(0, 500) });
      } finally {
        done += 1;
      }
      continue;
    }

    toTranslate.push({ absPath, rel, dst });
  }

  // Phase 2: translate md files in batches to reduce API calls.
  const batches = [];
  let cur = [];
  let curChars = 0;

  for (const item of toTranslate) {
    let approxChars = 1;
    try {
      const size = fs.statSync(item.absPath).size || 0;
      approxChars = Math.max(1, Math.floor(size / 2)); // bytes -> approx chars
    } catch {
      approxChars = 1;
    }

    const wouldOverflow =
      cur.length >= BATCH_MAX_FILES ||
      (cur.length > 0 && curChars + approxChars > BATCH_MAX_CHARS);

    if (wouldOverflow) {
      batches.push(cur);
      cur = [];
      curChars = 0;
    }

    cur.push(item);
    curChars += approxChars;
  }
  if (cur.length) batches.push(cur);

  await runQueue(batches, async (batch) => {
    try {
      if (BATCH_MAX_FILES <= 1 || batch.length <= 1) {
        // Fallback: per-file translation.
        const it = batch[0];
        const srcText = await fsp.readFile(it.absPath, "utf8");
        const translated = await translateText(srcText, { relPath: it.rel });
        await ensureDir(path.dirname(it.dst));
        await fsp.writeFile(it.dst, translated, "utf8");
        report.translated.push(it.rel);
        done += 1;
      } else {
        const batchFiles = [];
        for (const it of batch) {
          const srcText = await fsp.readFile(it.absPath, "utf8");
          batchFiles.push({ relPath: it.rel, srcText });
        }
        const results = await translateBatch(batchFiles);
        for (const it of batch) {
          const translated = results.get(it.rel);
          if (typeof translated !== "string") throw new Error(`translate: missing result for ${it.rel}`);
          await ensureDir(path.dirname(it.dst));
          await fsp.writeFile(it.dst, translated, "utf8");
          report.translated.push(it.rel);
          done += 1;
        }
      }
    } catch (e) {
      for (const it of batch) {
        report.failed.push({ file: it.rel, message: (e?.message || String(e)).slice(0, 500) });
        done += 1;
      }
    } finally {
      if (done % 200 === 0 || done === files.length) {
        report.counts.translated = report.translated.length;
        report.counts.copied = report.copied.length;
        report.counts.skipped = report.skipped.length;
        report.counts.failed = report.failed.length;
        console.log(
          `[${done}/${files.length}] translated=${report.counts.translated} copied=${report.counts.copied} failed=${report.counts.failed}`,
        );
        await fsp.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
      }
    }
  });

  report.counts.translated = report.translated.length;
  report.counts.copied = report.copied.length;
  report.counts.skipped = report.skipped.length;
  report.counts.failed = report.failed.length;
  await fsp.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

  console.log("Done.");
  console.log("Report:", REPORT_PATH);
  console.log("Translated:", report.counts.translated, "Copied:", report.counts.copied, "Skipped:", report.counts.skipped, "Failed:", report.counts.failed);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
