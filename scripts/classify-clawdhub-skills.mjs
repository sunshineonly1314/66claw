#!/usr/bin/env node
/**
 * Classify downloaded ClawdHub skills into:
 * - 中国用户可用 (china_ok): no blocked services or supports China providers
 * - 非中国用户可用 (non_china_only): requires OpenAI/Anthropic/Google/Perplexity/xAI etc.
 * - 网络不可达 (network_failed): from download-report.json failed list; suggest alternatives
 *
 * Usage: run after batch-download-clawdhub-skills.mjs
 *   node scripts/classify-clawdhub-skills.mjs
 * Env:   CLAWDHUB_MIRROR (default ./clawdhub-skills-mirror)
 */

import fs from "node:fs";
import path from "node:path";

const MIRROR = path.resolve(process.env.CLAWDHUB_MIRROR || "clawdhub-skills-mirror");
const SKILLS_DIR = path.join(MIRROR, "skills");
const REPORT_PATH = path.join(MIRROR, "download-report.json");
const CLASS_PATH = path.join(MIRROR, "skills-classification.json");
const MD_PATH = path.join(MIRROR, "中国用户与非中国用户技能报告.md");

// 强依赖境外/常被墙的服务 -> 判为 non_china_only
const NON_CHINA_KEYWORDS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_",
  "GOOGLE_",
  "PERPLEXITY",
  "XAI_",
  "GROK",
  "TAVILY_API",
  "EXA_API",
  "OPENROUTER", // 混合，但多数用境外节点
  "github.com",
  "claude.ai",
  "openai.com",
  "anthropic.com",
  "Google AI",
  "Perplexity API",
  "xAI",
  "Grok",
  "Tavily",
  "Exa AI",
  "Cloudflare Workers",
  "Vercel ",
  "discord.com",
  "slack.com",
  "twitter.com",
  "X/Twitter API",
  "Mastodon ",
  "Bluesky",
  "WhatsApp Business API",
  "telegram bot api",
].map((s) => s.toLowerCase());

// 明确支持国内/国内可替代 -> 判为 china_ok
const CHINA_OK_KEYWORDS = [
  "DASHSCOPE",
  "QWEN",
  "DEEPSEEK",
  "ZHIPU",
  "GLM",
  "MOONSHOT",
  "KIMI",
  "Z.AI",
  "BAIDU",
  "通义",
  "豆包",
  "智谱",
  "月之暗面",
  "Kimi",
  "Moonshot",
  "DeepSeek",
  "dashscope",
  "aliyun",
  "阿里",
  "百川",
  "零一",
].map((s) => s.toLowerCase());

