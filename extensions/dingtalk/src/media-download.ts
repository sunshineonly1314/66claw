/**
 * 钉钉媒体下载模块
 * DingTalk Media Download Module
 *
 * 通过 downloadCode 下载钉钉消息中的媒体文件（图片/语音/视频/文件）
 *
 * 流程: downloadCode → DingTalk API → downloadUrl → 流式下载到本地
 *
 * 参考文档:
 * - https://open.dingtalk.com/document/orgapp/download-the-file-content-of-the-robot-receiving-message
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

import { getDingtalkAccessToken } from "./api.js";
import type {
  DingtalkChannelConfig,
  DingtalkRobotMessageEvent,
  MediaDownloadResult,
} from "./types.js";

// ============================================================================
// 常量
// ============================================================================

/** 钉钉文件下载 API */
const DOWNLOAD_API = "https://api.dingtalk.com/v1.0/robot/messageFiles/download";

/** 下载 URL 获取超时: 10s */
const DOWNLOAD_URL_TIMEOUT_MS = 10_000;

/** 文件下载超时: 120s */
const FILE_DOWNLOAD_TIMEOUT_MS = 120_000;

/** 默认分类型大小限制 (bytes) */
const DEFAULT_SIZE_LIMITS: Record<string, number> = {
  picture: 20 * 1024 * 1024,   // 20MB
  audio: 50 * 1024 * 1024,     // 50MB
  video: 100 * 1024 * 1024,    // 100MB
  file: 100 * 1024 * 1024,     // 100MB
};

/** 临时目录 */
const TEMP_DIR = path.join(os.tmpdir(), "dingtalk-media");

/** 临时文件清理周期: 1 小时 */
const TEMP_CLEANUP_MAX_AGE_MS = 60 * 60 * 1000;

type LogInterface = {
  info?: (msg: string) => void;
  warn?: (msg: string) => void;
  error?: (msg: string) => void;
};

// ============================================================================
// 提取可下载媒体引用
// ============================================================================

export interface ExtractedMedia {
  type: "picture" | "audio" | "video" | "file";
  downloadCode: string;
  fileName?: string;
  duration?: number;
  fileSize?: number;
}

/**
 * 从消息事件中提取所有可下载的媒体引用
 */
export function extractMediaFromMessage(data: DingtalkRobotMessageEvent): ExtractedMedia[] {
  const media: ExtractedMedia[] = [];

  switch (data.msgtype) {
    case "picture":
      if (data.picture?.downloadCode) {
        media.push({ type: "picture", downloadCode: data.picture.downloadCode });
      }
      break;
    case "audio":
      if (data.audio?.downloadCode) {
        media.push({
          type: "audio",
          downloadCode: data.audio.downloadCode,
          duration: data.audio.duration,
        });
      }
      break;
    case "video":
      if (data.video?.downloadCode) {
        media.push({
          type: "video",
          downloadCode: data.video.downloadCode,
          duration: data.video.duration,
        });
      }
      break;
    case "file":
      if (data.file?.downloadCode) {
        media.push({
          type: "file",
          downloadCode: data.file.downloadCode,
          fileName: data.file.fileName,
          fileSize: data.file.fileSize,
        });
      }
      break;
  }

  return media;
}

/**
 * 从富文本消息中提取图片 downloadCode 列表
 */
export function extractRichTextImageCodes(data: DingtalkRobotMessageEvent): string[] {
  if (data.msgtype !== "richText" || !data.richText?.richTextList) return [];

  const codes: string[] = [];
  for (const item of data.richText.richTextList) {
    if (item.type === "picture") {
      const code = item.pictureDownloadCode || item.downloadCode;
      if (code) codes.push(code);
    }
  }
  return codes;
}

// ============================================================================
// 核心下载函数
// ============================================================================

/**
 * 通过 downloadCode 获取下载 URL
 */
export async function getDownloadUrl(
  downloadCode: string,
  robotCode: string,
  accessToken: string,
  log?: LogInterface,
): Promise<string> {
  const response = await fetch(DOWNLOAD_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-acs-dingtalk-access-token": accessToken,
    },
    body: JSON.stringify({ downloadCode, robotCode }),
    signal: AbortSignal.timeout(DOWNLOAD_URL_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`获取下载 URL 失败: HTTP ${response.status} ${errText}`);
  }

  const data = (await response.json()) as { downloadUrl?: string; code?: string; message?: string };
  if (!data.downloadUrl) {
    throw new Error(`获取下载 URL 失败: ${data.message || data.code || "无 downloadUrl"}`);
  }

  log?.info?.(`[DingTalk][Download] 获取到下载 URL (code=${downloadCode.slice(0, 20)}...)`);
  return data.downloadUrl;
}

/**
 * 流式下载文件到本地，带大小限制
 */
