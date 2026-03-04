/**
 * MCP Runtime Manager — manages the lifecycle of all MCP server processes.
 *
 * Responsibilities:
 *   - Start / stop / restart individual servers
 *   - Auto-start servers marked as autoStart
 *   - Health monitoring with circuit breaker
 *   - Automatic restart on crash (up to MAX_RESTART_ATTEMPTS)
 */

import { MCPClient } from "./mcp-client.js";
import type { MCPServerConfig, MCPServerState, MCPServerStatus, MCPToolInfo } from "./types.js";
import {
  MCP_MAX_RESTART_ATTEMPTS,
  MCP_HEALTH_INTERVAL_MS,
  MCP_CIRCUIT_COOLDOWN_MS,
  MCP_HEALTH_FAILURE_THRESHOLD,
} from "./types.js";

export class MCPRuntimeManager {
  private states = new Map<string, MCPServerState>();
  private clients = new Map<string, MCPClient>();
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private healthFailures = new Map<string, number>();
  private circuitOpenAt = new Map<string, number>();
  /** Tracks consecutive circuit opens for exponential backoff. */
  private circuitOpenCount = new Map<string, number>();
  /** Pending auto-restart timers — tracked so we can cancel duplicates. */
  private pendingRestarts = new Map<string, ReturnType<typeof setTimeout>>();
  /** Per-server serialization lock: chains start/stop operations to prevent races. */
  private serverLocks = new Map<string, Promise<void>>();

  /** Register a server config (does not start it). */
  register(config: MCPServerConfig): void {
    if (this.states.has(config.id)) return;
    this.states.set(config.id, {
      config,
      status: "stopped",
      tools: [],
      restartCount: 0,
    });
  }

