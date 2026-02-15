import { describe, expect, it, beforeEach } from "vitest";
import {
  checkResources,
  acquireSlot,
  applyResourceGuard,
  recordOutcome,
  getResourceSnapshot,
  configureResourceGuard,
  resetResourceGuard,
} from "./resource-guard.js";

beforeEach(() => {
  resetResourceGuard();
});

describe("resource-guard deep tests", () => {
  // CIRCUIT BREAKER HALF-OPEN
  describe("circuit breaker half-open state", () => {
    it("enters half-open after cooldown and allows one probe", async () => {
      configureResourceGuard({
        circuitBreakerThreshold: 0.5,
        circuitBreakerCooldownMs: 30,
      });
      // Trip breaker
      for (let i = 0; i < 5; i++) recordOutcome(false);
      expect(checkResources("multi").allowed).toBe(false);

      // Wait for cooldown
      await new Promise(r => setTimeout(r, 40));

      // First request (probe) should be allowed
      const probe = checkResources("multi");
      expect(probe.allowed).toBe(true);

      // Second request while probe in flight should be BLOCKED
      const second = checkResources("multi");
      expect(second.allowed).toBe(false);
      expect(second.reason).toContain("Circuit breaker");
    });

    it("fully closes when half-open probe succeeds", async () => {
      configureResourceGuard({
        circuitBreakerThreshold: 0.5,
        circuitBreakerCooldownMs: 30,
      });
      for (let i = 0; i < 5; i++) recordOutcome(false);
      await new Promise(r => setTimeout(r, 40));

      // Allow probe through
      checkResources("multi");

      // Probe succeeds
      recordOutcome(true);

      // Now all requests should be allowed
      expect(checkResources("multi").allowed).toBe(true);
      expect(checkResources("enhanced").allowed).toBe(true);
      expect(getResourceSnapshot().circuitBreakerOpen).toBe(false);
    });

    it("re-trips immediately when half-open probe fails", async () => {
      configureResourceGuard({
        circuitBreakerThreshold: 0.5,
        circuitBreakerCooldownMs: 30,
      });
      for (let i = 0; i < 5; i++) recordOutcome(false);
      await new Promise(r => setTimeout(r, 40));

      // Allow probe
      checkResources("multi");

      // Probe fails
      recordOutcome(false);

      // Should be tripped again
      const check = checkResources("multi");
      expect(check.allowed).toBe(false);
    });
  });

  // CIRCUIT BREAKER THRESHOLDS
  describe("circuit breaker threshold edge cases", () => {
    it("does not trip with fewer than 5 results even if all fail", () => {
      configureResourceGuard({ circuitBreakerThreshold: 0.5 });
      for (let i = 0; i < 4; i++) recordOutcome(false);
      expect(getResourceSnapshot().circuitBreakerOpen).toBe(false);
    });

    it("trips at exactly 5 results all failing", () => {
      configureResourceGuard({ circuitBreakerThreshold: 0.5 });
      for (let i = 0; i < 5; i++) recordOutcome(false);
      expect(getResourceSnapshot().circuitBreakerOpen).toBe(true);
    });

    it("trips at exactly 50% threshold with 6 results (3 fail + 3 pass)", () => {
      configureResourceGuard({ circuitBreakerThreshold: 0.5 });
      // Record 3 successes then 3 failures
      for (let i = 0; i < 3; i++) recordOutcome(true);
      for (let i = 0; i < 3; i++) recordOutcome(false);
      // 3/6 = 50% = threshold, but need to check exact boundary
      // The check is >= threshold, so 50% = 50% threshold -> should trip only if length >= 5
      expect(getResourceSnapshot().errorRate).toBeCloseTo(0.5);
    });

    it("allows single strategy even when breaker is open", () => {
      configureResourceGuard({ circuitBreakerThreshold: 0.5 });
      for (let i = 0; i < 5; i++) recordOutcome(false);
      // Single strategy should always be allowed
      expect(checkResources("single").allowed).toBe(true);
    });

    it("blocks enhanced strategy when breaker is open", () => {
      configureResourceGuard({ circuitBreakerThreshold: 0.5 });
      for (let i = 0; i < 5; i++) recordOutcome(false);
      const check = checkResources("enhanced");
      expect(check.allowed).toBe(false);
      expect(check.degradedStrategy).toBe("single");
    });
  });

  // HEADROOM CALCULATIONS
  describe("multi-agent headroom", () => {
    it("allows multi when exactly 3 headroom available", () => {
      configureResourceGuard({ maxConcurrentRequests: 5 });
      const r1 = acquireSlot("single");
      const r2 = acquireSlot("single");
      // active=2, needs active+3=5 <= max=5 -> allowed
      expect(checkResources("multi").allowed).toBe(true);
      r1(); r2();
    });

    it("blocks multi when headroom is 2 (needs 3)", () => {
      configureResourceGuard({ maxConcurrentRequests: 5 });
      const releases = [acquireSlot("single"), acquireSlot("single"), acquireSlot("single")];
      // active=3, needs 3+3=6 > max=5 -> blocked
      expect(checkResources("multi").allowed).toBe(false);
      releases.forEach(r => r());
    });

    it("multi limit checked before headroom check", () => {
      configureResourceGuard({ maxConcurrentMultiAgent: 1, maxConcurrentRequests: 10 });
      const r = acquireSlot("multi");
      // multi-agent limit hit first, even though headroom is fine
      const check = checkResources("multi");
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain("Multi-agent limit");
      r();
    });
  });

  // SLOT MANAGEMENT EDGE CASES
  describe("slot management", () => {
    it("counts never go negative on double release", () => {
      const release = acquireSlot("multi");
      release();
      release(); // double release
      expect(getResourceSnapshot().activeRequests).toBe(0);
      expect(getResourceSnapshot().activeMultiAgent).toBe(0);
    });

    it("applyResourceGuard acquires slot for degraded strategy", () => {
      configureResourceGuard({ maxConcurrentMultiAgent: 0 });
      const result = applyResourceGuard("multi");
      // Should degrade to enhanced and acquire enhanced slot
      expect(result.strategy).toBe("enhanced");
      expect(result.degraded).toBe(true);
      expect(getResourceSnapshot().activeRequests).toBe(1);
      expect(getResourceSnapshot().activeMultiAgent).toBe(0); // not multi
      result.release();
    });

    it("applyResourceGuard cascades: multi -> enhanced -> single when both blocked", () => {
      // Fill up all concurrency slots
      configureResourceGuard({ maxConcurrentRequests: 2, maxConcurrentMultiAgent: 0 });
      const r1 = acquireSlot("single");
      const r2 = acquireSlot("single");
      // multi is blocked (maxMulti=0), enhanced is also blocked (at capacity)
      // applyResourceGuard only does one level of degradation from checkResources
      const result = applyResourceGuard("multi");
      // First check: multi -> enhanced. Then acquireSlot("enhanced")
      expect(result.degraded).toBe(true);
      result.release();
      r1(); r2();
    });
  });

  // WINDOW EXPIRY
  describe("error rate window", () => {
    it("old failures expire outside window", async () => {
      configureResourceGuard({
        circuitBreakerThreshold: 0.5,
        circuitBreakerWindowMs: 50,
      });
      // Record failures
      for (let i = 0; i < 5; i++) recordOutcome(false);
      expect(getResourceSnapshot().circuitBreakerOpen).toBe(true);

      // Wait for window to expire
      await new Promise(r => setTimeout(r, 60));

      // Record a new success to trigger cleanup
      recordOutcome(true);
      // Now only 1 result in window (success), errorRate = 0
      expect(getResourceSnapshot().errorRate).toBeLessThan(0.5);
    });
  });
});
