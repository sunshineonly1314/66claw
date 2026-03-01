#!/usr/bin/env node
/**
 * V8 Bytecode Compiler for Critical Modules
 *
 * Compiles CN bytecode-tier files to V8 bytecode (.jsc).
 * Targets are driven by cn_encryption.bytecode in config/cn-protected-files.json.
 * Bytecode is binary format — cannot be read as text, and reverse engineering
 * tools for V8 bytecode are scarce and immature.
 *
 * Strategy:
 * 1. Write {"type": "commonjs"} package.json to EXPLICIT bytecode directories only
 *    (dispatch/, license/, security/ — CN-only dirs)
 * 2. Convert ESM modules to CJS using esbuild (bytenode requires CJS)
 * 3. Compile CJS to V8 bytecode (.jsc) using bytenode
 * 4. Replace original .js with a loader stub:
 *    - CJS loader for files in explicit bytecode dirs (has CJS package.json)
 *    - ESM loader for individual files in mixed dirs (gateway/, agents/, etc.)
 *
 * DUAL LOADER STRATEGY:
 * Explicit bytecode dirs (dispatch/, license/, security/) get CJS loaders
 * because the entire directory is set to {"type": "commonjs"}. This avoids
 * CJS→ESM→CJS cycles within these dirs.
 *
 * Individual bytecode files in mixed dirs (e.g. gateway/cn-handlers.js) get
 * ESM loaders using `createRequire(import.meta.url)` to load the CJS bytecode.
 * This avoids polluting upstream ESM code in those directories with CJS overrides.
 *
 * Uses programmatic APIs (esbuild.transformSync + bytenode.compileFile) instead
 * of spawning npx subprocesses — eliminates ~340 process spawns on Windows.
 *
 * IMPORTANT: V8 bytecode is platform + Node version specific!
 * Must compile on the same platform/arch/Node version as the target.
 *
 * Usage: node --import tsx scripts/compile-bytecode.ts
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { transformSync } from "esbuild";
import { resolveEncryptionTargets, getExplicitBytecodeDirs, getExplicitBytecodeExtensionDirs, isInExplicitBytecodeDir, isInExplicitBytecodeExtensionDir } from "./resolve-cn-targets.js";

// bytenode is CJS-only, use createRequire to load it from ESM context
const require = createRequire(import.meta.url);
const bytenode = require("bytenode");

const ROOT_DIR = path.resolve(process.cwd());
const DIST_DIR = path.join(ROOT_DIR, "dist");

/**
 * Convert an ESM file to CJS format using esbuild programmatic API.
 * Returns the path to the CJS file (same location, .cjs extension).
 *
 * IMPORTANT: After ESM→CJS conversion, we must strip any `const __filename = ...`
 * and `const __dirname = ...` declarations from the output. In ESM, these don't
 * exist natively so code often creates them via `fileURLToPath(import.meta.url)`.
 * After esbuild converts to CJS, these declarations remain — but bytenode's
 * `compileAsModule: true` wraps the code in Node's module function:
 *   (function(exports, require, module, __filename, __dirname) { ... })
 * which already provides __filename and __dirname as parameters. The redundant
 * `const` declarations cause "Identifier '__filename' has already been declared".
 *
 * In CJS context, the module-provided __filename/__dirname are correct (real
 * filesystem paths), so removing the ESM-derived declarations is both safe and
 * preferred — the ESM version would be broken anyway since `import.meta.url`
 * becomes an empty object `{}` after CJS conversion.
 */
