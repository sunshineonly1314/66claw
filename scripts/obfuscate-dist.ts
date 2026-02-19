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
 * Memory-safe: processes files in batches via child_process.fork() to prevent
 * OOM from javascript-obfuscator's internal AST cache accumulation.
 * Each worker subprocess handles BATCH_SIZE files then exits, releasing all
 * heap memory. This keeps peak RSS under ~2GB regardless of total file count.
 *
 * Usage: node --import tsx scripts/obfuscate-dist.ts
 * Env:   OBFUSCATE_BATCH_SIZE=30  (files per worker, default 30)
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveEncryptionTargets } from "../cn/scripts/build/resolve-cn-targets.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const CONFIG_PATH = path.join(ROOT_DIR, "cn", "scripts", "build", "obfuscate.config.js");

const BATCH_SIZE = parseInt(process.env.OBFUSCATE_BATCH_SIZE || "30", 10);

// ─── Worker mode ───────────────────────────────────────────────────────────
// When called with --worker <json-file>, obfuscate the listed files and write
// results to stdout as JSON. Then exit — releasing all obfuscator heap.

if (process.argv.includes("--worker")) {
  const jsonFile = process.argv[process.argv.indexOf("--worker") + 1];
  const payload = JSON.parse(fs.readFileSync(jsonFile, "utf-8")) as {
    files: string[];
    configPath: string;
  };

  (async () => {
    // Load config — try multiple strategies since ESM dynamic import is fragile
    // across different Node.js versions, package.json "type" contexts, and tsx loaders.
    let config: Record<string, unknown> = {};
    try {
      const configUrl = `file://${payload.configPath.replace(/\\/g, "/")}`;
      const m = await import(configUrl);
      config = m.aggressive || m.standard || m.default || {};
    } catch {
      // Fallback: read the .js file and eval the exported object directly.
      // obfuscate.config.js uses `export const aggressive = { ... }` — extract via regex.
      try {
        const configSrc = fs.readFileSync(payload.configPath, "utf-8");
        const aggressiveMatch = configSrc.match(
          /export\s+const\s+aggressive\s*=\s*(\{[\s\S]*?\n\});/,
        );
        if (aggressiveMatch) {
          config = new Function(`return ${aggressiveMatch[1]}`)();
        }
      } catch {
        // use built-in defaults as last resort
      }
    }

    const { default: JavaScriptObfuscator } = await import("javascript-obfuscator");

    const results: Array<{
      file: string;
      success: boolean;
      error?: string;
      skipped?: boolean;
    }> = [];

    for (const file of payload.files) {
      try {
        const code = fs.readFileSync(file, "utf-8");
        if (!code.trim() || code.length < 100) {
          results.push({ file, success: true, skipped: true });
          continue;
        }
        const result = JavaScriptObfuscator.obfuscate(code, config as any);
        fs.writeFileSync(file, result.getObfuscatedCode(), "utf-8");
        results.push({ file, success: true });
      } catch (error) {
        results.push({
          file,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    process.stdout.write(JSON.stringify(results));
  })().then(
    () => process.exit(0),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
} else {
  // ─── Orchestrator mode ──────────────────────────────────────────────────
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Spawn a child worker that obfuscates `files` then exits.
 * Uses execFileSync so the orchestrator blocks per-batch (simple, predictable).
 */
function runBatch(
  files: string[],
  nodeBin: string,
): Array<{ file: string; success: boolean; error?: string; skipped?: boolean }> {
  // Write payload to a temp JSON file (avoids shell arg-length limits)
  const tmpFile = path.join(
    ROOT_DIR,
    `.obfuscate-batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`,
  );
  fs.writeFileSync(
    tmpFile,
    JSON.stringify({ files, configPath: CONFIG_PATH }),
  );

  try {
    const stdout = execFileSync(
      nodeBin,
      ["--import", "tsx", "--max-old-space-size=4096", __filename, "--worker", tmpFile],
      {
        cwd: ROOT_DIR,
        stdio: ["ignore", "pipe", "inherit"],
        maxBuffer: 50 * 1024 * 1024,
        timeout: 10 * 60 * 1000, // 10 min per batch
        env: { ...process.env, NODE_OPTIONS: "" }, // clear parent NODE_OPTIONS
      },
    );
    return JSON.parse(stdout.toString("utf-8"));
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // ignore
    }
  }
}

async function main(): Promise<void> {
  console.log("");
  console.log("🔐 CN-Only Selective Obfuscation");
  console.log(`   Target: CN files only (upstream code untouched)`);
  console.log(`   Config: RC4 string encryption, 75% CFG, 40% dead code`);
  console.log(`   Batch size: ${BATCH_SIZE} files per worker (subprocess isolation)`);
  console.log("");

  if (!fs.existsSync(DIST_DIR)) {
    console.error("❌ dist/ directory not found. Run build first.");
    process.exit(1);
  }

  // Resolve CN targets from cn-protected-files.json
  const targets = resolveEncryptionTargets(ROOT_DIR);

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

  // Detect node binary path (for spawning workers)
  const nodeBin = process.execPath;

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  const errors: { file: string; error: string }[] = [];

  /**
   * Process a list of files in batches through worker subprocesses.
   */
  function processTier(files: string[], tierLabel: string, tierTag: string): void {
    if (files.length === 0) return;

    console.log(`   --- ${tierLabel} ---`);
    const totalBatches = Math.ceil(files.length / BATCH_SIZE);

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      if (totalBatches > 1) {
        console.log(`   [batch ${batchNum}/${totalBatches}, ${batch.length} files]`);
      }

      try {
        const results = runBatch(batch, nodeBin);
        for (const r of results) {
          const relativePath = path.relative(ROOT_DIR, r.file);
          if (r.success) {
            if (r.skipped) {
              skipCount++;
            } else {
              successCount++;
              console.log(`   ✓ [${tierTag}] ${relativePath}`);
            }
          } else {
            errorCount++;
            errors.push({ file: relativePath, error: r.error || "Unknown error" });
            console.log(`   ✗ [${tierTag}] ${relativePath}: ${r.error}`);
          }
        }
      } catch (batchError) {
        console.log(`   ✗ [${tierTag}] batch ${batchNum} worker crashed: ${batchError}`);
        for (const file of batch) {
          const relativePath = path.relative(ROOT_DIR, file);
          errorCount++;
          errors.push({ file: relativePath, error: `Worker crash: ${batchError}` });
        }
      }
    }
    console.log("");
  }

  // Process both tiers
  processTier(bytecodeFiles, "Bytecode tier (core CN logic)", "BC");
  processTier(obfuscateFiles, "Obfuscate tier (CN extensions & config)", "OB");

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
