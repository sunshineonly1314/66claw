/**
 * StateStore module — public API.
 *
 * Usage:
 *   import { initStateStore, getStateStore } from "../infra/state-store/index.js";
 *   import type { StateStore, StateStoreConfig } from "../infra/state-store/index.js";
 */

// Types
export type {
  StateStore,
  StateStoreBackend,
  StateStoreConfig,
  StateStoreLock,
  StateStoreQueueItem,
  StateStoreSubscription,
} from "./types.js";

export { DEFAULT_STATE_STORE_CONFIG } from "./types.js";

// Factory & singleton
export {
  initStateStore,
  getStateStore,
  getStateStoreOrNull,
  closeStateStore,
} from "./factory.js";

// Concrete implementations (for direct instantiation / testing)
export { MemoryStateStore } from "./memory-store.js";
