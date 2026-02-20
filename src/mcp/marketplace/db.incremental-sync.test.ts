/**
 * Incremental Sync Tests for ensureMcpBaseline
 *
 * Tests the full lifecycle:
 * 1. First startup → full import
 * 2. Same file → skip (hash match)
 * 3. File changed: new items added → upsert
 * 4. File changed: items removed → delete stale
 * 5. File changed: items updated → upsert overwrites
 * 6. Combined add + update + delete in one sync
 * 7. Edge cases: empty file, missing file, corrupt JSON
 * 8. deleteItemsByIds correctness
 *
 * CN-ONLY FILE
 */

import { describe, it, expect, beforeEach, afterAll, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  getDatabase,
  closeDatabase,
  insertItems,
  getItemById,
  getItemCount,
  isBaselinePopulated,
  ensureMcpBaseline,
  deleteItemsByIds,
  clearAllItems,
  searchItems,
} from "./db.js";
import type { McpMarketplaceItem } from "./types.js";

// ========== Helpers ==========

/** Create a temp directory that simulates a package root with data/mcp-index.json */
function createTempPackageRoot(items: McpMarketplaceItem[]): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-sync-test-"));
  const dataDir = path.join(tmpDir, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, "mcp-index.json"),
    JSON.stringify(items, null, 2),
    "utf-8",
  );
  return tmpDir;
}

/** Update the mcp-index.json in an existing temp package root */
function updateIndexFile(packageRoot: string, items: McpMarketplaceItem[]): void {
  fs.writeFileSync(
    path.join(packageRoot, "data", "mcp-index.json"),
    JSON.stringify(items, null, 2),
    "utf-8",
  );
}

/** Remove the mcp-index.json from a package root */
function removeIndexFile(packageRoot: string): void {
  const indexPath = path.join(packageRoot, "data", "mcp-index.json");
  if (fs.existsSync(indexPath)) fs.unlinkSync(indexPath);
}

/** Clean up a temp directory */
function cleanupTempDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

/** Factory for minimal McpMarketplaceItem */
function makeItem(id: string, overrides: Partial<McpMarketplaceItem> = {}): McpMarketplaceItem {
  return {
    serverId: id,
    friendlyName: `MCP ${id}`,
    description: `Description for ${id}`,
    category: "other",
    tags: [],
    version: "1.0.0",
    requiresApiKey: false,
    platforms: [],
    isOfficial: false,
    isNew: false,
    toolCount: 1,
    source: "cloud-index",
    ...overrides,
  };
}

// ========== Test Setup ==========

const tempDirs: string[] = [];

beforeEach(() => {
  closeDatabase();
  getDatabase(":memory:");
  clearAllItems();
  // Also clear sync_meta
  const db = getDatabase();
  try {
    db.exec("DELETE FROM sync_meta");
  } catch {
    // table might not exist yet in edge cases
  }
});

afterEach(() => {
  // Clean up all temp dirs created during the test
  for (const dir of tempDirs) {
    cleanupTempDir(dir);
  }
  tempDirs.length = 0;
});

afterAll(() => {
  closeDatabase();
});

/** Create temp root and track for cleanup */
function makeTempRoot(items: McpMarketplaceItem[]): string {
  const root = createTempPackageRoot(items);
  tempDirs.push(root);
  return root;
}

// ========== Tests ==========

