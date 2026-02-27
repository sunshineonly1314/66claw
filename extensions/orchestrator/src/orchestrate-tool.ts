/**
 * agents_orchestrate Tool
 *
 * The core LLM-callable tool for multi-agent orchestration.
 * Supports 10 actions:
 *   Legacy:  plan, confirm, deploy, status, rollback, templates
 *   Guided:  quick_deploy, guided_propose, guided_refine, guided_deploy
 *
 * Design:
 *   - The LLM generates agent blueprints (plan/guided_propose)
 *   - User confirms the plan (confirm/guided_refine)
 *   - System deploys via gateway agents.create API (deploy/guided_deploy/quick_deploy)
 *   - Status/rollback for monitoring
 *
 * This tool is registered as a plugin tool — it receives
 * OpenClawCNPluginToolContext at creation time.
 */

import { Type } from "@sinclair/typebox";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { OpenClawCNPluginToolContext } from "../../../src/plugins/types.js";
import type {
  AgentBlueprint,
  AgentDeployResult,
  DeployResult,
  OrchestrateAction,
  OrchestrationPlan,
  OrchestrationState,
  UserContext,
} from "./types.js";
import { checkModelEligibility } from "./model-gate.js";
import {
  formatTemplateList,
  getTemplate,
  listTemplates,
  matchTemplate,
} from "./templates.js";
import { estimateToolTokens, recommendToolsForRole } from "./tool-recommend.js";
import {
  createInitialState,
  generatePlanId,
  loadPlan,
  loadState,
  savePlan,
  saveState,
  updateAgentStatus,
} from "./state.js";
import { inferAgentCapabilities } from "./guided/capability-inference.js";
import { validateSoulStructure, buildSoulGenerationPrompt } from "./guided/soul-validator.js";
import { estimateTeamDailyCost, formatCostRange } from "./guided/cost-estimator.js";
import { generateUsageGuide } from "./guided/usage-guide.js";
import { emitDiagnosticEvent } from "../../../src/infra/diagnostic-events.js";

// ── Tool Schema ──────────────────────────────────────────────────────────

const ORCHESTRATE_ACTIONS = [
  "plan",
  "confirm",
  "deploy",
  "status",
  "rollback",
  "templates",
  "quick_deploy",
  "guided_propose",
  "guided_refine",
  "guided_deploy",
  "validate",
] as const;

const OrchestrateToolSchema = Type.Object({
  action: Type.Unsafe<(typeof ORCHESTRATE_ACTIONS)[number]>({
    type: "string",
    enum: [...ORCHESTRATE_ACTIONS],
  }),
  requirement: Type.Optional(Type.String()),
  templateId: Type.Optional(Type.String()),
  planId: Type.Optional(Type.String()),
  agentBlueprints: Type.Optional(Type.String()),
  teamDescription: Type.Optional(Type.String()),
  userContext: Type.Optional(Type.String()),
  refinements: Type.Optional(Type.String()),
  soulContents: Type.Optional(Type.String()),
});

// ── Tool Factory ─────────────────────────────────────────────────────────

