/**
 * [CN-PATCH:portable-migration] Migrate C:-drive data to portable install directory.
 *
 * When a Windows user upgrades from a C:-drive-based install to a portable
 * install (e.g. E:\openclawcn), this module detects old data in the user's
 * home directory and migrates it to the new portable data directory.
 *
 * Special care is taken with memory/profile data (P0 priority) — profile
 * entries are merged by (category, key) with score-based dedup so no user
 * memories are lost.
 *
 * Atomic-write safety: all file writes go through writeFileAtomic() which
 * writes to a .tmp file then renames, preventing corruption on crash/BSOD.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { safeRenameSync } from "./safe-rename.js";
import { resolvePortableDataDir } from "./home-dir.js";
import { ensureDir, existsDir, fileExists } from "./state-migrations.fs.js";

// ── Constants ────────────────────────────────────────────────────────

const MIGRATED_TO_FILENAME = "migrated-to.json";
const MIGRATED_FROM_FILENAME = "migrated-from.json";

const STATE_DIRNAMES = [".openclawcn", ".clawdbotcn", ".clawdbot", ".moldbot", ".moltbot"];

/**
 * Static data items to migrate, ordered by priority.
 * Workspace directories are discovered dynamically (see discoverWorkspaces).
 */
const STATIC_MIGRATE_ITEMS: MigrateItem[] = [
  // P0: Memory SQLite index — contains FTS5 full-text + vec0 vector embeddings.
  //     WAL/SHM companion files are handled by dir-copy-no-overwrite.
  //     These are technically rebuildable but rebuilding requires embedding API calls.
  { rel: "memory", type: "dir-copy-no-overwrite" },
  // P0: Credentials and keys
  { rel: "credentials", type: "dir-copy-no-overwrite" },
  { rel: ".master-key", type: "copy-no-overwrite" },
  { rel: "identity", type: "dir-copy-no-overwrite" },
  // P1: Config — canonical name first, then legacy filenames.
  //     Legacy files (clawdbotcn.json etc) may exist in old state dirs that were
  //     never fully migrated. They are merged into the target's canonical
  //     openclawcn.json so no user settings are lost (see migrateConfigMergeLegacy).
  { rel: "openclawcn.json", type: "config-merge" },
  { rel: "clawdbotcn.json", type: "config-merge-legacy" },
  { rel: "clawdbot.json", type: "config-merge-legacy" },
  { rel: "moldbot.json", type: "config-merge-legacy" },
  { rel: "moltbot.json", type: "config-merge-legacy" },
  // P1: Agent dirs — includes model config, sessions, QMD vector indexes.
  //     agents/{agentId}/qmd/xdg-cache/qmd/index.sqlite has vector embeddings.
  //     agents/{agentId}/sessions/*.jsonl are conversation transcripts.
  //     agents/{agentId}/qmd/xdg-cache/qmd/models/ may be a junction (handled by copySymlink).
  { rel: "agents", type: "dir-copy-no-overwrite" },
  // P1: Legacy sessions dir (pre-agent-migration format). The existing legacy
  //     migration (state-migrations.ts) operates on the CURRENT state dir only,
  //     so the C:-drive source may still have an unmigrated root sessions/ dir.
  { rel: "sessions", type: "dir-copy-no-overwrite" },
  // P1: Node host config (multi-node clustering)
  { rel: "node.json", type: "copy-no-overwrite" },
  // P1: User dotenv fallback
  { rel: ".env", type: "copy-no-overwrite" },
  // P2: Device identity
  { rel: ".device_id", type: "copy-no-overwrite" },
  { rel: "license_cache.json", type: "copy-no-overwrite" },
  { rel: "exec-approvals.json", type: "copy-no-overwrite" },
  { rel: "shown_notifications.json", type: "copy-no-overwrite" },
  { rel: "skills-install-state.json", type: "copy-no-overwrite" },
  // P2: Other data
  { rel: "pairing", type: "dir-copy-no-overwrite" },
  { rel: "extensions", type: "dir-copy-no-overwrite" },
  { rel: "media", type: "dir-copy-no-overwrite" },
  { rel: "voice-models", type: "dir-copy-no-overwrite" },
  { rel: "telegram", type: "dir-copy-no-overwrite" },
  { rel: "data", type: "dir-copy-no-overwrite" },
  { rel: "hooks", type: "dir-copy-no-overwrite" },
  { rel: "sandbox", type: "dir-copy-no-overwrite" },
  { rel: "sandboxes", type: "dir-copy-no-overwrite" },
  { rel: "subagents", type: "dir-copy-no-overwrite" },
  { rel: "settings", type: "dir-copy-no-overwrite" },
  { rel: "browser", type: "dir-copy-no-overwrite" },
  { rel: "qrcodes", type: "dir-copy-no-overwrite" },
  { rel: "delivery-queue", type: "dir-copy-no-overwrite" },
  // Note: logs/ and caches (tool-index.sqlite, *-cache.json, capability-cards-cache.json,
  // skills-index.json, mcp-index.json) are intentionally NOT migrated — they regenerate.
  // Ephemeral files (restart-sentinel.json, available-update.json, update-check.json)
  // are also skipped — they are process-lifetime state.
];

