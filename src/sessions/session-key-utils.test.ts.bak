import { describe, expect, it } from "vitest";
import {
  getAgentNestingDepth,
  getSubagentDepth,
  isSubagentSessionKey,
  parseAgentSessionKey,
} from "./session-key-utils.js";

describe("getSubagentDepth", () => {
  it("returns 0 for top-level agent sessions", () => {
    expect(getSubagentDepth("agent:main:main")).toBe(0);
    expect(getSubagentDepth("agent:assistant:telegram:user123")).toBe(0);
  });

  it("returns 0 for null/undefined/empty", () => {
    expect(getSubagentDepth(null)).toBe(0);
    expect(getSubagentDepth(undefined)).toBe(0);
    expect(getSubagentDepth("")).toBe(0);
  });

  it("returns 1 for first-level subagent sessions", () => {
    expect(getSubagentDepth("agent:main:subagent:abc-123")).toBe(1);
    expect(getSubagentDepth("agent:research:subagent:uuid-here")).toBe(1);
  });

  it("returns 2 for second-level nested subagent sessions", () => {
    // A subagent that spawned another subagent
    expect(getSubagentDepth("agent:main:subagent:abc:subagent:def")).toBe(2);
  });

  it("returns 3 for third-level nesting", () => {
    expect(getSubagentDepth("agent:main:subagent:a:subagent:b:subagent:c")).toBe(3);
  });

  it("is case-insensitive for subagent segments", () => {
    expect(getSubagentDepth("agent:main:Subagent:abc")).toBe(1);
    expect(getSubagentDepth("agent:main:SUBAGENT:abc:subagent:def")).toBe(2);
  });

  it("handles legacy format (subagent: prefix without agent:)", () => {
    expect(getSubagentDepth("subagent:abc")).toBe(1);
  });
});

describe("isSubagentSessionKey", () => {
  it("returns true for subagent keys", () => {
    expect(isSubagentSessionKey("agent:main:subagent:abc")).toBe(true);
    expect(isSubagentSessionKey("subagent:abc")).toBe(true);
  });

  it("returns false for non-subagent keys", () => {
    expect(isSubagentSessionKey("agent:main:main")).toBe(false);
    expect(isSubagentSessionKey(null)).toBe(false);
  });
});

describe("parseAgentSessionKey", () => {
  it("parses valid agent session keys", () => {
    const result = parseAgentSessionKey("agent:main:subagent:abc");
    expect(result).toEqual({ agentId: "main", rest: "subagent:abc" });
  });

  it("returns null for invalid keys", () => {
    expect(parseAgentSessionKey("")).toBeNull();
    expect(parseAgentSessionKey("notanagent")).toBeNull();
    expect(parseAgentSessionKey(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Bug 3 regression: getAgentNestingDepth — counts both subagent: and handoff:
// ---------------------------------------------------------------------------

describe("getAgentNestingDepth", () => {
  it("returns 0 for top-level agent sessions", () => {
    expect(getAgentNestingDepth("agent:main:main")).toBe(0);
    expect(getAgentNestingDepth("agent:assistant:telegram:user123")).toBe(0);
  });

  it("returns 0 for null/undefined/empty", () => {
    expect(getAgentNestingDepth(null)).toBe(0);
    expect(getAgentNestingDepth(undefined)).toBe(0);
    expect(getAgentNestingDepth("")).toBe(0);
  });

  it("counts subagent: markers", () => {
    expect(getAgentNestingDepth("agent:main:subagent:abc")).toBe(1);
    expect(getAgentNestingDepth("agent:main:subagent:a:subagent:b")).toBe(2);
  });

  it("counts handoff: markers", () => {
    expect(getAgentNestingDepth("agent:main:handoff:agent-b")).toBe(1);
    expect(getAgentNestingDepth("agent:main:handoff:a:handoff:b")).toBe(2);
  });

  it("counts mixed subagent: and handoff: markers", () => {
    // A → spawn B → handoff C: depth = 2
    expect(getAgentNestingDepth("agent:a:subagent:agent:b:handoff:agent:c")).toBe(2);
    // A → handoff B → spawn C → handoff D: depth = 3
    expect(getAgentNestingDepth("agent:a:handoff:b:subagent:c:handoff:d")).toBe(3);
  });

  it("is case-insensitive", () => {
    expect(getAgentNestingDepth("agent:main:HANDOFF:abc")).toBe(1);
    expect(getAgentNestingDepth("agent:main:Subagent:abc:Handoff:def")).toBe(2);
  });

  it("returns depth >= 3 for deeply nested chains (triggers handoff block)", () => {
    const deep = "agent:a:subagent:b:handoff:c:subagent:d";
    expect(getAgentNestingDepth(deep)).toBeGreaterThanOrEqual(3);
  });
});
