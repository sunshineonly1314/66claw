#!/usr/bin/env node
/**
 * CN-Only Selective Obfuscation
 *
 * Only obfuscates CN-written files listed in config/cn-protected-files.json.
 * Upstream (open-source) code is left unmodified — no security benefit to
 * obfuscating publicly available code, and skipping it reduces build time,
 * installer size, and runtime overhead.
 *
 * Two tiers (both use aggressive RC4 config since all targets are CN code):
 *   - bytecode tier: RC4 obfuscation (then separately compiled to .jsc)
 *   - obfuscate tier: RC4 obfuscation only
 *
 * Usage: node --import tsx scripts/obfuscate-dist.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JavaScriptObfuscator from "javascript-obfuscator";
import { resolveEncryptionTargets } from "../cn/scripts/build/resolve-cn-targets.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const CONFIG_PATH = path.join(ROOT_DIR, "cn", "scripts", "build", "obfuscate.config.js");

/**
 * Load aggressive config from obfuscate.config.js
 */
async function loadConfig(): Promise<Record<string, unknown>> {
  try {
    const configUrl = `file://${CONFIG_PATH.replace(/\\/g, "/")}`;
    const configModule = await import(configUrl);
    return configModule.aggressive || configModule.standard || configModule.default || {};
  } catch (error) {
    console.error("Failed to load obfuscator config:", error instanceof Error ? error.message : error);
    console.error("Using defaults");
    return {};
  }
}

/**
 * Obfuscate a single file in-place.
 */
function obfuscateFile(
  filePath: string,
  config: Record<string, unknown>,
): { success: boolean; error?: string } {
  try {
    const code = fs.readFileSync(filePath, "utf-8");

    // Skip empty or very small files (likely just exports)
    if (!code.trim() || code.length < 100) {
      return { success: true };
    }

    const result = JavaScriptObfuscator.obfuscate(code, config as any);
    fs.writeFileSync(filePath, result.getObfuscatedCode(), "utf-8");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(): Promise<void> {
  console.log("");
  console.log("🔐 CN-Only Selective Obfuscation");
  console.log(`   Target: CN files only (upstream code untouched)`);
  console.log(`   Config: RC4 string encryption, 75% CFG, 40% dead code`);
  console.log("");

  if (!fs.existsSync(DIST_DIR)) {
    console.error("❌ dist/ directory not found. Run build first.");
    process.exit(1);
  }

  // Resolve CN targets from cn-protected-files.json
  const targets = resolveEncryptionTargets(ROOT_DIR);
  const config = await loadConfig();

  const bytecodeFiles = targets.bytecode;
  const obfuscateFiles = targets.obfuscate;
  const totalCnFiles = bytecodeFiles.length + obfuscateFiles.length;

  console.log(`   Found ${totalCnFiles} CN files to obfuscate`);
  console.log(`     → ${bytecodeFiles.length} bytecode-tier files (will also get .jsc)`);
  console.log(`     → ${obfuscateFiles.length} obfuscate-tier files`);
  console.log(`   Upstream files: skipped (not encrypted)`);
  console.log("");

  if (totalCnFiles === 0) {
    console.error("❌ FATAL: 0 CN files found for obfuscation!");
    console.error("   The encryption pipeline found no targets. This means CN code");
    console.error("   would ship unencrypted. Check that build:cn-compile and");
    console.error("   build:cn-extensions ran before this step.");
    process.exit(1);
  }

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  const errors: { file: string; error: string }[] = [];

  // Process bytecode-tier files (aggressive obfuscation)
  if (bytecodeFiles.length > 0) {
    console.log("   --- Bytecode tier (core CN logic) ---");
    for (const file of bytecodeFiles) {
      const relativePath = path.relative(ROOT_DIR, file);
      const result = obfuscateFile(file, config);

      if (result.success) {
        const code = fs.readFileSync(file, "utf-8");
        if (code.length < 100) {
          skipCount++;
        } else {
          successCount++;
          console.log(`   ✓ [BC] ${relativePath}`);
        }
      } else {
        errorCount++;
        errors.push({ file: relativePath, error: result.error || "Unknown error" });
        console.log(`   ✗ [BC] ${relativePath}: ${result.error}`);
      }
    }
    console.log("");
  }

  // Process obfuscate-tier files (aggressive obfuscation, no bytecode)
  if (obfuscateFiles.length > 0) {
    console.log("   --- Obfuscate tier (CN extensions & config) ---");
    for (const file of obfuscateFiles) {
      const relativePath = path.relative(ROOT_DIR, file);
      const result = obfuscateFile(file, config);

      if (result.success) {
        const code = fs.readFileSync(file, "utf-8");
        if (code.length < 100) {
          skipCount++;
        } else {
          successCount++;
          console.log(`   ✓ [OB] ${relativePath}`);
        }
      } else {
        errorCount++;
        errors.push({ file: relativePath, error: result.error || "Unknown error" });
        console.log(`   ✗ [OB] ${relativePath}: ${result.error}`);
      }
    }
    console.log("");
  }

  console.log("========================================");
  console.log("✅ CN-only obfuscation complete!");
  console.log(`   Obfuscated: ${successCount} CN files`);
  console.log(`   Skipped (small): ${skipCount} files`);
  console.log(`   Upstream files: untouched`);

  if (errorCount > 0) {
    console.log(`   ⚠️ Errors: ${errorCount} files`);
    console.log("");
    console.log("   Error details:");
    for (const { file, error } of errors.slice(0, 5)) {
      console.log(`   - ${file}: ${error}`);
    }
    if (errors.length > 5) {
      console.log(`   ... and ${errors.length - 5} more`);
    }
  }

  console.log("========================================");
  console.log("");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
