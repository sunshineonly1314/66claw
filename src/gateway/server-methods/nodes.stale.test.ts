/**
 * Tests that node.list and node.describe correctly expose stale/lastConnectedAtMs
 * fields in their API responses.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NodePairingPairedNode } from "../../infra/node-pairing.js";
import type { PairedDevice } from "../../infra/device-pairing.js";
import type { GatewayRequestContext, GatewayWsClient, RespondFn } from "./types.js";
import type { RequestFrame } from "../protocol/index.js";

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock("../../infra/device-pairing.js", () => ({
  listDevicePairing: vi.fn(),
}));

vi.mock("../../infra/node-pairing.js", () => ({
  approveNodePairing: vi.fn(),
  getPairedNode: vi.fn(),
  isNodeStale: vi.fn(),
  listNodePairing: vi.fn(),
  rejectNodePairing: vi.fn(),
  renamePairedNode: vi.fn(),
  requestNodePairing: vi.fn(),
  verifyNodeToken: vi.fn(),
}));

vi.mock("../../config/config.js", () => ({
  loadConfig: vi.fn(() => ({})),
  withConfigWriteLock: async (fn: () => Promise<unknown>) => fn(),
}));

// Import after mocks
import { listDevicePairing } from "../../infra/device-pairing.js";
import { getPairedNode, isNodeStale, listNodePairing } from "../../infra/node-pairing.js";
import { nodeHandlers } from "./nodes.js";

const listDevicePairingMock = vi.mocked(listDevicePairing);
const listNodePairingMock = vi.mocked(listNodePairing);
const getPairedNodeMock = vi.mocked(getPairedNode);
const isNodeStaleMock = vi.mocked(isNodeStale);

// ── Helpers ────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function makeDevicePaired(deviceId: string, opts?: Partial<PairedDevice>): PairedDevice {
  return {
    deviceId,
    publicKey: "pk",
    role: "node",
    roles: ["node"],
    createdAtMs: Date.now() - 30 * DAY_MS,
    approvedAtMs: Date.now() - 30 * DAY_MS,
    ...opts,
  };
}

function makeNodePairing(
  nodeId: string,
  opts?: Partial<NodePairingPairedNode>,
): NodePairingPairedNode & { stale: boolean } {
  return {
    nodeId,
    token: "tok",
    createdAtMs: Date.now() - 30 * DAY_MS,
    approvedAtMs: Date.now() - 30 * DAY_MS,
    stale: false,
    ...opts,
  };
}

function makeContext(
  connectedNodes: Array<{
    nodeId: string;
    displayName?: string;
    platform?: string;
    caps?: string[];
    commands?: string[];
    connectedAtMs?: number;
  }>,
): GatewayRequestContext {
  const sessions = connectedNodes.map((n) => ({
    nodeId: n.nodeId,
    connId: `conn-${n.nodeId}`,
    client: {} as GatewayWsClient,
    displayName: n.displayName,
    platform: n.platform,
    caps: n.caps ?? [],
    commands: n.commands ?? [],
    connectedAtMs: n.connectedAtMs ?? Date.now(),
  }));

  return {
    nodeRegistry: {
      listConnected: () => sessions,
      get: (id: string) => sessions.find((s) => s.nodeId === id),
    },
  } as unknown as GatewayRequestContext;
}

async function callHandler(
  method: string,
  params: Record<string, unknown>,
  context: GatewayRequestContext,
) {
  const respond = vi.fn<RespondFn>();
  const handler = nodeHandlers[method];
  if (!handler) {
    throw new Error(`handler not found: ${method}`);
  }
  await handler({
    req: { method } as unknown as RequestFrame,
    params,
    respond,
    context,
    client: {} as GatewayWsClient,
    isWebchatConnect: () => false,
  });
  return respond;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("node.list stale field", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns stale=true for offline node past threshold", async () => {
    const now = Date.now();
    listDevicePairingMock.mockResolvedValue({
      pending: [],
      paired: [makeDevicePaired("old-device")],
    });
    listNodePairingMock.mockResolvedValue({
      pending: [],
      paired: [
        makeNodePairing("old-device", {
          lastConnectedAtMs: now - 100 * DAY_MS,
          stale: true,
        }),
      ],
    });
    isNodeStaleMock.mockReturnValue(true);

    const respond = await callHandler("node.list", {}, makeContext([]));

    expect(respond).toHaveBeenCalledWith(true, expect.anything(), undefined);
    const [, payload] = respond.mock.calls[0];
    const node = payload.nodes.find((n: { nodeId: string }) => n.nodeId === "old-device");
    expect(node).toBeDefined();
    expect(node.stale).toBe(true);
    expect(node.connected).toBe(false);
    expect(node.lastConnectedAtMs).toBe(now - 100 * DAY_MS);
  });

  it("returns stale=false for online node", async () => {
    listDevicePairingMock.mockResolvedValue({
      pending: [],
      paired: [makeDevicePaired("live-device")],
    });
    listNodePairingMock.mockResolvedValue({
      pending: [],
      paired: [makeNodePairing("live-device", { lastConnectedAtMs: Date.now() })],
    });
    // isNodeStale should NOT be called for connected nodes (stale = !live && ...)
    // but even if it is, it doesn't matter because !live is false

    const respond = await callHandler("node.list", {}, makeContext([{ nodeId: "live-device" }]));

    const [, payload] = respond.mock.calls[0];
    const node = payload.nodes.find((n: { nodeId: string }) => n.nodeId === "live-device");
    expect(node).toBeDefined();
    expect(node.stale).toBe(false);
    expect(node.connected).toBe(true);
  });

  it("returns stale=false when no node pairing record exists", async () => {
    listDevicePairingMock.mockResolvedValue({
      pending: [],
      paired: [makeDevicePaired("no-pairing")],
    });
    listNodePairingMock.mockResolvedValue({
      pending: [],
      paired: [], // no node pairing record
    });

    const respond = await callHandler("node.list", {}, makeContext([]));

    const [, payload] = respond.mock.calls[0];
    const node = payload.nodes.find((n: { nodeId: string }) => n.nodeId === "no-pairing");
    expect(node).toBeDefined();
    expect(node.stale).toBe(false);
    expect(node.lastConnectedAtMs).toBeUndefined();
  });

  it("sorts: connected first, then offline active, then stale", async () => {
    const now = Date.now();
    listDevicePairingMock.mockResolvedValue({
      pending: [],
      paired: [
        makeDevicePaired("a-stale", { displayName: "A Stale" }),
        makeDevicePaired("b-active", { displayName: "B Active" }),
      ],
    });
    listNodePairingMock.mockResolvedValue({
      pending: [],
      paired: [
        makeNodePairing("a-stale", {
          lastConnectedAtMs: now - 100 * DAY_MS,
          stale: true,
        }),
        makeNodePairing("b-active", {
          lastConnectedAtMs: now - 5 * DAY_MS,
          stale: false,
        }),
      ],
    });
    isNodeStaleMock.mockImplementation((node) => {
      return (node as { nodeId: string }).nodeId === "a-stale";
    });

    const respond = await callHandler(
      "node.list",
      {},
      makeContext([{ nodeId: "c-online", displayName: "C Online" }]),
    );

    const [, payload] = respond.mock.calls[0];
    const nodeIds = payload.nodes.map((n: { nodeId: string }) => n.nodeId);

    // Connected first, then non-stale offline, then stale
    expect(nodeIds[0]).toBe("c-online");
    expect(nodeIds[1]).toBe("b-active");
    expect(nodeIds[2]).toBe("a-stale");
  });
});

describe("node.describe stale field", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns stale=true for offline stale node", async () => {
    const now = Date.now();
    listDevicePairingMock.mockResolvedValue({
      pending: [],
      paired: [makeDevicePaired("old-node")],
    });
    getPairedNodeMock.mockResolvedValue({
      nodeId: "old-node",
      token: "tok",
      createdAtMs: now - 200 * DAY_MS,
      approvedAtMs: now - 200 * DAY_MS,
      lastConnectedAtMs: now - 100 * DAY_MS,
    });
    isNodeStaleMock.mockReturnValue(true);

    const respond = await callHandler("node.describe", { nodeId: "old-node" }, makeContext([]));

    expect(respond).toHaveBeenCalledWith(true, expect.anything(), undefined);
    const [, payload] = respond.mock.calls[0];
    expect(payload.stale).toBe(true);
    expect(payload.lastConnectedAtMs).toBe(now - 100 * DAY_MS);
    expect(payload.connected).toBe(false);
  });

  it("returns stale=false for connected node", async () => {
    listDevicePairingMock.mockResolvedValue({
      pending: [],
      paired: [makeDevicePaired("live-node")],
    });
    getPairedNodeMock.mockResolvedValue({
      nodeId: "live-node",
      token: "tok",
      createdAtMs: Date.now(),
      approvedAtMs: Date.now(),
      lastConnectedAtMs: Date.now(),
    });

    const respond = await callHandler(
      "node.describe",
      { nodeId: "live-node" },
      makeContext([{ nodeId: "live-node" }]),
    );

    const [, payload] = respond.mock.calls[0];
    expect(payload.stale).toBe(false);
    expect(payload.connected).toBe(true);
  });

  it("returns stale=false when no node pairing exists", async () => {
    listDevicePairingMock.mockResolvedValue({
      pending: [],
      paired: [makeDevicePaired("some-node")],
    });
    getPairedNodeMock.mockResolvedValue(null);

    const respond = await callHandler("node.describe", { nodeId: "some-node" }, makeContext([]));

    const [, payload] = respond.mock.calls[0];
    expect(payload.stale).toBe(false);
    expect(payload.lastConnectedAtMs).toBeUndefined();
  });

  it("returns unknown nodeId error for non-existent node", async () => {
    listDevicePairingMock.mockResolvedValue({
      pending: [],
      paired: [],
    });
    getPairedNodeMock.mockResolvedValue(null);

    const respond = await callHandler("node.describe", { nodeId: "ghost" }, makeContext([]));

    const [ok, , error] = respond.mock.calls[0];
    expect(ok).toBe(false);
    expect(error?.message).toMatch(/unknown nodeId/);
  });
});
