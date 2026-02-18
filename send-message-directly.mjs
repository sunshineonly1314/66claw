#!/usr/bin/env node
/**
 * 简易版微信消息发送脚本
 *
 * 使用方法:
 *   node send-message-directly.mjs <目标用户> <消息内容>
 *
 * 示例:
 *   node send-message-directly.mjs tecbinai "你好啊，我是龙虾"
 */

import crypto from 'crypto';

// ============================================================================
// 配置 - 直接在这里填写你的 ClawChat API Key
// ============================================================================

const CLAWCHAT_API_KEY = process.env.CLAWCHAT_API_KEY || "YOUR_API_KEY_HERE";

// ============================================================================
// 主程序
// ============================================================================

async function sendWeChatMessage(toUser, message) {
  // 检查 API Key
  if (CLAWCHAT_API_KEY === "YOUR_API_KEY_HERE") {
    console.error("❌ 错误: 请先配置 ClawChat API Key!");
    console.error();
    console.error("方法1: 设置环境变量");
    console.error("  Windows: set CLAWCHAT_API_KEY=cc_xxx:xxxxxxxx");
    console.error("  Linux:   export CLAWCHAT_API_KEY=cc_xxx:xxxxxxxx");
    console.error();
    console.error("方法2: 编辑脚本，修改第 17 行的 YOUR_API_KEY_HERE");
    console.error();
    console.error("📖 获取 ClawChat API Key:");
    console.error("  1. 微信搜索小程序 'ClawChat'");
    console.error("  2. 设置 -> API密钥 -> 生成新密钥");
    console.error();
    process.exit(1);
  }

  console.log("=".repeat(80));
  console.log("📱 发送微信消息");
  console.log("=".repeat(80));
  console.log();
  console.log(`🎯 目标: ${toUser}`);
  console.log(`💬 内容: ${message}`);
  console.log();

  // 发送请求
  const url = "https://api.clawchat.cn/api/v1/send";

  const headers = {
    'Authorization': `Bearer ${CLAWCHAT_API_KEY}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'X-Request-ID': crypto.randomUUID(),
  };

  const body = {
    to: toUser,
    type: 'text',
    content: {
      text: message,
    },
  };

  try {
    console.log("📤 发送中...");

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.ok) {
      console.log();
      console.log("✅ 发送成功!");
      console.log("📊 响应:", JSON.stringify(data, null, 2));
      console.log();
      console.log("=".repeat(80));
      console.log("🎉 请在微信中查看是否收到消息");
      console.log("=".repeat(80));
    } else {
      console.log();
      console.log("❌ 发送失败!");
      console.log("状态码:", response.status);
      console.log("错误信息:", JSON.stringify(data, null, 2));
      console.log();

      if (response.status === 401) {
        console.log("💡 提示: API Key 可能不正确，请检查:");
        console.log("  1. 格式是否为 cc_xxx:xxxxxxxx");
        console.log("  2. 是否从 ClawChat 小程序正确复制");
        console.log("  3. 密钥是否已过期");
      } else if (response.status === 404) {
        console.log("💡 提示: 找不到用户 '" + toUser + "'，请检查:");
        console.log("  1. 用户名拼写是否正确");
        console.log("  2. 该用户是否在你的微信好友列表中");
        console.log("  3. 尝试使用微信号 (wxid) 而不是昵称");
      }

      console.log();
      process.exit(1);
    }
  } catch (error) {
    console.log();
    console.log("❌ 请求失败!");
    console.log("错误:", error.message);
    console.log();
    console.log("💡 可能的原因:");
    console.log("  1. 网络连接问题");
    console.log("  2. ClawChat 服务暂时不可用");
    console.log("  3. 需要在 ClawChat 小程序中先绑定微信");
    console.log();
    process.exit(1);
  }
}

// 从命令行参数获取目标和消息
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log("用法: node send-message-directly.mjs <目标用户> <消息内容>");
  console.log();
  console.log("示例:");
  console.log("  node send-message-directly.mjs tecbinai \"你好啊，我是龙虾\"");
  console.log("  node send-message-directly.mjs wxid_abc123 \"测试消息\"");
  process.exit(1);
}

const toUser = args[0];
const message = args.slice(1).join(' ');

sendWeChatMessage(toUser, message);
