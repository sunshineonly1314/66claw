/**
 * Skills Marketplace SQLite Database Wrapper
 * CN-ONLY FILE - 完全独立实现，不影响上游 OpenClaw
 */

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { initializeSchema, skillsFtsAvailable } from "./db-schema.js";
import type {
  SkillMarketplaceItem,
  SkillSearchOptions,
  SkillSearchResult,
  QcSkillEntry,
  QcSkillsIndex,
} from "./types.js";

export type { SkillSearchOptions } from "./types.js";

// ========== 配置 ==========

const DEFAULT_DB_DIR = (() => {
  const candidates = [
    process.env.OPENCLAWCN_DATA_DIR,
    process.env.APPDATA ? path.join(process.env.APPDATA, "openclawcn", "data") : undefined,
    process.env.HOME ? path.join(process.env.HOME, ".openclawcn", "data") : undefined,
  ].filter(Boolean) as string[];
  return candidates[0] ?? path.join(process.cwd(), "data");
})();

const DEFAULT_DB_PATH = path.join(DEFAULT_DB_DIR, "skills-index.db");

// ========== 数据库连接管理 ==========

let dbInstance: DatabaseSync | null = null;
let currentDbPath: string | null = null;

/**
 * 获取数据库实例（单例模式）
 * 如果不传 dbPath，返回已有实例（如果存在），否则使用默认路径
 */
export function getDatabase(dbPath?: string): DatabaseSync {
  // 如果已有实例且未指定路径，直接返回
  if (!dbPath && dbInstance) {
    return dbInstance;
  }

  const targetPath = dbPath || DEFAULT_DB_PATH;

  // 如果路径变化，关闭旧连接
  if (dbInstance && currentDbPath && currentDbPath !== targetPath) {
    dbInstance.close();
    dbInstance = null;
    currentDbPath = null;
  }

  if (!dbInstance) {
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
  }

  return dbInstance;
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    currentDbPath = null;
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
  } catch {
    return fallback;
  }
}

// ========== 类型转换 ==========

/**
 * SkillMarketplaceItem → 数据库行
 */
function itemToRow(item: SkillMarketplaceItem): Record<string, any> {
  return {
    skill_id: item.skillId,
    name: item.name,
    name_cn: item.nameCn || null,
    description: item.description || null,
    description_cn: item.descriptionCn || null,
    category: item.category || null,
    tags: item.tags ? JSON.stringify(item.tags) : null,
    emoji: item.emoji || null,
    author: item.author || null,
    version: item.version || null,
    path: item.path || null,

    // QC 字段
    tier: item.tier || null,
    overall_score: item.overallScore ?? null,
    cn_blocked: item.cnBlocked ? 1 : 0,
    cn_alternative: item.cnAlternative || null,
    has_translation: item.hasTranslation ? 1 : 0,

    // 安装状态
    installed: item.installed ? 1 : 0,

    // 元数据
    source: item.source || "proxy",
    proxy_version: item.proxyVersion ?? null,
    sha256: item.sha256 || null,
    size_bytes: item.sizeBytes ?? null,
  };
}

/**
 * 数据库行 → SkillMarketplaceItem
 */
function rowToItem(row: Record<string, any>): SkillMarketplaceItem {
  const item: SkillMarketplaceItem = {
    skillId: row.skill_id,
    name: row.name,
    description: row.description || "",
    path: row.path || "",
  };

  // 可选字段
  if (row.name_cn) item.nameCn = row.name_cn;
  if (row.description_cn) item.descriptionCn = row.description_cn;
  if (row.category) item.category = row.category;
  if (row.tags) item.tags = parseJsonSafe(row.tags, undefined);
  if (row.emoji) item.emoji = row.emoji;
  if (row.author) item.author = row.author;
  if (row.version) item.version = row.version;

  // QC 字段
  if (row.tier) item.tier = row.tier;
  if (row.overall_score !== null && row.overall_score !== undefined) {
    item.overallScore = row.overall_score;
  }
  item.cnBlocked = Boolean(row.cn_blocked);
  if (row.cn_alternative) item.cnAlternative = row.cn_alternative;
  item.hasTranslation = Boolean(row.has_translation);

  // 安装状态
  item.installed = Boolean(row.installed);

  // 元数据
  if (row.source) item.source = row.source;
  if (row.proxy_version !== null && row.proxy_version !== undefined) {
    item.proxyVersion = row.proxy_version;
  }
  if (row.sha256) item.sha256 = row.sha256;
  if (row.size_bytes !== null && row.size_bytes !== undefined) {
    item.sizeBytes = row.size_bytes;
  }

  return item;
}

