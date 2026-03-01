import { matchCapabilitiesToRole, mergeWithStaticInference, MAX_SKILLS_PER_AGENT, MAX_MCP_PER_AGENT } from "./runtime-discovery.js";
const MODEL_CANDIDATES = [
  // cheap tier
  { fullId: "deepseek/deepseek-chat", provider: "deepseek", modelId: "deepseek-chat", contextWindow: 64e3, tier: "cheap", affinities: { general: 8, coding: 7, data_analysis: 7, content: 6 } },
  { fullId: "qwen/qwen-turbo", provider: "qwen", modelId: "qwen-turbo", contextWindow: 131072, tier: "cheap", affinities: { general: 6, content: 7, scheduling: 7 } },
  { fullId: "qwen/qwen-plus", provider: "qwen", modelId: "qwen-plus", contextWindow: 131072, tier: "cheap", affinities: { general: 7, content: 8, research: 6 } },
  { fullId: "zhipu/glm-4-plus", provider: "zhipu", modelId: "glm-4-plus", contextWindow: 128e3, tier: "cheap", affinities: { general: 7, content: 7 } },
  { fullId: "doubao/doubao-seed-1-6-lite-251015", provider: "doubao", modelId: "doubao-seed-1-6-lite-251015", contextWindow: 256e3, tier: "cheap", affinities: { general: 6, scheduling: 7 } },
  // mid tier
  { fullId: "deepseek/deepseek-reasoner", provider: "deepseek", modelId: "deepseek-reasoner", contextWindow: 64e3, tier: "mid", affinities: { coding: 9, data_analysis: 9, research: 8, customer_support: 6 } },
  { fullId: "openai/gpt-4o", provider: "openai", modelId: "gpt-4o", contextWindow: 128e3, tier: "mid", affinities: { general: 9, customer_support: 8, content: 8, research: 8 } },
  { fullId: "anthropic/claude-sonnet-4-5", provider: "anthropic", modelId: "claude-sonnet-4-5", contextWindow: 2e5, tier: "mid", affinities: { coding: 9, research: 9, general: 8 } },
  { fullId: "zhipu/glm-5", provider: "zhipu", modelId: "glm-5", contextWindow: 128e3, tier: "mid", affinities: { general: 8, content: 8, customer_support: 7 } },
  { fullId: "doubao/doubao-seed-1-8-251228", provider: "doubao", modelId: "doubao-seed-1-8-251228", contextWindow: 256e3, tier: "mid", affinities: { general: 8, content: 7 } },
  { fullId: "kimi-coding/kimi-for-coding", provider: "kimi-coding", modelId: "kimi-for-coding", contextWindow: 262144, tier: "mid", affinities: { coding: 8, research: 7 } },
  { fullId: "qwen/qwen-max", provider: "qwen", modelId: "qwen-max", contextWindow: 32e3, tier: "mid", affinities: { general: 8, content: 8, research: 7 } },
  // sota tier
  { fullId: "anthropic/claude-opus-4-6", provider: "anthropic", modelId: "claude-opus-4-6", contextWindow: 2e5, tier: "sota", affinities: { general: 10, coding: 10, research: 10 } },
  { fullId: "openai/o3", provider: "openai", modelId: "o3", contextWindow: 2e5, tier: "sota", affinities: { coding: 10, research: 10, data_analysis: 9 } }
];
const SCENARIO_TOOL_MAP = {
  customer_support: { profile: "messaging", also: ["web_search", "memory_search"] },
  coding: { profile: "coding", also: ["browser"] },
  research: { profile: "full", also: [] },
  content: { profile: "minimal", also: ["web_search", "web_fetch", "image_gen"] },
  data_analysis: { profile: "minimal", also: ["group:fs", "group:runtime"] },
  scheduling: { profile: "minimal", also: ["cron", "message"] },
  finance: { profile: "minimal", also: ["group:fs", "group:memory"] },
  learning: { profile: "minimal", also: ["web_search", "memory_search", "web_fetch"] },
  general: { profile: "minimal", also: ["web_search"] }
};
const SCENARIO_SKILL_MAP = {
  customer_support: ["wechat-cs", "summarize", "self-troubleshoot", "faq-builder"],
  coding: ["coding-agent", "github", "web-researcher", "code-review", "git-helper"],
  news: ["ai-daily-news", "cctv-news", "news-aggregator", "rss-reader", "news-briefing"],
  content: ["xiaohongshu", "summarize", "web-researcher", "seo-helper", "copywriting"],
  data_analysis: ["nano-pdf", "csv-analyzer", "data-viz", "sql-helper"],
  finance: ["nano-pdf", "ledger", "budget-tracker"],
  scheduling: ["oracle", "calendar", "todo-tracker"],
  learning: ["web-researcher", "summarize", "flashcard", "quiz-maker"],
  research: ["web-researcher", "summarize", "nano-pdf", "arxiv-reader"],
  general: ["web-researcher", "summarize"]
};
function inferAgentCapabilities(bp, userCtx, pluginConfig, discoveryResult) {
  const staticSkills = inferSkills(bp.role, userCtx);
  const staticMCP = inferMCPServers(bp.role, userCtx.resources);
  let finalSkills;
  let finalMCP;
  if (discoveryResult && (discoveryResult.skills.length > 0 || discoveryResult.mcpServers.length > 0)) {
    const runtimeMatch = matchCapabilitiesToRole(bp.role, userCtx.scenario, discoveryResult);
    const merged = mergeWithStaticInference(runtimeMatch, staticSkills, staticMCP);
    finalSkills = merged.skills;
    finalMCP = merged.mcpServers;
  } else {
    finalSkills = staticSkills.slice(0, MAX_SKILLS_PER_AGENT);
    finalMCP = staticMCP.slice(0, MAX_MCP_PER_AGENT);
  }
  return {
    model: selectModel(bp.modelTier, userCtx, pluginConfig, bp.role, bp.id),
    tools: inferTools(bp.role, userCtx),
    skills: finalSkills,
    mcpHints: finalMCP,
    memorySearch: inferMemorySearch(bp.role, userCtx),
    identity: { name: bp.name, emoji: bp.emoji },
    subagents: inferSubagents(bp.role),
    heartbeat: inferHeartbeat(bp.role, userCtx)
  };
}
const SIMPLE_ROLE_PATTERNS = /转发|提醒|通知|监控|打卡|签到|forward|remind|notify|monitor|alert|schedule|定时/i;
const COMPLEX_ROLE_PATTERNS = /代码|编程|分析|研究|推理|调研|策划|架构|设计|规划|选型|code|program|analy|research|reason|architect|debug|review|design|plan/i;
const SUPERVISOR_PATTERNS = /supervisor|分发|路由|调度|协调|管理|总管|coordinator|orchestrat|dispatch|manager/i;
function estimateRoleComplexity(role) {
  if (COMPLEX_ROLE_PATTERNS.test(role)) return "complex";
  if (SIMPLE_ROLE_PATTERNS.test(role)) return "simple";
  return "moderate";
}
function isSupervisorRole(role, agentId) {
  if (agentId && /supervisor/i.test(agentId)) return true;
  return SUPERVISOR_PATTERNS.test(role);
}
function selectModel(tier, ctx, pluginConfig, role, agentId) {
  const configured = getConfiguredProviders(pluginConfig);
  const scenario = ctx.scenario || "general";
  let effectiveTier = tier;
  if (ctx.budget === "cheap" && tier === "mid") effectiveTier = "cheap";
  if (ctx.budget === "premium" && tier === "cheap") effectiveTier = "mid";
  if (role && isSupervisorRole(role, agentId)) {
    const userModel = getGlobalTextModel(pluginConfig);
    if (userModel) {
      return { primary: userModel };
    }
    effectiveTier = configured.length > 0 ? "mid" : "sota";
  } else if (role && ctx.budget !== "premium") {
    const complexity = estimateRoleComplexity(role);
    if (complexity === "simple" && effectiveTier !== "cheap") {
      effectiveTier = "cheap";
    }
  }
  let candidates = MODEL_CANDIDATES.filter((m) => m.tier === effectiveTier).filter((m) => configured.length === 0 || configured.includes(m.provider));
  if (candidates.length === 0) {
    candidates = MODEL_CANDIDATES.filter((m) => configured.length === 0 || configured.includes(m.provider));
  }
  if (candidates.length === 0) {
    const globalModel = getGlobalTextModel(pluginConfig);
    if (globalModel) return { primary: globalModel };
    return { primary: MODEL_CANDIDATES[0].fullId };
  }
  const scored = candidates.map((m) => ({
    ...m,
    score: (m.affinities[scenario] ?? 5) + (m.tier === effectiveTier ? 2 : 0)
  })).sort((a, b) => b.score - a.score);
  return {
    primary: scored[0].fullId,
    fallbacks: scored.slice(1, 3).map((m) => m.fullId)
  };
}
function getGlobalTextModel(config) {
  try {
    const agents = config?.agents;
    const defaults = agents?.defaults;
    const model = defaults?.model;
    if (typeof model === "string" && model.includes("/")) return model;
    if (model && typeof model === "object") {
      const primary = model.primary;
      if (typeof primary === "string" && primary.includes("/")) return primary;
    }
  } catch {
  }
  return void 0;
}
function getConfiguredProviders(config) {
  try {
    const models = config?.models;
    let providers = models?.providers;
    if (!providers || typeof providers !== "object") {
      const gateway = config?.gateway;
      providers = gateway?.providers;
    }
    if (!providers || typeof providers !== "object") return [];
    if (Array.isArray(providers)) {
      return providers.map((p) => String(p.id ?? p.name ?? "")).filter(Boolean);
    }
    return Object.keys(providers).filter(Boolean);
  } catch {
    return [];
  }
}
function inferTools(role, ctx) {
  const scenario = ctx.scenario || "general";
  const base = SCENARIO_TOOL_MAP[scenario] ?? SCENARIO_TOOL_MAP.general;
  const also = [...base.also];
  for (const ch of ctx.channels) {
    switch (ch) {
      case "wechat":
        also.push("wechat_send", "wechat_cs");
        break;
      case "dingtalk":
        also.push("dingtalk_send");
        break;
      case "feishu":
        also.push("feishu_send");
        break;
    }
  }
  if (/分发|路由|调度|dispatch/i.test(role)) also.push("sessions_spawn", "sessions_send");
  if (/知识库|检索|查询|knowledge/i.test(role)) also.push("memory_search", "memory_get");
  if (/定时|提醒|定期|cron|remind/i.test(role)) also.push("cron");
  if (/代码|编程|code|program/i.test(role)) also.push("group:fs");
  if (/文件|文档|file|doc/i.test(role)) also.push("group:fs");
  if (/数据|分析|data|analy/i.test(role)) also.push("group:fs", "group:runtime");
  return {
    profile: base.profile,
    alsoAllow: [...new Set(also)]
  };
}
function inferSkills(role, ctx) {
  const scenario = ctx.scenario || "general";
  const roleSkills = [];
  if (/新闻|news/i.test(role)) roleSkills.push("ai-daily-news", "news-briefing");
  if (/小红书|xiaohongshu/i.test(role)) roleSkills.push("xiaohongshu");
  if (/总结|summarize|摘要/i.test(role)) roleSkills.push("summarize");
  if (/代码|code|编程|program/i.test(role)) roleSkills.push("coding-agent");
  if (/翻译|translate|双语/i.test(role)) roleSkills.push("translator");
  if (/搜索|search|调研|research/i.test(role)) roleSkills.push("web-researcher");
  if (/pdf|文档/i.test(role)) roleSkills.push("nano-pdf");
  if (/日程|calendar|日历/i.test(role)) roleSkills.push("calendar");
  if (/客服|support|接待/i.test(role)) roleSkills.push("self-troubleshoot");
  if (/写作|写文|copywrite|文案|撰写|创作/i.test(role)) roleSkills.push("copywriting");
  if (/数据|data|分析|analy|统计|画像/i.test(role)) roleSkills.push("csv-analyzer");
  if (/图片|image|配图|画|封面/i.test(role)) roleSkills.push("image-helper");
  if (/github|仓库|repo/i.test(role)) roleSkills.push("github");
  for (const res of ctx.resources) {
    switch (res) {
      case "pdf":
        roleSkills.push("nano-pdf");
        break;
      case "github":
        roleSkills.push("github");
        break;
      case "notion":
        roleSkills.push("notion");
        break;
    }
  }
  const scenarioSkills = [...SCENARIO_SKILL_MAP[scenario] ?? []];
  const merged = [...roleSkills];
  for (const s of scenarioSkills) {
    if (!merged.includes(s)) merged.push(s);
  }
  return [...new Set(merged)];
}
function inferMCPServers(role, resources) {
  const servers = [];
  if (/数据库|数据分析|database|sql/i.test(role) || resources.includes("database")) servers.push("mcp-server-sqlite");
  if (/文件|文档|file|doc/i.test(role)) servers.push("@mcp/server-filesystem");
  if (resources.includes("google_sheets")) servers.push("@anthropic/mcp-google-sheets");
  if (/github|代码仓库|仓库|repo/i.test(role) || resources.includes("github")) servers.push("@modelcontextprotocol/server-github");
  if (/git|版本控制|version.*control/i.test(role)) servers.push("@modelcontextprotocol/server-git");
  if (/浏览器|爬虫|scrape|browser|crawl/i.test(role)) servers.push("@anthropic/mcp-puppeteer");
  if (/notion/i.test(role) || resources.includes("notion")) servers.push("@notionhq/mcp-server-notion");
  if (/slack/i.test(role) || resources.includes("slack")) servers.push("@anthropic/mcp-slack");
  if (/知识库|knowledge.*base|向量|vector|rag/i.test(role)) servers.push("@anthropic/mcp-memory");
  if (/pdf|文档解析/i.test(role) || resources.includes("pdf")) servers.push("mcp-server-pdf");
  if (/docker|容器|container/i.test(role)) servers.push("@anthropic/mcp-docker");
  if (/postgres|pg|关系.*数据/i.test(role)) servers.push("@modelcontextprotocol/server-postgres");
  if (/搜索引擎|search.*engine/i.test(role)) servers.push("@anthropic/mcp-brave-search");
  return [...new Set(servers)];
}
function inferMemorySearch(role, ctx) {
  const needsMemory = /记忆|记录|知识|历史|memory|history|knowledge/i.test(role) || ctx.resources.some((r) => ["faq_doc", "database", "notion"].includes(r)) || ctx.scenario === "customer_support";
  return { enabled: needsMemory };
}
function inferSubagents(role) {
  if (/分发|调度|管理|coordinator|dispatch|manager/i.test(role)) {
    return { maxDepth: 1 };
  }
  return void 0;
}
function inferHeartbeat(role, ctx) {
  if (/定时|提醒|定期|cron|schedule|remind/i.test(role) || ctx.scenario === "scheduling") {
    return { every: "24h", activeHours: { start: "09:00", end: "21:00" } };
  }
  return void 0;
}
export {
  estimateRoleComplexity,
  inferAgentCapabilities,
  isSupervisorRole
};
