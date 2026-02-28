/**
 * Capability Inference Engine
 *
 * Given an agent blueprint + user context, infers full capabilities:
 * model selection, tool profile, skills, MCP hints, memory, etc.
 *
 * Design: Pure functions. Reads configured providers from ctx.config
 * to only recommend models the user actually has access to.
 */

import type {
  AgentBlueprint,
  InferredCapabilities,
  ModelTier,
  UserContext,
} from "../types.js";

// ── Model Tier → Candidate Models ────────────────────────────────────────

type ModelCandidate = {
  fullId: string;          // "deepseek/deepseek-chat"
  provider: string;        // "deepseek"
  modelId: string;         // "deepseek-chat"
  contextWindow: number;
  tier: ModelTier;
  /** Scenario affinity scores */
  affinities: Record<string, number>;
};

const MODEL_CANDIDATES: ModelCandidate[] = [
  // cheap tier
  { fullId: "deepseek/deepseek-chat", provider: "deepseek", modelId: "deepseek-chat", contextWindow: 64000, tier: "cheap", affinities: { general: 8, coding: 7, data_analysis: 7, content: 6 } },
  { fullId: "qwen/qwen-turbo", provider: "qwen", modelId: "qwen-turbo", contextWindow: 131072, tier: "cheap", affinities: { general: 6, content: 7, scheduling: 7 } },
  { fullId: "qwen/qwen-plus", provider: "qwen", modelId: "qwen-plus", contextWindow: 131072, tier: "cheap", affinities: { general: 7, content: 8, research: 6 } },
  { fullId: "zhipu/glm-4-plus", provider: "zhipu", modelId: "glm-4-plus", contextWindow: 128000, tier: "cheap", affinities: { general: 7, content: 7 } },
  { fullId: "doubao/doubao-seed-1-6-lite-251015", provider: "doubao", modelId: "doubao-seed-1-6-lite-251015", contextWindow: 256000, tier: "cheap", affinities: { general: 6, scheduling: 7 } },
  // mid tier
  { fullId: "deepseek/deepseek-reasoner", provider: "deepseek", modelId: "deepseek-reasoner", contextWindow: 64000, tier: "mid", affinities: { coding: 9, data_analysis: 9, research: 8, customer_support: 6 } },
  { fullId: "openai/gpt-4o", provider: "openai", modelId: "gpt-4o", contextWindow: 128000, tier: "mid", affinities: { general: 9, customer_support: 8, content: 8, research: 8 } },
  { fullId: "anthropic/claude-sonnet-4-5", provider: "anthropic", modelId: "claude-sonnet-4-5", contextWindow: 200000, tier: "mid", affinities: { coding: 9, research: 9, general: 8 } },
  { fullId: "zhipu/glm-5", provider: "zhipu", modelId: "glm-5", contextWindow: 128000, tier: "mid", affinities: { general: 8, content: 8, customer_support: 7 } },
  { fullId: "doubao/doubao-seed-1-8-251228", provider: "doubao", modelId: "doubao-seed-1-8-251228", contextWindow: 256000, tier: "mid", affinities: { general: 8, content: 7 } },
  { fullId: "kimi-coding/kimi-for-coding", provider: "kimi-coding", modelId: "kimi-for-coding", contextWindow: 262144, tier: "mid", affinities: { coding: 8, research: 7 } },
  { fullId: "qwen/qwen-max", provider: "qwen", modelId: "qwen-max", contextWindow: 32000, tier: "mid", affinities: { general: 8, content: 8, research: 7 } },
  // sota tier
  { fullId: "anthropic/claude-opus-4-6", provider: "anthropic", modelId: "claude-opus-4-6", contextWindow: 200000, tier: "sota", affinities: { general: 10, coding: 10, research: 10 } },
  { fullId: "openai/o3", provider: "openai", modelId: "o3", contextWindow: 200000, tier: "sota", affinities: { coding: 10, research: 10, data_analysis: 9 } },
];

