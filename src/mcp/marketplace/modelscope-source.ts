/**
 * ModelScope (魔搭) MCP data source.
 *
 * Two fetch strategies:
 *   1. **REST API** (primary): Direct HTTP calls to ModelScope's public REST API
 *      `PUT /openapi/v1/mcp/servers` with proper pagination support.
 *      This is much faster and can fetch ALL servers (7000+).
 *
 *   2. **MCP protocol** (fallback): Spawn `modelscope-mcp-server` as a temporary
 *      stdio MCP Server and use `search_mcp_servers` tool. Limited to ~500 items
 *      due to hardcoded page_number=1 in the tool.
 *
 * Requires: MODELSCOPE_API_TOKEN environment variable.
 *
 * Anti-scraping strategies:
 *   - Daily sync only (not real-time)
 *   - 300ms delay between paginated requests
 *   - Exponential backoff on errors
 *   - 24h disk cache (mcp-index.json)
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { sanitizeSseUrl } from "./types.js";
import type { McpMarketplaceItem } from "./types.js";

const logger = createSubsystemLogger("modelscope-source");

// ============================================================================
// Config
// ============================================================================

const MODELSCOPE_CONFIG = {
  // ── REST API (primary strategy) ──────────────────────────────
  /** ModelScope REST API for MCP server search (supports pagination). */
  restApiUrl: "https://modelscope.cn/openapi/v1/mcp/servers",
  /** Page size for REST API pagination. Max 100. */
  restPageSize: 100,
  /** Max pages to fetch via REST API. */
  restMaxPages: 200,
  /** Per-page HTTP timeout (ms). */
  restTimeoutMs: 15_000,
  /** Delay between REST API pages (ms). */
  restDelayMs: 300,

  // ── MCP protocol (fallback strategy) ─────────────────────────
  /** uvx command to launch modelscope-mcp-server. */
  command: "uvx",
  args: ["modelscope-mcp-server"],
  /** Max items to fetch per search call (API hard limit). */
  searchLimit: 100,
  /**
   * All 14 categories supported by search_mcp_servers.
   * From modelscope-mcp-server source: tools/mcp.py
   * Used only in MCP fallback mode.
   */
  categories: [
    "browser-automation",
    "search",
    "communication",
    "customer-and-marketing",
    "developer-tools",
    "entertainment-and-media",
    "file-systems",
    "finance",
    "knowledge-and-memory",
    "location-services",
    "art-and-culture",
    "research-and-data",
    "calendar-management",
    "other",
  ] as const,
  /** Delay between MCP search calls (ms). */
  searchDelayMs: 300,
  /** Delay between detail requests (ms): random between min and max. */
  detailDelayMinMs: 1000,
  detailDelayMaxMs: 3000,
  /** Max servers to fetch detail for (MCP mode only). */
  detailThreshold: 200,
  /** Connect timeout for the temporary MCP Server (ms). */
  connectTimeoutMs: 60_000,
  /** Individual tool call timeout (ms). */
  callTimeoutMs: 30_000,

  // ── Shared ───────────────────────────────────────────────────
  /** Get token from env. */
  token: () => process.env.MODELSCOPE_API_TOKEN?.trim() || "",
  /** Max retries for the entire fetch operation. */
  maxRetries: 2,
  /** Base URL pattern for ModelScope SSE-hosted servers. */
  sseUrlPattern: "https://{name}.api-inference.modelscope.net/sse",
  /** PyPI mirror for China (Tsinghua). */
  pypiMirror: "https://pypi.tuna.tsinghua.edu.cn/simple",
};

// ============================================================================
// Core
// ============================================================================

/**
 * Fetch MCP server listings from ModelScope.
 *
 * Strategy:
 *   1. Try REST API first (fast, supports pagination, gets ALL servers)
 *   2. Fall back to MCP protocol if REST fails (slower, limited to ~500)
 *
 * Returns an empty array (without throwing) if:
 *   - MODELSCOPE_API_TOKEN is not set
 *   - Both strategies fail
 */
