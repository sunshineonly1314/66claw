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
import { join } from "node:path";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { invalidateMarketplaceCache, readMarketplaceIndex } from "./marketplace-index.js";
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
    const filePath = join(dir, "mcp-index.json");
    try {
      const st = await stat(filePath);
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

/** Deduplicate marketplace items by serverId (first occurrence wins). */
export function deduplicateItems(items: McpMarketplaceItem[]): McpMarketplaceItem[] {
  const seen = new Set<string>();
  const result: McpMarketplaceItem[] = [];
  for (const item of items) {
    const key = item.serverId ?? (item as unknown as Record<string, unknown>).id;
    if (key && !seen.has(String(key))) {
      seen.add(String(key));
      result.push(item);
    }
  }
  return result;
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
      const filePath = join(dir, "mcp-index.json");
      await writeFile(filePath, JSON.stringify(items, null, 2), "utf-8");
      logger.debug("Wrote mcp-index.json", { path: filePath, count: items.length });
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
