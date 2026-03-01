import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the state module (filesystem operations) ─────────────────────────
vi.mock("./state.js", () => {
  const plans = new Map<string, unknown>();
  const states = new Map<string, unknown>();
  let planIdCounter = 0;
  return {
    initStateDir: vi.fn(),
    generatePlanId: vi.fn(() => `orch-20260222-${String(++planIdCounter).padStart(8, "0")}`),
    savePlan: vi.fn(async (plan: { planId: string }) => { plans.set(plan.planId, plan); }),
    loadPlan: vi.fn(async (id: string) => plans.get(id) ?? null),
    saveState: vi.fn(async (state: { planId: string }) => { states.set(state.planId, state); }),
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
      // Compute overall
      ...(status === "ready" && state.agents.every((a: any) => a.agentId === agentId || a.status === "ready")
        ? { status: "deployed", deployFinishedAt: new Date().toISOString() }
        : {}),
      ...(status === "failed" ? { status: "failed", error } : {}),
    })),
    // Expose internal maps for test manipulation
    __plans: plans,
    __states: states,
    __resetCounter: () => { planIdCounter = 0; },
  };
});

import { createOrchestrateTool, type CallGatewayFn } from "./orchestrate-tool.js";
import { savePlan, saveState, loadPlan, loadState } from "./state.js";

// Access the internal test helpers exposed by our mock
const stateModule = await import("./state.js") as any;

// ── Helpers ───────────────────────────────────────────────────────────────

function fakeCtx(modelOverride?: string) {
  const config: Record<string, unknown> = {};
  if (modelOverride) {
    config.agents = {
      defaults: {
        model: { primary: modelOverride },
      },
    };
  }
  return { config } as any;
}

function getText(result: any): string {
  return result.content?.[0]?.text ?? "";
}

function makeBlueprints(agents: Array<{ name: string; id: string; role?: string; soul?: string; dependsOn?: string[] }>) {
  return JSON.stringify(
    agents.map((a) => ({
      name: a.name,
      id: a.id,
      role: a.role ?? `Role for ${a.name}`,
      soul: a.soul ?? `# SOUL — ${a.name}`,
      emoji: "🤖",
      modelTier: "mid",
      dependsOn: a.dependsOn,
    })),
  );
}

let mockGateway: ReturnType<typeof vi.fn>;

