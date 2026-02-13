/**
 * Session Context Analyzer — multi-turn conversation awareness.
 *
 * Layer 13: Tracks conversation history to improve routing accuracy.
 *
 * Problem: The first message "帮我分析" (help me analyze) looks simple.
 *          But if preceded by a complex research thread, it's a continuation.
 *
 * Solution: Maintain a sliding window of recent interactions and use them
 *           to bias complexity assessment.
 *
 * Signals extracted:
 *  - Turn count: more turns → likely more complex context
 *  - Topic continuity: same intent across turns → deepening investigation
 *  - Complexity trend: escalating complexity across turns → user is digging deeper
 *  - Reference signals: "above", "前面", "刚才" → depends on prior context
 */

import type { ComplexityLevel, ExecutionStrategy } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A snapshot of one turn in the conversation. */
export type TurnSnapshot = {
  /** Turn number (1-indexed). */
  turn: number;
  /** Timestamp of this turn. */
  timestamp: number;
  /** The user's prompt text (truncated for memory). */
  promptSnippet: string;
  /** Intent classified for this turn. */
  intent: string;
  /** Complexity assessed for this turn. */
  complexity: ComplexityLevel;
  /** Strategy used for this turn. */
  strategy: ExecutionStrategy;
  /** Prompt length (full, not truncated). */
  promptLength: number;
};

