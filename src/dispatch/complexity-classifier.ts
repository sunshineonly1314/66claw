/**
 * Complexity Classifier — rule-based assessment of task complexity.
 *
 * Fast path (< 5ms): analyses prompt length, structure, and linguistic signals
 * to estimate whether a task is simple, medium, or complex.
 *
 * When rule confidence is low, the LLM intent classifier is extended to also
 * return complexity (piggy-backed onto the same API call — zero extra cost).
 */

import type { ComplexityLevel, ComplexitySignal, ExecutionStrategy } from "./types.js";

// ---------------------------------------------------------------------------
// Constants — tuned via the test suite
// ---------------------------------------------------------------------------

/** Score at or above this → "high" complexity. */
const HIGH_THRESHOLD = 0.5;
/** Score at or below this → "low" complexity. */
const LOW_THRESHOLD = 0.2;
/** Score in (LOW_THRESHOLD, HIGH_THRESHOLD) → "medium". */

/**
 * When the score is clearly in the low or high zone, we consider the
 * rule-based result confident enough to skip LLM assessment.
 */
const CONFIDENT_LOW = 0.15;
const CONFIDENT_HIGH = 0.55;

// ---------------------------------------------------------------------------
// CJK detection (reused from intent-classifier)
// ---------------------------------------------------------------------------

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

// ---------------------------------------------------------------------------
// Signal patterns
// ---------------------------------------------------------------------------

// Multi-step indicators (CN + EN)
const MULTI_STEP_RE =
  /首先.*然后|第[一二三四五六七八九十]|step\s*[1-9]|分.*步|多个步骤|阶段|phase\s*[1-9]|1\.\s.*2\.\s/i;

// Multi-dimension / multi-aspect indicators
const MULTI_DIM_RE =
  /以及.*同时|同时.*并且|多个方面|多维度|各[个种方]面|分别|respectively|both.*and.*and|multiple\s+(aspects?|dimensions?|factors?)/i;

// Enumeration patterns (lists with 3+ items)
// Uses non-greedy .*? to prevent catastrophic backtracking on long inputs.
const ENUM_RE = /(?:[,，、][^,，、]*){2,}|(?:\d+[.、)]\s*\S+[^0-9]*){3,}/;

// Deep research / thorough analysis indicators
const RESEARCH_RE =
  /深入|全面|详细分析|系统性|综合|对比.*方案|调研|评估.*优缺|优缺点|pros\s*(and|&)\s*cons|in[- ]depth|thorough|comprehensive|compare.*alternatives/i;

// Individual research keywords — used for multi-indicator counting
const RESEARCH_KEYWORDS_RE =
  /深入|全面|详细|系统性|综合|调研|评估|优缺|pros|cons|in[- ]depth|thorough|comprehensive/gi;

// Comparison / evaluation patterns
const COMPARE_RE =
  /对比|比较|vs\.?|versus|相比|哪个更好|which\s+is\s+better|evaluate|优劣|优缺点|trade-?offs?|pros\s*(and|&)\s*cons/i;

// Simple greetings and short queries
const SIMPLE_GREETING_RE =
  /^(hi|hello|hey|你好|嗨|哈喽|早上好|晚上好|good\s*(morning|evening|afternoon))[\s!！.。?？]*$/i;

