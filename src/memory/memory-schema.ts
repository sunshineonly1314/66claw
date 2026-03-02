import type { DatabaseSync } from "node:sqlite";
// [CN-PATCH:memory-p0] 导入 CN 区域检测，用于决定 FTS5 tokenizer 类型
import { detectChinaRegion } from "../config/region-cn.js";
import { runDbMigrations, type DbMigration } from "../db/migrate.js";

// [CN-PATCH:memory-fix] Run SQLite integrity check on startup.
// Detects corruption early so it can be reported and (if needed) auto-rebuilt.
// Uses quick_check (faster than full integrity_check) — returns 'ok' if healthy.
export function checkDatabaseIntegrity(db: DatabaseSync): {
  ok: boolean;
  error?: string;
} {
  try {
    const result = db.prepare("PRAGMA quick_check").get() as {
      quick_check?: string;
      integrity_check?: string;
    } | null;
    const status = result?.quick_check ?? result?.integrity_check ?? "unknown";
    if (status === "ok") return { ok: true };
    return { ok: false, error: `integrity check failed: ${status}` };
  } catch (err) {
    return { ok: false, error: `integrity check error: ${String(err).slice(0, 200)}` };
  }
}

/**
 * Build versioned migration list for the memory database.
 * Uses a factory function because table names are parameterized.
 */
