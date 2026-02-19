/**
 * OpenClawCN License Module - Heartbeat Service
 * 心跳验证服务
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import { sendHeartbeat } from "./verify.js";
import { saveLicenseCache, loadLicenseCache, clearLicenseCache } from "./offline.js";
import { DEFAULT_LICENSE_CONFIG } from "./types.js";

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

    if (result.valid) {
      // 检查是否已过期（daysRemaining <= 0）
      if (result.daysRemaining !== undefined && result.daysRemaining <= 0) {
        log.warn(`Heartbeat indicates license expired (days remaining: ${result.daysRemaining})`);

        // 清除本地缓存
        clearLicenseCache();

        if (onLicenseInvalid) {
          onLicenseInvalid();
        }
        return;
      }

      log.debug(`Heartbeat successful (days remaining: ${result.daysRemaining})`);

      // 更新缓存中的验证时间和过期时间
      const cache = await loadLicenseCache();
      if (cache) {
        cache.verifyTime = Date.now();
        // 更新 daysRemaining 对应的过期时间
        if (result.daysRemaining !== undefined && result.daysRemaining > 0) {
          const newExpiresAt = new Date(Date.now() + result.daysRemaining * 24 * 60 * 60 * 1000);
          cache.expiresAt = newExpiresAt.toISOString();
        }
        saveLicenseCache(heartbeatState.key, {
          valid: true,
          errorCode: null,
          errorMessage: null,
          serverTime: Date.now(),
          nextCheckAfterHours: cache.nextCheckAfterHours,
          license: {
            tier: (cache.tier as "basic" | "test") || "basic",
            tierName: cache.tier === "test" ? "测试版" : "基础版",
            expiresAt: cache.expiresAt || "",
            daysRemaining: result.daysRemaining ?? 0,
            keyType: "standard",
            features: cache.features,
          },
          device: null,
          notifications: null,
          renewalReminder: null,
          forceUpdate: null,
        });
      }

      if (onHeartbeatSuccess) {
        onHeartbeatSuccess({ valid: true, daysRemaining: result.daysRemaining });
      }
    } else {
      log.warn("Heartbeat returned invalid license");

      // 清除本地缓存
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
