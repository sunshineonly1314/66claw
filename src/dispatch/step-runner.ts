/**
 * Step Runner — executes a single DAG node with validation, retry, and context injection.
 *
 * Each node execution is wrapped in a safety net:
 * 1. Inject dependency context from workspace into the worker prompt
 * 2. Call the LLM
 * 3. Validate the output (non-empty, no error markers)
 * 4. Retry on validation failure (max 2 retries, exponential backoff)
 * 5. Respect time budget and abort signal
 */

import type { OpenClawCNConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import type { DagNode, StepRunResult } from "./dag-executor.js";
import type { ExecutionWorkspace } from "./execution-workspace.js";

const log = createSubsystemLogger("step-runner");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 1000;
const MIN_OUTPUT_LENGTH = 10;

/**
 * Markers at the start of output that indicate a refusal or error.
 * When an output starts with any of these, it triggers a retry.
 */
const ERROR_MARKERS = [
  "I cannot fulfill",
  "I cannot complete",
  "I'm sorry, I can't",
  "I'm unable to complete",
  "I'm unable to fulfill",
  "Error: ",
  "ERROR: ",
  "无法完成",
  "抱歉，我无法完成",
  "很抱歉，我无法",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StepRunParams = {
  node: DagNode;
  workspace: ExecutionWorkspace;
  originalTask: string;
  model: string;
  cfg: OpenClawCNConfig;
  agentDir: string;
  /** Time budget for this step (ms). */
  timeBudgetMs: number;
  signal?: AbortSignal;
};

type ValidationResult = { isValid: boolean; errors: string[] };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runStep(params: StepRunParams): Promise<StepRunResult> {
  const { node, workspace, originalTask, model, cfg, agentDir, timeBudgetMs } = params;
  const startTime = performance.now();
  const maxRetries = node.maxRetries ?? DEFAULT_MAX_RETRIES;
  const validationErrors: string[] = [];
  let retryCount = 0;
  let lastOutput = "";
  let lastStatus: StepRunResult["status"] = "error";

  // Build dependency context from workspace
  const dependencyContext = buildDependencyContext(node, workspace);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    retryCount = attempt;

    // Check abort
    if (params.signal?.aborted) {
      return makeResult(node.id, "timeout", lastOutput, startTime, retryCount, validationErrors);
    }

    // Check time budget
    const elapsed = performance.now() - startTime;
    if (elapsed > timeBudgetMs) {
      return makeResult(node.id, "timeout", lastOutput, startTime, retryCount, validationErrors);
    }

    try {
      const { classifyWithLightweightModel } = await import("./llm-classify.js");

      const systemPrompt = buildWorkerSystemPrompt(node, originalTask, dependencyContext);
      const remainingBudget = timeBudgetMs - (performance.now() - startTime);

      const result = await classifyWithLightweightModel({
        systemPrompt,
        userPrompt: node.task,
        model,
        maxTokens: 4096,
        cfg,
        agentDir,
        timeoutMs: Math.min(60_000, Math.max(5_000, remainingBudget)),
        signal: params.signal,
      });

      lastOutput = result?.trim() ?? "";

      // Post-validation
      const validation = validateOutput(lastOutput);
      if (validation.isValid) {
        lastStatus = "ok";
        break;
      }

      // Validation failed — record errors and maybe retry
      validationErrors.push(...validation.errors);

      if (attempt < maxRetries) {
        const backoffMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
        log.debug(
          `Step ${node.id} validation failed (attempt ${attempt + 1}/${maxRetries + 1}), ` +
            `retrying in ${backoffMs}ms: ${validation.errors.join(", ")}`,
        );
        await sleep(backoffMs);
      } else {
        lastStatus = "error";
      }
    } catch (err) {
      lastOutput = `Error: ${err instanceof Error ? err.message : String(err)}`;
      lastStatus = "error";

      if (attempt < maxRetries) {
        const backoffMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
        log.debug(`Step ${node.id} threw (attempt ${attempt + 1}), retrying in ${backoffMs}ms`);
        await sleep(backoffMs);
      }
    }
  }

  const durationMs = performance.now() - startTime;
  log.info(
    `Step ${node.id} [${node.role}]: status=${lastStatus} retries=${retryCount} ${durationMs.toFixed(0)}ms`,
  );

  return makeResult(node.id, lastStatus, lastOutput, startTime, retryCount, validationErrors);
}

// ---------------------------------------------------------------------------
// Internal — worker prompt construction
// ---------------------------------------------------------------------------

function buildWorkerSystemPrompt(
  node: DagNode,
  originalTask: string,
  dependencyContext: string,
): string {
  const parts: string[] = [
    `You are a ${node.role}. Your job is to complete the specific subtask assigned to you.`,
    "",
    `Original user request (for context): ${originalTask}`,
  ];

  if (dependencyContext) {
    parts.push("");
    parts.push("Results from prior steps (use as input for your work):");
    parts.push(dependencyContext);
  }

  parts.push("");
  parts.push(
    "Complete your assigned subtask thoroughly and provide a clear, well-structured response.",
  );
  parts.push("Focus only on your specific subtask — other parts are handled by other workers.");

  return parts.join("\n");
}

/**
 * Build context string from dependency step outputs in the workspace.
 * Only includes successful, non-empty outputs.
 */
function buildDependencyContext(node: DagNode, workspace: ExecutionWorkspace): string {
  if (node.dependsOn.length === 0) return "";

  const parts: string[] = [];
  for (const depId of node.dependsOn) {
    const depOutput = workspace.getOutput(depId);
    if (depOutput && depOutput.status === "ok" && depOutput.output.trim()) {
      parts.push(`[Step ${depId}]:\n${depOutput.output}`);
    }
  }
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Internal — output validation
// ---------------------------------------------------------------------------

function validateOutput(output: string): ValidationResult {
  const errors: string[] = [];

  if (!output || output.trim().length < MIN_OUTPUT_LENGTH) {
    errors.push("output_too_short");
  }

  const trimmed = output.trim();
  for (const marker of ERROR_MARKERS) {
    if (trimmed.startsWith(marker)) {
      errors.push(`error_marker:${marker}`);
      break;
    }
  }

  return { isValid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Internal — helpers
// ---------------------------------------------------------------------------

function makeResult(
  nodeId: string,
  status: StepRunResult["status"],
  output: string,
  startTime: number,
  retryCount: number,
  validationErrors: string[],
): StepRunResult {
  return {
    nodeId,
    status,
    output,
    durationMs: performance.now() - startTime,
    retryCount,
    validationErrors,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