function buildMemoryMigrations(params: {
  embeddingCacheTable: string;
  ftsTable: string;
  ftsEnabled: boolean;
  ftsResult: { ftsAvailable: boolean; ftsError?: string };
}): DbMigration[] {
  return [
    {
      version: 1,
      label: "core tables (meta, files, chunks, embedding_cache)",
      up: (db) => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          );
        `);
        db.exec(`
          CREATE TABLE IF NOT EXISTS files (
            path TEXT PRIMARY KEY,
            source TEXT NOT NULL DEFAULT 'memory',
            hash TEXT NOT NULL,
            mtime INTEGER NOT NULL,
            size INTEGER NOT NULL
          );
        `);
        db.exec(`
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
        db.exec(`
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
        db.exec(
          `CREATE INDEX IF NOT EXISTS idx_embedding_cache_updated_at ON ${params.embeddingCacheTable}(updated_at);`,
        );
      },
    },
    {
      version: 2,
      label: "extraction_queue + profile_changelog",
      up: (db) => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS extraction_queue (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_msg    TEXT NOT NULL,
            agent_reply TEXT NOT NULL,
            created_at  INTEGER NOT NULL,
            attempts    INTEGER NOT NULL DEFAULT 0,
            last_error  TEXT,
            status      TEXT NOT NULL DEFAULT 'pending'
          );
        `);
        db.exec(
          `CREATE INDEX IF NOT EXISTS idx_eq_status ON extraction_queue(status, created_at);`,
        );
        db.exec(`
          CREATE TABLE IF NOT EXISTS profile_changelog (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            category    TEXT NOT NULL,
            key         TEXT NOT NULL,
            old_value   TEXT,
            new_value   TEXT,
            operation   TEXT NOT NULL,
            reason      TEXT,
            created_at  INTEGER NOT NULL
          );
        `);
        db.exec(
          `CREATE INDEX IF NOT EXISTS idx_changelog_key ON profile_changelog(category, key);`,
        );
      },
    },
    {
      version: 3,
      label: "FTS5 chunks_fts",
      noTransaction: true,
      up: (db) => {
        if (!params.ftsEnabled) {
          return;
        }
        const useTrigram = detectChinaRegion();
        if (useTrigram) {
          migrateFtsToTrigram(db, params.ftsTable);
        }
        try {
          const tokenizeClause = useTrigram ? `,\n  tokenize='trigram'` : "";
          db.exec(
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
          params.ftsResult.ftsAvailable = true;
          if (useTrigram) {
            const ftsCount = (
              db.prepare(`SELECT count(*) AS cnt FROM ${params.ftsTable}`).get() as {
                cnt: number;
              }
            ).cnt;
            if (ftsCount === 0) {
              backfillFtsFromChunks(db, params.ftsTable);
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          params.ftsResult.ftsAvailable = false;
          params.ftsResult.ftsError = message;
        }
      },
    },
    {
      version: 4,
      label: "ensureColumn source + indexes",
      up: (db) => {
        ensureColumn(db, "files", "source", "TEXT NOT NULL DEFAULT 'memory'");
        ensureColumn(db, "chunks", "source", "TEXT NOT NULL DEFAULT 'memory'");
        db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_path ON chunks(path);`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source);`);
        db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_files_path_source ON files(path, source);`);
      },
    },
  ];
}

export function ensureMemoryIndexSchema(params: {
  db: DatabaseSync;
  embeddingCacheTable: string;
  ftsTable: string;
  ftsEnabled: boolean;
}): { ftsAvailable: boolean; ftsError?: string; integrityOk?: boolean } {
  // [CN-PATCH:memory-fix] Run integrity check before schema operations
  const integrity = checkDatabaseIntegrity(params.db);
  if (!integrity.ok) {
    console.warn(
      `[memory-safety] SQLite integrity check failed: ${integrity.error}. ` +
        `Database may be corrupted. Consider backing up and rebuilding.`,
    );
  }

  const ftsResult: { ftsAvailable: boolean; ftsError?: string } = {
    ftsAvailable: false,
  };

  const migrations = buildMemoryMigrations({
    embeddingCacheTable: params.embeddingCacheTable,
    ftsTable: params.ftsTable,
    ftsEnabled: params.ftsEnabled,
    ftsResult,
  });

  runDbMigrations(params.db, migrations);

  // [CN-PATCH:memory-p0] Post-migration trigram check.
  // The migration system only runs each version once (keyed by user_version).
  // If the DB was first created in global mode (unicode61 FTS) and later
  // switches to CN mode, migration v3 won't re-run. We need to check and
  // migrate the FTS tokenizer unconditionally on every ensureSchema call.
  if (params.ftsEnabled && detectChinaRegion()) {
    try {
      const row = params.db
        .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`)
        .get(params.ftsTable) as { sql: string } | undefined;
      if (row?.sql && !row.sql.toLowerCase().includes("trigram")) {
        // Existing FTS table uses unicode61 — needs migration to trigram
        migrateFtsToTrigram(params.db, params.ftsTable);
        // Recreate with trigram tokenizer
        const tokenizeClause = `,\n  tokenize='trigram'`;
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
        ftsResult.ftsAvailable = true;
        // Backfill from chunks if FTS is empty after migration
        const ftsCount = (
          params.db.prepare(`SELECT count(*) AS cnt FROM ${params.ftsTable}`).get() as {
            cnt: number;
          }
        ).cnt;
        if (ftsCount === 0) {
          backfillFtsFromChunks(params.db, params.ftsTable);
        }
      } else if (row?.sql) {
        // Already trigram — mark as available
        ftsResult.ftsAvailable = true;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ftsResult.ftsAvailable = false;
      ftsResult.ftsError = message;
    }
  }

  return {
    ftsAvailable: ftsResult.ftsAvailable,
    ...(ftsResult.ftsError ? { ftsError: ftsResult.ftsError } : {}),
    integrityOk: integrity.ok,
  };
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
  } catch (err) {
    // [CN-PATCH:memory-fix] Log migration failure instead of silently swallowing.
    // A silent failure here means the user stays on unicode61 tokenizer (broken for CJK)
    // with no indication of the problem.
    console.warn(
      `[memory-fts] FTS trigram migration failed for table "${ftsTable}": ` +
        `${err instanceof Error ? err.message : String(err).slice(0, 200)}. ` +
        `CJK search may not work correctly. Will retry on next startup.`,
    );
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
