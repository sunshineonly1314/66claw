/**
 * OpenClawCN License Module - Short-Term Token
 * 短期令牌管理
 *
 * 核心防护机制：
 * - 令牌由服务端签发，有效期 1 小时
 * - 使用 RSA 签名，客户端无法伪造
 * - 即使本地代码被修改，没有有效令牌也无法使用
 */

import { createVerify } from "node:crypto";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { VERSION } from "../version.js";
import { getDeviceId } from "./device-id.js";
import { generateSignParams } from "./sign.js";
import { getLicenseConfig } from "./verify.js";

const log = createSubsystemLogger("license:token");

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 短期令牌
 */
export interface LicenseToken {
  /** 令牌 ID */
  tokenId: string;
  /** 授权码 */
  licenseKey: string;
  /** 设备 ID */
  deviceId: string;
  /** 签发时间 (毫秒时间戳) */
  issuedAt: number;
  /** 过期时间 (毫秒时间戳) */
  expiresAt: number;
  /** 允许的功能列表 */
  allowedFeatures: string[];
  /**
   * 服务端派生的内容加密密钥（base64, 32字节）。
   * 服务端用 HMAC-SHA256(MASTER_KEY, deviceId|"skill-content-v2") 派生，
   * 由 RSA 签名保护，客户端不可伪造。
   */
  skillKey?: string;
  /** 服务端 RSA 签名 */
  signature: string;
}

/**
 * 令牌请求响应
 */
export interface TokenResponse {
  /** 是否成功 */
  success: boolean;
  /** 令牌（成功时） */
  token?: LicenseToken;
  /** 错误码（失败时） */
  errorCode?: number;
  /** 错误消息（失败时） */
  errorMessage?: string;
}

/**
 * 令牌状态
 */
export interface TokenState {
  /** 当前令牌 */
  current: LicenseToken | null;
  /** 上次刷新时间 */
  lastRefresh: number;
  /** 刷新失败次数 */
  failureCount: number;
  /** 是否正在刷新 */
  refreshing: boolean;
}

// ============================================================================
// 服务端公钥（用于验证令牌签名）
// ============================================================================

/**
 * 服务端 RSA 公钥
 * 复用现有的 RSA 密钥对（与 /verify 接口相同）
 * 私钥在服务端：backend/src/main/resources/keys/private_key.pem
 */
