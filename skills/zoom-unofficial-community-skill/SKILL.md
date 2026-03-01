---
name: zoom-unofficial-community-skill
name_zh: Zoom社区技能
description: Zoom API 集成，支持会议、日历、聊天及用户管理。当用户要求安排会议、查看 Zoom 日历、列出录制文件、发送 Zoom 聊天消息、管理联系人，或与任何 Zoom Workplace 功能交互时使用。支持 Server-to-Server OAuth 和 OAuth 应用。
description_zh: Zoom API 集成，支持会议、日历、聊天及用户管理。当用户要求安排会议、查看 Zoom 日历、列出录制文件、发送 Zoom 聊天消息、管理联系人，或与任何 Zoom Workplace 功能交互时使用。支持 Server-to-Server OAuth 和 OAuth 应用。
---
# Zoom

使用 `scripts/zoom.py` 与 Zoom REST API 进行交互。

## 前置条件（Prerequisites）

```bash
pip3 install requests PyJWT --break-system-packages
```

## 认证（Authentication）

请在 `.env` 中设置以下环境变量：

- `ZOOM_ACCOUNT_ID` — 账户 ID（来自 Zoom Marketplace 应用）
- `ZOOM_CLIENT_ID` — OAuth 客户端 ID（OAuth Client ID）
- `ZOOM_CLIENT_SECRET` — OAuth 客户端密钥（OAuth Client Secret）
- `ZOOM_USER_EMAIL` — 作为操作主体的 Zoom 用户邮箱（Server-to-Server 应用必需；若未设置，则默认为 `me`）

请在 https://marketplace.zoom.us/ 创建一个 **Server-to-Server OAuth** 应用以获得完整的 API 访问权限。  
详细配置指南请参阅 [references/AUTH.md](references/AUTH.md)。

## 命令（Commands）

### 会议（Meetings）

```bash
# List upcoming meetings
python3 scripts/zoom.py meetings list

# Get meeting details
python3 scripts/zoom.py meetings get <meeting_id>

# Schedule a new meeting
python3 scripts/zoom.py meetings create --topic "Standup" --start "2026-01-28T10:00:00" --duration 30

# Schedule with options
python3 scripts/zoom.py meetings create --topic "Review" --start "2026-01-28T14:00:00" --duration 60 --agenda "Sprint review" --password "abc123"

# Delete a meeting
python3 scripts/zoom.py meetings delete <meeting_id>

# Update a meeting
python3 scripts/zoom.py meetings update <meeting_id> --topic "New Title" --start "2026-01-29T10:00:00"
```

### 日历（即将举行的日程）

```bash
# Today's meetings
python3 scripts/zoom.py meetings list --from today --to today

# This week's meetings
python3 scripts/zoom.py meetings list --from today --days 7
```

### 录制文件（Recordings）

```bash
# List cloud recordings
python3 scripts/zoom.py recordings list

# List recordings for date range
python3 scripts/zoom.py recordings list --from "2026-01-01" --to "2026-01-31"

# Get recording details
python3 scripts/zoom.py recordings get <meeting_id>

# Download recording files
python3 scripts/zoom.py recordings download <meeting_id>
python3 scripts/zoom.py recordings download <meeting_id> --output ~/Downloads

# Delete a recording
python3 scripts/zoom.py recordings delete <meeting_id>
```

### AI 会议摘要（AI Companion）

```bash
# List meeting summaries
python3 scripts/zoom.py summary list
python3 scripts/zoom.py summary list --from "2026-01-01" --to "2026-01-31"

# Get AI summary for a specific meeting
python3 scripts/zoom.py summary get <meeting_id>
```

### 用户（Users）

```bash
# Get my profile
python3 scripts/zoom.py users me

# List users (admin)
python3 scripts/zoom.py users list
```

### 团队聊天（Team Chat）

```bash
# List chat channels
python3 scripts/zoom.py chat channels

# List messages in a channel
python3 scripts/zoom.py chat messages <channel_id>

# Send a message to a channel
python3 scripts/zoom.py chat send <channel_id> "Hello team!"

# Send a direct message
python3 scripts/zoom.py chat dm <email> "Hey, are you free?"

# List contacts
python3 scripts/zoom.py chat contacts
```

### 电话（Zoom Phone）

```bash
# List call logs
python3 scripts/zoom.py phone calls --from "2026-01-01" --to "2026-01-31"
```

## 所需权限范围（Scopes Required）

对于 Server-to-Server OAuth，请在 Zoom Marketplace 应用中启用以下权限范围。  
仅添加实际需要的权限范围——每个命令组对应特定的权限范围：

| 命令组 | 所需权限范围（Scopes） |
|---|---|
| `users me` / `users list` | `user:read:admin` |
| `meetings list/get/create/update/delete` | `meeting:read:admin`、`meeting:write:admin` |
| `recordings list/get/delete` | `recording:read:admin`、`recording:write:admin` |
| `chat channels/messages/send/dm` | `chat_channel:read:admin`、`chat_message:read:admin`、`chat_message:write:admin` |
| `chat contacts` | `contact:read:admin` |
| `summary list/get` | `meeting_summary:read:admin` |
| `phone calls` | `phone:read:admin`（需账户已启用 Zoom Phone） |

**若您收到权限范围错误（scope error）**，请前往 https://marketplace.zoom.us/ → 您的应用 → Scopes 页面，添加错误消息中提示缺失的权限范围。

## 速率限制（Rate Limits）

Zoom API 设有速率限制（因端点而异，通常为 30–100 次请求/秒）。脚本已内置对 429 响应的自动重试机制。