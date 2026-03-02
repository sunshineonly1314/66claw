/**
 * Tests for profile-retrieval.ts
 *
 * Covers:
 * - retrieveColdMemories: time-decay, dedup against hot profile, budget limits
 * - Short-query enrichment via recentContext
 * - Sanitization (newlines in snippets)
 * - Error resilience (never blocks agent turn)
 */

import { describe, expect, it } from "vitest";
import { retrieveColdMemories } from "./profile-retrieval.js";
import type { MemorySearchResult, MemorySearchManager } from "./types.js";

const DAY = 86_400_000;
const NOW = Date.now();

function makeManager(results: MemorySearchResult[]): MemorySearchManager {
  return {
    search: async () => results,
    status: () => ({ files: 0, chunks: 0 }),
    close: async () => {},
    sync: async () => {},
  } as unknown as MemorySearchManager;
}

function makeResult(overrides?: Partial<MemorySearchResult>): MemorySearchResult {
  return {
    path: "test.md",
    snippet: "test snippet content here",
    score: 0.5,
    updatedAt: NOW,
    source: "memory",
    ...overrides,
  };
}

describe("retrieveColdMemories — basic functionality", () => {
  it("returns formatted markdown for matching results", async () => {
    const manager = makeManager([makeResult({ snippet: "User prefers dark mode", score: 0.8 })]);
    const result = await retrieveColdMemories({
      manager,
      query: "what theme does the user prefer",
    });
    expect(result).toContain("Related Memories");
    expect(result).toContain("dark mode");
  });

  it("returns empty string for short query without context", async () => {
    const manager = makeManager([makeResult()]);
    const result = await retrieveColdMemories({
      manager,
      query: "hi",
    });
    expect(result).toBe("");
  });

  it("uses recentContext when query is too short", async () => {
    const manager = makeManager([
      makeResult({ snippet: "User is working on React project", score: 0.8 }),
    ]);
    const result = await retrieveColdMemories({
      manager,
      query: "ok",
      recentContext: "We discussed the React project architecture yesterday",
    });
    // Should use recentContext as the query since "ok" is too short
    expect(result).toContain("React");
  });

  it("returns empty string when no results match", async () => {
    const manager = makeManager([]);
    const result = await retrieveColdMemories({
      manager,
      query: "something with enough length to pass min check",
    });
    expect(result).toBe("");
  });

  it("returns empty string on search error (never blocks)", async () => {
    const manager = {
      search: async () => {
        throw new Error("database error");
      },
    } as unknown as MemorySearchManager;
    const result = await retrieveColdMemories({
      manager,
      query: "some query with enough length here",
    });
    expect(result).toBe("");
  });
});

describe("retrieveColdMemories — time decay", () => {
  it("recent results (< 90 days) have no decay", async () => {
    const recentResult = makeResult({
      snippet: "recent fact",
      score: 0.5,
      updatedAt: NOW - 30 * DAY,
    });
    const manager = makeManager([recentResult]);
    const result = await retrieveColdMemories({
      manager,
      query: "what are the user facts and preferences",
    });
    expect(result).toContain("recent fact");
  });

  it("old results (> 90 days) have decayed scores", async () => {
    // An old result with score 0.4 should be decayed below minScore (0.35)
    const oldResult = makeResult({
      snippet: "very old fact",
      score: 0.4,
      updatedAt: NOW - 300 * DAY, // ~300 days old
    });
    const manager = makeManager([oldResult]);
    const result = await retrieveColdMemories({
      manager,
      query: "what is the old fact about the user",
    });
    // After ~210 days of excess decay (300-90), factor = 0.5^(210/90) ≈ 0.19
    // Decayed score ≈ 0.4 * 0.19 ≈ 0.076 < 0.35 minScore -> filtered out
    expect(result).toBe("");
  });

  it("high-score old results survive decay", async () => {
    const oldHighScore = makeResult({
      snippet: "important old memory",
      score: 0.95,
      updatedAt: NOW - 200 * DAY,
    });
    const manager = makeManager([oldHighScore]);
    const result = await retrieveColdMemories({
      manager,
      query: "what is the important memory from earlier",
      // After ~110 days excess, factor = 0.5^(110/90) ≈ 0.43
      // Decayed score ≈ 0.95 * 0.43 ≈ 0.41
      // Use explicit minScore to test decay behavior independently of default threshold
      minScore: 0.35,
    });
    expect(result).toContain("important old memory");
  });
});

