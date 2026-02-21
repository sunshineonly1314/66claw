/**
 * OpenClawCN Security Module - Content Vault
 * 内容保险库 — 本地机器绑定加密
 *
 * 密钥: 本地 deriveKey（SHA-256(MachineGuid|salt)）
 * 用途: config 字段加密（API Key 等 ENC{...} 格式）、通用内容加密
 *
 * 文件格式: [16 字节 IV] + [AES-256-CBC 密文]
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
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

/**
 * 加密字符串内容，返回 Buffer: [16 字节 IV] + [AES-256-CBC 密文]
 */
export function encryptContent(plaintext: string): Buffer {
  const key = deriveKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);

  const plaintextBuf = Buffer.from(plaintext, "utf-8");
  const encrypted = Buffer.concat([iv, cipher.update(plaintextBuf), cipher.final()]);

  wipeSensitiveBuffer(plaintextBuf);
  return encrypted;
}

/**
 * 解密 Buffer 内容，返回明文字符串。
 */
export function decryptContent(encrypted: Buffer): string {
  if (encrypted.length < 17) {
    throw new Error("Content vault: encrypted data too short (corrupted or not encrypted)");
  }

  const key = deriveKey();
  const iv = encrypted.subarray(0, 16);
  const data = encrypted.subarray(16);

  try {
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
 * 加密 config 字段（始终使用本地派生密钥）。
 * config 字段在引导阶段必须可解密，因此不能用服务端密钥。
 */
export function encryptConfigField(plaintext: string): Buffer {
  const key = deriveKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);

  const plaintextBuf = Buffer.from(plaintext, "utf-8");
  const encrypted = Buffer.concat([iv, cipher.update(plaintextBuf), cipher.final()]);

  wipeSensitiveBuffer(plaintextBuf);
  return encrypted;
}

/**
 * 解密 config 字段（使用本地派生密钥）。
 */
export function decryptConfigField(encrypted: Buffer): string {
  if (encrypted.length < 17) {
    throw new Error("Content vault: encrypted data too short (corrupted or not encrypted)");
  }

  const key = deriveKey();
  const iv = encrypted.subarray(0, 16);
  const data = encrypted.subarray(16);

  try {
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
