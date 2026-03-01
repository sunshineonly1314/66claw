---
name: beepctl
name_zh: beepctl
description: 通过 Beeper 桌面端 API，在终端中发送消息、搜索聊天记录或跨多个消息平台（Telegram、WhatsApp、Slack、iMessage 等）管理会话。
description_zh: 通过 Beeper 桌面端 API，在终端中发送消息、搜索聊天记录或跨多个消息平台（Telegram、WhatsApp、Slack、iMessage 等）管理会话。
homepage: https://github.com/blqke/beepctl
metadata: {"clawdbot":{"emoji":"🐝","requires":{"bins":["beepctl"]},"install":[{"id":"npm","kind":"node","package":"beepctl","global":true,"bins":["beepctl"],"label":"安装 beepctl（npm）"}]}}
---
# beepctl

[适用于 Beeper 桌面端 API](https://developers.beeper.com/desktop-api) 的命令行工具 —— 从终端统一管理所有消息平台（Telegram、WhatsApp、Slack、iMessage 等）。通过单一接口控制全部消息服务。

📖 **设置与安装：** 详见 [GitHub 仓库](https://github.com/blqke/beepctl)

## 快速开始

```bash
beepctl accounts                    # List connected accounts
beepctl chats list                  # List recent chats
beepctl chats list --search "John"  # Find a chat
beepctl search "meeting" --after "1d ago"  # Search messages
beepctl send <chat-id> "Hello!"     # Send a message
```

## 命令

### 认证管理
```bash
beepctl auth show           # Check auth status and token
beepctl auth set <token>    # Set API token
beepctl auth clear          # Clear saved token
```

### 账户
```bash
beepctl accounts            # List all connected accounts
```

### 浏览会话
```bash
beepctl chats list                        # List inbox (non-archived)
beepctl chats list --limit 20             # Limit results
beepctl chats list --search "John"        # Filter by name
beepctl chats list --inbox archive        # Archived chats only
beepctl chats list --inbox low-priority   # Low-priority chats
beepctl chats list --inbox all            # All chats
beepctl chats list --type group           # Filter by type (single/group/any)
beepctl chats list --unread-only          # Unread chats only
beepctl chats list --activity-after "1d ago"  # Recent activity filter
beepctl chats show <chat-id>              # Detailed chat info with participants
beepctl chats create <account> <users...> # Create new chat
```

**收件箱筛选器：** `primary`（默认）、`archive`、`low-priority`、`all`

### 列出消息
```bash
beepctl messages <chat-id>              # Recent messages from a chat
beepctl messages <chat-id> --limit 10   # Limit results
beepctl messages work --after "1d ago"  # Use alias + time filter
beepctl messages <chat-id> --before "1h ago"  # Messages before a time
```

### 搜索消息
```bash
beepctl search "query"                    # Search across all chats
beepctl search "query" --limit 10         # Limit results
beepctl search "meeting" --after "1d ago" # Time filter
beepctl search "hello" --chat work        # Filter by chat/alias
beepctl search "files" --media file       # Filter by media type
beepctl search "dm" --chat-type single    # Filter by chat type
beepctl search "update" --sender others   # Filter by sender (me/others)
beepctl search "msg" --account <id>       # Filter by account
beepctl search "todo" --include-low-priority   # Include low-priority chats
beepctl search "important" --exclude-muted     # Exclude muted chats
```

**组合筛选器：**  
```bash
beepctl search "deploy" --chat work --sender others --after "1d ago" --media link
beepctl search "hello" --chat work family  # Multiple chats (space-separated)
beepctl search "test" --chat id1,id2,id3   # Multiple chats (comma-separated)
```

**时间格式：** `1h ago`、`2d ago`、`3w ago`、`1mo ago`、`yesterday`、`today`  
**媒体类型：** `any`、`video`、`image`、`link`、`file`

### 别名
为常用会话 ID 创建快捷方式：

```bash
beepctl alias list                    # List all aliases
beepctl alias add work <chat-id>      # Create alias
beepctl alias show work               # Show alias value
beepctl alias remove work             # Remove alias
beepctl send work "Using alias!"      # Use alias in any command
```

### 归档会话
```bash
beepctl archive <chat-id>              # Archive a chat
beepctl archive <chat-id> --unarchive  # Unarchive
beepctl archive work                   # Use alias
beepctl archive <chat-id> --quiet      # No confirmation message
```

### 发送消息

⚠️ **切勿未经用户明确批准即发送消息！**  
务必先展示消息内容与接收方，再请求确认。

```bash
beepctl send <chat-id> "Hello!"                    # Send message
beepctl send myself "Quick note"                   # Send to self
beepctl send <chat-id> "Reply" --reply-to <msg-id> # Reply to message
beepctl send <chat-id> "msg" --quiet               # No confirmation output
```

### 聚焦（切换至前台）
```bash
beepctl focus                           # Bring Beeper to foreground
beepctl focus <chat-id>                 # Open a specific chat
beepctl focus <chat-id> -m <msg-id>     # Jump to specific message
beepctl focus <chat-id> -d "draft"      # Pre-fill draft text
beepctl focus <chat-id> -a /path/file   # Pre-fill draft attachment
```

### 发送媒体
`beepctl send` 仅支持文本。如需发送媒体，请结合聚焦与草稿功能：

```bash
beepctl focus <chat-id> -a /path/to/image.png -d "Caption"
# Then press Enter in Beeper to send
```

### 联系人
```bash
beepctl contacts search <account> <query>  # Search contacts on an account
```

### 下载附件
```bash
beepctl download <mxc-url>              # Download attachment (mxc:// URLs)
beepctl download <mxc-url> -o /path     # Save to specific path
```

### 提醒
```bash
beepctl reminders set <chat> 30m       # Remind in 30 minutes
beepctl reminders set <chat> 1h        # Remind in 1 hour
beepctl reminders set <chat> 2d        # Remind in 2 days
beepctl reminders set <chat> tomorrow  # Remind tomorrow
beepctl reminders clear <chat>         # Clear reminder
```

## 使用技巧

- 会话 ID 格式类似：`!gZ42vWzDxl8V0sZXWBgO:beeper.local`
- 使用别名避免输入冗长的会话 ID
- 特殊别名 `myself` 表示向您自己的会话发送消息