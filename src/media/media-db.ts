/**
 * Media Metadata SQLite Store — 图片/视频元数据索引
 *
 * 职责：
 *   1. 管理 media-metadata.sqlite 生命周期（singleton）
 *   2. AI 返回图片/视频结果时，立即提取有效信息（URL、模型、prompt 等）写入
 *   3. UI 查询走 SQLite，不依赖 JSONL 中的 tool_result details
 *   4. 仅存路径/URL + 元数据，不存二进制文件
 *
 * 隔离原则：
 *   - 独立 SQLite 文件（media-metadata.sqlite），不碰 memory.sqlite / tool-index.sqlite
 *   - 仅 import node:sqlite 底层包
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { requireNodeSqlite } from "../memory/sqlite.js";
import { resolveConfigDir } from "../utils.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_FILENAME = "media-metadata.sqlite";
const TABLE = "media_assets";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaAssetRow {
  id: string;
  session_key: string;
  type: "image" | "video";
  file: string;
  url: string;
  mime_type: string | null;
  size_bytes: number | null;
  source: "upload" | "generated";
  prompt: string | null;
  revised_prompt: string | null;
  model: string | null;
  provider: string | null;
  image_size: string | null;
  style: string | null;
  seed: number | null;
  duration_ms: number | null;
  duration_secs: number | null;
  cover_url: string | null;
  message_text: string | null;
  created_at: string;
  expires_at: string | null;
}

// ---------------------------------------------------------------------------
// Module state (singleton per process)
// ---------------------------------------------------------------------------

let _db: DatabaseSync | null = null;
let _dbPath: string | null = null;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

function ensureSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id            TEXT PRIMARY KEY,
      session_key   TEXT NOT NULL,
      type          TEXT NOT NULL,
      file          TEXT NOT NULL,
      url           TEXT NOT NULL,
      mime_type     TEXT,
      size_bytes    INTEGER,
      source        TEXT DEFAULT 'generated',
      prompt        TEXT,
      revised_prompt TEXT,
      model         TEXT,
      provider      TEXT,
      image_size    TEXT,
      style         TEXT,
      seed          INTEGER,
      duration_ms   INTEGER,
      duration_secs REAL,
      cover_url     TEXT,
      message_text  TEXT,
      created_at    TEXT NOT NULL,
      expires_at    TEXT
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_media_session ON ${TABLE}(session_key);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_media_created ON ${TABLE}(created_at);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_media_type    ON ${TABLE}(type);`);
}

// ---------------------------------------------------------------------------
// DB Lifecycle
// ---------------------------------------------------------------------------

function resolveDbPath(): string {
  const dataDir = join(resolveConfigDir(), "data");
  return join(dataDir, DB_FILENAME);
}

/**
 * 打开（或返回已缓存的）media-metadata.sqlite 连接。
 */
