/**
 * Tool Recommendation Module
 *
 * Given an agent's role description, recommends appropriate tools,
 * skills, and MCP servers.
 *
 * Design: Pure mapping based on keyword analysis.
 * Future: integrate with tool-discovery pipeline for LLM-powered selection.
 */

import type { AgentToolRecommendation } from "./types.js";

// ── Intent → Tool Group Mapping ──────────────────────────────────────────

type IntentPattern = {
  /** Keywords that trigger this recommendation */
  keywords: string[];
  /** Recommended tool groups */
  toolGroups: string[];
  /** Individual tools */
  tools?: string[];
  /** Skills */
  skills?: string[];
  /** MCP server suggestions */
  mcpServers?: string[];
};

const INTENT_PATTERNS: IntentPattern[] = [
  {
    keywords: [
      "搜索",
      "查询",
      "查找",
      "信息",
      "资料",
      "新闻",
      "search",
      "query",
      "research",
      "news",
      "internet",
      "web",
    ],
    toolGroups: ["group:web"],
  },
  {
    keywords: [
      "文件",
      "读取",
      "写入",
      "保存",
      "下载",
      "file",
      "read",
      "write",
      "save",
      "download",
      "fs",
      "storage",
    ],
    toolGroups: ["group:fs"],
  },
  {
    keywords: [
      "记忆",
      "记录",
      "笔记",
      "备忘",
      "知识",
      "memory",
      "note",
      "remember",
      "knowledge",
    ],
    toolGroups: ["group:memory"],
  },
  {
    keywords: [
      "日程",
      "日历",
      "提醒",
      "预约",
      "会议",
      "schedule",
      "calendar",
      "remind",
      "appointment",
      "meeting",
    ],
    toolGroups: ["group:memory"],
    tools: ["cron"],
    skills: ["calendar"],
  },
  {
    keywords: [
      "代码",
      "编程",
      "开发",
      "编译",
      "调试",
      "code",
      "program",
      "develop",
      "compile",
      "debug",
      "git",
    ],
    toolGroups: ["group:fs", "group:web"],
  },
  {
    keywords: [
      "浏览器",
      "网页",
      "截图",
      "browser",
      "webpage",
      "screenshot",
      "scrape",
    ],
    toolGroups: ["group:web"],
    tools: ["browser"],
  },
  {
    keywords: [
      "邮件",
      "消息",
      "通知",
      "发送",
      "email",
      "message",
      "notify",
      "send",
      "alert",
    ],
    toolGroups: ["group:memory"],
    tools: ["cron"],
  },
  {
    keywords: [
      "数据",
      "分析",
      "统计",
      "报表",
      "图表",
      "data",
      "analyze",
      "statistics",
      "report",
      "chart",
    ],
    toolGroups: ["group:fs", "group:web", "group:memory"],
  },
  {
    keywords: [
      "表格",
      "excel",
      "csv",
      "spreadsheet",
      "sheets",
    ],
    toolGroups: ["group:fs"],
    mcpServers: ["@anthropic/mcp-google-sheets"],
  },
  {
    keywords: [
      "图片",
      "图像",
      "画",
      "设计",
      "image",
      "picture",
      "draw",
      "design",
      "photo",
    ],
    toolGroups: ["group:web"],
  },
];

/**
 * Recommend tools for an agent based on its role description.
 *
 * Scans the role description for intent keywords and aggregates
 * matching tool groups, individual tools, skills, and MCP servers.
 */
export function recommendToolsForRole(
  role: string,
  agentName?: string,
): AgentToolRecommendation {
  const text = `${agentName ?? ""} ${role}`.toLowerCase();

  const allowGroups = new Set<string>();
  const allowTools = new Set<string>();
  const skills = new Set<string>();
  const mcpServers = new Set<string>();

  for (const pattern of INTENT_PATTERNS) {
    const matched = pattern.keywords.some((kw) => text.includes(kw));
    if (matched) {
      for (const group of pattern.toolGroups) allowGroups.add(group);
      for (const tool of pattern.tools ?? []) allowTools.add(tool);
      for (const skill of pattern.skills ?? []) skills.add(skill);
      for (const mcp of pattern.mcpServers ?? []) mcpServers.add(mcp);
    }
  }

  // Include memory for inter-agent knowledge sharing by default.
  // (The caller can still put "group:memory" in deny to override.)
  allowGroups.add("group:memory");

  const allow = [...allowGroups, ...allowTools];

  return {
    allow: allow.length > 0 ? allow : undefined,
    profile: "minimal",
    skills: skills.size > 0 ? [...skills] : undefined,
    mcpServers: mcpServers.size > 0 ? [...mcpServers] : undefined,
  };
}

/**
 * Merge a template's tool recommendation with the auto-detected one.
 * Template values take priority for `allow` (more curated).
 */
export function mergeToolRecommendations(
  template: AgentToolRecommendation,
  autoDetected: AgentToolRecommendation,
): AgentToolRecommendation {
  const allow = new Set<string>([
    ...(template.allow ?? []),
    ...(autoDetected.allow ?? []),
  ]);
  const skills = new Set<string>([
    ...(template.skills ?? []),
    ...(autoDetected.skills ?? []),
  ]);
  const mcpServers = new Set<string>([
    ...(template.mcpServers ?? []),
    ...(autoDetected.mcpServers ?? []),
  ]);

  return {
    allow: allow.size > 0 ? [...allow] : undefined,
    deny: template.deny ?? autoDetected.deny,
    profile: template.profile ?? autoDetected.profile,
    skills: skills.size > 0 ? [...skills] : undefined,
    mcpServers: mcpServers.size > 0 ? [...mcpServers] : undefined,
  };
}

/**
 * Estimate token overhead of tools for display purposes.
 *
 * Rough estimates:
 *   - Each tool group: ~800 tokens in system prompt
 *   - Each individual tool: ~200 tokens
 *   - Each skill: ~400 tokens
 *   - Base agent prompt: ~2000 tokens (minimal mode)
 */
export function estimateToolTokens(recommendation: AgentToolRecommendation): number {
  const groupCount = (recommendation.allow ?? []).filter((t) => t.startsWith("group:")).length;
  const toolCount = (recommendation.allow ?? []).filter((t) => !t.startsWith("group:")).length;
  const skillCount = (recommendation.skills ?? []).length;

  return 2000 + groupCount * 800 + toolCount * 200 + skillCount * 400;
}
