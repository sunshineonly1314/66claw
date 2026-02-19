/**
 * MCP Client wrapper around @modelcontextprotocol/sdk.
 *
 * Manages a single MCP server connection via stdio or SSE transport:
 * spawn/connect → initialize → tools/list → callTool → shutdown.
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
  "PATH",
  "Path",
  "HOME",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "SHELL",
  "COMSPEC",
  "TMPDIR",
  "TMP",
  "TEMP",
  "NODE_ENV",
  "SYSTEMROOT",
  "SystemRoot",
  "APPDATA",
  "LOCALAPPDATA",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "CommonProgramFiles",
  "windir",
  "XDG_DATA_HOME",
  "XDG_CONFIG_HOME",
  "XDG_CACHE_HOME",
  // npm/yarn mirror vars — needed so npx-based MCP servers use CN mirrors
  "npm_config_registry",
  "YARN_REGISTRY",
  "NVM_NODEJS_ORG_MIRROR",
  // Python/uv mirror vars — needed so uvx-based MCP servers use CN PyPI mirrors
  "UV_INDEX_URL",
  "PIP_INDEX_URL",
]);

// FIX BUG#10: 阻止通过 configEnv 注入危险环境变量（可导致代码执行）
// FIX BUG-R2-1: 补充遗漏的危险变量 + Windows 大小写绕过
const BLOCKED_ENV_KEYS = new Set([
  "NODE_OPTIONS", // 可注入 --require 实现代码执行
  "NODE_DEBUG",
  "NODE_PATH", // 可劫持模块加载路径
  "NODE_EXTRA_CA_CERTS", // 可注入恶意 CA 实现 MITM
  "LD_PRELOAD", // Linux 共享库注入
  "LD_LIBRARY_PATH",
  "LD_AUDIT", // Linux 动态链接器审计钩子
  "DYLD_INSERT_LIBRARIES", // macOS 动态库注入
  "DYLD_LIBRARY_PATH",
  "DYLD_FRAMEWORK_PATH",
  "PYTHONPATH", // Python 模块路径篡改
  "PYTHONSTARTUP", // Python 启动脚本注入
  "RUBYOPT",
  "PERL5OPT",
  "ELECTRON_RUN_AS_NODE",
  "BASH_ENV", // Bash 非交互式启动脚本
  "ENV", // sh 非交互式启动脚本
  // FIX R3-3: 补充遗漏的危险环境变量
  "GIT_SSH_COMMAND", // Git SSH 操作时执行任意命令
  "GIT_ASKPASS", // Git 凭证请求时执行程序
  "GIT_TEMPLATE_DIR", // Git init 模板目录（可注入 hooks）
  "SSH_ASKPASS", // SSH 密码请求时执行程序
  "PROMPT_COMMAND", // Bash 每次提示符前执行命令
  "ZDOTDIR", // Zsh 配置目录（可劫持 .zshrc）
  "BROWSER", // open URL 时执行的程序
  "EDITOR", // 编辑器相关命令执行
  "VISUAL", // 编辑器相关命令执行
]);

/** Build a safe environment for MCP child processes. */
function buildSafeEnv(configEnv?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of SAFE_ENV_KEYS) {
    if (process.env[key]) env[key] = process.env[key]!;
  }
  // Config-specified env vars override (these are intentional), but block dangerous keys
  // FIX BUG-R2-1: Windows 环境变量不区分大小写，用 toUpperCase 统一比较
  if (configEnv) {
    for (const [key, value] of Object.entries(configEnv)) {
      if (BLOCKED_ENV_KEYS.has(key.toUpperCase())) {
        console.warn(`[mcp] Blocked dangerous env var: ${key}`);
        continue;
      }
      env[key] = value;
    }
  }
  return env;
}

/** Generic transport interface — both StdioClientTransport and SSE transports satisfy this. */
type AnyTransport = {
  close(): Promise<void>;
  onclose?: (() => void) | null;
  onerror?: ((error: Error) => void) | null;
  /** Only present on StdioClientTransport. */
  stderr?: { on(event: string, listener: (...args: unknown[]) => void): void } | null;
  /** Only present on StdioClientTransport. */
  pid?: number;
};

