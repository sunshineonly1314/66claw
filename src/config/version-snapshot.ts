/**
 * Config version snapshot — saves a copy of the config file before major/minor upgrades.
 *
 * Only triggers on major or minor version changes (patch upgrades are not snapshotted).
 * Snapshots are stored in `{stateDir}/upgrade-snapshots/` with automatic cleanup
 * of old snapshots (max 5 retained).
 */

import fs from "node:fs";
import path from "node:path";
import { parseOpenClawCNVersion } from "./version.js";
import { STATE_DIR } from "./paths.js";

const SNAPSHOT_DIR_NAME = "upgrade-snapshots";
const MAX_SNAPSHOTS = 5;

function resolveSnapshotDir(stateDir: string = STATE_DIR): string {
  return path.join(stateDir, SNAPSHOT_DIR_NAME);
}

/**
 * Determine whether a version change is significant enough to warrant a snapshot.
 * Returns true for major or minor version bumps; false for patch-only changes.
 */
function isSignificantVersionChange(before: string, after: string): boolean {
  const parsedBefore = parseOpenClawCNVersion(before);
  const parsedAfter = parseOpenClawCNVersion(after);
  if (!parsedBefore || !parsedAfter) {
    // Can't parse — snapshot as a precaution
    return true;
  }
  return parsedBefore.major !== parsedAfter.major || parsedBefore.minor !== parsedAfter.minor;
}

/**
 * Clean up old snapshot files, keeping only the most recent `maxKeep`.
 */
function pruneSnapshots(dir: string, prefix: string, maxKeep: number): void {
  try {
    const entries = fs.readdirSync(dir).filter((f) => f.startsWith(prefix));
    if (entries.length <= maxKeep) {
      return;
    }
    // Sort by mtime ascending (oldest first)
    const withMtime = entries.map((name) => {
      const fullPath = path.join(dir, name);
      try {
        return { name, mtime: fs.statSync(fullPath).mtimeMs };
      } catch {
        return { name, mtime: 0 };
      }
    });
    withMtime.sort((a, b) => a.mtime - b.mtime);
    const toDelete = withMtime.slice(0, withMtime.length - maxKeep);
    for (const entry of toDelete) {
      try {
        fs.unlinkSync(path.join(dir, entry.name));
      } catch {
        // best-effort
      }
    }
  } catch {
    // Directory may not exist yet — ignore
  }
}

/**
 * Save a snapshot of the config file before an upgrade.
 *
 * @returns The snapshot file path if saved, or null if skipped.
 */
export async function saveConfigVersionSnapshot(opts: {
  configPath: string;
  beforeVersion: string;
  afterVersion: string;
  stateDir?: string;
}): Promise<string | null> {
  const { configPath, beforeVersion, afterVersion } = opts;
  const stateDir = opts.stateDir ?? STATE_DIR;

  // Skip patch-only upgrades
  if (!isSignificantVersionChange(beforeVersion, afterVersion)) {
    return null;
  }

  // Skip if config file doesn't exist
  if (!fs.existsSync(configPath)) {
    return null;
  }

  const snapshotDir = resolveSnapshotDir(stateDir);
  try {
    fs.mkdirSync(snapshotDir, { recursive: true });
  } catch {
    return null;
  }

  const sanitizedVersion = beforeVersion.replace(/[^a-zA-Z0-9._-]/g, "_");
  const snapshotName = `config-v${sanitizedVersion}.json`;
  const snapshotPath = path.join(snapshotDir, snapshotName);

  try {
    await fs.promises.copyFile(configPath, snapshotPath);
    pruneSnapshots(snapshotDir, "config-v", MAX_SNAPSHOTS);
    return snapshotPath;
  } catch {
    return null;
  }
}
