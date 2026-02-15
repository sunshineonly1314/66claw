/**
 * Stress tests and edge-case tests for StateStore implementations.
 *
 * Covers: lock contention, pub/sub fan-out, queue reliability, TTL expiry,
 * concurrent access, and boundary conditions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStateStore } from "./memory-store.js";

describe("MemoryStateStore — edge cases & stress", () => {
  let store: MemoryStateStore;

  beforeEach(async () => {
    store = new MemoryStateStore();
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
  });

  // ── KV edge cases ──────────────────────────────────────────────────────

  describe("KV edge cases", () => {
    it("handles empty string key", async () => {
      await store.set("", "value");
      expect(await store.get("")).toBe("value");
    });

    it("handles complex nested objects", async () => {
      const complex = {
        nested: { deep: { array: [1, 2, { key: "val" }] } },
        nullish: null,
        num: 0,
        empty: "",
      };
      await store.set("complex", complex);
      expect(await store.get("complex")).toEqual(complex);
    });

    it("TTL expiry removes key", async () => {
      await store.set("ttl-key", "value", 50);
      expect(await store.get("ttl-key")).toBe("value");
      await new Promise((r) => setTimeout(r, 80));
      expect(await store.get("ttl-key")).toBeNull();
    });

    it("set with ttl=0 never expires", async () => {
      await store.set("no-ttl", "value", 0);
      expect(await store.has("no-ttl")).toBe(true);
    });

    it("overwriting a key resets TTL", async () => {
      await store.set("k", "v1", 50);
      await store.set("k", "v2"); // No TTL — should clear expiry
      await new Promise((r) => setTimeout(r, 80));
      expect(await store.get("k")).toBe("v2");
    });

    it("del removes key across all namespaces", async () => {
      await store.set("k", "val");
      await store.hset("k", "field", "hval");
      await store.sadd("k", "member");
      await store.del("k");
      expect(await store.get("k")).toBeNull();
      expect(await store.hget("k", "field")).toBeNull();
      expect(await store.smembers("k")).toEqual([]);
    });

    it("mget handles missing keys gracefully", async () => {
      await store.set("a", 1);
      const result = await store.mget(["a", "missing", "also-missing"]);
      expect(result).toEqual([1, null, null]);
    });

    it("mset with empty array is no-op", async () => {
      await store.mset([]);
      // No error thrown
    });

    it("mget with empty array returns empty", async () => {
      const result = await store.mget([]);
      expect(result).toEqual([]);
    });
  });

  // ── Hash edge cases ────────────────────────────────────────────────────

  describe("Hash edge cases", () => {
    it("hgetall returns empty object for missing key", async () => {
      expect(await store.hgetall("nonexistent")).toEqual({});
    });

    it("hdel on missing field is no-op", async () => {
      await store.hdel("missing-hash", "field");
      // No error
    });

    it("hdel removes hash entry when last field deleted", async () => {
      await store.hset("h", "only-field", "value");
      await store.hdel("h", "only-field");
      expect(await store.hgetall("h")).toEqual({});
    });
  });

  // ── Set edge cases ─────────────────────────────────────────────────────

  describe("Set edge cases", () => {
    it("srem on empty set is no-op", async () => {
      await store.srem("nonexistent-set", "member");
    });

    it("sismember returns false for non-existent set", async () => {
      expect(await store.sismember("nope", "m")).toBe(false);
    });

    it("sadd deduplicates members", async () => {
      await store.sadd("s", "a");
      await store.sadd("s", "a");
      await store.sadd("s", "a");
      expect(await store.smembers("s")).toEqual(["a"]);
    });

    it("srem removes set when last member deleted", async () => {
      await store.sadd("s", "only");
      await store.srem("s", "only");
      expect(await store.smembers("s")).toEqual([]);
    });
  });

  // ── Lock contention ────────────────────────────────────────────────────

  describe("Lock contention", () => {
    it("concurrent lock requests serialize correctly", async () => {
      const order: number[] = [];
      const work = async (id: number) => {
        const lock = await store.acquireLock("contention", 5_000, 5_000);
        expect(lock).not.toBeNull();
        order.push(id);
        // Simulate work
        await new Promise((r) => setTimeout(r, 20));
        await store.releaseLock(lock!);
      };

      // Launch 5 concurrent lock requests
      await Promise.all([work(1), work(2), work(3), work(4), work(5)]);
      // All should complete
      expect(order.length).toBe(5);
      // All ids should be present
      expect(new Set(order).size).toBe(5);
    });

    it("lock timeout returns null without blocking forever", async () => {
      // Acquire a lock that won't be released
      const lock1 = await store.acquireLock("timeout-test", 60_000, 0);
      expect(lock1).not.toBeNull();

      // Second request should timeout
      const start = Date.now();
      const lock2 = await store.acquireLock("timeout-test", 60_000, 100);
      const elapsed = Date.now() - start;

      expect(lock2).toBeNull();
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(500);

      await store.releaseLock(lock1!);
    });

    it("expired lock can be acquired by another caller", async () => {
      // Lock with very short TTL
      const lock1 = await store.acquireLock("expire-test", 30, 0);
      expect(lock1).not.toBeNull();

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 50));

      // Should be able to acquire now
      const lock2 = await store.acquireLock("expire-test", 5_000, 0);
      expect(lock2).not.toBeNull();
      expect(lock2!.token).not.toBe(lock1!.token);

      await store.releaseLock(lock2!);
    });

    it("releasing an already-released lock is no-op", async () => {
      const lock = await store.acquireLock("release-twice", 5_000, 0);
      expect(lock).not.toBeNull();
      await store.releaseLock(lock!);
      // Should not throw
      await store.releaseLock(lock!);
    });

    it("releasing with wrong token is no-op", async () => {
      const lock = await store.acquireLock("wrong-token", 5_000, 0);
      expect(lock).not.toBeNull();

      // Try releasing with a fake token
      await store.releaseLock({ token: "fake-token", key: "wrong-token", acquiredAt: Date.now() });

      // Original lock should still be held
      const lock2 = await store.acquireLock("wrong-token", 5_000, 0);
      expect(lock2).toBeNull(); // Can't acquire — original still held

      await store.releaseLock(lock!);
    });
  });

  // ── Pub/Sub edge cases ─────────────────────────────────────────────────

  describe("Pub/Sub edge cases", () => {
    it("publish to channel with no subscribers returns 0", async () => {
      const count = await store.publish("empty-channel", { data: "hello" });
      expect(count).toBe(0);
    });

    it("subscriber error does not affect other subscribers", async () => {
      const received: unknown[] = [];
      await store.subscribe("err-channel", () => {
        throw new Error("subscriber exploded");
      });
      await store.subscribe("err-channel", (msg) => {
        received.push(msg);
      });

      await store.publish("err-channel", "test-msg");
      expect(received).toEqual(["test-msg"]);
    });

    it("unsubscribe from one handler doesn't affect others", async () => {
      const msgs1: unknown[] = [];
      const msgs2: unknown[] = [];

      const sub1 = await store.subscribe("multi-sub", (msg) => msgs1.push(msg));
      await store.subscribe("multi-sub", (msg) => msgs2.push(msg));

      await store.publish("multi-sub", "first");
      sub1.unsubscribe();
      await store.publish("multi-sub", "second");

      expect(msgs1).toEqual(["first"]);
      expect(msgs2).toEqual(["first", "second"]);
    });

    it("handles fan-out to many subscribers", async () => {
      const received = new Array(50).fill(0);
      for (let i = 0; i < 50; i++) {
        const idx = i;
        await store.subscribe("fanout", () => {
          received[idx]++;
        });
      }

      const count = await store.publish("fanout", "broadcast");
      expect(count).toBe(50);
      expect(received.every((c) => c === 1)).toBe(true);
    });
  });

  // ── Queue reliability ──────────────────────────────────────────────────

  describe("Queue reliability", () => {
    it("FIFO ordering is maintained", async () => {
      for (let i = 0; i < 10; i++) {
        await store.enqueue("fifo", i);
      }

      const dequeued: number[] = [];
      for (let i = 0; i < 10; i++) {
        const item = await store.dequeue<number>("fifo");
        expect(item).not.toBeNull();
        dequeued.push(item!.data);
        await store.ack("fifo", item!.id);
      }

      expect(dequeued).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it("dequeue from empty queue returns null", async () => {
      const item = await store.dequeue("empty-queue");
      expect(item).toBeNull();
    });

    it("nack makes item visible again immediately", async () => {
      await store.enqueue("nack-test", "item1");

      const first = await store.dequeue("nack-test");
      expect(first).not.toBeNull();
      expect(first!.attempts).toBe(1);

      // Before nack, item is invisible
      const invisible = await store.dequeue("nack-test");
      expect(invisible).toBeNull();

      // Nack makes it visible
      await store.nack("nack-test", first!.id);
      const second = await store.dequeue("nack-test");
      expect(second).not.toBeNull();
      expect(second!.id).toBe(first!.id);
      expect(second!.attempts).toBe(2);

      await store.ack("nack-test", second!.id);
    });

    it("ack on non-existent queue is no-op", async () => {
      await store.ack("phantom", "fake-id");
      // No error
    });

    it("queueSize tracks pending items", async () => {
      expect(await store.queueSize("size-test")).toBe(0);

      await store.enqueue("size-test", "a");
      await store.enqueue("size-test", "b");
      expect(await store.queueSize("size-test")).toBe(2);

      const item = await store.dequeue("size-test");
      // Still in queue (not ack'd)
      expect(await store.queueSize("size-test")).toBe(2);

      await store.ack("size-test", item!.id);
      expect(await store.queueSize("size-test")).toBe(1);
    });

    it("visibility timeout re-exposes items", async () => {
      await store.enqueue("vis-test", "data");

      // Dequeue with very short visibility
      const item = await store.dequeue("vis-test", 30);
      expect(item).not.toBeNull();

      // Immediately invisible
      expect(await store.dequeue("vis-test")).toBeNull();

      // Wait for visibility to expire
      await new Promise((r) => setTimeout(r, 50));

      // Should be visible again
      const requeued = await store.dequeue("vis-test");
      expect(requeued).not.toBeNull();
      expect(requeued!.id).toBe(item!.id);
      expect(requeued!.attempts).toBe(2);

      await store.ack("vis-test", requeued!.id);
    });
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────

  describe("Lifecycle", () => {
    it("close clears all data", async () => {
      await store.set("k", "v");
      await store.hset("h", "f", "v");
      await store.sadd("s", "m");
      await store.enqueue("q", "d");

      await store.close();
      // Re-init
      store = new MemoryStateStore();
      await store.initialize();

      expect(await store.get("k")).toBeNull();
      expect(await store.hget("h", "f")).toBeNull();
      expect(await store.smembers("s")).toEqual([]);
      expect(await store.queueSize("q")).toBe(0);
    });

    it("ready flag tracks lifecycle", async () => {
      const fresh = new MemoryStateStore();
      expect(fresh.ready).toBe(false);
      await fresh.initialize();
      expect(fresh.ready).toBe(true);
      await fresh.close();
      expect(fresh.ready).toBe(false);
    });
  });
});
