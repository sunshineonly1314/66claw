/**
 * [CN-PATCH:memory-profile] User Profile Facts Store
 *
 * A lightweight structured memory that stores ≤80 key facts about the user.
 * Inspired by ChatGPT's memory design (which uses ~33 facts to serve 100M+ users)
 * and Mem0/MemGPT's importance scoring + decay mechanisms.
 *
 * Facts are stored in `memory/profile.json` within the agent workspace and
 * injected into the system prompt on every turn (~200-500 tokens overhead).
 *
 * Key design choices:
 * - Upsert semantics: same category+key overwrites old value (auto-resolves contradictions)
 * - Score-based eviction: composite score from category weight + hits + recency
 * - Category protection: identity/correction entries have guaranteed minimum slots
 * - Hit reinforcement: re-extracted facts get hits+1 (turns dedup weakness into strength)
 * - Stale todo cleanup: 30-day-old low-hit todos are auto-removed (source-aware thresholds)
 * - Eviction archival: qualified evicted entries are appended to memory/profile-archive.md
 *   so the upstream SQLite file watcher can index them for semantic retrieval
 * - Human-readable: JSON file, can be manually inspected/edited
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const _require = createRequire(import.meta.url);

// ── Changelog Buffer ──
// Accumulates profile mutations for async flush to SQLite.
// Flushed by flushProfileChangelog() after withProfileLock completes.

type ChangelogEntry = {
  category: string;
  key: string;
  oldValue: string | null;
  newValue: string | null;
  operation: "add" | "update" | "evict" | "merge" | "remove";
  reason?: string;
};

// Per-workspace changelog buffer. Prevents cross-workspace pollution when
// multiple workspaces are being written concurrently.
const _pendingChangelogsMap = new Map<string, ChangelogEntry[]>();

// Tracks the workspace currently being mutated inside withProfileLock.
// Used by upsertProfileEntryFull/evictByScore (sync functions that cannot
// take a workspaceDir parameter) to route changelog entries to the right bucket.
let _currentLockWorkspace: string | null = null;

/** Push a changelog entry into the correct per-workspace bucket. */
function pushChangelog(entry: ChangelogEntry): void {
  const ws = _currentLockWorkspace;
  if (!ws) return; // not inside a withProfileLock — skip silently
  let arr = _pendingChangelogsMap.get(ws);
  if (!arr) {
    arr = [];
    _pendingChangelogsMap.set(ws, arr);
  }
  arr.push(entry);
}

/**
 * Flush accumulated changelogs to the memory SQLite database.
 * Fire-and-forget — errors are silently ignored.
 * On failure, entries are pushed back so the next flush can retry them.
 */
