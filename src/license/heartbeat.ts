/**
 * OpenClawCN License Module - Heartbeat Service
 * 心跳验证服务
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import { sendHeartbeat } from "./verify.js";
import { saveLicenseCache, loadLicenseCache, clearLicenseCache } from "./offline.js";
import { DEFAULT_LICENSE_CONFIG } from "./types.js";
import { refreshToken, setServerTierLimit } from "./token.js";

const log = createSubsystemLogger("license:heartbeat");

// 心跳定时器
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

// 心跳状态
let heartbeatState = {
  running: false,
  key: "",
  intervalHours: DEFAULT_LICENSE_CONFIG.heartbeatIntervalHours,
  lastHeartbeatAt: 0,
  consecutiveFailures: 0,
};

// 回调函数
type HeartbeatCallback = (result: { valid: boolean; daysRemaining: number }) => void;
type InvalidCallback = () => void;

let onHeartbeatSuccess: HeartbeatCallback | null = null;
let onHeartbeatFailure: InvalidCallback | null = null;
let onLicenseInvalid: InvalidCallback | null = null;

/**
 * 启动心跳服务
 *
 * @param key - 授权码
 * @param options - 配置选项
 */
export function startHeartbeat(
  key: string,
  options: {
    intervalHours?: number;
    onSuccess?: HeartbeatCallback;
    onFailure?: InvalidCallback;
    onInvalid?: InvalidCallback;
  } = {},
): void {
  // 停止已有的心跳
  stopHeartbeat();

  const intervalHours = options.intervalHours ?? DEFAULT_LICENSE_CONFIG.heartbeatIntervalHours;

  heartbeatState = {
    running: true,
    key,
    intervalHours,
    lastHeartbeatAt: Date.now(),
    consecutiveFailures: 0,
  };

  onHeartbeatSuccess = options.onSuccess || null;
  onHeartbeatFailure = options.onFailure || null;
  onLicenseInvalid = options.onInvalid || null;

  const intervalMs = intervalHours * 60 * 60 * 1000;

  log.info(`Starting heartbeat service (interval: ${intervalHours}h)`);

  heartbeatTimer = setInterval(async () => {
    await performHeartbeat();
  }, intervalMs);
}

/**
 * 停止心跳服务
 */
export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    log.info("Heartbeat service stopped");
  }

  heartbeatState.running = false;
  onHeartbeatSuccess = null;
  onHeartbeatFailure = null;
  onLicenseInvalid = null;
}

/**
 * 执行心跳
 */
