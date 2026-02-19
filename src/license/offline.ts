/**
 * OpenClawCN License Module - Offline Mode
 * 离线模式判断和缓存管理
 *
 * Security: Cache files are encrypted with AES-256-GCM via secure-storage.
 * This prevents trivial tampering (e.g. editing expiresAt to 2099).
 * Legacy plaintext caches are auto-migrated on first read.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { resolveStateDir } from "../config/paths.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { saveSecureJson, loadSecureJson, isEncrypted } from "../infra/secure-storage.js";
import {
  type LicenseCache,
  type LicenseVerifyResponseData,
  DEFAULT_LICENSE_CONFIG,
} from "./types.js";
import { createLicenseCache } from "./verify.js";

const log = createSubsystemLogger("license:offline");

const LICENSE_CACHE_FILENAME = "license_cache.json";

/**
 * Compute HMAC-SHA256 over critical cache fields to detect field-level tampering.
 * Even though the file is AES-256-GCM encrypted, this provides defense-in-depth
 * against memory-level attacks that modify decrypted data before validation.
 */
function computeCacheHmac(cache: LicenseCache): string {
  // Derive HMAC key from machine-specific entropy (pid-independent, survives restart)
  const hmacSeed = [process.env.COMPUTERNAME || process.env.HOSTNAME || "unknown", cache.key].join(
    "|",
  );
  const hmacKey = crypto.createHash("sha256").update(hmacSeed).digest();

  const payload = [
    cache.key,
    String(cache.valid),
    String(cache.verifyTime),
    cache.expiresAt || "",
    cache.tier || "",
    cache.deviceId || "",
  ].join("|");

  return crypto.createHmac("sha256", hmacKey).update(payload).digest("hex");
}

/**
 * 获取缓存文件路径
 */
function getCacheFilePath(): string {
  const stateDir = resolveStateDir();
  return path.join(stateDir, LICENSE_CACHE_FILENAME);
}

/**
 * 保存验证结果到本地缓存（AES-256-GCM 加密）
 *
 * 写入策略：先备份当前缓存文件，再写入新内容。
 * 这样即使写入过程中断电/崩溃导致文件损坏，备份仍然可用。
 */
export function saveLicenseCache(key: string, response: LicenseVerifyResponseData): void {
  const cache = createLicenseCache(key, response);
  const filePath = getCacheFilePath();
  const backupPath = `${filePath}.bak`;

  // Stamp HMAC for tamper detection on critical fields
  const cacheWithHmac = { ...cache, _hmac: computeCacheHmac(cache) };

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 备份当前缓存（如果存在）
    if (fs.existsSync(filePath)) {
      try {
        fs.copyFileSync(filePath, backupPath);
      } catch {
        // 备份失败不阻塞写入
      }
    }

    // Use AES-256-GCM encrypted storage instead of plaintext JSON
    void saveSecureJson(filePath, cacheWithHmac).then(
      () => log.debug("License cache saved (encrypted)"),
      (err) => log.warn(`Failed to save encrypted license cache: ${err}`),
    );
  } catch (error) {
    log.warn(`Failed to save license cache: ${error}`);
  }
}

/**
 * 从指定文件路径解析缓存内容（不含备份回退逻辑）
 *
 * Supports both encrypted (AES-256-GCM) and legacy plaintext formats.
 * Legacy plaintext caches are auto-migrated to encrypted on next save.
 */
async function parseCacheFile(filePath: string): Promise<LicenseCache | null> {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  let cache: LicenseCache & { _hmac?: string };

  // Try encrypted format first (expected in production)
  if (isEncrypted(filePath)) {
    const decrypted = await loadSecureJson(filePath);
    cache = decrypted as LicenseCache & { _hmac?: string };
  } else {
    // Legacy plaintext — read directly, will be re-encrypted on next save
    log.debug("Legacy plaintext cache detected, will migrate on next save");
    const content = fs.readFileSync(filePath, "utf8");
    cache = JSON.parse(content) as LicenseCache & { _hmac?: string };
  }

  // 基本验证
  if (!cache.key || typeof cache.valid !== "boolean" || !cache.verifyTime) {
    return null;
  }

  // HMAC tamper detection (only for caches that have been saved with HMAC)
  if (cache._hmac) {
    const expectedHmac = computeCacheHmac(cache);
    if (cache._hmac !== expectedHmac) {
      log.warn("License cache HMAC mismatch — possible tampering detected");
      return null;
    }
  }

  return cache;
}

