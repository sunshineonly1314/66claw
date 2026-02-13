import { describe, expect, it, beforeEach } from "vitest";
import {
  recordTurn,
  analyzeSessionContext,
  adjustComplexity,
  getSessionWindow,
  clearSession,
  clearAllSessions,
} from "./session-context.js";

const SESSION = "test-session";

beforeEach(() => {
  clearAllSessions();
});

// ---------------------------------------------------------------------------
// recordTurn
// ---------------------------------------------------------------------------

describe("recordTurn", () => {
  it("records turns with incrementing turn numbers", () => {
    recordTurn(SESSION, makeTurn({ promptSnippet: "First" }));
    recordTurn(SESSION, makeTurn({ promptSnippet: "Second" }));

    const window = getSessionWindow(SESSION);
    expect(window).toHaveLength(2);
    expect(window[0].turn).toBe(1);
    expect(window[1].turn).toBe(2);
  });

  it("truncates long snippets", () => {
    const longPrompt = "a".repeat(500);
    recordTurn(SESSION, makeTurn({ promptSnippet: longPrompt }));
    const window = getSessionWindow(SESSION);
    expect(window[0].promptSnippet.length).toBeLessThanOrEqual(200);
  });

  it("caps window at MAX_WINDOW_SIZE", () => {
    for (let i = 0; i < 25; i++) {
      recordTurn(SESSION, makeTurn({ promptSnippet: `Turn ${i}` }));
    }
    const window = getSessionWindow(SESSION);
    expect(window.length).toBeLessThanOrEqual(20);
  });

  it("resets session after timeout", () => {
    const now = Date.now();
    recordTurn(SESSION, makeTurn({ timestamp: now - 40 * 60 * 1000, promptSnippet: "Old" }));

    // New turn 40 minutes later → session timeout
    recordTurn(SESSION, makeTurn({ timestamp: now, promptSnippet: "New" }));
    const window = getSessionWindow(SESSION);
    expect(window).toHaveLength(1);
    expect(window[0].promptSnippet).toBe("New");
  });
});

// ---------------------------------------------------------------------------
// analyzeSessionContext
// ---------------------------------------------------------------------------

describe("analyzeSessionContext", () => {
  it("returns empty context for new session", () => {
    const ctx = analyzeSessionContext(SESSION, "Hello", "general");
    expect(ctx.turnCount).toBe(0);
    expect(ctx.topicContinuation).toBe(false);
    expect(ctx.complexityTrend).toBe("unknown");
    expect(ctx.complexityAdjustment).toBe(0);
    expect(ctx.hasBackReference).toBe(false);
    expect(ctx.dominantIntent).toBeNull();
  });

  it("detects back-reference in Chinese", () => {
    recordTurn(SESSION, makeTurn({ intent: "research", complexity: "high" }));
    const ctx = analyzeSessionContext(SESSION, "继续上面的分析", "research");
    expect(ctx.hasBackReference).toBe(true);
  });

  it("detects back-reference in English", () => {
    recordTurn(SESSION, makeTurn({ intent: "research", complexity: "high" }));
    const ctx = analyzeSessionContext(SESSION, "continue with the above analysis", "research");
    expect(ctx.hasBackReference).toBe(true);
  });

  it("detects topic continuation by matching intent", () => {
    recordTurn(SESSION, makeTurn({ intent: "research" }));
    recordTurn(SESSION, makeTurn({ intent: "research" }));
    const ctx = analyzeSessionContext(SESSION, "Tell me more", "research");
    expect(ctx.topicContinuation).toBe(true);
  });

  it("finds dominant intent", () => {
    recordTurn(SESSION, makeTurn({ intent: "research" }));
    recordTurn(SESSION, makeTurn({ intent: "coding" }));
    recordTurn(SESSION, makeTurn({ intent: "research" }));
    recordTurn(SESSION, makeTurn({ intent: "research" }));
    const ctx = analyzeSessionContext(SESSION, "Next", "general");
    expect(ctx.dominantIntent).toBe("research");
  });

  it("bumps complexity for back-reference to high-complexity turn", () => {
    recordTurn(SESSION, makeTurn({ intent: "research", complexity: "high" }));
    const ctx = analyzeSessionContext(SESSION, "继续之前的研究", "research");
    expect(ctx.complexityAdjustment).toBe(1);
  });

  it("detects escalating complexity trend", () => {
    recordTurn(SESSION, makeTurn({ complexity: "low" }));
    recordTurn(SESSION, makeTurn({ complexity: "low" }));
    recordTurn(SESSION, makeTurn({ complexity: "medium" }));
    recordTurn(SESSION, makeTurn({ complexity: "high" }));
    recordTurn(SESSION, makeTurn({ complexity: "high" }));
    const ctx = analyzeSessionContext(SESSION, "More analysis", "research");
    expect(ctx.complexityTrend).toBe("escalating");
    expect(ctx.complexityAdjustment).toBe(1);
  });

  it("detects declining complexity trend", () => {
    recordTurn(SESSION, makeTurn({ complexity: "high" }));
    recordTurn(SESSION, makeTurn({ complexity: "high" }));
    recordTurn(SESSION, makeTurn({ complexity: "medium" }));
    recordTurn(SESSION, makeTurn({ complexity: "low" }));
    recordTurn(SESSION, makeTurn({ complexity: "low" }));
    const ctx = analyzeSessionContext(SESSION, "ok", "general");
    expect(ctx.complexityTrend).toBe("declining");
    expect(ctx.complexityAdjustment).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// adjustComplexity
// ---------------------------------------------------------------------------

describe("adjustComplexity", () => {
  it("bumps low → medium with +1", () => {
    expect(adjustComplexity("low", 1)).toBe("medium");
  });

  it("bumps medium → high with +1", () => {
    expect(adjustComplexity("medium", 1)).toBe("high");
  });

  it("clamps high + 1 → high", () => {
    expect(adjustComplexity("high", 1)).toBe("high");
  });

  it("drops high → medium with -1", () => {
    expect(adjustComplexity("high", -1)).toBe("medium");
  });

  it("drops medium → low with -1", () => {
    expect(adjustComplexity("medium", -1)).toBe("low");
  });

  it("clamps low - 1 → low", () => {
    expect(adjustComplexity("low", -1)).toBe("low");
  });

  it("returns same level with 0", () => {
    expect(adjustComplexity("medium", 0)).toBe("medium");
  });
});

// ---------------------------------------------------------------------------
// clearSession
// ---------------------------------------------------------------------------

describe("clearSession", () => {
  it("clears a specific session", () => {
    recordTurn(SESSION, makeTurn({}));
    recordTurn("other-session", makeTurn({}));
    clearSession(SESSION);
    expect(getSessionWindow(SESSION)).toHaveLength(0);
    expect(getSessionWindow("other-session")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeTurn(
  overrides: Partial<{
    timestamp: number;
    promptSnippet: string;
    intent: string;
    complexity: "low" | "medium" | "high";
    strategy: "single" | "enhanced" | "multi";
    promptLength: number;
  }>,
): {
  timestamp: number;
  promptSnippet: string;
  intent: string;
  complexity: "low" | "medium" | "high";
  strategy: "single" | "enhanced" | "multi";
  promptLength: number;
} {
  return {
    timestamp: Date.now(),
    promptSnippet: "Test prompt",
    intent: "general",
    complexity: "medium",
    strategy: "single",
    promptLength: 100,
    ...overrides,
  };
}
