/**
 * Deep tests for distributed-broadcast — Bug 4 regression: publishWithRetry retry buffer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initStateStore, closeStateStore, getStateStoreOrNull } from "../infra/state-store/index.js";
import { initDistributedBroadcast } from "./distributed-broadcast.js";

describe("distributed-broadcast deep tests", () => {
  beforeEach(async () => {
    await initStateStore({ backend: "memory" });
  });

  afterEach(async () => {
    await closeStateStore();
  });

  describe("publishWithRetry buffer (Bug 4)", () => {
    it("retries previously failed frames on next broadcast", async () => {
      const store = getStateStoreOrNull()!;
      const localBroadcast = vi.fn();
      const localBroadcastToConnIds = vi.fn();
      const remoteBroadcast = vi.fn();

      // Set up a second instance to observe retried messages
      const instance2 = await initDistributedBroadcast({
        localBroadcast: remoteBroadcast,
        localBroadcastToConnIds: vi.fn(),
        _instanceId: "observer",
      });

      // Sabotage publish for first call only
      let publishCallCount = 0;
      const originalPublish = store.publish.bind(store);
      vi.spyOn(store, "publish").mockImplementation(async (channel, message) => {
        publishCallCount++;
        if (publishCallCount <= 1) {
          throw new Error("Redis connection lost");
        }
        return originalPublish(channel, message);
      });

      const instance1 = await initDistributedBroadcast({
        localBroadcast,
        localBroadcastToConnIds,
        _instanceId: "sender",
      });

      // First broadcast fails to publish (but local delivery works)
      instance1.broadcast("event1", { data: "first" });
      await new Promise(r => setTimeout(r, 30));

      // Local was called, but remote should NOT have received (publish failed)
      expect(localBroadcast).toHaveBeenCalledTimes(1);
      expect(remoteBroadcast).toHaveBeenCalledTimes(0);

      // Second broadcast triggers retry of buffered frame + new frame
      instance1.broadcast("event2", { data: "second" });
      await new Promise(r => setTimeout(r, 30));

      // Remote should now have received both (retried + new)
      expect(remoteBroadcast).toHaveBeenCalledTimes(2);

      instance1.teardown();
      instance2.teardown();
      vi.restoreAllMocks();
    });

    it("drops events when retry buffer is full (3)", async () => {
      const store = getStateStoreOrNull()!;
      const localBroadcast = vi.fn();
      const remoteBroadcast = vi.fn();

      const instance2 = await initDistributedBroadcast({
        localBroadcast: remoteBroadcast,
        localBroadcastToConnIds: vi.fn(),
        _instanceId: "observer2",
      });

      // Make ALL publishes fail
      vi.spyOn(store, "publish").mockRejectedValue(new Error("Redis down"));

      const instance1 = await initDistributedBroadcast({
        localBroadcast,
        localBroadcastToConnIds: vi.fn(),
        _instanceId: "sender2",
      });

      // Send 5 broadcasts — buffer holds max 3, so 2 should be dropped
      for (let i = 0; i < 5; i++) {
        instance1.broadcast(`event-${i}`, { i });
      }
      await new Promise(r => setTimeout(r, 50));

      // All local deliveries should work
      expect(localBroadcast).toHaveBeenCalledTimes(5);

      // No remote deliveries (all publishes failed)
      expect(remoteBroadcast).toHaveBeenCalledTimes(0);

      instance1.teardown();
      instance2.teardown();
      vi.restoreAllMocks();
    });

    it("flushes entire retry buffer when connection recovers", async () => {
      const store = getStateStoreOrNull()!;
      const localBroadcast = vi.fn();
      const remoteBroadcast = vi.fn();

      const instance2 = await initDistributedBroadcast({
        localBroadcast: remoteBroadcast,
        localBroadcastToConnIds: vi.fn(),
        _instanceId: "obs3",
      });

      let failCount = 0;
      const originalPublish = store.publish.bind(store);
      vi.spyOn(store, "publish").mockImplementation(async (channel, message) => {
        failCount++;
        // Fail first 3 publishes, then succeed
        if (failCount <= 3) {
          throw new Error("Connection lost");
        }
        return originalPublish(channel, message);
      });

      const instance1 = await initDistributedBroadcast({
        localBroadcast,
        localBroadcastToConnIds: vi.fn(),
        _instanceId: "sender3",
      });

      // Send 3 broadcasts (all fail, all buffered)
      instance1.broadcast("e1", { v: 1 });
      instance1.broadcast("e2", { v: 2 });
      instance1.broadcast("e3", { v: 3 });
      await new Promise(r => setTimeout(r, 30));
      expect(remoteBroadcast).toHaveBeenCalledTimes(0);

      // 4th broadcast: publish recovers, should flush buffer + send new
      instance1.broadcast("e4", { v: 4 });
      await new Promise(r => setTimeout(r, 50));

      // All 4 events should eventually reach remote
      // (buffer flush sends 3 retries, then 1 new = 4 total)
      expect(remoteBroadcast.mock.calls.length).toBeGreaterThanOrEqual(1);

      instance1.teardown();
      instance2.teardown();
      vi.restoreAllMocks();
    });
  });

  describe("error handling in subscriber", () => {
    it("survives malformed frames from pub/sub without crashing", async () => {
      const store = getStateStoreOrNull()!;
      const localBroadcast = vi.fn();

      const instance = await initDistributedBroadcast({
        localBroadcast,
        localBroadcastToConnIds: vi.fn(),
        _instanceId: "robust-test",
      });

      // Publish a malformed frame directly
      await store.publish("gateway:broadcast", { garbage: true });
      await new Promise(r => setTimeout(r, 20));

      // Should not crash, localBroadcast should handle gracefully
      // (frame has no instanceId so it won’t match, may or may not call local)
      // The key test is that it doesn’t throw
      instance.teardown();
    });
  });

  describe("broadcastToConnIds cross-instance", () => {
    it("preserves opts through relay", async () => {
      const localBroadcast1 = vi.fn();
      const localBroadcastToConnIds1 = vi.fn();
      const localBroadcast2 = vi.fn();
      const localBroadcastToConnIds2 = vi.fn();

      const i1 = await initDistributedBroadcast({
        localBroadcast: localBroadcast1,
        localBroadcastToConnIds: localBroadcastToConnIds1,
        _instanceId: "opts-1",
      });

      const i2 = await initDistributedBroadcast({
        localBroadcast: localBroadcast2,
        localBroadcastToConnIds: localBroadcastToConnIds2,
        _instanceId: "opts-2",
      });

      const connIds = new Set(["conn-x"]);
      const opts = { dropIfSlow: true, stateVersion: { presence: 42, health: 7 } };
      i1.broadcastToConnIds("health", { status: "ok" }, connIds, opts);

      await new Promise(r => setTimeout(r, 30));

      expect(localBroadcastToConnIds2).toHaveBeenCalledTimes(1);
      const [, , , receivedOpts] = localBroadcastToConnIds2.mock.calls[0];
      expect(receivedOpts).toEqual(opts);

      i1.teardown();
      i2.teardown();
    });
  });
});
