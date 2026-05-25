#!/usr/bin/env node
/**
 * 生产构建后处理脚本
 *
 * 将 dist 目录中所有 JS 文件的 __DEV_BUILD__ 替换为 false
 * 这样生产版本就无法通过环境变量绕过开发构建判断
 *
 * 用法：
 *   node --import tsx scripts/replace-dev-flag.ts
 *   或
 *   pnpm build:prod
 */

import fs from "node:fs";
import path from "node:path";

const DIST_DIR = path.resolve(process.cwd(), "dist");
const DEV_FLAG_PATTERN = /__DEV_BUILD__/g;
const REPLACEMENT = "false";

/**
 * 递归获取目录下所有 JS 文件
 */
function getAllJsFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    console.error(`目录不存在: ${dir}`);
    process.exit(1);
  }

  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getAllJsFiles(fullPath));
    } else if (item.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * 替换文件中的 __DEV_BUILD__
 */
function replaceInFile(filePath: string): boolean {
  const content = fs.readFileSync(filePath, "utf8");

  if (!DEV_FLAG_PATTERN.test(content)) {
    return false;
  }

  // 重置 lastIndex（正则表达式带 g 标志时需要）
  DEV_FLAG_PATTERN.lastIndex = 0;

  const newContent = content.replace(DEV_FLAG_PATTERN, REPLACEMENT);
  fs.writeFileSync(filePath, newContent, "utf8");
  return true;
}

/**
 * 主函数
 */
function main(): void {
  console.log("🔒 开始生产构建后处理...");
  console.log(`   目标目录: ${DIST_DIR}`);

  const jsFiles = getAllJsFiles(DIST_DIR);
  console.log(`   找到 ${jsFiles.length} 个 JS 文件`);

  let replacedCount = 0;
  for (const file of jsFiles) {
    if (replaceInFile(file)) {
      const relativePath = path.relative(DIST_DIR, file);
      console.log(`   ✓ 替换: ${relativePath}`);
      replacedCount++;
    }
  }

  if (replacedCount === 0) {
    console.log("   ⚠️ 未找到需要替换的 __DEV_BUILD__ 标记");
  } else {
    console.log(`\n✅ 完成！共替换 ${replacedCount} 个文件`);
    console.log("   DEV 模式绕过已禁用，生产构建安全");
  }
}

main();
