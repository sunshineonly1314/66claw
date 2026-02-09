/**
 * marketplace-sync.test.ts
 * Tests for the MCP marketplace index sync from ClawdSkillsProxy.
 *
 * Strategy: mock fetch + fs to fully control network and disk behavior.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock fs at the top (hoisted) ────────────────────────────
const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
}));

vi.mock("node:fs/promises", () => ({
  readFile: mocks.readFile,
  writeFile: mocks.writeFile,
  mkdir: mocks.mkdir,
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { syncMcpIndex, syncMcpIndexBackground } from "./marketplace-sync.js";
import { invalidateMarketplaceCache } from "./marketplace-index.js";

// ── Helpers ─────────────────────────────────────────────────

function makeResponse(body: unknown, status = 200) {
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
    invalidateMarketplaceCache();
    // Default: no existing index file found (triggers sync)
    mocks.existsSync.mockReturnValue(false);
    mocks.readFile.mockRejectedValue(new Error("ENOENT"));
    mocks.writeFile.mockResolvedValue(undefined);
    mocks.mkdir.mockResolvedValue(undefined);
  });

  // ── syncMcpIndex ─────────────────────────────────────────

  describe("syncMcpIndex", () => {
    it("fetches and writes index on force sync", async () => {
      const items = [
        { serverId: "fs", friendlyName: "Filesystem" },
        { serverId: "sql", friendlyName: "SQLite" },
      ];
      mockFetch.mockResolvedValue(makeResponse(items));
      mocks.existsSync.mockReturnValue(false); // dir doesn't exist, will mkdir

      const result = await syncMcpIndex({ force: true });

      expect(result.ok).toBe(true);
      expect(result.synced).toBe(true);
      expect(result.itemCount).toBe(2);
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mocks.writeFile).toHaveBeenCalledOnce();
    });

    it("handles {items: [...]} wrapper from proxy", async () => {
      const data = { items: [{ serverId: "test-1" }] };
      mockFetch.mockResolvedValue(makeResponse(data));

      const result = await syncMcpIndex({ force: true });

      expect(result.ok).toBe(true);
      expect(result.synced).toBe(true);
      expect(result.itemCount).toBe(1);
    });

    it("handles {data: {items: [...]}} nested wrapper", async () => {
      const data = { data: { items: [{ serverId: "nested-1" }] } };
      mockFetch.mockResolvedValue(makeResponse(data));

      const result = await syncMcpIndex({ force: true });

      expect(result.ok).toBe(true);
      expect(result.synced).toBe(true);
      expect(result.itemCount).toBe(1);
    });

    it("skips sync when proxy returns empty index", async () => {
      mockFetch.mockResolvedValue(makeResponse([]));

      const result = await syncMcpIndex({ force: true });

      expect(result.ok).toBe(true);
      expect(result.synced).toBe(false);
      expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    it("returns error on HTTP failure (non-silent)", async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 500));

      const result = await syncMcpIndex({ force: true });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("500");
      expect(result.synced).toBe(false);
    });

    it("returns ok on HTTP failure (silent mode)", async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 500));

      const result = await syncMcpIndex({ force: true, silent: true });

      expect(result.ok).toBe(true);
      expect(result.synced).toBe(false);
      expect(result.error).toContain("500");
    });

    it("handles network error gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("network timeout"));

      const result = await syncMcpIndex({ force: true, silent: true });

      expect(result.ok).toBe(true);
      expect(result.synced).toBe(false);
      expect(result.error).toBe("network timeout");
    });

    it("handles JSON parse error gracefully", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: vi.fn().mockResolvedValue("not json{{{"),
      });

      const result = await syncMcpIndex({ force: true, silent: true });

      expect(result.ok).toBe(true);
      expect(result.synced).toBe(false);
    });

    it("creates data directory if needed", async () => {
      const items = [{ serverId: "test" }];
      mockFetch.mockResolvedValue(makeResponse(items));
      mocks.existsSync.mockReturnValue(false);

      await syncMcpIndex({ force: true });

      expect(mocks.mkdir).toHaveBeenCalled();
    });

    it("handles write failure gracefully", async () => {
      const items = [{ serverId: "test" }];
      mockFetch.mockResolvedValue(makeResponse(items));
      mocks.writeFile.mockRejectedValue(new Error("EACCES"));

      const result = await syncMcpIndex({ force: true, silent: true });

      // Should report failure to write but not crash
      expect(result.ok).toBe(true);
      expect(result.synced).toBe(false);
    });

    it("sends correct auth headers", async () => {
      const items = [{ serverId: "test" }];
      mockFetch.mockResolvedValue(makeResponse(items));

      await syncMcpIndex({ force: true });

      const call = mockFetch.mock.calls[0];
      expect(call[1].headers.Authorization).toMatch(/^Bearer /);
      expect(call[1].headers["User-Agent"]).toContain("Clawdbot-MCP-Sync");
    });
  });

  // ── Dedup lock ────────────────────────────────────────────

  describe("dedup lock", () => {
    it("deduplicates concurrent non-force syncs", async () => {
      const items = [{ serverId: "test" }];
      let resolveFirst!: (value: unknown) => void;
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      );

      // Start two syncs concurrently
      const p1 = syncMcpIndex({ force: true });
      const p2 = syncMcpIndex(); // non-force should reuse p1

      // Resolve the fetch
      resolveFirst(makeResponse(items));

      const [r1, r2] = await Promise.all([p1, p2]);

      // Both should get the same result
      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      // fetch should only be called once
      expect(mockFetch).toHaveBeenCalledOnce();
    });
  });

  // ── syncMcpIndexBackground ────────────────────────────────

  describe("syncMcpIndexBackground", () => {
    it("does not throw on failure", () => {
      mockFetch.mockRejectedValue(new Error("network error"));

      // Should not throw
      expect(() => syncMcpIndexBackground({ force: true })).not.toThrow();
    });

    it("calls syncMcpIndex with silent: true", async () => {
      const items = [{ serverId: "test" }];
      mockFetch.mockResolvedValue(makeResponse(items));

      syncMcpIndexBackground({ force: true });

      // Wait for the background sync to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockFetch).toHaveBeenCalledOnce();
    });
  });
});
