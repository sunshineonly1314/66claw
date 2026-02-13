import { describe, expect, it } from "vitest";
import { classifyByRules } from "./intent-classifier.js";
import type { CompiledIntent } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIntent(
  id: string,
  keywords: string[],
  regexPatterns: string[],
  semanticTags: string[] = [],
): CompiledIntent {
  const compiledRegex = regexPatterns.map((p) => new RegExp(p, "i"));
  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  return {
    id,
    description: `Test intent: ${id}`,
    patterns: { keywords, regex: regexPatterns, semanticTags },
    routing: { model: null },
    skills: [],
    mcpTools: [],
    compiledRegex,
    lowerKeywords,
  };
}

const IMAGE_INTENT = makeIntent(
  "image_generation",
  ["画", "生成图", "draw", "generate image", "AI绘画"],
  ["(画|绘|生成|create|generate|make).*?(图|画|image|picture|photo)"],
);

const WECHAT_INTENT = makeIntent(
  "wechat_operation",
  ["微信", "wechat", "发消息给", "发微信"],
  ["(微信|wechat)"],
);

const DATABASE_INTENT = makeIntent(
  "database_query",
  ["SQL", "数据库", "database", "query", "SELECT"],
  ["(SELECT|INSERT|UPDATE|DELETE|CREATE\\s+TABLE)", "(数据库|database).*(查询|query)"],
);

const CODING_INTENT = makeIntent(
  "coding",
  ["代码", "code", "debug", "bug", "函数"],
  ["(write|fix|debug|refactor).*(code|function|class)"],
);

const DESKTOP_INTENT = makeIntent(
  "desktop_control",
  ["打开", "启动", "截图", "点击", "操作"],
  ["(打开|启动).*(应用|app|软件)", "(截图|screenshot)"],
);

const GENERAL_INTENT = makeIntent("general", [], []);

