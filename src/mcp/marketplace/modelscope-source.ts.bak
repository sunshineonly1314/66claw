/**
 * ModelScope (魔搭) MCP data source.
 *
 * Fetches MCP server listings from ModelScope via MCP protocol bootstrapping:
 * we launch `modelscope-mcp-server` as a temporary stdio MCP Server, then
 * call its `search_mcp_servers` and `get_mcp_server_detail` tools to discover
 * available MCP servers on the ModelScope platform.
 *
 * Requires: MODELSCOPE_API_TOKEN environment variable.
 * Install:  uvx modelscope-mcp-server (Python package via Tsinghua PyPI mirror)
 *
 * Anti-scraping strategies:
 *   - Daily sync only (not real-time)
 *   - Random 1–3s delay between detail requests
 *   - Exponential backoff on errors
 *   - 24h disk cache (mcp-index.json)
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { McpMarketplaceItem } from "./types.js";

const logger = createSubsystemLogger("modelscope-source");

// ============================================================================
// Config
// ============================================================================

const MODELSCOPE_CONFIG = {
  /** uvx command to launch modelscope-mcp-server. */
  command: "uvx",
  args: ["modelscope-mcp-server"],
  /** Get token from env. */
  token: () => process.env.MODELSCOPE_API_TOKEN?.trim() || "",
  /** Max items to fetch per search call. */
  searchLimit: 100,
  /** Delay between detail requests (ms): random between min and max. */
  detailDelayMinMs: 1000,
  detailDelayMaxMs: 3000,
  /** Connect timeout for the temporary MCP Server (ms). */
  connectTimeoutMs: 60_000,
  /** Individual tool call timeout (ms). */
  callTimeoutMs: 30_000,
  /** Max retries for the entire fetch operation. */
  maxRetries: 3,
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
 * Returns an empty array (without throwing) if:
 *   - MODELSCOPE_API_TOKEN is not set
 *   - modelscope-mcp-server is not installed / cannot be spawned
 *   - Network or API errors (after retries)
 */
export async function fetchFromModelScope(): Promise<McpMarketplaceItem[]> {
  const token = MODELSCOPE_CONFIG.token();
  if (!token) {
    logger.debug("MODELSCOPE_API_TOKEN not set, skipping ModelScope source");
    return [];
  }

  for (let attempt = 1; attempt <= MODELSCOPE_CONFIG.maxRetries; attempt++) {
    try {
      return await doFetch(token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`ModelScope fetch attempt ${attempt}/${MODELSCOPE_CONFIG.maxRetries} failed: ${msg}`);

      if (attempt < MODELSCOPE_CONFIG.maxRetries) {
        // Exponential backoff: 5s, 10s, 20s
        const backoffMs = 5000 * (2 ** (attempt - 1));
        await sleep(backoffMs);
      }
    }
  }

  logger.warn("All ModelScope fetch attempts failed, returning empty");
  return [];
}

async function doFetch(token: string): Promise<McpMarketplaceItem[]> {
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
      stderrStream.on("data", () => { /* drain */ });
      stderrStream.on("error", () => { /* ignore */ });
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

    // Step 1: Search for MCP servers
    const searchResult = await callToolWithTimeout(
      client,
      "search_mcp_servers",
      { query: "", limit: MODELSCOPE_CONFIG.searchLimit },
    );

    const servers = parseSearchResult(searchResult);
    if (servers.length === 0) {
      logger.info("ModelScope returned 0 MCP servers");
      return [];
    }

    logger.info(`ModelScope returned ${servers.length} MCP servers, fetching details...`);

    // Step 2: Fetch details for each server (with rate limiting)
    const items: McpMarketplaceItem[] = [];
    for (const server of servers) {
      try {
        // Rate limiting: random delay between requests
        await sleep(randomDelay());

        const detailResult = await callToolWithTimeout(
          client,
          "get_mcp_server_detail",
          { server_id: server.id },
        );

        const item = normalizeToMarketplaceItem(server, detailResult);
        if (item) items.push(item);
      } catch (err) {
        // Skip individual failures, continue with remaining servers
        const msg = err instanceof Error ? err.message : String(err);
        logger.debug(`Failed to get detail for ${server.id}: ${msg}`);
      }
    }

    logger.info(`ModelScope: ${items.length}/${servers.length} items normalized successfully`);
    return items;
  } finally {
    // Always clean up the temporary server
    try {
      await client?.close();
    } catch { /* ignore */ }
    try {
      await transport?.close();
    } catch { /* ignore */ }
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
        .map((s: Record<string, unknown>) => ({
          id: String(s.id ?? s.server_id ?? s.name ?? ""),
          name: String(s.name ?? s.id ?? ""),
          description: String(s.description ?? ""),
        }));
    }
    // May be wrapped: { servers: [...] } or { data: [...] }
    const arr = parsed.servers ?? parsed.data ?? parsed.items ?? parsed.results;
    if (Array.isArray(arr)) {
      return arr
        .filter((s: Record<string, unknown>) => s && (s.id || s.name || s.server_id))
        .map((s: Record<string, unknown>) => ({
          id: String(s.id ?? s.server_id ?? s.name ?? ""),
          name: String(s.name ?? s.id ?? ""),
          description: String(s.description ?? ""),
        }));
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
    return content
      .filter((c: Record<string, unknown>) => c && typeof c.text === "string")
      .map((c: { text: string }) => c.text)
      .join("\n") || null;
  }
  if (content && typeof content === "object" && "text" in content) {
    return String((content as { text: unknown }).text);
  }
  return null;
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
      try { detail = JSON.parse(detailText); } catch { /* use basic info only */ }
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
      sseUrl: typeof detail.sse_url === "string"
        ? detail.sse_url
        : MODELSCOPE_CONFIG.sseUrlPattern.replace("{name}", serverId),
      securityScore: typeof detail.security_score === "number" ? detail.security_score : undefined,
      requiresApiKey: detail.requires_api_key === true,
      apiKeyName: typeof detail.api_key_name === "string" ? detail.api_key_name : undefined,
      apiKeyGuideUrl: typeof detail.api_key_guide_url === "string" ? detail.api_key_guide_url : undefined,
      platforms: Array.isArray(detail.platforms) ? detail.platforms.map(String) : ["linux", "macos", "windows"],
      isOfficial: detail.is_official === true,
      isNew: false,
      toolCount: typeof detail.tool_count === "number" ? detail.tool_count : 0,
      capabilities: Array.isArray(detail.capabilities) ? detail.capabilities.map(String) : undefined,
      examplePrompts: Array.isArray(detail.example_prompts) ? detail.example_prompts.map(String) : undefined,
      toolNames: Array.isArray(detail.tool_names) ? detail.tool_names.map(String) : undefined,
      source: "modelscope",
      sourceUrl: `https://modelscope.cn/mcp/servers/${serverId}`,
    };
  } catch (err) {
    logger.debug(`Failed to normalize ${basic.id}: ${err instanceof Error ? err.message : String(err)}`);
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(): number {
  return MODELSCOPE_CONFIG.detailDelayMinMs +
    Math.random() * (MODELSCOPE_CONFIG.detailDelayMaxMs - MODELSCOPE_CONFIG.detailDelayMinMs);
}
