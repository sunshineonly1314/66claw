const DEFAULT_CONFIG = {
  replyDelayMin: 2,
  replyDelayMax: 8,
  maxRepliesPerHour: 30,
  maxRepliesPerDay: 100,
  typingDelayPer100Chars: 2,
  quietHours: {
    start: "00:00",
    end: "07:00"
  },
  blacklistKeywords: [],
  whitelistUsers: []
};
class AntiDetectionService {
  config;
  hourlyRecords = /* @__PURE__ */ new Map();
  dailyRecords = /* @__PURE__ */ new Map();
  constructor(config) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  /**
   * 检查是否允许回复此消息
   */
  shouldReply(params) {
    const { openid, text, timestamp } = params;
    if (this.config.whitelistUsers.length > 0 && !this.config.whitelistUsers.includes(openid)) {
      return { allowed: false, reason: "\u7528\u6237\u4E0D\u5728\u767D\u540D\u5355" };
    }
    if (this.isQuietHours(timestamp)) {
      return { allowed: false, reason: "\u591C\u95F4\u9759\u9ED8\u65F6\u6BB5" };
    }
    const containsBlacklist = this.config.blacklistKeywords.some(
      (keyword) => text.toLowerCase().includes(keyword.toLowerCase())
    );
    if (containsBlacklist) {
      return { allowed: false, reason: "\u5305\u542B\u9ED1\u540D\u5355\u5173\u952E\u8BCD" };
    }
    if (!this.checkHourlyLimit(openid, timestamp)) {
      return { allowed: false, reason: "\u8D85\u8FC7\u6BCF\u5C0F\u65F6\u56DE\u590D\u4E0A\u9650" };
    }
    if (!this.checkDailyLimit(openid, timestamp)) {
      return { allowed: false, reason: "\u8D85\u8FC7\u6BCF\u65E5\u56DE\u590D\u4E0A\u9650" };
    }
    return { allowed: true };
  }
  /**
   * 计算回复延迟 (毫秒)
   * 包含: 基础随机延迟 + 打字模拟延迟
   */
  calculateReplyDelay(messageLength) {
    const baseDelay = this.config.replyDelayMin + Math.random() * (this.config.replyDelayMax - this.config.replyDelayMin);
    const typingDelay = messageLength / 100 * this.config.typingDelayPer100Chars;
    const totalDelay = (baseDelay + typingDelay) * 1e3;
    const jitter = 0.8 + Math.random() * 0.4;
    return Math.floor(totalDelay * jitter);
  }
  /**
   * 记录一次回复 (用于限流统计)
   */
  recordReply(openid, timestamp) {
    const hourKey = this.getHourKey(timestamp);
    const hourRecord = this.hourlyRecords.get(hourKey) || {
      timestamp,
      count: 0
    };
    hourRecord.count++;
    this.hourlyRecords.set(hourKey, hourRecord);
    const dayKey = this.getDayKey(timestamp);
    const dayRecord = this.dailyRecords.get(dayKey) || {
      timestamp,
      count: 0
    };
    dayRecord.count++;
    this.dailyRecords.set(dayKey, dayRecord);
    this.cleanupOldRecords(timestamp);
  }
  /**
   * 检查是否在夜间静默时段
   */
  isQuietHours(timestamp) {
    const date = new Date(timestamp);
    const hour = date.getHours();
    const minute = date.getMinutes();
    const currentTime = hour * 60 + minute;
    const [startHour, startMin] = this.config.quietHours.start.split(":").map(Number);
    const [endHour, endMin] = this.config.quietHours.end.split(":").map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;
    if (startTime < endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      return currentTime >= startTime || currentTime < endTime;
    }
  }
  /**
   * 检查小时限流
   */
  checkHourlyLimit(openid, timestamp) {
    const hourKey = this.getHourKey(timestamp);
    const record = this.hourlyRecords.get(hourKey);
    if (!record) return true;
    return record.count < this.config.maxRepliesPerHour;
  }
  /**
   * 检查日限流
   */
  checkDailyLimit(openid, timestamp) {
    const dayKey = this.getDayKey(timestamp);
    const record = this.dailyRecords.get(dayKey);
    if (!record) return true;
    return record.count < this.config.maxRepliesPerDay;
  }
  /**
   * 获取小时键 (格式: 2024-02-18-14)
   */
  getHourKey(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}`;
  }
  /**
   * 获取日键 (格式: 2024-02-18)
   */
  getDayKey(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  /**
   * 清理过期记录 (保留最近25小时/2天)
   */
  cleanupOldRecords(currentTimestamp) {
    const hourAgo = currentTimestamp - 25 * 60 * 60 * 1e3;
    const twoDaysAgo = currentTimestamp - 2 * 24 * 60 * 60 * 1e3;
    for (const [key, record] of this.hourlyRecords.entries()) {
      if (record.timestamp < hourAgo) {
        this.hourlyRecords.delete(key);
      }
    }
    for (const [key, record] of this.dailyRecords.entries()) {
      if (record.timestamp < twoDaysAgo) {
        this.dailyRecords.delete(key);
      }
    }
  }
  /**
   * 获取当前统计信息 (用于监控)
   */
  getStats() {
    const now = Date.now();
    const hourKey = this.getHourKey(now);
    const dayKey = this.getDayKey(now);
    const hourlyTotal = this.hourlyRecords.get(hourKey)?.count || 0;
    const dailyTotal = this.dailyRecords.get(dayKey)?.count || 0;
    return {
      hourlyTotal,
      dailyTotal,
      currentHour: hourKey,
      currentDay: dayKey
    };
  }
}
export {
  AntiDetectionService
};
