#!/usr/bin/env node
/**
 * 微信自动化客服防检测测试脚本
 *
 * 测试内容:
 * 1. 防检测配置加载
 * 2. 限流逻辑验证
 * 3. 随机延迟计算
 * 4. 黑名单关键词过滤
 * 5. 夜间静默检测
 */

import { AntiDetectionService } from "./extensions/openclawwechat/src/anti-detection.ts";

console.log("=".repeat(70));
console.log("微信自动化客服 - 防检测机制测试");
console.log("=".repeat(70));
console.log();

// ============================================================================
// 测试 1: 初始化防检测服务
// ============================================================================
console.log("📋 测试 1: 初始化防检测服务");
console.log("-".repeat(70));

const antiDetection = new AntiDetectionService({
  replyDelayMin: 2,
  replyDelayMax: 8,
  maxRepliesPerHour: 30,
  maxRepliesPerDay: 100,
  typingDelayPer100Chars: 2,
  quietHours: {
    start: "00:00",
    end: "07:00",
  },
  blacklistKeywords: ["测试", "test", "机器人", "bot"],
  whitelistUsers: [], // 空白名单表示允许所有用户
});

console.log("✅ 防检测服务初始化成功");
console.log();

// ============================================================================
// 测试 2: 黑名单关键词过滤
// ============================================================================
console.log("📋 测试 2: 黑名单关键词过滤");
console.log("-".repeat(70));

const testMessages = [
  { text: "你好，在吗？", shouldAllow: true },
  { text: "这是测试消息", shouldAllow: false },
  { text: "你是机器人吗？", shouldAllow: false },
  { text: "请问产品价格多少", shouldAllow: true },
  { text: "This is a test", shouldAllow: false },
];

const testOpenid = "test_user_12345";
const testTimestamp = Date.now();

for (const msg of testMessages) {
  const result = antiDetection.shouldReply({
    openid: testOpenid,
    text: msg.text,
    timestamp: testTimestamp,
  });

  const status = result.allowed ? "✅ 允许" : "❌ 拒绝";
  const reason = result.reason ? ` (原因: ${result.reason})` : "";

  console.log(`${status} "${msg.text}"${reason}`);

  if (result.allowed !== msg.shouldAllow) {
    console.error(
      `   ⚠️  预期: ${msg.shouldAllow ? "允许" : "拒绝"}, 实际: ${result.allowed ? "允许" : "拒绝"}`,
    );
  }
}
console.log();

// ============================================================================
// 测试 3: 随机延迟计算
// ============================================================================
console.log("📋 测试 3: 随机延迟计算");
console.log("-".repeat(70));

const messageLengths = [10, 50, 100, 200, 500];

console.log("消息长度 | 延迟范围 (秒)");
console.log("-".repeat(40));

for (const length of messageLengths) {
  const delays = [];
  for (let i = 0; i < 10; i++) {
    const delayMs = antiDetection.calculateReplyDelay(length);
    delays.push(delayMs / 1000);
  }

  const min = Math.min(...delays).toFixed(1);
  const max = Math.max(...delays).toFixed(1);
  const avg = (delays.reduce((a, b) => a + b, 0) / delays.length).toFixed(1);

  console.log(`${length}字    | ${min}s - ${max}s (平均: ${avg}s)`);
}
console.log();

// ============================================================================
// 测试 4: 限流控制
// ============================================================================
console.log("📋 测试 4: 限流控制 (每小时最多30条)");
console.log("-".repeat(70));

const rateLimitService = new AntiDetectionService({
  maxRepliesPerHour: 5, // 降低限制方便测试
  maxRepliesPerDay: 10,
});

const userId = "test_user_rate_limit";
const baseTime = Date.now();

