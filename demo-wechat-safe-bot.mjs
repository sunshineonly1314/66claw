#!/usr/bin/env node
/**
 * 微信自动化客服演示脚本
 *
 * 模拟完整的消息处理流程:
 * 1. 接收微信消息
 * 2. 防检测过滤
 * 3. AI 生成回复
 * 4. 延迟发送
 */

import { AntiDetectionService } from "./extensions/openclawwechat/src/anti-detection.ts";

console.log("=".repeat(80));
console.log("🤖 微信自动化客服演示 (带防检测机制)");
console.log("=".repeat(80));
console.log();

// ============================================================================
// 初始化防检测服务
// ============================================================================
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
  blacklistKeywords: ["测试", "test", "机器人", "bot", "自动回复"],
  whitelistUsers: [],
});

// ============================================================================
// AI 回复生成器 (通过 Kimi Code API 生成真实回复)
// 后续正式环境走 OpenClaw → Kimi
// ============================================================================
const KIMI_API_BASE = process.env.KIMI_API_BASE || "https://api.kimi.com/coding/v1";
const KIMI_API_KEY = process.env.KIMI_API_KEY || "";
const KIMI_MODEL = process.env.KIMI_MODEL || "kimi-for-coding";

const SYSTEM_PROMPT = `你是一个友好的微信客服助手。请用自然、口语化的中文回复用户消息。
要求:
- 回复简短 (1-2句话)
- 语气像朋友聊天，不要太正式
- 不要使用 markdown 格式
- 适当使用语气词 (嗯嗯、哈、呢)`;

