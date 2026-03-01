import { executePlanningPipeline, formatPipelineReport } from "./planning-pipeline.js";
import { verifyScene, formatVerificationReport } from "./scene-verifier.js";
import { inferAgentCapabilities, estimateRoleComplexity, isSupervisorRole } from "./capability-inference.js";
import { matchCapabilitiesToRole, mergeWithStaticInference } from "./runtime-discovery.js";
import {
  analyzeLearningOpportunities,
  applyAutoOptimizations,
  generateLearningHints,
  formatLearningReport,
  shouldTriggerLearning
} from "../../../agent-team/src/learning-engine.js";
import {
  buildMemberPerformanceProfile,
  appendLearningHintsToSoul,
  removeLearningHintsFromSoul,
  buildSupervisorLearningContext
} from "../../../agent-team/src/soul-optimizer.js";
import { createInitialMemberHealth, recordMemberSuccess, recordMemberFailure } from "../../../agent-team/src/member-health.js";
import { createInitialMemberStats, recordMemberCall } from "../../../agent-team/src/member-stats.js";
const PASS = "\u2705";
const FAIL = "\u274C";
const WARN = "\u26A0\uFE0F";
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const issues = [];
function assert(condition, testName, detail) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${PASS} ${testName}`);
  } else {
    failedTests++;
    const msg = `${testName}${detail ? ` \u2014 ${detail}` : ""}`;
    console.log(`  ${FAIL} ${msg}`);
    issues.push(msg);
  }
}
function section(title) {
  console.log(`
