/**
 * DAG Executor — topological wave-based execution engine.
 *
 * Replaces the orchestrator's inline parallel/sequential logic with proper
 * dependency-aware scheduling:
 *
 * 1. Kahn's algorithm sorts nodes into topological "waves"
 * 2. Each wave runs in parallel (respecting maxParallelism)
 * 3. Between waves, results flow through the ExecutionWorkspace
 * 4. Conditional nodes are evaluated at execution time
 * 5. Time budget is enforced across waves
 *
 * Inspired by LangGraph (wave scheduling) + Mastra (TypeScript simplicity)
 * + Dify (worker pool with time budget).
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import type { ExecutionWorkspace, StepOutputStatus } from "./execution-workspace.js";
import type { OpenClawCNConfig } from "../config/config.js";

const log = createSubsystemLogger("dag-executor");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A node in the execution DAG. */
export type DagNode = {
  id: string;
  task: string;
  role: string;
  dependsOn: string[];
  /** Conditional execution: only run when the referenced step matches. */
  condition?: {
    stepId: string;
    field: "output" | "status";
    expect: string | "truthy" | "falsy";
  };
  /** Maximum retries for this step. Forwarded to step-runner. */
  maxRetries?: number;
};

/** Result from a single step execution. */
export type StepRunResult = {
  nodeId: string;
  status: StepOutputStatus;
  output: string;
  durationMs: number;
  retryCount: number;
  validationErrors: string[];
};

/** Function signature the DAG executor expects from the step runner. */
export type StepRunnerFn = (params: {
  node: DagNode;
  workspace: ExecutionWorkspace;
  originalTask: string;
  model: string;
  cfg: OpenClawCNConfig;
  agentDir: string;
  timeBudgetMs: number;
  signal?: AbortSignal;
}) => Promise<StepRunResult>;

/** Configuration for DAG execution. */
export type DagExecutionConfig = {
  /** Total time budget for the entire DAG (ms). Default: 120_000. */
  timeBudgetMs: number;
  /** Maximum parallel workers per wave. Default: 4. */
  maxParallelism: number;
  /** Model for worker LLM calls. */
  workerModel: string;
  /** OpenClawCN config object. */
  cfg: OpenClawCNConfig;
  /** Agent directory for API key resolution. */
  agentDir: string;
  /** Original user task (injected into each step's context). */
  originalTask: string;
  /** Shared execution workspace for context passing. */
  workspace: ExecutionWorkspace;
  /** Optional abort signal. */
  signal?: AbortSignal;
  /** Step runner function. Allows injection for testing. */
  runStep?: StepRunnerFn;
};

/** Result of a full DAG execution. */
export type DagExecutionResult = {
  /** All step results keyed by step ID. */
  results: Map<string, StepRunResult>;
  /** IDs of steps that were skipped (condition not met). */
  skippedSteps: string[];
  /** Total execution time (ms). */
  totalDurationMs: number;
  /** Whether execution was aborted due to time budget exhaustion. */
  timedOut: boolean;
};

// ---------------------------------------------------------------------------
// Topological Sort — Kahn's Algorithm
// ---------------------------------------------------------------------------

/**
 * Topological sort producing execution "waves".
 *
 * Each wave contains nodes whose dependencies are all in earlier waves.
 * Nodes within the same wave can execute in parallel.
 *
 * @returns Array of waves (each wave is an array of DagNode).
 *          Returns empty array for empty input.
 *          Detects cycles and forces remaining nodes into a final wave.
 */
export function topologicalWaves(nodes: DagNode[]): DagNode[][] {
  if (nodes.length === 0) return [];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  // Initialize
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjList.set(node.id, []);
  }

  // Build adjacency + in-degree (only count edges to known nodes)
  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      if (nodeMap.has(dep)) {
        adjList.get(dep)!.push(node.id);
        inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
      }
    }
  }

  const waves: DagNode[][] = [];
  const remaining = new Set(nodes.map((n) => n.id));

  while (remaining.size > 0) {
    // Find all nodes with in-degree 0 among remaining
    const wave: DagNode[] = [];
    for (const id of remaining) {
      if ((inDegree.get(id) ?? 0) === 0) {
        const node = nodeMap.get(id);
        if (node) wave.push(node);
      }
    }

    if (wave.length === 0) {
      // Cycle detected — force remaining into final wave for graceful degradation
      log.warn(
        `Cycle detected in DAG among nodes [${[...remaining].join(", ")}], forcing into final wave`,
      );
      const forced = [...remaining]
        .map((id) => nodeMap.get(id))
        .filter((n): n is DagNode => n !== undefined);
      waves.push(forced);
      break;
    }

    waves.push(wave);

    // Remove wave from remaining, update in-degrees of successors
    for (const node of wave) {
      remaining.delete(node.id);
      for (const successor of adjList.get(node.id) ?? []) {
        inDegree.set(successor, (inDegree.get(successor) ?? 0) - 1);
      }
    }
  }

  return waves;
}

