import { loadConfig } from "../config/config.js";
import { callGateway } from "../gateway/call.js";
import { onAgentEvent } from "../infra/agent-events.js";
import { getStateStoreOrNull } from "../infra/state-store/index.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { type DeliveryContext, normalizeDeliveryContext } from "../utils/delivery-context.js";
import { resetAnnounceQueuesForTests } from "./subagent-announce-queue.js";
import { runSubagentAnnounceFlow, type SubagentRunOutcome } from "./subagent-announce.js";
import {
  loadSubagentRegistryFromDisk,
  saveSubagentRegistryToDisk,
} from "./subagent-registry.store.js";
import { resolveAgentTimeoutMs } from "./timeout.js";

const log = createSubsystemLogger("subagent-registry");

export type SubagentRunRecord = {
  runId: string;
  childSessionKey: string;
  requesterSessionKey: string;
  requesterOrigin?: DeliveryContext;
  requesterDisplayKey: string;
  task: string;
  cleanup: "delete" | "keep";
  label?: string;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  outcome?: SubagentRunOutcome;
  archiveAtMs?: number;
  cleanupCompletedAt?: number;
  cleanupHandled?: boolean;
  /** Number of times announce delivery has been attempted and returned false (deferred). */ // [CN-MERGE:a6c741eb46]
  announceRetryCount?: number;
  /** Timestamp of the last announce retry attempt (for backoff). */
  lastAnnounceRetryAt?: number;
};

const subagentRuns = new Map<string, SubagentRunRecord>();
/** Tracks runIds that were added to subagentRuns via remote merge (not locally registered). */
const remoteMergedRunIds = new Set<string>();
let sweeper: NodeJS.Timeout | null = null;
let listenerStarted = false;
let listenerStop: (() => void) | null = null;
// Use var to avoid TDZ when init runs across circular imports during bootstrap.
var restoreAttempted = false;
const SUBAGENT_ANNOUNCE_TIMEOUT_MS = 120_000;
const MAX_ANNOUNCE_RETRY_COUNT = 3; // [CN-MERGE:a6c741eb46]
const ANNOUNCE_EXPIRY_MS = 5 * 60_000; // 5 minutes

const SUBAGENT_STORE_KEY = "subagent:runs";

function persistSubagentRuns() {
  try {
    saveSubagentRegistryToDisk(subagentRuns);
  } catch {
    // ignore persistence failures
  }
}

/**
 * Write-through to StateStore (best-effort, non-blocking).
 *
 * Uses a per-runId sequence counter to prevent stale writes: if register+release
 * happen in quick succession, the hset from register won't execute after the hdel
 * from release (which would create a zombie entry).
 */
const storeSyncSeq = new Map<string, number>();

function storeSync(runId: string, entry: SubagentRunRecord | null): void {
  const store = getStateStoreOrNull();
  if (!store) return;

  // Increment sequence number — the latest call always wins
  const seq = (storeSyncSeq.get(runId) ?? 0) + 1;
  storeSyncSeq.set(runId, seq);

  void (async () => {
    // Check if a newer storeSync call was made for this runId
    if (storeSyncSeq.get(runId) !== seq) return;

    if (entry === null) {
      await store.hdel(SUBAGENT_STORE_KEY, runId);
      // Clean up sequence tracking for deleted entries AFTER successful delete
      // Only delete if we're still the latest sequence (防止竞态)
      if (storeSyncSeq.get(runId) === seq) {
        storeSyncSeq.delete(runId);
      }
    } else {
      // Re-check after async gap — a release may have fired in between
      if (storeSyncSeq.get(runId) !== seq) return;
      await store.hset(SUBAGENT_STORE_KEY, runId, entry);
    }
  })().catch((err) => {
    log.warn(`storeSync failed for ${runId}: ${String(err)}`);
    // On error, only clean up sequence if we're still the latest
    // This prevents a failed operation from blocking future attempts
    if (entry === null && storeSyncSeq.get(runId) === seq) {
      storeSyncSeq.delete(runId);
    }
  });
}

