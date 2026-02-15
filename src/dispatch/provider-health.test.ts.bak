import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  checkProviderHealth,
  recordProviderFailure,
  recordProviderSuccess,
  getHealthSnapshot,
  resetProviderHealthForTests,
} from "./provider-health.js";

beforeEach(() => {
  resetProviderHealthForTests();
});

// ---------------------------------------------------------------------------
// checkProviderHealth
// ---------------------------------------------------------------------------

describe("checkProviderHealth", () => {
  it("returns healthy for unknown provider", () => {
    expect(checkProviderHealth("unknown-provider")).toBe("healthy");
  });

  it("returns degraded after 1 failure", () => {
    recordProviderFailure("openai", "timeout");
    expect(checkProviderHealth("openai")).toBe("degraded");
  });

  it("returns degraded after 2 failures", () => {
    recordProviderFailure("openai", "timeout");
    recordProviderFailure("openai", "timeout");
    expect(checkProviderHealth("openai")).toBe("degraded");
  });

  it("returns down after 3 failures", () => {
    recordProviderFailure("openai");
    recordProviderFailure("openai");
    recordProviderFailure("openai");
    expect(checkProviderHealth("openai")).toBe("down");
  });

  it("remains down after more failures", () => {
    for (let i = 0; i < 5; i++) recordProviderFailure("openai");
    expect(checkProviderHealth("openai")).toBe("down");
  });
});

// ---------------------------------------------------------------------------
// recordProviderSuccess
// ---------------------------------------------------------------------------

describe("recordProviderSuccess", () => {
  it("does nothing for a provider with no failure history", () => {
    recordProviderSuccess("pristine");
    // Should not throw, and no record should be created
    expect(checkProviderHealth("pristine")).toBe("healthy");
  });

  it("recovers from degraded to healthy", () => {
    recordProviderFailure("deepseek");
    expect(checkProviderHealth("deepseek")).toBe("degraded");

    recordProviderSuccess("deepseek");
    expect(checkProviderHealth("deepseek")).toBe("healthy");
  });

  it("recovers from down to healthy", () => {
    recordProviderFailure("deepseek");
    recordProviderFailure("deepseek");
    recordProviderFailure("deepseek");
    expect(checkProviderHealth("deepseek")).toBe("down");

    recordProviderSuccess("deepseek");
    expect(checkProviderHealth("deepseek")).toBe("healthy");
  });
});

// ---------------------------------------------------------------------------
// Provider isolation
// ---------------------------------------------------------------------------

describe("provider isolation", () => {
  it("tracks providers independently", () => {
    recordProviderFailure("openai");
    recordProviderFailure("openai");
    recordProviderFailure("openai");

    expect(checkProviderHealth("openai")).toBe("down");
    expect(checkProviderHealth("deepseek")).toBe("healthy");
    expect(checkProviderHealth("qwen")).toBe("healthy");
  });
});

// ---------------------------------------------------------------------------
// Cooldown and expiry
// ---------------------------------------------------------------------------

describe("cooldown behavior", () => {
  it("returns down during cooldown period", () => {
    recordProviderFailure("google");
    recordProviderFailure("google");
    recordProviderFailure("google");

    // Should be down immediately after 3 failures
    expect(checkProviderHealth("google")).toBe("down");
  });

  it("recovers after cooldown expires (simulated)", () => {
    vi.useFakeTimers();
    try {
      recordProviderFailure("google");
      recordProviderFailure("google");
      recordProviderFailure("google");
      expect(checkProviderHealth("google")).toBe("down");

      // Advance past 30s cooldown
      vi.advanceTimersByTime(31_000);
      // After cooldown, effective failures decremented by 1 → 2, still degraded
      expect(checkProviderHealth("google")).toBe("degraded");
    } finally {
      vi.useRealTimers();
    }
  });

  it("record expires after 5 minutes of inactivity", () => {
    vi.useFakeTimers();
    try {
      recordProviderFailure("google");
      expect(checkProviderHealth("google")).toBe("degraded");

      // Advance past 5 minutes
      vi.advanceTimersByTime(301_000);
      expect(checkProviderHealth("google")).toBe("healthy");
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// getHealthSnapshot
// ---------------------------------------------------------------------------

describe("getHealthSnapshot", () => {
  it("returns empty snapshot for no recorded providers", () => {
    const snapshot = getHealthSnapshot();
    expect(Object.keys(snapshot)).toHaveLength(0);
  });

  it("includes providers with failures", () => {
    recordProviderFailure("openai", "rate limit");
    recordProviderFailure("deepseek", "network error");

    const snapshot = getHealthSnapshot();
    expect(snapshot.openai).toBeDefined();
    expect(snapshot.openai.status).toBe("degraded");
    expect(snapshot.openai.failureCount).toBe(1);
    expect(snapshot.deepseek).toBeDefined();
    expect(snapshot.deepseek.status).toBe("degraded");
  });

  it("does not mutate state when called (no side effects)", () => {
    vi.useFakeTimers();
    try {
      recordProviderFailure("google");
      recordProviderFailure("google");
      recordProviderFailure("google");
      expect(checkProviderHealth("google")).toBe("down");

      // Advance past cooldown
      vi.advanceTimersByTime(31_000);

      // Call getHealthSnapshot — should not mutate internal state
      const snap1 = getHealthSnapshot();
      const snap2 = getHealthSnapshot();
      expect(snap1.google.failureCount).toBe(snap2.google.failureCount);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// checkProviderHealth is side-effect free
// ---------------------------------------------------------------------------

describe("checkProviderHealth side-effect free", () => {
  it("calling check multiple times does not change the result", () => {
    recordProviderFailure("qwen");
    recordProviderFailure("qwen");
    const first = checkProviderHealth("qwen");
    const second = checkProviderHealth("qwen");
    const third = checkProviderHealth("qwen");
    expect(first).toBe(second);
    expect(second).toBe(third);
  });
});