function convertToCjs(filePath: string): string {
  const cjsPath = filePath.replace(/\.js$/, ".cjs");
  let code = fs.readFileSync(filePath, "utf-8");

  // Problem 0: ESM import attributes (e.g. `import x from "./y.json" with { type: "json" }`)
  //   esbuild cannot parse the `with { ... }` syntax. In CJS mode, `require("./y.json")`
  //   natively loads JSON without any import attribute, so stripping them is safe.
  //   Also handles the older `assert { ... }` syntax.
  code = code.replace(/\s+(?:with|assert)\s*\{[^}]*\}\s*;/g, ";");

  const result = transformSync(code, {
    format: "cjs",
    platform: "node",
    sourcefile: filePath,
  });

  // Fix CJS compatibility issues introduced by ESM → CJS conversion.
  //
  // Problem 1: __filename/__dirname redeclaration
  //   ESM code creates them via `fileURLToPath(import.meta.url)`, esbuild preserves these
  //   as `const __filename = ...`, but bytenode's `compileAsModule: true` wraps code in
  //   `(function(exports, require, module, __filename, __dirname) { ... })` which already
  //   provides them. Remove the redundant declarations — CJS __filename/__dirname are correct.
  //
  // Problem 2: import.meta becomes empty object
  //   esbuild converts `import.meta` to `const import_meta = {}` in CJS, so
  //   `import_meta.url` is `undefined`. This breaks `createRequire(import.meta.url)`,
  //   `fileURLToPath(import.meta.url)`, etc. We replace the empty stub with a proper
  //   CJS-compatible definition that derives the URL from __filename.
  let cjsCode = result.code;
  cjsCode = cjsCode.replace(/^(?:const|let|var)\s+__filename\s*=\s*[^;\n]+;?\s*$/gm, "");
  cjsCode = cjsCode.replace(/^(?:const|let|var)\s+__dirname\s*=\s*[^;\n]+;?\s*$/gm, "");
  cjsCode = cjsCode.replace(
    /(?:const|var|let)\s+import_meta\s*=\s*\{\s*\};/g,
    'var import_meta = { url: require("url").pathToFileURL(__filename).href };',
  );

  fs.writeFileSync(cjsPath, cjsCode, "utf-8");
  return cjsPath;
}

/**
 * Compile a CJS file to V8 bytecode using bytenode programmatic API.
 * Returns the path to the .jsc file.
 */
