#!/usr/bin/env node
/**
 * Translate Clawdbot docs to Simplified Chinese (docs-cn/).
 *
 * Requirements:
 * - Professional translation with 信达雅 (faithfulness, expressiveness, elegance)
 * - DO NOT translate: commands, code, config keys, URLs, file paths
 * - DO NOT translate proper nouns: skills, agent, Clawdbot, Gateway, CLI, API, SDK, webhook, cron, TUI, ACP, etc.
 * - Preserve all Markdown formatting
 * - Output to docs-cn/ directory, preserving directory structure
 *
 * Usage:
 *   node scripts/translate-docs-cn.mjs
 *
 * Env:
 *   DASHSCOPE_API_KEY          Required (Qwen API key)
 *   TRANSLATE_CONCURRENCY      default: 5
 *   TRANSLATE_MODEL            default: qwen-plus
 *   TRANSLATE_DELAY_MS         default: 300
 *   TRANSLATE_MAX_RETRIES      default: 3
 *   TRANSLATE_BATCH_MAX_FILES  default: 4
 *   TRANSLATE_BATCH_MAX_CHARS  default: 20000
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const DOCS_DIR = path.join(PROJECT_ROOT, "docs");
const DOCS_CN_DIR = path.join(PROJECT_ROOT, "docs-cn");

const DEFAULT_QWEN_DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const BASE_URL = (process.env.TRANSLATE_BASE_URL || DEFAULT_QWEN_DASHSCOPE_BASE_URL).replace(/\/+$/, "");
const API_KEY = process.env.TRANSLATE_API_KEY || process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY || "";
const MODEL = process.env.TRANSLATE_MODEL || "qwen-plus";
const CONCURRENCY = Math.max(1, Number(process.env.TRANSLATE_CONCURRENCY) || 5);
const DELAY_MS = Math.max(0, Number(process.env.TRANSLATE_DELAY_MS) || 300);
const MAX_RETRIES = Math.max(1, Number(process.env.TRANSLATE_MAX_RETRIES) || 3);
const BATCH_MAX_FILES = Math.max(1, Number(process.env.TRANSLATE_BATCH_MAX_FILES) || 4);
const BATCH_MAX_CHARS = Math.max(2000, Number(process.env.TRANSLATE_BATCH_MAX_CHARS) || 20000);

const REPORT_PATH = path.join(DOCS_CN_DIR, "translate-report.json");

// 不翻译的专有名词列表（大小写保留）
const PRESERVE_TERMS = [
  // 核心概念
  "agent", "agents", "skill", "skills", "Clawdbot", "clawdbot",
  "Gateway", "gateway", "CLI", "API", "SDK", "TUI", "ACP",
  // 技术术语
  "webhook", "webhooks", "cron", "OAuth", "SSO", "MCP",
  "token", "tokens", "UUID", "JSON", "YAML", "Markdown",
  "HTTP", "HTTPS", "WebSocket", "REST", "GraphQL",
  // 产品/服务名称
  "Telegram", "Discord", "Slack", "Signal", "WhatsApp", "iMessage",
  "Matrix", "Mattermost", "LINE", "Zalo", "WeChat", "Nostr",
  "Twitch", "Google Chat", "Microsoft Teams", "MS Teams",
  "Tailscale", "Cloudflare", "Tunnel", "Fly.io",
  "Homebrew", "npm", "pnpm", "bun", "Node.js", "Bun",
  // AI 模型
  "OpenAI", "Claude", "Anthropic", "Gemini", "GPT", "LLM",
  "Qwen", "DeepSeek", "Doubao", "GLM", "Moonshot",
  // 功能名称
  "heartbeat", "broadcast", "pairing", "onboard", "onboarding",
  "sandbox", "session", "sessions", "context", "compaction",
  "failover", "retry", "streaming", "polling",
  // 文件/配置
  "config", "credentials", "manifest", "plugin", "plugins",
  "hook", "hooks", "route", "routing",
  // 命令
  "install", "uninstall", "update", "login", "logout",
  "status", "doctor", "reset", "send", "receive",
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isProbablyCommandLine(line) {
  const s = line.trim();
  if (!s) return false;
  if (s.startsWith("```")) return false;
  if (s.startsWith("$ ") || s.startsWith("> ")) return true;
  if (/^(sudo|curl|wget|ssh|scp|git|npm|pnpm|bunx?|node|python|pip|docker|kubectl|brew|clawdbot)\b/i.test(s)) return true;
  if (/^([A-Za-z0-9_./-]+)(\s+--?[A-Za-z0-9][A-Za-z0-9-]*([=\s][^#]+)?)$/.test(s)) return true;
  if (/\b(--help|--version|--api-key|--token|--model|--base-url)\b/i.test(s)) return true;
  return false;
}

function protectTermsPrefixed(text, prefix) {
  const map = new Map();
  let idx = 0;

  function protectWord(word) {
    // 使用更精确的匹配，保留大小写
    const re = new RegExp(`\\b${word}\\b`, "g");
    return (s) =>
      s.replace(re, (m) => {
        const key = `@@${prefix}TERM_${idx++}@@`;
        map.set(key, m);
        return key;
      });
  }

  let out = text;
  for (const term of PRESERVE_TERMS) {
    out = protectWord(term)(out);
  }
  return { out, map };
}

function protectMarkdownPrefixed(content, prefix) {
  const placeholders = new Map();
  let n = 0;

  function put(value) {
    const key = `@@${prefix}PH_${n++}@@`;
    placeholders.set(key, value);
    return key;
  }

  let text = content;

  // 1) 保护代码块 (``` ... ```)
  text = text.replace(/```[\s\S]*?```/g, (m) => put(m));

  // 2) 保护行内代码 `...`
  text = text.replace(/`[^`\n]+`/g, (m) => put(m));

  // 3) 保护 HTML 标签
  text = text.replace(/<[^>]+>/g, (m) => put(m));

  // 4) 保护链接 URL 部分 [text](url)
  text = text.replace(/\]\([^)]+\)/g, (m) => put(m));

  // 5) 保护图片 ![alt](url)
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, (m) => put(m));

  // 6) 保护 frontmatter (YAML header)
  text = text.replace(/^---[\s\S]*?---/m, (m) => put(m));

  // 7) 保护命令行
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (isProbablyCommandLine(lines[i])) lines[i] = put(lines[i]);
  }
  text = lines.join("\n");

  // 8) 保护专有名词
  const term = protectTermsPrefixed(text, prefix);
  text = term.out;
  for (const [k, v] of term.map.entries()) placeholders.set(k, v);

  return { text, placeholders };
}

function restorePlaceholders(text, placeholders) {
  let out = text;
  // 多次替换以防模型移动了 token
  for (let i = 0; i < 3; i++) {
    for (const [k, v] of placeholders.entries()) {
      out = out.split(k).join(v);
    }
  }
  return out;
}

function chatCompletionsUrl(baseUrl) {
  const b = String(baseUrl || "").replace(/\/+$/, "");
  if (!b) return "";
  return b.endsWith("/v1") ? `${b}/chat/completions` : `${b}/v1/chat/completions`;
}

async function translateBatch(files) {
  if (!BASE_URL || !API_KEY || !MODEL) {
    throw new Error("Missing translation env: set DASHSCOPE_API_KEY.");
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

  const system = `你是一位资深技术文档翻译专家，精通英汉双语，对软件开发、AI、云计算等领域有深入理解。

你的翻译目标是实现"信达雅"：
- 信（Faithfulness）：准确传达原文技术含义，不遗漏、不曲解
- 达（Expressiveness）：语句通顺流畅，符合中文技术文档的表达习惯
- 雅（Elegance）：用词专业规范，避免机翻腔，让中国开发者读起来自然

硬性规则：
1. 只翻译自然语言说明文字，保持 Markdown 结构不变
2. 任何 @@ 开头和结尾的占位符必须原样保留，不能翻译、删除或修改
3. 以下内容不翻译：
   - 代码、命令、配置项、环境变量
   - URL、文件路径
   - 专有名词：agent、skills、Clawdbot、Gateway、CLI、API、SDK、webhook、cron 等
4. 必须原样保留分隔标记：<<<FILE:...>>> 和 <<<END_FILE:...>>>
5. 输出只包含翻译后的内容，不要添加任何解释

翻译风格指南：
- 使用"您"而非"你"，体现专业尊重
- 技术术语保持一致性，如：configure = 配置，install = 安装
- 避免过度直译，如 "This is a..." 不要翻译成 "这是一个..."
- 段落开头避免 "该/此/本"，直接表述更自然`;

  const user = [
    "请将以下技术文档翻译成简体中文：",
    "",
    segments.join("\n\n"),
  ].join("\n");

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(chatCompletionsUrl(BASE_URL), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.3,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });

      const raw = await res.text();
      if (!res.ok) {
        if (attempt === MAX_RETRIES) throw new Error(`translate failed: ${res.status} ${raw.slice(0, 300)}`);
        await sleep(1000 + attempt * 1000);
        continue;
      }

      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        if (attempt === MAX_RETRIES) throw new Error(`translate: invalid JSON response: ${raw.slice(0, 200)}`);
        await sleep(1000 + attempt * 1000);
        continue;
      }

      const out = data?.choices?.[0]?.message?.content ?? "";
      if (!out.trim()) {
        if (attempt === MAX_RETRIES) throw new Error("translate: empty response");
        await sleep(1000 + attempt * 1000);
        continue;
      }

      // 验证占位符
      const missing = mustHaveTokens.filter((t) => !out.includes(t));
      if (missing.length > mustHaveTokens.length * 0.1) {
        // 允许少量丢失
        if (attempt === MAX_RETRIES) {
          console.warn(`Warning: ${missing.length} placeholders missing, proceeding anyway`);
        } else {
          await sleep(1000 + attempt * 1000);
          continue;
        }
      }

      const results = new Map();
      for (const f of files) {
        const start = `<<<FILE:${f.relPath}>>>`;
        const end = `<<<END_FILE:${f.relPath}>>>`;
        const si = out.indexOf(start);
        const ei = out.indexOf(end);
        if (si === -1 || ei === -1 || ei < si) {
          if (attempt === MAX_RETRIES) {
            // 单文件失败时，返回原文
            console.warn(`Warning: missing segment for ${f.relPath}, using original`);
            results.set(f.relPath, f.srcText);
            continue;
          }
          throw new Error(`missing segment for ${f.relPath}`);
        }
        const inner = out.slice(si + start.length, ei).replace(/^\s*\n/, "").replace(/\n\s*$/, "");
        results.set(f.relPath, restorePlaceholders(inner, placeholders));
      }

      return results;
    } catch (e) {
      if (attempt === MAX_RETRIES) throw e;
      await sleep(1000 + attempt * 1000);
    }
  }

  throw new Error("translate: exhausted retries");
}

async function translateSingle(srcText, relPath) {
  if (!BASE_URL || !API_KEY || !MODEL) {
    throw new Error("Missing translation env: set DASHSCOPE_API_KEY.");
  }

  const prefix = "S_";
  const { text: protectedText, placeholders } = protectMarkdownPrefixed(srcText, prefix);

  const system = `你是一位资深技术文档翻译专家，精通英汉双语，对软件开发、AI、云计算等领域有深入理解。

你的翻译目标是实现"信达雅"：
- 信（Faithfulness）：准确传达原文技术含义，不遗漏、不曲解
- 达（Expressiveness）：语句通顺流畅，符合中文技术文档的表达习惯
- 雅（Elegance）：用词专业规范，避免机翻腔，让中国开发者读起来自然

硬性规则：
1. 只翻译自然语言说明文字，保持 Markdown 结构不变
2. 任何 @@ 开头和结尾的占位符必须原样保留，不能翻译、删除或修改
3. 以下内容不翻译：
   - 代码、命令、配置项、环境变量
   - URL、文件路径
   - 专有名词：agent、skills、Clawdbot、Gateway、CLI、API、SDK、webhook、cron 等
4. 输出只包含翻译后的 Markdown，不要添加任何解释

翻译风格指南：
- 使用"您"而非"你"，体现专业尊重
- 技术术语保持一致性
- 避免过度直译
- 段落开头避免 "该/此/本"`;

  const user = [
    `文件: ${relPath}`,
    "",
    "请翻译以下内容：",
    "",
    protectedText,
  ].join("\n");

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(chatCompletionsUrl(BASE_URL), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.3,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });

      const raw = await res.text();
      if (!res.ok) {
        if (attempt === MAX_RETRIES) throw new Error(`translate failed: ${res.status} ${raw.slice(0, 300)}`);
        await sleep(1000 + attempt * 1000);
        continue;
      }

      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        if (attempt === MAX_RETRIES) throw new Error(`translate: invalid JSON: ${raw.slice(0, 200)}`);
        await sleep(1000 + attempt * 1000);
        continue;
      }

      const out = data?.choices?.[0]?.message?.content ?? "";
      if (!out.trim()) {
        if (attempt === MAX_RETRIES) throw new Error("translate: empty response");
        await sleep(1000 + attempt * 1000);
        continue;
      }

      return restorePlaceholders(out, placeholders);
    } catch (e) {
      if (attempt === MAX_RETRIES) throw e;
      await sleep(1000 + attempt * 1000);
    }
  }

  throw new Error("translate: exhausted retries");
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function* walk(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      yield* walk(full);
    } else if (ent.isFile() && ent.name.endsWith(".md")) {
      yield full;
    }
  }
}

function relFromDocs(absPath) {
  return path.relative(DOCS_DIR, absPath);
}

function outPathFor(absPath) {
  return path.join(DOCS_CN_DIR, relFromDocs(absPath));
}

async function runQueue(items, worker) {
  let i = 0;
  const running = new Set();
  const errors = [];

  const next = async () => {
    if (i >= items.length) return;
    const item = items[i++];
    const p = (async () => worker(item))()
      .catch((e) => {
        errors.push({ item, error: e });
      })
      .finally(() => running.delete(p));
    running.add(p);
    if (running.size >= CONCURRENCY) await Promise.race(running);
    if (DELAY_MS) await sleep(DELAY_MS);
    return next();
  };

  await next();
  await Promise.allSettled([...running]);

  return errors;
}

async function main() {
  console.log("=".repeat(60));
  console.log("Clawdbot 文档翻译工具");
  console.log("=".repeat(60));

  if (!fs.existsSync(DOCS_DIR)) {
    console.error("❌ docs 目录不存在:", DOCS_DIR);
    process.exit(1);
  }

  if (!API_KEY) {
    console.error([
      "❌ 缺少 API Key，请设置以下环境变量之一：",
      "",
      "  Windows (PowerShell):",
      '    $env:DASHSCOPE_API_KEY = "your-api-key"',
      "",
      "  Linux/macOS:",
      '    export DASHSCOPE_API_KEY="your-api-key"',
      "",
      "可选配置：",
      "  TRANSLATE_CONCURRENCY  并发数 (默认: 5)",
      "  TRANSLATE_MODEL        模型 (默认: qwen-plus)",
    ].join("\n"));
    process.exit(1);
  }

  await ensureDir(DOCS_CN_DIR);

  // 收集所有 md 文件
  const files = [];
  for await (const f of walk(DOCS_DIR)) {
    files.push(f);
  }

  console.log(`\n📁 源目录: ${DOCS_DIR}`);
  console.log(`📂 输出目录: ${DOCS_CN_DIR}`);
  console.log(`📄 待翻译文件: ${files.length} 个`);
  console.log(`⚡ 并发数: ${CONCURRENCY}`);
  console.log(`🤖 模型: ${MODEL}`);
  console.log(`🔗 API: ${BASE_URL}`);
  console.log("");

  const report = {
    ts: new Date().toISOString(),
    docsDir: DOCS_DIR,
    docsCnDir: DOCS_CN_DIR,
    counts: { total: files.length, translated: 0, skipped: 0, failed: 0 },
    translated: [],
    skipped: [],
    failed: [],
  };

  // 过滤已翻译的文件
  const toTranslate = [];
  for (const absPath of files) {
    const rel = relFromDocs(absPath);
    const dst = outPathFor(absPath);

    if (fs.existsSync(dst)) {
      report.skipped.push(rel);
      continue;
    }

    toTranslate.push({ absPath, rel, dst });
  }

  console.log(`⏭️  已跳过 (已存在): ${report.skipped.length} 个`);
  console.log(`📝 需要翻译: ${toTranslate.length} 个`);
  console.log("");

  if (toTranslate.length === 0) {
    console.log("✅ 所有文件已翻译完成！");
    report.counts.skipped = report.skipped.length;
    await fsp.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
    return;
  }

  // 分批处理
  const batches = [];
  let cur = [];
  let curChars = 0;

  for (const item of toTranslate) {
    let approxChars = 1;
    try {
      const size = fs.statSync(item.absPath).size || 0;
      approxChars = Math.max(1, Math.floor(size / 2));
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

  console.log(`📦 分为 ${batches.length} 个批次`);
  console.log("");

  let done = 0;
  const startTime = Date.now();

  await runQueue(batches, async (batch) => {
    try {
      if (batch.length === 1) {
        // 单文件翻译
        const it = batch[0];
        const srcText = await fsp.readFile(it.absPath, "utf8");
        const translated = await translateSingle(srcText, it.rel);
        await ensureDir(path.dirname(it.dst));
        await fsp.writeFile(it.dst, translated, "utf8");
        report.translated.push(it.rel);
        done += 1;
      } else {
        // 批量翻译
        const batchFiles = [];
        for (const it of batch) {
          const srcText = await fsp.readFile(it.absPath, "utf8");
          batchFiles.push({ relPath: it.rel, srcText });
        }
        const results = await translateBatch(batchFiles);
        for (const it of batch) {
          const translated = results.get(it.rel);
          if (typeof translated !== "string") {
            throw new Error(`missing result for ${it.rel}`);
          }
          await ensureDir(path.dirname(it.dst));
          await fsp.writeFile(it.dst, translated, "utf8");
          report.translated.push(it.rel);
          done += 1;
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const pct = ((done / toTranslate.length) * 100).toFixed(1);
      console.log(`✅ [${done}/${toTranslate.length}] ${pct}% | ${elapsed}s | ${batch.map(b => b.rel).join(", ")}`);
    } catch (e) {
      for (const it of batch) {
        report.failed.push({ file: it.rel, message: (e?.message || String(e)).slice(0, 500) });
        done += 1;
      }
      console.error(`❌ 翻译失败: ${batch.map(b => b.rel).join(", ")} - ${e?.message || e}`);
    }

    // 定期保存报告
    if (done % 20 === 0 || done === toTranslate.length) {
      report.counts.translated = report.translated.length;
      report.counts.skipped = report.skipped.length;
      report.counts.failed = report.failed.length;
      await fsp.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
    }
  });

  // 最终报告
  report.counts.translated = report.translated.length;
  report.counts.skipped = report.skipped.length;
  report.counts.failed = report.failed.length;
  await fsp.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log("");
  console.log("=".repeat(60));
  console.log("翻译完成！");
  console.log("=".repeat(60));
  console.log(`✅ 成功翻译: ${report.counts.translated} 个`);
  console.log(`⏭️  已跳过: ${report.counts.skipped} 个`);
  console.log(`❌ 失败: ${report.counts.failed} 个`);
  console.log(`⏱️  总耗时: ${totalTime} 分钟`);
  console.log(`📊 报告: ${REPORT_PATH}`);
  console.log(`📂 输出: ${DOCS_CN_DIR}`);

  if (report.counts.failed > 0) {
    console.log("\n失败的文件：");
    for (const f of report.failed) {
      console.log(`  - ${f.file}: ${f.message.slice(0, 100)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