function createTool(ctx?: any) {
  return createOrchestrateTool(ctx ?? fakeCtx(), mockGateway as any);
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("orchestrate-tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset state stores
    stateModule.__plans?.clear?.();
    stateModule.__states?.clear?.();
    stateModule.__resetCounter?.();
    mockGateway = vi.fn(async () => ({}));
  });

  // ── templates action ──

  describe("action: templates", () => {
    it("returns template listing", async () => {
      const tool = createTool();
      const result = await tool.execute("t1", { action: "templates" });
      const text = getText(result);
      expect(text).toContain("Available Templates");
      expect(text).toContain("daily-assistant");
      expect(text).toContain("finance-tracker");
    });
  });

  // ── plan action ──

  describe("action: plan", () => {
    it("errors when requirement is missing", async () => {
      const tool = createTool();
      const result = await tool.execute("t1", { action: "plan" });
      expect(getText(result)).toContain("Error: requirement is required");
    });

    it("creates plan from LLM blueprints", async () => {
      const tool = createTool();
      const blueprints = makeBlueprints([
        { name: "Helper", id: "helper" },
        { name: "Worker", id: "worker" },
      ]);
      const result = await tool.execute("t1", {
        action: "plan",
        requirement: "build a team",
        agentBlueprints: blueprints,
        teamDescription: "Test team",
      });
      const text = getText(result);
      expect(text).toContain("Orchestration Plan");
      expect(text).toContain("helper");
      expect(text).toContain("worker");
      expect(text).toContain("Test team");
      expect(savePlan).toHaveBeenCalled();
      expect(saveState).toHaveBeenCalled();
    });

    it("matches template when no blueprints provided", async () => {
      const tool = createTool();
      const result = await tool.execute("t1", {
        action: "plan",
        requirement: "帮我搞个人财务管理，记账和消费分析",
      });
      const text = getText(result);
      expect(text).toContain("finance-tracker");
      expect(text).toContain("bookkeeper");
    });

    it("uses explicit templateId", async () => {
      const tool = createTool();
      const result = await tool.execute("t1", {
        action: "plan",
        requirement: "anything",
        templateId: "learning-planner",
      });
      const text = getText(result);
      expect(text).toContain("learning-planner");
      expect(text).toContain("study-planner");
    });

    it("errors when no blueprints and no template match", async () => {
      const tool = createTool();
      const result = await tool.execute("t1", {
        action: "plan",
        requirement: "something very abstract",
      });
      expect(getText(result)).toContain("No agentBlueprints provided");
    });

    it("errors on invalid JSON in agentBlueprints", async () => {
      const tool = createTool();
      const result = await tool.execute("t1", {
        action: "plan",
        requirement: "test",
        agentBlueprints: "not-valid-json{",
      });
      expect(getText(result)).toContain("Error parsing agentBlueprints JSON");
    });

    it("errors on non-array agentBlueprints", async () => {
      const tool = createTool();
      const result = await tool.execute("t1", {
        action: "plan",
        requirement: "test",
        agentBlueprints: '{"not": "array"}',
      });
      expect(getText(result)).toContain("must be a JSON array");
    });

    // ── Validation ──

    it("rejects duplicate agent ids", async () => {
      const tool = createTool();
      const blueprints = makeBlueprints([
        { name: "A", id: "same-id" },
        { name: "B", id: "same-id" },
      ]);
      const result = await tool.execute("t1", {
        action: "plan",
        requirement: "test",
        agentBlueprints: blueprints,
      });
      expect(getText(result)).toContain("Duplicate agent id");
    });

    it("rejects reserved 'main' agent id", async () => {
      const tool = createTool();
      const blueprints = makeBlueprints([{ name: "Main", id: "main" }]);
      const result = await tool.execute("t1", {
        action: "plan",
        requirement: "test",
        agentBlueprints: blueprints,
      });
      expect(getText(result)).toContain("reserved");
    });

    it("rejects > 10 agents", async () => {
      const tool = createTool();
      const agents = Array.from({ length: 11 }, (_, i) => ({ name: `Agent${i}`, id: `agent-${i}` }));
      const result = await tool.execute("t1", {
        action: "plan",
        requirement: "test",
        agentBlueprints: makeBlueprints(agents),
      });
      expect(getText(result)).toContain("Too many agents");
    });

    it("rejects dependsOn referencing nonexistent agent", async () => {
      const tool = createTool();
      const blueprints = makeBlueprints([
        { name: "A", id: "a", dependsOn: ["nonexistent"] },
      ]);
      const result = await tool.execute("t1", {
        action: "plan",
        requirement: "test",
        agentBlueprints: blueprints,
      });
      expect(getText(result)).toContain("no agent with that id exists");
    });

    it("rejects self-dependency", async () => {
      const tool = createTool();
      const blueprints = makeBlueprints([
        { name: "A", id: "a", dependsOn: ["a"] },
      ]);
      const result = await tool.execute("t1", {
        action: "plan",
        requirement: "test",
        agentBlueprints: blueprints,
      });
      expect(getText(result)).toContain("depends on itself");
    });

    it("rejects circular dependencies", async () => {
      const tool = createTool();
      const blueprints = makeBlueprints([
        { name: "A", id: "a", dependsOn: ["b"] },
        { name: "B", id: "b", dependsOn: ["a"] },
      ]);
      const result = await tool.execute("t1", {
        action: "plan",
        requirement: "test",
        agentBlueprints: blueprints,
      });
      expect(getText(result)).toContain("Circular dependency");
    });

    it("rejects empty/dash-only agent ids from Chinese names", async () => {
      const tool = createTool();
      // Chinese-only name normalizes to all dashes
      const blueprints = JSON.stringify([
        { name: "记账助手", id: "", role: "记账", soul: "# SOUL" },
      ]);
      const result = await tool.execute("t1", {
        action: "plan",
        requirement: "test",
        agentBlueprints: blueprints,
      });
      // After normalizeBlueprint, id becomes name-based "-" (all Chinese → dashes)
      // Validation should catch invalid id
      expect(getText(result)).toContain("invalid id");
    });

    // ── Model gate ──

    it("blocks cheap-tier model", async () => {
      const tool = createTool(fakeCtx("qwen-dashscope/qwen-turbo"));
      const result = await tool.execute("t1", {
        action: "plan",
        requirement: "test",
        agentBlueprints: makeBlueprints([{ name: "A", id: "a" }]),
      });
      expect(getText(result)).toContain("Model Gate: Blocked");
    });

    it("includes model warning for mid-tier", async () => {
      const tool = createTool(fakeCtx("anthropic/gpt-4o"));
      const result = await tool.execute("t1", {
        action: "plan",
        requirement: "test",
        agentBlueprints: makeBlueprints([{ name: "A", id: "a" }]),
      });
      const text = getText(result);
      expect(text).toContain("Note:");
      // Should still create the plan
      expect(text).toContain("Orchestration Plan");
    });

    it("resolves model from string config format", async () => {
      const ctx = {
        config: {
          agents: { defaults: { model: "deepseek/deepseek-reasoner" } },
        },
      } as any;
      const tool = createOrchestrateTool(ctx, mockGateway as any);
      const result = await tool.execute("t1", {
        action: "plan",
        requirement: "test",
        agentBlueprints: makeBlueprints([{ name: "A", id: "a" }]),
      });
      // deepseek-reasoner is mid → should have warning but be allowed
      const text = getText(result);
      expect(text).toContain("Orchestration Plan");
    });
  });

  // ── confirm action ──

  describe("action: confirm", () => {
    it("errors without planId", async () => {
      const tool = createTool();
      const result = await tool.execute("t1", { action: "confirm" });
      expect(getText(result)).toContain("planId is required");
    });

    it("errors when plan not found", async () => {
      const tool = createTool();
      const result = await tool.execute("t1", { action: "confirm", planId: "nonexistent" });
      expect(getText(result)).toContain("not found");
    });

    it("transitions state to deploying", async () => {
      // Pre-populate state
      stateModule.__states.set("plan-1", {
        planId: "plan-1",
        status: "confirming",
        agents: [],
      });

      const tool = createTool();
      const result = await tool.execute("t1", { action: "confirm", planId: "plan-1" });
      const text = getText(result);
      expect(text).toContain("confirmed");
      expect(text).toContain("deploy");
      expect(saveState).toHaveBeenCalled();
    });

    it("rejects confirm when not in confirming state", async () => {
      stateModule.__states.set("plan-1", {
        planId: "plan-1",
        status: "deployed",
        agents: [],
      });

      const tool = createTool();
      const result = await tool.execute("t1", { action: "confirm", planId: "plan-1" });
      expect(getText(result)).toContain("expected \"confirming\"");
    });
  });

  // ── deploy action ──

  describe("action: deploy", () => {
    it("errors without planId", async () => {
      const tool = createTool();
      const result = await tool.execute("t1", { action: "deploy" });
      expect(getText(result)).toContain("planId is required");
    });

    it("deploys agents calling gateway methods in order", async () => {
      const plan = {
        planId: "plan-1",
        agents: [
          { id: "a1", name: "Agent1", emoji: "🔧", soul: "# A1", role: "role1", modelTier: "mid", tools: { allow: ["group:memory"], profile: "minimal" } },
        ],
        teamDescription: "test",
        createdAt: "2026-01-01",
      };
      stateModule.__plans.set("plan-1", plan);
      stateModule.__states.set("plan-1", {
        planId: "plan-1",
        status: "deploying",
        agents: [{ agentId: "a1", blueprintId: "a1", status: "pending" }],
      });

      // Mock config.get to return hash, agents.list for conflict detection
      mockGateway.mockImplementation(async (method: string) => {
        if (method === "config.get") return { hash: "abc123" };
        if (method === "agents.list") return [];
        return {};
      });

      const tool = createTool();
      const result = await tool.execute("t1", { action: "deploy", planId: "plan-1" });
      const text = getText(result);
      expect(text).toContain("Deployment");

      // Verify gateway calls
      const calls = mockGateway.mock.calls.map((c: any) => c[0]);
      expect(calls).toContain("agents.list");     // S1-2: conflict detection
      expect(calls).toContain("agents.create");
      expect(calls).toContain("agents.files.set");
      expect(calls).toContain("config.get");
      expect(calls).toContain("config.patch");

      // Verify agents.create uses namespaced ID (S1-1)
      const createCall = mockGateway.mock.calls.find((c: any) => c[0] === "agents.create");
      expect(createCall![1]).toMatchObject({
        name: "Agent1",
        id: "plan-1--a1",  // deployAgentId("plan-1", "a1") = first 12 chars + "--" + localId
        emoji: "🔧",
      });
      // Workspace uses namespaced ID
      expect(createCall![1].workspace).toContain("plan-1--a1");

      // Verify workspace files are written with namespaced agentId
      // Deploy writes: SOUL.md, AGENTS.md, TOOLS.md, BOOTSTRAP.md
      const filesSetCalls = mockGateway.mock.calls.filter((c: any) => c[0] === "agents.files.set");
      expect(filesSetCalls.length).toBeGreaterThanOrEqual(1);
      const soulCall = filesSetCalls.find((c: any) => c[1].name === "SOUL.md");
      expect(soulCall).toBeTruthy();
      expect(soulCall![1].agentId).toBe("plan-1--a1");
      // All file writes should target the same namespaced agent
      for (const call of filesSetCalls) {
        expect(call[1].agentId).toBe("plan-1--a1");
      }

      // Verify config.patch is batched at end (S1-4) and includes baseHash
      const patchCall = mockGateway.mock.calls.find((c: any) => c[0] === "config.patch");
      expect(patchCall![1].baseHash).toBe("abc123");
      const raw = JSON.parse(patchCall![1].raw);
      expect(raw.agents.list[0].id).toBe("plan-1--a1");
      expect(raw.agents.list[0].tools.allow).toEqual(["group:memory"]);
    });

    it("handles agent creation failure gracefully", async () => {
      stateModule.__plans.set("plan-1", {
        planId: "plan-1",
        agents: [
          { id: "a1", name: "Agent1", soul: "# A1", role: "r", modelTier: "mid", tools: { allow: [] } },
        ],
        teamDescription: "test",
      });
      stateModule.__states.set("plan-1", {
        planId: "plan-1",
        status: "deploying",
        agents: [{ agentId: "a1", blueprintId: "a1", status: "pending" }],
      });

      mockGateway.mockImplementation(async (method: string) => {
        if (method === "agents.list") return [];  // S1-2: conflict check passes
        throw new Error("gateway down");
      });

      const tool = createTool();
      const result = await tool.execute("t1", { action: "deploy", planId: "plan-1" });
      const text = getText(result);
      expect(text).toContain("[FAIL]");
      expect(text).toContain("gateway down");
    });

    it("rejects deploy when not in deploying state", async () => {
      stateModule.__plans.set("plan-1", { planId: "plan-1", agents: [] });
      stateModule.__states.set("plan-1", { planId: "plan-1", status: "confirming", agents: [] });

      const tool = createTool();
      const result = await tool.execute("t1", { action: "deploy", planId: "plan-1" });
      expect(getText(result)).toContain("Must be \"deploying\"");
    });
  });

  // ── status action ──

  describe("action: status", () => {
    it("shows plan status", async () => {
      stateModule.__plans.set("plan-1", {
        planId: "plan-1",
        agents: [{ id: "a1", name: "Agent1", emoji: "🔧", modelTier: "mid", tools: {} }],
        teamDescription: "Test",
        createdAt: "2026-01-01",
      });
      stateModule.__states.set("plan-1", {
        planId: "plan-1",
        status: "deployed",
        agents: [{ agentId: "a1", blueprintId: "a1", status: "ready" }],
      });

      const tool = createTool();
      const result = await tool.execute("t1", { action: "status", planId: "plan-1" });
      const text = getText(result);
      expect(text).toContain("deployed");
      expect(text).toContain("Agent1");
    });
  });

  // ── rollback action ──

  describe("action: rollback", () => {
    it("calls agents.delete for non-pending agents with namespaced ID", async () => {
      stateModule.__plans.set("plan-1", {
        planId: "plan-1",
        agents: [
          { id: "a1", name: "A1" },
          { id: "a2", name: "A2" },
        ],
      });
      stateModule.__states.set("plan-1", {
        planId: "plan-1",
        status: "deployed",
        agents: [
          { agentId: "a1", blueprintId: "a1", status: "ready" },
          { agentId: "a2", blueprintId: "a2", status: "pending" },
        ],
      });

      const tool = createTool();
      const result = await tool.execute("t1", { action: "rollback", planId: "plan-1" });
      const text = getText(result);
      expect(text).toContain("Rollback Complete");
      expect(text).toContain("a1");
      // a2 was pending, should not be deleted
      expect(mockGateway).toHaveBeenCalledTimes(1);
      // S1-1: rollback uses namespaced deployed ID
      expect(mockGateway).toHaveBeenCalledWith("agents.delete", {
        agentId: "plan-1--a1",
        deleteFiles: true,
      });
    });
  });

  // ── unknown action ──

  describe("unknown action", () => {
    it("returns error for unknown action", async () => {
      const tool = createTool();
      const result = await tool.execute("t1", { action: "bogus" });
      expect(getText(result)).toContain("Unknown action");
    });
  });
});
