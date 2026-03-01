import { computeAverageDuration } from "./member-stats.js";
const LEARNING_HINTS_START = "<learning-hints>";
const LEARNING_HINTS_END = "</learning-hints>";
const MAX_PROFILE_CHARS = 800;
function buildMemberPerformanceProfile(project, statsMap, healthMap, specializations) {
  const nonSupervisor = project.members.filter((m) => m.id !== project.supervisorId);
  if (nonSupervisor.length === 0) return "";
  const profiles = [];
  let hasData = false;
  for (const member of nonSupervisor) {
    const stats = statsMap.get(member.id);
    const health = healthMap.get(member.id);
    const spec = specializations?.find((s) => s.agentId === member.id);
    if (!stats || stats.callCount === 0) {
      profiles.push({
        agentId: member.id,
        name: member.name,
        successRate: "-",
        avgDuration: "-",
        health: health?.state ?? "unknown",
        notes: "\u6682\u65E0\u6570\u636E"
      });
      continue;
    }
    hasData = true;
    const avgMs = computeAverageDuration(stats);
    const successRate = spec ? `${Math.round(spec.successRate * 100)}%` : health ? `${Math.round(health.totalSuccesses / (health.totalSuccesses + health.totalFailures || 1) * 100)}%` : "-";
    const notes = [];
    if (spec?.strengths && spec.strengths.length > 0) {
      notes.push(`\u64C5\u957F${spec.strengths.join("\u3001")}`);
    }
    if (health?.state === "degraded") notes.push("\u8FD1\u671F\u6709\u5931\u8D25");
    if (health?.state === "down") notes.push("\u5F53\u524D\u4E0D\u53EF\u7528");
    if (avgMs > 1e4) notes.push("\u54CD\u5E94\u8F83\u6162");
    profiles.push({
      agentId: member.id,
      name: member.name,
      successRate,
      avgDuration: avgMs > 0 ? `${(avgMs / 1e3).toFixed(1)}s` : "-",
      health: health?.state ?? "healthy",
      notes: notes.join("\uFF0C") || "\u6B63\u5E38"
    });
  }
  if (!hasData) return "";
  const lines = [];
  lines.push("## Live Member Stats\n");
  for (const profile of profiles) {
    lines.push(
      `- ${profile.name}: ${profile.successRate} success, avg ${profile.avgDuration}, ${profile.notes}`
    );
  }
  let result = lines.join("\n");
  if (result.length > MAX_PROFILE_CHARS) {
    result = result.slice(0, MAX_PROFILE_CHARS - 3) + "...";
  }
  return result;
}
function appendLearningHintsToSoul(existingSoul, hints) {
  if (!hints || hints.trim().length === 0) return existingSoul;
  const startIdx = existingSoul.indexOf(LEARNING_HINTS_START);
  const endIdx = existingSoul.indexOf(LEARNING_HINTS_END);
  if (startIdx >= 0 && endIdx >= 0 && endIdx > startIdx) {
    return existingSoul.slice(0, startIdx) + hints + existingSoul.slice(endIdx + LEARNING_HINTS_END.length);
  }
  const qualityGatesIdx = existingSoul.indexOf("## Quality Gates");
  if (qualityGatesIdx > 0) {
    const afterQG = existingSoul.indexOf("\n## ", qualityGatesIdx + 1);
    if (afterQG > 0) {
      return existingSoul.slice(0, afterQG) + "\n\n" + hints + existingSoul.slice(afterQG);
    }
  }
  const operatingRulesIdx = existingSoul.indexOf("## Operating Rules");
  if (operatingRulesIdx > 0) {
    return existingSoul.slice(0, operatingRulesIdx) + hints + "\n\n" + existingSoul.slice(operatingRulesIdx);
  }
  return existingSoul + "\n\n" + hints;
}
function removeLearningHintsFromSoul(existingSoul) {
  const startIdx = existingSoul.indexOf(LEARNING_HINTS_START);
  const endIdx = existingSoul.indexOf(LEARNING_HINTS_END);
  if (startIdx >= 0 && endIdx >= 0 && endIdx > startIdx) {
    const before = existingSoul.slice(0, startIdx).trimEnd();
    const after = existingSoul.slice(endIdx + LEARNING_HINTS_END.length).trimStart();
    return before + (after ? "\n\n" + after : "");
  }
  return existingSoul;
}
function buildSupervisorLearningContext(project, analysis, statsMap, healthMap) {
  const parts = [];
  const profileSection = buildMemberPerformanceProfile(
    project,
    statsMap,
    healthMap,
    analysis?.specializations
  );
  if (profileSection) {
    parts.push(profileSection);
  }
  if (analysis && analysis.insights.length > 0) {
    const highAlerts = analysis.insights.filter((i) => i.severity === "high");
    if (highAlerts.length > 0) {
      const alertLines = ["[Team Alerts]"];
      for (const alert of highAlerts.slice(0, 3)) {
        alertLines.push(`- ${alert.description}`);
      }
      parts.push(alertLines.join("\n"));
    }
  }
  if (analysis && analysis.routingPatterns.length > 0) {
    const patternLines = ["[Learned Routing]"];
    for (const p of analysis.routingPatterns.slice(0, 5)) {
      if (p.confidence >= 0.8 && p.sampleSize >= 3) {
        patternLines.push(`- "${p.trigger}" \u2192 ${p.agentId} (${Math.round(p.confidence * 100)}%)`);
      }
    }
    if (patternLines.length > 1) {
      parts.push(patternLines.join("\n"));
    }
  }
  return parts.join("\n\n");
}
export {
  appendLearningHintsToSoul,
  buildMemberPerformanceProfile,
  buildSupervisorLearningContext,
  removeLearningHintsFromSoul
};
