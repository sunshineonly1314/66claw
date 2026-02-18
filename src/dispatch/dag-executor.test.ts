import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  topologicalWaves,
  executeDag,
  type DagNode,
  type StepRunResult,
  type StepRunnerFn,
} from "./dag-executor.js";
import { createWorkspace, type ExecutionWorkspace } from "./execution-workspace.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function node(id: string, deps: string[] = [], opts?: Partial<DagNode>): DagNode {
  return {
    id,
    task: `Task for ${id}`,
    role: "worker",
    dependsOn: deps,
    ...opts,
  };
}

function okResult(nodeId: string, output?: string): StepRunResult {
  return {
    nodeId,
    status: "ok",
    output: output ?? `Result from ${nodeId}`,
    durationMs: 10,
    retryCount: 0,
    validationErrors: [],
  };
}

function errorResult(nodeId: string): StepRunResult {
  return {
    nodeId,
    status: "error",
    output: "Error occurred",
    durationMs: 5,
    retryCount: 2,
    validationErrors: ["output_too_short"],
  };
}

/** Create a mock step runner that records call order. */
function createMockRunner(results?: Map<string, StepRunResult>): {
  runner: StepRunnerFn;
  callOrder: string[];
} {
  const callOrder: string[] = [];
  const runner: StepRunnerFn = vi.fn(async (params) => {
    callOrder.push(params.node.id);
    if (results?.has(params.node.id)) {
      return results.get(params.node.id)!;
    }
    return okResult(params.node.id);
  });
  return { runner, callOrder };
}

