/**
 * Hardcore tests for MemoryStateStore — cross-operation state pollution,
 * concurrent consumers, TTL interactions, lock contention, queue+lock workflows.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryStateStore } from "./memory-store.js";
import type { StateStore } from "./types.js";

describe("MemoryStateStore hardcore tests", () => {
  let store: StateStore;

  beforeEach(async () => {
    store = new MemoryStateStore();
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
  });

  // ── Cross-operation state pollution ───────────────────────────────────

  describe("cross-operation state isolation", () => {
    it("del removes KV entry but does NOT affect queue with same name", async () => {
      // Set a KV entry and enqueue to a queue with the same key name
      await store.set("shared-key", "kv-value");
      await store.enqueue("shared-key", "queue-data");

      // Delete the KV entry
      await store.del("shared-key");

      // KV should be gone
      expect(await store.get("shared-key")).toBeNull();

      // Queue should still have the item
      const item = await store.dequeue("shared-key");
      expect(item).not.toBeNull();
      expect(item!.data).toBe("queue-data");
    });

    it("hash and set operations on same key are independent", async () => {
      await store.hset("ns", "field1", "hash-value");
      await store.sadd("ns", "set-member");

      // Both should coexist
      expect(await store.hget("ns", "field1")).toBe("hash-value");
      expect(await store.sismember("ns", "set-member")).toBe(true);

      // Deleting hash field should not affect set
      await store.hdel("ns", "field1");
      expect(await store.sismember("ns", "set-member")).toBe(true);
    });

    it("multiple queues are fully isolated", async () => {
      await store.enqueue("q1", "data-a");
      await store.enqueue("q2", "data-b");
      await store.enqueue("q1", "data-c");

      expect(await store.queueSize("q1")).toBe(2);
      expect(await store.queueSize("q2")).toBe(1);

      const item1 = await store.dequeue("q1");
      expect(item1!.data).toBe("data-a");
      await store.ack("q1", item1!.id);

      // q2 should be unaffected
      expect(await store.queueSize("q2")).toBe(1);
      const item2 = await store.dequeue("q2");
      expect(item2!.data).toBe("data-b");
    });
  });

  // ── Concurrent queue consumers ────────────────────────────────────────

  describe("concurrent queue consumers", () => {
    it("two consumers dequeue different items (no double-delivery)", async () => {
      await store.enqueue("cq", "item-1");
      await store.enqueue("cq", "item-2");
      await store.enqueue("cq", "item-3");

      // Dequeue 3 items — each should be unique
      const items = [];
      for (let i = 0; i < 3; i++) {
        const item = await store.dequeue("cq");
        if (item) items.push(item);
      }
      expect(items).toHaveLength(3);

      const datas = items.map((it) => it.data);
      expect(new Set(datas).size).toBe(3);
      expect(datas).toContain("item-1");
      expect(datas).toContain("item-2");
      expect(datas).toContain("item-3");
    });

    it("visibility window prevents re-delivery of in-progress items", async () => {
      await store.enqueue("vq", "processing-item");

      // First consumer gets it with 60s visibility
      const item1 = await store.dequeue("vq", 60_000);
      expect(item1).not.toBeNull();

      // Second consumer should get nothing (item is invisible)
      const item2 = await store.dequeue("vq");
      expect(item2).toBeNull();

      // Nack makes it visible again
      await store.nack("vq", item1!.id);
      const item3 = await store.dequeue("vq");
      expect(item3).not.toBeNull();
      expect(item3!.id).toBe(item1!.id);
    });

    it("ack during visibility window permanently removes item", async () => {
      await store.enqueue("ackq", "will-be-acked");

      const item = await store.dequeue("ackq", 60_000);
      expect(item).not.toBeNull();

      // Ack while still invisible
      await store.ack("ackq", item!.id);

      // Even after visibility would have expired, item is gone
      expect(await store.queueSize("ackq")).toBe(0);
      expect(await store.dequeue("ackq")).toBeNull();
    });
  });

  // ── TTL interactions ──────────────────────────────────────────────────

  describe("TTL interactions", () => {
    it("short TTL item disappears after expiry", async () => {
      await store.set("ttl-key", "temporary", 30);

      // Should exist immediately
      expect(await store.get("ttl-key")).toBe("temporary");
      expect(await store.has("ttl-key")).toBe(true);

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 50));

      // Should be gone
      expect(await store.get("ttl-key")).toBeNull();
      expect(await store.has("ttl-key")).toBe(false);
    });

    it("TTL update by re-setting extends the lifetime", async () => {
      await store.set("ttl-extend", "v1", 30);

      await new Promise((r) => setTimeout(r, 20));

      // Re-set with a fresh TTL
      await store.set("ttl-extend", "v2", 100);

      await new Promise((r) => setTimeout(r, 30));

      // Should still exist (new TTL hasn't expired)
      expect(await store.get("ttl-extend")).toBe("v2");
    });

    it("mget returns null for expired items mixed with valid ones", async () => {
      await store.set("k1", "alive", 200);
      await store.set("k2", "dying", 20);
      await store.set("k3", "also-alive");

      await new Promise((r) => setTimeout(r, 40));

      const results = await store.mget(["k1", "k2", "k3"]);
      expect(results[0]).toBe("alive");
      expect(results[1]).toBeNull(); // expired
      expect(results[2]).toBe("also-alive");
    });
  });

  // ── Lock contention and expiry ────────────────────────────────────────

  describe("lock contention and expiry", () => {
    it("expired lock can be acquired by another client", async () => {
      // Lock with very short TTL
      const lock1 = await store.acquireLock("expiring-lock", 30);
      expect(lock1).not.toBeNull();

      // Wait for lock to expire
      await new Promise((r) => setTimeout(r, 50));

      // Another client should be able to acquire it
      const lock2 = await store.acquireLock("expiring-lock", 5_000, 0);
      expect(lock2).not.toBeNull();

      // lock1 release should be a no-op (token mismatch after expiry)
      await store.releaseLock(lock1!);

      // lock2 should still be valid
      const lock3 = await store.acquireLock("expiring-lock", 5_000, 0);
      expect(lock3).toBeNull(); // lock2 is still held

      await store.releaseLock(lock2!);
    });

    it("lock waitMs allows acquiring after holder releases", async () => {
      const lock1 = await store.acquireLock("wait-lock", 5_000);
      expect(lock1).not.toBeNull();

      // Start waiting for the lock
      const waitPromise = store.acquireLock("wait-lock", 5_000, 500);

      // Release after a short delay
      setTimeout(() => store.releaseLock(lock1!), 50);

      const lock2 = await waitPromise;
      expect(lock2).not.toBeNull();

      await store.releaseLock(lock2!);
    });

    it("lock waitMs timeout returns null if lock is never released", async () => {
      const lock1 = await store.acquireLock("norelease-lock", 60_000);
      expect(lock1).not.toBeNull();

      // Try to acquire with very short wait — should fail
      const lock2 = await store.acquireLock("norelease-lock", 5_000, 80);
      expect(lock2).toBeNull();

      await store.releaseLock(lock1!);
    });
  });

  // ── Queue + Lock workflow ─────────────────────────────────────────────

  describe("queue + lock workflow", () => {
    it("lock protects queue processing: only one processor at a time", async () => {
      await store.enqueue("locked-q", "job-1");
      await store.enqueue("locked-q", "job-2");

      const processed: string[] = [];

      // Processor 1 acquires lock and processes
      const lock1 = await store.acquireLock("locked-q-lock", 5_000);
      expect(lock1).not.toBeNull();

      const item1 = await store.dequeue("locked-q");
      expect(item1).not.toBeNull();
      processed.push(item1!.data as string);
      await store.ack("locked-q", item1!.id);

      // Processor 2 tries to acquire lock — should fail
      const lock2 = await store.acquireLock("locked-q-lock", 5_000, 0);
      expect(lock2).toBeNull();

      // Release lock
      await store.releaseLock(lock1!);

      // Now processor 2 can acquire and process
      const lock3 = await store.acquireLock("locked-q-lock", 5_000);
      expect(lock3).not.toBeNull();

      const item2 = await store.dequeue("locked-q");
      expect(item2).not.toBeNull();
      processed.push(item2!.data as string);
      await store.ack("locked-q", item2!.id);

      await store.releaseLock(lock3!);

      expect(processed).toEqual(["job-1", "job-2"]);
    });
  });

  // ── Pub/Sub stress ────────────────────────────────────────────────────

  describe("pub/sub stress", () => {
    it("100 rapid publishes are all received by subscriber", async () => {
      const received: number[] = [];
      await store.subscribe("stress-ch", (msg) => {
        received.push(msg as number);
      });

      for (let i = 0; i < 100; i++) {
        await store.publish("stress-ch", i);
      }

      expect(received).toHaveLength(100);
      expect(received[0]).toBe(0);
      expect(received[99]).toBe(99);
    });

    it("subscriber error does not affect other subscribers", async () => {
      const good: unknown[] = [];

      await store.subscribe("err-ch", () => {
        throw new Error("subscriber crash");
      });
      await store.subscribe("err-ch", (msg) => {
        good.push(msg);
      });

      const count = await store.publish("err-ch", "test-payload");
      expect(count).toBe(2); // both subscribers counted
      expect(good).toEqual(["test-payload"]);
    });

    it("unsubscribe during publish does not break iteration", async () => {
      const received: string[] = [];
      let unsub: (() => void) | null = null;

      const sub1 = await store.subscribe("unsub-ch", (msg) => {
        received.push("s1:" + String(msg));
        // Unsubscribe self during handler
        if (unsub) unsub();
      });
      unsub = sub1.unsubscribe;

      await store.subscribe("unsub-ch", (msg) => {
        received.push("s2:" + String(msg));
      });

      await store.publish("unsub-ch", "hello");

      // Both should have received the first message
      expect(received).toContain("s1:hello");
      expect(received).toContain("s2:hello");
    });
  });

  // ── Queue ordering and FIFO guarantee ─────────────────────────────────

  describe("queue ordering", () => {
    it("items are dequeued in FIFO order", async () => {
      for (let i = 0; i < 10; i++) {
        await store.enqueue("fifo-q", "item-" + i);
      }

      const order: string[] = [];
      for (let i = 0; i < 10; i++) {
        const item = await store.dequeue("fifo-q", 60_000);
        if (item) {
          order.push(item.data as string);
          await store.ack("fifo-q", item.id);
        }
      }

      expect(order).toEqual(
        Array.from({ length: 10 }, (_, i) => "item-" + i),
      );
    });

    it("nacked item appears at original position (not moved to end)", async () => {
      await store.enqueue("nack-order", "first");
      await store.enqueue("nack-order", "second");
      await store.enqueue("nack-order", "third");

      // Dequeue first, then nack it
      const item1 = await store.dequeue("nack-order");
      expect(item1!.data).toBe("first");
      await store.nack("nack-order", item1!.id);

      // Dequeue again — should get "first" again (it's at the front)
      const item1retry = await store.dequeue("nack-order");
      expect(item1retry!.data).toBe("first");
      await store.ack("nack-order", item1retry!.id);

      // Next should be "second"
      const item2 = await store.dequeue("nack-order");
      expect(item2!.data).toBe("second");
    });
  });

  // ── Hash bulk operations ──────────────────────────────────────────────

  describe("hash bulk operations", () => {
    it("hgetall reflects incremental changes accurately", async () => {
      await store.hset("bulk-h", "a", 1);
      await store.hset("bulk-h", "b", 2);
      await store.hset("bulk-h", "c", 3);

      let all = await store.hgetall<number>("bulk-h");
      expect(Object.keys(all)).toHaveLength(3);

      // Update one, delete one
      await store.hset("bulk-h", "b", 20);
      await store.hdel("bulk-h", "c");

      all = await store.hgetall<number>("bulk-h");
      expect(all).toEqual({ a: 1, b: 20 });
    });

    it("hdel of last field cleans up the hash entirely", async () => {
      await store.hset("cleanup-h", "only-field", "value");
      await store.hdel("cleanup-h", "only-field");

      const all = await store.hgetall("cleanup-h");
      expect(Object.keys(all)).toHaveLength(0);
    });
  });

  // ── Set edge cases ────────────────────────────────────────────────────

  describe("set operations stress", () => {
    it("adding same member multiple times is idempotent", async () => {
      for (let i = 0; i < 5; i++) {
        await store.sadd("dedup-set", "member");
      }
      const members = await store.smembers("dedup-set");
      expect(members).toEqual(["member"]);
    });

    it("srem of last member cleans up the set", async () => {
      await store.sadd("cleanup-set", "only");
      await store.srem("cleanup-set", "only");

      const members = await store.smembers("cleanup-set");
      expect(members).toEqual([]);
      expect(await store.sismember("cleanup-set", "only")).toBe(false);
    });

    it("set with many members", async () => {
      for (let i = 0; i < 50; i++) {
        await store.sadd("big-set", "m-" + i);
      }
      const members = await store.smembers("big-set");
      expect(members).toHaveLength(50);
      expect(await store.sismember("big-set", "m-0")).toBe(true);
      expect(await store.sismember("big-set", "m-49")).toBe(true);
      expect(await store.sismember("big-set", "m-50")).toBe(false);
    });
  });
});
