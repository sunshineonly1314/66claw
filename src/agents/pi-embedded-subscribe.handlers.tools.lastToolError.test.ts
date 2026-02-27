import { describe, expect, it, vi } from "vitest";
import type { EmbeddedPiSubscribeContext } from "./pi-embedded-subscribe.handlers.types.js";
import {
  handleToolExecutionEnd,
  handleToolExecutionStart,
} from "./pi-embedded-subscribe.handlers.tools.js";

/**
 * Tests for the lastToolError preservation logic in handleToolExecutionEnd.
 *
 * Core invariant: A mutating tool error (e.g. message send failed) must NOT be
 * silently overwritten by a subsequent non-mutating tool error (e.g. browser read
 * failed).  Only a newer mutating error or a successful execution of the *same*
 * mutating action should clear/replace the existing mutating error.
 */

// ---------------------------------------------------------------------------
// Mock context factory — mirrors the canonical pattern from the media test file.
// ---------------------------------------------------------------------------
function createMockContext(): EmbeddedPiSubscribeContext {
  return {
    params: {
      runId: "test-run",
      onToolResult: vi.fn(),
      onAgentEvent: vi.fn(),
    },
    state: {
      toolMetaById: new Map(),
      toolMetas: [],
      toolSummaryById: new Set(),
      pendingMessagingTexts: new Map(),
      pendingMessagingTargets: new Map(),
      messagingToolSentTexts: [],
      messagingToolSentTextsNormalized: [],
      messagingToolSentTargets: [],
    },
    log: { debug: vi.fn(), warn: vi.fn() },
    shouldEmitToolResult: vi.fn(() => false),
    shouldEmitToolOutput: vi.fn(() => false),
    emitToolSummary: vi.fn(),
    emitToolOutput: vi.fn(),
    trimMessagingToolSent: vi.fn(),
    hookRunner: undefined,
    blockChunker: null,
    noteLastAssistant: vi.fn(),
    stripBlockTags: vi.fn((t: string) => t),
    emitBlockChunk: vi.fn(),
    flushBlockReplyBuffer: vi.fn(),
    emitReasoningStream: vi.fn(),
    consumeReplyDirectives: vi.fn(() => null),
    consumePartialReplyDirectives: vi.fn(() => null),
    resetAssistantMessageState: vi.fn(),
    resetForCompactionRetry: vi.fn(),
    finalizeAssistantTexts: vi.fn(),
    ensureCompactionPromise: vi.fn(),
    noteCompactionRetry: vi.fn(),
    resolveCompactionRetry: vi.fn(),
    maybeResolveCompactionWait: vi.fn(),
    recordAssistantUsage: vi.fn(),
    incrementCompactionCount: vi.fn(),
    getUsageTotals: vi.fn(() => undefined),
    getCompactionCount: vi.fn(() => 0),
  } as unknown as EmbeddedPiSubscribeContext;
}

// ---------------------------------------------------------------------------
// Helpers — simulate start→end tool lifecycle
// ---------------------------------------------------------------------------
async function simulateToolStart(
  ctx: EmbeddedPiSubscribeContext,
  toolName: string,
  toolCallId: string,
  args: Record<string, unknown> = {},
) {
  await handleToolExecutionStart(ctx, {
    type: "tool_execution_start",
    toolName,
    toolCallId,
    args,
  });
}

async function simulateToolEnd(
  ctx: EmbeddedPiSubscribeContext,
  toolName: string,
  toolCallId: string,
  opts: { isError: boolean; result?: unknown } = { isError: false },
) {
  await handleToolExecutionEnd(ctx, {
    type: "tool_execution_end",
    toolName,
    toolCallId,
    isError: opts.isError,
    result: opts.result ?? { content: [{ type: "text", text: "ok" }] },
  });
}

