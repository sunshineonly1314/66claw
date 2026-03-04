/**
 * Orchestrator Plugin — Entry Point
 *
 * Registers the agents_orchestrate tool, system prompt hook,
 * gateway methods, and the orchestration monitor service.
 *
 * Zero invasion: all orchestration logic lives in this plugin.
 * The main codebase only needs to load this plugin directory.
 */

import type { OpenClawCNPluginDefinition, OpenClawCNPluginApi } from "../../src/plugins/types.js";
import { createOrchestrateTool, performQuickDeploy, performGuidedPropose, performGuidedDeploy, deployAgentId, listOrchestratedAgents, type CallGatewayFn } from "./src/orchestrate-tool.js";
import { getOrchestratorPromptBlock } from "./src/system-prompt.js";
import { getTemplate, listTemplates, matchTemplate } from "./src/templates.js";
import { initStateDir, listPlanIds, loadPlan, loadState, loadReport } from "./src/state.js";

const plugin: OpenClawCNPluginDefinition = {
  id: "orchestrator",
  name: "Agent Orchestrator",
  description: "Intelligent multi-agent orchestration: plan, deploy, and coordinate agent teams.",
  version: "0.2.0",

  register(api: OpenClawCNPluginApi) {
    const logger = api.logger;
    logger.info("Orchestrator plugin registering...");

    // ── Initialize state directory ──────────────────────────────────────
    const stateDir = api.resolvePath("~/.openclawcn/orchestrator");
    initStateDir(stateDir);

    // ── Build gateway call function ─────────────────────────────────────
    // The plugin uses a lazy-import pattern to avoid hard dependency on
    // the gateway call module at load time.
    // Path resolution: in production the gateway is compiled to dist/; in development
    // jiti can resolve the .ts source from src/.  We try dist/ first (production path),
    // then fall back to src/ (dev / jiti path) so that both environments work without
    // requiring a full build before running in development.
    const callGateway: CallGatewayFn = async (method, params) => {
      let gwCall: ((opts: unknown) => Promise<unknown>) | undefined;
      try {
        const mod = await import("../../dist/gateway/call.js");
        gwCall = mod.callGateway;
      } catch {
        const mod = await import("../../src/gateway/call.js");
        gwCall = (mod as { callGateway: typeof gwCall }).callGateway;
      }
      return (gwCall as NonNullable<typeof gwCall>)({
        method,
        params,
        timeoutMs: 30_000,
        // Use "gateway-client" — one of the allowed GATEWAY_CLIENT_NAMES values
        clientName: "gateway-client" as never,
        clientDisplayName: "Orchestrator",
        mode: "backend" as never,
      });
    };

    // ── Register the orchestrate tool ───────────────────────────────────
    api.registerTool(
      (ctx) => createOrchestrateTool(ctx, callGateway),
      { name: "agents_orchestrate" },
    );

    // ── Inject orchestrator prompt into main agent ──────────────────────
    api.on("before_agent_start", async (_event, ctx) => {
      // Only inject for the main agent (not sub-agents)
      if (ctx.agentId && ctx.agentId !== "main") {
        return;
      }
      return {
        prependContext: getOrchestratorPromptBlock(),
      };
    });

    // ── Gateway methods: Templates ──────────────────────────────────────

    api.registerGatewayMethod("orchestrator.templates.list", ({ respond }) => {
      const templates = listTemplates();
      respond(true, { templates }, undefined);
    });

    api.registerGatewayMethod("orchestrator.templates.get", ({ params, respond }) => {
      const id = String((params as Record<string, unknown>).id ?? "");
      const template = getTemplate(id);
      if (!template) {
        respond(false, undefined, { code: "NOT_FOUND", message: `Template "${id}" not found` });
        return;
      }
      respond(true, { template }, undefined);
    });

    api.registerGatewayMethod("orchestrator.templates.match", ({ params, respond }) => {
      const requirement = String((params as Record<string, unknown>).requirement ?? "");
      const template = matchTemplate(requirement);
      respond(true, { template: template ?? null }, undefined);
    });

    // ── Gateway methods: Community Templates ──────────────────────────

    api.registerGatewayMethod("orchestrator.community.list", async ({ respond }) => {
      try {
        // Try fetching from remote community registry
        const url = "https://openclawcn.github.io/community-templates/index.json";
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8_000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);

        if (res.ok) {
          const data = (await res.json()) as { templates?: unknown[] };
          if (Array.isArray(data.templates)) {
            respond(true, { templates: data.templates }, undefined);
            return;
          }
        }
      } catch {
        // Remote unavailable — fall through to built-in showcase list
      }

      // Fallback: a curated sample so the section never appears empty
      respond(true, {
        templates: [
          {
            id: "community-social-crm",
            name: "社群运营助手",
            description: "自动管理微信群、欢迎新成员、定期推送内容日历",
            category: "social",
            author: "社区贡献者",
            downloads: 0,
            agents: [
              { name: "群管家", role: "管理群消息和新成员欢迎" },
              { name: "日历编辑", role: "维护社群内容日历和定期推送" },
            ],
            highlights: ["自动欢迎新成员", "内容日历管理", "违规消息过滤"],
          },
          {
            id: "community-ecommerce-ops",
            name: "电商运营全家桶",
            description: "竞品监控、评论分析、营销文案，一站式电商运营",
            category: "ecommerce",
            author: "社区贡献者",
            downloads: 0,
            agents: [
              { name: "竞品雷达", role: "监控竞品价格和上新动态" },
              { name: "评论分析师", role: "分析买家评论提取改进建议" },
              { name: "文案写手", role: "撰写商品详情和营销文案" },
            ],
            highlights: ["竞品实时监控", "评论情感分析", "爆款文案生成"],
          },
          {
            id: "community-legal-assistant",
            name: "法律文书助手",
            description: "合同审查、法规检索、文书模板，法务工作加速",
            category: "legal",
            author: "社区贡献者",
            downloads: 0,
            agents: [
              { name: "合同审查员", role: "自动检查合同关键条款和风险点" },
              { name: "法规检索", role: "快速查找相关法规和案例" },
            ],
            highlights: ["合同风险检查", "法规智能检索", "文书模板生成"],
          },
        ],
      }, undefined);
    });

    // ── Gateway methods: Quick Deploy ──────────────────────────────────

    api.registerGatewayMethod("orchestrator.quick_deploy", async ({ params, respond }) => {
      const p = params as Record<string, unknown>;
      const templateId = typeof p.templateId === "string" ? p.templateId : undefined;
      const requirement = typeof p.requirement === "string" ? p.requirement : undefined;

      try {
        const result = await performQuickDeploy(callGateway, { templateId, requirement });
        if ("error" in result) {
          respond(false, undefined, { code: "NO_TEMPLATE_MATCH", message: result.error });
        } else {
          respond(true, result, undefined);
        }
      } catch (err) {
        respond(false, undefined, {
          code: "DEPLOY_FAILED",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    });

    // ── Gateway methods: Guided Flow (UI-facing) ──────────────────────────

    api.registerGatewayMethod("orchestrator.guided_propose", async ({ params, respond }) => {
      const p = params as Record<string, unknown>;
      const requirement = typeof p.requirement === "string" ? p.requirement : "";
      const userContext = typeof p.userContext === "string" ? p.userContext : "{}";

      try {
        const result = await performGuidedPropose(callGateway, requirement, userContext);
        respond(true, result, undefined);
      } catch (err) {
        respond(false, undefined, {
          code: "PROPOSE_FAILED",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    });

    api.registerGatewayMethod("orchestrator.guided_deploy", async ({ params, respond }) => {
      const p = params as Record<string, unknown>;
      const planId = String(p.planId ?? "");
      const retryFailed = p.retryFailed === true;

      try {
        const result = await performGuidedDeploy(callGateway, planId, retryFailed);
        if ("error" in result) {
          respond(false, undefined, { code: "DEPLOY_FAILED", message: result.error });
        } else {
          respond(true, result, undefined);
        }
      } catch (err) {
        respond(false, undefined, {
          code: "DEPLOY_FAILED",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    });

    // ── Gateway methods: Plans ──────────────────────────────────────────

    api.registerGatewayMethod("orchestrator.plans.list", async ({ respond }) => {
      const planIds = await listPlanIds();
      const plans = [];
      for (const id of planIds.slice(-20)) {
        // Last 20 plans
        const plan = await loadPlan(id);
        const state = await loadState(id);
        if (plan) {
          plans.push({
            planId: plan.planId,
            teamDescription: plan.teamDescription,
            agentCount: plan.agents.length,
            createdAt: plan.createdAt,
            mode: plan.mode ?? "manual",
            status: state?.status ?? "unknown",
          });
        }
      }
      respond(true, { plans }, undefined);
    });

    api.registerGatewayMethod("orchestrator.plans.get", async ({ params, respond }) => {
      const planId = String((params as Record<string, unknown>).planId ?? "");
      const plan = await loadPlan(planId);
      const state = await loadState(planId);
      if (!plan) {
        respond(false, undefined, { code: "NOT_FOUND", message: `Plan "${planId}" not found` });
        return;
      }
      respond(true, { plan, state }, undefined);
    });

    // ── Gateway methods: Deploy Status (for UI polling) ─────────────────

    // Track which planIds we've already attempted compensating project creation for.
    // This prevents repeated gateway calls on every poll.
    const projectEnsureAttempted = new Set<string>();

    api.registerGatewayMethod("orchestrator.deploy.status", async ({ params, respond }) => {
      const planId = String((params as Record<string, unknown>).planId ?? "");
      const state = await loadState(planId);
      const plan = await loadPlan(planId);
      if (!state || !plan) {
        respond(false, undefined, { code: "NOT_FOUND", message: "Plan not found" });
        return;
      }

      // Calculate progress
      const total = state.agents.length;
      const completed = state.agents.filter(a => a.status === "ready").length;
      const failed = state.agents.filter(a => a.status === "failed").length;

      // Compensating project creation: when status is "deployed" and we haven't
      // already tried for this planId, fire-and-forget a createFromPlan call.
      // The handler is idempotent (checks sourcePlanId), so this is safe even if
      // the project was already created by executeDeploySequence.
      if (state.status === "deployed" && !projectEnsureAttempted.has(planId)) {
        projectEnsureAttempted.add(planId);
        void (async () => {
          try {
            console.log(`[orchestrator] deploy.status compensating createFromPlan for planId="${planId}"`);
            await callGateway("team.project.createFromPlan", { planId });
            console.log(`[orchestrator] deploy.status compensating createFromPlan SUCCESS for planId="${planId}"`);
          } catch (err) {
            console.error(`[orchestrator] deploy.status compensating createFromPlan FAILED for planId="${planId}":`,
              err instanceof Error ? err.message : String(err));
          }
        })();
      }

      respond(true, {
        planId,
        status: state.status,
        agents: state.agents.map(a => {
          const bp = plan.agents.find(b => b.id === a.agentId);
          return {
            id: a.agentId,
            deployedId: deployAgentId(planId, a.blueprintId),
            name: bp?.name ?? a.agentId,
            role: bp?.role ?? "",
            emoji: bp?.emoji,
            modelTier: bp?.modelTier,
            toolProfile: bp?.tools?.profile,
            status: a.status,
            error: a.error,
          };
        }),
        progress: { total, completed, failed },
        plan: {
          teamDescription: plan.teamDescription,
          agentCount: plan.agents.length,
          mode: plan.mode,
          usageGuide: plan.usageGuide,
        },
      }, undefined);
    });

    // ── Gateway methods: Deploy Report ─────────────────────────────────

    api.registerGatewayMethod("orchestrator.deploy.report", async ({ params, respond }) => {
      const planId = String((params as Record<string, unknown>).planId ?? "");
      const report = await loadReport(planId);
      if (!report) {
        respond(false, undefined, { code: "NOT_FOUND", message: "Deploy report not found" });
        return;
      }
      respond(true, { report }, undefined);
    });

    // ── Gateway methods: Deploy Validation (S2-3: dry-run) ──────────────

    api.registerGatewayMethod("orchestrator.deploy.validate", async ({ params, respond }) => {
      const planId = String((params as Record<string, unknown>).planId ?? "");
      const plan = await loadPlan(planId);
      const state = await loadState(planId);
      if (!plan || !state) {
        respond(false, undefined, { code: "NOT_FOUND", message: "Plan not found" });
        return;
      }

      const { validatePlanForDeploy } = await import("./src/orchestrate-tool.js");
      const result = await validatePlanForDeploy(callGateway, planId);
      respond(true, result, undefined);
    });

    // ── Gateway methods: Orchestrated Agents (S2-4) ────────────────────────

    api.registerGatewayMethod("orchestrator.agents.list", ({ respond }) => {
      respond(true, { agents: listOrchestratedAgents() }, undefined);
    });

    logger.info("Orchestrator plugin registered successfully (v0.2.0).");
  },
};

export default plugin;
