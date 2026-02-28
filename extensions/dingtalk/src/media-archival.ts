/**
 * 钉钉媒体归档模块
 * DingTalk Media Archival Module
 *
 * 将下载的媒体文件持久化存储到指定目录，支持自动过期清理。
 *
 * 默认归档路径: E:\openclawcn\media\dingtalk\inbound\{type}\{date}\
 * 可通过 config.media.archival.basePath 自定义。
 */

import fs from "node:fs";
import path from "node:path";

import type { DingtalkChannelConfig, MediaDownloadResult } from "./types.js";

// ============================================================================
// 常量
// ============================================================================

/** 默认归档基础路径 (遵循 CLAUDE.md 安装路径规范) */
const DEFAULT_ARCHIVAL_BASE = path.join("E:", "openclawcn", "media", "dingtalk");

/** 默认归档保留天数 */
const DEFAULT_RETENTION_DAYS = 7;

/** 定期清理间隔: 6 小时 */
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

type LogInterface = {
  info?: (msg: string) => void;
  warn?: (msg: string) => void;
  error?: (msg: string) => void;
};

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 解析归档目录路径
 * 返回格式: {basePath}/inbound/{mediaType}/{YYYY-MM-DD}/
 */
export function resolveArchivalDir(config: DingtalkChannelConfig, mediaType: string): string {
  const basePath = config.media?.archival?.basePath || DEFAULT_ARCHIVAL_BASE;
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(basePath, "inbound", mediaType, dateStr);
}

/**
 * 归档已下载的媒体文件 (从临时目录复制到持久存储)
 */
export async function archiveInboundMedia(
  config: DingtalkChannelConfig,
  downloaded: MediaDownloadResult,
  metadata?: {
    senderId?: string;
    senderNick?: string;
    conversationId?: string;
    msgId?: string;
  },
  log?: LogInterface,
): Promise<{ archivedPath: string } | null> {
  try {
    const archiveDir = resolveArchivalDir(config, downloaded.mediaType);

    // 确保目录存在
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    // 目标文件名: {timestamp}_{senderId}_{originalName}
    const timestamp = Date.now();
    const senderPart = metadata?.senderId ? `_${metadata.senderId}` : "";
    const baseName = path.basename(downloaded.fileName || downloaded.filePath);
    const destFileName = `${timestamp}${senderPart}_${baseName}`;
    const destPath = path.join(archiveDir, destFileName);

    // 复制文件
    fs.copyFileSync(downloaded.filePath, destPath);

    // 写入元数据文件 (可选)
    if (metadata) {
      const metaPath = `${destPath}.meta.json`;
      const metaContent = JSON.stringify({
        ...metadata,
        mediaType: downloaded.mediaType,
        fileSize: downloaded.fileSize,
        contentType: downloaded.contentType,
        archivedAt: new Date().toISOString(),
      }, null, 2);
      fs.writeFileSync(metaPath, metaContent, "utf-8");
    }

    log?.info?.(`[DingTalk][Archive] 媒体已归档: ${destPath} (${(downloaded.fileSize / 1024).toFixed(1)}KB)`);
    return { archivedPath: destPath };
  } catch (err) {
    log?.error?.(`[DingTalk][Archive] 归档失败: ${err}`);
    return null;
  }
}

/**
 * 清理过期归档文件
 * 遍历 {basePath}/inbound/{type}/{date}/ 目录，删除超过 retentionDays 的文件
 */
export async function cleanExpiredArchives(
  config: DingtalkChannelConfig,
  log?: LogInterface,
): Promise<number> {
  const basePath = config.media?.archival?.basePath || DEFAULT_ARCHIVAL_BASE;
  const retentionDays = config.media?.archival?.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  const inboundDir = path.join(basePath, "inbound");
  if (!fs.existsSync(inboundDir)) return 0;

  let cleaned = 0;

  try {
    // 遍历媒体类型目录
    const typeDirs = fs.readdirSync(inboundDir);
    for (const typeDir of typeDirs) {
      const typePath = path.join(inboundDir, typeDir);
      if (!fs.statSync(typePath).isDirectory()) continue;

      // 遍历日期目录
      const dateDirs = fs.readdirSync(typePath);
      for (const dateDir of dateDirs) {
        const datePath = path.join(typePath, dateDir);
        if (!fs.statSync(datePath).isDirectory()) continue;

        // 检查日期目录名 (YYYY-MM-DD)
        const dirDate = new Date(dateDir);
        if (isNaN(dirDate.getTime())) continue;

        if (dirDate.getTime() < cutoffMs) {
          // 整个日期目录过期，递归删除
          const files = fs.readdirSync(datePath);
          for (const file of files) {
            try {
              fs.unlinkSync(path.join(datePath, file));
              cleaned++;
            } catch { /* ignore */ }
          }
          try {
            fs.rmdirSync(datePath);
          } catch { /* ignore if not empty */ }
        }
      }
    }
  } catch (err) {
    log?.error?.(`[DingTalk][Archive] 清理过期归档失败: ${err}`);
  }

  if (cleaned > 0) {
    log?.info?.(`[DingTalk][Archive] 已清理 ${cleaned} 个过期归档文件 (保留 ${retentionDays} 天)`);
  }

  return cleaned;
}

/**
 * 启动定期归档清理任务
 */
export function startArchivalCleanup(
  config: DingtalkChannelConfig,
  log?: LogInterface,
): { stop: () => void } {
  // 启动时立即执行一次清理
  cleanExpiredArchives(config, log).catch(() => {});

  const timer = setInterval(() => {
    cleanExpiredArchives(config, log).catch(() => {});
  }, CLEANUP_INTERVAL_MS);

  return {
    stop: () => {
      clearInterval(timer);
      log?.info?.(`[DingTalk][Archive] 归档清理任务已停止`);
    },
  };
}
