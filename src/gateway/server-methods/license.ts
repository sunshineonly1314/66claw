/**
 * Gateway Methods - License
 * License 相关的 Gateway 方法
 */

import { loadConfig, writeConfigFile } from "../../config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import {
  getGatewayLicenseState,
  updateGatewayLicenseState,
} from "../license-check.js";
import {
  verifyLicense,
  getDeviceList,
  unbindDevice,
  acknowledgeNotification,
  saveLicenseCache,
  getShownNotificationIds,
  filterNotificationsToShow,
} from "../../license/index.js";
import type { GatewayRequestHandlers } from "./types.js";

const log = createSubsystemLogger("gateway:license-methods");

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

    respond(true, state);
  },

  /**
   * license.activate - 激活授权码
   */
  "license.activate": async ({ params, respond }) => {
    const { key } = params as { key: string };

    if (!key || typeof key !== "string") {
      respond(true, {
        valid: false,
        errorMessage: "授权码不能为空",
      });
      return;
    }

    log.info(`Activating license: ${key.substring(0, 10)}...`);

    try {
      const shownNotificationIds = getShownNotificationIds();
      const response = await verifyLicense(key, { shownNotificationIds });

      if (response.valid) {
        // 保存到配置
        const config = loadConfig();
        const nextConfig = {
          ...config,
          license: {
            ...config.license,
            key,
            status: response.license?.tier ?? "basic",
            expiresAt: response.license?.expiresAt ?? undefined,
            validatedAt: new Date().toISOString(),
            tier: response.license?.tier,
            tierName: response.license?.tierName,
            daysRemaining: response.license?.daysRemaining,
            keyType: response.license?.keyType,
            features: response.license?.features,
            deviceId: response.device?.deviceId,
            deviceLimit: response.device?.deviceLimit,
            boundDevices: response.device?.boundDevices,
          },
        };
        await writeConfigFile(nextConfig);

        // 保存缓存（用于离线模式）
        saveLicenseCache(key, response);

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
        });

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
      log.warn(`License activation failed: ${response.errorMessage}`);
      respond(true, {
        valid: false,
        errorCode: response.errorCode,
        errorMessage: response.errorMessage,
        renewalReminder: response.renewalReminder,
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

    if (!deviceId) {
      respond(true, { success: false, error: "设备ID不能为空" });
      return;
    }

    try {
      await unbindDevice(key, deviceId);
      log.info(`Device unbound: ${deviceId.substring(0, 8)}...`);
      respond(true, { success: true });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Failed to unbind device: ${errorMsg}`);
      respond(true, { success: false, error: errorMsg });
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
