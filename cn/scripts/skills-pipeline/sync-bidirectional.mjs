/**
 * 双向同步 en.ts 和 zh-CN.ts 的键集
 */
import fs from "node:fs";

const EN_FILE = "ui/src/ui/i18n/locales/en.ts";
const ZH_FILE = "ui/src/ui/i18n/locales/zh-CN.ts";

const enContent = fs.readFileSync(EN_FILE, "utf-8");
const zhContent = fs.readFileSync(ZH_FILE, "utf-8");

// 提取所有键 (支持值中包含转义引号 \")
const kvRegex = /"([^"]+)":\s*"((?:[^"\\]|\\.)*)"/g;

const enKeys = new Map();
for (const m of enContent.matchAll(kvRegex)) enKeys.set(m[1], m[2]);

const zhKeys = new Map();
for (const m of zhContent.matchAll(kvRegex)) zhKeys.set(m[1], m[2]);

// 找 en 有但 zh 没有的
const enOnly = [...enKeys.keys()].filter(k => !zhKeys.has(k)).sort();
console.log(`en 有但 zh 没有: ${enOnly.length} 个`);
if (enOnly.length > 0) {
  console.log("  前10:", enOnly.slice(0, 10).join(", "));
}

// 生成缺失的 zh 条目 (直接用 en 的值作为占位)
if (enOnly.length > 0) {
  const newLines = enOnly.map(k => `  "${k}": "${enKeys.get(k)}",`);
  const insertBlock = "\n  // Auto-synced from en.ts\n" + newLines.join("\n");

  const zhInsertPos = zhContent.lastIndexOf("} as const;");
  const newZhContent = zhContent.substring(0, zhInsertPos) + insertBlock + "\n" + zhContent.substring(zhInsertPos);
  fs.writeFileSync(ZH_FILE, newZhContent);
  console.log(`  已添加 ${enOnly.length} 个键到 zh-CN.ts`);
}

// 同样检查 zh 有但 en 没有的 (应该已经同步了)
const zhOnly = [...zhKeys.keys()].filter(k => !enKeys.has(k));
console.log(`zh 有但 en 没有: ${zhOnly.length} 个`);
if (zhOnly.length > 0) {
  console.log("  前5:", zhOnly.slice(0, 5).join(", "));
}
