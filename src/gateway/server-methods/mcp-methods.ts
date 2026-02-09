/**
 * MCP Gateway RPC methods.
 *
 * Provides RPC endpoints for UI to manage MCP servers:
 *   mcp.status        — Get all server states and tools
 *   mcp.restart       — Restart a specific server
 *   mcp.disable       — Disable a server
 *   mcp.enable        — Enable a server
 *   mcp.sync          — Reload config and reconcile
 *   mcp.servers.list  — List configured servers
 *   mcp.servers.add   — Add a new server config
 *   mcp.servers.remove — Remove a server config
 */

import { loadConfig } from "../../config/config.js";
import { getMCPManagerSafe, initMCPManager } from "../../mcp/index.js";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../../agents/agent-scope.js";
import { buildWorkspaceSkillStatus, type SkillStatusEntry } from "../../agents/skills-status.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandler, GatewayRequestHandlers } from "./types.js";

function mcpError(message: string) {
  return errorShape(ErrorCodes.INVALID_REQUEST, message);
}

/** Wrap a handler with top-level error boundary to prevent gateway crashes. */
function safeHandler(handler: GatewayRequestHandler): GatewayRequestHandler {
  return async (opts) => {
    try {
      await handler(opts);
    } catch (err) {
      opts.respond(false, undefined, mcpError(String(err)));
    }
  };
}

const mcpStatusHandler: GatewayRequestHandler = safeHandler(async ({ respond }) => {
  const manager = getMCPManagerSafe();
  if (!manager) {
    respond(true, { servers: [], tools: [], capabilities: [], processes: [] });
    return;
  }
  const status = manager.getStatus();
  // Map to UI-friendly capability status
  const capabilities = status.servers.map((s) => ({
    id: s.config.id,
    status: s.status === "running" ? "ready" as const
      : s.status === "error" || s.status === "circuit_open" ? "unavailable" as const
      : !s.config.enabled ? "paused" as const
      : "needs_config" as const,
    isNew: false,
  }));
  // Process info for the advanced settings UI panel
  const processes = status.servers.map((s) => ({
    id: s.config.id,
    friendlyName: s.config.id,
    status: s.status === "running" ? "running" as const
      : s.status === "error" || s.status === "circuit_open" ? "error" as const
      : "stopped" as const,
    memoryMB: 0,
    toolCount: s.tools.length,
  }));
  respond(true, {
    servers: status.servers.map((s) => ({
      id: s.config.id,
      status: s.status,
      pid: s.pid,
      toolCount: s.tools.length,
      error: s.error,
      restartCount: s.restartCount,
      enabled: s.config.enabled,
    })),
    tools: status.tools.map((t) => ({
      serverId: t.serverId,
      name: t.name,
      bridgedName: t.bridgedName,
      description: t.description,
    })),
    capabilities,
    processes,
  });
});

const mcpRestartHandler: GatewayRequestHandler = safeHandler(async ({ params, respond }) => {
  const id = typeof params.id === "string" ? params.id : "";
  if (!id) {
    respond(false, undefined, mcpError("id required"));
    return;
  }
  const manager = getMCPManagerSafe();
  if (!manager) {
    respond(false, undefined, mcpError("MCP not initialized"));
    return;
  }
  try {
    await manager.restartServer(id);
    respond(true, { ok: true });
  } catch (err) {
    respond(false, undefined, mcpError(String(err)));
  }
});

const mcpDisableHandler: GatewayRequestHandler = safeHandler(async ({ params, respond }) => {
  const id = typeof params.id === "string" ? params.id : "";
  if (!id) {
    respond(false, undefined, mcpError("id required"));
    return;
  }
  const manager = getMCPManagerSafe();
  if (!manager) {
    respond(false, undefined, mcpError("MCP not initialized"));
    return;
  }
  try {
    await manager.disableServer(id);
    respond(true, { ok: true });
  } catch (err) {
    respond(false, undefined, mcpError(String(err)));
  }
});

const mcpEnableHandler: GatewayRequestHandler = safeHandler(async ({ params, respond }) => {
  const id = typeof params.id === "string" ? params.id : "";
  if (!id) {
    respond(false, undefined, mcpError("id required"));
    return;
  }
  const manager = getMCPManagerSafe();
  if (!manager) {
    respond(false, undefined, mcpError("MCP not initialized"));
    return;
  }
  try {
    await manager.enableServer(id);
    respond(true, { ok: true });
  } catch (err) {
    respond(false, undefined, mcpError(String(err)));
  }
});

