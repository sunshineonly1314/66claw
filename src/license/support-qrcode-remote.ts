/**
 * Remote Support QR Code Management
 * 远程技术支持群二维码管理 - 带 7 天本地持久缓存
 *
 * 从远程服务端拉取二维码图片，本地缓存 7 天。
 * 在过期之前不再重复拉取，避免不必要的网络请求。
 *
 * 缓存策略：
 *   1. 首先检查本地持久缓存（{stateDir}/qrcodes/cache/metadata.json）
 *   2. 如果缓存有效且未过期 → 直接返回本地 base64
 *   3. 如果缓存过期或不存在 → 从服务端拉取新图片
 *   4. 拉取成功后写入本地缓存 + 更新 metadata
 *   5. 拉取失败时降级使用过期缓存（如果有的话）
 *
 * 兼容模式：
 *   - 如果远程 API 不可用，回退到本地文件夹方式（support-qrcode.ts）
 */

import fs from "node:fs";
import path from "node:path";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { resolveStateDir } from "../config/paths.js";
import { detectChinaRegion } from "../config/region-cn.js";
import { DEFAULT_LICENSE_CONFIG } from "./types.js";
import type { SupportQrcodeConfig } from "./types.js";

const log = createSubsystemLogger("license:support-qrcode-remote");

// ============================================================================
// 配置
// ============================================================================

/** 默认缓存有效期：7 天 */
const DEFAULT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 内存缓存（避免每次都读磁盘） */
let memoryCache: RemoteQrcodeCache | null = null;

/** 正在进行的拉取请求（防止并发重复拉取） */
let pendingFetch: Promise<RemoteQrcodeCache | null> | null = null;

// ============================================================================
// 类型
// ============================================================================

/** 持久化缓存的元数据 */
export interface RemoteQrcodeMetadata {
  /** 图片版本号（服务端返回） */
  version: string;
  /** 群名称 */
  groupName: string;
  /** 拉取时间戳 (Unix ms) */
  fetchedAt: number;
  /** 过期时间戳 (Unix ms)，来自服务端 */
  expiresAt: number;
  /** 用户类型 */
  keyType: "test" | "trial" | "standard";
  /** 图片文件名 */
  imageFile: string;
}

/** 内存中的缓存条目 */
interface RemoteQrcodeCache {
  base64: string;
  groupName: string;
  version: string;
  expiresAt: number;
  fetchedAt: number;
}

/** 服务端返回的二维码响应 */
export interface RemoteQrcodeResponse {
  success: boolean;
  data?: {
    base64: string;
    groupName: string;
    version: string;
    /** 过期时间戳 Unix ms（可选，服务端未设置过期时不返回） */
    expiresAt?: number;
    /** 剩余有效秒数（可选，服务端未设置过期时不返回） */
    ttlSeconds?: number;
  };
  /** 如果 currentVersion 匹配，返回 true */
  notModified?: boolean;
  /** 错误信息（success=false 时返回） */
  error?: string;
}

// ============================================================================
// 缓存目录管理
// ============================================================================

function getCacheDir(): string {
  const stateDir = resolveStateDir();
  return path.join(stateDir, "qrcodes", "cache");
}

function getMetadataPath(): string {
  return path.join(getCacheDir(), "metadata.json");
}

