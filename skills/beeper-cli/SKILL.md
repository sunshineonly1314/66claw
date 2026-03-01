---
name: beeper-cli
name_zh: Beeper CLI
description: 通过 beeper-cli 搜索聊天、列出/读取消息，并经由 Beeper 桌面版发送消息。
description_zh: 通过 beeper-cli 搜索聊天、列出/读取消息，并经由 Beeper 桌面版发送消息。
metadata: {"clawdbot":{"requires":{"bins":["beeper"]}}}
---
# beeper

当您需要通过 **Beeper 桌面版** 搜索聊天、列出/读取消息或发送消息时，请使用本 skill。

## 本 skill 是什么  
这是围绕 Beeper 桌面版 API 构建的 CLI 封装器。无需 MCP，无需 curl —— 仅需 `beeper` 命令即可。

需依赖 [beeper-cli](https://github.com/foeken/beeper-cli)。

## 前置条件  
- Beeper 桌面版正在运行，且已启用 API：设置 > 开发者  
- 已安装 [beeper-cli](https://github.com/foeken/beeper-cli)  
- 已设置环境变量：`BEEPER_ACCESS_TOKEN`（从 Beeper 桌面版：设置 > 开发者 > API 访问令牌中获取）

## 安装 beeper-cli  

从 [发布页](https://github.com/foeken/beeper-cli/releases) 下载，或自行构建：

```bash
go install github.com/foeken/beeper-cli@latest
```

## 命令

### 账户  
```bash
beeper accounts list
beeper accounts list -o table
```  

### 聊天  
```bash
# List all chats (sorted by last activity)
beeper chats list

# Search chats
beeper chats search --query "John"
beeper chats search --query "project" --type group

# Get specific chat
beeper chats get "<chatID>"

# Archive
beeper chats archive "<chatID>"

# Create
beeper chats create --account-id "telegram:123" --participant "user1" --type dm

# Reminders
beeper chats reminders create "<chatID>" --time "2025-01-26T10:00:00Z"
beeper chats reminders delete "<chatID>"
```  

### 消息  
```bash
# List messages in a chat
beeper messages list "<chatID>"

# Search messages
beeper messages search --query "dinner"
beeper messages search --query "dinner" --limit 10
beeper messages search --query "meeting" --sender me
beeper messages search --query "budget" --after "2025-01-01T00:00:00Z"
beeper messages search --chat-ids "<chatID>" --media-type image

# Send a message
beeper messages send "<chatID>" "Hello!"

# Send with reply
beeper messages send "<chatID>" "Thanks!" --reply-to "<messageID>"

# Edit a message
beeper messages edit "<chatID>" "<messageID>" "Corrected text"
```  

### 资源（附件）  
```bash
# Upload a file
beeper assets upload /path/to/image.png

# Download an asset
beeper assets download "mxc://beeper.local/abc123" --output /path/to/save.jpg

# Send with attachment (upload first)
beeper assets upload /path/to/photo.jpg  # returns uploadID
beeper messages send "<chatID>" "Check this!" --upload-id "<uploadID>"
```  

### 其他  
```bash
# Focus Beeper window
beeper focus
beeper focus --chat-id "<chatID>"

# Global search
beeper search "important"
```  

## 输出格式  
```bash
beeper chats list -o json   # default
beeper chats list -o table  # human-readable
```  

## 工作流  
1. 查找聊天会话：`beeper chats search --query "Name"`  
2. 读取消息：`beeper messages list "<chatID>"`  
3. 搜索内容：`beeper messages search --query "phrase"`  
4. 发送消息：`beeper messages send "<chatID>" "message"`  

## 安全须知  
- 请将 `BEEPER_ACCESS_TOKEN` 安全存储（例如存入密码管理器）  
- 引用消息时，仅包含必要内容  
- 除非用户明确指示，否则发送前务必确认消息正文  