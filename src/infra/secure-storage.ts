/**
 * 安全存储模块 - 凭据加密存储
 * Secure Storage Module - Encrypted Credential Storage
 *
 * 使用 AES-256-GCM 加密敏感数据
 * 机器密钥存储在本地文件系统 (chmod 0600)
 *
 * 安全特性:
 * - AES-256-GCM 加密（认证加密）
 * - 每次加密使用随机 IV
 * - GCM 认证标签防篡改
 * - 机器密钥文件权限限制 (0600)
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ============================================================================
// 常量定义
// ============================================================================

const ALGORITHM = "aes-256-gcm" as const;
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

// 机器密钥存储路径
const getMasterKeyPath = (): string => {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, ".openclawcn");
  return path.join(configDir, ".master-key");
};

// ============================================================================
// 密钥管理
// ============================================================================

/**
 * 获取或创建主加密密钥
 * 密钥存储在 ~/.openclawcn/.master-key (chmod 0600)
 */
async function getOrCreateMasterKey(): Promise<Buffer> {
  const keyPath = getMasterKeyPath();
  const keyDir = path.dirname(keyPath);

  // 确保目录存在
  if (!fs.existsSync(keyDir)) {
    fs.mkdirSync(keyDir, { recursive: true, mode: 0o700 });
  }

  // 如果密钥已存在，读取它
  if (fs.existsSync(keyPath)) {
    try {
      const key = fs.readFileSync(keyPath);
      if (key.length === KEY_LENGTH) {
        return key;
      }
      // 密钥长度不正确，重新生成
      console.warn("[secure-storage] 主密钥长度不正确，重新生成");
    } catch (error) {
      console.error("[secure-storage] 读取主密钥失败:", error);
    }
  }

  // 生成新密钥
  const newKey = crypto.randomBytes(KEY_LENGTH);

  // 保存密钥（权限 0600）
  fs.writeFileSync(keyPath, newKey, { mode: 0o600 });

  // 确认权限设置（Windows 上可能无效，但不影响功能）
  try {
    fs.chmodSync(keyPath, 0o600);
  } catch {
    // Windows 上 chmod 可能失败，忽略错误
  }

  console.log(`[secure-storage] 已生成新的主加密密钥: ${keyPath}`);
  return newKey;
}

// ============================================================================
// 加密/解密
// ============================================================================

/**
 * 加密数据
 *
 * @param plaintext - 明文字符串
 * @returns 加密后的对象 { encrypted, iv, authTag }
 */
