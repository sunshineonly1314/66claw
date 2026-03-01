/**
 * [CN-PATCH:memory-p0] Time-based search tiering for CN memory optimization
 *
 * 冷热分层搜索策略：优先返回近期记忆，不足时自动回退到更早时间段
 * Hot (7d) → Warm (30d) → Cold (120d) → Full fallback
 *
 * 智能回退逻辑：如果当前时间层结果数 < MIN_RESULTS_BEFORE_FALLBACK，
 * 自动扩展到下一个时间层，直到结果足够或遍历完所有层。
 *
 * 高分保护：即使一条旧结果不在当前时间层内，只要其 score 超过
 * 动态阈值（top-1 score × 0.8 或 0.6 的较低者），仍然保留。
 * 这避免了"8天前的最相关记忆被2个3天前的低分结果挤掉"的问题。
 *
 * [CN-PATCH:memory-fix] 动态高分保护阈值：
 * 原固定 0.6 阈值对低分模型（如 local GGUF）不友好——最高分可能只有 0.4-0.6，
 * 导致所有结果都被时间分层淘汰。改用 min(maxScore×0.8, 0.6) 确保高排名结果
 * 始终被保留，无论绝对 score 值如何。
 */

import type { MemorySearchResult } from "./types.js";

const TIERS = [
  { label: "hot", days: 7 },
  { label: "warm", days: 30 },
  { label: "cold", days: 120 },
] as const;

/** 最少结果数阈值：低于此数自动扩展到下一时间层 */
const MIN_RESULTS_BEFORE_FALLBACK = 2;

/** 高分保护阈值（静态下限）：score >= 此值的旧结果不会被时间分层丢弃 */
const HIGH_SCORE_PRESERVE_THRESHOLD_FLOOR = 0.6;

/**
 * 动态高分保护阈值计算。
 * 取 max(results.score) × 0.8 与静态下限 0.6 中的较低者。
 * 这确保了即使 embedding model 的 score 整体偏低，排名前列的结果也不会被时间淘汰。
 */
function computeHighScoreThreshold(results: MemorySearchResult[]): number {
  if (results.length === 0) return HIGH_SCORE_PRESERVE_THRESHOLD_FLOOR;
  const maxScore = Math.max(...results.map((r) => r.score));
  const dynamic = maxScore * 0.8;
  return Math.min(dynamic, HIGH_SCORE_PRESERVE_THRESHOLD_FLOOR);
}

/**
 * Filter search results by time tier with automatic fallback.
 *
 * - 如果总结果数 <= MIN_RESULTS_BEFORE_FALLBACK，直接返回全部（无需过滤）
 * - 否则从 hot 层开始过滤，结果不足则依次扩展到 warm → cold → full
 * - updatedAt 为空的结果视为"永远有效"（memory/*.md 没有时间戳）
 * - score >= dynamicThreshold 的结果始终保留（高分保护）
 *
 * @param results - 原始搜索结果（已按 score 排序）
 * @param nowMs - 当前时间戳（ms），默认 Date.now()，可注入用于测试
 */
export function applyTimeTiering(
  results: MemorySearchResult[],
  nowMs: number = Date.now(),
): MemorySearchResult[] {
  if (results.length <= MIN_RESULTS_BEFORE_FALLBACK) {
    return results; // 结果太少，无需过滤
  }

  const threshold = computeHighScoreThreshold(results);

  for (const tier of TIERS) {
    const cutoff = nowMs - tier.days * 24 * 60 * 60 * 1000;
    const filtered = results.filter(
      (r) => r.updatedAt == null || r.updatedAt >= cutoff || r.score >= threshold,
    );
    if (filtered.length >= MIN_RESULTS_BEFORE_FALLBACK) {
      return filtered;
    }
  }

  return results; // 所有层都不够，返回全部
}