// ========== CRUD 操作 ==========

/**
 * 插入单个 skill
 */
export function insertItem(item: SkillMarketplaceItem): void {
  const db = getDatabase();
  const row = itemToRow(item);

  const columns = Object.keys(row).join(", ");
  const placeholders = Object.keys(row)
    .map(() => "?")
    .join(", ");

  const stmt = db.prepare(`INSERT OR REPLACE INTO skills (${columns}) VALUES (${placeholders})`);

  stmt.run(...Object.values(row));
}

/**
 * 批量插入 skills（事务 + 复用 prepared statement）
 *
 * 关键修复：INSERT OR REPLACE 会覆盖 installed 状态，
 * 所以在 upsert 时保留数据库中已有的 installed=1 状态。
 * 只有当调用方显式传入 installed=true 时才设置 installed=1。
 */
export function insertItems(items: SkillMarketplaceItem[]): void {
  if (items.length === 0) return;

  const db = getDatabase();

  // 先查询已有的 installed 状态，以便在 INSERT OR REPLACE 时保留
  const existingInstalled = new Set<string>();
  const BATCH = 500;
  const allIds = items.map((i) => i.skillId);
  for (let i = 0; i < allIds.length; i += BATCH) {
    const batch = allIds.slice(i, i + BATCH);
    const placeholders = batch.map(() => "?").join(",");
    const rows = db
      .prepare(`SELECT skill_id FROM skills WHERE skill_id IN (${placeholders}) AND installed = 1`)
      .all(...batch) as Array<{ skill_id: string }>;
    for (const row of rows) {
      existingInstalled.add(row.skill_id);
    }
  }

  const sampleRow = itemToRow(items[0]);
  const columns = Object.keys(sampleRow).join(", ");
  const placeholders = Object.keys(sampleRow)
    .map(() => "?")
    .join(", ");

  const stmt = db.prepare(`INSERT OR REPLACE INTO skills (${columns}) VALUES (${placeholders})`);

  db.exec("BEGIN TRANSACTION");
  try {
    for (const item of items) {
      // 保留已有的 installed 状态
      const preserveInstalled = existingInstalled.has(item.skillId);
      const effectiveItem =
        preserveInstalled && !item.installed ? { ...item, installed: true } : item;
      const row = itemToRow(effectiveItem);
      stmt.run(...Object.values(row));
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * 根据 skillId 查询
 */
export function getItemById(skillId: string): SkillMarketplaceItem | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM skills WHERE skill_id = ?");
  const row = stmt.get(skillId) as Record<string, any> | undefined;

  return row ? rowToItem(row) : null;
}

/**
 * 更新 skill
 */
export function updateItem(skillId: string, updates: Partial<SkillMarketplaceItem>): void {
  const existing = getItemById(skillId);
  if (!existing) {
    throw new Error(`Skill not found: ${skillId}`);
  }

  const updated = { ...existing, ...updates };
  insertItem(updated); // INSERT OR REPLACE
}

/**
 * 删除 skill
 */
export function deleteItem(skillId: string): void {
  const db = getDatabase();
  const stmt = db.prepare("DELETE FROM skills WHERE skill_id = ?");
  stmt.run(skillId);
}

/**
 * 清空所有数据
 */
export function clearAllItems(): void {
  const db = getDatabase();
  // DELETE 触发器会自动清理 FTS5 对应行
  db.exec("DELETE FROM skills");
}

// ========== 查询 API ==========

/** 允许的排序字段（SQL 注入防护） */
const ALLOWED_ORDER_BY = ["updated_at", "overall_score", "name"] as const;

/** 允许的排序方向（SQL 注入防护） */
const ALLOWED_ORDER_DIR = ["ASC", "DESC"] as const;

/**
 * 搜索 skills
 */
export function searchItems(options: SkillSearchOptions = {}): SkillSearchResult {
  const db = getDatabase();

  const {
    keyword,
    category,
    tier,
    cnBlocked,
    installed,
    source,
    orderBy = "updated_at",
    orderDirection = "DESC",
    page = 1,
    pageSize = 20,
  } = options;

  // 输入验证（防御性编程）
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
  if (keyword) {
    // FTS5 注入防护：转义特殊字符
    const sanitized = keyword
      .replace(/["*(){}[\]:!+\-]/g, " ")
      .replace(/\b(AND|OR|NOT|NEAR)\b/gi, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (sanitized && sanitized.length > 500) {
      throw new Error("Keyword too long after sanitization (max 500 chars)");
    } else if (sanitized && skillsFtsAvailable) {
      conditions.push(`skill_id IN (
        SELECT skill_id FROM skills_search
        WHERE skills_search MATCH ?
      )`);
      params.push(sanitized);
    } else if (sanitized) {
      // FTS5 不可用，降级到 LIKE 搜索
      const likeTerm = `%${sanitized}%`;
      conditions.push(`(name_cn LIKE ? OR description_cn LIKE ? OR tags LIKE ?)`);
      params.push(likeTerm, likeTerm, likeTerm);
    }
  }

  // 分类过滤
  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }

  // 质量分级过滤
  if (tier) {
    conditions.push("tier = ?");
    params.push(tier);
  }

  // 中国可用性过滤
  if (cnBlocked !== undefined) {
    conditions.push("cn_blocked = ?");
    params.push(cnBlocked ? 1 : 0);
  }

  // 安装状态过滤
  if (installed !== undefined) {
    conditions.push("installed = ?");
    params.push(installed ? 1 : 0);
  }

  // 数据来源过滤（proxy = 远端可下载, qc = 仅评测数据）
  if (source) {
    conditions.push("source = ?");
    params.push(source);
  }

  // WHERE 子句
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // 查询总数
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM skills ${whereClause}`);
  const countRow = countStmt.get(...params) as { count: number };
  const total = countRow.count;

  // 分页查询
  const offset = (validPage - 1) * validPageSize;
  const queryStmt = db.prepare(`
    SELECT * FROM skills
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
 * 按指定 ID 列表批量查询 skills，保持传入顺序。
 *
 * 用于 hybridSearch 路径：dispatch 侧返回排好序的 skillId[]，
 * 此函数按该顺序返回完整 SkillMarketplaceItem[]。
 *
 * @param skillIds 按优先级排列的 skillId 列表
 * @param options  分页参数（对已排序的结果列表切片）
 */
export function getItemsByIds(
  skillIds: string[],
  options?: { page?: number; pageSize?: number },
): SkillSearchResult {
  if (skillIds.length === 0) {
    return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }

  const db = getDatabase();
  const page = Math.max(1, options?.page ?? 1);
  // 上限放宽到 1000：此函数由 gateway handler 调用，
  // 调用方已通过 searchToolIndex 的 maxResults 控制总量（通常 200），
  // 不应在此二次截断导致排名靠后的结果被静默丢弃
  const pageSize = Math.max(1, Math.min(options?.pageSize ?? 20, 1000));

  // 批量查询，分批处理避免超过 SQLite SQLITE_MAX_VARIABLE_NUMBER (999)
  const BATCH_SIZE = 500;
  const rowMap = new Map<string, Record<string, any>>();
  const uniqueIds = [...new Set(skillIds)];

  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + BATCH_SIZE);
    const placeholders = batch.map(() => "?").join(",");
    const rows = db
      .prepare(`SELECT * FROM skills WHERE skill_id IN (${placeholders})`)
      .all(...batch) as Record<string, any>[];
    for (const row of rows) {
      rowMap.set(row.skill_id, row);
    }
  }

  // 按传入 skillIds 顺序组装结果（保留重复项，跳过不存在的 ID）
  const ordered: SkillMarketplaceItem[] = [];
  for (const id of skillIds) {
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
 * 获取所有分类及计数
 */
export function getCategoryStats(): Record<string, number> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM skills
    WHERE category IS NOT NULL AND category != ''
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

  const totalStmt = db.prepare("SELECT COUNT(*) as count FROM skills");
  const total = (totalStmt.get() as { count: number }).count;

  const installedStmt = db.prepare("SELECT COUNT(*) as count FROM skills WHERE installed = 1");
  const installedCount = (installedStmt.get() as { count: number }).count;

  const cnBlockedStmt = db.prepare("SELECT COUNT(*) as count FROM skills WHERE cn_blocked = 1");
  const cnBlockedCount = (cnBlockedStmt.get() as { count: number }).count;

  const tierAStmt = db.prepare("SELECT COUNT(*) as count FROM skills WHERE tier = 'A'");
  const tierA = (tierAStmt.get() as { count: number }).count;

  const tierBStmt = db.prepare("SELECT COUNT(*) as count FROM skills WHERE tier = 'B'");
  const tierB = (tierBStmt.get() as { count: number }).count;

  return {
    total,
    installed: installedCount,
    cnBlocked: cnBlockedCount,
    tierDistribution: {
      A: tierA,
      B: tierB,
    },
    categories: getCategoryStats(),
  };
}

// ========== 增量同步 ==========

/**
 * 获取上次同步的 globalVersion
 */
export function getLastGlobalVersion(): number {
  const db = getDatabase();
  const stmt = db.prepare("SELECT value FROM sync_meta WHERE key = 'last_global_version'");
  const row = stmt.get() as { value: string } | undefined;
  return row ? Number(row.value) || 0 : 0;
}

/**
 * 设置 globalVersion
 */
export function setLastGlobalVersion(version: number): void {
  const db = getDatabase();
  db.prepare("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('last_global_version', ?)").run(
    String(version),
  );
}

/**
 * 获取上次同步时间
 */
export function getLastSyncedAt(): string | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT value FROM sync_meta WHERE key = 'last_synced_at'");
  const row = stmt.get() as { value: string } | undefined;
  return row?.value ?? null;
}

/**
 * 设置上次同步时间
 */
export function setLastSyncedAt(timestamp: string): void {
  const db = getDatabase();
  db.prepare("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('last_synced_at', ?)").run(
    timestamp,
  );
}

/**
 * 增量 upsert（只更新变更的 skills）
 */
export function upsertItems(items: SkillMarketplaceItem[]): void {
  // 与 insertItems 相同，INSERT OR REPLACE 天然支持 upsert
  insertItems(items);
}

// ========== 安装状态管理 ==========

/**
 * 批量更新安装状态
 * @param installedNames 当前已安装的技能名列表
 */
export function updateInstalledStatus(installedNames: string[]): void {
  const db = getDatabase();
  const nameSet = new Set(installedNames);

  db.exec("BEGIN TRANSACTION");
  try {
    // 先重置所有为未安装
    db.prepare("UPDATE skills SET installed = 0").run();

    // 再标记已安装的
    if (nameSet.size > 0) {
      const markStmt = db.prepare("UPDATE skills SET installed = 1 WHERE skill_id = ?");
      for (const name of nameSet) {
        markStmt.run(name);
      }
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * 标记单个 skill 为已安装（立即生效，不做全量 reset）
 * 安装完成后直接调用，确保 UI 下次查询就能看到 installed=1
 */
export function markSkillInstalled(skillId: string): void {
  const db = getDatabase();
  db.prepare("UPDATE skills SET installed = 1 WHERE skill_id = ?").run(skillId);
}

/**
 * 标记单个 skill 为未安装
 */
export function markSkillUninstalled(skillId: string): void {
  const db = getDatabase();
  db.prepare("UPDATE skills SET installed = 0 WHERE skill_id = ?").run(skillId);
}

// ========== QC 数据合并 ==========

/**
 * 合并 QC 质控数据到 SQLite
 * 只更新 QC 字段，不覆盖 proxy 元数据
 */
export function mergeQcData(qcSkills: QcSkillEntry[]): void {
  if (qcSkills.length === 0) return;

  const db = getDatabase();

  const updateStmt = db.prepare(`
    UPDATE skills SET
      tier = ?,
      overall_score = ?,
      category = COALESCE(?, category),
      cn_blocked = ?,
      cn_alternative = ?,
      has_translation = ?,
      description_cn = COALESCE(?, description_cn),
      tags = COALESCE(?, tags)
    WHERE skill_id = ?
  `);

  db.exec("BEGIN TRANSACTION");
  try {
    for (const qc of qcSkills) {
      updateStmt.run(
        qc.tier,
        qc.overallScore,
        qc.category || null,
        qc.cnBlocked ? 1 : 0,
        qc.cnAlternative || null,
        qc.hasTranslation ? 1 : 0,
        qc.descriptionZh || null,
        qc.tags ? JSON.stringify(qc.tags) : null,
        qc.name,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// ========== Populate (供 sync.ts 调用) ==========

/**
 * 从远程索引填充 SQLite
 * @param remoteSkills 远程技能列表（RemoteSkillMeta 格式）
 * @param installedNames 本地已安装技能名列表
 */
export function populateFromRemoteIndex(
  remoteSkills: Array<{
    name: string;
    nameZh?: string;
    description: string;
    descriptionZh?: string;
    emoji?: string;
    path: string;
    version?: string;
    tags?: string[];
    author?: string;
  }>,
  installedNames: string[],
): void {
  const installedSet = new Set(installedNames);

  const items: SkillMarketplaceItem[] = remoteSkills.map((skill) => ({
    skillId: skill.name,
    name: skill.name,
    nameCn: skill.nameZh,
    description: skill.description,
    descriptionCn: skill.descriptionZh,
    emoji: skill.emoji,
    path: skill.path,
    version: skill.version,
    tags: skill.tags,
    author: skill.author,
    installed: installedSet.has(skill.name),
    source: "proxy",
  }));

  insertItems(items);
  setLastSyncedAt(new Date().toISOString());
}

/**
 * 从 ProxySkillMeta 填充 SQLite（增量或全量）
 */
export function populateFromProxyIndex(
  proxySkills: Array<{
    skillId: string;
    version: number;
    sha256: string;
    size: number;
    updatedAt: number;
    path: string;
    status: string;
    name?: string;
    nameZh?: string;
    description?: string;
    descriptionZh?: string;
    emoji?: string;
    tags?: string[];
    author?: string;
  }>,
  installedNames: string[],
  globalVersion: number,
): void {
  const installedSet = new Set(installedNames);

  const items: SkillMarketplaceItem[] = proxySkills
    .filter((s) => s.status === "active")
    .map((skill) => ({
      skillId: skill.skillId,
      name: skill.name?.trim() || skill.skillId,
      nameCn: skill.nameZh?.trim(),
      description: skill.description?.trim() || "",
      descriptionCn: skill.descriptionZh?.trim(),
      emoji: skill.emoji?.trim(),
      path: skill.skillId,
      version: String(skill.version),
      tags: skill.tags,
      author: skill.author?.trim(),
      installed: installedSet.has(skill.skillId),
      source: "proxy",
      proxyVersion: skill.version,
      sha256: skill.sha256,
      sizeBytes: skill.size,
    }));

  upsertItems(items);
  setLastGlobalVersion(globalVersion);
  setLastSyncedAt(new Date().toISOString());
}

// ========== QC 全量导入 ==========

/**
 * 解析 QC skills-index.json 文件并返回 QcSkillsIndex
 */
function parseQcIndexFile(filePath: string): QcSkillsIndex | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content) as QcSkillsIndex;
    if (!data.skills || !Array.isArray(data.skills)) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * 定位 QC skills-index.json 文件路径
 * 按优先级查找：output-all（1190 个）> output（27 个精选）
 */
function findQcIndexPaths(packageRoot: string): string[] {
  const candidates = [
    path.join(packageRoot, "cn", "skills-qc", "output-all", "skills-index.json"),
    path.join(packageRoot, "cn", "skills-qc", "output", "skills-index.json"),
  ];
  return candidates.filter((p) => fs.existsSync(p));
}

/**
 * 从 QC 索引文件全量导入 skills 到 SQLite
 *
 * 这是 SQLite 的基线数据源。所有 QC accepted 的 skills 都会被导入，
 * source 标记为 "qc"。后续 proxy/remote 同步会用 INSERT OR REPLACE 叠加更新。
 *
 * 加载顺序（后面的 INSERT OR REPLACE 会叠加覆盖前面的）：
 *   1. data/skills-availability-dictionary.json  (2696 个，最全的可用性数据)
 *   2. cn/skills-qc/output-all/skills-index.json (1190 个，有 QC 评分)
 *   3. cn/skills-qc/output/skills-index.json     (27 个精选，最高优先级)
 *
 * @param packageRoot 项目根目录
 * @returns 导入的 skill 数量
 */
export function populateFromQcIndex(packageRoot: string): number {
  let totalImported = 0;

  // Step 1: 导入 skills-availability-dictionary (2696 个基础数据)
  const dictPath = path.join(packageRoot, "data", "skills-availability-dictionary.json");
  if (fs.existsSync(dictPath)) {
    try {
      const content = fs.readFileSync(dictPath, "utf-8");
      const dict = JSON.parse(content) as {
        skills?: Array<{
          id?: string;
          name: string;
          description?: string;
          category?: string;
          availability?: {
            china?: { status?: string };
          };
        }>;
      };
      const skills = dict.skills;
      if (Array.isArray(skills) && skills.length > 0) {
        const items: SkillMarketplaceItem[] = skills.map((skill) => ({
          skillId: skill.id || skill.name,
          name: skill.name,
          description: skill.description || "",
          path: skill.name,
          category: skill.category,
          cnBlocked: skill.availability?.china?.status === "blocked",
          source: "availability-dict",
        }));
        insertItems(items);
        totalImported += items.length;
      }
    } catch {
      // 解析失败，继续执行 QC 导入
    }
  }

  // Step 2: 导入 QC 索引 (1190 + 27 个，有评分数据，会覆盖 Step 1 的同名条目)
  const qcPaths = findQcIndexPaths(packageRoot);
  for (const indexPath of qcPaths) {
    const qcIndex = parseQcIndexFile(indexPath);
    if (!qcIndex || qcIndex.skills.length === 0) continue;

    const items: SkillMarketplaceItem[] = qcIndex.skills.map((skill) => ({
      skillId: skill.name,
      name: skill.name,
      description: skill.description || "",
      descriptionCn: skill.descriptionZh,
      path: skill.path || skill.name,
      category: skill.category,
      tags: skill.tags,
      tier: skill.tier,
      overallScore: skill.overallScore,
      cnBlocked: skill.cnBlocked,
      cnAlternative: skill.cnAlternative,
      hasTranslation: skill.hasTranslation,
      source: "qc",
    }));

    // output-all 有 1190 个，output 有 27 个
    // output-all 先导入作为基线，output 的 27 个精选会 INSERT OR REPLACE 叠加
    insertItems(items);
    totalImported += items.length;
  }

  return totalImported;
}

/**
 * 检查 SQLite 是否已有 QC 基线数据
 * 通过检查 sync_meta 中的 qc_populated 标记
 */
export function isQcPopulated(): boolean {
  const db = getDatabase();
  const stmt = db.prepare("SELECT value FROM sync_meta WHERE key = 'qc_populated'");
  const row = stmt.get() as { value: string } | undefined;
  return row?.value === "1";
}

/**
 * 标记 QC 基线数据已导入
 */
export function markQcPopulated(): void {
  const db = getDatabase();
  db.prepare("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('qc_populated', '1')").run();
}

/**
 * 确保 QC 基线数据已导入（幂等，只执行一次）
 *
 * @param packageRoot 项目根目录
 * @returns 导入的 skill 数量，0 表示已经导入过或无数据
 */
export function ensureQcBaseline(packageRoot: string): number {
  if (isQcPopulated()) return 0;

  const count = populateFromQcIndex(packageRoot);
  if (count > 0) {
    markQcPopulated();
  }
  return count;
}
