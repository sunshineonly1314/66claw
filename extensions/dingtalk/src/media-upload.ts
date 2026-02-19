/**
 * 钉钉图片上传模块
 * DingTalk Media Upload Module
 *
 * 自动识别 AI 回复中的本地图片路径，上传到钉钉并替换为 media_id
 *
 * 支持的图片路径格式:
 * - file:///path/to/image.jpg
 * - MEDIA:/path/to/image.jpg
 * - /tmp/xxx.png (macOS/Linux)
 * - /var/folders/xxx.jpg
 * - C:\Users\xxx\photo.jpg (Windows)
 */

import fs from "node:fs";
import path from "node:path";

import type { DingtalkChannelConfig } from "./types.js";

// ============================================================================
// 常量
// ============================================================================

/**
 * 匹配 markdown 图片中的本地文件路径（跨平台）
 */
const LOCAL_IMAGE_RE =
  /!\[([^\]]*)\]\(((?:file:\/\/\/|MEDIA:|attachment:\/\/\/)[^\s)]+|\/(?:tmp|var|private|Users|home|root)[^\s)]+|[A-Za-z]:[\\/][^\s)]+)\)/g;

/**
 * 匹配纯文本中的本地图片路径
 */
const BARE_IMAGE_PATH_RE =
  /`?((?:\/(?:tmp|var|private|Users|home|root)\/[^\s`'",)]+|[A-Za-z]:[\\/][^\s`'",)]+)\.(?:png|jpg|jpeg|gif|bmp|webp))`?/gi;

/** OAPI Token 获取超时: 10 秒 */
const TOKEN_TIMEOUT_MS = 10_000;

/** 文件上传超时: 30 秒 */
const UPLOAD_TIMEOUT_MS = 30_000;

/** 最大上传文件大小: 10 MB */
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

// ============================================================================
// OAPI Token 获取
// ============================================================================

let oapiTokenCache: { token: string; expiresAt: number } | null = null;

/**
 * 获取 OAPI Access Token (用于图片上传)
 */
