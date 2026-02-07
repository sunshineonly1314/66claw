#!/usr/bin/env node
/**
 * Obfuscate dist/ directory after production build
 * 
 * This script:
 * 1. Finds all .js files in dist/ (excluding test files)
 * 2. Applies JavaScript obfuscation with safe config
 * 3. Overwrites original files with obfuscated versions
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
  /tool-display\.js$/,  // Uses `import ... with { type: "json" }` syntax
];

// Critical directories to obfuscate (prioritized)
const PRIORITY_DIRS = [
  "license",
  "security",
  "gateway",
];

// Load config
async function loadConfig(): Promise<Record<string, unknown>> {
  try {
    // 使用 file:// URL 格式加载配置（Windows 兼容）
    const configUrl = `file://${CONFIG_PATH.replace(/\\/g, "/")}`;
    const config = await import(configUrl);
    return config.default || config;
  } catch (error) {
    console.error("Failed to load obfuscator config:", error instanceof Error ? error.message : error);
    console.error("Using defaults");
    return {};
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

// Obfuscate a single file
function obfuscateFile(
  filePath: string,
  config: Record<string, unknown>
): { success: boolean; error?: string } {
  try {
    const code = fs.readFileSync(filePath, "utf-8");
    
    // Skip empty files
    if (!code.trim()) {
      return { success: true };
    }
    
    // Skip very small files (likely just exports)
    if (code.length < 100) {
      return { success: true };
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

async function main(): Promise<void> {
  console.log("");
  console.log("🔐 Starting code obfuscation...");
  console.log(`   Target: ${DIST_DIR}`);
  console.log("");
  
  if (!fs.existsSync(DIST_DIR)) {
    console.error("❌ dist/ directory not found. Run build first.");
    process.exit(1);
  }
  
  const config = await loadConfig();
  const allFiles = getAllJsFiles(DIST_DIR);
  
  console.log(`   Found ${allFiles.length} JS files to process`);
  console.log("");
  
  // Sort files: priority dirs first
  const sortedFiles = allFiles.sort((a, b) => {
    const aIsPriority = PRIORITY_DIRS.some((dir) => a.includes(`${path.sep}${dir}${path.sep}`));
    const bIsPriority = PRIORITY_DIRS.some((dir) => b.includes(`${path.sep}${dir}${path.sep}`));
    if (aIsPriority && !bIsPriority) return -1;
    if (!aIsPriority && bIsPriority) return 1;
    return 0;
  });
  
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  const errors: { file: string; error: string }[] = [];
  
  for (const file of sortedFiles) {
    const relativePath = path.relative(DIST_DIR, file);
    const result = obfuscateFile(file, config);
    
    if (result.success) {
      // Check if file was actually modified (not skipped due to size)
      const code = fs.readFileSync(file, "utf-8");
      if (code.length < 100) {
        skipCount++;
      } else {
        successCount++;
        // Show progress for priority files
        if (PRIORITY_DIRS.some((dir) => relativePath.startsWith(dir + path.sep))) {
          console.log(`   ✓ ${relativePath}`);
        }
      }
    } else {
      errorCount++;
      errors.push({ file: relativePath, error: result.error || "Unknown error" });
    }
  }
  
  console.log("");
  console.log("========================================");
  console.log("✅ Obfuscation complete!");
  console.log(`   Obfuscated: ${successCount} files`);
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
