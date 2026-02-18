/**
 * Official MCP Registry data source (fallback).
 *
 * Fetches from https://registry.modelcontextprotocol.io/v0.1/servers
 * No authentication required — public API.
 *
 * Used as secondary source when ModelScope is unavailable.
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import { shouldUseCNMirror } from "../../config/cn-mirrors.js";
import type { McpMarketplaceItem } from "./types.js";

const logger = createSubsystemLogger("registry-source");

const REGISTRY_CONFIG = {
  baseUrl: "https://registry.modelcontextprotocol.io/v0.1/servers",
  /** GitHub-hosted mirror of registry data, accessible via CN proxies */
  mirrorUrls: [
    "https://gh-proxy.com/https://raw.githubusercontent.com/modelcontextprotocol/servers/main/registry/servers.json",
    "https://ghfast.top/https://raw.githubusercontent.com/modelcontextprotocol/servers/main/registry/servers.json",
  ],
  timeoutMs: 30_000,
  /** Per-page timeout for paginated requests */
  pageTimeoutMs: 15_000,
  /** Shorter timeout for CN users — fail fast and try mirror */
  cnTimeoutMs: 8_000,
  maxItems: 5000,
  /** Max pages to fetch to avoid infinite loops */
  maxPages: 200,
};

/**
 * Fetch MCP server listings from the Official MCP Registry.
 * For CN users, tries GitHub proxy mirrors first with short timeout,
 * then falls back to the official URL.
 * Returns empty array on failure (never throws).
 */
export async function fetchFromOfficialRegistry(): Promise<McpMarketplaceItem[]> {
  const useCN = shouldUseCNMirror();

  if (useCN) {
    // CN path: try mirrors first, then official as fallback
    for (const mirrorUrl of REGISTRY_CONFIG.mirrorUrls) {
      const items = await fetchRegistryUrl(mirrorUrl, REGISTRY_CONFIG.cnTimeoutMs);
      if (items.length > 0) {
        logger.info(`Official Registry (CN mirror): ${items.length} items fetched`);
        return items;
      }
    }
    // Fall through to official URL with shorter timeout
    const items = await fetchRegistryUrl(REGISTRY_CONFIG.baseUrl, REGISTRY_CONFIG.cnTimeoutMs);
    if (items.length > 0) return items;
    return [];
  }

  // Non-CN path: direct fetch
  return fetchRegistryUrl(REGISTRY_CONFIG.baseUrl, REGISTRY_CONFIG.timeoutMs);
}

/**
 * Fetch and parse a registry URL with pagination support.
 * The official registry returns paginated results with `metadata.nextCursor`.
 * Returns empty array on failure.
 */