describe("ensureMcpBaseline — Incremental Sync", () => {
  // ---- 1. First startup: full import ----

  it("should import all items on first startup", () => {
    const items = [makeItem("a"), makeItem("b"), makeItem("c")];
    const root = makeTempRoot(items);

    const result = ensureMcpBaseline(root);

    // 3 items upserted + 0 deleted = 3
    expect(result).toBe(3);
    expect(getItemCount()).toBe(3);
    expect(isBaselinePopulated()).toBe(true);
    expect(getItemById("a")).not.toBeNull();
    expect(getItemById("b")).not.toBeNull();
    expect(getItemById("c")).not.toBeNull();
  });

  // ---- 2. Same file → skip ----

  it("should skip sync when file hash has not changed", () => {
    const items = [makeItem("a"), makeItem("b")];
    const root = makeTempRoot(items);

    // First call: imports
    const first = ensureMcpBaseline(root);
    expect(first).toBe(2);

    // Second call: same file, should skip
    const second = ensureMcpBaseline(root);
    expect(second).toBe(0);

    // Data still intact
    expect(getItemCount()).toBe(2);
  });

  // ---- 3. File changed: new items added ----

  it("should add new items when file has new entries", () => {
    const root = makeTempRoot([makeItem("a"), makeItem("b")]);

    ensureMcpBaseline(root);
    expect(getItemCount()).toBe(2);

    // Update file: add item "c"
    updateIndexFile(root, [makeItem("a"), makeItem("b"), makeItem("c")]);

    const result = ensureMcpBaseline(root);
    expect(result).toBeGreaterThan(0);
    expect(getItemCount()).toBe(3);
    expect(getItemById("c")).not.toBeNull();
  });

  // ---- 4. File changed: items removed ----

  it("should delete stale items when file removes entries", () => {
    const root = makeTempRoot([makeItem("a"), makeItem("b"), makeItem("c")]);

    ensureMcpBaseline(root);
    expect(getItemCount()).toBe(3);

    // Update file: remove item "b"
    updateIndexFile(root, [makeItem("a"), makeItem("c")]);

    const result = ensureMcpBaseline(root);
    expect(result).toBeGreaterThan(0);
    expect(getItemCount()).toBe(2);
    expect(getItemById("a")).not.toBeNull();
    expect(getItemById("b")).toBeNull(); // deleted
    expect(getItemById("c")).not.toBeNull();
  });

  // ---- 5. File changed: items updated ----

  it("should update existing items when metadata changes", () => {
    const root = makeTempRoot([
      makeItem("a", { friendlyName: "Original Name", version: "1.0.0" }),
    ]);

    ensureMcpBaseline(root);
    expect(getItemById("a")?.friendlyName).toBe("Original Name");
    expect(getItemById("a")?.version).toBe("1.0.0");

    // Update file: change metadata for item "a"
    updateIndexFile(root, [
      makeItem("a", { friendlyName: "Updated Name", version: "2.0.0" }),
    ]);

    const result = ensureMcpBaseline(root);
    expect(result).toBeGreaterThan(0);
    expect(getItemCount()).toBe(1);

    const updated = getItemById("a");
    expect(updated?.friendlyName).toBe("Updated Name");
    expect(updated?.version).toBe("2.0.0");
  });

  // ---- 6. Combined: add + update + delete in one sync ----

  it("should handle add + update + delete in a single sync", () => {
    const root = makeTempRoot([
      makeItem("keep", { friendlyName: "Keep Original" }),
      makeItem("update-me", { friendlyName: "Before Update", version: "1.0.0" }),
      makeItem("delete-me", { friendlyName: "To Be Deleted" }),
    ]);

    ensureMcpBaseline(root);
    expect(getItemCount()).toBe(3);

    // Update file:
    //   - "keep" stays the same but gets re-upserted (harmless)
    //   - "update-me" has new metadata
    //   - "delete-me" is removed
    //   - "new-item" is added
    updateIndexFile(root, [
      makeItem("keep", { friendlyName: "Keep Original" }),
      makeItem("update-me", { friendlyName: "After Update", version: "2.0.0" }),
      makeItem("new-item", { friendlyName: "Brand New" }),
    ]);

    const result = ensureMcpBaseline(root);
    expect(result).toBeGreaterThan(0);
    expect(getItemCount()).toBe(3); // keep + update-me + new-item

    expect(getItemById("keep")?.friendlyName).toBe("Keep Original");
    expect(getItemById("update-me")?.friendlyName).toBe("After Update");
    expect(getItemById("update-me")?.version).toBe("2.0.0");
    expect(getItemById("new-item")?.friendlyName).toBe("Brand New");
    expect(getItemById("delete-me")).toBeNull();
  });

  // ---- 7. Edge case: empty file ----

  it("should return 0 for empty JSON array", () => {
    const root = makeTempRoot([]);

    const result = ensureMcpBaseline(root);
    expect(result).toBe(0);
    expect(getItemCount()).toBe(0);
  });

  // ---- 8. Edge case: missing file ----

  it("should return 0 when mcp-index.json does not exist", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-sync-test-empty-"));
    tempDirs.push(tmpDir);

    const result = ensureMcpBaseline(tmpDir);
    expect(result).toBe(0);
    expect(getItemCount()).toBe(0);
  });

  // ---- 9. Edge case: corrupt JSON ----

  it("should return 0 for corrupt JSON file", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-sync-test-corrupt-"));
    tempDirs.push(tmpDir);
    const dataDir = path.join(tmpDir, "data");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, "mcp-index.json"), "{invalid json!!!", "utf-8");

    const result = ensureMcpBaseline(tmpDir);
    expect(result).toBe(0);
    expect(getItemCount()).toBe(0);
  });

  // ---- 10. Idempotency: multiple calls with same data ----

  it("should be idempotent — repeated calls with same data are no-ops", () => {
    const items = [makeItem("x"), makeItem("y")];
    const root = makeTempRoot(items);

    expect(ensureMcpBaseline(root)).toBe(2);
    expect(ensureMcpBaseline(root)).toBe(0);
    expect(ensureMcpBaseline(root)).toBe(0);
    expect(ensureMcpBaseline(root)).toBe(0);

    expect(getItemCount()).toBe(2);
  });

  // ---- 11. Large batch: sync hundreds of items ----

  it("should handle syncing hundreds of items efficiently", () => {
    const items = Array.from({ length: 500 }, (_, i) => makeItem(`item-${i}`));
    const root = makeTempRoot(items);

    const start = Date.now();
    const result = ensureMcpBaseline(root);
    const elapsed = Date.now() - start;

    expect(result).toBe(500);
    expect(getItemCount()).toBe(500);
    // Should complete in under 5 seconds (generous for CI)
    expect(elapsed).toBeLessThan(5000);

    // Second call should be fast (hash match)
    const start2 = Date.now();
    expect(ensureMcpBaseline(root)).toBe(0);
    expect(Date.now() - start2).toBeLessThan(500);
  });

  // ---- 12. Verify FTS5 search index stays in sync after delete ----

  it("should keep FTS5 search index in sync after deleting items", () => {
    const root = makeTempRoot([
      makeItem("searchable", {
        friendlyNameCn: "文件管理器",
        descriptionCn: "一个很好用的文件管理工具",
      }),
      makeItem("will-be-removed", {
        friendlyNameCn: "将被删除的工具",
        descriptionCn: "这个工具马上要被删除",
      }),
    ]);

    ensureMcpBaseline(root);
    expect(getItemCount()).toBe(2);

    // Remove the second item
    updateIndexFile(root, [
      makeItem("searchable", {
        friendlyNameCn: "文件管理器",
        descriptionCn: "一个很好用的文件管理工具",
      }),
    ]);

    ensureMcpBaseline(root);
    expect(getItemCount()).toBe(1);

    // FTS5 search should not return the deleted item
    // (triggers on mcp_items DELETE should have cleaned up mcp_search)
    const db = getDatabase();
    const ftsCount = db
      .prepare("SELECT COUNT(*) as count FROM mcp_search")
      .get() as { count: number };
    expect(ftsCount.count).toBe(1);
  });

  // ---- 13. Hash changes when file content differs even slightly ----

  it("should detect content change even for single-character difference", () => {
    const root = makeTempRoot([makeItem("a", { version: "1.0.0" })]);

    ensureMcpBaseline(root);

    // Tiny change: version bump
    updateIndexFile(root, [makeItem("a", { version: "1.0.1" })]);

    const result = ensureMcpBaseline(root);
    expect(result).toBeGreaterThan(0);
    expect(getItemById("a")?.version).toBe("1.0.1");
  });

  // ---- 14. Sync after DB was cleared externally ----

  it("should re-import when DB is empty but sync_meta still has old hash", () => {
    const items = [makeItem("a"), makeItem("b")];
    const root = makeTempRoot(items);

    ensureMcpBaseline(root);
    expect(getItemCount()).toBe(2);

    // Simulate external DB corruption: clear items but keep sync_meta
    clearAllItems();
    expect(getItemCount()).toBe(0);

    // sync_meta still says populated, but getItemCount() is 0
    // ensureMcpBaseline should detect this and re-import
    const result = ensureMcpBaseline(root);
    expect(result).toBeGreaterThan(0);
    expect(getItemCount()).toBe(2);
  });
});

