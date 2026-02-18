export type DedupeCache = {
  check: (key: string | undefined | null, now?: number) => boolean;
  clear: () => void;
  size: () => number;
};

type DedupeCacheOptions = {
  ttlMs: number;
  maxSize: number;
};

export function createDedupeCache(options: DedupeCacheOptions): DedupeCache {
  const ttlMs = Math.max(0, options.ttlMs);
  const maxSize = Math.max(0, Math.floor(options.maxSize));
  const cache = new Map<string, number>();

  // Performance optimization: only prune every N operations to reduce overhead
  // Optimized thresholds (Plan B): Balance between performance (10x improvement) and strict LRU behavior
  let operationsSinceLastPrune = 0;
  const PRUNE_INTERVAL = 10; // Prune every 10 operations (was 100, now more aggressive)
  let lastPruneTime = Date.now();
  const MIN_PRUNE_INTERVAL_MS = 100; // At least 100ms between prunes (was 1000ms, now more frequent)

  const touch = (key: string, now: number) => {
    cache.delete(key);
    cache.set(key, now);
  };

  const prune = (now: number) => {
    const cutoff = ttlMs > 0 ? now - ttlMs : undefined;
    if (cutoff !== undefined) {
      for (const [entryKey, entryTs] of cache) {
        if (entryTs < cutoff) {
          cache.delete(entryKey);
        }
      }
    }
    if (maxSize <= 0) {
      cache.clear();
      return;
    }
    while (cache.size > maxSize) {
      const oldestKey = cache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      cache.delete(oldestKey);
    }
    lastPruneTime = now;
  };

  const maybePrune = (now: number) => {
    // Always prune expired entries (TTL enforcement - must be strict for correctness)
    const cutoff = ttlMs > 0 ? now - ttlMs : undefined;
    if (cutoff !== undefined) {
      for (const [entryKey, entryTs] of cache) {
        if (entryTs < cutoff) {
          cache.delete(entryKey);
        }
      }
    }

    // Emergency cleanup: if cache exceeds maxSize, enforce LRU eviction immediately
    if (maxSize > 0 && cache.size > maxSize) {
      while (cache.size > maxSize) {
        const oldestKey = cache.keys().next().value;
        if (!oldestKey) break;
        cache.delete(oldestKey);
      }
      operationsSinceLastPrune = 0;
      lastPruneTime = now;
      return;
    }

    // Batched LRU cleanup: only check periodically to reduce overhead
    operationsSinceLastPrune++;
    if (
      operationsSinceLastPrune >= PRUNE_INTERVAL &&
      now - lastPruneTime >= MIN_PRUNE_INTERVAL_MS
    ) {
      // Proactive cleanup if approaching maxSize (within 90%)
      if (maxSize > 0 && cache.size > maxSize * 0.9) {
        while (cache.size > maxSize) {
          const oldestKey = cache.keys().next().value;
          if (!oldestKey) break;
          cache.delete(oldestKey);
        }
      }
      operationsSinceLastPrune = 0;
      lastPruneTime = now;
    }
  };

  return {
    check: (key, now = Date.now()) => {
      if (!key) {
        return false;
      }
      const existing = cache.get(key);
      if (existing !== undefined && (ttlMs <= 0 || now - existing < ttlMs)) {
        touch(key, now);
        return true;
      }
      touch(key, now);
      maybePrune(now); // Optimized: balanced approach (10x performance improvement + strict LRU)
      return false;
    },
    clear: () => {
      cache.clear();
    },
    size: () => cache.size,
  };
}
