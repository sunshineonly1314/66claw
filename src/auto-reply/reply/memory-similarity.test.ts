/**
 * [CN-PATCH:memory-fix] Direct unit tests for isSimilarValue and levenshteinDistance.
 *
 * Covers:
 * - Exact match / case insensitivity
 * - Short string exact-match requirement (<5 chars)
 * - Containment with >90% ratio threshold
 * - Levenshtein distance threshold (≥30 chars, ≤8%)
 * - Version number updates NOT blocked (the motivating bug)
 * - CJK value updates NOT blocked
 * - 30-char boundary behavior (Levenshtein only kicks in at ≥30)
 * - Edge cases: empty, single char, whitespace
 */

import { describe, it, expect } from "vitest";
import { _isSimilarValue, _levenshteinDistance } from "./memory-extraction.js";

describe("_levenshteinDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(_levenshteinDistance("hello", "hello")).toBe(0);
  });

  it("returns length of other for empty string", () => {
    expect(_levenshteinDistance("", "abc")).toBe(3);
    expect(_levenshteinDistance("abc", "")).toBe(3);
  });

  it("handles single character edits", () => {
    expect(_levenshteinDistance("cat", "car")).toBe(1); // substitution
    expect(_levenshteinDistance("cat", "cats")).toBe(1); // insertion
    expect(_levenshteinDistance("cats", "cat")).toBe(1); // deletion
  });

  it("computes correct distance for known pairs", () => {
    expect(_levenshteinDistance("kitten", "sitting")).toBe(3);
    expect(_levenshteinDistance("saturday", "sunday")).toBe(3);
  });

  it("handles CJK characters", () => {
    expect(_levenshteinDistance("你好世界", "你好世")).toBe(1);
    // "和Rust" = 4 CJK+ASCII chars but Levenshtein counts each UTF-16 code unit
    // The actual insertion sequence "和", "R", "u", "s", "t" = 5 edits
    expect(_levenshteinDistance("喜欢TypeScript", "喜欢TypeScript和Rust")).toBe(5);
  });

  it("is symmetric", () => {
    expect(_levenshteinDistance("abc", "xyz")).toBe(_levenshteinDistance("xyz", "abc"));
    expect(_levenshteinDistance("hello", "helloworld")).toBe(
      _levenshteinDistance("helloworld", "hello"),
    );
  });
});

describe("_isSimilarValue", () => {
  // ── Exact match ──
  it("returns true for identical strings", () => {
    expect(_isSimilarValue("hello world", "hello world")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(_isSimilarValue("TypeScript", "typescript")).toBe(true);
    expect(_isSimilarValue("HELLO", "hello")).toBe(true);
  });

  it("trims whitespace", () => {
    expect(_isSimilarValue("  hello  ", "hello")).toBe(true);
  });

  // ── Short strings (<5 chars): require exact match ──
  it("requires exact match for very short values", () => {
    expect(_isSimilarValue("vim", "vim")).toBe(true);
    expect(_isSimilarValue("vim", "vi")).toBe(false);
    expect(_isSimilarValue("a", "b")).toBe(false);
    expect(_isSimilarValue("", "")).toBe(true);
  });

  // ── Containment with >90% ratio ──
  it("treats near-identical containment (>90% ratio) as similar", () => {
    // 10 chars vs 11 chars = 91% ratio, "typescript" contained in "typescripts"
    expect(_isSimilarValue("typescript", "typescripts")).toBe(true);
  });

  it("does NOT treat containment with <90% ratio as similar", () => {
    // "喜欢TypeScript" (7+10=17 CJK+latin) vs "喜欢TypeScript和Rust" (21 chars)
    // ratio ~76% < 90%, containment exists but ratio too low → not similar
    expect(_isSimilarValue("喜欢TypeScript", "喜欢TypeScript和Rust")).toBe(false);
  });

  // ── THE MOTIVATING BUG: value updates should NOT be blocked ──
  it("accepts CJK value additions (the original bug)", () => {
    // User wants to update "喜欢TypeScript" to "喜欢TypeScript和Rust"
    // Old code blocked this. New code should accept it.
    expect(_isSimilarValue("喜欢TypeScript", "喜欢TypeScript和Rust")).toBe(false);
  });

  it("accepts version number updates", () => {
    expect(_isSimilarValue("Python 3.9", "Python 3.10")).toBe(false);
    expect(_isSimilarValue("Node.js 18", "Node.js 20")).toBe(false);
    expect(_isSimilarValue("uses React 17", "uses React 18")).toBe(false);
  });

  it("accepts location changes", () => {
    expect(_isSimilarValue("lives in Beijing", "lives in Shanghai")).toBe(false);
  });

  it("accepts meaningful short additions", () => {
    expect(_isSimilarValue("uses Python", "uses Python for web development")).toBe(false);
  });

  // ── Levenshtein: only for strings ≥30 chars ──
  it("uses Levenshtein for longer strings (≥30 chars) with small edits", () => {
    // 35-char string with 1 typo fix → should be similar
    const original = "prefers dark theme in all editors!!";
    const typoFix = "prefers dark theme in all editorss!";
    // Both are 34 chars, edit distance = 2 (swap "!!" for "s!")
    // 8% of 35 = 2.8, ceil = 3 → 2 <= 3 → similar
    expect(_isSimilarValue(original, typoFix)).toBe(true);
  });

  it("does NOT use Levenshtein for strings <30 chars", () => {
    // 15-char strings with 1-char difference — for short strings,
    // if not contained and not >90% ratio containment, should NOT be similar
    expect(_isSimilarValue("Python version9", "Python version8")).toBe(false);
  });

  // ── Length ratio extremes ──
  it("rejects when lengths differ by >50%", () => {
    expect(_isSimilarValue("short", "this is a much longer string than short")).toBe(false);
  });

  it("handles strings in the 50-90% ratio range correctly", () => {
    // "hello world" (11) vs "hello worlds!" (13) = ratio 85%
    // Not containment (no exact contain), not >90%, strings < 30 chars so no Levenshtein
    expect(_isSimilarValue("hello world", "hello worlds!")).toBe(false);
  });

  // ── Edge cases ──
  it("handles empty strings", () => {
    expect(_isSimilarValue("", "")).toBe(true);
    expect(_isSimilarValue("", "hello")).toBe(false);
    expect(_isSimilarValue("hello", "")).toBe(false);
  });

  it("handles single character strings", () => {
    expect(_isSimilarValue("a", "a")).toBe(true);
    expect(_isSimilarValue("a", "A")).toBe(true);
    expect(_isSimilarValue("a", "b")).toBe(false);
  });

  // ── Boundary: exactly 30 chars ──
  it("applies Levenshtein at exactly 30 chars", () => {
    // 30-char string with 1 edit: threshold = ceil(30 * 0.08) = 3
    // 1 <= 3 → similar
    const s30 = "abcdefghij1234567890abcdefghij";
    const s30edit = "abcdefghij1234567890abcdefghik"; // last char changed
    expect(s30.length).toBe(30);
    expect(_isSimilarValue(s30, s30edit)).toBe(true);
  });

  it("does NOT apply Levenshtein at 29 chars", () => {
    // 29-char string: Levenshtein not applied, falls through to false
    const s29 = "abcdefghij1234567890abcdefghi";
    const s29edit = "abcdefghij1234567890abcdefghj"; // last char changed
    expect(s29.length).toBe(29);
    // No containment, not >90% ratio containment, no Levenshtein → not similar
    expect(_isSimilarValue(s29, s29edit)).toBe(false);
  });
});
