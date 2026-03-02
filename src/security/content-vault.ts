/**
 * OpenClawCN Security Module - Content Vault
 * 内容保险库 — 本地机器绑定加密
 *
 * 密钥: 本地 deriveKey（SHA-256(MachineGuid|salt)）
 * 用途: config 字段加密（API Key 等 ENC{...} 格式）、通用内容加密
 *
 * 文件格式（v2, GCM）: [0x02] [12 字节 nonce] [16 字节 authTag] + [AES-256-GCM 密文]
 * 兼容旧格式（v1, CBC）: [16 字节 IV] + [AES-256-CBC 密文]
 */

import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  type CipherGCM,
  type DecipherGCM,
} from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { wipeSensitiveBuffer } from "./string-vault.js";

const log = createSubsystemLogger("security:content-vault");

// ============================================================================
// Local machine-bound key derivation
// ============================================================================

let cachedMachineId: string | null = null;

/**
 * 获取当前机器的唯一标识符。
 * - Windows: HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid
 * - macOS:   IOPlatformUUID
 * - Linux:   /etc/machine-id
 */
function getMachineId(): string {
  if (cachedMachineId) return cachedMachineId;

  let id: string | null = null;

  if (process.platform === "win32") {
    try {
      const output = execSync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
        { encoding: "utf-8", timeout: 5000, windowsHide: true },
      );
      const match = output.match(/MachineGuid\s+REG_SZ\s+(.+)/);
      if (match?.[1]) {
        id = match[1].trim();
      }
    } catch {
      log.warn("Failed to read Windows MachineGuid from registry");
    }
  } else if (process.platform === "darwin") {
    try {
      const output = execSync("ioreg -rd1 -c IOPlatformExpertDevice", {
        encoding: "utf-8",
        timeout: 5000,
      });
      const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (match?.[1]) {
        id = match[1].trim();
      }
    } catch {
      log.warn("Failed to read macOS IOPlatformUUID");
    }
  } else {
    try {
      id = fs.readFileSync("/etc/machine-id", "utf-8").trim();
    } catch {
      log.warn("Failed to read /etc/machine-id");
    }
  }

  if (!id) {
    const fallbackIdPath = (() => {
      const home = process.env.HOME || process.env.USERPROFILE || "";
      if (!home) return null;
      const configDir = `${home}/.openclawcn`;
      try {
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
      } catch {
        /* ignore */
      }
      return `${configDir}/.machine-vault-id`;
    })();

    if (fallbackIdPath) {
      try {
        if (fs.existsSync(fallbackIdPath)) {
          const stored = fs.readFileSync(fallbackIdPath, "utf-8").trim();
          if (stored.length >= 32) {
            id = stored;
            log.debug("Using persisted fallback machine ID");
          }
        }
      } catch {
        /* ignore read errors */
      }

      if (!id) {
        id = randomBytes(32).toString("hex");
        try {
          fs.writeFileSync(fallbackIdPath, id, { encoding: "utf-8", mode: 0o600 });
          log.warn("Generated and persisted new fallback machine ID (platform ID unavailable)");
        } catch {
          log.warn("Generated fallback machine ID but could not persist it");
        }
      }
    } else {
      id = randomBytes(32).toString("hex");
      log.warn("Using ephemeral random machine ID — encrypted files will NOT survive restart");
    }
  }

  cachedMachineId = id;
  return id;
}

const CONTENT_VAULT_SALT = "openclawcn-content-vault-v1-aes256";

let cachedLocalKey: Buffer | null = null;

/**
 * 从机器 ID 派生 AES-256 密钥。
 * 密钥 = SHA-256( MachineGuid + "|" + salt )
 */
function deriveKey(): Buffer {
  if (cachedLocalKey) return cachedLocalKey;

  const machineId = getMachineId();
  const key = createHash("sha256").update(`${machineId}|${CONTENT_VAULT_SALT}`).digest();

  cachedLocalKey = key;
  return key;
}

// ============================================================================
// Encrypt / Decrypt (统一使用本地派生密钥)
// ============================================================================

// [MED FIX] 版本标记：区分 CBC（旧格式）和 GCM（新格式）
// GCM 格式: [0x02] [12 字节 nonce] [16 字节 authTag] [密文]
// CBC 格式（旧，兼容解密）: [16 字节 IV] [密文] （无版本标记）
const VAULT_VERSION_GCM = 0x02;
const GCM_NONCE_LEN = 12;
const GCM_TAG_LEN = 16;

/**
 * 加密字符串内容，返回 Buffer（AES-256-GCM 认证加密）。
 *
 * [MED FIX] 从 CBC 升级到 GCM：
 * - CBC 无认证，攻击者可修改密文而不被检测（bit-flip / padding oracle）
 * - GCM 提供 AEAD，密文任何修改都会导致解密失败
 */
