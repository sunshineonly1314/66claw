/**
 * OpenClawCN License Module - Verification Service
 * 授权验证核心逻辑
 */

import dns from "node:dns";
import {
  type ApiResponse,
  type LicenseVerifyRequest,
  type LicenseVerifyResponseData,
  type LicenseHeartbeatRequest,
  type LicenseHeartbeatResponseData,
  type DeviceListRequest,
  type DeviceListResponseData,
  type DeviceUnbindResponseData,
  type DeviceSwitchRequest,
  type DeviceSwitchResponseData,
  type HealthCheckResponseData,
  type LicenseModuleConfig,
  type LicenseCache,
  type LicenseUpgradeRequest,
  type LicenseUpgradeResponseData,
  type AddonInfo,
  DEFAULT_LICENSE_CONFIG,
  LicenseErrorCode,
  LICENSE_ERROR_MESSAGES,
} from "./types.js";
import { getDeviceId, getDeviceName, getOsInfo, getDeviceFingerprint } from "./device-id.js";

import { verifyLicenseResponseSignature, verifyHeartbeatResponseSignature } from "./rsa-verify.js";
import { generateSignParams, generateSignParamsV2 } from "./sign.js";
// NOTE: loadLicenseCache is imported lazily inside sendHeartbeat() to avoid
// circular dependency: verify.ts ← offline.ts ← verify.ts
import { createSubsystemLogger } from "../logging/subsystem.js";
import { VERSION } from "../version.js";

// 强制 DNS 解析优先使用 IPv4，避免 WSL 环境下 IPv6 不通导致的超时问题
dns.setDefaultResultOrder("ipv4first");

const log = createSubsystemLogger("license:verify");

// 模块配置（可通过 configure 方法修改）
let moduleConfig: LicenseModuleConfig = { ...DEFAULT_LICENSE_CONFIG };

/**
 * 配置 License 模块
 */
export function configureLicense(config: Partial<LicenseModuleConfig>): void {
  moduleConfig = { ...moduleConfig, ...config };
  log.debug("License module configured", { config: moduleConfig });
}

/**
 * 获取当前配置
 */
export function getLicenseConfig(): LicenseModuleConfig {
  return { ...moduleConfig };
}

/**
 * 构建 API URL
 */
function buildUrl(endpoint: string, baseUrl?: string): string {
  return `${baseUrl ?? moduleConfig.apiBaseUrl}${endpoint}`;
}

/**
 * 提取网络错误详细信息，避免只记录 "fetch failed"
 */
function extractNetworkErrorDetail(error: unknown): string {
  const cause = error instanceof Error ? (error.cause as Error) : undefined;
  const code = (cause as NodeJS.ErrnoException | undefined)?.code;
  const baseMsg = error instanceof Error ? error.message : String(error);
  return code ? `${code} (${cause?.message ?? baseMsg})` : (cause?.message ?? baseMsg);
}

/**
 * 获取所有可用的 API base URLs（主 URL + 备用 URL）
 */
function getAllBaseUrls(): string[] {
  const urls = [moduleConfig.apiBaseUrl];
  if (moduleConfig.apiFallbackUrls?.length) {
    urls.push(...moduleConfig.apiFallbackUrls);
  }
  return urls;
}

/**
 * 发送 HTTP 请求（支持多 URL 自动降级）
 * 主 URL 网络失败时依次尝试备用 URL，HTTP 业务错误不触发降级
 */
