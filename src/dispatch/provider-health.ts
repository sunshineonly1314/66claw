/**
 * Provider Health Monitor — tracks provider availability for smart routing.
 *
 * Maintains an in-memory health map for each provider. When a provider fails,
 * it enters a cooldown period during which the modality router will skip it.
 *
 * Health states:
 *   - "healthy"  : No recent failures, provider is available
 *   - "degraded" : Recent failures but not enough to mark as down
 *   - "down"     : Multiple recent failures, provider should be skipped
 *
 * Recovery:
 *   Providers auto-recover after their cooldown expires. A successful request
 *   immediately resets the failure counter.
 *
 * This module is intentionally simple — no HTTP health checks, no background
 * polling. It relies on recording actual request outcomes from model-fallback.ts.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("dispatch/provider-health");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProviderHealthStatus = "healthy" | "degraded" | "down";

type ProviderHealthRecord = {
  /** Number of consecutive failures. */
  failureCount: number;
  /** Timestamp of the most recent failure. */
  lastFailureAt: number;
  /** Timestamp of the most recent success. */
  lastSuccessAt: number;
  /** Cooldown end timestamp (provider is "down" until this time). */
  downUntil: number;
  /** Reason for the most recent failure (billing, auth, rate_limit, etc.). */
  lastFailureReason?: string;
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Number of consecutive failures before marking a provider as "down". */
const DOWN_THRESHOLD = 3;

/** Number of failures before "degraded" status. */
const DEGRADED_THRESHOLD = 1;

/** Cooldown duration after hitting DOWN_THRESHOLD (ms). Starts at 30s, doubles per failure. */
const BASE_COOLDOWN_MS = 30_000;

/** Maximum cooldown duration (10 minutes). */
const MAX_COOLDOWN_MS = 600_000;

/** Failure records expire after this duration of no activity (ms). */
const RECORD_EXPIRY_MS = 300_000; // 5 minutes

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const healthMap = new Map<string, ProviderHealthRecord>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check the current health status of a provider.
 */
export function checkProviderHealth(provider: string): ProviderHealthStatus {
  const record = healthMap.get(provider);
  if (!record) return "healthy";

  const now = Date.now();

  // Check if record has expired (no activity for RECORD_EXPIRY_MS)
  const lastActivity = Math.max(record.lastFailureAt, record.lastSuccessAt);
  if (now - lastActivity > RECORD_EXPIRY_MS) {
    healthMap.delete(provider);
    return "healthy";
  }

  // Check if cooldown has expired
  if (record.downUntil > 0 && now < record.downUntil) {
    return "down";
  }

  // Cooldown expired — compute effective failure count without mutating the record.
  // Mutation happens lazily on next recordProviderFailure / recordProviderSuccess.
  let effectiveFailures = record.failureCount;
  if (record.downUntil > 0 && now >= record.downUntil) {
    effectiveFailures = Math.max(0, record.failureCount - 1);
  }

  if (effectiveFailures >= DOWN_THRESHOLD) {
    return "down";
  }
  if (effectiveFailures >= DEGRADED_THRESHOLD) {
    return "degraded";
  }

  return "healthy";
}

/**
 * Record a successful request to a provider.
 * Immediately resets failure counter and clears cooldown.
 */
export function recordProviderSuccess(provider: string): void {
  const record = healthMap.get(provider);
  if (!record) return; // No failures recorded, nothing to clear

  record.failureCount = 0;
  record.lastSuccessAt = Date.now();
  record.downUntil = 0;

  log.debug(`provider-health: ${provider} recovered (success recorded)`);
}

/**
 * Record a failed request to a provider.
 * Increments failure counter and may trigger cooldown.
 */
export function recordProviderFailure(
  provider: string,
  error?: string,
  reason?: string,
): void {
  const now = Date.now();
  let record = healthMap.get(provider);

  if (!record) {
    record = {
      failureCount: 0,
      lastFailureAt: 0,
      lastSuccessAt: 0,
      downUntil: 0,
    };
    healthMap.set(provider, record);
  }

  record.failureCount += 1;
  record.lastFailureAt = now;
  if (reason) {
    record.lastFailureReason = reason;
  }

  // Calculate cooldown with exponential backoff
  if (record.failureCount >= DOWN_THRESHOLD) {
    const backoffMultiplier = Math.pow(2, record.failureCount - DOWN_THRESHOLD);
    const cooldownMs = Math.min(MAX_COOLDOWN_MS, BASE_COOLDOWN_MS * backoffMultiplier);
    record.downUntil = now + cooldownMs;

    log.debug(
      `provider-health: ${provider} marked DOWN ` +
        `(failures=${record.failureCount}, cooldown=${Math.round(cooldownMs / 1000)}s` +
        `${error ? `, error=${error}` : ""})`,
    );
  } else if (record.failureCount >= DEGRADED_THRESHOLD) {
    log.debug(
      `provider-health: ${provider} degraded ` +
        `(failures=${record.failureCount}${error ? `, error=${error}` : ""})`,
    );
  }
}

/**
 * Get a snapshot of all provider health states (for debugging/monitoring).
 */
export function getHealthSnapshot(): Record<string, {
  status: ProviderHealthStatus;
  failureCount: number;
  lastFailureAt: number;
  lastSuccessAt: number;
  downUntil: number;
  lastFailureReason?: string;
}> {
  const snapshot: Record<string, {
    status: ProviderHealthStatus;
    failureCount: number;
    lastFailureAt: number;
    lastSuccessAt: number;
    downUntil: number;
    lastFailureReason?: string;
  }> = {};

  for (const [provider, record] of healthMap) {
    snapshot[provider] = {
      status: checkProviderHealth(provider),
      failureCount: record.failureCount,
      lastFailureAt: record.lastFailureAt,
      lastSuccessAt: record.lastSuccessAt,
      downUntil: record.downUntil,
      lastFailureReason: record.lastFailureReason,
    };
  }

  return snapshot;
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

export function resetProviderHealthForTests(): void {
  healthMap.clear();
}
