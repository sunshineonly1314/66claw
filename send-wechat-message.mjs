#!/usr/bin/env node
/**
 * 直接发送微信消息测试脚本
 *
 * 用法: node send-wechat-message.mjs
 * 功能: 向指定微信用户发送消息
 */

import crypto from 'crypto';

console.log("=".repeat(80));
console.log("📱 微信消息发送测试");
console.log("=".repeat(80));
console.log();

// ============================================================================
// 配置
// ============================================================================

const CONFIG = {
  // ClawChat API 配置
  apiKey: process.env.CLAWCHAT_API_KEY || "placeholder:placeholder",
  baseUrl: "https://api.clawchat.cn",

  // 目标用户
  targetUser: "tecbinai",

  // 要发送的消息
  message: "你好啊，我是龙虾",
};

// ============================================================================
// ClawChat API 客户端
// ============================================================================

class ClawChatClient {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * 生成随机 User-Agent
   */
  getRandomUserAgent() {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * 生成请求头
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': this.getRandomUserAgent(),
      'Accept': 'application/json',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'X-Request-ID': crypto.randomUUID(),
    };
  }

  /**
   * 发送消息
   */
  async sendMessage(toUser, content) {
    const url = `${this.baseUrl}/api/v1/send`;

    const body = {
      to: toUser,
      type: 'text',
      content: {
        text: content,
      },
    };

    console.log(`📤 发送消息到: ${toUser}`);
    console.log(`📝 内容: ${content}`);
    console.log();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("✅ 发送成功!");
        console.log("📊 响应:", JSON.stringify(data, null, 2));
        return data;
      } else {
        console.error("❌ 发送失败!");
        console.error("状态码:", response.status);
        console.error("错误信息:", JSON.stringify(data, null, 2));
        return null;
      }
    } catch (error) {
      console.error("❌ 请求失败!");
      console.error("错误:", error.message);
      return null;
    }
  }

  /**
   * 获取用户列表 (用于查找用户ID)
   */
  async getContacts() {
    const url = `${this.baseUrl}/api/v1/contacts`;

    console.log("📋 获取联系人列表...");
    console.log();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("✅ 获取成功!");
        console.log(`📊 联系人数量: ${data.contacts?.length || 0}`);
        return data.contacts || [];
      } else {
        console.error("❌ 获取失败!");
        console.error("状态码:", response.status);
        console.error("错误信息:", JSON.stringify(data, null, 2));
        return [];
      }
    } catch (error) {
      console.error("❌ 请求失败!");
      console.error("错误:", error.message);
      return [];
    }
  }
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  // 检查 API Key
  if (CONFIG.apiKey === "placeholder:placeholder") {
    console.error("❌ 错误: 请先配置 ClawChat API Key");
    console.error();
    console.error("方法1: 设置环境变量");
    console.error("  export CLAWCHAT_API_KEY='cc_xxx:xxxxxxxx'");
    console.error();
    console.error("方法2: 修改脚本中的 CONFIG.apiKey");
    console.error();
    console.error("📖 获取 API Key:");
    console.error("  1. 微信搜索小程序 'ClawChat'");
    console.error("  2. 点击右上角'设置' -> 'API密钥'");
    console.error("  3. 生成新密钥并复制");
    console.error();
    process.exit(1);
  }

  console.log("🔑 API Key:", CONFIG.apiKey.substring(0, 10) + "...");
  console.log("🎯 目标用户:", CONFIG.targetUser);
  console.log("💬 消息内容:", CONFIG.message);
  console.log();
  console.log("-".repeat(80));
  console.log();

  // 创建客户端
  const client = new ClawChatClient(CONFIG.apiKey, CONFIG.baseUrl);

  // 步骤1: 获取联系人列表 (可选，用于验证用户是否存在)
  console.log("🔍 步骤1: 查找联系人...");
  console.log();

  const contacts = await client.getContacts();

  if (contacts.length > 0) {
    console.log("📋 前10个联系人:");
    contacts.slice(0, 10).forEach((contact, index) => {
      console.log(`  ${index + 1}. ${contact.nickname || contact.remark || contact.wxid} (${contact.wxid})`);
    });
    console.log();

    // 查找目标用户
    const targetContact = contacts.find(c =>
      c.wxid === CONFIG.targetUser ||
      c.nickname === CONFIG.targetUser ||
      c.remark === CONFIG.targetUser
    );

    if (targetContact) {
      console.log(`✅ 找到目标用户: ${targetContact.nickname || targetContact.remark} (${targetContact.wxid})`);
    } else {
      console.log(`⚠️  未找到用户 '${CONFIG.targetUser}' (但仍会尝试发送)`);
    }
    console.log();
  } else {
    console.log("⚠️  无法获取联系人列表 (可能 API 不支持或权限不足)");
    console.log();
  }

  console.log("-".repeat(80));
  console.log();

  // 步骤2: 发送消息
  console.log("🔍 步骤2: 发送消息...");
  console.log();

  const result = await client.sendMessage(CONFIG.targetUser, CONFIG.message);

  console.log();
  console.log("=".repeat(80));

  if (result) {
    console.log("🎉 测试完成! 请在微信中查看是否收到消息");
  } else {
    console.log("😢 测试失败! 请检查:");
    console.log("  1. API Key 是否正确");
    console.log("  2. 用户名 'tecbinai' 是否存在");
    console.log("  3. ClawChat 服务是否正常");
    console.log("  4. 网络连接是否正常");
  }

  console.log("=".repeat(80));
}

// 运行
main().catch(error => {
  console.error();
  console.error("💥 未处理的错误:");
  console.error(error);
  process.exit(1);
});
