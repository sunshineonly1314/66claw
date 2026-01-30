/**
 * License 配置类型定义
 */

export type LicenseConfig = {
  /** 授权码 */
  key?: string;
  /** 授权状态 */
  status?: string;
  /** 过期时间 (ISO 8601) */
  expiresAt?: string;
  /** 最后验证时间 (ISO 8601) */
  validatedAt?: string;
  /** 产品等级: basic | test */
  tier?: "basic" | "test";
  /** 等级名称 */
  tierName?: string;
  /** 剩余天数 */
  daysRemaining?: number;
  /** Key 类型: test | trial | standard */
  keyType?: "test" | "trial" | "standard";
  /** 功能特性列表 */
  features?: string[];
  /** 当前设备ID */
  deviceId?: string;
  /** 设备绑定上限 */
  deviceLimit?: number;
  /** 已绑定设备数 */
  boundDevices?: number;
  /** 离线有效截止时间 (ISO 8601) */
  offlineValidUntil?: string;
  /** 已展示的通知 ID 列表 */
  shownNotificationIds?: number[];
};
