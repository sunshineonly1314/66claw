import { detectMime } from "../media/mime.js";
import { type SavedMedia, saveMediaBuffer } from "../media/store.js";

/**
 * Default timeout for Telegram API calls (in milliseconds).
 * ClawdbotCN 专属：添加超时控制防止进程挂起
 */
const DEFAULT_API_TIMEOUT_MS = 30_000;

/**
 * Default timeout for file downloads (in milliseconds).
 * Larger files may need more time.
 * ClawdbotCN 专属：文件下载超时
 */
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 120_000;

/**
 * Fetch with timeout support.
 * ClawdbotCN 专属：超时控制
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  options?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export type TelegramFileInfo = {
  file_id: string;
  file_unique_id?: string;
  file_size?: number;
  file_path?: string;
};

export type GetTelegramFileOptions = {
  /** Timeout for the API call in milliseconds. Default: 30000 */
  timeoutMs?: number;
};

export async function getTelegramFile(
  token: string,
  fileId: string,
  options?: GetTelegramFileOptions,
): Promise<TelegramFileInfo> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  const res = await fetchWithTimeout(
    `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
    timeoutMs,
  );
  if (!res.ok) {
    throw new Error(`getFile failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { ok: boolean; result?: TelegramFileInfo };
  if (!json.ok || !json.result?.file_path) {
    throw new Error("getFile returned no file_path");
  }
  return json.result;
}

export type DownloadTelegramFileOptions = {
  /** Maximum bytes to download. */
  maxBytes?: number;
  /** Timeout for the download in milliseconds. Default: 120000 */
  timeoutMs?: number;
};

export async function downloadTelegramFile(
  token: string,
  info: TelegramFileInfo,
  options?: DownloadTelegramFileOptions | number,
): Promise<SavedMedia> {
  // Support legacy signature: (token, info, maxBytes)
  const opts: DownloadTelegramFileOptions =
    typeof options === "number" ? { maxBytes: options } : (options ?? {});
  const maxBytes = opts.maxBytes;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;

  if (!info.file_path) throw new Error("file_path missing");
  const url = `https://api.telegram.org/file/bot${token}/${info.file_path}`;
  
  // ClawdbotCN 专属：添加超时控制
  const res = await fetchWithTimeout(url, timeoutMs);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download telegram file: HTTP ${res.status}`);
  }
  const array = Buffer.from(await res.arrayBuffer());
  const mime = await detectMime({
    buffer: array,
    headerMime: res.headers.get("content-type"),
    filePath: info.file_path,
  });
  // save with inbound subdir
  const saved = await saveMediaBuffer(array, mime, "inbound", maxBytes);
  // Ensure extension matches mime if possible
  if (!saved.contentType && mime) saved.contentType = mime;
  return saved;
}
