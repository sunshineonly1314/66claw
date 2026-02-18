#!/usr/bin/env node
/**
 * Retry failed translations with optimized prompts and strategies.
 *
 * Optimizations:
 * 1. More visible placeholder format: «CODE_N» instead of @@PH_N@@
 * 2. Explicit placeholder count in prompt
 * 3. Lower temperature (0.1)
 * 4. More retries (5)
 * 5. Smart placeholder recovery if model drops some
 * 6. Segment-based translation for large files
 *
 * Usage: node scripts/retry-failed-translations.mjs
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const MIRROR = path.resolve(process.env.CLAWDHUB_MIRROR || "cn/skills-mirror");
const IN_SKILLS_DIR = path.join(MIRROR, "skills");
const OUT_SKILLS_DIR = path.join(MIRROR, "cn", "skills");
const REPORT_PATH = path.join(MIRROR, "cn", "translate-report.json");

const DEFAULT_QWEN_DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const BASE_URL = (process.env.TRANSLATE_BASE_URL || DEFAULT_QWEN_DASHSCOPE_BASE_URL).replace(/\/+$/, "");
const API_KEY = process.env.TRANSLATE_API_KEY || process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY || "";
const MODEL = process.env.TRANSLATE_MODEL || "qwen-plus";
const MAX_RETRIES = 5;
const DELAY_MS = 500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function chatCompletionsUrl(baseUrl) {
  const b = String(baseUrl || "").replace(/\/+$/, "");
  if (!b) return "";
  return b.endsWith("/v1") ? `${b}/chat/completions` : `${b}/v1/chat/completions`;
}

function isProbablyCommandLine(line) {
  const s = line.trim();
  if (!s) return false;
  if (s.startsWith("```")) return false;
  if (s.startsWith("$ ") || s.startsWith("> ")) return true;
  if (/^(sudo|curl|wget|ssh|scp|git|npm|pnpm|bunx?|node|python|pip|docker|kubectl|brew|clawdbot|atvremote|scripts\/)\b/i.test(s)) return true;
  if (/^([A-Za-z0-9_./-]+)(\s+--?[A-Za-z0-9][A-Za-z0-9-]*([=\s][^#]+)?)$/.test(s)) return true;
  if (/\b(--help|--version|--api-key|--token|--model|--base-url)\b/i.test(s)) return true;
  return false;
}

// Use more visible placeholder format with smart handling
function protectMarkdownV2(content) {
  const placeholders = new Map();
  let n = 0;

  function put(value) {
    // Use guillemets «» which are very visible and unlikely to be in code
    const key = `«CODE_${n++}»`;
    placeholders.set(key, value);
    return key;
  }

  let text = content;

  // 0) Protect blockquotes that contain code blocks (e.g., > ``` ... > ```)
  // These are tricky because the code block is inside a quote
  text = text.replace(/((?:^>.*\n)+)/gm, (block) => {
    if (block.includes("```")) {
      // This blockquote contains code, protect the entire thing
      return put(block);
    }
    return block;
  });

  // 1) Protect fenced code blocks (always use placeholder)
  text = text.replace(/```[\s\S]*?```/g, (m) => put(m));

  // 2) Protect inline code - BUT for short code, use a simpler marker
  // Short inline code (like `python3.11`) often gets lost, so we use a 
  // more robust approach: wrap in ⟦ ⟧ which models preserve better
  text = text.replace(/`([^`\n]+)`/g, (m, code) => {
    if (code.length < 40) {
      // For short code, use inline preservation markers
      // These look like "don't translate" markers to the model
      return `⟦${code}⟧`;
    }
    return put(m);
  });

  // 3) Protect command-like lines
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (isProbablyCommandLine(lines[i])) lines[i] = put(lines[i]);
  }
  text = lines.join("\n");

  // 4) Protect key terms (agent, skills) - inline preservation
  text = text.replace(/\b(agent|skills)\b/gi, (m) => `⟦${m}⟧`);

  return { text, placeholders };
}

// Restore both placeholder formats
function restorePlaceholdersV2(text, placeholders) {
  let out = text;
  
  // Restore «CODE_N» placeholders
  for (const [k, v] of placeholders.entries()) {
    out = out.split(k).join(v);
  }
  
  // Restore ⟦...⟧ inline preserved content back to backticks
  out = out.replace(/⟦([^⟧]+)⟧/g, (m, code) => {
    // If it looks like it was inline code, restore backticks
    // If it's agent/skills, just return the word
    if (code === 'agent' || code === 'skills' || code === 'Agent' || code === 'Skills') {
      return code;
    }
    return '`' + code + '`';
  });
  
  return out;
}

function restorePlaceholders(text, placeholders) {
  return restorePlaceholdersV2(text, placeholders);
}

// Try to recover missing placeholders by finding similar patterns
function recoverMissingPlaceholders(translated, original, placeholders, missing) {
  let result = translated;
  
  for (const key of missing) {
    const value = placeholders.get(key);
    if (!value) continue;
    
    // If the original value appears in the translation, the model might have
    // accidentally expanded it. Try to re-protect it.
    if (result.includes(value)) {
      result = result.replace(value, key);
      continue;
    }
    
    // If it's a code block, try to find it by content pattern
    if (value.startsWith("```")) {
      const codeMatch = value.match(/```(\w*)\n([\s\S]*?)```/);
      if (codeMatch) {
        const lang = codeMatch[1];
        const codeContent = codeMatch[2].slice(0, 50); // First 50 chars
        // Look for similar code in translation
        const pattern = new RegExp("```" + lang + "\\n[\\s\\S]*?" + escapeRegex(codeContent.slice(0, 20)));
        if (pattern.test(result)) {
          // Model expanded the code block - need to insert placeholder
          // This is complex, so we'll just fail gracefully
        }
      }
    }
  }
  
  return result;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function translateTextOptimized(original, ctx) {
  if (!API_KEY) {
    throw new Error("Missing DASHSCOPE_API_KEY or TRANSLATE_API_KEY");
  }

  const { text, placeholders } = protectMarkdownV2(original);
  const mustHaveTokens = [...placeholders.keys()];
  const placeholderCount = mustHaveTokens.length;

  // Enhanced system prompt with explicit placeholder count
  const system = [
    "你是专业技术文档译者。任务：把输入的 Markdown 翻译成简体中文。",
    "",
    "【关键规则 - 必须严格遵守】",
    "",
    "文档中有两种保护标记，都【禁止翻译、删除或修改】：",
    `1. 代码块占位符 «CODE_N»（共 ${placeholderCount} 个）- 代表代码块，必须原样保留`,
    "2. 行内代码标记 ⟦...⟧ - 代表行内代码和术语，必须原样保留（包括⟦和⟧符号）",
    "",
    "具体规则：",
    "- «CODE_N» 占位符必须原样出现在输出中，一个都不能少。",
    "- ⟦...⟧ 标记必须原样出现在输出中，包括其中的内容。",
    "- 只翻译普通的中文说明文字。",
    "- 保持 Markdown 结构不变。",
    "- 输出只包含翻译后的 Markdown，不要加解释。",
    "",
    `【重要】输出必须包含全部 ${placeholderCount} 个 «CODE_N» 占位符，以及所有 ⟦...⟧ 标记！`,
  ].join("\n");

  const user = [
    `文件: ${ctx.relPath}`,
    `«CODE_N» 占位符数量: ${placeholderCount}`,
    "",
    "请翻译以下内容（保留所有 «CODE_N» 占位符和 ⟦...⟧ 标记）：",
    "",
    text,
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
          temperature: 0.1, // Lower temperature for more consistency
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });

      const raw = await res.text();
      if (!res.ok) {
        console.log(`  [${attempt}/${MAX_RETRIES}] API error: ${res.status}`);
        if (attempt === MAX_RETRIES) throw new Error(`translate failed: ${res.status} ${raw.slice(0, 200)}`);
        await sleep(1000 + attempt * 500);
        continue;
      }

      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        console.log(`  [${attempt}/${MAX_RETRIES}] Invalid JSON response`);
        if (attempt === MAX_RETRIES) throw new Error(`translate: invalid JSON`);
        await sleep(1000 + attempt * 500);
        continue;
      }

      const out = data?.choices?.[0]?.message?.content ?? "";
      if (!out.trim()) {
        console.log(`  [${attempt}/${MAX_RETRIES}] Empty response`);
        if (attempt === MAX_RETRIES) throw new Error("translate: empty response");
        await sleep(1000 + attempt * 500);
        continue;
      }

      // Validate all placeholders remain
      const missing = mustHaveTokens.filter((t) => !out.includes(t));
      if (missing.length) {
        console.log(`  [${attempt}/${MAX_RETRIES}] Missing ${missing.length} placeholders: ${missing.slice(0, 3).join(", ")}...`);
        
        // Try to recover missing placeholders
        const recovered = recoverMissingPlaceholders(out, original, placeholders, missing);
        const stillMissing = mustHaveTokens.filter((t) => !recovered.includes(t));
        
        if (stillMissing.length === 0) {
          console.log(`  [${attempt}/${MAX_RETRIES}] Recovered all placeholders!`);
          return restorePlaceholders(recovered, placeholders);
        }
        
        if (attempt === MAX_RETRIES) {
          throw new Error(`translate: model dropped ${stillMissing.length} placeholders: ${stillMissing.slice(0, 3).join(", ")}`);
        }
        await sleep(1000 + attempt * 500);
        continue;
      }

      return restorePlaceholders(out, placeholders);
    } catch (e) {
      if (attempt === MAX_RETRIES) throw e;
      console.log(`  [${attempt}/${MAX_RETRIES}] Error: ${e.message}`);
      await sleep(1000 + attempt * 500);
    }
  }

  throw new Error("translate: exhausted retries");
}

// For very large files, split into segments and translate each
async function translateLargeFile(original, ctx) {
  const { text, placeholders } = protectMarkdownV2(original);
  const placeholderCount = placeholders.size;
  
  // If too many placeholders, try segment-based approach
  if (placeholderCount > 50) {
    console.log(`  Large file with ${placeholderCount} placeholders, using segment approach...`);
    
    // Split by headers (## or ###)
    const segments = [];
    let current = [];
    const lines = text.split("\n");
    
    for (const line of lines) {
      if (/^#{1,3}\s/.test(line) && current.length > 0) {
        segments.push(current.join("\n"));
        current = [line];
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) {
      segments.push(current.join("\n"));
    }
    
    // If we got reasonable segments, translate each
    if (segments.length > 1 && segments.length <= 20) {
      console.log(`  Split into ${segments.length} segments`);
      const translatedSegments = [];
      
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const segPlaceholders = new Map();
        
        // Extract placeholders used in this segment
        for (const [k, v] of placeholders.entries()) {
          if (seg.includes(k)) {
            segPlaceholders.set(k, v);
          }
        }
        
        console.log(`  Translating segment ${i + 1}/${segments.length} (${segPlaceholders.size} placeholders)...`);
        
        // Create mini-prompt for this segment
        const system = [
          "你是技术文档译者。翻译以下 Markdown 片段为简体中文。",
          "",
          "规则：",
          "- 保留所有 «...» 占位符，不要翻译或删除。",
          "- 只翻译自然语言。",
          "- 保持 Markdown 格式。",
        ].join("\n");
        
        const res = await fetch(chatCompletionsUrl(BASE_URL), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            temperature: 0.1,
            messages: [
              { role: "system", content: system },
              { role: "user", content: seg },
            ],
          }),
        });
        
        if (!res.ok) {
          throw new Error(`Segment ${i + 1} failed: ${res.status}`);
        }
        
        const data = await res.json();
        const translated = data?.choices?.[0]?.message?.content ?? "";
        
        // Validate segment placeholders
        for (const k of segPlaceholders.keys()) {
          if (!translated.includes(k)) {
            throw new Error(`Segment ${i + 1} dropped placeholder ${k}`);
          }
        }
        
        translatedSegments.push(translated);
        await sleep(DELAY_MS);
      }
      
      // Combine segments and restore
      const combined = translatedSegments.join("\n\n");
      return restorePlaceholders(combined, placeholders);
    }
  }
  
  // Fallback to normal translation
  return translateTextOptimized(original, ctx);
}

async function main() {
  if (!API_KEY) {
    console.error("Missing DASHSCOPE_API_KEY. Set it and retry.");
    process.exit(1);
  }
  
  // Read the report to get failed files
  if (!fs.existsSync(REPORT_PATH)) {
    console.error("No translate-report.json found");
    process.exit(1);
  }
  
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
  const failedFiles = report.failed || [];
  
  if (failedFiles.length === 0) {
    console.log("No failed files to retry!");
    process.exit(0);
  }
  
  console.log(`Found ${failedFiles.length} failed files to retry`);
  console.log(`Using model: ${MODEL}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log("");
  
  const results = {
    success: [],
    failed: [],
  };
  
  for (let i = 0; i < failedFiles.length; i++) {
    const item = failedFiles[i];
    const relPath = item.file;
    const srcPath = path.join(IN_SKILLS_DIR, relPath);
    const dstPath = path.join(OUT_SKILLS_DIR, relPath);
    
    console.log(`[${i + 1}/${failedFiles.length}] ${relPath}`);
    
    if (!fs.existsSync(srcPath)) {
      console.log(`  Source file not found, skipping`);
      results.failed.push({ file: relPath, message: "source not found" });
      continue;
    }
    
    // Skip if already translated (from a previous run)
    if (fs.existsSync(dstPath)) {
      console.log(`  Already exists, skipping`);
      results.success.push(relPath);
      continue;
    }
    
    try {
      const srcText = await fsp.readFile(srcPath, "utf8");
      
      // Count placeholders to decide strategy
      const { placeholders } = protectMarkdownV2(srcText);
      const placeholderCount = placeholders.size;
      console.log(`  ${placeholderCount} placeholders`);
      
      let translated;
      if (placeholderCount > 80) {
        // Very large file - use segment approach
        translated = await translateLargeFile(srcText, { relPath });
      } else {
        translated = await translateTextOptimized(srcText, { relPath });
      }
      
      // Ensure directory exists
      await fsp.mkdir(path.dirname(dstPath), { recursive: true });
      await fsp.writeFile(dstPath, translated, "utf8");
      
      console.log(`  ✓ Success!`);
      results.success.push(relPath);
    } catch (e) {
      console.log(`  ✗ Failed: ${e.message}`);
      results.failed.push({ file: relPath, message: e.message });
    }
    
    await sleep(DELAY_MS);
  }
  
  console.log("");
  console.log("=== Results ===");
  console.log(`Success: ${results.success.length}`);
  console.log(`Failed: ${results.failed.length}`);
  
  if (results.failed.length > 0) {
    console.log("");
    console.log("Still failed:");
    for (const f of results.failed) {
      console.log(`  - ${f.file}: ${f.message}`);
    }
  }
  
  // Update report
  const newReport = { ...report };
  newReport.retried = {
    ts: new Date().toISOString(),
    success: results.success,
    failed: results.failed,
  };
  await fsp.writeFile(REPORT_PATH, JSON.stringify(newReport, null, 2), "utf8");
  console.log(`\nReport updated: ${REPORT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
