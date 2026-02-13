/**
 * Intelligent Dispatch Module — public API.
 *
 * Usage:
 *   import { dispatchRequest } from "../dispatch/index.js";
 *   const decision = await dispatchRequest({ prompt, clawdbotConfig, agentDir, workspaceDir });
 */

export { dispatchRequest } from "./engine.js";
export { applySkillHints } from "./skill-hints.js";
export { loadDispatchConfig, invalidateDispatchConfigCache } from "./config-loader.js";
export { classifyByRules, classifyIntent } from "./intent-classifier.js";
export {
  assessComplexityByRules,
  resolveStrategy,
  scoreToComplexityLevel,
} from "./complexity-classifier.js";

// Layer 11: Telemetry
export {
  recordEvent,
  enrichEvent,
  getMetrics,
  getRecentEvents,
  clearEvents,
  setTelemetryEnabled,
  isTelemetryEnabled,
} from "./dispatch-telemetry.js";

// Layer 12: Cost Estimation
export {
  estimateTokens,
  estimateCost,
  estimateOutputTokens,
  getModelPricing,
  checkBudget,
  recordSpending,
  getSpending,
  suggestModel,
} from "./cost-estimator.js";

// Layer 13: Session Context
export {
  recordTurn,
  analyzeSessionContext,
  adjustComplexity,
  getSessionWindow,
  clearSession,
  clearAllSessions,
} from "./session-context.js";

// Layer 15: Synonym Expansion
export {
  getSynonymIndex,
  buildSynonymIndex,
  expandPromptWithSynonyms,
  calculateSynonymBoost,
  invalidateSynonymIndex,
  registerCustomSynonyms,
} from "./synonym-expander.js";

export type { SynonymIndex, IntentSynonymMap } from "./synonym-expander.js";

// Layer 14: Resource Guard
export {
  checkResources,
  acquireSlot,
  applyResourceGuard,
  recordOutcome,
  getResourceSnapshot,
  configureResourceGuard,
  resetResourceGuard,
} from "./resource-guard.js";

export type {
  ComplexityConfig,
  ComplexityLevel,
  ComplexitySignal,
  ComplexityStrategyConfig,
  DispatchConfig,
  DispatchSettings,
  ExecutionStrategy,
  IntentDefinition,
  RoutingDecision,
  DispatchRequestParams,
  ClassifyIntentResult,
  RuleMatchResult,
} from "./types.js";

export type { DispatchEvent, DispatchMetrics } from "./dispatch-telemetry.js";

export type { CostEstimate, ModelPricing, BudgetCheckResult } from "./cost-estimator.js";

export type { BudgetConfig } from "./types.js";

export type { TurnSnapshot, SessionContextSignal } from "./session-context.js";

export type { ResourceGuardConfig, ResourceCheckResult } from "./resource-guard.js";

// Model Tier Selector
export { buildModelTiers, selectModelByTier, resolveModelForTier } from "./tier-selector.js";

export type { ModelTier, TierSelection, TierSelectionResult } from "./tier-selector.js";
