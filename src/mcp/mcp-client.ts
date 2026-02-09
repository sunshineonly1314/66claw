/**
 * MCP Client wrapper around @modelcontextprotocol/sdk.
 *
 * Manages a single MCP server connection via stdio transport:
 * spawn → initialize → tools/list → callTool → shutdown.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";

import type { MCPServerConfig, MCPToolInfo } from "./types.js";
import {
  MCP_TOOL_PREFIX,
  MCP_INIT_TIMEOUT_MS,
  MCP_CALL_TIMEOUT_MS,
  MCP_SHUTDOWN_GRACE_MS,
} from "./types.js";

export type MCPClientEvents = {
  onClose?: () => void;
  onError?: (error: Error) => void;
  /** Called when the server notifies that its tool list has changed. */
  onToolsChanged?: () => void;
};

/** Sanitize an MCP tool name segment for use in an Agent tool name. */
function sanitizeSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "_");
}

/** Build a bridged tool name: mcp_{serverId}_{toolName} */
export function buildBridgedName(serverId: string, toolName: string): string {
  return `${MCP_TOOL_PREFIX}${sanitizeSegment(serverId)}_${sanitizeSegment(toolName)}`;
}

/**
 * Environment variables safe to pass to MCP child processes.
 * Only include standard runtime vars, never secrets.
 */
const SAFE_ENV_KEYS = new Set([
  "PATH", "Path",
  "HOME", "USERPROFILE", "HOMEDRIVE", "HOMEPATH",
  "LANG", "LC_ALL", "LC_CTYPE",
  "TERM", "SHELL", "COMSPEC",
  "TMPDIR", "TMP", "TEMP",
  "NODE_ENV",
  "SYSTEMROOT", "SystemRoot",
  "APPDATA", "LOCALAPPDATA", "ProgramFiles", "ProgramFiles(x86)",
  "CommonProgramFiles", "windir",
  "XDG_DATA_HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME",
  // npm/yarn mirror vars — needed so npx-based MCP servers use CN mirrors
  "npm_config_registry", "YARN_REGISTRY", "NVM_NODEJS_ORG_MIRROR",
  // Python/uv mirror vars — needed so uvx-based MCP servers use CN PyPI mirrors
  "UV_INDEX_URL", "PIP_INDEX_URL",
]);

/** Build a safe environment for MCP child processes. */
function buildSafeEnv(configEnv?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of SAFE_ENV_KEYS) {
    if (process.env[key]) env[key] = process.env[key]!;
  }
  // Config-specified env vars override (these are intentional)
  if (configEnv) Object.assign(env, configEnv);
  return env;
}

