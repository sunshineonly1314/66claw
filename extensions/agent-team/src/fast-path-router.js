import { isRoutable } from "./member-health.js";
import { matchKeywordRoute } from "./keyword-router.js";
import { resolveAffinityAgent } from "./session-affinity.js";
const DEFAULT_FAST_PATH_CONFIG = {
  sessionAffinityEnabled: true,
  affinityTimeoutMinutes: 30,
  keywordConfidenceThreshold: 0.15
};
const routeTableCache = /* @__PURE__ */ new Map();
function setRouteTable(projectId, routes) {
  routeTableCache.set(projectId, routes);
}
function getRouteTable(projectId) {
  return routeTableCache.get(projectId) ?? [];
}
function clearRouteTable(projectId) {
  routeTableCache.delete(projectId);
}
function resetAllRouteTables() {
  routeTableCache.clear();
}
function routeMessage(params) {
  const { message, project, peerId, healthMap } = params;
  if (!message.trim()) return null;
  const config = {
    ...DEFAULT_FAST_PATH_CONFIG,
    ...project.coordination.fastPath
  };
  const routableMembers = new Set(
    project.memberIds.filter((id) => {
      if (id === project.supervisorId) return false;
      const health = healthMap.get(id);
      return !health || isRoutable(health);
    })
  );
  if (routableMembers.size === 0) return null;
  if (config.sessionAffinityEnabled) {
    const affinitizedAgent = resolveAffinityAgent(
      project.projectId,
      peerId,
      config.affinityTimeoutMinutes
    );
    if (affinitizedAgent && routableMembers.has(affinitizedAgent)) {
      return {
        agentId: affinitizedAgent,
        method: "affinity",
        confidence: 0.9
      };
    }
  }
  const routes = getRouteTable(project.projectId);
  if (routes.length > 0) {
    const routableRoutes = routes.filter((r) => routableMembers.has(r.agentId));
    const match = matchKeywordRoute(message, routableRoutes);
    if (match && match.confidence >= config.keywordConfidenceThreshold) {
      return {
        agentId: match.agentId,
        method: "keyword",
        confidence: match.confidence,
        matchedPattern: match.matchedPattern
      };
    }
  }
  return null;
}
export {
  DEFAULT_FAST_PATH_CONFIG,
  clearRouteTable,
  getRouteTable,
  resetAllRouteTables,
  routeMessage,
  setRouteTable
};