/**
 * Build the per-workspace migration items for a given workspace directory name.
 * Each workspace contains profile data, archives, conversation history, and
 * user-created memory markdown files.
 */
function buildWorkspaceMigrateItems(wsDir: string, sourceDir: string): MigrateItem[] {
  const items: MigrateItem[] = [];

  // P0: Profile JSON — smart merge to avoid losing any user memories
  items.push({ rel: `${wsDir}/memory/profile.json`, type: "profile-merge" });

  // P0: Profile archives (main + rotated 001-010)
  // [CN-PATCH:migration-p0] Changed from copy-no-overwrite to archive-append.
  // Old behavior silently discarded source archive when target had same-named file.
  items.push({ rel: `${wsDir}/memory/profile-archive.md`, type: "archive-append" });
  for (let i = 1; i <= 10; i++) {
    const num = String(i).padStart(3, "0");
    items.push({ rel: `${wsDir}/memory/profile-archive-${num}.md`, type: "archive-append" });
  }

  // P0: Eviction recovery safety net
  items.push({ rel: `${wsDir}/memory/.evicted-recovery.jsonl`, type: "copy-no-overwrite" });

  // P0: Conversation archives — raw transcripts before compaction, IRREPLACEABLE
  items.push({ rel: `${wsDir}/memory/conversations`, type: "dir-copy-no-overwrite" });

  // P0: Corrupt profile backups (may contain last-good profile data)
  discoverCorruptBackups(sourceDir, wsDir, items);

  // P1: User-created memory markdown files (indexed into SQLite FTS5 + vec)
  //     The entire memory/ tree is covered by the recursive copy, but profile.json
  //     was already handled above with smart merge.  All other files in memory/
  //     (including *.md, *.jsonl, subdirectories) are copied without overwrite.
  items.push({ rel: `${wsDir}/memory`, type: "dir-copy-no-overwrite" });

  // P1: Workspace-level memory files
  // [CN-PATCH:migration-p0] Changed from copy-no-overwrite to memory-md-append.
  // Old behavior discarded user-written MEMORY.md content when target already had one.
  items.push({ rel: `${wsDir}/MEMORY.md`, type: "memory-md-append" });
  items.push({ rel: `${wsDir}/memory.md`, type: "memory-md-append" });

  // P2: Workspace bootstrap files
  for (const name of [
    "AGENTS.md",
    "SOUL.md",
    "TOOLS.md",
    "IDENTITY.md",
    "USER.md",
    "HEARTBEAT.md",
    "BOOTSTRAP.md",
  ]) {
    items.push({ rel: `${wsDir}/${name}`, type: "copy-no-overwrite" });
  }

  // P2: Workspace state
  items.push({ rel: `${wsDir}/.openclawcn`, type: "dir-copy-no-overwrite" });

  return items;
}

/**
 * Discover all workspace directories in the source state dir.
 * Includes the default "workspace" and any "workspace-{agentId}" dirs.
 * Only includes "workspace" if it actually exists on disk (avoids generating
 * empty migration items for non-existent directories).
 */
function discoverWorkspaces(sourceDir: string): string[] {
  const workspaces: string[] = [];
  try {
    const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Match "workspace" or "workspace-*"
      if (entry.name === "workspace" || entry.name.startsWith("workspace-")) {
        workspaces.push(entry.name);
      }
    }
  } catch {
    /* ignore */
  }
  // Ensure default workspace is first if it exists
  const idx = workspaces.indexOf("workspace");
  if (idx > 0) {
    workspaces.splice(idx, 1);
    workspaces.unshift("workspace");
  }
  return workspaces;
}

/**
 * Discover profile.json.corrupt.{timestamp} backup files.
 * These may contain the last-good profile data after a corruption event.
 */
function discoverCorruptBackups(sourceDir: string, wsDir: string, items: MigrateItem[]): void {
  const memoryDir = path.join(sourceDir, wsDir, "memory");
  try {
    const entries = fs.readdirSync(memoryDir);
    for (const name of entries) {
      if (name.startsWith("profile.json.corrupt.")) {
        items.push({ rel: `${wsDir}/memory/${name}`, type: "copy-no-overwrite" });
      }
    }
  } catch {
    /* ignore — directory may not exist */
  }
}

