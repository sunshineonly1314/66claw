import { NEW_SESSION_COMMANDS } from "./types.js";
const DEFAULT_SESSION_TIMEOUT = 30 * 60 * 1e3;
const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1e3;
const MAX_SESSION_COUNT = 1e4;
const userSessions = /* @__PURE__ */ new Map();
let cleanupTimer = null;
let isAutoCleanupInitialized = false;
function ensureAutoCleanupInitialized(sessionTimeout = DEFAULT_SESSION_TIMEOUT, log) {
  if (isAutoCleanupInitialized) return;
  isAutoCleanupInitialized = true;
  startSessionCleanup(sessionTimeout, SESSION_CLEANUP_INTERVAL, log);
}
function cleanupExpiredSessions(sessionTimeout = DEFAULT_SESSION_TIMEOUT, log) {
  const now = Date.now();
  let cleanedCount = 0;
  for (const [senderId, session] of userSessions) {
    const elapsed = now - session.lastActivity;
    if (elapsed > sessionTimeout) {
      userSessions.delete(senderId);
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    log?.info?.(`[DingTalk][Session] \u6E05\u7406\u4E86 ${cleanedCount} \u4E2A\u8FC7\u671F\u4F1A\u8BDD\uFF0C\u5269\u4F59 ${userSessions.size} \u4E2A`);
  }
  return cleanedCount;
}
function startSessionCleanup(sessionTimeout = DEFAULT_SESSION_TIMEOUT, cleanupInterval = SESSION_CLEANUP_INTERVAL, log) {
  if (cleanupTimer) {
    return;
  }
  cleanupTimer = setInterval(() => {
    cleanupExpiredSessions(sessionTimeout, log);
  }, cleanupInterval);
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
  log?.info?.(`[DingTalk][Session] \u81EA\u52A8\u6E05\u7406\u5DF2\u542F\u52A8\uFF0C\u95F4\u9694 ${cleanupInterval / 1e3} \u79D2`);
}
function stopSessionCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
function isNewSessionCommand(text) {
  const trimmed = text.trim().toLowerCase();
  return NEW_SESSION_COMMANDS.some((cmd) => trimmed === cmd.toLowerCase());
}
function getSessionKey(senderId, forceNew, sessionTimeout = DEFAULT_SESSION_TIMEOUT, log) {
  ensureAutoCleanupInitialized(sessionTimeout, log);
  const now = Date.now();
  const existing = userSessions.get(senderId);
  if (!existing && userSessions.size >= MAX_SESSION_COUNT) {
    log?.info?.(`[DingTalk][Session] \u4F1A\u8BDD\u6570\u8FBE\u5230\u4E0A\u9650 ${MAX_SESSION_COUNT}\uFF0C\u89E6\u53D1\u7D27\u6025\u6E05\u7406`);
    cleanupExpiredSessions(sessionTimeout, log);
    if (userSessions.size >= MAX_SESSION_COUNT) {
      const sortedEntries = Array.from(userSessions.entries()).sort((a, b) => a[1].lastActivity - b[1].lastActivity);
      const toDelete = Math.max(1, Math.floor(sortedEntries.length * 0.1));
      for (let i = 0; i < toDelete; i++) {
        userSessions.delete(sortedEntries[i][0]);
      }
      log?.info?.(`[DingTalk][Session] \u7D27\u6025\u5220\u9664 ${toDelete} \u4E2A\u6700\u65E7\u4F1A\u8BDD`);
    }
  }
  if (forceNew) {
    const sessionId2 = `dingtalk:${senderId}:${now}`;
    userSessions.set(senderId, { lastActivity: now, sessionId: sessionId2 });
    log?.info?.(`[DingTalk][Session] \u7528\u6237\u4E3B\u52A8\u5F00\u542F\u65B0\u4F1A\u8BDD: ${senderId}`);
    return { sessionKey: sessionId2, isNew: true };
  }
  if (existing) {
    const elapsed = now - existing.lastActivity;
    if (elapsed > sessionTimeout) {
      const sessionId2 = `dingtalk:${senderId}:${now}`;
      userSessions.set(senderId, { lastActivity: now, sessionId: sessionId2 });
      log?.info?.(
        `[DingTalk][Session] \u4F1A\u8BDD\u8D85\u65F6(${Math.round(elapsed / 6e4)}\u5206\u949F)\uFF0C\u81EA\u52A8\u5F00\u542F\u65B0\u4F1A\u8BDD: ${senderId}`
      );
      return { sessionKey: sessionId2, isNew: true };
    }
    existing.lastActivity = now;
    return { sessionKey: existing.sessionId, isNew: false };
  }
  const sessionId = `dingtalk:${senderId}`;
  userSessions.set(senderId, { lastActivity: now, sessionId });
  log?.info?.(`[DingTalk][Session] \u65B0\u7528\u6237\u9996\u6B21\u4F1A\u8BDD: ${senderId}`);
  return { sessionKey: sessionId, isNew: false };
}
function clearUserSession(senderId) {
  userSessions.delete(senderId);
}
function clearAllSessions() {
  userSessions.clear();
}
function getSessionCount() {
  return userSessions.size;
}
function getUserSession(senderId) {
  return userSessions.get(senderId);
}
export {
  DEFAULT_SESSION_TIMEOUT,
  cleanupExpiredSessions,
  clearAllSessions,
  clearUserSession,
  getSessionCount,
  getSessionKey,
  getUserSession,
  isNewSessionCommand,
  startSessionCleanup,
  stopSessionCleanup
};
