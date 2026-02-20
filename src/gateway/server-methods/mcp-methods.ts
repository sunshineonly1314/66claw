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

import { loadConfig, writeConfigFile } from "../../config/config.js";
import { getMCPManagerSafe, initMCPManager } from "../../mcp/index.js";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../../agents/agent-scope.js";
import { buildWorkspaceSkillStatus, type SkillStatusEntry } from "../../agents/skills-status.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandler, GatewayRequestHandlers } from "./types.js";
import type { MCPServerConfig } from "../../mcp/types.js";
import {
  shouldUseCNMirror, getNpmMirrorUrl, getPipMirrorUrl,
  getNpmMirrors, getPipMirrors,
} from "../../config/cn-mirrors.js";

function mcpError(message: string) {
  return errorShape(ErrorCodes.INVALID_REQUEST, message);
}

// ============================================================================
// CN mirror injection helper
// ============================================================================

/**
 * Build CN mirror env vars for MCP server installs.
 * When the user is in China, inject npm/pip registry URLs so that
 * npx/uvx commands use domestic mirrors for faster downloads.
 *
 * Existing env vars take precedence — if the user manually configured
 * a registry via the config wizard's advanced section, we do not override it.
 */
function buildCNMirrorEnv(
  type: "npm" | "pypi",
  existingEnv?: Record<string, string>,
  mirrorUrl?: string,
): Record<string, string> | undefined {
  if (!shouldUseCNMirror()) return existingEnv;

  const mirrorEnv: Record<string, string> = {};
  if (type === "npm") {
    mirrorEnv.npm_config_registry = mirrorUrl || getNpmMirrorUrl();
  } else {
    const pipUrl = mirrorUrl || getPipMirrorUrl();
    mirrorEnv.UV_INDEX_URL = pipUrl;
    mirrorEnv.PIP_INDEX_URL = pipUrl;
  }

  // Merge: existing env vars take precedence (user explicitly set them)
  return existingEnv ? { ...mirrorEnv, ...existingEnv } : mirrorEnv;
}

// ── Network error detection (same as skills-install.ts) ─────────────────
function isNetworkError(errorStr: string): boolean {
  const s = errorStr.toLowerCase();
  return (
    s.includes("enotfound") ||
    s.includes("etimedout") ||
    s.includes("econnrefused") ||
    s.includes("econnreset") ||
    s.includes("socket hang up") ||
    s.includes("network") ||
    s.includes("fetch failed") ||
    s.includes("certificate") ||
    s.includes("ssl") ||
    s.includes("403") ||
    s.includes("404") ||
    s.includes("502") ||
    s.includes("503") ||
    s.includes("timeout") ||
    s.includes("could not determine executable") ||
    s.includes("not found in registry")
  );
}

// ── Friendly CN error messages ──────────────────────────────────────────
function friendlyInstallError(serverId: string, lastError: string): string {
  if (lastError.includes("could not determine executable")) {
    return `${serverId} 安装失败：npm 包不存在或无法执行，该包可能已下架`;
  }
  if (lastError.includes("not found in registry") || lastError.includes("404")) {
    return `${serverId} 安装失败：包在镜像源中找不到`;
  }
  if (lastError.includes("enotfound") || lastError.includes("etimedout")) {
    return `${serverId} 安装失败：所有国内镜像源均无法连接，请检查网络`;
  }
  if (lastError.includes("connection closed") || lastError.includes("Connection closed")) {
    return `${serverId} 安装失败：服务启动后连接中断，可能需要额外配置`;
  }
  return `${serverId} 安装失败：${lastError.slice(0, 120)}`;
}

/**
 * Try installing an MCP server with multi-mirror fallback.
 * For npm: tries 3 CN mirrors (Taobao → Tencent → Huawei).
 * For pypi: tries 3 CN mirrors (Tsinghua → Alibaba → USTC).
 * Each attempt: addServer → wait → check status → rollback if failed → try next mirror.
 */
