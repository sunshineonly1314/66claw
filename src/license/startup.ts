/**
 * Clawdbot License Module - Startup Verification
 * 启动时授权验证流程
 */

import { loadConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  type LicenseVerifyResponseData,
  type LicenseClientState,
  type LicenseModuleConfig,
  DEFAULT_LICENSE_CONFIG,
  LicenseErrorCode,
} from "./types.js";
import { getDeviceId } from "./device-id.js";
import {
  configureLicense,
  verifyLicenseWithRetry,
  getErrorMessage,
} from "./verify.js";
import {
  saveLicenseCache,
  canUseOffline,
  getOfflineCache,
  createOfflineResponse,
} from "./offline.js";
import { startHeartbeat, stopHeartbeat } from "./heartbeat.js";
import { getShownNotificationIds, filterNotificationsToShow } from "./notifications.js";

const log = createSubsystemLogger("license:startup");

/**
 * 启动验证结果
 */
export interface StartupVerifyResult {
  /** 是否可以继续启动 */
  canProceed: boolean;
  /** 授权是否有效 */
  valid: boolean;
  /** 是否离线模式 */
  offlineMode: boolean;
  /** 设备 ID */
  deviceId: string;
  /** 下次检查间隔(小时) */
  nextCheckAfterHours: number;
  /** 错误信息 */
  error: string | null;
  /** 错误码 */
  errorCode: LicenseErrorCode | null;
  /** 完整的验证响应 */
  response: LicenseVerifyResponseData | null;
  /** 客户端状态 */
  clientState: LicenseClientState;
}

/**
 * 判断是否开发模式
 *
 * 安全说明：
 * - __DEV_BUILD__ 是编译时常量
 * - 生产构建时会被替换为 false，彻底禁用 DEV 模式绕过
 * - 开发构建时为 true，允许通过环境变量启用 DEV 模式
 * - 如果 __DEV_BUILD__ 未定义（构建异常），默认视为生产模式
 */
function isDevMode(): boolean {
  // 安全检查：如果 __DEV_BUILD__ 未定义，视为生产模式（不允许绕过）
  // 使用 typeof 检查避免 ReferenceError
  const isDevBuild = typeof __DEV_BUILD__ !== "undefined" && __DEV_BUILD__;

  // 生产构建：__DEV_BUILD__ = false 或未定义，直接返回 false
  if (!isDevBuild) {
    return false;
  }

  // 开发构建：检查环境变量
  return (
    process.env.NODE_ENV === "development" ||
    process.env.CLAWDBOT_DEV === "1" ||
    process.env.CLAWDBOT_LICENSE_DEV === "1"
  );
}

/**
 * 从配置加载授权码
 */
function loadLicenseKey(): string | null {
  const config = loadConfig();
  return config.license?.key || null;
}

/**
 * 启动时验证授权
 *
 * 验证流程：
 * 1. 检查是否开发模式（跳过验证）
 * 2. 读取配置中的授权码
 * 3. 尝试在线验证
 * 4. 失败时尝试离线模式
 * 5. 启动心跳服务
 */
