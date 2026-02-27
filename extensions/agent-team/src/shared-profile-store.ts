/**
 * Shared Profile Store — Cross-agent memory pool for team projects.
 *
 * Stores shared user facts (identity, preferences, facts) that all team
 * members can read. Writes are controlled: only via memory_share tool
 * or auto-promote from high-hit private entries.
 *
 * Storage: JSON file at {projectDir}/shared-memory/profile.json
 * Concurrency: per-projectId async mutex (Promise chain).
 * Pattern mirrors src/memory/profile-store.ts (read cache, atomic write, lock).
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveProjectDir } from "./state.js";
import type { SharedCategory } from "./types.js";

// ── Types ───────────────────────────────────────────────────────────────

export interface SharedProfileEntry {
  category: SharedCategory;
  key: string;
  value: string;
  createdAt: number;
  updatedAt: number;
  hits: number;
  sourceAgentId: string;
}

export interface SharedProfile {
  version: number;
  entries: SharedProfileEntry[];
}

// ── Constants ───────────────────────────────────────────────────────────

export const SHARED_PROFILE_MAX_ENTRIES = 50;
export const SHARED_MEMORY_MAX_PROMPT_CHARS = 1500;
export const SHARED_MAX_KEY_LENGTH = 50;
export const SHARED_MAX_VALUE_LENGTH = 200;

const SHARED_MEMORY_DIR = "shared-memory";
const SHARED_PROFILE_FILENAME = "profile.json";

// Category base weights for eviction scoring (same concept as profile-store.ts)
const CATEGORY_WEIGHTS: Record<SharedCategory, number> = {
  identity: 1.0,
  preference: 0.6,
  fact: 0.5,
};

const HITS_WEIGHT = 0.15;
const HITS_DIMINISHING = 0.7;
const RECENCY_HALF_LIFE_DAYS = 14;
const RECENCY_WEIGHT = 0.3;

// ── Path Resolution ─────────────────────────────────────────────────────

export function resolveSharedProfileDir(projectId: string): string {
  return path.join(resolveProjectDir(projectId), SHARED_MEMORY_DIR);
}

function resolveSharedProfilePath(projectId: string): string {
  return path.join(resolveSharedProfileDir(projectId), SHARED_PROFILE_FILENAME);
}

// ── Scoring ─────────────────────────────────────────────────────────────

export function computeSharedEntryScore(
  entry: SharedProfileEntry,
  now: number = Date.now(),
): number {
  const categoryBase = CATEGORY_WEIGHTS[entry.category] ?? 0.5;
  const hitsContribution =
    HITS_WEIGHT * Math.pow(Math.max(entry.hits, 0), HITS_DIMINISHING);
  const ageDays = Math.max(
    0,
    (now - entry.updatedAt) / (1000 * 60 * 60 * 24),
  );
  const recencyFactor = Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
  const recencyContribution = RECENCY_WEIGHT * recencyFactor;
  return categoryBase + hitsContribution + recencyContribution;
}

// ── Read Cache ──────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5_000;
const _cache = new Map<
  string,
  { profile: SharedProfile; cachedAt: number }
>();

function emptyProfile(): SharedProfile {
  return { version: 1, entries: [] };
}

/**
 * Read shared profile from disk, or return a cached copy if fresh (<=5s).
 */
export function readSharedProfile(projectId: string): SharedProfile {
  const cached = _cache.get(projectId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return {
      ...cached.profile,
      entries: cached.profile.entries.map((e) => ({ ...e })),
    };
  }

  const filePath = resolveSharedProfilePath(projectId);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.entries)) {
      const profile = parsed as SharedProfile;
      _cache.set(projectId, { profile, cachedAt: Date.now() });
      return {
        ...profile,
        entries: profile.entries.map((e) => ({ ...e })),
      };
    }
    const empty = emptyProfile();
    _cache.set(projectId, { profile: empty, cachedAt: Date.now() });
    return empty;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      const empty = emptyProfile();
      _cache.set(projectId, { profile: empty, cachedAt: Date.now() });
      return empty;
    }
    // Corrupted file — return empty but don't cache
    console.warn(
      `[shared-profile-store] failed to read shared profile for ${projectId}: ${String(err).slice(0, 80)}`,
    );
    return emptyProfile();
  }
}

/**
 * Write shared profile to disk atomically (tmp + rename). Invalidates cache.
 */
