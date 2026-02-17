/**
 * 媒体处理模块
 *
 * 负责媒体下载和路径解析
 */

import { getWechatMiniprogramRuntime } from "./runtime.js";
import path from "node:path";

export interface MediaInfo {
  mediaUrls: string[];
  mediaTypes: string[];
  mediaPaths: string[];
}

/**
 * 下载媒体到本地
 */
export async function downloadMedia(
  mediaUrls: string[],
  mediaTypes: string[],
  accountId: string,
  log?: { error?: (msg: string) => void },
): Promise<MediaInfo> {
  const mediaPaths: string[] = [];

  if (mediaUrls.length === 0) {
    return { mediaUrls, mediaTypes, mediaPaths };
  }

  try {
    const runtime = getWechatMiniprogramRuntime();
    const maxBytes = 10 * 1024 * 1024; // 10MB 限制

    for (let i = 0; i < mediaUrls.length; i++) {
      const mediaUrl = mediaUrls[i];
      const mediaType = mediaTypes[i] || "image/jpeg";

      try {
        const fetched = await runtime.channel.media.fetchRemoteMedia({
          url: mediaUrl,
        });
        const saved = await runtime.channel.media.saveMediaBuffer(
          fetched.buffer,
          fetched.contentType || mediaType,
          "inbound",
          maxBytes,
        );
        mediaPaths.push(saved.path);
      } catch (downloadError) {
        log?.error?.(
          `[${accountId}] Failed to download media ${i + 1}/${mediaUrls.length}: ${downloadError}`,
        );
      }
    }
  } catch (error) {
    log?.error?.(`[${accountId}] Failed to download media: ${error}`);
  }

  return { mediaUrls, mediaTypes, mediaPaths };
}

/**
 * 解析相对路径为绝对路径（相对于 workspace 目录）
 */
export function resolveMediaPath(mediaPath: string): string {
  if (path.isAbsolute(mediaPath) || mediaPath.startsWith("~")) {
    return mediaPath;
  }

  const runtime = getWechatMiniprogramRuntime();
  const stateDir = runtime.state.resolveStateDir();
  const workspaceDir = path.join(stateDir, "workspace");
  return path.resolve(workspaceDir, mediaPath);
}
