/**
 * 飞书消息去重
 * Feishu Message Deduplication
 *
 * 使用 Map + TTL + LRU 淘汰替代简单 Set + setTimeout
 * 参考 m1heng/clawdbot-feishu (MIT License)
 */

export interface DedupOptions {
  /** 最大缓存条目数（超过后淘汰最旧的 25%） */
  maxSize?: number;
  /** 条目过期时间（毫秒） */
  ttlMs?: number;
  /** 清理间隔（毫秒） */
  cleanupIntervalMs?: number;
}

const DEFAULT_MAX_SIZE = 1000;
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 分钟
const DEFAULT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟

export class MessageDedup {
  private seen = new Map<string, number>(); // key -> timestamp
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private readonly cleanupIntervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(opts?: DedupOptions) {
    this.maxSize = opts?.maxSize ?? DEFAULT_MAX_SIZE;
    this.ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS;
    this.cleanupIntervalMs = opts?.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;
  }

  /**
   * 尝试记录消息。
   * 如果是新消息返回 true，重复消息返回 false。
   *
   * @param messageId - 消息 ID
   * @param scope - 可选的作用域（如 chatId），用于多账号/多群隔离
   */
  tryRecord(messageId: string, scope?: string): boolean {
    const key = scope ? `${scope}:${messageId}` : messageId;
    if (this.seen.has(key)) {
      return false;
    }

    // LRU 淘汰：超过最大容量时删除最旧的 25%
    if (this.seen.size >= this.maxSize) {
      this.evict();
    }

    this.seen.set(key, Date.now());
    return true;
  }

  /** 启动定期清理 */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.cleanup(), this.cleanupIntervalMs);
    // 避免 timer 阻止进程退出
    if (this.timer && typeof this.timer === "object" && "unref" in this.timer) {
      (this.timer as NodeJS.Timeout).unref();
    }
  }

  /** 停止定期清理 */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 当前缓存大小 */
  get size(): number {
    return this.seen.size;
  }

  /** 清除所有记录 */
  clear(): void {
    this.seen.clear();
  }

  /** 清理过期条目 */
  private cleanup(): void {
    const cutoff = Date.now() - this.ttlMs;
    for (const [key, ts] of this.seen) {
      if (ts < cutoff) {
        this.seen.delete(key);
      }
    }
  }

  /** 淘汰最旧的 25% 条目 */
  private evict(): void {
    const entries = [...this.seen.entries()].sort((a, b) => a[1] - b[1]);
    const toRemove = Math.max(1, Math.floor(this.maxSize * 0.25));
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.seen.delete(entries[i][0]);
    }
  }
}
