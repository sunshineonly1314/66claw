/**
 * Deep tests for session-key-utils — covers isCronRunSessionKey,
 * isAcpSessionKey, resolveThreadParentSessionKey, and edge cases
 * not covered by the existing test file.
 */
import { describe, expect, it } from "vitest";
import {
  isCronRunSessionKey,
  isAcpSessionKey,
  isSubagentSessionKey,
  getSubagentDepth,
  getAgentNestingDepth,
  parseAgentSessionKey,
  resolveThreadParentSessionKey,
} from "./session-key-utils.js";

// ---------------------------------------------------------------------------
// isCronRunSessionKey — fully untested before this
// ---------------------------------------------------------------------------

describe("isCronRunSessionKey", () => {
  it("returns true for valid cron run session keys", () => {
    expect(isCronRunSessionKey("agent:scheduler:cron:daily-report:run:abc-123")).toBe(true);
    expect(isCronRunSessionKey("agent:main:cron:cleanup:run:uuid-here")).toBe(true);
  });

  it("returns false for regular agent session keys", () => {
    expect(isCronRunSessionKey("agent:main:main")).toBe(false);
    expect(isCronRunSessionKey("agent:main:telegram:user")).toBe(false);
  });

  it("returns false for subagent session keys", () => {
    expect(isCronRunSessionKey("agent:main:subagent:abc")).toBe(false);
  });

  it("returns false for null/undefined/empty", () => {
    expect(isCronRunSessionKey(null)).toBe(false);
    expect(isCronRunSessionKey(undefined)).toBe(false);
    expect(isCronRunSessionKey("")).toBe(false);
  });

  it("returns false for partial cron key (missing run segment)", () => {
    expect(isCronRunSessionKey("agent:scheduler:cron:daily-report")).toBe(false);
  });

  it("returns false for cron-like key with extra segments", () => {
    // Pattern requires exactly cron:X:run:Y — no extra colons in run portion
    expect(isCronRunSessionKey("agent:main:cron:job:run:id:extra")).toBe(false);
  });

  it("returns false for key with only 2 parts", () => {
    expect(isCronRunSessionKey("agent:main")).toBe(false);
  });

  it("returns false for whitespace", () => {
    expect(isCronRunSessionKey("  ")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isAcpSessionKey — fully untested before this
// ---------------------------------------------------------------------------

describe("isAcpSessionKey", () => {
  it("returns true for ACP session keys (agent prefix)", () => {
    expect(isAcpSessionKey("agent:main:acp:session-123")).toBe(true);
  });

  it("returns true for ACP session keys (direct acp: prefix)", () => {
    expect(isAcpSessionKey("acp:session-123")).toBe(true);
  });

  it("returns true for ACP with case variations", () => {
    expect(isAcpSessionKey("ACP:session")).toBe(true);
    expect(isAcpSessionKey("agent:main:ACP:session")).toBe(true);
  });

  it("returns false for non-ACP session keys", () => {
    expect(isAcpSessionKey("agent:main:main")).toBe(false);
    expect(isAcpSessionKey("agent:main:subagent:abc")).toBe(false);
  });

  it("returns false for null/undefined/empty", () => {
    expect(isAcpSessionKey(null)).toBe(false);
    expect(isAcpSessionKey(undefined)).toBe(false);
    expect(isAcpSessionKey("")).toBe(false);
  });

  it("returns false for whitespace-only", () => {
    expect(isAcpSessionKey("   ")).toBe(false);
  });

  it("returns false for key containing 'acp' but not as prefix", () => {
    // "acp" appears in the middle, not as a prefix segment
    expect(isAcpSessionKey("agent:main:telegram:acp-user")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveThreadParentSessionKey — fully untested before this
// ---------------------------------------------------------------------------

describe("resolveThreadParentSessionKey", () => {
  it("returns parent key for :thread: session", () => {
    expect(resolveThreadParentSessionKey("agent:main:discord:chan123:thread:thread456")).toBe(
      "agent:main:discord:chan123",
    );
  });

  it("returns parent key for :topic: session", () => {
    expect(resolveThreadParentSessionKey("agent:main:telegram:group:topic:42")).toBe(
      "agent:main:telegram:group",
    );
  });

  it("returns parent for last marker when multiple thread markers exist", () => {
    // Uses lastIndexOf — the rightmost marker wins
    const key = "agent:main:thread:first:topic:second";
    const result = resolveThreadParentSessionKey(key);
    expect(result).toBe("agent:main:thread:first");
  });

  it("returns null for session keys without thread/topic markers", () => {
    expect(resolveThreadParentSessionKey("agent:main:main")).toBeNull();
    expect(resolveThreadParentSessionKey("agent:main:discord:chan123")).toBeNull();
  });

  it("returns null for null/undefined/empty", () => {
    expect(resolveThreadParentSessionKey(null)).toBeNull();
    expect(resolveThreadParentSessionKey(undefined)).toBeNull();
    expect(resolveThreadParentSessionKey("")).toBeNull();
  });

  it("returns null when thread marker is at position 0", () => {
    // If :thread: is at the very beginning, there's no parent to extract
    expect(resolveThreadParentSessionKey(":thread:abc")).toBeNull();
  });

  it("returns null for whitespace-only", () => {
    expect(resolveThreadParentSessionKey("  ")).toBeNull();
  });

  it("trims parent key", () => {
    // The parent slice is trimmed
    expect(resolveThreadParentSessionKey("  agent:main :thread:abc")).toBe("agent:main");
  });
});

// ---------------------------------------------------------------------------
// parseAgentSessionKey edge cases
// ---------------------------------------------------------------------------

describe("parseAgentSessionKey edge cases", () => {
  it("trims whitespace from input", () => {
    const result = parseAgentSessionKey("  agent:main:rest  ");
    expect(result).toEqual({ agentId: "main", rest: "rest" });
  });

  it("returns null for 'agent:' with empty agentId", () => {
    // "agent::rest" → after split+filter(Boolean), parts would be ["agent", "rest"]
    // That's 2 parts, rest = everything after index 2 → "rest" → wait, let me check
    // Actually: "agent::rest".split(":").filter(Boolean) = ["agent", "rest"] → length 2, < 3 → null
    expect(parseAgentSessionKey("agent::rest")).toBeNull();
  });

  it("handles agent: prefix with many segments", () => {
    const result = parseAgentSessionKey("agent:myagent:sub:part1:part2:part3");
    expect(result).toEqual({
      agentId: "myagent",
      rest: "sub:part1:part2:part3",
    });
  });

  it("returns null for non-agent prefix", () => {
    expect(parseAgentSessionKey("user:main:session")).toBeNull();
    expect(parseAgentSessionKey("system:main:task")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseAgentSessionKey(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isSubagentSessionKey edge cases
// ---------------------------------------------------------------------------

describe("isSubagentSessionKey edge cases", () => {
  it("returns true for case-insensitive subagent prefix", () => {
    expect(isSubagentSessionKey("Subagent:abc")).toBe(true);
    expect(isSubagentSessionKey("SUBAGENT:abc")).toBe(true);
  });

  it("returns true for nested subagent in agent format", () => {
    expect(isSubagentSessionKey("agent:main:subagent:task:subagent:nested")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isSubagentSessionKey("")).toBe(false);
  });

  it("returns false for whitespace-only", () => {
    expect(isSubagentSessionKey("   ")).toBe(false);
  });

  it("returns false for 'subagent' without colon", () => {
    expect(isSubagentSessionKey("subagent")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSubagentDepth edge cases
// ---------------------------------------------------------------------------

describe("getSubagentDepth edge cases", () => {
  it("whitespace-only returns 0", () => {
    expect(getSubagentDepth("   ")).toBe(0);
  });

  it("handles key with 'subagent' as substring (not segment)", () => {
    // "mysubagent:" contains "subagent:" as substring — should count
    expect(getSubagentDepth("agent:main:mysubagent:abc")).toBe(1);
  });

  it("handles deeply nested (depth 5)", () => {
    const key = "agent:a:subagent:1:subagent:2:subagent:3:subagent:4:subagent:5";
    expect(getSubagentDepth(key)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// getAgentNestingDepth edge cases
// ---------------------------------------------------------------------------

describe("getAgentNestingDepth edge cases", () => {
  it("whitespace-only returns 0", () => {
    expect(getAgentNestingDepth("   ")).toBe(0);
  });

  it("handles alternating spawn and handoff chains", () => {
    const key = "agent:a:subagent:b:handoff:c:subagent:d:handoff:e";
    expect(getAgentNestingDepth(key)).toBe(4);
  });

  it("does not count partial markers", () => {
    // "sub" is not "subagent:", "hand" is not "handoff:"
    expect(getAgentNestingDepth("agent:main:sub:abc:hand:def")).toBe(0);
  });

  it("handles key without agent: prefix", () => {
    expect(getAgentNestingDepth("subagent:abc:handoff:def")).toBe(2);
  });
});