/** Read all runs from StateStore (for cross-instance visibility). */
async function storeGetAll(): Promise<Map<string, SubagentRunRecord>> {
  const store = getStateStoreOrNull();
  if (!store) return new Map();
  try {
    const all = await store.hgetall<SubagentRunRecord>(SUBAGENT_STORE_KEY);
    const map = new Map<string, SubagentRunRecord>();
    for (const [id, record] of Object.entries(all)) {
      if (record && typeof record === "object" && record.runId) {
        map.set(id, record);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

const resumedRuns = new Set<string>();

function startSubagentAnnounceCleanupFlow(runId: string, entry: SubagentRunRecord): boolean {
  if (!beginSubagentCleanup(runId)) {
    return false;
  }
  const requesterOrigin = normalizeDeliveryContext(entry.requesterOrigin);
  void runSubagentAnnounceFlow({
    childSessionKey: entry.childSessionKey,
    childRunId: entry.runId,
    requesterSessionKey: entry.requesterSessionKey,
    requesterOrigin,
    requesterDisplayKey: entry.requesterDisplayKey,
    task: entry.task,
    timeoutMs: SUBAGENT_ANNOUNCE_TIMEOUT_MS,
    cleanup: entry.cleanup,
    waitForCompletion: false,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    label: entry.label,
    outcome: entry.outcome,
  }).then((didAnnounce) => {
    finalizeSubagentCleanup(runId, entry.cleanup, didAnnounce);
  });
  return true;
}

function resumeSubagentRun(runId: string) {
  if (!runId || resumedRuns.has(runId)) {
    return;
  }
  const entry = subagentRuns.get(runId);
  if (!entry) {
    return;
  }
  if (entry.cleanupCompletedAt) {
    return;
  }

  // Skip entries that have exhausted their retry budget or expired (#18264). // [CN-MERGE:a6c741eb46]
  if ((entry.announceRetryCount ?? 0) >= MAX_ANNOUNCE_RETRY_COUNT) {
    entry.cleanupCompletedAt = Date.now();
    persistSubagentRuns();
    return;
  }
  if (typeof entry.endedAt === "number" && Date.now() - entry.endedAt > ANNOUNCE_EXPIRY_MS) {
    entry.cleanupCompletedAt = Date.now();
    persistSubagentRuns();
    return;
  }

  if (typeof entry.endedAt === "number" && entry.endedAt > 0) {
    if (!startSubagentAnnounceCleanupFlow(runId, entry)) {
      return;
    }
    resumedRuns.add(runId);
    return;
  }

  // Wait for completion again after restart.
  const cfg = loadConfig();
  const waitTimeoutMs = resolveSubagentWaitTimeoutMs(cfg, undefined);
  void waitForSubagentCompletion(runId, waitTimeoutMs);
  resumedRuns.add(runId);
}

function restoreSubagentRunsOnce() {
  if (restoreAttempted) {
    return;
  }
  restoreAttempted = true;
  try {
    const restored = loadSubagentRegistryFromDisk();
    if (restored.size === 0) {
      return;
    }
    for (const [runId, entry] of restored.entries()) {
      if (!runId || !entry) {
        continue;
      }
      // Keep any newer in-memory entries.
      if (!subagentRuns.has(runId)) {
        subagentRuns.set(runId, entry);
      }
    }

    // Resume pending work.
    ensureListener();
    if ([...subagentRuns.values()].some((entry) => entry.archiveAtMs)) {
      startSweeper();
    }
    for (const runId of subagentRuns.keys()) {
      resumeSubagentRun(runId);
    }
  } catch {
    // ignore restore failures
  }
}

function resolveArchiveAfterMs(cfg?: ReturnType<typeof loadConfig>) {
  const config = cfg ?? loadConfig();
  const minutes = config.agents?.defaults?.subagents?.archiveAfterMinutes ?? 60;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return undefined;
  }
  return Math.max(1, Math.floor(minutes)) * 60_000;
}

function resolveSubagentWaitTimeoutMs(
  cfg: ReturnType<typeof loadConfig>,
  runTimeoutSeconds?: number,
) {
  return resolveAgentTimeoutMs({ cfg, overrideSeconds: runTimeoutSeconds });
}

function startSweeper() {
  if (sweeper) {
    return;
  }
  sweeper = setInterval(() => {
    void sweepSubagentRuns();
  }, 60_000);
  sweeper.unref?.();
}

function stopSweeper() {
  if (!sweeper) {
    return;
  }
  clearInterval(sweeper);
  sweeper = null;
}

async function sweepSubagentRuns() {
  const now = Date.now();
  let mutated = false;
  for (const [runId, entry] of subagentRuns.entries()) {
    if (!entry.archiveAtMs || entry.archiveAtMs > now) {
      continue;
    }
    subagentRuns.delete(runId);
    storeSync(runId, null);
    mutated = true;
    try {
      await callGateway({
        method: "sessions.delete",
        params: { key: entry.childSessionKey, deleteTranscript: true },
        timeoutMs: 10_000,
      });
    } catch {
      // ignore
    }
  }
  if (mutated) {
    persistSubagentRuns();
  }
  if (subagentRuns.size === 0) {
    stopSweeper();
  }
}

function ensureListener() {
  if (listenerStarted) {
    return;
  }
  listenerStarted = true;
  listenerStop = onAgentEvent((evt) => {
    if (!evt || evt.stream !== "lifecycle") {
      return;
    }
    const entry = subagentRuns.get(evt.runId);
    if (!entry) {
      return;
    }
    const phase = evt.data?.phase;
    if (phase === "start") {
      const startedAt = typeof evt.data?.startedAt === "number" ? evt.data.startedAt : undefined;
      if (startedAt) {
        entry.startedAt = startedAt;
        persistSubagentRuns();
        storeSync(evt.runId, entry);
      }
      return;
    }
    if (phase !== "end" && phase !== "error") {
      return;
    }
    const endedAt = typeof evt.data?.endedAt === "number" ? evt.data.endedAt : Date.now();
    entry.endedAt = endedAt;
    if (phase === "error") {
      const error = typeof evt.data?.error === "string" ? evt.data.error : undefined;
      entry.outcome = { status: "error", error };
    } else if (evt.data?.aborted) {
      entry.outcome = { status: "timeout" };
    } else {
      entry.outcome = { status: "ok" };
    }
    persistSubagentRuns();
    storeSync(evt.runId, entry);

    void startSubagentAnnounceCleanupFlow(evt.runId, entry);
  });
}

function finalizeSubagentCleanup(runId: string, cleanup: "delete" | "keep", didAnnounce: boolean) {
  const entry = subagentRuns.get(runId);
  if (!entry) {
    return;
  }
  if (!didAnnounce) {
    // Track retry count and enforce limits (#18264). // [CN-MERGE:a6c741eb46]
    const retryCount = (entry.announceRetryCount ?? 0) + 1;
    entry.announceRetryCount = retryCount;
    entry.lastAnnounceRetryAt = Date.now();

    const endedAgo = typeof entry.endedAt === "number" ? Date.now() - entry.endedAt : 0;
    if (retryCount >= MAX_ANNOUNCE_RETRY_COUNT || endedAgo > ANNOUNCE_EXPIRY_MS) {
      entry.cleanupCompletedAt = Date.now();
      persistSubagentRuns();
      return;
    }

    // Allow retry on the next wake if announce was deferred or failed.
    entry.cleanupHandled = false;
    persistSubagentRuns();
    storeSync(runId, entry);
    return;
  }
  if (cleanup === "delete") {
    subagentRuns.delete(runId);
    persistSubagentRuns();
    storeSync(runId, null);
    return;
  }
  entry.cleanupCompletedAt = Date.now();
  persistSubagentRuns();
  storeSync(runId, entry);
}

function beginSubagentCleanup(runId: string) {
  const entry = subagentRuns.get(runId);
  if (!entry) {
    return false;
  }
  if (entry.cleanupCompletedAt) {
    return false;
  }
  if (entry.cleanupHandled) {
    return false;
  }
  entry.cleanupHandled = true;
  persistSubagentRuns();
  return true;
}

export function registerSubagentRun(params: {
  runId: string;
  childSessionKey: string;
  requesterSessionKey: string;
  requesterOrigin?: DeliveryContext;
  requesterDisplayKey: string;
  task: string;
  cleanup: "delete" | "keep";
  label?: string;
  runTimeoutSeconds?: number;
}) {
  const now = Date.now();
  const cfg = loadConfig();
  const archiveAfterMs = resolveArchiveAfterMs(cfg);
  const archiveAtMs = archiveAfterMs ? now + archiveAfterMs : undefined;
  const waitTimeoutMs = resolveSubagentWaitTimeoutMs(cfg, params.runTimeoutSeconds);
  const requesterOrigin = normalizeDeliveryContext(params.requesterOrigin);
  const record: SubagentRunRecord = {
    runId: params.runId,
    childSessionKey: params.childSessionKey,
    requesterSessionKey: params.requesterSessionKey,
    requesterOrigin,
    requesterDisplayKey: params.requesterDisplayKey,
    task: params.task,
    cleanup: params.cleanup,
    label: params.label,
    createdAt: now,
    startedAt: now,
    archiveAtMs,
    cleanupHandled: false,
  };
  subagentRuns.set(params.runId, record);
  ensureListener();
  persistSubagentRuns();
  storeSync(params.runId, record);
  if (archiveAfterMs) {
    startSweeper();
  }
  // Wait for subagent completion via gateway RPC (cross-process).
  // The in-process lifecycle listener is a fallback for embedded runs.
  void waitForSubagentCompletion(params.runId, waitTimeoutMs);
}

async function waitForSubagentCompletion(runId: string, waitTimeoutMs: number) {
  try {
    const timeoutMs = Math.max(1, Math.floor(waitTimeoutMs));
    const wait = await callGateway<{
      status?: string;
      startedAt?: number;
      endedAt?: number;
      error?: string;
    }>({
      method: "agent.wait",
      params: {
        runId,
        timeoutMs,
      },
      timeoutMs: timeoutMs + 10_000,
    });
    if (wait?.status !== "ok" && wait?.status !== "error" && wait?.status !== "timeout") {
      return;
    }
    const entry = subagentRuns.get(runId);
    if (!entry) {
      return;
    }
    let mutated = false;
    if (typeof wait.startedAt === "number") {
      entry.startedAt = wait.startedAt;
      mutated = true;
    }
    if (typeof wait.endedAt === "number") {
      entry.endedAt = wait.endedAt;
      mutated = true;
    }
    if (!entry.endedAt) {
      entry.endedAt = Date.now();
      mutated = true;
    }
    const waitError = typeof wait.error === "string" ? wait.error : undefined;
    entry.outcome =
      wait.status === "error"
        ? { status: "error", error: waitError }
        : wait.status === "timeout"
          ? { status: "timeout" }
          : { status: "ok" };
    mutated = true;
    if (mutated) {
      persistSubagentRuns();
    }
    void startSubagentAnnounceCleanupFlow(runId, entry);
  } catch {
    // ignore
  }
}

export function resetSubagentRegistryForTests(opts?: { persist?: boolean }) {
  subagentRuns.clear();
  resumedRuns.clear();
  remoteMergedRunIds.clear();
  storeSyncSeq.clear();
  resetAnnounceQueuesForTests();
  stopSweeper();
  restoreAttempted = false;
  if (listenerStop) {
    listenerStop();
    listenerStop = null;
  }
  listenerStarted = false;
  if (opts?.persist !== false) {
    persistSubagentRuns();
  }
}

export function addSubagentRunForTests(entry: SubagentRunRecord) {
  subagentRuns.set(entry.runId, entry);
  persistSubagentRuns();
}

export function releaseSubagentRun(runId: string) {
  const didDelete = subagentRuns.delete(runId);
  if (didDelete) {
    persistSubagentRuns();
    storeSync(runId, null);
  }
  if (subagentRuns.size === 0) {
    stopSweeper();
  }
}

export function listSubagentRunsForRequester(requesterSessionKey: string): SubagentRunRecord[] {
  const key = requesterSessionKey.trim();
  if (!key) {
    return [];
  }
  // Local cache first
  const local = [...subagentRuns.values()].filter((entry) => entry.requesterSessionKey === key);

  // Async merge from StateStore for cross-instance runs (non-blocking enhancement).
  // To keep the synchronous API, we kick off a background merge that will be
  // reflected on the next call. For immediate cross-instance needs, callers
  // should use listSubagentRunsForRequesterAsync().
  void mergeRemoteRuns();

  return local;
}

/** Async version that includes cross-instance runs from StateStore. */
export async function listSubagentRunsForRequesterAsync(
  requesterSessionKey: string,
): Promise<SubagentRunRecord[]> {
  const key = requesterSessionKey.trim();
  if (!key) {
    return [];
  }
  await mergeRemoteRuns();
  return [...subagentRuns.values()].filter((entry) => entry.requesterSessionKey === key);
}

async function mergeRemoteRuns(): Promise<void> {
  const store = getStateStoreOrNull();
  if (!store) return;

  try {
    const remoteRuns = await storeGetAll();

    // Add new remote entries
    for (const [runId, record] of remoteRuns) {
      if (!subagentRuns.has(runId)) {
        subagentRuns.set(runId, record);
        remoteMergedRunIds.add(runId);
      }
    }

    // Prune stale remote-merged entries: if a run was previously added via
    // remote merge and no longer exists in StateStore, remove it from local Map.
    // Only prune entries that we KNOW came from remote (tracked in remoteMergedRunIds).
    // Locally-registered runs are authoritative — their lifecycle is managed
    // by registerSubagentRun/releaseSubagentRun.
    for (const runId of remoteMergedRunIds) {
      if (!remoteRuns.has(runId)) {
        subagentRuns.delete(runId);
        remoteMergedRunIds.delete(runId);
      }
    }
  } catch {
    // ignore
  }
}

export function initSubagentRegistry() {
  restoreSubagentRunsOnce();
}
