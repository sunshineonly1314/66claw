/**
 * Deploy Bridge — Orchestrator → Agent Team
 *
 * Bridges the orchestrator's deploy output to the agent-team plugin.
 * When the orchestrator finishes deploying agents, this module creates
 * the corresponding Project entity with FULL capability binding:
 *
 *   Step 1: Read orchestrator plan + state
 *   Step 2: Build member info (with keywords, tool profile, model tier)
 *   Step 3: Create Project entity
 *   Step 4: Write Supervisor SOUL.md (MANDATORY — fails the deploy if it fails)
 *   Step 5: Write tool policy config for each agent
 *   Step 6: Populate routing keywords from blueprint
 *   Step 7: Generate structured deploy report
 *
 * Key design: does NOT modify the orchestrator extension at all.
 * Instead, reads orchestrator's plan files from disk and creates
 * a Project entity from the deployed agent information.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type {
  AgentDeployReport,
  CallGatewayFn,
  DeployStepReport,
  MemberInfo,
  Project,
  ProjectCoordinationConfig,
  ProjectDeployReport,
  ProjectMemoryConfig,
  ProjectVisibility,
  TeamConstraints,
} from "./types.js";
import { generateProjectId, sanitizeProjectId } from "./project-id.js";
import { saveProject } from "./state.js";
import { generateSupervisorSoul } from "./supervisor-soul.js";
import { extractKeywordsFromRole } from "./keyword-router.js";

// ── Orchestrator Plan Shape (read-only, minimal surface) ─────────────────

type OrchestratorPlanAgent = {
  id: string;
  name: string;
  role: string;
  emoji?: string;
  /** Tool recommendation from template or guided flow */
  tools?: {
    allow?: string[];
    deny?: string[];
    profile?: string;
    skills?: string[];
    mcpServers?: string[];
  };
  /** Model tier from template */
  modelTier?: string;
  /** Routing keywords from template */
  routingKeywords?: string[];
  /** When present, the orchestrator already wrote full config (tools, model, heartbeat, etc.) */
  inferredCapabilities?: Record<string, unknown>;
};

type OrchestratorPlan = {
  planId: string;
  teamName?: string;
  teamDescription: string;
  agents: OrchestratorPlanAgent[];
  templateId?: string;
  mode?: string;
};

type OrchestratorState = {
  planId: string;
  status: string;
  agents: Array<{
    agentId: string;
    blueprintId: string;
    status: string;
  }>;
};

// ── Public API ───────────────────────────────────────────────────────────

export type CreateFromPlanParams = {
  planId: string;
  name?: string;
  constraints?: TeamConstraints;
  orchestratorStateDir: string;
};

export type CreateFromPlanResult = {
  project: Project;
  report: ProjectDeployReport;
};

/**
 * Create a Project entity from an orchestrator deployment plan.
 *
 * Full 7-step deployment:
 *   1. Read plan + state, build deployed ID mapping
 *   2. Build member info with keywords, tool profile, model tier
 *   3. Create Project entity and save to disk
 *   4. Write Supervisor SOUL.md (mandatory)
 *   5. Write tool policy for each agent via config.patch
 *   6. Validate deployment
 *   7. Return structured deploy report
 */
