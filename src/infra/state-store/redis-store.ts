/**
 * RedisStateStore — Redis-backed implementation of StateStore.
 *
 * Requires Redis 7+ for full feature support (XAUTOCLAIM, etc.).
 * Uses ioredis as the client library (must be installed as optional dep).
 *
 * Design decisions:
 * - Separate connection for subscriptions (Redis Pub/Sub requirement).
 * - Consumer group per queue for at-least-once semantics (Redis Streams).
 * - Redlock-style distributed locking (single-node variant — for multi-node
 *   Redis use a Redlock library, but single-node covers 99% of cases).
 * - All keys are prefixed with a configurable namespace (default "openclawcn:").
 */

import crypto from "node:crypto";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type {
  StateStore,
  StateStoreConfig,
  StateStoreLock,
  StateStoreQueueItem,
  StateStoreSubscription,
} from "./types.js";

const log = createSubsystemLogger("state-store/redis");

const DEFAULT_KEY_PREFIX = "openclawcn:";
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
const QUEUE_CONSUMER_GROUP = "gateway";
const QUEUE_VISIBILITY_DEFAULT_MS = 30_000;

// ---------------------------------------------------------------------------
// Dynamic import helper — ioredis is an optional dependency.
// We use `any` for the Redis client type because ioredis may not be installed.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisClient = any;