async function tryInstallWithMirrorFallback(params: {
  manager: ReturnType<typeof getMCPManagerSafe> & {};
  serverId: string;
  type: "npm" | "pypi";
  packageStr: string;
  version: string;
  userEnv?: Record<string, string>;
  waitMs?: number;
}): Promise<{ ok: boolean; error?: string; usedMirror?: string }> {
  const { manager, serverId, type, packageStr, version, userEnv, waitMs = 4000 } = params;
  const useCN = shouldUseCNMirror();
  const mirrors = useCN
    ? (type === "npm" ? getNpmMirrors() : getPipMirrors())
    : [type === "npm" ? "https://registry.npmjs.org" : "https://pypi.org/simple"];

  let lastError = "";

  for (let i = 0; i < mirrors.length; i++) {
    const mirror = mirrors[i]!;
    const mirrorHost = (() => { try { return new URL(mirror).hostname; } catch { return mirror; } })();

    // Build server config with this mirror's env
    let serverConfig: MCPServerConfig;
    if (type === "npm") {
      const versionedPkg = version ? `${packageStr}@${version}` : packageStr;
      serverConfig = {
        id: serverId,
        command: "npx",
        args: ["-y", versionedPkg],
        env: buildCNMirrorEnv("npm", userEnv, mirror),
        transport: "stdio",
        version: version || undefined,
        enabled: true,
        autoStart: true,
      };
    } else {
      const versionedPkg = version ? `${packageStr}==${version}` : packageStr;
      serverConfig = {
        id: serverId,
        command: "uvx",
        args: [versionedPkg],
        env: buildCNMirrorEnv("pypi", userEnv, mirror),
        transport: "stdio",
        version: version || undefined,
        enabled: true,
        autoStart: true,
      };
    }

    console.log(`[mcp] Install attempt ${i + 1}/${mirrors.length} via ${mirrorHost}: ${serverId}`);

    try {
      await manager.addServer(serverConfig);
      await new Promise((r) => setTimeout(r, waitMs));

      const postStatus = manager.getStatus();
      const serverStatus = postStatus.servers.find((s) => s.config.id === serverId);
      const isRunning = serverStatus?.status === "running";

      if (isRunning) {
        console.log(`[mcp] Install success via ${mirrorHost}: ${serverId}`);
        return { ok: true, usedMirror: mirrorHost };
      }

      // Failed — record error and rollback
      lastError = serverStatus?.error ?? "Connection failed after install";
      console.warn(`[mcp] Mirror ${mirrorHost} failed for ${serverId}: ${lastError}`);

      try {
        await manager.removeServer(serverId);
        persistMcpServerRemove(serverId).catch(() => {});
      } catch { /* best-effort rollback */ }

      // If not a network error, don't bother trying other mirrors
      if (!isNetworkError(lastError)) {
        break;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[mcp] Mirror ${mirrorHost} threw for ${serverId}: ${lastError}`);
      try {
        await manager.removeServer(serverId);
        persistMcpServerRemove(serverId).catch(() => {});
      } catch { /* best-effort */ }
      if (!isNetworkError(lastError)) break;
    }
  }

  return { ok: false, error: friendlyInstallError(serverId, lastError) };
}

// ============================================================================
// Input validation helpers (security)
// ============================================================================

/**
 * Validate an npm/PyPI package name to prevent command injection.
 * Allows: letters, digits, @, /, -, _, .
 * Examples: "@modelcontextprotocol/server-filesystem", "mcp-server-time", "uvx-pkg"
 */
const SAFE_PACKAGE_NAME_RE = /^[a-zA-Z0-9@/_.\-]+$/;

function isValidPackageName(name: string): boolean {
  if (!name || name.length > 200) return false;
  if (!SAFE_PACKAGE_NAME_RE.test(name)) return false;
  // Block path traversal patterns
  if (name.includes("..")) return false;
  // Block absolute paths (e.g. /etc/passwd, //host/share)
  if (name.startsWith("/") && !name.startsWith("@")) return false;
  // Scoped packages must follow @scope/name pattern (max one slash after @)
  if (name.startsWith("@")) {
    const slashCount = (name.match(/\//g) ?? []).length;
    if (slashCount !== 1) return false;
  } else {
    // Non-scoped packages should have no slashes
    if (name.includes("/")) return false;
  }
  return true;
}

/**
 * Validate a version string to prevent injection.
 * Allows: digits, dots, hyphens, plus signs (semver: 1.2.3-beta.1+build.123)
 */
const SAFE_VERSION_RE = /^[a-zA-Z0-9._\-+]+$/;

function isValidVersion(version: string): boolean {
  if (!version) return true; // empty is OK (means "latest")
  if (version.length > 50) return false;
  return SAFE_VERSION_RE.test(version);
}

/**
 * Validate an SSE URL to prevent SSRF attacks.
 * Only allows http/https, blocks internal/private IPs.
 */
function isValidSseUrl(url: string): boolean {
  if (!url) return true; // empty is OK for non-SSE
  try {
    const parsed = new URL(url);
    // Only http/https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    // Block private/internal hostnames
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
    if (host === "0.0.0.0") return false;
    if (host.endsWith(".local") || host.endsWith(".internal")) return false;
    // Block private IP ranges: 10.x, 172.16-31.x, 192.168.x
    if (/^10\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (/^192\.168\./.test(host)) return false;
    // Block metadata endpoints (cloud SSRF)
    if (/^169\.254\./.test(host)) return false;
    // Block hex/octal IP bypasses (e.g. 0x7f000001 = 127.0.0.1)
    if (/^0[xo0-9]/.test(host)) return false;
    // Block IPv6-mapped IPv4 and link-local (e.g. [::ffff:127.0.0.1], [::1])
    if (host.startsWith("[")) return false;
    // Only allow hostnames with at least one dot (real domain names)
    if (!host.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Lightweight semver "less than" comparison (a < b).
 * Handles standard major.minor.patch format. Falls back to string comparison
 * for non-standard versions.
 */
function semverLessThan(a: string, b: string): boolean {
  const parseVer = (v: string) => {
    const match = v.match(/^v?(\d+)\.(\d+)\.(\d+)/);
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3])] as const;
  };
  const pa = parseVer(a);
  const pb = parseVer(b);
  if (!pa || !pb) return a !== b; // fallback: any difference = update
  if (pa[0] !== pb[0]) return pa[0] < pb[0];
  if (pa[1] !== pb[1]) return pa[1] < pb[1];
  return pa[2] < pb[2];
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

  // Helper: find unconfigured (empty-value) env keys for a server config.
  // If the server declares env vars but some are empty, it likely needs
  // the user to fill in API keys before it can start successfully.
  function getUnconfiguredEnvKeys(cfg: { env?: Record<string, string> }): string[] {
    if (!cfg.env) return [];
    return Object.entries(cfg.env)
      .filter(([, v]) => !v)
      .map(([k]) => k);
  }

  // Load marketplace index to enrich installed servers with CN names + descriptions
  let marketplaceItems: Record<string, unknown>[] = [];
  try {
    const { readMarketplaceIndex } = await import("../../mcp/marketplace-index.js");
    marketplaceItems = await readMarketplaceIndex();
  } catch { /* non-critical */ }

  // Map to UI-friendly capability status
  const capabilities = status.servers.map((s) => {
    const missingKeys = getUnconfiguredEnvKeys(s.config);
    const hasMissingEnv = missingKeys.length > 0;

    let uiStatus: "ready" | "unavailable" | "paused" | "needs_config";
    if (s.status === "running") {
      uiStatus = "ready";
    } else if (!s.config.enabled) {
      uiStatus = "paused";
    } else if (hasMissingEnv) {
      uiStatus = "needs_config";
    } else if (s.status === "error" || s.status === "circuit_open") {
      uiStatus = "unavailable";
    } else {
      uiStatus = "needs_config";
    }

    // Enrich with marketplace data: CN name, description, example prompt
    const marketItem = marketplaceItems.find(
      (i: Record<string, unknown>) => i.serverId === s.config.id,
    ) as Record<string, unknown> | undefined;

    // Build friendly name: marketplace CN name → marketplace EN name → serverId
    const friendlyName = String(
      marketItem?.friendlyNameCn || marketItem?.friendlyName || s.config.id,
    );

    // Build description from tools (what it actually provides) or marketplace
    const toolDescriptions = s.tools.slice(0, 3).map((tool) => tool.description || tool.name);
    const marketDesc = marketItem?.descriptionCn || marketItem?.description;
    const description: string[] =
      toolDescriptions.length > 0
        ? toolDescriptions
        : marketDesc
          ? [String(marketDesc)]
          : [];

    // Build example prompt from marketplace or first tool
    const examplePrompt = marketItem?.examplePrompts
      ? String((marketItem.examplePrompts as string[])[0] ?? "")
      : s.tools.length > 0
        ? s.tools[0]!.name
        : "";

    return {
      id: s.config.id,
      friendlyName,
      description,
      examplePrompt,
      status: uiStatus,
      isNew: false,
      configNeeded: hasMissingEnv ? missingKeys.join(", ") : undefined,
    };
  });
  // Process info for the advanced settings UI panel
  const processes = status.servers.map((s) => ({
    id: s.config.id,
    friendlyName: (() => {
      const m = marketplaceItems.find(
        (i: Record<string, unknown>) => i.serverId === s.config.id,
      ) as Record<string, unknown> | undefined;
      return String(m?.friendlyNameCn || m?.friendlyName || s.config.id);
    })(),
    status:
      s.status === "running"
        ? ("running" as const)
        : s.status === "error" || s.status === "circuit_open"
          ? ("error" as const)
          : ("stopped" as const),
    memoryMB: 0,
    toolCount: s.tools.length,
    error: s.error ?? undefined,
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
      url: c.url,
      version: c.version,
      enabled: c.enabled,
      autoStart: c.autoStart,
      // Expose env key names and configured status (never expose values — security)
      envKeys: c.env ? Object.keys(c.env) : [],
      envConfigured: c.env
        ? Object.fromEntries(Object.entries(c.env).map(([k, v]) => [k, !!v]))
        : {},
    })),
  });
});

const mcpServersAddHandler: GatewayRequestHandler = safeHandler(async ({ params, respond }) => {
  const id = typeof params.id === "string" ? params.id : "";
  const transport = params.transport === "sse" ? ("sse" as const) : ("stdio" as const);
  const command = typeof params.command === "string" ? params.command : "";
  // SSE servers don't need a command, stdio servers do
  if (!id || (transport !== "sse" && !command)) {
    respond(false, undefined, mcpError("id required; command required for stdio transport"));
    return;
  }
  const manager = getMCPManagerSafe();
  if (!manager) {
    respond(false, undefined, mcpError("MCP not initialized"));
    return;
  }
  // Security: validate SSE URL if provided
  const url = typeof params.url === "string" ? params.url : undefined;
  if (transport === "sse" && url && !isValidSseUrl(url)) {
    respond(false, undefined, mcpError("Invalid or disallowed SSE URL"));
    return;
  }

  try {
    const serverConfig: MCPServerConfig = {
      id,
      command,
      args: Array.isArray(params.args)
        ? params.args.filter((a): a is string => typeof a === "string")
        : undefined,
      env:
        params.env && typeof params.env === "object"
          ? (params.env as Record<string, string>)
          : undefined,
      transport,
      url,
      headers:
        params.headers && typeof params.headers === "object"
          ? (params.headers as Record<string, string>)
          : undefined,
      version: typeof params.version === "string" ? params.version : undefined,
      enabled: params.enabled !== false,
      autoStart: params.autoStart !== false,
      timeout: typeof params.timeout === "number" ? params.timeout : undefined,
    };

    // Inject CN mirror env for npx/uvx commands
    if (command === "npx" || command === "npm") {
      serverConfig.env = buildCNMirrorEnv("npm", serverConfig.env);
    } else if (command === "uvx" || command === "uv" || command === "pip") {
      serverConfig.env = buildCNMirrorEnv("pypi", serverConfig.env);
    }

    await manager.addServer(serverConfig);

    // Persist to config file
    persistMcpServerAdd(serverConfig).catch((err) => {
      console.error("[mcp] Failed to persist server config (non-fatal):", err);
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

    // Persist removal to config file
    persistMcpServerRemove(id).catch(() => {
      /* log but don't fail */
    });

    respond(true, { ok: true });
  } catch (err) {
    respond(false, undefined, mcpError(String(err)));
  }
});

// ============================================================================
// Server env update handlers (batch API key configuration)
// ============================================================================

/**
 * mcp.servers.updateEnv — Update env vars for an existing server.
 * Parameters: { id: string, env: Record<string, string> }
 *
 * Merges new env into existing, re-creates the server, and persists.
 * Used by single-item API key configuration.
 */
const mcpServersUpdateEnvHandler: GatewayRequestHandler = safeHandler(
  async ({ params, respond }) => {
    const id = typeof params.id === "string" ? params.id : "";
    if (!id) {
      respond(false, undefined, mcpError("id required"));
      return;
    }
    const env =
      params.env && typeof params.env === "object" && !Array.isArray(params.env)
        ? (params.env as Record<string, string>)
        : undefined;
    if (!env || Object.keys(env).length === 0) {
      respond(false, undefined, mcpError("env required (non-empty object)"));
      return;
    }

    const manager = getMCPManagerSafe();
    if (!manager) {
      respond(false, undefined, mcpError("MCP not initialized"));
      return;
    }

    const existing = manager.registry.getServer(id);
    if (!existing) {
      respond(false, undefined, mcpError("Server not found: " + id));
      return;
    }

    try {
      // Merge new env into existing (new values overwrite)
      let mergedEnv = { ...(existing.env ?? {}), ...env };

      // Also inject CN mirrors if applicable
      if (existing.command === "npx" || existing.command === "npm") {
        mergedEnv = buildCNMirrorEnv("npm", mergedEnv) ?? mergedEnv;
      } else if (
        existing.command === "uvx" ||
        existing.command === "uv" ||
        existing.command === "pip"
      ) {
        mergedEnv = buildCNMirrorEnv("pypi", mergedEnv) ?? mergedEnv;
      }

      const updatedConfig: MCPServerConfig = { ...existing, env: mergedEnv };

      // Stop old, re-add with updated config
      await manager.removeServer(id);
      await manager.addServer(updatedConfig);

      // Persist to config
      persistMcpServerAdd(updatedConfig).catch((err) => {
        console.error("[mcp] Failed to persist env update (non-fatal):", err);
      });

      respond(true, { ok: true, id });
    } catch (err) {
      respond(false, undefined, mcpError(String(err)));
    }
  },
);

/**
 * mcp.servers.batchUpdateEnv — Update env vars for multiple servers at once.
 * Parameters: { updates: Array<{ id: string, env: Record<string, string> }> }
 *
 * Used by the batch API key configuration UI.
 */
const mcpServersBatchUpdateEnvHandler: GatewayRequestHandler = safeHandler(
  async ({ params, respond }) => {
    const updates = Array.isArray(params.updates) ? params.updates : [];
    if (updates.length === 0) {
      respond(false, undefined, mcpError("updates array required (non-empty)"));
      return;
    }

    const manager = getMCPManagerSafe();
    if (!manager) {
      respond(false, undefined, mcpError("MCP not initialized"));
      return;
    }

    const results: Array<{ id: string; ok: boolean; error?: string }> = [];

    for (const update of updates) {
      const id = typeof update.id === "string" ? update.id : "";
      const env =
        update.env && typeof update.env === "object" && !Array.isArray(update.env)
          ? (update.env as Record<string, string>)
          : null;

      if (!id || !env || Object.keys(env).length === 0) {
        results.push({ id, ok: false, error: "Invalid id or env" });
        continue;
      }

      const existing = manager.registry.getServer(id);
      if (!existing) {
        results.push({ id, ok: false, error: "Server not found" });
        continue;
      }

      try {
        let mergedEnv = { ...(existing.env ?? {}), ...env };

        // Inject CN mirrors if applicable
        if (existing.command === "npx" || existing.command === "npm") {
          mergedEnv = buildCNMirrorEnv("npm", mergedEnv) ?? mergedEnv;
        } else if (
          existing.command === "uvx" ||
          existing.command === "uv" ||
          existing.command === "pip"
        ) {
          mergedEnv = buildCNMirrorEnv("pypi", mergedEnv) ?? mergedEnv;
        }

        const updatedConfig: MCPServerConfig = { ...existing, env: mergedEnv };

        await manager.removeServer(id);
        await manager.addServer(updatedConfig);

        persistMcpServerAdd(updatedConfig).catch(() => {
          /* log but don't fail */
        });
        results.push({ id, ok: true });
      } catch (err) {
        results.push({ id, ok: false, error: String(err) });
      }
    }

    respond(true, { results });
  },
);

// ============================================================================
// Marketplace RPC handlers
// ============================================================================

/**
 * mcp.marketplace.list — Return browsable marketplace items.
 * Reads from local cached index (mcp-index.json) synced by ClawdSkillsProxy.
 * Parameters: { category?, search?, sort?, page?, pageSize? }
 */
const mcpMarketplaceListHandler: GatewayRequestHandler = safeHandler(
  async ({ params, respond }) => {
    try {
      const { readMarketplaceIndex } = await import("../../mcp/marketplace-index.js");
      const allItems = await readMarketplaceIndex();

      // If index is empty, trigger background sync so next request gets data
      if (allItems.length === 0) {
        import("../../mcp/marketplace-sync.js")
          .then(({ syncMcpIndexBackground }) => {
            syncMcpIndexBackground({ force: true });
          })
          .catch(() => {
            /* best-effort */
          });
      }

      let items = allItems;

      // Category filter
      const category = typeof params.category === "string" ? params.category : "";
      if (category && category !== "all") {
        items = items.filter((i) => i.category === category);
      }

      // Search filter
      const search = typeof params.search === "string" ? params.search.trim().toLowerCase() : "";
      if (search) {
        items = items.filter((i) => {
          const name = (i.friendlyName ?? "").toLowerCase();
          const nameEn = (i.friendlyNameEn ?? "").toLowerCase();
          const desc = (i.description ?? "").toLowerCase();
          const tags = i.tags ?? [];
          return (
            name.includes(search) ||
            nameEn.includes(search) ||
            desc.includes(search) ||
            tags.some((t) => t.toLowerCase().includes(search))
          );
        });
      }

      // Annotate install status and version detection from registry
      const manager = getMCPManagerSafe();
      const installedIds = new Set(
        manager ? manager.registry.getAllServers().map((s) => s.id) : [],
      );

      const annotated = items.map((i) => {
        const id = i.serverId ?? "";
        // Prefer Chinese names/descriptions for CN users
        const friendlyName = i.friendlyNameCn || i.friendlyName;
        const description = i.descriptionCn || i.description;
        const tags = i.tagsCn?.length ? i.tagsCn : i.tags;
        const installable = !!(i.npmPackage || i.pypiPackage || i.sseUrl);
        // SSE first — most reliable in China (no npm/pip dependency issues)
        const installMethod: "npm" | "pypi" | "sse" | "none" = i.sseUrl
          ? "sse"
          : i.npmPackage
            ? "npm"
            : i.pypiPackage
              ? "pypi"
              : "none";

        // Auto-detect requiresApiKey from platformNotes when data source doesn't provide it
        const platformNotes = String((i.requirements as Record<string, unknown>)?.platformNotes ?? "");
        const inferredNeedsKey = !i.requiresApiKey && platformNotes
          ? /[Kk]ey|密钥|[Tt]oken|[Ss]ecret|申请|授权|API_|api_key|APIKEY|access.?key|认证|凭[据证]/.test(platformNotes)
          : false;
        const requiresApiKey = !!(i.requiresApiKey || inferredNeedsKey);
        // Pass platformNotes as configHint so UI can show setup instructions
        const configHint = requiresApiKey && platformNotes ? platformNotes : undefined;

        if (installedIds.has(id)) {
          const serverConfig = manager?.registry.getServer(id);
          const installedVersion = serverConfig?.version ?? "";
          const marketVersion = i.version ?? "";
          const hasUpdate = !!(
            installedVersion &&
            marketVersion &&
            semverLessThan(installedVersion, marketVersion)
          );
          return { ...i, friendlyName, description, tags, installStatus: "installed" as const, installedVersion, hasUpdate, installable, installMethod, requiresApiKey, configHint };
        }
        return { ...i, friendlyName, description, tags, installStatus: "not_installed" as const, installable, installMethod, requiresApiKey, configHint };
      });

      // Sort: installed first, then SSE (most reliable), then other installable, then non-installable last
      annotated.sort((a, b) => {
        // Installed items always first
        const aInst = a.installStatus === "installed" ? 0 : 1;
        const bInst = b.installStatus === "installed" ? 0 : 1;
        if (aInst !== bInst) return aInst - bInst;
        // SSE items next (work best in China), then npm/pypi, then non-installable
        const methodRank = (m: string | undefined) => m === "sse" ? 0 : m === "npm" || m === "pypi" ? 1 : 2;
        const am = methodRank(a.installMethod);
        const bm = methodRank(b.installMethod);
        if (am !== bm) return am - bm;
        return 0;
      });

      // Pagination
      const page = typeof params.page === "number" ? Math.max(1, params.page) : 1;
      const pageSize =
        typeof params.pageSize === "number" ? Math.min(100, Math.max(1, params.pageSize)) : 50;
      const start = (page - 1) * pageSize;
      const paged = annotated.slice(start, start + pageSize);

      const totalPages = Math.ceil(annotated.length / pageSize);
      respond(true, { items: paged, total: annotated.length, page, pageSize, totalPages });
    } catch {
      // Index not available yet — return empty
      respond(true, { items: [], total: 0 });
    }
  },
);

/**
 * mcp.marketplace.detail — Return full detail for one marketplace item.
 * Parameters: { serverId }
 */
const mcpMarketplaceDetailHandler: GatewayRequestHandler = safeHandler(
  async ({ params, respond }) => {
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
  },
);

/**
 * mcp.marketplace.install — Install a marketplace item.
 * Parameters: { serverId, env? }
 * Delegates to mcp.servers.add then starts the server.
 */
const mcpMarketplaceInstallHandler: GatewayRequestHandler = safeHandler(
  async ({ params, respond }) => {
    const serverId = typeof params.serverId === "string" ? params.serverId : "";
    if (!serverId) {
      respond(false, undefined, mcpError("serverId required"));
      return;
    }

    try {
      const { readMarketplaceIndex } = await import("../../mcp/marketplace-index.js");
      const allItems = await readMarketplaceIndex();
      const item = allItems.find((i: Record<string, unknown>) => i.serverId === serverId) as
        | Record<string, unknown>
        | undefined;

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
      const pypiPackage = String(item.pypiPackage ?? "");
      const version = String(item.version ?? "");
      const sseUrl = String(item.sseUrl ?? "");
      const env =
        params.env && typeof params.env === "object"
          ? (params.env as Record<string, string>)
          : undefined;

      // Security: validate package names and version to prevent command injection
      if (npmPackage && !isValidPackageName(npmPackage)) {
        respond(false, undefined, mcpError("Invalid npm package name"));
        return;
      }
      if (pypiPackage && !isValidPackageName(pypiPackage)) {
        respond(false, undefined, mcpError("Invalid PyPI package name"));
        return;
      }
      if (!isValidVersion(version)) {
        respond(false, undefined, mcpError("Invalid version string"));
        return;
      }
      // Security: validate SSE URL to prevent SSRF
      if (sseUrl && !isValidSseUrl(sseUrl)) {
        respond(false, undefined, mcpError("Invalid or disallowed SSE URL"));
        return;
      }

      // ── Determine install method ───────────────────────────────────
      // SSE first (most reliable in China — just connect to URL, no npm/pip)
      // npm/pypi: multi-mirror fallback (Taobao → Tencent → Huawei for npm)
      if (sseUrl) {
        // SSE: direct connection, no mirrors needed
        const serverConfig: MCPServerConfig = {
          id: serverId,
          command: "",
          transport: "sse",
          url: sseUrl,
          env,
          version: version || undefined,
          enabled: true,
          autoStart: true,
        };

        await manager.addServer(serverConfig);
        await new Promise((r) => setTimeout(r, 3000));
        const postStatus = manager.getStatus();
        const serverStatus = postStatus.servers.find((s) => s.config.id === serverId);

        if (serverStatus?.status !== "running") {
          const errorMsg = serverStatus?.error ?? "SSE 连接失败";
          try {
            await manager.removeServer(serverId);
            persistMcpServerRemove(serverId).catch(() => {});
          } catch { /* rollback */ }
          respond(false, undefined, mcpError(friendlyInstallError(serverId, errorMsg)));
          return;
        }

        persistMcpServerAdd(serverConfig).catch((err) => {
          console.error("[mcp] Failed to persist server config (non-fatal):", err);
        });
        respond(true, { ok: true, serverId });
      } else if (npmPackage) {
        // npm: multi-mirror fallback (3 CN mirrors auto-switch)
        const result = await tryInstallWithMirrorFallback({
          manager, serverId,
          type: "npm",
          packageStr: npmPackage,
          version,
          userEnv: env,
        });

        if (!result.ok) {
          respond(false, undefined, mcpError(result.error!));
          return;
        }

        // Persist the successful config (with the working mirror baked in)
        const postStatus = manager.getStatus();
        const runningServer = postStatus.servers.find((s) => s.config.id === serverId);
        if (runningServer) {
          persistMcpServerAdd(runningServer.config).catch((err) => {
            console.error("[mcp] Failed to persist server config (non-fatal):", err);
          });
        }
        respond(true, { ok: true, serverId, mirror: result.usedMirror });
      } else if (pypiPackage) {
        // pypi: multi-mirror fallback (3 CN mirrors auto-switch)
        const result = await tryInstallWithMirrorFallback({
          manager, serverId,
          type: "pypi",
          packageStr: pypiPackage,
          version,
          userEnv: env,
        });

        if (!result.ok) {
          respond(false, undefined, mcpError(result.error!));
          return;
        }

        const postStatus = manager.getStatus();
        const runningServer = postStatus.servers.find((s) => s.config.id === serverId);
        if (runningServer) {
          persistMcpServerAdd(runningServer.config).catch((err) => {
            console.error("[mcp] Failed to persist server config (non-fatal):", err);
          });
        }
        respond(true, { ok: true, serverId, mirror: result.usedMirror });
      } else {
        respond(false, undefined, mcpError("该能力没有可安装的包或 SSE 地址"));
        return;
      }
    } catch (err) {
      respond(false, undefined, mcpError(String(err)));
    }
  },
);

// ── Recommendation helpers ──────────────────────────────────

const RECOMMEND_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "use",
  "when",
  "you",
  "need",
  "with",
  "via",
  "from",
  "that",
  "this",
  "can",
  "are",
  "has",
  "have",
  "using",
  "tool",
  "cli",
  "run",
  "get",
  "set",
  "all",
  "not",
  "its",
  "into",
  "also",
  "any",
  "etc",
  "will",
  "your",
  "like",
  "more",
  "other",
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
    if (serverId === kw) {
      score += 10;
      continue;
    }
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
    const installedMcp = new Set(manager ? manager.registry.getAllServers().map((s) => s.id) : []);

    // 4. Extract keywords from skills
    const keywords = extractSkillKeywords(skills);

    // 5. Score and rank — only recommend China-friendly items
    //    (no external API key required = can run locally without VPN)
    const scored = allItems
      .filter((item: Record<string, unknown>) => {
        if (installedMcp.has(String(item.serverId ?? ""))) return false;
        // Skip items requiring external API keys (most are foreign services)
        if (item.requiresApiKey === true) return false;
        // Only recommend items that can actually be installed
        if (!(item.npmPackage || item.pypiPackage || item.sseUrl)) return false;
        // Skip items that need API keys (inferred from platformNotes)
        const notes = String((item.requirements as Record<string, unknown>)?.platformNotes ?? "");
        if (/[Kk]ey|密钥|[Tt]oken|[Ss]ecret|申请|授权|API_|api_key|APIKEY|access.?key|认证|凭[据证]/.test(notes)) return false;
        return true;
      })
      .map((item: Record<string, unknown>) => ({
        item,
        score: scoreRecommendation(item, keywords),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    // 6. Return top 5
    const items = scored.slice(0, 5).map(({ item }) => {
      const installable = !!(item.npmPackage || item.pypiPackage || item.sseUrl);
      const installMethod = item.npmPackage ? "npm" : item.pypiPackage ? "pypi" : item.sseUrl ? "sse" : "none";
      // Prefer Chinese names for CN users
      const friendlyName = (item.friendlyNameCn as string) || (item.friendlyName as string);
      const description = (item.descriptionCn as string) || (item.description as string);
      const tags = (item.tagsCn as string[])?.length ? item.tagsCn : item.tags;
      return {
        ...item,
        friendlyName,
        description,
        tags,
        installStatus: (item.installStatus as string) ?? "not_installed",
        installable,
        installMethod,
      };
    });

    respond(true, { items });
  } catch {
    // Recommendations are optional — return empty on any error
    respond(true, { items: [] });
  }
});

/**
 * mcp.marketplace.uninstall — Uninstall a marketplace item.
 * Stops the server, removes from runtime + config.
 * Parameters: { serverId }
 */
const mcpMarketplaceUninstallHandler: GatewayRequestHandler = safeHandler(
  async ({ params, respond }) => {
    const serverId = typeof params.serverId === "string" ? params.serverId : "";
    if (!serverId) {
      respond(false, undefined, mcpError("serverId required"));
      return;
    }

    const manager = getMCPManagerSafe();
    if (!manager) {
      respond(false, undefined, mcpError("MCP not initialized"));
      return;
    }

    try {
      await manager.removeServer(serverId);
      persistMcpServerRemove(serverId).catch((err) => {
        console.error("[mcp] Failed to persist server removal (non-fatal):", err);
      });
      respond(true, { ok: true, serverId });
    } catch (err) {
      respond(false, undefined, mcpError(String(err)));
    }
  },
);

/**
 * mcp.marketplace.update — Update an installed marketplace item to latest version.
 * Stops the old server, re-installs with the latest version from index, then starts.
 * Parameters: { serverId }
 */
const mcpMarketplaceUpdateHandler: GatewayRequestHandler = safeHandler(
  async ({ params, respond }) => {
    const serverId = typeof params.serverId === "string" ? params.serverId : "";
    if (!serverId) {
      respond(false, undefined, mcpError("serverId required"));
      return;
    }

    const manager = getMCPManagerSafe();
    if (!manager) {
      respond(false, undefined, mcpError("MCP not initialized"));
      return;
    }

    try {
      const { readMarketplaceIndex } = await import("../../mcp/marketplace-index.js");
      const allItems = await readMarketplaceIndex();
      const item = allItems.find((i) => i.serverId === serverId);

      if (!item) {
        respond(false, undefined, mcpError("Item not found in marketplace: " + serverId));
        return;
      }

      const npmPackage = item.npmPackage ?? "";
      const pypiPackage = item.pypiPackage ?? "";
      const version = item.version ?? "";
      const sseUrl = item.sseUrl ?? "";

      if (npmPackage && !isValidPackageName(npmPackage)) {
        respond(false, undefined, mcpError("Invalid npm package name"));
        return;
      }
      if (pypiPackage && !isValidPackageName(pypiPackage)) {
        respond(false, undefined, mcpError("Invalid PyPI package name"));
        return;
      }
      if (!isValidVersion(version)) {
        respond(false, undefined, mcpError("Invalid version string"));
        return;
      }
      if (sseUrl && !isValidSseUrl(sseUrl)) {
        respond(false, undefined, mcpError("Invalid or disallowed SSE URL"));
        return;
      }

      // Preserve existing env vars from current config
      const existingConfig = manager.registry.getServer(serverId);
      const existingEnv = existingConfig?.env;

      // Stop and remove old server
      await manager.removeServer(serverId);

      // Use multi-mirror fallback for npm/pypi updates
      if (npmPackage) {
        const result = await tryInstallWithMirrorFallback({
          manager, serverId,
          type: "npm",
          packageStr: npmPackage,
          version,
          userEnv: existingEnv,
        });
        if (!result.ok) {
          respond(false, undefined, mcpError(result.error!));
          return;
        }
        const postStatus = manager.getStatus();
        const running = postStatus.servers.find((s) => s.config.id === serverId);
        if (running) persistMcpServerAdd(running.config).catch(() => {});
        respond(true, { ok: true, serverId, version, mirror: result.usedMirror });
      } else if (pypiPackage) {
        const result = await tryInstallWithMirrorFallback({
          manager, serverId,
          type: "pypi",
          packageStr: pypiPackage,
          version,
          userEnv: existingEnv,
        });
        if (!result.ok) {
          respond(false, undefined, mcpError(result.error!));
          return;
        }
        const postStatus = manager.getStatus();
        const running = postStatus.servers.find((s) => s.config.id === serverId);
        if (running) persistMcpServerAdd(running.config).catch(() => {});
        respond(true, { ok: true, serverId, version, mirror: result.usedMirror });
      } else if (sseUrl) {
        const serverConfig: MCPServerConfig = {
          id: serverId,
          command: "",
          transport: "sse",
          url: sseUrl,
          env: existingEnv,
          version: version || undefined,
          enabled: true,
          autoStart: true,
        };
        await manager.addServer(serverConfig);
        persistMcpServerAdd(serverConfig).catch(() => {});
        respond(true, { ok: true, serverId, version });
      } else {
        respond(false, undefined, mcpError("该能力没有可安装的包或 SSE 地址"));
        return;
      }
    } catch (err) {
      respond(false, undefined, mcpError(String(err)));
    }
  },
);

/**
 * mcp.marketplace.testConnection — Test if a server starts and responds.
 * Restarts the server and checks if it reaches "running" status.
 * Parameters: { serverId, env? }
 */
const mcpMarketplaceTestConnectionHandler: GatewayRequestHandler = safeHandler(
  async ({ params, respond }) => {
    const serverId = typeof params.serverId === "string" ? params.serverId : "";
    if (!serverId) {
      respond(false, undefined, mcpError("serverId required"));
      return;
    }

    const manager = getMCPManagerSafe();
    if (!manager) {
      respond(false, undefined, mcpError("MCP not initialized"));
      return;
    }

    try {
      await manager.restartServer(serverId);
      const state = manager.runtime.getServerState(serverId);
      const running = state?.status === "running";
      const toolCount = state?.tools.length ?? 0;
      respond(true, { ok: running, serverId, toolCount });
    } catch (err) {
      respond(true, { ok: false, serverId, error: String(err) });
    }
  },
);

/**
 * mcp.marketplace.sync — Force-sync the MCP marketplace index.
 * Parameters: {} (no params needed, always force)
 */
const mcpMarketplaceSyncHandler: GatewayRequestHandler = safeHandler(async ({ respond }) => {
  try {
    const { syncMcpIndex } = await import("../../mcp/marketplace-sync.js");
    const result = await syncMcpIndex({ force: true });
    respond(true, {
      ok: result.ok,
      synced: result.synced,
      itemCount: result.itemCount ?? 0,
      source: result.source ?? "",
    });
  } catch (err) {
    respond(false, undefined, mcpError(String(err)));
  }
});

// ============================================================================
// Config persistence helpers (with mutex to prevent concurrent write races)
// ============================================================================

/** Simple async mutex for serializing config file writes. */
let _configWriteLock: Promise<void> = Promise.resolve();

function withConfigLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = _configWriteLock;
  let release: () => void;
  _configWriteLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Wait for previous lock to release (catch prevents dead lock if prev somehow rejects)
  return prev
    .catch(() => {})
    .then(fn)
    .finally(() => release!());
}

/**
 * Persist a server addition/update to the config file.
 * Uses upsert: if an entry with the same id exists, it is replaced.
 * Serialized via mutex to prevent concurrent read-modify-write races.
 */
async function persistMcpServerAdd(serverConfig: MCPServerConfig): Promise<void> {
  return withConfigLock(async () => {
    try {
      const cfg = loadConfig();
      if (!cfg.mcp) cfg.mcp = { servers: [] };
      if (!cfg.mcp.servers) cfg.mcp.servers = [];

      // Upsert: remove existing entry with same id
      cfg.mcp.servers = cfg.mcp.servers.filter((s) => s.id !== serverConfig.id);
      cfg.mcp.servers.push({
        id: serverConfig.id,
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
        cwd: serverConfig.cwd,
        transport: serverConfig.transport,
        url: serverConfig.url,
        headers: serverConfig.headers,
        version: serverConfig.version,
        enabled: serverConfig.enabled,
        autoStart: serverConfig.autoStart,
        timeout: serverConfig.timeout,
      });

      await writeConfigFile(cfg);
    } catch (err) {
      console.error("[mcp] Failed to persist server config:", err);
    }
  });
}

/**
 * Persist a server removal to the config file.
 * Serialized via mutex to prevent concurrent read-modify-write races.
 */
async function persistMcpServerRemove(id: string): Promise<void> {
  return withConfigLock(async () => {
    try {
      const cfg = loadConfig();
      if (!cfg.mcp?.servers) return;

      const before = cfg.mcp.servers.length;
      cfg.mcp.servers = cfg.mcp.servers.filter((s) => s.id !== id);
      if (cfg.mcp.servers.length === before) return; // Nothing to remove

      await writeConfigFile(cfg);
    } catch (err) {
      console.error("[mcp] Failed to persist server removal:", err);
    }
  });
}

export const mcpHandlers: GatewayRequestHandlers = {
  "mcp.status": mcpStatusHandler,
  "mcp.restart": mcpRestartHandler,
  "mcp.disable": mcpDisableHandler,
  "mcp.enable": mcpEnableHandler,
  "mcp.sync": mcpSyncHandler,
  "mcp.servers.list": mcpServersListHandler,
  "mcp.servers.add": mcpServersAddHandler,
  "mcp.servers.remove": mcpServersRemoveHandler,
  "mcp.servers.updateEnv": mcpServersUpdateEnvHandler,
  "mcp.servers.batchUpdateEnv": mcpServersBatchUpdateEnvHandler,
  "mcp.marketplace.list": mcpMarketplaceListHandler,
  "mcp.marketplace.detail": mcpMarketplaceDetailHandler,
  "mcp.marketplace.install": mcpMarketplaceInstallHandler,
  "mcp.marketplace.uninstall": mcpMarketplaceUninstallHandler,
  "mcp.marketplace.update": mcpMarketplaceUpdateHandler,
  "mcp.marketplace.testConnection": mcpMarketplaceTestConnectionHandler,
  "mcp.marketplace.recommend": mcpMarketplaceRecommendHandler,
  "mcp.marketplace.sync": mcpMarketplaceSyncHandler,
};
