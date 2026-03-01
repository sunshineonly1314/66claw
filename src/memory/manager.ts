import type { DatabaseSync } from "node:sqlite";
import { type FSWatcher } from "chokidar";
import fs from "node:fs/promises";
import path from "node:path";
import type { ResolvedMemorySearchConfig } from "../agents/memory-search.js";
import type { OpenClawCNConfig } from "../config/config.js";
import type {
  MemoryEmbeddingProbeResult,
  MemoryProviderStatus,
  MemorySearchManager,
  MemorySearchResult,
  MemorySource,
  MemorySyncProgressUpdate,
} from "./types.js";
import { resolveAgentDir, resolveAgentWorkspaceDir } from "../agents/agent-scope.js";
import { resolveMemorySearchConfig } from "../agents/memory-search.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  createEmbeddingProvider,
  type EmbeddingProvider,
  type EmbeddingProviderResult,
  type GeminiEmbeddingClient,
  type OpenAiEmbeddingClient,
  type VoyageEmbeddingClient,
} from "./embeddings.js";
import { bm25RankToScore, buildFtsQuery, mergeHybridResults } from "./hybrid.js";
// [CN-PATCH:memory-p0] 冷热分层搜索：优先返回近期记忆，节约 token
import { applyTimeTiering } from "./search-tiering-cn.js";
import { isMemoryPath, normalizeExtraMemoryPaths } from "./internal.js";
import { memoryManagerEmbeddingOps } from "./manager-embedding-ops.js";
import { searchKeyword, searchVector } from "./manager-search.js";
import { memoryManagerSyncOps } from "./manager-sync-ops.js";
import { truncateUtf16Safe } from "../utils.js";
const SNIPPET_MAX_CHARS = 700;
const VECTOR_TABLE = "chunks_vec";
const FTS_TABLE = "chunks_fts";
const EMBEDDING_CACHE_TABLE = "embedding_cache";
const BATCH_FAILURE_LIMIT = 2;

const log = createSubsystemLogger("memory");

const INDEX_CACHE = new Map<string, MemoryIndexManager>();

export class MemoryIndexManager implements MemorySearchManager {
  // oxlint-disable-next-line typescript/no-explicit-any
  [key: string]: any;
  private readonly cacheKey: string;
  private readonly cfg: OpenClawCNConfig;
  private readonly agentId: string;
  private readonly workspaceDir: string;
  private readonly settings: ResolvedMemorySearchConfig;
  private provider: EmbeddingProvider;
  private readonly requestedProvider: "openai" | "local" | "gemini" | "voyage" | "auto";
  private fallbackFrom?: "openai" | "local" | "gemini" | "voyage";
  private fallbackReason?: string;
  private openAi?: OpenAiEmbeddingClient;
  private gemini?: GeminiEmbeddingClient;
  private voyage?: VoyageEmbeddingClient;
  private batch: {
    enabled: boolean;
    wait: boolean;
    concurrency: number;
    pollIntervalMs: number;
    timeoutMs: number;
  };
  private batchFailureCount = 0;
  private batchFailureLastError?: string;
  private batchFailureLastProvider?: string;
  private batchFailureLock: Promise<void> = Promise.resolve();
  private db: DatabaseSync;
  private readonly sources: Set<MemorySource>;
  private providerKey: string;
  private readonly cache: { enabled: boolean; maxEntries?: number };
  private readonly vector: {
    enabled: boolean;
    available: boolean | null;
    extensionPath?: string;
    loadError?: string;
    dims?: number;
  };
  private readonly fts: {
    enabled: boolean;
    available: boolean;
    loadError?: string;
  };
  private vectorReady: Promise<boolean> | null = null;
  private watcher: FSWatcher | null = null;
  private watchTimer: NodeJS.Timeout | null = null;
  private sessionWatchTimer: NodeJS.Timeout | null = null;
  private sessionUnsubscribe: (() => void) | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;
  private closed = false;
  private dirty = false;
  private sessionsDirty = false;
  private sessionsDirtyFiles = new Set<string>();
  private sessionPendingFiles = new Set<string>();
  private sessionDeltas = new Map<
    string,
    { lastSize: number; pendingBytes: number; pendingMessages: number }
  >();
  private sessionWarm = new Set<string>();
  private syncing: Promise<void> | null = null;