export async function downloadFile(
  url: string,
  destPath: string,
  maxBytes: number,
  log?: LogInterface,
): Promise<{ fileSize: number; contentType?: string }> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FILE_DOWNLOAD_TIMEOUT_MS),
  });

  if (!response.ok || !response.body) {
    throw new Error(`文件下载失败: HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? undefined;

  // 确保目标目录存在
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const writeStream = fs.createWriteStream(destPath);
  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.length;
      if (totalBytes > maxBytes) {
        writeStream.destroy();
        // 清理不完整的文件
        try { fs.unlinkSync(destPath); } catch { /* ignore */ }
        throw new Error(`文件大小超出限制 (${(maxBytes / 1024 / 1024).toFixed(0)}MB)`);
      }

      writeStream.write(value);
    }

    // 等待写入完成
    await new Promise<void>((resolve, reject) => {
      writeStream.end(() => resolve());
      writeStream.on("error", reject);
    });

    log?.info?.(`[DingTalk][Download] 文件下载完成: ${destPath} (${(totalBytes / 1024).toFixed(1)}KB)`);
    return { fileSize: totalBytes, contentType };
  } catch (err) {
    writeStream.destroy();
    try { fs.unlinkSync(destPath); } catch { /* ignore */ }
    throw err;
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
}

/**
 * 下载钉钉媒体文件的完整管线
 * downloadCode → downloadUrl → 流式下载 → 本地文件
 */
export async function downloadDingTalkFile(
  config: DingtalkChannelConfig,
  downloadCode: string,
  mediaType: string,
  options?: {
    fileName?: string;
    log?: LogInterface;
  },
): Promise<MediaDownloadResult | null> {
  const { log } = options ?? {};
  const appKey = config.app?.appKey;
  const appSecret = config.app?.appSecret;
  const robotCode = config.app?.robotCode;

  if (!appKey || !appSecret) {
    log?.warn?.(`[DingTalk][Download] 缺少 appKey/appSecret，跳过下载`);
    return null;
  }

  if (!robotCode) {
    log?.warn?.(`[DingTalk][Download] 缺少 robotCode，跳过下载 (robotCode 用于文件下载 API)`);
    return null;
  }

  // 获取 access token
  let accessToken: string;
  try {
    accessToken = await getDingtalkAccessToken(appKey, appSecret);
  } catch (err) {
    log?.error?.(`[DingTalk][Download] 获取 token 失败: ${err}`);
    return null;
  }

  // 获取下载 URL
  let downloadUrl: string;
  try {
    downloadUrl = await getDownloadUrl(downloadCode, robotCode, accessToken, log);
  } catch (err) {
    log?.error?.(`[DingTalk][Download] 获取下载 URL 失败: ${err}`);
    return null;
  }

  // 确定大小限制
  const configLimits = config.media?.sizeLimits;
  const limitMB = configLimits?.[mediaType as keyof typeof configLimits];
  const maxBytes = limitMB
    ? limitMB * 1024 * 1024
    : (DEFAULT_SIZE_LIMITS[mediaType] ?? DEFAULT_SIZE_LIMITS.file!);

  // 确保临时目录存在
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  // 生成临时文件名
  const ext = resolveFileExtension(mediaType, options?.fileName);
  const tempFileName = `${mediaType}_${crypto.randomUUID()}${ext}`;
  const destPath = path.join(TEMP_DIR, tempFileName);

  // 下载文件
  try {
    const result = await downloadFile(downloadUrl, destPath, maxBytes, log);
    return {
      filePath: destPath,
      fileSize: result.fileSize,
      contentType: result.contentType,
      fileName: options?.fileName ?? tempFileName,
      mediaType,
    };
  } catch (err) {
    log?.error?.(`[DingTalk][Download] 下载失败 (${mediaType}): ${err}`);
    return null;
  }
}

/**
 * 批量下载富文本中的图片 (continue-on-failure)
 */
export async function downloadRichTextImages(
  config: DingtalkChannelConfig,
  codes: string[],
  log?: LogInterface,
): Promise<MediaDownloadResult[]> {
  const results: MediaDownloadResult[] = [];

  for (const code of codes) {
    try {
      const result = await downloadDingTalkFile(config, code, "picture", { log });
      if (result) results.push(result);
    } catch (err) {
      log?.warn?.(`[DingTalk][Download] 富文本图片下载失败 (跳过): ${err}`);
      // continue-on-failure
    }
  }

  return results;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 根据媒体类型和文件名推断扩展名
 */
function resolveFileExtension(mediaType: string, fileName?: string): string {
  if (fileName) {
    const ext = path.extname(fileName);
    if (ext) return ext;
  }

  switch (mediaType) {
    case "picture": return ".jpg";
    case "audio": return ".amr";
    case "video": return ".mp4";
    default: return "";
  }
}

/**
 * 清理临时文件 (超过指定时间的)
 */
export async function cleanTempFiles(
  maxAgeMs: number = TEMP_CLEANUP_MAX_AGE_MS,
): Promise<number> {
  if (!fs.existsSync(TEMP_DIR)) return 0;

  const now = Date.now();
  let cleaned = 0;

  try {
    const entries = fs.readdirSync(TEMP_DIR);
    for (const entry of entries) {
      try {
        const filePath = path.join(TEMP_DIR, entry);
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      } catch {
        // 跳过无法处理的文件
      }
    }
  } catch {
    // 目录不可读
  }

  return cleaned;
}
