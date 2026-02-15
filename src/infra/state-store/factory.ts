/**
 * StateStore factory — creates and manages the global StateStore singleton.
 *
 * Usage:
 *   // At gateway startup:
 *   await initStateStore({ backend: "memory" });
 *
 *   // Anywhere else:
 *   const store = getStateStore();
 *   await store.set("key", value);
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import { MemoryStateStore } from "./memory-store.js";
import type { StateStore, StateStoreConfig } from "./types.js";
import { DEFAULT_STATE_STORE_CONFIG } from "./types.js";

const log = createSubsystemLogger("state-store");

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

let globalStore: StateStore | null = null;

/**
 * Initialize the global StateStore.
 * Must be called once during gateway startup before any consumer uses it.
 * Calling it again replaces the store (previous store is closed).
 */
export async function initStateStore(
  config: StateStoreConfig = DEFAULT_STATE_STORE_CONFIG,
): Promise<StateStore> {
  // Close previous store if exists
  if (globalStore) {
    try {
      await globalStore.close();
    } catch {
      // Ignore close errors during replacement
    }
  }

  const store = await createStateStore(config);
  await store.initialize();
  globalStore = store;

  log.info(`State store initialized (backend=${config.backend})`);
  return store;
}

/**
 * Get the global StateStore instance.
 * Throws if initStateStore() has not been called.
 */
export function getStateStore(): StateStore {
  if (!globalStore) {
    throw new Error(
      "StateStore not initialized. Call initStateStore() during gateway startup.",
    );
  }
  return globalStore;
}

/**
 * Get the global StateStore instance or null if not initialized.
 * Use this in optional/fallback paths where the store may not be available.
 */
export function getStateStoreOrNull(): StateStore | null {
  return globalStore;
}

/**
 * Shut down the global StateStore.
 * Called during gateway graceful shutdown.
 */
export async function closeStateStore(): Promise<void> {
  if (globalStore) {
    await globalStore.close();
    globalStore = null;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

async function createStateStore(config: StateStoreConfig): Promise<StateStore> {
  switch (config.backend) {
    case "memory":
      return new MemoryStateStore();

    case "redis": {
      // Dynamic import to avoid loading ioredis when using memory backend
      const { RedisStateStore } = await import("./redis-store.js");
      return new RedisStateStore(config);
    }

    default:
      throw new Error(`Unknown state store backend: ${config.backend}`);
  }
}
