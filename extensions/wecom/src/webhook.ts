/**
 * 企业微信 Webhook 处理
 * WeCom (WeChat Work) Webhook Handler
 *
 * 文档参考:
 * - 回调配置: https://developer.work.weixin.qq.com/document/path/90930
 * - 消息加解密: https://developer.work.weixin.qq.com/document/path/90968
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import type { WecomChannelConfig, WecomMessageEvent } from "./types.js";

export interface WecomWebhookContext {
  config: WecomChannelConfig;
  onMessage: (params: {
    msgId: string;
    userId: string;
    agentId: number;
    msgType: string;
    text: string;
    createTime: number;
    /** 聊天类型: direct=私聊, group=群聊 */
    chatType: "direct" | "group";
    /** 群聊 ID (仅群聊消息存在) */
    chatId?: string;
    rawEvent: WecomMessageEvent;
  }) => Promise<void>;
  log?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

// ============================================================================
// 加解密工具 (Encryption/Decryption Utilities)
// ============================================================================

/**
 * 计算企业微信签名
 */
function computeWecomSignature(token: string, timestamp: string, nonce: string, echostr: string): string {
  const arr = [token, timestamp, nonce, echostr].sort();
  const str = arr.join("");
  return crypto.createHash("sha1").update(str).digest("hex");
}

/**
 * 验证企业微信签名（使用常量时间比较防止时序攻击）
 */