export function createOrchestrateTool(
  ctx: OpenClawCNPluginToolContext,
  callGateway: CallGatewayFn,
) {
  return {
    label: "Orchestrator",
    name: "agents_orchestrate",
    description: [
      "Plan, deploy, and manage multi-agent teams.",
      "",
      "Actions:",
      '  "quick_deploy"     — One-click deploy from template. Params: requirement, templateId?',
      '  "guided_propose"   — Propose team from user context. Params: requirement, userContext (JSON), agentBlueprints (JSON)',
      '  "guided_refine"    — Refine plan with SOUL content. Params: planId, refinements? (JSON), soulContents? (JSON)',
      '  "guided_deploy"    — Deploy a guided plan. Params: planId',
      '  "templates"        — List available scene templates',
      '  "plan"             — Create plan from blueprints. Params: requirement, agentBlueprints (JSON), teamDescription',
      '  "confirm"          — Confirm a plan. Params: planId',
      '  "deploy"           — Deploy confirmed plan. Params: planId',
      '  "status"           — Check deployment status. Params: planId',
      '  "rollback"         — Delete agents from a plan. Params: planId',
      '  "validate"         — Dry-run validation before deploy. Params: planId',
      "",
      "Recommended workflow: quick_deploy (for templates) or guided_propose → guided_refine → guided_deploy",
    ].join("\n"),
    parameters: OrchestrateToolSchema,
    execute: async (_toolCallId: string, args: unknown): Promise<AgentToolResult<unknown>> => {
      const params = args as Record<string, unknown>;
      const action = String(params.action ?? "").trim() as OrchestrateAction;

      switch (action) {
        // ── New guided actions ──
        case "quick_deploy":
          return handleQuickDeploy(params, ctx, callGateway);
        case "guided_propose":
          return handleGuidedPropose(params, ctx);
        case "guided_refine":
          return handleGuidedRefine(params);
        case "guided_deploy":
          return handleGuidedDeploy(params, ctx, callGateway);
        // ── Legacy actions ──
        case "templates":
          return handleTemplates();
        case "plan":
          return handlePlan(params, ctx);
        case "confirm":
          return handleConfirm(params);
        case "deploy":
          return handleDeploy(params, ctx, callGateway);
        case "status":
          return handleStatus(params);
        case "rollback":
          return handleRollback(params, callGateway);
        case "validate":
          return handleValidate(params, callGateway);
        default:
          return textResult(
            `Unknown action: "${action}". Valid actions: ${ORCHESTRATE_ACTIONS.join(", ")}`,
          );
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW GUIDED ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

// ── quick_deploy ─────────────────────────────────────────────────────────

async function handleQuickDeploy(
  params: Record<string, unknown>,
  ctx: OpenClawCNPluginToolContext,
  callGateway: CallGatewayFn,
): Promise<AgentToolResult<unknown>> {
  const requirement = String(params.requirement ?? "").trim();
  const templateId = typeof params.templateId === "string" ? params.templateId.trim() : undefined;

  // 1. Match template
  const template = templateId ? getTemplate(templateId) : matchTemplate(requirement);
  if (!template) {
    return textResult(
      "没有找到匹配的模板。\n\n" +
      "你可以尝试引导式构建 —— 告诉我更多关于你的需求，我来帮你规划团队。\n" +
      '（调用 action="guided_propose" 开始引导式构建）',
    );
  }

  // 2. Deep clone blueprints
  const blueprints = deepCloneBlueprints(template.agents);

  // 3. Infer capabilities for each agent
  const defaultContext: UserContext = {
    scenario: template.category ?? "general",
    channels: [],
    resources: [],
    volume: "medium",
    budget: "balanced",
  };
  const pluginConfig = ctx.config as Record<string, unknown> | undefined;
  for (const bp of blueprints) {
    bp.inferredCapabilities = inferAgentCapabilities(bp, defaultContext, pluginConfig);
  }

  // 4. Create plan (merged plan+confirm+deploy)
  const planId = generatePlanId();
  const plan: OrchestrationPlan = {
    planId,
    createdAt: new Date().toISOString(),
    requirement,
    templateId: template.id,
    agents: blueprints,
    teamDescription: template.description,
    mode: "template",
    userContext: defaultContext,
  };
  await savePlan(plan);

  const state = createInitialState(plan);
  state.status = "deploying";
  state.deployStartedAt = new Date().toISOString();
  await saveState(state);

  // 5. Execute deploy
  const deployResult = await executeDeploySequence(plan, state, callGateway);

  // 6. Generate usage guide
  const usageGuide = generateUsageGuide(plan);
  plan.usageGuide = usageGuide;
  await savePlan(plan);

  // 7. Format user-facing result
  return textResult(formatQuickDeployResult(plan, deployResult, usageGuide));
}

// ── guided_propose ───────────────────────────────────────────────────────

async function handleGuidedPropose(
  params: Record<string, unknown>,
  ctx: OpenClawCNPluginToolContext,
): Promise<AgentToolResult<unknown>> {
  const requirement = String(params.requirement ?? "").trim();
  if (!requirement) {
    return textResult("需要提供 requirement 参数（用户的需求描述）。");
  }

  // 1. Parse userContext
  let userContext: UserContext;
  try {
    const raw = typeof params.userContext === "string" ? params.userContext : "{}";
    const parsed = JSON.parse(raw);
    userContext = {
      scenario: String(parsed.scenario ?? "general"),
      channels: Array.isArray(parsed.channels) ? parsed.channels : [],
      resources: Array.isArray(parsed.resources) ? parsed.resources : [],
      volume: parsed.volume ?? "medium",
      budget: parsed.budget ?? "balanced",
    };
  } catch {
    userContext = { scenario: "general", channels: [], resources: [], volume: "medium", budget: "balanced" };
  }

  // 2. Parse LLM-generated blueprints
  const blueprintsJson = typeof params.agentBlueprints === "string" ? params.agentBlueprints : undefined;
  let blueprints: AgentBlueprint[] = [];
  if (blueprintsJson) {
    try {
      const parsed = JSON.parse(blueprintsJson);
      if (!Array.isArray(parsed)) {
        return textResult("agentBlueprints 必须是 JSON 数组。");
      }
      blueprints = parsed.map(normalizeBlueprint);
    } catch (e) {
      return textResult(`解析 agentBlueprints 失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (blueprints.length === 0) {
    return textResult(
      "需要提供 agentBlueprints 参数（团队成员定义 JSON 数组）。\n\n" +
      "每个成员需要: name, id, role, modelTier (cheap/mid/sota), soul (可以为空字符串)",
    );
  }

  // 3. Validate
  const validationError = validateBlueprints(blueprints);
  if (validationError) return textResult(validationError);

  // 4. Infer capabilities
  const pluginConfig = ctx.config as Record<string, unknown> | undefined;
  for (const bp of blueprints) {
    bp.inferredCapabilities = inferAgentCapabilities(bp, userContext, pluginConfig);
    // Also fill basic tool recommendations if empty
    if (!bp.tools || !bp.tools.allow || bp.tools.allow.length === 0) {
      bp.tools = recommendToolsForRole(bp.role, bp.name);
    }
  }

  // 5. Save as draft
  const planId = generatePlanId();
  const plan: OrchestrationPlan = {
    planId,
    createdAt: new Date().toISOString(),
    requirement,
    agents: blueprints,
    teamDescription: requirement,
    mode: "guided",
    userContext,
    estimatedTokensPerTurn: blueprints.reduce(
      (sum, bp) => sum + estimateToolTokens(bp.tools), 0,
    ),
  };
  await savePlan(plan);

  const state = createInitialState(plan);
  state.status = "draft";
  await saveState(state);

  // 6. Format proposal for user (no technical details)
  return textResult(formatProposalForUser(plan));
}

// ── guided_refine ────────────────────────────────────────────────────────

async function handleGuidedRefine(
  params: Record<string, unknown>,
): Promise<AgentToolResult<unknown>> {
  const planId = String(params.planId ?? "").trim();
  if (!planId) return textResult("需要提供 planId 参数。");

  const plan = await loadPlan(planId);
  if (!plan) return textResult(`找不到方案 "${planId}"。`);

  const state = await loadState(planId);
  if (!state || (state.status !== "draft" && state.status !== "confirming")) {
    return textResult(
      `方案 "${planId}" 当前状态为 "${state?.status ?? "unknown"}"，无法修改。只有 draft 状态的方案可以修改。`,
    );
  }

  // 1. Handle structural adjustments
  if (typeof params.refinements === "string") {
    try {
      const refinements = JSON.parse(params.refinements);
      if (refinements.adjustments && Array.isArray(refinements.adjustments)) {
        applyAdjustments(plan, refinements.adjustments);
      }
    } catch (e) {
      return textResult(`解析 refinements 失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 2. Handle SOUL contents
  if (typeof params.soulContents === "string") {
    try {
      const soulMap: Record<string, string> = JSON.parse(params.soulContents);
      // OpenClawCN: limit total SOUL entries to prevent abuse
      const MAX_SOUL_ENTRIES = 20;
      const MAX_SOUL_LENGTH = 20_000; // 20K chars per agent SOUL
      if (Object.keys(soulMap).length > MAX_SOUL_ENTRIES) {
        return textResult(`SOUL 条目过多（最多 ${MAX_SOUL_ENTRIES} 个）。`);
      }
      for (const [agentId, soulContent] of Object.entries(soulMap)) {
        if (typeof soulContent !== "string") continue;
        // Length guard
        if (soulContent.length > MAX_SOUL_LENGTH) {
          return textResult(
            `"${agentId}" 的 SOUL 超过长度限制（${MAX_SOUL_LENGTH} 字符），当前 ${soulContent.length} 字符。请精简后重试。`,
          );
        }
        // Sanitize: strip control characters (except newline/tab) and null bytes
        const sanitized = soulContent.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
        const agent = plan.agents.find(a => a.id === agentId);
        if (!agent) {
          return textResult(`找不到 agent "${agentId}"。当前团队成员: ${plan.agents.map(a => a.id).join(", ")}`);
        }
        // Validate SOUL structure
        const validation = validateSoulStructure(sanitized);
        if (!validation.valid) {
          return textResult(
            `"${agent.name}" 的 SOUL 缺少必要章节：${validation.missing.join("、")}。\n` +
            "请补充后重试。SOUL 需要包含：角色定义、核心职责、行为准则、能力边界、协作指令。",
          );
        }
        agent.soul = sanitized;
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        return textResult(`解析 soulContents JSON 失败：${e.message}`);
      }
      // Re-throw validation errors (textResult returns)
      throw e;
    }
  }

  await savePlan(plan);

  // 3. Check completeness
  const agentsWithSoul = plan.agents.filter(a => a.soul && a.soul.length > 50);
  const agentsWithoutSoul = plan.agents.filter(a => !a.soul || a.soul.length <= 50);

  const lines: string[] = [
    `方案 "${planId}" 已更新。\n`,
    `团队成员 (${plan.agents.length}):`,
  ];

  for (const bp of plan.agents) {
    const hasSoul = bp.soul && bp.soul.length > 50;
    const status = hasSoul ? "[已完成]" : "[待编写]";
    lines.push(`  ${status} ${bp.name} (${bp.id}) — ${bp.role}`);
  }

  if (agentsWithoutSoul.length > 0) {
    lines.push("");
    lines.push(`还有 ${agentsWithoutSoul.length} 个成员需要编写 SOUL。`);
    // Provide SOUL generation prompt for remaining agents
    for (const bp of agentsWithoutSoul) {
      const teammates = plan.agents
        .filter(a => a.id !== bp.id)
        .map(a => ({ name: a.name, role: a.role }));
      lines.push("");
      lines.push(buildSoulGenerationPrompt(
        bp.name,
        bp.role,
        plan.userContext?.scenario ?? "general",
        teammates,
      ));
    }
  } else {
    lines.push("");
    lines.push("所有成员的工作指南已就绪。");
    lines.push(`\n确认后调用 agents_orchestrate action="guided_deploy" planId="${planId}" 进行部署。`);
  }

  return textResult(lines.join("\n"));
}

// ── guided_deploy ────────────────────────────────────────────────────────

async function handleGuidedDeploy(
  params: Record<string, unknown>,
  ctx: OpenClawCNPluginToolContext,
  callGateway: CallGatewayFn,
): Promise<AgentToolResult<unknown>> {
  const planId = String(params.planId ?? "").trim();
  if (!planId) return textResult("需要提供 planId 参数。");

  const plan = await loadPlan(planId);
  if (!plan) return textResult(`找不到方案 "${planId}"。`);

  let state = await loadState(planId);
  if (!state) return textResult("找不到方案状态。");

  // Allow deploy from draft or confirming
  if (state.status !== "draft" && state.status !== "confirming") {
    return textResult(
      `方案当前状态为 "${state.status}"，无法部署。需要 draft 或 confirming 状态。`,
    );
  }

  // Check all agents have SOUL
  const missingSoul = plan.agents.filter(a => !a.soul || a.soul.length <= 50);
  if (missingSoul.length > 0) {
    return textResult(
      `以下成员还没有 SOUL 工作指南: ${missingSoul.map(a => a.name).join("、")}。\n` +
      `请先调用 guided_refine 传入 soulContents。`,
    );
  }

  // Transition to deploying
  state = { ...state, status: "deploying", deployStartedAt: new Date().toISOString() };
  await saveState(state);

  // Execute deploy
  const deployResult = await executeDeploySequence(plan, state, callGateway);

  // Generate usage guide
  const usageGuide = generateUsageGuide(plan);
  plan.usageGuide = usageGuide;
  await savePlan(plan);

  return textResult(formatGuidedDeployResult(plan, deployResult, usageGuide));
}

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY ACTIONS (preserved for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════

function handleTemplates(): AgentToolResult<unknown> {
  const templates = listTemplates();
  const text = formatTemplateList(templates);
  return textResult(text);
}

async function handlePlan(
  params: Record<string, unknown>,
  ctx: OpenClawCNPluginToolContext,
): Promise<AgentToolResult<unknown>> {
  const requirement = String(params.requirement ?? "").trim();
  const templateId = typeof params.templateId === "string" ? params.templateId.trim() : undefined;
  const blueprintsJson = typeof params.agentBlueprints === "string" ? params.agentBlueprints : undefined;
  const teamDescription = typeof params.teamDescription === "string" ? params.teamDescription.trim() : "Multi-agent team";

  if (!requirement) {
    return textResult("Error: requirement is required for the plan action.");
  }

  // 1. Model gate check
  const currentModel = resolveCurrentModel(ctx);
  let modelWarning = "";
  if (currentModel) {
    const gate = checkModelEligibility(currentModel);
    if (!gate.eligible) {
      return textResult(
        `## Model Gate: Blocked\n\n${gate.reason}\n\n` +
        `**Suggested models:**\n${(gate.suggestions ?? []).map((s) => `- ${s}`).join("\n")}`,
      );
    }
    if (gate.reason) {
      modelWarning = `> **Note:** ${gate.reason}\n\n`;
    }
  }

  // 2. Try template match
  let matchedTemplate = templateId ? getTemplate(templateId) : undefined;
  if (!matchedTemplate) {
    matchedTemplate = matchTemplate(requirement);
  }

  // 3. Parse LLM-generated blueprints (if provided)
  let blueprints: AgentBlueprint[] = [];
  if (blueprintsJson) {
    try {
      const parsed = JSON.parse(blueprintsJson);
      if (!Array.isArray(parsed)) {
        return textResult("Error: agentBlueprints must be a JSON array.");
      }
      blueprints = parsed.map(normalizeBlueprint);
    } catch (e) {
      return textResult(`Error parsing agentBlueprints JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else if (matchedTemplate) {
    blueprints = deepCloneBlueprints(matchedTemplate.agents);
  } else {
    return textResult(
      "Error: No agentBlueprints provided and no template matched.\n\n" +
      "You need to generate agent blueprints. Call this tool with:\n" +
      "- agentBlueprints: a JSON array of agent definitions\n" +
      '- Each agent needs: name, id, role, soul (full SOUL.md content), emoji, modelTier ("cheap"|"mid"|"sota")\n\n' +
      "Or specify a templateId to use a pre-built template.",
    );
  }

  // 4. Enhance blueprints with tool recommendations
  for (const bp of blueprints) {
    if (!bp.tools || !bp.tools.allow || bp.tools.allow.length === 0) {
      bp.tools = recommendToolsForRole(bp.role, bp.name);
    }
  }

  // 5. Validate
  const validationError = validateBlueprints(blueprints);
  if (validationError) return textResult(validationError);

  // 6. Create plan
  const planId = generatePlanId();
  const plan: OrchestrationPlan = {
    planId,
    createdAt: new Date().toISOString(),
    requirement,
    templateId: matchedTemplate?.id,
    agents: blueprints,
    teamDescription,
    estimatedTokensPerTurn: blueprints.reduce(
      (sum, bp) => sum + estimateToolTokens(bp.tools),
      0,
    ),
    mode: "manual",
  };

  await savePlan(plan);

  // Create initial state (confirming)
  const state = createInitialState(plan);
  await saveState(state);

  // 7. Format plan summary for user confirmation
  return textResult(modelWarning + formatPlanSummary(plan, matchedTemplate?.id));
}

async function handleConfirm(
  params: Record<string, unknown>,
): Promise<AgentToolResult<unknown>> {
  const planId = String(params.planId ?? "").trim();
  if (!planId) {
    return textResult("Error: planId is required for the confirm action.");
  }

  const state = await loadState(planId);
  if (!state) {
    return textResult(`Error: Plan "${planId}" not found.`);
  }
  if (state.status !== "confirming") {
    return textResult(`Error: Plan "${planId}" is in status "${state.status}", expected "confirming".`);
  }

  // Transition to deploying-ready (but don't actually deploy yet)
  const confirmedState = {
    ...state,
    status: "deploying" as const,
    deployStartedAt: new Date().toISOString(),
  };
  await saveState(confirmedState);

  return textResult(
    `Plan "${planId}" confirmed. Ready for deployment.\n\n` +
    `Call agents_orchestrate with action="deploy" and planId="${planId}" to start creating agents.`,
  );
}

async function handleDeploy(
  params: Record<string, unknown>,
  ctx: OpenClawCNPluginToolContext,
  callGateway: CallGatewayFn,
): Promise<AgentToolResult<unknown>> {
  const planId = String(params.planId ?? "").trim();
  if (!planId) {
    return textResult("Error: planId is required for the deploy action.");
  }

  const plan = await loadPlan(planId);
  if (!plan) {
    return textResult(`Error: Plan "${planId}" not found.`);
  }

  const state = await loadState(planId);
  if (!state) {
    return textResult(`Error: State for plan "${planId}" not found.`);
  }
  if (state.status !== "deploying") {
    return textResult(
      `Error: Plan "${planId}" is in status "${state.status}". ` +
      `Must be "deploying" (call confirm first).`,
    );
  }

  const deployResult = await executeDeploySequence(plan, state, callGateway);

  // Format legacy-style result
  const finalState = await loadState(planId);
  const lines = deployResult.agents.map(a => {
    const bp = plan.agents.find(b => b.id === a.agentId);
    const emoji = bp?.emoji ?? "";
    const statusMark = a.status === "ready" ? "[OK]" : "[FAIL]";
    return `  ${statusMark} ${emoji} **${a.name}** (\`${a.agentId}\`) — ${a.status}${a.error ? `: ${a.error}` : ""}`;
  });

  return textResult(
    `## Deployment — ${finalState?.status ?? "unknown"}\n\n` +
    `Plan: \`${planId}\`\n\n` +
    `### Agent Status\n${lines.join("\n")}\n\n` +
    (finalState?.status === "deployed"
      ? "All agents are ready. You can now use sessions_spawn to assign tasks to them."
      : `Some agents failed. Use action="status" to check details, or action="rollback" to clean up.`),
  );
}

async function handleStatus(
  params: Record<string, unknown>,
): Promise<AgentToolResult<unknown>> {
  const planId = String(params.planId ?? "").trim();
  if (!planId) {
    return textResult("Error: planId is required for the status action.");
  }

  const plan = await loadPlan(planId);
  const state = await loadState(planId);

  if (!plan || !state) {
    return textResult(`Error: Plan "${planId}" not found.`);
  }

  const lines: string[] = [
    `## Orchestration Status: \`${planId}\`\n`,
    `- Overall: **${state.status}**`,
    `- Team: ${plan.teamDescription}`,
    `- Mode: ${plan.mode ?? "manual"}`,
    `- Created: ${plan.createdAt}`,
    state.deployStartedAt ? `- Deploy started: ${state.deployStartedAt}` : "",
    state.deployFinishedAt ? `- Deploy finished: ${state.deployFinishedAt}` : "",
    state.error ? `- Error: ${state.error}` : "",
    "",
    "### Agents",
  ];

  for (const agent of state.agents) {
    const bp = plan.agents.find((a) => a.id === agent.blueprintId);
    const statusMark =
      agent.status === "ready" ? "[OK]"
      : agent.status === "failed" ? "[FAIL]"
      : "[...]";
    lines.push(
      `${statusMark} **${bp?.name ?? agent.agentId}** — ${agent.status}${agent.error ? ` (${agent.error})` : ""}`,
    );
  }

  return textResult(lines.filter(Boolean).join("\n"));
}

// ── validate (S2-3: dry-run) ──────────────────────────────────────────────

async function handleValidate(
  params: Record<string, unknown>,
  callGateway: CallGatewayFn,
): Promise<AgentToolResult<unknown>> {
  const planId = String(params.planId ?? "").trim();
  if (!planId) {
    return textResult("Error: planId is required for the validate action.");
  }

  const plan = await loadPlan(planId);
  if (!plan) return textResult(`Error: Plan "${planId}" not found.`);

  const state = await loadState(planId);
  if (!state) return textResult(`Error: State for plan "${planId}" not found.`);

  const checks: Array<{ label: string; pass: boolean; detail?: string }> = [];

  // Check 1: Plan status allows deployment
  const validStatuses = new Set(["draft", "confirming", "deploying"]);
  const statusOk = validStatuses.has(state.status);
  checks.push({
    label: "Plan status",
    pass: statusOk,
    detail: statusOk ? state.status : `"${state.status}" is not deployable`,
  });

  // Check 2: Agent ID conflicts
  const conflicts = await detectConflicts(plan, callGateway);
  checks.push({
    label: "Agent ID conflicts",
    pass: conflicts.length === 0,
    detail: conflicts.length > 0 ? `Collisions: ${conflicts.join(", ")}` : "No conflicts",
  });

  // Check 3: All agents have SOUL content
  const missingSoul = plan.agents.filter(a => !a.soul || a.soul.length <= 50);
  checks.push({
    label: "SOUL content",
    pass: missingSoul.length === 0,
    detail: missingSoul.length > 0
      ? `Missing for: ${missingSoul.map(a => a.name).join(", ")}`
      : `All ${plan.agents.length} agents have SOUL`,
  });

  // Check 4: Blueprint validation
  const bpError = validateBlueprints(plan.agents);
  checks.push({
    label: "Blueprint validation",
    pass: bpError === null,
    detail: bpError ?? "Valid",
  });

  // Check 5: No active deploy in progress
  const deployActive = isDeployActive(planId);
  checks.push({
    label: "No active deploy",
    pass: !deployActive,
    detail: deployActive ? "Deploy already in progress" : "Clear",
  });

  // Check 6: Config patch can be built
  let patchOk = true;
  let patchDetail = "All patches buildable";
  for (const bp of plan.agents) {
    const did = deployAgentId(planId, bp.id);
    try {
      buildFullConfigPatch(bp, did);
    } catch (err) {
      patchOk = false;
      patchDetail = `Failed for ${bp.name}: ${err instanceof Error ? err.message : String(err)}`;
      break;
    }
  }
  checks.push({ label: "Config patch", pass: patchOk, detail: patchDetail });

  // Format results
  const allPass = checks.every(c => c.pass);
  const lines: string[] = [
    `## Deploy Validation: \`${planId}\`\n`,
    allPass ? "Result: PASS -- ready for deployment" : "Result: FAIL -- issues found\n",
  ];
  for (const c of checks) {
    const mark = c.pass ? "[OK]" : "[FAIL]";
    lines.push(`${mark} ${c.label}: ${c.detail ?? ""}`);
  }
  if (!allPass) {
    lines.push("\nFix the issues above before deploying.");
  }

  return textResult(lines.join("\n"));
}

async function handleRollback(
  params: Record<string, unknown>,
  callGateway: CallGatewayFn,
): Promise<AgentToolResult<unknown>> {
  const planId = String(params.planId ?? "").trim();
  if (!planId) {
    return textResult("Error: planId is required for the rollback action.");
  }

  const plan = await loadPlan(planId);
  let state = await loadState(planId);

  if (!plan || !state) {
    return textResult(`Error: Plan "${planId}" not found.`);
  }

  // S1-5: Cancel any in-progress deploy before rolling back
  const activeJob = activeDeployJobs.get(planId);
  if (activeJob) {
    activeJob.abort();
    // Give the deploy loop a moment to notice the cancellation
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  emitDiagnosticEvent({ type: "orchestrator.rollback", planId, phase: "start" });

  const results: string[] = [];
  const failures: string[] = [];
  let deletedCount = 0;

  for (const agent of state.agents) {
    // Only delete agents that were actually deployed (ready status)
    if (agent.status === "pending") continue;

    // S1-1: Use namespaced deployed ID
    const did = deployAgentId(planId, agent.blueprintId);

    try {
      await callGateway("agents.delete", {
        agentId: did,
        deleteFiles: true,
      });
      state = updateAgentStatus(state, agent.agentId, "pending");
      results.push(`  [DEL] **${agent.agentId}** (${did}) — deleted`);
      deletedCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // S1-6: Accumulate failures for reporting
      failures.push(`${agent.agentId}: ${msg}`);
      results.push(`  [ERR] **${agent.agentId}** — delete failed: ${msg}`);
    }
  }

  const rolledBackState = { ...state, status: "rolled_back" as const };
  await saveState(rolledBackState);

  // S2-4: Unregister from orchestrated agents registry
  unregisterOrchestratedAgents(planId);

  emitDiagnosticEvent({ type: "orchestrator.rollback", planId, phase: "complete", deletedCount, failedCount: failures.length });

  // S1-6: Clear failure report
  let report = `## Rollback Complete\n\nPlan: \`${planId}\`\n\n${results.join("\n")}`;
  if (failures.length > 0) {
    report += `\n\n**Warning:** ${failures.length} agent(s) failed to delete:\n${failures.map(f => `- ${f}`).join("\n")}`;
    report += `\nThese agents may need manual cleanup.`;
  }

  return textResult(report);
}

// ═══════════════════════════════════════════════════════════════════════════
// DEPLOY JOB TRACKING — prevents rollback/deploy race conditions
// ═══════════════════════════════════════════════════════════════════════════

/** Tracks in-progress deploy jobs so rollback can cancel them first. */
const activeDeployJobs = new Map<string, AbortController>();

/** Check if a deploy is currently running for this planId. */
export function isDeployActive(planId: string): boolean {
  return activeDeployJobs.has(planId);
}

// ═══════════════════════════════════════════════════════════════════════════
// ORCHESTRATED AGENT REGISTRY (S2-4) — in-memory registry of deployed agents
// ═══════════════════════════════════════════════════════════════════════════

export type OrchestratedAgentEntry = {
  deployedId: string;
  localId: string;
  planId: string;
  name: string;
  role: string;
  deployedAt: string;
};

/** In-memory registry of currently orchestrated agents. planId -> agent entries */
const orchestratedAgents = new Map<string, OrchestratedAgentEntry[]>();

/** Register agents as orchestrated after successful deploy. */
function registerOrchestratedAgents(plan: OrchestrationPlan, readyAgentIds: Set<string>): void {
  const entries: OrchestratedAgentEntry[] = [];
  const now = new Date().toISOString();
  for (const bp of plan.agents) {
    if (!readyAgentIds.has(bp.id)) continue;
    entries.push({
      deployedId: deployAgentId(plan.planId, bp.id),
      localId: bp.id,
      planId: plan.planId,
      name: bp.name,
      role: bp.role,
      deployedAt: now,
    });
  }
  if (entries.length > 0) {
    orchestratedAgents.set(plan.planId, entries);
  }
}

/** Unregister agents on rollback. */
function unregisterOrchestratedAgents(planId: string): void {
  orchestratedAgents.delete(planId);
}

/** List all currently orchestrated agents across all plans. */
export function listOrchestratedAgents(): OrchestratedAgentEntry[] {
  const all: OrchestratedAgentEntry[] = [];
  for (const entries of orchestratedAgents.values()) {
    all.push(...entries);
  }
  return all;
}

/** List orchestrated agents for a specific plan. */
export function listOrchestratedAgentsForPlan(planId: string): OrchestratedAgentEntry[] {
  return orchestratedAgents.get(planId) ?? [];
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENT ID NAMESPACE — prevents cross-plan collisions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a namespaced agent ID for deployment.
 * Uses first 12 chars of planId as team slug prefix.
 * e.g. "orch-20260226-fd44c363" + "--" + "bookkeeper" → "orch-20260226-fd44c363--bookkeeper"
 */
function deployAgentId(planId: string, localId: string): string {
  return `${planId}--${localId}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PRE-DEPLOY CONFLICT DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check for agent ID collisions with already-deployed agents.
 * Returns a list of conflicting deployed IDs, or empty if clean.
 */
async function detectConflicts(
  plan: OrchestrationPlan,
  callGateway: CallGatewayFn,
): Promise<string[]> {
  try {
    const existing = await callGateway("agents.list", {}) as
      Array<{ id?: string }> | undefined;
    if (!Array.isArray(existing)) return [];

    const existingIds = new Set(existing.map(a => a.id).filter(Boolean));
    const conflicts: string[] = [];
    for (const bp of plan.agents) {
      const did = deployAgentId(plan.planId, bp.id);
      if (existingIds.has(did)) {
        conflicts.push(did);
      }
    }
    return conflicts;
  } catch {
    // If agents.list fails, skip conflict check rather than block deploy
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED DEPLOY SEQUENCE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Execute the deployment sequence for all agents in a plan.
 *
 * Key improvements over the original:
 *   - Agent IDs are namespaced with planId prefix (S1-1)
 *   - Pre-deploy conflict detection (S1-2)
 *   - Compensation logic: failed step N rolls back steps 1..N-1 (S1-3)
 *   - Config patches merged into a single call (S1-4)
 *   - Deploy job tracking with AbortController for rollback interlock (S1-5)
 *   - Plan-level onAgentFail policy (S1-7)
 */
async function executeDeploySequence(
  plan: OrchestrationPlan,
  initialState: OrchestrationState,
  callGateway: CallGatewayFn,
): Promise<DeployResult> {
  // S1-5: Register this deploy job for interlock
  const abortCtrl = new AbortController();
  activeDeployJobs.set(plan.planId, abortCtrl);

  try {
    return await executeDeploySequenceInner(plan, initialState, callGateway, abortCtrl.signal);
  } finally {
    activeDeployJobs.delete(plan.planId);
  }
}

async function executeDeploySequenceInner(
  plan: OrchestrationPlan,
  initialState: OrchestrationState,
  callGateway: CallGatewayFn,
  signal: AbortSignal,
): Promise<DeployResult> {
  let state = initialState;
  const results: AgentDeployResult[] = [];
  const deployed = new Set<string>();
  const agentQueue = [...plan.agents];
  let maxIterations = agentQueue.length * 2;

  // S2-1: Emit deploy start event
  emitDiagnosticEvent({ type: "orchestrator.deploy", planId: plan.planId, phase: "start", agentCount: plan.agents.length });

  // S1-2: Pre-deploy conflict detection — auto-remove stale orchestrator agents
  const conflicts = await detectConflicts(plan, callGateway);
  if (conflicts.length > 0) {
    emitDiagnosticEvent({ type: "orchestrator.deploy", planId: plan.planId, phase: "conflict-cleanup", agents: conflicts.join(",") });
    for (const conflictId of conflicts) {
      try {
        await callGateway("agents.remove", { agentId: conflictId });
      } catch {
        // If removal fails, abort with clear message
        const msg = `无法清除冲突 agent "${conflictId}"，请先手动删除或 rollback 旧方案。`;
        state = { ...state, status: "failed", error: msg };
        await saveState(state);
        for (const bp of plan.agents) {
          results.push({ agentId: bp.id, name: bp.name, status: "failed", error: msg });
        }
        return { planId: plan.planId, agents: results, finalStatus: "failed" };
      }
    }
  }

  // S1-4: Collect all successful agents' config patches, apply once at the end
  const pendingConfigPatches: Array<{ bp: AgentBlueprint; deployedId: string }> = [];
  let aborted = false;

  while (agentQueue.length > 0 && maxIterations-- > 0) {
    // S1-5: Check for cancellation (rollback triggered during deploy)
    if (signal.aborted) {
      emitDiagnosticEvent({ type: "orchestrator.deploy", planId: plan.planId, phase: "cancelled" });
      state = { ...state, status: "cancelled" };
      await saveState(state);
      return { planId: plan.planId, agents: results, finalStatus: "cancelled" };
    }

    const nextBatch: AgentBlueprint[] = [];
    const deferred: AgentBlueprint[] = [];

    for (const bp of agentQueue) {
      const deps = bp.dependsOn ?? [];
      const depsReady = deps.every(d => deployed.has(d));
      if (depsReady) {
        nextBatch.push(bp);
      } else {
        deferred.push(bp);
      }
    }

    if (nextBatch.length === 0 && deferred.length > 0) {
      state = { ...state, status: "failed", error: "dependency deadlock" };
      await saveState(state);
      for (const d of deferred) {
        results.push({ agentId: d.id, name: d.name, status: "failed", error: "dependency deadlock" });
      }
      break;
    }

    for (const bp of nextBatch) {
      if (signal.aborted) break;

      // S1-1: Use namespaced deployed ID
      const did = deployAgentId(plan.planId, bp.id);

      state = updateAgentStatus(state, bp.id, "creating");
      await saveState(state);

      // Track which step we reached for compensation (S1-3)
      let agentCreated = false;

      try {
        // Step 1: Create agent via gateway
        await callGateway("agents.create", {
          name: bp.name,
          id: did,
          emoji: bp.emoji,
          workspace: resolveAgentWorkspace(did),
        });
        agentCreated = true;

        // Step 2: Write SOUL.md
        state = updateAgentStatus(state, bp.id, "writing_soul");
        await saveState(state);
        await callGateway("agents.files.set", {
          agentId: did,
          name: "SOUL.md",
          content: bp.soul,
        });

        // Step 3 deferred: collect config patch for batch application (S1-4)
        state = updateAgentStatus(state, bp.id, "configuring");
        await saveState(state);
        pendingConfigPatches.push({ bp, deployedId: did });

        // Mark agent ready (config will be applied in batch below)
        state = updateAgentStatus(state, bp.id, "ready");
        await saveState(state);
        deployed.add(bp.id);
        results.push({ agentId: bp.id, name: bp.name, status: "ready" });
        emitDiagnosticEvent({ type: "orchestrator.deploy", planId: plan.planId, phase: "agent_ready", agentId: bp.id });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        // S1-3: Compensation — if agent was created but later steps failed, delete it
        if (agentCreated) {
          try {
            await callGateway("agents.delete", { agentId: did, deleteFiles: true });
          } catch { /* compensation best-effort */ }
        }

        state = updateAgentStatus(state, bp.id, "failed", msg);
        await saveState(state);
        results.push({ agentId: bp.id, name: bp.name, status: "failed", error: msg });
        emitDiagnosticEvent({ type: "orchestrator.deploy", planId: plan.planId, phase: "failed", agentId: bp.id, error: msg });

        // S1-7: Plan-level abort policy
        if (plan.onAgentFail === "abort") {
          aborted = true;
          state = { ...state, status: "failed", error: `Aborted after ${bp.name} failed: ${msg}` };
          await saveState(state);
          // Mark remaining agents as failed
          for (const rem of deferred) {
            results.push({ agentId: rem.id, name: rem.name, status: "failed", error: "aborted" });
          }
          break;
        }
      }
    }

    if (aborted) break;
    agentQueue.length = 0;
    agentQueue.push(...deferred);
  }

  // S1-4: Apply all config patches in a single merged call
  if (pendingConfigPatches.length > 0 && !signal.aborted && !aborted) {
    try {
      const mergedList: Record<string, unknown>[] = [];
      for (const { bp, deployedId } of pendingConfigPatches) {
        const patch = buildFullConfigPatch(bp, deployedId);
        if (patch) {
          const list = (patch as { agents?: { list?: unknown[] } }).agents?.list;
          if (Array.isArray(list)) {
            mergedList.push(...(list as Record<string, unknown>[]));
          }
        }
      }

      if (mergedList.length > 0) {
        const snapshot = await callGateway("config.get", {}) as
          Record<string, unknown> | undefined;
        const baseHash = (snapshot as Record<string, unknown> | undefined)
          ?.hash as string | undefined;
        await callGateway("config.patch", {
          raw: JSON.stringify({ agents: { list: mergedList } }),
          ...(baseHash ? { baseHash } : {}),
        });
      }
    } catch (err) {
      // Config patch failed — mark all agents as failed since their config isn't applied
      const msg = `Config patch failed: ${err instanceof Error ? err.message : String(err)}`;
      for (const { bp, deployedId } of pendingConfigPatches) {
        state = updateAgentStatus(state, bp.id, "failed", msg);
        // Find and update the result
        const idx = results.findIndex(r => r.agentId === bp.id && r.status === "ready");
        if (idx >= 0) results[idx] = { agentId: bp.id, name: bp.name, status: "failed", error: msg };
        // Compensation: delete the half-configured agent
        try {
          await callGateway("agents.delete", { agentId: deployedId, deleteFiles: true });
        } catch { /* compensation best-effort */ }
      }
      await saveState(state);
    }
  }

  const finalStatus = (await loadState(plan.planId))?.status ?? "failed";
  const readyCount = results.filter(r => r.status === "ready").length;
  emitDiagnosticEvent({
    type: "orchestrator.deploy",
    planId: plan.planId,
    phase: finalStatus === "deployed" ? "complete" : "failed",
    agentCount: readyCount,
    error: finalStatus !== "deployed" ? `${results.length - readyCount} agent(s) failed` : undefined,
  });

  // S2-4: Register deployed agents in the in-memory registry
  if (readyCount > 0) {
    const readyIds = new Set(results.filter(r => r.status === "ready").map(r => r.agentId));
    registerOrchestratedAgents(plan, readyIds);
  }

  // Auto-create team project from deployed plan (bridge orchestrator → agent-team)
  if (finalStatus === "deployed") {
    try {
      await callGateway("team.project.createFromPlan", { planId: plan.planId });
    } catch (err) {
      // Non-fatal: agents are deployed even if project creation fails
      // (agent-team plugin may not be loaded, or project already exists)
      emitDiagnosticEvent({
        type: "orchestrator.deploy",
        planId: plan.planId,
        phase: "project-create-failed",
        error: String(err),
      });
    }
  }

  return { planId: plan.planId, agents: results, finalStatus };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function textResult(text: string): AgentToolResult<unknown> {
  return {
    content: [{ type: "text", text }],
    details: { text },
  };
}

function resolveCurrentModel(ctx: OpenClawCNPluginToolContext): string | undefined {
  const cfg = ctx.config as Record<string, unknown> | undefined;
  const agents = cfg?.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const model = defaults?.model;

  let modelRef: string | undefined;
  if (typeof model === "string") {
    modelRef = model;
  } else if (typeof model === "object" && model !== null) {
    const primary = (model as Record<string, unknown>).primary;
    if (typeof primary === "string") {
      modelRef = primary;
    }
  }

  if (!modelRef) return undefined;
  const slashIdx = modelRef.indexOf("/");
  return slashIdx >= 0 ? modelRef.slice(slashIdx + 1) : modelRef;
}

function resolveAgentWorkspace(agentId: string): string {
  return `~/agents/${agentId}`;
}

function normalizeBlueprint(raw: Record<string, unknown>): AgentBlueprint {
  const name = String(raw.name ?? "").trim();
  const id = String(raw.id ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  const role = String(raw.role ?? "").trim();
  const soul = String(raw.soul ?? "").trim();
  const emoji = typeof raw.emoji === "string" ? raw.emoji.trim() : undefined;
  const rawTier = String(raw.modelTier ?? "mid").trim();
  const VALID_TIERS = new Set(["cheap", "mid", "sota"]);
  const modelTier: "cheap" | "mid" | "sota" = VALID_TIERS.has(rawTier)
    ? rawTier as "cheap" | "mid" | "sota"
    : "mid";
  const dependsOn = Array.isArray(raw.dependsOn)
    ? raw.dependsOn.filter((d): d is string => typeof d === "string")
    : undefined;

  const resolvedName = name || id || "agent";
  const resolvedId = id || name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "agent";

  return {
    name: resolvedName,
    id: resolvedId,
    role: role || `Agent: ${resolvedName}`,
    soul: soul || `# SOUL — ${resolvedName}\n\n${role || resolvedName}`,
    emoji,
    modelTier,
    tools: {},
    dependsOn,
  };
}

/**
 * Deep clone template blueprints to avoid mutating built-in templates.
 */
export function deepCloneBlueprints(agents: AgentBlueprint[]): AgentBlueprint[] {
  return agents.map(a => ({
    ...a,
    tools: {
      ...a.tools,
      allow: a.tools.allow ? [...a.tools.allow] : undefined,
      deny: a.tools.deny ? [...a.tools.deny] : undefined,
      skills: a.tools.skills ? [...a.tools.skills] : undefined,
      mcpServers: a.tools.mcpServers ? [...a.tools.mcpServers] : undefined,
    },
    dependsOn: a.dependsOn ? [...a.dependsOn] : undefined,
  }));
}

/**
 * Validate blueprint array. Returns error string or null.
 */
function validateBlueprints(blueprints: AgentBlueprint[]): string | null {
  // Max 10 agents
  if (blueprints.length > 10) {
    return `Error: Too many agents (${blueprints.length}). Maximum is 10. Consider consolidating.`;
  }
  if (blueprints.length === 0) {
    return "Error: No agents defined in the plan.";
  }

  // Validate ids
  for (const bp of blueprints) {
    if (!bp.id || bp.id === "-" || bp.id.replace(/-/g, "").length === 0) {
      return `Error: Agent "${bp.name}" has an invalid id "${bp.id}". IDs must contain at least one alphanumeric character.`;
    }
    if (bp.id === "main") {
      return `Error: Agent id "main" is reserved. Choose a different id.`;
    }
  }

  // Check duplicates
  const idSet = new Set<string>();
  for (const bp of blueprints) {
    if (idSet.has(bp.id)) {
      return `Error: Duplicate agent id "${bp.id}". Each agent must have a unique id.`;
    }
    idSet.add(bp.id);
  }

  // Validate dependsOn references
  for (const bp of blueprints) {
    for (const dep of bp.dependsOn ?? []) {
      if (!idSet.has(dep)) {
        return `Error: Agent "${bp.id}" depends on "${dep}", but no agent with that id exists.`;
      }
      if (dep === bp.id) {
        return `Error: Agent "${bp.id}" depends on itself.`;
      }
    }
  }

  // Detect cycles
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const depsMap = new Map(blueprints.map(bp => [bp.id, bp.dependsOn ?? []]));

  function hasCycle(id: string): string | null {
    if (visiting.has(id)) return id;
    if (visited.has(id)) return null;
    visiting.add(id);
    for (const dep of depsMap.get(id) ?? []) {
      const cycle = hasCycle(dep);
      if (cycle) return cycle;
    }
    visiting.delete(id);
    visited.add(id);
    return null;
  }

  for (const bp of blueprints) {
    const cycle = hasCycle(bp.id);
    if (cycle) {
      return `Error: Circular dependency detected involving agent "${cycle}".`;
    }
  }

  return null;
}

/**
 * Apply structural adjustments to a plan.
 */
function applyAdjustments(
  plan: OrchestrationPlan,
  adjustments: Array<Record<string, unknown>>,
): void {
  for (const adj of adjustments) {
    const agentId = String(adj.id ?? "");
    const action = String(adj.action ?? "update");

    if (action === "remove") {
      plan.agents = plan.agents.filter(a => a.id !== agentId);
      continue;
    }

    if (action === "add") {
      const newAgent = normalizeBlueprint(adj as Record<string, unknown>);
      plan.agents.push(newAgent);
      continue;
    }

    // update
    const agent = plan.agents.find(a => a.id === agentId);
    if (agent) {
      if (typeof adj.name === "string") agent.name = adj.name;
      if (typeof adj.role === "string") agent.role = adj.role;
      if (typeof adj.modelTier === "string") {
        const validTiers = ["cheap", "mid", "sota"] as const;
        const tier = adj.modelTier as string;
        if (validTiers.includes(tier as typeof validTiers[number])) {
          agent.modelTier = tier as "cheap" | "mid" | "sota";
        }
      }
    }
  }
}

/**
 * Build a full config patch for an agent, including all inferred capabilities.
 * Falls back to basic tools-only patch if no inferredCapabilities.
 * @param bp - Agent blueprint
 * @param deployedId - The namespaced agent ID used in gateway (defaults to bp.id for backward compat)
 */
function buildFullConfigPatch(bp: AgentBlueprint, deployedId?: string): Record<string, unknown> | undefined {
  const cap = bp.inferredCapabilities;
  const agentId = deployedId ?? bp.id;

  if (!cap) {
    // Legacy fallback: tools only
    return buildToolsOnlyConfigPatch(bp, agentId);
  }

  const agentEntry: Record<string, unknown> = { id: agentId };

  // model
  if (cap.model?.primary) {
    agentEntry.model = cap.model.fallbacks?.length
      ? { primary: cap.model.primary, fallbacks: cap.model.fallbacks }
      : cap.model.primary;
  }

  // tools
  const tools: Record<string, unknown> = {};
  if (cap.tools.profile) tools.profile = cap.tools.profile;
  if (cap.tools.allow?.length) tools.allow = cap.tools.allow;
  if (cap.tools.alsoAllow?.length) tools.alsoAllow = cap.tools.alsoAllow;
  if (cap.tools.deny?.length) tools.deny = cap.tools.deny;
  if (Object.keys(tools).length) agentEntry.tools = tools;

  // skills
  if (cap.skills?.length) agentEntry.skills = cap.skills;

  // memorySearch
  if (cap.memorySearch?.enabled) agentEntry.memorySearch = cap.memorySearch;

  // identity
  if (cap.identity) agentEntry.identity = cap.identity;

  // subagents
  if (cap.subagents) agentEntry.subagents = cap.subagents;

  // heartbeat
  if (cap.heartbeat?.enabled) agentEntry.heartbeat = cap.heartbeat;

  if (Object.keys(agentEntry).length <= 1) return undefined;

  return { agents: { list: [agentEntry] } };
}

/**
 * Legacy: tools-only config patch.
 */
function buildToolsOnlyConfigPatch(bp: AgentBlueprint, deployedId?: string): Record<string, unknown> | undefined {
  const toolsCfg: Record<string, unknown> = {};
  if (bp.tools.allow?.length) toolsCfg.allow = bp.tools.allow;
  if (bp.tools.deny?.length) toolsCfg.deny = bp.tools.deny;
  if (bp.tools.profile) toolsCfg.profile = bp.tools.profile;
  if (Object.keys(toolsCfg).length === 0) return undefined;
  return { agents: { list: [{ id: deployedId ?? bp.id, tools: toolsCfg }] } };
}

// ── Formatting ───────────────────────────────────────────────────────────

/**
 * Format quick_deploy result for user (no technical jargon).
 */
function formatQuickDeployResult(
  plan: OrchestrationPlan,
  result: DeployResult,
  usageGuide: string,
): string {
  const allOk = result.agents.every(a => a.status === "ready");
  const failed = result.agents.filter(a => a.status === "failed");

  if (!allOk) {
    const failedNames = failed.map(a => a.name).join("、");
    return (
      `部署过程中遇到问题。\n\n` +
      `以下成员部署失败: ${failedNames}\n` +
      failed.map(a => `  ${a.name}: ${a.error}`).join("\n") +
      `\n\n可以调用 action="rollback" planId="${plan.planId}" 清理后重试。`
    );
  }

  const lines: string[] = [];
  lines.push("团队已上线！\n");
  lines.push(usageGuide);

  return lines.join("\n");
}

/**
 * Format guided_propose result for user.
 */
function formatProposalForUser(plan: OrchestrationPlan): string {
  const lines: string[] = [];
  lines.push(`推荐以下团队方案：\n`);
  lines.push(`planId: ${plan.planId}\n`);

  for (const bp of plan.agents) {
    const initial = bp.name.charAt(0);
    lines.push(`[${initial}] ${bp.name}`);
    lines.push(`    ${bp.role}`);
    lines.push("");
  }

  // Cost estimate
  const cost = estimateTeamDailyCost(plan.agents, plan.userContext?.volume ?? "medium");
  if (cost > 0) {
    lines.push(`预估日均成本: 约 ${formatCostRange(cost)}`);
    lines.push("");
  }

  lines.push("需要调整吗？可以增减成员、修改职责，或直接确认。");
  lines.push(`确认后，我来为每个成员编写详细的工作指南（SOUL）。`);

  return lines.join("\n");
}

/**
 * Format guided_deploy result for user.
 */
function formatGuidedDeployResult(
  plan: OrchestrationPlan,
  result: DeployResult,
  usageGuide: string,
): string {
  const allOk = result.agents.every(a => a.status === "ready");
  const failed = result.agents.filter(a => a.status === "failed");

  if (!allOk) {
    const failedNames = failed.map(a => a.name).join("、");
    return (
      `部署过程中遇到问题。\n\n` +
      `以下成员部署失败: ${failedNames}\n` +
      failed.map(a => `  ${a.name}: ${a.error}`).join("\n") +
      `\n\n可以调用 action="rollback" planId="${plan.planId}" 清理后重试。`
    );
  }

  const lines: string[] = [];
  lines.push("团队已上线！\n");
  lines.push(usageGuide);

  return lines.join("\n");
}

/**
 * Format plan summary for legacy plan action.
 */
function formatPlanSummary(plan: OrchestrationPlan, templateId?: string): string {
  const lines: string[] = [
    `## Orchestration Plan: \`${plan.planId}\`\n`,
    `**Team:** ${plan.teamDescription}`,
    templateId ? `**Template:** \`${templateId}\`` : "**Template:** Custom",
    `**Requirement:** ${plan.requirement.slice(0, 200)}${plan.requirement.length > 200 ? "..." : ""}`,
    "",
    `### Agents (${plan.agents.length})`,
    "",
  ];

  for (const bp of plan.agents) {
    const emoji = bp.emoji ?? "";
    const tools = bp.tools.allow?.join(", ") ?? "default";
    const deps = bp.dependsOn?.length
      ? ` (depends on: ${bp.dependsOn.join(", ")})`
      : "";
    lines.push(`#### ${emoji} ${bp.name} (\`${bp.id}\`)`);
    lines.push(`- Role: ${bp.role}`);
    lines.push(`- Model tier: ${bp.modelTier}${deps}`);
    lines.push(`- Tools: ${tools}`);
    if (bp.tools.skills?.length) {
      lines.push(`- Skills: ${bp.tools.skills.join(", ")}`);
    }
    if (bp.tools.mcpServers?.length) {
      lines.push(`- MCP: ${bp.tools.mcpServers.join(", ")}`);
    }
    lines.push("");
  }

  if (plan.estimatedTokensPerTurn) {
    lines.push(`### Token Estimate`);
    lines.push(`~${formatTokens(plan.estimatedTokensPerTurn)} tokens/turn (all agents combined)`);
    lines.push("");
  }

  lines.push("---");
  lines.push(
    `**Confirm?** Call \`agents_orchestrate\` with action="confirm" and planId="${plan.planId}"`,
  );
  lines.push(
    "You can also modify the plan by calling action=\"plan\" again with adjusted agentBlueprints.",
  );

  return lines.join("\n");
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Gateway Call Type ────────────────────────────────────────────────────

export type CallGatewayFn = (
  method: string,
  params: Record<string, unknown>,
) => Promise<unknown>;

// Re-export for testing
export { deployAgentId };

// ── Exported Quick Deploy (for gateway method registration) ──────────────

/**
 * Perform quick deploy from a gateway method handler.
 * Unlike handleQuickDeploy (which is a tool handler returning AgentToolResult),
 * this returns a plain object suitable for gateway respond().
 *
 * The deploy runs asynchronously — caller gets back the planId immediately
 * and polls orchestrator.deploy.status for progress.
 */
export async function performQuickDeploy(
  callGw: CallGatewayFn,
  opts: { templateId?: string; requirement?: string },
): Promise<{ planId: string; status: string } | { error: string; matched: false }> {
  const requirement = (opts.requirement ?? "").trim();
  const template = opts.templateId
    ? getTemplate(opts.templateId)
    : matchTemplate(requirement);

  if (!template) {
    return { error: "No matching template found", matched: false };
  }

  const blueprints = deepCloneBlueprints(template.agents);

  const defaultContext: UserContext = {
    scenario: template.category ?? "general",
    channels: [],
    resources: [],
    volume: "medium",
    budget: "balanced",
  };
  for (const bp of blueprints) {
    bp.inferredCapabilities = inferAgentCapabilities(bp, defaultContext);
  }

  const planId = generatePlanId();
  const plan: OrchestrationPlan = {
    planId,
    createdAt: new Date().toISOString(),
    requirement,
    templateId: template.id,
    agents: blueprints,
    teamDescription: template.description,
    mode: "template",
    userContext: defaultContext,
  };
  await savePlan(plan);

  const state = createInitialState(plan);
  state.status = "deploying";
  state.deployStartedAt = new Date().toISOString();
  await saveState(state);

  // S2-2: Idempotency — reject if deploy already in progress for this planId
  if (isDeployActive(planId)) {
    return { planId, status: "deploying" };
  }

  // Fire-and-forget: deploy runs in background, UI polls via deploy.status
  void (async () => {
    try {
      await executeDeploySequence(plan, state, callGw);

      const usageGuide = generateUsageGuide(plan);
      plan.usageGuide = usageGuide;
      await savePlan(plan);
    } catch (err) {
      console.error(`[orchestrator] background deploy failed for ${planId}:`, err);
      try {
        const latest = await loadState(planId);
        if (latest && latest.status === "deploying") {
          await saveState({ ...latest, status: "failed", error: err instanceof Error ? err.message : String(err) });
        }
      } catch (innerErr) {
        console.error(`[orchestrator] failed to persist deploy failure for ${planId}:`, innerErr);
      }
    }
  })();

  return { planId, status: "deploying" };
}

// ═══════════════════════════════════════════════════════════════════════════
// UI-facing Gateway Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * UI-facing propose: auto-generate a team proposal from requirement + user answers.
 * Unlike the LLM-facing handleGuidedPropose, this does NOT need agentBlueprints —
 * it tries template matching and falls back to keyword-based team generation.
 */
export async function performGuidedPropose(
  callGw: CallGatewayFn,
  requirement: string,
  userContextJson: string,
): Promise<{
  planId: string;
  teamName: string;
  teamDescription: string;
  agents: Array<{
    id: string;
    name: string;
    role: string;
    emoji?: string;
    modelTier: string;
    tools: string[];
  }>;
  costEstimate?: string;
}> {
  // 1. Parse user context
  let userContext: UserContext;
  try {
    const parsed = JSON.parse(userContextJson || "{}");
    userContext = {
      scenario: String(parsed.scenario ?? "general"),
      channels: Array.isArray(parsed.channels) ? parsed.channels : [],
      resources: Array.isArray(parsed.resources) ? parsed.resources : [],
      volume: parsed.volume ?? "medium",
      budget: parsed.budget ?? "balanced",
    };
  } catch {
    userContext = { scenario: "general", channels: [], resources: [], volume: "medium", budget: "balanced" };
  }

  // 2. Try template matching first
  const template = matchTemplate(requirement);
  let blueprints: AgentBlueprint[];
  let teamDescription: string;

  if (template) {
    blueprints = deepCloneBlueprints(template.agents);
    teamDescription = template.description;
    userContext.scenario = template.category ?? userContext.scenario;
  } else {
    // No template match — generate a minimal default team from keywords
    blueprints = generateDefaultTeam(requirement, userContext);
    teamDescription = requirement;
  }

  // 3. Infer capabilities
  for (const bp of blueprints) {
    bp.inferredCapabilities = inferAgentCapabilities(bp, userContext);
    if (!bp.tools || !bp.tools.allow || bp.tools.allow.length === 0) {
      bp.tools = recommendToolsForRole(bp.role, bp.name);
    }
  }

  // 4. Save as draft
  const planId = generatePlanId();
  const plan: OrchestrationPlan = {
    planId,
    createdAt: new Date().toISOString(),
    requirement,
    templateId: template?.id,
    agents: blueprints,
    teamDescription,
    mode: "guided",
    userContext,
  };
  await savePlan(plan);

  const state = createInitialState(plan);
  state.status = "draft";
  await saveState(state);

  // 5. Build cost estimate
  const cost = estimateTeamDailyCost(blueprints, userContext.volume);

  return {
    planId,
    teamName: template?.name ?? "定制团队",
    teamDescription,
    agents: blueprints.map(bp => ({
      id: bp.id,
      name: bp.name,
      role: bp.role,
      emoji: bp.emoji,
      modelTier: bp.modelTier,
      tools: bp.tools.allow ?? [],
    })),
    costEstimate: cost > 0 ? formatCostRange(cost) : undefined,
  };
}

/**
 * Generate a minimal default team when no template matches.
 * Uses keyword analysis to pick 2-3 relevant agents.
 */
function generateDefaultTeam(requirement: string, userContext: UserContext): AgentBlueprint[] {
  const lower = requirement.toLowerCase();
  const team: AgentBlueprint[] = [];

  // Always add a primary assistant
  team.push({
    name: "主力助手",
    id: "primary-assistant",
    role: "核心任务处理，负责响应用户需求和执行主要工作",
    soul: buildMinimalSoul("主力助手", "核心任务处理，负责响应用户需求和执行主要工作"),
    modelTier: userContext.budget === "cheap" ? "cheap" : "mid",
    tools: { allow: ["group:web", "group:memory"], profile: "minimal" },
  });

  // Add scenario-specific agents
  if (/写|文案|内容|创作|copy|writing|content/i.test(lower)) {
    team.push({
      name: "文案写手",
      id: "copywriter",
      role: "撰写和优化各类文案内容",
      soul: buildMinimalSoul("文案写手", "撰写和优化各类文案内容"),
      modelTier: "mid",
      tools: { allow: ["group:web", "group:memory"] },
    });
  }

  if (/数据|分析|报表|data|analy/i.test(lower)) {
    team.push({
      name: "数据分析师",
      id: "data-analyst",
      role: "分析数据、生成报表和可视化",
      soul: buildMinimalSoul("数据分析师", "分析数据、生成报表和可视化"),
      modelTier: "mid",
      tools: { allow: ["group:web", "group:memory", "group:fs"], profile: "minimal" },
    });
  }

  if (/客服|support|服务|答疑|咨询/i.test(lower)) {
    team.push({
      name: "客服专员",
      id: "support-agent",
      role: "自动回答客户常见问题，处理咨询",
      soul: buildMinimalSoul("客服专员", "自动回答客户常见问题，处理咨询"),
      modelTier: "cheap",
      tools: { allow: ["group:web", "group:memory"] },
    });
  }

  if (/代码|开发|编程|code|dev|program/i.test(lower)) {
    team.push({
      name: "编程助手",
      id: "code-assistant",
      role: "编写、审查和调试代码",
      soul: buildMinimalSoul("编程助手", "编写、审查和调试代码"),
      modelTier: "mid",
      tools: { allow: ["group:web", "group:fs", "group:memory"], profile: "coding" },
    });
  }

  if (/研究|调研|research|报告/i.test(lower)) {
    team.push({
      name: "研究员",
      id: "researcher",
      role: "搜索资料、整理信息、撰写研究报告",
      soul: buildMinimalSoul("研究员", "搜索资料、整理信息、撰写研究报告"),
      modelTier: "mid",
      tools: { allow: ["group:web", "group:memory"] },
    });
  }

  // Cap at 4 agents maximum for auto-generated teams
  return team.slice(0, 4);
}

function buildMinimalSoul(name: string, role: string): string {
  return [
    `# SOUL — ${name}`,
    "",
    "## 角色",
    `你是${name}。${role}。`,
    "",
    "## 核心职责",
    `- ${role}`,
    "- 记住用户的偏好和习惯",
    "- 主动汇报进展",
    "",
    "## 行为准则",
    "- 保持专业、简洁",
    "- 遇到不确定的事情先确认再行动",
    "- 与团队其他成员保持协作",
    "",
    "## 能力边界",
    "- 需要时请求团队其他成员协助",
    "- 不做超出职责范围的决定",
    "",
    "## 协作指令",
    "- 配合团队成员完成跨领域任务",
  ].join("\n");
}

/**
 * UI-facing deploy: deploy a saved plan in fire-and-forget mode.
 * The UI polls orchestrator.deploy.status for progress.
 */
export async function performGuidedDeploy(
  callGw: CallGatewayFn,
  planId: string,
): Promise<{ planId: string; status: string } | { error: string }> {
  const plan = await loadPlan(planId);
  if (!plan) return { error: `Plan "${planId}" not found` };

  let state = await loadState(planId);
  if (!state) return { error: "Plan state not found" };

  if (state.status !== "draft" && state.status !== "confirming") {
    return { error: `Plan status is "${state.status}", expected draft or confirming` };
  }

  // S2-2: Idempotency — reject if deploy already in progress
  if (isDeployActive(planId)) {
    return { planId, status: "deploying" };
  }

  // Transition to deploying
  state = { ...state, status: "deploying", deployStartedAt: new Date().toISOString() };
  await saveState(state);

  // Fire-and-forget: deploy runs in background, UI polls via deploy.status
  void (async () => {
    try {
      await executeDeploySequence(plan, state!, callGw);

      const usageGuide = generateUsageGuide(plan);
      plan.usageGuide = usageGuide;
      await savePlan(plan);
    } catch (err) {
      console.error(`[orchestrator] background guided deploy failed for ${planId}:`, err);
      try {
        const latest = await loadState(planId);
        if (latest && latest.status === "deploying") {
          await saveState({ ...latest, status: "failed", error: err instanceof Error ? err.message : String(err) });
        }
      } catch (innerErr) {
        console.error(`[orchestrator] failed to persist deploy failure for ${planId}:`, innerErr);
      }
    }
  })();

  return { planId, status: "deploying" };
}

// ── Exported Validate (for gateway method) ──────────────────────────────

export async function validatePlanForDeploy(
  callGw: CallGatewayFn,
  planId: string,
): Promise<{ valid: boolean; checks: Array<{ label: string; pass: boolean; detail?: string }> }> {
  const plan = await loadPlan(planId);
  if (!plan) return { valid: false, checks: [{ label: "Plan exists", pass: false, detail: "Not found" }] };

  const state = await loadState(planId);
  if (!state) return { valid: false, checks: [{ label: "State exists", pass: false, detail: "Not found" }] };

  const checks: Array<{ label: string; pass: boolean; detail?: string }> = [];

  const validStatuses = new Set(["draft", "confirming", "deploying"]);
  checks.push({
    label: "Plan status",
    pass: validStatuses.has(state.status),
    detail: state.status,
  });

  const conflicts = await detectConflicts(plan, callGw);
  checks.push({
    label: "Agent ID conflicts",
    pass: conflicts.length === 0,
    detail: conflicts.length > 0 ? conflicts.join(", ") : "None",
  });

  const missingSoul = plan.agents.filter(a => !a.soul || a.soul.length <= 50);
  checks.push({
    label: "SOUL content",
    pass: missingSoul.length === 0,
    detail: missingSoul.length > 0 ? `Missing: ${missingSoul.map(a => a.name).join(", ")}` : "Complete",
  });

  const bpError = validateBlueprints(plan.agents);
  checks.push({ label: "Blueprints", pass: bpError === null, detail: bpError ?? "Valid" });

  checks.push({
    label: "No active deploy",
    pass: !isDeployActive(planId),
    detail: isDeployActive(planId) ? "In progress" : "Clear",
  });

  return { valid: checks.every(c => c.pass), checks };
}