type MigrateItem = {
  rel: string;
  type:
    | "copy-no-overwrite"
    | "dir-copy-no-overwrite"
    | "profile-merge"
    | "config-merge"
    | "config-merge-legacy"
    | "archive-append"
    | "memory-md-append";
};

// ── Profile types (inline to avoid circular deps with profile-store) ──

interface ProfileEntry {
  category: string;
  key: string;
  value: string;
  updatedAt: number;
  hits: number;
}

interface UserProfile {
  version: number;
  entries: ProfileEntry[];
}

// ── Score computation (inlined from profile-store.ts to avoid circular dep) ──

const CATEGORY_WEIGHTS: Record<string, number> = {
  identity: 1.0,
  correction: 0.95,
  procedure: 0.7,
  preference: 0.6,
  fact: 0.5,
  todo: 0.3,
};
const HITS_WEIGHT = 0.15;
const HITS_DIMINISHING = 0.7;
const RECENCY_HALF_LIFE_DAYS = 14;
const RECENCY_WEIGHT = 0.3;
const PROFILE_MAX_ENTRIES = 200;

function computeScore(entry: ProfileEntry, now: number): number {
  const categoryBase = CATEGORY_WEIGHTS[entry.category] ?? 0.5;
  const hitsContribution = HITS_WEIGHT * Math.pow(Math.max(entry.hits, 0), HITS_DIMINISHING);
  const ageDays = Math.max(0, (now - entry.updatedAt) / (1000 * 60 * 60 * 24));
  const recencyFactor = Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
  return categoryBase + hitsContribution + RECENCY_WEIGHT * recencyFactor;
}

// ── Atomic write helper ──────────────────────────────────────────────

/**
 * Write file atomically: write to a .tmp sibling, then rename.
 * On NTFS rename is atomic — prevents corruption on crash / BSOD / power loss.
 */
