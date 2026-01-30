/**
 * Clawdbot License UI - Type Definitions
 * 授权验证 UI 类型定义
 */

/**
 * License 信息
 */
export interface LicenseInfo {
  tier: "basic" | "test";
  tierName: string;
  expiresAt: string;
  daysRemaining: number;
  keyType: "test" | "trial" | "standard";
  features: string[];
}

/**
 * 设备信息
 */
export interface DeviceInfo {
  deviceId: string;
  deviceLimit: number;
  boundDevices: number;
  isCurrentBound: boolean;
}

/**
 * 绑定的设备详情
 */
export interface BoundDevice {
  deviceId: string;
  deviceName: string;
  osInfo: string;
  firstBindAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

/**
 * 通知信息
 */
export interface LicenseNotification {
  id: number;
  type: "new_feature" | "announcement" | "upgrade" | "maintenance" | "force_update";
  title: string;
  content: string;
  displayStyle: "dialog" | "banner" | "toast";
  priority: number;
  action?: {
    text: string;
    url: string;
    type: "url" | "close";
  };
  showOnce: boolean;
  validUntil?: string;
}

/**
 * 续费提醒
 */
export interface RenewalReminder {
  show: boolean;
  urgency: "info" | "warning" | "critical" | null;
  title: string | null;
  message: string | null;
  renewUrl: string | null;
  daysRemaining: number;
}

/**
 * 强制更新信息
 */
export interface ForceUpdateInfo {
  required: boolean;
  minVersion: string;
  latestVersion: string;
  downloadUrl: string;
  updateMessage: string;
  blocking: boolean;
}

/**
 * License 错误码
 */
export enum LicenseErrorCode {
  ERROR_KEY_NOT_FOUND = 1001,
  ERROR_KEY_EXPIRED = 1002,
  ERROR_KEY_REVOKED = 1003,
  ERROR_DEVICE_LIMIT = 1004,
  ERROR_KEY_BINDBY_OTHER = 1005,
  ERROR_INVALID_SIGN = 1006,
  ERROR_TIMESTAMP_EXPIRED = 1007,
  ERROR_KEY_EXHAUSTED = 1008,
}

/**
 * UI 层的 License 状态
 */
export interface LicenseUiState {
  /** 是否正在检查 */
  checking: boolean;
  /** 授权是否有效 */
  valid: boolean;
  /** 是否离线模式 */
  offlineMode: boolean;
  /** 错误信息 */
  error: string | null;
  /** 错误码 */
  errorCode: LicenseErrorCode | null;
  /** License 信息 */
  license: LicenseInfo | null;
  /** 设备信息 */
  device: DeviceInfo | null;
  /** 续费提醒 */
  renewalReminder: RenewalReminder | null;
  /** 强制更新信息 */
  forceUpdate: ForceUpdateInfo | null;
  /** 待展示的通知 */
  pendingNotifications: LicenseNotification[];
  /** 最后验证时间 */
  lastVerifiedAt: number | null;
}

/**
 * 默认 License 状态
 */
export const DEFAULT_LICENSE_STATE: LicenseUiState = {
  checking: false,
  valid: true, // 默认有效（非 CN 版本）
  offlineMode: false,
  error: null,
  errorCode: null,
  license: null,
  device: null,
  renewalReminder: null,
  forceUpdate: null,
  pendingNotifications: [],
  lastVerifiedAt: null,
};

/**
 * 弹窗类型
 */
export type LicenseDialogType =
  | "activation"      // 激活授权
  | "expired"         // 授权过期
  | "device-limit"    // 设备超限
  | "renewal"         // 续费提醒
  | "notification"    // 通知
  | "force-update"    // 强制更新
  | "device-manage";  // 设备管理
