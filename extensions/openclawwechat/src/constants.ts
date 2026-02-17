/**
 * 插件常量定义
 *
 * 统一管理插件 ID、Channel ID、版本号等常量
 */

export const PLUGIN_VERSION = "2026.2.15";

export const PLUGIN_ID = "openclawwechat";

export const CHANNEL_ID = "openclawwechat";

/**
 * 中转服务器 URL
 * 通过 ClawChat 小程序桥接服务器转发消息
 */
export const BRIDGE_URL = "https://api.clawchat.mifengcdn.com";

/**
 * 配置默认值
 */
export const DEFAULT_CONFIG = {
  pollIntervalMs: 2000,
  sessionKey: "agent:main:main",
  debug: false,
} as const;
