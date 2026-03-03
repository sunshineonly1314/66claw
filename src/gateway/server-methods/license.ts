/**
 * Gateway Methods - License
 * License 相关的 Gateway 方法
 */

import {
  loadConfig,
  writeConfigFile,
  withConfigWriteLock,
  type OpenClawCNConfig,
} from "../../config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { getGatewayLicenseState, updateGatewayLicenseState } from "../license-check.js";
import {
  verifyLicense,
  verifyLicenseWithRetry,
  upgradeLicense,
  getDeviceList,
  unbindDevice,
  UnbindError,
  switchDevice,
  DeviceSwitchError,
  acknowledgeNotification,
  saveLicenseCache,
  getShownNotificationIds,
  filterNotificationsToShow,
  startTokenAutoRefresh,
} from "../../license/index.js";
import { enrichLicenseWithSupport } from "../../license/support-qrcode.js";
import { getDeviceId } from "../../license/device-id.js";
import type { GatewayRequestHandlers } from "./types.js";

const log = createSubsystemLogger("gateway:license-methods");

/** 升级请求互斥锁：防止并发升级导致状态竞态 */
let upgradeInProgress = false;

// ============================================================================
// 输入验证
// ============================================================================

/** License key 最大长度 */
const MAX_LICENSE_KEY_LENGTH = 256;

/** License key 最小长度 */
const MIN_LICENSE_KEY_LENGTH = 8;

/** Device ID 最大长度 */
const MAX_DEVICE_ID_LENGTH = 128;

/** License key 允许的字符正则 (字母数字和常用分隔符) */
const LICENSE_KEY_PATTERN = /^[a-zA-Z0-9\-_]+$/;

/** Device ID 允许的字符正则 (字母数字、连字符、下划线) */
const DEVICE_ID_PATTERN = /^[a-zA-Z0-9\-_]+$/;

/**
 * 验证 License key 格式
 */
function validateLicenseKey(key: unknown): { valid: boolean; error?: string } {
  if (!key || typeof key !== "string") {
    return { valid: false, error: "授权码不能为空" };
  }

  const trimmed = key.trim();

  if (trimmed.length < MIN_LICENSE_KEY_LENGTH) {
    return { valid: false, error: `授权码长度不能少于 ${MIN_LICENSE_KEY_LENGTH} 个字符` };
  }

  if (trimmed.length > MAX_LICENSE_KEY_LENGTH) {
    return { valid: false, error: `授权码长度不能超过 ${MAX_LICENSE_KEY_LENGTH} 个字符` };
  }

  if (!LICENSE_KEY_PATTERN.test(trimmed)) {
    return { valid: false, error: "授权码格式不正确，只能包含字母、数字、连字符和下划线" };
  }

  return { valid: true };
}

/**
 * 验证设备 ID 格式
 */
function validateDeviceId(deviceId: unknown): { valid: boolean; error?: string } {
  if (!deviceId || typeof deviceId !== "string") {
    return { valid: false, error: "设备ID不能为空" };
  }

  const trimmed = deviceId.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "设备ID不能为空" };
  }

  if (trimmed.length > MAX_DEVICE_ID_LENGTH) {
    return { valid: false, error: `设备ID长度不能超过 ${MAX_DEVICE_ID_LENGTH} 个字符` };
  }

  if (!DEVICE_ID_PATTERN.test(trimmed)) {
    return { valid: false, error: "设备ID格式不正确" };
  }

  return { valid: true };
}

/**
 * License Gateway 方法处理器
 */
