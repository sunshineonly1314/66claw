/**
 * MemoryStateStore — In-process implementation of StateStore.
 *
 * Zero external dependencies. Suitable for single-node deployments and tests.
 * All data lives in memory and is lost on process restart (by design — the
 * StateStore is for ephemeral operational state, not durable config).
 */

import crypto from "node:crypto";
import type {
  StateStore,
  StateStoreLock,
  StateStoreQueueItem,
  StateStoreSubscription,
} from "./types.js";

// ---------------------------------------------------------------------------
// TTL-aware value wrapper
// ---------------------------------------------------------------------------

type StoredValue = {
  data: unknown;
  expiresAt: number | null; // null = no expiry
};

// ---------------------------------------------------------------------------
// Queue internals
// ---------------------------------------------------------------------------

type QueueEntry = {
  id: string;
  data: unknown;
  enqueuedAt: number;
  attempts: number;
  /** While non-null the item is invisible to other consumers. */
  visibleAfter: number | null;
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class MemoryStateStore implements StateStore {
  // ── storage maps ──────────────────────────────────────────────────────
  private kv = new Map<string, StoredValue>();
  private hashes = new Map<string, Map<string, unknown>>();
  private sets = new Map<string, Set<string>>();
  private queues = new Map<string, QueueEntry[]>();
  private locks = new Map<string, { token: string; expiresAt: number }>();

  // ── pub/sub ───────────────────────────────────────────────────────────
  private subscribers = new Map<string, Set<(message: unknown, channel: string) => void>>();

  // ── housekeeping ──────────────────────────────────────────────────────
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private _ready = false;

  // ── lifecycle ─────────────────────────────────────────────────────────

  get ready(): boolean {
    return this._ready;
  }

  async initialize(): Promise<void> {
    this._ready = true;
    // Sweep expired keys every 30 s
    this.sweepTimer = setInterval(() => this.sweepExpired(), 30_000);
    this.sweepTimer.unref();
  }

  async close(): Promise<void> {
    this._ready = false;
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    this.kv.clear();
    this.hashes.clear();
    this.sets.clear();
    this.queues.clear();
    this.locks.clear();
    this.subscribers.clear();
  }

  // ── KV ────────────────────────────────────────────────────────────────

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.kv.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.kv.delete(key);
      return null;
    }
    return entry.data as T;
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    this.kv.set(key, {
      data: value,
      expiresAt: ttlMs && ttlMs > 0 ? Date.now() + ttlMs : null,
    });
  }

  async del(key: string): Promise<void> {
    this.kv.delete(key);
    this.hashes.delete(key);
    this.sets.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const entry = this.kv.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.kv.delete(key);
      return false;
    }
    return true;
  }

  async mget<T = unknown>(keys: string[]): Promise<Array<T | null>> {
    const results: Array<T | null> = [];
    for (const key of keys) {
      results.push(await this.get<T>(key));
    }
    return results;
  }

  async mset<T = unknown>(
    entries: Array<{ key: string; value: T }>,
    ttlMs?: number,
  ): Promise<void> {
    for (const { key, value } of entries) {
      await this.set(key, value, ttlMs);
    }
  }

  // ── Hash ──────────────────────────────────────────────────────────────

  async hset(key: string, field: string, value: unknown): Promise<void> {
    let hash = this.hashes.get(key);
    if (!hash) {
      hash = new Map();
      this.hashes.set(key, hash);
    }
    hash.set(field, value);
  }

  async hget<T = unknown>(key: string, field: string): Promise<T | null> {
    const hash = this.hashes.get(key);
    if (!hash) return null;
    const val = hash.get(field);
    return val === undefined ? null : (val as T);
  }

  async hdel(key: string, field: string): Promise<void> {
    const hash = this.hashes.get(key);
    if (hash) {
      hash.delete(field);
      if (hash.size === 0) this.hashes.delete(key);
    }
  }

  async hgetall<T = unknown>(key: string): Promise<Record<string, T>> {
    const hash = this.hashes.get(key);
    if (!hash) return {} as Record<string, T>;
    const result: Record<string, T> = {};
    for (const [field, value] of hash) {
      result[field] = value as T;
    }
    return result;
  }

  // ── Sets ──────────────────────────────────────────────────────────────

  async sadd(key: string, member: string): Promise<void> {
    let set = this.sets.get(key);
    if (!set) {
      set = new Set();
      this.sets.set(key, set);
    }
    set.add(member);
  }

  async srem(key: string, member: string): Promise<void> {
    const set = this.sets.get(key);
    if (set) {
      set.delete(member);
      if (set.size === 0) this.sets.delete(key);
    }
  }

  async smembers(key: string): Promise<string[]> {
    const set = this.sets.get(key);
    return set ? [...set] : [];
  }

  async sismember(key: string, member: string): Promise<boolean> {
    const set = this.sets.get(key);
    return set?.has(member) ?? false;
  }

  // ── Pub/Sub ───────────────────────────────────────────────────────────

  async publish(channel: string, message: unknown): Promise<number> {
    const handlers = this.subscribers.get(channel);
    if (!handlers || handlers.size === 0) return 0;
    // Deliver asynchronously to avoid blocking the publisher
    for (const handler of handlers) {
      try {
        handler(message, channel);
      } catch {
        // Subscriber errors must not propagate to the publisher
      }
    }
    return handlers.size;
  }

  async subscribe(
    channel: string,
    handler: (message: unknown, channel: string) => void,
  ): Promise<StateStoreSubscription> {
    let handlers = this.subscribers.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.subscribers.set(channel, handlers);
    }
    handlers.add(handler);
    return {
      unsubscribe: () => {
        handlers!.delete(handler);
        if (handlers!.size === 0) this.subscribers.delete(channel);
      },
    };
  }

  // ── Distributed Lock ──────────────────────────────────────────────────

  async acquireLock(
    key: string,
    ttlMs: number,
    waitMs = 0,
  ): Promise<StateStoreLock | null> {
    const deadline = Date.now() + waitMs;
    const pollMs = Math.max(10, Math.min(50, waitMs || 50));

    while (true) {
      const now = Date.now();
      const existing = this.locks.get(key);

      // Can acquire if no lock or existing lock has expired
      if (!existing || existing.expiresAt <= now) {
        const token = crypto.randomUUID();
        this.locks.set(key, { token, expiresAt: now + ttlMs });
        return { token, key, acquiredAt: now };
      }

      // Can't wait (or exhausted wait time)?
      if (waitMs <= 0 || now >= deadline) {
        return null;
      }

      // Wait and retry
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }

  async releaseLock(lock: StateStoreLock): Promise<void> {
    const existing = this.locks.get(lock.key);
    if (existing && existing.token === lock.token) {
      this.locks.delete(lock.key);
    }
    // If token mismatch the lock was already released or taken by someone else — no-op
  }

  // ── Reliable Queue ────────────────────────────────────────────────────

  async enqueue<T = unknown>(queue: string, data: T): Promise<string> {
    let q = this.queues.get(queue);
    if (!q) {
      q = [];
      this.queues.set(queue, q);
    }
    const id = crypto.randomUUID();
    q.push({
      id,
      data,
      enqueuedAt: Date.now(),
      attempts: 0,
      visibleAfter: null,
    });
    return id;
  }

  async dequeue<T = unknown>(
    queue: string,
    visibilityMs = 30_000,
  ): Promise<StateStoreQueueItem<T> | null> {
    const q = this.queues.get(queue);
    if (!q || q.length === 0) return null;

    const now = Date.now();
    for (const entry of q) {
      // Skip items that are currently invisible (being processed)
      if (entry.visibleAfter !== null && entry.visibleAfter > now) {
        continue;
      }
      entry.attempts += 1;
      entry.visibleAfter = now + visibilityMs;
      return {
        id: entry.id,
        data: entry.data as T,
        enqueuedAt: entry.enqueuedAt,
        attempts: entry.attempts,
      };
    }
    return null;
  }

  async ack(queue: string, itemId: string): Promise<void> {
    const q = this.queues.get(queue);
    if (!q) return;
    const idx = q.findIndex((e) => e.id === itemId);
    if (idx >= 0) {
      q.splice(idx, 1);
      if (q.length === 0) this.queues.delete(queue);
    }
  }

  async nack(queue: string, itemId: string): Promise<void> {
    const q = this.queues.get(queue);
    if (!q) return;
    const entry = q.find((e) => e.id === itemId);
    if (entry) {
      // Make it visible again immediately
      entry.visibleAfter = null;
    }
  }

  async queueSize(queue: string): Promise<number> {
    return this.queues.get(queue)?.length ?? 0;
  }

  // ── internal helpers ──────────────────────────────────────────────────

  private isExpired(entry: StoredValue): boolean {
    return entry.expiresAt !== null && Date.now() >= entry.expiresAt;
  }

  private sweepExpired(): void {
    const now = Date.now();

    // KV expiry
    for (const [key, entry] of this.kv) {
      if (entry.expiresAt !== null && now >= entry.expiresAt) {
        this.kv.delete(key);
      }
    }

    // Lock expiry
    for (const [key, lock] of this.locks) {
      if (now >= lock.expiresAt) {
        this.locks.delete(key);
      }
    }

    // Queue visibility timeout recovery + dead-letter protection
    const MAX_QUEUE_ATTEMPTS = 5;
    for (const [queueKey, q] of this.queues) {
      for (let i = q.length - 1; i >= 0; i--) {
        const entry = q[i]!;
        if (entry.visibleAfter !== null && now >= entry.visibleAfter) {
          if (entry.attempts >= MAX_QUEUE_ATTEMPTS) {
            // Item exceeded max retry attempts — drop it to prevent infinite loops
            q.splice(i, 1);
          } else {
            // Make it visible again for retry
            entry.visibleAfter = null;
          }
        }
      }
      if (q.length === 0) {
        this.queues.delete(queueKey);
      }
    }
  }
}