${"\u2550".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"\u2550".repeat(60)}`);
}
function createMockDiscovery() {
  return {
    skills: [
      { name: "web-researcher", description: "\u641C\u7D22\u5F15\u64CE\u8C03\u7814\u548C\u7F51\u9875\u5185\u5BB9\u63D0\u53D6", source: "bundled" },
      { name: "summarize", description: "\u6587\u672C\u6458\u8981\u548C\u603B\u7ED3", source: "bundled" },
      { name: "xiaohongshu", description: "\u5C0F\u7EA2\u4E66\u5185\u5BB9\u53D1\u5E03\u548C\u7BA1\u7406", source: "managed" },
      { name: "coding-agent", description: "\u4EE3\u7801\u751F\u6210\u3001\u8C03\u8BD5\u548C\u4EE3\u7801\u5BA1\u67E5", source: "bundled" },
      { name: "github", description: "GitHub \u4ED3\u5E93\u64CD\u4F5C\u548C PR \u7BA1\u7406", source: "managed" },
      { name: "nano-pdf", description: "PDF \u6587\u6863\u89E3\u6790\u548C\u63D0\u53D6", source: "bundled" },
      { name: "ai-daily-news", description: "\u6BCF\u65E5\u65B0\u95FB\u805A\u5408\u548C\u63A8\u9001", source: "managed" },
      { name: "csv-analyzer", description: "CSV \u6570\u636E\u5206\u6790\u548C\u53EF\u89C6\u5316", source: "bundled" },
      { name: "self-troubleshoot", description: "\u81EA\u52A9\u6545\u969C\u6392\u67E5\u548C FAQ \u751F\u6210", source: "bundled" },
      { name: "news-briefing", description: "\u65B0\u95FB\u7B80\u62A5\u751F\u6210\u548C\u63A8\u9001", source: "managed" },
      { name: "image-helper", description: "\u56FE\u7247\u751F\u6210\u548C\u7F16\u8F91\u8F85\u52A9", source: "managed" },
      { name: "copywriting", description: "\u6587\u6848\u521B\u4F5C\u548C\u4F18\u5316", source: "managed" },
      { name: "calendar", description: "\u65E5\u7A0B\u7BA1\u7406\u548C\u63D0\u9192", source: "bundled" }
    ],
    mcpServers: [
      { id: "mcp-server-sqlite", enabled: true, running: true, tools: [{ name: "query", description: "Execute SQL queries" }] },
      { id: "@mcp/server-filesystem", enabled: true, running: true, tools: [{ name: "read_file", description: "Read file contents" }] },
      { id: "@modelcontextprotocol/server-github", enabled: true, running: true, tools: [{ name: "create_issue", description: "Create GitHub issue" }] }
    ],
    timestamp: Date.now()
  };
}
function createContentTeamBlueprints() {
  return [
    {
      name: "\u9009\u9898\u96F7\u8FBE",
      id: "topic-radar",
      role: "\u8D1F\u8D23\u70ED\u70B9\u76D1\u63A7\u3001\u9009\u9898\u53D1\u73B0\u548C\u8D8B\u52BF\u5206\u6790\uFF0C\u6BCF\u65E5\u63A8\u9001\u4F18\u8D28\u9009\u9898\u5EFA\u8BAE",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    },
    {
      name: "\u5185\u5BB9\u521B\u4F5C\u8005",
      id: "content-writer",
      role: "\u6839\u636E\u9009\u9898\u64B0\u5199\u6587\u7AE0\u3001\u6587\u6848\uFF0C\u652F\u6301\u5C0F\u7EA2\u4E66\u3001\u516C\u4F17\u53F7\u7B49\u591A\u5E73\u53F0\u683C\u5F0F",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u914D\u56FE\u5E08",
      id: "image-creator",
      role: "\u4E3A\u6587\u7AE0\u548C\u5E16\u5B50\u751F\u6210\u914D\u56FE\u3001\u5C01\u9762\u56FE\uFF0C\u652F\u6301\u591A\u79CD\u98CE\u683C",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    },
    {
      name: "SEO \u4F18\u5316\u5E08",
      id: "seo-optimizer",
      role: "\u5BF9\u5185\u5BB9\u8FDB\u884CSEO\u4F18\u5316\uFF0C\u5173\u952E\u8BCD\u5206\u6790\uFF0C\u6807\u9898\u4F18\u5316",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    }
  ];
}
function createCustomerSupportBlueprints() {
  return [
    {
      name: "\u524D\u53F0\u63A5\u5F85",
      id: "reception",
      role: "\u63A5\u5F85\u7528\u6237\u54A8\u8BE2\uFF0C\u521D\u6B65\u5206\u7C7B\u95EE\u9898\u7C7B\u578B\uFF0C\u8F6C\u63A5\u5230\u5BF9\u5E94\u4E13\u5BB6",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    },
    {
      name: "\u6280\u672F\u652F\u6301",
      id: "tech-support",
      role: "\u5904\u7406\u6280\u672F\u95EE\u9898\u3001\u6545\u969C\u6392\u67E5\u3001\u7CFB\u7EDF\u914D\u7F6E\u6307\u5BFC",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "FAQ \u7BA1\u7406\u5458",
      id: "faq-admin",
      role: "\u7EF4\u62A4FAQ\u77E5\u8BC6\u5E93\uFF0C\u81EA\u52A8\u56DE\u7B54\u5E38\u89C1\u95EE\u9898\uFF0C\u751F\u6210\u65B0FAQ",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    }
  ];
}
function createCodingTeamBlueprints() {
  return [
    {
      name: "\u67B6\u6784\u5E08",
      id: "architect",
      role: "\u4EE3\u7801\u67B6\u6784\u8BBE\u8BA1\u3001\u6280\u672F\u65B9\u6848\u8BC4\u5BA1\u3001\u7F16\u7A0B\u6307\u5BFC",
      soul: "",
      modelTier: "sota",
      tools: { allow: [] }
    },
    {
      name: "\u7F16\u7801\u52A9\u624B",
      id: "coder",
      role: "\u4EE3\u7801\u7F16\u5199\u3001\u529F\u80FD\u5B9E\u73B0\u3001\u7F16\u7A0B\u5F00\u53D1",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "Code Reviewer",
      id: "reviewer",
      role: "\u4EE3\u7801\u5BA1\u67E5\u3001\u4EE3\u7801\u8D28\u91CF\u5206\u6790\u3001review PR",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u6D4B\u8BD5\u5DE5\u7A0B\u5E08",
      id: "tester",
      role: "\u7F16\u5199\u6D4B\u8BD5\u7528\u4F8B\u3001\u8FD0\u884C\u6D4B\u8BD5\u3001\u8D28\u91CF\u4FDD\u8BC1",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    }
  ];
}
function createDataTeamBlueprints() {
  return [
    {
      name: "\u6570\u636E\u91C7\u96C6\u5458",
      id: "data-collector",
      role: "\u4ECE\u6570\u636E\u5E93\u3001API\u3001\u6587\u4EF6\u91C7\u96C6\u6570\u636E\uFF0C\u6570\u636E\u6E05\u6D17\u548C\u9884\u5904\u7406",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    },
    {
      name: "\u6570\u636E\u5206\u6790\u5E08",
      id: "data-analyst",
      role: "\u6DF1\u5EA6\u6570\u636E\u5206\u6790\u3001\u7EDF\u8BA1\u5EFA\u6A21\u3001\u8D8B\u52BF\u9884\u6D4B",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u62A5\u8868\u751F\u6210\u5668",
      id: "report-gen",
      role: "\u751F\u6210\u53EF\u89C6\u5316\u62A5\u8868\u3001\u6570\u636E\u770B\u677F\u3001\u5468\u62A5\u6708\u62A5",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    }
  ];
}
function testContentTeam() {
  section("\u573A\u666F1: \u81EA\u5A92\u4F53\u5185\u5BB9\u5DE5\u5382 (content)");
  const userCtx = {
    scenario: "content",
    channels: ["wechat"],
    resources: [],
    volume: "medium",
    budget: "balanced"
  };
  const discovery = createMockDiscovery();
  const blueprints = createContentTeamBlueprints();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "\u642D\u5EFA\u4E00\u4E2A\u81EA\u5A92\u4F53\u5185\u5BB9\u5DE5\u5382\uFF0C\u5305\u542B\u9009\u9898\u3001\u5199\u4F5C\u3001\u914D\u56FE\u3001SEO\u4F18\u5316\u5168\u6D41\u7A0B",
    userCtx,
    discovery
  });
  console.log("\n  \u{1F4CA} Pipeline \u7ED3\u679C:");
  console.log(`     \u603B\u8F6E\u6B21: ${result.totalRounds}`);
  console.log(`     \u8986\u76D6\u7387: ${result.coverageScore}%`);
  console.log(`     \u53EF\u884C\u6027: ${result.feasibilityScore}%`);
  console.log(`     \u9A8C\u8BC1\u901A\u8FC7: ${result.verification.overallPass}`);
  console.log(`     \u9A8C\u8BC1\u5206\u6570: ${result.verification.score}`);
  console.log(`     Agents: ${result.blueprints.length}`);
  console.log(`     \u81EA\u52A8\u4F18\u5316: ${result.refinementSummary}`);
  console.log();
  assert(result.verification.overallPass, "\u9A8C\u8BC1\u901A\u8FC7");
  assert(result.verification.score >= 60, `\u9A8C\u8BC1\u5206\u6570 \u2265 60 (\u5B9E\u9645: ${result.verification.score})`);
  assert(result.coverageScore >= 70, `\u9700\u6C42\u8986\u76D6\u7387 \u2265 70% (\u5B9E\u9645: ${result.coverageScore}%)`);
  assert(result.blueprints.length >= 3, `\u56E2\u961F\u6210\u5458 \u2265 3 (\u5B9E\u9645: ${result.blueprints.length})`);
  for (const bp of result.blueprints) {
    const caps = bp.inferredCapabilities;
    assert(!!caps, `${bp.name}: inferredCapabilities \u5DF2\u63A8\u65AD`);
    if (caps) {
      assert(!!caps.model?.primary, `${bp.name}: \u6A21\u578B\u5DF2\u5206\u914D (${caps.model.primary})`);
      assert(caps.skills.length <= 5, `${bp.name}: skills \u2264 5 (\u5B9E\u9645: ${caps.skills.length})`);
      assert(caps.mcpHints.length <= 7, `${bp.name}: MCP \u2264 7 (\u5B9E\u9645: ${caps.mcpHints.length})`);
      assert(!!caps.tools?.profile, `${bp.name}: \u5DE5\u5177 profile \u5DF2\u8BBE\u7F6E (${caps.tools?.profile})`);
    }
  }
  const supervisorBp = result.blueprints.find((bp) => isSupervisorRole(bp.role, bp.id));
  const writer = result.blueprints.find((bp) => bp.id === "content-writer");
  if (writer?.inferredCapabilities?.model) {
    const model = writer.inferredCapabilities.model.primary;
    assert(
      !model.includes("deepseek-chat"),
      // 写作不应该用最便宜的模型
      `\u5185\u5BB9\u521B\u4F5C\u8005\u4E0D\u5E94\u7528 cheap \u6A21\u578B (\u5B9E\u9645: ${model})`
    );
  }
  const report = formatPipelineReport(result);
  assert(report.length > 50, "Pipeline \u62A5\u544A\u5DF2\u751F\u6210");
  assert(report.includes("\u9700\u6C42\u8986\u76D6\u7387"), "\u62A5\u544A\u5305\u542B\u8986\u76D6\u7387");
  const vReport = formatVerificationReport(result.verification);
  assert(vReport.length > 50, "\u9A8C\u8BC1\u62A5\u544A\u5DF2\u751F\u6210");
  console.log("\n  \u{1F4CB} Pipeline Report:");
  console.log("  " + report.split("\n").join("\n  "));
  console.log("\n  \u{1F4CB} Verification Report:");
  console.log("  " + vReport.split("\n").join("\n  "));
}
function testCustomerSupportTeam() {
  section("\u573A\u666F2: \u4F01\u4E1A\u5BA2\u670D\u56E2\u961F (customer_support)");
  const userCtx = {
    scenario: "customer_support",
    channels: ["wechat", "web"],
    resources: ["faq_doc"],
    volume: "high",
    budget: "balanced"
  };
  const discovery = createMockDiscovery();
  const blueprints = createCustomerSupportBlueprints();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "\u642D\u5EFA\u4F01\u4E1A\u667A\u80FD\u5BA2\u670D\u7CFB\u7EDF\uFF0C\u652F\u6301\u5FAE\u4FE1\u548C\u7F51\u9875\u6E20\u9053\uFF0C\u9700\u8981FAQ\u77E5\u8BC6\u5E93\u548C\u5DE5\u5355\u7CFB\u7EDF",
    userCtx,
    discovery
  });
  console.log("\n  \u{1F4CA} Pipeline \u7ED3\u679C:");
  console.log(`     \u603B\u8F6E\u6B21: ${result.totalRounds}`);
  console.log(`     \u8986\u76D6\u7387: ${result.coverageScore}%`);
  console.log(`     \u53EF\u884C\u6027: ${result.feasibilityScore}%`);
  console.log(`     \u9A8C\u8BC1\u901A\u8FC7: ${result.verification.overallPass}`);
  console.log(`     \u9A8C\u8BC1\u5206\u6570: ${result.verification.score}`);
  console.log();
  assert(result.verification.score >= 40, `\u5BA2\u670D\u56E2\u961F\u5206\u6570 \u2265 40 (\u5B9E\u9645: ${result.verification.score})`);
  assert(result.verification.score <= 80, `\u5BA2\u670D\u56E2\u961F\u5206\u6570 \u2264 80\uFF08\u4ECD\u6709\u4E0D\u8DB3\uFF09(\u5B9E\u9645: ${result.verification.score})`);
  assert(result.coverageScore >= 50, `\u8986\u76D6\u7387 \u2265 50% (\u5B9E\u9645: ${result.coverageScore}%)`);
  const reception = result.blueprints.find((bp) => bp.id === "reception");
  if (reception?.inferredCapabilities) {
    const tools = reception.inferredCapabilities.tools;
    const alsoAllow = tools?.alsoAllow ?? [];
    assert(
      alsoAllow.some((t) => t.includes("wechat") || t.includes("messaging")),
      `\u524D\u53F0\u63A5\u5F85\u6709\u5FAE\u4FE1/\u6D88\u606F\u5DE5\u5177 (alsoAllow: ${alsoAllow.join(", ")})`
    );
  }
  const faq = result.blueprints.find((bp) => bp.id === "faq-admin");
  if (faq?.inferredCapabilities) {
    assert(
      faq.inferredCapabilities.memorySearch?.enabled === true,
      `FAQ \u7BA1\u7406\u5458\u542F\u7528\u4E86 memorySearch`
    );
  }
  const channelCheck = result.verification.checks.find((c) => c.name === "channel_coverage");
  assert(channelCheck?.pass === true, `\u6E20\u9053\u8986\u76D6\u68C0\u67E5\u901A\u8FC7`);
  const vReport = formatVerificationReport(result.verification);
  console.log("\n  \u{1F4CB} Verification Report:");
  console.log("  " + vReport.split("\n").join("\n  "));
}
function testCodingTeam() {
  section("\u573A\u666F3: \u7F16\u7A0B\u52A9\u624B\u56E2\u961F (coding)");
  const userCtx = {
    scenario: "coding",
    channels: [],
    resources: ["github"],
    volume: "medium",
    budget: "premium"
  };
  const discovery = createMockDiscovery();
  const blueprints = createCodingTeamBlueprints();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "\u642D\u5EFA\u7F16\u7A0B\u52A9\u624B\u56E2\u961F\uFF0C\u652F\u6301\u4EE3\u7801\u7F16\u5199\u3001\u5BA1\u67E5\u3001\u6D4B\u8BD5\u5168\u6D41\u7A0B\uFF0C\u96C6\u6210GitHub",
    userCtx,
    discovery
  });
  console.log("\n  \u{1F4CA} Pipeline \u7ED3\u679C:");
  console.log(`     \u603B\u8F6E\u6B21: ${result.totalRounds}`);
  console.log(`     \u8986\u76D6\u7387: ${result.coverageScore}%`);
  console.log(`     \u53EF\u884C\u6027: ${result.feasibilityScore}%`);
  console.log(`     \u9A8C\u8BC1\u901A\u8FC7: ${result.verification.overallPass}`);
  console.log(`     \u9A8C\u8BC1\u5206\u6570: ${result.verification.score}`);
  console.log();
  assert(result.verification.overallPass, "\u9A8C\u8BC1\u901A\u8FC7");
  assert(estimateRoleComplexity("\u4EE3\u7801\u67B6\u6784\u8BBE\u8BA1\u3001\u6280\u672F\u65B9\u6848\u8BC4\u5BA1") === "complex", "\u67B6\u6784\u5E08\u89D2\u8272\u590D\u6742\u5EA6=complex");
  assert(!isSupervisorRole("\u4EE3\u7801\u7F16\u5199\u3001\u529F\u80FD\u5B9E\u73B0"), "\u666E\u901A\u7F16\u7801\u89D2\u8272\u4E0D\u5E94\u88AB\u8BC6\u522B\u4E3A Supervisor");
  const resourceCheck = result.verification.checks.find((c) => c.name === "resource_coverage");
  assert(resourceCheck?.pass === true, `GitHub \u8D44\u6E90\u8986\u76D6\u68C0\u67E5\u901A\u8FC7`);
  for (const bp of result.blueprints) {
    if (bp.inferredCapabilities?.model) {
      const model = bp.inferredCapabilities.model.primary;
      assert(model.length > 0, `${bp.name}: \u6A21\u578B\u5DF2\u5206\u914D`);
    }
  }
  const vReport = formatVerificationReport(result.verification);
  console.log("\n  \u{1F4CB} Verification Report:");
  console.log("  " + vReport.split("\n").join("\n  "));
}
function testDataTeam() {
  section("\u573A\u666F4: \u6570\u636E\u5206\u6790\u56E2\u961F (data_analysis)");
  const userCtx = {
    scenario: "data_analysis",
    channels: [],
    resources: ["database", "pdf"],
    volume: "medium",
    budget: "balanced"
  };
  const discovery = createMockDiscovery();
  const blueprints = createDataTeamBlueprints();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "\u642D\u5EFA\u6570\u636E\u5206\u6790\u56E2\u961F\uFF0C\u652F\u6301\u6570\u636E\u5E93\u67E5\u8BE2\u3001PDF\u62A5\u544A\u89E3\u6790\u3001\u6570\u636E\u53EF\u89C6\u5316",
    userCtx,
    discovery
  });
  console.log("\n  \u{1F4CA} Pipeline \u7ED3\u679C:");
  console.log(`     \u603B\u8F6E\u6B21: ${result.totalRounds}`);
  console.log(`     \u8986\u76D6\u7387: ${result.coverageScore}%`);
  console.log(`     \u53EF\u884C\u6027: ${result.feasibilityScore}%`);
  console.log(`     \u9A8C\u8BC1\u901A\u8FC7: ${result.verification.overallPass}`);
  console.log(`     \u9A8C\u8BC1\u5206\u6570: ${result.verification.score}`);
  console.log();
  assert(result.verification.overallPass, "\u9A8C\u8BC1\u901A\u8FC7");
  const resourceCheck = result.verification.checks.find((c) => c.name === "resource_coverage");
  assert(resourceCheck?.pass === true, `\u6570\u636E\u5E93+PDF \u8D44\u6E90\u8986\u76D6 (${resourceCheck?.detail})`);
  const vReport = formatVerificationReport(result.verification);
  console.log("\n  \u{1F4CB} Verification Report:");
  console.log("  " + vReport.split("\n").join("\n  "));
}
function testEdgeCases() {
  section("\u8FB9\u754C\u6D4B\u8BD5");
  const discovery = createMockDiscovery();
  console.log("\n  --- \u8D85\u5927\u56E2\u961F ---");
  const bigTeam = Array.from({ length: 10 }, (_, i) => ({
    name: `Agent-${i}`,
    id: `agent-${i}`,
    role: `\u8D1F\u8D23\u7B2C${i}\u9879\u5DE5\u4F5C`,
    soul: "",
    modelTier: "cheap",
    tools: { allow: [] }
  }));
  const bigResult = executePlanningPipeline({
    blueprints: bigTeam,
    requirement: "\u8D85\u5927\u56E2\u961F\u6D4B\u8BD5",
    userCtx: { scenario: "general", channels: [], resources: [], volume: "low", budget: "cheap" }
  });
  const structureWarning = bigResult.rounds.flatMap((r) => r.issues).some((i) => i.message.includes("\u56E2\u961F\u89C4\u6A21\u8FC7\u5927"));
  assert(structureWarning, "\u8D85\u5927\u56E2\u961F\u89E6\u53D1\u89C4\u6A21\u8B66\u544A");
  console.log("\n  --- \u91CD\u590D ID ---");
  const dupTeam = [
    { name: "Agent A", id: "dup-id", role: "\u4EFB\u52A1A", soul: "", modelTier: "cheap", tools: { allow: [] } },
    { name: "Agent B", id: "dup-id", role: "\u4EFB\u52A1B", soul: "", modelTier: "cheap", tools: { allow: [] } }
  ];
  const dupResult = executePlanningPipeline({
    blueprints: dupTeam,
    requirement: "\u91CD\u590D ID \u6D4B\u8BD5",
    userCtx: { scenario: "general", channels: [], resources: [], volume: "low", budget: "cheap" }
  });
  const hasDupIssue = dupResult.rounds.flatMap((r) => r.issues).some((i) => i.message.includes("\u91CD\u590D"));
  assert(hasDupIssue, "\u91CD\u590D ID \u88AB\u68C0\u6D4B\u5230");
  console.log("\n  --- \u9AD8\u5EA6\u91CD\u53E0\u89D2\u8272 ---");
  const overlapTeam = Array.from({ length: 7 }, (_, i) => ({
    name: `\u5199\u4F5C\u52A9\u624B-${i}`,
    id: `writer-${i}`,
    role: "\u8D1F\u8D23\u6587\u6848\u5199\u4F5C\u3001\u5185\u5BB9\u521B\u4F5C\u3001\u6587\u7AE0\u64B0\u5199",
    soul: "",
    modelTier: "cheap",
    tools: { allow: [] }
  }));
  const overlapResult = executePlanningPipeline({
    blueprints: overlapTeam,
    requirement: "\u5199\u4F5C\u56E2\u961F",
    userCtx: { scenario: "content", channels: [], resources: [], volume: "low", budget: "cheap" }
  });
  const overlapWarning = overlapResult.rounds.flatMap((r) => r.issues).some((i) => i.category === "overlap");
  assert(overlapWarning, "\u9AD8\u5EA6\u91CD\u53E0\u89D2\u8272\u88AB\u68C0\u6D4B\u5230");
  assert(
    overlapResult.blueprints.length < 7,
    `\u91CD\u53E0 agent \u88AB\u5408\u5E76 (7\u2192${overlapResult.blueprints.length})`
  );
  console.log("\n  --- CJK \u5339\u914D\u7CBE\u5EA6 ---");
  const cjkTeam = [
    { name: "\u4EE3\u7406\u7BA1\u7406", id: "proxy", role: "\u7BA1\u7406\u7F51\u7EDC\u4EE3\u7406\u548C\u8F6C\u53D1", soul: "", modelTier: "cheap", tools: { allow: [] } }
  ];
  const cjkResult = verifyScene({
    requirement: "\u9700\u8981\u4EE3\u7801\u7F16\u5199\u548C\u4EE3\u7801\u5BA1\u67E5\u529F\u80FD",
    blueprints: cjkTeam,
    userCtx: { scenario: "coding", channels: [], resources: [], volume: "low", budget: "cheap" }
  });
  const coverageCheck = cjkResult.checks.find((c) => c.name === "requirement_coverage");
  assert(
    !coverageCheck?.pass || cjkResult.gaps.length > 0,
    `CJK \u7CBE\u786E\u5339\u914D: "\u4EE3\u7801" \u4E0D\u8BEF\u5339\u914D "\u4EE3\u7406" (gaps: ${cjkResult.gaps.length})`
  );
  console.log("\n  --- Skills \u8D85\u9650\u81EA\u52A8\u88C1\u526A ---");
  const overSkillBp = {
    name: "\u4E07\u80FD\u9009\u624B",
    id: "all-in-one",
    role: "\u641C\u7D22\u65B0\u95FB\u4EE3\u7801\u7FFB\u8BD1\u603B\u7ED3\u6570\u636E\u65E5\u7A0B\u5BA2\u670D\u5199\u4F5CPDF\u914D\u56FEgithub",
    soul: "",
    modelTier: "mid",
    tools: { allow: [] }
  };
  const caps = inferAgentCapabilities(overSkillBp, {
    scenario: "general",
    channels: [],
    resources: ["pdf", "github"],
    volume: "medium",
    budget: "balanced"
  }, void 0, discovery);
  assert(caps.skills.length <= 5, `Skills \u4E0D\u8D85\u8FC7 5 (\u5B9E\u9645: ${caps.skills.length})`);
  assert(caps.mcpHints.length <= 7, `MCP \u4E0D\u8D85\u8FC7 7 (\u5B9E\u9645: ${caps.mcpHints.length})`);
  console.log("\n  --- \u65E0\u6548\u6E20\u9053 ---");
  const channelResult = verifyScene({
    requirement: "\u6D4B\u8BD5\u6E20\u9053",
    blueprints: [{ name: "A", id: "a", role: "\u6D4B\u8BD5", soul: "", modelTier: "cheap", tools: { allow: [] } }],
    userCtx: { scenario: "general", channels: ["invalid_channel"], resources: [], volume: "low", budget: "cheap" }
  });
  const channelCheck = channelResult.checks.find((c) => c.name === "channel_coverage");
  assert(channelCheck?.pass === false, "\u65E0\u6548\u6E20\u9053\u88AB\u68C0\u6D4B\u5230");
}
function testCapabilityInference() {
  section("\u80FD\u529B\u63A8\u65AD\u8D28\u91CF\u68C0\u67E5");
  const discovery = createMockDiscovery();
  console.log("\n  --- Supervisor \u6A21\u578B\u9009\u62E9 ---");
  const supBp = {
    name: "\u8C03\u5EA6\u5458",
    id: "dispatcher",
    role: "\u5206\u53D1\u4EFB\u52A1\u3001\u8DEF\u7531\u6D88\u606F\u3001\u534F\u8C03\u56E2\u961F\u6210\u5458",
    soul: "",
    modelTier: "cheap",
    tools: { allow: [] }
  };
  const mockConfig = { agents: { defaults: { model: "qwen/qwen-max" } } };
  const supCapsWithConfig = inferAgentCapabilities(supBp, {
    scenario: "general",
    channels: [],
    resources: [],
    volume: "medium",
    budget: "balanced"
  }, mockConfig);
  assert(isSupervisorRole(supBp.role, supBp.id), "\u8C03\u5EA6\u5458\u88AB\u8BC6\u522B\u4E3A Supervisor");
  assert(
    supCapsWithConfig.model.primary === "qwen/qwen-max",
    `Supervisor \u4F7F\u7528\u7528\u6237\u914D\u7F6E\u7684\u6A21\u578B (\u5B9E\u9645: ${supCapsWithConfig.model.primary})`
  );
  const supCapsNoConfig = inferAgentCapabilities(supBp, {
    scenario: "general",
    channels: [],
    resources: [],
    volume: "medium",
    budget: "balanced"
  });
  assert(
    supCapsNoConfig.model.primary.length > 0,
    `Supervisor \u65E0\u914D\u7F6E\u65F6 fallback \u6B63\u5E38 (\u5B9E\u9645: ${supCapsNoConfig.model.primary})`
  );
  console.log("\n  --- \u7B80\u5355\u89D2\u8272\u964D\u7EA7 ---");
  const simpleBp = {
    name: "\u8F6C\u53D1\u52A9\u624B",
    id: "forwarder",
    role: "\u8F6C\u53D1\u6D88\u606F\u3001\u63D0\u9192\u901A\u77E5",
    soul: "",
    modelTier: "mid",
    tools: { allow: [] }
  };
  const simpleCaps = inferAgentCapabilities(simpleBp, {
    scenario: "general",
    channels: [],
    resources: [],
    volume: "low",
    budget: "balanced"
  });
  assert(estimateRoleComplexity(simpleBp.role) === "simple", "\u8F6C\u53D1\u89D2\u8272\u590D\u6742\u5EA6=simple");
  assert(
    !simpleCaps.model.primary.includes("opus") && !simpleCaps.model.primary.includes("o3"),
    `\u7B80\u5355\u89D2\u8272\u4E0D\u7528 SOTA \u6A21\u578B (\u5B9E\u9645: ${simpleCaps.model.primary})`
  );
  console.log("\n  --- \u8FD0\u884C\u65F6\u53D1\u73B0\u5339\u914D ---");
  const matchResult = matchCapabilitiesToRole("\u65B0\u95FB\u76D1\u63A7\u548C\u6BCF\u65E5\u7B80\u62A5\u63A8\u9001", "news", discovery);
  assert(matchResult.skills.length > 0, `\u65B0\u95FB\u89D2\u8272\u5339\u914D\u5230 ${matchResult.skills.length} \u4E2A skills`);
  assert(
    matchResult.skills.includes("ai-daily-news") || matchResult.skills.includes("news-briefing"),
    `\u65B0\u95FB\u89D2\u8272\u5339\u914D\u5230\u65B0\u95FB\u76F8\u5173 skill (${matchResult.skills.join(", ")})`
  );
  console.log("\n  --- \u5408\u5E76\u7B56\u7565 (\u4F4E\u7F6E\u4FE1\u5EA6) ---");
  const lowConfMatch = { skills: ["random-skill"], mcpServers: [], confidence: 0.1 };
  const merged = mergeWithStaticInference(lowConfMatch, ["web-researcher", "summarize"], []);
  assert(
    merged.skills[0] === "web-researcher",
    `\u4F4E\u7F6E\u4FE1\u5EA6\u65F6\u9759\u6001\u4F18\u5148 (\u7B2C\u4E00\u4E2A: ${merged.skills[0]})`
  );
  const highConfMatch = { skills: ["ai-daily-news", "news-briefing"], mcpServers: [], confidence: 0.7 };
  const mergedHigh = mergeWithStaticInference(highConfMatch, ["web-researcher"], []);
  assert(
    mergedHigh.skills[0] === "ai-daily-news",
    `\u9AD8\u7F6E\u4FE1\u5EA6\u65F6\u8FD0\u884C\u65F6\u4F18\u5148 (\u7B2C\u4E00\u4E2A: ${mergedHigh.skills[0]})`
  );
}
function testLearningEngine() {
  section("Learning Engine \u95ED\u73AF\u6D4B\u8BD5");
  const project = {
    projectId: "test-project",
    name: "\u6D4B\u8BD5\u56E2\u961F",
    version: 1,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    supervisorId: "supervisor-1",
    members: [
      { id: "supervisor-1", name: "\u8C03\u5EA6\u5458", role: "supervisor", agentId: "sup-agent", keywords: [] },
      { id: "worker-1", name: "\u5199\u4F5C\u52A9\u624B", role: "writer", agentId: "writer-agent", keywords: ["\u5199\u4F5C", "\u6587\u6848"] },
      { id: "worker-2", name: "\u641C\u7D22\u52A9\u624B", role: "researcher", agentId: "search-agent", keywords: ["\u641C\u7D22", "\u67E5\u8BE2"] },
      { id: "worker-3", name: "\u95F2\u7F6E\u52A9\u624B", role: "idle", agentId: "idle-agent", keywords: ["\u5176\u4ED6"] }
    ],
    memberIds: ["supervisor-1", "worker-1", "worker-2", "worker-3"]
  };
  const events = [];
  for (let i = 0; i < 20; i++) {
    events.push({
      agentId: "worker-1",
      method: "agent_message",
      success: i < 19,
      // 95% success (19/20)
      durationMs: 2e3 + Math.random() * 3e3,
      taskType: "writing",
      matchedPattern: "\u5199\u4F5C"
    });
  }
  for (let i = 0; i < 15; i++) {
    events.push({
      agentId: "worker-2",
      method: "agent_message",
      success: i < 5,
      // 33% success
      outcome: i >= 10 ? "timeout" : void 0,
      // 5 timeouts in last events
      durationMs: 16e3 + Math.random() * 5e3,
      // avg ~18s, above 15s threshold
      error: i >= 5 ? "\u641C\u7D22\u8D85\u65F6" : void 0,
      taskType: "search",
      matchedPattern: "\u641C\u7D22"
    });
  }
  events.push({
    agentId: "worker-3",
    method: "agent_message",
    success: true,
    durationMs: 1e3,
    taskType: "other"
  });
  for (let i = 0; i < 15; i++) {
    events.push({
      agentId: "supervisor-1",
      method: "agent_message",
      success: true,
      durationMs: 500
    });
  }
  let healthW1 = createInitialMemberHealth("worker-1");
  let healthW2 = createInitialMemberHealth("worker-2");
  let healthW3 = createInitialMemberHealth("worker-3");
  let statsW1 = createInitialMemberStats("worker-1");
  let statsW2 = createInitialMemberStats("worker-2");
  let statsW3 = createInitialMemberStats("worker-3");
  for (let i = 0; i < 19; i++) healthW1 = recordMemberSuccess(healthW1);
  for (let i = 0; i < 1; i++) healthW1 = recordMemberFailure(healthW1);
  for (let i = 0; i < 5; i++) healthW2 = recordMemberSuccess(healthW2);
  for (let i = 0; i < 10; i++) healthW2 = recordMemberFailure(healthW2, "\u641C\u7D22\u8D85\u65F6");
  healthW3 = recordMemberSuccess(healthW3);
  for (let i = 0; i < 20; i++) statsW1 = recordMemberCall(statsW1, 3e3);
  for (let i = 0; i < 15; i++) statsW2 = recordMemberCall(statsW2, 18e3);
  statsW3 = recordMemberCall(statsW3, 1e3);
  const healthMap = /* @__PURE__ */ new Map([
    ["worker-1", healthW1],
    ["worker-2", healthW2],
    ["worker-3", healthW3]
  ]);
  const statsMap = /* @__PURE__ */ new Map([
    ["worker-1", statsW1],
    ["worker-2", statsW2],
    ["worker-3", statsW3]
  ]);
  console.log("\n  --- \u5B66\u4E60\u89E6\u53D1\u6761\u4EF6 ---");
  assert(shouldTriggerLearning(50), "50 \u4E8B\u4EF6\u89E6\u53D1\u5B66\u4E60");
  assert(!shouldTriggerLearning(30), "30 \u4E8B\u4EF6\u4E0D\u89E6\u53D1\u5B66\u4E60");
  console.log("\n  --- \u5B66\u4E60\u5206\u6790 ---");
  const analysis = analyzeLearningOpportunities(
    "test-project",
    events,
    healthMap,
    statsMap,
    project
  );
  assert(analysis.eventCount === events.length, `\u5206\u6790\u4E86 ${events.length} \u4E2A\u4E8B\u4EF6`);
  assert(analysis.insights.length > 0, `\u53D1\u73B0 ${analysis.insights.length} \u4E2A\u6D1E\u5BDF`);
  const failureInsight = analysis.insights.find(
    (i) => i.category === "routing_failure" && i.agentIds.includes("worker-2")
  );
  assert(!!failureInsight, "\u68C0\u6D4B\u5230\u641C\u7D22\u52A9\u624B\u9AD8\u5931\u8D25\u7387");
  const timeoutInsight = analysis.insights.find(
    (i) => i.category === "timeout_pattern" && i.agentIds.includes("worker-2")
  );
  assert(!!timeoutInsight, "\u68C0\u6D4B\u5230\u641C\u7D22\u52A9\u624B\u8D85\u65F6\u6A21\u5F0F");
  const underutilInsight = analysis.insights.find(
    (i) => i.category === "underutilized_agent" && i.agentIds.includes("worker-3")
  );
  assert(!!underutilInsight, "\u68C0\u6D4B\u5230\u95F2\u7F6E\u52A9\u624B\u672A\u5145\u5206\u4F7F\u7528");
  const successInsight = analysis.insights.find(
    (i) => i.category === "success_pattern" && i.agentIds.includes("worker-1")
  );
  assert(!!successInsight, "\u68C0\u6D4B\u5230\u5199\u4F5C\u52A9\u624B\u9AD8\u6210\u529F\u7387");
  assert(analysis.routingPatterns.length > 0, `\u5B66\u4E60\u5230 ${analysis.routingPatterns.length} \u4E2A\u8DEF\u7531\u6A21\u5F0F`);
  assert(analysis.specializations.length > 0, `\u6784\u5EFA ${analysis.specializations.length} \u4E2A\u6210\u5458\u753B\u50CF`);
  console.log(`
  \u5206\u6790\u6458\u8981: ${analysis.summary}`);
  console.log("\n  --- \u89D2\u8272\u517C\u5BB9\u6027\u68C0\u67E5 ---");
  if (failureInsight) {
    const suggestion = failureInsight.suggestion;
    assert(
      !suggestion.includes("\u95F2\u7F6E\u52A9\u624B"),
      `\u4E0D\u63A8\u8350\u65E0\u5173\u89D2\u8272 (suggestion: ${suggestion.slice(0, 50)})`
    );
  }
  console.log("\n  --- \u81EA\u52A8\u4F18\u5316 ---");
  const { updatedProject, appliedChanges } = applyAutoOptimizations(project, analysis);
  console.log(`  \u5E94\u7528\u4E86 ${appliedChanges.length} \u9879\u4F18\u5316:`);
  for (const change of appliedChanges) {
    console.log(`    - ${change}`);
  }
  if (appliedChanges.length > 0) {
    assert(updatedProject.version > project.version, "\u7248\u672C\u53F7\u9012\u589E");
  }
  console.log("\n  --- \u5B66\u4E60\u63D0\u793A\u751F\u6210 ---");
  const hints = generateLearningHints(analysis);
  assert(hints.includes("<learning-hints>"), "\u63D0\u793A\u5305\u542B learning-hints \u6807\u7B7E");
  assert(hints.includes("</learning-hints>"), "\u63D0\u793A\u5305\u542B\u5173\u95ED\u6807\u7B7E");
  assert(hints.length <= 600, `\u63D0\u793A\u957F\u5EA6 \u2264 600 (\u5B9E\u9645: ${hints.length})`);
  console.log(`  \u63D0\u793A\u5185\u5BB9 (${hints.length} chars):`);
  console.log("  " + hints.split("\n").join("\n  "));
  console.log("\n  --- Soul Optimizer ---");
  const mockSoul = `# Team SOUL

