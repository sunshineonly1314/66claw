import { describe, expect, it } from "vitest";
import type { NodePairingPairedNode } from "./node-pairing.js";
import { isNodeStale } from "./node-pairing.js";

// ── Helpers ────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_THRESHOLD_MS = 90 * DAY_MS; // must match the constant in node-pairing.ts

function makeNode(overrides: Partial<NodePairingPairedNode> = {}): NodePairingPairedNode {
  return {
    nodeId: "test-node",
    token: "tok",
    createdAtMs: Date.now() - 180 * DAY_MS,
    approvedAtMs: Date.now() - 120 * DAY_MS,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("isNodeStale", () => {
  // ── Basic behavior ───────────────────────────────────────────────────

  describe("with lastConnectedAtMs set", () => {
    it("returns false when last connected within threshold", () => {
      const now = Date.now();
      const node = makeNode({ lastConnectedAtMs: now - 1 * DAY_MS });
      expect(isNodeStale(node, now)).toBe(false);
    });

    it("returns true when last connected beyond threshold", () => {
      const now = Date.now();
      const node = makeNode({ lastConnectedAtMs: now - 91 * DAY_MS });
      expect(isNodeStale(node, now)).toBe(true);
    });
  });

  describe("without lastConnectedAtMs (fallback to approvedAtMs)", () => {
    it("returns false when approved recently", () => {
      const now = Date.now();
      const node = makeNode({
        approvedAtMs: now - 10 * DAY_MS,
        lastConnectedAtMs: undefined,
      });
      expect(isNodeStale(node, now)).toBe(false);
    });

    it("returns true when approved long ago and never connected", () => {
      const now = Date.now();
      const node = makeNode({
        approvedAtMs: now - 100 * DAY_MS,
        lastConnectedAtMs: undefined,
      });
      expect(isNodeStale(node, now)).toBe(true);
    });
  });

  // ── Boundary conditions ──────────────────────────────────────────────

  describe("boundary: exactly at 90-day threshold", () => {
    it("returns false when lastConnectedAtMs is exactly at threshold", () => {
      const now = Date.now();
      // nowMs - lastSeen === STALE_THRESHOLD_MS → not greater than → false
      const node = makeNode({ lastConnectedAtMs: now - STALE_THRESHOLD_MS });
      expect(isNodeStale(node, now)).toBe(false);
    });

    it("returns true when 1ms past threshold", () => {
      const now = Date.now();
      const node = makeNode({ lastConnectedAtMs: now - STALE_THRESHOLD_MS - 1 });
      expect(isNodeStale(node, now)).toBe(true);
    });
  });

  describe("boundary: approvedAtMs exactly at threshold", () => {
    it("returns false at exactly 90 days", () => {
      const now = Date.now();
      const node = makeNode({
        approvedAtMs: now - STALE_THRESHOLD_MS,
        lastConnectedAtMs: undefined,
      });
      expect(isNodeStale(node, now)).toBe(false);
    });

    it("returns true at 90 days + 1ms", () => {
      const now = Date.now();
      const node = makeNode({
        approvedAtMs: now - STALE_THRESHOLD_MS - 1,
        lastConnectedAtMs: undefined,
      });
      expect(isNodeStale(node, now)).toBe(true);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("lastConnectedAtMs takes priority over approvedAtMs", () => {
      const now = Date.now();
      // Approved long ago (stale by that measure) but connected recently
      const node = makeNode({
        approvedAtMs: now - 200 * DAY_MS,
        lastConnectedAtMs: now - 1 * DAY_MS,
      });
      expect(isNodeStale(node, now)).toBe(false);
    });

    it("handles lastConnectedAtMs = 0 (epoch) as very stale", () => {
      const now = Date.now();
      const node = makeNode({ lastConnectedAtMs: 0 });
      expect(isNodeStale(node, now)).toBe(true);
    });

    it("handles future lastConnectedAtMs as not stale", () => {
      const now = Date.now();
      const node = makeNode({ lastConnectedAtMs: now + 1000 });
      expect(isNodeStale(node, now)).toBe(false);
    });

    it("uses Date.now() as default when nowMs is omitted", () => {
      // Node connected 1 day ago — should not be stale
      const node = makeNode({ lastConnectedAtMs: Date.now() - 1 * DAY_MS });
      expect(isNodeStale(node)).toBe(false);

      // Node connected 91 days ago — should be stale
      const oldNode = makeNode({ lastConnectedAtMs: Date.now() - 91 * DAY_MS });
      expect(isNodeStale(oldNode)).toBe(true);
    });
  });

  // ── Threshold constant validation ────────────────────────────────────

  describe("threshold constant", () => {
    it("stale threshold is exactly 90 days in ms", () => {
      expect(STALE_THRESHOLD_MS).toBe(90 * 24 * 60 * 60 * 1000);
    });
  });
});
