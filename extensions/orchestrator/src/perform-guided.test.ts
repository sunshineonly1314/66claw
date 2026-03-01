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
    // Default team always has at least one agent (primary-assistant for no-match)
    expect(result.agents.length).toBeGreaterThanOrEqual(1);
    expect(result.agents[0].id).toBe("primary-assistant");
  });

  it("adds scenario-specific agents based on keywords", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    // Use a requirement that won't match any template (< 2 keyword hits)
    // but triggers the copywriter and researcher keyword patterns
    const result = await performGuidedPropose(gw, "xyzzy project: 写文案 and research调研", "{}");

    const ids = result.agents.map(a => a.id);
    // With the new logic, matching roles are added directly (no primary-assistant placeholder)
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
    // With no keyword match, primary-assistant is used; cheap budget → cheap tier
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

  it("caps auto-generated teams at 6 agents", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    // Trigger as many keyword categories as possible
    const result = await performGuidedPropose(
      gw,
      "写文案 数据分析 客服 编程 research调研 翻译 配图 新闻 日程提醒",
      "{}",
    );

    expect(result.agents.length).toBeLessThanOrEqual(6);
    expect(result.agents.length).toBeGreaterThanOrEqual(3);
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

  // ── Retry Failed Tests ──────────────────────────────────────────────────

  async function seedPlanWithFailedAgent(planId: string) {
    const plan = {
      planId,
      createdAt: new Date().toISOString(),
      requirement: "test retry",
      agents: [
        {
          name: "AgentA",
          id: "agent-a",
          role: "Already deployed",
          soul: "# SOUL\n\n## 角色\nA\n\n## 核心职责\n- Work\n\n## 行为准则\n- Good\n\n## 能力边界\n- All\n\n## 协作指令\n- Cooperate",
          modelTier: "mid",
          tools: { allow: ["group:web"] },
        },
        {
          name: "AgentB",
          id: "agent-b",
          role: "Failed during deploy",
          soul: "# SOUL\n\n## 角色\nB\n\n## 核心职责\n- Work\n\n## 行为准则\n- Good\n\n## 能力边界\n- All\n\n## 协作指令\n- Cooperate",
          modelTier: "cheap",
          tools: { allow: ["group:fs"] },
        },
      ],
      teamDescription: "Retry test team",
      mode: "guided",
    };
    stateModule.__plans.set(planId, JSON.parse(JSON.stringify(plan)));

    const state = {
      planId,
      status: "failed",
      agents: [
        { agentId: "agent-a", blueprintId: "agent-a", status: "ready", readyAt: new Date().toISOString() },
        { agentId: "agent-b", blueprintId: "agent-b", status: "failed", error: "connection refused" },
      ],
      error: "connection refused",
    };
    stateModule.__states.set(planId, JSON.parse(JSON.stringify(state)));
  }

  it("accepts plan in failed status when retryFailed=true", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    await seedPlanWithFailedAgent("retry-ok");
    const result = await performGuidedDeploy(gw, "retry-ok", true);
    expect(result).toHaveProperty("planId", "retry-ok");
    expect(result).toHaveProperty("status", "deploying");
  });

  it("rejects plan in failed status when retryFailed is not set", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    await seedPlanWithFailedAgent("retry-blocked");
    const result = await performGuidedDeploy(gw, "retry-blocked");
    expect(result).toHaveProperty("error");
    expect((result as any).error).toContain("failed");
  });

  it("resets failed agent status to pending before retry", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    await seedPlanWithFailedAgent("retry-reset");
    await performGuidedDeploy(gw, "retry-reset", true);

    // The first saveState call should have reset agent-b from "failed" to "pending"
    const savedState = (saveState as any).mock.calls[0][0];
    expect(savedState.status).toBe("deploying");
    const agentB = savedState.agents.find((a: any) => a.agentId === "agent-b");
    expect(agentB.status).toBe("pending");
    expect(agentB.error).toBeUndefined();
    // agent-a should remain ready
    const agentA = savedState.agents.find((a: any) => a.agentId === "agent-a");
    expect(agentA.status).toBe("ready");
  });

  it("only deploys failed agents on retry, preserving ready ones", async () => {
    // Gateway mock: agent-a already exists
    const gw = vi.fn(async (method: string, params?: Record<string, unknown>) => {
      if (method === "config.get") return { hash: "test-hash" };
      if (method === "agents.list") {
        return [{ id: "retry-selective--agent-a" }]; // agent-a already deployed
      }
      return {};
    }) as unknown as CallGatewayFn;

    await seedPlanWithFailedAgent("retry-selective");
    await performGuidedDeploy(gw, "retry-selective", true);

    // Let background deploy flush
    await new Promise(resolve => setTimeout(resolve, 50));

    const gwFn = gw as ReturnType<typeof vi.fn>;

    // agents.create should only be called for agent-b (not agent-a)
    const createCalls = gwFn.mock.calls.filter((c: any) => c[0] === "agents.create");
    expect(createCalls.length).toBe(1);
    expect(createCalls[0][1].id).toContain("agent-b");

    // agents.remove should NOT be called for agent-a (already ready, preserved)
    const removeCalls = gwFn.mock.calls.filter((c: any) => c[0] === "agents.remove");
    expect(removeCalls.length).toBe(0);
  });

  // ── Boundary: retry with 0 failed agents (all already ready) ─────────

  it("handles retry when all agents are already ready", async () => {
    // Seed a plan where ALL agents are ready but status is "failed" (edge case: overall
    // status was set to failed by config.patch error, agents are individually ready)
    const plan = {
      planId: "all-ready",
      createdAt: new Date().toISOString(),
      requirement: "test boundary",
      agents: [
        {
          name: "A",
          id: "a",
          role: "role",
          soul: "# SOUL\n\n## 角色\nA\n\n## 核心职责\n- Work\n\n## 行为准则\n- Good\n\n## 能力边界\n- All\n\n## 协作指令\n- Cooperate",
          modelTier: "mid",
          tools: { allow: ["group:web"] },
        },
      ],
      teamDescription: "Boundary test",
      mode: "guided",
    };
    stateModule.__plans.set("all-ready", JSON.parse(JSON.stringify(plan)));
    stateModule.__states.set("all-ready", JSON.parse(JSON.stringify({
      planId: "all-ready",
      status: "failed",
      agents: [{ agentId: "a", blueprintId: "a", status: "ready", readyAt: new Date().toISOString() }],
      error: "config patch failed",
    })));

    const gw = makeGateway() as unknown as CallGatewayFn;
    const result = await performGuidedDeploy(gw, "all-ready", true);

    expect(result).toHaveProperty("planId", "all-ready");
    expect(result).toHaveProperty("status", "deploying");

    // Let background deploy flush
    await new Promise(resolve => setTimeout(resolve, 50));

    // No agents.create should be called (0 agents to retry)
    const gwFn = gw as ReturnType<typeof vi.fn>;
    const createCalls = gwFn.mock.calls.filter((c: any) => c[0] === "agents.create");
    expect(createCalls.length).toBe(0);
  });

  // ── Boundary: retry with ALL agents failed ────────────────────────────

  it("retries all agents when all are failed", async () => {
    const plan = {
      planId: "all-failed",
      createdAt: new Date().toISOString(),
      requirement: "test all failed",
      agents: [
        {
          name: "A",
          id: "a",
          role: "role a",
          soul: "# SOUL\n\n## 角色\nA\n\n## 核心职责\n- Work\n\n## 行为准则\n- Good\n\n## 能力边界\n- All\n\n## 协作指令\n- Cooperate",
          modelTier: "mid",
          tools: { allow: [] },
        },
        {
          name: "B",
          id: "b",
          role: "role b",
          soul: "# SOUL\n\n## 角色\nB\n\n## 核心职责\n- Work\n\n## 行为准则\n- Good\n\n## 能力边界\n- All\n\n## 协作指令\n- Cooperate",
          modelTier: "cheap",
          tools: { allow: [] },
        },
      ],
      teamDescription: "All failed test",
      mode: "guided",
    };
    stateModule.__plans.set("all-failed", JSON.parse(JSON.stringify(plan)));
    stateModule.__states.set("all-failed", JSON.parse(JSON.stringify({
      planId: "all-failed",
      status: "failed",
      agents: [
        { agentId: "a", blueprintId: "a", status: "failed", error: "timeout" },
        { agentId: "b", blueprintId: "b", status: "failed", error: "timeout" },
      ],
      error: "timeout",
    })));

    const gw = makeGateway() as unknown as CallGatewayFn;
    const result = await performGuidedDeploy(gw, "all-failed", true);
    expect(result).toHaveProperty("status", "deploying");

    // The saved state should reset both agents to pending
    const savedState = (saveState as any).mock.calls[0][0];
    expect(savedState.agents.every((a: any) => a.status === "pending")).toBe(true);
    expect(savedState.error).toBeUndefined();

    // Let background deploy flush
    await new Promise(resolve => setTimeout(resolve, 50));

    // Both agents should be created
    const gwFn = gw as ReturnType<typeof vi.fn>;
    const createCalls = gwFn.mock.calls.filter((c: any) => c[0] === "agents.create");
    expect(createCalls.length).toBe(2);
  });

  // ── Boundary: preserves original deployStartedAt on retry ─────────────

  it("preserves original deployStartedAt on retry", async () => {
    const originalStart = "2026-01-15T10:00:00.000Z";
    const plan = {
      planId: "ts-preserve",
      createdAt: new Date().toISOString(),
      requirement: "test timestamp",
      agents: [{
        name: "A", id: "a", role: "r",
        soul: "# SOUL\n\n## 角色\nA\n\n## 核心职责\n- Work\n\n## 行为准则\n- Good\n\n## 能力边界\n- All\n\n## 协作指令\n- Cooperate",
        modelTier: "mid", tools: { allow: [] },
      }],
      teamDescription: "Timestamp test",
      mode: "guided",
    };
    stateModule.__plans.set("ts-preserve", JSON.parse(JSON.stringify(plan)));
    stateModule.__states.set("ts-preserve", JSON.parse(JSON.stringify({
      planId: "ts-preserve",
      status: "failed",
      deployStartedAt: originalStart,
      agents: [{ agentId: "a", blueprintId: "a", status: "failed", error: "err" }],
      error: "err",
    })));

    const gw = makeGateway() as unknown as CallGatewayFn;
    await performGuidedDeploy(gw, "ts-preserve", true);

    const savedState = (saveState as any).mock.calls[0][0];
    expect(savedState.deployStartedAt).toBe(originalStart);
  });

  // ── Boundary: empty planId ─────────────────────────────────────────────

  it("returns error for empty planId", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    const result = await performGuidedDeploy(gw, "");
    expect(result).toHaveProperty("error");
  });

  // ── Boundary: retryFailed on a "deploying" plan ────────────────────────

  it("rejects retry on an actively deploying plan", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    await seedPlan("deploying-plan", "deploying");
    const result = await performGuidedDeploy(gw, "deploying-plan", true);
    expect(result).toHaveProperty("error");
    expect((result as any).error).toContain("deploying");
  });
});