/**
 * 加载本地缓存的验证结果
 *
 * 读取策略：先尝试主文件，失败后尝试 .bak 备份文件。
 * 如果从备份恢复成功，同时修复主文件。
 */
export async function loadLicenseCache(): Promise<LicenseCache | null> {
  const filePath = getCacheFilePath();
  const backupPath = `${filePath}.bak`;

  // 1. 尝试主文件
  try {
    const cache = await parseCacheFile(filePath);
    if (cache) return cache;
  } catch (error) {
    log.warn(`License cache corrupted: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 2. 主文件失败，尝试备份
  try {
    const backupCache = await parseCacheFile(backupPath);
    if (backupCache) {
      log.info("Recovered license cache from backup");
      // 修复主文件 (re-encrypt)
      try {
        const cacheWithHmac = { ...backupCache, _hmac: computeCacheHmac(backupCache) };
        await saveSecureJson(filePath, cacheWithHmac);
        log.debug("Restored main cache file from backup (encrypted)");
      } catch {
        // 修复失败不影响返回
      }
      return backupCache;
    }
  } catch (backupError) {
    log.debug(
      `Backup cache also unavailable: ${backupError instanceof Error ? backupError.message : String(backupError)}`,
    );
  }

  return null;
}

/**
 * 清除本地缓存（包括备份文件）
 */
export function clearLicenseCache(): void {
  const filePath = getCacheFilePath();
  const backupPath = `${filePath}.bak`;

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
    log.debug("License cache cleared");
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
export async function canUseOffline(
  offlineGracePeriodHours: number = DEFAULT_LICENSE_CONFIG.offlineGracePeriodHours,
): Promise<boolean> {
  const cache = await loadLicenseCache();

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

  // Hard expiry: cache is absolutely unusable after 72h regardless of config.
  // This is a defense-in-depth guard: even if someone patches offlineGracePeriodHours
  // to 999999, the cache still expires. The 72h value is hardcoded in bytecode-protected
  // code, so changing it requires cracking the V8 bytecode.
  const HARD_EXPIRY_HOURS = 72;
  if (hoursOffline > HARD_EXPIRY_HOURS) {
    log.debug(
      `Cannot use offline: hard expiry exceeded (${hoursOffline.toFixed(1)}h > ${HARD_EXPIRY_HOURS}h)`,
    );
    return false;
  }

  if (hoursOffline > offlineGracePeriodHours) {
    log.debug(
      `Cannot use offline: exceeded grace period (${hoursOffline.toFixed(1)}h > ${offlineGracePeriodHours}h)`,
    );
    return false;
  }

  // Sanity check: verifyTime in the future is suspicious (clock manipulation)
  if (cache.verifyTime > now + 3600000) {
    log.warn("Cannot use offline: verifyTime is in the future (clock manipulation?)");
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

  log.debug(`Offline mode available (${hoursOffline.toFixed(1)}h since last verification)`);
  return true;
}

/**
 * 获取离线模式的缓存数据
 */
export async function getOfflineCache(): Promise<LicenseCache | null> {
  if (!(await canUseOffline())) {
    return null;
  }
  return loadLicenseCache();
}

/**
 * 获取离线剩余时间（小时）
 */
export async function getOfflineRemainingHours(
  offlineGracePeriodHours: number = DEFAULT_LICENSE_CONFIG.offlineGracePeriodHours,
): Promise<number> {
  const cache = await loadLicenseCache();

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
export async function shouldRefreshCache(nextCheckAfterHours?: number): Promise<boolean> {
  const cache = await loadLicenseCache();

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
export function createOfflineResponse(cache: LicenseCache): LicenseVerifyResponseData {
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
                  (new Date(cache.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
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