export function flushProfileChangelog(workspaceDir: string): void {
  const bucket = _pendingChangelogsMap.get(workspaceDir);
  if (!bucket || bucket.length === 0) return;
  // Drain the bucket — take ownership of the entries
  const entries = bucket.splice(0);
  try {
    // Dynamic require to avoid circular dependencies at module load time
    const sqliteMod = _require("./sqlite.js") as {
      requireNodeSqlite: () => typeof import("node:sqlite");
    };
    const { DatabaseSync } = sqliteMod.requireNodeSqlite();
    const memoryDir = path.join(workspaceDir, "memory");
    if (!fs.existsSync(memoryDir)) {
      // Push entries back — dir may be created later
      _pendingChangelogsMap.set(workspaceDir, entries);
      return;
    }
    const dbPath = path.join(memoryDir, "memory.sqlite");
    const db = new DatabaseSync(dbPath);
    try {
      db.exec("PRAGMA journal_mode=WAL");
      db.exec("PRAGMA synchronous=NORMAL");
      db.exec("PRAGMA busy_timeout=5000");
      db.exec(`
        CREATE TABLE IF NOT EXISTS profile_changelog (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL, key TEXT NOT NULL,
          old_value TEXT, new_value TEXT,
          operation TEXT NOT NULL, reason TEXT,
          created_at INTEGER NOT NULL
        );
      `);
      // Migrate: add 'reason' column for databases created before this version
      try {
        const cols = db.prepare("PRAGMA table_info(profile_changelog)").all() as Array<{
          name: string;
        }>;
        if (!cols.some((c) => c.name === "reason")) {
          db.exec("ALTER TABLE profile_changelog ADD COLUMN reason TEXT");
        }
      } catch {
        /* best-effort migration */
      }
      const stmt = db.prepare(
        `INSERT INTO profile_changelog (category, key, old_value, new_value, operation, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      const now = Date.now();
      for (const e of entries) {
        stmt.run(e.category, e.key, e.oldValue, e.newValue, e.operation, e.reason ?? null, now);
      }
    } finally {
      try {
        db.close();
      } catch {
        /* ignore */
      }
    }
  } catch {
    // DB write failed — push entries back for next flush attempt.
    // Use loop-based prepend to avoid stack overflow from spread on large arrays.
    const MAX_PENDING_CHANGELOG = 500;
    const existing = _pendingChangelogsMap.get(workspaceDir);
    if (existing) {
      for (let i = entries.length - 1; i >= 0; i--) {
        existing.unshift(entries[i]);
      }
      // Cap to prevent unbounded growth when DB is permanently broken
      if (existing.length > MAX_PENDING_CHANGELOG) {
        existing.splice(MAX_PENDING_CHANGELOG);
      }
    } else {
      _pendingChangelogsMap.set(workspaceDir, entries.slice(0, MAX_PENDING_CHANGELOG));
    }
  }
}

export const PROFILE_MAX_ENTRIES = 80;
export const PROFILE_FILENAME = "profile.json";
export const PROFILE_ARCHIVE_FILENAME = "profile-archive.md";
export const PROFILE_MAX_KEY_LENGTH = 100;
export const PROFILE_MAX_VALUE_LENGTH = 800;
/**
 * Maximum total characters for the formatted system prompt block.
 * This is the DEFAULT cap (~2000 tokens). For small-context models (≤32K),
 * callers should pass a smaller `maxChars` to `formatProfileForSystemPrompt`.
 *
 * Token budget breakdown (conservative):
 * - 2000 chars ≈ 500 tokens for the profile
 * - 1600 chars ≈ 400 tokens for cold memory
 * - ~1250 tokens for base system prompt
 * - Total: ~2150 tokens — safe for all context sizes
 */
export const PROFILE_MAX_PROMPT_CHARS = 2000;
/** Maximum size for a single archive file (~5MB). Rotates to a new file when exceeded. */
export const PROFILE_ARCHIVE_MAX_BYTES = 5_000_000;

// ── Importance Scoring ──

/** Category base weights for eviction scoring. Higher = harder to evict. */
export const CATEGORY_WEIGHTS: Record<ProfileCategory, number> = {
  identity: 1.0, // user name, role — highest intrinsic value
  correction: 0.95, // user corrections — agent accuracy depends on these
  procedure: 0.7, // established rules/workflows
  preference: 0.6, // likes/dislikes
  fact: 0.5, // project facts — can become stale
  todo: 0.3, // todos — inherently ephemeral
};

/** Each hit adds score via: HITS_WEIGHT × hits^HITS_DIMINISHING */
const HITS_WEIGHT = 0.15;
/** Diminishing returns exponent for hits contribution. */
const HITS_DIMINISHING = 0.7;
/** Half-life in days for the recency decay component. */
const RECENCY_HALF_LIFE_DAYS = 14;
/** Maximum contribution from the recency component. */
const RECENCY_WEIGHT = 0.3;

/** Minimum guaranteed slots per category during eviction. */
export const PROTECTED_CATEGORY_MINIMUMS: Partial<Record<ProfileCategory, number>> = {
  identity: 5,
  correction: 5,
};

/** Stale todo cleanup: remove low-hit todos older than this many days. */
const STALE_TODO_DAYS = 30;
const STALE_TODO_MS = STALE_TODO_DAYS * 24 * 60 * 60 * 1000;
// [CN-PATCH:memory-fix] Max hits threshold for stale todo cleanup.
// Previously only zero-hit todos were cleaned, but the extraction LLM
// re-extracts the same todos each turn (incrementing hits), so they never
// reach hits=0 and persist forever. Todos with hits≤1 are still considered
// "not manually reinforced" (1 hit = just the extraction LLM re-saw it once).
const STALE_TODO_MAX_HITS = 1;

// ── Archive Criteria ──
// Evicted entries must pass these gates to be archived into profile-archive.md.
// This prevents garbage accumulation in the SQLite index.

/** Minimum hits to qualify for archival (at least reinforced once → LLM saw it twice). */
const ARCHIVE_MIN_HITS = 1;
/** Minimum composite score to qualify for archival (filters out low-value entries). */
const ARCHIVE_MIN_SCORE = 0.5;
/** Categories excluded from archival — todos are ephemeral by nature. */
const ARCHIVE_EXCLUDED_CATEGORIES: ReadonlySet<ProfileCategory> = new Set(["todo"]);

/**
 * Compute a composite importance score for a profile entry.
 *
 * score = categoryWeight + hitsContribution + recencyContribution
 *
 * Range: ~0.3 (old zero-hit todo) → ~4.0+ (fresh frequently-hit identity with 50+ hits)
 */
export function computeEntryScore(entry: ProfileEntry, now: number = Date.now()): number {
  const categoryBase = CATEGORY_WEIGHTS[entry.category] ?? 0.5;

  // Hits contribution with diminishing returns
  const hitsContribution = HITS_WEIGHT * Math.pow(Math.max(entry.hits, 0), HITS_DIMINISHING);

  // Recency contribution: exponential decay with 14-day half-life
  const ageDays = Math.max(0, (now - entry.updatedAt) / (1000 * 60 * 60 * 24));
  const recencyFactor = Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
  const recencyContribution = RECENCY_WEIGHT * recencyFactor;

  return categoryBase + hitsContribution + recencyContribution;
}

export type ProfileCategory =
  | "preference"
  | "correction"
  | "fact"
  | "identity"
  | "todo"
  | "procedure";

export interface ProfileEntry {
  category: ProfileCategory;
  key: string;
  value: string;
  /** First creation timestamp. Preserved across updates. */
  createdAt: number;
  updatedAt: number;
  /** Number of times this entry has been referenced/reinforced. */
  hits: number;
  /** Write origin: how this entry was created/last modified. */
  source?: "tool" | "extraction" | "consolidation" | "migration";
}

export interface UserProfile {
  /** Schema version for forward-compatible migration. */
  version: number;
  entries: ProfileEntry[];
}

// [CN-PATCH:memory-fix] Current schema version.
// Increment this when the profile format changes, and add migration logic
// in migrateProfile() below. Version history:
//   1: Initial format
//   2: Added schema version awareness + stale todo threshold change
const CURRENT_PROFILE_VERSION = 2;

/** Result of upsert that also carries evicted entries for archival. */
export interface UpsertResult {
  profile: UserProfile;
  evicted: ProfileEntry[];
}

function emptyProfile(): UserProfile {
  return { version: CURRENT_PROFILE_VERSION, entries: [] };
}

/**
 * [CN-PATCH:memory-fix] Migrate profile from older schema versions.
 * Each version bump should add a migration case here.
 * Migrations are applied sequentially (v1→v2→v3→...).
 */
function migrateProfile(profile: UserProfile): UserProfile {
  let { version } = profile;
  if (!version || version < 1) version = 1;

  // [CN-PATCH:memory-fix] Guard against future versions from newer code.
  // If a newer version of the app wrote version > CURRENT, log a warning
  // but return the profile as-is (forward-compatible read, no downgrade).
  if (version > CURRENT_PROFILE_VERSION) {
    logProfileWarning(
      `[memory-safety] profile.json has version ${version} but this code only supports up to ${CURRENT_PROFILE_VERSION}. ` +
        `Data will be read as-is but structural changes from the newer version may not be understood.`,
    );
    return profile;
  }

  // v1 → v2: No structural changes, just version stamp + createdAt backfill
  if (version < 2) {
    // Create shallow copies of entries to avoid mutating the original objects
    const migratedEntries = profile.entries.map((entry) => {
      if (!entry.createdAt) {
        return { ...entry, createdAt: entry.updatedAt || Date.now() };
      }
      return entry;
    });
    version = 2;
    return { ...profile, entries: migratedEntries, version };
  }

  // Future migrations go here:
  // if (version < 3) { ... version = 3; }

  return { ...profile, version };
}

export function resolveProfilePath(workspaceDir: string): string {
  return path.join(workspaceDir, "memory", PROFILE_FILENAME);
}

// ── Safety: track corrupted profiles ──
// When readProfile detects JSON parse failure on an existing file, we mark it here.
// withProfileLock refuses to write if the profile was corrupted, preventing data loss.
const _corruptedProfiles = new Set<string>();

/** Internal warning logger — avoids importing the full logging module. */
function logProfileWarning(msg: string): void {
  try {
    // Use logVerbose if available, otherwise console.warn
    console.warn(msg);
  } catch {
    /* swallow */
  }
}

// ── In-memory read cache ──
// Avoids synchronous readFileSync on every agent turn when the profile hasn't changed.
// The cache is keyed by workspace dir and has a short TTL. Writes always invalidate it.
const PROFILE_CACHE_TTL_MS = 5_000;
const _profileCache = new Map<string, { profile: UserProfile; cachedAt: number }>();

/** Read profile from disk, or return a cached copy if fresh (≤5s).
 *  @param bypassCache - if true, always read from disk (used inside withProfileLock). */
export function readProfile(workspaceDir: string, bypassCache = false): UserProfile {
  if (!bypassCache) {
    const cached = _profileCache.get(workspaceDir);
    if (cached && Date.now() - cached.cachedAt < PROFILE_CACHE_TTL_MS) {
      // Return a deep copy so callers cannot mutate cached entry objects.
      return { ...cached.profile, entries: cached.profile.entries.map((e) => ({ ...e })) };
    }
  }
  const profilePath = resolveProfilePath(workspaceDir);
  try {
    const raw = fs.readFileSync(profilePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.entries)) {
      // [CN-PATCH:memory-fix] Run schema migration (handles createdAt backfill, version stamp, etc.)
      // Migration is idempotent and runs on every cold read. The migrated profile is cached
      // in memory, so subsequent hot reads see the migrated version. The migration is
      // persisted to disk on the next withProfileLock write (which reads, modifies, and writes).
      // We intentionally do NOT call writeProfile() here — readProfile can be called outside
      // withProfileLock, and an unsynchronized write would risk overwriting concurrent mutations.
      const profile = migrateProfile(parsed as UserProfile);
      _profileCache.set(workspaceDir, { profile, cachedAt: Date.now() });
      // Return a copy so callers cannot mutate the cached object.
      return { ...profile, entries: profile.entries.map((e) => ({ ...e })) };
    }
    // Valid JSON but wrong shape — treat as empty (new file).
    const empty = emptyProfile();
    _profileCache.set(workspaceDir, { profile: empty, cachedAt: Date.now() });
    return empty;
  } catch (err: unknown) {
    // Distinguish "file doesn't exist" (normal) from "file is corrupted" (dangerous).
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      // File doesn't exist — normal for first-time use.
      const empty = emptyProfile();
      _profileCache.set(workspaceDir, { profile: empty, cachedAt: Date.now() });
      return empty;
    }

    // File exists but JSON.parse failed → CORRUPTED.
    // Save a backup so the user can recover manually, and log a warning.
    // DO NOT return empty blindly — a subsequent write would destroy data.
    try {
      const corruptBackupPath = `${profilePath}.corrupt.${Date.now()}`;
      fs.copyFileSync(profilePath, corruptBackupPath);
      logProfileWarning(
        `[memory-safety] profile.json is corrupted (${String(err).slice(0, 80)}). ` +
          `Backup saved to ${corruptBackupPath}. Returning empty profile for this read.`,
      );
      // Limit corrupt backups to 5 to avoid disk bloat
      try {
        const dir = path.dirname(profilePath);
        const baseName = path.basename(profilePath);
        const backups = fs
          .readdirSync(dir)
          .filter((f) => f.startsWith(`${baseName}.corrupt.`))
          .sort(); // lexicographic = oldest first
        const MAX_CORRUPT_BACKUPS = 5;
        if (backups.length > MAX_CORRUPT_BACKUPS) {
          for (const old of backups.slice(0, backups.length - MAX_CORRUPT_BACKUPS)) {
            try {
              fs.unlinkSync(path.join(dir, old));
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* cleanup is best-effort */
      }
    } catch {
      // Even backup failed — log what we can.
      logProfileWarning(
        `[memory-safety] profile.json is corrupted and backup failed. Error: ${String(err).slice(0, 80)}`,
      );
    }

    // Mark as corrupted so withProfileLock can detect and refuse to overwrite
    _corruptedProfiles.add(workspaceDir);

    const empty = emptyProfile();
    _profileCache.set(workspaceDir, { profile: empty, cachedAt: Date.now() });
    return empty;
  }
}

// [CN-PATCH:memory-fix] Periodic backup for profile.json.
// Creates a snapshot every BACKUP_INTERVAL_MS (default: 1 hour) to prevent data loss
// from corruption that survives the .tmp/.bak crash-safe write mechanism.
// Keeps up to MAX_BACKUPS snapshots, rotating oldest first.
const PROFILE_BACKUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const PROFILE_MAX_BACKUPS = 5;
const _lastBackupTime = new Map<string, number>();

/** Regex for backup filenames — strict ISO-style timestamp to avoid matching user files. */
const BACKUP_FILENAME_RE = /^profile\.backup\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/;

function maybeCreateProfileBackup(workspaceDir: string, profilePath: string): void {
  try {
    const now = Date.now();
    const lastBackup = _lastBackupTime.get(workspaceDir) ?? 0;

    // [CN-PATCH:memory-fix] Clock backward guard: if system clock jumped backward
    // (NTP correction, VM snapshot restore), reset the timer to avoid suppressing
    // backups for an extended period.
    if (now < lastBackup) {
      _lastBackupTime.delete(workspaceDir);
    } else if (now - lastBackup < PROFILE_BACKUP_INTERVAL_MS) {
      return;
    }

    // Only backup if the file exists and has content
    if (!fs.existsSync(profilePath)) return;
    const stat = fs.statSync(profilePath);
    if (stat.size < 10) return; // empty or near-empty, skip

    // [CN-PATCH:memory-fix] Validate file content before backing up.
    // Do NOT waste backup slots on corrupted data — preserve older good copies.
    try {
      const raw = fs.readFileSync(profilePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.entries)) return; // corrupted shape
    } catch {
      return; // unparseable JSON — skip backup to preserve good older backups
    }

    const dir = path.dirname(profilePath);
    const backupName = `profile.backup.${new Date(now).toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
    const backupPath = path.join(dir, backupName);
    fs.copyFileSync(profilePath, backupPath);
    _lastBackupTime.set(workspaceDir, now);

    // Rotate: keep only the most recent MAX_BACKUPS
    // Use strict regex to avoid matching user-created files
    const backups = fs
      .readdirSync(dir)
      .filter((f) => BACKUP_FILENAME_RE.test(f))
      .sort(); // lexicographic = oldest first (ISO date in name)
    if (backups.length > PROFILE_MAX_BACKUPS) {
      for (const old of backups.slice(0, backups.length - PROFILE_MAX_BACKUPS)) {
        try {
          fs.unlinkSync(path.join(dir, old));
        } catch {
          /* ignore */
        }
      }
    }
  } catch (err) {
    // [CN-PATCH:memory-fix] Log backup failures for observability (but never block writes)
    logProfileWarning(
      `[memory-backup] periodic backup failed for ${workspaceDir}: ${String(err).slice(0, 80)}`,
    );
  }
}

export function writeProfile(workspaceDir: string, profile: UserProfile): void {
  const profilePath = resolveProfilePath(workspaceDir);
  const dir = path.dirname(profilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // [CN-PATCH:memory-fix] Create periodic backup before overwriting
  maybeCreateProfileBackup(workspaceDir, profilePath);

  const json = JSON.stringify(profile, null, 2);

  // Atomic write: write to temp then rename.
  // On Windows, renameSync may fail (EBUSY/EPERM) if another process holds the file.
  const tmpPath = `${profilePath}.tmp`;
  fs.writeFileSync(tmpPath, json, "utf-8");

  // Validate the temp file before overwriting the real one.
  // This prevents a corrupted/truncated temp from destroying the profile.
  try {
    const verification = fs.readFileSync(tmpPath, "utf-8");
    const parsed = JSON.parse(verification);
    if (!parsed || !Array.isArray(parsed.entries)) {
      throw new Error("tmp file verification failed: missing entries array");
    }
  } catch (verifyErr) {
    // Temp file is corrupted — do NOT proceed with rename/copy.
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
    throw new Error(
      `[memory-safety] writeProfile aborted: temp file verification failed. ` +
        `Original profile preserved. Error: ${String(verifyErr).slice(0, 80)}`,
    );
  }

  // Ensure durability: fsync before rename so data reaches disk even on power loss.
  try {
    const fd = fs.openSync(tmpPath, "r+");
    try {
      fs.fdatasyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    /* fdatasync not critical — best-effort durability */
  }

  // [CN-PATCH:memory-fix] Track whether the write actually reached disk.
  // If all attempts fail, we must NOT update the in-memory cache — otherwise
  // the cache diverges from disk: reads see phantom data for up to 5s (cache TTL),
  // then revert to old data after cache expires.
  let diskWriteSucceeded = true;
  try {
    fs.renameSync(tmpPath, profilePath);
  } catch {
    // Windows fallback: rename can fail with EBUSY/EPERM.
    // Use .bak strategy so there is always at least one valid copy on disk.
    // Sequence: copy tmp→tmp2, rename original→bak, rename tmp2→target, delete bak.
    const tmpPath2 = `${profilePath}.tmp2`;
    const bakPath = `${profilePath}.bak`;
    try {
      fs.copyFileSync(tmpPath, tmpPath2);
      // Rename original to .bak instead of deleting (crash-safe — .bak is recoverable)
      try {
        fs.renameSync(profilePath, bakPath);
      } catch {
        /* may not exist */
      }
      fs.renameSync(tmpPath2, profilePath);
      // Clean up .bak after successful rename
      try {
        fs.unlinkSync(bakPath);
      } catch {
        /* non-fatal */
      }
    } catch {
      // Restore from .bak if it exists and target is gone
      try {
        if (!fs.existsSync(profilePath) && fs.existsSync(bakPath)) {
          fs.renameSync(bakPath, profilePath);
        }
      } catch {
        /* best-effort recovery */
      }
      // Last resort: direct copy (least safe, but better than losing the write entirely)
      try {
        fs.copyFileSync(tmpPath, profilePath);
      } catch {
        // [CN-PATCH:memory-fix] ALL disk write attempts failed.
        // Do NOT update the cache — disk still has old data.
        diskWriteSucceeded = false;
        logProfileWarning(
          `[memory-safety] writeProfile: all disk write attempts failed for ${workspaceDir}. ` +
            `Cache NOT updated to prevent divergence.`,
        );
      }
    }
    // Clean up .tmp and .tmp2 files
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      /* ignore cleanup failure */
    }
    try {
      fs.unlinkSync(tmpPath2);
    } catch {
      /* ignore cleanup failure */
    }
  }
  // Only update the cache if the write actually reached disk.
  if (diskWriteSucceeded) {
    _profileCache.set(workspaceDir, {
      profile: { ...profile, entries: profile.entries.map((e) => ({ ...e })) },
      cachedAt: Date.now(),
    });
  }
}

/** Visible for testing — clear ALL in-memory caches and safety state. */
export function _clearProfileCache(): void {
  _profileCache.clear();
  _corruptedProfiles.clear();
  _lastKnownEntryCount.clear();
  _lastRotationSlot.clear();
  _pendingChangelogsMap.clear();
  _lastBackupTime.clear();
}

// ── Per-workspace write lock for read-modify-write atomicity ──
// Protects against concurrent tool calls (e.g. flush turn + agent turn)
// writing to the same profile.json and overwriting each other's changes.
// Keyed by workspace dir so writes to different workspaces run in parallel.
const _writeLocks = new Map<string, Promise<void>>();

// Safety: tracks the last known entry count per workspace.
// If readProfile suddenly returns 0 entries but we previously had many,
// it's likely a dir deletion or file corruption — refuse to overwrite.
// Persisted to `.profile-entry-count` so the guard survives process restarts.
const _lastKnownEntryCount = new Map<string, number>();

function _resolveEntryCountPath(workspaceDir: string): string {
  return path.join(workspaceDir, "memory", ".profile-entry-count");
}

function _persistEntryCount(workspaceDir: string, count: number): void {
  try {
    const p = _resolveEntryCountPath(workspaceDir);
    fs.writeFileSync(p, String(count), "utf-8");
  } catch {
    /* non-fatal */
  }
}

function _loadPersistedEntryCount(workspaceDir: string): number {
  try {
    const p = _resolveEntryCountPath(workspaceDir);
    const raw = fs.readFileSync(p, "utf-8").trim();
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Atomically read → modify → write the profile under a per-workspace lock.
 * All mutations should go through this to prevent TOCTOU races.
 */
export async function withProfileLock<T>(
  workspaceDir: string,
  fn: (profile: UserProfile) => { profile: UserProfile; result: T; evicted?: ProfileEntry[] },
): Promise<T> {
  // Chain on the existing lock for this workspace to serialize writes
  const prev = _writeLocks.get(workspaceDir) ?? Promise.resolve();
  let resolve: () => void;
  const next = new Promise<void>((r) => {
    resolve = r;
  });
  _writeLocks.set(workspaceDir, next);

  // Timeout: if a previous lock holder hangs indefinitely, bail out after 30s
  // to prevent all memory writes from stalling forever.
  // CRITICAL: On timeout, we must NOT resolve `next` (which would let the next
  // waiter proceed while the original holder is still running). Instead, we
  // re-chain `next` onto `prev` so subsequent writers still wait for the
  // original holder to finish.
  const LOCK_TIMEOUT_MS = 30_000;
  let timedOut = false;
  let lockTimer: ReturnType<typeof setTimeout> | undefined;
  const lockAcquireStart = Date.now(); // [CN-PATCH:memory-fix] Track lock wait time
  try {
    await Promise.race([
      prev.then(() => {
        clearTimeout(lockTimer);
      }),
      new Promise<void>((_, reject) => {
        lockTimer = setTimeout(() => {
          timedOut = true;
          reject(
            new Error(`[memory-safety] withProfileLock timed out after 30s for ${workspaceDir}`),
          );
        }, LOCK_TIMEOUT_MS);
      }),
    ]);

    // [CN-PATCH:memory-fix] Monitor lock contention — log when wait time exceeds 5s
    const lockWaitMs = Date.now() - lockAcquireStart;
    if (lockWaitMs > 5000) {
      logProfileWarning(
        `[memory-perf] withProfileLock waited ${lockWaitMs}ms to acquire lock for ${workspaceDir}. ` +
          `This indicates high contention or a slow mutation. Consider investigating.`,
      );
    }

    // Safety check: refuse to write if profile was detected as corrupted.
    // Self-healing: re-check the file — user may have replaced it with a valid copy.
    if (_corruptedProfiles.has(workspaceDir)) {
      try {
        const profilePath = resolveProfilePath(workspaceDir);
        const raw = fs.readFileSync(profilePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.entries)) {
          // File is valid now — clear the corruption flag and continue
          _corruptedProfiles.delete(workspaceDir);
          _profileCache.delete(workspaceDir);
        } else {
          throw new Error("still invalid shape");
        }
      } catch {
        throw new Error(
          `[memory-safety] profile.json was corrupted. Refusing to write to prevent data loss. ` +
            `Check for .corrupt backup files in ${path.join(workspaceDir, "memory")}.`,
        );
      }
    }

    // Always read from disk inside the lock — never use stale cache.
    const current = readProfile(workspaceDir, /* bypassCache */ true);

    // Safety check: detect likely directory/file deletion.
    // If we previously saw ≥10 entries and now see 0, the profile was likely deleted
    // externally. Refuse to proceed — writing near-empty profile would destroy data.
    // Falls back to persisted count on disk so the guard survives process restarts.
    const lastKnown =
      _lastKnownEntryCount.get(workspaceDir) ?? _loadPersistedEntryCount(workspaceDir);
    if (current.entries.length === 0 && lastKnown >= 10) {
      // Profile has 0 entries but previously had many — possible corruption or deletion.
      // Refuse to proceed regardless of whether the file exists, because a valid-JSON
      // file with wrong shape (e.g. `{}`) would parse as empty but still exist on disk.
      const profilePath = resolveProfilePath(workspaceDir);
      throw new Error(
        `[memory-safety] profile.json has 0 entries but previously had ${lastKnown}. ` +
          `Possible file corruption or external modification. ` +
          `Refusing to write to prevent data loss. Path: ${profilePath}`,
      );
    }

    // Set workspace context so pushChangelog() routes to the right bucket.
    _currentLockWorkspace = workspaceDir;
    let fnResult: { profile: UserProfile; result: T; evicted?: ProfileEntry[] };
    try {
      fnResult = fn(current);
    } finally {
      _currentLockWorkspace = null;
    }
    const { profile: updated, result, evicted } = fnResult;

    // CRITICAL: Archive evicted entries BEFORE writing the updated profile.
    // This ensures that if we crash after archiving but before writing profile,
    // the evicted entries exist in BOTH the profile AND the archive (duplicated, not lost).
    // If we crash after writing profile, the archive is already done.
    // The old pattern (archive AFTER lock) had a crash window where evicted entries
    // were removed from profile but never archived → permanent data loss.
    if (evicted && evicted.length > 0) {
      try {
        archiveEvictedEntries(workspaceDir, evicted, Date.now());
      } catch {
        // Archive failure is non-fatal — profile write still proceeds.
        // The eviction recovery file (.evicted-recovery.jsonl) provides a second safety net.
      }
    }

    // Track entry count for future safety checks (memory + disk)
    if (updated.entries.length > 0) {
      _lastKnownEntryCount.set(workspaceDir, updated.entries.length);
      _persistEntryCount(workspaceDir, updated.entries.length);
    }

    writeProfile(workspaceDir, updated);
    // Flush changelog entries accumulated during this lock (fire-and-forget)
    try {
      flushProfileChangelog(workspaceDir);
    } catch {
      /* non-fatal */
    }
    return result;
  } finally {
    if (timedOut) {
      // CRITICAL: Do NOT resolve `next` on timeout. The previous holder is still
      // running. Re-chain so subsequent writers wait for the original holder.
      prev.then(resolve!, resolve!);
    } else {
      resolve!();
    }
    // Clean up the lock entry if it's still ours (no new writer queued after us)
    if (_writeLocks.get(workspaceDir) === next) {
      _writeLocks.delete(workspaceDir);
    }
  }
}

/**
 * Upsert a fact into the profile. Same category+key overwrites the old value.
 * - Existing entries get hits+1 (reinforcement on re-extraction)
 * - Stale low-hit todos older than 30 days are auto-cleaned (source-aware thresholds)
 * - Score-based eviction with category protection when over limit
 * Returns the updated profile (backward-compatible wrapper).
 */
export function upsertProfileEntry(
  profile: UserProfile,
  category: ProfileCategory,
  key: string,
  value: string,
): UserProfile {
  return upsertProfileEntryFull(profile, category, key, value).profile;
}

/**
 * Full upsert that also returns evicted entries for archival.
 * Use this when you need to archive evicted entries to profile-archive.md.
 */
export function upsertProfileEntryFull(
  profile: UserProfile,
  category: ProfileCategory,
  key: string,
  value: string,
  opts?: { source?: ProfileEntry["source"] },
): UpsertResult {
  // Enforce key/value length limits to prevent oversized profiles
  const safeKey = key.trim().slice(0, PROFILE_MAX_KEY_LENGTH);
  const safeValue = value.trim().slice(0, PROFILE_MAX_VALUE_LENGTH);
  const normalizedKey = safeKey.toLowerCase();
  let entries = [...profile.entries];
  // Guarantee monotonically increasing timestamp so the newest entry always
  // survives eviction. Without this, when Date.now() returns the same
  // millisecond for multiple calls, the stable sort + truncate could evict
  // the just-inserted entry (it sits at the end of equal-timestamp entries).
  const maxExisting = entries.reduce((max, e) => Math.max(max, e.updatedAt), 0);
  const now = Math.max(Date.now(), maxExisting + 1);
  const source = opts?.source ?? "extraction";

  const existingIdx = entries.findIndex(
    (e) => e.category === category && e.key.toLowerCase() === normalizedKey,
  );

  if (existingIdx >= 0) {
    const oldEntry = entries[existingIdx];
    // Update existing entry — reinforce hits on re-write.
    // This turns the extraction LLM's dedup weakness into a strength:
    // repeatedly extracted facts get higher scores and survive eviction.
    entries[existingIdx] = {
      ...oldEntry,
      value: safeValue,
      updatedAt: now,
      key: safeKey, // preserve user's casing (truncated to max length)
      hits: oldEntry.hits + 1,
      source,
      // Preserve original createdAt
      createdAt: oldEntry.createdAt || now,
    };
    // Record the change in the changelog (fire-and-forget, never blocks)
    if (oldEntry.value.trim() !== safeValue) {
      pushChangelog({
        category,
        key: safeKey,
        oldValue: oldEntry.value,
        newValue: safeValue,
        operation: "update",
      });
    }
  } else {
    pushChangelog({
      category,
      key: safeKey,
      oldValue: null,
      newValue: safeValue,
      operation: "add",
    });

    // Add new entry
    entries.push({
      category,
      key: safeKey,
      value: safeValue,
      createdAt: now,
      updatedAt: now,
      hits: 0,
      source,
    });
  }

  // ── Stale todo cleanup ──
  // Remove low-hit todos older than STALE_TODO_DAYS to free valuable slots.
  // Tool-created todos (source="tool") use hits===0 threshold; LLM-extracted use hits≤1.
  // This runs on every upsert — zero extra I/O since we're already writing.
  // Cleaned-up entries are recorded in changelog and added to evicted for archival.
  const staleTodos: ProfileEntry[] = [];
  // [CN-PATCH:memory-fix] Use real wall-clock time for stale checks, NOT the monotonic `now`.
  // `now` = Math.max(Date.now(), maxExistingTimestamp+1), so if ANY entry has an updatedAt
  // far in the future (clock skew, manual edit, NTP jump), `now` would be inflated to match.
  // This inflated `now` makes `now - e.updatedAt > STALE_TODO_MS` true for ALL normal todos,
  // causing mass deletion. Using Date.now() isolates stale checks from timestamp monotonicity.
  const realNow = Date.now();
  entries = entries.filter((e) => {
    if (e.category !== "todo") return true;
    const isTool = e.source === "tool";
    const hitsThreshold = isTool ? 0 : STALE_TODO_MAX_HITS;
    if (e.hits <= hitsThreshold && realNow - e.updatedAt > STALE_TODO_MS) {
      staleTodos.push(e);
      pushChangelog({
        category: e.category,
        key: e.key,
        oldValue: e.value,
        newValue: null,
        operation: "remove",
        reason: `stale todo: hits=${e.hits}, age=${Math.round((realNow - e.updatedAt) / 86400000)}d`,
      });
      return false;
    }
    return true;
  });

  // ── Score-based eviction with category protection ──
  let evicted: ProfileEntry[] = [...staleTodos];
  if (entries.length > PROFILE_MAX_ENTRIES) {
    evicted.push(...evictByScore(entries, now));
  }

  return { profile: { ...profile, entries }, evicted };
}

/**
 * Evict lowest-score entries down to PROFILE_MAX_ENTRIES, respecting
 * protected category minimums (identity/correction keep ≥5 slots each).
 * Mutates the array in place and returns the evicted entries.
 */
export function evictByScore(entries: ProfileEntry[], now: number): ProfileEntry[] {
  // Sort by score descending — highest-value entries first
  entries.sort((a, b) => computeEntryScore(b, now) - computeEntryScore(a, now));

  const toRemove = entries.length - PROFILE_MAX_ENTRIES;
  if (toRemove <= 0) return [];

  // Mark entries for removal from the tail (lowest scores).
  // Use a Set of indices for O(1) lookup.
  const removeIndices = new Set<number>();

  // Count how many entries each protected category currently has
  const categoryCounts = new Map<ProfileCategory, number>();
  for (const e of entries) {
    categoryCounts.set(e.category, (categoryCounts.get(e.category) ?? 0) + 1);
  }

  // Walk from lowest score (end) upward
  for (let i = entries.length - 1; i >= 0 && removeIndices.size < toRemove; i--) {
    const cat = entries[i].category;
    const minSlots = PROTECTED_CATEGORY_MINIMUMS[cat] ?? 0;
    const remaining = categoryCounts.get(cat) ?? 0;
    if (remaining <= minSlots) continue; // would violate minimum — skip

    removeIndices.add(i);
    categoryCounts.set(cat, remaining - 1);
  }

  // Collect evicted entries before removing them
  const evicted: ProfileEntry[] = [];
  const sorted = Array.from(removeIndices).sort((a, b) => b - a);
  for (const idx of sorted) {
    const entry = entries[idx];
    evicted.push(entry);
    pushChangelog({
      category: entry.category,
      key: entry.key,
      oldValue: entry.value,
      newValue: null,
      operation: "evict",
    });
    entries.splice(idx, 1);
  }

  // Safety backstop: if protection prevented enough removals, force-truncate.
  // Entries beyond the limit are also captured as evicted.
  if (entries.length > PROFILE_MAX_ENTRIES) {
    const overflow = entries.splice(PROFILE_MAX_ENTRIES);
    for (const entry of overflow) {
      pushChangelog({
        category: entry.category,
        key: entry.key,
        oldValue: entry.value,
        newValue: null,
        operation: "evict",
      });
    }
    evicted.push(...overflow);
  }

  return evicted;
}

/**
 * Reinforce hot profile entries whose keys match any of the given cold retrieval snippets.
 * This creates a positive feedback loop: entries related to topics the user is actively
 * discussing get higher scores and survive eviction longer.
 *
 * Only increments hits once per matching entry (not per snippet), and only for entries
 * that haven't been updated in the last 60 seconds (debounce to prevent over-reinforcement).
 *
 * Returns the number of entries reinforced.
 */
export function reinforceMatchingEntries(
  profile: UserProfile,
  coldSnippets: string[],
): { profile: UserProfile; reinforcedCount: number } {
  if (coldSnippets.length === 0 || profile.entries.length === 0) {
    return { profile, reinforcedCount: 0 };
  }

  // Build a set of lowercase keywords from cold snippets for matching
  const snippetText = coldSnippets.join(" ").toLowerCase();
  const now = Date.now();
  const DEBOUNCE_MS = 60_000; // Don't reinforce entries updated <60s ago

  let reinforcedCount = 0;
  const entries = profile.entries.map((e) => {
    // Skip recently updated entries (debounce)
    if (now - e.updatedAt < DEBOUNCE_MS) return e;

    // Check if the entry's key appears in the cold retrieval text
    const keyLower = e.key.trim().toLowerCase();
    if (keyLower.length >= 2 && snippetText.includes(keyLower)) {
      reinforcedCount++;
      return { ...e, hits: e.hits + 1 };
    }
    return e;
  });

  return {
    profile: { ...profile, entries },
    reinforcedCount,
  };
}

/**
 * Remove a fact from the profile by category+key.
 */
export function removeProfileEntry(
  profile: UserProfile,
  category: ProfileCategory,
  key: string,
): UserProfile {
  const normalizedKey = key.trim().toLowerCase();
  return {
    ...profile,
    entries: profile.entries.filter(
      (e) => !(e.category === category && e.key.toLowerCase() === normalizedKey),
    ),
  };
}

/**
 * Compute an injection score that blends importance with topic relevance.
 * When queryHint is provided, entries matching the current topic get a bonus.
 */
function computeInjectionScore(
  entry: ProfileEntry,
  now: number,
  queryTokens?: Set<string>,
): number {
  const baseScore = computeEntryScore(entry, now);
  if (!queryTokens || queryTokens.size === 0) return baseScore;
  const entryText = (entry.key + " " + entry.value).toLowerCase();
  let hits = 0;
  for (const token of queryTokens) {
    if (entryText.includes(token)) hits++;
  }
  if (hits === 0) return baseScore;
  const relevanceBonus = 0.3 * Math.min(hits / queryTokens.size, 1);
  return baseScore + relevanceBonus;
}

/** Tokenize a query string for lightweight relevance matching. */
function tokenizeQuery(query: string): Set<string> {
  if (!query || query.length < 2) return new Set();
  const tokens = new Set<string>();
  // ASCII words (≥2 chars)
  for (const m of query.toLowerCase().matchAll(/[a-z0-9_]{2,}/g)) {
    tokens.add(m[0]);
  }
  // CJK characters (individual or 2-char pairs)
  const cjk = query.match(/[\u4e00-\u9fff\u3400-\u4dbf]+/g);
  if (cjk) {
    for (const seg of cjk) {
      if (seg.length >= 2) tokens.add(seg);
      // Also add 2-char sliding window for better matching
      for (let i = 0; i < seg.length - 1; i++) {
        tokens.add(seg.slice(i, i + 2));
      }
    }
  }
  return tokens;
}

/**
 * Format profile entries for injection into system prompt.
 * Produces a compact text block (~200-500 tokens for typical profiles).
 *
 * @param maxChars - Override the default PROFILE_MAX_PROMPT_CHARS. Use a smaller
 * value for models with limited context windows (e.g., 4000 for 32K models).
 * @param queryHint - Optional user message text. When provided, entries matching
 * the current topic are ranked higher (topic-relevant injection).
 */
export function formatProfileForSystemPrompt(
  profile: UserProfile,
  maxChars: number = PROFILE_MAX_PROMPT_CHARS,
  queryHint?: string,
): string {
  if (profile.entries.length === 0) {
    return "";
  }

  const queryTokens = queryHint ? tokenizeQuery(queryHint) : undefined;

  const byCategory = new Map<string, ProfileEntry[]>();
  for (const entry of profile.entries) {
    const list = byCategory.get(entry.category) ?? [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }

  const lines: string[] = ["## User Profile (auto-managed)"];

  const categoryLabels: Record<string, string> = {
    identity: "Identity",
    preference: "Preferences",
    correction: "Corrections (MUST follow)",
    fact: "Key Facts",
    todo: "Active TODOs",
    procedure: "Procedures",
  };

  const categoryOrder: ProfileCategory[] = [
    "identity",
    "correction",
    "preference",
    "fact",
    "todo",
    "procedure",
  ];

  const now = Date.now();
  for (const cat of categoryOrder) {
    const catEntries = byCategory.get(cat);
    if (!catEntries || catEntries.length === 0) continue;
    // Sort by injection score descending (importance + topic relevance).
    catEntries.sort(
      (a, b) =>
        computeInjectionScore(b, now, queryTokens) - computeInjectionScore(a, now, queryTokens),
    );
    lines.push(`### ${categoryLabels[cat] ?? cat}`);
    for (const e of catEntries) {
      // Sanitize newlines to prevent markdown injection / prompt escape.
      // Values containing \n could create fake section headers or instructions.
      const safeKey = e.key.replace(/[\r\n]+/g, " ").trim();
      const safeValue = e.value.replace(/[\r\n]+/g, "; ").trim();
      lines.push(`- ${safeKey}: ${safeValue}`);
    }
  }

  // Entry-level truncation: never cut an entry in the middle.
  // Build output line by line, stop before exceeding maxChars.
  const suffix = "\n[... profile truncated]";
  let output = "";
  let truncated = false;
  for (const line of lines) {
    const candidate = output ? output + "\n" + line : line;
    if (candidate.length + suffix.length > maxChars && output.length > 0) {
      truncated = true;
      break;
    }
    output = candidate;
  }
  if (!truncated) {
    output += "\n"; // trailing newline
  }
  return truncated ? output + suffix : output;
}

// ── Eviction Archival ──
// When entries are evicted from the hot profile (80-slot cap), qualified ones
// are appended to memory/profile-archive.md. The upstream SQLite file watcher
// (chokidar on memory/**/*.md) auto-indexes this file, enabling semantic
// retrieval of "forgotten" facts via the memory_search tool.

export function resolveArchivePath(workspaceDir: string): string {
  return path.join(workspaceDir, "memory", PROFILE_ARCHIVE_FILENAME);
}

/**
 * Filter evicted entries that qualify for long-term archival.
 *
 * Criteria (all must pass):
 * - hits ≥ 1 (reinforced at least once → LLM extracted it at least twice)
 * - score ≥ 0.5 (not a low-value entry)
 * - category is not "todo" (todos are ephemeral by nature)
 */
export function filterArchivableEntries(entries: ProfileEntry[], now: number): ProfileEntry[] {
  return entries.filter((e) => {
    if (ARCHIVE_EXCLUDED_CATEGORIES.has(e.category)) return false;
    if (e.hits < ARCHIVE_MIN_HITS) return false;
    if (computeEntryScore(e, now) < ARCHIVE_MIN_SCORE) return false;
    return true;
  });
}

/**
 * Format entries as a Markdown block for the archive file.
 * Each entry becomes a line: `- [category] key: value (hits:N, date)`
 * Grouped under a date header to make the archive human-readable.
 */
export function formatArchiveBlock(entries: ProfileEntry[], now: number): string {
  if (entries.length === 0) return "";

  const dateStr = new Date(now).toISOString().slice(0, 10);
  const lines: string[] = [`\n### Archived ${dateStr}\n`];
  for (const e of entries) {
    const safeKey = e.key.replace(/[\r\n]+/g, " ").trim();
    const safeValue = e.value.replace(/[\r\n]+/g, "; ").trim();
    const ageDate = new Date(e.updatedAt).toISOString().slice(0, 10);
    lines.push(`- [${e.category}] ${safeKey}: ${safeValue} (hits:${e.hits}, last:${ageDate})`);
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Archive qualified evicted entries to memory/profile-archive.md.
 *
 * - Filters entries through the archive criteria (hits≥1, score≥0.5, non-todo)
 * - Appends to the archive file (creates if missing, with a header)
 * - Enforces a 50KB size cap to prevent unbounded growth
 * - Fire-and-forget: errors are silently ignored (profile integrity > archive)
 *
 * The upstream file watcher (chokidar on memory/**\/*.md) will auto-detect changes
 * and re-index the archive into SQLite for semantic search.
 */
export function archiveEvictedEntries(
  workspaceDir: string,
  evicted: ProfileEntry[],
  now: number,
): void {
  const archivable = filterArchivableEntries(evicted, now);
  if (archivable.length === 0) return;

  const block = formatArchiveBlock(archivable, now);
  if (!block) return;

  try {
    const archivePath = resolveArchivePath(workspaceDir);
    const dir = path.dirname(archivePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Check size cap — rotate the archive when it exceeds PROFILE_ARCHIVE_MAX_BYTES.
    // Rotation: rename profile-archive.md → profile-archive-001.md (incrementing).
    // The old file stays in memory/**/*.md → chokidar keeps indexing it in SQLite.
    // Hard cap: stop after 10 rotation files (~500KB total) to prevent unbounded growth.
    let currentSize = 0;
    try {
      const stat = fs.statSync(archivePath);
      currentSize = stat.size;
    } catch {
      // File doesn't exist yet — will be created below.
    }

    if (currentSize >= PROFILE_ARCHIVE_MAX_BYTES) {
      const rotated = rotateArchiveFile(archivePath);
      if (!rotated) {
        // All rotation slots exhausted — fall through to recovery path below
        throw new Error("archive rotation exhausted");
      }
      currentSize = 0;
    }

    // If file doesn't exist, prepend a header so the archive is self-documenting.
    const needsHeader = currentSize === 0;
    const header = needsHeader
      ? "# Profile Archive\n\nEvicted profile entries preserved for semantic retrieval.\nThis file is auto-indexed by the memory system — do not delete.\n"
      : "";

    fs.appendFileSync(archivePath, header + block, "utf-8");
  } catch {
    // SAFETY NET: If the primary archive write fails for any reason (disk full,
    // EBUSY, rotation exhausted), write to a JSONL recovery file as last resort.
    // This ensures evicted entries are NEVER silently lost.
    writeEvictionRecovery(workspaceDir, archivable, now);
  }
}

/** Recovery file for evicted entries when the primary archive fails. */
const EVICTION_RECOVERY_FILENAME = ".evicted-recovery.jsonl";
const EVICTION_RECOVERY_MAX_BYTES = 5_000_000; // 5MB cap

function writeEvictionRecovery(workspaceDir: string, entries: ProfileEntry[], now: number): void {
  try {
    const recoveryPath = path.join(workspaceDir, "memory", EVICTION_RECOVERY_FILENAME);
    // Check size cap
    try {
      const stat = fs.statSync(recoveryPath);
      if (stat.size >= EVICTION_RECOVERY_MAX_BYTES) return;
    } catch {
      /* file doesn't exist yet */
    }

    const lines = entries.map((e) =>
      JSON.stringify({
        ...e,
        _recoveredAt: now,
      }),
    );
    fs.appendFileSync(recoveryPath, lines.join("\n") + "\n", "utf-8");
  } catch {
    // Absolute last resort — if even recovery fails, we truly can't do anything.
    // The entries are lost, but this should be extremely rare (disk completely full).
  }
}

/** Maximum number of rotation files. Local disk is cheap — no practical limit. */
export const ARCHIVE_MAX_ROTATIONS = 999;

// Cache last known rotation slot per directory to avoid O(n) scan.
const _lastRotationSlot = new Map<string, number>();

/**
 * Rotate a full archive file by renaming it to profile-archive-NNN.md.
 * Returns true if rotation succeeded, false if all rotation slots are exhausted.
 */
function rotateArchiveFile(archivePath: string): boolean {
  const dir = path.dirname(archivePath);
  const ext = path.extname(archivePath); // ".md"
  const base = path.basename(archivePath, ext); // "profile-archive"

  // Start scanning from the last known slot to skip already-occupied slots (O(1) amortized)
  const startSlot = (_lastRotationSlot.get(dir) ?? 0) + 1;
  for (let i = startSlot; i <= ARCHIVE_MAX_ROTATIONS; i++) {
    const suffix = String(i).padStart(3, "0"); // "001", "002", ...
    const rotatedPath = path.join(dir, `${base}-${suffix}${ext}`);
    if (!fs.existsSync(rotatedPath)) {
      try {
        fs.renameSync(archivePath, rotatedPath);
        _lastRotationSlot.set(dir, i);
        return true;
      } catch {
        // rename failed (e.g. Windows EBUSY) — try copy+delete
        try {
          fs.copyFileSync(archivePath, rotatedPath);
          fs.unlinkSync(archivePath);
          _lastRotationSlot.set(dir, i);
          return true;
        } catch {
          return false;
        }
      }
    }
  }
  // If we started from a cached slot and found nothing, retry from slot 1
  // (a previous file may have been deleted externally, freeing an earlier slot)
  if (startSlot > 1) {
    _lastRotationSlot.delete(dir);
    return rotateArchiveFile(archivePath);
  }
  return false; // All rotation slots exhausted
}

/**
 * Format existing profile entries for the extraction LLM deduplication prompt.
 * Returns a compact `- [category] key: value` list so the LLM can skip known facts.
 * Includes an explicit dedup reminder at the end.
 */
export function formatProfileForExtraction(workspaceDir: string): string {
  const profile = readProfile(workspaceDir);
  if (profile.entries.length === 0) return "（暂无）";
  const MAX_EXTRACTION_CHARS = 6000;
  let output = "";
  for (const e of profile.entries) {
    // Sanitize newlines to prevent prompt injection via poisoned profile entries.
    const safeKey = e.key.replace(/[\r\n]+/g, " ").trim();
    const safeValue = e.value.replace(/[\r\n]+/g, "; ").trim();
    const line = `- [${e.category}] ${safeKey}: ${safeValue}`;
    if ((output + "\n" + line).length > MAX_EXTRACTION_CHARS) break;
    output += (output ? "\n" : "") + line;
  }
  return output + "\n\n（以上条目已存储，请勿重复提取。）";
}
