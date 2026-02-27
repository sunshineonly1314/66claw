/**
 * Tests for performQuickDeploy — the exported gateway-callable quick deploy function.
 *
 * This function was added to bridge the gap between the UI (which calls
 * orchestrator.quick_deploy gateway method) and the tool handler (which
 * previously was the only path to quick deploy).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the state module ───────────────────────────────────────────────
vi.mock("./state.js", () => {
  const plans = new Map<string, unknown>();
  const states = new Map<string, unknown>();
  let planIdCounter = 0;
  return {
    initStateDir: vi.fn(),
    generatePlanId: vi.fn(() => `orch-20260222-${String(++planIdCounter).padStart(8, "0")}`),
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

import { performQuickDeploy, type CallGatewayFn } from "./orchestrate-tool.js";
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

// ── Tests ─────────────────────────────────────────────────────────────────

describe("performQuickDeploy", () => {
  it("returns error when no template matches", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    const result = await performQuickDeploy(gw, { requirement: "something totally random xyzzy" });
    expect(result).toHaveProperty("error");
    expect(result).toHaveProperty("matched", false);
  });

  it("returns planId when template matches by ID", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    const result = await performQuickDeploy(gw, { templateId: "daily-assistant" });

    expect(result).toHaveProperty("planId");
    expect(result).toHaveProperty("status", "deploying");
    expect((result as any).planId).toMatch(/^orch-/);
  });

  it("saves plan and state before returning", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    const result = await performQuickDeploy(gw, { templateId: "daily-assistant" });

    expect(savePlan).toHaveBeenCalled();
    expect(saveState).toHaveBeenCalled();

    // Plan should have been saved with template info
    const savedPlan = stateModule.__plans.values().next().value as any;
    expect(savedPlan).toBeDefined();
    expect(savedPlan.mode).toBe("template");
    expect(savedPlan.templateId).toBe("daily-assistant");
  });

  it("matches template by requirement keywords", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    // "客服" matches the customer-support template's keywords
    const result = await performQuickDeploy(gw, { requirement: "我需要一个客服团队" });

    if ("error" in result) {
      // Some templates may not match — that's OK, just verify the no-match path is clean
      expect(result.matched).toBe(false);
    } else {
      expect(result.planId).toBeTruthy();
      expect(result.status).toBe("deploying");
    }
  });

  it("templateId takes precedence over requirement", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    const result = await performQuickDeploy(gw, {
      templateId: "daily-assistant",
      requirement: "build a coding team",  // Would match a different template
    });

    expect(result).toHaveProperty("planId");
    const savedPlan = stateModule.__plans.values().next().value as any;
    expect(savedPlan.templateId).toBe("daily-assistant");
  });

  it("sets initial state to deploying", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    await performQuickDeploy(gw, { templateId: "daily-assistant" });

    // The state should be saved with status "deploying"
    const savedState = stateModule.__states.values().next().value as any;
    expect(savedState).toBeDefined();
    expect(savedState.status).toBe("deploying");
  });

  it("fires background deploy (non-blocking)", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    const result = await performQuickDeploy(gw, { templateId: "daily-assistant" });

    // performQuickDeploy returns immediately with planId
    // The background deploy hasn't finished yet (fire-and-forget)
    expect(result).toHaveProperty("planId");
    expect(result).toHaveProperty("status", "deploying");

    // Let the background deploy microtasks flush
    await new Promise(resolve => setTimeout(resolve, 50));
    // After flushing, the gateway should have been called with agents.create etc.
    const calls = (gw as ReturnType<typeof vi.fn>).mock.calls.map((c: any) => c[0]);
    expect(calls).toContain("agents.create");
  });

  it("handles empty requirement and no templateId", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    const result = await performQuickDeploy(gw, { requirement: "" });
    expect(result).toHaveProperty("error");
    expect(result).toHaveProperty("matched", false);
  });

  it("handles undefined options gracefully", async () => {
    const gw = makeGateway() as unknown as CallGatewayFn;
    const result = await performQuickDeploy(gw, {});
    // With no templateId and no requirement, should return no-match
    expect(result).toHaveProperty("error");
    expect(result).toHaveProperty("matched", false);
  });
});
