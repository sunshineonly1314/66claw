#!/usr/bin/env node
/**
 * V8 Bytecode Compiler for Critical Modules
 *
 * Compiles critical JS files (license/, security/, gateway/) to V8 bytecode (.jsc).
 * Bytecode is binary format — cannot be read as text, and reverse engineering
 * tools for V8 bytecode are scarce and immature.
 *
 * Strategy:
 * 1. Convert ESM modules to CJS using esbuild (bytenode requires CJS)
 * 2. Compile CJS to V8 bytecode (.jsc) using bytenode
 * 3. Replace original .js with a thin ESM loader that loads the .jsc
 *
 * Requirements:
 *   - bytenode (devDependency)
 *   - esbuild (devDependency)
 *
 * IMPORTANT: V8 bytecode is platform + Node version specific!
 * Must compile on the same platform/arch/Node version as the target.
 *
 * Usage: node --import tsx scripts/compile-bytecode.ts
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(process.cwd());
const DIST_DIR = path.join(ROOT_DIR, "dist");

/**
 * Critical directories whose .js files will be compiled to bytecode.
 * These contain the highest-value targets for reverse engineering.
 */
const CRITICAL_DIRS = [
  "license",
  "security",
  "gateway",
];

/**
 * Files to skip even within critical dirs (bytecode-incompatible or unnecessary).
 */
const SKIP_PATTERNS = [
  /\.test\.js$/,
  /\.spec\.js$/,
  /\.d\.ts$/,
  /\.map$/,
  /\.json$/,
  /\.jsc$/,
  // Note: index.js files are NO LONGER skipped — they expose function names
  // of protected modules and must also be compiled to bytecode.
];

/**
 * Get all .js files in a directory recursively
 */
function getJsFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      const shouldSkip = SKIP_PATTERNS.some((p) => p.test(fullPath));
      if (!shouldSkip) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Collect all files that should be compiled to bytecode
 */
function collectTargetFiles(): string[] {
  const files: string[] = [];

  // Files from critical directories
  for (const dir of CRITICAL_DIRS) {
    const dirPath = path.join(DIST_DIR, dir);
    files.push(...getJsFiles(dirPath));
  }

  return files;
}

/**
 * Convert an ESM file to CJS format using esbuild.
 * Returns the path to the CJS file (same location, .cjs extension).
 */
function convertToCjs(filePath: string): string {
  const cjsPath = filePath.replace(/\.js$/, ".cjs");

  // Use esbuild to transform ESM → CJS (single file, no bundling)
  execSync(
    `npx esbuild "${filePath}" --format=cjs --platform=node --outfile="${cjsPath}"`,
    { stdio: "pipe", cwd: ROOT_DIR },
  );

  return cjsPath;
}

/**
 * Compile a CJS file to V8 bytecode using bytenode.
 * Returns the path to the .jsc file.
 */
function compileToBytecode(cjsPath: string): string {
  // bytenode compiles .js/.cjs → .jsc in the same directory
  execSync(
    `npx bytenode --compile "${cjsPath}"`,
    { stdio: "pipe", cwd: ROOT_DIR },
  );

  const jscPath = cjsPath.replace(/\.cjs$/, ".jsc");

  // bytenode appends "c" to the extension: .cjs → .cjsc
  const bytenodeOutput = cjsPath + "c";
  if (fs.existsSync(bytenodeOutput)) {
    fs.renameSync(bytenodeOutput, jscPath);
  }

  if (!fs.existsSync(jscPath)) {
    throw new Error(`Bytecode output not found for ${cjsPath} (checked: ${jscPath}, ${bytenodeOutput})`);
  }

  return jscPath;
}

/**
 * Extract exported names from a JS file (works with both original and obfuscated code).
 *
 * Handles:
 *   export const/let/var/function/class NAME
 *   export async function NAME
 *   export enum NAME
 *   export { A, B, C }
 *   export { A as B }
 *   export { A, B } from "./other.js"  (re-exports)
 *   export * from "./other.js"  (star re-exports — recursively resolves)
 *   export default  → skipped (handled separately in the loader)
 */
