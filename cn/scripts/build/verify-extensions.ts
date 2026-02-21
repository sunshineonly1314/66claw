#!/usr/bin/env node
/**
 * CN Extension JS Verification Script (HIGH-04 fix)
 *
 * Verifies that the committed .js files in CN extensions exactly match
 * what esbuild would produce from the .ts source files.
 *
 * This prevents supply-chain attacks where obfuscated or otherwise modified
 * .js files are committed that don't correspond to the accompanying TS source.
 *
 * How it works:
 *   1. For each CN extension directory, compile every .ts → temp .js via esbuild
 *   2. Compare the result with the committed .js (normalizing line endings)
 *   3. Report any mismatches as build failures
 *
 * Usage:
 *   node --import tsx cn/scripts/build/verify-extensions.ts
 *
 * Exit codes:
 *   0  All extension JS files match their TS source
 *   1  One or more mismatches found (or missing .js for a .ts file)
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { transformSync } from "esbuild";

const ROOT_DIR = path.resolve(process.cwd());

/**
 * Load CN extension directories from cn-protected-files.json (cn_extension_build section).
 * Falls back to hardcoded list if the config section doesn't exist.
 */
function loadExtensionDirs(): string[] {
  const configPath = path.join(ROOT_DIR, "config", "cn-protected-files.json");
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw) as { cn_extension_build?: { directories?: string[] } };
    if (config.cn_extension_build?.directories?.length) {
      // Strip trailing slashes to match directory names
      return config.cn_extension_build.directories.map((d) => d.replace(/\/$/, ""));
    }
  } catch { /* fall through to default */ }

  return [
    "extensions/dingtalk",
    "extensions/feishu",
    "extensions/openclawwechat",
    "extensions/qqbot",
    "extensions/wecom",
  ];
}

const CN_EXTENSION_DIRS = loadExtensionDirs();

const SKIP_PATTERNS = [
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /\.e2e\.ts$/,
  /test-helpers\./,
  /\.d\.ts$/,
];

/**
 * Recursively find all .ts files in a directory, skipping test files and node_modules.
 */
function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    if (entry.isDirectory()) {
      results.push(...findTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      if (!SKIP_PATTERNS.some((p) => p.test(full))) {
        results.push(full);
      }
    }
  }
  return results;
}

/**
 * Compile a .ts file to JS using esbuild (same config as compile-extensions.ts).
 */
function compileTs(tsPath: string): string {
  const code = fs.readFileSync(tsPath, "utf-8");
  const result = transformSync(code, {
    loader: "ts",
    format: "esm",
    platform: "node",
    target: "es2023",
    sourcefile: tsPath,
  });
  return result.code;
}

/**
 * Normalize line endings and trailing whitespace for comparison.
 */
function normalize(code: string): string {
  return code.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();
}

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex").slice(0, 12);
}

interface Mismatch {
  tsFile: string;
  jsFile: string;
  reason: string;
}

interface MissingJs {
  tsFile: string;
  jsFile: string;
}

