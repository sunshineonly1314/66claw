import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Readable } from "node:stream";
import { createFeishuClient } from "./client.js";
import { getFeishuRuntime } from "./runtime.js";
import { resolveReceiveIdType, normalizeFeishuTarget } from "./targets.js";
async function downloadImageFeishu(params) {
  const { cfg, imageKey } = params;
  const client = createFeishuClient(cfg);
  const response = await client.im.image.get({
    path: { image_key: imageKey }
  });
  const responseAny = response;
  if (responseAny.code !== void 0 && responseAny.code !== 0) {
    throw new Error(`\u98DE\u4E66\u56FE\u7247\u4E0B\u8F7D\u5931\u8D25: ${responseAny.msg || `code ${responseAny.code}`}`);
  }
  const buffer = await extractBufferFromResponse(response, imageKey, "image");
  return { buffer };
}
async function downloadMessageResourceFeishu(params) {
  const { cfg, messageId, fileKey, type } = params;
  const client = createFeishuClient(cfg);
  const response = await client.im.messageResource.get({
    path: { message_id: messageId, file_key: fileKey },
    params: { type }
  });
  const responseAny = response;
  if (responseAny.code !== void 0 && responseAny.code !== 0) {
    throw new Error(`\u98DE\u4E66\u6D88\u606F\u8D44\u6E90\u4E0B\u8F7D\u5931\u8D25: ${responseAny.msg || `code ${responseAny.code}`}`);
  }
  const buffer = await extractBufferFromResponse(response, fileKey, "resource");
  return { buffer };
}
async function extractBufferFromResponse(response, key, type) {
  const responseAny = response;
  if (Buffer.isBuffer(response)) {
    return response;
  }
  if (response instanceof ArrayBuffer) {
    return Buffer.from(response);
  }
  if (responseAny.data && Buffer.isBuffer(responseAny.data)) {
    return responseAny.data;
  }
  if (responseAny.data instanceof ArrayBuffer) {
    return Buffer.from(responseAny.data);
  }
  if (typeof responseAny.getReadableStream === "function") {
    const stream = responseAny.getReadableStream();
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  if (typeof responseAny.writeFile === "function") {
    const tmpPath = path.join(os.tmpdir(), `feishu_${type}_${Date.now()}_${key}`);
    await responseAny.writeFile(tmpPath);
    const buffer = await fs.promises.readFile(tmpPath);
    await fs.promises.unlink(tmpPath).catch(() => {
    });
    return buffer;
  }
  if (typeof responseAny[Symbol.asyncIterator] === "function") {
    const chunks = [];
    for await (const chunk of responseAny) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  if (typeof responseAny.read === "function") {
    const chunks = [];
    for await (const chunk of responseAny) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  const keys = Object.keys(responseAny);
  const types = keys.map((k) => `${k}: ${typeof responseAny[k]}`).join(", ");
  throw new Error(`\u98DE\u4E66 ${type} \u4E0B\u8F7D\u5931\u8D25: \u672A\u77E5\u54CD\u5E94\u683C\u5F0F\u3002Keys: [${types}]`);
}
async function uploadImageFeishu(params) {
  const { cfg, image, imageType = "message" } = params;
  const client = createFeishuClient(cfg);
  const imageStream = typeof image === "string" ? fs.createReadStream(image) : Readable.from(image);
  const response = await client.im.image.create({
    data: {
      image_type: imageType,
      image: imageStream
    }
  });
  const responseAny = response;
  if (responseAny.code !== void 0 && responseAny.code !== 0) {
    throw new Error(`\u98DE\u4E66\u56FE\u7247\u4E0A\u4F20\u5931\u8D25: ${responseAny.msg || `code ${responseAny.code}`}`);
  }
  const imageKey = responseAny.image_key ?? responseAny.data?.image_key;
  if (!imageKey) {
    throw new Error("\u98DE\u4E66\u56FE\u7247\u4E0A\u4F20\u5931\u8D25: \u672A\u8FD4\u56DE image_key");
  }
  return { imageKey };
}
async function uploadFileFeishu(params) {
  const { cfg, file, fileName, fileType, duration } = params;
  const client = createFeishuClient(cfg);
  const fileStream = typeof file === "string" ? fs.createReadStream(file) : Readable.from(file);
  const response = await client.im.file.create({
    data: {
      file_type: fileType,
      file_name: fileName,
      file: fileStream,
      ...duration !== void 0 && { duration }
    }
  });
  const responseAny = response;
  if (responseAny.code !== void 0 && responseAny.code !== 0) {
    throw new Error(`\u98DE\u4E66\u6587\u4EF6\u4E0A\u4F20\u5931\u8D25: ${responseAny.msg || `code ${responseAny.code}`}`);
  }
  const fileKey = responseAny.file_key ?? responseAny.data?.file_key;
  if (!fileKey) {
    throw new Error("\u98DE\u4E66\u6587\u4EF6\u4E0A\u4F20\u5931\u8D25: \u672A\u8FD4\u56DE file_key");
  }
  return { fileKey };
}
async function sendImageFeishu(params) {
  const { cfg, to, imageKey, replyToMessageId } = params;
  const client = createFeishuClient(cfg);
  const receiveId = normalizeFeishuTarget(to);
  if (!receiveId) {
    throw new Error(`\u65E0\u6548\u7684\u98DE\u4E66\u76EE\u6807: ${to}`);
  }
  const receiveIdType = resolveReceiveIdType(receiveId);
  const content = JSON.stringify({ image_key: imageKey });
  if (replyToMessageId) {
    const response2 = await client.im.message.reply({
      path: { message_id: replyToMessageId },
      data: { content, msg_type: "image" }
    });
    if (response2.code !== 0) {
      throw new Error(`\u98DE\u4E66\u56FE\u7247\u56DE\u590D\u5931\u8D25: ${response2.msg || `code ${response2.code}`}`);
    }
    return { messageId: response2.data?.message_id ?? "unknown", chatId: receiveId };
  }
  const response = await client.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: { receive_id: receiveId, content, msg_type: "image" }
  });
  if (response.code !== 0) {
    throw new Error(`\u98DE\u4E66\u56FE\u7247\u53D1\u9001\u5931\u8D25: ${response.msg || `code ${response.code}`}`);
  }
  return { messageId: response.data?.message_id ?? "unknown", chatId: receiveId };
}
async function sendFileFeishu(params) {
  const { cfg, to, fileKey, replyToMessageId } = params;
  const client = createFeishuClient(cfg);
  const receiveId = normalizeFeishuTarget(to);
  if (!receiveId) {
    throw new Error(`\u65E0\u6548\u7684\u98DE\u4E66\u76EE\u6807: ${to}`);
  }
  const receiveIdType = resolveReceiveIdType(receiveId);
  const content = JSON.stringify({ file_key: fileKey });
  if (replyToMessageId) {
    const response2 = await client.im.message.reply({
      path: { message_id: replyToMessageId },
      data: { content, msg_type: "file" }
    });
    if (response2.code !== 0) {
      throw new Error(`\u98DE\u4E66\u6587\u4EF6\u56DE\u590D\u5931\u8D25: ${response2.msg || `code ${response2.code}`}`);
    }
    return { messageId: response2.data?.message_id ?? "unknown", chatId: receiveId };
  }
  const response = await client.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: { receive_id: receiveId, content, msg_type: "file" }
  });
  if (response.code !== 0) {
    throw new Error(`\u98DE\u4E66\u6587\u4EF6\u53D1\u9001\u5931\u8D25: ${response.msg || `code ${response.code}`}`);
  }
  return { messageId: response.data?.message_id ?? "unknown", chatId: receiveId };
}
function detectFileType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".opus":
    case ".ogg":
      return "opus";
    case ".mp4":
    case ".mov":
    case ".avi":
      return "mp4";
    case ".pdf":
      return "pdf";
    case ".doc":
    case ".docx":
      return "doc";
    case ".xls":
    case ".xlsx":
      return "xls";
    case ".ppt":
    case ".pptx":
      return "ppt";
    default:
      return "stream";
  }
}
async function sendMediaFeishu(params) {
  const { cfg, to, mediaUrl, mediaBuffer, fileName, replyToMessageId } = params;
  const mediaMaxBytes = (cfg?.mediaMaxMb ?? 30) * 1024 * 1024;
  let buffer;
  let name;
  if (mediaBuffer) {
    buffer = mediaBuffer;
    name = fileName ?? "file";
  } else if (mediaUrl) {
    const loaded = await getFeishuRuntime().media.loadWebMedia(mediaUrl, {
      maxBytes: mediaMaxBytes,
      optimizeImages: false
    });
    buffer = loaded.buffer;
    name = fileName ?? loaded.fileName ?? "file";
  } else {
    throw new Error("\u5FC5\u987B\u63D0\u4F9B mediaUrl \u6216 mediaBuffer");
  }
  const ext = path.extname(name).toLowerCase();
  const isImage = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".ico", ".tiff"].includes(ext);
  if (isImage) {
    const { imageKey } = await uploadImageFeishu({ cfg, image: buffer });
    return sendImageFeishu({ cfg, to, imageKey, replyToMessageId });
  } else {
    const fileType = detectFileType(name);
    const { fileKey } = await uploadFileFeishu({ cfg, file: buffer, fileName: name, fileType });
    return sendFileFeishu({ cfg, to, fileKey, replyToMessageId });
  }
}
export {
  detectFileType,
  downloadImageFeishu,
  downloadMessageResourceFeishu,
  sendFileFeishu,
  sendImageFeishu,
  sendMediaFeishu,
  uploadFileFeishu,
  uploadImageFeishu
};
