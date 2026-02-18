/**
 * MCP Marketplace SQLite Database Wrapper
 * CN-ONLY FILE - 完全独立实现，不影响上游 OpenClaw
 */

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { initializeSchema } from "./db-schema.js";
import type { McpMarketplaceItem } from "./types.js";

// ========== 配置 ==========

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "mcp-index.db");

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

      // 创建/打开数据库
      dbInstance = new DatabaseSync(targetPath);
      currentDbPath = targetPath;

      // 性能优化
      dbInstance.exec("PRAGMA journal_mode = WAL");
      dbInstance.exec("PRAGMA synchronous = NORMAL");
      dbInstance.exec("PRAGMA cache_size = -64000"); // 64MB cache
      dbInstance.exec("PRAGMA temp_store = MEMORY");

      // 初始化 schema
      initializeSchema(dbInstance);
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
  // 必填字段
  const item: McpMarketplaceItem = {
    serverId: row.server_id,
    friendlyName: row.friendly_name,
    description: row.description || "",
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

  // AI 增强字段
  if (row.china_friendly_score !== null || row.requires_vpn !== null) {
    item.availability = {
      chinaFriendlyScore: row.china_friendly_score ?? 50,
      requiresVPN: Boolean(row.requires_vpn),
    };
    if (row.china_block_reasons) {
      item.availability.chinaBlockReasons = JSON.parse(row.china_block_reasons);
    }
  }

  if (row.runtime_deps || row.system_deps || row.platform_notes) {
    item.requirements = {};
    if (row.runtime_deps) item.requirements.runtimeDeps = JSON.parse(row.runtime_deps);
    if (row.system_deps) item.requirements.systemDeps = JSON.parse(row.system_deps);
    if (row.platform_notes) item.requirements.platformNotes = row.platform_notes;
  }

  if (row.category_enhanced) {
    item.categoryEnhanced = JSON.parse(row.category_enhanced);
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
  db.exec("DELETE FROM mcp_search"); // 显式清空 FTS5 表
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
    } else {
      conditions.push(`server_id IN (
        SELECT server_id FROM mcp_search
        WHERE mcp_search MATCH ?
      )`);
      params.push(sanitized);
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
  const queryStmt = db.prepare(`
    SELECT * FROM mcp_items
    ${whereClause}
    ORDER BY ${orderBy} ${orderDirection}
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