export function encryptContent(plaintext: string): Buffer {
  const key = deriveKey();
  const nonce = randomBytes(GCM_NONCE_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, nonce) as CipherGCM;

  const plaintextBuf = Buffer.from(plaintext, "utf-8");
  const ciphertext = Buffer.concat([cipher.update(plaintextBuf), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // 格式: [version=0x02] [12B nonce] [16B authTag] [ciphertext]
  const result = Buffer.concat([Buffer.from([VAULT_VERSION_GCM]), nonce, authTag, ciphertext]);

  wipeSensitiveBuffer(plaintextBuf);
  return result;
}

/**
 * 解密 Buffer 内容，返回明文字符串。
 * 自动兼容 CBC 旧格式和 GCM 新格式。
 */
export function decryptContent(encrypted: Buffer): string {
  if (encrypted.length < 17) {
    throw new Error("Content vault: encrypted data too short (corrupted or not encrypted)");
  }

  const key = deriveKey();

  try {
    // 检测格式版本
    if (
      encrypted[0] === VAULT_VERSION_GCM &&
      encrypted.length >= 1 + GCM_NONCE_LEN + GCM_TAG_LEN + 1
    ) {
      // GCM 格式: [0x02] [12B nonce] [16B authTag] [ciphertext]
      const nonce = encrypted.subarray(1, 1 + GCM_NONCE_LEN);
      const authTag = encrypted.subarray(1 + GCM_NONCE_LEN, 1 + GCM_NONCE_LEN + GCM_TAG_LEN);
      const data = encrypted.subarray(1 + GCM_NONCE_LEN + GCM_TAG_LEN);

      const decipher = createDecipheriv("aes-256-gcm", key, nonce) as DecipherGCM;
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

      const result = decrypted.toString("utf-8");
      wipeSensitiveBuffer(decrypted);
      return result;
    }

    // 旧 CBC 格式兼容: [16B IV] [ciphertext]
    const iv = encrypted.subarray(0, 16);
    const data = encrypted.subarray(16);
    const decipher = createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

    const result = decrypted.toString("utf-8");
    wipeSensitiveBuffer(decrypted);
    return result;
  } catch {
    throw new Error("Content vault: decryption failed — wrong key or corrupted data");
  }
}

// ============================================================================
// Config-field encryption (always uses local key)
// ============================================================================

/**
 * 加密 config 字段（始终使用本地派生密钥，AES-256-GCM）。
 * config 字段在引导阶段必须可解密，因此不能用服务端密钥。
 */
export function encryptConfigField(plaintext: string): Buffer {
  const key = deriveKey();
  const nonce = randomBytes(GCM_NONCE_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, nonce) as CipherGCM;

  const plaintextBuf = Buffer.from(plaintext, "utf-8");
  const ciphertext = Buffer.concat([cipher.update(plaintextBuf), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const result = Buffer.concat([Buffer.from([VAULT_VERSION_GCM]), nonce, authTag, ciphertext]);

  wipeSensitiveBuffer(plaintextBuf);
  return result;
}

/**
 * 解密 config 字段（使用本地派生密钥）。
 * 自动兼容 CBC 旧格式和 GCM 新格式。
 */
export function decryptConfigField(encrypted: Buffer): string {
  if (encrypted.length < 17) {
    throw new Error("Content vault: encrypted data too short (corrupted or not encrypted)");
  }

  const key = deriveKey();

  try {
    // GCM 格式
    if (
      encrypted[0] === VAULT_VERSION_GCM &&
      encrypted.length >= 1 + GCM_NONCE_LEN + GCM_TAG_LEN + 1
    ) {
      const nonce = encrypted.subarray(1, 1 + GCM_NONCE_LEN);
      const authTag = encrypted.subarray(1 + GCM_NONCE_LEN, 1 + GCM_NONCE_LEN + GCM_TAG_LEN);
      const data = encrypted.subarray(1 + GCM_NONCE_LEN + GCM_TAG_LEN);

      const decipher = createDecipheriv("aes-256-gcm", key, nonce) as DecipherGCM;
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

      const result = decrypted.toString("utf-8");
      wipeSensitiveBuffer(decrypted);
      return result;
    }

    // 旧 CBC 格式兼容
    const iv = encrypted.subarray(0, 16);
    const data = encrypted.subarray(16);
    const decipher = createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

    const result = decrypted.toString("utf-8");
    wipeSensitiveBuffer(decrypted);
    return result;
  } catch {
    throw new Error(
      "Content vault: config field decryption failed — wrong machine or corrupted data",
    );
  }
}

// ============================================================================
// Dev mode
// ============================================================================

let devModeFlag = false;
let devModeLocked = false;

/**
 * 在进程启动的最早期阶段调用一次，之后锁定，不可再修改。
 */
export function setContentVaultDevMode(isDev: boolean): void {
  if (devModeLocked) {
    log.warn("Attempted to change content-vault dev mode after lock — ignored");
    return;
  }
  devModeFlag = isDev;
  devModeLocked = true;
  if (isDev) {
    log.warn("Content vault dev mode ENABLED — encryption will be skipped");
  }
}

/**
 * 检查是否为加密环境。
 * 未锁定时默认启用（安全侧失败），不读取环境变量。
 */
export function isEncryptionEnabled(): boolean {
  if (devModeLocked) {
    return !devModeFlag;
  }
  // 未锁定（单元测试等场景）：默认加密启用，不信任外部环境变量。
  return true;
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * 清除所有缓存的密钥（进程退出时调用）
 */
export function destroyContentVault(): void {
  if (cachedLocalKey) {
    wipeSensitiveBuffer(cachedLocalKey);
    cachedLocalKey = null;
  }
  cachedMachineId = null;
  log.debug("Content vault destroyed");
}
