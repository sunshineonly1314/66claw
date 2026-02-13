import { describe, expect, it } from "vitest";
import {
  assessComplexityByRules,
  normalizeComplexityLevel,
  resolveStrategy,
  scoreToComplexityLevel,
} from "./complexity-classifier.js";

// ---------------------------------------------------------------------------
// assessComplexityByRules
// ---------------------------------------------------------------------------

describe("assessComplexityByRules", () => {
  describe("simple tasks → low score", () => {
    it("simple greeting (Chinese)", () => {
      const result = assessComplexityByRules("你好");
      expect(result.score).toBeLessThanOrEqual(0.2);
      expect(result.signals).toContain("simple_greeting");
      expect(result.confident).toBe(true);
    });

    it("simple greeting (English)", () => {
      const result = assessComplexityByRules("Hello!");
      expect(result.score).toBeLessThanOrEqual(0.2);
      expect(result.signals).toContain("simple_greeting");
    });

    it("simple question (Chinese)", () => {
      const result = assessComplexityByRules("什么是TypeScript?");
      expect(result.score).toBeLessThanOrEqual(0.2);
      // CJK short question matches simple_question pattern
      expect(result.signals).toContain("simple_question");
    });

    it("simple translation request", () => {
      const result = assessComplexityByRules("帮我翻译 hello world");
      expect(result.score).toBeLessThanOrEqual(0.2);
      expect(result.signals).toContain("simple_command");
    });

    it("very short prompt", () => {
      const result = assessComplexityByRules("ok");
      expect(result.score).toBeLessThanOrEqual(0.2);
      expect(result.signals).toContain("very_short");
    });

    it("simple English question", () => {
      const result = assessComplexityByRules("What is machine learning?");
      expect(result.score).toBeLessThanOrEqual(0.2);
    });
  });

  describe("complex tasks → high score", () => {
    it("multi-step research request (Chinese)", () => {
      const result = assessComplexityByRules(
        "首先帮我调研一下市场上的AI框架，然后对比它们的优缺点，最后给出推荐方案",
      );
      expect(result.score).toBeGreaterThanOrEqual(0.5);
      expect(result.signals).toContain("multi_step");
    });

    it("multi-dimension analysis", () => {
      const result = assessComplexityByRules(
        "分别从技术架构、成本、可维护性各方面分析这个方案的可行性，同时给出竞品的对比",
      );
      expect(result.score).toBeGreaterThanOrEqual(0.5);
      expect(result.signals).toContain("multi_dimension");
    });

    it("deep research request (English)", () => {
      const result = assessComplexityByRules(
        "Please provide a comprehensive analysis comparing React, Vue, and Angular frameworks. " +
          "Include pros and cons, performance benchmarks, ecosystem maturity, and long-term maintainability. " +
          "Also evaluate the trade-offs for a large enterprise application.",
      );
      expect(result.score).toBeGreaterThanOrEqual(0.5);
      expect(result.signals).toContain("deep_research");
    });

    it("comparison request", () => {
      const result = assessComplexityByRules(
        "对比一下LangGraph vs CrewAI vs AutoGen这三个框架的优劣，分别从性能、易用性、生态方面评估",
      );
      expect(result.score).toBeGreaterThanOrEqual(0.5);
      expect(result.signals).toContain("comparison");
    });

    it("long prompt with enumeration", () => {
      const result = assessComplexityByRules(
        "我需要你帮我做以下几件事：1. 分析当前的代码架构 2. 找出性能瓶颈 3. 设计优化方案 " +
          "4. 评估实施风险 5. 制定实施计划。每一步都需要详细分析，给出具体的方案和时间表。",
      );
      expect(result.score).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe("medium tasks → mid-range score", () => {
    it("single-step code request scores low-to-medium", () => {
      const result = assessComplexityByRules("帮我写一个排序算法");
      // Short, single-step request — no complexity signals fire, score stays low
      expect(result.score).toBeLessThan(0.5);
    });

    it("moderate question without strong signals", () => {
      const result = assessComplexityByRules("请解释一下React的虚拟DOM是怎么工作的，以及它的优势");
      // Should be in the medium zone — not trivially simple, not multi-agent complex
      expect(result.score).toBeLessThan(0.55);
    });
  });

  describe("signal combinations", () => {
    it("multi-step + research accumulates signals", () => {
      const result = assessComplexityByRules(
        "第一步深入调研市场，第二步全面分析竞品，第三步综合评估方案",
      );
      expect(result.signals).toContain("multi_step");
      expect(result.signals).toContain("deep_research");
      expect(result.score).toBeGreaterThanOrEqual(0.4);
    });

    it("long + enumeration + comparison", () => {
      const result = assessComplexityByRules(
        "我想对比以下方案的优劣：方案A使用微服务架构、方案B使用单体架构、方案C使用Serverless。" +
          "请从成本、性能、可维护性、团队学习曲线等方面详细对比分析。",
      );
      expect(result.signals.length).toBeGreaterThanOrEqual(2);
      expect(result.score).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe("confidence", () => {
    it("is confident for clearly simple tasks", () => {
      const result = assessComplexityByRules("Hi!");
      expect(result.confident).toBe(true);
    });

    it("is confident for clearly complex tasks", () => {
      const result = assessComplexityByRules(
        "首先调研市场，然后全面对比各方案的pros and cons，系统性评估每个方面",
      );
      expect(result.confident).toBe(true);
    });

    it("is not confident for ambiguous tasks", () => {
      // This prompt triggers comparison (0.15) + research "详细分析" (0.2) = 0.35
      // Score is between CONFIDENT_LOW (0.15) and CONFIDENT_HIGH (0.55), so not confident.
      const result = assessComplexityByRules(
        "能不能帮我详细分析一下React和Vue的区别，哪个更适合我们的项目？",
      );
      expect(result.score).toBeGreaterThan(0.15);
      expect(result.score).toBeLessThan(0.55);
      expect(result.confident).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      const result = assessComplexityByRules("");
      expect(result.score).toBeLessThanOrEqual(0.2);
      expect(result.signals).toContain("very_short");
    });

    it("score is clamped to [0, 1]", () => {
      // Multiple simplicity signals shouldn't produce negative
      const result = assessComplexityByRules("hello");
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------------
// scoreToComplexityLevel
// ---------------------------------------------------------------------------

describe("scoreToComplexityLevel", () => {
  it("maps low scores to 'low'", () => {
    expect(scoreToComplexityLevel(0)).toBe("low");
    expect(scoreToComplexityLevel(0.1)).toBe("low");
    expect(scoreToComplexityLevel(0.2)).toBe("low");
  });

  it("maps mid scores to 'medium'", () => {
    expect(scoreToComplexityLevel(0.21)).toBe("medium");
    expect(scoreToComplexityLevel(0.3)).toBe("medium");
    expect(scoreToComplexityLevel(0.49)).toBe("medium");
  });

  it("maps high scores to 'high'", () => {
    expect(scoreToComplexityLevel(0.5)).toBe("high");
    expect(scoreToComplexityLevel(0.7)).toBe("high");
    expect(scoreToComplexityLevel(1.0)).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// resolveStrategy
// ---------------------------------------------------------------------------

describe("resolveStrategy", () => {
  it("always returns 'single' for low complexity", () => {
    expect(resolveStrategy("low", "research")).toBe("single");
    expect(resolveStrategy("low", "coding")).toBe("single");
    expect(resolveStrategy("low", "general")).toBe("single");
  });

  it("returns 'multi' for high complexity + parallelizable intent", () => {
    expect(resolveStrategy("high", "research")).toBe("multi");
    expect(resolveStrategy("high", "analysis")).toBe("multi");
    expect(resolveStrategy("high", "comparison")).toBe("multi");
  });

  it("returns 'enhanced' for high complexity + sequential intent", () => {
    expect(resolveStrategy("high", "coding")).toBe("enhanced");
    expect(resolveStrategy("high", "math")).toBe("enhanced");
    expect(resolveStrategy("high", "logic")).toBe("enhanced");
  });

  it("returns 'enhanced' for medium complexity", () => {
    expect(resolveStrategy("medium", "research")).toBe("enhanced");
    expect(resolveStrategy("medium", "coding")).toBe("enhanced");
    expect(resolveStrategy("medium", "general")).toBe("enhanced");
  });

  it("returns 'enhanced' for high complexity + unknown intent", () => {
    expect(resolveStrategy("high", "unknown_intent")).toBe("enhanced");
  });
});

// ---------------------------------------------------------------------------
// normalizeComplexityLevel
// ---------------------------------------------------------------------------

describe("normalizeComplexityLevel", () => {
  it("normalizes valid levels", () => {
    expect(normalizeComplexityLevel("low")).toBe("low");
    expect(normalizeComplexityLevel("medium")).toBe("medium");
    expect(normalizeComplexityLevel("high")).toBe("high");
  });

  it("normalizes with case and whitespace", () => {
    expect(normalizeComplexityLevel("LOW")).toBe("low");
    expect(normalizeComplexityLevel("  Medium  ")).toBe("medium");
    expect(normalizeComplexityLevel("HIGH")).toBe("high");
  });

  it("returns null for invalid levels", () => {
    expect(normalizeComplexityLevel("extreme")).toBeNull();
    expect(normalizeComplexityLevel("")).toBeNull();
    expect(normalizeComplexityLevel("simple")).toBeNull();
  });
});