// ========== deleteItemsByIds ==========

describe("deleteItemsByIds", () => {
  beforeEach(() => {
    const items = [makeItem("a"), makeItem("b"), makeItem("c"), makeItem("d")];
    insertItems(items);
  });

  it("should delete specified items", () => {
    const deleted = deleteItemsByIds(["a", "c"]);
    expect(deleted).toBe(2);
    expect(getItemById("a")).toBeNull();
    expect(getItemById("b")).not.toBeNull();
    expect(getItemById("c")).toBeNull();
    expect(getItemById("d")).not.toBeNull();
    expect(getItemCount()).toBe(2);
  });

  it("should return 0 for empty array", () => {
    expect(deleteItemsByIds([])).toBe(0);
    expect(getItemCount()).toBe(4);
  });

  it("should handle non-existent ids gracefully", () => {
    const deleted = deleteItemsByIds(["nonexistent-1", "nonexistent-2"]);
    expect(deleted).toBe(0); // returns actual affected rows, not requested count
    expect(getItemCount()).toBe(4); // nothing actually deleted
  });

  it("should delete all items when given all ids", () => {
    const deleted = deleteItemsByIds(["a", "b", "c", "d"]);
    expect(deleted).toBe(4);
    expect(getItemCount()).toBe(0);
  });
});