  static async get(params: {
    cfg: OpenClawCNConfig;
    agentId: string;
    purpose?: "default" | "status";
  }): Promise<MemoryIndexManager | null> {
    const { cfg, agentId } = params;
    const settings = resolveMemorySearchConfig(cfg, agentId);
    if (!settings) {
      return null;
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const key = `${agentId}:${workspaceDir}:${JSON.stringify(settings)}`;
    const existing = INDEX_CACHE.get(key);
    if (existing) {
      return existing;
    }

    // Evict stale cache entries for the same agentId+workspaceDir but different settings.
    // Without this, config changes leave old managers in the cache holding open DB handles,
    // file watchers, and interval timers indefinitely.
    // We only remove from cache — we do NOT close() here because the caller may still
    // hold a reference. The caller is responsible for calling close() when done.
    const prefix = `${agentId}:${workspaceDir}:`;
    for (const [cachedKey] of INDEX_CACHE) {
      if (cachedKey.startsWith(prefix) && cachedKey !== key) {
        INDEX_CACHE.delete(cachedKey);
      }
    }

    const providerResult = await createEmbeddingProvider({
      config: cfg,
      agentDir: resolveAgentDir(cfg, agentId),
      provider: settings.provider,
      remote: settings.remote,
      model: settings.model,
      fallback: settings.fallback,
      local: settings.local,
    });
    const manager = new MemoryIndexManager({
      cacheKey: key,
      cfg,
      agentId,
      workspaceDir,
      settings,
      providerResult,
      purpose: params.purpose,
    });
    INDEX_CACHE.set(key, manager);
    return manager;
  }

  private constructor(params: {
    cacheKey: string;
    cfg: OpenClawCNConfig;
    agentId: string;
    workspaceDir: string;
    settings: ResolvedMemorySearchConfig;
    providerResult: EmbeddingProviderResult;
    purpose?: "default" | "status";
  }) {
    this.cacheKey = params.cacheKey;
    this.cfg = params.cfg;
    this.agentId = params.agentId;
    this.workspaceDir = params.workspaceDir;
    this.settings = params.settings;
    this.provider = params.providerResult.provider;
    this.requestedProvider = params.providerResult.requestedProvider;
    this.fallbackFrom = params.providerResult.fallbackFrom;
    this.fallbackReason = params.providerResult.fallbackReason;
    this.openAi = params.providerResult.openAi;
    this.gemini = params.providerResult.gemini;
    this.voyage = params.providerResult.voyage;
    this.sources = new Set(params.settings.sources);
    this.db = this.openDatabase();
    this.providerKey = this.computeProviderKey();
    this.cache = {
      enabled: params.settings.cache.enabled,
      maxEntries: params.settings.cache.maxEntries,
    };
    this.fts = { enabled: params.settings.query.hybrid.enabled, available: false };
    this.ensureSchema();
    this.vector = {
      enabled: params.settings.store.vector.enabled,
      available: null,
      extensionPath: params.settings.store.vector.extensionPath,
    };
    const meta = this.readMeta();
    if (meta?.vectorDims) {
      this.vector.dims = meta.vectorDims;
    }
    this.ensureWatcher();
    this.ensureSessionListener();
    this.ensureIntervalSync();
    const statusOnly = params.purpose === "status";
    this.dirty = this.sources.has("memory") && (statusOnly ? !meta : true);
    // [CN-PATCH:reliability] 启动时标记 sessions 为 dirty，确保首次搜索触发增量同步。
    // 防止崩溃场景：进程异常退出时 session transcript 已写入但 5s debounce 内索引未更新，
    // 重启后 sessionsDirty 默认 false → 首次搜索跳过 session 同步 → 最近对话搜索不到。
    // hash 对比机制保证只有真正变化的文件才会重新索引，不会浪费性能。
    this.sessionsDirty = this.sources.has("sessions") && (statusOnly ? !meta : true);
    this.batch = this.resolveBatchConfig();
  }

  async warmSession(sessionKey?: string): Promise<void> {
    if (!this.settings.sync.onSessionStart) {
      return;
    }
    const key = sessionKey?.trim() || "";
    if (key && this.sessionWarm.has(key)) {
      return;
    }
    void this.sync({ reason: "session-start" }).catch((err) => {
      log.warn(`memory sync failed (session-start): ${String(err)}`);
    });
    if (key) {
      this.sessionWarm.add(key);
    }
  }

  async search(
    query: string,
    opts?: {
      maxResults?: number;
      minScore?: number;
      sessionKey?: string;
    },
  ): Promise<MemorySearchResult[]> {
    void this.warmSession(opts?.sessionKey);
    if (this.settings.sync.onSearch && (this.dirty || this.sessionsDirty)) {
      void this.sync({ reason: "search" }).catch((err) => {
        log.warn(`memory sync failed (search): ${String(err)}`);
      });
    }
    const cleaned = query.trim();
    if (!cleaned) {
      return [];
    }
    const minScore = opts?.minScore ?? this.settings.query.minScore;
    const maxResults = opts?.maxResults ?? this.settings.query.maxResults;
    const hybrid = this.settings.query.hybrid;
    const candidates = Math.min(
      200,
      Math.max(1, Math.floor(maxResults * hybrid.candidateMultiplier)),
    );

    const keywordResults = hybrid.enabled
      ? await this.searchKeyword(cleaned, candidates).catch(() => [])
      : [];

    const queryVec = (await this.embedQueryWithTimeout(cleaned)) as number[];
    const hasVector = queryVec.some((v) => v !== 0);
    const vectorResults = hasVector
      ? await this.searchVector(queryVec, candidates).catch(() => [])
      : [];

    if (!hybrid.enabled) {
      // [CN-PATCH:memory-p0] 冷热分层过滤：优先返回近期记忆，减少 token 消耗
      let tiered = applyTimeTiering(vectorResults);
      // [CN-PATCH:memory-p0] Reindex 降级：当前 model 无结果但 DB 有旧 model 数据时，
      // 用 FTS keyword-only 搜索（不带 model 过滤）提供降级结果。
      // 场景：用户切换 embedding provider 后 reindex 尚未完成，避免"把事都忘了"的体验。
      let isDegraded = false;
      if (tiered.length === 0 && this.fts.enabled && this.fts.available) {
        const degraded = await this.searchKeywordDegraded(cleaned, candidates).catch(() => []);
        if (degraded.length > 0) {
          tiered = applyTimeTiering(degraded);
          isDegraded = true;
        }
      }
      // [CN-PATCH:memory-fix] 降级搜索时保证至少返回 top-1 结果。
      // 降级搜索的 score 已经减半 (×0.5)，如果 minScore 过高会把所有结果过滤掉，
      // 导致"明明搜到了但不显示"的体验。降级时至少保留最高分结果。
      // [CN-PATCH:memory-fix] M5: 自适应 minScore — 当最高分整体偏低（local 模型场景），
      // 自动降低阈值到 maxScore×0.6，避免高分保护被 minScore 一刀切全部过滤。
      const effectiveMinScore = adaptiveMinScore(tiered, minScore);
      const filtered = tiered.filter((entry) => entry.score >= effectiveMinScore);
      if (isDegraded && filtered.length === 0 && tiered.length > 0) {
        return tiered.slice(0, Math.min(1, maxResults));
      }
      // [CN-PATCH:memory-fix] M6: vector-only 模式也应用 coalesce，与 hybrid 一致。
      const coalesced = coalesceAdjacentResults(filtered);
      return coalesced.slice(0, maxResults);
    }

    // [CN-PATCH:memory-fix] Query-length adaptive weight: short CJK queries benefit
    // from keyword matching (exact token hit), long queries from vector semantics.
    // Default: 0.7 vector / 0.3 text. Adjustment:
    //   - Short (≤6 chars, e.g. "数据库优化"): 0.45v / 0.55t (keyword dominant)
    //   - Medium (7-20 chars): default weights (balanced)
    //   - Long (>20 chars, full sentence): 0.85v / 0.15t (semantic dominant)
    const queryLen = cleaned.length;
    let adaptiveVectorWeight = hybrid.vectorWeight;
    let adaptiveTextWeight = hybrid.textWeight;
    if (queryLen <= 6) {
      adaptiveVectorWeight = 0.45;
      adaptiveTextWeight = 0.55;
    } else if (queryLen > 20) {
      adaptiveVectorWeight = 0.85;
      adaptiveTextWeight = 0.15;
    }

    const merged = this.mergeHybridResults({
      vector: vectorResults,
      keyword: keywordResults,
      vectorWeight: adaptiveVectorWeight,
      textWeight: adaptiveTextWeight,
    });

    // [CN-PATCH:memory-p0] 冷热分层过滤：优先返回近期记忆，减少 token 消耗
    let tiered = applyTimeTiering(merged);

    // [CN-PATCH:memory-p0] Reindex 降级：hybrid 模式下也检查。
    // vector 搜索因 model 不匹配返回空，keyword 因 model filter 也为空时，
    // 降级到不带 model 过滤的 FTS 纯文本搜索。
    let isDegradedHybrid = false;
    if (tiered.length === 0 && this.fts.enabled && this.fts.available) {
      const degraded = await this.searchKeywordDegraded(cleaned, candidates).catch(() => []);
      if (degraded.length > 0) {
        tiered = applyTimeTiering(degraded);
        isDegradedHybrid = true;
      }
    }

    // [CN-PATCH:memory-fix] 降级搜索时保证至少返回 top-1 结果（同 vector-only 模式）。
    const effectiveMinScoreHybrid = adaptiveMinScore(tiered, minScore);
    const filteredHybrid = tiered.filter((entry) => entry.score >= effectiveMinScoreHybrid);
    if (isDegradedHybrid && filteredHybrid.length === 0 && tiered.length > 0) {
      return tiered.slice(0, Math.min(1, maxResults));
    }

    // [CN-PATCH:memory-fix] Merge adjacent chunks from the same file.
    // When a long answer is split across 2-3 chunks, search may hit multiple
    // fragments. Merging them saves token budget and provides better context.
    const coalesced = coalesceAdjacentResults(filteredHybrid);
    return coalesced.slice(0, maxResults);
  }

  private async searchVector(
    queryVec: number[],
    limit: number,
  ): Promise<Array<MemorySearchResult & { id: string }>> {
    const results = await searchVector({
      db: this.db,
      vectorTable: VECTOR_TABLE,
      providerModel: this.provider.model,
      queryVec,
      limit,
      snippetMaxChars: SNIPPET_MAX_CHARS,
      ensureVectorReady: async (dimensions) => await this.ensureVectorReady(dimensions),
      sourceFilterVec: this.buildSourceFilter("c"),
      sourceFilterChunks: this.buildSourceFilter(),
    });
    return results.map((entry) => entry as MemorySearchResult & { id: string });
  }

  private buildFtsQuery(raw: string): string | null {
    return buildFtsQuery(raw);
  }

  private async searchKeyword(
    query: string,
    limit: number,
  ): Promise<Array<MemorySearchResult & { id: string; textScore: number }>> {
    if (!this.fts.enabled || !this.fts.available) {
      return [];
    }
    // [CN-PATCH:memory-p0] searchKeyword 现在 JOIN chunks 表获取 updated_at，
    // FTS5 表别名 f 与 chunks 表别名 c 都有 source 列，需要传 "f" 前缀消除歧义
    const sourceFilter = this.buildSourceFilter("f");
    const results = await searchKeyword({
      db: this.db,
      ftsTable: FTS_TABLE,
      providerModel: this.provider.model,
      query,
      limit,
      snippetMaxChars: SNIPPET_MAX_CHARS,
      sourceFilter,
      buildFtsQuery: (raw) => this.buildFtsQuery(raw),
      bm25RankToScore,
    });
    return results.map((entry) => entry as MemorySearchResult & { id: string; textScore: number });
  }

  /**
   * [CN-PATCH:memory-p0] Degraded keyword search without model filter.
   * Used during reindex window when embedding model changed but new chunks haven't been indexed yet.
   * Falls back to FTS-only text matching across ALL model's chunks, providing continuity
   * of cold memory recall even when the current model has zero indexed chunks.
   * Scores are halved (multiplied by 0.5) to indicate degraded quality.
   */
  private async searchKeywordDegraded(
    query: string,
    limit: number,
  ): Promise<Array<MemorySearchResult & { id: string; textScore: number }>> {
    if (!this.fts.enabled || !this.fts.available) {
      return [];
    }
    const sourceFilter = this.buildSourceFilter("f");
    const results = await searchKeyword({
      db: this.db,
      ftsTable: FTS_TABLE,
      providerModel: this.provider.model,
      query,
      limit,
      snippetMaxChars: SNIPPET_MAX_CHARS,
      sourceFilter,
      buildFtsQuery: (raw) => this.buildFtsQuery(raw),
      bm25RankToScore,
      skipModelFilter: true,
    });
    // Halve scores to signal degraded quality (cross-model FTS results)
    return results.map(
      (entry) =>
        ({
          ...entry,
          score: entry.score * 0.5,
          textScore: entry.textScore * 0.5,
        }) as MemorySearchResult & { id: string; textScore: number },
    );
  }

  private mergeHybridResults(params: {
    vector: Array<MemorySearchResult & { id: string }>;
    keyword: Array<MemorySearchResult & { id: string; textScore: number }>;
    vectorWeight: number;
    textWeight: number;
  }): MemorySearchResult[] {
    const merged = mergeHybridResults({
      vector: params.vector.map((r) => ({
        id: r.id,
        path: r.path,
        startLine: r.startLine,
        endLine: r.endLine,
        source: r.source,
        snippet: r.snippet,
        vectorScore: r.score,
        updatedAt: r.updatedAt,
      })),
      keyword: params.keyword.map((r) => ({
        id: r.id,
        path: r.path,
        startLine: r.startLine,
        endLine: r.endLine,
        source: r.source,
        snippet: r.snippet,
        textScore: r.textScore,
        updatedAt: r.updatedAt,
      })),
      vectorWeight: params.vectorWeight,
      textWeight: params.textWeight,
    });
    return merged.map((entry) => entry as MemorySearchResult);
  }

  async sync(params?: {
    reason?: string;
    force?: boolean;
    progress?: (update: MemorySyncProgressUpdate) => void;
  }): Promise<void> {
    // If a sync is already running and the new call does NOT need force,
    // coalesce onto the existing promise (single-flight).
    // If the new call needs force, we must NOT coalesce — it would skip the reindex.
    if (this.syncing && !params?.force) {
      return this.syncing;
    }
    // Wait for any ongoing sync to finish before starting a new one
    if (this.syncing) {
      await this.syncing.catch(() => {});
    }
    this.syncing = this.runSync(params).finally(() => {
      this.syncing = null;
    });
    return this.syncing ?? Promise.resolve();
  }

  async readFile(params: {
    relPath: string;
    from?: number;
    lines?: number;
  }): Promise<{ text: string; path: string }> {
    const rawPath = params.relPath.trim();
    if (!rawPath) {
      throw new Error("path required");
    }
    const absPath = path.isAbsolute(rawPath)
      ? path.resolve(rawPath)
      : path.resolve(this.workspaceDir, rawPath);
    const relPath = path.relative(this.workspaceDir, absPath).replace(/\\/g, "/");
    const inWorkspace =
      relPath.length > 0 && !relPath.startsWith("..") && !path.isAbsolute(relPath);
    const allowedWorkspace = inWorkspace && isMemoryPath(relPath);
    let allowedAdditional = false;
    if (!allowedWorkspace && this.settings.extraPaths.length > 0) {
      const additionalPaths = normalizeExtraMemoryPaths(
        this.workspaceDir,
        this.settings.extraPaths,
      );
      for (const additionalPath of additionalPaths) {
        try {
          const stat = await fs.lstat(additionalPath);
          if (stat.isSymbolicLink()) {
            continue;
          }
          if (stat.isDirectory()) {
            if (absPath === additionalPath || absPath.startsWith(`${additionalPath}${path.sep}`)) {
              allowedAdditional = true;
              break;
            }
            continue;
          }
          if (stat.isFile()) {
            if (absPath === additionalPath && absPath.endsWith(".md")) {
              allowedAdditional = true;
              break;
            }
          }
        } catch {}
      }
    }
    if (!allowedWorkspace && !allowedAdditional) {
      throw new Error("path required");
    }
    if (!absPath.endsWith(".md")) {
      throw new Error("path required");
    }
    const stat = await fs.lstat(absPath);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error("path required");
    }
    const content = await fs.readFile(absPath, "utf-8");
    if (!params.from && !params.lines) {
      return { text: content, path: relPath };
    }
    const lines = content.split("\n");
    const start = Math.max(1, params.from ?? 1);
    const count = Math.max(1, params.lines ?? lines.length);
    const slice = lines.slice(start - 1, start - 1 + count);
    return { text: slice.join("\n"), path: relPath };
  }

