/**
 * Windows-safe atomic rename.
 *
 * On Windows, `fs.rename()` / `fs.renameSync()` can fail with EPERM or EBUSY
 * when the destination file is momentarily held by another process (antivirus
 * real-time scanning, file indexer, backup software, etc.).
 *
 * These helpers fall back to copy + unlink when rename fails, which avoids the
 * lock contention because `copyFile` creates a *new* file handle rather than
 * replacing the inode.
 *
 * If both rename AND copyFile fail, the error from copyFile is thrown so
 * callers are never left in a silent-failure state.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";

/**
 * Async rename with Windows EPERM/EBUSY fallback.
 * Throws if both rename and copy fail.
 */
export async function safeRename(src: string, dest: string): Promise<void> {
  try {
    await fsp.rename(src, dest);
  } catch {
    // Fallback: copy then unlink source.
    // copyFile may also throw — let it propagate so callers know the write failed.
    await fsp.copyFile(src, dest);
    try {
      await fsp.unlink(src);
    } catch {
      /* source cleanup is best-effort */
    }
  }
}

/**
 * Sync rename with Windows EPERM/EBUSY fallback.
 * Throws if both rename and copy fail.
 */
export function safeRenameSync(src: string, dest: string): void {
  try {
    fs.renameSync(src, dest);
  } catch {
    // Fallback: copy then unlink source.
    // copyFileSync may also throw — let it propagate so callers know the write failed.
    fs.copyFileSync(src, dest);
    try {
      fs.unlinkSync(src);
    } catch {
      /* source cleanup is best-effort */
    }
  }
}
