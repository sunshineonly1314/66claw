/**
 * OpenClawCN License Module - Request Signing
 * 请求签名生成
 *
 * 算法: HMAC-SHA256
 * 格式: key|deviceId|timestamp|nonce
 */

import crypto from "node:crypto";

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
 * @param secretKey - 签名密钥
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
  return sign === expectedSign;
}