function verifyWecomSignature(
  msgSignature: string,
  token: string,
  timestamp: string,
  nonce: string,
  echostr: string,
): boolean {
  const signature = computeWecomSignature(token, timestamp, nonce, echostr);
  // 使用 crypto.timingSafeEqual 防止时序攻击
  try {
    const sigBuf = Buffer.from(msgSignature, "utf-8");
    const expectedBuf = Buffer.from(signature, "utf-8");
    // 长度不同时，timingSafeEqual 会抛出异常，所以先检查长度
    if (sigBuf.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Base64 解码 EncodingAESKey 为 AES Key
 * EncodingAESKey 是 43 个字符，Base64 解码后为 32 字节 AES Key
 */
function decodeAESKey(encodingAESKey: string): Buffer {
  const key = Buffer.from(encodingAESKey + "=", "base64");
  if (key.length !== 32) {
    throw new Error(`Invalid EncodingAESKey: decoded key must be 32 bytes, got ${key.length}`);
  }
  return key;
}

/**
 * AES-256-CBC 解密 (企业微信使用的加密方式)
 * 包含严格的 PKCS#7 填充验证
 */
function aesDecrypt(encryptedMsg: string, aesKey: Buffer): string {
  // Base64 解码密文
  const encryptedBuffer = Buffer.from(encryptedMsg, "base64");

  // 验证密文长度
  // 最小长度：16 字节随机数 + 4 字节长度 + 至少 1 字节内容 + padding
  if (encryptedBuffer.length < 32) {
    throw new Error("Encrypted message too short");
  }

  // 验证密文长度是否为 AES 块大小 (32 字节 for 企业微信) 的倍数
  if (encryptedBuffer.length % 32 !== 0) {
    throw new Error("Encrypted message length must be multiple of block size");
  }

  // AES Key 的前 16 字节作为 IV
  const iv = aesKey.subarray(0, 16);

  // 创建解密器
  const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
  decipher.setAutoPadding(false);

  // 解密
  let decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);

  // 验证解密后数据非空
  if (decrypted.length === 0) {
    throw new Error("Decrypted data is empty");
  }

  // PKCS#7 严格填充验证
  const pad = decrypted[decrypted.length - 1];
  if (!pad || pad === 0 || pad > 32) {
    throw new Error("Invalid PKCS#7 padding value");
  }
  // 验证所有填充字节都是相同的值
  for (let i = 1; i <= pad; i++) {
    if (decrypted[decrypted.length - i] !== pad) {
      throw new Error("Invalid PKCS#7 padding bytes");
    }
  }
  decrypted = decrypted.subarray(0, decrypted.length - pad);

  // 验证解密后数据长度足够
  if (decrypted.length < 20) {
    throw new Error("Decrypted data too short");
  }

  // 解密后的格式: random(16字节) + msg_len(4字节) + msg + CorpID
  // 跳过前 16 字节随机数
  const msgLen = decrypted.readUInt32BE(16);

  // 验证消息长度合理性（上限 1MB，与 MAX_XML_BODY_SIZE 一致）
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

/**
 * AES-256-CBC 加密 (用于响应)
 */
function aesEncrypt(msg: string, aesKey: Buffer, corpId: string): string {
  // 生成 16 字节随机数
  const random = crypto.randomBytes(16);

  // 消息长度 (网络字节序)
  const msgBuffer = Buffer.from(msg, "utf-8");
  const msgLen = Buffer.alloc(4);
  msgLen.writeUInt32BE(msgBuffer.length, 0);

  // CorpID
  const corpIdBuffer = Buffer.from(corpId, "utf-8");

  // 拼接: random + msg_len + msg + CorpID
  const plaintext = Buffer.concat([random, msgLen, msgBuffer, corpIdBuffer]);

  // PKCS#7 填充到 32 字节的倍数
  const blockSize = 32;
  const padLen = blockSize - (plaintext.length % blockSize);
  const padding = Buffer.alloc(padLen, padLen);
  const paddedPlaintext = Buffer.concat([plaintext, padding]);

  // AES Key 的前 16 字节作为 IV
  const iv = aesKey.subarray(0, 16);

  // 加密
  const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
  cipher.setAutoPadding(false);

  const encrypted = Buffer.concat([cipher.update(paddedPlaintext), cipher.final()]);

  return encrypted.toString("base64");
}

/**
 * 解析 XML 消息为对象
 */
function parseXml(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /<(\w+)>(?:<!\[CDATA\[(.*?)\]\]>|(.*?))<\/\1>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    result[match[1]] = match[2] ?? match[3] ?? "";
  }
  return result;
}

/**
 * 构建 XML 响应
 */
function buildXmlResponse(encrypt: string, signature: string, timestamp: string, nonce: string): string {
  return `<xml>
<Encrypt><![CDATA[${encrypt}]]></Encrypt>
<MsgSignature><![CDATA[${signature}]]></MsgSignature>
<TimeStamp>${timestamp}</TimeStamp>
<Nonce><![CDATA[${nonce}]]></Nonce>
</xml>`;
}

// ============================================================================
// 安全常量
// ============================================================================

/**
 * XML 请求体最大大小限制 (1MB)
 * 防止 XXE 和内存耗尽攻击
 */
const MAX_XML_BODY_SIZE = 1 * 1024 * 1024;

// ============================================================================
// Webhook 处理器
// ============================================================================

/**
 * 读取请求体（带大小限制防止 XXE/DoS 攻击）
 */
async function readBody(req: IncomingMessage, maxSize: number = MAX_XML_BODY_SIZE): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;

    req.on("data", (chunk: Buffer) => {
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

/**
 * 创建企业微信 Webhook 处理器
 */
export function createWecomWebhookHandler(ctx: WecomWebhookContext) {
  const { config, onMessage, log } = ctx;
  const token = config.app?.token;
  const encodingAESKey = config.app?.encodingAESKey;
  const corpId = config.app?.corpId;

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      const msgSignature = url.searchParams.get("msg_signature") ?? "";
      const timestamp = url.searchParams.get("timestamp") ?? "";
      const nonce = url.searchParams.get("nonce") ?? "";
      const echostr = url.searchParams.get("echostr"); // URL 验证时存在

      log?.info(`[wecom] Webhook 收到请求: method=${req.method}, url=${req.url}`);

      // ========================================
      // GET 请求: URL 验证
      // ========================================
      if (req.method === "GET" && echostr) {
        log?.info("[wecom] URL 验证请求");

        if (!token || !encodingAESKey) {
          log?.error("[wecom] URL 验证失败: token 或 encodingAESKey 未配置");
          res.statusCode = 500;
          res.end("Configuration error");
          return;
        }

        // 验证签名
        if (!verifyWecomSignature(msgSignature, token, timestamp, nonce, echostr)) {
          log?.warn("[wecom] URL 验证签名不匹配");
          res.statusCode = 401;
          res.end("Invalid signature");
          return;
        }

        // 解密 echostr
        try {
          const aesKey = decodeAESKey(encodingAESKey);
          const decrypted = aesDecrypt(echostr, aesKey);
          log?.info(`[wecom] URL 验证成功，返回解密后的 echostr`);
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/plain");
          res.end(decrypted);
          return;
        } catch (err) {
          log?.error(`[wecom] URL 验证解密失败: ${err}`);
          res.statusCode = 500;
          res.end("Decryption error");
          return;
        }
      }

      // ========================================
      // POST 请求: 消息回调
      // ========================================
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }

      const rawBody = await readBody(req);
      log?.info(`[wecom] 请求体: ${rawBody.slice(0, 200)}`);

      // 解析 XML
      const parsed = parseXml(rawBody);
      const encrypt = parsed["Encrypt"];

      if (!encrypt) {
        log?.warn("[wecom] 消息体缺少 Encrypt 字段");
        res.statusCode = 400;
        res.end("Missing Encrypt field");
        return;
      }

      if (!token || !encodingAESKey) {
        log?.error("[wecom] 消息处理失败: token 或 encodingAESKey 未配置");
        res.statusCode = 500;
        res.end("Configuration error");
        return;
      }

      // 验证签名
      if (!verifyWecomSignature(msgSignature, token, timestamp, nonce, encrypt)) {
        log?.warn("[wecom] 消息签名验证失败");
        res.statusCode = 401;
        res.end("Invalid signature");
        return;
      }

      // 解密消息
      let decryptedXml: string;
      try {
        const aesKey = decodeAESKey(encodingAESKey);
        decryptedXml = aesDecrypt(encrypt, aesKey);
        log?.info(`[wecom] 消息解密成功: ${decryptedXml.slice(0, 200)}`);
      } catch (err) {
        log?.error(`[wecom] 消息解密失败: ${err}`);
        res.statusCode = 500;
        res.end("Decryption error");
        return;
      }

      // 解析解密后的消息
      const msgData = parseXml(decryptedXml);

      // 快速响应 (先返回 success，再处理消息)
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain");
      res.end("success");

      // 处理消息
      await handleWecomMessage(msgData, ctx);
    } catch (err) {
      log?.error(`[wecom] Webhook 错误: ${err}`);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.end("Internal server error");
      }
    }
  };
}

