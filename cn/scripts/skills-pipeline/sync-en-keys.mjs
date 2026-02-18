/**
 * 同步 zh-CN.ts 的 skillName/skillDesc 键到 en.ts
 * 确保两个 locale 文件键集一致，避免 TypeScript 类型错误
 */
import fs from "node:fs";

const EN_FILE = "ui/src/ui/i18n/locales/en.ts";
const ZH_FILE = "ui/src/ui/i18n/locales/zh-CN.ts";

const enContent = fs.readFileSync(EN_FILE, "utf-8");
const zhContent = fs.readFileSync(ZH_FILE, "utf-8");

// 提取 zh-CN 中所有 skillName/skillDesc 键
const zhNameKeys = new Set();
const zhDescKeys = new Set();
for (const m of zhContent.matchAll(/"(skillName\.[^"]+)"/g)) zhNameKeys.add(m[1]);
for (const m of zhContent.matchAll(/"(skillDesc\.[^"]+)"/g)) zhDescKeys.add(m[1]);

// 提取 en 中已有的键
const enKeys = new Set();
for (const m of enContent.matchAll(/"(skill(?:Name|Desc)\.[^"]+)"/g)) enKeys.add(m[1]);

// 找出 zh 有但 en 没有的键
const missingNames = [...zhNameKeys].filter(k => !enKeys.has(k)).sort();
const missingDescs = [...zhDescKeys].filter(k => !enKeys.has(k)).sort();

console.log(`en.ts 已有: ${enKeys.size} 个 skill 键`);
console.log(`zh-CN 多出: ${missingNames.length} 名称, ${missingDescs.length} 描述`);

if (missingNames.length === 0 && missingDescs.length === 0) {
  console.log("已同步!");
  process.exit(0);
}

// 为每个缺失键生成英文值
function beautifyKey(key) {
  // "skillName.spotify-player" -> "Spotify Player"
  const name = key.replace(/^skill(?:Name|Desc)\./, "");
  return name.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// 生成要插入的行
const newNameLines = missingNames.map(k => `  "${k}": "${beautifyKey(k)}",`);
const newDescLines = missingDescs.map(k => `  "${k}": "",`);

const insertBlock = [
  "  // Skill translations (auto-synced from zh-CN)",
  ...newNameLines,
  ...newDescLines,
].join("\n");

// 在 en.ts 的 `} as const;` 之前插入
const insertPos = enContent.lastIndexOf("} as const;");
if (insertPos === -1) {
  console.error("找不到 en.ts 中的 } as const;");
  process.exit(1);
}

const newEnContent = enContent.substring(0, insertPos) + insertBlock + "\n" + enContent.substring(insertPos);
fs.writeFileSync(EN_FILE, newEnContent);

console.log(`\n已插入 ${missingNames.length + missingDescs.length} 个键到 en.ts`);
