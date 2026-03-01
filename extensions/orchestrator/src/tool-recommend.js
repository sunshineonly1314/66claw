const INTENT_PATTERNS = [
  {
    keywords: [
      "\u641C\u7D22",
      "\u67E5\u8BE2",
      "\u67E5\u627E",
      "\u4FE1\u606F",
      "\u8D44\u6599",
      "\u8C03\u7814",
      "search",
      "query",
      "research",
      "internet",
      "web"
    ],
    toolGroups: ["group:web"],
    skills: ["web-researcher"]
  },
  {
    keywords: [
      "\u65B0\u95FB",
      "\u8D44\u8BAF",
      "\u70ED\u70B9",
      "\u60C5\u62A5",
      "\u7B80\u62A5",
      "news",
      "briefing",
      "intelligence",
      "trending"
    ],
    toolGroups: ["group:web"],
    skills: ["ai-daily-news", "news-briefing", "web-researcher"]
  },
  {
    keywords: [
      "\u6587\u4EF6",
      "\u8BFB\u53D6",
      "\u5199\u5165",
      "\u4FDD\u5B58",
      "\u4E0B\u8F7D",
      "file",
      "read",
      "write",
      "save",
      "download",
      "fs",
      "storage"
    ],
    toolGroups: ["group:fs"]
  },
  {
    keywords: [
      "\u8BB0\u5FC6",
      "\u8BB0\u5F55",
      "\u7B14\u8BB0",
      "\u5907\u5FD8",
      "\u77E5\u8BC6",
      "memory",
      "note",
      "remember",
      "knowledge"
    ],
    toolGroups: ["group:memory"],
    skills: ["summarize"]
  },
  {
    keywords: [
      "\u65E5\u7A0B",
      "\u65E5\u5386",
      "\u63D0\u9192",
      "\u9884\u7EA6",
      "\u4F1A\u8BAE",
      "schedule",
      "calendar",
      "remind",
      "appointment",
      "meeting"
    ],
    toolGroups: ["group:memory"],
    tools: ["cron", "message"],
    skills: ["calendar"]
  },
  {
    keywords: [
      "\u4EE3\u7801",
      "\u7F16\u7A0B",
      "\u5F00\u53D1",
      "\u7F16\u8BD1",
      "\u8C03\u8BD5",
      "code",
      "program",
      "develop",
      "compile",
      "debug",
      "git"
    ],
    toolGroups: ["group:fs", "group:web", "group:runtime"],
    skills: ["coding-agent", "github"]
  },
  {
    keywords: [
      "\u6D4F\u89C8\u5668",
      "\u7F51\u9875",
      "\u622A\u56FE",
      "browser",
      "webpage",
      "screenshot",
      "scrape"
    ],
    toolGroups: ["group:web"],
    tools: ["browser"]
  },
  {
    keywords: [
      "\u90AE\u4EF6",
      "\u6D88\u606F",
      "\u901A\u77E5",
      "\u53D1\u9001",
      "email",
      "message",
      "notify",
      "send",
      "alert"
    ],
    toolGroups: ["group:memory"],
    tools: ["cron", "message"]
  },
  {
    keywords: [
      "\u6570\u636E",
      "\u5206\u6790",
      "\u7EDF\u8BA1",
      "\u62A5\u8868",
      "\u56FE\u8868",
      "data",
      "analyze",
      "statistics",
      "report",
      "chart"
    ],
    toolGroups: ["group:fs", "group:web", "group:memory"],
    skills: ["nano-pdf", "summarize"]
  },
  {
    keywords: [
      "\u8868\u683C",
      "excel",
      "csv",
      "spreadsheet",
      "sheets"
    ],
    toolGroups: ["group:fs"],
    mcpServers: ["@anthropic/mcp-google-sheets"]
  },
  {
    keywords: [
      "\u56FE\u7247",
      "\u56FE\u50CF",
      "\u753B",
      "\u8BBE\u8BA1",
      "image",
      "picture",
      "draw",
      "design",
      "photo",
      "\u914D\u56FE",
      "\u5C01\u9762",
      "\u751F\u6210\u56FE"
    ],
    toolGroups: ["group:web"],
    tools: ["image_gen", "image_edit"],
    skills: ["openai-image-gen"]
  },
  {
    keywords: [
      "\u5BA2\u670D",
      "\u5BA2\u6237",
      "\u670D\u52A1",
      "\u95EE\u7B54",
      "faq",
      "\u54A8\u8BE2",
      "support",
      "customer",
      "service",
      "helpdesk"
    ],
    toolGroups: ["group:fs", "group:memory"],
    tools: ["message"],
    skills: ["self-troubleshoot", "summarize"]
  },
  {
    keywords: [
      "pdf",
      "\u6587\u6863",
      "\u8BBA\u6587",
      "paper",
      "document"
    ],
    toolGroups: ["group:fs"],
    skills: ["nano-pdf"]
  },
  {
    keywords: [
      "\u5C0F\u7EA2\u4E66",
      "\u516C\u4F17\u53F7",
      "\u81EA\u5A92\u4F53",
      "\u5185\u5BB9",
      "\u521B\u4F5C",
      "\u6587\u6848",
      "xiaohongshu",
      "content",
      "creator",
      "copywrite"
    ],
    toolGroups: ["group:web", "group:memory"],
    skills: ["xiaohongshu", "summarize"]
  },
  {
    keywords: [
      "\u603B\u7ED3",
      "\u6458\u8981",
      "\u5F52\u7EB3",
      "\u6574\u7406",
      "summarize",
      "summary",
      "digest"
    ],
    toolGroups: ["group:memory"],
    skills: ["summarize"]
  },
  {
    keywords: [
      "\u8D22\u52A1",
      "\u8BB0\u8D26",
      "\u9884\u7B97",
      "\u6536\u652F",
      "finance",
      "budget",
      "accounting",
      "ledger"
    ],
    toolGroups: ["group:fs", "group:memory"],
    skills: ["nano-pdf"]
  },
  {
    keywords: [
      "\u5B66\u4E60",
      "\u6559\u80B2",
      "\u8BFE\u7A0B",
      "\u590D\u4E60",
      "\u8003\u8BD5",
      "\u5907\u8003",
      "learning",
      "study",
      "education",
      "exam"
    ],
    toolGroups: ["group:web", "group:memory"],
    skills: ["web-researcher", "summarize"]
  },
  {
    keywords: [
      "github",
      "\u4ED3\u5E93",
      "repo",
      "pr",
      "issue",
      "pull request"
    ],
    toolGroups: ["group:fs", "group:web"],
    skills: ["github"],
    mcpServers: ["@modelcontextprotocol/server-github"]
  }
];
function recommendToolsForRole(role, agentName) {
  const text = `${agentName ?? ""} ${role}`.toLowerCase();
  const allowGroups = /* @__PURE__ */ new Set();
  const allowTools = /* @__PURE__ */ new Set();
  const skills = /* @__PURE__ */ new Set();
  const mcpServers = /* @__PURE__ */ new Set();
  for (const pattern of INTENT_PATTERNS) {
    const matched = pattern.keywords.some((kw) => text.includes(kw));
    if (matched) {
      for (const group of pattern.toolGroups) allowGroups.add(group);
      for (const tool of pattern.tools ?? []) allowTools.add(tool);
      for (const skill of pattern.skills ?? []) skills.add(skill);
      for (const mcp of pattern.mcpServers ?? []) mcpServers.add(mcp);
    }
  }
  allowGroups.add("group:memory");
  const allow = [...allowGroups, ...allowTools];
  return {
    allow: allow.length > 0 ? allow : void 0,
    profile: "minimal",
    skills: skills.size > 0 ? [...skills] : void 0,
    mcpServers: mcpServers.size > 0 ? [...mcpServers] : void 0
  };
}
function mergeToolRecommendations(template, autoDetected) {
  const allow = /* @__PURE__ */ new Set([
    ...template.allow ?? [],
    ...autoDetected.allow ?? []
  ]);
  const skills = /* @__PURE__ */ new Set([
    ...template.skills ?? [],
    ...autoDetected.skills ?? []
  ]);
  const mcpServers = /* @__PURE__ */ new Set([
    ...template.mcpServers ?? [],
    ...autoDetected.mcpServers ?? []
  ]);
  return {
    allow: allow.size > 0 ? [...allow] : void 0,
    deny: template.deny ?? autoDetected.deny,
    profile: template.profile ?? autoDetected.profile,
    skills: skills.size > 0 ? [...skills] : void 0,
    mcpServers: mcpServers.size > 0 ? [...mcpServers] : void 0
  };
}
function estimateToolTokens(recommendation) {
  const groupCount = (recommendation.allow ?? []).filter((t) => t.startsWith("group:")).length;
  const toolCount = (recommendation.allow ?? []).filter((t) => !t.startsWith("group:")).length;
  const skillCount = (recommendation.skills ?? []).length;
  return 2e3 + groupCount * 800 + toolCount * 200 + skillCount * 400;
}
export {
  estimateToolTokens,
  mergeToolRecommendations,
  recommendToolsForRole
};
