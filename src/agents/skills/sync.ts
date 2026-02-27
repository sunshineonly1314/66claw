/**
 * Skills Index Background Sync
 *
 * 后台同步技能索引
 * - Gateway 启动时预拉取
 * - 定期检查更新
 * - 手动触发刷新
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import {
  fetchRemoteSkillsIndex,
  getInstalledSkills,
  DEFAULT_GITEE_REGISTRY,
  type GiteeRegistryConfig,
} from "./gitee-registry.js";
import { fetchProxySkillsIndex, getDefaultProxyConfig } from "./clawdskillsproxy-registry.js";
import {
  readLocalIndex,
  writeLocalIndex,
  isIndexStale,
  updateInstalledList,
  toMarketResponse,
  type SkillsMarketResponse,
} from "./local-index.js";

const logger = createSubsystemLogger("skills-sync");

// ============================================================================
// Types
// ============================================================================

export interface SyncOptions {
  /** 强制同步，忽略过期检查 */
  force?: boolean;
  /** 静默模式，失败不抛出错误 */
  silent?: boolean;
  /** 自定义过期阈值（毫秒） */
  staleMs?: number;
  /** 自定义 Gitee 配置 */
  registry?: GiteeRegistryConfig;
}

export interface SyncResult {
  /** 是否成功 */
  ok: boolean;
  /** 错误信息 */
  error?: string;
  /** 是否实际执行了同步（可能因为缓存有效而跳过） */
  synced: boolean;
  /** 技能数量 */
  skillCount?: number;
}

// ============================================================================
// State
// ============================================================================

/** 当前是否正在同步 */
let isSyncing = false;

/** 同步锁，防止并发同步 */
let syncPromise: Promise<SyncResult> | null = null;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * 同步技能索引（带去重锁）
 * 如果已有同步任务在执行，返回相同的 Promise
 */
export async function syncSkillsIndex(options: SyncOptions = {}): Promise<SyncResult> {
  // 如果已有同步任务在执行，返回相同的 Promise
  if (syncPromise && !options.force) {
    logger.debug("Sync already in progress, waiting for existing sync");
    return syncPromise;
  }

  syncPromise = doSync(options);
  try {
    return await syncPromise;
  } finally {
    syncPromise = null;
  }
}

/**
 * 实际执行同步逻辑
 */
