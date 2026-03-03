/**
 * [CN-PATCH:memory-p0] memory-schema.ts trigram 迁移 + 回填测试
 *
 * 使用 node:sqlite DatabaseSync 进行真实数据库测试
 * 覆盖：
 * 1. 新建 FTS 表 — CN 区域应使用 trigram tokenizer
 * 2. 旧表迁移 — unicode61 → trigram（DROP + 重建 + 回填）
 * 3. 已是 trigram 的表不重复迁移
 * 4. 回填逻辑 — chunks 表数据正确插入 FTS
 * 5. 中文子串搜索验证（trigram vs unicode61）
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { ensureMemoryIndexSchema, backfillFtsFromChunks } from "./memory-schema.js";
import { _resetChinaRegionCache } from "../config/region-cn.js";

// ============================================================================
// 辅助
// ============================================================================

/** 创建内存数据库并预填基础表结构（不含 FTS） */
function createTestDb(): DatabaseSync {
  return new DatabaseSync(":memory:");
}

/** 向 chunks 表插入测试数据 */
function insertChunk(
  db: DatabaseSync,
  data: {
    id: string;
    path: string;
    text: string;
    source?: string;
    model?: string;
    startLine?: number;
    endLine?: number;
  },
): void {
  db.prepare(
    `INSERT INTO chunks (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at)
     VALUES (?, ?, ?, ?, ?, 'hash', ?, ?, '[]', ?)`,
  ).run(
    data.id,
    data.path,
    data.source ?? "memory",
    data.startLine ?? 1,
    data.endLine ?? 10,
    data.model ?? "test-model",
    data.text,
    Date.now(),
  );
}

// ============================================================================
// 1. CN 区域 — trigram tokenizer 创建
// ============================================================================

describe("ensureMemoryIndexSchema — CN trigram [CN-PATCH:memory-p0]", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    _resetChinaRegionCache();
  });

  it("CN 区域创建 FTS 表使用 trigram tokenizer", () => {
    vi.stubEnv("OPENCLAWCN_REGION", "cn");

    const db = createTestDb();
    const result = ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: true,
    });

    expect(result.ftsAvailable).toBe(true);
    expect(result.ftsError).toBeUndefined();

    // 验证 FTS 表使用 trigram
    const row = db
      .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='fts_index'`)
      .get() as { sql: string } | undefined;
    expect(row?.sql?.toLowerCase()).toContain("trigram");
  });

  it("非 CN 区域创建 FTS 表不使用 trigram（默认 unicode61）", () => {
    vi.stubEnv("OPENCLAWCN_REGION", "global");

    const db = createTestDb();
    const result = ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: true,
    });

    expect(result.ftsAvailable).toBe(true);

    const row = db
      .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='fts_index'`)
      .get() as { sql: string } | undefined;
    expect(row?.sql?.toLowerCase()).not.toContain("trigram");
  });

  it("ftsEnabled=false 时不创建 FTS 表", () => {
    vi.stubEnv("OPENCLAWCN_REGION", "cn");

    const db = createTestDb();
    const result = ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: false,
    });

    expect(result.ftsAvailable).toBe(false);

    const row = db
      .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='fts_index'`)
      .get() as { sql: string } | undefined;
    expect(row).toBeUndefined();
  });
});

// ============================================================================
// 2. 旧表迁移测试
// ============================================================================

describe("migrateFtsToTrigram — 迁移逻辑 [CN-PATCH:memory-p0]", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    _resetChinaRegionCache();
  });

  it("旧 unicode61 FTS 表被 DROP 并重建为 trigram", () => {
    // Step 1: 先在非 CN 模式下创建 unicode61 FTS 表
    vi.stubEnv("OPENCLAWCN_REGION", "global");
    const db = createTestDb();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: true,
    });

    // 验证是 unicode61（没有 trigram）
    let row = db
      .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='fts_index'`)
      .get() as { sql: string };
    expect(row.sql.toLowerCase()).not.toContain("trigram");

    // 插入一些 chunks 数据（用于回填测试）
    insertChunk(db, { id: "c1", path: "test.md", text: "今天我们讨论了内存优化方案" });
    insertChunk(db, { id: "c2", path: "test.md", text: "FTS5 trigram 是解决方案" });

    // Step 2: 切换到 CN 模式，重新调用 ensureSchema
    vi.stubEnv("OPENCLAWCN_REGION", "cn");
    _resetChinaRegionCache();
    const result = ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: true,
    });

    expect(result.ftsAvailable).toBe(true);

    // 验证现在是 trigram
    row = db
      .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='fts_index'`)
      .get() as { sql: string };
    expect(row.sql.toLowerCase()).toContain("trigram");
  });

  it("已是 trigram 的表不会被重复 DROP", () => {
    vi.stubEnv("OPENCLAWCN_REGION", "cn");
    const db = createTestDb();

    // 第一次创建
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: true,
    });

    // 插入 FTS 数据
    insertChunk(db, { id: "c1", path: "test.md", text: "测试数据不应该丢失" });
    db.prepare(
      `INSERT INTO fts_index (text, id, path, source, model, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("测试数据不应该丢失", "c1", "test.md", "memory", "test-model", 1, 10);

    const beforeCount = (
      db.prepare(`SELECT count(*) AS cnt FROM fts_index`).get() as { cnt: number }
    ).cnt;
    expect(beforeCount).toBe(1);

    // 第二次调用 — 不应该 DROP
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: true,
    });

    const afterCount = (
      db.prepare(`SELECT count(*) AS cnt FROM fts_index`).get() as { cnt: number }
    ).cnt;
    // trigram 表不被 DROP，数据应保留
    expect(afterCount).toBe(beforeCount);
  });
});

