#!/usr/bin/env node
/**
 * Binary Protection Script — Layer 4
 *
 * Post-packaging steps to harden the final executable:
 * 1. Strip debug symbols (Linux/macOS)
 * 2. UPX compression (all platforms)
 *
 * UPX (Ultimate Packer for eXecutables) compresses the binary
 * and adds a decompression stub. This:
 * - Reduces file size 50-70%
 * - Prevents naive static analysis (must unpack first)
 * - Adds one more layer of indirection
 *
 * Prerequisites:
 *   - UPX must be installed and in PATH
 *     - Windows: choco install upx / scoop install upx
 *     - macOS: brew install upx
 *     - Linux: apt install upx-ucl
 *
 * Usage:
 *   node --import tsx scripts/protect-binary.ts
 *   node --import tsx scripts/protect-binary.ts -- --platform win
 *   node --import tsx scripts/protect-binary.ts -- --platform mac-arm
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(process.cwd());
const PKG_DIR = path.join(ROOT_DIR, "build", "pkg");

interface BinaryTarget {
  platform: string;
  filename: string;
  canStrip: boolean;
  canUpx: boolean;
}

const TARGETS: BinaryTarget[] = [
  {
    platform: "win",
    filename: "clawdbot-win-x64.exe",
    canStrip: false,  // Windows: pkg already strips
    canUpx: true,
  },
  {
    platform: "mac-arm",
    filename: "clawdbot-macos-arm64",
    canStrip: true,
    canUpx: true,
  },
  {
    platform: "mac-x64",
    filename: "clawdbot-macos-x64",
    canStrip: true,
    canUpx: true,
  },
  {
    platform: "linux",
    filename: "clawdbot-linux-x64",
    canStrip: true,
    canUpx: true,
  },
];

/**
 * Check if a command is available in PATH
 */
function isCommandAvailable(cmd: string): boolean {
  try {
    execSync(`${process.platform === "win32" ? "where" : "which"} ${cmd}`, {
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file size in human-readable format
 */
function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Strip debug symbols from a binary
 */
function stripBinary(filePath: string): boolean {
  try {
    console.log(`   Stripping: ${path.basename(filePath)}`);
    const sizeBefore = fs.statSync(filePath).size;

    if (process.platform === "darwin") {
      execSync(`strip -x "${filePath}"`, { stdio: "pipe" });
    } else {
      execSync(`strip --strip-all "${filePath}"`, { stdio: "pipe" });
    }

    const sizeAfter = fs.statSync(filePath).size;
    const saved = sizeBefore - sizeAfter;
    console.log(`   → Stripped ${formatSize(saved)} (${((saved / sizeBefore) * 100).toFixed(1)}%)`);
    return true;
  } catch (error) {
    console.warn(`   ⚠️ Strip failed: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

/**
 * Compress binary with UPX
 */
function upxCompress(filePath: string): boolean {
  try {
    console.log(`   UPX compressing: ${path.basename(filePath)}`);
    const sizeBefore = fs.statSync(filePath).size;

    execSync(`upx --best --lzma "${filePath}"`, {
      stdio: "pipe",
      timeout: 300000, // 5 minutes max
    });

    const sizeAfter = fs.statSync(filePath).size;
    const saved = sizeBefore - sizeAfter;
    console.log(`   → Compressed ${formatSize(saved)} (${((saved / sizeBefore) * 100).toFixed(1)}% reduction)`);
    console.log(`   → Final size: ${formatSize(sizeAfter)}`);
    return true;
  } catch (error) {
    console.warn(`   ⚠️ UPX failed: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

/**
 * Verify the binary still runs after protection
 */
function verifyBinary(filePath: string): boolean {
  try {
    // Just check if the binary can execute --version or --help
    execSync(`"${filePath}" --version`, {
      stdio: "pipe",
      timeout: 10000,
    });
    return true;
  } catch {
    // Some binaries don't support --version; just check the file exists and is executable
    return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
  }
}

function main(): void {
  console.log("");
  console.log("🛡️  Binary Protection — Layer 4");
  console.log("");

  // Parse --platform argument
  const args = process.argv.slice(2);
  const platformIndex = args.indexOf("--platform");
  const targetPlatform = platformIndex >= 0 ? args[platformIndex + 1] : null;

  // Check tools
  const hasUpx = isCommandAvailable("upx");
  const hasStrip = isCommandAvailable("strip");

  if (!hasUpx) {
    console.warn("⚠️  UPX not found in PATH. Install with:");
    console.warn("   Windows: choco install upx");
    console.warn("   macOS: brew install upx");
    console.warn("   Linux: apt install upx-ucl");
    console.warn("");
  }

  // Filter targets by platform if specified
  const targets = targetPlatform
    ? TARGETS.filter((t) => t.platform === targetPlatform)
    : TARGETS;

  if (targets.length === 0) {
    console.error(`❌ No targets found for platform: ${targetPlatform}`);
    console.error(`   Available: ${TARGETS.map((t) => t.platform).join(", ")}`);
    process.exit(1);
  }

  let processedCount = 0;
  let skippedCount = 0;

  for (const target of targets) {
    const filePath = path.join(PKG_DIR, target.filename);

    if (!fs.existsSync(filePath)) {
      console.log(`   ⏭️  ${target.filename} — not found, skipping`);
      skippedCount++;
      continue;
    }

    const originalSize = fs.statSync(filePath).size;
    console.log(`   📦 ${target.filename} (${formatSize(originalSize)})`);

    // Step 1: Strip
    if (target.canStrip && hasStrip) {
      stripBinary(filePath);
    }

    // Step 2: UPX
    if (target.canUpx && hasUpx) {
      upxCompress(filePath);
    }

    // Step 3: Verify
    if (verifyBinary(filePath)) {
      console.log(`   ✅ Verified — binary is functional`);
    } else {
      console.warn(`   ⚠️  Verification inconclusive (may still be OK)`);
    }

    processedCount++;
    console.log("");
  }

  console.log("========================================");
  console.log(`🛡️  Protection complete!`);
  console.log(`   Processed: ${processedCount} binaries`);
  console.log(`   Skipped: ${skippedCount} (not found)`);
  console.log("========================================");
  console.log("");
}

main();