## Role Assignment
\u8C03\u5EA6\u5458\u5206\u914D\u4EFB\u52A1\u3002

## Quality Gates
\u786E\u4FDD\u8D28\u91CF\u3002

## Operating Rules
\u9075\u5FAA\u89C4\u5219\u3002`;
  const updatedSoul = appendLearningHintsToSoul(mockSoul, hints);
  assert(updatedSoul.includes("<learning-hints>"), "SOUL \u5305\u542B\u5B66\u4E60\u63D0\u793A");
  assert(updatedSoul.indexOf("<learning-hints>") > updatedSoul.indexOf("Quality Gates"), "\u5B66\u4E60\u63D0\u793A\u5728 Quality Gates \u4E4B\u540E");
  assert(updatedSoul.indexOf("<learning-hints>") < updatedSoul.indexOf("Operating Rules"), "\u5B66\u4E60\u63D0\u793A\u5728 Operating Rules \u4E4B\u524D");
  const newHints = "<learning-hints>\nUpdated hints\n</learning-hints>";
  const replacedSoul = appendLearningHintsToSoul(updatedSoul, newHints);
  const hintsCount = (replacedSoul.match(/<learning-hints>/g) ?? []).length;
  assert(hintsCount === 1, "\u66FF\u6362\u540E\u53EA\u6709\u4E00\u4E2A learning-hints \u5757");
  const cleanSoul = removeLearningHintsFromSoul(replacedSoul);
  assert(!cleanSoul.includes("<learning-hints>"), "\u79FB\u9664\u540E\u65E0 learning-hints");
  console.log("\n  --- Supervisor \u4E0A\u4E0B\u6587\u589E\u5F3A ---");
  const learningCtx = buildSupervisorLearningContext(
    project,
    analysis,
    statsMap,
    healthMap
  );
  assert(learningCtx.length > 0, "\u5B66\u4E60\u4E0A\u4E0B\u6587\u5DF2\u751F\u6210");
  assert(learningCtx.includes("Live Member Stats"), "\u5305\u542B\u6210\u5458\u7EDF\u8BA1");
  console.log(`  \u4E0A\u4E0B\u6587\u5185\u5BB9 (${learningCtx.length} chars):`);
  console.log("  " + learningCtx.split("\n").join("\n  "));
  console.log("\n  --- \u6210\u5458\u6027\u80FD\u753B\u50CF ---");
  const profile = buildMemberPerformanceProfile(
    project,
    statsMap,
    healthMap,
    analysis.specializations
  );
  assert(profile.length > 0, "\u6027\u80FD\u753B\u50CF\u5DF2\u751F\u6210");
  assert(profile.includes("\u5199\u4F5C\u52A9\u624B"), "\u5305\u542B\u5199\u4F5C\u52A9\u624B");
  assert(profile.includes("\u641C\u7D22\u52A9\u624B"), "\u5305\u542B\u641C\u7D22\u52A9\u624B");
  console.log("\n  --- \u5B66\u4E60\u62A5\u544A ---");
  const report = formatLearningReport(analysis);
  assert(report.includes("\u5B66\u4E60\u5206\u6790\u62A5\u544A"), "\u62A5\u544A\u6807\u9898\u6B63\u786E");
  assert(report.includes("\u6D1E\u5BDF"), "\u5305\u542B\u6D1E\u5BDF\u90E8\u5206");
  assert(report.includes("\u6210\u5458\u753B\u50CF"), "\u5305\u542B\u6210\u5458\u753B\u50CF");
  console.log(`  \u62A5\u544A (${report.length} chars)`);
}
async function main() {
  console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log("\u2551       Pipeline Audit \u2014 Agent Team \u8D28\u91CF\u8003\u6838                   \u2551");
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
  try {
    testContentTeam();
    testCustomerSupportTeam();
    testCodingTeam();
    testDataTeam();
    testEdgeCases();
    testCapabilityInference();
    testLearningEngine();
  } catch (err) {
    console.error(`
