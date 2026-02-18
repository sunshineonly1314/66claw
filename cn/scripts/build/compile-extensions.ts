#!/usr/bin/env node
/**
 * CN Extensions Pre-Compiler
 *
 * Compiles CN extension .ts files to .js using esbuild transformSync.
 * This step is required before obfuscation because extensions ship as
 * TypeScript source (loaded by jiti at runtime), but the obfuscator
 * and resolve-cn-targets.ts expect .js files to exist.
 *
 * Reads cn_encryption.obfuscate.directories from cn-protected-files.json
 * to determine which extension directories to compile.
 *
 * Usage: node --import tsx cn/scripts/build/compile-extensions.ts
 */

import fs from "node:fs";
import path from "node:path";
import { transformSync } from "esbuild";
import { loadCnEncryptionConfig } from "./resolve-cn-targets.js";

const ROOT_DIR = path.resolve(process.cwd());

const SKIP_PATTERNS = [
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /\.e2e\.ts$/,
  /test-helpers\./,
  /\.d\.ts$/,
];

/**
 * Recursively find all .ts files in a directory, skipping test files.
 */
function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.name === "node_modules") continue;
    if (entry.isDirectory()) {
      results.push(...findTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      const shouldSkip = SKIP_PATTERNS.some((p) => p.test(full));
      if (!shouldSkip) {
        results.push(full);
      }
    }
  }
  return results;
}

/**
 * Compile a single .ts file to .js using esbuild transformSync.
 * Writes the .js file alongside the .ts file.
 */
function compileFile(tsPath: string): { success: boolean; error?: string } {
  try {
    const code = fs.readFileSync(tsPath, "utf-8");
    const result = transformSync(code, {
      loader: "ts",
      format: "esm",
      platform: "node",
      target: "es2023",
      sourcefile: tsPath,
    });
    const jsPath = tsPath.replace(/\.ts$/, ".js");
    fs.writeFileSync(jsPath, result.code, "utf-8");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function main(): void {
  console.log("");
  console.log("📦 CN Extensions Pre-Compiler");
  console.log(`   Root: ${ROOT_DIR}`);
  console.log("");

  const config = loadCnEncryptionConfig(ROOT_DIR);

  // Only process extension directories (extensions/*/)
  const extDirs = config.obfuscate.directories.filter((d) =>
    d.startsWith("extensions/"),
  );

  if (extDirs.length === 0) {
    console.log("   No extension directories configured for obfuscation.");
    return;
  }

  console.log(`   Extension directories: ${extDirs.join(", ")}`);
  console.log("");

  let totalFiles = 0;
  let successCount = 0;
  let errorCount = 0;
  const errors: { file: string; error: string }[] = [];

  for (const extDir of extDirs) {
    const absDir = path.join(ROOT_DIR, extDir);
    const tsFiles = findTsFiles(absDir);

    if (tsFiles.length === 0) {
      console.log(`   ⚠ ${extDir} — no .ts files found`);
      continue;
    }

    console.log(`   --- ${extDir} (${tsFiles.length} files) ---`);

    for (const tsFile of tsFiles) {
      totalFiles++;
      const relativePath = path.relative(ROOT_DIR, tsFile);
      const result = compileFile(tsFile);

      if (result.success) {
        successCount++;
        console.log(`   ✓ ${relativePath}`);
      } else {
        errorCount++;
        errors.push({ file: relativePath, error: result.error || "Unknown" });
        console.log(`   ✗ ${relativePath}: ${result.error}`);
      }
    }
    console.log("");
  }

  console.log("========================================");
  console.log(`✅ Extensions compiled: ${successCount}/${totalFiles}`);

  if (errorCount > 0) {
    console.log(`   ⚠️ Errors: ${errorCount}`);
    for (const err of errors) {
      console.log(`     ${err.file}: ${err.error}`);
    }
    process.exit(1);
  }

  console.log("");
}

main();
