/**
 * mcp-lifecycle.ts
 * MCP lifecycle controller — init / degrade / restart / sync.
 *
 * Responsibilities:
 *   1. Populate default built-in MCP capabilities on init
 *   2. Merge live process status from Gateway RPC (when available)
 *   3. Handle restart, disable, and check-update actions
 *   4. Manage update-notice state
 *
 * The controller is intentionally stateless: it returns data and calls
 * back via `McpLifecycleCallbacks.onStateChange`.  The host (app.ts)
 * owns the actual reactive state.
 */

import { t } from "../i18n/index.js";
import type {
  McpCapability,
  McpCapabilityStatus,
  McpProcessInfo,
  McpMarketplaceItem,
  McpMarketplaceState,
} from "../app-view-state.js";

// ============================================================================
// Types
// ============================================================================

export type GatewayClient = {
  request: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
};

export type McpLifecycleState = {
  capabilities: McpCapability[];
  processes: McpProcessInfo[];
  updateNotice: { count: number; names: string[] } | null;
};

export type McpLifecycleCallbacks = {
  onStateChange: (patch: Partial<McpLifecycleState>) => void;
};

// ============================================================================
// Built-in capability definitions
// ============================================================================

/**
 * Static registry of built-in MCP capabilities.
 *
 * Each entry declares a capability with:
 *   - id:            stable key (used in Gateway RPC)
 *   - i18nKey:       suffix for `mcpCapability.<key>` translation
 *   - descKeys:      i18n keys for the description bullet list
 *   - exampleKey:    i18n key for the "try saying" prompt
 *   - defaultStatus: status when no live data is available
 *   - configNeeded:  if the capability requires API key setup
 */
type BuiltinCapabilityDef = {
  id: string;
  i18nKey: string;
  descKeys: string[];
  exampleKey: string;
  defaultStatus: McpCapabilityStatus;
  configNeeded?: string;
};

const BUILTIN_CAPABILITIES: BuiltinCapabilityDef[] = [
  {
    id: "filesystem",
    i18nKey: "filesystem",
    descKeys: [
      "mcpCapability.filesystem.desc1",
      "mcpCapability.filesystem.desc2",
    ],
    exampleKey: "mcpCapability.filesystem.example",
    defaultStatus: "ready",
  },
  {
    id: "sqlite",
    i18nKey: "sqlite",
    descKeys: [
      "mcpCapability.sqlite.desc1",
      "mcpCapability.sqlite.desc2",
    ],
    exampleKey: "mcpCapability.sqlite.example",
    defaultStatus: "ready",
  },
  {
    id: "fetch",
    i18nKey: "fetch",
    descKeys: [
      "mcpCapability.fetch.desc1",
      "mcpCapability.fetch.desc2",
    ],
    exampleKey: "mcpCapability.fetch.example",
    defaultStatus: "ready",
  },
  {
    id: "time",
    i18nKey: "time",
    descKeys: [
      "mcpCapability.time.desc1",
    ],
    exampleKey: "mcpCapability.time.example",
    defaultStatus: "ready",
  },
  {
    id: "thinking",
    i18nKey: "thinking",
    descKeys: [
      "mcpCapability.thinking.desc1",
    ],
    exampleKey: "mcpCapability.thinking.example",
    defaultStatus: "ready",
  },
  // weather, search, maps — 需要 API Key 的能力暂不预装，
  // 待 Phase 2/3 爬取管线接入后通过服务端同步动态添加。
];

// ============================================================================
// Initial state
// ============================================================================

export function createInitialMcpState(): McpLifecycleState {
  return {
    capabilities: [],
    processes: [],
    updateNotice: null,
  };
}

// ============================================================================
// Initialise capabilities (called once after Gateway hello)
// ============================================================================

/**
 * Build the default capability list from the built-in registry.
 * Translation keys are resolved at call time so the current locale is used.
 */
