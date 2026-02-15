export type RunWithReconnectOptions = {
  /** AbortSignal to stop reconnection attempts. */
  abortSignal?: AbortSignal;
  /** Called when connectFn throws an error. */
  onError?: (error: Error) => void;
  /** Called before sleeping for a reconnection delay (receives the delay in ms). */
  onReconnect?: (delayMs: number) => void;
  /** Initial backoff delay in milliseconds. Defaults to 100. */
  initialDelayMs?: number;
  /** Maximum backoff delay in milliseconds. Defaults to 60000. */
  maxDelayMs?: number;
  /** Jitter ratio (0 to 1). Adds random jitter: delay * (1 + jitterRatio * random()). */
  jitterRatio?: number;
  /** Custom random function (returns 0..1). Defaults to Math.random. */
  random?: () => number;
  /** Strategy hook: return false to stop reconnecting. */
  shouldReconnect?: (params: { outcome: "resolved" | "rejected" }) => boolean;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Repeatedly invokes `connectFn`, reconnecting with exponential backoff on
 * errors and after normal (resolved) completions, until the abort signal fires
 * or the optional `shouldReconnect` hook returns false.
 */
export async function runWithReconnect(
  connectFn: () => Promise<void>,
  options: RunWithReconnectOptions = {},
): Promise<void> {
  const {
    abortSignal,
    onError,
    onReconnect,
    initialDelayMs = 100,
    maxDelayMs = 60_000,
    jitterRatio = 0,
    random = Math.random,
    shouldReconnect,
  } = options;

  let currentDelay = initialDelayMs;

  while (true) {
    if (abortSignal?.aborted) {
      return;
    }

    let outcome: "resolved" | "rejected";
    try {
      await connectFn();
      outcome = "resolved";
      // Success: reset backoff delay
      currentDelay = initialDelayMs;
    } catch (err) {
      outcome = "rejected";
      if (onError) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }

    if (abortSignal?.aborted) {
      return;
    }

    // Check strategy hook
    if (shouldReconnect && !shouldReconnect({ outcome })) {
      return;
    }

    // Apply jitter to delay
    const jitteredDelay =
      jitterRatio > 0 ? currentDelay * (1 + jitterRatio * random()) : currentDelay;

    if (onReconnect) {
      onReconnect(jitteredDelay);
    }

    await sleep(jitteredDelay, abortSignal);

    if (abortSignal?.aborted) {
      return;
    }

    // Exponential backoff for errors (delay doubles after each error, capped at max)
    if (outcome === "rejected") {
      currentDelay = Math.min(currentDelay * 2, maxDelayMs);
    }
  }
}