const mcpSyncHandler: GatewayRequestHandler = safeHandler(async ({ respond }) => {
  const cfg = loadConfig();
  let manager = getMCPManagerSafe();
  if (!manager) {
    // Initialize if not yet
    try {
      manager = await initMCPManager(cfg.mcp);
    } catch (err) {
      respond(false, undefined, mcpError(String(err)));
      return;
    }
  }
  try {
    await manager.sync(cfg.mcp);
    respond(true, { ok: true });
  } catch (err) {
    respond(false, undefined, mcpError(String(err)));
  }
});

const mcpServersListHandler: GatewayRequestHandler = safeHandler(async ({ respond }) => {
  const manager = getMCPManagerSafe();
  if (!manager) {
    respond(true, { servers: [] });
    return;
  }
  const configs = manager.registry.getAllServers();
  respond(true, {
    servers: configs.map((c) => ({
      id: c.id,
      command: c.command,
      args: c.args,
      transport: c.transport,
      enabled: c.enabled,
      autoStart: c.autoStart,
    })),
  });
});

const mcpServersAddHandler: GatewayRequestHandler = safeHandler(async ({ params, respond }) => {
  const id = typeof params.id === "string" ? params.id : "";
  const command = typeof params.command === "string" ? params.command : "";
  if (!id || !command) {
    respond(false, undefined, mcpError("id and command required"));
    return;
  }
  const manager = getMCPManagerSafe();
  if (!manager) {
    respond(false, undefined, mcpError("MCP not initialized"));
    return;
  }
  try {
    await manager.addServer({
      id,
      command,
      args: Array.isArray(params.args)
        ? params.args.filter((a): a is string => typeof a === "string")
        : undefined,
      env: params.env && typeof params.env === "object"
        ? params.env as Record<string, string>
        : undefined,
      transport: params.transport === "sse" ? "sse" : "stdio",
      enabled: params.enabled !== false,
      autoStart: params.autoStart !== false,
      timeout: typeof params.timeout === "number" ? params.timeout : undefined,
    });
    respond(true, { ok: true });
  } catch (err) {
    respond(false, undefined, mcpError(String(err)));
  }
});

const mcpServersRemoveHandler: GatewayRequestHandler = safeHandler(async ({ params, respond }) => {
  const id = typeof params.id === "string" ? params.id : "";
  if (!id) {
    respond(false, undefined, mcpError("id required"));
    return;
  }
  const manager = getMCPManagerSafe();
  if (!manager) {
    respond(false, undefined, mcpError("MCP not initialized"));
    return;
  }
  try {
    await manager.removeServer(id);
    respond(true, { ok: true });
  } catch (err) {
    respond(false, undefined, mcpError(String(err)));
  }
});

// ============================================================================
// Marketplace RPC handlers
// ============================================================================

/**
 * mcp.marketplace.list — Return browsable marketplace items.
 * Reads from local cached index (mcp-index.json) synced by ClawdSkillsProxy.
 * Parameters: { category?, search?, sort?, page?, pageSize? }
 */
const mcpMarketplaceListHandler: GatewayRequestHandler = safeHandler(async ({ params, respond }) => {
  try {
    const { readMarketplaceIndex } = await import("../../mcp/marketplace-index.js");
    const allItems = await readMarketplaceIndex();

    let items = allItems;

    // Category filter
    const category = typeof params.category === "string" ? params.category : "";
    if (category && category !== "all") {
      items = items.filter((i: Record<string, unknown>) => i.category === category);
    }

    // Search filter
    const search = typeof params.search === "string" ? params.search.trim().toLowerCase() : "";
    if (search) {
      items = items.filter((i: Record<string, unknown>) => {
        const name = String(i.friendlyName ?? "").toLowerCase();
        const nameEn = String(i.friendlyNameEn ?? "").toLowerCase();
        const desc = String(i.description ?? "").toLowerCase();
        const tags = Array.isArray(i.tags) ? i.tags.map(String) : [];
        return name.includes(search) || nameEn.includes(search) ||
          desc.includes(search) || tags.some((t: string) => t.toLowerCase().includes(search));
      });
    }

    // Annotate install status and version detection from registry
    const manager = getMCPManagerSafe();
    const installedIds = new Set(
      manager ? manager.registry.getAllServers().map((s) => s.id) : [],
    );

    const annotated = items.map((i: Record<string, unknown>) => {
      const id = String(i.serverId ?? "");
      if (installedIds.has(id)) {
        return { ...i, installStatus: "installed", hasUpdate: false };
      }
      return { ...i, installStatus: i.installStatus ?? "not_installed" };
    });

    // Pagination
    const page = typeof params.page === "number" ? Math.max(1, params.page) : 1;
    const pageSize = typeof params.pageSize === "number" ? Math.min(100, Math.max(1, params.pageSize)) : 50;
    const start = (page - 1) * pageSize;
    const paged = annotated.slice(start, start + pageSize);

    respond(true, { items: paged, total: annotated.length, page, pageSize });
  } catch {
    // Index not available yet — return empty
    respond(true, { items: [], total: 0 });
  }
});

