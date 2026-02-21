#!/usr/bin/env node
/**
 * CN Extensions Pre-Compiler
 *
 * Compiles CN extension .ts files to .js using esbuild transformSync.
 * Produces clean, unobfuscated JS that can be verified against the TS source.
 *
 * Reads cn_extension_build.directories from cn-protected-files.json
 * to determine which extension directories to compile.
 *
 * In production builds, the compiled .js files are what the runtime loads.
 * In development, jiti loads .ts files directly (no compilation needed).
 *
 * Usage: node --import tsx cn/scripts/build/compile-extensions.ts
 *        node --import tsx cn/scripts/build/compile-extensions.ts --verify
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { transformSync } from "esbuild";

const ROOT_DIR = path.resolve(process.cwd());
const VERIFY_MODE = process.argv.includes("--verify");

const SKIP_PATTERNS = [
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /\.e2e\.ts$/,
  /test-helpers\./,
  /\.d\.ts$/,
];

// ── Config loading ──────────────────────────────────────────────────────────

interface CnExtensionBuildConfig {
  directories: string[];
}

interface CnProtectedConfig {
  cn_extension_build?: CnExtensionBuildConfig;
}

function loadExtensionBuildConfig(rootDir: string): string[] {
  const configPath = path.join(rootDir, "config", "cn-protected-files.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`CN config not found: ${configPath}`);
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  const config: CnProtectedConfig = JSON.parse(raw);

  if (!config.cn_extension_build?.directories?.length) {
    return [];
  }

  // Validate: all directories must start with "extensions/" and end with "/"
  for (const dir of config.cn_extension_build.directories) {
    if (!dir.startsWith("extensions/") || !dir.endsWith("/")) {
      throw new Error(
        `cn_extension_build directory "${dir}" must start with "extensions/" and end with "/"`,
      );
    }
  }

  return config.cn_extension_build.directories;
}

// ── File discovery ──────────────────────────────────────────────────────────

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

// ── Compilation ─────────────────────────────────────────────────────────────

/**
 * Compile a single .ts file to .js using esbuild transformSync.
 * Returns the compiled code string for hash verification.
 */
