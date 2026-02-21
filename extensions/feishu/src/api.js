import { createFeishuClient, resolveFeishuCredentials, clearClientCache } from "./client.js";
import { resolveReceiveIdType, normalizeFeishuTarget } from "./targets.js";
import { buildMentionedMessage, buildMentionedCardContent } from "./mention.js";
async function sendFeishuMessage(config, to, text, options) {
  const client = createFeishuClient(config);
  const receiveId = normalizeFeishuTarget(to);
  if (!receiveId) {
    throw new Error(`\u65E0\u6548\u7684\u98DE\u4E66\u76EE\u6807: ${to}`);
  }
  const receiveIdType = resolveReceiveIdType(receiveId);
  const msgType = options?.msgType ?? "text";
  let messageText = text ?? "";
  if (options?.mentions && options.mentions.length > 0) {
    messageText = buildMentionedMessage(options.mentions, messageText);
  }
  let content;
  if (msgType === "text") {
    content = JSON.stringify({ text: messageText });
  } else if (msgType === "interactive") {
    let cardText = text;
    if (options?.mentions && options.mentions.length > 0) {
      cardText = buildMentionedCardContent(options.mentions, text);
    }
    content = JSON.stringify({
      config: { wide_screen_mode: true },
      elements: [{ tag: "markdown", content: cardText }]
    });
  } else {
    content = JSON.stringify({ text: messageText });
  }
  if (options?.replyToId) {
    const response2 = await client.im.message.reply({
      path: { message_id: options.replyToId },
      data: { content, msg_type: msgType }
    });
    if (response2.code !== 0) {
      throw new Error(`\u98DE\u4E66\u56DE\u590D\u6D88\u606F\u5931\u8D25: ${response2.msg || `code ${response2.code}`}`);
    }
    return {
      messageId: response2.data?.message_id ?? "unknown",
      chatId: receiveId
    };
  }
  const response = await client.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: receiveId,
      content,
      msg_type: msgType
    }
  });
  if (response.code !== 0) {
    throw new Error(`\u98DE\u4E66\u53D1\u9001\u6D88\u606F\u5931\u8D25: ${response.msg || `code ${response.code}`}`);
  }
  return {
    messageId: response.data?.message_id ?? "unknown",
    chatId: receiveId
  };
}
function buildMarkdownCard(text) {
  return {
    config: { wide_screen_mode: true },
    elements: [{ tag: "markdown", content: text }]
  };
}
async function sendMarkdownCardFeishu(params) {
  const { config, to, text, replyToMessageId, mentions } = params;
  let cardText = text;
  if (mentions && mentions.length > 0) {
    cardText = buildMentionedCardContent(mentions, text);
  }
  return sendFeishuMessage(config, to, cardText, {
    msgType: "interactive",
    replyToId: replyToMessageId
  });
}
async function getMessageFeishu(params) {
  const { config, messageId } = params;
  const client = createFeishuClient(config);
  try {
    const response = await client.im.message.get({
      path: { message_id: messageId }
    });
    if (response.code !== 0) return null;
    const item = response.data?.items?.[0];
    if (!item) return null;
    let content = item.body?.content ?? "";
    try {
      const parsed = JSON.parse(content);
      if (item.msg_type === "text" && parsed.text) {
        content = parsed.text;
      }
    } catch {
    }
    return {
      messageId: item.message_id ?? messageId,
      chatId: item.chat_id ?? "",
      senderId: item.sender?.id,
      senderOpenId: item.sender?.id_type === "open_id" ? item.sender?.id : void 0,
      content,
      contentType: item.msg_type ?? "text",
      createTime: item.create_time ? parseInt(item.create_time, 10) : void 0
    };
  } catch {
    return null;
  }
}
async function probeFeishuConnection(config) {
  const creds = resolveFeishuCredentials(config);
  if (!creds) {
    return { ok: false, error: "App ID \u6216 App Secret \u672A\u914D\u7F6E" };
  }
  const startTime = Date.now();
  try {
    const client = createFeishuClient(config);
    const domain = creds.domain === "lark" ? "https://open.larksuite.com" : "https://open.feishu.cn";
    const response = await client.request({
      method: "GET",
      url: `${domain}/open-apis/bot/v3/info`,
      timeout: 1e4
      // 10 秒超时，防止请求挂起
    });
    const elapsedMs = Date.now() - startTime;
    if (response.code !== 0) {
      return {
        ok: false,
        error: response.msg || `code ${response.code}`,
        appId: creds.appId,
        elapsedMs
      };
    }
    return {
      ok: true,
      appId: creds.appId,
      botName: response.bot?.app_name,
      botOpenId: response.bot?.open_id,
      elapsedMs
    };
  } catch (err) {
    return {
      ok: false,
      error: String(err),
      appId: creds.appId,
      elapsedMs: Date.now() - startTime
    };
  }
}
function clearFeishuTokenCache() {
  clearClientCache();
}
const probeFeishu = probeFeishuConnection;
export {
  buildMarkdownCard,
  clearFeishuTokenCache,
  getMessageFeishu,
  probeFeishu,
  probeFeishuConnection,
  sendFeishuMessage,
  sendMarkdownCardFeishu
};