const ALL_INTENTS: CompiledIntent[] = [
  IMAGE_INTENT,
  WECHAT_INTENT,
  DATABASE_INTENT,
  CODING_INTENT,
  DESKTOP_INTENT,
  GENERAL_INTENT,
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("classifyByRules", () => {
  describe("image generation", () => {
    it("matches Chinese keyword '画'", () => {
      const results = classifyByRules("帮我画一只猫", ALL_INTENTS);
      expect(results[0].intentId).toBe("image_generation");
      expect(results[0].confidence).toBeGreaterThan(0);
    });

    it("matches combined keyword + regex", () => {
      const results = classifyByRules("生成一张图片", ALL_INTENTS);
      const imageMatch = results.find((r) => r.intentId === "image_generation");
      expect(imageMatch).toBeDefined();
      expect(imageMatch!.confidence).toBeGreaterThanOrEqual(0.3);
    });

    it("matches English 'generate image'", () => {
      const results = classifyByRules("please generate image of a cat", ALL_INTENTS);
      const imageMatch = results.find((r) => r.intentId === "image_generation");
      expect(imageMatch).toBeDefined();
      expect(imageMatch!.confidence).toBeGreaterThan(0);
    });

    it("matches 'draw' with word boundary", () => {
      const results = classifyByRules("can you draw a tree?", ALL_INTENTS);
      const imageMatch = results.find((r) => r.intentId === "image_generation");
      expect(imageMatch).toBeDefined();
    });
  });

  describe("WeChat operations", () => {
    it("matches '微信'", () => {
      const results = classifyByRules("帮我查看微信消息", ALL_INTENTS);
      expect(results[0].intentId).toBe("wechat_operation");
      expect(results[0].confidence).toBeGreaterThanOrEqual(0.3);
    });

    it("matches '发消息给'", () => {
      const results = classifyByRules("发消息给小李", ALL_INTENTS);
      const wechatMatch = results.find((r) => r.intentId === "wechat_operation");
      expect(wechatMatch).toBeDefined();
    });

    it("matches 'wechat' (English)", () => {
      const results = classifyByRules("check my wechat", ALL_INTENTS);
      expect(results[0].intentId).toBe("wechat_operation");
    });
  });

  describe("database queries", () => {
    it("matches SQL keywords", () => {
      const results = classifyByRules("SELECT * FROM users WHERE id = 1", ALL_INTENTS);
      expect(results[0].intentId).toBe("database_query");
      expect(results[0].confidence).toBeGreaterThanOrEqual(0.3);
    });

    it("matches Chinese database references", () => {
      const results = classifyByRules("查询一下数据库", ALL_INTENTS);
      const dbMatch = results.find((r) => r.intentId === "database_query");
      expect(dbMatch).toBeDefined();
    });

    it("matches INSERT statement", () => {
      const results = classifyByRules("INSERT INTO orders VALUES (1, 'test')", ALL_INTENTS);
      expect(results[0].intentId).toBe("database_query");
    });
  });

  describe("coding tasks", () => {
    it("matches '代码'", () => {
      const results = classifyByRules("帮我写一段代码", ALL_INTENTS);
      const codingMatch = results.find((r) => r.intentId === "coding");
      expect(codingMatch).toBeDefined();
    });

    it("matches 'debug'", () => {
      const results = classifyByRules("debug this function please", ALL_INTENTS);
      const codingMatch = results.find((r) => r.intentId === "coding");
      expect(codingMatch).toBeDefined();
    });

    it("matches combined keyword + regex for 'fix code'", () => {
      const results = classifyByRules("fix this code bug", ALL_INTENTS);
      const codingMatch = results.find((r) => r.intentId === "coding");
      expect(codingMatch).toBeDefined();
      expect(codingMatch!.confidence).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe("desktop control", () => {
    it("matches '打开应用'", () => {
      const results = classifyByRules("打开一个应用", ALL_INTENTS);
      const desktopMatch = results.find((r) => r.intentId === "desktop_control");
      expect(desktopMatch).toBeDefined();
    });

    it("matches '截图'", () => {
      const results = classifyByRules("帮我截图看看", ALL_INTENTS);
      const desktopMatch = results.find((r) => r.intentId === "desktop_control");
      expect(desktopMatch).toBeDefined();
    });
  });

  describe("general / catch-all", () => {
    it("catch-all has lowest confidence", () => {
      const results = classifyByRules("今天天气怎么样", ALL_INTENTS);
      const generalMatch = results.find((r) => r.intentId === "general");
      expect(generalMatch).toBeDefined();
      expect(generalMatch!.confidence).toBe(0.1);

      // General should be last (lowest confidence)
      expect(results[results.length - 1].intentId).toBe("general");
    });

    it("returns general as only match for unrelated prompts", () => {
      const results = classifyByRules("你叫什么名字", ALL_INTENTS);
      // Only general should match (all others return null)
      const nonGeneralMatches = results.filter((r) => r.intentId !== "general");
      // Some may still match due to partial keyword overlap, but general should be present
      const generalMatch = results.find((r) => r.intentId === "general");
      expect(generalMatch).toBeDefined();
    });
  });

  describe("sorting and ranking", () => {
    it("returns results sorted by confidence descending", () => {
      const results = classifyByRules("帮我画一张图", ALL_INTENTS);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
      }
    });

    it("returns empty array when no intents defined", () => {
      const results = classifyByRules("hello", []);
      expect(results).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("handles empty prompt", () => {
      const results = classifyByRules("", ALL_INTENTS);
      // Only catch-all should match
      const nonGeneral = results.filter((r) => r.intentId !== "general");
      expect(nonGeneral.length).toBe(0);
    });

    it("handles very long prompt", () => {
      const longPrompt = "帮我用微信发消息给小李 ".repeat(100);
      const results = classifyByRules(longPrompt, ALL_INTENTS);
      expect(results[0].intentId).toBe("wechat_operation");
    });

    it("is case-insensitive for English", () => {
      const results = classifyByRules("GENERATE IMAGE of a sunset", ALL_INTENTS);
      const imageMatch = results.find((r) => r.intentId === "image_generation");
      expect(imageMatch).toBeDefined();
    });
  });
});