export function openMediaDb(): DatabaseSync {
  const newDbPath = resolveDbPath();

  // 路径变化时关闭旧连接
  if (_db && _dbPath && _dbPath !== newDbPath) {
    try {
      _db.close();
    } catch {
      /* ignore */
    }
    _db = null;
    _dbPath = null;
  }

  if (_db && _dbPath === newDbPath) {
    return _db;
  }

  const dataDir = join(resolveConfigDir(), "data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const sqlite = requireNodeSqlite();
  _db = new sqlite.DatabaseSync(newDbPath);
  _dbPath = newDbPath;

  // auto_vacuum 必须在 journal_mode 之前设置（仅对新建数据库生效）
  _db.exec("PRAGMA auto_vacuum=INCREMENTAL");
  _db.exec("PRAGMA journal_mode=WAL");
  _db.exec("PRAGMA synchronous=NORMAL");
  _db.exec("PRAGMA busy_timeout=3000");

  ensureSchema(_db);

  // [CN-PATCH:media-fix] Integrity check on startup — detect corruption early.
  // Mirrors the same safety pattern used in memory-schema.ts.
  try {
    const result = _db.prepare("PRAGMA quick_check").get() as {
      quick_check?: string;
    } | null;
    const status = result?.quick_check ?? "unknown";
    if (status !== "ok") {
      console.warn(
        `[media-db] SQLite integrity check failed: ${status}. ` +
          `Media database may be corrupted. Recent media records may be lost.`,
      );
    }
  } catch (err) {
    console.warn(`[media-db] integrity check error: ${String(err).slice(0, 200)}`);
  }

  return _db;
}

/**
 * 关闭数据库连接（进程退出时调用）。
 * [CN-PATCH:media-fix] WAL checkpoint before close:
 * 确保 WAL 中的数据写回主库文件，防止 WAL 文件丢失时数据丢失。
 */
export function closeMediaDb(): void {
  if (_db) {
    try {
      _db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch {
      // checkpoint 失败不致命：close() 仍会尝试 checkpoint
    }
    try {
      _db.close();
    } catch {
      /* ignore */
    }
    _db = null;
    _dbPath = null;
  }
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

/**
 * 插入一条媒体资源记录。已存在则跳过（INSERT OR IGNORE）。
 */
export function insertMediaAsset(row: MediaAssetRow): void {
  const db = openMediaDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO ${TABLE} (
      id, session_key, type, file, url, mime_type, size_bytes, source,
      prompt, revised_prompt, model, provider, image_size, style, seed,
      duration_ms, duration_secs, cover_url, message_text, created_at, expires_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `);
  stmt.run(
    row.id,
    row.session_key,
    row.type,
    row.file,
    row.url,
    row.mime_type ?? null,
    row.size_bytes ?? null,
    row.source,
    row.prompt ?? null,
    row.revised_prompt ?? null,
    row.model ?? null,
    row.provider ?? null,
    row.image_size ?? null,
    row.style ?? null,
    row.seed ?? null,
    row.duration_ms ?? null,
    row.duration_secs ?? null,
    row.cover_url ?? null,
    row.message_text ?? null,
    row.created_at,
    row.expires_at ?? null,
  );
}

/**
 * 批量插入（事务包裹，性能更好）。
 */
export function insertMediaAssets(rows: MediaAssetRow[]): void {
  if (rows.length === 0) return;
  const db = openMediaDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO ${TABLE} (
      id, session_key, type, file, url, mime_type, size_bytes, source,
      prompt, revised_prompt, model, provider, image_size, style, seed,
      duration_ms, duration_secs, cover_url, message_text, created_at, expires_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `);
  db.exec("BEGIN");
  try {
    for (const row of rows) {
      stmt.run(
        row.id,
        row.session_key,
        row.type,
        row.file,
        row.url,
        row.mime_type ?? null,
        row.size_bytes ?? null,
        row.source,
        row.prompt ?? null,
        row.revised_prompt ?? null,
        row.model ?? null,
        row.provider ?? null,
        row.image_size ?? null,
        row.style ?? null,
        row.seed ?? null,
        row.duration_ms ?? null,
        row.duration_secs ?? null,
        row.cover_url ?? null,
        row.message_text ?? null,
        row.created_at,
        row.expires_at ?? null,
      );
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/**
 * 查询指定 session 下的所有媒体资源，按创建时间倒序。
 */
export function queryBySession(sessionKey: string): MediaAssetRow[] {
  const db = openMediaDb();
  const stmt = db.prepare(`SELECT * FROM ${TABLE} WHERE session_key = ? ORDER BY created_at DESC`);
  return stmt.all(sessionKey) as unknown as MediaAssetRow[];
}

/**
 * 按 ID 查询单条记录。
 */
export function queryById(id: string): MediaAssetRow | null {
  const db = openMediaDb();
  const stmt = db.prepare(`SELECT * FROM ${TABLE} WHERE id = ?`);
  return (stmt.get(id) as unknown as MediaAssetRow | undefined) ?? null;
}

/**
 * 按 ID 数组批量查询。
 */
export function queryByIds(ids: string[]): MediaAssetRow[] {
  if (ids.length === 0) return [];
  const db = openMediaDb();
  // 使用 IN 子句 + 参数占位符
  const placeholders = ids.map(() => "?").join(",");
  const stmt = db.prepare(
    `SELECT * FROM ${TABLE} WHERE id IN (${placeholders}) ORDER BY created_at DESC`,
  );
  return stmt.all(...ids) as unknown as MediaAssetRow[];
}

// ---------------------------------------------------------------------------
// Delete operations
// ---------------------------------------------------------------------------

/**
 * 删除指定 session 的所有媒体记录。
 */
export function deleteBySession(sessionKey: string): number {
  const db = openMediaDb();
  const stmt = db.prepare(`DELETE FROM ${TABLE} WHERE session_key = ?`);
  const result = stmt.run(sessionKey);
  return Number(result.changes);
}

/**
 * 删除所有已过期记录（expires_at < 当前时间）。
 */
export function deleteExpired(): number {
  const db = openMediaDb();
  const stmt = db.prepare(`DELETE FROM ${TABLE} WHERE expires_at IS NOT NULL AND expires_at < ?`);
  const result = stmt.run(new Date().toISOString());
  return Number(result.changes);
}

/**
 * 获取表中总记录数（诊断用）。
 */
export function countAll(): number {
  const db = openMediaDb();
  const stmt = db.prepare(`SELECT COUNT(*) as cnt FROM ${TABLE}`);
  const row = stmt.get() as { cnt: number } | undefined;
  return row?.cnt ?? 0;
}

/** 条数上限 — 超过此数时删除最老的记录。 */
const MAX_MEDIA_ROWS = 1000;

/**
 * 强制条数上限：超过 MAX_MEDIA_ROWS 时删除最老的记录。
 * @returns 实际删除的条数
 */
export function capMediaRows(maxRows = MAX_MEDIA_ROWS): number {
  const total = countAll();
  if (total <= maxRows) return 0;
  const excess = total - maxRows;
  const db = openMediaDb();
  // 按创建时间正序取最老的 excess 条的 id，然后删除
  const stmt = db.prepare(
    `DELETE FROM ${TABLE} WHERE id IN (
       SELECT id FROM ${TABLE} ORDER BY created_at ASC LIMIT ?
     )`,
  );
  const result = stmt.run(excess);
  return Number(result.changes);
}

/**
 * 定期维护入口 — 删除过期 + 条数上限 + 回收磁盘空间。
 * 供 server-maintenance 每日调用。
 */
export function runMediaDbMaintenance(): { expired: number; capped: number } {
  try {
    const expired = deleteExpired();
    const capped = capMediaRows();
    // 有删除操作时，执行 incremental vacuum 回收磁盘空间，防止表膨胀
    if (expired > 0 || capped > 0) {
      try {
        const db = openMediaDb();
        db.exec("PRAGMA incremental_vacuum");
      } catch {
        // non-fatal
      }
    }
    return { expired, capped };
  } catch {
    return { expired: 0, capped: 0 };
  }
}

// ---------------------------------------------------------------------------
// Migration: manifest → SQLite
// ---------------------------------------------------------------------------

const DEFAULT_IMAGE_RETENTION_DAYS = 7;
const GENERATED_IMAGE_RETENTION_DAYS = 30;
const VIDEO_RETENTION_DAYS = 365;

/**
 * 将已有的 _manifest.json 数据迁移到 SQLite。
 * 仅在 SQLite 表为空时执行（首次迁移）。
 * 异步执行，不阻塞主流程。
 */
export async function migrateManifestsToSqlite(): Promise<{
  images: number;
  videos: number;
}> {
  // Skip if already has data
  if (countAll() > 0) return { images: 0, videos: 0 };

  const { readdir, readFile, stat } = await import("node:fs/promises");
  const pathMod = await import("node:path");
  const configDir = resolveConfigDir();

  const rows: MediaAssetRow[] = [];
  let imageCount = 0;
  let videoCount = 0;

  // --- Migrate images ---
  const imagesRoot = pathMod.join(configDir, "media", "chat-images");
  try {
    const sessionDirs = await readdir(imagesRoot);
    for (const dirName of sessionDirs) {
      const dirPath = pathMod.join(imagesRoot, dirName);
      const dirStat = await stat(dirPath).catch(() => null);
      if (!dirStat?.isDirectory()) continue;

      try {
        const raw = await readFile(pathMod.join(dirPath, "_manifest.json"), "utf8");
        const manifest = JSON.parse(raw);
        if (!manifest || !Array.isArray(manifest.images)) continue;

        for (const img of manifest.images) {
          const source = img.source ?? "upload";
          const retentionDays =
            source === "generated" ? GENERATED_IMAGE_RETENTION_DAYS : DEFAULT_IMAGE_RETENTION_DAYS;
          const createdAt = img.createdAt ?? new Date().toISOString();

          rows.push({
            id: img.id,
            session_key: dirName,
            type: "image",
            file: img.file,
            url: `/api/media/chat-images/${dirName}/${img.file}`,
            mime_type: img.mimeType ?? null,
            size_bytes: img.sizeBytes ?? null,
            source,
            prompt: img.generationMeta?.prompt ?? null,
            revised_prompt: img.generationMeta?.revisedPrompt ?? null,
            model: img.generationMeta?.model ?? null,
            provider: img.generationMeta?.provider ?? null,
            image_size: img.generationMeta?.size ?? null,
            style: img.generationMeta?.style ?? null,
            seed: img.generationMeta?.seed ?? null,
            duration_ms: img.generationMeta?.durationMs ?? null,
            duration_secs: null,
            cover_url: null,
            message_text: img.messageText ?? null,
            created_at: createdAt,
            expires_at: new Date(
              new Date(createdAt).getTime() + retentionDays * 86400000,
            ).toISOString(),
          });
          imageCount++;
        }
      } catch {
        // Skip corrupt manifests
      }
    }
  } catch {
    // Images root doesn't exist yet — skip
  }

  // --- Migrate videos ---
  const videosRoot = pathMod.join(configDir, "media", "chat-videos");
  try {
    const sessionDirs = await readdir(videosRoot);
    for (const dirName of sessionDirs) {
      const dirPath = pathMod.join(videosRoot, dirName);
      const dirStat = await stat(dirPath).catch(() => null);
      if (!dirStat?.isDirectory()) continue;

      try {
        const raw = await readFile(pathMod.join(dirPath, "_manifest.json"), "utf8");
        const manifest = JSON.parse(raw);
        if (!manifest || !Array.isArray(manifest.videos)) continue;

        for (const vid of manifest.videos) {
          const createdAt = vid.createdAt ?? new Date().toISOString();

          rows.push({
            id: vid.id,
            session_key: dirName,
            type: "video",
            file: vid.file,
            url: `/api/media/videos/${dirName}/${vid.file}`,
            mime_type: vid.mimeType ?? "video/mp4",
            size_bytes: vid.sizeBytes ?? null,
            source: "generated",
            prompt: vid.generationMeta?.prompt ?? null,
            revised_prompt: null,
            model: vid.generationMeta?.model ?? null,
            provider: vid.generationMeta?.provider ?? null,
            image_size: vid.generationMeta?.size ?? null,
            style: null,
            seed: null,
            duration_ms: null,
            duration_secs: vid.generationMeta?.durationSeconds ?? null,
            cover_url: vid.generationMeta?.coverImageUrl ?? null,
            message_text: vid.messageText ?? null,
            created_at: createdAt,
            expires_at: new Date(
              new Date(createdAt).getTime() + VIDEO_RETENTION_DAYS * 86400000,
            ).toISOString(),
          });
          videoCount++;
        }
      } catch {
        // Skip corrupt manifests
      }
    }
  } catch {
    // Videos root doesn't exist yet — skip
  }

  // Batch insert all migrated rows
  if (rows.length > 0) {
    insertMediaAssets(rows);
  }

  return { images: imageCount, videos: videoCount };
}
