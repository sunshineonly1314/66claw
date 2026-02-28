/**
 * Volcengine Voice Credentials — persistent storage for App ID + Access Token.
 *
 * Stores credentials in {stateDir}/settings/volcengine-voice.json
 * and injects them into process.env for immediate use by ASR/TTS modules.
 *
 * Pattern follows voice-prefs.ts.
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VolcengineVoiceCreds {
  appId: string;
  accessToken: string;
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

function resolvePath(baseDir?: string): string {
  const root = baseDir ?? resolveStateDir();
  return path.join(root, "settings", "volcengine-voice.json");
}

// ---------------------------------------------------------------------------
// File I/O (same atomic pattern as voice-prefs.ts)
// ---------------------------------------------------------------------------

let lock: Promise<void> = Promise.resolve();

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = lock;
  let release: (() => void) | undefined;
  lock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prev;
  try {
    return await fn();
  } finally {
    release?.();
  }
}

async function readJSON<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJSONAtomic(filePath: string, value: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${filePath}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

let _cached: VolcengineVoiceCreds | null = null;
let _loaded = false;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load volcengine voice credentials from disk (or cache).
 * Also syncs to process.env so ASR/TTS modules can use them immediately.
 */
export async function getVolcengineVoiceCredentials(
  baseDir?: string,
): Promise<VolcengineVoiceCreds | null> {
  if (_loaded && _cached) return _cached;

  const filePath = resolvePath(baseDir);
  const data = await readJSON<VolcengineVoiceCreds>(filePath);

  if (data?.appId && data?.accessToken) {
    _cached = { appId: data.appId, accessToken: data.accessToken };
    _loaded = true;
    // Sync to process.env for backward compatibility
    _syncToEnv(_cached);
    return _cached;
  }

  // Fallback: check if env vars are already set (e.g. by user manually)
  if (process.env.VOLC_APP_ID && process.env.VOLC_ACCESS_TOKEN) {
    _cached = {
      appId: process.env.VOLC_APP_ID,
      accessToken: process.env.VOLC_ACCESS_TOKEN,
    };
    _loaded = true;
    return _cached;
  }

  _loaded = true;
  return null;
}

/**
 * Synchronous getter for hot-path reads (voice-router, asr-streaming).
 * Returns cached creds or checks env vars.
 */
export function getVolcengineVoiceCredentialsSync(): VolcengineVoiceCreds | null {
  if (_cached) return _cached;
  // Fallback to env vars
  if (process.env.VOLC_APP_ID && process.env.VOLC_ACCESS_TOKEN) {
    return {
      appId: process.env.VOLC_APP_ID,
      accessToken: process.env.VOLC_ACCESS_TOKEN,
    };
  }
  return null;
}

/**
 * Save volcengine voice credentials and update process.env immediately.
 */
export async function saveVolcengineVoiceCredentials(
  appId: string,
  accessToken: string,
  baseDir?: string,
): Promise<void> {
  const filePath = resolvePath(baseDir);
  const creds: VolcengineVoiceCreds = { appId, accessToken };

  await withLock(async () => {
    await writeJSONAtomic(filePath, creds);
  });

  _cached = creds;
  _loaded = true;
  _syncToEnv(creds);
}

/**
 * Check if volcengine voice credentials are available (sync).
 */
export function hasVolcengineVoiceCredentials(): boolean {
  return getVolcengineVoiceCredentialsSync() !== null;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function _syncToEnv(creds: VolcengineVoiceCreds): void {
  process.env.VOLC_APP_ID = creds.appId;
  process.env.VOLC_ACCESS_TOKEN = creds.accessToken;
}