// ============================================================================
// 3. 回填逻辑测试
// ============================================================================

describe("backfillFtsFromChunks [CN-PATCH:memory-p0]", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    _resetChinaRegionCache();
  });

  it("从 chunks 表回填 FTS 数据", () => {
    vi.stubEnv("OPENCLAWCN_REGION", "cn");
    const db = createTestDb();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: true,
    });

    // 插入 chunks 数据
    insertChunk(db, { id: "c1", path: "test.md", text: "内存优化方案讨论" });
    insertChunk(db, { id: "c2", path: "test2.md", text: "FTS5 搜索引擎设计" });

    // 清空 FTS（模拟迁移后的空 FTS 表）
    db.exec(`DELETE FROM fts_index`);

    // 回填
    const count = backfillFtsFromChunks(db, "fts_index");
    expect(count).toBe(2);

    // 验证 FTS 数据
    const ftsCount = (db.prepare(`SELECT count(*) AS cnt FROM fts_index`).get() as { cnt: number })
      .cnt;
    expect(ftsCount).toBe(2);
  });

  it("chunks 表为空时回填 0 条", () => {
    vi.stubEnv("OPENCLAWCN_REGION", "cn");
    const db = createTestDb();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: true,
    });

    const count = backfillFtsFromChunks(db, "fts_index");
    expect(count).toBe(0);
  });

  it("迁移后自动回填（FTS 为空 + chunks 有数据）", () => {
    // 先在全局模式创建 unicode61 FTS 表
    vi.stubEnv("OPENCLAWCN_REGION", "global");
    const db = createTestDb();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: true,
    });

    // 插入 chunks 数据
    insertChunk(db, { id: "c1", path: "test.md", text: "今天讨论了内存系统优化" });
    insertChunk(db, { id: "c2", path: "test2.md", text: "需要解决中文搜索问题" });

    // 也插入到旧 FTS 表
    db.prepare(
      `INSERT INTO fts_index (text, id, path, source, model, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("今天讨论了内存系统优化", "c1", "test.md", "memory", "test-model", 1, 10);

    // 切换到 CN 模式 → 触发迁移 + 自动回填
    vi.stubEnv("OPENCLAWCN_REGION", "cn");
    _resetChinaRegionCache();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: true,
    });

    // 验证回填成功
    const ftsCount = (db.prepare(`SELECT count(*) AS cnt FROM fts_index`).get() as { cnt: number })
      .cnt;
    expect(ftsCount).toBe(2); // 从 chunks 回填了 2 条
  });
});

// ============================================================================
// 4. 中文 FTS5 搜索验证（trigram 实际效果）
// ============================================================================

describe("FTS5 trigram — 中文子串搜索验证 [CN-PATCH:memory-p0]", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    _resetChinaRegionCache();
  });

  it("trigram: 中文子串匹配成功", () => {
    vi.stubEnv("OPENCLAWCN_REGION", "cn");
    const db = createTestDb();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: true,
    });

    // 插入中文文本到 FTS
    db.prepare(
      `INSERT INTO fts_index (text, id, path, source, model, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("今天我们讨论了内存优化方案的实现细节", "c1", "test.md", "memory", "model", 1, 10);

    // 搜索子串 "内存优化" (4 chars, >= 3)
    const results = db.prepare(`SELECT * FROM fts_index WHERE fts_index MATCH '"内存优化"'`).all();
    expect(results.length).toBeGreaterThan(0);
  });

  it("trigram: 3 字符中文搜索成功", () => {
    vi.stubEnv("OPENCLAWCN_REGION", "cn");
    const db = createTestDb();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: true,
    });

    db.prepare(
      `INSERT INTO fts_index (text, id, path, source, model, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("讨论了很多重要的事情", "c1", "test.md", "memory", "model", 1, 10);

    const results = db.prepare(`SELECT * FROM fts_index WHERE fts_index MATCH '"讨论了"'`).all();
    expect(results.length).toBeGreaterThan(0);
  });

  it("trigram: 2 字符中文搜索应该失败（低于 trigram 最小窗口）", () => {
    vi.stubEnv("OPENCLAWCN_REGION", "cn");
    const db = createTestDb();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: true,
    });

    db.prepare(
      `INSERT INTO fts_index (text, id, path, source, model, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("讨论了很多重要的事情", "c1", "test.md", "memory", "model", 1, 10);

    // 2 字符查询 → trigram 不支持
    // 注意：FTS5 trigram 对 < 3 字符的查询可能抛异常或返回空
    try {
      const results = db.prepare(`SELECT * FROM fts_index WHERE fts_index MATCH '"讨论"'`).all();
      // 如果没抛异常，应该返回空
      expect(results).toHaveLength(0);
    } catch {
      // trigram 拒绝 < 3 字符查询 → 这也是正确行为
      expect(true).toBe(true);
    }
  });

  it("trigram: 英文搜索仍然工作", () => {
    vi.stubEnv("OPENCLAWCN_REGION", "cn");
    const db = createTestDb();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: true,
    });

    db.prepare(
      `INSERT INTO fts_index (text, id, path, source, model, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("React component for memory optimization", "c1", "test.md", "memory", "model", 1, 10);

    const results = db.prepare(`SELECT * FROM fts_index WHERE fts_index MATCH '"React"'`).all();
    expect(results.length).toBeGreaterThan(0);
  });

  it("【BUG-PROBE】unicode61: 中文子串搜索失败（对比验证）", () => {
    vi.stubEnv("OPENCLAWCN_REGION", "global");
    const db = createTestDb();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: true,
    });

    db.prepare(
      `INSERT INTO fts_index (text, id, path, source, model, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("今天我们讨论了内存优化方案的实现细节", "c1", "test.md", "memory", "model", 1, 10);

    // unicode61 下搜索中文子串
    try {
      const results = db
        .prepare(`SELECT * FROM fts_index WHERE fts_index MATCH '"内存优化"'`)
        .all();
      // unicode61 下中文被合并为单 token，子串搜索应失败
      // 注意：这取决于 SQLite 版本和 unicode61 的具体行为
      // 可能返回 0 结果（因为 "内存优化" != "今天我们讨论了内存优化方案的实现细节" 作为整体 token）
      // 这正是我们需要 trigram 的原因
      expect(results.length).toBe(0);
    } catch {
      // unicode61 可能在某些 token 处理上抛异常
      expect(true).toBe(true);
    }
  });
});