// ── Scenario → Tool Mapping ──────────────────────────────────────────────

const SCENARIO_TOOL_MAP: Record<string, { profile: string; also: string[] }> = {
  customer_support: { profile: "messaging", also: ["web_search", "memory_search"] },
  coding:           { profile: "coding", also: ["browser"] },
  research:         { profile: "full", also: [] },
  content:          { profile: "minimal", also: ["web_search", "web_fetch", "image_gen"] },
  data_analysis:    { profile: "minimal", also: ["group:fs", "group:runtime"] },
  scheduling:       { profile: "minimal", also: ["cron", "message"] },
  finance:          { profile: "minimal", also: ["group:fs", "group:memory"] },
  learning:         { profile: "minimal", also: ["web_search", "memory_search", "web_fetch"] },
  general:          { profile: "minimal", also: ["web_search"] },
};

// ── Scenario → Skill Mapping ─────────────────────────────────────────────

const SCENARIO_SKILL_MAP: Record<string, string[]> = {
  customer_support: ["wechat-cs", "summarize", "self-troubleshoot", "faq-builder"],
  coding:           ["coding-agent", "github", "web-researcher", "code-review", "git-helper"],
  news:             ["ai-daily-news", "cctv-news", "news-aggregator", "rss-reader", "news-briefing"],
  content:          ["xiaohongshu", "summarize", "web-researcher", "seo-helper", "copywriting"],
  data_analysis:    ["nano-pdf", "csv-analyzer", "data-viz", "sql-helper"],
  finance:          ["nano-pdf", "ledger", "budget-tracker"],
  scheduling:       ["oracle", "calendar", "todo-tracker"],
  learning:         ["web-researcher", "summarize", "flashcard", "quiz-maker"],
  research:         ["web-researcher", "summarize", "nano-pdf", "arxiv-reader"],
  general:          ["web-researcher", "summarize"],
};

// ── Main Inference Function ──────────────────────────────────────────────

/**
 * Infer full capabilities for an agent based on its blueprint and user context.
 *
 * @param bp - The agent blueprint (name, role, tier, etc.)
 * @param userCtx - Structured user context from guided questionnaire
 * @param pluginConfig - Config object from plugin context (to read configured providers)
 */
export function inferAgentCapabilities(
  bp: AgentBlueprint,
  userCtx: UserContext,
  pluginConfig?: Record<string, unknown>,
): InferredCapabilities {
  return {
    model: selectModel(bp.modelTier, userCtx, pluginConfig),
    tools: inferTools(bp.role, userCtx),
    skills: inferSkills(bp.role, userCtx),
    mcpHints: inferMCPServers(bp.role, userCtx.resources),
    memorySearch: inferMemorySearch(bp.role, userCtx),
    identity: { name: bp.name, emoji: bp.emoji },
    subagents: inferSubagents(bp.role),
    heartbeat: inferHeartbeat(bp.role, userCtx),
  };
}

// ── Model Selection ──────────────────────────────────────────────────────

function selectModel(
  tier: ModelTier,
  ctx: UserContext,
  pluginConfig?: Record<string, unknown>,
): InferredCapabilities["model"] {
  const configured = getConfiguredProviders(pluginConfig);
  const scenario = ctx.scenario || "general";

  // Budget → tier adjustment
  let effectiveTier = tier;
  if (ctx.budget === "cheap" && tier === "mid") effectiveTier = "cheap";
  if (ctx.budget === "premium" && tier === "cheap") effectiveTier = "mid";

  // Filter by tier and availability
  let candidates = MODEL_CANDIDATES
    .filter(m => m.tier === effectiveTier)
    .filter(m => configured.length === 0 || configured.includes(m.provider));

  // Fallback: if no models in target tier, try adjacent tiers
  if (candidates.length === 0) {
    candidates = MODEL_CANDIDATES
      .filter(m => configured.length === 0 || configured.includes(m.provider));
  }

  // If still no candidates but user has a global text model configured, use that
  if (candidates.length === 0) {
    const globalModel = getGlobalTextModel(pluginConfig);
    if (globalModel) return { primary: globalModel };
    // Ultimate fallback: use the first candidate from the full table
    return { primary: MODEL_CANDIDATES[0].fullId };
  }

  // Score by scenario affinity
  const scored = candidates.map(m => ({
    ...m,
    score: (m.affinities[scenario] ?? 5) + (m.tier === effectiveTier ? 2 : 0),
  })).sort((a, b) => b.score - a.score);

  return {
    primary: scored[0].fullId,
    fallbacks: scored.slice(1, 3).map(m => m.fullId),
  };
}

