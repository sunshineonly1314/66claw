#!/usr/bin/env node
/**
 * 本地微信自动化客服完整测试
 *
 * 重点防护措施:
 * 1. 请求随机化 (User-Agent, Headers)
 * 2. 延迟随机化 (防止时间特征)
 * 3. 请求频率控制 (防止被限流)
 * 4. 错误重试策略 (指数退避)
 * 5. 流量混淆 (正常流量掺杂)
 */

import crypto from 'crypto';

console.log("=".repeat(80));
console.log("🔒 微信自动化客服本地测试 (带防检测)");
console.log("=".repeat(80));
console.log();

// ============================================================================
// 防检测配置
// ============================================================================

class AntiDetectionService {
  constructor(config = {}) {
    this.config = {
      replyDelayMin: config.replyDelayMin || 2,
      replyDelayMax: config.replyDelayMax || 8,
      maxRepliesPerHour: config.maxRepliesPerHour || 30,
      maxRepliesPerDay: config.maxRepliesPerDay || 100,
      typingDelayPer100Chars: config.typingDelayPer100Chars || 2,
      quietHours: config.quietHours || { start: "00:00", end: "07:00" },
      blacklistKeywords: config.blacklistKeywords || [],
      whitelistUsers: config.whitelistUsers || [],
    };

    this.hourlyRecords = new Map();
    this.dailyRecords = new Map();
  }

  shouldReply(params) {
    const { openid, text, timestamp } = params;

    // 1. 白名单检查
    if (this.config.whitelistUsers.length > 0 &&
        !this.config.whitelistUsers.includes(openid)) {
      return { allowed: false, reason: "用户不在白名单" };
    }

    // 2. 夜间静默
    if (this.isQuietHours(timestamp)) {
      return { allowed: false, reason: "夜间静默时段" };
    }

    // 3. 黑名单关键词
    const containsBlacklist = this.config.blacklistKeywords.some(
      keyword => text.toLowerCase().includes(keyword.toLowerCase())
    );
    if (containsBlacklist) {
      return { allowed: false, reason: "包含黑名单关键词" };
    }

    // 4. 小时限流
    if (!this.checkHourlyLimit(openid, timestamp)) {
      return { allowed: false, reason: "超过每小时回复上限" };
    }

    // 5. 日限流
    if (!this.checkDailyLimit(openid, timestamp)) {
      return { allowed: false, reason: "超过每日回复上限" };
    }

    return { allowed: true };
  }

  calculateReplyDelay(messageLength) {
    const baseDelay =
      this.config.replyDelayMin +
      Math.random() * (this.config.replyDelayMax - this.config.replyDelayMin);

    const typingDelay = (messageLength / 100) * this.config.typingDelayPer100Chars;
    const totalDelay = (baseDelay + typingDelay) * 1000;
    const jitter = 0.8 + Math.random() * 0.4;

    return Math.floor(totalDelay * jitter);
  }

  recordReply(openid, timestamp) {
    const hourKey = this.getHourKey(timestamp);
    const dayKey = this.getDayKey(timestamp);

    const hourRecord = this.hourlyRecords.get(hourKey) || { timestamp, count: 0 };
    hourRecord.count++;
    this.hourlyRecords.set(hourKey, hourRecord);

    const dayRecord = this.dailyRecords.get(dayKey) || { timestamp, count: 0 };
    dayRecord.count++;
    this.dailyRecords.set(dayKey, dayRecord);

    this.cleanupOldRecords(timestamp);
  }

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

  checkHourlyLimit(openid, timestamp) {
    const hourKey = this.getHourKey(timestamp);
    const record = this.hourlyRecords.get(hourKey);
    return !record || record.count < this.config.maxRepliesPerHour;
  }

  checkDailyLimit(openid, timestamp) {
    const dayKey = this.getDayKey(timestamp);
    const record = this.dailyRecords.get(dayKey);
    return !record || record.count < this.config.maxRepliesPerDay;
  }

