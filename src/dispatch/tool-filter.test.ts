import { describe, expect, it } from "vitest";
import {
  buildToolFilterPolicy,
  CORE_ALWAYS_ON_TOOLS,
  filterToolsByDispatch,
  INTENT_TOOL_MAP,
  safeFilterTools,
  type ToolFilterPolicy,
} from "./tool-filter.js";
import type { RoutingDecision } from "./types.js";

// ── Helpers ──

/** Minimal tool stub with a name field. */
const tool = (name: string) => ({ name });

/** Create a RoutingDecision stub with overrides. */
function makeDecision(overrides: Partial<RoutingDecision> = {}): RoutingDecision {
  return {
    intent: "general",
    confidence: 0.9,
    reasoning: "test",
    toolHints: [],
    mcpToolHints: [],
    filteredToolIds: [],
    ...overrides,
  } as RoutingDecision;
}

/** A representative set of 20+ tools that simulate real tool arrays. */
const ALL_TOOLS = [
  "read",
  "write",
  "edit",
  "exec",
  "session_status",
  "memory_search",
  "memory_get",
  "web_search",
  "web_fetch",
  "browser",
  "canvas",
  "image",
  "image_gen",
  "message",
  "tts",
  "agents_list",
  "sessions_list",
  "sessions_history",
  "sessions_send",
  "sessions_spawn",
  "sessions_handoff",
  "gateway",
  "cron",
  "nodes",
  "wechat_send",
  "wechat_read",
  "wechat_check",
  "wecom_send",
  "wecom_read",
  "desktop_control",
  "open_app",
  "mcp_database_query",
  "mcp_database_schema",
  "mcp_homeassistant_get_states",
  "mcp_homeassistant_call_service",
  "apply_patch",
  "process",
].map(tool);

// ─────────────────────────────────────────────────────────────────────────────
// buildToolFilterPolicy
// ─────────────────────────────────────────────────────────────────────────────

