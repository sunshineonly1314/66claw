import fs from "node:fs/promises";
import path from "node:path";
import { generateProjectId, sanitizeProjectId } from "./project-id.js";
import { saveProject } from "./state.js";
import { generateSupervisorSoul } from "./supervisor-soul.js";
import { extractKeywordsFromRole } from "./keyword-router.js";
const SUPERVISOR_MODEL_PRIORITY = [
  "anthropic/claude-opus-4-6",
  "openai/o3",
  "anthropic/claude-sonnet-4-5",
  "openai/gpt-4o",
  "deepseek/deepseek-reasoner",
  "zhipu/glm-5",
  "qwen/qwen-max",
  "deepseek/deepseek-chat"
];
function selectSupervisorModel(plan) {
  for (const bp of plan.agents) {
    const caps = bp.inferredCapabilities;
    const model = caps?.model;
    const isSup = /supervisor|分发|路由|调度|协调|管理|总管/i.test(bp.role) || /supervisor/i.test(bp.id);
    if (isSup && model) {
      const primary = typeof model === "string" ? model : model?.primary;
      if (primary) return primary;
    }
  }
  const usedProviders = /* @__PURE__ */ new Set();
  for (const bp of plan.agents) {
    const caps = bp.inferredCapabilities;
    const model = caps?.model;
    const primary = typeof model === "string" ? model : model?.primary;
    if (primary && primary.includes("/")) {
      usedProviders.add(primary.split("/")[0]);
    }
  }
  if (usedProviders.size > 0) {
    for (const candidate of SUPERVISOR_MODEL_PRIORITY) {
      const provider = candidate.split("/")[0];
      if (usedProviders.has(provider)) return candidate;
    }
  }
  return SUPERVISOR_MODEL_PRIORITY[0];
}
async function createProjectFromPlan(callGateway, params) {
  const { planId, orchestratorStateDir } = params;
  sanitizeProjectId(planId);
  const plan = await readOrchestratorPlan(orchestratorStateDir, planId);
  if (!plan) {
    throw new Error(`Orchestrator plan "${planId}" not found`);
  }
  const state = await readOrchestratorState(orchestratorStateDir, planId);
  if (!state || state.status !== "deployed") {
    throw new Error(
      `Orchestrator plan "${planId}" is not in deployed state (status: ${state?.status ?? "not found"})`
    );
  }
  const deployedIdMap = /* @__PURE__ */ new Map();
  for (const agent of state.agents) {
    if (agent.status === "ready") {
      const blueprintId = agent.blueprintId || agent.agentId;
      const deployedId = `${planId}--${blueprintId}`;
      deployedIdMap.set(blueprintId, deployedId);
    }
  }
  const members = [];
  const memberIds = [];
  const agentReports = [];
  for (const bp of plan.agents) {
    const deployedId = deployedIdMap.get(bp.id);
    if (!deployedId) continue;
    const keywords = bp.routingKeywords?.length ? bp.routingKeywords : extractKeywordsFromRole(bp.role);
    members.push({
      id: deployedId,
      name: bp.name,
      role: bp.role,
      emoji: bp.emoji,
      keywords,
      toolProfile: bp.tools?.profile,
      modelTier: bp.modelTier
    });
    memberIds.push(deployedId);
    agentReports.push({
      agentId: deployedId,
      name: bp.name,
      role: bp.role,
      emoji: bp.emoji,
      modelTier: bp.modelTier,
      toolProfile: bp.tools?.profile,
      steps: []
    });
  }
  if (memberIds.length === 0) {
    throw new Error(`No successfully deployed agents found in plan "${planId}"`);
  }
  const supervisorId = `${planId}--supervisor`;
  try {
    await callGateway("agents.create", {
      name: `${plan.teamName ?? "Team"} Supervisor`,
      id: supervisorId,
      emoji: "\u{1F3AF}"
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("already exists")) {
      throw new Error(`Failed to create supervisor agent: ${msg}`);
    }
  }
  const supervisorMember = {
    id: supervisorId,
    name: `${plan.teamName ?? "Team"} Supervisor`,
    role: "Team coordinator and message router",
    emoji: "\u{1F3AF}",
    toolProfile: "minimal",
    modelTier: "sota"
  };
  memberIds.unshift(supervisorId);
  members.unshift(supervisorMember);
  agentReports.unshift({
    agentId: supervisorId,
    name: supervisorMember.name,
    role: supervisorMember.role,
    emoji: supervisorMember.emoji,
    modelTier: supervisorMember.modelTier,
    toolProfile: supervisorMember.toolProfile,
    steps: []
  });
  const projectId = generateProjectId();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const project = {
    projectId,
    name: params.name ?? plan.teamName ?? truncateCJKSafe(plan.teamDescription, 50),
    description: plan.teamDescription,
    status: "active",
    version: 1,
    createdAt: now,
    updatedAt: now,
    supervisorId,
    memberIds,
    members,
    autoSupervisor: true,
    memory: defaultMemoryConfig(),
    coordination: defaultCoordinationConfig(templateIdToCategory(plan.templateId)),
    visibility: defaultVisibility(),
    constraints: params.constraints,
    bindings: [],
    budget: { maxCostPerConversation: 5 },
    sourcePlanId: planId,
    templateId: plan.templateId
  };
  await saveProject(project);
  const supervisorReport = agentReports.find((r) => r.agentId === supervisorId);
  const nonSupervisorMembers = members.filter((m) => m.id !== supervisorId);
  const supervisorSoul = generateSupervisorSoul(project, nonSupervisorMembers);
  try {
    await callGateway("agents.files.set", {
      agentId: supervisorId,
      name: "SOUL.md",
      content: supervisorSoul
    });
    supervisorReport?.steps.push({
      step: "soul",
      status: "ok",
      detail: "Supervisor SOUL.md written"
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    supervisorReport?.steps.push({
      step: "soul",
      status: "fail",
      detail: `Supervisor SOUL.md write failed: ${msg}`
    });
    project.status = "error";
    await saveProject(project);
    throw new Error(
      `Failed to write supervisor SOUL.md for ${supervisorId}: ${msg}`
    );
  }
  const supervisorAgentsMd = generateSupervisorAgentsMd(project, nonSupervisorMembers);
  try {
    await callGateway("agents.files.set", {
      agentId: supervisorId,
      name: "AGENTS.md",
      content: supervisorAgentsMd
    });
  } catch {
  }
  const supervisorToolsMd = [
    `# TOOLS.md \u2014 ${supervisorMember.name}`,
    ``,
    `> \u4F60\u7684\u6838\u5FC3\u5DE5\u5177\u662F\u56E2\u961F\u901A\u4FE1\u548C\u534F\u8C03\u3002`,
    ``,
    `## \u53EF\u7528\u5DE5\u5177`,
    ``,
    `- **sessions_send** \u2014 \u5411\u56E2\u961F\u6210\u5458\u53D1\u9001\u6D88\u606F\u6216\u4EFB\u52A1\u6307\u4EE4\uFF0C\u5E76\u63A5\u6536\u56DE\u590D`,
    `- **sessions_list** \u2014 \u67E5\u770B\u5F53\u524D\u6D3B\u8DC3\u7684\u4F1A\u8BDD\u5217\u8868`,
    `- **sessions_history** \u2014 \u67E5\u770B\u67D0\u4E2A\u4F1A\u8BDD\u7684\u5386\u53F2\u6D88\u606F`,
    `- **memory_share** \u2014 \u5C06\u91CD\u8981\u7528\u6237\u4FE1\u606F\u5171\u4EAB\u7ED9\u56E2\u961F\u6210\u5458`,
    `- **session_status** \u2014 \u67E5\u770B\u4F1A\u8BDD\u72B6\u6001`,
    ``,
    `## \u4F7F\u7528\u539F\u5219`,
    ``,
    `- \u4F7F\u7528 sessions_send \u65F6\uFF0Cmessage \u5E94\u8BE5\u662F\u6E05\u6670\u7684\u4EFB\u52A1\u6307\u4EE4\uFF0C\u800C\u975E\u539F\u59CB\u7528\u6237\u6D88\u606F`,
    `- \u7B49\u5F85\u6210\u5458\u56DE\u590D\u540E\u518D\u8FDB\u884C\u4E0B\u4E00\u6B65\u64CD\u4F5C`,
    `- \u5982\u679C\u6210\u5458\u8D85\u65F6\u672A\u54CD\u5E94\uFF0C\u5C1D\u8BD5\u5176\u4ED6\u6210\u5458\u6216\u81EA\u884C\u5904\u7406`
  ].join("\n");
  try {
    await callGateway("agents.files.set", {
      agentId: supervisorId,
      name: "TOOLS.md",
      content: supervisorToolsMd
    });
  } catch {
  }
  try {
    await callGateway("agents.files.set", {
      agentId: supervisorId,
      name: "BOOTSTRAP.md",
      content: "# BOOTSTRAP\n\n> Supervisor agent \u2014 no startup tasks required.\n"
    });
  } catch {
  }
  let toolPoliciesWritten = 0;
  const supervisorModel = selectSupervisorModel(plan);
  const allAgentEntries = [
    {
      id: supervisorId,
      skills: [],
      // Supervisor is a pure router — no skills
      model: supervisorModel,
      tools: {
        profile: "minimal",
        alsoAllow: ["group:sessions", "memory_share"]
      }
    }
  ];
  for (const bp of plan.agents) {
    const deployedId = deployedIdMap.get(bp.id);
    if (!deployedId) continue;
    const toolsCfg = {};
    let skills = [];
    let workerModel;
    const caps = bp.inferredCapabilities;
    if (caps) {
      const capsTools = caps.tools;
      if (capsTools?.profile) toolsCfg.profile = capsTools.profile;
      if (Array.isArray(capsTools?.allow) && capsTools.allow.length) toolsCfg.allow = capsTools.allow;
      if (Array.isArray(capsTools?.alsoAllow) && capsTools.alsoAllow.length) toolsCfg.alsoAllow = capsTools.alsoAllow;
      if (Array.isArray(capsTools?.deny) && capsTools.deny.length) toolsCfg.deny = capsTools.deny;
      const capsSkills = caps.skills;
      if (Array.isArray(capsSkills) && capsSkills.length > 0) {
        skills = capsSkills;
      }
      const capsModel = caps.model;
      if (capsModel) workerModel = capsModel;
    } else {
      if (bp.tools?.profile) toolsCfg.profile = bp.tools.profile;
      if (bp.tools?.allow?.length) toolsCfg.allow = bp.tools.allow;
      if (bp.tools?.deny?.length) toolsCfg.deny = bp.tools.deny;
      skills = bp.tools?.skills?.length ? bp.tools.skills : [];
    }
    const entry = { id: deployedId, tools: toolsCfg, skills };
    if (workerModel) entry.model = workerModel;
    allAgentEntries.push(entry);
    toolPoliciesWritten++;
  }
  const workerIds = memberIds.filter((id) => id !== supervisorId);
  for (const id of workerIds) {
    const existing = allAgentEntries.find((e) => e.id === id);
    if (existing) {
      const prev = existing.tools.alsoAllow ?? [];
      existing.tools.alsoAllow = [.../* @__PURE__ */ new Set([...prev, "sessions_send", "memory_share"])];
    } else {
      allAgentEntries.push({
        id,
        skills: [],
        // Prevent loading all global skills
        tools: { alsoAllow: ["sessions_send", "memory_share"] }
      });
    }
  }
  try {
    const snapshot = await callGateway("config.get", {});
    const baseHash = snapshot?.hash;
    await callGateway("config.patch", {
      raw: JSON.stringify({
        tools: {
          agentToAgent: {
            enabled: true,
            allow: [`${planId}--*`]
          }
        },
        agents: { list: allAgentEntries }
      }),
      ...baseHash ? { baseHash } : {}
    });
    supervisorReport?.steps.push({
      step: "config",
      status: "ok",
      detail: "Supervisor config patch applied (minimal profile + sessions)"
    });
    for (const entry of allAgentEntries) {
      if (entry.id === supervisorId) continue;
      const report2 = agentReports.find((r) => r.agentId === entry.id);
      report2?.steps.push({
        step: "tool-policy",
        status: "ok",
        detail: "Tool policy written to config"
      });
    }
    for (const report2 of agentReports) {
      report2.steps.push({
        step: "a2a",
        status: "ok",
        detail: `A2A communication enabled (allow: ${planId}--*)`
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[agent-team] Failed to apply unified config patch: ${msg}`);
    supervisorReport?.steps.push({
      step: "config",
      status: "warn",
      detail: `Config patch failed: ${msg}`
    });
    for (const entry of allAgentEntries) {
      if (entry.id === supervisorId) continue;
      const report2 = agentReports.find((r) => r.agentId === entry.id);
      report2?.steps.push({
        step: "tool-policy",
        status: "warn",
        detail: `Tool policy write failed: ${msg}`
      });
    }
    for (const report2 of agentReports) {
      report2.steps.push({
        step: "a2a",
        status: "warn",
        detail: `A2A auto-config failed: ${msg}`
      });
    }
  }
  let keywordsPopulated = 0;
  for (const member of members) {
    const report2 = agentReports.find((r) => r.agentId === member.id);
    if (member.keywords && member.keywords.length > 0) {
      keywordsPopulated++;
      report2?.steps.push({
        step: "keywords",
        status: "ok",
        detail: `${member.keywords.length} routing keywords set`
      });
    } else {
      report2?.steps.push({
        step: "keywords",
        status: "warn",
        detail: "No routing keywords \u2014 fast-path routing disabled for this agent"
      });
    }
  }
  const soulsWritten = agentReports.filter(
    (r) => r.steps.some((s) => s.step === "soul" && s.status === "ok")
  ).length;
  const report = {
    projectId: project.projectId,
    projectName: project.name,
    agents: agentReports,
    summary: {
      totalAgents: agentReports.length,
      readyAgents: agentReports.filter((r) => r.steps.every((s) => s.status === "ok")).length,
      toolPoliciesWritten,
      keywordsPopulated,
      soulsWritten
    }
  };
  return { project, report };
}
function defaultMemoryConfig() {
  return {
    mode: "read-shared",
    sharedCategories: ["fact", "identity", "preference"]
  };
}
function templateIdToCategory(templateId) {
  if (!templateId) return void 0;
  const map = {
    "content-factory": "content",
    "knowledge-cs": "customer_support",
    "coding-team": "coding",
    "news-intelligence": "research",
    "data-analyst": "data_analysis",
    "meeting-assistant": "scheduling",
    "daily-assistant": "lifestyle",
    "finance-tracker": "finance",
    "learning-planner": "education"
  };
  return map[templateId];
}
function defaultCoordinationConfig(category) {
  let hopLimit = 8;
  let memberTimeoutSeconds = 45;
  let supervisorStyle = "concierge";
  switch (category) {
    case "coding":
    case "data_analysis":
      memberTimeoutSeconds = 120;
      break;
    case "education":
      memberTimeoutSeconds = 60;
      break;
    case "customer_support":
    case "scheduling":
      memberTimeoutSeconds = 45;
      break;
    default:
      memberTimeoutSeconds = 45;
      break;
  }
  if (category === "data_analysis") {
    supervisorStyle = "delegate-only";
  }
  return {
    supervisorStyle,
    maxMembers: 8,
    hopLimit,
    memberTimeoutSeconds,
    supervisorFallbackEnabled: true
  };
}
function defaultVisibility() {
  return {
    mode: "team"
  };
}
function truncateCJKSafe(s, maxLen) {
  if (s.length <= maxLen) return s;
  const codePoints = Array.from(s);
  if (codePoints.length <= maxLen) return s;
  return codePoints.slice(0, maxLen).join("");
}
async function readOrchestratorPlan(orchestratorStateDir, planId) {
  try {
    const filePath = path.join(orchestratorStateDir, "plans", `${planId}.json`);
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function readOrchestratorState(orchestratorStateDir, planId) {
  try {
    const filePath = path.join(orchestratorStateDir, "states", `${planId}.json`);
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function generateSupervisorAgentsMd(project, workerMembers) {
  const lines = [
    `# AGENTS.md \u2014 ${project.name} Supervisor`,
    ``,
    `> \u4F60\u662F\u56E2\u961F\u300C${project.name}\u300D\u7684\u534F\u8C03\u8005\u3002`,
    ``,
    `## \u4F60\u7684\u804C\u8D23`,
    ``,
    `- \u63A5\u6536\u7528\u6237\u6D88\u606F\uFF0C\u5224\u65AD\u5E94\u7531\u54EA\u4E2A\u56E2\u961F\u6210\u5458\u5904\u7406`,
    `- \u5BF9\u4E8E\u8DE8\u9886\u57DF\u4EFB\u52A1\uFF0C\u5206\u89E3\u4E3A\u5B50\u4EFB\u52A1\u5206\u53D1\u7ED9\u591A\u4E2A\u6210\u5458`,
    `- \u6536\u96C6\u6210\u5458\u7ED3\u679C\uFF0C\u5408\u6210\u6700\u7EC8\u56DE\u590D\u4EA4\u4ED8\u7ED9\u7528\u6237`,
    `- \u76D1\u63A7\u6210\u5458\u54CD\u5E94\u72B6\u6001\uFF0C\u5904\u7406\u8D85\u65F6\u548C\u9519\u8BEF`,
    ``,
    `## \u56E2\u961F\u6210\u5458`,
    ``
  ];
  for (const m of workerMembers) {
    const emoji = m.emoji ? `${m.emoji} ` : "";
    lines.push(`- ${emoji}**${m.name}** (\`${m.id}\`): ${m.role}`);
  }
  lines.push(
    ``,
    `## \u6BCF\u6B21\u5BF9\u8BDD`,
    ``,
    `1. \u8BFB\u53D6 \`SOUL.md\` \u2014 \u8DEF\u7531\u8868\u3001\u4EFB\u52A1\u5206\u89E3\u534F\u8BAE\u3001\u7ED3\u679C\u6536\u96C6\u534F\u8BAE`,
    `2. \u8BFB\u53D6 \`TOOLS.md\` \u2014 \u4F60\u53EF\u7528\u7684\u901A\u4FE1\u5DE5\u5177`,
    `3. \u5224\u65AD\u7528\u6237\u610F\u56FE\uFF0C\u8DEF\u7531\u5230\u6B63\u786E\u7684\u6210\u5458`,
    ``,
    `## \u884C\u4E3A\u89C4\u8303`,
    ``,
    `- \u7B80\u5355\u5355\u9886\u57DF\u8BF7\u6C42\uFF1A\u8DEF\u7531\u5230 1 \u4E2A\u6210\u5458\uFF0C\u8F6C\u53D1\u5176\u56DE\u590D`,
    `- \u8DE8\u9886\u57DF\u590D\u6742\u8BF7\u6C42\uFF1A\u5206\u89E3\u5B50\u4EFB\u52A1\uFF0C\u5206\u53D1\u7ED9\u591A\u4E2A\u6210\u5458\uFF0C\u5408\u6210\u7ED3\u679C`,
    `- \u4E0D\u8981\u81EA\u5DF1\u56DE\u7B54\u4E13\u4E1A\u95EE\u9898\uFF0C\u4EA4\u7ED9\u4E13\u4E1A\u6210\u5458\u5904\u7406`,
    `- \u4E0D\u8981\u66B4\u9732\u5185\u90E8\u8DEF\u7531\u903B\u8F91\u3001agent ID \u6216\u56E2\u961F\u7ED3\u6784\u7ED9\u7528\u6237`
  );
  return lines.join("\n");
}
export {
  createProjectFromPlan
};
