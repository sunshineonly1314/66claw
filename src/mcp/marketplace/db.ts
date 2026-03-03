/**
 * MCP Marketplace SQLite Database Wrapper
 * CN-ONLY FILE - 完全独立实现，不影响上游 OpenClaw
 */

import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { initializeSchema, mcpFtsAvailable } from "./db-schema.js";
import type { McpMarketplaceItem } from "./types.js";

// ========== 配置 ==========

let DEFAULT_DB_PATH = path.join(process.cwd(), "data", "mcp-index.db");

/**
 * Override the default database path (for testing only).
 *
 * When test files call `getDatabase()` without an explicit path, the singleton
 * falls through to DEFAULT_DB_PATH which points at a real file on disk.
 * Multiple parallel vitest workers hitting the same file causes
 * "database is locked" errors.
 *
 * Call this once in `beforeAll()` to make the implicit `getDatabase()` calls
 * in each test file hit an isolated in-memory (or per-file temp) database
 * instead of the shared on-disk file.
 *
 * @internal Exported for tests only — not part of the public API.
 */
export function _setDefaultPathForTesting(dbPath: string): void {
  DEFAULT_DB_PATH = dbPath;
}

// ========== 数据库连接管理 ==========

let dbInstance: DatabaseSync | null = null;
let currentDbPath: string | null = null;
let isInitializing = false; // 🔒 互斥标志，防止并发初始化

/**
 * 获取数据库实例（单例模式 + 自定义路径）
 * 🔒 CRITICAL FIX v2: 使用互斥标志防止竞态条件
 *
 * 注意: DatabaseSync 是同步 API，无法使用真正的异步锁。
 * 这里使用互斥标志 + 忙等待作为折衷方案。
 */
export function getDatabase(dbPath?: string): DatabaseSync {
  const targetPath = dbPath || DEFAULT_DB_PATH;

  // 如果路径变化，关闭旧连接
  if (dbInstance && currentDbPath && currentDbPath !== targetPath) {
    // 🔒 等待初始化完成
    const maxWait = 100; // 最多等待 100 次 * 10ms = 1秒
    let waited = 0;
    while (isInitializing && waited < maxWait) {
      // 简单的忙等待（仅在路径切换时触发）
      const start = Date.now();
      while (Date.now() - start < 10) {
        // 空循环 10ms
      }
      waited++;
    }

    if (isInitializing) {
      throw new Error("Database initialization timeout (another process is initializing)");
    }

    dbInstance.close();
    dbInstance = null;
    currentDbPath = null;
  }

  if (!dbInstance) {
    // 🔒 检查是否有其他线程正在初始化
    if (isInitializing) {
      throw new Error("Database is being initialized by another caller");
    }

    try {
      // 🔒 设置互斥标志
      isInitializing = true;

      // 确保目录存在
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 尝试打开数据库，如果损坏则删除重建
      let retried = false;
      const openDb = () => {
        dbInstance = new DatabaseSync(targetPath);
        currentDbPath = targetPath;

        // 性能优化
        dbInstance.exec("PRAGMA journal_mode = WAL");
        dbInstance.exec("PRAGMA synchronous = NORMAL");
        dbInstance.exec("PRAGMA cache_size = -64000"); // 64MB cache
        dbInstance.exec("PRAGMA temp_store = MEMORY");

        // 完整性检查 — 检测损坏的数据库文件
        try {
          const result = dbInstance.prepare("PRAGMA integrity_check(1)").get() as
            | Record<string, unknown>
            | undefined;
          const status = result ? (Object.values(result)[0] as string) : "unknown";
          if (status !== "ok") {
            throw new Error(`database integrity check failed: ${status}`);
          }
        } catch (integrityErr) {
          // 数据库损坏：关闭连接，删除文件，重新创建
          if (!retried) {
            retried = true;
            console.warn(
              `[MCP DB] Database corrupted (${targetPath}), rebuilding: ${integrityErr}`,
            );
            try {
              dbInstance.close();
            } catch {
              /* ignore */
            }
            dbInstance = null;
            currentDbPath = null;
            // 删除损坏的数据库文件及其 WAL/SHM 附属文件
            for (const suffix of ["", "-wal", "-shm"]) {
              try {
                fs.unlinkSync(targetPath + suffix);
              } catch {
                /* ignore */
              }
            }
            // 重新创建
            openDb();
            return;
          }
          throw integrityErr;
        }

        // 初始化 schema
        initializeSchema(dbInstance);
      };

      openDb();
    } finally {
      // 🔒 释放互斥标志
      isInitializing = false;
    }
  }

  return dbInstance;
}

