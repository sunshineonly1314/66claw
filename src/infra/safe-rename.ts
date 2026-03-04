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
    try {
      await fsp.copyFile(src, dest);
    } catch (copyErr) {
      // copyFile failed — clean up the orphaned tmp source file before rethrowing.
      await fsp.unlink(src).catch(() => {});
      throw copyErr;
    }
    // Copy succeeded — clean up source (best-effort).
    await fsp.unlink(src).catch(() => {});
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
    try {
      fs.copyFileSync(src, dest);
    } catch (copyErr) {
      // copyFileSync failed — clean up the orphaned tmp source file before rethrowing.
      try {
        fs.unlinkSync(src);
      } catch {
        /* ignore */
      }
      throw copyErr;
    }
    // Copy succeeded — clean up source (best-effort).
    try {
      fs.unlinkSync(src);
    } catch {
      /* ignore */
    }
  }
}