function writeFileAtomic(filePath: string, data: string): void {
  const tmpPath = filePath + `.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, data, "utf-8");
  safeRenameSync(tmpPath, filePath);
}

// ── Public API ───────────────────────────────────────────────────────

export type PortableMigrationResult = {
  migrated: boolean;
  skipped: boolean;
  sourceDir?: string;
  targetDir?: string;
  changes: string[];
  warnings: string[];
};

let _migrationChecked = false;

/**
 * Auto-migrate C:-drive state data to the portable install directory.
 *
 * Called once during gateway startup. Conditions:
 * 1. Must be Windows platform
 * 2. Must be in portable mode (resolvePortableDataDir() returns non-null)
 * 3. Old C:-drive data must exist
 * 4. Old data must not already have a `migrated-to.json` marker
 *
 * The migration is idempotent — interrupted migrations can be safely retried.
 *
 * Scans ALL known legacy state dir names (.openclawcn, .clawdbotcn, etc.)
 * and migrates each one that contains data, so split-state scenarios are handled.
 */
export function autoMigrateToPortable(params?: {
  env?: NodeJS.ProcessEnv;
}): PortableMigrationResult {
  if (_migrationChecked) {
    return { migrated: false, skipped: true, changes: [], warnings: [] };
  }
  _migrationChecked = true;

  const result: PortableMigrationResult = {
    migrated: false,
    skipped: false,
    changes: [],
    warnings: [],
  };

  if (process.platform !== "win32") {
    result.skipped = true;
    return result;
  }

  const portableDataDir = resolvePortableDataDir();
  if (!portableDataDir) {
    result.skipped = true;
    return result;
  }

  // Find old C:-drive state directory
  const env = params?.env ?? process.env;
  const userHome = resolveNativeHomedir(env);
  if (!userHome) {
    result.skipped = true;
    result.warnings.push("Could not resolve native home directory for migration check");
    return result;
  }

  // If the native home dir is on the same drive as portable dir, no migration needed
  const portableDrive = path.parse(path.resolve(portableDataDir)).root.toUpperCase();
  const homeDrive = path.parse(path.resolve(userHome)).root.toUpperCase();
  if (portableDrive === homeDrive) {
    result.skipped = true;
    return result;
  }

  const targetStateDir = path.join(portableDataDir, ".openclawcn");
  result.targetDir = targetStateDir;

  // [BUG-4 fix] Scan ALL non-empty old state dirs, not just the first.
  // Users may have data split across .openclawcn and .clawdbotcn if a
  // previous legacy migration was partial.
  const oldStateDirs = findAllOldStateDirs(userHome, targetStateDir);
  if (oldStateDirs.length === 0) {
    result.skipped = true;
    return result;
  }

  result.sourceDir = oldStateDirs[0]; // primary source for reporting

  try {
    ensureDir(targetStateDir);

    const migratedDirs: string[] = [];

    for (const oldStateDir of oldStateDirs) {
      // [BUG-5 fix] Check migration marker per-dir, not just the first
      if (isAlreadyMigrated(oldStateDir, targetStateDir)) {
        result.changes.push(`skipped already-migrated ${path.basename(oldStateDir)}`);
        continue;
      }
      const changesBefore = result.changes.length;
      runMigration(oldStateDir, targetStateDir, result);
      // Only count as "migrated" if runMigration produced actual file changes
      // (not just informational "migrating from ..." log messages).
      const actualFileChanges = result.changes
        .slice(changesBefore)
        .some(
          (c) =>
            c.startsWith("copied ") ||
            c.startsWith("merged ") ||
            c.startsWith("symlinked ") ||
            c.startsWith("replaced "),
        );
      if (actualFileChanges) {
        migratedDirs.push(oldStateDir);
      }
    }

    result.migrated = migratedDirs.length > 0;

    // [BUG-9 fix] Only write markers for dirs that had actual file changes
    for (const dir of migratedDirs) {
      writeMigrationMarker(dir, targetStateDir, result);
    }
  } catch (err) {
    result.warnings.push(`Migration failed: ${String(err)}`);
  }

  return result;
}

/** Reset the migration check flag (for testing). */
export function _resetMigrationCheck(): void {
  _migrationChecked = false;
}

// ── Internal ─────────────────────────────────────────────────────────

/**
 * Resolve the native Windows home dir (USERPROFILE / os.homedir),
 * ignoring OPENCLAWCN_HOME and portable mode overrides.
 * This is the "old" home where C:-drive data lives.
 */
function resolveNativeHomedir(env: NodeJS.ProcessEnv): string | undefined {
  const candidates = [env.USERPROFILE?.trim(), env.HOME?.trim()];
  for (const c of candidates) {
    if (c) return path.resolve(c);
  }
  try {
    const home = os.homedir();
    if (home) return path.resolve(home);
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * [BUG-4 fix] Find ALL non-empty old state directories in the user's home.
 * Returns every legacy dir name that has content, sorted by STATE_DIRNAMES priority.
 */
function findAllOldStateDirs(homeDir: string, targetStateDir: string): string[] {
  const found: string[] = [];
  const seenReal = new Set<string>();
  for (const dirName of STATE_DIRNAMES) {
    const dir = path.join(homeDir, dirName);
    // Skip if this IS the target (can happen if portable dir happens to be in userHome)
    if (path.resolve(dir) === path.resolve(targetStateDir)) continue;
    if (!existsDir(dir)) continue;

    // After legacy migration, .clawdbotcn etc. become symlinks/junctions
    // pointing to .openclawcn. We must skip these to avoid migrating the
    // same data twice.
    try {
      const lstat = fs.lstatSync(dir);
      if (lstat.isSymbolicLink()) continue;
    } catch {
      continue;
    }

    // Deduplicate by resolved real path (handles junctions that aren't
    // detected as symlinks by lstat on some Windows FS drivers)
    try {
      const realDir = fs.realpathSync(dir);
      if (seenReal.has(realDir)) continue;
      seenReal.add(realDir);
    } catch {
      /* realpathSync failure is non-fatal — proceed */
    }

    try {
      const entries = fs.readdirSync(dir);
      // Filter out dirs that only contain migration markers
      const meaningful = entries.filter(
        (e) =>
          e !== MIGRATED_TO_FILENAME &&
          e !== MIGRATED_FROM_FILENAME &&
          !e.startsWith("migrated-from-"),
      );
      if (meaningful.length > 0) {
        found.push(dir);
      }
    } catch {
      /* ignore */
    }
  }
  return found;
}

/** Check if a source dir has already been migrated to the given target. */
function isAlreadyMigrated(sourceDir: string, targetStateDir: string): boolean {
  const markerPath = path.join(sourceDir, MIGRATED_TO_FILENAME);
  if (!fileExists(markerPath)) return false;
  try {
    const marker = JSON.parse(fs.readFileSync(markerPath, "utf-8"));
    return marker?.target && path.resolve(marker.target) === path.resolve(targetStateDir);
  } catch {
    return false; // invalid marker — not migrated
  }
}

function runMigration(sourceDir: string, targetDir: string, result: PortableMigrationResult): void {
  const sourceName = path.basename(sourceDir);
  result.changes.push(`migrating from ${sourceName}`);

  // Discover all workspace directories (default + per-agent)
  const workspaces = discoverWorkspaces(sourceDir);
  if (workspaces.length > 0) {
    result.changes.push(
      `${sourceName}: found ${workspaces.length} workspace(s): ${workspaces.join(", ")}`,
    );
  }

  // Build full migration item list: per-workspace items first (P0 memory),
  // then static items (credentials, config, agents, etc.)
  const allItems: MigrateItem[] = [];
  for (const ws of workspaces) {
    allItems.push(...buildWorkspaceMigrateItems(ws, sourceDir));
  }
  allItems.push(...STATIC_MIGRATE_ITEMS);

  for (const item of allItems) {
    try {
      switch (item.type) {
        case "copy-no-overwrite":
          migrateFile(sourceDir, targetDir, item.rel, result);
          break;
        case "dir-copy-no-overwrite":
          migrateDirectory(sourceDir, targetDir, item.rel, result);
          break;
        case "profile-merge":
          migrateProfileMerge(sourceDir, targetDir, item.rel, result);
          break;
        case "config-merge":
          migrateConfigMerge(sourceDir, targetDir, item.rel, result);
          break;
        case "config-merge-legacy":
          // Legacy config files are merged into the target's canonical openclawcn.json,
          // not into a file with the same legacy name.
          migrateConfigMergeLegacy(sourceDir, targetDir, item.rel, result);
          break;
        case "archive-append":
          // [CN-PATCH:migration-p0] Append source archive content to target instead of
          // silently discarding when target already exists.
          migrateArchiveAppend(sourceDir, targetDir, item.rel, result);
          break;
        case "memory-md-append":
          // [CN-PATCH:migration-p0] Append legacy MEMORY.md content with import marker
          // instead of discarding when target already exists.
          migrateMemoryMdAppend(sourceDir, targetDir, item.rel, result);
          break;
      }
    } catch (err) {
      result.warnings.push(`Failed to migrate ${item.rel}: ${String(err)}`);
    }
  }
}

function migrateFile(
  sourceDir: string,
  targetDir: string,
  rel: string,
  result: PortableMigrationResult,
): void {
  const src = path.join(sourceDir, rel);
  const dst = path.join(targetDir, rel);
  if (!fileExists(src)) return;
  if (fileExists(dst)) return; // don't overwrite existing data
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
  result.changes.push(`copied ${rel}`);
}

function migrateDirectory(
  sourceDir: string,
  targetDir: string,
  rel: string,
  result: PortableMigrationResult,
): void {
  const srcDir = path.join(sourceDir, rel);
  if (!existsDir(srcDir)) return;
  const dstDir = path.join(targetDir, rel);
  ensureDir(dstDir);
  copyDirRecursive(srcDir, dstDir, rel, result);
}

const ARCHIVE_IMPORT_MARKER = "<!-- Migrated from portable source";

/**
 * [CN-PATCH:migration-p0] Append source archive content to target.
 * If target doesn't exist, just copy. If target exists, append source content
 * with a separator line to preserve both sets of archived memories.
 * Uses a marker to prevent duplicate appends on retry.
 */
function migrateArchiveAppend(
  sourceDir: string,
  targetDir: string,
  rel: string,
  result: PortableMigrationResult,
): void {
  const src = path.join(sourceDir, rel);
  const dst = path.join(targetDir, rel);
  if (!fileExists(src)) return;

  const srcContent = fs.readFileSync(src, "utf-8");
  if (!srcContent.trim()) return;

  ensureDir(path.dirname(dst));

  if (!fileExists(dst)) {
    fs.copyFileSync(src, dst);
    result.changes.push(`copied ${rel}`);
    return;
  }

  const dstContent = fs.readFileSync(dst, "utf-8");

  // Already appended (idempotent check)
  if (dstContent.includes(ARCHIVE_IMPORT_MARKER)) return;

  // Content identical — skip
  if (dstContent.trim() === srcContent.trim()) return;

  // Append source content with separator
  const now = new Date().toISOString().split("T")[0];
  const separator = `\n\n---\n${ARCHIVE_IMPORT_MARKER} (${now}) -->\n\n`;
  writeFileAtomic(dst, dstContent.trimEnd() + separator + srcContent);
  result.changes.push(`merged ${rel} (appended archived memories from source)`);
}

const MEMORY_MD_IMPORT_MARKER = "Imported from legacy config";

/**
 * [CN-PATCH:migration-p0] Append legacy MEMORY.md content with import marker.
 * If target doesn't exist, just copy. If target exists and content differs,
 * append with import marker. Skip if already imported or content identical.
 */
function migrateMemoryMdAppend(
  sourceDir: string,
  targetDir: string,
  rel: string,
  result: PortableMigrationResult,
): void {
  const src = path.join(sourceDir, rel);
  const dst = path.join(targetDir, rel);
  if (!fileExists(src)) return;

  const srcContent = fs.readFileSync(src, "utf-8");
  if (!srcContent.trim()) return;

  ensureDir(path.dirname(dst));

  if (!fileExists(dst)) {
    fs.copyFileSync(src, dst);
    result.changes.push(`copied ${rel}`);
    return;
  }

  const dstContent = fs.readFileSync(dst, "utf-8");

  // Already imported (idempotent check)
  if (dstContent.includes(MEMORY_MD_IMPORT_MARKER)) return;

  // Content identical — skip
  if (dstContent.trim() === srcContent.trim()) return;

  // Append with import marker
  const now = new Date().toISOString().split("T")[0];
  const separator = `\n---\n<!-- ${MEMORY_MD_IMPORT_MARKER} (${now}) -->\n`;
  writeFileAtomic(dst, dstContent.trimEnd() + separator + srcContent);
  result.changes.push(`merged ${rel} (appended content from source)`);
}

function copyDirRecursive(
  srcDir: string,
  dstDir: string,
  relBase: string,
  result: PortableMigrationResult,
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(srcDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(dstDir, entry.name);
    const rel = path.join(relBase, entry.name);

    if (entry.isSymbolicLink()) {
      // Recreate symlinks/junctions (e.g. QMD shared models directory).
      // On Windows, QMD uses junctions (absolute-path directory symlinks)
      // that point to the shared models cache — we must recreate these
      // rather than copying the target's contents.
      copySymlink(srcPath, dstPath, rel, result);
    } else if (entry.isDirectory()) {
      ensureDir(dstPath);
      copyDirRecursive(srcPath, dstPath, rel, result);
    } else if (entry.isFile()) {
      if (!fileExists(dstPath)) {
        fs.copyFileSync(srcPath, dstPath);
        result.changes.push(`copied ${rel}`);
      }
    }
  }
}

/**
 * Recreate a symlink/junction at the destination.
 * Reads the link target from the source and creates an identical link at dst.
 * On Windows, directory symlinks are created as junctions (no admin required).
 */
function copySymlink(
  srcPath: string,
  dstPath: string,
  rel: string,
  result: PortableMigrationResult,
): void {
  try {
    // Don't overwrite existing entries
    try {
      fs.lstatSync(dstPath);
      return; // already exists
    } catch {
      /* does not exist — proceed */
    }

    const linkTarget = fs.readlinkSync(srcPath);

    // Check if the link target actually exists (dangling symlink check)
    let isDir = false;
    try {
      const stat = fs.statSync(srcPath); // follows the link
      isDir = stat.isDirectory();
    } catch {
      // Dangling symlink — still recreate it as-is (target may become
      // available later, e.g. QMD models cache not yet downloaded)
      isDir = true; // assume directory for junction type
    }

    const linkType = isDir ? (process.platform === "win32" ? "junction" : "dir") : "file";
    fs.symlinkSync(linkTarget, dstPath, linkType);
    result.changes.push(`symlinked ${rel} -> ${linkTarget}`);
  } catch (err) {
    result.warnings.push(`Failed to recreate symlink ${rel}: ${String(err)}`);
  }
}

/**
 * Merge profile.json: combine entries from old and new profiles,
 * dedup by (category, key), keep highest-score entries, cap at 200.
 *
 * [BUG-1 fix] Uses atomic write to prevent corruption on crash.
 */
function migrateProfileMerge(
  sourceDir: string,
  targetDir: string,
  rel: string,
  result: PortableMigrationResult,
): void {
  const srcPath = path.join(sourceDir, rel);
  const dstPath = path.join(targetDir, rel);

  if (!fileExists(srcPath)) return;

  const srcProfile = readProfileSafe(srcPath);
  if (!srcProfile || srcProfile.entries.length === 0) return;

  ensureDir(path.dirname(dstPath));

  // If target doesn't exist, just copy
  if (!fileExists(dstPath)) {
    fs.copyFileSync(srcPath, dstPath);
    result.changes.push(`copied ${rel} (${srcProfile.entries.length} entries)`);
    return;
  }

  // Both exist — merge
  const dstProfile = readProfileSafe(dstPath);
  if (!dstProfile) {
    // Target is corrupted — backup and replace
    const bakPath = dstPath + ".pre-migrate.bak";
    fs.copyFileSync(dstPath, bakPath);
    fs.copyFileSync(srcPath, dstPath);
    result.changes.push(`replaced corrupted ${rel} from source (backup at .pre-migrate.bak)`);
    return;
  }

  // Backup target before merging (only once — preserves the pre-migration state)
  const bakPath = dstPath + ".pre-migrate.bak";
  if (!fileExists(bakPath)) {
    fs.copyFileSync(dstPath, bakPath);
  }

  const merged = mergeProfiles(srcProfile, dstProfile);
  const mergedJson = JSON.stringify(merged, null, 2);
  // [BUG-1 fix] Atomic write — write to tmp then rename
  writeFileAtomic(dstPath, mergedJson);

  const srcCount = srcProfile.entries.length;
  const dstCount = dstProfile.entries.length;
  const mergedCount = merged.entries.length;
  result.changes.push(
    `merged ${rel}: ${srcCount} (old) + ${dstCount} (new) -> ${mergedCount} entries (backup at .pre-migrate.bak)`,
  );
}

function readProfileSafe(filePath: string): UserProfile | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.entries)) {
      return parsed as UserProfile;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Merge two profiles: target entries take priority for same (category, key).
 * For different entries, keep all up to PROFILE_MAX_ENTRIES sorted by score.
 */
function mergeProfiles(source: UserProfile, target: UserProfile): UserProfile {
  const now = Date.now();
  const seen = new Map<string, ProfileEntry>();

  // Target entries take priority
  for (const entry of target.entries) {
    const key = `${entry.category}::${entry.key}`;
    seen.set(key, entry);
  }

  // Add source entries that don't conflict, or keep higher-score version
  for (const entry of source.entries) {
    const key = `${entry.category}::${entry.key}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, entry);
    } else {
      // Keep the one with higher score
      const existingScore = computeScore(existing, now);
      const sourceScore = computeScore(entry, now);
      if (sourceScore > existingScore) {
        // Source is better — merge hits (take max) and keep source value
        seen.set(key, {
          ...entry,
          hits: Math.max(entry.hits, existing.hits),
          updatedAt: Math.max(entry.updatedAt, existing.updatedAt),
        });
      } else {
        // Existing is better — merge hits
        seen.set(key, {
          ...existing,
          hits: Math.max(entry.hits, existing.hits),
        });
      }
    }
  }

  // Sort by score descending and cap at max entries
  const allEntries = Array.from(seen.values());
  allEntries.sort((a, b) => computeScore(b, now) - computeScore(a, now));

  return {
    version: Math.max(source.version || 1, target.version || 1),
    entries: allEntries.slice(0, PROFILE_MAX_ENTRIES),
  };
}

