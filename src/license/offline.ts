/**
 * Clawdbot License Module - Offline Mode
 * 离线模式判断和缓存管理
 */

import fs from "node:fs";
import path from "node:path";

import { resolveStateDir } from "../config/paths.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  type LicenseCache,
  type LicenseVerifyResponseData,
  DEFAULT_LICENSE_CONFIG,
} from "./types.js";
import { createLicenseCache } from "./verify.js";

const log = createSubsystemLogger("license:offline");

const LICENSE_CACHE_FILENAME = "license_cache.json";

/**
 * 获取缓存文件路径
 */
function getCacheFilePath(): string {
  const stateDir = resolveStateDir();
  return path.join(stateDir, LICENSE_CACHE_FILENAME);
}

/**
 * 保存验证结果到本地缓存
 */
export function saveLicenseCache(
  key: string,
  response: LicenseVerifyResponseData,
): void {
  const cache = createLicenseCache(key, response);
  const filePath = getCacheFilePath();

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), "utf8");
    log.debug("License cache saved");
  } catch (error) {
    log.warn(`Failed to save license cache: ${error}`);
  }
}

/**
 * 加载本地缓存的验证结果
 */
export function loadLicenseCache(): LicenseCache | null {
  const filePath = getCacheFilePath();

  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, "utf8");
    const cache = JSON.parse(content) as LicenseCache;

    // 基本验证
    if (!cache.key || typeof cache.valid !== "boolean" || !cache.verifyTime) {
      log.warn("Invalid license cache format");
      return null;
    }

    return cache;
  } catch (error) {
    log.warn(`Failed to load license cache: ${error}`);
    return null;
  }
}

/**
 * 清除本地缓存
 */
export function clearLicenseCache(): void {
  const filePath = getCacheFilePath();

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      log.debug("License cache cleared");
    }
  } catch (error) {
    log.warn(`Failed to clear license cache: ${error}`);
  }
}

/**
 * 检查是否可以离线使用
 *
 * 条件：
 * 1. 有有效的缓存
 * 2. 缓存中的验证结果为有效
 * 3. 离线时长未超过宽限期
 * 4. 授权未过期
 */
export function canUseOffline(
  offlineGracePeriodHours: number = DEFAULT_LICENSE_CONFIG.offlineGracePeriodHours,
): boolean {
  const cache = loadLicenseCache();

  if (!cache) {
    log.debug("Cannot use offline: no cache found");
    return false;
  }

  if (!cache.valid) {
    log.debug("Cannot use offline: cached result is invalid");
    return false;
  }

  // 检查离线时长
  const now = Date.now();
  const hoursOffline = (now - cache.verifyTime) / (1000 * 60 * 60);

  if (hoursOffline > offlineGracePeriodHours) {
    log.debug(
      `Cannot use offline: exceeded grace period (${hoursOffline.toFixed(1)}h > ${offlineGracePeriodHours}h)`,
    );
    return false;
  }

  // 检查授权是否过期
  if (cache.expiresAt) {
    const expiresAt = new Date(cache.expiresAt).getTime();
    if (now > expiresAt) {
      log.debug("Cannot use offline: license expired");
      return false;
    }
  }

  log.debug(
    `Offline mode available (${hoursOffline.toFixed(1)}h since last verification)`,
  );
  return true;
}

/**
 * 获取离线模式的缓存数据
 */
export function getOfflineCache(): LicenseCache | null {
  if (!canUseOffline()) {
    return null;
  }
  return loadLicenseCache();
}

/**
 * 获取离线剩余时间（小时）
 */
export function getOfflineRemainingHours(
  offlineGracePeriodHours: number = DEFAULT_LICENSE_CONFIG.offlineGracePeriodHours,
): number {
  const cache = loadLicenseCache();

  if (!cache || !cache.valid) {
    return 0;
  }

  const now = Date.now();
  const hoursOffline = (now - cache.verifyTime) / (1000 * 60 * 60);
  const remaining = offlineGracePeriodHours - hoursOffline;

  return Math.max(0, remaining);
}

/**
 * 检查缓存是否需要刷新
 */
export function shouldRefreshCache(
  nextCheckAfterHours?: number,
): boolean {
  const cache = loadLicenseCache();

  if (!cache) {
    return true;
  }

  const checkInterval = nextCheckAfterHours ?? cache.nextCheckAfterHours ?? 24;
  const now = Date.now();
  const hoursSinceVerify = (now - cache.verifyTime) / (1000 * 60 * 60);

  return hoursSinceVerify >= checkInterval;
}

/**
 * 从缓存创建模拟的验证响应（用于离线模式）
 */
export function createOfflineResponse(
  cache: LicenseCache,
): LicenseVerifyResponseData {
  return {
    valid: cache.valid,
    errorCode: null,
    errorMessage: null,
    serverTime: Date.now(),
    nextCheckAfterHours: cache.nextCheckAfterHours,
    license: cache.valid
      ? {
          tier: (cache.tier as "basic" | "test") || "basic",
          tierName: cache.tier === "test" ? "测试版" : "基础版",
          expiresAt: cache.expiresAt || "",
          daysRemaining: cache.expiresAt
            ? Math.max(
                0,
                Math.ceil(
                  (new Date(cache.expiresAt).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24),
                ),
              )
            : 0,
          keyType: "standard",
          features: cache.features,
        }
      : null,
    device: {
      deviceId: cache.deviceId,
      deviceLimit: 2,
      boundDevices: 1,
      isCurrentBound: true,
    },
    notifications: null,
    renewalReminder: null,
    forceUpdate: null,
  };
}
