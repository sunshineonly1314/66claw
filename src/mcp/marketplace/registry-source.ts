/**
 * Official MCP Registry data source (fallback).
 *
 * Fetches from https://registry.modelcontextprotocol.io/v0.1/servers
 * No authentication required — public API.
 *
 * Used as secondary source when ModelScope is unavailable.
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { McpMarketplaceItem } from "./types.js";

const logger = createSubsystemLogger("registry-source");

const REGISTRY_CONFIG = {
  baseUrl: "https://registry.modelcontextprotocol.io/v0.1/servers",
  timeoutMs: 30_000,
  maxItems: 200,
};

/**
 * Fetch MCP server listings from the Official MCP Registry.
 * Returns empty array on failure (never throws).
 */
export async function fetchFromOfficialRegistry(): Promise<McpMarketplaceItem[]> {
  try {
    logger.info("Fetching from Official MCP Registry...");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REGISTRY_CONFIG.timeoutMs);

    let response: Response;
    try {
      response = await fetch(REGISTRY_CONFIG.baseUrl, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "OpenClawCN-MCP-Sync/1.0",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      logger.warn(`Official Registry returned ${response.status}: ${response.statusText}`);
      return [];
    }

    const raw = await response.json();
    const servers = extractServers(raw);

    const items = servers
      .slice(0, REGISTRY_CONFIG.maxItems)
      .map(normalizeRegistryServer)
      .filter((item): item is McpMarketplaceItem => item !== null);

    logger.info(`Official Registry: ${items.length} items fetched`);
    return items;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Official Registry fetch failed: ${msg}`);
    return [];
  }
}

// ============================================================================
// Helpers
// ============================================================================

interface RegistryServer {
  name?: string;
  description?: string;
  version?: string;
  versions?: string[];
  repository?: { url?: string };
  homepage?: string;
  packages?: Array<{
    registry_name?: string;
    name?: string;
    version?: string;
  }>;
  [key: string]: unknown;
}

function extractServers(raw: unknown): RegistryServer[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.servers)) return obj.servers;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.items)) return obj.items;
  }
  return [];
}

function normalizeRegistryServer(server: RegistryServer): McpMarketplaceItem | null {
  const name = server.name;
  if (!name) return null;

  const serverId = name.replace(/\//g, "-").replace(/@/g, "");
  const description = String(server.description ?? "");

  // Try to find npm package from packages array
  let npmPackage: string | undefined;
  if (Array.isArray(server.packages)) {
    const npmPkg = server.packages.find((p) => p.registry_name === "npm");
    npmPackage = npmPkg?.name;
  }
  if (!npmPackage && (name.startsWith("@") || name.includes("/"))) {
    npmPackage = name;
  }

  const version = server.version
    ?? (Array.isArray(server.versions) && server.versions.length > 0
      ? server.versions[server.versions.length - 1]
      : "0.0.0");

  const category = inferCategoryFromName(name, description);

  return {
    serverId,
    friendlyName: name,
    friendlyNameEn: name,
    description,
    descriptionEn: description,
    category,
    tags: [],
    version: String(version),
    npmPackage,
    requiresApiKey: false,
    platforms: ["linux", "macos", "windows"],
    isOfficial: true,
    isNew: false,
    toolCount: 0,
    source: "official-registry",
    sourceUrl: server.homepage ?? server.repository?.url ?? undefined,
  };
}

function inferCategoryFromName(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase();
  if (/file|filesystem|directory|fs/.test(text)) return "filesystem";
  if (/database|sql|sqlite|postgres|mysql|mongo/.test(text)) return "database";
  if (/search|google|bing|brave/.test(text)) return "search";
  if (/git|github|code|develop/.test(text)) return "development";
  if (/fetch|http|api|network|web/.test(text)) return "network";
  if (/ai|model|image|vision/.test(text)) return "ai";
  if (/slack|discord|social|email/.test(text)) return "social";
  if (/time|date|calendar|productivity/.test(text)) return "productivity";
  return "other";
}
