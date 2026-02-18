/**
 * 认证凭据加密命令
 * Authentication Credential Encryption Command
 *
 * CLI 命令：openclawcn auth encrypt
 */

import {
  migrateAuthStoreToEncrypted,
  isAuthStoreEncrypted,
} from "../agents/auth-profiles/migrate-encryption.js";
import { resolveAuthStorePath } from "../agents/auth-profiles/paths.js";

export async function authEncryptCommand(args: {
  check?: boolean;
  agentDir?: string;
}): Promise<void> {
  const { check, agentDir } = args;

  const authPath = resolveAuthStorePath(agentDir);

  // 检查模式
  if (check) {
    const encrypted = isAuthStoreEncrypted(agentDir);

    console.log("=".repeat(60));
    console.log("📁 认证存储加密状态检查");
    console.log("=".repeat(60));
    console.log(`文件路径: ${authPath}`);
    console.log(`加密状态: ${encrypted ? "✅ 已加密" : "❌ 未加密（明文存储）"}`);
    console.log("=".repeat(60));

    if (!encrypted) {
      console.log("");
      console.log("⚠️  警告: 凭据当前以明文存储！");
      console.log("");
      console.log("建议运行以下命令启用加密:");
      console.log("  openclawcn auth encrypt");
      console.log("");
    }

    return;
  }

  // 迁移模式
  console.log("=".repeat(60));
  console.log("🔐 认证凭据加密迁移");
  console.log("=".repeat(60));
  console.log("");

  // 执行迁移
  const result = await migrateAuthStoreToEncrypted(agentDir);

  if (result.alreadyEncrypted) {
    console.log("✅ 认证存储已加密，无需迁移");
    console.log(`文件路径: ${authPath}`);
    console.log("");
    return;
  }

  if (result.success) {
    console.log("✅ 迁移成功！");
    console.log("");
    console.log("📊 迁移详情:");
    console.log(`  - 文件路径: ${authPath}`);
    console.log(`  - 备份文件: ${authPath}.plaintext.backup`);
    console.log("");
    console.log("🔒 安全特性:");
    console.log("  - 加密算法: AES-256-GCM");
    console.log("  - 认证加密: 防篡改保护");
    console.log(`  - 主密钥: ~/.openclawcn/.master-key (chmod 0600)`);
    console.log("");
    console.log("💡 提示:");
    console.log("  - 备份文件包含未加密的原始数据");
    console.log("  - 验证迁移成功后，可以安全删除备份文件");
    console.log("  - 如需回滚，请运行: openclawcn auth decrypt");
    console.log("");
  } else {
    console.error("❌ 迁移失败!");
    if (result.error) {
      console.error(`错误: ${result.error}`);
    }
    console.error("");
    console.error("请检查文件权限并重试");
    process.exit(1);
  }
}

/**
 * 命令帮助信息
 */
export const authEncryptHelp = `
加密认证凭据存储

用法:
  openclawcn auth encrypt [options]

选项:
  --check         检查当前加密状态（不执行迁移）
  --agent-dir     指定 Agent 目录路径

示例:
  # 检查加密状态
  openclawcn auth encrypt --check

  # 迁移到加密存储
  openclawcn auth encrypt

  # 为特定 Agent 目录迁移
  openclawcn auth encrypt --agent-dir /path/to/agent

安全说明:
  - 使用 AES-256-GCM 加密算法
  - 主密钥存储在 ~/.openclawcn/.master-key
  - 自动创建明文数据备份
  - 向后兼容，支持回滚
`;
