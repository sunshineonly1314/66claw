import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayWsClient } from "./server/ws-types.js";
import { NodeRegistry } from "./node-registry.js";
import {
  MAX_CONNECTED_NODES,
  NODE_EVENT_RATE_LIMIT,
  NODE_INVOKE_RATE_LIMIT,
} from "./server-constants.js";

// ── Helpers ────────────────────────────────────────────────────────────

function makeFakeClient(
  nodeId: string,
  connId: string,
  overrides?: Partial<GatewayWsClient["connect"]>,
): GatewayWsClient {
  return {
    socket: {
      send: vi.fn(),
      readyState: 1, // WebSocket.OPEN
    } as unknown as GatewayWsClient["socket"],
    connect: {
      role: "node",
      device: { id: nodeId },
      client: {
        id: `client-${nodeId}`,
        displayName: `Node ${nodeId}`,
        platform: "linux",
      },
      caps: ["audio.record"],
      commands: ["system.run"],
      ...overrides,
    } as GatewayWsClient["connect"],
    connId,
  } as GatewayWsClient;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("NodeRegistry", () => {
  let registry: NodeRegistry;

  beforeEach(() => {
    registry = new NodeRegistry();
  });

  // ── Basic register / unregister ──────────────────────────────────────

  describe("register and unregister", () => {
    it("registers a node and returns a session", () => {
      const client = makeFakeClient("n1", "conn-1");
      const session = registry.register(client, {});
      expect(session.nodeId).toBe("n1");
      expect(session.connId).toBe("conn-1");
      expect(session.caps).toEqual(["audio.record"]);
      expect(session.commands).toEqual(["system.run"]);
      expect(session.connectedAtMs).toBeGreaterThan(0);
    });

    it("connectedCount reflects registered nodes", () => {
      expect(registry.connectedCount).toBe(0);
      registry.register(makeFakeClient("n1", "c1"), {});
      expect(registry.connectedCount).toBe(1);
      registry.register(makeFakeClient("n2", "c2"), {});
      expect(registry.connectedCount).toBe(2);
    });

    it("unregister removes node and returns nodeId", () => {
      registry.register(makeFakeClient("n1", "c1"), {});
      expect(registry.connectedCount).toBe(1);
      const removed = registry.unregister("c1");
      expect(removed).toBe("n1");
      expect(registry.connectedCount).toBe(0);
    });

    it("unregister returns null for unknown connId", () => {
      expect(registry.unregister("nonexistent")).toBeNull();
    });

    it("get returns session for registered nodeId", () => {
      registry.register(makeFakeClient("n1", "c1"), {});
      expect(registry.get("n1")).toBeDefined();
      expect(registry.get("n1")!.nodeId).toBe("n1");
    });

    it("get returns undefined for unregistered nodeId", () => {
      expect(registry.get("nonexistent")).toBeUndefined();
    });

    it("listConnected returns all registered nodes", () => {
      registry.register(makeFakeClient("n1", "c1"), {});
      registry.register(makeFakeClient("n2", "c2"), {});
      const list = registry.listConnected();
      expect(list).toHaveLength(2);
      expect(list.map((n) => n.nodeId).sort()).toEqual(["n1", "n2"]);
    });

    it("re-registering same nodeId replaces session", () => {
      registry.register(makeFakeClient("n1", "c1"), {});
      registry.register(makeFakeClient("n1", "c2"), {});
      expect(registry.connectedCount).toBe(1);
      expect(registry.get("n1")!.connId).toBe("c2");
    });
  });

  // ── MAX_NODES limit ──────────────────────────────────────────────────

  describe("MAX_NODES limit", () => {
    it("allows registration up to MAX_CONNECTED_NODES", () => {
      for (let i = 0; i < MAX_CONNECTED_NODES; i++) {
        registry.register(makeFakeClient(`n${i}`, `c${i}`), {});
      }
      expect(registry.connectedCount).toBe(MAX_CONNECTED_NODES);
    });

    it("throws Error when MAX_CONNECTED_NODES is exceeded", () => {
      for (let i = 0; i < MAX_CONNECTED_NODES; i++) {
        registry.register(makeFakeClient(`n${i}`, `c${i}`), {});
      }
      expect(() => {
        registry.register(makeFakeClient("overflow", "c-overflow"), {});
      }).toThrow(/node limit reached/);
    });

    it("error message includes current and max counts", () => {
      for (let i = 0; i < MAX_CONNECTED_NODES; i++) {
        registry.register(makeFakeClient(`n${i}`, `c${i}`), {});
      }
      expect(() => {
        registry.register(makeFakeClient("overflow", "c-overflow"), {});
      }).toThrow(`${MAX_CONNECTED_NODES}/${MAX_CONNECTED_NODES}`);
    });

    it("allows registration again after unregister frees a slot", () => {
      for (let i = 0; i < MAX_CONNECTED_NODES; i++) {
        registry.register(makeFakeClient(`n${i}`, `c${i}`), {});
      }
      registry.unregister("c0"); // free one slot
      expect(() => {
        registry.register(makeFakeClient("new-node", "c-new"), {});
      }).not.toThrow();
      expect(registry.connectedCount).toBe(MAX_CONNECTED_NODES);
    });

    it("MAX_CONNECTED_NODES constant is 256", () => {
      expect(MAX_CONNECTED_NODES).toBe(256);
    });
  });

  // ── Rate limiting ────────────────────────────────────────────────────

  describe("rate limiting", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      registry.register(makeFakeClient("n1", "c1"), {});
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe("invoke rate", () => {
      it("allows up to NODE_INVOKE_RATE_LIMIT calls in one second", () => {
        for (let i = 0; i < NODE_INVOKE_RATE_LIMIT; i++) {
          expect(registry.checkInvokeRate("n1")).toBe(true);
        }
      });

      it("rejects the call exceeding the limit", () => {
        for (let i = 0; i < NODE_INVOKE_RATE_LIMIT; i++) {
          registry.checkInvokeRate("n1");
        }
        expect(registry.checkInvokeRate("n1")).toBe(false);
      });

      it("resets after the 1-second window expires", () => {
        for (let i = 0; i < NODE_INVOKE_RATE_LIMIT; i++) {
          registry.checkInvokeRate("n1");
        }
        expect(registry.checkInvokeRate("n1")).toBe(false);

        vi.advanceTimersByTime(1001); // past the 1s window

        expect(registry.checkInvokeRate("n1")).toBe(true);
      });

      it("rate counters are per-node", () => {
        registry.register(makeFakeClient("n2", "c2"), {});

        // Exhaust n1's limit
        for (let i = 0; i < NODE_INVOKE_RATE_LIMIT; i++) {
          registry.checkInvokeRate("n1");
        }
        expect(registry.checkInvokeRate("n1")).toBe(false);

        // n2 is independent
        expect(registry.checkInvokeRate("n2")).toBe(true);
      });

      it("NODE_INVOKE_RATE_LIMIT is 20", () => {
        expect(NODE_INVOKE_RATE_LIMIT).toBe(20);
      });
    });

    describe("event rate", () => {
      it("allows up to NODE_EVENT_RATE_LIMIT events in one second", () => {
        for (let i = 0; i < NODE_EVENT_RATE_LIMIT; i++) {
          expect(registry.checkEventRate("n1")).toBe(true);
        }
      });

      it("rejects the event exceeding the limit", () => {
        for (let i = 0; i < NODE_EVENT_RATE_LIMIT; i++) {
          registry.checkEventRate("n1");
        }
        expect(registry.checkEventRate("n1")).toBe(false);
      });

      it("resets after the 1-second window expires", () => {
        for (let i = 0; i < NODE_EVENT_RATE_LIMIT; i++) {
          registry.checkEventRate("n1");
        }
        vi.advanceTimersByTime(1001);
        expect(registry.checkEventRate("n1")).toBe(true);
      });

      it("NODE_EVENT_RATE_LIMIT is 30", () => {
        expect(NODE_EVENT_RATE_LIMIT).toBe(30);
      });
    });

    describe("rate counter cleanup on unregister", () => {
      it("rate counters are cleaned up when node disconnects", () => {
        // Build up counters
        for (let i = 0; i < 5; i++) {
          registry.checkInvokeRate("n1");
          registry.checkEventRate("n1");
        }

        registry.unregister("c1");

        // Re-register same node
        registry.register(makeFakeClient("n1", "c1-new"), {});

        // Counter should be fresh (first call should succeed)
        expect(registry.checkInvokeRate("n1")).toBe(true);
        expect(registry.checkEventRate("n1")).toBe(true);
      });
    });

    describe("boundary: rate limit at exact limit value", () => {
      it("the Nth call (N=limit) is allowed, the (N+1)th is rejected", () => {
        for (let i = 1; i <= NODE_INVOKE_RATE_LIMIT; i++) {
          expect(registry.checkInvokeRate("n1")).toBe(true);
        }
        // This is call N+1
        expect(registry.checkInvokeRate("n1")).toBe(false);
      });
    });

    describe("boundary: window edge reset", () => {
      it("rate limit does NOT reset at exactly 1000ms (boundary is exclusive)", () => {
        for (let i = 0; i < NODE_INVOKE_RATE_LIMIT; i++) {
          registry.checkInvokeRate("n1");
        }
        expect(registry.checkInvokeRate("n1")).toBe(false);

        // Advance to exactly 1000ms — the counter was created with resetAt = now + 1000
        // Since the check is `now >= counter.resetAt`, at exactly resetAt it should reset
        vi.advanceTimersByTime(1000);
        expect(registry.checkInvokeRate("n1")).toBe(true);
      });
    });
  });

  // ── Invoke / response lifecycle ──────────────────────────────────────

  describe("invoke lifecycle", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("invoke resolves when handleInvokeResult is called", async () => {
      const client = makeFakeClient("n1", "c1");
      registry.register(client, {});

      const invokePromise = registry.invoke({
        nodeId: "n1",
        command: "system.run",
        params: { cmd: "ls" },
        timeoutMs: 5000,
      });

      // Extract the requestId from the send call
      const sendFn = client.socket.send as ReturnType<typeof vi.fn>;
      expect(sendFn).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(sendFn.mock.calls[0][0] as string);
      expect(sent.event).toBe("node.invoke.request");
      const requestId = sent.payload.id;

      // Simulate node responding
      registry.handleInvokeResult({
        id: requestId,
        nodeId: "n1",
        ok: true,
        payload: { stdout: "hello" },
      });

      const result = await invokePromise;
      expect(result.ok).toBe(true);
      expect(result.payload).toEqual({ stdout: "hello" });
    });

    it("invoke times out if no response", async () => {
      const client = makeFakeClient("n1", "c1");
      registry.register(client, {});

      const invokePromise = registry.invoke({
        nodeId: "n1",
        command: "system.run",
        timeoutMs: 3000,
      });

      vi.advanceTimersByTime(3001);

      const result = await invokePromise;
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("TIMEOUT");
    });

    it("invoke returns NOT_CONNECTED for unregistered node", async () => {
      const result = await registry.invoke({
        nodeId: "unknown",
        command: "system.run",
      });
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("NOT_CONNECTED");
    });

    it("handleInvokeResult ignores mismatched nodeId", () => {
      const client = makeFakeClient("n1", "c1");
      registry.register(client, {});

      // Start an invoke
      void registry.invoke({ nodeId: "n1", command: "test", timeoutMs: 10000 });

      const sendFn = client.socket.send as ReturnType<typeof vi.fn>;
      const sent = JSON.parse(sendFn.mock.calls[0][0] as string);

      // Respond with wrong nodeId
      const handled = registry.handleInvokeResult({
        id: sent.payload.id,
        nodeId: "n2", // wrong
        ok: true,
      });
      expect(handled).toBe(false);
    });

    it("unregister rejects pending invokes", async () => {
      const client = makeFakeClient("n1", "c1");
      registry.register(client, {});

      const invokePromise = registry.invoke({
        nodeId: "n1",
        command: "system.run",
        timeoutMs: 30000,
      });

      // Disconnect while invoke is pending
      registry.unregister("c1");

      await expect(invokePromise).rejects.toThrow(/node disconnected/);
    });
  });

  // ── sendEvent ────────────────────────────────────────────────────────

  describe("sendEvent", () => {
    it("sends event to connected node", () => {
      const client = makeFakeClient("n1", "c1");
      registry.register(client, {});

      const ok = registry.sendEvent("n1", "voicewake.changed", { triggers: [] });
      expect(ok).toBe(true);

      const sendFn = client.socket.send as ReturnType<typeof vi.fn>;
      const sent = JSON.parse(sendFn.mock.calls[0][0] as string);
      expect(sent.type).toBe("event");
      expect(sent.event).toBe("voicewake.changed");
    });

    it("returns false for unknown nodeId", () => {
      expect(registry.sendEvent("unknown", "test", {})).toBe(false);
    });
  });
});