export async function encrypt(plaintext: string): Promise<{
  encrypted: string;
  iv: string;
  authTag: string;
}> {
  const key = await getOrCreateMasterKey();

  // 生成随机 IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // 创建加密器
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // 加密数据
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  // 获取认证标签
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/**
 * 解密数据
 *
 * @param params - 加密的数据对象
 * @param params.encrypted - 加密的数据 (base64)
 * @param params.iv - 初始化向量 (base64)
 * @param params.authTag - 认证标签 (base64)
 * @returns 解密后的明文
 * @throws 如果认证失败或解密失败
 */
export async function decrypt(params: {
  encrypted: string;
  iv: string;
  authTag: string;
}): Promise<string> {
  const key = await getOrCreateMasterKey();

  const { encrypted, iv, authTag } = params;

  // 创建解密器
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64"));

  // 设置认证标签
  decipher.setAuthTag(Buffer.from(authTag, "base64"));

  // 解密数据
  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// ============================================================================
// JSON 存储
// ============================================================================

/**
 * 保存加密的 JSON 数据
 *
 * @param filepath - 文件路径
 * @param data - 要保存的数据对象
 */
export async function saveSecureJson(filepath: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const { encrypted, iv, authTag } = await encrypt(json);

  const payload = {
    version: 1,
    encrypted,
    iv,
    authTag,
  };

  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  fs.writeFileSync(filepath, JSON.stringify(payload, null, 2) + "\n", { mode: 0o600 });

  // 确认权限
  try {
    fs.chmodSync(filepath, 0o600);
  } catch {
    // Windows 上可能失败，忽略
  }
}

/**
 * 加载加密的 JSON 数据
 *
 * @param filepath - 文件路径
 * @returns 解密后的数据对象，如果文件不存在返回 null
 */
export async function loadSecureJson(filepath: string): Promise<unknown> {
  if (!fs.existsSync(filepath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filepath, "utf8");
    const payload = JSON.parse(raw) as {
      version: number;
      encrypted: string;
      iv: string;
      authTag: string;
    };

    if (payload.version !== 1) {
      throw new Error(`不支持的加密版本: ${payload.version}`);
    }

    const decrypted = await decrypt({
      encrypted: payload.encrypted,
      iv: payload.iv,
      authTag: payload.authTag,
    });

    return JSON.parse(decrypted) as unknown;
  } catch (error) {
    console.error(`[secure-storage] 加载加密文件失败 (${filepath}):`, error);
    throw error;
  }
}

// ============================================================================
// 迁移工具
// ============================================================================

/**
 * 检查文件是否已加密
 */
export function isEncrypted(filepath: string): boolean {
  if (!fs.existsSync(filepath)) {
    return false;
  }

  try {
    const raw = fs.readFileSync(filepath, "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;

    // 检查是否包含加密标识
    return (
      typeof data.version === "number" &&
      typeof data.encrypted === "string" &&
      typeof data.iv === "string" &&
      typeof data.authTag === "string"
    );
  } catch {
    return false;
  }
}

/**
 * 从明文 JSON 迁移到加密存储
 *
 * @param filepath - 文件路径
 * @param backupSuffix - 备份文件后缀 (默认 ".backup")
 * @returns 是否成功迁移
 */
export async function migrateToEncrypted(
  filepath: string,
  backupSuffix = ".backup",
): Promise<boolean> {
  if (!fs.existsSync(filepath)) {
    return false;
  }

  // 检查是否已加密
  if (isEncrypted(filepath)) {
    console.log(`[secure-storage] 文件已加密，跳过迁移: ${filepath}`);
    return true;
  }

  try {
    // 读取明文数据
    const raw = fs.readFileSync(filepath, "utf8");
    const data = JSON.parse(raw) as unknown;

    // 备份原文件
    const backupPath = filepath + backupSuffix;
    fs.copyFileSync(filepath, backupPath);
    fs.chmodSync(backupPath, 0o600);

    console.log(`[secure-storage] 已备份原文件: ${backupPath}`);

    // 保存加密版本
    await saveSecureJson(filepath, data);

    console.log(`[secure-storage] ✅ 成功迁移到加密存储: ${filepath}`);
    return true;
  } catch (error) {
    console.error(`[secure-storage] 迁移失败 (${filepath}):`, error);
    return false;
  }
}

/**
 * 从加密存储回滚到明文 JSON (用于降级/调试)
 *
 * **警告**: 这会将敏感数据以明文形式存储！
 *
 * @param filepath - 文件路径
 * @param backupSuffix - 备份加密文件后缀
 * @returns 是否成功回滚
 */
export async function rollbackToPlaintext(
  filepath: string,
  backupSuffix = ".encrypted.backup",
): Promise<boolean> {
  if (!fs.existsSync(filepath)) {
    return false;
  }

  if (!isEncrypted(filepath)) {
    console.log(`[secure-storage] 文件未加密，无需回滚: ${filepath}`);
    return true;
  }

  try {
    // 解密数据
    const data = await loadSecureJson(filepath);

    // 备份加密文件
    const backupPath = filepath + backupSuffix;
    fs.copyFileSync(filepath, backupPath);
    console.log(`[secure-storage] 已备份加密文件: ${backupPath}`);

    // 保存明文版本
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });

    console.warn(`[secure-storage] ⚠️ 已回滚到明文存储: ${filepath}`);
    return true;
  } catch (error) {
    console.error(`[secure-storage] 回滚失败 (${filepath}):`, error);
    return false;
  }
}
