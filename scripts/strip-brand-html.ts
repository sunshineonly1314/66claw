/**
 * 外销去标：构建后处理 dist 中的 HTML 和 JS 文件
 * 将 ClawbotCN / tecbinai 品牌内容替换为通用名称
 *
 * 仅在 VITE_EDITION=overseas 时执行实际替换，否则跳过。
 *
 * 两阶段处理：
 *   1. HTML 文件：dist/control-ui/*.html 中的品牌文本
 *   2. JS bundle：dist/control-ui/assets/*.js 中编译后的 i18n locale 品牌字符串
 *
 * 用法: node --import tsx scripts/strip-brand-html.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const edition = process.env.VITE_EDITION ?? "cn";
if (edition !== "overseas") {
  console.log("[strip-brand] edition=%s, skipping.", edition);
  process.exit(0);
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distUiDir = path.join(rootDir, "dist", "control-ui");

/** HTML 品牌替换规则 */
const htmlReplacements: [RegExp, string][] = [
  [/ClawbotCN/g, "AI Assistant"],
  [/ClawdbotCN/g, "AI Assistant"],
  [/Clawdbot/g, "AI Assistant"],
  [/tecbinai\.com/g, ""],
  [/tecbinai/gi, ""],
  [/TecbinAI/g, ""],
  [/obplugins\.cn/g, ""],
  [/由\s*<a[^>]*>tecbinai<\/a>\s*提供技术支持\s*·?\s*/g, ""],
  [/由\s*tecbinai\s*提供技术支持/g, ""],
  [/Powered by tecbinai/gi, ""],
];

/** JS bundle 中 i18n 品牌字符串替换规则（更保守，避免破坏代码） */
const jsReplacements: [RegExp, string][] = [
  // 产品名（出现在用户可见的 i18n 字符串值中）
  [/ClawdbotCN/g, "AI Assistant"],
  [/ClawbotCN/g, "AI Assistant"],
  [/Clawdbot/g, "AI Assistant"],
  // 激活码前缀提示
  [/claw-xxx-xxx/g, "XXXX-XXXX-XXXX"],
  [/claw-xxxx/g, "XXXX-XXXX"],
  // URL 引用
  [/https:\/\/www\.obplugins\.cn/g, ""],
  // 品牌方名
  [/TecbinAI/g, ""],
  [/tecbinai/gi, ""],
  // localStorage key 前缀（运行时可见）
  [/clawdbot\./g, "app."],
  // Window 全局变量
  [/__CLAWDBOT_/g, "__APP_"],
  // CustomEvent 前缀
  [/openclawcn:/g, "app:"],
];

function processFile(filePath: string, rules: [RegExp, string][]): number {
  if (!fs.existsSync(filePath)) return 0;
  let content = fs.readFileSync(filePath, "utf8");
  let count = 0;
  for (const [pattern, replacement] of rules) {
    const matches = content.match(pattern);
    if (matches) count += matches.length;
    content = content.replace(pattern, replacement);
  }
  if (count > 0) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log("[strip-brand] %d replacements: %s", count, path.relative(rootDir, filePath));
  }
  return count;
}

let totalCount = 0;

// 阶段 1：处理 HTML 文件
console.log("\n🏷️  OEM Brand Stripping (VITE_EDITION=overseas)\n");
console.log("   Phase 1: HTML files");
const htmlTargets = [
  path.join(distUiDir, "index.html"),
  path.join(distUiDir, "install-guide.html"),
];
for (const target of htmlTargets) {
  totalCount += processFile(target, htmlReplacements);
}

// 阶段 2：处理 JS bundle（Vite 构建输出的 i18n 字符串）
console.log("   Phase 2: JS bundles (i18n strings)");
const assetsDir = path.join(distUiDir, "assets");
if (fs.existsSync(assetsDir)) {
  const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
  for (const jsFile of jsFiles) {
    totalCount += processFile(path.join(assetsDir, jsFile), jsReplacements);
  }
}

console.log(`\n   Total: ${totalCount} brand references stripped`);
console.log("[strip-brand] done.\n");
