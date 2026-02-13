/**
 * Dispatch Telemetry — structured decision logging + performance tracking.
 *
 * Layer 11: Every routing decision is recorded as a structured event.
 * This enables:
 *  - Debugging: "Why did this message go to the expensive model?"
 *  - Optimization: "Which intents trigger LLM classifier most often?"
 *  - Cost tracking: correlate decisions with actual token usage
 *  - Feedback loops: compare decision quality with user satisfaction
 *
 * Design principles:
 *  - Zero overhead when disabled (no allocation until first event)
 *  - Ring buffer — bounded memory, never grows unbounded
 *  - Async-safe — no file I/O on hot path, exportable on demand
 */

import type { ExecutionStrategy, ComplexityLevel, RoutingDecision } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single dispatch telemetry event. */
export type DispatchEvent = {
  /** Monotonic event ID (for ordering). */
  id: number;
  /** ISO timestamp. */
  timestamp: string;
  /** Wall-clock duration of the full dispatch pipeline (ms). */
  durationMs: number;
  /** Input prompt length (chars). */
  promptLength: number;
  /** Whether the prompt contained CJK characters. */
  hasCJK: boolean;

  // --- Classification ---
  /** Which classifier determined the intent ("rules" | "llm" | "default"). */
  classifierUsed: string;
  /** Rule-based classifier latency (ms), 0 if not used. */
  ruleLatencyMs: number;
  /** LLM classifier latency (ms), 0 if not used. */
  llmLatencyMs: number;

  // --- Decision ---
  intent: string;
  confidence: number;
  complexity: ComplexityLevel;
  strategy: ExecutionStrategy;
  complexitySignals: string[];
  /** Whether a model override was applied. */
  modelOverridden: boolean;
  /** Resolved model string ("provider/model") or "default". */
  resolvedModel: string;

  // --- Cost (estimated) ---
  /** Estimated input tokens for the request. */
  estimatedInputTokens: number;
  /** Estimated cost in USD for this routing decision's chosen model. */
  estimatedCostUsd: number;

  // --- Outcome (filled asynchronously after response) ---
  /** Actual tokens used (filled post-response). */
  actualInputTokens?: number;
  actualOutputTokens?: number;
  /** Actual cost in USD (filled post-response). */
  actualCostUsd?: number;
  /** User feedback signal (filled asynchronously). */
  feedbackSignal?: "positive" | "negative" | "neutral";
};

