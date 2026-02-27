/**
 * Orchestrator Controller
 *
 * Lifecycle manager that connects the orchestrator view (reducer + render)
 * to the gateway backend. Dispatches actions, polls deploy status,
 * manages the open/close lifecycle.
 *
 * Pattern: same as agents.ts / smart-dispatch.ts — export plain functions
 * that mutate the Lit reactive state proxy.
 */

import type { GatewayBrowserClient } from "../gateway";
import {
  type OrchestratorState,
  type OrchestratorAction,
  orchestratorReducer,
  createInitialOrchestratorState,
  createMessage,
} from "../../../../extensions/orchestrator/src/ui/orchestrator-state";
import {
  fetchTemplates,
  fetchCommunityTemplates,
  quickDeployTemplate,
  pollDeployStatus,
  toDeployProgress,
  deployProposal,
  proposeTeam,
  type GatewayCallFn,
  type DeployStatusResponse,
} from "../../../../extensions/orchestrator/src/ui/orchestrator-gateway";
import {
  generateGatheringQuestions,
  buildAnswersMap,
} from "../../../../extensions/orchestrator/src/guided/gathering-questions";

// ── State Slice ─────────────────────────────────────────────────────────

export type OrchestratorControllerState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  orchestratorOpen: boolean;
  orchestratorState: OrchestratorState | null;
};

// ── Internal: remember the user's original requirement ──────────────────

let _userRequirement = "";

// ── Dispatch Helper ─────────────────────────────────────────────────────

function dispatch(state: OrchestratorControllerState, action: OrchestratorAction): void {
  if (!state.orchestratorState) return;
  state.orchestratorState = orchestratorReducer(state.orchestratorState, action);
}

function callGateway(state: OrchestratorControllerState): GatewayCallFn {
  return async (method: string, params: Record<string, unknown>) => {
    if (!state.client || !state.connected) {
      throw new Error("Gateway not connected");
    }
    return state.client.request(method, params);
  };
}

// ── Open / Close ────────────────────────────────────────────────────────

/**
 * Open the orchestrator view. Initializes state and fetches templates.
 */
export async function openOrchestrator(state: OrchestratorControllerState): Promise<void> {
  state.orchestratorOpen = true;
  state.orchestratorState = createInitialOrchestratorState();
  _userRequirement = "";

  const gw = callGateway(state);

  // Fetch builtin templates in background
  try {
    const templates = await fetchTemplates(gw);
    dispatch(state, { type: "SET_TEMPLATES", templates });
  } catch {
    // Templates are optional — welcome screen still works without them
  }

  // Fetch community templates in background (non-blocking)
  void loadCommunityTemplates(state);
}

/**
 * Close the orchestrator view and reset state.
 */
export function closeOrchestrator(state: OrchestratorControllerState): void {
  state.orchestratorOpen = false;
  state.orchestratorState = null;
  _userRequirement = "";
  // Stop any active polling
  stopPolling();
}

// ── Template Quick Deploy ───────────────────────────────────────────────

/**
 * Handle clicking a template card — trigger quick deploy.
 */
export async function handleTemplateClick(
  state: OrchestratorControllerState,
  templateId: string,
): Promise<void> {
  const orch = state.orchestratorState;
  if (!orch) return;
  const tpl = orch.templates.find(t => t.id === templateId);
  const tplName = tpl?.name ?? templateId;

  dispatch(state, { type: "SET_INPUT_DISABLED", disabled: true });
  dispatch(state, {
    type: "ADD_MESSAGE",
    message: createMessage("user", `部署「${tplName}」模板`),
  });
  dispatch(state, { type: "SET_PHASE", phase: "deploying" });

  try {
    const gw = callGateway(state);
    const result = await quickDeployTemplate(gw, templateId);
    dispatch(state, { type: "SET_PLAN_ID", planId: result.planId });

    // Start polling for deploy progress
    await startPolling(state, result.planId);
  } catch (err) {
    dispatch(state, { type: "DEPLOY_ERROR", error: String(err) });
  }
}

// ── Example Click ───────────────────────────────────────────────────────

/**
 * Handle clicking an example prompt — fill input and send.
 */
export function handleExampleClick(
  state: OrchestratorControllerState,
  text: string,
): void {
  dispatch(state, { type: "SET_INPUT", value: text });
}