  status(): MemoryProviderStatus {
    const sourceFilter = this.buildSourceFilter();
    const files = this.db
      .prepare(`SELECT COUNT(*) as c FROM files WHERE 1=1${sourceFilter.sql}`)
      .get(...sourceFilter.params) as {
      c: number;
    };
    const chunks = this.db
      .prepare(`SELECT COUNT(*) as c FROM chunks WHERE 1=1${sourceFilter.sql}`)
      .get(...sourceFilter.params) as {
      c: number;
    };
    const sourceCounts = (() => {
      const sources = Array.from(this.sources);
      if (sources.length === 0) {
        return [];
      }
      const bySource = new Map<MemorySource, { files: number; chunks: number }>();
      for (const source of sources) {
        bySource.set(source, { files: 0, chunks: 0 });
      }
      const fileRows = this.db
        .prepare(
          `SELECT source, COUNT(*) as c FROM files WHERE 1=1${sourceFilter.sql} GROUP BY source`,
        )
        .all(...sourceFilter.params) as Array<{ source: MemorySource; c: number }>;
      for (const row of fileRows) {
        const entry = bySource.get(row.source) ?? { files: 0, chunks: 0 };
        entry.files = row.c ?? 0;
        bySource.set(row.source, entry);
      }
      const chunkRows = this.db
        .prepare(
          `SELECT source, COUNT(*) as c FROM chunks WHERE 1=1${sourceFilter.sql} GROUP BY source`,
        )
        .all(...sourceFilter.params) as Array<{ source: MemorySource; c: number }>;
      for (const row of chunkRows) {
        const entry = bySource.get(row.source) ?? { files: 0, chunks: 0 };
        entry.chunks = row.c ?? 0;
        bySource.set(row.source, entry);
      }
      return sources.map((source) => Object.assign({ source }, bySource.get(source)!));
    })();
    return {
      backend: "builtin",
      files: files?.c ?? 0,
      chunks: chunks?.c ?? 0,
      dirty: this.dirty || this.sessionsDirty,
      workspaceDir: this.workspaceDir,
      dbPath: this.settings.store.path,
      provider: this.provider.id,
      model: this.provider.model,
      requestedProvider: this.requestedProvider,
      sources: Array.from(this.sources),
      extraPaths: this.settings.extraPaths,
      sourceCounts,
      cache: this.cache.enabled
        ? {
            enabled: true,
            entries:
              (
                this.db.prepare(`SELECT COUNT(*) as c FROM ${EMBEDDING_CACHE_TABLE}`).get() as
                  | { c: number }
                  | undefined
              )?.c ?? 0,
            maxEntries: this.cache.maxEntries,
          }
        : { enabled: false, maxEntries: this.cache.maxEntries },
      fts: {
        enabled: this.fts.enabled,
        available: this.fts.available,
        error: this.fts.loadError,
      },
      fallback: this.fallbackReason
        ? { from: this.fallbackFrom ?? "local", reason: this.fallbackReason }
        : undefined,
      vector: {
        enabled: this.vector.enabled,
        available: this.vector.available ?? undefined,
        extensionPath: this.vector.extensionPath,
        loadError: this.vector.loadError,
        dims: this.vector.dims,
        // [CN-PATCH:memory-fix] Warn when brute-force fallback would truncate search results.
        // If sqlite-vec is unavailable and chunk count > 2000, recall is silently degraded.
        bruteForceTruncated:
          this.vector.enabled && this.vector.available === false && (chunks?.c ?? 0) > 2000
            ? true
            : undefined,
      },
      batch: {
        enabled: this.batch.enabled,
        failures: this.batchFailureCount,
        limit: BATCH_FAILURE_LIMIT,
        wait: this.batch.wait,
        concurrency: this.batch.concurrency,
        pollIntervalMs: this.batch.pollIntervalMs,
        timeoutMs: this.batch.timeoutMs,
        lastError: this.batchFailureLastError,
        lastProvider: this.batchFailureLastProvider,
      },
    };
  }

