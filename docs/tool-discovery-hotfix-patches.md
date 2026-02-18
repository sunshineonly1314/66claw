# 工具发现系统 - 紧急修复补丁

**创建日期**: 2026-02-18
**基于审查**: `docs/tool-discovery-code-review.md`
**状态**: 待应用

---

## 🔴 P0 补丁 (立即修复)

### Patch 1: DB 连接泄漏修复

**文件**: `src/dispatch/tool-index.ts`
**位置**: 行 65-79 (openToolIndex 函数)

**问题**: 当 dataDir 变化时,旧 DB 连接未关闭

**修复**:
```typescript
export function openToolIndex(dataDir: string): DatabaseSync {
  const newDbPath = join(dataDir, DB_FILENAME);

  // ✅ FIX: 如果路径变化,先关闭旧连接
  if (_db && _dbPath && _dbPath !== newDbPath) {
    try {
      _db.close();
    } catch { /* ignore close error */ }
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
```

---

### Patch 2: FTS5 注入风险修复

**文件**: `src/dispatch/tool-index.ts`
**位置**: 行 385-423 (buildFtsQuery 函数)

**问题**: FTS5 查询双引号未转义

**修复**:
```typescript
/**
 * 转义 FTS5 特殊字符。
 * FTS5 规则: 双引号需转义为两个双引号 ("" 表示字面 ")
 */
function escapeFtsToken(term: string): string {
  return term.replace(/"/g, '""');
}

function buildFtsQuery(raw: string): string | null {
  const cleaned = raw.replace(/['"{}()\[\]]/g, " ").trim();
  if (cleaned.length < 2) return null;

  const terms: string[] = [];

  // ... (CJK + 英文提取逻辑不变)

  const unique = [...new Set(terms)].slice(0, 20);
  if (unique.length === 0) return null;

  // ✅ FIX: 转义双引号后再包裹
  return unique.map((t) => `"${escapeFtsToken(t)}"`).join(" OR ");
}
```

---

### Patch 3: Embedding API 超时修复

**文件**: `src/dispatch/tool-index.ts`
**位置**: 行 580-609 (createToolEmbeddingClient 函数)

**问题**: fetch 无超时,可能导致长时间挂起

**修复**:
```typescript
export function createToolEmbeddingClient(config: ToolDiscoveryEmbeddingConfig): {
  embed: (texts: string[]) => Promise<number[][]>;
  model: string;
  dims: number;
} {
  const model = config.model ?? "BAAI/bge-m3";
  const baseUrl = (config.baseUrl ?? "https://api.siliconflow.cn/v1").replace(/\/$/, "");
  const apiKey = config.apiKey ?? "";
  const dims = config.dimensions ?? 1024;
  const timeout = config.timeout ?? 15000; // ✅ FIX: 默认 15s 超时

  async function embed(texts: string[]): Promise<number[][]> {
    if (!apiKey) throw new Error("Tool discovery embedding apiKey not configured");

    // ✅ FIX: 添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const resp = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input: texts }),
        signal: controller.signal, // ✅ FIX: 绑定信号
      });

      clearTimeout(timeoutId); // ✅ FIX: 清除定时器

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Embedding API error ${resp.status}: ${text.slice(0, 200)}`);
      }

      const json = (await resp.json()) as { data: Array<{ embedding: number[] }> };
      return json.data.map((d) => d.embedding);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Embedding API timeout after ${timeout}ms`);
      }
      throw err;
    }
  }

  return { embed, model, dims };
}
```

**配置类型更新**:
```typescript
// src/config/types.tool-discovery.ts
export interface ToolDiscoveryEmbeddingConfig {
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  dimensions?: number;
  timeout?: number; // ✅ 新增字段
}
```

---

### Patch 4: 错误日志增强

**文件**: `src/dispatch/tool-discovery.ts`
**位置**: 行 49-103 (discoverTools 函数)

**问题**: 错误静默失败,无调试日志

