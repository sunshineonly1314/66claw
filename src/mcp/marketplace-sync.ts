/**
 * marketplace-sync.ts
 * Background sync for the MCP marketplace index.
 *
 * Three-tier data source cascade:
 *   1. ModelScope (魔搭) — via MCP protocol bootstrapping
 *   2. Official MCP Registry — public REST API
 *   3. ClawdSkillsProxy — self-hosted fallback
 *
 * Pattern mirrors src/agents/skills/sync.ts:
 *   - Dedup lock (singleton Promise)
 *   - Staleness check (5-min TTL)
 *   - fetchWithAuth (AbortController + Bearer token)
 *   - Background fire-and-forget wrapper
 */

import { writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { invalidateMarketplaceCache, readMarketplaceIndex } from "./marketplace-index.js";
import { encryptContent, isEncryptionEnabled } from "../security/content-vault.js";
import { fetchFromCloudIndex } from "./marketplace/cloud-index-source.js";
import { fetchFromModelScope } from "./marketplace/modelscope-source.js";
import { fetchFromOfficialRegistry } from "./marketplace/registry-source.js";
import type { McpMarketplaceItem, MarketplaceSourceName } from "./marketplace/types.js";

const logger = createSubsystemLogger("mcp-marketplace-sync");

// ============================================================================
// Config (reuse proxy config shape from skills proxy)
// ============================================================================

interface ProxySyncConfig {
  baseUrl: string;
  token: string;
  timeoutMs: number;
}

/**
 * Lazily resolve proxy config from env vars.
 * Returns null if the proxy env vars are not configured
 * (Tier 3 is optional — Tier 1 & 2 must still work without it).
 */
function getProxyConfig(): ProxySyncConfig | null {
  const baseUrl = process.env.OPENCLAWCN_SKILLS_PROXY_URL?.trim();
  const token = process.env.OPENCLAWCN_SKILLS_PROXY_TOKEN?.trim();

  if (!baseUrl || !token) return null;

  const isDev = process.env.CLAWDBOT_PROFILE === "dev" || process.env.NODE_ENV === "development";

  // 安全检查: 生产环境阻止已知的不安全默认值
  if (token === "clawdbotCN778" && !isDev) {
    logger.warn(
      "SECURITY: Detected compromised default proxy token. " +
        "Tier 3 (ClawdSkillsProxy) disabled. Please generate a new secure token.",
    );
    return null;
  }

  // 安全检查: 生产环境强制 HTTPS
  if (!isDev && !baseUrl.startsWith("https://")) {
    logger.warn(
      `SECURITY: Proxy URL must use HTTPS in production (got ${baseUrl}). ` +
        "Tier 3 (ClawdSkillsProxy) disabled.",
    );
    return null;
  }

  return { baseUrl, token, timeoutMs: 30_000 };
}

// ============================================================================
// Types
// ============================================================================

export interface McpSyncOptions {
  /** Force sync, ignore staleness check */
  force?: boolean;
  /** Silent mode — failures don't throw */
  silent?: boolean;
  /** Custom staleness threshold (ms). Default: 5 min */
  staleMs?: number;
}

export interface McpSyncResult {
  ok: boolean;
  error?: string;
  synced: boolean;
  itemCount?: number;
  /** Which data source provided the data. */
  source?: MarketplaceSourceName;
}

// ============================================================================
// State — dedup lock
// ============================================================================

let syncPromise: Promise<McpSyncResult> | null = null;
let dailySyncTimer: ReturnType<typeof setInterval> | null = null;

// ============================================================================
// Core
// ============================================================================

/**
 * Sync the MCP marketplace index using three-tier cascade.
 * If a sync is already running, returns the same Promise (dedup).
 */
export async function syncMcpIndex(options: McpSyncOptions = {}): Promise<McpSyncResult> {
  if (syncPromise && !options.force) {
    logger.debug("MCP sync already in progress, waiting for existing sync");
    return syncPromise;
  }

  syncPromise = doSync(options);
  try {
    return await syncPromise;
  } finally {
    syncPromise = null;
  }
}

/**
 * Check the age of the most recent mcp-index.json file (in ms).
 * Returns null if no index file exists.
 */
async function getIndexFileAge(): Promise<number | null> {
  const candidates = [
    process.env.OPENCLAWCN_DATA_DIR,
    process.env.APPDATA ? join(process.env.APPDATA, "openclawcn") : undefined,
    process.env.HOME ? join(process.env.HOME, ".openclawcn") : undefined,
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    // Check encrypted file first, then plain
    const encPath = join(dir, "mcp-index.json.enc");
    const filePath = join(dir, "mcp-index.json");
    try {
      const target = existsSync(encPath) ? encPath : filePath;
      const st = await stat(target);
      return Date.now() - st.mtimeMs;
    } catch {
      continue;
    }
  }
  return null;
}

async function doSync(options: McpSyncOptions): Promise<McpSyncResult> {
  const { force = false, silent = false } = options;

  try {
    // Staleness check: if cache file is fresh (< staleMs), skip
    const staleMs = options.staleMs ?? 5 * 60 * 1000; // default 5 min
    if (!force) {
      const indexAge = await getIndexFileAge();
      if (indexAge !== null && indexAge < staleMs) {
        logger.debug("MCP marketplace index is fresh, skipping sync", { ageMs: indexAge });
        return { ok: true, synced: false };
      }
    }

    logger.info("Starting MCP marketplace index sync (four-tier cascade)", { force });

    // ====================================================================
    // Tier 0: Cloud Index (Alibaba Cloud pre-aggregated, fastest path)
    // ====================================================================
    let items: McpMarketplaceItem[] = [];
    let source: MarketplaceSourceName = "cloud-index";

    try {
      items = await fetchFromCloudIndex();
      if (items.length > 0) {
        logger.info(`Tier 0 (Cloud Index) returned ${items.length} items`);
      }
    } catch (err) {
      logger.warn("Tier 0 (Cloud Index) failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // ====================================================================
    // Tier 1: ModelScope (魔搭)
    // ====================================================================
    if (items.length === 0) {
      source = "modelscope";
      try {
        items = await fetchFromModelScope();
        if (items.length > 0) {
          logger.info(`Tier 1 (ModelScope) returned ${items.length} items`);
        }
      } catch (err) {
        logger.warn("Tier 1 (ModelScope) failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ====================================================================
    // Tier 2: Official MCP Registry (fallback)
    // ====================================================================
    if (items.length === 0) {
      source = "official-registry";
      try {
        items = await fetchFromOfficialRegistry();
        if (items.length > 0) {
          logger.info(`Tier 2 (Official Registry) returned ${items.length} items`);
        }
      } catch (err) {
        logger.warn("Tier 2 (Official Registry) failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ====================================================================
    // Tier 3: ClawdSkillsProxy (existing, last resort)
    // ====================================================================
    if (items.length === 0) {
      source = "clawdskillsproxy";
      const proxyItems = await fetchFromProxy();
      if (proxyItems.length > 0) {
        // Proxy returns raw records, tag them with source
        items = proxyItems.map((item) => ({
          ...item,
          source: "clawdskillsproxy" as const,
        })) as unknown as McpMarketplaceItem[];
        logger.info(`Tier 3 (ClawdSkillsProxy) returned ${items.length} items`);
      }
    }

    // ====================================================================
    // Write results
    // ====================================================================
    if (items.length === 0) {
      logger.warn("All tiers returned 0 items, serving stale cache");
      return { ok: true, synced: false, source };
    }

    // Merge & deduplicate by serverId (first occurrence wins)
    const deduped = deduplicateItems(items);

    const written = await writeIndexToDataDir(deduped);
    if (!written) {
      const error = "Failed to write mcp-index.json to any data directory";
      logger.warn(error);
      if (silent) return { ok: true, synced: false, error, source };
      return { ok: false, error, synced: false, source };
    }

    invalidateMarketplaceCache();

    // Also update SQLite DB for server-side pagination/search
    try {
      const mcpDb = await import("./marketplace/db.js");
      const existingCount = mcpDb.getItemCount();

      // Upsert all items from remote
      mcpDb.insertItems(deduped);

      // Safety guard: only remove stale items if remote returned a substantial dataset.
      // If remote returns far fewer items than the local baseline (e.g., Tier 3 proxy
      // returning ~1854 vs baseline 9535), the remote is likely a partial dataset — do
      // NOT delete baseline items in that case.
      const MINIMUM_RATIO = 0.5; // remote must have ≥50% of existing items to allow deletions
      const remoteIds = new Set(deduped.map((item) => item.serverId));

      if (existingCount === 0 || deduped.length >= existingCount * MINIMUM_RATIO) {
        const db = mcpDb.getDatabase();
        const allRows = db.prepare("SELECT server_id FROM mcp_items").all() as Array<{
          server_id: string;
        }>;
        const staleIds = allRows.map((r) => r.server_id).filter((id) => !remoteIds.has(id));
        if (staleIds.length > 0) {
          mcpDb.deleteItemsByIds(staleIds);
          logger.info(`Removed ${staleIds.length} stale items from SQLite (no longer in remote)`);
        }
      } else {
        logger.warn(
          `Skipping stale-item cleanup: remote (${deduped.length}) < 50% of existing (${existingCount}). ` +
            `Remote source likely returned partial data.`,
        );
      }

      logger.info("MCP marketplace SQLite DB updated", { itemCount: mcpDb.getItemCount() });
    } catch (dbErr) {
      logger.warn("Failed to update SQLite DB (non-fatal, JSON file still written)", {
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
      });
    }

    // Bridge: sync MCP items → tool-index.sqlite for hybridSearch (non-blocking)
    import("../dispatch/tool-discovery.js")
      .then(async ({ syncMcpToToolIndex }) => {
        const { loadConfig } = await import("../config/config.js");
        const cfg = loadConfig();
        await syncMcpToToolIndex(deduped, {
          embedding: cfg.toolDiscovery?.embedding,
        });
      })
      .catch((err) => {
        logger.warn("Failed to sync MCP→tool-index (non-fatal)", {
          error: err instanceof Error ? err.message : String(err),
        });
      });

    logger.info("MCP marketplace index sync completed", {
      itemCount: deduped.length,
      source,
    });
    return { ok: true, synced: true, itemCount: deduped.length, source };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error("MCP marketplace index sync failed", { error });
    if (silent) return { ok: true, synced: false, error };
    return { ok: false, error, synced: false };
  }
}

// ============================================================================
// Tier 3: ClawdSkillsProxy fetch (original logic, preserved)
// ============================================================================

async function fetchFromProxy(): Promise<Record<string, unknown>[]> {
  try {
    const config = getProxyConfig();
    if (!config) {
      logger.debug("Proxy env vars not configured, skipping Tier 3");
      return [];
    }

    const url = `${config.baseUrl}/mcp-index`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${config.token}`,
          "User-Agent": "OpenClawCN-MCP-Sync/1.0",
          Accept: "application/json",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      logger.warn(`Proxy returned ${response.status}: ${response.statusText}`);
      return [];
    }

    const raw = await response.text();
    const parsed = JSON.parse(raw);

    const items = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.items)
        ? parsed.items
        : Array.isArray(parsed.data?.items)
          ? parsed.data.items
          : [];

    return items;
  } catch (err) {
    logger.warn("Proxy fetch failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Score an item by how much real install info it carries.
 * Higher score = more useful for one-click install.
 */
function installInfoScore(item: McpMarketplaceItem): number {
  let score = 0;
  if (item.npmPackage) score += 3;
  if (item.pypiPackage) score += 2;
  // Real SSE URL (not the synthetic ModelScope pattern) is valuable
  if (item.sseUrl && !/\.api-inference\.modelscope\.net\/sse$/.test(item.sseUrl)) score += 2;
  if (item.isOfficial) score += 1;
  return score;
}

/**
 * Deduplicate marketplace items by serverId.
 * When two items share the same serverId, the one with better install info wins.
 * On tie, the first occurrence wins (preserves CN metadata from ModelScope).
 */
export function deduplicateItems(items: McpMarketplaceItem[]): McpMarketplaceItem[] {
  const map = new Map<string, McpMarketplaceItem>();
  const scoreCache = new Map<string, number>();
  for (const item of items) {
    const key = String(item.serverId ?? (item as unknown as Record<string, unknown>).id ?? "");
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      scoreCache.set(key, installInfoScore(item));
    } else {
      const newScore = installInfoScore(item);
      const oldScore = scoreCache.get(key) ?? 0;
      if (newScore > oldScore) {
        map.set(key, item);
        scoreCache.set(key, newScore);
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Write index JSON to the first writable data directory.
 */
async function writeIndexToDataDir(items: unknown[]): Promise<boolean> {
  const candidates = [
    process.env.OPENCLAWCN_DATA_DIR,
    process.env.APPDATA ? join(process.env.APPDATA, "openclawcn") : undefined,
    process.env.HOME ? join(process.env.HOME, ".openclawcn") : undefined,
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    try {
      // mkdir with recursive:true is safe even if dir already exists (no TOCTOU)
      await mkdir(dir, { recursive: true });

      const jsonContent = JSON.stringify(items, null, 2);

      if (isEncryptionEnabled()) {
        // Write encrypted version
        const encPath = join(dir, "mcp-index.json.enc");
        const encrypted = encryptContent(jsonContent);
        await writeFile(encPath, encrypted);
        logger.debug("Wrote mcp-index.json.enc (encrypted)", {
          path: encPath,
          count: items.length,
        });
      } else {
        // Write plain JSON in dev mode
        const filePath = join(dir, "mcp-index.json");
        await writeFile(filePath, jsonContent, "utf-8");
        logger.debug("Wrote mcp-index.json", { path: filePath, count: items.length });
      }

      return true;
    } catch {
      continue;
    }
  }

  return false;
}

// ============================================================================
// Daily sync scheduler
// ============================================================================

/**
 * Start a daily background sync scheduler.
 * Call at gateway startup after initial sync.
 * Interval is configurable via OPENCLAWCN_MCP_SYNC_INTERVAL_H (default: 24).
 */
export function startDailySyncScheduler(): void {
  if (dailySyncTimer) return; // Already started

  const intervalH = Number(process.env.OPENCLAWCN_MCP_SYNC_INTERVAL_H) || 24;
  const intervalMs = intervalH * 60 * 60 * 1000;

  logger.info(`MCP marketplace daily sync scheduler started (interval: ${intervalH}h)`);

  dailySyncTimer = setInterval(() => {
    syncMcpIndex({ force: true, silent: true }).catch((err) => {
      logger.debug("Daily MCP sync failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, intervalMs);

  // Don't prevent Node.js from exiting
  if (dailySyncTimer && typeof dailySyncTimer === "object" && "unref" in dailySyncTimer) {
    dailySyncTimer.unref();
  }
}

/**
 * Stop the daily sync scheduler.
 */
export function stopDailySyncScheduler(): void {
  if (dailySyncTimer) {
    clearInterval(dailySyncTimer);
    dailySyncTimer = null;
  }
}

// ============================================================================
// Background wrapper (non-blocking, for gateway startup)
// ============================================================================

/**
 * Fire-and-forget background sync. Failures are silently logged.
 * Call at gateway startup after skill sync.
 */
export function syncMcpIndexBackground(options?: McpSyncOptions): void {
  syncMcpIndex({ ...options, silent: true }).catch((err) => {
    logger.debug("Background MCP sync failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
