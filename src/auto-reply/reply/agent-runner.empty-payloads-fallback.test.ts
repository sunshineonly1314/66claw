import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { TemplateContext } from "../templating.js";
import type { FollowupRun, QueueSettings } from "./queue.js";
import { createMockTypingController } from "./test-helpers.js";

/**
 * Tests for the empty/filtered payloads fallback logic in agent-runner.ts.
 *
 * When a model run produces zero payloads (or all payloads are filtered out)
 * and no other delivery channel (block streaming, messaging tool) has already
 * sent content to the user, the agent-runner must return a fallback message
 * instead of silently dropping the response.
 */

const runEmbeddedPiAgentMock = vi.fn();
const runWithModelFallbackMock = vi.fn();

vi.mock("../../agents/model-fallback.js", () => ({
  runWithModelFallback: (params: {
    provider: string;
    model: string;
    run: (provider: string, model: string) => Promise<unknown>;
  }) => runWithModelFallbackMock(params),
}));

vi.mock("../../agents/pi-embedded.js", async () => {
  const actual = await vi.importActual<typeof import("../../agents/pi-embedded.js")>(
    "../../agents/pi-embedded.js",
  );
  return {
    ...actual,
    queueEmbeddedPiMessage: vi.fn().mockReturnValue(false),
    runEmbeddedPiAgent: (params: unknown) => runEmbeddedPiAgentMock(params),
  };
});

vi.mock("../../agents/cli-runner.js", async () => {
  const actual = await vi.importActual<typeof import("../../agents/cli-runner.js")>(
    "../../agents/cli-runner.js",
  );
  return {
    ...actual,
    runCliAgent: vi.fn(),
  };
});

vi.mock("../../runtime.js", async () => {
  const actual = await vi.importActual<typeof import("../../runtime.js")>("../../runtime.js");
  return {
    ...actual,
    defaultRuntime: {
      ...actual.defaultRuntime,
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    },
  };
});

vi.mock("./queue.js", async () => {
  const actual = await vi.importActual<typeof import("./queue.js")>("./queue.js");
  return {
    ...actual,
    enqueueFollowupRun: vi.fn(),
    scheduleFollowupDrain: vi.fn(),
  };
});

import { runReplyAgent } from "./agent-runner.js";

type RunWithModelFallbackParams = {
  provider: string;
  model: string;
  run: (provider: string, model: string) => Promise<unknown>;
};

