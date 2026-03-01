---
name: smart-followups  
description: 在 AI 响应后生成上下文相关的后续问题建议。当用户请求“followups”时，显示 3 个可点击按钮（Quick、Deep Dive、Related）。  
triggers:  
  - followups  
  - follow-ups  
  - suggestions  
  - give me suggestions  
  - what should I ask  
channels:  
  - telegram  
  - discord  
  - slack  
  - signal  
  - whatsapp  
  - imessage  
  - sms  
  - matrix  
  - email  
---

# 智能后续问题技能（Smart Follow-ups Skill）

为 Clawdbot 对话生成上下文相关的后续问题建议。

## 触发方式

说出以下任意一种表达，即可获取后续问题建议：

| 触发词 | 示例 |
|--------|------|
| `followups` | “followups” |
| `follow-ups` | “give me follow-ups” |
| `suggestions` | “any suggestions?” |
| `what next` | “what should I ask next?” |

> **Note:** This is a keyword the agent recognizes, not a registered `/slash` command. Clawdbot skills are guidance docs that tell the agent how to respond.

## 使用方法

在任意对话中说 “followups”：

```
You: What is Docker?
Bot: Docker is a containerization platform...

You: /followups

Bot: 💡 What would you like to explore next?
[⚡ How do I install Docker?]
[🧠 Explain container architecture]
[🔗 Docker vs Kubernetes?]
```

**在支持按钮的渠道（Telegram/Discord/Slack）上：** 点击按钮即可提出对应问题。

**在纯文本渠道（Signal/WhatsApp/iMessage/SMS）上：** 回复数字 1、2 或 3。

## 建议类别

每次生成均包含 3 条建议，分属以下三类：

| 类别 | 表情符号 | 用途 |
|------|----------|------|
| **Quick（快速）** | ⚡ | 澄清疑问、定义术语、明确下一步操作 |
| **Deep Dive（深度探索）** | 🧠 | 技术细节、进阶概念、全面深入探讨 |
| **Related（相关延伸）** | 🔗 | 关联主题、更广背景、替代方案 |

## 认证方式

**默认方式：** 使用 Clawdbot 当前已有的认证信息 —— 与您当前聊天所用的登录凭证及模型一致。

**可选认证提供方：**  
- `openrouter` — 需配置 `OPENROUTER_API_KEY`  
- `anthropic` — 需配置 `ANTHROPIC_API_KEY`  

## 配置项

```json
{
  "skills": {
    "smart-followups": {
      "enabled": true,
      "provider": "clawdbot",
      "model": null
    }
  }
}
```

| 选项 | 默认值 | 描述 |
|------|--------|------|
| `provider` | `"clawdbot"` | 认证提供方：`clawdbot`、`openrouter` 或 `anthropic` |
| `model` | `null` | 模型覆盖设置（设为 null 表示继承当前会话所用模型） |
| `apiKey` | — | 非 Clawdbot 提供方所需的 API 密钥 |

## 渠道支持

| 渠道 | 模式 | 交互方式 |
|------|------|----------|
| Telegram | 按钮 | 点击按钮提问 |
| Discord | 按钮 | 点击按钮提问 |
| Slack | 按钮 | 点击按钮提问 |
| Signal | 文本 | 回复 1–3 |
| WhatsApp | 文本 | 回复 1–3 |
| iMessage | 文本 | 回复 1–3 |
| SMS | 文本 | 回复 1–3 |
| Matrix | 文本 | 回复 1–3 |
| Email | 文本 | 回复对应数字 |

详细渠道说明请参阅 [CHANNELS.md](CHANNELS.md)。

## 工作原理

1. 用户输入 `/followups`  
2. 处理器捕获最近的对话上下文  
3. Clawdbot 利用当前模型与认证信息生成 3 个上下文相关的提问  
4. 根据渠道类型将结果格式化为按钮或纯文本  
5. 用户点击按钮或回复数字进行选择  
6. Clawdbot 针对该问题给出回答  

## 相关文件

| 文件 | 用途 |
|------|------|
| `handler.js` | 命令处理器及渠道适配逻辑 |
| `cli/followups-cli.js` | 独立运行的命令行工具，用于测试与脚本调用 |
| `README.md` | 完整文档说明 |
| `CHANNELS.md` | 各渠道专属使用指南 |
| `FAQ.md` | 常见问题解答 |

## 致谢

本功能灵感源自 [Chameleon AI Chat](https://github.com/robbyczgw-cla/Chameleon-AI-Chat) 的智能后续问题特性。