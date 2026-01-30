/**
 * Clawdbot License Module - Verification Service
 * 授权验证核心逻辑
 */

import {
  type ApiResponse,
  type LicenseVerifyRequest,
  type LicenseVerifyResponseData,
  type LicenseHeartbeatRequest,
  type LicenseHeartbeatResponseData,
  type DeviceListResponseData,
  type HealthCheckResponseData,
  type LicenseModuleConfig,
  type LicenseCache,
  DEFAULT_LICENSE_CONFIG,
  LicenseErrorCode,
  LICENSE_ERROR_MESSAGES,
} from "./types.js";
import { getDeviceId, getDeviceName, getOsInfo } from "./device-id.js";
import { generateSignParams } from "./sign.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

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
function buildUrl(endpoint: string): string {
  return `${moduleConfig.apiBaseUrl}${endpoint}`;
}

/**
 * 发送 HTTP 请求
 */
async function sendRequest<T>(
  method: "GET" | "POST",
  endpoint: string,
  body?: unknown,
  queryParams?: Record<string, string>,
): Promise<ApiResponse<T>> {
  let url = buildUrl(endpoint);

  // 添加查询参数
  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15000), // 15秒超时
  };

  if (body && method === "POST") {
    options.body = JSON.stringify(body);
  }

  log.debug(`Sending ${method} request to ${endpoint}`);

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as ApiResponse<T>;
  return data;
}

/**
 * 获取当前应用版本
 */
function getAppVersion(): string {
  // 尝试从环境变量或 package.json 获取版本
  return process.env.CLAWDBOT_VERSION || process.env.npm_package_version || "1.0.0";
}

/**
 * 构建验证请求参数
 */
export function buildVerifyRequest(
  key: string,
  options: {
    shownNotificationIds?: number[];
    enableSign?: boolean;
  } = {},
): LicenseVerifyRequest {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();
  const appVersion = getAppVersion();
  const osInfo = getOsInfo();

  const request: LicenseVerifyRequest = {
    key,
    deviceId,
    deviceName,
    appVersion,
    osInfo,
    shownNotificationIds: options.shownNotificationIds || [],
  };

  // 添加签名参数
  const shouldSign = options.enableSign ?? moduleConfig.enableSign;
  if (shouldSign) {
    const signParams = generateSignParams(key, deviceId, moduleConfig.signSecretKey);
    request.timestamp = signParams.timestamp;
    request.nonce = signParams.nonce;
    request.sign = signParams.sign;
  }

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
    enableSign?: boolean;
  } = {},
): Promise<LicenseVerifyResponseData> {
  // 开发模式跳过验证
  if (moduleConfig.devMode) {
    log.info("Dev mode: skipping license verification");
    return createDevModeResponse();
  }

  const request = buildVerifyRequest(key, options);

  try {
    const response = await sendRequest<LicenseVerifyResponseData>("POST", "/verify", request);

    if (response.code === 200) {
      log.info(
        `License verification ${response.data.valid ? "succeeded" : "failed"}`,
        response.data.valid
          ? { tier: response.data.license?.tier, daysRemaining: response.data.license?.daysRemaining }
          : { errorCode: response.data.errorCode },
      );
      return response.data;
    }

    throw new Error(`Unexpected response code: ${response.code}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error(`License verification failed: ${errorMsg}`);
    throw error;
  }
}

/**
 * 发送心跳
 */
export async function sendHeartbeat(
  key: string,
): Promise<LicenseHeartbeatResponseData> {
  if (moduleConfig.devMode) {
    return { valid: true, daysRemaining: 999, serverTime: Date.now() };
  }

  const deviceId = getDeviceId();
  const request: LicenseHeartbeatRequest = { key, deviceId };

  try {
    const response = await sendRequest<LicenseHeartbeatResponseData>(
      "POST",
      "/heartbeat",
      request,
    );

    if (response.code === 200) {
      log.debug("Heartbeat sent", { valid: response.data.valid });
      return response.data;
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

  const response = await sendRequest<DeviceListResponseData>("GET", "/devices", undefined, {
    key,
    deviceId,
  });

  if (response.code === 200) {
    return response.data;
  }

  throw new Error(`Unexpected response code: ${response.code}`);
}

/**
 * 解绑设备
 */
export async function unbindDevice(
  key: string,
  targetDeviceId: string,
): Promise<void> {
  const response = await sendRequest<null>("POST", "/devices/unbind", {
    key,
    deviceId: targetDeviceId,
  });

  if (response.code !== 200) {
    throw new Error(`Failed to unbind device: ${response.message}`);
  }

  log.info(`Device unbound: ${targetDeviceId.substring(0, 8)}...`);
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
 * 创建开发模式的模拟响应
 */
function createDevModeResponse(): LicenseVerifyResponseData {
  return {
    valid: true,
    errorCode: null,
    errorMessage: null,
    serverTime: Date.now(),
    nextCheckAfterHours: 24,
    license: {
      tier: "basic",
      tierName: "开发模式",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      daysRemaining: 365,
      keyType: "test",
      features: ["basic_chat", "basic_skills", "history_7days", "dev_mode"],
    },
    device: {
      deviceId: getDeviceId(),
      deviceLimit: 999,
      boundDevices: 1,
      isCurrentBound: true,
    },
    notifications: null,
    renewalReminder: null,
    forceUpdate: null,
  };
}

/**
 * 创建验证缓存数据
 */
export function createLicenseCache(
  key: string,
  response: LicenseVerifyResponseData,
): LicenseCache {
  return {
    key,
    valid: response.valid,
    verifyTime: Date.now(),
    expiresAt: response.license?.expiresAt || null,
    tier: response.license?.tier || null,
    features: response.license?.features || [],
    deviceId: getDeviceId(),
    nextCheckAfterHours: response.nextCheckAfterHours || 24,
  };
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
    enableSign?: boolean;
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

      if (isLastAttempt) {
        log.error(`License verification failed after ${maxRetries} attempts: ${errorMsg}`);
        throw error;
      }

      // 指数退避
      const delay = Math.pow(2, attempt - 1) * 1000;
      log.warn(`License verification attempt ${attempt} failed, retrying in ${delay}ms: ${errorMsg}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // 不应该到达这里
  throw new Error("Unexpected error in verifyLicenseWithRetry");
}