// ── User Input ──────────────────────────────────────────────────────────

/**
 * Handle input change.
 */
export function handleInput(state: OrchestratorControllerState, e: Event): void {
  const value = (e.target as HTMLTextAreaElement).value;
  dispatch(state, { type: "SET_INPUT", value });
}

/**
 * Handle Enter key press.
 */
export function handleKeydown(state: OrchestratorControllerState, e: KeyboardEvent): void {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    void handleSend(state);
  }
}

/**
 * Send the current input as a user message.
 * Routes to quick_deploy (if it looks like a template match) or guided flow.
 */
export async function handleSend(state: OrchestratorControllerState): Promise<void> {
  const orch = state.orchestratorState;
  if (!orch || !orch.inputValue.trim() || orch.inputDisabled) return;

  const text = orch.inputValue.trim();
  dispatch(state, { type: "SET_INPUT", value: "" });
  dispatch(state, { type: "SET_INPUT_DISABLED", disabled: true });
  dispatch(state, {
    type: "ADD_MESSAGE",
    message: createMessage("user", text),
  });

  // If in welcome phase, this is the initial requirement
  if (orch.phase === "welcome") {
    _userRequirement = text;

    try {
      const gw = callGateway(state);

      // Try quick_deploy first — the backend will attempt template matching
      const result = await gw("orchestrator.quick_deploy", { requirement: text }) as {
        planId?: string;
        status?: string;
        error?: string;
        matched?: boolean;
      };

      if (result.planId) {
        dispatch(state, { type: "SET_PLAN_ID", planId: result.planId });
        dispatch(state, { type: "SET_PHASE", phase: "deploying" });
        await startPolling(state, result.planId);
      } else {
        // No template matched — generate clarifying questions
        dispatch(state, {
          type: "ADD_MESSAGE",
          message: createMessage(
            "system",
            "没有完全匹配的模板，让我帮你定制一个团队。先回答几个问题，我才能更好地为你规划：",
          ),
        });

        const questions = generateGatheringQuestions(text);
        dispatch(state, { type: "SET_QUESTIONS", questions });
      }
    } catch {
      // Gateway might not have the quick_deploy method yet — fall back to local questions
      dispatch(state, {
        type: "ADD_MESSAGE",
        message: createMessage(
          "system",
          "让我帮你定制一个团队。先回答几个问题：",
        ),
      });
      const questions = generateGatheringQuestions(text);
      dispatch(state, { type: "SET_QUESTIONS", questions });
    }
    return;
  }

  // For other phases (proposed, gathering, etc.) — accept user follow-up
  dispatch(state, {
    type: "ADD_MESSAGE",
    message: createMessage("system", "收到，正在处理你的反馈..."),
  });
  dispatch(state, { type: "SET_INPUT_DISABLED", disabled: false });
}

// ── Question Answers ────────────────────────────────────────────────────

/**
 * Handle clicking an option on a gathering question.
 */
export function handleAnswerQuestion(
  state: OrchestratorControllerState,
  questionIndex: number,
  answer: string,
): void {
  dispatch(state, { type: "ANSWER_QUESTION", questionIndex, answer });
}

/**
 * Submit all answered questions and request a team proposal.
 */
export async function handleSubmitAnswers(
  state: OrchestratorControllerState,
): Promise<void> {
  const orch = state.orchestratorState;
  if (!orch) return;

  const answers = buildAnswersMap(orch.gatheringQuestions, _userRequirement);

  dispatch(state, { type: "SET_INPUT_DISABLED", disabled: true });
  dispatch(state, {
    type: "ADD_MESSAGE",
    message: createMessage("system", "收到，正在为你规划团队方案..."),
  });
  dispatch(state, { type: "SET_PHASE", phase: "proposing" });

  try {
    const gw = callGateway(state);
    const result = await proposeTeam(gw, _userRequirement, answers);

    dispatch(state, {
      type: "SET_PROPOSAL",
      proposal: {
        planId: result.planId,
        teamName: result.teamName,
        teamDescription: result.teamDescription,
        agents: result.agents,
        costEstimate: result.costEstimate,
      },
    });
    dispatch(state, {
      type: "ADD_MESSAGE",
      message: createMessage("system", "方案已生成，看看是否满意："),
    });
  } catch (err) {
    dispatch(state, { type: "DEPLOY_ERROR", error: String(err) });
  }
}

