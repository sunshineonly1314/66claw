import { inferAgentCapabilities, estimateRoleComplexity } from "./capability-inference.js";
import { verifyScene } from "./scene-verifier.js";
import { recommendToolsForRole } from "../tool-recommend.js";
import { MAX_SKILLS_PER_AGENT, MAX_MCP_PER_AGENT } from "./runtime-discovery.js";
const MAX_ROUNDS = 3;
const OVERLAP_THRESHOLD = 0.6;
function executePlanningPipeline(params) {
  const { requirement, userCtx, pluginConfig, discovery } = params;
  let blueprints = [...params.blueprints];
  const rounds = [];
  let lastVerification;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const roundResult = {
      round,
      issues: [],
      actionsApplied: []
    };
    for (const bp of blueprints) {
      bp.inferredCapabilities = inferAgentCapabilities(bp, userCtx, pluginConfig, discovery);
      if (!bp.tools || !bp.tools.allow || bp.tools.allow.length === 0) {
        bp.tools = recommendToolsForRole(bp.role, bp.name);
      }
    }
    const verification = verifyScene({
      requirement,
      blueprints,
      userCtx,
      discovery
    });
    roundResult.verification = verification;
    lastVerification = verification;
    const structuralIssues = analyzeStructure(blueprints, userCtx, requirement);
    roundResult.issues.push(...structuralIssues);
    for (const check of verification.checks) {
      if (!check.pass) {
        roundResult.issues.push({
          severity: check.severity === "critical" ? "error" : "warning",
          category: checkNameToCategory(check.name),
          message: check.detail
        });
      }
    }
    for (const gap of verification.gaps) {
      roundResult.issues.push({
        severity: "warning",
        category: "coverage",
        message: gap.missingCapability,
        suggestion: gap.suggestion
      });
    }
    const criticalIssues = roundResult.issues.filter((i) => i.severity === "error");
    const actionableWarnings = roundResult.issues.filter(
      (i) => i.severity === "warning" && (i.category === "overlap" || i.category === "feasibility")
    );
    const needsRefine = criticalIssues.length > 0 || actionableWarnings.length > 0;
    if (!needsRefine) {
      rounds.push(roundResult);
      break;
    }
    if (round === MAX_ROUNDS) {
      if (criticalIssues.length > 0) {
        roundResult.issues.push({
          severity: "warning",
          category: "structure",
          message: `\u7ECF\u8FC7 ${MAX_ROUNDS} \u8F6E\u4F18\u5316\u4ECD\u6709 ${criticalIssues.length} \u4E2A\u4E25\u91CD\u95EE\u9898\u672A\u89E3\u51B3\uFF0C\u5EFA\u8BAE\u4EBA\u5DE5\u5BA1\u67E5`,
          suggestion: criticalIssues.map((i) => i.message).join("\uFF1B")
        });
      }
      rounds.push(roundResult);
      break;
    }
    const { refined, actions } = autoRefine(blueprints, roundResult.issues, verification.gaps, userCtx);
    blueprints = refined;
    roundResult.actionsApplied = actions;
    rounds.push(roundResult);
    if (actions.length === 0) break;
  }
  if (!lastVerification) {
    lastVerification = verifyScene({ requirement, blueprints, userCtx, discovery });
  }
  const coverageScore = computeCoverageScore(lastVerification);
  const feasibilityScore = computeFeasibilityScore(blueprints, discovery);
  const refinementSummary = formatRefinementSummary(rounds);
  return {
    blueprints,
    rounds,
    coverageScore,
    feasibilityScore,
    verification: lastVerification,
    totalRounds: rounds.length,
    refinementSummary
  };
}
function analyzeStructure(blueprints, userCtx, _requirement) {
  const issues = [];
  const overlaps = detectRoleOverlap(blueprints);
  for (const overlap of overlaps) {
    issues.push({
      severity: "warning",
      category: "overlap",
      message: `\u300C${overlap.agent1}\u300D\u548C\u300C${overlap.agent2}\u300D\u89D2\u8272\u9AD8\u5EA6\u91CD\u53E0\uFF08${Math.round(overlap.similarity * 100)}%\uFF09`,
      suggestion: `\u8003\u8651\u5408\u5E76\u4E3A\u4E00\u4E2A agent \u6216\u7EC6\u5316\u5404\u81EA\u804C\u8D23`
    });
  }
  if (blueprints.length > 8) {
    issues.push({
      severity: "warning",
      category: "structure",
      message: `\u56E2\u961F\u89C4\u6A21\u8FC7\u5927\uFF08${blueprints.length} \u4E2A\u6210\u5458\uFF09\uFF0C\u53EF\u80FD\u5BFC\u81F4 Supervisor \u8DEF\u7531\u56F0\u96BE`,
      suggestion: "\u5EFA\u8BAE\u63A7\u5236\u5728 5-7 \u4E2A\u6210\u5458\u4EE5\u5185"
    });
  }
  if (blueprints.length === 1 && userCtx.scenario !== "general") {
    issues.push({
      severity: "info",
      category: "structure",
      message: "\u53EA\u67091\u4E2A\u6210\u5458\uFF0C\u4E0D\u9700\u8981\u591A agent \u534F\u4F5C"
    });
  }
  for (const bp of blueprints) {
    const complexity = estimateRoleComplexity(bp.role);
    if (complexity === "complex" && bp.modelTier === "cheap") {
      issues.push({
        severity: "warning",
        category: "feasibility",
        message: `\u300C${bp.name}\u300D\u89D2\u8272\u590D\u6742\u5EA6\u9AD8\u4F46\u4F7F\u7528\u4E86\u4F4E\u7AEF\u6A21\u578B`,
        agentId: bp.id,
        suggestion: `\u5EFA\u8BAE\u5347\u7EA7\u5230 mid \u6216 sota \u6A21\u578B`
      });
    }
    if (complexity === "simple" && bp.modelTier === "sota") {
      issues.push({
        severity: "info",
        category: "feasibility",
        message: `\u300C${bp.name}\u300D\u89D2\u8272\u7B80\u5355\u4F46\u4F7F\u7528\u4E86\u9AD8\u7AEF\u6A21\u578B\uFF0C\u53EF\u964D\u7EA7\u8282\u7701\u6210\u672C`,
        agentId: bp.id,
        suggestion: `\u53EF\u4F7F\u7528 cheap \u6A21\u578B\u964D\u4F4E\u6210\u672C`
      });
    }
  }
  const idSet = /* @__PURE__ */ new Set();
  for (const bp of blueprints) {
    if (idSet.has(bp.id)) {
      issues.push({
        severity: "error",
        category: "structure",
        message: `\u91CD\u590D\u7684 agent ID: "${bp.id}"`,
        agentId: bp.id,
        suggestion: "\u6BCF\u4E2A agent \u5FC5\u987B\u6709\u552F\u4E00\u7684 ID"
      });
    }
    idSet.add(bp.id);
  }
  for (const bp of blueprints) {
    const skillCount = bp.inferredCapabilities?.skills?.length ?? 0;
    const mcpCount = bp.inferredCapabilities?.mcpHints?.length ?? 0;
    if (skillCount > MAX_SKILLS_PER_AGENT) {
      issues.push({
        severity: "error",
        category: "capability",
        message: `\u300C${bp.name}\u300D\u6280\u80FD\u6570\u91CF ${skillCount} \u8D85\u8FC7\u4E0A\u9650 ${MAX_SKILLS_PER_AGENT}`,
        agentId: bp.id
      });
    }
    if (mcpCount > MAX_MCP_PER_AGENT) {
      issues.push({
        severity: "error",
        category: "capability",
        message: `\u300C${bp.name}\u300DMCP \u670D\u52A1\u6570\u91CF ${mcpCount} \u8D85\u8FC7\u4E0A\u9650 ${MAX_MCP_PER_AGENT}`,
        agentId: bp.id
      });
    }
  }
  return issues;
}
function detectRoleOverlap(blueprints) {
  const results = [];
  for (let i = 0; i < blueprints.length; i++) {
    for (let j = i + 1; j < blueprints.length; j++) {
      const a = blueprints[i];
      const b = blueprints[j];
      const similarity = computeRoleSimilarity(a.role, b.role);
      if (similarity >= OVERLAP_THRESHOLD) {
        results.push({
          agent1: a.name,
          agent2: b.name,
          similarity
        });
      }
    }
  }
  return results;
}
function computeRoleSimilarity(role1, role2) {
  const words1 = extractSignificantWords(role1);
  const words2 = extractSignificantWords(role2);
  if (words1.length === 0 || words2.length === 0) return 0;
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const arr1 = Array.from(set1);
  const arr2 = Array.from(set2);
  let intersection = 0;
  for (const w of arr1) {
    if (set2.has(w)) {
      intersection++;
    }
  }
  let partialOverlap = 0;
  for (const w1 of arr1) {
    if (set2.has(w1)) continue;
    for (const w2 of arr2) {
      if (w1 === w2) continue;
      if (w1.length >= 2 && w2.includes(w1) || w2.length >= 2 && w1.includes(w2)) {
        partialOverlap += 0.5;
        break;
      }
    }
  }
  const effectiveIntersection = intersection + partialOverlap;
  const union = set1.size + set2.size - intersection;
  return union > 0 ? effectiveIntersection / union : 0;
}
function extractSignificantWords(text) {
  const lower = text.toLowerCase();
  const cjkSegments = lower.match(/[\u4e00-\u9fff]+/g) ?? [];
  const cjk = [];
  for (const seg of cjkSegments) {
    if (seg.length >= 2) {
      cjk.push(seg);
    }
    if (seg.length >= 4) {
      for (let i = 0; i < seg.length - 1; i++) {
        cjk.push(seg.slice(i, i + 2));
      }
    }
  }
  const latin = lower.match(/[a-z][a-z0-9]{2,}/g) ?? [];
  const stopWords = /* @__PURE__ */ new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "are",
    "was",
    "\u8D1F\u8D23",
    "\u8FDB\u884C",
    "\u5DE5\u4F5C",
    "\u5904\u7406",
    "\u7BA1\u7406",
    "\u76F8\u5173",
    "\u5305\u62EC",
    "agent",
    "\u52A9\u624B",
    "\u673A\u5668\u4EBA"
  ]);
  return Array.from(/* @__PURE__ */ new Set([...cjk, ...latin])).filter((w) => !stopWords.has(w));
}
function autoRefine(blueprints, issues, gaps, userCtx) {
  let refined = [...blueprints];
  const actions = [];
  for (const bp of refined) {
    const caps = bp.inferredCapabilities;
    if (!caps) continue;
    if (caps.skills.length > MAX_SKILLS_PER_AGENT) {
      const removed = caps.skills.length - MAX_SKILLS_PER_AGENT;
      caps.skills = caps.skills.slice(0, MAX_SKILLS_PER_AGENT);
      actions.push(`\u88C1\u526A\u300C${bp.name}\u300D\u6280\u80FD\u81F3 ${MAX_SKILLS_PER_AGENT} \u4E2A\uFF08\u79FB\u9664 ${removed} \u4E2A\u4F4E\u4F18\u5148\u7EA7\u6280\u80FD\uFF09`);
    }
    if (caps.mcpHints.length > MAX_MCP_PER_AGENT) {
      const removed = caps.mcpHints.length - MAX_MCP_PER_AGENT;
      caps.mcpHints = caps.mcpHints.slice(0, MAX_MCP_PER_AGENT);
      actions.push(`\u88C1\u526A\u300C${bp.name}\u300DMCP \u81F3 ${MAX_MCP_PER_AGENT} \u4E2A\uFF08\u79FB\u9664 ${removed} \u4E2A\uFF09`);
    }
  }
  for (const issue of issues) {
    if (issue.category === "feasibility" && issue.agentId && issue.severity === "warning") {
      const bp = refined.find((b) => b.id === issue.agentId);
      if (bp && estimateRoleComplexity(bp.role) === "complex" && bp.modelTier === "cheap") {
        bp.modelTier = "mid";
        actions.push(`\u5347\u7EA7\u300C${bp.name}\u300D\u6A21\u578B\u81F3 mid \u7EA7\u522B\uFF08\u89D2\u8272\u590D\u6742\u5EA6\u9AD8\uFF09`);
      }
    }
  }
  const overlaps = issues.filter((i) => i.category === "overlap" && i.severity === "warning");
  if (overlaps.length > 0 && refined.length > 5) {
    const overlapIssue = overlaps[0];
    const match = overlapIssue.message.match(/「(.+?)」和「(.+?)」/);
    if (match) {
      const [, name1, name2] = match;
      const idx2 = refined.findIndex((bp) => bp.name === name2);
      if (idx2 >= 0) {
        const bp1 = refined.find((bp) => bp.name === name1);
        if (bp1) {
          const bp2 = refined[idx2];
          const mergedSkills = /* @__PURE__ */ new Set([
            ...bp1.inferredCapabilities?.skills ?? [],
            ...bp2.inferredCapabilities?.skills ?? []
          ]);
          const mergedMCP = /* @__PURE__ */ new Set([
            ...bp1.inferredCapabilities?.mcpHints ?? [],
            ...bp2.inferredCapabilities?.mcpHints ?? []
          ]);
          const mergedSkillCount = mergedSkills.size;
          const mergedMCPCount = mergedMCP.size;
          if (mergedSkillCount <= MAX_SKILLS_PER_AGENT && mergedMCPCount <= MAX_MCP_PER_AGENT) {
            bp1.role = `${bp1.role}\uFF0C\u540C\u65F6${bp2.role}`;
            if (bp1.inferredCapabilities) {
              bp1.inferredCapabilities.skills = Array.from(mergedSkills);
              bp1.inferredCapabilities.mcpHints = Array.from(mergedMCP);
            }
            refined.splice(idx2, 1);
            actions.push(`\u5408\u5E76\u300C${name1}\u300D\u548C\u300C${name2}\u300D\u4E3A\u4E00\u4E2A agent\uFF08\u89D2\u8272\u9AD8\u5EA6\u91CD\u53E0\uFF09`);
          } else {
            actions.push(`\u8DF3\u8FC7\u5408\u5E76\u300C${name1}\u300D\u548C\u300C${name2}\u300D\uFF08\u5408\u5E76\u540E\u6280\u80FD/MCP \u6570\u91CF\u5C06\u8D85\u9650\uFF09`);
          }
        }
      }
    }
  }
  const seenIds = /* @__PURE__ */ new Set();
  const deduped = [];
  for (const bp of refined) {
    if (seenIds.has(bp.id)) {
      actions.push(`\u79FB\u9664\u91CD\u590D ID \u7684 agent\u300C${bp.name}\u300D(${bp.id})`);
      continue;
    }
    seenIds.add(bp.id);
    deduped.push(bp);
  }
  refined = deduped;
  return { refined, actions };
}
function computeCoverageScore(verification) {
  const coverageCheck = verification.checks.find((c) => c.name === "requirement_coverage");
  if (!coverageCheck) return verification.score;
  const match = coverageCheck.detail.match(/(\d+)%/);
  return match ? parseInt(match[1], 10) : verification.score;
}
function computeFeasibilityScore(blueprints, discovery) {
  if (!discovery) return 80;
  let totalCaps = 0;
  let availableCaps = 0;
  const installedSkills = new Set(discovery.skills.map((s) => s.name.toLowerCase()));
  const runningMCP = new Set(
    discovery.mcpServers.filter((s) => s.enabled && s.running).map((s) => s.id.toLowerCase())
  );
  for (const bp of blueprints) {
    const skills = bp.inferredCapabilities?.skills ?? [];
    const mcpHints = bp.inferredCapabilities?.mcpHints ?? [];
    totalCaps += skills.length + mcpHints.length;
    for (const skill of skills) {
      if (installedSkills.has(skill.toLowerCase())) availableCaps++;
    }
    for (const mcp of mcpHints) {
      if (runningMCP.has(mcp.toLowerCase())) availableCaps++;
    }
  }
  if (totalCaps === 0) return 100;
  return Math.round(availableCaps / totalCaps * 100);
}
function checkNameToCategory(name) {
  if (name.includes("skill") || name.includes("mcp")) return "capability";
  if (name.includes("coverage") || name.includes("resource")) return "coverage";
  if (name.includes("limits")) return "capability";
  if (name.includes("supervisor") || name.includes("channel")) return "structure";
  return "feasibility";
}
function formatRefinementSummary(rounds) {
  const allActions = rounds.flatMap((r) => r.actionsApplied);
  if (allActions.length === 0) {
    return "\u56E2\u961F\u914D\u7F6E\u4E00\u6B21\u901A\u8FC7\uFF0C\u65E0\u9700\u81EA\u52A8\u8C03\u6574\u3002";
  }
  const lines = ["\u81EA\u52A8\u4F18\u5316\u8BB0\u5F55:"];
  for (const round of rounds) {
    if (round.actionsApplied.length === 0) continue;
    lines.push(`  \u7B2C ${round.round} \u8F6E:`);
    for (const action of round.actionsApplied) {
      lines.push(`    - ${action}`);
    }
  }
  return lines.join("\n");
}
function formatPipelineReport(result) {
  const lines = [];
  lines.push(`\u{1F4CA} \u89C4\u5212\u8D28\u91CF\u8BC4\u4F30\uFF08${result.totalRounds} \u8F6E\u4F18\u5316\uFF09`);
  lines.push(`  \u9700\u6C42\u8986\u76D6\u7387: ${result.coverageScore}%`);
  lines.push(`  \u80FD\u529B\u53EF\u884C\u6027: ${result.feasibilityScore}%`);
  const allIssues = result.rounds.flatMap((r) => r.issues);
  const errors = allIssues.filter((i) => i.severity === "error").length;
  const warnings = allIssues.filter((i) => i.severity === "warning").length;
  if (errors > 0 || warnings > 0) {
    const parts = [];
    if (errors > 0) parts.push(`${errors} \u4E2A\u4E25\u91CD\u95EE\u9898`);
    if (warnings > 0) parts.push(`${warnings} \u4E2A\u63D0\u9192`);
    lines.push(`  \u53D1\u73B0\u95EE\u9898: ${parts.join("\u3001")}`);
  } else {
    lines.push("  \u68C0\u67E5\u7ED3\u679C: \u5168\u90E8\u901A\u8FC7");
  }
  if (result.refinementSummary !== "\u56E2\u961F\u914D\u7F6E\u4E00\u6B21\u901A\u8FC7\uFF0C\u65E0\u9700\u81EA\u52A8\u8C03\u6574\u3002") {
    lines.push("");
    lines.push(result.refinementSummary);
  }
  return lines.join("\n");
}
export {
  executePlanningPipeline,
  formatPipelineReport
};
