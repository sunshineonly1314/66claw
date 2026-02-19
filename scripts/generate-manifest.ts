#!/usr/bin/env node
/**
 * Release Manifest Generator
 *
 * 生成版本发布清单,包含版本信息、文件列表、依赖变更等
 *
 * Usage: node scripts/generate-manifest.js
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

interface Manifest {
  version: string;
  buildTime: string;
  gitCommit: string;
  nodeVersion: string;
  platform: {
    windows: boolean;
    macos: boolean;
    linux: boolean;
  };
  files: {
    total: number;
    size: number;
    encrypted: {
      bytecode: number;
      obfuscated: number;
    };
  };
  changelog: {
    "zh-CN": string;
    "en-US": string;
  };
  dependencies: {
    npm: {
      changed: string[];
      added: string[];
      removed: string[];
    };
    skills: {
      updated: string[];
      added: string[];
    };
    mcp: {
      updated: string[];
      added: string[];
    };
  };
}

async function main() {
  const rootDir = process.cwd();
  const distDir = path.join(rootDir, "dist");

  console.log("📝 Generating release manifest...");
  console.log("");

  // 读取版本信息
  const pkg = JSON.parse(
    await fs.promises.readFile(path.join(rootDir, "package.json"), "utf-8")
  );

  const manifest: Manifest = {
    version: pkg.version,
    buildTime: new Date().toISOString(),
    gitCommit: await getGitCommit(),
    nodeVersion: process.version,
    platform: {
      windows: true,
      macos: true,
      linux: true,
    },
    files: {
      total: 0,
      size: 0,
      encrypted: {
        bytecode: 0,
        obfuscated: 0,
      },
    },
    changelog: await readChangelog(rootDir),
    dependencies: await computeDependencyChanges(rootDir),
  };

  // 统计文件
  console.log("1️⃣  Scanning dist directory...");
  const fileStats = await scanFiles(distDir);
  manifest.files.total = fileStats.total;
  manifest.files.size = fileStats.size;
  manifest.files.encrypted.bytecode = fileStats.bytecode;
  manifest.files.encrypted.obfuscated = fileStats.obfuscated;

  console.log(`   Total files: ${fileStats.total}`);
  console.log(`   Total size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Bytecode files: ${fileStats.bytecode}`);
  console.log(`   Obfuscated files: ${fileStats.obfuscated}`);
  console.log("");

  // 生成校验和
  // NOTE: 目前只校验 dist/ 目录，因为 delta 增量包仅覆盖 dist/ 内容。
  // 当增量包扩展覆盖 skills/extensions 时，应同步取消下面的注释。
  console.log("2️⃣  Generating checksums...");
  const checksums = await generateChecksums(distDir);

  // TODO: 当 generate-delta-package 扩展支持 skills/extensions 后启用
  // for (const extraDir of ["skills", "extensions"]) {
  //   const extraPath = path.join(rootDir, extraDir);
  //   if (fs.existsSync(extraPath)) {
  //     const extraChecksums = await generateChecksums(extraPath);
  //     for (const [relPath, hash] of Object.entries(extraChecksums)) {
  //       checksums[`${extraDir}/${relPath}`] = hash;
  //     }
  //   }
  // }

  await fs.promises.writeFile(
    path.join(rootDir, "checksums.json"),
    JSON.stringify(checksums, null, 2),
    "utf-8"
  );
  console.log(`   Generated checksums for ${Object.keys(checksums).length} files`);
  console.log("");

  // 写入清单
  console.log("3️⃣  Writing manifest...");
  await fs.promises.writeFile(
    path.join(rootDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8"
  );

  console.log("");
  console.log("✅ Manifest generated successfully!");
  console.log(`   Version: ${manifest.version}`);
  console.log(`   Commit: ${manifest.gitCommit}`);
  console.log("");
}

async function scanFiles(dir: string): Promise<{
  total: number;
  size: number;
  bytecode: number;
  obfuscated: number;
}> {
  let total = 0;
  let size = 0;
  let bytecode = 0;
  let obfuscated = 0;

  async function walk(currentDir: string) {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") {
          await walk(fullPath);
        }
      } else {
        total++;
        const stats = await fs.promises.stat(fullPath);
        size += stats.size;

        if (entry.name.endsWith(".jsc")) {
          bytecode++;
        } else if (entry.name.endsWith(".js")) {
          // 检查是否是混淆文件
          const content = await fs.promises.readFile(fullPath, "utf-8");
          if (content.includes("obfuscated") || content.length > 100000) {
            obfuscated++;
          }
        }
      }
    }
  }

  await walk(dir);
  return { total, size, bytecode, obfuscated };
}

async function generateChecksums(dir: string): Promise<Record<string, string>> {
  const checksums: Record<string, string> = {};

  async function walk(currentDir: string, prefix = "") {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.join(prefix, entry.name).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") {
          await walk(fullPath, relPath);
        }
      } else {
        const hash = await hashFile(fullPath);
        checksums[relPath] = hash;
      }
    }
  }

  await walk(dir);
  return checksums;
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

async function getGitCommit(): Promise<string> {
  try {
    const { execSync } = await import("node:child_process");
    const commit = execSync("git rev-parse --short HEAD", {
      encoding: "utf-8",
    }).trim();
    return commit;
  } catch {
    return "unknown";
  }
}

async function readChangelog(rootDir: string): Promise<{
  "zh-CN": string;
  "en-US": string;
}> {
  // Try CHANGELOG.md first, then fall back to generating from versionrecord.md
  const changelogPath = path.join(rootDir, "CHANGELOG.md");
  const versionRecordPath = path.join(rootDir, "versionrecord.md");

  let content: string | null = null;

  try {
    content = await fs.promises.readFile(changelogPath, "utf-8");
  } catch {
    // CHANGELOG.md doesn't exist — try auto-generating from versionrecord.md
    if (fs.existsSync(versionRecordPath)) {
      console.log("   CHANGELOG.md not found, generating from versionrecord.md...");
      try {
        const { execSync } = await import("node:child_process");
        execSync("node --import tsx scripts/generate-changelog.ts", {
          cwd: rootDir,
          encoding: "utf-8",
          stdio: "pipe",
        });
        content = await fs.promises.readFile(changelogPath, "utf-8");
      } catch (genError) {
        console.log(`   Warning: auto-generate changelog failed: ${(genError as Error).message}`);
      }
    }
  }

  if (!content) {
    return {
      "zh-CN": "无更新日志",
      "en-US": "No changelog available",
    };
  }

  // Extract latest version's changelog
  const lines = content.split("\n");
  const latest: string[] = [];
  let inLatest = false;

  for (const line of lines) {
    if (line.startsWith("## ") && !inLatest) {
      inLatest = true;
      latest.push(line); // Include the version header
      continue;
    }

    if (line.startsWith("## ") && inLatest) {
      break;
    }

    if (inLatest) {
      latest.push(line);
    }
  }

  const changelogText = latest.join("\n").trim();

  return {
    "zh-CN": changelogText,
    "en-US": changelogText,
  };
}

async function computeDependencyChanges(rootDir: string): Promise<Manifest["dependencies"]> {
  const result: Manifest["dependencies"] = {
    npm: { changed: [], added: [], removed: [] },
    skills: { updated: [], added: [] },
    mcp: { updated: [], added: [] },
  };

  // 1. Compare npm dependencies with previous release
  const releaseCacheDir = path.join(rootDir, ".release-cache");
  const prevVersionDir = await findPreviousVersion(releaseCacheDir);

  if (prevVersionDir) {
    try {
      const prevPkgPath = path.join(prevVersionDir, "package.json");
      const currPkg = JSON.parse(
        await fs.promises.readFile(path.join(rootDir, "package.json"), "utf-8")
      );
      const prevPkg = JSON.parse(
        await fs.promises.readFile(prevPkgPath, "utf-8")
      );

      const currDeps = currPkg.dependencies || {};
      const prevDeps = prevPkg.dependencies || {};

      // Find added and changed
      for (const [name, version] of Object.entries(currDeps)) {
        if (!(name in prevDeps)) {
          result.npm.added.push(`${name}@${version}`);
        } else if (prevDeps[name] !== version) {
          result.npm.changed.push(`${name}: ${prevDeps[name]} -> ${version}`);
        }
      }

      // Find removed
      for (const name of Object.keys(prevDeps)) {
        if (!(name in currDeps)) {
          result.npm.removed.push(name);
        }
      }
    } catch {
      // Previous package.json not available, skip
    }
  }

  // 2. Detect skills changes via git diff (if tags exist)
  try {
    const { execSync } = await import("node:child_process");
    const latestTag = execSync("git describe --tags --abbrev=0", {
      encoding: "utf-8",
      cwd: rootDir,
    }).trim();

    if (latestTag) {
      const skillsDiff = execSync(
        `git diff ${latestTag} --name-only -- skills/`,
        { encoding: "utf-8", cwd: rootDir }
      ).trim();

      if (skillsDiff) {
        const changedSkills = new Set<string>();
        for (const filePath of skillsDiff.split("\n").filter(Boolean)) {
          const match = filePath.match(/^skills\/([^/]+)\//);
          if (match) changedSkills.add(match[1]);
        }

        for (const skill of changedSkills) {
          // Check if it's new (didn't exist in the previous tag)
          try {
            execSync(`git show ${latestTag}:skills/${skill}/SKILL.md`, {
              encoding: "utf-8",
              cwd: rootDir,
              stdio: "pipe",
            });
            result.skills.updated.push(skill);
          } catch {
            result.skills.added.push(skill);
          }
        }
      }
    }
  } catch {
    // No tags or git not available, skip
  }

  return result;
}

async function findPreviousVersion(cacheDir: string): Promise<string | null> {
  try {
    const entries = await fs.promises.readdir(cacheDir, { withFileTypes: true });
    const versions = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

    // Return the most recent cached version directory
    if (versions.length > 0) {
      return path.join(cacheDir, versions[0]);
    }
  } catch {
    // Cache dir doesn't exist yet
  }
  return null;
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
