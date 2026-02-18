/**
 * Cloud Index data source (Tier 0 — highest priority).
 *
 * Fetches a pre-aggregated MCP marketplace index from an Alibaba Cloud
 * CDN / static file URL.  This index is built daily by the standalone
 * sync script (scripts/mcp-full-sync.ts) running on ECS via cron.
 *
 * Advantages over per-client sync:
 *   - Fast (~1-3 sec HTTP GET vs ~10 min ModelScope spawn)
 *   - No local Python / uvx dependency required
 *   - 3000+ items pre-aggregated and deduplicated
 *
 * URL is configurable via OPENCLAWCN_MCP_INDEX_URL.
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { McpMarketplaceItem } from "./types.js";

const logger = createSubsystemLogger("cloud-index-source");

const CLOUD_INDEX_CONFIG = {
  /** Overridable via OPENCLAWCN_MCP_INDEX_URL env var. */
  defaultUrl: "",
  timeoutMs: 15_000,
};

/**
 * Fetch the pre-aggregated MCP index from the cloud.
 * Returns empty array on failure (never throws).
 */
export async function fetchFromCloudIndex(): Promise<McpMarketplaceItem[]> {
  const url = process.env.OPENCLAWCN_MCP_INDEX_URL?.trim() || CLOUD_INDEX_CONFIG.defaultUrl;

  if (!url) {
    logger.debug("OPENCLAWCN_MCP_INDEX_URL not set, skipping Tier 0");
    return [];
  }

  try {
    logger.info(`Fetching cloud index from ${url}...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLOUD_INDEX_CONFIG.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "OpenClawCN-Gateway/1.0",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      logger.warn(`Cloud index returned ${response.status}: ${response.statusText}`);
      return [];
    }

    const raw = await response.json();

    // Support both flat array and envelope { items: [...] } format
    const items: McpMarketplaceItem[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.items)
        ? raw.items
        : [];

    if (items.length > 0) {
      logger.info(`Tier 0 (Cloud Index): ${items.length} items fetched`);
    } else {
      logger.warn("Cloud index returned 0 items");
    }

    return items;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Tier 0 (Cloud Index) fetch failed: ${msg}`);
    return [];
  }
}