for (let i = 1; i <= 7; i++) {
  const canReply = rateLimitService.shouldReply({
    openid: userId,
    text: `消息 ${i}`,
    timestamp: baseTime + i * 1000,
  });

  if (canReply.allowed) {
    rateLimitService.recordReply(userId, baseTime + i * 1000);
    console.log(`✅ 消息 ${i}: 允许回复`);
  } else {
    console.log(`❌ 消息 ${i}: 拒绝回复 (${canReply.reason})`);
  }
}

const stats = rateLimitService.getStats();
console.log();
console.log(`📊 当前统计: 本小时 ${stats.hourlyTotal}/5, 本日 ${stats.dailyTotal}/10`);
console.log();

// ============================================================================
// 测试 5: 夜间静默检测
// ============================================================================
console.log("📋 测试 5: 夜间静默检测 (00:00 - 07:00)");
console.log("-".repeat(70));

const quietHoursService = new AntiDetectionService({
  quietHours: {
    start: "00:00",
    end: "07:00",
  },
});

const testTimes = [
  { hour: 23, minute: 30, shouldAllow: true },
  { hour: 0, minute: 30, shouldAllow: false },
  { hour: 3, minute: 0, shouldAllow: false },
  { hour: 6, minute: 59, shouldAllow: false },
  { hour: 7, minute: 0, shouldAllow: true },
  { hour: 12, minute: 0, shouldAllow: true },
];

for (const time of testTimes) {
  const testDate = new Date();
  testDate.setHours(time.hour, time.minute, 0, 0);

  const result = quietHoursService.shouldReply({
    openid: "test_user",
    text: "你好",
    timestamp: testDate.getTime(),
  });

  const timeStr = `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
  const status = result.allowed ? "✅ 允许" : "❌ 静默";

  console.log(`${status} ${timeStr}`);

  if (result.allowed !== time.shouldAllow) {
    console.error(
      `   ⚠️  预期: ${time.shouldAllow ? "允许" : "静默"}, 实际: ${result.allowed ? "允许" : "静默"}`,
    );
  }
}
console.log();

// ============================================================================
// 测试 6: 白名单控制
// ============================================================================
console.log("📋 测试 6: 白名单用户控制");
console.log("-".repeat(70));

const whitelistService = new AntiDetectionService({
  whitelistUsers: ["allowed_user_1", "allowed_user_2"],
});

const userTests = [
  { openid: "allowed_user_1", shouldAllow: true },
  { openid: "allowed_user_2", shouldAllow: true },
  { openid: "unknown_user", shouldAllow: false },
  { openid: "spam_user", shouldAllow: false },
];

for (const test of userTests) {
  const result = whitelistService.shouldReply({
    openid: test.openid,
    text: "你好",
    timestamp: Date.now(),
  });

  const status = result.allowed ? "✅ 允许" : "❌ 拒绝";
  const reason = result.reason ? ` (${result.reason})` : "";

  console.log(`${status} ${test.openid}${reason}`);

  if (result.allowed !== test.shouldAllow) {
    console.error(
      `   ⚠️  预期: ${test.shouldAllow ? "允许" : "拒绝"}, 实际: ${result.allowed ? "允许" : "拒绝"}`,
    );
  }
}
console.log();

// ============================================================================
// 总结
// ============================================================================
console.log("=".repeat(70));
console.log("✅ 所有防检测测试完成！");
console.log("=".repeat(70));
console.log();
console.log("⚠️  实际使用建议:");
console.log("   1. 回复延迟: 2-8秒 (根据消息长度动态调整)");
console.log("   2. 每小时限制: 不超过30条");
console.log("   3. 每日限制: 不超过100条");
console.log("   4. 夜间静默: 00:00 - 07:00");
console.log("   5. 避免在消息中出现'机器人'、'自动回复'等敏感词");
console.log("   6. 定期更换系统提示词，避免回复模式化");
console.log();
console.log("🔒 防封号核心策略:");
console.log("   - 永远不要主动群发广告");
console.log("   - 只回复用户主动发来的消息");
console.log("   - 回复内容要自然，像真人聊天");
console.log("   - 遇到投诉、纠纷等敏感话题立即转人工");
console.log();
