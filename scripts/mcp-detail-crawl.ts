#!/usr/bin/env node
/**
 * MCP Marketplace Detail Crawl Script
 *
 * Fetches install info (server_config, env_schema, is_hosted) for all ModelScope
 * MCP servers via their REST detail API:
 *   GET https://modelscope.cn/openapi/v1/mcp/servers/{id}
 *
 * Then merges the install info into the existing mcp-index-enhanced.json.
 *
 * The REST detail API returns server_config which contains command/args/env —
 * this is the key data missing from the bulk search results.
 *
 * Usage:
 *   node --import tsx scripts/mcp-detail-crawl.ts [options]
 *
 * Options:
 *   --input <file>      Input JSON file (default: data/mcp-index-enhanced.json)
 *   --output <file>     Output JSON file (default: data/mcp-index-enhanced.json, overwrites)
 *   --limit <n>         Max items to crawl (for testing)
 *   --concurrency <n>   Parallel requests (default: 5)
 *   --delay <ms>        Delay between batches (default: 500)
 *   --resume            Resume from last checkpoint
 *   --dry-run           Crawl but don't write output
 *   --verbose, -v       Show detailed progress
 *   --hosted-only       Only crawl is_hosted=true items (faster, ~1189 items)
 *
 * Environment:
 *   MODELSCOPE_API_TOKEN  — Optional, may improve rate limits
 *
 * Output: Merges into existing enhanced JSON, adding/updating:
 *   - npmPackage, pypiPackage (extracted from server_config)
 *   - serverConfig (raw MCP server config for direct use)
 *   - envSchema (required environment variables)
 *   - isHosted, isVerified
 *   - sourceUrl (from detail)
 *   - logoUrl
 *   - viewCount, githubStars
 *
 * Designed to run on ECS. ~1200 hosted items takes ~10 min, all 7900 takes ~1.5h.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

// ============================================================================
// Types
// ============================================================================

interface DetailResult {
  serverId: string;
  /** Raw detail from API */
  data: ModelScopeDetail | null;
  error?: string;
}

interface ModelScopeDetail {
  id: string;
  name: string;
  chinese_name?: string;
  description?: string;
  author?: string;
  publisher?: string;
  is_hosted?: boolean;
  is_verified?: boolean;
  source_url?: string;
  logo_url?: string;
  view_count?: number;
  github_stars?: number;
  tags?: string[];
  categories?: string[];
  readme?: string;
  env_schema?: {
    properties?: Record<string, { description?: string; type?: string }>;
    required?: string[];
  };
  /** MCP server configuration — THE KEY FIELD for install info */
  server_config?: Array<{
    mcpServers?: Record<
      string,
      {
        command?: string;
        args?: string[];
        env?: Record<string, string>;
        url?: string;
      }
    >;
  }>;
  operational_urls?: string[];
  locales?: Record<string, { name?: string; description?: string; readme?: string }>;
}

interface CrawlConfig {
  inputFile: string;
  outputFile: string;
  limit: number;
  concurrency: number;
  delayMs: number;
  resume: boolean;
  dryRun: boolean;
  verbose: boolean;
  hostedOnly: boolean;
}

interface CheckpointData {
  completedIds: string[];
  results: Record<string, ExtractedInstallInfo>;
  startedAt: string;
  lastUpdated: string;
}

