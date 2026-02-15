/**
 * Integration test: dispatch bridge → multi-agent orchestration branch
 * in runPreparedReply().
 *
 * Verifies that:
 * 1. strategy="multi" triggers runMultiAgentOrchestration()
 * 2. Successful orchestration result is returned directly
 * 3. Orchestration returning undefined falls through to runReplyAgent()
 * 4. Orchestration throwing falls through to runReplyAgent()
 * 5. Non-multi strategies bypass orchestration entirely
 * 6. strategyDegraded=true bypasses orchestration
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { runPreparedReply } from "./get-reply-run.js";
import type { RoutingDecision } from "../../dispatch/types.js";

// ---------------------------------------------------------------------------
// Mocks — same set as get-reply-run.media-only.test.ts + orchestrator mock
// ---------------------------------------------------------------------------

const orchestratorMock = vi.hoisted(() =>
  vi.fn<[params: Record<string, unknown>], Promise<unknown>>(),
);

vi.mock("../../dispatch/orchestrator.js", () => ({
  runMultiAgentOrchestration: orchestratorMock,
}));

vi.mock("../../agents/auth-profiles/session-override.js", () => ({
  resolveSessionAuthProfileOverride: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../agents/pi-embedded.js", () => ({
  abortEmbeddedPiRun: vi.fn().mockReturnValue(false),
  isEmbeddedPiRunActive: vi.fn().mockReturnValue(false),
  isEmbeddedPiRunStreaming: vi.fn().mockReturnValue(false),
  resolveEmbeddedSessionLane: vi.fn().mockReturnValue("session:session-key"),
}));

vi.mock("../../config/sessions.js", () => ({
  resolveGroupSessionKey: vi.fn().mockReturnValue(undefined),
  resolveSessionFilePath: vi.fn().mockReturnValue("/tmp/session.jsonl"),
  resolveSessionFilePathOptions: vi.fn().mockReturnValue({}),
  updateSessionStore: vi.fn(),
}));

vi.mock("../../globals.js", () => ({
  logVerbose: vi.fn(),
}));

vi.mock("../../process/command-queue.js", () => ({
  clearCommandLane: vi.fn().mockReturnValue(0),
  getQueueSize: vi.fn().mockReturnValue(0),
}));

vi.mock("../../routing/session-key.js", () => ({
  normalizeMainKey: vi.fn().mockReturnValue("main"),
}));

vi.mock("../../utils/provider-utils.js", () => ({
  isReasoningTagProvider: vi.fn().mockReturnValue(false),
}));

vi.mock("../command-detection.js", () => ({
  hasControlCommand: vi.fn().mockReturnValue(false),
}));

vi.mock("./agent-runner.js", () => ({
  runReplyAgent: vi.fn().mockResolvedValue({ text: "single-agent-reply" }),
}));

vi.mock("./body.js", () => ({
  applySessionHints: vi.fn().mockImplementation(async ({ baseBody }: { baseBody: string }) => baseBody),
}));

vi.mock("./groups.js", () => ({
  buildGroupIntro: vi.fn().mockReturnValue(""),
}));

vi.mock("./inbound-meta.js", () => ({
  buildInboundMetaSystemPrompt: vi.fn().mockReturnValue(""),
  buildInboundUserContextPrefix: vi.fn().mockReturnValue(""),
}));

vi.mock("./queue.js", () => ({
  resolveQueueSettings: vi.fn().mockReturnValue({ mode: "followup" }),
}));

vi.mock("./route-reply.js", () => ({
  routeReply: vi.fn(),
}));

vi.mock("./session-updates.js", () => ({
  ensureSkillSnapshot: vi.fn().mockImplementation(async ({ sessionEntry, systemSent }: { sessionEntry: unknown; systemSent: boolean }) => ({
    sessionEntry,
    systemSent,
    skillsSnapshot: undefined,
  })),
  prependSystemEvents: vi.fn().mockImplementation(async ({ prefixedBodyBase }: { prefixedBodyBase: string }) => prefixedBodyBase),
}));

vi.mock("./typing-mode.js", () => ({
  resolveTypingMode: vi.fn().mockReturnValue("off"),
}));

import { runReplyAgent } from "./agent-runner.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMultiDecision(overrides?: Partial<RoutingDecision>): RoutingDecision {
  return {
    intent: "research",
    complexity: "high",
    strategy: "multi",
    confidence: 0.95,
    signals: [],
    ...overrides,
  };
}

function baseParams(
  overrides: Partial<Parameters<typeof runPreparedReply>[0]> = {},
): Parameters<typeof runPreparedReply>[0] {
  return {
    ctx: {
      Body: "Analyze the pros and cons of five frameworks",
      RawBody: "Analyze the pros and cons of five frameworks",
      CommandBody: "Analyze the pros and cons of five frameworks",
    },
    sessionCtx: {
      Body: "Analyze the pros and cons of five frameworks",
      BodyStripped: "Analyze the pros and cons of five frameworks",
      Provider: "telegram",
      ChatType: "direct",
    },
    cfg: { session: {}, channels: {}, agents: { defaults: {} } },
    agentId: "default",
    agentDir: "/tmp/agent",
    agentCfg: {},
    sessionCfg: {},
    commandAuthorized: true,
    command: {
      isAuthorizedSender: true,
      abortKey: "session-key",
      ownerList: [],
      senderIsOwner: false,
    } as never,
    commandSource: "",
    allowTextCommands: true,
    directives: {
      hasThinkDirective: false,
      thinkLevel: undefined,
    } as never,
    defaultActivation: "always",
    resolvedThinkLevel: "high",
    resolvedVerboseLevel: "off",
    resolvedReasoningLevel: "off",
    resolvedElevatedLevel: "off",
    elevatedEnabled: false,
    elevatedAllowed: false,
    blockStreamingEnabled: false,
    resolvedBlockStreamingBreak: "message_end",
    modelState: {
      resolveDefaultThinkingLevel: async () => "medium",
    } as never,
    provider: "anthropic",
    model: "claude-opus-4-1",
    typing: {
      onReplyStart: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn(),
    } as never,
    defaultProvider: "anthropic",
    defaultModel: "claude-opus-4-1",
    timeoutMs: 30_000,
    isNewSession: true,
    resetTriggered: false,
    systemSent: true,
    sessionKey: "agent:main:main",
    workspaceDir: "/tmp/workspace",
    abortedLastRun: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runPreparedReply — multi-agent orchestration bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orchestratorMock.mockReset();
  });

  it("calls orchestrator when dispatchDecision.strategy is 'multi'", async () => {
    orchestratorMock.mockResolvedValue({ text: "multi-agent result" });

    const result = await runPreparedReply(
      baseParams({ dispatchDecision: makeMultiDecision() }),
    );

    expect(orchestratorMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ text: "multi-agent result" });
    // runReplyAgent should NOT be called when orchestration succeeds
    expect(runReplyAgent).not.toHaveBeenCalled();
  });

  it("passes correct parameters to orchestrator", async () => {
    orchestratorMock.mockResolvedValue({ text: "ok" });
    const decision = makeMultiDecision({ intent: "analysis", complexity: "high" });

    await runPreparedReply(
      baseParams({
        dispatchDecision: decision,
        sessionKey: "agent:test:main",
        agentId: "test-agent",
        agentDir: "/custom/agent",
        workspaceDir: "/custom/workspace",
      }),
    );

    const call = orchestratorMock.mock.calls[0]![0];
    expect(call.decision).toBe(decision);
    expect(call.sessionKey).toBe("agent:test:main");
    expect(call.agentId).toBe("test-agent");
    expect(call.agentDir).toBe("/custom/agent");
    expect(call.workspaceDir).toBe("/custom/workspace");
    expect(call.task).toContain("Analyze the pros and cons");
  });

  it("falls through to runReplyAgent when orchestration returns undefined", async () => {
    orchestratorMock.mockResolvedValue(undefined);

    const result = await runPreparedReply(
      baseParams({ dispatchDecision: makeMultiDecision() }),
    );

    expect(orchestratorMock).toHaveBeenCalledTimes(1);
    expect(runReplyAgent).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ text: "single-agent-reply" });
  });

  it("falls through to runReplyAgent when orchestration throws", async () => {
    orchestratorMock.mockRejectedValue(new Error("Orchestration crashed"));

    const result = await runPreparedReply(
      baseParams({ dispatchDecision: makeMultiDecision() }),
    );

    expect(orchestratorMock).toHaveBeenCalledTimes(1);
    expect(runReplyAgent).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ text: "single-agent-reply" });
  });

  it("skips orchestration when strategy is not 'multi'", async () => {
    const result = await runPreparedReply(
      baseParams({
        dispatchDecision: makeMultiDecision({ strategy: "enhanced" }),
      }),
    );

    expect(orchestratorMock).not.toHaveBeenCalled();
    expect(runReplyAgent).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ text: "single-agent-reply" });
  });

  it("skips orchestration when strategy is 'single'", async () => {
    const result = await runPreparedReply(
      baseParams({
        dispatchDecision: makeMultiDecision({ strategy: "single" }),
      }),
    );

    expect(orchestratorMock).not.toHaveBeenCalled();
    expect(runReplyAgent).toHaveBeenCalledTimes(1);
  });

  it("skips orchestration when dispatchDecision is undefined", async () => {
    const result = await runPreparedReply(baseParams());

    expect(orchestratorMock).not.toHaveBeenCalled();
    expect(runReplyAgent).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ text: "single-agent-reply" });
  });

  it("skips orchestration when strategyDegraded is true", async () => {
    const result = await runPreparedReply(
      baseParams({
        dispatchDecision: makeMultiDecision({ strategyDegraded: true }),
      }),
    );

    expect(orchestratorMock).not.toHaveBeenCalled();
    expect(runReplyAgent).toHaveBeenCalledTimes(1);
  });

  it("cleans up typing on successful orchestration", async () => {
    orchestratorMock.mockResolvedValue({ text: "multi-result" });
    const typing = {
      onReplyStart: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn(),
    };

    await runPreparedReply(
      baseParams({
        dispatchDecision: makeMultiDecision(),
        typing: typing as never,
      }),
    );

    expect(typing.cleanup).toHaveBeenCalledTimes(1);
  });

  it("returns orchestration result array (multi-reply support)", async () => {
    const multiReply = [
      { text: "Part 1" },
      { text: "Part 2" },
    ];
    orchestratorMock.mockResolvedValue(multiReply);

    const result = await runPreparedReply(
      baseParams({ dispatchDecision: makeMultiDecision() }),
    );

    expect(result).toEqual(multiReply);
    expect(runReplyAgent).not.toHaveBeenCalled();
  });
});