async function fetchRegistryUrl(url: string, timeoutMs: number): Promise<McpMarketplaceItem[]> {
  try {
    logger.info(`Fetching from ${url}...`);

    const allServers: RegistryServer[] = [];
    let cursor: string | undefined;
    let page = 0;

    // Paginated fetch loop
    do {
      const pageUrl = cursor
        ? `${url}${url.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}`
        : url;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetch(pageUrl, {
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
        logger.warn(`Registry returned ${response.status}: ${response.statusText} from ${pageUrl}`);
        break;
      }

      const raw = await response.json();
      const { servers, nextCursor } = extractServersPage(raw);

      allServers.push(...servers);
      cursor = nextCursor;
      page++;

      if (page > 1 && page % 10 === 0) {
        logger.debug(`Registry pagination: ${allServers.length} servers after ${page} pages`);
      }
    } while (
      cursor &&
      page < REGISTRY_CONFIG.maxPages &&
      allServers.length < REGISTRY_CONFIG.maxItems
    );

    const items = allServers
      .slice(0, REGISTRY_CONFIG.maxItems)
      .map(normalizeRegistryServer)
      .filter((item): item is McpMarketplaceItem => item !== null);

    logger.info(`Official Registry: ${items.length} items fetched from ${url} (${page} page(s))`);
    return items;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Registry fetch failed from ${url}: ${msg}`);
    return [];
  }
}

// ============================================================================
// Helpers
// ============================================================================

interface RegistryServer {
  name?: string;
  title?: string;
  description?: string;
  version?: string;
  versions?: string[];
  repository?: { url?: string; source?: string };
  homepage?: string;
  websiteUrl?: string;
  packages?: Array<{
    /** Old format field name */
    registry_name?: string;
    /** New format (v0.1) field name */
    registryType?: string;
    name?: string;
    /** New format: npm package identifier, e.g. "@scope/pkg" */
    identifier?: string;
    version?: string;
    transport?: { type?: string };
  }>;
  remotes?: Array<{
    type?: string;
    url?: string;
  }>;
  [key: string]: unknown;
}

interface ExtractedPage {
  servers: RegistryServer[];
  nextCursor?: string;
}

/**
 * Extract servers from a paginated registry response.
 *
 * The official registry v0.1 returns:
 *   { servers: [{ server: {...}, _meta: {...} }, ...], metadata: { nextCursor, count } }
 *
 * Legacy/mirror format:
 *   [{ name, description, ... }, ...]    (flat array)
 *   { servers: [{ name, ... }, ...] }    (simple wrapper)
 *   { data: [...] } or { items: [...] }  (other wrappers)
 */
function extractServersPage(raw: unknown): ExtractedPage {
  if (Array.isArray(raw)) {
    return { servers: raw };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;

    // Official v0.1 paginated format: { servers: [{ server: {...}, _meta }, ...], metadata: { nextCursor } }
    if (Array.isArray(obj.servers)) {
      const nextCursor = (obj.metadata as Record<string, unknown>)?.nextCursor as
        | string
        | undefined;

      // Check if entries are nested { server: {...} } or flat { name: ... }
      const entries = obj.servers as Record<string, unknown>[];
      const servers: RegistryServer[] = entries.map((entry) => {
        if (entry.server && typeof entry.server === "object") {
          return entry.server as RegistryServer;
        }
        return entry as RegistryServer;
      });

      return { servers, nextCursor };
    }

    if (Array.isArray(obj.data)) return { servers: obj.data };
    if (Array.isArray(obj.items)) return { servers: obj.items };
  }

  return { servers: [] };
}

function normalizeRegistryServer(server: RegistryServer): McpMarketplaceItem | null {
  const name = server.name;
  if (!name) return null;

  const serverId = name.replace(/\//g, "-").replace(/@/g, "");
  const description = String(server.description ?? "");
  const displayName = server.title || name;

  // Try to find npm package from packages array
  let npmPackage: string | undefined;
  let pypiPackage: string | undefined;
  if (Array.isArray(server.packages)) {
    // New format: registryType + identifier; Old format: registry_name + name
    const npmPkg = server.packages.find(
      (p) => p.registryType === "npm" || p.registry_name === "npm",
    );
    npmPackage = npmPkg?.identifier ?? npmPkg?.name;

    const pypiPkg = server.packages.find(
      (p) => p.registryType === "pypi" || p.registry_name === "pypi",
    );
    pypiPackage = pypiPkg?.identifier ?? pypiPkg?.name;
  }
  // Only infer npm package from name if it looks like an npm scope (e.g. @scope/pkg).
  // Official registry names like "ai.exa/exa" are NOT npm packages.
  if (!npmPackage && name.startsWith("@") && name.includes("/")) {
    npmPackage = name;
  }

  // Extract SSE/streamable-http remote URL
  let sseUrl: string | undefined;
  if (Array.isArray(server.remotes)) {
    const remote = server.remotes.find((r) => r.type === "sse" || r.type === "streamable-http");
    sseUrl = remote?.url;
  }

  const version =
    server.version ??
    (Array.isArray(server.versions) && server.versions.length > 0
      ? server.versions[server.versions.length - 1]
      : "0.0.0");

  const category = inferCategoryFromName(name, description);

  return {
    serverId,
    friendlyName: displayName,
    friendlyNameEn: displayName,
    description,
    descriptionEn: description,
    category,
    tags: [],
    version: String(version),
    npmPackage,
    pypiPackage,
    sseUrl,
    requiresApiKey: false,
    platforms: ["linux", "macos", "windows"],
    isOfficial: true,
    isNew: false,
    toolCount: 0,
    source: "official-registry",
    sourceUrl: server.websiteUrl ?? server.homepage ?? server.repository?.url ?? undefined,
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
