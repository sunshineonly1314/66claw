/**
 * Database snapshot — saves a copy of a SQLite database file before upgrades.
 *
 * Performs a WAL checkpoint before copying to ensure all data is flushed
 * from the write-ahead log to the main database file.
 */

import fs from "node:fs";
import path from "node:path";
import { STATE_DIR } from "../config/paths.js";

const SNAPSHOT_DIR_NAME = "upgrade-snapshots";
const MAX_DB_SNAPSHOTS = 5;

function resolveSnapshotDir(stateDir: string = STATE_DIR): string {
  return path.join(stateDir, SNAPSHOT_DIR_NAME);
}

/**
 * Clean up old DB snapshots by label prefix, keeping only the most recent `maxKeep`.
 */
function pruneDbSnapshots(dir: string, label: string, maxKeep: number): void {
  try {
    const prefix = `${label}-v`;
    const entries = fs.readdirSync(dir).filter((f) => f.startsWith(prefix));
    if (entries.length <= maxKeep) {
      return;
    }
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
    // ignore
  }
}

/**
 * Save a snapshot of a SQLite database file before an upgrade.
 *
 * @param opts.dbPath - Path to the SQLite database file.
 * @param opts.label - Label for the snapshot (e.g. "memory", "mcp-marketplace").
 * @param opts.version - Version string to include in the snapshot filename.
 * @param opts.stateDir - State directory override (defaults to STATE_DIR).
 * @returns The snapshot file path if saved, or null if skipped/failed.
 */
export async function saveDbSnapshot(opts: {
  dbPath: string;
  label: string;
  version: string;
  stateDir?: string;
}): Promise<string | null> {
  const { dbPath, label, version } = opts;
  const stateDir = opts.stateDir ?? STATE_DIR;

  if (!fs.existsSync(dbPath)) {
    return null;
  }

  const snapshotDir = resolveSnapshotDir(stateDir);
  try {
    fs.mkdirSync(snapshotDir, { recursive: true });
  } catch {
    return null;
  }

  // WAL checkpoint: flush WAL data to main DB before copying.
  // Open a temporary connection for the checkpoint only.
  try {
    const { requireNodeSqlite } = await import("../memory/sqlite.js");
    const sqlite = requireNodeSqlite();
    const db = new sqlite.DatabaseSync(dbPath);
    try {
      db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    } finally {
      try {
        db.close();
      } catch {
        // ignore
      }
    }
  } catch {
    // WAL checkpoint failed — proceed with copy anyway.
    // The main DB file likely still has most data.
  }

  const sanitizedVersion = version.replace(/[^a-zA-Z0-9._-]/g, "_");
  const snapshotName = `${label}-v${sanitizedVersion}.sqlite`;
  const snapshotPath = path.join(snapshotDir, snapshotName);

  try {
    await fs.promises.copyFile(dbPath, snapshotPath);
    pruneDbSnapshots(snapshotDir, label, MAX_DB_SNAPSHOTS);
    return snapshotPath;
  } catch {
    return null;
  }
}