const SERVER_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkDtHShdtjfCopovpCcIR
hiyFHopWsclr+7JQ+c4Iz2NIdWrCoAkSUTSp24fJXmVQh27m8Eq9JvGX/wMpQ8H6
++IpO06BXCyk1gYqf8Qqa6CdGMQ0aygCq6aTebQQqDBGICH7u985fkdTRDz62xyG
UbYKIJPZkRycZCGZ5pMvwhxKcSZ6ifpGuBhAlxLqHpax9sUgstWWBOMWEr7SpbL0
BE081ASxkXuQSSGDQFQzUZ98ZoVoYOmneIjU/6JHOAhLDA1R9qEy7KKpb3FV0DQm
PWgG9tgLZk1M7yp3xitO98ZrMtWLmNNPUtQvfM1vlvRI7It0BoGVnPq5P+9dvzmS
nQIDAQAB
-----END PUBLIC KEY-----`;

/**
 * 离线宽限期（毫秒）
 * 令牌过期后，在此时间内仍允许使用，避免网络抖动影响用户体验
 */
const OFFLINE_GRACE_PERIOD_MS = 30 * 60 * 1000; // 30 分钟

/**
 * 客户端与服务端的时间差（毫秒）
 * 用于校正本地时间判断令牌过期
 */
let serverTimeDrift = 0;

// ============================================================================
// 全局状态
// ============================================================================

let tokenState: TokenState = {
  current: null,
  lastRefresh: 0,
  failureCount: 0,
  refreshing: false,
};

// 自动续期定时器
let refreshTimer: ReturnType<typeof setInterval> | null = null;

// 令牌失效回调
let onTokenInvalidCallback: (() => void) | null = null;

// ============================================================================
// 令牌验证
// ============================================================================

/**
 * 验证令牌签名
 *
 * 签名内容格式（服务端新版）: tokenId|licenseKey|deviceId|issuedAt|expiresAt|features|skillKey
 * 签名内容格式（服务端旧版）: tokenId|licenseKey|deviceId|issuedAt|expiresAt|features
 * 兼容两种格式：有 skillKey 时追加，无则不追加。
 */
export function verifyTokenSignature(token: LicenseToken): boolean {
  try {
    // 构建签名内容（有 skillKey 时追加，保持与服务端一致）
    const parts = [
      token.tokenId,
      token.licenseKey,
      token.deviceId,
      token.issuedAt.toString(),
      token.expiresAt.toString(),
      token.allowedFeatures.join(","),
    ];
    if (token.skillKey) {
      parts.push(token.skillKey);
    }
    const signContent = parts.join("|");

    // 验证 RSA 签名
    const verifier = createVerify("RSA-SHA256");
    verifier.update(signContent);
    verifier.end();

    const isValid = verifier.verify(SERVER_PUBLIC_KEY, token.signature, "base64");

    if (!isValid) {
      log.warn("Token signature verification failed");
    }

    return isValid;
  } catch (error) {
    log.error(`Token signature verification error: ${error}`);
    return false;
  }
}

/**
 * 检查令牌是否有效
 *
 * @param token - 令牌
 * @param options - 检查选项
 */
export function isTokenValid(
  token: LicenseToken | null,
  options: { allowGracePeriod?: boolean } = {},
): boolean {
  if (!token) {
    return false;
  }

  // 使用校正后的时间判断过期
  const correctedNow = Date.now() + serverTimeDrift;

  // 检查是否过期
  if (correctedNow > token.expiresAt) {
    // 检查是否在离线宽限期内
    if (options.allowGracePeriod !== false) {
      const expiredDuration = correctedNow - token.expiresAt;
      if (expiredDuration < OFFLINE_GRACE_PERIOD_MS) {
        log.debug(
          `Token expired but within grace period (${Math.round(expiredDuration / 60000)} min)`,
        );
        return true; // 宽限期内，仍然有效
      }
    }

    log.debug("Token expired");
    return false;
  }

  // 检查设备 ID 是否匹配
  const currentDeviceId = getDeviceId();
  if (token.deviceId !== currentDeviceId) {
    log.warn("Token device ID mismatch");
    return false;
  }

  // 验证签名
  if (!verifyTokenSignature(token)) {
    return false;
  }

  return true;
}

/**
 * 检查令牌是否在宽限期内（已过期但仍可使用）
 */
export function isTokenInGracePeriod(): boolean {
  const token = tokenState.current;
  if (!token) {
    return false;
  }

  const correctedNow = Date.now() + serverTimeDrift;
  if (correctedNow <= token.expiresAt) {
    return false; // 未过期，不在宽限期
  }

  const expiredDuration = correctedNow - token.expiresAt;
  return expiredDuration < OFFLINE_GRACE_PERIOD_MS;
}

/**
 * 检查当前令牌是否有效
 */
export function hasValidToken(): boolean {
  return isTokenValid(tokenState.current);
}

/**
 * 获取当前令牌
 */
export function getCurrentToken(): LicenseToken | null {
  return tokenState.current;
}

/**
 * 获取令牌剩余有效时间（毫秒）
 */
export function getTokenRemainingMs(): number {
  if (!tokenState.current) {
    return 0;
  }
  return Math.max(0, tokenState.current.expiresAt - Date.now());
}

// ============================================================================
// 令牌获取与刷新
// ============================================================================

/**
 * 从服务端获取令牌
 *
 * 注意：令牌可以通过 /verify 接口一起返回，也可以单独调用 /token
 */
export async function fetchToken(licenseKey: string): Promise<TokenResponse> {
  const config = getLicenseConfig();
  const deviceId = getDeviceId();

  // 生成请求签名（/token 接口约定：HMAC 密钥使用 licenseKey 本身）
  const signParams = generateSignParams(licenseKey, deviceId, licenseKey);

  // 记录请求发送时间（用于计算时间差）
  const localSendTime = Date.now();

  try {
    const response = await fetch(`${config.apiBaseUrl}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        licenseKey,
        deviceId,
        clientVersion: VERSION,
        ...signParams,
      }),
      signal: AbortSignal.timeout(10000),
    });

    // 记录响应接收时间
    const localReceiveTime = Date.now();

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      log.error(`Token fetch failed: ${response.status} ${errorText}`);
      return {
        success: false,
        errorCode: response.status,
        errorMessage: `HTTP ${response.status}: ${errorText}`,
      };
    }

    // 服务端返回格式: { code, message, data: TokenResponse }
    const rawData = (await response.json()) as
      | { code?: number; message?: string; data?: TokenResponse }
      | TokenResponse;

    // 兼容两种格式：直接返回 TokenResponse 或包装在 data 字段中
    const data: TokenResponse =
      "data" in rawData && rawData.data ? rawData.data : (rawData as TokenResponse);

    if (data.success && data.token) {
      // 验证令牌签名
      if (!verifyTokenSignature(data.token)) {
        log.error("Token signature verification failed after fetch");
        return {
          success: false,
          errorCode: -1,
          errorMessage: "令牌签名验证失败",
        };
      }

      // 计算客户端与服务端的时间差
      // 估算网络延迟的一半作为单程延迟
      const networkDelay = (localReceiveTime - localSendTime) / 2;
      const estimatedServerTime = localSendTime + networkDelay;
      serverTimeDrift = data.token.issuedAt - estimatedServerTime;

      if (Math.abs(serverTimeDrift) > 60000) {
        log.warn(
          `Detected time drift: ${Math.round(serverTimeDrift / 1000)}s between client and server`,
        );
      }

      const expiresInMin = Math.round(
        (data.token.expiresAt - (Date.now() + serverTimeDrift)) / 60000,
      );
      log.info(`Token fetched successfully, expires in ${expiresInMin} minutes`);
    }

    return data;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error(`Token fetch error: ${errorMsg}`);
    return {
      success: false,
      errorCode: -1,
      errorMessage: errorMsg,
    };
  }
}

