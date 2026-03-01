/**
 * [CN-PATCH:tool-discovery] Tool Index — SQLite FTS5 + sqlite-vec 混合检索引擎
 *
 * 职责：
 *   1. 管理 tool-index.sqlite 的生命周期
 *   2. 构建 FTS5（BM25）+ 向量双索引
 *   3. 提供 hybridSearch() 混合检索
 *   4. 增量更新（skills/MCP 变更时）
 *   5. 首次启动自动向量化（独立 embedding client）
 *
 * 隔离原则：
 *   - 独立 SQLite 文件（tool-index.sqlite），不碰 memory.sqlite
 *   - 独立 embedding client（fetch 调 OpenAI 兼容 API），不复用 Memory 的 EmbeddingProvider
 *   - 仅 import node:sqlite / sqlite-vec 底层包，不 import src/memory/ 任何模块
 */

import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { requireNodeSqlite } from "../memory/sqlite.js";
import { runDbMigrations, type DbMigration } from "../db/migrate.js";
import type {
  ToolDiscoveryEmbeddingConfig,
  ToolIndexEntry,
  ToolSearchResult,
} from "../config/types.tool-discovery.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_FILENAME = "tool-index.sqlite";
const FTS_TABLE = "tools_fts";
const VEC_TABLE = "tools_vec";
const TOOLS_TABLE = "tools";
const META_TABLE = "tool_meta";

/** RRF 融合常数 k（标准值 60，来自 Cormack et al. 2009）。 */
const RRF_K = 60;

/** 英文停用词（FTS 搜索时过滤，避免高频词污染排名）。 */
const ENGLISH_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "had",
  "her",
  "was",
  "one",
  "our",
  "out",
  "has",
  "have",
  "been",
  "from",
  "this",
  "that",
  "with",
  "will",
  "each",
  "make",
  "how",
  "use",
  "into",
  "than",
  "them",
  "then",
  "what",
  "when",
  "who",
  "which",
  "their",
  "about",
  "would",
]);

// ---------------------------------------------------------------------------
// Module state (singleton per process)
// ---------------------------------------------------------------------------

let _db: DatabaseSync | null = null;
let _dbPath: string | null = null;
let _vecReady = false;
let _vecDims = 0;

// ---------------------------------------------------------------------------
// DB Lifecycle
// ---------------------------------------------------------------------------

/**
 * 打开（或创建）tool-index.sqlite。
 * 返回 DatabaseSync 实例，重复调用返回缓存连接。
 */
export function openToolIndex(dataDir: string): DatabaseSync {
  const newDbPath = join(dataDir, DB_FILENAME);

  // FIX: 如果路径变化，先关闭旧连接 (防止 DB 连接泄漏)
  if (_db && _dbPath && _dbPath !== newDbPath) {
    try {
      _db.close();
    } catch {
      /* ignore close error */
    }
    _db = null;
    _dbPath = null;
    _vecReady = false;
    _vecDims = 0;
  }

  if (_db && _dbPath === newDbPath) {
    return _db;
  }

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const sqlite = requireNodeSqlite();
  _db = new sqlite.DatabaseSync(newDbPath, { allowExtension: true } as any);
  _dbPath = newDbPath;
  _db.exec("PRAGMA journal_mode=WAL");
  _db.exec("PRAGMA synchronous=NORMAL");
  ensureSchema(_db);
  return _db;
}

/**
 * 关闭 DB 连接。
 */
