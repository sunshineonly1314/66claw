/**
 * Resource Guard — concurrency limiting + graceful degradation.
 *
 * Layer 14: Prevents resource exhaustion and provides graceful degradation.
 *
 * Problems solved:
 *  1. Too many concurrent LLM calls → API rate limits, timeouts, cost spikes
 *  2. Multi-agent strategy spawns unbounded workers → memory/token explosion
 *  3. System under pressure → should auto-downgrade to cheaper strategies
 *
 * Mechanisms:
 *  - Concurrency semaphore: limits parallel LLM requests
 *  - Strategy degradation: multi → enhanced → single under pressure
 *  - Circuit breaker: if error rate spikes, temporarily block expensive routes
 */

import type { ComplexityLevel, ExecutionStrategy } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Resource guard configuration. */
export type ResourceGuardConfig = {
  /** Maximum concurrent LLM requests. Default: 5. */
  maxConcurrentRequests: number;
  /** Maximum concurrent multi-agent orchestrations. Default: 2. */
  maxConcurrentMultiAgent: number;
  /** Error rate threshold to trigger circuit breaker (0-1). Default: 0.5. */
  circuitBreakerThreshold: number;
  /** Circuit breaker window (ms). Default: 60000 (1 min). */
  circuitBreakerWindowMs: number;
  /** Circuit breaker cooldown (ms). Default: 30000 (30s). */
  circuitBreakerCooldownMs: number;
};

/** Result of a resource check. */
export type ResourceCheckResult = {
  /** Whether the requested strategy is allowed. */
  allowed: boolean;
  /** If not allowed, the degraded strategy to use instead. */
  degradedStrategy?: ExecutionStrategy;
  /** Reason for degradation. */
  reason?: string;
  /** Current resource utilization (0-1). */
  utilization: number;
};

// ---------------------------------------------------------------------------
// Default Config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: ResourceGuardConfig = {
  maxConcurrentRequests: 5,
  maxConcurrentMultiAgent: 2,
  circuitBreakerThreshold: 0.5,
  circuitBreakerWindowMs: 60_000,
  circuitBreakerCooldownMs: 30_000,
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let config: ResourceGuardConfig = { ...DEFAULT_CONFIG };

/** Active request tracking. */
let activeRequests = 0;
let activeMultiAgent = 0;

/** Error tracking for circuit breaker. */
let recentResults: Array<{ timestamp: number; success: boolean }> = [];
let circuitBreakerTrippedAt = 0;
/** Half-open state: allow one probe request after cooldown before fully closing. */
let circuitBreakerHalfOpen = false;
let halfOpenProbeInFlight = false;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Update resource guard configuration.
 */
export function configureResourceGuard(partial: Partial<ResourceGuardConfig>): void {
  config = { ...config, ...partial };
}

/**
 * Check if a given strategy is allowed under current resource constraints.
 * If not, returns a degraded strategy.
 */
export function checkResources(requestedStrategy: ExecutionStrategy): ResourceCheckResult {
  const utilization = activeRequests / config.maxConcurrentRequests;

  // Check circuit breaker first
  if (isCircuitBreakerOpen()) {
    if (requestedStrategy === "multi" || requestedStrategy === "enhanced") {
      return {
        allowed: false,
        degradedStrategy: "single",
        reason: "Circuit breaker open — too many recent failures",
        utilization,
      };
    }
  }

  // Check multi-agent concurrency
  if (requestedStrategy === "multi") {
    if (activeMultiAgent >= config.maxConcurrentMultiAgent) {
      return {
        allowed: false,
        degradedStrategy: "enhanced",
        reason: `Multi-agent limit reached (${activeMultiAgent}/${config.maxConcurrentMultiAgent})`,
        utilization,
      };
    }
    // Multi-agent uses ~3x resources — check if we have headroom
    if (activeRequests + 3 > config.maxConcurrentRequests) {
      return {
        allowed: false,
        degradedStrategy: "enhanced",
        reason: `Insufficient headroom for multi-agent (active=${activeRequests}, max=${config.maxConcurrentRequests})`,
        utilization,
      };
    }
  }

  // Check general concurrency
  if (activeRequests >= config.maxConcurrentRequests) {
    // At capacity — degrade enhanced to single
    if (requestedStrategy === "enhanced") {
      return {
        allowed: false,
        degradedStrategy: "single",
        reason: `Concurrency limit reached (${activeRequests}/${config.maxConcurrentRequests})`,
        utilization: 1.0,
      };
    }
    // Single requests are always allowed (queued at provider level)
  }

  return {
    allowed: true,
    utilization,
  };
}

/**
 * Acquire a resource slot. Call before starting an LLM request.
 * Returns a release function to call when the request completes.
 */
export function acquireSlot(strategy: ExecutionStrategy): () => void {
  activeRequests++;
  if (strategy === "multi") {
    activeMultiAgent++;
  }

  let released = false;
  return () => {
    if (released) return; // Idempotent
    released = true;
    activeRequests = Math.max(0, activeRequests - 1);
    if (strategy === "multi") {
      activeMultiAgent = Math.max(0, activeMultiAgent - 1);
    }
  };
}

/**
 * Record a request outcome for circuit breaker tracking.
 */
