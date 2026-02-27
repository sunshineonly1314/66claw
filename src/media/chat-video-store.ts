/**
 * Chat Video Store — persists AI-generated videos to disk with TTL expiration.
 *
 * Videos are stored under:
 *   ~/.openclawcn/media/chat-videos/{sessionKey}/{id}.mp4
 *
 * Each session directory has a `_manifest.json` tracking video metadata,
 * enabling fast lookup during `chat.history` without scanning files.
 *
 * TTL: 365 days (1 year).
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { resolveConfigDir } from "../utils.js";

const CHAT_VIDEOS_SUBDIR = "chat-videos";
const MANIFEST_FILENAME = "_manifest.json";
/** AI-generated videos: 1 year retention. */
const VIDEO_RETENTION_DAYS = 365;

// Resolve root: ~/.openclawcn/media/chat-videos/
function resolveChatVideosRoot(): string {
  return path.join(resolveConfigDir(), "media", CHAT_VIDEOS_SUBDIR);
}

function resolveSessionDir(sessionKey: string): string {
  const safe = sessionKey.replace(/[^a-zA-Z0-9_\-.]/g, "_");
  return path.join(resolveChatVideosRoot(), safe);
}

function resolveManifestPath(sessionKey: string): string {
  return path.join(resolveSessionDir(sessionKey), MANIFEST_FILENAME);
}

export interface VideoGenerationMeta {
  /** The prompt used to generate the video. */
  prompt: string;
  /** Model ID used for generation. */
  model: string;
  /** Provider (zhipu / siliconflow). */
  provider: string;
  /** Requested video size. */
  size: string;
  /** Video duration in seconds (if known). */
  durationSeconds?: number;
  /** Cover image URL (if available). */
  coverImageUrl?: string;
}

export interface ChatVideoEntry {
  /** Unique ID: "gen-{timestamp}-{hash}" */
  id: string;
  /** Filename on disk */
  file: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Timestamp (ms since epoch) */
  timestamp: number;
  /** First ~100 chars of prompt (for matching) */
  messageText: string;
  /** ISO string when saved */
  createdAt: string;
  /** Always "generated" for AI-created videos. */
  source: "generated";
  /** Generation metadata. */
  generationMeta: VideoGenerationMeta;
}

interface ChatVideoManifest {
  videos: ChatVideoEntry[];
}

// ---------------------------------------------------------------------------
// Read / write manifest
// ---------------------------------------------------------------------------

async function readManifest(sessionKey: string): Promise<ChatVideoManifest> {
  try {
    const raw = await fs.readFile(resolveManifestPath(sessionKey), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.videos)) return parsed as ChatVideoManifest;
  } catch {
    // file missing or corrupt — start fresh
  }
  return { videos: [] };
}

async function writeManifest(sessionKey: string, manifest: ChatVideoManifest): Promise<void> {
  const dir = resolveSessionDir(sessionKey);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const manifestPath = resolveManifestPath(sessionKey);
  const tmpPath = manifestPath + ".tmp";
  // Atomic write: write to temp file then rename (crash-safe)
  await fs.writeFile(tmpPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  await fs.rename(tmpPath, manifestPath);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save an AI-generated video to disk with generation metadata.
 *
 * @returns The saved video entry, or null if the save failed silently.
 */
export async function saveGeneratedVideo(params: {
  sessionKey: string;
  /** Raw video buffer. */
  data: Buffer;
  mimeType: string;
  meta: VideoGenerationMeta;
}): Promise<ChatVideoEntry | null> {
  try {
    const { sessionKey, mimeType, meta } = params;
    const buf = params.data;
    const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);
    const ts = Date.now();
    const id = `gen-${ts}-${hash}`;
    const file = `${id}.mp4`;

    const dir = resolveSessionDir(sessionKey);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(dir, file), buf, { mode: 0o600 });

    const entry: ChatVideoEntry = {
      id,
      file,
      mimeType,
      sizeBytes: buf.length,
      timestamp: ts,
      messageText: meta.prompt.slice(0, 100),
      createdAt: new Date().toISOString(),
      source: "generated",
      generationMeta: meta,
    };

    const manifest = await readManifest(sessionKey);
    if (!manifest.videos.some((e) => e.id === id)) {
      manifest.videos.push(entry);
      await writeManifest(sessionKey, manifest);
    }

    return entry;
  } catch {
    return null;
  }
}

/**
 * Resolve the absolute path for a chat video file.
 * Returns null if the file does not exist.
 */
export function resolveChatVideoPath(sessionKey: string, videoFile: string): string | null {
  const safe = sessionKey.replace(/[^a-zA-Z0-9_\-.]/g, "_");
  // Sanitize videoFile -- strip path traversal components
  const safeVideoFile = videoFile.replace(/[^a-zA-Z0-9_\-.]/g, "_");
  const filePath = path.join(resolveChatVideosRoot(), safe, safeVideoFile);
  try {
    if (fsSync.existsSync(filePath)) return filePath;
  } catch {
    // ignore
  }
  return null;
}

/**
 * Load all video entries for a session (metadata only, no file content).
 */
export async function loadChatVideos(sessionKey: string): Promise<ChatVideoEntry[]> {
  const manifest = await readManifest(sessionKey);
  return manifest.videos;
}

/**
 * Delete all videos for expired sessions.
 * A session's videos are expired if ALL videos in it are older than maxAgeDays (default 365).
 */
export async function cleanExpiredChatVideos(maxAgeDays = VIDEO_RETENTION_DAYS): Promise<number> {
  const root = resolveChatVideosRoot();
  let deleted = 0;

  let sessionDirs: string[];
  try {
    sessionDirs = await fs.readdir(root);
  } catch {
    return 0; // root dir doesn't exist yet
  }

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  for (const dirName of sessionDirs) {
    const dirPath = path.join(root, dirName);
    const stat = await fs.stat(dirPath).catch(() => null);
    if (!stat?.isDirectory()) continue;

    try {
      const manifestPath = path.join(dirPath, MANIFEST_FILENAME);
      const raw = await fs.readFile(manifestPath, "utf8").catch(() => null);
      if (!raw) {
        // No manifest — check dir mtime as fallback
        if (stat.mtimeMs < cutoff) {
          await fs.rm(dirPath, { recursive: true, force: true });
          deleted++;
        }
        continue;
      }

      const manifest = JSON.parse(raw) as ChatVideoManifest;
      const allExpired = manifest.videos.every((e) => {
        const t = new Date(e.createdAt).getTime();
        return t < cutoff;
      });

      if (allExpired) {
        await fs.rm(dirPath, { recursive: true, force: true });
        deleted++;
      }
    } catch {
      // Skip corrupt dirs
    }
  }

  return deleted;
}