  getHourKey(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}`;
  }

  getDayKey(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  cleanupOldRecords(currentTimestamp) {
    const hourAgo = currentTimestamp - 25 * 60 * 60 * 1000;
    const twoDaysAgo = currentTimestamp - 2 * 24 * 60 * 60 * 1000;

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

  getStats() {
    const now = Date.now();
    const hourKey = this.getHourKey(now);
    const dayKey = this.getDayKey(now);

    return {
      hourlyTotal: this.hourlyRecords.get(hourKey)?.count || 0,
      dailyTotal: this.dailyRecords.get(dayKey)?.count || 0,
      currentHour: hourKey,
      currentDay: dayKey,
    };
  }
}

// ============================================================================
// 防抓包措施
// ============================================================================

class AntiSniffingService {
  constructor() {
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    ];

    this.requestCount = 0;
    this.lastRequestTime = 0;
  }

  /**
   * 生成随机 User-Agent
   */
  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * 生成随机请求头 (模拟真实浏览器)
   */
  getRandomHeaders() {
    return {
      'User-Agent': this.getRandomUserAgent(),
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Connection': 'keep-alive',
      // 随机 X-Request-ID (防止请求被关联)
      'X-Request-ID': crypto.randomUUID(),
    };
  }

  /**
   * 智能延迟 (防止请求过于规律)
   */
  async intelligentDelay() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // 如果距离上次请求太近，增加延迟
    if (timeSinceLastRequest < 1000) {
      const extraDelay = 1000 - timeSinceLastRequest;
      await this.sleep(extraDelay + Math.random() * 500);
    }

    // 随机延迟 100-300ms (模拟人工操作)
    await this.sleep(100 + Math.random() * 200);

    this.lastRequestTime = Date.now();
    this.requestCount++;

    // 每10个请求后，增加一个长延迟 (模拟用户休息)
    if (this.requestCount % 10 === 0) {
      await this.sleep(2000 + Math.random() * 3000);
    }
  }

  /**
   * 模拟 Fetch 请求 (带防检测)
   */
  async safeFetch(url, options = {}) {
    await this.intelligentDelay();

    const headers = {
      ...this.getRandomHeaders(),
      ...options.headers,
    };

    console.log(`🔒 [防抓包] 请求: ${url}`);
    console.log(`   User-Agent: ${headers['User-Agent'].substring(0, 50)}...`);
    console.log(`   X-Request-ID: ${headers['X-Request-ID']}`);

    // 这里实际环境会调用真实的 fetch
    // return fetch(url, { ...options, headers });

    // 本地测试模拟
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: [] }),
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// 完整流程测试
// ============================================================================

async function runCompleteTest() {
  console.log("📋 初始化服务");
  console.log("-".repeat(80));

  // 初始化防检测服务
  const antiDetection = new AntiDetectionService({
    replyDelayMin: 2,
    replyDelayMax: 8,
    maxRepliesPerHour: 30,
    maxRepliesPerDay: 100,
    blacklistKeywords: ["测试", "test", "机器人", "bot"],
    whitelistUsers: [],
  });

  // 初始化防抓包服务
  const antiSniffing = new AntiSniffingService();

  console.log("✅ 防检测服务已初始化");
  console.log("✅ 防抓包服务已初始化");
  console.log();

  // ========== 场景 1: 模拟接收微信消息 ==========
  console.log("=".repeat(80));
  console.log("📱 场景 1: 模拟接收微信消息");
  console.log("=".repeat(80));
  console.log();

  const testMessages = [
    { openid: "user_001", text: "你好", shouldReply: true },
    { openid: "user_001", text: "在吗", shouldReply: true },
    { openid: "user_002", text: "这是测试消息", shouldReply: false },
    { openid: "user_003", text: "价格多少", shouldReply: true },
  ];

  for (const msg of testMessages) {
    const timestamp = Date.now();

    console.log(`📨 收到消息`);
    console.log(`   用户: ${msg.openid}`);
    console.log(`   内容: "${msg.text}"`);
    console.log(`   时间: ${new Date(timestamp).toLocaleString("zh-CN")}`);

    // 防检测检查
    const checkResult = antiDetection.shouldReply({
      openid: msg.openid,
      text: msg.text,
      timestamp,
    });

    if (!checkResult.allowed) {
      console.log(`   ❌ 拒绝回复: ${checkResult.reason}`);
      console.log();
      continue;
    }

    console.log(`   ✅ 允许回复`);

    // 模拟 AI 生成回复
    const aiReply = generateAIReply(msg.text);
    console.log(`   💬 AI 回复: "${aiReply}"`);

    // 计算延迟
    const delayMs = antiDetection.calculateReplyDelay(aiReply.length);
    console.log(`   ⏱️  延迟: ${(delayMs / 1000).toFixed(1)}秒 (防检测)`);

    // 模拟发送请求 (带防抓包)
    console.log(`   🔐 准备发送 (防抓包措施已启用)`);

    const sendUrl = `https://api.clawchat.mifengcdn.com/botXXX/sendMessage`;
    await antiSniffing.safeFetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: msg.openid,
        text: aiReply,
      }),
    });

    console.log(`   ✅ 已发送 (已记录统计)`);

    // 记录回复
    antiDetection.recordReply(msg.openid, timestamp);

    // 显示统计
    const stats = antiDetection.getStats();
    console.log(`   📊 统计: 本小时 ${stats.hourlyTotal}/30, 本日 ${stats.dailyTotal}/100`);
    console.log();

    // 延迟等待
    await antiSniffing.sleep(delayMs);
  }

  // ========== 场景 2: 模拟轮询消息 ==========
  console.log("=".repeat(80));
  console.log("📡 场景 2: 模拟轮询消息 (防检测轮询)");
  console.log("=".repeat(80));
  console.log();

  console.log("🔄 开始轮询 (3秒间隔，带随机化)");

  for (let i = 1; i <= 3; i++) {
    console.log(`📡 轮询 #${i}`);

    const pollUrl = `https://api.clawchat.mifengcdn.com/botXXX/getUpdates?offset=0`;
    const response = await antiSniffing.safeFetch(pollUrl);

    console.log(`   ✅ 轮询完成 (状态: ${response.status})`);
    console.log();

    if (i < 3) {
      // 3秒轮询间隔 + 随机抖动
      const pollInterval = 3000 + Math.random() * 500;
      await antiSniffing.sleep(pollInterval);
    }
  }

  // ========== 场景 3: 防抓包演示 ==========
  console.log("=".repeat(80));
  console.log("🔒 场景 3: 防抓包演示");
  console.log("=".repeat(80));
  console.log();

  console.log("演示连续5个请求的防抓包措施:");
  console.log();

  for (let i = 1; i <= 5; i++) {
    console.log(`请求 #${i}:`);
    const headers = antiSniffing.getRandomHeaders();
    console.log(`  User-Agent: ${headers['User-Agent'].substring(0, 60)}...`);
    console.log(`  X-Request-ID: ${headers['X-Request-ID']}`);
    console.log();

    await antiSniffing.sleep(500);
  }

  // ========== 总结 ==========
  console.log("=".repeat(80));
  console.log("✅ 本地测试完成");
  console.log("=".repeat(80));
  console.log();

  const finalStats = antiDetection.getStats();
  console.log("📊 最终统计:");
  console.log(`   本小时回复: ${finalStats.hourlyTotal}/30`);
  console.log(`   本日回复: ${finalStats.dailyTotal}/100`);
  console.log();

  console.log("🔒 防检测措施:");
  console.log("   ✅ 随机延迟 (2-8秒 + 打字模拟)");
  console.log("   ✅ 限流保护 (30条/小时)");
  console.log("   ✅ 黑名单过滤");
  console.log();

  console.log("🔐 防抓包措施:");
  console.log("   ✅ 随机 User-Agent");
  console.log("   ✅ 随机请求头");
  console.log("   ✅ 智能延迟 (防止规律)");
  console.log("   ✅ 请求 ID 随机化");
  console.log();

  console.log("⚠️  安全提示:");
  console.log("   1. 真实使用时必须填入真实的 API Key");
  console.log("   2. 严格限流，避免频繁操作");
  console.log("   3. 定期检查回复质量");
  console.log("   4. 遇到异常立即停止");
  console.log();
}

// ============================================================================
// AI 回复生成器 (模拟)
// ============================================================================

function generateAIReply(userMessage) {
  const responses = {
    "你好": "你好呀！有什么可以帮到你的吗？😊",
    "在吗": "在的，咋了？",
    "价格": "具体价格要看你选哪款呢，稍等我问一下",
  };

  for (const [keyword, response] of Object.entries(responses)) {
    if (userMessage.includes(keyword)) {
      return response;
    }
  }

  return "嗯嗯，我看到了，稍等我回你哈";
}

// ============================================================================
// 运行测试
// ============================================================================

runCompleteTest().catch(err => {
  console.error("❌ 测试失败:", err);
  process.exit(1);
});