/** Read the user's global text model from config as a fallback. */
function getGlobalTextModel(config?: Record<string, unknown>): string | undefined {
  try {
    const agents = config?.agents as Record<string, unknown> | undefined;
    const defaults = agents?.defaults as Record<string, unknown> | undefined;
    const model = defaults?.model;
    if (typeof model === "string" && model.includes("/")) return model;
    if (model && typeof model === "object") {
      const primary = (model as Record<string, unknown>).primary;
      if (typeof primary === "string" && primary.includes("/")) return primary;
    }
  } catch { /* ignore */ }
  return undefined;
}

function getConfiguredProviders(config?: Record<string, unknown>): string[] {
  try {
    const models = config?.models as Record<string, unknown> | undefined;
    const providers = models?.providers;
    if (!providers || typeof providers !== "object") return [];
    // providers is Record<string, ProviderConfig> (object keyed by provider ID), not an array
    if (Array.isArray(providers)) {
      return providers.map(p => String(p.id ?? "")).filter(Boolean);
    }
    return Object.keys(providers as Record<string, unknown>).filter(Boolean);
  } catch {
    return [];
  }
}

// ── Tools Inference ──────────────────────────────────────────────────────

function inferTools(
  role: string,
  ctx: UserContext,
): InferredCapabilities["tools"] {
  const scenario = ctx.scenario || "general";
  const base = SCENARIO_TOOL_MAP[scenario] ?? SCENARIO_TOOL_MAP.general;
  const also = [...base.also];

  // Channel → tools
  for (const ch of ctx.channels) {
    switch (ch) {
      case "wechat":   also.push("wechat_send", "wechat_cs"); break;
      case "dingtalk":  also.push("dingtalk_send"); break;
      case "feishu":    also.push("feishu_send"); break;
    }
  }

  // Role keyword → tools
  if (/分发|路由|调度|dispatch/i.test(role)) also.push("sessions_spawn", "sessions_send");
  if (/知识库|检索|查询|knowledge/i.test(role)) also.push("memory_search", "memory_get");
  if (/定时|提醒|定期|cron|remind/i.test(role)) also.push("cron");
  if (/代码|编程|code|program/i.test(role)) also.push("group:fs");
  if (/文件|文档|file|doc/i.test(role)) also.push("group:fs");
  if (/数据|分析|data|analy/i.test(role)) also.push("group:fs", "group:runtime");

  return {
    profile: base.profile,
    alsoAllow: [...new Set(also)],
  };
}

// ── Skills Inference ─────────────────────────────────────────────────────