async function sendRequest<T>(
  method: "GET" | "POST",
  endpoint: string,
  body?: unknown,
  queryParams?: Record<string, string>,
): Promise<ApiResponse<T>> {
  const baseUrls = getAllBaseUrls();
  let lastError: Error | undefined;

  for (let i = 0; i < baseUrls.length; i++) {
    const baseUrl = baseUrls[i];
    let url = buildUrl(endpoint, baseUrl);

    if (queryParams) {
      const params = new URLSearchParams(queryParams);
      url += `?${params.toString()}`;
    }

    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
    };

    if (body && method === "POST") {
      options.body = JSON.stringify(body);
    }

    const isRetry = i > 0;
    log.debug(
      `${isRetry ? `[fallback ${i}/${baseUrls.length - 1}] ` : ""}Sending ${method} request to ${url}`,
    );

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        // 502/503/504 属于网关/服务不可用，应触发降级
        const isServerUnavailable = response.status >= 502 && response.status <= 504;
        if (isServerUnavailable && i < baseUrls.length - 1) {
          log.warn(`Server unavailable (${response.status}) on ${url}, trying fallback...`);
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          continue;
        }
        // 其他 HTTP 业务错误不降级（服务端能响应说明网络通了）
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (isRetry) {
        log.info(`Fallback URL succeeded: ${baseUrl}`);
      }

      const data = (await response.json()) as ApiResponse<T>;
      return data;
    } catch (error) {
      const detail = extractNetworkErrorDetail(error);
      const isNetworkError = !(error instanceof Error && error.message.startsWith("HTTP "));

      if (isNetworkError && i < baseUrls.length - 1) {
        // 网络层失败 + 还有备用 URL → 记录并继续
        log.warn(`Network failed on ${url} → ${detail}, trying fallback...`);
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }

      // 最后一个 URL 也失败，或者是 HTTP 业务错误
      const enriched = new Error(`Network error fetching ${endpoint}: ${detail}`);
      enriched.cause = error;
      log.error(
        `Request failed: ${method} ${url} → ${detail}${lastError ? ` (all ${baseUrls.length} URLs exhausted)` : ""}`,
      );
      throw enriched;
    }
  }

  // 不应到达
  throw lastError ?? new Error("No API base URLs configured");
}

/**
 * 获取当前应用版本
 * 使用 VERSION 常量（从 package.json 或构建时注入）确保版本号正确
 */
function getAppVersion(): string {
  return VERSION;
}

/**
 * 构建验证请求参数
 */
export function buildVerifyRequest(
  key: string,
  options: {
    shownNotificationIds?: number[];
  } = {},
): LicenseVerifyRequest {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();
  const appVersion = getAppVersion();
  const osInfo = getOsInfo();
  const deviceFingerprint = getDeviceFingerprint();

  const request: LicenseVerifyRequest = {
    key,
    deviceId,
    deviceName,
    appVersion,
    osInfo,
    // 设备指纹：32位hex字符串，与 deviceId 相同算法
    // 服务端直接做字符串相等比较，判断"同机重装"
    deviceFingerprint,
    shownNotificationIds: options.shownNotificationIds || [],
  };

  return request;
}

/**
 * 验证授权码
 *
 * @param key - 授权码
 * @param options - 验证选项
 * @returns 验证响应数据
 */
