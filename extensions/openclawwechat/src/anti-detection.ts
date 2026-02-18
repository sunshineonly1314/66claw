/**
 * 微信防检测模块
 *
 * 功能:
 * 1. 随机延迟回复
 * 2. 限流控制 (每小时/每天最大消息数)
 * 3. 模拟人工打字延迟
 * 4. 黑名单关键词过滤
 * 5. 白名单用户控制
 * 6. 夜间静默时段
 */

export interface AntiDetectionConfig {
  // 回复延迟 (秒)
  replyDelayMin?: number;
  replyDelayMax?: number;

  // 限流配置
  maxRepliesPerHour?: number;
  maxRepliesPerDay?: number;

  // 打字延迟 (每100字符延迟秒数)
  typingDelayPer100Chars?: number;

  // 夜间静默时段
  quietHours?: {
    start: string; // "00:00"
    end: string;   // "07:00"
  };

  // 黑名单关键词
  blacklistKeywords?: string[];

  // 白名单用户 (openid列表，为空则不限制)
  whitelistUsers?: string[];
}

interface RateLimitRecord {
  timestamp: number;
  count: number;
}

const DEFAULT_CONFIG: Required<AntiDetectionConfig> = {
  replyDelayMin: 2,
  replyDelayMax: 8,
  maxRepliesPerHour: 30,
  maxRepliesPerDay: 100,
  typingDelayPer100Chars: 2,
  quietHours: {
    start: "00:00",
    end: "07:00",
  },
  blacklistKeywords: [],
  whitelistUsers: [],
};

export class AntiDetectionService {
  private config: Required<AntiDetectionConfig>;
  private hourlyRecords: Map<string, RateLimitRecord> = new Map();
  private dailyRecords: Map<string, RateLimitRecord> = new Map();

  constructor(config?: AntiDetectionConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 检查是否允许回复此消息
   */
  shouldReply(params: {
    openid: string;
    text: string;
    timestamp: number;
  }): { allowed: boolean; reason?: string } {
    const { openid, text, timestamp } = params;

    // 1. 检查白名单
    if (
      this.config.whitelistUsers.length > 0 &&
      !this.config.whitelistUsers.includes(openid)
    ) {
      return { allowed: false, reason: "用户不在白名单" };
    }

    // 2. 检查夜间静默
    if (this.isQuietHours(timestamp)) {
      return { allowed: false, reason: "夜间静默时段" };
    }

    // 3. 检查黑名单关键词
    const containsBlacklist = this.config.blacklistKeywords.some((keyword) =>
      text.toLowerCase().includes(keyword.toLowerCase())
    );
    if (containsBlacklist) {
      return { allowed: false, reason: "包含黑名单关键词" };
    }

    // 4. 检查每小时限流
    if (!this.checkHourlyLimit(openid, timestamp)) {
      return { allowed: false, reason: "超过每小时回复上限" };
    }

    // 5. 检查每日限流
    if (!this.checkDailyLimit(openid, timestamp)) {
      return { allowed: false, reason: "超过每日回复上限" };
    }

    return { allowed: true };
  }

  /**
   * 计算回复延迟 (毫秒)
   * 包含: 基础随机延迟 + 打字模拟延迟
   */
  calculateReplyDelay(messageLength: number): number {
    // 基础随机延迟 (秒)
    const baseDelay =
      this.config.replyDelayMin +
      Math.random() *
        (this.config.replyDelayMax - this.config.replyDelayMin);

    // 打字模拟延迟 (秒)
    const typingDelay =
      (messageLength / 100) * this.config.typingDelayPer100Chars;

    // 总延迟 (毫秒)
    const totalDelay = (baseDelay + typingDelay) * 1000;

    // 加入 ±20% 随机波动，更像真人
    const jitter = 0.8 + Math.random() * 0.4;

    return Math.floor(totalDelay * jitter);
  }

  /**
   * 记录一次回复 (用于限流统计)
   */
  recordReply(openid: string, timestamp: number): void {
    // 记录到小时统计
    const hourKey = this.getHourKey(timestamp);
    const hourRecord = this.hourlyRecords.get(hourKey) || {
      timestamp,
      count: 0,
    };
    hourRecord.count++;
    this.hourlyRecords.set(hourKey, hourRecord);

    // 记录到日统计
    const dayKey = this.getDayKey(timestamp);
    const dayRecord = this.dailyRecords.get(dayKey) || {
      timestamp,
      count: 0,
    };
    dayRecord.count++;
    this.dailyRecords.set(dayKey, dayRecord);

    // 清理过期记录
    this.cleanupOldRecords(timestamp);
  }

  /**
   * 检查是否在夜间静默时段
   */
  private isQuietHours(timestamp: number): boolean {
    const date = new Date(timestamp);
    const hour = date.getHours();
    const minute = date.getMinutes();
    const currentTime = hour * 60 + minute;

    const [startHour, startMin] = this.config.quietHours.start.split(":").map(Number);
    const [endHour, endMin] = this.config.quietHours.end.split(":").map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime < endTime) {
      // 正常时段 (例如: 00:00 - 07:00)
      return currentTime >= startTime && currentTime < endTime;
    } else {
      // 跨天时段 (例如: 22:00 - 06:00)
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  /**
   * 检查小时限流
   */
  private checkHourlyLimit(openid: string, timestamp: number): boolean {
    const hourKey = this.getHourKey(timestamp);
    const record = this.hourlyRecords.get(hourKey);

    if (!record) return true;

    return record.count < this.config.maxRepliesPerHour;
  }

  /**
   * 检查日限流
   */
  private checkDailyLimit(openid: string, timestamp: number): boolean {
    const dayKey = this.getDayKey(timestamp);
    const record = this.dailyRecords.get(dayKey);

    if (!record) return true;

    return record.count < this.config.maxRepliesPerDay;
  }

  /**
   * 获取小时键 (格式: 2024-02-18-14)
   */
  private getHourKey(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}`;
  }

  /**
   * 获取日键 (格式: 2024-02-18)
   */
  private getDayKey(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  /**
   * 清理过期记录 (保留最近25小时/2天)
   */
  private cleanupOldRecords(currentTimestamp: number): void {
    const hourAgo = currentTimestamp - 25 * 60 * 60 * 1000;
    const twoDaysAgo = currentTimestamp - 2 * 24 * 60 * 60 * 1000;

    // 清理小时记录
    for (const [key, record] of this.hourlyRecords.entries()) {
      if (record.timestamp < hourAgo) {
        this.hourlyRecords.delete(key);
      }
    }

    // 清理日记录
    for (const [key, record] of this.dailyRecords.entries()) {
      if (record.timestamp < twoDaysAgo) {
        this.dailyRecords.delete(key);
      }
    }
  }

  /**
   * 获取当前统计信息 (用于监控)
   */
  getStats(): {
    hourlyTotal: number;
    dailyTotal: number;
    currentHour: string;
    currentDay: string;
  } {
    const now = Date.now();
    const hourKey = this.getHourKey(now);
    const dayKey = this.getDayKey(now);

    const hourlyTotal = this.hourlyRecords.get(hourKey)?.count || 0;
    const dailyTotal = this.dailyRecords.get(dayKey)?.count || 0;

    return {
      hourlyTotal,
      dailyTotal,
      currentHour: hourKey,
      currentDay: dayKey,
    };
  }
}
