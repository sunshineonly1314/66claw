/**
 * mcp-full-sync.test.ts
 * Tests for the MCP full sync dedup/merge logic.
 *
 * We test the exported deduplicateItems function from marketplace-sync.ts
 * since that is the core logic the sync script depends on.
 */

import { describe, expect, it } from "vitest";
import { deduplicateItems } from "../src/mcp/marketplace-sync.js";
import type { McpMarketplaceItem } from "../src/mcp/marketplace/types.js";

function makeItem(overrides: Partial<McpMarketplaceItem> & { serverId: string }): McpMarketplaceItem {
  return {
    friendlyName: overrides.serverId,
    description: "",
    category: "other",
    tags: [],
    version: "1.0.0",
    requiresApiKey: false,
    platforms: ["linux"],
    isOfficial: false,
    isNew: false,
    toolCount: 0,
    source: "modelscope",
    ...overrides,
  };
}

describe("deduplicateItems (used by mcp-full-sync)", () => {
  it("removes duplicate serverIds (first occurrence wins)", () => {
    const items = [
      makeItem({ serverId: "fs", friendlyName: "Filesystem (ModelScope)", source: "modelscope" }),
      makeItem({ serverId: "fs", friendlyName: "Filesystem (Registry)", source: "official-registry" }),
      makeItem({ serverId: "db", friendlyName: "Database", source: "official-registry" }),
    ];

    const result = deduplicateItems(items);

    expect(result).toHaveLength(2);
    expect(result[0].friendlyName).toBe("Filesystem (ModelScope)");
    expect(result[1].serverId).toBe("db");
  });

  it("preserves order of first occurrences", () => {
    const items = [
      makeItem({ serverId: "c" }),
      makeItem({ serverId: "a" }),
      makeItem({ serverId: "b" }),
      makeItem({ serverId: "a" }), // duplicate
    ];

    const result = deduplicateItems(items);

    expect(result.map((i) => i.serverId)).toEqual(["c", "a", "b"]);
  });

  it("handles empty array", () => {
    expect(deduplicateItems([])).toHaveLength(0);
  });

  it("handles single item", () => {
    const items = [makeItem({ serverId: "only" })];
    expect(deduplicateItems(items)).toHaveLength(1);
  });

  it("ModelScope items win over Registry when placed first in merge", () => {
    // Simulates the sync script merge order: ModelScope first, then Registry
    const msItems = [
      makeItem({
        serverId: "fetch",
        friendlyName: "网页抓取",
        description: "中文描述",
        source: "modelscope",
      }),
    ];
    const regItems = [
      makeItem({
        serverId: "fetch",
        friendlyName: "Web Fetch",
        description: "English desc",
        source: "official-registry",
      }),
    ];

    const merged = [...msItems, ...regItems];
    const result = deduplicateItems(merged);

    expect(result).toHaveLength(1);
    expect(result[0].friendlyName).toBe("网页抓取");
    expect(result[0].source).toBe("modelscope");
  });

  it("handles large datasets efficiently", () => {
    const items = Array.from({ length: 5000 }, (_, i) =>
      makeItem({ serverId: `server-${i}` }),
    );
    // Add 500 duplicates
    for (let i = 0; i < 500; i++) {
      items.push(makeItem({ serverId: `server-${i}`, friendlyName: "duplicate" }));
    }

    const result = deduplicateItems(items);

    expect(result).toHaveLength(5000);
    // First occurrences should win (not "duplicate")
    expect(result[0].friendlyName).toBe("server-0");
  });
});
