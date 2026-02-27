/**
 * Tests for performGuidedPropose and performGuidedDeploy.
 *
 * These UI-facing gateway helpers generate team proposals from
 * requirement + user context, and deploy plans in fire-and-forget mode.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the state module ───────────────────────────────────────────────
vi.mock("./state.js", () => {
  const plans = new Map<string, unknown>();
  const states = new Map<string, unknown>();
  let planIdCounter = 0;
  return {
    initStateDir: vi.fn(),
    generatePlanId: vi.fn(() => `orch-20260225-${String(++planIdCounter).padStart(8, "0")}`),
    savePlan: vi.fn(async (plan: { planId: string }) => { plans.set(plan.planId, JSON.parse(JSON.stringify(plan))); }),
    loadPlan: vi.fn(async (id: string) => plans.get(id) ?? null),
    saveState: vi.fn(async (state: { planId: string }) => { states.set(state.planId, JSON.parse(JSON.stringify(state))); }),
    loadState: vi.fn(async (id: string) => states.get(id) ?? null),
    listPlanIds: vi.fn(async () => [...plans.keys()].sort()),
    createInitialState: vi.fn((plan: { planId: string; agents: { id: string }[] }) => ({
      planId: plan.planId,
      status: "confirming",
      agents: plan.agents.map((a: { id: string }) => ({
        agentId: a.id,
        blueprintId: a.id,
        status: "pending",
      })),
    })),
    updateAgentStatus: vi.fn((state: any, agentId: string, status: string, error?: string) => ({
      ...state,
      agents: state.agents.map((a: any) =>
        a.agentId === agentId ? { ...a, status, ...(error ? { error } : {}) } : a,
      ),
      ...(status === "ready" && state.agents.every((a: any) => a.agentId === agentId || a.status === "ready")
        ? { status: "deployed", deployFinishedAt: new Date().toISOString() }
        : {}),
      ...(status === "failed" ? { status: "failed", error } : {}),
    })),
    __plans: plans,
    __states: states,
    __resetCounter: () => { planIdCounter = 0; },
  };
});

import { performGuidedPropose, performGuidedDeploy, type CallGatewayFn } from "./orchestrate-tool.js";
import { savePlan, saveState } from "./state.js";

const stateModule = await import("./state.js") as any;

// ── Helpers ───────────────────────────────────────────────────────────────

function makeGateway(): ReturnType<typeof vi.fn> {
  return vi.fn(async (method: string) => {
    if (method === "config.get") return { hash: "test-hash" };
    if (method === "agents.list") return [];  // S1-2: no conflicts
    return {};
  });
}

beforeEach(() => {
  stateModule.__plans.clear();
  stateModule.__states.clear();
  stateModule.__resetCounter();
  vi.clearAllMocks();
});

// ── performGuidedPropose Tests ──────────────────────────────────────────

describe("performGuidedPropose", () => {
  it("returns a planId and team agents", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    const result = await performGuidedPropose(gw, "I need a content team", "{}");

    expect(result.planId).toMatch(/^orch-/);
    expect(result.agents.length).toBeGreaterThan(0);
    expect(result.teamDescription).toBeTruthy();
  });

  it("matches template when keywords match", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    // "自媒体 内容" matches the content-factory template (needs >= 2 keyword hits)
    const result = await performGuidedPropose(gw, "自媒体内容创作团队", "{}");

    expect(result.planId).toBeTruthy();
    // When template matches, should have the template's agents
    expect(result.agents.length).toBeGreaterThanOrEqual(2);
  });

  it("generates default team when no template matches", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    const result = await performGuidedPropose(gw, "random unrelated request xyzzy", "{}");

    expect(result.planId).toBeTruthy();
    // Default team always has at least the primary assistant
    expect(result.agents.length).toBeGreaterThanOrEqual(1);
    expect(result.agents[0].id).toBe("primary-assistant");
  });

  it("adds scenario-specific agents based on keywords", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    // Use a requirement that won't match any template (< 2 keyword hits)
    // but triggers the copywriter and researcher keyword patterns
    const result = await performGuidedPropose(gw, "xyzzy project: 写文案 and research调研", "{}");

    const ids = result.agents.map(a => a.id);
    expect(ids).toContain("primary-assistant");
    expect(ids).toContain("copywriter");
    expect(ids).toContain("researcher");
  });

  it("parses userContext JSON", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    const ctx = JSON.stringify({
      scenario: "content",
      channels: ["wechat"],
      budget: "cheap",
    });
    const result = await performGuidedPropose(gw, "random request xyzzy", ctx);

    expect(result.planId).toBeTruthy();
    // Primary assistant should use cheap tier when budget is cheap
    const primary = result.agents.find(a => a.id === "primary-assistant");
    expect(primary?.modelTier).toBe("cheap");
  });

  it("handles invalid userContext JSON gracefully", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    const result = await performGuidedPropose(gw, "need a team", "invalid json {{{");

    // Should not throw, falls back to default context
    expect(result.planId).toBeTruthy();
    expect(result.agents.length).toBeGreaterThan(0);
  });

  it("saves plan and state", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    await performGuidedPropose(gw, "need a team", "{}");

    expect(savePlan).toHaveBeenCalled();
    expect(saveState).toHaveBeenCalled();

    const savedPlan = stateModule.__plans.values().next().value as any;
    expect(savedPlan.mode).toBe("guided");
  });

  it("sets plan state to draft", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    await performGuidedPropose(gw, "need a team", "{}");

    const savedState = stateModule.__states.values().next().value as any;
    expect(savedState.status).toBe("draft");
  });

  it("caps auto-generated teams at 4 agents", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    // Trigger all possible keyword categories
    const result = await performGuidedPropose(
      gw,
      "写文案 数据分析 客服 编程 research 调研",
      "{}",
    );

    expect(result.agents.length).toBeLessThanOrEqual(4);
  });

  it("returns agent details with modelTier and tools", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    const result = await performGuidedPropose(gw, "build a coding team", "{}");

    for (const agent of result.agents) {
      expect(agent.id).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(agent.role).toBeTruthy();
      expect(agent.modelTier).toMatch(/^(cheap|mid|sota)$/);
      expect(Array.isArray(agent.tools)).toBe(true);
    }
  });
});

// ── performGuidedDeploy Tests ───────────────────────────────────────────

describe("performGuidedDeploy", () => {
  async function seedPlan(planId: string, status: string = "draft") {
    const plan = {
      planId,
      createdAt: new Date().toISOString(),
      requirement: "test",
      agents: [
        {
          name: "Helper",
          id: "helper",
          role: "Assist users",
          soul: "# SOUL\n\n## 角色\nHelper\n\n## 核心职责\n- Help\n\n## 行为准则\n- Be nice\n\n## 能力边界\n- None\n\n## 协作指令\n- Cooperate",
          modelTier: "mid",
          tools: { allow: ["group:web"] },
        },
      ],
      teamDescription: "Test team",
      mode: "guided",
    };
    stateModule.__plans.set(planId, JSON.parse(JSON.stringify(plan)));

    const state = {
      planId,
      status,
      agents: [{ agentId: "helper", blueprintId: "helper", status: "pending" }],
    };
    stateModule.__states.set(planId, JSON.parse(JSON.stringify(state)));
  }

  it("returns error when plan not found", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    const result = await performGuidedDeploy(gw, "nonexistent-plan");
    expect(result).toHaveProperty("error");
    expect((result as any).error).toContain("not found");
  });

  it("returns error when state not found", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    stateModule.__plans.set("orphan-plan", { planId: "orphan-plan", agents: [] });
    // No state saved
    const result = await performGuidedDeploy(gw, "orphan-plan");
    expect(result).toHaveProperty("error");
  });

  it("returns error when plan is already deployed", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    await seedPlan("deployed-plan", "deployed");
    const result = await performGuidedDeploy(gw, "deployed-plan");
    expect(result).toHaveProperty("error");
    expect((result as any).error).toContain("deployed");
  });

  it("accepts plan in draft status", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    await seedPlan("draft-plan", "draft");
    const result = await performGuidedDeploy(gw, "draft-plan");
    expect(result).toHaveProperty("planId", "draft-plan");
    expect(result).toHaveProperty("status", "deploying");
  });

  it("accepts plan in confirming status", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    await seedPlan("confirming-plan", "confirming");
    const result = await performGuidedDeploy(gw, "confirming-plan");
    expect(result).toHaveProperty("planId", "confirming-plan");
    expect(result).toHaveProperty("status", "deploying");
  });

  it("sets state to deploying before returning", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    await seedPlan("deploy-test", "draft");
    await performGuidedDeploy(gw, "deploy-test");

    expect(saveState).toHaveBeenCalled();
    // The first saveState call should be the deploying transition
    const firstSavedState = (saveState as any).mock.calls[0][0];
    expect(firstSavedState.status).toBe("deploying");
  });

  it("fires background deploy (non-blocking)", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    await seedPlan("bg-deploy", "draft");
    const result = await performGuidedDeploy(gw, "bg-deploy");

    // Returns immediately
    expect(result).toHaveProperty("status", "deploying");

    // Let background deploy microtasks flush
    await new Promise(resolve => setTimeout(resolve, 50));

    // Gateway should have been called with agents.create
    const calls = (gw as ReturnType<typeof vi.fn>).mock.calls.map((c: any) => c[0]);
    expect(calls).toContain("agents.create");
  });
});
