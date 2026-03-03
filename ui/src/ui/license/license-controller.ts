/**
 * Clawdbot License UI - Controller
 * 授权验证 UI 控制器
 */

import type { GatewayBrowserClient } from "../gateway.js";
import type {
  LicenseUiState,
  LicenseNotification,
  BoundDevice,
  LicenseDialogType,
  UnbindResult,
  DeviceSwitchResult,
  UpgradeResult,
} from "./types.js";
import { DEFAULT_LICENSE_STATE, UPGRADE_ERROR_MESSAGES, LicenseUpgradeErrorCode } from "./types.js";

/**
 * License 控制器接口
 */
export interface LicenseController {
  /** 获取当前状态 */
  getState(): LicenseUiState;
  /** 刷新 License 状态 */
  refresh(): Promise<void>;
  /** 激活授权码（自动根据前缀路由到 verify 或 upgrade） */
  activate(key: string): Promise<boolean>;
  /** 升级/扩展包激活 */
  upgrade(upgradeKey: string): Promise<UpgradeResult>;
  /** 清除升级结果（关闭升级弹窗后调用） */
  clearUpgradeResult(): void;
  /** 获取设备列表 */
  getDevices(): Promise<BoundDevice[]>;
  /** 解绑设备 */
  unbindDevice(deviceId: string): Promise<UnbindResult>;
  /** 确认设备切换（单设备模式） */
  confirmDeviceSwitch(): Promise<DeviceSwitchResult>;
  /** 确认通知 */
  acknowledgeNotification(notificationId: number, action: "clicked" | "dismissed" | "closed"): Promise<void>;
  /** 获取下一个待展示的通知 */
  getNextNotification(): LicenseNotification | null;
  /** 标记通知已展示 */
  markNotificationShown(notificationId: number): void;
}

/**
 * 创建 License 控制器
 */
