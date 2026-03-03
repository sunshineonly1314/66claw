/**
 * 外销去标：构建后处理 dist 中的 HTML 和 JS 文件
 * 将 ClawbotCN / tecbinai 品牌内容替换为通用名称
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

/** HTML 品牌替换规则 */
const htmlReplacements: [RegExp, string][] = [
  [/OpenClawCN/g, "AI Assistant"],
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
  // CustomEvent 前缀
  [/openclawcn:/g, "app:"],
  // 产品名（出现在用户可见的 i18n / HTML 字符串值中）
  // 注意：不替换 OpenClawCN/openclawcn——它们在服务端代码中也用作函数名/变量名，
  // 全局替换会破坏代码。服务端品牌文本由 src/config/edition.ts 条件渲染处理。
  [/ClawdbotCN/g, "AI Assistant"],
  [/ClawbotCN/g, "AI Assistant"],
  [/Clawdbot/g, "AI Assistant"],
  // 激活码前缀提示
  [/claw-xxx-xxx/g, "XXXX-XXXX-XXXX"],
  [/claw-xxxx/g, "XXXX-XXXX"],
  // URL 引用（完整 URL 先匹配，避免被域名通用规则截断）
  [/https:\/\/gitee\.com\/tecbinai\/skills/g, ""],
  [/gitee\.com\/tecbinai\/skills/g, ""],
  [/https:\/\/www\.obplugins\.cn/g, ""],
  [/https:\/\/www\.tecbinai\.com/g, ""],
  // 品牌方名
  [/TecbinAI/g, ""],
  [/tecbinAI/g, ""],
  [/tecbinai/gi, ""],
  // localStorage key 前缀（运行时可见）
  [/clawdbot\./g, "app."],
  // Window 全局变量
  [/__CLAWDBOT_/g, "__APP_"],
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