function main(): void {
  console.log("");
  console.log("🔍 CN Extension JS Verification (HIGH-04)");
  console.log(`   Root: ${ROOT_DIR}`);
  console.log(`   Verifying ${CN_EXTENSION_DIRS.length} CN extensions`);
  console.log("");

  const mismatches: Mismatch[] = [];
  const missingJs: MissingJs[] = [];
  let checkedCount = 0;
  let okCount = 0;
  let skippedExt = 0;

  for (const extRel of CN_EXTENSION_DIRS) {
    const absDir = path.join(ROOT_DIR, extRel);

    if (!fs.existsSync(absDir)) {
      console.log(`   ⚠ ${extRel} — directory not found, skipping`);
      skippedExt++;
      continue;
    }

    const tsFiles = findTsFiles(absDir);

    if (tsFiles.length === 0) {
      console.log(`   ⚠ ${extRel} — no .ts files found`);
      skippedExt++;
      continue;
    }

    console.log(`   --- ${extRel} (${tsFiles.length} TS files) ---`);

    for (const tsFile of tsFiles) {
      checkedCount++;
      const jsFile = tsFile.replace(/\.ts$/, ".js");
      const relTs = path.relative(ROOT_DIR, tsFile);
      const relJs = path.relative(ROOT_DIR, jsFile);

      // Check committed .js exists
      if (!fs.existsSync(jsFile)) {
        missingJs.push({ tsFile: relTs, jsFile: relJs });
        console.log(`   ✗ MISSING  ${relJs}`);
        continue;
      }

      // Compile TS → expected JS
      let expectedJs: string;
      try {
        expectedJs = compileTs(tsFile);
      } catch (err) {
        mismatches.push({
          tsFile: relTs,
          jsFile: relJs,
          reason: `TS compile error: ${err instanceof Error ? err.message : String(err)}`,
        });
        console.log(`   ✗ COMPILE ERROR  ${relTs}`);
        continue;
      }

      // Read committed JS
      const committedJs = fs.readFileSync(jsFile, "utf-8");

      // Detect obfuscated JS (contains RC4 patterns)
      const isObfuscated =
        committedJs.includes("_0x") ||
        /\\x[0-9a-fA-F]{2}\\x[0-9a-fA-F]{2}/.test(committedJs) ||
        committedJs.includes("javascript-obfuscator") ||
        // RC4 self-defending code pattern
        /\(function\s*\(\s*\w+\s*,\s*\w+\s*\)\s*\{/.test(committedJs.slice(0, 500));

      if (isObfuscated) {
        mismatches.push({
          tsFile: relTs,
          jsFile: relJs,
          reason: "Committed .js is obfuscated — extensions must ship as plain esbuild output",
        });
        console.log(`   ✗ OBFUSCATED  ${relJs}`);
        continue;
      }

      // Compare normalized outputs
      const normalExpected = normalize(expectedJs);
      const normalCommitted = normalize(committedJs);

      if (normalExpected !== normalCommitted) {
        mismatches.push({
          tsFile: relTs,
          jsFile: relJs,
          reason: `Content mismatch — committed JS (sha256:${sha256(normalCommitted)}) != freshly compiled (sha256:${sha256(normalExpected)})`,
        });
        console.log(`   ✗ MISMATCH  ${relJs}`);
      } else {
        okCount++;
        console.log(`   ✓ ${relJs}`);
      }
    }
    console.log("");
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("========================================");
  console.log(`📊 Results: ${okCount} OK, ${mismatches.length} mismatches, ${missingJs.length} missing JS`);

  let hasFailures = false;

  if (missingJs.length > 0) {
    hasFailures = true;
    console.log("");
    console.log("❌ Missing .js files (run: pnpm build:cn-extensions):");
    for (const { tsFile, jsFile } of missingJs) {
      console.log(`   TS: ${tsFile}`);
      console.log(`   JS: ${jsFile}  ← does not exist`);
    }
  }

  if (mismatches.length > 0) {
    hasFailures = true;
    console.log("");
    console.log("❌ Mismatched/obfuscated .js files:");
    for (const { tsFile, jsFile, reason } of mismatches) {
      console.log(`   TS:     ${tsFile}`);
      console.log(`   JS:     ${jsFile}`);
      console.log(`   Reason: ${reason}`);
      console.log("");
    }
    console.log("");
    console.log("  To fix mismatches: run `pnpm build:cn-extensions` and commit the updated .js files.");
    console.log("  To fix obfuscation: remove obfuscated .js from git, run `pnpm build:cn-extensions`,");
    console.log("  and commit the clean esbuild output instead.");
  }

  if (!hasFailures) {
    console.log("");
    console.log("✅ All CN extension .js files verified — match their TS source exactly.");
    console.log("========================================");
    process.exit(0);
  } else {
    console.log("");
    console.log("❌ Extension verification FAILED.");
    console.log("   The committed .js files do not match what esbuild produces from the TS source.");
    console.log("   This is a supply-chain integrity violation. Fix before releasing.");
    console.log("========================================");
    process.exit(1);
  }
}

main();
