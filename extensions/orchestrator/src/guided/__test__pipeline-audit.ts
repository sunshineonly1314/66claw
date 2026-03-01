/**
 * Pipeline Audit — End-to-End Quality Assessment
 *
 * 作为考官，模拟真实用户场景，驱动整个 planning pipeline 运行，
 * 检验 agent team 输出质量。
 *
 * 测试覆盖:
 *   1. 自媒体内容工厂（content 场景）
 *   2. 企业客服团队（customer_support 场景）
 *   3. 编程助手团队（coding 场景）
 *   4. 数据分析团队（data_analysis 场景）
 *   5. 边界测试：空 blueprint、超大团队、CJK 匹配
 *   6. Learning engine + soul-optimizer 闭环
 *
 * 运行: npx tsx extensions/orchestrator/src/guided/__test__pipeline-audit.ts
 */

import { executePlanningPipeline, formatPipelineReport } from "./planning-pipeline.js";
import { verifyScene, formatVerificationReport } from "./scene-verifier.js";
import { inferAgentCapabilities, estimateRoleComplexity, isSupervisorRole } from "./capability-inference.js";
import { matchCapabilitiesToRole, mergeWithStaticInference } from "./runtime-discovery.js";
import type { AgentBlueprint, UserContext, InferredCapabilities } from "../types.js";
import type { DiscoveryResult } from "./runtime-discovery.js";

// Learning engine imports
import {
  analyzeLearningOpportunities,
  applyAutoOptimizations,
  generateLearningHints,
  formatLearningReport,
  shouldTriggerLearning,
  type ActivityEventLike,
} from "../../../agent-team/src/learning-engine.js";
import {
  buildMemberPerformanceProfile,
  appendLearningHintsToSoul,
  removeLearningHintsFromSoul,
  buildSupervisorLearningContext,
} from "../../../agent-team/src/soul-optimizer.js";
import { createInitialMemberHealth, recordMemberSuccess, recordMemberFailure } from "../../../agent-team/src/member-health.js";
import { createInitialMemberStats, recordMemberCall } from "../../../agent-team/src/member-stats.js";

// ── Test Utilities ──────────────────────────────────────────────────────

const PASS = "✅";
const FAIL = "❌";
const WARN = "⚠️";
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const issues: string[] = [];

function assert(condition: boolean, testName: string, detail?: string): void {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${PASS} ${testName}`);
  } else {
    failedTests++;
    const msg = `${testName}${detail ? ` — ${detail}` : ""}`;
    console.log(`  ${FAIL} ${msg}`);
    issues.push(msg);
  }
}

function section(title: string): void {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}`);
}

// ── Mock Discovery Data ─────────────────────────────────────────────────

function createMockDiscovery(): DiscoveryResult {
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
      { name: "copywriting", description: "文案创作和优化", source: "managed" },
      { name: "calendar", description: "日程管理和提醒", source: "bundled" },
    ],
    mcpServers: [
      { id: "mcp-server-sqlite", enabled: true, running: true, tools: [{ name: "query", description: "Execute SQL queries" }] },
      { id: "@mcp/server-filesystem", enabled: true, running: true, tools: [{ name: "read_file", description: "Read file contents" }] },
      { id: "@modelcontextprotocol/server-github", enabled: true, running: true, tools: [{ name: "create_issue", description: "Create GitHub issue" }] },
    ],
    timestamp: Date.now(),
  };
}

// ── Test Scenarios ──────────────────────────────────────────────────────