describe("retrieveColdMemories — hot profile dedup", () => {
  it("filters results whose key is already in hot profile", async () => {
    const results = [
      makeResult({ snippet: "- [fact] programming-language: TypeScript", score: 0.8 }),
      makeResult({ snippet: "- [preference] theme: dark mode", score: 0.7 }),
      makeResult({ snippet: "User mentioned they like coffee", score: 0.6 }),
    ];
    const manager = makeManager(results);
    const hotKeys = new Set(["fact:programming-language"]);

    const result = await retrieveColdMemories({
      manager,
      query: "what does the user prefer for development work",
      hotKeys,
    });

    // "programming-language" is already hot -> should be filtered
    expect(result).not.toContain("programming-language");
    // Other results should pass
    expect(result).toContain("theme");
    expect(result).toContain("coffee");
  });

  it("non-archive format results always pass hot dedup", async () => {
    const results = [
      makeResult({ snippet: "This is from MEMORY.md, not archive format", score: 0.8 }),
    ];
    const manager = makeManager(results);
    const hotKeys = new Set(["fact:some-key"]);

    const result = await retrieveColdMemories({
      manager,
      query: "what does the MEMORY file contain about this topic",
      hotKeys,
    });

    expect(result).toContain("MEMORY.md");
  });
});

describe("retrieveColdMemories — budget and sanitization", () => {
  it("limits total results to MAX_RETRIEVAL_RESULTS (5)", async () => {
    const results = Array.from({ length: 20 }, (_, i) =>
      makeResult({ path: `doc-${i}.md`, snippet: `fact ${i}`, score: 0.9 - i * 0.01 }),
    );
    const manager = makeManager(results);
    const result = await retrieveColdMemories({
      manager,
      query: "what are all the facts about the user preferences",
    });

    // Count bullet points (lines starting with "- ")
    const bulletCount = (result.match(/^- /gm) || []).length;
    expect(bulletCount).toBeLessThanOrEqual(5);
  });

  it("respects MAX_RETRIEVAL_CHARS budget", async () => {
    const results = Array.from({ length: 10 }, (_, i) =>
      makeResult({
        path: `doc-${i}.md`,
        snippet: "x".repeat(200), // each line is ~200+ chars
        score: 0.9,
      }),
    );
    const manager = makeManager(results);
    const result = await retrieveColdMemories({
      manager,
      query: "give me all the facts with long content values",
    });

    expect(result.length).toBeLessThanOrEqual(700); // 600 + header
  });

  it("sanitizes newlines in snippets", async () => {
    const results = [makeResult({ snippet: "line1\nline2\r\nline3", score: 0.8 })];
    const manager = makeManager(results);
    const result = await retrieveColdMemories({
      manager,
      query: "what are the multiline facts about this user",
    });

    // Newlines should be replaced with spaces
    expect(result).not.toContain("\n- line1\nline2");
    expect(result).toContain("line1 line2 line3");
  });

  it("skips results with empty snippets", async () => {
    const results = [
      makeResult({ snippet: "", score: 0.9 }),
      makeResult({ snippet: "   ", score: 0.8 }),
      makeResult({ snippet: "valid content", score: 0.7 }),
    ];
    const manager = makeManager(results);
    const result = await retrieveColdMemories({
      manager,
      query: "what facts are available about the user profile",
    });

    expect(result).toContain("valid content");
    // Should not have extra empty bullets
    const bulletCount = (result.match(/^- /gm) || []).length;
    expect(bulletCount).toBe(1);
  });

  it("returns empty when only header would be produced", async () => {
    const results = [
      makeResult({ snippet: "", score: 0.9 }), // empty snippet -> skipped
    ];
    const manager = makeManager(results);
    const result = await retrieveColdMemories({
      manager,
      query: "anything about the user that might be relevant here",
    });

    expect(result).toBe("");
  });
});