export class MCPClient {
  private client: Client | null = null;
  private transport: AnyTransport | null = null;
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
    return (this.transport as StdioClientTransport)?.pid ?? undefined;
  }

  /** Connect to the MCP server via stdio or SSE transport. */
  async connect(): Promise<void> {
    if (this._connected) return;

    const timeoutMs = this.config.timeout ?? MCP_INIT_TIMEOUT_MS;

    if (this.config.transport === "sse") {
      return this.connectSSE(timeoutMs);
    }

    return this.connectStdio(timeoutMs);
  }

  // ====================================================================
  // stdio transport (existing logic, extracted to method)
  // ====================================================================

  private async connectStdio(timeoutMs: number): Promise<void> {
    const stdioTransport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
      env: buildSafeEnv(this.config.env),
      cwd: this.config.cwd,
      stderr: "pipe",
    });

    this.transport = stdioTransport as unknown as AnyTransport;
    this.client = this.createClient();
    this.wireTransportEvents(stdioTransport as unknown as AnyTransport);

    // Drain stderr to prevent child process deadlock.
    // MCP servers write debug/error logs to stderr. If the buffer fills
    // (64KB Linux, ~4KB Windows) without being consumed, the child blocks.
    const stderrStream = stdioTransport.stderr;
    if (stderrStream) {
      stderrStream.on("data", () => {
        /* drain — prevent buffer-full deadlock */
      });
      stderrStream.on("error", () => {
        /* ignore stderr errors */
      });
    }

    await this.connectWithTimeout(stdioTransport as unknown as AnyTransport, timeoutMs);
  }

  // ====================================================================
  // SSE / StreamableHTTP transport (new)
  // ====================================================================

  private async connectSSE(timeoutMs: number): Promise<void> {
    const url = this.config.url;
    if (!url) {
      throw new Error(
        `MCP server "${this.config.id}": SSE transport requires a "url" field in config.`,
      );
    }

    // Build request options with optional custom headers
    const requestInit: RequestInit | undefined = this.config.headers
      ? { headers: this.config.headers }
      : undefined;

    // Try StreamableHTTPClientTransport first (newer MCP protocol)
    let httpTransport: AnyTransport | null = null;
    try {
      const { StreamableHTTPClientTransport } =
        await import("@modelcontextprotocol/sdk/client/streamableHttp.js");

      httpTransport = new StreamableHTTPClientTransport(new URL(url), {
        requestInit,
      }) as unknown as AnyTransport;

      this.transport = httpTransport;
      this.client = this.createClient();
      this.wireTransportEvents(httpTransport);

      await this.connectWithTimeout(httpTransport, timeoutMs);
      return; // Success with StreamableHTTP
    } catch (err) {
      // FIX R3-4: 清理 failed StreamableHTTP transport 前先解绑事件回调，
      // 防止 close() 触发 onclose 将 _connected 置 false 并通知上层 "已断开"
      if (httpTransport) {
        httpTransport.onclose = null;
        httpTransport.onerror = null;
        try {
          await httpTransport.close();
        } catch {
          /* ignore */
        }
        this.transport = null;
        this.client = null;
      }

      // If server returns 405 (Method Not Allowed), it only supports legacy SSE
      const errMsg = String(err);
      if (
        !errMsg.includes("405") &&
        !errMsg.includes("Not Allowed") &&
        !errMsg.includes("Method")
      ) {
        throw err; // Not a 405 — actual error, re-throw
      }
    }

    // Fallback: SSEClientTransport (legacy protocol)
    const { SSEClientTransport } = await import("@modelcontextprotocol/sdk/client/sse.js");

    const sseTransport = new SSEClientTransport(new URL(url), {
      requestInit,
    }) as unknown as AnyTransport;

    this.transport = sseTransport;
    this.client = this.createClient();
    this.wireTransportEvents(sseTransport);

    await this.connectWithTimeout(sseTransport, timeoutMs);
  }

  // ====================================================================
  // Shared helpers
  // ====================================================================

  private createClient(): Client {
    const client = new Client({ name: "openclawcn", version: "1.0.0" }, { capabilities: {} });

    // Listen for tools/list_changed notifications from the server
    client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
      try {
        this.events.onToolsChanged?.();
      } catch {
        /* ignore */
      }
    });

    return client;
  }

  private wireTransportEvents(transport: AnyTransport): void {
    transport.onclose = () => {
      this._connected = false;
      try {
        this.events.onClose?.();
      } catch {
        /* ignore callback error */
      }
    };
    transport.onerror = (error: Error) => {
      try {
        this.events.onError?.(error);
      } catch {
        /* ignore callback error */
      }
    };
  }

  private async connectWithTimeout(transport: AnyTransport, timeoutMs: number): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");

    const connectPromise = this.client.connect(transport as Parameters<Client["connect"]>[0]);
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

    // AbortSignal integration — reject when signal fires, with cleanup
    let removeAbortListener: undefined | (() => void);
    const abortPromise = signal
      ? new Promise<never>((_, reject) => {
          const onAbort = () => reject(new Error(`MCP tool call "${name}" aborted`));
          signal.addEventListener("abort", onAbort, { once: true });
          removeAbortListener = () => signal.removeEventListener("abort", onAbort);
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
      if (removeAbortListener !== undefined) removeAbortListener();
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
        // FIX R3-5: 防止超时后 closePromise reject 变成 unhandledRejection
        closePromise.catch(() => {
          /* swallow — shutdown best-effort */
        });
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