export function closeToolIndex(): void {
  if (_db) {
    try {
      _db.close();
    } catch {
      /* ignore */
    }
    _db = null;
    _dbPath = null;
    _vecReady = false;
    _vecDims = 0;
  }
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const TOOL_INDEX_MIGRATIONS: DbMigration[] = [
  {
    version: 1,
    label: "tools + tool_meta + FTS5",
    noTransaction: true,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ${TOOLS_TABLE} (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          description_cn TEXT NOT NULL DEFAULT '',
          tags TEXT NOT NULL DEFAULT '',
          metadata_json TEXT NOT NULL DEFAULT '{}'
        );
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS ${META_TABLE} (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
      // FTS5 with trigram tokenizer (CJK support)
      try {
        db.exec(
          `CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE} USING fts5(\n` +
            `  name,\n` +
            `  description,\n` +
            `  description_cn,\n` +
            `  tags,\n` +
            `  id UNINDEXED,\n` +
            `  type UNINDEXED,\n` +
            `  tokenize='trigram'\n` +
            `);`,
        );
      } catch {
        // FTS5 trigram unavailable — fall back to unicode61
        try {
          db.exec(
            `CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE} USING fts5(\n` +
              `  name,\n` +
              `  description,\n` +
              `  description_cn,\n` +
              `  tags,\n` +
              `  id UNINDEXED,\n` +
              `  type UNINDEXED\n` +
              `);`,
          );
        } catch {
          /* FTS5 completely unavailable */
        }
      }
    },
  },
];

function ensureSchema(db: DatabaseSync): void {
  runDbMigrations(db, TOOL_INDEX_MIGRATIONS);
}

// ---------------------------------------------------------------------------
// Vec extension loading (lazy)
// ---------------------------------------------------------------------------

async function ensureVecTable(db: DatabaseSync, dims: number): Promise<boolean> {
  if (_vecReady && _vecDims === dims) return true;
  try {
    const { loadSqliteVecExtension } = await import("../memory/sqlite-vec.js");
    const result = await loadSqliteVecExtension({ db });
    if (!result.ok) return false;
    if (_vecDims && _vecDims !== dims) {
      db.exec(`DROP TABLE IF EXISTS ${VEC_TABLE}`);
    }
    db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS ${VEC_TABLE} USING vec0(\n` +
        `  id TEXT PRIMARY KEY,\n` +
        `  embedding FLOAT[${dims}]\n` +
        `)`,
    );
    _vecReady = true;
    _vecDims = dims;
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Index Building
// ---------------------------------------------------------------------------

/**
 * 全量构建 FTS5 索引。
 * 输入为统一的 ToolIndexEntry[]，由外部从 skills/MCP/core tools 收集。
 */
export function buildIndex(db: DatabaseSync, entries: ToolIndexEntry[]): void {
  db.exec("BEGIN");
  try {
    // 清空旧数据
    db.exec(`DELETE FROM ${TOOLS_TABLE}`);
    safeExec(db, `DELETE FROM ${FTS_TABLE}`);
    safeExec(db, `DELETE FROM ${VEC_TABLE}`);

    const insertTool = db.prepare(
      `INSERT OR REPLACE INTO ${TOOLS_TABLE} (id, type, name, description, description_cn, tags, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    // FTS insert — may fail if FTS5 not available
    let insertFts: ReturnType<DatabaseSync["prepare"]> | null = null;
    try {
      insertFts = db.prepare(
        `INSERT INTO ${FTS_TABLE} (id, type, name, description, description_cn, tags)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
    } catch {
      /* FTS not available */
    }

    for (const e of entries) {
      const tagsStr = e.tags.join(", ");
      insertTool.run(
        e.id,
        e.type,
        e.name,
        e.description,
        e.descriptionCn ?? "",
        tagsStr,
        e.metadataJson ?? "{}",
      );
      insertFts?.run(e.id, e.type, e.name, e.description, e.descriptionCn ?? "", tagsStr);
    }

    // 更新元数据
    const now = Date.now();
    upsertMeta(db, "version", "1");
    upsertMeta(db, "entry_count", String(entries.length));
    upsertMeta(db, "built_at", String(now));

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/**
 * 增量更新：添加/移除工具条目。
 */
export function incrementalUpdate(
  db: DatabaseSync,
  added: ToolIndexEntry[],
  removedIds: string[],
): void {
  db.exec("BEGIN");
  try {
    // 删除 — FTS5 虚拟表不支持 WHERE id IN (...)，需逐行 DELETE
    if (removedIds.length > 0) {
      const placeholders = removedIds.map(() => "?").join(",");
      db.prepare(`DELETE FROM ${TOOLS_TABLE} WHERE id IN (${placeholders})`).run(...removedIds);
      // FTS5: UNINDEXED 列不能用 IN 查询，逐行删除
      for (const rid of removedIds) {
        safeExec(db, `DELETE FROM ${FTS_TABLE} WHERE id = ?`, [rid]);
      }
      safeExec(db, `DELETE FROM ${VEC_TABLE} WHERE id IN (${placeholders})`, removedIds);
    }

    // 添加 — FTS5 无 PRIMARY KEY，INSERT OR REPLACE 会导致重复行
    // 安全模式：先删旧 FTS 行，再 INSERT
    const insertTool = db.prepare(
      `INSERT OR REPLACE INTO ${TOOLS_TABLE} (id, type, name, description, description_cn, tags, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    let deleteFts: ReturnType<DatabaseSync["prepare"]> | null = null;
    let insertFts: ReturnType<DatabaseSync["prepare"]> | null = null;
    try {
      deleteFts = db.prepare(`DELETE FROM ${FTS_TABLE} WHERE id = ?`);
      insertFts = db.prepare(
        `INSERT INTO ${FTS_TABLE} (id, type, name, description, description_cn, tags)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
    } catch {
      /* FTS not available */
    }

    for (const e of added) {
      const tagsStr = e.tags.join(", ");
      insertTool.run(
        e.id,
        e.type,
        e.name,
        e.description,
        e.descriptionCn ?? "",
        tagsStr,
        e.metadataJson ?? "{}",
      );
      // FTS5: 先删后插，避免重复行
      deleteFts?.run(e.id);
      insertFts?.run(e.id, e.type, e.name, e.description, e.descriptionCn ?? "", tagsStr);
    }

    // 更新 entry count
    const count = (
      db.prepare(`SELECT count(*) AS cnt FROM ${TOOLS_TABLE}`).get() as { cnt: number }
    ).cnt;
    upsertMeta(db, "entry_count", String(count));
    upsertMeta(db, "updated_at", String(Date.now()));

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Search: FTS5 BM25 + LIKE fallback
// ---------------------------------------------------------------------------

function searchFts(
  db: DatabaseSync,
  query: string,
  limit: number,
): Array<{ id: string; rank: number }> {
  const results: Array<{ id: string; rank: number }> = [];
  const seen = new Set<string>();

  // 1) FTS5 trigram MATCH
  const ftsQuery = buildFtsQuery(query);
  if (ftsQuery) {
    try {
      const ftsRows = db
        .prepare(
          `SELECT id, bm25(${FTS_TABLE}) AS rank
           FROM ${FTS_TABLE}
           WHERE ${FTS_TABLE} MATCH ?
           ORDER BY rank ASC
           LIMIT ?`,
        )
        .all(ftsQuery, limit) as Array<{ id: string; rank: number }>;
      for (const r of ftsRows) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          results.push(r);
        }
      }
    } catch {
      /* FTS query error */
    }
  }

  // 2) LIKE fallback — 对 FTS5 trigram 无法命中的短关键词（<3 CJK 字符）做模糊补全
  // FIX P1#7: 当 FTS 完全无结果时（常见于 2 字 CJK 查询如"天气"），
  // LIKE 结果需要有区分度的 rank（name 匹配 > description 匹配），
  // 否则 RRF 融合无法区分它们。
  if (results.length < limit) {
    const likeTerms = extractLikeTerms(query);
    if (likeTerms.length > 0) {
      const esc = "ESCAPE '\\'";
      // 构建带优先级的查询：name 匹配排在前面
      const conditions = likeTerms
        .map(
          () =>
            `(name LIKE ? ${esc} OR description LIKE ? ${esc} OR description_cn LIKE ? ${esc} OR tags LIKE ? ${esc})`,
        )
        .join(" OR ");
      // name 匹配优先级列：匹配 name 的排前面
      const nameConditions = likeTerms.map(() => `(name LIKE ? ${esc})`).join(" OR ");
      const params: string[] = [];
      const nameParams: string[] = [];
      for (const term of likeTerms) {
        // 显式转义 LIKE 通配符（防御性编程，extractLikeTerms 已清理但不依赖该假设）
        const safeTerm = term.replace(/[%_\\]/g, "\\$&");
        const pattern = `%${safeTerm}%`;
        params.push(pattern, pattern, pattern, pattern);
        nameParams.push(pattern);
      }
      try {
        const likeRows = db
          .prepare(
            `SELECT id, -(CASE WHEN (${nameConditions}) THEN 2.0 ELSE 1.0 END) AS rank
             FROM ${TOOLS_TABLE}
             WHERE ${conditions}
             ORDER BY rank ASC
             LIMIT ?`,
          )
          .all(...nameParams, ...params, limit - results.length) as Array<{
          id: string;
          rank: number;
        }>;
        for (const r of likeRows) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            results.push(r);
          }
        }
      } catch {
        /* LIKE query error */
      }
    }
  }

  return results;
}

/**
 * 提取 LIKE 搜索关键词：
 *   - CJK 连续 ≥2 字符按 2 字滑窗拆分（FTS trigram 无法匹配 <3 字符 CJK，LIKE 补位）
 *   - 英文 ≥3 字符
 */
function extractLikeTerms(raw: string): string[] {
  const cleaned = raw.replace(/['"{}()\[\]*?%_]/g, " ").trim();
  const terms: string[] = [];

  // CJK 块按 2 字滑窗拆分
  const cjkBlocks = cleaned.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g) || [];
  for (const block of cjkBlocks) {
    const chars = [...block];
    // 每 2 字一组（覆盖 FTS trigram 的盲区）
    for (let i = 0; i < chars.length - 1; i++) {
      terms.push(chars[i] + chars[i + 1]);
    }
  }

  // 英文单词（≥3 字符）
  const ascii = cleaned
    .replace(/[^a-zA-Z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  terms.push(...ascii);

  return [...new Set(terms)].slice(0, 10);
}

/**
 * 构建 FTS5 查询字符串。
 *
 * trigram tokenizer 策略：
 *   - trigram 最小匹配单元 = 3 个字符（含 CJK 字符）
 *   - CJK 连续字符按 3 字滑窗提取（双引号包裹 = 精确子串匹配）
 *   - 英文单词 ≥3 字符直接搜索
 *   - 多个子串用 OR 连接
 */
function buildFtsQuery(raw: string): string | null {
  const cleaned = raw.replace(/['"{}()\[\]]/g, " ").trim();
  if (cleaned.length < 2) return null;

  const terms: string[] = [];

  // 提取 CJK 连续字符块，每块按 3 字滑窗
  const cjkBlocks = cleaned.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g) || [];
  for (const block of cjkBlocks) {
    const chars = [...block]; // 正确处理 Unicode
    if (chars.length >= 3) {
      // 3 字滑窗
      for (let i = 0; i <= chars.length - 3; i++) {
        terms.push(chars[i] + chars[i + 1] + chars[i + 2]);
      }
    } else if (chars.length === 2) {
      // 2 字不够组 trigram → 不加引号的原文（FTS5 trigram 内部会处理）
      // 但 trigram 实际无法匹配 <3 字符，跳过
    }
    // 整个 CJK 块如果 ≥3 字符也作为一个完整子串
    if (chars.length >= 4) {
      terms.push(block);
    }
  }

  // 提取英文单词（≥3 字符，过滤停用词）
  const ascii = cleaned
    .replace(/[^a-zA-Z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !ENGLISH_STOPWORDS.has(w.toLowerCase()));
  terms.push(...ascii);

  // 去重
  const unique = [...new Set(terms)].slice(0, 20);
  if (unique.length === 0) return null;

  // 每个用双引号包裹，OR 连接
  // FIX: 转义双引号 (FTS5 规则: " → "")
  return unique.map((t) => `"${escapeFtsToken(t)}"`).join(" OR ");
}

/**
 * 转义 FTS5 特殊字符。
 * FTS5 规则: 双引号需转义为两个双引号 ("" 表示字面 ")
 */
function escapeFtsToken(term: string): string {
  return term.replace(/"/g, '""');
}

// ---------------------------------------------------------------------------
// Search: Vector (sqlite-vec)
// ---------------------------------------------------------------------------

async function searchVec(
  db: DatabaseSync,
  queryVec: number[],
  limit: number,
): Promise<Array<{ id: string; dist: number }>> {
  if (queryVec.length === 0) return [];
  const ready = await ensureVecTable(db, queryVec.length);
  if (!ready) return [];
  try {
    const blob = Buffer.from(new Float32Array(queryVec).buffer);
    return db
      .prepare(
        `SELECT id, vec_distance_cosine(embedding, ?) AS dist
         FROM ${VEC_TABLE}
         ORDER BY dist ASC
         LIMIT ?`,
      )
      .all(blob, limit) as Array<{ id: string; dist: number }>;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Hybrid Search (FTS5 + Vec + RRF fusion)
// ---------------------------------------------------------------------------

export type HybridSearchOptions = {
  maxResults?: number;
  minScore?: number;
  hybridWeight?: { fts?: number; vector?: number };
  queryVec?: number[];
};

/**
 * 混合检索：FTS5 BM25 + sqlite-vec 向量 + RRF 融合。
 * 无向量时自动降级为纯 FTS5。
 */
export async function hybridSearch(
  db: DatabaseSync,
  query: string,
  opts?: HybridSearchOptions,
): Promise<ToolSearchResult[]> {
  // FIX: 验证查询输入
  if (!query || query.trim().length === 0) {
    console.debug("[tool-index] Empty query, returning empty results");
    return [];
  }

  const maxResults = opts?.maxResults ?? 50;
  const minScore = opts?.minScore ?? 0.1;
  const ftsWeight = opts?.hybridWeight?.fts ?? 0.4;
  const vecWeight = opts?.hybridWeight?.vector ?? 0.6;
  const candidates = maxResults * 2; // 每路取 2x 候选

  // 并行搜索
  const ftsResults = searchFts(db, query, candidates);
  const vecResults = opts?.queryVec ? await searchVec(db, opts.queryVec, candidates) : [];

  // RRF 融合
  const scoreMap = new Map<
    string,
    { ftsRank: number; vecRank: number; source: "fts" | "vector" | "both" }
  >();

  ftsResults.forEach((r, i) => {
    scoreMap.set(r.id, { ftsRank: i + 1, vecRank: 0, source: "fts" });
  });

  vecResults.forEach((r, i) => {
    const existing = scoreMap.get(r.id);
    if (existing) {
      existing.vecRank = i + 1;
      existing.source = "both";
    } else {
      scoreMap.set(r.id, { ftsRank: 0, vecRank: i + 1, source: "vector" });
    }
  });

  // FIX: 提前检查空结果
  if (scoreMap.size === 0) {
    console.debug("[tool-index] No search results from FTS or vector");
    return [];
  }

  // 计算 RRF score
  const scored: Array<{ id: string; score: number; source: "fts" | "vector" | "both" }> = [];
  // FIX P1#4: 按每个条目实际参与的搜索路径归一化，而非全局固定值。
  // 这确保了纯 FTS 命中的条目在有/无向量时 score 含义一致。
  // 全局 theoreticalMax 仅作为没有向量搜索路径时的 fallback。
  const hasBothPaths = ftsResults.length > 0 && vecResults.length > 0;
  const ftsOnlyMax = ftsWeight / (RRF_K + 1);
  const vecOnlyMax = vecWeight / (RRF_K + 1);
  const bothMax = ftsOnlyMax + vecOnlyMax;

  for (const [id, ranks] of scoreMap) {
    let rawScore = 0;
    if (ranks.ftsRank > 0) rawScore += ftsWeight / (RRF_K + ranks.ftsRank);
    if (ranks.vecRank > 0) rawScore += vecWeight / (RRF_K + ranks.vecRank);

    // 归一化：根据该条目实际能达到的最大分来归一化
    let entryMax: number;
    if (hasBothPaths) {
      // 两条路径都有结果时，对同时命中的条目用 bothMax，
      // 对只命中单路径的条目也用 bothMax（保留跨路径加分优势）
      entryMax = bothMax;
    } else {
      // 只有一条路径有结果时，用该路径的 max
      entryMax = ranks.ftsRank > 0 ? ftsOnlyMax : vecOnlyMax;
    }

    scored.push({
      id,
      score: entryMax > 0 ? rawScore / entryMax : 0,
      source: ranks.source,
    });
  }

  // 排序 + 过滤 + 截断
  scored.sort((a, b) => b.score - a.score);
  const filtered = scored.filter((s) => s.score >= minScore).slice(0, maxResults);

  // 加载完整条目
  if (filtered.length === 0) return [];
  const ids = filtered.map((s) => s.id);
  const entryMap = loadEntries(db, ids);

  return filtered
    .map((s) => {
      const entry = entryMap.get(s.id);
      if (!entry) return null;
      return { entry, score: s.score, matchSource: s.source } as ToolSearchResult;
    })
    .filter(Boolean) as ToolSearchResult[];
}

// ---------------------------------------------------------------------------
// Entry Loading
// ---------------------------------------------------------------------------

function loadEntries(db: DatabaseSync, ids: string[]): Map<string, ToolIndexEntry> {
  if (ids.length === 0) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT id, type, name, description, description_cn, tags, metadata_json
       FROM ${TOOLS_TABLE}
       WHERE id IN (${placeholders})`,
    )
    .all(...ids) as Array<{
    id: string;
    type: string;
    name: string;
    description: string;
    description_cn: string;
    tags: string;
    metadata_json: string;
  }>;

  const map = new Map<string, ToolIndexEntry>();
  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      type: row.type as ToolIndexEntry["type"],
      name: row.name,
      description: row.description,
      descriptionCn: row.description_cn || undefined,
      tags: row.tags ? row.tags.split(", ").filter(Boolean) : [],
      metadataJson: row.metadata_json,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Vectorization (独立 embedding client，不复用 Memory)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Query Embedding LRU Cache
// ---------------------------------------------------------------------------

/** 查询向量 LRU 缓存 — 相同查询文本 + 相同模型 = 相同向量，无需重复调 API */
const QUERY_VEC_CACHE_MAX = 256;
const _queryVecCache = new Map<string, { vec: number[]; ts: number }>();

function getCachedQueryVec(text: string, model: string): number[] | undefined {
  const key = `${model}\0${text}`;
  const entry = _queryVecCache.get(key);
  if (entry) {
    // LRU: 刷新时间戳
    entry.ts = Date.now();
    return entry.vec;
  }
  return undefined;
}

function setCachedQueryVec(text: string, model: string, vec: number[]): void {
  const key = `${model}\0${text}`;
  _queryVecCache.set(key, { vec, ts: Date.now() });
  // LRU 淘汰：超过上限时删除最旧的
  if (_queryVecCache.size > QUERY_VEC_CACHE_MAX) {
    let oldestKey: string | null = null;
    let oldestTs = Infinity;
    for (const [k, v] of _queryVecCache) {
      if (v.ts < oldestTs) {
        oldestTs = v.ts;
        oldestKey = k;
      }
    }
    if (oldestKey) _queryVecCache.delete(oldestKey);
  }
}

// ---------------------------------------------------------------------------
// Embedding Client
// ---------------------------------------------------------------------------

/**
 * 免费 ↔ 收费 自动故障转移 + 活性探测。
 *
 * 流程：
 *   1. 正常使用免费 BAAI/bge-m3
 *   2. 连续失败 3 次 → 自动切到 Pro/BAAI/bge-m3（收费），立刻重试当前请求
 *   3. 切到 Pro 后启动活性探测定时器，每 5 分钟用一条轻量文本探测免费模型
 *   4. 免费模型恢复 → 自动切回，停止探测定时器
 *
 * 模块级别共享 — 同一进程内所有 client 实例共用状态。
 */
const FREE_MODEL = "BAAI/bge-m3";
const PRO_MODEL = "Pro/BAAI/bge-m3";
const FALLBACK_FAILURE_THRESHOLD = 3;
/** 活性探测间隔（ms）：5 分钟 */
const PROBE_INTERVAL_MS = 5 * 60 * 1000;
/** 活性探测超时（ms） */
const PROBE_TIMEOUT_MS = 8000;
/** 探测用的轻量文本 */
const PROBE_TEXT = "health check";

let _freeModelFailureCount = 0;
let _fallbackToPro = false;
/** 活性探测定时器句柄 */
let _probeTimer: ReturnType<typeof setInterval> | null = null;
/** 最近一次用于探测的 baseUrl + apiKey（启动探测时快照） */
let _probeBaseUrl = "";
let _probeApiKey = "";

/** 外部可查询：当前是否已从免费版切换到收费版 */
export function isEmbeddingFallenBackToPro(): boolean {
  return _fallbackToPro;
}

/**
 * 向免费模型发一条轻量 embedding 请求，成功则切回免费版。
 * 后台静默执行，不影响业务请求。
 */
async function probeFreeModel(): Promise<void> {
  if (!_fallbackToPro || !_probeApiKey) return;

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const resp = await fetch(`${_probeBaseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${_probeApiKey}`,
      },
      body: JSON.stringify({ model: FREE_MODEL, input: [PROBE_TEXT] }),
      signal: controller.signal,
    });
    clearTimeout(tid);

    if (resp.ok) {
      // 免费模型恢复了 → 切回
      _fallbackToPro = false;
      _freeModelFailureCount = 0;
      stopProbeTimer();
      console.info(`[tool-index] 活性探测成功：免费嵌入模型 ${FREE_MODEL} 已恢复，自动切回`);
    }
  } catch {
    clearTimeout(tid);
    // 探测失败 → 继续使用 Pro，下一轮再探
  }
}

/** 启动活性探测定时器（幂等：已运行时不会重复启动） */
function startProbeTimer(baseUrl: string, apiKey: string): void {
  if (_probeTimer) return; // 已在运行
  _probeBaseUrl = baseUrl;
  _probeApiKey = apiKey;
  _probeTimer = setInterval(() => {
    probeFreeModel().catch(() => {
      /* 静默 */
    });
  }, PROBE_INTERVAL_MS);
  // 不阻止进程退出
  if (_probeTimer && typeof _probeTimer === "object" && "unref" in _probeTimer) {
    (_probeTimer as { unref: () => void }).unref();
  }
}

/** 停止活性探测定时器 */
function stopProbeTimer(): void {
  if (_probeTimer) {
    clearInterval(_probeTimer);
    _probeTimer = null;
  }
}

/**
 * 创建独立的 embedding client（OpenAI 兼容协议）。
 * 内置查询向量 LRU 缓存 — 相同文本不会重复调 API。
 * 与 Memory 的 EmbeddingProvider 完全隔离。
 *
 * 当配置模型为 BAAI/bge-m3（免费）时，连续失败 3 次后
 * 自动切换到 Pro/BAAI/bge-m3（收费），维度不变（均为 1024）。
 * 切换后启动后台活性探测，免费模型恢复时自动切回。
 */
export function createToolEmbeddingClient(config: ToolDiscoveryEmbeddingConfig): {
  embed: (texts: string[]) => Promise<number[][]>;
  model: string;
  dims: number;
} {
  const configModel = config.model ?? FREE_MODEL;
  const baseUrl = (config.baseUrl ?? "https://api.siliconflow.cn/v1").replace(/\/$/, "");
  const apiKey = config.apiKey ?? "";
  const dims = config.dimensions ?? 1024;
  const timeout = config.timeout ?? 15000;

  /** 获取当前应该使用的模型（实时读取 _fallbackToPro） */
  function resolveActiveModel(): string {
    return configModel === FREE_MODEL && _fallbackToPro ? PRO_MODEL : configModel;
  }

  async function embedWithModel(texts: string[], useModel: string): Promise<number[][]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const resp = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: useModel, input: texts }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Embedding API error ${resp.status}: ${text.slice(0, 200)}`);
      }

      const json = (await resp.json()) as { data: Array<{ embedding: number[] }> };
      return json.data.map((d) => d.embedding);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Embedding API timeout after ${timeout}ms`);
      }
      throw err;
    }
  }

  async function embed(texts: string[]): Promise<number[][]> {
    if (!apiKey) throw new Error("Tool discovery embedding apiKey not configured");

    // 查缓存：分离已缓存和需要调 API 的文本
    const results: (number[] | null)[] = texts.map(() => null);
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    // 当前实际使用的模型（每次调用实时判断，探测恢复后立即生效）
    const activeModel = resolveActiveModel();

    for (let i = 0; i < texts.length; i++) {
      const cached = getCachedQueryVec(texts[i], activeModel);
      if (cached) {
        results[i] = cached;
      } else {
        uncachedIndices.push(i);
        uncachedTexts.push(texts[i]);
      }
    }

    // 全部命中缓存 → 直接返回
    if (uncachedTexts.length === 0) {
      return results as number[][];
    }

    // 调 API 获取未缓存的向量
    let embeddings: number[][];
    try {
      embeddings = await embedWithModel(uncachedTexts, activeModel);
      // 成功 → 重置失败计数（仅当使用免费模型时）
      if (activeModel === FREE_MODEL) {
        _freeModelFailureCount = 0;
      }
    } catch (err) {
      // 仅对免费模型计数失败次数
      if (activeModel === FREE_MODEL && configModel === FREE_MODEL) {
        _freeModelFailureCount++;
        if (_freeModelFailureCount >= FALLBACK_FAILURE_THRESHOLD) {
          _fallbackToPro = true;
          console.warn(
            `[tool-index] 免费嵌入模型 ${FREE_MODEL} 连续失败 ${_freeModelFailureCount} 次，` +
              `自动切换到收费版 ${PRO_MODEL}，启动活性探测`,
          );
          // 启动后台探测定时器
          startProbeTimer(baseUrl, apiKey);
          // 立刻用收费模型重试当前请求
          try {
            embeddings = await embedWithModel(uncachedTexts, PRO_MODEL);
          } catch (proErr) {
            // 收费版也失败 → 抛出原始错误
            throw err;
          }
          // Pro 成功 → 写入缓存并返回
          for (let i = 0; i < uncachedIndices.length; i++) {
            const vec = embeddings![i];
            if (vec) {
              const origIdx = uncachedIndices[i];
              results[origIdx] = vec;
              setCachedQueryVec(uncachedTexts[i], PRO_MODEL, vec);
            }
          }
          return results as number[][];
        }
      }
      throw err;
    }

    // 写入缓存 + 填充结果
    for (let i = 0; i < uncachedIndices.length; i++) {
      const vec = embeddings[i];
      if (vec) {
        const origIdx = uncachedIndices[i];
        results[origIdx] = vec;
        setCachedQueryVec(uncachedTexts[i], activeModel, vec);
      }
    }

    return results as number[][];
  }

  // 如果已在 fallback 状态，确保探测定时器运行
  if (configModel === FREE_MODEL && _fallbackToPro && apiKey) {
    startProbeTimer(baseUrl, apiKey);
  }

  return { embed, model: resolveActiveModel(), dims };
}

