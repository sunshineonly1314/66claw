/**
 * [CN-PATCH:memory-p0] 全量无差别测试
 *
 * 测试覆盖：
 * 1. hybrid.ts — CJK FTS5 查询构建（buildFtsQuery）
 * 2. search-tiering-cn.ts — 冷热分层搜索
 * 3. memory-schema.ts — trigram 迁移 + 回填（需要 node:sqlite）
 * 4. types.ts — updatedAt 类型兼容性
 */

import { describe, it, expect } from "vitest";
import { buildFtsQuery, bm25RankToScore, mergeHybridResults } from "./hybrid.js";
import { applyTimeTiering } from "./search-tiering-cn.js";
import type { MemorySearchResult } from "./types.js";

// ============================================================================
// 1. buildFtsQuery — CJK 扩展测试
// ============================================================================

describe("buildFtsQuery — CJK 扩展 [CN-PATCH:memory-p0]", () => {
  // ── 1.1 基础英文兼容性（确保未破坏上游行为）──
  it("英文 token 正常工作（向后兼容上游）", () => {
    expect(buildFtsQuery("hello world")).toBe('"hello" AND "world"');
    expect(buildFtsQuery("FOO_bar baz")).toBe('"FOO_bar" AND "baz"');
  });

  it("短英文 token（1-2 字符）不被过滤", () => {
    expect(buildFtsQuery("AI")).toBe('"AI"');
    expect(buildFtsQuery("go")).toBe('"go"');
    expect(buildFtsQuery("js")).toBe('"js"');
    expect(buildFtsQuery("a b c")).toBe('"a" AND "b" AND "c"');
  });

  it("纯空白/符号返回 null", () => {
    expect(buildFtsQuery("   ")).toBeNull();
    expect(buildFtsQuery("!@#$%")).toBeNull();
    expect(buildFtsQuery("")).toBeNull();
    expect(buildFtsQuery("...")).toBeNull();
  });

  // ── 1.2 CJK token 提取 ──
  it("提取连续中文字符为单个 token", () => {
    const result = buildFtsQuery("今天讨论了项目");
    // 7 个 CJK 字符 >= 3，应保留
    expect(result).toBe('"今天讨论了项目"');
  });

  it("混合中英文提取多个 token", () => {
    const result = buildFtsQuery("使用 React 进行前端开发");
    // "使用"(2 chars, CJK, < 3 → 过滤), "React"(英文, 保留), "进行前端开发"(5 chars, CJK, ≥ 3 → 保留)
    expect(result).toContain('"React"');
    expect(result).toContain('"进行前端开发"');
  });

  // ── 1.3 trigram 最小长度过滤 ──
  it("2 字符 CJK token 被过滤（trigram 最小窗口限制）", () => {
    // "讨论" 只有 2 个 CJK 字符，< 3，应被过滤
    expect(buildFtsQuery("讨论")).toBeNull();
  });

  it("恰好 3 字符 CJK token 保留", () => {
    expect(buildFtsQuery("讨论了")).toBe('"讨论了"');
  });

  it("1 字符 CJK token 被过滤", () => {
    expect(buildFtsQuery("是")).toBeNull();
  });

  it("多个短 CJK token 全被过滤 → 返回 null", () => {
    // "你 好" → 两个 1 字符 CJK token
    expect(buildFtsQuery("你 好")).toBeNull();
  });

  it("短 CJK + 英文混合：短 CJK 过滤，英文保留", () => {
    // "AI 讨论" → "AI"(英文, 保留), "讨论"(CJK, 2 chars, 过滤)
    expect(buildFtsQuery("AI 讨论")).toBe('"AI"');
  });

  it("长 CJK + 短 CJK 混合", () => {
    // "内存优化 的 关键点" → "内存优化"(4 chars, 保留), "的"(1 char, 过滤), "关键点"(3 chars, 保留)
    const result = buildFtsQuery("内存优化 的 关键点");
    expect(result).toBe('"内存优化" AND "关键点"');
  });

  // ── 1.4 CJK 扩展 B 区（罕见字）──
  it("CJK Extension B 字符被识别", () => {
    // \u3400-\u4DBF 范围
    const rareChar = "\u3400\u3401\u3402"; // 3 chars
    expect(buildFtsQuery(rareChar)).toBe(`"${rareChar}"`);
  });

  // ── 1.5 引号转义 — 标点被预处理清理，不切割 CJK 序列 ──
  it("嵌入引号被预处理清理，CJK 序列不被切割", () => {
    // 预处理: '测试"注入"攻击是可以的' → '测试注入攻击是可以的' (引号移除)
    // 正则匹配: "测试注入攻击是可以的" (10 chars, >= 3, 保留)
    const result = buildFtsQuery('测试"注入"攻击是可以的');
    expect(result).toBe('"测试注入攻击是可以的"');
  });

  // ── 1.6 边界条件 ──
  it("中文标点被清理，连续 CJK 合并", () => {
    // 预处理: "你好，世界！测试" → "你好世界测试" (标点移除)
    // 正则匹配: "你好世界测试" (6 chars, >= 3, 保留)
    expect(buildFtsQuery("你好，世界！测试")).toBe('"你好世界测试"');
  });

  it("日文片假名/平假名不被 CJK 正则匹配", () => {
    // 日文假名 \u3040-\u309F (平假名), \u30A0-\u30FF (片假名) 不在 CJK_PATTERN 范围内
    expect(buildFtsQuery("こんにちは")).toBeNull();
    expect(buildFtsQuery("カタカナ")).toBeNull();
  });

  it("韩文不被 CJK 正则匹配", () => {
    // 韩文 \uAC00-\uD7AF 不在 CJK_PATTERN 范围内
    expect(buildFtsQuery("한국어")).toBeNull();
  });

  // ── 1.7 【BUG 发现】连续中文没有空格分隔时的 token 切割 ──
  it("BUG-PROBE: 连续中文无空格时整体作为单 token", () => {
    // "你好世界测试" → 6 个 CJK 字符，整体匹配为 1 个 token
    // 这意味着 FTS5 trigram 搜索 "你好世界测试" 会精确匹配包含这 6 字符的文本
    const result = buildFtsQuery("你好世界测试");
    expect(result).toBe('"你好世界测试"');
  });
});

