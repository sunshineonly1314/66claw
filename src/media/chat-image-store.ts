/**
 * Chat Image Store — persists webchat image attachments to disk with TTL expiration.
 *
 * Images are stored under:
 *   ~/.openclawcn/media/chat-images/{sessionKey}/{timestamp}-{hash}.{ext}
 *
 * Each session directory has a `_manifest.json` tracking image metadata,
 * enabling fast lookup during `chat.history` without scanning files.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { resolveConfigDir } from "../utils.js";
import { extensionForMime } from "./mime.js";
import { insertMediaAsset, queryBySession, type MediaAssetRow } from "./media-db.js";

const CHAT_IMAGES_SUBDIR = "chat-images";
const MANIFEST_FILENAME = "_manifest.json";
const DEFAULT_RETENTION_DAYS = 7;
/** AI-generated images get longer TTL — users expect to revisit them. */
const GENERATED_RETENTION_DAYS = 30;

// Resolve root: ~/.openclawcn/media/chat-images/
function resolveChatImagesRoot(): string {
  return path.join(resolveConfigDir(), "media", CHAT_IMAGES_SUBDIR);
}

function resolveSessionDir(sessionKey: string): string {
  // Sanitize sessionKey for filesystem safety
  const safe = sessionKey.replace(/[^a-zA-Z0-9_\-.]/g, "_");
  return path.join(resolveChatImagesRoot(), safe);
}

function resolveManifestPath(sessionKey: string): string {
  return path.join(resolveSessionDir(sessionKey), MANIFEST_FILENAME);
}

export interface ImageGenerationMeta {
  /** The prompt used to generate the image. */
  prompt: string;
  /** Revised prompt from the model (e.g. DALL-E 3 rewrites). */
  revisedPrompt?: string;
  /** Model ID used for generation. */
  model: string;
  /** Provider (openai / dashscope / siliconflow / local). */
  provider: string;
  /** Requested image size. */
  size: string;
  /** Style preset. */
  style?: string;
  /** Seed if available (for reproducibility). */
  seed?: number;
  /** Time taken to generate in ms. */
  durationMs?: number;
}

export interface ChatImageEntry {
  /** Unique ID: "{timestamp}-{hash}" */
  id: string;
  /** Filename on disk */
  file: string;
  /** MIME type */
  mimeType: string;
  /** Decoded size in bytes */
  sizeBytes: number;
  /** Message timestamp (ms since epoch) used for matching during history rehydration */
  timestamp: number;
  /** First ~100 chars of the user's message text (for fuzzy matching) */
  messageText: string;
  /** ISO string when the image was saved */
  createdAt: string;
  /** Whether the image was user-uploaded or AI-generated. */
  source?: "upload" | "generated";
  /** Generation metadata (only present for AI-generated images). */
  generationMeta?: ImageGenerationMeta;
}

interface ChatImageManifest {
  images: ChatImageEntry[];
}

// ---------------------------------------------------------------------------
// Read / write manifest
// ---------------------------------------------------------------------------

async function readManifest(sessionKey: string): Promise<ChatImageManifest> {
  try {
    const raw = await fs.readFile(resolveManifestPath(sessionKey), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.images)) return parsed as ChatImageManifest;
  } catch {
    // file missing or corrupt — start fresh
  }
  return { images: [] };
}

