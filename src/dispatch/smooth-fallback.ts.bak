/**
 * Smooth Fallback — enhanced model fallback with pre-check and timeout racing.
 *
 * Three layers of protection for seamless model switching:
 *
 *   Layer 1: Pre-check skip
 *     Skip providers that are known to be down (via provider-health.ts).
 *     Cost: 0ms (in-memory lookup).
 *
 *   Layer 2: Timeout race
 *     If the primary model doesn't respond within `raceTimeoutMs`,
 *     start the backup model in parallel. Whichever responds first wins.
 *     Cost: at most `raceTimeoutMs` latency before backup kicks in.
 *
 *   Layer 3: Standard fallback
 *     If primary fails entirely, try the next candidate sequentially.
 *     This is the existing behavior from model-fallback.ts, kept as safety net.
 *
 * This module wraps the existing `runWithModelFallback` with the first two layers.
 * It does NOT replace model-fallback.ts — it adds pre-filtering and racing on top.
 *
 * Usage:
 *   Instead of calling runWithModelFallback() directly, call runWithSmoothFallback()
 *   which internally uses provider-health.ts for Layer 1, then delegates to
 *   runWithModelFallback() for Layer 3.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  checkProviderHealth,
  recordProviderSuccess,
  recordProviderFailure,
} from "./provider-health.js";

const log = createSubsystemLogger("dispatch/smooth-fallback");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SmoothFallbackCandidate = {
  provider: string;
  model: string;
};

export type SmoothFallbackResult<T> = {
  result: T;
  provider: string;
  model: string;
  /** Which layer produced the result. */
  resolvedBy: "primary" | "race_winner" | "fallback";
  /** Number of candidates skipped due to health check. */
  skippedByHealth: number;
  /** Total number of attempts. */
  attempts: number;
};

