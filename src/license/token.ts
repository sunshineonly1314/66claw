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
 * 服务端 RSA 公钥列表 — 多公钥兜底机制（与 rsa-verify.ts 保持一致）
 * 复用现有的 RSA 密钥对（与 /verify 接口相同）
 * 私钥在服务端：backend/src/main/resources/keys/private_key.pem
 *
 * 验证时按数组顺序依次尝试，任一公钥验过即通过。
 * 服务端切换密钥时客户端不用同步发版。
 */
const SERVER_PUBLIC_KEYS: string[] = [
  // v2 — 新密钥（预留，服务端部署后自动生效）
  `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuB00UMEJdP/XxmCJDGC5
x7DsZEJpWG2Gx+p8RmkMsoPh/eiWcwkSrO62Ijg3jrOO5i8UnZGzM1jzDEBdB8Gs
g0ADa9LkRHdNTSYpxE2hCyvvSMLfYX4i1yp0ucFO0PTmECMXSTg0/pxTPpI1GwGK
6rqH/3HjytryUlfAI4eRMmn1c2zQimXi49CgXzTMDOY8oTTaqeD7XQtAVCklO1pg
j0FDTjxSFGC9xnXU5ooW9IQXjyW3jZZLbxbgd8elGJD1EUYrHFa1xYF8r5yUr7GA
moWQ5xD2iEun3ykFZZ1pYso9ybBpPXXp8mIxD5+/JGaYirHpH/7JjKs5aTOCDaOZ
AQIDAQAB
-----END PUBLIC KEY-----`,
  // v1 — 旧密钥（当前线上使用，v1-2026-02）
  `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkDtHShdtjfCopovpCcIR
hiyFHopWsclr+7JQ+c4Iz2NIdWrCoAkSUTSp24fJXmVQh27m8Eq9JvGX/wMpQ8H6
++IpO06BXCyk1gYqf8Qqa6CdGMQ0aygCq6aTebQQqDBGICH7u985fkdTRDz62xyG
UbYKIJPZkRycZCGZ5pMvwhxKcSZ6ifpGuBhAlxLqHpax9sUgstWWBOMWEr7SpbL0
BE081ASxkXuQSSGDQFQzUZ98ZoVoYOmneIjU/6JHOAhLDA1R9qEy7KKpb3FV0DQm
PWgG9tgLZk1M7yp3xitO98ZrMtWLmNNPUtQvfM1vlvRI7It0BoGVnPq5P+9dvzmS
nQIDAQAB
-----END PUBLIC KEY-----`,
];

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

// [改造5] 服务端强制功能降级（来自心跳响应的 tierLimit 字段，包含在 RSA 签名内）
// _serverTierLimitKey: 记录 tierLimit 对应的 licenseKey，防止切换 key 时状态残留
let _serverTierLimit = "";
let _serverTierLimitKey = "";

/**
 * 设置服务端强制降级（心跳响应或 feature-token 签发时更新）
 * @param tierLimit - ""=无限制，"basic"=强制降为基础版
 * @param licenseKey - 对应的 licenseKey（用于防止切换 key 时状态残留）
 */
export function setServerTierLimit(tierLimit: string, licenseKey?: string): void {
  _serverTierLimit = tierLimit;
  _serverTierLimitKey = licenseKey ?? tokenState.current?.licenseKey ?? "";
  if (tierLimit) {
    log.debug(
      `Server tierLimit applied: "${tierLimit}" for key ${_serverTierLimitKey.substring(0, 8)}...`,
    );
  }
}

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

    // 验证 RSA 签名 — 多公钥兜底，任一验过即通过
    for (let i = 0; i < SERVER_PUBLIC_KEYS.length; i++) {
      try {
        const verifier = createVerify("RSA-SHA256");
        verifier.update(signContent);
        verifier.end();
        if (verifier.verify(SERVER_PUBLIC_KEYS[i], token.signature, "base64")) {
          return true;
        }
      } catch {
        // try next key
      }
    }

    log.warn("Token signature verification failed (no key matched)");
    return false;
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
 * 高价值功能列表（不允许离线降级，必须有有效令牌）
 *
 * 产品侧确认：这些功能是商业差异化核心，断网令牌过期后直接锁定。
 * 基础对话等功能不在此列，允许降级到本地缓存（8h 宽限期内可用）。
 *
 * 定义已迁移到 src/shared/tier-config.ts（SSOT），此处 import + re-export 保持兼容。
 */
import { HIGH_VALUE_FEATURES } from "../shared/tier-config.js";
export { HIGH_VALUE_FEATURES };

/**
 * 检查令牌是否允许指定功能
 *
 * [改造4] 分级逻辑在 license-check.ts 的 hasLicenseFeature 中实现，
 * 本函数只做令牌内功能检查 + tierLimit 降级。
 */
export function isFeatureAllowed(feature: string): boolean {
  const token = tokenState.current;

  if (!token) {
    return false;
  }

  if (!isTokenValid(token)) {
    return false;
  }

  // [改造5] 服务端 tierLimit：强制降为 basic 时，高价值功能一律拒绝
  // 只有 tierLimit 对应的 key 与当前 token 的 key 一致时才生效，防止切换 key 后残留旧 limit
  const tierLimitActive =
    _serverTierLimit === "basic" &&
    (_serverTierLimitKey === "" || _serverTierLimitKey === token.licenseKey);
  if (tierLimitActive && HIGH_VALUE_FEATURES.has(feature)) {
    log.debug(`Feature "${feature}" denied: server tierLimit=basic`);
    return false;
  }

  // 检查功能列表（"*" 表示允许所有功能）
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
