/**
 * 飞书输入指示器
 * Feishu Typing Indicator
 *
 * 通过表情反应实现输入状态指示
 * 融合自 m1heng/clawdbot-feishu (MIT License)
 */

import { createFeishuClient } from "./client.js";
import type { FeishuChannelConfig } from "./types.js";

// ============================================================================
// 常量
// ============================================================================

/** 思考中表情 (默认使用这个) */
const THINKING_EMOJI = "Thinking";

/** 正在输入表情 (可选) */
const TYPING_EMOJI = "Writing";

/** 完成表情 (可选，用于短暂显示完成状态) */
const DONE_EMOJI = "OK";

// ============================================================================
// 输入指示器管理
// ============================================================================

interface TypingState {
  messageId: string;
  emojiType: string;
  added: boolean;
}

/** 当前活跃的输入指示器 */
const activeIndicators = new Map<string, TypingState>();

/**
 * 添加输入指示器
 * 在消息上添加"思考中"表情
 */
export async function addTypingIndicator(
  config: FeishuChannelConfig,
  messageId: string,
  emojiType: string = THINKING_EMOJI,
): Promise<boolean> {
  try {
    const client = createFeishuClient(config);
    
    const res = await client.im.messageReaction.create({
      path: { message_id: messageId },
      data: {
        reaction_type: { emoji_type: emojiType },
      },
    });

    if (res.code === 0) {
      activeIndicators.set(messageId, {
        messageId,
        emojiType,
        added: true,
      });
      return true;
    }
    
    // 静默失败 - 权限不足或消息不存在
    return false;
  } catch {
    return false;
  }
}

/**
 * 移除输入指示器
 * 移除消息上的"思考中"表情
 */
export async function removeTypingIndicator(
  config: FeishuChannelConfig,
  messageId: string,
): Promise<boolean> {
  const state = activeIndicators.get(messageId);
  if (!state || !state.added) {
    return false;
  }

  try {
    const client = createFeishuClient(config);
    
    // 先获取当前的 reaction ID
    const listRes = await client.im.messageReaction.list({
      path: { message_id: messageId },
      params: { reaction_type: state.emojiType },
    });

    if (listRes.code !== 0 || !listRes.data?.items?.length) {
      activeIndicators.delete(messageId);
      return false;
    }

    // 找到我们添加的 reaction 并删除
    const ourReaction = listRes.data.items.find(
      (item) => item.reaction_type?.emoji_type === state.emojiType
    );

    if (ourReaction?.reaction_id) {
      await client.im.messageReaction.delete({
        path: { 
          message_id: messageId, 
          reaction_id: ourReaction.reaction_id 
        },
      });
    }

    activeIndicators.delete(messageId);
    return true;
  } catch {
    activeIndicators.delete(messageId);
    return false;
  }
}

/**
 * 创建输入指示器上下文
 * 用于在处理消息时自动管理指示器生命周期
 */
export function createTypingContext(
  config: FeishuChannelConfig,
  messageId: string,
) {
  let started = false;

  return {
    /**
     * 开始显示输入指示器
     */
    async start(): Promise<void> {
      if (started) return;
      started = await addTypingIndicator(config, messageId);
    },

    /**
     * 停止显示输入指示器
     */
    async stop(): Promise<void> {
      if (!started) return;
      await removeTypingIndicator(config, messageId);
      started = false;
    },

    /**
     * 检查是否已启动
     */
    isStarted(): boolean {
      return started;
    },
  };
}

/**
 * 高阶函数：包装处理函数，自动添加输入指示器
 */
export function withTypingIndicator<T extends (...args: any[]) => Promise<any>>(
  config: FeishuChannelConfig,
  getMessageId: (...args: Parameters<T>) => string,
  handler: T,
): T {
  return (async (...args: Parameters<T>) => {
    const messageId = getMessageId(...args);
    const typing = createTypingContext(config, messageId);
    
    try {
      await typing.start();
      return await handler(...args);
    } finally {
      await typing.stop();
    }
  }) as T;
}

// ============================================================================
// 导出常量供外部使用
// ============================================================================

export const TypingEmojis = {
  THINKING: THINKING_EMOJI,
  TYPING: TYPING_EMOJI,
  DONE: DONE_EMOJI,
} as const;
