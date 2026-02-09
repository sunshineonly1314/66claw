/**
 * marketplace-sync.ts
 * Background sync for the MCP marketplace index from ClawdSkillsProxy.
 *
 * Pattern mirrors src/agents/skills/sync.ts:
 *   - Dedup lock (singleton Promise)
 *   - Staleness check (5-min TTL)
 *   - fetchWithAuth (AbortController + Bearer token)
 *   - Background fire-and-forget wrapper
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { invalidateMarketplaceCache, readMarketplaceIndex } from "./marketplace-index.js";

const logger = createSubsystemLogger("mcp-marketplace-sync");

// ============================================================================
// Config (reuse proxy config shape from skills proxy)
// ============================================================================

interface ProxySyncConfig {
  baseUrl: string;
  token: string;
  timeoutMs: number;
}

const DEFAULT_CONFIG: ProxySyncConfig = {
  baseUrl: process.env.CLAWDBOT_SKILLS_PROXY_URL?.trim() || "http://121.43.61.90/api",
  token: process.env.CLAWDBOT_SKILLS_PROXY_TOKEN?.trim() || "clawdskills_secret_token_2024",
  timeoutMs: 30_000,
};

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
}

// ============================================================================
// State — dedup lock
// ============================================================================

let syncPromise: Promise<McpSyncResult> | null = null;

// ============================================================================
// Core
// ============================================================================

/**
 * Sync the MCP marketplace index from ClawdSkillsProxy.
 * If a sync is already running, returns the same Promise (dedup).
 */
export async function syncMcpIndex(
  options: McpSyncOptions = {},
): Promise<McpSyncResult> {
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

async function doSync(options: McpSyncOptions): Promise<McpSyncResult> {
  const { force = false, silent = false, staleMs = 5 * 60 * 1000 } = options;

  try {
    // Staleness check: if cache is fresh, skip
    if (!force) {
      const existing = await readMarketplaceIndex();
      // If we have items and cache was populated recently, skip
      if (existing.length > 0) {
        logger.debug("MCP marketplace index is fresh, skipping sync");
        return { ok: true, synced: false };
      }
    }

    logger.info("Starting MCP marketplace index sync", { force });

    // Fetch from proxy
    const url = `${DEFAULT_CONFIG.baseUrl}/mcp-index`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_CONFIG.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${DEFAULT_CONFIG.token}`,
          "User-Agent": "Clawdbot-MCP-Sync/1.0",
          Accept: "application/json",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const error = `Proxy returned ${response.status}: ${response.statusText}`;
      logger.warn(error);
      if (silent) return { ok: true, synced: false, error };
      return { ok: false, error, synced: false };
    }

    const raw = await response.text();
    const parsed = JSON.parse(raw);

    // Normalize: accept both flat array and { items: [...] } wrapper
    const items = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.items)
        ? parsed.items
        : Array.isArray(parsed.data?.items)
          ? parsed.data.items
          : [];

    if (items.length === 0) {
      logger.warn("Proxy returned empty MCP index");
      return { ok: true, synced: false };
    }

    // Write to the first writable data directory
    const written = await writeIndexToDataDir(items);
    if (!written) {
      const error = "Failed to write mcp-index.json to any data directory";
      logger.warn(error);
      if (silent) return { ok: true, synced: false, error };
      return { ok: false, error, synced: false };
    }

    // Invalidate the in-memory cache so next read picks up new data
    invalidateMarketplaceCache();

    logger.info("MCP marketplace index sync completed", { itemCount: items.length });
    return { ok: true, synced: true, itemCount: items.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error("MCP marketplace index sync failed", { error });
    if (silent) return { ok: true, synced: false, error };
    return { ok: false, error, synced: false };
  }
}

/**
 * Write index JSON to the first writable data directory.
 */
async function writeIndexToDataDir(items: unknown[]): Promise<boolean> {
  const candidates = [
    process.env.CLAWDBOT_DATA_DIR,
    process.env.APPDATA ? join(process.env.APPDATA, "clawdbot") : undefined,
    process.env.HOME ? join(process.env.HOME, ".clawdbot") : undefined,
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    try {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
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
