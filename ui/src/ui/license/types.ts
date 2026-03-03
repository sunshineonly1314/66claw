/**
 * Clawdbot License UI - Type Definitions
 * 授权验证 UI 类型定义
 */

/**
 * 技术支持群二维码配置（服务端返回）
 */
export interface SupportQrcodeConfig {
  /** 二维码图片 base64 data URL */
  base64: string;
  /** 群名称 */
  groupName: string;
}

/**
 * License 信息
 */
export interface LicenseInfo {
  tier: "basic" | "pro" | "test" | "trial";
  tierName: string;
  expiresAt: string;
  daysRemaining: number;
  keyType: "test" | "trial" | "standard";
  features: string[];
  /** 已激活的扩展包列表（始终为数组） */
  addons: AddonInfo[];
  /** 当前版本可升级的信息 */
  upgradeAvailable?: UpgradeAvailableInfo | null;
  /** 技术支持群二维码（服务端根据用户类型 + 设备 hash 返回） */
  supportQrcode?: SupportQrcodeConfig;
  /** 闲鱼购买链接（仅 test 用户返回） */
  purchaseUrl?: string;
}

/**
 * 扩展包信息
 */
export interface AddonInfo {
  /** 扩展包类型 */
  type: string;
  /** 扩展包名称 */
  name: string;
  /** 过期时间 (ISO 8601) */
  expiresAt: string;
  /** 扩展包包含的功能列表 */
  features: string[];
}

/**
 * 升级可用信息
 */
export interface UpgradeAvailableInfo {
  targetTier: string;
  targetTierName: string;
  upgradePrice: number;
  description: string;
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
  ERROR_UNBIND_COOLDOWN = 1009,
  /** 需要确认设备切换（单设备模式：已有其他设备绑定） */
  ERROR_DEVICE_SWITCH_REQUIRED = 1010,
  /** 设备切换冷却中（单设备模式：24小时内已切换过） */
  ERROR_DEVICE_SWITCH_COOLDOWN = 1011,
}

/**
 * License 升级/扩展包错误码
 */
export enum LicenseUpgradeErrorCode {
  /** 升级码/扩展码不存在或已使用 */
  ERROR_UPGRADE_KEY_INVALID = 2001,
  /** 当前版本不匹配（已是Pro） */
  ERROR_TIER_MISMATCH = 2002,
  /** 主激活码无效或已过期 */
  ERROR_MAIN_KEY_INVALID = 2003,
  /** 升级码/扩展码已过期 */
  ERROR_UPGRADE_KEY_EXPIRED = 2004,
  /** 扩展包重复激活 */
  ERROR_ADDON_DUPLICATE = 2005,
}

/**
 * 升级错误码对应的用户友好消息
 */
export const UPGRADE_ERROR_MESSAGES: Record<LicenseUpgradeErrorCode, string> = {
  [LicenseUpgradeErrorCode.ERROR_UPGRADE_KEY_INVALID]: "激活码无效，请检查输入",
  [LicenseUpgradeErrorCode.ERROR_TIER_MISMATCH]: "您已是高级版，无需升级",
  [LicenseUpgradeErrorCode.ERROR_MAIN_KEY_INVALID]: "请先确保您有有效的激活码",
  [LicenseUpgradeErrorCode.ERROR_UPGRADE_KEY_EXPIRED]: "该激活码已过期，请联系客服",
  [LicenseUpgradeErrorCode.ERROR_ADDON_DUPLICATE]: "该扩展包已激活",
};

/**
 * 设备切换信息（errorCode=1010 时返回）
 */
export interface DeviceSwitchInfo {
  /** 已绑定设备的 ID */
  existingDeviceId: string;
  /** 已绑定设备的名称 */
  existingDeviceName: string;
  /** 已绑定设备的操作系统信息 */
  existingOsInfo?: string;
  /** 设备数量限制 */
  deviceLimit?: number;
  /** 已绑定设备数 */
  boundDevices?: number;
}

/**
 * 设备切换冷却信息（errorCode=1011 时返回）
 */
export interface DeviceSwitchCooldownInfo {
  /** 冷却剩余小时数 */
  cooldownRemainingHours: number;
  /** 冷却结束时间 ISO 字符串 */
  cooldownEndsAt: string;
}

/**
 * 设备解绑结果
 */
export interface UnbindResult {
  success: boolean;
  error?: string;
  errorCode?: LicenseErrorCode;
  /** 冷却剩余小时数（1009 错误时） */
  cooldownRemainingHours?: number;
  /** 冷却结束时间 ISO 字符串（1009 错误时） */
  cooldownEndsAt?: string;
}

/**
 * 升级/扩展包激活结果
 */
export interface UpgradeResult {
  success: boolean;
  upgradeType?: "tier_upgrade" | "addon";
  fromTier?: string;
  toTier?: string;
  message?: string;
  license?: LicenseInfo;
  error?: string;
  errorCode?: LicenseUpgradeErrorCode;
  /** 升级码/扩展码过期时间（errorCode=2004 时） */
  expiredAt?: string;
}

/**
 * 设备切换结果
 * 注意：与 /verify 接口一致，使用 valid 字段判断成功
 */
export interface DeviceSwitchResult {
  valid: boolean;
  error?: string;
  errorCode?: LicenseErrorCode;
  /** 冷却剩余小时数（1011 错误时） */
  cooldownRemainingHours?: number;
  /** 冷却结束时间 ISO 字符串（1011 错误时） */
  cooldownEndsAt?: string;
  /** License 信息（成功时） */
  license?: LicenseInfo;
  /** 设备信息（成功时） */
  device?: DeviceInfo;
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
  /** 设备切换信息（errorCode=1010 时） */
  deviceSwitchInfo: DeviceSwitchInfo | null;
  /** 设备切换冷却信息（errorCode=1011 时） */
  deviceSwitchCooldown: DeviceSwitchCooldownInfo | null;
  /** 最近一次升级结果（用于展示升级成功/失败弹窗） */
  lastUpgradeResult: UpgradeResult | null;
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
  deviceSwitchInfo: null,
  deviceSwitchCooldown: null,
  lastUpgradeResult: null,
};

/**
 * 弹窗类型
 */
export type LicenseDialogType =
  | "activation"           // 激活授权
  | "expired"              // 授权过期
  | "device-limit"         // 设备超限
  | "renewal"              // 续费提醒
  | "notification"         // 通知
  | "force-update"         // 强制更新
  | "device-manage"        // 设备管理
  | "device-switch"        // 设备切换确认（1010）
  | "device-switch-cooldown" // 设备切换冷却（1011）
  | "upgrade-success"      // 升级/扩展包激活成功
  | "upgrade-error";       // 升级/扩展包激活失败