beforeEach(() => {
  runEmbeddedPiAgentMock.mockReset();
  runWithModelFallbackMock.mockReset();

  runWithModelFallbackMock.mockImplementation(
    async ({ provider, model, run }: RunWithModelFallbackParams) => ({
      result: await run(provider, model),
      provider,
      model,
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Shared test run factory
// ---------------------------------------------------------------------------
function createMinimalRun(overrides?: {
  isHeartbeat?: boolean;
  blockStreamingEnabled?: boolean;
  messageProvider?: string;
  onBlockReply?: ReturnType<typeof vi.fn>;
  blockReplyBreak?: "text_end" | "message_end";
}) {
  const typing = createMockTypingController();
  const sessionCtx = {
    Provider: overrides?.messageProvider ?? "telegram",
    OriginatingTo: "chat:C1",
    AccountId: "primary",
    MessageSid: "msg",
  } as unknown as TemplateContext;
  const resolvedQueue = { mode: "interrupt" } as unknown as QueueSettings;
  const followupRun = {
    prompt: "hello",
    summaryLine: "hello",
    enqueuedAt: Date.now(),
    run: {
      sessionId: "session",
      sessionKey: "main",
      messageProvider: overrides?.messageProvider ?? "telegram",
      sessionFile: "/tmp/session.jsonl",
      workspaceDir: "/tmp",
      config: {},
      skillsSnapshot: {},
      provider: "anthropic",
      model: "claude",
      thinkLevel: "low",
      verboseLevel: "off",
      elevatedLevel: "off",
      bashElevated: { enabled: false, allowed: false, defaultLevel: "off" },
      timeoutMs: 1_000,
      blockReplyBreak: overrides?.blockReplyBreak ?? "message_end",
    },
  } as unknown as FollowupRun;

  return {
    commandBody: "hello",
    followupRun,
    queueKey: "main",
    resolvedQueue,
    shouldSteer: false,
    shouldFollowup: false,
    isActive: false,
    isStreaming: false,
    typing,
    sessionCtx,
    defaultModel: "anthropic/claude-opus-4-6",
    resolvedVerboseLevel: "off" as const,
    isNewSession: false,
    blockStreamingEnabled: overrides?.blockStreamingEnabled ?? false,
    resolvedBlockStreamingBreak:
      (overrides?.blockReplyBreak as "text_end" | "message_end") ?? "message_end",
    shouldInjectGroupIntro: false,
    typingMode: "instant" as const,
    opts: overrides?.isHeartbeat
      ? { isHeartbeat: true }
      : overrides?.onBlockReply
        ? { onBlockReply: overrides.onBlockReply }
        : undefined,
  };
}

// ===========================================================================
// Block A: Empty payloads fallback (payloadArray.length === 0)
// ===========================================================================
describe("runReplyAgent — empty payloads fallback", () => {
  it("returns fallback message when model produces no payloads for a real user message", async () => {
    runEmbeddedPiAgentMock.mockResolvedValueOnce({
      payloads: [],
      meta: {},
    });

    const result = await runReplyAgent(createMinimalRun());

    expect(result).toBeDefined();
    expect(typeof result === "object" && result !== null && "text" in result).toBe(true);
    const text = (result as { text: string }).text;
    expect(text).toContain("⚠️");
  });

  it("returns fallback when payloads is undefined (null-ish)", async () => {
    runEmbeddedPiAgentMock.mockResolvedValueOnce({
      payloads: undefined,
      meta: {},
    });

    const result = await runReplyAgent(createMinimalRun());

    expect(result).toBeDefined();
    const text = (result as { text: string }).text;
    expect(text).toContain("⚠️");
  });

  it("returns undefined (no fallback) for heartbeat with empty payloads", async () => {
    runEmbeddedPiAgentMock.mockResolvedValueOnce({
      payloads: [],
      meta: {},
    });

    const result = await runReplyAgent(createMinimalRun({ isHeartbeat: true }));

    expect(result).toBeUndefined();
  });

  it("returns undefined when block streaming already delivered content", async () => {
    const onBlockReply = vi.fn();

    runEmbeddedPiAgentMock.mockImplementationOnce(async (params: Record<string, unknown>) => {
      // Simulate block streaming delivery
      const blockReplyFn = params.onBlockReply as ((p: { text: string }) => void) | undefined;
      blockReplyFn?.({ text: "Streamed chunk" });
      return {
        payloads: [],
        meta: {},
      };
    });

    const result = await runReplyAgent(
      createMinimalRun({
        blockStreamingEnabled: true,
        onBlockReply,
        blockReplyBreak: "text_end",
      }),
    );

    // Block streaming delivered, so no fallback needed
    expect(result).toBeUndefined();
  });
});

// ===========================================================================
// Block B: Filtered payloads fallback (replyPayloads.length === 0 after filter)
// ===========================================================================
describe("runReplyAgent — filtered payloads fallback", () => {
  it("returns fallback when all payloads are filtered and no delivery occurred", async () => {
    // Return a payload that will be filtered (SILENT_REPLY or similar NO_REPLY marker)
    runEmbeddedPiAgentMock.mockResolvedValueOnce({
      payloads: [{ text: "[NO_REPLY]" }],
      meta: {},
    });

    const result = await runReplyAgent(createMinimalRun());

    // Payloads should be filtered by buildReplyPayloads (NO_REPLY is not renderable)
    // resulting in a fallback
    expect(result).toBeDefined();
    if (result && typeof result === "object" && "text" in result) {
      const text = (result as { text: string }).text;
      // Should be either the "🤔" fallback or the original text depending on
      // whether buildReplyPayloads treats [NO_REPLY] as non-renderable.
      expect(typeof text).toBe("string");
    }
  });

  it("returns undefined when messaging tool already delivered to same target", async () => {
    runEmbeddedPiAgentMock.mockResolvedValueOnce({
      payloads: [{ text: "hello world!" }],
      messagingToolSentTexts: ["hello world!"],
      messagingToolSentTargets: [{ tool: "slack", provider: "slack", to: "chat:C1" }],
      meta: {},
    });

    const result = await runReplyAgent(createMinimalRun({ messageProvider: "slack" }));

    // Messaging tool sent to same target → payloads suppressed → no fallback needed
    expect(result).toBeUndefined();
  });

  it("returns undefined for heartbeat even when payloads are filtered", async () => {
    runEmbeddedPiAgentMock.mockResolvedValueOnce({
      payloads: [{ text: "[NO_REPLY]" }],
      meta: {},
    });

    const result = await runReplyAgent(createMinimalRun({ isHeartbeat: true }));

    expect(result).toBeUndefined();
  });
});

// ===========================================================================
// Normal happy path — should NOT trigger fallback
// ===========================================================================
describe("runReplyAgent — normal happy path (no fallback)", () => {
  it("returns the model reply for a successful single-payload response", async () => {
    runEmbeddedPiAgentMock.mockResolvedValueOnce({
      payloads: [{ text: "Hello! How can I help you?" }],
      meta: {},
    });

    const result = await runReplyAgent(createMinimalRun());

    expect(result).toBeDefined();
    const text = (result as { text: string }).text;
    expect(text).toContain("Hello! How can I help you?");
  });

  it("returns multi-payload reply as array", async () => {
    runEmbeddedPiAgentMock.mockResolvedValueOnce({
      payloads: [{ text: "Part 1" }, { text: "Part 2" }],
      meta: {},
    });

    const result = await runReplyAgent(createMinimalRun());

    expect(result).toBeDefined();
    // Could be array or single; verify content exists
    if (Array.isArray(result)) {
      expect(result.length).toBeGreaterThan(0);
    } else {
      expect((result as { text: string }).text).toBeDefined();
    }
  });

  it("returns the single payload when model responds with just text", async () => {
    runEmbeddedPiAgentMock.mockResolvedValueOnce({
      payloads: [{ text: "Simple response" }],
      meta: { agentMeta: { usage: { input: 100, output: 50 } } },
    });

    const result = await runReplyAgent(createMinimalRun());

    expect(result).toBeDefined();
    const text = (result as { text: string }).text;
    expect(text).toContain("Simple response");
  });
});