// Simple one-shot questions
// Note: \s* after CJK prefixes since Chinese doesn't require word spacing
const SIMPLE_QUESTION_RE =
  /^(what\s+is|what's|who\s+is|when\s+(did|was|is)|where\s+is|how\s+do\s+you\s+say|什么是|谁是|怎么说|翻译|translate)\s*.{1,80}[?？]?$/i;

// Command-style short requests
// Use \s* (not \s+) because CJK languages don't require whitespace between
// the command verb and its object: "帮我翻译一下这段话" has no space.
const SIMPLE_COMMAND_RE = /^(帮我翻译|翻译一下|总结一下|summarize|translate|explain)\s*.{1,120}$/i;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assess task complexity based on prompt text using rule-based heuristics.
 * Returns a score (0–1), contributing signals, and whether the result is confident.
 */
export function assessComplexityByRules(prompt: string): ComplexitySignal {
  let score = 0;
  const signals: string[] = [];
  const len = prompt.length;
  const isCJK = CJK_RE.test(prompt);

  // --- Length signals ---
  // CJK text is denser, so thresholds are lower
  const longThreshold = isCJK ? 200 : 500;
  const veryLongThreshold = isCJK ? 600 : 1500;

  if (len > veryLongThreshold) {
    score += 0.2;
    signals.push("very_long_prompt");
  } else if (len > longThreshold) {
    score += 0.1;
    signals.push("long_prompt");
  }

  // --- Structural signals ---
  if (MULTI_STEP_RE.test(prompt)) {
    score += 0.35;
    signals.push("multi_step");
  }

  if (MULTI_DIM_RE.test(prompt)) {
    score += 0.2;
    signals.push("multi_dimension");
  }

  if (ENUM_RE.test(prompt)) {
    score += 0.15;
    signals.push("enumeration");
  }

  // --- Depth signals ---
  if (RESEARCH_RE.test(prompt)) {
    // Count distinct research indicators — multiple indicators → higher complexity
    const researchMatches = prompt.match(RESEARCH_KEYWORDS_RE);
    const distinctCount = researchMatches
      ? new Set(researchMatches.map((m) => m.toLowerCase())).size
      : 1;
    const researchScore =
      distinctCount >= 5 ? 0.45 : distinctCount >= 3 ? 0.35 : distinctCount >= 2 ? 0.25 : 0.2;
    score += researchScore;
    signals.push("deep_research");
  }

  if (COMPARE_RE.test(prompt)) {
    score += 0.2;
    signals.push("comparison");
  }

  // --- Simplicity signals (reduce score) ---
  // Check these first, before length-based fallback
  let simplicityDetected = false;
  if (SIMPLE_GREETING_RE.test(prompt)) {
    score -= 0.5;
    signals.push("simple_greeting");
    simplicityDetected = true;
  } else if (SIMPLE_QUESTION_RE.test(prompt)) {
    score -= 0.3;
    signals.push("simple_question");
    simplicityDetected = true;
  } else if (SIMPLE_COMMAND_RE.test(prompt)) {
    score -= 0.2;
    signals.push("simple_command");
    simplicityDetected = true;
  }

  // Very short prompts are almost always simple (fallback when no other signal fired)
  const shortThreshold = isCJK ? 30 : 60;
  if (len < shortThreshold && !simplicityDetected && signals.length === 0) {
    score -= 0.2;
    signals.push("very_short");
  }

  // Clamp
  score = Math.max(0, Math.min(1, score));

  return {
    score,
    signals,
    confident: score <= CONFIDENT_LOW || score >= CONFIDENT_HIGH,
  };
}

/**
 * Convert a numeric complexity score to a discrete level.
 */
export function scoreToComplexityLevel(score: number): ComplexityLevel {
  if (score >= HIGH_THRESHOLD) return "high";
  if (score <= LOW_THRESHOLD) return "low";
  return "medium";
}

// Intents that benefit from parallel sub-agents (hoisted for perf)
const PARALLELIZABLE_INTENTS = new Set([
  "research",
  "analysis",
  "comparison",
  "content_creation",
  "data_analysis",
  "general", // general high-complexity tasks may benefit
]);

// Intents where multi-agent hurts — sequential reasoning (hoisted for perf)
const SEQUENTIAL_INTENTS = new Set([
  "math",
  "logic",
  "coding", // coding is better single-agent with tools
]);

/**
 * Determine execution strategy from complexity level and intent.
 *
 * Not all "high" complexity tasks benefit from multi-agent.
 * Sequential reasoning tasks (math, logic) should stay single even if complex.
 */
export function resolveStrategy(complexity: ComplexityLevel, intentId: string): ExecutionStrategy {
  if (complexity === "low") {
    return "single";
  }

  if (complexity === "high") {
    if (SEQUENTIAL_INTENTS.has(intentId)) {
      return "enhanced"; // stronger model, but single agent
    }
    if (PARALLELIZABLE_INTENTS.has(intentId)) {
      return "multi";
    }
    // Unknown intent + high complexity → default to enhanced
    return "enhanced";
  }

  // medium complexity
  return "enhanced";
}

/**
 * Validate and normalize a complexity level string from LLM output.
 */
export function normalizeComplexityLevel(raw: string): ComplexityLevel | null {
  const lower = raw.toLowerCase().trim();
  if (lower === "low" || lower === "medium" || lower === "high") return lower;
  return null;
}
