#!/usr/bin/env node
/**
 * 技能批量汉化脚本
 * 使用 Kimi Code (月之暗面) 批量翻译 3000+ 技能名称和描述
 *
 * 用法:
 *   KIMICODE_API_KEY=sk-kimi-xxx node scripts/batch-translate-skills.mjs
 *
 * 环境变量:
 *   KIMICODE_API_KEY    - Kimi Code API Key (必需)
 *   BATCH_SIZE          - 每批翻译数量 (默认 25)
 *   CONCURRENCY         - 并发请求数 (默认 3)
 *   MAX_RPM             - 每分钟最大请求数 (默认 20)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ============================================================================
// 配置
// ============================================================================

const CONFIG = {
  apiKey: process.env.KIMICODE_API_KEY ?? "",
  baseUrl: "https://api.kimi.com/coding/v1",
  model: "kimi-for-coding",
  temperature: 0.05,
  maxTokens: 8192,
  timeoutMs: 180_000,
  maxRetries: 3,
  batchSize: parseInt(process.env.BATCH_SIZE ?? "5", 10),
  concurrency: parseInt(process.env.CONCURRENCY ?? "5", 10),
  maxRpm: parseInt(process.env.MAX_RPM ?? "30", 10),
  headers: { "User-Agent": "KimiCLI/1.16.0" },
};

// 数据文件路径
const AWESOME_INDEX = path.join(ROOT, "skills-awesome/index.json");
const QINGXI_INDEX = path.join(ROOT, "cn/skills-qc/output-all/skills-index.json");
const ZH_CN_FILE = path.join(ROOT, "ui/src/ui/i18n/locales/zh-CN.ts");
const OUTPUT_JSON = path.join(ROOT, "scripts/skill-translations.json");
const CHECKPOINT_FILE = path.join(ROOT, "scripts/translate-checkpoint.json");

// ============================================================================
// 并发控制
// ============================================================================

class Semaphore {
  constructor(max) { this.max = max; this.current = 0; this.queue = []; }
  async acquire() {
    if (this.current < this.max) { this.current++; return; }
    return new Promise(resolve => this.queue.push(() => { this.current++; resolve(); }));
  }
  release() {
    this.current--;
    const next = this.queue.shift();
    if (next) next();
  }
}

class TokenBucket {
  constructor(tokensPerInterval, intervalMs) {
    this.tpi = tokensPerInterval;
    this.intervalMs = intervalMs;
    this.tokens = tokensPerInterval;
    this.lastRefill = Date.now();
  }
  refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = Math.floor((elapsed / this.intervalMs) * this.tpi);
    if (newTokens > 0) {
      this.tokens = Math.min(this.tpi, this.tokens + newTokens);
      this.lastRefill = now;
    }
  }
  async wait() {
    this.refill();
    if (this.tokens > 0) { this.tokens--; return; }
    const waitMs = Math.ceil(this.intervalMs / this.tpi);
    await sleep(waitMs);
    return this.wait();
  }
}

const semaphore = new Semaphore(CONFIG.concurrency);
const rateLimiter = new TokenBucket(CONFIG.maxRpm, 60_000);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================================
// Qwen API 调用
// ============================================================================

async function callQwen(systemPrompt, userPrompt) {
  await semaphore.acquire();
  try {
    await rateLimiter.wait();

    const body = {
      model: CONFIG.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: CONFIG.temperature,
      max_tokens: CONFIG.maxTokens,
      response_format: { type: "json_object" },
    };

    let lastError = null;
    for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CONFIG.timeoutMs);

        const response = await fetch(`${CONFIG.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${CONFIG.apiKey}`,
            ...CONFIG.headers,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error("API 返回空内容");
        return { content, tokens: data.usage?.total_tokens ?? 0 };
      } catch (err) {
        lastError = err;
        if (attempt < CONFIG.maxRetries) {
          const delay = Math.pow(2, attempt) * 2000;
          console.log(`  ⚠ 重试 #${attempt + 1}: ${err.message} (${delay}ms)`);
          await sleep(delay);
        }
      }
    }
    throw new Error(`API 调用失败 (${CONFIG.maxRetries}次重试): ${lastError?.message}`);
  } finally {
    semaphore.release();
  }
}

// ============================================================================
// 翻译核心逻辑
// ============================================================================

const SYSTEM_PROMPT = `你是技能翻译专家。将英文技能名称和描述翻译成简洁的中文。

规则：
1. skillName 翻译为 2-6 个汉字的简短名称，突出核心功能
2. skillDesc 翻译为 15-40 字的中文描述，说明这个技能是做什么的
3. 技术专有名词保留英文（如 GitHub, Docker, Slack, Redis）
4. 不要添加多余的修饰语
5. 返回严格 JSON 格式

示例：
输入: {"name":"weather","desc":"Get current weather and forecasts for any location worldwide"}
输出: {"name":"天气查询","desc":"查询全球各地的实时天气和未来预报"}

输入: {"name":"github","desc":"Manage GitHub repositories, issues, and pull requests"}
输出: {"name":"GitHub","desc":"管理GitHub仓库、Issue和PR"}

输入: {"name":"spotify-player","desc":"Control Spotify playback, search for music, and manage playlists"}
输出: {"name":"Spotify播放器","desc":"控制Spotify音乐播放、搜索歌曲和管理播放列表"}`;

async function translateBatch(skills) {
  const input = skills.map(s => ({
    id: s.name,
    name: s.name,
    desc: (s.description || "").substring(0, 200),
  }));

  const userPrompt = `翻译以下 ${input.length} 个技能。返回 JSON 数组格式: [{"id":"原始id","name":"中文名","desc":"中文描述"}, ...]

${JSON.stringify(input, null, 0)}`;

  const result = await callQwen(SYSTEM_PROMPT, userPrompt);

  // 解析 JSON
  let jsonStr = result.content.trim();
  const blockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (blockMatch) jsonStr = blockMatch[1].trim();

  // 可能是 {"result": [...]} 格式
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // 尝试提取数组部分
    const arrMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      parsed = JSON.parse(arrMatch[0]);
    } else {
      throw new Error(`JSON 解析失败: ${jsonStr.substring(0, 200)}`);
    }
  }

  // 如果是对象包裹的数组
  if (!Array.isArray(parsed)) {
    // 可能是 {"result": [...]} 或 {"translations": [...]}
    const values = Object.values(parsed);
    const arr = values.find(v => Array.isArray(v));
    if (arr) {
      parsed = arr;
    } else if (parsed.id || parsed.name) {
      // Kimi 有时返回单个对象而不是数组
      parsed = [parsed];
    } else {
      console.warn(`  ⚠ 非标准返回, 尝试提取: ${JSON.stringify(parsed).substring(0, 100)}`);
      parsed = [parsed];
    }
  }

  return { translations: parsed, tokens: result.tokens };
}

// ============================================================================
// 主流程
// ============================================================================

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("   技能批量汉化 - Powered by Qwen Coder (DashScope)");
  console.log("═══════════════════════════════════════════════════════════\n");

  if (!CONFIG.apiKey) {
    console.error("❌ 缺少 KIMICODE_API_KEY 环境变量！");
    console.error("   用法: KIMICODE_API_KEY=sk-kimi-xxx node scripts/batch-translate-skills.mjs");
    process.exit(1);
  }

  // 1. 加载数据
  console.log("📖 加载技能数据...");

  const awesomeData = JSON.parse(fs.readFileSync(AWESOME_INDEX, "utf-8"));
  const allSkills = awesomeData.skills || [];
  console.log(`   skills-awesome: ${allSkills.length} 个技能`);

  let qingxiMap = new Map();
  if (fs.existsSync(QINGXI_INDEX)) {
    const qingxiData = JSON.parse(fs.readFileSync(QINGXI_INDEX, "utf-8"));
    for (const s of qingxiData.skills || []) {
      qingxiMap.set(s.name, s);
    }
    console.log(`   cn/skills-qc: ${qingxiMap.size} 个已有中文`);
  }

  // 2. 加载已有翻译 (zh-CN.ts)
  const zhContent = fs.readFileSync(ZH_CN_FILE, "utf-8");
  const existingNames = new Map();
  const existingDescs = new Map();
  for (const m of zhContent.matchAll(/"skillName\.([^"]+)":\s*"([^"]+)"/g)) {
    existingNames.set(m[1], m[2]);
  }
  for (const m of zhContent.matchAll(/"skillDesc\.([^"]+)":\s*"([^"]+)"/g)) {
    existingDescs.set(m[1], m[2]);
  }
  console.log(`   已有翻译: ${existingNames.size} 名称, ${existingDescs.size} 描述`);

  // 3. 构建翻译映射 (合并已有 + 需要翻译的)
  const translations = new Map(); // name -> { nameZh, descZh }

  // 3a. 先加入已有 zh-CN.ts 翻译
  for (const [key, val] of existingNames) {
    if (!translations.has(key)) translations.set(key, {});
    translations.get(key).nameZh = val;
  }
  for (const [key, val] of existingDescs) {
    if (!translations.has(key)) translations.set(key, {});
    translations.get(key).descZh = val;
  }

  // 3b. 加入 cn/skills-qc 的翻译 (不覆盖已有)
  for (const [name, skill] of qingxiMap) {
    const normalized = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!translations.has(normalized)) translations.set(normalized, {});
    const t = translations.get(normalized);
    if (!t.nameZh && skill.category) {
      // 从 category + tags 生成简短中文名
      t.nameZh = skill.tags?.[0] || skill.category;
    }
    if (!t.descZh && skill.descriptionZh) {
      // 截取前 60 字符作为短描述
      t.descZh = skill.descriptionZh.substring(0, 60).replace(/[，。]$/, "");
    }
  }

  // 3c. 确定需要翻译的技能
  const needTranslation = [];
  for (const skill of allSkills) {
    const normalized = skill.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const existing = translations.get(normalized);
    if (!existing || !existing.nameZh || !existing.descZh) {
      needTranslation.push({
        name: normalized,
        originalName: skill.skillName || skill.name,
        description: skill.description || "",
      });
    }
  }

  console.log(`\n📊 统计:`);
  console.log(`   总技能: ${allSkills.length}`);
  console.log(`   已翻译: ${allSkills.length - needTranslation.length}`);
  console.log(`   需翻译: ${needTranslation.length}`);

  if (needTranslation.length === 0) {
    console.log("\n✅ 所有技能已翻译！");
    outputResults(translations);
    return;
  }

  // 4. 加载 checkpoint (断点续跑)
  let startIndex = 0;
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      const cp = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf-8"));
      startIndex = cp.lastIndex ?? 0;
      // 恢复已翻译数据
      for (const [k, v] of Object.entries(cp.translations || {})) {
        if (!translations.has(k)) translations.set(k, v);
        else Object.assign(translations.get(k), v);
      }
      console.log(`   📌 从 checkpoint 恢复, 跳过前 ${startIndex} 个`);
    } catch { /* ignore */ }
  }

  // 5. 分批翻译
  const batches = [];
  for (let i = startIndex; i < needTranslation.length; i += CONFIG.batchSize) {
    batches.push(needTranslation.slice(i, i + CONFIG.batchSize));
  }

  const totalBatches = batches.length;
  console.log(`\n🚀 开始翻译: ${totalBatches} 批, 每批 ${CONFIG.batchSize} 个, 并发 ${CONFIG.concurrency}`);
  console.log(`   预计 API 调用: ${totalBatches} 次\n`);

  let completedBatches = 0;
  let totalTokens = 0;
  let errors = 0;
  const startTime = Date.now();

  // 并发执行批次
  const PARALLEL_BATCHES = CONFIG.concurrency;
  for (let i = 0; i < batches.length; i += PARALLEL_BATCHES) {
    const chunk = batches.slice(i, i + PARALLEL_BATCHES);
    const promises = chunk.map(async (batch, idx) => {
      const batchIdx = i + idx + 1;
      try {
        const result = await translateBatch(batch);
        totalTokens += result.tokens;

        // 保存翻译结果
        for (const t of result.translations) {
          const key = (t.id || "").toLowerCase().replace(/[^a-z0-9-]/g, "-");
          if (!key) continue;
          if (!translations.has(key)) translations.set(key, {});
          const entry = translations.get(key);
          if (t.name) entry.nameZh = t.name;
          if (t.desc) entry.descZh = t.desc;
        }

        completedBatches++;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const pct = ((completedBatches / totalBatches) * 100).toFixed(1);
        console.log(`  ✓ [${completedBatches}/${totalBatches}] ${pct}% | ${batch.length}个技能 | ${result.tokens} tokens | ${elapsed}s`);
      } catch (err) {
        errors++;
        console.error(`  ✗ 批次 ${batchIdx} 失败: ${err.message}`);
      }
    });

    await Promise.all(promises);

    // 每轮保存 checkpoint
    const cpData = {
      lastIndex: startIndex + (i + chunk.length) * CONFIG.batchSize,
      translations: Object.fromEntries(translations),
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cpData, null, 2));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n════════════════════════════════════════════`);
  console.log(`  完成! 耗时 ${elapsed}s | ${totalTokens} tokens | ${errors} 错误`);
  console.log(`════════════════════════════════════════════\n`);

  // 6. 输出结果
  outputResults(translations);
}

function outputResults(translations) {
  // 6a. 保存完整 JSON
  const jsonData = Object.fromEntries(translations);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(jsonData, null, 2));
  console.log(`📦 翻译 JSON 已保存: ${OUTPUT_JSON} (${translations.size} 条)`);

  // 6b. 生成 zh-CN.ts 片段
  const nameLines = [];
  const descLines = [];

  const sortedKeys = [...translations.keys()].sort();
  for (const key of sortedKeys) {
    const t = translations.get(key);
    if (t.nameZh) {
      const val = t.nameZh.replace(/"/g, '\\"');
      nameLines.push(`  "skillName.${key}": "${val}",`);
    }
    if (t.descZh) {
      const val = t.descZh.replace(/"/g, '\\"');
      descLines.push(`  "skillDesc.${key}": "${val}",`);
    }
  }

  // 6c. 直接注入到 zh-CN.ts
  const zhContent = fs.readFileSync(ZH_CN_FILE, "utf-8");

  const translationBlock = `  // ============================================================================
  // 技能名称中文翻译 — 批量生成 (${new Date().toISOString().split("T")[0]})
  // 共 ${nameLines.length} 个名称翻译
  // ============================================================================
