import { executePlanningPipeline } from "./planning-pipeline.js";
import { formatVerificationReport } from "./scene-verifier.js";
import { estimateRoleComplexity, isSupervisorRole } from "./capability-inference.js";
const PASS = "\u2705";
const FAIL = "\u274C";
const WARN = "\u26A0\uFE0F";
const INFO = "\u2139\uFE0F";
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const allFindings = [];
let currentScenario = "";
function assert(condition, testName, detail) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${PASS} ${testName}`);
    return true;
  } else {
    failedTests++;
    const msg = `${testName}${detail ? ` \u2014 ${detail}` : ""}`;
    console.log(`  ${FAIL} ${msg}`);
    allFindings.push({
      scenario: currentScenario,
      severity: "critical",
      category: "test_failure",
      detail: msg
    });
    return false;
  }
}
function finding(severity, category, detail) {
  allFindings.push({ scenario: currentScenario, severity, category, detail });
  const icon = severity === "critical" ? FAIL : severity === "warning" ? WARN : INFO;
  console.log(`  ${icon} [${category}] ${detail}`);
}
function section(title) {
  console.log(`
${"\u2550".repeat(64)}`);
  console.log(`  ${title}`);
  console.log(`${"\u2550".repeat(64)}`);
}
function subsection(title) {
  console.log(`
  \u2500\u2500 ${title} \u2500\u2500`);
}
function createRichDiscovery() {
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
      { name: "copywriting", description: "\u6587\u6848\u521B\u4F5C\u548C\u4F18\u5316\u3001\u7206\u6B3E\u6807\u9898", source: "managed" },
      { name: "calendar", description: "\u65E5\u7A0B\u7BA1\u7406\u548C\u63D0\u9192", source: "bundled" },
      { name: "translator", description: "\u591A\u8BED\u8A00\u7FFB\u8BD1\u548C\u672C\u5730\u5316", source: "managed" },
      { name: "video-transcript", description: "\u89C6\u9891\u5B57\u5E55\u63D0\u53D6\u548C\u8F6C\u5F55", source: "managed" },
      { name: "tts", description: "\u6587\u5B57\u8F6C\u8BED\u97F3\u5408\u6210", source: "managed" },
      { name: "social-media-management", description: "\u793E\u4EA4\u5A92\u4F53\u591A\u5E73\u53F0\u7BA1\u7406", source: "managed" },
      { name: "budget-tracker", description: "\u9884\u7B97\u8FFD\u8E2A\u548C\u8D22\u52A1\u5206\u6790", source: "managed" },
      { name: "todo-tracker", description: "\u4EFB\u52A1\u548C\u5F85\u529E\u7BA1\u7406", source: "bundled" },
      { name: "deep-research", description: "\u6DF1\u5EA6\u8C03\u7814\u548C\u62A5\u544A\u751F\u6210", source: "managed" }
    ],
    mcpServers: [
      { id: "mcp-server-sqlite", enabled: true, running: true, tools: [{ name: "query", description: "Execute SQL queries" }] },
      { id: "@mcp/server-filesystem", enabled: true, running: true, tools: [{ name: "read_file", description: "Read file contents" }] },
      { id: "@modelcontextprotocol/server-github", enabled: true, running: true, tools: [{ name: "create_issue", description: "Create GitHub issue" }] },
      { id: "@anthropic/mcp-memory", enabled: true, running: true, tools: [{ name: "remember", description: "Store and retrieve memories" }] },
      { id: "@anthropic/mcp-brave-search", enabled: true, running: true, tools: [{ name: "search", description: "Web search via Brave" }] }
    ],
    timestamp: Date.now()
  };
}
function scenario1_XiaohongshuFactory() {
  currentScenario = "\u5C0F\u7EA2\u4E66\u7206\u6B3E\u6587\u6848\u5DE5\u5382";
  section(`\u573A\u666F1: ${currentScenario}`);
  const userCtx = {
    scenario: "content",
    channels: ["wechat"],
    resources: [],
    volume: "high",
    budget: "cheap"
    // 小白用户——省钱
  };
  const blueprints = [
    {
      name: "\u70ED\u70B9\u730E\u624B",
      id: "trend-hunter",
      role: "\u5B9E\u65F6\u76D1\u63A7\u5C0F\u7EA2\u4E66\u70ED\u95E8\u8BDD\u9898\u3001\u5FAE\u535A\u70ED\u641C\u3001\u6296\u97F3\u70ED\u699C\uFF0C\u7B5B\u9009\u53EF\u8E6D\u7684\u70ED\u70B9\u9009\u9898",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    },
    {
      name: "\u7206\u6B3E\u6587\u6848\u624B",
      id: "copy-master",
      role: "\u6839\u636E\u9009\u9898\u64B0\u5199\u5C0F\u7EA2\u4E66\u79CD\u8349\u6587\u6848\uFF0C\u638C\u63E1emoji\u4F7F\u7528\u3001\u5206\u6BB5\u6280\u5DE7\u3001\u6807\u9898\u515A\u5199\u6CD5",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u5C01\u9762\u8BBE\u8BA1\u5E08",
      id: "cover-designer",
      role: "\u4E3A\u5C0F\u7EA2\u4E66\u5E16\u5B50\u751F\u6210\u5438\u775B\u5C01\u9762\u56FE\uFF0C\u652F\u6301\u6587\u5B57\u53E0\u52A0\u3001\u6EE4\u955C\u98CE\u683C",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    },
    {
      name: "\u6570\u636E\u590D\u76D8\u5458",
      id: "data-reviewer",
      role: "\u5206\u6790\u8FC7\u5F80\u5E16\u5B50\u6570\u636E\uFF0C\u627E\u51FA\u7206\u6B3E\u89C4\u5F8B\uFF0C\u4F18\u5316\u53D1\u5E03\u7B56\u7565\u548C\u65F6\u95F4",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u8BC4\u8BBA\u4E92\u52A8\u5B98",
      id: "comment-manager",
      role: "\u81EA\u52A8\u56DE\u590D\u5C0F\u7EA2\u4E66\u8BC4\u8BBA\uFF0C\u7BA1\u7406\u7C89\u4E1D\u4E92\u52A8\uFF0C\u7EF4\u62A4\u793E\u533A\u6C1B\u56F4",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    }
  ];
  const discovery = createRichDiscovery();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "\u6253\u9020\u5C0F\u7EA2\u4E66\u7206\u6B3E\u6587\u6848\u5168\u81EA\u52A8\u5316\u6D41\u6C34\u7EBF\uFF0C\u4ECE\u70ED\u70B9\u53D1\u73B0\u5230\u6587\u6848\u64B0\u5199\u5230\u5C01\u9762\u914D\u56FE\u5230\u6570\u636E\u590D\u76D8",
    userCtx,
    discovery
  });
  subsection("Pipeline \u6982\u89C8");
  console.log(`  \u8F6E\u6B21: ${result.totalRounds} | \u5206\u6570: ${result.verification.score} | \u8986\u76D6\u7387: ${result.coverageScore}% | \u901A\u8FC7: ${result.verification.overallPass}`);
  subsection("\u57FA\u7840\u9A8C\u8BC1");
  assert(result.verification.overallPass, "\u9A8C\u8BC1\u901A\u8FC7");
  assert(result.verification.score >= 60, `\u5206\u6570 \u2265 60 (\u5B9E\u9645: ${result.verification.score})`);
  assert(result.coverageScore >= 70, `\u8986\u76D6\u7387 \u2265 70% (\u5B9E\u9645: ${result.coverageScore}%)`);
  assert(result.blueprints.length >= 4, `\u56E2\u961F \u2265 4\u4EBA (\u5B9E\u9645: ${result.blueprints.length})`);
  subsection("\u6210\u5458\u914D\u7F6E\u5BA1\u67E5");
  const copyMaster = result.blueprints.find((bp) => bp.id === "copy-master");
  if (copyMaster?.inferredCapabilities) {
    const caps = copyMaster.inferredCapabilities;
    const hasCopywriting = caps.skills.some((s) => /copy|文案|写作/i.test(s));
    assert(hasCopywriting, `\u7206\u6B3E\u6587\u6848\u624B\u6709\u6587\u6848\u76F8\u5173 skill (${caps.skills.join(", ")})`);
    const hasXhs = caps.skills.some((s) => /xiaohongshu|小红书/i.test(s));
    assert(hasXhs, `\u7206\u6B3E\u6587\u6848\u624B\u6709\u5C0F\u7EA2\u4E66 skill (${caps.skills.join(", ")})`);
    if (/opus|o3/i.test(caps.model.primary)) {
      finding("warning", "\u6A21\u578B\u9009\u62E9", `\u6587\u6848\u624B\u5728 cheap \u9884\u7B97\u4E0B\u4F7F\u7528\u4E86 SOTA \u6A21\u578B: ${caps.model.primary}`);
    }
    assert(caps.skills.length <= 5, `\u6587\u6848\u624B skills \u2264 5 (\u5B9E\u9645: ${caps.skills.length})`);
  }
  const coverDesigner = result.blueprints.find((bp) => bp.id === "cover-designer");
  if (coverDesigner?.inferredCapabilities) {
    const caps = coverDesigner.inferredCapabilities;
    const hasImageTool = caps.skills.some((s) => /image|图/i.test(s)) || (caps.tools.alsoAllow ?? []).some((t) => /image/i.test(t));
    assert(hasImageTool, `\u5C01\u9762\u8BBE\u8BA1\u5E08\u6709\u56FE\u7247\u76F8\u5173\u80FD\u529B`);
  }
  subsection("\u9884\u7B97\u7EA6\u675F\u5BA1\u67E5");
  for (const bp of result.blueprints) {
    if (bp.inferredCapabilities) {
      const model = bp.inferredCapabilities.model.primary;
      if (/opus|o3/i.test(model) && !isSupervisorRole(bp.role, bp.id)) {
        finding("warning", "\u9884\u7B97\u8D85\u6807", `${bp.name} \u5728 cheap \u9884\u7B97\u4E0B\u7528\u4E86 SOTA \u6A21\u578B: ${model}`);
      }
    }
  }
  const dataReviewer = result.blueprints.find((bp) => bp.id === "data-reviewer");
  if (dataReviewer?.inferredCapabilities) {
    const hasAnalytics = dataReviewer.inferredCapabilities.skills.some((s) => /csv|data|分析/i.test(s));
    assert(hasAnalytics, `\u6570\u636E\u590D\u76D8\u5458\u6709\u6570\u636E\u5206\u6790 skill`);
  }
  printVerification(result.verification);
}
function scenario2_MultiChannelMatrix() {
  currentScenario = "\u591A\u6E20\u9053\u81EA\u5A92\u4F53\u77E9\u9635";
  section(`\u573A\u666F2: ${currentScenario}`);
  const userCtx = {
    scenario: "content",
    channels: ["wechat", "web"],
    // 微信+网页
    resources: [],
    volume: "high",
    budget: "balanced"
  };
  const blueprints = [
    {
      name: "\u9009\u9898\u603B\u76D1",
      id: "topic-director",
      role: "\u8D1F\u8D23\u5404\u5E73\u53F0\u9009\u9898\u7B56\u5212\uFF0C\u70ED\u70B9\u8FFD\u8E2A\u548C\u9009\u9898\u5E93\u7BA1\u7406\uFF0C\u5206\u6790\u5404\u6E20\u9053\u53D7\u4F17\u5DEE\u5F02",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u516C\u4F17\u53F7\u4F5C\u8005",
      id: "wechat-writer",
      role: "\u64B0\u5199\u5FAE\u4FE1\u516C\u4F17\u53F7\u957F\u6587\u3001\u6DF1\u5EA6\u6587\u7AE0\uFF0C\u9002\u914D\u516C\u4F17\u53F7\u6392\u7248",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u5C0F\u7EA2\u4E66\u8FBE\u4EBA",
      id: "xhs-creator",
      role: "\u521B\u4F5C\u5C0F\u7EA2\u4E66\u79CD\u8349\u7B14\u8BB0\u3001\u751F\u6D3B\u5206\u4EAB\u7C7B\u77ED\u6587\u6848",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u77ED\u89C6\u9891\u6587\u6848",
      id: "video-script",
      role: "\u64B0\u5199\u6296\u97F3/\u5FEB\u624B\u77ED\u89C6\u9891\u811A\u672C\u3001\u53E3\u64AD\u6587\u6848",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "B\u7AD9UP\u4E3B\u52A9\u624B",
      id: "bilibili-helper",
      role: "\u64B0\u5199B\u7AD9\u89C6\u9891\u6807\u9898\u3001\u7B80\u4ECB\u3001\u5206P\u6807\u6CE8",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    },
    {
      name: "\u591A\u5E73\u53F0\u5206\u53D1\u5458",
      id: "distributor",
      role: "\u5C06\u540C\u4E00\u5185\u5BB9\u9002\u914D\u4E0D\u540C\u5E73\u53F0\u683C\u5F0F\u5E76\u5B9A\u65F6\u53D1\u5E03",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    }
  ];
  const discovery = createRichDiscovery();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "\u642D\u5EFA\u591A\u6E20\u9053\u81EA\u5A92\u4F53\u77E9\u9635\uFF0C\u4E00\u5957\u5185\u5BB9\u9002\u914D\u5FAE\u4FE1\u516C\u4F17\u53F7\u3001\u5C0F\u7EA2\u4E66\u3001\u6296\u97F3\u3001B\u7AD9\u56DB\u4E2A\u5E73\u53F0\uFF0C\u81EA\u52A8\u5316\u6392\u7248\u5206\u53D1",
    userCtx,
    discovery
  });
  subsection("Pipeline \u6982\u89C8");
  console.log(`  \u8F6E\u6B21: ${result.totalRounds} | \u5206\u6570: ${result.verification.score} | \u8986\u76D6\u7387: ${result.coverageScore}% | \u901A\u8FC7: ${result.verification.overallPass}`);
  subsection("\u57FA\u7840\u9A8C\u8BC1");
  assert(result.verification.score >= 40, `\u5206\u6570 \u2265 40 (\u5B9E\u9645: ${result.verification.score})`);
  assert(result.coverageScore >= 60, `\u8986\u76D6\u7387 \u2265 60% (\u5B9E\u9645: ${result.coverageScore}%)`);
  subsection("\u89D2\u8272\u5DEE\u5F02\u5316\u5BA1\u67E5");
  const wxWriter = result.blueprints.find((bp) => bp.id === "wechat-writer");
  const xhsCreator = result.blueprints.find((bp) => bp.id === "xhs-creator");
  if (wxWriter && xhsCreator) {
    assert(true, "\u516C\u4F17\u53F7\u4F5C\u8005\u548C\u5C0F\u7EA2\u4E66\u8FBE\u4EBA\u4FDD\u6301\u72EC\u7ACB\uFF08\u89D2\u8272\u5DEE\u5F02\u5316\uFF09");
  } else {
    const merged = result.blueprints.length < 6;
    if (merged) {
      finding("warning", "\u8FC7\u5EA6\u5408\u5E76", `6\u4EBA\u56E2\u961F\u88AB\u5408\u5E76\u5230 ${result.blueprints.length} \u4EBA\uFF0C\u53EF\u80FD\u8FC7\u5EA6\u5408\u5E76`);
    }
  }
  if (xhsCreator?.inferredCapabilities) {
    const hasXhs = xhsCreator.inferredCapabilities.skills.some((s) => /xiaohongshu/i.test(s));
    assert(hasXhs, `\u5C0F\u7EA2\u4E66\u8FBE\u4EBA\u5339\u914D\u5230 xiaohongshu skill`);
  }
  const distributor = result.blueprints.find((bp) => bp.id === "distributor");
  if (distributor?.inferredCapabilities) {
    const tools = distributor.inferredCapabilities.tools.alsoAllow ?? [];
    const complexity = estimateRoleComplexity(distributor.role);
    assert(complexity === "simple" || complexity === "moderate", `\u5206\u53D1\u5458\u590D\u6742\u5EA6\u5408\u7406 (${complexity})`);
  }
  subsection("\u8DE8\u5E73\u53F0\u5DE5\u5177\u5BA1\u67E5");
  const anyWechatTool = result.blueprints.some((bp) => {
    const also = bp.inferredCapabilities?.tools?.alsoAllow ?? [];
    return also.some((t) => /wechat/i.test(t));
  });
  assert(anyWechatTool, "\u81F3\u5C11\u4E00\u4E2A\u6210\u5458\u6709\u5FAE\u4FE1\u5DE5\u5177");
  printVerification(result.verification);
}
function scenario3_CrossBorderEcommerce() {
  currentScenario = "\u8DE8\u5883\u7535\u5546\u5BA2\u670D\u56E2\u961F";
  section(`\u573A\u666F3: ${currentScenario}`);
  const userCtx = {
    scenario: "customer_support",
    channels: ["wechat", "web"],
    resources: ["faq_doc", "database"],
    volume: "high",
    budget: "balanced"
  };
  const blueprints = [
    {
      name: "\u4E2D\u6587\u5BA2\u670D",
      id: "cn-support",
      role: "\u5904\u7406\u4E2D\u6587\u7528\u6237\u54A8\u8BE2\u3001\u9000\u6362\u8D27\u3001\u7269\u6D41\u67E5\u8BE2\uFF0C\u8981\u6C42\u54CD\u5E94\u6E29\u6696\u4E13\u4E1A",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u82F1\u6587\u5BA2\u670D",
      id: "en-support",
      role: "Handle English customer inquiries, returns, shipping tracking",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u7FFB\u8BD1\u6865\u63A5\u5458",
      id: "translator-bridge",
      role: "\u4E2D\u82F1\u53CC\u8BED\u5B9E\u65F6\u7FFB\u8BD1\uFF0C\u534F\u52A9\u4E2D\u6587\u5BA2\u670D\u5904\u7406\u82F1\u6587\u5DE5\u5355",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    },
    {
      name: "\u5DE5\u5355\u5904\u7406\u5458",
      id: "ticket-handler",
      role: "\u521B\u5EFA\u3001\u5206\u914D\u548C\u8DDF\u8E2A\u552E\u540E\u5DE5\u5355\uFF0C\u5347\u7EA7\u590D\u6742\u95EE\u9898\u7ED9\u4EBA\u5DE5",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    },
    {
      name: "FAQ\u77E5\u8BC6\u5E93\u7BA1\u7406",
      id: "faq-manager",
      role: "\u7EF4\u62A4FAQ\u77E5\u8BC6\u5E93\uFF0C\u4ECE\u5386\u53F2\u5DE5\u5355\u4E2D\u63D0\u70BC\u5E38\u89C1\u95EE\u9898\u548C\u89E3\u7B54",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    }
  ];
  const discovery = createRichDiscovery();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "\u642D\u5EFA\u8DE8\u5883\u7535\u5546\u667A\u80FD\u5BA2\u670D\u7CFB\u7EDF\uFF0C\u652F\u6301\u4E2D\u82F1\u53CC\u8BED\uFF0C\u5BF9\u63A5\u5FAE\u4FE1\u548C\u7F51\u9875\uFF0C\u9700\u8981FAQ\u77E5\u8BC6\u5E93\u548C\u5DE5\u5355\u7BA1\u7406",
    userCtx,
    discovery
  });
  subsection("Pipeline \u6982\u89C8");
  console.log(`  \u8F6E\u6B21: ${result.totalRounds} | \u5206\u6570: ${result.verification.score} | \u8986\u76D6\u7387: ${result.coverageScore}% | \u901A\u8FC7: ${result.verification.overallPass}`);
  subsection("\u57FA\u7840\u9A8C\u8BC1");
  assert(result.verification.score >= 40, `\u5206\u6570 \u2265 40 (\u5B9E\u9645: ${result.verification.score})`);
  subsection("\u53CC\u8BED\u80FD\u529B\u5BA1\u67E5");
  const cnSupport = result.blueprints.find((bp) => bp.id === "cn-support");
  const enSupport = result.blueprints.find((bp) => bp.id === "en-support");
  const translatorBridge = result.blueprints.find((bp) => bp.id === "translator-bridge");
  if (cnSupport?.inferredCapabilities && enSupport?.inferredCapabilities) {
    assert(true, "\u4E2D\u82F1\u5BA2\u670D\u4FDD\u6301\u72EC\u7ACB");
    assert(cnSupport.inferredCapabilities.memorySearch.enabled, "\u4E2D\u6587\u5BA2\u670D\u542F\u7528\u4E86\u8BB0\u5FC6\u641C\u7D22");
    assert(enSupport.inferredCapabilities.memorySearch.enabled, "\u82F1\u6587\u5BA2\u670D\u542F\u7528\u4E86\u8BB0\u5FC6\u641C\u7D22");
  } else {
    finding("critical", "\u89D2\u8272\u4E22\u5931", "\u4E2D\u82F1\u5BA2\u670D agent \u88AB\u9519\u8BEF\u5408\u5E76\u6216\u4E22\u5931");
  }
  if (translatorBridge?.inferredCapabilities) {
    const hasTranslator = translatorBridge.inferredCapabilities.skills.some((s) => /translat|翻译/i.test(s));
    assert(hasTranslator, `\u7FFB\u8BD1\u6865\u63A5\u5458\u6709\u7FFB\u8BD1 skill (${translatorBridge.inferredCapabilities.skills.join(", ")})`);
  }
  subsection("\u5DE5\u5355\u7CFB\u7EDF\u5BA1\u67E5");
  const ticketHandler = result.blueprints.find((bp) => bp.id === "ticket-handler");
  if (ticketHandler?.inferredCapabilities) {
    const hasSqlCap = ticketHandler.inferredCapabilities.mcpHints.some((m) => /sql|database/i.test(m)) || ticketHandler.inferredCapabilities.skills.some((s) => /sql|database/i.test(s));
    if (!hasSqlCap) {
      finding("info", "\u5DE5\u5355\u80FD\u529B", "\u5DE5\u5355\u5904\u7406\u5458\u672A\u5206\u914D\u6570\u636E\u5E93\u76F8\u5173 MCP/skill\uFF08\u53EF\u80FD\u4F9D\u8D56\u5916\u90E8\u7CFB\u7EDF\uFF09");
    }
  }
  subsection("\u8D44\u6E90\u8986\u76D6\u5BA1\u67E5");
  const resCheck = result.verification.checks.find((c) => c.name === "resource_coverage");
  assert(resCheck?.pass === true, `\u8D44\u6E90\u8986\u76D6\u68C0\u67E5\u901A\u8FC7 (${resCheck?.detail})`);
  printVerification(result.verification);
}
function scenario4_KnowledgeAndLearning() {
  currentScenario = "\u4E2A\u4EBA\u77E5\u8BC6\u7BA1\u7406\u5B66\u4E60\u52A9\u624B";
  section(`\u573A\u666F4: ${currentScenario}`);
  const userCtx = {
    scenario: "learning",
    channels: [],
    resources: ["pdf", "notion"],
    volume: "low",
    budget: "cheap"
  };
  const blueprints = [
    {
      name: "\u9605\u8BFB\u6458\u8981\u5668",
      id: "reader-summarizer",
      role: "\u9605\u8BFBPDF\u3001\u7F51\u9875\u6587\u7AE0\uFF0C\u63D0\u53D6\u5173\u952E\u4FE1\u606F\uFF0C\u751F\u6210\u7ED3\u6784\u5316\u6458\u8981\u7B14\u8BB0",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u77E5\u8BC6\u56FE\u8C31\u7BA1\u7406\u5458",
      id: "knowledge-mapper",
      role: "\u5C06\u96F6\u6563\u77E5\u8BC6\u6574\u7406\u6210\u77E5\u8BC6\u56FE\u8C31\uFF0C\u5EFA\u7ACB\u77E5\u8BC6\u4E4B\u95F4\u7684\u5173\u8054",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u590D\u4E60\u6559\u7EC3",
      id: "review-coach",
      role: "\u6839\u636E\u9057\u5FD8\u66F2\u7EBF\u5B9A\u65F6\u63D0\u9192\u590D\u4E60\uFF0C\u751F\u6210\u95EA\u5361\u548C\u7EC3\u4E60\u9898",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    },
    {
      name: "\u8BBA\u6587\u52A9\u8BFB",
      id: "paper-assistant",
      role: "\u8F85\u52A9\u9605\u8BFB\u5B66\u672F\u8BBA\u6587\uFF0C\u89E3\u91CA\u4E13\u4E1A\u672F\u8BED\uFF0C\u603B\u7ED3\u7814\u7A76\u65B9\u6CD5\u548C\u7ED3\u8BBA",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    }
  ];
  const discovery = createRichDiscovery();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "\u642D\u5EFA\u4E2A\u4EBA\u77E5\u8BC6\u7BA1\u7406\u7CFB\u7EDF\uFF0C\u80FD\u9605\u8BFBPDF\u548C\u8BBA\u6587\u3001\u81EA\u52A8\u505A\u7B14\u8BB0\u603B\u7ED3\u3001\u5B9A\u65F6\u590D\u4E60\u63D0\u9192\u3001\u77E5\u8BC6\u5173\u8054\u7BA1\u7406",
    userCtx,
    discovery
  });
  subsection("Pipeline \u6982\u89C8");
  console.log(`  \u8F6E\u6B21: ${result.totalRounds} | \u5206\u6570: ${result.verification.score} | \u8986\u76D6\u7387: ${result.coverageScore}% | \u901A\u8FC7: ${result.verification.overallPass}`);
  subsection("\u57FA\u7840\u9A8C\u8BC1");
  assert(result.verification.score >= 40, `\u5206\u6570 \u2265 40 (\u5B9E\u9645: ${result.verification.score})`);
  subsection("PDF \u80FD\u529B\u5BA1\u67E5");
  const reader = result.blueprints.find((bp) => bp.id === "reader-summarizer");
  if (reader?.inferredCapabilities) {
    const hasPdf = reader.inferredCapabilities.skills.some((s) => /pdf/i.test(s));
    assert(hasPdf, `\u9605\u8BFB\u6458\u8981\u5668\u6709 PDF skill (${reader.inferredCapabilities.skills.join(", ")})`);
    const hasSummarize = reader.inferredCapabilities.skills.some((s) => /summarize|摘要/i.test(s));
    assert(hasSummarize, `\u9605\u8BFB\u6458\u8981\u5668\u6709\u6458\u8981 skill`);
  }
  const paperAssist = result.blueprints.find((bp) => bp.id === "paper-assistant");
  if (paperAssist?.inferredCapabilities) {
    const hasPdf = paperAssist.inferredCapabilities.skills.some((s) => /pdf/i.test(s));
    assert(hasPdf, `\u8BBA\u6587\u52A9\u8BFB\u6709 PDF skill`);
  }
  subsection("\u590D\u4E60\u5B9A\u65F6\u5BA1\u67E5");
  const coach = result.blueprints.find((bp) => bp.id === "review-coach");
  if (coach?.inferredCapabilities) {
    const hasCron = (coach.inferredCapabilities.tools.alsoAllow ?? []).some((t) => /cron|remind/i.test(t));
    assert(hasCron, `\u590D\u4E60\u6559\u7EC3\u6709\u5B9A\u65F6\u63D0\u9192\u5DE5\u5177 (alsoAllow: ${(coach.inferredCapabilities.tools.alsoAllow ?? []).join(", ")})`);
    const complexity = estimateRoleComplexity(coach.role);
    finding("info", "\u590D\u6742\u5EA6", `\u590D\u4E60\u6559\u7EC3\u590D\u6742\u5EA6: ${complexity}`);
  }
  subsection("Notion \u8D44\u6E90\u8986\u76D6");
  const resCheck = result.verification.checks.find((c) => c.name === "resource_coverage");
  assert(resCheck?.pass === true, `\u8D44\u6E90\u8986\u76D6: ${resCheck?.detail}`);
  const knowledgeMapper = result.blueprints.find((bp) => bp.id === "knowledge-mapper");
  if (knowledgeMapper?.inferredCapabilities) {
    const hasMemory = knowledgeMapper.inferredCapabilities.memorySearch.enabled;
    assert(hasMemory, "\u77E5\u8BC6\u56FE\u8C31\u7BA1\u7406\u5458\u542F\u7528\u4E86\u8BB0\u5FC6\u641C\u7D22");
  }
  printVerification(result.verification);
}
function scenario5_PrivateTrafficOps() {
  currentScenario = "\u79C1\u57DF\u6D41\u91CF\u8FD0\u8425";
  section(`\u573A\u666F5: ${currentScenario}`);
  const userCtx = {
    scenario: "content",
    // 最接近的 scenario
    channels: ["wechat"],
    resources: ["database"],
    volume: "high",
    budget: "balanced"
  };
  const blueprints = [
    {
      name: "\u793E\u7FA4\u8FD0\u8425\u5B98",
      id: "community-mgr",
      role: "\u7BA1\u7406\u5FAE\u4FE1\u793E\u7FA4\uFF0C\u5B9A\u65F6\u53D1\u5E03\u7FA4\u516C\u544A\uFF0C\u7EF4\u62A4\u7FA4\u6D3B\u8DC3\u5EA6\u548C\u7EAA\u5F8B",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u670B\u53CB\u5708\u7F16\u8F91",
      id: "moments-editor",
      role: "\u64B0\u5199\u5FAE\u4FE1\u670B\u53CB\u5708\u6587\u6848\uFF0C\u914D\u56FE\u6392\u7248\uFF0C\u5B9A\u65F6\u53D1\u5E03\u8425\u9500\u5185\u5BB9",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u7528\u6237\u753B\u50CF\u5206\u6790\u5E08",
      id: "user-profiler",
      role: "\u5206\u6790\u7528\u6237\u884C\u4E3A\u6570\u636E\uFF0C\u6253\u6807\u7B7E\u5206\u7FA4\uFF0C\u8BC6\u522B\u9AD8\u4EF7\u503C\u7528\u6237\u548C\u6D41\u5931\u98CE\u9669",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u6D3B\u52A8\u7B56\u5212\u5E08",
      id: "event-planner",
      role: "\u7B56\u5212\u7EBF\u4E0A\u8425\u9500\u6D3B\u52A8\u3001\u62BD\u5956\u3001\u62FC\u56E2\u3001\u79D2\u6740\u7B49\u4FC3\u9500\u65B9\u6848",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u5BA2\u6237\u56DE\u8BBF\u5458",
      id: "followup-agent",
      role: "\u5B9A\u671F\u56DE\u8BBF\u8001\u5BA2\u6237\uFF0C\u6536\u96C6\u53CD\u9988\uFF0C\u63A8\u8350\u65B0\u54C1",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    }
  ];
  const discovery = createRichDiscovery();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "\u642D\u5EFA\u79C1\u57DF\u6D41\u91CF\u8FD0\u8425\u7CFB\u7EDF\uFF0C\u5305\u62EC\u5FAE\u4FE1\u793E\u7FA4\u7BA1\u7406\u3001\u670B\u53CB\u5708\u8425\u9500\u3001\u7528\u6237\u753B\u50CF\u5206\u6790\u3001\u6D3B\u52A8\u7B56\u5212\u548C\u5BA2\u6237\u56DE\u8BBF",
    userCtx,
    discovery
  });
  subsection("Pipeline \u6982\u89C8");
  console.log(`  \u8F6E\u6B21: ${result.totalRounds} | \u5206\u6570: ${result.verification.score} | \u8986\u76D6\u7387: ${result.coverageScore}% | \u901A\u8FC7: ${result.verification.overallPass}`);
  subsection("\u57FA\u7840\u9A8C\u8BC1");
  assert(result.verification.score >= 40, `\u5206\u6570 \u2265 40 (\u5B9E\u9645: ${result.verification.score})`);
  assert(result.coverageScore >= 60, `\u8986\u76D6\u7387 \u2265 60% (\u5B9E\u9645: ${result.coverageScore}%)`);
  subsection("\u5FAE\u4FE1\u5DE5\u5177\u5BA1\u67E5");
  const communityMgr = result.blueprints.find((bp) => bp.id === "community-mgr");
  if (communityMgr?.inferredCapabilities) {
    const wechatTools = (communityMgr.inferredCapabilities.tools.alsoAllow ?? []).filter((t) => /wechat/i.test(t));
    assert(wechatTools.length > 0, `\u793E\u7FA4\u8FD0\u8425\u5B98\u6709\u5FAE\u4FE1\u5DE5\u5177 (${wechatTools.join(", ")})`);
  }
  subsection("\u6570\u636E\u5206\u6790\u80FD\u529B\u5BA1\u67E5");
  const profiler = result.blueprints.find((bp) => bp.id === "user-profiler");
  if (profiler?.inferredCapabilities) {
    const hasAnalytics = profiler.inferredCapabilities.skills.some((s) => /csv|data|分析/i.test(s)) || profiler.inferredCapabilities.mcpHints.some((m) => /sql|database/i.test(m));
    assert(hasAnalytics, `\u7528\u6237\u753B\u50CF\u5206\u6790\u5E08\u6709\u6570\u636E\u5206\u6790\u80FD\u529B`);
    const complexity = estimateRoleComplexity(profiler.role);
    assert(complexity === "complex", `\u7528\u6237\u753B\u50CF\u5206\u6790\u5E08\u590D\u6742\u5EA6=complex (\u5B9E\u9645: ${complexity})`);
  }
  subsection("\u5B9A\u65F6\u529F\u80FD\u5BA1\u67E5");
  const hasCronAnywhere = result.blueprints.some((bp) => {
    const tools = bp.inferredCapabilities?.tools?.alsoAllow ?? [];
    return tools.some((t) => /cron/i.test(t));
  });
  assert(hasCronAnywhere, "\u81F3\u5C11\u4E00\u4E2A\u6210\u5458\u6709\u5B9A\u65F6 (cron) \u5DE5\u5177");
  printVerification(result.verification);
}
function scenario6_VideoScriptFactory() {
  currentScenario = "AI\u89C6\u9891\u811A\u672C\u5DE5\u5382";
  section(`\u573A\u666F6: ${currentScenario}`);
  const userCtx = {
    scenario: "content",
    channels: [],
    resources: [],
    volume: "medium",
    budget: "premium"
    // 愿意花钱
  };
  const blueprints = [
    {
      name: "\u9009\u9898\u7814\u7A76\u5458",
      id: "topic-researcher",
      role: "\u6DF1\u5EA6\u8C03\u7814\u89C6\u9891\u9009\u9898\uFF0C\u5206\u6790\u7ADE\u54C1\u7206\u6B3E\u89C6\u9891\uFF0C\u63D0\u4F9B\u5DEE\u5F02\u5316\u9009\u9898\u65B9\u5411",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u811A\u672C\u7F16\u5267",
      id: "scriptwriter",
      role: "\u64B0\u5199\u5B8C\u6574\u89C6\u9891\u811A\u672C\uFF0C\u5305\u62EC\u5F00\u573A\u94A9\u5B50\u3001\u6B63\u6587\u7ED3\u6784\u3001\u7ED3\u5C3ECTA\uFF0C\u63A7\u5236\u8282\u594F",
      soul: "",
      modelTier: "sota",
      tools: { allow: [] }
    },
    {
      name: "\u5206\u955C\u8BBE\u8BA1\u5E08",
      id: "storyboard-artist",
      role: "\u5C06\u811A\u672C\u62C6\u89E3\u4E3A\u5206\u955C\uFF0C\u63CF\u8FF0\u6BCF\u4E2A\u955C\u5934\u7684\u753B\u9762\u3001\u89D2\u5EA6\u3001\u8FD0\u955C\u65B9\u5F0F",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u914D\u97F3\u6587\u6848\u5458",
      id: "voiceover-writer",
      role: "\u5C06\u811A\u672C\u6539\u5199\u4E3A\u53E3\u64AD\u914D\u97F3\u6587\u6848\uFF0C\u8C03\u6574\u8BED\u6C14\u3001\u505C\u987F\u3001\u91CD\u97F3\u6807\u6CE8",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    },
    {
      name: "\u5B57\u5E55\u751F\u6210\u5668",
      id: "subtitle-gen",
      role: "\u751F\u6210\u5B57\u5E55\u65F6\u95F4\u8F74\u548C\u5B57\u5E55\u6587\u4EF6\uFF0C\u652F\u6301\u4E2D\u82F1\u53CC\u8BED\u5B57\u5E55",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    }
  ];
  const discovery = createRichDiscovery();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "\u642D\u5EFAAI\u89C6\u9891\u811A\u672C\u5168\u6D41\u7A0B\u5DE5\u5382\uFF0C\u4ECE\u9009\u9898\u8C03\u7814\u5230\u811A\u672C\u64B0\u5199\u5230\u5206\u955C\u8BBE\u8BA1\u5230\u914D\u97F3\u6587\u6848\u5230\u5B57\u5E55\u751F\u6210",
    userCtx,
    discovery
  });
  subsection("Pipeline \u6982\u89C8");
  console.log(`  \u8F6E\u6B21: ${result.totalRounds} | \u5206\u6570: ${result.verification.score} | \u8986\u76D6\u7387: ${result.coverageScore}% | \u901A\u8FC7: ${result.verification.overallPass}`);
  subsection("\u57FA\u7840\u9A8C\u8BC1");
  assert(result.verification.score >= 40, `\u5206\u6570 \u2265 40 (\u5B9E\u9645: ${result.verification.score})`);
  subsection("Premium \u6A21\u578B\u5BA1\u67E5");
  const scriptwriter = result.blueprints.find((bp) => bp.id === "scriptwriter");
  if (scriptwriter?.inferredCapabilities) {
    const model = scriptwriter.inferredCapabilities.model.primary;
    assert(/opus|o3/i.test(model), `\u811A\u672C\u7F16\u5267\u4F7F\u7528 SOTA \u6A21\u578B (${model})`);
  }
  const voiceWriter = result.blueprints.find((bp) => bp.id === "voiceover-writer");
  if (voiceWriter?.inferredCapabilities) {
    const model = voiceWriter.inferredCapabilities.model.primary;
    finding("info", "\u6A21\u578B\u5347\u7EA7", `\u914D\u97F3\u6587\u6848\u5458\uFF08cheap tier, premium budget\uFF09\u6700\u7EC8\u6A21\u578B: ${model}`);
  }
  subsection("\u8C03\u7814\u80FD\u529B\u5BA1\u67E5");
  const researcher = result.blueprints.find((bp) => bp.id === "topic-researcher");
  if (researcher?.inferredCapabilities) {
    const hasResearch = researcher.inferredCapabilities.skills.some((s) => /research|web-researcher|调研/i.test(s));
    assert(hasResearch, `\u9009\u9898\u7814\u7A76\u5458\u6709\u8C03\u7814 skill (${researcher.inferredCapabilities.skills.join(", ")})`);
    const complexity = estimateRoleComplexity(researcher.role);
    assert(complexity === "complex", `\u9009\u9898\u7814\u7A76\u5458\u590D\u6742\u5EA6=complex (\u5B9E\u9645: ${complexity})`);
  }
  subsection("\u5B57\u5E55\u7FFB\u8BD1\u5BA1\u67E5");
  const subtitleGen = result.blueprints.find((bp) => bp.id === "subtitle-gen");
  if (subtitleGen?.inferredCapabilities) {
    const hasTranslate = subtitleGen.inferredCapabilities.skills.some((s) => /translat|翻译/i.test(s));
    if (!hasTranslate) {
      finding("warning", "\u7F3A\u5931\u80FD\u529B", "\u5B57\u5E55\u751F\u6210\u5668\u89D2\u8272\u63CF\u8FF0\u5305\u542B'\u53CC\u8BED\u5B57\u5E55'\uFF0C\u4F46\u672A\u5206\u914D\u7FFB\u8BD1 skill");
    }
  }
  printVerification(result.verification);
}
function scenario7_FamilyFinance() {
  currentScenario = "\u5BB6\u5EAD\u8D22\u52A1\u7BA1\u5BB6";
  section(`\u573A\u666F7: ${currentScenario}`);
  const userCtx = {
    scenario: "finance",
    channels: ["wechat"],
    resources: ["database"],
    volume: "low",
    budget: "cheap"
  };
  const blueprints = [
    {
      name: "\u8BB0\u8D26\u5C0F\u52A9\u624B",
      id: "bookkeeper",
      role: "\u8BB0\u5F55\u65E5\u5E38\u6536\u652F\uFF0C\u81EA\u52A8\u5206\u7C7B\u8D26\u5355\uFF0C\u652F\u6301\u8BED\u97F3\u8BB0\u8D26",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    },
    {
      name: "\u9884\u7B97\u7BA1\u5BB6",
      id: "budget-manager",
      role: "\u5236\u5B9A\u6708\u5EA6\u9884\u7B97\u8BA1\u5212\uFF0C\u5B9E\u65F6\u76D1\u63A7\u9884\u7B97\u6267\u884C\u60C5\u51B5\uFF0C\u8D85\u652F\u9884\u8B66",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    },
    {
      name: "\u7406\u8D22\u987E\u95EE",
      id: "financial-advisor",
      role: "\u5206\u6790\u5BB6\u5EAD\u8D44\u4EA7\u914D\u7F6E\uFF0C\u63D0\u4F9B\u7406\u8D22\u5EFA\u8BAE\uFF0C\u8FFD\u8E2A\u57FA\u91D1\u80A1\u7968\u884C\u60C5",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u62A5\u8868\u751F\u6210\u5668",
      id: "report-generator",
      role: "\u751F\u6210\u5468\u62A5\u6708\u62A5\u5E74\u62A5\uFF0C\u53EF\u89C6\u5316\u6536\u652F\u8D8B\u52BF\uFF0C\u5BFC\u51FAPDF",
      soul: "",
      modelTier: "cheap",
      tools: { allow: [] }
    }
  ];
  const discovery = createRichDiscovery();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "\u642D\u5EFA\u5BB6\u5EAD\u8D22\u52A1\u7BA1\u7406\u7CFB\u7EDF\uFF0C\u652F\u6301\u65E5\u5E38\u8BB0\u8D26\u3001\u9884\u7B97\u7BA1\u7406\u3001\u7406\u8D22\u5206\u6790\u548C\u8D22\u52A1\u62A5\u8868",
    userCtx,
    discovery
  });
  subsection("Pipeline \u6982\u89C8");
  console.log(`  \u8F6E\u6B21: ${result.totalRounds} | \u5206\u6570: ${result.verification.score} | \u8986\u76D6\u7387: ${result.coverageScore}% | \u901A\u8FC7: ${result.verification.overallPass}`);
  subsection("\u57FA\u7840\u9A8C\u8BC1");
  assert(result.verification.score >= 40, `\u5206\u6570 \u2265 40 (\u5B9E\u9645: ${result.verification.score})`);
  subsection("\u8D22\u52A1\u5DE5\u5177\u5BA1\u67E5");
  const bookkeeper = result.blueprints.find((bp) => bp.id === "bookkeeper");
  if (bookkeeper?.inferredCapabilities) {
    const hasFinanceSkill = bookkeeper.inferredCapabilities.skills.some((s) => /budget|ledger|记账|财务/i.test(s));
    assert(hasFinanceSkill, `\u8BB0\u8D26\u5C0F\u52A9\u624B\u6709\u8D22\u52A1\u76F8\u5173 skill (${bookkeeper.inferredCapabilities.skills.join(", ")})`);
  }
  const reportGen = result.blueprints.find((bp) => bp.id === "report-generator");
  if (reportGen?.inferredCapabilities) {
    const hasPdf = reportGen.inferredCapabilities.skills.some((s) => /pdf/i.test(s));
    if (!hasPdf) {
      finding("warning", "\u7F3A\u5931\u80FD\u529B", `\u62A5\u8868\u751F\u6210\u5668\u89D2\u8272\u8981\u6C42'\u5BFC\u51FAPDF'\uFF0C\u4F46\u672A\u5339\u914D\u5230 PDF skill (skills: ${reportGen.inferredCapabilities.skills.join(", ")})`);
    }
  }
  subsection("\u6570\u636E\u5E93\u9700\u6C42\u5BA1\u67E5");
  const anyDbCap = result.blueprints.some((bp) => {
    const caps = bp.inferredCapabilities;
    if (!caps) return false;
    return caps.mcpHints.some((m) => /sql|database/i.test(m)) || (caps.tools.alsoAllow ?? []).some((t) => /group:fs|group:runtime/i.test(t));
  });
  assert(anyDbCap, "\u81F3\u5C11\u4E00\u4E2A\u6210\u5458\u6709\u6570\u636E\u5E93/\u6587\u4EF6\u7CFB\u7EDF\u8BBF\u95EE\u80FD\u529B");
  subsection("\u9884\u7B97\u7BA1\u5BB6\u5B9A\u65F6\u80FD\u529B");
  const budgetMgr = result.blueprints.find((bp) => bp.id === "budget-manager");
  if (budgetMgr?.inferredCapabilities) {
    const hasMonitor = (budgetMgr.inferredCapabilities.tools.alsoAllow ?? []).some((t) => /cron|remind|monitor/i.test(t));
    if (!hasMonitor) {
      finding("info", "\u5B9A\u65F6\u80FD\u529B", `\u9884\u7B97\u7BA1\u5BB6\u5305\u542B"\u5B9E\u65F6\u76D1\u63A7"\u548C"\u9884\u8B66"\uFF0C\u4F46\u672A\u5206\u914D cron/remind \u5DE5\u5177`);
    }
  }
  printVerification(result.verification);
}
function scenario8_SoloDeveloper() {
  currentScenario = "\u5168\u6808\u72EC\u7ACB\u5F00\u53D1\u8005\u52A9\u624B";
  section(`\u573A\u666F8: ${currentScenario}`);
  const userCtx = {
    scenario: "coding",
    channels: [],
    resources: ["github", "database"],
    volume: "medium",
    budget: "premium"
  };
  const blueprints = [
    {
      name: "\u4EA7\u54C1\u7ECF\u7406AI",
      id: "pm-ai",
      role: "\u9700\u6C42\u5206\u6790\u3001PRD\u64B0\u5199\u3001\u7528\u6237\u6545\u4E8B\u62C6\u89E3\u3001\u4F18\u5148\u7EA7\u6392\u5E8F",
      soul: "",
      modelTier: "sota",
      tools: { allow: [] }
    },
    {
      name: "\u67B6\u6784\u5E08",
      id: "architect",
      role: "\u7CFB\u7EDF\u67B6\u6784\u8BBE\u8BA1\u3001\u6280\u672F\u9009\u578B\u3001\u6570\u636E\u5E93\u8BBE\u8BA1\u3001API\u63A5\u53E3\u89C4\u5212",
      soul: "",
      modelTier: "sota",
      tools: { allow: [] }
    },
    {
      name: "\u524D\u7AEF\u5F00\u53D1",
      id: "frontend-dev",
      role: "React/Vue\u524D\u7AEF\u5F00\u53D1\uFF0C\u7EC4\u4EF6\u7F16\u5199\uFF0CCSS\u6837\u5F0F\uFF0C\u54CD\u5E94\u5F0F\u9002\u914D",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u540E\u7AEF\u5F00\u53D1",
      id: "backend-dev",
      role: "Node.js/Python\u540E\u7AEF\u5F00\u53D1\uFF0CAPI\u5B9E\u73B0\uFF0C\u6570\u636E\u5E93\u64CD\u4F5C\uFF0C\u7F13\u5B58\u7BA1\u7406",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "\u6D4B\u8BD5\u5DE5\u7A0B\u5E08",
      id: "qa-engineer",
      role: "\u7F16\u5199\u5355\u5143\u6D4B\u8BD5\u3001\u96C6\u6210\u6D4B\u8BD5\uFF0CBug\u5B9A\u4F4D\u548C\u4FEE\u590D\u5EFA\u8BAE",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    },
    {
      name: "DevOps",
      id: "devops",
      role: "CI/CD\u6D41\u6C34\u7EBF\u914D\u7F6E\uFF0CDocker\u5BB9\u5668\u5316\uFF0C\u670D\u52A1\u5668\u90E8\u7F72\u548C\u76D1\u63A7",
      soul: "",
      modelTier: "mid",
      tools: { allow: [] }
    }
  ];
  const discovery = createRichDiscovery();
  const result = executePlanningPipeline({
    blueprints,
    requirement: "\u642D\u5EFA\u5168\u6808\u72EC\u7ACB\u5F00\u53D1\u8005\u52A9\u624B\u56E2\u961F\uFF0C\u8986\u76D6\u4EA7\u54C1\u8BBE\u8BA1\u3001\u67B6\u6784\u3001\u524D\u540E\u7AEF\u5F00\u53D1\u3001\u6D4B\u8BD5\u548CDevOps\u5168\u6D41\u7A0B",
    userCtx,
    discovery
  });
  subsection("Pipeline \u6982\u89C8");
  console.log(`  \u8F6E\u6B21: ${result.totalRounds} | \u5206\u6570: ${result.verification.score} | \u8986\u76D6\u7387: ${result.coverageScore}% | \u901A\u8FC7: ${result.verification.overallPass}`);
  subsection("\u57FA\u7840\u9A8C\u8BC1");
  assert(result.verification.score >= 40, `\u5206\u6570 \u2265 40 (\u5B9E\u9645: ${result.verification.score})`);
  assert(result.blueprints.length >= 5, `\u56E2\u961F \u2265 5\u4EBA (\u5B9E\u9645: ${result.blueprints.length})`);
  subsection("\u4EE3\u7801\u80FD\u529B\u5BA1\u67E5");
  const frontendDev = result.blueprints.find((bp) => bp.id === "frontend-dev");
  const backendDev = result.blueprints.find((bp) => bp.id === "backend-dev");
  if (frontendDev?.inferredCapabilities) {
    const hasCoding = frontendDev.inferredCapabilities.skills.some((s) => /coding|code/i.test(s));
    assert(hasCoding, `\u524D\u7AEF\u5F00\u53D1\u6709\u7F16\u7801 skill (${frontendDev.inferredCapabilities.skills.join(", ")})`);
    const hasCodingProfile = frontendDev.inferredCapabilities.tools.profile === "coding";
    assert(hasCodingProfile, `\u524D\u7AEF\u5F00\u53D1\u4F7F\u7528 coding \u5DE5\u5177 profile`);
  }
  if (backendDev?.inferredCapabilities) {
    const hasCoding = backendDev.inferredCapabilities.skills.some((s) => /coding|code/i.test(s));
    assert(hasCoding, `\u540E\u7AEF\u5F00\u53D1\u6709\u7F16\u7801 skill`);
    const hasFs = (backendDev.inferredCapabilities.tools.alsoAllow ?? []).some((t) => /group:fs|group:runtime/i.test(t));
    if (!hasFs) {
      finding("info", "\u5DE5\u5177\u7F3A\u5931", `\u540E\u7AEF\u5F00\u53D1\u672A\u83B7\u5F97 group:fs \u5DE5\u5177`);
    }
  }
  subsection("SOTA \u6A21\u578B\u5BA1\u67E5");
  const architect = result.blueprints.find((bp) => bp.id === "architect");
  if (architect?.inferredCapabilities) {
    const model = architect.inferredCapabilities.model.primary;
    assert(/opus|o3|claude|gpt/i.test(model), `\u67B6\u6784\u5E08\u4F7F\u7528\u9AD8\u7AEF\u6A21\u578B (${model})`);
    const complexity = estimateRoleComplexity(architect.role);
    assert(complexity === "complex", `\u67B6\u6784\u5E08\u590D\u6742\u5EA6=complex (\u5B9E\u9645: ${complexity})`);
  }
  subsection("GitHub \u8D44\u6E90\u8986\u76D6");
  const githubCovered = result.blueprints.some((bp) => {
    const skills = bp.inferredCapabilities?.skills ?? [];
    const mcp = bp.inferredCapabilities?.mcpHints ?? [];
    return skills.some((s) => /github/i.test(s)) || mcp.some((m) => /github/i.test(m));
  });
  assert(githubCovered, "\u81F3\u5C11\u4E00\u4E2A\u6210\u5458\u6709 GitHub \u80FD\u529B");
  subsection("DevOps \u80FD\u529B\u5BA1\u67E5");
  const devops = result.blueprints.find((bp) => bp.id === "devops");
  if (devops?.inferredCapabilities) {
    const hasDockerMCP = devops.inferredCapabilities.mcpHints.some((m) => /docker/i.test(m));
    if (!hasDockerMCP) {
      finding("info", "MCP \u7F3A\u5931", `DevOps \u89D2\u8272\u542B Docker \u4F46\u672A\u5339\u914D docker MCP (mcpHints: ${devops.inferredCapabilities.mcpHints.join(", ")})`);
    }
  }
  printVerification(result.verification);
}
function crossCuttingAnalysis(results) {
  section("\u8DE8\u573A\u666F\u4EA4\u53C9\u5BA1\u67E5");
  console.log("\n  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
  console.log("  \u2502 \u573A\u666F                                \u2502 \u5206\u6570 \u2502 \u8986\u76D6\u7387\u2502 \u901A\u8FC7 \u2502 \u6210\u5458\u6570\u2502 \u8F6E\u6B21 \u2502 \u7F3A\u53E3 \u2502");
  console.log("  \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
  for (const r of results) {
    const name = r.name.padEnd(17, "\u3000");
    console.log(`  \u2502 ${name}\u2502 ${String(r.score).padStart(4)} \u2502 ${String(r.coverageScore + "%").padStart(5)} \u2502 ${r.pass ? " \u2705 " : " \u274C "} \u2502 ${String(r.agentCount).padStart(5)} \u2502 ${String(r.rounds).padStart(4)} \u2502 ${String(r.gaps).padStart(4)} \u2502`);
  }
  console.log("  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2518");
  const passRate = results.filter((r) => r.pass).length / results.length;
  console.log(`
  \u6574\u4F53\u901A\u8FC7\u7387: ${Math.round(passRate * 100)}% (${results.filter((r) => r.pass).length}/${results.length})`);
  const avgScore = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
  console.log(`  \u5E73\u5747\u5206\u6570: ${avgScore}`);
  const avgCoverage = Math.round(results.reduce((s, r) => s + r.coverageScore, 0) / results.length);
  console.log(`  \u5E73\u5747\u8986\u76D6\u7387: ${avgCoverage}%`);
  const totalAutoActions = results.reduce((s, r) => s + r.autoActions, 0);
  console.log(`  \u603B\u81EA\u52A8\u4F18\u5316\u64CD\u4F5C: ${totalAutoActions} \u6B21`);
}
function printVerification(v) {
  const report = formatVerificationReport(v);
  console.log("\n  \u{1F4CB} \u9A8C\u8BC1\u62A5\u544A:");
  console.log("  " + report.split("\n").join("\n  "));
}
function main() {
  console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log("\u2551    \u7B2C\u4E09\u65B9\u4E13\u5BB6\u5BA1\u67E5 \u2014 Agent Team \u6DF1\u5EA6\u538B\u529B\u6D4B\u8BD5                      \u2551");
  console.log("\u2551    8 \u5927\u4E2D\u56FD\u5C0F\u767D\u7528\u6237\u5201\u94BB\u573A\u666F \xB7 \u5168\u65B9\u4F4D\u8D28\u91CF\u8BC4\u5BA1                     \u2551");
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
  const scenarioResults = [];
  const scenarios = [
    { fn: scenario1_XiaohongshuFactory, name: "\u5C0F\u7EA2\u4E66\u7206\u6B3E\u6587\u6848\u5DE5\u5382" },
    { fn: scenario2_MultiChannelMatrix, name: "\u591A\u6E20\u9053\u81EA\u5A92\u4F53\u77E9\u9635" },
    { fn: scenario3_CrossBorderEcommerce, name: "\u8DE8\u5883\u7535\u5546\u5BA2\u670D" },
    { fn: scenario4_KnowledgeAndLearning, name: "\u4E2A\u4EBA\u77E5\u8BC6\u7BA1\u7406\u5B66\u4E60\u52A9\u624B" },
    { fn: scenario5_PrivateTrafficOps, name: "\u79C1\u57DF\u6D41\u91CF\u8FD0\u8425" },
    { fn: scenario6_VideoScriptFactory, name: "AI\u89C6\u9891\u811A\u672C\u5DE5\u5382" },
    { fn: scenario7_FamilyFinance, name: "\u5BB6\u5EAD\u8D22\u52A1\u7BA1\u5BB6" },
    { fn: scenario8_SoloDeveloper, name: "\u5168\u6808\u72EC\u7ACB\u5F00\u53D1\u8005\u52A9\u624B" }
  ];
  for (const s of scenarios) {
    const startTotal = totalTests;
    const startPass = passedTests;
    try {
      s.fn();
    } catch (err) {
      console.log(`  ${FAIL} ${s.name} \u6267\u884C\u51FA\u9519: ${err}`);
      allFindings.push({
        scenario: s.name,
        severity: "critical",
        category: "runtime_error",
        detail: `${err}`
      });
    }
  }
  const discovery = createRichDiscovery();
  const scenarioConfigs = [
    {
      name: "\u5C0F\u7EA2\u4E66\u7206\u6B3E\u6587\u6848\u5DE5\u5382",
      requirement: "\u6253\u9020\u5C0F\u7EA2\u4E66\u7206\u6B3E\u6587\u6848\u5168\u81EA\u52A8\u5316\u6D41\u6C34\u7EBF",
      userCtx: { scenario: "content", channels: ["wechat"], resources: [], volume: "high", budget: "cheap" },
      blueprints: [
        { name: "\u70ED\u70B9\u730E\u624B", id: "t1", role: "\u76D1\u63A7\u5C0F\u7EA2\u4E66\u70ED\u95E8\u8BDD\u9898", soul: "", modelTier: "cheap", tools: { allow: [] } },
        { name: "\u6587\u6848\u624B", id: "t2", role: "\u64B0\u5199\u5C0F\u7EA2\u4E66\u79CD\u8349\u6587\u6848", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "\u5C01\u9762\u5E08", id: "t3", role: "\u751F\u6210\u5C01\u9762\u914D\u56FE", soul: "", modelTier: "cheap", tools: { allow: [] } },
        { name: "\u590D\u76D8\u5458", id: "t4", role: "\u5206\u6790\u6570\u636E\u4F18\u5316\u7B56\u7565", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "\u4E92\u52A8\u5B98", id: "t5", role: "\u56DE\u590D\u8BC4\u8BBA\u4E92\u52A8", soul: "", modelTier: "cheap", tools: { allow: [] } }
      ]
    },
    {
      name: "\u591A\u6E20\u9053\u81EA\u5A92\u4F53\u77E9\u9635",
      requirement: "\u642D\u5EFA\u591A\u6E20\u9053\u81EA\u5A92\u4F53\u77E9\u9635",
      userCtx: { scenario: "content", channels: ["wechat", "web"], resources: [], volume: "high", budget: "balanced" },
      blueprints: [
        { name: "\u9009\u9898\u603B\u76D1", id: "m1", role: "\u5404\u5E73\u53F0\u9009\u9898\u7B56\u5212", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "\u516C\u4F17\u53F7\u4F5C\u8005", id: "m2", role: "\u64B0\u5199\u516C\u4F17\u53F7\u6587\u7AE0", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "\u5C0F\u7EA2\u4E66\u8FBE\u4EBA", id: "m3", role: "\u521B\u4F5C\u5C0F\u7EA2\u4E66\u7B14\u8BB0", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "\u77ED\u89C6\u9891\u6587\u6848", id: "m4", role: "\u64B0\u5199\u77ED\u89C6\u9891\u811A\u672C", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "B\u7AD9\u52A9\u624B", id: "m5", role: "\u64B0\u5199B\u7AD9\u6807\u9898\u7B80\u4ECB", soul: "", modelTier: "cheap", tools: { allow: [] } },
        { name: "\u5206\u53D1\u5458", id: "m6", role: "\u591A\u5E73\u53F0\u5206\u53D1\u5B9A\u65F6\u53D1\u5E03", soul: "", modelTier: "cheap", tools: { allow: [] } }
      ]
    },
    {
      name: "\u8DE8\u5883\u7535\u5546\u5BA2\u670D",
      requirement: "\u642D\u5EFA\u8DE8\u5883\u7535\u5546\u667A\u80FD\u5BA2\u670D\u7CFB\u7EDF\uFF0C\u4E2D\u82F1\u53CC\u8BED\uFF0CFAQ\u77E5\u8BC6\u5E93\u548C\u5DE5\u5355\u7BA1\u7406",
      userCtx: { scenario: "customer_support", channels: ["wechat", "web"], resources: ["faq_doc", "database"], volume: "high", budget: "balanced" },
      blueprints: [
        { name: "\u4E2D\u6587\u5BA2\u670D", id: "c1", role: "\u5904\u7406\u4E2D\u6587\u7528\u6237\u54A8\u8BE2\u9000\u6362\u8D27", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "\u82F1\u6587\u5BA2\u670D", id: "c2", role: "Handle English customer inquiries", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "\u7FFB\u8BD1\u5458", id: "c3", role: "\u4E2D\u82F1\u53CC\u8BED\u7FFB\u8BD1", soul: "", modelTier: "cheap", tools: { allow: [] } },
        { name: "\u5DE5\u5355\u5458", id: "c4", role: "\u521B\u5EFA\u8DDF\u8E2A\u552E\u540E\u5DE5\u5355", soul: "", modelTier: "cheap", tools: { allow: [] } },
        { name: "FAQ\u7BA1\u7406", id: "c5", role: "\u7EF4\u62A4FAQ\u77E5\u8BC6\u5E93", soul: "", modelTier: "cheap", tools: { allow: [] } }
      ]
    },
    {
      name: "\u4E2A\u4EBA\u77E5\u8BC6\u7BA1\u7406\u5B66\u4E60\u52A9\u624B",
      requirement: "\u642D\u5EFA\u4E2A\u4EBA\u77E5\u8BC6\u7BA1\u7406\u7CFB\u7EDF\uFF0C\u9605\u8BFBPDF\u8BBA\u6587\u3001\u505A\u7B14\u8BB0\u603B\u7ED3\u3001\u5B9A\u65F6\u590D\u4E60",
      userCtx: { scenario: "learning", channels: [], resources: ["pdf", "notion"], volume: "low", budget: "cheap" },
      blueprints: [
        { name: "\u9605\u8BFB\u5668", id: "l1", role: "\u9605\u8BFBPDF\u7F51\u9875\u63D0\u53D6\u6458\u8981", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "\u77E5\u8BC6\u7BA1\u7406", id: "l2", role: "\u6574\u7406\u77E5\u8BC6\u5173\u8054\u56FE\u8C31", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "\u590D\u4E60\u6559\u7EC3", id: "l3", role: "\u5B9A\u65F6\u63D0\u9192\u590D\u4E60\u751F\u6210\u95EA\u5361", soul: "", modelTier: "cheap", tools: { allow: [] } },
        { name: "\u8BBA\u6587\u52A9\u8BFB", id: "l4", role: "\u8F85\u52A9\u9605\u8BFB\u5B66\u672F\u8BBA\u6587\u89E3\u91CA\u672F\u8BED\u603B\u7ED3\u65B9\u6CD5", soul: "", modelTier: "mid", tools: { allow: [] } }
      ]
    },
    {
      name: "\u79C1\u57DF\u6D41\u91CF\u8FD0\u8425",
      requirement: "\u642D\u5EFA\u79C1\u57DF\u6D41\u91CF\u8FD0\u8425\u7CFB\u7EDF\uFF0C\u5FAE\u4FE1\u793E\u7FA4\u7BA1\u7406\u670B\u53CB\u5708\u8425\u9500\u7528\u6237\u753B\u50CF",
      userCtx: { scenario: "content", channels: ["wechat"], resources: ["database"], volume: "high", budget: "balanced" },
      blueprints: [
        { name: "\u793E\u7FA4\u8FD0\u8425", id: "p1", role: "\u7BA1\u7406\u5FAE\u4FE1\u793E\u7FA4\u53D1\u5E03\u7FA4\u516C\u544A", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "\u670B\u53CB\u5708\u7F16\u8F91", id: "p2", role: "\u64B0\u5199\u670B\u53CB\u5708\u6587\u6848\u914D\u56FE", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "\u753B\u50CF\u5206\u6790", id: "p3", role: "\u5206\u6790\u7528\u6237\u884C\u4E3A\u6570\u636E\u6253\u6807\u7B7E", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "\u6D3B\u52A8\u7B56\u5212", id: "p4", role: "\u7B56\u5212\u8425\u9500\u6D3B\u52A8\u4FC3\u9500\u65B9\u6848", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "\u5BA2\u6237\u56DE\u8BBF", id: "p5", role: "\u5B9A\u671F\u56DE\u8BBF\u8001\u5BA2\u6237\u6536\u96C6\u53CD\u9988", soul: "", modelTier: "cheap", tools: { allow: [] } }
      ]
    },
    {
      name: "AI\u89C6\u9891\u811A\u672C\u5DE5\u5382",
      requirement: "\u642D\u5EFAAI\u89C6\u9891\u811A\u672C\u5168\u6D41\u7A0B\u5DE5\u5382\uFF0C\u9009\u9898\u5230\u811A\u672C\u5230\u5206\u955C\u5230\u914D\u97F3\u5230\u5B57\u5E55",
      userCtx: { scenario: "content", channels: [], resources: [], volume: "medium", budget: "premium" },
      blueprints: [
        { name: "\u9009\u9898\u7814\u7A76", id: "v1", role: "\u6DF1\u5EA6\u8C03\u7814\u89C6\u9891\u9009\u9898\u5206\u6790\u7ADE\u54C1", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "\u7F16\u5267", id: "v2", role: "\u64B0\u5199\u5B8C\u6574\u89C6\u9891\u811A\u672C", soul: "", modelTier: "sota", tools: { allow: [] } },
        { name: "\u5206\u955C\u5E08", id: "v3", role: "\u5C06\u811A\u672C\u62C6\u89E3\u4E3A\u5206\u955C\u63CF\u8FF0\u753B\u9762", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "\u914D\u97F3\u6587\u6848", id: "v4", role: "\u6539\u5199\u53E3\u64AD\u914D\u97F3\u6587\u6848", soul: "", modelTier: "cheap", tools: { allow: [] } },
        { name: "\u5B57\u5E55\u751F\u6210", id: "v5", role: "\u751F\u6210\u5B57\u5E55\u6587\u4EF6\u4E2D\u82F1\u53CC\u8BED\u5B57\u5E55\u7FFB\u8BD1", soul: "", modelTier: "cheap", tools: { allow: [] } }
      ]
    },
    {
      name: "\u5BB6\u5EAD\u8D22\u52A1\u7BA1\u5BB6",
      requirement: "\u642D\u5EFA\u5BB6\u5EAD\u8D22\u52A1\u7BA1\u7406\u7CFB\u7EDF\uFF0C\u65E5\u5E38\u8BB0\u8D26\u9884\u7B97\u7BA1\u7406\u7406\u8D22\u5206\u6790\u8D22\u52A1\u62A5\u8868",
      userCtx: { scenario: "finance", channels: ["wechat"], resources: ["database"], volume: "low", budget: "cheap" },
      blueprints: [
        { name: "\u8BB0\u8D26\u52A9\u624B", id: "f1", role: "\u8BB0\u5F55\u65E5\u5E38\u6536\u652F\u81EA\u52A8\u5206\u7C7B", soul: "", modelTier: "cheap", tools: { allow: [] } },
        { name: "\u9884\u7B97\u7BA1\u5BB6", id: "f2", role: "\u5236\u5B9A\u9884\u7B97\u76D1\u63A7\u6267\u884C\u8D85\u652F\u9884\u8B66", soul: "", modelTier: "cheap", tools: { allow: [] } },
        { name: "\u7406\u8D22\u987E\u95EE", id: "f3", role: "\u5206\u6790\u8D44\u4EA7\u914D\u7F6E\u7406\u8D22\u5EFA\u8BAE", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "\u62A5\u8868\u751F\u6210", id: "f4", role: "\u751F\u6210\u62A5\u8868\u53EF\u89C6\u5316\u8D8B\u52BF\u5BFC\u51FAPDF", soul: "", modelTier: "cheap", tools: { allow: [] } }
      ]
    },
    {
      name: "\u5168\u6808\u72EC\u7ACB\u5F00\u53D1\u8005\u52A9\u624B",
      requirement: "\u642D\u5EFA\u5168\u6808\u5F00\u53D1\u8005\u52A9\u624B\uFF0C\u8986\u76D6\u4EA7\u54C1\u67B6\u6784\u524D\u540E\u7AEF\u6D4B\u8BD5DevOps",
      userCtx: { scenario: "coding", channels: [], resources: ["github", "database"], volume: "medium", budget: "premium" },
      blueprints: [
        { name: "\u4EA7\u54C1\u7ECF\u7406", id: "d1", role: "\u9700\u6C42\u5206\u6790PRD\u7528\u6237\u6545\u4E8B", soul: "", modelTier: "sota", tools: { allow: [] } },
        { name: "\u67B6\u6784\u5E08", id: "d2", role: "\u7CFB\u7EDF\u67B6\u6784\u8BBE\u8BA1\u6280\u672F\u9009\u578B\u6570\u636E\u5E93\u8BBE\u8BA1", soul: "", modelTier: "sota", tools: { allow: [] } },
        { name: "\u524D\u7AEF\u5F00\u53D1", id: "d3", role: "React\u524D\u7AEF\u5F00\u53D1\u7EC4\u4EF6\u7F16\u5199CSS", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "\u540E\u7AEF\u5F00\u53D1", id: "d4", role: "Node.js\u540E\u7AEF\u5F00\u53D1API\u6570\u636E\u5E93", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "\u6D4B\u8BD5\u5DE5\u7A0B\u5E08", id: "d5", role: "\u7F16\u5199\u5355\u5143\u6D4B\u8BD5\u96C6\u6210\u6D4B\u8BD5Bug\u5B9A\u4F4D", soul: "", modelTier: "mid", tools: { allow: [] } },
        { name: "DevOps", id: "d6", role: "CI/CD\u914D\u7F6EDocker\u5BB9\u5668\u5316\u90E8\u7F72\u76D1\u63A7", soul: "", modelTier: "mid", tools: { allow: [] } }
      ]
    }
  ];
  for (const cfg of scenarioConfigs) {
    const r = executePlanningPipeline({
      blueprints: cfg.blueprints,
      requirement: cfg.requirement,
      userCtx: cfg.userCtx,
      discovery
    });
    scenarioResults.push({
      name: cfg.name,
      score: r.verification.score,
      coverageScore: r.coverageScore,
      pass: r.verification.overallPass,
      agentCount: r.blueprints.length,
      rounds: r.totalRounds,
      autoActions: r.rounds.reduce((s, rd) => s + rd.actionsApplied.length, 0),
      gaps: r.verification.gaps.length
    });
  }
  crossCuttingAnalysis(scenarioResults);
  section("\u8003\u6838\u7ED3\u679C\u6C47\u603B");
  console.log(`
  \u603B\u6D4B\u8BD5\u6570: ${totalTests}`);
  console.log(`  ${PASS} \u901A\u8FC7: ${passedTests}`);
  console.log(`  ${FAIL} \u5931\u8D25: ${failedTests}`);
  console.log(`  \u901A\u8FC7\u7387: ${Math.round(passedTests / totalTests * 100)}%`);
  if (allFindings.length > 0) {
    const criticals = allFindings.filter((f) => f.severity === "critical");
    const warnings = allFindings.filter((f) => f.severity === "warning");
    const infos = allFindings.filter((f) => f.severity === "info");
    console.log(`
  \u53D1\u73B0\u95EE\u9898\u6C47\u603B:`);
    if (criticals.length > 0) {
      console.log(`    ${FAIL} \u4E25\u91CD: ${criticals.length} \u4E2A`);
      for (const f of criticals) {
        console.log(`      - [${f.scenario}] ${f.detail}`);
      }
    }
    if (warnings.length > 0) {
      console.log(`    ${WARN} \u8B66\u544A: ${warnings.length} \u4E2A`);
      for (const f of warnings) {
        console.log(`      - [${f.scenario}] ${f.category}: ${f.detail}`);
      }
    }
    if (infos.length > 0) {
      console.log(`    ${INFO} \u5EFA\u8BAE: ${infos.length} \u4E2A`);
      for (const f of infos) {
        console.log(`      - [${f.scenario}] ${f.category}: ${f.detail}`);
      }
    }
  }
  const passRate = totalTests > 0 ? passedTests / totalTests : 0;
  let grade = "F";
  if (passRate >= 0.98) grade = "A+";
  else if (passRate >= 0.95) grade = "A";
  else if (passRate >= 0.9) grade = "B+";
  else if (passRate >= 0.85) grade = "B";
  else if (passRate >= 0.8) grade = "C+";
  else if (passRate >= 0.7) grade = "C";
  else if (passRate >= 0.6) grade = "D";
  const gradeLabel = {
    "A+": "\u4F18\u79C0",
    "A": "\u826F\u597D",
    "B+": "\u4E2D\u4E0A",
    "B": "\u4E2D\u7B49",
    "C+": "\u53CA\u683C",
    "C": "\u521A\u53CA\u683C",
    "D": "\u4E0D\u53CA\u683C",
    "F": "\u4E25\u91CD\u4E0D\u5408\u683C"
  };
  console.log(`
  \u{1F3C6} \u7EFC\u5408\u8BC4\u7EA7: ${grade} (${gradeLabel[grade]})`);
  if (failedTests > 0) {
    process.exit(1);
  }
}
main();
