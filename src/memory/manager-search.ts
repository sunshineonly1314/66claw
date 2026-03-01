import type { DatabaseSync } from "node:sqlite";
import { truncateUtf16Safe } from "../utils.js";
import { cosineSimilarity, parseEmbedding } from "./internal.js";

const vectorToBlob = (embedding: number[]): Buffer =>
  Buffer.from(new Float32Array(embedding).buffer);

export type SearchSource = string;

export type SearchRowResult = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: SearchSource;
  // [CN-PATCH:memory-p0] 冷热分层搜索所需的时间戳，来自 chunks 表 updated_at 列
  updatedAt?: number;
};

export async function searchVector(params: {
  db: DatabaseSync;
  vectorTable: string;
  providerModel: string;
  queryVec: number[];
  limit: number;
  snippetMaxChars: number;
  ensureVectorReady: (dimensions: number) => Promise<boolean>;
  sourceFilterVec: { sql: string; params: SearchSource[] };
  sourceFilterChunks: { sql: string; params: SearchSource[] };
}): Promise<SearchRowResult[]> {
  if (params.queryVec.length === 0 || params.limit <= 0) {
    return [];
  }
  if (await params.ensureVectorReady(params.queryVec.length)) {
    const rows = params.db
      .prepare(
        `SELECT c.id, c.path, c.start_line, c.end_line, c.text,\n` +
          `       c.source, c.updated_at,\n` +
          `       vec_distance_cosine(v.embedding, ?) AS dist\n` +
          `  FROM ${params.vectorTable} v\n` +
          `  JOIN chunks c ON c.id = v.id\n` +
          ` WHERE c.model = ?${params.sourceFilterVec.sql}\n` +
          ` ORDER BY dist ASC\n` +
          ` LIMIT ?`,
      )
      .all(
        vectorToBlob(params.queryVec),
        params.providerModel,
        ...params.sourceFilterVec.params,
        params.limit,
      ) as Array<{
      id: string;
      path: string;
      start_line: number;
      end_line: number;
      text: string;
      source: SearchSource;
      updated_at: number;
      dist: number;
    }>;
    return rows.map((row) => ({
      id: row.id,
      path: row.path,
      startLine: row.start_line,
      endLine: row.end_line,
      score: 1 - row.dist,
      snippet: truncateUtf16Safe(row.text, params.snippetMaxChars),
      source: row.source,
      updatedAt: row.updated_at,
    }));
  }

  // Brute-force fallback: load chunks into memory for cosine similarity.
  // Cap at 2000 to prevent OOM on large indices (~2000 × 6KB embedding ≈ 12MB).
  const BRUTE_FORCE_LIMIT = 2000;
  const candidates = listChunks({
    db: params.db,
    providerModel: params.providerModel,
    sourceFilter: params.sourceFilterChunks,
    limit: BRUTE_FORCE_LIMIT,
  });
  // [CN-PATCH:memory-fix] Warn when brute-force truncation may degrade recall.
  // If we loaded exactly BRUTE_FORCE_LIMIT chunks, the index likely has more —
  // results beyond the limit are silently dropped, reducing recall completeness.
  if (candidates.length >= BRUTE_FORCE_LIMIT) {
    const total =
      (
        params.db
          .prepare(
            `SELECT COUNT(*) as c FROM chunks WHERE model = ?${params.sourceFilterChunks.sql}`,
          )
          .get(params.providerModel, ...params.sourceFilterChunks.params) as {
          c: number;
        }
      )?.c ?? 0;
    if (total > BRUTE_FORCE_LIMIT) {
      console.warn(
        `[memory] brute-force vector fallback: only ${BRUTE_FORCE_LIMIT} of ${total} chunks loaded. ` +
          `Recall may be incomplete. Consider enabling sqlite-vec for full vector search.`,
      );
    }
  }
  const scored = candidates
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(params.queryVec, chunk.embedding),
    }))
    .filter((entry) => Number.isFinite(entry.score));
  return scored
    .toSorted((a, b) => b.score - a.score)
    .slice(0, params.limit)
    .map((entry) => ({
      id: entry.chunk.id,
      path: entry.chunk.path,
      startLine: entry.chunk.startLine,
      endLine: entry.chunk.endLine,
      score: entry.score,
      snippet: truncateUtf16Safe(entry.chunk.text, params.snippetMaxChars),
      source: entry.chunk.source,
      updatedAt: entry.chunk.updatedAt,
    }));
}