function extractExportNames(code: string, filePath?: string, visited?: Set<string>): string[] {
  const names = new Set<string>();

  // Cycle guard for recursive resolution of export * from
  if (!visited) visited = new Set();
  if (filePath) {
    const resolved = path.resolve(filePath);
    if (visited.has(resolved)) return [];
    visited.add(resolved);
  }

  // export const/let/var NAME
  for (const m of code.matchAll(/\bexport\s+(?:const|let|var)\s+([a-zA-Z_$][\w$]*)/g)) {
    if (m[1] !== "default") names.add(m[1]);
  }

  // export [async] function [*] NAME / export class NAME
  // Handles: export function foo, export async function foo, export function* foo
  for (const m of code.matchAll(/\bexport\s+(?:async\s+)?(?:function\*?|class)\s+([a-zA-Z_$][\w$]*)/g)) {
    if (m[1] !== "default") names.add(m[1]);
  }

  // export enum NAME (tsc compiles enums to var/const, but just in case)
  for (const m of code.matchAll(/\bexport\s+enum\s+([a-zA-Z_$][\w$]*)/g)) {
    names.add(m[1]);
  }

  // export { A, B as C, D }  (local exports or re-exports from another module)
  for (const m of code.matchAll(/\bexport\s*\{([^}]+)\}/g)) {
    const inner = m[1];
    for (const item of inner.split(",")) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      // "A as B" → exported name is B
      const asMatch = trimmed.match(/\bas\s+([a-zA-Z_$][\w$]*)/);
      const name = asMatch ? asMatch[1] : trimmed.split(/\s/)[0];
      if (name && name !== "default") {
        names.add(name);
      }
    }
  }

  // export * from "./other.js"  — recursively resolve star re-exports
  if (filePath) {
    const dir = path.dirname(filePath);
    for (const m of code.matchAll(/\bexport\s*\*\s*from\s*["']([^"']+)["']/g)) {
      const specifier = m[1];
      const targetPath = path.resolve(dir, specifier);
      if (fs.existsSync(targetPath)) {
        try {
          const targetCode = fs.readFileSync(targetPath, "utf-8");
          const targetNames = extractExportNames(targetCode, targetPath, visited);
          for (const n of targetNames) names.add(n);
        } catch { /* skip unreadable files */ }
      }
    }
  }

  // Remove "default" if it snuck in
  names.delete("default");

  return [...names].sort();
}

/**
 * Generate a thin ESM loader that loads the .jsc bytecode at runtime.
 *
 * The loader:
 * 1. Uses createRequire to get a CJS require function
 * 2. Loads bytenode to register .jsc support
 * 3. Requires the .jsc file
 * 4. Re-exports all named exports explicitly (ESM requires static export names)
 */
function generateEsmLoader(originalJsPath: string, jscPath: string, exportNames: string[]): string {
  const jscBasename = path.basename(jscPath);

  // Build explicit re-export lines for each named export
  const reExportLines = exportNames
    .map((name) => `export const ${name} = _mod.${name};`)
    .join("\n");

  // The loader replaces the original .js file
  return `// V8 Bytecode Loader — compiled from source, do not edit
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Register .jsc bytecode support
require("bytenode");

// Load compiled bytecode module
const _mod = require(path.join(__dirname, "${jscBasename}"));

// Re-export default
export default _mod.default || _mod;

// Re-export all named exports
${reExportLines}
`;
}

/**
 * Phase 1: Pre-scan all target files to extract their export names BEFORE any
 * files are modified. This is critical because `export * from "./other.js"`
 * requires reading the target file's original code — if we processed files
 * sequentially, the target might already be replaced with a bytecode loader.
 */
function prescanExports(
  targetFiles: string[],
): Map<string, { code: string; exportNames: string[]; skip: boolean }> {
  const result = new Map<string, { code: string; exportNames: string[]; skip: boolean }>();

  // First pass: read all files and detect which ones to skip
  for (const filePath of targetFiles) {
    const code = fs.readFileSync(filePath, "utf-8");
    const skip = code.length < 200;
    result.set(filePath, { code, exportNames: [], skip });
  }

  // Second pass: extract export names (now export * from can safely read any file
  // since nothing has been modified yet)
  for (const [filePath, entry] of result) {
    if (entry.skip) continue;
    entry.exportNames = extractExportNames(entry.code, filePath);
  }

  return result;
}

/**
 * Phase 2: Process a single file — ESM → CJS → bytecode → ESM loader.
 * Uses pre-scanned export names instead of reading the file again.
 */