/** Result of session context analysis. */
export type SessionContextSignal = {
  /** Number of turns in the current session. */
  turnCount: number;
  /** Whether the user appears to be continuing a previous topic. */
  topicContinuation: boolean;
  /** Complexity trend: "escalating" | "stable" | "declining" | "unknown". */
  complexityTrend: "escalating" | "stable" | "declining" | "unknown";
  /** Suggested complexity adjustment (-1, 0, +1 levels). */
  complexityAdjustment: -1 | 0 | 1;
  /** Whether the current prompt references prior context. */
  hasBackReference: boolean;
  /** The dominant intent across the session (mode). */
  dominantIntent: string | null;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum turns to keep in the session window. */
const MAX_WINDOW_SIZE = 20;

/** Maximum snippet length per turn (chars). */
const MAX_SNIPPET_LENGTH = 200;

/** Session timeout: if no interaction for this long, reset session. */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/** Maximum number of concurrent sessions to track (prevents unbounded Map growth). */
const MAX_SESSIONS = 100;

/** Patterns that indicate back-reference to prior conversation. */
const BACK_REFERENCE_RE =
  /上面|前面|刚才|之前|上一个|继续|接着|然后呢|上述|如上|接下来|下一步|补充|再来|mentioned|above|previous|earlier|continue|keep going|go on|as before|next step|furthermore/i;

// ---------------------------------------------------------------------------
// Session State (per-conversation)
// ---------------------------------------------------------------------------

/**
 * Session store — keyed by sessionId.
 * In a single-user CLI context, there's typically one active session.
 */
const sessions = new Map<string, TurnSnapshot[]>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a completed turn in the session.
 */
export function recordTurn(sessionId: string, turn: Omit<TurnSnapshot, "turn">): void {
  let window = sessions.get(sessionId);
  if (!window) {
    // Evict oldest sessions when at capacity
    if (sessions.size >= MAX_SESSIONS) {
      let oldestKey: string | undefined;
      let oldestTime = Infinity;
      for (const [key, turns] of sessions) {
        const lastTs = turns.length > 0 ? turns[turns.length - 1].timestamp : 0;
        if (lastTs < oldestTime) {
          oldestTime = lastTs;
          oldestKey = key;
        }
      }
      if (oldestKey) sessions.delete(oldestKey);
    }
    window = [];
    sessions.set(sessionId, window);
  }

  // Check for session timeout
  if (window.length > 0) {
    const lastTurn = window[window.length - 1];
    if (turn.timestamp - lastTurn.timestamp > SESSION_TIMEOUT_MS) {
      // Session expired — reset
      window = [];
      sessions.set(sessionId, window);
    }
  }

  const snapshot: TurnSnapshot = {
    ...turn,
    turn: window.length + 1,
    promptSnippet: turn.promptSnippet.slice(0, MAX_SNIPPET_LENGTH),
  };

  window.push(snapshot);

  // Trim to max window size
  if (window.length > MAX_WINDOW_SIZE) {
    sessions.set(sessionId, window.slice(window.length - MAX_WINDOW_SIZE));
  }
}

/**
 * Analyze the session context to produce routing signals.
 *
 * @param sessionId - Session identifier.
 * @param currentPrompt - The current user prompt (not yet recorded).
 * @param currentIntent - The intent classified for the current prompt.
 */
export function analyzeSessionContext(
  sessionId: string,
  currentPrompt: string,
  currentIntent: string,
): SessionContextSignal {
  const window = sessions.get(sessionId) ?? [];

  if (window.length === 0) {
    return {
      turnCount: 0,
      topicContinuation: false,
      complexityTrend: "unknown",
      complexityAdjustment: 0,
      hasBackReference: false,
      dominantIntent: null,
    };
  }

  // --- Turn count ---
  const turnCount = window.length;

  // --- Back reference detection ---
  const hasBackReference = BACK_REFERENCE_RE.test(currentPrompt);

  // --- Topic continuation ---
  // Check if the current intent matches the most recent turns
  const recentIntents = window.slice(-3).map((t) => t.intent);
  const topicContinuation = recentIntents.includes(currentIntent) || hasBackReference;

  // --- Dominant intent (mode) ---
  const intentCounts: Record<string, number> = {};
  for (const t of window) {
    intentCounts[t.intent] = (intentCounts[t.intent] ?? 0) + 1;
  }
  let dominantIntent: string | null = null;
  let maxCount = 0;
  for (const [intent, count] of Object.entries(intentCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantIntent = intent;
    }
  }

  // --- Complexity trend ---
  const complexityTrend = detectComplexityTrend(window);

  // --- Complexity adjustment ---
  let complexityAdjustment: -1 | 0 | 1 = 0;

  // Back-reference to complex prior context → bump up
  if (hasBackReference && window.length > 0) {
    const lastComplexity = window[window.length - 1].complexity;
    if (lastComplexity === "high") {
      complexityAdjustment = 1;
    }
  }

  // Escalating trend → bump up
  if (complexityTrend === "escalating") {
    complexityAdjustment = 1;
  }

  // Very short follow-up in a simple conversation → might be simple
  if (currentPrompt.length < 20 && complexityTrend === "declining" && !hasBackReference) {
    complexityAdjustment = -1;
  }

  return {
    turnCount,
    topicContinuation,
    complexityTrend,
    complexityAdjustment,
    hasBackReference,
    dominantIntent,
  };
}

/**
 * Apply session context adjustment to a complexity level.
 * Returns the adjusted level.
 */
export function adjustComplexity(
  baseLevel: ComplexityLevel,
  adjustment: -1 | 0 | 1,
): ComplexityLevel {
  if (adjustment === 0) return baseLevel;

  const levels: ComplexityLevel[] = ["low", "medium", "high"];
  const currentIdx = levels.indexOf(baseLevel);
  const newIdx = Math.max(0, Math.min(levels.length - 1, currentIdx + adjustment));
  return levels[newIdx];
}

/**
 * Get the current session window for debugging.
 */
export function getSessionWindow(sessionId: string): TurnSnapshot[] {
  return sessions.get(sessionId) ?? [];
}

/**
 * Clear a session. For testing or explicit session reset.
 */
export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * Clear all sessions. For testing.
 */
export function clearAllSessions(): void {
  sessions.clear();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const COMPLEXITY_ORDER: Record<ComplexityLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/**
 * Detect whether complexity is trending up, down, or stable across recent turns.
 */
function detectComplexityTrend(
  window: TurnSnapshot[],
): "escalating" | "stable" | "declining" | "unknown" {
  if (window.length < 2) return "unknown";

  // Look at the last 5 turns
  const recent = window.slice(-5);
  const values = recent.map((t) => COMPLEXITY_ORDER[t.complexity]);

  // Simple linear trend: compare first half average with second half average
  const mid = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const delta = secondAvg - firstAvg;

  if (delta > 0.3) return "escalating";
  if (delta < -0.3) return "declining";
  return "stable";
}
