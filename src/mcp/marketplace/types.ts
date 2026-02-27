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
  /** Environment variable schema from ModelScope env_schema.
   *  Keys are env var names, values have description and optional placeholder. */
  envSchema?: Record<string, { description?: string; placeholder?: string }>;
  /** Required environment variable names (subset of envSchema keys). */
  envRequired?: string[];
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

  // ========== AI Enhancement Fields ==========

  /** Chinese translation (优先显示) */
  friendlyNameCn?: string;
  /** Chinese description */
  descriptionCn?: string;
  /** AI-generated Chinese tags (5-8 tags for multi-dimensional search) */
  tagsCn?: string[];

  /** Availability for China users */
  availability?: {
    /** Requires VPN to access (depends on blocked APIs like OpenAI/GitHub) */
    requiresVPN: boolean;
    /** China-friendliness score: 0-100, higher = better for China users */
    chinaFriendlyScore: number;
    /** Reasons for low score (if <50) */
    chinaBlockReasons?: string[];
  };

  /** Runtime and system requirements */
  requirements?: {
    /** Runtime dependencies, e.g. ["Node.js >=18", "Python 3.10+"] */
    runtimeDeps?: string[];
    /** Platform-specific notes */
    platformNotes?: string;
    /** System-level dependencies, e.g. ["Docker", "PostgreSQL"] */
    systemDeps?: string[];
  };

  /** Multi-label category with confidence scores */
  categoryEnhanced?: Array<{
    category: string;
    confidence: number; // 0-100
  }>;

  /** AI enhancement metadata */
  aiEnhancement?: {
    /** Enhancement timestamp */
    enhancedAt: string;
    /** Model used for enhancement */
    model: string;
    /** Enhancement version (for re-processing) */
    version: number;

    /** Recommendation scores for intelligent matching */
    recommendationScore?: {
      /** Beginner-friendly score 0-100 */
      beginnerFriendly: number;
      /** Enterprise readiness 0-100 */
      enterpriseReady: number;
      /** Community activity 0-100 */
      communityActivity: number;
    };

    /** Use case keywords for semantic matching */
    useCaseKeywords?: string[];
    /** Alternative/similar service IDs */
    alternatives?: string[];
    /** Prerequisite MCPs (must install first) */
    prerequisites?: string[];
  };
}

// ============================================================================
// SSE URL credential sanitization
// ============================================================================

/** Query parameter names that commonly contain credentials. */
const CRED_PARAM_PATTERNS = [
  "key",
  "apikey",
  "api_key",
  "token",
  "api_token",
  "secret",
  "password",
  "bearer",
  "auth",
  "authorization",
  "access_token",
  "hap-sign",
  "hap-appkey",
  "sessionid",
];

/** Values that are clearly placeholders (not real credentials). */
const PLACEHOLDER_RE = /your[_\s-]*(api)?[_\s-]?key|YOUR_|你.*key|您.*key|\{\{|\$\{|<your/i;

/**
 * Strip embedded credentials from an SSE URL.
 * Returns the sanitized URL, or the original if nothing changed.
 */
export function sanitizeSseUrl(url: string | undefined): string | undefined {
  if (!url || typeof url !== "string") return url;
  try {
    const u = new URL(url);
    const params = new URLSearchParams(u.search);
    let changed = false;
    for (const name of [...params.keys()]) {
      const nameLower = name.toLowerCase();
      const value = params.get(name) ?? "";
      const isCred =
        CRED_PARAM_PATTERNS.some((p) => nameLower === p) ||
        nameLower.includes("key") ||
        nameLower.includes("token") ||
        nameLower.includes("secret") ||
        nameLower.includes("sign") ||
        nameLower.includes("auth");
      if (
        isCred &&
        !PLACEHOLDER_RE.test(value) &&
        value.length > 10 &&
        /^[A-Za-z0-9+/=_-]+$/.test(value)
      ) {
        params.set(name, `YOUR_${name.toUpperCase()}`);
        changed = true;
      }
    }
    if (changed) {
      u.search = params.toString();
      return u.toString();
    }
  } catch {
    /* invalid URL — return as-is */
  }
  return url;
}

// ============================================================================
// Data Source
// ============================================================================

export type MarketplaceSourceName =
  | "cloud-index"
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