// ============================================================================
// 2. applyTimeTiering — 冷热分层测试
// ============================================================================

describe("applyTimeTiering [CN-PATCH:memory-p0]", () => {
  const NOW = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  function makeResult(overrides: Partial<MemorySearchResult> = {}): MemorySearchResult {
    return {
      path: "memory/test.md",
      startLine: 1,
      endLine: 10,
      // Default score 0.5. Note: dynamic threshold = min(maxScore*0.8, 0.6).
      // When testing time-based filtering, use high scores (>=0.8) for "hot" items
      // and low scores (<=0.3) for items that should be filtered out by time tier.
      score: 0.5,
      snippet: "test content",
      source: "memory",
      ...overrides,
    };
  }

  // ── 2.1 基础逻辑 ──
  it("结果数 <= 2 时直接返回全部（不过滤）", () => {
    const results = [
      makeResult({ updatedAt: NOW - 200 * DAY }), // very old
      makeResult({ updatedAt: NOW - 150 * DAY }), // very old
    ];
    const filtered = applyTimeTiering(results, NOW);
    expect(filtered).toHaveLength(2);
  });

  it("空数组返回空数组", () => {
    expect(applyTimeTiering([], NOW)).toHaveLength(0);
  });

  it("单个结果直接返回", () => {
    const results = [makeResult({ updatedAt: NOW - 200 * DAY })];
    expect(applyTimeTiering(results, NOW)).toHaveLength(1);
  });

  // ── 2.2 Hot 层（7 天内）──
  it("全部在 hot 层 → 返回全部", () => {
    const results = [
      makeResult({ updatedAt: NOW - 1 * DAY }),
      makeResult({ updatedAt: NOW - 3 * DAY }),
      makeResult({ updatedAt: NOW - 5 * DAY }),
    ];
    const filtered = applyTimeTiering(results, NOW);
    expect(filtered).toHaveLength(3);
  });

  it("hot 层有 2 个 + cold 层有 1 个 → 只返回 hot 层", () => {
    const results = [
      makeResult({ updatedAt: NOW - 1 * DAY, path: "hot1", score: 0.8 }),
      makeResult({ updatedAt: NOW - 3 * DAY, path: "hot2", score: 0.8 }),
      makeResult({ updatedAt: NOW - 100 * DAY, path: "cold1", score: 0.3 }),
    ];
    const filtered = applyTimeTiering(results, NOW);
    expect(filtered).toHaveLength(2);
    expect(filtered.every((r) => r.path.startsWith("hot"))).toBe(true);
  });

  // ── 2.3 回退逻辑 ──
  it("hot 层不足 2 个 → 回退到 warm 层（30 天）", () => {
    const results = [
      makeResult({ updatedAt: NOW - 1 * DAY, path: "hot1", score: 0.8 }),
      makeResult({ updatedAt: NOW - 15 * DAY, path: "warm1", score: 0.8 }),
      makeResult({ updatedAt: NOW - 100 * DAY, path: "cold1", score: 0.3 }),
    ];
    const filtered = applyTimeTiering(results, NOW);
    // hot: hot1(1) < 2 → fallback to warm
    // warm: hot1 + warm1 = 2 >= 2 → return
    expect(filtered).toHaveLength(2);
    expect(filtered.map((r) => r.path)).toContain("hot1");
    expect(filtered.map((r) => r.path)).toContain("warm1");
  });

  it("warm 层也不足 → 回退到 cold 层（120 天）", () => {
    const results = [
      makeResult({ updatedAt: NOW - 1 * DAY, path: "hot1" }),
      makeResult({ updatedAt: NOW - 60 * DAY, path: "cold1" }),
      makeResult({ updatedAt: NOW - 100 * DAY, path: "cold2" }),
    ];
    const filtered = applyTimeTiering(results, NOW);
    // hot: hot1(1) < 2 → fallback
    // warm: hot1(1) < 2 → fallback
    // cold: hot1 + cold1 + cold2 = 3 >= 2 → return
    expect(filtered).toHaveLength(3);
  });

  it("所有层都不够 → 返回全部", () => {
    const results = [
      makeResult({ updatedAt: NOW - 1 * DAY, path: "hot1" }),
      makeResult({ updatedAt: NOW - 200 * DAY, path: "ancient1" }), // > 120 days
      makeResult({ updatedAt: NOW - 300 * DAY, path: "ancient2" }),
    ];
    const filtered = applyTimeTiering(results, NOW);
    // hot: 1 < 2 → fallback
    // warm: 1 < 2 → fallback
    // cold: 1 < 2 → return all
    expect(filtered).toHaveLength(3);
  });

  // ── 2.4 updatedAt 为空的处理 ──
  it("updatedAt 为 undefined 视为 '永远有效'（memory/*.md 场景）", () => {
    const results = [
      makeResult({ updatedAt: undefined, path: "memory-no-ts", score: 0.8 }),
      makeResult({ updatedAt: NOW - 1 * DAY, path: "hot1", score: 0.8 }),
      makeResult({ updatedAt: NOW - 200 * DAY, path: "ancient1", score: 0.3 }),
    ];
    const filtered = applyTimeTiering(results, NOW);
    // hot 层: memory-no-ts(无时间戳, 通过) + hot1 = 2 >= 2 → 返回
    expect(filtered).toHaveLength(2);
    expect(filtered.map((r) => r.path)).toContain("memory-no-ts");
    expect(filtered.map((r) => r.path)).toContain("hot1");
  });

  it("全部无 updatedAt → 全部通过（等同于禁用分层）", () => {
    const results = [
      makeResult({ updatedAt: undefined }),
      makeResult({ updatedAt: undefined }),
      makeResult({ updatedAt: undefined }),
    ];
    const filtered = applyTimeTiering(results, NOW);
    expect(filtered).toHaveLength(3);
  });

  // ── 2.5 边界条件 ──
  it("恰好在 hot 边界（7天）上的结果属于 hot 层", () => {
    const exactBoundary = NOW - 7 * DAY;
    const results = [
      makeResult({ updatedAt: exactBoundary, path: "boundary", score: 0.8 }),
      makeResult({ updatedAt: NOW - 1 * DAY, path: "hot1", score: 0.8 }),
      makeResult({ updatedAt: NOW - 200 * DAY, path: "ancient", score: 0.3 }),
    ];
    const filtered = applyTimeTiering(results, NOW);
    // boundary: updatedAt === cutoff, cutoff = NOW - 7*DAY, boundary >= cutoff → 通过
    expect(filtered).toHaveLength(2);
    expect(filtered.map((r) => r.path)).toContain("boundary");
  });

  it("恰好在 hot 边界下方 1ms → 不属于 hot 层", () => {
    const justOutside = NOW - 7 * DAY - 1;
    const results = [
      makeResult({ updatedAt: justOutside, path: "just-outside", score: 0.8 }),
      makeResult({ updatedAt: NOW - 200 * DAY, path: "ancient", score: 0.3 }),
      makeResult({ updatedAt: NOW - 1 * DAY, path: "hot1", score: 0.8 }),
    ];
    const filtered = applyTimeTiering(results, NOW);
    // hot: hot1(1) < 2 → fallback
    // warm: hot1 + just-outside = 2 >= 2 → return
    expect(filtered).toHaveLength(2);
    expect(filtered.map((r) => r.path)).toContain("hot1");
    expect(filtered.map((r) => r.path)).toContain("just-outside");
  });

  // ── 2.6 updatedAt=0 正确处理 ──
  it("updatedAt=0 被视为 1970 年旧数据（非 '无时间戳'）", () => {
    // updatedAt=0 表示 Unix epoch（1970-01-01），应该被视为极旧的数据
    // 使用 == null 判断（只匹配 undefined/null），0 不再被误判
    const results = [
      makeResult({ updatedAt: 0, path: "epoch" }),
      makeResult({ updatedAt: NOW - 1 * DAY, path: "hot1" }),
      makeResult({ updatedAt: NOW - 200 * DAY, path: "ancient" }),
    ];
    const filtered = applyTimeTiering(results, NOW);
    // hot 层: hot1(1) < 2 → 回退
    // warm 层: hot1(1) < 2 → 回退
    // cold 层: hot1(1) < 2 → 返回全部
    expect(filtered).toHaveLength(3);
  });

  it("BUG-PROBE: 不保持原始排序（score 顺序可能被打乱）", () => {
    // applyTimeTiering 使用 filter()，filter 保持数组顺序
    // 但如果输入已按 score 排序，过滤后的子集仍然保持 score 顺序
    const results = [
      makeResult({ score: 0.9, updatedAt: NOW - 1 * DAY, path: "high-score" }),
      makeResult({ score: 0.5, updatedAt: NOW - 3 * DAY, path: "mid-score" }),
      makeResult({ score: 0.1, updatedAt: NOW - 100 * DAY, path: "low-score" }),
    ];
    const filtered = applyTimeTiering(results, NOW);
    expect(filtered).toHaveLength(2);
    // 验证顺序保持
    expect(filtered[0]?.path).toBe("high-score");
    expect(filtered[1]?.path).toBe("mid-score");
  });
});

