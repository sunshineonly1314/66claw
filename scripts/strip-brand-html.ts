/**
 * 外销去标：构建后处理 dist 中的 HTML 和 JS 文件
 * 仅抹除 tecbinai / obplugins.cn 等公司自有品牌信息。
 *
 * 【不动】ClawbotCN / ClawdbotCN / Clawdbot / OpenClawCN —— 开源产品名，保留。
 * 【抹除】tecbinai / TecbinAI / obplugins.cn / 相关推广文字 / 购买链接文字。
 *
 * 仅在 VITE_EDITION=overseas 时执行实际替换，否则跳过。
 *
 * 多阶段处理：
 *   1. HTML 文件：dist/control-ui/*.html 中的品牌文本
 *   2. UI JS bundle：dist/control-ui/assets/*.js 中编译后的 i18n locale 品牌字符串
 *   3. Server JS bundle：dist/*.js 中服务端模板的品牌字符串（setup 页面、法律条文等）
 *   4. Desktop HTML：apps/desktop/src-tauri/src/*.html 中的品牌 URL
 *   5. Skills 文件：skills/ 和 apps/desktop/src-tauri/resources/skills/ 中的品牌引用
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

/**
 * HTML 品牌替换规则
 * 只去掉 tecbinai / obplugins.cn 相关内容。
 * ClawbotCN / ClawdbotCN / Clawdbot / OpenClawCN 全部保留。
 */
const htmlReplacements: [RegExp, string][] = [
  // 带链接的 "由 tecbinai 提供技术支持" 整句
  [/由\s*<a[^>]*>tecbinai<\/a>\s*提供技术支持\s*·?\s*/g, ""],
  // 纯文字版
  [/由\s*tecbinai\s*提供技术支持/gi, ""],
  [/Powered by tecbinai/gi, ""],
  // 域名（完整 URL 先，避免截断）
  [/https?:\/\/www\.obplugins\.cn/g, ""],
  [/https?:\/\/www\.tecbinai\.com/g, ""],
  [/https?:\/\/gitee\.com\/tecbinai\/skills/g, ""],
  [/obplugins\.cn/g, ""],
  [/tecbinai\.com/g, ""],
  // 品牌名（大小写变体）
  [/TecbinAI/g, ""],
  [/tecbinAI/g, ""],
  [/tecbinai/gi, ""],
  // 购买/闲鱼链接（HTML 版）
  [/https?:\/\/m\.tb\.cn\/[^\s"'`>]*/g, ""],
  [/在闲鱼搜索[^<]*/g, ""],
];

/**
 * JS bundle 中 i18n 品牌字符串替换规则（保守，避免破坏代码逻辑）
 * 同样只去 tecbinai / obplugins.cn，不动 Clawdbot 系列产品名。
 */
const jsReplacements: [RegExp, string][] = [
  // 带链接的 "由 tecbinai 提供技术支持" 整句（编译后可能有转义）
  [/由\s*tecbinai\s*提供技术支持/gi, ""],
  [/Powered by tecbinai/gi, ""],
  // URL（完整 URL 先匹配）
  [/https?:\/\/www\.obplugins\.cn/g, ""],
  [/https?:\/\/www\.tecbinai\.com/g, ""],
  [/https?:\/\/gitee\.com\/tecbinai\/skills/g, ""],
  [/gitee\.com\/tecbinai\/skills/g, ""],
  [/obplugins\.cn/g, ""],
  [/tecbinai\.com/g, ""],
  // 品牌名（大小写变体）
  [/TecbinAI/g, ""],
  [/tecbinAI/g, ""],
  [/tecbinai/gi, ""],
  // i18n key 值：推广描述文字（编译进 bundle 的字符串）
  [/及时追踪AI[·\s]*解锁更多玩法/g, ""],
  [/及时追踪 AI 最新内容/g, ""],
  [/Track AI Latest Content/g, ""],
  [/Visit tecbinai/gi, ""],
  [/访问 tecbinai/g, ""],
  // 购买/闲鱼链接（兜底，防止条件分支未覆盖的情况）
  [/https?:\/\/m\.tb\.cn\/[^\s"'`]*/g, ""],
  [/在闲鱼搜索[^"'`<]*/g, ""],
  [/闲鱼自动发货[^"'`<]*/g, ""],
  [/去闲鱼购买正式版/g, ""],
  [/Purchase on Xianyu/gi, ""],
  [/Auto-delivery via Xianyu[^"'`<]*/gi, ""],
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

// 阶段 3：处理服务端 JS bundle（setup 页面模板、法律条文等）
console.log("   Phase 3: Server JS bundles (setup page, legal text)");
const distDir = path.join(rootDir, "dist");
if (fs.existsSync(distDir)) {
  const serverJsFiles = fs.readdirSync(distDir).filter((f) => f.endsWith(".js"));
  for (const jsFile of serverJsFiles) {
    totalCount += processFile(path.join(distDir, jsFile), jsReplacements);
  }
}

// 阶段 4：处理桌面应用 HTML（repair_assistant.html 等）
console.log("   Phase 4: Desktop HTML files");
const desktopSrcDir = path.join(rootDir, "apps", "desktop", "src-tauri", "src");
if (fs.existsSync(desktopSrcDir)) {
  const htmlFiles = fs.readdirSync(desktopSrcDir).filter((f) => f.endsWith(".html"));
  for (const htmlFile of htmlFiles) {
    totalCount += processFile(path.join(desktopSrcDir, htmlFile), htmlReplacements);
  }
}

// 阶段 5：处理 Skills 文件（README.md, SKILL.md 中的品牌引用）
console.log("   Phase 5: Skills files");
const skillsDirs = [
  path.join(rootDir, "skills"),
  path.join(rootDir, "apps", "desktop", "src-tauri", "resources", "skills"),
];
for (const skillsDir of skillsDirs) {
  if (!fs.existsSync(skillsDir)) continue;
  for (const skillFolder of fs.readdirSync(skillsDir)) {
    const skillPath = path.join(skillsDir, skillFolder);
    if (!fs.statSync(skillPath).isDirectory()) continue;
    for (const file of fs.readdirSync(skillPath)) {
      if (file.endsWith(".md") || file.endsWith(".json")) {
        totalCount += processFile(path.join(skillPath, file), htmlReplacements);
      }
    }
  }
}

console.log(`\n   Total: ${totalCount} brand references stripped`);
console.log("[strip-brand] done.\n");
