/**
 * Tests the node registration rejection flow when MAX_NODES is reached.
 *
 * The actual rejection happens in message-handler.ts (deep inside the WS
 * handshake closure), which wraps NodeRegistry.register() in a try-catch.
 * Since extracting that closure for direct unit testing would require major
 * refactoring, this test verifies:
 *
 * 1. NodeRegistry.register() throws the correct error
 * 2. The error message matches what message-handler.ts checks for
 * 3. The error is an instance of Error (so `instanceof Error` check works)
 *
 * This ensures the contract between node-registry and message-handler is correct.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayWsClient } from "./server/ws-types.js";
import { NodeRegistry } from "./node-registry.js";
import { MAX_CONNECTED_NODES } from "./server-constants.js";

function makeFakeClient(nodeId: string, connId: string): GatewayWsClient {
  return {
    socket: { send: vi.fn(), readyState: 1 } as unknown as GatewayWsClient["socket"],
    connect: {
      role: "node",
      device: { id: nodeId },
      client: { id: `c-${nodeId}` },
      caps: [],
    } as GatewayWsClient["connect"],
    connId,
  } as GatewayWsClient;
}

describe("node registration rejection at MAX_NODES", () => {
  let registry: NodeRegistry;

  beforeEach(() => {
    registry = new NodeRegistry();
    // Fill to capacity
    for (let i = 0; i < MAX_CONNECTED_NODES; i++) {
      registry.register(makeFakeClient(`n${i}`, `c${i}`), {});
    }
  });

  it("throws an Error instance (compatible with instanceof check)", () => {
    try {
      registry.register(makeFakeClient("overflow", "c-overflow"), {});
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  it("error message contains 'node limit reached'", () => {
    // message-handler.ts checks: registrationErr instanceof Error ? registrationErr.message : "node limit reached"
    try {
      registry.register(makeFakeClient("overflow", "c-overflow"), {});
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as Error).message).toContain("node limit reached");
    }
  });

  it("error message contains current/max counts for diagnostics", () => {
    try {
      registry.register(makeFakeClient("overflow", "c-overflow"), {});
      expect.fail("should have thrown");
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain(`${MAX_CONNECTED_NODES}/${MAX_CONNECTED_NODES}`);
    }
  });

  it("registry state is unchanged after rejected registration", () => {
    const countBefore = registry.connectedCount;
    try {
      registry.register(makeFakeClient("overflow", "c-overflow"), {});
    } catch {
      // expected
    }
    expect(registry.connectedCount).toBe(countBefore);
    expect(registry.get("overflow")).toBeUndefined();
  });

  it("does NOT reject if a slot is freed first", () => {
    registry.unregister("c0");
    expect(registry.connectedCount).toBe(MAX_CONNECTED_NODES - 1);

    expect(() => {
      registry.register(makeFakeClient("new-node", "c-new"), {});
    }).not.toThrow();
    expect(registry.connectedCount).toBe(MAX_CONNECTED_NODES);
  });

  it("re-registering existing nodeId with new connId still triggers limit check", () => {
    // The size check happens before the set, so even though the nodeId exists
    // (and would be replaced), the check sees size=MAX and rejects.
    // This is correct behavior — a node should unregister first.
    expect(() => {
      registry.register(makeFakeClient("n0", "c0-new"), {});
    }).toThrow(/node limit reached/);
  });

  it("re-register works after unregistering the old session first", () => {
    registry.unregister("c0");
    expect(() => {
      registry.register(makeFakeClient("n0", "c0-new"), {});
    }).not.toThrow();
    expect(registry.connectedCount).toBe(MAX_CONNECTED_NODES);
  });
});
