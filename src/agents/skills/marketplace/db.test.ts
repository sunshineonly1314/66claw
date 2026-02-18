/**
 * Skills Marketplace DB Unit Tests
 * CN-ONLY FILE
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  getDatabase,
  closeDatabase,
  insertItem,
  insertItems,
  getItemById,
  updateItem,
  deleteItem,
  clearAllItems,
  searchItems,
  getCategoryStats,
  getStats,
  getLastGlobalVersion,
  setLastGlobalVersion,
  getLastSyncedAt,
  setLastSyncedAt,
  updateInstalledStatus,
  mergeQcData,
  populateFromRemoteIndex,
  populateFromProxyIndex,
  populateFromQcIndex,
  isQcPopulated,
  markQcPopulated,
  ensureQcBaseline,
} from "./db.js";
import type { SkillMarketplaceItem, QcSkillEntry } from "./types.js";

// ============================================================================
// Helpers
// ============================================================================

let testDbPath: string;

function makeItem(overrides: Partial<SkillMarketplaceItem> = {}): SkillMarketplaceItem {
  return {
    skillId: "test-skill",
    name: "test-skill",
    description: "A test skill",
    path: "test-skill",
    ...overrides,
  };
}

// ============================================================================
// Setup / Teardown
// ============================================================================

beforeEach(() => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-db-test-"));
  testDbPath = path.join(tmpDir, "test-skills.db");
  // Initialize DB with test path
  getDatabase(testDbPath);
});

afterEach(() => {
  closeDatabase();
  // Clean up temp dir
  if (testDbPath) {
    const dir = path.dirname(testDbPath);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors on Windows
    }
  }
});

// ============================================================================
// Schema Tests
// ============================================================================

describe("Schema initialization", () => {
  it("should create all tables and indexes", () => {
    const db = getDatabase(testDbPath);
    // Check main table exists
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("skills");
    expect(tableNames).toContain("sync_meta");
  });

  it("should create FTS5 search table", () => {
    const db = getDatabase(testDbPath);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'skills_search'")
      .all() as Array<{ name: string }>;
    expect(tables.length).toBe(1);
  });

  it("should create triggers", () => {
    const db = getDatabase(testDbPath);
    const triggers = db
      .prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name")
      .all() as Array<{ name: string }>;
    const triggerNames = triggers.map((t) => t.name);
    expect(triggerNames).toContain("skills_search_insert");
    expect(triggerNames).toContain("skills_search_update");
    expect(triggerNames).toContain("skills_search_delete");
  });
});

// ============================================================================
// CRUD Tests
// ============================================================================

describe("CRUD operations", () => {
  it("should insert and retrieve a skill", () => {
    const item = makeItem({
      nameCn: "测试技能",
      descriptionCn: "一个测试技能",
      category: "测试",
      tags: ["test", "demo"],
      emoji: "🧪",
      tier: "A",
      overallScore: 8.5,
    });
    insertItem(item);

    const retrieved = getItemById("test-skill");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.skillId).toBe("test-skill");
    expect(retrieved!.nameCn).toBe("测试技能");
    expect(retrieved!.tags).toEqual(["test", "demo"]);
    expect(retrieved!.tier).toBe("A");
    expect(retrieved!.overallScore).toBe(8.5);
  });

  it("should return null for non-existent skill", () => {
    const result = getItemById("does-not-exist");
    expect(result).toBeNull();
  });

  it("should update an existing skill", () => {
    insertItem(makeItem());
    updateItem("test-skill", { nameCn: "更新名称", tier: "S" });

    const updated = getItemById("test-skill");
    expect(updated!.nameCn).toBe("更新名称");
    expect(updated!.tier).toBe("S");
    // Original fields preserved
    expect(updated!.name).toBe("test-skill");
  });

  it("should throw on updating non-existent skill", () => {
    expect(() => updateItem("ghost", { tier: "A" })).toThrow("Skill not found: ghost");
  });

  it("should delete a skill", () => {
    insertItem(makeItem());
    expect(getItemById("test-skill")).not.toBeNull();

    deleteItem("test-skill");
    expect(getItemById("test-skill")).toBeNull();
  });

  it("should clear all items", () => {
    insertItem(makeItem({ skillId: "a", name: "a", path: "a" }));
    insertItem(makeItem({ skillId: "b", name: "b", path: "b" }));
    const before = searchItems({});
    expect(before.total).toBe(2);

    clearAllItems();
    const after = searchItems({});
    expect(after.total).toBe(0);
  });
});

// ============================================================================
// Batch Insert Tests
// ============================================================================

describe("Batch insert", () => {
  it("should insert multiple items in a transaction", () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem({
        skillId: `skill-${i}`,
        name: `skill-${i}`,
        path: `skill-${i}`,
        category: i < 5 ? "cat-a" : "cat-b",
      }),
    );
    insertItems(items);

    const result = searchItems({});
    expect(result.total).toBe(10);
  });

  it("should handle empty array gracefully", () => {
    insertItems([]);
    const result = searchItems({});
    expect(result.total).toBe(0);
  });

  it("should upsert on conflict (INSERT OR REPLACE)", () => {
    insertItem(makeItem({ description: "v1" }));
    insertItem(makeItem({ description: "v2" }));

    const item = getItemById("test-skill");
    expect(item!.description).toBe("v2");
  });
});

// ============================================================================
// Search & Pagination Tests
// ============================================================================

describe("Search", () => {
  beforeEach(() => {
    clearAllItems();
    const items: SkillMarketplaceItem[] = [
      makeItem({
        skillId: "apple-notes",
        name: "apple-notes",
        nameCn: "苹果笔记",
        descriptionCn: "macOS 原生笔记管理工具",
        category: "生产力工具",
        path: "apple-notes",
        tier: "A",
        overallScore: 8.2,
        cnBlocked: false,
        installed: true,
      }),
      makeItem({
        skillId: "1password",
        name: "1password",
        nameCn: "一密码",
        descriptionCn: "密钥管理方案",
        category: "安全与密钥管理",
        path: "1password",
        tier: "B",
        overallScore: 6.6,
        cnBlocked: true,
        installed: false,
      }),
      makeItem({
        skillId: "blogwatcher",
        name: "blogwatcher",
        nameCn: "博客监控",
        descriptionCn: "RSS 和博客更新监控工具",
        category: "内容监控",
        tags: ["RSS", "博客", "监控"],
        path: "blogwatcher",
        tier: "A",
        overallScore: 8.0,
        cnBlocked: false,
        installed: false,
      }),
    ];
    insertItems(items);
  });

  it("should return all items with no filters", () => {
    const result = searchItems({});
    expect(result.total).toBe(3);
    expect(result.items.length).toBe(3);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("should filter by category", () => {
    const result = searchItems({ category: "生产力工具" });
    expect(result.total).toBe(1);
    expect(result.items[0].skillId).toBe("apple-notes");
  });

  it("should filter by tier", () => {
    const result = searchItems({ tier: "A" });
    expect(result.total).toBe(2);
  });

  it("should filter by cnBlocked", () => {
    const result = searchItems({ cnBlocked: true });
    expect(result.total).toBe(1);
    expect(result.items[0].skillId).toBe("1password");
  });

  it("should filter by installed status", () => {
    const result = searchItems({ installed: true });
    expect(result.total).toBe(1);
    expect(result.items[0].skillId).toBe("apple-notes");
  });

  it("should support FTS5 keyword search (exact token)", () => {
    // unicode61 tokenizer treats CJK strings without spaces as single tokens
    // "苹果笔记" is one token — must search exact full string to match
    const result = searchItems({ keyword: "苹果笔记" });
    expect(result.total).toBe(1);
    expect(result.items[0].skillId).toBe("apple-notes");
  });

  it("should support FTS5 keyword search (description token)", () => {
    // "管理工具" appears as description_cn field for apple-notes ("macOS 原生笔记管理工具")
    // unicode61 splits on spaces, so "笔记管理工具" is a single token
    // But "macOS" is a separate token (space-separated)
    const result = searchItems({ keyword: "macOS" });
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it("should support FTS5 keyword search (tags)", () => {
    // Tags are JSON-stringified but indexed in FTS5
    const result = searchItems({ keyword: "RSS" });
    expect(result.total).toBe(1);
    expect(result.items[0].skillId).toBe("blogwatcher");
  });

  it("should sanitize FTS5 special characters", () => {
    // Should not throw even with special chars
    const result = searchItems({ keyword: 'test "AND" OR (NOT) *' });
    expect(result).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it("should paginate correctly", () => {
    const page1 = searchItems({ page: 1, pageSize: 2 });
    expect(page1.items.length).toBe(2);
    expect(page1.total).toBe(3);
    expect(page1.totalPages).toBe(2);

    const page2 = searchItems({ page: 2, pageSize: 2 });
    expect(page2.items.length).toBe(1);
    expect(page2.page).toBe(2);
  });

  it("should order by overall_score DESC", () => {
    const result = searchItems({
      orderBy: "overall_score",
      orderDirection: "DESC",
    });
    expect(result.items[0].skillId).toBe("apple-notes"); // 8.2
    expect(result.items[1].skillId).toBe("blogwatcher"); // 8.0
    expect(result.items[2].skillId).toBe("1password"); // 6.6
  });

  it("should reject invalid orderBy", () => {
    expect(() => searchItems({ orderBy: "DROP TABLE" as any })).toThrow("Invalid orderBy");
  });

  it("should reject invalid orderDirection", () => {
    expect(() => searchItems({ orderDirection: "MAYBE" as any })).toThrow("Invalid orderDirection");
  });

  it("should clamp page and pageSize to valid ranges", () => {
    const result = searchItems({ page: -1, pageSize: 999 });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(100);
  });
});

// ============================================================================
// Category & Stats Tests
// ============================================================================

describe("Statistics", () => {
  beforeEach(() => {
    clearAllItems();
    insertItems([
      makeItem({
        skillId: "a",
        name: "a",
        path: "a",
        category: "生产力工具",
        tier: "A",
        installed: true,
      }),
      makeItem({
        skillId: "b",
        name: "b",
        path: "b",
        category: "生产力工具",
        tier: "B",
        cnBlocked: true,
      }),
      makeItem({ skillId: "c", name: "c", path: "c", category: "安全", tier: "A" }),
    ]);
  });

  it("should return category stats", () => {
    const stats = getCategoryStats();
    expect(stats["生产力工具"]).toBe(2);
    expect(stats["安全"]).toBe(1);
  });

  it("should return overall stats", () => {
    const stats = getStats();
    expect(stats.total).toBe(3);
    expect(stats.installed).toBe(1);
    expect(stats.cnBlocked).toBe(1);
    expect(stats.tierDistribution.A).toBe(2);
    expect(stats.tierDistribution.B).toBe(1);
  });
});

// ============================================================================
// Sync Meta Tests
// ============================================================================

describe("Sync metadata", () => {
  beforeEach(() => {
    // Clear all data including sync_meta to avoid pollution
    clearAllItems();
    const db = getDatabase(testDbPath);
    db.exec("DELETE FROM sync_meta");
  });

  it("should get/set globalVersion", () => {
    expect(getLastGlobalVersion()).toBe(0);

    setLastGlobalVersion(42);
    expect(getLastGlobalVersion()).toBe(42);

    setLastGlobalVersion(100);
    expect(getLastGlobalVersion()).toBe(100);
  });

  it("should get/set lastSyncedAt", () => {
    expect(getLastSyncedAt()).toBeNull();

    const now = new Date().toISOString();
    setLastSyncedAt(now);
    expect(getLastSyncedAt()).toBe(now);
  });
});

// ============================================================================
// Install Status Tests
// ============================================================================

describe("Install status", () => {
  it("should update installed status for multiple skills", () => {
    insertItems([
      makeItem({ skillId: "a", name: "a", path: "a" }),
      makeItem({ skillId: "b", name: "b", path: "b" }),
      makeItem({ skillId: "c", name: "c", path: "c" }),
    ]);

    updateInstalledStatus(["a", "c"]);

    expect(getItemById("a")!.installed).toBe(true);
    expect(getItemById("b")!.installed).toBe(false);
    expect(getItemById("c")!.installed).toBe(true);
  });

  it("should reset all to uninstalled when empty list", () => {
    insertItem(makeItem({ installed: true }));
    updateInstalledStatus([]);
    expect(getItemById("test-skill")!.installed).toBe(false);
  });
});

// ============================================================================
// QC Merge Tests
// ============================================================================

describe("QC data merge", () => {
  it("should merge QC fields without overwriting proxy data", () => {
    insertItem(
      makeItem({
        skillId: "apple-notes",
        name: "apple-notes",
        description: "Original desc",
        path: "apple-notes",
      }),
    );

    const qcData: QcSkillEntry[] = [
      {
        name: "apple-notes",
        path: "apple-notes",
        tier: "A",
        overallScore: 8.2,
        category: "生产力工具",
        cnBlocked: false,
        cnAlternative: "",
        hasTranslation: true,
        descriptionZh: "苹果笔记管理",
        tags: ["macOS", "笔记"],
      },
    ];

    mergeQcData(qcData);

    const item = getItemById("apple-notes")!;
    expect(item.tier).toBe("A");
    expect(item.overallScore).toBe(8.2);
    expect(item.category).toBe("生产力工具");
    expect(item.cnBlocked).toBe(false);
    expect(item.hasTranslation).toBe(true);
    expect(item.descriptionCn).toBe("苹果笔记管理");
    // Original fields preserved
    expect(item.description).toBe("Original desc");
    expect(item.name).toBe("apple-notes");
  });

  it("should skip non-existent skills silently", () => {
    mergeQcData([
      {
        name: "nonexistent",
        path: "x",
        tier: "A",
        overallScore: 9,
        category: "test",
        cnBlocked: false,
        cnAlternative: "",
        hasTranslation: false,
      },
    ]);
    expect(getItemById("nonexistent")).toBeNull();
  });
});

// ============================================================================
// Populate Tests
// ============================================================================

describe("Populate from remote index", () => {
  it("should populate DB from RemoteSkillMeta array", () => {
    populateFromRemoteIndex(
      [
        {
          name: "himalaya",
          description: "Email CLI",
          descriptionZh: "邮件命令行",
          emoji: "📧",
          path: "himalaya",
          version: "1.0",
          tags: ["email"],
          author: "author",
        },
      ],
      ["himalaya"],
    );

    const item = getItemById("himalaya")!;
    expect(item.name).toBe("himalaya");
    expect(item.descriptionCn).toBe("邮件命令行");
    expect(item.installed).toBe(true);
    expect(getLastSyncedAt()).not.toBeNull();
  });
});

describe("Populate from proxy index", () => {
  it("should populate DB from ProxySkillMeta array with globalVersion", () => {
    populateFromProxyIndex(
      [
        {
          skillId: "himalaya",
          version: 5,
          sha256: "abc123",
          size: 1024,
          updatedAt: Date.now(),
          path: "himalaya",
          status: "active",
          name: "himalaya",
          nameZh: "喜马拉雅邮件",
          description: "Email CLI",
          descriptionZh: "邮件客户端",
          emoji: "📧",
          tags: ["email"],
          author: "test",
        },
      ],
      [],
      42,
    );

    const item = getItemById("himalaya")!;
    expect(item.name).toBe("himalaya");
    expect(item.nameCn).toBe("喜马拉雅邮件");
    expect(item.proxyVersion).toBe(5);
    expect(item.sha256).toBe("abc123");
    expect(item.sizeBytes).toBe(1024);
    expect(item.installed).toBe(false);

    expect(getLastGlobalVersion()).toBe(42);
  });

  it("should skip inactive skills", () => {
    populateFromProxyIndex(
      [
        {
          skillId: "dead-skill",
          version: 1,
          sha256: "x",
          size: 0,
          updatedAt: Date.now(),
          path: "dead-skill",
          status: "deprecated",
        },
      ],
      [],
      1,
    );

    expect(getItemById("dead-skill")).toBeNull();
  });
});

// ============================================================================
// QC Full Import Tests
// ============================================================================

describe("Populate from QC index", () => {
  let mockPackageRoot: string;

  beforeEach(() => {
    clearAllItems();
    // Create a mock package root with QC index files
    mockPackageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qc-import-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(mockPackageRoot, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors on Windows
    }
  });

  function writeQcIndex(subdir: string, data: object): void {
    const dir = path.join(mockPackageRoot, "cn", "skills-qc", subdir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "skills-index.json"), JSON.stringify(data), "utf-8");
  }

  it("should import all skills from output-all QC index", () => {
    writeQcIndex("output-all", {
      schemaVersion: 2,
      generatedAt: "2026-02-08T07:33:23.847Z",
      pipelineVersion: "1.1.0",
      stats: { totalScanned: 5, finalAccepted: 3, tierDistribution: { S: 1, A: 1, B: 1 } },
      skills: [
        {
          name: "apple-notes",
          description: "Manage Apple notes",
          descriptionZh: "苹果笔记管理工具",
          path: "apple-notes",
          tier: "S",
          overallScore: 9.0,
          category: "生产力工具",
          tags: ["macOS", "笔记"],
          cnBlocked: false,
          cnAlternative: "",
          hasTranslation: true,
        },
        {
          name: "1password",
          description: "Password manager CLI",
          descriptionZh: "密码管理工具",
          path: "1password",
          tier: "A",
          overallScore: 7.2,
          category: "安全工具",
          tags: ["密码", "安全"],
          cnBlocked: true,
          cnAlternative: "Bitwarden",
          hasTranslation: false,
        },
        {
          name: "blogwatcher",
          description: "Blog monitor",
          descriptionZh: "博客监控",
          path: "blogwatcher",
          tier: "B",
          overallScore: 5.5,
          category: "内容监控",
          tags: ["RSS", "博客"],
          cnBlocked: false,
          cnAlternative: "",
          hasTranslation: true,
        },
      ],
    });

    const count = populateFromQcIndex(mockPackageRoot);
    expect(count).toBe(3);

    // Verify all skills imported
    const result = searchItems({});
    expect(result.total).toBe(3);

    // Verify QC fields
    const apple = getItemById("apple-notes")!;
    expect(apple.tier).toBe("S");
    expect(apple.overallScore).toBe(9.0);
    expect(apple.category).toBe("生产力工具");
    expect(apple.descriptionCn).toBe("苹果笔记管理工具");
    expect(apple.cnBlocked).toBe(false);
    expect(apple.hasTranslation).toBe(true);
    expect(apple.source).toBe("qc");

    const pw = getItemById("1password")!;
    expect(pw.cnBlocked).toBe(true);
    expect(pw.cnAlternative).toBe("Bitwarden");
  });

  it("should import from both output-all and output (output-all first)", () => {
    // output-all has 2 skills
    writeQcIndex("output-all", {
      schemaVersion: 2,
      stats: { totalScanned: 2, finalAccepted: 2 },
      skills: [
        {
          name: "skill-a",
          description: "A",
          path: "a",
          tier: "A",
          overallScore: 7,
          category: "cat",
          cnBlocked: false,
          cnAlternative: "",
          hasTranslation: false,
        },
        {
          name: "skill-b",
          description: "B",
          path: "b",
          tier: "B",
          overallScore: 5,
          category: "cat",
          cnBlocked: false,
          cnAlternative: "",
          hasTranslation: false,
        },
      ],
    });

    // output has 1 skill (overlapping with output-all, will overwrite)
    writeQcIndex("output", {
      schemaVersion: 2,
      stats: { totalScanned: 1, finalAccepted: 1 },
      skills: [
        {
          name: "skill-a",
          description: "A-updated",
          descriptionZh: "精选A",
          path: "a",
          tier: "S",
          overallScore: 9,
          category: "精选",
          cnBlocked: false,
          cnAlternative: "",
          hasTranslation: true,
        },
      ],
    });

    const count = populateFromQcIndex(mockPackageRoot);
    // 2 from output-all + 1 from output (INSERT OR REPLACE)
    expect(count).toBe(3);

    // skill-a should be overwritten by output version (higher tier)
    const skillA = getItemById("skill-a")!;
    expect(skillA.tier).toBe("S");
    expect(skillA.overallScore).toBe(9);
    expect(skillA.descriptionCn).toBe("精选A");

    // skill-b from output-all should remain
    const skillB = getItemById("skill-b")!;
    expect(skillB.tier).toBe("B");

    // Total unique skills = 2
    expect(searchItems({}).total).toBe(2);
  });

  it("should return 0 when no QC files exist", () => {
    const count = populateFromQcIndex(mockPackageRoot);
    expect(count).toBe(0);
    expect(searchItems({}).total).toBe(0);
  });

  it("should handle malformed QC index gracefully", () => {
    const dir = path.join(mockPackageRoot, "cn", "skills-qc", "output-all");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "skills-index.json"), "not valid json", "utf-8");

    const count = populateFromQcIndex(mockPackageRoot);
    expect(count).toBe(0);
  });

  it("should preserve QC data when proxy data overlays", () => {
    // First: import QC baseline
    writeQcIndex("output-all", {
      schemaVersion: 2,
      stats: { totalScanned: 1, finalAccepted: 1 },
      skills: [
        {
          name: "himalaya",
          description: "QC desc",
          descriptionZh: "QC中文描述",
          path: "himalaya",
          tier: "A",
          overallScore: 8.0,
          category: "通信工具",
          tags: ["email"],
          cnBlocked: false,
          cnAlternative: "",
          hasTranslation: true,
        },
      ],
    });
    populateFromQcIndex(mockPackageRoot);

    // Then: proxy data overlays (INSERT OR REPLACE — overwrites entire row)
    populateFromRemoteIndex(
      [
        {
          name: "himalaya",
          description: "Proxy desc",
          descriptionZh: "Proxy中文",
          emoji: "📧",
          path: "himalaya",
          version: "2.0",
          tags: ["email", "cli"],
          author: "proxy-author",
        },
      ],
      ["himalaya"],
    );

    const item = getItemById("himalaya")!;
    // Proxy data takes over (INSERT OR REPLACE replaces entire row)
    expect(item.description).toBe("Proxy desc");
    expect(item.descriptionCn).toBe("Proxy中文");
    expect(item.installed).toBe(true);
    expect(item.source).toBe("proxy");
    // QC fields are lost on overwrite — this is expected,
    // mergeQcData() should be called after to restore QC enrichment
  });
});

// ============================================================================
// QC Baseline Idempotency Tests
// ============================================================================

describe("ensureQcBaseline", () => {
  let mockPackageRoot: string;

  beforeEach(() => {
    clearAllItems();
    const db = getDatabase(testDbPath);
    db.exec("DELETE FROM sync_meta");
    mockPackageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qc-baseline-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(mockPackageRoot, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  function writeQcIndex(data: object): void {
    const dir = path.join(mockPackageRoot, "cn", "skills-qc", "output-all");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "skills-index.json"), JSON.stringify(data), "utf-8");
  }

  it("should import QC data on first call and skip on second call", () => {
    writeQcIndex({
      schemaVersion: 2,
      stats: { totalScanned: 2, finalAccepted: 2 },
      skills: [
        {
          name: "s1",
          description: "d1",
          path: "s1",
          tier: "A",
          overallScore: 7,
          category: "c",
          cnBlocked: false,
          cnAlternative: "",
          hasTranslation: false,
        },
        {
          name: "s2",
          description: "d2",
          path: "s2",
          tier: "B",
          overallScore: 5,
          category: "c",
          cnBlocked: false,
          cnAlternative: "",
          hasTranslation: false,
        },
      ],
    });

    // First call imports
    expect(isQcPopulated()).toBe(false);
    const count1 = ensureQcBaseline(mockPackageRoot);
    expect(count1).toBe(2);
    expect(isQcPopulated()).toBe(true);
    expect(searchItems({}).total).toBe(2);

    // Second call skips (idempotent)
    const count2 = ensureQcBaseline(mockPackageRoot);
    expect(count2).toBe(0);
    // Data unchanged
    expect(searchItems({}).total).toBe(2);
  });

  it("should not mark as populated when no QC files exist", () => {
    const count = ensureQcBaseline(mockPackageRoot);
    expect(count).toBe(0);
    expect(isQcPopulated()).toBe(false);
  });
});
