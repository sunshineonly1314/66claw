/**
 * 认证凭据加密迁移工具
 * Authentication Credential Encryption Migration Tool
 *
 * 将现有的明文凭据迁移到加密存储
 */

import fs from "node:fs";
import { resolveAuthStorePath } from "./paths.js";
import {
  isEncrypted,
  migrateToEncrypted,
  loadSecureJson,
  saveSecureJson,
} from "../../infra/secure-storage.js";
import type { AuthProfileStore } from "./types.js";

// ============================================================================
// 迁移函数
// ============================================================================

/**
 * 检查认证存储是否已加密
 */
export function isAuthStoreEncrypted(agentDir?: string): boolean {
  const authPath = resolveAuthStorePath(agentDir);
  return isEncrypted(authPath);
}

/**
 * 迁移认证存储到加密格式
 *
 * @param agentDir - Agent 目录路径
 * @param dryRun - 是否只检查不执行（默认 false）
 * @returns 迁移结果
 */
export async function migrateAuthStoreToEncrypted(
  agentDir?: string,
  dryRun = false,
): Promise<{
  success: boolean;
  alreadyEncrypted: boolean;
  error?: string;
}> {
  const authPath = resolveAuthStorePath(agentDir);

  // 检查文件是否存在
  if (!fs.existsSync(authPath)) {
    return {
      success: false,
      alreadyEncrypted: false,
      error: "认证存储文件不存在",
    };
  }

  // 检查是否已加密
  if (isEncrypted(authPath)) {
    console.log("[migration] ✅ 认证存储已加密，无需迁移");
    return {
      success: true,
      alreadyEncrypted: true,
    };
  }

  if (dryRun) {
    console.log("[migration] [DRY RUN] 将迁移认证存储到加密格式");
    return {
      success: true,
      alreadyEncrypted: false,
    };
  }

  // 执行迁移
  console.log("[migration] 开始迁移认证存储到加密格式...");
  console.log(`[migration] 文件路径: ${authPath}`);

  const success = await migrateToEncrypted(authPath, ".plaintext.backup");

  if (success) {
    console.log("[migration] ✅ 迁移成功");
    console.log(`[migration] 备份文件: ${authPath}.plaintext.backup`);
    return {
      success: true,
      alreadyEncrypted: false,
    };
  }

  return {
    success: false,
    alreadyEncrypted: false,
    error: "迁移失败",
  };
}

/**
 * 自动检测并迁移（如果需要）
 *
 * 在启动时调用，确保认证存储已加密
 *
 * @param agentDir - Agent 目录路径
 */
export async function autoMigrateAuthStore(agentDir?: string): Promise<void> {
  const authPath = resolveAuthStorePath(agentDir);

  // 文件不存在，无需迁移
  if (!fs.existsSync(authPath)) {
    return;
  }

  // 已加密，无需迁移
  if (isEncrypted(authPath)) {
    return;
  }

  // 自动迁移
  console.log("[auth] 检测到未加密的认证存储，开始自动迁移...");

  const result = await migrateAuthStoreToEncrypted(agentDir);

  if (result.success) {
    console.log("[auth] ✅ 认证存储已加密");
  } else {
    console.error(`[auth] ❌ 加密迁移失败: ${result.error}`);
    console.error("[auth] 警告: 凭据仍以明文存储！");
  }
}

// ============================================================================
// 加密版本的存储函数
// ============================================================================

/**
 * 加载加密的认证存储
 */
export async function loadEncryptedAuthStore(agentDir?: string): Promise<AuthProfileStore | null> {
  const authPath = resolveAuthStorePath(agentDir);

  if (!fs.existsSync(authPath)) {
    return null;
  }

  try {
    // 如果是明文文件，自动迁移
    if (!isEncrypted(authPath)) {
      console.log("[auth] 检测到明文认证存储，开始自动迁移...");
      await migrateAuthStoreToEncrypted(agentDir);
    }

    // 加载加密数据
    const data = await loadSecureJson(authPath);
    return data as AuthProfileStore;
  } catch (error) {
    console.error("[auth] 加载加密认证存储失败:", error);
    return null;
  }
}

/**
 * 保存加密的认证存储
 */
export async function saveEncryptedAuthStore(
  store: AuthProfileStore,
  agentDir?: string,
): Promise<void> {
  const authPath = resolveAuthStorePath(agentDir);

  try {
    await saveSecureJson(authPath, store);
  } catch (error) {
    console.error("[auth] 保存加密认证存储失败:", error);
    throw error;
  }
}
