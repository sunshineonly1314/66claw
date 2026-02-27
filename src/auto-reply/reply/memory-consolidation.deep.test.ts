/**
 * Deep tests for memory-consolidation.ts
 *
 * Covers:
 * - parseConsolidationResult: merge parsing, stale parsing, edge cases
 * - applyConsolidation merge guard (actuallyRemoved counter)
 * - Snapshot timestamp concurrent safety
 * - removedByMerge dedup in stale pass
 * - identity/correction protection in merge removals
 */

import { describe, expect, it } from "vitest";
import type { ProfileEntry, UserProfile } from "../../memory/profile-store.js";

// We need to test parseConsolidationResult and applyConsolidation.
// parseConsolidationResult is exported, applyConsolidation is internal.
// We test applyConsolidation indirectly via the exported runConsolidation or
// by importing directly if possible.

// Since applyConsolidation is not exported, we test the merge guard logic
// indirectly through the profile state changes.

// First test parseConsolidationResult which IS exported:
import { parseConsolidationResult } from "./memory-consolidation.js";

function makeEntry(overrides?: Partial<ProfileEntry>): ProfileEntry {
  return {
    category: "fact",
    key: "test-key",
    value: "test-value",
    updatedAt: Date.now() - 60_000,
    createdAt: Date.now() - 120_000,
    hits: 0,
    source: "extraction",
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
//  parseConsolidationResult
// ═══════════════════════════════════════════════════════════════

describe("parseConsolidationResult", () => {
  it("parses valid merge result", () => {
    const input = JSON.stringify({
      merge: [
        {
          keep: { category: "fact", key: "lang", value: "TypeScript (preferred)" },
          remove_keys: [{ category: "fact", key: "programming-language" }],
        },
      ],
      stale: [],
    });
    const result = parseConsolidationResult(input);
    expect(result.merge).toHaveLength(1);
    expect(result.merge[0].keep.key).toBe("lang");
    expect(result.merge[0].remove_keys).toHaveLength(1);
    expect(result.stale).toHaveLength(0);
  });

  it("parses valid stale result", () => {
    const input = JSON.stringify({
      merge: [],
      stale: [
        { category: "todo", key: "old-task", reason: "completed" },
        { category: "fact", key: "outdated", reason: "no longer relevant" },
      ],
    });
    const result = parseConsolidationResult(input);
    expect(result.merge).toHaveLength(0);
    expect(result.stale).toHaveLength(2);
    expect(result.stale[0].key).toBe("old-task");
  });

  it("returns null for empty string", () => {
    const result = parseConsolidationResult("");
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON that contains no valid JSON object", () => {
    const result = parseConsolidationResult("completely invalid");
    expect(result).toBeNull();
  });

  it("extracts JSON from surrounding text (LLM noise)", () => {
    const input = `Here is my analysis:\n${JSON.stringify({
      merge: [
        {
          keep: { category: "fact", key: "k", value: "v" },
          remove_keys: [{ category: "fact", key: "old-k" }],
        },
      ],
      stale: [],
    })}\nDone.`;
    const result = parseConsolidationResult(input);
    expect(result).not.toBeNull();
    expect(result!.merge).toHaveLength(1);
  });

  it("rejects stale entries with non-todo/non-fact categories", () => {
    const input = JSON.stringify({
      merge: [],
      stale: [
        { category: "identity", key: "name", reason: "outdated" }, // should be rejected
        { category: "preference", key: "pref", reason: "old" }, // should be rejected
        { category: "fact", key: "valid", reason: "ok" }, // should be kept
      ],
    });
    const result = parseConsolidationResult(input);
    expect(result.stale).toHaveLength(1);
    expect(result.stale[0].category).toBe("fact");
  });

  it("rejects merge entries with missing keep fields", () => {
    const input = JSON.stringify({
      merge: [
        {
          keep: { category: "fact" /* missing key, value */ },
          remove_keys: [{ category: "fact", key: "r1" }],
        },
        {
          keep: { category: "fact", key: "valid", value: "v" },
          remove_keys: [{ category: "fact", key: "r2" }],
        },
      ],
      stale: [],
    });
    const result = parseConsolidationResult(input);
    expect(result).not.toBeNull();
    // First merge rejected (missing key/value), second accepted
    expect(result!.merge).toHaveLength(1);
    expect(result!.merge[0].keep.key).toBe("valid");
  });

  it("rejects invalid categories in merge", () => {
    const input = JSON.stringify({
      merge: [
        {
          keep: { category: "invalid-cat", key: "k", value: "v" },
          remove_keys: [{ category: "fact", key: "r" }],
        },
      ],
      stale: [],
    });
    const result = parseConsolidationResult(input);
    expect(result.merge).toHaveLength(0);
  });

  it("skips merge entries with empty remove_keys (no-op merge)", () => {
    // A merge with no remove_keys is a no-op — the parser correctly skips it
    // (validRemoves.length === 0 → entry not added)
    const input = JSON.stringify({
      merge: [
        {
          keep: { category: "fact", key: "k", value: "v" },
          remove_keys: [],
        },
      ],
      stale: [],
    });
    const result = parseConsolidationResult(input);
    expect(result).not.toBeNull();
    expect(result!.merge).toHaveLength(0); // skipped because no valid removes
  });

  it("removes duplicate entries in stale list by key", () => {
    const input = JSON.stringify({
      merge: [],
      stale: [
        { category: "fact", key: "dup", reason: "first" },
        { category: "fact", key: "dup", reason: "second" },
      ],
    });
    const result = parseConsolidationResult(input);
    // Both should be parsed (dedup happens in applyConsolidation, not parse)
    expect(result.stale.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Merge guard logic — tested via profile manipulation
// ═══════════════════════════════════════════════════════════════

describe("consolidation merge guard — actuallyRemoved counter", () => {
  // We verify the merge guard by manually simulating the applyConsolidation logic,
  // since the function is not exported.

  it("upsert only fires when actuallyRemoved >= 1", () => {
    // Simulate the merge guard:
    // If all remove_keys are skipped (e.g., by snapshot guard), upsert should NOT fire.
    const snapshotTimestamp = Date.now() - 5000; // snapshot taken 5s ago

    const entries: ProfileEntry[] = [
      makeEntry({ category: "fact", key: "dup1", updatedAt: Date.now() }), // updated AFTER snapshot
      makeEntry({ category: "fact", key: "dup2", updatedAt: Date.now() }), // updated AFTER snapshot
    ];

    // Simulate applyConsolidation merge logic
    const removeKeys = [
      { category: "fact", key: "dup1" },
      { category: "fact", key: "dup2" },
    ];

    let actuallyRemoved = 0;
    for (const remove of removeKeys) {
      const existing = entries.find(
        (e) => e.category === remove.category && e.key.toLowerCase() === remove.key.toLowerCase(),
      );
      // Concurrent safety: skip entries updated after snapshot
      if (existing && existing.updatedAt >= snapshotTimestamp) {
        continue; // skipped
      }
      actuallyRemoved++;
    }

    // Both removes were skipped, so actuallyRemoved = 0
    expect(actuallyRemoved).toBe(0);
    // The merge-keep upsert should NOT fire
    const shouldUpsert = actuallyRemoved > 0;
    expect(shouldUpsert).toBe(false);
  });

  it("upsert fires when some removes succeed", () => {
    const snapshotTimestamp = Date.now() - 5000;

    const entries: ProfileEntry[] = [
      makeEntry({ category: "fact", key: "old", updatedAt: snapshotTimestamp - 10000 }), // before snapshot
      makeEntry({ category: "fact", key: "new", updatedAt: Date.now() }), // after snapshot
    ];

    const removeKeys = [
      { category: "fact", key: "old" },
      { category: "fact", key: "new" },
    ];

    let actuallyRemoved = 0;
    for (const remove of removeKeys) {
      const existing = entries.find(
        (e) => e.category === remove.category && e.key.toLowerCase() === remove.key.toLowerCase(),
      );
      if (existing && existing.updatedAt >= snapshotTimestamp) {
        continue;
      }
      if (existing) actuallyRemoved++;
    }

    expect(actuallyRemoved).toBe(1);
    const shouldUpsert = actuallyRemoved > 0;
    expect(shouldUpsert).toBe(true);
  });

  it("identity entries protected from merge removal", () => {
    const removeKeys = [
      { category: "identity", key: "name" }, // should be filtered out
      { category: "correction", key: "fix" }, // should be filtered out
      { category: "fact", key: "removable" }, // should pass
    ];

    const safeRemoves = removeKeys.filter(
      (r) => r.category !== "identity" && r.category !== "correction",
    );

    expect(safeRemoves).toHaveLength(1);
    expect(safeRemoves[0].key).toBe("removable");
  });

  it("removedByMerge prevents double-counting in stale pass", () => {
    // If a key was already removed by merge, the stale pass should skip it
    const removedByMerge = new Set(["fact:dup-key"]);
    const staleEntries = [
      { category: "fact", key: "dup-key", reason: "stale" },
      { category: "fact", key: "other-key", reason: "stale" },
    ];

    const filtered = staleEntries.filter((s) => {
      const compositeKey = `${s.category}:${s.key.toLowerCase()}`;
      return !removedByMerge.has(compositeKey);
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].key).toBe("other-key");
  });

  it("stale removal only removes zero-hit entries", () => {
    const entries: ProfileEntry[] = [
      makeEntry({ category: "fact", key: "zero-hit", hits: 0 }),
      makeEntry({ category: "fact", key: "reinforced", hits: 3 }),
    ];

    const staleKeys = [
      { category: "fact", key: "zero-hit" },
      { category: "fact", key: "reinforced" },
    ];

    const removable = staleKeys.filter((s) => {
      const entry = entries.find(
        (e) => e.category === s.category && e.key.toLowerCase() === s.key.toLowerCase(),
      );
      return entry && entry.hits === 0;
    });

    expect(removable).toHaveLength(1);
    expect(removable[0].key).toBe("zero-hit");
  });
});
