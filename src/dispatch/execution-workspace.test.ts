import { describe, expect, it } from "vitest";
import { createWorkspace, type StepOutput } from "./execution-workspace.js";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

describe("createWorkspace", () => {
  it("creates a workspace with correct metadata", () => {
    const ws = createWorkspace("test task");
    const meta = ws.getMetadata();
    expect(meta.originalTask).toBe("test task");
    expect(meta.createdAt).toBeGreaterThan(0);
  });

  it("defaults originalTask to empty string when not provided", () => {
    const ws = createWorkspace();
    expect(ws.getMetadata().originalTask).toBe("");
  });

  it("starts with zero outputs", () => {
    const ws = createWorkspace();
    expect(ws.size()).toBe(0);
    expect(ws.getAllOutputs()).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// setOutput / getOutput
// ---------------------------------------------------------------------------

describe("setOutput / getOutput", () => {
  const okOutput: StepOutput = { status: "ok", output: "result text", durationMs: 100 };

  it("stores and retrieves a step output", () => {
    const ws = createWorkspace();
    ws.setOutput("t1", okOutput);
    expect(ws.getOutput("t1")).toEqual(okOutput);
  });

  it("returns undefined for non-existent step", () => {
    const ws = createWorkspace();
    expect(ws.getOutput("missing")).toBeUndefined();
  });

  it("overwrites on second setOutput for same step", () => {
    const ws = createWorkspace();
    ws.setOutput("t1", okOutput);
    const updated: StepOutput = { status: "error", output: "failed", durationMs: 50 };
    ws.setOutput("t1", updated);
    expect(ws.getOutput("t1")).toEqual(updated);
    expect(ws.size()).toBe(1);
  });

  it("stores multiple steps independently", () => {
    const ws = createWorkspace();
    ws.setOutput("t1", { status: "ok", output: "a", durationMs: 10 });
    ws.setOutput("t2", { status: "ok", output: "b", durationMs: 20 });
    ws.setOutput("t3", { status: "error", output: "c", durationMs: 30 });
    expect(ws.size()).toBe(3);
    expect(ws.getOutput("t2")!.output).toBe("b");
  });

  it("preserves optional data field", () => {
    const ws = createWorkspace();
    const withData: StepOutput = {
      status: "ok",
      output: "result",
      durationMs: 42,
      data: { rows: 10, query: "SELECT *" },
    };
    ws.setOutput("db_query", withData);
    expect(ws.getOutput("db_query")!.data).toEqual({ rows: 10, query: "SELECT *" });
  });
});

// ---------------------------------------------------------------------------
// getAllOutputs
// ---------------------------------------------------------------------------

describe("getAllOutputs", () => {
  it("returns a snapshot of all outputs", () => {
    const ws = createWorkspace();
    ws.setOutput("t1", { status: "ok", output: "one", durationMs: 10 });
    ws.setOutput("t2", { status: "skipped", output: "", durationMs: 0 });
    const all = ws.getAllOutputs();
    expect(Object.keys(all)).toEqual(["t1", "t2"]);
    expect(all.t1!.output).toBe("one");
    expect(all.t2!.status).toBe("skipped");
  });

  it("snapshot is a copy (mutations don't affect workspace)", () => {
    const ws = createWorkspace();
    ws.setOutput("t1", { status: "ok", output: "x", durationMs: 5 });
    const snapshot = ws.getAllOutputs();
    (snapshot as Record<string, unknown>)["injected"] = { status: "ok" };
    expect(ws.size()).toBe(1);
    expect(ws.getOutput("injected" as string)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveTemplates
// ---------------------------------------------------------------------------

describe("resolveTemplates", () => {
  it("resolves {{step.output}}", () => {
    const ws = createWorkspace();
    ws.setOutput("t1", { status: "ok", output: "hello world", durationMs: 10 });
    expect(ws.resolveTemplates("Result: {{t1.output}}")).toBe("Result: hello world");
  });

  it("resolves {{step.status}}", () => {
    const ws = createWorkspace();
    ws.setOutput("t1", { status: "error", output: "fail", durationMs: 10 });
    expect(ws.resolveTemplates("Status is {{t1.status}}")).toBe("Status is error");
  });

  it("resolves {{step.durationMs}}", () => {
    const ws = createWorkspace();
    ws.setOutput("t1", { status: "ok", output: "ok", durationMs: 1234 });
    expect(ws.resolveTemplates("Took {{t1.durationMs}}ms")).toBe("Took 1234ms");
  });

  it("resolves multiple references in one string", () => {
    const ws = createWorkspace();
    ws.setOutput("a", { status: "ok", output: "alpha", durationMs: 10 });
    ws.setOutput("b", { status: "ok", output: "beta", durationMs: 20 });
    const result = ws.resolveTemplates("First: {{a.output}}, Second: {{b.output}}");
    expect(result).toBe("First: alpha, Second: beta");
  });

  it("marks missing references with :not_found", () => {
    const ws = createWorkspace();
    const result = ws.resolveTemplates("Value: {{missing.output}}");
    expect(result).toBe("Value: {{missing.output:not_found}}");
  });

  it("returns string unchanged when no templates present", () => {
    const ws = createWorkspace();
    expect(ws.resolveTemplates("no templates here")).toBe("no templates here");
  });

  it("handles empty output values correctly", () => {
    const ws = createWorkspace();
    ws.setOutput("t1", { status: "ok", output: "", durationMs: 0 });
    expect(ws.resolveTemplates("Got: [{{t1.output}}]")).toBe("Got: []");
  });

  it("does not resolve invalid patterns", () => {
    const ws = createWorkspace();
    // Only {{word.field}} with known fields should match
    expect(ws.resolveTemplates("{{t1.unknown_field}}")).toBe("{{t1.unknown_field}}");
    expect(ws.resolveTemplates("{{ t1.output }}")).toBe("{{ t1.output }}");
    expect(ws.resolveTemplates("{t1.output}")).toBe("{t1.output}");
  });
});

// ---------------------------------------------------------------------------
// metadata
// ---------------------------------------------------------------------------

describe("metadata", () => {
  it("sets and reads custom metadata", () => {
    const ws = createWorkspace("my task");
    ws.setMetadata("userId", "u-123");
    ws.setMetadata("priority", 5);
    const meta = ws.getMetadata();
    expect(meta.userId).toBe("u-123");
    expect(meta.priority).toBe(5);
    expect(meta.originalTask).toBe("my task");
  });

  it("getMetadata returns a copy", () => {
    const ws = createWorkspace();
    const meta1 = ws.getMetadata();
    (meta1 as Record<string, unknown>).injected = true;
    const meta2 = ws.getMetadata();
    expect(meta2).not.toHaveProperty("injected");
  });
});
