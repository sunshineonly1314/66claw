/**
 * Session Affinity — Sticky routing for agent teams.
 *
 * Once a peer is routed to a specific team member, subsequent messages
 * from the same peer stick to that member until the affinity expires.
 *
 * Storage: in-memory Map with debounced disk persistence.
 * Key format: `${projectId}:${peerId}`
 *
 * Persistence: affinities are saved to disk every PERSIST_DEBOUNCE_MS after
 * a mutation. On startup, restoreAffinitiesFromDisk() reloads them so that
 * routing preferences survive process restarts.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { SessionAffinityRecord } from "./types.js";

// ── In-Memory Store ──────────────────────────────────────────────────────

const MAX_AFFINITY_ENTRIES = 50_000;
const store = new Map<string, SessionAffinityRecord>();

/** Disk persistence directory (set via initAffinityPersistence). */
let persistDir = "";
/** Debounce timer for disk writes. */
let persistTimer: ReturnType<typeof setTimeout> | undefined;
/** Minimum interval between disk writes. */
const PERSIST_DEBOUNCE_MS = 5_000;
/** Whether a disk write has been scheduled. */
let persistDirty = false;

function compositeKey(projectId: string, peerId: string): string {
  return `${projectId}:${peerId}`;
}

// ── Persistence ─────────────────────────────────────────────────────────

/**
 * Initialize the persistence directory and enable disk saves.
 * Must be called once during plugin startup.
 */
export function initAffinityPersistence(dir: string): void {
  persistDir = dir;
}

function affinityFilePath(): string {
  return path.join(persistDir, "affinity-cache.json");
}

/** Schedule a debounced write to disk. */
function schedulePersist(): void {
  if (!persistDir) return;
  persistDirty = true;
  if (persistTimer) return; // Already scheduled
  persistTimer = setTimeout(() => {
    persistTimer = undefined;
    if (!persistDirty) return;
    persistDirty = false;
    persistToDisk().catch(() => {
      // Best-effort: disk save failure is not fatal
    });
  }, PERSIST_DEBOUNCE_MS);
}

/**
 * Write all affinities to disk atomically (tmp + rename).
 * Only stores records that are still active (not expired by a generous 24h window).
 */
async function persistToDisk(): Promise<void> {
  if (!persistDir) return;
  const cutoff = Date.now() - 24 * 60 * 60_000; // Skip records older than 24h
  const entries: Array<[string, SessionAffinityRecord]> = [];
  for (const [key, record] of store) {
    const ts = new Date(record.lastActiveAt).getTime();
    if (!Number.isNaN(ts) && ts > cutoff) {
      entries.push([key, record]);
    }
  }
  const data = JSON.stringify(entries);
  const filePath = affinityFilePath();
  const tmpPath = `${filePath}.tmp`;
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(tmpPath, data, "utf-8");
    try {
      await fs.rename(tmpPath, filePath);
    } catch {
      // Windows fallback: rename can fail with EBUSY
      try {
        await fs.copyFile(tmpPath, filePath);
      } finally {
        try { await fs.unlink(tmpPath); } catch { /* ignore */ }
      }
    }
  } catch {
    // Disk save is best-effort
  }
}

/** Maximum age of a persisted affinity entry to be considered valid on restore (24 hours). */
const AFFINITY_RESTORE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Restore affinities from disk on startup.
 * Silently returns if file doesn't exist or is corrupted.
 *
 * @param validAgentIds - Optional set of currently-known agent IDs. Entries
 *   referencing agents that no longer exist are discarded to prevent routing
 *   to deleted/renamed agents (ghost affinities).
 */
export async function restoreAffinitiesFromDisk(
  validAgentIds?: Set<string>,
): Promise<number> {
  if (!persistDir) return 0;
  try {
    const raw = await fs.readFile(affinityFilePath(), "utf-8");
    const entries = JSON.parse(raw) as Array<[string, SessionAffinityRecord]>;
    if (!Array.isArray(entries)) return 0;
    let restored = 0;
    const now = Date.now();
    for (const [key, record] of entries) {
      if (
        typeof key === "string" &&
        record &&
        typeof record.peerId === "string" &&
        typeof record.agentId === "string" &&
        typeof record.lastActiveAt === "string"
      ) {
        // Discard entries for agents that no longer exist (ghost affinities).
        if (validAgentIds && !validAgentIds.has(record.agentId)) continue;
        // Discard entries older than 24 hours — stale routing data.
        const lastActive = new Date(record.lastActiveAt).getTime();
        if (!Number.isFinite(lastActive) || now - lastActive > AFFINITY_RESTORE_MAX_AGE_MS) {
          continue;
        }
        store.set(key, record);
        restored++;
      }
    }
    return restored;
  } catch {
    return 0; // File not found or corrupted — start fresh
  }
}

