/**
 * Persistent File Index for Skill Entries
 *
 * Three-tier cache architecture:
 *   Tier 1: In-memory Map (30s TTL)      ~0ms   (workspace.ts)
 *   Tier 2: File Index (mtime check)     ~6ms   (THIS FILE)
 *   Tier 3: Full Filesystem Scan         ~28s   (fallback)
 *
 * The file index stores fully parsed SkillEntry data alongside file mtime/size
 * fingerprints.  On subsequent loads, only files whose mtime or size changed
 * are re-read and re-parsed — everything else is served from the index.
 *
 * Index file: {CONFIG_DIR}/skill-entries-cache-{hash}.json
 * Follows local-index.ts patterns: atomic write (.tmp → rename), schema version.
 */

import fs from "node:fs";
import path from "node:path";

import type { ClawdbotConfig } from "../../config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { CONFIG_DIR, resolveUserPath } from "../../utils.js";
import { resolveBundledSkillsDir } from "./bundled-dir.js";
import {
  parseFrontmatter,
  resolveClawdbotMetadata,
  resolveSkillInvocationPolicy,
} from "./frontmatter.js";
import { resolvePluginSkillDirs } from "./plugin-skills.js";
import type {
  ClawdbotSkillMetadata,
  ParsedSkillFrontmatter,
  SkillEntry,
  SkillInvocationPolicy,
} from "./types.js";

const fsp = fs.promises;
const logger = createSubsystemLogger("skills-file-index");

const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-file record: stores parsed data + filesystem fingerprint. */
interface SkillFileRecord {
  filePath: string;
  baseDir: string;
  source: string;
  name: string;
  description: string;
  mtimeMs: number;
  size: number;
  frontmatter: ParsedSkillFrontmatter;
  clawdbot: ClawdbotSkillMetadata | undefined;
  invocation: SkillInvocationPolicy;
}

/** Per-directory record: sorted list of skill subdirectories. */
interface DirRecord {
  dir: string;
  source: string;
  childDirs: string[];
  childDirsHash: string;
}