export async function getOapiAccessToken(config: DingtalkChannelConfig): Promise<string | null> {
  const appKey = config.app?.appKey;
  const appSecret = config.app?.appSecret;

  if (!appKey || !appSecret) {
    return null;
  }

  // 检查缓存
  if (oapiTokenCache && oapiTokenCache.expiresAt > Date.now() + 60000) {
    return oapiTokenCache.token;
  }

  try {
    const resp = await fetch(
      `https://oapi.dingtalk.com/gettoken?appkey=${encodeURIComponent(appKey)}&appsecret=${encodeURIComponent(appSecret)}`,
      { signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS) },
    );
    const data = (await resp.json()) as { errcode?: number; access_token?: string; expires_in?: number };

    if (data.errcode === 0 && data.access_token) {
      oapiTokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000 - 300000,
      };
      return data.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// 图片上传
// ============================================================================

/**
 * 去掉 file:// / MEDIA: / attachment:// 前缀，得到实际的绝对路径
 */
function toLocalPath(raw: string): string {
  let p = raw;
  if (p.startsWith("file://")) p = p.replace("file://", "");
  else if (p.startsWith("MEDIA:")) p = p.replace("MEDIA:", "");
  else if (p.startsWith("attachment://")) p = p.replace("attachment://", "");

  // 解码 URL 编码的路径
  try {
    p = decodeURIComponent(p);
  } catch {
    // 解码失败则保持原样
  }
  return p;
}

/**
 * 上传本地文件到钉钉，返回 media_id
 */
export async function uploadToDingTalk(
  filePath: string,
  oapiToken: string,
  log?: { info?: (msg: string) => void; warn?: (msg: string) => void; error?: (msg: string) => void },
): Promise<string | null> {
  try {
    const absPath = toLocalPath(filePath);
    if (!fs.existsSync(absPath)) {
      log?.warn?.(`[DingTalk][Media] 文件不存在: ${absPath}`);
      return null;
    }

    // 检查文件大小
    const stat = fs.statSync(absPath);
    if (stat.size > MAX_UPLOAD_SIZE) {
      log?.warn?.(`[DingTalk][Media] 文件过大 (${(stat.size / 1024 / 1024).toFixed(1)}MB > ${MAX_UPLOAD_SIZE / 1024 / 1024}MB): ${absPath}`);
      return null;
    }

    // 使用 FormData 上传
    const fileBuffer = fs.readFileSync(absPath);
    const fileName = path.basename(absPath);
    const formData = new FormData();
    formData.append("media", new Blob([fileBuffer]), fileName);

    log?.info?.(`[DingTalk][Media] 上传图片: ${absPath} (${(stat.size / 1024).toFixed(1)}KB)`);
    const resp = await fetch(
      `https://oapi.dingtalk.com/media/upload?access_token=${oapiToken}&type=image`,
      {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      },
    );

    const data = (await resp.json()) as { media_id?: string; errcode?: number; errmsg?: string };
    if (data.media_id) {
      log?.info?.(`[DingTalk][Media] 上传成功: media_id=${data.media_id}`);
      return data.media_id;
    }

    log?.warn?.(`[DingTalk][Media] 上传返回无 media_id: ${JSON.stringify(data)}`);
    return null;
  } catch (err) {
    log?.error?.(`[DingTalk][Media] 上传失败: ${err}`);
    return null;
  }
}

// ============================================================================
// 内容处理
// ============================================================================

/**
 * 扫描内容中的本地图片路径，上传到钉钉并替换为 media_id
 */
export async function processLocalImages(
  content: string,
  oapiToken: string | null,
  log?: { info?: (msg: string) => void; warn?: (msg: string) => void; error?: (msg: string) => void },
): Promise<string> {
  if (!oapiToken) {
    log?.warn?.(`[DingTalk][Media] 无 oapiToken，跳过图片后处理`);
    return content;
  }

  let result = content;

  // 第一步：匹配 markdown 图片语法 ![alt](path)
  const mdMatches = [...content.matchAll(LOCAL_IMAGE_RE)];
  if (mdMatches.length > 0) {
    log?.info?.(`[DingTalk][Media] 检测到 ${mdMatches.length} 个 markdown 图片，开始上传...`);
    for (const match of mdMatches) {
      const [fullMatch, alt, rawPath] = match;
      const mediaId = await uploadToDingTalk(rawPath, oapiToken, log);
      if (mediaId) {
        result = result.replace(fullMatch, `![${alt}](${mediaId})`);
      }
    }
  }

  // 第二步：匹配纯文本中的本地图片路径
  const bareMatches = [...result.matchAll(BARE_IMAGE_PATH_RE)];
  const newBareMatches = bareMatches.filter((m) => {
    // 检查这个路径是否已经在 ![...](...) 中
    const idx = m.index!;
    const before = result.slice(Math.max(0, idx - 10), idx);
    return !before.includes("](");
  });

  if (newBareMatches.length > 0) {
    log?.info?.(`[DingTalk][Media] 检测到 ${newBareMatches.length} 个纯文本图片路径，开始上传...`);
    // 从后往前替换，避免 index 偏移
    for (const match of newBareMatches.reverse()) {
      const [fullMatch, rawPath] = match;
      log?.info?.(`[DingTalk][Media] 纯文本图片: "${fullMatch}" -> path="${rawPath}"`);
      const mediaId = await uploadToDingTalk(rawPath, oapiToken, log);
      if (mediaId) {
        const replacement = `![](${mediaId})`;
        result = result.slice(0, match.index!) + result.slice(match.index!).replace(fullMatch, replacement);
        log?.info?.(`[DingTalk][Media] 替换纯文本路径为图片: ${replacement}`);
      }
    }
  }

  if (mdMatches.length === 0 && newBareMatches.length === 0) {
    log?.info?.(`[DingTalk][Media] 未检测到本地图片路径`);
  }

  return result;
}

/**
 * 构建图片使用提示的 system prompt
 */
export function buildMediaSystemPrompt(): string {
  return `## 钉钉图片显示规则

你正在钉钉中与用户对话。显示图片时，直接使用本地文件路径，系统会自动上传处理。

### 正确方式
\`\`\`markdown
![描述](file:///path/to/image.jpg)
![描述](/tmp/screenshot.png)
![描述](/Users/xxx/photo.jpg)
\`\`\`

### 禁止
- 不要自己执行 curl 上传
- 不要猜测或构造 URL
- 不要使用 https://oapi.dingtalk.com/... 这类地址

直接输出本地路径即可，系统会自动上传到钉钉。`;
}

/**
 * 清除 OAPI Token 缓存 (用于测试)
 */
export function clearOapiTokenCache(): void {
  oapiTokenCache = null;
}
