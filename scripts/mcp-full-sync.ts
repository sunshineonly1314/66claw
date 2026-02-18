#!/usr/bin/env node
/**
 * MCP Marketplace Full Sync Script
 *
 * Standalone CLI tool for daily cron on Alibaba Cloud ECS.
 * Aggregates MCP server metadata from ModelScope + Official Registry,
 * deduplicates, and writes mcp-index.json for CDN distribution.
 *
 * Usage:
 *   node --import tsx scripts/mcp-full-sync.ts [--output-dir /path]
 *
 * Environment:
 *   MODELSCOPE_API_TOKEN  — Required for ModelScope data source
 *   OUTPUT_DIR            — Output directory (fallback for --output-dir)
 *
 * Cron example (daily 3 AM):
 *   0 3 * * * cd /opt/openclawcn && \
 *     MODELSCOPE_API_TOKEN=xxx OUTPUT_DIR=/opt/mcp-data \
 *     node --import tsx scripts/mcp-full-sync.ts >> /var/log/mcp-sync.log 2>&1
 */

import { writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fetchFromModelScope } from "../src/mcp/marketplace/modelscope-source.js";
import { fetchFromOfficialRegistry } from "../src/mcp/marketplace/registry-source.js";
import { deduplicateItems } from "../src/mcp/marketplace-sync.js";
import type { McpMarketplaceItem } from "../src/mcp/marketplace/types.js";

// ============================================================================
// CLI
// ============================================================================

interface SyncArgs {
  outputDir: string;
  dryRun: boolean;
  verbose: boolean;
}

function parseArgs(): SyncArgs {
  const args = process.argv.slice(2);
  let outputDir = process.env.OUTPUT_DIR?.trim()
    || process.env.OPENCLAWCN_MCP_OUTPUT_DIR?.trim()
    || "";
  let dryRun = false;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output-dir" && args[i + 1]) {
      outputDir = args[++i];
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--verbose" || args[i] === "-v") {
      verbose = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
MCP Marketplace Full Sync

Usage:
  node --import tsx scripts/mcp-full-sync.ts [options]

Options:
  --output-dir <dir>  Output directory for mcp-index.json
  --dry-run           Fetch and merge but don't write files
  --verbose, -v       Show detailed progress
  --help, -h          Show this help

Environment:
  MODELSCOPE_API_TOKEN   ModelScope API token (required for Tier 1)
  OUTPUT_DIR             Output directory fallback
`);
      process.exit(0);
    }
  }

  if (!outputDir && !dryRun) {
    console.error("Error: --output-dir or OUTPUT_DIR environment variable is required");
    process.exit(1);
  }

  return { outputDir, dryRun, verbose };
}

// ============================================================================
// Main
// ============================================================================

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function main() {
  const config = parseArgs();
  const startTime = Date.now();

  log("=== MCP Marketplace Full Sync ===");
  log(`Output: ${config.dryRun ? "(dry-run)" : config.outputDir}`);
  log(`ModelScope token: ${process.env.MODELSCOPE_API_TOKEN ? "set" : "NOT SET"}`);

  // ── Fetch from both sources concurrently ─────────────────────

  log("Fetching from ModelScope + Official Registry...");

  const [msResult, regResult] = await Promise.allSettled([
    fetchFromModelScope(),
    fetchFromOfficialRegistry(),
  ]);

  const msItems: McpMarketplaceItem[] =
    msResult.status === "fulfilled" ? msResult.value : [];
  const regItems: McpMarketplaceItem[] =
    regResult.status === "fulfilled" ? regResult.value : [];

  if (msResult.status === "rejected") {
    log(`WARNING: ModelScope failed: ${msResult.reason}`);
  }
  if (regResult.status === "rejected") {
    log(`WARNING: Official Registry failed: ${regResult.reason}`);
  }

  log(`ModelScope: ${msItems.length} items`);
  log(`Official Registry: ${regItems.length} items`);

  // ── Merge & deduplicate ──────────────────────────────────────

  // ModelScope items first → they win on dedup (richer metadata, Chinese names)
  const merged = [...msItems, ...regItems];
  const deduped = deduplicateItems(merged);

  log(`Merged: ${merged.length} total → ${deduped.length} unique after dedup`);

  if (deduped.length === 0) {
    log("ERROR: Both sources returned 0 items. NOT overwriting existing index.");
    process.exit(1);
  }

  if (config.dryRun) {
    log(`DRY RUN: Would write ${deduped.length} items. Exiting.`);
    if (config.verbose) {
      const categories = new Map<string, number>();
      for (const item of deduped) {
        categories.set(item.category, (categories.get(item.category) || 0) + 1);
      }
      log("Categories:");
      for (const [cat, count] of [...categories.entries()].sort((a, b) => b[1] - a[1])) {
        log(`  ${cat}: ${count}`);
      }
    }
    process.exit(0);
  }

  // ── Write output files ───────────────────────────────────────

  await mkdir(config.outputDir, { recursive: true });

  // Envelope format (primary)
  const envelope = {
    version: 2,
    generatedAt: new Date().toISOString(),
    itemCount: deduped.length,
    sources: {
      modelscope: msItems.length,
      officialRegistry: regItems.length,
    },
    items: deduped,
  };

  const indexPath = join(config.outputDir, "mcp-index.json");
  await writeFile(indexPath, JSON.stringify(envelope, null, 2), "utf-8");
  log(`Wrote ${indexPath} (${deduped.length} items)`);

  // Flat array format (backward-compatible)
  const flatPath = join(config.outputDir, "mcp-index-flat.json");
  await writeFile(flatPath, JSON.stringify(deduped, null, 2), "utf-8");
  log(`Wrote ${flatPath}`);

  // Sync report (metadata about the run)
  const report = {
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    totalItems: deduped.length,
    sources: {
      modelscope: { count: msItems.length, ok: msResult.status === "fulfilled" },
      officialRegistry: { count: regItems.length, ok: regResult.status === "fulfilled" },
    },
  };
  const reportPath = join(config.outputDir, "sync-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");
  log(`Wrote ${reportPath}`);

  // ── Summary ──────────────────────────────────────────────────

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`=== Done in ${elapsed}s. ${deduped.length} MCP servers indexed. ===`);

  // Verify file was written
  const st = await stat(indexPath);
  log(`File size: ${(st.size / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(`[${new Date().toISOString()}] FATAL:`, err);
  process.exit(1);
});