function compileFile(
  tsPath: string,
  writeOutput: boolean,
): { success: boolean; code?: string; error?: string } {
  try {
    const code = fs.readFileSync(tsPath, "utf-8");
    const result = transformSync(code, {
      loader: "ts",
      format: "esm",
      platform: "node",
      target: "es2023",
      sourcefile: tsPath,
    });
    if (writeOutput) {
      const jsPath = tsPath.replace(/\.ts$/, ".js");
      fs.writeFileSync(jsPath, result.code, "utf-8");
    }
    return { success: true, code: result.code };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

// ── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  console.log("");
  console.log(VERIFY_MODE ? "🔍 CN Extensions Build Verification" : "📦 CN Extensions Pre-Compiler");
  console.log(`   Root: ${ROOT_DIR}`);
  console.log("");

  const extDirs = loadExtensionBuildConfig(ROOT_DIR);

  if (extDirs.length === 0) {
    console.log("   No extension directories configured in cn_extension_build.");
    return;
  }

  console.log(`   Extension directories: ${extDirs.join(", ")}`);
  console.log("");

  let totalFiles = 0;
  let successCount = 0;
  let errorCount = 0;
  let mismatchCount = 0;
  const errors: { file: string; error: string }[] = [];
  const hashes: { file: string; sha256: string }[] = [];

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
      const relativePath = path.relative(ROOT_DIR, tsFile).replace(/\\/g, "/");

      if (VERIFY_MODE) {
        // Compile in-memory, compare with existing .js file
        const result = compileFile(tsFile, false);
        if (!result.success) {
          errorCount++;
          errors.push({ file: relativePath, error: result.error || "Compile failed" });
          console.log(`   ✗ ${relativePath}: ${result.error}`);
          continue;
        }

        const jsPath = tsFile.replace(/\.ts$/, ".js");
        if (!fs.existsSync(jsPath)) {
          errorCount++;
          errors.push({ file: relativePath, error: "Missing .js file (not compiled)" });
          console.log(`   ✗ ${relativePath}: missing .js`);
          continue;
        }

        const existingJs = fs.readFileSync(jsPath, "utf-8");
        const expectedHash = sha256(result.code!);
        const actualHash = sha256(existingJs);

        if (expectedHash === actualHash) {
          successCount++;
          hashes.push({ file: relativePath.replace(/\.ts$/, ".js"), sha256: expectedHash });
          console.log(`   ✓ ${relativePath} (${expectedHash.slice(0, 12)}…)`);
        } else {
          mismatchCount++;
          errors.push({ file: relativePath, error: `Hash mismatch: expected ${expectedHash.slice(0, 12)}…, got ${actualHash.slice(0, 12)}…` });
          console.log(`   ✗ ${relativePath}: HASH MISMATCH`);
          console.log(`     Expected: ${expectedHash}`);
          console.log(`     Actual:   ${actualHash}`);
        }
      } else {
        // Normal compile mode — write .js files
        const result = compileFile(tsFile, true);
        if (result.success) {
          successCount++;
          const hash = sha256(result.code!);
          hashes.push({ file: relativePath.replace(/\.ts$/, ".js"), sha256: hash });
          console.log(`   ✓ ${relativePath}`);
        } else {
          errorCount++;
          errors.push({ file: relativePath, error: result.error || "Unknown" });
          console.log(`   ✗ ${relativePath}: ${result.error}`);
        }
      }
    }
    console.log("");
  }

  // Write manifest with hashes (for CI artifact verification)
  if (!VERIFY_MODE && hashes.length > 0) {
    const manifestPath = path.join(ROOT_DIR, "config", "extension-build-manifest.json");
    const filesMap = Object.fromEntries(
      hashes.sort((a, b) => a.file.localeCompare(b.file)).map((h) => [h.file, h.sha256]),
    );

    // Sign the manifest if OPENCLAWCN_EXTENSION_SIGNING_KEY is available (CI only)
    let signature: string | undefined;
    const signingKeyB64 = process.env.OPENCLAWCN_EXTENSION_SIGNING_KEY;
    if (signingKeyB64) {
      try {
        const canonicalPayload = Object.keys(filesMap)
          .sort()
          .map((k) => `${k}:${filesMap[k]}`)
          .join("\n");
        const privateKeyDer = Buffer.from(signingKeyB64, "base64");
        const privateKey = crypto.createPrivateKey({
          key: privateKeyDer,
          format: "der",
          type: "pkcs8",
        });
        signature = crypto.sign(null, Buffer.from(canonicalPayload, "utf-8"), privateKey).toString("base64");
        console.log(`🔐 Manifest signed with Ed25519 key`);
      } catch (err) {
        console.warn(`⚠️ Failed to sign manifest: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      console.log(`   (No signing key — manifest will be unsigned. Set OPENCLAWCN_EXTENSION_SIGNING_KEY in CI.)`);
    }

    const manifest = {
      $comment: "Auto-generated by compile-extensions.ts. SHA256 hashes of compiled extension .js files for build reproducibility verification.",
      generatedAt: new Date().toISOString(),
      esbuildTarget: "es2023",
      files: filesMap,
      ...(signature ? { signature } : {}),
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
    console.log(`📋 Build manifest written: ${path.relative(ROOT_DIR, manifestPath)}`);
  }

  console.log("========================================");
  if (VERIFY_MODE) {
    console.log(`🔍 Verification: ${successCount} matched, ${mismatchCount} mismatched, ${errorCount} errors`);
    if (mismatchCount > 0 || errorCount > 0) {
      console.log("");
      console.log("❌ VERIFICATION FAILED — compiled JS does not match TS source");
      for (const err of errors) {
        console.log(`   ${err.file}: ${err.error}`);
      }
      process.exit(1);
    }
    console.log("✅ All extension JS files match TS source");
  } else {
    console.log(`✅ Extensions compiled: ${successCount}/${totalFiles}`);
    if (errorCount > 0) {
      console.log(`   ⚠️ Errors: ${errorCount}`);
      for (const err of errors) {
        console.log(`     ${err.file}: ${err.error}`);
      }
      process.exit(1);
    }
  }

  console.log("");
}

main();
