/**
 * Tool Filter — 按 dispatch 意图动态过滤工具
 *
 * 当 dispatch 识别出用户意图后，只保留核心工具 + 该意图相关的工具，
 * 将闲聊场景的工具开销从 ~20K 降到 ~4-6K tokens。
 *
 * 安全机制：
 * - CORE_ALWAYS_ON_TOOLS 永远不被过滤
 * - safeFilterTools() 过滤后 < minToolCount 时回退全量
 * - toolFilterMode: "off" 时不过滤（向后兼容）
 */

import { expandToolGroups, normalizeToolName } from "../agents/tool-policy.js";
import type { RoutingDecision } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Core tool set — 永远不被过滤，任何意图都需要
// ─────────────────────────────────────────────────────────────────────────────

export const CORE_ALWAYS_ON_TOOLS: ReadonlySet<string> = new Set([
  "read",
  "write",
  "edit",
  "exec",
  "session_status",
  "memory_search",
  "memory_get",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Intent-to-tool mapping — 每个意图需要的额外工具
// 使用 TOOL_GROUPS 引用（如 "group:web"）和具体工具名
// 通配符仅支持尾部形式（如 "mcp_database_*"），不支持中间通配符
// ─────────────────────────────────────────────────────────────────────────────

export const INTENT_TOOL_MAP: Record<string, string[]> = {
  general: ["group:web", "group:sessions", "agents_list"],
  coding: [
    "group:fs",
    "group:runtime",
    "group:web",
    "group:sessions",
    "apply_patch",
    "process",
    "image",
  ],
  wechat_operation: [
    "wechat_send",
    "wechat_read",
    "wechat_check",
    "message",
    "group:sessions",
  ],
  desktop_control: ["desktop_control", "open_app", "browser", "canvas"],
  image_generation: ["image", "image_gen", "message"],
  database_query: ["group:runtime", "mcp_database_*"],
  web_browsing: ["group:web", "browser"],
  audio_processing: ["tts", "message"],
  smart_home_query: ["mcp_homeassistant_*"],
  smart_home_control: ["mcp_homeassistant_*"],
  robot_command: ["message", "group:runtime"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ToolFilterMode = "off" | "intent" | "discovery";

export type ToolFilterPolicy = {
  /** 允许保留的工具名（已 normalize） */
  allow: Set<string>;
  /** 通配符前缀（如 "mcp_database_"） */
  allowPrefixes: string[];
  /** 产生此策略的模式 */
  mode: ToolFilterMode;
};

// ─────────────────────────────────────────────────────────────────────────────
// Build filter policy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 从 RoutingDecision 构建过滤策略。
 * 返回 undefined 表示不过滤（toolFilterMode=off / dispatch 失败等场景）。
 */
export function buildToolFilterPolicy(
  decision: RoutingDecision | undefined,
  toolFilterMode: ToolFilterMode,
): ToolFilterPolicy | undefined {
  if (!decision || toolFilterMode === "off") return undefined;

  // dispatch 失败时不过滤
  if (decision.intent === "default" && decision.confidence === 0) return undefined;

  // 1. 核心工具
  const allow = new Set<string>(CORE_ALWAYS_ON_TOOLS);
  const allowPrefixes: string[] = [];

  // 2. 意图相关工具
  const intentTools = INTENT_TOOL_MAP[decision.intent] ?? INTENT_TOOL_MAP["general"]!;
  const expanded = expandToolGroups(intentTools);
  for (const tool of expanded) {
    if (tool.includes("*")) {
      allowPrefixes.push(tool.replace(/\*$/, ""));
    } else {
      allow.add(normalizeToolName(tool));
    }
  }

  // 3. discovery 模式：额外加入 dispatch 推荐的工具
  if (toolFilterMode === "discovery") {
    // Helper: unified wildcard detection for both toolHints and mcpToolHints.
    // Only trailing wildcards are supported (e.g. "mcp_database_*").
    const addHint = (hint: string) => {
      if (hint.endsWith("*")) {
        // "mcp_database_*" → prefix "mcp_database_" ; "foo_*" → "foo_"
        allowPrefixes.push(hint.slice(0, -1));
      } else {
        allow.add(normalizeToolName(hint));
      }
    };
    for (const hint of decision.toolHints ?? []) addHint(hint);
    for (const hint of decision.mcpToolHints ?? []) addHint(hint);

    for (const id of decision.filteredToolIds ?? []) {
      // filteredToolIds 格式: "core:web_search", "skill:xxx", 或 "mcp:server:tool_name"
      // 取最后一个 ":" 之后的部分作为工具名
      const name = id.includes(":") ? id.slice(id.lastIndexOf(":") + 1) : id;
      if (name) allow.add(normalizeToolName(name));
    }
  }

  // 安全守卫：allow 集太小时不过滤
  if (allow.size + allowPrefixes.length < 5) return undefined;

  return { allow, allowPrefixes, mode: toolFilterMode };
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply filter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 按过滤策略过滤工具数组。
 * policy 为 undefined 时返回原数组。
 */
export function filterToolsByDispatch<T extends { name: string }>(
  tools: T[],
  policy: ToolFilterPolicy | undefined,
): T[] {
  if (!policy) return tools;

  return tools.filter((tool) => {
    const normalized = normalizeToolName(tool.name);
    if (policy.allow.has(normalized)) return true;
    for (const prefix of policy.allowPrefixes) {
      if (normalized.startsWith(prefix)) return true;
    }
    return false;
  });
}

/**
 * 安全过滤：如果过滤后工具数 < minToolCount，回退到全量。
 *
 * minToolCount 默认 5：确保至少保留核心工具集（7 个）中能匹配到的工具。
 * 低于 5 说明意图映射有严重遗漏或工具名不匹配，此时回退比截断更安全。
 */
export function safeFilterTools<T extends { name: string }>(
  allTools: T[],
  policy: ToolFilterPolicy | undefined,
  minToolCount: number = 5,
): T[] {
  if (!policy) return allTools;
  const filtered = filterToolsByDispatch(allTools, policy);
  if (filtered.length < minToolCount) {
    return allTools;
  }
  return filtered;
}
