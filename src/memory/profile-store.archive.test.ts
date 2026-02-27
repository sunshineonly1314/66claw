/**
 * Unit tests for the eviction archival system in profile-store.
 *
 * Tests cover:
 * - filterArchivableEntries: archive criteria (hits, score, category)
 * - formatArchiveBlock: Markdown formatting
 * - archiveEvictedEntries: file creation, append, size cap
 * - evictByScore: returns evicted entries
 * - upsertProfileEntryFull: end-to-end eviction + archive integration
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  filterArchivableEntries,
  formatArchiveBlock,
  archiveEvictedEntries,
  resolveArchivePath,
  evictByScore,
  upsertProfileEntryFull,
  computeEntryScore,
  PROFILE_MAX_ENTRIES,
  PROFILE_ARCHIVE_MAX_BYTES,
  PROFILE_ARCHIVE_FILENAME,
  ARCHIVE_MAX_ROTATIONS,
  type ProfileEntry,
  type UserProfile,
} from "./profile-store.js";

// ── Helpers ──

function makeEntry(overrides: Partial<ProfileEntry> = {}): ProfileEntry {
  return {
    category: "fact",
    key: "test-key",
    value: "test-value",
    updatedAt: Date.now(),
    hits: 0,
    ...overrides,
  };
}

function makeProfile(entries: ProfileEntry[]): UserProfile {
  return { version: 1, entries };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "profile-archive-test-"));
});

afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore cleanup errors */
  }
});

// ── filterArchivableEntries ──

describe("filterArchivableEntries", () => {
  const now = Date.now();

  it("should accept entries with hits >= 1 and score >= 0.5", () => {
    const entries: ProfileEntry[] = [
      makeEntry({
        category: "preference",
        key: "lang",
        value: "TypeScript",
        hits: 2,
        updatedAt: now,
      }),
      makeEntry({ category: "fact", key: "project", value: "ClawdBot", hits: 1, updatedAt: now }),
    ];

    const result = filterArchivableEntries(entries, now);
    expect(result.length).toBe(2);
  });

  it("should reject entries with hits === 0 (never reinforced)", () => {
    const entries: ProfileEntry[] = [
      makeEntry({ category: "fact", key: "one-shot", value: "seen once", hits: 0, updatedAt: now }),
    ];

    const result = filterArchivableEntries(entries, now);
    expect(result.length).toBe(0);
  });

  it("should reject todo entries regardless of hits/score", () => {
    const entries: ProfileEntry[] = [
      makeEntry({ category: "todo", key: "task", value: "do something", hits: 10, updatedAt: now }),
    ];

    const result = filterArchivableEntries(entries, now);
    expect(result.length).toBe(0);
  });

  it("should reject entries with score below threshold", () => {
    // A very old entry with minimal hits — score should be low
    const veryOld = now - 365 * 24 * 60 * 60 * 1000;
    const entries: ProfileEntry[] = [
      makeEntry({
        category: "todo",
        key: "old-todo",
        value: "ancient",
        hits: 1,
        updatedAt: veryOld,
      }),
    ];

    // Todo is excluded by category, but let's test a fact with very low score
    const lowScoreEntry = makeEntry({
      category: "fact",
      key: "stale",
      value: "stale fact",
      hits: 1,
      updatedAt: veryOld,
    });
    // Check if its score is < 0.5 (fact base = 0.5, so with some hits+recency it might pass)
    const score = computeEntryScore(lowScoreEntry, now);
    if (score < 0.5) {
      expect(filterArchivableEntries([lowScoreEntry], now).length).toBe(0);
    } else {
      // Even old facts with 1 hit might pass due to base weight
      expect(filterArchivableEntries([lowScoreEntry], now).length).toBe(1);
    }
  });

  it("should accept identity and correction entries with sufficient hits", () => {
    const entries: ProfileEntry[] = [
      makeEntry({ category: "identity", key: "name", value: "Zhang San", hits: 3, updatedAt: now }),
      makeEntry({
        category: "correction",
        key: "no-npm",
        value: "use pnpm",
        hits: 1,
        updatedAt: now,
      }),
    ];

    const result = filterArchivableEntries(entries, now);
    expect(result.length).toBe(2);
  });
});

// ── formatArchiveBlock ──

describe("formatArchiveBlock", () => {
  const now = Date.now();

  it("should return empty string for empty array", () => {
    expect(formatArchiveBlock([], now)).toBe("");
  });

  it("should format entries with date header", () => {
    const entries: ProfileEntry[] = [
      makeEntry({
        category: "preference",
        key: "theme",
        value: "dark mode",
        hits: 2,
        updatedAt: now,
      }),
    ];

    const block = formatArchiveBlock(entries, now);
    const dateStr = new Date(now).toISOString().slice(0, 10);

    expect(block).toContain(`### Archived ${dateStr}`);
    expect(block).toContain("- [preference] theme: dark mode (hits:2,");
  });

  it("should sanitize newlines in key and value", () => {
    const entries: ProfileEntry[] = [
      makeEntry({
        category: "fact",
        key: "multi\nline\nkey",
        value: "multi\nline\nvalue",
        hits: 1,
        updatedAt: now,
      }),
    ];

    const block = formatArchiveBlock(entries, now);
    expect(block).not.toContain("\nline\n");
    expect(block).toContain("multi line key");
    expect(block).toContain("multi; line; value");
  });

  it("should include hits and last-updated date", () => {
    const specificDate = new Date("2026-01-15T12:00:00Z").getTime();
    const entries: ProfileEntry[] = [
      makeEntry({ category: "fact", key: "k", value: "v", hits: 5, updatedAt: specificDate }),
    ];

    const block = formatArchiveBlock(entries, now);
    expect(block).toContain("hits:5");
    expect(block).toContain("last:2026-01-15");
  });
});

