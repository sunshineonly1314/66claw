/**
 * Orchestrator gateway handlers — registered directly in CN handlers
 * so they work even when the orchestrator plugin fails to load via jiti.
 *
 * The template/community data is inlined so no extension imports are needed.
 * For deploy/plans/agents handlers that depend on extension runtime code,
 * the plugin system's handlers (pluginRegistry.gatewayHandlers) take
 * precedence when the plugin loads successfully.
 */

import type { GatewayRequestHandlers } from "./types.js";

// ── Inline Built-in Template Summary (for templates.list) ────────────────
// Only includes the metadata needed by the UI — full template data with
// agent souls/tools is in extensions/orchestrator/src/templates.ts and
// is served by the plugin handler when available.

const BUILTIN_TEMPLATE_SUMMARIES = [
  {
    id: "content-factory",
    name: "自媒体内容工厂",
    description: "热点追踪、文案写作、配图生成，一站式内容产出",
    category: "content",
    emoji: "✍️",
    defaultModelTier: "mid",
    highlights: ["每天自动推送领域热点选题", "写出适合你风格的文案", "自动生成封面图和配图"],
    keywords: [
      "自媒体",
      "内容",
      "创作",
      "文案",
      "小红书",
      "公众号",
      "写作",
      "配图",
      "热点",
      "选题",
      "运营",
      "content",
      "creator",
      "writing",
    ],
    agents: [
      {
        name: "选题雷达",
        id: "topic-radar",
        role: "每天搜索领域热点，筛选并推送选题建议",
        emoji: "📡",
      },
      { name: "文案写手", id: "copywriter", role: "根据选题写出适合平台风格的文案", emoji: "🖊️" },
      { name: "配图助手", id: "image-helper", role: "根据文案生成封面图和配图", emoji: "🎨" },
    ],
  },
  {
    id: "knowledge-cs",
    name: "客服知识库",
    description: "自动应答常见问题、复杂问题转接、服务记录汇总",
    category: "customer_support",
    emoji: "🎧",
    defaultModelTier: "mid",
    highlights: ["7x24 自动回答常见问题", "复杂问题自动转接专家处理", "每天自动汇总服务记录"],
    keywords: [
      "客服",
      "客户",
      "服务",
      "问答",
      "FAQ",
      "知识库",
      "咨询",
      "接待",
      "工单",
      "售前",
      "售后",
      "customer",
      "support",
      "service",
    ],
    agents: [
      {
        name: "接待员",
        id: "receptionist",
        role: "接收用户消息，判断意图，处理常见问答",
        emoji: "👋",
      },
      {
        name: "专家顾问",
        id: "expert-advisor",
        role: "处理复杂咨询，搜索专业资料，提供深度解答",
        emoji: "🧑‍💼",
      },
      {
        name: "工单记录员",
        id: "ticket-logger",
        role: "记录每次服务，生成日报，追踪未解决问题",
        emoji: "📋",
      },
    ],
  },
  {
    id: "coding-team",
    name: "编程助手团",
    description: "代码审查、技术调研、项目管理，独立开发者的AI搭档",
    category: "coding",
    emoji: "💻",
    defaultModelTier: "mid",
    highlights: ["审查代码找 bug 提优化建议", "搜索技术方案对比框架选型", "追踪 TODO 提醒 DDL"],
    keywords: [
      "编程",
      "代码",
      "开发",
      "程序",
      "bug",
      "review",
      "技术",
      "项目",
      "coding",
      "programming",
      "developer",
      "code",
    ],
    agents: [
      {
        name: "代码审查员",
        id: "code-reviewer",
        role: "审查代码质量、发现潜在 bug、提供优化建议",
        emoji: "🔍",
      },
      {
        name: "技术调研员",
        id: "tech-researcher",
        role: "搜索技术方案、对比框架、提供技术决策依据",
        emoji: "🔬",
      },
      {
        name: "项目管理员",
        id: "project-tracker",
        role: "记录 TODO、追踪开发进度、提醒 DDL",
        emoji: "📊",
      },
    ],
  },
  {
    id: "news-intelligence",
    name: "信息情报站",
    description: "定时抓取行业动态，自动筛选去重，推送精华简报",
    category: "research",
    emoji: "📰",
    defaultModelTier: "mid",
    highlights: ["每天定时搜索你关注的领域", "自动过滤重复和低质内容", "整理成简报直接推送给你"],
    keywords: [
      "新闻",
      "情报",
      "资讯",
      "行业",
      "动态",
      "简报",
      "日报",
      "监控",
      "追踪",
      "news",
      "intelligence",
      "briefing",
      "monitor",
    ],
    agents: [
      {
        name: "情报采集员",
        id: "intel-collector",
        role: "定时搜索指定关键词，过滤去重，采集原始信息",
        emoji: "📡",
      },
      {
        name: "简报编辑",
        id: "briefing-editor",
        role: "将原始信息整理成简报，提炼要点，推送给用户",
        emoji: "📝",
      },
    ],
  },
  {
    id: "data-analyst",
    name: "数据分析助手",
    description: "数据清洗、统计分析、趋势报表，让数据说话",
    category: "data_analysis",
    emoji: "📊",
    defaultModelTier: "mid",
    highlights: ["上传 Excel/CSV 自动清洗分析", "生成可视化统计报表", "发现数据异常和趋势"],
    keywords: [
      "数据",
      "分析",
      "报表",
      "统计",
      "Excel",
      "CSV",
      "趋势",
      "可视化",
      "data",
      "analysis",
      "report",
      "chart",
    ],
    agents: [
      {
        name: "数据清洗员",
        id: "data-cleaner",
        role: "读取数据文件，清洗标准化，准备分析用数据集",
        emoji: "🧹",
      },
      {
        name: "分析师",
        id: "data-analyst",
        role: "统计分析、趋势检测、异常发现、生成分析报告",
        emoji: "📈",
      },
    ],
  },
  {
    id: "meeting-assistant",
    name: "会议日程管家",
    description: "日程安排、冲突检测、会议纪要、待办催办",
    category: "scheduling",
    emoji: "📅",
    defaultModelTier: "mid",
    highlights: ["安排会议自动检测时间冲突", "整理会议纪要提取待办事项", "到期任务自动催办提醒"],
    keywords: [
      "会议",
      "日程",
      "日历",
      "安排",
      "提醒",
      "待办",
      "纪要",
      "催办",
      "meeting",
      "schedule",
      "calendar",
      "reminder",
    ],
    agents: [
      {
        name: "日程管家",
        id: "schedule-manager",
        role: "管理日程安排，检测冲突，发送提醒",
        emoji: "🗓️",
      },
      {
        name: "纪要员",
        id: "meeting-noter",
        role: "整理会议纪要，提取行动项，定期催办",
        emoji: "📝",
      },
    ],
  },
  {
    id: "daily-assistant",
    name: "日常生活助手团",
    description: "日程规划、信息查询、备忘提醒、知识整理",
    category: "lifestyle",
    emoji: "🏠",
    defaultModelTier: "mid",
    highlights: ["安排日程设置提醒", "搜索资料整理摘要", "记录想法维护知识库"],
    keywords: ["日常", "生活", "助手", "管家", "日程", "提醒", "备忘", "daily", "assistant"],
    agents: [
      {
        name: "日程管理员",
        id: "scheduler",
        role: "管理用户的日程安排、会议预约、重要日期提醒",
        emoji: "📅",
      },
      {
        name: "信息助理",
        id: "researcher",
        role: "搜索互联网、查询资料、整理信息摘要",
        emoji: "🔍",
      },
      {
        name: "知识整理员",
        id: "note-keeper",
        role: "记录笔记、整理知识、管理个人知识库",
        emoji: "📝",
      },
    ],
  },
  {
    id: "finance-tracker",
    name: "个人财务管理",
    description: "收支记录、预算管理、消费分析、财务提醒",
    category: "finance",
    emoji: "💰",
    defaultModelTier: "mid",
    highlights: ["说一句话就能快速记账", "自动分析消费趋势和异常", "预算快超了自动提醒你"],
    keywords: ["财务", "记账", "收支", "预算", "消费", "理财", "finance", "budget", "accounting"],
    agents: [
      { name: "记账助手", id: "bookkeeper", role: "记录日常收支、分类账目、维护账本", emoji: "📒" },
      {
        name: "财务分析师",
        id: "analyst",
        role: "分析消费趋势、生成财务报表、提供预算建议",
        emoji: "📊",
      },
      {
        name: "预算提醒员",
        id: "budget-alerter",
        role: "监控预算执行、超支预警、定期财务提醒",
        emoji: "⏰",
      },
    ],
  },
  {
    id: "learning-planner",
    name: "学习备考助手团",
    description: "学习计划制定、知识答疑、复习提醒、笔记整理",
    category: "education",
    emoji: "📚",
    defaultModelTier: "mid",
    highlights: ["科学规划学习进度和复习", "随时提问获得详细讲解", "自动整理笔记制作知识卡片"],
    keywords: [
      "学习",
      "教育",
      "课程",
      "复习",
      "知识",
      "考试",
      "备考",
      "learning",
      "study",
      "education",
    ],
    agents: [
      {
        name: "学习规划师",
        id: "study-planner",
        role: "制定学习计划、分配学习时间、跟踪进度",
        emoji: "🎯",
      },
      {
        name: "学习导师",
        id: "tutor",
        role: "回答学科问题、讲解知识点、提供学习资料",
        emoji: "👨‍🏫",
      },
      {
        name: "笔记整理员",
        id: "note-organizer",
        role: "整理学习笔记、制作知识卡片、建立知识图谱",
        emoji: "📋",
      },
    ],
  },
];