async function writeManifest(sessionKey: string, manifest: ChatImageManifest): Promise<void> {
  const dir = resolveSessionDir(sessionKey);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const manifestPath = resolveManifestPath(sessionKey);
  const tmpPath = manifestPath + ".tmp";
  // Atomic write: write to temp file then rename (M13 fix -- crash-safe)
  await fs.writeFile(tmpPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  await fs.rename(tmpPath, manifestPath);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save a chat image to disk and record it in the session manifest.
 *
 * @returns The saved image entry, or null if the save failed silently.
 */
export async function saveChatImage(params: {
  sessionKey: string;
  /** Raw base64 string (NOT data URL) */
  base64: string;
  mimeType: string;
  /** Message timestamp (ms since epoch) */
  timestamp: number;
  /** User's text message (truncated to 100 chars for matching) */
  messageText?: string;
}): Promise<ChatImageEntry | null> {
  try {
    const { sessionKey, base64, mimeType, timestamp } = params;
    const buf = Buffer.from(base64, "base64");
    const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);
    const ext = extensionForMime(mimeType) || ".bin";
    const id = `${timestamp}-${hash}`;
    const file = `${id}${ext}`;

    const dir = resolveSessionDir(sessionKey);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(dir, file), buf, { mode: 0o600 });

    const entry: ChatImageEntry = {
      id,
      file,
      mimeType,
      sizeBytes: buf.length,
      timestamp,
      messageText: (params.messageText ?? "").slice(0, 100),
      createdAt: new Date().toISOString(),
    };

    const manifest = await readManifest(sessionKey);
    // Avoid duplicates (same timestamp + hash)
    if (!manifest.images.some((e) => e.id === id)) {
      manifest.images.push(entry);
      await writeManifest(sessionKey, manifest);
    }

    // [CN-FEAT:media-sqlite] Dual-write: persist metadata to SQLite for fast querying
    try {
      insertMediaAsset({
        id,
        session_key: sessionKey,
        type: "image",
        file,
        url: `/api/media/chat-images/${sessionKey}/${file}`,
        mime_type: mimeType,
        size_bytes: buf.length,
        source: "upload",
        prompt: null,
        revised_prompt: null,
        model: null,
        provider: null,
        image_size: null,
        style: null,
        seed: null,
        duration_ms: null,
        duration_secs: null,
        cover_url: null,
        message_text: (params.messageText ?? "").slice(0, 100),
        created_at: entry.createdAt,
        expires_at: new Date(Date.now() + DEFAULT_RETENTION_DAYS * 86400000).toISOString(),
      });
    } catch {
      // Non-fatal: SQLite write failure should not block image save
    }

    return entry;
  } catch {
    // Non-fatal: image persistence is best-effort
    return null;
  }
}

/**
 * Save an AI-generated image to disk with generation metadata.
 *
 * Accepts either a Buffer or a base64 string. For remote URLs, the caller
 * must download the image first — this function does not fetch.
 *
 * @returns The saved image entry, or null if the save failed silently.
 */
export async function saveGeneratedImage(params: {
  sessionKey: string;
  /** Raw image buffer OR base64 string (NOT data URL). */
  data: Buffer | string;
  mimeType: string;
  meta: ImageGenerationMeta;
}): Promise<ChatImageEntry | null> {
  try {
    const { sessionKey, mimeType, meta } = params;
    const buf = typeof params.data === "string" ? Buffer.from(params.data, "base64") : params.data;
    const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);
    const ext = extensionForMime(mimeType) || ".png";
    const ts = Date.now();
    const id = `gen-${ts}-${hash}`;
    const file = `${id}${ext}`;

    const dir = resolveSessionDir(sessionKey);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(dir, file), buf, { mode: 0o600 });

    const entry: ChatImageEntry = {
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
    if (!manifest.images.some((e) => e.id === id)) {
      manifest.images.push(entry);
      await writeManifest(sessionKey, manifest);
    }

    // [CN-FEAT:media-sqlite] Dual-write: persist metadata to SQLite for fast querying
    try {
      insertMediaAsset({
        id,
        session_key: sessionKey,
        type: "image",
        file,
        url: `/api/media/chat-images/${sessionKey}/${file}`,
        mime_type: mimeType,
        size_bytes: buf.length,
        source: "generated",
        prompt: meta.prompt,
        revised_prompt: meta.revisedPrompt ?? null,
        model: meta.model,
        provider: meta.provider,
        image_size: meta.size,
        style: meta.style ?? null,
        seed: meta.seed ?? null,
        duration_ms: meta.durationMs ?? null,
        duration_secs: null,
        cover_url: null,
        message_text: meta.prompt.slice(0, 100),
        created_at: entry.createdAt,
        expires_at: new Date(Date.now() + GENERATED_RETENTION_DAYS * 86400000).toISOString(),
      });
    } catch {
      // Non-fatal: SQLite write failure should not block image save
    }

    return entry;
  } catch {
    return null;
  }
}

/**
 * Resolve the absolute path for a chat image file.
 * Returns null if the file does not exist.
 */