/**
 * Merge config files: read both as JSON, deep merge (target wins on conflict).
 *
 * [BUG-2 fix] Uses atomic write to prevent corruption on crash.
 */
function migrateConfigMerge(
  sourceDir: string,
  targetDir: string,
  rel: string,
  result: PortableMigrationResult,
): void {
  const srcPath = path.join(sourceDir, rel);
  const dstPath = path.join(targetDir, rel);

  if (!fileExists(srcPath)) return;

  ensureDir(path.dirname(dstPath));

  // If target doesn't exist, just copy
  if (!fileExists(dstPath)) {
    fs.copyFileSync(srcPath, dstPath);
    result.changes.push(`copied ${rel}`);
    return;
  }

  // Both exist — deep merge (target takes priority)
  try {
    const srcConfig = JSON.parse(fs.readFileSync(srcPath, "utf-8"));
    const dstConfig = JSON.parse(fs.readFileSync(dstPath, "utf-8"));

    // Backup target (only once — first backup captures the pre-migration state;
    // subsequent merges from other legacy dirs should not overwrite it)
    const bakPath = dstPath + ".pre-migrate.bak";
    if (!fileExists(bakPath)) {
      fs.copyFileSync(dstPath, bakPath);
    }

    // Simple recursive merge: target values win on conflict
    const merged = deepMergeConfigs(srcConfig, dstConfig);
    writeFileAtomic(dstPath, JSON.stringify(merged, null, 2));
    result.changes.push(`merged ${rel} (backup at .pre-migrate.bak)`);
  } catch (err) {
    result.warnings.push(`Config merge failed for ${rel}: ${String(err)}`);
  }
}