// ── Deploy Proposal ─────────────────────────────────────────────────────

/**
 * Deploy the proposed team plan.
 */
export async function handleDeployProposal(
  state: OrchestratorControllerState,
  planId: string,
): Promise<void> {
  dispatch(state, { type: "SET_INPUT_DISABLED", disabled: true });
  dispatch(state, {
    type: "ADD_MESSAGE",
    message: createMessage("user", "确认部署"),
  });
  dispatch(state, { type: "SET_PHASE", phase: "deploying" });

  try {
    const gw = callGateway(state);
    await deployProposal(gw, planId);
    await startPolling(state, planId);
  } catch (err) {
    dispatch(state, { type: "DEPLOY_ERROR", error: String(err) });
  }
}

// ── Community Templates ──────────────────────────────────────────────────

async function loadCommunityTemplates(state: OrchestratorControllerState): Promise<void> {
  dispatch(state, { type: "SET_COMMUNITY_LOADING", loading: true });
  try {
    const gw = callGateway(state);
    const templates = await fetchCommunityTemplates(gw);
    dispatch(state, { type: "SET_COMMUNITY_TEMPLATES", templates });
  } catch (err) {
    dispatch(state, { type: "SET_COMMUNITY_ERROR", error: String(err) });
  }
}

// ── Action Clicks ───────────────────────────────────────────────────────

/**
 * Handle generic action buttons (retry, back-to-list, create-more, start-chat, submit-answers, adjust-proposal).
 */
export function handleActionClick(
  state: OrchestratorControllerState,
  action: string,
  _data?: unknown,
): void {
  switch (action) {
    case "retry":
      dispatch(state, { type: "RESET" });
      void openOrchestrator(state);
      break;

    case "back-to-list":
      closeOrchestrator(state);
      break;

    case "create-more":
      dispatch(state, { type: "RESET" });
      _userRequirement = "";
      // Re-fetch templates
      void fetchTemplates(callGateway(state))
        .then(templates => dispatch(state, { type: "SET_TEMPLATES", templates }))
        .catch(() => {});
      // Re-fetch community templates
      void loadCommunityTemplates(state);
      break;

    case "start-chat": {
      // _data is the agentId — close orchestrator and navigate to chat
      const agentId = typeof _data === "string" ? _data : undefined;
      closeOrchestrator(state);
      // Dispatch custom event so app.ts can navigate to the agent's chat
      if (agentId && typeof globalThis.dispatchEvent === "function") {
        globalThis.dispatchEvent(
          new CustomEvent("orch:navigate-to-agent", { detail: { agentId } }),
        );
      }
      break;
    }

    case "submit-answers":
      void handleSubmitAnswers(state);
      break;

    case "approve-proposal": {
      const planId = typeof _data === "string" ? _data : undefined;
      if (planId) {
        void handleDeployProposal(state, planId);
      }
      break;
    }

    case "adjust-proposal":
      // Go back to gathering with the same questions
      dispatch(state, { type: "SET_PHASE", phase: "gathering" });
      dispatch(state, { type: "SET_INPUT_DISABLED", disabled: false });
      break;

    case "answer-question": {
      // From renderQuestionsWidget: data = { index: number, answer: string }
      const qData = _data as { index?: number; answer?: string } | undefined;
      if (qData && typeof qData.index === "number" && typeof qData.answer === "string") {
        dispatch(state, { type: "ANSWER_QUESTION", questionIndex: qData.index, answer: qData.answer });
      }
      break;
    }

    case "reload-community":
      void loadCommunityTemplates(state);
      break;

    case "deploy-community": {
      // Treat community template click like a user requirement — enter guided flow
      const communityId = typeof _data === "string" ? _data : undefined;
      if (!communityId) break;
      const cTpl = state.orchestratorState?.communityTemplates.find(t => t.id === communityId);
      if (cTpl) {
        _userRequirement = cTpl.name;
        dispatch(state, { type: "SET_INPUT", value: "" });
        dispatch(state, { type: "SET_INPUT_DISABLED", disabled: true });
        dispatch(state, {
          type: "ADD_MESSAGE",
          message: createMessage("user", `使用社区模板「${cTpl.name}」`),
        });
        // Show "proposing" first (not "deploying") to avoid blank screen while async runs
        dispatch(state, {
          type: "ADD_MESSAGE",
          message: createMessage("system", "正在匹配模板并准备部署..."),
        });
        dispatch(state, { type: "SET_PHASE", phase: "proposing" });

        const gw = callGateway(state);
        void (async () => {
          try {
            const result = await gw("orchestrator.quick_deploy", { requirement: cTpl.name }) as {
              planId?: string;
            };
            if (result.planId) {
              dispatch(state, { type: "SET_PLAN_ID", planId: result.planId });
              dispatch(state, { type: "SET_PHASE", phase: "deploying" });
              await startPolling(state, result.planId);
            } else {
              dispatch(state, {
                type: "ADD_MESSAGE",
                message: createMessage("system", "让我帮你定制一个团队。先回答几个问题："),
              });
              const questions = generateGatheringQuestions(cTpl.description || cTpl.name);
              dispatch(state, { type: "SET_QUESTIONS", questions });
            }
          } catch {
            dispatch(state, {
              type: "ADD_MESSAGE",
              message: createMessage("system", "让我帮你定制一个团队。先回答几个问题："),
            });
            const questions = generateGatheringQuestions(cTpl.description || cTpl.name);
            dispatch(state, { type: "SET_QUESTIONS", questions });
          }
        })();
      }
      break;
    }
  }
}