export function listChunks(params: {
  db: DatabaseSync;
  providerModel: string;
  sourceFilter: { sql: string; params: SearchSource[] };
  limit?: number;
}): Array<{
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  embedding: number[];
  source: SearchSource;
  updatedAt: number;
}> {
  // Add LIMIT to prevent OOM on large indices (default: 2,000 chunks max).
  // Each chunk ≈ 6KB (1536-float embedding JSON) → 2000 chunks ≈ 12MB.
  const limit = params.limit ?? 2_000;
  const rows = params.db
    .prepare(
      `SELECT id, path, start_line, end_line, text, embedding, source, updated_at\n` +
        `  FROM chunks\n` +
        ` WHERE model = ?${params.sourceFilter.sql}\n` +
        ` LIMIT ?`,
    )
    .all(params.providerModel, ...params.sourceFilter.params, limit) as Array<{
    id: string;
    path: string;
    start_line: number;
    end_line: number;
    text: string;
    embedding: string;
    source: SearchSource;
    updated_at: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    path: row.path,
    startLine: row.start_line,
    endLine: row.end_line,
    text: row.text,
    embedding: parseEmbedding(row.embedding),
    source: row.source,
    updatedAt: row.updated_at,
  }));
}

export async function searchKeyword(params: {
  db: DatabaseSync;
  ftsTable: string;
  providerModel: string;
  query: string;
  limit: number;
  snippetMaxChars: number;
  sourceFilter: { sql: string; params: SearchSource[] };
  buildFtsQuery: (raw: string) => string | null;
  bm25RankToScore: (rank: number) => number;
  /** [CN-PATCH:memory-p0] When true, skip model filter for cross-model degraded search. */
  skipModelFilter?: boolean;
}): Promise<Array<SearchRowResult & { textScore: number }>> {
  if (params.limit <= 0) {
    return [];
  }
  const ftsQuery = params.buildFtsQuery(params.query);
  if (!ftsQuery) {
    // [CN-PATCH:memory-fix] FTS5 trigram requires >= 3 chars for CJK tokens.
    // For short CJK queries (2 chars like "记忆", "索引"), FTS MATCH won't work.
    // Fall back to SQL LIKE search on the chunks table (slower but functional).
    return searchKeywordLikeFallback(params);
  }

  // [CN-PATCH:memory-p0] JOIN chunks 表获取 updated_at，用于冷热分层搜索
  // FTS5 虚拟表本身没有 updated_at 列，通过 id 关联 chunks 表获取
  const modelClause = params.skipModelFilter ? "" : " AND f.model = ?";
  const queryParams = params.skipModelFilter
    ? [ftsQuery, ...params.sourceFilter.params, params.limit]
    : [ftsQuery, params.providerModel, ...params.sourceFilter.params, params.limit];
  const rows = params.db
    .prepare(
      `SELECT f.id, f.path, f.source, f.start_line, f.end_line, f.text,\n` +
        `       bm25(${params.ftsTable}) AS rank,\n` +
        `       c.updated_at\n` +
        `  FROM ${params.ftsTable} f\n` +
        `  JOIN chunks c ON c.id = f.id\n` +
        ` WHERE ${params.ftsTable} MATCH ?${modelClause}${params.sourceFilter.sql}\n` +
        ` ORDER BY rank ASC\n` +
        ` LIMIT ?`,
    )
    .all(...queryParams) as Array<{
    id: string;
    path: string;
    source: SearchSource;
    start_line: number;
    end_line: number;
    text: string;
    rank: number;
    updated_at: number;
  }>;

  return rows.map((row) => {
    const textScore = params.bm25RankToScore(row.rank);
    return {
      id: row.id,
      path: row.path,
      startLine: row.start_line,
      endLine: row.end_line,
      score: textScore,
      textScore,
      snippet: truncateUtf16Safe(row.text, params.snippetMaxChars),
      source: row.source,
      updatedAt: row.updated_at,
    };
  });
}

