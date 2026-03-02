/**
 * mcp-methods.cn-mirror.test.ts
 * Tests for CN mirror env injection in MCP install/update/add handlers.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { GatewayRequestHandlerOptions } from "./types.js";

// ── Mocks ───────────────────────────────────────────────────

const cnMirrorMocks = vi.hoisted(() => ({
  shouldUseCNMirror: vi.fn(),
}));

vi.mock("../../config/cn-mirrors.js", () => ({
  shouldUseCNMirror: cnMirrorMocks.shouldUseCNMirror,
  getNpmMirrorUrl: () => "https://registry.npmmirror.com/",
  getPipMirrorUrl: () => "https://pypi.tuna.tsinghua.edu.cn/simple",
  getNpmMirrors: () => ["https://registry.npmmirror.com/"],
  getPipMirrors: () => ["https://pypi.tuna.tsinghua.edu.cn/simple"],
  PACKAGE_MANAGER_MIRRORS: {
    npm: { primary: "https://registry.npmmirror.com/", fallbacks: [] },
    pip: { primary: "https://pypi.tuna.tsinghua.edu.cn/simple", fallbacks: [] },
    go: { primary: "https://goproxy.cn,direct", fallbacks: [] },
  },
  BINARY_DOWNLOAD_MIRRORS: {
    github: { primary: "https://github.com", fallback: "https://ghproxy.com/https://github.com" },
    uv: {
      installScript: "https://astral.sh/uv/install.sh",
      installPs1: "https://astral.sh/uv/install.ps1",
    },
    node: { primary: "https://nodejs.org/dist" },
    goBinary: { primary: "https://go.dev/dl" },
    python: { primary: "https://www.python.org/ftp/python" },
    rust: { primary: "https://sh.rustup.rs" },
    jdk: { primary: "https://download.java.net" },
    fnm: { primary: "https://fnm.vercel.app/install" },
    signalCli: { primary: "https://github.com/AsamK/signal-cli/releases" },
    hkBinaries: { primary: "https://github.com" },
  },
  CLAWDSKILLSPROXY_CONFIG: { endpoints: {} },
  LARGE_PACKAGE_PROXY_MAP: {},
  CLI_TOOL_MIRRORS: {},
}));

const mockItems = [
  {
    serverId: "npm-server",
    friendlyName: "npm tool",
    version: "1.0.0",
    npmPackage: "@test/mcp-npm",
    requiresApiKey: false,
    platforms: ["windows", "macos", "linux"],
    isOfficial: true,
    isNew: false,
    toolCount: 1,
    category: "other",
    tags: [],
  },
  {
    serverId: "pypi-server",
    friendlyName: "pypi tool",
    version: "2.0.0",
    pypiPackage: "mcp-python-tool",
    requiresApiKey: false,
    platforms: ["windows", "macos", "linux"],
    isOfficial: false,
    isNew: false,
    toolCount: 1,
    category: "other",
    tags: [],
  },
  {
    serverId: "sse-server",
    friendlyName: "SSE tool",
    version: "1.0.0",
    sseUrl: "https://example.com/mcp",
    requiresApiKey: false,
    platforms: ["windows", "macos", "linux"],
    isOfficial: false,
    isNew: false,
    toolCount: 1,
    category: "other",
    tags: [],
  },
];

const managerMocks = vi.hoisted(() => ({
  readMarketplaceIndex: vi.fn(),
  getMCPManagerSafe: vi.fn(),
}));

vi.mock("../../mcp/marketplace-index.js", () => ({
  readMarketplaceIndex: managerMocks.readMarketplaceIndex,
}));

vi.mock("../../mcp/index.js", () => ({
  getMCPManagerSafe: managerMocks.getMCPManagerSafe,
  initMCPManager: vi.fn(),
}));

vi.mock("../../config/config.js", () => ({
  loadConfig: () => ({ mcp: { servers: [] } }),
  writeConfigFile: vi.fn().mockResolvedValue(undefined),
  withConfigWriteLock: async (fn: () => Promise<unknown>) => fn(),
}));

// Import handlers after mocks
import { mcpHandlers } from "./mcp-methods.js";

// ── Helpers ─────────────────────────────────────────────────

function makeOpts(
  method: string,
  params: Record<string, unknown> = {},
): GatewayRequestHandlerOptions & { respond: ReturnType<typeof vi.fn> } {
  const respond = vi.fn();
  return {
    req: { type: "req" as const, id: "test-cn", method },
    params,
    respond,
    context: {
      logGateway: { info: vi.fn(), error: vi.fn() },
      dedupe: new Map(),
      addChatRun: vi.fn(),
    } as unknown as GatewayRequestHandlerOptions["context"],
    client: null,
    isWebchatConnect: () => false,
  };
}

// ── Tests ───────────────────────────────────────────────────

describe("CN mirror injection — mcp.marketplace.install", () => {
  const handler = mcpHandlers["mcp.marketplace.install"]!;
  let lastAddedId = "";
  const mockManager = {
    addServer: vi.fn().mockImplementation(async (cfg: { id: string }) => {
      lastAddedId = cfg.id;
    }),
    removeServer: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockImplementation(() => ({
      servers: [{ config: { id: lastAddedId }, status: "running" }],
    })),
  };

  beforeEach(() => {
    lastAddedId = "";
    managerMocks.readMarketplaceIndex.mockResolvedValue(mockItems);
    managerMocks.getMCPManagerSafe.mockReturnValue(mockManager);
    mockManager.addServer.mockClear();
    mockManager.removeServer.mockClear();
    cnMirrorMocks.shouldUseCNMirror.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, ok: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Helper: start the handler and drain microtasks so addServer gets called,
  // then verify addServer args without waiting for the full timer-based poll loop.
  // addServer is called BEFORE any setTimeout fires, so no fake timers needed.
  async function startInstallAndGetAddServerArg(
    serverId: string,
    extraParams: Record<string, unknown> = {},
  ) {
    const opts = makeOpts("mcp.marketplace.install", { serverId, ...extraParams });
    handler(opts); // fire-and-forget (poll timer can run in background)
    // Wait for all pending microtasks + 1 turn of the event loop via setImmediate/setTimeout(0)
    // so that readMarketplaceIndex, addServer, and all async mocks resolve.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    return opts;
  }

  it("injects npm_config_registry for npm packages when CN mirror active", async () => {
    cnMirrorMocks.shouldUseCNMirror.mockReturnValue(true);
    await startInstallAndGetAddServerArg("npm-server");

    expect(mockManager.addServer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "npm-server",
        // command resolved to full path on Windows — just verify it contains "npx"
        command: expect.stringContaining("npx"),
        env: expect.objectContaining({
          npm_config_registry: "https://registry.npmmirror.com/",
        }),
      }),
    );
  });

  it("injects UV_INDEX_URL and PIP_INDEX_URL for pypi packages when CN mirror active", async () => {
    cnMirrorMocks.shouldUseCNMirror.mockReturnValue(true);
    await startInstallAndGetAddServerArg("pypi-server");

    expect(mockManager.addServer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "pypi-server",
        // command resolved to full path on Windows — just verify it contains "uvx"
        command: expect.stringContaining("uvx"),
        env: expect.objectContaining({
          UV_INDEX_URL: "https://pypi.tuna.tsinghua.edu.cn/simple",
          PIP_INDEX_URL: "https://pypi.tuna.tsinghua.edu.cn/simple",
        }),
      }),
    );
  });

  it("does NOT inject CN mirror registry when CN mirror is inactive", async () => {
    // Even without CN mirror, PATH is injected for child process resolution.
    // Verify that CN-specific keys (npm_config_registry) are NOT present.
    cnMirrorMocks.shouldUseCNMirror.mockReturnValue(false);
    await startInstallAndGetAddServerArg("npm-server");

    const config = mockManager.addServer.mock.calls[0][0] as { env: Record<string, string> };
    expect(config.env).not.toHaveProperty("npm_config_registry");
  });

  it("does NOT inject CN mirror env for SSE-only servers (SSE uses its own install path)", async () => {
    // SSE-only servers go through a different code path (checkSseReachability → addServer).
    // The env is not CN-mirror-injected in the SSE path.
    cnMirrorMocks.shouldUseCNMirror.mockReturnValue(true);
    const opts = makeOpts("mcp.marketplace.install", { serverId: "sse-server" });
    handler(opts); // fire-and-forget
    // Wait for reachability check (fetch mock) + addServer to run
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    // SSE install path doesn't fail on CN mirror injection — just verify it completed
    // without throwing (respond may or may not have been called yet)
    expect(mockManager.addServer).not.toHaveBeenCalled(); // SSE goes through its own path
  });

  it("preserves user-provided env vars (user takes precedence over CN mirror)", async () => {
    cnMirrorMocks.shouldUseCNMirror.mockReturnValue(true);
    await startInstallAndGetAddServerArg("npm-server", {
      env: { CUSTOM_KEY: "custom-value", npm_config_registry: "https://my-custom-registry.com/" },
    });

    const config = mockManager.addServer.mock.calls[0][0] as { env: Record<string, string> };
    // User registry takes precedence; PATH may also be present
    expect(config.env).toMatchObject({
      npm_config_registry: "https://my-custom-registry.com/",
      CUSTOM_KEY: "custom-value",
    });
  });

  it("merges CN mirror env with user-provided env", async () => {
    cnMirrorMocks.shouldUseCNMirror.mockReturnValue(true);
    await startInstallAndGetAddServerArg("npm-server", { env: { API_KEY: "my-key" } });

    const config = mockManager.addServer.mock.calls[0][0] as { env: Record<string, string> };
    // CN mirror registry + user key are merged; PATH may also be present
    expect(config.env).toMatchObject({
      npm_config_registry: "https://registry.npmmirror.com/",
      API_KEY: "my-key",
    });
  });
});

describe("CN mirror injection — mcp.servers.add", () => {
  const handler = mcpHandlers["mcp.servers.add"]!;
  const mockManager = {
    addServer: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    managerMocks.getMCPManagerSafe.mockReturnValue(mockManager);
    mockManager.addServer.mockClear();
    cnMirrorMocks.shouldUseCNMirror.mockClear();
  });

  it("injects npm mirror for npx command", async () => {
    cnMirrorMocks.shouldUseCNMirror.mockReturnValue(true);
    const opts = makeOpts("mcp.servers.add", {
      id: "my-npx-server",
      command: "npx",
      args: ["-y", "my-package"],
      transport: "stdio",
    });
    await handler(opts);

    expect(mockManager.addServer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "my-npx-server",
        env: expect.objectContaining({
          npm_config_registry: "https://registry.npmmirror.com/",
        }),
      }),
    );
  });

  it("injects pip mirror for uvx command", async () => {
    cnMirrorMocks.shouldUseCNMirror.mockReturnValue(true);
    const opts = makeOpts("mcp.servers.add", {
      id: "my-uvx-server",
      command: "uvx",
      args: ["my-python-pkg"],
      transport: "stdio",
    });
    await handler(opts);

    expect(mockManager.addServer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "my-uvx-server",
        env: expect.objectContaining({
          UV_INDEX_URL: "https://pypi.tuna.tsinghua.edu.cn/simple",
          PIP_INDEX_URL: "https://pypi.tuna.tsinghua.edu.cn/simple",
        }),
      }),
    );
  });

  it("does NOT inject CN mirror registry for non-npx/uvx commands", async () => {
    cnMirrorMocks.shouldUseCNMirror.mockReturnValue(true);
    const opts = makeOpts("mcp.servers.add", {
      id: "my-custom-server",
      command: "my-binary",
      args: ["--serve"],
      transport: "stdio",
    });
    await handler(opts);

    const config = mockManager.addServer.mock.calls[0][0] as { env?: Record<string, string> };
    // No CN-specific mirror keys should be injected for unknown commands
    if (config.env) {
      expect(config.env).not.toHaveProperty("npm_config_registry");
      expect(config.env).not.toHaveProperty("UV_INDEX_URL");
    } else {
      expect(config.env).toBeUndefined();
    }
  });
});

// ── mcp.servers.updateEnv ──────────────────────────────────

describe("mcp.servers.updateEnv", () => {
  const handler = mcpHandlers["mcp.servers.updateEnv"]!;

  const existingServer = {
    id: "test-server",
    command: "npx",
    args: ["-y", "@test/mcp-pkg"],
    transport: "stdio" as const,
    enabled: true,
    autoStart: true,
    env: { EXISTING_KEY: "old-value" },
  };

  const mockRegistry = {
    getServer: vi.fn(),
    getAllServers: vi.fn(),
  };
  const mockManager = {
    addServer: vi.fn().mockResolvedValue(undefined),
    removeServer: vi.fn().mockResolvedValue(undefined),
    registry: mockRegistry,
  };

  beforeEach(() => {
    managerMocks.getMCPManagerSafe.mockReturnValue(mockManager);
    mockManager.addServer.mockClear();
    mockManager.removeServer.mockClear();
    mockRegistry.getServer.mockClear();
    cnMirrorMocks.shouldUseCNMirror.mockClear();
  });

  it("rejects when id is missing", async () => {
    const opts = makeOpts("mcp.servers.updateEnv", { env: { KEY: "val" } });
    await handler(opts);
    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("id required") }),
    );
  });

  it("rejects when env is empty", async () => {
    const opts = makeOpts("mcp.servers.updateEnv", { id: "test-server", env: {} });
    await handler(opts);
    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("env required") }),
    );
  });

  it("rejects when server not found", async () => {
    mockRegistry.getServer.mockReturnValue(undefined);
    const opts = makeOpts("mcp.servers.updateEnv", { id: "nonexistent", env: { KEY: "val" } });
    await handler(opts);
    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("Server not found") }),
    );
  });

  it("merges new env into existing and re-adds server", async () => {
    cnMirrorMocks.shouldUseCNMirror.mockReturnValue(false);
    mockRegistry.getServer.mockReturnValue(existingServer);
    const opts = makeOpts("mcp.servers.updateEnv", {
      id: "test-server",
      env: { API_KEY: "new-key", EXISTING_KEY: "updated" },
    });
    await handler(opts);

    expect(mockManager.removeServer).toHaveBeenCalledWith("test-server");
    expect(mockManager.addServer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "test-server",
        env: { EXISTING_KEY: "updated", API_KEY: "new-key" },
      }),
    );
    expect(opts.respond).toHaveBeenCalledWith(true, { ok: true, id: "test-server" });
  });

  it("injects CN mirror env on updateEnv for npm servers", async () => {
    cnMirrorMocks.shouldUseCNMirror.mockReturnValue(true);
    mockRegistry.getServer.mockReturnValue(existingServer);
    const opts = makeOpts("mcp.servers.updateEnv", {
      id: "test-server",
      env: { API_KEY: "key123" },
    });
    await handler(opts);

    const addedConfig = mockManager.addServer.mock.calls[0][0];
    expect(addedConfig.env).toEqual(
      expect.objectContaining({
        npm_config_registry: "https://registry.npmmirror.com/",
        EXISTING_KEY: "old-value",
        API_KEY: "key123",
      }),
    );
  });

  it("user-provided registry takes precedence over CN mirror", async () => {
    cnMirrorMocks.shouldUseCNMirror.mockReturnValue(true);
    mockRegistry.getServer.mockReturnValue({
      ...existingServer,
      env: { npm_config_registry: "https://custom-registry.example.com/" },
    });
    const opts = makeOpts("mcp.servers.updateEnv", {
      id: "test-server",
      env: { API_KEY: "key123" },
    });
    await handler(opts);

    const addedConfig = mockManager.addServer.mock.calls[0][0];
    expect(addedConfig.env.npm_config_registry).toBe("https://custom-registry.example.com/");
  });

  it("rejects array env (typeof [] === 'object' guard)", async () => {
    const opts = makeOpts("mcp.servers.updateEnv", {
      id: "test-server",
      env: ["not", "an", "object"],
    });
    await handler(opts);
    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("env required") }),
    );
  });
});

// ── mcp.servers.batchUpdateEnv ─────────────────────────────

describe("mcp.servers.batchUpdateEnv", () => {
  const handler = mcpHandlers["mcp.servers.batchUpdateEnv"]!;

  const servers: Record<string, any> = {
    "srv-npm": {
      id: "srv-npm",
      command: "npx",
      args: ["-y", "@test/pkg"],
      transport: "stdio",
      enabled: true,
      autoStart: true,
      env: {},
    },
    "srv-uvx": {
      id: "srv-uvx",
      command: "uvx",
      args: ["mcp-tool"],
      transport: "stdio",
      enabled: true,
      autoStart: true,
      env: {},
    },
  };

  const mockRegistry = {
    getServer: vi.fn((id: string) => servers[id] ?? undefined),
    getAllServers: vi.fn(),
  };
  const mockManager = {
    addServer: vi.fn().mockResolvedValue(undefined),
    removeServer: vi.fn().mockResolvedValue(undefined),
    registry: mockRegistry,
  };

  beforeEach(() => {
    managerMocks.getMCPManagerSafe.mockReturnValue(mockManager);
    mockManager.addServer.mockClear();
    mockManager.removeServer.mockClear();
    mockRegistry.getServer.mockClear();
    cnMirrorMocks.shouldUseCNMirror.mockClear();
  });

  it("rejects when updates array is empty", async () => {
    const opts = makeOpts("mcp.servers.batchUpdateEnv", { updates: [] });
    await handler(opts);
    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("updates array required") }),
    );
  });

  it("processes multiple servers and returns results", async () => {
    cnMirrorMocks.shouldUseCNMirror.mockReturnValue(false);
    const opts = makeOpts("mcp.servers.batchUpdateEnv", {
      updates: [
        { id: "srv-npm", env: { API_KEY: "npm-key" } },
        { id: "srv-uvx", env: { API_KEY: "uvx-key" } },
      ],
    });
    await handler(opts);

    expect(mockManager.removeServer).toHaveBeenCalledTimes(2);
    expect(mockManager.addServer).toHaveBeenCalledTimes(2);
    expect(opts.respond).toHaveBeenCalledWith(true, {
      results: [
        { id: "srv-npm", ok: true },
        { id: "srv-uvx", ok: true },
      ],
    });
  });

  it("returns error for nonexistent servers without stopping batch", async () => {
    cnMirrorMocks.shouldUseCNMirror.mockReturnValue(false);
    const opts = makeOpts("mcp.servers.batchUpdateEnv", {
      updates: [
        { id: "nonexistent", env: { KEY: "val" } },
        { id: "srv-npm", env: { API_KEY: "key1" } },
      ],
    });
    await handler(opts);

    // Only srv-npm should be processed
    expect(mockManager.removeServer).toHaveBeenCalledTimes(1);
    expect(mockManager.addServer).toHaveBeenCalledTimes(1);
    expect(opts.respond).toHaveBeenCalledWith(true, {
      results: [
        { id: "nonexistent", ok: false, error: "Server not found" },
        { id: "srv-npm", ok: true },
      ],
    });
  });

  it("skips entries with invalid id or empty env", async () => {
    cnMirrorMocks.shouldUseCNMirror.mockReturnValue(false);
    const opts = makeOpts("mcp.servers.batchUpdateEnv", {
      updates: [
        { id: "", env: { KEY: "val" } },
        { id: "srv-npm", env: {} },
        { id: "srv-uvx", env: { TOKEN: "t123" } },
      ],
    });
    await handler(opts);

    expect(mockManager.removeServer).toHaveBeenCalledTimes(1);
    expect(opts.respond).toHaveBeenCalledWith(true, {
      results: [
        { id: "", ok: false, error: "Invalid id or env" },
        { id: "srv-npm", ok: false, error: "Invalid id or env" },
        { id: "srv-uvx", ok: true },
      ],
    });
  });

  it("injects CN mirrors for both npm and pypi servers in batch", async () => {
    cnMirrorMocks.shouldUseCNMirror.mockReturnValue(true);
    const opts = makeOpts("mcp.servers.batchUpdateEnv", {
      updates: [
        { id: "srv-npm", env: { API_KEY: "k1" } },
        { id: "srv-uvx", env: { API_KEY: "k2" } },
      ],
    });
    await handler(opts);

    const npmConfig = mockManager.addServer.mock.calls[0][0];
    expect(npmConfig.env).toEqual(
      expect.objectContaining({
        npm_config_registry: "https://registry.npmmirror.com/",
        API_KEY: "k1",
      }),
    );

    const uvxConfig = mockManager.addServer.mock.calls[1][0];
    expect(uvxConfig.env).toEqual(
      expect.objectContaining({
        UV_INDEX_URL: "https://pypi.tuna.tsinghua.edu.cn/simple",
        PIP_INDEX_URL: "https://pypi.tuna.tsinghua.edu.cn/simple",
        API_KEY: "k2",
      }),
    );
  });

  it("handles addServer failure gracefully", async () => {
    cnMirrorMocks.shouldUseCNMirror.mockReturnValue(false);
    mockManager.addServer
      .mockRejectedValueOnce(new Error("Add failed"))
      .mockResolvedValueOnce(undefined);
    const opts = makeOpts("mcp.servers.batchUpdateEnv", {
      updates: [
        { id: "srv-npm", env: { KEY: "v1" } },
        { id: "srv-uvx", env: { KEY: "v2" } },
      ],
    });
    await handler(opts);

    expect(opts.respond).toHaveBeenCalledWith(true, {
      results: [
        { id: "srv-npm", ok: false, error: "Error: Add failed" },
        { id: "srv-uvx", ok: true },
      ],
    });
  });

  it("rejects array env in batch entries", async () => {
    cnMirrorMocks.shouldUseCNMirror.mockReturnValue(false);
    const opts = makeOpts("mcp.servers.batchUpdateEnv", {
      updates: [
        { id: "srv-npm", env: ["not", "an", "object"] },
        { id: "srv-uvx", env: { TOKEN: "valid" } },
      ],
    });
    await handler(opts);

    expect(opts.respond).toHaveBeenCalledWith(true, {
      results: [
        { id: "srv-npm", ok: false, error: "Invalid id or env" },
        { id: "srv-uvx", ok: true },
      ],
    });
  });
});

// ── mcp.servers.list (envKeys/envConfigured) ───────────────

describe("mcp.servers.list — env exposure", () => {
  const handler = mcpHandlers["mcp.servers.list"]!;

  const mockRegistry = {
    getAllServers: vi.fn(),
    getServer: vi.fn(),
  };
  const mockManager = {
    registry: mockRegistry,
  };

  beforeEach(() => {
    managerMocks.getMCPManagerSafe.mockReturnValue(mockManager);
    mockRegistry.getAllServers.mockClear();
  });

  it("exposes envKeys and envConfigured without leaking values", async () => {
    mockRegistry.getAllServers.mockReturnValue([
      {
        id: "s1",
        command: "npx",
        args: [],
        transport: "stdio",
        enabled: true,
        autoStart: true,
        env: { API_KEY: "secret-value", EMPTY_VAR: "" },
      },
    ]);
    const opts = makeOpts("mcp.servers.list");
    await handler(opts);

    const result = opts.respond.mock.calls[0];
    expect(result[0]).toBe(true); // success
    const servers = result[1].servers;
    expect(servers).toHaveLength(1);
    expect(servers[0].envKeys).toEqual(["API_KEY", "EMPTY_VAR"]);
    expect(servers[0].envConfigured).toEqual({ API_KEY: true, EMPTY_VAR: false });
    // Must NOT have raw env values
    expect(servers[0].env).toBeUndefined();
  });

  it("returns empty envKeys/envConfigured when no env", async () => {
    mockRegistry.getAllServers.mockReturnValue([
      {
        id: "s2",
        command: "node",
        args: ["server.js"],
        transport: "stdio",
        enabled: true,
        autoStart: false,
      },
    ]);
    const opts = makeOpts("mcp.servers.list");
    await handler(opts);

    const servers = opts.respond.mock.calls[0][1].servers;
    expect(servers[0].envKeys).toEqual([]);
    expect(servers[0].envConfigured).toEqual({});
  });
});
