import { describe, expect, it, beforeEach } from "vitest";
import {
  clearEvents,
  enrichEvent,
  exportEvents,
  getMetrics,
  getRecentEvents,
  isTelemetryEnabled,
  recordEvent,
  setTelemetryEnabled,
} from "./dispatch-telemetry.js";

beforeEach(() => {
  clearEvents();
  setTelemetryEnabled(true);
});

// ---------------------------------------------------------------------------
// recordEvent
// ---------------------------------------------------------------------------

describe("recordEvent", () => {
  it("records an event and returns incrementing ID", () => {
    const id1 = recordEvent(makeEvent());
    const id2 = recordEvent(makeEvent());
    expect(id1).toBeGreaterThan(0);
    expect(id2).toBe(id1 + 1);
  });

  it("returns -1 when telemetry is disabled", () => {
    setTelemetryEnabled(false);
    const id = recordEvent(makeEvent());
    expect(id).toBe(-1);
    expect(exportEvents()).toHaveLength(0);
  });

  it("auto-fills timestamp", () => {
    recordEvent(makeEvent());
    const events = exportEvents();
    expect(events[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("ring buffer caps at MAX_EVENTS", () => {
    // Record 1050 events — should keep only last 1000
    for (let i = 0; i < 1050; i++) {
      recordEvent(makeEvent());
    }
    const events = exportEvents();
    expect(events.length).toBeLessThanOrEqual(1000);
  });
});

// ---------------------------------------------------------------------------
// enrichEvent
// ---------------------------------------------------------------------------

describe("enrichEvent", () => {
  it("enriches an existing event with actuals", () => {
    const id = recordEvent(makeEvent());
    const ok = enrichEvent(id, {
      actualInputTokens: 500,
      actualOutputTokens: 200,
      actualCostUsd: 0.005,
      feedbackSignal: "positive",
    });
    expect(ok).toBe(true);

    const events = exportEvents();
    expect(events[0].actualInputTokens).toBe(500);
    expect(events[0].actualOutputTokens).toBe(200);
    expect(events[0].actualCostUsd).toBe(0.005);
    expect(events[0].feedbackSignal).toBe("positive");
  });

  it("returns false for non-existent event", () => {
    const ok = enrichEvent(9999, { actualInputTokens: 100 });
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getMetrics
// ---------------------------------------------------------------------------

describe("getMetrics", () => {
  it("returns zero metrics for empty buffer", () => {
    const m = getMetrics();
    expect(m.totalEvents).toBe(0);
    expect(m.avgLatencyMs).toBe(0);
  });

  it("computes correct breakdowns", () => {
    recordEvent(
      makeEvent({
        classifierUsed: "rules",
        intent: "research",
        complexity: "high",
        strategy: "multi",
      }),
    );
    recordEvent(
      makeEvent({ classifierUsed: "llm", intent: "coding", complexity: "low", strategy: "single" }),
    );
    recordEvent(
      makeEvent({
        classifierUsed: "rules",
        intent: "research",
        complexity: "high",
        strategy: "multi",
      }),
    );

    const m = getMetrics();
    expect(m.totalEvents).toBe(3);
    expect(m.classifierBreakdown["rules"]).toBe(2);
    expect(m.classifierBreakdown["llm"]).toBe(1);
    expect(m.intentBreakdown["research"]).toBe(2);
    expect(m.complexityBreakdown["high"]).toBe(2);
    expect(m.strategyBreakdown["multi"]).toBe(2);
  });

  it("computes LLM fallback rate", () => {
    recordEvent(makeEvent({ classifierUsed: "rules" }));
    recordEvent(makeEvent({ classifierUsed: "llm" }));
    recordEvent(makeEvent({ classifierUsed: "rules" }));
    recordEvent(makeEvent({ classifierUsed: "rules" }));

    const m = getMetrics();
    expect(m.llmFallbackRate).toBe(0.25);
  });

  it("computes latency percentiles", () => {
    for (let i = 1; i <= 100; i++) {
      recordEvent(makeEvent({ durationMs: i }));
    }
    const m = getMetrics();
    expect(m.avgLatencyMs).toBeCloseTo(50.5, 0);
    // p95 index for 100 items: floor(100 * 0.95) = 95, values[95] = 96
    expect(m.p95LatencyMs).toBe(96);
  });
});

// ---------------------------------------------------------------------------
// getRecentEvents
// ---------------------------------------------------------------------------

describe("getRecentEvents", () => {
  it("returns last N events", () => {
    for (let i = 0; i < 30; i++) {
      recordEvent(makeEvent({ intent: `intent_${i}` }));
    }
    const recent = getRecentEvents(5);
    expect(recent).toHaveLength(5);
    expect(recent[0].intent).toBe("intent_25");
    expect(recent[4].intent).toBe("intent_29");
  });
});

// ---------------------------------------------------------------------------
// enable/disable
// ---------------------------------------------------------------------------

describe("setTelemetryEnabled", () => {
  it("toggles telemetry", () => {
    expect(isTelemetryEnabled()).toBe(true);
    setTelemetryEnabled(false);
    expect(isTelemetryEnabled()).toBe(false);
    setTelemetryEnabled(true);
    expect(isTelemetryEnabled()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeEvent(
  overrides: Partial<Parameters<typeof recordEvent>[0]> = {},
): Parameters<typeof recordEvent>[0] {
  return {
    durationMs: 5,
    promptLength: 100,
    hasCJK: false,
    classifierUsed: "rules",
    ruleLatencyMs: 2,
    llmLatencyMs: 0,
    intent: "general",
    confidence: 0.8,
    complexity: "medium",
    strategy: "single",
    complexitySignals: [],
    modelOverridden: false,
    resolvedModel: "default",
    estimatedInputTokens: 100,
    estimatedCostUsd: 0.001,
    ...overrides,
  };
}