// ── Inline Community Templates (fallback) ────────────────────────────────

const COMMUNITY_TEMPLATES_FALLBACK = [
  {
    id: "community-social-crm",
    name: "社群运营助手",
    description: "自动管理微信群、欢迎新成员、定期推送内容日历",
    category: "social",
    author: "社区贡献者",
    downloads: 0,
    agents: [
      { name: "群管家", role: "管理群消息和新成员欢迎" },
      { name: "日历编辑", role: "维护社群内容日历和定期推送" },
    ],
    highlights: ["自动欢迎新成员", "内容日历管理", "违规消息过滤"],
  },
  {
    id: "community-ecommerce-ops",
    name: "电商运营全家桶",
    description: "竞品监控、评论分析、营销文案，一站式电商运营",
    category: "ecommerce",
    author: "社区贡献者",
    downloads: 0,
    agents: [
      { name: "竞品雷达", role: "监控竞品价格和上新动态" },
      { name: "评论分析师", role: "分析买家评论提取改进建议" },
      { name: "文案写手", role: "撰写商品详情和营销文案" },
    ],
    highlights: ["竞品实时监控", "评论情感分析", "爆款文案生成"],
  },
  {
    id: "community-legal-assistant",
    name: "法律文书助手",
    description: "合同审查、法规检索、文书模板，法务工作加速",
    category: "legal",
    author: "社区贡献者",
    downloads: 0,
    agents: [
      { name: "合同审查员", role: "自动检查合同关键条款和风险点" },
      { name: "法规检索", role: "快速查找相关法规和案例" },
    ],
    highlights: ["合同风险检查", "法规智能检索", "文书模板生成"],
  },
];

