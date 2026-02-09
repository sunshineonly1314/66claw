/**
 * marketplace-index.ts
 * Reads the local MCP marketplace index file.
 *
 * The index is a JSON file (mcp-index.json) synced by ClawdSkillsProxy
 * or bundled with the installer. It contains an array of marketplace items
 * with metadata for the Capability Store UI.
 *
 * Location search order:
 *   1. <dataDir>/mcp-index.json  (synced by proxy)
 *   2. <installDir>/data/mcp-index.json  (bundled fallback)
 */

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Resolve the bundled data directory relative to this module's location.
// Layout: src/mcp/marketplace-index.ts → ../../data/mcp-index.json
const __dirname_resolved = typeof __dirname !== "undefined"
  ? __dirname
  : dirname(fileURLToPath(import.meta.url));
const BUNDLED_DATA_DIR = join(__dirname_resolved, "..", "..", "data");

// Default data directory candidates (user dirs first, bundled fallback last)
const DATA_DIR_CANDIDATES = [
  process.env.CLAWDBOT_DATA_DIR,
  process.env.APPDATA ? join(process.env.APPDATA, "clawdbot") : undefined,
  process.env.HOME ? join(process.env.HOME, ".clawdbot") : undefined,
  BUNDLED_DATA_DIR,
].filter(Boolean) as string[];

let cachedIndex: Record<string, unknown>[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Read and return the marketplace index as an array of item records.
 * Results are cached for 5 minutes to avoid repeated disk reads.
 */
export async function readMarketplaceIndex(): Promise<Record<string, unknown>[]> {
  const now = Date.now();
  if (cachedIndex && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedIndex;
  }

  for (const dir of DATA_DIR_CANDIDATES) {
    const filePath = join(dir, "mcp-index.json");
    if (existsSync(filePath)) {
      try {
        const raw = await readFile(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : [];
        cachedIndex = items;
        cacheTimestamp = now;
        return items;
      } catch {
        // Corrupted file — try next candidate
        continue;
      }
    }
  }

  // No index file found — return empty
  cachedIndex = [];
  cacheTimestamp = now;
  return [];
}

/**
 * Invalidate the cached index (e.g. after a sync from proxy).
 */
export function invalidateMarketplaceCache(): void {
  cachedIndex = null;
  cacheTimestamp = 0;
}
