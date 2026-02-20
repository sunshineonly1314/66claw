/**
 * OpenClawCN Security Module - Content Vault (Machine-Bound Encryption)
 * 内容保险库 — 机器绑定加密
 *
 * 使用 AES-256-CBC 加密 skill/MCP 文件内容，密钥绑定当前机器。
 * 文件拷贝到其他机器后无法解密（等同文件损坏）。
 *
 * 文件格式: [16 字节 IV] + [AES-256-CBC 密文]
 * 密钥来源: SHA-256( MachineGuid + 硬编码盐 )
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { wipeSensitiveBuffer } from "./string-vault.js";

const log = createSubsystemLogger("security:content-vault");

// ============================================================================
// Machine ID
// ============================================================================

let cachedMachineId: string | null = null;

/**
 * 获取当前机器的唯一标识符。
 * - Windows: HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid
 * - macOS:   IOPlatformUUID
 * - Linux:   /etc/machine-id
 */
export function getMachineId(): string {
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
      const output = execSync(
        "ioreg -rd1 -c IOPlatformExpertDevice",
        { encoding: "utf-8", timeout: 5000 },
      );
      const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (match?.[1]) {
        id = match[1].trim();
      }
    } catch {
      log.warn("Failed to read macOS IOPlatformUUID");
    }
  } else {
    // Linux
    try {
      id = fs.readFileSync("/etc/machine-id", "utf-8").trim();
    } catch {
      log.warn("Failed to read /etc/machine-id");
    }
  }

  if (!id) {
    // 不再使用弱 fallback —— 如果无法获取真实机器 ID，
    // 生成随机 ID 并持久化到本地文件，确保不同机器产生不同密钥。
    const fallbackIdPath = (() => {
      const home = process.env.HOME || process.env.USERPROFILE || "";
      if (!home) return null;
      const configDir = `${home}/.openclawcn`;
      try {
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
      } catch { /* ignore */ }
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
        // ignore read errors
      }

      if (!id) {
        // 首次：生成密码学安全的随机 ID 并持久化
        id = randomBytes(32).toString("hex");
        try {
          fs.writeFileSync(fallbackIdPath, id, { encoding: "utf-8", mode: 0o600 });
          log.warn("Generated and persisted new fallback machine ID (platform ID unavailable)");
        } catch {
          log.warn("Generated fallback machine ID but could not persist it");
        }
      }
    } else {
      // 最后的兜底：随机 ID（每次进程重启都不同 — 故意如此，拒绝解密跨进程文件）
      id = randomBytes(32).toString("hex");
      log.warn("Using ephemeral random machine ID — encrypted files will NOT survive restart");
    }
  }

  cachedMachineId = id;
  return id;
}

// ============================================================================
// Key Derivation
// ============================================================================

const CONTENT_VAULT_SALT = "openclawcn-content-vault-v1-aes256";

let cachedKey: Buffer | null = null;

/**
 * 从机器 ID 派生 AES-256 密钥。
 * 密钥 = SHA-256( MachineGuid + 盐 )
 */
function deriveKey(): Buffer {
  if (cachedKey) return cachedKey;

  const machineId = getMachineId();
  const key = createHash("sha256")
    .update(`${machineId}|${CONTENT_VAULT_SALT}`)
    .digest();

  cachedKey = key;
  return key;
}

// ============================================================================
// Encrypt / Decrypt
// ============================================================================

/**
 * 加密字符串内容，返回 Buffer: [16 字节 IV] + [AES-256-CBC 密文]
 */
export function encryptContent(plaintext: string): Buffer {
  const key = deriveKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);

  const plaintextBuf = Buffer.from(plaintext, "utf-8");
  const encrypted = Buffer.concat([
    iv,
    cipher.update(plaintextBuf),
    cipher.final(),
  ]);

  // 清除明文 buffer
  wipeSensitiveBuffer(plaintextBuf);

  return encrypted;
}

/**
 * 解密 Buffer 内容，返回明文字符串。
 * 如果密钥不匹配（机器不同），会抛出异常。
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
    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]);

    const result = decrypted.toString("utf-8");
    wipeSensitiveBuffer(decrypted);
    return result;
  } catch (error) {
    throw new Error(
      "Content vault: decryption failed — file may be corrupted or from a different machine",
    );
  }
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * 加密文件：读取源文件明文 → 加密 → 写入目标路径。
 */
export function encryptFile(srcPath: string, destPath: string): void {
  const plaintext = fs.readFileSync(srcPath, "utf-8");
  const encrypted = encryptContent(plaintext);
  fs.writeFileSync(destPath, encrypted);
}

/**
 * 解密文件：读取加密文件 → 解密 → 返回明文字符串。
 * 密钥不匹配时抛出异常。
 */
export function decryptFile(encPath: string): string {
  const encrypted = fs.readFileSync(encPath);
  return decryptContent(encrypted);
}

// ============================================================================
// Directory Encryption (for bundled skills first-run)
// ============================================================================

/**
 * 确保目录下的 .md 文件已加密。
 * 遍历目录，将明文 .md 文件加密为 .md.enc，然后删除明文。
 *
 * 开发模式检测: 使用内部标志而非环境变量，防止攻击者通过
 * 设置 NODE_ENV=development 绕过加密。
 */
export function ensureDirectoryEncrypted(dir: string): void {
  if (!isEncryptionEnabled()) {
    return;
  }

  if (!fs.existsSync(dir)) return;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = `${dir}/${entry.name}`;

      if (entry.isDirectory()) {
        // 递归处理子目录
        ensureDirectoryEncrypted(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const encPath = `${fullPath}.enc`;

        // 如果已有 .enc 版本，跳过
        if (fs.existsSync(encPath)) continue;

        try {
          encryptFile(fullPath, encPath);
          fs.unlinkSync(fullPath);
          log.debug(`Encrypted: ${entry.name} → ${entry.name}.enc`);
        } catch (err) {
          log.warn(`Failed to encrypt ${fullPath}: ${err}`);
        }
      }
    }
  } catch (err) {
    log.warn(`Failed to encrypt directory ${dir}: ${err}`);
  }
}

/**
 * 内部开发模式标志 — 只能通过 setDevMode() 在进程初始化阶段设置。
 * 不再信任运行时环境变量（防止 NODE_ENV=development 注入绕过）。
 */
let devModeFlag = false;
let devModeLocked = false;

/**
 * 在进程启动的最早期阶段调用一次，之后锁定，不可再修改。
 * 应在 main/entrypoint 中调用，而非由用户可控的代码路径调用。
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
 * 优先使用锁定的 devModeFlag；如果从未调用 setContentVaultDevMode，
 * 则回退到环境变量检查（向后兼容，但不推荐）。
 */
export function isEncryptionEnabled(): boolean {
  if (devModeLocked) {
    return !devModeFlag;
  }
  // 向后兼容：如果调用方未调用 setContentVaultDevMode，仍检查环境变量
  return process.env.NODE_ENV !== "development" && process.env.CLAWDBOT_PROFILE !== "dev";
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * 清除缓存的密钥（进程退出时调用）
 */
export function destroyContentVault(): void {
  if (cachedKey) {
    wipeSensitiveBuffer(cachedKey);
    cachedKey = null;
  }
  cachedMachineId = null;
  log.debug("Content vault destroyed");
}
