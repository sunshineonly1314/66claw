function createInitialMemberStats(agentId) {
  return {
    agentId,
    callCount: 0,
    totalDurationMs: 0
  };
}
function recordMemberCall(stats, durationMs) {
  return {
    ...stats,
    callCount: stats.callCount + 1,
    totalDurationMs: stats.totalDurationMs + (Number.isFinite(durationMs) ? Math.max(durationMs, 0) : 0),
    lastCallAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function computeAverageDuration(stats) {
  if (stats.callCount === 0) return 0;
  return Math.round(stats.totalDurationMs / stats.callCount);
}
export {
  computeAverageDuration,
  createInitialMemberStats,
  recordMemberCall
};
