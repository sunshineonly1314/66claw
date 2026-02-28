/**
 * 飞书客户端管理
 * Feishu Client Management
 *
 * 使用官方 @larksuiteoapi/node-sdk
 */

import * as Lark from "@larksuiteoapi/node-sdk";
import axios from "axios";
import type { FeishuChannelConfig, FeishuDomain, FeishuCredentials } from "./types.js";

// ============================================================================
// 无代理 HTTP 实例
// ============================================================================

/**
 * 飞书 API 是国内服务，不需要走代理。
 * 用户环境可能配置了 HTTP_PROXY/HTTPS_PROXY（如 Clash），
 * 默认的 axios 会自动走代理导致请求失败（400）。
 * 创建一个 proxy: false 的实例绕过代理。
 */
const noProxyHttpInstance = axios.create({ proxy: false });
noProxyHttpInstance.interceptors.request.use((req) => {
  if (req.headers) {
    req.headers["User-Agent"] = "oapi-node-sdk/1.0.0";
  }
  return req;
}, undefined, { synchronous: true });
noProxyHttpInstance.interceptors.response.use((resp) => {
  if ((resp.config as unknown as Record<string, unknown>)["$return_headers"]) {
    return { data: resp.data, headers: resp.headers } as unknown as typeof resp;
  }
  return resp.data as unknown as typeof resp;
});

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

  // 优先使用扁平配置，兼容旧版嵌套 app 对象
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

  // 创建新客户端（使用无代理 HTTP 实例，避免 Clash 等代理干扰）
  const client = new Lark.Client({
    appId: creds.appId,
    appSecret: creds.appSecret,
    appType: Lark.AppType.SelfBuild,
    domain: resolveDomain(creds.domain),
    httpInstance: noProxyHttpInstance as unknown as Lark.HttpInstance,
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
    httpInstance: noProxyHttpInstance as unknown as Lark.HttpInstance,
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