/**
 * 关闭数据库连接
 * 🔒 CRITICAL FIX v2: 清理所有状态变量（包括互斥标志）
 */
export function closeDatabase(): void {
  if (dbInstance) {
    // 🔒 等待初始化完成（如果正在进行）
    const maxWait = 100;
    let waited = 0;
    while (isInitializing && waited < maxWait) {
      const start = Date.now();
      while (Date.now() - start < 10) {
        // 空循环 10ms
      }
      waited++;
    }

    dbInstance.close();
    dbInstance = null;
    currentDbPath = null;
    isInitializing = false; // 🔒 清理互斥标志
  }
}

// ========== 工具函数 ==========

/**
 * 安全解析 JSON（容错）
 */
function parseJsonSafe<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (error) {
    console.error(`[DB] JSON parse error:`, error);
    return fallback;
  }
}

// ========== 类型转换 ==========

/**
 * McpMarketplaceItem → 数据库行
 */
function itemToRow(item: McpMarketplaceItem): Record<string, any> {
  return {
    server_id: item.serverId,
    friendly_name: item.friendlyName,
    friendly_name_cn: item.friendlyNameCn || null,
    description: item.description || null,
    description_cn: item.descriptionCn || null,
    category: item.category || "other",
    tags: item.tags ? JSON.stringify(item.tags) : null,
    tags_cn: item.tagsCn ? JSON.stringify(item.tagsCn) : null,
    version: item.version || null,
    requires_api_key: item.requiresApiKey ? 1 : 0,
    platforms: item.platforms ? JSON.stringify(item.platforms) : null,
    is_official: item.isOfficial ? 1 : 0,
    is_new: item.isNew ? 1 : 0,
    tool_count: item.toolCount || 0,
    source: item.source || null,
    source_url: item.sourceUrl || null,

    // 安装方式字段
    npm_package: item.npmPackage || null,
    pypi_package: item.pypiPackage || null,
    sse_url: item.sseUrl || null,

    // AI 增强字段
    china_friendly_score: item.availability?.chinaFriendlyScore ?? null,
    requires_vpn: item.availability?.requiresVPN ? 1 : 0,
    china_block_reasons: item.availability?.chinaBlockReasons
      ? JSON.stringify(item.availability.chinaBlockReasons)
      : null,
    runtime_deps: item.requirements?.runtimeDeps
      ? JSON.stringify(item.requirements.runtimeDeps)
      : null,
    system_deps: item.requirements?.systemDeps
      ? JSON.stringify(item.requirements.systemDeps)
      : null,
    platform_notes: item.requirements?.platformNotes || null,
    category_enhanced: item.categoryEnhanced ? JSON.stringify(item.categoryEnhanced) : null,

    // 推荐评分
    beginner_friendly: item.aiEnhancement?.recommendationScore?.beginnerFriendly ?? null,
    enterprise_ready: item.aiEnhancement?.recommendationScore?.enterpriseReady ?? null,
    community_activity: item.aiEnhancement?.recommendationScore?.communityActivity ?? null,

    // AI 元数据
    enhanced_at: item.aiEnhancement?.enhancedAt || null,
    ai_model: item.aiEnhancement?.model || null,
    ai_version: item.aiEnhancement?.version || null,
  };
}

/**
 * 数据库行 → McpMarketplaceItem
 */
