/**
 * Session Affinity — Sticky routing for agent teams.
 *
 * Once a peer is routed to a specific team member, subsequent messages
 * from the same peer stick to that member until the affinity expires.
 *
 * Storage: in-memory Map with async best-effort disk persistence.
 * Key format: `${projectId}:${peerId}`
 */

import type { SessionAffinityRecord } from "./types.js";

// ── In-Memory Store ──────────────────────────────────────────────────────

const MAX_AFFINITY_ENTRIES = 50_000;
const store = new Map<string, SessionAffinityRecord>();

function compositeKey(projectId: string, peerId: string): string {
  return `${projectId}:${peerId}`;
}

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
      // Evict oldest entry by lastActiveAt
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [k, v] of store) {
        const t = new Date(v.lastActiveAt).getTime();
        if (t < oldestTime) {
          oldestTime = t;
          oldestKey = k;
        }
      }
      if (oldestKey) store.delete(oldestKey);
    }

    // New or different agent — reset
    store.set(key, {
      peerId,
      agentId,
      lastActiveAt: new Date().toISOString(),
      messageCount: 1,
    });
  }
}

/**
 * Clear affinity for a specific peer in a project.
 */
export function clearAffinity(
  projectId: string,
  peerId: string,
): void {
  store.delete(compositeKey(projectId, peerId));
}

/**
 * Clear all affinities for a project (used when project is deleted).
 */
export function clearProjectAffinities(projectId: string): void {
  const prefix = `${projectId}:`;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
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