export const licenseHandlers: GatewayRequestHandlers = {
  /**
   * license.status - 获取当前授权状态
   */
  "license.status": async ({ respond }) => {
    const state = getGatewayLicenseState();

    if (!state) {
      // 非 CN 版本，返回默认有效状态
      respond(true, {
        valid: true,
        offlineMode: false,
        error: null,
        errorCode: null,
        license: null,
        device: null,
        renewalReminder: null,
        forceUpdate: null,
        pendingNotifications: [],
        lastVerifiedAt: null,
      });
      return;
    }

    // 注入技术支持二维码（本地静态图片）
    const deviceId = state.device?.deviceId || getDeviceId();
    enrichLicenseWithSupport(state.license, deviceId);

    respond(true, state);
  },

  /**
   * license.activate - 激活授权码
   */
  "license.activate": async ({ params, respond }) => {
    const { key } = params as { key: string };

    // 输入格式验证
    const validation = validateLicenseKey(key);
    if (!validation.valid) {
      log.warn(`License activation rejected: ${validation.error}`);
      respond(true, {
        valid: false,
        errorMessage: validation.error,
      });
      return;
    }

    const sanitizedKey = key.trim();
    log.info(`Activating license: ${sanitizedKey.substring(0, 10)}...`);

    try {
      const shownNotificationIds = getShownNotificationIds();
      // 使用带重试的验证，提高网络不稳定时的成功率
      const response = await verifyLicenseWithRetry(sanitizedKey, {
        shownNotificationIds,
        maxRetries: 3,
      });

      if (response.valid) {
        // FIX: Use shared config write lock to prevent concurrent read-modify-write races
        await withConfigWriteLock(async () => {
          const config = loadConfig();
          const nextConfig = {
            ...config,
            license: {
              ...config.license,
              key: sanitizedKey,
              status: response.license?.tier ?? "basic",
              expiresAt: response.license?.expiresAt ?? undefined,
              validatedAt: new Date().toISOString(),
              tier: response.license?.tier,
              tierName: response.license?.tierName,
              daysRemaining: response.license?.daysRemaining,
              keyType: response.license?.keyType,
              features: response.license?.features,
              addons: response.license?.addons ?? [],
              upgradeAvailable: response.license?.upgradeAvailable ?? null,
              deviceId: response.device?.deviceId,
              deviceLimit: response.device?.deviceLimit,
              boundDevices: response.device?.boundDevices,
            },
          };
          await writeConfigFile(nextConfig as OpenClawCNConfig);
        });

        // 保存缓存（用于离线模式）
        saveLicenseCache(sanitizedKey, response);

        // 更新全局状态
        const pendingNotifications = filterNotificationsToShow(response.notifications);
        updateGatewayLicenseState({
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
        });

        // 【临时禁用】Token 端点暂未在后端实现，暂时跳过令牌刷新
        // 授权验证已通过 /verify 接口完成，无需额外的 token 端点
        // TODO: 待后端添加 /token 端点后，再启用以下代码
        /*
        startTokenAutoRefresh(sanitizedKey, {
          intervalMs: 30 * 60 * 1000, // 30 分钟检查一次
          onInvalid: () => {
            log.warn("Token became invalid, license features may be restricted");
            const currentState = getGatewayLicenseState();
            if (currentState) {
              updateGatewayLicenseState({
                ...currentState,
                valid: false,
                error: "令牌已失效，请检查网络连接",
              });
            }
          },
        });
        */
        log.debug("License activated (token auto-refresh disabled temporarily)");

        // 注入技术支持二维码（本地静态图片）
        const activatedDeviceId = response.device?.deviceId || getDeviceId();
        enrichLicenseWithSupport(response.license, activatedDeviceId);

        log.info("License activated successfully");
        respond(true, {
          valid: true,
          license: response.license,
          device: response.device,
          renewalReminder: response.renewalReminder,
          forceUpdate: response.forceUpdate,
          pendingNotifications,
        });
        return;
      }

      // 验证失败
      log.warn(
        `License activation failed: ${response.errorMessage} (errorCode: ${response.errorCode})`,
      );
      respond(true, {
        valid: false,
        errorCode: response.errorCode,
        errorMessage: response.errorMessage,
        renewalReminder: response.renewalReminder,
        // 返回设备信息用于单设备模式弹窗（1010/1011 错误码）
        device: response.device,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`License activation error: ${errorMsg}`);
      respond(true, {
        valid: false,
        errorMessage: `激活失败: ${errorMsg}`,
      });
    }
  },

  /**
   * license.upgrade - 升级/扩展包激活
   *
   * 统一入口：版本升级码（upg-*）和扩展包码（skill-*）都走此方法。
   * 需要当前已有有效的主激活码（currentKey 从 config 读取）。
   */
  "license.upgrade": async ({ params, respond }) => {
    // 并发保护：同一时间只允许一个升级请求
    if (upgradeInProgress) {
      respond(true, {
        success: false,
        errorMessage: "升级操作正在进行中，请稍候",
      });
      return;
    }
    upgradeInProgress = true;

    try {
      const { upgradeKey } = params as { upgradeKey: string };

      // 验证升级码格式
      const validation = validateLicenseKey(upgradeKey);
      if (!validation.valid) {
        log.warn(`License upgrade rejected: ${validation.error}`);
        respond(true, {
          success: false,
          errorMessage: validation.error,
        });
        return;
      }

      const sanitizedUpgradeKey = upgradeKey.trim();

      // 读取当前主激活码
      const config = loadConfig();
      const currentKey = config.license?.key;

      if (!currentKey) {
        log.warn("License upgrade failed: no current license key");
        respond(true, {
          success: false,
          errorCode: 2003,
          errorMessage: "请先激活主授权码",
        });
        return;
      }

      log.info(`Upgrading license: ${sanitizedUpgradeKey.substring(0, 10)}...`);

      try {
        const response = await upgradeLicense(currentKey, sanitizedUpgradeKey);

        if (response.success) {
          // 更新配置文件
          await withConfigWriteLock(async () => {
            const freshConfig = loadConfig();
            const nextConfig = {
              ...freshConfig,
              license: {
                ...freshConfig.license,
                status: response.license?.tier ?? freshConfig.license?.status,
                tier: response.license?.tier ?? freshConfig.license?.tier,
                tierName: response.license?.tierName ?? freshConfig.license?.tierName,
                expiresAt: response.license?.expiresAt ?? freshConfig.license?.expiresAt,
                features: response.license?.features ?? freshConfig.license?.features,
                addons: response.license?.addons ?? freshConfig.license?.addons,
                upgradeAvailable: response.license?.upgradeAvailable ?? null,
                validatedAt: new Date().toISOString(),
              },
            };
            await writeConfigFile(nextConfig as OpenClawCNConfig);
          });

          // 重新调 verify 刷新完整状态（含签名、设备信息等）
          try {
            const shownNotificationIds = getShownNotificationIds();
            const verifyResponse = await verifyLicenseWithRetry(currentKey, {
              shownNotificationIds,
              maxRetries: 2,
            });

            if (verifyResponse.valid) {
              saveLicenseCache(currentKey, verifyResponse);
              const pendingNotifications = filterNotificationsToShow(verifyResponse.notifications);
              updateGatewayLicenseState({
                checking: false,
                valid: true,
                offlineMode: false,
                error: null,
                errorCode: null,
                license: verifyResponse.license,
                device: verifyResponse.device,
                renewalReminder: verifyResponse.renewalReminder,
                forceUpdate: verifyResponse.forceUpdate,
                pendingNotifications,
                lastVerifiedAt: Date.now(),
                deviceSwitchInfo: null,
                deviceSwitchCooldown: null,
              });

              // 注入技术支持二维码
              const deviceId = verifyResponse.device?.deviceId || getDeviceId();
              enrichLicenseWithSupport(verifyResponse.license, deviceId);
            }
          } catch (refreshError) {
            // verify 刷新失败不影响升级结果，仅记录日志
            log.warn(`Post-upgrade verify refresh failed: ${refreshError}`);
          }

          log.info(
            `License upgrade successful: ${response.upgradeType} → ${response.toTier ?? "addon"}`,
          );
          respond(true, {
            success: true,
            upgradeType: response.upgradeType,
            fromTier: response.fromTier,
            toTier: response.toTier,
            message: response.message,
            license: response.license,
          });
          return;
        }

        // 升级失败
        log.warn(
          `License upgrade failed: ${response.errorMessage} (errorCode: ${response.errorCode})`,
        );
        respond(true, {
          success: false,
          errorCode: response.errorCode,
          errorMessage: response.errorMessage,
          expiredAt: response.expiredAt,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        log.error(`License upgrade error: ${errorMsg}`);
        respond(true, {
          success: false,
          errorMessage: `升级失败: ${errorMsg}`,
        });
      }
    } finally {
      upgradeInProgress = false;
    }
  },

  /**
   * license.devices - 获取绑定的设备列表
   */
  "license.devices": async ({ respond }) => {
    const config = loadConfig();
    const key = config.license?.key;

    if (!key) {
      respond(true, {
        devices: [],
        deviceLimit: 0,
        boundCount: 0,
      });
      return;
    }

    try {
      const result = await getDeviceList(key);
      respond(true, result);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Failed to get device list: ${errorMsg}`);
      respond(true, {
        devices: [],
        deviceLimit: 0,
        boundCount: 0,
        error: errorMsg,
      });
    }
  },

  /**
   * license.unbind - 解绑设备
   */
  "license.unbind": async ({ params, respond }) => {
    const { deviceId } = params as { deviceId: string };
    const config = loadConfig();
    const key = config.license?.key;

    if (!key) {
      respond(true, { success: false, error: "未找到授权码" });
      return;
    }

    // 输入格式验证
    const validation = validateDeviceId(deviceId);
    if (!validation.valid) {
      log.warn(`Device unbind rejected: ${validation.error}`);
      respond(true, { success: false, error: validation.error });
      return;
    }

    const sanitizedDeviceId = deviceId.trim();

    try {
      await unbindDevice(key, sanitizedDeviceId);
      log.info(`Device unbound: ${sanitizedDeviceId.substring(0, 8)}...`);
      respond(true, { success: true });
    } catch (error) {
      // 处理解绑特定错误（如冷却中）
      if (error instanceof UnbindError) {
        log.warn(`Device unbind failed: ${error.message} (code: ${error.errorCode})`);
        respond(true, {
          success: false,
          error: error.message,
          errorCode: error.errorCode,
          cooldownRemainingHours: error.cooldownRemainingHours,
          cooldownEndsAt: error.cooldownEndsAt,
        });
        return;
      }

      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Failed to unbind device: ${errorMsg}`);
      respond(true, { success: false, error: errorMsg });
    }
  },

  /**
   * license.switch - 确认设备切换（单设备模式）
   */
  "license.switch": async ({ respond }) => {
    const config = loadConfig();
    const key = config.license?.key;

    if (!key) {
      respond(true, { success: false, error: "未找到授权码" });
      return;
    }

    try {
      const result = await switchDevice(key);

      if (result.valid) {
        // FIX: Use shared config write lock to prevent concurrent read-modify-write races
        await withConfigWriteLock(async () => {
          // Re-read config inside lock to get latest state
          const freshConfig = loadConfig();
          const nextConfig = {
            ...freshConfig,
            license: {
              ...freshConfig.license,
              status: result.license?.tier ?? "basic",
              expiresAt: result.license?.expiresAt ?? undefined,
              validatedAt: new Date().toISOString(),
              tier: result.license?.tier,
              tierName: result.license?.tierName,
              daysRemaining: result.license?.daysRemaining,
              keyType: result.license?.keyType,
              features: result.license?.features,
              addons: result.license?.addons ?? [],
              upgradeAvailable: result.license?.upgradeAvailable ?? null,
              deviceId: result.device?.deviceId,
              deviceLimit: result.device?.deviceLimit,
              boundDevices: result.device?.boundDevices,
            },
          };
          await writeConfigFile(nextConfig as OpenClawCNConfig);
        });

        // 更新全局状态
        updateGatewayLicenseState({
          checking: false,
          valid: true,
          offlineMode: false,
          error: null,
          errorCode: null,
          license: result.license ?? null,
          device: result.device ?? null,
          renewalReminder: null,
          forceUpdate: null,
          pendingNotifications: [],
          lastVerifiedAt: Date.now(),
          deviceSwitchInfo: null,
          deviceSwitchCooldown: null,
        });

        // 注入技术支持二维码和购买链接
        const switchedDeviceId = result.device?.deviceId || getDeviceId();
        enrichLicenseWithSupport(result.license, switchedDeviceId);

        log.info("Device switch successful");
        respond(true, {
          valid: true,
          license: result.license,
          device: result.device,
        });
        return;
      }

      // 业务失败
      respond(true, {
        valid: false,
        error: result.errorMessage,
        errorCode: result.errorCode,
        cooldownRemainingHours: result.cooldownRemainingHours,
        cooldownEndsAt: result.cooldownEndsAt,
      });
    } catch (error) {
      // 处理设备切换特定错误（如冷却中）
      if (error instanceof DeviceSwitchError) {
        log.warn(`Device switch failed: ${error.message} (code: ${error.errorCode})`);
        respond(true, {
          valid: false,
          error: error.message,
          errorCode: error.errorCode,
          cooldownRemainingHours: error.cooldownRemainingHours,
          cooldownEndsAt: error.cooldownEndsAt,
        });
        return;
      }

      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Failed to switch device: ${errorMsg}`);
      respond(true, { valid: false, error: errorMsg });
    }
  },

  /**
   * license.notification.ack - 确认通知
   */
  "license.notification.ack": async ({ params, respond }) => {
    const { notificationId, action } = params as {
      notificationId: number;
      action: "clicked" | "dismissed" | "closed";
    };

    const config = loadConfig();
    const key = config.license?.key;

    if (!key || !notificationId) {
      respond(true, { success: false });
      return;
    }

    try {
      await acknowledgeNotification(key, notificationId, action);
      respond(true, { success: true });
    } catch (error) {
      log.error(`Failed to ack notification: ${error}`);
      respond(true, { success: false });
    }
  },
};

/**
 * 注册 License Gateway 方法
 */
export function registerLicenseMethods(): GatewayRequestHandlers {
  return licenseHandlers;
}
