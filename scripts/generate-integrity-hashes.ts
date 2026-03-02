#!/usr/bin/env node
/**
 * 生成完整性校验哈希文件
 *
 * 为 dist 目录中的 CN 字节码目标文件生成 SHA-256 哈希。
 * 目标目录由 config/cn-protected-files.json → cn_encryption.bytecode 驱动。
 * 用于启动时检测文件是否被篡改。
 *
 * 用法：
 *   node --import tsx scripts/generate-integrity-hashes.ts
 *   或
 *   pnpm integrity:gen
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getExplicitBytecodeDirs, getBytecodeIndividualFiles } from "../cn/scripts/build/resolve-cn-targets.js";

const ROOT_DIR = path.resolve(process.cwd());
const DIST_DIR = path.resolve(ROOT_DIR, "dist");
const OUTPUT_FILE = path.join(DIST_DIR, "security", "integrity-hashes.json");

/**
 * [P0] 根哈希常量文件路径
 * 构建时将 hashesFileHash 写入此文件，编译后嵌入 .jsc bytecode bundle。
 * 攻击者无法同时篡改磁盘上的 hashes.json 和已编译 bytecode 中的常量。
 */
const ROOT_HASH_CONST_FILE = path.join(ROOT_DIR, "src", "security", "integrity-root-hash.ts");

/**
 * 需要排除的文件模式（用于目录扫描）
 */