export function writeSharedProfile(
  projectId: string,
  profile: SharedProfile,
): void {
  const filePath = resolveSharedProfilePath(projectId);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const json = JSON.stringify(profile, null, 2);
  const tmpPath = `${filePath}.${randomUUID().slice(0, 8)}.tmp`;
  fs.writeFileSync(tmpPath, json, "utf-8");

  try {
    fs.renameSync(tmpPath, filePath);
  } catch {
    // On Windows, rename can fail with EBUSY — fall back to copy + unlink.
    // Use unique tmp suffix to avoid collisions between concurrent writers.
    try {
      fs.copyFileSync(tmpPath, filePath);
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        /* ignore */
      }
    }
  }

  // Update cache with the freshly written data so subsequent reads
  // within the same lock cycle don't get stale data from the old cache.
  _cache.set(projectId, { profile, cachedAt: Date.now() });
}

// ── Async Mutex (per projectId) ─────────────────────────────────────────

const _locks = new Map<string, Promise<unknown>>();
const LOCK_TIMEOUT_MS = 30_000;

/**
 * Acquire an exclusive lock for the shared profile, read the current state,
 * call fn with it, and write back the updated profile.
 *
 * Timeout handling follows upstream profile-store.ts pattern:
 * On timeout, do NOT resolve `next` — re-chain onto `prev` so subsequent
 * writers still wait for the original holder to finish.
 */
export async function withSharedProfileLock<T>(
  projectId: string,
  fn: (profile: SharedProfile) => { profile: SharedProfile; result: T },
): Promise<T> {
  const prev = _locks.get(projectId) ?? Promise.resolve();

  let resolve!: () => void;
  const next = new Promise<void>((r) => {
    resolve = r;
  });
  _locks.set(projectId, next);

  // Wait for previous lock holder with timeout
  let timedOut = false;
  let lockTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prev.then(() => {
        clearTimeout(lockTimer);
      }),
      new Promise<void>((_, reject) => {
        lockTimer = setTimeout(() => {
          timedOut = true;
          reject(
            new Error(
              `[shared-profile-store] lock timeout for project ${projectId}`,
            ),
          );
        }, LOCK_TIMEOUT_MS);
      }),
    ]);

    const current = readSharedProfile(projectId);
    const { profile: updated, result } = fn(current);
    writeSharedProfile(projectId, updated);
    return result;
  } finally {
    if (timedOut) {
      // CRITICAL: Do NOT resolve `next` on timeout. The previous holder
      // may still be running. Re-chain so subsequent writers wait for it.
      prev.then(resolve, resolve);
    } else {
      resolve();
    }
    // Clean up the lock entry if it's still ours
    if (_locks.get(projectId) === next) {
      _locks.delete(projectId);
    }
  }
}

// ── Upsert ──────────────────────────────────────────────────────────────

/**
 * Upsert an entry into the shared profile.
 * Same category+key → update value and increment hits.
 * New entry → append. Over limit → evict lowest-score entries.
 */
export function upsertSharedEntry(
  profile: SharedProfile,
  entry: {
    category: SharedCategory;
    key: string;
    value: string;
    sourceAgentId: string;
  },
): SharedProfile {
  const now = Date.now();
  const sanitizedKey = sanitizeSharedKey(entry.key);
  const sanitizedValue = sanitizeCrossAgentValue(entry.value);
  const entries = [...profile.entries];

  const existingIdx = entries.findIndex(
    (e) => e.category === entry.category && e.key === sanitizedKey,
  );

  if (existingIdx >= 0) {
    // Update existing entry
    const existing = entries[existingIdx];
    entries[existingIdx] = {
      ...existing,
      value: sanitizedValue,
      updatedAt: now,
      hits: existing.hits + 1,
      sourceAgentId: entry.sourceAgentId,
    };
  } else {
    // New entry
    entries.push({
      category: entry.category,
      key: sanitizedKey,
      value: sanitizedValue,
      createdAt: now,
      updatedAt: now,
      hits: 1,
      sourceAgentId: entry.sourceAgentId,
    });
  }

  // Evict if over limit
  if (entries.length > SHARED_PROFILE_MAX_ENTRIES) {
    entries.sort((a, b) => computeSharedEntryScore(b, now) - computeSharedEntryScore(a, now));
    entries.length = SHARED_PROFILE_MAX_ENTRIES;
  }

  return { version: profile.version, entries };
}

// ── Formatting ──────────────────────────────────────────────────────────

