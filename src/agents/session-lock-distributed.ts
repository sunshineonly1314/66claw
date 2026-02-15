/**
 * Distributed session lock adapter.
 *
 * Provides the same API as `acquireSessionWriteLock` but routes through
 * StateStore distributed locks when available.  When StateStore is not
 * initialised (or uses the memory backend), it falls back to the original
 * filesystem-based lock — this makes the switch transparent for single-node
 * deployments.
 *
 * The key used for the distributed lock is derived from the session file path
 * so that two gateway instances writing to the same logical session will
 * correctly contend.
 */

import crypto from "node:crypto";
import path from "node:path";
import { getStateStoreOrNull } from "../infra/state-store/index.js";
import type { StateStoreLock } from "../infra/state-store/types.js";
import { acquireSessionWriteLock as acquireFileLock } from "./session-write-lock.js";

/**
 * Derive a stable, filesystem-independent lock key from a session file path.
 *
 * We normalise the path and hash it so that the key is safe for use as a
 * Redis key and identical across nodes that may mount the same session dir
 * at different absolute paths (e.g. via NFS / container mounts).
 *
 * Convention: `session:lock:<sha256_prefix>`
 */
function lockKeyForSessionFile(sessionFile: string): string {
  const normalised = path.resolve(sessionFile).replace(/\\/g, "/");
  const hash = crypto.createHash("sha256").update(normalised).digest("hex").slice(0, 16);
  return `session:lock:${hash}`;
}

export async function acquireSessionLock(params: {
  sessionFile: string;
  timeoutMs?: number;
  staleMs?: number;
}): Promise<{ release: () => Promise<void> }> {
  const store = getStateStoreOrNull();

  // ── Distributed path (StateStore available) ─────────────────────────
  if (store) {
    const lockKey = lockKeyForSessionFile(params.sessionFile);
    const ttlMs = params.staleMs ?? 30_000;
    const waitMs = params.timeoutMs ?? 10_000;

    const lock: StateStoreLock | null = await store.acquireLock(lockKey, ttlMs, waitMs);
    if (!lock) {
      throw new Error(
        `timeout waiting for distributed session lock (${waitMs}ms): ${params.sessionFile}`,
      );
    }

    return {
      release: async () => {
        await store.releaseLock(lock);
      },
    };
  }

  // ── Fallback: filesystem lock (single-node) ─────────────────────────
  return acquireFileLock(params);
}
