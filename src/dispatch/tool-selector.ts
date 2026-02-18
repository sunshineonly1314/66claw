/**
 * Tool Selection Gate — filters 50 discovery candidates to 3-8 precise tools.
 *
 * Uses a lightweight LLM call (haiku-class, <500ms) to semantically evaluate
 * which tools are truly needed for the user's task. Falls back to top-N by
 * search score when the LLM call fails or times out.
 *
 * Industry reference: Anthropic's Tool Search Tool (3-5 per search),
 * ToolLLM's DFSDT (~5-10 APIs), universal finding of 3-20 tools reaching
 * the final LLM.
 */

import type { OpenClawCNConfig } from "../config/config.js";
import type { ToolSearchResult } from "../config/types.tool-discovery.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("tool-selector");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToolSelectionResult = {
  /** Filtered tool IDs (3-8). */
  selectedToolIds: string[];
  /** Brief reasoning from the LLM (for debugging). */
  reasoning: string;
  /** Confidence 0-1. */
  confidence: number;
  /** Latency of the selection call (ms). */
  latencyMs: number;
  /** Whether this was a fallback (returned top-N by score). */
  isFallback: boolean;
};

export type ToolSelectionParams = {
  /** User prompt text. */
  prompt: string;
  /** Candidates from discoverTools(). */
  candidates: ToolSearchResult[];
  /** Detected intent from dispatch engine. */
  intent: string;
  /** Task complexity. */
  complexity: "low" | "medium" | "high";
  /** Optional subtask context (when DAG executor calls per-step). */
  subtaskDescription?: string;
  /** Config for model resolution. */
  cfg: OpenClawCNConfig;
  /** Agent directory for API key resolution. */
  agentDir: string;
  /** Maximum number of tools to select. Default: 8. */
  maxTools?: number;
  /** Timeout for the LLM call (ms). Default: 1500. */
  timeoutMs?: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_TOOLS = 8;
const DEFAULT_TIMEOUT_MS = 1500;
/** Falls back to the same model used by the dispatch classifier (config-loader default). */
const DEFAULT_SELECTOR_MODEL = "anthropic/claude-haiku-3";

const SELECTOR_SYSTEM_PROMPT = `You select the most relevant tools for a user task.

Given: user prompt, intent, complexity, and a numbered list of candidate tools.
Return ONLY valid JSON (no markdown fences, no explanation):
{"selected": [1, 3, 7], "reasoning": "brief one-line explanation"}

Rules:
- Select 3-8 tools maximum
- Prefer tools that directly solve the user's core task
- Include supporting tools when clearly needed (e.g., web_fetch for research)
- Numbers reference the candidate list indices (1-based)
- When in doubt, include rather than exclude`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function selectTools(params: ToolSelectionParams): Promise<ToolSelectionResult> {
  const startTime = performance.now();
  const maxTools = params.maxTools ?? DEFAULT_MAX_TOOLS;
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Fast path: if candidates <= maxTools, skip LLM call entirely
  if (params.candidates.length <= maxTools) {
    return {
      selectedToolIds: params.candidates.map((c) => c.entry.id),
      reasoning: "candidate count within limit, no filtering needed",
      confidence: 1.0,
      latencyMs: performance.now() - startTime,
      isFallback: false,
    };
  }

  // Build compact candidate list for LLM
  const candidateList = params.candidates
    .map((c, i) => {
      const desc = c.entry.descriptionCn || c.entry.description;
      return `${i + 1}. [${c.entry.type}] ${c.entry.name}: ${desc}`;
    })
    .join("\n");

  const userPrompt = [
    `User task: ${params.prompt}`,
    `Intent: ${params.intent} | Complexity: ${params.complexity}`,
    params.subtaskDescription ? `Subtask: ${params.subtaskDescription}` : "",
    "",
    `Candidate tools (${params.candidates.length} total):\n${candidateList}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { classifyWithLightweightModel } = await import("./llm-classify.js");
    const result = await classifyWithLightweightModel({
      systemPrompt: SELECTOR_SYSTEM_PROMPT,
      userPrompt,
      model: DEFAULT_SELECTOR_MODEL,
      maxTokens: 200,
      cfg: params.cfg,
      agentDir: params.agentDir,
      timeoutMs,
    });

    if (!result) throw new Error("LLM returned null");

    // Parse JSON (strip markdown fences if present)
    const cleaned = result
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as {
      selected?: number[];
      reasoning?: string;
    };

    if (!Array.isArray(parsed.selected) || parsed.selected.length === 0) {
      throw new Error("No tools selected in response");
    }

    // Map 1-based indices to tool IDs, filter invalid indices
    const selectedIds = parsed.selected
      .filter((idx) => typeof idx === "number" && idx >= 1 && idx <= params.candidates.length)
      .slice(0, maxTools)
      .map((idx) => params.candidates[idx - 1]!.entry.id);

    if (selectedIds.length === 0) {
      throw new Error("All selected indices out of range");
    }

    const latencyMs = performance.now() - startTime;
    log.info(
      `Tool selector: ${selectedIds.length}/${params.candidates.length} selected in ${latencyMs.toFixed(0)}ms`,
    );

    return {
      selectedToolIds: selectedIds,
      reasoning: parsed.reasoning ?? "",
      confidence: 0.85,
      latencyMs,
      isFallback: false,
    };
  } catch (err) {
    const latencyMs = performance.now() - startTime;
    log.debug(
      `Tool selection LLM failed (${latencyMs.toFixed(0)}ms), using top-N fallback: ${err}`,
    );
    return {
      selectedToolIds: fallbackIds(params.candidates, maxTools),
      reasoning: "LLM selection failed, using top-scored candidates",
      confidence: 0.5,
      latencyMs,
      isFallback: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/** Fallback: return the top N candidates by search score. */
function fallbackIds(candidates: ToolSearchResult[], maxTools: number): string[] {
  return candidates.slice(0, maxTools).map((c) => c.entry.id);
}
