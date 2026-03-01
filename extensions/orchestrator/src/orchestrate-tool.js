import { Type } from "@sinclair/typebox";
import { checkModelEligibility } from "./model-gate.js";
import {
  formatTemplateList,
  getTemplate,
  listTemplates,
  matchTemplate
} from "./templates.js";
import { estimateToolTokens, recommendToolsForRole } from "./tool-recommend.js";
import {
  createInitialState,
  generatePlanId,
  loadPlan,
  loadState,
  savePlan,
  saveState,
  updateAgentStatus
} from "./state.js";
import { inferAgentCapabilities } from "./guided/capability-inference.js";
import { discoverAll } from "./guided/runtime-discovery.js";
import { verifyScene, formatVerificationReport } from "./guided/scene-verifier.js";
import { executePlanningPipeline, formatPipelineReport } from "./guided/planning-pipeline.js";
import { validateSoulStructure, buildSoulGenerationPrompt } from "./guided/soul-validator.js";
import { estimateTeamDailyCost, formatCostRange } from "./guided/cost-estimator.js";
import { generateUsageGuide } from "./guided/usage-guide.js";
import { emitDiagnosticEvent } from "../../../dist/infra/diagnostic-events.js";
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
  "scene_verify"
];
const OrchestrateToolSchema = Type.Object({
  action: Type.Unsafe({
    type: "string",
    enum: [...ORCHESTRATE_ACTIONS]
  }),
  requirement: Type.Optional(Type.String()),
  templateId: Type.Optional(Type.String()),
  planId: Type.Optional(Type.String()),
  agentBlueprints: Type.Optional(Type.String()),
  teamDescription: Type.Optional(Type.String()),
  userContext: Type.Optional(Type.String()),
  refinements: Type.Optional(Type.String()),
  soulContents: Type.Optional(Type.String())
});
function createOrchestrateTool(ctx, callGateway) {
  return {
    label: "Orchestrator",
    name: "agents_orchestrate",
    description: [
      "Plan, deploy, and manage multi-agent teams.",
      "",
      "Actions:",
      '  "quick_deploy"     \u2014 One-click deploy from template. Params: requirement, templateId?',
      '  "guided_propose"   \u2014 Propose team from user context. Params: requirement, userContext (JSON), agentBlueprints (JSON)',
      '  "guided_refine"    \u2014 Refine plan with SOUL content. Params: planId, refinements? (JSON), soulContents? (JSON)',
      '  "guided_deploy"    \u2014 Deploy a guided plan. Params: planId',
      '  "templates"        \u2014 List available scene templates',
      '  "plan"             \u2014 Create plan from blueprints. Params: requirement, agentBlueprints (JSON), teamDescription',
      '  "confirm"          \u2014 Confirm a plan. Params: planId',
      '  "deploy"           \u2014 Deploy confirmed plan. Params: planId',
      '  "status"           \u2014 Check deployment status. Params: planId',
      '  "rollback"         \u2014 Delete agents from a plan. Params: planId',
      '  "validate"         \u2014 Dry-run validation before deploy. Params: planId',
      '  "scene_verify"     \u2014 Verify team completeness against requirements. Params: planId',
      "",
      "Recommended workflow: quick_deploy (for templates) or guided_propose \u2192 guided_refine \u2192 guided_deploy"
    ].join("\n"),
    parameters: OrchestrateToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args;
      const action = String(params.action ?? "").trim();
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
        case "scene_verify":
          return handleSceneVerify(params, ctx);
        default:
          return textResult(
            `Unknown action: "${action}". Valid actions: ${ORCHESTRATE_ACTIONS.join(", ")}`
          );
      }
    }
  };
}
async function handleQuickDeploy(params, ctx, callGateway) {
  const requirement = String(params.requirement ?? "").trim();
  const templateId = typeof params.templateId === "string" ? params.templateId.trim() : void 0;
  const template = templateId ? getTemplate(templateId) : matchTemplate(requirement);
  if (!template) {
    return textResult(
      '\u6CA1\u6709\u627E\u5230\u5339\u914D\u7684\u6A21\u677F\u3002\n\n\u4F60\u53EF\u4EE5\u5C1D\u8BD5\u5F15\u5BFC\u5F0F\u6784\u5EFA \u2014\u2014 \u544A\u8BC9\u6211\u66F4\u591A\u5173\u4E8E\u4F60\u7684\u9700\u6C42\uFF0C\u6211\u6765\u5E2E\u4F60\u89C4\u5212\u56E2\u961F\u3002\n\uFF08\u8C03\u7528 action="guided_propose" \u5F00\u59CB\u5F15\u5BFC\u5F0F\u6784\u5EFA\uFF09'
    );
  }
  const blueprints = deepCloneBlueprints(template.agents);
  const defaultContext = {
    scenario: template.category ?? "general",
    channels: [],
    resources: [],
    volume: "medium",
    budget: "balanced"
  };
  const pluginConfig = ctx.config;
  const discoveryResult = await discoverAll(ctx.workspaceDir).catch(() => void 0);
  for (const bp of blueprints) {
    bp.inferredCapabilities = inferAgentCapabilities(bp, defaultContext, pluginConfig, discoveryResult);
  }
  const planId = generatePlanId();
  const plan = {
    planId,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    requirement,
    templateId: template.id,
    agents: blueprints,
    teamName: template.name,
    teamDescription: template.description,
    mode: "template",
    userContext: defaultContext
  };
  await savePlan(plan);
  const state = createInitialState(plan);
  state.status = "deploying";
  state.deployStartedAt = (/* @__PURE__ */ new Date()).toISOString();
  await saveState(state);
  const deployResult = await executeDeploySequence(plan, state, callGateway);
  const usageGuide = generateUsageGuide(plan);
  plan.usageGuide = usageGuide;
  await savePlan(plan);
  return textResult(formatQuickDeployResult(plan, deployResult, usageGuide));
}
async function handleGuidedPropose(params, ctx) {
  const requirement = String(params.requirement ?? "").trim();
  if (!requirement) {
    return textResult("\u9700\u8981\u63D0\u4F9B requirement \u53C2\u6570\uFF08\u7528\u6237\u7684\u9700\u6C42\u63CF\u8FF0\uFF09\u3002");
  }
  let userContext;
  try {
    const raw = typeof params.userContext === "string" ? params.userContext : "{}";
    const parsed = JSON.parse(raw);
    userContext = {
      scenario: String(parsed.scenario ?? "general"),
      channels: Array.isArray(parsed.channels) ? parsed.channels : [],
      resources: Array.isArray(parsed.resources) ? parsed.resources : [],
      volume: parsed.volume ?? "medium",
      budget: parsed.budget ?? "balanced"
    };
  } catch {
    userContext = { scenario: "general", channels: [], resources: [], volume: "medium", budget: "balanced" };
  }
  const blueprintsJson = typeof params.agentBlueprints === "string" ? params.agentBlueprints : void 0;
  let blueprints = [];
  if (blueprintsJson) {
    try {
      const parsed = JSON.parse(blueprintsJson);
      if (!Array.isArray(parsed)) {
        return textResult("agentBlueprints \u5FC5\u987B\u662F JSON \u6570\u7EC4\u3002");
      }
      blueprints = parsed.map(normalizeBlueprint);
    } catch (e) {
      return textResult(`\u89E3\u6790 agentBlueprints \u5931\u8D25\uFF1A${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (blueprints.length === 0) {
    return textResult(
      "\u9700\u8981\u63D0\u4F9B agentBlueprints \u53C2\u6570\uFF08\u56E2\u961F\u6210\u5458\u5B9A\u4E49 JSON \u6570\u7EC4\uFF09\u3002\n\n\u6BCF\u4E2A\u6210\u5458\u9700\u8981: name, id, role, modelTier (cheap/mid/sota), soul (\u53EF\u4EE5\u4E3A\u7A7A\u5B57\u7B26\u4E32)"
    );
  }
  const validationError = validateBlueprints(blueprints);
  if (validationError) return textResult(validationError);
  const pluginConfig = ctx.config;
  const guidedDiscovery = await discoverAll(ctx.workspaceDir).catch(() => void 0);
  const pipelineResult = executePlanningPipeline({
    blueprints,
    requirement,
    userCtx: userContext,
    pluginConfig,
    discovery: guidedDiscovery
  });
  const refinedBlueprints = pipelineResult.blueprints;
  const planId = generatePlanId();
  const plan = {
    planId,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    requirement,
    agents: refinedBlueprints,
    teamDescription: requirement,
    mode: "guided",
    userContext,
    estimatedTokensPerTurn: refinedBlueprints.reduce(
      (sum, bp) => sum + estimateToolTokens(bp.tools),
      0
    ),
    verification: {
      overallPass: pipelineResult.verification.overallPass,
      score: pipelineResult.verification.score,
      report: formatVerificationReport(pipelineResult.verification)
    }
  };
  await savePlan(plan);
  const state = createInitialState(plan);
  state.status = "draft";
  await saveState(state);
  let proposal = formatProposalForUser(plan);
  proposal += "\n\n---\n" + formatPipelineReport(pipelineResult);
  if (plan.verification) {
    proposal += "\n\n" + plan.verification.report;
  }
  return textResult(proposal);
}
async function handleGuidedRefine(params) {
  const planId = String(params.planId ?? "").trim();
  if (!planId) return textResult("\u9700\u8981\u63D0\u4F9B planId \u53C2\u6570\u3002");
  const plan = await loadPlan(planId);
  if (!plan) return textResult(`\u627E\u4E0D\u5230\u65B9\u6848 "${planId}"\u3002`);
  const state = await loadState(planId);
  if (!state || state.status !== "draft" && state.status !== "confirming") {
    return textResult(
      `\u65B9\u6848 "${planId}" \u5F53\u524D\u72B6\u6001\u4E3A "${state?.status ?? "unknown"}"\uFF0C\u65E0\u6CD5\u4FEE\u6539\u3002\u53EA\u6709 draft \u72B6\u6001\u7684\u65B9\u6848\u53EF\u4EE5\u4FEE\u6539\u3002`
    );
  }
  if (typeof params.refinements === "string") {
    try {
      const refinements = JSON.parse(params.refinements);
      if (refinements.adjustments && Array.isArray(refinements.adjustments)) {
        applyAdjustments(plan, refinements.adjustments);
      }
    } catch (e) {
      return textResult(`\u89E3\u6790 refinements \u5931\u8D25\uFF1A${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (typeof params.soulContents === "string") {
    try {
      const soulMap = JSON.parse(params.soulContents);
      const MAX_SOUL_ENTRIES = 20;
      const MAX_SOUL_LENGTH = 2e4;
      if (Object.keys(soulMap).length > MAX_SOUL_ENTRIES) {
        return textResult(`SOUL \u6761\u76EE\u8FC7\u591A\uFF08\u6700\u591A ${MAX_SOUL_ENTRIES} \u4E2A\uFF09\u3002`);
      }
      for (const [agentId, soulContent] of Object.entries(soulMap)) {
        if (typeof soulContent !== "string") continue;
        if (soulContent.length > MAX_SOUL_LENGTH) {
          return textResult(
            `"${agentId}" \u7684 SOUL \u8D85\u8FC7\u957F\u5EA6\u9650\u5236\uFF08${MAX_SOUL_LENGTH} \u5B57\u7B26\uFF09\uFF0C\u5F53\u524D ${soulContent.length} \u5B57\u7B26\u3002\u8BF7\u7CBE\u7B80\u540E\u91CD\u8BD5\u3002`
          );
        }
        const sanitized = soulContent.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
        const agent = plan.agents.find((a) => a.id === agentId);
        if (!agent) {
          return textResult(`\u627E\u4E0D\u5230 agent "${agentId}"\u3002\u5F53\u524D\u56E2\u961F\u6210\u5458: ${plan.agents.map((a) => a.id).join(", ")}`);
        }
        const validation = validateSoulStructure(sanitized);
        if (!validation.valid) {
          return textResult(
            `"${agent.name}" \u7684 SOUL \u7F3A\u5C11\u5FC5\u8981\u7AE0\u8282\uFF1A${validation.missing.join("\u3001")}\u3002
\u8BF7\u8865\u5145\u540E\u91CD\u8BD5\u3002SOUL \u9700\u8981\u5305\u542B\uFF1A\u89D2\u8272\u5B9A\u4E49\u3001\u6838\u5FC3\u804C\u8D23\u3001\u884C\u4E3A\u51C6\u5219\u3001\u80FD\u529B\u8FB9\u754C\u3001\u534F\u4F5C\u6307\u4EE4\u3002`
          );
        }
        agent.soul = sanitized;
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        return textResult(`\u89E3\u6790 soulContents JSON \u5931\u8D25\uFF1A${e.message}`);
      }
      throw e;
    }
  }
  await savePlan(plan);
  const agentsWithSoul = plan.agents.filter((a) => a.soul && a.soul.length > 50);
  const agentsWithoutSoul = plan.agents.filter((a) => !a.soul || a.soul.length <= 50);
  const lines = [
    `\u65B9\u6848 "${planId}" \u5DF2\u66F4\u65B0\u3002
`,
    `\u56E2\u961F\u6210\u5458 (${plan.agents.length}):`
  ];
  for (const bp of plan.agents) {
    const hasSoul = bp.soul && bp.soul.length > 50;
    const status = hasSoul ? "[\u5DF2\u5B8C\u6210]" : "[\u5F85\u7F16\u5199]";
    lines.push(`  ${status} ${bp.name} (${bp.id}) \u2014 ${bp.role}`);
  }
  if (agentsWithoutSoul.length > 0) {
    lines.push("");
    lines.push(`\u8FD8\u6709 ${agentsWithoutSoul.length} \u4E2A\u6210\u5458\u9700\u8981\u7F16\u5199 SOUL\u3002`);
    for (const bp of agentsWithoutSoul) {
      const teammates = plan.agents.filter((a) => a.id !== bp.id).map((a) => ({ name: a.name, role: a.role }));
      lines.push("");
      lines.push(buildSoulGenerationPrompt(
        bp.name,
        bp.role,
        plan.userContext?.scenario ?? "general",
        teammates
      ));
    }
  } else {
    lines.push("");
    lines.push("\u6240\u6709\u6210\u5458\u7684\u5DE5\u4F5C\u6307\u5357\u5DF2\u5C31\u7EEA\u3002");
    lines.push(`
\u786E\u8BA4\u540E\u8C03\u7528 agents_orchestrate action="guided_deploy" planId="${planId}" \u8FDB\u884C\u90E8\u7F72\u3002`);
  }
  return textResult(lines.join("\n"));
}
async function handleGuidedDeploy(params, ctx, callGateway) {
  const planId = String(params.planId ?? "").trim();
  if (!planId) return textResult("\u9700\u8981\u63D0\u4F9B planId \u53C2\u6570\u3002");
  const plan = await loadPlan(planId);
  if (!plan) return textResult(`\u627E\u4E0D\u5230\u65B9\u6848 "${planId}"\u3002`);
  let state = await loadState(planId);
  if (!state) return textResult("\u627E\u4E0D\u5230\u65B9\u6848\u72B6\u6001\u3002");
  if (state.status !== "draft" && state.status !== "confirming") {
    return textResult(
      `\u65B9\u6848\u5F53\u524D\u72B6\u6001\u4E3A "${state.status}"\uFF0C\u65E0\u6CD5\u90E8\u7F72\u3002\u9700\u8981 draft \u6216 confirming \u72B6\u6001\u3002`
    );
  }
  const missingSoul = plan.agents.filter((a) => !a.soul || a.soul.length <= 50);
  if (missingSoul.length > 0) {
    return textResult(
      `\u4EE5\u4E0B\u6210\u5458\u8FD8\u6CA1\u6709 SOUL \u5DE5\u4F5C\u6307\u5357: ${missingSoul.map((a) => a.name).join("\u3001")}\u3002
\u8BF7\u5148\u8C03\u7528 guided_refine \u4F20\u5165 soulContents\u3002`
    );
  }
  const pluginConfig = ctx.config;
  const deployDiscovery = await discoverAll(ctx.workspaceDir).catch(() => void 0);
  for (const bp of plan.agents) {
    bp.inferredCapabilities = inferAgentCapabilities(
      bp,
      plan.userContext ?? { scenario: "general", channels: [], resources: [], volume: "medium", budget: "balanced" },
      pluginConfig,
      deployDiscovery
    );
  }
  const sceneCheck = verifyScene({
    requirement: plan.requirement,
    blueprints: plan.agents,
    userCtx: plan.userContext ?? { scenario: "general", channels: [], resources: [], volume: "medium", budget: "balanced" },
    discovery: deployDiscovery
  });
  plan.verification = {
    overallPass: sceneCheck.overallPass,
    score: sceneCheck.score,
    report: formatVerificationReport(sceneCheck)
  };
  await savePlan(plan);
  if (!sceneCheck.overallPass) {
    return textResult(
      `\u90E8\u7F72\u524D\u6821\u9A8C\u672A\u901A\u8FC7\uFF0C\u5B58\u5728\u5173\u952E\u95EE\u9898\u9700\u8981\u5148\u89E3\u51B3\uFF1A

` + plan.verification.report + `

\u8BF7\u8C03\u7528 guided_refine \u4FEE\u590D\u4E0A\u8FF0\u95EE\u9898\u540E\u91CD\u8BD5\u90E8\u7F72\u3002`
    );
  }
  state = { ...state, status: "deploying", deployStartedAt: (/* @__PURE__ */ new Date()).toISOString() };
  await saveState(state);
  const deployResult = await executeDeploySequence(plan, state, callGateway);
  const usageGuide = generateUsageGuide(plan);
  plan.usageGuide = usageGuide;
  await savePlan(plan);
  return textResult(formatGuidedDeployResult(plan, deployResult, usageGuide));
}
async function handleSceneVerify(params, ctx) {
  const planId = String(params.planId ?? "").trim();
  if (!planId) return textResult("\u9700\u8981\u63D0\u4F9B planId \u53C2\u6570\u3002");
  const plan = await loadPlan(planId);
  if (!plan) return textResult(`\u627E\u4E0D\u5230\u65B9\u6848 "${planId}"\u3002`);
  const discovery = await discoverAll(ctx.workspaceDir).catch(() => void 0);
  const userCtx = plan.userContext ?? {
    scenario: "general",
    channels: [],
    resources: [],
    volume: "medium",
    budget: "balanced"
  };
  const result = verifyScene({
    requirement: plan.requirement,
    blueprints: plan.agents,
    userCtx,
    discovery
  });
  plan.verification = {
    overallPass: result.overallPass,
    score: result.score,
    report: formatVerificationReport(result)
  };
  await savePlan(plan);
  return textResult(plan.verification.report);
}
function handleTemplates() {
  const templates = listTemplates();
  const text = formatTemplateList([...templates]);
  return textResult(text);
}
async function handlePlan(params, ctx) {
  const requirement = String(params.requirement ?? "").trim();
  const templateId = typeof params.templateId === "string" ? params.templateId.trim() : void 0;
  const blueprintsJson = typeof params.agentBlueprints === "string" ? params.agentBlueprints : void 0;
  const teamDescription = typeof params.teamDescription === "string" ? params.teamDescription.trim() : "Multi-agent team";
  if (!requirement) {
    return textResult("Error: requirement is required for the plan action.");
  }
  const currentModel = resolveCurrentModel(ctx);
  let modelWarning = "";
  if (currentModel) {
    const gate = checkModelEligibility(currentModel);
    if (!gate.eligible) {
      return textResult(
        `## Model Gate: Blocked

${gate.reason}

**Suggested models:**
${(gate.suggestions ?? []).map((s) => `- ${s}`).join("\n")}`
      );
    }
    if (gate.reason) {
      modelWarning = `> **Note:** ${gate.reason}

`;
    }
  }
  let matchedTemplate = templateId ? getTemplate(templateId) : void 0;
  if (!matchedTemplate) {
    matchedTemplate = matchTemplate(requirement);
  }
  let blueprints = [];
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
      'Error: No agentBlueprints provided and no template matched.\n\nYou need to generate agent blueprints. Call this tool with:\n- agentBlueprints: a JSON array of agent definitions\n- Each agent needs: name, id, role, soul (full SOUL.md content), emoji, modelTier ("cheap"|"mid"|"sota")\n\nOr specify a templateId to use a pre-built template.'
    );
  }
  for (const bp of blueprints) {
    if (!bp.tools || !bp.tools.allow || bp.tools.allow.length === 0) {
      bp.tools = recommendToolsForRole(bp.role, bp.name);
    }
  }
  const validationError = validateBlueprints(blueprints);
  if (validationError) return textResult(validationError);
  const planId = generatePlanId();
  const plan = {
    planId,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    requirement,
    templateId: matchedTemplate?.id,
    agents: blueprints,
    teamDescription,
    estimatedTokensPerTurn: blueprints.reduce(
      (sum, bp) => sum + estimateToolTokens(bp.tools),
      0
    ),
    mode: "manual"
  };
  await savePlan(plan);
  const state = createInitialState(plan);
  await saveState(state);
  return textResult(modelWarning + formatPlanSummary(plan, matchedTemplate?.id));
}
async function handleConfirm(params) {
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
  const confirmedState = {
    ...state,
    status: "deploying",
    deployStartedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await saveState(confirmedState);
  return textResult(
    `Plan "${planId}" confirmed. Ready for deployment.

Call agents_orchestrate with action="deploy" and planId="${planId}" to start creating agents.`
  );
}
async function handleDeploy(params, ctx, callGateway) {
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
      `Error: Plan "${planId}" is in status "${state.status}". Must be "deploying" (call confirm first).`
    );
  }
  const deployResult = await executeDeploySequence(plan, state, callGateway);
  const finalState = await loadState(planId);
  const lines = deployResult.agents.map((a) => {
    const bp = plan.agents.find((b) => b.id === a.agentId);
    const emoji = bp?.emoji ?? "";
    const statusMark = a.status === "ready" ? "[OK]" : "[FAIL]";
    return `  ${statusMark} ${emoji} **${a.name}** (\`${a.agentId}\`) \u2014 ${a.status}${a.error ? `: ${a.error}` : ""}`;
  });
  return textResult(
    `## Deployment \u2014 ${finalState?.status ?? "unknown"}

Plan: \`${planId}\`

### Agent Status
${lines.join("\n")}

` + (finalState?.status === "deployed" ? "All agents are ready. You can now use sessions_spawn to assign tasks to them." : `Some agents failed. Use action="status" to check details, or action="rollback" to clean up.`)
  );
}
async function handleStatus(params) {
  const planId = String(params.planId ?? "").trim();
  if (!planId) {
    return textResult("Error: planId is required for the status action.");
  }
  const plan = await loadPlan(planId);
  const state = await loadState(planId);
  if (!plan || !state) {
    return textResult(`Error: Plan "${planId}" not found.`);
  }
  const lines = [
    `## Orchestration Status: \`${planId}\`
`,
    `- Overall: **${state.status}**`,
    `- Team: ${plan.teamDescription}`,
    `- Mode: ${plan.mode ?? "manual"}`,
    `- Created: ${plan.createdAt}`,
    state.deployStartedAt ? `- Deploy started: ${state.deployStartedAt}` : "",
    state.deployFinishedAt ? `- Deploy finished: ${state.deployFinishedAt}` : "",
    state.error ? `- Error: ${state.error}` : "",
    "",
    "### Agents"
  ];
  for (const agent of state.agents) {
    const bp = plan.agents.find((a) => a.id === agent.blueprintId);
    const statusMark = agent.status === "ready" ? "[OK]" : agent.status === "failed" ? "[FAIL]" : "[...]";
    lines.push(
      `${statusMark} **${bp?.name ?? agent.agentId}** \u2014 ${agent.status}${agent.error ? ` (${agent.error})` : ""}`
    );
  }
  return textResult(lines.filter(Boolean).join("\n"));
}
async function handleValidate(params, callGateway) {
  const planId = String(params.planId ?? "").trim();
  if (!planId) {
    return textResult("Error: planId is required for the validate action.");
  }
  const plan = await loadPlan(planId);
  if (!plan) return textResult(`Error: Plan "${planId}" not found.`);
  const state = await loadState(planId);
  if (!state) return textResult(`Error: State for plan "${planId}" not found.`);
  const checks = [];
  const validStatuses = /* @__PURE__ */ new Set(["draft", "confirming", "deploying"]);
  const statusOk = validStatuses.has(state.status);
  checks.push({
    label: "Plan status",
    pass: statusOk,
    detail: statusOk ? state.status : `"${state.status}" is not deployable`
  });
  const conflicts = await detectConflicts(plan, callGateway);
  checks.push({
    label: "Agent ID conflicts",
    pass: conflicts.length === 0,
    detail: conflicts.length > 0 ? `Collisions: ${conflicts.join(", ")}` : "No conflicts"
  });
  const missingSoul = plan.agents.filter((a) => !a.soul || a.soul.length <= 50);
  checks.push({
    label: "SOUL content",
    pass: missingSoul.length === 0,
    detail: missingSoul.length > 0 ? `Missing for: ${missingSoul.map((a) => a.name).join(", ")}` : `All ${plan.agents.length} agents have SOUL`
  });
  const bpError = validateBlueprints(plan.agents);
  checks.push({
    label: "Blueprint validation",
    pass: bpError === null,
    detail: bpError ?? "Valid"
  });
  const deployActive = isDeployActive(planId);
  checks.push({
    label: "No active deploy",
    pass: !deployActive,
    detail: deployActive ? "Deploy already in progress" : "Clear"
  });
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
  const allPass = checks.every((c) => c.pass);
  const lines = [
    `## Deploy Validation: \`${planId}\`
`,
    allPass ? "Result: PASS -- ready for deployment" : "Result: FAIL -- issues found\n"
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
async function handleRollback(params, callGateway) {
  const planId = String(params.planId ?? "").trim();
  if (!planId) {
    return textResult("Error: planId is required for the rollback action.");
  }
  const plan = await loadPlan(planId);
  let state = await loadState(planId);
  if (!plan || !state) {
    return textResult(`Error: Plan "${planId}" not found.`);
  }
  const activeJob = activeDeployJobs.get(planId);
  if (activeJob) {
    activeJob.abort();
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  emitDiagnosticEvent({ type: "orchestrator.rollback", planId, phase: "start" });
  const results = [];
  const failures = [];
  let deletedCount = 0;
  for (const agent of state.agents) {
    if (agent.status === "pending") continue;
    const did = deployAgentId(planId, agent.blueprintId);
    try {
      await callGateway("agents.delete", {
        agentId: did,
        deleteFiles: true
      });
      state = updateAgentStatus(state, agent.agentId, "pending");
      results.push(`  [DEL] **${agent.agentId}** (${did}) \u2014 deleted`);
      deletedCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${agent.agentId}: ${msg}`);
      results.push(`  [ERR] **${agent.agentId}** \u2014 delete failed: ${msg}`);
    }
  }
  const rolledBackState = { ...state, status: "rolled_back" };
  await saveState(rolledBackState);
  unregisterOrchestratedAgents(planId);
  emitDiagnosticEvent({ type: "orchestrator.rollback", planId, phase: "complete", deletedCount, failedCount: failures.length });
  let report = `## Rollback Complete

Plan: \`${planId}\`

${results.join("\n")}`;
  if (failures.length > 0) {
    report += `

**Warning:** ${failures.length} agent(s) failed to delete:
${failures.map((f) => `- ${f}`).join("\n")}`;
    report += `
These agents may need manual cleanup.`;
  }
  return textResult(report);
}
const activeDeployJobs = /* @__PURE__ */ new Map();
function isDeployActive(planId) {
  return activeDeployJobs.has(planId);
}
const orchestratedAgents = /* @__PURE__ */ new Map();
function registerOrchestratedAgents(plan, readyAgentIds) {
  const entries = [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  for (const bp of plan.agents) {
    if (!readyAgentIds.has(bp.id)) continue;
    entries.push({
      deployedId: deployAgentId(plan.planId, bp.id),
      localId: bp.id,
      planId: plan.planId,
      name: bp.name,
      role: bp.role,
      deployedAt: now
    });
  }
  if (entries.length > 0) {
    orchestratedAgents.set(plan.planId, entries);
  }
}
function unregisterOrchestratedAgents(planId) {
  orchestratedAgents.delete(planId);
}
function listOrchestratedAgents() {
  const all = [];
  for (const entries of orchestratedAgents.values()) {
    all.push(...entries);
  }
  return all;
}
function listOrchestratedAgentsForPlan(planId) {
  return orchestratedAgents.get(planId) ?? [];
}
function deployAgentId(planId, localId) {
  return `${planId}--${localId}`;
}
async function detectConflicts(plan, callGateway) {
  try {
    const existing = await callGateway("agents.list", {});
    if (!Array.isArray(existing)) return [];
    const existingIds = new Set(existing.map((a) => a.id).filter(Boolean));
    const conflicts = [];
    for (const bp of plan.agents) {
      const did = deployAgentId(plan.planId, bp.id);
      if (existingIds.has(did)) {
        conflicts.push(did);
      }
    }
    return conflicts;
  } catch {
    return [];
  }
}
function generateTeamAgentsMd(bp, plan) {
  const teammates = plan.agents.filter((a) => a.id !== bp.id);
  const teammateLines = teammates.map(
    (t) => `- **${t.name}** (${t.emoji ?? ""}): ${t.role}`
  );
  return [
    `# AGENTS.md \u2014 ${bp.name}`,
    "",
    `> \u4F60\u662F\u300C${plan.teamName ?? "\u667A\u80FD\u56E2\u961F"}\u300D\u7684\u6210\u5458\u3002`,
    "",
    "## \u4F60\u7684\u804C\u8D23",
    "",
    bp.role,
    "",
    "## \u6BCF\u6B21\u5BF9\u8BDD",
    "",
    "1. \u8BFB\u53D6 `SOUL.md` \u2014 \u4F60\u7684\u5B8C\u6574\u884C\u4E3A\u51C6\u5219",
    "2. \u8BFB\u53D6 `TOOLS.md` \u2014 \u4F60\u53EF\u7528\u7684\u5DE5\u5177\u8BF4\u660E",
    "3. \u4E13\u6CE8\u4E8E\u81EA\u5DF1\u7684\u804C\u8D23\u8303\u56F4\uFF0C\u4E0D\u8981\u8D8A\u754C",
    "",
    "## \u56E2\u961F\u6210\u5458",
    "",
    ...teammateLines,
    "",
    "## \u534F\u4F5C\u89C4\u5219",
    "",
    "- \u9047\u5230\u8D85\u51FA\u81EA\u5DF1\u804C\u8D23\u8303\u56F4\u7684\u8BF7\u6C42\uFF0C\u660E\u786E\u544A\u77E5\u7528\u6237\u5E94\u8BE5\u627E\u54EA\u4E2A\u961F\u53CB",
    "- \u4E0D\u8981\u5C1D\u8BD5\u5B8C\u6210\u5176\u4ED6\u961F\u53CB\u7684\u4EFB\u52A1",
    "- \u4FDD\u6301\u56DE\u590D\u7B80\u6D01\uFF0C\u4E13\u6CE8\u4E8E\u4F60\u64C5\u957F\u7684\u9886\u57DF",
    "",
    "## \u534F\u4F5C\u901A\u4FE1",
    "",
    "- \u5F53 Supervisor \u901A\u8FC7 `sessions_send` \u7ED9\u4F60\u53D1\u4EFB\u52A1\u65F6\uFF0C\u4E13\u6CE8\u5B8C\u6210\u5E76\u76F4\u63A5\u56DE\u590D\u7ED3\u679C",
    "- \u5982\u679C\u4EFB\u52A1\u8D85\u51FA\u4F60\u7684\u80FD\u529B\uFF0C\u8BF4\u660E\u539F\u56E0\u5E76\u5EFA\u8BAE\u8F6C\u4EA4\u7ED9\u54EA\u4E2A\u961F\u53CB",
    "- \u4F60\u53EF\u4EE5\u4F7F\u7528 `sessions_send` \u5DE5\u5177\u5411\u961F\u53CB\u6216 Supervisor \u53D1\u6D88\u606F",
    "- \u5B8C\u6210\u4EFB\u52A1\u540E\uFF0C\u7B80\u6D01\u5730\u6C47\u62A5\u7ED3\u679C\uFF0C\u4E0D\u8981\u91CD\u590D\u4EFB\u52A1\u63CF\u8FF0",
    "- \u5982\u679C\u4F60\u9700\u8981\u5176\u4ED6\u961F\u53CB\u7684\u8F93\u5165\u624D\u80FD\u5B8C\u6210\u4EFB\u52A1\uFF0C\u76F4\u63A5\u53D1\u6D88\u606F\u7ED9\u4ED6\u4EEC",
    ""
  ].join("\n");
}
function generateTeamToolsMd(bp) {
  const sections = [
    `# TOOLS.md \u2014 ${bp.name} \u5DE5\u5177\u8BF4\u660E`,
    ""
  ];
  if (bp.tools.allow?.length) {
    sections.push("## \u53EF\u7528\u5DE5\u5177\u7EC4");
    sections.push("");
    for (const tool of bp.tools.allow) {
      sections.push(`- \`${tool}\``);
    }
    sections.push("");
  }
  if (bp.tools.skills?.length) {
    sections.push("## \u5DF2\u542F\u7528\u6280\u80FD");
    sections.push("");
    for (const skill of bp.tools.skills) {
      sections.push(`- \`${skill}\``);
    }
    sections.push("");
  }
  if (bp.tools.deny?.length) {
    sections.push("## \u7981\u7528\u5DE5\u5177");
    sections.push("");
    for (const tool of bp.tools.deny) {
      sections.push(`- \`${tool}\``);
    }
    sections.push("");
  }
  if (bp.tools.profile) {
    sections.push(`## \u5DE5\u5177\u914D\u7F6E`);
    sections.push("");
    sections.push(`\u9884\u8BBE: \`${bp.tools.profile}\``);
    sections.push("");
  }
  sections.push("---");
  sections.push("");
  sections.push("\u5177\u4F53\u5DE5\u5177\u7684\u4F7F\u7528\u65B9\u6CD5\u8BF7\u53C2\u8003\u5BF9\u5E94\u6280\u80FD\u7684 SKILL.md\u3002");
  return sections.join("\n");
}
async function executeDeploySequence(plan, initialState, callGateway, retryFailed = false) {
  const abortCtrl = new AbortController();
  activeDeployJobs.set(plan.planId, abortCtrl);
  try {
    return await executeDeploySequenceInner(plan, initialState, callGateway, abortCtrl.signal, retryFailed);
  } finally {
    activeDeployJobs.delete(plan.planId);
  }
}
async function executeDeploySequenceInner(plan, initialState, callGateway, signal, retryFailed = false) {
  let state = initialState;
  const results = [];
  const deployed = /* @__PURE__ */ new Set();
  const alreadyReadyIds = /* @__PURE__ */ new Set();
  if (retryFailed) {
    for (const a of state.agents) {
      if (a.status === "ready") {
        alreadyReadyIds.add(a.agentId);
        deployed.add(a.agentId);
      }
    }
  }
  const agentQueue = retryFailed ? plan.agents.filter((bp) => !alreadyReadyIds.has(bp.id)) : [...plan.agents];
  let maxIterations = agentQueue.length * 2;
  emitDiagnosticEvent({ type: "orchestrator.deploy", planId: plan.planId, phase: "start", agentCount: plan.agents.length });
  const conflicts = await detectConflicts(plan, callGateway);
  const conflictsToRemove = retryFailed ? conflicts.filter((cid) => {
    const localId = cid.split("--").slice(1).join("--");
    return !alreadyReadyIds.has(localId);
  }) : conflicts;
  if (conflictsToRemove.length > 0) {
    emitDiagnosticEvent({ type: "orchestrator.deploy", planId: plan.planId, phase: "conflict-cleanup", agents: conflictsToRemove.join(",") });
    for (const conflictId of conflictsToRemove) {
      try {
        await callGateway("agents.remove", { agentId: conflictId });
      } catch {
        const msg = `\u65E0\u6CD5\u6E05\u9664\u51B2\u7A81 agent "${conflictId}"\uFF0C\u8BF7\u5148\u624B\u52A8\u5220\u9664\u6216 rollback \u65E7\u65B9\u6848\u3002`;
        state = { ...state, status: "failed", error: msg };
        await saveState(state);
        for (const bp of plan.agents) {
          results.push({ agentId: bp.id, name: bp.name, status: "failed", error: msg });
        }
        return { planId: plan.planId, agents: results, finalStatus: "failed" };
      }
    }
  }
  const pendingConfigPatches = [];
  if (retryFailed) {
    for (const bp of plan.agents) {
      if (alreadyReadyIds.has(bp.id)) {
        pendingConfigPatches.push({ bp, deployedId: deployAgentId(plan.planId, bp.id) });
        results.push({ agentId: bp.id, name: bp.name, status: "ready" });
      }
    }
  }
  let aborted = false;
  while (agentQueue.length > 0 && maxIterations-- > 0) {
    if (signal.aborted) {
      emitDiagnosticEvent({ type: "orchestrator.deploy", planId: plan.planId, phase: "cancelled" });
      state = { ...state, status: "cancelled" };
      await saveState(state);
      return { planId: plan.planId, agents: results, finalStatus: "cancelled" };
    }
    const nextBatch = [];
    const deferred = [];
    for (const bp of agentQueue) {
      const deps = bp.dependsOn ?? [];
      const depsReady = deps.every((d) => deployed.has(d));
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
      const did = deployAgentId(plan.planId, bp.id);
      state = updateAgentStatus(state, bp.id, "creating");
      await saveState(state);
      let agentCreated = false;
      try {
        await callGateway("agents.create", {
          name: bp.name,
          id: did,
          emoji: bp.emoji,
          workspace: resolveAgentWorkspace(did)
        });
        agentCreated = true;
        state = updateAgentStatus(state, bp.id, "writing_soul");
        await saveState(state);
        await callGateway("agents.files.set", {
          agentId: did,
          name: "SOUL.md",
          content: bp.soul
        });
        await Promise.all([
          callGateway("agents.files.set", {
            agentId: did,
            name: "AGENTS.md",
            content: generateTeamAgentsMd(bp, plan)
          }),
          callGateway("agents.files.set", {
            agentId: did,
            name: "TOOLS.md",
            content: generateTeamToolsMd(bp)
          }),
          // Team agents don't need first-run onboarding — their identity is
          // already defined by the blueprint.  Overwrite with a no-op stub
          // so the workspace doesn't trigger the BOOTSTRAP flow.
          callGateway("agents.files.set", {
            agentId: did,
            name: "BOOTSTRAP.md",
            content: `# \u5DF2\u7531\u667A\u80FD\u7EC4\u961F\u81EA\u52A8\u914D\u7F6E

\u6B64 agent \u7531\u300C${plan.teamName ?? "\u667A\u80FD\u56E2\u961F"}\u300D\u7F16\u6392\u5668\u521B\u5EFA\uFF0C\u65E0\u9700\u624B\u52A8\u5F15\u5BFC\u3002
`
          })
        ]);
        state = updateAgentStatus(state, bp.id, "configuring");
        await saveState(state);
        pendingConfigPatches.push({ bp, deployedId: did });
        state = updateAgentStatus(state, bp.id, "ready");
        await saveState(state);
        deployed.add(bp.id);
        results.push({ agentId: bp.id, name: bp.name, status: "ready" });
        emitDiagnosticEvent({ type: "orchestrator.deploy", planId: plan.planId, phase: "agent_ready", agentId: bp.id });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (agentCreated) {
          try {
            await callGateway("agents.delete", { agentId: did, deleteFiles: true });
          } catch {
          }
        }
        state = updateAgentStatus(state, bp.id, "failed", msg);
        await saveState(state);
        results.push({ agentId: bp.id, name: bp.name, status: "failed", error: msg });
        emitDiagnosticEvent({ type: "orchestrator.deploy", planId: plan.planId, phase: "failed", agentId: bp.id, error: msg });
        if (plan.onAgentFail === "abort") {
          aborted = true;
          state = { ...state, status: "failed", error: `Aborted after ${bp.name} failed: ${msg}` };
          await saveState(state);
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
  if (pendingConfigPatches.length > 0 && !signal.aborted && !aborted) {
    try {
      const mergedList = [];
      for (const { bp, deployedId } of pendingConfigPatches) {
        const patch = buildFullConfigPatch(bp, deployedId);
        if (patch) {
          const list = patch.agents?.list;
          if (Array.isArray(list)) {
            mergedList.push(...list);
          }
        }
      }
      if (mergedList.length > 0) {
        const snapshot = await callGateway("config.get", {});
        const baseHash = snapshot?.hash;
        await callGateway("config.patch", {
          raw: JSON.stringify({ agents: { list: mergedList } }),
          ...baseHash ? { baseHash } : {}
        });
      }
    } catch (err) {
      const msg = `Config patch failed: ${err instanceof Error ? err.message : String(err)}`;
      for (const { bp, deployedId } of pendingConfigPatches) {
        state = updateAgentStatus(state, bp.id, "failed", msg);
        const idx = results.findIndex((r) => r.agentId === bp.id && r.status === "ready");
        if (idx >= 0) results[idx] = { agentId: bp.id, name: bp.name, status: "failed", error: msg };
        if (!alreadyReadyIds.has(bp.id)) {
          try {
            await callGateway("agents.delete", { agentId: deployedId, deleteFiles: true });
          } catch {
          }
        }
      }
      await saveState(state);
    }
  }
  const latestState = await loadState(plan.planId);
  let willBeDeployed = false;
  if (latestState && latestState.status === "deploying") {
    const allReady = latestState.agents.every((a) => a.status === "ready");
    if (allReady) willBeDeployed = true;
  } else if (latestState && latestState.status === "deployed") {
    willBeDeployed = true;
  }
  const readyCount = results.filter((r) => r.status === "ready").length;
  if (readyCount > 0) {
    const readyIds = new Set(results.filter((r) => r.status === "ready").map((r) => r.agentId));
    registerOrchestratedAgents(plan, readyIds);
  }
  if (willBeDeployed) {
    let projectCreated = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const createResult = await callGateway("team.project.createFromPlan", { planId: plan.planId });
        projectCreated = true;
        if (createResult?.report) {
          try {
            const { saveReport } = await import("./state.js");
            await saveReport(plan.planId, createResult.report);
          } catch {
          }
        }
        break;
      } catch (err) {
        emitDiagnosticEvent({
          type: "orchestrator.deploy",
          planId: plan.planId,
          phase: "project-create-failed",
          error: `attempt ${attempt}/3: ${String(err)}`
        });
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1e3 * attempt));
        }
      }
    }
    if (!projectCreated) {
      emitDiagnosticEvent({
        type: "orchestrator.deploy",
        planId: plan.planId,
        phase: "project-create-exhausted",
        error: "All 3 attempts to create team project failed"
      });
    }
  }
  if (willBeDeployed && latestState && latestState.status === "deploying") {
    await saveState({ ...latestState, status: "deployed", deployFinishedAt: (/* @__PURE__ */ new Date()).toISOString() });
  }
  const finalStatus = (await loadState(plan.planId))?.status ?? "failed";
  emitDiagnosticEvent({
    type: "orchestrator.deploy",
    planId: plan.planId,
    phase: finalStatus === "deployed" ? "complete" : "failed",
    agentCount: readyCount,
    error: finalStatus !== "deployed" ? `${results.length - readyCount} agent(s) failed` : void 0
  });
  return { planId: plan.planId, agents: results, finalStatus };
}
function textResult(text) {
  return {
    content: [{ type: "text", text }],
    details: { text }
  };
}
function resolveCurrentModel(ctx) {
  const cfg = ctx.config;
  const agents = cfg?.agents;
  const defaults = agents?.defaults;
  const model = defaults?.model;
  let modelRef;
  if (typeof model === "string") {
    modelRef = model;
  } else if (typeof model === "object" && model !== null) {
    const primary = model.primary;
    if (typeof primary === "string") {
      modelRef = primary;
    }
  }
  if (!modelRef) return void 0;
  const slashIdx = modelRef.indexOf("/");
  return slashIdx >= 0 ? modelRef.slice(slashIdx + 1) : modelRef;
}
function resolveAgentWorkspace(agentId) {
  return `~/agents/${agentId}`;
}
function normalizeBlueprint(raw) {
  const name = String(raw.name ?? "").trim();
  const id = String(raw.id ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  const role = String(raw.role ?? "").trim();
  const soul = String(raw.soul ?? "").trim();
  const emoji = typeof raw.emoji === "string" ? raw.emoji.trim() : void 0;
  const rawTier = String(raw.modelTier ?? "mid").trim();
  const VALID_TIERS = /* @__PURE__ */ new Set(["cheap", "mid", "sota"]);
  const modelTier = VALID_TIERS.has(rawTier) ? rawTier : "mid";
  const dependsOn = Array.isArray(raw.dependsOn) ? raw.dependsOn.filter((d) => typeof d === "string") : void 0;
  const resolvedName = name || id || "agent";
  const resolvedId = id || name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "agent";
  return {
    name: resolvedName,
    id: resolvedId,
    role: role || `Agent: ${resolvedName}`,
    soul: soul || `# SOUL \u2014 ${resolvedName}

${role || resolvedName}`,
    emoji,
    modelTier,
    tools: {},
    dependsOn
  };
}
function deepCloneBlueprints(agents) {
  return agents.map((a) => ({
    ...a,
    tools: {
      ...a.tools,
      allow: a.tools.allow ? [...a.tools.allow] : void 0,
      deny: a.tools.deny ? [...a.tools.deny] : void 0,
      skills: a.tools.skills ? [...a.tools.skills] : void 0,
      mcpServers: a.tools.mcpServers ? [...a.tools.mcpServers] : void 0
    },
    dependsOn: a.dependsOn ? [...a.dependsOn] : void 0
  }));
}
function validateBlueprints(blueprints) {
  if (blueprints.length > 10) {
    return `Error: Too many agents (${blueprints.length}). Maximum is 10. Consider consolidating.`;
  }
  if (blueprints.length === 0) {
    return "Error: No agents defined in the plan.";
  }
  for (const bp of blueprints) {
    if (!bp.id || bp.id === "-" || bp.id.replace(/-/g, "").length === 0) {
      return `Error: Agent "${bp.name}" has an invalid id "${bp.id}". IDs must contain at least one alphanumeric character.`;
    }
    if (bp.id === "main") {
      return `Error: Agent id "main" is reserved. Choose a different id.`;
    }
  }
  const idSet = /* @__PURE__ */ new Set();
  for (const bp of blueprints) {
    if (idSet.has(bp.id)) {
      return `Error: Duplicate agent id "${bp.id}". Each agent must have a unique id.`;
    }
    idSet.add(bp.id);
  }
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
  const visited = /* @__PURE__ */ new Set();
  const visiting = /* @__PURE__ */ new Set();
  const depsMap = new Map(blueprints.map((bp) => [bp.id, bp.dependsOn ?? []]));
  function hasCycle(id) {
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
function applyAdjustments(plan, adjustments) {
  for (const adj of adjustments) {
    const agentId = String(adj.id ?? "");
    const action = String(adj.action ?? "update");
    if (action === "remove") {
      plan.agents = plan.agents.filter((a) => a.id !== agentId);
      continue;
    }
    if (action === "add") {
      const newAgent = normalizeBlueprint(adj);
      plan.agents.push(newAgent);
      continue;
    }
    const agent = plan.agents.find((a) => a.id === agentId);
    if (agent) {
      if (typeof adj.name === "string") agent.name = adj.name;
      if (typeof adj.role === "string") agent.role = adj.role;
      if (typeof adj.modelTier === "string") {
        const validTiers = ["cheap", "mid", "sota"];
        const tier = adj.modelTier;
        if (validTiers.includes(tier)) {
          agent.modelTier = tier;
        }
      }
    }
  }
}
function buildFullConfigPatch(bp, deployedId) {
  const cap = bp.inferredCapabilities;
  const agentId = deployedId ?? bp.id;
  if (!cap) {
    return buildToolsOnlyConfigPatch(bp, agentId);
  }
  const agentEntry = { id: agentId };
  if (cap.model?.primary) {
    agentEntry.model = cap.model.fallbacks?.length ? { primary: cap.model.primary, fallbacks: cap.model.fallbacks } : cap.model.primary;
  }
  const tools = {};
  if (cap.tools.profile) tools.profile = cap.tools.profile;
  if (cap.tools.allow?.length) tools.allow = cap.tools.allow;
  if (cap.tools.alsoAllow?.length) tools.alsoAllow = cap.tools.alsoAllow;
  if (cap.tools.deny?.length) tools.deny = cap.tools.deny;
  if (Object.keys(tools).length) agentEntry.tools = tools;
  if (cap.skills?.length) agentEntry.skills = cap.skills;
  if (cap.memorySearch?.enabled) agentEntry.memorySearch = cap.memorySearch;
  if (cap.identity) agentEntry.identity = cap.identity;
  if (cap.subagents) agentEntry.subagents = cap.subagents;
  if (cap.heartbeat?.every) agentEntry.heartbeat = cap.heartbeat;
  if (Object.keys(agentEntry).length <= 1) return void 0;
  return { agents: { list: [agentEntry] } };
}
function buildToolsOnlyConfigPatch(bp, deployedId) {
  const toolsCfg = {};
  if (bp.tools.allow?.length) toolsCfg.allow = bp.tools.allow;
  if (bp.tools.deny?.length) toolsCfg.deny = bp.tools.deny;
  if (bp.tools.profile) toolsCfg.profile = bp.tools.profile;
  if (Object.keys(toolsCfg).length === 0) return void 0;
  return { agents: { list: [{ id: deployedId ?? bp.id, tools: toolsCfg }] } };
}
function formatQuickDeployResult(plan, result, usageGuide) {
  const allOk = result.agents.every((a) => a.status === "ready");
  const failed = result.agents.filter((a) => a.status === "failed");
  if (!allOk) {
    const failedNames = failed.map((a) => a.name).join("\u3001");
    return `\u90E8\u7F72\u8FC7\u7A0B\u4E2D\u9047\u5230\u95EE\u9898\u3002

\u4EE5\u4E0B\u6210\u5458\u90E8\u7F72\u5931\u8D25: ${failedNames}
` + failed.map((a) => `  ${a.name}: ${a.error}`).join("\n") + `

\u53EF\u4EE5\u8C03\u7528 action="rollback" planId="${plan.planId}" \u6E05\u7406\u540E\u91CD\u8BD5\u3002`;
  }
  const lines = [];
  lines.push("\u56E2\u961F\u5DF2\u4E0A\u7EBF\uFF01\n");
  lines.push(usageGuide);
  return lines.join("\n");
}
function formatProposalForUser(plan) {
  const lines = [];
  lines.push(`\u63A8\u8350\u4EE5\u4E0B\u56E2\u961F\u65B9\u6848\uFF1A
`);
  lines.push(`planId: ${plan.planId}
`);
  for (const bp of plan.agents) {
    const initial = bp.name.charAt(0);
    lines.push(`[${initial}] ${bp.name}`);
    lines.push(`    ${bp.role}`);
    lines.push("");
  }
  const cost = estimateTeamDailyCost(plan.agents, plan.userContext?.volume ?? "medium");
  if (cost > 0) {
    lines.push(`\u9884\u4F30\u65E5\u5747\u6210\u672C: \u7EA6 ${formatCostRange(cost)}`);
    lines.push("");
  }
  lines.push("\u9700\u8981\u8C03\u6574\u5417\uFF1F\u53EF\u4EE5\u589E\u51CF\u6210\u5458\u3001\u4FEE\u6539\u804C\u8D23\uFF0C\u6216\u76F4\u63A5\u786E\u8BA4\u3002");
  lines.push(`\u786E\u8BA4\u540E\uFF0C\u6211\u6765\u4E3A\u6BCF\u4E2A\u6210\u5458\u7F16\u5199\u8BE6\u7EC6\u7684\u5DE5\u4F5C\u6307\u5357\uFF08SOUL\uFF09\u3002`);
  return lines.join("\n");
}
function formatGuidedDeployResult(plan, result, usageGuide) {
  const allOk = result.agents.every((a) => a.status === "ready");
  const failed = result.agents.filter((a) => a.status === "failed");
  if (!allOk) {
    const failedNames = failed.map((a) => a.name).join("\u3001");
    return `\u90E8\u7F72\u8FC7\u7A0B\u4E2D\u9047\u5230\u95EE\u9898\u3002

\u4EE5\u4E0B\u6210\u5458\u90E8\u7F72\u5931\u8D25: ${failedNames}
` + failed.map((a) => `  ${a.name}: ${a.error}`).join("\n") + `

\u53EF\u4EE5\u8C03\u7528 action="rollback" planId="${plan.planId}" \u6E05\u7406\u540E\u91CD\u8BD5\u3002`;
  }
  const lines = [];
  lines.push("\u56E2\u961F\u5DF2\u4E0A\u7EBF\uFF01\n");
  lines.push(usageGuide);
  return lines.join("\n");
}
function formatPlanSummary(plan, templateId) {
  const lines = [
    `## Orchestration Plan: \`${plan.planId}\`
`,
    `**Team:** ${plan.teamDescription}`,
    templateId ? `**Template:** \`${templateId}\`` : "**Template:** Custom",
    `**Requirement:** ${plan.requirement.slice(0, 200)}${plan.requirement.length > 200 ? "..." : ""}`,
    "",
    `### Agents (${plan.agents.length})`,
    ""
  ];
  for (const bp of plan.agents) {
    const emoji = bp.emoji ?? "";
    const tools = bp.tools.allow?.join(", ") ?? "default";
    const deps = bp.dependsOn?.length ? ` (depends on: ${bp.dependsOn.join(", ")})` : "";
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
    `**Confirm?** Call \`agents_orchestrate\` with action="confirm" and planId="${plan.planId}"`
  );
  lines.push(
    'You can also modify the plan by calling action="plan" again with adjusted agentBlueprints.'
  );
  return lines.join("\n");
}
function formatTokens(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
async function performQuickDeploy(callGw, opts) {
  const requirement = (opts.requirement ?? "").trim();
  const template = opts.templateId ? getTemplate(opts.templateId) : matchTemplate(requirement);
  if (!template) {
    return { error: "No matching template found", matched: false };
  }
  const blueprints = deepCloneBlueprints(template.agents);
  const defaultContext = {
    scenario: template.category ?? "general",
    channels: [],
    resources: [],
    volume: "medium",
    budget: "balanced"
  };
  const legacyDiscovery = await discoverAll(process.cwd()).catch(() => void 0);
  for (const bp of blueprints) {
    bp.inferredCapabilities = inferAgentCapabilities(bp, defaultContext, void 0, legacyDiscovery);
  }
  const planId = generatePlanId();
  const plan = {
    planId,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    requirement,
    templateId: template.id,
    agents: blueprints,
    teamName: template.name,
    teamDescription: template.description,
    mode: "template",
    userContext: defaultContext
  };
  await savePlan(plan);
  const state = createInitialState(plan);
  state.status = "deploying";
  state.deployStartedAt = (/* @__PURE__ */ new Date()).toISOString();
  await saveState(state);
  if (isDeployActive(planId)) {
    return { planId, status: "deploying" };
  }
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
async function performGuidedPropose(callGw, requirement, userContextJson) {
  let userContext;
  try {
    const parsed = JSON.parse(userContextJson || "{}");
    userContext = {
      scenario: String(parsed.scenario ?? "general"),
      channels: Array.isArray(parsed.channels) ? parsed.channels : [],
      resources: Array.isArray(parsed.resources) ? parsed.resources : [],
      volume: parsed.volume ?? "medium",
      budget: parsed.budget ?? "balanced"
    };
  } catch {
    userContext = { scenario: "general", channels: [], resources: [], volume: "medium", budget: "balanced" };
  }
  const template = matchTemplate(requirement);
  let blueprints;
  let teamDescription;
  if (template) {
    blueprints = deepCloneBlueprints(template.agents);
    teamDescription = template.description;
    userContext.scenario = template.category ?? userContext.scenario;
  } else {
    blueprints = generateDefaultTeam(requirement, userContext);
    teamDescription = requirement;
  }
  const confirmDiscovery = await discoverAll(process.cwd()).catch(() => void 0);
  for (const bp of blueprints) {
    bp.inferredCapabilities = inferAgentCapabilities(bp, userContext, void 0, confirmDiscovery);
    if (!bp.tools || !bp.tools.allow || bp.tools.allow.length === 0) {
      bp.tools = recommendToolsForRole(bp.role, bp.name);
    }
  }
  const planId = generatePlanId();
  const teamName = template?.name ?? "\u5B9A\u5236\u56E2\u961F";
  const plan = {
    planId,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    requirement,
    templateId: template?.id,
    agents: blueprints,
    teamName,
    teamDescription,
    mode: "guided",
    userContext
  };
  await savePlan(plan);
  const state = createInitialState(plan);
  state.status = "draft";
  await saveState(state);
  const cost = estimateTeamDailyCost(blueprints, userContext.volume);
  return {
    planId,
    teamName,
    teamDescription,
    agents: blueprints.map((bp) => ({
      id: bp.id,
      name: bp.name,
      role: bp.role,
      emoji: bp.emoji,
      modelTier: bp.modelTier,
      tools: bp.tools.allow ?? []
    })),
    costEstimate: cost > 0 ? formatCostRange(cost) : void 0
  };
}
function generateDefaultTeam(requirement, userContext) {
  const lower = requirement.toLowerCase();
  const ROLE_CANDIDATES = [
    {
      name: "\u6587\u6848\u5199\u624B",
      id: "copywriter",
      pattern: /写|文案|内容|创作|copy|writing|content/i,
      priority: 20,
      baseRole: "\u64B0\u5199\u548C\u4F18\u5316\u5404\u7C7B\u6587\u6848\u5185\u5BB9",
      modelTier: "mid",
      tools: { allow: ["group:web", "group:memory"] }
    },
    {
      name: "\u7F16\u7A0B\u52A9\u624B",
      id: "code-assistant",
      pattern: /代码|开发|编程|code|dev|program/i,
      priority: 15,
      baseRole: "\u7F16\u5199\u3001\u5BA1\u67E5\u548C\u8C03\u8BD5\u4EE3\u7801",
      modelTier: "mid",
      tools: { allow: ["group:web", "group:fs", "group:memory"], profile: "coding" }
    },
    {
      name: "\u6570\u636E\u5206\u6790\u5E08",
      id: "data-analyst",
      pattern: /数据|分析|报表|data|analy|统计/i,
      priority: 25,
      baseRole: "\u5206\u6790\u6570\u636E\u3001\u751F\u6210\u62A5\u8868\u548C\u53EF\u89C6\u5316",
      modelTier: "mid",
      tools: { allow: ["group:web", "group:memory", "group:fs"] }
    },
    {
      name: "\u5BA2\u670D\u4E13\u5458",
      id: "support-agent",
      pattern: /客服|support|答疑|咨询|接待|helpdesk/i,
      priority: 20,
      baseRole: "\u81EA\u52A8\u56DE\u7B54\u5BA2\u6237\u5E38\u89C1\u95EE\u9898\uFF0C\u5904\u7406\u54A8\u8BE2",
      modelTier: "cheap",
      tools: { allow: ["group:web", "group:memory"] }
    },
    {
      name: "\u7814\u7A76\u5458",
      id: "researcher",
      pattern: /研究|调研|research|报告|论文|paper/i,
      priority: 20,
      baseRole: "\u641C\u7D22\u8D44\u6599\u3001\u6574\u7406\u4FE1\u606F\u3001\u64B0\u5199\u7814\u7A76\u62A5\u544A",
      modelTier: "mid",
      tools: { allow: ["group:web", "group:memory"] }
    },
    {
      name: "\u7FFB\u8BD1\u4E13\u5458",
      id: "translator",
      pattern: /翻译|translate|双语|多语|本地化|locali[sz]/i,
      priority: 25,
      baseRole: "\u7FFB\u8BD1\u548C\u672C\u5730\u5316\u5404\u7C7B\u6587\u6863\u5185\u5BB9",
      modelTier: "mid",
      tools: { allow: ["group:web", "group:memory"] }
    },
    {
      name: "\u914D\u56FE\u52A9\u624B",
      id: "image-helper",
      pattern: /配图|图片|封面|插图|image|illustrat|画图|设计图/i,
      priority: 30,
      baseRole: "\u751F\u6210\u914D\u56FE\u3001\u5C01\u9762\u548C\u89C6\u89C9\u7D20\u6750",
      modelTier: "mid",
      tools: { allow: ["group:web", "group:memory"] }
    },
    {
      name: "\u65B0\u95FB\u91C7\u7F16",
      id: "news-editor",
      pattern: /新闻|资讯|热点|简报|news|briefing|早报/i,
      priority: 25,
      baseRole: "\u91C7\u96C6\u65B0\u95FB\u8D44\u8BAF\u3001\u7F16\u8F91\u7B80\u62A5",
      modelTier: "mid",
      tools: { allow: ["group:web", "group:memory"] }
    },
    {
      name: "\u65E5\u7A0B\u7BA1\u5BB6",
      id: "scheduler",
      pattern: /日程|日历|提醒|预约|schedule|calendar|remind|会议/i,
      priority: 30,
      baseRole: "\u7BA1\u7406\u65E5\u7A0B\u5B89\u6392\u548C\u5B9A\u65F6\u63D0\u9192",
      modelTier: "cheap",
      tools: { allow: ["group:memory"] }
    }
  ];
  const matched = [];
  for (const candidate of ROLE_CANDIDATES) {
    if (candidate.pattern.test(lower)) {
      const kwMatch = lower.match(candidate.pattern);
      const contextHint = kwMatch ? kwMatch[0] : "";
      const contextRole = enrichRoleFromRequirement(candidate.baseRole, requirement, contextHint);
      matched.push({ ...candidate, contextRole });
    }
  }
  matched.sort((a, b) => a.priority - b.priority);
  const team = [];
  if (matched.length === 0) {
    team.push({
      name: "\u4E3B\u529B\u52A9\u624B",
      id: "primary-assistant",
      role: "\u6838\u5FC3\u4EFB\u52A1\u5904\u7406\uFF0C\u8D1F\u8D23\u54CD\u5E94\u7528\u6237\u9700\u6C42\u548C\u6267\u884C\u4E3B\u8981\u5DE5\u4F5C",
      soul: buildMinimalSoul("\u4E3B\u529B\u52A9\u624B", "\u6838\u5FC3\u4EFB\u52A1\u5904\u7406\uFF0C\u8D1F\u8D23\u54CD\u5E94\u7528\u6237\u9700\u6C42\u548C\u6267\u884C\u4E3B\u8981\u5DE5\u4F5C"),
      modelTier: userContext.budget === "cheap" ? "cheap" : "mid",
      tools: { allow: ["group:web", "group:memory"], profile: "minimal" }
    });
  } else {
    for (const m of matched) {
      team.push({
        name: m.name,
        id: m.id,
        role: m.contextRole,
        soul: buildMinimalSoul(m.name, m.contextRole),
        modelTier: userContext.budget === "cheap" && m.modelTier === "mid" ? "cheap" : m.modelTier,
        tools: m.tools
      });
    }
  }
  const maxAgents = Math.min(6, Math.max(1, matched.length));
  return team.slice(0, maxAgents);
}
function enrichRoleFromRequirement(baseRole, requirement, keyword) {
  if (!keyword || requirement.length < 10) return baseRole;
  const idx = requirement.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return baseRole;
  const start = Math.max(0, idx - 15);
  const end = Math.min(requirement.length, idx + keyword.length + 15);
  let context = requirement.slice(start, end).trim();
  context = context.replace(/^[，。、；：！？\s,.:;!?]+|[，。、；：！？\s,.:;!?]+$/g, "");
  if (context.length < 4 || context === keyword) return baseRole;
  return `${baseRole}\uFF08\u7528\u6237\u9700\u6C42\uFF1A${context}\uFF09`;
}
function buildMinimalSoul(name, role) {
  return [
    `# SOUL \u2014 ${name}`,
    "",
    "## \u89D2\u8272",
    `\u4F60\u662F${name}\u3002${role}\u3002`,
    "",
    "## \u6838\u5FC3\u804C\u8D23",
    `- ${role}`,
    "- \u8BB0\u4F4F\u7528\u6237\u7684\u504F\u597D\u548C\u4E60\u60EF",
    "- \u4E3B\u52A8\u6C47\u62A5\u8FDB\u5C55",
    "",
    "## \u884C\u4E3A\u51C6\u5219",
    "- \u4FDD\u6301\u4E13\u4E1A\u3001\u7B80\u6D01",
    "- \u9047\u5230\u4E0D\u786E\u5B9A\u7684\u4E8B\u60C5\u5148\u786E\u8BA4\u518D\u884C\u52A8",
    "- \u4E0E\u56E2\u961F\u5176\u4ED6\u6210\u5458\u4FDD\u6301\u534F\u4F5C",
    "",
    "## \u80FD\u529B\u8FB9\u754C",
    "- \u9700\u8981\u65F6\u8BF7\u6C42\u56E2\u961F\u5176\u4ED6\u6210\u5458\u534F\u52A9",
    "- \u4E0D\u505A\u8D85\u51FA\u804C\u8D23\u8303\u56F4\u7684\u51B3\u5B9A",
    "",
    "## \u534F\u4F5C\u6307\u4EE4",
    "- \u914D\u5408\u56E2\u961F\u6210\u5458\u5B8C\u6210\u8DE8\u9886\u57DF\u4EFB\u52A1"
  ].join("\n");
}
async function performGuidedDeploy(callGw, planId, retryFailed = false) {
  const plan = await loadPlan(planId);
  if (!plan) return { error: `Plan "${planId}" not found` };
  let state = await loadState(planId);
  if (!state) return { error: "Plan state not found" };
  const allowedStatuses = retryFailed ? ["draft", "confirming", "failed"] : ["draft", "confirming"];
  if (!allowedStatuses.includes(state.status)) {
    return { error: `Plan status is "${state.status}", expected ${allowedStatuses.join(" or ")}` };
  }
  if (isDeployActive(planId)) {
    return { planId, status: "deploying" };
  }
  if (retryFailed) {
    state = {
      ...state,
      agents: state.agents.map(
        (a) => a.status === "failed" ? { ...a, status: "pending", error: void 0 } : a
      ),
      error: void 0
    };
  }
  state = { ...state, status: "deploying", deployStartedAt: state.deployStartedAt ?? (/* @__PURE__ */ new Date()).toISOString() };
  await saveState(state);
  void (async () => {
    try {
      await executeDeploySequence(plan, state, callGw, retryFailed);
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
async function validatePlanForDeploy(callGw, planId) {
  const plan = await loadPlan(planId);
  if (!plan) return { valid: false, checks: [{ label: "Plan exists", pass: false, detail: "Not found" }] };
  const state = await loadState(planId);
  if (!state) return { valid: false, checks: [{ label: "State exists", pass: false, detail: "Not found" }] };
  const checks = [];
  const validStatuses = /* @__PURE__ */ new Set(["draft", "confirming", "deploying"]);
  checks.push({
    label: "Plan status",
    pass: validStatuses.has(state.status),
    detail: state.status
  });
  const conflicts = await detectConflicts(plan, callGw);
  checks.push({
    label: "Agent ID conflicts",
    pass: conflicts.length === 0,
    detail: conflicts.length > 0 ? conflicts.join(", ") : "None"
  });
  const missingSoul = plan.agents.filter((a) => !a.soul || a.soul.length <= 50);
  checks.push({
    label: "SOUL content",
    pass: missingSoul.length === 0,
    detail: missingSoul.length > 0 ? `Missing: ${missingSoul.map((a) => a.name).join(", ")}` : "Complete"
  });
  const bpError = validateBlueprints(plan.agents);
  checks.push({ label: "Blueprints", pass: bpError === null, detail: bpError ?? "Valid" });
  checks.push({
    label: "No active deploy",
    pass: !isDeployActive(planId),
    detail: isDeployActive(planId) ? "In progress" : "Clear"
  });
  return { valid: checks.every((c) => c.pass), checks };
}
export {
  createOrchestrateTool,
  deepCloneBlueprints,
  deployAgentId,
  isDeployActive,
  listOrchestratedAgents,
  listOrchestratedAgentsForPlan,
  performGuidedDeploy,
  performGuidedPropose,
  performQuickDeploy,
  validatePlanForDeploy
};
