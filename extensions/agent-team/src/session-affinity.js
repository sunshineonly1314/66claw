const MAX_AFFINITY_ENTRIES = 5e4;
const store = /* @__PURE__ */ new Map();
function compositeKey(projectId, peerId) {
  return `${projectId}:${peerId}`;
}
function getAffinity(projectId, peerId) {
  return store.get(compositeKey(projectId, peerId)) ?? null;
}
function setAffinity(projectId, peerId, agentId) {
  const key = compositeKey(projectId, peerId);
  const existing = store.get(key);
  if (existing && existing.agentId === agentId) {
    store.set(key, {
      ...existing,
      lastActiveAt: (/* @__PURE__ */ new Date()).toISOString(),
      messageCount: existing.messageCount + 1
    });
  } else {
    if (!existing && store.size >= MAX_AFFINITY_ENTRIES) {
      const evictCount = Math.max(1, Math.floor(MAX_AFFINITY_ENTRIES * 0.1));
      const entries = [];
      for (const [k, v] of store) {
        entries.push([k, new Date(v.lastActiveAt).getTime()]);
      }
      entries.sort((a, b) => a[1] - b[1]);
      for (let i = 0; i < evictCount && i < entries.length; i++) {
        store.delete(entries[i][0]);
      }
    }
    store.set(key, {
      peerId,
      agentId,
      lastActiveAt: (/* @__PURE__ */ new Date()).toISOString(),
      messageCount: 1
    });
  }
}
function clearAffinity(projectId, peerId) {
  store.delete(compositeKey(projectId, peerId));
}
function clearProjectAffinities(projectId) {
  const prefix = `${projectId}:`;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}
function isAffinityExpired(record, timeoutMinutes) {
  if (timeoutMinutes <= 0) return true;
  const lastActive = new Date(record.lastActiveAt).getTime();
  if (Number.isNaN(lastActive)) return true;
  const expiresAt = lastActive + timeoutMinutes * 6e4;
  return Date.now() > expiresAt;
}
function resolveAffinityAgent(projectId, peerId, timeoutMinutes) {
  const record = getAffinity(projectId, peerId);
  if (!record) return null;
  if (isAffinityExpired(record, timeoutMinutes)) {
    clearAffinity(projectId, peerId);
    return null;
  }
  return record.agentId;
}
function purgeExpiredAffinities(timeoutMinutes) {
  let purged = 0;
  for (const [key, record] of store) {
    if (isAffinityExpired(record, timeoutMinutes)) {
      store.delete(key);
      purged++;
    }
  }
  return purged;
}
function getAllAffinities() {
  return new Map(store);
}
function resetAllAffinities() {
  store.clear();
}
export {
  clearAffinity,
  clearProjectAffinities,
  getAffinity,
  getAllAffinities,
  isAffinityExpired,
  purgeExpiredAffinities,
  resetAllAffinities,
  resolveAffinityAgent,
  setAffinity
};