${FAIL} \u6D4B\u8BD5\u6267\u884C\u51FA\u9519:`, err);
    failedTests++;
  }
  section("\u8003\u6838\u7ED3\u679C\u6C47\u603B");
  console.log(`
  \u603B\u6D4B\u8BD5\u6570: ${totalTests}`);
  console.log(`  ${PASS} \u901A\u8FC7: ${passedTests}`);
  console.log(`  ${FAIL} \u5931\u8D25: ${failedTests}`);
  console.log(`  \u901A\u8FC7\u7387: ${totalTests > 0 ? Math.round(passedTests / totalTests * 100) : 0}%`);
  if (issues.length > 0) {
    console.log(`
  ${WARN} \u53D1\u73B0\u7684\u95EE\u9898:`);
    for (const issue of issues) {
      console.log(`    - ${issue}`);
    }
  }
  const grade = failedTests === 0 ? "A+ (\u4F18\u79C0)" : failedTests <= 2 ? "A (\u826F\u597D)" : failedTests <= 5 ? "B (\u5408\u683C)" : failedTests <= 10 ? "C (\u9700\u6539\u8FDB)" : "D (\u4E0D\u5408\u683C)";
  console.log(`
  \u{1F3C6} \u7EFC\u5408\u8BC4\u7EA7: ${grade}`);
  console.log();
  process.exit(failedTests > 0 ? 1 : 0);
}
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