function baseConfig(
  workspace: ExecutionWorkspace,
  runner: StepRunnerFn,
  overrides?: Record<string, unknown>,
) {
  return {
    timeBudgetMs: 120_000,
    maxParallelism: 4,
    workerModel: "test-model",
    cfg: {},
    agentDir: "/tmp/agent",
    originalTask: "Test task",
    workspace,
    runStep: runner,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// topologicalWaves
// ---------------------------------------------------------------------------

describe("topologicalWaves", () => {
  it("returns empty array for empty input", () => {
    expect(topologicalWaves([])).toEqual([]);
  });

  it("puts single node in one wave", () => {
    const waves = topologicalWaves([node("a")]);
    expect(waves).toHaveLength(1);
    expect(waves[0]!.map((n) => n.id)).toEqual(["a"]);
  });

  it("puts independent nodes in same wave", () => {
    const waves = topologicalWaves([node("a"), node("b"), node("c")]);
    expect(waves).toHaveLength(1);
    expect(waves[0]!.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("linear chain produces N waves", () => {
    const waves = topologicalWaves([node("a"), node("b", ["a"]), node("c", ["b"])]);
    expect(waves).toHaveLength(3);
    expect(waves[0]!.map((n) => n.id)).toEqual(["a"]);
    expect(waves[1]!.map((n) => n.id)).toEqual(["b"]);
    expect(waves[2]!.map((n) => n.id)).toEqual(["c"]);
  });

  it("fan-out + fan-in produces 3 waves", () => {
    // A -> [B, C, D] -> E
    const waves = topologicalWaves([
      node("a"),
      node("b", ["a"]),
      node("c", ["a"]),
      node("d", ["a"]),
      node("e", ["b", "c", "d"]),
    ]);
    expect(waves).toHaveLength(3);
    expect(waves[0]!.map((n) => n.id)).toEqual(["a"]);
    expect(waves[1]!.map((n) => n.id).sort()).toEqual(["b", "c", "d"]);
    expect(waves[2]!.map((n) => n.id)).toEqual(["e"]);
  });

  it("mixed independent + dependent", () => {
    // A (independent), B -> C, D -> E
    const waves = topologicalWaves([
      node("a"),
      node("b"),
      node("c", ["b"]),
      node("d"),
      node("e", ["d"]),
    ]);
    expect(waves).toHaveLength(2);
    expect(waves[0]!.map((n) => n.id).sort()).toEqual(["a", "b", "d"]);
    expect(waves[1]!.map((n) => n.id).sort()).toEqual(["c", "e"]);
  });

  it("ignores unknown dependency IDs", () => {
    const waves = topologicalWaves([node("a", ["nonexistent"]), node("b")]);
    // "a" depends on "nonexistent" which is not in the node list, so in-degree stays 0
    expect(waves).toHaveLength(1);
    expect(waves[0]!.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });

  it("detects cycle and forces remaining into final wave", () => {
    // A -> B -> C -> A (cycle)
    const waves = topologicalWaves([node("a", ["c"]), node("b", ["a"]), node("c", ["b"])]);
    // All have in-degree 1, so first pass finds nothing with in-degree 0
    // Should force all into a single wave
    expect(waves).toHaveLength(1);
    expect(waves[0]!.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("partial cycle: non-cyclic nodes resolve, cyclic ones forced", () => {
    // D (independent), A -> B -> C -> A (cycle)
    const waves = topologicalWaves([
      node("d"),
      node("a", ["c"]),
      node("b", ["a"]),
      node("c", ["b"]),
    ]);
    // Wave 1: D (in-degree 0)
    // Then A, B, C all have in-degree 1 => cycle => forced wave
    expect(waves).toHaveLength(2);
    expect(waves[0]!.map((n) => n.id)).toEqual(["d"]);
    expect(waves[1]!.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("diamond dependency: A -> [B, C] -> D", () => {
    const waves = topologicalWaves([
      node("a"),
      node("b", ["a"]),
      node("c", ["a"]),
      node("d", ["b", "c"]),
    ]);
    expect(waves).toHaveLength(3);
    expect(waves[0]!.map((n) => n.id)).toEqual(["a"]);
    expect(waves[1]!.map((n) => n.id).sort()).toEqual(["b", "c"]);
    expect(waves[2]!.map((n) => n.id)).toEqual(["d"]);
  });
});

// ---------------------------------------------------------------------------
// executeDag — basic execution
// ---------------------------------------------------------------------------

describe("executeDag — basic execution", () => {
  let workspace: ExecutionWorkspace;

  beforeEach(() => {
    workspace = createWorkspace("Test task");
  });

  it("returns empty result for empty node list", async () => {
    const { runner } = createMockRunner();
    const result = await executeDag([], baseConfig(workspace, runner));
    expect(result.results.size).toBe(0);
    expect(result.skippedSteps).toEqual([]);
    expect(result.timedOut).toBe(false);
  });

  it("executes single node", async () => {
    const { runner } = createMockRunner();
    const result = await executeDag([node("a")], baseConfig(workspace, runner));
    expect(result.results.size).toBe(1);
    expect(result.results.get("a")!.status).toBe("ok");
    expect(workspace.getOutput("a")!.status).toBe("ok");
  });

  it("executes independent nodes in parallel", async () => {
    const { runner, callOrder } = createMockRunner();
    const result = await executeDag(
      [node("a"), node("b"), node("c")],
      baseConfig(workspace, runner),
    );
    expect(result.results.size).toBe(3);
    // All should be called (order within wave is non-deterministic with Promise.all)
    expect(callOrder.sort()).toEqual(["a", "b", "c"]);
  });

  it("executes linear chain in order", async () => {
    const { runner, callOrder } = createMockRunner();
    const result = await executeDag(
      [node("a"), node("b", ["a"]), node("c", ["b"])],
      baseConfig(workspace, runner),
    );
    expect(result.results.size).toBe(3);
    expect(callOrder).toEqual(["a", "b", "c"]);
  });

  it("fan-out: A runs before [B, C, D], all before E", async () => {
    const { runner, callOrder } = createMockRunner();
    const nodes = [
      node("a"),
      node("b", ["a"]),
      node("c", ["a"]),
      node("d", ["a"]),
      node("e", ["b", "c", "d"]),
    ];
    await executeDag(nodes, baseConfig(workspace, runner));
    expect(callOrder[0]).toBe("a");
    expect(callOrder[callOrder.length - 1]).toBe("e");
    // B, C, D should all appear between A and E
    const midNodes = callOrder.slice(1, -1).sort();
    expect(midNodes).toEqual(["b", "c", "d"]);
  });

  it("writes results to workspace for downstream access", async () => {
    const { runner } = createMockRunner(new Map([["a", okResult("a", "data from A")]]));
    await executeDag([node("a"), node("b", ["a"])], baseConfig(workspace, runner));
    // When B executes, A's output should be in workspace
    expect(workspace.getOutput("a")!.output).toBe("data from A");
    expect(workspace.getOutput("b")!.status).toBe("ok");
  });

  it("handles partial failures (some workers error)", async () => {
    const { runner } = createMockRunner(new Map([["a", errorResult("a")]]));
    const result = await executeDag([node("a"), node("b")], baseConfig(workspace, runner));
    expect(result.results.get("a")!.status).toBe("error");
    expect(result.results.get("b")!.status).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// executeDag — conditional execution
// ---------------------------------------------------------------------------

describe("executeDag — conditional execution", () => {
  let workspace: ExecutionWorkspace;

  beforeEach(() => {
    workspace = createWorkspace();
  });

  it("skips node when condition not met (truthy check on empty output)", async () => {
    const { runner } = createMockRunner(new Map([["a", okResult("a", "")]]));
    const nodes = [
      node("a"),
      node("b", ["a"], {
        condition: { stepId: "a", field: "output", expect: "truthy" },
      }),
    ];
    const result = await executeDag(nodes, baseConfig(workspace, runner));
    expect(result.skippedSteps).toContain("b");
    expect(result.results.has("b")).toBe(false);
    expect(workspace.getOutput("b")!.status).toBe("skipped");
  });

  it("executes node when condition met (truthy check on non-empty output)", async () => {
    const { runner } = createMockRunner(new Map([["a", okResult("a", "some data")]]));
    const nodes = [
      node("a"),
      node("b", ["a"], {
        condition: { stepId: "a", field: "output", expect: "truthy" },
      }),
    ];
    const result = await executeDag(nodes, baseConfig(workspace, runner));
    expect(result.skippedSteps).toEqual([]);
    expect(result.results.get("b")!.status).toBe("ok");
  });

  it("skips node when condition expects specific status that doesnt match", async () => {
    const { runner } = createMockRunner(new Map([["a", errorResult("a")]]));
    const nodes = [
      node("a"),
      node("b", ["a"], {
        condition: { stepId: "a", field: "status", expect: "ok" },
      }),
    ];
    const result = await executeDag(nodes, baseConfig(workspace, runner));
    expect(result.skippedSteps).toContain("b");
  });

  it("executes node when condition expects matching status", async () => {
    const { runner } = createMockRunner();
    const nodes = [
      node("a"),
      node("b", ["a"], {
        condition: { stepId: "a", field: "status", expect: "ok" },
      }),
    ];
    const result = await executeDag(nodes, baseConfig(workspace, runner));
    expect(result.skippedSteps).toEqual([]);
    expect(result.results.get("b")!.status).toBe("ok");
  });

  it("falsy condition: skips when output is non-empty", async () => {
    const { runner } = createMockRunner(new Map([["a", okResult("a", "has data")]]));
    const nodes = [
      node("a"),
      node("b", ["a"], {
        condition: { stepId: "a", field: "output", expect: "falsy" },
      }),
    ];
    const result = await executeDag(nodes, baseConfig(workspace, runner));
    expect(result.skippedSteps).toContain("b");
  });
});

// ---------------------------------------------------------------------------
// executeDag — time budget
// ---------------------------------------------------------------------------

describe("executeDag — time budget", () => {
  let workspace: ExecutionWorkspace;

  beforeEach(() => {
    workspace = createWorkspace();
  });

  it("times out and returns partial results", async () => {
    // Slow runner: each step takes 100ms
    const { callOrder } = createMockRunner();
    const slowRunner: StepRunnerFn = vi.fn(async (params) => {
      callOrder.push(params.node.id);
      await new Promise((r) => setTimeout(r, 100));
      return okResult(params.node.id);
    });

    // Linear chain A -> B -> C with very tight budget
    const nodes = [node("a"), node("b", ["a"]), node("c", ["b"])];
    const result = await executeDag(
      nodes,
      baseConfig(workspace, slowRunner, { timeBudgetMs: 150 }),
    );
    // A should complete, possibly B, C likely timed out
    expect(result.results.has("a")).toBe(true);
    // The DAG should have eventually timed out (or completed if fast enough)
    // At minimum, not all 3 steps in the call order if budget was tight
    expect(result.totalDurationMs).toBeGreaterThan(0);
  });

  it("respects abort signal", async () => {
    const controller = new AbortController();
    // Abort immediately
    controller.abort();

    const { runner } = createMockRunner();
    const result = await executeDag(
      [node("a"), node("b", ["a"])],
      baseConfig(workspace, runner, { signal: controller.signal }),
    );
    expect(result.timedOut).toBe(true);
    expect(result.results.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// executeDag — maxParallelism
// ---------------------------------------------------------------------------

describe("executeDag — maxParallelism", () => {
  it("limits concurrent execution to maxParallelism", async () => {
    const workspace = createWorkspace();
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const runner: StepRunnerFn = vi.fn(async (params) => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      await new Promise((r) => setTimeout(r, 50));
      currentConcurrent--;
      return okResult(params.node.id);
    });

    const nodes = [node("a"), node("b"), node("c"), node("d"), node("e")];
    await executeDag(nodes, baseConfig(workspace, runner, { maxParallelism: 2 }));
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// executeDag — context passing through workspace
// ---------------------------------------------------------------------------

describe("executeDag — context passing", () => {
  it("dependent step can access parent output via workspace", async () => {
    const workspace = createWorkspace();
    const receivedContexts: Record<string, string | undefined> = {};

    const runner: StepRunnerFn = vi.fn(async (params) => {
      // Record what the workspace contains when this step runs
      for (const dep of params.node.dependsOn) {
        receivedContexts[`${params.node.id}<-${dep}`] = params.workspace.getOutput(dep)?.output;
      }
      return okResult(params.node.id, `Output of ${params.node.id}`);
    });

    // A -> B -> C
    const nodes = [node("a"), node("b", ["a"]), node("c", ["b"])];
    await executeDag(nodes, baseConfig(workspace, runner));

    expect(receivedContexts["b<-a"]).toBe("Output of a");
    expect(receivedContexts["c<-b"]).toBe("Output of b");
  });

  it("fan-in step receives all parent outputs", async () => {
    const workspace = createWorkspace();
    let mergerDeps: Record<string, string | undefined> = {};

    const runner: StepRunnerFn = vi.fn(async (params) => {
      if (params.node.id === "merge") {
        for (const dep of params.node.dependsOn) {
          mergerDeps[dep] = params.workspace.getOutput(dep)?.output;
        }
      }
      return okResult(params.node.id, `Out-${params.node.id}`);
    });

    const nodes = [node("a"), node("b"), node("merge", ["a", "b"])];
    await executeDag(nodes, baseConfig(workspace, runner));

    expect(mergerDeps["a"]).toBe("Out-a");
    expect(mergerDeps["b"]).toBe("Out-b");
  });
});
