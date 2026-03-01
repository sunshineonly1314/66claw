/**
 * Doctor check: upgrade stability.
 *
 * Reads the upgrade watchdog state and reports:
 * - pass: upgrade confirmed stable (or no recent upgrade)
 * - info: crashCount > 0 but below threshold
 * - warn: crashCount >= CRASH_THRESHOLD — suggests manual rollback
 */

import { note } from "../terminal/note.js";
import { readWatchdogState, CRASH_THRESHOLD } from "../infra/upgrade-watchdog.js";

export async function noteUpgradeStability(): Promise<void> {
  const state = readWatchdogState();
  if (!state) {
    // No watchdog file — no recent upgrade tracked
    return;
  }

  if (state.confirmedStable) {
    return;
  }

  if (state.crashCount >= CRASH_THRESHOLD) {
    note(
      `Upgrade to v${state.version} is unstable (${state.crashCount} crashes since ${state.upgradedAt}).\n` +
        `Last crash: ${state.lastCrashAt ?? "unknown"}\n\n` +
        `Consider rolling back:\n` +
        `  - Git install: git checkout <previous-tag>\n` +
        `  - npm install: npm install -g openclawcn@<previous-version>\n` +
        `  - Installer: reinstall the previous version from the download page\n\n` +
        `Config and DB snapshots are available in:\n` +
        `  ~/.openclawcn/upgrade-snapshots/`,
      "Upgrade Stability Warning",
    );
    return;
  }

  if (state.crashCount > 0) {
    note(
      `Upgrade to v${state.version}: ${state.crashCount} crash(es) detected (threshold: ${CRASH_THRESHOLD}).\n` +
        `Monitoring for stability...`,
      "Upgrade Stability",
    );
  }
}
