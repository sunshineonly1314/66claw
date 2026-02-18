/**
 * marketplace-sync.test.ts
 * Tests for the four-tier MCP marketplace index sync.
 *
 * Strategy: mock Tier 0 (Cloud Index), Tier 1 (ModelScope),
 * Tier 2 (Official Registry), Tier 3 (fetch for ClawdSkillsProxy),
 * plus fs for disk writes.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ── Mock fs at the top (hoisted) ────────────────────────────
const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  fetchFromCloudIndex: vi.fn(),
  fetchFromModelScope: vi.fn(),
  fetchFromOfficialRegistry: vi.fn(),
  readMarketplaceIndex: vi.fn(),
  invalidateMarketplaceCache: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    default: { ...actual, existsSync: mocks.existsSync },
    existsSync: mocks.existsSync,
  };
});

vi.mock("node:fs/promises", () => ({
  readFile: mocks.readFile,
  writeFile: mocks.writeFile,
  mkdir: mocks.mkdir,
}));

// Mock the marketplace index reader (used by staleness check inside doSync)
vi.mock("./marketplace-index.js", () => ({
  readMarketplaceIndex: mocks.readMarketplaceIndex,
  invalidateMarketplaceCache: mocks.invalidateMarketplaceCache,
}));

// Mock Tier 0 (Cloud Index), Tier 1 (ModelScope), and Tier 2 (Official Registry)
vi.mock("./marketplace/cloud-index-source.js", () => ({
  fetchFromCloudIndex: mocks.fetchFromCloudIndex,
}));

vi.mock("./marketplace/modelscope-source.js", () => ({
  fetchFromModelScope: mocks.fetchFromModelScope,
}));

vi.mock("./marketplace/registry-source.js", () => ({
  fetchFromOfficialRegistry: mocks.fetchFromOfficialRegistry,
}));

// Mock fetch globally (used by Tier 3: ClawdSkillsProxy)
// Must use globalThis assignment to ensure the same reference
// is used inside already-imported modules.
const mockFetch = vi.fn();
const _originalFetch = globalThis.fetch;
globalThis.fetch = mockFetch as unknown as typeof fetch;

import { syncMcpIndex, syncMcpIndexBackground } from "./marketplace-sync.js";

// ── Helpers ─────────────────────────────────────────────────

function makeProxyResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

// ── Tests ───────────────────────────────────────────────────

describe("marketplace-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: staleness check returns empty (triggers sync)
    mocks.readMarketplaceIndex.mockResolvedValue([]);
    // Default: no existing index file found
    mocks.existsSync.mockReturnValue(false);
    mocks.readFile.mockRejectedValue(new Error("ENOENT"));
    mocks.writeFile.mockResolvedValue(undefined);
    mocks.mkdir.mockResolvedValue(undefined);
    // Default: all tiers return empty (simulate no config / network fail)
    mocks.fetchFromCloudIndex.mockResolvedValue([]);
    mocks.fetchFromModelScope.mockResolvedValue([]);
    mocks.fetchFromOfficialRegistry.mockResolvedValue([]);
  });

  // ── Four-tier cascade ─────────────────────────────────────

  describe("four-tier cascade", () => {
    it("uses Tier 0 (Cloud Index) when available", async () => {
      const items = [{ serverId: "cloud-1", friendlyName: "Cloud Server", source: "cloud-index" }];
      mocks.fetchFromCloudIndex.mockResolvedValue(items);

      const result = await syncMcpIndex({ force: true });

      expect(result.ok).toBe(true);
      expect(result.synced).toBe(true);
      expect(result.itemCount).toBe(1);
      expect(result.source).toBe("cloud-index");
      // Tier 1, 2, 3 should not be called
      expect(mocks.fetchFromModelScope).not.toHaveBeenCalled();
      expect(mocks.fetchFromOfficialRegistry).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("falls back to Tier 1 when Tier 0 returns empty", async () => {
      mocks.fetchFromCloudIndex.mockResolvedValue([]);
      const items = [{ serverId: "ms-1", friendlyName: "ModelScope Server", source: "modelscope" }];
      mocks.fetchFromModelScope.mockResolvedValue(items);

      const result = await syncMcpIndex({ force: true });

      expect(result.ok).toBe(true);
      expect(result.source).toBe("modelscope");
      expect(mocks.fetchFromCloudIndex).toHaveBeenCalledOnce();
      expect(mocks.fetchFromModelScope).toHaveBeenCalledOnce();
    });

    it("falls back to Tier 1 when Tier 0 fails", async () => {
      mocks.fetchFromCloudIndex.mockRejectedValue(new Error("network error"));
      const items = [{ serverId: "ms-1", friendlyName: "ModelScope Server", source: "modelscope" }];
      mocks.fetchFromModelScope.mockResolvedValue(items);

      const result = await syncMcpIndex({ force: true });

      expect(result.ok).toBe(true);
      expect(result.source).toBe("modelscope");
    });

    it("uses Tier 1 (ModelScope) when available", async () => {
      const items = [{ serverId: "ms-1", friendlyName: "ModelScope Server", source: "modelscope" }];
      mocks.fetchFromModelScope.mockResolvedValue(items);

      const result = await syncMcpIndex({ force: true });

      expect(result.ok).toBe(true);
      expect(result.synced).toBe(true);
      expect(result.itemCount).toBe(1);
      expect(result.source).toBe("modelscope");
      // Tier 2 and Tier 3 should not be called
      expect(mocks.fetchFromOfficialRegistry).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("falls back to Tier 2 (Official Registry) when Tier 1 fails", async () => {
      mocks.fetchFromModelScope.mockRejectedValue(new Error("no token"));
      const items = [
        { serverId: "reg-1", friendlyName: "Registry Server", source: "official-registry" },
      ];
      mocks.fetchFromOfficialRegistry.mockResolvedValue(items);

      const result = await syncMcpIndex({ force: true });

      expect(result.ok).toBe(true);
      expect(result.synced).toBe(true);
      expect(result.itemCount).toBe(1);
      expect(result.source).toBe("official-registry");
      // Tier 3 should not be called
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("falls back to Tier 3 (ClawdSkillsProxy) when Tier 1 and 2 both fail", async () => {
      // Set proxy env vars so getProxyConfig() returns config
      process.env.OPENCLAWCN_SKILLS_PROXY_URL = "https://proxy.test/api";
      process.env.OPENCLAWCN_SKILLS_PROXY_TOKEN = "test-token-secure-123";
      mocks.fetchFromModelScope.mockRejectedValue(new Error("no token"));
      mocks.fetchFromOfficialRegistry.mockRejectedValue(new Error("network error"));
      const proxyItems = [{ serverId: "proxy-1", friendlyName: "Proxy Server" }];
      mockFetch.mockResolvedValue(makeProxyResponse(proxyItems));

      const result = await syncMcpIndex({ force: true });

      expect(result.ok).toBe(true);
      expect(result.synced).toBe(true);
      expect(result.itemCount).toBe(1);
      expect(result.source).toBe("clawdskillsproxy");
      expect(mockFetch).toHaveBeenCalledOnce();
      delete process.env.OPENCLAWCN_SKILLS_PROXY_URL;
      delete process.env.OPENCLAWCN_SKILLS_PROXY_TOKEN;
    });

    it("returns synced=false when all tiers fail", async () => {
      mocks.fetchFromModelScope.mockRejectedValue(new Error("no token"));
      mocks.fetchFromOfficialRegistry.mockRejectedValue(new Error("network error"));
      mockFetch.mockResolvedValue(makeProxyResponse([]));

      const result = await syncMcpIndex({ force: true });

      expect(result.ok).toBe(true);
      expect(result.synced).toBe(false);
    });
  });

  // ── Tier 3 Proxy details ──────────────────────────────────

  describe("Tier 3 (ClawdSkillsProxy)", () => {
    // All tests here let Tier 1/2 return [] so Tier 3 is reached.
    // Proxy env vars must be set for getProxyConfig() to return config.
    beforeEach(() => {
      process.env.OPENCLAWCN_SKILLS_PROXY_URL = "https://proxy.test/api";
      process.env.OPENCLAWCN_SKILLS_PROXY_TOKEN = "test-token-secure-123";
    });
    afterEach(() => {
      delete process.env.OPENCLAWCN_SKILLS_PROXY_URL;
      delete process.env.OPENCLAWCN_SKILLS_PROXY_TOKEN;
    });

    it("handles {items: [...]} wrapper from proxy", async () => {
      const data = { items: [{ serverId: "test-1" }] };
      mockFetch.mockResolvedValue(makeProxyResponse(data));

      const result = await syncMcpIndex({ force: true });

      expect(result.ok).toBe(true);
      expect(result.synced).toBe(true);
      expect(result.itemCount).toBe(1);
    });

    it("handles {data: {items: [...]}} nested wrapper", async () => {
      const data = { data: { items: [{ serverId: "nested-1" }] } };
      mockFetch.mockResolvedValue(makeProxyResponse(data));

      const result = await syncMcpIndex({ force: true });

      expect(result.ok).toBe(true);
      expect(result.synced).toBe(true);
      expect(result.itemCount).toBe(1);
    });

    it("sends correct auth headers to proxy", async () => {
      const items = [{ serverId: "test" }];
      mockFetch.mockResolvedValue(makeProxyResponse(items));

      await syncMcpIndex({ force: true });

      expect(mockFetch).toHaveBeenCalledOnce();
      const call = mockFetch.mock.calls[0];
      expect(call[1].headers.Authorization).toMatch(/^Bearer /);
      expect(call[1].headers["User-Agent"]).toContain("OpenClawCN-MCP-Sync");
    });

    it("handles proxy HTTP failure gracefully", async () => {
      mockFetch.mockResolvedValue(makeProxyResponse({}, 500));

      const result = await syncMcpIndex({ force: true });

      // All tiers failed → synced: false, but ok (no items from any source)
      expect(result.ok).toBe(true);
      expect(result.synced).toBe(false);
    });

    it("handles proxy network error gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("network timeout"));

      const result = await syncMcpIndex({ force: true, silent: true });

      expect(result.ok).toBe(true);
      expect(result.synced).toBe(false);
    });
  });

  // ── Disk write ────────────────────────────────────────────

  describe("disk write", () => {
    it("writes index to data directory", async () => {
      const items = [{ serverId: "test", source: "modelscope" }];
      mocks.fetchFromModelScope.mockResolvedValue(items);

      await syncMcpIndex({ force: true });

      expect(mocks.writeFile).toHaveBeenCalledOnce();
    });

    it("creates data directory if needed", async () => {
      const items = [{ serverId: "test", source: "modelscope" }];
      mocks.fetchFromModelScope.mockResolvedValue(items);
      mocks.existsSync.mockReturnValue(false);

      await syncMcpIndex({ force: true });

      expect(mocks.mkdir).toHaveBeenCalled();
    });

    it("handles write failure gracefully (silent)", async () => {
      const items = [{ serverId: "test", source: "modelscope" }];
      mocks.fetchFromModelScope.mockResolvedValue(items);
      mocks.writeFile.mockRejectedValue(new Error("EACCES"));

      const result = await syncMcpIndex({ force: true, silent: true });

      expect(result.ok).toBe(true);
      expect(result.synced).toBe(false);
    });
  });

  // ── Dedup lock ────────────────────────────────────────────

  describe("dedup lock", () => {
    it("deduplicates concurrent non-force syncs", async () => {
      // Use a slow-resolving Tier 1 to test dedup
      let resolveModelScope!: (value: unknown[]) => void;
      mocks.fetchFromModelScope.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveModelScope = resolve;
          }),
      );

      // Start two syncs concurrently
      const p1 = syncMcpIndex({ force: true });
      const p2 = syncMcpIndex(); // non-force should reuse p1

      // Wait for microtasks so doSync proceeds past Tier 0 (Cloud Index)
      // and reaches the Tier 1 fetchFromModelScope() call
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Resolve Tier 1
      resolveModelScope([{ serverId: "test", source: "modelscope" }]);

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      // fetchFromModelScope should only be called once
      expect(mocks.fetchFromModelScope).toHaveBeenCalledOnce();
    });
  });

  // ── syncMcpIndexBackground ────────────────────────────────

  describe("syncMcpIndexBackground", () => {
    it("does not throw on failure", () => {
      mocks.fetchFromModelScope.mockRejectedValue(new Error("crash"));
      mocks.fetchFromOfficialRegistry.mockRejectedValue(new Error("crash"));
      mockFetch.mockRejectedValue(new Error("crash"));

      expect(() => syncMcpIndexBackground({ force: true })).not.toThrow();
    });

    it("calls sync in background", async () => {
      const items = [{ serverId: "bg-test", source: "modelscope" }];
      mocks.fetchFromModelScope.mockResolvedValue(items);

      syncMcpIndexBackground({ force: true });

      // Wait for the background sync to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mocks.fetchFromModelScope).toHaveBeenCalledOnce();
      expect(mocks.writeFile).toHaveBeenCalledOnce();
    });
  });
});
