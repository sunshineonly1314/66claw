/**
 * OpenClawCN License Module - Type Definitions
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
  /**
   * 设备指纹（32位hex字符串）
   *
   * 基于稳定硬件标识生成的哈希值，用于服务端判断"同机重装"场景
   * 与 deviceId 使用相同算法，保证同一硬件生成相同指纹
   *
   * 注意：这是字符串类型，不是对象，服务端直接做字符串相等比较
   */
  deviceFingerprint?: string;
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
  /** 请求时间戳(毫秒) - 签名参数 */
  timestamp?: number;
  /** 随机字符串(16位) - 签名参数 */
  nonce?: string;
  /** 请求签名 - 签名参数 */
  sign?: string;
  /** [改造1] 签名版本：1=旧版(key为HMAC密钥)，2=新版(sessionSalt派生密钥) */
  signVersion?: 1 | 2;
  /**
   * [改造5] 客户端运行时健康信号（辅助信号，专业攻击者可伪造，非主防线）
   * 用于服务端收集破解尝试数据，计算设备信誉分
   */
  clientHealth?: {
    /** 是否检测到调试端口（--inspect 标志） */
    hasDebugger: boolean;
    /** execArgv 是否含可疑参数 */
    suspiciousArgs: boolean;
    /** 上次缓存完整性检查结果 */
    cacheStatus: "ok" | "hmac_fail" | "rsa_fail" | "missing";
    /** 客户端版本号 */
    appVersion: string;
  };
}

/**
 * 设备列表请求参数（POST）
 */
export interface DeviceListRequest {
  key: string;
  deviceId: string;
  /** 请求时间戳(毫秒) - 签名参数 */
  timestamp?: number;
  /** 随机字符串(16位) - 签名参数 */
  nonce?: string;
  /** 请求签名 - 签名参数 */
  sign?: string;
}

/**
 * 设备解绑请求参数
 */