/**
 * Format shared profile entries for system prompt injection.
 * Groups by category, shows source agent, respects maxChars budget.
 */
export function formatSharedProfileForPrompt(
  profile: SharedProfile,
  maxChars: number = SHARED_MEMORY_MAX_PROMPT_CHARS,
  excludeAgentId?: string,
): string {
  const eligible = excludeAgentId
    ? profile.entries.filter((e) => e.sourceAgentId !== excludeAgentId)
    : profile.entries;

  if (eligible.length === 0) return "";

  // Sort by score descending
  const sorted = [...eligible].sort(
    (a, b) => computeSharedEntryScore(b) - computeSharedEntryScore(a),
  );

  const categoryOrder: SharedCategory[] = ["identity", "fact", "preference"];
  const categoryLabels: Record<SharedCategory, string> = {
    identity: "Identity",
    fact: "Facts",
    preference: "Preferences",
  };

  const lines: string[] = ["## Team Shared Knowledge"];
  let charCount = lines[0].length;

  for (const cat of categoryOrder) {
    const catEntries = sorted.filter((e) => e.category === cat);
    if (catEntries.length === 0) continue;

    const header = `### ${categoryLabels[cat]}`;
    if (charCount + header.length + 1 > maxChars) break;

    // Collect entries that fit within budget before committing the header
    const entryLines: string[] = [];
    let entryChars = 0;
    for (const entry of catEntries) {
      const line = `- ${entry.key}: ${entry.value} (from @${entry.sourceAgentId})`;
      if (charCount + header.length + 1 + entryChars + line.length + 1 > maxChars) break;
      entryLines.push(line);
      entryChars += line.length + 1;
    }

    // Only add header if we have at least one entry
    if (entryLines.length === 0) continue;
    lines.push(header);
    charCount += header.length + 1;
    for (const el of entryLines) {
      lines.push(el);
      charCount += el.length + 1;
    }
  }

  // Only return content if we have more than just the header
  return lines.length > 1 ? lines.join("\n") : "";
}

// ── Sanitization ────────────────────────────────────────────────────────

/**
 * Sanitize a value before writing to the shared memory pool.
 * Strips injection patterns, XML tags, markdown headers, and caps length.
 */
export function sanitizeCrossAgentValue(value: string): string {
  let s = value
    // Normalize newlines to spaces
    .replace(/[\r\n]+/g, " ")
    // Strip XML-like tags that could manipulate prompt structure
    .replace(
      /<\/?(?:system|instructions?|prompt|context|role|assistant|user|human|claude)\b[^>]*>/gi,
      "",
    )
    // Strip common prompt injection patterns (EN)
    // Use [\s\w]* between groups to catch "forget all prior rules" and similar multi-word bypasses
    .replace(
      /(?:ignore|forget|disregard|override)\s+[\s\w]*?(?:previous|above|all|prior|every)\s+[\s\w]*?(?:instructions?|rules?|context|prompts?|guidelines?|constraints?)/gi,
      "[FILTERED]",
    )
    // Strip role-switching patterns (EN)
    .replace(
      /(?:you are now|act as|pretend to be|new instructions?:)/gi,
      "[FILTERED]",
    )
    // Strip common prompt injection patterns (CN)
    .replace(/(?:忽略|无视|覆盖).*(?:指令|规则|提示|上下文)/gi, "[FILTERED]")
    .replace(/(?:你现在是|扮演|假装)/gi, "[FILTERED]")
    // Strip markdown headers (could override sections)
    .replace(/^#{1,6}\s+/gm, "")
    .trim();

  // Hard cap at SHARED_MAX_VALUE_LENGTH
  if (s.length > SHARED_MAX_VALUE_LENGTH) {
    s = s.slice(0, SHARED_MAX_VALUE_LENGTH);
  }
  return s;
}

/**
 * Sanitize a key string for the shared memory pool.
 * Keys must be single-line, no special characters that could break prompt format.
 */
export function sanitizeSharedKey(key: string): string {
  return key
    .replace(/[\r\n\t]+/g, "_")
    .replace(/[#<>[\]{}`]/g, "")
    .trim()
    .slice(0, SHARED_MAX_KEY_LENGTH);
}

// ── Testing Helpers ─────────────────────────────────────────────────────

/**
 * Reset the read cache (for testing).
 */
export function resetSharedProfileCache(): void {
  _cache.clear();
}

/**
 * Reset all locks (for testing).
 */
export function resetSharedProfileLocks(): void {
  _locks.clear();
}
