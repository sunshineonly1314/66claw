#!/usr/bin/env node
/**
 * Delta Package Generator
 *
 * 生成两个版本之间的增量包,用于自动更新系统
 *
 * Usage:
 *   node scripts/generate-delta-package.js \
 *     --from releases/2026.2.15/dist \
 *     --to dist \
 *     --output delta-from-2026.2.15
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseArgs } from "node:util";

interface DeltaManifest {
  fromVersion: string;
  toVersion: string;
  generatedAt: string;
  added: Array<{ path: string; sha256: string; size: number }>;
  modified: Array<{ path: string; sha256: string; size: number }>;
  removed: string[];
  totalSize: number;
  totalFiles: number;
}

interface FileEntry {
  path: string;
  sha256: string;
  size: number;
}

async function main() {
  const { values } = parseArgs({
    options: {
      from: { type: "string", short: "f" },
      to: { type: "string", short: "t" },
      output: { type: "string", short: "o" },
    },
  });

  if (!values.from || !values.to || !values.output) {
    console.error("Usage: generate-delta-package --from <dir> --to <dir> --output <dir>");
    process.exit(1);
  }

  const fromDir = path.resolve(values.from as string);
  const toDir = path.resolve(values.to as string);
  const outputDir = path.resolve(values.output as string);

  console.log("📦 Delta Package Generator");
  console.log(`   From: ${fromDir}`);
  console.log(`   To: ${toDir}`);
  console.log(`   Output: ${outputDir}`);
  console.log("");

  if (!fs.existsSync(fromDir)) {
    console.error(`❌ Source directory not found: ${fromDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(toDir)) {
    console.error(`❌ Target directory not found: ${toDir}`);
    process.exit(1);
  }

  // 生成增量包
  const delta = await generateDelta(fromDir, toDir, outputDir);

  // 输出统计
  console.log("");
  console.log("========================================");
  console.log("✅ Delta package generated!");
  console.log(`   Added: ${delta.added.length} files`);
  console.log(`   Modified: ${delta.modified.length} files`);
  console.log(`   Removed: ${delta.removed.length} files`);
  console.log(`   Total size: ${(delta.totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Saved to: ${outputDir}`);
  console.log("========================================");
  console.log("");
}

async function generateDelta(
  fromDir: string,
  toDir: string,
  outputDir: string
): Promise<DeltaManifest> {
  console.log("1️⃣  Scanning source directory...");
  const fromFiles = await scanDirectory(fromDir);
  console.log(`   Found ${fromFiles.size} files`);

  console.log("2️⃣  Scanning target directory...");
  const toFiles = await scanDirectory(toDir);
  console.log(`   Found ${toFiles.size} files`);

  const delta: DeltaManifest = {
    fromVersion: await readVersion(fromDir),
    toVersion: await readVersion(toDir),
    generatedAt: new Date().toISOString(),
    added: [],
    modified: [],
    removed: [],
    totalSize: 0,
    totalFiles: 0,
  };

  // 确保输出目录存在
  await fs.promises.mkdir(outputDir, { recursive: true });

  console.log("3️⃣  Computing delta...");

  // 检测新增和修改的文件
  let processed = 0;
  const totalFiles = toFiles.size;

  for (const [relPath, toEntry] of toFiles) {
    processed++;
    if (processed % 100 === 0 || processed === totalFiles) {
      process.stdout.write(`\r   Progress: ${processed}/${totalFiles} files`);
    }

    const fromEntry = fromFiles.get(relPath);

    if (!fromEntry) {
      // 新增文件
      await copyFile(
        path.join(toDir, relPath),
        path.join(outputDir, "added", relPath)
      );

      delta.added.push({
        path: relPath,
        sha256: toEntry.sha256,
        size: toEntry.size,
      });
      delta.totalSize += toEntry.size;
      delta.totalFiles++;

    } else if (fromEntry.sha256 !== toEntry.sha256) {
      // 修改的文件
      await copyFile(
        path.join(toDir, relPath),
        path.join(outputDir, "modified", relPath)
      );

      delta.modified.push({
        path: relPath,
        sha256: toEntry.sha256,
        size: toEntry.size,
      });
      delta.totalSize += toEntry.size;
      delta.totalFiles++;
    }
  }

  console.log("");

  // 检测删除的文件
  for (const [relPath] of fromFiles) {
    if (!toFiles.has(relPath)) {
      delta.removed.push(relPath);
    }
  }

  // 写入增量清单
  console.log("4️⃣  Writing delta manifest...");
  await fs.promises.writeFile(
    path.join(outputDir, "delta.json"),
    JSON.stringify(delta, null, 2),
    "utf-8"
  );

  return delta;
}

async function scanDirectory(dir: string): Promise<Map<string, FileEntry>> {
  const files = new Map<string, FileEntry>();

  async function walk(currentDir: string, prefix = "") {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.join(prefix, entry.name).replace(/\\/g, "/");

      // 跳过某些目录
      if (entry.isDirectory()) {
        const dirName = entry.name;
        if (
          dirName === "node_modules" ||
          dirName === ".git" ||
          dirName === ".update-temp" ||
          dirName === ".backups"
        ) {
          continue;
        }
        await walk(fullPath, relPath);
      } else {
        const stats = await fs.promises.stat(fullPath);
        const hash = await hashFile(fullPath);

        files.set(relPath, {
          path: relPath,
          sha256: hash,
          size: stats.size,
        });
      }
    }
  }

  await walk(dir);
  return files;
}

async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function copyFile(src: string, dst: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(dst), { recursive: true });
  await fs.promises.copyFile(src, dst);
}

async function readVersion(dir: string): Promise<string> {
  // 尝试读取 package.json
  const pkgPath = path.join(dir, "..", "package.json");

  try {
    const pkg = JSON.parse(await fs.promises.readFile(pkgPath, "utf-8"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

main().catch((error) => {
  console.error("\n❌ Error:", error.message);
  process.exit(1);
});
