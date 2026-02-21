/**
 * OpenClawCN License Module - Request Signing
 * 请求签名生成
 *
 * 算法: HMAC-SHA256
 * 格式: key|deviceId|timestamp|nonce
 *
 * Note: generateSign/generateSignParams 用于网络请求签名，
 * 必须与服务端保持一致，因此直接使用原始 secretKey 作为 HMAC 密钥。
 *
 * deriveKey() 是 HKDF 密钥派生工具，仅用于本地场景（如 cache HMAC），
 * 不影响网络协议。等服务端升级支持 HKDF 后，可切换 generateSign 使用派生密钥。
 */

import crypto from "node:crypto";

/** HKDF salt — fixed, public value for domain separation */
const HKDF_SALT = Buffer.from("openclawcn-license-v1", "utf8");

/**
 * Derive a sub-key from a raw secret using HKDF-SHA256.
 *
 * Currently used for local-only key derivation (e.g. cache HMAC in offline.ts).
 * NOT used for network request signing — that still uses the raw key for
 * server compatibility. Switch generateSign() to use this after server-side
 * HKDF adoption.
 *
 * @param secret - Raw secret material (e.g. licenseKey)
 * @param info - Domain-specific context string (e.g. "cache-hmac|<machine>")
 * @param lengthBytes - Desired output key length in bytes (default: 32)
 * @returns Derived key as a Buffer
 */
export function deriveKey(secret: string, info: string, lengthBytes: number = 32): Buffer {
  return Buffer.from(crypto.hkdfSync("sha256", secret, HKDF_SALT, info, lengthBytes));
}

/**
 * 生成 16 位随机 nonce
 */
export function generateNonce(): string {
  return crypto.randomUUID().replace(/-/g, "").substring(0, 16);
}

/**
 * 获取当前毫秒时间戳
 */
export function getTimestamp(): number {
  return Date.now();
}

/**
 * 生成请求签名
 *
 * @param key - 授权码
 * @param deviceId - 设备ID
 * @param timestamp - 毫秒时间戳
 * @param nonce - 随机字符串
 * @param secretKey - 签名密钥（直接用作 HMAC key，与服务端保持一致）
 * @returns HMAC-SHA256 签名（hex 格式）
 */
export function generateSign(
  key: string,
  deviceId: string,
  timestamp: number,
  nonce: string,
  secretKey: string,
): string {
  const data = `${key}|${deviceId}|${timestamp}|${nonce}`;

  const signature = crypto.createHmac("sha256", secretKey).update(data, "utf8").digest("hex");

  return signature;
}

/**
 * 生成带签名的请求参数
 *
 * @param key - 授权码
 * @param deviceId - 设备ID
 * @param secretKey - 签名密钥
 * @returns 签名参数对象
 */
export function generateSignParams(
  key: string,
  deviceId: string,
  secretKey: string,
): { timestamp: number; nonce: string; sign: string } {
  const timestamp = getTimestamp();
  const nonce = generateNonce();
  const sign = generateSign(key, deviceId, timestamp, nonce, secretKey);

  return { timestamp, nonce, sign };
}

/**
 * 验证签名是否正确（用于测试）
 */
export function verifySign(
  key: string,
  deviceId: string,
  timestamp: number,
  nonce: string,
  sign: string,
  secretKey: string,
): boolean {
  const expectedSign = generateSign(key, deviceId, timestamp, nonce, secretKey);
  // Use timing-safe comparison to prevent timing attacks
  const a = Buffer.from(sign, "hex");
  const b = Buffer.from(expectedSign, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
