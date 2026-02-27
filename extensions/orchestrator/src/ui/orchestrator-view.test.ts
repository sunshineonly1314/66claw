/**
 * Tests for Orchestrator View render functions.
 *
 * Since the view uses Lit's html`` template literals, we test the rendered
 * TemplateResult structures rather than DOM output. We verify that the
 * correct components are rendered for each phase and that handlers are wired.
 */
import { describe, it, expect, vi } from "vitest";
import {
  renderOrchestrator,
  renderOrchestratorEntry,
  type OrchestratorHandlers,
} from "./orchestrator-view.js";
import {
  createInitialOrchestratorState,
  createMessage,
  type OrchestratorState,
} from "./orchestrator-state.js";

// ── Helpers ───────────────────────────────────────────────────────────────

function makeHandlers(): OrchestratorHandlers {
  return {
    onClose: vi.fn(),
    onSend: vi.fn(),
    onInput: vi.fn(),
    onKeydown: vi.fn(),
    onTemplateClick: vi.fn(),
    onExampleClick: vi.fn(),
    onActionClick: vi.fn(),
    onAnswerQuestion: vi.fn(),
    onDeployProposal: vi.fn(),
  };
}

function t(key: string, params?: Record<string, string | number>): string {
  // Minimal i18n stub
  if (params) {
    let result = key;
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(`{{${k}}}`, String(v));
    }
    return result;
  }
  return key;
}

function stateWith(overrides: Partial<OrchestratorState> = {}): OrchestratorState {
  return { ...createInitialOrchestratorState(), ...overrides };
}

/**
 * Recursively extract all string values from a Lit TemplateResult.
 * This gives us a flat string representation for content assertions.
 */
