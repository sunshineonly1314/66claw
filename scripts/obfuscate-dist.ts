#!/usr/bin/env node
/**
 * Obfuscate dist/ directory after production build
 *
 * Two-tier obfuscation strategy:
 * - Standard config: general application code (moderate protection)
 * - Aggressive config: critical dirs — license/, security/, gateway/, agents/, config/, commands/ (maximum protection)
 *
 * The aggressive tier uses RC4 string encryption, 90% control flow flattening,
 * heavier dead code injection, and deeper wrapper chains.
 *
 * Usage: node --import tsx scripts/obfuscate-dist.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JavaScriptObfuscator from "javascript-obfuscator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const CONFIG_PATH = path.join(__dirname, "obfuscate.config.js");

// Files/directories to skip
const SKIP_PATTERNS = [
  /\.test\.js$/,
  /\.spec\.js$/,
  /\.d\.ts$/,
  /\.map$/,
  /node_modules/,
  /\.json$/,
  /\.jsc$/,             // Skip V8 bytecode files
  /tool-display\.js$/,  // Uses `import ... with { type: "json" }` syntax
];

// Critical directories — these get aggressive obfuscation (RC4, 90% CFG)
// Includes all dirs with sensitive business logic, API keys, or auth flows
const PRIORITY_DIRS = [
  "license",
  "security",
  "gateway",
  "agents",
  "config",
  "commands",
];

/**
 * Load both standard and aggressive configs from obfuscate.config.js
 */
async function loadConfigs(): Promise<{
  standard: Record<string, unknown>;
  aggressive: Record<string, unknown>;
}> {
  try {
    // 使用 file:// URL 格式加载配置（Windows 兼容）
    const configUrl = `file://${CONFIG_PATH.replace(/\\/g, "/")}`;
    const configModule = await import(configUrl);
    return {
      standard: configModule.standard || configModule.default || {},
      aggressive: configModule.aggressive || configModule.standard || configModule.default || {},
    };
  } catch (error) {
    console.error("Failed to load obfuscator config:", error instanceof Error ? error.message : error);
    console.error("Using defaults");
    return { standard: {}, aggressive: {} };
  }
}

// Get all JS files recursively
function getAllJsFiles(dir: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...getAllJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      // Check skip patterns
      const shouldSkip = SKIP_PATTERNS.some((pattern) => pattern.test(fullPath));
      if (!shouldSkip) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

// Obfuscate a single file — returns "skipped" when file is too small
function obfuscateFile(
  filePath: string,
  config: Record<string, unknown>
): { success: boolean; skipped?: boolean; error?: string } {
  try {
    const code = fs.readFileSync(filePath, "utf-8");

    // Skip empty files
    if (!code.trim()) {
      return { success: true, skipped: true };
    }

    // Skip very small files (likely just exports)
    if (code.length < 100) {
      return { success: true, skipped: true };
    }

    const result = JavaScriptObfuscator.obfuscate(code, config as any);
    const obfuscatedCode = result.getObfuscatedCode();

    fs.writeFileSync(filePath, obfuscatedCode, "utf-8");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Batch size before forcing GC to prevent OOM on large codebases
const BATCH_SIZE = 50;

/**
 * Check if a file path belongs to a critical (priority) directory
 */
function isPriorityFile(relativePath: string): boolean {
  return PRIORITY_DIRS.some(
    (dir) => relativePath.startsWith(dir + path.sep) || relativePath.startsWith(dir + "/"),
  );
}

async function main(): Promise<void> {
  console.log("");
  console.log("🔐 Starting two-tier code obfuscation...");
  console.log(`   Target: ${DIST_DIR}`);
  console.log(`   Standard tier: general code (base64, 50% CFG, 20% dead code)`);
  console.log(`   Aggressive tier: ${PRIORITY_DIRS.join(", ")} (RC4, 90% CFG, 40% dead code)`);
  console.log("");

  if (!fs.existsSync(DIST_DIR)) {
    console.error("❌ dist/ directory not found. Run build first.");
    process.exit(1);
  }

  const configs = await loadConfigs();
  const allFiles = getAllJsFiles(DIST_DIR);

  // Separate files by tier
  const priorityFiles: string[] = [];
  const standardFiles: string[] = [];
  for (const file of allFiles) {
    const relativePath = path.relative(DIST_DIR, file);
    if (isPriorityFile(relativePath)) {
      priorityFiles.push(file);
    } else {
      standardFiles.push(file);
    }
  }

  console.log(`   Found ${allFiles.length} JS files total`);
  console.log(`     → ${priorityFiles.length} critical files (aggressive tier)`);
  console.log(`     → ${standardFiles.length} general files (standard tier)`);
  console.log("");

  let aggressiveCount = 0;
  let standardCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  const errors: { file: string; error: string }[] = [];

  // Helper: try to trigger GC every BATCH_SIZE files to prevent OOM
  const tryGC = () => {
    if (typeof globalThis.gc === "function") {
      globalThis.gc();
    }
  };

  // Process critical files first with aggressive config
  if (priorityFiles.length > 0) {
    console.log("   --- Aggressive tier (critical dirs) ---");
    for (let i = 0; i < priorityFiles.length; i++) {
      const file = priorityFiles[i];
      const relativePath = path.relative(DIST_DIR, file);
      const result = obfuscateFile(file, configs.aggressive);

      if (result.success) {
        if (result.skipped) {
          skipCount++;
        } else {
          aggressiveCount++;
          console.log(`   ✓ [AGG] ${relativePath}`);
        }
      } else {
        errorCount++;
        errors.push({ file: relativePath, error: result.error || "Unknown error" });
        console.log(`   ✗ [AGG] ${relativePath}: ${result.error}`);
      }

      if ((i + 1) % BATCH_SIZE === 0) {
        tryGC();
        console.log(`   ... ${i + 1}/${priorityFiles.length} aggressive files done`);
      }
    }
    console.log("");
  }

  // Process remaining files with standard config
  if (standardFiles.length > 0) {
    console.log("   --- Standard tier (general code) ---");
    for (let i = 0; i < standardFiles.length; i++) {
      const file = standardFiles[i];
      const relativePath = path.relative(DIST_DIR, file);
      const result = obfuscateFile(file, configs.standard);

      if (result.success) {
        if (result.skipped) {
          skipCount++;
        } else {
          standardCount++;
        }
      } else {
        errorCount++;
        errors.push({ file: relativePath, error: result.error || "Unknown error" });
      }

      if ((i + 1) % BATCH_SIZE === 0) {
        tryGC();
        console.log(`   ... ${i + 1}/${standardFiles.length} standard files done`);
      }
    }
  }

  console.log("");
  console.log("========================================");
  console.log("✅ Two-tier obfuscation complete!");
  console.log(`   Aggressive (RC4): ${aggressiveCount} files`);
  console.log(`   Standard (base64): ${standardCount} files`);
  console.log(`   Skipped (small): ${skipCount} files`);

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
