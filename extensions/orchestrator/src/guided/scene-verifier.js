import { MAX_SKILLS_PER_AGENT, MAX_MCP_PER_AGENT } from "./runtime-discovery.js";
import { isSupervisorRole } from "./capability-inference.js";
function decomposeRequirement(requirement, scenario) {
  const subs = [];
  const patterns = {
    content: [/选题|热点|trend/i, /写作|文案|write|copy|撰写|创作/i, /配图|排版|图片|image|封面|视觉/i, /发布|推送|publish|分发|distribut/i, /SEO|优化|运营/i],
    coding: [/代码|code|编程/i, /测试|test/i, /review|审查/i, /文档|doc/i, /部署|deploy/i],
    customer_support: [/客服|support/i, /FAQ|问答/i, /工单|ticket/i, /数据|分析|analy/i],
    research: [/搜索|search/i, /分析|analy/i, /报告|report/i, /数据|data/i],
    data_analysis: [/数据|data/i, /分析|analy/i, /可视化|visual/i, /报表|report/i],
    news: [/新闻|news/i, /监控|monitor/i, /摘要|summary/i, /推送|push/i],
    finance: [/记账|account/i, /分析|analy/i, /报表|report/i, /预算|budget/i],
    scheduling: [/日程|calendar/i, /提醒|remind/i, /任务|task/i],
    learning: [/学习|learn/i, /总结|summary/i, /练习|practice/i, /笔记|note/i]
  };
  const scenarioPatterns = patterns[scenario] ?? [];
  for (const pattern of scenarioPatterns) {
    if (pattern.test(requirement)) {
      const match = requirement.match(pattern);
      if (match) subs.push(match[0]);
    }
  }
  const genericPatterns = [
    /搜索|查询|检索|search|query/i,
    /写作|撰写|创作|write|create/i,
    /分析|统计|analy/i,
    /总结|摘要|summarize/i,
    /翻译|translate/i,
    /代码|编程|code|program/i,
    /图片|配图|image|illustrat/i,
    /数据|data/i,
    /客服|接待|support/i,
    /定时|提醒|schedule|remind/i,
    /文档|文件|doc|file/i,
    /新闻|资讯|news/i
  ];
  for (const pattern of genericPatterns) {
    if (pattern.test(requirement)) {
      const match = requirement.match(pattern);
      if (match && !subs.includes(match[0])) {
        subs.push(match[0]);
      }
    }
  }
  return subs.length > 0 ? subs : [requirement.slice(0, 30)];
}
function checkSkillAvailability(blueprints, discovery) {
  if (!discovery || discovery.skills.length === 0) {
    return {
      name: "skill_availability",
      pass: true,
      detail: "\u8DF3\u8FC7\u6280\u80FD\u53EF\u7528\u6027\u68C0\u67E5\uFF08\u65E0\u8FD0\u884C\u65F6\u53D1\u73B0\u6570\u636E\uFF09",
      severity: "info"
    };
  }
  const installedNames = new Set(discovery.skills.map((s) => s.name.toLowerCase()));
  const missing = [];
  const missingSkillNames = /* @__PURE__ */ new Set();
  let totalSkillRefs = 0;
  for (const bp of blueprints) {
    const skills = bp.inferredCapabilities?.skills ?? bp.tools?.skills ?? [];
    for (const skill of skills) {
      totalSkillRefs++;
      if (!installedNames.has(skill.toLowerCase())) {
        missing.push(`${bp.name}: ${skill}`);
        missingSkillNames.add(skill.toLowerCase());
      }
    }
  }
  if (missing.length === 0) {
    return {
      name: "skill_availability",
      pass: true,
      detail: "\u6240\u6709\u63A8\u8350\u6280\u80FD\u5747\u5DF2\u5B89\u88C5",
      severity: "info"
    };
  }
  const missingRatio = totalSkillRefs > 0 ? missingSkillNames.size / totalSkillRefs : 0;
  const severity = missingRatio > 0.5 ? "critical" : "warning";
  return {
    name: "skill_availability",
    pass: severity !== "critical",
    detail: `\u4EE5\u4E0B\u63A8\u8350\u6280\u80FD\u672A\u5B89\u88C5\uFF08${missingSkillNames.size} \u79CD\uFF09: ${[...missingSkillNames].join(", ")}`,
    severity
  };
}
function checkMCPAvailability(blueprints, discovery) {
  if (!discovery || discovery.mcpServers.length === 0) {
    return {
      name: "mcp_availability",
      pass: true,
      detail: "\u8DF3\u8FC7 MCP \u53EF\u7528\u6027\u68C0\u67E5\uFF08\u65E0\u8FD0\u884C\u65F6\u53D1\u73B0\u6570\u636E\uFF09",
      severity: "info"
    };
  }
  const runningIds = new Set(
    discovery.mcpServers.filter((s) => s.enabled && s.running).map((s) => s.id.toLowerCase())
  );
  const missing = [];
  for (const bp of blueprints) {
    const mcpHints = bp.inferredCapabilities?.mcpHints ?? bp.tools?.mcpServers ?? [];
    for (const hint of mcpHints) {
      if (!runningIds.has(hint.toLowerCase())) {
        missing.push(`${bp.name}: ${hint}`);
      }
    }
  }
  if (missing.length === 0) {
    return {
      name: "mcp_availability",
      pass: true,
      detail: "\u6240\u6709\u63A8\u8350 MCP \u670D\u52A1\u5747\u5728\u8FD0\u884C",
      severity: "info"
    };
  }
  return {
    name: "mcp_availability",
    pass: false,
    detail: `\u4EE5\u4E0B MCP \u670D\u52A1\u672A\u8FD0\u884C: ${missing.join(", ")}`,
    severity: "warning"
  };
}
function checkRequirementCoverage(requirement, blueprints, scenario) {
  const subs = decomposeRequirement(requirement, scenario);
  const gaps = [];
  const roleTokenSets = blueprints.map((bp) => {
    const text = `${bp.name} ${bp.role}`.toLowerCase();
    const cjk = text.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
    const latin = text.match(/[a-z][a-z0-9_-]{2,}/g) ?? [];
    return /* @__PURE__ */ new Set([...cjk, ...latin]);
  });
  const synonyms = {
    "\u5BA2\u670D": ["\u63A5\u5F85", "\u652F\u6301", "\u670D\u52A1", "support", "\u5BA2\u6237"],
    "support": ["\u63A5\u5F85", "\u5BA2\u670D", "\u670D\u52A1", "help"],
    "\u5199\u4F5C": ["\u64B0\u5199", "\u521B\u4F5C", "\u6587\u6848", "write", "copy", "\u5185\u5BB9"],
    "write": ["\u5199\u4F5C", "\u64B0\u5199", "\u521B\u4F5C", "\u6587\u6848", "content"],
    "\u641C\u7D22": ["\u67E5\u8BE2", "\u68C0\u7D22", "search", "\u67E5\u627E", "\u8C03\u7814"],
    "search": ["\u641C\u7D22", "\u67E5\u8BE2", "\u68C0\u7D22", "\u67E5\u627E"],
    "\u4EE3\u7801": ["\u7F16\u7A0B", "code", "program", "\u7F16\u7801", "\u5F00\u53D1"],
    "code": ["\u4EE3\u7801", "\u7F16\u7A0B", "\u7F16\u7801", "\u5F00\u53D1"],
    "\u6570\u636E": ["data", "\u7EDF\u8BA1", "\u5206\u6790"],
    "data": ["\u6570\u636E", "\u7EDF\u8BA1"],
    "\u5DE5\u5355": ["ticket", "issue", "\u95EE\u9898\u5904\u7406", "\u5DE5\u4F5C\u5355"],
    "\u67E5\u8BE2": ["\u67E5\u627E", "\u641C\u7D22", "\u68C0\u7D22", "search", "query"],
    "\u6392\u7248": ["\u683C\u5F0F", "\u9002\u914D", "\u6837\u5F0F", "layout", "format", "\u6A21\u677F"],
    "\u5206\u53D1": ["\u53D1\u5E03", "\u63A8\u9001", "publish", "distribute", "\u540C\u6B65"],
    "\u914D\u56FE": ["\u5C01\u9762", "\u56FE\u7247", "image", "\u63D2\u56FE", "\u89C6\u89C9"],
    "\u7FFB\u8BD1": ["translate", "\u53CC\u8BED", "\u591A\u8BED", "\u672C\u5730\u5316"],
    "\u76D1\u63A7": ["\u8FFD\u8E2A", "watch", "monitor", "\u9884\u8B66", "\u544A\u8B66"]
  };
  for (const sub of subs) {
    const subLower = sub.toLowerCase();
    const expandedKeywords = [subLower, ...(synonyms[subLower] ?? []).map((s) => s.toLowerCase())];
    const coveredByRole = roleTokenSets.some((tokens) => {
      for (const kw of expandedKeywords) {
        if (tokens.has(kw)) return true;
        if (kw.length >= 2) {
          for (const token of tokens) {
            if (token.includes(kw)) return true;
          }
        }
      }
      return false;
    });
    const coveredBySkill = blueprints.some((bp) => {
      const skills = bp.inferredCapabilities?.skills ?? bp.tools?.skills ?? [];
      return skills.some((s) => {
        const sLower = s.toLowerCase();
        for (const kw of expandedKeywords) {
          if (sLower === kw || kw.length >= 2 && sLower.includes(kw)) return true;
        }
        return false;
      });
    });
    if (!coveredByRole && !coveredBySkill) {
      gaps.push({
        requirement: sub,
        missingCapability: `\u6CA1\u6709 agent \u8986\u76D6\u300C${sub}\u300D\u76F8\u5173\u80FD\u529B`,
        suggestion: `\u8003\u8651\u6DFB\u52A0\u4E00\u4E2A\u4E13\u95E8\u5904\u7406\u300C${sub}\u300D\u7684 agent\uFF0C\u6216\u4E3A\u73B0\u6709 agent \u6DFB\u52A0\u76F8\u5173\u6280\u80FD`
      });
    }
  }
  const coverageRatio = subs.length > 0 ? (subs.length - gaps.length) / subs.length : 1;
  return {
    check: {
      name: "requirement_coverage",
      pass: gaps.length === 0,
      detail: gaps.length === 0 ? `\u9700\u6C42\u8986\u76D6\u7387 100%\uFF08${subs.length} \u4E2A\u5B50\u9700\u6C42\u5168\u90E8\u8986\u76D6\uFF09` : `\u9700\u6C42\u8986\u76D6\u7387 ${Math.round(coverageRatio * 100)}%\uFF08${gaps.length}/${subs.length} \u4E2A\u5B50\u9700\u6C42\u672A\u8986\u76D6\uFF09`,
      severity: gaps.length > subs.length / 2 ? "critical" : gaps.length > 0 ? "warning" : "info"
    },
    gaps
  };
}
function checkSupervisorPresence(blueprints) {
  if (blueprints.length < 2) {
    return {
      name: "supervisor_presence",
      pass: true,
      detail: "\u5355 agent \u56E2\u961F\u65E0\u9700 Supervisor\uFF08\u5C06\u81EA\u52A8\u521B\u5EFA\uFF09",
      severity: "info"
    };
  }
  const hasSupervisor = blueprints.some((bp) => isSupervisorRole(bp.role, bp.id));
  return {
    name: "supervisor_presence",
    pass: true,
    detail: hasSupervisor ? "\u56E2\u961F\u5305\u542B Supervisor \u89D2\u8272" : "Supervisor \u5C06\u5728\u90E8\u7F72\u65F6\u81EA\u52A8\u521B\u5EFA\uFF08\u4F7F\u7528\u7528\u6237\u914D\u7F6E\u7684\u6587\u672C\u6A21\u578B\uFF09",
    severity: "info"
  };
}
function checkChannelCoverage(blueprints, userCtx) {
  if (userCtx.channels.length === 0) {
    return {
      name: "channel_coverage",
      pass: true,
      detail: "\u672A\u6307\u5B9A\u6E20\u9053\u8981\u6C42",
      severity: "info"
    };
  }
  const validChannels = ["wechat", "dingtalk", "feishu", "telegram", "discord", "slack", "web"];
  const invalid = userCtx.channels.filter((ch) => !validChannels.includes(ch));
  if (invalid.length > 0) {
    return {
      name: "channel_coverage",
      pass: false,
      detail: `\u672A\u77E5\u6E20\u9053: ${invalid.join(", ")}`,
      severity: "warning"
    };
  }
  return {
    name: "channel_coverage",
    pass: true,
    detail: `\u6E20\u9053\u914D\u7F6E\u6B63\u5E38: ${userCtx.channels.join(", ")}`,
    severity: "info"
  };
}
function checkLimitsCompliance(blueprints) {
  const violations = [];
  for (const bp of blueprints) {
    const skillCount = bp.inferredCapabilities?.skills?.length ?? bp.tools?.skills?.length ?? 0;
    const mcpCount = bp.inferredCapabilities?.mcpHints?.length ?? bp.tools?.mcpServers?.length ?? 0;
    if (skillCount > MAX_SKILLS_PER_AGENT) {
      violations.push(`${bp.name}: ${skillCount} skills\uFF08\u4E0A\u9650 ${MAX_SKILLS_PER_AGENT}\uFF09`);
    }
    if (mcpCount > MAX_MCP_PER_AGENT) {
      violations.push(`${bp.name}: ${mcpCount} MCP servers\uFF08\u4E0A\u9650 ${MAX_MCP_PER_AGENT}\uFF09`);
    }
  }
  if (violations.length === 0) {
    return {
      name: "limits_compliance",
      pass: true,
      detail: `\u6240\u6709 agent \u5747\u5728\u9650\u5236\u8303\u56F4\u5185\uFF08skills \u2264${MAX_SKILLS_PER_AGENT}, MCP \u2264${MAX_MCP_PER_AGENT}\uFF09`,
      severity: "info"
    };
  }
  return {
    name: "limits_compliance",
    pass: false,
    detail: `\u8D85\u51FA\u9650\u5236: ${violations.join("; ")}`,
    severity: "critical"
  };
}
function checkResourceCoverage(blueprints, userCtx) {
  if (userCtx.resources.length === 0) {
    return {
      name: "resource_coverage",
      pass: true,
      detail: "\u672A\u6307\u5B9A\u8D44\u6E90\u8981\u6C42",
      severity: "info"
    };
  }
  const resourceSkillMap = {
    pdf: ["nano-pdf", "pdf"],
    github: ["github", "git"],
    database: ["sql", "database", "\u6570\u636E\u5E93", "sqlite", "\u6570\u636E"],
    notion: ["notion"],
    google_sheets: ["sheets", "google"],
    faq_doc: ["faq", "knowledge", "faq-builder", "\u77E5\u8BC6\u5E93", "self-troubleshoot", "memory"],
    api: ["api", "rest", "graphql"]
  };
  const uncovered = [];
  for (const resource of userCtx.resources) {
    const keywords = resourceSkillMap[resource] ?? [resource];
    const covered = blueprints.some((bp) => {
      const skills = bp.inferredCapabilities?.skills ?? bp.tools?.skills ?? [];
      const mcpHints = bp.inferredCapabilities?.mcpHints ?? bp.tools?.mcpServers ?? [];
      const allCaps = [...skills, ...mcpHints].join(" ").toLowerCase();
      return keywords.some((kw) => allCaps.includes(kw.toLowerCase()));
    });
    if (!covered) uncovered.push(resource);
  }
  if (uncovered.length === 0) {
    return {
      name: "resource_coverage",
      pass: true,
      detail: `\u6240\u6709\u8D44\u6E90\u9700\u6C42\u5DF2\u8986\u76D6: ${userCtx.resources.join(", ")}`,
      severity: "info"
    };
  }
  return {
    name: "resource_coverage",
    pass: false,
    detail: `\u4EE5\u4E0B\u8D44\u6E90\u672A\u88AB\u4EFB\u4F55 agent \u8986\u76D6: ${uncovered.join(", ")}`,
    severity: "warning"
  };
}
function verifyScene(params) {
  const { requirement, blueprints, userCtx, discovery } = params;
  const checks = [];
  let allGaps = [];
  const recommendations = [];
  checks.push(checkSkillAvailability(blueprints, discovery));
  checks.push(checkMCPAvailability(blueprints, discovery));
  const coverageResult = checkRequirementCoverage(requirement, blueprints, userCtx.scenario);
  checks.push(coverageResult.check);
  allGaps = [...allGaps, ...coverageResult.gaps];
  checks.push(checkSupervisorPresence(blueprints));
  checks.push(checkChannelCoverage(blueprints, userCtx));
  checks.push(checkLimitsCompliance(blueprints));
  checks.push(checkResourceCoverage(blueprints, userCtx));
  const criticalFails = checks.filter((c) => !c.pass && c.severity === "critical").length;
  const warningFails = checks.filter((c) => !c.pass && c.severity === "warning").length;
  const totalChecks = checks.length;
  const passedChecks = checks.filter((c) => c.pass).length;
  const score = Math.max(0, Math.min(
    100,
    Math.round(passedChecks / totalChecks * 100) - criticalFails * 20 - warningFails * 10
  ));
  const overallPass = criticalFails === 0 && score >= 40;
  if (criticalFails > 0) {
    recommendations.push("\u5B58\u5728\u5173\u952E\u95EE\u9898\u9700\u8981\u89E3\u51B3\u540E\u624D\u80FD\u90E8\u7F72");
  }
  if (score < 40 && criticalFails === 0) {
    recommendations.push("\u56E2\u961F\u8D28\u91CF\u8BC4\u5206\u8FC7\u4F4E\uFF08\u9700 \u226540 \u5206\uFF09\uFF0C\u5EFA\u8BAE\u4F18\u5316\u540E\u518D\u90E8\u7F72");
  }
  if (allGaps.length > 0) {
    recommendations.push(`\u53D1\u73B0 ${allGaps.length} \u4E2A\u9700\u6C42\u7F3A\u53E3\uFF0C\u5EFA\u8BAE\u6DFB\u52A0\u5BF9\u5E94\u80FD\u529B\u7684 agent \u6216\u6280\u80FD`);
  }
  if (score >= 80) {
    recommendations.push("\u56E2\u961F\u914D\u7F6E\u826F\u597D\uFF0C\u53EF\u4EE5\u90E8\u7F72");
  } else if (score >= 60) {
    recommendations.push("\u56E2\u961F\u57FA\u672C\u53EF\u7528\uFF0C\u4F46\u5EFA\u8BAE\u4F18\u5316\u540E\u518D\u90E8\u7F72");
  }
  return { overallPass, score, checks, gaps: allGaps, recommendations };
}
function formatVerificationReport(result) {
  const lines = [];
  const statusEmoji = result.overallPass ? "\u2705" : "\u26A0\uFE0F";
  lines.push(`${statusEmoji} \u56E2\u961F\u5B8C\u6574\u6027\u6821\u9A8C: ${result.score}/100 \u5206`);
  lines.push("");
  for (const check of result.checks) {
    const icon = check.pass ? "\u2713" : check.severity === "critical" ? "\u2717" : "\u25B3";
    lines.push(`  ${icon} ${check.detail}`);
  }
  if (result.gaps.length > 0) {
    lines.push("");
    lines.push("\u{1F4CB} \u9700\u6C42\u7F3A\u53E3:");
    for (const gap of result.gaps) {
      lines.push(`  - ${gap.missingCapability}`);
      lines.push(`    \u5EFA\u8BAE: ${gap.suggestion}`);
    }
  }
  if (result.recommendations.length > 0) {
    lines.push("");
    lines.push("\u{1F4A1} \u5EFA\u8BAE:");
    for (const rec of result.recommendations) {
      lines.push(`  - ${rec}`);
    }
  }
  return lines.join("\n");
}
export {
  formatVerificationReport,
  verifyScene
};