  /** Start a single MCP server. */
  async startServer(id: string): Promise<void> {
    // Serialize per-server: wait for any in-flight operation on this id to finish
    const prevStart = this.serverLocks.get(id) ?? Promise.resolve();
    let releaseStart!: () => void;
    const nextStart = new Promise<void>((resolve) => {
      releaseStart = resolve;
    });
    this.serverLocks.set(
      id,
      prevStart.then(() => nextStart),
    );
    await prevStart;
    try {
      const state = this.states.get(id);
      if (!state) throw new Error(`Unknown MCP server: ${id}`);
      if (state.status === "running") return;
      if (!state.config.enabled) {
        this.updateStatus(id, "stopped");
        return;
      }

      this.updateStatus(id, "spawning");

      const client = new MCPClient(state.config, {
        onClose: () => this.handleServerClose(id),
        onError: (err) => this.handleServerError(id, err),
        onToolsChanged: () => this.handleToolsChanged(id),
      });

      try {
        this.updateStatus(id, "initializing");
        await client.connect();

        // Get tool list
        const tools = await client.listTools();

        this.clients.set(id, client);
        const s = this.states.get(id)!;
        s.status = "running";
        s.pid = client.pid;
        s.tools = tools;
        s.error = undefined;
        s.restartCount = 0;
        s.lastHealthCheck = Date.now();
        this.healthFailures.set(id, 0);
        this.circuitOpenAt.delete(id);
        this.circuitOpenCount.delete(id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.updateStatus(id, "error", message);
        await client.shutdown().catch(() => {});
        this.clients.delete(id);
      }
    } finally {
      releaseStart!();
    }
  }

  /** Stop a single MCP server. */
  async stopServer(id: string): Promise<void> {
    // Serialize per-server: wait for any in-flight operation on this id to finish
    const prevStop = this.serverLocks.get(id) ?? Promise.resolve();
    let releaseStop!: () => void;
    const nextStop = new Promise<void>((resolve) => {
      releaseStop = resolve;
    });
    this.serverLocks.set(
      id,
      prevStop.then(() => nextStop),
    );
    await prevStop;
    try {
      // Cancel any pending auto-restart before stopping
      this.cancelPendingRestart(id);

      const client = this.clients.get(id);
      if (client) {
        await client.shutdown().catch(() => {});
        this.clients.delete(id);
      }
      this.updateStatus(id, "stopped");
      const state = this.states.get(id);
      if (state) {
        state.tools = [];
        state.pid = undefined;
      }
    } finally {
      releaseStop!();
    }
  }

  /** Restart a single server. */
  async restartServer(id: string): Promise<void> {
    const state = this.states.get(id);
    if (!state) throw new Error(`Unknown MCP server: ${id}`);

    this.updateStatus(id, "restarting");
    await this.stopServer(id);

    // Reset circuit breaker on manual restart
    this.healthFailures.set(id, 0);
    this.circuitOpenAt.delete(id);
    this.circuitOpenCount.delete(id);
    state.restartCount = 0;

    await this.startServer(id);
  }

  /** Disable a server (stop + mark disabled). */
  async disableServer(id: string): Promise<void> {
    const state = this.states.get(id);
    if (!state) throw new Error(`Unknown MCP server: ${id}`);
    state.config.enabled = false;
    await this.stopServer(id);
  }

  /** Enable a server. */
  async enableServer(id: string): Promise<void> {
    const state = this.states.get(id);
    if (!state) throw new Error(`Unknown MCP server: ${id}`);
    state.config.enabled = true;
    await this.startServer(id);
  }

  /** Start all servers marked as autoStart. */
  async startAutoStartServers(): Promise<void> {
    const autoStartIds: string[] = [];
    for (const [id, state] of this.states) {
      if (state.config.enabled && state.config.autoStart) {
        autoStartIds.push(id);
      }
    }
    // Start in parallel, but don't fail-fast
    await Promise.allSettled(autoStartIds.map((id) => this.startServer(id)));
  }

  /** Shut down all servers and stop health monitoring. */
  async shutdownAll(): Promise<void> {
    this.stopHealthMonitor();
    // Cancel all pending auto-restart timers
    for (const timer of this.pendingRestarts.values()) {
      clearTimeout(timer);
    }
    this.pendingRestarts.clear();
    const ids = [...this.clients.keys()];
    await Promise.allSettled(ids.map((id) => this.stopServer(id)));
  }

  /** Get the state of a single server. */
  getServerState(id: string): MCPServerState | undefined {
    return this.states.get(id);
  }

  /** Get all server states. */
  getAllStates(): MCPServerState[] {
    return [...this.states.values()];
  }

  /** Unregister a server entirely (removes state and client). Call stopServer first. */
  unregister(id: string): void {
    // Shut down the client before removing the reference to prevent resource leaks
    const client = this.clients.get(id);
    if (client) {
      void client.shutdown().catch(() => {});
    }
    this.clients.delete(id);
    this.states.delete(id);
    this.healthFailures.delete(id);
    this.circuitOpenAt.delete(id);
    this.circuitOpenCount.delete(id);
    this.cancelPendingRestart(id);
    this.serverLocks.delete(id);
  }

  /** Get client for a server (for tool calls). */
  getClient(id: string): MCPClient | undefined {
    return this.clients.get(id);
  }

  /** Get all tools from all running servers. */
  getAllTools(): MCPToolInfo[] {
    const tools: MCPToolInfo[] = [];
    for (const state of this.states.values()) {
      if (state.status === "running") {
        tools.push(...state.tools);
      }
    }
    return tools;
  }

  // ============================================================================
  // Health Monitoring
  // ============================================================================

  /** Start periodic health checks. */
  startHealthMonitor(): void {
    if (this.healthTimer) return;
    this.healthTimer = setInterval(() => {
      this.runHealthChecks().catch(() => {
        /* health check errors are handled internally */
      });
    }, MCP_HEALTH_INTERVAL_MS);
  }

  /** Stop health monitoring. */
  stopHealthMonitor(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  private async runHealthChecks(): Promise<void> {
    for (const [id, state] of this.states) {
      if (state.status !== "running") continue;

      const client = this.clients.get(id);
      if (!client || !client.connected) {
        this.handleHealthFailure(id);
        continue;
      }

      // Ping by listing tools (lightweight check)
      try {
        await client.listTools();
        state.lastHealthCheck = Date.now();
        this.healthFailures.set(id, 0);
      } catch {
        this.handleHealthFailure(id);
      }
    }

    // Check circuit breaker cooldowns (with exponential backoff)
    for (const [id, openAt] of this.circuitOpenAt) {
      const openCount = this.circuitOpenCount.get(id) ?? 1;
      // Exponential backoff: cooldown * 2^(openCount-1), capped at 8x base cooldown
      const backoffMultiplier = Math.min(Math.pow(2, openCount - 1), 8);
      const effectiveCooldown = MCP_CIRCUIT_COOLDOWN_MS * backoffMultiplier;
      if (Date.now() - openAt >= effectiveCooldown) {
        this.circuitOpenAt.delete(id);
        this.healthFailures.set(id, 0);
        const state = this.states.get(id);
        if (state && state.status === "circuit_open" && state.config.enabled) {
          // Reset restartCount so the server gets a full MCP_MAX_RESTART_ATTEMPTS
          // budget for the new recovery attempt. Without this reset, a server that
          // hit the restart limit before tripping the circuit breaker would be
          // immediately locked into "error" again on the first crash after recovery.
          state.restartCount = 0;
          // Reset circuitOpenCount so the next failure sequence starts a fresh
          // exponential backoff rather than continuing from an inflated exponent.
          this.circuitOpenCount.delete(id);
          this.startServer(id).catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.updateStatus(id, "error", `Circuit recovery failed: ${msg}`);
          });
        }
      }
    }
  }

