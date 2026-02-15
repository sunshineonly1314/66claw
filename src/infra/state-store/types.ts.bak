/**
 * StateStore — Abstraction layer for distributed state management.
 *
 * Provides a unified interface for KV storage, Pub/Sub, distributed locks,
 * and reliable queues. Two implementations:
 *   - MemoryStateStore  (single-node, zero external deps)
 *   - RedisStateStore   (multi-node, requires Redis 7+)
 *
 * All methods are async to allow transparent swapping between backends.
 */

// ---------------------------------------------------------------------------
// Lock
// ---------------------------------------------------------------------------

export type StateStoreLock = {
  /** Opaque token used to release the lock safely. */
  token: string;
  /** The key that was locked. */
  key: string;
  /** Timestamp (ms) when the lock was acquired. */
  acquiredAt: number;
};

// ---------------------------------------------------------------------------
// Queue item
// ---------------------------------------------------------------------------

export type StateStoreQueueItem<T = unknown> = {
  /** Unique item id (assigned by the store). */
  id: string;
  /** The payload. */
  data: T;
  /** Timestamp (ms) when the item was enqueued. */
  enqueuedAt: number;
  /** Number of times this item has been dequeued (for retry tracking). */
  attempts: number;
};

// ---------------------------------------------------------------------------
// Subscription handle
// ---------------------------------------------------------------------------

export type StateStoreSubscription = {
  /** Unsubscribe from the channel. */
  unsubscribe(): void;
};

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface StateStore {
  // ── lifecycle ─────────────────────────────────────────────────────────

  /** Initialize the store (connect to backend, run migrations, etc.). */
  initialize(): Promise<void>;

  /** Gracefully shut down the store. */
  close(): Promise<void>;

  /** Returns true after initialize() resolves and before close(). */
  readonly ready: boolean;

  // ── key / value ───────────────────────────────────────────────────────

  /**
   * Get a value by key.
   * Returns `null` if the key does not exist or has expired.
   */
  get<T = unknown>(key: string): Promise<T | null>;

  /**
   * Set a value with an optional TTL (milliseconds).
   * Setting ttl=0 or omitting it means the key never expires (manual delete).
   */
  set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void>;

  /** Delete a key. No-op if the key does not exist. */
  del(key: string): Promise<void>;

  /**
   * Check if a key exists.
   */
  has(key: string): Promise<boolean>;

  /**
   * Get multiple keys at once. Missing keys are `null`.
   */
  mget<T = unknown>(keys: string[]): Promise<Array<T | null>>;

  /**
   * Set multiple keys at once (same TTL for all, optional).
   */
  mset<T = unknown>(entries: Array<{ key: string; value: T }>, ttlMs?: number): Promise<void>;

  // ── hash (field-level operations within a key) ────────────────────────

  /** Set a field inside a hash key. */
  hset(key: string, field: string, value: unknown): Promise<void>;

  /** Get a field from a hash key. Returns `null` if missing. */
  hget<T = unknown>(key: string, field: string): Promise<T | null>;

  /** Delete a field from a hash key. */
  hdel(key: string, field: string): Promise<void>;

  /** Get all fields and values of a hash key. */
  hgetall<T = unknown>(key: string): Promise<Record<string, T>>;

  // ── sets ──────────────────────────────────────────────────────────────

  /** Add a member to a set. */
  sadd(key: string, member: string): Promise<void>;

  /** Remove a member from a set. */
  srem(key: string, member: string): Promise<void>;

  /** Get all members of a set. */
  smembers(key: string): Promise<string[]>;

  /** Check if a member exists in a set. */
  sismember(key: string, member: string): Promise<boolean>;

  // ── pub/sub ───────────────────────────────────────────────────────────

  /**
   * Publish a message to a channel.
   * Returns the number of subscribers that received the message.
   */
  publish(channel: string, message: unknown): Promise<number>;

  /**
   * Subscribe to a channel. The handler is called for each message.
   * Returns a handle to unsubscribe.
   */
  subscribe(
    channel: string,
    handler: (message: unknown, channel: string) => void,
  ): Promise<StateStoreSubscription>;

  // ── distributed lock ──────────────────────────────────────────────────

  /**
   * Acquire a distributed lock.
   * @param key      The lock key.
   * @param ttlMs    Lock auto-release time in milliseconds (safety net).
   * @param waitMs   Max time to wait for the lock (0 = fail immediately).
   * @returns        The lock handle, or `null` if the lock could not be acquired.
   */
  acquireLock(key: string, ttlMs: number, waitMs?: number): Promise<StateStoreLock | null>;

  /**
   * Release a previously acquired lock.
   * No-op if the lock has already expired or was released.
   */
  releaseLock(lock: StateStoreLock): Promise<void>;

  // ── reliable queue ────────────────────────────────────────────────────

  /**
   * Enqueue an item into a named queue.
   * Returns the assigned item id.
   */
  enqueue<T = unknown>(queue: string, data: T): Promise<string>;

  /**
   * Dequeue the next item from a queue.
   * The item is not removed until ack() is called (at-least-once semantics).
   * Returns `null` if the queue is empty.
   * @param visibilityMs  How long the item is hidden from other consumers.
   */
  dequeue<T = unknown>(queue: string, visibilityMs?: number): Promise<StateStoreQueueItem<T> | null>;

  /**
   * Acknowledge successful processing of a queue item (removes it).
   */
  ack(queue: string, itemId: string): Promise<void>;

  /**
   * Return an item to the queue (negative-ack / retry).
   */
  nack(queue: string, itemId: string): Promise<void>;

  /**
   * Get the number of items in a queue (pending + in-flight).
   */
  queueSize(queue: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type StateStoreBackend = "memory" | "redis";

export type StateStoreConfig = {
  /** Which backend to use. Default: "memory". */
  backend: StateStoreBackend;
  /** Redis connection options (only used when backend is "redis"). */
  redis?: {
    url: string;
    /** Key prefix for namespacing. Default: "openclawcn:". */
    keyPrefix?: string;
    /** Max reconnection attempts. Default: 10. */
    maxReconnectAttempts?: number;
    /** Connection timeout in ms. Default: 5000. */
    connectTimeoutMs?: number;
  };
};

export const DEFAULT_STATE_STORE_CONFIG: StateStoreConfig = {
  backend: "memory",
};