/**
 * 首次启动自动向量化（后台非阻塞）。
 * 检查 tool_meta.vectorized，如果未向量化且有 apiKey 则启动。
 */
export async function ensureVectors(
  db: DatabaseSync,
  embeddingConfig: ToolDiscoveryEmbeddingConfig,
): Promise<{ vectorized: boolean; count: number; error?: string }> {
  // 检查是否已向量化
  const meta = readMeta(db, "vectorized");
  const metaModel = readMeta(db, "vec_model");
  if (meta === "true" && metaModel === (embeddingConfig.model ?? "BAAI/bge-m3")) {
    return { vectorized: true, count: 0 };
  }

  // 无 apiKey → 跳过
  if (!embeddingConfig.apiKey) {
    return { vectorized: false, count: 0, error: "no_api_key" };
  }

  const client = createToolEmbeddingClient(embeddingConfig);

  // 确保 vec 表就绪
  const vecOk = await ensureVecTable(db, client.dims);
  if (!vecOk) {
    return { vectorized: false, count: 0, error: "sqlite_vec_unavailable" };
  }

  // 增量向量化：只加载尚未有向量的工具
  // 如果模型变更（metaModel !== 当前模型），则全量重建
  // 注意：metaModel 可能为 null（从未成功向量化）或与当前模型不同（中途失败后换模型）
  // 使用 vec_model_pending 追踪"正在用哪个模型向量化"，防止混合维度
  const pendingModel = readMeta(db, "vec_model_pending");
  const modelChanged =
    (metaModel && metaModel !== client.model) || (pendingModel && pendingModel !== client.model);
  let rows: Array<{ id: string; description: string; description_cn: string }>;

  // 标记当前向量化使用的模型（即使中途失败，重启时也能检测到不匹配）
  upsertMeta(db, "vec_model_pending", client.model);

  if (modelChanged) {
    // 模型变更 → 清空旧向量，全量重建
    safeExec(db, `DELETE FROM ${VEC_TABLE}`);
    rows = db
      .prepare(`SELECT id, description, description_cn FROM ${TOOLS_TABLE}`)
      .all() as typeof rows;
  } else {
    // 增量：只选未向量化的条目（LEFT JOIN vec 表找缺失的）
    try {
      rows = db
        .prepare(
          `SELECT t.id, t.description, t.description_cn FROM ${TOOLS_TABLE} t
           LEFT JOIN ${VEC_TABLE} v ON t.id = v.id
           WHERE v.id IS NULL`,
        )
        .all() as typeof rows;
    } catch {
      // vec 表不存在时回退全量
      rows = db
        .prepare(`SELECT id, description, description_cn FROM ${TOOLS_TABLE}`)
        .all() as typeof rows;
    }
  }

  if (rows.length === 0) {
    upsertMeta(db, "vectorized", "true");
    upsertMeta(db, "vec_model", client.model);
    return { vectorized: true, count: 0 };
  }

  // 批量向量化（每批 64 条）
  const BATCH_SIZE = 64;
  let totalVectorized = 0;

  const insertVec = db.prepare(`INSERT OR REPLACE INTO ${VEC_TABLE} (id, embedding) VALUES (?, ?)`);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const texts = batch.map((r) => {
      // 合并中英文描述作为 embedding 输入
      const parts = [r.description];
      if (r.description_cn) parts.push(r.description_cn);
      const text = parts.join(" ").trim();
      // 防止空字符串导致 API 400 错误
      return text || r.id;
    });

    try {
      const embeddings = await client.embed(texts);
      db.exec("BEGIN");
      for (let j = 0; j < batch.length; j++) {
        const vec = embeddings[j];
        if (vec && vec.length > 0) {
          const blob = Buffer.from(new Float32Array(vec).buffer);
          insertVec.run(batch[j].id, blob);
          totalVectorized++;
        }
      }
      db.exec("COMMIT");
    } catch (err) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* ignore */
      }
      const message = err instanceof Error ? err.message : String(err);
      return { vectorized: false, count: totalVectorized, error: message };
    }
  }

  // 标记完成（清除 pending 标记）
  upsertMeta(db, "vectorized", "true");
  upsertMeta(db, "vec_model", client.model);
  upsertMeta(db, "vec_model_pending", ""); // 清除 pending 标记
  upsertMeta(db, "vec_dims", String(client.dims));
  upsertMeta(db, "vec_count", String(totalVectorized));
  upsertMeta(db, "vectorized_at", String(Date.now()));

  return { vectorized: true, count: totalVectorized };
}