/**
 * Merge a legacy-named config file (e.g. clawdbotcn.json) from the source
 * into the target's canonical openclawcn.json.
 *
 * Unlike config-merge which merges same-name files, this reads the legacy
 * file from source and merges it into the target's openclawcn.json (creating
 * it if it doesn't exist). The target's openclawcn.json always takes priority.
 *
 * [BUG-8 fix] Each legacy merge creates a numbered backup to preserve
 * intermediate states when multiple legacy configs exist.
 */
function migrateConfigMergeLegacy(
  sourceDir: string,
  targetDir: string,
  rel: string,
  result: PortableMigrationResult,
): void {
  const srcPath = path.join(sourceDir, rel);
  if (!fileExists(srcPath)) return;

  const canonicalRel = "openclawcn.json";
  const dstPath = path.join(targetDir, canonicalRel);

  ensureDir(path.dirname(dstPath));

  try {
    const srcConfig = JSON.parse(fs.readFileSync(srcPath, "utf-8"));

    if (!fileExists(dstPath)) {
      // No canonical config yet — legacy config becomes the canonical one
      writeFileAtomic(dstPath, JSON.stringify(srcConfig, null, 2));
      result.changes.push(`copied ${rel} as ${canonicalRel}`);
      return;
    }

    // Both exist — deep merge (target openclawcn.json takes priority)
    const dstConfig = JSON.parse(fs.readFileSync(dstPath, "utf-8"));

    // [BUG-8 fix] Numbered backups: .pre-migrate-legacy-0.bak, -1.bak, etc.
    // so each legacy merge's intermediate state is preserved.
    const legacyName = path.basename(rel, ".json");
    const bakPath = `${dstPath}.pre-migrate-${legacyName}.bak`;
    if (!fileExists(bakPath)) {
      fs.copyFileSync(dstPath, bakPath);
    }

    const merged = deepMergeConfigs(srcConfig, dstConfig);
    writeFileAtomic(dstPath, JSON.stringify(merged, null, 2));
    result.changes.push(`merged legacy ${rel} into ${canonicalRel}`);
  } catch (err) {
    result.warnings.push(`Legacy config merge failed for ${rel}: ${String(err)}`);
  }
}

