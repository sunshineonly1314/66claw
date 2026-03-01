/**
 * MCP Manager — central entry point for MCP integration.
 *
 * Combines Registry + RuntimeManager + ToolBridge into a single facade.
 * Provides a global singleton accessible from anywhere in the codebase.
 */

import type { AnyAgentTool } from "../agents/tools/common.js";
import { MCPRegistry } from "./registry.js";
import { MCPRuntimeManager } from "./runtime-manager.js";
import { bridgeMCPTools, isMCPToolName, parseMCPToolName, getMCPToolMeta } from "./tool-bridge.js";
import { MCP_MAX_SERVERS } from "./types.js";
import type { MCPConfig, MCPServerConfig, MCPServerState, MCPToolInfo } from "./types.js";

// Re-export useful types and utilities
export { isMCPToolName, parseMCPToolName, getMCPToolMeta } from "./tool-bridge.js";
export type { MCPToolMeta } from "./tool-bridge.js";
export type { MCPServerConfig, MCPServerState, MCPToolInfo, MCPConfig } from "./types.js";

export type MCPStatus = {
  servers: MCPServerState[];
  tools: MCPToolInfo[];
};

export class MCPManager {
  readonly registry: MCPRegistry;
  readonly runtime: MCPRuntimeManager;
  private _initialized = false;

  constructor() {
    this.registry = new MCPRegistry();
    this.runtime = new MCPRuntimeManager();
  }

  get initialized(): boolean {
    return this._initialized;
  }

  /** Initialize from config: load servers, start auto-start ones, begin health monitor. */
  async initialize(mcpConfig: MCPConfig | undefined): Promise<void> {
    if (this._initialized) return;

    // Load config
    const configs = this.registry.loadFromConfig(mcpConfig);

    // Register all servers with runtime manager
    for (const config of configs) {
      this.runtime.register(config);
    }

    // Start auto-start servers
    await this.runtime.startAutoStartServers();

    // Start health monitoring
    this.runtime.startHealthMonitor();

    this._initialized = true;
  }

  /** Get all available MCP tools as Agent tools. Never throws. */
  getAvailableTools(): AnyAgentTool[] {
    if (!this._initialized) return [];
    try {
      return bridgeMCPTools(this.runtime);
    } catch (err) {
      console.error("[mcp] Failed to bridge MCP tools:", err);
      return [];
    }
  }

  /** Get current status of all servers and tools. */
  getStatus(): MCPStatus {
    return {
      servers: this.runtime.getAllStates(),
      tools: this.runtime.getAllTools(),
    };
  }

  /** Restart a specific server. */
  async restartServer(id: string): Promise<void> {
    await this.runtime.restartServer(id);
  }

  /** Disable a specific server. */
  async disableServer(id: string): Promise<void> {
    await this.runtime.disableServer(id);
  }

  /** Enable a specific server. */
  async enableServer(id: string): Promise<void> {
    await this.runtime.enableServer(id);
  }

  /** Sync: reload config and reconcile running servers. */
  async sync(mcpConfig: MCPConfig | undefined): Promise<void> {
    const newConfigs = this.registry.loadFromConfig(mcpConfig);
    const newIds = new Set(newConfigs.map((c) => c.id));

    // Stop and unregister servers that are no longer configured
    for (const state of this.runtime.getAllStates()) {
      if (!newIds.has(state.config.id)) {
        await this.runtime.stopServer(state.config.id);
        this.runtime.unregister(state.config.id);
      }
    }

    // Register new / updated servers
    for (const config of newConfigs) {
      this.runtime.register(config);
    }

    // Start new auto-start servers
    await this.runtime.startAutoStartServers();
  }

  /** Add a server dynamically. */
  async addServer(config: MCPServerConfig): Promise<void> {
    // FIX M1: Enforce MCP_MAX_SERVERS limit at the backend level.
    // The UI enforces a softer limit, but the backend must be the source of truth.
    const currentCount = this.runtime.getAllStates().length;
    if (currentCount >= MCP_MAX_SERVERS && !this.runtime.getServerState(config.id)) {
      throw new Error(
        `Cannot add server "${config.id}": maximum ${MCP_MAX_SERVERS} servers reached. ` +
          `Remove unused servers first.`,
      );
    }

    this.registry.addServer(config);
    this.runtime.register(config);
    if (config.enabled && config.autoStart) {
      await this.runtime.startServer(config.id);
    }
  }

  /** Remove a server dynamically. */
  async removeServer(id: string): Promise<void> {
    await this.runtime.stopServer(id);
    // FIX BUG-R2-7: 清理运行时状态（健康检查、熔断器、重启定时器），防止内存泄漏
    this.runtime.unregister(id);
    this.registry.removeServer(id);
  }

  /** Shut down everything. */
  async shutdown(): Promise<void> {
    await this.runtime.shutdownAll();
    this._initialized = false;
  }
}

// ============================================================================
// Global Singleton
// ============================================================================

let globalManager: MCPManager | null = null;
let initPromise: Promise<MCPManager> | null = null;

/** Get the global MCPManager instance. Throws if not initialized. */
export function getMCPManager(): MCPManager {
  if (!globalManager) {
    throw new Error("MCPManager not initialized. Call initMCPManager() first.");
  }
  return globalManager;
}

/** Get the global MCPManager if it exists, or null. */
export function getMCPManagerSafe(): MCPManager | null {
  return globalManager;
}

/** Initialize the global MCPManager singleton. Idempotent and concurrency-safe. */
export async function initMCPManager(mcpConfig: MCPConfig | undefined): Promise<MCPManager> {
  if (globalManager?.initialized) return globalManager;

  // Prevent concurrent initialization — reuse the in-flight promise
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const manager = new MCPManager();
      await manager.initialize(mcpConfig);
      globalManager = manager;
      return manager;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Initialize MCP manager if needed.
 * Safe to call multiple times — only initializes once.
 * Does not throw if config is missing.
 */
export async function initMCPManagerIfNeeded(
  config: { mcp?: MCPConfig } | undefined,
): Promise<void> {
  if (globalManager?.initialized) return;
  if (!config?.mcp?.servers?.length) return;

  try {
    await initMCPManager(config.mcp);
  } catch (err) {
    console.error("[mcp] Failed to initialize MCP manager:", err);
  }
}

/** Shut down and destroy the global MCPManager. */
export async function destroyMCPManager(): Promise<void> {
  if (globalManager) {
    await globalManager.shutdown();
    globalManager = null;
  }
}
