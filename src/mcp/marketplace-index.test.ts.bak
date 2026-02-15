/**
 * marketplace-index.test.ts
 * Tests for the MCP marketplace index reader: parsing, caching, TTL, edge cases.
 *
 * Strategy: mock node:fs and node:fs/promises to fully control file existence
 * and content, avoiding interference from the real bundled data/mcp-index.json.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock fs at the top (hoisted) ────────────────────────────

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
}));

vi.mock("node:fs/promises", () => ({
  readFile: mocks.readFile,
}));

import { readMarketplaceIndex, invalidateMarketplaceCache } from "./marketplace-index.js";

// ── Tests ───────────────────────────────────────────────────

describe("marketplace-index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateMarketplaceCache();
  });

  // ── readMarketplaceIndex ────────────────────────────────

  describe("readMarketplaceIndex", () => {
    it("returns empty array when no index file exists", async () => {
      mocks.existsSync.mockReturnValue(false);
      const items = await readMarketplaceIndex();
      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(0);
    });

    it("reads a flat array JSON index", async () => {
      const data = [
        { serverId: "test-1", friendlyName: "Test One" },
        { serverId: "test-2", friendlyName: "Test Two" },
      ];
      mocks.existsSync.mockReturnValue(true);
      mocks.readFile.mockResolvedValue(JSON.stringify(data));

      const items = await readMarketplaceIndex();
      expect(items).toHaveLength(2);
      expect(items[0].serverId).toBe("test-1");
      expect(items[1].friendlyName).toBe("Test Two");
    });

    it("reads an {items: [...]} wrapper JSON index", async () => {
      const data = { items: [{ serverId: "wrapped-1" }], version: 2 };
      mocks.existsSync.mockReturnValue(true);
      mocks.readFile.mockResolvedValue(JSON.stringify(data));

      const items = await readMarketplaceIndex();
      expect(items).toHaveLength(1);
      expect(items[0].serverId).toBe("wrapped-1");
    });

    it("handles non-array non-items JSON gracefully", async () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.readFile.mockResolvedValue(JSON.stringify({ version: 1 }));

      const items = await readMarketplaceIndex();
      // Not an array and no .items property → empty
      expect(items).toHaveLength(0);
    });

    it("skips corrupted JSON and tries next candidate", async () => {
      // First candidate exists but has invalid JSON
      let callCount = 0;
      mocks.existsSync.mockImplementation(() => {
        callCount++;
        return callCount === 1; // only first candidate exists
      });
      mocks.readFile.mockRejectedValue(new Error("parse error"));

      const items = await readMarketplaceIndex();
      expect(items).toHaveLength(0);
    });

    it("returns data from first valid candidate found", async () => {
      // First candidate doesn't exist, second does
      let callCount = 0;
      mocks.existsSync.mockImplementation(() => {
        callCount++;
        return callCount === 2; // second candidate exists
      });
      mocks.readFile.mockResolvedValue(JSON.stringify([{ serverId: "from-second" }]));

      const items = await readMarketplaceIndex();
      expect(items).toHaveLength(1);
      expect(items[0].serverId).toBe("from-second");
    });
  });

  // ── cache behaviour ─────────────────────────────────────

  describe("cache", () => {
    it("returns cached result on second call within TTL", async () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.readFile.mockResolvedValue(JSON.stringify([{ serverId: "cached-1" }]));

      const first = await readMarketplaceIndex();
      expect(first).toHaveLength(1);

      // readFile should be called only once — second call uses cache
      mocks.readFile.mockClear();
      const second = await readMarketplaceIndex();
      expect(second).toHaveLength(1);
      expect(second[0].serverId).toBe("cached-1");
      expect(mocks.readFile).not.toHaveBeenCalled();
    });

    it("invalidateMarketplaceCache forces re-read", async () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.readFile.mockResolvedValue(JSON.stringify([{ serverId: "v1" }]));

      const first = await readMarketplaceIndex();
      expect(first[0].serverId).toBe("v1");

      // Invalidate and change data
      invalidateMarketplaceCache();
      mocks.readFile.mockResolvedValue(JSON.stringify([{ serverId: "v2" }]));

      const second = await readMarketplaceIndex();
      expect(second[0].serverId).toBe("v2");
    });

    it("cache stores empty array too (avoids repeated disk reads)", async () => {
      mocks.existsSync.mockReturnValue(false);

      const first = await readMarketplaceIndex();
      expect(first).toHaveLength(0);

      // Second call should not check fs again
      mocks.existsSync.mockClear();
      const second = await readMarketplaceIndex();
      expect(second).toHaveLength(0);
      expect(mocks.existsSync).not.toHaveBeenCalled();
    });
  });

  // ── edge cases ──────────────────────────────────────────

  describe("edge cases", () => {
    it("handles empty file gracefully", async () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.readFile.mockResolvedValue("");

      // Empty string → JSON.parse throws → catches and continues
      const items = await readMarketplaceIndex();
      expect(items).toHaveLength(0);
    });

    it("handles large item arrays", async () => {
      const largeArray = Array.from({ length: 500 }, (_, i) => ({
        serverId: `server-${i}`,
        friendlyName: `Server ${i}`,
      }));
      mocks.existsSync.mockReturnValue(true);
      mocks.readFile.mockResolvedValue(JSON.stringify(largeArray));

      const items = await readMarketplaceIndex();
      expect(items).toHaveLength(500);
    });

    it("preserves all fields from the JSON", async () => {
      const item = {
        serverId: "test",
        friendlyName: "测试",
        category: "ai",
        tags: ["a", "b"],
        extra: "should be preserved",
      };
      mocks.existsSync.mockReturnValue(true);
      mocks.readFile.mockResolvedValue(JSON.stringify([item]));

      const items = await readMarketplaceIndex();
      expect(items[0]).toEqual(item);
    });
  });
});
