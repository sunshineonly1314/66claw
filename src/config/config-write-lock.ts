/**
 * Shared config write lock — serializes all read-modify-write operations on openclawcn.json.
 *
 * FIX: Multiple gateway modules (agents, routes, skills, model-config, free-models, security, etc.)
 * all perform the same loadConfig() → modify → writeConfigFile() pattern. Without a shared lock,
 * concurrent writes from different modules can clobber each other's changes.
 *
 * Usage:
 * ```ts
 * import { withConfigWriteLock } from "../../config/config-write-lock.js";
 *
 * await withConfigWriteLock(async () => {
 *   const config = structuredClone(loadConfig());
 *   // ... modify config ...
 *   await writeConfigFile(config);
 * });
 * ```
 */

let _configWriteLock: Promise<void> = Promise.resolve();

/**
 * Execute a function while holding the global config write lock.
 * Ensures only one config read-modify-write cycle runs at a time across all modules.
 */
export async function withConfigWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = _configWriteLock;
  let release: () => void;
  _configWriteLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await prev;
    return await fn();
  } finally {
    release!();
  }
}