export function recordOutcome(success: boolean): void {
  const now = Date.now();
  recentResults.push({ timestamp: now, success });

  // Trim old entries
  const cutoff = now - config.circuitBreakerWindowMs;
  recentResults = recentResults.filter((r) => r.timestamp >= cutoff);

  // Handle half-open probe result
  if (circuitBreakerHalfOpen && halfOpenProbeInFlight) {
    halfOpenProbeInFlight = false;
    if (success) {
      // Probe succeeded → fully close circuit breaker
      circuitBreakerTrippedAt = 0;
      circuitBreakerHalfOpen = false;
      console.log("[dispatch] Circuit breaker closed (half-open probe succeeded)");
    } else {
      // Probe failed → re-trip immediately (prevents oscillation)
      circuitBreakerTrippedAt = now;
      circuitBreakerHalfOpen = false;
      console.warn("[dispatch] Circuit breaker re-tripped (half-open probe failed)");
    }
    return;
  }

  // Check if we should trip the circuit breaker
  if (!success && !isCircuitBreakerOpen()) {
    const errorRate = getErrorRate();
    if (errorRate >= config.circuitBreakerThreshold && recentResults.length >= 5) {
      circuitBreakerTrippedAt = now;
      console.warn(
        `[dispatch] Circuit breaker tripped: error rate ${(errorRate * 100).toFixed(0)}% ` +
          `(${recentResults.filter((r) => !r.success).length}/${recentResults.length} failures)`,
      );
    }
  }
}

/**
 * Get current resource utilization snapshot.
 */
export function getResourceSnapshot(): {
  activeRequests: number;
  activeMultiAgent: number;
  maxRequests: number;
  maxMultiAgent: number;
  utilization: number;
  errorRate: number;
  circuitBreakerOpen: boolean;
} {
  return {
    activeRequests,
    activeMultiAgent,
    maxRequests: config.maxConcurrentRequests,
    maxMultiAgent: config.maxConcurrentMultiAgent,
    utilization: activeRequests / config.maxConcurrentRequests,
    errorRate: getErrorRate(),
    circuitBreakerOpen: isCircuitBreakerTripped(),
  };
}

/**
 * Apply graceful degradation to a strategy based on current resource state.
 * Convenience function that combines checkResources + acquireSlot.
 *
 * @returns The final strategy to use and a release function.
 */
export function applyResourceGuard(requestedStrategy: ExecutionStrategy): {
  strategy: ExecutionStrategy;
  release: () => void;
  degraded: boolean;
  reason?: string;
} {
  const check = checkResources(requestedStrategy);

  if (check.allowed) {
    return {
      strategy: requestedStrategy,
      release: acquireSlot(requestedStrategy),
      degraded: false,
    };
  }

  // Use degraded strategy
  const finalStrategy = check.degradedStrategy ?? "single";
  return {
    strategy: finalStrategy,
    release: acquireSlot(finalStrategy),
    degraded: true,
    reason: check.reason,
  };
}

/**
 * Reset all state. For testing.
 */
export function resetResourceGuard(): void {
  config = { ...DEFAULT_CONFIG };
  activeRequests = 0;
  activeMultiAgent = 0;
  recentResults = [];
  circuitBreakerTrippedAt = 0;
  circuitBreakerHalfOpen = false;
  halfOpenProbeInFlight = false;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getErrorRate(): number {
  if (recentResults.length === 0) return 0;
  const failures = recentResults.filter((r) => !r.success).length;
  return failures / recentResults.length;
}

/**
 * Pure query: is the circuit breaker currently in a tripped/blocking state?
 * No side effects — safe to call from diagnostic/snapshot functions.
 */
function isCircuitBreakerTripped(): boolean {
  if (circuitBreakerTrippedAt === 0) return false;
  const elapsed = Date.now() - circuitBreakerTrippedAt;
  if (elapsed >= config.circuitBreakerCooldownMs) {
    // Cooldown expired — in half-open or recovered state.
    // If a probe is already in flight, still blocking other requests.
    return circuitBreakerHalfOpen && halfOpenProbeInFlight;
  }
  return true;
}

/**
 * Check-and-transition: is the circuit breaker open?
 * Has side effects: transitions to half-open and acquires probe slot.
 * Only call from checkResources() which precedes actual request dispatch.
 */
function isCircuitBreakerOpen(): boolean {
  if (circuitBreakerTrippedAt === 0) return false;
  const elapsed = Date.now() - circuitBreakerTrippedAt;
  if (elapsed >= config.circuitBreakerCooldownMs) {
    // Cooldown expired — enter half-open state instead of fully closing.
    // Allow exactly one probe request. If it succeeds → fully close.
    // If it fails → re-trip immediately (no oscillation).
    if (!circuitBreakerHalfOpen) {
      circuitBreakerHalfOpen = true;
      console.log("[dispatch] Circuit breaker entering half-open state (1 probe allowed)");
    }
    // In half-open: allow one request through, block the rest
    if (circuitBreakerHalfOpen && !halfOpenProbeInFlight) {
      halfOpenProbeInFlight = true;
      return false; // Let the probe through
    }
    // Probe is in flight — block remaining requests until probe resolves
    if (circuitBreakerHalfOpen && halfOpenProbeInFlight) {
      return true;
    }
    return false;
  }
  return true;
}
