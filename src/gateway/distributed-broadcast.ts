/**
 * Distributed broadcast bridge.
 *
 * Wraps the local `broadcast` / `broadcastToConnIds` functions so that events
 * are also published through StateStore Pub/Sub when running in distributed
 * mode (Redis backend).  Each gateway instance subscribes to the channel on
 * startup and delivers incoming remote events to its local WebSocket clients.
 *
 * Echo suppression:  every published frame carries the originating `instanceId`.
 * Receiving instances compare against their own id and skip self-originated
 * events, preventing duplicate delivery.
 */

import { randomUUID } from "node:crypto";
import { getStateStoreOrNull } from "../infra/state-store/index.js";
import type { StateStoreSubscription } from "../infra/state-store/types.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("distributed-broadcast");

// ── Channel name ────────────────────────────────────────────────────────────

const BROADCAST_CHANNEL = "gateway:broadcast";

// ── Types ───────────────────────────────────────────────────────────────────

/** Shape of a frame transmitted through the pub/sub channel. */
type DistributedBroadcastFrame = {
  /** Originating instance id (used for echo suppression). */
  instanceId: string;
  /** WebSocket event name. */
  event: string;
  /** Event payload (already an object; serialisation is handled by StateStore). */
  payload: unknown;
  /** Broadcast options. */
  opts?: {
    dropIfSlow?: boolean;
    stateVersion?: { presence?: number; health?: number };
  };
  /**
   * When set, only these connIds should receive the event.
   * `null` means global broadcast.
   */
  targetConnIds: string[] | null;
};

export type LocalBroadcastFn = (
  event: string,
  payload: unknown,
  opts?: {
    dropIfSlow?: boolean;
    stateVersion?: { presence?: number; health?: number };
  },
) => void;

export type LocalBroadcastToConnIdsFn = (
  event: string,
  payload: unknown,
  connIds: ReadonlySet<string>,
  opts?: {
    dropIfSlow?: boolean;
    stateVersion?: { presence?: number; health?: number };
  },
) => void;

// ── Module-level instance ID (stable per gateway process) ───────────────────

/** Default instance ID for this gateway process. */
const PROCESS_INSTANCE_ID = randomUUID();

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialise the distributed broadcast bridge.
 *
 * Must be called **after** StateStore has been initialised and the local
 * broadcaster is ready.  When StateStore is memory-backed (single node) the
 * bridge effectively becomes a no-op – local functions are returned directly
 * without any pub/sub overhead.
 *
 * @returns Wrapped broadcast functions that transparently handle cross-instance relay.
 */
export async function initDistributedBroadcast(params: {
  localBroadcast: LocalBroadcastFn;
  localBroadcastToConnIds: LocalBroadcastToConnIdsFn;
  /** Override instance ID (for testing only). */
  _instanceId?: string;
}): Promise<{
  broadcast: LocalBroadcastFn;
  broadcastToConnIds: LocalBroadcastToConnIdsFn;
  teardown: () => void;
}> {
  const store = getStateStoreOrNull();
  const instanceId = params._instanceId ?? PROCESS_INSTANCE_ID;

  // ── Single-node fast path ─────────────────────────────────────────────
  if (!store) {
    return {
      broadcast: params.localBroadcast,
      broadcastToConnIds: params.localBroadcastToConnIds,
      teardown: () => {},
    };
  }

  // ── Subscribe to remote broadcast events ──────────────────────────────
  let sub: StateStoreSubscription | null = await store.subscribe(
    BROADCAST_CHANNEL,
    (message) => {
      try {
        const frame = message as DistributedBroadcastFrame;
        // Echo suppression
        if (frame.instanceId === instanceId) {
          return;
        }
        if (frame.targetConnIds) {
          const connIdSet = new Set(frame.targetConnIds);
          params.localBroadcastToConnIds(frame.event, frame.payload, connIdSet, frame.opts);
        } else {
          params.localBroadcast(frame.event, frame.payload, frame.opts);
        }
      } catch (err) {
        log.warn(`failed to handle remote broadcast: ${String(err)}`);
      }
    },
  );

  log.info(`distributed broadcast bridge active (instance=${instanceId.slice(0, 8)})`);

  // ── Retry buffer for failed publishes ──────────────────────────────────
  const MAX_RETRY_BUFFER = 3;
  const retryBuffer: DistributedBroadcastFrame[] = [];

  const publishWithRetry = async (frame: DistributedBroadcastFrame) => {
    // Flush any previously failed frames first
    while (retryBuffer.length > 0) {
      const pending = retryBuffer[0]!;
      try {
        await store.publish(BROADCAST_CHANNEL, pending);
        retryBuffer.shift();
      } catch {
        // Still failing — keep the buffer, skip flush, try current frame
        break;
      }
    }
    try {
      await store.publish(BROADCAST_CHANNEL, frame);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (retryBuffer.length < MAX_RETRY_BUFFER) {
        retryBuffer.push(frame);
        log.warn(`publish failed, buffered for retry (${retryBuffer.length}/${MAX_RETRY_BUFFER}) event=${frame.event}: ${msg}`);
      } else {
        log.error(`publish failed and retry buffer full, dropping event=${frame.event}: ${msg}`);
      }
    }
  };

  // ── Wrapped broadcast: local + publish ────────────────────────────────
  const broadcast: LocalBroadcastFn = (event, payload, opts) => {
    // Always deliver locally first (synchronous, fast path)
    params.localBroadcast(event, payload, opts);

    // Publish to StateStore for remote instances (with retry buffer)
    const frame: DistributedBroadcastFrame = {
      instanceId,
      event,
      payload,
      opts,
      targetConnIds: null,
    };
    void publishWithRetry(frame);
  };

  const broadcastToConnIds: LocalBroadcastToConnIdsFn = (event, payload, connIds, opts) => {
    // Deliver locally first
    params.localBroadcastToConnIds(event, payload, connIds, opts);

    // Publish with target connIds for remote instances (with retry buffer)
    const frame: DistributedBroadcastFrame = {
      instanceId,
      event,
      payload,
      opts,
      targetConnIds: [...connIds],
    };
    void publishWithRetry(frame);
  };

  const teardown = () => {
    if (sub) {
      sub.unsubscribe();
      sub = null;
    }
  };

  return { broadcast, broadcastToConnIds, teardown };
}

/**
 * Get the process-level instance ID for this gateway.
 * Useful for debugging and logging.
 */
export function getInstanceId(): string {
  return PROCESS_INSTANCE_ID;
}
