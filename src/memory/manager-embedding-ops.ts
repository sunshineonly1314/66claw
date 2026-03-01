// @ts-nocheck
// oxlint-disable eslint/no-unused-vars, typescript/no-explicit-any
import fs from "node:fs/promises";
import type { SessionFileEntry } from "./session-files.js";
import type { MemorySource } from "./types.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { runGeminiEmbeddingBatches, type GeminiBatchRequest } from "./batch-gemini.js";
import {
  OPENAI_BATCH_ENDPOINT,
  type OpenAiBatchRequest,
  runOpenAiEmbeddingBatches,
} from "./batch-openai.js";
import { type VoyageBatchRequest, runVoyageEmbeddingBatches } from "./batch-voyage.js";
import { enforceEmbeddingMaxInputTokens } from "./embedding-chunk-limits.js";
import { estimateUtf8Bytes } from "./embedding-input-limits.js";
import {
  chunkMarkdown,
  hashText,
  parseEmbedding,
  remapChunkLines,
  type MemoryChunk,
  type MemoryFileEntry,
} from "./internal.js";

const VECTOR_TABLE = "chunks_vec";
const FTS_TABLE = "chunks_fts";
const EMBEDDING_CACHE_TABLE = "embedding_cache";
const EMBEDDING_BATCH_MAX_TOKENS = 8000;
const EMBEDDING_INDEX_CONCURRENCY = 4;
const EMBEDDING_RETRY_MAX_ATTEMPTS = 3;
const EMBEDDING_RETRY_BASE_DELAY_MS = 500;
const EMBEDDING_RETRY_MAX_DELAY_MS = 8000;
const BATCH_FAILURE_LIMIT = 2;
const EMBEDDING_QUERY_TIMEOUT_REMOTE_MS = 60_000;
const EMBEDDING_QUERY_TIMEOUT_LOCAL_MS = 5 * 60_000;
const EMBEDDING_BATCH_TIMEOUT_REMOTE_MS = 2 * 60_000;
const EMBEDDING_BATCH_TIMEOUT_LOCAL_MS = 10 * 60_000;

const vectorToBlob = (embedding: number[]): Buffer =>
  Buffer.from(new Float32Array(embedding).buffer);

const log = createSubsystemLogger("memory");

class MemoryManagerEmbeddingOps {
  [key: string]: any;
  private buildEmbeddingBatches(chunks: MemoryChunk[]): MemoryChunk[][] {
    const batches: MemoryChunk[][] = [];
    let current: MemoryChunk[] = [];
    let currentTokens = 0;

    for (const chunk of chunks) {
      const estimate = estimateUtf8Bytes(chunk.text);
      const wouldExceed =
        current.length > 0 && currentTokens + estimate > EMBEDDING_BATCH_MAX_TOKENS;
      if (wouldExceed) {
        batches.push(current);
        current = [];
        currentTokens = 0;
      }
      if (current.length === 0 && estimate > EMBEDDING_BATCH_MAX_TOKENS) {
        batches.push([chunk]);
        continue;
      }
      current.push(chunk);
      currentTokens += estimate;
    }

    if (current.length > 0) {
      batches.push(current);
    }
    return batches;
  }

  private loadEmbeddingCache(hashes: string[]): Map<string, number[]> {
    if (!this.cache.enabled) {
      return new Map();
    }
    if (hashes.length === 0) {
      return new Map();
    }
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const hash of hashes) {
      if (!hash) {
        continue;
      }
      if (seen.has(hash)) {
        continue;
      }
      seen.add(hash);
      unique.push(hash);
    }
    if (unique.length === 0) {
      return new Map();
    }

