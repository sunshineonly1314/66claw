/**
 * mcp-methods.marketplace.test.ts
 * Tests for marketplace RPC handlers: list, detail, install, recommend.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { GatewayRequestHandlerOptions } from "./types.js";

// ── Mocks ───────────────────────────────────────────────────

const mockItems = [
  {
    serverId: "filesystem",
    friendlyName: "文件管理",
    friendlyNameEn: "Filesystem",
    description: "读写本地文件",
    descriptionEn: "Read and write local files",
    category: "filesystem",
    tags: ["file", "io"],
    version: "2024.1",
    npmPackage: "@anthropic/mcp-filesystem",
    securityScore: 95,
    requiresApiKey: false,
    platforms: ["windows", "macos", "linux"],
    isOfficial: true,
    isNew: false,
    toolCount: 4,
    installStatus: "not_installed",
  },
  {
    serverId: "brave-search",
    friendlyName: "网页搜索",
    friendlyNameEn: "Web Search",
    description: "搜索网页内容",
    descriptionEn: "Search the web",
    category: "search",
    tags: ["search", "web"],
    version: "1.0.0",
    npmPackage: "@anthropic/mcp-brave-search",
    securityScore: 80,
    requiresApiKey: true,
    apiKeyName: "BRAVE_API_KEY",
    platforms: ["windows", "macos", "linux"],
    isOfficial: true,
    isNew: true,
    toolCount: 2,
    installStatus: "not_installed",
  },
  {
    serverId: "sqlite",
    friendlyName: "数据库",
    friendlyNameEn: "SQLite",
    description: "查询数据库",
    descriptionEn: "Query SQLite databases",
    category: "database",
    tags: ["database", "sql"],
    version: "1.0.0",
    npmPackage: "@anthropic/mcp-sqlite",
    securityScore: 90,
    requiresApiKey: false,
    platforms: ["windows", "macos", "linux"],
    isOfficial: true,
    isNew: false,
    toolCount: 3,
    installStatus: "not_installed",
  },
];

const mocks = vi.hoisted(() => ({
  readMarketplaceIndex: vi.fn(),
  getMCPManagerSafe: vi.fn(),
}));

vi.mock("../../mcp/marketplace-index.js", () => ({
  readMarketplaceIndex: mocks.readMarketplaceIndex,
}));

vi.mock("../../mcp/index.js", () => ({
  getMCPManagerSafe: mocks.getMCPManagerSafe,
  initMCPManager: vi.fn(),
}));

vi.mock("../../config/config.js", () => ({
  loadConfig: () => ({ mcp: {} }),
  writeConfigFile: vi.fn().mockResolvedValue(undefined),
  withConfigWriteLock: async (fn: () => Promise<unknown>) => fn(),
}));

vi.mock("../../config/cn-mirrors.js", () => ({
  shouldUseCNMirror: () => false,
  getNpmMirrorUrl: () => "https://registry.npmmirror.com/",
  getPipMirrorUrl: () => "https://pypi.tuna.tsinghua.edu.cn/simple",
  getNpmMirrors: () => ["https://registry.npmmirror.com/"],
  getPipMirrors: () => ["https://pypi.tuna.tsinghua.edu.cn/simple"],
  recordWorkingMirror: () => {},
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

// Import handlers after mocks
import { mcpHandlers } from "./mcp-methods.js";

// ── Helpers ─────────────────────────────────────────────────

function makeOpts(
  method: string,
  params: Record<string, unknown> = {},
): GatewayRequestHandlerOptions & { respond: ReturnType<typeof vi.fn> } {
  const respond = vi.fn();
  return {
    req: { type: "req" as const, id: "test-1", method },
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

describe("mcp.marketplace.list", () => {
  const handler = mcpHandlers["mcp.marketplace.list"]!;

  beforeEach(() => {
    mocks.readMarketplaceIndex.mockResolvedValue(mockItems);
  });

  it("returns all items when no filters", async () => {
    const opts = makeOpts("mcp.marketplace.list");
    await handler(opts);

    expect(opts.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        items: expect.any(Array),
        total: 3,
      }),
    );
    const result = opts.respond.mock.calls[0][1] as { items: unknown[] };
    expect(result.items).toHaveLength(3);
  });

  it("filters by category", async () => {
    const opts = makeOpts("mcp.marketplace.list", { category: "search" });
    await handler(opts);

    const result = opts.respond.mock.calls[0][1] as {
      items: Array<{ serverId: string }>;
      total: number;
    };
    expect(result.total).toBe(1);
    expect(result.items[0].serverId).toBe("brave-search");
  });

  it("ignores category 'all'", async () => {
    const opts = makeOpts("mcp.marketplace.list", { category: "all" });
    await handler(opts);

    const result = opts.respond.mock.calls[0][1] as { total: number };
    expect(result.total).toBe(3);
  });

  it("filters by search string", async () => {
    const opts = makeOpts("mcp.marketplace.list", { search: "数据" });
    await handler(opts);

    const result = opts.respond.mock.calls[0][1] as {
      items: Array<{ serverId: string }>;
      total: number;
    };
    expect(result.total).toBe(1);
    expect(result.items[0].serverId).toBe("sqlite");
  });

  it("filters by search in tags", async () => {
    const opts = makeOpts("mcp.marketplace.list", { search: "web" });
    await handler(opts);

    const result = opts.respond.mock.calls[0][1] as {
      items: Array<{ serverId: string }>;
      total: number;
    };
    expect(result.total).toBe(1);
    expect(result.items[0].serverId).toBe("brave-search");
  });

  it("combines category + search", async () => {
    const opts = makeOpts("mcp.marketplace.list", { category: "filesystem", search: "文件" });
    await handler(opts);

    const result = opts.respond.mock.calls[0][1] as { total: number };
    expect(result.total).toBe(1);
  });

  it("paginates results", async () => {
    const opts = makeOpts("mcp.marketplace.list", { page: 2, pageSize: 1 });
    await handler(opts);

    const result = opts.respond.mock.calls[0][1] as {
      items: unknown[];
      total: number;
      page: number;
      pageSize: number;
    };
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(3);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(1);
  });

  it("returns empty on index read failure", async () => {
    mocks.readMarketplaceIndex.mockRejectedValue(new Error("file not found"));
    const opts = makeOpts("mcp.marketplace.list");
    await handler(opts);

    expect(opts.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        items: [],
        total: 0,
      }),
    );
  });
});

describe("mcp.marketplace.detail", () => {
  const handler = mcpHandlers["mcp.marketplace.detail"]!;

  beforeEach(() => {
    mocks.readMarketplaceIndex.mockResolvedValue(mockItems);
  });

  it("returns the matching item", async () => {
    const opts = makeOpts("mcp.marketplace.detail", { serverId: "brave-search" });
    await handler(opts);

    expect(opts.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        serverId: "brave-search",
        friendlyName: "网页搜索",
      }),
    );
  });

  it("returns error for missing serverId", async () => {
    const opts = makeOpts("mcp.marketplace.detail", {});
    await handler(opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("serverId required"),
      }),
    );
  });

  it("returns error for non-existent item", async () => {
    const opts = makeOpts("mcp.marketplace.detail", { serverId: "nonexistent" });
    await handler(opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("not found"),
      }),
    );
  });
});

describe("mcp.marketplace.install", () => {
  const handler = mcpHandlers["mcp.marketplace.install"]!;
  // getStatus returns "running" for whichever server was last added
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
    mocks.readMarketplaceIndex.mockResolvedValue(mockItems);
    mocks.getMCPManagerSafe.mockReturnValue(mockManager);
    mockManager.addServer.mockClear();
    mockManager.removeServer.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("installs a server from marketplace index", async () => {
    const opts = makeOpts("mcp.marketplace.install", { serverId: "filesystem", waitMs: 100 });
    const handlerPromise = handler(opts);
    await vi.advanceTimersByTimeAsync(2001);
    await handlerPromise;

    expect(mockManager.addServer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "filesystem",
        // command is resolved to full path by resolveCommandPath, so just check it's a string
        command: expect.stringContaining("npx"),
        args: ["-y", "@anthropic/mcp-filesystem@2024.1"],
        transport: "stdio",
        version: "2024.1",
        enabled: true,
        autoStart: true,
      }),
    );
    expect(opts.respond).toHaveBeenCalledWith(true, expect.objectContaining({ ok: true }));
  });

  it("passes env vars when provided", async () => {
    const opts = makeOpts("mcp.marketplace.install", {
      serverId: "brave-search",
      waitMs: 100,
      env: { BRAVE_API_KEY: "test-key-123" },
    });
    const handlerPromise = handler(opts);
    await vi.advanceTimersByTimeAsync(2001);
    await handlerPromise;

    expect(mockManager.addServer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "brave-search",
        env: expect.objectContaining({ BRAVE_API_KEY: "test-key-123" }),
      }),
    );
  });

  it("returns error for non-existent serverId", async () => {
    const opts = makeOpts("mcp.marketplace.install", { serverId: "nonexistent" });
    await handler(opts);

    expect(mockManager.addServer).not.toHaveBeenCalled();
    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("not found"),
      }),
    );
  });

  it("returns error when MCP manager not initialized", async () => {
    mocks.getMCPManagerSafe.mockReturnValue(null);
    const opts = makeOpts("mcp.marketplace.install", { serverId: "filesystem" });
    await handler(opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("not initialized"),
      }),
    );
  });

  it("returns error when addServer throws", async () => {
    mockManager.addServer.mockRejectedValue(new Error("npm install failed"));
    const opts = makeOpts("mcp.marketplace.install", { serverId: "filesystem" });
    await handler(opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("npm install failed"),
      }),
    );
  });

  it("returns error for missing serverId param", async () => {
    const opts = makeOpts("mcp.marketplace.install", {});
    await handler(opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("serverId required"),
      }),
    );
  });
});

describe("mcp.marketplace.recommend", () => {
  const handler = mcpHandlers["mcp.marketplace.recommend"]!;

  it("returns empty items (stub for Phase 2)", { timeout: 15_000 }, async () => {
    const opts = makeOpts("mcp.marketplace.recommend");
    await handler(opts);

    expect(opts.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        items: [],
      }),
    );
  });
});