async function performHeartbeat(): Promise<void> {
  if (!heartbeatState.running || !heartbeatState.key) {
    return;
  }

  log.debug("Performing heartbeat...");

  try {
    const result = await sendHeartbeat(heartbeatState.key);
    heartbeatState.lastHeartbeatAt = Date.now();
    heartbeatState.consecutiveFailures = 0;

    // [改造6] 吊销检查：服务端明确吊销时立即清缓存锁定（字段在 RSA 签名内，不可伪造）
    if (result.revoked === true) {
      log.warn("Heartbeat: license has been revoked by server — clearing cache and locking");
      clearLicenseCache();
      if (onLicenseInvalid) {
        onLicenseInvalid();
      }
      return;
    }

    if (result.valid) {
      // 检查是否已过期（daysRemaining <= 0）
      if (result.daysRemaining !== undefined && result.daysRemaining <= 0) {
        log.warn(`Heartbeat indicates license expired (days remaining: ${result.daysRemaining})`);
        clearLicenseCache();
        if (onLicenseInvalid) {
          onLicenseInvalid();
        }
        return;
      }

      log.debug(
        `Heartbeat successful (days remaining: ${result.daysRemaining}, tierLimit: ${result.tierLimit ?? "none"})`,
      );

      // 更新缓存中的验证时间、过期时间和 sessionSalt
      const cache = await loadLicenseCache();
      if (cache) {
        cache.verifyTime = Date.now();
        if (result.daysRemaining !== undefined && result.daysRemaining > 0) {
          const newExpiresAt = new Date(Date.now() + result.daysRemaining * 24 * 60 * 60 * 1000);
          cache.expiresAt = newExpiresAt.toISOString();
        }

        // [改造1] 心跳响应也刷新 sessionSalt（解决 previous_salt 竞态：服务端保留旧 salt 8h 可用）
        const newSalt = result.sessionSalt;
        const newSaltExp = result.saltExpiresAt;

        saveLicenseCache(heartbeatState.key, {
          valid: true,
          errorCode: null,
          errorMessage: null,
          serverTime: Date.now(),
          nextCheckAfterHours: cache.nextCheckAfterHours,
          license: {
            tier: (cache.tier as "basic" | "pro" | "test" | "trial") || "basic",
            tierName:
              cache.tier === "pro"
                ? "高级版"
                : cache.tier === "test"
                  ? "测试版"
                  : cache.tier === "trial"
                    ? "试用版"
                    : "基础版",
            expiresAt: cache.expiresAt || "",
            daysRemaining: result.daysRemaining ?? 0,
            keyType: "standard",
            features: cache.features,
            addons: cache.addons ?? [],
            upgradeAvailable: cache.upgradeAvailable ?? null,
          },
          device: null,
          notifications: null,
          renewalReminder: null,
          forceUpdate: null,
          // sessionSalt 透传，createLicenseCache 会从 response 读取
          sessionSalt: newSalt,
          saltExpiresAt: newSaltExp,
        });
      }

      // [改造5] 应用服务端强制降级（tierLimit 已在 RSA 签名内，不可伪造）
      // 传入 licenseKey 防止切换 key 后残留旧 tierLimit（Review 问题4）
      if (result.tierLimit !== undefined) {
        setServerTierLimit(result.tierLimit, heartbeatState.key);
      }

      // [改造4] 心跳成功后刷新功能令牌（异步，不阻塞心跳完成回调）
      void refreshToken(heartbeatState.key).catch((err) =>
        log.debug(`Token refresh failed (non-critical): ${err}`),
      );

      if (onHeartbeatSuccess) {
        onHeartbeatSuccess({ valid: true, daysRemaining: result.daysRemaining });
      }
    } else {
      log.warn("Heartbeat returned invalid license");
      clearLicenseCache();
      if (onLicenseInvalid) {
        onLicenseInvalid();
      }
    }
  } catch (error) {
    heartbeatState.consecutiveFailures++;
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.warn(`Heartbeat failed (attempt ${heartbeatState.consecutiveFailures}): ${errorMsg}`);

    // 心跳失败时，检查本地缓存是否已过期
    const cache = await loadLicenseCache();
    if (cache && cache.expiresAt) {
      const expiresAt = new Date(cache.expiresAt).getTime();
      if (Date.now() > expiresAt) {
        log.warn("License expired during heartbeat failure, clearing cache");
        clearLicenseCache();

        if (onLicenseInvalid) {
          onLicenseInvalid();
        }
        return;
      }
    }

    if (onHeartbeatFailure) {
      onHeartbeatFailure();
    }

    // 连续失败时，升级告警级别
    const failures = heartbeatState.consecutiveFailures;
    if (failures === 3) {
      log.warn(
        "Heartbeat failed 3 consecutive times. " +
          "License will continue working from offline cache, but please check your network connection. " +
          "If this persists, the license may become unavailable after the offline grace period expires.",
      );
    } else if (failures === 5) {
      log.error(
        "Heartbeat failed 5 consecutive times. Network appears unreachable. " +
          "Offline grace period is limited — please restore connectivity to avoid license disruption.",
      );
    }
  }
}

/**
 * 立即执行一次心跳
 */
export async function triggerHeartbeat(): Promise<boolean> {
  if (!heartbeatState.running || !heartbeatState.key) {
    return false;
  }

  try {
    await performHeartbeat();
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取心跳状态
 */
export function getHeartbeatStatus(): {
  running: boolean;
  intervalHours: number;
  lastHeartbeatAt: number;
  consecutiveFailures: number;
} {
  return { ...heartbeatState };
}

/**
 * 检查心跳是否正在运行
 */
export function isHeartbeatRunning(): boolean {
  return heartbeatState.running;
}