**修复**:
```typescript
export async function discoverTools(
  prompt: string,
  config?: ToolDiscoveryConfig,
  dataDir?: string,
): Promise<ToolDiscoveryResult> {
  const startTime = performance.now();

  const emptyResult: ToolDiscoveryResult = {
    skillHints: [],
    mcpToolHints: [],
    toolHints: [],
    mcpSuggestions: [],
    toolSummaryPrompt: "",
    confidence: 0,
    searchLatencyMs: 0,
  };

  // ✅ FIX: 添加日志
  if (config?.enabled === false) {
    console.debug('[tool-discovery] Disabled by config');
    return emptyResult;
  }

  if (!prompt || prompt.trim().length < 2) {
    console.debug('[tool-discovery] Query too short', { prompt });
    return emptyResult;
  }

  let db: DatabaseSync;
  try {
    const dir = dataDir ?? resolveDataDir();
    if (!dir) {
      // ✅ FIX: 记录环境变量状态
      console.warn('[tool-discovery] Cannot resolve data dir', {
        env: {
          OPENCLAWCN_DATA_DIR: process.env.OPENCLAWCN_DATA_DIR,
          OPENCLAWCN_STATE_DIR: process.env.OPENCLAWCN_STATE_DIR,
          HOME: process.env.HOME,
          USERPROFILE: process.env.USERPROFILE,
        },
      });
      return emptyResult;
    }
    db = openToolIndex(dir);
  } catch (err) {
    // ✅ FIX: 记录错误详情
    console.error('[tool-discovery] Failed to open tool index', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return emptyResult;
  }

  const stats = getIndexStats(db);
  if (stats.entryCount === 0) {
    console.warn('[tool-discovery] Index is empty', stats);
    return emptyResult;
  }

  const maxResults = config?.search?.maxResults ?? DEFAULT_MAX_RESULTS;
  const minScore = config?.search?.minScore ?? DEFAULT_MIN_SCORE;

  let results: ToolSearchResult[];
  try {
    results = await hybridSearch(db, prompt, {
      maxResults,
      minScore,
      hybridWeight: config?.search?.hybridWeight
        ? { fts: config.search.hybridWeight.fts, vector: config.search.hybridWeight.vector }
        : undefined,
    });
  } catch (err) {
    // ✅ FIX: 记录搜索失败
    console.error('[tool-discovery] Search failed', {
      error: err instanceof Error ? err.message : String(err),
      prompt,
      config,
    });
    return emptyResult;
  }

  const searchLatencyMs = performance.now() - startTime;

  if (results.length === 0) {
    console.debug('[tool-discovery] No results found', { prompt, searchLatencyMs });
    return { ...emptyResult, searchLatencyMs };
  }

  // ✅ FIX: 记录成功搜索
  console.debug('[tool-discovery] Search complete', {
    prompt,
    resultCount: results.length,
    searchLatencyMs,
  });

  // ... (后续处理逻辑不变)
}
```

---

## 🟡 P1 补丁 (本周修复)

### Patch 5: 向量化并发限流

**文件**: `src/dispatch/tool-index.ts`
**位置**: 行 681-717 (ensureVectors 批量向量化部分)

**问题**: 所有批次并发请求,可能触发 API 429

