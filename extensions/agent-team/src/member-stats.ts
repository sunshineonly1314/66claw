/**
 * Member Stats — Per-agent call tracking for observability.
 *
 * Tracks call counts and cumulative duration for each team member.
 * Pure immutable functions mirroring the member-health.ts pattern.
 */

import type { MemberStats } from "./types.js";

/**
 * Create initial stats for a new team member.
 */
export function createInitialMemberStats(agentId: string): MemberStats {
  return {
    agentId,
    callCount: 0,
    totalDurationMs: 0,
  };
}

/**
 * Record a completed agent call. Returns updated stats.
 */
export function recordMemberCall(
  stats: MemberStats,
  durationMs?: number,
): MemberStats {
  return {
    ...stats,
    callCount: stats.callCount + 1,
    totalDurationMs:
      stats.totalDurationMs + (Number.isFinite(durationMs) ? Math.max(durationMs!, 0) : 0),
    lastCallAt: new Date().toISOString(),
  };
}

/**
 * Compute average call duration in milliseconds.
 * Returns 0 if no calls recorded.
 */
export function computeAverageDuration(stats: MemberStats): number {
  if (stats.callCount === 0) return 0;
  return Math.round(stats.totalDurationMs / stats.callCount);
}