async function doSync(options: SyncOptions): Promise<SyncResult> {
  const { force = false, silent = false, staleMs, registry } = options;

  try {
    isSyncing = true;

    // 检查本地缓存是否有效
    if (!force) {
      const localIndex = await readLocalIndex();
      if (!isIndexStale(localIndex, staleMs)) {
        logger.debug("Local index is fresh, skipping sync", {
          lastSyncedAt: localIndex?.lastSyncedAt,
        });
        return { ok: true, synced: false };
      }
    }

    logger.info("Starting skills index sync", { force });

    // 确保 QC 基线数据已导入（首次初始化时）
    try {
      const { ensureQcBaseline } = await import("./marketplace/db.js");
      const { resolveOpenClawCNPackageRootSync } = await import("../../infra/openclaw-root.js");
      const packageRoot = resolveOpenClawCNPackageRootSync({ argv1: process.argv[1] });
      if (packageRoot) {
        const qcCount = ensureQcBaseline(packageRoot);
        if (qcCount > 0) {
          logger.info("QC baseline imported into SQLite", { count: qcCount });
        }
      }
    } catch (err) {
      logger.debug("Failed to import QC baseline (non-fatal)", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 尝试增量同步：先读取 SQLite 中的 lastGlobalVersion
    let sinceVersion: number | undefined;
    try {
      const { getLastGlobalVersion } = await import("./marketplace/db.js");
      const lastVer = getLastGlobalVersion();
      if (lastVer > 0 && !force) {
        sinceVersion = lastVer;
        logger.debug("Attempting incremental sync", { sinceVersion });
      }
    } catch {
      // SQLite 未初始化，跳过增量
    }

    // 拉取远程索引
    // 优先使用增量（sinceVersion + proxy），回退全量
    const proxyConfig = getDefaultProxyConfig();
    const result =
      sinceVersion !== undefined && proxyConfig
        ? await fetchProxySkillsIndex(proxyConfig, sinceVersion)
        : await fetchRemoteSkillsIndex(registry ?? DEFAULT_GITEE_REGISTRY);

    if (!result.ok) {
      const error = `Failed to fetch remote index: ${result.error}`;
      logger.warn(error);
      if (!silent) {
        return { ok: false, error, synced: false };
      }
      return { ok: true, synced: false, error };
    }

    // 增量同步且无新数据时，跳过覆盖本地缓存（避免用空列表清空已有索引）
    if (sinceVersion !== undefined && result.index.skills.length === 0) {
      logger.debug("Incremental sync returned no new skills, keeping local cache");
      return { ok: true, synced: false };
    }

    // 获取本地已安装的技能列表
    const installed = getInstalledSkills();

    // 保存到本地 JSON - 使用 ClawdSkillsProxy 作为数据源（Gitee 已被封禁）
    const sourceUrl = proxyConfig?.baseUrl ?? "clawdskillsproxy";
    await writeLocalIndex(result.index, installed, sourceUrl);

    // 写入 SQLite（非阻塞，失败不影响主流程）
    const isProxyPath = sinceVersion !== undefined && proxyConfig;
    try {
      const { populateFromRemoteIndex, populateFromProxyIndex, setLastGlobalVersion } =
        await import("./marketplace/db.js");

      if (isProxyPath && result.index.version) {
        // 增量 proxy 路径: 使用 populateFromProxyIndex 以保留 proxyVersion/sha256/size
        populateFromProxyIndex(result.index.skills as any[], installed, result.index.version);
      } else {
        populateFromRemoteIndex(result.index.skills, installed);
      }
      // 注意：不再调用 updateInstalledStatus() 做全量 reset+rescan。
      // populateFromRemoteIndex/populateFromProxyIndex 在 insertItems() 内部已保留
      // 数据库中已有的 installed=1 状态，避免后台 sync 覆盖用户刚安装的技能。
      if (result.index.version) {
        setLastGlobalVersion(result.index.version);
      }
      logger.debug("Skills SQLite populated", {
        count: result.index.skills.length,
        globalVersion: result.index.version,
        incremental: isProxyPath,
      });
    } catch (err) {
      logger.warn("Failed to populate skills SQLite (non-fatal)", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("Skills index sync completed", {
      remoteCount: result.index.skills.length,
      installedCount: installed.length,
    });

    return {
      ok: true,
      synced: true,
      skillCount: result.index.skills.length,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error("Skills index sync failed", { error });

    if (silent) {
      return { ok: true, synced: false, error };
    }
    return { ok: false, error, synced: false };
  } finally {
    isSyncing = false;
  }
}

/**
 * 后台静默同步（用于 Gateway 启动时）
 * 不阻塞调用方，失败静默忽略
 */
export function syncSkillsIndexBackground(options?: SyncOptions): void {
  syncSkillsIndex({ ...options, silent: true }).catch((err) => {
    logger.debug("Background sync failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

/**
 * 获取技能市场列表
 * 优先读取本地缓存，后台检查是否需要刷新
 */
export async function getSkillsMarket(options?: {
  staleMs?: number;
}): Promise<SkillsMarketResponse> {
  const localIndex = await readLocalIndex();

  // 检查是否需要后台刷新
  if (isIndexStale(localIndex, options?.staleMs)) {
    // 触发后台同步（不阻塞响应）
    syncSkillsIndexBackground();
  }

  // 立即返回本地数据
  return toMarketResponse(localIndex, isSyncing);
}

/**
 * 刷新已安装列表（安装/卸载技能后调用）
 */
export async function refreshInstalledList(): Promise<void> {
  const installed = getInstalledSkills();
  await updateInstalledList(installed);

  // 同步更新 SQLite（非阻塞）
  try {
    const { updateInstalledStatus } = await import("./marketplace/db.js");
    updateInstalledStatus(installed);
  } catch {
    // SQLite 未初始化，忽略
  }
}

/**
 * 检查是否正在同步
 */
export function isSyncInProgress(): boolean {
  return isSyncing;
}

/**
 * 强制刷新技能市场（用户手动刷新）
 */
export async function forceRefreshMarket(): Promise<SkillsMarketResponse> {
  const result = await syncSkillsIndex({ force: true });

  if (!result.ok) {
    // 同步失败，返回本地缓存（如果有）
    const localIndex = await readLocalIndex();
    return {
      ...toMarketResponse(localIndex, false),
      message: `刷新失败: ${result.error}`,
    };
  }

  const localIndex = await readLocalIndex();
  return toMarketResponse(localIndex, false);
}