function processFile(
  filePath: string,
  exportNames: string[],
): { success: boolean; exportCount?: number; error?: string } {
  let cjsPath: string | null = null;

  try {
    // Step 1: Convert ESM → CJS
    cjsPath = convertToCjs(filePath);

    // Step 2: Compile CJS → bytecode
    const jscPath = compileToBytecode(cjsPath);

    // Step 3: Replace original .js with ESM loader (with explicit named re-exports)
    const loader = generateEsmLoader(filePath, jscPath, exportNames);
    fs.writeFileSync(filePath, loader, "utf-8");

    // Step 4: Clean up intermediate CJS file
    if (cjsPath && fs.existsSync(cjsPath)) {
      fs.unlinkSync(cjsPath);
    }

    return { success: true, exportCount: exportNames.length };
  } catch (error) {
    // Clean up on failure
    if (cjsPath && fs.existsSync(cjsPath)) {
      try { fs.unlinkSync(cjsPath); } catch { /* ignore */ }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(): Promise<void> {
  console.log("");
  console.log("🔒 V8 Bytecode Compilation — Critical Modules");
  console.log(`   Target: ${DIST_DIR}`);
  console.log(`   Critical dirs: ${CRITICAL_DIRS.join(", ")}`);
  console.log(`   Platform: ${process.platform}-${process.arch}`);
  console.log(`   Node: ${process.version}`);
  console.log("");

  if (!fs.existsSync(DIST_DIR)) {
    console.error("❌ dist/ directory not found. Run build first.");
    process.exit(1);
  }

  // Check dependencies
  try {
    execSync("npx bytenode --version", { stdio: "pipe", cwd: ROOT_DIR });
  } catch {
    console.error("❌ bytenode not found. Install with: pnpm add -D bytenode");
    process.exit(1);
  }

  try {
    execSync("npx esbuild --version", { stdio: "pipe", cwd: ROOT_DIR });
  } catch {
    console.error("❌ esbuild not found. Install with: pnpm add -D esbuild");
    process.exit(1);
  }

  const targetFiles = collectTargetFiles();
  console.log(`   Found ${targetFiles.length} files to compile`);
  console.log("");

  // Phase 1: Pre-scan ALL files to extract export names before modifying anything.
  // This ensures `export * from` resolution works correctly even when target files
  // are in the same compilation set.
  console.log("   Phase 1: Pre-scanning exports...");
  const prescan = prescanExports(targetFiles);
  console.log(`   Pre-scanned ${prescan.size} files`);
  console.log("");

  // Phase 2: Compile each file to bytecode using pre-scanned export names.
  console.log("   Phase 2: Compiling to bytecode...");
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  const errors: { file: string; error: string }[] = [];

  for (const file of targetFiles) {
    const relativePath = path.relative(DIST_DIR, file);
    const entry = prescan.get(file)!;

    if (entry.skip) {
      skipCount++;
      continue;
    }

    const result = processFile(file, entry.exportNames);

    if (result.success) {
      const jscPath = file.replace(/\.js$/, ".jsc");
      if (fs.existsSync(jscPath)) {
        successCount++;
        const exportInfo = result.exportCount ? ` (${result.exportCount} exports)` : "";
        console.log(`   ✓ ${relativePath} → .jsc${exportInfo}`);
      } else {
        skipCount++;
      }
    } else {
      errorCount++;
      errors.push({ file: relativePath, error: result.error || "Unknown error" });
      console.log(`   ✗ ${relativePath}: ${result.error}`);
    }
  }

  console.log("");
  console.log("========================================");
  console.log("🔒 Bytecode compilation complete!");
  console.log(`   Compiled: ${successCount} files → .jsc`);
  console.log(`   Skipped (small): ${skipCount} files`);

  if (errorCount > 0) {
    console.log(`   ⚠️ Errors: ${errorCount} files`);
    console.log("");
    for (const { file, error } of errors.slice(0, 10)) {
      console.log(`   - ${file}: ${error}`);
    }
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more`);
    }
  }

  console.log("========================================");
  console.log("");

  // Non-zero exit only if ALL files failed
  if (successCount === 0 && targetFiles.length > 0) {
    console.error("❌ All bytecode compilations failed!");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
