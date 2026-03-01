---
name: claw-me-maybe
name_zh: Claw待定
version: 1.2.0
description: Clawdbot 的 Beeper 集成。通过 Beeper Desktop API，在 WhatsApp、Telegram、Signal、Discord、Slack、Instagram、iMessage、LinkedIn、Facebook Messenger、Google Messages 等平台发送消息及搜索聊天记录。支持消息反应（reactions）、提醒（reminders）、附件（attachments）和标记为已读（mark as read）。统一的多平台消息自动化——只需开口询问即可。
description_zh: Clawdbot 的 Beeper 集成。通过 Beeper Desktop API，在 WhatsApp、Telegram、Signal、Discord、Slack、Instagram、iMessage、LinkedIn、Facebook Messenger、Google Messages 等平台发送消息及搜索聊天记录。支持消息反应（reactions）、提醒（reminders）、附件（attachments）和标记为已读（mark as read）。统一的多平台消息自动化——只需开口询问即可。
author: nickhamze
keywords: Beeper, 消息传递, WhatsApp, Telegram, Signal, Discord, Slack, Instagram, iMessage, LinkedIn, Facebook Messenger, Google Messages, Google Chat, 聊天自动化, 统一消息, Desktop API, 发送消息, 搜索消息, 反应, 提醒, 多平台, 跨平台消息, 聊天搜索, 消息历史, 未读消息
metadata: {"clawdbot":{"emoji":"📟","skillKey":"claw-me-maybe","requires":{"bins":["curl"]},"homepage":"https://www.beeper.com","defaultEnv":{"BEEPER_API_URL":"http://localhost:23373"}}}
user-invocable: true
---
# Claw Me Maybe — Beeper Desktop API 与多平台消息 📟

**你的龙虾刚刚配上了 Beeper。**

终于，你的 Clawdbot 可以跨越 *所有* 聊天平台触达你（以及所有人）。WhatsApp？Telegram？Signal？Discord？Slack？Instagram 私信？LinkedIn？iMessage？**全部支持。一个 skill，一只龙虾。**

