import { setTimeout as delay } from "node:timers/promises";

export type BackoffPolicy = {
  initialMs: number;
  maxMs: number;
  factor: number;
  jitter: number;
};

export function computeBackoff(policy: BackoffPolicy, attempt: number) {
  const base = policy.initialMs * policy.factor ** Math.max(attempt - 1, 0);
  const jitter = base * policy.jitter * Math.random();
  return Math.min(policy.maxMs, Math.round(base + jitter));
}

export type ChannelRetryPolicy = BackoffPolicy & {
  /** Maximum number of retry attempts before giving up (0 = no retry). */
  maxAttempts: number;
  /** Minimum uptime (ms) before resetting retry count. Default 60 000 (1 min). */
  healthyUptimeMs: number;
};

export const DEFAULT_CHANNEL_RETRY_POLICY: ChannelRetryPolicy = {
  initialMs: 3_000,
  maxMs: 60_000,
  factor: 2,
  jitter: 0.25,
  maxAttempts: 8,
  healthyUptimeMs: 60_000,
};

export async function sleepWithAbort(ms: number, abortSignal?: AbortSignal) {
  if (ms <= 0) {
    return;
  }
  try {
    await delay(ms, undefined, { signal: abortSignal });
  } catch (err) {
    if (abortSignal?.aborted) {
      throw new Error("aborted", { cause: err });
    }
    throw err;
  }
}
