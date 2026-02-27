import { describe, it, expect } from "vitest";
import {
  orchestratorReducer,
  createInitialOrchestratorState,
  createMessage,
  type OrchestratorState,
  type OrchestratorAction,
} from "./orchestrator-state.js";

// ── Helpers ───────────────────────────────────────────────────────────────

function initialState(overrides: Partial<OrchestratorState> = {}): OrchestratorState {
  return { ...createInitialOrchestratorState(), ...overrides };
}

function reduce(state: OrchestratorState, ...actions: OrchestratorAction[]): OrchestratorState {
  return actions.reduce((s, a) => orchestratorReducer(s, a), state);
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("orchestrator-state", () => {
  // ── createInitialOrchestratorState ────────────────────────────────────

  describe("createInitialOrchestratorState", () => {
    it("returns correct initial values", () => {
      const state = createInitialOrchestratorState();
      expect(state.phase).toBe("welcome");
      expect(state.messages).toEqual([]);
      expect(state.currentPlanId).toBeNull();
      expect(state.inputValue).toBe("");
      expect(state.inputDisabled).toBe(false);
      expect(state.templates).toEqual([]);
      expect(state.deployProgress).toBeNull();
      expect(state.successData).toBeNull();
      expect(state.error).toBeNull();
    });

    it("returns a new object each time", () => {
      const a = createInitialOrchestratorState();
      const b = createInitialOrchestratorState();
      expect(a).not.toBe(b);
      expect(a.messages).not.toBe(b.messages);
    });
  });

  // ── createMessage ────────────────────────────────────────────────────

  describe("createMessage", () => {
    it("creates message with correct fields", () => {
      const msg = createMessage("user", "hello");
      expect(msg.role).toBe("user");
      expect(msg.content).toBe("hello");
      expect(msg.id).toMatch(/^msg-\d+-\d+$/);
      expect(msg.timestamp).toBeGreaterThan(0);
      expect(msg.widget).toBeUndefined();
      expect(msg.widgetData).toBeUndefined();
    });

    it("creates message with widget and data", () => {
      const data = { teamName: "test" };
      const msg = createMessage("system", "proposal", "proposal", data);
      expect(msg.widget).toBe("proposal");
      expect(msg.widgetData).toBe(data);
    });

    it("generates unique IDs", () => {
      const ids = new Set(Array.from({ length: 50 }, () => createMessage("user", "x").id));
      expect(ids.size).toBe(50);
    });
  });

  // ── Reducer: OPEN ────────────────────────────────────────────────────

  describe("reducer OPEN", () => {
    it("resets to welcome state", () => {
      const dirty = initialState({
        phase: "error",
        error: "something broke",
        messages: [createMessage("user", "x")],
      });
      const next = orchestratorReducer(dirty, { type: "OPEN" });
      expect(next.phase).toBe("welcome");
      expect(next.messages).toEqual([]);
      expect(next.error).toBeNull();
    });
  });

  // ── Reducer: CLOSE ───────────────────────────────────────────────────

  describe("reducer CLOSE", () => {
    it("sets phase to closed, preserves other fields", () => {
      const state = initialState({ inputValue: "draft" });
      const next = orchestratorReducer(state, { type: "CLOSE" });
      expect(next.phase).toBe("closed");
      expect(next.inputValue).toBe("draft");
    });
  });

  // ── Reducer: SET_TEMPLATES ───────────────────────────────────────────

  describe("reducer SET_TEMPLATES", () => {
    it("sets templates array", () => {
      const templates = [
        { id: "t1", name: "T1", description: "d", agents: [], keywords: [] },
      ] as any;
      const next = orchestratorReducer(initialState(), { type: "SET_TEMPLATES", templates });
      expect(next.templates).toBe(templates);
      expect(next.templates).toHaveLength(1);
    });
  });

  // ── Reducer: ADD_MESSAGE ─────────────────────────────────────────────

  describe("reducer ADD_MESSAGE", () => {
    it("appends message to list", () => {
      const msg1 = createMessage("user", "first");
      const msg2 = createMessage("system", "second");
      const state = reduce(
        initialState(),
        { type: "ADD_MESSAGE", message: msg1 },
        { type: "ADD_MESSAGE", message: msg2 },
      );
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].content).toBe("first");
      expect(state.messages[1].content).toBe("second");
    });

    it("does not mutate original messages array", () => {
      const state = initialState();
      const original = state.messages;
      const next = orchestratorReducer(state, {
        type: "ADD_MESSAGE",
        message: createMessage("user", "x"),
      });
      expect(next.messages).not.toBe(original);
      expect(original).toHaveLength(0);
    });
  });

  // ── Reducer: SET_PHASE ───────────────────────────────────────────────

  describe("reducer SET_PHASE", () => {
    it.each([
      "closed", "welcome", "gathering", "proposing", "proposed",
      "refining", "soul-preview", "deploying", "success", "error",
    ] as const)("transitions to %s", (phase) => {
      const next = orchestratorReducer(initialState(), { type: "SET_PHASE", phase });
      expect(next.phase).toBe(phase);
    });
  });

  // ── Reducer: SET_INPUT ───────────────────────────────────────────────

  describe("reducer SET_INPUT", () => {
    it("updates inputValue", () => {
      const next = orchestratorReducer(initialState(), { type: "SET_INPUT", value: "hello" });
      expect(next.inputValue).toBe("hello");
    });
  });

  // ── Reducer: SET_INPUT_DISABLED ──────────────────────────────────────

  describe("reducer SET_INPUT_DISABLED", () => {
    it("disables input", () => {
      const next = orchestratorReducer(initialState(), { type: "SET_INPUT_DISABLED", disabled: true });
      expect(next.inputDisabled).toBe(true);
    });

    it("enables input", () => {
      const state = initialState({ inputDisabled: true });
      const next = orchestratorReducer(state, { type: "SET_INPUT_DISABLED", disabled: false });
      expect(next.inputDisabled).toBe(false);
    });
  });

  // ── Reducer: SET_PLAN_ID ─────────────────────────────────────────────

  describe("reducer SET_PLAN_ID", () => {
    it("sets current plan ID", () => {
      const next = orchestratorReducer(initialState(), {
        type: "SET_PLAN_ID",
        planId: "orch-20260222-abc12345",
      });
      expect(next.currentPlanId).toBe("orch-20260222-abc12345");
    });
  });

  // ── Reducer: SET_DEPLOY_PROGRESS ─────────────────────────────────────

  describe("reducer SET_DEPLOY_PROGRESS", () => {
    it("sets progress and forces deploying phase", () => {
      const progress = {
        total: 3,
        completed: 1,
        failed: 0,
        agents: [
          { id: "a1", name: "A1", status: "ready" as const },
          { id: "a2", name: "A2", status: "creating" as const },
          { id: "a3", name: "A3", status: "pending" as const },
        ],
      };
      const state = initialState({ phase: "welcome" });
      const next = orchestratorReducer(state, { type: "SET_DEPLOY_PROGRESS", progress });
      expect(next.phase).toBe("deploying");
      expect(next.deployProgress).toBe(progress);
      expect(next.inputDisabled).toBe(true);
    });
  });

  // ── Reducer: DEPLOY_SUCCESS ──────────────────────────────────────────

  describe("reducer DEPLOY_SUCCESS", () => {
    it("sets success data and phase", () => {
      const data = {
        teamDescription: "Customer Support Team",
        agents: [
          { id: "cs-lead", name: "CS Lead", role: "Team lead" },
          { id: "cs-agent", name: "CS Agent", role: "Front-line support" },
        ],
        usageGuide: "Say hello to get started",
      };
      const state = initialState({ phase: "deploying" });
      const next = orchestratorReducer(state, { type: "DEPLOY_SUCCESS", data });
      expect(next.phase).toBe("success");
      expect(next.successData).toBe(data);
      expect(next.inputDisabled).toBe(true);
    });
  });

  // ── Reducer: DEPLOY_ERROR ────────────────────────────────────────────

  describe("reducer DEPLOY_ERROR", () => {
    it("sets error and re-enables input", () => {
      const state = initialState({ phase: "deploying", inputDisabled: true });
      const next = orchestratorReducer(state, { type: "DEPLOY_ERROR", error: "network failure" });
      expect(next.phase).toBe("error");
      expect(next.error).toBe("network failure");
      expect(next.inputDisabled).toBe(false);
    });
  });

  // ── Reducer: RESET ───────────────────────────────────────────────────

  describe("reducer RESET", () => {
    it("returns fresh initial state", () => {
      const dirty = initialState({
        phase: "success",
        messages: [createMessage("user", "x")],
        currentPlanId: "plan-1",
        inputValue: "leftover",
        inputDisabled: true,
        error: "old error",
      });
      const next = orchestratorReducer(dirty, { type: "RESET" });
      expect(next).toEqual(createInitialOrchestratorState());
    });
  });

  // ── Reducer: Unknown action ──────────────────────────────────────────

  describe("reducer unknown action", () => {
    it("returns state unchanged", () => {
      const state = initialState();
      const next = orchestratorReducer(state, { type: "NONEXISTENT" } as any);
      expect(next).toBe(state);
    });
  });

  // ── Reducer: Immutability ────────────────────────────────────────────

  describe("reducer immutability", () => {
    it("never mutates the input state", () => {
      const state = initialState();
      const frozen = Object.freeze({ ...state, messages: Object.freeze([...state.messages]) });

      // These should not throw
      expect(() => orchestratorReducer(frozen as any, { type: "SET_INPUT", value: "x" })).not.toThrow();
      expect(() => orchestratorReducer(frozen as any, { type: "SET_PHASE", phase: "error" })).not.toThrow();
      expect(() => orchestratorReducer(frozen as any, {
        type: "ADD_MESSAGE",
        message: createMessage("user", "y"),
      })).not.toThrow();
    });
  });

  // ── Reducer: Multi-step flow ─────────────────────────────────────────

  describe("multi-step flow", () => {
    it("simulates full welcome → deploy → success lifecycle", () => {
      let state = createInitialOrchestratorState();

      // Welcome → user types
      state = reduce(state,
        { type: "SET_INPUT", value: "build a CS team" },
        { type: "SET_INPUT_DISABLED", disabled: true },
        { type: "ADD_MESSAGE", message: createMessage("user", "build a CS team") },
        { type: "SET_PHASE", phase: "gathering" },
      );
      expect(state.phase).toBe("gathering");
      expect(state.messages).toHaveLength(1);

      // Quick deploy matched → deploying
      state = reduce(state,
        { type: "SET_PLAN_ID", planId: "plan-1" },
        { type: "SET_PHASE", phase: "deploying" },
      );
      expect(state.phase).toBe("deploying");
      expect(state.currentPlanId).toBe("plan-1");

      // Progress updates
      state = orchestratorReducer(state, {
        type: "SET_DEPLOY_PROGRESS",
        progress: {
          total: 2, completed: 1, failed: 0,
          agents: [
            { id: "a1", name: "A1", status: "ready" },
            { id: "a2", name: "A2", status: "creating" },
          ],
        },
      });
      expect(state.deployProgress?.completed).toBe(1);

      // Success
      state = orchestratorReducer(state, {
        type: "DEPLOY_SUCCESS",
        data: {
          teamDescription: "CS Team",
          agents: [
            { id: "a1", name: "A1", role: "Lead" },
            { id: "a2", name: "A2", role: "Agent" },
          ],
          usageGuide: "Start chatting",
        },
      });
      expect(state.phase).toBe("success");
      expect(state.successData?.agents).toHaveLength(2);
    });

    it("simulates welcome → error → retry lifecycle", () => {
      let state = createInitialOrchestratorState();

      state = reduce(state,
        { type: "SET_PHASE", phase: "deploying" },
        { type: "DEPLOY_ERROR", error: "gateway timeout" },
      );
      expect(state.phase).toBe("error");
      expect(state.error).toBe("gateway timeout");

      // Retry
      state = orchestratorReducer(state, { type: "RESET" });
      expect(state.phase).toBe("welcome");
      expect(state.error).toBeNull();
    });
  });

  // ── Community template actions ──────────────────────────────────────

  describe("community template actions", () => {
    it("SET_COMMUNITY_TEMPLATES stores templates and clears loading", () => {
      let state = initialState({ communityLoading: true });
      const templates = [
        { id: "c1", name: "T1", description: "D1", agents: [{ name: "A", role: "R" }] },
        { id: "c2", name: "T2", description: "D2", agents: [{ name: "B", role: "R" }] },
      ];
      state = orchestratorReducer(state, { type: "SET_COMMUNITY_TEMPLATES", templates });
      expect(state.communityTemplates).toHaveLength(2);
      expect(state.communityTemplates[0].name).toBe("T1");
      expect(state.communityLoading).toBe(false);
      expect(state.communityError).toBeNull();
    });

    it("SET_COMMUNITY_LOADING sets loading flag", () => {
      let state = initialState();
      state = orchestratorReducer(state, { type: "SET_COMMUNITY_LOADING", loading: true });
      expect(state.communityLoading).toBe(true);

      state = orchestratorReducer(state, { type: "SET_COMMUNITY_LOADING", loading: false });
      expect(state.communityLoading).toBe(false);
    });

    it("SET_COMMUNITY_ERROR stores error and clears loading", () => {
      let state = initialState({ communityLoading: true });
      state = orchestratorReducer(state, { type: "SET_COMMUNITY_ERROR", error: "Network failed" });
      expect(state.communityError).toBe("Network failed");
      expect(state.communityLoading).toBe(false);
    });

    it("RESET clears community state", () => {
      let state = initialState({
        communityTemplates: [{ id: "c1", name: "T", description: "D", agents: [] }],
        communityLoading: true,
        communityError: "err",
      });
      state = orchestratorReducer(state, { type: "RESET" });
      expect(state.communityTemplates).toEqual([]);
      expect(state.communityLoading).toBe(false);
      expect(state.communityError).toBeNull();
    });

    it("initial state has empty community fields", () => {
      const state = createInitialOrchestratorState();
      expect(state.communityTemplates).toEqual([]);
      expect(state.communityLoading).toBe(false);
      expect(state.communityError).toBeNull();
    });
  });
});
