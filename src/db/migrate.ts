/**
 * Generic SQLite database migration executor.
 *
 * Applies an ordered list of migrations, skipping those already applied
 * (determined by PRAGMA user_version).  Each migration runs inside a
 * transaction by default; migrations that cannot be transactional (e.g.
 * FTS5 CREATE VIRTUAL TABLE) should set `noTransaction: true`.
 */

import type { DatabaseSync } from "node:sqlite";
import { getSchemaVersion, setSchemaVersion } from "./schema-version.js";

export type DbMigration = {
  /** Target version after this migration completes. Must be > 0 and unique. */
  version: number;
  /** Human-readable label for logging. */
  label: string;
  /** The migration logic. Receives the open database handle. */
  up: (db: DatabaseSync) => void;
  /**
   * When true the migration is NOT wrapped in BEGIN/COMMIT.
   * Required for FTS5 CREATE VIRTUAL TABLE which cannot run inside a transaction.
   */
  noTransaction?: boolean;
};

export type MigrationResult = {
  /** Version numbers that were applied in this run. */
  applied: number[];
  /** The database's user_version after all migrations. */
  currentVersion: number;
};

/**
 * Run pending database migrations.
 *
 * Migrations are sorted by `version` and executed in ascending order.
 * Only migrations with `version > currentUserVersion` are applied.
 * After each successful migration the user_version is advanced.
 *
 * @returns The list of applied version numbers and the final version.
 */
export function runDbMigrations(db: DatabaseSync, migrations: DbMigration[]): MigrationResult {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  const current = getSchemaVersion(db);
  const applied: number[] = [];

  for (const migration of sorted) {
    if (migration.version <= current) {
      continue;
    }

    if (migration.noTransaction) {
      // FTS5 virtual tables cannot be created inside a transaction.
      try {
        migration.up(db);
      } catch {
        // Non-transactional migration failed (e.g. FTS5 unavailable).
        // Skip this version but still advance user_version so we don't
        // retry on every startup.  The caller should handle degradation
        // (e.g. fall back to LIKE search).
      }
      setSchemaVersion(db, migration.version);
      applied.push(migration.version);
    } else {
      db.exec("BEGIN");
      try {
        migration.up(db);
        db.exec("COMMIT");
        setSchemaVersion(db, migration.version);
        applied.push(migration.version);
      } catch (err) {
        try {
          db.exec("ROLLBACK");
        } catch {
          // ROLLBACK may fail if no transaction is active; ignore.
        }
        throw new Error(
          `DB migration v${migration.version} (${migration.label}) failed: ${String(err)}`,
          { cause: err },
        );
      }
    }
  }

  return {
    applied,
    currentVersion: applied.length > 0 ? getSchemaVersion(db) : current,
  };
}
