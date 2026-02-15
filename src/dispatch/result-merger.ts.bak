/**
 * Result Merger — combines outputs from parallel worker agents.
 *
 * Supports 4 merge strategies:
 * - synthesize: LLM combines worker outputs into a unified report
 * - concatenate: Deduplicate and join results sequentially
 * - vote: Majority consensus for classification/judgment tasks
 * - best_of_n: LLM selects the highest-quality output
 */

import type { OpenClawCNConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("result-merger");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MergeStrategy = "synthesize" | "concatenate" | "vote" | "best_of_n";

export type WorkerResult = {
  taskId: string;
  task: string;
  output: string;
  status: "ok" | "error" | "timeout";
  durationMs?: number;
};

// ---------------------------------------------------------------------------
// Strategy implementations
// ---------------------------------------------------------------------------

function mergeByConcatenation(results: WorkerResult[]): string {
  const successful = results.filter((r) => r.status === "ok" && r.output.trim());
  if (successful.length === 0) {
    return "All workers failed to produce results.";
  }
  // Simple dedup by exact match
  const seen = new Set<string>();
  const unique: WorkerResult[] = [];
  for (const r of successful) {
    const key = r.output.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  }
  if (unique.length === 1) {
    return unique[0]!.output;
  }
  return unique.map((r, i) => `### Part ${i + 1}: ${r.task}\n\n${r.output.trim()}`).join("\n\n---\n\n");
}

function mergeByVote(results: WorkerResult[]): string {
  const successful = results.filter((r) => r.status === "ok" && r.output.trim());
  if (successful.length === 0) {
    return "All workers failed to produce results.";
  }
  // Count normalized outputs
  const counts = new Map<string, { count: number; original: string }>();
  for (const r of successful) {
    const key = r.output.trim().toLowerCase();
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, { count: 1, original: r.output.trim() });
    }
  }
  // Return the most common answer
  let best = { count: 0, original: "" };
  for (const entry of counts.values()) {
    if (entry.count > best.count) {
      best = entry;
    }
  }
  return best.original;
}

async function mergeWithLLM(params: {
  results: WorkerResult[];
  originalTask: string;
  strategy: "synthesize" | "best_of_n";
  model: string;
  cfg: OpenClawCNConfig;
  agentDir: string;
}): Promise<string> {
  const { results, originalTask, strategy, model, cfg, agentDir } = params;
  const successful = results.filter((r) => r.status === "ok" && r.output.trim());
  if (successful.length === 0) {
    return "All workers failed to produce results.";
  }
  if (successful.length === 1) {
    return successful[0]!.output;
  }

  const workerOutputs = successful
    .map((r, i) => `--- Worker ${i + 1}: ${r.task} ---\n${r.output.trim()}`)
    .join("\n\n");

  const systemPrompt =
    strategy === "synthesize"
      ? [
          "You are a result synthesis expert.",
          "Given multiple worker outputs addressing parts of a user's request,",
          "synthesize them into a single comprehensive, well-structured response.",
          "Do not mention the workers or the synthesis process.",
          "Respond naturally as if you are directly answering the user.",
        ].join(" ")
      : [
          "You are a quality evaluator.",
          "Given multiple candidate responses to a user's request,",
          "select the BEST one based on accuracy, completeness, and clarity.",
          "Return ONLY the selected response text, without modification or commentary.",
        ].join(" ");

  const userPrompt = [
    `Original user request: ${originalTask}`,
    "",
    "Worker outputs:",
    workerOutputs,
    "",
    strategy === "synthesize"
      ? "Synthesize these outputs into a single unified response."
      : "Select the best response and return it exactly.",
  ].join("\n");

  try {
    const { classifyWithLightweightModel } = await import("./llm-classify.js");
    const merged = await classifyWithLightweightModel({
      systemPrompt,
      userPrompt,
      model,
      maxTokens: 4096,
      cfg,
      agentDir,
      timeoutMs: 30_000,
    });
    if (merged && merged.trim()) {
      return merged.trim();
    }
  } catch (err) {
    log.warn(`LLM merge failed (strategy=${strategy}): ${String(err)}`);
  }

  // Fallback to concatenation
  return mergeByConcatenation(results);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function mergeWorkerResults(params: {
  results: WorkerResult[];
  originalTask: string;
  strategy: MergeStrategy;
  model?: string;
  cfg: OpenClawCNConfig;
  agentDir: string;
}): Promise<string> {
  const { results, originalTask, strategy } = params;

  if (results.length === 0) {
    return "No worker results available.";
  }

  const successCount = results.filter((r) => r.status === "ok").length;
  const failCount = results.length - successCount;
  if (failCount > 0) {
    log.info(
      `Merging ${successCount} successful / ${failCount} failed results (strategy=${strategy})`,
    );
  }

  switch (strategy) {
    case "concatenate":
      return mergeByConcatenation(results);

    case "vote":
      return mergeByVote(results);

    case "synthesize":
    case "best_of_n": {
      const model = params.model ?? "anthropic/claude-sonnet-4-5-20250929";
      return mergeWithLLM({
        results,
        originalTask,
        strategy,
        model,
        cfg: params.cfg,
        agentDir: params.agentDir,
      });
    }

    default:
      log.warn(`Unknown merge strategy "${strategy}", falling back to concatenation`);
      return mergeByConcatenation(results);
  }
}
