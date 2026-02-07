/**
 * 飞书媒体处理
 * Feishu Media Handling
 *
 * 融合自 m1heng/clawdbot-feishu
 * 支持图片/文件的上传和下载
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Readable } from "node:stream";
import type { FeishuChannelConfig, FeishuSendResult } from "./types.js";
import { createFeishuClient } from "./client.js";
import { resolveReceiveIdType, normalizeFeishuTarget } from "./targets.js";

// ============================================================================
// 类型定义
// ============================================================================

export interface DownloadImageResult {
  buffer: Buffer;
  contentType?: string;
}

export interface DownloadMessageResourceResult {
  buffer: Buffer;
  contentType?: string;
  fileName?: string;
}

export interface UploadImageResult {
  imageKey: string;
}

export interface UploadFileResult {
  fileKey: string;
}

// ============================================================================
// 下载功能
// ============================================================================

/**
 * 下载飞书图片 (通过 image_key)
 */
export async function downloadImageFeishu(params: {
  cfg: FeishuChannelConfig;
  imageKey: string;
}): Promise<DownloadImageResult> {
  const { cfg, imageKey } = params;
  const client = createFeishuClient(cfg);

  const response = await client.im.image.get({
    path: { image_key: imageKey },
  });

  const responseAny = response as any;
  if (responseAny.code !== undefined && responseAny.code !== 0) {
    throw new Error(`飞书图片下载失败: ${responseAny.msg || `code ${responseAny.code}`}`);
  }

  const buffer = await extractBufferFromResponse(response, imageKey, "image");
  return { buffer };
}

/**
 * 下载飞书消息资源 (文件/图片/音频/视频)
 */
export async function downloadMessageResourceFeishu(params: {
  cfg: FeishuChannelConfig;
  messageId: string;
  fileKey: string;
  type: "image" | "file";
}): Promise<DownloadMessageResourceResult> {
  const { cfg, messageId, fileKey, type } = params;
  const client = createFeishuClient(cfg);

  const response = await client.im.messageResource.get({
    path: { message_id: messageId, file_key: fileKey },
    params: { type },
  });

  const responseAny = response as any;
  if (responseAny.code !== undefined && responseAny.code !== 0) {
    throw new Error(`飞书消息资源下载失败: ${responseAny.msg || `code ${responseAny.code}`}`);
  }

  const buffer = await extractBufferFromResponse(response, fileKey, "resource");
  return { buffer };
}

/**
 * 从各种响应格式中提取 Buffer
 */
