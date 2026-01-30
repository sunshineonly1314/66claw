/**
 * Local Skills Index
 *
 * 本地技能索引缓存管理
 * - 从 Gitee 拉取的远程索引缓存到本地
 * - Web 页面直接读取本地索引，无需等待网络
 * - 后台定期同步，保持索引最新
 */

import fs from "node:fs";
import path from "node:path";

import { CONFIG_DIR } from "../../utils.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { RemoteSkillMeta, RemoteSkillsIndex } from "./gitee-registry.js";

const logger = createSubsystemLogger("skills-index");
const fsp = fs.promises;

// ============================================================================
// Types
// ============================================================================

/** 本地缓存的技能索引结构 */
export interface LocalSkillsIndex {
  /** 索引格式版本 */
  schemaVersion: number;
  /** 最后同步时间 (ISO 8601) */
  lastSyncedAt: string;
  /** 索引来源 URL */
  sourceUrl: string;
  /** 远程技能列表 */
  remote: RemoteSkillMeta[];
  /** 本地已安装的技能名列表 */
  installed: string[];
}

/** 技能市场条目（包含安装状态） */
export interface MarketSkillEntry extends RemoteSkillMeta {
  /** 是否已安装到本地 */
  installed: boolean;
}

/** 技能市场列表响应 */
export interface SkillsMarketResponse {
  /** 技能列表 */
  skills: MarketSkillEntry[];
  /** 最后同步时间 */
  lastSyncedAt: string | null;
  /** 是否正在后台同步 */
  syncing: boolean;
  /** 提示消息 */
  message?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** 索引文件路径 */
export const LOCAL_INDEX_PATH = path.join(CONFIG_DIR, "skills-index.json");

/** 当前索引格式版本 */
const SCHEMA_VERSION = 1;

/** 默认索引过期时间 (5 分钟) */
const DEFAULT_STALE_MS = 5 * 60 * 1000;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * 读取本地索引文件
 * @returns 本地索引，如果文件不存在或格式错误返回 null
 */
export async function readLocalIndex(): Promise<LocalSkillsIndex | null> {
  try {
    if (!fs.existsSync(LOCAL_INDEX_PATH)) {
      return null;
    }
    const content = await fsp.readFile(LOCAL_INDEX_PATH, "utf-8");
    const data = JSON.parse(content) as LocalSkillsIndex;

    // 验证格式版本
    if (data.schemaVersion !== SCHEMA_VERSION) {
      logger.debug("Local index schema version mismatch, treating as stale", {
        expected: SCHEMA_VERSION,
        actual: data.schemaVersion,
      });
      return null;
    }

    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.debug("Failed to read local index", { error: message });
    return null;
  }
}

/**
 * 同步读取本地索引（用于启动时快速检查）
 */
export function readLocalIndexSync(): LocalSkillsIndex | null {
  try {
    if (!fs.existsSync(LOCAL_INDEX_PATH)) {
      return null;
    }
    const content = fs.readFileSync(LOCAL_INDEX_PATH, "utf-8");
    const data = JSON.parse(content) as LocalSkillsIndex;

    if (data.schemaVersion !== SCHEMA_VERSION) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * 写入本地索引文件
 */
export async function writeLocalIndex(
  remoteIndex: RemoteSkillsIndex,
  installedSkills: string[],
  sourceUrl: string,
): Promise<void> {
  const localIndex: LocalSkillsIndex = {
    schemaVersion: SCHEMA_VERSION,
    lastSyncedAt: new Date().toISOString(),
    sourceUrl,
    remote: remoteIndex.skills,
    installed: installedSkills,
  };

  // 确保目录存在
  const dir = path.dirname(LOCAL_INDEX_PATH);
  await fsp.mkdir(dir, { recursive: true });

  // 原子写入（先写临时文件再重命名）
  const tempPath = `${LOCAL_INDEX_PATH}.tmp`;
  await fsp.writeFile(tempPath, JSON.stringify(localIndex, null, 2), "utf-8");
  await fsp.rename(tempPath, LOCAL_INDEX_PATH);

  logger.info("Local skills index updated", {
    skillCount: remoteIndex.skills.length,
    installedCount: installedSkills.length,
  });
}

/**
 * 检查本地索引是否过期
 * @param staleMs 过期阈值（毫秒），默认 5 分钟
 */
export function isIndexStale(
  localIndex: LocalSkillsIndex | null,
  staleMs: number = DEFAULT_STALE_MS,
): boolean {
  if (!localIndex) {
    return true;
  }

  const lastSynced = new Date(localIndex.lastSyncedAt).getTime();
  const now = Date.now();
  return now - lastSynced > staleMs;
}

/**
 * 更新本地索引中的已安装列表
 * 用于安装/卸载技能后快速更新，无需重新拉取远程索引
 */
export async function updateInstalledList(
  installedSkills: string[],
): Promise<void> {
  const localIndex = await readLocalIndex();
  if (!localIndex) {
    return;
  }

  localIndex.installed = installedSkills;
  localIndex.lastSyncedAt = new Date().toISOString();

  const tempPath = `${LOCAL_INDEX_PATH}.tmp`;
  await fsp.writeFile(tempPath, JSON.stringify(localIndex, null, 2), "utf-8");
  await fsp.rename(tempPath, LOCAL_INDEX_PATH);

  logger.debug("Updated installed skills list", {
    count: installedSkills.length,
  });
}

/**
 * 将本地索引转换为市场响应格式
 */
export function toMarketResponse(
  localIndex: LocalSkillsIndex | null,
  syncing: boolean = false,
): SkillsMarketResponse {
  if (!localIndex) {
    return {
      skills: [],
      lastSyncedAt: null,
      syncing,
      message: syncing ? "正在获取技能市场数据..." : "技能市场索引尚未同步",
    };
  }

  const installedSet = new Set(localIndex.installed);
  const skills: MarketSkillEntry[] = localIndex.remote.map((skill) => ({
    ...skill,
    installed: installedSet.has(skill.name),
  }));

  return {
    skills,
    lastSyncedAt: localIndex.lastSyncedAt,
    syncing,
  };
}

/**
 * 获取本地索引路径
 */
export function getLocalIndexPath(): string {
  return LOCAL_INDEX_PATH;
}
