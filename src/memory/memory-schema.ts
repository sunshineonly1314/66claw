import type { DatabaseSync } from "node:sqlite";
// [CN-PATCH:memory-p0] 导入 CN 区域检测，用于决定 FTS5 tokenizer 类型
import { detectChinaRegion } from "../config/region-cn.js";

export function ensureMemoryIndexSchema(params: {
  db: DatabaseSync;
  embeddingCacheTable: string;
  ftsTable: string;
  ftsEnabled: boolean;
}): { ftsAvailable: boolean; ftsError?: string } {
  params.db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  params.db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      source TEXT NOT NULL DEFAULT 'memory',
      hash TEXT NOT NULL,
      mtime INTEGER NOT NULL,
      size INTEGER NOT NULL
    );
  `);
  params.db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'memory',
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      hash TEXT NOT NULL,
      model TEXT NOT NULL,
      text TEXT NOT NULL,
      embedding TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  params.db.exec(`
    CREATE TABLE IF NOT EXISTS ${params.embeddingCacheTable} (
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      provider_key TEXT NOT NULL,
      hash TEXT NOT NULL,
      embedding TEXT NOT NULL,
      dims INTEGER,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (provider, model, provider_key, hash)
    );
  `);
  params.db.exec(
    `CREATE INDEX IF NOT EXISTS idx_embedding_cache_updated_at ON ${params.embeddingCacheTable}(updated_at);`,
  );

  let ftsAvailable = false;
  let ftsError: string | undefined;
  if (params.ftsEnabled) {
    // [CN-PATCH:memory-p0] 中国区使用 trigram tokenizer 支持 CJK 子串搜索
    // 上游使用默认 unicode61 tokenizer（对中文完全无效，连续汉字合并为单 token）
    // trigram 将文本拆为3字符滑动窗口，天然支持任意子串匹配（含中文）
    const useTrigram = detectChinaRegion();
    if (useTrigram) {
      migrateFtsToTrigram(params.db, params.ftsTable);
    }
    try {
      const tokenizeClause = useTrigram ? `,\n  tokenize='trigram'` : "";
      params.db.exec(
        `CREATE VIRTUAL TABLE IF NOT EXISTS ${params.ftsTable} USING fts5(\n` +
          `  text,\n` +
          `  id UNINDEXED,\n` +
          `  path UNINDEXED,\n` +
          `  source UNINDEXED,\n` +
          `  model UNINDEXED,\n` +
          `  start_line UNINDEXED,\n` +
          `  end_line UNINDEXED\n` +
          `${tokenizeClause});`,
      );
      ftsAvailable = true;
      // [CN-PATCH:memory-p0] 迁移后回填：FTS 表为空但 chunks 表有数据时，从 chunks 回填
      if (useTrigram) {
        const ftsCount = (
          params.db.prepare(`SELECT count(*) AS cnt FROM ${params.ftsTable}`).get() as {
            cnt: number;
          }
        ).cnt;
        if (ftsCount === 0) {
          backfillFtsFromChunks(params.db, params.ftsTable);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ftsAvailable = false;
      ftsError = message;
    }
  }

  ensureColumn(params.db, "files", "source", "TEXT NOT NULL DEFAULT 'memory'");
  ensureColumn(params.db, "chunks", "source", "TEXT NOT NULL DEFAULT 'memory'");
  params.db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_path ON chunks(path);`);
  params.db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source);`);

  return { ftsAvailable, ...(ftsError ? { ftsError } : {}) };
}

function ensureColumn(
  db: DatabaseSync,
  table: "files" | "chunks",
  column: string,
  definition: string,
): void {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (rows.some((row) => row.name === column)) {
    return;
  }
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

// [CN-PATCH:memory-p0] 从 unicode61 迁移到 trigram tokenizer
// FTS5 virtual table 不支持 ALTER，只能 DROP + 重建 + 回填
// 检测方法：查询 sqlite_master 获取建表 SQL，检查是否包含 trigram
// 回填方法：从 chunks 表读取已有数据直接 INSERT INTO FTS，不需要重新 embedding
function migrateFtsToTrigram(db: DatabaseSync, ftsTable: string): void {
  try {
    const row = db
      .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`)
      .get(ftsTable) as { sql: string } | undefined;
    if (!row?.sql) {
      return; // 表不存在，后续 CREATE 会直接创建 trigram 版本
    }
    if (row.sql.toLowerCase().includes("trigram")) {
      return; // 已经是 trigram，无需迁移
    }
    // 旧表使用 unicode61，DROP 重建
    db.exec(`DROP TABLE IF EXISTS ${ftsTable}`);
    // 新表由调用方的 CREATE VIRTUAL TABLE 创建（带 trigram）
    // 创建后需要从 chunks 表回填数据，见 backfillFtsFromChunks
  } catch {
    // 迁移检测失败，静默跳过，后续 CREATE IF NOT EXISTS 会保留旧表
  }
}

// [CN-PATCH:memory-p0] 从 chunks 表回填 FTS 数据（trigram 迁移后使用）
// 无需调用 embedding API，直接从已有的 chunks.text 插入 FTS 索引
export function backfillFtsFromChunks(db: DatabaseSync, ftsTable: string): number {
  try {
    const result = db
      .prepare(
        `INSERT INTO ${ftsTable} (text, id, path, source, model, start_line, end_line)` +
          ` SELECT text, id, path, source, model, start_line, end_line FROM chunks`,
      )
      .run();
    return Number(result.changes);
  } catch {
    return 0;
  }
}
