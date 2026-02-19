---
name: wechat-cs
description: "WeChat smart customer service bot with anti-detection. Uses local Ollama qwen2.5vl:7b for screenshot recognition and Kimi Code API for reply generation. Supports rate limiting, quiet hours, blacklist filtering, and typing delay simulation."
nameZh: "微信智能客服"
descriptionZh: "微信智能客服机器人：本地Ollama视觉模型识别消息截图 + Kimi Code API生成回复，内置防检测机制（限流、静默时段、黑名单、打字延迟模拟）。"
metadata: {"openclawcn":{"emoji":"🤖","os":["win32"],"always":false,"requires":{"env":["KIMI_API_KEY"],"local":["ollama"]}}}
---

# 微信智能客服 WeChat Smart Customer Service

自动化微信客服机器人，整合截图识别 + AI 回复 + 防检测保护。

## 架构概览

```
收到微信消息
    │
    ▼
┌─────────────────┐     ┌──────────────────────┐
│  wechat_check   │────▶│  截图 + Vision 分析  │
│  (扫描未读消息) │     │  Ollama qwen2.5vl:7b │
└─────────────────┘     └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │  防检测过滤          │
                        │  - 黑名单关键词      │
                        │  - 限流 (时/日)      │
                        │  - 夜间静默          │
                        └──────────┬───────────┘
                                   │ (允许回复)
                                   ▼
                        ┌──────────────────────┐
                        │  AI 生成回复         │
                        │  Kimi Code API       │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │  延迟发送            │
                        │  (模拟打字速度)      │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │  wechat_send         │
                        │  (发送消息)          │
                        └──────────────────────┘
```

## 环境要求

| 组件 | 用途 | 配置方式 |
|------|------|----------|
| Ollama + qwen2.5vl:7b | 截图识别提取消息 | 本地运行 `ollama serve`，自动连接 `localhost:11434` |
| Kimi Code API Key | AI 回复生成 | 环境变量 `KIMI_API_KEY` |
| 微信 PC 版 | 消息收发 | 需已登录并保持前台 |

### 环境变量

```bash
# 必填 - Kimi Code API Key
export KIMI_API_KEY="sk-kimi-xxx"

# 可选 - 自定义配置
export KIMI_API_BASE="https://api.kimi.com/coding"   # 默认值
export KIMI_MODEL="kimi-for-coding"                    # 默认值
export OLLAMA_BASE_URL="http://localhost:11434"        # 默认值
export OLLAMA_VISION_MODEL="qwen2.5vl:7b"             # 默认值
```

## 完整客服工作流

### 步骤 1: 扫描未读消息

```
wechat_check({scroll_pages: 2})
```

分析截图，找出有红色气泡/红点的联系人。

### 步骤 2: 读取消息内容

```
wechat_read({contact: "客户名", count: 5})
```

通过 Ollama qwen2.5vl:7b 视觉模型分析截图，提取最近 N 条消息（发送者、内容、时间）。

### 步骤 3: 防检测检查

在回复前需检查：
- **黑名单关键词**: 包含 "测试"、"机器人"、"bot" 等词的消息不自动回复
- **限流保护**: 默认每小时 30 条、每日 100 条
- **夜间静默**: 默认 00:00 - 07:00 不回复
- **频率控制**: 同一用户短时间内不重复回复

### 步骤 4: AI 生成回复

将消息内容发给 Kimi Code API 生成自然口语化回复。

### 步骤 5: 延迟发送

根据回复长度模拟打字延迟（约每 100 字 2 秒），避免秒回被检测。

### 步骤 6: 发送回复

```
wechat_send({contact: "客户名", message: "AI生成的回复"})
```

## 自动客服循环

完整的自动客服流程（每轮扫描一次）:

```
1. wechat_check({scroll_pages: 2})          -- 扫描未读消息
2. (分析截图，列出有未读消息的联系人)
3. 对每个有未读消息的联系人:
   a. wechat_read({contact: "联系人名", count: 3})  -- 读取最近消息
   b. (防检测检查: 黑名单 + 限流 + 时段)
   c. (如果允许回复) 调用 Kimi API 生成回复
   d. (等待打字延迟)
   e. wechat_send({contact: "联系人名", message: "回复"})
4. 等待 30-60 秒后重复步骤 1
```

## 防检测配置参考

```javascript
{
  replyDelayMin: 2,          // 最短回复延迟 (秒)
  replyDelayMax: 8,          // 最长回复延迟 (秒)
  maxRepliesPerHour: 30,     // 每小时最多回复
  maxRepliesPerDay: 100,     // 每天最多回复
  typingDelayPer100Chars: 2, // 每100字打字延迟 (秒)
  quietHours: {
    start: "00:00",          // 静默开始
    end: "07:00"             // 静默结束
  },
  blacklistKeywords: [       // 包含这些词不回复
    "测试", "test", "机器人", "bot", "自动回复"
  ]
}
```

## 安全建议

- 只用于个人助理/小规模客服场景
- 每天回复量控制在 50 条以内
- 定期检查回复质量，确保自然
- 遇到投诉、纠纷、敏感话题立即转人工
- 不要在群聊中自动回复（容易被举报）
- 设置合理的黑名单关键词过滤敏感内容

## 相关工具

| 工具 | 用途 |
|------|------|
| `wechat_send` | 发送微信消息 |
| `wechat_check` | 截图检查未读消息 |
| `wechat_read` | Vision 分析读取聊天记录 |
| `desktop_control` | 底层桌面操作 (点击/截图/输入) |

## 相关技能

- `wechat-desktop` — 基础微信操作 (发消息、查消息、读消息)
- `wecom-desktop` — 企业微信操作
