const DEGRADED_THRESHOLD = 2;
const DOWN_THRESHOLD = 5;
const RECOVERY_THRESHOLD = 3;
function createInitialMemberHealth(agentId) {
  return {
    agentId,
    state: "healthy",
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    totalFailures: 0,
    totalSuccesses: 0
  };
}
function recordMemberSuccess(health) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updated = {
    ...health,
    consecutiveSuccesses: health.consecutiveSuccesses + 1,
    consecutiveFailures: 0,
    totalSuccesses: health.totalSuccesses + 1,
    lastSuccessAt: now
  };
  if (health.state === "down") {
    updated.state = "degraded";
    updated.consecutiveSuccesses = 1;
  } else if (health.state === "degraded" && updated.consecutiveSuccesses >= RECOVERY_THRESHOLD) {
    updated.state = "healthy";
  }
  return updated;
}
function recordMemberFailure(health, error) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updated = {
    ...health,
    consecutiveFailures: health.consecutiveFailures + 1,
    consecutiveSuccesses: 0,
    totalFailures: health.totalFailures + 1,
    lastFailureAt: now,
    lastError: error
  };
  if (health.state === "healthy" && updated.consecutiveFailures >= DEGRADED_THRESHOLD) {
    updated.state = "degraded";
  } else if (health.state === "degraded" && updated.consecutiveFailures >= DOWN_THRESHOLD) {
    updated.state = "down";
  }
  return updated;
}
function getMemberHealthStatus(health) {
  return health.state;
}
function isRoutable(health) {
  return health.state !== "down";
}
export {
  createInitialMemberHealth,
  getMemberHealthStatus,
  isRoutable,
  recordMemberFailure,
  recordMemberSuccess
};
