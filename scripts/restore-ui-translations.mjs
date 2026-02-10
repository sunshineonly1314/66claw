/**
 * 恢复 auto-synced UI 翻译到 zh-CN.ts
 * 在批量翻译脚本覆盖后运行此脚本
 */
import fs from "node:fs";

const ZH_FILE = "ui/src/ui/i18n/locales/zh-CN.ts";
const BACKUP = "scripts/ui-translations-zh-backup.txt";

const zhContent = fs.readFileSync(ZH_FILE, "utf-8");
const backup = fs.readFileSync(BACKUP, "utf-8");

// 检查是否已有 auto-synced 区域
if (zhContent.includes("// Auto-synced from en.ts")) {
  console.log("✅ auto-synced 区域已存在，无需恢复");
  process.exit(0);
}

// 在 } as const; 之前插入
const insertPos = zhContent.lastIndexOf("} as const;");
if (insertPos === -1) {
  console.error("❌ 找不到 } as const;");
  process.exit(1);
}

const newContent = zhContent.substring(0, insertPos) + backup + "\n" + zhContent.substring(insertPos);
fs.writeFileSync(ZH_FILE, newContent);

console.log(`✅ 已恢复 auto-synced UI 翻译 (${backup.split("\n").length} 行)`);