/** The full persistent index written to disk. */
interface SkillEntriesFileIndex {
  schemaVersion: number;
  updatedAt: string;
  files: Record<string, SkillFileRecord>;
  dirs: Record<string, DirRecord>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple non-crypto hash for file naming (deterministic, fast). */
function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

/** Resolve the file index path for a given workspace. */
function resolveFileIndexPath(workspaceDir: string): string {
  const hash = simpleHash(path.resolve(workspaceDir));
  return path.join(CONFIG_DIR, `skill-entries-cache-${hash}.json`);
}

/** Read file index from disk. Returns null if missing, corrupt, or wrong version. */
function readFileIndex(indexPath: string): SkillEntriesFileIndex | null {
  try {
    if (!fs.existsSync(indexPath)) return null;
    const raw = fs.readFileSync(indexPath, "utf-8");
    const data = JSON.parse(raw) as SkillEntriesFileIndex;
    if (data.schemaVersion !== SCHEMA_VERSION) return null;
    if (!data.files || !data.dirs) return null;
    return data;
  } catch {
    return null;
  }
}

/** Atomic write: .tmp → rename (same pattern as local-index.ts:230-233). */
async function writeFileIndex(
  indexPath: string,
  index: SkillEntriesFileIndex,
): Promise<void> {
  const dir = path.dirname(indexPath);
  await fsp.mkdir(dir, { recursive: true });
  const tmpPath = `${indexPath}.tmp`;
  await fsp.writeFile(tmpPath, JSON.stringify(index), "utf-8");
  try {
    await fsp.rename(tmpPath, indexPath);
  } catch {
    // On Windows, rename may fail if target exists; overwrite directly.
    try {
      await fsp.writeFile(indexPath, JSON.stringify(index), "utf-8");
      await fsp.unlink(tmpPath).catch(() => {});
    } catch {
      // Best-effort — index write failure should never block loading.
    }
  }
}

/**
 * Scan a directory for immediate child dirs that contain a SKILL.md.
 * Much faster than loadSkillsFromDir: only readdirSync + existsSync, no file reading.
 */
function scanDirChildSkills(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries
      .filter(
        (e) =>
          e.isDirectory() &&
          fs.existsSync(path.join(dir, e.name, "SKILL.md")),
      )
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function hashChildDirs(dirs: string[]): string {
  return simpleHash(dirs.join("\0"));
}

/** Check if a cached file record is still fresh via mtime + size. */
function isFileFresh(record: SkillFileRecord): boolean {
  try {
    const stat = fs.statSync(record.filePath);
    return stat.mtimeMs === record.mtimeMs && stat.size === record.size;
  } catch {
    return false;
  }
}

/** Read + parse a single SKILL.md file, producing a SkillFileRecord. */
function parseSkillFile(
  skillMdPath: string,
  parentDir: string,
  skillName: string,
  source: string,
): SkillFileRecord | null {
  try {
    const stat = fs.statSync(skillMdPath);
    const raw = fs.readFileSync(skillMdPath, "utf-8");
    const frontmatter = parseFrontmatter(raw);
    const clawdbot = resolveClawdbotMetadata(frontmatter);
    const invocation = resolveSkillInvocationPolicy(frontmatter);
    const description = frontmatter.description ?? skillName;
    return {
      filePath: skillMdPath,
      baseDir: path.join(parentDir, skillName),
      source,
      name: skillName,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      description,
      frontmatter,
      clawdbot,
      invocation,
    };
  } catch {
    return null;
  }
}

/** Convert a SkillFileRecord to a SkillEntry (the public type). */
function recordToEntry(record: SkillFileRecord): SkillEntry {
  return {
    skill: {
      name: record.name,
      description: record.description,
      filePath: record.filePath,
      baseDir: record.baseDir,
      source: record.source,
    },
    frontmatter: record.frontmatter,
    clawdbot: record.clawdbot,
    invocation: record.invocation,
  };
}

// ---------------------------------------------------------------------------
// Core: Incremental Load
// ---------------------------------------------------------------------------

/**
 * Load skill entries using the persistent file index.
 *
 * Algorithm:
 * 1. Read existing file index from disk.
 * 2. For each skill root dir, compare directory listing (added/removed skills).
 * 3. For unchanged dirs, check individual file mtimes via fs.statSync.
 * 4. Only re-parse SKILL.md files that actually changed.
 * 5. Apply name-based precedence: extra < bundled < managed < workspace.
 * 6. Write updated index back to disk in background (never blocks).
 */
export function loadSkillEntriesFromFileIndex(
  workspaceDir: string,
  opts?: {
    config?: ClawdbotConfig;
    managedSkillsDir?: string;
    bundledSkillsDir?: string;
  },
): SkillEntry[] {
  const t0 = Date.now();
  const indexPath = resolveFileIndexPath(workspaceDir);
  const existingIndex = readFileIndex(indexPath);

  // Resolve all skill root directories (same logic as workspace.ts:loadSkillEntriesUncached)
  const managedSkillsDir =
    opts?.managedSkillsDir ?? path.join(CONFIG_DIR, "skills");
  const workspaceSkillsDir = path.join(workspaceDir, "skills");
  const bundledSkillsDir =
    opts?.bundledSkillsDir ?? resolveBundledSkillsDir();
  const extraDirsRaw = opts?.config?.skills?.load?.extraDirs ?? [];
  const extraDirs = extraDirsRaw
    .map((d) => (typeof d === "string" ? d.trim() : ""))
    .filter(Boolean);
  const pluginSkillDirs = resolvePluginSkillDirs({
    workspaceDir,
    config: opts?.config,
  });
  const mergedExtraDirs = [...extraDirs, ...pluginSkillDirs];

  // Build dir list with sources — same precedence as workspace.ts
  const dirSources: Array<{ dir: string; source: string }> = [];
  for (const dir of mergedExtraDirs) {
    dirSources.push({ dir: resolveUserPath(dir), source: "clawdbot-extra" });
  }
  if (bundledSkillsDir) {
    dirSources.push({ dir: bundledSkillsDir, source: "clawdbot-bundled" });
  }
  dirSources.push({ dir: managedSkillsDir, source: "clawdbot-managed" });
  dirSources.push({ dir: workspaceSkillsDir, source: "clawdbot-workspace" });

  const newFiles: Record<string, SkillFileRecord> = {};
  const newDirs: Record<string, DirRecord> = {};
  let indexDirty = !existingIndex;
  let filesReused = 0;
  let filesParsed = 0;

  for (const { dir, source } of dirSources) {
    // Check directory listing for structural changes (added/removed skills)
    const currentChildren = scanDirChildSkills(dir);
    const currentHash = hashChildDirs(currentChildren);
    const cachedDir = existingIndex?.dirs[dir];

    newDirs[dir] = {
      dir,
      source,
      childDirs: currentChildren,
      childDirsHash: currentHash,
    };

    const dirChanged = !cachedDir || cachedDir.childDirsHash !== currentHash;
    if (dirChanged) indexDirty = true;

    for (const childName of currentChildren) {
      const skillMdPath = path.join(dir, childName, "SKILL.md");
      const cachedFile = existingIndex?.files[skillMdPath];

      if (!dirChanged && cachedFile && isFileFresh(cachedFile)) {
        // File unchanged — reuse cached record (no read, no parse)
        newFiles[skillMdPath] = cachedFile;
        filesReused++;
      } else {
        // File new or changed — re-parse
        const record = parseSkillFile(skillMdPath, dir, childName, source);
        if (record) {
          newFiles[skillMdPath] = record;
          filesParsed++;
          indexDirty = true;
        }
      }
    }
  }

  // Apply name-based precedence: later sources override earlier
  // (extra < bundled < managed < workspace — same as workspace.ts)
  const merged = new Map<string, SkillFileRecord>();
  for (const { dir, source } of dirSources) {
    const dirRecord = newDirs[dir];
    if (!dirRecord) continue;
    for (const childName of dirRecord.childDirs) {
      const skillMdPath = path.join(dir, childName, "SKILL.md");
      const record = newFiles[skillMdPath];
      if (record) {
        merged.set(record.name, record);
      }
    }
  }

  // Convert to SkillEntry[]
  const entries = Array.from(merged.values()).map(recordToEntry);

  const elapsed = Date.now() - t0;
  logger.debug(
    `loaded ${entries.length} skills in ${elapsed}ms (reused=${filesReused}, parsed=${filesParsed}, dirty=${indexDirty})`,
  );

  // Persist updated index in background (never blocks the caller)
  if (indexDirty) {
    const updatedIndex: SkillEntriesFileIndex = {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      files: newFiles,
      dirs: newDirs,
    };
    writeFileIndex(indexPath, updatedIndex).catch((err) => {
      logger.debug(`failed to persist file index: ${String(err)}`);
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Invalidation
// ---------------------------------------------------------------------------

/** Delete the file index for a specific workspace dir. */
export function invalidateFileIndex(workspaceDir: string): void {
  const indexPath = resolveFileIndexPath(workspaceDir);
  try {
    if (fs.existsSync(indexPath)) fs.unlinkSync(indexPath);
  } catch {
    // best-effort
  }
}

/** Delete all file indices (used when workspaceDir is unknown). */
export function invalidateAllFileIndices(): void {
  try {
    const entries = fs.readdirSync(CONFIG_DIR);
    for (const f of entries) {
      if (
        f.startsWith("skill-entries-cache-") &&
        f.endsWith(".json")
      ) {
        try {
          fs.unlinkSync(path.join(CONFIG_DIR, f));
        } catch {
          // best-effort
        }
      }
    }
  } catch {
    // best-effort
  }
}