export async function fetchFromModelScope(): Promise<McpMarketplaceItem[]> {
  const token = MODELSCOPE_CONFIG.token();
  if (!token) {
    logger.debug("MODELSCOPE_API_TOKEN not set, skipping ModelScope source");
    return [];
  }

  // Strategy 1: REST API (fast, paginated, gets ALL servers)
  try {
    const items = await fetchViaRestApi(token);
    if (items.length > 0) {
      logger.info(`ModelScope REST API returned ${items.length} items`);
      return items;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`ModelScope REST API failed: ${msg}, falling back to MCP protocol`);
  }

  // Strategy 2: MCP protocol fallback (spawns modelscope-mcp-server)
  for (let attempt = 1; attempt <= MODELSCOPE_CONFIG.maxRetries; attempt++) {
    try {
      return await doFetchViaMcp(token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        `ModelScope MCP fallback attempt ${attempt}/${MODELSCOPE_CONFIG.maxRetries} failed: ${msg}`,
      );

      if (attempt < MODELSCOPE_CONFIG.maxRetries) {
        const backoffMs = 5000 * 2 ** (attempt - 1);
        await sleep(backoffMs);
      }
    }
  }

  logger.warn("All ModelScope fetch strategies failed, returning empty");
  return [];
}

// ============================================================================
// Strategy 1: REST API (fast, paginated)
// ============================================================================

/**
 * Fetch MCP servers via ModelScope's REST API with exhaustive search.
 *
 * The API endpoint `PUT /openapi/v1/mcp/servers` has a hard limit:
 *   page_number × page_size ≤ 100
 * So each query returns at most 100 items with NO pagination.
 *
 * Strategy to get ALL 7000+ servers:
 *   1. General search + category filters + is_hosted filters
 *   2. Single-character searches (a-z, 0-9) — ~2700 unique
 *   3. Two-character searches (aa-zz) — reaches ~7000+ unique
 *
 * Each query takes ~200ms, total ~700 queries ≈ 3-4 min.
 * This is faster than spawning modelscope-mcp-server (no Python needed).
 */
