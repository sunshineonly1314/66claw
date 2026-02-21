import { getWechatMiniprogramRuntime } from "./runtime.js";
import path from "node:path";
async function downloadMedia(mediaUrls, mediaTypes, accountId, log) {
  const mediaPaths = [];
  if (mediaUrls.length === 0) {
    return { mediaUrls, mediaTypes, mediaPaths };
  }
  try {
    const runtime = getWechatMiniprogramRuntime();
    const maxBytes = 10 * 1024 * 1024;
    for (let i = 0; i < mediaUrls.length; i++) {
      const mediaUrl = mediaUrls[i];
      const mediaType = mediaTypes[i] || "image/jpeg";
      try {
        const fetched = await runtime.channel.media.fetchRemoteMedia({
          url: mediaUrl
        });
        const saved = await runtime.channel.media.saveMediaBuffer(
          fetched.buffer,
          fetched.contentType || mediaType,
          "inbound",
          maxBytes
        );
        mediaPaths.push(saved.path);
      } catch (downloadError) {
        log?.error?.(
          `[${accountId}] Failed to download media ${i + 1}/${mediaUrls.length}: ${downloadError}`
        );
      }
    }
  } catch (error) {
    log?.error?.(`[${accountId}] Failed to download media: ${error}`);
  }
  return { mediaUrls, mediaTypes, mediaPaths };
}
function resolveMediaPath(mediaPath) {
  if (path.isAbsolute(mediaPath) || mediaPath.startsWith("~")) {
    return mediaPath;
  }
  const runtime = getWechatMiniprogramRuntime();
  const stateDir = runtime.state.resolveStateDir();
  const workspaceDir = path.join(stateDir, "workspace");
  return path.resolve(workspaceDir, mediaPath);
}
export {
  downloadMedia,
  resolveMediaPath
};
