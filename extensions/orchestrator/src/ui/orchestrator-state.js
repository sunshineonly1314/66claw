function createInitialOrchestratorState() {
  return {
    phase: "welcome",
    messages: [],
    currentPlanId: null,
    inputValue: "",
    inputDisabled: false,
    templates: [],
    communityTemplates: [],
    communityLoading: false,
    communityError: null,
    gatheringQuestions: [],
    proposal: null,
    previewTemplate: null,
    deployProgress: null,
    proposingSteps: [],
    retryingFailed: false,
    hasProvider: null,
    successData: null,
    error: null
  };
}
function orchestratorReducer(state, action) {
  switch (action.type) {
    case "OPEN":
      return { ...createInitialOrchestratorState(), phase: "welcome" };
    case "CLOSE":
      return { ...state, phase: "closed" };
    case "SET_TEMPLATES":
      return { ...state, templates: action.templates };
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.message] };
    case "SET_PHASE":
      return { ...state, phase: action.phase };
    case "SET_INPUT":
      return { ...state, inputValue: action.value };
    case "SET_INPUT_DISABLED":
      return { ...state, inputDisabled: action.disabled };
    case "SET_PLAN_ID":
      return { ...state, currentPlanId: action.planId };
    case "SET_QUESTIONS":
      return {
        ...state,
        phase: "gathering",
        gatheringQuestions: action.questions,
        inputDisabled: false
      };
    case "ANSWER_QUESTION": {
      const questions = state.gatheringQuestions.map(
        (q, i) => i === action.questionIndex ? { ...q, answer: action.answer } : q
      );
      return { ...state, gatheringQuestions: questions };
    }
    case "SET_PROPOSAL":
      return {
        ...state,
        phase: "proposed",
        proposal: action.proposal,
        inputDisabled: false
      };
    case "SET_PREVIEW":
      return {
        ...state,
        phase: "previewing",
        previewTemplate: action.template,
        inputDisabled: true
      };
    case "SET_DEPLOY_PROGRESS":
      return {
        ...state,
        phase: "deploying",
        deployProgress: action.progress,
        inputDisabled: true
      };
    case "DEPLOY_SUCCESS":
      return {
        ...state,
        phase: "success",
        successData: action.data,
        inputDisabled: true
      };
    case "DEPLOY_ERROR":
      return {
        ...state,
        phase: "error",
        error: action.error,
        inputDisabled: false
      };
    case "SET_COMMUNITY_TEMPLATES":
      return { ...state, communityTemplates: action.templates, communityLoading: false, communityError: null };
    case "SET_COMMUNITY_LOADING":
      return { ...state, communityLoading: action.loading };
    case "SET_COMMUNITY_ERROR":
      return { ...state, communityLoading: false, communityError: action.error };
    case "SET_PROPOSING_STEPS":
      return { ...state, proposingSteps: action.steps };
    case "UPDATE_PROPOSING_STEP": {
      const steps = state.proposingSteps.map(
        (s, i) => i === action.index ? { ...s, ...action.step } : s
      );
      return { ...state, proposingSteps: steps };
    }
    case "SET_RETRYING_FAILED":
      return { ...state, retryingFailed: action.retrying };
    case "SET_HAS_PROVIDER":
      return { ...state, hasProvider: action.has };
    case "RESET":
      return createInitialOrchestratorState();
    default:
      return state;
  }
}
let msgCounter = 0;
function createMessage(role, content, widget, widgetData) {
  return {
    id: `msg-${Date.now()}-${++msgCounter}`,
    role,
    content,
    timestamp: Date.now(),
    widget,
    widgetData
  };
}
export {
  createInitialOrchestratorState,
  createMessage,
  orchestratorReducer
};