${nameLines.join("\n")}

  // ============================================================================
  // 技能描述中文翻译 — 批量生成
  // 共 ${descLines.length} 个描述翻译
  // ============================================================================
${descLines.join("\n")}`;

  const sectionStart = zhContent.indexOf('  // ============================================================================\n  // 技能名称中文翻译');
  if (sectionStart !== -1) {
    // 找技能翻译区域的结束点：auto-synced 注释或 } as const;（保留后续内容）
    const autoSyncMarker = zhContent.indexOf('\n  // Auto-synced from en.ts', sectionStart);
    const closingBrace = zhContent.lastIndexOf("} as const;");
    const sectionEnd = autoSyncMarker !== -1 ? autoSyncMarker : closingBrace;
    const beforeSection = zhContent.substring(0, sectionStart);
    const afterSection = zhContent.substring(sectionEnd);
    const newContent = beforeSection + translationBlock + afterSection;
    fs.writeFileSync(ZH_CN_FILE, newContent);
    console.log(`\n✅ zh-CN.ts 已自动更新!`);
  } else {
    const snippetFile = path.join(ROOT, "scripts/skill-translations-zhcn.ts.txt");
    fs.writeFileSync(snippetFile, translationBlock);
    console.log(`📝 未找到插入点, 片段已保存: ${snippetFile}`);
  }

  console.log(`   名称: ${nameLines.length} 条, 描述: ${descLines.length} 条`);
}

main().catch((err) => {
  console.error("❌ 致命错误:", err);
  process.exit(1);
});
