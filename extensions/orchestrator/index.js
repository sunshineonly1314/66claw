import { createOrchestrateTool, performQuickDeploy, performGuidedPropose, performGuidedDeploy, deployAgentId, listOrchestratedAgents } from "./src/orchestrate-tool.js";
import { getOrchestratorPromptBlock } from "./src/system-prompt.js";
import { getTemplate, listTemplates, matchTemplate } from "./src/templates.js";
import { initStateDir, listPlanIds, loadPlan, loadState, loadReport } from "./src/state.js";
const plugin = {
  id: "orchestrator",
  name: "Agent Orchestrator",
  description: "Intelligent multi-agent orchestration: plan, deploy, and coordinate agent teams.",
  version: "0.2.0",
  register(api) {
    const logger = api.logger;
    logger.info("Orchestrator plugin registering...");
    const stateDir = api.resolvePath("~/.openclawcn/orchestrator");
    initStateDir(stateDir);
    const callGateway = async (method, params) => {
      const { callGateway: gwCall } = await import("../../dist/gateway/call.js");
      return gwCall({
        method,
        params,
        timeoutMs: 3e4,
        // Use "gateway-client" — one of the allowed GATEWAY_CLIENT_IDS values
        clientName: "gateway-client",
        clientDisplayName: "Orchestrator",
        mode: "backend"
      });
    };
    api.registerTool(
      (ctx) => createOrchestrateTool(ctx, callGateway),
      { name: "agents_orchestrate" }
    );
    api.on("before_agent_start", async (_event, ctx) => {
      if (ctx.agentId && ctx.agentId !== "main") {
        return;
      }
      return {
        prependContext: getOrchestratorPromptBlock()
      };
    });
    api.registerGatewayMethod("orchestrator.templates.list", ({ respond }) => {
      const templates = listTemplates();
      respond(true, { templates }, void 0);
    });
    api.registerGatewayMethod("orchestrator.templates.get", ({ params, respond }) => {
      const id = String(params.id ?? "");
      const template = getTemplate(id);
      if (!template) {
        respond(false, void 0, { code: "NOT_FOUND", message: `Template "${id}" not found` });
        return;
      }
      respond(true, { template }, void 0);
    });
    api.registerGatewayMethod("orchestrator.templates.match", ({ params, respond }) => {
      const requirement = String(params.requirement ?? "");
      const template = matchTemplate(requirement);
      respond(true, { template: template ?? null }, void 0);
    });
    api.registerGatewayMethod("orchestrator.community.list", async ({ respond }) => {
      try {
        const url = "https://openclawcn.github.io/community-templates/index.json";
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8e3);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.templates)) {
            respond(true, { templates: data.templates }, void 0);
            return;
          }
        }
      } catch {
      }
      respond(true, {
        templates: [
          {
            id: "community-social-crm",
            name: "\u793E\u7FA4\u8FD0\u8425\u52A9\u624B",
            description: "\u81EA\u52A8\u7BA1\u7406\u5FAE\u4FE1\u7FA4\u3001\u6B22\u8FCE\u65B0\u6210\u5458\u3001\u5B9A\u671F\u63A8\u9001\u5185\u5BB9\u65E5\u5386",
            category: "social",
            author: "\u793E\u533A\u8D21\u732E\u8005",
            downloads: 0,
            agents: [
              { name: "\u7FA4\u7BA1\u5BB6", role: "\u7BA1\u7406\u7FA4\u6D88\u606F\u548C\u65B0\u6210\u5458\u6B22\u8FCE" },
              { name: "\u65E5\u5386\u7F16\u8F91", role: "\u7EF4\u62A4\u793E\u7FA4\u5185\u5BB9\u65E5\u5386\u548C\u5B9A\u671F\u63A8\u9001" }
            ],
            highlights: ["\u81EA\u52A8\u6B22\u8FCE\u65B0\u6210\u5458", "\u5185\u5BB9\u65E5\u5386\u7BA1\u7406", "\u8FDD\u89C4\u6D88\u606F\u8FC7\u6EE4"]
          },
          {
            id: "community-ecommerce-ops",
            name: "\u7535\u5546\u8FD0\u8425\u5168\u5BB6\u6876",
            description: "\u7ADE\u54C1\u76D1\u63A7\u3001\u8BC4\u8BBA\u5206\u6790\u3001\u8425\u9500\u6587\u6848\uFF0C\u4E00\u7AD9\u5F0F\u7535\u5546\u8FD0\u8425",
            category: "ecommerce",
            author: "\u793E\u533A\u8D21\u732E\u8005",
            downloads: 0,
            agents: [
              { name: "\u7ADE\u54C1\u96F7\u8FBE", role: "\u76D1\u63A7\u7ADE\u54C1\u4EF7\u683C\u548C\u4E0A\u65B0\u52A8\u6001" },
              { name: "\u8BC4\u8BBA\u5206\u6790\u5E08", role: "\u5206\u6790\u4E70\u5BB6\u8BC4\u8BBA\u63D0\u53D6\u6539\u8FDB\u5EFA\u8BAE" },
              { name: "\u6587\u6848\u5199\u624B", role: "\u64B0\u5199\u5546\u54C1\u8BE6\u60C5\u548C\u8425\u9500\u6587\u6848" }
            ],
            highlights: ["\u7ADE\u54C1\u5B9E\u65F6\u76D1\u63A7", "\u8BC4\u8BBA\u60C5\u611F\u5206\u6790", "\u7206\u6B3E\u6587\u6848\u751F\u6210"]
          },
          {
            id: "community-legal-assistant",
            name: "\u6CD5\u5F8B\u6587\u4E66\u52A9\u624B",
            description: "\u5408\u540C\u5BA1\u67E5\u3001\u6CD5\u89C4\u68C0\u7D22\u3001\u6587\u4E66\u6A21\u677F\uFF0C\u6CD5\u52A1\u5DE5\u4F5C\u52A0\u901F",
            category: "legal",
            author: "\u793E\u533A\u8D21\u732E\u8005",
            downloads: 0,
            agents: [
              { name: "\u5408\u540C\u5BA1\u67E5\u5458", role: "\u81EA\u52A8\u68C0\u67E5\u5408\u540C\u5173\u952E\u6761\u6B3E\u548C\u98CE\u9669\u70B9" },
              { name: "\u6CD5\u89C4\u68C0\u7D22", role: "\u5FEB\u901F\u67E5\u627E\u76F8\u5173\u6CD5\u89C4\u548C\u6848\u4F8B" }
            ],
            highlights: ["\u5408\u540C\u98CE\u9669\u68C0\u67E5", "\u6CD5\u89C4\u667A\u80FD\u68C0\u7D22", "\u6587\u4E66\u6A21\u677F\u751F\u6210"]
          }
        ]
      }, void 0);
    });
    api.registerGatewayMethod("orchestrator.quick_deploy", async ({ params, respond }) => {
      const p = params;
      const templateId = typeof p.templateId === "string" ? p.templateId : void 0;
      const requirement = typeof p.requirement === "string" ? p.requirement : void 0;
      try {
        const result = await performQuickDeploy(callGateway, { templateId, requirement });
        if ("error" in result) {
          respond(false, void 0, { code: "NO_TEMPLATE_MATCH", message: result.error });
        } else {
          respond(true, result, void 0);
        }
      } catch (err) {
        respond(false, void 0, {
          code: "DEPLOY_FAILED",
          message: err instanceof Error ? err.message : String(err)
        });
      }
    });
    api.registerGatewayMethod("orchestrator.guided_propose", async ({ params, respond }) => {
      const p = params;
      const requirement = typeof p.requirement === "string" ? p.requirement : "";
      const userContext = typeof p.userContext === "string" ? p.userContext : "{}";
      try {
        const result = await performGuidedPropose(callGateway, requirement, userContext);
        respond(true, result, void 0);
      } catch (err) {
        respond(false, void 0, {
          code: "PROPOSE_FAILED",
          message: err instanceof Error ? err.message : String(err)
        });
      }
    });
    api.registerGatewayMethod("orchestrator.guided_deploy", async ({ params, respond }) => {
      const p = params;
      const planId = String(p.planId ?? "");
      const retryFailed = p.retryFailed === true;
      try {
        const result = await performGuidedDeploy(callGateway, planId, retryFailed);
        if ("error" in result) {
          respond(false, void 0, { code: "DEPLOY_FAILED", message: result.error });
        } else {
          respond(true, result, void 0);
        }
      } catch (err) {
        respond(false, void 0, {
          code: "DEPLOY_FAILED",
          message: err instanceof Error ? err.message : String(err)
        });
      }
    });
    api.registerGatewayMethod("orchestrator.plans.list", async ({ respond }) => {
      const planIds = await listPlanIds();
      const plans = [];
      for (const id of planIds.slice(-20)) {
        const plan = await loadPlan(id);
        const state = await loadState(id);
        if (plan) {
          plans.push({
            planId: plan.planId,
            teamDescription: plan.teamDescription,
            agentCount: plan.agents.length,
            createdAt: plan.createdAt,
            mode: plan.mode ?? "manual",
            status: state?.status ?? "unknown"
          });
        }
      }
      respond(true, { plans }, void 0);
    });
    api.registerGatewayMethod("orchestrator.plans.get", async ({ params, respond }) => {
      const planId = String(params.planId ?? "");
      const plan = await loadPlan(planId);
      const state = await loadState(planId);
      if (!plan) {
        respond(false, void 0, { code: "NOT_FOUND", message: `Plan "${planId}" not found` });
        return;
      }
      respond(true, { plan, state }, void 0);
    });
    const projectEnsureAttempted = /* @__PURE__ */ new Set();
    api.registerGatewayMethod("orchestrator.deploy.status", async ({ params, respond }) => {
      const planId = String(params.planId ?? "");
      const state = await loadState(planId);
      const plan = await loadPlan(planId);
      if (!state || !plan) {
        respond(false, void 0, { code: "NOT_FOUND", message: "Plan not found" });
        return;
      }
      const total = state.agents.length;
      const completed = state.agents.filter((a) => a.status === "ready").length;
      const failed = state.agents.filter((a) => a.status === "failed").length;
      if (state.status === "deployed" && !projectEnsureAttempted.has(planId)) {
        projectEnsureAttempted.add(planId);
        void (async () => {
          try {
            console.log(`[orchestrator] deploy.status compensating createFromPlan for planId="${planId}"`);
            await callGateway("team.project.createFromPlan", { planId });
            console.log(`[orchestrator] deploy.status compensating createFromPlan SUCCESS for planId="${planId}"`);
          } catch (err) {
            console.error(`[orchestrator] deploy.status compensating createFromPlan FAILED for planId="${planId}":`, err instanceof Error ? err.message : String(err));
          }
        })();
      }
      respond(true, {
        planId,
        status: state.status,
        agents: state.agents.map((a) => {
          const bp = plan.agents.find((b) => b.id === a.agentId);
          return {
            id: a.agentId,
            deployedId: deployAgentId(planId, a.blueprintId),
            name: bp?.name ?? a.agentId,
            role: bp?.role ?? "",
            emoji: bp?.emoji,
            modelTier: bp?.modelTier,
            toolProfile: bp?.tools?.profile,
            status: a.status,
            error: a.error
          };
        }),
        progress: { total, completed, failed },
        plan: {
          teamDescription: plan.teamDescription,
          agentCount: plan.agents.length,
          mode: plan.mode,
          usageGuide: plan.usageGuide
        }
      }, void 0);
    });
    api.registerGatewayMethod("orchestrator.deploy.report", async ({ params, respond }) => {
      const planId = String(params.planId ?? "");
      const report = await loadReport(planId);
      if (!report) {
        respond(false, void 0, { code: "NOT_FOUND", message: "Deploy report not found" });
        return;
      }
      respond(true, { report }, void 0);
    });
    api.registerGatewayMethod("orchestrator.deploy.validate", async ({ params, respond }) => {
      const planId = String(params.planId ?? "");
      const plan = await loadPlan(planId);
      const state = await loadState(planId);
      if (!plan || !state) {
        respond(false, void 0, { code: "NOT_FOUND", message: "Plan not found" });
        return;
      }
      const { validatePlanForDeploy } = await import("./src/orchestrate-tool.js");
      const result = await validatePlanForDeploy(callGateway, planId);
      respond(true, result, void 0);
    });
    api.registerGatewayMethod("orchestrator.agents.list", ({ respond }) => {
      respond(true, { agents: listOrchestratedAgents() }, void 0);
    });
    logger.info("Orchestrator plugin registered successfully (v0.2.0).");
  }
};
var orchestrator_default = plugin;
export {
  orchestrator_default as default
};
