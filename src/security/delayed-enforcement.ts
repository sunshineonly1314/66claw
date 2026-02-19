/**
 * OpenClawCN Security Module - Delayed Enforcement
 * 延迟惩罚系统
 *
 * Instead of immediately blocking on license/integrity violations, this module
 * introduces gradual degradation:
 *
 * 1. First violation: log warning, no user impact
 * 2. After N violations: introduce random delays (50-500ms) to API responses
 * 3. After M violations: increase delays (500-3000ms)
 * 4. After hard threshold: full functionality block
 *
 * This makes it much harder for crackers to identify which check triggers
 * the enforcement — the effect appears random and disconnected from the
 * bypassed check.
 *
 * All state is in-memory only (no disk persistence) to prevent analysis.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("security:enforcement");

// ============================================================================
// State
// ============================================================================

/** Total violation count since process start */
let violationCount = 0;

/** Timestamps of recent violations (rolling window) */
const recentViolations: number[] = [];

/** Maximum violations in rolling window before enforcement escalates */
const ROLLING_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Thresholds — these are in bytecode-protected code
const WARN_THRESHOLD = 2;
const DELAY_THRESHOLD = 5;
const HEAVY_DELAY_THRESHOLD = 10;
const BLOCK_THRESHOLD = 20;

// ============================================================================
// Public API
// ============================================================================

/**
 * Record a security violation.
 *
 * Call this from integrity checks, license checks, anti-debug, etc.
 * The delayed enforcement decides what action to take based on
 * cumulative violation count.
 */
export function recordViolation(source: string): void {
  violationCount++;
  const now = Date.now();
  recentViolations.push(now);

  // Clean rolling window
  while (recentViolations.length > 0 && recentViolations[0]! < now - ROLLING_WINDOW_MS) {
    recentViolations.shift();
  }

  log.debug(
    `Security violation recorded: ${source} (total: ${violationCount}, recent: ${recentViolations.length})`,
  );
}

/**
 * Get the current enforcement delay (in milliseconds).
 *
 * Callers should inject this delay into critical operations
 * (API response handlers, etc.) to degrade the pirated experience.
 *
 * Returns 0 if no enforcement is needed.
 */
export function getEnforcementDelay(): number {
  if (violationCount < WARN_THRESHOLD) {
    return 0;
  }

  if (violationCount < DELAY_THRESHOLD) {
    // Light delay: 50-300ms random
    return 50 + Math.floor(Math.random() * 250);
  }

  if (violationCount < HEAVY_DELAY_THRESHOLD) {
    // Medium delay: 300-1500ms random
    return 300 + Math.floor(Math.random() * 1200);
  }

  if (violationCount < BLOCK_THRESHOLD) {
    // Heavy delay: 1500-5000ms random
    return 1500 + Math.floor(Math.random() * 3500);
  }

  // Beyond block threshold: signal caller to refuse service
  return -1;
}

/**
 * Check if the system should completely refuse service.
 *
 * Returns true when violations have accumulated beyond the hard threshold.
 */
export function shouldBlockService(): boolean {
  return violationCount >= BLOCK_THRESHOLD;
}

/**
 * Apply enforcement delay (async helper).
 *
 * Usage:
 *   await applyEnforcementDelay();
 *   // ... continue with normal operation
 *
 * The delay is invisible to the user if no violations occurred.
 */
export async function applyEnforcementDelay(): Promise<void> {
  const delay = getEnforcementDelay();
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

/**
 * Get current enforcement status (for internal monitoring).
 */
export function getEnforcementStatus(): {
  violationCount: number;
  recentCount: number;
  level: "none" | "warn" | "delay" | "heavy" | "block";
} {
  let level: "none" | "warn" | "delay" | "heavy" | "block";
  if (violationCount >= BLOCK_THRESHOLD) level = "block";
  else if (violationCount >= HEAVY_DELAY_THRESHOLD) level = "heavy";
  else if (violationCount >= DELAY_THRESHOLD) level = "delay";
  else if (violationCount >= WARN_THRESHOLD) level = "warn";
  else level = "none";

  return {
    violationCount,
    recentCount: recentViolations.length,
    level,
  };
}