// ── Simple keyword matching (mirrors extensions/orchestrator/src/templates.ts) ──

function matchTemplateByKeyword(requirement: string) {
  const lowerReq = requirement.toLowerCase();
  let bestMatch: (typeof BUILTIN_TEMPLATE_SUMMARIES)[number] | undefined;
  let bestScore = 0;

  for (const template of BUILTIN_TEMPLATE_SUMMARIES) {
    let score = 0;
    for (const keyword of template.keywords) {
      if (lowerReq.includes(keyword.toLowerCase())) score++;
    }
    if (lowerReq.includes(template.name)) score += 3;
    if (lowerReq.includes(template.id)) score += 2;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = template;
    }
  }

  return bestScore >= 2 ? bestMatch : undefined;
}

// ── Exported Handlers ────────────────────────────────────────────────────

export const orchestratorHandlers: GatewayRequestHandlers = {
  // ── Templates ──────────────────────────────────────────────────────────

  "orchestrator.templates.list": ({ respond }) => {
    respond(true, { templates: BUILTIN_TEMPLATE_SUMMARIES }, undefined);
  },

  "orchestrator.templates.get": ({ params, respond }) => {
    const id = String(params.id ?? "");
    const template = BUILTIN_TEMPLATE_SUMMARIES.find((t) => t.id === id);
    if (!template) {
      respond(false, undefined, { code: "NOT_FOUND", message: `Template "${id}" not found` });
      return;
    }
    respond(true, { template }, undefined);
  },

  "orchestrator.templates.match": ({ params, respond }) => {
    const requirement = String(params.requirement ?? "");
    const template = matchTemplateByKeyword(requirement);
    respond(true, { template: template ?? null }, undefined);
  },

  // ── Community Templates ────────────────────────────────────────────────

  "orchestrator.community.list": async ({ respond }) => {
    try {
      const url = "https://openclawcn.github.io/community-templates/index.json";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const data = (await res.json()) as { templates?: unknown[] };
        if (Array.isArray(data.templates)) {
          respond(true, { templates: data.templates }, undefined);
          return;
        }
      }
    } catch {
      // Remote unavailable — fall through to built-in fallback
    }

    respond(true, { templates: COMMUNITY_TEMPLATES_FALLBACK }, undefined);
  },

  // ── Stub handlers for deploy/plans/agents ──────────────────────────────
  // These are provided so the gateway never returns "unknown method".
  // When the orchestrator plugin loads successfully via the plugin system,
  // pluginRegistry.gatewayHandlers overrides these (higher precedence in
  // server.impl.ts merge order).

  "orchestrator.quick_deploy": ({ respond }) => {
    respond(false, undefined, {
      code: "PLUGIN_NOT_LOADED",
      message: "Orchestrator plugin not loaded. Please restart the application.",
    });
  },

  "orchestrator.guided_propose": ({ respond }) => {
    respond(false, undefined, {
      code: "PLUGIN_NOT_LOADED",
      message: "Orchestrator plugin not loaded. Please restart the application.",
    });
  },

  "orchestrator.guided_deploy": ({ respond }) => {
    respond(false, undefined, {
      code: "PLUGIN_NOT_LOADED",
      message: "Orchestrator plugin not loaded. Please restart the application.",
    });
  },

  "orchestrator.plans.list": ({ respond }) => {
    respond(true, { plans: [] }, undefined);
  },

  "orchestrator.plans.get": ({ respond }) => {
    respond(false, undefined, {
      code: "PLUGIN_NOT_LOADED",
      message: "Orchestrator plugin not loaded. Please restart the application.",
    });
  },

  "orchestrator.deploy.status": ({ respond }) => {
    respond(false, undefined, {
      code: "PLUGIN_NOT_LOADED",
      message: "Orchestrator plugin not loaded. Please restart the application.",
    });
  },

  "orchestrator.deploy.report": ({ respond }) => {
    respond(false, undefined, {
      code: "PLUGIN_NOT_LOADED",
      message: "Orchestrator plugin not loaded. Please restart the application.",
    });
  },

  "orchestrator.deploy.validate": ({ respond }) => {
    respond(false, undefined, {
      code: "PLUGIN_NOT_LOADED",
      message: "Orchestrator plugin not loaded. Please restart the application.",
    });
  },

  "orchestrator.agents.list": ({ respond }) => {
    respond(true, { agents: [] }, undefined);
  },
};