  private handleHealthFailure(id: string): void {
    const failures = (this.healthFailures.get(id) ?? 0) + 1;
    this.healthFailures.set(id, failures);

    if (failures >= MCP_HEALTH_FAILURE_THRESHOLD) {
      this.updateStatus(id, "circuit_open", `${failures} consecutive health check failures`);
      this.circuitOpenAt.set(id, Date.now());
      this.circuitOpenCount.set(id, (this.circuitOpenCount.get(id) ?? 0) + 1);
      // Stop the client
      const client = this.clients.get(id);
      if (client) {
        void client.shutdown().catch(() => {});
        this.clients.delete(id);
      }
    }
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  private handleServerClose(id: string): void {
    const state = this.states.get(id);
    if (!state) return;
    if (
      state.status === "stopped" ||
      state.status === "restarting" ||
      state.status === "circuit_open"
    )
      return;

    // Unexpected close — attempt auto-restart
    this.clients.delete(id);
    // Cancel any existing pending restart for this server
    this.cancelPendingRestart(id);

    if (state.restartCount < MCP_MAX_RESTART_ATTEMPTS && state.config.enabled) {
      state.restartCount += 1;
      this.updateStatus(id, "restarting");
      // Delay restart slightly to avoid rapid cycling
      const timer = setTimeout(() => {
        this.pendingRestarts.delete(id);
        this.startServer(id).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.updateStatus(id, "error", `Auto-restart failed: ${msg}`);
        });
      }, 1000 * state.restartCount);
      this.pendingRestarts.set(id, timer);
    } else {
      this.updateStatus(id, "error", `Crashed after ${state.restartCount} restart attempts`);
    }
  }

  private handleServerError(id: string, error: Error): void {
    const state = this.states.get(id);
    if (!state) return;
    if (state.status === "stopped" || state.status === "restarting") return;
    state.error = error.message;
  }

  /**
   * Handle tools/list_changed notification from MCP server.
   * Re-fetches the tool list so bridged tools stay in sync.
   */
  private handleToolsChanged(id: string): void {
    const state = this.states.get(id);
    if (!state || state.status !== "running") return;
    const client = this.clients.get(id);
    if (!client) return;

    client
      .listTools()
      .then((tools) => {
        const s = this.states.get(id);
        if (s && s.status === "running") {
          s.tools = tools;
        }
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[mcp] Failed to refresh tools for "${id}": ${msg}`);
      });
  }

  /** Cancel a pending auto-restart timer for a server. */
  private cancelPendingRestart(id: string): void {
    const timer = this.pendingRestarts.get(id);
    if (timer != null) {
      clearTimeout(timer);
      this.pendingRestarts.delete(id);
    }
  }

  private updateStatus(id: string, status: MCPServerStatus, error?: string): void {
    const state = this.states.get(id);
    if (!state) return;
    state.status = status;
    if (error !== undefined) state.error = error;
    if (status !== "error" && status !== "circuit_open") state.error = undefined;
  }
}
