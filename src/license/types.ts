/**
 * Clawdbot License Module - Type Definitions
 * 授权验证模块类型定义
 *
 * Based on Tecbinai API v2.0 specification
 * @see CLIENT_INTEGRATION_GUIDE.md
 */

// ============================================================================
// API 请求类型
// ============================================================================

/**
 * 授权验证请求参数
 */
export interface LicenseVerifyRequest {
  /** 授权码 (必填) */
  key: string;
  /** 设备唯一标识 (必填) */
  deviceId: string;
  /** 设备名称 (可选) */
  deviceName?: string;
  /** 客户端版本号 (推荐) */
  appVersion?: string;
  /** 操作系统信息 (可选) */
  osInfo?: string;
  /** 已展示的通知ID列表 (可选) */
  shownNotificationIds?: number[];
  /** 请求时间戳(毫秒) - 签名参数 */
  timestamp?: number;
  /** 随机字符串(16位) - 签名参数 */
  nonce?: string;
  /** 请求签名 - 签名参数 */
  sign?: string;
}

/**
 * 心跳请求参数
 */
export interface LicenseHeartbeatRequest {
  key: string;
  deviceId: string;
}

/**
 * 设备解绑请求参数
 */
export interface DeviceUnbindRequest {
  key: string;
  deviceId: string;
}

/**
 * 通知确认请求参数
 */
export interface NotificationAckRequest {
  key: string;
  deviceId: string;
  notificationId: number;
  action: "clicked" | "dismissed" | "closed";
}

// ============================================================================
// API 响应类型
// ============================================================================

/**
 * 通用 API 响应结构
 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * License 信息
 */
export interface LicenseInfo {
  /** 产品等级: basic | test */
  tier: "basic" | "test";
  /** 等级名称 */
  tierName: string;
  /** 过期时间 (ISO 8601) */
  expiresAt: string;
  /** 剩余天数 */
  daysRemaining: number;
  /** Key 类型: test | trial | standard */
  keyType: "test" | "trial" | "standard";
  /** 功能特性列表 */
  features: string[];
}

/**
 * 设备绑定信息
 */
export interface DeviceInfo {
  /** 当前设备ID */
  deviceId: string;
  /** 设备绑定上限 */
  deviceLimit: number;
  /** 已绑定设备数 */
  boundDevices: number;
  /** 当前设备是否已绑定 */
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
  /** 通知ID */
  id: number;
  /** 通知类型 */
  type: "new_feature" | "announcement" | "upgrade" | "maintenance" | "force_update";
  /** 标题 */
  title: string;
  /** 内容 */
  content: string;
  /** 展示样式 */
  displayStyle: "dialog" | "banner" | "toast";
  /** 优先级 (数字越大越优先) */
  priority: number;
  /** 操作按钮配置 */
  action?: {
    text: string;
    url: string;
    type: "url" | "close";
  };
  /** 是否只展示一次 */
  showOnce: boolean;
  /** 有效期截止时间 (ISO 8601) */
  validUntil?: string;
}

/**
 * 续费提醒
 */
export interface RenewalReminder {
  /** 是否需要展示 */
  show: boolean;
  /** 紧急程度 */
  urgency: "info" | "warning" | "critical" | null;
  /** 标题 */
  title: string | null;
  /** 消息内容 */
  message: string | null;
  /** 续费链接 */
  renewUrl: string | null;
  /** 剩余天数 */
  daysRemaining: number;
}

/**
 * 强制更新信息
 */
export interface ForceUpdateInfo {
  /** 是否需要强制更新 */
  required: boolean;
  /** 最低版本要求 */
  minVersion: string;
  /** 最新版本 */
  latestVersion: string;
  /** 下载链接 */
  downloadUrl: string;
  /** 更新说明 */
  updateMessage: string;
  /** 是否阻止使用 */
  blocking: boolean;
}

/**
 * 授权验证响应数据
 */
export interface LicenseVerifyResponseData {
  /** 是否有效 */
  valid: boolean;
  /** 业务错误码 */
  errorCode: LicenseErrorCode | null;
  /** 错误消息 */
  errorMessage: string | null;
  /** 服务器时间 (毫秒时间戳) */
  serverTime: number;
  /** 下次检查间隔(小时) */
  nextCheckAfterHours?: number;
  /** License 信息 (验证成功时) */
  license: LicenseInfo | null;
  /** 设备信息 (验证成功时) */
  device: DeviceInfo | null;
  /** 通知列表 */
  notifications: LicenseNotification[] | null;
  /** 续费提醒 */
  renewalReminder: RenewalReminder | null;
  /** 强制更新信息 */
  forceUpdate: ForceUpdateInfo | null;
}