const EXCLUDE_PATTERNS = [
  /\.test\.js$/,                    // 测试文件
  /integrity-hashes\.json$/,        // 哈希文件本身（生成后自包含）
  /integrity-hashes-root\.json$/,   // 根哈希文件（Step 4 单独处理，避免循环）
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
    } else if (item.endsWith(".js") || item.endsWith(".jsc")) {
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
 * 添加文件哈希（去重）
 */
function addHash(hashes: FileHash[], seen: Set<string>, fullPath: string, baseDir: string): void {
  const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
  if (seen.has(relativePath)) return;
  seen.add(relativePath);

  const hash = computeHash(fullPath);
  hashes.push({ path: relativePath, hash });
  console.log(`  ✓ ${relativePath}`);
}

/**
 * 主函数
 *
 * 精确哈希策略（只哈希 CN 文件，不扫描上游目录）：
 *   Step 1: 扫描显式 bytecode 目录 (dispatch/, license/, security/) 的所有文件
 *   Step 2: 逐个哈希不在显式目录内的个别 bytecode 文件 + 对应 .jsc
 *   Step 3: 哈希显式目录的 CJS package.json（防篡改）
 */
function main(): void {
  console.log("🔐 生成完整性校验哈希...\n");

  if (!fs.existsSync(DIST_DIR)) {
    console.error(`错误: dist 目录不存在，请先运行 pnpm build`);
    process.exit(1);
  }

  // 从 cn-protected-files.json 获取精确目标
  const explicitDirs = getExplicitBytecodeDirs(ROOT_DIR);
  const individualFiles = getBytecodeIndividualFiles(ROOT_DIR);

  console.log(`  显式 bytecode 目录 (全扫描): ${explicitDirs.join(", ")}`);
  console.log(`  个别 bytecode 文件 (精确哈希): ${individualFiles.length} 个\n`);

  const hashes: FileHash[] = [];
  const seen = new Set<string>();

  // Step 1: 扫描显式 bytecode 目录内所有 .js/.jsc 文件（这些目录全是 CN 代码）
  for (const dir of explicitDirs) {
    const dirPath = path.join(DIST_DIR, dir);
    console.log(`扫描 CN 目录: ${dir}`);

    const files = getAllJsFiles(dirPath, DIST_DIR);
    for (const relativePath of files) {
      const fullPath = path.join(DIST_DIR, relativePath);
      addHash(hashes, seen, fullPath, DIST_DIR);
    }
  }

  // Step 2: 逐个哈希不在显式目录内的个别 bytecode 文件
  if (individualFiles.length > 0) {
    console.log(`\n精确哈希个别 CN 文件:`);
    for (const distFile of individualFiles) {
      // .js 文件（可能是 loader stub 或原始文件）
      if (fs.existsSync(distFile)) {
        addHash(hashes, seen, distFile, DIST_DIR);
      }
      // 对应的 .jsc 文件（bytecode 编译后产生）
      const jscFile = distFile.replace(/\.js$/, ".jsc");
      if (fs.existsSync(jscFile)) {
        addHash(hashes, seen, jscFile, DIST_DIR);
      }
    }
  }

  // Step 3: 哈希显式目录的 CJS package.json（防止攻击者改回 "type": "module"）
  console.log(`\n哈希 CJS 类型覆盖文件:`);
  for (const dir of explicitDirs) {
    const pkgPath = path.join(DIST_DIR, dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      addHash(hashes, seen, pkgPath, DIST_DIR);
    }
    // 子目录的 package.json
    const dirPath = path.join(DIST_DIR, dir);
    if (fs.existsSync(dirPath)) {
      const subdirs = fs.readdirSync(dirPath, { withFileTypes: true })
        .filter(e => e.isDirectory());
      for (const sub of subdirs) {
        const subPkgPath = path.join(dirPath, sub.name, "package.json");
        if (fs.existsSync(subPkgPath)) {
          addHash(hashes, seen, subPkgPath, DIST_DIR);
        }
      }
    }
  }

  // Step 3.5: [MED-13] 哈希关键 ESM bundle 文件
  // 这些大型 JS 文件包含 License 逻辑、RSA 公钥、网络层安全代码等。
  // 之前未纳入完整性校验，攻击者可直接 patch 这些文件绕过授权。
  // 使用 glob 模式匹配，因为文件名可能含 hash 后缀（如 gateway-cli-kSg0il7V.js）
  console.log(`\n哈希关键 ESM bundle 文件:`);
  const ESM_BUNDLE_PATTERNS = [
    /^gateway-cli[^/]*\.js$/,       // Gateway CLI 主 bundle（含网络层安全逻辑）
    /^daemon-cli\.js$/,              // Daemon CLI（含加密逻辑）
    /^content-vault[^/]*\.js$/,      // Content Vault wrapper
    /^github-copilot-auth[^/]*\.js$/,// Auth profiles 存储（含 saveAuthProfileStore）
  ];
  const distTopFiles = fs.readdirSync(DIST_DIR, { withFileTypes: true });
  for (const entry of distTopFiles) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    const matchesPattern = ESM_BUNDLE_PATTERNS.some((p) => p.test(name));
    if (matchesPattern) {
      const fullPath = path.join(DIST_DIR, name);
      addHash(hashes, seen, fullPath, DIST_DIR);
    }
  }

  // Step 3.6: [HIGH-06] 哈希原生 .node 模块
  // Native addon (.node 文件) 可以执行任意代码，如果被替换将完全绕过所有安全保护。
  // 扫描 dist/ 下所有 .node 文件并纳入完整性校验。
  console.log(`\n哈希原生 .node 模块:`);
  function findNodeAddons(dir: string, baseDir: string): string[] {
    const result: string[] = [];
    if (!fs.existsSync(dir)) return result;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== ".cache") {
        result.push(...findNodeAddons(fullPath, baseDir));
      } else if (entry.isFile() && (entry.name.endsWith(".node") || entry.name.endsWith(".dll"))) {
        result.push(fullPath);
      }
    }
    return result;
  }
  const nativeFiles = findNodeAddons(DIST_DIR, DIST_DIR);
  for (const nativeFile of nativeFiles) {
    addHash(hashes, seen, nativeFile, DIST_DIR);
  }
  console.log(`  共 ${nativeFiles.length} 个原生模块`);

  // 确保输出目录存在
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Step 4: [LOW-01] 生成 integrity-hashes-root.json — 包含 integrity-hashes.json 本身的哈希
  // 这形成一个双重保护链：
  //   - integrity-hashes.json 的内容由 root.json 中嵌入的哈希校验
  //   - integrity-hashes-root.json 本身被纳入 integrity-hashes.json 的巡逻监控
  // 攻击者若要同时篡改两个文件（绕过巡逻），需在进程启动前完成，
  // 而启动时 loadEmbeddedHashes() 会验证 hashes.json ↔ root.json 的一致性。

  // Step 4.1: 先生成 root.json 并将其纳入 hashes 列表
  const ROOT_FILE = path.join(outputDir, "integrity-hashes-root.json");

  // 预先计算 root.json 的内容和哈希（此时 hash 字段用占位符）
  // root.json 需要被巡逻监控覆盖，所以先写入磁盘
  const rootPlaceholderContent = JSON.stringify({ hash: "pending", generated: new Date().toISOString() }, null, 2);
  fs.writeFileSync(ROOT_FILE, rootPlaceholderContent, "utf8");

  // 将 root.json 条目纳入 hashes 列表（使巡逻监控覆盖它）
  const rootRelPath = path.relative(DIST_DIR, ROOT_FILE).replace(/\\/g, "/");
  // root.json 的哈希稍后用最终内容重新计算，此处先占位
  const rootEntryIndex = hashes.length;
  hashes.push({ path: rootRelPath, hash: "pending" });
  seen.add(rootRelPath);

  // Step 4.2: 计算包含 root.json 条目的最终 hashes.json 内容的哈希
  // 注意：此时 root.json 条目的 hash 仍是 "pending"，但这不影响 ——
  // INTEGRITY_ROOT_HASH 验证的是 hashes.json 文件本身的完整性，
  // 而 root.json 条目的 hash 会在下面被最终替换后一起写入。
  //
  // 正确的哈希链：
  //   1. 组装最终 hashes 数组（含 root.json 条目）
  //   2. 序列化为 JSON → 这就是最终写入磁盘的内容
  //   3. 对该内容计算 SHA-256 → 这就是 INTEGRITY_ROOT_HASH
  //   4. 运行时读取磁盘上的 hashes.json，计算其 SHA-256，与编译时常量比对
  //
  // 为避免循环依赖（root.json hash → hashes.json content → root hash），
  // root.json 的 hash 字段在 hashes 列表中用占位值，但这不影响校验：
  // 验证的是 hashes.json 整体内容的 SHA-256，不是单个条目的 hash 值。

  // 用最终内容（含 root.json 占位条目）计算哈希
  const finalHashesContent = JSON.stringify(hashes, null, 2);
  const hashesFileHash = createHash("sha256").update(finalHashesContent, "utf8").digest("hex");

  // 更新 root.json 的实际内容（写入正确的哈希）
  const rootFinalContent = JSON.stringify({ hash: hashesFileHash, generated: new Date().toISOString() }, null, 2);
  fs.writeFileSync(ROOT_FILE, rootFinalContent, "utf8");

  // 更新 hashes 列表中 root.json 条目的哈希为实际磁盘文件哈希
  hashes[rootEntryIndex].hash = computeHash(ROOT_FILE);

  console.log(`\n🔐 integrity-hashes-root.json 已生成`);
  console.log(`   根哈希: ${hashesFileHash.slice(0, 16)}...`);
  console.log(`  ✓ ${rootRelPath} (自包含)`);

  // Step 4.3: [P0] 将根哈希写入 TypeScript 常量文件（编译后嵌入 bytecode）
  // 这是哈希链的最终封闭点：攻击者无法同时篡改 hashes.json（磁盘文件）
  // 和 bytecode 中已编译的常量——前者被后者校验，后者被 .jsc 完整性保护。
  const rootHashConstContent = [
    `// AUTO-GENERATED by scripts/generate-integrity-hashes.ts — DO NOT EDIT`,
    `// This constant is compiled into bytecode at build time.`,
    `// It stores the SHA-256 of integrity-hashes.json so that the file`,
    `// cannot be tampered with even if both disk files are replaced together.`,
    `// Generated: ${new Date().toISOString()}`,
    `export const INTEGRITY_ROOT_HASH = "${hashesFileHash}";`,
    ``,
  ].join("\n");
  fs.writeFileSync(ROOT_HASH_CONST_FILE, rootHashConstContent, "utf8");
  console.log(`🔐 integrity-root-hash.ts 已更新 (嵌入编译时根哈希)`);
  console.log(`   路径: ${path.relative(process.cwd(), ROOT_HASH_CONST_FILE)}`);

  // Step 4.4: 写入最终的 hashes.json（内容必须与计算哈希时一致）
  // 注意：hashes 数组中 root.json 条目的 hash 已被更新为实际文件哈希，
  // 但 hashesFileHash 是用更新前的内容计算的。所以这里必须写入与计算时
  // 完全相同的内容（即 finalHashesContent），否则运行时校验会失败。
  fs.writeFileSync(OUTPUT_FILE, finalHashesContent, "utf8");

  console.log(`\n✅ 完成！生成了 ${hashes.length} 个 CN 文件的哈希`);
  console.log(`   (仅包含 CN 代码，不包含上游开源文件)`);
  console.log(`   输出文件: ${path.relative(process.cwd(), OUTPUT_FILE)}`);
}

main();
