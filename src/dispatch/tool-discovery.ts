/**
 * [CN-PATCH:tool-discovery] 智能工具发现模块
 *
 * 替代 auto-discovery.ts 的搜索逻辑：
 *   - 基于 tool-index.sqlite（FTS5 BM25 + sqlite-vec 向量混合搜索）
 *   - 从 12k+ 工具中 <10ms 选出 ≤50 个
 *   - 分桶：已安装 skill/core → hints，可安装 MCP → mcpSuggestions
 *   - 生成 toolSummaryPrompt 注入 system prompt
 *
 * 隔离原则：
 *   - 不修改 auto-discovery.ts（旧版保留做 fallback）
 *   - engine.ts 条件分支选择走新版或旧版
 */

import { join, resolve, dirname } from "node:path";
import { existsSync, statSync, copyFileSync, mkdirSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";
import type {
  ToolDiscoveryConfig,
  ToolDiscoveryEmbeddingConfig,
  ToolDiscoveryResult,
  ToolSearchResult,
  ToolIndexEntry,
  McpSuggestion,
} from "../config/types.tool-discovery.js";
import { hybridSearch, openToolIndex, getIndexStats, createToolEmbeddingClient, isVectorized, ensureVectors, incrementalUpdate } from "./tool-index.js";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MAX_RESULTS = 8;
const DEFAULT_MIN_SCORE = 0.2;

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * 智能工具发现。
 *
 * 调用 tool-index 的混合搜索，将结果分桶为 skillHints / mcpToolHints / toolHints，
 * 并生成 toolSummaryPrompt（给 LLM 的结构化摘要文本）。
 *
 * @param prompt 用户输入
 * @param config ToolDiscoveryConfig
 * @param dataDir tool-index.sqlite 所在目录（可选，默认从环境变量推导）
 * @returns ToolDiscoveryResult
 */
export async function discoverTools(
  prompt: string,
  config?: ToolDiscoveryConfig,
  dataDir?: string,
): Promise<ToolDiscoveryResult> {
  const startTime = performance.now();

  // 空结果模板
  const emptyResult: ToolDiscoveryResult = {
    skillHints: [],
    mcpToolHints: [],
    toolHints: [],
    mcpSuggestions: [],
    toolSummaryPrompt: "",
    confidence: 0,
    searchLatencyMs: 0,
  };

  // 未启用或无 prompt → 返回空
  // FIX: 添加调试日志
  if (config?.enabled === false) {
    console.debug("[tool-discovery] Disabled by config");
    return emptyResult;
  }

  if (!prompt || prompt.trim().length < 2) {
    console.debug("[tool-discovery] Query too short", { prompt });
    return emptyResult;
  }

  // 打开 DB（利用 openToolIndex 的 singleton 缓存）
  let db: DatabaseSync;
  try {
    const dir = dataDir ?? resolveDataDir();
    if (!dir) {
      // FIX: 记录环境变量状态以便调试
      console.warn("[tool-discovery] Cannot resolve data dir", {
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
    // FIX: 记录错误详情
    console.error("[tool-discovery] Failed to open tool index", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return emptyResult;
  }

  // 检查索引是否有数据
  const stats = getIndexStats(db);
  if (stats.entryCount === 0) {
    console.warn("[tool-discovery] Index is empty", stats);
    return emptyResult;
  }

  // 执行混合搜索
  const maxResults = config?.search?.maxResults ?? DEFAULT_MAX_RESULTS;
  const minScore = config?.search?.minScore ?? DEFAULT_MIN_SCORE;

  // ── [CN-PATCH:tool-discovery] 首次启动自动向量化（后台非阻塞）──
  if (config?.embedding?.apiKey && !isVectorized(db)) {
    // 后台启动向量化，不阻塞当前请求（首次用 FTS-only，完成后自动切换 hybrid）
    ensureVectors(db, config.embedding).then((result) => {
      if (result.vectorized) {
        console.info(`[tool-discovery] Vectorization complete: ${result.count} entries embedded`);
      } else if (result.error) {
        console.warn(`[tool-discovery] Vectorization failed: ${result.error}`);
      }
    }).catch((err) => {
      console.warn("[tool-discovery] Vectorization background error", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // ── [CN-PATCH:tool-discovery] 生成查询向量（如果索引已向量化且有 API key）──
  let queryVec: number[] | undefined;
  if (config?.embedding?.apiKey && isVectorized(db)) {
    try {
      const client = createToolEmbeddingClient(config.embedding);
      const [vec] = await client.embed([prompt]);
      queryVec = vec;
    } catch (err) {
      // 向量生成失败不阻塞，退化为纯 FTS5
      console.debug("[tool-discovery] Query embedding failed, falling back to FTS-only", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let results: ToolSearchResult[];
  try {
    results = await hybridSearch(db, prompt, {
      maxResults,
      minScore,
      queryVec,
      hybridWeight: config?.search?.hybridWeight
        ? { fts: config.search.hybridWeight.fts, vector: config.search.hybridWeight.vector }
        : undefined,
    });
  } catch (err) {
    // FIX: 记录搜索失败
    console.error("[tool-discovery] Search failed", {
      error: err instanceof Error ? err.message : String(err),
      prompt,
      config,
    });
    return emptyResult;
  }

  const searchLatencyMs = performance.now() - startTime;

  if (results.length === 0) {
    console.debug("[tool-discovery] No results found", { prompt, searchLatencyMs });
    return { ...emptyResult, searchLatencyMs };
  }

  // FIX: 记录成功搜索
  console.debug("[tool-discovery] Search complete", {
    prompt,
    resultCount: results.length,
    searchLatencyMs,
  });

  // 分桶
  const skillHints: string[] = [];
  const mcpToolHints: string[] = [];
  const toolHints: string[] = [];
  const mcpSuggestions: McpSuggestion[] = [];

  for (const r of results) {
    const { entry, score } = r;
    switch (entry.type) {
      case "skill":
        skillHints.push(entry.name);
        break;
      case "mcp": {
        // MCP server ID → wildcard 格式 mcp_{serverId}_*
        mcpToolHints.push(`mcp_${entry.id.replace(/^mcp:/, "")}_*`);
        // 构建 McpSuggestion
        const meta = parseMetadata(entry.metadataJson);
        mcpSuggestions.push({
          serverId: entry.id.replace(/^mcp:/, ""),
          friendlyName: entry.name,
          description: entry.descriptionCn ?? entry.description,
          npmPackage: meta?.npmPackage,
          sseUrl: meta?.sseUrl,
          score,
        });
        break;
      }
      case "core":
        toolHints.push(entry.name);
        break;
    }
  }

  // 计算整体置信度（top-3 平均分）
  const top3Scores = results.slice(0, 3).map((r) => r.score);
  const confidence = top3Scores.reduce((sum, s) => sum + s, 0) / Math.max(top3Scores.length, 1);

  // 生成 toolSummaryPrompt
  const toolSummaryPrompt = buildToolSummaryPrompt(results);

  return {
    skillHints,
    mcpToolHints,
    toolHints,
    mcpSuggestions,
    toolSummaryPrompt,
    confidence,
    searchLatencyMs,
    rawResults: results,
  };
}

// ---------------------------------------------------------------------------
// Tool Summary Prompt Builder
// ---------------------------------------------------------------------------

/**
 * 构建注入 system prompt 的工具摘要文本。
 * 格式紧凑，给 LLM 足够上下文做最终工具选择。
 */
function buildToolSummaryPrompt(results: ToolSearchResult[]): string {
  if (results.length === 0) return "";

  const lines: string[] = [];
  lines.push("## Available Tools (auto-discovered, ranked by relevance)\n");

  // 按类型分组
  const skills = results.filter((r) => r.entry.type === "skill");
  const mcps = results.filter((r) => r.entry.type === "mcp");
  const cores = results.filter((r) => r.entry.type === "core");

  if (skills.length > 0) {
    lines.push("### Skills");
    for (const r of skills.slice(0, 3)) {
      const desc = r.entry.descriptionCn ?? r.entry.description;
      lines.push(`- **${r.entry.name}**: ${desc}`);
    }
    if (skills.length > 3) {
      lines.push(`- _...and ${skills.length - 3} more skills_`);
    }
    lines.push("");
  }

  if (mcps.length > 0) {
    lines.push("### MCP Servers");
    for (const r of mcps.slice(0, 3)) {
      const desc = r.entry.descriptionCn ?? r.entry.description;
      const meta = parseMetadata(r.entry.metadataJson);
      const installHint = meta?.npmPackage ? ` (npm: ${meta.npmPackage})` : "";
      lines.push(`- **${r.entry.name}**: ${desc}${installHint}`);
    }
    if (mcps.length > 3) {
      lines.push(`- _...and ${mcps.length - 3} more MCP servers_`);
    }
    lines.push("");
  }

  if (cores.length > 0) {
    lines.push("### Core Tools");
    for (const r of cores) {
      const desc = r.entry.descriptionCn ?? r.entry.description;
      lines.push(`- **${r.entry.name}**: ${desc}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseMetadata(json?: string): Record<string, string> | undefined {
  if (!json || json === "{}") return undefined;
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

/**
 * 推导 tool-index.sqlite 所在目录。
 *
 * 优先级：
 *   1. 环境变量 OPENCLAWCN_DATA_DIR（显式指定）
 *   2. 项目内 data/（CI build-tool-index.ts 的默认输出 — 打包分发场景）
 *   3. 标准 STATE_DIR（复用项目已有的路径解析 ~/.openclawcn）
 */
function resolveDataDir(): string | undefined {
  // 1. 显式环境变量
  const explicit = process.env.OPENCLAWCN_DATA_DIR?.trim();
  if (explicit) return explicit;

  // 2. 项目内 data/（CI 构建脚本的输出路径，分发包内自带索引）
  try {
    const thisDir =
      typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
    // 尝试多个相对路径：
    //   - bundled (dist/tool-discovery-*.js): thisDir = dist/ → ../data
    //   - unbundled (dist/dispatch/tool-discovery.js): thisDir = dist/dispatch/ → ../../data
    //   - source (src/dispatch/tool-discovery.ts): thisDir = src/dispatch/ → ../../data
    const candidates = [
      resolve(thisDir, "..", "data"),       // bundled flat dist/
      resolve(thisDir, "..", "..", "data"),  // unbundled dist/dispatch/ or src/dispatch/
    ];
    for (const candidate of candidates) {
      if (existsSync(join(candidate, "tool-index.sqlite"))) {
        return candidate;
      }
    }
  } catch {
    /* __dirname / import.meta.url 不可用 */
  }

  // 3. 标准 STATE_DIR（与 config/sessions/memory 同目录）
  try {
    const stateOverride =
      process.env.OPENCLAWCN_STATE_DIR?.trim() || process.env.CLAWDBOT_STATE_DIR?.trim();
    if (stateOverride) return stateOverride;
    const home = process.env.HOME || process.env.USERPROFILE;
    if (home) return join(home, ".openclawcn");
  } catch {
    /* fallback 失败 */
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Startup Bootstrap — copy bundled tool-index.sqlite to user data dir
// ---------------------------------------------------------------------------

const DB_FILENAME = "tool-index.sqlite";

/**
 * 启动时同步预构建的 tool-index.sqlite 到用户数据目录。
 *
 * 与 ensureMcpBaseline / ensureQcBaseline 类似，在 server-startup 时调用。
 * 逻辑：
 *   - 从 packageRoot/data/tool-index.sqlite 读取预构建数据库
 *   - 复制到 ~/.openclawcn/tool-index.sqlite（如果缺失或过期）
 *   - 使用文件大小 + mtime 做简单版本检测，避免每次启动都复制
 *
 * @returns 同步结果
 */
export function ensureToolIndexBootstrap(packageRoot: string): {
  copied: boolean;
  message: string;
} {
  const bundledPath = join(packageRoot, "data", DB_FILENAME);

  if (!existsSync(bundledPath)) {
    return { copied: false, message: "no bundled tool-index found" };
  }

  // 确定目标目录
  const targetDir = resolveUserDataDir();
  if (!targetDir) {
    return { copied: false, message: "cannot resolve user data dir" };
  }

  const targetPath = join(targetDir, DB_FILENAME);

  // 检查是否需要复制
  try {
    const bundledStat = statSync(bundledPath);

    if (existsSync(targetPath)) {
      const targetStat = statSync(targetPath);

      // 目标文件存在：只在 bundled 更新或目标明显为空(< 64KB)时覆盖
      const isTargetStale = bundledStat.mtimeMs > targetStat.mtimeMs;
      const isTargetEmpty = targetStat.size < 65536; // 空 schema-only DB < 64KB
      if (!isTargetStale && !isTargetEmpty) {
        return { copied: false, message: "target up-to-date" };
      }
    }

    // 确保目标目录存在
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // 删除可能残留的 WAL/SHM 文件（防止旧 WAL 覆盖新数据）
    for (const suffix of ["-wal", "-shm"]) {
      const walPath = targetPath + suffix;
      try {
        if (existsSync(walPath)) {
          unlinkSync(walPath);
        }
      } catch {
        /* ignore — WAL cleanup is best-effort */
      }
    }

    // 复制
    copyFileSync(bundledPath, targetPath);

    return {
      copied: true,
      message: `synced ${(bundledStat.size / 1024 / 1024).toFixed(1)}MB tool-index to ${targetDir}`,
    };
  } catch (err) {
    return {
      copied: false,
      message: `copy failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** 获取用户数据目录（与 resolveDataDir 优先级3 一致） */
function resolveUserDataDir(): string | undefined {
  const stateOverride =
    process.env.OPENCLAWCN_STATE_DIR?.trim() || process.env.CLAWDBOT_STATE_DIR?.trim();
  if (stateOverride) return stateOverride;
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) return join(home, ".openclawcn");
  return undefined;
}

// ---------------------------------------------------------------------------
// MCP → tool-index 增量同步桥接
// ---------------------------------------------------------------------------

const LOG_PREFIX = "[syncMcpToToolIndex]";

/**
 * 解析 tags：兼容 JSON 字符串（来自 mcp_items.tags 列）和原生数组（来自 McpMarketplaceItem.tags）。
 */
function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch { /* not JSON, treat as single tag */ }
    return [raw];
  }
  return [];
}

/**
 * 将 McpMarketplaceItem 转换为 ToolIndexEntry。
 * 转换逻辑与 CI 脚本 build-tool-index.ts 的 loadMcpEntries() 保持一致。
 *
 * 兼容两种数据源：
 *   - McpMarketplaceItem（camelCase 字段，tags 为 string[]）
 *   - mcp_items SQL 行（snake_case alias，tags 为 JSON 字符串）
 */
function mcpItemToToolEntry(item: Record<string, any>): ToolIndexEntry {
  const tags = parseTags(item.tags);
  const category = item.category ? String(item.category) : undefined;

  return {
    id: `mcp:${item.serverId ?? item.id ?? "unknown"}`,
    type: "mcp",
    name: String(item.friendlyNameEn ?? item.friendlyName ?? item.serverId ?? "unknown"),
    description: String(item.descriptionEn ?? item.description ?? ""),
    descriptionCn: String(item.descriptionCn ?? item.description ?? item.friendlyName ?? ""),
    tags: [
      ...tags,
      ...(category && !tags.includes(category) ? [category] : []),
    ],
    metadataJson: JSON.stringify({
      npmPackage: item.npmPackage ?? undefined,
      pypiPackage: item.pypiPackage ?? undefined,
      sseUrl: item.sseUrl ?? undefined,
      category: category ?? undefined,
      sourceUrl: item.sourceUrl ?? undefined,
      platforms: item.platforms ?? undefined,
    }),
  };
}

/**
 * 为 ToolIndexEntry 生成内容指纹（用于检测实际变更）。
 */
function entryFingerprint(e: ToolIndexEntry): string {
  return `${e.name}\0${e.description}\0${e.descriptionCn ?? ""}\0${e.tags.join(",")}\0${e.metadataJson ?? ""}`;
}

/**
 * 将 MCP marketplace items 增量同步到 tool-index.sqlite。
 *
 * 调用时机：
 *   1. ensureMcpBaseline() 完成后（启动时 bundled → SQLite）
 *   2. syncMcpIndex() 远程同步完成后（运行时新增/下架 MCP）
 *
 * 工作流：
 *   1. 读取 tool-index.sqlite 中现有 MCP 条目
 *   2. 对比传入的最新 items → 内容指纹比对 → 计算 added / updated / removed
 *   3. 调用 incrementalUpdate() 增量写入 FTS5 + tools 表
 *   4. 如有 embedding 配置，异步触发 ensureVectors() 补向量
 *
 * @param items     最新的 MCP marketplace items（全量列表，McpMarketplaceItem 格式）
 * @param options   可选配置
 * @returns 变更统计
 */
export async function syncMcpToToolIndex(
  items: Record<string, any>[],
  options?: {
    /** embedding 配置，有 apiKey 时自动补向量 */
    embedding?: ToolDiscoveryEmbeddingConfig;
  },
): Promise<{ added: number; updated: number; removed: number; total: number }> {
  const empty = { added: 0, updated: 0, removed: 0, total: 0 };

  if (!items || items.length === 0) return empty;

  // 打开用户目录的 tool-index.sqlite（运行时副本）
  let db: DatabaseSync;
  try {
    const dir = resolveUserDataDir();
    if (!dir) return empty;
    db = openToolIndex(dir);
  } catch {
    return empty;
  }

  // 获取 tool-index 中现有 MCP 条目（含内容，用于指纹比对）
  let existingMap: Map<string, string>; // id → fingerprint
  try {
    const rows = db
      .prepare("SELECT id, name, description, description_cn, tags, metadata_json FROM tools WHERE type = 'mcp'")
      .all() as Array<{ id: string; name: string; description: string; description_cn: string; tags: string; metadata_json: string }>;
    existingMap = new Map(
      rows.map((r) => [
        r.id,
        `${r.name}\0${r.description}\0${r.description_cn ?? ""}\0${r.tags ?? ""}\0${r.metadata_json ?? ""}`,
      ]),
    );
  } catch {
    existingMap = new Map();
  }

  // 转换全量 items → ToolIndexEntry
  const entries = items.map(mcpItemToToolEntry);
  const newIds = new Set(entries.map((e) => e.id));

  // 真增量：内容指纹比对
  const added: ToolIndexEntry[] = [];
  const updated: ToolIndexEntry[] = [];
  for (const e of entries) {
    const existingFp = existingMap.get(e.id);
    if (existingFp === undefined) {
      added.push(e);
    } else if (existingFp !== entryFingerprint(e)) {
      updated.push(e);
    }
    // else: unchanged, skip
  }

  const removedIds = [...existingMap.keys()].filter((id) => !newIds.has(id));
  const toUpsert = [...added, ...updated];

  if (toUpsert.length === 0 && removedIds.length === 0) {
    return { added: 0, updated: 0, removed: 0, total: entries.length };
  }

  // 增量写入
  try {
    incrementalUpdate(db, toUpsert, removedIds);
  } catch (err) {
    console.error(`${LOG_PREFIX} incrementalUpdate failed:`, err);
    return empty;
  }

  const result = {
    added: added.length,
    updated: updated.length,
    removed: removedIds.length,
    total: entries.length,
  };

  console.log(
    `${LOG_PREFIX} +${added.length} new, ~${updated.length} updated, ` +
      `-${removedIds.length} removed (total ${entries.length})`,
  );

  // 异步补向量（不阻塞主流程）
  if (options?.embedding?.apiKey) {
    ensureVectors(db, options.embedding).catch((err) => {
      console.warn(`${LOG_PREFIX} background vectorization failed:`, err);
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// UI Panel Search — 供 gateway handler 直接调用的轻量搜索函数
// ---------------------------------------------------------------------------

/**
 * UI 面板搜索专用：仅搜索指定类型，返回排好序的 ID 列表。
 *
 * 与 discoverTools() 不同，这个不生成 toolSummaryPrompt，
 * 纯粹返回 ID 让调用方去各自 DB 拉完整数据。
 *
 * 调用链路：
 *   UI 搜索框 → gateway handler → searchToolIndex("天气", {type:"mcp"})
 *   → 返回 { ids: ["@le-yo-weather-mcp", ...], scores: Map }
 *   → gateway handler 调 getItemsByServerIds(ids) 拉完整数据
 *
 * @param query   搜索关键词
 * @param options 过滤和配置
 */
export async function searchToolIndex(
  query: string,
  options?: {
    /** 按类型过滤：skill / mcp / core */
    type?: "skill" | "mcp" | "core";
    /** 最大返回数量，默认 50 */
    maxResults?: number;
    /** 最低匹配分数（0-1），默认 0.1 */
    minScore?: number;
    /** embedding 配置（有 apiKey 时启用向量搜索） */
    embedding?: ToolDiscoveryEmbeddingConfig;
  },
): Promise<{ ids: string[]; scores: Map<string, number> }> {
  const emptyResult = { ids: [], scores: new Map<string, number>() };

  if (!query || query.trim().length < 2) {
    return emptyResult;
  }

  // 打开 DB
  let db: DatabaseSync;
  try {
    const dir = resolveDataDir();
    if (!dir) return emptyResult;
    db = openToolIndex(dir);
  } catch {
    return emptyResult;
  }

  // 检查索引是否有数据
  const stats = getIndexStats(db);
  if (stats.entryCount === 0) return emptyResult;

  const maxResults = options?.maxResults ?? 50;
  const minScore = options?.minScore ?? 0.1;

  // 生成查询向量（如果配置了 embedding 且已向量化）
  let queryVec: number[] | undefined;
  if (options?.embedding?.apiKey && isVectorized(db)) {
    try {
      const client = createToolEmbeddingClient(options.embedding);
      const [vec] = await client.embed([query]);
      queryVec = vec;
    } catch {
      // 向量失败不阻塞，退化为纯 FTS5
    }
  }

  // 执行混合搜索
  let results: ToolSearchResult[];
  try {
    results = await hybridSearch(db, query, {
      maxResults: maxResults * 2, // 取多一些，过滤后截断
      minScore,
      queryVec,
    });
  } catch {
    return emptyResult;
  }

  // 按类型过滤
  if (options?.type) {
    results = results.filter((r) => r.entry.type === options.type);
  }

  // 截断
  results = results.slice(0, maxResults);

  // 构建结果
  const ids: string[] = [];
  const scores = new Map<string, number>();

  for (const r of results) {
    // tool-index 中的 ID 带有类型前缀（"mcp:xxx"、"skill:xxx"、"core:xxx"），
    // 调用方需要的是纯 ID（和各自 DB 的主键对应），所以统一去掉前缀
    const rawId = r.entry.id.replace(/^(mcp|skill|core):/, "");
    ids.push(rawId);
    scores.set(rawId, r.score);
  }

  return { ids, scores };
}
