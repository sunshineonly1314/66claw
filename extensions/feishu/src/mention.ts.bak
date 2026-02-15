/**
 * 飞书 @ 提及处理
 * Feishu Mention Handling
 *
 * 融合自 m1heng/clawdbot-feishu
 */

import type { FeishuMessageEvent, MentionTarget } from "./types.js";

// ============================================================================
// @ 提及提取
// ============================================================================

/**
 * 从消息事件中提取 @ 目标 (排除机器人自身)
 */
export function extractMentionTargets(
  event: FeishuMessageEvent,
  botOpenId?: string,
): MentionTarget[] {
  const mentions = event.message.mentions ?? [];

  return mentions
    .filter((m) => {
      // 排除机器人自身
      if (botOpenId && m.id.open_id === botOpenId) return false;
      // 必须有 open_id
      return !!m.id.open_id;
    })
    .map((m) => ({
      openId: m.id.open_id!,
      name: m.name,
      key: m.key,
    }));
}

/**
 * 检查消息是否是 @ 转发请求
 *
 * 规则:
 * - 群聊: 消息同时 @ 机器人 + 至少一个其他用户
 * - 私聊: 消息 @ 任何用户 (无需 @ 机器人)
 */
export function isMentionForwardRequest(
  event: FeishuMessageEvent,
  botOpenId?: string,
): boolean {
  const mentions = event.message.mentions ?? [];
  if (mentions.length === 0) return false;

  const isDirectMessage = event.message.chat_type === "p2p";
  const hasOtherMention = mentions.some((m) => m.id.open_id !== botOpenId);

  if (isDirectMessage) {
    // 私聊: 只要 @ 了非机器人用户就触发
    return hasOtherMention;
  } else {
    // 群聊: 需要同时 @ 机器人和其他用户
    const hasBotMention = mentions.some((m) => m.id.open_id === botOpenId);
    return hasBotMention && hasOtherMention;
  }
}

/**
 * 从文本中提取消息正文 (移除所有 @ 占位符)
 */
export function extractMessageBody(text: string, allMentionKeys: string[]): string {
  let result = text;

  // 移除所有 @ 占位符
  for (const key of allMentionKeys) {
    result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "");
  }

  return result.replace(/\s+/g, " ").trim();
}

// ============================================================================
// @ 提及格式化 (用于发送消息)
// ============================================================================

/**
 * 格式化单个 @ (文本消息格式)
 */
export function formatMentionForText(target: MentionTarget): string {
  return `<at user_id="${target.openId}">${target.name}</at>`;
}

/**
 * 格式化 @所有人 (文本消息格式)
 */
export function formatMentionAllForText(): string {
  return `<at user_id="all">所有人</at>`;
}

/**
 * 格式化单个 @ (卡片消息 lark_md 格式)
 */
export function formatMentionForCard(target: MentionTarget): string {
  return `<at id=${target.openId}></at>`;
}

/**
 * 格式化 @所有人 (卡片消息格式)
 */
export function formatMentionAllForCard(): string {
  return `<at id=all></at>`;
}

/**
 * 构建带 @ 的完整消息 (文本格式)
 */
export function buildMentionedMessage(targets: MentionTarget[], message: string): string {
  if (targets.length === 0) return message;

  const mentionParts = targets.map((t) => formatMentionForText(t));
  return `${mentionParts.join(" ")} ${message}`;
}

/**
 * 构建带 @ 的卡片内容 (Markdown 格式)
 */
export function buildMentionedCardContent(targets: MentionTarget[], message: string): string {
  if (targets.length === 0) return message;

  const mentionParts = targets.map((t) => formatMentionForCard(t));
  return `${mentionParts.join(" ")} ${message}`;
}
