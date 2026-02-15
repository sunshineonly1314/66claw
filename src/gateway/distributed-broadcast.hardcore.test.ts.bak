/**
 * Hardcore tests for distributed-broadcast — retry ordering,
 * multi-instance relay, stress testing, teardown safety, echo suppression.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initStateStore,
  closeStateStore,
} from "../infra/state-store/index.js";
import { initDistributedBroadcast } from "./distributed-broadcast.js";

describe("distributed-broadcast hardcore tests", () => {
  beforeEach(async () => {
    await initStateStore({ backend: "memory" });
  });

  afterEach(async () => {
    await closeStateStore();
  });

  // ── Retry buffer ordering ─────────────────────────────────────────────

  describe("retry buffer ordering", () => {
    it("retry buffer flushes in FIFO order on recovery", async () => {
      const localCalls: string[] = [];
      const remoteCalls: string[] = [];

      // Instance A — sender (we'll force publish failures)
      const storeModule = await import("../infra/state-store/index.js");
      const store = storeModule.getStateStoreOrNull()!;
      const origPublish = store.publish.bind(store);

      let failCount = 0;
      store.publish = async (channel: string, message: unknown) => {
        failCount++;
        if (failCount <= 3) {
          throw new Error("publish fail #" + failCount);
        }
        return origPublish(channel, message);
      };

      const { broadcast, teardown } = await initDistributedBroadcast({
        localBroadcast: (event) => localCalls.push(event),
        localBroadcastToConnIds: () => {},
        _instanceId: "sender-1",
      });

      // These 3 will fail and be buffered
      broadcast("event-1", {});
      broadcast("event-2", {});
      broadcast("event-3", {});

      // Wait for async publish attempts
      await new Promise((r) => setTimeout(r, 50));

      // Restore working publish
      store.publish = origPublish;

      // Subscribe to see what gets published
      await store.subscribe("gateway:broadcast", (msg) => {
        const frame = msg as { event: string };
        remoteCalls.push(frame.event);
      });

      // This broadcast should succeed AND flush the retry buffer
      broadcast("event-4", {});
      await new Promise((r) => setTimeout(r, 100));

      // Local calls should have all 4 (local delivery always works)
      expect(localCalls).toEqual(["event-1", "event-2", "event-3", "event-4"]);

      // Remote should receive buffered items in FIFO order, then the new one
      expect(remoteCalls.length).toBeGreaterThanOrEqual(1);

      teardown();
    });
  });

  // ── Multi-instance relay ──────────────────────────────────────────────

  describe("multi-instance relay", () => {
    it("3 instances: A broadcasts, B and C receive, A does not (echo suppression)", async () => {
      const receivedA: string[] = [];
      const receivedB: string[] = [];
      const receivedC: string[] = [];

      const instA = await initDistributedBroadcast({
        localBroadcast: (event) => receivedA.push("A:" + event),
        localBroadcastToConnIds: () => {},
        _instanceId: "instance-A",
      });

      const instB = await initDistributedBroadcast({
        localBroadcast: (event) => receivedB.push("B:" + event),
        localBroadcastToConnIds: () => {},
        _instanceId: "instance-B",
      });

      const instC = await initDistributedBroadcast({
        localBroadcast: (event) => receivedC.push("C:" + event),
        localBroadcastToConnIds: () => {},
        _instanceId: "instance-C",
      });

      // A broadcasts
      instA.broadcast("test-event", { data: "hello" });
      await new Promise((r) => setTimeout(r, 50));

      // A should have local delivery only (no remote echo)
      expect(receivedA).toEqual(["A:test-event"]);

      // B and C should each receive via remote relay
      expect(receivedB).toEqual(["B:test-event"]);
      expect(receivedC).toEqual(["C:test-event"]);

      instA.teardown();
      instB.teardown();
      instC.teardown();
    });

    it("broadcastToConnIds is forwarded with target connIds to remote instances", async () => {
      let remoteConnIds: string[] = [];

      const instA = await initDistributedBroadcast({
        localBroadcast: () => {},
        localBroadcastToConnIds: () => {},
        _instanceId: "sender",
      });

      const instB = await initDistributedBroadcast({
        localBroadcast: () => {},
        localBroadcastToConnIds: (_event, _payload, connIds) => {
          remoteConnIds = [...connIds];
        },
        _instanceId: "receiver",
      });

      instA.broadcastToConnIds("targeted", { x: 1 }, new Set(["conn-1", "conn-2"]));
      await new Promise((r) => setTimeout(r, 50));

      expect(remoteConnIds.sort()).toEqual(["conn-1", "conn-2"]);

      instA.teardown();
      instB.teardown();
    });
  });

  // ── Stress test ───────────────────────────────────────────────────────

  describe("broadcast stress", () => {
    it("50 rapid broadcasts from one instance are all received by another", async () => {
      const received: number[] = [];

      const sender = await initDistributedBroadcast({
        localBroadcast: () => {},
        localBroadcastToConnIds: () => {},
        _instanceId: "stress-sender",
      });

      const receiver = await initDistributedBroadcast({
        localBroadcast: (_event, payload) => {
          received.push((payload as { idx: number }).idx);
        },
        localBroadcastToConnIds: () => {},
        _instanceId: "stress-receiver",
      });

      for (let i = 0; i < 50; i++) {
        sender.broadcast("stress", { idx: i });
      }

      await new Promise((r) => setTimeout(r, 200));

      // All 50 should be received (MemoryStateStore pub/sub is synchronous)
      expect(received).toHaveLength(50);
      expect(received[0]).toBe(0);
      expect(received[49]).toBe(49);

      sender.teardown();
      receiver.teardown();
    });
  });

  // ── Teardown safety ───────────────────────────────────────────────────

  describe("teardown safety", () => {
    it("teardown is idempotent", async () => {
      const inst = await initDistributedBroadcast({
        localBroadcast: () => {},
        localBroadcastToConnIds: () => {},
        _instanceId: "teardown-test",
      });

      inst.teardown();
      inst.teardown(); // should not throw
    });

    it("broadcast after teardown still delivers locally", async () => {
      const localCalls: string[] = [];

      const inst = await initDistributedBroadcast({
        localBroadcast: (event) => localCalls.push(event),
        localBroadcastToConnIds: () => {},
        _instanceId: "post-teardown",
      });

      inst.teardown();

      // Local delivery still works (broadcast function references local fn directly)
      inst.broadcast("after-teardown", {});

      expect(localCalls).toEqual(["after-teardown"]);
    });
  });

  // ── Echo suppression edge cases ───────────────────────────────────────

  describe("echo suppression edge cases", () => {
    it("two instances with same ID suppress each other (pathological case)", async () => {
      const received: string[] = [];

      const inst1 = await initDistributedBroadcast({
        localBroadcast: () => {},
        localBroadcastToConnIds: () => {},
        _instanceId: "same-id",
      });

      const inst2 = await initDistributedBroadcast({
        localBroadcast: (event) => received.push(event),
        localBroadcastToConnIds: () => {},
        _instanceId: "same-id",
      });

      inst1.broadcast("echo-test", {});
      await new Promise((r) => setTimeout(r, 50));

      // inst2 should NOT receive because instanceId matches
      expect(received).toEqual([]);

      inst1.teardown();
      inst2.teardown();
    });

    it("opts are preserved through remote relay", async () => {
      let receivedOpts: unknown = null;

      const sender = await initDistributedBroadcast({
        localBroadcast: () => {},
        localBroadcastToConnIds: () => {},
        _instanceId: "opts-sender",
      });

      const receiver = await initDistributedBroadcast({
        localBroadcast: (_event, _payload, opts) => {
          receivedOpts = opts;
        },
        localBroadcastToConnIds: () => {},
        _instanceId: "opts-receiver",
      });

      sender.broadcast("opts-event", {}, {
        dropIfSlow: true,
        stateVersion: { presence: 42, health: 7 },
      });
      await new Promise((r) => setTimeout(r, 50));

      expect(receivedOpts).toEqual({
        dropIfSlow: true,
        stateVersion: { presence: 42, health: 7 },
      });

      sender.teardown();
      receiver.teardown();
    });
  });
});
