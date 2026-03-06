/**
 * MCP Client wrapper around @modelcontextprotocol/sdk.
 *
 * Manages a single MCP server connection via stdio or SSE transport:
 * spawn/connect → initialize → tools/list → callTool → shutdown.
 */

import path from "node:path";
import fs from "node:fs";
import {
  prependBundledNodeToPath,
  resolveBundledNodeDir,
  resolveBundledNodeExe,
} from "../infra/bundled-node.js";
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
import { shouldUseCNMirror, getNpmMirrorUrl, getPipMirrorUrl } from "../config/cn-mirrors.js";

export type MCPClientEvents = {
  onClose?: () => void;
  onError?: (error: Error) => void;
  /** Called when the server notifies that its tool list has changed. */
  onToolsChanged?: () => void;
};

/** Sanitize an MCP tool name segment for use in an Agent tool name. */
function sanitizeSegment(s: string): string {
  // Replace runs of non-alphanumeric chars with a single underscore.
  // This guarantees "__" (double underscore) never appears WITHIN a segment,
  // allowing it to serve as a reliable delimiter between serverId and toolName.
  return s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/** Build a bridged tool name: mcp_{serverId}__{toolName} (double underscore delimiter) */
export function buildBridgedName(serverId: string, toolName: string): string {
  return `${MCP_TOOL_PREFIX}${sanitizeSegment(serverId)}__${sanitizeSegment(toolName)}`;
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

/**
 * Locate the directory containing uvx/uv on the system.
 * Checks both the current PATH and common Windows Python installation paths.
 * Returns the directory path if found, or null if not found.
 * Result is cached after first call.
 */
let _cachedUvDir: string | null | undefined;
function findUvDir(): string | null {
  if (_cachedUvDir !== undefined) return _cachedUvDir;

  const isWindows = process.platform === "win32";
  const uvExe = isWindows ? "uvx.exe" : "uvx";

  // 1. Check if uvx is already on the current PATH
  const currentPath = process.env.PATH ?? process.env.Path ?? "";
  for (const dir of currentPath.split(path.delimiter).filter(Boolean)) {
    try {
      if (fs.existsSync(path.join(dir, uvExe))) {
        _cachedUvDir = dir;
        return dir;
      }
    } catch {
      /* continue */
    }
  }

  // 2. Search common installation paths (Windows only — unix PATH is authoritative)
  if (isWindows) {
    const candidates = [
      // pip install uv → Scripts dir
      `${process.env.LOCALAPPDATA ?? ""}\\Programs\\Python\\Python*\\Scripts`,
      "D:\\Program Files\\python\\Scripts",
      "C:\\Python*\\Scripts",
      `${process.env.USERPROFILE ?? ""}\\.local\\bin`,
      `${process.env.USERPROFILE ?? ""}\\.cargo\\bin`,
      // Common scoop / winget paths
      `${process.env.USERPROFILE ?? ""}\\scoop\\shims`,
      `${process.env.LOCALAPPDATA ?? ""}\\Microsoft\\WinGet\\Links`,
    ].filter(Boolean);

    for (const candidate of candidates) {
      // Support simple glob (Python*)
      if (candidate.includes("*")) {
        const parentDir = path.dirname(candidate);
        const pattern = path.basename(candidate);
        try {
          if (fs.existsSync(parentDir)) {
            const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$", "i");
            const entries = fs.readdirSync(parentDir).filter((e) => regex.test(e));
            // Sort descending to prefer newest version
            entries.sort().reverse();
            for (const entry of entries) {
              const full = path.join(parentDir, entry);
              if (fs.existsSync(path.join(full, uvExe))) {
                _cachedUvDir = full;
                return full;
              }
            }
          }
        } catch {
          /* continue */
        }
      } else {
        try {
          if (fs.existsSync(path.join(candidate, uvExe))) {
            _cachedUvDir = candidate;
            return candidate;
          }
        } catch {
          /* continue */
        }
      }
    }
  }

  _cachedUvDir = null;
  return null;
}

/** Build a safe environment for MCP child processes.
 *  Ensures the bundled node directory is prepended to PATH so npx/npm resolve correctly.
 *  Also ensures uvx/uv directory is on PATH for Python-based MCP servers. */
function buildSafeEnv(configEnv?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of SAFE_ENV_KEYS) {
    if (process.env[key]) env[key] = process.env[key]!;
  }

  // Ensure the bundled node directory is FIRST in PATH for child processes.
  // Using prependBundledNodeToPath (not execDir) so the correct bundled node
  // is found even when the main process was started with a system node.
  const pathKey = process.platform === "win32" && env.Path ? "Path" : "PATH";
  env[pathKey] = prependBundledNodeToPath(env[pathKey]);

  // Ensure uvx/uv directory is on PATH for Python-based MCP servers.
  // Tauri desktop app may not inherit the full user PATH, so we search
  // common Python installation paths to find uvx.
  const uvDir = findUvDir();
  if (uvDir) {
    const currentParts = (env[pathKey] ?? "").split(path.delimiter);
    const uvDirResolved = path.resolve(uvDir);
    if (!currentParts.some((p) => path.resolve(p) === uvDirResolved)) {
      env[pathKey] = env[pathKey] ? `${env[pathKey]}${path.delimiter}${uvDir}` : uvDir;
    }
  }

  // Actively inject CN mirror env vars when the user is in China.
  // Without this, MCP child processes (npx/uvx) would default to international
  // registries which are unreachable for most Chinese users.
  // Only inject if not already set by process.env or configEnv (user overrides win).
  if (shouldUseCNMirror()) {
    if (!env.npm_config_registry && !configEnv?.npm_config_registry) {
      env.npm_config_registry = getNpmMirrorUrl();
    }
    if (!env.UV_INDEX_URL && !configEnv?.UV_INDEX_URL) {
      env.UV_INDEX_URL = getPipMirrorUrl();
    }
    if (!env.PIP_INDEX_URL && !configEnv?.PIP_INDEX_URL) {
      env.PIP_INDEX_URL = getPipMirrorUrl();
    }
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

/**
 * Rewrite npx/npm commands to use the bundled node binary directly.
 *
 * Problem 1: npx/npm scripts use `#!/usr/bin/env node` shebang. If the system
 * has Node.js v24+ (which defaults to ESM), the shebang resolves to system
 * node instead of our bundled v22, causing `require() is not defined` crashes.
 *
 * Problem 2: Even with the correct bundled node, if the parent directory tree
 * has a package.json with "type": "module" (as in our Tauri resources/ dir),
 * the extensionless npx/npm scripts are treated as ESM, causing the same crash.
 *
 * Solution: instead of spawning `npx ...args`, spawn `<bundled-node> <npx-cli.js> ...args`.
 * This bypasses both the shebang and the ESM module-type inference entirely.
 */
function rewriteNodeCommand(command: string, args: string[]): { command: string; args: string[] } {
  // Detect npx/npm — check both bare commands ("npx") and absolute paths
  // ("/path/to/npx", "C:\node\npx.cmd"). Even absolute-path npx has a
  // #!/usr/bin/env node shebang that resolves to system node v24+.
  const basename = path
    .basename(command)
    .toLowerCase()
    .replace(/\.cmd$|\.exe$/i, "");

  if (basename !== "npx" && basename !== "npm") {
    return { command, args };
  }

  const bundledNodeDir = resolveBundledNodeDir();
  const bundledNodeExe = resolveBundledNodeExe();

  // Locate the CLI entry-point script for npx/npm within bundled node_modules.
  const cliScript = basename === "npx" ? "npx-cli.js" : "npm-cli.js";
  // macOS/Linux layout: node/lib/node_modules/npm/bin/npx-cli.js
  // Windows node-portable layout: node/node_modules/npm/bin/npx-cli.js
  const candidates = [
    path.join(bundledNodeDir, "lib", "node_modules", "npm", "bin", cliScript),
    path.join(bundledNodeDir, "node_modules", "npm", "bin", cliScript),
  ];

  // If command is an absolute path (e.g. /path/to/node/bin/npx), also try to
  // derive the CLI script location from the command path itself. This handles
  // cases where bundledNodeDir differs from the actual npx install location
  // (e.g. defaults.ts resolved npx via process.execPath which may differ from
  // resolveBundledNodeDir() when the gateway entry point is in a different tree).
  if (path.isAbsolute(command)) {
    const commandDir = path.dirname(command);
    // node/bin/npx → node/lib/node_modules/npm/bin/npx-cli.js
    const fromCommand = path.resolve(
      commandDir,
      "..",
      "lib",
      "node_modules",
      "npm",
      "bin",
      cliScript,
    );
    // Also check Windows-style: node/node_modules/npm/bin/npx-cli.js
    const fromCommandWin = path.resolve(commandDir, "..", "node_modules", "npm", "bin", cliScript);

    for (const extra of [fromCommand, fromCommandWin]) {
      if (!candidates.includes(extra)) {
        candidates.push(extra);
      }
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { command: bundledNodeExe, args: [candidate, ...args] };
    }
  }

  // Fallback: no CLI script found — return original command (rely on PATH).
  // This can happen in dev mode where there's no bundled node.
  // On production builds this indicates a broken bundled node install (missing npm).
  console.warn(
    `[mcp] Could not find bundled ${basename} CLI script in ${bundledNodeDir}. ` +
      `Falling back to system ${command} — this may fail if the parent directory has ` +
      `"type":"module" in package.json or if system Node.js is v24+ (ESM-only). ` +
      `Candidates tried: ${candidates.join(", ")}`,
  );
  return { command, args };
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
  /** Monotonic generation counter to detect stale onclose callbacks.
   *  Incremented on each connect attempt; onclose only clears _connected
   *  if the generation matches, preventing the race where a late onclose
   *  fires after a new successful connection overwrites _connected = true. */
  private _connectGen = 0;
  /**
   * In-flight connect() Promise — used as a mutex so concurrent callers
   * share a single connection attempt instead of racing each other.
   *
   * Business context: MCP servers are initialized in batch on plugin load
   * and can also be triggered by the onClose reconnect path while another
   * caller is already retrying. Without serialization both callers would
   * create independent transports, doubling resource usage and producing
   * two onClose handlers per connection cycle.
   *
   * Pattern: store the Promise itself (not just a flag) so waiting callers
   * can await the same result — if the in-flight attempt succeeds they
   * get connected for free; if it fails they receive the same error and
   * can decide whether to retry at their own layer.
   */
  private _connectPromise: Promise<void> | null = null;

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
  connect(): Promise<void> {
    // Fast path: already connected.
    if (this._connected) return Promise.resolve();

    // Serialization: if a connect() is already in-flight, return the same
    // Promise so concurrent callers share one attempt rather than racing.
    // When the in-flight attempt settles (success or error) _connectPromise
    // is cleared so the next call starts a fresh attempt.
    if (this._connectPromise !== null) return this._connectPromise;

    const timeoutMs = this.config.timeout ?? MCP_INIT_TIMEOUT_MS;

    // Bump generation BEFORE starting the attempt so any stale onclose
    // callbacks from prior transports don't corrupt the new connection.
    this._connectGen++;

    const attempt =
      this.config.transport === "sse" ? this.connectSSE(timeoutMs) : this.connectStdio(timeoutMs);

    this._connectPromise = attempt.finally(() => {
      // Clear the in-flight reference regardless of success/failure so the
      // next caller can start a fresh attempt if needed.
      this._connectPromise = null;
    });

    return this._connectPromise;
  }

  // ====================================================================
  // stdio transport (existing logic, extracted to method)
  // ====================================================================

  private async connectStdio(timeoutMs: number): Promise<void> {
    // Rewrite npx/npm to use bundled node directly, bypassing #!/usr/bin/env node
    // shebang which may resolve to an incompatible system node (e.g. v24 ESM-only).
    const rewritten = rewriteNodeCommand(this.config.command, this.config.args ?? []);
    const stdioTransport = new StdioClientTransport({
      command: rewritten.command,
      args: rewritten.args,
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
      const serverId = this.config.id;
      let stderrBuf = "";
      stderrStream.on("data", (chunk: Buffer | string) => {
        const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
        stderrBuf += text;
        // Log first 2KB of stderr for debugging startup failures
        if (stderrBuf.length <= 2048) {
          console.warn(`[mcp:stderr:${serverId}] ${text.trimEnd()}`);
        }
      });
      stderrStream.on("error", () => {
        /* ignore stderr errors */
      });
    }

    try {
      await this.connectWithTimeout(stdioTransport as unknown as AnyTransport, timeoutMs);
    } catch (err) {
      // connectWithTimeout failed (timeout or connect error). The spawned child
      // process is still running — we must close the transport to kill it.
      // Mirror the SSE fallback cleanup pattern: unbind callbacks first so the
      // onclose event from transport.close() does NOT trigger _connected = false
      // via a stale callback (the generation counter also guards this, but being
      // explicit prevents spurious onClose events to the caller).
      stdioTransport.onclose = undefined;
      stdioTransport.onerror = undefined;
      try {
        await (stdioTransport as unknown as AnyTransport).close();
      } catch {
        /* ignore close errors — process may already be dead */
      }
      this.transport = null;
      this.client = null;
      throw err;
    }
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

      // If server doesn't support StreamableHTTP, fall back to legacy SSE.
      // 405 = Method Not Allowed (most common), 406 = Not Acceptable,
      // 415 = Unsupported Media Type, 501 = Not Implemented.
      // Do NOT fallback on 401/403 — those are auth errors that the user needs to resolve.
      const errMsg = String(err);
      const shouldFallback =
        errMsg.includes("405") ||
        errMsg.includes("Not Allowed") ||
        errMsg.includes("Method") ||
        errMsg.includes("406") ||
        errMsg.includes("Not Acceptable") ||
        errMsg.includes("415") ||
        errMsg.includes("Unsupported Media Type") ||
        errMsg.includes("501") ||
        errMsg.includes("Not Implemented");
      if (!shouldFallback) {
        throw err; // Actual error (auth, network, etc.) — re-throw
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
    // Capture current generation so the onclose callback can detect
    // whether it belongs to the current connection or a stale one.
    const gen = this._connectGen;
    transport.onclose = () => {
      // Only process close if this callback belongs to the current
      // connection generation. A stale onclose (from a previous failed
      // transport) must NOT overwrite a newer successful _connected = true
      // or trigger spurious onClose events to the runtime manager.
      if (this._connectGen === gen) {
        this._connected = false;
        try {
          this.events.onClose?.();
        } catch {
          /* ignore callback error */
        }
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
      // Set _connected ONLY if the transport hasn't already closed.
      // (If onclose fired during the connect, _connected was already set to false
      // and we should NOT override it.)
      if (this.transport === transport) {
        this._connected = true;
      }
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
    if (!this._connected && !this.transport && !this._connectPromise) return;

    this._connected = false;
    // Cancel any in-flight connect: clear the reference so subsequent callers
    // don't await a connect that will be torn down immediately after.
    this._connectPromise = null;

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