/** Aggregated metrics over a time window. */
export type DispatchMetrics = {
  /** Total events in window. */
  totalEvents: number;
  /** Breakdown by classifier used. */
  classifierBreakdown: Record<string, number>;
  /** Breakdown by intent. */
  intentBreakdown: Record<string, number>;
  /** Breakdown by complexity level. */
  complexityBreakdown: Record<string, number>;
  /** Breakdown by execution strategy. */
  strategyBreakdown: Record<string, number>;

  // --- Performance ---
  /** Average dispatch latency (ms). */
  avgLatencyMs: number;
  /** p95 dispatch latency (ms). */
  p95LatencyMs: number;
  /** Percentage of requests that hit LLM classifier. */
  llmFallbackRate: number;

  // --- Cost ---
  /** Total estimated cost in USD. */
  totalEstimatedCostUsd: number;
  /** Total actual cost in USD (only for events with actuals). */
  totalActualCostUsd: number;
  /** Average cost per request. */
  avgCostPerRequest: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum events kept in the ring buffer. */
const MAX_EVENTS = 1000;

/** CJK character detection. */
const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

// ---------------------------------------------------------------------------
// Ring Buffer
// ---------------------------------------------------------------------------

let events: DispatchEvent[] = [];
/** Index for O(1) lookups by event ID in enrichEvent(). */
let eventIndex = new Map<number, DispatchEvent>();
let nextId = 1;
let enabled = false;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enable or disable telemetry collection.
 * When disabled, recordEvent() is a no-op.
 */
export function setTelemetryEnabled(flag: boolean): void {
  enabled = flag;
}

export function isTelemetryEnabled(): boolean {
  return enabled;
}

/**
 * Record a dispatch event. Call this at the end of dispatchRequest().
 *
 * @param partial - Event fields that are known at dispatch time.
 *                  `id` and `timestamp` are auto-filled.
 * @returns The event ID (for later enrichment), or -1 if disabled.
 */
export function recordEvent(partial: Omit<DispatchEvent, "id" | "timestamp">): number {
  if (!enabled) return -1;

  const event: DispatchEvent = {
    id: nextId++,
    timestamp: new Date().toISOString(),
    ...partial,
  };

  events.push(event);
  eventIndex.set(event.id, event);

  // Ring buffer — trim oldest events
  if (events.length > MAX_EVENTS) {
    const removed = events.slice(0, events.length - MAX_EVENTS);
    for (const r of removed) eventIndex.delete(r.id);
    events = events.slice(events.length - MAX_EVENTS);
  }

  return event.id;
}

/**
 * Enrich an existing event with post-response actuals.
 * Called after the LLM response completes.
 */
export function enrichEvent(
  eventId: number,
  actuals: {
    actualInputTokens?: number;
    actualOutputTokens?: number;
    actualCostUsd?: number;
    feedbackSignal?: "positive" | "negative" | "neutral";
  },
): boolean {
  const event = eventIndex.get(eventId);
  if (!event) return false;

  if (actuals.actualInputTokens !== undefined) event.actualInputTokens = actuals.actualInputTokens;
  if (actuals.actualOutputTokens !== undefined)
    event.actualOutputTokens = actuals.actualOutputTokens;
  if (actuals.actualCostUsd !== undefined) event.actualCostUsd = actuals.actualCostUsd;
  if (actuals.feedbackSignal !== undefined) event.feedbackSignal = actuals.feedbackSignal;
  return true;
}

/**
 * Build a dispatch event from a RoutingDecision and timing info.
 * Convenience helper called from engine.ts.
 */
export function buildEventFromDecision(params: {
  decision: RoutingDecision;
  prompt: string;
  durationMs: number;
  ruleLatencyMs: number;
  llmLatencyMs: number;
  estimatedInputTokens: number;
  estimatedCostUsd: number;
}): Omit<DispatchEvent, "id" | "timestamp"> {
  const { decision, prompt } = params;
  const modelStr = decision.modelOverride
    ? `${decision.modelOverride.provider}/${decision.modelOverride.model}`
    : "default";

  return {
    durationMs: params.durationMs,
    promptLength: prompt.length,
    hasCJK: CJK_RE.test(prompt),
    classifierUsed: decision.classifierUsed,
    ruleLatencyMs: params.ruleLatencyMs,
    llmLatencyMs: params.llmLatencyMs,
    intent: decision.intent,
    confidence: decision.confidence,
    complexity: decision.complexity,
    strategy: decision.strategy,
    complexitySignals: decision.complexitySignals ?? [],
    modelOverridden: decision.modelOverride !== null,
    resolvedModel: modelStr,
    estimatedInputTokens: params.estimatedInputTokens,
    estimatedCostUsd: params.estimatedCostUsd,
  };
}

/**
 * Compute aggregated metrics over recent events.
 *
 * @param windowMs - Only include events from the last N milliseconds.
 *                   0 = all events in the buffer.
 */
export function getMetrics(windowMs = 0): DispatchMetrics {
  const now = Date.now();
  const filtered =
    windowMs > 0 ? events.filter((e) => now - new Date(e.timestamp).getTime() <= windowMs) : events;

  if (filtered.length === 0) {
    return {
      totalEvents: 0,
      classifierBreakdown: {},
      intentBreakdown: {},
      complexityBreakdown: {},
      strategyBreakdown: {},
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      llmFallbackRate: 0,
      totalEstimatedCostUsd: 0,
      totalActualCostUsd: 0,
      avgCostPerRequest: 0,
    };
  }

  // Breakdowns
  const classifierBreakdown: Record<string, number> = {};
  const intentBreakdown: Record<string, number> = {};
  const complexityBreakdown: Record<string, number> = {};
  const strategyBreakdown: Record<string, number> = {};

  const latencies: number[] = [];
  let llmCount = 0;
  let totalEstCost = 0;
  let totalActCost = 0;

  for (const e of filtered) {
    classifierBreakdown[e.classifierUsed] = (classifierBreakdown[e.classifierUsed] ?? 0) + 1;
    intentBreakdown[e.intent] = (intentBreakdown[e.intent] ?? 0) + 1;
    complexityBreakdown[e.complexity] = (complexityBreakdown[e.complexity] ?? 0) + 1;
    strategyBreakdown[e.strategy] = (strategyBreakdown[e.strategy] ?? 0) + 1;

    latencies.push(e.durationMs);
    if (e.classifierUsed === "llm") llmCount++;
    totalEstCost += e.estimatedCostUsd;
    if (e.actualCostUsd !== undefined) totalActCost += e.actualCostUsd;
  }

  // Latency percentiles
  latencies.sort((a, b) => a - b);
  const avgLatencyMs = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
  const p95Idx = Math.min(Math.floor(latencies.length * 0.95), latencies.length - 1);
  const p95LatencyMs = latencies[p95Idx];

  return {
    totalEvents: filtered.length,
    classifierBreakdown,
    intentBreakdown,
    complexityBreakdown,
    strategyBreakdown,
    avgLatencyMs: Math.round(avgLatencyMs * 100) / 100,
    p95LatencyMs,
    llmFallbackRate: Math.round((llmCount / filtered.length) * 100) / 100,
    totalEstimatedCostUsd: Math.round(totalEstCost * 1_000_000) / 1_000_000,
    totalActualCostUsd: Math.round(totalActCost * 1_000_000) / 1_000_000,
    avgCostPerRequest: Math.round((totalEstCost / filtered.length) * 1_000_000) / 1_000_000,
  };
}

/**
 * Get recent events for debugging.
 *
 * @param count - Number of most recent events to return.
 */
export function getRecentEvents(count = 20): DispatchEvent[] {
  return events.slice(-count);
}

/**
 * Export all events as a JSON-serializable array.
 * For persistence or external analysis.
 */
export function exportEvents(): DispatchEvent[] {
  return [...events];
}

/**
 * Clear all recorded events. Primarily for testing.
 */
export function clearEvents(): void {
  events = [];
  eventIndex = new Map();
  nextId = 1;
}
