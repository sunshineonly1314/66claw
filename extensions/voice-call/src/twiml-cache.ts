/**
 * TwiML 缓存模块
 * TwiML Cache Module
 *
 * 使用 LRU (Least Recently Used) 缓存 + TTL 防止内存泄漏
 *
 * 问题：
 * - VoiceCall 扩展之前使用无限制的 Map 存储 TwiML
 * - 长期运行会导致 OOM (Out Of Memory)
 *
 * 解决方案:
 * - 使用 LRU 缓存限制最大条目数
 * - 使用 TTL 自动清理过期数据
 * - 支持并发安全操作
 */

import { LRUCache } from "lru-cache";

// ============================================================================
// 配置常量
// ============================================================================

/** TwiML 缓存最大条目数（覆盖 500 个并发通话） */
const TWIML_CACHE_MAX_SIZE = 500;

/** TwiML 缓存 TTL: 30 分钟（通话结束后足够时间）*/
const TWIML_CACHE_TTL_MS = 30 * 60 * 1000;

/** 通话状态缓存最大条目数 */
const CALL_STATE_CACHE_MAX_SIZE = 1000;

/** 通话状态缓存 TTL: 1 小时 */
const CALL_STATE_CACHE_TTL_MS = 60 * 60 * 1000;

// ============================================================================
// 缓存实例
// ============================================================================

/**
 * TwiML 内容缓存
 *
 * 存储每个通话的 TwiML (XML) 内容
 *
 * 特性:
 * - 最多 500 个条目
 * - 30 分钟自动过期
 * - LRU 淘汰策略
 */
export const twimlCache = new LRUCache<string, string>({
  max: TWIML_CACHE_MAX_SIZE,
  ttl: TWIML_CACHE_TTL_MS,
  updateAgeOnGet: false, // 不延长过期时间（严格 TTL）
  updateAgeOnHas: false,
  dispose: (value, key) => {
    // 清理时的日志（调试用）
    if (process.env.VOICE_CALL_DEBUG === "true") {
      console.log(`[twiml-cache] 清理 TwiML: ${key}`);
    }
  },
});

/**
 * 通话状态缓存
 *
 * 存储通话的临时状态信息
 *
 * 泛型参数:
 * - TCallState: 通话状态类型
 */
export function createCallStateCache<TCallState extends NonNullable<unknown>>(): LRUCache<string, TCallState> {
  return new LRUCache<string, TCallState>({
    max: CALL_STATE_CACHE_MAX_SIZE,
    ttl: CALL_STATE_CACHE_TTL_MS,
    updateAgeOnGet: false,
    updateAgeOnHas: false,
    dispose: (value, key) => {
      if (process.env.VOICE_CALL_DEBUG === "true") {
        console.log(`[call-state-cache] 清理状态: ${key}`);
      }
    },
  });
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取缓存统计信息
 */
export function getTwimlCacheStats(): {
  size: number;
  max: number;
  usage: string;
} {
  return {
    size: twimlCache.size,
    max: TWIML_CACHE_MAX_SIZE,
    usage: `${twimlCache.size}/${TWIML_CACHE_MAX_SIZE} (${Math.round((twimlCache.size / TWIML_CACHE_MAX_SIZE) * 100)}%)`,
  };
}

/**
 * 清空所有缓存
 *
 * 注意: 仅用于测试或紧急情况
 */
export function clearAllCaches(): void {
  twimlCache.clear();
  console.log("[twiml-cache] 已清空所有缓存");
}

// ============================================================================
// 监控和告警
// ============================================================================

/**
 * 启动缓存监控
 *
 * 定期检查缓存大小，并在接近容量时发出警告
 *
 * @param intervalMs - 检查间隔（毫秒）
 * @returns 停止监控的函数
 */
export function startCacheMonitoring(intervalMs: number = 60000): () => void {
  const intervalId = setInterval(() => {
    const stats = getTwimlCacheStats();

    // 警告阈值: 80%
    if (twimlCache.size > TWIML_CACHE_MAX_SIZE * 0.8) {
      console.warn(`[twiml-cache] ⚠️ TwiML 缓存接近容量: ${stats.usage}`);
    }

    // 调试信息
    if (process.env.VOICE_CALL_DEBUG === "true") {
      console.log(`[twiml-cache] 使用情况: ${stats.usage}`);
    }
  }, intervalMs);

  // 返回停止函数
  return () => {
    clearInterval(intervalId);
    console.log("[twiml-cache] 缓存监控已停止");
  };
}