// ========== sync_meta state tracking ==========

describe("sync_meta state tracking", () => {
  it("should track baseline_hash in sync_meta after import", () => {
    const root = makeTempRoot([makeItem("a")]);
    ensureMcpBaseline(root);

    const db = getDatabase();
    const hashRow = db
      .prepare("SELECT value FROM sync_meta WHERE key = 'baseline_hash'")
      .get() as { value: string } | undefined;

    expect(hashRow).toBeDefined();
    expect(hashRow!.value).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
  });

  it("should update baseline_hash when file changes", () => {
    const root = makeTempRoot([makeItem("a")]);
    ensureMcpBaseline(root);

    const db = getDatabase();
    const hash1 = (
      db.prepare("SELECT value FROM sync_meta WHERE key = 'baseline_hash'").get() as {
        value: string;
      }
    ).value;

    // Change file
    updateIndexFile(root, [makeItem("a"), makeItem("b")]);
    ensureMcpBaseline(root);

    const hash2 = (
      db.prepare("SELECT value FROM sync_meta WHERE key = 'baseline_hash'").get() as {
        value: string;
      }
    ).value;

    expect(hash1).not.toBe(hash2);
  });

  it("should update baseline_count after sync", () => {
    const root = makeTempRoot([makeItem("a"), makeItem("b"), makeItem("c")]);
    ensureMcpBaseline(root);

    const db = getDatabase();
    const countRow = db
      .prepare("SELECT value FROM sync_meta WHERE key = 'baseline_count'")
      .get() as { value: string };

    expect(countRow.value).toBe("3");
  });

  it("should update baseline_at timestamp", () => {
    const before = new Date().toISOString();
    const root = makeTempRoot([makeItem("a")]);
    ensureMcpBaseline(root);

    const db = getDatabase();
    const atRow = db
      .prepare("SELECT value FROM sync_meta WHERE key = 'baseline_at'")
      .get() as { value: string };

    expect(atRow).toBeDefined();
    // Should be a valid ISO timestamp >= before
    const ts = new Date(atRow.value);
    expect(ts.getTime()).toBeGreaterThanOrEqual(new Date(before).getTime() - 1000);
  });
});
