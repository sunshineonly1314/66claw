/**
 * Cloud Index data source (Tier 0 — highest priority).
 *
 * Fetches a pre-aggregated MCP marketplace index from the SkillsProxy
 * mirror service (obplugins.cn). The index is built by the detail crawl
 * pipeline (scripts/mcp-detail-crawl.ts) and served as a static JSON file
 * via Nginx on the SkillsProxy server.
 *
 * Advantages over per-client sync:
 *   - Fast (~0.5 sec HTTP GET vs ~10 min ModelScope spawn)
 *   - No local Python / uvx dependency required
 *   - 9500+ items pre-aggregated with install info
 *
 * URL is configurable via OPENCLAWCN_MCP_INDEX_URL.
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import { sanitizeSseUrl } from "./types.js";
import type { McpMarketplaceItem } from "./types.js";

const logger = createSubsystemLogger("cloud-index-source");

const CLOUD_INDEX_CONFIG = {
  /** Overridable via OPENCLAWCN_MCP_INDEX_URL env var. */
  defaultUrl: "https://www.obplugins.cn/mcp-index.json",
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
      response = await globalThis.fetch(url, {
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
      // Sanitize SSE URLs — strip embedded credentials from scraped data
      for (const item of items) {
        if (item.sseUrl) item.sseUrl = sanitizeSseUrl(item.sseUrl);
        // Raw cloud JSON may include serverConfig with url field (not on typed interface)
        const raw = item as unknown as Record<string, unknown>;
        if (raw.serverConfig && typeof raw.serverConfig === "object") {
          const cfg = raw.serverConfig as Record<string, unknown>;
          if (typeof cfg.url === "string") cfg.url = sanitizeSseUrl(cfg.url);
        }
      }
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
