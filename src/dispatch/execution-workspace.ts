/**
 * Execution Workspace — in-memory context store for DAG step communication.
 *
 * Each DAG execution creates a workspace instance. Steps write outputs to the
 * workspace, and downstream steps read prior outputs for context injection.
 *
 * Design: LangGraph-style State (typed, immutable reads) meets Dify-style
 * template resolution ({{step_id.output}}).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StepOutputStatus = "ok" | "error" | "skipped" | "timeout";

export type StepOutput = {
  status: StepOutputStatus;
  output: string;
  durationMs: number;
  /** Optional structured data for downstream consumption. */
  data?: Record<string, unknown>;
};

export type WorkspaceMetadata = {
  createdAt: number;
  originalTask: string;
  [key: string]: unknown;
};

export type ExecutionWorkspace = {
  /** Store a step's output. */
  setOutput(stepId: string, output: StepOutput): void;
  /** Retrieve a step's output (undefined if step has not executed). */
  getOutput(stepId: string): StepOutput | undefined;
  /** Snapshot of all outputs as a plain object (safe to serialize). */
  getAllOutputs(): Record<string, StepOutput>;
  /** Number of stored step outputs. */
  size(): number;
  /**
   * Resolve template references in a string.
   *
   * Supported patterns:
   *   {{step_id.output}}     — the step's text output
   *   {{step_id.status}}     — "ok" | "error" | "skipped" | "timeout"
   *   {{step_id.durationMs}} — execution time in milliseconds
   *
   * Missing references are preserved with a `:not_found` suffix for debugging.
   */
  resolveTemplates(template: string): string;
  /** Get workspace metadata. */
  getMetadata(): WorkspaceMetadata;
  /** Set a metadata key. */
  setMetadata(key: string, value: unknown): void;
};

// ---------------------------------------------------------------------------
// Template regex — matches {{word.field}}
// ---------------------------------------------------------------------------

const TEMPLATE_RE = /\{\{(\w+)\.(output|status|durationMs)\}\}/g;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createWorkspace(originalTask?: string): ExecutionWorkspace {
  const outputs = new Map<string, StepOutput>();
  const metadata: WorkspaceMetadata = {
    createdAt: Date.now(),
    originalTask: originalTask ?? "",
  };

  return {
    setOutput(stepId: string, output: StepOutput): void {
      outputs.set(stepId, output);
    },

    getOutput(stepId: string): StepOutput | undefined {
      return outputs.get(stepId);
    },

    getAllOutputs(): Record<string, StepOutput> {
      const obj: Record<string, StepOutput> = {};
      for (const [key, value] of outputs) {
        obj[key] = value;
      }
      return obj;
    },

    size(): number {
      return outputs.size;
    },

    resolveTemplates(template: string): string {
      return template.replace(TEMPLATE_RE, (_match, stepId: string, field: string) => {
        const out = outputs.get(stepId);
        if (!out) return `{{${stepId}.${field}:not_found}}`;
        switch (field) {
          case "output":
            return out.output;
          case "status":
            return out.status;
          case "durationMs":
            return String(out.durationMs);
          default:
            return `{{${stepId}.${field}:unknown_field}}`;
        }
      });
    },

    getMetadata(): WorkspaceMetadata {
      return { ...metadata };
    },

    setMetadata(key: string, value: unknown): void {
      (metadata as Record<string, unknown>)[key] = value;
    },
  };
}