function errorResult(msg: string) {
  return { content: [{ type: "text", text: msg }], isError: true };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("handleToolExecutionEnd — lastToolError preservation", () => {
  // ----- Basic error tracking -----

  it("sets lastToolError on tool failure", async () => {
    const ctx = createMockContext();
    await simulateToolStart(ctx, "browser", "tc-1");
    await simulateToolEnd(ctx, "browser", "tc-1", {
      isError: true,
      result: errorResult("Chrome extension relay not connected"),
    });

    expect(ctx.state.lastToolError).toBeDefined();
    expect(ctx.state.lastToolError?.toolName).toBe("browser");
  });

  it("clears non-mutating lastToolError on subsequent success", async () => {
    const ctx = createMockContext();

    // browser fails
    await simulateToolStart(ctx, "browser", "tc-1");
    await simulateToolEnd(ctx, "browser", "tc-1", {
      isError: true,
      result: errorResult("timeout"),
    });
    expect(ctx.state.lastToolError).toBeDefined();

    // read succeeds
    await simulateToolStart(ctx, "read", "tc-2", { file_path: "/tmp/f.txt" });
    await simulateToolEnd(ctx, "read", "tc-2");
    expect(ctx.state.lastToolError).toBeUndefined();
  });

  // ----- Core: mutating error preserved when non-mutating error follows -----

  it("preserves mutating error when a non-mutating error follows", async () => {
    const ctx = createMockContext();

    // message(send) fails — mutating
    await simulateToolStart(ctx, "message", "tc-1", { action: "send", to: "channel:C1" });
    await simulateToolEnd(ctx, "message", "tc-1", {
      isError: true,
      result: errorResult("Action send requires a target"),
    });
    expect(ctx.state.lastToolError?.toolName).toBe("message");
    expect(ctx.state.lastToolError?.mutatingAction).toBe(true);

    // browser(evaluate) fails — non-mutating
    await simulateToolStart(ctx, "browser", "tc-2", { action: "evaluate" });
    await simulateToolEnd(ctx, "browser", "tc-2", {
      isError: true,
      result: errorResult("Chrome extension relay not connected"),
    });

    // The mutating error must still be present
    expect(ctx.state.lastToolError?.toolName).toBe("message");
    expect(ctx.state.lastToolError?.mutatingAction).toBe(true);
  });

  it("preserves mutating error through multiple non-mutating errors", async () => {
    const ctx = createMockContext();

    // exec fails — mutating
    await simulateToolStart(ctx, "exec", "tc-1", { command: "deploy.sh" });
    await simulateToolEnd(ctx, "exec", "tc-1", {
      isError: true,
      result: errorResult("permission denied"),
    });
    expect(ctx.state.lastToolError?.mutatingAction).toBe(true);
    const originalError = ctx.state.lastToolError;

    // browser fails (non-mutating)
    await simulateToolStart(ctx, "browser", "tc-2");
    await simulateToolEnd(ctx, "browser", "tc-2", {
      isError: true,
      result: errorResult("no page loaded"),
    });
    expect(ctx.state.lastToolError).toBe(originalError);

    // read fails (non-mutating, read is not in MUTATING_TOOL_NAMES)
    await simulateToolStart(ctx, "read", "tc-3", { file_path: "/x" });
    await simulateToolEnd(ctx, "read", "tc-3", {
      isError: true,
      result: errorResult("file not found"),
    });
    expect(ctx.state.lastToolError).toBe(originalError);
  });

  // ----- Mutating error replaced by newer mutating error -----

  it("replaces mutating error with a newer mutating error", async () => {
    const ctx = createMockContext();

    // message(send) fails
    await simulateToolStart(ctx, "message", "tc-1", { action: "send", to: "C1" });
    await simulateToolEnd(ctx, "message", "tc-1", {
      isError: true,
      result: errorResult("target not found"),
    });

    // exec fails — also mutating
    await simulateToolStart(ctx, "exec", "tc-2", { command: "rm -rf" });
    await simulateToolEnd(ctx, "exec", "tc-2", {
      isError: true,
      result: errorResult("command failed"),
    });

    // The latest mutating error wins
    expect(ctx.state.lastToolError?.toolName).toBe("exec");
    expect(ctx.state.lastToolError?.mutatingAction).toBe(true);
  });

  // ----- Mutating error NOT cleared by unrelated tool success -----

  it("does NOT clear mutating error when a different tool succeeds", async () => {
    const ctx = createMockContext();

    // message(send) fails
    await simulateToolStart(ctx, "message", "tc-1", { action: "send", to: "user@test" });
    await simulateToolEnd(ctx, "message", "tc-1", {
      isError: true,
      result: errorResult("delivery failed"),
    });

    // browser succeeds — non-matching tool
    await simulateToolStart(ctx, "browser", "tc-2", { action: "navigate" });
    await simulateToolEnd(ctx, "browser", "tc-2");

    // Mutating error preserved
    expect(ctx.state.lastToolError?.toolName).toBe("message");
  });

  it("does NOT clear mutating error when same tool with different action succeeds", async () => {
    const ctx = createMockContext();

    // message(send) fails
    await simulateToolStart(ctx, "message", "tc-1", { action: "send", to: "C1" });
    await simulateToolEnd(ctx, "message", "tc-1", {
      isError: true,
      result: errorResult("send failed"),
    });

    // message(list) succeeds — same tool, different action (read-only)
    await simulateToolStart(ctx, "message", "tc-2", { action: "list" });
    await simulateToolEnd(ctx, "message", "tc-2");

    // The send error is still present (list is non-mutating, fingerprint won't match)
    expect(ctx.state.lastToolError?.toolName).toBe("message");
  });

  // ----- Mutating error cleared by matching action success -----

  it("clears mutating error when the same mutating action succeeds", async () => {
    const ctx = createMockContext();

    // message(send) to C1 fails
    await simulateToolStart(ctx, "message", "tc-1", { action: "send", to: "C1" });
    await simulateToolEnd(ctx, "message", "tc-1", {
      isError: true,
      result: errorResult("send failed"),
    });
    expect(ctx.state.lastToolError?.toolName).toBe("message");

    // message(send) to C1 succeeds — same action, same target
    await simulateToolStart(ctx, "message", "tc-2", { action: "send", to: "C1" });
    await simulateToolEnd(ctx, "message", "tc-2");

    // Error should be cleared
    expect(ctx.state.lastToolError).toBeUndefined();
  });

  // ----- Non-mutating error can still overwrite non-mutating error -----

  it("overwrites non-mutating error with another non-mutating error", async () => {
    const ctx = createMockContext();

    // browser fails
    await simulateToolStart(ctx, "browser", "tc-1");
    await simulateToolEnd(ctx, "browser", "tc-1", {
      isError: true,
      result: errorResult("relay disconnected"),
    });
    expect(ctx.state.lastToolError?.toolName).toBe("browser");

    // read fails
    await simulateToolStart(ctx, "read", "tc-2", { file_path: "/tmp" });
    await simulateToolEnd(ctx, "read", "tc-2", {
      isError: true,
      result: errorResult("not found"),
    });

    // Newest non-mutating error replaces old
    expect(ctx.state.lastToolError?.toolName).toBe("read");
  });

  // ----- Edge case: callSummary undefined (duplicate tool_execution_end) -----

  it("handles missing callSummary gracefully (duplicate end event)", async () => {
    const ctx = createMockContext();

    // Start and end normally
    await simulateToolStart(ctx, "exec", "tc-1", { command: "ls" });
    await simulateToolEnd(ctx, "exec", "tc-1", {
      isError: true,
      result: errorResult("timeout"),
    });
    expect(ctx.state.lastToolError?.toolName).toBe("exec");
    expect(ctx.state.lastToolError?.mutatingAction).toBe(true);

    // Duplicate end event — callSummary already deleted from toolMetaById
    // Should not crash, and should not overwrite the existing mutating error
    // because newError.mutatingAction will be undefined (not true).
    await handleToolExecutionEnd(ctx, {
      type: "tool_execution_end",
      toolName: "browser",
      toolCallId: "tc-orphan",
      isError: true,
      result: errorResult("unknown error"),
    });

    // Mutating exec error is preserved (browser with undefined callSummary is treated
    // as non-mutating, so shouldPreserveMutating = true)
    expect(ctx.state.lastToolError?.toolName).toBe("exec");
  });

  // ----- Sequence from user logs: message→browser→browser→exec -----

  it("reproduces the user-reported error chain: message→browser→browser→exec all fail", async () => {
    const ctx = createMockContext();

    // 1. message(send) fails — mutating
    await simulateToolStart(ctx, "message", "tc-1", {
      action: "send",
      to: "channel:C1",
      content: "Hello!",
    });
    await simulateToolEnd(ctx, "message", "tc-1", {
      isError: true,
      result: errorResult("Action send requires a target"),
    });
    expect(ctx.state.lastToolError?.toolName).toBe("message");
    expect(ctx.state.lastToolError?.mutatingAction).toBe(true);

    // 2. browser(click) fails — non-mutating
    await simulateToolStart(ctx, "browser", "tc-2", { action: "click" });
    await simulateToolEnd(ctx, "browser", "tc-2", {
      isError: true,
      result: errorResult("Chrome extension relay not connected"),
    });
    // Mutating error preserved
    expect(ctx.state.lastToolError?.toolName).toBe("message");

    // 3. browser(evaluate) fails — non-mutating
    await simulateToolStart(ctx, "browser", "tc-3", { action: "evaluate" });
    await simulateToolEnd(ctx, "browser", "tc-3", {
      isError: true,
      result: errorResult("Chrome extension relay not connected"),
    });
    // Mutating error still preserved
    expect(ctx.state.lastToolError?.toolName).toBe("message");

    // 4. exec fails — mutating (overwrites previous mutating error)
    await simulateToolStart(ctx, "exec", "tc-4", { command: "curl api" });
    await simulateToolEnd(ctx, "exec", "tc-4", {
      isError: true,
      result: errorResult("command timed out"),
    });
    // Newer mutating error replaces older mutating error
    expect(ctx.state.lastToolError?.toolName).toBe("exec");
    expect(ctx.state.lastToolError?.mutatingAction).toBe(true);
  });

  // ----- Sequence: all non-mutating errors, then one success clears -----

  it("clears non-mutating error on any successful tool", async () => {
    const ctx = createMockContext();

    await simulateToolStart(ctx, "browser", "tc-1");
    await simulateToolEnd(ctx, "browser", "tc-1", {
      isError: true,
      result: errorResult("no page"),
    });
    expect(ctx.state.lastToolError).toBeDefined();

    // Any tool success should clear a non-mutating error
    await simulateToolStart(ctx, "exec", "tc-2", { command: "echo hi" });
    await simulateToolEnd(ctx, "exec", "tc-2");

    expect(ctx.state.lastToolError).toBeUndefined();
  });
});