export async function verifyLicense(
  key: string,
  options: {
    shownNotificationIds?: number[];
  } = {},
): Promise<LicenseVerifyResponseData> {
  const request = buildVerifyRequest(key, options);

  try {
    const response = await sendRequest<LicenseVerifyResponseData>("POST", "/verify", request);

    if (response.code === 200) {
      const data = response.data;

      // Validate response structure before accessing properties
      if (!data || typeof data !== "object") {
        throw new Error("服务端返回了无效的响应数据");
      }
      if (typeof data.valid !== "boolean") {
        throw new Error("服务端响应缺少 valid 字段");
      }

      // RSA 签名验证（如果启用）
      if (moduleConfig.enableRsaVerify) {
        if (!data.signature) {
          log.error("RSA verification enabled but no signature in response");
          throw new Error("服务端响应缺少签名");
        }

        // 使用固定字段顺序验证签名：valid|tier|expiresAt|serverTime
        const verifyResult = verifyLicenseResponseSignature(
          data.valid,
          data.license?.tier ?? null,
          data.license?.expiresAt ?? null,
          data.serverTime,
          data.signature,
        );

        if (!verifyResult.valid) {
          log.error(`RSA signature verification failed: ${verifyResult.error}`);
          throw new Error(verifyResult.error || "许可证签名验证失败");
        }

        log.debug("RSA signature verification passed");
      }

      log.info(
        `License verification ${data.valid ? "succeeded" : "failed"}`,
        data.valid
          ? { tier: data.license?.tier, daysRemaining: data.license?.daysRemaining }
          : { errorCode: data.errorCode },
      );
      return data;
    }

    throw new Error(`Unexpected response code: ${response.code}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error(`License verification failed: ${errorMsg}`);
    throw error;
  }
}

/**
 * 升级/扩展包激活
 *
 * 统一入口：版本升级（basic→pro）和扩展包激活（skill-*）都走此接口。
 * 签名格式与 verify 一致：HMAC-SHA256(currentKey|deviceId|timestamp|nonce)
 * 响应签名格式与 verify 一致：RSA(valid|tier|expiresAt|serverTime)
 *
 * @param currentKey - 当前主激活码
 * @param upgradeKey - 升级码或扩展包码
 * @returns 升级响应数据
 */
export async function upgradeLicense(
  currentKey: string,
  upgradeKey: string,
): Promise<LicenseUpgradeResponseData> {
  const deviceId = getDeviceId();

  // 生成 HMAC 签名（与 verify 一致，用 currentKey 作为 payload 中的 key）
  // 优先尝试 v2 签名（需要 sessionSalt），降级到 v1
  let signParams: { timestamp: number; nonce: string; sign: string; signVersion?: 1 | 2 };
  try {
    const { loadLicenseCache } = await import("./offline.js");
    const cache = await loadLicenseCache();
    const now = Date.now();
    if (cache?.sessionSalt && cache.saltExpiresAt && cache.saltExpiresAt > now) {
      const v2 = generateSignParamsV2(currentKey, deviceId, cache.sessionSalt);
      signParams = { ...v2, signVersion: 2 as const };
    } else {
      signParams = {
        ...generateSignParams(currentKey, deviceId, currentKey),
        signVersion: 1 as const,
      };
    }
  } catch {
    signParams = {
      ...generateSignParams(currentKey, deviceId, currentKey),
      signVersion: 1 as const,
    };
  }

  const request: LicenseUpgradeRequest = {
    currentKey,
    upgradeKey,
    deviceId,
    timestamp: signParams.timestamp,
    nonce: signParams.nonce,
    sign: signParams.sign,
    signVersion: signParams.signVersion,
  };

  try {
    const response = await sendRequest<LicenseUpgradeResponseData>("POST", "/upgrade", request);

    if (response.code === 200) {
      const data = response.data;

      if (!data || typeof data !== "object") {
        throw new Error("服务端返回了无效的响应数据");
      }

      // 升级成功时验证 RSA 签名
      if (data.success && moduleConfig.enableRsaVerify && data.signature) {
        const verifyResult = verifyLicenseResponseSignature(
          true,
          data.license?.tier ?? null,
          data.license?.expiresAt ?? null,
          data.serverTime ?? 0,
          data.signature,
        );

        if (!verifyResult.valid) {
          log.error(`Upgrade RSA signature verification failed: ${verifyResult.error}`);
          throw new Error(verifyResult.error || "升级响应签名验证失败");
        }

        log.debug("Upgrade RSA signature verification passed");
      }

      // Sanitize addons in the response to filter out malformed entries
      if (data.success && data.license) {
        data.license.addons = sanitizeAddons(data.license.addons);
      }

      log.info(
        `License upgrade ${data.success ? "succeeded" : "failed"}`,
        data.success
          ? { upgradeType: data.upgradeType, toTier: data.toTier }
          : { errorCode: data.errorCode, errorMessage: data.errorMessage },
      );
      return data;
    }

    throw new Error(`Unexpected response code: ${response.code}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error(`License upgrade failed: ${errorMsg}`);

    // 超时/网络错误提供更友好的提示
    if (
      errorMsg.includes("timeout") ||
      errorMsg.includes("ETIMEDOUT") ||
      errorMsg.includes("ECONNABORTED")
    ) {
      throw new Error("网络请求超时，请检查网络连接后重试");
    }
    if (
      errorMsg.includes("ENOTFOUND") ||
      errorMsg.includes("ECONNREFUSED") ||
      errorMsg.includes("fetch failed")
    ) {
      throw new Error("无法连接到授权服务器，请检查网络连接");
    }
    throw error;
  }
}

/**
 * 发送心跳
 *
 * [改造1] 优先使用 v2 HMAC 签名（需要缓存中的 sessionSalt）；
 *         salt 过期或不存在时，降级到 v1 签名，不触发重新激活流程。
 * [改造5] 携带 clientHealth 运行时健康信号（辅助信号，非主防线）。
 */
export async function sendHeartbeat(key: string): Promise<LicenseHeartbeatResponseData> {
  const deviceId = getDeviceId();

  // [改造1] 尝试从缓存读取 sessionSalt，优先用 v2 签名
  // lazy import offline.ts to avoid circular dependency (offline.ts imports createLicenseCache from verify.ts)
  let signParams: { timestamp?: number; nonce?: string; sign?: string; signVersion?: 1 | 2 } = {};
  // [改造5] cacheStatus: track actual integrity outcome from cache load
  let cacheStatus: "ok" | "hmac_fail" | "rsa_fail" | "missing" = "missing";
  try {
    const { loadLicenseCache } = await import("./offline.js");
    const cache = await loadLicenseCache();
    const now = Date.now();
    if (cache) {
      // loadLicenseCache returns null on HMAC/RSA failure, non-null means integrity passed
      cacheStatus = "ok";
      if (cache?.sessionSalt && cache?.saltExpiresAt && now < cache.saltExpiresAt) {
        signParams = generateSignParamsV2(key, deviceId, cache.sessionSalt);
        log.debug("Heartbeat using v2 HMAC signature");
      } else {
        // salt 过期或不存在：降级到 v1（只换签名算法，不重新激活）
        signParams = { ...generateSignParams(key, deviceId, key), signVersion: 1 };
        log.debug("Heartbeat using v1 HMAC signature (salt expired or missing)");
      }
    } else {
      // cache is null: loadLicenseCache returns null when file is missing OR integrity failed.
      // In heartbeat context the file was present at startup, so null here means integrity failure.
      cacheStatus = "hmac_fail";
      signParams = { ...generateSignParams(key, deviceId, key), signVersion: 1 };
      log.debug("Heartbeat cache integrity check failed (hmac_fail), using v1 HMAC signature");
    }
  } catch {
    // 缓存读取失败时降级到 v1
    cacheStatus = "missing";
    signParams = { ...generateSignParams(key, deviceId, key), signVersion: 1 };
  }

  // [改造5] 构建客户端健康信号（辅助信号，专业攻击者可伪造，不作为主防线）
  const clientHealth: LicenseHeartbeatRequest["clientHealth"] = {
    hasDebugger: process.debugPort !== 0,
    suspiciousArgs: process.execArgv.some(
      (arg) => arg.includes("inspect") || arg.includes("debug"),
    ),
    cacheStatus,
    appVersion: VERSION,
  };

  const request: LicenseHeartbeatRequest = {
    key,
    deviceId,
    ...signParams,
    clientHealth,
  };

  try {
    const response = await sendRequest<LicenseHeartbeatResponseData>("POST", "/heartbeat", request);

    if (response.code === 200) {
      const data = response.data;

      // RSA 签名验证（如果启用）
      // [改造5] 签名内容扩展为：valid|daysRemaining|serverTime|tierLimit|revoked
      if (moduleConfig.enableRsaVerify) {
        if (!data.signature) {
          log.error("RSA verification enabled but no signature in heartbeat response");
          throw new Error("心跳响应缺少签名");
        }

        const verifyResult = verifyHeartbeatResponseSignature(
          data.valid,
          data.daysRemaining,
          data.serverTime,
          data.signature,
          data.tierLimit,
          data.revoked,
        );

        if (!verifyResult.valid) {
          log.error(`Heartbeat RSA signature verification failed: ${verifyResult.error}`);
          throw new Error(verifyResult.error || "心跳签名验证失败");
        }
      }

      log.debug("Heartbeat sent", {
        valid: data.valid,
        tierLimit: data.tierLimit,
        revoked: data.revoked,
      });
      return data;
    }

    throw new Error(`Unexpected response code: ${response.code}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.warn(`Heartbeat failed: ${errorMsg}`);
    throw error;
  }
}

/**
 * 获取绑定的设备列表
 */
export async function getDeviceList(key: string): Promise<DeviceListResponseData> {
  const deviceId = getDeviceId();

  const request: DeviceListRequest = { key, deviceId };

  const response = await sendRequest<DeviceListResponseData>("POST", "/devices", request);

  if (response.code === 200) {
    return response.data;
  }

  throw new Error(`Unexpected response code: ${response.code}`);
}

/**
 * 解绑错误（携带冷却时间等详细信息）
 */
export class UnbindError extends Error {
  constructor(
    message: string,
    public readonly errorCode?: LicenseErrorCode,
    public readonly cooldownRemainingHours?: number,
    public readonly cooldownEndsAt?: string,
  ) {
    super(message);
    this.name = "UnbindError";
  }
}

/**
 * 解绑设备
 *
 * @throws {UnbindError} 解绑失败时抛出，包含详细的错误信息
 */
export async function unbindDevice(
  key: string,
  targetDeviceId: string,
): Promise<DeviceUnbindResponseData> {
  // 构建带签名的请求（使用当前设备 ID 签名，解绑目标设备）
  const currentDeviceId = getDeviceId();
  const request: {
    key: string;
    deviceId: string;
    timestamp?: number;
    nonce?: string;
    sign?: string;
  } = {
    key,
    deviceId: targetDeviceId,
  };

  const response = await sendRequest<DeviceUnbindResponseData>("POST", "/devices/unbind", request);

  if (response.code === 200) {
    const data = response.data;

    // 检查业务层面是否成功
    if (data.success) {
      log.info(`Device unbound: ${targetDeviceId.substring(0, 8)}...`);
      return data;
    }

    // 业务失败（如冷却中）
    const errorMsg =
      data.errorMessage || LICENSE_ERROR_MESSAGES[data.errorCode as LicenseErrorCode] || "解绑失败";

    // 如果是冷却错误，构造友好的错误消息
    if (data.errorCode === LicenseErrorCode.ERROR_UNBIND_COOLDOWN && data.cooldownRemainingHours) {
      const hours = data.cooldownRemainingHours;
      const friendlyMsg =
        hours >= 1
          ? `解绑冷却中，请 ${Math.ceil(hours)} 小时后再试`
          : `解绑冷却中，请 ${Math.ceil(hours * 60)} 分钟后再试`;

      throw new UnbindError(
        friendlyMsg,
        data.errorCode,
        data.cooldownRemainingHours,
        data.cooldownEndsAt,
      );
    }

    throw new UnbindError(errorMsg, data.errorCode);
  }

  throw new Error(`Failed to unbind device: ${response.message}`);
}

/**
 * 设备切换错误（携带冷却时间等详细信息）
 */
export class DeviceSwitchError extends Error {
  constructor(
    message: string,
    public readonly errorCode?: LicenseErrorCode,
    public readonly cooldownRemainingHours?: number,
    public readonly cooldownEndsAt?: string,
  ) {
    super(message);
    this.name = "DeviceSwitchError";
  }
}

/**
 * 确认设备切换（单设备模式）
 *
 * 用户确认后调用，自动解绑旧设备并绑定新设备。
 *
 * @param key - 授权码
 * @returns 切换响应数据
 * @throws {DeviceSwitchError} 切换失败时抛出，包含详细的错误信息
 */
export async function switchDevice(key: string): Promise<DeviceSwitchResponseData> {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();
  const osInfo = getOsInfo();
  const appVersion = getAppVersion();
  const deviceFingerprint = getDeviceFingerprint();

  const request: DeviceSwitchRequest = {
    key,
    deviceId,
    deviceName,
    osInfo,
    appVersion,
    // 设备指纹：32位hex字符串，服务端做字符串相等比较
    deviceFingerprint,
  };

  log.info(`Switching device: ${deviceId.substring(0, 8)}...`);

  try {
    const response = await sendRequest<DeviceSwitchResponseData>(
      "POST",
      "/devices/switch",
      request,
    );

    if (response.code === 200) {
      const data = response.data;

      // 检查业务层面是否成功（与 /verify 接口一致，使用 valid 字段）
      if (data.valid) {
        log.info("Device switch successful");
        return data;
      }

      // 业务失败（如冷却中）
      const errorMsg =
        data.errorMessage ||
        LICENSE_ERROR_MESSAGES[data.errorCode as LicenseErrorCode] ||
        "设备切换失败";

      // 如果是冷却错误，构造友好的错误消息
      if (
        data.errorCode === LicenseErrorCode.ERROR_DEVICE_SWITCH_COOLDOWN &&
        data.cooldownRemainingHours
      ) {
        const hours = data.cooldownRemainingHours;
        const friendlyMsg =
          hours >= 1
            ? `设备切换冷却中，请 ${Math.ceil(hours)} 小时后再试`
            : `设备切换冷却中，请 ${Math.ceil(hours * 60)} 分钟后再试`;

        throw new DeviceSwitchError(
          friendlyMsg,
          data.errorCode,
          data.cooldownRemainingHours,
          data.cooldownEndsAt,
        );
      }

      throw new DeviceSwitchError(errorMsg, data.errorCode ?? undefined);
    }

    throw new Error(`Failed to switch device: ${response.message}`);
  } catch (error) {
    if (error instanceof DeviceSwitchError) {
      throw error;
    }
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error(`Device switch failed: ${errorMsg}`);
    throw new DeviceSwitchError(errorMsg);
  }
}

/**
 * 确认通知已读
 */
export async function acknowledgeNotification(
  key: string,
  notificationId: number,
  action: "clicked" | "dismissed" | "closed",
): Promise<void> {
  const deviceId = getDeviceId();

  await sendRequest<null>("POST", "/notification/ack", {
    key,
    deviceId,
    notificationId,
    action,
  });

  log.debug(`Notification acknowledged: ${notificationId} (${action})`);
}

/**
 * 健康检查
 */
export async function checkHealth(): Promise<HealthCheckResponseData> {
  const response = await sendRequest<HealthCheckResponseData>("GET", "/health");

  if (response.code === 200) {
    return response.data;
  }

  throw new Error(`Health check failed: ${response.message}`);
}

/**
 * 校验并过滤 addon 数组，丢弃缺少必要字段的畸形条目
 */
function sanitizeAddons(addons: AddonInfo[] | undefined | null): AddonInfo[] {
  if (!Array.isArray(addons)) return [];
  return addons.filter(
    (a) =>
      a &&
      typeof a.type === "string" &&
      typeof a.name === "string" &&
      typeof a.expiresAt === "string",
  );
}

/**
 * 创建验证缓存数据
 */
export function createLicenseCache(key: string, response: LicenseVerifyResponseData): LicenseCache {
  const cache: LicenseCache = {
    key,
    valid: response.valid,
    verifyTime: Date.now(),
    expiresAt: response.license?.expiresAt || null,
    tier: response.license?.tier || null,
    features: response.license?.features || [],
    addons: sanitizeAddons(response.license?.addons),
    upgradeAvailable: response.license?.upgradeAvailable ?? null,
    deviceId: getDeviceId(),
    nextCheckAfterHours: response.nextCheckAfterHours || 24,
  };

  // [HIGH-08] 存储服务端签名载荷，用于离线时重新验证
  // 这样即使攻击者修改了 cache 中的 tier/expiresAt，签名也会校验失败
  if (response.signature && response.serverTime) {
    cache.signedPayload = {
      signature: response.signature,
      valid: response.valid,
      tier: response.license?.tier ?? null,
      expiresAt: response.license?.expiresAt ?? null,
      serverTime: response.serverTime,
    };
  }

  // [改造1] 存储服务端下发的 sessionSalt，用于下次请求的 v2 HMAC 签名派生
  if (response.sessionSalt && response.saltExpiresAt) {
    cache.sessionSalt = response.sessionSalt;
    cache.saltExpiresAt = response.saltExpiresAt;
  }

  return cache;
}

/**
 * 获取错误码对应的用户友好消息
 */
export function getErrorMessage(errorCode: LicenseErrorCode | null): string {
  if (errorCode && errorCode in LICENSE_ERROR_MESSAGES) {
    return LICENSE_ERROR_MESSAGES[errorCode];
  }
  return "授权验证失败，请稍后重试";
}

/**
 * 带重试的验证
 */
export async function verifyLicenseWithRetry(
  key: string,
  options: {
    shownNotificationIds?: number[];
    maxRetries?: number;
  } = {},
): Promise<LicenseVerifyResponseData> {
  const maxRetries = options.maxRetries ?? 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await verifyLicense(key, options);
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const causeMsg =
        error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined;
      const fullMsg = causeMsg ? `${errorMsg} (cause: ${causeMsg})` : errorMsg;

      if (isLastAttempt) {
        log.error(`License verification failed after ${maxRetries} attempts: ${fullMsg}`);
        throw error;
      }

      // 指数退避 + 抖动 (half-jitter strategy)
      // 防止多进程同时重试导致 thundering herd
      const baseDelay = Math.pow(2, attempt - 1) * 1000;
      const jitter = baseDelay * 0.5 * Math.random();
      const delay = Math.round(baseDelay * 0.5 + jitter);
      log.warn(
        `License verification attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms: ${fullMsg}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // 不应该到达这里
  throw new Error("Unexpected error in verifyLicenseWithRetry");
}