**修复**:
```typescript
// 在文件顶部添加限流工具
/**
 * 简单的并发限制实现 (避免引入 p-limit 依赖)
 */
async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const p = task().then((result) => {
      results.push(result);
      executing.splice(executing.indexOf(p), 1);
    });
    executing.push(p);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

// 修改 ensureVectors 中的批量处理
export async function ensureVectors(
  db: DatabaseSync,
  embeddingConfig: ToolDiscoveryEmbeddingConfig,
): Promise<{ vectorized: boolean; count: number; error?: string }> {
  // ... (前面代码不变)

  // 批量向量化（每批 64 条,最多 5 个并发批次）
  const BATCH_SIZE = 64;
  const CONCURRENCY = 5; // ✅ FIX: 限制并发数
  let totalVectorized = 0;

  const insertVec = db.prepare(
    `INSERT OR REPLACE INTO ${VEC_TABLE} (id, embedding) VALUES (?, ?)`,
  );

  // ✅ FIX: 将批次处理改为限流并发
  const batches: Array<Array<typeof rows[0]>> = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batches.push(rows.slice(i, i + BATCH_SIZE));
  }

  const tasks = batches.map((batch, batchIndex) => async () => {
    const texts = batch.map((r) => {
      const parts = [r.description];
      if (r.description_cn) parts.push(r.description_cn);
      const text = parts.join(" ").trim();
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

      // ✅ FIX: 进度日志
      console.log(`[tool-index] Vectorized batch ${batchIndex + 1}/${batches.length} (${totalVectorized}/${rows.length})`);

      return { success: true };
    } catch (err) {
      try { db.exec("ROLLBACK"); } catch { /* ignore */ }
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[tool-index] Batch ${batchIndex + 1} failed:`, message);

      // ✅ FIX: 429 错误特殊处理 - 指数退避
      if (message.includes('429') || message.includes('Too Many Requests')) {
        const delay = Math.min(2000 * Math.pow(2, batchIndex % 5), 30000);
        console.log(`[tool-index] Rate limited, waiting ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        // 重试一次
        try {
          const retryEmbeddings = await client.embed(texts);
          db.exec("BEGIN");
          for (let j = 0; j < batch.length; j++) {
            const vec = retryEmbeddings[j];
            if (vec && vec.length > 0) {
              const blob = Buffer.from(new Float32Array(vec).buffer);
              insertVec.run(batch[j].id, blob);
              totalVectorized++;
            }
          }
          db.exec("COMMIT");
          return { success: true };
        } catch {
          return { success: false, error: message };
        }
      }

      return { success: false, error: message };
    }
  });

  // ✅ FIX: 限流执行
  const batchResults = await runWithConcurrency(tasks, CONCURRENCY);

  // 检查是否有批次失败
  const failedBatches = batchResults.filter((r) => !r.success);
  if (failedBatches.length > 0 && failedBatches.length === batchResults.length) {
    // 所有批次都失败 → 返回错误
    const firstError = failedBatches[0].error || 'Unknown error';
    return { vectorized: false, count: totalVectorized, error: firstError };
  }

  // 部分成功也标记为已向量化（下次启动会增量补全）
  upsertMeta(db, "vectorized", "true");
  upsertMeta(db, "vec_model", client.model);
  upsertMeta(db, "vec_model_pending", "");
  upsertMeta(db, "vec_dims", String(client.dims));
  upsertMeta(db, "vec_count", String(totalVectorized));
  upsertMeta(db, "vectorized_at", String(Date.now()));

  return { vectorized: true, count: totalVectorized };
}
```

---

### Patch 6: 路径解析优化 (打包环境)

**文件**: `src/dispatch/tool-discovery.ts`
**位置**: 行 243-268 (resolveDataDir 函数)

**问题**: 打包环境路径解析可能失败

**修复**:
```typescript
function resolveDataDir(): string | undefined {
  // 1. 显式环境变量
  const explicit = process.env.OPENCLAWCN_DATA_DIR?.trim();
  if (explicit) return explicit;

  // ✅ FIX: 检测打包环境
  const isPackaged =
    typeof (process as any).pkg !== 'undefined' || // pkg
    typeof (process as any).nexe !== 'undefined' || // nexe
    typeof (process as any).__compiled !== 'undefined' || // bytenode
    __filename.includes('/snapshot/') || // bun build
    __filename.includes('\\snapshot\\'); // bun build (Windows)

  // 2. 项目内 data/ (仅开发环境)
  if (!isPackaged) {
    try {
      const thisDir = typeof __dirname !== "undefined"
        ? __dirname
        : dirname(fileURLToPath(import.meta.url));
      const projectData = resolve(thisDir, "..", "..", "data");
      if (existsSync(join(projectData, "tool-index.sqlite"))) {
        console.debug('[tool-discovery] Using project data dir:', projectData);
        return projectData;
      }
    } catch { /* __dirname / import.meta.url 不可用 */ }
  }

  // 3. 打包环境: 检查可执行文件同级 data/ 目录
  if (isPackaged) {
    try {
      const exeDir = dirname(process.execPath);
      const packagedData = join(exeDir, 'data');
      if (existsSync(join(packagedData, "tool-index.sqlite"))) {
        console.debug('[tool-discovery] Using packaged data dir:', packagedData);
        return packagedData;
      }
    } catch { /* process.execPath 不可用 */ }
  }

  // 4. 标准 STATE_DIR (~/.openclawcn)
  try {
    const stateOverride = process.env.OPENCLAWCN_STATE_DIR?.trim() || process.env.CLAWDBOT_STATE_DIR?.trim();
    if (stateOverride) {
      console.debug('[tool-discovery] Using STATE_DIR override:', stateOverride);
      return stateOverride;
    }
    const home = process.env.HOME || process.env.USERPROFILE;
    if (home) {
      const stateDir = join(home, ".openclawcn");
      console.debug('[tool-discovery] Using default STATE_DIR:', stateDir);
      return stateDir;
    }
  } catch { /* fallback 失败 */ }

  console.warn('[tool-discovery] All data dir resolution methods failed');
  return undefined;
}
```

---

## 🟢 P2 补丁 (后续优化)

### Patch 7: FTS5 不可用 Fallback

**文件**: `src/dispatch/tool-index.ts`

**修复**:
```typescript
// 模块级标志
let _ftsAvailable = false;

function ensureSchema(db: DatabaseSync): void {
  db.exec(`...`); // tools 表创建不变

  // FTS5 with trigram tokenizer
  try {
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE} USING fts5(...)`);
    _ftsAvailable = true;
  } catch {
    try {
      db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE} USING fts5(...)`); // unicode61 fallback
      _ftsAvailable = true;
    } catch {
      _ftsAvailable = false;
      console.warn('[tool-index] FTS5 not available, using LIKE-only search');
    }
  }
}

function searchFts(db: DatabaseSync, query: string, limit: number): Array<{ id: string; rank: number }> {
  if (!_ftsAvailable) {
    // ✅ 纯 LIKE 搜索
    return searchLikeOnly(db, query, limit);
  }
  // ... 正常 FTS5 逻辑
}

function searchLikeOnly(db: DatabaseSync, query: string, limit: number): Array<{ id: string; rank: number }> {
  const likeTerms = extractLikeTerms(query);
  if (likeTerms.length === 0) return [];

  const esc = "ESCAPE '\\\\'";
  const conditions = likeTerms
    .map(() => `(name LIKE ? ${esc} OR description LIKE ? ${esc} OR description_cn LIKE ? ${esc} OR tags LIKE ? ${esc})`)
    .join(" OR ");

  const params: string[] = [];
  for (const term of likeTerms) {
    const safeTerm = term.replace(/[%_\\\\]/g, "\\\\$&");
    const pattern = `%${safeTerm}%`;
    params.push(pattern, pattern, pattern, pattern);
  }

  return db
    .prepare(
      `SELECT id, -1.0 AS rank FROM ${TOOLS_TABLE}
       WHERE ${conditions}
       LIMIT ?`,
    )
    .all(...params, limit) as Array<{ id: string; rank: number }>;
}
```

---

### Patch 8: buildIndex 进度回调

**文件**: `src/dispatch/tool-index.ts`

**修复**:
```typescript
export function buildIndex(
  db: DatabaseSync,
  entries: ToolIndexEntry[],
  onProgress?: (current: number, total: number) => void,
): void {
  db.exec("BEGIN");
  try {
    db.exec(`DELETE FROM ${TOOLS_TABLE}`);
    safeExec(db, `DELETE FROM ${FTS_TABLE}`);
    safeExec(db, `DELETE FROM ${VEC_TABLE}`);

    const insertTool = db.prepare(`...`);
    let insertFts: ReturnType<DatabaseSync["prepare"]> | null = null;
    try {
      insertFts = db.prepare(`...`);
    } catch { /* FTS not available */ }

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const tagsStr = e.tags.join(", ");
      insertTool.run(e.id, e.type, e.name, e.description, e.descriptionCn ?? "", tagsStr, e.metadataJson ?? "{}");
      insertFts?.run(e.id, e.type, e.name, e.description, e.descriptionCn ?? "", tagsStr);

      // ✅ FIX: 进度回调
      if (onProgress && (i % 1000 === 0 || i === entries.length - 1)) {
        onProgress(i + 1, entries.length);
      }
    }

    const now = Date.now();
    upsertMeta(db, "version", "1");
    upsertMeta(db, "entry_count", String(entries.length));
    upsertMeta(db, "built_at", String(now));

    db.exec("COMMIT");
    onProgress?.(entries.length, entries.length); // 最终回调
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
```

**CLI 脚本使用**:
```typescript
// scripts/build-tool-index.ts
buildIndex(db, unique, (current, total) => {
  const percent = ((current / total) * 100).toFixed(1);
  console.log(`  Building index: ${current}/${total} (${percent}%)`);
});
```

---

## 📋 应用补丁的顺序

### 1. 立即应用 (P0,估计 1 小时)
```bash
# Patch 1: DB 连接泄漏
# Patch 2: FTS5 注入
# Patch 3: Embedding 超时
# Patch 4: 错误日志

git checkout -b hotfix/tool-discovery-p0
# 手动应用 Patch 1-4
pnpm test src/dispatch/tool-index.test.ts
pnpm test src/dispatch/tool-discovery.test.ts
git commit -m "fix(tool-discovery): P0 hotfixes - DB leak, injection, timeout, logging"
```

### 2. 本周应用 (P1,估计半天)
```bash
git checkout -b hotfix/tool-discovery-p1
# 手动应用 Patch 5-6
pnpm test
git commit -m "fix(tool-discovery): P1 fixes - concurrency limit, path resolution"
```

### 3. 后续优化 (P2,按需)
```bash
# Patch 7-8 可选,视用户反馈决定优先级
```

---

## ✅ 验证清单

应用每个补丁后,运行以下验证:

### Patch 1 (DB 连接泄漏)
```typescript
const db1 = openToolIndex('/tmp/test1');
const db2 = openToolIndex('/tmp/test2'); // 应关闭 db1
// 检查 /tmp/test1 的 -wal 文件是否释放
```

### Patch 2 (FTS5 注入)
```typescript
const results = await hybridSearch(db, 'test"OR"1"="1', { maxResults: 10 });
// 应返回正常结果,不抛错
```

### Patch 3 (超时)
```typescript
// Mock slow API
vi.spyOn(global, 'fetch').mockImplementation(() =>
  new Promise((r) => setTimeout(r, 20000))
);
await expect(client.embed(['test'])).rejects.toThrow('timeout');
```

### Patch 4 (日志)
```typescript
const result = await discoverTools('', config);
// 应在 console 看到 "[tool-discovery] Query too short"
```

### Patch 5 (并发限流)
```bash
# 向量化 11,969 条工具,观察日志
pnpm tool-index:build
# 应看到:
# [tool-index] Vectorized batch 1/187 (64/11969)
# [tool-index] Vectorized batch 2/187 (128/11969)
# ...
# 不应触发 429 错误
```

### Patch 6 (路径解析)
```bash
# 打包测试
pnpm build
./dist/openclaw --help
# 应正确加载 data/tool-index.sqlite
```

---

**更新时间**: 2026-02-18
**维护者**: OpenClawCN Team
**状态**: ✅ 补丁就绪,等待应用
