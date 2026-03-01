---
name: beeper-api-cli
name_zh: Beeper API CLI
description: 通过 Beeper CLI 读取和发送消息。支持 WhatsApp、Telegram、Signal、Instagram、Twitter/X、LinkedIn、Facebook Messenger 等多种平台。
description_zh: 通过 Beeper CLI 读取和发送消息。支持 WhatsApp、Telegram、Signal、Instagram、Twitter/X、LinkedIn、Facebook Messenger 等多种平台。
metadata: {"clawdbot":{"emoji":"💬","os":["darwin","linux"]}}
---
# beeper-api-cli

面向大语言模型（LLM）优化的 Beeper CLI 封装器，支持跨所有已连接聊天网络读取与发送消息。

## ⚠️ 重要警告：消息发送策略

**🚨 未经用户明确授权，严禁发送任何消息 🚨**

**所有消息交互必须严格遵守以下强制协议：**
1. **必须首先完整展示待发消息草稿**——显示全部内容  
2. **必须等待用户明确的口头确认**——例如“发送它”、“看起来不错”、“可以发送”等  
3. **绝不假设用户已授权发送**——即使用户仅说“帮我起草一条消息”，也不代表允许发送  
4. **适用于所有平台**：WhatsApp、Telegram、Signal、Instagram、Twitter、Facebook、LinkedIn 等  
5. **绝不例外**——该规则适用于新消息、回复及转发等全部场景  

此规则为**不可协商的硬性要求**，适用于所有 beeper 发送类命令。

## 快速开始

### 步骤 1：从 Beeper 桌面版获取您的 Token
```
1. Open Beeper Desktop
2. Settings → Advanced → API
3. Enable API access
4. Copy the Bearer token
```

### 步骤 2：设置环境变量
```bash
# REQUIRED: Set your token
export BEEPER_TOKEN="paste-your-token-here"

# OPTIONAL: Override default localhost URL
export BEEPER_API_URL="http://[::1]:23373"  # Default
```

### 步骤 3：使用 CLI
```bash
# Use the skill wrapper (recommended)
~/clawd/skills/beeper-api-cli/beeper.sh chats list --output json

# Or use the binary directly
/Users/ashrafali/clawd/beeper-api-cli/beeper chats list --output json
```

**⚠️ 重要提示：** 若未设置 `BEEPER_TOKEN`，所有命令均将返回 “Unauthorized”（未授权）错误。

## 前置条件

### 1. Beeper 桌面版必须正在运行  
CLI 通过本地 API 服务器连接 Beeper 桌面版。

### 2. 必须在 Beeper 桌面版中启用 API 访问  
**⚠️ 必需：您必须先在 Beeper 桌面版中配置 API Token！**

1. 打开 **Beeper 桌面版**  
2. 进入 **设置 → 高级 → API**  
3. **启用 API 访问**  
4. **生成并复制 Bearer Token**  
5. （可选）配置允许访问的 IP 地址  
   - 默认仅允许 `localhost`（127.0.0.1 / ::1）  
   - 若从远程机器运行 CLI，请在 Beeper 设置中添加该机器的 IP 地址  

### 3. 设置环境变量  
必须在 CLI 运行前完成 Token 设置：

```bash
# REQUIRED: Set your token from Beeper Desktop
export BEEPER_TOKEN="your-token-from-beeper-settings"

# OPTIONAL: Override API URL (default: http://[::1]:23373)
export BEEPER_API_URL="http://[::1]:23373"
```

**如何获取 Token：**  
- Beeper 桌面版 → 设置 → 高级 → API → 复制 Bearer Token  

**重要说明：**  
- ❌ 若未设置 `BEEPER_TOKEN`，CLI 将**无法工作**  
- ⚠️ 默认 API 地址为 `localhost`（`http://[::1]:23373`）  
- 🔒 若从其他机器访问，您必须：  
  1. 在 Beeper 桌面版 API 设置中添加该机器的 IP 地址  
  2. 更新 `BEEPER_API_URL`，使其指向正确的主机 IP  

## 命令

### 列出全部聊天会话

```bash
# JSON output (LLM-friendly)
~/clawd/skills/beeper-api-cli/beeper.sh chats list --output json

# Human-readable text
~/clawd/skills/beeper-api-cli/beeper.sh chats list --output text

# Markdown format
~/clawd/skills/beeper-api-cli/beeper.sh chats list --output markdown
```

**示例 JSON 输出：**  
```json
[
  {
    "id": "!wcn4YMCOtKUEtxYXYAq1:beeper.local",
    "title": "beeper-api-cli - Lion Bot",
    "type": "group",
    "network": "Telegram",
    "unreadCount": 15
  }
]
```

### 获取指定聊天会话

```bash
~/clawd/skills/beeper-api-cli/beeper.sh chats get <chat-id> --output json
```

### 列出某聊天会话中的消息

```bash
# Get last 50 messages (default)
~/clawd/skills/beeper-api-cli/beeper.sh messages list --chat-id <chat-id>

# Get specific number of messages
~/clawd/skills/beeper-api-cli/beeper.sh messages list --chat-id <chat-id> --limit 20 --output json
```