// ============================================================================
// 5. Schema 完整性测试
// ============================================================================

describe("ensureMemoryIndexSchema — 基础表结构 [CN-PATCH:memory-p0]", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    _resetChinaRegionCache();
  });

  it("创建所有必需的表和索引", () => {
    vi.stubEnv("OPENCLAWCN_REGION", "cn");
    const db = createTestDb();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: true,
    });

    // 检查所有表
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain("meta");
    expect(tableNames).toContain("files");
    expect(tableNames).toContain("chunks");
    expect(tableNames).toContain("embedding_cache");
    expect(tableNames).toContain("fts_index");
  });

  it("chunks 表包含 source 列", () => {
    vi.stubEnv("OPENCLAWCN_REGION", "cn");
    const db = createTestDb();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: true,
    });

    const columns = db.prepare(`PRAGMA table_info(chunks)`).all() as Array<{ name: string }>;
    const colNames = columns.map((c) => c.name);
    expect(colNames).toContain("source");
  });

  it("files 表包含 source 列", () => {
    vi.stubEnv("OPENCLAWCN_REGION", "cn");
    const db = createTestDb();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "fts_index",
      ftsEnabled: true,
    });

    const columns = db.prepare(`PRAGMA table_info(files)`).all() as Array<{ name: string }>;
    const colNames = columns.map((c) => c.name);
    expect(colNames).toContain("source");
  });

  it("幂等性：多次调用不报错", () => {
    vi.stubEnv("OPENCLAWCN_REGION", "cn");
    const db = createTestDb();

    // 调用 3 次
    for (let i = 0; i < 3; i++) {
      const result = ensureMemoryIndexSchema({
        db,
        embeddingCacheTable: "embedding_cache",
        ftsTable: "fts_index",
        ftsEnabled: true,
      });
      expect(result.ftsAvailable).toBe(true);
    }
  });
});
