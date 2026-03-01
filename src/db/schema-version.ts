/**
 * SQLite PRAGMA user_version wrapper for database schema versioning.
 *
 * Every SQLite database has a built-in integer `user_version` field (default 0).
 * We use it to track which migration version has been applied, enabling
 * cross-version upgrades to skip already-applied migrations.
 */

import type { DatabaseSync } from "node:sqlite";

/**
 * Read the current schema version from a SQLite database.
 * Returns 0 for databases that have never been versioned.
 */
export function getSchemaVersion(db: DatabaseSync): number {
  const row = db.prepare("PRAGMA user_version").get() as { user_version: number } | undefined;
  return row?.user_version ?? 0;
}

/**
 * Set the schema version on a SQLite database.
 * Must be called outside a transaction (PRAGMA cannot be run inside BEGIN/COMMIT).
 */
export function setSchemaVersion(db: DatabaseSync, version: number): void {
  if (!Number.isInteger(version) || version < 0) {
    throw new RangeError(`Invalid schema version: ${version}`);
  }
  // PRAGMA doesn't support parameterized values; version is validated as integer above.
  db.exec(`PRAGMA user_version = ${version}`);
}
