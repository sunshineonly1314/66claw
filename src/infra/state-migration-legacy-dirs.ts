/**
 * [CN-PATCH:legacy-dir-migration] Automatic cross-platform migration from
 * legacy state dirs (.clawdbotcn, .clawdbot, .moldbot, .moltbot) into
 * the current .openclawcn directory.
 *
 * Unlike the portable migration (state-migration-portable.ts) which only
 * handles Windows cross-drive scenarios, this module handles the general
 * upgrade case on all platforms — including same-drive upgrades on Windows
 * and macOS/Linux users upgrading from old versions.
 *
 * Two-step migration strategy:
 *   Step 1 (this module): Directory-level data migration (runs BEFORE config load)
 *     - Workspace memory merge (profile.json smart merge + MEMORY.md append)
 *     - Config file merge (JSON deep merge)
 *     - Credentials, master key, identity copy
 *     - memory/, extensions/, pairing/, media/ etc. directory copy
 *
 *   Step 2 (autoMigrateLegacyState in state-migrations.ts): Agent-level migration
 *     - Sessions key canonicalization (runs AFTER config load, needs agentId)
 *     - agent/ → agents/{id}/agent/ directory migration
 *     - WhatsApp auth file migration
 *
 * This function is called from server.impl.ts at startup, after the portable
 * migration and before config is loaded. Safe to call on every startup —
 * internally idempotent via migrated-to.json markers.
 */

import fs from "node:fs";
import path from "node:path";
import { resolveEffectiveHomeDir } from "./home-dir.js";
import { mergeLegacyIntoTarget } from "./state-migrations.js";
import { ensureDir, existsDir, fileExists, safeReadDir } from "./state-migrations.fs.js";

// ── Constants ────────────────────────────────────────────────────────

/** Legacy state dir names, ordered by recency (newest first). */
const LEGACY_DIRNAMES = [".clawdbotcn", ".clawdbot", ".moldbot", ".moltbot"] as const;

const TARGET_DIRNAME = ".openclawcn";

const MIGRATED_TO_FILENAME = "migrated-to.json";

/**
 * Additional directories to copy that mergeLegacyIntoTarget does NOT handle.
 * These are copied as whole directories with no-overwrite semantics.
 */
const EXTRA_COPY_DIRS = [
  "memory",
  "agents",
  "sessions",
  "agent",
  "extensions",
  "pairing",
  "media",
  "voice-models",
  "telegram",
  "hooks",
  "sandbox",
  "sandboxes",
  "subagents",
  "settings",
  "browser",
  "qrcodes",
  "data",
  "delivery-queue",
] as const;

// ── Types ────────────────────────────────────────────────────────────

export type LegacyDirMigrationResult = {
  migrated: boolean;
  skipped: boolean;
  changes: string[];
  warnings: string[];
};

// ── Module state (idempotency) ───────────────────────────────────────

let _checked = false;

/** Reset the check flag (for testing). */
export function _resetLegacyDirsMigrationCheck(): void {
  _checked = false;
}

// ── Main entry point ─────────────────────────────────────────────────

/**
 * Auto-migrate data from legacy state dirs into .openclawcn.
 *
 * Called once during gateway startup, after portable migration,
 * before config is read. Cross-platform, idempotent.
 */