/**
 * mcp.marketplace.detail — Return full detail for one marketplace item.
 * Parameters: { serverId }
 */
const mcpMarketplaceDetailHandler: GatewayRequestHandler = safeHandler(async ({ params, respond }) => {
  const serverId = typeof params.serverId === "string" ? params.serverId : "";
  if (!serverId) {
    respond(false, undefined, mcpError("serverId required"));
    return;
  }

  try {
    const { readMarketplaceIndex } = await import("../../mcp/marketplace-index.js");
    const allItems = await readMarketplaceIndex();
    const item = allItems.find((i: Record<string, unknown>) => i.serverId === serverId);

    if (!item) {
      respond(false, undefined, mcpError("Item not found: " + serverId));
      return;
    }

    respond(true, item);
  } catch {
    respond(false, undefined, mcpError("Marketplace index not available"));
  }
});

/**
 * mcp.marketplace.install — Install a marketplace item.
 * Parameters: { serverId, env? }
 * Delegates to mcp.servers.add then starts the server.
 */
const mcpMarketplaceInstallHandler: GatewayRequestHandler = safeHandler(async ({ params, respond }) => {
  const serverId = typeof params.serverId === "string" ? params.serverId : "";
  if (!serverId) {
    respond(false, undefined, mcpError("serverId required"));
    return;
  }

  try {
    const { readMarketplaceIndex } = await import("../../mcp/marketplace-index.js");
    const allItems = await readMarketplaceIndex();
    const item = allItems.find((i: Record<string, unknown>) => i.serverId === serverId) as
      Record<string, unknown> | undefined;

    if (!item) {
      respond(false, undefined, mcpError("Item not found: " + serverId));
      return;
    }

    const manager = getMCPManagerSafe();
    if (!manager) {
      respond(false, undefined, mcpError("MCP not initialized"));
      return;
    }

    // Build server config from marketplace item
    const npmPackage = String(item.npmPackage ?? "");
    const env = params.env && typeof params.env === "object"
      ? params.env as Record<string, string>
      : undefined;

    await manager.addServer({
      id: serverId,
      command: "npx",
      args: ["-y", npmPackage],
      env,
      transport: "stdio",
      enabled: true,
      autoStart: true,
    });

    respond(true, { ok: true, serverId });
  } catch (err) {
    respond(false, undefined, mcpError(String(err)));
  }
});

// ── Recommendation helpers ──────────────────────────────────

const RECOMMEND_STOP_WORDS = new Set([
  "the", "and", "for", "use", "when", "you", "need", "with", "via",
  "from", "that", "this", "can", "are", "has", "have", "using",
  "tool", "cli", "run", "get", "set", "all", "not", "its", "into",
  "also", "any", "etc", "will", "your", "like", "more", "other",
]);

function extractSkillKeywords(skills: SkillStatusEntry[]): Set<string> {
  const keywords = new Set<string>();
  for (const skill of skills) {
    // Skill name split (e.g. "spotify-player" → "spotify", "player")
    for (const part of skill.name.split(/[-_]/)) {
      if (part.length >= 2) keywords.add(part.toLowerCase());
    }
    // Extract English words (≥3 chars) from description, excluding stop words
    const words = skill.description.match(/[a-zA-Z]{3,}/g) ?? [];
    for (const w of words) {
      if (!RECOMMEND_STOP_WORDS.has(w.toLowerCase())) {
        keywords.add(w.toLowerCase());
      }
    }
  }
  return keywords;
}

