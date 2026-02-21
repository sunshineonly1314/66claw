#!/usr/bin/env node
/**
 * CN UI Post-Build Obfuscation
 *
 * Obfuscates Vite-built UI bundles in dist/control-ui/assets/.
 * All UI code is CN-original, so every .js file in the bundle is a target.
 *
 * Uses a lighter obfuscation config than the backend (no dead code injection,
 * lower thresholds) because:
 *   - Browser JS runs in a single thread — heavy obfuscation causes UI jank
 *   - Vite already minifies + mangles all variable names
 *   - The main goal is string encryption (API endpoints, route names, i18n keys)
 *
 * Usage: node --import tsx cn/scripts/build/obfuscate-ui.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "../../..");
const UI_DIST = path.join(ROOT_DIR, "dist", "control-ui", "assets");

async function main(): Promise<void> {
  console.log("");
  console.log("🔐 UI Post-Build Obfuscation");
  console.log(`   Target: ${path.relative(ROOT_DIR, UI_DIST)}`);
  console.log("");

  if (!fs.existsSync(UI_DIST)) {
    console.log("   ⚠ dist/control-ui/assets/ not found, skipping UI obfuscation.");
    console.log("   (UI may not have been built yet — this is OK during backend-only builds)");
    return;
  }

  // Find all .js files in assets/
  const jsFiles = fs.readdirSync(UI_DIST)
    .filter((f) => f.endsWith(".js"))
    .map((f) => path.join(UI_DIST, f));

  if (jsFiles.length === 0) {
    console.log("   No .js files found in UI assets.");
    return;
  }

  console.log(`   Found ${jsFiles.length} JS bundle(s) to obfuscate`);

  const { default: JavaScriptObfuscator } = await import("javascript-obfuscator");

  // Lighter config for browser bundles — string encryption + control flow
  // No dead code injection (bloats bundle, slows UI)
  const config = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.3,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: "hexadecimal" as const,
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 5,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.5,
    stringArrayEncoding: ["rc4" as const],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 1,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 2,
    stringArrayWrappersType: "variable" as const,
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false,
  };

  let successCount = 0;
  let errorCount = 0;

  for (const file of jsFiles) {
    const filename = path.basename(file);
    const code = fs.readFileSync(file, "utf-8");

    // Skip tiny files (< 500 chars — likely just re-exports or stubs)
    if (code.length < 500) {
      console.log(`   ⊘ ${filename} (${code.length} chars, too small — skipped)`);
      continue;
    }

    try {
      const sizeBefore = code.length;
      const result = JavaScriptObfuscator.obfuscate(code, config);
      const obfuscated = result.getObfuscatedCode();
      fs.writeFileSync(file, obfuscated, "utf-8");
      const sizeAfter = obfuscated.length;
      const ratio = ((sizeAfter / sizeBefore) * 100).toFixed(0);
      console.log(`   ✓ ${filename} (${(sizeBefore / 1024).toFixed(0)}KB → ${(sizeAfter / 1024).toFixed(0)}KB, ${ratio}%)`);
      successCount++;
    } catch (err) {
      console.log(`   ✗ ${filename}: ${err instanceof Error ? err.message : err}`);
      errorCount++;
    }
  }

  console.log("");
  console.log("========================================");
  if (errorCount === 0) {
    console.log(`✅ UI obfuscation complete! ${successCount} bundle(s) protected.`);
  } else {
    console.log(`⚠️ UI obfuscation: ${successCount} OK, ${errorCount} failed.`);
  }
  console.log("========================================");
  console.log("");

  if (errorCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
