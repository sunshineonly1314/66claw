import { createFeishuClient } from "./client.js";
const THINKING_EMOJI = "Thinking";
const TYPING_EMOJI = "Writing";
const DONE_EMOJI = "OK";
const activeIndicators = /* @__PURE__ */ new Map();
async function addTypingIndicator(config, messageId, emojiType = THINKING_EMOJI) {
  try {
    const client = createFeishuClient(config);
    const res = await client.im.messageReaction.create({
      path: { message_id: messageId },
      data: {
        reaction_type: { emoji_type: emojiType }
      }
    });
    if (res.code === 0) {
      activeIndicators.set(messageId, {
        messageId,
        emojiType,
        added: true
      });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
async function removeTypingIndicator(config, messageId) {
  const state = activeIndicators.get(messageId);
  if (!state || !state.added) {
    return false;
  }
  try {
    const client = createFeishuClient(config);
    const listRes = await client.im.messageReaction.list({
      path: { message_id: messageId },
      params: { reaction_type: state.emojiType }
    });
    if (listRes.code !== 0 || !listRes.data?.items?.length) {
      activeIndicators.delete(messageId);
      return false;
    }
    const ourReaction = listRes.data.items.find(
      (item) => item.reaction_type?.emoji_type === state.emojiType
    );
    if (ourReaction?.reaction_id) {
      await client.im.messageReaction.delete({
        path: {
          message_id: messageId,
          reaction_id: ourReaction.reaction_id
        }
      });
    }
    activeIndicators.delete(messageId);
    return true;
  } catch {
    activeIndicators.delete(messageId);
    return false;
  }
}
function createTypingContext(config, messageId) {
  let started = false;
  return {
    /**
     * 开始显示输入指示器
     */
    async start() {
      if (started) return;
      started = await addTypingIndicator(config, messageId);
    },
    /**
     * 停止显示输入指示器
     */
    async stop() {
      if (!started) return;
      await removeTypingIndicator(config, messageId);
      started = false;
    },
    /**
     * 检查是否已启动
     */
    isStarted() {
      return started;
    }
  };
}
function withTypingIndicator(config, getMessageId, handler) {
  return (async (...args) => {
    const messageId = getMessageId(...args);
    const typing = createTypingContext(config, messageId);
    try {
      await typing.start();
      return await handler(...args);
    } finally {
      await typing.stop();
    }
  });
}
const TypingEmojis = {
  THINKING: THINKING_EMOJI,
  TYPING: TYPING_EMOJI,
  DONE: DONE_EMOJI
};
export {
  TypingEmojis,
  addTypingIndicator,
  createTypingContext,
  removeTypingIndicator,
  withTypingIndicator
};