// ============================================================================
// 3. MemorySearchResult 类型兼容性
// ============================================================================

describe("MemorySearchResult — updatedAt 字段 [CN-PATCH:memory-p0]", () => {
  it("updatedAt 可选字段不影响现有代码", () => {
    const result: MemorySearchResult = {
      path: "test.md",
      startLine: 1,
      endLine: 10,
      score: 0.8,
      snippet: "hello",
      source: "memory",
      // updatedAt 未设置
    };
    expect(result.updatedAt).toBeUndefined();
  });

  it("updatedAt 设置为 number 时正确", () => {
    const result: MemorySearchResult = {
      path: "test.md",
      startLine: 1,
      endLine: 10,
      score: 0.8,
      snippet: "hello",
      source: "sessions",
      updatedAt: Date.now(),
    };
    expect(typeof result.updatedAt).toBe("number");
  });
});

// ============================================================================
// 4. mergeHybridResults — CJK 源兼容
// ============================================================================

describe("mergeHybridResults — sessions 源兼容 [CN-PATCH:memory-p0]", () => {
  it("sessions 源的结果正确合并", () => {
    const merged = mergeHybridResults({
      vectorWeight: 0.7,
      textWeight: 0.3,
      vector: [
        {
          id: "sess-1",
          path: "sessions/2026-01-01.jsonl",
          startLine: 1,
          endLine: 20,
          source: "sessions",
          snippet: "对话记录",
          vectorScore: 0.8,
        },
      ],
      keyword: [
        {
          id: "mem-1",
          path: "memory/2026-01-01.md",
          startLine: 1,
          endLine: 5,
          source: "memory",
          snippet: "会议记录",
          textScore: 0.9,
        },
      ],
    });

    expect(merged).toHaveLength(2);
    const sess = merged.find((r) => r.source === "sessions");
    const mem = merged.find((r) => r.source === "memory");
    expect(sess).toBeDefined();
    expect(mem).toBeDefined();
    expect(sess?.score).toBeCloseTo(0.7 * 0.8);
    expect(mem?.score).toBeCloseTo(0.3 * 0.9);
  });
});