function flattenTemplateStrings(result: unknown): string {
  if (result == null || result === false) return "";
  if (typeof result === "string") return result;
  if (typeof result === "number") return String(result);

  // Lit TemplateResult has strings and values
  const tr = result as { strings?: readonly string[]; values?: unknown[] };
  if (tr.strings && tr.values) {
    const parts: string[] = [];
    for (let i = 0; i < tr.strings.length; i++) {
      parts.push(tr.strings[i]);
      if (i < (tr.values?.length ?? 0)) {
        parts.push(flattenTemplateStrings(tr.values![i]));
      }
    }
    return parts.join("");
  }

  // Array of templates
  if (Array.isArray(result)) {
    return result.map(flattenTemplateStrings).join("");
  }

  return String(result);
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("orchestrator-view", () => {
  // ── renderOrchestrator ───────────────────────────────────────────────

  describe("renderOrchestrator", () => {
    it("returns a TemplateResult (not null)", () => {
      const result = renderOrchestrator(stateWith(), makeHandlers(), t);
      expect(result).toBeDefined();
      expect(result).toHaveProperty("strings");
      expect(result).toHaveProperty("values");
    });

    it("renders welcome content in welcome phase", () => {
      const state = stateWith({ phase: "welcome" });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("orch.welcomeTitle");
      expect(text).toContain("orch.welcomeSub");
      expect(text).toContain("orch.sectionCustom");
    });

    it("renders example prompts in welcome phase", () => {
      const state = stateWith({ phase: "welcome" });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("帮我做一个每天总结行业新闻的团队");
    });

    it("renders templates when available", () => {
      const templates = [
        { id: "t1", name: "客服团队", description: "CS team", agents: [{ id: "a" }], keywords: [] },
      ] as any;
      const state = stateWith({ phase: "welcome", templates });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("客服团队");
      expect(text).toContain("CS team");
      expect(text).toContain("orch.templateCreate");
    });

    it("does not render templates section when no templates", () => {
      const state = stateWith({ phase: "welcome", templates: [] });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).not.toContain("orch.sectionTemplates");
    });

    it("does not render thinking indicator in gathering phase", () => {
      const state = stateWith({ phase: "gathering" });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      // Gathering phase shows questions, not thinking indicator
      expect(text).not.toContain("orch.thinking");
    });

    it("renders thinking indicator in proposing phase", () => {
      const state = stateWith({ phase: "proposing" });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("orch.thinking");
    });

    it("renders thinking indicator in refining phase", () => {
      const state = stateWith({ phase: "refining" });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("orch.thinking");
    });

    it("renders deploy progress in deploying phase", () => {
      const state = stateWith({
        phase: "deploying",
        deployProgress: {
          total: 2,
          completed: 1,
          failed: 0,
          agents: [
            { id: "a1", name: "Agent A", status: "ready" },
            { id: "a2", name: "Agent B", status: "creating" },
          ],
        },
      });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("Agent A");
      expect(text).toContain("Agent B");
      expect(text).toContain("50%"); // 1/2 = 50%
    });

    it("renders success view in success phase", () => {
      const state = stateWith({
        phase: "success",
        successData: {
          teamDescription: "My Team",
          agents: [
            { id: "a1", name: "Leader", role: "Team leader" },
            { id: "a2", name: "Worker", role: "Support worker" },
          ],
          usageGuide: "",
        },
      });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("orch.successTitle");
      expect(text).toContain("Leader");
      expect(text).toContain("Worker");
      expect(text).toContain("Team leader");
      expect(text).toContain("orch.startChat");
      expect(text).toContain("orch.backToList");
      expect(text).toContain("orch.createMore");
    });

    it("renders usage guide when available", () => {
      const state = stateWith({
        phase: "success",
        successData: {
          teamDescription: "Team",
          agents: [{ id: "a1", name: "A", role: "R" }],
          usageGuide: "Line 1\n  Guide item 1\n  Guide item 2\nLine 4",
        },
      });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("orch.guideLabel");
      expect(text).toContain("Guide item 1");
      expect(text).toContain("Guide item 2");
    });

    it("renders error view in error phase", () => {
      const state = stateWith({
        phase: "error",
        error: "Deploy failed: gateway timeout",
      });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("Deploy failed: gateway timeout");
      expect(text).toContain("orch.errorRetry");
      expect(text).toContain("orch.errorBack");
    });

    it("renders messages when present", () => {
      const state = stateWith({
        phase: "proposed",
        messages: [
          createMessage("user", "I need a coding team"),
          createMessage("system", "Here is my proposal"),
        ],
      });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("I need a coding team");
      expect(text).toContain("Here is my proposal");
    });

    it("renders compose area for non-terminal phases", () => {
      const state = stateWith({ phase: "welcome" });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("orch.inputPlaceholder");
    });

    it("hides compose area in deploying phase", () => {
      const state = stateWith({ phase: "deploying" });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).not.toContain("orch.inputPlaceholder");
    });

    it("hides compose area in success phase", () => {
      const state = stateWith({
        phase: "success",
        successData: {
          teamDescription: "T",
          agents: [{ id: "a1", name: "A", role: "R" }],
          usageGuide: "",
        },
      });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).not.toContain("orch.inputPlaceholder");
    });

    it("renders header with back button and title", () => {
      const result = renderOrchestrator(stateWith(), makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("orch.back");
      expect(text).toContain("orch.headerTitle");
    });
  });

  // ── renderOrchestratorEntry ──────────────────────────────────────────

  describe("renderOrchestratorEntry", () => {
    it("renders entry button with title and subtitle", () => {
      const onOpen = vi.fn();
      const result = renderOrchestratorEntry(onOpen, t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("orch.entryTitle");
      expect(text).toContain("orch.entrySub");
    });

    it("returns a TemplateResult", () => {
      const result = renderOrchestratorEntry(vi.fn(), t);
      expect(result).toHaveProperty("strings");
      expect(result).toHaveProperty("values");
    });
  });

  // ── Widget rendering ────────────────────────────────────────────────

  describe("proposal widget", () => {
    it("renders proposal data in messages", () => {
      const state = stateWith({
        phase: "proposed",
        messages: [
          createMessage("system", "Here is my proposal:", "proposal", {
            teamName: "CS Support Team",
            agents: [
              { id: "lead", name: "CS Lead", role: "Team leader" },
              { id: "agent", name: "CS Agent", role: "Support rep" },
            ],
            costEstimate: "约 ¥2.50/天",
          }),
        ],
      });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("CS Support Team");
      expect(text).toContain("CS Lead");
      expect(text).toContain("Team leader");
      expect(text).toContain("约 ¥2.50/天");
    });
  });

  describe("questions widget", () => {
    it("renders questions with options", () => {
      const state = stateWith({
        phase: "gathering",
        messages: [
          createMessage("system", "Let me ask:", "questions", {
            questions: [
              { text: "What channels?", options: ["WeChat", "Slack", "Email"] },
              { text: "How many agents?" },
            ],
          }),
        ],
      });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("What channels?");
      expect(text).toContain("WeChat");
      expect(text).toContain("Slack");
      expect(text).toContain("Email");
      expect(text).toContain("How many agents?");
    });
  });

  describe("soul-preview widget", () => {
    it("renders agent SOUL previews with correct i18n keys", () => {
      const state = stateWith({
        phase: "soul-preview",
        messages: [
          createMessage("system", "Review the SOULs:", "soul-preview", {
            agents: [
              { id: "a1", name: "Helper", soulContent: "# SOUL — Helper\n\nYou help users." },
            ],
          }),
        ],
      });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("Helper");
      expect(text).toContain("# SOUL — Helper");
      // Verify the correct i18n keys are used (not the old wrong ones)
      expect(text).toContain("orch.soulToggle");
      expect(text).toContain("orch.soulEdit");
      // Should NOT contain the old wrong keys in SOUL context
      // (orch.back is used in the header, but soul toggle should use orch.soulToggle)
    });
  });

  // ── Deploy progress percentage ───────────────────────────────────────

  describe("deploy progress calculation", () => {
    it("shows 0% when no agents completed", () => {
      const state = stateWith({
        phase: "deploying",
        deployProgress: {
          total: 3, completed: 0, failed: 0,
          agents: [
            { id: "a1", name: "A1", status: "pending" },
            { id: "a2", name: "A2", status: "pending" },
            { id: "a3", name: "A3", status: "pending" },
          ],
        },
      });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("0%");
    });

    it("shows 100% when all agents completed", () => {
      const state = stateWith({
        phase: "deploying",
        deployProgress: {
          total: 2, completed: 2, failed: 0,
          agents: [
            { id: "a1", name: "A1", status: "ready" },
            { id: "a2", name: "A2", status: "ready" },
          ],
        },
      });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("100%");
    });

    it("handles zero total agents gracefully", () => {
      const state = stateWith({
        phase: "deploying",
        deployProgress: {
          total: 0, completed: 0, failed: 0,
          agents: [],
        },
      });
      // Should not throw / divide by zero
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("0%");
    });

    it("uses i18n keys for deploy title and status labels", () => {
      const state = stateWith({
        phase: "deploying",
        deployProgress: {
          total: 3, completed: 1, failed: 1,
          agents: [
            { id: "a1", name: "A1", status: "ready" },
            { id: "a2", name: "A2", status: "creating" },
            { id: "a3", name: "A3", status: "failed" },
          ],
        },
      });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      // Title should use i18n key, not hardcoded Chinese
      expect(text).toContain("orch.deployTitle");
      // Status labels should use i18n keys
      expect(text).toContain("orch.deployStatusReady");
      expect(text).toContain("orch.deployStatusCreating");
      expect(text).toContain("orch.deployStatusFailed");
    });
  });

  // ── Community templates ────────────────────────────────────────────

  describe("community section", () => {
    it("renders community section when templates are loaded", () => {
      const state = stateWith({
        phase: "welcome",
        communityTemplates: [
          {
            id: "c1",
            name: "Community Team",
            description: "A shared template",
            agents: [{ name: "Bot", role: "Worker" }],
            author: "contributor",
            downloads: 42,
          },
        ],
        communityLoading: false,
        communityError: null,
      });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("orch.communitySectionTitle");
      expect(text).toContain("Community Team");
      expect(text).toContain("A shared template");
    });

    it("renders loading skeleton when community is loading", () => {
      const state = stateWith({
        phase: "welcome",
        communityLoading: true,
      });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("orch-skel");
    });

    it("renders error with retry when community load fails", () => {
      const state = stateWith({
        phase: "welcome",
        communityError: "Network error",
        communityLoading: false,
      });
      const result = renderOrchestrator(state, makeHandlers(), t);
      const text = flattenTemplateStrings(result);
      expect(text).toContain("orch.communityLoadError");
      expect(text).toContain("orch.communityRetry");
    });
  });
});