function parseSkillMd(dir) {
  const p = path.join(dir, "SKILL.md");
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8");
  const meta = {};
  let body = raw;
  const fmMatch = raw.match(/^\s*---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (fmMatch) {
    body = fmMatch[2] || "";
    const block = fmMatch[1];
    for (const line of block.split("\n")) {
      const m = line.match(/^(\w[\w-]*):\s*(.*)$/);
      if (m) meta[m[1]] = m[2].trim();
    }
    try {
      if (meta.metadata) meta._parsed = JSON.parse(meta.metadata);
    } catch (_) {}
  }
  return { meta, body, raw: raw.slice(0, 8000) };
}

function classifySkill(slug, { meta, body, raw }) {
  const text = [meta.description, meta.name, body, raw].filter(Boolean).join(" ").toLowerCase();
  const metaObj = meta._parsed || {};
  const claw = metaObj.clawdbot || metaObj.moltbot || {};
  const req = claw.requires || {};
  const envList = [].concat(req.env || []);
  const binsList = [].concat(req.bins || []);
  const envBinsText = [...envList, ...binsList].join(" ").toLowerCase();

  const hasNonChina = NON_CHINA_KEYWORDS.some((k) => text.includes(k) || envBinsText.includes(k));
  const hasChina = CHINA_OK_KEYWORDS.some((k) => text.includes(k) || envBinsText.includes(k));

  if (hasChina && !hasNonChina) return "china_ok";
  if (hasNonChina && !hasChina) return "non_china_only";
  if (hasChina && hasNonChina) return "china_ok"; // 同时支持则算中国可用
  return "china_ok"; // 无明确依赖默认视为可用（文档/本地类）
}

function tokenize(s) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function suggestAlternatives(failedSlug, allOk, bySlug) {
  const failedMeta = bySlug[failedSlug];
  if (!failedMeta) return [];
  const words = new Set(tokenize((failedMeta.description || "") + " " + failedSlug));
  const scored = allOk
    .filter((s) => s !== failedSlug)
    .map((slug) => {
      const m = bySlug[slug];
      if (!m) return { slug, score: 0 };
      const desc = (m.description || "") + " " + slug;
      const descWords = new Set(tokenize(desc));
      let score = 0;
      for (const w of words) {
        if (descWords.has(w)) score += 2;
        if (desc.includes(w)) score += 1;
      }
      return { slug, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map((x) => x.slug);
}

function main() {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.error("Skills dir not found:", SKILLS_DIR, "- run batch-download-clawdhub-skills.mjs first");
    process.exit(1);
  }

  let report = { ok: [], failed: [] };
  if (fs.existsSync(REPORT_PATH)) {
    report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
  }

  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  const chinaOk = [];
  const nonChinaOnly = [];
  const bySlug = {};

  for (const d of dirs) {
    const slug = d.name;
    const parsed = parseSkillMd(path.join(SKILLS_DIR, slug));
    if (!parsed) continue;
    bySlug[slug] = { description: parsed.meta.description, name: parsed.meta.name };
    const tag = classifySkill(slug, parsed);
    if (tag === "china_ok") chinaOk.push(slug);
    else nonChinaOnly.push(slug);
  }

  const networkFailed = (report.failed || []).map((f) => (typeof f === "string" ? f : f.slug));
  const okSlugs = [...new Set([...(report.ok || []), ...chinaOk, ...nonChinaOnly])];
  const alternatives = {};
  for (const slug of networkFailed) {
    alternatives[slug] = suggestAlternatives(slug, okSlugs, bySlug);
  }

  const out = {
    ts: new Date().toISOString(),
    china_ok: chinaOk.sort(),
    non_china_only: nonChinaOnly.sort(),
    network_failed: networkFailed,
    alternatives,
    counts: { china_ok: chinaOk.length, non_china_only: nonChinaOnly.length, network_failed: networkFailed.length },
  };
  fs.writeFileSync(CLASS_PATH, JSON.stringify(out, null, 2), "utf8");

  const md = [
    "# ClawdHub 技能分类报告",
    "",
    "基于本地镜像目录与下载报告生成。",
    "",
    "## 数量汇总",
    "",
    "| 分类 | 数量 |",
    "|------|------|",
    `| 中国用户可用 | ${out.counts.china_ok} |`,
    `| 仅非中国用户可用 | ${out.counts.non_china_only} |`,
    `| 网络不可达（已排除） | ${out.counts.network_failed} |`,
    "",
    "## 一、中国用户可用的 skills",
    "",
    "以下技能在中国网络环境下可直接或配置国内服务使用：",
    "",
    "```",
    out.china_ok.join("\n"),
    "```",
    "",
    "## 二、仅非中国用户可用的 skills",
    "",
    "以下技能依赖境外 API 或服务，在中国大陆可能无法直连，需代理或替代方案：",
    "",
    "```",
    out.non_china_only.join("\n"),
    "```",
    "",
    "## 三、网络不可达（已排除）及替代建议",
    "",
    "以下技能在批量下载时因网络问题未能获取，建议使用替代技能或稍后重试下载。",
    "",
  ];
  for (const slug of out.network_failed) {
    const alt = (out.alternatives[slug] || []).slice(0, 3);
    md.push(`- **${slug}**`);
    if (alt.length) md.push(`  替代建议: ${alt.join(", ")}`);
    else md.push(`  替代建议: （暂无同类型推荐，可从“中国用户可用”中按需选用）`);
    md.push("");
  }
  md.push("");
  md.push("---");
  md.push("生成时间: " + out.ts);
  md.push("镜像目录: " + MIRROR);

  fs.writeFileSync(MD_PATH, md.join("\n"), "utf8");
  console.log("Classification written to:", CLASS_PATH);
  console.log("Report written to:", MD_PATH);
  console.log("China-ok:", out.counts.china_ok, "Non-China-only:", out.counts.non_china_only, "Network-failed:", out.counts.network_failed);
}

main();