interface ExtractedInstallInfo {
  npmPackage?: string;
  pypiPackage?: string;
  sseUrl?: string;
  serverConfig?: Record<string, unknown>;
  envSchema?: Record<string, unknown>;
  envRequired?: string[];
  isHosted?: boolean;
  isVerified?: boolean;
  sourceUrl?: string;
  logoUrl?: string;
  viewCount?: number;
  githubStars?: number;
  installCommand?: string;
  installArgs?: string[];
  installTransport?: "stdio" | "sse";
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(): CrawlConfig {
  const args = process.argv.slice(2);
  const config: CrawlConfig = {
    inputFile: "data/mcp-index-enhanced.json",
    outputFile: "data/mcp-index-enhanced.json",
    limit: 0,
    concurrency: 5,
    delayMs: 500,
    resume: false,
    dryRun: false,
    verbose: false,
    hostedOnly: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--input":
        config.inputFile = args[++i];
        break;
      case "--output":
        config.outputFile = args[++i];
        break;
      case "--limit":
        config.limit = parseInt(args[++i], 10);
        break;
      case "--concurrency":
        config.concurrency = parseInt(args[++i], 10);
        break;
      case "--delay":
        config.delayMs = parseInt(args[++i], 10);
        break;
      case "--resume":
        config.resume = true;
        break;
      case "--dry-run":
        config.dryRun = true;
        break;
      case "--verbose":
      case "-v":
        config.verbose = true;
        break;
      case "--hosted-only":
        config.hostedOnly = true;
        break;
      case "--help":
      case "-h":
        console.log(`
MCP Detail Crawl — Fetch install info from ModelScope REST API

Usage:
  node --import tsx scripts/mcp-detail-crawl.ts [options]

Options:
  --input <file>      Input JSON (default: data/mcp-index-enhanced.json)
  --output <file>     Output JSON (default: same as input, overwrites)
  --limit <n>         Max items to crawl (0 = all)
  --concurrency <n>   Parallel requests (default: 5)
  --delay <ms>        Delay between batches (default: 500)
  --resume            Resume from checkpoint file
  --dry-run           Crawl but don't write
  --verbose, -v       Detailed progress
  --hosted-only       Only crawl is_hosted=true items (~1189)
  --help, -h          Show this help
`);
        process.exit(0);
    }
  }

  return config;
}

// ============================================================================
// ModelScope REST Detail API
// ============================================================================

const MS_API_BASE = "https://modelscope.cn/openapi/v1/mcp/servers";
const MS_TOKEN = process.env.MODELSCOPE_API_TOKEN?.trim() || "";

async function fetchDetail(serverId: string): Promise<DetailResult> {
  const url = `${MS_API_BASE}/${encodeURIComponent(serverId)}`;
  const headers: Record<string, string> = {
    "User-Agent": "OpenClawCN-MCP-DetailCrawl/1.0",
  };
  if (MS_TOKEN) headers["Authorization"] = `Bearer ${MS_TOKEN}`;

  try {
    const resp = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok) {
      return { serverId, data: null, error: `HTTP ${resp.status}` };
    }

    const json = (await resp.json()) as { data?: ModelScopeDetail };
    return { serverId, data: json.data || null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { serverId, data: null, error: msg };
  }
}

// ============================================================================
// Extract install info from detail
// ============================================================================

function extractInstallInfo(detail: ModelScopeDetail): ExtractedInstallInfo {
  const info: ExtractedInstallInfo = {
    isHosted: detail.is_hosted,
    isVerified: detail.is_verified,
    sourceUrl: detail.source_url,
    logoUrl: detail.logo_url,
    viewCount: detail.view_count,
    githubStars: detail.github_stars,
  };

  // Extract env schema
  if (detail.env_schema?.properties) {
    info.envSchema = detail.env_schema.properties;
    info.envRequired = detail.env_schema.required;
  }

  // Extract install info from server_config
  if (detail.server_config && detail.server_config.length > 0) {
    const firstConfig = detail.server_config[0];
    if (firstConfig.mcpServers) {
      const serverEntries = Object.entries(firstConfig.mcpServers);
      if (serverEntries.length > 0) {
        const [_name, serverDef] = serverEntries[0];
        info.serverConfig = serverDef as Record<string, unknown>;

        // Extract command/args
        if (serverDef.command) {
          info.installCommand = serverDef.command;
          info.installArgs = serverDef.args;

          // Determine transport type
          if (serverDef.url) {
            info.installTransport = "sse";
            info.sseUrl = serverDef.url;
          } else {
            info.installTransport = "stdio";
          }

          // Extract npm/pypi package from args
          if (serverDef.command === "npx" && serverDef.args) {
            // npx -y @scope/package or npx @scope/package
            const pkgArg = serverDef.args.find(
              (a) => !a.startsWith("-") && (a.includes("/") || a.startsWith("@") || !a.startsWith("-")),
            );
            if (pkgArg) info.npmPackage = pkgArg;
          } else if (serverDef.command === "uvx" && serverDef.args) {
            // uvx package-name
            const pkgArg = serverDef.args.find((a) => !a.startsWith("-"));
            if (pkgArg) info.pypiPackage = pkgArg;
          } else if (serverDef.command === "python" && serverDef.args) {
            // python -m package_name
            const mIdx = serverDef.args.indexOf("-m");
            if (mIdx >= 0 && serverDef.args[mIdx + 1]) {
              info.pypiPackage = serverDef.args[mIdx + 1];
            }
          } else if (serverDef.command === "node" && serverDef.args) {
            // node path/to/server.js — less useful but still info
            const jsArg = serverDef.args.find((a) => a.endsWith(".js") || a.endsWith(".mjs"));
            if (jsArg) info.npmPackage = jsArg;
          } else if (serverDef.command === "docker") {
            // docker run image — extract image name
            const runIdx = serverDef.args?.indexOf("run");
            if (runIdx !== undefined && runIdx >= 0 && serverDef.args) {
              // Last arg is usually the image
              const lastArg = serverDef.args[serverDef.args.length - 1];
              if (lastArg && !lastArg.startsWith("-")) {
                info.npmPackage = `docker:${lastArg}`;
              }
            }
          }
        }

        // Check for SSE URL in the config
        if (serverDef.url && !info.sseUrl) {
          info.sseUrl = serverDef.url;
        }
      }
    }
  }

  // Fallback: extract package from source_url
  if (!info.npmPackage && !info.pypiPackage && detail.source_url) {
    if (detail.source_url.includes("npmjs.com/package/")) {
      const match = detail.source_url.match(/npmjs\.com\/package\/(.+?)(?:\/|$)/);
      if (match) info.npmPackage = match[1];
    } else if (detail.source_url.includes("pypi.org/project/")) {
      const match = detail.source_url.match(/pypi\.org\/project\/(.+?)(?:\/|$)/);
      if (match) info.pypiPackage = match[1];
    }
  }

  return info;
}

