import fs from "node:fs";
import path from "node:path";
const LOCAL_IMAGE_RE = /!\[([^\]]*)\]\(((?:file:\/\/\/|MEDIA:|attachment:\/\/\/)[^\s)]+|\/(?:tmp|var|private|Users|home|root)[^\s)]+|[A-Za-z]:[\\/][^\s)]+)\)/g;
const BARE_IMAGE_PATH_RE = /`?((?:\/(?:tmp|var|private|Users|home|root)\/[^\s`'",)]+|[A-Za-z]:[\\/][^\s`'",)]+)\.(?:png|jpg|jpeg|gif|bmp|webp))`?/gi;
const TOKEN_TIMEOUT_MS = 1e4;
const UPLOAD_TIMEOUT_MS = 3e4;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
let oapiTokenCache = null;
async function getOapiAccessToken(config) {
  const appKey = config.app?.appKey;
  const appSecret = config.app?.appSecret;
  if (!appKey || !appSecret) {
    return null;
  }
  if (oapiTokenCache && oapiTokenCache.expiresAt > Date.now() + 6e4) {
    return oapiTokenCache.token;
  }
  try {
    const resp = await fetch(
      `https://oapi.dingtalk.com/gettoken?appkey=${encodeURIComponent(appKey)}&appsecret=${encodeURIComponent(appSecret)}`,
      { signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS) }
    );
    const data = await resp.json();
    if (data.errcode === 0 && data.access_token) {
      oapiTokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in ?? 7200) * 1e3 - 3e5
      };
      return data.access_token;
    }
    return null;
  } catch {
    return null;
  }
}
function toLocalPath(raw) {
  let p = raw;
  if (p.startsWith("file://")) p = p.replace("file://", "");
  else if (p.startsWith("MEDIA:")) p = p.replace("MEDIA:", "");
  else if (p.startsWith("attachment://")) p = p.replace("attachment://", "");
  try {
    p = decodeURIComponent(p);
  } catch {
  }
  return p;
}
async function uploadToDingTalk(filePath, oapiToken, log) {
  try {
    const absPath = toLocalPath(filePath);
    if (!fs.existsSync(absPath)) {
      log?.warn?.(`[DingTalk][Media] \u6587\u4EF6\u4E0D\u5B58\u5728: ${absPath}`);
      return null;
    }
    const stat = fs.statSync(absPath);
    if (stat.size > MAX_UPLOAD_SIZE) {
      log?.warn?.(`[DingTalk][Media] \u6587\u4EF6\u8FC7\u5927 (${(stat.size / 1024 / 1024).toFixed(1)}MB > ${MAX_UPLOAD_SIZE / 1024 / 1024}MB): ${absPath}`);
      return null;
    }
    const fileBuffer = fs.readFileSync(absPath);
    const fileName = path.basename(absPath);
    const formData = new FormData();
    formData.append("media", new Blob([fileBuffer]), fileName);
    log?.info?.(`[DingTalk][Media] \u4E0A\u4F20\u56FE\u7247: ${absPath} (${(stat.size / 1024).toFixed(1)}KB)`);
    const resp = await fetch(
      `https://oapi.dingtalk.com/media/upload?access_token=${oapiToken}&type=image`,
      {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS)
      }
    );
    const data = await resp.json();
    if (data.media_id) {
      log?.info?.(`[DingTalk][Media] \u4E0A\u4F20\u6210\u529F: media_id=${data.media_id}`);
      return data.media_id;
    }
    log?.warn?.(`[DingTalk][Media] \u4E0A\u4F20\u8FD4\u56DE\u65E0 media_id: ${JSON.stringify(data)}`);
    return null;
  } catch (err) {
    log?.error?.(`[DingTalk][Media] \u4E0A\u4F20\u5931\u8D25: ${err}`);
    return null;
  }
}
async function processLocalImages(content, oapiToken, log) {
  if (!oapiToken) {
    log?.warn?.(`[DingTalk][Media] \u65E0 oapiToken\uFF0C\u8DF3\u8FC7\u56FE\u7247\u540E\u5904\u7406`);
    return content;
  }
  let result = content;
  const mdMatches = [...content.matchAll(LOCAL_IMAGE_RE)];
  if (mdMatches.length > 0) {
    log?.info?.(`[DingTalk][Media] \u68C0\u6D4B\u5230 ${mdMatches.length} \u4E2A markdown \u56FE\u7247\uFF0C\u5F00\u59CB\u4E0A\u4F20...`);
    for (const match of mdMatches) {
      const [fullMatch, alt, rawPath] = match;
      const mediaId = await uploadToDingTalk(rawPath, oapiToken, log);
      if (mediaId) {
        result = result.replace(fullMatch, `![${alt}](${mediaId})`);
      }
    }
  }
  const bareMatches = [...result.matchAll(BARE_IMAGE_PATH_RE)];
  const newBareMatches = bareMatches.filter((m) => {
    const idx = m.index;
    const before = result.slice(Math.max(0, idx - 10), idx);
    return !before.includes("](");
  });
  if (newBareMatches.length > 0) {
    log?.info?.(`[DingTalk][Media] \u68C0\u6D4B\u5230 ${newBareMatches.length} \u4E2A\u7EAF\u6587\u672C\u56FE\u7247\u8DEF\u5F84\uFF0C\u5F00\u59CB\u4E0A\u4F20...`);
    for (const match of newBareMatches.reverse()) {
      const [fullMatch, rawPath] = match;
      log?.info?.(`[DingTalk][Media] \u7EAF\u6587\u672C\u56FE\u7247: "${fullMatch}" -> path="${rawPath}"`);
      const mediaId = await uploadToDingTalk(rawPath, oapiToken, log);
      if (mediaId) {
        const replacement = `![](${mediaId})`;
        result = result.slice(0, match.index) + result.slice(match.index).replace(fullMatch, replacement);
        log?.info?.(`[DingTalk][Media] \u66FF\u6362\u7EAF\u6587\u672C\u8DEF\u5F84\u4E3A\u56FE\u7247: ${replacement}`);
      }
    }
  }
  if (mdMatches.length === 0 && newBareMatches.length === 0) {
    log?.info?.(`[DingTalk][Media] \u672A\u68C0\u6D4B\u5230\u672C\u5730\u56FE\u7247\u8DEF\u5F84`);
  }
  return result;
}
function buildMediaSystemPrompt() {
  return `## \u9489\u9489\u56FE\u7247\u663E\u793A\u89C4\u5219

\u4F60\u6B63\u5728\u9489\u9489\u4E2D\u4E0E\u7528\u6237\u5BF9\u8BDD\u3002\u663E\u793A\u56FE\u7247\u65F6\uFF0C\u76F4\u63A5\u4F7F\u7528\u672C\u5730\u6587\u4EF6\u8DEF\u5F84\uFF0C\u7CFB\u7EDF\u4F1A\u81EA\u52A8\u4E0A\u4F20\u5904\u7406\u3002

### \u6B63\u786E\u65B9\u5F0F
\`\`\`markdown
![\u63CF\u8FF0](file:///path/to/image.jpg)
![\u63CF\u8FF0](/tmp/screenshot.png)
![\u63CF\u8FF0](/Users/xxx/photo.jpg)
\`\`\`

### \u7981\u6B62
- \u4E0D\u8981\u81EA\u5DF1\u6267\u884C curl \u4E0A\u4F20
- \u4E0D\u8981\u731C\u6D4B\u6216\u6784\u9020 URL
- \u4E0D\u8981\u4F7F\u7528 https://oapi.dingtalk.com/... \u8FD9\u7C7B\u5730\u5740

\u76F4\u63A5\u8F93\u51FA\u672C\u5730\u8DEF\u5F84\u5373\u53EF\uFF0C\u7CFB\u7EDF\u4F1A\u81EA\u52A8\u4E0A\u4F20\u5230\u9489\u9489\u3002`;
}
function clearOapiTokenCache() {
  oapiTokenCache = null;
}
export {
  buildMediaSystemPrompt,
  clearOapiTokenCache,
  getOapiAccessToken,
  processLocalImages,
  uploadToDingTalk
};
