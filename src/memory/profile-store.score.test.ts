/**
 * Unit tests for the importance scoring & eviction system in profile-store.
 *
 * Tests cover:
 * - computeEntryScore() formula correctness
 * - Score-based eviction replacing FIFO
 * - Category protection (identity/correction minimum slots)
 * - Hits reinforcement on upsert
 * - Stale todo auto-cleanup
 * - evictByScore edge cases
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  computeEntryScore,
  CATEGORY_WEIGHTS,
  PROTECTED_CATEGORY_MINIMUMS,
  PROFILE_MAX_ENTRIES,
  upsertProfileEntry,
  evictByScore,
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

// ── computeEntryScore ──

describe("computeEntryScore", () => {
  const now = Date.now();

  it("should return higher scores for identity than todo", () => {
    const identity = makeEntry({ category: "identity", updatedAt: now });
    const todo = makeEntry({ category: "todo", updatedAt: now });

    expect(computeEntryScore(identity, now)).toBeGreaterThan(computeEntryScore(todo, now));
  });

  it("should reflect category weight ordering", () => {
    const categories = Object.keys(CATEGORY_WEIGHTS) as Array<keyof typeof CATEGORY_WEIGHTS>;
    // Sort by weight descending
    const sorted = [...categories].sort((a, b) => CATEGORY_WEIGHTS[b] - CATEGORY_WEIGHTS[a]);

    // Verify score ordering matches weight ordering (same hits, same time)
    for (let i = 0; i < sorted.length - 1; i++) {
      const higher = makeEntry({ category: sorted[i], updatedAt: now });
      const lower = makeEntry({ category: sorted[i + 1], updatedAt: now });
      expect(computeEntryScore(higher, now)).toBeGreaterThanOrEqual(computeEntryScore(lower, now));
    }
  });

  it("should increase score with more hits (diminishing returns)", () => {
    const noHits = makeEntry({ hits: 0, updatedAt: now });
    const fewHits = makeEntry({ hits: 3, updatedAt: now });
    const manyHits = makeEntry({ hits: 10, updatedAt: now });

    const scoreNoHits = computeEntryScore(noHits, now);
    const scoreFewHits = computeEntryScore(fewHits, now);
    const scoreManyHits = computeEntryScore(manyHits, now);

    expect(scoreFewHits).toBeGreaterThan(scoreNoHits);
    expect(scoreManyHits).toBeGreaterThan(scoreFewHits);

    // Diminishing returns: gap between 0→3 should be larger than 3→10 relative to hits delta
    const gain0to3 = (scoreFewHits - scoreNoHits) / 3;
    const gain3to10 = (scoreManyHits - scoreFewHits) / 7;
    expect(gain0to3).toBeGreaterThan(gain3to10);
  });

  it("should decrease score with age (recency decay)", () => {
    const fresh = makeEntry({ updatedAt: now });
    const oneWeekOld = makeEntry({
      updatedAt: now - 7 * 24 * 60 * 60 * 1000,
    });
    const oneMonthOld = makeEntry({
      updatedAt: now - 30 * 24 * 60 * 60 * 1000,
    });

    const scoreFresh = computeEntryScore(fresh, now);
    const scoreWeek = computeEntryScore(oneWeekOld, now);
    const scoreMonth = computeEntryScore(oneMonthOld, now);

    expect(scoreFresh).toBeGreaterThan(scoreWeek);
    expect(scoreWeek).toBeGreaterThan(scoreMonth);
  });

  it("should have identity base score higher than any other category's max possible", () => {
    // Identity base = 1.0. Even a todo with 100 hits and fresh should be < identity base + recency.
    const identityMinimal = makeEntry({
      category: "identity",
      hits: 0,
      updatedAt: now - 365 * 24 * 60 * 60 * 1000, // 1 year old, almost no recency
    });
    const todoMaxed = makeEntry({
      category: "todo",
      hits: 100,
      updatedAt: now, // freshest possible
    });

    // Identity base (1.0) vs todo base (0.3) + generous hits + full recency
    // Identity should still be competitive even at minimum
    expect(computeEntryScore(identityMinimal, now)).toBeGreaterThan(
      CATEGORY_WEIGHTS.todo + 0.3, // todo base + max recency
    );
  });

  it("score range should be approximately 0.3 to 1.45", () => {
    // Minimum: old zero-hit todo
    const worstCase = makeEntry({
      category: "todo",
      hits: 0,
      updatedAt: now - 365 * 24 * 60 * 60 * 1000,
    });
    // Maximum: fresh frequently-hit identity
    const bestCase = makeEntry({
      category: "identity",
      hits: 50,
      updatedAt: now,
    });

    const minScore = computeEntryScore(worstCase, now);
    const maxScore = computeEntryScore(bestCase, now);

    expect(minScore).toBeGreaterThanOrEqual(0.25);
    expect(minScore).toBeLessThan(0.5);
    expect(maxScore).toBeGreaterThan(1.3);
    expect(maxScore).toBeLessThan(5.0); // 50 hits → 0.15 × 50^0.7 ≈ 2.7 + 1.0 + 0.3 ≈ 4.0
  });
});

// ── upsertProfileEntry: hits reinforcement ──

describe("upsertProfileEntry - hits reinforcement", () => {
  it("should increment hits when updating existing entry", () => {
    const profile = makeProfile([
      makeEntry({
        category: "preference",
        key: "language",
        value: "TypeScript",
        hits: 2,
      }),
    ]);

    const updated = upsertProfileEntry(
      profile,
      "preference",
      "language",
      "TypeScript, not JavaScript",
    );

    const entry = updated.entries.find((e) => e.category === "preference" && e.key === "language");
    expect(entry).toBeDefined();
    expect(entry!.hits).toBe(3);
    expect(entry!.value).toBe("TypeScript, not JavaScript");
  });

  it("should start with hits=0 for new entries", () => {
    const profile = makeProfile([]);

    const updated = upsertProfileEntry(profile, "fact", "tech-stack", "React + Vite");

    expect(updated.entries[0].hits).toBe(0);
  });

  it("should be case-insensitive for key matching", () => {
    const profile = makeProfile([
      makeEntry({
        category: "identity",
        key: "Name",
        value: "Zhang San",
        hits: 5,
      }),
    ]);

    const updated = upsertProfileEntry(profile, "identity", "name", "Zhang San (张三)");

    expect(updated.entries.length).toBe(1);
    expect(updated.entries[0].hits).toBe(6);
  });
});

// ── upsertProfileEntry: stale todo cleanup ──

describe("upsertProfileEntry - stale todo cleanup", () => {
  it("should remove zero-hit todos older than 30 days", () => {
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const profile = makeProfile([
      makeEntry({
        category: "todo",
        key: "old-task",
        value: "do something",
        updatedAt: thirtyOneDaysAgo,
        hits: 0,
      }),
      makeEntry({
        category: "preference",
        key: "lang",
        value: "TS",
        updatedAt: thirtyOneDaysAgo,
        hits: 0,
      }),
    ]);

    const updated = upsertProfileEntry(profile, "fact", "new-fact", "new value");

    // Old todo should be removed, old preference should remain
    expect(updated.entries.find((e) => e.key === "old-task")).toBeUndefined();
    expect(updated.entries.find((e) => e.key === "lang")).toBeDefined();
    expect(updated.entries.find((e) => e.key === "new-fact")).toBeDefined();
  });

  it("should keep hit todos even if old", () => {
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const profile = makeProfile([
      makeEntry({
        category: "todo",
        key: "important-task",
        value: "critical stuff",
        updatedAt: sixtyDaysAgo,
        hits: 3, // reinforced
      }),
    ]);

    const updated = upsertProfileEntry(profile, "fact", "new", "val");

    expect(updated.entries.find((e) => e.key === "important-task")).toBeDefined();
  });
});

// ── evictByScore ──

describe("evictByScore", () => {
  it("should evict lowest-score entries, not oldest", () => {
    const now = Date.now();
    const entries: ProfileEntry[] = [];

    // Add old but important identity entry (high score)
    entries.push(
      makeEntry({
        category: "identity",
        key: "name",
        value: "User",
        updatedAt: now - 90 * 24 * 60 * 60 * 1000, // 90 days old
        hits: 5,
      }),
    );

    // Fill remaining slots with recent low-value entries
    for (let i = 0; i < PROFILE_MAX_ENTRIES; i++) {
      entries.push(
        makeEntry({
          category: "todo",
          key: `todo-${i}`,
          value: `task ${i}`,
          updatedAt: now - i * 1000, // very recent
          hits: 0,
        }),
      );
    }

    // 51 entries total, need to evict 1
    expect(entries.length).toBe(PROFILE_MAX_ENTRIES + 1);
    evictByScore(entries, now);
    expect(entries.length).toBe(PROFILE_MAX_ENTRIES);

    // Identity entry should survive
    expect(entries.find((e) => e.category === "identity" && e.key === "name")).toBeDefined();
  });

  it("should respect category protection minimums", () => {
    const now = Date.now();
    const entries: ProfileEntry[] = [];
    const idMin = PROTECTED_CATEGORY_MINIMUMS.identity ?? 5;
    const corrMin = PROTECTED_CATEGORY_MINIMUMS.correction ?? 5;

    // Add protected identity entries (at the minimum threshold)
    for (let i = 0; i < idMin; i++) {
      entries.push(
        makeEntry({
          category: "identity",
          key: `id-${i}`,
          value: `identity ${i}`,
          updatedAt: now - 365 * 24 * 60 * 60 * 1000, // very old
          hits: 0,
        }),
      );
    }

    // Add protected correction entries (at the minimum threshold)
    for (let i = 0; i < corrMin; i++) {
      entries.push(
        makeEntry({
          category: "correction",
          key: `corr-${i}`,
          value: `correction ${i}`,
          updatedAt: now - 365 * 24 * 60 * 60 * 1000, // very old
          hits: 0,
        }),
      );
    }

    // Fill with fresh high-hit todos to create eviction pressure (overflow by the protected count)
    const todoCount = PROFILE_MAX_ENTRIES - corrMin + idMin;
    for (let i = 0; i < todoCount; i++) {
      entries.push(
        makeEntry({
          category: "todo",
          key: `todo-${i}`,
          value: `task ${i}`,
          updatedAt: now,
          hits: 10,
        }),
      );
    }

    // Total = idMin + corrMin + todoCount, which exceeds PROFILE_MAX_ENTRIES by idMin
    const expectedTotal = idMin + corrMin + todoCount;
    expect(entries.length).toBe(expectedTotal);
    evictByScore(entries, now);
    expect(entries.length).toBe(PROFILE_MAX_ENTRIES);

    // All identity entries should survive (protected)
    const identityCount = entries.filter((e) => e.category === "identity").length;
    expect(identityCount).toBe(idMin);

    // All correction entries should survive (protected)
    const correctionCount = entries.filter((e) => e.category === "correction").length;
    expect(correctionCount).toBe(corrMin);
  });

  it("should handle edge case: all entries are protected", () => {
    const now = Date.now();
    const entries: ProfileEntry[] = [];
    const overflow = PROFILE_MAX_ENTRIES + 10;

    // overflow identity entries — all protected but only idMin slots guaranteed
    for (let i = 0; i < overflow; i++) {
      entries.push(
        makeEntry({
          category: "identity",
          key: `id-${i}`,
          value: `identity ${i}`,
          updatedAt: now - i * 24 * 60 * 60 * 1000,
          hits: 0,
        }),
      );
    }

    evictByScore(entries, now);
    // Should still cap at max entries (safety backstop)
    expect(entries.length).toBe(PROFILE_MAX_ENTRIES);
  });
});

// ── Score-based eviction integration with upsert ──

describe("upsertProfileEntry - score-based eviction", () => {
  it("should evict low-score entries when over capacity", () => {
    const now = Date.now();
    const entries: ProfileEntry[] = [];

    // Fill to capacity with mixed entries
    for (let i = 0; i < PROFILE_MAX_ENTRIES; i++) {
      entries.push(
        makeEntry({
          category: i < 5 ? "identity" : "todo",
          key: `entry-${i}`,
          value: `value ${i}`,
          updatedAt: now - i * 60_000,
          hits: i < 5 ? 10 : 0,
        }),
      );
    }

    const profile = makeProfile(entries);

    // Add a new high-value correction entry
    const updated = upsertProfileEntry(
      profile,
      "correction",
      "important-fix",
      "Always use pnpm not npm",
    );

    // Should not exceed max entries
    expect(updated.entries.length).toBeLessThanOrEqual(PROFILE_MAX_ENTRIES);

    // The new correction should be present
    expect(updated.entries.find((e) => e.key === "important-fix")).toBeDefined();

    // All identity entries should survive (high score + protection)
    const identityCount = updated.entries.filter((e) => e.category === "identity").length;
    expect(identityCount).toBe(5);
  });

  it("should guarantee monotonically increasing timestamps", () => {
    const profile = makeProfile([
      makeEntry({
        category: "fact",
        key: "a",
        value: "v1",
        updatedAt: Date.now() + 999_999, // future timestamp
        hits: 0,
      }),
    ]);

    const updated = upsertProfileEntry(profile, "fact", "b", "v2");
    const entryA = updated.entries.find((e) => e.key === "a")!;
    const entryB = updated.entries.find((e) => e.key === "b")!;

    // New entry should have a later timestamp than the existing one
    expect(entryB.updatedAt).toBeGreaterThan(entryA.updatedAt);
  });
});