function scoreRecommendation(item: Record<string, unknown>, keywords: Set<string>): number {
  let score = 0;
  const tags = Array.isArray(item.tags) ? item.tags.map(String) : [];
  const serverId = String(item.serverId ?? "").toLowerCase();

  for (const kw of keywords) {
    // serverId exact match: +10
    if (serverId === kw) { score += 10; continue; }
    // Tag matching
    for (const tag of tags) {
      const tagLower = tag.toLowerCase();
      if (tagLower === kw) score += 5;
      else if (tagLower.includes(kw) || kw.includes(tagLower)) score += 2;
    }
  }
  // Boost official items
  if (item.isOfficial) score += 3;
  // Boost new items
  if (item.isNew) score += 1;

  return score;
}

/**
 * mcp.marketplace.recommend — Return personalized recommendations.
 * Matches installed skills' keywords against marketplace item tags.
 */
const mcpMarketplaceRecommendHandler: GatewayRequestHandler = safeHandler(async ({ respond }) => {
  try {
    // 1. Get installed skills
    const cfg = loadConfig();
    const workspaceDir = resolveAgentWorkspaceDir(cfg, resolveDefaultAgentId(cfg));
    const report = buildWorkspaceSkillStatus(workspaceDir, { config: cfg });
    const skills = report.skills.filter((s) => s.eligible && !s.disabled);

    // 2. Read marketplace index
    const { readMarketplaceIndex } = await import("../../mcp/marketplace-index.js");
    const allItems = await readMarketplaceIndex();

    // 3. Get installed MCP servers (to exclude)
    const manager = getMCPManagerSafe();
    const installedMcp = new Set(
      manager ? manager.registry.getAllServers().map((s) => s.id) : [],
    );

    // 4. Extract keywords from skills
    const keywords = extractSkillKeywords(skills);

    // 5. Score and rank — only recommend China-friendly items
    //    (no external API key required = can run locally without VPN)
    const scored = allItems
      .filter((item: Record<string, unknown>) => {
        if (installedMcp.has(String(item.serverId ?? ""))) return false;
        // Skip items requiring external API keys (most are foreign services)
        if (item.requiresApiKey === true) return false;
        return true;
      })
      .map((item: Record<string, unknown>) => ({ item, score: scoreRecommendation(item, keywords) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    // 6. Return top 5
    const items = scored.slice(0, 5).map(({ item }) => ({
      ...item,
      installStatus: (item.installStatus as string) ?? "not_installed",
    }));

    respond(true, { items });
  } catch {
    // Recommendations are optional — return empty on any error
    respond(true, { items: [] });
  }
});

/**
 * mcp.marketplace.sync — Force-sync the MCP marketplace index from ClawdSkillsProxy.
 * Parameters: {} (no params needed, always force)
 */
const mcpMarketplaceSyncHandler: GatewayRequestHandler = safeHandler(async ({ respond }) => {
  try {
    const { syncMcpIndex } = await import("../../mcp/marketplace-sync.js");
    const result = await syncMcpIndex({ force: true });
    respond(true, { ok: result.ok, synced: result.synced, itemCount: result.itemCount ?? 0 });
  } catch (err) {
    respond(false, undefined, mcpError(String(err)));
  }
});

export const mcpHandlers: GatewayRequestHandlers = {
  "mcp.status": mcpStatusHandler,
  "mcp.restart": mcpRestartHandler,
  "mcp.disable": mcpDisableHandler,
  "mcp.enable": mcpEnableHandler,
  "mcp.sync": mcpSyncHandler,
  "mcp.servers.list": mcpServersListHandler,
  "mcp.servers.add": mcpServersAddHandler,
  "mcp.servers.remove": mcpServersRemoveHandler,
  "mcp.marketplace.list": mcpMarketplaceListHandler,
  "mcp.marketplace.detail": mcpMarketplaceDetailHandler,
  "mcp.marketplace.install": mcpMarketplaceInstallHandler,
  "mcp.marketplace.recommend": mcpMarketplaceRecommendHandler,
  "mcp.marketplace.sync": mcpMarketplaceSyncHandler,
};