async function extractBufferFromResponse(
  response: unknown,
  key: string,
  type: string,
): Promise<Buffer> {
  const responseAny = response as any;

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
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  if (typeof responseAny.writeFile === "function") {
    const tmpPath = path.join(os.tmpdir(), `feishu_${type}_${Date.now()}_${key}`);
    await responseAny.writeFile(tmpPath);
    const buffer = await fs.promises.readFile(tmpPath);
    await fs.promises.unlink(tmpPath).catch(() => {});
    return buffer;
  }
  if (typeof responseAny[Symbol.asyncIterator] === "function") {
    const chunks: Buffer[] = [];
    for await (const chunk of responseAny) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  if (typeof responseAny.read === "function") {
    const chunks: Buffer[] = [];
    for await (const chunk of responseAny as Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  const keys = Object.keys(responseAny);
  const types = keys.map((k) => `${k}: ${typeof responseAny[k]}`).join(", ");
  throw new Error(`飞书 ${type} 下载失败: 未知响应格式。Keys: [${types}]`);
}

// ============================================================================
// 上传功能
// ============================================================================

/**
 * 上传图片到飞书
 * 支持格式: JPEG, PNG, WEBP, GIF, TIFF, BMP, ICO
 */
export async function uploadImageFeishu(params: {
  cfg: FeishuChannelConfig;
  image: Buffer | string;
  imageType?: "message" | "avatar";
}): Promise<UploadImageResult> {
  const { cfg, image, imageType = "message" } = params;
  const client = createFeishuClient(cfg);

  const imageStream = typeof image === "string" ? fs.createReadStream(image) : Readable.from(image);

  const response = await client.im.image.create({
    data: {
      image_type: imageType,
      image: imageStream as any,
    },
  });

  const responseAny = response as any;
  if (responseAny.code !== undefined && responseAny.code !== 0) {
    throw new Error(`飞书图片上传失败: ${responseAny.msg || `code ${responseAny.code}`}`);
  }

  const imageKey = responseAny.image_key ?? responseAny.data?.image_key;
  if (!imageKey) {
    throw new Error("飞书图片上传失败: 未返回 image_key");
  }

  return { imageKey };
}

/**
 * 上传文件到飞书
 * 最大 30MB
 */
export async function uploadFileFeishu(params: {
  cfg: FeishuChannelConfig;
  file: Buffer | string;
  fileName: string;
  fileType: "opus" | "mp4" | "pdf" | "doc" | "xls" | "ppt" | "stream";
  duration?: number;
}): Promise<UploadFileResult> {
  const { cfg, file, fileName, fileType, duration } = params;
  const client = createFeishuClient(cfg);

  const fileStream = typeof file === "string" ? fs.createReadStream(file) : Readable.from(file);

  const response = await client.im.file.create({
    data: {
      file_type: fileType,
      file_name: fileName,
      file: fileStream as any,
      ...(duration !== undefined && { duration }),
    },
  });

  const responseAny = response as any;
  if (responseAny.code !== undefined && responseAny.code !== 0) {
    throw new Error(`飞书文件上传失败: ${responseAny.msg || `code ${responseAny.code}`}`);
  }

  const fileKey = responseAny.file_key ?? responseAny.data?.file_key;
  if (!fileKey) {
    throw new Error("飞书文件上传失败: 未返回 file_key");
  }

  return { fileKey };
}

// ============================================================================
// 发送媒体消息
// ============================================================================

/**
 * 发送图片消息
 */
export async function sendImageFeishu(params: {
  cfg: FeishuChannelConfig;
  to: string;
  imageKey: string;
  replyToMessageId?: string;
}): Promise<FeishuSendResult> {
  const { cfg, to, imageKey, replyToMessageId } = params;
  const client = createFeishuClient(cfg);
  const receiveId = normalizeFeishuTarget(to);
  if (!receiveId) {
    throw new Error(`无效的飞书目标: ${to}`);
  }

  const receiveIdType = resolveReceiveIdType(receiveId);
  const content = JSON.stringify({ image_key: imageKey });

  if (replyToMessageId) {
    const response = await client.im.message.reply({
      path: { message_id: replyToMessageId },
      data: { content, msg_type: "image" },
    });
    if (response.code !== 0) {
      throw new Error(`飞书图片回复失败: ${response.msg || `code ${response.code}`}`);
    }
    return { messageId: response.data?.message_id ?? "unknown", chatId: receiveId };
  }

  const response = await client.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: { receive_id: receiveId, content, msg_type: "image" },
  });

  if (response.code !== 0) {
    throw new Error(`飞书图片发送失败: ${response.msg || `code ${response.code}`}`);
  }

  return { messageId: response.data?.message_id ?? "unknown", chatId: receiveId };
}

/**
 * 发送文件消息
 */
export async function sendFileFeishu(params: {
  cfg: FeishuChannelConfig;
  to: string;
  fileKey: string;
  replyToMessageId?: string;
}): Promise<FeishuSendResult> {
  const { cfg, to, fileKey, replyToMessageId } = params;
  const client = createFeishuClient(cfg);
  const receiveId = normalizeFeishuTarget(to);
  if (!receiveId) {
    throw new Error(`无效的飞书目标: ${to}`);
  }

  const receiveIdType = resolveReceiveIdType(receiveId);
  const content = JSON.stringify({ file_key: fileKey });

  if (replyToMessageId) {
    const response = await client.im.message.reply({
      path: { message_id: replyToMessageId },
      data: { content, msg_type: "file" },
    });
    if (response.code !== 0) {
      throw new Error(`飞书文件回复失败: ${response.msg || `code ${response.code}`}`);
    }
    return { messageId: response.data?.message_id ?? "unknown", chatId: receiveId };
  }

  const response = await client.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: { receive_id: receiveId, content, msg_type: "file" },
  });

  if (response.code !== 0) {
    throw new Error(`飞书文件发送失败: ${response.msg || `code ${response.code}`}`);
  }

  return { messageId: response.data?.message_id ?? "unknown", chatId: receiveId };
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 根据文件扩展名检测文件类型
 */
export function detectFileType(
  fileName: string,
): "opus" | "mp4" | "pdf" | "doc" | "xls" | "ppt" | "stream" {
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

/**
 * 检查是否为本地文件路径
 */
function isLocalPath(urlOrPath: string): boolean {
  if (urlOrPath.startsWith("/") || urlOrPath.startsWith("~") || /^[a-zA-Z]:/.test(urlOrPath)) {
    return true;
  }
  try {
    const url = new URL(urlOrPath);
    return url.protocol === "file:";
  } catch {
    return true;
  }
}

/**
 * 发送媒体 (图片或文件)
 * 支持 URL、本地路径、Buffer
 */
export async function sendMediaFeishu(params: {
  cfg: FeishuChannelConfig;
  to: string;
  mediaUrl?: string;
  mediaBuffer?: Buffer;
  fileName?: string;
  replyToMessageId?: string;
}): Promise<FeishuSendResult> {
  const { cfg, to, mediaUrl, mediaBuffer, fileName, replyToMessageId } = params;

  let buffer: Buffer;
  let name: string;

  if (mediaBuffer) {
    buffer = mediaBuffer;
    name = fileName ?? "file";
  } else if (mediaUrl) {
    if (isLocalPath(mediaUrl)) {
      const filePath = mediaUrl.startsWith("~")
        ? mediaUrl.replace("~", process.env.HOME ?? "")
        : mediaUrl.replace("file://", "");

      if (!fs.existsSync(filePath)) {
        throw new Error(`本地文件不存在: ${filePath}`);
      }
      buffer = fs.readFileSync(filePath);
      name = fileName ?? path.basename(filePath);
    } else {
      const response = await fetch(mediaUrl);
      if (!response.ok) {
        throw new Error(`获取媒体失败: ${response.status}`);
      }
      buffer = Buffer.from(await response.arrayBuffer());
      name = fileName ?? (path.basename(new URL(mediaUrl).pathname) || "file");
    }
  } else {
    throw new Error("必须提供 mediaUrl 或 mediaBuffer");
  }

  // 根据扩展名判断是否为图片
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
