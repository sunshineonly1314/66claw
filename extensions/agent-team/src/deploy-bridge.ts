/**
 * Deploy Bridge — Orchestrator → Agent Team
 *
 * Bridges the orchestrator's deploy output to the agent-team plugin.
 * When the orchestrator finishes deploying agents, this module creates
 * the corresponding Project entity.
 *
 * Key design: does NOT modify the orchestrator extension at all.
 * Instead, reads orchestrator's plan files from disk and creates
 * a Project entity from the deployed agent information.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type {
  CallGatewayFn,
  MemberInfo,
  Project,
  ProjectCoordinationConfig,
  ProjectMemoryConfig,
  ProjectVisibility,
  TeamConstraints,
} from "./types.js";
import { generateProjectId, sanitizeProjectId } from "./project-id.js";
import { saveProject } from "./state.js";
import { generateSupervisorSoul } from "./supervisor-soul.js";

// ── Orchestrator Plan Shape (read-only, minimal surface) ─────────────────

type OrchestratorPlanAgent = {
  id: string;
  name: string;
  role: string;
  emoji?: string;
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

/**
 * Create a Project entity from an orchestrator deployment plan.
 *
 * Reads the orchestrator's plan + state files from disk, extracts deployed
 * agent information, and creates a Project with smart defaults.
 */
export async function createProjectFromPlan(
  callGateway: CallGatewayFn,
  params: CreateFromPlanParams,
): Promise<Project> {
  const { planId, orchestratorStateDir } = params;

  // Prevent path traversal via planId (reuses projectId validation regex)
  sanitizeProjectId(planId);

  // 1. Read orchestrator plan
  const plan = await readOrchestratorPlan(orchestratorStateDir, planId);
  if (!plan) {
    throw new Error(`Orchestrator plan "${planId}" not found`);
  }

  // 2. Read orchestrator state to get deployed agent IDs
  const state = await readOrchestratorState(orchestratorStateDir, planId);
  if (!state || state.status !== "deployed") {
    throw new Error(
      `Orchestrator plan "${planId}" is not in deployed state (status: ${state?.status ?? "not found"})`,
    );
  }

  // 3. Build deployed ID mapping: blueprintId → deployedAgentId
  const deployedIdMap = new Map<string, string>();
  for (const agent of state.agents) {
    if (agent.status === "ready") {
      // Deployed ID uses orchestrator's namespacing: {planId}--{blueprintId}
      // (planId already includes the "orch-" prefix, e.g. "orch-20260226-6dfb6d00")
      const deployedId = `${planId}--${agent.blueprintId}`;
      deployedIdMap.set(agent.blueprintId, deployedId);
    }
  }

  // 4. Build member info list
  const members: MemberInfo[] = [];
  const memberIds: string[] = [];
  for (const bp of plan.agents) {
    const deployedId = deployedIdMap.get(bp.id);
    if (!deployedId) continue; // Skip failed agents
    members.push({
      id: deployedId,
      name: bp.name,
      role: bp.role,
      emoji: bp.emoji,
    });
    memberIds.push(deployedId);
  }

  if (memberIds.length === 0) {
    throw new Error(`No successfully deployed agents found in plan "${planId}"`);
  }

  // 5. Determine supervisor
  const supervisorId =
    params.supervisorAgentId && memberIds.includes(params.supervisorAgentId)
      ? params.supervisorAgentId
      : memberIds[0]; // Default: first agent is supervisor

  // 6. Create Project
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

  // 7. Save to disk
  await saveProject(project);

  // 8. Write supervisor SOUL.md
  const nonSupervisorMembers = members.filter((m) => m.id !== supervisorId);
  const supervisorSoul = generateSupervisorSoul(project, nonSupervisorMembers);
  try {
    await callGateway("agents.files.set", {
      agentId: supervisorId,
      name: "SOUL.md",
      content: supervisorSoul,
    });
  } catch (err) {
    // Non-fatal: supervisor will work without team SOUL, just less effectively
    console.error(
      `[agent-team] Failed to write supervisor SOUL.md: ${err}`,
    );
  }

  return project;
}

// ── Defaults ─────────────────────────────────────────────────────────────

function defaultMemoryConfig(): ProjectMemoryConfig {
  return {
    mode: "isolated", // Phase 1: no sharing. Phase 3 adds "read-shared".
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

/**
 * Truncate a string to maxLen characters without cutting multi-byte
 * CJK characters (surrogate pairs) in half.
 */
function truncateCJKSafe(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  // Use Array.from to split by code points (not UTF-16 code units)
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