/**
 * Flush pending affinities to disk immediately (for graceful shutdown).
 */
export async function flushAffinityToDisk(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = undefined;
  }
  if (persistDirty) {
    persistDirty = false;
    await persistToDisk();
  }
}

// ── Core API (unchanged signatures) ─────────────────────────────────────

/**
 * Get the current affinity record for a peer within a project.
 * Returns null if no affinity is set.
 */
export function getAffinity(
  projectId: string,
  peerId: string,
): SessionAffinityRecord | null {
  return store.get(compositeKey(projectId, peerId)) ?? null;
}

/**
 * Set or update affinity for a peer to a specific agent.
 * Increments messageCount if the agent is the same; resets if different.
 */
export function setAffinity(
  projectId: string,
  peerId: string,
  agentId: string,
): void {
  const key = compositeKey(projectId, peerId);
  const existing = store.get(key);

  if (existing && existing.agentId === agentId) {
    // Same agent — refresh timestamp and increment count
    store.set(key, {
      ...existing,
      lastActiveAt: new Date().toISOString(),
      messageCount: existing.messageCount + 1,
    });
  } else {
    // Enforce size cap before inserting new entries
    if (!existing && store.size >= MAX_AFFINITY_ENTRIES) {
      // Batch evict oldest 10% of entries to amortize the O(n) scan cost.
      const evictCount = Math.max(1, Math.floor(MAX_AFFINITY_ENTRIES * 0.1));
      const entries: Array<[string, number]> = [];
      for (const [k, v] of store) {
        entries.push([k, new Date(v.lastActiveAt).getTime()]);
      }
      entries.sort((a, b) => a[1] - b[1]); // oldest first
      for (let i = 0; i < evictCount && i < entries.length; i++) {
        store.delete(entries[i][0]);
      }
    }

    // New or different agent — reset
    store.set(key, {
      peerId,
      agentId,
      lastActiveAt: new Date().toISOString(),
      messageCount: 1,
    });
  }

  schedulePersist();
}

/**
 * Clear affinity for a specific peer in a project.
 */
export function clearAffinity(
  projectId: string,
  peerId: string,
): void {
  store.delete(compositeKey(projectId, peerId));
  schedulePersist();
}

/**
 * Clear all affinities for a project (used when project is deleted).
 */
export function clearProjectAffinities(projectId: string): void {
  const prefix = `${projectId}:`;
  let deleted = false;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      deleted = true;
    }
  }
  if (deleted) schedulePersist();
}

/**
 * Check if an affinity record has expired.
 */
export function isAffinityExpired(
  record: SessionAffinityRecord,
  timeoutMinutes: number,
): boolean {
  if (timeoutMinutes <= 0) return true;
  const lastActive = new Date(record.lastActiveAt).getTime();
  if (Number.isNaN(lastActive)) return true;
  const expiresAt = lastActive + timeoutMinutes * 60_000;
  return Date.now() > expiresAt;
}

/**
 * Resolve the affinitized agent for a peer, or null if expired/missing.
 */
export function resolveAffinityAgent(
  projectId: string,
  peerId: string,
  timeoutMinutes: number,
): string | null {
  const record = getAffinity(projectId, peerId);
  if (!record) return null;
  if (isAffinityExpired(record, timeoutMinutes)) {
    // Expired — clean up lazily
    clearAffinity(projectId, peerId);
    return null;
  }
  return record.agentId;
}

/**
 * Purge all expired affinities (called periodically from health service).
 */
export function purgeExpiredAffinities(timeoutMinutes: number): number {
  let purged = 0;
  for (const [key, record] of store) {
    if (isAffinityExpired(record, timeoutMinutes)) {
      store.delete(key);
      purged++;
    }
  }
  if (purged > 0) schedulePersist();
  return purged;
}

/**
 * Get all affinity records (for testing / diagnostics).
 */
export function getAllAffinities(): Map<string, SessionAffinityRecord> {
  return new Map(store);
}

/**
 * Reset all affinities (for testing).
 */
export function resetAllAffinities(): void {
  store.clear();
}