export async function verifyLicenseOnStartup(
  options: {
    config?: Partial<LicenseModuleConfig>;
    onInvalid?: () => void;
  } = {},
): Promise<StartupVerifyResult> {
  const deviceId = getDeviceId();

  // 配置模块
  const moduleConfig = {
    ...DEFAULT_LICENSE_CONFIG,
    ...options.config,
    devMode: isDevMode(),
  };
  configureLicense(moduleConfig);

  // 初始化结果
  const createResult = (
    partial: Partial<StartupVerifyResult>,
  ): StartupVerifyResult => ({
    canProceed: false,
    valid: false,
    offlineMode: false,
    deviceId,
    nextCheckAfterHours: 24,
    error: null,
    errorCode: null,
    response: null,
    clientState: {
      checking: false,
      valid: false,
      offlineMode: false,
      error: null,
      errorCode: null,
      license: null,
      device: null,
      renewalReminder: null,
      forceUpdate: null,
      pendingNotifications: [],
      lastVerifiedAt: null,
      deviceSwitchInfo: null,
      deviceSwitchCooldown: null,
    },
    ...partial,
  });

  // 开发模式：跳过验证
  if (moduleConfig.devMode) {
    log.info("Dev mode enabled, skipping license verification");
    return createResult({
      canProceed: true,
      valid: true,
      clientState: {
        checking: false,
        valid: true,
        offlineMode: false,
        error: null,
        errorCode: null,
        license: {
          tier: "basic",
          tierName: "开发模式",
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          daysRemaining: 365,
          keyType: "test",
          features: ["basic_chat", "basic_skills", "history_7days", "dev_mode"],
        },
        device: { deviceId, deviceLimit: 999, boundDevices: 1, isCurrentBound: true },
        renewalReminder: null,
        forceUpdate: null,
        pendingNotifications: [],
        lastVerifiedAt: Date.now(),
        deviceSwitchInfo: null,
        deviceSwitchCooldown: null,
      },
    });
  }

  // 读取授权码
  const key = loadLicenseKey();
  if (!key) {
    log.warn("No license key found in config");
    return createResult({
      canProceed: false,
      error: "未找到授权码，请先激活授权",
      clientState: {
        checking: false,
        valid: false,
        offlineMode: false,
        error: "未找到授权码，请先激活授权",
        errorCode: null,
        license: null,
        device: null,
        renewalReminder: null,
        forceUpdate: null,
        pendingNotifications: [],
        lastVerifiedAt: null,
        deviceSwitchInfo: null,
        deviceSwitchCooldown: null,
      },
    });
  }

  log.info(`Verifying license: ${key.substring(0, 10)}...`);

  // 尝试在线验证
  try {
    const shownNotificationIds = getShownNotificationIds();
    const response = await verifyLicenseWithRetry(key, {
      shownNotificationIds,
      maxRetries: 3,
    });

    if (response.valid) {
      // 只在验证成功时保存缓存（用于离线模式）
      saveLicenseCache(key, response);
      log.info(
        `License verified successfully (tier: ${response.license?.tier}, days remaining: ${response.license?.daysRemaining})`,
      );

      // 启动心跳服务
      startHeartbeat(key, {
        intervalHours: response.nextCheckAfterHours || 24,
        onInvalid: options.onInvalid,
      });

      // 过滤需要展示的通知
      const pendingNotifications = filterNotificationsToShow(response.notifications);

      return createResult({
        canProceed: true,
        valid: true,
        nextCheckAfterHours: response.nextCheckAfterHours || 24,
        response,
        clientState: {
          checking: false,
          valid: true,
          offlineMode: false,
          error: null,
          errorCode: null,
          license: response.license,
          device: response.device,
          renewalReminder: response.renewalReminder,
          forceUpdate: response.forceUpdate,
          pendingNotifications,
          lastVerifiedAt: Date.now(),
          deviceSwitchInfo: response.deviceSwitchInfo ?? null,
          deviceSwitchCooldown: response.deviceSwitchCooldown ?? null,
        },
      });
    }

    // 验证失败
    const errorMsg = response.errorMessage || getErrorMessage(response.errorCode);
    log.warn(`License validation failed: ${errorMsg} (code: ${response.errorCode})`);

    return createResult({
      canProceed: false,
      error: errorMsg,
      errorCode: response.errorCode,
      response,
      clientState: {
        checking: false,
        valid: false,
        offlineMode: false,
        error: errorMsg,
        errorCode: response.errorCode,
        license: null,
        device: null,
        renewalReminder: response.renewalReminder,
        forceUpdate: response.forceUpdate,
        pendingNotifications: [],
        lastVerifiedAt: Date.now(),
        deviceSwitchInfo: response.deviceSwitchInfo ?? null,
        deviceSwitchCooldown: response.deviceSwitchCooldown ?? null,
      },
    });
  } catch (error) {
    // 网络错误，尝试离线模式
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.warn(`Online verification failed: ${errorMsg}`);

    if (canUseOffline(moduleConfig.offlineGracePeriodHours)) {
      const cache = getOfflineCache();
      if (cache) {
        log.info("Using offline mode");
        const offlineResponse = createOfflineResponse(cache);

        return createResult({
          canProceed: true,
          valid: true,
          offlineMode: true,
          nextCheckAfterHours: cache.nextCheckAfterHours,
          response: offlineResponse,
          clientState: {
            checking: false,
            valid: true,
            offlineMode: true,
            error: null,
            errorCode: null,
            license: offlineResponse.license,
            device: offlineResponse.device,
            renewalReminder: null,
            forceUpdate: null,
            pendingNotifications: [],
            lastVerifiedAt: cache.verifyTime,
            deviceSwitchInfo: null,
            deviceSwitchCooldown: null,
          },
        });
      }
    }

    // 无法离线使用
    log.error(`License verification failed and offline mode unavailable: ${errorMsg}`);
    return createResult({
      canProceed: false,
      error: `验证服务连接失败: ${errorMsg}`,
      clientState: {
        checking: false,
        valid: false,
        offlineMode: false,
        error: `验证服务连接失败: ${errorMsg}`,
        errorCode: null,
        license: null,
        device: null,
        renewalReminder: null,
        forceUpdate: null,
        pendingNotifications: [],
        lastVerifiedAt: null,
        deviceSwitchInfo: null,
        deviceSwitchCooldown: null,
      },
    });
  }
}

/**
 * 停止授权相关服务
 */
export function stopLicenseServices(): void {
  stopHeartbeat();
  log.info("License services stopped");
}