// Scenario 1: 自媒体内容工厂
function createContentTeamBlueprints(): AgentBlueprint[] {
  return [
    {
      name: "选题雷达",
      id: "topic-radar",
      role: "负责热点监控、选题发现和趋势分析，每日推送优质选题建议",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
    {
      name: "内容创作者",
      id: "content-writer",
      role: "根据选题撰写文章、文案，支持小红书、公众号等多平台格式",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "配图师",
      id: "image-creator",
      role: "为文章和帖子生成配图、封面图，支持多种风格",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
    {
      name: "SEO 优化师",
      id: "seo-optimizer",
      role: "对内容进行SEO优化，关键词分析，标题优化",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
  ];
}

// Scenario 2: 企业客服团队
function createCustomerSupportBlueprints(): AgentBlueprint[] {
  return [
    {
      name: "前台接待",
      id: "reception",
      role: "接待用户咨询，初步分类问题类型，转接到对应专家",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
    {
      name: "技术支持",
      id: "tech-support",
      role: "处理技术问题、故障排查、系统配置指导",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "FAQ 管理员",
      id: "faq-admin",
      role: "维护FAQ知识库，自动回答常见问题，生成新FAQ",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
  ];
}

// Scenario 3: 编程助手团队
function createCodingTeamBlueprints(): AgentBlueprint[] {
  return [
    {
      name: "架构师",
      id: "architect",
      role: "代码架构设计、技术方案评审、编程指导",
      soul: "",
      modelTier: "sota",
      tools: { allow: [] },
    },
    {
      name: "编码助手",
      id: "coder",
      role: "代码编写、功能实现、编程开发",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "Code Reviewer",
      id: "reviewer",
      role: "代码审查、代码质量分析、review PR",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "测试工程师",
      id: "tester",
      role: "编写测试用例、运行测试、质量保证",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
  ];
}

// Scenario 4: 数据分析团队
function createDataTeamBlueprints(): AgentBlueprint[] {
  return [
    {
      name: "数据采集员",
      id: "data-collector",
      role: "从数据库、API、文件采集数据，数据清洗和预处理",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
    {
      name: "数据分析师",
      id: "data-analyst",
      role: "深度数据分析、统计建模、趋势预测",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] },
    },
    {
      name: "报表生成器",
      id: "report-gen",
      role: "生成可视化报表、数据看板、周报月报",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] },
    },
  ];
}

// ══════════════════════════════════════════════════════════════════════════
//  PART 1: Planning Pipeline Tests
// ══════════════════════════════════════════════════════════════════════════

function testContentTeam(): void {
  section("场景1: 自媒体内容工厂 (content)");

  const userCtx: UserContext = {
    scenario: "content",
    channels: ["wechat"],
    resources: [],
    volume: "medium",
    budget: "balanced",
  };

  const discovery = createMockDiscovery();
  const blueprints = createContentTeamBlueprints();

  const result = executePlanningPipeline({
    blueprints,
    requirement: "搭建一个自媒体内容工厂，包含选题、写作、配图、SEO优化全流程",
    userCtx,
    discovery,
  });

  console.log("\n  📊 Pipeline 结果:");
  console.log(`     总轮次: ${result.totalRounds}`);
  console.log(`     覆盖率: ${result.coverageScore}%`);
  console.log(`     可行性: ${result.feasibilityScore}%`);
  console.log(`     验证通过: ${result.verification.overallPass}`);
  console.log(`     验证分数: ${result.verification.score}`);
  console.log(`     Agents: ${result.blueprints.length}`);
  console.log(`     自动优化: ${result.refinementSummary}`);
  console.log();

  // 质量检查
  assert(result.verification.overallPass, "验证通过");
  assert(result.verification.score >= 60, `验证分数 ≥ 60 (实际: ${result.verification.score})`);
  assert(result.coverageScore >= 70, `需求覆盖率 ≥ 70% (实际: ${result.coverageScore}%)`);
  assert(result.blueprints.length >= 3, `团队成员 ≥ 3 (实际: ${result.blueprints.length})`);

  // 检查每个 agent 的能力推断
  for (const bp of result.blueprints) {
    const caps = bp.inferredCapabilities;
    assert(!!caps, `${bp.name}: inferredCapabilities 已推断`);
    if (caps) {
      assert(!!caps.model?.primary, `${bp.name}: 模型已分配 (${caps.model.primary})`);
      assert(caps.skills.length <= 5, `${bp.name}: skills ≤ 5 (实际: ${caps.skills.length})`);
      assert(caps.mcpHints.length <= 7, `${bp.name}: MCP ≤ 7 (实际: ${caps.mcpHints.length})`);
      assert(!!caps.tools?.profile, `${bp.name}: 工具 profile 已设置 (${caps.tools?.profile})`);
    }
  }

  // 检查 Supervisor 角色处理
  const supervisorBp = result.blueprints.find(bp => isSupervisorRole(bp.role, bp.id));
  // 内容团队没有显式 supervisor，这是正常的（deploy-bridge 会自动创建）

  // 检查模型选择合理性
  const writer = result.blueprints.find(bp => bp.id === "content-writer");
  if (writer?.inferredCapabilities?.model) {
    const model = writer.inferredCapabilities.model.primary;
    assert(
      !model.includes("deepseek-chat"), // 写作不应该用最便宜的模型
      `内容创作者不应用 cheap 模型 (实际: ${model})`,
    );
  }

  // 验证 report 格式
  const report = formatPipelineReport(result);
  assert(report.length > 50, "Pipeline 报告已生成");
  assert(report.includes("需求覆盖率"), "报告包含覆盖率");

  const vReport = formatVerificationReport(result.verification);
  assert(vReport.length > 50, "验证报告已生成");

  // 输出详细报告
  console.log("\n  📋 Pipeline Report:");
  console.log("  " + report.split("\n").join("\n  "));
  console.log("\n  📋 Verification Report:");
  console.log("  " + vReport.split("\n").join("\n  "));
}

function testCustomerSupportTeam(): void {
  section("场景2: 企业客服团队 (customer_support)");

  const userCtx: UserContext = {
    scenario: "customer_support",
    channels: ["wechat", "web"],
    resources: ["faq_doc"],
    volume: "high",
    budget: "balanced",
  };

  const discovery = createMockDiscovery();
  const blueprints = createCustomerSupportBlueprints();

  const result = executePlanningPipeline({
    blueprints,
    requirement: "搭建企业智能客服系统，支持微信和网页渠道，需要FAQ知识库和工单系统",
    userCtx,
    discovery,
  });

  console.log("\n  📊 Pipeline 结果:");
  console.log(`     总轮次: ${result.totalRounds}`);
  console.log(`     覆盖率: ${result.coverageScore}%`);
  console.log(`     可行性: ${result.feasibilityScore}%`);
  console.log(`     验证通过: ${result.verification.overallPass}`);
  console.log(`     验证分数: ${result.verification.score}`);
  console.log();

  // 该团队缺少工单 agent 且有 MCP 未运行，但基础覆盖已改善。
  // 系统应给出较低但可接受的分数（有 warning 但无 critical failure）
  assert(result.verification.score >= 40, `客服团队分数 ≥ 40 (实际: ${result.verification.score})`);
  assert(result.verification.score <= 80, `客服团队分数 ≤ 80（仍有不足）(实际: ${result.verification.score})`);
  assert(result.coverageScore >= 50, `覆盖率 ≥ 50% (实际: ${result.coverageScore}%)`);

  // 检查客服相关能力
  const reception = result.blueprints.find(bp => bp.id === "reception");
  if (reception?.inferredCapabilities) {
    const tools = reception.inferredCapabilities.tools;
    const alsoAllow = tools?.alsoAllow ?? [];
    assert(
      alsoAllow.some(t => t.includes("wechat") || t.includes("messaging")),
      `前台接待有微信/消息工具 (alsoAllow: ${alsoAllow.join(", ")})`,
    );
  }

  // 检查 FAQ 管理员是否有 memory/knowledge 相关能力
  const faq = result.blueprints.find(bp => bp.id === "faq-admin");
  if (faq?.inferredCapabilities) {
    assert(
      faq.inferredCapabilities.memorySearch?.enabled === true,
      `FAQ 管理员启用了 memorySearch`,
    );
  }

  // 验证渠道覆盖
  const channelCheck = result.verification.checks.find(c => c.name === "channel_coverage");
  assert(channelCheck?.pass === true, `渠道覆盖检查通过`);

  // 输出报告
  const vReport = formatVerificationReport(result.verification);
  console.log("\n  📋 Verification Report:");
  console.log("  " + vReport.split("\n").join("\n  "));
}

function testCodingTeam(): void {
  section("场景3: 编程助手团队 (coding)");

  const userCtx: UserContext = {
    scenario: "coding",
    channels: [],
    resources: ["github"],
    volume: "medium",
    budget: "premium",
  };

  const discovery = createMockDiscovery();
  const blueprints = createCodingTeamBlueprints();

  const result = executePlanningPipeline({
    blueprints,
    requirement: "搭建编程助手团队，支持代码编写、审查、测试全流程，集成GitHub",
    userCtx,
    discovery,
  });

  console.log("\n  📊 Pipeline 结果:");
  console.log(`     总轮次: ${result.totalRounds}`);
  console.log(`     覆盖率: ${result.coverageScore}%`);
  console.log(`     可行性: ${result.feasibilityScore}%`);
  console.log(`     验证通过: ${result.verification.overallPass}`);
  console.log(`     验证分数: ${result.verification.score}`);
  console.log();

  assert(result.verification.overallPass, "验证通过");

  // 架构师角色复杂度应该是 complex
  assert(estimateRoleComplexity("代码架构设计、技术方案评审") === "complex", "架构师角色复杂度=complex");

  // Supervisor 检测
  assert(!isSupervisorRole("代码编写、功能实现"), "普通编码角色不应被识别为 Supervisor");

  // 检查 GitHub 资源覆盖
  const resourceCheck = result.verification.checks.find(c => c.name === "resource_coverage");
  assert(resourceCheck?.pass === true, `GitHub 资源覆盖检查通过`);

  // 检查模型选择 — premium 预算下不应降级
  for (const bp of result.blueprints) {
    if (bp.inferredCapabilities?.model) {
      const model = bp.inferredCapabilities.model.primary;
      assert(model.length > 0, `${bp.name}: 模型已分配`);
    }
  }

  // 输出报告
  const vReport = formatVerificationReport(result.verification);
  console.log("\n  📋 Verification Report:");
  console.log("  " + vReport.split("\n").join("\n  "));
}

function testDataTeam(): void {
  section("场景4: 数据分析团队 (data_analysis)");

  const userCtx: UserContext = {
    scenario: "data_analysis",
    channels: [],
    resources: ["database", "pdf"],
    volume: "medium",
    budget: "balanced",
  };

  const discovery = createMockDiscovery();
  const blueprints = createDataTeamBlueprints();

  const result = executePlanningPipeline({
    blueprints,
    requirement: "搭建数据分析团队，支持数据库查询、PDF报告解析、数据可视化",
    userCtx,
    discovery,
  });

  console.log("\n  📊 Pipeline 结果:");
  console.log(`     总轮次: ${result.totalRounds}`);
  console.log(`     覆盖率: ${result.coverageScore}%`);
  console.log(`     可行性: ${result.feasibilityScore}%`);
  console.log(`     验证通过: ${result.verification.overallPass}`);
  console.log(`     验证分数: ${result.verification.score}`);
  console.log();

  assert(result.verification.overallPass, "验证通过");

  // 资源覆盖检查
  const resourceCheck = result.verification.checks.find(c => c.name === "resource_coverage");
  assert(resourceCheck?.pass === true, `数据库+PDF 资源覆盖 (${resourceCheck?.detail})`);

  // 输出报告
  const vReport = formatVerificationReport(result.verification);
  console.log("\n  📋 Verification Report:");
  console.log("  " + vReport.split("\n").join("\n  "));
}

// ══════════════════════════════════════════════════════════════════════════
//  PART 2: Edge Case & Boundary Tests
// ══════════════════════════════════════════════════════════════════════════

function testEdgeCases(): void {
  section("边界测试");

  const discovery = createMockDiscovery();

  // Test 1: 超大团队 (>8 个成员)
  console.log("\n  --- 超大团队 ---");
  const bigTeam: AgentBlueprint[] = Array.from({ length: 10 }, (_, i) => ({
    name: `Agent-${i}`,
    id: `agent-${i}`,
    role: `负责第${i}项工作`,
    soul: "",
    modelTier: "cheap" as const,
    tools: { allow: [] },
  }));

  const bigResult = executePlanningPipeline({
    blueprints: bigTeam,
    requirement: "超大团队测试",
    userCtx: { scenario: "general", channels: [], resources: [], volume: "low", budget: "cheap" },
  });

  const structureWarning = bigResult.rounds
    .flatMap(r => r.issues)
    .some(i => i.message.includes("团队规模过大"));
  assert(structureWarning, "超大团队触发规模警告");

  // Test 2: 重复 ID
  console.log("\n  --- 重复 ID ---");
  const dupTeam: AgentBlueprint[] = [
    { name: "Agent A", id: "dup-id", role: "任务A", soul: "", modelTier: "cheap", tools: { allow: [] } },
    { name: "Agent B", id: "dup-id", role: "任务B", soul: "", modelTier: "cheap", tools: { allow: [] } },
  ];

  const dupResult = executePlanningPipeline({
    blueprints: dupTeam,
    requirement: "重复 ID 测试",
    userCtx: { scenario: "general", channels: [], resources: [], volume: "low", budget: "cheap" },
  });

  // After auto-refine, duplicates should be removed
  const hasDupIssue = dupResult.rounds
    .flatMap(r => r.issues)
    .some(i => i.message.includes("重复"));
  assert(hasDupIssue, "重复 ID 被检测到");

  // Test 3: 高度重叠角色
  console.log("\n  --- 高度重叠角色 ---");
  const overlapTeam: AgentBlueprint[] = Array.from({ length: 7 }, (_, i) => ({
    name: `写作助手-${i}`,
    id: `writer-${i}`,
    role: "负责文案写作、内容创作、文章撰写",
    soul: "",
    modelTier: "cheap" as const,
    tools: { allow: [] },
  }));

  const overlapResult = executePlanningPipeline({
    blueprints: overlapTeam,
    requirement: "写作团队",
    userCtx: { scenario: "content", channels: [], resources: [], volume: "low", budget: "cheap" },
  });

  const overlapWarning = overlapResult.rounds
    .flatMap(r => r.issues)
    .some(i => i.category === "overlap");
  assert(overlapWarning, "高度重叠角色被检测到");

  // 合并后团队应该缩小
  assert(
    overlapResult.blueprints.length < 7,
    `重叠 agent 被合并 (7→${overlapResult.blueprints.length})`,
  );

  // Test 4: CJK 匹配精度
  console.log("\n  --- CJK 匹配精度 ---");
  // "代码" 不应该误匹配 "代理"
  const cjkTeam: AgentBlueprint[] = [
    { name: "代理管理", id: "proxy", role: "管理网络代理和转发", soul: "", modelTier: "cheap", tools: { allow: [] } },
  ];

  const cjkResult = verifyScene({
    requirement: "需要代码编写和代码审查功能",
    blueprints: cjkTeam,
    userCtx: { scenario: "coding", channels: [], resources: [], volume: "low", budget: "cheap" },
  });

  // "代码" should NOT be covered by "代理管理"
  const coverageCheck = cjkResult.checks.find(c => c.name === "requirement_coverage");
  assert(
    !coverageCheck?.pass || cjkResult.gaps.length > 0,
    `CJK 精确匹配: "代码" 不误匹配 "代理" (gaps: ${cjkResult.gaps.length})`,
  );

  // Test 5: Skills 超限自动裁剪
  console.log("\n  --- Skills 超限自动裁剪 ---");
  const overSkillBp: AgentBlueprint = {
    name: "万能选手",
    id: "all-in-one",
    role: "搜索新闻代码翻译总结数据日程客服写作PDF配图github",
    soul: "",
    modelTier: "mid",
    tools: { allow: [] },
  };

  const caps = inferAgentCapabilities(overSkillBp, {
    scenario: "general",
    channels: [],
    resources: ["pdf", "github"],
    volume: "medium",
    budget: "balanced",
  }, undefined, discovery);

  assert(caps.skills.length <= 5, `Skills 不超过 5 (实际: ${caps.skills.length})`);
  assert(caps.mcpHints.length <= 7, `MCP 不超过 7 (实际: ${caps.mcpHints.length})`);

  // Test 6: 无效渠道
  console.log("\n  --- 无效渠道 ---");
  const channelResult = verifyScene({
    requirement: "测试渠道",
    blueprints: [{ name: "A", id: "a", role: "测试", soul: "", modelTier: "cheap", tools: { allow: [] } }],
    userCtx: { scenario: "general", channels: ["invalid_channel"], resources: [], volume: "low", budget: "cheap" },
  });

  const channelCheck = channelResult.checks.find(c => c.name === "channel_coverage");
  assert(channelCheck?.pass === false, "无效渠道被检测到");
}

// ══════════════════════════════════════════════════════════════════════════
//  PART 3: Capability Inference Quality
// ══════════════════════════════════════════════════════════════════════════

function testCapabilityInference(): void {
  section("能力推断质量检查");

  const discovery = createMockDiscovery();

  // Test: Supervisor uses user-configured model (not forced SOTA)
  console.log("\n  --- Supervisor 模型选择 ---");
  const supBp: AgentBlueprint = {
    name: "调度员",
    id: "dispatcher",
    role: "分发任务、路由消息、协调团队成员",
    soul: "",
    modelTier: "cheap",
    tools: { allow: [] },
  };

  // Test 1: With user-configured model → should use that model
  const mockConfig = { agents: { defaults: { model: "qwen/qwen-max" } } };
  const supCapsWithConfig = inferAgentCapabilities(supBp, {
    scenario: "general", channels: [], resources: [], volume: "medium", budget: "balanced",
  }, mockConfig);

  assert(isSupervisorRole(supBp.role, supBp.id), "调度员被识别为 Supervisor");
  assert(
    supCapsWithConfig.model.primary === "qwen/qwen-max",
    `Supervisor 使用用户配置的模型 (实际: ${supCapsWithConfig.model.primary})`,
  );

  // Test 2: Without user config → fallback to best available (SOTA when no providers configured)
  const supCapsNoConfig = inferAgentCapabilities(supBp, {
    scenario: "general", channels: [], resources: [], volume: "medium", budget: "balanced",
  });
  assert(
    supCapsNoConfig.model.primary.length > 0,
    `Supervisor 无配置时 fallback 正常 (实际: ${supCapsNoConfig.model.primary})`,
  );

  // Test: Simple role downgrade
  console.log("\n  --- 简单角色降级 ---");
  const simpleBp: AgentBlueprint = {
    name: "转发助手",
    id: "forwarder",
    role: "转发消息、提醒通知",
    soul: "",
    modelTier: "mid",
    tools: { allow: [] },
  };

  const simpleCaps = inferAgentCapabilities(simpleBp, {
    scenario: "general", channels: [], resources: [], volume: "low", budget: "balanced",
  });

  assert(estimateRoleComplexity(simpleBp.role) === "simple", "转发角色复杂度=simple");
  // 非 premium 预算下，simple 角色应降级
  assert(
    !simpleCaps.model.primary.includes("opus") && !simpleCaps.model.primary.includes("o3"),
    `简单角色不用 SOTA 模型 (实际: ${simpleCaps.model.primary})`,
  );

  // Test: Runtime discovery matching
  console.log("\n  --- 运行时发现匹配 ---");
  const matchResult = matchCapabilitiesToRole("新闻监控和每日简报推送", "news", discovery);
  assert(matchResult.skills.length > 0, `新闻角色匹配到 ${matchResult.skills.length} 个 skills`);
  assert(
    matchResult.skills.includes("ai-daily-news") || matchResult.skills.includes("news-briefing"),
    `新闻角色匹配到新闻相关 skill (${matchResult.skills.join(", ")})`,
  );

  // Test: Merge strategy with low confidence
  console.log("\n  --- 合并策略 (低置信度) ---");
  const lowConfMatch = { skills: ["random-skill"], mcpServers: [], confidence: 0.1 };
  const merged = mergeWithStaticInference(lowConfMatch, ["web-researcher", "summarize"], []);
  assert(
    merged.skills[0] === "web-researcher",
    `低置信度时静态优先 (第一个: ${merged.skills[0]})`,
  );

  // Test: Merge strategy with high confidence
  const highConfMatch = { skills: ["ai-daily-news", "news-briefing"], mcpServers: [], confidence: 0.7 };
  const mergedHigh = mergeWithStaticInference(highConfMatch, ["web-researcher"], []);
  assert(
    mergedHigh.skills[0] === "ai-daily-news",
    `高置信度时运行时优先 (第一个: ${mergedHigh.skills[0]})`,
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  PART 4: Learning Engine + Soul Optimizer 闭环
// ══════════════════════════════════════════════════════════════════════════

function testLearningEngine(): void {
  section("Learning Engine 闭环测试");

  // Create a mock project
  const project = {
    projectId: "test-project",
    name: "测试团队",
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    supervisorId: "supervisor-1",
    members: [
      { id: "supervisor-1", name: "调度员", role: "supervisor", agentId: "sup-agent", keywords: [] },
      { id: "worker-1", name: "写作助手", role: "writer", agentId: "writer-agent", keywords: ["写作", "文案"] },
      { id: "worker-2", name: "搜索助手", role: "researcher", agentId: "search-agent", keywords: ["搜索", "查询"] },
      { id: "worker-3", name: "闲置助手", role: "idle", agentId: "idle-agent", keywords: ["其他"] },
    ],
    memberIds: ["supervisor-1", "worker-1", "worker-2", "worker-3"],
  };

  // Build activity events simulating real usage
  const events: ActivityEventLike[] = [];

  // Worker-1 (写作): 超高成功率 (≥95% to trigger success_pattern)
  for (let i = 0; i < 20; i++) {
    events.push({
      agentId: "worker-1",
      method: "agent_message",
      success: i < 19, // 95% success (19/20)
      durationMs: 2000 + Math.random() * 3000,
      taskType: "writing",
      matchedPattern: "写作",
    });
  }

  // Worker-2 (搜索): 高失败率 + 超时 (avgDuration > 15s for timeout_pattern)
  for (let i = 0; i < 15; i++) {
    events.push({
      agentId: "worker-2",
      method: "agent_message",
      success: i < 5, // 33% success
      outcome: i >= 10 ? "timeout" : undefined, // 5 timeouts in last events
      durationMs: 16000 + Math.random() * 5000, // avg ~18s, above 15s threshold
      error: i >= 5 ? "搜索超时" : undefined,
      taskType: "search",
      matchedPattern: "搜索",
    });
  }

  // Worker-3 (闲置): 几乎不使用
  events.push({
    agentId: "worker-3",
    method: "agent_message",
    success: true,
    durationMs: 1000,
    taskType: "other",
  });

  // Supervisor events
  for (let i = 0; i < 15; i++) {
    events.push({
      agentId: "supervisor-1",
      method: "agent_message",
      success: true,
      durationMs: 500,
    });
  }

  // Build health and stats maps
  let healthW1 = createInitialMemberHealth("worker-1");
  let healthW2 = createInitialMemberHealth("worker-2");
  let healthW3 = createInitialMemberHealth("worker-3");
  let statsW1 = createInitialMemberStats("worker-1");
  let statsW2 = createInitialMemberStats("worker-2");
  let statsW3 = createInitialMemberStats("worker-3");

  // Simulate health FSM
  for (let i = 0; i < 19; i++) healthW1 = recordMemberSuccess(healthW1);
  for (let i = 0; i < 1; i++) healthW1 = recordMemberFailure(healthW1);

  for (let i = 0; i < 5; i++) healthW2 = recordMemberSuccess(healthW2);
  for (let i = 0; i < 10; i++) healthW2 = recordMemberFailure(healthW2, "搜索超时");

  healthW3 = recordMemberSuccess(healthW3);

  // Simulate stats
  for (let i = 0; i < 20; i++) statsW1 = recordMemberCall(statsW1, 3000);
  for (let i = 0; i < 15; i++) statsW2 = recordMemberCall(statsW2, 18000);
  statsW3 = recordMemberCall(statsW3, 1000);

  const healthMap = new Map([
    ["worker-1", healthW1],
    ["worker-2", healthW2],
    ["worker-3", healthW3],
  ]);
  const statsMap = new Map([
    ["worker-1", statsW1],
    ["worker-2", statsW2],
    ["worker-3", statsW3],
  ]);

  // ── Test 1: shouldTriggerLearning ──
  console.log("\n  --- 学习触发条件 ---");
  assert(shouldTriggerLearning(50), "50 事件触发学习");
  assert(!shouldTriggerLearning(30), "30 事件不触发学习");

  // ── Test 2: analyzeLearningOpportunities ──
  console.log("\n  --- 学习分析 ---");
  const analysis = analyzeLearningOpportunities(
    "test-project", events, healthMap, statsMap, project as any,
  );

  assert(analysis.eventCount === events.length, `分析了 ${events.length} 个事件`);
  assert(analysis.insights.length > 0, `发现 ${analysis.insights.length} 个洞察`);

  // 应该发现搜索助手的高失败率
  const failureInsight = analysis.insights.find(
    i => i.category === "routing_failure" && i.agentIds.includes("worker-2"),
  );
  assert(!!failureInsight, "检测到搜索助手高失败率");

  // 应该检测到超时模式
  const timeoutInsight = analysis.insights.find(
    i => i.category === "timeout_pattern" && i.agentIds.includes("worker-2"),
  );
  assert(!!timeoutInsight, "检测到搜索助手超时模式");

  // 应该检测到闲置助手
  const underutilInsight = analysis.insights.find(
    i => i.category === "underutilized_agent" && i.agentIds.includes("worker-3"),
  );
  assert(!!underutilInsight, "检测到闲置助手未充分使用");

  // 应该检测到写作助手的成功模式
  const successInsight = analysis.insights.find(
    i => i.category === "success_pattern" && i.agentIds.includes("worker-1"),
  );
  assert(!!successInsight, "检测到写作助手高成功率");

  // 路由模式
  assert(analysis.routingPatterns.length > 0, `学习到 ${analysis.routingPatterns.length} 个路由模式`);

  // 特化画像
  assert(analysis.specializations.length > 0, `构建 ${analysis.specializations.length} 个成员画像`);

  console.log(`\n  分析摘要: ${analysis.summary}`);

  // ── Test 3: findBetterAlternative role compatibility ──
  console.log("\n  --- 角色兼容性检查 ---");
  // failureInsight 不应推荐 worker-3（闲置助手，不同 taskType）
  if (failureInsight) {
    const suggestion = failureInsight.suggestion;
    assert(
      !suggestion.includes("闲置助手"),
      `不推荐无关角色 (suggestion: ${suggestion.slice(0, 50)})`,
    );
  }

  // ── Test 4: applyAutoOptimizations ──
  console.log("\n  --- 自动优化 ---");
  const { updatedProject, appliedChanges } = applyAutoOptimizations(project as any, analysis);
  console.log(`  应用了 ${appliedChanges.length} 项优化:`);
  for (const change of appliedChanges) {
    console.log(`    - ${change}`);
  }

  if (appliedChanges.length > 0) {
    assert(updatedProject.version > project.version, "版本号递增");
  }

  // ── Test 5: generateLearningHints ──
  console.log("\n  --- 学习提示生成 ---");
  const hints = generateLearningHints(analysis);
  assert(hints.includes("<learning-hints>"), "提示包含 learning-hints 标签");
  assert(hints.includes("</learning-hints>"), "提示包含关闭标签");
  assert(hints.length <= 600, `提示长度 ≤ 600 (实际: ${hints.length})`);
  console.log(`  提示内容 (${hints.length} chars):`);
  console.log("  " + hints.split("\n").join("\n  "));

  // ── Test 6: Soul Optimizer ──
  console.log("\n  --- Soul Optimizer ---");
  const mockSoul = `# Team SOUL

## Role Assignment
调度员分配任务。

## Quality Gates
确保质量。

## Operating Rules
遵循规则。`;

  const updatedSoul = appendLearningHintsToSoul(mockSoul, hints);
  assert(updatedSoul.includes("<learning-hints>"), "SOUL 包含学习提示");
  assert(updatedSoul.indexOf("<learning-hints>") > updatedSoul.indexOf("Quality Gates"), "学习提示在 Quality Gates 之后");
  assert(updatedSoul.indexOf("<learning-hints>") < updatedSoul.indexOf("Operating Rules"), "学习提示在 Operating Rules 之前");

  // Replace existing hints
  const newHints = "<learning-hints>\nUpdated hints\n</learning-hints>";
  const replacedSoul = appendLearningHintsToSoul(updatedSoul, newHints);
  const hintsCount = (replacedSoul.match(/<learning-hints>/g) ?? []).length;
  assert(hintsCount === 1, "替换后只有一个 learning-hints 块");

  // Remove hints
  const cleanSoul = removeLearningHintsFromSoul(replacedSoul);
  assert(!cleanSoul.includes("<learning-hints>"), "移除后无 learning-hints");

  // ── Test 7: buildSupervisorLearningContext ──
  console.log("\n  --- Supervisor 上下文增强 ---");
  const learningCtx = buildSupervisorLearningContext(
    project as any, analysis, statsMap, healthMap,
  );
  assert(learningCtx.length > 0, "学习上下文已生成");
  assert(learningCtx.includes("Live Member Stats"), "包含成员统计");
  console.log(`  上下文内容 (${learningCtx.length} chars):`);
  console.log("  " + learningCtx.split("\n").join("\n  "));

  // ── Test 8: buildMemberPerformanceProfile ──
  console.log("\n  --- 成员性能画像 ---");
  const profile = buildMemberPerformanceProfile(
    project as any, statsMap, healthMap, analysis.specializations,
  );
  assert(profile.length > 0, "性能画像已生成");
  assert(profile.includes("写作助手"), "包含写作助手");
  assert(profile.includes("搜索助手"), "包含搜索助手");

  // ── Test 9: formatLearningReport ──
  console.log("\n  --- 学习报告 ---");
  const report = formatLearningReport(analysis);
  assert(report.includes("学习分析报告"), "报告标题正确");
  assert(report.includes("洞察"), "包含洞察部分");
  assert(report.includes("成员画像"), "包含成员画像");
  console.log(`  报告 (${report.length} chars)`);
}

// ══════════════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║       Pipeline Audit — Agent Team 质量考核                   ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  try {
    // Part 1: 典型场景
    testContentTeam();
    testCustomerSupportTeam();
    testCodingTeam();
    testDataTeam();

    // Part 2: 边界测试
    testEdgeCases();

    // Part 3: 能力推断质量
    testCapabilityInference();

    // Part 4: 学习闭环
    testLearningEngine();
  } catch (err) {
    console.error(`\n${FAIL} 测试执行出错:`, err);
    failedTests++;
  }

  // Final Report
  section("考核结果汇总");

  console.log(`\n  总测试数: ${totalTests}`);
  console.log(`  ${PASS} 通过: ${passedTests}`);
  console.log(`  ${FAIL} 失败: ${failedTests}`);
  console.log(`  通过率: ${totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0}%`);

  if (issues.length > 0) {
    console.log(`\n  ${WARN} 发现的问题:`);
    for (const issue of issues) {
      console.log(`    - ${issue}`);
    }
  }

  const grade =
    failedTests === 0 ? "A+ (优秀)"
    : failedTests <= 2 ? "A (良好)"
    : failedTests <= 5 ? "B (合格)"
    : failedTests <= 10 ? "C (需改进)"
    : "D (不合格)";

  console.log(`\n  🏆 综合评级: ${grade}`);
  console.log();

  process.exit(failedTests > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(2);
});