export function createLicenseController(
  client: GatewayBrowserClient | null,
  onStateChange: (state: LicenseUiState) => void,
): LicenseController {
  let state: LicenseUiState = { ...DEFAULT_LICENSE_STATE };
  const shownNotificationIds = new Set<number>();

  const updateState = (updates: Partial<LicenseUiState>) => {
    state = { ...state, ...updates };
    onStateChange(state);
  };

  const getState = (): LicenseUiState => ({ ...state });

  const refresh = async (): Promise<void> => {
    if (!client) return;

    updateState({ checking: true, error: null });

    try {
      const result = await client.request("license.status", {});
      
      if (result && typeof result === "object") {
        const data = result as Record<string, unknown>;
        updateState({
          checking: false,
          valid: data.valid as boolean ?? true,
          offlineMode: data.offlineMode as boolean ?? false,
          error: data.error as string | null ?? null,
          errorCode: data.errorCode as number | null ?? null,
          license: data.license as LicenseUiState["license"] ?? null,
          device: data.device as LicenseUiState["device"] ?? null,
          renewalReminder: data.renewalReminder as LicenseUiState["renewalReminder"] ?? null,
          forceUpdate: data.forceUpdate as LicenseUiState["forceUpdate"] ?? null,
          pendingNotifications: (data.pendingNotifications as LicenseNotification[]) ?? [],
          lastVerifiedAt: Date.now(),
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      updateState({
        checking: false,
        error: `获取授权状态失败: ${errorMsg}`,
      });
    }
  };

  const activate = async (key: string): Promise<boolean> => {
    if (!client) return false;

    // 前缀路由：upg-* 和 skill-* 走升级流程
    const trimmed = key.trim().toLowerCase();
    if (trimmed.startsWith("upg-") || trimmed.startsWith("skill-")) {
      const result = await upgrade(key);
      return result.success;
    }

    updateState({ checking: true, error: null });

    try {
      const result = await client.request("license.activate", { key });
      
      if (result && typeof result === "object") {
        const data = result as Record<string, unknown>;
        
        if (data.valid) {
          updateState({
            checking: false,
            valid: true,
            error: null,
            errorCode: null,
            license: data.license as LicenseUiState["license"] ?? null,
            device: data.device as LicenseUiState["device"] ?? null,
            deviceSwitchInfo: null,
            deviceSwitchCooldown: null,
            lastVerifiedAt: Date.now(),
          });
          return true;
        } else {
          // 从 device 中提取设备切换信息（1010/1011 错误码）
          const device = data.device as Record<string, unknown> | null;
          const errorCode = (data.errorCode as number | null) ?? null;
          
          let deviceSwitchInfo: LicenseUiState["deviceSwitchInfo"] = null;
          let deviceSwitchCooldown: LicenseUiState["deviceSwitchCooldown"] = null;
          
          if (device && errorCode === 1010 && device.existingDeviceName) {
            deviceSwitchInfo = {
              existingDeviceId: (device.existingDeviceId as string) ?? "",
              existingDeviceName: (device.existingDeviceName as string) ?? "未知设备",
              existingOsInfo: device.existingOsInfo as string | undefined,
              deviceLimit: device.deviceLimit as number | undefined,
              boundDevices: device.boundDevices as number | undefined,
            };
          }
          
          if (device && errorCode === 1011 && device.cooldownRemainingHours !== undefined) {
            deviceSwitchCooldown = {
              cooldownRemainingHours: (device.cooldownRemainingHours as number) ?? 24,
              cooldownEndsAt: (device.cooldownEndsAt as string) ?? "",
            };
          }
          
          updateState({
            checking: false,
            valid: false,
            error: data.errorMessage as string ?? "激活失败",
            errorCode,
            deviceSwitchInfo,
            deviceSwitchCooldown,
          });
          return false;
        }
      }
      
      return false;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      updateState({
        checking: false,
        error: `激活失败: ${errorMsg}`,
      });
      return false;
    }
  };

  const upgrade = async (upgradeKey: string): Promise<UpgradeResult> => {
    if (!client) {
      return { success: false, error: "客户端未连接" };
    }

    // 检查是否有已激活的主授权码
    if (!state.license) {
      const noKeyResult: UpgradeResult = {
        success: false,
        errorCode: LicenseUpgradeErrorCode.ERROR_MAIN_KEY_INVALID,
        error: "请先激活主授权码",
      };
      updateState({ lastUpgradeResult: noKeyResult });
      return noKeyResult;
    }

    // 离线模式下无法升级
    if (state.offlineMode) {
      const offlineResult: UpgradeResult = {
        success: false,
        error: "当前处于离线模式，升级需要网络连接。请连接网络后重试。",
      };
      updateState({ lastUpgradeResult: offlineResult });
      return offlineResult;
    }

    updateState({ checking: true, error: null });

    try {
      const result = await client.request("license.upgrade", { upgradeKey: upgradeKey.trim() });

      if (result && typeof result === "object") {
        const data = result as Record<string, unknown>;

        if (data.success) {
          const upgradeResult: UpgradeResult = {
            success: true,
            upgradeType: data.upgradeType as UpgradeResult["upgradeType"],
            fromTier: data.fromTier as string | undefined,
            toTier: data.toTier as string | undefined,
            message: data.message as string | undefined,
            license: data.license as UpgradeResult["license"],
          };

          // 刷新状态获取最新数据
          updateState({
            checking: false,
            lastUpgradeResult: upgradeResult,
          });
          await refresh();

          return upgradeResult;
        }

        // 升级失败
        const errorResult: UpgradeResult = {
          success: false,
          errorCode: data.errorCode as LicenseUpgradeErrorCode | undefined,
          error: (data.errorMessage as string) ??
            UPGRADE_ERROR_MESSAGES[data.errorCode as LicenseUpgradeErrorCode] ??
            "升级失败",
          expiredAt: data.expiredAt as string | undefined,
        };

        updateState({
          checking: false,
          lastUpgradeResult: errorResult,
        });
        return errorResult;
      }

      return { success: false, error: "升级失败：无效响应" };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorResult: UpgradeResult = {
        success: false,
        error: `升级失败: ${errorMsg}`,
      };
      updateState({
        checking: false,
        lastUpgradeResult: errorResult,
      });
      return errorResult;
    }
  };

  const clearUpgradeResult = (): void => {
    updateState({ lastUpgradeResult: null });
  };

  const getDevices = async (): Promise<BoundDevice[]> => {
    if (!client) return [];

    try {
      const result = await client.request("license.devices", {});
      
      if (result && typeof result === "object") {
        const data = result as Record<string, unknown>;
        return (data.devices as BoundDevice[]) ?? [];
      }
      
      return [];
    } catch (error) {
      console.error("Failed to get devices:", error);
      return [];
    }
  };

  const unbindDevice = async (deviceId: string): Promise<UnbindResult> => {
    if (!client) {
      return { success: false, error: "客户端未连接" };
    }

    try {
      const result = await client.request("license.unbind", { deviceId }) as UnbindResult;

      if (result.success) {
        // 刷新状态
        await refresh();
      }

      return result;
    } catch (error) {
      console.error("Failed to unbind device:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "解绑失败",
      };
    }
  };

  const confirmDeviceSwitch = async (): Promise<DeviceSwitchResult> => {
    if (!client) {
      return { valid: false, error: "客户端未连接" };
    }

    try {
      const result = await client.request("license.switch", {}) as DeviceSwitchResult;

      if (result.valid) {
        // 切换成功，更新状态
        updateState({
          valid: true,
          error: null,
          errorCode: null,
          license: result.license ?? null,
          device: result.device ?? null,
          deviceSwitchInfo: null,
          deviceSwitchCooldown: null,
          lastVerifiedAt: Date.now(),
        });
      }

      return result;
    } catch (error) {
      console.error("Failed to switch device:", error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : "设备切换失败",
      };
    }
  };

  const acknowledgeNotification = async (
    notificationId: number,
    action: "clicked" | "dismissed" | "closed",
  ): Promise<void> => {
    if (!client) return;

    try {
      await client.request("license.notification.ack", { notificationId, action });
    } catch (error) {
      console.error("Failed to acknowledge notification:", error);
    }
  };

  const getNextNotification = (): LicenseNotification | null => {
    const pending = state.pendingNotifications.filter(
      (n) => !shownNotificationIds.has(n.id),
    );
    return pending.length > 0 ? pending[0] : null;
  };

  const markNotificationShown = (notificationId: number): void => {
    shownNotificationIds.add(notificationId);
  };

  return {
    getState,
    refresh,
    activate,
    upgrade,
    clearUpgradeResult,
    getDevices,
    unbindDevice,
    confirmDeviceSwitch,
    acknowledgeNotification,
    getNextNotification,
    markNotificationShown,
  };
}

/**
 * 判断是否需要显示弹窗
 */
export function shouldShowLicenseDialog(state: LicenseUiState): LicenseDialogType | null {
  // 升级结果弹窗（最高优先级，用户刚操作完）
  if (state.lastUpgradeResult) {
    return state.lastUpgradeResult.success ? "upgrade-success" : "upgrade-error";
  }

  // 强制更新优先级最高
  if (state.forceUpdate?.required && state.forceUpdate.blocking) {
    return "force-update";
  }

  // 授权无效
  if (!state.valid && state.error) {
    // 设备切换确认（单设备模式：1010）
    if (state.errorCode === 1010) {
      return "device-switch";
    }
    // 设备切换冷却中（单设备模式：1011）
    if (state.errorCode === 1011) {
      return "device-switch-cooldown";
    }
    // 设备数超限
    if (state.errorCode === 1004) {
      return "device-limit";
    }
    // 授权过期
    if (state.errorCode === 1002) {
      return "expired";
    }
    // 未激活
    if (!state.license) {
      return "activation";
    }
  }

  // 续费提醒
  if (state.renewalReminder?.show && state.renewalReminder.urgency === "critical") {
    return "renewal";
  }

  // 待展示的通知
  if (state.pendingNotifications.length > 0) {
    return "notification";
  }

  return null;
}

/**
 * 获取离线剩余时间（小时）
 */
export function getOfflineRemainingHours(state: LicenseUiState): number {
  if (!state.offlineMode || !state.lastVerifiedAt) {
    return 0;
  }

  const GRACE_PERIOD_HOURS = 72;
  const hoursSinceVerify = (Date.now() - state.lastVerifiedAt) / (1000 * 60 * 60);
  return Math.max(0, GRACE_PERIOD_HOURS - hoursSinceVerify);
}
