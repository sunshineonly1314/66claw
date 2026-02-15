/**
 * 飞书客户端管理
 * Feishu Client Management
 *
 * 使用官方 @larksuiteoapi/node-sdk
 */

import * as Lark from "@larksuiteoapi/node-sdk";
import type { FeishuChannelConfig, FeishuDomain, FeishuCredentials } from "./types.js";

// ============================================================================
// 客户端缓存
// ============================================================================

let cachedClient: Lark.Client | null = null;
let cachedConfig: { appId: string; appSecret: string; domain: FeishuDomain } | null = null;

// ============================================================================
// 凭证解析
// ============================================================================

/**
 * 解析飞书凭证
 * 支持新版扁平配置和旧版嵌套配置
 */
export function resolveFeishuCredentials(cfg?: FeishuChannelConfig): FeishuCredentials | null {
  if (!cfg) return null;

  // 优先使用新版扁平配置，其次使用旧版嵌套配置
  const appId = cfg.appId?.trim() || cfg.app?.appId?.trim();
  const appSecret = cfg.appSecret?.trim() || cfg.app?.appSecret?.trim();

  if (!appId || !appSecret) return null;

  return {
    appId,
    appSecret,
    encryptKey: cfg.encryptKey?.trim() || cfg.app?.encryptKey?.trim() || undefined,
    verificationToken: cfg.verificationToken?.trim() || cfg.app?.verificationToken?.trim() || undefined,
    domain: cfg.domain ?? "feishu",
  };
}

// ============================================================================
// 域名解析
// ============================================================================

function resolveDomain(domain: FeishuDomain): typeof Lark.Domain.Feishu | typeof Lark.Domain.Lark {
  return domain === "lark" ? Lark.Domain.Lark : Lark.Domain.Feishu;
}

// ============================================================================
// 客户端创建
// ============================================================================

/**
 * 创建飞书 REST 客户端
 * 使用缓存避免重复创建
 */
export function createFeishuClient(cfg: FeishuChannelConfig): Lark.Client {
  const creds = resolveFeishuCredentials(cfg);
  if (!creds) {
    throw new Error("飞书凭证未配置 (需要 appId, appSecret)");
  }

  // 检查缓存
  if (
    cachedClient &&
    cachedConfig &&
    cachedConfig.appId === creds.appId &&
    cachedConfig.appSecret === creds.appSecret &&
    cachedConfig.domain === creds.domain
  ) {
    return cachedClient;
  }

  // 创建新客户端
  const client = new Lark.Client({
    appId: creds.appId,
    appSecret: creds.appSecret,
    appType: Lark.AppType.SelfBuild,
    domain: resolveDomain(creds.domain),
  });

  cachedClient = client;
  cachedConfig = { appId: creds.appId, appSecret: creds.appSecret, domain: creds.domain };

  return client;
}

/**
 * 创建飞书 WebSocket 客户端
 * 用于长连接模式
 */
export function createFeishuWSClient(cfg: FeishuChannelConfig): Lark.WSClient {
  const creds = resolveFeishuCredentials(cfg);
  if (!creds) {
    throw new Error("飞书凭证未配置 (需要 appId, appSecret)");
  }

  return new Lark.WSClient({
    appId: creds.appId,
    appSecret: creds.appSecret,
    domain: resolveDomain(creds.domain),
    loggerLevel: Lark.LoggerLevel.info,
  });
}

/**
 * 创建事件分发器
 */
export function createEventDispatcher(cfg: FeishuChannelConfig): Lark.EventDispatcher {
  const creds = resolveFeishuCredentials(cfg);
  return new Lark.EventDispatcher({
    encryptKey: creds?.encryptKey,
    verificationToken: creds?.verificationToken,
  });
}

/**
 * 清除客户端缓存
 */
export function clearClientCache(): void {
  cachedClient = null;
  cachedConfig = null;
}

// ============================================================================
// 导出 Lark SDK 常量供其他模块使用
// ============================================================================

export { Lark };
