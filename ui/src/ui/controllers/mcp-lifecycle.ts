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
 * Enable a previously disabled MCP server.
 */
export async function enableMcpServer(
  client: GatewayClient | null,
  serverId: string,
  callbacks: McpLifecycleCallbacks,
): Promise<void> {
  if (!client) return;
  try {
    await client.request("mcp.enable", { id: serverId });
    await initMcpCapabilities(client, callbacks);
  } catch (err) {
    console.error("[mcp-lifecycle] enable failed:", serverId, err);
  }
}

/**
 * Test an MCP server connection via the dedicated testConnection RPC.
 * Optionally passes env vars (e.g. API keys from config wizard).
 * Returns the test result including tool count on success.
 */
export async function testMcpServer(
  client: GatewayClient | null,
  serverId: string,
  env?: Record<string, string>,
): Promise<{ ok: boolean; toolCount?: number; error?: string }> {
  if (!client) return { ok: false, error: "No gateway connection" };
  try {
    const response = await client.request("mcp.marketplace.testConnection", {
      serverId,
      ...(env ? { env } : {}),
    }) as { ok?: boolean; toolCount?: number; error?: string } | null;
    return {
      ok: response?.ok ?? false,
      toolCount: response?.toolCount,
      error: response?.error,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
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
  callbacks: MarketplaceCallbacks & { currentItems: McpMarketplaceItem[] | (() => McpMarketplaceItem[]) },
): Promise<void> {
  if (!client) return;

  const getItems = typeof callbacks.currentItems === "function" ? callbacks.currentItems : () => callbacks.currentItems as McpMarketplaceItem[];

  // Optimistic: set installing
  const optimisticItems = getItems().map((i) =>
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

    // Success: mark installed (re-read to avoid overwriting concurrent changes)
    const successItems = getItems().map((i) =>
      i.serverId === item.serverId
        ? { ...i, installStatus: "installed" as const }
        : i,
    );
    callbacks.onStateChange({ items: successItems });
  } catch (err) {
    console.error("[mcp-lifecycle] marketplace install failed:", item.serverId, err);

    // Rollback to error state (re-read to avoid overwriting concurrent changes)
    const errorItems = getItems().map((i) =>
      i.serverId === item.serverId
        ? { ...i, installStatus: "error" as const }
        : i,
    );
    callbacks.onStateChange({ items: errorItems });
  }
}

/**
 * Uninstall a marketplace item via Gateway RPC.
 * Updates the item's installStatus optimistically, then calls the RPC.
 */
export async function uninstallMarketplaceItem(
  client: GatewayClient | null,
  serverId: string,
  callbacks: MarketplaceCallbacks & { currentItems: McpMarketplaceItem[] | (() => McpMarketplaceItem[]) },
): Promise<void> {
  if (!client) return;

  const getItems = typeof callbacks.currentItems === "function" ? callbacks.currentItems : () => callbacks.currentItems as McpMarketplaceItem[];

  // Optimistic: set not_installed
  const optimisticItems = getItems().map((i) =>
    i.serverId === serverId
      ? { ...i, installStatus: "not_installed" as const }
      : i,
  );
  callbacks.onStateChange({ items: optimisticItems });

  try {
    await client.request("mcp.marketplace.uninstall", { serverId });
    return; // optimistic state is already correct
  } catch (err) {
    console.error("[mcp-lifecycle] marketplace uninstall failed:", serverId, err);
    // Rollback to installed state (re-read to avoid overwriting concurrent changes)
    const rollbackItems = getItems().map((i) =>
      i.serverId === serverId
        ? { ...i, installStatus: "installed" as const }
        : i,
    );
    callbacks.onStateChange({ items: rollbackItems });
    throw err; // re-throw so caller can show toast
  }
}

/**
 * Update an installed marketplace item to latest version via Gateway RPC.
 */
export async function updateMarketplaceItem(
  client: GatewayClient | null,
  serverId: string,
  callbacks: MarketplaceCallbacks & { currentItems: McpMarketplaceItem[] | (() => McpMarketplaceItem[]) },
): Promise<void> {
  if (!client) return;

  const getItems = typeof callbacks.currentItems === "function" ? callbacks.currentItems : () => callbacks.currentItems as McpMarketplaceItem[];

  // Optimistic: set installing
  const optimisticItems = getItems().map((i) =>
    i.serverId === serverId
      ? { ...i, installStatus: "installing" as const }
      : i,
  );
  callbacks.onStateChange({ items: optimisticItems });

  try {
    await client.request("mcp.marketplace.update", { serverId });

    // Success: mark installed, clear update flag (re-read to avoid overwriting concurrent changes)
    const successItems = getItems().map((i) =>
      i.serverId === serverId
        ? { ...i, installStatus: "installed" as const, hasUpdate: false }
        : i,
    );
    callbacks.onStateChange({ items: successItems });
  } catch (err) {
    console.error("[mcp-lifecycle] marketplace update failed:", serverId, err);
    // Rollback to installed state (re-read to avoid overwriting concurrent changes)
    const errorItems = getItems().map((i) =>
      i.serverId === serverId
        ? { ...i, installStatus: "installed" as const }
        : i,
    );
    callbacks.onStateChange({ items: errorItems });
    throw err;
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

// ============================================================================
// Batch API key configuration
// ============================================================================

/**
 * Batch update env vars for multiple MCP servers.
 * Used by the batch API key configuration modal.
 */
export async function batchUpdateMcpServerEnv(
  client: GatewayClient | null,
  updates: Array<{ serverId: string; env: Record<string, string> }>,
): Promise<{ success: number; failed: number }> {
  if (!client) return { success: 0, failed: updates.length };

  try {
    const response = await client.request("mcp.servers.batchUpdateEnv", {
      updates: updates.map((u) => ({ id: u.serverId, env: u.env })),
    }) as { results?: Array<{ id: string; ok: boolean }> } | null;

    const results = response?.results ?? [];
    const success = results.filter((r) => r.ok).length;
    const failed = results.length - success;
    return { success, failed };
  } catch (err) {
    console.error("[mcp-lifecycle] batch update env failed:", err);
    return { success: 0, failed: updates.length };
  }
}

/**
 * Fetch env configuration status for all servers.
 * Returns a map of serverId -> { envKey: isConfigured }.
 */
export async function fetchServerEnvStatus(
  client: GatewayClient | null,
): Promise<Record<string, Record<string, boolean>>> {
  if (!client) return {};

  try {
    const response = await client.request("mcp.servers.list") as {
      servers?: Array<{ id: string; envConfigured?: Record<string, boolean> }>;
    } | null;

    const result: Record<string, Record<string, boolean>> = {};
    for (const s of response?.servers ?? []) {
      if (s.envConfigured && Object.keys(s.envConfigured).length > 0) {
        result[s.id] = s.envConfigured;
      }
    }
    return result;
  } catch {
    return {};
  }
}
