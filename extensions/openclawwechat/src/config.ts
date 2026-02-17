/**
 * 配置工具函数
 *
 * 统一读取和解析插件配置，使用 configSchema 中定义的默认值
 */

import type { ClawdbotConfig } from "openclawcn/plugin-sdk";
import { PLUGIN_ID, DEFAULT_CONFIG, BRIDGE_URL } from "./constants.js";

export interface PluginConfig {
  bridgeUrl: string;
  apiKey?: string;
  pollIntervalMs: number;
  sessionKey: string;
  debug: boolean;
}

/**
 * 从 OpenClawCN 配置中读取插件配置
 */
export function getPluginConfig(cfg?: ClawdbotConfig): PluginConfig {
  const pluginConfig =
    (cfg as any)?.plugins?.entries?.[PLUGIN_ID]?.config || {};
  // 兼容旧配置 sessionKeyPrefix（已更名为 sessionKey）
  const rawSessionKey =
    pluginConfig.sessionKey ??
    (pluginConfig as { sessionKeyPrefix?: string }).sessionKeyPrefix;

  return {
    bridgeUrl: BRIDGE_URL,
    apiKey: pluginConfig.apiKey,
    pollIntervalMs:
      pluginConfig.pollIntervalMs ?? DEFAULT_CONFIG.pollIntervalMs,
    sessionKey: rawSessionKey ?? DEFAULT_CONFIG.sessionKey,
    debug: pluginConfig.debug ?? DEFAULT_CONFIG.debug,
  };
}

/**
 * 检查配置是否有效（API Key 是否存在）
 */
export function isConfigValid(config: PluginConfig): boolean {
  return Boolean(config.apiKey?.trim());
}