function buildDefaultCapabilities(): McpCapability[] {
  return BUILTIN_CAPABILITIES.map((def) => ({
    id: def.id,
    friendlyName: t(`mcpCapability.${def.i18nKey}` as never),
    status: def.defaultStatus,
    description: def.descKeys.map((k) => t(k as never)),
    examplePrompt: t(def.exampleKey as never),
    configNeeded: def.configNeeded,
    isNew: false,
  }));
}

/**
 * Populate initial capabilities.
 * If the Gateway provides a `mcp.status` RPC, we merge live data on top
 * of the defaults.  Otherwise we return pure defaults.
 */
export async function initMcpCapabilities(
  client: GatewayClient | null,
  callbacks: McpLifecycleCallbacks,
): Promise<void> {
  // Start with defaults
  const defaults = buildDefaultCapabilities();

  if (!client) {
    callbacks.onStateChange({ capabilities: defaults });
    return;
  }

  try {
    const response = await client.request("mcp.status");

    if (response && typeof response === "object") {
      const data = response as {
        capabilities?: Array<{
          id: string;
          status: McpCapabilityStatus;
          isNew?: boolean;
        }>;
        processes?: McpProcessInfo[];
      };

      // Merge live status into defaults
      const capabilities = mergeCapabilities(defaults, data.capabilities ?? []);
      const processes = data.processes ?? [];

      // Detect new capabilities for update notice
      const newCaps = capabilities.filter((c) => c.isNew);
      const updateNotice =
        newCaps.length > 0
          ? { count: newCaps.length, names: newCaps.map((c) => c.friendlyName) }
          : null;

      callbacks.onStateChange({ capabilities, processes, updateNotice });
    } else {
      // RPC returned empty — use defaults
      callbacks.onStateChange({ capabilities: defaults });
    }
  } catch {
    // mcp.status not implemented yet — use defaults silently
    callbacks.onStateChange({ capabilities: defaults });
  }
}

// ============================================================================
// Merge helpers
// ============================================================================

function mergeCapabilities(
  defaults: McpCapability[],
  live: Array<{ id: string; status: McpCapabilityStatus; isNew?: boolean }>,
): McpCapability[] {
  const liveMap = new Map(live.map((c) => [c.id, c]));

  return defaults.map((def) => {
    const override = liveMap.get(def.id);
    if (!override) return def;
    return {
      ...def,
      status: override.status,
      isNew: override.isNew ?? def.isNew,
    };
  });
}

// ============================================================================
// Lifecycle actions
// ============================================================================

/**
 * Restart an MCP server process.
 */
export async function restartMcpServer(
  client: GatewayClient | null,
  serverId: string,
  callbacks: McpLifecycleCallbacks,
): Promise<void> {
  if (!client) return;
  try {
    await client.request("mcp.restart", { id: serverId });
    // Re-fetch status after restart
    await initMcpCapabilities(client, callbacks);
  } catch (err) {
    console.error("[mcp-lifecycle] restart failed:", serverId, err);
  }
}

/**
 * Disable an MCP server.
 */
export async function disableMcpServer(
  client: GatewayClient | null,
  serverId: string,
  callbacks: McpLifecycleCallbacks,
): Promise<void> {
  if (!client) return;
  try {
    await client.request("mcp.disable", { id: serverId });
    await initMcpCapabilities(client, callbacks);
  } catch (err) {
    console.error("[mcp-lifecycle] disable failed:", serverId, err);
  }
}

/**
 * Check for capability updates (new MCP servers or tool changes).
 */
export async function checkMcpUpdate(
  client: GatewayClient | null,
  callbacks: McpLifecycleCallbacks,
): Promise<void> {
  if (!client) return;
  try {
    await client.request("mcp.sync");
    await initMcpCapabilities(client, callbacks);
  } catch (err) {
    console.error("[mcp-lifecycle] check update failed:", err);
  }
}