export interface DeviceUnbindRequest {
  key: string;
  deviceId: string;
  /** 请求时间戳(毫秒) - 签名参数 */
  timestamp?: number;
  /** 随机字符串(16位) - 签名参数 */
  nonce?: string;
  /** 请求签名 - 签名参数 */
  sign?: string;
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

/**
 * 升级/扩展包激活请求参数
 */
export interface LicenseUpgradeRequest {
  /** 当前主激活码 */
  currentKey: string;
  /** 升级码或扩展包码 */
  upgradeKey: string;
  /** 设备唯一标识 */
  deviceId: string;
  /** 请求时间戳(毫秒) */
  timestamp: number;
  /** 随机字符串(16位) */
  nonce: string;
  /** HMAC-SHA256 请求签名 */
  sign: string;
  /** 签名版本：1=旧版, 2=新版(sessionSalt派生密钥) */
  signVersion?: 1 | 2;
}

/**
 * 升级/扩展包激活响应数据
 */
export interface LicenseUpgradeResponseData {
  /** 是否成功 */
  success: boolean;
  /** 升级类型 */
  upgradeType?: "tier_upgrade" | "addon";
  /** 源版本（版本升级时） */
  fromTier?: string;
  /** 目标版本（版本升级时） */
  toTier?: string;
  /** 成功/失败消息 */
  message?: string;
  /** 升级后的 License 信息 */
  license?: LicenseInfo | null;
  /** RSA 签名（格式与 verify 一致：valid|tier|expiresAt|serverTime） */
  signature?: string;
  /** 服务器时间 (毫秒时间戳) */
  serverTime?: number;
  /** 业务错误码 */
  errorCode?: LicenseUpgradeErrorCode;
  /** 错误消息 */
  errorMessage?: string;
  /** 升级码/扩展码过期时间（errorCode=2004 时返回） */
  expiredAt?: string;
}

/**
 * 设备切换请求参数（单设备模式）
 */
export interface DeviceSwitchRequest {
  /** 授权码 */
  key: string;
  /** 新设备ID */
  deviceId: string;
  /** 新设备名称（可选） */
  deviceName?: string;
  /** 操作系统信息（可选） */
  osInfo?: string;
  /** 客户端版本号 */
  appVersion?: string;
  /**
   * 设备指纹（32位hex字符串）
   * 服务端通过字符串相等比较判断是否为同一台机器
   */
  deviceFingerprint?: string;
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
 * 技术支持群二维码配置
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
  /** 产品等级 */
  tier: "basic" | "standard" | "pro" | "enterprise" | "test" | "trial";
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
  /** 已激活的扩展包列表（始终为数组，无扩展包时为 []） */
  addons: AddonInfo[];
  /** 当前版本可升级的信息，无可升级则为 null / undefined */
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
  /** 扩展包类型（如 "skills_s1"、"skills_s2"、"skills_premium"） */
  type: string;
  /** 扩展包名称 */
  name: string;
  /** 过期时间 (ISO 8601) */
  expiresAt: string;
  /** 扩展包包含的功能列表 */
  features: string[];
}

/**
 * 升级可用信息（basic 用户可升级到 pro）
 */
export interface UpgradeAvailableInfo {
  /** 目标版本 */
  targetTier: string;
  /** 目标版本名称 */
  targetTierName: string;
  /** 升级价格（元） */
  upgradePrice: number;
  /** 升级描述 */
  description: string;
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
  /** RSA 签名 (服务端用私钥签名，客户端用公钥验证) */
  signature?: string;
  /**
   * [改造1] 服务端下发的 sessionSalt（base64，32字节随机数）
   * 用于派生 v2 HMAC 密钥，防止仅凭 licenseKey 构造合法请求
   */
  sessionSalt?: string;
  /** sessionSalt 过期时间戳（毫秒），建议 24 小时 */
  saltExpiresAt?: number;
  /** 设备切换信息（errorCode=1010 时返回） */
  deviceSwitchInfo?: DeviceSwitchInfo;
  /** 设备切换冷却信息（errorCode=1011 时返回） */
  deviceSwitchCooldown?: DeviceSwitchCooldownInfo;
}

/**
 * 心跳响应数据
 */
export interface LicenseHeartbeatResponseData {
  valid: boolean;
  daysRemaining: number;
  serverTime: number;
  /** RSA 签名 (服务端用私钥签名) */
  signature?: string;
  /**
   * [改造5] 服务端强制功能降级
   * "" 或 undefined = 无限制；"basic" = 强制降为基础版功能
   * 必须包含在 RSA 签名内容中，否则可被本地代理删除
   */
  tierLimit?: string;
  /**
   * [改造6] 服务端吊销标志
   * true = 该 licenseKey 已被服务端吊销，客户端应立即清缓存并锁定
   * 必须包含在 RSA 签名内容中
   */
  revoked?: boolean;
  /**
   * [改造1] 服务端下发的新 sessionSalt
   * 用于派生下次请求的 v2 HMAC 密钥，每次心跳轮换
   */
  sessionSalt?: string;
  /** sessionSalt 过期时间戳（毫秒） */
  saltExpiresAt?: number;
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
 * 设备解绑响应数据
 */
export interface DeviceUnbindResponseData {
  success: boolean;
  /** 错误码（失败时） */
  errorCode?: LicenseErrorCode;
  /** 错误消息（失败时） */
  errorMessage?: string;
  /** 冷却剩余小时数（1009 错误时） */
  cooldownRemainingHours?: number;
  /** 冷却结束时间 ISO 字符串（1009 错误时） */
  cooldownEndsAt?: string;
}

/**
 * 设备切换响应数据（单设备模式）
 * 注意：与 /verify 接口一致，使用 valid 字段判断成功
 */
export interface DeviceSwitchResponseData {
  /** 是否有效（成功时为 true） */
  valid: boolean;
  /** 错误码（失败时） */
  errorCode?: LicenseErrorCode | null;
  /** 错误消息（失败时） */
  errorMessage?: string | null;
  /** License 信息（成功时） */
  license?: LicenseInfo | null;
  /** 设备信息（成功时） */
  device?: DeviceInfo | null;
  /** 冷却剩余小时数（1011 错误时） */
  cooldownRemainingHours?: number;
  /** 冷却结束时间 ISO 字符串（1011 错误时） */
  cooldownEndsAt?: string;
}

/**
 * 设备切换信息（errorCode=1010 时返回）
 */
export interface DeviceSwitchInfo {
  /** 已绑定设备的 ID */
  existingDeviceId: string;
  /** 已绑定设备的名称 */
  existingDeviceName: string;
  /** 已绑定设备的操作系统信息 */
  existingOsInfo: string;
  /** 设备数量限制 */
  deviceLimit: number;
  /** 已绑定设备数 */
  boundDevices: number;
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
  /** 解绑冷却中 */
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
  /** 当前版本不匹配（已是Pro再用Basic→Pro升级码） */
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
  [LicenseErrorCode.ERROR_UNBIND_COOLDOWN]: "解绑冷却中，请稍后再试",
  [LicenseErrorCode.ERROR_DEVICE_SWITCH_REQUIRED]: "检测到已在其他设备使用此密钥，需要确认切换",
  [LicenseErrorCode.ERROR_DEVICE_SWITCH_COOLDOWN]: "设备切换冷却中，请稍后再试",
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
  /** 已激活的扩展包列表 */
  addons?: AddonInfo[];
  /** 可用的升级信息（缓存用于离线展示） */
  upgradeAvailable?: UpgradeAvailableInfo | null;
  /** 设备ID */
  deviceId: string;
  /** 下次检查间隔(小时) */
  nextCheckAfterHours: number;
  /**
   * [HIGH-08] 服务端签名载荷
   *
   * 存储服务端返回的 RSA 签名及其对应的签名内容字段。
   * 离线/启动时重新验证此签名，防止本地篡改 tier/expiresAt/features。
   * 如果签名验证失败，缓存视为被篡改，拒绝离线使用。
   */
  signedPayload?: {
    /** RSA 签名 (base64) */
    signature: string;
    /** 签名覆盖的字段值 */
    valid: boolean;
    tier: string | null;
    expiresAt: string | null;
    serverTime: number;
  };
  /**
   * [改造1] 本地缓存的 sessionSalt（来自 /verify 或 /heartbeat 响应）
   * AES-256-GCM 加密保护，用于下次请求的 v2 HMAC 派生
   */
  sessionSalt?: string;
  /** sessionSalt 过期时间戳（毫秒） */
  saltExpiresAt?: number;
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
  /** 设备切换信息（errorCode=1010 时） */
  deviceSwitchInfo: DeviceSwitchInfo | null;
  /** 设备切换冷却信息（errorCode=1011 时） */
  deviceSwitchCooldown: DeviceSwitchCooldownInfo | null;
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
  /** 备用 API Base URLs（主 URL 网络失败时依次尝试） */
  apiFallbackUrls?: string[];
  /** 离线宽限期(小时) */
  offlineGracePeriodHours: number;
  /** 心跳间隔(小时) */
  heartbeatIntervalHours: number;
  /** 是否开发模式(跳过验证) */
  devMode: boolean;
  /** 是否启用 RSA 响应签名验证 (服务端需要支持) */
  enableRsaVerify: boolean;
}

/**
 * 默认配置
 */
export const DEFAULT_LICENSE_CONFIG: LicenseModuleConfig = {
  apiBaseUrl: "https://www.obplugins.cn/api/api/v1/license",
  offlineGracePeriodHours: 8, // 从 24h 缩短到 8h，减少离线滥用窗口（盗版者修改此值需要破解 bytecode）
  heartbeatIntervalHours: 4, // 从 24h 缩短到 4h，提高检测频率
  devMode: false,
  enableRsaVerify: true, // 2026-03-02: 更换密钥对，配合服务端重新部署
};