async function compileToBytecode(cjsPath: string): Promise<string> {
  const jscPath = cjsPath.replace(/\.cjs$/, ".jsc");

  // bytenode.compileFile uses v8's Script to generate cached data (bytecode)
  await bytenode.compileFile({
    filename: cjsPath,
    output: jscPath,
    compileAsModule: true,
  });

  // bytenode may also produce .cjsc (appends 'c' to extension), rename if needed
  const bytenodeOutput = cjsPath + "c";
  if (!fs.existsSync(jscPath) && fs.existsSync(bytenodeOutput)) {
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
 * Generate a thin CJS loader that loads the .jsc bytecode at runtime.
 *
 * WHY CJS (not ESM)?
 * The .jsc bytecode is CJS and uses require() for all its dependencies.
 * When bytecode require()s an ESM module that transitively imports back into
 * the bytecode set, Node.js v22 detects a CJS→ESM→CJS cycle and throws
 * ERR_REQUIRE_CYCLE_MODULE. By making the loader CJS too, the entire chain
 * is CJS→CJS→CJS, which Node.js handles natively (partial exports on cycle).
 *
 * For this to work, each explicit bytecode directory (dispatch/, license/, security/)
 * gets a package.json with {"type": "commonjs"} — see writeCjsPackageJson().
 *
 * ESM code outside these directories can still `import { x } from "./gateway/file.js"`
 * because Node.js v22 supports ESM importing CJS modules seamlessly.
 */
function generateCjsLoader(originalJsPath: string, jscPath: string, exportNames: string[], jscHash: string): string {
  const jscBasename = path.basename(jscPath);

  // Use `exports.X = _mod.X` pattern — this is the only pattern that Node.js's
  // cjs-module-lexer can statically detect for ESM named import support.
  // Object.defineProperties / module.exports = {...} are NOT detectable.
  const reExportLines = exportNames
    .map((name) => `exports.${name} = _mod.${name};`)
    .join("\n");

  return `// V8 Bytecode Loader (CJS) — compiled from source, do not edit
"use strict";
const _p = require("path").join(__dirname, "./${jscBasename}");
const _h = require("crypto").createHash("sha256").update(require("fs").readFileSync(_p)).digest("hex");
if (_h !== "${jscHash}") { console.error("[integrity] bytecode tampered: " + _p); process.exit(1); }
require("bytenode");
const _mod = require("./${jscBasename}");

// Re-export all named exports.
// Pattern: exports.X = _mod.X — required for cjs-module-lexer to detect named exports,
// allowing ESM code to do: import { X } from "./this-file.js"
${reExportLines}
`;
}

/**
 * Generate an ESM-compatible loader for bytecode files in ESM directories.
 *
 * Used for individual bytecode files that live outside the explicit bytecode
 * directories (dispatch/, license/, security/). These directories do NOT have
 * a {"type": "commonjs"} package.json override, so their .js files are parsed
 * as ESM by Node.js. The loader uses `createRequire` to load the CJS bytecode.
 *
 * ESM loaders support `import { X } from "./file.js"` natively since the
 * exports are declared with `export const`.
 */
function generateEsmLoader(originalJsPath: string, jscPath: string, exportNames: string[], jscHash: string): string {
  const jscBasename = path.basename(jscPath);

  const reExportLines = exportNames
    .map((name) => `export const ${name} = _mod.${name};`)
    .join("\n");

  return `// V8 Bytecode Loader (ESM) — compiled from source, do not edit
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const _d = dirname(fileURLToPath(import.meta.url));
const _p = join(_d, "./${jscBasename}");
const _h = createHash("sha256").update(readFileSync(_p)).digest("hex");
if (_h !== "${jscHash}") { console.error("[integrity] bytecode tampered: " + _p); process.exit(1); }
const _require = createRequire(import.meta.url);
_require("bytenode");
const _mod = _require("./${jscBasename}");

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

  // First pass: read all files and detect which ones to skip.
  // Only skip truly empty type-only modules (just `export {};`).
  // Do NOT skip small files with real exports like `export { X } from "./other.js"`.
  for (const filePath of targetFiles) {
    const code = fs.readFileSync(filePath, "utf-8");
    const trimmed = code.trim();
    const skip = trimmed === "export {};" || trimmed === "";
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
 * Phase 2: Process a single file — ESM → CJS → bytecode → loader stub.
 * Uses pre-scanned export names instead of reading the file again.
 *
 * @param useCjsLoader  true for files in explicit bytecode dirs (CJS package.json),
 *                      false for individual files in ESM directories.
 */
async function processFile(
  filePath: string,
  exportNames: string[],
  useCjsLoader: boolean,
): Promise<{ success: boolean; exportCount?: number; error?: string }> {
  let cjsPath: string | null = null;

  try {
    // Step 1: Convert ESM → CJS (in-process, no subprocess)
    cjsPath = convertToCjs(filePath);

    // Step 2: Compile CJS → bytecode (in-process, no subprocess)
    const jscPath = await compileToBytecode(cjsPath);

    // Step 2.5: Compute SHA-256 hash of the .jsc for self-protection (Knife 6)
    const jscHash = crypto.createHash("sha256").update(fs.readFileSync(jscPath)).digest("hex");

    // Step 3: Replace original .js with loader stub.
    // Files in explicit bytecode dirs → CJS loader (directory has {"type": "commonjs"})
    // Files in mixed ESM dirs → ESM loader (uses createRequire to load CJS bytecode)
    const loader = useCjsLoader
      ? generateCjsLoader(filePath, jscPath, exportNames, jscHash)
      : generateEsmLoader(filePath, jscPath, exportNames, jscHash);
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

/**
 * Write {"type": "commonjs"} package.json to explicit bytecode directories.
 *
 * Handles both dist/ directories (dispatch/, license/, security/, memory/) and
 * extension directories (extensions/agent-team/, extensions/orchestrator/).
 *
 * This prevents breaking upstream ESM code in shared directories like gateway/.
 */
function writeCjsPackageJson(explicitDirs: string[], explicitExtDirs: string[]): void {
  // dist/ directories
  for (const dir of explicitDirs) {
    const dirPath = path.join(DIST_DIR, dir);
    if (!fs.existsSync(dirPath)) continue;

    const pkgPath = path.join(dirPath, "package.json");
    fs.writeFileSync(pkgPath, '{ "type": "commonjs" }\n', "utf-8");
    console.log(`   + ${path.relative(DIST_DIR, pkgPath)} (CJS override)`);

    // Node.js inherits "type" from parent package.json, so subdirectories
    // only need their own package.json if they DON'T already have one.
    // Never overwrite existing package.json — it may contain important settings.
    const subdirs = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(e => e.isDirectory());
    for (const sub of subdirs) {
      const subPkgPath = path.join(dirPath, sub.name, "package.json");
      if (!fs.existsSync(subPkgPath)) {
        fs.writeFileSync(subPkgPath, '{ "type": "commonjs" }\n', "utf-8");
      }
    }
  }

  // Extension directories (live at project root, outside dist/)
  // These have existing package.json with metadata (name, version, etc.) — merge
  // instead of overwriting, and also update "main" from .ts to .js for runtime.
  for (const extDir of explicitExtDirs) {
    const dirPath = path.join(ROOT_DIR, extDir);
    if (!fs.existsSync(dirPath)) continue;

    const pkgPath = path.join(dirPath, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        existing.type = "commonjs";
        // Update main entry from .ts to .js (bytecode loader is a .js file)
        if (typeof existing.main === "string" && existing.main.endsWith(".ts")) {
          existing.main = existing.main.replace(/\.ts$/, ".js");
        }
        fs.writeFileSync(pkgPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
      } catch {
        fs.writeFileSync(pkgPath, '{ "type": "commonjs" }\n', "utf-8");
      }
    } else {
      fs.writeFileSync(pkgPath, '{ "type": "commonjs" }\n', "utf-8");
    }
    console.log(`   + ${extDir}package.json (CJS override — extension)`);

    const subdirs = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name !== "node_modules" && e.name !== "__tests__");
    for (const sub of subdirs) {
      const subPkgPath = path.join(dirPath, sub.name, "package.json");
      if (!fs.existsSync(subPkgPath)) {
        fs.writeFileSync(subPkgPath, '{ "type": "commonjs" }\n', "utf-8");
      }
    }
  }
}

async function main(): Promise<void> {
  console.log("");
  console.log("🔒 V8 Bytecode Compilation — CN Bytecode Tier");
  console.log(`   Target: ${DIST_DIR}`);
  console.log(`   Source: config/cn-protected-files.json → cn_encryption.bytecode`);
  console.log(`   Platform: ${process.platform}-${process.arch}`);
  console.log(`   Node: ${process.version}`);
  console.log(`   Mode: in-process (esbuild API + bytenode API)`);
  console.log("");

  if (!fs.existsSync(DIST_DIR)) {
    console.error("❌ dist/ directory not found. Run build first.");
    process.exit(1);
  }

  // Resolve bytecode targets from cn-protected-files.json
  const targets = resolveEncryptionTargets(ROOT_DIR);
  const targetFiles = targets.bytecode;
  const explicitDirs = getExplicitBytecodeDirs(ROOT_DIR);
  const explicitExtDirs = getExplicitBytecodeExtensionDirs(ROOT_DIR);

  console.log(`   Explicit bytecode dirs (CJS override): ${explicitDirs.join(", ")}`);
  console.log(`   Explicit extension dirs (CJS override): ${explicitExtDirs.join(", ") || "(none)"}`);
  const cjsDirFileCount = targetFiles.filter(f => isInExplicitBytecodeDir(f, ROOT_DIR) || isInExplicitBytecodeExtensionDir(f, ROOT_DIR)).length;
  console.log(`   Individual files in ESM dirs: ${targetFiles.length - cjsDirFileCount} files (ESM loader)`);

  // Phase 0: Write {"type": "commonjs"} to explicit bytecode directories (dist/ + extensions/).
  // Individual bytecode files in mixed dirs (gateway/, agents/) use ESM loaders
  // instead — no CJS override needed, which avoids breaking upstream ESM code.
  console.log("   Phase 0: Setting up CJS module type overrides...");
  writeCjsPackageJson(explicitDirs, explicitExtDirs);
  console.log("");

  console.log(`   Found ${targetFiles.length} files to compile`);
  console.log("");

  if (targetFiles.length === 0) {
    console.error("❌ FATAL: 0 bytecode targets found!");
    console.error("   No CN files found for V8 bytecode compilation. This means");
    console.error("   core CN code would ship without bytecode protection.");
    console.error("   Check that build:cn-compile ran before this step.");
    process.exit(1);
  }

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
    // Extension files are relative to ROOT_DIR, dist files to DIST_DIR
    const isExtFile = isInExplicitBytecodeExtensionDir(file, ROOT_DIR);
    const relativePath = isExtFile ? path.relative(ROOT_DIR, file) : path.relative(DIST_DIR, file);
    const entry = prescan.get(file)!;
    const inExplicitDir = isInExplicitBytecodeDir(file, ROOT_DIR) || isExtFile;

    if (entry.skip) {
      // Small files (< 200 chars) are not worth compiling to bytecode.
      // Only convert to CJS stub if the file is in an explicit bytecode dir
      // (which has {"type": "commonjs"} package.json making ESM syntax invalid).
      // Files in ESM dirs can keep their original content.
      if (inExplicitDir && entry.code.trim() === "export {};") {
        fs.writeFileSync(file, '"use strict";\n// Type-only module (no exports)\n', "utf-8");
      }
      skipCount++;
      continue;
    }

    const result = await processFile(file, entry.exportNames, inExplicitDir);

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

  // Fail the build if ANY file failed — partial compilation is a security risk.
  // Shipping a mix of compiled and uncompiled bytecode files is worse than
  // failing the build and letting the developer investigate.
  if (errorCount > 0) {
    console.error(`❌ ${errorCount} bytecode compilation(s) failed!`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