/**
 * 处理企业微信消息
 */
async function handleWecomMessage(
  msgData: Record<string, string>,
  ctx: WecomWebhookContext,
): Promise<void> {
  const { onMessage, log } = ctx;

  const msgType = msgData["MsgType"];
  const fromUser = msgData["FromUserName"];
  const toUser = msgData["ToUserName"];
  const createTime = parseInt(msgData["CreateTime"] ?? "0", 10);
  const msgId = msgData["MsgId"] ?? `${createTime}-${fromUser}`;
  const agentId = parseInt(msgData["AgentID"] ?? "0", 10);

  // 提取群聊相关字段
  // 企业微信群聊消息会包含 ChatId 字段，或者通过 ChatType 标识
  const chatId = msgData["ChatId"] ?? undefined;
  // ChatType: single=私聊, group=群聊 (智能机器人回调模式使用)
  const rawChatType = msgData["ChatType"]?.toLowerCase();
  // 判断是否为群聊: 有 ChatId 或 ChatType=group
  const isGroup = Boolean(chatId) || rawChatType === "group";
  const chatType: "direct" | "group" = isGroup ? "group" : "direct";

  log?.info(`[wecom] 收到消息: type=${msgType}, from=${fromUser}, chatType=${chatType}, chatId=${chatId ?? "N/A"}, agentId=${agentId}`);

  // 根据消息类型提取文本内容
  let content = "";

  switch (msgType) {
    case "text":
      content = msgData["Content"] ?? "";
      break;

    case "image":
      // 图片消息: 提取图片 URL
      content = msgData["PicUrl"]
        ? `[图片: ${msgData["PicUrl"]}]`
        : "[图片消息]";
      break;

    case "voice":
      // 语音消息: 如果有识别结果使用识别文本，否则标记为语音
      content = msgData["Recognition"]?.trim()
        || "[语音消息]";
      break;

    case "video":
      content = "[视频消息]";
      break;

    case "location":
      // 位置消息
      content = msgData["Label"]
        ? `[位置: ${msgData["Label"]}]`
        : `[位置: ${msgData["Location_X"] ?? ""},${msgData["Location_Y"] ?? ""}]`;
      break;

    case "link":
      // 链接消息
      content = msgData["Title"]
        ? `[链接: ${msgData["Title"]}] ${msgData["Url"] ?? ""}`
        : `[链接: ${msgData["Url"] ?? ""}]`;
      break;

    case "event": {
      // 处理事件消息 (关注/取消关注等)
      const eventName = msgData["Event"];
      log?.info(`[wecom] 收到事件: ${eventName}`);
      if (eventName === "subscribe") {
        log?.info(`[wecom] 用户 ${fromUser} 关注了应用`);
      } else if (eventName === "unsubscribe") {
        log?.info(`[wecom] 用户 ${fromUser} 取消关注了应用`);
      }
      return; // 事件消息不分发到 AI
    }

    default:
      log?.info(`[wecom] 收到未处理的消息类型: ${msgType}`);
      return;
  }

  if (!content.trim()) {
    log?.info(`[wecom] 消息内容为空 (type=${msgType})，跳过`);
    return;
  }

  // All message types are normalized to text-like shape for downstream processing.
  // Cast to WecomMessageEvent since rawEvent expects the union type.
  const event = {
    MsgType: msgType,
    MsgId: msgId,
    ToUserName: toUser,
    FromUserName: fromUser,
    CreateTime: createTime,
    Content: content,
    AgentID: agentId,
    ChatId: chatId,
    ChatType: isGroup ? "group" : "single",
  } as WecomMessageEvent;

  await onMessage({
    msgId,
    userId: fromUser,
    agentId,
    msgType,
    text: content,
    createTime,
    chatType,
    chatId,
    rawEvent: event,
  });
}

