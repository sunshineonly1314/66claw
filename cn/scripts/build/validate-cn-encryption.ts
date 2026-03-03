#!/usr/bin/env node
/**
 * CN Encryption Coverage Validator
 *
 * Standalone validation script for CI. Ensures:
 * 1. All cn_encryption files exist on disk
 * 2. All compilable CN source files (section1) are covered by encryption
 * 3. No section2 (modified upstream) files are accidentally in encryption targets
 *
 * Usage: node --import tsx cn/scripts/build/validate-cn-encryption.ts
 * Exit code: 0 = pass, 1 = validation errors found
 */

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(process.cwd());
const CONFIG_PATH = path.join(ROOT_DIR, "config", "cn-protected-files.json");

interface Tier {
  files: string[];
  directories: string[];
}

interface Config {
  section1_cn_only: { files: string[]; directories: string[] };
  section2_modified_upstream: { files: Array<{ path: string }> };
  cn_encryption: { bytecode: Tier; obfuscate: Tier };
}

function loadConfig(): Config {
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw);
}

function isCompilableSource(filePath: string): boolean {
  if (!filePath.endsWith(".ts")) return false;
  if (filePath.endsWith(".test.ts") || filePath.endsWith(".spec.ts")) return false;
  if (filePath.startsWith("docs/")) return false;
  if (filePath.startsWith("scripts/")) return false;
  if (filePath.startsWith(".github/")) return false;
  if (filePath.startsWith("config/")) return false;
  if (filePath.startsWith("cn/docs/")) return false;
  if (filePath.startsWith("skills/")) return false;
  if (filePath.startsWith("build/")) return false;
  if (filePath.startsWith("ui/")) return false;
  if (!filePath.startsWith("src/") && !filePath.startsWith("extensions/")) return false;
  return true;
}

function main(): void {
  console.log("🔍 CN Encryption Coverage Validation\n");

  const config = loadConfig();
  const errors: string[] = [];

  // ── Check 1: All encryption target files exist on disk ──────────────────

  console.log("  Check 1: Encryption target files exist on disk...");
  const allEncFiles = [
    ...config.cn_encryption.bytecode.files,
    ...config.cn_encryption.obfuscate.files,
  ];

  for (const file of allEncFiles) {
    const fullPath = path.join(ROOT_DIR, file);
    if (!fs.existsSync(fullPath)) {
      errors.push(`[MISSING] Encryption target not found on disk: ${file}`);
    }
  }

  // Check directories exist
  const allEncDirs = [
    ...config.cn_encryption.bytecode.directories,
    ...config.cn_encryption.obfuscate.directories,
  ];

  for (const dir of allEncDirs) {
    const fullPath = path.join(ROOT_DIR, dir);
    if (!fs.existsSync(fullPath)) {
      errors.push(`[MISSING] Encryption target directory not found: ${dir}`);
    }
  }

  const check1Errors = errors.length;
  console.log(`    ${check1Errors === 0 ? "✓" : "✗"} ${allEncFiles.length} files, ${allEncDirs.length} directories checked\n`);

  // ── Check 2: All section1 compilable source covered by encryption ───────

  console.log("  Check 2: Section1 compilable sources are covered...");
  const encFilesSet = new Set([...allEncFiles]);

  let uncoveredCount = 0;
  for (const file of config.section1_cn_only.files) {
    if (!isCompilableSource(file)) continue;

    const inFiles = encFilesSet.has(file);
    const inDirs = allEncDirs.some((d) => file.startsWith(d));

    if (!inFiles && !inDirs) {
      errors.push(`[UNCOVERED] CN source file not in any encryption tier: ${file}`);
      uncoveredCount++;
    }
  }

  console.log(`    ${uncoveredCount === 0 ? "✓" : "✗"} ${uncoveredCount} uncovered files\n`);

  // ── Check 3: No section2 files in encryption targets ────────────────────

  console.log("  Check 3: No section2 files in encryption targets...");
  const section2Paths = config.section2_modified_upstream.files.map((f) => f.path);
  let wrongCount = 0;

  for (const s2Path of section2Paths) {
    if (allEncFiles.includes(s2Path)) {
      errors.push(`[UPSTREAM] Section2 file in encryption targets: ${s2Path}`);
      wrongCount++;
    } else if (allEncDirs.some((d) => s2Path.startsWith(d))) {
      errors.push(`[UPSTREAM] Section2 file falls under encrypted directory: ${s2Path}`);
      wrongCount++;
    }
  }

  console.log(`    ${wrongCount === 0 ? "✓" : "✗"} ${wrongCount} section2 conflicts\n`);

  // ── Check 4: __DEV_BUILD__ not present in dist (security critical) ────

  console.log("  Check 4: __DEV_BUILD__ replaced in production dist...");
  const distDir = path.join(ROOT_DIR, "dist");
  let devBuildLeakCount = 0;

  if (fs.existsSync(distDir)) {
    /**
     * Recursively scan dist/ for .js files that still contain __DEV_BUILD__
     * as an identifier (not as a string literal — the define plugin replaces
     * it with `false`, so any remaining __DEV_BUILD__ means the replacement
     * failed and the DEV bypass is exploitable in production).
     */
    function scanForDevBuild(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== "node_modules") {
          scanForDevBuild(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
          const code = fs.readFileSync(fullPath, "utf-8");
          // Match __DEV_BUILD__ as identifier, not inside string literals.
          // The define plugin replaces `typeof __DEV_BUILD__` → `"boolean"`
          // and `__DEV_BUILD__` → `false`. If either pattern remains, it's a leak.
          if (/\b__DEV_BUILD__\b/.test(code)) {
            const relativePath = path.relative(ROOT_DIR, fullPath);
            errors.push(`[DEV_LEAK] __DEV_BUILD__ not replaced in: ${relativePath}`);
            devBuildLeakCount++;
          }
        }
      }
    }
    scanForDevBuild(distDir);
  } else {
    console.log("    ⚠ dist/ not found — skipping (run after build)");
  }

  console.log(`    ${devBuildLeakCount === 0 ? "✓" : "✗"} ${devBuildLeakCount} files still contain __DEV_BUILD__\n`);

  // ── Summary ─────────────────────────────────────────────────────────────

  console.log("========================================");
  if (errors.length === 0) {
    console.log("✅ All validation checks passed!");
    console.log(`   Bytecode tier: ${config.cn_encryption.bytecode.files.length} files + ${config.cn_encryption.bytecode.directories.length} dirs`);
    console.log(`   Obfuscate tier: ${config.cn_encryption.obfuscate.files.length} files + ${config.cn_encryption.obfuscate.directories.length} dirs`);
  } else {
    console.log(`❌ ${errors.length} validation errors found:\n`);
    for (const err of errors) {
      console.log(`   ${err}`);
    }
    process.exit(1);
  }
  console.log("========================================");
}

main();
