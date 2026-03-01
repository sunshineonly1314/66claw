/**
 * Upgrade watchdog — tracks crash counts after an upgrade to detect instability.
 *
 * Pattern: JSON file at {stateDir}/upgrade-watchdog.json
 * - recordUpgradeStart: called after a successful upgrade
 * - recordUpgradeCrash: called on process abnormal exit
 * - confirmUpgradeStable: called after 5 minutes of continuous uptime
 * - readWatchdogState: read current state for doctor checks
 *
 * The watchdog does NOT perform automatic code rollback.
 * It only detects, counts, and alerts — providing manual rollback instructions.
 */

import fs from "node:fs";
import path from "node:path";
import { STATE_DIR } from "../config/paths.js";

const WATCHDOG_FILENAME = "upgrade-watchdog.json";

/** Threshold: if crashCount reaches this, doctor issues a warning. */
export const CRASH_THRESHOLD = 3;

/** Stability window: must run continuously for this many ms to be confirmed stable. */
export const STABILITY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export interface UpgradeWatchdogState {
  version: string;
  upgradedAt: string;
  crashCount: number;
  lastCrashAt?: string;
  confirmedStable: boolean;
  confirmedAt?: string;
}

function resolveWatchdogPath(stateDir: string = STATE_DIR): string {
  return path.join(stateDir, WATCHDOG_FILENAME);
}

function readStateSync(stateDir: string = STATE_DIR): UpgradeWatchdogState | null {
  const filePath = resolveWatchdogPath(stateDir);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as UpgradeWatchdogState;
    if (!parsed || typeof parsed.version !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStateSync(state: UpgradeWatchdogState, stateDir: string = STATE_DIR): void {
  const filePath = resolveWatchdogPath(stateDir);
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  } catch {
    // ignore
  }
  fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

/**
 * Record that an upgrade has completed to a new version.
 * Resets the crash counter for the new version.
 */
export function recordUpgradeStart(version: string, stateDir: string = STATE_DIR): void {
  const existing = readStateSync(stateDir);
  // If already tracking the same version and confirmed stable, don't reset
  if (existing?.version === version && existing.confirmedStable) {
    return;
  }
  writeStateSync(
    {
      version,
      upgradedAt: new Date().toISOString(),
      crashCount: 0,
      confirmedStable: false,
    },
    stateDir,
  );
}

/**
 * Record a crash event for the current tracked version.
 * Only increments if the current VERSION matches the tracked version
 * and the upgrade has not yet been confirmed stable.
 */
export function recordUpgradeCrash(currentVersion: string, stateDir: string = STATE_DIR): void {
  const state = readStateSync(stateDir);
  if (!state) {
    return;
  }
  // Only count crashes for the version being tracked
  if (state.version !== currentVersion) {
    return;
  }
  // Don't count crashes after stability is confirmed
  if (state.confirmedStable) {
    return;
  }
  state.crashCount += 1;
  state.lastCrashAt = new Date().toISOString();
  writeStateSync(state, stateDir);
}

/**
 * Mark the current upgrade as stable (called after STABILITY_WINDOW_MS of uptime).
 */
export function confirmUpgradeStable(currentVersion: string, stateDir: string = STATE_DIR): void {
  const state = readStateSync(stateDir);
  if (!state) {
    return;
  }
  if (state.version !== currentVersion) {
    return;
  }
  if (state.confirmedStable) {
    return;
  }
  state.confirmedStable = true;
  state.confirmedAt = new Date().toISOString();
  writeStateSync(state, stateDir);
}

/**
 * Read the current watchdog state (used by doctor check).
 */
export function readWatchdogState(stateDir: string = STATE_DIR): UpgradeWatchdogState | null {
  return readStateSync(stateDir);
}

/**
 * Schedule automatic stability confirmation after STABILITY_WINDOW_MS of uptime.
 * Should be called once at gateway startup.
 */
export function scheduleStabilityCheck(currentVersion: string, stateDir: string = STATE_DIR): void {
  const state = readStateSync(stateDir);
  if (!state || state.version !== currentVersion || state.confirmedStable) {
    return;
  }
  setTimeout(() => {
    confirmUpgradeStable(currentVersion, stateDir);
  }, STABILITY_WINDOW_MS).unref();
}
