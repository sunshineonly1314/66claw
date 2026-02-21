import crypto from "node:crypto";
import { QqbotOpCode, QqbotEventType } from "./types.js";
function verifyEd25519Signature(publicKey, signature, timestamp, body) {
  try {
    const message = timestamp + body;
    const isValid = crypto.verify(
      null,
      // Ed25519 不需要 hash 算法
      Buffer.from(message, "utf8"),
      {
        key: Buffer.from(publicKey, "hex"),
        format: "der",
        type: "spki"
      },
      Buffer.from(signature, "hex")
    );
    return isValid;
  } catch (error) {
    console.error("[qqbot] Ed25519 signature verification error:", error);
    return false;
  }
}
function verifyTimestamp(timestamp, maxAgeSeconds = 300) {
  try {
    const requestTime = Number.parseInt(timestamp, 10);
    if (Number.isNaN(requestTime)) {
      return false;
    }
    const now = Math.floor(Date.now() / 1e3);
    const age = Math.abs(now - requestTime);
    return age <= maxAgeSeconds;
  } catch {
    return false;
  }
}
const MAX_BODY_SIZE = 1 * 1024 * 1024;
async function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;
    req.on("data", (chunk) => {
      totalSize += chunk.length;
      if (totalSize > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error(`Request body exceeds maximum size limit (${MAX_BODY_SIZE} bytes)`));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}
function createQqbotWebhookHandler(params) {
  const { config, onMessage, logger } = params;
  const log = logger ?? console;
  return async function handleWebhook(req, res) {
    try {
      if (req.method !== "POST") {
        res.writeHead(405);
        res.end("Method Not Allowed");
        return;
      }
      const rawBody = await parseRequestBody(req);
      const signature = req.headers["x-signature-ed25519"];
      const timestamp = req.headers["x-signature-timestamp"];
      const publicKey = config.app?.publicKey;
      if (publicKey) {
        if (!signature || !timestamp) {
          log.warn("[qqbot] \u62D2\u7EDD\u8BF7\u6C42: \u7F3A\u5C11\u7B7E\u540D\u5934\u90E8 (X-Signature-Ed25519 \u6216 X-Signature-Timestamp)");
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing signature headers" }));
          return;
        }
        if (!verifyTimestamp(timestamp)) {
          log.warn(`[qqbot] \u62D2\u7EDD\u8BF7\u6C42: \u65F6\u95F4\u6233\u65E0\u6548\u6216\u8FC7\u671F (timestamp=${timestamp})`);
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid or expired timestamp" }));
          return;
        }
        const isValid = verifyEd25519Signature(publicKey, signature, timestamp, rawBody);
        if (!isValid) {
          log.warn("[qqbot] \u62D2\u7EDD\u8BF7\u6C42: Ed25519 \u7B7E\u540D\u9A8C\u8BC1\u5931\u8D25");
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid signature" }));
          return;
        }
        log.info("[qqbot] \u2705 Ed25519 \u7B7E\u540D\u9A8C\u8BC1\u901A\u8FC7");
      } else {
        log.warn("[qqbot] \u26A0\uFE0F \u8B66\u544A: \u672A\u914D\u7F6E publicKey\uFF0C\u7B7E\u540D\u9A8C\u8BC1\u5DF2\u8DF3\u8FC7\uFF01\u5EFA\u8BAE\u914D\u7F6E\u4EE5\u63D0\u9AD8\u5B89\u5168\u6027");
      }
      let event;
      try {
        event = JSON.parse(rawBody);
      } catch {
        res.writeHead(400);
        res.end("Invalid JSON");
        return;
      }
      switch (event.op) {
        case QqbotOpCode.DISPATCH: {
          await handleDispatch(event, onMessage, log);
          break;
        }
        case QqbotOpCode.HTTP_CALLBACK_ACK: {
          const payload = event.d;
          if (payload.plain_token) {
            const appSecret = config.app?.appSecret ?? "";
            let callbackSignature = "";
            if (appSecret) {
              try {
                const eventTs = payload.event_ts ?? "";
                const msg = Buffer.from(eventTs + payload.plain_token, "utf-8");
                let seedStr = appSecret;
                while (Buffer.byteLength(seedStr, "utf-8") < 32) {
                  seedStr = seedStr + seedStr;
                }
                const seedBuffer = Buffer.from(seedStr, "utf-8").subarray(0, 32);
                const derPrefix = Buffer.from("302e020100300506032b657004220420", "hex");
                const privateKey = crypto.createPrivateKey({
                  key: Buffer.concat([derPrefix, seedBuffer]),
                  format: "der",
                  type: "pkcs8"
                });
                const sig = crypto.sign(null, msg, privateKey);
                callbackSignature = sig.toString("hex");
              } catch (signErr) {
                log.error(`[qqbot] Ed25519 callback signature failed: ${signErr}`);
              }
            }
            const responseBody = JSON.stringify({
              plain_token: payload.plain_token,
              signature: callbackSignature
            });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(responseBody);
            return;
          }
          break;
        }
        default:
          log.info(`[qqbot] Unhandled op code: ${event.op}`);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: 0 }));
    } catch (error) {
      log.error(`[qqbot] Webhook error: ${error}`);
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  };
}
async function handleDispatch(event, onMessage, log) {
  const eventType = event.t;
  const data = event.d;
  if (!eventType || !data) {
    return;
  }
  log.info(`[qqbot] Received event: ${eventType}`);
  switch (eventType) {
    case QqbotEventType.C2C_MESSAGE_CREATE:
    case QqbotEventType.DIRECT_MESSAGE_CREATE: {
      await onMessage(data, "direct");
      break;
    }
    case QqbotEventType.GROUP_AT_MESSAGE_CREATE: {
      await onMessage(data, "group");
      break;
    }
    case QqbotEventType.MESSAGE_CREATE: {
      await onMessage(data, "channel");
      break;
    }
    default:
      log.info(`[qqbot] Unhandled event type: ${eventType}`);
  }
}
export {
  createQqbotWebhookHandler
};