/**
 * 重试间隔（毫秒）
 * 第 1 次失败后等 1 分钟，第 2 次等 2 分钟，第 3 次等 5 分钟
 */
const RETRY_INTERVALS_MS = [60 * 1000, 2 * 60 * 1000, 5 * 60 * 1000];

/**
 * 下次重试时间
 */
let nextRetryTime = 0;

/**
 * 刷新令牌
 */
export async function refreshToken(licenseKey: string): Promise<boolean> {
  if (tokenState.refreshing) {
    log.debug("Token refresh already in progress");
    return false;
  }

  // 检查是否在重试冷却期
  if (tokenState.failureCount > 0 && Date.now() < nextRetryTime) {
    const waitSeconds = Math.round((nextRetryTime - Date.now()) / 1000);
    log.debug(`Token refresh in cooldown, wait ${waitSeconds}s`);
    return false;
  }

  tokenState.refreshing = true;

  try {
    const response = await fetchToken(licenseKey);

    if (response.success && response.token) {
      tokenState.current = response.token;
      tokenState.lastRefresh = Date.now();
      tokenState.failureCount = 0;
      nextRetryTime = 0;
      log.info("Token refreshed successfully");
      return true;
    } else {
      tokenState.failureCount++;

      // 计算下次重试时间
      const retryIndex = Math.min(tokenState.failureCount - 1, RETRY_INTERVALS_MS.length - 1);
      const retryInterval = RETRY_INTERVALS_MS[retryIndex];
      nextRetryTime = Date.now() + retryInterval;

      log.warn(
        `Token refresh failed (attempt ${tokenState.failureCount}), retry in ${retryInterval / 1000}s: ${response.errorMessage}`,
      );

      // 连续失败多次后，触发令牌失效回调
      if (tokenState.failureCount >= 3 && onTokenInvalidCallback) {
        log.error("Token refresh failed repeatedly, triggering invalid callback");
        onTokenInvalidCallback();
      }

      return false;
    }
  } finally {
    tokenState.refreshing = false;
  }
}

// ============================================================================
// 自动续期
// ============================================================================

/**
 * 启动令牌自动续期
 *
 * @param licenseKey - 授权码
 * @param options - 配置选项
 */
export function startTokenAutoRefresh(
  licenseKey: string,
  options: {
    /** 续期间隔（毫秒），默认 30 分钟 */
    intervalMs?: number;
    /** 令牌失效时的回调 */
    onInvalid?: () => void;
  } = {},
): void {
  stopTokenAutoRefresh();

  const intervalMs = options.intervalMs ?? 30 * 60 * 1000; // 默认 30 分钟
  onTokenInvalidCallback = options.onInvalid || null;

  log.info(`Starting token auto-refresh (interval: ${intervalMs / 60000} minutes)`);

  // 立即获取一次令牌
  refreshToken(licenseKey).catch((err) => {
    log.error(`Initial token fetch failed: ${err}`);
  });

  // 设置定期刷新
  refreshTimer = setInterval(() => {
    // 检查令牌是否即将过期（剩余时间少于 10 分钟）
    const remainingMs = getTokenRemainingMs();
    if (remainingMs < 10 * 60 * 1000) {
      log.debug("Token expiring soon, refreshing...");
      refreshToken(licenseKey).catch((err) => {
        log.error(`Token refresh failed: ${err}`);
      });
    }
  }, intervalMs);

  // 不阻止进程退出
  refreshTimer.unref();
}

/**
 * 停止令牌自动续期
 */
export function stopTokenAutoRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
    log.debug("Token auto-refresh stopped");
  }
  onTokenInvalidCallback = null;
}

/**
 * 清除当前令牌
 */
export function clearToken(): void {
  tokenState = {
    current: null,
    lastRefresh: 0,
    failureCount: 0,
    refreshing: false,
  };
  log.debug("Token cleared");
}

// ============================================================================
// 功能检查
// ============================================================================

/**
 * 检查令牌是否允许指定功能
 */
export function isFeatureAllowed(feature: string): boolean {
  const token = tokenState.current;

  if (!token) {
    return false;
  }

  if (!isTokenValid(token)) {
    return false;
  }

  // 检查功能列表
  // "*" 表示允许所有功能
  if (token.allowedFeatures.includes("*")) {
    return true;
  }

  return token.allowedFeatures.includes(feature);
}

/**
 * 获取令牌状态摘要
 */
export function getTokenStatusSummary(): {
  hasToken: boolean;
  isValid: boolean;
  expiresIn: number;
  failureCount: number;
} {
  return {
    hasToken: tokenState.current !== null,
    isValid: hasValidToken(),
    expiresIn: getTokenRemainingMs(),
    failureCount: tokenState.failureCount,
  };
}
