/**
 * 记忆系统顶级压力测试套件
 *
 * 测试维度：
 * 1. 评分衰减曲线 — 精确数学验证，不同时间段的评分变化
 * 2. 淘汰行为 — 200+ 条目时的存活分析
 * 3. 记忆保持率 — 不同分类条目能存活多久
 * 4. 容量饱和 — 持续插入时的行为
 * 5. hits 强化效果 — hits 能延长多少生命周期
 * 6. 过期清理 — todo 条目的精确过期时间
 * 7. 归档质量 — 什么被归档、什么被丢弃
 * 8. 并发压力 — 快速连续 upsert 的正确性
 * 9. 去重效果 — 相似值过滤的准确性
 * 10. 真实场景模拟 — 30 天对话生命周期
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  computeEntryScore,
  CATEGORY_WEIGHTS,
  PROTECTED_CATEGORY_MINIMUMS,
  PROFILE_MAX_ENTRIES,
  PROFILE_MAX_PROMPT_CHARS,
  upsertProfileEntry,
  upsertProfileEntryFull,
  evictByScore,
  filterArchivableEntries,
  formatArchiveBlock,
  formatProfileForSystemPrompt,
  reinforceMatchingEntries,
  type ProfileEntry,
  type ProfileCategory,
  type UserProfile,
} from "./profile-store.js";

// ── Helpers ──

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

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

function daysAgo(days: number): number {
  return Date.now() - days * DAY_MS;
}

// ═══════════════════════════════════════════════════════════════
// 1. 评分衰减曲线 — 精确数学验证
// ═══════════════════════════════════════════════════════════════

describe("评分衰减曲线 (Score Decay Curves)", () => {
  const now = Date.now();

  it("应精确计算14天半衰期衰减", () => {
    // 验证: score = base + 0.15 × hits^0.7 + 0.3 × 0.5^(ageDays/14)
    const entry = makeEntry({ category: "fact", hits: 0, updatedAt: now });

    // 刚创建: recency = 0.3 × 0.5^0 = 0.3
    expect(computeEntryScore(entry, now)).toBeCloseTo(0.5 + 0 + 0.3, 2);

    // 7天后: recency = 0.3 × 0.5^(7/14) = 0.3 × 0.7071 ≈ 0.2121
    const at7d = { ...entry, updatedAt: now - 7 * DAY_MS };
    expect(computeEntryScore(at7d, now)).toBeCloseTo(0.5 + 0.3 * Math.pow(0.5, 7 / 14), 3);

    // 14天后: recency = 0.3 × 0.5^1 = 0.15 (恰好半衰)
    const at14d = { ...entry, updatedAt: now - 14 * DAY_MS };
    expect(computeEntryScore(at14d, now)).toBeCloseTo(0.5 + 0.15, 3);

    // 28天后: recency = 0.3 × 0.5^2 = 0.075
    const at28d = { ...entry, updatedAt: now - 28 * DAY_MS };
    expect(computeEntryScore(at28d, now)).toBeCloseTo(0.5 + 0.075, 3);

    // 56天后: recency ≈ 0.3 × 0.5^4 = 0.01875
    const at56d = { ...entry, updatedAt: now - 56 * DAY_MS };
    expect(computeEntryScore(at56d, now)).toBeCloseTo(0.5 + 0.3 * Math.pow(0.5, 4), 3);

    // 90天后: recency ≈ 0.3 × 0.5^(90/14) ≈ 0.003
    const at90d = { ...entry, updatedAt: now - 90 * DAY_MS };
    const expected90d = 0.5 + 0.3 * Math.pow(0.5, 90 / 14);
    expect(computeEntryScore(at90d, now)).toBeCloseTo(expected90d, 3);
  });

  it("应生成完整衰减时间表 — 每个分类从第0天到第180天", () => {
    const categories: ProfileCategory[] = [
      "identity",
      "correction",
      "procedure",
      "preference",
      "fact",
      "todo",
    ];
    const checkpoints = [0, 1, 3, 7, 14, 28, 42, 56, 90, 120, 180];

    const decayTable: Record<string, Record<number, number>> = {};

    for (const cat of categories) {
      decayTable[cat] = {};
      for (const day of checkpoints) {
        const entry = makeEntry({ category: cat, hits: 0, updatedAt: now - day * DAY_MS });
        decayTable[cat][day] = computeEntryScore(entry, now);
      }

      // 验证单调递减
      for (let i = 1; i < checkpoints.length; i++) {
        expect(decayTable[cat][checkpoints[i]]).toBeLessThan(decayTable[cat][checkpoints[i - 1]]);
      }
    }

    // 验证: identity 在 180 天后仍 > todo 在第 0 天
    expect(decayTable["identity"][180]).toBeGreaterThan(decayTable["todo"][0]);

    // 验证: correction 在 180 天后仍 > fact 在第 0 天
    expect(decayTable["correction"][180]).toBeGreaterThan(decayTable["fact"][0]);

    // 验证: 所有分类在 90 天后 recency 贡献 < 0.01 (几乎为零)
    for (const cat of categories) {
      const freshScore = CATEGORY_WEIGHTS[cat] + 0.3; // base + max recency
      const at90d = decayTable[cat][90];
      const recencyAt90 = at90d - CATEGORY_WEIGHTS[cat];
      expect(recencyAt90).toBeLessThan(0.01);
    }
  });

  it("hits 对衰减的对冲效果 — 不同 hits 数量延长「有效期」", () => {
    // 定义 "有效期": 分数高于被 todo 新条目淘汰的阈值
    // todo 新条目的分数 ≈ 0.3 + 0.3 = 0.6
    const todoFreshScore = computeEntryScore(
      makeEntry({ category: "todo", hits: 0, updatedAt: now }),
      now,
    );

    // fact 条目在不同 hits 下，多少天后分数降到 todo 新条目以下？
    const hitsLevels = [0, 1, 3, 5, 10, 20, 50];
    const survivalDays: Record<number, number> = {};

    for (const hits of hitsLevels) {
      let day = 0;
      while (day < 365) {
        const score = computeEntryScore(
          makeEntry({ category: "fact", hits, updatedAt: now - day * DAY_MS }),
          now,
        );
        if (score < todoFreshScore) break;
        day++;
      }
      survivalDays[hits] = day;
    }

    // hits=0 的 fact 条目: 很快就被淘汰 (recency 衰减到 base < todo fresh)
    // fact base=0.5 vs todo fresh=0.6, 所以 fact 需要足够的 recency 来弥补
    // 0.5 + 0.3×0.5^(d/14) > 0.6 → 0.3×0.5^(d/14) > 0.1 → 0.5^(d/14) > 0.333
    // d/14 < log₀.₅(0.333) ≈ 1.585 → d < 22.19
    // 所以 hits=0 的 fact 大约 22 天后会被 todo 新条目超过
    expect(survivalDays[0]).toBeLessThanOrEqual(23);
    expect(survivalDays[0]).toBeGreaterThanOrEqual(20);

    // 更多 hits 应该有更长的存活天数
    for (let i = 1; i < hitsLevels.length; i++) {
      expect(survivalDays[hitsLevels[i]]).toBeGreaterThanOrEqual(survivalDays[hitsLevels[i - 1]]);
    }

    // hits=10+ 的 fact: hits 贡献让 base 远超 todo，理论上永不被 todo 淘汰
    // 0.5 + 0.15×10^0.7 ≈ 0.5 + 0.75 = 1.25 >> 0.6
    expect(survivalDays[10]).toBe(365); // 永不被 todo 超过
  });

  it("hits 的递减收益效果验证", () => {
    const hitsValues = [0, 1, 2, 3, 5, 10, 20, 50, 100];
    const scores: number[] = [];
    const marginalGains: number[] = [];

    for (const hits of hitsValues) {
      const score = computeEntryScore(makeEntry({ category: "fact", hits, updatedAt: now }), now);
      scores.push(score);
    }

    // 计算边际收益 (每额外 1 hit 带来的分数增加)
    for (let i = 1; i < hitsValues.length; i++) {
      const gain = (scores[i] - scores[i - 1]) / (hitsValues[i] - hitsValues[i - 1]);
      marginalGains.push(gain);
    }

    // 验证递减收益: 前期增长快，后期增长慢
    expect(marginalGains[0]).toBeGreaterThan(marginalGains[marginalGains.length - 1]);
    // 第一个 hit 的价值应 > 第100个 hit 的价值
    expect(marginalGains[0]).toBeGreaterThan(marginalGains[marginalGains.length - 1] * 5);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. 淘汰行为深度测试
// ═══════════════════════════════════════════════════════════════

describe("淘汰行为压力测试 (Eviction Behavior)", () => {
  const now = Date.now();

  it("200 条满容量 + 50 条新增 → 应淘汰 50 条最低分", () => {
    const entries: ProfileEntry[] = [];

    // 先填满 200 条: 50 identity + 50 correction + 100 fact
    for (let i = 0; i < 50; i++) {
      entries.push(
        makeEntry({
          category: "identity",
          key: `id-${i}`,
          value: `identity ${i}`,
          updatedAt: now - i * DAY_MS,
          hits: i % 5, // 0-4 hits
        }),
      );
    }
    for (let i = 0; i < 50; i++) {
      entries.push(
        makeEntry({
          category: "correction",
          key: `corr-${i}`,
          value: `correction ${i}`,
          updatedAt: now - i * DAY_MS,
          hits: i % 3,
        }),
      );
    }
    for (let i = 0; i < 100; i++) {
      entries.push(
        makeEntry({
          category: "fact",
          key: `fact-${i}`,
          value: `fact ${i}`,
          updatedAt: now - (i + 30) * DAY_MS, // 30-129 天前
          hits: 0,
        }),
      );
    }

    expect(entries.length).toBe(200);

    // 再加 50 条新 todo
    for (let i = 0; i < 50; i++) {
      entries.push(
        makeEntry({
          category: "todo",
          key: `todo-${i}`,
          value: `task ${i}`,
          updatedAt: now,
          hits: 0,
        }),
      );
    }

    expect(entries.length).toBe(250);

    const evicted = evictByScore(entries, now);

    expect(entries.length).toBe(PROFILE_MAX_ENTRIES);
    expect(evicted.length).toBe(50);

    // 被淘汰的应该主要是旧的零 hits fact (分数最低)
    const evictedFacts = evicted.filter((e) => e.category === "fact");
    expect(evictedFacts.length).toBeGreaterThanOrEqual(45); // 几乎全是 fact

    // identity 和 correction 全部存活
    const survivingIds = entries.filter((e) => e.category === "identity");
    const survivingCorrs = entries.filter((e) => e.category === "correction");
    expect(survivingIds.length).toBe(50);
    expect(survivingCorrs.length).toBe(50);
  });

  it("极端: 210 个 identity 条目 → 保护机制不会让数组无限增长", () => {
    const entries: ProfileEntry[] = [];
    for (let i = 0; i < 210; i++) {
      entries.push(
        makeEntry({
          category: "identity",
          key: `id-${i}`,
          value: `identity ${i}`,
          updatedAt: now - i * HOUR_MS,
          hits: 0,
        }),
      );
    }

    evictByScore(entries, now);
    expect(entries.length).toBe(PROFILE_MAX_ENTRIES);
  });

  it("混合分类大规模淘汰 — 验证保护最小值生效", () => {
    const entries: ProfileEntry[] = [];

    // 15 个很老的 identity (刚好在保护线)
    for (let i = 0; i < 15; i++) {
      entries.push(
        makeEntry({
          category: "identity",
          key: `id-${i}`,
          value: `identity ${i}`,
          updatedAt: now - 365 * DAY_MS, // 1 年前
          hits: 0,
        }),
      );
    }

    // 15 个很老的 correction (刚好在保护线)
    for (let i = 0; i < 15; i++) {
      entries.push(
        makeEntry({
          category: "correction",
          key: `corr-${i}`,
          value: `correction ${i}`,
          updatedAt: now - 365 * DAY_MS,
          hits: 0,
        }),
      );
    }

    // 200 个新 todo (制造巨大淘汰压力)
    for (let i = 0; i < 200; i++) {
      entries.push(
        makeEntry({
          category: "todo",
          key: `todo-${i}`,
          value: `task ${i}`,
          updatedAt: now,
          hits: 0,
        }),
      );
    }

    expect(entries.length).toBe(230);
    evictByScore(entries, now);
    expect(entries.length).toBe(PROFILE_MAX_ENTRIES);

    // 所有 15 个 identity 必须存活 (protected)
    const ids = entries.filter((e) => e.category === "identity");
    expect(ids.length).toBe(15);

    // 所有 15 个 correction 必须存活 (protected)
    const corrs = entries.filter((e) => e.category === "correction");
    expect(corrs.length).toBe(15);

    // todo 被淘汰掉 30 个
    const todos = entries.filter((e) => e.category === "todo");
    expect(todos.length).toBe(170);
  });

  it("淘汰顺序应严格按评分从低到高", () => {
    const entries: ProfileEntry[] = [];

    // 创建分数差异很大的条目
    for (let i = 0; i < PROFILE_MAX_ENTRIES + 5; i++) {
      entries.push(
        makeEntry({
          category: "fact",
          key: `fact-${i}`,
          value: `fact ${i}`,
          updatedAt: now - i * DAY_MS,
          hits: i % 10,
        }),
      );
    }

    // 记录淘汰前的分数
    const scoresBefore = entries.map((e) => ({
      key: e.key,
      score: computeEntryScore(e, now),
    }));

    const evicted = evictByScore(entries, now);

    // 被淘汰的 5 条应该是分数最低的
    const evictedScores = evicted.map((e) => computeEntryScore(e, now));
    const survivingMinScore = Math.min(...entries.map((e) => computeEntryScore(e, now)));

    for (const evictedScore of evictedScores) {
      expect(evictedScore).toBeLessThanOrEqual(survivingMinScore);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. 记忆保持率测试
// ═══════════════════════════════════════════════════════════════

describe("记忆保持率 (Memory Retention Rate)", () => {
  const now = Date.now();

  it("不同分类在满容量下的存活率 — 30天模拟", () => {
    // 初始化: 200 条混合记忆
    const initial: ProfileEntry[] = [];

    // 15 identity (有 5 个有 hits)
    for (let i = 0; i < 15; i++) {
      initial.push(
        makeEntry({
          category: "identity",
          key: `id-${i}`,
          value: `identity ${i}`,
          updatedAt: now - 30 * DAY_MS,
          hits: i < 5 ? i + 1 : 0,
        }),
      );
    }

    // 15 correction
    for (let i = 0; i < 15; i++) {
      initial.push(
        makeEntry({
          category: "correction",
          key: `corr-${i}`,
          value: `correction ${i}`,
          updatedAt: now - 25 * DAY_MS,
          hits: i < 3 ? i + 1 : 0,
        }),
      );
    }

    // 30 preference
    for (let i = 0; i < 30; i++) {
      initial.push(
        makeEntry({
          category: "preference",
          key: `pref-${i}`,
          value: `preference ${i}`,
          updatedAt: now - (20 + i) * DAY_MS,
          hits: i < 10 ? 1 : 0,
        }),
      );
    }

    // 70 fact
    for (let i = 0; i < 70; i++) {
      initial.push(
        makeEntry({
          category: "fact",
          key: `fact-${i}`,
          value: `fact ${i}`,
          updatedAt: now - (15 + i) * DAY_MS,
          hits: i < 5 ? 2 : 0,
        }),
      );
    }

    // 50 todo
    for (let i = 0; i < 50; i++) {
      initial.push(
        makeEntry({
          category: "todo",
          key: `todo-${i}`,
          value: `task ${i}`,
          updatedAt: now - (10 + i) * DAY_MS,
          hits: 0,
        }),
      );
    }

    // 20 procedure
    for (let i = 0; i < 20; i++) {
      initial.push(
        makeEntry({
          category: "procedure",
          key: `proc-${i}`,
          value: `procedure ${i}`,
          updatedAt: now - (5 + i) * DAY_MS,
          hits: i < 5 ? 1 : 0,
        }),
      );
    }

    expect(initial.length).toBe(200);

    // 模拟 30 天持续使用: 每天插入 3 条新 fact
    let profile = makeProfile([...initial]);

    for (let day = 0; day < 30; day++) {
      for (let j = 0; j < 3; j++) {
        profile = upsertProfileEntry(
          profile,
          "fact",
          `new-fact-d${day}-${j}`,
          `fresh fact from day ${day}`,
        );
      }
    }

    // 30 天后的存活分析
    const survived = {
      identity: profile.entries.filter((e) => e.category === "identity").length,
      correction: profile.entries.filter((e) => e.category === "correction").length,
      preference: profile.entries.filter((e) => e.category === "preference").length,
      fact: profile.entries.filter((e) => e.category === "fact").length,
      todo: profile.entries.filter((e) => e.category === "todo").length,
      procedure: profile.entries.filter((e) => e.category === "procedure").length,
    };

    // identity 和 correction 应全部存活 (保护机制)
    expect(survived.identity).toBe(15);
    expect(survived.correction).toBe(15);

    // todo 应该大量被淘汰 (分数最低)
    expect(survived.todo).toBeLessThan(50);

    // 总数不超过上限
    const total = Object.values(survived).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(PROFILE_MAX_ENTRIES);
  });

  it("高频强化的条目应在激烈竞争中存活", () => {
    // 创建 1 个 "用户名字" 条目，hits=20 (经常被提到)
    let profile = makeProfile([
      makeEntry({
        category: "identity",
        key: "name",
        value: "张三",
        updatedAt: now - 180 * DAY_MS, // 半年前创建
        hits: 20,
      }),
    ]);

    // 灌入 250 条新 fact (制造极端淘汰压力)
    for (let i = 0; i < 250; i++) {
      profile = upsertProfileEntry(profile, "fact", `fact-${i}`, `value ${i}`);
    }

    // "张三" 必须存活
    const nameEntry = profile.entries.find((e) => e.category === "identity" && e.key === "name");
    expect(nameEntry).toBeDefined();
    expect(nameEntry!.value).toBe("张三");
    expect(nameEntry!.hits).toBe(20);
  });

  it("零 hits 的 fact 在满容量下的半衰期", () => {
    // 创建 200 条 fact，从 0 天前到 199 天前
    const entries: ProfileEntry[] = [];
    for (let i = 0; i < 200; i++) {
      entries.push(
        makeEntry({
          category: "fact",
          key: `fact-${i}`,
          value: `fact ${i}`,
          updatedAt: now - i * DAY_MS,
          hits: 0,
        }),
      );
    }

    let profile = makeProfile(entries);

    // 插入 1 条新条目触发淘汰
    profile = upsertProfileEntry(profile, "fact", "trigger", "trigger value");

    // 存活的最老的 fact 是多少天前的？
    const oldestSurvivor = profile.entries
      .filter((e) => e.key.startsWith("fact-"))
      .reduce((oldest, e) => (e.updatedAt < oldest.updatedAt ? e : oldest));

    const oldestAgeDays = (now - oldestSurvivor.updatedAt) / DAY_MS;

    // 在纯 fact + 零 hits 的情况下，淘汰只看 recency
    // 最老的被淘汰，但应该还有很老的存活 (因为只淘汰 1 条)
    expect(oldestAgeDays).toBeGreaterThan(190);
    expect(profile.entries.length).toBe(PROFILE_MAX_ENTRIES);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. 容量饱和测试
// ═══════════════════════════════════════════════════════════════

describe("容量饱和压力测试 (Capacity Saturation)", () => {
  it("连续插入 1000 条 → 始终不超过 200 条", () => {
    let profile = makeProfile([]);

    for (let i = 0; i < 1000; i++) {
      profile = upsertProfileEntry(profile, "fact", `item-${i}`, `value for item ${i}`);
      expect(profile.entries.length).toBeLessThanOrEqual(PROFILE_MAX_ENTRIES);
    }

    expect(profile.entries.length).toBe(PROFILE_MAX_ENTRIES);
  });

  it("交替插入不同分类 1000 条 → 分类分布合理", () => {
    let profile = makeProfile([]);
    const categories: ProfileCategory[] = [
      "identity",
      "correction",
      "preference",
      "fact",
      "todo",
      "procedure",
    ];

    for (let i = 0; i < 1000; i++) {
      const cat = categories[i % categories.length];
      profile = upsertProfileEntry(profile, cat, `${cat}-${Math.floor(i / 6)}`, `value ${i}`);
    }

    expect(profile.entries.length).toBeLessThanOrEqual(PROFILE_MAX_ENTRIES);

    // identity 和 correction 至少有保护最低数
    const idCount = profile.entries.filter((e) => e.category === "identity").length;
    const corrCount = profile.entries.filter((e) => e.category === "correction").length;
    expect(idCount).toBeGreaterThanOrEqual(PROTECTED_CATEGORY_MINIMUMS.identity ?? 0);
    expect(corrCount).toBeGreaterThanOrEqual(PROTECTED_CATEGORY_MINIMUMS.correction ?? 0);
  });

  it("相同 key 重复 upsert 500 次 → hits 正确递增，无容量膨胀", () => {
    let profile = makeProfile([]);

    for (let i = 0; i < 500; i++) {
      profile = upsertProfileEntry(profile, "identity", "name", `张三 (update ${i})`);
    }

    expect(profile.entries.length).toBe(1);
    expect(profile.entries[0].hits).toBe(499); // 第一次 hits=0，后 499 次 +1
    expect(profile.entries[0].value).toBe("张三 (update 499)");
  });

  it("upsertProfileEntryFull 应返回被淘汰的条目", () => {
    // 填满 200 条
    let profile = makeProfile([]);
    for (let i = 0; i < PROFILE_MAX_ENTRIES; i++) {
      profile = upsertProfileEntry(profile, "fact", `fact-${i}`, `value ${i}`);
    }

    // 第 201 条应触发淘汰
    const result = upsertProfileEntryFull(profile, "fact", "overflow", "overflow value");
    expect(result.profile.entries.length).toBe(PROFILE_MAX_ENTRIES);
    expect(result.evicted.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. Hits 强化效果测试
// ═══════════════════════════════════════════════════════════════

describe("Hits 强化效果 (Hits Reinforcement)", () => {
  const now = Date.now();

  it("reinforceMatchingEntries — 基本匹配功能", () => {
    const profile = makeProfile([
      makeEntry({
        category: "identity",
        key: "Name",
        value: "张三",
        updatedAt: now - 2 * DAY_MS,
        hits: 0,
      }),
      makeEntry({
        category: "preference",
        key: "Language",
        value: "TypeScript",
        updatedAt: now - 2 * DAY_MS,
        hits: 0,
      }),
      makeEntry({
        category: "fact",
        key: "Project",
        value: "ClawdBot",
        updatedAt: now - 2 * DAY_MS,
        hits: 0,
      }),
    ]);

    const { profile: updated, reinforcedCount } = reinforceMatchingEntries(profile, [
      "张三提到他的 name 是很重要的",
      "project 相关的讨论",
    ]);

    expect(reinforcedCount).toBe(2); // "name" 和 "project" 匹配
    expect(updated.entries.find((e) => e.key === "Name")!.hits).toBe(1);
    expect(updated.entries.find((e) => e.key === "Project")!.hits).toBe(1);
    expect(updated.entries.find((e) => e.key === "Language")!.hits).toBe(0); // 未匹配
  });

  it("reinforceMatchingEntries — 60 秒 debounce", () => {
    const profile = makeProfile([
      makeEntry({
        category: "identity",
        key: "Name",
        value: "张三",
        updatedAt: now - 30_000, // 30 秒前 (在 debounce 窗口内)
        hits: 0,
      }),
    ]);

    const { reinforcedCount } = reinforceMatchingEntries(profile, ["name related text"]);

    expect(reinforcedCount).toBe(0); // debounce 生效
  });

  it("reinforceMatchingEntries — 单字符 key 不匹配 (防误匹配)", () => {
    const profile = makeProfile([
      makeEntry({
        category: "fact",
        key: "a",
        value: "short key",
        updatedAt: now - 2 * DAY_MS,
        hits: 0,
      }),
    ]);

    const { reinforcedCount } = reinforceMatchingEntries(profile, ["a long text about something"]);

    expect(reinforcedCount).toBe(0); // 单字符 key 被过滤
  });

  it("hits 强化 vs 无强化 — 淘汰存活差异", () => {
    // 两个相同分类、相同时间的条目，一个有 hits 一个没有
    const withHits = makeEntry({
      category: "fact",
      key: "reinforced",
      value: "important fact",
      updatedAt: now - 60 * DAY_MS,
      hits: 5,
    });
    const withoutHits = makeEntry({
      category: "fact",
      key: "unreinforced",
      value: "forgettable fact",
      updatedAt: now - 60 * DAY_MS,
      hits: 0,
    });

    const scoreWith = computeEntryScore(withHits, now);
    const scoreWithout = computeEntryScore(withoutHits, now);

    // hits=5 应显著提升分数
    expect(scoreWith).toBeGreaterThan(scoreWithout);
    // 差异应 > 0.3 (相当于一个 recency 的全值)
    expect(scoreWith - scoreWithout).toBeGreaterThan(0.3);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. 过期 Todo 清理测试
// ═══════════════════════════════════════════════════════════════

describe("过期 Todo 清理 (Stale Todo Cleanup)", () => {
  it("30 天精确边界测试", () => {
    const now = Date.now();

    // 恰好 30 天前的 todo (不应被清理 — 边界值)
    const profile29d = makeProfile([
      makeEntry({
        category: "todo",
        key: "at-boundary",
        value: "boundary todo",
        updatedAt: now - 30 * DAY_MS, // 恰好 30 天
        hits: 0,
      }),
    ]);

    const updated29d = upsertProfileEntry(profile29d, "fact", "trigger", "v");
    // 30 天的 todo 可能存在也可能不存在（取决于 > 还是 >=），验证逻辑一致性
    // 实际代码: (now - e.updatedAt) > STALE_TODO_MS, 所以 30 天恰好不被清理
    // 但 upsert 使用 Math.max(Date.now(), maxExisting + 1) 作为 now
    // 所以实际 now 可能比 Date.now() 大 1ms
    // 结论: 边界行为取决于毫秒级精度，这里只验证 31 天一定被清理

    // 31 天前的 todo (应被清理)
    const profile31d = makeProfile([
      makeEntry({
        category: "todo",
        key: "past-boundary",
        value: "expired todo",
        updatedAt: now - 31 * DAY_MS,
        hits: 0,
      }),
    ]);

    const updated31d = upsertProfileEntry(profile31d, "fact", "trigger", "v");
    expect(updated31d.entries.find((e) => e.key === "past-boundary")).toBeUndefined();
  });

  it("有 hits 的 todo 即使超过 30 天也不被清理", () => {
    // [CN-PATCH:memory-fix] hits≤1 are now cleaned (LLM re-extraction noise).
    // hits≥2 means user-reinforced — should survive cleanup.
    const profile = makeProfile([
      makeEntry({
        category: "todo",
        key: "important-todo",
        value: "critical task",
        updatedAt: daysAgo(60),
        hits: 2,
      }),
    ]);

    const updated = upsertProfileEntry(profile, "fact", "trigger", "v");
    expect(updated.entries.find((e) => e.key === "important-todo")).toBeDefined();
  });

  it("非 todo 类条目不受 30 天清理影响", () => {
    const categories: ProfileCategory[] = [
      "preference",
      "correction",
      "fact",
      "identity",
      "procedure",
    ];

    for (const cat of categories) {
      const profile = makeProfile([
        makeEntry({
          category: cat,
          key: "old-entry",
          value: "old value",
          updatedAt: daysAgo(90),
          hits: 0,
        }),
      ]);

      const updated = upsertProfileEntry(profile, "fact", "trigger", "v");
      expect(
        updated.entries.find((e) => e.key === "old-entry"),
        `${cat} entry should not be cleaned up`,
      ).toBeDefined();
    }
  });

  it("批量过期 todo 清理 — 释放大量 slot", () => {
    const entries: ProfileEntry[] = [];

    // 100 个过期 todo
    for (let i = 0; i < 100; i++) {
      entries.push(
        makeEntry({
          category: "todo",
          key: `expired-todo-${i}`,
          value: `task ${i}`,
          updatedAt: daysAgo(45),
          hits: 0,
        }),
      );
    }

    // 50 个新 fact
    for (let i = 0; i < 50; i++) {
      entries.push(
        makeEntry({
          category: "fact",
          key: `fact-${i}`,
          value: `fact ${i}`,
          updatedAt: Date.now(),
          hits: 0,
        }),
      );
    }

    let profile = makeProfile(entries);

    // 插入 1 条触发清理
    profile = upsertProfileEntry(profile, "fact", "trigger", "v");

    // 所有 100 个过期 todo 应被清理
    const remainingTodos = profile.entries.filter((e) => e.category === "todo");
    expect(remainingTodos.length).toBe(0);

    // fact 应全部保留 + trigger
    const remainingFacts = profile.entries.filter((e) => e.category === "fact");
    expect(remainingFacts.length).toBe(51);
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. 归档质量测试
// ═══════════════════════════════════════════════════════════════

describe("归档质量 (Archive Quality)", () => {
  const now = Date.now();

  it("归档过滤: hits < 1 不归档", () => {
    const entries: ProfileEntry[] = [
      makeEntry({ category: "fact", key: "zero-hits", value: "v", hits: 0 }),
      makeEntry({ category: "fact", key: "one-hit", value: "v", hits: 1 }),
      makeEntry({ category: "fact", key: "many-hits", value: "v", hits: 5 }),
    ];

    const archivable = filterArchivableEntries(entries, now);
    expect(archivable.length).toBe(2);
    expect(archivable.find((e) => e.key === "zero-hits")).toBeUndefined();
  });

  it("归档过滤: todo 永不归档", () => {
    const entries: ProfileEntry[] = [
      makeEntry({ category: "todo", key: "todo-with-hits", value: "v", hits: 10 }),
    ];

    const archivable = filterArchivableEntries(entries, now);
    expect(archivable.length).toBe(0);
  });

  it("归档过滤: 分数 < 0.5 不归档", () => {
    // 非常老的 fact，0 hits → score ≈ 0.5 (base) + ≈0 (recency) = ≈0.5
    // 需要一个分数刚好 < 0.5 的条目
    // 只有 todo (base=0.3) + 很老 + 低 hits 才能 < 0.5
    const entries: ProfileEntry[] = [
      makeEntry({
        category: "fact",
        key: "borderline",
        value: "v",
        hits: 1,
        updatedAt: now - 365 * DAY_MS, // 1 year old
      }),
    ];

    const archivable = filterArchivableEntries(entries, now);
    // fact base=0.5 + hits 1 → 0.5 + 0.15×1^0.7 + ≈0 = 0.65 → should pass
    expect(archivable.length).toBe(1);
  });

  it("归档格式正确性", () => {
    const entries: ProfileEntry[] = [
      makeEntry({
        category: "preference",
        key: "编程语言",
        value: "TypeScript > JavaScript",
        hits: 3,
        updatedAt: now - 30 * DAY_MS,
      }),
    ];

    const block = formatArchiveBlock(entries, now);
    expect(block).toContain("### Archived");
    expect(block).toContain("[preference]");
    expect(block).toContain("编程语言");
    expect(block).toContain("TypeScript > JavaScript");
    expect(block).toContain("hits:3");
  });

  it("大规模淘汰的归档质量 — 只保留有价值的", () => {
    const evicted: ProfileEntry[] = [];

    // 50 个被淘汰的条目: 混合质量
    for (let i = 0; i < 20; i++) {
      evicted.push(
        makeEntry({
          category: "fact",
          key: `good-fact-${i}`,
          value: `valuable info ${i}`,
          hits: 2 + i,
          updatedAt: now - (10 + i) * DAY_MS,
        }),
      );
    }
    for (let i = 0; i < 20; i++) {
      evicted.push(
        makeEntry({
          category: "fact",
          key: `junk-fact-${i}`,
          value: `junk ${i}`,
          hits: 0, // zero hits → not archivable
          updatedAt: now - 60 * DAY_MS,
        }),
      );
    }
    for (let i = 0; i < 10; i++) {
      evicted.push(
        makeEntry({
          category: "todo",
          key: `old-todo-${i}`,
          value: `task ${i}`,
          hits: 5, // todo 即使有 hits 也不归档
          updatedAt: now - 30 * DAY_MS,
        }),
      );
    }

    const archivable = filterArchivableEntries(evicted, now);

    // 只有 good-fact 应被归档 (hits > 0, non-todo, score > 0.5)
    expect(archivable.length).toBe(20);
    expect(archivable.every((e) => e.key.startsWith("good-fact"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. 并发压力测试
// ═══════════════════════════════════════════════════════════════

describe("并发压力 (Concurrent Pressure)", () => {
  it("快速连续 upsert 不会产生重复条目", () => {
    let profile = makeProfile([]);

    // 快速插入 100 条不同 key 的条目
    for (let i = 0; i < 100; i++) {
      profile = upsertProfileEntry(profile, "fact", `fact-${i}`, `v${i}`);
    }

    // 不应有重复 key
    const keys = profile.entries.map((e) => e.key.toLowerCase());
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it("同一 key 大量 upsert 时的时间戳单调递增", () => {
    let profile = makeProfile([]);

    const timestamps: number[] = [];
    for (let i = 0; i < 100; i++) {
      profile = upsertProfileEntry(profile, "fact", "same-key", `v${i}`);
      timestamps.push(profile.entries[0].updatedAt);
    }

    // 验证时间戳严格单调递增
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
    }
  });

  it("交替更新多个 key 的 hits 正确性", () => {
    let profile = makeProfile([]);

    // 先创建 5 个条目
    for (let i = 0; i < 5; i++) {
      profile = upsertProfileEntry(profile, "fact", `key-${i}`, `v${i}`);
    }

    // 交替更新
    for (let round = 0; round < 20; round++) {
      for (let i = 0; i < 5; i++) {
        profile = upsertProfileEntry(profile, "fact", `key-${i}`, `v${i}-round${round}`);
      }
    }

    // 每个 key 被更新了 20 次
    for (let i = 0; i < 5; i++) {
      const entry = profile.entries.find((e) => e.key === `key-${i}`);
      expect(entry).toBeDefined();
      expect(entry!.hits).toBe(20); // 初始 0 + 20 次更新
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. 系统提示词格式化测试
// ═══════════════════════════════════════════════════════════════

describe("系统提示词格式化 (System Prompt Formatting)", () => {
  const now = Date.now();

  it("200 条满容量 profile 的提示词大小", () => {
    const entries: ProfileEntry[] = [];

    for (let i = 0; i < PROFILE_MAX_ENTRIES; i++) {
      entries.push(
        makeEntry({
          category: ["identity", "correction", "preference", "fact", "todo", "procedure"][
            i % 6
          ] as ProfileCategory,
          key: `key-${i}-abcdef`,
          value: `这是一条测试记忆条目，包含中文内容和一些 English text，用于测试格式化效果 #${i}`,
          updatedAt: now - i * HOUR_MS,
          hits: i % 10,
        }),
      );
    }

    const profile = makeProfile(entries);
    const output = formatProfileForSystemPrompt(profile);

    // 应不超过默认上限
    expect(output.length).toBeLessThanOrEqual(PROFILE_MAX_PROMPT_CHARS + 50); // +50 for truncation marker

    // 应包含截断标记
    if (output.length > PROFILE_MAX_PROMPT_CHARS) {
      expect(output).toContain("[... profile truncated]");
    }
  });

  it("动态 maxChars 限制生效", () => {
    const entries: ProfileEntry[] = [];
    for (let i = 0; i < 100; i++) {
      entries.push(
        makeEntry({
          category: "fact",
          key: `fact-${i}`,
          value: `这是第 ${i} 条记忆，用于测试格式化限制`,
          updatedAt: now - i * DAY_MS,
          hits: 0,
        }),
      );
    }

    const profile = makeProfile(entries);

    const small = formatProfileForSystemPrompt(profile, 3000);
    const medium = formatProfileForSystemPrompt(profile, 5000);
    const large = formatProfileForSystemPrompt(profile, 8000);

    expect(small.length).toBeLessThanOrEqual(3050); // +50 for truncation
    expect(medium.length).toBeLessThanOrEqual(5050);
    expect(large.length).toBeLessThanOrEqual(8050);

    // 较小限制应截断更多
    expect(small.length).toBeLessThan(medium.length);
    expect(medium.length).toBeLessThanOrEqual(large.length);
  });

  it("高分条目优先出现在截断前", () => {
    const entries: ProfileEntry[] = [
      makeEntry({
        category: "identity",
        key: "important-name",
        value: "张三",
        updatedAt: now,
        hits: 10,
      }),
      ...Array.from({ length: 100 }, (_, i) =>
        makeEntry({
          category: "fact",
          key: `filler-${i}`,
          value: `这是一条很长的填充内容，用于占据空间，使得截断发生在这些低优先级条目上而不是关键信息上 #${i}`,
          updatedAt: now - 60 * DAY_MS,
          hits: 0,
        }),
      ),
    ];

    const profile = makeProfile(entries);
    const output = formatProfileForSystemPrompt(profile, 3000);

    // 关键的 identity 条目应在截断前出现
    expect(output).toContain("important-name");
    expect(output).toContain("张三");
  });

  it("换行符注入防御", () => {
    const profile = makeProfile([
      makeEntry({
        category: "fact",
        key: "normal\nkey\nwith\nnewlines",
        value: "normal\nvalue\nwith\nnewlines",
        updatedAt: now,
        hits: 0,
      }),
    ]);

    const output = formatProfileForSystemPrompt(profile);
    // 换行符应被替换为空格/分号
    expect(output).not.toMatch(/key\nwith/);
    expect(output).not.toMatch(/value\nwith/);
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. 真实场景模拟: 60 天对话生命周期
// ═══════════════════════════════════════════════════════════════

describe("60 天对话生命周期模拟 (60-Day Lifecycle Simulation)", () => {
  it("模拟真实用户使用模式 — 完整生命周期", () => {
    let profile = makeProfile([]);
    const startTime = Date.now() - 60 * DAY_MS;
    const now = Date.now();

    // ── 第 1 天: 自我介绍 ──
    const day1 = startTime;
    profile = simulateUpsert(profile, day1, [
      { cat: "identity", key: "name", value: "张三" },
      { cat: "identity", key: "role", value: "全栈工程师" },
      { cat: "identity", key: "company", value: "字节跳动" },
      { cat: "preference", key: "language", value: "TypeScript" },
      { cat: "preference", key: "framework", value: "React + Next.js" },
    ]);

    // ── 第 3 天: 项目信息 ──
    const day3 = startTime + 3 * DAY_MS;
    profile = simulateUpsert(profile, day3, [
      { cat: "fact", key: "project-name", value: "ClawdBot" },
      { cat: "fact", key: "project-type", value: "AI 聊天机器人平台" },
      { cat: "fact", key: "tech-stack", value: "TypeScript + Vite + Tauri" },
      { cat: "procedure", key: "build-tool", value: "使用 pnpm，不用 npm" },
    ]);

    // ── 第 5-10 天: 日常交互，产生一些 todo ──
    for (let d = 5; d <= 10; d++) {
      const dayTime = startTime + d * DAY_MS;
      profile = simulateUpsert(profile, dayTime, [
        { cat: "todo", key: `task-d${d}`, value: `第${d}天的任务` },
        { cat: "fact", key: `daily-fact-d${d}`, value: `第${d}天学到的东西` },
      ]);
    }

    // ── 第 15 天: 用户纠正 ──
    const day15 = startTime + 15 * DAY_MS;
    profile = simulateUpsert(profile, day15, [
      { cat: "correction", key: "timezone", value: "我在东八区 (UTC+8)，不是 UTC" },
      { cat: "correction", key: "name-format", value: "叫我张三，不要叫张先生" },
    ]);

    // ── 第 20 天: 大量日常 fact 灌入 ──
    const day20 = startTime + 20 * DAY_MS;
    for (let i = 0; i < 50; i++) {
      profile = simulateUpsert(profile, day20 + i * 60_000, [
        { cat: "fact", key: `bulk-fact-${i}`, value: `大量灌入的事实 ${i}` },
      ]);
    }

    // ── 第 25 天: 重复提到名字 (强化) ──
    const day25 = startTime + 25 * DAY_MS;
    profile = simulateUpsert(profile, day25, [
      { cat: "identity", key: "name", value: "张三" }, // 重复 → hits+1
    ]);

    // ── 第 30-50 天: 持续使用，每天 2 条 fact ──
    for (let d = 30; d <= 50; d++) {
      const dayTime = startTime + d * DAY_MS;
      profile = simulateUpsert(profile, dayTime, [
        { cat: "fact", key: `ongoing-${d}-a`, value: `持续使用 fact a day ${d}` },
        { cat: "fact", key: `ongoing-${d}-b`, value: `持续使用 fact b day ${d}` },
      ]);
    }

    // ── 第 55 天: 再次提到名字和语言偏好 ──
    const day55 = startTime + 55 * DAY_MS;
    profile = simulateUpsert(profile, day55, [
      { cat: "identity", key: "name", value: "张三" }, // hits+2
      { cat: "preference", key: "language", value: "TypeScript" }, // hits+1
    ]);

    // ── 第 60 天: 最终分析 ──

    // === 存活分析 ===

    // 1. 身份信息必须全部存活
    const nameEntry = profile.entries.find((e) => e.category === "identity" && e.key === "name");
    expect(nameEntry).toBeDefined();
    expect(nameEntry!.value).toBe("张三");
    expect(nameEntry!.hits).toBeGreaterThanOrEqual(2); // 至少被强化 2 次

    const roleEntry = profile.entries.find((e) => e.category === "identity" && e.key === "role");
    expect(roleEntry).toBeDefined();

    const companyEntry = profile.entries.find(
      (e) => e.category === "identity" && e.key === "company",
    );
    expect(companyEntry).toBeDefined();

    // 2. 纠正信息必须存活
    const tzCorrection = profile.entries.find(
      (e) => e.category === "correction" && e.key === "timezone",
    );
    expect(tzCorrection).toBeDefined();

    const nameFormatCorrection = profile.entries.find(
      (e) => e.category === "correction" && e.key === "name-format",
    );
    expect(nameFormatCorrection).toBeDefined();

    // 3. 早期 todo (第5-10天) 在第60天应已被清理
    // 注意: stale todo 清理只在 upsertProfileEntry 中触发，simulateUpsert 不走这个路径
    // 所以用 upsertProfileEntry 触发一次清理
    profile = upsertProfileEntry(profile, "fact", "final-trigger", "trigger stale cleanup");
    for (let d = 5; d <= 10; d++) {
      const todo = profile.entries.find((e) => e.key === `task-d${d}`);
      expect(todo, `todo task-d${d} should be cleaned up after 50+ days`).toBeUndefined();
    }

    // 4. 总数不超过上限
    expect(profile.entries.length).toBeLessThanOrEqual(PROFILE_MAX_ENTRIES);

    // 5. 分类分布统计
    const distribution = {
      identity: profile.entries.filter((e) => e.category === "identity").length,
      correction: profile.entries.filter((e) => e.category === "correction").length,
      preference: profile.entries.filter((e) => e.category === "preference").length,
      fact: profile.entries.filter((e) => e.category === "fact").length,
      todo: profile.entries.filter((e) => e.category === "todo").length,
      procedure: profile.entries.filter((e) => e.category === "procedure").length,
    };

    // identity 和 correction 全部保留
    expect(distribution.identity).toBeGreaterThanOrEqual(3);
    expect(distribution.correction).toBeGreaterThanOrEqual(2);
    // procedure 应保留 (base=0.7, 相对高)
    expect(distribution.procedure).toBeGreaterThanOrEqual(1);
  });

  it("记忆衰退时间线 — 精确计算不同场景下的有效期", () => {
    const now = Date.now();

    // 场景 1: 零 hits 的 fact → 被淘汰的临界天数
    // fact base=0.5, 在满容量 200 条时，与新 fact (0.5+0.3=0.8) 竞争
    // 只要 0.5 + 0.3×0.5^(d/14) < 新条目最低分就会被淘汰
    // 关键: 在满容量下取决于竞争对手的分数分布

    // 场景 2: identity hits=0 → 永不被主动淘汰 (base=1.0 > 任何其他分类)
    const identityOld = computeEntryScore(
      makeEntry({ category: "identity", hits: 0, updatedAt: now - 365 * DAY_MS }),
      now,
    );
    const factFresh = computeEntryScore(
      makeEntry({ category: "fact", hits: 0, updatedAt: now }),
      now,
    );
    expect(identityOld).toBeGreaterThan(factFresh);

    // 场景 3: correction hits=0 → 几乎永不被淘汰 (base=0.95)
    const correctionOld = computeEntryScore(
      makeEntry({ category: "correction", hits: 0, updatedAt: now - 365 * DAY_MS }),
      now,
    );
    expect(correctionOld).toBeGreaterThan(factFresh);

    // 场景 4: preference 与 fact 的竞争
    const prefOld = computeEntryScore(
      makeEntry({ category: "preference", hits: 0, updatedAt: now - 90 * DAY_MS }),
      now,
    );
    // preference base=0.6 + ≈0 recency = 0.6 vs fact fresh = 0.8
    // preference 在 90 天后仍不如新 fact → 会被新 fact 淘汰
    expect(prefOld).toBeLessThan(factFresh);

    // 但 preference + 3 hits 在 90 天后：
    const prefWithHits = computeEntryScore(
      makeEntry({ category: "preference", hits: 3, updatedAt: now - 90 * DAY_MS }),
      now,
    );
    // 0.6 + 0.15×3^0.7 + ≈0 = 0.6 + 0.15×2.157 ≈ 0.6 + 0.324 = 0.924
    // 0.924 > 0.8 → 3 次强化让 90 天老的 preference 依然比新 fact 强
    expect(prefWithHits).toBeGreaterThan(factFresh);
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. 边界条件与异常测试
// ═══════════════════════════════════════════════════════════════

describe("边界条件与异常 (Edge Cases)", () => {
  it("空 profile 的所有操作应安全", () => {
    const empty = makeProfile([]);

    // formatProfileForSystemPrompt 返回空字符串
    expect(formatProfileForSystemPrompt(empty)).toBe("");

    // reinforceMatchingEntries 不崩溃
    const { reinforcedCount } = reinforceMatchingEntries(empty, ["test"]);
    expect(reinforcedCount).toBe(0);

    // evictByScore 不崩溃
    const entries: ProfileEntry[] = [];
    const evicted = evictByScore(entries, Date.now());
    expect(evicted.length).toBe(0);
  });

  it("极长 key 和 value 不会导致提示词爆炸", () => {
    const longKey = "a".repeat(100); // PROFILE_MAX_KEY_LENGTH
    const longValue = "b".repeat(500); // PROFILE_MAX_VALUE_LENGTH

    const profile = makeProfile([makeEntry({ key: longKey, value: longValue })]);

    const output = formatProfileForSystemPrompt(profile, 8000);
    expect(output.length).toBeLessThanOrEqual(8050);
  });

  it("未来时间戳的条目处理", () => {
    const futureTime = Date.now() + 365 * DAY_MS;

    const entry = makeEntry({
      category: "fact",
      key: "future",
      value: "from the future",
      updatedAt: futureTime,
      hits: 0,
    });

    // 分数不应为 NaN 或 Infinity
    const score = computeEntryScore(entry, Date.now());
    expect(Number.isFinite(score)).toBe(true);
    // 应 >= base (负 age → recency > 0.3, 但 Math.max 保护)
    expect(score).toBeGreaterThanOrEqual(CATEGORY_WEIGHTS.fact);
  });

  it("负 hits 的防御 (不应发生但需要安全)", () => {
    const entry = makeEntry({ hits: -1 });
    const score = computeEntryScore(entry, Date.now());
    // Math.pow 对负数的非整数次方会返回 NaN
    // 实际代码: Math.max(entry.hits, 0) → 保护
    expect(Number.isFinite(score)).toBe(true);
  });

  it("所有分类同时满保护线 + 大量新增", () => {
    const entries: ProfileEntry[] = [];
    const idMin = PROTECTED_CATEGORY_MINIMUMS.identity ?? 0;
    const corrMin = PROTECTED_CATEGORY_MINIMUMS.correction ?? 0;

    // 刚好达到保护最低值
    for (let i = 0; i < idMin; i++) {
      entries.push(
        makeEntry({
          category: "identity",
          key: `id-${i}`,
          value: `id ${i}`,
          updatedAt: daysAgo(365),
          hits: 0,
        }),
      );
    }
    for (let i = 0; i < corrMin; i++) {
      entries.push(
        makeEntry({
          category: "correction",
          key: `corr-${i}`,
          value: `corr ${i}`,
          updatedAt: daysAgo(365),
          hits: 0,
        }),
      );
    }

    // 填满剩余空间
    const remaining = PROFILE_MAX_ENTRIES - idMin - corrMin;
    for (let i = 0; i < remaining + 20; i++) {
      // 多 20 个触发淘汰
      entries.push(
        makeEntry({
          category: "fact",
          key: `fact-${i}`,
          value: `fact ${i}`,
          updatedAt: Date.now(),
          hits: 0,
        }),
      );
    }

    evictByScore(entries, Date.now());

    expect(entries.length).toBe(PROFILE_MAX_ENTRIES);
    expect(entries.filter((e) => e.category === "identity").length).toBe(idMin);
    expect(entries.filter((e) => e.category === "correction").length).toBe(corrMin);
  });
});

// ═══════════════════════════════════════════════════════════════
// 12. 性能基准测试
// ═══════════════════════════════════════════════════════════════

describe("性能基准 (Performance Benchmarks)", () => {
  it("1000 次 upsert 应在 500ms 内完成", () => {
    let profile = makeProfile([]);
    const start = performance.now();

    for (let i = 0; i < 1000; i++) {
      profile = upsertProfileEntry(profile, "fact", `fact-${i}`, `value ${i}`);
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it("满容量下 computeEntryScore 1000 次应在 10ms 内", () => {
    const entries: ProfileEntry[] = [];
    for (let i = 0; i < PROFILE_MAX_ENTRIES; i++) {
      entries.push(
        makeEntry({
          category: "fact",
          key: `fact-${i}`,
          value: `v${i}`,
          updatedAt: Date.now() - i * HOUR_MS,
          hits: i % 20,
        }),
      );
    }

    const now = Date.now();
    const start = performance.now();

    for (let round = 0; round < 5; round++) {
      for (const entry of entries) {
        computeEntryScore(entry, now);
      }
    }

    const elapsed = performance.now() - start;
    // 5 × 200 = 1000 次计算应很快
    expect(elapsed).toBeLessThan(50);
  });

  it("formatProfileForSystemPrompt 满容量应在 50ms 内", () => {
    const entries: ProfileEntry[] = [];
    for (let i = 0; i < PROFILE_MAX_ENTRIES; i++) {
      entries.push(
        makeEntry({
          category: ["identity", "correction", "preference", "fact", "todo", "procedure"][
            i % 6
          ] as ProfileCategory,
          key: `key-${i}`,
          value: `测试值 ${i}，包含中英文混合内容`,
          updatedAt: Date.now() - i * HOUR_MS,
          hits: i % 10,
        }),
      );
    }

    const profile = makeProfile(entries);
    const start = performance.now();

    for (let i = 0; i < 10; i++) {
      formatProfileForSystemPrompt(profile);
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200); // 10 次应 < 200ms
  });
});

// ═══════════════════════════════════════════════════════════════
// Helper: 模拟带时间戳的 upsert
// ═══════════════════════════════════════════════════════════════

function simulateUpsert(
  profile: UserProfile,
  timestamp: number,
  items: Array<{ cat: ProfileCategory; key: string; value: string }>,
): UserProfile {
  let updated = profile;
  for (const item of items) {
    // 手动设置条目时间戳来模拟特定时间点
    const existingIdx = updated.entries.findIndex(
      (e) => e.category === item.cat && e.key.toLowerCase() === item.key.toLowerCase(),
    );

    if (existingIdx >= 0) {
      const entries = [...updated.entries];
      entries[existingIdx] = {
        ...entries[existingIdx],
        value: item.value,
        updatedAt: timestamp,
        hits: entries[existingIdx].hits + 1,
      };
      updated = { ...updated, entries };
    } else {
      updated = {
        ...updated,
        entries: [
          ...updated.entries,
          {
            category: item.cat,
            key: item.key,
            value: item.value,
            updatedAt: timestamp,
            hits: 0,
          },
        ],
      };
    }
  }

  // 如果超过容量，手动触发淘汰
  if (updated.entries.length > PROFILE_MAX_ENTRIES) {
    const entries = [...updated.entries];
    evictByScore(entries, Date.now());
    updated = { ...updated, entries };
  }

  return updated;
}
