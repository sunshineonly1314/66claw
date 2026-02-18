/**
 * Multi-Agent Orchestrator — decomposes complex tasks into parallel subtasks.
 *
 * Flow:
 * 1. Acquire resource slot via resource-guard
 * 2. Decompose user request into 2-4 independent subtasks (LLM call)
 * 3. Execute subtasks in parallel (direct LLM calls with worker model)
 * 4. Merge results using the configured merge strategy
 * 5. Release resource slot
 *
 * Graceful degradation: if any step fails, returns undefined so the caller
 * falls back to single-agent mode.
 */

import type { OpenClawCNConfig } from "../config/config.js";
import type { ReplyPayload } from "../auto-reply/types.js";
import type { RoutingDecision } from "./types.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { applyResourceGuard, recordOutcome } from "./resource-guard.js";
import { loadDispatchConfig } from "./config-loader.js";
import { type MergeStrategy, type WorkerResult, mergeWorkerResults } from "./result-merger.js";

const log = createSubsystemLogger("orchestrator");

// ---------------------------------------------------------------------------
// Task Decomposition Types
// ---------------------------------------------------------------------------

type Subtask = {
  id: string;
  task: string;
  role: string;
  dependsOn: string[];
};

type DecompositionResult = {
  subtasks: Subtask[];
  mergeStrategy: MergeStrategy;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_WORKERS = 4;
const DECOMPOSE_TIMEOUT_MS = 15_000;
const WORKER_TIMEOUT_MS = 60_000;
const DEFAULT_WORKER_MODEL = "anthropic/claude-sonnet-4-5-20250929";
const DEFAULT_ORCHESTRATOR_MODEL = "anthropic/claude-sonnet-4-5-20250929";

// ---------------------------------------------------------------------------
// Task Decomposer
// ---------------------------------------------------------------------------

const DECOMPOSE_SYSTEM_PROMPT = `You are a task decomposition expert. Given a user request, split it into 2-4 subtasks.

Rules:
- Prefer independent subtasks that can run in parallel (depends_on: []).
- When a subtask genuinely needs another's output, mark it with depends_on so they run sequentially.
- Keep subtasks focused and specific.
- Choose the merge strategy based on the task type:
  - "synthesize": For research, analysis, or comparison tasks — combine results into a unified report.
  - "concatenate": For information gathering — join results sequentially.
  - "vote": For classification or judgment tasks — use majority consensus.
  - "best_of_n": For creative tasks — select the best output.

Respond with ONLY valid JSON, no markdown fences:
{
  "subtasks": [
    { "id": "t1", "task": "...", "role": "researcher", "depends_on": [] },
    { "id": "t2", "task": "...", "role": "analyst", "depends_on": [] }
  ],
  "merge_strategy": "synthesize"
}`;

async function decomposeTask(params: {
  task: string;
  intent: string;
  cfg: OpenClawCNConfig;
  agentDir: string;
  model: string;
}): Promise<DecompositionResult | null> {
  const { classifyWithLightweightModel } = await import("./llm-classify.js");

  const userPrompt = [
    `User request: ${params.task}`,
    `Detected intent: ${params.intent}`,
    "",
    "Decompose this into parallel subtasks.",
  ].join("\n");

  const result = await classifyWithLightweightModel({
    systemPrompt: DECOMPOSE_SYSTEM_PROMPT,
    userPrompt,
    model: params.model,
    maxTokens: 1024,
    cfg: params.cfg,
    agentDir: params.agentDir,
    timeoutMs: DECOMPOSE_TIMEOUT_MS,
  });

  if (!result) {
    return null;
  }

  try {
    const cleaned = result
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as {
      subtasks?: Array<{
        id?: string;
        task?: string;
        role?: string;
        depends_on?: string[];
      }>;
      merge_strategy?: string;
    };

    if (!Array.isArray(parsed.subtasks) || parsed.subtasks.length < 2) {
      return null;
    }

    const subtasks: Subtask[] = parsed.subtasks
      .slice(0, MAX_WORKERS)
      .map((st, i) => ({
        id: st.id ?? `t${i + 1}`,
        task: typeof st.task === "string" ? st.task : "",
        role: typeof st.role === "string" ? st.role : "worker",
        dependsOn: Array.isArray(st.depends_on) ? st.depends_on : [],
      }))
      .filter((st) => st.task.trim().length > 0);

    if (subtasks.length < 2) {
      return null;
    }

    const validStrategies: MergeStrategy[] = ["synthesize", "concatenate", "vote", "best_of_n"];
    const mergeStrategy: MergeStrategy = validStrategies.includes(
      parsed.merge_strategy as MergeStrategy,
    )
      ? (parsed.merge_strategy as MergeStrategy)
      : "synthesize";

    return { subtasks, mergeStrategy };
  } catch {
    log.warn("Failed to parse decomposition result");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Worker Executor
// ---------------------------------------------------------------------------

async function executeWorker(params: {
  subtask: Subtask;
  originalTask: string;
  model: string;
  cfg: OpenClawCNConfig;
  agentDir: string;
}): Promise<WorkerResult> {
  const startTime = Date.now();
  const { subtask, originalTask, model, cfg, agentDir } = params;

  const systemPrompt = [
    `You are a ${subtask.role}. Your job is to complete the specific subtask assigned to you.`,
    "",
    `Original user request (for context): ${originalTask}`,
    "",
    "Complete your assigned subtask thoroughly and provide a clear, well-structured response.",
    "Focus only on your specific subtask — other parts of the request are handled by other workers.",
  ].join("\n");

  try {
    const { classifyWithLightweightModel } = await import("./llm-classify.js");
    const result = await classifyWithLightweightModel({
      systemPrompt,
      userPrompt: subtask.task,
      model,
      maxTokens: 4096,
      cfg,
      agentDir,
      timeoutMs: WORKER_TIMEOUT_MS,
    });

    return {
      taskId: subtask.id,
      task: subtask.task,
      output: result?.trim() ?? "",
      status: result ? "ok" : "error",
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      taskId: subtask.id,
      task: subtask.task,
      output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      status: "error",
      durationMs: Date.now() - startTime,
    };
  }
}

// ---------------------------------------------------------------------------
// Legacy Execution (fallback when DAG executor is unavailable)
// ---------------------------------------------------------------------------

async function executeLegacy(
  subtasks: Subtask[],
  originalTask: string,
  model: string,
  cfg: OpenClawCNConfig,
  agentDir: string,
): Promise<WorkerResult[]> {
  const independentTasks = subtasks.filter((st) => st.dependsOn.length === 0);
  const dependentTasks = subtasks.filter((st) => st.dependsOn.length > 0);

  const results: WorkerResult[] = [];
  if (independentTasks.length > 0) {
    const parallelResults = await Promise.all(
      independentTasks.map((subtask) =>
        executeWorker({ subtask, originalTask, model, cfg, agentDir }),
      ),
    );
    results.push(...parallelResults);
  }

  for (const subtask of dependentTasks) {
    const result = await executeWorker({ subtask, originalTask, model, cfg, agentDir });
    results.push(result);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runMultiAgentOrchestration(params: {
  task: string;
  decision: RoutingDecision;
  cfg: OpenClawCNConfig;
  sessionKey: string;
  agentId: string;
  agentDir: string;
  workspaceDir: string;
  opts?: unknown;
}): Promise<ReplyPayload | ReplyPayload[] | undefined> {
  const { task, decision, cfg, agentDir, workspaceDir } = params;
  const startTime = Date.now();

  // 1. Acquire resource slot
  const guard = applyResourceGuard("multi");
  if (guard.degraded) {
    log.info(`Multi-agent degraded to ${guard.strategy}: ${guard.reason}`);
    guard.release();
    return undefined;
  }

  try {
    // 2. Resolve models from dispatch config
    const dispatchCfg = loadDispatchConfig({ agentDir, workspaceDir });
    const orchestratorModel =
      dispatchCfg?.complexity?.strategies?.multi?.orchestratorModel ?? DEFAULT_ORCHESTRATOR_MODEL;
    const workerModel =
      dispatchCfg?.complexity?.strategies?.multi?.workerModel ?? DEFAULT_WORKER_MODEL;
    const maxWorkers = Math.min(
      dispatchCfg?.complexity?.strategies?.multi?.maxWorkers ?? MAX_WORKERS,
      MAX_WORKERS,
    );

    // 3. Decompose task
    log.info(`Decomposing task (intent=${decision.intent}, complexity=${decision.complexity})`);
    const decomposition = await decomposeTask({
      task,
      intent: decision.intent,
      cfg,
      agentDir,
      model: orchestratorModel,
    });

    if (!decomposition) {
      log.info("Decomposition failed or task not parallelizable, falling back to single agent");
      recordOutcome(false);
      return undefined;
    }

    const { subtasks, mergeStrategy } = decomposition;
    const limitedSubtasks = subtasks.slice(0, maxWorkers);

    log.info(
      `Decomposed into ${limitedSubtasks.length} subtasks (merge=${mergeStrategy}): ` +
        limitedSubtasks.map((s) => `[${s.id}] ${s.role}`).join(", "),
    );

    // 4. Execute workers via DAG executor (topological wave scheduling)
    let results: WorkerResult[];
    const dagEnabled = cfg.dispatch?.dagExecutor !== false;
    try {
      if (!dagEnabled) throw new Error("DAG executor disabled by config");
      const { executeDag } = await import("./dag-executor.js");
      const { createWorkspace } = await import("./execution-workspace.js");

      const workspace = createWorkspace(task);
      const dagNodes = limitedSubtasks.map((st) => ({
        id: st.id,
        task: st.task,
        role: st.role,
        dependsOn: st.dependsOn,
      }));

      const dagResult = await executeDag(dagNodes, {
        timeBudgetMs: WORKER_TIMEOUT_MS * Math.max(1, limitedSubtasks.length),
        maxParallelism: maxWorkers,
        workerModel,
        cfg,
        agentDir,
        originalTask: task,
        workspace,
      });

      results = [...dagResult.results.values()].map((r) => ({
        taskId: r.nodeId,
        task: limitedSubtasks.find((s) => s.id === r.nodeId)?.task ?? "",
        output: r.output,
        status: r.status === "ok" ? ("ok" as const) : ("error" as const),
        durationMs: r.durationMs,
      }));
    } catch (dagErr) {
      // Fallback: legacy parallel/sequential execution
      log.warn(`DAG executor failed, falling back to legacy execution: ${String(dagErr)}`);
      results = await executeLegacy(limitedSubtasks, task, workerModel, cfg, agentDir);
    }

    const successCount = results.filter((r) => r.status === "ok").length;
    if (successCount === 0) {
      log.warn("All workers failed");
      recordOutcome(false);
      return undefined;
    }

    // 5. Merge results
    log.info(
      `Merging ${successCount}/${results.length} worker results (strategy=${mergeStrategy})`,
    );
    const merged = await mergeWorkerResults({
      results,
      originalTask: task,
      strategy: mergeStrategy,
      model: orchestratorModel,
      cfg,
      agentDir,
    });

    const totalDurationMs = Date.now() - startTime;
    log.info(`Multi-agent orchestration complete in ${totalDurationMs}ms`);
    recordOutcome(true);

    return { text: merged };
  } catch (err) {
    log.warn(`Orchestration error: ${String(err)}`);
    recordOutcome(false);
    return undefined;
  } finally {
    guard.release();
  }
}
