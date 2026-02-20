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
import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveOpenClawCNPackageRootSync } from "../infra/openclaw-root.js";
import type { McpMarketplaceItem } from "./marketplace/types.js";
import { decryptContent, isEncryptionEnabled } from "../security/content-vault.js";

// Re-export the shared type for convenience
export type { McpMarketplaceItem } from "./marketplace/types.js";

// Resolve bundled data dir via package root (works in both src/ and dist/).
// resolveOpenClawCNPackageRootSync walks up directories to find the project
// root (with package.json name "openclawcn"), so the path is correct
// regardless of Rollup flattening dist/ structure.
const PACKAGE_ROOT = resolveOpenClawCNPackageRootSync({ cwd: process.cwd() });
const BUNDLED_DATA_DIR = PACKAGE_ROOT ? join(PACKAGE_ROOT, "data") : undefined;

// Default data directory candidates (user dirs first, bundled fallback last)
const DATA_DIR_CANDIDATES = [
  process.env.OPENCLAWCN_DATA_DIR,
  process.env.APPDATA ? join(process.env.APPDATA, "openclawcn") : undefined,
  process.env.HOME ? join(process.env.HOME, ".openclawcn") : undefined,
  BUNDLED_DATA_DIR,
].filter(Boolean) as string[];

let cachedIndex: McpMarketplaceItem[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Read and return the marketplace index as a typed array.
 * Results are cached for 5 minutes to avoid repeated disk reads.
 *
 * Scans ALL candidate directories and returns the largest index found,
 * so that a stale user-cache (e.g. 1854 items) never shadows the
 * bundled full index (9535 items).
 */
export async function readMarketplaceIndex(): Promise<McpMarketplaceItem[]> {
  const now = Date.now();
  if (cachedIndex && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedIndex;
  }

  let best: McpMarketplaceItem[] = [];

  for (const dir of DATA_DIR_CANDIDATES) {
    // Try enhanced (AI-translated) file first, then encrypted, then plain JSON
    const enhancedPath = join(dir, "mcp-index-enhanced.json");
    const encPath = join(dir, "mcp-index.json.enc");
    const filePath = join(dir, "mcp-index.json");
    try {
      let raw: string;
      if (existsSync(enhancedPath)) {
        raw = await readFile(enhancedPath, "utf-8");
      } else if (isEncryptionEnabled() && existsSync(encPath)) {
        const encrypted = await readFile(encPath);
        raw = decryptContent(encrypted);
      } else {
        raw = await readFile(filePath, "utf-8");
      }
      const parsed = JSON.parse(raw);
      const items: McpMarketplaceItem[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.items)
          ? parsed.items
          : [];
      if (items.length > best.length) {
        best = items;
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        console.warn(
          `[mcp-marketplace-index] Failed to read/parse ${filePath}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
      continue;
    }
  }

  cachedIndex = best;
  cacheTimestamp = now;
  return best;
}

/**
 * Invalidate the cached index (e.g. after a sync from proxy).
 */
export function invalidateMarketplaceCache(): void {
  cachedIndex = null;
  cacheTimestamp = 0;
}