**示例 JSON 输出：**  
```json
[
  {
    "id": "42113",
    "chatID": "!wcn4YMCOtKUEtxYXYAq1:beeper.local",
    "senderName": "ClawdBot",
    "text": "Hello world!",
    "timestamp": "2026-01-19T22:17:38.000Z",
    "isSender": true
  }
]
```

### 发送消息

```bash
# ⚠️ REQUIRES USER APPROVAL FIRST - see Message Sending Policy above
~/clawd/skills/beeper-api-cli/beeper.sh send --chat-id <chat-id> --message "Your message here"
```

**示例输出：**  
```json
{
  "success": true,
  "message_id": "msg_123",
  "chat_id": "!wcn4YMCOtKUEtxYXYAq1:beeper.local"
}
```

### 搜索消息

```bash
# Search across all chats
~/clawd/skills/beeper-api-cli/beeper.sh search --query "keyword" --limit 10 --output json
```

### 自动发现 API 地址

```bash
~/clawd/skills/beeper-api-cli/beeper.sh discover
```

## LLM 工作流

### 查找聊天会话并发送消息

```bash
# 1. List chats to find the right one
CHATS=$(~/clawd/skills/beeper-api-cli/beeper.sh chats list --output json)

# 2. Extract chat ID (using jq)
CHAT_ID=$(echo "$CHATS" | jq -r '.[] | select(.title | contains("Project")) | .id')

# 3. Send message
~/clawd/skills/beeper-api-cli/beeper.sh send --chat-id "$CHAT_ID" --message "Update ready!"
```

### 获取对话上下文

```bash
# Get recent messages for context
~/clawd/skills/beeper-api-cli/beeper.sh messages list --chat-id <chat-id> --limit 20 --output json | jq
```

### 监控未读消息

```bash
# Get all chats with unread count
~/clawd/skills/beeper-api-cli/beeper.sh chats list --output json | jq '.[] | select(.unreadCount > 0) | {title, network, unread: .unreadCount}'
```

## 输出格式

### JSON（默认格式 —— 面向 LLM 优化）
- 结构化数据，可直接解析  
- 专为程序化调用设计  
- 可通过管道传给 `jq` 进行过滤  

### 文本（人类可读格式）
```
ID: !wcn4YMCOtKUEtxYXYAq1:beeper.local
Title: beeper-api-cli - Lion Bot
Type: group
Network: Telegram
Unread: 15
```

### Markdown（文档格式）
```markdown
## beeper-api-cli - Lion Bot

- **ID**: !wcn4YMCOtKUEtxYXYAq1:beeper.local
- **Type**: group
- **Network**: Telegram
- **Unread**: 15
```

## 聊天 ID 格式

不同平台采用不同 ID 格式：

- **Telegram**：`!wcn4YMCOtKUEtxYXYAq1:beeper.local`  
- **WhatsApp**：电话号码格式（例如 `15551234567@s.whatsapp.net`）  
- **Signal**：电话号码（例如 `+15551234567`）  
- **Instagram/Twitter**：平台专属 ID  

使用 `chats list` 可查询您各聊天会话的确切 ID 格式。

## 环境变量

### 必需配置

**使用 CLI 前，您必须设置以下环境变量：**

#### BEEPER_TOKEN（必需）
```bash
export BEEPER_TOKEN="your-bearer-token-from-beeper-desktop"
```

**如何获取您的 Token：**  
1. 打开 Beeper 桌面版  
2. 设置 → 高级 → API  
3. 启用 API 访问  
4. **复制设置中显示的 Bearer Token**  
5. 将其设为环境变量  

**若未设置此 Token，CLI 将返回 “Unauthorized” 错误。**

#### BEEPER_API_URL（可选）
```bash
export BEEPER_API_URL="http://[::1]:23373"  # Default value
```

**默认行为：**  
- 使用 `http://[::1]:23373`（IPv6 本地回环地址）  
- 仅当 CLI 与 Beeper 桌面版运行在同一台机器上时有效  

**何时需要修改：**  
- 从**远程机器**运行 CLI  
- Beeper 桌面版运行于其他主机  
- 使用了自定义端口  

**若远程运行：**  
1. 获取运行 Beeper 桌面版的机器 IP 地址  
2. 在 Beeper 桌面版 → 设置 → 高级 → API → 将远程机器 IP 添加至允许列表  
3. 将 `BEEPER_API_URL` 设为：`http://<beeper-host-ip>:23373`  

远程访问示例：  
```bash
export BEEPER_API_URL="http://192.168.1.100:23373"
export BEEPER_TOKEN="your-token-here"
```

### Skill 封装器行为

skill 封装器（`beeper.sh`）将：  
- ✅ 使用环境变量中的 `$BEEPER_TOKEN`（您必须自行设置！）  
- ✅ 若未设置 `$BEEPER_API_URL`，则默认为 `http://[::1]:23373`  
- ❌ 若 `BEEPER_TOKEN` 未设置，则**报错退出**  

## 故障排查

