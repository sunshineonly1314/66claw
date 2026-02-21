import crypto from "node:crypto";
function decryptFeishuMessage(encrypt, encryptKey) {
  const key = crypto.createHash("sha256").update(encryptKey).digest();
  const encryptedBuffer = Buffer.from(encrypt, "base64");
  if (encryptedBuffer.length < 32) {
    throw new Error(
      `[feishu] decryptFeishuMessage: encrypted payload too short (${encryptedBuffer.length} bytes, expected >= 32)`
    );
  }
  const iv = encryptedBuffer.subarray(0, 16);
  const encrypted = encryptedBuffer.subarray(16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf-8");
}
function sendJsonResponse(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body, "utf-8")
  });
  res.end(body);
}
const MAX_BODY_SIZE = 1 * 1024 * 1024;
async function readBody(req, maxSize = MAX_BODY_SIZE) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;
    req.on("data", (chunk) => {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        req.destroy();
        reject(new Error(`Request body exceeds maximum size limit (${maxSize} bytes)`));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}
function createFeishuWebhookHandler(ctx) {
  const { config, onMessage, log } = ctx;
  return async (req, res) => {
    try {
      if (req.method !== "POST") {
        sendJsonResponse(res, 405, { error: "Method not allowed" });
        return;
      }
      log?.info(`[feishu] Webhook \u6536\u5230 HTTP \u8BF7\u6C42 ${req.url ?? ""}`);
      const rawBody = await readBody(req);
      log?.info(`[feishu] \u8BF7\u6C42\u4F53\u6458\u8981: ${rawBody.slice(0, 200)}`);
      let body;
      try {
        body = JSON.parse(rawBody);
      } catch {
        log?.error(`[feishu] Webhook JSON \u89E3\u6790\u5931\u8D25: ${rawBody.slice(0, 100)}`);
        sendJsonResponse(res, 400, { error: "Invalid JSON" });
        return;
      }
      if (typeof body === "object" && body !== null && "encrypt" in body) {
        const encryptKey = config.encryptKey ?? config.app?.encryptKey;
        if (!encryptKey) {
          log?.error("[feishu] \u6536\u5230\u52A0\u5BC6\u6D88\u606F\u4F46\u672A\u914D\u7F6E encryptKey");
          sendJsonResponse(res, 400, { error: "Encryption key not configured" });
          return;
        }
        try {
          const decrypted = decryptFeishuMessage(body.encrypt, encryptKey);
          log?.info(`[feishu] \u6D88\u606F\u89E3\u5BC6\u6210\u529F: ${decrypted.slice(0, 200)}`);
          body = JSON.parse(decrypted);
        } catch (decryptErr) {
          log?.error(`[feishu] \u6D88\u606F\u89E3\u5BC6\u5931\u8D25: ${decryptErr}`);
          sendJsonResponse(res, 400, { error: "Decryption failed" });
          return;
        }
      }
      if (typeof body === "object" && body !== null && "type" in body) {
        const verifyEvent = body;
        if (verifyEvent.type === "url_verification") {
          log?.info(`[feishu] URL \u9A8C\u8BC1\u8BF7\u6C42: challenge=${verifyEvent.challenge}`);
          const verificationToken = config.verificationToken ?? config.app?.verificationToken;
          if (verificationToken && verifyEvent.token !== verificationToken) {
            log?.warn(`[feishu] \u9A8C\u8BC1 Token \u4E0D\u5339\u914D: \u671F\u671B=${verificationToken}, \u6536\u5230=${verifyEvent.token}`);
            sendJsonResponse(res, 401, { error: "Invalid verification token" });
            return;
          }
          log?.info(`[feishu] URL \u9A8C\u8BC1\u6210\u529F\uFF0C\u8FD4\u56DE challenge`);
          sendJsonResponse(res, 200, { challenge: verifyEvent.challenge });
          return;
        }
      }
      if (typeof body === "object" && body !== null && "header" in body) {
        const event = body;
        const eventVerificationToken = config.verificationToken ?? config.app?.verificationToken;
        if (eventVerificationToken && event.header?.token !== eventVerificationToken) {
          log?.warn("[feishu] \u4E8B\u4EF6 Token \u4E0D\u5339\u914D");
          sendJsonResponse(res, 401, { error: "Invalid event token" });
          return;
        }
        sendJsonResponse(res, 200, {});
        if (event.header?.event_type === "im.message.receive_v1") {
          log?.info(`[feishu] \u5F00\u59CB\u5904\u7406\u63A5\u6536\u6D88\u606F\u4E8B\u4EF6 im.message.receive_v1`);
          handleMessageEvent(event, ctx).catch((err) => {
            log?.error(`[feishu] \u5904\u7406\u6D88\u606F\u4E8B\u4EF6\u5931\u8D25: ${err}`);
          });
        } else {
          log?.info(`[feishu] \u6536\u5230\u672A\u5904\u7406\u7684\u4E8B\u4EF6\u7C7B\u578B: ${event.header?.event_type}`);
        }
        return;
      }
      if (typeof body === "object" && body !== null && "event" in body && !("header" in body)) {
        log?.info("[feishu] \u6536\u5230\u65E7\u7248 schema 1.0 \u683C\u5F0F\u4E8B\u4EF6\uFF0C\u5EFA\u8BAE\u5347\u7EA7\u5230 schema 2.0");
        sendJsonResponse(res, 200, {});
        return;
      }
      log?.warn(`[feishu] Webhook \u6536\u5230\u672A\u77E5\u683C\u5F0F: ${JSON.stringify(body).slice(0, 200)}`);
      sendJsonResponse(res, 200, {});
    } catch (err) {
      log?.error(`[feishu] Webhook \u9519\u8BEF: ${err}`);
      if (!res.writableEnded) {
        sendJsonResponse(res, 500, { error: "Internal server error" });
      }
    }
  };
}
async function handleMessageEvent(event, ctx) {
  const { onMessage, log } = ctx;
  const message = event.event?.message;
  const sender = event.event?.sender;
  if (!message || !sender) {
    log?.warn("[feishu] \u6D88\u606F\u4E8B\u4EF6\u7F3A\u5C11 message \u6216 sender");
    return;
  }
  let text = "";
  if (message.message_type === "text") {
    try {
      const content = JSON.parse(message.content);
      text = content.text ?? "";
    } catch {
      text = message.content;
    }
  } else {
    log?.info(`[feishu] \u6536\u5230\u975E\u6587\u672C\u6D88\u606F: ${message.message_type}`);
    return;
  }
  const mentions = message.mentions?.map((m) => ({
    key: m.key,
    name: m.name,
    id: m.id.open_id ?? m.id.user_id ?? m.id.union_id ?? ""
  }));
  if (mentions) {
    for (const m of mentions) {
      text = text.replaceAll(m.key, "").trim();
    }
  }
  const senderId = sender.sender_id.open_id ?? sender.sender_id.user_id ?? sender.sender_id.union_id ?? "unknown";
  log?.info(
    `[feishu] \u89E3\u6790\u5230\u6D88\u606F: chatType=${message.chat_type}, chatId=${message.chat_id}, from=${senderId}, text=${text.slice(0, 50)}`
  );
  await onMessage({
    messageId: message.message_id,
    chatId: message.chat_id,
    chatType: message.chat_type,
    senderId,
    senderOpenId: sender.sender_id.open_id,
    text,
    mentions,
    rawEvent: event
  });
}
export {
  createFeishuWebhookHandler
};
