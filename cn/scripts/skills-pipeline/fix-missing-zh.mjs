#!/usr/bin/env node
/**
 * 快速修复：补翻译 + 修标签
 * 只对已收录但缺翻译的技能调 API，不重跑完整 pipeline
 */
import fs from "node:fs";
import path from "node:path";
import { ProxyAgent, setGlobalDispatcher } from "undici";

// 自动走代理（国内访问 Google API 需要）
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) {
  setGlobalDispatcher(new ProxyAgent(proxy));
  console.log(`Using proxy: ${proxy}`);
}

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyBTw9uv98t5FCQM0NC8A-LX3DakG5JotXc";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const MODEL = "gemini-2.0-flash";
const CONCURRENCY = parseInt(process.env.FIX_CONCURRENCY || "10");
const MERGED_DIR = "./skills-merged";
const OUTPUT_DIR = "./cn/skills-qc/output-all";
const CHECKPOINT_FILE = "./_fix_checkpoint.json";

// 标签翻译 prompt
const TAG_FIX_PROMPT = `将以下英文标签翻译为简短中文使用场景标签。每个标签2-6个字。
输入: ["tag1", "tag2", ...]
输出: 只返回 JSON 数组，如 ["中文标签1", "中文标签2", ...]

规则:
- 专有名词保留但加中文说明，如 Spotify → "Spotify音乐", OAuth → "OAuth认证"
- 通用词直接翻译，如 productivity → "生产力", automation → "自动化"
- 已经是中文的保持不变`;

// 翻译 prompt
const TRANSLATE_PROMPT = `将以下英文 SKILL.md 翻译为中文版本。
规则:
1. frontmatter.name 保持英文不变
2. frontmatter.description 翻译为中文
3. body 全部翻译为中文
4. 代码块、命令、URL、变量名保持英文
5. 技术术语无通用译法时保留英文 (API, OAuth, webhook 等)
6. 使用简洁准确的技术文档风格
直接输出翻译后的完整 SKILL.md 内容（含 frontmatter），不要加额外说明。`;

async function callAPI(systemPrompt, userPrompt, maxTokens = 4096, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const resp = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], temperature: 0.1, max_tokens: maxTokens }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.status === 429) {
        if (attempt < retries) {
          const wait = (attempt + 1) * 30000; // 30s, 60s, 90s
          process.stdout.write(`\n  ⏳ 429限流, 等待${wait/1000}s后重试...`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
      }
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`API ${resp.status}: ${txt.substring(0, 200)}`);
      }
      const data = await resp.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (e) {
      clearTimeout(timeout);
      if (attempt < retries && (e.name === "AbortError" || e.message?.includes("429"))) {
        const wait = (attempt + 1) * 20000;
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw e;
    }
  }
  throw new Error("Max retries exceeded");
}

// 并发控制
async function runPool(tasks, limit) {
  const results = [];
  let idx = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (idx < tasks.length) {
      const i = idx++;
      try { results[i] = await tasks[i](); } catch (e) { results[i] = { error: e.message }; }
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const list = JSON.parse(fs.readFileSync("_reprocess_list.json", "utf8"));

  // Load checkpoint — skip already done
  let done = new Set();
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try { done = new Set(JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf8"))); } catch {}
  }
  const todo = list.filter(n => !done.has(n));
  console.log(`\n需修复: ${todo.length} 个技能 (已完成${done.size}), 并发: ${CONCURRENCY}\n`);

  let fixedZh = 0, fixedTags = 0, errors = 0;

  const tasks = todo.map((name, i) => async () => {
    const reportPath = path.join(OUTPUT_DIR, "report", `${name}.json`);
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    const q = report.layer3?.quality ?? {};
    const zhDir = path.join(OUTPUT_DIR, "skills-zh", name);
    const hasZh = fs.existsSync(path.join(zhDir, "SKILL.md"));
    const tags = q.tags ?? [];
    const hasEngTag = tags.some(t => !/[\u4e00-\u9fff]/.test(t));

    let changed = false;

    // 1. 修标签
    if (hasEngTag && tags.length > 0) {
      const engTags = tags.filter(t => !/[\u4e00-\u9fff]/.test(t));
      if (engTags.length > 0) {
        try {
          const result = await callAPI(TAG_FIX_PROMPT, JSON.stringify(engTags));
          const match = result.match(/\[[\s\S]*\]/);
          if (match) {
            const translated = JSON.parse(match[0]);
            const newTags = tags.map(t => {
              if (/[\u4e00-\u9fff]/.test(t)) return t;
              const idx = engTags.indexOf(t);
              return idx >= 0 && translated[idx] ? translated[idx] : t;
            });
            report.layer3.quality.tags = [...new Set(newTags)];
            changed = true;
            fixedTags++;
          }
        } catch (e) {
          // 标签修复失败，跳过
        }
      }
    }

    // 2. 补翻译（不管 cn_blocked，全部翻译）
    if (!hasZh) {
      const skillPath = path.join(MERGED_DIR, name, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        try {
          const content = fs.readFileSync(skillPath, "utf8");
          if (content.length < 30000) { // 跳过超大文件
            const translated = await callAPI(TRANSLATE_PROMPT, content, 8192);
            if (translated && translated.startsWith("---") && /[\u4e00-\u9fff]/.test(translated)) {
              fs.mkdirSync(zhDir, { recursive: true });
              fs.writeFileSync(path.join(zhDir, "SKILL.md"), translated, "utf8");
              // 更新 report
              if (report.layer3) {
                report.layer3.translation = { translatedContent: translated, validationPassed: true };
              }
              changed = true;
              fixedZh++;
            }
          }
        } catch (e) {
          errors++;
        }
      }
    }

    if (changed) {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
    }

    // Checkpoint: mark as done (even if nothing changed, so we skip on retry)
    done.add(name);
    if ((done.size % 10) === 0) {
      fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify([...done]), "utf8");
    }

    const total = fixedZh + fixedTags + errors;
    if (total % 10 === 0 || i === todo.length - 1) {
      process.stdout.write(`\r  [${i + 1}/${todo.length}] 翻译+${fixedZh} 标签+${fixedTags} 错误=${errors}`);
    }
  });

  await runPool(tasks, CONCURRENCY);

  // Final checkpoint save
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify([...done]), "utf8");

  console.log(`\n\n${"=".repeat(50)}`);
  console.log(`修复完成！`);
  console.log(`  翻译补充: ${fixedZh}`);
  console.log(`  标签修复: ${fixedTags}`);
  console.log(`  错误: ${errors}`);
  console.log(`${"=".repeat(50)}`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