由 [Beeper](https://www.beeper.com) 应用提供支持——该应用可统一管理你所有的聊天。

## 你的龙虾借助 Beeper 能做什么？

🔍 **全局搜索** —— “Sarah 上周关于这个项目说了什么？” 你的龙虾将即时遍历你全部 Beeper 聊天记录。

💬 **任意平台发送消息** —— “告诉妈妈我晚点到” → 消息发至 WhatsApp；“在 Slack 上通知团队” → 即刻完成。无需切换应用。

📊 **收件箱摘要** —— “我漏掉了什么？” 获取你在所有 Beeper 网络中未读消息的汇总。

🔔 **设置提醒** —— “明天提醒我回复这条聊天” → 你的龙虾替你记住，你无需操心。

📎 **获取附件** —— 下载任意 Beeper 对话中的文件、图片及媒体内容。

😀 **对消息添加反应（reactions）** —— 在任意 Beeper 网络的任意消息上添加 emoji 反应。

✅ **标记为已读** —— 将对话标记为已读，保持你的 Beeper 收件箱整洁。

## 支持的 Beeper 网络

你的 Clawdbot 可在 **Beeper 所支持的任意平台** 上触达你：

| 平台 | 状态 |
|----------|--------|
| WhatsApp | ✅ 全功能支持 |
| Telegram | ✅ 全功能支持 |
| Signal | ✅ 全功能支持 |
| Discord | ✅ 全功能支持 |
| Slack | ✅ 全功能支持 |
| Instagram 私信 | ✅ 全功能支持 |
| Facebook Messenger | ✅ 全功能支持 |
| LinkedIn 消息 | ✅ 全功能支持 |
| X（Twitter）私信 | ✅ 全功能支持 |
| Google Messages | ✅ 全功能支持 |
| Google Chat | ✅ 全功能支持 |
| iMessage | ✅ 仅限 macOS |

**一个 skill，十二个平台，无限可能。**

## 快速入门

### 1. 获取 Beeper

尚未安装 Beeper？[免费下载](https://www.beeper.com/download) —— 这是一款将你所有聊天整合在一起的应用。

### 2. 启用 Beeper Desktop API

打开 Beeper Desktop → **设置** → **开发者** → 开启 **“Beeper Desktop API”** 开关

完成！你的龙虾现在已直连你全部聊天。

### 3. （可选）添加你的 Beeper Token

为实现更顺畅的自动化，请获取访问令牌（access token）：

1. Beeper Desktop → 设置 → 开发者  
2. 点击“创建访问令牌”  
3. 将其添加至 `~/.clawdbot/clawdbot.json`：

```json
{
  "skills": {
    "entries": {
      "claw-me-maybe": {
        "enabled": true,
        "env": {
          "BEEPER_ACCESS_TOKEN": "your-token-here"
        }
      }
    }
  }
}
```

注意：`BEEPER_API_URL` 默认为 `http://localhost:23373` —— 除非你在不同端口运行 Beeper，否则无需另行设置。

## 与你的龙虾对话

配置完成后，只需自然提问：

> "Show me my unread messages in Beeper"
> "Search my Beeper chats for messages about dinner plans"
> "Send a WhatsApp message to John saying I'm on my way"
> "What's the latest in my Signal group chat?"
> "Message the #general channel on Slack: standup in 5 minutes"
> "Find all messages from Lisa in the last week"
> "React with 👍 to that last message"
> "Mark my Discord chats as read"

你的龙虾将通过 Beeper 自动处理其余全部操作。

## 技术细节

*（面向喜欢探查底层实现的用户）*

### Beeper API 基础

基础 URL：`http://localhost:23373`（Beeper Desktop 必须处于运行状态）

```bash
# Auth header (when using a token)
-H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}"
```

### 账户（Accounts）

#### 列出你的 Beeper 账户

查看你在 Beeper 中已连接的所有平台：

```bash
curl -s "${BEEPER_API_URL}/v1/accounts" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}"
```

**示例响应：**  
```json
[
  {
    "id": "whatsapp-abc123",
    "service": "whatsapp",
    "displayName": "+1 555-123-4567",
    "connected": true
  },
  {
    "id": "telegram-xyz789",
    "service": "telegram",
    "displayName": "@myusername",
    "connected": true
  },
  {
    "id": "signal-def456",
    "service": "signal",
    "displayName": "+1 555-987-6543",
    "connected": true
  }
]
```

### 聊天（Chats）

#### 列出全部 Beeper 聊天

```bash
curl -s "${BEEPER_API_URL}/v1/chats" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}"
```

**示例响应：**  
```json
[
  {
    "id": "chat-abc123",
    "name": "Family Group",
    "service": "whatsapp",
    "unreadCount": 5,
    "lastMessage": {
      "text": "See you at dinner!",
      "timestamp": "2026-01-23T15:30:00Z"
    }
  },
  {
    "id": "chat-xyz789",
    "name": "Work Team",
    "service": "slack",
    "unreadCount": 0,
    "lastMessage": {
      "text": "Meeting moved to 3pm",
      "timestamp": "2026-01-23T14:00:00Z"
    }
  }
]
```

#### 搜索 Beeper 聊天

```bash
curl -s "${BEEPER_API_URL}/v1/chats/search?q=project+meeting" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}"
```

#### 获取聊天详情

```bash
curl -s "${BEEPER_API_URL}/v1/chats/{chatID}" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}"
```

**示例响应：**  
```json
{
  "id": "chat-abc123",
  "name": "Family Group",
  "service": "whatsapp",
  "unreadCount": 5,
  "participants": [
    {"id": "user-1", "name": "Mom", "phone": "+15551234567"},
    {"id": "user-2", "name": "Dad", "phone": "+15559876543"},
    {"id": "user-3", "name": "You", "phone": "+15555555555"}
  ],
  "archived": false,
  "muted": false
}
```

#### 创建新的 Beeper 聊天

```bash
curl -X POST "${BEEPER_API_URL}/v1/chats" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "accountID": "whatsapp-abc123",
    "participants": ["+1234567890"]
  }'
```

#### 归档/取消归档聊天

```bash
curl -X POST "${BEEPER_API_URL}/v1/chats/{chatID}/archive" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"archived": true}'
```

### 消息（Messages）

#### 列出某聊天中的消息

```bash
curl -s "${BEEPER_API_URL}/v1/chats/{chatID}/messages" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}"
```

**示例响应：**  
```json
[
  {
    "id": "msg-001",
    "chatID": "chat-abc123",
    "sender": {"id": "user-1", "name": "Mom"},
    "text": "Don't forget to call grandma!",
    "timestamp": "2026-01-23T15:30:00Z",
    "reactions": [
      {"emoji": "👍", "user": {"id": "user-2", "name": "Dad"}}
    ]
  },
  {
    "id": "msg-002",
    "chatID": "chat-abc123",
    "sender": {"id": "user-2", "name": "Dad"},
    "text": "See you at dinner!",
    "timestamp": "2026-01-23T15:25:00Z",
    "reactions": []
  }
]
```

#### 在全部 Beeper 网络中搜索消息

```bash
curl -s "${BEEPER_API_URL}/v1/messages/search?q=dinner+plans" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}"
```

**示例响应：**  
```json
{
  "results": [
    {
      "id": "msg-xyz",
      "chatID": "chat-abc123",
      "chatName": "Family Group",
      "service": "whatsapp",
      "text": "What are the dinner plans for tonight?",
      "sender": {"name": "Mom"},
      "timestamp": "2026-01-23T12:00:00Z"
    }
  ],
  "total": 1
}
```

#### 通过 Beeper 发送消息

```bash
curl -X POST "${BEEPER_API_URL}/v1/chats/{chatID}/messages" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from my lobster! 🦞"}'
```

**示例响应：**  
```json
{
  "id": "msg-new123",
  "chatID": "chat-abc123",
  "text": "Hello from my lobster! 🦞",
  "timestamp": "2026-01-23T16:00:00Z",
  "status": "sent"
}
```

#### 回复某条消息

```bash
curl -X POST "${BEEPER_API_URL}/v1/chats/{chatID}/messages" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Sounds good!",
    "replyTo": "msg-001"
  }'
```

#### 将消息标记为已读

```bash
curl -X POST "${BEEPER_API_URL}/v1/chats/{chatID}/read" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"upToMessageID": "msg-001"}'
```

### 反应（Reactions）

#### 为消息添加反应（reaction）

```bash
curl -X POST "${BEEPER_API_URL}/v1/chats/{chatID}/messages/{messageID}/reactions" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"emoji": "👍"}'
```

#### 移除反应（reaction）

```bash
curl -X DELETE "${BEEPER_API_URL}/v1/chats/{chatID}/messages/{messageID}/reactions" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"emoji": "👍"}'
```

### 联系人（Contacts）

#### 在某账户中搜索联系人

```bash
curl -s "${BEEPER_API_URL}/v1/accounts/{accountID}/contacts?q=john" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}"
```

**示例响应：**  
```json
[
  {
    "id": "contact-123",
    "name": "John Smith",
    "phone": "+15551234567",
    "avatar": "https://..."
  },
  {
    "id": "contact-456",
    "name": "Johnny Appleseed",
    "phone": "+15559876543",
    "avatar": "https://..."
  }
]
```

### 提醒（Reminders）

#### 创建聊天提醒（chat reminder）

为某聊天设置提醒：

```bash
curl -X POST "${BEEPER_API_URL}/v1/chats/{chatID}/reminders" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"remindAt": "2026-01-25T10:00:00Z"}'
```

#### 删除聊天提醒（chat reminder）

```bash
curl -X DELETE "${BEEPER_API_URL}/v1/chats/{chatID}/reminders" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}"
```

### 资源（Assets）

#### 下载消息附件

```bash
curl -X POST "${BEEPER_API_URL}/v1/assets/download" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"assetID": "asset-id-here"}' \
  --output attachment.file
```

## 进阶技巧 🦞

### 从 Beeper 获取未读消息摘要

```bash
curl -s "${BEEPER_API_URL}/v1/chats?unreadOnly=true" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}" | \
  jq '.[] | "[\(.service)] \(.name): \(.unreadCount) unread"'
```

**示例输出：**  
```
[whatsapp] Family Group: 5 unread
[slack] Work Team: 12 unread
[signal] Best Friend: 2 unread
```

### 在 Beeper 中查找 WhatsApp 聊天

```bash
# Get your WhatsApp account ID from Beeper
WHATSAPP=$(curl -s "${BEEPER_API_URL}/v1/accounts" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}" | \
  jq -r '.[] | select(.service == "whatsapp") | .id')

# Search for a contact
curl -s "${BEEPER_API_URL}/v1/chats/search?q=Mom" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}"
```

### 将全部聊天标记为已读

```bash
for chatID in $(curl -s "${BEEPER_API_URL}/v1/chats?unreadOnly=true" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}" | jq -r '.[].id'); do
  curl -X POST "${BEEPER_API_URL}/v1/chats/${chatID}/read" \
    -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}"
  echo "Marked ${chatID} as read"
done
```

### 快速对最后一条消息添加反应（reaction）

```bash
# Get the last message ID from a chat
LAST_MSG=$(curl -s "${BEEPER_API_URL}/v1/chats/{chatID}/messages?limit=1" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}" | jq -r '.[0].id')

# React with thumbs up
curl -X POST "${BEEPER_API_URL}/v1/chats/{chatID}/messages/${LAST_MSG}/reactions" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"emoji": "👍"}'
```

### 检查 Beeper 是否就绪

```bash
curl -s --connect-timeout 2 "${BEEPER_API_URL:-http://localhost:23373}/health" && echo "Beeper is ready!"
```

### 获取过去 24 小时内的消息

```bash
YESTERDAY=$(date -u -v-1d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "1 day ago" +"%Y-%m-%dT%H:%M:%SZ")

curl -s "${BEEPER_API_URL}/v1/messages/search?after=${YESTERDAY}" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}"
```

### 按服务（service）筛选聊天

```bash
# Get only Signal chats
curl -s "${BEEPER_API_URL}/v1/chats" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}" | \
  jq '[.[] | select(.service == "signal")]'

# Get only Slack chats
curl -s "${BEEPER_API_URL}/v1/chats" \
  -H "Authorization: Bearer ${BEEPER_ACCESS_TOKEN}" | \
  jq '[.[] | select(.service == "slack")]'
```

## 注意事项

**Beeper Desktop 必须正在运行** —— 该 API 内置于 Beeper Desktop 中。无 Beeper = 无连接。

**本地化且私密** —— Beeper API 完全在你的设备上运行。你的消息绝不会经由本 skill 触达外部服务器。

**尊重各平台规则** —— 本工具仅限个人使用。发送过多消息可能触发 WhatsApp 等平台的速率限制。

**iMessage 仅支持 macOS** —— Apple 就是 Apple。

**各平台对 reaction 的支持程度不同** —— 并非所有平台均支持全部 emoji。Beeper 将负责适配转换。

## 故障排除

### “无法连接到 Beeper”

1. Beeper Desktop 是否正在运行？请检查菜单栏中是否存在其图标。  
2. API 是否已启用？Beeper → 设置 → 开发者 → Beeper Desktop API  
3. 检查端口：`curl http://localhost:23373/health`

### “身份验证失败”

1. 在 Beeper → 设置 → 开发者中生成一个新的令牌（token）  
2. 确保该令牌已正确填入配置（注意：不要有多余空格！）  
3. 或直接删除令牌 —— Beeper 将提示你进行 OAuth 授权

### “未找到聊天”

1. 确认该聊天确实存在于你的 Beeper 应用中  
2. 尝试使用不同的搜索关键词  
3. 检查对应账户（如 WhatsApp、Telegram 等）是否已在 Beeper 中成功连接

### “不支持该 reaction”

部分平台对 emoji 的支持有限。请尝试使用更通用的 emoji，例如 👍 ❤️ 😂 😮 😢 😡

## 相关链接

- [获取 Beeper](https://www.beeper.com/download) —— 免费下载  
- [Beeper 开发者文档](https://developers.beeper.com) —— 完整 API 参考  
- [Beeper MCP](https://www.beeper.com/mcp) —— 面向 Claude Desktop 与 Cursor 用户  
- [Beeper Desktop API 参考文档](https://developers.beeper.com/desktop-api-reference/) —— 完整端点说明  

## 致谢

由 @nickhamze 与 Clawdbot 社区以 🦞 精心打造。

由 [Beeper](https://www.beeper.com) 提供支持 —— 一款应用，统管全部聊天。

*Claw Me Maybe —— 因为你的龙虾理应能在任何地方触达你。*