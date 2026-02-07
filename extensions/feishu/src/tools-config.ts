/**
 * 飞书工具配置
 * Feishu Tools Configuration
 *
 * 控制各个工具的启用/禁用
 * 融合自 m1heng/clawdbot-feishu
 */

import type { FeishuToolsConfig } from "./types.js";

/**
 * 默认工具配置
 * 除 perm (敏感) 外，其他工具默认启用
 */
export const DEFAULT_TOOLS_CONFIG: Required<FeishuToolsConfig> = {
  doc: true,     // 文档操作
  wiki: true,    // 知识库操作
  drive: true,   // 云空间操作
  perm: false,   // 权限管理 (默认禁用，敏感)
  scopes: true,  // 应用权限诊断
};

/**
 * 解析工具配置
 * 合并用户配置和默认配置
 */
export function resolveToolsConfig(userConfig?: FeishuToolsConfig): Required<FeishuToolsConfig> {
  if (!userConfig) {
    return { ...DEFAULT_TOOLS_CONFIG };
  }

  return {
    doc: userConfig.doc ?? DEFAULT_TOOLS_CONFIG.doc,
    wiki: userConfig.wiki ?? DEFAULT_TOOLS_CONFIG.wiki,
    drive: userConfig.drive ?? DEFAULT_TOOLS_CONFIG.drive,
    perm: userConfig.perm ?? DEFAULT_TOOLS_CONFIG.perm,
    scopes: userConfig.scopes ?? DEFAULT_TOOLS_CONFIG.scopes,
  };
}