// ============================================================================
// Checkpoint
// ============================================================================

const CHECKPOINT_FILE = "tmp-mcp-detail-crawl/checkpoint.json";

async function loadCheckpoint(): Promise<CheckpointData | null> {
  try {
    const text = await readFile(CHECKPOINT_FILE, "utf-8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function saveCheckpoint(data: CheckpointData): Promise<void> {
  await mkdir(dirname(CHECKPOINT_FILE), { recursive: true });
  await writeFile(CHECKPOINT_FILE, JSON.stringify(data, null, 2), "utf-8");
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

  log("=== MCP Detail Crawl ===");
  log(`Input: ${config.inputFile}`);
  log(`Output: ${config.dryRun ? "(dry-run)" : config.outputFile}`);
  log(`Concurrency: ${config.concurrency}, Delay: ${config.delayMs}ms`);
  log(`Hosted only: ${config.hostedOnly}`);
  log(`ModelScope token: ${MS_TOKEN ? "set" : "not set"}`);

  // 1. Load existing index
  const rawText = await readFile(config.inputFile, "utf-8");
  const rawData = JSON.parse(rawText);
  const items: Record<string, unknown>[] = rawData.items || rawData;

  log(`Loaded ${items.length} items from ${config.inputFile}`);

  // 2. Filter to ModelScope items that need detail
  let targetIds: string[] = items
    .filter((item) => item.source === "modelscope")
    .map((item) => String(item.serverId || ""))
    .filter(Boolean);

  log(`ModelScope items: ${targetIds.length}`);

  // Pre-build ID mapping (also needed for hosted-only filtering)
  const idMap = await getOriginalIdMap();

  if (config.hostedOnly) {
    // Only keep items that exist in the API (hosted flag queried during map build)
    targetIds = targetIds.filter((id) => idMap.has(id));
    log(`Filtered to ${targetIds.length} items found in REST API`);
  }

  // 3. Resume from checkpoint
  let checkpoint: CheckpointData | null = null;
  if (config.resume) {
    checkpoint = await loadCheckpoint();
    if (checkpoint) {
      const done = new Set(checkpoint.completedIds);
      targetIds = targetIds.filter((id) => !done.has(id));
      log(`Resumed: ${checkpoint.completedIds.length} already done, ${targetIds.length} remaining`);
    }
  }
  if (!checkpoint) {
    checkpoint = {
      completedIds: [],
      results: {},
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };
  }

  // 4. Apply limit
  if (config.limit > 0 && targetIds.length > config.limit) {
    targetIds = targetIds.slice(0, config.limit);
    log(`Limited to ${config.limit} items`);
  }

  log(`Crawling ${targetIds.length} items...`);

  // 5. Crawl in batches
  let crawled = 0;
  let withInstall = 0;
  let errors = 0;

  for (let i = 0; i < targetIds.length; i += config.concurrency) {
    const batch = targetIds.slice(i, i + config.concurrency);

    // The serverId in our index uses "-" but ModelScope API uses "/"
    // Resolve all original IDs first, then fetch in parallel
    const resolvedBatch = await Promise.all(
      batch.map(async (id) => ({
        normalizedId: id,
        apiId: await restoreOriginalId(id),
      })),
    );
    const results = await Promise.all(
      resolvedBatch.map(({ normalizedId, apiId }) =>
        fetchDetail(apiId).then((r) => ({ ...r, normalizedId })),
      ),
    );

    for (const result of results) {
      crawled++;
      if (result.data) {
        const info = extractInstallInfo(result.data);
        checkpoint.results[result.normalizedId] = info;
        checkpoint.completedIds.push(result.normalizedId);

        if (info.npmPackage || info.pypiPackage || info.sseUrl || info.serverConfig) {
          withInstall++;
        }

        if (config.verbose) {
          const installStr = info.npmPackage
            ? `npm:${info.npmPackage}`
            : info.pypiPackage
              ? `pypi:${info.pypiPackage}`
              : info.sseUrl
                ? `sse:${info.sseUrl.slice(0, 50)}`
                : info.serverConfig
                  ? `config:${info.installCommand}`
                  : "none";
          log(`  ${result.normalizedId} → ${installStr}`);
        }
      } else {
        errors++;
        checkpoint.completedIds.push(result.normalizedId);
        if (config.verbose) {
          log(`  ${result.normalizedId} → ERROR: ${result.error}`);
        }
      }
    }

    // Progress
    if (crawled % 50 === 0 || i + config.concurrency >= targetIds.length) {
      const pct = ((crawled / targetIds.length) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = (crawled / ((Date.now() - startTime) / 1000)).toFixed(1);
      log(
        `Progress: ${crawled}/${targetIds.length} (${pct}%) | ` +
          `with install: ${withInstall} | errors: ${errors} | ` +
          `${elapsed}s elapsed, ${rate} items/s`,
      );

      // Save checkpoint periodically
      checkpoint.lastUpdated = new Date().toISOString();
      await saveCheckpoint(checkpoint);
    }

    // Delay between batches
    if (i + config.concurrency < targetIds.length) {
      await sleep(config.delayMs);
    }
  }

  // 6. Merge results into items
  log(`\nMerging ${Object.keys(checkpoint.results).length} detail results into index...`);

  let mergedCount = 0;
  for (const item of items) {
    const id = String(item.serverId || "");
    const info = checkpoint.results[id];
    if (!info) continue;

    mergedCount++;

    // Merge install info
    if (info.npmPackage) item.npmPackage = info.npmPackage;
    if (info.pypiPackage) item.pypiPackage = info.pypiPackage;
    if (info.sseUrl) item.sseUrl = info.sseUrl;
    if (info.serverConfig) item.serverConfig = info.serverConfig;
    if (info.envSchema) item.envSchema = info.envSchema;
    if (info.envRequired) item.envRequired = info.envRequired;
    if (info.isHosted != null) item.isHosted = info.isHosted;
    if (info.isVerified != null) item.isVerified = info.isVerified;
    if (info.sourceUrl) item.sourceUrl = info.sourceUrl;
    if (info.logoUrl) item.logoUrl = info.logoUrl;
    if (info.viewCount) item.viewCount = info.viewCount;
    if (info.githubStars) item.githubStars = info.githubStars;
    if (info.installCommand) item.installCommand = info.installCommand;
    if (info.installArgs) item.installArgs = info.installArgs;
    if (info.installTransport) item.installTransport = info.installTransport;
  }

  log(`Merged install info for ${mergedCount} items`);

  // 7. Stats
  let totalWithInstall = 0;
  let totalNpm = 0;
  let totalPypi = 0;
  let totalSse = 0;
  let totalConfig = 0;
  for (const item of items) {
    if (item.npmPackage || item.pypiPackage || item.sseUrl) {
      totalWithInstall++;
      if (item.npmPackage) totalNpm++;
      if (item.pypiPackage) totalPypi++;
      if (item.sseUrl) totalSse++;
    } else if (item.serverConfig) {
      totalConfig++;
    }
  }
  log(`\n=== Install Info Summary ===`);
  log(`Total items: ${items.length}`);
  log(`With install info: ${totalWithInstall} (${((totalWithInstall / items.length) * 100).toFixed(1)}%)`);
  log(`  npm: ${totalNpm}`);
  log(`  pypi: ${totalPypi}`);
  log(`  sse: ${totalSse}`);
  log(`  config only (no package name): ${totalConfig}`);
  log(`Still no install info: ${items.length - totalWithInstall - totalConfig}`);

  // 8. Write output
  if (!config.dryRun) {
    const envelope = {
      ...(typeof rawData === "object" && !Array.isArray(rawData) ? rawData : {}),
      version: 4,
      generatedAt: new Date().toISOString(),
      itemCount: items.length,
      detailCrawl: {
        crawledAt: new Date().toISOString(),
        crawledCount: crawled,
        withInstallInfo: withInstall,
        errors,
        durationMs: Date.now() - startTime,
      },
      items,
    };

    await mkdir(dirname(config.outputFile), { recursive: true });
    await writeFile(config.outputFile, JSON.stringify(envelope, null, 2), "utf-8");
    log(`Wrote ${config.outputFile}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`\n=== Done in ${elapsed}s ===`);
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a mapping from normalized ID (dashes) → original ID (slashes).
 *
 * The ModelScope REST search API returns original IDs like "@amap/amap-maps"
 * but our index normalizes them to "@amap-amap-maps" (slashes → dashes).
 * Simple heuristics fail on multi-segment scopes like "@supabase-community/supabase-mcp".
 *
 * Solution: Query the REST API for ALL server IDs and build a lookup table.
 */
let _originalIdMap: Map<string, string> | null = null;

async function getOriginalIdMap(): Promise<Map<string, string>> {
  if (_originalIdMap) return _originalIdMap;

  log("Building ID mapping from REST API...");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "OpenClawCN-MCP-DetailCrawl/1.0",
  };
  if (MS_TOKEN) headers["Authorization"] = `Bearer ${MS_TOKEN}`;

  const map = new Map<string, string>();
  const seen = new Set<string>();

  // Use the same exhaustive search as modelscope-source.ts
  const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
  const queries: Array<{ search: string; filter: Record<string, unknown> }> = [
    { search: "", filter: {} },
    { search: "", filter: { is_hosted: true } },
    { search: "", filter: { is_hosted: false } },
  ];
  // Category searches
  for (const cat of [
    "browser-automation", "search", "communication", "developer-tools",
    "file-systems", "knowledge-and-memory", "location-services",
    "research-and-data", "other", "customer-and-marketing",
    "entertainment-and-media", "finance", "art-and-culture", "calendar-management",
  ]) {
    queries.push({ search: "", filter: { category: cat } });
  }
  // Single-char searches
  for (const ch of CHARS) {
    queries.push({ search: ch, filter: {} });
  }

  for (const q of queries) {
    try {
      const resp = await fetch(MS_API_BASE, {
        method: "PUT",
        headers,
        body: JSON.stringify({ ...q, page_number: 1, page_size: 100 }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!resp.ok) continue;
      const json = (await resp.json()) as {
        data?: { mcp_server_list?: Array<{ id?: string; name?: string }> };
      };
      for (const item of json.data?.mcp_server_list || []) {
        const origId = String(item.id || item.name || "");
        if (origId && !seen.has(origId)) {
          seen.add(origId);
          const normalized = origId.replace(/\//g, "-");
          map.set(normalized, origId);
        }
      }
    } catch {
      continue;
    }
    await sleep(100);
  }

  log(`ID map built: ${map.size} entries`);
  _originalIdMap = map;
  return map;
}

async function restoreOriginalId(normalizedId: string): Promise<string> {
  const map = await getOriginalIdMap();
  const orig = map.get(normalizedId);
  if (orig) return orig;

  // Fallback: try the simple heuristic
  if (normalizedId.startsWith("@")) {
    const dashIdx = normalizedId.indexOf("-");
    if (dashIdx > 0) {
      return normalizedId.slice(0, dashIdx) + "/" + normalizedId.slice(dashIdx + 1);
    }
  }
  const dashIdx = normalizedId.indexOf("-");
  if (dashIdx > 0) {
    return normalizedId.slice(0, dashIdx) + "/" + normalizedId.slice(dashIdx + 1);
  }
  return normalizedId;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(`[${new Date().toISOString()}] FATAL:`, err);
  process.exit(1);
});