// ── Deploy Status Polling ───────────────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | null = null;
/** Active plan ID guard — discard stale poll results from a previous deploy */
let activePollPlanId: string | null = null;
/** Deploy timeout: 5 minutes max polling before declaring failure */
const DEPLOY_TIMEOUT_MS = 5 * 60 * 1000;

function stopPolling(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  activePollPlanId = null;
}

async function startPolling(
  state: OrchestratorControllerState,
  planId: string,
): Promise<void> {
  stopPolling();
  activePollPlanId = planId;
  const gw = callGateway(state);
  const startedAt = Date.now();

  const poll = async () => {
    // Guard: discard if orchestrator was closed or planId changed
    if (activePollPlanId !== planId || !state.orchestratorState) {
      stopPolling();
      return;
    }
    // Guard: timeout — prevent infinite polling
    if (Date.now() - startedAt > DEPLOY_TIMEOUT_MS) {
      stopPolling();
      dispatch(state, { type: "DEPLOY_ERROR", error: "部署超时（超过 5 分钟未完成），请检查日志后重试" });
      return;
    }
    try {
      const response: DeployStatusResponse = await pollDeployStatus(gw, planId);
      // Re-check guard after async call
      if (activePollPlanId !== planId || !state.orchestratorState) {
        stopPolling();
        return;
      }
      const progress = toDeployProgress(response);
      dispatch(state, { type: "SET_DEPLOY_PROGRESS", progress });

      // Check for terminal states
      if (response.status === "deployed") {
        stopPolling();
        dispatch(state, {
          type: "DEPLOY_SUCCESS",
          data: {
            teamDescription: response.plan.teamDescription,
            agents: response.agents.map(a => ({
              id: a.id,
              name: a.name,
              role: a.role,
            })),
            usageGuide: response.plan.usageGuide ?? "",
          },
        });
        // Notify app to refresh the agent list sidebar
        if (typeof globalThis.dispatchEvent === "function") {
          globalThis.dispatchEvent(new CustomEvent("orch:agents-changed"));
        }
      } else if (response.status === "failed") {
        stopPolling();
        const failedAgent = response.agents.find(a => a.error);
        dispatch(state, {
          type: "DEPLOY_ERROR",
          error: failedAgent?.error ?? "Deployment failed",
        });
      }
    } catch (err) {
      // Re-check guard after async error
      if (activePollPlanId !== planId || !state.orchestratorState) return;
      stopPolling();
      dispatch(state, { type: "DEPLOY_ERROR", error: String(err) });
    }
  };

  // First poll immediately
  await poll();

  // Then poll every 2 seconds
  if (state.orchestratorState?.phase === "deploying" && activePollPlanId === planId) {
    pollTimer = setInterval(() => void poll(), 2000);
  }
}