// ── archiveEvictedEntries ──

describe("archiveEvictedEntries", () => {
  const now = Date.now();

  it("should create archive file with header on first write", () => {
    const entries: ProfileEntry[] = [
      makeEntry({ category: "preference", key: "lang", value: "TS", hits: 2, updatedAt: now }),
    ];

    archiveEvictedEntries(tmpDir, entries, now);

    const archivePath = resolveArchivePath(tmpDir);
    expect(fs.existsSync(archivePath)).toBe(true);

    const content = fs.readFileSync(archivePath, "utf-8");
    expect(content).toContain("# Profile Archive");
    expect(content).toContain("auto-indexed by the memory system");
    expect(content).toContain("[preference] lang: TS");
  });

  it("should append to existing archive without duplicate header", () => {
    const entries1: ProfileEntry[] = [
      makeEntry({ category: "fact", key: "a", value: "val-a", hits: 1, updatedAt: now }),
    ];
    const entries2: ProfileEntry[] = [
      makeEntry({ category: "fact", key: "b", value: "val-b", hits: 1, updatedAt: now }),
    ];

    archiveEvictedEntries(tmpDir, entries1, now);
    archiveEvictedEntries(tmpDir, entries2, now + 1000);

    const content = fs.readFileSync(resolveArchivePath(tmpDir), "utf-8");
    // Header should appear only once
    const headerCount = (content.match(/# Profile Archive/g) || []).length;
    expect(headerCount).toBe(1);

    // Both entries should be present
    expect(content).toContain("val-a");
    expect(content).toContain("val-b");
  });

  it("should skip entries that don't pass archive criteria", () => {
    const entries: ProfileEntry[] = [
      // hits=0 → should NOT be archived
      makeEntry({ category: "fact", key: "no-hits", value: "junk", hits: 0, updatedAt: now }),
      // todo → should NOT be archived
      makeEntry({ category: "todo", key: "task", value: "do it", hits: 5, updatedAt: now }),
      // hits=1, preference → SHOULD be archived
      makeEntry({ category: "preference", key: "good", value: "keeper", hits: 1, updatedAt: now }),
    ];

    archiveEvictedEntries(tmpDir, entries, now);

    const content = fs.readFileSync(resolveArchivePath(tmpDir), "utf-8");
    expect(content).not.toContain("no-hits");
    expect(content).not.toContain("do it");
    expect(content).toContain("keeper");
  });

  it("should do nothing when all entries are filtered out", () => {
    const entries: ProfileEntry[] = [
      makeEntry({ category: "todo", key: "t", value: "v", hits: 5, updatedAt: now }),
      makeEntry({ category: "fact", key: "f", value: "v", hits: 0, updatedAt: now }),
    ];

    archiveEvictedEntries(tmpDir, entries, now);

    const archivePath = resolveArchivePath(tmpDir);
    expect(fs.existsSync(archivePath)).toBe(false);
  });

  it("should rotate archive when it reaches size cap", () => {
    // Pre-create an archive file that's at the size limit
    const archivePath = resolveArchivePath(tmpDir);
    const memDir = path.dirname(archivePath);
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(archivePath, "x".repeat(PROFILE_ARCHIVE_MAX_BYTES), "utf-8");

    const entries: ProfileEntry[] = [
      makeEntry({ category: "preference", key: "k", value: "v", hits: 5, updatedAt: now }),
    ];

    archiveEvictedEntries(tmpDir, entries, now);

    // Old file should have been rotated to profile-archive-001.md
    const rotatedPath = path.join(memDir, "profile-archive-001.md");
    expect(fs.existsSync(rotatedPath)).toBe(true);
    expect(fs.statSync(rotatedPath).size).toBe(PROFILE_ARCHIVE_MAX_BYTES);

    // New archive file should exist with the new entry
    expect(fs.existsSync(archivePath)).toBe(true);
    const newContent = fs.readFileSync(archivePath, "utf-8");
    expect(newContent).toContain("[preference]");
    expect(newContent).toContain("k: v");
  });

  it("should stop writing when all rotation slots are exhausted", () => {
    const archivePath = resolveArchivePath(tmpDir);
    const memDir = path.dirname(archivePath);
    fs.mkdirSync(memDir, { recursive: true });

    // Fill the main archive and all rotation slots (ARCHIVE_MAX_ROTATIONS)
    fs.writeFileSync(archivePath, "x".repeat(PROFILE_ARCHIVE_MAX_BYTES), "utf-8");
    for (let i = 1; i <= ARCHIVE_MAX_ROTATIONS; i++) {
      const suffix = String(i).padStart(3, "0");
      fs.writeFileSync(path.join(memDir, `profile-archive-${suffix}.md`), "filled", "utf-8");
    }

    const beforeSize = fs.statSync(archivePath).size;

    const entries: ProfileEntry[] = [
      makeEntry({ category: "preference", key: "k", value: "v", hits: 5, updatedAt: now }),
    ];

    archiveEvictedEntries(tmpDir, entries, now);

    // Archive file should not have changed — all slots full
    expect(fs.statSync(archivePath).size).toBe(beforeSize);
  });

  it("should create memory/ directory if it does not exist", () => {
    const freshDir = fs.mkdtempSync(path.join(os.tmpdir(), "archive-fresh-"));
    try {
      const entries: ProfileEntry[] = [
        makeEntry({ category: "fact", key: "k", value: "v", hits: 1, updatedAt: now }),
      ];

      archiveEvictedEntries(freshDir, entries, now);

      expect(fs.existsSync(path.join(freshDir, "memory"))).toBe(true);
      expect(fs.existsSync(resolveArchivePath(freshDir))).toBe(true);
    } finally {
      fs.rmSync(freshDir, { recursive: true, force: true });
    }
  });
});

// ── evictByScore returns evicted entries ──

describe("evictByScore - returns evicted entries", () => {
  it("should return the evicted entries", () => {
    const now = Date.now();
    const entries: ProfileEntry[] = [];

    // Add an identity entry (high score, should survive)
    entries.push(
      makeEntry({
        category: "identity",
        key: "name",
        value: "User",
        hits: 5,
        updatedAt: now,
      }),
    );

    // Fill with low-value todos
    for (let i = 0; i < PROFILE_MAX_ENTRIES; i++) {
      entries.push(
        makeEntry({
          category: "todo",
          key: `todo-${i}`,
          value: `task ${i}`,
          hits: 0,
          updatedAt: now - i * 1000,
        }),
      );
    }

    expect(entries.length).toBe(PROFILE_MAX_ENTRIES + 1);
    const evicted = evictByScore(entries, now);

    expect(entries.length).toBe(PROFILE_MAX_ENTRIES);
    expect(evicted.length).toBe(1);
    // The evicted entry should be a low-score todo
    expect(evicted[0].category).toBe("todo");
  });

  it("should return empty array when no eviction needed", () => {
    const entries: ProfileEntry[] = [
      makeEntry({ category: "fact", key: "a", value: "v", hits: 0 }),
    ];

    const evicted = evictByScore(entries, Date.now());
    expect(evicted.length).toBe(0);
    expect(entries.length).toBe(1);
  });
});

// ── upsertProfileEntryFull end-to-end ──

describe("upsertProfileEntryFull - eviction archival integration", () => {
  it("should return evicted entries when over capacity", () => {
    const now = Date.now();
    const entries: ProfileEntry[] = [];

    // Fill to capacity
    for (let i = 0; i < PROFILE_MAX_ENTRIES; i++) {
      entries.push(
        makeEntry({
          category: "fact",
          key: `fact-${i}`,
          value: `value ${i}`,
          updatedAt: now - i * 60_000,
          hits: 0,
        }),
      );
    }

    const profile = makeProfile(entries);
    const result = upsertProfileEntryFull(profile, "preference", "new-pref", "important");

    expect(result.profile.entries.length).toBeLessThanOrEqual(PROFILE_MAX_ENTRIES);
    expect(result.evicted.length).toBeGreaterThan(0);
    // The new entry should be in the profile
    expect(result.profile.entries.find((e) => e.key === "new-pref")).toBeDefined();
  });

  it("should return empty evicted when under capacity", () => {
    const profile = makeProfile([makeEntry({ category: "fact", key: "a", value: "v", hits: 0 })]);

    const result = upsertProfileEntryFull(profile, "fact", "b", "v2");

    expect(result.profile.entries.length).toBe(2);
    expect(result.evicted.length).toBe(0);
  });

  it("backward-compatible upsertProfileEntry should still work", async () => {
    // Dynamic import to get the wrapper
    const { upsertProfileEntry } = await import("./profile-store.js");

    const profile = makeProfile([]);
    const updated = upsertProfileEntry(profile, "fact", "k", "v");

    // Returns UserProfile, not UpsertResult
    expect(updated.version).toBe(1);
    expect(updated.entries.length).toBe(1);
    expect(updated.entries[0].key).toBe("k");
  });
});

// ── resolveArchivePath ──

describe("resolveArchivePath", () => {
  it("should resolve to memory/profile-archive.md", () => {
    const result = resolveArchivePath("/workspace");
    expect(result).toContain("memory");
    expect(result).toContain(PROFILE_ARCHIVE_FILENAME);
  });
});