/**
 * Handle "Configure & Enable" for a capability that needs an API key.
 * Opens the config page with the relevant section pre-selected.
 */
export function handleConfigClick(
  capabilityId: string,
  setTab: (tab: string) => void,
  setConfigSection: (section: string) => void,
): void {
  setConfigSection(`mcp.${capabilityId}`);
  setTab("config");
}

// ============================================================================
// Marketplace controller
// ============================================================================

export type MarketplaceCallbacks = {
  onStateChange: (patch: Partial<McpMarketplaceState>) => void;
};

/**
 * Fetch the marketplace item list from Gateway.
 * Falls back gracefully if RPC is not yet implemented.
 */
export async function loadMarketplaceItems(
  client: GatewayClient | null,
  callbacks: MarketplaceCallbacks,
): Promise<void> {
  if (!client) {
    callbacks.onStateChange({ loading: false, error: "No gateway connection" });
    return;
  }

  callbacks.onStateChange({ loading: true, error: null });

  try {
    const response = await client.request("mcp.marketplace.list");

    if (response && typeof response === "object") {
      const data = response as { items?: McpMarketplaceItem[] };
      callbacks.onStateChange({
        items: data.items ?? [],
        loading: false,
        error: null,
      });
    } else {
      callbacks.onStateChange({ items: [], loading: false });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    callbacks.onStateChange({ items: [], loading: false, error: msg });
  }
}

/**
 * Fetch personalized marketplace recommendations from Gateway.
 */
export async function loadMarketplaceRecommendations(
  client: GatewayClient | null,
  callbacks: MarketplaceCallbacks,
): Promise<void> {
  if (!client) return;

  try {
    const response = await client.request("mcp.marketplace.recommend");

    if (response && typeof response === "object") {
      const data = response as { items?: McpMarketplaceItem[] };
      callbacks.onStateChange({ recommendations: data.items ?? [] });
    }
  } catch {
    // Recommendations are optional — silently ignore
  }
}

/**
 * Install a marketplace item via Gateway RPC.
 * Updates the item's installStatus optimistically, then calls the RPC.
 */
export async function installMarketplaceItem(
  client: GatewayClient | null,
  item: McpMarketplaceItem,
  env: Record<string, string> | undefined,
  callbacks: MarketplaceCallbacks & { currentItems: McpMarketplaceItem[] },
): Promise<void> {
  if (!client) return;

  // Optimistic: set installing
  const optimisticItems = callbacks.currentItems.map((i) =>
    i.serverId === item.serverId
      ? { ...i, installStatus: "installing" as const }
      : i,
  );
  callbacks.onStateChange({ items: optimisticItems });

  try {
    await client.request("mcp.marketplace.install", {
      serverId: item.serverId,
      ...(env ? { env } : {}),
    });

    // Success: mark installed
    const successItems = optimisticItems.map((i) =>
      i.serverId === item.serverId
        ? { ...i, installStatus: "installed" as const }
        : i,
    );
    callbacks.onStateChange({ items: successItems });
  } catch (err) {
    console.error("[mcp-lifecycle] marketplace install failed:", item.serverId, err);

    // Rollback to error state
    const errorItems = optimisticItems.map((i) =>
      i.serverId === item.serverId
        ? { ...i, installStatus: "error" as const }
        : i,
    );
    callbacks.onStateChange({ items: errorItems });
  }
}

/**
 * Fetch detail info for a specific marketplace item.
 */
export async function loadMarketplaceDetail(
  client: GatewayClient | null,
  serverId: string,
  callbacks: MarketplaceCallbacks,
): Promise<void> {
  if (!client) return;

  try {
    const response = await client.request("mcp.marketplace.detail", { serverId });

    if (response && typeof response === "object") {
      const item = response as McpMarketplaceItem;
      callbacks.onStateChange({ detailItem: item });
    }
  } catch (err) {
    console.error("[mcp-lifecycle] marketplace detail failed:", serverId, err);
  }
}