async function loadIoRedis(): Promise<{ default: new (...args: unknown[]) => RedisClient }> {
  try {
    // Dynamic import — ioredis is an optional peer dependency
    // @ts-expect-error ioredis may not be installed
    return await import("ioredis");
  } catch {
    throw new Error(
      "RedisStateStore requires the 'ioredis' package. Install it with: pnpm add ioredis",
    );
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class RedisStateStore implements StateStore {
  private client: RedisClient | null = null;
  private subClient: RedisClient | null = null;
  private prefix: string;
  private redisUrl: string;
  private maxReconnect: number;
  private connectTimeout: number;
  private consumerId: string;
  private _ready = false;

  // Track subscriptions for cleanup
  private activeSubscriptions = new Map<
    string,
    Set<(message: unknown, channel: string) => void>
  >();

  constructor(config: StateStoreConfig) {
    const redis = config.redis;
    if (!redis?.url) {
      throw new Error("RedisStateStore requires redis.url in config");
    }
    this.redisUrl = redis.url;
    this.prefix = redis.keyPrefix ?? DEFAULT_KEY_PREFIX;
    this.maxReconnect = redis.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;
    this.connectTimeout = redis.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    this.consumerId = `gw-${crypto.randomUUID().slice(0, 8)}`;
  }

  get ready(): boolean {
    return this._ready;
  }

  private key(k: string): string {
    return `${this.prefix}${k}`;
  }

  // ── lifecycle ─────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    const IoRedis = await loadIoRedis();
    const RedisCtor = IoRedis.default;

    const options = {
      lazyConnect: true,
      connectTimeout: this.connectTimeout,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > this.maxReconnect) {
          log.error(`Redis reconnection failed after ${times} attempts`);
          return null; // stop retrying
        }
        return Math.min(times * 200, 5_000);
      },
    };

    this.client = new RedisCtor(this.redisUrl, options);
    this.subClient = new RedisCtor(this.redisUrl, options);

    // Error handlers to prevent unhandled rejections
    this.client.on("error", (err: Error) => log.error(`Redis client error: ${err.message}`));
    this.subClient.on("error", (err: Error) => log.error(`Redis sub client error: ${err.message}`));

    await Promise.all([this.client.connect(), this.subClient.connect()]);

    // Wire up subscription message handler
    this.subClient.on("message", (channel: string, message: string) => {
      const rawChannel = channel.startsWith(this.prefix)
        ? channel.slice(this.prefix.length)
        : channel;
      const handlers = this.activeSubscriptions.get(rawChannel);
      if (!handlers) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(message);
      } catch {
        parsed = message;
      }
      for (const handler of handlers) {
        try {
          handler(parsed, rawChannel);
        } catch {
          // Subscriber errors must not propagate
        }
      }
    });

    this._ready = true;
    log.info(`Redis state store connected (prefix=${this.prefix})`);
  }

  async close(): Promise<void> {
    this._ready = false;
    this.activeSubscriptions.clear();
    if (this.subClient) {
      this.subClient.removeAllListeners("message");
      await this.subClient.quit().catch(() => {});
      this.subClient = null;
    }
    if (this.client) {
      await this.client.quit().catch(() => {});
      this.client = null;
    }
  }

  private requireClient(): RedisClient {
    if (!this.client || !this._ready) {
      throw new Error("RedisStateStore is not initialized");
    }
    return this.client;
  }

  // ── KV ────────────────────────────────────────────────────────────────

  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.requireClient().get(this.key(key));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    const redis = this.requireClient();
    const serialized = JSON.stringify(value);
    if (ttlMs && ttlMs > 0) {
      await redis.set(this.key(key), serialized, "PX", ttlMs);
    } else {
      await redis.set(this.key(key), serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.requireClient().del(this.key(key));
  }

  async has(key: string): Promise<boolean> {
    return (await this.requireClient().exists(this.key(key))) === 1;
  }

  async mget<T = unknown>(keys: string[]): Promise<Array<T | null>> {
    if (keys.length === 0) return [];
    const prefixed = keys.map((k) => this.key(k));
    const results: Array<string | null> = await this.requireClient().mget(...prefixed);
    return results.map((raw: string | null) => {
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    });
  }

  async mset<T = unknown>(
    entries: Array<{ key: string; value: T }>,
    ttlMs?: number,
  ): Promise<void> {
    if (entries.length === 0) return;
    const redis = this.requireClient();
    const pipeline = redis.pipeline();
    for (const { key, value } of entries) {
      const serialized = JSON.stringify(value);
      if (ttlMs && ttlMs > 0) {
        pipeline.set(this.key(key), serialized, "PX", ttlMs);
      } else {
        pipeline.set(this.key(key), serialized);
      }
    }
    await pipeline.exec();
  }

  // ── Hash ──────────────────────────────────────────────────────────────

  async hset(key: string, field: string, value: unknown): Promise<void> {
    await this.requireClient().hset(this.key(key), field, JSON.stringify(value));
  }

  async hget<T = unknown>(key: string, field: string): Promise<T | null> {
    const raw = await this.requireClient().hget(this.key(key), field);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.requireClient().hdel(this.key(key), field);
  }

  async hgetall<T = unknown>(key: string): Promise<Record<string, T>> {
    const raw: Record<string, string> = await this.requireClient().hgetall(this.key(key));
    const result: Record<string, T> = {};
    for (const [field, value] of Object.entries(raw)) {
      try {
        result[field] = JSON.parse(value) as T;
      } catch {
        result[field] = value as unknown as T;
      }
    }
    return result;
  }

  // ── Sets ──────────────────────────────────────────────────────────────

  async sadd(key: string, member: string): Promise<void> {
    await this.requireClient().sadd(this.key(key), member);
  }

  async srem(key: string, member: string): Promise<void> {
    await this.requireClient().srem(this.key(key), member);
  }

  async smembers(key: string): Promise<string[]> {
    return this.requireClient().smembers(this.key(key));
  }

  async sismember(key: string, member: string): Promise<boolean> {
    return (await this.requireClient().sismember(this.key(key), member)) === 1;
  }

  // ── Pub/Sub ───────────────────────────────────────────────────────────

  async publish(channel: string, message: unknown): Promise<number> {
    const serialized = JSON.stringify(message);
    return this.requireClient().publish(this.key(channel), serialized);
  }

  async subscribe(
    channel: string,
    handler: (message: unknown, channel: string) => void,
  ): Promise<StateStoreSubscription> {
    if (!this.subClient) {
      throw new Error("RedisStateStore subscription client is not initialized");
    }

    let handlers = this.activeSubscriptions.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.activeSubscriptions.set(channel, handlers);
      await this.subClient.subscribe(this.key(channel));
    }
    handlers.add(handler);

    return {
      unsubscribe: () => {
        handlers!.delete(handler);
        if (handlers!.size === 0) {
          this.activeSubscriptions.delete(channel);
          this.subClient?.unsubscribe(this.key(channel)).catch(() => {});
        }
      },
    };
  }

  // ── Distributed Lock ──────────────────────────────────────────────────

  async acquireLock(
    key: string,
    ttlMs: number,
    waitMs = 0,
  ): Promise<StateStoreLock | null> {
    const redis = this.requireClient();
    const lockKey = this.key(`lock:${key}`);
    const token = crypto.randomUUID();
    const deadline = Date.now() + waitMs;
    const pollMs = Math.max(10, Math.min(100, waitMs || 100));

    while (true) {
      // SET NX PX — atomic acquire
      const result = await redis.set(lockKey, token, "PX", ttlMs, "NX");
      if (result === "OK") {
        return { token, key, acquiredAt: Date.now() };
      }

      if (waitMs <= 0 || Date.now() >= deadline) {
        return null;
      }

      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }

  async releaseLock(lock: StateStoreLock): Promise<void> {
    const redis = this.requireClient();
    const lockKey = this.key(`lock:${lock.key}`);
    // Lua script: only delete if the token matches (prevents releasing someone else's lock)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await redis.eval(script, 1, lockKey, lock.token);
  }

  // ── Reliable Queue (Redis Streams) ────────────────────────────────────

  private streamKey(queue: string): string {
    return this.key(`queue:${queue}`);
  }

  private async ensureConsumerGroup(streamKey: string): Promise<void> {
    const redis = this.requireClient();
    try {
      await redis.xgroup("CREATE", streamKey, QUEUE_CONSUMER_GROUP, "0", "MKSTREAM");
    } catch (err: unknown) {
      // Group already exists — that's fine
      if (err instanceof Error && err.message.includes("BUSYGROUP")) return;
      throw err;
    }
  }

  async enqueue<T = unknown>(queue: string, data: T): Promise<string> {
    const redis = this.requireClient();
    const sk = this.streamKey(queue);
    await this.ensureConsumerGroup(sk);

    const id = await redis.xadd(
      sk,
      "*",
      "data",
      JSON.stringify(data),
      "enqueuedAt",
      String(Date.now()),
      "attempts",
      "0",
    );
    return id;
  }

  async dequeue<T = unknown>(
    queue: string,
    visibilityMs = QUEUE_VISIBILITY_DEFAULT_MS,
  ): Promise<StateStoreQueueItem<T> | null> {
    const redis = this.requireClient();
    const sk = this.streamKey(queue);
    await this.ensureConsumerGroup(sk);

    // First, try to claim any timed-out items (at-least-once recovery)
    try {
      const claimed = await redis.xautoclaim(
        sk,
        QUEUE_CONSUMER_GROUP,
        this.consumerId,
        visibilityMs,
        "0-0",
        "COUNT",
        1,
      );
      // xautoclaim returns [nextStartId, [[id, fields], ...], deletedIds]
      if (Array.isArray(claimed) && Array.isArray(claimed[1]) && claimed[1].length > 0) {
        const entry = claimed[1][0] as [string, string[]];
        return this.parseStreamEntry<T>(entry);
      }
    } catch {
      // XAUTOCLAIM not available — fall through to XREADGROUP
    }

    // Read new items
    const results = await redis.xreadgroup(
      "GROUP",
      QUEUE_CONSUMER_GROUP,
      this.consumerId,
      "COUNT",
      1,
      "BLOCK",
      0, // non-blocking
      "STREAMS",
      sk,
      ">",
    );

    if (!results || results.length === 0) return null;
    const messages = results[0][1] as Array<[string, string[]]>;
    if (messages.length === 0) return null;

    return this.parseStreamEntry<T>(messages[0]);
  }

  private parseStreamEntry<T>(entry: [string, string[]]): StateStoreQueueItem<T> {
    const [id, fields] = entry;
    const fieldMap = new Map<string, string>();
    for (let i = 0; i < fields.length; i += 2) {
      fieldMap.set(fields[i], fields[i + 1]);
    }

    let data: T;
    try {
      data = JSON.parse(fieldMap.get("data") ?? "null") as T;
    } catch {
      data = (fieldMap.get("data") ?? null) as unknown as T;
    }

    return {
      id,
      data,
      enqueuedAt: parseInt(fieldMap.get("enqueuedAt") ?? "0", 10),
      attempts: parseInt(fieldMap.get("attempts") ?? "1", 10) + 1,
    };
  }

  async ack(queue: string, itemId: string): Promise<void> {
    const redis = this.requireClient();
    const sk = this.streamKey(queue);
    await redis.xack(sk, QUEUE_CONSUMER_GROUP, itemId);
    // Also remove from the stream to prevent unbounded growth
    await redis.xdel(sk, itemId);
  }

  async nack(queue: string, itemId: string): Promise<void> {
    // For nack, we don't ack — the item will be re-claimed after visibility timeout
    // We can optionally reset the idle time to make it immediately available
    const redis = this.requireClient();
    const sk = this.streamKey(queue);
    try {
      await redis.xclaim(sk, QUEUE_CONSUMER_GROUP, this.consumerId, 0, itemId);
    } catch {
      // Item may have been deleted — ignore
    }
  }

  async queueSize(queue: string): Promise<number> {
    const redis = this.requireClient();
    const sk = this.streamKey(queue);
    return redis.xlen(sk);
  }
}
