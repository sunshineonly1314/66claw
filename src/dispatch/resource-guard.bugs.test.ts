/**
 * Bug exposure test for resource-guard — Bug 4: isCircuitBreakerOpen side effects.
 *
 * The function `isCircuitBreakerOpen()` mutates state (halfOpen, probeInFlight)
 * on every call. If called twice in the same request path, the second call
 * sees the mutated state and blocks incorrectly.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  resetResourceGuard,
  configureResourceGuard,
  recordOutcome,
  checkResources,
  getResourceSnapshot,
} from "./resource-guard.js";

beforeEach(() => {
  resetResourceGuard();
});

describe("Bug 4: isCircuitBreakerOpen side-effect exposure", () => {
  it("calling checkResources twice in half-open state: second call blocks incorrectly", async () => {
    configureResourceGuard({
      circuitBreakerThreshold: 0.5,
      circuitBreakerCooldownMs: 50,
    });

    // Trip the circuit breaker
    for (let i = 0; i < 5; i++) {
      recordOutcome(false);
    }
    expect(getResourceSnapshot().circuitBreakerOpen).toBe(true);

    // Wait for cooldown → half-open
    await new Promise((r) => setTimeout(r, 80));

    // First call: probe is allowed
    const check1 = checkResources("enhanced");
    expect(check1.allowed).toBe(true);

    // BUG 4 EXPOSURE: Second call in the same "request" incorrectly sees
    // probeInFlight=true and blocks. In a real scenario, this could happen
    // if the dispatch pipeline checks resources at multiple stages.
    const check2 = checkResources("enhanced");

    // Before fix: check2.allowed === false (WRONG — probe was for check1)
    // After fix: check2.allowed should depend on whether we want to allow
    // multiple requests during half-open or not. The current design is
    // intentional (only 1 probe), but the problem is that `checkResources`
    // has undocumented side effects.
    //
    // This test DOCUMENTS the current behavior (which may be intended):
    expect(check2.allowed).toBe(false);
    expect(check2.degradedStrategy).toBe("single");
  });

  it("getResourceSnapshot does NOT trigger side effects (uses pure query)", async () => {
    configureResourceGuard({
      circuitBreakerThreshold: 0.5,
      circuitBreakerCooldownMs: 50,
    });

    // Trip
    for (let i = 0; i < 5; i++) {
      recordOutcome(false);
    }

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 80));

    // getResourceSnapshot should NOT mutate state
    const snap1 = getResourceSnapshot();
    const snap2 = getResourceSnapshot();

    // Both calls should return the same result (no side effects from snapshot)
    expect(snap1.circuitBreakerOpen).toBe(snap2.circuitBreakerOpen);
  });

  it("single strategy bypasses circuit breaker entirely", async () => {
    configureResourceGuard({
      circuitBreakerThreshold: 0.5,
      circuitBreakerCooldownMs: 50,
    });

    // Trip
    for (let i = 0; i < 5; i++) {
      recordOutcome(false);
    }

    // Single is always allowed regardless of circuit breaker state
    const check = checkResources("single");
    expect(check.allowed).toBe(true);
  });
});