/**
 * 心跳响应数据
 */
export interface LicenseHeartbeatResponseData {
  valid: boolean;
  daysRemaining: number;
  serverTime: number;
}

/**
 * 设备列表响应数据
 */
export interface DeviceListResponseData {
  deviceLimit: number;
  boundCount: number;
  devices: BoundDevice[];
}

/**
 * 健康检查响应数据
 */
export interface HealthCheckResponseData {
  status: "ok" | "error";
  timestamp: number;
  version: string;
}

// ============================================================================
// 业务错误码
// ============================================================================

/**
 * License 业务错误码
 */
export enum LicenseErrorCode {
  /** 授权码不存在 */
  ERROR_KEY_NOT_FOUND = 1001,
  /** 授权码已过期 */
  ERROR_KEY_EXPIRED = 1002,
  /** 授权码已撤销 */
  ERROR_KEY_REVOKED = 1003,
  /** 设备数超限 */
  ERROR_DEVICE_LIMIT = 1004,
  /** 已被他人使用 */
  ERROR_KEY_BINDBY_OTHER = 1005,
  /** 签名验证失败 */
  ERROR_INVALID_SIGN = 1006,
  /** 时间戳过期 */
  ERROR_TIMESTAMP_EXPIRED = 1007,
  /** 使用次数用尽 */
  ERROR_KEY_EXHAUSTED = 1008,
}

/**
 * 错误码对应的用户友好消息
 */
export const LICENSE_ERROR_MESSAGES: Record<LicenseErrorCode, string> = {
  [LicenseErrorCode.ERROR_KEY_NOT_FOUND]: "授权码不存在，请检查输入",
  [LicenseErrorCode.ERROR_KEY_EXPIRED]: "授权已过期，请续费后继续使用",
  [LicenseErrorCode.ERROR_KEY_REVOKED]: "授权码已被撤销，请联系客服",
  [LicenseErrorCode.ERROR_DEVICE_LIMIT]: "设备数已达上限，请先解绑其他设备",
  [LicenseErrorCode.ERROR_KEY_BINDBY_OTHER]: "授权码已被他人使用，请联系客服",
  [LicenseErrorCode.ERROR_INVALID_SIGN]: "请求签名验证失败，请检查客户端版本",
  [LicenseErrorCode.ERROR_TIMESTAMP_EXPIRED]: "请求时间戳过期，请检查系统时间",
  [LicenseErrorCode.ERROR_KEY_EXHAUSTED]: "授权码使用次数已用尽，请购买新授权",
};

// ============================================================================
// 本地状态类型
// ============================================================================

/**
 * License 本地缓存数据
 */
export interface LicenseCache {
  /** 授权码 */
  key: string;
  /** 是否有效 */
  valid: boolean;
  /** 最后验证时间 (毫秒时间戳) */
  verifyTime: number;
  /** 过期时间 (ISO 8601) */
  expiresAt: string | null;
  /** 产品等级 */
  tier: string | null;
  /** 功能特性列表 */
  features: string[];
  /** 设备ID */
  deviceId: string;
  /** 下次检查间隔(小时) */
  nextCheckAfterHours: number;
}

/**
 * 本地存储的已展示通知记录
 */
export interface ShownNotificationRecord {
  id: number;
  shownAt: number;
}

/**
 * License 客户端状态
 */
export interface LicenseClientState {
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

// ============================================================================
// 配置类型
// ============================================================================

/**
 * License 模块配置
 */
export interface LicenseModuleConfig {
  /** API Base URL */
  apiBaseUrl: string;
  /** 签名密钥 */
  signSecretKey: string;
  /** 离线宽限期(小时) */
  offlineGracePeriodHours: number;
  /** 心跳间隔(小时) */
  heartbeatIntervalHours: number;
  /** 是否启用签名 */
  enableSign: boolean;
  /** 是否开发模式(跳过验证) */
  devMode: boolean;
}

/**
 * 默认配置
 */
export const DEFAULT_LICENSE_CONFIG: LicenseModuleConfig = {
  apiBaseUrl: "https://www.tecbinai.com/api/api/v1/license",
  signSecretKey: "Cb#2026$Tecbinai@Lic3nse!Hmac^Key&Secure",
  offlineGracePeriodHours: 72,
  heartbeatIntervalHours: 24,
  enableSign: true,
  devMode: false,
};
