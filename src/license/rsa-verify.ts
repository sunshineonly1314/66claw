/**
 * OpenClawCN License Module - RSA Signature Verification
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

import { createRequire } from "node:module";
import { createVerify } from "node:crypto";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("license:rsa");

// ============================================================================
// Native Addon Integration (Layer 3 — hardened C++ RSA verification)
// Prefer native implementation — compiled binary is 50x harder to reverse.
// Falls back to JS implementation if native addon is not available.
// ============================================================================

interface NativeAddon {
  verifySignature(signContent: string, signature: string): boolean;
  isRsaKeyConfigured(): boolean;
}

let nativeAddon: NativeAddon | null = null;
try {
  const esmRequire = createRequire(import.meta.url);
  nativeAddon = esmRequire("../../native/build/Release/openclawcn_native.node") as NativeAddon;
  if (typeof nativeAddon?.verifySignature === "function") {
    log.debug("Native RSA addon loaded — using hardened verification");
  } else {
    nativeAddon = null;
  }
} catch {
  log.debug("Native RSA addon not available, using JS fallback");
}

/**
 * RSA 公钥列表（2048 位）— 多公钥兜底机制
 *
 * 验证时按数组顺序依次尝试，任一公钥验过即通过。
 * 这样服务端切换密钥时，客户端不用同步发版。
 *
 * 重要：
 * - 公钥由服务端生成，私钥存在服务端环境变量 LICENSE_RSA_PRIVATE_KEY
 * - 新增公钥只需追加到数组，无需删除旧的（旧客户端仍需旧公钥）
 *
 * 更新记录：
 * - 2026-02-03: v1 公钥上线 (fingerprint: kDtHShdtjfCopovpCcIR)
 * - 2026-03-02: v2 公钥准备 (fingerprint: uB00UMEJdP/XxmCJ)，服务端尚未部署
 */
const RSA_PUBLIC_KEYS: string[] = [
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
  // Prefer native C++ verification (much harder to patch/bypass)
  // Note: native addon currently only has one key baked in. If it verifies, trust it.
  // If it fails, fall through to JS multi-key verification.
  if (nativeAddon) {
    try {
      const isValid = nativeAddon.verifySignature(signContent, signature);
      if (isValid) {
        log.debug("RSA signature verification succeeded (native)");
        return true;
      }
      // Native failed — don't return false yet, try JS multi-key fallback
      log.debug("Native RSA verification failed, trying JS multi-key fallback");
    } catch (error) {
      log.debug(`Native RSA verification error, falling back to JS: ${error}`);
    }
  }

  // JS multi-key fallback: try each public key in order, first match wins.
  // This allows seamless server-side key rotation without client releases.
  for (let i = 0; i < RSA_PUBLIC_KEYS.length; i++) {
    try {
      const verify = createVerify("SHA256");
      verify.update(signContent, "utf8");
      const isValid = verify.verify(RSA_PUBLIC_KEYS[i], signature, "base64");
      if (isValid) {
        log.debug(`RSA signature verification succeeded (JS, key index ${i})`);
        return true;
      }
    } catch (error) {
      log.debug(`RSA verification error with key index ${i}: ${error}`);
    }
  }

  log.warn("RSA signature verification failed: no key matched (JS)");
  return false;
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
    log.warn(`Server time drift too large: ${drift}ms (max: ${MAX_SERVER_TIME_DRIFT_MS}ms)`);
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
 * [改造5] 签名内容扩展为：valid|daysRemaining|serverTime|tierLimit|revoked
 * tierLimit 和 revoked 必须纳入签名，否则本地代理可直接删除这两个字段绕过降级。
 * 服务端签名时必须使用相同格式，字段缺失时用空字符串/false 占位。
 *
 * @param valid - 是否有效
 * @param daysRemaining - 剩余天数
 * @param serverTime - 服务器时间戳
 * @param signature - 服务端签发的签名
 * @param tierLimit - 服务端强制功能降级（""=无限制，"basic"=降为基础版）
 * @param revoked - 是否已吊销
 * @returns 验证结果
 */
export function verifyHeartbeatResponseSignature(
  valid: boolean,
  daysRemaining: number,
  serverTime: number,
  signature: string,
  tierLimit?: string,
  revoked?: boolean,
): { valid: boolean; error?: string } {
  // 1. 验证 serverTime（防重放攻击）
  if (!verifyServerTime(serverTime)) {
    return {
      valid: false,
      error: "服务器时间偏差过大，可能是重放攻击",
    };
  }

  // 2. 构建签名内容：valid|daysRemaining|serverTime|tierLimit|revoked
  // tierLimit 缺失时用 "" 占位；revoked 缺失时用 "false" 占位
  const signContent = `${valid}|${daysRemaining}|${serverTime}|${tierLimit ?? ""}|${revoked ?? false}`;
  log.debug(`Verifying heartbeat signature for content: ${signContent}`);

  // 3. 验证 RSA 签名（优先新格式）
  if (verifyRsaSignature(signContent, signature)) {
    return { valid: true };
  }

  // 3b. 向后兼容：服务端尚未升级时，tierLimit/revoked 均缺失，尝试旧格式
  //     旧格式：valid|daysRemaining|serverTime（无 tierLimit/revoked 字段）
  //     只有当两个字段都未设置时才允许降级，防止服务端故意删字段绕过降级
  if (tierLimit === undefined && revoked === undefined) {
    const oldSignContent = `${valid}|${daysRemaining}|${serverTime}`;
    log.debug(`New-format verification failed, trying old heartbeat format: ${oldSignContent}`);
    if (verifyRsaSignature(oldSignContent, signature)) {
      log.debug("Heartbeat verified with old signature format (server upgrade pending)");
      return { valid: true };
    }
  }

  return {
    valid: false,
    error: "RSA 签名验证失败",
  };
}

/**
 * 检查 RSA 公钥是否已配置（非占位符）
 */
export function isRsaKeyConfigured(): boolean {
  // 检查公钥列表中是否包含任一正式公钥的特征指纹
  const knownFingerprints = ["kDtHShdtjfCopovpCcIR", "uB00UMEJdP/XxmCJ"];
  return RSA_PUBLIC_KEYS.some((key) => knownFingerprints.some((fp) => key.includes(fp)));
}
