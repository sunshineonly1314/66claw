import { describe, expect, it, beforeEach } from "vitest";
import {
  buildSynonymIndex,
  calculateSynonymBoost,
  expandPromptWithSynonyms,
  getSynonymIndex,
  invalidateSynonymIndex,
} from "./synonym-expander.js";
import { classifyByRules } from "./intent-classifier.js";
import type { CompiledIntent } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_GROUPS: Record<string, string[][]> = {
  image_generation: [
    ["画", "画图", "绘画", "draw", "paint"],
    ["图片", "图像", "image", "picture"],
  ],
  coding: [
    ["代码", "code", "源码"],
    ["debug", "调试", "排错"],
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("synonym-expander", () => {
  describe("buildSynonymIndex", () => {
    it("builds an index from synonym groups", () => {
      const index = buildSynonymIndex(TEST_GROUPS);
      expect(index.size).toBe(2);
      expect(index.has("image_generation")).toBe(true);
      expect(index.has("coding")).toBe(true);
    });

    it("maps each term to all synonyms in its group", () => {
      const index = buildSynonymIndex(TEST_GROUPS);
      const imageIndex = index.get("image_generation")!;

      // "画" should map to all terms in its synonym set
      const drawSynonyms = imageIndex.get("画")!;
      expect(drawSynonyms).toBeDefined();
      expect(drawSynonyms.has("画图")).toBe(true);
      expect(drawSynonyms.has("绘画")).toBe(true);
      expect(drawSynonyms.has("draw")).toBe(true);
      expect(drawSynonyms.has("paint")).toBe(true);
    });

    it("handles case-insensitive lookups", () => {
      const index = buildSynonymIndex(TEST_GROUPS);
      const imageIndex = index.get("image_generation")!;

      // All keys should be lowercase
      expect(imageIndex.has("draw")).toBe(true);
      expect(imageIndex.has("image")).toBe(true);
    });

    it("merges custom groups with built-in", () => {
      const custom: Record<string, string[][]> = {
        image_generation: [["ai art", "人工智能绘画"]],
        custom_intent: [["foo", "bar", "baz"]],
      };

      const index = buildSynonymIndex(TEST_GROUPS, custom);
      expect(index.has("custom_intent")).toBe(true);

      const imageIndex = index.get("image_generation")!;
      expect(imageIndex.has("ai art")).toBe(true);
      expect(imageIndex.has("人工智能绘画")).toBe(true);
    });
  });

  describe("expandPromptWithSynonyms", () => {
    it("finds synonyms for terms present in the prompt", () => {
      const index = buildSynonymIndex(TEST_GROUPS);
      const expansions = expandPromptWithSynonyms("帮我画个猫".toLowerCase(), index);

      expect(expansions.has("image_generation")).toBe(true);
      const synonyms = expansions.get("image_generation")!;
      // Should include synonyms of "画" (e.g., "draw", "paint", "画图", "绘画")
      expect(synonyms.length).toBeGreaterThan(0);
    });

    it("does not expand when no synonyms match", () => {
      const index = buildSynonymIndex(TEST_GROUPS);
      const expansions = expandPromptWithSynonyms("今天天气好".toLowerCase(), index);

      expect(expansions.size).toBe(0);
    });

    it("expands across multiple intents", () => {
      const index = buildSynonymIndex(TEST_GROUPS);
      // "画" → image_generation, "代码" → coding (lowercased prompt)
      const prompt = "帮我画一个代码示意图";
      const expansions = expandPromptWithSynonyms(prompt.toLowerCase(), index);

      expect(expansions.has("image_generation")).toBe(true);
      expect(expansions.has("coding")).toBe(true);
    });

    it("handles English terms", () => {
      const index = buildSynonymIndex(TEST_GROUPS);
      const expansions = expandPromptWithSynonyms("please draw a cat".toLowerCase(), index);

      expect(expansions.has("image_generation")).toBe(true);
      const synonyms = expansions.get("image_generation")!;
      expect(synonyms.some((s) => s === "画" || s === "paint" || s === "画图")).toBe(true);
    });
  });

  describe("calculateSynonymBoost", () => {
    it("returns zero boost for non-matching intents", () => {
      const index = buildSynonymIndex(TEST_GROUPS);
      const result = calculateSynonymBoost("今天天气好".toLowerCase(), "image_generation", index);
      expect(result.boost).toBe(0);
      expect(result.matchedTerms).toEqual([]);
    });

    it("returns positive boost when synonyms match", () => {
      const index = buildSynonymIndex(TEST_GROUPS);
      const result = calculateSynonymBoost("帮我画个猫".toLowerCase(), "image_generation", index);
      expect(result.boost).toBeGreaterThan(0);
      expect(result.matchedTerms.length).toBeGreaterThan(0);
    });

    it("caps boost at 0.2", () => {
      const index = buildSynonymIndex(TEST_GROUPS);
      // Include terms from multiple synonym sets to test cap
      const result = calculateSynonymBoost(
        "帮我画一张图片 draw a picture image 绘画".toLowerCase(),
        "image_generation",
        index,
      );
      expect(result.boost).toBeLessThanOrEqual(0.2);
    });

    it("increases boost with more synonym sets matched", () => {
      const index = buildSynonymIndex(TEST_GROUPS);

      // One synonym set matched
      const result1 = calculateSynonymBoost("帮我画个猫".toLowerCase(), "image_generation", index);

      // Two synonym sets matched (画 + 图片)
      const result2 = calculateSynonymBoost(
        "帮我画一张图片".toLowerCase(),
        "image_generation",
        index,
      );

      expect(result2.boost).toBeGreaterThanOrEqual(result1.boost);
    });

    it("does not match single ASCII character terms to avoid false positives", () => {
      // Create a group with a single ASCII character term
      const groups: Record<string, string[][]> = {
        test: [["a", "alpha"]],
      };
      const index = buildSynonymIndex(groups);
      // "a" is a single ASCII char, should be skipped
      const result = calculateSynonymBoost("a test", "test", index);
      expect(result.boost).toBe(0);
    });

    it("does match single CJK character terms (valid words)", () => {
      const index = buildSynonymIndex(TEST_GROUPS);
      // "画" is a single CJK char but a meaningful word
      const result = calculateSynonymBoost("画猫".toLowerCase(), "image_generation", index);
      expect(result.boost).toBeGreaterThan(0);
    });
  });

  describe("getSynonymIndex", () => {
    beforeEach(() => {
      invalidateSynonymIndex();
    });

    it("returns cached built-in index", () => {
      const index1 = getSynonymIndex();
      const index2 = getSynonymIndex();
      expect(index1).toBe(index2); // Same reference (cached)
    });

    it("built-in index contains expected intents", () => {
      const index = getSynonymIndex();
      expect(index.has("image_generation")).toBe(true);
      expect(index.has("wechat_operation")).toBe(true);
      expect(index.has("coding")).toBe(true);
      expect(index.has("desktop_control")).toBe(true);
      expect(index.has("web_browsing")).toBe(true);
      expect(index.has("audio_processing")).toBe(true);
      expect(index.has("database_query")).toBe(true);
    });

    it("invalidation clears the cache", () => {
      const index1 = getSynonymIndex();
      invalidateSynonymIndex();
      const index2 = getSynonymIndex();
      expect(index1).not.toBe(index2); // Different reference after invalidation
    });
  });

  describe("integration: synonym boost in classifyByRules", () => {
    // These tests verify that synonym expansion integrates correctly
    // with the rule-based classifier. We test through the public API.
    it("boosts image_generation confidence for synonym terms", () => {
      const imageIntent: CompiledIntent = {
        id: "image_generation",
        description: "Generate images",
        patterns: { keywords: ["画"], regex: [], semanticTags: [] },
        routing: { model: null },
        skills: [],
        mcpTools: [],
        compiledRegex: [],
        lowerKeywords: ["画"],
      };
      const generalIntent: CompiledIntent = {
        id: "general",
        description: "General",
        patterns: { keywords: [], regex: [], semanticTags: [] },
        routing: { model: null },
        skills: [],
        mcpTools: [],
        compiledRegex: [],
        lowerKeywords: [],
      };

      // "绘画" is a synonym of "画" in the built-in synonym table
      // It should produce a match through synonym expansion
      const results = classifyByRules("帮我绘画一只猫", [imageIntent, generalIntent]);
      const imageMatch = results.find((r) => r.intentId === "image_generation");
      expect(imageMatch).toBeDefined();
      // Confidence should come from synonym boost
      expect(imageMatch!.confidence).toBeGreaterThan(0);
    });

    it("synonym-only match produces a valid confidence score", () => {
      const imageIntent: CompiledIntent = {
        id: "image_generation",
        description: "Generate images",
        // Keyword is "generate image" — not present in the Chinese synonym test prompt
        patterns: { keywords: ["generate image"], regex: [], semanticTags: [] },
        routing: { model: null },
        skills: [],
        mcpTools: [],
        compiledRegex: [],
        lowerKeywords: ["generate image"],
      };

      // "绘画" is a synonym of "画" in the built-in synonym table
      // No keyword matches directly, but synonym expansion produces a match
      const results = classifyByRules("帮我绘画一只猫", [imageIntent]);
      const imageMatch = results.find((r) => r.intentId === "image_generation");

      // Should get a match with some confidence (from synonym boost only)
      expect(imageMatch).toBeDefined();
      expect(imageMatch!.confidence).toBeGreaterThan(0);
      expect(imageMatch!.confidence).toBeLessThanOrEqual(0.2); // Synonym-only max boost
      expect(imageMatch!.matchDetails).toContain("synonym-only");
    });
  });
});