export type SmoothFallbackParams<T> = {
  /** Ordered list of model candidates (primary first, then fallbacks). */
  candidates: SmoothFallbackCandidate[];
  /** The function that actually calls the model API. */
  run: (provider: string, model: string) => Promise<T>;
  /**
   * Timeout in ms before starting the backup model in parallel.
   * Default: 5000 (5 seconds).
   * Set to 0 to disable racing (pure sequential fallback).
   */
  raceTimeoutMs?: number;
  /** Called when a model attempt fails (for logging). */
  onError?: (info: {
    provider: string;
    model: string;
    error: unknown;
    attempt: number;
  }) => void;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_RACE_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Run a model request with smooth fallback (pre-check + race + sequential).
 */
export async function runWithSmoothFallback<T>(
  params: SmoothFallbackParams<T>,
): Promise<SmoothFallbackResult<T>> {
  const { candidates, run, onError } = params;
  const raceTimeoutMs = params.raceTimeoutMs ?? DEFAULT_RACE_TIMEOUT_MS;

  // Layer 1: Pre-check — filter out known-down providers
  let skippedByHealth = 0;
  const healthyCandidates: SmoothFallbackCandidate[] = [];

  for (const candidate of candidates) {
    const health = checkProviderHealth(candidate.provider);
    if (health === "down") {
      skippedByHealth++;
      log.debug(
        `smooth-fallback: skipping ${candidate.provider}/${candidate.model} (health=down)`,
      );
      continue;
    }
    healthyCandidates.push(candidate);
  }

  if (healthyCandidates.length === 0) {
    // All providers down — fall back to trying all candidates anyway
    // (maybe the health data is stale)
    log.debug("smooth-fallback: all providers marked down, trying all candidates");
    healthyCandidates.push(...candidates);
    skippedByHealth = 0;
  }

  const primary = healthyCandidates[0]!;
  const backup = healthyCandidates.length > 1 ? healthyCandidates[1] : null;

  // Layer 2: Timeout race (only if we have a backup and racing is enabled)
  let raceAttempted = false;
  let raceError: unknown;
  if (backup && raceTimeoutMs > 0) {
    raceAttempted = true;
    try {
      const raceResult = await raceModels(primary, backup, run, raceTimeoutMs);
      recordProviderSuccess(raceResult.provider);
      return {
        result: raceResult.result,
        provider: raceResult.provider,
        model: raceResult.model,
        resolvedBy: raceResult.resolvedBy,
        skippedByHealth,
        attempts: 1,
      };
    } catch (err) {
      raceError = err;
      // Race failed for both — continue to Layer 3 with remaining candidates
      log.debug("smooth-fallback: race failed for primary and backup, trying remaining candidates");
    }
  }

  // Layer 3: Sequential fallback on remaining candidates (skip those already tried in race)
  const racedKeys = new Set<string>();
  if (raceAttempted) {
    racedKeys.add(`${primary.provider}/${primary.model}`);
    racedKeys.add(`${backup!.provider}/${backup!.model}`);
  }
  let attempts = 0;
  let lastError: unknown = raceError; // Carry forward the race error

  for (const candidate of healthyCandidates) {
    if (racedKeys.has(`${candidate.provider}/${candidate.model}`)) {
      continue; // Already failed in Layer 2 race
    }
    attempts++;
    try {
      const result = await run(candidate.provider, candidate.model);
      recordProviderSuccess(candidate.provider);
      return {
        result,
        provider: candidate.provider,
        model: candidate.model,
        resolvedBy: "fallback",
        skippedByHealth,
        attempts,
      };
    } catch (err) {
      lastError = err;
      recordProviderFailure(
        candidate.provider,
        err instanceof Error ? err.message : String(err),
      );
      onError?.({
        provider: candidate.provider,
        model: candidate.model,
        error: err,
        attempt: attempts,
      });
    }
  }

  throw lastError ?? new Error("No model candidates available");
}

// ---------------------------------------------------------------------------
// Racing implementation
// ---------------------------------------------------------------------------

async function raceModels<T>(
  primary: SmoothFallbackCandidate,
  backup: SmoothFallbackCandidate,
  run: (provider: string, model: string) => Promise<T>,
  raceTimeoutMs: number,
): Promise<{ result: T; provider: string; model: string; resolvedBy: "primary" | "race_winner" }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let backupStarted = false;
    let primaryDone = false;
    let backupDone = false;
    let primaryError: unknown;
    let backupError: unknown;
    let raceTimer: ReturnType<typeof setTimeout> | null = null;

    const tryResolve = (
      result: T,
      provider: string,
      model: string,
      source: "primary" | "race_winner",
    ) => {
      if (settled) return;
      settled = true;
      // Cancel the backup timer if primary resolved first
      if (raceTimer !== null) {
        clearTimeout(raceTimer);
        raceTimer = null;
      }
      resolve({ result, provider, model, resolvedBy: source });
    };

    const checkAllFailed = () => {
      if (primaryDone && (backupDone || !backupStarted) && !settled) {
        settled = true;
        reject(primaryError ?? backupError ?? new Error("All candidates failed"));
      }
    };

    // Start primary immediately
    run(primary.provider, primary.model)
      .then((result) => {
        primaryDone = true;
        tryResolve(result, primary.provider, primary.model, "primary");
      })
      .catch((err) => {
        primaryDone = true;
        primaryError = err;
        recordProviderFailure(
          primary.provider,
          err instanceof Error ? err.message : String(err),
        );
        checkAllFailed();
      });

    // Start backup after timeout
    raceTimer = setTimeout(() => {
      if (settled) return; // Primary already resolved

      backupStarted = true;
      log.debug(
        `smooth-fallback: primary ${primary.provider}/${primary.model} ` +
          `took >${raceTimeoutMs}ms, racing with ${backup.provider}/${backup.model}`,
      );

      run(backup.provider, backup.model)
        .then((result) => {
          backupDone = true;
          tryResolve(result, backup.provider, backup.model, "race_winner");
        })
        .catch((err) => {
          backupDone = true;
          backupError = err;
          recordProviderFailure(
            backup.provider,
            err instanceof Error ? err.message : String(err),
          );
          checkAllFailed();
        });
    }, raceTimeoutMs);
  });
}