function ensureCacheDir(): void {
  const dir = getCacheDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ============================================================================
// 持久缓存读写
// ============================================================================

/**
 * 从磁盘读取缓存元数据
 */
function loadCachedMetadata(): RemoteQrcodeMetadata | null {
  try {
    const metaPath = getMetadataPath();
    if (!fs.existsSync(metaPath)) return null;

    const raw = fs.readFileSync(metaPath, "utf-8");
    const meta = JSON.parse(raw) as RemoteQrcodeMetadata;

    // 基本字段验证
    if (!meta.version || !meta.groupName || !meta.expiresAt || !meta.imageFile) {
      return null;
    }

    return meta;
  } catch (error) {
    log.debug("Failed to load QR code cache metadata", { error });
    return null;
  }
}

/**
 * 从磁盘读取缓存的图片 base64
 */
function loadCachedImage(meta: RemoteQrcodeMetadata): string | null {
  try {
    const imagePath = path.join(getCacheDir(), meta.imageFile);
    if (!fs.existsSync(imagePath)) return null;

    const stat = fs.statSync(imagePath);
    if (stat.size > 2 * 1024 * 1024) {
      log.warn(`Cached QR code image too large: ${stat.size} bytes`);
      return null;
    }

    const buffer = fs.readFileSync(imagePath);
    // 检查是否已经是 data URL 格式
    const text = buffer.toString("utf-8");
    if (text.startsWith("data:")) {
      return text;
    }
    // 否则按 base64 编码处理
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch (error) {
    log.debug("Failed to load cached QR code image", { error });
    return null;
  }
}

/**
 * 将二维码保存到本地持久缓存
 */
function saveCacheToLocal(
  base64: string,
  groupName: string,
  version: string,
  expiresAt: number,
  keyType: "test" | "trial" | "standard",
): void {
  try {
    ensureCacheDir();

    const imageFile = "qrcode.dat";
    const imagePath = path.join(getCacheDir(), imageFile);

    // 写入图片数据（存储为 data URL 字符串）
    fs.writeFileSync(imagePath, base64, "utf-8");

    // 写入元数据
    const meta: RemoteQrcodeMetadata = {
      version,
      groupName,
      fetchedAt: Date.now(),
      expiresAt,
      keyType,
      imageFile,
    };
    fs.writeFileSync(getMetadataPath(), JSON.stringify(meta, null, 2), "utf-8");

    log.info(`QR code cached locally, expires at ${new Date(expiresAt).toISOString()}`);
  } catch (error) {
    log.warn("Failed to save QR code cache", { error });
  }
}

// ============================================================================
// 缓存有效性检查
// ============================================================================

/**
 * 检查缓存是否过期
 */
export function isCacheExpired(meta: RemoteQrcodeMetadata | null): boolean {
  if (!meta) return true;
  return Date.now() >= meta.expiresAt;
}

/**
 * 获取缓存剩余有效时间（毫秒）
 */
export function getCacheRemainingMs(meta: RemoteQrcodeMetadata | null): number {
  if (!meta) return 0;
  return Math.max(0, meta.expiresAt - Date.now());
}

// ============================================================================
// 远程拉取
// ============================================================================

/**
 * 从远程服务端拉取二维码
 *
 * @param key - 授权码
 * @param deviceId - 设备 ID
 * @param keyType - 用户类型
 * @param currentVersion - 当前缓存版本（可选，支持 304 Not Modified）
 */
export async function fetchRemoteQrcode(
  key: string,
  deviceId: string,
  keyType: "test" | "trial" | "standard",
  currentVersion?: string,
): Promise<RemoteQrcodeResponse | null> {
  const directUrl = DEFAULT_LICENSE_CONFIG.apiBaseUrl.replace(/\/license\/?$/, "/support/qrcode");
  // 中国区：先尝试国内反代 obplugins.cn，失败再回源 tecbinai.com
  const urls = detectChinaRegion()
    ? [directUrl.replace("www.tecbinai.com", "www.obplugins.cn"), directUrl]
    : [directUrl];

  const body = {
    key,
    deviceId,
    keyType,
    currentVersion: currentVersion ?? undefined,
  };

  for (const url of urls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        log.warn(`Remote QR code API returned ${response.status} from ${url}`);
        continue;
      }

      const result = (await response.json()) as RemoteQrcodeResponse;
      return result;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        log.warn(`Remote QR code fetch timed out (15s) from ${url}`);
      } else {
        log.debug(`Failed to fetch remote QR code from ${url}`, { error });
      }
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

// ============================================================================
// 核心 API
// ============================================================================

/**
 * 获取二维码（优先缓存，过期时异步拉取）
 *
 * 调用策略：
 *   1. 内存缓存有效 → 直接返回
 *   2. 磁盘缓存有效 → 加载到内存后返回
 *   3. 缓存过期 → 返回过期缓存 + 后台触发刷新
 *   4. 无缓存 → 同步拉取（阻塞等待）
 *
 * @returns 二维码配置，null 表示无可用数据
 */
export async function getRemoteSupportQrcode(
  key: string,
  deviceId: string,
  keyType: "test" | "trial" | "standard",
): Promise<SupportQrcodeConfig | null> {
  // 1. 检查内存缓存
  if (memoryCache && Date.now() < memoryCache.expiresAt) {
    return { base64: memoryCache.base64, groupName: memoryCache.groupName };
  }

  // 2. 检查磁盘缓存
  const meta = loadCachedMetadata();
  if (meta && !isCacheExpired(meta)) {
    const base64 = loadCachedImage(meta);
    if (base64) {
      // 加载到内存缓存
      memoryCache = {
        base64,
        groupName: meta.groupName,
        version: meta.version,
        expiresAt: meta.expiresAt,
        fetchedAt: meta.fetchedAt,
      };
      return { base64, groupName: meta.groupName };
    }
  }

  // 3. 缓存过期或不存在 → 尝试远程拉取
  // 如果有过期缓存，先返回过期数据，后台刷新
  if (meta) {
    const base64 = loadCachedImage(meta);
    if (base64) {
      // 后台静默刷新（不阻塞当前请求）
      void refreshQrcodeInBackground(key, deviceId, keyType, meta.version);
      return { base64, groupName: meta.groupName };
    }
  }

  // 4. 完全无缓存 → 同步拉取
  const result = await fetchAndCacheQrcode(key, deviceId, keyType);
  return result;
}

/**
 * 主动预加载/校验二维码（进入 chat 页面时调用）
 *
 * 返回当前状态：
 *   - "valid" → 缓存有效，无需操作
 *   - "refreshing" → 正在后台刷新
 *   - "fetching" → 正在首次拉取
 *   - "failed" → 拉取失败
 *
 * @returns 预加载结果
 */
export async function preloadSupportQrcode(
  key: string,
  deviceId: string,
  keyType: "test" | "trial" | "standard",
): Promise<{
  status: "valid" | "refreshing" | "fetching" | "failed";
  qrcode: SupportQrcodeConfig | null;
  expiresAt: number | null;
  remainingMs: number;
}> {
  // 检查内存缓存
  if (memoryCache && Date.now() < memoryCache.expiresAt) {
    return {
      status: "valid",
      qrcode: { base64: memoryCache.base64, groupName: memoryCache.groupName },
      expiresAt: memoryCache.expiresAt,
      remainingMs: memoryCache.expiresAt - Date.now(),
    };
  }

  // 检查磁盘缓存
  const meta = loadCachedMetadata();
  if (meta && !isCacheExpired(meta)) {
    const base64 = loadCachedImage(meta);
    if (base64) {
      memoryCache = {
        base64,
        groupName: meta.groupName,
        version: meta.version,
        expiresAt: meta.expiresAt,
        fetchedAt: meta.fetchedAt,
      };
      return {
        status: "valid",
        qrcode: { base64, groupName: meta.groupName },
        expiresAt: meta.expiresAt,
        remainingMs: meta.expiresAt - Date.now(),
      };
    }
  }

  // 缓存过期 → 需要刷新
  if (meta) {
    const base64 = loadCachedImage(meta);
    if (base64) {
      // 有过期数据可用，后台刷新
      void refreshQrcodeInBackground(key, deviceId, keyType, meta.version);
      return {
        status: "refreshing",
        qrcode: { base64, groupName: meta.groupName },
        expiresAt: meta.expiresAt,
        remainingMs: 0,
      };
    }
  }

  // 完全无缓存 → 同步拉取
  const result = await fetchAndCacheQrcode(key, deviceId, keyType);
  if (result) {
    return {
      status: "valid",
      qrcode: result,
      expiresAt: memoryCache?.expiresAt ?? null,
      remainingMs: memoryCache ? memoryCache.expiresAt - Date.now() : 0,
    };
  }

  return {
    status: "failed",
    qrcode: null,
    expiresAt: null,
    remainingMs: 0,
  };
}

/**
 * 同步拉取并缓存
 */
async function fetchAndCacheQrcode(
  key: string,
  deviceId: string,
  keyType: "test" | "trial" | "standard",
  currentVersion?: string,
): Promise<SupportQrcodeConfig | null> {
  // 防止并发拉取
  if (pendingFetch) {
    const result = await pendingFetch;
    if (result) {
      return { base64: result.base64, groupName: result.groupName };
    }
    return null;
  }

  pendingFetch = (async () => {
    try {
      const response = await fetchRemoteQrcode(key, deviceId, keyType, currentVersion);

      if (!response) return null;

      // 304 Not Modified → 延长本地缓存（版本未变，继续使用现有图片）
      if (response.notModified && currentVersion) {
        log.info("QR code not modified (304), extending cache TTL");
        const meta = loadCachedMetadata();
        if (meta) {
          const newExpiresAt = Date.now() + DEFAULT_CACHE_TTL_MS;
          meta.expiresAt = newExpiresAt;
          meta.fetchedAt = Date.now();
          try {
            ensureCacheDir();
            fs.writeFileSync(getMetadataPath(), JSON.stringify(meta, null, 2), "utf-8");
          } catch { /* ignore */ }
          const base64 = loadCachedImage(meta);
          if (base64) {
            const cache: RemoteQrcodeCache = {
              base64,
              groupName: meta.groupName,
              version: meta.version,
              expiresAt: newExpiresAt,
              fetchedAt: Date.now(),
            };
            memoryCache = cache;
            return cache;
          }
        }
        return null;
      }

      if (!response.success || !response.data) {
        if (response.error) {
          log.warn(`Remote QR code API error: ${response.error}`);
        }
        return null;
      }

      const { base64, groupName, version, expiresAt, ttlSeconds } = response.data;

      // 计算过期时间（优先级：expiresAt > ttlSeconds > 默认 7 天）
      // 服务端未设置过期时 expiresAt 和 ttlSeconds 都不存在
      let finalExpiresAt: number;
      if (expiresAt && expiresAt > 0) {
        finalExpiresAt = expiresAt;
      } else if (ttlSeconds && ttlSeconds > 0) {
        finalExpiresAt = Date.now() + ttlSeconds * 1000;
      } else {
        finalExpiresAt = Date.now() + DEFAULT_CACHE_TTL_MS;
      }

      // 保存到本地
      saveCacheToLocal(base64, groupName, version, finalExpiresAt, keyType);

      // 更新内存缓存
      const cache: RemoteQrcodeCache = {
        base64,
        groupName,
        version,
        expiresAt: finalExpiresAt,
        fetchedAt: Date.now(),
      };
      memoryCache = cache;

      return cache;
    } catch (error) {
      log.warn("Failed to fetch and cache QR code", { error });
      return null;
    } finally {
      pendingFetch = null;
    }
  })();

  const result = await pendingFetch;
  if (result) {
    return { base64: result.base64, groupName: result.groupName };
  }
  return null;
}

/**
 * 后台静默刷新（不阻塞调用方）
 */
function refreshQrcodeInBackground(
  key: string,
  deviceId: string,
  keyType: "test" | "trial" | "standard",
  currentVersion?: string,
): void {
  void fetchAndCacheQrcode(key, deviceId, keyType, currentVersion).catch((error) => {
    log.debug("Background QR code refresh failed", { error });
  });
}

/**
 * 清除所有远程缓存（用于测试）
 */
export function clearRemoteQrcodeCache(): void {
  memoryCache = null;
  pendingFetch = null;
  try {
    const metaPath = getMetadataPath();
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    const imagePath = path.join(getCacheDir(), "qrcode.dat");
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  } catch { /* ignore */ }
}

/**
 * 获取缓存状态摘要（供调试/UI 使用）
 */
export function getQrcodeCacheStatus(): {
  hasCached: boolean;
  isExpired: boolean;
  expiresAt: number | null;
  remainingMs: number;
  version: string | null;
  fetchedAt: number | null;
} {
  const meta = loadCachedMetadata();
  if (!meta) {
    return {
      hasCached: false,
      isExpired: true,
      expiresAt: null,
      remainingMs: 0,
      version: null,
      fetchedAt: null,
    };
  }

  return {
    hasCached: true,
    isExpired: isCacheExpired(meta),
    expiresAt: meta.expiresAt,
    remainingMs: getCacheRemainingMs(meta),
    version: meta.version,
    fetchedAt: meta.fetchedAt,
  };
}
