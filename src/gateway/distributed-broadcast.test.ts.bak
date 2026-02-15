import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initStateStore, closeStateStore } from "../infra/state-store/index.js";
import { initDistributedBroadcast, getInstanceId } from "./distributed-broadcast.js";

describe("distributed broadcast bridge", () => {
  beforeEach(async () => {
    await initStateStore({ backend: "memory" });
  });

  afterEach(async () => {
    await closeStateStore();
  });

  it("delegates to local broadcast when store is available", async () => {
    const localBroadcast = vi.fn();
    const localBroadcastToConnIds = vi.fn();

    const { broadcast, teardown } = await initDistributedBroadcast({
      localBroadcast,
      localBroadcastToConnIds,
    });

    broadcast("chat", { msg: "hello" });
    expect(localBroadcast).toHaveBeenCalledWith("chat", { msg: "hello" }, undefined);

    teardown();
  });

  it("delegates targeted broadcast locally", async () => {
    const localBroadcast = vi.fn();
    const localBroadcastToConnIds = vi.fn();

    const { broadcastToConnIds, teardown } = await initDistributedBroadcast({
      localBroadcast,
      localBroadcastToConnIds,
    });

    const ids = new Set(["conn-1", "conn-2"]);
    broadcastToConnIds("agent", { run: "r1" }, ids, { dropIfSlow: true });

    expect(localBroadcastToConnIds).toHaveBeenCalledWith(
      "agent",
      { run: "r1" },
      ids,
      { dropIfSlow: true },
    );

    teardown();
  });

  it("does not echo own broadcasts back to self", async () => {
    const localBroadcast = vi.fn();
    const localBroadcastToConnIds = vi.fn();

    const { broadcast, teardown } = await initDistributedBroadcast({
      localBroadcast,
      localBroadcastToConnIds,
      _instanceId: "self-echo-test",
    });

    broadcast("chat", { msg: "test" });

    // Wait a tick for pub/sub delivery
    await new Promise((r) => setTimeout(r, 20));

    // localBroadcast should be called exactly once (the direct call),
    // NOT twice (would indicate echo from pub/sub)
    expect(localBroadcast).toHaveBeenCalledTimes(1);

    teardown();
  });

  it("receives broadcasts from another instance", async () => {
    // Simulate two instances with different instance IDs
    const localBroadcast1 = vi.fn();
    const localBroadcastToConnIds1 = vi.fn();
    const localBroadcast2 = vi.fn();
    const localBroadcastToConnIds2 = vi.fn();

    const instance1 = await initDistributedBroadcast({
      localBroadcast: localBroadcast1,
      localBroadcastToConnIds: localBroadcastToConnIds1,
      _instanceId: "instance-1",
    });

    const instance2 = await initDistributedBroadcast({
      localBroadcast: localBroadcast2,
      localBroadcastToConnIds: localBroadcastToConnIds2,
      _instanceId: "instance-2",
    });

    // Instance 1 broadcasts
    instance1.broadcast("chat", { msg: "from-1" });

    // Wait for pub/sub delivery
    await new Promise((r) => setTimeout(r, 20));

    // Instance 1's local broadcast is called (direct call)
    expect(localBroadcast1).toHaveBeenCalledTimes(1);

    // Instance 2's local broadcast should be called via pub/sub relay
    expect(localBroadcast2).toHaveBeenCalledTimes(1);
    expect(localBroadcast2).toHaveBeenCalledWith(
      "chat",
      { msg: "from-1" },
      undefined,
    );

    instance1.teardown();
    instance2.teardown();
  });

  it("relays targeted broadcasts across instances", async () => {
    const localBroadcast1 = vi.fn();
    const localBroadcastToConnIds1 = vi.fn();
    const localBroadcast2 = vi.fn();
    const localBroadcastToConnIds2 = vi.fn();

    const instance1 = await initDistributedBroadcast({
      localBroadcast: localBroadcast1,
      localBroadcastToConnIds: localBroadcastToConnIds1,
      _instanceId: "instance-a",
    });

    const instance2 = await initDistributedBroadcast({
      localBroadcast: localBroadcast2,
      localBroadcastToConnIds: localBroadcastToConnIds2,
      _instanceId: "instance-b",
    });

    const targetIds = new Set(["conn-a"]);
    instance1.broadcastToConnIds("agent", { data: 1 }, targetIds);

    await new Promise((r) => setTimeout(r, 20));

    // Instance 2 should receive the targeted broadcast with correct connIds
    expect(localBroadcastToConnIds2).toHaveBeenCalledTimes(1);
    const [event, payload, receivedIds] = localBroadcastToConnIds2.mock.calls[0];
    expect(event).toBe("agent");
    expect(payload).toEqual({ data: 1 });
    expect(receivedIds).toEqual(new Set(["conn-a"]));

    instance1.teardown();
    instance2.teardown();
  });

  it("teardown stops receiving remote events", async () => {
    const localBroadcast1 = vi.fn();
    const localBroadcast2 = vi.fn();

    const instance1 = await initDistributedBroadcast({
      localBroadcast: localBroadcast1,
      localBroadcastToConnIds: vi.fn(),
      _instanceId: "instance-x",
    });

    const instance2 = await initDistributedBroadcast({
      localBroadcast: localBroadcast2,
      localBroadcastToConnIds: vi.fn(),
      _instanceId: "instance-y",
    });

    // Teardown instance 2
    instance2.teardown();

    // Instance 1 broadcasts
    instance1.broadcast("chat", { msg: "after-teardown" });
    await new Promise((r) => setTimeout(r, 20));

    // Instance 2 should NOT receive the broadcast
    expect(localBroadcast2).toHaveBeenCalledTimes(0);

    instance1.teardown();
  });

  it("bidirectional relay between instances", async () => {
    const localBroadcast1 = vi.fn();
    const localBroadcast2 = vi.fn();

    const instance1 = await initDistributedBroadcast({
      localBroadcast: localBroadcast1,
      localBroadcastToConnIds: vi.fn(),
      _instanceId: "bi-1",
    });

    const instance2 = await initDistributedBroadcast({
      localBroadcast: localBroadcast2,
      localBroadcastToConnIds: vi.fn(),
      _instanceId: "bi-2",
    });

    // Instance 2 broadcasts back to instance 1
    instance2.broadcast("health", { status: "ok" });
    await new Promise((r) => setTimeout(r, 20));

    expect(localBroadcast1).toHaveBeenCalledTimes(1);
    expect(localBroadcast1).toHaveBeenCalledWith("health", { status: "ok" }, undefined);
    // Instance 2 only gets direct call, not echo
    expect(localBroadcast2).toHaveBeenCalledTimes(1);

    instance1.teardown();
    instance2.teardown();
  });

  it("getInstanceId returns a stable id", () => {
    const id1 = getInstanceId();
    const id2 = getInstanceId();
    expect(id1).toBe(id2);
    expect(typeof id1).toBe("string");
    expect(id1.length).toBeGreaterThan(0);
  });
});