export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private config: MCPServerConfig;
  private events: MCPClientEvents;
  private _connected = false;

  constructor(config: MCPServerConfig, events: MCPClientEvents = {}) {
    this.config = config;
    this.events = events;
  }

  get connected(): boolean {
    return this._connected;
  }

  get pid(): number | undefined {
    return this.transport?.pid ?? undefined;
  }

  /** Connect to the MCP server: spawn process, initialize protocol. */
  async connect(): Promise<void> {
    if (this._connected) return;

    if (this.config.transport === "sse") {
      throw new Error(`MCP server "${this.config.id}": SSE transport is not yet supported. Use "stdio".`);
    }

    const timeoutMs = this.config.timeout ?? MCP_INIT_TIMEOUT_MS;

    this.transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
      env: buildSafeEnv(this.config.env),
      cwd: this.config.cwd,
      stderr: "pipe",
    });

    this.client = new Client(
      {
        name: "clawdbot",
        version: "1.0.0",
      },
      {
        capabilities: {
          // Declare what we support — servers check these to decide what features to expose
        },
      },
    );

    // Listen for tools/list_changed notifications from the server
    this.client.setNotificationHandler(
      ToolListChangedNotificationSchema,
      async () => {
        try { this.events.onToolsChanged?.(); } catch { /* ignore */ }
      },
    );

    // Wire up events — wrapped in try-catch to prevent unhandled exceptions
    this.transport.onclose = () => {
      this._connected = false;
      try { this.events.onClose?.(); } catch { /* ignore callback error */ }
    };
    this.transport.onerror = (error: Error) => {
      try { this.events.onError?.(error); } catch { /* ignore callback error */ }
    };

    // Drain stderr to prevent child process deadlock.
    // MCP servers write debug/error logs to stderr. If the buffer fills
    // (64KB Linux, ~4KB Windows) without being consumed, the child blocks.
    const stderrStream = this.transport.stderr;
    if (stderrStream) {
      stderrStream.on("data", () => { /* drain — prevent buffer-full deadlock */ });
      stderrStream.on("error", () => { /* ignore stderr errors */ });
    }

    // Connect with timeout — MUST clear timer on success/failure to prevent leak
    const connectPromise = this.client.connect(this.transport);
    let connectTimer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      connectTimer = setTimeout(
        () => reject(new Error(`MCP server "${this.config.id}" init timeout (${timeoutMs}ms)`)),
        timeoutMs,
      );
    });

    try {
      await Promise.race([connectPromise, timeoutPromise]);
      this._connected = true;
    } finally {
      if (connectTimer != null) clearTimeout(connectTimer);
    }
  }

  /** List all tools exposed by this MCP server. */
  async listTools(): Promise<MCPToolInfo[]> {
    if (!this.client || !this._connected) {
      throw new Error(`MCP server "${this.config.id}" not connected`);
    }

    const result = await this.client.listTools();
    return (result.tools ?? []).map((tool) => ({
      serverId: this.config.id,
      name: tool.name,
      bridgedName: buildBridgedName(this.config.id, tool.name),
      description: tool.description ?? "",
      inputSchema: (tool.inputSchema ?? {}) as Record<string, unknown>,
    }));
  }

  /** Call a tool on the MCP server. Supports AbortSignal for cancellation. */
  async callTool(
    name: string,
    args: Record<string, unknown> = {},
    signal?: AbortSignal,
  ): Promise<{ content: unknown; isError: boolean }> {
    if (!this.client || !this._connected) {
      throw new Error(`MCP server "${this.config.id}" not connected`);
    }

    // Check if already aborted (e.g., user switched sessions)
    if (signal?.aborted) {
      throw new Error(`MCP tool call "${name}" aborted before execution`);
    }

    const callPromise = this.client.callTool({ name, arguments: args });

    // Timeout timer — MUST be cleared to prevent timer leak
    let callTimer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      callTimer = setTimeout(
        () => reject(new Error(`MCP tool call "${name}" timeout (${MCP_CALL_TIMEOUT_MS}ms)`)),
        MCP_CALL_TIMEOUT_MS,
      );
    });

    // AbortSignal integration — reject when signal fires
    const abortPromise = signal
      ? new Promise<never>((_, reject) => {
          const onAbort = () => reject(new Error(`MCP tool call "${name}" aborted`));
          signal.addEventListener("abort", onAbort, { once: true });
        })
      : null;

    const racers: Promise<unknown>[] = [callPromise, timeoutPromise];
    if (abortPromise) racers.push(abortPromise);

    try {
      const result = await (Promise.race(racers) as Promise<Awaited<typeof callPromise>>);
      return {
        content: result.content,
        isError: result.isError === true,
      };
    } finally {
      if (callTimer != null) clearTimeout(callTimer);
    }
  }

  /** Gracefully shut down the MCP server. */
  async shutdown(): Promise<void> {
    if (!this._connected && !this.transport) return;

    this._connected = false;

    let shutdownTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      // Try graceful close with timeout
      const closePromise = this.client?.close();
      if (closePromise) {
        const timeoutPromise = new Promise<void>((resolve) => {
          shutdownTimer = setTimeout(resolve, MCP_SHUTDOWN_GRACE_MS);
        });
        await Promise.race([closePromise, timeoutPromise]);
      }
    } catch {
      // Ignore errors during shutdown
    } finally {
      if (shutdownTimer != null) clearTimeout(shutdownTimer);
      try {
        await this.transport?.close();
      } catch {
        // Ignore
      }
      this.client = null;
      this.transport = null;
    }
  }
}
