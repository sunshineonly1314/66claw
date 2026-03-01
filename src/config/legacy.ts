import type { LegacyConfigIssue } from "./types.js";
import { LEGACY_CONFIG_MIGRATIONS } from "./legacy.migrations.js";
import { LEGACY_CONFIG_RULES } from "./legacy.rules.js";
import { isRecord } from "./legacy.shared.js";

/**
 * Current config schema version.  Bump this whenever new migration rules are
 * added (and tag the new rules with the incremented value via `since`).
 */
export const CURRENT_SCHEMA_VERSION = 1;

export function findLegacyConfigIssues(raw: unknown): LegacyConfigIssue[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }
  const root = raw as Record<string, unknown>;
  const issues: LegacyConfigIssue[] = [];
  for (const rule of LEGACY_CONFIG_RULES) {
    let cursor: unknown = root;
    for (const key of rule.path) {
      if (!cursor || typeof cursor !== "object") {
        cursor = undefined;
        break;
      }
      cursor = (cursor as Record<string, unknown>)[key];
    }
    if (cursor !== undefined && (!rule.match || rule.match(cursor, root))) {
      issues.push({ path: rule.path.join("."), message: rule.message });
    }
  }
  return issues;
}

export function applyLegacyMigrations(raw: unknown): {
  next: Record<string, unknown> | null;
  changes: string[];
} {
  if (!raw || typeof raw !== "object") {
    return { next: null, changes: [] };
  }
  const next = structuredClone(raw) as Record<string, unknown>;
  const changes: string[] = [];

  // Read current schema version (0 = never migrated / pre-versioning config)
  const meta = isRecord(next.meta) ? next.meta : null;
  const currentSchema =
    typeof meta?.schemaVersion === "number" && Number.isFinite(meta.schemaVersion)
      ? Math.floor(meta.schemaVersion)
      : 0;

  for (const migration of LEGACY_CONFIG_MIGRATIONS) {
    // Fast path: skip migrations already applied in a previous schema version.
    // The per-rule idempotency check ("source field exists") remains as safety fallback.
    if (currentSchema >= migration.since) {
      continue;
    }
    migration.apply(next, changes);
  }

  // Stamp schema version so subsequent loads skip all current rules.
  if (changes.length > 0 || currentSchema < CURRENT_SCHEMA_VERSION) {
    const metaObj = isRecord(next.meta) ? next.meta : {};
    metaObj.schemaVersion = CURRENT_SCHEMA_VERSION;
    next.meta = metaObj;
    if (currentSchema < CURRENT_SCHEMA_VERSION && changes.length === 0) {
      // Schema version advanced but no actual migrations ran (all idempotent skips).
      // Still mark as changed so the version stamp gets persisted.
      changes.push(`Schema version updated to ${CURRENT_SCHEMA_VERSION}.`);
    }
  }

  if (changes.length === 0) {
    return { next: null, changes: [] };
  }
  return { next, changes };
}
