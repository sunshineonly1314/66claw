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
import { verifyLicenseResponseSignature } from "./rsa-verify.js";
import { deriveKey } from "./sign.js";

const log = createSubsystemLogger("license:offline");

const LICENSE_CACHE_FILENAME = "license_cache.json";

/**
 * [HIGH-01 FIX] Monotonic clock baseline — captured at module load time.
 * Used to detect system clock rewind by comparing elapsed monotonic time
 * vs elapsed wall-clock time. Unlike Date.now(), process.hrtime.bigint()
 * cannot be influenced by system clock changes.
 */
const _clockBaseMono = process.hrtime.bigint();
const _clockBaseWall = Date.now();

/**
 * Compute HMAC-SHA256 over critical cache fields to detect field-level tampering.
 * Even though the file is AES-256-GCM encrypted, this provides defense-in-depth
 * against memory-level attacks that modify decrypted data before validation.
 *
 * Key derivation uses HKDF with machine-specific context for proper key separation.
 */
function computeCacheHmac(cache: LicenseCache): string {
  // Use HKDF to derive a dedicated cache-HMAC key from the license key,
  // with machine-specific info for binding to this device.
  const machineId = process.env.COMPUTERNAME || process.env.HOSTNAME || "unknown";
  const hmacKey = deriveKey(cache.key, `cache-hmac|${machineId}`);

  // Include full addon info in HMAC to prevent tampering with any addon field
  // (type, name, expiresAt, features are all covered so attackers cannot
  // inject features or extend expiry without invalidating the HMAC)
  const addonsHash = cache.addons?.length
    ? cache.addons
        .map((a) => `${a.type}:${a.name}:${a.expiresAt}:${(a.features ?? []).sort().join("+")}`)
        .sort()
        .join(",")
    : "";

  const payload = [
    cache.key,
    String(cache.valid),
    String(cache.verifyTime),
    cache.expiresAt || "",
    cache.tier || "",
    cache.deviceId || "",
    addonsHash,
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
 * [REVIEW FIX] Write serialization lock.
 * Ensures only one saveSecureJson is in-flight at a time.
 * Without this, concurrent calls (e.g., heartbeat + manual verify) can
 * interleave backup-copy and encrypted-write, corrupting the cache.
 */
let _cacheWriteLock: Promise<void> = Promise.resolve();

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

    // Serialize writes: chain onto the lock so backup+write is atomic per call.
    _cacheWriteLock = _cacheWriteLock
      .then(async () => {
        // 备份当前缓存（如果存在）
        if (fs.existsSync(filePath)) {
          try {
            fs.copyFileSync(filePath, backupPath);
          } catch {
            // 备份失败不阻塞写入
          }
        }

        // Use AES-256-GCM encrypted storage instead of plaintext JSON
        await saveSecureJson(filePath, cacheWithHmac);
        log.debug("License cache saved (encrypted)");
      })
      .catch((err) => {
        log.warn(`Failed to save encrypted license cache: ${err}`);
      });
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
  let wasEncrypted = false;

  // Try encrypted format first (expected in production)
  if (isEncrypted(filePath)) {
    const decrypted = await loadSecureJson(filePath);
    cache = decrypted as LicenseCache & { _hmac?: string };
    wasEncrypted = true;
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

  // [CRIT-03 FIX] Integrity check — differentiate encrypted vs plaintext caches.
  //
  // Encrypted caches (AES-256-GCM): the authenticated encryption itself guarantees
  // integrity — if the ciphertext was tampered with, loadSecureJson() would have
  // already thrown. So encrypted caches without _hmac are still trustworthy.
  //
  // Plaintext caches: no encryption protection. Without _hmac there is zero
  // integrity guarantee — an attacker can place a bare JSON file with
  // { valid: true, expiresAt: "2099..." }. These MUST be rejected.
  //
  // This is compatible with old clients: their encrypted caches (even without
  // _hmac) will still load. Only hand-crafted plaintext files are blocked.
  if (!wasEncrypted && !cache._hmac) {
    log.warn(
      "Plaintext license cache without HMAC — rejecting (integrity not verifiable). " +
        "This may be a legacy cache; it will be re-created on next successful verification.",
    );
    return null;
  }

  // HMAC tamper detection
  let hmacOk = true;
  if (cache._hmac) {
    const expectedHmac = computeCacheHmac(cache);
    if (cache._hmac !== expectedHmac) {
      // Don't reject immediately — HMAC key derivation may have changed after upgrade
      // (e.g. HKDF migration in LOW-07). If RSA signedPayload is available and valid,
      // we can still trust the cache and re-stamp the HMAC on next save.
      hmacOk = false;
      log.warn("License cache HMAC mismatch — will attempt RSA fallback verification");
    }
  }

  // [HIGH-08] RSA signature verification on signed payload
  // Ensures tier/expiresAt/features haven't been tampered with, even if
  // the attacker managed to decrypt and re-encrypt the cache file.
  if (cache.signedPayload) {
    const sp = cache.signedPayload;
    // Verify the stored signature against the stored signed fields
    const sigResult = verifyLicenseResponseSignature(
      sp.valid,
      sp.tier,
      sp.expiresAt,
      sp.serverTime,
      sp.signature,
    );
    if (!sigResult.valid) {
      log.warn("License cache signedPayload RSA verification failed — possible tampering");
      return null;
    }
    // Cross-check: cached fields must match signed fields
    if (cache.valid !== sp.valid || cache.tier !== sp.tier || cache.expiresAt !== sp.expiresAt) {
      log.warn("License cache fields diverge from signedPayload — tampering detected");
      return null;
    }
    // RSA verification passed — HMAC mismatch is tolerable (migration scenario)
    if (!hmacOk) {
      log.info(
        "HMAC mismatch tolerated: RSA signedPayload verification passed (key derivation migration)",
      );
    }
  } else if (!hmacOk) {
    // No RSA signedPayload to fall back on — HMAC is the only integrity check
    log.warn("License cache HMAC mismatch and no signedPayload — rejecting cache");
    return null;
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

  // [HIGH-01 FIX] Clock manipulation detection using monotonic time.
  // We record process.hrtime.bigint() at startup and compare elapsed real time
  // vs elapsed wall-clock time. If system clock was rewound, wall-clock delta
  // will be much smaller (or negative) relative to monotonic delta.
  const now = Date.now();
  const monotonicNowNs = process.hrtime.bigint();
  const wallClockDelta = now - _clockBaseWall;
  const monotonicDeltaMs = Number((monotonicNowNs - _clockBaseMono) / 1_000_000n);

  // If wall-clock advanced less than monotonic by more than 5 minutes,
  // the system clock was likely rewound.
  const clockDrift = monotonicDeltaMs - wallClockDelta;
  if (clockDrift > 5 * 60 * 1000) {
    log.warn(
      `Cannot use offline: clock manipulation detected (monotonic=${monotonicDeltaMs}ms, wall=${wallClockDelta}ms, drift=${clockDrift}ms)`,
    );
    return false;
  }

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

  // [HIGH-01 FIX] Additional check: if hoursOffline is negative (clock rewound
  // past verifyTime), it means the system time is before the last verification.
  if (hoursOffline < -0.1) {
    log.warn(
      `Cannot use offline: verifyTime is in the future relative to system clock (hoursOffline=${hoursOffline.toFixed(2)}h — clock rewound?)`,
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

/** 从 tier 值获取对应的中文名称 */
function getTierName(tier: string | null): string {
  switch (tier) {
    case "pro":
      return "高级版";
    case "test":
      return "测试版";
    case "trial":
      return "试用版";
    case "basic":
    default:
      return "基础版";
  }
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
          tier: (cache.tier as "basic" | "pro" | "test" | "trial") || "basic",
          tierName: getTierName(cache.tier),
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
          addons: cache.addons || [],
          upgradeAvailable: cache.upgradeAvailable ?? null,
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
