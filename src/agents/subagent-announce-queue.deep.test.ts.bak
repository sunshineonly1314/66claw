/**
 * Deep tests for subagent-announce-queue — Bug 1 regression: crash recovery via StateStore.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueAnnounce,
  recoverAnnounceQueue,
  resetAnnounceQueuesForTests,
} from "./subagent-announce-queue.js";
import {
  initStateStore,
  closeStateStore,
  getStateStoreOrNull,
} from "../infra/state-store/index.js";

async function waitFor(predicate: () => boolean, timeoutMs = 3_000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error("timed out waiting for condition");
}

describe("subagent-announce-queue deep tests", () => {
  beforeEach(async () => {
    resetAnnounceQueuesForTests();
    await initStateStore({ backend: "memory" });
  });

  afterEach(async () => {
    resetAnnounceQueuesForTests();
    await closeStateStore();
  });

  describe("StateStore persistence (Bug 1)", () => {
    it("persists announce items to StateStore on enqueue", async () => {
      const send = vi.fn(async () => {});
      enqueueAnnounce({
        key: "test:persist",
        item: {
          prompt: "test announce",
          enqueuedAt: Date.now(),
          sessionKey: "agent:main:main",
        },
        settings: { mode: "followup", debounceMs: 0 },
        send,
      });

      // Wait for drain to complete
      await waitFor(() => send.mock.calls.length >= 1);
      await new Promise(r => setTimeout(r, 50));

      // After drain completes, StateStore queue should be acked (empty)
      const store = getStateStoreOrNull()!;
      const size = await store.queueSize("announce:test:persist");
      expect(size).toBe(0);
    });

    it("recoverAnnounceQueue re-delivers persisted items", async () => {
      const store = getStateStoreOrNull()!;

      // Manually simulate crash state: items in StateStore but not in memory
      await store.sadd("announce:active-keys", "test:recover");
      await store.enqueue("announce:test:recover", {
        prompt: "recovered-1",
        enqueuedAt: 1000,
        sessionKey: "agent:main:main",
      });
      await store.enqueue("announce:test:recover", {
        prompt: "recovered-2",
        enqueuedAt: 2000,
        sessionKey: "agent:main:main",
      });

      const recovered: Array<{ key: string; prompt: string }> = [];
      const count = await recoverAnnounceQueue((key, item) => {
        recovered.push({ key, prompt: item.prompt });
      });

      expect(count).toBe(2);
      expect(recovered).toEqual([
        { key: "test:recover", prompt: "recovered-1" },
        { key: "test:recover", prompt: "recovered-2" },
      ]);

      // StateStore queue should be empty after recovery
      expect(await store.queueSize("announce:test:recover")).toBe(0);
      // Active key should be cleaned up
      expect(await store.sismember("announce:active-keys", "test:recover")).toBe(false);
    });

    it("recoverAnnounceQueue returns 0 when no items to recover", async () => {
      const count = await recoverAnnounceQueue(() => {});
      expect(count).toBe(0);
    });

    it("recoverAnnounceQueue handles multiple queue keys", async () => {
      const store = getStateStoreOrNull()!;

      await store.sadd("announce:active-keys", "key-a");
      await store.sadd("announce:active-keys", "key-b");
      await store.enqueue("announce:key-a", { prompt: "a1", enqueuedAt: 1, sessionKey: "s" });
      await store.enqueue("announce:key-b", { prompt: "b1", enqueuedAt: 2, sessionKey: "s" });
      await store.enqueue("announce:key-b", { prompt: "b2", enqueuedAt: 3, sessionKey: "s" });

      const items: string[] = [];
      const count = await recoverAnnounceQueue((key, item) => {
        items.push(`${key}:${item.prompt}`);
      });

      expect(count).toBe(3);
      expect(items).toContain("key-a:a1");
      expect(items).toContain("key-b:b1");
      expect(items).toContain("key-b:b2");
    });
  });

  describe("enqueue edge cases", () => {
    it("drop policy 'new' drops excess items and triggers drain", async () => {
      const sent: string[] = [];
      const send = vi.fn(async (item: { prompt: string }) => {
        sent.push(item.prompt);
      });

      // Cap=1, dropPolicy=new → second enqueue should be dropped
      enqueueAnnounce({
        key: "test:drop-new",
        item: { prompt: "first", enqueuedAt: Date.now(), sessionKey: "s" },
        settings: { mode: "followup", debounceMs: 0, cap: 1, dropPolicy: "new" },
        send,
      });
      const accepted = enqueueAnnounce({
        key: "test:drop-new",
        item: { prompt: "second-dropped", enqueuedAt: Date.now(), sessionKey: "s" },
        settings: { mode: "followup", debounceMs: 0, cap: 1, dropPolicy: "new" },
        send,
      });

      expect(accepted).toBe(false);
      await waitFor(() => sent.length >= 1);
      expect(sent[0]).toBe("first");
    });
  });
});