/**
 * Deep merge two config objects. `target` values take priority.
 * [CN-PATCH:migration-p0] Smart array merge: arrays of objects with `id` fields
 * are merged by id (target wins on conflict), preserving source-only entries.
 * Simple arrays (strings, numbers) still use target-wins-entirely semantics.
 */
function deepMergeConfigs(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...source };
  for (const key of Object.keys(target)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const srcVal = source[key];
    const tgtVal = target[key];
    if (
      tgtVal !== null &&
      typeof tgtVal === "object" &&
      !Array.isArray(tgtVal) &&
      srcVal !== null &&
      typeof srcVal === "object" &&
      !Array.isArray(srcVal)
    ) {
      result[key] = deepMergeConfigs(
        srcVal as Record<string, unknown>,
        tgtVal as Record<string, unknown>,
      );
    } else if (Array.isArray(tgtVal) && Array.isArray(srcVal)) {
      result[key] = mergeArraysById(srcVal, tgtVal);
    } else {
      result[key] = tgtVal;
    }
  }
  return result;
}

/**
 * [CN-PATCH:migration-p0] Smart array merge for config arrays.
 * For arrays of objects with `id` fields (e.g. mcp.servers, models),
 * merge by id — target entries win on conflict, source-only entries preserved.
 * For simple arrays (strings, etc.) target wins entirely.
 */
