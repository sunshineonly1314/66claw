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
} from "./types.js";
import { DEFAULT_LICENSE_STATE } from "./types.js";

/**
 * License 控制器接口
 */
export interface LicenseController {
  /** 获取当前状态 */
  getState(): LicenseUiState;
  /** 刷新 License 状态 */
  refresh(): Promise<void>;
  /** 激活授权码 */
  activate(key: string): Promise<boolean>;
  /** 获取设备列表 */
  getDevices(): Promise<BoundDevice[]>;
  /** 解绑设备 */
  unbindDevice(deviceId: string): Promise<boolean>;
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
            license: data.license as LicenseUiState["license"] ?? null,
            device: data.device as LicenseUiState["device"] ?? null,
            lastVerifiedAt: Date.now(),
          });
          return true;
        } else {
          updateState({
            checking: false,
            valid: false,
            error: data.errorMessage as string ?? "激活失败",
            errorCode: data.errorCode as number | null ?? null,
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

  const unbindDevice = async (deviceId: string): Promise<boolean> => {
    if (!client) return false;

    try {
      await client.request("license.unbind", { deviceId });
      // 刷新状态
      await refresh();
      return true;
    } catch (error) {
      console.error("Failed to unbind device:", error);
      return false;
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
    getDevices,
    unbindDevice,
    acknowledgeNotification,
    getNextNotification,
    markNotificationShown,
  };
}

/**
 * 判断是否需要显示弹窗
 */
export function shouldShowLicenseDialog(state: LicenseUiState): LicenseDialogType | null {
  // 强制更新优先级最高
  if (state.forceUpdate?.required && state.forceUpdate.blocking) {
    return "force-update";
  }

  // 授权无效
  if (!state.valid && state.error) {
    if (state.errorCode === 1004) {
      return "device-limit";
    }
    if (state.errorCode === 1002) {
      return "expired";
    }
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
