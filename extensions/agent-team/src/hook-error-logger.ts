/**
 * Hook Error Logger — dedup + suppression counting
 *
 * Prevents log explosion when a hook encounters repeated errors.
 *
 * Strategy:
 *  - Key = "[hook]:[ErrorClass]"  (coarse, so bursts of same error type merge)
 *  - First occurrence in TTL window → logger.error (full detail)
 *  - Subsequent occurrences          → silently increment counter
 *  - Every summaryInterval hits      → logger.warn with suppression count
 *
 * Extracted as a factory so it can be unit-tested independently of the
 * plugin's register() closure.
 */

import { createDedupeCache } from "../../../src/infra/dedupe.js";
import type { DedupeCache } from "../../../src/infra/dedupe.js";

export type HookErrorLoggerDeps = {
  error: (msg: string) => void;
  warn: (msg: string) => void;
};

export type HookErrorLogger = {
  log: (hook: string, err: unknown, extra?: string) => void;
  /** Exposed for testing: current suppression count for a key */
  suppressCount: (hook: string, errClass: string) => number;
};

export type HookErrorLoggerOptions = {
  /** Dedup TTL in ms. Default 60 000 (60s). */
  ttlMs?: number;
  /** Max distinct error-class keys tracked. Default 200. */
  maxSize?: number;
  /** Emit a summary warn every N suppressions. Default 10. */
  summaryInterval?: number;
};

/**
 * Create a hook-error logger with built-in dedup and suppression counting.
 *
 * @param deps   logger sinks (error / warn)
 * @param opts   tuning knobs (all optional)
 */
export function createHookErrorLogger(
  deps: HookErrorLoggerDeps,
  opts: HookErrorLoggerOptions = {},
): HookErrorLogger {
  const ttlMs           = opts.ttlMs           ?? 60_000;
  const maxSize         = opts.maxSize          ?? 200;
  const summaryInterval = opts.summaryInterval  ?? 10;

  const cache: DedupeCache = createDedupeCache({ ttlMs, maxSize });
  const suppressCount = new Map<string, number>();

  return {
    log(hook: string, err: unknown, extra = ""): void {
      const errClass = err instanceof Error
        ? (err.constructor.name || "Error")
        : typeof err;
      const errMsg = err instanceof Error ? err.message : String(err);
      const key = `${hook}:${errClass}`;

      const isDup = cache.check(key);
      if (!isDup) {
        suppressCount.set(key, 0);
        deps.error(`[${hook}] unhandled error${extra}: [${errClass}] ${errMsg}`);
      } else {
        const n = (suppressCount.get(key) ?? 0) + 1;
        suppressCount.set(key, n);
        if (n % summaryInterval === 0) {
          deps.warn(
            `[${hook}] error suppressed ${n}x in ${ttlMs / 1000}s window: [${errClass}] ${errMsg}`,
          );
        }
      }
    },

    suppressCount(hook: string, errClass: string): number {
      return suppressCount.get(`${hook}:${errClass}`) ?? 0;
    },
  };
}