export async function createProjectFromPlan(
  callGateway: CallGatewayFn,
  params: CreateFromPlanParams,
): Promise<CreateFromPlanResult> {
  const { planId, orchestratorStateDir } = params;

  // Prevent path traversal via planId (reuses projectId validation regex)
  sanitizeProjectId(planId);

  // ── Step 1: Read orchestrator plan + state ──

  const plan = await readOrchestratorPlan(orchestratorStateDir, planId);
  if (!plan) {
    throw new Error(`Orchestrator plan "${planId}" not found`);
  }

  const state = await readOrchestratorState(orchestratorStateDir, planId);
  if (!state || state.status !== "deployed") {
    throw new Error(
      `Orchestrator plan "${planId}" is not in deployed state (status: ${state?.status ?? "not found"})`,
    );
  }

  // Build deployed ID mapping: blueprintId → deployedAgentId
  // The orchestrator state stores blueprint IDs in agent.agentId (e.g. "topic-radar"),
  // but the actual deployed agent uses a namespaced ID (e.g. "orch-20260228-abc--topic-radar").
  // Always construct the namespaced ID from planId + blueprintId.
  const deployedIdMap = new Map<string, string>();
  for (const agent of state.agents) {
    if (agent.status === "ready") {
      const blueprintId = agent.blueprintId || agent.agentId;
      const deployedId = `${planId}--${blueprintId}`;
      deployedIdMap.set(blueprintId, deployedId);
    }
  }

  // ── Step 2: Build member info with full metadata ──

  const members: MemberInfo[] = [];
  const memberIds: string[] = [];
  const agentReports: AgentDeployReport[] = [];

  for (const bp of plan.agents) {
    const deployedId = deployedIdMap.get(bp.id);
    if (!deployedId) continue; // Skip failed agents

    // Extract or use provided routing keywords
    const keywords = bp.routingKeywords?.length
      ? bp.routingKeywords
      : extractKeywordsFromRole(bp.role);

    members.push({
      id: deployedId,
      name: bp.name,
      role: bp.role,
      emoji: bp.emoji,
      keywords,
      toolProfile: bp.tools?.profile,
      modelTier: bp.modelTier,
    });
    memberIds.push(deployedId);

    // Initialize agent deploy report
    agentReports.push({
      agentId: deployedId,
      name: bp.name,
      role: bp.role,
      emoji: bp.emoji,
      modelTier: bp.modelTier,
      toolProfile: bp.tools?.profile,
      steps: [],
    });
  }

  if (memberIds.length === 0) {
    throw new Error(`No successfully deployed agents found in plan "${planId}"`);
  }

  // ── Step 3: Auto-create independent Supervisor + create Project ──

  // Plan B: Auto-create an independent supervisor agent.
  // This preserves all worker agents' original personas (SOUL.md not overwritten).
  // The supervisor uses a cheap model and minimal tools — purely for routing/coordination.
  const supervisorId = `${planId}--supervisor`;

  try {
    await callGateway("agents.create", {
      name: `${plan.teamName ?? "Team"} Supervisor`,
      id: supervisorId,
      emoji: "🎯",
    });
  } catch (err) {
    // If the supervisor agent already exists (e.g. re-deploy), proceed
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("already exists")) {
      throw new Error(`Failed to create supervisor agent: ${msg}`);
    }
  }

  // Add supervisor to member lists (supervisor is always the first entry)
  const supervisorMember: MemberInfo = {
    id: supervisorId,
    name: `${plan.teamName ?? "Team"} Supervisor`,
    role: "Team coordinator and message router",
    emoji: "🎯",
    toolProfile: "minimal",
    modelTier: "cheap",
  };
  memberIds.unshift(supervisorId);
  members.unshift(supervisorMember);

  // Initialize supervisor deploy report
  agentReports.unshift({
    agentId: supervisorId,
    name: supervisorMember.name,
    role: supervisorMember.role,
    emoji: supervisorMember.emoji,
    modelTier: supervisorMember.modelTier,
    toolProfile: supervisorMember.toolProfile,
    steps: [],
  });

  const projectId = generateProjectId();
  const now = new Date().toISOString();

  const project: Project = {
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
    coordination: defaultCoordinationConfig(),
    visibility: defaultVisibility(),
    constraints: params.constraints,
    bindings: [],
    budget: { maxCostPerConversation: 5 },
    sourcePlanId: planId,
    templateId: plan.templateId,
  };

  await saveProject(project);

  // ── Step 4: Write Supervisor SOUL.md (MANDATORY) ──

  const supervisorReport = agentReports.find((r) => r.agentId === supervisorId);
  const nonSupervisorMembers = members.filter((m) => m.id !== supervisorId);
  const supervisorSoul = generateSupervisorSoul(project, nonSupervisorMembers);

  try {
    await callGateway("agents.files.set", {
      agentId: supervisorId,
      name: "SOUL.md",
      content: supervisorSoul,
    });
    supervisorReport?.steps.push({
      step: "soul",
      status: "ok",
      detail: "Supervisor SOUL.md written",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    supervisorReport?.steps.push({
      step: "soul",
      status: "fail",
      detail: `Supervisor SOUL.md write failed: ${msg}`,
    });
    // MANDATORY: SOUL.md is critical for supervisor function — fail the deploy
    project.status = "error";
    await saveProject(project);
    throw new Error(
      `Failed to write supervisor SOUL.md for ${supervisorId}: ${msg}`,
    );
  }

  // ── Step 4b: Write Supervisor auxiliary files + config patch ──

  // AGENTS.md — supervisor-specific guidelines
  const supervisorAgentsMd = generateSupervisorAgentsMd(project, nonSupervisorMembers);
  try {
    await callGateway("agents.files.set", {
      agentId: supervisorId,
      name: "AGENTS.md",
      content: supervisorAgentsMd,
    });
  } catch {
    // Non-critical: supervisor can still function without AGENTS.md
  }

  // TOOLS.md — sessions tools only
  const supervisorToolsMd = [
    `# TOOLS.md — ${supervisorMember.name}`,
    ``,
    `> 你的核心工具是团队通信和协调。`,
    ``,
    `## 可用工具`,
    ``,
    `- **sessions_send** — 向团队成员发送消息或任务指令，并接收回复`,
    `- **sessions_list** — 查看当前活跃的会话列表`,
    `- **sessions_history** — 查看某个会话的历史消息`,
    `- **memory_share** — 将重要用户信息共享给团队成员`,
    `- **session_status** — 查看会话状态`,
    ``,
    `## 使用原则`,
    ``,
    `- 使用 sessions_send 时，message 应该是清晰的任务指令，而非原始用户消息`,
    `- 等待成员回复后再进行下一步操作`,
    `- 如果成员超时未响应，尝试其他成员或自行处理`,
  ].join("\n");
  try {
    await callGateway("agents.files.set", {
      agentId: supervisorId,
      name: "TOOLS.md",
      content: supervisorToolsMd,
    });
  } catch {
    // Non-critical
  }

  // BOOTSTRAP.md — no-op stub (supervisor has no startup tasks)
  try {
    await callGateway("agents.files.set", {
      agentId: supervisorId,
      name: "BOOTSTRAP.md",
      content: "# BOOTSTRAP\n\n> Supervisor agent — no startup tasks required.\n",
    });
  } catch {
    // Non-critical
  }

  // ── Step 5: Build unified config patch ──
  // Merges supervisor config, worker tool policies, and A2A settings
  // into a SINGLE config.get + config.patch round-trip to avoid race conditions.

  let toolPoliciesWritten = 0;

  // 5a. Supervisor config entry
  const allAgentEntries: Array<{ id: string; tools: Record<string, unknown> }> = [
    {
      id: supervisorId,
      tools: {
        profile: "minimal",
        alsoAllow: ["group:sessions", "memory_share"],
      },
    },
  ];

  // 5b. Worker tool policies from blueprint recommendations
  for (const bp of plan.agents) {
    const deployedId = deployedIdMap.get(bp.id);
    if (!deployedId || !bp.tools) continue;

    if (bp.inferredCapabilities) {
      const report = agentReports.find((r) => r.agentId === deployedId);
      report?.steps.push({
        step: "tool-policy",
        status: "ok",
        detail: "Tool policy applied by orchestrator (inferred capabilities)",
      });
      toolPoliciesWritten++;
      continue;
    }

    const toolsCfg: Record<string, unknown> = {};
    if (bp.tools.profile) toolsCfg.profile = bp.tools.profile;
    if (bp.tools.allow?.length) toolsCfg.allow = bp.tools.allow;
    if (bp.tools.deny?.length) toolsCfg.deny = bp.tools.deny;

    if (Object.keys(toolsCfg).length > 0) {
      allAgentEntries.push({ id: deployedId, tools: toolsCfg });
      toolPoliciesWritten++;
    }
  }

  // 5c. Worker A2A communication: add sessions_send + memory_share to alsoAllow
  const workerIds = memberIds.filter((id) => id !== supervisorId);
  for (const id of workerIds) {
    // Check if already in the list from 5b
    const existing = allAgentEntries.find((e) => e.id === id);
    if (existing) {
      // Merge alsoAllow into existing entry
      const prev = (existing.tools.alsoAllow as string[] | undefined) ?? [];
      existing.tools.alsoAllow = [...new Set([...prev, "sessions_send", "memory_share"])];
    } else {
      allAgentEntries.push({
        id,
        tools: { alsoAllow: ["sessions_send", "memory_share"] },
      });
    }
  }

  // Single config.get + config.patch
  try {
    const snapshot = (await callGateway("config.get", {})) as
      | Record<string, unknown>
      | undefined;
    const baseHash = (snapshot as Record<string, unknown> | undefined)
      ?.hash as string | undefined;

    await callGateway("config.patch", {
      raw: JSON.stringify({
        tools: {
          agentToAgent: {
            enabled: true,
            allow: [`${planId}--*`],
          },
        },
        agents: { list: allAgentEntries },
      }),
      ...(baseHash ? { baseHash } : {}),
    });

    // Record success
    supervisorReport?.steps.push({
      step: "config",
      status: "ok",
      detail: "Supervisor config patch applied (minimal profile + sessions)",
    });
    for (const entry of allAgentEntries) {
      if (entry.id === supervisorId) continue;
      const report = agentReports.find((r) => r.agentId === entry.id);
      report?.steps.push({
        step: "tool-policy",
        status: "ok",
        detail: "Tool policy written to config",
      });
    }
    for (const report of agentReports) {
      report.steps.push({
        step: "a2a",
        status: "ok",
        detail: `A2A communication enabled (allow: ${planId}--*)`,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[agent-team] Failed to apply unified config patch: ${msg}`);
    supervisorReport?.steps.push({
      step: "config",
      status: "warn",
      detail: `Config patch failed: ${msg}`,
    });
    for (const entry of allAgentEntries) {
      if (entry.id === supervisorId) continue;
      const report = agentReports.find((r) => r.agentId === entry.id);
      report?.steps.push({
        step: "tool-policy",
        status: "warn",
        detail: `Tool policy write failed: ${msg}`,
      });
    }
    for (const report of agentReports) {
      report.steps.push({
        step: "a2a",
        status: "warn",
        detail: `A2A auto-config failed: ${msg}`,
      });
    }
  }

  // ── Step 6: Record keyword population status ──

  let keywordsPopulated = 0;
  for (const member of members) {
    const report = agentReports.find((r) => r.agentId === member.id);
    if (member.keywords && member.keywords.length > 0) {
      keywordsPopulated++;
      report?.steps.push({
        step: "keywords",
        status: "ok",
        detail: `${member.keywords.length} routing keywords set`,
      });
    } else {
      report?.steps.push({
        step: "keywords",
        status: "warn",
        detail: "No routing keywords — fast-path routing disabled for this agent",
      });
    }
  }

  // ── Step 7: Build deploy report ──

  const soulsWritten = agentReports.filter((r) =>
    r.steps.some((s) => s.step === "soul" && s.status === "ok"),
  ).length;

  const report: ProjectDeployReport = {
    projectId: project.projectId,
    projectName: project.name,
    agents: agentReports,
    summary: {
      totalAgents: agentReports.length,
      readyAgents: agentReports.filter(r => r.steps.every(s => s.status === "ok")).length,
      toolPoliciesWritten,
      keywordsPopulated,
      soulsWritten,
    },
  };

  return { project, report };
}

// ── Defaults ─────────────────────────────────────────────────────────────

function defaultMemoryConfig(): ProjectMemoryConfig {
  return {
    mode: "read-shared",
    sharedCategories: ["fact", "identity", "preference"],
  };
}

function defaultCoordinationConfig(): ProjectCoordinationConfig {
  return {
    supervisorStyle: "concierge",
    maxMembers: 8,
    hopLimit: 5,
    memberTimeoutSeconds: 30,
    supervisorFallbackEnabled: true,
  };
}

function defaultVisibility(): ProjectVisibility {
  return {
    mode: "team",
  };
}

// ── CJK-Safe Truncation ─────────────────────────────────────────────────

function truncateCJKSafe(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  const codePoints = Array.from(s);
  if (codePoints.length <= maxLen) return s;
  return codePoints.slice(0, maxLen).join("");
}

// ── Orchestrator File Readers ────────────────────────────────────────────

async function readOrchestratorPlan(
  orchestratorStateDir: string,
  planId: string,
): Promise<OrchestratorPlan | null> {
  try {
    const filePath = path.join(orchestratorStateDir, "plans", `${planId}.json`);
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as OrchestratorPlan;
  } catch {
    return null;
  }
}

async function readOrchestratorState(
  orchestratorStateDir: string,
  planId: string,
): Promise<OrchestratorState | null> {
  try {
    const filePath = path.join(orchestratorStateDir, "states", `${planId}.json`);
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as OrchestratorState;
  } catch {
    return null;
  }
}

// ── Supervisor AGENTS.md Generator ──────────────────────────────────────

function generateSupervisorAgentsMd(
  project: Project,
  workerMembers: MemberInfo[],
): string {
  const lines: string[] = [
    `# AGENTS.md — ${project.name} Supervisor`,
    ``,
    `> 你是团队「${project.name}」的协调者。`,
    ``,
    `## 你的职责`,
    ``,
    `- 接收用户消息，判断应由哪个团队成员处理`,
    `- 对于跨领域任务，分解为子任务分发给多个成员`,
    `- 收集成员结果，合成最终回复交付给用户`,
    `- 监控成员响应状态，处理超时和错误`,
    ``,
    `## 团队成员`,
    ``,
  ];

  for (const m of workerMembers) {
    const emoji = m.emoji ? `${m.emoji} ` : "";
    lines.push(`- ${emoji}**${m.name}** (\`${m.id}\`): ${m.role}`);
  }

  lines.push(
    ``,
    `## 每次对话`,
    ``,
    `1. 读取 \`SOUL.md\` — 路由表、任务分解协议、结果收集协议`,
    `2. 读取 \`TOOLS.md\` — 你可用的通信工具`,
    `3. 判断用户意图，路由到正确的成员`,
    ``,
    `## 行为规范`,
    ``,
    `- 简单单领域请求：路由到 1 个成员，转发其回复`,
    `- 跨领域复杂请求：分解子任务，分发给多个成员，合成结果`,
    `- 不要自己回答专业问题，交给专业成员处理`,
    `- 不要暴露内部路由逻辑、agent ID 或团队结构给用户`,
  );

  return lines.join("\n");
}
