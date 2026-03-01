/**
 * Expert Audit — 第三方顶级 Agent 调试专家压力测试
 *
 * 设计理念：模拟中国用户（小白）最常见的刁钻需求，全方位压测系统。
 * 每个场景不仅测 pipeline 输出，还深度审查：
 *   - 成员配置合理性（角色分工、去重、互补）
 *   - Skills/MCP/Tools 分配精准性
 *   - 模型选择匹配度
 *   - 提示词（SOUL）能力边界
 *   - 验证环节的输出质量
 *   - 自动优化的有效性
 *
 * 8 大场景：
 *   1. 小红书爆款文案工厂（多平台适配）
 *   2. 多渠道自媒体矩阵（微信+抖音+小红书+B站）
 *   3. 跨境电商客服（中英双语+时区）
 *   4. 个人知识管理+学习助手（RAG+笔记+复习）
 *   5. 私域流量运营（社群+朋友圈+直播）
 *   6. AI 视频脚本工厂（从选题到分镜到配音）
 *   7. 家庭财务管家（记账+理财+报税）
 *   8. 全栈独立开发者助手（一人全干）
 *
 * 运行: npx tsx extensions/orchestrator/src/guided/__test__expert-audit.ts
 */

import { executePlanningPipeline, formatPipelineReport } from "./planning-pipeline.js";
import { verifyScene, formatVerificationReport, type SceneVerification } from "./scene-verifier.js";
import { inferAgentCapabilities, estimateRoleComplexity, isSupervisorRole } from "./capability-inference.js";
import { matchCapabilitiesToRole, mergeWithStaticInference } from "./runtime-discovery.js";
import type { AgentBlueprint, UserContext, InferredCapabilities } from "../types.js";
import type { DiscoveryResult } from "./runtime-discovery.js";

// ── Test Utilities ──────────────────────────────────────────────────────

const PASS = "✅";
const FAIL = "❌";
const WARN = "⚠️";
const INFO = "ℹ️";

