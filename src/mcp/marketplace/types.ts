/**
 * MCP Marketplace shared types.
 *
 * Used by all data sources (ModelScope, Official Registry, ClawdSkillsProxy)
 * and the sync pipeline.
 */

// ============================================================================
// Marketplace Item (normalized)
// ============================================================================

/**
 * A single MCP server entry in the marketplace index.
 * This is the **write-side** format stored in `mcp-index.json`.
 * The UI-side `McpMarketplaceItem` (in app-view-state.ts) extends this
 * with install status and other runtime fields at read time.
 */
export interface McpMarketplaceItem {
  /** Unique identifier, e.g. "filesystem", "modelscope/fetch". */
  serverId: string;
  /** Human-readable name (Chinese preferred). */
  friendlyName: string;
  /** English name (for search / fallback). */
  friendlyNameEn?: string;
  /** Chinese description. */
  description: string;
  /** English description (for search / fallback). */
  descriptionEn?: string;
  /** Category slug: filesystem, database, search, productivity, development, etc. */
  category: string;
  /** Searchable tags. */
  tags: string[];
  /** Semver version string, e.g. "1.2.3". */
  version: string;
  /** npm package name (for stdio install via npx). */
  npmPackage?: string;
  /** Python package name (for install via uvx). */
  pypiPackage?: string;
  /** SSE URL for cloud-hosted MCP servers (ModelScope hosted). */
  sseUrl?: string;
  /** Security score 0-100. */
  securityScore?: number;
  /** Whether this MCP server requires an API key to function. */
  requiresApiKey: boolean;
  /** Name of the required API key env var. */
  apiKeyName?: string;
  /** Guide URL for obtaining the API key. */
  apiKeyGuideUrl?: string;
  /** Supported platforms. */
  platforms: string[];
  /** Official / verified badge. */
  isOfficial: boolean;
  /** Recently added. */
  isNew: boolean;
  /** Number of tools exposed. */
  toolCount: number;
  /** Human-readable capability bullets. */
  capabilities?: string[];
  /** Example user prompts. */
  examplePrompts?: string[];
  /** Tool name list (for preview). */
  toolNames?: string[];

  // ---- Source metadata ----

  /** Which data source provided this item. */
  source: MarketplaceSourceName;
  /** Link to the source detail page (e.g. ModelScope detail page). */
  sourceUrl?: string;
}

// ============================================================================
// Data Source
// ============================================================================

export type MarketplaceSourceName =
  | "modelscope"
  | "official-registry"
  | "clawdskillsproxy";

/**
 * A pluggable marketplace data source.
 * Lower priority number = tried first.
 */
export interface MarketplaceSource {
  /** Human-readable name for logging. */
  name: string;
  /** Priority order. 1 = first. */
  priority: number;
  /** Fetch items from this source. May throw on network errors. */
  fetch(): Promise<McpMarketplaceItem[]>;
}

// ============================================================================
// Sync result
// ============================================================================

export interface McpSyncResultExtended {
  ok: boolean;
  error?: string;
  synced: boolean;
  itemCount?: number;
  /** Which source ultimately provided the data. */
  source?: MarketplaceSourceName;
}
