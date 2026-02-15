/**
 * Deep drain loop tests for subagent-announce-queue.
 *
 * Tests the internal drain loop behavior: FIFO ordering, error recovery,
 * cross-channel detection, collect mode batching, and queue cleanup.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initStateStore,
  closeStateStore,
  getStateStoreOrNull,
} from "../infra/state-store/index.js";

const waitForQueueDebounceMock = vi.fn(async () => {});
const hasCrossChannelItemsMock = vi.fn(() => false);
const applyQueueDropPolicyMock = vi.fn(
  ({ queue }: { queue: { items: unknown[]; cap: number } }) => queue.items.length < queue.cap,
);
const buildCollectPromptMock = vi.fn(
  ({
    items,
    renderItem,
  }: {
    items: unknown[];
    renderItem: (item: unknown, idx: number) => string;
  }) => items.map((item, i) => renderItem(item, i)).join("\n"),
);
const buildQueueSummaryPromptMock = vi.fn(() => undefined as string | undefined);

vi.mock("../utils/queue-helpers.js", () => ({
  applyQueueDropPolicy: (...args: unknown[]) => applyQueueDropPolicyMock(...(args as [never])),
  buildCollectPrompt: (...args: unknown[]) => buildCollectPromptMock(...(args as [never])),
  buildQueueSummaryPrompt: (...args: unknown[]) =>
    buildQueueSummaryPromptMock(...(args as [never])),
  hasCrossChannelItems: (...args: unknown[]) => hasCrossChannelItemsMock(...(args as [never])),
  waitForQueueDebounce: (...args: unknown[]) => waitForQueueDebounceMock(...(args as [never])),
}));

vi.mock("../utils/delivery-context.js", () => ({
  normalizeDeliveryContext: vi.fn((ctx: unknown) => ctx ?? undefined),
  deliveryContextKey: vi.fn((ctx: unknown) => (ctx ? "ctx-key" : undefined)),
}));

vi.mock("../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../runtime.js", () => ({
  defaultRuntime: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

const { enqueueAnnounce, resetAnnounceQueuesForTests } = await import(
  "./subagent-announce-queue.js"
);

type Item = {
  prompt: string;
  summaryLine?: string;
  enqueuedAt: number;
  sessionKey: string;
  origin?: unknown;
  originKey?: string;
};

function makeItem(prompt: string, extra?: Partial<Item>): Item {
  return {
    prompt,
    enqueuedAt: Date.now(),
    sessionKey: "agent:main:main",
    ...extra,
  };
}

async function waitFor(pred: () => boolean, ms = 2000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (pred()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("waitFor timed out");
}

describe("announce-queue drain loop deep tests", () => {
  beforeEach(async () => {
    await initStateStore({ backend: "memory" });
    resetAnnounceQueuesForTests();
    vi.clearAllMocks();
    // Fast debounce for tests
    waitForQueueDebounceMock.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    resetAnnounceQueuesForTests();
    await closeStateStore();
  });

  // ── Individual mode ─────────────────────────────────────────────────────

  describe("individual mode drain", () => {
    it("drains items one at a time in FIFO order", async () => {
      const sent: string[] = [];
      const send = async (item: Item) => {
        sent.push(item.prompt);
      };

      for (let i = 0; i < 4; i++) {
        enqueueAnnounce({
          key: "fifo",
          item: makeItem(`msg-${i}`),
          settings: { mode: "individual", debounceMs: 0 },
          send,
        });
      }

      await waitFor(() => sent.length === 4);
      expect(sent).toEqual(["msg-0", "msg-1", "msg-2", "msg-3"]);
    });

    it("handles send failure — items stay in queue for retry", async () => {
      let attempt = 0;
      const sent: string[] = [];
      const send = async (item: Item) => {
        attempt++;
        if (attempt === 1) throw new Error("transient");
        sent.push(item.prompt);
      };

      enqueueAnnounce({
        key: "retry",
        item: makeItem("retry-me"),
        settings: { mode: "individual", debounceMs: 0 },
        send,
      });

      // First attempt fails, drain reschedules after setting lastEnqueuedAt
      await waitFor(() => sent.length >= 1, 3000);
      expect(sent).toContain("retry-me");
    });
  });

  // ── Collect mode ────────────────────────────────────────────────────────

  describe("collect mode drain", () => {
    it("batches same-channel items into single send", async () => {
      const sent: Item[] = [];
      const send = async (item: Item) => {
        sent.push(item);
      };
      hasCrossChannelItemsMock.mockReturnValue(false);

      enqueueAnnounce({
        key: "collect",
        item: makeItem("c1"),
        settings: { mode: "collect", debounceMs: 0 },
        send,
      });
      enqueueAnnounce({
        key: "collect",
        item: makeItem("c2"),
        settings: { mode: "collect", debounceMs: 0 },
        send,
      });

      await waitFor(() => sent.length >= 1);
      // In collect mode, both items should be merged into a single prompt
      expect(sent.length).toBe(1);
    });

    it("cross-channel items force individual send in collect mode", async () => {
      const sent: Item[] = [];
      const send = async (item: Item) => {
        sent.push(item);
      };
      hasCrossChannelItemsMock.mockReturnValue(true);

      enqueueAnnounce({
        key: "cross-ch",
        item: makeItem("x1"),
        settings: { mode: "collect", debounceMs: 0 },
        send,
      });
      enqueueAnnounce({
        key: "cross-ch",
        item: makeItem("x2"),
        settings: { mode: "collect", debounceMs: 0 },
        send,
      });

      await waitFor(() => sent.length >= 2);
      // Cross-channel forces individual sends
      expect(sent.length).toBe(2);
    });
  });

  // ── Summary prompt injection ──────────────────────────────────────────

  describe("summary prompt handling", () => {
    it("injects summary prompt when available (individual mode)", async () => {
      const sent: Item[] = [];
      const send = async (item: Item) => {
        sent.push(item);
      };
      buildQueueSummaryPromptMock.mockReturnValue("[Summary: 3 messages dropped]");

      enqueueAnnounce({
        key: "summary",
        item: makeItem("has-summary"),
        settings: { mode: "individual", debounceMs: 0 },
        send,
      });

      await waitFor(() => sent.length >= 1);
      // The summary prompt should replace the item's prompt
      expect(sent[0]!.prompt).toBe("[Summary: 3 messages dropped]");
    });
  });

  // ── Queue lifecycle ─────────────────────────────────────────────────────

  describe("queue lifecycle", () => {
    it("queue is removed from map after all items are drained", async () => {
      // Ensure no summary prompt interference
      buildQueueSummaryPromptMock.mockReturnValue(undefined);

      const sent: string[] = [];
      enqueueAnnounce({
        key: "lifecycle",
        item: makeItem("only"),
        settings: { mode: "individual", debounceMs: 0 },
        send: async (item) => sent.push(item.prompt),
      });

      await waitFor(() => sent.length === 1);
      // Wait for cleanup
      await new Promise((r) => setTimeout(r, 100));

      // Queue should be cleaned up — enqueuing again creates a fresh queue
      const sent2: string[] = [];
      enqueueAnnounce({
        key: "lifecycle",
        item: makeItem("fresh"),
        settings: { mode: "individual", debounceMs: 0 },
        send: async (item) => sent2.push(item.prompt),
      });

      await waitFor(() => sent2.length === 1);
      expect(sent2[0]).toBe("fresh");
    });

    it("StateStore queue is acked after full drain", async () => {
      enqueueAnnounce({
        key: "ss-drain",
        item: makeItem("ack-me"),
        settings: { mode: "individual", debounceMs: 0 },
        send: async () => {},
      });

      await new Promise((r) => setTimeout(r, 300));

      const store = getStateStoreOrNull()!;
      const size = await store.queueSize("announce:ss-drain");
      expect(size).toBe(0);
    });
  });

  // ── Concurrent queue operations ─────────────────────────────────────

  describe("concurrent operations", () => {
    it("multiple rapid enqueues all get drained", async () => {
      // Ensure no summary prompt interference
      buildQueueSummaryPromptMock.mockReturnValue(undefined);

      const sent: string[] = [];
      const send = async (item: Item) => {
        sent.push(item.prompt);
      };

      for (let i = 0; i < 10; i++) {
        enqueueAnnounce({
          key: "rapid",
          item: makeItem(`r-${i}`),
          settings: { mode: "individual", debounceMs: 0 },
          send,
        });
      }

      await waitFor(() => sent.length === 10, 3000);
      expect(sent).toHaveLength(10);
      // Verify FIFO
      for (let i = 0; i < 10; i++) {
        expect(sent[i]).toBe(`r-${i}`);
      }
    });
  });
});