function inferSkills(role: string, ctx: UserContext): string[] {
  const scenario = ctx.scenario || "general";
  const skills: string[] = [...(SCENARIO_SKILL_MAP[scenario] ?? [])];

  // Resource → skills
  for (const res of ctx.resources) {
    switch (res) {
      case "pdf":       skills.push("nano-pdf"); break;
      case "github":    skills.push("github"); break;
      case "notion":    skills.push("notion"); break;
    }
  }

  // Role keyword → skills
  if (/新闻|news/i.test(role)) skills.push("ai-daily-news", "news-briefing");
  if (/小红书|xiaohongshu/i.test(role)) skills.push("xiaohongshu");
  if (/总结|summarize|摘要/i.test(role)) skills.push("summarize");
  if (/代码|code|编程|program/i.test(role)) skills.push("coding-agent");
  if (/翻译|translate/i.test(role)) skills.push("translator");
  if (/搜索|search|调研|research/i.test(role)) skills.push("web-researcher");
  if (/pdf|文档/i.test(role)) skills.push("nano-pdf");
  if (/日程|calendar|日历/i.test(role)) skills.push("calendar");
  if (/客服|support|接待/i.test(role)) skills.push("self-troubleshoot");
  if (/写作|写文|copywrite|文案/i.test(role)) skills.push("copywriting");
  if (/数据|data|分析|analy/i.test(role)) skills.push("csv-analyzer");
  if (/图片|image|配图|画/i.test(role)) skills.push("image-helper");
  if (/github|仓库|repo/i.test(role)) skills.push("github");

  return [...new Set(skills)];
}

// ── MCP Server Inference ─────────────────────────────────────────────────

function inferMCPServers(role: string, resources: string[]): string[] {
  const servers: string[] = [];

  // Database & SQL
  if (/数据库|数据分析|database|sql/i.test(role)) servers.push("mcp-server-sqlite");
  // File system access
  if (/文件|文档|file|doc/i.test(role)) servers.push("@mcp/server-filesystem");
  // Google Sheets
  if (resources.includes("google_sheets")) servers.push("@anthropic/mcp-google-sheets");
  // GitHub integration
  if (/github|代码仓库|仓库|repo/i.test(role) || resources.includes("github")) servers.push("@modelcontextprotocol/server-github");
  // Git operations
  if (/git|版本控制|version.*control/i.test(role)) servers.push("@modelcontextprotocol/server-git");
  // Web search / browsing
  if (/浏览器|爬虫|scrape|browser|crawl/i.test(role)) servers.push("@anthropic/mcp-puppeteer");
  // Notion integration
  if (/notion/i.test(role) || resources.includes("notion")) servers.push("@notionhq/mcp-server-notion");
  // Slack messaging
  if (/slack/i.test(role) || resources.includes("slack")) servers.push("@anthropic/mcp-slack");
  // Memory / knowledge store
  if (/知识库|knowledge.*base|向量|vector|rag/i.test(role)) servers.push("@anthropic/mcp-memory");
  // PDF processing
  if (/pdf|文档解析/i.test(role) || resources.includes("pdf")) servers.push("mcp-server-pdf");
  // Docker / container management
  if (/docker|容器|container/i.test(role)) servers.push("@anthropic/mcp-docker");
  // PostgreSQL
  if (/postgres|pg|关系.*数据/i.test(role)) servers.push("@modelcontextprotocol/server-postgres");
  // Brave search
  if (/搜索引擎|search.*engine/i.test(role)) servers.push("@anthropic/mcp-brave-search");

  return [...new Set(servers)];
}

// ── Memory Search Inference ──────────────────────────────────────────────

function inferMemorySearch(
  role: string,
  ctx: UserContext,
): InferredCapabilities["memorySearch"] {
  const needsMemory =
    /记忆|记录|知识|历史|memory|history|knowledge/i.test(role) ||
    ctx.resources.some(r => ["faq_doc", "database", "notion"].includes(r)) ||
    ctx.scenario === "customer_support";

  return { enabled: needsMemory };
}

// ── Subagents Inference ──────────────────────────────────────────────────

function inferSubagents(role: string): InferredCapabilities["subagents"] | undefined {
  if (/分发|调度|管理|coordinator|dispatch|manager/i.test(role)) {
    return { maxDepth: 1 };
  }
  return undefined;
}

// ── Heartbeat Inference ──────────────────────────────────────────────────

function inferHeartbeat(
  role: string,
  ctx: UserContext,
): InferredCapabilities["heartbeat"] | undefined {
  if (/定时|提醒|定期|cron|schedule|remind/i.test(role) || ctx.scenario === "scheduling") {
    return { every: "24h", activeHours: { start: "09:00", end: "21:00" } };
  }
  return undefined;
}
