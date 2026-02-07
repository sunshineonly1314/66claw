/**
 * Clawdbot License Module - RSA Signature Verification
 * RSA 非对称签名验证
 *
 * 安全说明：
 * - 公钥可以安全地硬编码在客户端
 * - 私钥只存在服务端，用于签发许可证
 * - 即使攻击者获取公钥，也无法伪造有效签名
 *
 * 签名格式（与服务端约定）：
 * - 签名内容 = "valid|tier|expiresAt|serverTime"
 * - 使用固定字段顺序，避免 JSON 序列化差异
 * - 包含 serverTime 防止重放攻击
 */

import { createVerify } from "node:crypto";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("license:rsa");

/**
 * RSA 公钥（2048 位）
 *
 * 重要：
 * - 此公钥由服务端生成，私钥存在服务端环境变量 LICENSE_RSA_PRIVATE_KEY
 * - 更新公钥需要同时更新服务端私钥
 * - 公钥更新后，旧版本客户端将无法验证新签名
 *
 * 更新记录：
 * - 2026-02-03: 服务端正式上线 RSA 签名，更新为正式公钥
 */
const RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkDtHShdtjfCopovpCcIR
hiyFHopWsclr+7JQ+c4Iz2NIdWrCoAkSUTSp24fJXmVQh27m8Eq9JvGX/wMpQ8H6
++IpO06BXCyk1gYqf8Qqa6CdGMQ0aygCq6aTebQQqDBGICH7u985fkdTRDz62xyG
UbYKIJPZkRycZCGZ5pMvwhxKcSZ6ifpGuBhAlxLqHpax9sUgstWWBOMWEr7SpbL0
BE081ASxkXuQSSGDQFQzUZ98ZoVoYOmneIjU/6JHOAhLDA1R9qEy7KKpb3FV0DQm
PWgG9tgLZk1M7yp3xitO98ZrMtWLmNNPUtQvfM1vlvRI7It0BoGVnPq5P+9dvzmS
nQIDAQAB
-----END PUBLIC KEY-----`;

/**
 * 服务端时间允许的最大偏差（毫秒）
 * 用于防止重放攻击
 */
const MAX_SERVER_TIME_DRIFT_MS = 5 * 60 * 1000; // 5 分钟

/**
 * 验证 RSA 签名
 *
 * @param signContent - 签名内容字符串
 * @param signature - 服务端签发的签名（base64 编码）
 * @returns 签名是否有效
 */
export function verifyRsaSignature(signContent: string, signature: string): boolean {
  try {
    const verify = createVerify("SHA256");
    verify.update(signContent, "utf8");
    const isValid = verify.verify(RSA_PUBLIC_KEY, signature, "base64");

    if (isValid) {
      log.debug("RSA signature verification succeeded");
    } else {
      log.warn("RSA signature verification failed: invalid signature");
    }

    return isValid;
  } catch (error) {
    log.error(`RSA signature verification error: ${error}`);
    return false;
  }
}

/**
 * 标准化 expiresAt 格式
 *
 * 服务端返回的 expiresAt 可能不带 Z 后缀（如 2027-01-29T16:14:43）
 * 签名时需要统一加上 Z 后缀（如 2027-01-29T16:14:43Z）
 */
function normalizeExpiresAt(expiresAt: string | null): string {
  if (!expiresAt) {
    return "";
  }

  // 如果已经有 Z 后缀，直接返回
  if (expiresAt.endsWith("Z")) {
    return expiresAt;
  }

  // 添加 Z 后缀
  return `${expiresAt}Z`;
}

/**
 * 构建签名内容字符串（与服务端保持一致）
 *
 * 格式：valid|tier|expiresAt|serverTime
 *
 * @param valid - 是否有效
 * @param tier - 产品等级（验证失败时为 null）
 * @param expiresAt - 过期时间 ISO 字符串（验证失败时为 null）
 * @param serverTime - 服务器时间戳（毫秒）
 */
export function buildSignContent(
  valid: boolean,
  tier: string | null,
  expiresAt: string | null,
  serverTime: number,
): string {
  // 格式：valid|tier|expiresAt|serverTime
  // 如果 tier 或 expiresAt 为 null，使用空字符串
  // expiresAt 需要标准化（加 Z 后缀）
  return `${valid}|${tier ?? ""}|${normalizeExpiresAt(expiresAt)}|${serverTime}`;
}

/**
 * 验证 serverTime 是否在合理范围内（防重放攻击）
 *
 * @param serverTime - 服务器时间戳（毫秒）
 * @returns 是否在合理范围内
 */
export function verifyServerTime(serverTime: number): boolean {
  const now = Date.now();
  const drift = Math.abs(now - serverTime);

  if (drift > MAX_SERVER_TIME_DRIFT_MS) {
    log.warn(
      `Server time drift too large: ${drift}ms (max: ${MAX_SERVER_TIME_DRIFT_MS}ms)`,
    );
    return false;
  }

  return true;
}

/**
 * 验证许可证响应的签名
 *
 * @param valid - 是否有效
 * @param tier - 产品等级
 * @param expiresAt - 过期时间
 * @param serverTime - 服务器时间戳
 * @param signature - 服务端签发的签名
 * @returns 验证结果
 */
export function verifyLicenseResponseSignature(
  valid: boolean,
  tier: string | null,
  expiresAt: string | null,
  serverTime: number,
  signature: string,
): { valid: boolean; error?: string } {
  // 1. 验证 serverTime（防重放攻击）
  if (!verifyServerTime(serverTime)) {
    return {
      valid: false,
      error: "服务器时间偏差过大，可能是重放攻击",
    };
  }

  // 2. 构建签名内容
  const signContent = buildSignContent(valid, tier, expiresAt, serverTime);
  log.debug(`Verifying signature for content: ${signContent}`);

  // 3. 验证 RSA 签名
  const isSignatureValid = verifyRsaSignature(signContent, signature);
  if (!isSignatureValid) {
    return {
      valid: false,
      error: "RSA 签名验证失败",
    };
  }

  return { valid: true };
}

/**
 * 验证心跳响应的签名
 *
 * @param valid - 是否有效
 * @param daysRemaining - 剩余天数
 * @param serverTime - 服务器时间戳
 * @param signature - 服务端签发的签名
 * @returns 验证结果
 */
export function verifyHeartbeatResponseSignature(
  valid: boolean,
  daysRemaining: number,
  serverTime: number,
  signature: string,
): { valid: boolean; error?: string } {
  // 1. 验证 serverTime（防重放攻击）
  if (!verifyServerTime(serverTime)) {
    return {
      valid: false,
      error: "服务器时间偏差过大，可能是重放攻击",
    };
  }

  // 2. 构建签名内容：valid|daysRemaining|serverTime
  const signContent = `${valid}|${daysRemaining}|${serverTime}`;
  log.debug(`Verifying heartbeat signature for content: ${signContent}`);

  // 3. 验证 RSA 签名
  const isSignatureValid = verifyRsaSignature(signContent, signature);
  if (!isSignatureValid) {
    return {
      valid: false,
      error: "RSA 签名验证失败",
    };
  }

  return { valid: true };
}

/**
 * 检查 RSA 公钥是否已配置（非占位符）
 */
export function isRsaKeyConfigured(): boolean {
  // 检查是否包含正式公钥的特征
  // 正式公钥指纹：kDtHShdtjfCopovpCcIR
  return RSA_PUBLIC_KEY.includes("kDtHShdtjfCopovpCcIR");
}