/**
 * 构建加密的被动回复消息
 *
 * @param replyContent - 回复内容 (XML 格式的消息体)
 * @param token - 回调 Token
 * @param encodingAESKey - 加密 Key
 * @param corpId - 企业 ID
 * @returns 加密后的 XML 响应
 */
export function buildEncryptedReply(
  replyContent: string,
  token: string,
  encodingAESKey: string,
  corpId: string,
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(8).toString("hex");
  const aesKey = decodeAESKey(encodingAESKey);

  // 加密回复内容
  const encrypt = aesEncrypt(replyContent, aesKey, corpId);

  // 计算签名
  const signature = computeWecomSignature(token, timestamp, nonce, encrypt);

  // 构建 XML 响应
  return buildXmlResponse(encrypt, signature, timestamp, nonce);
}

/**
 * 转义 CDATA 终止符，防止 XML 注入攻击。
 * CDATA 中唯一的非法序列是 "]]>"，将其拆分为两个相邻的 CDATA 段。
 * FIX BUG-R2-5
 */
function escapeCDATA(str: string): string {
  return str.replace(/\]\]>/g, "]]]]><![CDATA[>");
}

/**
 * 构建文本回复消息的 XML
 */
export function buildTextReplyXml(
  toUser: string,
  fromUser: string,
  content: string,
): string {
  const timestamp = Math.floor(Date.now() / 1000);
  return `<xml>
<ToUserName><![CDATA[${escapeCDATA(toUser)}]]></ToUserName>
<FromUserName><![CDATA[${escapeCDATA(fromUser)}]]></FromUserName>
<CreateTime>${timestamp}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${escapeCDATA(content)}]]></Content>
</xml>`;
}
