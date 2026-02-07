#!/usr/bin/env node
/**
 * 生成完整性校验哈希文件
 *
 * 为 dist 目录中的关键文件生成 SHA-256 哈希
 * 用于启动时检测文件是否被篡改
 *
 * 用法：
 *   node --import tsx scripts/generate-integrity-hashes.ts
 *   或
 *   pnpm integrity:gen
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DIST_DIR = path.resolve(process.cwd(), "dist");
const OUTPUT_FILE = path.join(DIST_DIR, "security", "integrity-hashes.json");

/**
 * 需要校验的关键目录
 */
const CRITICAL_DIRS = [
  "license",   // 许可证验证
  "security",  // 安全模块
];

/**
 * 需要排除的文件模式
 */
const EXCLUDE_PATTERNS = [
  /\.test\.js$/,           // 测试文件
  /integrity-hashes\.json$/, // 哈希文件本身
];

interface FileHash {
  path: string;
  hash: string;
}

/**
 * 递归获取目录下所有 JS 文件
 */
function getAllJsFiles(dir: string, baseDir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getAllJsFiles(fullPath, baseDir));
    } else if (item.endsWith(".js")) {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");

      // 检查是否需要排除
      const shouldExclude = EXCLUDE_PATTERNS.some((pattern) => pattern.test(relativePath));
      if (!shouldExclude) {
        files.push(relativePath);
      }
    }
  }

  return files;
}

/**
 * 计算文件哈希
 */
function computeHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

/**
 * 主函数
 */
function main(): void {
  console.log("🔐 生成完整性校验哈希...\n");

  if (!fs.existsSync(DIST_DIR)) {
    console.error(`错误: dist 目录不存在，请先运行 pnpm build`);
    process.exit(1);
  }

  const hashes: FileHash[] = [];

  for (const dir of CRITICAL_DIRS) {
    const dirPath = path.join(DIST_DIR, dir);
    console.log(`扫描目录: ${dir}/`);

    const files = getAllJsFiles(dirPath, DIST_DIR);

    for (const relativePath of files) {
      const fullPath = path.join(DIST_DIR, relativePath);
      const hash = computeHash(fullPath);

      hashes.push({ path: relativePath, hash });
      console.log(`  ✓ ${relativePath}`);
    }
  }

  // 确保输出目录存在
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 写入哈希文件
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(hashes, null, 2), "utf8");

  console.log(`\n✅ 完成！生成了 ${hashes.length} 个文件的哈希`);
  console.log(`   输出文件: ${path.relative(process.cwd(), OUTPUT_FILE)}`);
}

main();