export function autoMigrateLegacyDirs(params?: {
  env?: NodeJS.ProcessEnv;
}): LegacyDirMigrationResult {
  if (_checked) {
    return { migrated: false, skipped: true, changes: [], warnings: [] };
  }
  _checked = true;

  const result: LegacyDirMigrationResult = {
    migrated: false,
    skipped: false,
    changes: [],
    warnings: [],
  };

  const env = params?.env ?? process.env;

  // If user explicitly set OPENCLAWCN_STATE_DIR, they control the state dir — skip.
  if (env.OPENCLAWCN_STATE_DIR?.trim() || env.CLAWDBOT_STATE_DIR?.trim()) {
    result.skipped = true;
    return result;
  }

  // Resolve home directory
  const homeDir = resolveEffectiveHomeDir(env);
  if (!homeDir) {
    result.skipped = true;
    result.warnings.push("Could not resolve home directory for legacy dir migration");
    return result;
  }

  const targetDir = path.join(homeDir, TARGET_DIRNAME);

  // Find all existing legacy dirs
  const legacyDirs = findLegacyDirs(homeDir, targetDir);
  if (legacyDirs.length === 0) {
    result.skipped = true;
    return result;
  }

  try {
    ensureDir(targetDir);

    for (const legacyDir of legacyDirs) {
      const dirName = path.basename(legacyDir);

      // Check migration marker
      if (isAlreadyMigrated(legacyDir, targetDir)) {
        result.changes.push(`skipped already-migrated ${dirName}`);
        continue;
      }

      result.changes.push(`migrating from ${dirName}...`);

      // Step 1: Use existing mergeLegacyIntoTarget for workspace memory,
      // config, credentials, identity, .master-key, etc.
      try {
        const mergeResult = mergeLegacyIntoTarget(legacyDir, targetDir);
        result.changes.push(...mergeResult.changes.map((c) => `${dirName}: ${c}`));
        result.warnings.push(...mergeResult.warnings.map((w) => `${dirName}: ${w}`));
      } catch (err) {
        result.warnings.push(`${dirName}: mergeLegacyIntoTarget failed: ${String(err)}`);
      }

      // Step 2: Copy additional directories that mergeLegacyIntoTarget doesn't handle
      for (const rel of EXTRA_COPY_DIRS) {
        const srcDir = path.join(legacyDir, rel);
        const dstDir = path.join(targetDir, rel);
        if (existsDir(srcDir)) {
          try {
            copyDirNoOverwrite(srcDir, dstDir);
            result.changes.push(`${dirName}: copied ${rel}/`);
          } catch (err) {
            result.warnings.push(`${dirName}: failed to copy ${rel}/: ${String(err)}`);
          }
        }
      }

      // Step 3: Copy any remaining loose files (no-overwrite)
      for (const rel of [
        ".device_id",
        "license_cache.json",
        "exec-approvals.json",
        "skills-install-state.json",
        "shown_notifications.json",
      ]) {
        const src = path.join(legacyDir, rel);
        const dst = path.join(targetDir, rel);
        if (fileExists(src) && !fileExists(dst)) {
          try {
            fs.copyFileSync(src, dst);
            result.changes.push(`${dirName}: copied ${rel}`);
          } catch {
            /* ignore */
          }
        }
      }

      // Write migration marker
      writeMigrationMarker(legacyDir, targetDir, result);

      // Replace legacy dir with symlink to target (prevents future re-migration
      // and ensures any code still looking at the old path finds the new data)
      replaceWithSymlink(legacyDir, targetDir, dirName, result);
    }

    result.migrated = result.changes.some(
      (c) => c.includes("copied ") || c.includes("merged ") || c.includes("symlink"),
    );
  } catch (err) {
    result.warnings.push(`Legacy dir migration failed: ${String(err)}`);
  }

  return result;
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Find all non-empty legacy dirs in home that are not symlinks to target.
 */
function findLegacyDirs(homeDir: string, targetDir: string): string[] {
  const resolvedTarget = safePath(targetDir);
  const found: string[] = [];

  for (const name of LEGACY_DIRNAMES) {
    const dir = path.join(homeDir, name);
    try {
      const stat = fs.lstatSync(dir);
      if (!stat.isDirectory() && !stat.isSymbolicLink()) continue;

      // Skip symlinks that point to the target dir
      if (stat.isSymbolicLink()) {
        const linkTarget = safeReadlink(dir);
        if (linkTarget && safePath(linkTarget) === resolvedTarget) continue;
      }

      // Skip if realpath resolves to target (junction on Windows)
      const realDir = safePath(dir);
      if (realDir === resolvedTarget) continue;

      // Skip empty dirs
      const entries = safeReadDir(dir);
      if (entries.length === 0) continue;

      // Skip dirs that only contain migration markers
      const hasRealContent = entries.some(
        (e) => e.name !== MIGRATED_TO_FILENAME && e.name !== "migrated-from.json",
      );
      if (!hasRealContent) continue;

      found.push(dir);
    } catch {
      // Dir doesn't exist or not accessible — skip
    }
  }

  return found;
}

/**
 * Check if a legacy dir was already migrated to the target.
 */
function isAlreadyMigrated(legacyDir: string, targetDir: string): boolean {
  const markerPath = path.join(legacyDir, MIGRATED_TO_FILENAME);
  try {
    if (!fs.existsSync(markerPath)) return false;
    const raw = fs.readFileSync(markerPath, "utf-8");
    const parsed = JSON.parse(raw);
    // Check if the marker points to our target
    if (parsed?.target) {
      return safePath(parsed.target) === safePath(targetDir);
    }
    // Also check portable migration marker format
    if (parsed?.targetDir) {
      return safePath(parsed.targetDir) === safePath(targetDir);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Write a migration marker in the legacy dir so we don't re-migrate.
 */
function writeMigrationMarker(
  legacyDir: string,
  targetDir: string,
  result: LegacyDirMigrationResult,
): void {
  const markerPath = path.join(legacyDir, MIGRATED_TO_FILENAME);
  try {
    const marker = {
      target: targetDir,
      migratedAt: new Date().toISOString(),
      from: path.basename(legacyDir),
    };
    const tmpPath = markerPath + `.tmp.${process.pid}`;
    fs.writeFileSync(tmpPath, JSON.stringify(marker, null, 2), "utf-8");
    fs.renameSync(tmpPath, markerPath);
  } catch (err) {
    result.warnings.push(
      `Could not write migration marker in ${path.basename(legacyDir)}: ${String(err)}`,
    );
  }
}

/**
 * Replace legacy dir with a symlink to the target dir.
 */
function replaceWithSymlink(
  legacyDir: string,
  targetDir: string,
  dirName: string,
  result: LegacyDirMigrationResult,
): void {
  const backupDir = legacyDir + ".pre-merge.bak";
  try {
    // Rename legacy dir to backup
    fs.renameSync(legacyDir, backupDir);
    try {
      // Create symlink (or junction on Windows)
      fs.symlinkSync(targetDir, legacyDir, "dir");
      result.changes.push(`${dirName}: symlink ${dirName} → ${TARGET_DIRNAME}`);
    } catch {
      // Symlink failed — try junction on Windows
      try {
        if (process.platform === "win32") {
          fs.symlinkSync(targetDir, legacyDir, "junction");
          result.changes.push(`${dirName}: junction ${dirName} → ${TARGET_DIRNAME}`);
        } else {
          throw new Error("symlink failed");
        }
      } catch {
        // All symlink attempts failed — restore backup
        try {
          fs.renameSync(backupDir, legacyDir);
        } catch {
          /* ignore */
        }
        result.warnings.push(
          `${dirName}: could not create symlink (data was still merged successfully)`,
        );
      }
    }
  } catch (err) {
    result.warnings.push(`${dirName}: could not replace with symlink: ${String(err)}`);
  }
}

/**
 * Recursively copy a directory with no-overwrite semantics.
 * Files that already exist at the destination are skipped.
 */
function copyDirNoOverwrite(srcDir: string, dstDir: string): void {
  ensureDir(dstDir);
  const entries = safeReadDir(srcDir);
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copyDirNoOverwrite(srcPath, dstPath);
    } else if (entry.isFile()) {
      if (!fileExists(dstPath)) {
        try {
          fs.copyFileSync(srcPath, dstPath);
        } catch {
          /* ignore individual file copy failures */
        }
      }
    } else if (entry.isSymbolicLink()) {
      // Preserve symlinks as-is (e.g., QMD model junctions)
      if (!fs.existsSync(dstPath)) {
        try {
          const linkTarget = fs.readlinkSync(srcPath);
          fs.symlinkSync(linkTarget, dstPath);
        } catch {
          /* ignore */
        }
      }
    }
  }
}

/** Resolve a path, swallowing errors. */
function safePath(p: string): string {
  try {
    return path.resolve(fs.realpathSync(p));
  } catch {
    return path.resolve(p);
  }
}

/** Read a symlink target, swallowing errors. */
function safeReadlink(p: string): string | null {
  try {
    return fs.readlinkSync(p);
  } catch {
    return null;
  }
}
