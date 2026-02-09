#!/usr/bin/env node
/**
 * 合并已有翻译数据到 zh-CN.ts
 *
 * 数据来源:
 * 1. skillsqingxi/output-all/skills-index.json (1,190 个质量评估后技能)
 * 2. skills-awesome/index.json (2,999 个技能的英文元数据)
 * 3. 现有 zh-CN.ts 翻译 (保留不覆盖)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const QINGXI_INDEX = path.join(ROOT, "skillsqingxi/output-all/skills-index.json");
const AWESOME_INDEX = path.join(ROOT, "skills-awesome/index.json");
const ZH_CN_FILE = path.join(ROOT, "ui/src/ui/i18n/locales/zh-CN.ts");

// ============================================================================
// 1. 读取已有 zh-CN.ts 翻译
// ============================================================================

const zhContent = fs.readFileSync(ZH_CN_FILE, "utf-8");

const existingNames = new Map();
const existingDescs = new Map();
for (const m of zhContent.matchAll(/"skillName\.([^"]+)":\s*"([^"]+)"/g)) {
  existingNames.set(m[1], m[2]);
}
for (const m of zhContent.matchAll(/"skillDesc\.([^"]+)":\s*"([^"]+)"/g)) {
  existingDescs.set(m[1], m[2]);
}

console.log(`📖 现有 zh-CN.ts: ${existingNames.size} 名称, ${existingDescs.size} 描述`);

// ============================================================================
// 2. 读取 skillsqingxi 数据 (已有高质量中文)
// ============================================================================

const qingxiData = JSON.parse(fs.readFileSync(QINGXI_INDEX, "utf-8"));
const qingxiSkills = qingxiData.skills || [];
console.log(`📖 skillsqingxi: ${qingxiSkills.length} 个技能`);

// ============================================================================
// 3. 读取 awesome 数据 (所有技能)
// ============================================================================

const awesomeData = JSON.parse(fs.readFileSync(AWESOME_INDEX, "utf-8"));
const awesomeSkills = awesomeData.skills || [];
console.log(`📖 skills-awesome: ${awesomeSkills.length} 个技能`);

// ============================================================================
// 4. 构建完整翻译映射
// ============================================================================

function normalizeKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** 美化英文技能名：kebab-case -> Title Case */
function beautifyName(name) {
  return name
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * 从 descriptionZh 提取简短中文名称 (最多6字)
 * 策略: 取 tags[0], 或从 category 取, 或用英文美化名
 */
function extractShortName(skill) {
  // 优先用 tags[0] (已经是中文)
  if (skill.tags?.length > 0) {
    const tag = skill.tags[0];
    if (tag.length <= 8 && /[\u4e00-\u9fff]/.test(tag)) {
      return tag;
    }
  }
  // 其次用 category
  if (skill.category && /[\u4e00-\u9fff]/.test(skill.category)) {
    return skill.category.substring(0, 6);
  }
  return null; // 没有好的中文名,后续用 API 翻译
}

/**
 * 从 descriptionZh 或 description 生成简短描述 (40字以内)
 */
function extractShortDesc(skill) {
  const src = skill.descriptionZh || skill.description || "";
  if (!src) return null;
  // 截取到第一个句号/逗号后,最多60字
  let desc = src.substring(0, 80);
  // 找到合适的截断点
  const cutPoints = [
    desc.indexOf("。"),
    desc.indexOf("，", 20),
    desc.indexOf(",", 20),
    desc.indexOf(".", 20),
  ].filter(i => i > 0);

  if (cutPoints.length > 0) {
    const cut = Math.min(...cutPoints);
    if (cut > 10 && cut < 60) {
      desc = desc.substring(0, cut);
    }
  }

  if (desc.length > 50) {
    desc = desc.substring(0, 50);
  }
  return desc.replace(/[，。,.]$/, "").trim();
}

// 最终翻译映射
const finalNames = new Map(existingNames);
const finalDescs = new Map(existingDescs);

// 从 skillsqingxi 提取
let addedFromQingxi = { names: 0, descs: 0 };
for (const skill of qingxiSkills) {
  const key = normalizeKey(skill.name);
  if (!key) continue;

  // 名称
  if (!finalNames.has(key)) {
    const name = extractShortName(skill);
    if (name) {
      finalNames.set(key, name);
      addedFromQingxi.names++;
    }
  }

  // 描述
  if (!finalDescs.has(key)) {
    const desc = extractShortDesc(skill);
    if (desc) {
      finalDescs.set(key, desc);
      addedFromQingxi.descs++;
    }
  }
}

console.log(`\n📊 从 skillsqingxi 新增: ${addedFromQingxi.names} 名称, ${addedFromQingxi.descs} 描述`);

// ============================================================================
// 5. 统计未翻译的技能
// ============================================================================

let untranslatedNames = 0;
let untranslatedDescs = 0;
const untranslatedList = [];

for (const skill of awesomeSkills) {
  const key = normalizeKey(skill.name);
  if (!key) continue;
  const hasName = finalNames.has(key);
  const hasDesc = finalDescs.has(key);
  if (!hasName) untranslatedNames++;
  if (!hasDesc) untranslatedDescs++;
  if (!hasName || !hasDesc) {
    untranslatedList.push({
      key,
      name: skill.skillName || skill.name,
      desc: (skill.description || "").substring(0, 150),
      missingName: !hasName,
      missingDesc: !hasDesc,
    });
  }
}

console.log(`\n📊 合并后统计:`);
console.log(`   技能名称: ${finalNames.size} / ${awesomeSkills.length} (${(finalNames.size / awesomeSkills.length * 100).toFixed(1)}%)`);
console.log(`   技能描述: ${finalDescs.size} / ${awesomeSkills.length} (${(finalDescs.size / awesomeSkills.length * 100).toFixed(1)}%)`);
console.log(`   仍需翻译: ${untranslatedNames} 名称, ${untranslatedDescs} 描述`);

// ============================================================================
// 6. 生成 zh-CN.ts 翻译片段
// ============================================================================

const sortedNameKeys = [...finalNames.keys()].sort();
const sortedDescKeys = [...finalDescs.keys()].sort();

const nameLines = sortedNameKeys.map(key => {
  const val = finalNames.get(key).replace(/"/g, '\\"');
  return `  "skillName.${key}": "${val}",`;
});

const descLines = sortedDescKeys.map(key => {
  const val = finalDescs.get(key).replace(/"/g, '\\"');
  return `  "skillDesc.${key}": "${val}",`;
});

const translationBlock = `  // ============================================================================
  // 技能名称中文翻译 — 批量合并 (${new Date().toISOString().split("T")[0]})
  // 共 ${nameLines.length} 个名称翻译
  // ============================================================================
${nameLines.join("\n")}

  // ============================================================================
  // 技能描述中文翻译 — 批量合并
  // 共 ${descLines.length} 个描述翻译
  // ============================================================================
${descLines.join("\n")}`;

// ============================================================================
// 7. 注入到 zh-CN.ts
// ============================================================================

// 找到现有的技能翻译区块，替换掉
// 定位: 从 "// 技能名称中文翻译" 到文件结尾的 } 之前

const sectionStart = zhContent.indexOf('  // ============================================================================\n  // 技能名称中文翻译');
if (sectionStart === -1) {
  console.error("❌ 找不到 zh-CN.ts 中的技能翻译区块标记！");
  // 输出片段文件让用户手动插入
  const snippetFile = path.join(ROOT, "scripts/skill-translations-merged.ts.txt");
  fs.writeFileSync(snippetFile, translationBlock);
  console.log(`📝 翻译片段已保存: ${snippetFile}`);
  process.exit(1);
}

// 找到最后一个 } (即 export default 对象的结束)
const lastBrace = zhContent.lastIndexOf("}");
if (lastBrace === -1) {
  console.error("❌ 找不到 zh-CN.ts 文件末尾的 }");
  process.exit(1);
}

// 在最后一个 } 之前可能有 "} as const" 或 "} satisfies"
// 查找实际的结束区域
let endSearchArea = zhContent.substring(sectionStart);
// 找到这个区域中最后一个翻译条目后的位置
// 我们需要找到从 sectionStart 开始，一直到文件末尾的 } 之前的内容
// 然后用新的翻译块替换

const beforeSection = zhContent.substring(0, sectionStart);
const afterSection = zhContent.substring(lastBrace); // } 及之后的内容

const newContent = beforeSection + translationBlock + "\n" + afterSection;

fs.writeFileSync(ZH_CN_FILE, newContent);
console.log(`\n✅ zh-CN.ts 已更新!`);
console.log(`   名称: ${nameLines.length} 条`);
console.log(`   描述: ${descLines.length} 条`);

// 输出未翻译列表供后续 API 翻译
if (untranslatedList.length > 0) {
  const untranslatedFile = path.join(ROOT, "scripts/skills-untranslated.json");
  fs.writeFileSync(untranslatedFile, JSON.stringify(untranslatedList, null, 2));
  console.log(`\n📋 未翻译技能列表: ${untranslatedFile} (${untranslatedList.length} 个)`);
  console.log(`   后续使用 batch-translate-skills.mjs + Qwen API 翻译这些技能`);
}