function rowToItem(row: Record<string, any>): McpMarketplaceItem {
  // 必填字段 — prefer CN name/description for display
  const item: McpMarketplaceItem = {
    serverId: row.server_id,
    friendlyName: row.friendly_name_cn || row.friendly_name,
    friendlyNameEn: row.friendly_name,
    description: row.description_cn || row.description || "",
    descriptionEn: row.description || "",
    tags: parseJsonSafe(row.tags, []),
    version: row.version || "0.0.0",
    requiresApiKey: Boolean(row.requires_api_key),
    platforms: parseJsonSafe(row.platforms, []),
    isOfficial: Boolean(row.is_official),
    isNew: Boolean(row.is_new),
    toolCount: row.tool_count || 0,
    category: row.category,
    source: row.source as any,
  };

  // 可选字段
  if (row.friendly_name_cn) item.friendlyNameCn = row.friendly_name_cn;
  if (row.description_cn) item.descriptionCn = row.description_cn;
  if (row.tags_cn) item.tagsCn = parseJsonSafe(row.tags_cn, undefined);
  if (row.source_url) item.sourceUrl = row.source_url;

  // 安装方式字段
  if (row.npm_package) item.npmPackage = row.npm_package;
  if (row.pypi_package) item.pypiPackage = row.pypi_package;
  if (row.sse_url) item.sseUrl = row.sse_url;

  // AI 增强字段
  if (row.china_friendly_score !== null || row.requires_vpn !== null) {
    item.availability = {
      chinaFriendlyScore: row.china_friendly_score ?? 50,
      requiresVPN: Boolean(row.requires_vpn),
    };
    if (row.china_block_reasons) {
      item.availability.chinaBlockReasons = parseJsonSafe(row.china_block_reasons, []);
    }
  }

  if (row.runtime_deps || row.system_deps || row.platform_notes) {
    item.requirements = {};
    if (row.runtime_deps) item.requirements.runtimeDeps = parseJsonSafe(row.runtime_deps, []);
    if (row.system_deps) item.requirements.systemDeps = parseJsonSafe(row.system_deps, []);
    if (row.platform_notes) item.requirements.platformNotes = row.platform_notes;
  }

  if (row.category_enhanced) {
    item.categoryEnhanced = parseJsonSafe(row.category_enhanced, undefined);
  }

  // AI 元数据
  if (row.enhanced_at || row.ai_model || row.ai_version) {
    item.aiEnhancement = {
      enhancedAt: row.enhanced_at,
      model: row.ai_model,
      version: row.ai_version,
    };

    if (
      row.beginner_friendly !== null ||
      row.enterprise_ready !== null ||
      row.community_activity !== null
    ) {
      item.aiEnhancement.recommendationScore = {
        beginnerFriendly: row.beginner_friendly ?? 50,
        enterpriseReady: row.enterprise_ready ?? 50,
        communityActivity: row.community_activity ?? 50,
      };
    }
  }

  return item;
}

// ========== CRUD 操作 ==========

/**
 * 插入单个 MCP
 */
export function insertItem(item: McpMarketplaceItem): void {
  const db = getDatabase();
  const row = itemToRow(item);

  const columns = Object.keys(row).join(", ");
  const placeholders = Object.keys(row)
    .map(() => "?")
    .join(", ");

  const stmt = db.prepare(`INSERT OR REPLACE INTO mcp_items (${columns}) VALUES (${placeholders})`);

  stmt.run(...Object.values(row));
}

/**
 * 批量插入 MCP（事务 + 复用 prepared statement）
 */