function mergeArraysById(source: unknown[], target: unknown[]): unknown[] {
  const sourceHasIds =
    source.length > 0 &&
    source.every(
      (item) => item && typeof item === "object" && "id" in (item as Record<string, unknown>),
    );
  const targetHasIds =
    target.length > 0 &&
    target.every(
      (item) => item && typeof item === "object" && "id" in (item as Record<string, unknown>),
    );

  if (sourceHasIds || targetHasIds) {
    const seen = new Map<string, unknown>();
    for (const item of source) {
      if (item && typeof item === "object") {
        const id = (item as Record<string, unknown>).id;
        if (typeof id === "string") seen.set(id, item);
      }
    }
    for (const item of target) {
      if (item && typeof item === "object") {
        const id = (item as Record<string, unknown>).id;
        if (typeof id === "string") seen.set(id, item);
      }
    }
    return Array.from(seen.values());
  }

  return target;
}

/**
 * Write a migration marker in the source dir pointing to the target.
 * Also writes a receipt in the target dir listing what was migrated.
 */
function writeMigrationMarker(
  sourceDir: string,
  targetDir: string,
  result: PortableMigrationResult,
): void {
  const now = new Date().toISOString();

  try {
    const markerTo = {
      target: targetDir,
      migratedAt: now,
      version: "1.0",
      items: result.changes.length,
    };
    fs.writeFileSync(
      path.join(sourceDir, MIGRATED_TO_FILENAME),
      JSON.stringify(markerTo, null, 2),
      "utf-8",
    );
  } catch (err) {
    result.warnings.push(
      `Failed to write migration marker to ${path.basename(sourceDir)}: ${String(err)}`,
    );
  }

  try {
    const markerFrom = {
      source: sourceDir,
      migratedAt: now,
      items: result.changes,
    };
    // Append-style: use source dirname in filename to avoid overwriting
    // markers from other legacy dirs.
    const markerName = `migrated-from-${path.basename(sourceDir)}.json`;
    fs.writeFileSync(
      path.join(targetDir, markerName),
      JSON.stringify(markerFrom, null, 2),
      "utf-8",
    );
  } catch (err) {
    result.warnings.push(`Failed to write migration receipt to target: ${String(err)}`);
  }
}