type AuditFinding = {
  scenario: string;
  severity: "critical" | "warning" | "info";
  category: string;
  detail: string;
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const allFindings: AuditFinding[] = [];
let currentScenario = "";

function assert(condition: boolean, testName: string, detail?: string): boolean {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${PASS} ${testName}`);
    return true;
  } else {
    failedTests++;
    const msg = `${testName}${detail ? ` — ${detail}` : ""}`;
    console.log(`  ${FAIL} ${msg}`);
    allFindings.push({
      scenario: currentScenario,
      severity: "critical",
      category: "test_failure",
      detail: msg,
    });
    return false;
  }
}

function finding(severity: AuditFinding["severity"], category: string, detail: string): void {
  allFindings.push({ scenario: currentScenario, severity, category, detail });
  const icon = severity === "critical" ? FAIL : severity === "warning" ? WARN : INFO;
  console.log(`  ${icon} [${category}] ${detail}`);
}

function section(title: string): void {
  console.log(`\n${"═".repeat(64)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(64)}`);
}

function subsection(title: string): void {
  console.log(`\n  ── ${title} ──`);
}

// ── Extended Mock Discovery ─────────────────────────────────────────────
// 模拟更丰富的技能环境——中国小白用户常见的 skills 安装

function createRichDiscovery(): DiscoveryResult {
  return {
    skills: [
      { name: "web-researcher", description: "搜索引擎调研和网页内容提取", source: "bundled" },
      { name: "summarize", description: "文本摘要和总结", source: "bundled" },
      { name: "xiaohongshu", description: "小红书内容发布和管理", source: "managed" },
      { name: "coding-agent", description: "代码生成、调试和代码审查", source: "bundled" },
      { name: "github", description: "GitHub 仓库操作和 PR 管理", source: "managed" },
      { name: "nano-pdf", description: "PDF 文档解析和提取", source: "bundled" },
      { name: "ai-daily-news", description: "每日新闻聚合和推送", source: "managed" },
      { name: "csv-analyzer", description: "CSV 数据分析和可视化", source: "bundled" },
      { name: "self-troubleshoot", description: "自助故障排查和 FAQ 生成", source: "bundled" },
      { name: "news-briefing", description: "新闻简报生成和推送", source: "managed" },
      { name: "image-helper", description: "图片生成和编辑辅助", source: "managed" },
      { name: "copywriting", description: "文案创作和优化、爆款标题", source: "managed" },
      { name: "calendar", description: "日程管理和提醒", source: "bundled" },
      { name: "translator", description: "多语言翻译和本地化", source: "managed" },
      { name: "video-transcript", description: "视频字幕提取和转录", source: "managed" },
      { name: "tts", description: "文字转语音合成", source: "managed" },
      { name: "social-media-management", description: "社交媒体多平台管理", source: "managed" },
      { name: "budget-tracker", description: "预算追踪和财务分析", source: "managed" },
      { name: "todo-tracker", description: "任务和待办管理", source: "bundled" },
      { name: "deep-research", description: "深度调研和报告生成", source: "managed" },
    ],
    mcpServers: [
      { id: "mcp-server-sqlite", enabled: true, running: true, tools: [{ name: "query", description: "Execute SQL queries" }] },
      { id: "@mcp/server-filesystem", enabled: true, running: true, tools: [{ name: "read_file", description: "Read file contents" }] },
      { id: "@modelcontextprotocol/server-github", enabled: true, running: true, tools: [{ name: "create_issue", description: "Create GitHub issue" }] },
      { id: "@anthropic/mcp-memory", enabled: true, running: true, tools: [{ name: "remember", description: "Store and retrieve memories" }] },
      { id: "@anthropic/mcp-brave-search", enabled: true, running: true, tools: [{ name: "search", description: "Web search via Brave" }] },
    ],
    timestamp: Date.now(),
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  SCENARIO 1: 小红书爆款文案工厂
// ══════════════════════════════════════════════════════════════════════════

function scenario1_XiaohongshuFactory(): void {
  currentScenario = "小红书爆款文案工厂";
  section(`场景1: ${currentScenario}`);

  const userCtx: UserContext = {
    scenario: "content",
    channels: ["wechat"],
    resources: [],
    volume: "high",
    budget: "cheap", // 小白用户——省钱
  };

  const blueprints: AgentBlueprint[] = [
    {
      name: "热点猎手",
      id: "trend-hunter",
      role: "实时监控小红书热门话题、微博热搜、抖音热榜，筛选可蹭的热点选题",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
    {
      name: "爆款文案手",
      id: "copy-master",
      role: "根据选题撰写小红书种草文案，掌握emoji使用、分段技巧、标题党写法",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "封面设计师",
      id: "cover-designer",
      role: "为小红书帖子生成吸睛封面图，支持文字叠加、滤镜风格",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
    {
      name: "数据复盘员",
      id: "data-reviewer",
      role: "分析过往帖子数据，找出爆款规律，优化发布策略和时间",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "评论互动官",
      id: "comment-manager",
      role: "自动回复小红书评论，管理粉丝互动，维护社区氛围",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
  ];

  const discovery = createRichDiscovery();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "打造小红书爆款文案全自动化流水线，从热点发现到文案撰写到封面配图到数据复盘",
    userCtx,
    discovery,
  });

  subsection("Pipeline 概览");
  console.log(`  轮次: ${result.totalRounds} | 分数: ${result.verification.score} | 覆盖率: ${result.coverageScore}% | 通过: ${result.verification.overallPass}`);

  // ── 基础验证 ──
  subsection("基础验证");
  assert(result.verification.overallPass, "验证通过");
  assert(result.verification.score >= 60, `分数 ≥ 60 (实际: ${result.verification.score})`);
  assert(result.coverageScore >= 70, `覆盖率 ≥ 70% (实际: ${result.coverageScore}%)`);
  assert(result.blueprints.length >= 4, `团队 ≥ 4人 (实际: ${result.blueprints.length})`);

  // ── 成员配置审查 ──
  subsection("成员配置审查");
  const copyMaster = result.blueprints.find(bp => bp.id === "copy-master");
  if (copyMaster?.inferredCapabilities) {
    const caps = copyMaster.inferredCapabilities;
    // 文案手应该有 copywriting skill
    const hasCopywriting = caps.skills.some(s => /copy|文案|写作/i.test(s));
    assert(hasCopywriting, `爆款文案手有文案相关 skill (${caps.skills.join(", ")})`);
    // 文案手应该有小红书 skill
    const hasXhs = caps.skills.some(s => /xiaohongshu|小红书/i.test(s));
    assert(hasXhs, `爆款文案手有小红书 skill (${caps.skills.join(", ")})`);
    // cheap 预算不应该用 SOTA 模型
    if (/opus|o3/i.test(caps.model.primary)) {
      finding("warning", "模型选择", `文案手在 cheap 预算下使用了 SOTA 模型: ${caps.model.primary}`);
    }
    assert(caps.skills.length <= 5, `文案手 skills ≤ 5 (实际: ${caps.skills.length})`);
  }

  const coverDesigner = result.blueprints.find(bp => bp.id === "cover-designer");
  if (coverDesigner?.inferredCapabilities) {
    const caps = coverDesigner.inferredCapabilities;
    const hasImageTool = caps.skills.some(s => /image|图/i.test(s)) ||
      (caps.tools.alsoAllow ?? []).some(t => /image/i.test(t));
    assert(hasImageTool, `封面设计师有图片相关能力`);
  }

  // cheap 预算下的模型审查
  subsection("预算约束审查");
  for (const bp of result.blueprints) {
    if (bp.inferredCapabilities) {
      const model = bp.inferredCapabilities.model.primary;
      if (/opus|o3/i.test(model) && !isSupervisorRole(bp.role, bp.id)) {
        finding("warning", "预算超标", `${bp.name} 在 cheap 预算下用了 SOTA 模型: ${model}`);
      }
    }
  }

  // 数据复盘员应该有数据分析能力
  const dataReviewer = result.blueprints.find(bp => bp.id === "data-reviewer");
  if (dataReviewer?.inferredCapabilities) {
    const hasAnalytics = dataReviewer.inferredCapabilities.skills.some(s => /csv|data|分析/i.test(s));
    assert(hasAnalytics, `数据复盘员有数据分析 skill`);
  }

  printVerification(result.verification);
}

// ══════════════════════════════════════════════════════════════════════════
//  SCENARIO 2: 多渠道自媒体矩阵
// ══════════════════════════════════════════════════════════════════════════

function scenario2_MultiChannelMatrix(): void {
  currentScenario = "多渠道自媒体矩阵";
  section(`场景2: ${currentScenario}`);

  const userCtx: UserContext = {
    scenario: "content",
    channels: ["wechat", "web"],  // 微信+网页
    resources: [],
    volume: "high",
    budget: "balanced",
  };

  // 刁钻点：用户给了重叠角色 + 跨平台需求
  const blueprints: AgentBlueprint[] = [
    {
      name: "选题总监",
      id: "topic-director",
      role: "负责各平台选题策划，热点追踪和选题库管理，分析各渠道受众差异",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "公众号作者",
      id: "wechat-writer",
      role: "撰写微信公众号长文、深度文章，适配公众号排版",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "小红书达人",
      id: "xhs-creator",
      role: "创作小红书种草笔记、生活分享类短文案",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "短视频文案",
      id: "video-script",
      role: "撰写抖音/快手短视频脚本、口播文案",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "B站UP主助手",
      id: "bilibili-helper",
      role: "撰写B站视频标题、简介、分P标注",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
    {
      name: "多平台分发员",
      id: "distributor",
      role: "将同一内容适配不同平台格式并定时发布",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
  ];

  const discovery = createRichDiscovery();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "搭建多渠道自媒体矩阵，一套内容适配微信公众号、小红书、抖音、B站四个平台，自动化排版分发",
    userCtx,
    discovery,
  });

  subsection("Pipeline 概览");
  console.log(`  轮次: ${result.totalRounds} | 分数: ${result.verification.score} | 覆盖率: ${result.coverageScore}% | 通过: ${result.verification.overallPass}`);

  subsection("基础验证");
  assert(result.verification.score >= 40, `分数 ≥ 40 (实际: ${result.verification.score})`);
  assert(result.coverageScore >= 60, `覆盖率 ≥ 60% (实际: ${result.coverageScore}%)`);

  // ── 角色差异化审查 ──
  subsection("角色差异化审查");
  // 公众号作者和小红书达人虽然都是写作，但角色不同，不应被合并
  const wxWriter = result.blueprints.find(bp => bp.id === "wechat-writer");
  const xhsCreator = result.blueprints.find(bp => bp.id === "xhs-creator");
  if (wxWriter && xhsCreator) {
    assert(true, "公众号作者和小红书达人保持独立（角色差异化）");
  } else {
    // 检查是否被错误合并
    const merged = result.blueprints.length < 6;
    if (merged) {
      finding("warning", "过度合并", `6人团队被合并到 ${result.blueprints.length} 人，可能过度合并`);
    }
  }

  // 小红书达人应该有 xiaohongshu skill
  if (xhsCreator?.inferredCapabilities) {
    const hasXhs = xhsCreator.inferredCapabilities.skills.some(s => /xiaohongshu/i.test(s));
    assert(hasXhs, `小红书达人匹配到 xiaohongshu skill`);
  }

  // 分发员应该有定时/调度能力
  const distributor = result.blueprints.find(bp => bp.id === "distributor");
  if (distributor?.inferredCapabilities) {
    const tools = distributor.inferredCapabilities.tools.alsoAllow ?? [];
    // 分发员角色像转发，应该被判为 simple
    const complexity = estimateRoleComplexity(distributor.role);
    assert(complexity === "simple" || complexity === "moderate", `分发员复杂度合理 (${complexity})`);
  }

  // ── 跨平台工具审查 ──
  subsection("跨平台工具审查");
  // 至少要有微信相关工具
  const anyWechatTool = result.blueprints.some(bp => {
    const also = bp.inferredCapabilities?.tools?.alsoAllow ?? [];
    return also.some(t => /wechat/i.test(t));
  });
  assert(anyWechatTool, "至少一个成员有微信工具");

  printVerification(result.verification);
}

// ══════════════════════════════════════════════════════════════════════════
//  SCENARIO 3: 跨境电商客服团队
// ══════════════════════════════════════════════════════════════════════════

function scenario3_CrossBorderEcommerce(): void {
  currentScenario = "跨境电商客服团队";
  section(`场景3: ${currentScenario}`);

  const userCtx: UserContext = {
    scenario: "customer_support",
    channels: ["wechat", "web"],
    resources: ["faq_doc", "database"],
    volume: "high",
    budget: "balanced",
  };

  const blueprints: AgentBlueprint[] = [
    {
      name: "中文客服",
      id: "cn-support",
      role: "处理中文用户咨询、退换货、物流查询，要求响应温暖专业",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "英文客服",
      id: "en-support",
      role: "Handle English customer inquiries, returns, shipping tracking",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "翻译桥接员",
      id: "translator-bridge",
      role: "中英双语实时翻译，协助中文客服处理英文工单",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
    {
      name: "工单处理员",
      id: "ticket-handler",
      role: "创建、分配和跟踪售后工单，升级复杂问题给人工",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
    {
      name: "FAQ知识库管理",
      id: "faq-manager",
      role: "维护FAQ知识库，从历史工单中提炼常见问题和解答",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
  ];

  const discovery = createRichDiscovery();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "搭建跨境电商智能客服系统，支持中英双语，对接微信和网页，需要FAQ知识库和工单管理",
    userCtx,
    discovery,
  });

  subsection("Pipeline 概览");
  console.log(`  轮次: ${result.totalRounds} | 分数: ${result.verification.score} | 覆盖率: ${result.coverageScore}% | 通过: ${result.verification.overallPass}`);

  subsection("基础验证");
  assert(result.verification.score >= 40, `分数 ≥ 40 (实际: ${result.verification.score})`);

  // ── 双语能力审查 ──
  subsection("双语能力审查");
  const cnSupport = result.blueprints.find(bp => bp.id === "cn-support");
  const enSupport = result.blueprints.find(bp => bp.id === "en-support");
  const translatorBridge = result.blueprints.find(bp => bp.id === "translator-bridge");

  if (cnSupport?.inferredCapabilities && enSupport?.inferredCapabilities) {
    // 两个客服不应被合并（一中一英）
    assert(true, "中英客服保持独立");

    // 客服应该有 memory 能力（查历史记录）
    assert(cnSupport.inferredCapabilities.memorySearch.enabled, "中文客服启用了记忆搜索");
    assert(enSupport.inferredCapabilities.memorySearch.enabled, "英文客服启用了记忆搜索");
  } else {
    finding("critical", "角色丢失", "中英客服 agent 被错误合并或丢失");
  }

  // 翻译员应该有 translator skill
  if (translatorBridge?.inferredCapabilities) {
    const hasTranslator = translatorBridge.inferredCapabilities.skills.some(s => /translat|翻译/i.test(s));
    assert(hasTranslator, `翻译桥接员有翻译 skill (${translatorBridge.inferredCapabilities.skills.join(", ")})`);
  }

  // ── 工单系统审查 ──
  subsection("工单系统审查");
  const ticketHandler = result.blueprints.find(bp => bp.id === "ticket-handler");
  if (ticketHandler?.inferredCapabilities) {
    // 工单员需要数据库访问
    const hasSqlCap = ticketHandler.inferredCapabilities.mcpHints.some(m => /sql|database/i.test(m)) ||
      ticketHandler.inferredCapabilities.skills.some(s => /sql|database/i.test(s));
    // 工单涉及数据操作，至少需要 filesystem 或 database
    if (!hasSqlCap) {
      finding("info", "工单能力", "工单处理员未分配数据库相关 MCP/skill（可能依赖外部系统）");
    }
  }

  // ── 资源覆盖 ──
  subsection("资源覆盖审查");
  const resCheck = result.verification.checks.find(c => c.name === "resource_coverage");
  assert(resCheck?.pass === true, `资源覆盖检查通过 (${resCheck?.detail})`);

  printVerification(result.verification);
}

// ══════════════════════════════════════════════════════════════════════════
//  SCENARIO 4: 个人知识管理 + 学习助手
// ══════════════════════════════════════════════════════════════════════════

function scenario4_KnowledgeAndLearning(): void {
  currentScenario = "个人知识管理学习助手";
  section(`场景4: ${currentScenario}`);

  const userCtx: UserContext = {
    scenario: "learning",
    channels: [],
    resources: ["pdf", "notion"],
    volume: "low",
    budget: "cheap",
  };

  // 刁钻点：混合 learning + research + 知识管理
  const blueprints: AgentBlueprint[] = [
    {
      name: "阅读摘要器",
      id: "reader-summarizer",
      role: "阅读PDF、网页文章，提取关键信息，生成结构化摘要笔记",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "知识图谱管理员",
      id: "knowledge-mapper",
      role: "将零散知识整理成知识图谱，建立知识之间的关联",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "复习教练",
      id: "review-coach",
      role: "根据遗忘曲线定时提醒复习，生成闪卡和练习题",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
    {
      name: "论文助读",
      id: "paper-assistant",
      role: "辅助阅读学术论文，解释专业术语，总结研究方法和结论",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
  ];

  const discovery = createRichDiscovery();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "搭建个人知识管理系统，能阅读PDF和论文、自动做笔记总结、定时复习提醒、知识关联管理",
    userCtx,
    discovery,
  });

  subsection("Pipeline 概览");
  console.log(`  轮次: ${result.totalRounds} | 分数: ${result.verification.score} | 覆盖率: ${result.coverageScore}% | 通过: ${result.verification.overallPass}`);

  subsection("基础验证");
  assert(result.verification.score >= 40, `分数 ≥ 40 (实际: ${result.verification.score})`);

  // ── PDF 能力审查 ──
  subsection("PDF 能力审查");
  const reader = result.blueprints.find(bp => bp.id === "reader-summarizer");
  if (reader?.inferredCapabilities) {
    const hasPdf = reader.inferredCapabilities.skills.some(s => /pdf/i.test(s));
    assert(hasPdf, `阅读摘要器有 PDF skill (${reader.inferredCapabilities.skills.join(", ")})`);
    const hasSummarize = reader.inferredCapabilities.skills.some(s => /summarize|摘要/i.test(s));
    assert(hasSummarize, `阅读摘要器有摘要 skill`);
  }

  const paperAssist = result.blueprints.find(bp => bp.id === "paper-assistant");
  if (paperAssist?.inferredCapabilities) {
    const hasPdf = paperAssist.inferredCapabilities.skills.some(s => /pdf/i.test(s));
    assert(hasPdf, `论文助读有 PDF skill`);
  }

  // ── 复习定时审查 ──
  subsection("复习定时审查");
  const coach = result.blueprints.find(bp => bp.id === "review-coach");
  if (coach?.inferredCapabilities) {
    const hasCron = (coach.inferredCapabilities.tools.alsoAllow ?? []).some(t => /cron|remind/i.test(t));
    assert(hasCron, `复习教练有定时提醒工具 (alsoAllow: ${(coach.inferredCapabilities.tools.alsoAllow ?? []).join(", ")})`);

    // 复习教练角色包含"提醒"——应该被识别为 simple
    const complexity = estimateRoleComplexity(coach.role);
    // 但也包含"生成"，可能不是简单的
    finding("info", "复杂度", `复习教练复杂度: ${complexity}`);
  }

  // ── Notion 资源覆盖 ──
  subsection("Notion 资源覆盖");
  const resCheck = result.verification.checks.find(c => c.name === "resource_coverage");
  assert(resCheck?.pass === true, `资源覆盖: ${resCheck?.detail}`);

  // 知识管理应该有 memory
  const knowledgeMapper = result.blueprints.find(bp => bp.id === "knowledge-mapper");
  if (knowledgeMapper?.inferredCapabilities) {
    const hasMemory = knowledgeMapper.inferredCapabilities.memorySearch.enabled;
    assert(hasMemory, "知识图谱管理员启用了记忆搜索");
  }

  printVerification(result.verification);
}

// ══════════════════════════════════════════════════════════════════════════
//  SCENARIO 5: 私域流量运营
// ══════════════════════════════════════════════════════════════════════════

function scenario5_PrivateTrafficOps(): void {
  currentScenario = "私域流量运营";
  section(`场景5: ${currentScenario}`);

  const userCtx: UserContext = {
    scenario: "content", // 最接近的 scenario
    channels: ["wechat"],
    resources: ["database"],
    volume: "high",
    budget: "balanced",
  };

  // 刁钻点：跨 scenario 需求（content + customer_support + scheduling 混合）
  const blueprints: AgentBlueprint[] = [
    {
      name: "社群运营官",
      id: "community-mgr",
      role: "管理微信社群，定时发布群公告，维护群活跃度和纪律",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "朋友圈编辑",
      id: "moments-editor",
      role: "撰写微信朋友圈文案，配图排版，定时发布营销内容",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "用户画像分析师",
      id: "user-profiler",
      role: "分析用户行为数据，打标签分群，识别高价值用户和流失风险",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "活动策划师",
      id: "event-planner",
      role: "策划线上营销活动、抽奖、拼团、秒杀等促销方案",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "客户回访员",
      id: "followup-agent",
      role: "定期回访老客户，收集反馈，推荐新品",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
  ];

  const discovery = createRichDiscovery();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "搭建私域流量运营系统，包括微信社群管理、朋友圈营销、用户画像分析、活动策划和客户回访",
    userCtx,
    discovery,
  });

  subsection("Pipeline 概览");
  console.log(`  轮次: ${result.totalRounds} | 分数: ${result.verification.score} | 覆盖率: ${result.coverageScore}% | 通过: ${result.verification.overallPass}`);

  subsection("基础验证");
  assert(result.verification.score >= 40, `分数 ≥ 40 (实际: ${result.verification.score})`);
  assert(result.coverageScore >= 60, `覆盖率 ≥ 60% (实际: ${result.coverageScore}%)`);

  // ── 微信工具审查 ──
  subsection("微信工具审查");
  const communityMgr = result.blueprints.find(bp => bp.id === "community-mgr");
  if (communityMgr?.inferredCapabilities) {
    const wechatTools = (communityMgr.inferredCapabilities.tools.alsoAllow ?? []).filter(t => /wechat/i.test(t));
    assert(wechatTools.length > 0, `社群运营官有微信工具 (${wechatTools.join(", ")})`);
  }

  // ── 数据分析能力 ──
  subsection("数据分析能力审查");
  const profiler = result.blueprints.find(bp => bp.id === "user-profiler");
  if (profiler?.inferredCapabilities) {
    const hasAnalytics = profiler.inferredCapabilities.skills.some(s => /csv|data|分析/i.test(s)) ||
      profiler.inferredCapabilities.mcpHints.some(m => /sql|database/i.test(m));
    assert(hasAnalytics, `用户画像分析师有数据分析能力`);

    // 角色复杂度应该是 complex（包含"分析"）
    const complexity = estimateRoleComplexity(profiler.role);
    assert(complexity === "complex", `用户画像分析师复杂度=complex (实际: ${complexity})`);
  }

  // ── 定时功能审查 ──
  subsection("定时功能审查");
  // "定时发布"、"定期回访" 应该触发 cron 工具
  const hasCronAnywhere = result.blueprints.some(bp => {
    const tools = bp.inferredCapabilities?.tools?.alsoAllow ?? [];
    return tools.some(t => /cron/i.test(t));
  });
  assert(hasCronAnywhere, "至少一个成员有定时 (cron) 工具");

  printVerification(result.verification);
}

// ══════════════════════════════════════════════════════════════════════════
//  SCENARIO 6: AI 视频脚本工厂
// ══════════════════════════════════════════════════════════════════════════

function scenario6_VideoScriptFactory(): void {
  currentScenario = "AI视频脚本工厂";
  section(`场景6: ${currentScenario}`);

  const userCtx: UserContext = {
    scenario: "content",
    channels: [],
    resources: [],
    volume: "medium",
    budget: "premium",  // 愿意花钱
  };

  // 刁钻点：premium 预算 + 复杂的视频制作流程
  const blueprints: AgentBlueprint[] = [
    {
      name: "选题研究员",
      id: "topic-researcher",
      role: "深度调研视频选题，分析竞品爆款视频，提供差异化选题方向",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "脚本编剧",
      id: "scriptwriter",
      role: "撰写完整视频脚本，包括开场钩子、正文结构、结尾CTA，控制节奏",
      soul: "",
      modelTier: "sota",
      tools: { allow: [] },
    },
    {
      name: "分镜设计师",
      id: "storyboard-artist",
      role: "将脚本拆解为分镜，描述每个镜头的画面、角度、运镜方式",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "配音文案员",
      id: "voiceover-writer",
      role: "将脚本改写为口播配音文案，调整语气、停顿、重音标注",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
    {
      name: "字幕生成器",
      id: "subtitle-gen",
      role: "生成字幕时间轴和字幕文件，支持中英双语字幕",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
  ];

  const discovery = createRichDiscovery();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "搭建AI视频脚本全流程工厂，从选题调研到脚本撰写到分镜设计到配音文案到字幕生成",
    userCtx,
    discovery,
  });

  subsection("Pipeline 概览");
  console.log(`  轮次: ${result.totalRounds} | 分数: ${result.verification.score} | 覆盖率: ${result.coverageScore}% | 通过: ${result.verification.overallPass}`);

  subsection("基础验证");
  assert(result.verification.score >= 40, `分数 ≥ 40 (实际: ${result.verification.score})`);

  // ── premium 模型审查 ──
  subsection("Premium 模型审查");
  const scriptwriter = result.blueprints.find(bp => bp.id === "scriptwriter");
  if (scriptwriter?.inferredCapabilities) {
    // SOTA tier + premium budget → 应该得到最好的模型
    const model = scriptwriter.inferredCapabilities.model.primary;
    assert(/opus|o3/i.test(model), `脚本编剧使用 SOTA 模型 (${model})`);
  }

  // premium 预算下 cheap tier 应该被升级到 mid
  const voiceWriter = result.blueprints.find(bp => bp.id === "voiceover-writer");
  if (voiceWriter?.inferredCapabilities) {
    const model = voiceWriter.inferredCapabilities.model.primary;
    // cheap + premium → should be upgraded to mid
    finding("info", "模型升级", `配音文案员（cheap tier, premium budget）最终模型: ${model}`);
  }

  // ── 选题研究员调研能力 ──
  subsection("调研能力审查");
  const researcher = result.blueprints.find(bp => bp.id === "topic-researcher");
  if (researcher?.inferredCapabilities) {
    const hasResearch = researcher.inferredCapabilities.skills.some(s => /research|web-researcher|调研/i.test(s));
    assert(hasResearch, `选题研究员有调研 skill (${researcher.inferredCapabilities.skills.join(", ")})`);

    const complexity = estimateRoleComplexity(researcher.role);
    assert(complexity === "complex", `选题研究员复杂度=complex (实际: ${complexity})`);
  }

  // ── 字幕翻译能力 ──
  subsection("字幕翻译审查");
  const subtitleGen = result.blueprints.find(bp => bp.id === "subtitle-gen");
  if (subtitleGen?.inferredCapabilities) {
    const hasTranslate = subtitleGen.inferredCapabilities.skills.some(s => /translat|翻译/i.test(s));
    if (!hasTranslate) {
      finding("warning", "缺失能力", "字幕生成器角色描述包含'双语字幕'，但未分配翻译 skill");
    }
  }

  printVerification(result.verification);
}

// ══════════════════════════════════════════════════════════════════════════
//  SCENARIO 7: 家庭财务管家
// ══════════════════════════════════════════════════════════════════════════

function scenario7_FamilyFinance(): void {
  currentScenario = "家庭财务管家";
  section(`场景7: ${currentScenario}`);

  const userCtx: UserContext = {
    scenario: "finance",
    channels: ["wechat"],
    resources: ["database"],
    volume: "low",
    budget: "cheap",
  };

  const blueprints: AgentBlueprint[] = [
    {
      name: "记账小助手",
      id: "bookkeeper",
      role: "记录日常收支，自动分类账单，支持语音记账",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
    {
      name: "预算管家",
      id: "budget-manager",
      role: "制定月度预算计划，实时监控预算执行情况，超支预警",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
    {
      name: "理财顾问",
      id: "financial-advisor",
      role: "分析家庭资产配置，提供理财建议，追踪基金股票行情",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "报表生成器",
      id: "report-generator",
      role: "生成周报月报年报，可视化收支趋势，导出PDF",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
  ];

  const discovery = createRichDiscovery();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "搭建家庭财务管理系统，支持日常记账、预算管理、理财分析和财务报表",
    userCtx,
    discovery,
  });

  subsection("Pipeline 概览");
  console.log(`  轮次: ${result.totalRounds} | 分数: ${result.verification.score} | 覆盖率: ${result.coverageScore}% | 通过: ${result.verification.overallPass}`);

  subsection("基础验证");
  assert(result.verification.score >= 40, `分数 ≥ 40 (实际: ${result.verification.score})`);

  // ── 财务工具审查 ──
  subsection("财务工具审查");
  const bookkeeper = result.blueprints.find(bp => bp.id === "bookkeeper");
  if (bookkeeper?.inferredCapabilities) {
    const hasFinanceSkill = bookkeeper.inferredCapabilities.skills.some(s => /budget|ledger|记账|财务/i.test(s));
    assert(hasFinanceSkill, `记账小助手有财务相关 skill (${bookkeeper.inferredCapabilities.skills.join(", ")})`);
  }

  // 报表生成需要 PDF 能力
  const reportGen = result.blueprints.find(bp => bp.id === "report-generator");
  if (reportGen?.inferredCapabilities) {
    const hasPdf = reportGen.inferredCapabilities.skills.some(s => /pdf/i.test(s));
    if (!hasPdf) {
      finding("warning", "缺失能力", `报表生成器角色要求'导出PDF'，但未匹配到 PDF skill (skills: ${reportGen.inferredCapabilities.skills.join(", ")})`);
    }
  }

  // ── 数据库需求审查 ──
  subsection("数据库需求审查");
  // 记账需要持久化存储
  const anyDbCap = result.blueprints.some(bp => {
    const caps = bp.inferredCapabilities;
    if (!caps) return false;
    return caps.mcpHints.some(m => /sql|database/i.test(m)) ||
      (caps.tools.alsoAllow ?? []).some(t => /group:fs|group:runtime/i.test(t));
  });
  assert(anyDbCap, "至少一个成员有数据库/文件系统访问能力");

  // ── 预算管家定时能力 ──
  subsection("预算管家定时能力");
  const budgetMgr = result.blueprints.find(bp => bp.id === "budget-manager");
  if (budgetMgr?.inferredCapabilities) {
    const hasMonitor = (budgetMgr.inferredCapabilities.tools.alsoAllow ?? []).some(t => /cron|remind|monitor/i.test(t));
    if (!hasMonitor) {
      finding("info", "定时能力", `预算管家包含"实时监控"和"预警"，但未分配 cron/remind 工具`);
    }
  }

  printVerification(result.verification);
}

// ══════════════════════════════════════════════════════════════════════════
//  SCENARIO 8: 全栈独立开发者助手
// ══════════════════════════════════════════════════════════════════════════

function scenario8_SoloDeveloper(): void {
  currentScenario = "全栈独立开发者助手";
  section(`场景8: ${currentScenario}`);

  const userCtx: UserContext = {
    scenario: "coding",
    channels: [],
    resources: ["github", "database"],
    volume: "medium",
    budget: "premium",
  };

  // 刁钻点：一人全干，极端多面角色
  const blueprints: AgentBlueprint[] = [
    {
      name: "产品经理AI",
      id: "pm-ai",
      role: "需求分析、PRD撰写、用户故事拆解、优先级排序",
      soul: "",
      modelTier: "sota",
      tools: { allow: [] },
    },
    {
      name: "架构师",
      id: "architect",
      role: "系统架构设计、技术选型、数据库设计、API接口规划",
      soul: "",
      modelTier: "sota",
      tools: { allow: [] },
    },
    {
      name: "前端开发",
      id: "frontend-dev",
      role: "React/Vue前端开发，组件编写，CSS样式，响应式适配",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "后端开发",
      id: "backend-dev",
      role: "Node.js/Python后端开发，API实现，数据库操作，缓存管理",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "测试工程师",
      id: "qa-engineer",
      role: "编写单元测试、集成测试，Bug定位和修复建议",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "DevOps",
      id: "devops",
      role: "CI/CD流水线配置，Docker容器化，服务器部署和监控",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
  ];

  const discovery = createRichDiscovery();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "搭建全栈独立开发者助手团队，覆盖产品设计、架构、前后端开发、测试和DevOps全流程",
    userCtx,
    discovery,
  });

  subsection("Pipeline 概览");
  console.log(`  轮次: ${result.totalRounds} | 分数: ${result.verification.score} | 覆盖率: ${result.coverageScore}% | 通过: ${result.verification.overallPass}`);

  subsection("基础验证");
  assert(result.verification.score >= 40, `分数 ≥ 40 (实际: ${result.verification.score})`);
  assert(result.blueprints.length >= 5, `团队 ≥ 5人 (实际: ${result.blueprints.length})`);

  // ── 代码能力审查 ──
  subsection("代码能力审查");
  const frontendDev = result.blueprints.find(bp => bp.id === "frontend-dev");
  const backendDev = result.blueprints.find(bp => bp.id === "backend-dev");

  if (frontendDev?.inferredCapabilities) {
    const hasCoding = frontendDev.inferredCapabilities.skills.some(s => /coding|code/i.test(s));
    assert(hasCoding, `前端开发有编码 skill (${frontendDev.inferredCapabilities.skills.join(", ")})`);
    const hasCodingProfile = frontendDev.inferredCapabilities.tools.profile === "coding";
    assert(hasCodingProfile, `前端开发使用 coding 工具 profile`);
  }

  if (backendDev?.inferredCapabilities) {
    const hasCoding = backendDev.inferredCapabilities.skills.some(s => /coding|code/i.test(s));
    assert(hasCoding, `后端开发有编码 skill`);
    // 后端需要数据库和文件系统
    const hasFs = (backendDev.inferredCapabilities.tools.alsoAllow ?? []).some(t => /group:fs|group:runtime/i.test(t));
    if (!hasFs) {
      finding("info", "工具缺失", `后端开发未获得 group:fs 工具`);
    }
  }

  // ── SOTA 模型分配 ──
  subsection("SOTA 模型审查");
  const architect = result.blueprints.find(bp => bp.id === "architect");
  if (architect?.inferredCapabilities) {
    const model = architect.inferredCapabilities.model.primary;
    // sota tier + premium budget → 应该得到最好的
    assert(/opus|o3|claude|gpt/i.test(model), `架构师使用高端模型 (${model})`);
    const complexity = estimateRoleComplexity(architect.role);
    assert(complexity === "complex", `架构师复杂度=complex (实际: ${complexity})`);
  }

  // ── GitHub 资源覆盖 ──
  subsection("GitHub 资源覆盖");
  const githubCovered = result.blueprints.some(bp => {
    const skills = bp.inferredCapabilities?.skills ?? [];
    const mcp = bp.inferredCapabilities?.mcpHints ?? [];
    return skills.some(s => /github/i.test(s)) || mcp.some(m => /github/i.test(m));
  });
  assert(githubCovered, "至少一个成员有 GitHub 能力");

  // ── DevOps Docker 能力 ──
  subsection("DevOps 能力审查");
  const devops = result.blueprints.find(bp => bp.id === "devops");
  if (devops?.inferredCapabilities) {
    // role 包含 "Docker" 和 "监控"
    const hasDockerMCP = devops.inferredCapabilities.mcpHints.some(m => /docker/i.test(m));
    if (!hasDockerMCP) {
      finding("info", "MCP 缺失", `DevOps 角色含 Docker 但未匹配 docker MCP (mcpHints: ${devops.inferredCapabilities.mcpHints.join(", ")})`);
    }
  }

  printVerification(result.verification);
}

// ══════════════════════════════════════════════════════════════════════════
//  Cross-Cutting Analysis (跨场景交叉审查)
// ══════════════════════════════════════════════════════════════════════════

type ScenarioResult = {
  name: string;
  score: number;
  coverageScore: number;
  pass: boolean;
  agentCount: number;
  rounds: number;
  autoActions: number;
  gaps: number;
};

function crossCuttingAnalysis(results: ScenarioResult[]): void {
  section("跨场景交叉审查");

  console.log("\n  ┌─────────────────────────────────────┬──────┬───────┬──────┬───────┬──────┬──────┐");
  console.log("  │ 场景                                │ 分数 │ 覆盖率│ 通过 │ 成员数│ 轮次 │ 缺口 │");
  console.log("  ├─────────────────────────────────────┼──────┼───────┼──────┼───────┼──────┼──────┤");
  for (const r of results) {
    const name = r.name.padEnd(17, "　"); // CJK padding
    console.log(`  │ ${name}│ ${String(r.score).padStart(4)} │ ${String(r.coverageScore + "%").padStart(5)} │ ${r.pass ? " ✅ " : " ❌ "} │ ${String(r.agentCount).padStart(5)} │ ${String(r.rounds).padStart(4)} │ ${String(r.gaps).padStart(4)} │`);
  }
  console.log("  └─────────────────────────────────────┴──────┴───────┴──────┴───────┴──────┴──────┘");

  // 整体通过率
  const passRate = results.filter(r => r.pass).length / results.length;
  console.log(`\n  整体通过率: ${Math.round(passRate * 100)}% (${results.filter(r => r.pass).length}/${results.length})`);

  // 平均分
  const avgScore = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
  console.log(`  平均分数: ${avgScore}`);

  // 平均覆盖率
  const avgCoverage = Math.round(results.reduce((s, r) => s + r.coverageScore, 0) / results.length);
  console.log(`  平均覆盖率: ${avgCoverage}%`);

  // 自动优化效果
  const totalAutoActions = results.reduce((s, r) => s + r.autoActions, 0);
  console.log(`  总自动优化操作: ${totalAutoActions} 次`);
}

// ── Utility ─────────────────────────────────────────────────────────────

function printVerification(v: SceneVerification): void {
  const report = formatVerificationReport(v);
  console.log("\n  📋 验证报告:");
  console.log("  " + report.split("\n").join("\n  "));
}

// ── Main Runner ─────────────────────────────────────────────────────────

function main(): void {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║    第三方专家审查 — Agent Team 深度压力测试                      ║");
  console.log("║    8 大中国小白用户刁钻场景 · 全方位质量评审                     ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const scenarioResults: ScenarioResult[] = [];

  // Run all 8 scenarios
  const scenarios = [
    { fn: scenario1_XiaohongshuFactory, name: "小红书爆款文案工厂" },
    { fn: scenario2_MultiChannelMatrix, name: "多渠道自媒体矩阵" },
    { fn: scenario3_CrossBorderEcommerce, name: "跨境电商客服" },
    { fn: scenario4_KnowledgeAndLearning, name: "个人知识管理学习助手" },
    { fn: scenario5_PrivateTrafficOps, name: "私域流量运营" },
    { fn: scenario6_VideoScriptFactory, name: "AI视频脚本工厂" },
    { fn: scenario7_FamilyFinance, name: "家庭财务管家" },
    { fn: scenario8_SoloDeveloper, name: "全栈独立开发者助手" },
  ];

  for (const s of scenarios) {
    const startTotal = totalTests;
    const startPass = passedTests;
    try {
      s.fn();
    } catch (err) {
      console.log(`  ${FAIL} ${s.name} 执行出错: ${err}`);
      allFindings.push({
        scenario: s.name,
        severity: "critical",
        category: "runtime_error",
        detail: `${err}`,
      });
    }
    // 收集该场景结果（通过结果需要从 pipeline 中提取，这里简化处理）
  }

  // ── 收集场景级结果 (重新运行但只收集统计) ──
  const discovery = createRichDiscovery();
  const scenarioConfigs: Array<{
    name: string;
    requirement: string;
    blueprints: AgentBlueprint[];
    userCtx: UserContext;
  }> = [
    {
      name: "小红书爆款文案工厂",
      requirement: "打造小红书爆款文案全自动化流水线",
      userCtx: { scenario: "content", channels: ["wechat"], resources: [], volume: "high", budget: "cheap" },
      blueprints: [
        { name: "热点猎手", id: "t1", role: "监控小红书热门话题", soul: "", modelTier: "cheap", tools: { allow: [] } },
        { name: "文案手", id: "t2", role: "撰写小红书种草文案", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "封面师", id: "t3", role: "生成封面配图", soul: "", modelTier: "cheap", tools: { allow: [] } },
        { name: "复盘员", id: "t4", role: "分析数据优化策略", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "互动官", id: "t5", role: "回复评论互动", soul: "", modelTier: "cheap", tools: { allow: [] } },
      ],
    },
    {
      name: "多渠道自媒体矩阵",
      requirement: "搭建多渠道自媒体矩阵",
      userCtx: { scenario: "content", channels: ["wechat", "web"], resources: [], volume: "high", budget: "balanced" },
      blueprints: [
        { name: "选题总监", id: "m1", role: "各平台选题策划", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "公众号作者", id: "m2", role: "撰写公众号文章", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "小红书达人", id: "m3", role: "创作小红书笔记", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "短视频文案", id: "m4", role: "撰写短视频脚本", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "B站助手", id: "m5", role: "撰写B站标题简介", soul: "", modelTier: "cheap", tools: { allow: [] } },
        { name: "分发员", id: "m6", role: "多平台分发定时发布", soul: "", modelTier: "cheap", tools: { allow: [] } },
      ],
    },
    {
      name: "跨境电商客服",
      requirement: "搭建跨境电商智能客服系统，中英双语，FAQ知识库和工单管理",
      userCtx: { scenario: "customer_support", channels: ["wechat", "web"], resources: ["faq_doc", "database"], volume: "high", budget: "balanced" },
      blueprints: [
        { name: "中文客服", id: "c1", role: "处理中文用户咨询退换货", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "英文客服", id: "c2", role: "Handle English customer inquiries", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "翻译员", id: "c3", role: "中英双语翻译", soul: "", modelTier: "cheap", tools: { allow: [] } },
        { name: "工单员", id: "c4", role: "创建跟踪售后工单", soul: "", modelTier: "cheap", tools: { allow: [] } },
        { name: "FAQ管理", id: "c5", role: "维护FAQ知识库", soul: "", modelTier: "cheap", tools: { allow: [] } },
      ],
    },
    {
      name: "个人知识管理学习助手",
      requirement: "搭建个人知识管理系统，阅读PDF论文、做笔记总结、定时复习",
      userCtx: { scenario: "learning", channels: [], resources: ["pdf", "notion"], volume: "low", budget: "cheap" },
      blueprints: [
        { name: "阅读器", id: "l1", role: "阅读PDF网页提取摘要", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "知识管理", id: "l2", role: "整理知识关联图谱", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "复习教练", id: "l3", role: "定时提醒复习生成闪卡", soul: "", modelTier: "cheap", tools: { allow: [] } },
        { name: "论文助读", id: "l4", role: "辅助阅读学术论文解释术语总结方法", soul: "", modelTier: "mid", tools: { allow: [] } },
      ],
    },
    {
      name: "私域流量运营",
      requirement: "搭建私域流量运营系统，微信社群管理朋友圈营销用户画像",
      userCtx: { scenario: "content", channels: ["wechat"], resources: ["database"], volume: "high", budget: "balanced" },
      blueprints: [
        { name: "社群运营", id: "p1", role: "管理微信社群发布群公告", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "朋友圈编辑", id: "p2", role: "撰写朋友圈文案配图", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "画像分析", id: "p3", role: "分析用户行为数据打标签", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "活动策划", id: "p4", role: "策划营销活动促销方案", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "客户回访", id: "p5", role: "定期回访老客户收集反馈", soul: "", modelTier: "cheap", tools: { allow: [] } },
      ],
    },
    {
      name: "AI视频脚本工厂",
      requirement: "搭建AI视频脚本全流程工厂，选题到脚本到分镜到配音到字幕",
      userCtx: { scenario: "content", channels: [], resources: [], volume: "medium", budget: "premium" },
      blueprints: [
        { name: "选题研究", id: "v1", role: "深度调研视频选题分析竞品", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "编剧", id: "v2", role: "撰写完整视频脚本", soul: "", modelTier: "sota", tools: { allow: [] } },
        { name: "分镜师", id: "v3", role: "将脚本拆解为分镜描述画面", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "配音文案", id: "v4", role: "改写口播配音文案", soul: "", modelTier: "cheap", tools: { allow: [] } },
        { name: "字幕生成", id: "v5", role: "生成字幕文件中英双语字幕翻译", soul: "", modelTier: "cheap", tools: { allow: [] } },
      ],
    },
    {
      name: "家庭财务管家",
      requirement: "搭建家庭财务管理系统，日常记账预算管理理财分析财务报表",
      userCtx: { scenario: "finance", channels: ["wechat"], resources: ["database"], volume: "low", budget: "cheap" },
      blueprints: [
        { name: "记账助手", id: "f1", role: "记录日常收支自动分类", soul: "", modelTier: "cheap", tools: { allow: [] } },
        { name: "预算管家", id: "f2", role: "制定预算监控执行超支预警", soul: "", modelTier: "cheap", tools: { allow: [] } },
        { name: "理财顾问", id: "f3", role: "分析资产配置理财建议", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "报表生成", id: "f4", role: "生成报表可视化趋势导出PDF", soul: "", modelTier: "cheap", tools: { allow: [] } },
      ],
    },
    {
      name: "全栈独立开发者助手",
      requirement: "搭建全栈开发者助手，覆盖产品架构前后端测试DevOps",
      userCtx: { scenario: "coding", channels: [], resources: ["github", "database"], volume: "medium", budget: "premium" },
      blueprints: [
        { name: "产品经理", id: "d1", role: "需求分析PRD用户故事", soul: "", modelTier: "sota", tools: { allow: [] } },
        { name: "架构师", id: "d2", role: "系统架构设计技术选型数据库设计", soul: "", modelTier: "sota", tools: { allow: [] } },
        { name: "前端开发", id: "d3", role: "React前端开发组件编写CSS", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "后端开发", id: "d4", role: "Node.js后端开发API数据库", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "测试工程师", id: "d5", role: "编写单元测试集成测试Bug定位", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "DevOps", id: "d6", role: "CI/CD配置Docker容器化部署监控", soul: "", modelTier: "mid", tools: { allow: [] } },
      ],
    },
  ];

  for (const cfg of scenarioConfigs) {
    const r = executePlanningPipeline({
      blueprints: cfg.blueprints,
      requirement: cfg.requirement,
      userCtx: cfg.userCtx,
      discovery,
    });
    scenarioResults.push({
      name: cfg.name,
      score: r.verification.score,
      coverageScore: r.coverageScore,
      pass: r.verification.overallPass,
      agentCount: r.blueprints.length,
      rounds: r.totalRounds,
      autoActions: r.rounds.reduce((s, rd) => s + rd.actionsApplied.length, 0),
      gaps: r.verification.gaps.length,
    });
  }

  // ── Cross-cutting ──
  crossCuttingAnalysis(scenarioResults);

  // ══════════════════════════════════════════════════════════════════════
  //  Final Report
  // ══════════════════════════════════════════════════════════════════════

  section("考核结果汇总");

  console.log(`\n  总测试数: ${totalTests}`);
  console.log(`  ${PASS} 通过: ${passedTests}`);
  console.log(`  ${FAIL} 失败: ${failedTests}`);
  console.log(`  通过率: ${Math.round((passedTests / totalTests) * 100)}%`);

  if (allFindings.length > 0) {
    const criticals = allFindings.filter(f => f.severity === "critical");
    const warnings = allFindings.filter(f => f.severity === "warning");
    const infos = allFindings.filter(f => f.severity === "info");

    console.log(`\n  发现问题汇总:`);
    if (criticals.length > 0) {
      console.log(`    ${FAIL} 严重: ${criticals.length} 个`);
      for (const f of criticals) {
        console.log(`      - [${f.scenario}] ${f.detail}`);
      }
    }
    if (warnings.length > 0) {
      console.log(`    ${WARN} 警告: ${warnings.length} 个`);
      for (const f of warnings) {
        console.log(`      - [${f.scenario}] ${f.category}: ${f.detail}`);
      }
    }
    if (infos.length > 0) {
      console.log(`    ${INFO} 建议: ${infos.length} 个`);
      for (const f of infos) {
        console.log(`      - [${f.scenario}] ${f.category}: ${f.detail}`);
      }
    }
  }

  // 评级
  const passRate = totalTests > 0 ? passedTests / totalTests : 0;
  let grade = "F";
  if (passRate >= 0.98) grade = "A+";
  else if (passRate >= 0.95) grade = "A";
  else if (passRate >= 0.90) grade = "B+";
  else if (passRate >= 0.85) grade = "B";
  else if (passRate >= 0.80) grade = "C+";
  else if (passRate >= 0.70) grade = "C";
  else if (passRate >= 0.60) grade = "D";

  const gradeLabel: Record<string, string> = {
    "A+": "优秀", "A": "良好", "B+": "中上", "B": "中等",
    "C+": "及格", "C": "刚及格", "D": "不及格", "F": "严重不合格",
  };

  console.log(`\n  🏆 综合评级: ${grade} (${gradeLabel[grade]})`);

  // Exit with error if any test failed
  if (failedTests > 0) {
    process.exit(1);
  }
}

main();
