/**
 * Clawdbot License Module - Heartbeat Service
 * 心跳验证服务
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import { sendHeartbeat } from "./verify.js";
import { saveLicenseCache, loadLicenseCache } from "./offline.js";
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
      log.debug(`Heartbeat successful (days remaining: ${result.daysRemaining})`);

      // 更新缓存中的验证时间
      const cache = loadLicenseCache();
      if (cache) {
        cache.verifyTime = Date.now();
        // 注意：这里简单更新 verifyTime，完整的响应需要重新验证
      }

      if (onHeartbeatSuccess) {
        onHeartbeatSuccess({ valid: true, daysRemaining: result.daysRemaining });
      }
    } else {
      log.warn("Heartbeat returned invalid license");

      if (onLicenseInvalid) {
        onLicenseInvalid();
      }
    }
  } catch (error) {
    heartbeatState.consecutiveFailures++;
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.warn(
      `Heartbeat failed (attempt ${heartbeatState.consecutiveFailures}): ${errorMsg}`,
    );

    if (onHeartbeatFailure) {
      onHeartbeatFailure();
    }

    // 连续失败 3 次后，降低检查频率
    if (heartbeatState.consecutiveFailures >= 3) {
      log.warn("Multiple heartbeat failures, consider checking network");
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