    const out = new Map<string, number[]>();
    const baseParams = [this.provider.id, this.provider.model, this.providerKey];
    const batchSize = 400;
    for (let start = 0; start < unique.length; start += batchSize) {
      const batch = unique.slice(start, start + batchSize);
      const placeholders = batch.map(() => "?").join(", ");
      const rows = this.db
        .prepare(
          `SELECT hash, embedding FROM ${EMBEDDING_CACHE_TABLE}\n` +
            ` WHERE provider = ? AND model = ? AND provider_key = ? AND hash IN (${placeholders})`,
        )
        .all(...baseParams, ...batch) as Array<{ hash: string; embedding: string }>;
      for (const row of rows) {
        out.set(row.hash, parseEmbedding(row.embedding));
      }
    }
    return out;
  }

  private upsertEmbeddingCache(entries: Array<{ hash: string; embedding: number[] }>): void {
    if (!this.cache.enabled) {
      return;
    }
    if (entries.length === 0) {
      return;
    }
    const now = Date.now();
    const stmt = this.db.prepare(
      `INSERT INTO ${EMBEDDING_CACHE_TABLE} (provider, model, provider_key, hash, embedding, dims, updated_at)\n` +
        ` VALUES (?, ?, ?, ?, ?, ?, ?)\n` +
        ` ON CONFLICT(provider, model, provider_key, hash) DO UPDATE SET\n` +
        `   embedding=excluded.embedding,\n` +
        `   dims=excluded.dims,\n` +
        `   updated_at=excluded.updated_at`,
    );
    for (const entry of entries) {
      const embedding = entry.embedding ?? [];
      stmt.run(
        this.provider.id,
        this.provider.model,
        this.providerKey,
        entry.hash,
        JSON.stringify(embedding),
        embedding.length,
        now,
      );
    }
    // Prune cache periodically during hot path to prevent unbounded growth
    this.pruneEmbeddingCacheIfNeeded();
  }

  private pruneEmbeddingCacheIfNeeded(): void {
    if (!this.cache.enabled) {
      return;
    }
    const max = this.cache.maxEntries;
    if (!max || max <= 0) {
      return;
    }
    const row = this.db.prepare(`SELECT COUNT(*) as c FROM ${EMBEDDING_CACHE_TABLE}`).get() as
      | { c: number }
      | undefined;
    const count = row?.c ?? 0;
    if (count <= max) {
      return;
    }
    const excess = count - max;
    this.db
      .prepare(
        `DELETE FROM ${EMBEDDING_CACHE_TABLE}\n` +
          ` WHERE rowid IN (\n` +
          `   SELECT rowid FROM ${EMBEDDING_CACHE_TABLE}\n` +
          `   ORDER BY updated_at ASC\n` +
          `   LIMIT ?\n` +
          ` )`,
      )
      .run(excess);
  }

  private async embedChunksInBatches(chunks: MemoryChunk[]): Promise<number[][]> {
    if (chunks.length === 0) {
      return [];
    }
    const cached = this.loadEmbeddingCache(chunks.map((chunk) => chunk.hash));
    const embeddings: number[][] = Array.from({ length: chunks.length }, () => []);
    const missing: Array<{ index: number; chunk: MemoryChunk }> = [];

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const hit = chunk?.hash ? cached.get(chunk.hash) : undefined;
      if (hit && hit.length > 0) {
        embeddings[i] = hit;
      } else if (chunk) {
        missing.push({ index: i, chunk });
      }
    }

    if (missing.length === 0) {
      return embeddings;
    }

    const missingChunks = missing.map((m) => m.chunk);
    const batches = this.buildEmbeddingBatches(missingChunks);
    const toCache: Array<{ hash: string; embedding: number[] }> = [];
    let cursor = 0;
    for (const batch of batches) {
      const batchEmbeddings = await this.embedBatchWithRetry(batch.map((chunk) => chunk.text));
      for (let i = 0; i < batch.length; i += 1) {
        const item = missing[cursor + i];
        const embedding = batchEmbeddings[i] ?? [];
        if (item) {
          embeddings[item.index] = embedding;
          toCache.push({ hash: item.chunk.hash, embedding });
        }
      }
      cursor += batch.length;
    }
    this.upsertEmbeddingCache(toCache);
    return embeddings;
  }

  private computeProviderKey(): string {
    if (this.provider.id === "openai" && this.openAi) {
      const entries = Object.entries(this.openAi.headers)
        .filter(([key]) => key.toLowerCase() !== "authorization")
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, value]);
      return hashText(
        JSON.stringify({
          provider: "openai",
          baseUrl: this.openAi.baseUrl,
          model: this.openAi.model,
          headers: entries,
        }),
      );
    }
    if (this.provider.id === "gemini" && this.gemini) {
      const entries = Object.entries(this.gemini.headers)
        .filter(([key]) => {
          const lower = key.toLowerCase();
          return lower !== "authorization" && lower !== "x-goog-api-key";
        })
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, value]);
      return hashText(
        JSON.stringify({
          provider: "gemini",
          baseUrl: this.gemini.baseUrl,
          model: this.gemini.model,
          headers: entries,
        }),
      );
    }
    return hashText(JSON.stringify({ provider: this.provider.id, model: this.provider.model }));
  }

  private async embedChunksWithBatch(
    chunks: MemoryChunk[],
    entry: MemoryFileEntry | SessionFileEntry,
    source: MemorySource,
  ): Promise<number[][]> {
    if (this.provider.id === "openai" && this.openAi) {
      return this.embedChunksWithOpenAiBatch(chunks, entry, source);
    }
    if (this.provider.id === "gemini" && this.gemini) {
      return this.embedChunksWithGeminiBatch(chunks, entry, source);
    }
    if (this.provider.id === "voyage" && this.voyage) {
      return this.embedChunksWithVoyageBatch(chunks, entry, source);
    }
    return this.embedChunksInBatches(chunks);
  }

  private collectCachedEmbeddings(chunks: MemoryChunk[]): {
    embeddings: number[][];
    missing: Array<{ index: number; chunk: MemoryChunk }>;
  } {
    const cached = this.loadEmbeddingCache(chunks.map((chunk) => chunk.hash));
    const embeddings: number[][] = Array.from({ length: chunks.length }, () => []);
    const missing: Array<{ index: number; chunk: MemoryChunk }> = [];

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const hit = chunk?.hash ? cached.get(chunk.hash) : undefined;
      if (hit && hit.length > 0) {
        embeddings[i] = hit;
      } else if (chunk) {
        missing.push({ index: i, chunk });
      }
    }

    return { embeddings, missing };
  }

  private buildBatchCustomId(params: {
    source: MemorySource;
    entry: MemoryFileEntry | SessionFileEntry;
    chunk: MemoryChunk;
    index: number;
  }): string {
    return hashText(
      `${params.source}:${params.entry.path}:${params.chunk.startLine}:${params.chunk.endLine}:${params.chunk.hash}:${params.index}`,
    );
  }

  private buildBatchRequests<T extends { custom_id: string }>(params: {
    missing: Array<{ index: number; chunk: MemoryChunk }>;
    entry: MemoryFileEntry | SessionFileEntry;
    source: MemorySource;
    build: (chunk: MemoryChunk) => Omit<T, "custom_id">;
  }): { requests: T[]; mapping: Map<string, { index: number; hash: string }> } {
    const requests: T[] = [];
    const mapping = new Map<string, { index: number; hash: string }>();

    for (const item of params.missing) {
      const chunk = item.chunk;
      const customId = this.buildBatchCustomId({
        source: params.source,
        entry: params.entry,
        chunk,
        index: item.index,
      });
      mapping.set(customId, { index: item.index, hash: chunk.hash });
      const built = params.build(chunk);
      requests.push({ custom_id: customId, ...built } as T);
    }

    return { requests, mapping };
  }

  private applyBatchEmbeddings(params: {
    byCustomId: Map<string, number[]>;
    mapping: Map<string, { index: number; hash: string }>;
    embeddings: number[][];
  }): void {
    const toCache: Array<{ hash: string; embedding: number[] }> = [];
    for (const [customId, embedding] of params.byCustomId.entries()) {
      const mapped = params.mapping.get(customId);
      if (!mapped) {
        continue;
      }
      params.embeddings[mapped.index] = embedding;
      toCache.push({ hash: mapped.hash, embedding });
    }
    this.upsertEmbeddingCache(toCache);
  }

  private async embedChunksWithVoyageBatch(
    chunks: MemoryChunk[],
    entry: MemoryFileEntry | SessionFileEntry,
    source: MemorySource,
  ): Promise<number[][]> {
    const voyage = this.voyage;
    if (!voyage) {
      return this.embedChunksInBatches(chunks);
    }
    if (chunks.length === 0) {
      return [];
    }
    const { embeddings, missing } = this.collectCachedEmbeddings(chunks);
    if (missing.length === 0) {
      return embeddings;
    }

    const { requests, mapping } = this.buildBatchRequests<VoyageBatchRequest>({
      missing,
      entry,
      source,
      build: (chunk) => ({
        body: { input: chunk.text },
      }),
    });
    const batchResult = await this.runBatchWithFallback({
      provider: "voyage",
      run: async () =>
        await runVoyageEmbeddingBatches({
          client: voyage,
          agentId: this.agentId,
          requests,
          wait: this.batch.wait,
          concurrency: this.batch.concurrency,
          pollIntervalMs: this.batch.pollIntervalMs,
          timeoutMs: this.batch.timeoutMs,
          debug: (message, data) => log.debug(message, { ...data, source, chunks: chunks.length }),
        }),
      fallback: async () => await this.embedChunksInBatches(chunks),
    });
    if (Array.isArray(batchResult)) {
      return batchResult;
    }
    this.applyBatchEmbeddings({ byCustomId: batchResult, mapping, embeddings });
    return embeddings;
  }

  private async embedChunksWithOpenAiBatch(
    chunks: MemoryChunk[],
    entry: MemoryFileEntry | SessionFileEntry,
    source: MemorySource,
  ): Promise<number[][]> {
    const openAi = this.openAi;
    if (!openAi) {
      return this.embedChunksInBatches(chunks);
    }
    if (chunks.length === 0) {
      return [];
    }
    const { embeddings, missing } = this.collectCachedEmbeddings(chunks);
    if (missing.length === 0) {
      return embeddings;
    }

    const { requests, mapping } = this.buildBatchRequests<OpenAiBatchRequest>({
      missing,
      entry,
      source,
      build: (chunk) => ({
        method: "POST",
        url: OPENAI_BATCH_ENDPOINT,
        body: {
          model: this.openAi?.model ?? this.provider.model,
          input: chunk.text,
        },
      }),
    });
    const batchResult = await this.runBatchWithFallback({
      provider: "openai",
      run: async () =>
        await runOpenAiEmbeddingBatches({
          openAi,
          agentId: this.agentId,
          requests,
          wait: this.batch.wait,
          concurrency: this.batch.concurrency,
          pollIntervalMs: this.batch.pollIntervalMs,
          timeoutMs: this.batch.timeoutMs,
          debug: (message, data) => log.debug(message, { ...data, source, chunks: chunks.length }),
        }),
      fallback: async () => await this.embedChunksInBatches(chunks),
    });
    if (Array.isArray(batchResult)) {
      return batchResult;
    }
    this.applyBatchEmbeddings({ byCustomId: batchResult, mapping, embeddings });
    return embeddings;
  }

  private async embedChunksWithGeminiBatch(
    chunks: MemoryChunk[],
    entry: MemoryFileEntry | SessionFileEntry,
    source: MemorySource,
  ): Promise<number[][]> {
    const gemini = this.gemini;
    if (!gemini) {
      return this.embedChunksInBatches(chunks);
    }
    if (chunks.length === 0) {
      return [];
    }
    const { embeddings, missing } = this.collectCachedEmbeddings(chunks);
    if (missing.length === 0) {
      return embeddings;
    }

    const { requests, mapping } = this.buildBatchRequests<GeminiBatchRequest>({
      missing,
      entry,
      source,
      build: (chunk) => ({
        content: { parts: [{ text: chunk.text }] },
        taskType: "RETRIEVAL_DOCUMENT",
      }),
    });

    const batchResult = await this.runBatchWithFallback({
      provider: "gemini",
      run: async () =>
        await runGeminiEmbeddingBatches({
          gemini,
          agentId: this.agentId,
          requests,
          wait: this.batch.wait,
          concurrency: this.batch.concurrency,
          pollIntervalMs: this.batch.pollIntervalMs,
          timeoutMs: this.batch.timeoutMs,
          debug: (message, data) => log.debug(message, { ...data, source, chunks: chunks.length }),
        }),
      fallback: async () => await this.embedChunksInBatches(chunks),
    });
    if (Array.isArray(batchResult)) {
      return batchResult;
    }
    this.applyBatchEmbeddings({ byCustomId: batchResult, mapping, embeddings });
    return embeddings;
  }

  private async embedBatchWithRetry(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    let attempt = 0;
    let delayMs = EMBEDDING_RETRY_BASE_DELAY_MS;
    while (true) {
      try {
        const timeoutMs = this.resolveEmbeddingTimeout("batch");
        log.debug("memory embeddings: batch start", {
          provider: this.provider.id,
          items: texts.length,
          timeoutMs,
        });
        return await this.withTimeout(
          this.provider.embedBatch(texts),
          timeoutMs,
          `memory embeddings batch timed out after ${Math.round(timeoutMs / 1000)}s`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!this.isRetryableEmbeddingError(message) || attempt >= EMBEDDING_RETRY_MAX_ATTEMPTS) {
          throw err;
        }
        const waitMs = Math.min(
          EMBEDDING_RETRY_MAX_DELAY_MS,
          Math.round(delayMs * (1 + Math.random() * 0.2)),
        );
        log.warn(`memory embeddings rate limited; retrying in ${waitMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        delayMs *= 2;
        attempt += 1;
      }
    }
  }

  private isRetryableEmbeddingError(message: string): boolean {
    return /(rate[_ ]limit|too many requests|429|resource has been exhausted|5\d\d|cloudflare)/i.test(
      message,
    );
  }

  private resolveEmbeddingTimeout(kind: "query" | "batch"): number {
    const isLocal = this.provider.id === "local";
    if (kind === "query") {
      return isLocal ? EMBEDDING_QUERY_TIMEOUT_LOCAL_MS : EMBEDDING_QUERY_TIMEOUT_REMOTE_MS;
    }
    return isLocal ? EMBEDDING_BATCH_TIMEOUT_LOCAL_MS : EMBEDDING_BATCH_TIMEOUT_REMOTE_MS;
  }

  private async embedQueryWithTimeout(text: string): Promise<number[]> {
    const timeoutMs = this.resolveEmbeddingTimeout("query");
    log.debug("memory embeddings: query start", { provider: this.provider.id, timeoutMs });
    return await this.withTimeout(
      this.provider.embedQuery(text),
      timeoutMs,
      `memory embeddings query timed out after ${Math.round(timeoutMs / 1000)}s`,
    );
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string,
  ): Promise<T> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return await promise;
    }
    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    try {
      return (await Promise.race([promise, timeoutPromise])) as T;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private async withBatchFailureLock<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void;
    const wait = this.batchFailureLock;
    this.batchFailureLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await wait;
    try {
      return await fn();
    } finally {
      release!();
    }
  }

  private async resetBatchFailureCount(): Promise<void> {
    await this.withBatchFailureLock(async () => {
      if (this.batchFailureCount > 0) {
        log.debug("memory embeddings: batch recovered; resetting failure count");
      }
      this.batchFailureCount = 0;
      this.batchFailureLastError = undefined;
      this.batchFailureLastProvider = undefined;
    });
  }

  private async recordBatchFailure(params: {
    provider: string;
    message: string;
    attempts?: number;
    forceDisable?: boolean;
  }): Promise<{ disabled: boolean; count: number }> {
    return await this.withBatchFailureLock(async () => {
      if (!this.batch.enabled) {
        return { disabled: true, count: this.batchFailureCount };
      }
      const increment = params.forceDisable
        ? BATCH_FAILURE_LIMIT
        : Math.max(1, params.attempts ?? 1);
      this.batchFailureCount += increment;
      this.batchFailureLastError = params.message;
      this.batchFailureLastProvider = params.provider;
      const disabled = params.forceDisable || this.batchFailureCount >= BATCH_FAILURE_LIMIT;
      if (disabled) {
        this.batch.enabled = false;
      }
      return { disabled, count: this.batchFailureCount };
    });
  }

  private isBatchTimeoutError(message: string): boolean {
    return /timed out|timeout/i.test(message);
  }

  private async runBatchWithTimeoutRetry<T>(params: {
    provider: string;
    run: () => Promise<T>;
  }): Promise<T> {
    try {
      return await params.run();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (this.isBatchTimeoutError(message)) {
        log.warn(`memory embeddings: ${params.provider} batch timed out; retrying once`);
        try {
          return await params.run();
        } catch (retryErr) {
          (retryErr as { batchAttempts?: number }).batchAttempts = 2;
          throw retryErr;
        }
      }
      throw err;
    }
  }

  private async runBatchWithFallback<T>(params: {
    provider: string;
    run: () => Promise<T>;
    fallback: () => Promise<number[][]>;
  }): Promise<T | number[][]> {
    if (!this.batch.enabled) {
      return await params.fallback();
    }
    try {
      const result = await this.runBatchWithTimeoutRetry({
        provider: params.provider,
        run: params.run,
      });
      await this.resetBatchFailureCount();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = (err as { batchAttempts?: number }).batchAttempts ?? 1;
      const forceDisable = /asyncBatchEmbedContent not available/i.test(message);
      const failure = await this.recordBatchFailure({
        provider: params.provider,
        message,
        attempts,
        forceDisable,
      });
      const suffix = failure.disabled ? "disabling batch" : "keeping batch enabled";
      log.warn(
        `memory embeddings: ${params.provider} batch failed (${failure.count}/${BATCH_FAILURE_LIMIT}); ${suffix}; falling back to non-batch embeddings: ${message}`,
      );
      return await params.fallback();
    }
  }

  private getIndexConcurrency(): number {
    return this.batch.enabled ? this.batch.concurrency : EMBEDDING_INDEX_CONCURRENCY;
  }

  private async indexFile(
    entry: MemoryFileEntry | SessionFileEntry,
    options: { source: MemorySource; content?: string },
  ) {
    const content = options.content ?? (await fs.readFile(entry.absPath, "utf-8"));
    // [CN-PATCH:memory-fix] Chunk quality filter: ensure only semantically meaningful
    // content enters the vector store.
    // - Empty / whitespace-only / too short / pure punctuation → discard
    // - YAML frontmatter → discard (metadata, no semantic value)
    // - Base64 / hex dumps → discard (binary noise)
    // - JSON blocks → extract string values as prose (keep useful info, drop structure)
    const MIN_CHUNK_CHARS = 8;
    const NOISE_PATTERN = /^[\s\-#*>`~|_=+\[\](){}!@$%^&\\/:;,.<>?'"]+$/;
    const rawChunks = chunkMarkdown(content, this.settings.chunking);
    const cleanedChunks: MemoryChunk[] = [];
    for (const chunk of rawChunks) {
      const trimmed = chunk.text.trim();
      if (trimmed.length < MIN_CHUNK_CHARS) continue;
      if (NOISE_PATTERN.test(trimmed)) continue;
      const cleaned = cleanChunkText(trimmed);
      if (cleaned === null) continue;
      if (cleaned !== trimmed) {
        // Text was transformed (e.g. JSON → extracted values); update chunk
        if (cleaned.length < MIN_CHUNK_CHARS) continue;
        cleanedChunks.push({ ...chunk, text: cleaned, hash: hashText(cleaned) });
      } else {
        cleanedChunks.push(chunk);
      }
    }
    const chunks = enforceEmbeddingMaxInputTokens(this.provider, cleanedChunks);
    if (options.source === "sessions" && "lineMap" in entry) {
      remapChunkLines(chunks, entry.lineMap);
    }
    const embeddings = this.batch.enabled
      ? await this.embedChunksWithBatch(chunks, entry, options.source)
      : await this.embedChunksInBatches(chunks);
    const sample = embeddings.find((embedding) => embedding.length > 0);
    const vectorReady = sample ? await this.ensureVectorReady(sample.length) : false;
    const now = Date.now();
    // [CN-PATCH:perf] 用显式事务包装所有写入操作：
    // 原来每个 INSERT 是独立事务（autocommit），N 个 chunk 产生 ~3N 次事务提交。
    // 包装后只有 1 次 BEGIN + 1 次 COMMIT，配合 WAL 模式减少 I/O 开销 10x+。
    // 同时保证原子性：任何一步失败，整个文件的索引操作全部回滚，不会留下半写数据。
    //
    // 安全性说明：BEGIN 到 COMMIT 之间全部是 DatabaseSync 同步调用，没有 await，
    // 所以 JS 事件循环不会让出控制权——即使 runWithConcurrency 并发执行多个 indexFile，
    // 每个事务都是原子完成的，不存在交错执行风险。
    let txnActive = false;
    try {
      this.db.exec("BEGIN");
      txnActive = true;
    } catch {
      // BEGIN 失败（如已在事务中）：不使用事务包装，回退到 autocommit 模式
      // 功能不受影响，只是失去批量提交的性能优化
    }
    try {
      if (vectorReady) {
        try {
          this.db
            .prepare(
              `DELETE FROM ${VECTOR_TABLE} WHERE id IN (SELECT id FROM chunks WHERE path = ? AND source = ?)`,
            )
            .run(entry.path, options.source);
        } catch {}
      }
      if (this.fts.enabled && this.fts.available) {
        try {
          this.db
            .prepare(`DELETE FROM ${FTS_TABLE} WHERE path = ? AND source = ? AND model = ?`)
            .run(entry.path, options.source, this.provider.model);
        } catch {}
      }
      this.db
        .prepare(`DELETE FROM chunks WHERE path = ? AND source = ?`)
        .run(entry.path, options.source);
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i] ?? [];
        const id = hashText(
          `${options.source}:${entry.path}:${chunk.startLine}:${chunk.endLine}:${chunk.hash}:${this.provider.model}`,
        );
        this.db
          .prepare(
            `INSERT INTO chunks (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               hash=excluded.hash,
               model=excluded.model,
               text=excluded.text,
               embedding=excluded.embedding,
               updated_at=excluded.updated_at`,
          )
          .run(
            id,
            entry.path,
            options.source,
            chunk.startLine,
            chunk.endLine,
            chunk.hash,
            this.provider.model,
            chunk.text,
            JSON.stringify(embedding),
            now,
          );
        // [CN-PATCH:memory-fix] Only insert non-zero embeddings into the vector table.
        // Zero-vectors (all zeros) can occur when the embedding provider errors silently
        // or returns a degenerate result. Inserting them pollutes cosine similarity search
        // because they have zero norm → NaN distance, causing unpredictable ranking.
        if (vectorReady && embedding.length > 0 && embedding.some((v) => v !== 0)) {
          try {
            this.db.prepare(`DELETE FROM ${VECTOR_TABLE} WHERE id = ?`).run(id);
          } catch {}
          this.db
            .prepare(`INSERT INTO ${VECTOR_TABLE} (id, embedding) VALUES (?, ?)`)
            .run(id, vectorToBlob(embedding));
        }
        if (this.fts.enabled && this.fts.available) {
          this.db
            .prepare(
              `INSERT INTO ${FTS_TABLE} (text, id, path, source, model, start_line, end_line)\n` +
                ` VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
              chunk.text,
              id,
              entry.path,
              options.source,
              this.provider.model,
              chunk.startLine,
              chunk.endLine,
            );
        }
      }
      this.db
        .prepare(
          `INSERT INTO files (path, source, hash, mtime, size) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(path) DO UPDATE SET
             source=excluded.source,
             hash=excluded.hash,
             mtime=excluded.mtime,
             size=excluded.size`,
        )
        .run(entry.path, options.source, entry.hash, entry.mtimeMs, entry.size);
      if (txnActive) {
        this.db.exec("COMMIT");
      }
    } catch (err) {
      if (txnActive) {
        try {
          this.db.exec("ROLLBACK");
        } catch {
          // ROLLBACK 失败说明事务已经结束，安全忽略
        }
      }
      throw err;
    }
  }
}

/**
 * [CN-PATCH:memory-fix] Clean chunk text before embedding.
 *
 * Returns:
 * - null → discard this chunk entirely (pure noise)
 * - original text → keep as-is
 * - transformed text → cleaned version to embed instead
 *
 * Strategy:
 * - YAML frontmatter: discard (metadata like tags/dates, no semantic value for search)
 * - Base64 / hex dumps: discard (binary noise)
 * - JSON blocks: extract string values as natural language prose, discard structure
 *   e.g. {"name":"张三","city":"北京"} → "张三 北京"
 * - Mixed prose+JSON: keep as-is (the prose part has semantic value)
 */
function cleanChunkText(text: string): string | null {
  // 1. YAML frontmatter: must have opening "---" AND closing "---" delimiter.
  // [CN-PATCH:memory-fix] 旧版只检查开头 "---" + key:value 模式，会误伤水平分割线后的正文。
  // 改为要求完整的 frontmatter 结构：^---\n...key:value...\n---
  // 只匹配 chunk 开头的 frontmatter（chunk 可能是文件开头，也可能是 chunkMarkdown 切出的片段）。
  if (/^---[ \t]*\n/.test(text)) {
    const closingIdx = text.indexOf("\n---", 4); // 找 closing ---（跳过开头的 ---）
    if (closingIdx > 0) {
      // 在 opening 和 closing --- 之间检查是否有 key: value 模式
      const between = text.slice(4, closingIdx);
      const yamlLines = between.split(/\n/).filter((l) => /^\w[\w\s.-]*:\s/.test(l.trim()));
      if (yamlLines.length >= 2) return null;
    }
  }

  // 2. Base64-dominant: 60+ consecutive base64 chars with mixed case + digits + base64 special chars.
  // [CN-PATCH:memory-fix] 提高阈值 40→60，且要求包含 +、/、= 中至少一个（base64 特征字符），
  // 避免长驼峰变量名（如 calculateTotalRevenueForFiscalYear2024）被误判。
  {
    const b64Match = text.match(/[A-Za-z0-9+/=]{60,}/);
    if (b64Match) {
      const m = b64Match[0];
      const hasMixedCase = /[A-Z]/.test(m) && /[a-z]/.test(m) && /\d/.test(m);
      const hasBase64Special = /[+/=]/.test(m);
      if (hasMixedCase && hasBase64Special) {
        return null;
      }
    }
  }

  // 3. Hex dumps or hash-like strings: 32+ hex chars dominant
  if (
    /[0-9a-f]{32,}/i.test(text) &&
    text.replace(/[0-9a-fA-F\s:.-]/g, "").length < text.length * 0.3
  ) {
    return null;
  }

  // 4. JSON blocks: extract meaningful string values instead of discarding
  // [CN-PATCH:memory-fix] 只有成功 JSON.parse 证实是合法 JSON 时才替换/丢弃。
  // 如果 parse 失败，说明是以 { 或 [ 开头的普通文本（如 "[Discussion] ..." ），
  // 此时应保留原文而非丢弃。避免误伤引号密集的对话内容。
  if (/^\s*[{\[]/.test(text)) {
    const jsonChars = text.replace(/[^{}\[\]":,]/g, "").length;
    if (jsonChars / text.length > 0.3) {
      const extracted = extractJsonStringValues(text);
      if (extracted === KEEP_ORIGINAL) return text; // 非合法 JSON，保留原文
      if (extracted !== null) return extracted; // 合法 JSON，提取成功
      return null; // 合法 JSON 无有用值，丢弃
    }
  }

  return text; // keep as-is
}

/**
 * Extract meaningful "key: value" pairs from a JSON-like text block.
 * Preserves key names for context (industry best practice, similar to
 * LlamaIndex JSONReader's key-value flattening approach).
 *
 * Example: {"name":"张三","age":30,"bio":"喜欢编程"}
 *        → "name: 张三\nbio: 喜欢编程"
 *
 * Keys provide important context — without them, "工程部" could be a
 * department, a location, or a product name. With the key "department",
 * the embedding captures the full meaning.
 *
 * Returns:
 * - extracted string → valid JSON with useful values extracted
 * - null → valid JSON but no useful string values (caller should discard)
 * - KEEP_ORIGINAL sentinel → not valid JSON, caller should keep original text
 */
const KEEP_ORIGINAL = Symbol("keep");
type ExtractResult = string | null | typeof KEEP_ORIGINAL;

function extractJsonStringValues(text: string): ExtractResult {
  const pairs: string[] = [];
  let isValidJson = false;

  // Try JSON.parse first for accurate extraction
  try {
    const parsed = JSON.parse(text.trim());
    isValidJson = true;
    collectKeyValuePairs(parsed, pairs, "");
  } catch {
    // [CN-PATCH:memory-fix] 正则降级需处理转义引号。
    // 旧正则 [^"] 在 \" 处截断，提取出损坏的片段。
    // 改用 (?:[^"\\]|\\.)* 正确跳过转义序列。
    const re = /"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.){2,})"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const key = m[1]!.replace(/\\"/g, '"').trim();
      const val = m[2]!.replace(/\\"/g, '"').trim();
      if (isUsefulStringValue(val) && !isNoiseKey(key)) {
        pairs.push(`${key}: ${val}`);
      }
    }
  }

  if (pairs.length === 0) {
    // 合法 JSON 无有用值 → 丢弃；非合法 JSON → 保留原文
    return isValidJson ? null : KEEP_ORIGINAL;
  }

  // Deduplicate and join with newlines — each key:value is a self-contained
  // semantic unit, newlines help embedding models treat them as separate facts
  const unique = [...new Set(pairs)];
  return unique.join("\n").trim() || (isValidJson ? null : KEEP_ORIGINAL);
}

/**
 * Recursively collect "key: value" pairs from a parsed JSON structure.
 * Only collects string values that pass the usefulness check.
 * Nested keys are flattened with dot notation for context.
 */
function collectKeyValuePairs(obj: unknown, out: string[], prefix: string, depth = 0): void {
  if (obj === null || obj === undefined) return;
  // Guard against extremely deep / circular structures
  if (depth > 20) return;

  if (typeof obj === "string") {
    const trimmed = obj.trim();
    if (isUsefulStringValue(trimmed) && prefix) {
      out.push(`${prefix}: ${trimmed}`);
    }
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      collectKeyValuePairs(item, out, prefix, depth + 1);
    }
    return;
  }

  if (typeof obj === "object") {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      if (isNoiseKey(key)) continue;
      const fullKey = prefix ? `${prefix}.${key}` : key;
      collectKeyValuePairs(val, out, fullKey, depth + 1);
    }
  }
}

/** Keys that are metadata/structural and don't carry semantic value. */
function isNoiseKey(key: string): boolean {
  const lower = key.toLowerCase();
  return /^(id|_id|uuid|uid|key|hash|token|timestamp|created_at|updated_at|deleted_at|etag|version|rev|__\w+)$/.test(
    lower,
  );
}

/** Check if a string value is useful prose (not a UUID, URL, hash, etc.). */
function isUsefulStringValue(val: string): boolean {
  if (val.length < 2) return false;
  // Skip UUIDs: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) return false;
  // Skip URLs
  if (/^https?:\/\//i.test(val)) return false;
  // Skip pure hex hashes (32+ hex chars)
  if (/^[0-9a-f]{32,}$/i.test(val)) return false;
  // Skip base64 blobs (40+ chars, mixed case + digits)
  if (/^[A-Za-z0-9+/=]{40,}$/.test(val) && /[A-Z]/.test(val) && /[a-z]/.test(val) && /\d/.test(val))
    return false;
  // Skip ISO timestamps like 2024-01-15T10:30:00Z
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) return false;
  // Skip pure numbers/booleans stored as strings
  if (/^-?\d+\.?\d*$/.test(val)) return false;
  return true;
}

export const memoryManagerEmbeddingOps = MemoryManagerEmbeddingOps.prototype;