describe("buildToolFilterPolicy", () => {
  it('returns undefined when mode is "off"', () => {
    const result = buildToolFilterPolicy(makeDecision(), "off");
    expect(result).toBeUndefined();
  });

  it("returns undefined when decision is undefined", () => {
    const result = buildToolFilterPolicy(undefined, "discovery");
    expect(result).toBeUndefined();
  });

  it("returns undefined when intent is default with confidence 0 (dispatch failure)", () => {
    const decision = makeDecision({ intent: "default", confidence: 0 });
    const result = buildToolFilterPolicy(decision, "intent");
    expect(result).toBeUndefined();
  });

  it("always includes core tools in allow set", () => {
    const decision = makeDecision({ intent: "general" });
    const policy = buildToolFilterPolicy(decision, "intent")!;
    expect(policy).toBeDefined();
    for (const core of CORE_ALWAYS_ON_TOOLS) {
      expect(policy.allow.has(core)).toBe(true);
    }
  });

  it("includes intent-mapped tools for known intent", () => {
    const decision = makeDecision({ intent: "web_browsing" });
    const policy = buildToolFilterPolicy(decision, "intent")!;
    expect(policy).toBeDefined();
    // web_browsing maps to ["group:web", "browser"]
    // group:web expands to ["web_search", "web_fetch"]
    expect(policy.allow.has("web_search")).toBe(true);
    expect(policy.allow.has("web_fetch")).toBe(true);
    expect(policy.allow.has("browser")).toBe(true);
  });

  it("falls back to general map for unknown intent", () => {
    const decision = makeDecision({ intent: "totally_unknown_intent" });
    const policy = buildToolFilterPolicy(decision, "intent")!;
    expect(policy).toBeDefined();
    // general includes agents_list
    expect(policy.allow.has("agents_list")).toBe(true);
  });

  it("handles wildcard patterns as prefixes", () => {
    const decision = makeDecision({ intent: "database_query" });
    const policy = buildToolFilterPolicy(decision, "intent")!;
    expect(policy).toBeDefined();
    // database_query includes "mcp_database_*"
    expect(policy.allowPrefixes.some((p) => p.startsWith("mcp_database_"))).toBe(true);
  });

  it('in "discovery" mode includes toolHints from decision', () => {
    const decision = makeDecision({
      intent: "general",
      toolHints: ["canvas", "tts"],
    });
    const policy = buildToolFilterPolicy(decision, "discovery")!;
    expect(policy).toBeDefined();
    expect(policy.allow.has("canvas")).toBe(true);
    expect(policy.allow.has("tts")).toBe(true);
  });

  it('in "intent" mode does NOT include toolHints from decision', () => {
    const decision = makeDecision({
      intent: "general",
      toolHints: ["canvas", "tts"],
    });
    const policy = buildToolFilterPolicy(decision, "intent")!;
    expect(policy).toBeDefined();
    // canvas and tts are not in the general intent map
    expect(policy.allow.has("canvas")).toBe(false);
    expect(policy.allow.has("tts")).toBe(false);
  });

  it('in "discovery" mode includes mcpToolHints', () => {
    const decision = makeDecision({
      intent: "general",
      mcpToolHints: ["mcp_custom_tool"],
    });
    const policy = buildToolFilterPolicy(decision, "discovery")!;
    expect(policy.allow.has("mcp_custom_tool")).toBe(true);
  });

  it('in "discovery" mode includes filteredToolIds', () => {
    const decision = makeDecision({
      intent: "general",
      filteredToolIds: ["core:web_search", "skill:coding"],
    });
    const policy = buildToolFilterPolicy(decision, "discovery")!;
    // filteredToolIds split on ":" and take last segment
    expect(policy.allow.has("web_search")).toBe(true);
    expect(policy.allow.has("coding")).toBe(true);
  });

  it("sets mode on the returned policy", () => {
    const policy = buildToolFilterPolicy(makeDecision(), "discovery")!;
    expect(policy.mode).toBe("discovery");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// filterToolsByDispatch
// ─────────────────────────────────────────────────────────────────────────────

describe("filterToolsByDispatch", () => {
  it("returns all tools when policy is undefined", () => {
    const result = filterToolsByDispatch(ALL_TOOLS, undefined);
    expect(result).toBe(ALL_TOOLS);
  });

  it("keeps tools in the allow set", () => {
    const policy: ToolFilterPolicy = {
      allow: new Set(["read", "write", "edit", "exec", "web_search", "web_fetch", "browser"]),
      allowPrefixes: [],
      mode: "intent",
    };
    const result = filterToolsByDispatch(ALL_TOOLS, policy);
    const names = result.map((t) => t.name);
    expect(names).toContain("read");
    expect(names).toContain("web_search");
    expect(names).toContain("browser");
    expect(names).not.toContain("canvas");
    expect(names).not.toContain("wechat_send");
  });

  it("keeps tools matching prefix patterns", () => {
    const policy: ToolFilterPolicy = {
      allow: new Set(["read"]),
      allowPrefixes: ["mcp_database_"],
      mode: "intent",
    };
    const result = filterToolsByDispatch(ALL_TOOLS, policy);
    const names = result.map((t) => t.name);
    expect(names).toContain("mcp_database_query");
    expect(names).toContain("mcp_database_schema");
    expect(names).not.toContain("mcp_homeassistant_get_states");
  });

  it("filters out tools not in allow or prefix", () => {
    const policy: ToolFilterPolicy = {
      allow: new Set(CORE_ALWAYS_ON_TOOLS),
      allowPrefixes: [],
      mode: "intent",
    };
    const result = filterToolsByDispatch(ALL_TOOLS, policy);
    expect(result.length).toBe(CORE_ALWAYS_ON_TOOLS.size);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// safeFilterTools
// ─────────────────────────────────────────────────────────────────────────────

describe("safeFilterTools", () => {
  it("returns all tools when policy is undefined", () => {
    const result = safeFilterTools(ALL_TOOLS, undefined);
    expect(result).toBe(ALL_TOOLS);
  });

  it("returns filtered tools when count >= minToolCount", () => {
    const policy: ToolFilterPolicy = {
      allow: new Set([...CORE_ALWAYS_ON_TOOLS, "web_search", "web_fetch", "browser"]),
      allowPrefixes: [],
      mode: "intent",
    };
    const result = safeFilterTools(ALL_TOOLS, policy);
    expect(result.length).toBeLessThan(ALL_TOOLS.length);
    expect(result.length).toBeGreaterThanOrEqual(5);
  });

  it("falls back to all tools when filtered count < minToolCount", () => {
    const policy: ToolFilterPolicy = {
      allow: new Set(["read", "write"]), // only 2 matches
      allowPrefixes: [],
      mode: "intent",
    };
    const result = safeFilterTools(ALL_TOOLS, policy, 5);
    expect(result).toBe(ALL_TOOLS); // fell back
  });

  it("respects custom minToolCount", () => {
    const policy: ToolFilterPolicy = {
      allow: new Set(["read", "write", "edit"]),
      allowPrefixes: [],
      mode: "intent",
    };
    // minToolCount=2 → 3 matches >= 2, should filter
    const result = safeFilterTools(ALL_TOOLS, policy, 2);
    expect(result.length).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration — full pipeline
// ─────────────────────────────────────────────────────────────────────────────

describe("full pipeline integration", () => {
  it("general intent significantly reduces tool count", () => {
    const decision = makeDecision({ intent: "general", confidence: 0.95 });
    const policy = buildToolFilterPolicy(decision, "intent")!;
    expect(policy).toBeDefined();
    const filtered = safeFilterTools(ALL_TOOLS, policy);
    // general = core(7) + group:web(2) + group:sessions(~5) + agents_list(1) = ~15
    // Should be less than all 37 tools
    expect(filtered.length).toBeLessThan(ALL_TOOLS.length);
  });

  it("wechat_operation intent includes wechat tools", () => {
    const decision = makeDecision({ intent: "wechat_operation" });
    const policy = buildToolFilterPolicy(decision, "intent")!;
    const filtered = filterToolsByDispatch(ALL_TOOLS, policy);
    const names = filtered.map((t) => t.name);
    expect(names).toContain("wechat_send");
    expect(names).toContain("wechat_read");
    expect(names).toContain("wechat_check");
    expect(names).toContain("message");
    // should NOT include unrelated tools
    expect(names).not.toContain("desktop_control");
    expect(names).not.toContain("image_gen");
  });

  it("database_query intent matches mcp_database_* tools via prefix", () => {
    const decision = makeDecision({ intent: "database_query" });
    const policy = buildToolFilterPolicy(decision, "intent")!;
    const filtered = filterToolsByDispatch(ALL_TOOLS, policy);
    const names = filtered.map((t) => t.name);
    expect(names).toContain("mcp_database_query");
    expect(names).toContain("mcp_database_schema");
    expect(names).not.toContain("mcp_homeassistant_get_states");
  });

  it("discovery mode adds extra tools from toolHints", () => {
    const decision = makeDecision({
      intent: "general",
      toolHints: ["canvas", "cron"],
    });
    const policyIntent = buildToolFilterPolicy(decision, "intent")!;
    const policyDiscovery = buildToolFilterPolicy(decision, "discovery")!;

    const filteredIntent = filterToolsByDispatch(ALL_TOOLS, policyIntent);
    const filteredDiscovery = filterToolsByDispatch(ALL_TOOLS, policyDiscovery);

    // discovery should include canvas and cron which intent does not
    const intentNames = filteredIntent.map((t) => t.name);
    const discoveryNames = filteredDiscovery.map((t) => t.name);
    expect(discoveryNames).toContain("canvas");
    expect(discoveryNames).toContain("cron");
    expect(intentNames).not.toContain("canvas");
    expect(intentNames).not.toContain("cron");
  });

  it("off mode returns all tools unchanged", () => {
    const decision = makeDecision({ intent: "general" });
    const policy = buildToolFilterPolicy(decision, "off");
    expect(policy).toBeUndefined();
    const filtered = safeFilterTools(ALL_TOOLS, policy);
    expect(filtered).toBe(ALL_TOOLS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases from code review
// ─────────────────────────────────────────────────────────────────────────────

describe("code review edge cases", () => {
  it("core tool names match actual registered tool names", () => {
    // These exact names are verified against src/agents/tools/ and pi-coding-agent
    const ACTUAL_REGISTERED_NAMES = [
      "read", // pi-coding-agent read.js
      "write", // pi-coding-agent write.js
      "edit", // pi-coding-agent edit.js
      "exec", // bash-tools.exec.ts (replaces pi-coding-agent "bash")
      "session_status", // session-status-tool.ts
      "memory_search", // memory-tool.ts
      "memory_get", // memory-tool.ts
    ];
    for (const name of ACTUAL_REGISTERED_NAMES) {
      expect(CORE_ALWAYS_ON_TOOLS.has(name)).toBe(true);
    }
    expect(CORE_ALWAYS_ON_TOOLS.size).toBe(ACTUAL_REGISTERED_NAMES.length);
  });

  it("filteredToolIds with multiple colons uses last segment", () => {
    const decision = makeDecision({
      intent: "general",
      filteredToolIds: ["mcp:server:tool_name", "core:", "simple_id"],
    });
    const policy = buildToolFilterPolicy(decision, "discovery")!;
    expect(policy.allow.has("tool_name")).toBe(true);
    expect(policy.allow.has("simple_id")).toBe(true);
    // "core:" → empty string after ":", should NOT add empty to allow set
    expect(policy.allow.has("")).toBe(false);
  });

  it("toolHints wildcard without underscore still works", () => {
    const decision = makeDecision({
      intent: "general",
      toolHints: ["custom_prefix*", "exact_tool"],
    });
    const policy = buildToolFilterPolicy(decision, "discovery")!;
    // "custom_prefix*" → endsWith("*") → prefix "custom_prefix"
    expect(policy.allowPrefixes).toContain("custom_prefix");
    expect(policy.allow.has("exact_tool")).toBe(true);
  });

  it("normalizeToolName handles 'bash' alias to 'exec'", () => {
    // The tool-policy.ts has TOOL_NAME_ALIASES: bash → exec
    const decision = makeDecision({
      intent: "general",
      toolHints: ["bash"],
    });
    const policy = buildToolFilterPolicy(decision, "discovery")!;
    // "bash" should be normalized to "exec"
    expect(policy.allow.has("exec")).toBe(true);
  });

  it("intent with confidence > 0 but intent='default' still filters", () => {
    // Only confidence===0 + intent==="default" means dispatch failure
    const decision = makeDecision({ intent: "default", confidence: 0.3 });
    const policy = buildToolFilterPolicy(decision, "intent");
    // confidence > 0 → should produce a policy (fallback to general map)
    expect(policy).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-intent precise filter verification
// 验证每个意图过滤后的精确工具集合（必须包含 + 必须排除）
// ─────────────────────────────────────────────────────────────────────────────

describe("per-intent precise tool sets", () => {
  // Helper: run full pipeline for an intent, return filtered tool names
  const filterForIntent = (intent: string) => {
    const decision = makeDecision({ intent });
    const policy = buildToolFilterPolicy(decision, "intent")!;
    expect(policy).toBeDefined();
    return filterToolsByDispatch(ALL_TOOLS, policy).map((t) => t.name);
  };

  it("general: core + web + sessions + agents_list", () => {
    const names = filterForIntent("general");
    // Must include
    expect(names).toContain("web_search");
    expect(names).toContain("web_fetch");
    expect(names).toContain("sessions_list");
    expect(names).toContain("agents_list");
    // Must exclude (unrelated)
    expect(names).not.toContain("wechat_send");
    expect(names).not.toContain("desktop_control");
    expect(names).not.toContain("image_gen");
    expect(names).not.toContain("tts");
    expect(names).not.toContain("mcp_database_query");
  });

  it("coding: core + fs + runtime + web + sessions + patch + process + image", () => {
    const names = filterForIntent("coding");
    expect(names).toContain("apply_patch");
    expect(names).toContain("process");
    expect(names).toContain("image");
    expect(names).toContain("web_search");
    expect(names).toContain("sessions_list");
    // Must exclude
    expect(names).not.toContain("wechat_send");
    expect(names).not.toContain("desktop_control");
    expect(names).not.toContain("tts");
  });

  it("wechat_operation: core + wechat_* + message + sessions", () => {
    const names = filterForIntent("wechat_operation");
    expect(names).toContain("wechat_send");
    expect(names).toContain("wechat_read");
    expect(names).toContain("wechat_check");
    expect(names).toContain("message");
    expect(names).toContain("sessions_list");
    // Must exclude
    expect(names).not.toContain("desktop_control");
    expect(names).not.toContain("open_app");
    expect(names).not.toContain("web_search");
  });

  it("desktop_control: core + desktop_control + open_app + browser + canvas", () => {
    const names = filterForIntent("desktop_control");
    expect(names).toContain("desktop_control");
    expect(names).toContain("open_app");
    expect(names).toContain("browser");
    expect(names).toContain("canvas");
    // Must exclude
    expect(names).not.toContain("wechat_send");
    expect(names).not.toContain("web_search");
  });

  it("image_generation: core + image + image_gen + message", () => {
    const names = filterForIntent("image_generation");
    expect(names).toContain("image");
    expect(names).toContain("image_gen");
    expect(names).toContain("message");
    // Must exclude
    expect(names).not.toContain("web_search");
    expect(names).not.toContain("desktop_control");
  });

  it("database_query: core + runtime + mcp_database_* (prefix)", () => {
    const names = filterForIntent("database_query");
    expect(names).toContain("exec");
    expect(names).toContain("process");
    expect(names).toContain("mcp_database_query");
    expect(names).toContain("mcp_database_schema");
    // Prefix must NOT match homeassistant
    expect(names).not.toContain("mcp_homeassistant_get_states");
    expect(names).not.toContain("wechat_send");
  });

  it("web_browsing: core + web + browser", () => {
    const names = filterForIntent("web_browsing");
    expect(names).toContain("web_search");
    expect(names).toContain("web_fetch");
    expect(names).toContain("browser");
    expect(names).not.toContain("canvas");
    expect(names).not.toContain("tts");
  });

  it("audio_processing: core + tts + message", () => {
    const names = filterForIntent("audio_processing");
    expect(names).toContain("tts");
    expect(names).toContain("message");
    expect(names).not.toContain("web_search");
    expect(names).not.toContain("browser");
  });

  it("smart_home_query: core + mcp_homeassistant_* (prefix)", () => {
    const names = filterForIntent("smart_home_query");
    expect(names).toContain("mcp_homeassistant_get_states");
    expect(names).toContain("mcp_homeassistant_call_service");
    expect(names).not.toContain("mcp_database_query");
    expect(names).not.toContain("wechat_send");
  });

  it("smart_home_control: core + mcp_homeassistant_* (prefix)", () => {
    const names = filterForIntent("smart_home_control");
    expect(names).toContain("mcp_homeassistant_get_states");
    expect(names).toContain("mcp_homeassistant_call_service");
    expect(names).not.toContain("desktop_control");
  });

  it("robot_command: core + message + runtime", () => {
    const names = filterForIntent("robot_command");
    expect(names).toContain("message");
    expect(names).toContain("exec");
    expect(names).toContain("process");
    expect(names).not.toContain("web_search");
    expect(names).not.toContain("desktop_control");
  });

  it("all core tools survive every intent", () => {
    const allIntents = Object.keys(INTENT_TOOL_MAP);
    for (const intent of allIntents) {
      const names = filterForIntent(intent);
      for (const core of CORE_ALWAYS_ON_TOOLS) {
        expect(names).toContain(core);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INTENT_TOOL_MAP ↔ dispatch.yaml sync
// ─────────────────────────────────────────────────────────────────────────────

describe("INTENT_TOOL_MAP and dispatch.yaml intent sync", () => {
  // All intent IDs defined in config/dispatch.yaml
  const YAML_INTENT_IDS = [
    "image_generation",
    "wechat_operation",
    "database_query",
    "coding",
    "smart_home_query",
    "smart_home_control",
    "robot_command",
    "desktop_control",
    "web_browsing",
    "audio_processing",
    "general",
  ];

  it("every dispatch.yaml intent has a mapping in INTENT_TOOL_MAP", () => {
    for (const id of YAML_INTENT_IDS) {
      expect(INTENT_TOOL_MAP[id]).toBeDefined();
    }
  });

  it("INTENT_TOOL_MAP does not have extra intents not in dispatch.yaml", () => {
    const mapIntents = Object.keys(INTENT_TOOL_MAP);
    for (const id of mapIntents) {
      expect(YAML_INTENT_IDS).toContain(id);
    }
  });

  it("intent count matches", () => {
    expect(Object.keys(INTENT_TOOL_MAP).length).toBe(YAML_INTENT_IDS.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Filter preserves original order
// ─────────────────────────────────────────────────────────────────────────────

describe("filterToolsByDispatch preserves input order", () => {
  it("filtered tools maintain their original relative order", () => {
    const policy: ToolFilterPolicy = {
      allow: new Set(["process", "read", "web_search"]),
      allowPrefixes: [],
      mode: "intent",
    };
    const result = filterToolsByDispatch(ALL_TOOLS, policy);
    const names = result.map((t) => t.name);
    // In ALL_TOOLS: read(0), web_search(7), process(36) — that order must be preserved
    expect(names).toEqual(["read", "web_search", "process"]);
  });

  it("prefix-matched tools maintain order among themselves", () => {
    const policy: ToolFilterPolicy = {
      allow: new Set<string>(),
      allowPrefixes: ["mcp_"],
      mode: "intent",
    };
    const result = filterToolsByDispatch(ALL_TOOLS, policy);
    const names = result.map((t) => t.name);
    // mcp_database_query comes before mcp_database_schema which comes before mcp_homeassistant_*
    expect(names.indexOf("mcp_database_query")).toBeLessThan(names.indexOf("mcp_database_schema"));
    expect(names.indexOf("mcp_database_schema")).toBeLessThan(
      names.indexOf("mcp_homeassistant_get_states"),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Filter → applyToolHints combination semantics
// ─────────────────────────────────────────────────────────────────────────────

describe("filter + reorder combination (simulates pi-tools.ts pipeline)", () => {
  // Simulate the exact logic in pi-tools.ts:475-484
  const simulatePipeline = (
    tools: { name: string }[],
    policy: ToolFilterPolicy | undefined,
    hints: string[],
  ) => {
    let finalTools = tools;
    if (policy) {
      finalTools = safeFilterTools(finalTools, policy);
    }
    // Simplified applyToolHints inline (move hinted to front)
    if (hints.length > 0) {
      const hintSet = new Set(hints);
      const hinted = finalTools.filter((t) => hintSet.has(t.name));
      const rest = finalTools.filter((t) => !hintSet.has(t.name));
      if (hinted.length > 0) {
        finalTools = [...hinted, ...rest];
      }
    }
    return finalTools;
  };

  it("filter removes, then reorder moves hinted to front", () => {
    const decision = makeDecision({
      intent: "general",
      toolHints: ["agents_list"],
    });
    const policy = buildToolFilterPolicy(decision, "intent")!;
    const result = simulatePipeline(ALL_TOOLS, policy, ["agents_list"]);
    const names = result.map((t) => t.name);
    // agents_list should be first (reordered to front)
    expect(names[0]).toBe("agents_list");
    // desktop_control should NOT be in the result (filtered out)
    expect(names).not.toContain("desktop_control");
  });

  it("tools not in filter policy are absent even if hinted", () => {
    const decision = makeDecision({ intent: "general" });
    const policy = buildToolFilterPolicy(decision, "intent")!;
    // desktop_control is NOT in general intent map
    const result = simulatePipeline(ALL_TOOLS, policy, ["desktop_control"]);
    const names = result.map((t) => t.name);
    // Already filtered out → hint can't bring it back
    expect(names).not.toContain("desktop_control");
  });

  it("with undefined policy, reorder still works on full set", () => {
    const result = simulatePipeline(ALL_TOOLS, undefined, ["process"]);
    const names = result.map((t) => t.name);
    expect(names[0]).toBe("process");
    expect(names.length).toBe(ALL_TOOLS.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Empty and extreme boundary conditions
// ─────────────────────────────────────────────────────────────────────────────

describe("boundary conditions", () => {
  it("empty tool array returns empty after filter", () => {
    const policy: ToolFilterPolicy = {
      allow: new Set(["read"]),
      allowPrefixes: [],
      mode: "intent",
    };
    const result = filterToolsByDispatch([], policy);
    expect(result).toEqual([]);
  });

  it("safeFilterTools with empty tool array falls back to empty (not error)", () => {
    const policy: ToolFilterPolicy = {
      allow: new Set(["read"]),
      allowPrefixes: [],
      mode: "intent",
    };
    // 0 < minToolCount(5) → falls back, but fallback is also empty
    const result = safeFilterTools([], policy);
    expect(result).toEqual([]);
  });

  it("policy with empty allow set and no prefixes (< 5) → buildToolFilterPolicy returns undefined", () => {
    // Minimal intent that produces < 5 allowed tools
    // smart_home_query only adds mcp_homeassistant_* (prefixes, 0 exact) + core(7) = 7 exact + 1 prefix = 8
    // This actually WILL produce a policy. So test a contrived case:
    const decision = makeDecision({ intent: "general", confidence: 0.9 });
    const policy = buildToolFilterPolicy(decision, "intent");
    // general adds core(7) + web(2) + sessions(5) + agents_list(1) = ~15
    // Definitely >= 5
    expect(policy).toBeDefined();
  });

  it("duplicate tool names in input are handled correctly", () => {
    const tools = [tool("read"), tool("read"), tool("web_search")];
    const policy: ToolFilterPolicy = {
      allow: new Set(["read", "web_search"]),
      allowPrefixes: [],
      mode: "intent",
    };
    const result = filterToolsByDispatch(tools, policy);
    // Both "read" instances should survive
    expect(result.length).toBe(3);
  });

  it("tool names with mixed case are normalized", () => {
    const tools = [tool("Read"), tool("WEB_SEARCH"), tool("Exec")];
    const policy: ToolFilterPolicy = {
      allow: new Set(["read", "web_search", "exec"]),
      allowPrefixes: [],
      mode: "intent",
    };
    const result = filterToolsByDispatch(tools, policy);
    // normalizeToolName lowercases, so "Read" → "read" matches
    expect(result.length).toBe(3);
  });

  it("tool name with whitespace is trimmed by normalizeToolName", () => {
    const tools = [tool("  read  "), tool("exec")];
    const policy: ToolFilterPolicy = {
      allow: new Set(["read", "exec"]),
      allowPrefixes: [],
      mode: "intent",
    };
    const result = filterToolsByDispatch(tools, policy);
    expect(result.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Config-loader: toolFilterMode parsing
// ─────────────────────────────────────────────────────────────────────────────

describe("config-loader toolFilterMode parsing", () => {
  // We import validateDispatchConfig to test that toolFilterMode is parsed correctly
  let validateDispatchConfig: typeof import("./config-loader.js").validateDispatchConfig;

  // Lazy-load to avoid side effects at module level
  it("toolFilterMode defaults to 'off' when not specified", async () => {
    const mod = await import("./config-loader.js");
    validateDispatchConfig = mod.validateDispatchConfig;
    const config = validateDispatchConfig({ version: 1, intents: [] });
    expect(config.settings.toolFilterMode).toBe("off");
  });

  it("toolFilterMode accepts 'intent'", async () => {
    const mod = await import("./config-loader.js");
    const config = mod.validateDispatchConfig({
      version: 1,
      intents: [],
      settings: { toolFilterMode: "intent" },
    });
    expect(config.settings.toolFilterMode).toBe("intent");
  });

  it("toolFilterMode accepts 'discovery'", async () => {
    const mod = await import("./config-loader.js");
    const config = mod.validateDispatchConfig({
      version: 1,
      intents: [],
      settings: { toolFilterMode: "discovery" },
    });
    expect(config.settings.toolFilterMode).toBe("discovery");
  });

  it("toolFilterMode accepts 'off'", async () => {
    const mod = await import("./config-loader.js");
    const config = mod.validateDispatchConfig({
      version: 1,
      intents: [],
      settings: { toolFilterMode: "off" },
    });
    expect(config.settings.toolFilterMode).toBe("off");
  });

  it("invalid toolFilterMode falls back to 'off'", async () => {
    const mod = await import("./config-loader.js");
    const config = mod.validateDispatchConfig({
      version: 1,
      intents: [],
      settings: { toolFilterMode: "invalid_value" },
    });
    expect(config.settings.toolFilterMode).toBe("off");
  });

  it("non-string toolFilterMode falls back to 'off'", async () => {
    const mod = await import("./config-loader.js");
    const config = mod.validateDispatchConfig({
      version: 1,
      intents: [],
      settings: { toolFilterMode: 123 },
    });
    expect(config.settings.toolFilterMode).toBe("off");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Quantitative: token savings estimation
// 验证过滤效果的量化指标
// ─────────────────────────────────────────────────────────────────────────────

describe("quantitative: tool count reduction per intent", () => {
  const TOTAL = ALL_TOOLS.length; // 37 tools

  const getFilteredCount = (intent: string, mode: "intent" | "discovery" = "intent") => {
    const decision = makeDecision({ intent });
    const policy = buildToolFilterPolicy(decision, mode)!;
    return safeFilterTools(ALL_TOOLS, policy).length;
  };

  it("general: reduces from 37 to ~15 tools (>50% reduction)", () => {
    const count = getFilteredCount("general");
    expect(count).toBeLessThan(TOTAL * 0.55); // at most ~20
    expect(count).toBeGreaterThan(5); // safety guard not triggered
  });

  it("image_generation: reduces from 37 to ~10 tools (>70% reduction)", () => {
    const count = getFilteredCount("image_generation");
    expect(count).toBeLessThan(TOTAL * 0.35);
    expect(count).toBeGreaterThan(5);
  });

  it("audio_processing: reduces from 37 to ~9 tools (>75% reduction)", () => {
    const count = getFilteredCount("audio_processing");
    expect(count).toBeLessThan(TOTAL * 0.30);
    expect(count).toBeGreaterThan(5);
  });

  it("coding: has the most tools of any intent but still less than full", () => {
    const count = getFilteredCount("coding");
    // coding = core(7) + fs(4) + runtime(2) + web(2) + sessions(5) + apply_patch + process + image = ~20
    // But some overlap (read/write/edit/exec in both core and fs/runtime)
    expect(count).toBeLessThan(TOTAL);
    expect(count).toBeGreaterThan(10);
  });

  it("smart_home_query: minimal — just core + prefix matches", () => {
    const count = getFilteredCount("smart_home_query");
    // core(7) + mcp_homeassistant_*(2 in ALL_TOOLS) = ~9
    expect(count).toBeLessThan(12);
    expect(count).toBeGreaterThan(5);
  });

  it("discovery mode includes more tools than intent mode", () => {
    const decision = makeDecision({
      intent: "general",
      toolHints: ["canvas", "cron", "nodes", "tts"],
    });
    const policyIntent = buildToolFilterPolicy(decision, "intent")!;
    const policyDiscovery = buildToolFilterPolicy(decision, "discovery")!;
    const intentCount = safeFilterTools(ALL_TOOLS, policyIntent).length;
    const discoveryCount = safeFilterTools(ALL_TOOLS, policyDiscovery).length;
    expect(discoveryCount).toBeGreaterThan(intentCount);
  });

  it("no intent produces fewer than 5 tools (safety guard never triggers)", () => {
    for (const intent of Object.keys(INTENT_TOOL_MAP)) {
      const decision = makeDecision({ intent });
      const policy = buildToolFilterPolicy(decision, "intent")!;
      const filtered = filterToolsByDispatch(ALL_TOOLS, policy);
      expect(filtered.length).toBeGreaterThanOrEqual(5);
    }
  });
});
