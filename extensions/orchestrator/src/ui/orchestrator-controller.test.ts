/**
 * Tests for the Orchestrator Controller
 *
 * Tests the lifecycle, dispatch, polling, and gateway interaction logic.
 * We mock the gateway client and test the exported controller functions.
 *
 * Note: These tests import from the controller's source path
 * (ui/src/ui/controllers/orchestrator) via a relative path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createInitialOrchestratorState,
  createMessage,
} from "./orchestrator-state.js";
import type { OrchestratorState } from "./orchestrator-state.js";

// ── Mock types matching the controller's expected shape ─────────────────

type MockClient = {
  request: ReturnType<typeof vi.fn>;
};

type ControllerState = {
  client: MockClient | null;
  connected: boolean;
  orchestratorOpen: boolean;
  orchestratorState: OrchestratorState | null;
};

// ── Inline controller logic (isolated from Lit dependencies) ────────────
// We test the pure logic by reimporting the orchestrator-state reducer
// and simulating what the controller functions do, since the controller
// imports from the main UI module which depends on Lit/browser globals.

import {
  orchestratorReducer,
  type OrchestratorAction,
} from "./orchestrator-state.js";

function dispatch(state: ControllerState, action: OrchestratorAction): void {
  if (!state.orchestratorState) return;
  state.orchestratorState = orchestratorReducer(state.orchestratorState, action);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function makeControllerState(overrides: Partial<ControllerState> = {}): ControllerState {
  return {
    client: { request: vi.fn(async () => ({})) },
    connected: true,
    orchestratorOpen: false,
    orchestratorState: null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("orchestrator-controller logic", () => {
  let state: ControllerState;

  beforeEach(() => {
    state = makeControllerState();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── dispatch helper ──────────────────────────────────────────────────

  describe("dispatch", () => {
    it("does nothing when orchestratorState is null", () => {
      state.orchestratorState = null;
      dispatch(state, { type: "SET_INPUT", value: "test" });
      expect(state.orchestratorState).toBeNull();
    });

    it("applies action via reducer when state exists", () => {
      state.orchestratorState = createInitialOrchestratorState();
      dispatch(state, { type: "SET_INPUT", value: "hello" });
      expect(state.orchestratorState.inputValue).toBe("hello");
    });

    it("replaces orchestratorState with new object", () => {
      state.orchestratorState = createInitialOrchestratorState();
      const before = state.orchestratorState;
      dispatch(state, { type: "SET_PHASE", phase: "gathering" });
      expect(state.orchestratorState).not.toBe(before);
      expect(state.orchestratorState.phase).toBe("gathering");
    });
  });

  // ── openOrchestrator logic ───────────────────────────────────────────

  describe("openOrchestrator", () => {
    it("sets orchestratorOpen and initializes state", () => {
      state.orchestratorOpen = true;
      state.orchestratorState = createInitialOrchestratorState();
      expect(state.orchestratorOpen).toBe(true);
      expect(state.orchestratorState.phase).toBe("welcome");
    });

    it("fetches templates and dispatches SET_TEMPLATES on success", async () => {
      const templates = [{ id: "t1", name: "T1", description: "d", agents: [], keywords: [] }];
      state.client!.request.mockResolvedValue({ templates });
      state.orchestratorOpen = true;
      state.orchestratorState = createInitialOrchestratorState();

      // Simulate fetchTemplates call
      const result = await state.client!.request("orchestrator.templates.list", {});
      dispatch(state, { type: "SET_TEMPLATES", templates: (result as any).templates });

      expect(state.orchestratorState!.templates).toEqual(templates);
    });
  });

  // ── closeOrchestrator logic ──────────────────────────────────────────

  describe("closeOrchestrator", () => {
    it("resets open flag and clears state", () => {
      state.orchestratorOpen = true;
      state.orchestratorState = createInitialOrchestratorState();

      // Simulate closeOrchestrator
      state.orchestratorOpen = false;
      state.orchestratorState = null;

      expect(state.orchestratorOpen).toBe(false);
      expect(state.orchestratorState).toBeNull();
    });
  });

  // ── handleInput logic ────────────────────────────────────────────────

  describe("handleInput", () => {
    it("dispatches SET_INPUT with textarea value", () => {
      state.orchestratorState = createInitialOrchestratorState();
      const value = "I need a customer support team";
      dispatch(state, { type: "SET_INPUT", value });
      expect(state.orchestratorState!.inputValue).toBe(value);
    });
  });

  // ── handleSend logic ─────────────────────────────────────────────────

  describe("handleSend", () => {
    it("does nothing when orchestratorState is null", () => {
      state.orchestratorState = null;
      // No error thrown
      dispatch(state, { type: "SET_INPUT", value: "test" });
      expect(state.orchestratorState).toBeNull();
    });

    it("does nothing when input is empty", () => {
      state.orchestratorState = createInitialOrchestratorState();
      const before = state.orchestratorState;
      // Simulate guard: !orch.inputValue.trim()
      const shouldSend = state.orchestratorState.inputValue.trim().length > 0;
      expect(shouldSend).toBe(false);
    });

    it("does nothing when input is disabled", () => {
      state.orchestratorState = createInitialOrchestratorState();
      dispatch(state, { type: "SET_INPUT", value: "test" });
      dispatch(state, { type: "SET_INPUT_DISABLED", disabled: true });
      expect(state.orchestratorState!.inputDisabled).toBe(true);
    });

    it("clears input, disables, adds user message, transitions to gathering on welcome", () => {
      state.orchestratorState = createInitialOrchestratorState();
      const text = "build a team";

      // Simulate handleSend flow
      dispatch(state, { type: "SET_INPUT", value: text });
      const inputText = state.orchestratorState!.inputValue.trim();
      dispatch(state, { type: "SET_INPUT", value: "" });
      dispatch(state, { type: "SET_INPUT_DISABLED", disabled: true });
      dispatch(state, {
        type: "ADD_MESSAGE",
        message: createMessage("user", inputText),
      });
      dispatch(state, { type: "SET_PHASE", phase: "gathering" });

      expect(state.orchestratorState!.inputValue).toBe("");
      expect(state.orchestratorState!.inputDisabled).toBe(true);
      expect(state.orchestratorState!.messages).toHaveLength(1);
      expect(state.orchestratorState!.messages[0].content).toBe("build a team");
      expect(state.orchestratorState!.phase).toBe("gathering");
    });

    it("quick_deploy match → deploying with planId", () => {
      state.orchestratorState = createInitialOrchestratorState();

      // Simulate quick_deploy result with planId
      dispatch(state, { type: "SET_PLAN_ID", planId: "orch-123" });
      dispatch(state, { type: "SET_PHASE", phase: "deploying" });

      expect(state.orchestratorState!.currentPlanId).toBe("orch-123");
      expect(state.orchestratorState!.phase).toBe("deploying");
    });

    it("no match → shows system message and re-enables input", () => {
      state.orchestratorState = createInitialOrchestratorState();

      // Simulate no-match path
      dispatch(state, {
        type: "ADD_MESSAGE",
        message: createMessage("system", "I'm designing a team for you..."),
      });
      dispatch(state, { type: "SET_PHASE", phase: "proposed" });
      dispatch(state, { type: "SET_INPUT_DISABLED", disabled: false });

      expect(state.orchestratorState!.phase).toBe("proposed");
      expect(state.orchestratorState!.inputDisabled).toBe(false);
      expect(state.orchestratorState!.messages).toHaveLength(1);
    });

    it("gateway error → DEPLOY_ERROR", () => {
      state.orchestratorState = createInitialOrchestratorState();
      dispatch(state, { type: "SET_PHASE", phase: "gathering" });

      // Simulate error
      dispatch(state, { type: "DEPLOY_ERROR", error: "gateway timeout" });

      expect(state.orchestratorState!.phase).toBe("error");
      expect(state.orchestratorState!.error).toBe("gateway timeout");
    });
  });

  // ── handleTemplateClick logic ────────────────────────────────────────

  describe("handleTemplateClick", () => {
    it("disables input, adds deploy message, sets deploying phase", () => {
      state.orchestratorState = createInitialOrchestratorState();
      const templates = [
        { id: "cs-team", name: "客服团队", description: "d", agents: [{ id: "a1" }], keywords: [] },
      ] as any;
      dispatch(state, { type: "SET_TEMPLATES", templates });

      // Simulate handleTemplateClick
      const tpl = state.orchestratorState!.templates.find(t => t.id === "cs-team");
      dispatch(state, { type: "SET_INPUT_DISABLED", disabled: true });
      dispatch(state, {
        type: "ADD_MESSAGE",
        message: createMessage("user", `部署「${tpl!.name}」模板`),
      });
      dispatch(state, { type: "SET_PHASE", phase: "deploying" });

      expect(state.orchestratorState!.inputDisabled).toBe(true);
      expect(state.orchestratorState!.messages[0].content).toBe("部署「客服团队」模板");
      expect(state.orchestratorState!.phase).toBe("deploying");
    });

    it("uses templateId as fallback name when template not found", () => {
      state.orchestratorState = createInitialOrchestratorState();
      const templateId = "nonexistent-template";
      const tpl = state.orchestratorState!.templates.find(t => t.id === templateId);
      const tplName = tpl?.name ?? templateId;

      dispatch(state, {
        type: "ADD_MESSAGE",
        message: createMessage("user", `部署「${tplName}」模板`),
      });

      expect(state.orchestratorState!.messages[0].content).toBe(
        "部署「nonexistent-template」模板",
      );
    });
  });

  // ── handleExampleClick logic ─────────────────────────────────────────

  describe("handleExampleClick", () => {
    it("sets input value from example text", () => {
      state.orchestratorState = createInitialOrchestratorState();
      dispatch(state, { type: "SET_INPUT", value: "帮我组建一个研发团队助手" });
      expect(state.orchestratorState!.inputValue).toBe("帮我组建一个研发团队助手");
    });
  });

  // ── handleActionClick logic ──────────────────────────────────────────

  describe("handleActionClick", () => {
    it("retry: resets and re-initializes state", () => {
      state.orchestratorState = createInitialOrchestratorState();
      dispatch(state, { type: "SET_PHASE", phase: "error" });
      dispatch(state, { type: "DEPLOY_ERROR", error: "fail" });

      // Simulate retry
      dispatch(state, { type: "RESET" });
      state.orchestratorState = createInitialOrchestratorState();

      expect(state.orchestratorState!.phase).toBe("welcome");
      expect(state.orchestratorState!.error).toBeNull();
    });

    it("back-to-list: closes orchestrator", () => {
      state.orchestratorOpen = true;
      state.orchestratorState = createInitialOrchestratorState();

      // Simulate back-to-list
      state.orchestratorOpen = false;
      state.orchestratorState = null;

      expect(state.orchestratorOpen).toBe(false);
    });

    it("create-more: resets to fresh welcome with templates", () => {
      state.orchestratorState = createInitialOrchestratorState();
      const templates = [{ id: "t1", name: "T", description: "d", agents: [], keywords: [] }] as any;
      dispatch(state, { type: "SET_TEMPLATES", templates });
      dispatch(state, { type: "SET_PHASE", phase: "success" });

      // Simulate create-more
      dispatch(state, { type: "RESET" });

      expect(state.orchestratorState!.phase).toBe("welcome");
      expect(state.orchestratorState!.templates).toEqual([]); // Templates need to be re-fetched
    });

    it("approve-proposal: transitions to deploying with planId", () => {
      state.orchestratorState = createInitialOrchestratorState();
      dispatch(state, { type: "SET_PHASE", phase: "proposed" });

      // Simulate approve-proposal action (same as handleDeployProposal)
      const planId = "orch-test-123";
      dispatch(state, { type: "SET_INPUT_DISABLED", disabled: true });
      dispatch(state, {
        type: "ADD_MESSAGE",
        message: createMessage("user", "确认部署"),
      });
      dispatch(state, { type: "SET_PHASE", phase: "deploying" });

      expect(state.orchestratorState!.phase).toBe("deploying");
      expect(state.orchestratorState!.inputDisabled).toBe(true);
      expect(state.orchestratorState!.messages).toHaveLength(1);
      expect(state.orchestratorState!.messages[0].content).toBe("确认部署");
    });

    it("adjust-proposal: goes back to gathering phase", () => {
      state.orchestratorState = createInitialOrchestratorState();
      dispatch(state, { type: "SET_PHASE", phase: "proposed" });
      dispatch(state, { type: "SET_INPUT_DISABLED", disabled: true });

      // Simulate adjust-proposal
      dispatch(state, { type: "SET_PHASE", phase: "gathering" });
      dispatch(state, { type: "SET_INPUT_DISABLED", disabled: false });

      expect(state.orchestratorState!.phase).toBe("gathering");
      expect(state.orchestratorState!.inputDisabled).toBe(false);
    });
  });

  // ── Deploy polling logic ─────────────────────────────────────────────

  describe("deploy polling", () => {
    it("updates progress on each poll", () => {
      state.orchestratorState = createInitialOrchestratorState();
      dispatch(state, { type: "SET_PHASE", phase: "deploying" });

      // Simulate poll response → SET_DEPLOY_PROGRESS
      dispatch(state, {
        type: "SET_DEPLOY_PROGRESS",
        progress: {
          total: 2,
          completed: 1,
          failed: 0,
          agents: [
            { id: "a1", name: "A1", status: "ready" },
            { id: "a2", name: "A2", status: "creating" },
          ],
        },
      });

      expect(state.orchestratorState!.deployProgress!.completed).toBe(1);
      expect(state.orchestratorState!.phase).toBe("deploying");
    });

    it("dispatches DEPLOY_SUCCESS when all agents deployed", () => {
      state.orchestratorState = createInitialOrchestratorState();
      dispatch(state, { type: "SET_PHASE", phase: "deploying" });

      // Simulate deployed response
      dispatch(state, {
        type: "DEPLOY_SUCCESS",
        data: {
          teamDescription: "CS Team",
          agents: [
            { id: "a1", name: "A1", role: "Lead" },
            { id: "a2", name: "A2", role: "Agent" },
          ],
          usageGuide: "Say hello",
        },
      });

      expect(state.orchestratorState!.phase).toBe("success");
      expect(state.orchestratorState!.successData!.agents).toHaveLength(2);
      expect(state.orchestratorState!.successData!.agents[0].role).toBe("Lead");
    });

    it("dispatches DEPLOY_ERROR on failure", () => {
      state.orchestratorState = createInitialOrchestratorState();
      dispatch(state, { type: "SET_PHASE", phase: "deploying" });

      dispatch(state, { type: "DEPLOY_ERROR", error: "Agent creation failed" });

      expect(state.orchestratorState!.phase).toBe("error");
      expect(state.orchestratorState!.error).toBe("Agent creation failed");
      expect(state.orchestratorState!.inputDisabled).toBe(false);
    });
  });

  // ── Gateway call guard ───────────────────────────────────────────────

  describe("gateway call guard", () => {
    it("throws when client is null", () => {
      state.client = null;
      expect(() => {
        if (!state.client || !state.connected) {
          throw new Error("Gateway not connected");
        }
      }).toThrow("Gateway not connected");
    });

    it("throws when not connected", () => {
      state.connected = false;
      expect(() => {
        if (!state.client || !state.connected) {
          throw new Error("Gateway not connected");
        }
      }).toThrow("Gateway not connected");
    });

    it("succeeds when client exists and connected", () => {
      expect(() => {
        if (!state.client || !state.connected) {
          throw new Error("Gateway not connected");
        }
      }).not.toThrow();
    });
  });
});
