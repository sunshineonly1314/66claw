import crypto from "node:crypto";
function computeWecomSignature(token, timestamp, nonce, echostr) {
  const arr = [token, timestamp, nonce, echostr].sort();
  const str = arr.join("");
  return crypto.createHash("sha1").update(str).digest("hex");
}
function verifyWecomSignature(msgSignature, token, timestamp, nonce, echostr) {
  const signature = computeWecomSignature(token, timestamp, nonce, echostr);
  try {
    const sigBuf = Buffer.from(msgSignature, "utf-8");
    const expectedBuf = Buffer.from(signature, "utf-8");
    if (sigBuf.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}
function decodeAESKey(encodingAESKey) {
  const key = Buffer.from(encodingAESKey + "=", "base64");
  if (key.length !== 32) {
    throw new Error(`Invalid EncodingAESKey: decoded key must be 32 bytes, got ${key.length}`);
  }
  return key;
}
function aesDecrypt(encryptedMsg, aesKey) {
  const encryptedBuffer = Buffer.from(encryptedMsg, "base64");
  if (encryptedBuffer.length < 32) {
    throw new Error("Encrypted message too short");
  }
  if (encryptedBuffer.length % 32 !== 0) {
    throw new Error("Encrypted message length must be multiple of block size");
  }
  const iv = aesKey.subarray(0, 16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
  decipher.setAutoPadding(false);
  let decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  if (decrypted.length === 0) {
    throw new Error("Decrypted data is empty");
  }
  const pad = decrypted[decrypted.length - 1];
  if (!pad || pad === 0 || pad > 32) {
    throw new Error("Invalid PKCS#7 padding value");
  }
  for (let i = 1; i <= pad; i++) {
    if (decrypted[decrypted.length - i] !== pad) {
      throw new Error("Invalid PKCS#7 padding bytes");
    }
  }
  decrypted = decrypted.subarray(0, decrypted.length - pad);
  if (decrypted.length < 20) {
    throw new Error("Decrypted data too short");
  }
  const msgLen = decrypted.readUInt32BE(16);
  const maxMsgLen = MAX_XML_BODY_SIZE;
  if (msgLen > maxMsgLen) {
    throw new Error(`Message length ${msgLen} exceeds maximum ${maxMsgLen}`);
  }
  if (20 + msgLen > decrypted.length) {
    throw new Error("Invalid message length in decrypted data");
  }
  const msg = decrypted.subarray(20, 20 + msgLen).toString("utf-8");
  return msg;
}
function aesEncrypt(msg, aesKey, corpId) {
  const random = crypto.randomBytes(16);
  const msgBuffer = Buffer.from(msg, "utf-8");
  const msgLen = Buffer.alloc(4);
  msgLen.writeUInt32BE(msgBuffer.length, 0);
  const corpIdBuffer = Buffer.from(corpId, "utf-8");
  const plaintext = Buffer.concat([random, msgLen, msgBuffer, corpIdBuffer]);
  const blockSize = 32;
  const padLen = blockSize - plaintext.length % blockSize;
  const padding = Buffer.alloc(padLen, padLen);
  const paddedPlaintext = Buffer.concat([plaintext, padding]);
  const iv = aesKey.subarray(0, 16);
  const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(paddedPlaintext), cipher.final()]);
  return encrypted.toString("base64");
}
function parseXml(xml) {
  const result = {};
  const regex = /<(\w+)>(?:<!\[CDATA\[(.*?)\]\]>|(.*?))<\/\1>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    result[match[1]] = match[2] ?? match[3] ?? "";
  }
  return result;
}
function buildXmlResponse(encrypt, signature, timestamp, nonce) {
  return `<xml>
<Encrypt><![CDATA[${encrypt}]]></Encrypt>
<MsgSignature><![CDATA[${signature}]]></MsgSignature>
<TimeStamp>${timestamp}</TimeStamp>
<Nonce><![CDATA[${nonce}]]></Nonce>
</xml>`;
}
const MAX_XML_BODY_SIZE = 1 * 1024 * 1024;
async function readBody(req, maxSize = MAX_XML_BODY_SIZE) {
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
function createWecomWebhookHandler(ctx) {
  const { config, onMessage, log } = ctx;
  const token = config.app?.token;
  const encodingAESKey = config.app?.encodingAESKey;
  const corpId = config.app?.corpId;
  return async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      const msgSignature = url.searchParams.get("msg_signature") ?? "";
      const timestamp = url.searchParams.get("timestamp") ?? "";
      const nonce = url.searchParams.get("nonce") ?? "";
      const echostr = url.searchParams.get("echostr");
      log?.info(`[wecom] Webhook \u6536\u5230\u8BF7\u6C42: method=${req.method}, url=${req.url}`);
      if (req.method === "GET" && echostr) {
        log?.info("[wecom] URL \u9A8C\u8BC1\u8BF7\u6C42");
        if (!token || !encodingAESKey) {
          log?.error("[wecom] URL \u9A8C\u8BC1\u5931\u8D25: token \u6216 encodingAESKey \u672A\u914D\u7F6E");
          res.statusCode = 500;
          res.end("Configuration error");
          return;
        }
        if (!verifyWecomSignature(msgSignature, token, timestamp, nonce, echostr)) {
          log?.warn("[wecom] URL \u9A8C\u8BC1\u7B7E\u540D\u4E0D\u5339\u914D");
          res.statusCode = 401;
          res.end("Invalid signature");
          return;
        }
        try {
          const aesKey = decodeAESKey(encodingAESKey);
          const decrypted = aesDecrypt(echostr, aesKey);
          log?.info(`[wecom] URL \u9A8C\u8BC1\u6210\u529F\uFF0C\u8FD4\u56DE\u89E3\u5BC6\u540E\u7684 echostr`);
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/plain");
          res.end(decrypted);
          return;
        } catch (err) {
          log?.error(`[wecom] URL \u9A8C\u8BC1\u89E3\u5BC6\u5931\u8D25: ${err}`);
          res.statusCode = 500;
          res.end("Decryption error");
          return;
        }
      }
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }
      const rawBody = await readBody(req);
      log?.info(`[wecom] \u8BF7\u6C42\u4F53: ${rawBody.slice(0, 200)}`);
      const parsed = parseXml(rawBody);
      const encrypt = parsed["Encrypt"];
      if (!encrypt) {
        log?.warn("[wecom] \u6D88\u606F\u4F53\u7F3A\u5C11 Encrypt \u5B57\u6BB5");
        res.statusCode = 400;
        res.end("Missing Encrypt field");
        return;
      }
      if (!token || !encodingAESKey) {
        log?.error("[wecom] \u6D88\u606F\u5904\u7406\u5931\u8D25: token \u6216 encodingAESKey \u672A\u914D\u7F6E");
        res.statusCode = 500;
        res.end("Configuration error");
        return;
      }
      if (!verifyWecomSignature(msgSignature, token, timestamp, nonce, encrypt)) {
        log?.warn("[wecom] \u6D88\u606F\u7B7E\u540D\u9A8C\u8BC1\u5931\u8D25");
        res.statusCode = 401;
        res.end("Invalid signature");
        return;
      }
      let decryptedXml;
      try {
        const aesKey = decodeAESKey(encodingAESKey);
        decryptedXml = aesDecrypt(encrypt, aesKey);
        log?.info(`[wecom] \u6D88\u606F\u89E3\u5BC6\u6210\u529F: ${decryptedXml.slice(0, 200)}`);
      } catch (err) {
        log?.error(`[wecom] \u6D88\u606F\u89E3\u5BC6\u5931\u8D25: ${err}`);
        res.statusCode = 500;
        res.end("Decryption error");
        return;
      }
      const msgData = parseXml(decryptedXml);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain");
      res.end("success");
      await handleWecomMessage(msgData, ctx);
    } catch (err) {
      log?.error(`[wecom] Webhook \u9519\u8BEF: ${err}`);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.end("Internal server error");
      }
    }
  };
}
async function handleWecomMessage(msgData, ctx) {
  const { onMessage, log } = ctx;
  const msgType = msgData["MsgType"];
  const fromUser = msgData["FromUserName"];
  const toUser = msgData["ToUserName"];
  const createTime = parseInt(msgData["CreateTime"] ?? "0", 10);
  const msgId = msgData["MsgId"] ?? `${createTime}-${fromUser}`;
  const agentId = parseInt(msgData["AgentID"] ?? "0", 10);
  const chatId = msgData["ChatId"] ?? void 0;
  const rawChatType = msgData["ChatType"]?.toLowerCase();
  const isGroup = Boolean(chatId) || rawChatType === "group";
  const chatType = isGroup ? "group" : "direct";
  log?.info(`[wecom] \u6536\u5230\u6D88\u606F: type=${msgType}, from=${fromUser}, chatType=${chatType}, chatId=${chatId ?? "N/A"}, agentId=${agentId}`);
  if (msgType === "text") {
    const content = msgData["Content"] ?? "";
    if (!content.trim()) {
      log?.info("[wecom] \u6587\u672C\u6D88\u606F\u5185\u5BB9\u4E3A\u7A7A\uFF0C\u8DF3\u8FC7");
      return;
    }
    const event = {
      MsgType: "text",
      MsgId: msgId,
      ToUserName: toUser,
      FromUserName: fromUser,
      CreateTime: createTime,
      Content: content,
      AgentID: agentId,
      ChatId: chatId,
      ChatType: isGroup ? "group" : "single"
    };
    await onMessage({
      msgId,
      userId: fromUser,
      agentId,
      msgType: "text",
      text: content,
      createTime,
      chatType,
      chatId,
      rawEvent: event
    });
    return;
  }
  if (msgType === "event") {
    const event = msgData["Event"];
    log?.info(`[wecom] \u6536\u5230\u4E8B\u4EF6: ${event}`);
    if (event === "subscribe") {
      log?.info(`[wecom] \u7528\u6237 ${fromUser} \u5173\u6CE8\u4E86\u5E94\u7528`);
    } else if (event === "unsubscribe") {
      log?.info(`[wecom] \u7528\u6237 ${fromUser} \u53D6\u6D88\u5173\u6CE8\u4E86\u5E94\u7528`);
    }
    return;
  }
  log?.info(`[wecom] \u6536\u5230\u672A\u5904\u7406\u7684\u6D88\u606F\u7C7B\u578B: ${msgType}`);
}
function buildEncryptedReply(replyContent, token, encodingAESKey, corpId) {
  const timestamp = Math.floor(Date.now() / 1e3).toString();
  const nonce = crypto.randomBytes(8).toString("hex");
  const aesKey = decodeAESKey(encodingAESKey);
  const encrypt = aesEncrypt(replyContent, aesKey, corpId);
  const signature = computeWecomSignature(token, timestamp, nonce, encrypt);
  return buildXmlResponse(encrypt, signature, timestamp, nonce);
}
function escapeCDATA(str) {
  return str.replace(/\]\]>/g, "]]]]><![CDATA[>");
}
function buildTextReplyXml(toUser, fromUser, content) {
  const timestamp = Math.floor(Date.now() / 1e3);
  return `<xml>
<ToUserName><![CDATA[${escapeCDATA(toUser)}]]></ToUserName>
<FromUserName><![CDATA[${escapeCDATA(fromUser)}]]></FromUserName>
<CreateTime>${timestamp}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${escapeCDATA(content)}]]></Content>
</xml>`;
}
export {
  buildEncryptedReply,
  buildTextReplyXml,
  createWecomWebhookHandler
};