  async probeVectorAvailability(): Promise<boolean> {
    if (!this.vector.enabled) {
      return false;
    }
    return this.ensureVectorReady();
  }

  async probeEmbeddingAvailability(): Promise<MemoryEmbeddingProbeResult> {
    try {
      await this.embedBatchWithRetry(["ping"]);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    if (this.watchTimer) {
      clearTimeout(this.watchTimer);
      this.watchTimer = null;
    }
    if (this.sessionWatchTimer) {
      clearTimeout(this.sessionWatchTimer);
      this.sessionWatchTimer = null;
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    if (this.sessionUnsubscribe) {
      this.sessionUnsubscribe();
      this.sessionUnsubscribe = null;
    }
    this.db.close();
    INDEX_CACHE.delete(this.cacheKey);
  }
}

function applyPrototypeMixins(target: object, ...sources: object[]): void {
  for (const source of sources) {
    for (const name of Object.getOwnPropertyNames(source)) {
      if (name === "constructor") {
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(source, name);
      if (!descriptor) {
        continue;
      }
      Object.defineProperty(target, name, descriptor);
    }
  }
}

applyPrototypeMixins(MemoryIndexManager.prototype, memoryManagerSyncOps, memoryManagerEmbeddingOps);

/**
 * [CN-PATCH:memory-fix] M5: Adaptive minScore for low-scoring embedding models.
 *
 * 当 embedding 模型整体打分偏低（如 local GGUF 模型 maxScore 只有 0.3-0.5），
 * 固定 minScore=0.45 会把所有结果都过滤掉，导致搜索永远无结果。
 *
 * 策略：如果 top-1 score < minScore（说明模型分数范围低），自动降低到
 * max(maxScore × 0.6, minScore × 0.5)。这样：
 * - 正常模型(maxScore=0.8): 0.8 > 0.45 → 不调整
 * - 低分模型(maxScore=0.35): 0.35 < 0.45 → effectiveMin = max(0.21, 0.225) = 0.225
 * - 极低分(maxScore=0.15): effectiveMin = max(0.09, 0.225) = 0.225
 */
function adaptiveMinScore(results: MemorySearchResult[], configMinScore: number): number {
  if (results.length === 0) return configMinScore;
  const maxScore = Math.max(...results.map((r) => r.score));
  if (!Number.isFinite(maxScore)) return configMinScore; // NaN/Infinity 防御
  if (maxScore >= configMinScore) return configMinScore; // 正常模型，不调整
  return Math.max(maxScore * 0.6, configMinScore * 0.5);
}

/**
 * [CN-PATCH:memory-fix] Merge adjacent chunks from the same source file.
 *
 * When a long answer spans 2-3 chunks, search may return multiple fragments
 * from the same file with overlapping or adjacent line ranges. Merging them:
 * - Saves token budget (one merged snippet vs 2-3 separate snippets)
 * - Provides better context (complete answer instead of fragments)
 * - Takes the highest score among merged chunks
 *
 * Two chunks are "adjacent" if they're from the same path+source and their
 * line ranges overlap or are within 3 lines of each other.
 */
function coalesceAdjacentResults(results: MemorySearchResult[]): MemorySearchResult[] {
  if (results.length <= 1) return results;

  // Group by path+source
  const groups = new Map<string, MemorySearchResult[]>();
  for (const r of results) {
    const key = `${r.path}:${r.source ?? ""}`;
    const group = groups.get(key);
    if (group) {
      group.push(r);
    } else {
      groups.set(key, [r]);
    }
  }

  const merged: MemorySearchResult[] = [];
  const GAP_TOLERANCE = 3; // merge if within 3 lines of each other

  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }

    // Sort by startLine within group
    group.sort((a, b) => a.startLine - b.startLine);

    let current = { ...group[0] };
    for (let i = 1; i < group.length; i++) {
      const next = group[i];
      // Check if adjacent or overlapping
      if (next.startLine <= current.endLine + GAP_TOLERANCE) {
        // Merge: extend line range, concat snippets, take max score
        // [CN-PATCH:memory-fix] Cap merged snippet to 2× SNIPPET_MAX_CHARS.
        // 原来无上限，合并 3+ 个 chunk 可超 2000 字符，浪费 token 预算。
        const mergedSnippet = current.snippet + "\n" + next.snippet;
        const updatedAtMerged =
          current.updatedAt != null || next.updatedAt != null
            ? Math.max(current.updatedAt ?? 0, next.updatedAt ?? 0)
            : undefined;
        current = {
          ...current,
          endLine: Math.max(current.endLine, next.endLine),
          snippet: truncateUtf16Safe(mergedSnippet, SNIPPET_MAX_CHARS * 2),
          score: Math.max(current.score, next.score),
          updatedAt: updatedAtMerged,
        };
      } else {
        // Not adjacent — emit current, start new
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);
  }

  // Re-sort by score (merging may have changed relative order)
  merged.sort((a, b) => b.score - a.score);
  return merged;
}