async function fetchViaRestApi(token: string): Promise<McpMarketplaceItem[]> {
  const seen = new Set<string>();
  const allServers: ModelScopeServerBasic[] = [];

  logger.info("Fetching from ModelScope REST API (exhaustive search)...");

  // Helper to fetch one query
  const fetchQuery = async (search: string, filter: Record<string, unknown>): Promise<number> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MODELSCOPE_CONFIG.restTimeoutMs);

    let response: Response;
    try {
      response = await fetch(MODELSCOPE_CONFIG.restApiUrl, {
        method: "PUT",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "OpenClawCN-MCP-Sync/1.0",
        },
        body: JSON.stringify({
          search,
          filter,
          page_number: 1,
          page_size: MODELSCOPE_CONFIG.restPageSize,
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) return 0;

    const raw = (await response.json()) as Record<string, unknown>;
    const data = raw.data as Record<string, unknown> | undefined;
    const serverList = (data?.mcp_server_list ?? data?.items ?? []) as Record<string, unknown>[];

    let added = 0;
    for (const s of serverList) {
      const id = String(s.id ?? s.server_id ?? s.name ?? "");
      if (id && !seen.has(id)) {
        seen.add(id);
        allServers.push({
          id,
          name: String(s.name ?? id),
          description: String(s.description ?? ""),
          tags: Array.isArray(s.tags) ? s.tags.map(String) : undefined,
        });
        added++;
      }
    }
    return added;
  };

  // Phase 1: General + category + is_hosted searches (~18 queries)
  await fetchQuery("", {});
  const categories = [
    "browser-automation",
    "search",
    "communication",
    "customer-and-marketing",
    "developer-tools",
    "entertainment-and-media",
    "file-systems",
    "finance",
    "knowledge-and-memory",
    "location-services",
    "art-and-culture",
    "research-and-data",
    "calendar-management",
    "other",
  ];
  for (const cat of categories) {
    await sleep(MODELSCOPE_CONFIG.restDelayMs);
    await fetchQuery("", { category: cat });
  }
  for (const hosted of [true, false]) {
    await sleep(MODELSCOPE_CONFIG.restDelayMs);
    await fetchQuery("", { is_hosted: hosted });
  }
  logger.info(`Phase 1 (category+filter): ${allServers.length} unique servers`);

  // Phase 2: Single-character searches (a-z, 0-9) — ~36 queries
  const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (const ch of CHARS) {
    await sleep(MODELSCOPE_CONFIG.restDelayMs);
    await fetchQuery(ch, {});
  }
  logger.info(`Phase 2 (single-char): ${allServers.length} unique servers`);

  // Phase 3: Two-character searches — ~676 queries
  // Only search combos that are likely to yield new results
  const LETTERS = "abcdefghijklmnopqrstuvwxyz";
  for (const c1 of LETTERS) {
    for (const c2 of LETTERS) {
      await sleep(MODELSCOPE_CONFIG.restDelayMs);
      await fetchQuery(c1 + c2, {});
    }
    if ((LETTERS.indexOf(c1) + 1) % 5 === 0) {
      logger.debug(`Phase 3 progress: "${c1}*" done, ${allServers.length} unique servers so far`);
    }
  }
  logger.info(`Phase 3 (two-char): ${allServers.length} unique servers`);

  if (allServers.length === 0) return [];

  const items: McpMarketplaceItem[] = [];
  for (const server of allServers) {
    const item = normalizeFromBasicInfo(server);
    if (item) items.push(item);
  }

  logger.info(`ModelScope REST API: ${items.length} items normalized`);
  return items;
}

// ============================================================================
// Strategy 2: MCP protocol fallback
// ============================================================================

async function doFetchViaMcp(token: string): Promise<McpMarketplaceItem[]> {
  let client: Client | null = null;
  let transport: StdioClientTransport | null = null;

  try {
    // Build safe env: only pass the API token + Python mirror
    const env: Record<string, string> = {
      MODELSCOPE_API_TOKEN: token,
      UV_INDEX_URL: MODELSCOPE_CONFIG.pypiMirror,
    };
    // Inherit PATH so uvx can be found
    if (process.env.PATH) env.PATH = process.env.PATH;
    if (process.env.Path) env.Path = process.env.Path;
    if (process.env.HOME) env.HOME = process.env.HOME;
    if (process.env.USERPROFILE) env.USERPROFILE = process.env.USERPROFILE;

    logger.info("Spawning modelscope-mcp-server for marketplace sync...");

    transport = new StdioClientTransport({
      command: MODELSCOPE_CONFIG.command,
      args: MODELSCOPE_CONFIG.args,
      env,
      stderr: "pipe",
    });

    client = new Client(
      { name: "openclawcn-marketplace-sync", version: "1.0.0" },
      { capabilities: {} },
    );

    // Drain stderr
    const stderrStream = transport.stderr;
    if (stderrStream) {
      stderrStream.on("data", () => {
        /* drain */
      });
      stderrStream.on("error", () => {
        /* ignore */
      });
    }

    // Connect with timeout
    const connectPromise = client.connect(transport);
    let connectTimer: ReturnType<typeof setTimeout> | null = null;
    const connectTimeout = new Promise<never>((_, reject) => {
      connectTimer = setTimeout(
        () => reject(new Error("modelscope-mcp-server connect timeout")),
        MODELSCOPE_CONFIG.connectTimeoutMs,
      );
    });

    try {
      await Promise.race([connectPromise, connectTimeout]);
    } finally {
      if (connectTimer != null) clearTimeout(connectTimer);
    }

    logger.info("modelscope-mcp-server connected, fetching server list...");

    // ================================================================
    // Step 1: Multi-category search to bypass 100-item API limit.
    // The search_mcp_servers API has no pagination (hardcoded page 1),
    // so we search each of the 14 categories separately and also
    // do a general (no-category) search, then deduplicate.
    // ================================================================
    const seen = new Set<string>();
    const allServers: ModelScopeServerBasic[] = [];

    // 1a. General search (no category filter) — catches uncategorized servers
    const generalResult = await callToolWithTimeout(client, "search_mcp_servers", {
      search: "",
      limit: MODELSCOPE_CONFIG.searchLimit,
    });
    for (const s of parseSearchResult(generalResult)) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        allServers.push(s);
      }
    }
    logger.info(`General search returned ${allServers.length} servers`);

    // 1b. Per-category searches
    for (const category of MODELSCOPE_CONFIG.categories) {
      try {
        await sleep(MODELSCOPE_CONFIG.searchDelayMs);
        const result = await callToolWithTimeout(client, "search_mcp_servers", {
          search: "",
          category,
          limit: MODELSCOPE_CONFIG.searchLimit,
        });
        let added = 0;
        for (const s of parseSearchResult(result)) {
          if (!seen.has(s.id)) {
            seen.add(s.id);
            allServers.push(s);
            added++;
          }
        }
        if (added > 0) {
          logger.debug(`Category "${category}": +${added} new servers`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.debug(`Category "${category}" search failed: ${msg}`);
      }
    }

    // 1c. Also search with is_hosted=true and is_hosted=false separately
    for (const isHosted of [true, false]) {
      try {
        await sleep(MODELSCOPE_CONFIG.searchDelayMs);
        const result = await callToolWithTimeout(client, "search_mcp_servers", {
          search: "",
          is_hosted: isHosted,
          limit: MODELSCOPE_CONFIG.searchLimit,
        });
        let added = 0;
        for (const s of parseSearchResult(result)) {
          if (!seen.has(s.id)) {
            seen.add(s.id);
            allServers.push(s);
            added++;
          }
        }
        if (added > 0) {
          logger.debug(`is_hosted=${isHosted}: +${added} new servers`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.debug(`is_hosted=${isHosted} search failed: ${msg}`);
      }
    }

    if (allServers.length === 0) {
      logger.info("ModelScope returned 0 MCP servers across all categories");
      return [];
    }

    logger.info(`ModelScope: ${allServers.length} unique servers found across all searches`);

    // ================================================================
    // Step 2: Fetch details (conditionally).
    // When total servers exceed detailThreshold, skip per-server detail
    // calls (would take hours with rate limiting) and normalize from
    // the search result data alone.
    // ================================================================
    const items: McpMarketplaceItem[] = [];

    if (allServers.length <= MODELSCOPE_CONFIG.detailThreshold) {
      // Small enough to fetch details individually
      logger.info(`Fetching details for ${allServers.length} servers...`);
      for (const server of allServers) {
        try {
          await sleep(randomDelay());
          const detailResult = await callToolWithTimeout(client, "get_mcp_server_detail", {
            server_id: server.id,
          });
          const item = normalizeToMarketplaceItem(server, detailResult);
          if (item) items.push(item);
        } catch (err) {
          // Detail fetch failed — fall back to basic info
          const item = normalizeFromBasicInfo(server);
          if (item) items.push(item);
          const msg = err instanceof Error ? err.message : String(err);
          logger.debug(`Failed to get detail for ${server.id}: ${msg}`);
        }
      }
    } else {
      // Too many servers — normalize from search result data only
      logger.info(
        `${allServers.length} servers exceeds detail threshold (${MODELSCOPE_CONFIG.detailThreshold}), using search data only`,
      );
      for (const server of allServers) {
        const item = normalizeFromBasicInfo(server);
        if (item) items.push(item);
      }
    }

    logger.info(`ModelScope: ${items.length}/${allServers.length} items normalized successfully`);
    return items;
  } finally {
    // Always clean up the temporary server
    try {
      await client?.close();
    } catch {
      /* ignore */
    }
    try {
      await transport?.close();
    } catch {
      /* ignore */
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

async function callToolWithTimeout(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const callPromise = client.callTool({ name, arguments: args });
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Tool call "${name}" timeout`)),
      MODELSCOPE_CONFIG.callTimeoutMs,
    );
  });
  try {
    const result = await Promise.race([callPromise, timeoutPromise]);
    return (result as { content: unknown }).content;
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}

interface ModelScopeServerBasic {
  id: string;
  name?: string;
  description?: string;
  tags?: string[];
}

function mapToBasic(s: Record<string, unknown>): ModelScopeServerBasic {
  return {
    id: String(s.id ?? s.server_id ?? s.name ?? ""),
    name: String(s.name ?? s.id ?? ""),
    description: String(s.description ?? ""),
    tags: Array.isArray(s.tags) ? s.tags.map(String) : undefined,
  };
}

/**
 * Parse the raw search result from search_mcp_servers.
 * The tool returns text content — we parse it as JSON or
 * extract server IDs from structured text.
 */
function parseSearchResult(content: unknown): ModelScopeServerBasic[] {
  try {
    // Content may be an array of { type: "text", text: "..." }
    const text = extractText(content);
    if (!text) return [];

    // Try JSON parse
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((s: Record<string, unknown>) => s && (s.id || s.name || s.server_id))
        .map(mapToBasic);
    }
    // May be wrapped: { servers: [...] } or { data: [...] }
    const arr = parsed.servers ?? parsed.data ?? parsed.items ?? parsed.results;
    if (Array.isArray(arr)) {
      return arr
        .filter((s: Record<string, unknown>) => s && (s.id || s.name || s.server_id))
        .map(mapToBasic);
    }
  } catch {
    // Not JSON — attempt to extract from text
    const text = extractText(content);
    if (text) {
      // Simple line-based extraction as fallback
      const lines = text.split("\n").filter(Boolean);
      return lines
        .filter((l) => l.includes("server") || l.includes("mcp"))
        .slice(0, MODELSCOPE_CONFIG.searchLimit)
        .map((l) => ({ id: l.trim(), name: l.trim(), description: "" }));
    }
  }
  return [];
}

/**
 * Extract text content from MCP tool result.
 * Results are typically: [{ type: "text", text: "..." }] or a plain string.
 */
function extractText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const textPart = content.find(
      (c: Record<string, unknown>) => c && c.type === "text" && typeof c.text === "string",
    );
    if (textPart) return (textPart as { text: string }).text;
    // Fallback: join all text parts
    return (
      content
        .filter((c: Record<string, unknown>) => c && typeof c.text === "string")
        .map((c: { text: string }) => c.text)
        .join("\n") || null
    );
  }
  if (content && typeof content === "object" && "text" in content) {
    return String((content as { text: unknown }).text);
  }
  return null;
}

/**
 * Normalize a server entry from search result data only (no detail call).
 * Used when server count exceeds detailThreshold.
 */
function normalizeFromBasicInfo(basic: ModelScopeServerBasic): McpMarketplaceItem | null {
  if (!basic.id) return null;
  const serverId = basic.id.replace(/\//g, "-");
  const name = basic.name || serverId;
  const description = basic.description || "";
  const category = inferCategory(basic.tags ?? [], name, description);

  return {
    serverId,
    friendlyName: name,
    friendlyNameEn: name,
    description,
    descriptionEn: description,
    category,
    tags: basic.tags ?? [],
    version: "0.0.0",
    // Don't generate synthetic SSE URL — most ModelScope servers are NOT hosted,
    // so the synthetic URL is a dead endpoint that causes install failures.
    // Items without install info will show "manual config" in the UI.
    requiresApiKey: false,
    platforms: ["linux", "macos", "windows"],
    isOfficial: false,
    isNew: false,
    toolCount: 0,
    source: "modelscope",
    sourceUrl: `https://modelscope.cn/mcp/servers/${serverId}`,
  };
}

/**
 * Normalize a ModelScope server entry + its detail into our marketplace format.
 */
function normalizeToMarketplaceItem(
  basic: ModelScopeServerBasic,
  detailContent: unknown,
): McpMarketplaceItem | null {
  try {
    const detailText = extractText(detailContent);
    let detail: Record<string, unknown> = {};
    if (detailText) {
      try {
        detail = JSON.parse(detailText);
      } catch {
        /* use basic info only */
      }
    }

    const serverId = String(detail.id ?? detail.server_id ?? basic.id).replace(/\//g, "-");
    const name = String(detail.name ?? detail.friendly_name ?? basic.name ?? serverId);
    const description = String(detail.description ?? basic.description ?? "");
    const version = String(detail.version ?? detail.latest_version ?? "0.0.0");
    const tags = Array.isArray(detail.tags) ? detail.tags.map(String) : [];
    const category = inferCategory(tags, name, description);

    return {
      serverId,
      friendlyName: name,
      friendlyNameEn: name,
      description,
      descriptionEn: description,
      category,
      tags,
      version,
      npmPackage: typeof detail.npm_package === "string" ? detail.npm_package : undefined,
      pypiPackage: typeof detail.pypi_package === "string" ? detail.pypi_package : undefined,
      sseUrl: sanitizeSseUrl(
        typeof detail.sse_url === "string"
          ? detail.sse_url
          : MODELSCOPE_CONFIG.sseUrlPattern.replace("{name}", serverId),
      ),
      securityScore: typeof detail.security_score === "number" ? detail.security_score : undefined,
      requiresApiKey: detail.requires_api_key === true,
      apiKeyName: typeof detail.api_key_name === "string" ? detail.api_key_name : undefined,
      apiKeyGuideUrl:
        typeof detail.api_key_guide_url === "string" ? detail.api_key_guide_url : undefined,
      platforms: Array.isArray(detail.platforms)
        ? detail.platforms.map(String)
        : ["linux", "macos", "windows"],
      isOfficial: detail.is_official === true,
      isNew: isRecentlyCreated(detail.created_at ?? detail.gmt_create),
      toolCount: typeof detail.tool_count === "number" ? detail.tool_count : 0,
      capabilities: Array.isArray(detail.capabilities)
        ? detail.capabilities.map(String)
        : undefined,
      examplePrompts: Array.isArray(detail.example_prompts)
        ? detail.example_prompts.map(String)
        : undefined,
      toolNames: Array.isArray(detail.tool_names) ? detail.tool_names.map(String) : undefined,
      source: "modelscope",
      sourceUrl: `https://modelscope.cn/mcp/servers/${serverId}`,
    };
  } catch (err) {
    logger.debug(
      `Failed to normalize ${basic.id}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Infer category from tags, name, and description.
 */
function inferCategory(tags: string[], name: string, description: string): string {
  const text = [...tags, name, description].join(" ").toLowerCase();
  if (/file|文件|filesystem|directory/.test(text)) return "filesystem";
  if (/database|数据库|sql|sqlite|postgres|mysql/.test(text)) return "database";
  if (/search|搜索|google|bing/.test(text)) return "search";
  if (/develop|开发|code|git|github/.test(text)) return "development";
  if (/network|网络|http|fetch|api/.test(text)) return "network";
  if (/ai|模型|model|image|图像/.test(text)) return "ai";
  if (/productivity|办公|notion|calendar/.test(text)) return "productivity";
  if (/social|社交|slack|discord/.test(text)) return "social";
  if (/smart.*home|智能家居|iot/.test(text)) return "smarthome";
  return "other";
}

/**
 * Consider a server "new" if created within the last 30 days.
 */
function isRecentlyCreated(createdAt: unknown): boolean {
  if (!createdAt) return false;
  try {
    const ts = typeof createdAt === "number" ? createdAt : Date.parse(String(createdAt));
    if (Number.isNaN(ts)) return false;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    return Date.now() - ts < thirtyDaysMs;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(): number {
  return (
    MODELSCOPE_CONFIG.detailDelayMinMs +
    Math.random() * (MODELSCOPE_CONFIG.detailDelayMaxMs - MODELSCOPE_CONFIG.detailDelayMinMs)
  );
}
