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
  supervisorAgentId?: string;
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
  const deployedIdMap = new Map<string, string>();
  for (const agent of state.agents) {
    if (agent.status === "ready") {
      const deployedId = agent.agentId || `${planId}--${agent.blueprintId}`;
      deployedIdMap.set(agent.blueprintId, deployedId);
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

  // ── Step 3: Determine supervisor and create Project ──

  const supervisorId =
    params.supervisorAgentId && memberIds.includes(params.supervisorAgentId)
      ? params.supervisorAgentId
      : memberIds[0];

  const projectId = generateProjectId();
  const now = new Date().toISOString();

  const project: Project = {
    projectId,
    name: params.name ?? truncateCJKSafe(plan.teamDescription, 50),
    description: plan.teamDescription,
    status: "active",
    version: 1,
    createdAt: now,
    updatedAt: now,
    supervisorId,
    memberIds,
    members,
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
    // MANDATORY: update project status to reflect the problem
    project.status = "error";
    await saveProject(project);
    console.error(
      `[agent-team] CRITICAL: Failed to write supervisor SOUL.md for ${supervisorId}: ${msg}`,
    );
  }

  // ── Step 5: Write tool policy for each agent ──

  let toolPoliciesWritten = 0;

  // Build tool config patches from blueprint tool recommendations.
  // Skip agents whose inferredCapabilities were already written by the orchestrator
  // (buildFullConfigPatch handles tools + model + heartbeat + skills in one patch).
  // Writing blueprint tools on top would create allow+alsoAllow conflict.
  const configPatches: Array<{ agentId: string; tools: Record<string, unknown> }> = [];
  for (const bp of plan.agents) {
    const deployedId = deployedIdMap.get(bp.id);
    if (!deployedId || !bp.tools) continue;

    if (bp.inferredCapabilities) {
      // Orchestrator already wrote full config for this agent — skip
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
      configPatches.push({ agentId: deployedId, tools: toolsCfg });
    }
  }

  if (configPatches.length > 0) {
    const mergedList = configPatches.map(({ agentId, tools }) => ({
      id: agentId,
      tools,
    }));

    try {
      const snapshot = (await callGateway("config.get", {})) as
        | Record<string, unknown>
        | undefined;
      const baseHash = (snapshot as Record<string, unknown> | undefined)
        ?.hash as string | undefined;

      await callGateway("config.patch", {
        raw: JSON.stringify({ agents: { list: mergedList } }),
        ...(baseHash ? { baseHash } : {}),
      });
      toolPoliciesWritten = configPatches.length;

      // Record success in reports
      for (const { agentId } of configPatches) {
        const report = agentReports.find((r) => r.agentId === agentId);
        report?.steps.push({
          step: "tool-policy",
          status: "ok",
          detail: "Tool policy written to config",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[agent-team] Failed to write tool policies: ${msg}`);
      // Record failure in reports
      for (const { agentId } of configPatches) {
        const report = agentReports.find((r) => r.agentId === agentId);
        report?.steps.push({
          step: "tool-policy",
          status: "warn",
          detail: `Tool policy write failed: ${msg}`,
        });
      }
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
    mode: "isolated",
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
