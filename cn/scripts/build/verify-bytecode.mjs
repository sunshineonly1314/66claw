#!/usr/bin/env node
/**
 * Quick Bytecode Verification Script
 *
 * Simulates the runtime environment: uses the CURRENT Node.js (should be portable Node v22)
 * to load .jsc files just like the installed app would.
 *
 * Usage:
 *   node scripts/verify-bytecode.mjs                    # test all critical dirs
 *   node scripts/verify-bytecode.mjs dist/gateway/protocol/client-info.js  # test one file
 *   node scripts/verify-bytecode.mjs --loader           # test via .js CJS loaders (runtime simulation)
 *
 * This replaces the 15-minute full build cycle with a ~5 second verification loop:
 *   1. Edit compile-bytecode.ts
 *   2. Run:  node-portable/node.exe --import tsx scripts/compile-bytecode.ts
 *   3. Run:  node-portable/node.exe scripts/verify-bytecode.mjs
 *   4. See results instantly
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const CRITICAL_DIRS = ["license", "security", "gateway"];

// Register .jsc support
require("bytenode");

function findJscFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...findJscFiles(full));
    else if (e.name.endsWith(".jsc")) files.push(full);
  }
  return files;
}

// Parse args
const args = process.argv.slice(2);
const loaderMode = args.includes("--loader");
const fileArg = args.find(a => !a.startsWith("--"));

// Determine which files to test
let targets;
if (fileArg) {
  // Single file mode
  const jsPath = path.resolve(fileArg);
  const jscPath = jsPath.replace(/\.js$/, ".jsc");
  if (!fs.existsSync(jscPath)) {
    console.error(`Not found: ${jscPath}`);
    process.exit(1);
  }
  targets = [jscPath];
} else {
  // All critical dirs
  targets = [];
  for (const dir of CRITICAL_DIRS) {
    targets.push(...findJscFiles(path.join(DIST, dir)));
  }
}

const mode = loaderMode ? "CJS loader (.js)" : "direct bytecode (.jsc)";
console.log(`\nBytecode Verification — Node ${process.version} (V8 ${process.versions.v8})`);
console.log(`Mode: ${mode}`);
console.log(`Testing ${targets.length} .jsc files...\n`);

let pass = 0;
let fail = 0;
const errors = [];

for (const jscPath of targets) {
  const rel = path.relative(DIST, jscPath);
  try {
    if (loaderMode) {
      // Test via the .js CJS loader stub — this is what actually happens at runtime.
      // The .js file require()s bytenode then require()s the .jsc file.
      const jsPath = jscPath.replace(/\.jsc$/, ".js");
      if (!fs.existsSync(jsPath)) {
        throw new Error(`Loader not found: ${jsPath}`);
      }
      const mod = require(jsPath);
      const exportCount = Object.keys(mod).length;
      pass++;
      if (pass <= 5) {
        console.log(`  OK  ${rel} (${exportCount} exports via loader)`);
      }
    } else {
      // Direct bytecode loading — tests that the .jsc binary itself is valid
      const mod = require(jscPath);
      const exportCount = Object.keys(mod).length;
      pass++;
      if (pass <= 5) {
        console.log(`  OK  ${rel} (${exportCount} exports)`);
      }
    }
  } catch (e) {
    fail++;
    const shortErr = e.message.split("\n")[0];
    errors.push({ file: rel, error: shortErr });
    console.log(`  FAIL ${rel}: ${shortErr}`);
  }
}

if (pass > 5) {
  console.log(`  ... and ${pass - 5} more OK`);
}

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${pass} passed, ${fail} failed (of ${targets.length})`);

if (fail > 0) {
  console.log(`\nFailed files:`);
  for (const { file, error } of errors.slice(0, 20)) {
    console.log(`  ${file}: ${error}`);
  }
  if (errors.length > 20) console.log(`  ... and ${errors.length - 20} more`);
  process.exit(1);
} else {
  console.log("All bytecode loads correctly!");
  process.exit(0);
}
