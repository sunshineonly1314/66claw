import { computeAverageDuration } from "./member-stats.js";
const LEARNING_CYCLE_THRESHOLD = 50;
const MIN_EVENTS_FOR_INSIGHTS = 10;
const UNDERUTILIZED_THRESHOLD = 0.05;
const OVERLOADED_THRESHOLD = 0.6;
const HIGH_FAILURE_RATE = 0.3;
const SLOW_AGENT_THRESHOLD_MS = 15e3;
function analyzeLearningOpportunities(projectId, events, healthMap, statsMap, project) {
  const insights = [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (events.length < MIN_EVENTS_FOR_INSIGHTS) {
    return {
      projectId,
      analyzedAt: now,
      eventCount: events.length,
      insights: [],
      routingPatterns: [],
      specializations: [],
      summary: `\u4E8B\u4EF6\u6570\u4E0D\u8DB3\uFF08${events.length}/${MIN_EVENTS_FOR_INSIGHTS}\uFF09\uFF0C\u6682\u4E0D\u751F\u6210\u5B66\u4E60\u6D1E\u5BDF\u3002`
    };
  }
  insights.push(...analyzeRoutingFailures(events, project));
  insights.push(...analyzeTimeoutPatterns(events, statsMap, project));
  insights.push(...analyzeUtilizationBalance(events, statsMap, project));
  insights.push(...analyzeUnderutilizedAgents(events, statsMap, project));
  insights.push(...analyzeSuccessPatterns(events, project));
  const routingPatterns = buildRoutingPatterns(events, project);
  const specializations = buildSpecializations(events, healthMap, statsMap, project);
  const highCount = insights.filter((i) => i.severity === "high").length;
  const mediumCount = insights.filter((i) => i.severity === "medium").length;
  const autoCount = insights.filter((i) => i.autoApplicable).length;
  const summaryParts = [];
  summaryParts.push(`\u5206\u6790 ${events.length} \u4E2A\u4E8B\u4EF6`);
  if (highCount > 0) summaryParts.push(`${highCount} \u4E2A\u9AD8\u4F18\u5148\u7EA7\u6D1E\u5BDF`);
  if (mediumCount > 0) summaryParts.push(`${mediumCount} \u4E2A\u4E2D\u4F18\u5148\u7EA7\u6D1E\u5BDF`);
  if (autoCount > 0) summaryParts.push(`${autoCount} \u4E2A\u53EF\u81EA\u52A8\u4F18\u5316`);
  if (routingPatterns.length > 0) summaryParts.push(`${routingPatterns.length} \u4E2A\u8DEF\u7531\u6A21\u5F0F`);
  return {
    projectId,
    analyzedAt: now,
    eventCount: events.length,
    insights,
    routingPatterns,
    specializations,
    summary: summaryParts.join("\uFF0C")
  };
}
function analyzeRoutingFailures(events, project) {
  const insights = [];
  const agentFailures = /* @__PURE__ */ new Map();
  for (const event of events) {
    if (!event.agentId) continue;
    let entry = agentFailures.get(event.agentId);
    if (!entry) {
      entry = { total: 0, failures: 0, errors: [] };
      agentFailures.set(event.agentId, entry);
    }
    entry.total++;
    if (event.success === false || event.outcome === "failure") {
      entry.failures++;
      if (event.error && entry.errors.length < 5) {
        entry.errors.push(event.error);
      }
    }
  }
  for (const [agentId, data] of agentFailures) {
    if (data.total < 3) continue;
    const failureRate = data.failures / data.total;
    if (failureRate >= HIGH_FAILURE_RATE) {
      const member = project.members.find((m) => m.id === agentId);
      const name = member?.name ?? agentId;
      const betterAgent = findBetterAlternative(agentId, events, project);
      insights.push({
        id: `routing_failure_${agentId}`,
        category: "routing_failure",
        severity: failureRate >= 0.5 ? "high" : "medium",
        description: `\u300C${name}\u300D\u5931\u8D25\u7387 ${Math.round(failureRate * 100)}%\uFF08${data.failures}/${data.total}\uFF09`,
        agentIds: [agentId],
        suggestion: betterAgent ? `\u8003\u8651\u5C06\u90E8\u5206\u4EFB\u52A1\u8DEF\u7531\u5230\u300C${betterAgent.name}\u300D\uFF08\u6210\u529F\u7387\u66F4\u9AD8\uFF09` : `\u68C0\u67E5\u300C${name}\u300D\u7684 SOUL \u548C\u6280\u80FD\u914D\u7F6E\u662F\u5426\u5339\u914D\u5176\u89D2\u8272`,
        autoApplicable: false
      });
    }
  }
  return insights;
}
function analyzeTimeoutPatterns(events, statsMap, project) {
  const insights = [];
  for (const member of project.members) {
    if (member.id === project.supervisorId) continue;
    const stats = statsMap.get(member.id);
    if (!stats || stats.callCount < 3) continue;
    const avgDuration = computeAverageDuration(stats);
    if (avgDuration > SLOW_AGENT_THRESHOLD_MS) {
      const recentEvents = events.filter((e) => e.agentId === member.id).slice(-10);
      const timeoutCount = recentEvents.filter(
        (e) => e.outcome === "timeout" || e.durationMs && e.durationMs > SLOW_AGENT_THRESHOLD_MS
      ).length;
      if (timeoutCount >= 2) {
        insights.push({
          id: `timeout_${member.id}`,
          category: "timeout_pattern",
          severity: timeoutCount >= 5 ? "high" : "medium",
          description: `\u300C${member.name}\u300D\u5E73\u5747\u54CD\u5E94 ${Math.round(avgDuration / 1e3)}s\uFF0C\u6700\u8FD1 ${timeoutCount} \u6B21\u8D85\u65F6`,
          agentIds: [member.id],
          suggestion: "\u8003\u8651\u589E\u52A0\u8D85\u65F6\u65F6\u95F4\u3001\u7B80\u5316\u4EFB\u52A1\u62C6\u5206\u3001\u6216\u5C06\u590D\u6742\u4EFB\u52A1\u5206\u914D\u7ED9\u66F4\u5F3A\u7684\u6A21\u578B",
          autoApplicable: false
        });
      }
    }
  }
  return insights;
}
function analyzeUtilizationBalance(events, _statsMap, project) {
  const insights = [];
  const nonSupervisorMembers = project.members.filter((m) => m.id !== project.supervisorId);
  if (nonSupervisorMembers.length < 2) return insights;
  const eventCounts = /* @__PURE__ */ new Map();
  let totalNonSupervisor = 0;
  for (const event of events) {
    if (event.agentId === project.supervisorId) continue;
    eventCounts.set(event.agentId, (eventCounts.get(event.agentId) ?? 0) + 1);
    totalNonSupervisor++;
  }
  if (totalNonSupervisor < 10) return insights;
  for (const [agentId, count] of eventCounts) {
    const ratio = count / totalNonSupervisor;
    if (ratio >= OVERLOADED_THRESHOLD) {
      const member = project.members.find((m) => m.id === agentId);
      if (!member) continue;
      insights.push({
        id: `overloaded_${agentId}`,
        category: "utilization_imbalance",
        severity: "medium",
        description: `\u300C${member.name}\u300D\u5904\u7406\u4E86 ${Math.round(ratio * 100)}% \u7684\u4EFB\u52A1\uFF0C\u8D1F\u8F7D\u8FC7\u9AD8`,
        agentIds: [agentId],
        suggestion: "\u8003\u8651\u62C6\u5206\u5176\u804C\u8D23\u6216\u6DFB\u52A0\u76F8\u540C\u89D2\u8272\u7684 agent \u5206\u62C5\u8D1F\u8F7D",
        autoApplicable: false
      });
    }
  }
  return insights;
}
function analyzeUnderutilizedAgents(events, _statsMap, project) {
  const insights = [];
  const nonSupervisorMembers = project.members.filter((m) => m.id !== project.supervisorId);
  if (nonSupervisorMembers.length < 2) return insights;
  const eventCounts = /* @__PURE__ */ new Map();
  let totalEvents = 0;
  for (const event of events) {
    if (event.agentId === project.supervisorId) continue;
    eventCounts.set(event.agentId, (eventCounts.get(event.agentId) ?? 0) + 1);
    totalEvents++;
  }
  if (totalEvents < 10) return insights;
  for (const member of nonSupervisorMembers) {
    const count = eventCounts.get(member.id) ?? 0;
    const ratio = totalEvents > 0 ? count / totalEvents : 0;
    if (ratio <= UNDERUTILIZED_THRESHOLD) {
      insights.push({
        id: `underutilized_${member.id}`,
        category: "underutilized_agent",
        severity: "low",
        description: `\u300C${member.name}\u300D\u51E0\u4E4E\u672A\u88AB\u4F7F\u7528\uFF08${count} \u6B21\uFF0C\u5360 ${Math.round(ratio * 100)}%\uFF09`,
        agentIds: [member.id],
        suggestion: "\u8003\u8651\u8C03\u6574\u8DEF\u7531\u5173\u952E\u8BCD\u3001\u4F18\u5316\u5176\u89D2\u8272\u5B9A\u4E49\u3001\u6216\u5408\u5E76\u5230\u5176\u4ED6 agent",
        autoApplicable: false
      });
    }
  }
  return insights;
}
function analyzeSuccessPatterns(events, project) {
  const insights = [];
  const agentStats = /* @__PURE__ */ new Map();
  for (const event of events) {
    if (!event.agentId || event.agentId === project.supervisorId) continue;
    let stats = agentStats.get(event.agentId);
    if (!stats) {
      stats = { total: 0, successes: 0 };
      agentStats.set(event.agentId, stats);
    }
    stats.total++;
    if (event.success !== false && event.outcome !== "failure" && event.outcome !== "timeout") {
      stats.successes++;
    }
  }
  for (const [agentId, stats] of agentStats) {
    if (stats.total < 5) continue;
    const successRate = stats.successes / stats.total;
    if (successRate >= 0.95) {
      const member = project.members.find((m) => m.id === agentId);
      if (!member) continue;
      insights.push({
        id: `success_${agentId}`,
        category: "success_pattern",
        severity: "low",
        description: `\u300C${member.name}\u300D\u8868\u73B0\u4F18\u79C0\uFF08\u6210\u529F\u7387 ${Math.round(successRate * 100)}%\uFF0C${stats.total} \u6B21\u8C03\u7528\uFF09`,
        agentIds: [agentId],
        suggestion: "\u53EF\u4EE5\u589E\u52A0\u6B64 agent \u7684\u8DEF\u7531\u6743\u91CD\uFF0C\u4F18\u5148\u5206\u914D\u66F4\u591A\u4EFB\u52A1",
        autoApplicable: true
      });
    }
  }
  return insights;
}
function buildRoutingPatterns(events, project) {
  const patterns = [];
  const patternStats = /* @__PURE__ */ new Map();
  for (const event of events) {
    if (!event.matchedPattern || !event.agentId) continue;
    if (event.agentId === project.supervisorId) continue;
    let agentMap = patternStats.get(event.matchedPattern);
    if (!agentMap) {
      agentMap = /* @__PURE__ */ new Map();
      patternStats.set(event.matchedPattern, agentMap);
    }
    let agentStat = agentMap.get(event.agentId);
    if (!agentStat) {
      agentStat = { success: 0, total: 0 };
      agentMap.set(event.agentId, agentStat);
    }
    agentStat.total++;
    if (event.success !== false && event.outcome !== "failure") {
      agentStat.success++;
    }
  }
  for (const [pattern, agentMap] of patternStats) {
    let bestAgent = "";
    let bestRate = 0;
    let bestTotal = 0;
    for (const [agentId, stats] of agentMap) {
      const rate = stats.total > 0 ? stats.success / stats.total : 0;
      if (rate > bestRate || rate === bestRate && stats.total > bestTotal) {
        bestAgent = agentId;
        bestRate = rate;
        bestTotal = stats.total;
      }
    }
    if (bestAgent && bestTotal >= 2) {
      patterns.push({
        trigger: pattern,
        agentId: bestAgent,
        confidence: bestRate,
        sampleSize: bestTotal
      });
    }
  }
  return patterns;
}
function buildSpecializations(events, healthMap, statsMap, project) {
  const specializations = [];
  for (const member of project.members) {
    if (member.id === project.supervisorId) continue;
    const memberEvents = events.filter((e) => e.agentId === member.id);
    if (memberEvents.length < 3) continue;
    const stats = statsMap.get(member.id);
    const health = healthMap.get(member.id);
    const taskTypeSuccess = /* @__PURE__ */ new Map();
    for (const event of memberEvents) {
      const taskType = event.taskType ?? "unknown";
      let entry = taskTypeSuccess.get(taskType);
      if (!entry) {
        entry = { success: 0, total: 0 };
        taskTypeSuccess.set(taskType, entry);
      }
      entry.total++;
      if (event.success !== false) entry.success++;
    }
    const strengths = [];
    for (const [taskType, data] of taskTypeSuccess) {
      if (data.total >= 2 && data.success / data.total >= 0.7) {
        strengths.push(taskType);
      }
    }
    const methodCounts = /* @__PURE__ */ new Map();
    for (const event of memberEvents) {
      if (event.method) {
        methodCounts.set(event.method, (methodCounts.get(event.method) ?? 0) + 1);
      }
    }
    const totalSuccesses = memberEvents.filter((e) => e.success !== false).length;
    const successRate = memberEvents.length > 0 ? totalSuccesses / memberEvents.length : 0;
    specializations.push({
      agentId: member.id,
      strengths,
      avgDurationMs: stats ? computeAverageDuration(stats) : 0,
      successRate,
      totalCalls: stats?.callCount ?? memberEvents.length
    });
  }
  return specializations;
}
function findBetterAlternative(failingAgentId, events, project) {
  const nonSupervisorMembers = project.members.filter(
    (m) => m.id !== project.supervisorId && m.id !== failingAgentId
  );
  const failingTaskTypes = /* @__PURE__ */ new Set();
  for (const e of events) {
    if (e.agentId === failingAgentId && e.taskType) {
      failingTaskTypes.add(e.taskType);
    }
  }
  let bestCandidate;
  for (const member of nonSupervisorMembers) {
    const memberEvents = events.filter((e) => e.agentId === member.id);
    if (memberEvents.length < 3) continue;
    if (failingTaskTypes.size > 0) {
      const candidateTaskTypes = new Set(
        memberEvents.filter((e) => e.taskType).map((e) => e.taskType)
      );
      const hasOverlap = Array.from(failingTaskTypes).some((t) => candidateTaskTypes.has(t));
      if (!hasOverlap) continue;
    }
    const successes = memberEvents.filter((e) => e.success !== false).length;
    const rate = successes / memberEvents.length;
    if (rate >= 0.8 && (!bestCandidate || rate > bestCandidate.rate)) {
      bestCandidate = { id: member.id, name: member.name, rate };
    }
  }
  return bestCandidate;
}
function applyAutoOptimizations(project, analysis) {
  const updated = { ...project, members: project.members.map((m) => ({ ...m })) };
  const changes = [];
  for (const pattern of analysis.routingPatterns) {
    if (pattern.confidence < 0.75 || pattern.sampleSize < 3) continue;
    const member = updated.members.find((m) => m.id === pattern.agentId);
    if (!member) continue;
    const keywords = member.keywords ?? [];
    const trigger = pattern.trigger.toLowerCase();
    if (!keywords.some((kw) => kw.toLowerCase() === trigger)) {
      member.keywords = [...keywords, trigger];
      changes.push(`\u4E3A\u300C${member.name}\u300D\u6DFB\u52A0\u8DEF\u7531\u5173\u952E\u8BCD\u300C${trigger}\u300D\uFF08\u5386\u53F2\u6210\u529F\u7387 ${Math.round(pattern.confidence * 100)}%, n=${pattern.sampleSize}\uFF09`);
    }
  }
  if (changes.length > 0) {
    updated.version += 1;
    updated.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  return { updatedProject: updated, appliedChanges: changes };
}
function generateLearningHints(analysis) {
  if (analysis.insights.length === 0 && analysis.specializations.length === 0) {
    return "";
  }
  const lines = [];
  const MAX_HINT_CHARS = 600;
  lines.push("<learning-hints>");
  if (analysis.specializations.length > 0) {
    lines.push("Member Performance:");
    for (const spec of analysis.specializations) {
      const strengthsStr = spec.strengths.length > 0 ? spec.strengths.join("/") : "general";
      lines.push(
        `  ${spec.agentId}: ${Math.round(spec.successRate * 100)}% success, avg ${Math.round(spec.avgDurationMs / 1e3)}s, ${strengthsStr}`
      );
    }
  }
  const highInsights = analysis.insights.filter((i) => i.severity === "high");
  if (highInsights.length > 0) {
    lines.push("Alerts:");
    for (const insight of highInsights.slice(0, 3)) {
      lines.push(`  - ${insight.description}`);
    }
  }
  if (analysis.routingPatterns.length > 0) {
    lines.push("Learned Patterns:");
    for (const pattern of analysis.routingPatterns.slice(0, 5)) {
      lines.push(
        `  "${pattern.trigger}" \u2192 ${pattern.agentId} (${Math.round(pattern.confidence * 100)}%, n=${pattern.sampleSize})`
      );
    }
  }
  lines.push("</learning-hints>");
  let result = lines.join("\n");
  if (result.length > MAX_HINT_CHARS) {
    result = result.slice(0, MAX_HINT_CHARS - 3) + "...";
  }
  return result;
}
function formatLearningReport(analysis) {
  const lines = [];
  lines.push(`\u{1F4CA} \u5B66\u4E60\u5206\u6790\u62A5\u544A`);
  lines.push(`  \u5206\u6790\u65F6\u95F4: ${analysis.analyzedAt}`);
  lines.push(`  \u4E8B\u4EF6\u6570\u91CF: ${analysis.eventCount}`);
  lines.push("");
  if (analysis.insights.length > 0) {
    lines.push("\u{1F4A1} \u6D1E\u5BDF:");
    for (const insight of analysis.insights) {
      const icon = insight.severity === "high" ? "\u{1F534}" : insight.severity === "medium" ? "\u{1F7E1}" : "\u{1F7E2}";
      lines.push(`  ${icon} ${insight.description}`);
      lines.push(`     \u5EFA\u8BAE: ${insight.suggestion}`);
    }
    lines.push("");
  }
  if (analysis.specializations.length > 0) {
    lines.push("\u{1F465} \u6210\u5458\u753B\u50CF:");
    for (const spec of analysis.specializations) {
      const strengths = spec.strengths.length > 0 ? spec.strengths.join("\u3001") : "\u901A\u7528";
      lines.push(
        `  ${spec.agentId}: \u6210\u529F\u7387 ${Math.round(spec.successRate * 100)}%, \u5E73\u5747 ${Math.round(spec.avgDurationMs / 1e3)}s, \u64C5\u957F ${strengths} (${spec.totalCalls} \u6B21\u8C03\u7528)`
      );
    }
    lines.push("");
  }
  if (analysis.routingPatterns.length > 0) {
    lines.push("\u{1F500} \u8DEF\u7531\u6A21\u5F0F:");
    for (const pattern of analysis.routingPatterns) {
      lines.push(
        `  "${pattern.trigger}" \u2192 ${pattern.agentId} (\u7F6E\u4FE1\u5EA6 ${Math.round(pattern.confidence * 100)}%, \u6837\u672C ${pattern.sampleSize})`
      );
    }
    lines.push("");
  }
  lines.push(`\u{1F4DD} \u6458\u8981: ${analysis.summary}`);
  return lines.join("\n");
}
function shouldTriggerLearning(eventsSinceLastCycle) {
  return eventsSinceLastCycle >= LEARNING_CYCLE_THRESHOLD;
}
export {
  LEARNING_CYCLE_THRESHOLD,
  analyzeLearningOpportunities,
  applyAutoOptimizations,
  formatLearningReport,
  generateLearningHints,
  shouldTriggerLearning
};