// ---------------------------------------------------------------------------
// Condition Evaluator
// ---------------------------------------------------------------------------

function evaluateCondition(
  condition: DagNode["condition"],
  workspace: ExecutionWorkspace,
): boolean {
  if (!condition) return true;

  const stepOutput = workspace.getOutput(condition.stepId);
  if (!stepOutput) return false; // dependency not executed => skip

  const value = condition.field === "output" ? stepOutput.output : String(stepOutput.status);

  if (condition.expect === "truthy") return Boolean(value && value.trim());
  if (condition.expect === "falsy") return !value || !value.trim();
  return value === condition.expect;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// DAG Executor
// ---------------------------------------------------------------------------

export async function executeDag(
  nodes: DagNode[],
  config: DagExecutionConfig,
): Promise<DagExecutionResult> {
  const startTime = performance.now();
  const results = new Map<string, StepRunResult>();
  const skippedSteps: string[] = [];
  let timedOut = false;

  if (nodes.length === 0) {
    return { results, skippedSteps, totalDurationMs: 0, timedOut: false };
  }

  const waves = topologicalWaves(nodes);
  const totalWaves = waves.length;

  log.info(
    `DAG execution: ${nodes.length} nodes in ${totalWaves} waves, ` +
      `budget=${config.timeBudgetMs}ms, parallelism=${config.maxParallelism}`,
  );

  // Resolve step runner (injected in tests, lazy-imported in production)
  const runStep: StepRunnerFn =
    config.runStep ?? (await import("./step-runner.js").then((m) => m.runStep));

  for (let waveIdx = 0; waveIdx < totalWaves; waveIdx++) {
    const wave = waves[waveIdx]!;

    // Check time budget
    const elapsed = performance.now() - startTime;
    const remaining = config.timeBudgetMs - elapsed;
    if (remaining <= 0 || config.signal?.aborted) {
      timedOut = true;
      log.warn(
        `DAG timed out after ${elapsed.toFixed(0)}ms at wave ${waveIdx + 1}/${totalWaves}, ` +
          `${wave.length} nodes skipped`,
      );
      break;
    }

    // Evaluate conditions and partition wave
    const executableNodes: DagNode[] = [];
    for (const node of wave) {
      if (evaluateCondition(node.condition, config.workspace)) {
        executableNodes.push(node);
      } else {
        skippedSteps.push(node.id);
        config.workspace.setOutput(node.id, {
          status: "skipped",
          output: "",
          durationMs: 0,
        });
        log.debug(`Skipping node ${node.id}: condition not met`);
      }
    }

    if (executableNodes.length === 0) continue;

    // Time budget per step: remaining time / remaining waves (rough estimate)
    const remainingWaves = totalWaves - waveIdx;
    const perStepBudget = Math.max(5000, remaining / remainingWaves);

    // Execute in chunks respecting maxParallelism
    const chunks = chunkArray(executableNodes, config.maxParallelism);

    for (const chunk of chunks) {
      const stepResults = await Promise.all(
        chunk.map((node) =>
          runStep({
            node,
            workspace: config.workspace,
            originalTask: config.originalTask,
            model: config.workerModel,
            cfg: config.cfg,
            agentDir: config.agentDir,
            timeBudgetMs: perStepBudget,
            signal: config.signal,
          }),
        ),
      );

      for (const result of stepResults) {
        results.set(result.nodeId, result);
        config.workspace.setOutput(result.nodeId, {
          status: result.status,
          output: result.output,
          durationMs: result.durationMs,
        });
      }
    }
  }

  const totalDurationMs = performance.now() - startTime;
  log.info(
    `DAG execution complete: ${results.size} executed, ${skippedSteps.length} skipped, ` +
      `${totalDurationMs.toFixed(0)}ms${timedOut ? " (TIMED OUT)" : ""}`,
  );

  return { results, skippedSteps, totalDurationMs, timedOut };
}
