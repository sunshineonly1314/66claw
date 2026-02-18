# 使用 OpenClawCN + Kimi 配置微信自动回复

## 📋 需求说明

你的需求：
- 使用 OpenClawCN 连接本地微信
- 使用 Kimi Code 作为 AI 模型
- 给 tecbinai 发送消息 "你好啊，我是龙虾"

## ⚠️ 重要说明

**OpenClawCN 的微信连接方式**：

目前 OpenClawCN 的 `openclawwechat` 插件只支持通过 **ClawChat 桥接服务** 连接微信，需要：

1. **ClawChat API Key** - 用于连接微信收发消息
2. **Kimi API Key** - 用于 AI 智能回复 (你已有)

## 🔧 配置步骤

### 步骤1: 获取 ClawChat API Key

必须先获取 ClawChat API Key 才能连接微信：

1. 微信搜索小程序: **"ClawChat"**
2. 打开小程序 → 点击右上角 **"设置"**
3. 找到 **"API密钥"** → 点击 **"生成新密钥"**
4. 复制密钥 (格式: `cc_xxx:xxxxxxxxxxxxxxxx`)

### 步骤2: 配置 config.json5

创建配置文件 `%USERPROFILE%\.openclawcn\config.json5`：

\`\`\`json5
{
  gateway: {
    bind: "loopback",
    port: 18789,
  },

  // Kimi AI 模型配置
  models: {
    mode: "merge",
    providers: {
      "kimi": {
        baseUrl: "https://api.moonshot.cn/v1",
        apiKey: "sk-kimi-GVA3cwHgmdtI9pCvaqkvhjw8laZZbeovAx9DgbNHLgB2qt6l836cHbzSRcsWSJgH",
        api: "openai-completions",
        models: [
          {
            id: "moonshot-v1-8k",
            name: "Kimi 8K",
            reasoning: false,
            input: ["text"],
            contextWindow: 8000,
            maxTokens: 500,
          },
        ],
      },
    },
  },

  // 微信插件配置
  plugins: {
    enabled: ["openclawwechat"],
    entries: {
      openclawwechat: {
        enabled: true,
        config: {
          // ⚠️ 这里填入你的 ClawChat API Key
          apiKey: "cc_xxx:你的ClawChat密钥",

          pollIntervalMs: 3000,
          sessionKey: "agent:wechat-kimi:main",
          debug: true,
        },
      },
    },
  },

  // AI 回复配置
  agent: {
    model: "moonshot-v1-8k",
    temperature: 0.8,
    maxTokens: 300,
    systemPrompt: "你是一个友好的助手，名字叫龙虾🦞",
  },
}
\`\`\`

### 步骤3: 启动 OpenClawCN

\`\`\`bash
# 进入项目目录
cd d:\codeknowledge\clawdbot-main\clawdbot-main

# 安装依赖 (如果还没安装)
npm install

# 启动服务
npx tsx src/gateway/server.ts
\`\`\`

### 步骤4: 发送测试消息

服务启动后，使用另一个微信号给你的客服微信号发消息，系统会自动用 Kimi AI 回复。

## 🚫 如果没有 ClawChat API Key 怎么办？

**方案A**: 获取 ClawChat API Key（推荐）
- 免费，只需微信扫码即可

**方案B**: 使用其他微信机器人方案
- Wechaty (需要 iPad 协议)
- itchat (可能被封号)
- wxpy (已停止维护)

⚠️ 注意：个人微信自动化都有被封号风险！

## 💡 直接发送单条消息 (不启动服务)

如果你只是想发送一条测试消息，可以使用我创建的简易脚本：

\`\`\`bash
# 设置 ClawChat API Key
set CLAWCHAT_API_KEY=cc_xxx:你的密钥

# 发送消息
node send-message-directly.mjs tecbinai "你好啊，我是龙虾"
\`\`\`

这个脚本会直接调用 ClawChat API 发送消息，不需要启动完整的 OpenClawCN 服务。

## ❓ 常见问题

### Q1: 我必须使用 ClawChat 吗？
A: 是的，OpenClawCN 的 openclawwechat 插件目前只支持 ClawChat 桥接方式。

### Q2: ClawChat 安全吗？
A: ClawChat 是微信官方小程序，相对安全。但任何第三方微信自动化都有风险。

### Q3: 有没有完全本地的方案？
A: 目前 OpenClawCN 没有提供完全本地的微信连接方案。如需本地方案，可以考虑：
- Wechaty (需要自己部署协议服务器)
- 开发桌面自动化 (风险更高)

### Q4: Kimi Code API Key 在哪用？
A: Kimi Code API Key 是用于访问 Kimi AI 模型的，配置在 `models.providers.kimi.apiKey` 中，用于智能回复。

## 📚 相关文件

- [send-message-directly.mjs](send-message-directly.mjs) - 直接发送消息脚本
- [test-wechat-with-kimi.json5](test-wechat-with-kimi.json5) - 完整配置示例
- [QUICK-START-GUIDE.md](QUICK-START-GUIDE.md) - 完整部署指南
