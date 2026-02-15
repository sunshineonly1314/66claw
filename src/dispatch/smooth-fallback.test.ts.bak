import { describe, expect, it, beforeEach, vi } from "vitest";
import { runWithSmoothFallback } from "./smooth-fallback.js";
import { resetProviderHealthForTests, recordProviderFailure } from "./provider-health.js";

beforeEach(() => {
  resetProviderHealthForTests();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function succeedAfter<T>(ms: number, value: T): () => Promise<T> {
  return async () => {
    await delay(ms);
    return value;
  };
}

function failAfter(ms: number, message: string): () => Promise<never> {
  return async () => {
    await delay(ms);
    throw new Error(message);
  };
}

// ---------------------------------------------------------------------------
// Layer 1: Pre-check (health filtering)
// ---------------------------------------------------------------------------

describe("Layer 1: health pre-check", () => {
  it("skips providers marked as down", async () => {
    recordProviderFailure("bad-provider");
    recordProviderFailure("bad-provider");
    recordProviderFailure("bad-provider");

    const result = await runWithSmoothFallback({
      candidates: [
        { provider: "bad-provider", model: "bad-model" },
        { provider: "good-provider", model: "good-model" },
      ],
      run: async (provider) => {
        if (provider === "bad-provider") throw new Error("should not be called");
        return "ok";
      },
      raceTimeoutMs: 0, // Disable racing for this test
    });

    expect(result.provider).toBe("good-provider");
    expect(result.skippedByHealth).toBe(1);
  });

  it("tries all candidates when all providers are down", async () => {
    recordProviderFailure("a");
    recordProviderFailure("a");
    recordProviderFailure("a");
    recordProviderFailure("b");
    recordProviderFailure("b");
    recordProviderFailure("b");

    const result = await runWithSmoothFallback({
      candidates: [
        { provider: "a", model: "m1" },
        { provider: "b", model: "m2" },
      ],
      run: async () => "fallback-ok",
      raceTimeoutMs: 0,
    });

    expect(result.result).toBe("fallback-ok");
    expect(result.skippedByHealth).toBe(0); // Reset because all were down
  });
});

// ---------------------------------------------------------------------------
// Layer 2: Timeout race
// ---------------------------------------------------------------------------

describe("Layer 2: timeout race", () => {
  it("resolves with primary when primary is fast", async () => {
    const result = await runWithSmoothFallback({
      candidates: [
        { provider: "fast", model: "m1" },
        { provider: "slow", model: "m2" },
      ],
      run: async (provider) => {
        if (provider === "fast") return "primary-wins";
        await delay(200);
        return "backup-wins";
      },
      raceTimeoutMs: 50,
    });

    expect(result.result).toBe("primary-wins");
    expect(result.provider).toBe("fast");
    expect(result.resolvedBy).toBe("primary");
  });

  it("resolves with backup when primary is slow", async () => {
    const result = await runWithSmoothFallback({
      candidates: [
        { provider: "slow", model: "m1" },
        { provider: "fast", model: "m2" },
      ],
      run: async (provider) => {
        if (provider === "slow") {
          await delay(200);
          return "primary-slow";
        }
        return "backup-fast";
      },
      raceTimeoutMs: 30,
    });

    expect(result.result).toBe("backup-fast");
    expect(result.provider).toBe("fast");
    expect(result.resolvedBy).toBe("race_winner");
  });
});

// ---------------------------------------------------------------------------
// Layer 3: Sequential fallback
// ---------------------------------------------------------------------------

describe("Layer 3: sequential fallback", () => {
  it("works with single candidate (no race)", async () => {
    const result = await runWithSmoothFallback({
      candidates: [{ provider: "only", model: "m1" }],
      run: async () => "single-ok",
      raceTimeoutMs: 100,
    });

    expect(result.result).toBe("single-ok");
    expect(result.provider).toBe("only");
  });

  it("falls back to third candidate when race fails for first two", async () => {
    const result = await runWithSmoothFallback({
      candidates: [
        { provider: "a", model: "m1" },
        { provider: "b", model: "m2" },
        { provider: "c", model: "m3" },
      ],
      run: async (provider) => {
        if (provider === "a" || provider === "b") throw new Error(`${provider} failed`);
        return "c-wins";
      },
      raceTimeoutMs: 10,
    });

    expect(result.result).toBe("c-wins");
    expect(result.provider).toBe("c");
    expect(result.resolvedBy).toBe("fallback");
  });

  it("throws when all candidates fail", async () => {
    await expect(
      runWithSmoothFallback({
        candidates: [
          { provider: "a", model: "m1" },
          { provider: "b", model: "m2" },
        ],
        run: async (provider) => {
          throw new Error(`${provider} failed`);
        },
        raceTimeoutMs: 10,
      }),
    ).rejects.toThrow();
  });

  it("preserves race error when only 2 candidates exist", async () => {
    // This is the edge case: 2 candidates, race fails, Layer 3 skips both.
    // Should throw the race error, not "No model candidates available".
    await expect(
      runWithSmoothFallback({
        candidates: [
          { provider: "a", model: "m1" },
          { provider: "b", model: "m2" },
        ],
        run: async (provider) => {
          throw new Error(`${provider} unavailable`);
        },
        raceTimeoutMs: 10,
      }),
    ).rejects.toThrow(/unavailable/);
  });
});

// ---------------------------------------------------------------------------
// Racing disabled
// ---------------------------------------------------------------------------

describe("racing disabled (raceTimeoutMs=0)", () => {
  it("runs purely sequential", async () => {
    const callOrder: string[] = [];
    const result = await runWithSmoothFallback({
      candidates: [
        { provider: "a", model: "m1" },
        { provider: "b", model: "m2" },
      ],
      run: async (provider) => {
        callOrder.push(provider);
        if (provider === "a") throw new Error("a failed");
        return "b-ok";
      },
      raceTimeoutMs: 0,
    });

    expect(result.result).toBe("b-ok");
    expect(callOrder).toEqual(["a", "b"]);
  });
});

// ---------------------------------------------------------------------------
// onError callback
// ---------------------------------------------------------------------------

describe("onError callback", () => {
  it("calls onError for each failed attempt in Layer 3", async () => {
    const errors: string[] = [];
    await expect(
      runWithSmoothFallback({
        candidates: [
          { provider: "a", model: "m1" },
          { provider: "b", model: "m2" },
          { provider: "c", model: "m3" },
        ],
        run: async (provider) => {
          throw new Error(`${provider} failed`);
        },
        raceTimeoutMs: 10,
        onError: (info) => {
          errors.push(info.provider);
        },
      }),
    ).rejects.toThrow();

    // a and b fail in race (no onError for Layer 2), c fails in Layer 3
    expect(errors).toContain("c");
  });
});