/**
 * [CN-PATCH:memory-fix] LIKE-based keyword fallback for short CJK queries.
 *
 * When FTS5 trigram can't handle the query (< 3 CJK chars), fall back to
 * SQL LIKE '%keyword%' on the chunks table. This is slower (full scan) but:
 * - Only triggers for short queries where FTS5 returns null
 * - Limited to `params.limit` results
 * - Scores assigned as a fixed moderate value (0.4) since LIKE has no ranking
 * - Sorted by updated_at DESC (prefer recent matches)
 */
function searchKeywordLikeFallback(params: {
  db: DatabaseSync;
  providerModel: string;
  query: string;
  limit: number;
  snippetMaxChars: number;
  sourceFilter: { sql: string; params: SearchSource[] };
  skipModelFilter?: boolean;
}): Array<SearchRowResult & { textScore: number }> {
  // Extract meaningful keywords from the query (2+ chars)
  const CJK_OR_WORD = /[A-Za-z0-9_]+|[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g;
  const keywords = (params.query.match(CJK_OR_WORD) ?? []).filter((t) => t.length >= 2);
  if (keywords.length === 0) return [];

  // Build LIKE conditions: all keywords must appear
  // [CN-PATCH:memory-fix] L1: Escape LIKE metacharacters (% and _) to prevent
  // false matches when user query contains these characters.
  const likeClauses = keywords.map(() => "c.text LIKE ? ESCAPE '\\'").join(" AND ");
  const likeParams = keywords.map((k) => `%${k.replace(/[%_\\]/g, "\\$&")}%`);

  const modelClause = params.skipModelFilter ? "" : " AND c.model = ?";
  const modelParams = params.skipModelFilter ? [] : [params.providerModel];

  try {
    const rows = params.db
      .prepare(
        `SELECT c.id, c.path, c.source, c.start_line, c.end_line, c.text, c.updated_at\n` +
          `  FROM chunks c\n` +
          ` WHERE ${likeClauses}${modelClause}${params.sourceFilter.sql}\n` +
          ` ORDER BY c.updated_at DESC\n` +
          ` LIMIT ?`,
      )
      .all(...likeParams, ...modelParams, ...params.sourceFilter.params, params.limit) as Array<{
      id: string;
      path: string;
      source: SearchSource;
      start_line: number;
      end_line: number;
      text: string;
      updated_at: number;
    }>;

    // [CN-PATCH:memory-fix] LIKE results must pass default minScore (0.45).
    // 旧值 0.4 在非混合模式下低于 minScore 被全部过滤，降级路径还 ×0.5=0.2 更不可能通过。
    // 0.55 保证：非降级路径直接通过 minScore；降级路径 ×0.5=0.275 虽低于 minScore，
    // 但 top-1 强制返回机制兜底。混合模式下 textWeight×0.55 也能产生有意义的贡献。
    const LIKE_BASE_SCORE = 0.55;
    return rows.map((row) => ({
      id: row.id,
      path: row.path,
      startLine: row.start_line,
      endLine: row.end_line,
      score: LIKE_BASE_SCORE,
      textScore: LIKE_BASE_SCORE,
      snippet: truncateUtf16Safe(row.text, params.snippetMaxChars),
      source: row.source,
      updatedAt: row.updated_at,
    }));
  } catch {
    return [];
  }
}