async function generateAIReply(userMessage) {
  try {
    if (!KIMI_API_KEY) throw new Error("KIMI_API_KEY 未设置");
    const resp = await fetch(`${KIMI_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${KIMI_API_KEY}`,
        "User-Agent": "KimiCLI/0.77",
      },
      body: JSON.stringify({
        model: KIMI_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Kimi API ${resp.status}: ${errText}`);
    }
    const data = await resp.json();
    const msg = data.choices?.[0]?.message;
    return msg?.content?.trim() || "嗯嗯，我看到了，稍等我回你哈";
  } catch (err) {
    console.warn(`   ⚠️ AI 生成失败 (${err.message}), 使用默认回复`);
    // Fallback to keyword matching
    const responses = {
      "你好": "你好呀！有什么可以帮到你的吗？",
      "在吗": "在的，咋了？",
      "你是谁": "我是帮朋友回消息的，TA现在有点忙哈",
      "价格": "具体价格要看你选哪款呢，稍等我问一下",
      "谢谢": "不客气～",
      "晚安": "晚安，明天见",
    };
    for (const [keyword, response] of Object.entries(responses)) {
      if (userMessage.includes(keyword)) return response;
    }
    return "嗯嗯，我看到了，稍等我回你哈";
  }
}

// ============================================================================
// 模拟消息处理流程
// ============================================================================
async function processMessage(openid, text, timestamp) {
  console.log("📨 收到消息");
  console.log(`   用户: ${openid}`);
  console.log(`   内容: "${text}"`);
  console.log(`   时间: ${new Date(timestamp).toLocaleString("zh-CN")}`);
  console.log();

  // 步骤 1: 检查是否允许回复
  const checkResult = antiDetection.shouldReply({
    openid,
    text,
    timestamp,
  });

  if (!checkResult.allowed) {
    console.log(`❌ 拒绝回复: ${checkResult.reason}`);
    console.log();
    return;
  }

  console.log("✅ 允许回复");
  console.log();

  // 步骤 2: 生成 AI 回复 (调用 Kimi Code API)
  console.log("🤔 AI 思考中 (Kimi Code API)...");
  const aiReply = await generateAIReply(text);
  console.log(`💬 AI 生成回复: "${aiReply}"`);
  console.log();

  // 步骤 3: 计算延迟时间
  const delayMs = antiDetection.calculateReplyDelay(aiReply.length);
  const delaySec = (delayMs / 1000).toFixed(1);
  console.log(`⏱️  延迟发送: ${delaySec} 秒 (模拟打字)`);
  console.log();

  // 步骤 4: 模拟延迟
  console.log("⌛ 延迟中...");
  const startTime = Date.now();
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  const actualDelay = ((Date.now() - startTime) / 1000).toFixed(1);

  // 步骤 5: 发送回复
  console.log(`✅ 已发送回复 (实际延迟: ${actualDelay}s)`);
  console.log(`   → "${aiReply}"`);
  console.log();

  // 步骤 6: 记录回复 (用于限流统计)
  antiDetection.recordReply(openid, timestamp);

  // 显示当前统计
  const stats = antiDetection.getStats();
  console.log(`📊 统计: 本小时 ${stats.hourlyTotal}/30, 本日 ${stats.dailyTotal}/100`);
  console.log("-".repeat(80));
  console.log();
}

// ============================================================================
// 模拟场景测试
// ============================================================================
console.log("📋 场景 1: 正常对话");
console.log("=".repeat(80));
console.log();

const user1 = "test_user_001";
const now = Date.now();

await processMessage(user1, "你好", now);
await new Promise((resolve) => setTimeout(resolve, 1000));

await processMessage(user1, "在吗", now + 10000);
await new Promise((resolve) => setTimeout(resolve, 1000));

console.log();
console.log("📋 场景 2: 黑名单关键词拦截");
console.log("=".repeat(80));
console.log();

await processMessage(user1, "这是测试消息", now + 20000);
await new Promise((resolve) => setTimeout(resolve, 1000));

await processMessage(user1, "你是机器人吗？", now + 30000);
await new Promise((resolve) => setTimeout(resolve, 1000));

console.log();
console.log("📋 场景 3: 限流测试");
console.log("=".repeat(80));
console.log();

// 创建一个限流很严格的服务 (方便演示)
const strictAntiDetection = new AntiDetectionService({
  maxRepliesPerHour: 3,
  maxRepliesPerDay: 5,
  blacklistKeywords: [],
});

console.log("⚙️  限流配置: 每小时最多 3 条");
console.log();

for (let i = 1; i <= 5; i++) {
  const timestamp = now + i * 5000;
  const text = `消息 ${i}`;

  console.log(`📨 收到消息 ${i}: "${text}"`);

  const checkResult = strictAntiDetection.shouldReply({
    openid: user1,
    text,
    timestamp,
  });

  if (checkResult.allowed) {
    console.log(`✅ 允许回复`);
    strictAntiDetection.recordReply(user1, timestamp);

    const stats = strictAntiDetection.getStats();
    console.log(`📊 统计: ${stats.hourlyTotal}/3`);
  } else {
    console.log(`❌ 拒绝回复: ${checkResult.reason}`);
  }

  console.log();
  await new Promise((resolve) => setTimeout(resolve, 500));
}

console.log();
console.log("📋 场景 4: 夜间静默测试");
console.log("=".repeat(80));
console.log();

const nightService = new AntiDetectionService({
  quietHours: {
    start: "00:00",
    end: "07:00",
  },
});

// 模拟凌晨 3 点的消息
const nightTime = new Date();
nightTime.setHours(3, 0, 0, 0);

console.log(`⏰ 当前时间: ${nightTime.toLocaleString("zh-CN")}`);
console.log();

const nightResult = nightService.shouldReply({
  openid: user1,
  text: "你好",
  timestamp: nightTime.getTime(),
});

if (nightResult.allowed) {
  console.log("✅ 允许回复");
} else {
  console.log(`❌ 拒绝回复: ${nightResult.reason}`);
}

console.log();

// 模拟早上 8 点的消息
const morningTime = new Date();
morningTime.setHours(8, 0, 0, 0);

console.log(`⏰ 当前时间: ${morningTime.toLocaleString("zh-CN")}`);
console.log();

const morningResult = nightService.shouldReply({
  openid: user1,
  text: "你好",
  timestamp: morningTime.getTime(),
});

if (morningResult.allowed) {
  console.log("✅ 允许回复");
} else {
  console.log(`❌ 拒绝回复: ${morningResult.reason}`);
}

console.log();
console.log("=".repeat(80));
console.log("✅ 演示完成！");
console.log("=".repeat(80));
console.log();
console.log("💡 关键要点:");
console.log("   1. 每条消息都经过多重检查 (黑名单、限流、时段)");
console.log("   2. 回复延迟随消息长度动态调整");
console.log("   3. 限流保护防止频繁回复被检测");
console.log("   4. 夜间自动静默，避免打扰");
console.log();
console.log("🔒 防封号建议:");
console.log("   - 只用于个人助理场景，不要做大规模客服");
console.log("   - 每天回复量控制在 50 条以内");
console.log("   - 定期检查回复质量，确保自然");
console.log("   - 遇到投诉、纠纷立即转人工");
console.log();