export function insertItems(items: McpMarketplaceItem[]): void {
  if (items.length === 0) return;

  const db = getDatabase();

  // 复用 prepared statement（性能优化）
  const sampleRow = itemToRow(items[0]);
  const columns = Object.keys(sampleRow).join(", ");
  const placeholders = Object.keys(sampleRow)
    .map(() => "?")
    .join(", ");

  const stmt = db.prepare(`INSERT OR REPLACE INTO mcp_items (${columns}) VALUES (${placeholders})`);

  db.exec("BEGIN TRANSACTION");
  try {
    for (const item of items) {
      const row = itemToRow(item);
      stmt.run(...Object.values(row));
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * 根据 serverId 查询
 */
export function getItemById(serverId: string): McpMarketplaceItem | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM mcp_items WHERE server_id = ?");
  const row = stmt.get(serverId) as Record<string, any> | undefined;

  return row ? rowToItem(row) : null;
}

/**
 * 按指定 serverId 列表批量查询，保持传入顺序。
 *
 * 供 hybridSearch → gateway handler 链路使用：
 *   dispatch 侧 hybridSearch() 返回排好序的 serverId[]，
 *   此函数按该顺序返回完整 McpMarketplaceItem[]。
 *
 * @param serverIds 按优先级排列的 serverId 列表
 * @param options   分页参数（对已排序的结果列表切片）
 */
export function getItemsByServerIds(
  serverIds: string[],
  options?: { page?: number; pageSize?: number },
): SearchResult {
  if (serverIds.length === 0) {
    return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }

  const db = getDatabase();
  const page = Math.max(1, options?.page ?? 1);
  // 上限放宽到 1000：此函数由 gateway handler 调用，
  // 调用方已通过 searchToolIndex 的 maxResults 控制总量（通常 200），
  // 不应在此二次截断导致排名靠后的结果被静默丢弃
  const pageSize = Math.max(1, Math.min(options?.pageSize ?? 50, 1000));

  // 批量查询，分批处理避免超过 SQLite SQLITE_MAX_VARIABLE_NUMBER (999)
  const BATCH_SIZE = 500;
  const rowMap = new Map<string, Record<string, any>>();
  const uniqueIds = [...new Set(serverIds)];

  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + BATCH_SIZE);
    const placeholders = batch.map(() => "?").join(",");
    const rows = db
      .prepare(`SELECT * FROM mcp_items WHERE server_id IN (${placeholders})`)
      .all(...batch) as Record<string, any>[];
    for (const row of rows) {
      rowMap.set(row.server_id, row);
    }
  }

  // 按传入 serverIds 顺序组装结果（保留重复项，跳过不存在的 ID）
  const ordered: McpMarketplaceItem[] = [];
  for (const id of serverIds) {
    const row = rowMap.get(id);
    if (row) {
      ordered.push(rowToItem(row));
    }
  }

  // 分页切片
  const total = ordered.length;
  const offset = (page - 1) * pageSize;
  const items = ordered.slice(offset, offset + pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 更新 MCP
 */
export function updateItem(serverId: string, updates: Partial<McpMarketplaceItem>): void {
  const existing = getItemById(serverId);
  if (!existing) {
    throw new Error(`MCP not found: ${serverId}`);
  }

  const updated = { ...existing, ...updates };
  insertItem(updated); // INSERT OR REPLACE
}

/**
 * 删除 MCP
 */
export function deleteItem(serverId: string): void {
  const db = getDatabase();
  const stmt = db.prepare("DELETE FROM mcp_items WHERE server_id = ?");
  stmt.run(serverId);
}

/**
 * 清空所有数据
 */
export function clearAllItems(): void {
  const db = getDatabase();
  db.exec("DELETE FROM mcp_items");
  if (mcpFtsAvailable) {
    db.exec("DELETE FROM mcp_search");
  }
}

// ========== 查询 API ==========

// ========== 常量定义 ==========

/** 允许的排序字段（SQL 注入防护） */
const ALLOWED_ORDER_BY = ["updated_at", "china_friendly_score", "tool_count"] as const;

/** 允许的排序方向（SQL 注入防护） */
const ALLOWED_ORDER_DIR = ["ASC", "DESC"] as const;

// ========== 查询 API ==========

export interface SearchOptions {
  /** 关键词（全文搜索） */
  keyword?: string;
  /** 分类过滤 */
  category?: string;
  /** 国内友好度最低分 */
  minChinaScore?: number;
  /** 是否需要 VPN */
  requiresVPN?: boolean;
  /** 是否官方 */
  isOfficial?: boolean;
  /** 排序字段 */
  orderBy?: "updated_at" | "china_friendly_score" | "tool_count";
  /** 排序方向 */
  orderDirection?: "ASC" | "DESC";
  /** 分页：页码（从 1 开始） */
  page?: number;
  /** 分页：每页数量 */
  pageSize?: number;
}

export interface SearchResult {
  items: McpMarketplaceItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 搜索 MCP
 */
export function searchItems(options: SearchOptions = {}): SearchResult {
  const db = getDatabase();

  const {
    keyword,
    category,
    minChinaScore,
    requiresVPN,
    isOfficial,
    orderBy = "updated_at",
    orderDirection = "DESC",
    page = 1,
    pageSize = 20,
  } = options;

  // 🔒 CRITICAL FIX: 输入验证（防御性编程）
  // 即使 Gateway 层已验证，db 层也应防御
  const validPage = Math.max(1, Math.min(page, 1000000));
  const validPageSize = Math.max(1, Math.min(pageSize, 100));

  // SQL 注入防护：白名单验证
  if (!ALLOWED_ORDER_BY.includes(orderBy as any)) {
    throw new Error(`Invalid orderBy: ${orderBy}`);
  }
  if (!ALLOWED_ORDER_DIR.includes(orderDirection as any)) {
    throw new Error(`Invalid orderDirection: ${orderDirection}`);
  }

  // 构建查询条件
  const conditions: string[] = [];
  const params: any[] = [];

  // 全文搜索
  // 🔒 CRITICAL FIX v2: 多层防御的 FTS5 注入防护
  if (keyword) {
    // 步骤 1: 规范化处理
    let sanitized = keyword
      .toLowerCase() // 转小写（统一处理）
      .normalize("NFKD") // Unicode 规范化（防止变体字符绕过）
      .replace(/\u200b|\u200c|\u200d|\ufeff/g, " "); // 移除零宽字符

    // 步骤 2: 移除 FTS5 运算符（先替换为空格）
    sanitized = sanitized.replace(/["*(){}[\]:!+\-^~]/g, " "); // FTS5 特殊字符

    // 步骤 3: 移除布尔运算符（多种形式）
    sanitized = sanitized
      .replace(/\s+(and|or|not|near)\s+/g, " ") // 空格包围的
      .replace(/(^|\s)(and|or|not|near)(\s|$)/g, "$1$3") // 词首词尾的
      .replace(/\b(and|or|not|near)\b/gi, " "); // 词边界的（兜底）

    // 步骤 4: 只保留安全字符（字母、数字、空格）
    sanitized = sanitized
      .replace(/[^\p{L}\p{N}\s]/gu, " ") // Unicode-safe
      .replace(/\s+/g, " ") // 压缩空格
      .trim();

    // 步骤 5: 二次验证（防止清理不彻底）
    if (sanitized && /\b(and|or|not|near)\b/i.test(sanitized)) {
      console.warn(`[Security] FTS5 operator still present after sanitization: ${sanitized}`);
      sanitized = sanitized.replace(/\b(and|or|not|near)\b/gi, " ").trim();
    }

    if (!sanitized) {
      // 关键词被清空，跳过全文搜索
    } else if (sanitized.length > 500) {
      throw new Error("Keyword too long after sanitization (max 500 chars)");
    } else if (mcpFtsAvailable) {
      conditions.push(`server_id IN (
        SELECT server_id FROM mcp_search
        WHERE mcp_search MATCH ?
      )`);
      params.push(sanitized);
    } else {
      // FTS5 不可用，降级到 LIKE 搜索
      const likeTerm = `%${sanitized}%`;
      conditions.push(`(friendly_name_cn LIKE ? OR description_cn LIKE ? OR tags_cn LIKE ?)`);
      params.push(likeTerm, likeTerm, likeTerm);
    }
  }

  // 分类过滤
  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }

  // 国内友好度
  if (minChinaScore !== undefined) {
    conditions.push("china_friendly_score >= ?");
    params.push(minChinaScore);
  }

  // VPN 要求
  if (requiresVPN !== undefined) {
    conditions.push("requires_vpn = ?");
    params.push(requiresVPN ? 1 : 0);
  }

  // 官方标记
  if (isOfficial !== undefined) {
    conditions.push("is_official = ?");
    params.push(isOfficial ? 1 : 0);
  }

  // WHERE 子句
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // 查询总数
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM mcp_items ${whereClause}`);
  const countRow = countStmt.get(...params) as { count: number };
  const total = countRow.count;

  // 分页查询（使用验证后的值）
  const offset = (validPage - 1) * validPageSize;
  // Default sort: prioritize ModelScope items (which have Chinese names)
  // by putting source='modelscope' first, then sub-sort by the requested field.
  const orderClause =
    orderBy === "updated_at"
      ? `ORDER BY (CASE WHEN source = 'modelscope' THEN 0 ELSE 1 END), ${orderBy} ${orderDirection}`
      : `ORDER BY ${orderBy} ${orderDirection}`;
  const queryStmt = db.prepare(`
    SELECT * FROM mcp_items
    ${whereClause}
    ${orderClause}
    LIMIT ? OFFSET ?
  `);

  const rows = queryStmt.all(...params, validPageSize, offset) as Record<string, any>[];
  const items = rows.map(rowToItem);

  return {
    items,
    total,
    page: validPage,
    pageSize: validPageSize,
    totalPages: Math.ceil(total / validPageSize),
  };
}

/**
 * 获取所有分类及计数
 */
export function getCategoryStats(): Record<string, number> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM mcp_items
    GROUP BY category
    ORDER BY count DESC
  `);

  const rows = stmt.all() as Array<{ category: string; count: number }>;
  return Object.fromEntries(rows.map((r) => [r.category, r.count]));
}

/**
 * 获取数据库统计信息
 */
export function getStats() {
  const db = getDatabase();

  const totalStmt = db.prepare("SELECT COUNT(*) as count FROM mcp_items");
  const total = (totalStmt.get() as { count: number }).count;

  const enhancedStmt = db.prepare(
    "SELECT COUNT(*) as count FROM mcp_items WHERE ai_version IS NOT NULL",
  );
  const enhanced = (enhancedStmt.get() as { count: number }).count;

  const vpnStmt = db.prepare("SELECT COUNT(*) as count FROM mcp_items WHERE requires_vpn = 1");
  const requiresVPN = (vpnStmt.get() as { count: number }).count;

  const officialStmt = db.prepare("SELECT COUNT(*) as count FROM mcp_items WHERE is_official = 1");
  const official = (officialStmt.get() as { count: number }).count;

  return {
    total,
    enhanced,
    requiresVPN,
    official,
    categories: getCategoryStats(),
  };
}

// ========== 基线数据导入 & 增量同步 ==========

/**
 * 获取 item 总数（快速检查）
 */
export function getItemCount(): number {
  const db = getDatabase();
  const stmt = db.prepare("SELECT COUNT(*) as count FROM mcp_items");
  return (stmt.get() as { count: number }).count;
}

/**
 * 获取所有 MCP items（供桥接同步使用）。
 * 内部使用 rowToItem() 确保字段格式与 McpMarketplaceItem 一致。
 */
export function getAllItems(): McpMarketplaceItem[] {
  const db = getDatabase();
  const rows = db.prepare("SELECT * FROM mcp_items").all() as Array<Record<string, any>>;
  return rows.map(rowToItem);
}

/**
 * 获取 sync_meta 中的值
 */
function getSyncMeta(key: string): string | null {
  const db = getDatabase();
  try {
    const stmt = db.prepare("SELECT value FROM sync_meta WHERE key = ?");
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * 设置 sync_meta 中的值
 */
function setSyncMeta(key: string, value: string): void {
  const db = getDatabase();
  db.prepare("INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)").run(key, value);
}

/**
 * 检查基线数据是否已导入
 */
export function isBaselinePopulated(): boolean {
  return getSyncMeta("baseline_populated") === "1";
}

/**
 * 计算内容的 SHA-256 哈希（用于变更检测）
 */
function computeContentHash(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * 删除不在给定 serverId 集合中的所有 items（清理已移除的 MCP）
 *
 * @returns 删除的数量
 */
function deleteItemsNotIn(serverIds: Set<string>): number {
  if (serverIds.size === 0) return 0;

  const db = getDatabase();

  // 查出所有当前 SQLite 中的 serverId
  const allRows = db.prepare("SELECT server_id FROM mcp_items").all() as Array<{
    server_id: string;
  }>;

  const toDelete: string[] = [];
  for (const row of allRows) {
    if (!serverIds.has(row.server_id)) {
      toDelete.push(row.server_id);
    }
  }

  if (toDelete.length === 0) return 0;

  // 批量删除（事务）
  const stmt = db.prepare("DELETE FROM mcp_items WHERE server_id = ?");
  db.exec("BEGIN TRANSACTION");
  try {
    for (const id of toDelete) {
      stmt.run(id);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return toDelete.length;
}

/**
 * 更新 sync_meta 中的基线同步状态
 */
function updateBaselineMeta(count: number, hash: string): void {
  setSyncMeta("baseline_populated", "1");
  setSyncMeta("baseline_count", String(count));
  setSyncMeta("baseline_hash", hash);
  setSyncMeta("baseline_at", new Date().toISOString());
}

/**
 * 从打包的 mcp-index.json 读取 items
 *
 * @param packageRoot 项目根目录（包含 data/mcp-index.json）
 * @returns items 数组 + 原始文件内容（用于哈希计算，避免二次读取）
 */
function readBundledItems(packageRoot: string): {
  items: McpMarketplaceItem[];
  rawContent: string;
} {
  // Prefer enhanced (AI-translated) file which has Chinese names/descriptions
  const enhancedPath = path.join(packageRoot, "data", "mcp-index-enhanced.json");
  const indexPath = path.join(packageRoot, "data", "mcp-index.json");
  const filePath = fs.existsSync(enhancedPath) ? enhancedPath : indexPath;

  if (!fs.existsSync(filePath)) {
    console.warn("[MCP DB] Bundled mcp-index.json not found:", filePath);
    return { items: [], rawContent: "" };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const items: McpMarketplaceItem[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.items)
        ? parsed.items
        : [];

    if (items.length === 0) {
      console.warn("[MCP DB] Bundled mcp-index.json is empty");
    }

    return { items, rawContent: raw };
  } catch (err) {
    console.error("[MCP DB] Failed to read bundled mcp-index.json:", err);
    return { items: [], rawContent: "" };
  }
}

/**
 * 从打包的 mcp-index.json 导入基线数据到 SQLite（全量导入）
 *
 * @param packageRoot 项目根目录（包含 data/mcp-index.json）
 * @returns 导入的 MCP 数量，0 表示无数据
 */
export function populateFromBundledIndex(packageRoot: string): number {
  const { items } = readBundledItems(packageRoot);
  if (items.length === 0) return 0;

  insertItems(items);
  return items.length;
}

/**
 * 批量删除指定 serverId 列表的 items
 * @returns 实际删除的数量
 */
export function deleteItemsByIds(serverIds: string[]): number {
  if (serverIds.length === 0) return 0;

  const db = getDatabase();
  const stmt = db.prepare("DELETE FROM mcp_items WHERE server_id = ?");
  let deleted = 0;
  db.exec("BEGIN TRANSACTION");
  try {
    for (const id of serverIds) {
      const result = stmt.run(id) as { changes: number };
      deleted += result.changes;
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return deleted;
}

/**
 * 确保 MCP 基线数据已导入，并支持增量同步（增删改）。
 *
 * 工作原理:
 * 1. 首次启动: 全量导入 bundled mcp-index.json → SQLite
 * 2. 后续启动: 比较文件 SHA-256 哈希，如果 JSON 文件内容变化则:
 *    - INSERT OR REPLACE: 新增和更新的 MCP（由 SQLite UPSERT 语义处理）
 *    - DELETE: 从 JSON 中移除的 MCP（SQLite 中有但 JSON 中没有的）
 * 3. 如果哈希未变: 跳过，避免重复工作
 *
 * @param packageRoot 项目根目录
 * @returns 变更的 MCP 数量（新增+更新+删除），0 表示无变化
 */
export function ensureMcpBaseline(packageRoot: string): number {
  const { items, rawContent } = readBundledItems(packageRoot);

  if (items.length === 0) {
    return 0;
  }

  // 计算当前文件内容哈希（复用已读取的 rawContent，无需二次 I/O）
  const currentHash = computeContentHash(rawContent);

  // 与上次同步的哈希比较
  const storedHash = getSyncMeta("baseline_hash");

  if (storedHash === currentHash && isBaselinePopulated() && getItemCount() > 0) {
    // 文件未变化，跳过
    return 0;
  }

  // 文件变化（或首次导入），执行增量同步
  console.log(
    `[MCP DB] Baseline sync: hash changed (${storedHash?.slice(0, 8) ?? "none"} → ${currentHash.slice(0, 8)}), ` +
      `syncing ${items.length} items...`,
  );

  // 步骤 1: INSERT OR REPLACE 所有 bundled items（处理新增+更新）
  insertItems(items);

  // 步骤 2: 删除 JSON 中不存在但 SQLite 中仍存在的 items（处理删除）
  const bundledIds = new Set(items.map((item) => item.serverId));
  const deletedCount = deleteItemsNotIn(bundledIds);

  if (deletedCount > 0) {
    console.log(`[MCP DB] Removed ${deletedCount} stale items not in bundled index`);
  }

  // 步骤 3: 更新元数据
  updateBaselineMeta(items.length, currentHash);

  const totalChanges = items.length + deletedCount;
  console.log(`[MCP DB] Baseline sync complete: ${items.length} upserted, ${deletedCount} deleted`);

  return totalChanges;
}