### “Connection refused”（连接被拒绝）  
```bash
# Check if Beeper Desktop is running
ps aux | grep -i beeper

# Start Beeper Desktop
open -a "Beeper Desktop"  # macOS
```

### “Unauthorized”（未授权）或 “Invalid or missing token”（Token 无效或缺失）  

**这表示您尚未设置 BEEPER_TOKEN，或所设 Token 无效。**  

**解决方法：**  
```bash
# 1. Check if token is set
echo $BEEPER_TOKEN

# If empty or wrong, get a new token from Beeper Desktop:
# - Open Beeper Desktop
# - Settings → Advanced → API
# - Enable API if not already enabled
# - Copy the Bearer token shown
# - Set it in your environment:

export BEEPER_TOKEN="paste-the-token-here"

# Test it works:
~/clawd/skills/beeper-api-cli/beeper.sh chats list
```  

**重要说明：**  
- Token 在 **Beeper 桌面版设置中生成**，而非本 CLI 中  
- 您**必须精确复制**设置 → 高级 → API 中显示的 Token  
- 若无有效 Token，**所有命令均无法执行**  
- Token 不会过期，除非您在 Beeper 设置中主动重新生成  

### “Chat not found”（未找到聊天会话）  
```bash
# List all chats to find correct ID
~/clawd/skills/beeper-api-cli/beeper.sh chats list --output text | grep -i "search-term"
```

### 远程访问（CLI 与 Beeper 桌面版运行于不同机器）

**若您希望从另一台计算机运行 CLI：**  

**1. 配置 Beeper 桌面版以允许远程访问：**  
```
- Open Beeper Desktop (on the machine running Beeper)
- Settings → Advanced → API
- Find the "Allowed IP Addresses" section
- Add the IP address of the machine running the CLI
- Example: 192.168.1.50
```  

**2. 将 BEEPER_API_URL 设置为指向远程机器：**  
```bash
# On the machine running the CLI:
export BEEPER_API_URL="http://<beeper-desktop-ip>:23373"
export BEEPER_TOKEN="your-token"

# Example:
export BEEPER_API_URL="http://192.168.1.100:23373"
```  

**默认行为（仅限本地）：**  
- 默认 URL：`http://[::1]:23373`（IPv6 本地回环地址）  
- 仅当 CLI 与 Beeper 桌面版运行于**同一台机器**时有效  
- **除非在 Beeper 设置中配置允许的 IP 地址，否则不支持远程访问**  

## 示例

### 示例 1：检查未读消息  
```bash
#!/bin/bash
BEEPER="$HOME/clawd/skills/beeper-api-cli/beeper.sh"

# Get chats with unread messages
$BEEPER chats list --output json | \
  jq -r '.[] | select(.unreadCount > 0) | "\(.title) (\(.network)): \(.unreadCount) unread"'
```  

### 示例 2：读取最近消息  
```bash
#!/bin/bash
BEEPER="$HOME/clawd/skills/beeper-api-cli/beeper.sh"
CHAT_ID="!wcn4YMCOtKUEtxYXYAq1:beeper.local"

# Get last 10 messages in readable format
$BEEPER messages list --chat-id "$CHAT_ID" --limit 10 --output text
```  

### 示例 3：搜索并回复  
```bash
#!/bin/bash
BEEPER="$HOME/clawd/skills/beeper-api-cli/beeper.sh"

# Search for mentions
RESULTS=$($BEEPER search --query "@clawdbot" --limit 5 --output json)

# Process results and respond (LLM integration point)
echo "$RESULTS" | jq
```  

## 与 Clawdbot 集成

当通过 Clawdbot 工具调用时，环境变量已预先配置：

```bash
# Direct usage from exec tool
~/clawd/skills/beeper-api-cli/beeper.sh chats list --output json
```  

skill 封装器负责：  
- ✅ 自动配置 `BEEPER_API_URL` 和 `BEEPER_TOKEN`  
- ✅ 检查必需环境变量是否存在  
- ✅ 干净透传所有 CLI 参数  

## 二进制文件位置

- **Skill 封装器**：`~/clawd/skills/beeper-api-cli/beeper.sh`  
- **Beeper CLI 二进制文件**：`/Users/ashrafali/clawd/beeper-api-cli/beeper`  
- **源代码**：https://github.com/nerveband/beeper-api-cli  

## 功能特性

✅ 支持只读与写入操作（区别于其他工具）  
✅ 面向 LLM 优化的 JSON 输出  
✅ 人类可读的文本与 Markdown 格式  
✅ 自动发现 Beeper 桌面版 API  
✅ 跨平台二进制文件（macOS、Linux、Windows）  
✅ 环境变量配置方式  
✅ 全面的错误提示信息  
✅ 兼容 Unix 管道  

## 注意事项

- 本 skill 要求 Beeper 桌面版处于运行状态  
- 必须在 Beeper 桌面版设置中启用 API 访问  
- Token 已存储于 Clawdbot 配置中（已预先配置）  
- 所有已接入 Beeper 的平台均可访问（WhatsApp、Telegram、Signal 等）  
- 对 LLM 处理请使用 JSON 输出，对人工阅读请使用文本格式  

## 版本

最新版（基于源码的开发构建）