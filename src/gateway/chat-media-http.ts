/**
 * Gateway HTTP handler for serving persistent chat-images and chat-videos.
 *
 * Without this handler, requests to `/api/media/chat-images/...` and
 * `/api/media/videos/...` fall through to the SPA catch-all, which returns
 * index.html with `Content-Type: text/html` instead of the actual media file.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveChatImagePath } from "../media/chat-image-store.js";
import { detectMime } from "../media/mime.js";
import { resolveConfigDir } from "../utils.js";
import { openFileWithinRoot, SafeOpenError } from "../infra/fs-safe.js";

const MAX_MEDIA_BYTES = 50 * 1024 * 1024; // 50 MB for images
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB for videos

/** Only allow safe characters in path segments. */
const SAFE_ID_PATTERN = /^[\p{L}\p{N}._:-]+$/u;

function isValidSegment(s: string): boolean {
  return !!s && s.length <= 200 && s !== "." && s !== ".." && SAFE_ID_PATTERN.test(s);
}

/**
 * Handle `/api/media/chat-images/:sessionKey/:imageFile` and
 * `/api/media/videos/:sessionKey/:videoFile` requests.
 *
 * Returns `true` if the request was handled, `false` otherwise.
 */
export async function handleChatMediaHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = req.url?.split("?")[0] ?? "";

  // --- Chat images ---
  const imgMatch = url.match(/^\/api\/media\/chat-images\/([^/]+)\/([^/]+)$/);
  if (imgMatch) {
    const [, rawSessionKey, rawImageFile] = imgMatch;
    const sessionKey = decodeURIComponent(rawSessionKey!);
    const imageFile = decodeURIComponent(rawImageFile!);
    if (!isValidSegment(sessionKey) || !isValidSegment(imageFile)) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain");
      res.end("invalid path");
      return true;
    }

    // Use resolveChatImagePath which handles path sanitization, portable mode,
    // and checks file existence across candidate extensions.
    const filePath = resolveChatImagePath(sessionKey!, imageFile!);
    if (!filePath) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      res.end("not found");
      return true;
    }

    try {
      const stat = await fs.stat(filePath);
      if (stat.size > MAX_MEDIA_BYTES) {
        res.statusCode = 413;
        res.setHeader("Content-Type", "text/plain");
        res.end("too large");
        return true;
      }

      const data = await fs.readFile(filePath);
      const mime = await detectMime({ buffer: data, filePath });
      res.statusCode = 200;
      res.setHeader("Content-Type", mime || "application/octet-stream");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Content-Length", data.length);
      res.end(data);
      return true;
    } catch {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      res.end("not found");
      return true;
    }
  }

  // --- Chat videos ---
  const vidMatch = url.match(/^\/api\/media\/videos\/([^/]+)\/([^/]+)$/);
  if (vidMatch) {
    const [, rawSessionKey, rawVideoFile] = vidMatch;
    const sessionKey = decodeURIComponent(rawSessionKey!);
    const videoFile = decodeURIComponent(rawVideoFile!);
    if (!isValidSegment(sessionKey) || !isValidSegment(videoFile)) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain");
      res.end("invalid path");
      return true;
    }

    const chatVideosRoot = path.join(resolveConfigDir(), "media", "chat-videos");
    // Sanitize session key: URL uses `:` separators but filesystem uses `_`
    // (same transform as resolveChatImagePath in chat-image-store.ts)
    const safeSessionKey = sessionKey.replace(/[^a-zA-Z0-9_\-.]/g, "_");
    const safeVideoFile = videoFile.replace(/[^a-zA-Z0-9_\-.]/g, "_");
    try {
      const { handle, stat } = await openFileWithinRoot({
        rootDir: chatVideosRoot,
        relativePath: path.join(safeSessionKey, safeVideoFile),
      });

      if (stat.size > MAX_VIDEO_BYTES) {
        await handle.close().catch(() => {});
        res.statusCode = 413;
        res.setHeader("Content-Type", "text/plain");
        res.end("too large");
        return true;
      }

      const totalSize = stat.size;
      const contentType = "video/mp4";
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=86400");

      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1]!, 10);
          const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
          if (start >= totalSize || end >= totalSize || start > end) {
            await handle.close().catch(() => {});
            res.statusCode = 416;
            res.setHeader("Content-Range", `bytes */${totalSize}`);
            res.setHeader("Content-Type", "text/plain");
            res.end("range not satisfiable");
            return true;
          }
          const chunkSize = end - start + 1;
          const buf = Buffer.alloc(chunkSize);
          await handle.read(buf, 0, chunkSize, start);
          await handle.close().catch(() => {});
          res.statusCode = 206;
          res.setHeader("Content-Type", contentType);
          res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
          res.setHeader("Content-Length", chunkSize);
          res.end(buf);
          return true;
        }
      }

      // No Range -- serve full file
      const data = await handle.readFile();
      await handle.close().catch(() => {});
      res.statusCode = 200;
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", totalSize);
      res.end(data);
      return true;
    } catch (err) {
      if (err instanceof SafeOpenError) {
        res.statusCode = err.code === "invalid-path" ? 400 : 404;
        res.setHeader("Content-Type", "text/plain");
        res.end(err.code);
        return true;
      }
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      res.end("not found");
      return true;
    }
  }

  return false;
}