/**
 * 检查是否已向量化。
 */
export function isVectorized(db: DatabaseSync): boolean {
  return readMeta(db, "vectorized") === "true";
}

/**
 * 获取索引统计信息。
 */
export function getIndexStats(db: DatabaseSync): {
  entryCount: number;
  vectorized: boolean;
  vecModel?: string;
  vecDims?: number;
  vecCount?: number;
  builtAt?: number;
} {
  return {
    entryCount: Number(readMeta(db, "entry_count") ?? 0),
    vectorized: readMeta(db, "vectorized") === "true",
    vecModel: readMeta(db, "vec_model") ?? undefined,
    vecDims: Number(readMeta(db, "vec_dims") ?? 0) || undefined,
    vecCount: Number(readMeta(db, "vec_count") ?? 0) || undefined,
    builtAt: Number(readMeta(db, "built_at") ?? 0) || undefined,
  };
}

/**
 * 查询当前向量库的绑定状态（模型 + 维度 + 向量数量）。
 * 使用 singleton 缓存的 DB 连接，若 DB 未打开则返回 unbound 状态。
 */
export function getVecBindingStatus(): {
  bound: boolean;
  vecModel: string | null;
  vecDims: number | null;
  vecCount: number;
} {
  if (!_db) {
    return { bound: false, vecModel: null, vecDims: null, vecCount: 0 };
  }
  try {
    const stats = getIndexStats(_db);
    const count = stats.vecCount ?? 0;
    return {
      bound: stats.vectorized && count > 0,
      vecModel: stats.vecModel ?? null,
      vecDims: stats.vecDims ?? null,
      vecCount: count,
    };
  } catch {
    return { bound: false, vecModel: null, vecDims: null, vecCount: 0 };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function upsertMeta(db: DatabaseSync, key: string, value: string): void {
  db.prepare(
    `INSERT INTO ${META_TABLE} (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

function readMeta(db: DatabaseSync, key: string): string | null {
  const row = db.prepare(`SELECT value FROM ${META_TABLE} WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

/** 安全执行 SQL（如果表不存在则静默忽略）。 */
function safeExec(
  db: DatabaseSync,
  sql: string,
  params?: (string | number | bigint | Buffer | null)[],
): void {
  try {
    if (params) {
      db.prepare(sql).run(...params);
    } else {
      db.exec(sql);
    }
  } catch {
    /* table might not exist */
  }
}