export function resolveChatImagePath(sessionKey: string, imageId: string): string | null {
  const safe = sessionKey.replace(/[^a-zA-Z0-9_\-.]/g, "_");
  // Sanitize imageId -- strip path traversal components (H4 fix)
  const safeImageId = imageId.replace(/[^a-zA-Z0-9_\-.]/g, "_");
  // Accept both bare id and full filename
  const candidates = [
    path.join(resolveChatImagesRoot(), safe, safeImageId),
    // If imageId doesn't include extension, try common ones
    path.join(resolveChatImagesRoot(), safe, `${safeImageId}.png`),
    path.join(resolveChatImagesRoot(), safe, `${safeImageId}.jpg`),
    path.join(resolveChatImagesRoot(), safe, `${safeImageId}.webp`),
  ];
  for (const p of candidates) {
    try {
      if (fsSync.existsSync(p)) return p;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Load all image entries for a session (metadata only, no file content).
 * Prefers SQLite; falls back to manifest for backward compatibility.
 */
export async function loadChatImages(sessionKey: string): Promise<ChatImageEntry[]> {
  // [CN-FEAT:media-sqlite] Try SQLite first
  try {
    const rows = queryBySession(sessionKey).filter((r) => r.type === "image");
    if (rows.length > 0) {
      return rows.map(sqliteRowToImageEntry);
    }
  } catch {
    // SQLite unavailable — fall through to manifest
  }
  const manifest = await readManifest(sessionKey);
  return manifest.images;
}

/** Convert a SQLite MediaAssetRow to a ChatImageEntry. */
function sqliteRowToImageEntry(row: MediaAssetRow): ChatImageEntry {
  const entry: ChatImageEntry = {
    id: row.id,
    file: row.file,
    mimeType: row.mime_type ?? "image/png",
    sizeBytes: row.size_bytes ?? 0,
    timestamp: new Date(row.created_at).getTime(),
    messageText: row.message_text ?? "",
    createdAt: row.created_at,
    source: row.source as "upload" | "generated" | undefined,
  };
  if (row.source === "generated" && row.model) {
    entry.generationMeta = {
      prompt: row.prompt ?? "",
      revisedPrompt: row.revised_prompt ?? undefined,
      model: row.model,
      provider: row.provider ?? "",
      size: row.image_size ?? "",
      style: row.style ?? undefined,
      seed: row.seed ?? undefined,
      durationMs: row.duration_ms ?? undefined,
    };
  }
  return entry;
}

/**
 * Load the base64 data for a specific chat image.
 */
export async function loadChatImageData(
  sessionKey: string,
  imageId: string,
): Promise<{ base64: string; mimeType: string } | null> {
  const manifest = await readManifest(sessionKey);
  const entry = manifest.images.find((e) => e.id === imageId);
  if (!entry) return null;

  try {
    const filePath = path.join(resolveSessionDir(sessionKey), entry.file);
    const buf = await fs.readFile(filePath);
    return { base64: buf.toString("base64"), mimeType: entry.mimeType };
  } catch {
    return null;
  }
}

/**
 * Load image entries for a session, grouped by timestamp for easy message matching.
 * Returns a Map: timestamp → array of { base64, mimeType }.
 */
export async function loadChatImagesByTimestamp(
  sessionKey: string,
): Promise<Map<number, Array<{ base64: string; mimeType: string }>>> {
  const entries = await loadChatImages(sessionKey);
  if (entries.length === 0) return new Map();

  const dir = resolveSessionDir(sessionKey);
  const result = new Map<number, Array<{ base64: string; mimeType: string }>>();

  for (const entry of entries) {
    try {
      const buf = await fs.readFile(path.join(dir, entry.file));
      const existing = result.get(entry.timestamp) ?? [];
      existing.push({ base64: buf.toString("base64"), mimeType: entry.mimeType });
      result.set(entry.timestamp, existing);
    } catch {
      // File missing — skip
    }
  }

  return result;
}

/**
 * Delete all images for expired sessions.
 * A session's images are expired if ALL images in it are older than maxAgeDays.
 */
export async function cleanExpiredChatImages(maxAgeDays = DEFAULT_RETENTION_DAYS): Promise<number> {
  const root = resolveChatImagesRoot();
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

      const manifest = JSON.parse(raw) as ChatImageManifest;
      // Generated images use longer TTL
      const generatedCutoff = Date.now() - GENERATED_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      const allExpired = manifest.images.every((e) => {
        const t = new Date(e.createdAt).getTime();
        return e.source === "generated" ? t < generatedCutoff : t < cutoff;
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
