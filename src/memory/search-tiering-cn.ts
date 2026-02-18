/**
 * [CN-PATCH:memory-p0] Time-based search tiering for CN memory optimization
 *
 * 冷热分层搜索策略：优先返回近期记忆，不足时自动回退到更早时间段
 * Hot (7d) → Warm (30d) → Cold (120d) → Full fallback
 *
 * 智能回退逻辑：如果当前时间层结果数 < MIN_RESULTS_BEFORE_FALLBACK，
 * 自动扩展到下一个时间层，直到结果足够或遍历完所有层。
 */

import type { MemorySearchResult } from "./types.js";

const TIERS = [
  { label: "hot", days: 7 },
  { label: "warm", days: 30 },
  { label: "cold", days: 120 },
] as const;

/** 最少结果数阈值：低于此数自动扩展到下一时间层 */
const MIN_RESULTS_BEFORE_FALLBACK = 2;

/**
 * Filter search results by time tier with automatic fallback.
 *
 * - 如果总结果数 <= MIN_RESULTS_BEFORE_FALLBACK，直接返回全部（无需过滤）
 * - 否则从 hot 层开始过滤，结果不足则依次扩展到 warm → cold → full
 * - updatedAt 为空的结果视为"永远有效"（memory/*.md 没有时间戳）
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

  for (const tier of TIERS) {
    const cutoff = nowMs - tier.days * 24 * 60 * 60 * 1000;
    const filtered = results.filter((r) => r.updatedAt == null || r.updatedAt >= cutoff);
    if (filtered.length >= MIN_RESULTS_BEFORE_FALLBACK) {
      return filtered;
    }
  }

  return results; // 所有层都不够，返回全部
}
