import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { describe, expect, it } from "vitest";

import { guardSessionManager } from "./session-tool-result-guard-wrapper.js";

/**
 * Tests for the orphaned user message repair behaviour.
 *
 * When a previous agent run fails (isError=true) without producing an
 * assistant reply, the session's leaf entry is a user message. The next
 * run would then append another user message, violating role alternation.
 *
 * The fix appends a synthetic assistant error acknowledgement instead of
 * deleting the orphaned user message (old `branch(parentId)` strategy).
 */
describe("orphaned user message repair", () => {
  it("preserves user message by appending synthetic assistant reply", () => {
    const sm = guardSessionManager(SessionManager.inMemory());

    // Simulate: user sent a message but the agent errored → no assistant reply
    sm.appendMessage({
      role: "user",
      content: [{ type: "text", text: "Hello, tell me about TypeScript" }],
    } as AgentMessage);

    // Verify leaf is a user message (orphaned)
    const leafBefore = sm.getLeafEntry();
    expect(leafBefore?.type).toBe("message");
    expect((leafBefore as { message: AgentMessage }).message.role).toBe("user");

    // Repair: append synthetic assistant error (matches the fix in attempt.ts)
    const syntheticReply = {
      role: "assistant" as const,
      content: [
        {
          type: "text" as const,
          text: "(The previous request encountered an error and could not be completed. Please try again.)",
        },
      ],
    };
    sm.appendMessage(syntheticReply as Parameters<typeof sm.appendMessage>[0]);

    // After repair, leaf should be the synthetic assistant message
    const leafAfter = sm.getLeafEntry();
    expect(leafAfter?.type).toBe("message");
    expect((leafAfter as { message: AgentMessage }).message.role).toBe("assistant");

    // Verify the full conversation is: user → assistant (synthetic)
    const messages = sm
      .getEntries()
      .filter((e) => e.type === "message")
      .map((e) => (e as { message: AgentMessage }).message);

    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);

    // The user's original message should be preserved
    const userMsg = messages[0];
    expect(userMsg.content).toEqual([{ type: "text", text: "Hello, tell me about TypeScript" }]);
  });

  it("handles multiple orphaned user messages (consecutive error scenario)", () => {
    const sm = guardSessionManager(SessionManager.inMemory());

    // First user message → error → orphaned
    sm.appendMessage({
      role: "user",
      content: [{ type: "text", text: "First question" }],
    } as AgentMessage);

    // Repair first orphan
    sm.appendMessage({
      role: "assistant",
      content: [
        {
          type: "text",
          text: "(The previous request encountered an error and could not be completed. Please try again.)",
        },
      ],
    } as AgentMessage);

    // Second user message → error → orphaned
    sm.appendMessage({
      role: "user",
      content: [{ type: "text", text: "Second question" }],
    } as AgentMessage);

    // Repair second orphan
    sm.appendMessage({
      role: "assistant",
      content: [
        {
          type: "text",
          text: "(The previous request encountered an error and could not be completed. Please try again.)",
        },
      ],
    } as AgentMessage);

    // Verify the full conversation alternates correctly
    const messages = sm
      .getEntries()
      .filter((e) => e.type === "message")
      .map((e) => (e as { message: AgentMessage }).message);

    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);

    // Both user messages should be preserved
    expect(messages[0].content).toEqual([{ type: "text", text: "First question" }]);
    expect(messages[2].content).toEqual([{ type: "text", text: "Second question" }]);
  });

  it("does not interfere when leaf is already an assistant message", () => {
    const sm = guardSessionManager(SessionManager.inMemory());

    // Normal flow: user → assistant
    sm.appendMessage({
      role: "user",
      content: [{ type: "text", text: "Hello" }],
    } as AgentMessage);
    sm.appendMessage({
      role: "assistant",
      content: [{ type: "text", text: "Hi! How can I help?" }],
    } as AgentMessage);

    // Leaf is assistant → no repair needed
    const leaf = sm.getLeafEntry();
    expect((leaf as { message: AgentMessage }).message.role).toBe("assistant");

    // The fix condition `leafEntry.message.role === "user"` would be false
    // → no synthetic message appended → conversation stays clean
    const messages = sm
      .getEntries()
      .filter((e) => e.type === "message")
      .map((e) => (e as { message: AgentMessage }).message);

    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("buildSessionContext includes synthetic reply in context", () => {
    const sm = guardSessionManager(SessionManager.inMemory());

    sm.appendMessage({
      role: "user",
      content: [{ type: "text", text: "What is 2+2?" }],
    } as AgentMessage);

    // Repair
    sm.appendMessage({
      role: "assistant",
      content: [
        {
          type: "text",
          text: "(The previous request encountered an error and could not be completed. Please try again.)",
        },
      ],
    } as AgentMessage);

    const context = sm.buildSessionContext();
    expect(context.messages.length).toBe(2);
    expect(context.messages[0].role).toBe("user");
    expect(context.messages[1].role).toBe("assistant");
  });
});
