/**
 * 飞书目标地址处理
 * Feishu Target Handling
 */

import type { FeishuIdType } from "./types.js";

// ============================================================================
// ID 类型检测
// ============================================================================

/**
 * 根据 ID 前缀确定 receive_id_type
 */
export function resolveReceiveIdType(id: string): FeishuIdType {
  if (id.startsWith("oc_")) return "chat_id";
  if (id.startsWith("on_")) return "union_id";
  if (id.startsWith("ou_")) return "open_id";
  // 默认使用 open_id
  return "open_id";
}

/**
 * 检查是否看起来像飞书 ID
 */
export function looksLikeFeishuId(raw: string): boolean {
  const trimmed = raw.trim();
  return /^(ou_|on_|oc_)[a-zA-Z0-9_-]+$/.test(trimmed);
}

// ============================================================================
// 目标地址规范化
// ============================================================================

/**
 * 规范化飞书目标地址
 *
 * 支持格式:
 * - ou_xxx (open_id)
 * - on_xxx (union_id)
 * - oc_xxx (chat_id)
 * - user:ou_xxx
 * - chat:oc_xxx
 */
export function normalizeFeishuTarget(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 移除前缀
  const prefixPatterns = [
    /^(feishu|user|open_id|chat):/i,
  ];

  let normalized = trimmed;
  for (const pattern of prefixPatterns) {
    normalized = normalized.replace(pattern, "");
  }

  normalized = normalized.trim();
  if (!normalized) return null;

  // 验证格式
  if (
    normalized.startsWith("ou_") ||
    normalized.startsWith("on_") ||
    normalized.startsWith("oc_")
  ) {
    return normalized;
  }

  // 如果没有前缀，假定是 open_id 格式
  return normalized;
}

/**
 * 格式化目标地址用于显示
 */
export function formatFeishuTarget(id: string): string {
  const idType = resolveReceiveIdType(id);
  switch (idType) {
    case "chat_id":
      return `chat:${id}`;
    case "union_id":
      return `union:${id}`;
    default:
      return `user:${id}`;
  }
}
