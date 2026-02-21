import crypto from "node:crypto";
function verifyDingtalkSignature(timestamp, sign, secret) {
  const stringToSign = `${timestamp}
${secret}`;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(stringToSign);
  const expectedSign = hmac.digest("base64");
  try {
    const signBuf = Buffer.from(sign, "utf-8");
    const expectedBuf = Buffer.from(expectedSign, "utf-8");
    if (signBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(signBuf, expectedBuf);
  } catch {
    return false;
  }
}
const MAX_BODY_SIZE = 1 * 1024 * 1024;
const READ_BODY_TIMEOUT_MS = 3e4;
async function readBody(req, maxSize = MAX_BODY_SIZE) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      req.destroy();
      reject(new Error(`Request body read timeout after ${READ_BODY_TIMEOUT_MS}ms`));
    }, READ_BODY_TIMEOUT_MS);
    req.on("data", (chunk) => {
      if (settled) return;
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        settled = true;
        clearTimeout(timer);
        req.destroy();
        reject(new Error(`Request body exceeds maximum size limit (${maxSize} bytes)`));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });
    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}
function createDingtalkWebhookHandler(ctx) {
  const { config, onMessage, log } = ctx;
  return async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }
      const signSecret = config.app?.signSecret;
      if (signSecret) {
        const timestamp = req.headers["timestamp"];
        const sign = req.headers["sign"];
        if (!timestamp || !sign) {
          log?.warn("\u9489\u9489\u8BF7\u6C42\u7F3A\u5C11\u7B7E\u540D\u5934");
          res.statusCode = 401;
          res.end(JSON.stringify({ error: "Missing signature headers" }));
          return;
        }
        const timestampMs = parseInt(timestamp, 10);
        if (Math.abs(Date.now() - timestampMs) > 36e5) {
          log?.warn("\u9489\u9489\u8BF7\u6C42\u65F6\u95F4\u6233\u8FC7\u671F");
          res.statusCode = 401;
          res.end(JSON.stringify({ error: "Timestamp expired" }));
          return;
        }
        if (!verifyDingtalkSignature(timestamp, sign, signSecret)) {
          log?.warn("\u9489\u9489\u7B7E\u540D\u9A8C\u8BC1\u5931\u8D25");
          res.statusCode = 401;
          res.end(JSON.stringify({ error: "Invalid signature" }));
          return;
        }
      }
      const rawBody = await readBody(req);
      let body;
      try {
        body = JSON.parse(rawBody);
      } catch {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true }));
      await handleRobotMessage(body, ctx);
    } catch (err) {
      log?.error(`\u9489\u9489 Webhook \u9519\u8BEF: ${err}`);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    }
  };
}
async function handleRobotMessage(event, ctx) {
  const { onMessage, log } = ctx;
  let text = "";
  if (event.msgtype === "text" && event.text?.content) {
    text = event.text.content.trim();
  } else if (event.msgtype === "richText" && event.richText?.richTextList) {
    text = event.richText.richTextList.filter((item) => item.type === "text" && item.text).map((item) => item.text).join("");
  } else {
    log?.info(`\u9489\u9489\u6536\u5230\u975E\u6587\u672C\u6D88\u606F: ${event.msgtype}`);
    return;
  }
  if (!text) {
    log?.info("\u9489\u9489\u6D88\u606F\u5185\u5BB9\u4E3A\u7A7A\uFF0C\u8DF3\u8FC7");
    return;
  }
  log?.info(
    `\u9489\u9489\u6D88\u606F: type=${event.conversationType === "1" ? "\u5355\u804A" : "\u7FA4\u804A"}, from=${event.senderNick}, text=${text.slice(0, 50)}`
  );
  await onMessage({
    msgId: event.msgId,
    conversationId: event.conversationId,
    conversationType: event.conversationType,
    conversationTitle: event.conversationTitle,
    senderId: event.senderId,
    senderNick: event.senderNick,
    senderStaffId: event.senderStaffId,
    text,
    isAtMe: event.isAtMe,
    sessionWebhook: event.sessionWebhook,
    sessionWebhookExpiredTime: event.sessionWebhookExpiredTime,
    rawEvent: event
  });
}
export {
  createDingtalkWebhookHandler
};
