/**
 * 钉钉会话管理模块
 * DingTalk Session Manager
 *
 * 负责管理用户会话状态，包括:
 * - 会话超时自动新建
 * - 手动新会话命令
 * - 会话 ID 生成
 * - 自动清理过期会话（防止内存泄漏）
 */

import { NEW_SESSION_COMMANDS, type UserSession } from "./types.js";

// ============================================================================
// 常量
// ============================================================================

/** 默认会话超时时间: 30 分钟 */
export const DEFAULT_SESSION_TIMEOUT = 30 * 60 * 1000;

/** 会话清理间隔: 5 分钟 */
const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000;

/** 最大会话数量上限（防止内存泄漏） */
const MAX_SESSION_COUNT = 10000;

// ============================================================================
// 会话缓存
// ============================================================================

/** 用户会话缓存 Map<senderId, UserSession> */
const userSessions = new Map<string, UserSession>();

/** 清理定时器 */
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/** 是否已初始化自动清理 */
let isAutoCleanupInitialized = false;

// ============================================================================
// 会话清理
// ============================================================================

/**
 * 确保自动清理已初始化（首次调用时自动启动）
 */
function ensureAutoCleanupInitialized(
  sessionTimeout: number = DEFAULT_SESSION_TIMEOUT,
  log?: { info?: (msg: string) => void },
): void {
  if (isAutoCleanupInitialized) return;
  isAutoCleanupInitialized = true;
  startSessionCleanup(sessionTimeout, SESSION_CLEANUP_INTERVAL, log);
}

/**
 * 清理过期会话
 * @returns 清理的会话数量
 */
export function cleanupExpiredSessions(
  sessionTimeout: number = DEFAULT_SESSION_TIMEOUT,
  log?: { info?: (msg: string) => void },
): number {
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
    log?.info?.(`[DingTalk][Session] 清理了 ${cleanedCount} 个过期会话，剩余 ${userSessions.size} 个`);
  }

  return cleanedCount;
}

/**
 * 启动自动清理定时器
 */
export function startSessionCleanup(
  sessionTimeout: number = DEFAULT_SESSION_TIMEOUT,
  cleanupInterval: number = SESSION_CLEANUP_INTERVAL,
  log?: { info?: (msg: string) => void },
): void {
  if (cleanupTimer) {
    return; // 已经启动
  }

  cleanupTimer = setInterval(() => {
    cleanupExpiredSessions(sessionTimeout, log);
  }, cleanupInterval);

  // 允许进程退出时定时器不阻塞
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  log?.info?.(`[DingTalk][Session] 自动清理已启动，间隔 ${cleanupInterval / 1000} 秒`);
}

/**
 * 停止自动清理定时器
 */
export function stopSessionCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

// ============================================================================
// 公共接口
// ============================================================================

/**
 * 检查消息是否是新会话命令
 */
export function isNewSessionCommand(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return NEW_SESSION_COMMANDS.some((cmd) => trimmed === cmd.toLowerCase());
}

/**
 * 获取或创建用户 session key
 *
 * @param senderId - 发送者 ID
 * @param forceNew - 是否强制新会话
 * @param sessionTimeout - 会话超时时间 (ms)
 * @param log - 日志接口
 * @returns 会话 key 和是否新建
 */
export function getSessionKey(
  senderId: string,
  forceNew: boolean,
  sessionTimeout: number = DEFAULT_SESSION_TIMEOUT,
  log?: { info?: (msg: string) => void },
): { sessionKey: string; isNew: boolean } {
  // 首次调用时自动初始化定期清理
  ensureAutoCleanupInitialized(sessionTimeout, log);

  const now = Date.now();
  const existing = userSessions.get(senderId);

  // 会话数量上限检查：超过上限时清理最旧的会话
  if (!existing && userSessions.size >= MAX_SESSION_COUNT) {
    log?.info?.(`[DingTalk][Session] 会话数达到上限 ${MAX_SESSION_COUNT}，触发紧急清理`);
    cleanupExpiredSessions(sessionTimeout, log);

    // 如果清理后仍超限，删除最旧的 10% 会话
    if (userSessions.size >= MAX_SESSION_COUNT) {
      const sortedEntries = Array.from(userSessions.entries())
        .sort((a, b) => a[1].lastActivity - b[1].lastActivity);
      const toDelete = Math.max(1, Math.floor(sortedEntries.length * 0.1));
      for (let i = 0; i < toDelete; i++) {
        userSessions.delete(sortedEntries[i][0]);
      }
      log?.info?.(`[DingTalk][Session] 紧急删除 ${toDelete} 个最旧会话`);
    }
  }

  // 强制新会话
  if (forceNew) {
    const sessionId = `dingtalk:${senderId}:${now}`;
    userSessions.set(senderId, { lastActivity: now, sessionId });
    log?.info?.(`[DingTalk][Session] 用户主动开启新会话: ${senderId}`);
    return { sessionKey: sessionId, isNew: true };
  }

  // 检查超时
  if (existing) {
    const elapsed = now - existing.lastActivity;
    if (elapsed > sessionTimeout) {
      const sessionId = `dingtalk:${senderId}:${now}`;
      userSessions.set(senderId, { lastActivity: now, sessionId });
      log?.info?.(
        `[DingTalk][Session] 会话超时(${Math.round(elapsed / 60000)}分钟)，自动开启新会话: ${senderId}`,
      );
      return { sessionKey: sessionId, isNew: true };
    }
    // 更新活跃时间
    existing.lastActivity = now;
    return { sessionKey: existing.sessionId, isNew: false };
  }

  // 首次会话
  const sessionId = `dingtalk:${senderId}`;
  userSessions.set(senderId, { lastActivity: now, sessionId });
  log?.info?.(`[DingTalk][Session] 新用户首次会话: ${senderId}`);
  return { sessionKey: sessionId, isNew: false };
}

/**
 * 清除用户会话
 */
export function clearUserSession(senderId: string): void {
  userSessions.delete(senderId);
}

/**
 * 清除所有会话 (用于测试)
 */
export function clearAllSessions(): void {
  userSessions.clear();
}

/**
 * 获取会话数量 (用于测试/调试)
 */
export function getSessionCount(): number {
  return userSessions.size;
}

/**
 * 获取用户会话信息 (用于测试/调试)
 */
export function getUserSession(senderId: string): UserSession | undefined {
  return userSessions.get(senderId);
}
