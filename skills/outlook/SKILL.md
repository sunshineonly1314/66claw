---
name: outlook
name_zh: Outlook
description: 通过 Microsoft Graph API 读取、搜索和管理 Outlook 邮件与日历。当用户询问邮件、收件箱、Outlook、Microsoft 邮件、日历事件或日程安排时使用。
description_zh: 通过 Microsoft Graph API 读取、搜索和管理 Outlook 邮件与日历。当用户询问邮件、收件箱、Outlook、Microsoft 邮件、日历事件或日程安排时使用。
version: 1.3.0
author: jotamed
---
# Outlook Skill

通过 OAuth2，使用 Microsoft Graph API 访问 Outlook/Hotmail 邮件与日历。

## 快速设置（自动化）

```bash
# Requires: Azure CLI, jq
./scripts/outlook-setup.sh
```

该设置脚本将：
1. 引导您登录 Azure（设备代码流）
2. 自动创建应用注册（App Registration）
3. 配置 API 权限（Mail.ReadWrite、Mail.Send、Calendars.ReadWrite）
4. 指导您完成授权流程
5. 将凭据保存至 `~/.outlook-mcp/`

## 手动设置

请参阅 `references/setup.md`，了解如何通过 Azure 门户进行分步手动配置。

## 使用方法

### 令牌管理
```bash
./scripts/outlook-token.sh refresh  # Refresh expired token
./scripts/outlook-token.sh test     # Test connection
./scripts/outlook-token.sh get      # Print access token
```

### 读取邮件
```bash
./scripts/outlook-mail.sh inbox [count]           # List latest emails (default: 10)
./scripts/outlook-mail.sh unread [count]          # List unread emails
./scripts/outlook-mail.sh search "query" [count]  # Search emails
./scripts/outlook-mail.sh from <email> [count]    # List emails from sender
./scripts/outlook-mail.sh read <id>               # Read email content
./scripts/outlook-mail.sh attachments <id>        # List email attachments
```

### 管理邮件
```bash
./scripts/outlook-mail.sh mark-read <id>          # Mark as read
./scripts/outlook-mail.sh mark-unread <id>        # Mark as unread
./scripts/outlook-mail.sh flag <id>               # Flag as important
./scripts/outlook-mail.sh unflag <id>             # Remove flag
./scripts/outlook-mail.sh delete <id>             # Move to trash
./scripts/outlook-mail.sh archive <id>            # Move to archive
./scripts/outlook-mail.sh move <id> <folder>      # Move to folder
```

### 发送邮件
```bash
./scripts/outlook-mail.sh send <to> <subj> <body> # Send new email
./scripts/outlook-mail.sh reply <id> "body"       # Reply to email
```

### 文件夹与统计信息
```bash
./scripts/outlook-mail.sh folders                 # List mail folders
./scripts/outlook-mail.sh stats                   # Inbox statistics
```

## 日历

### 查看事件
```bash
./scripts/outlook-calendar.sh events [count]      # List upcoming events
./scripts/outlook-calendar.sh today               # Today's events
./scripts/outlook-calendar.sh week                # This week's events
./scripts/outlook-calendar.sh read <id>           # Event details
./scripts/outlook-calendar.sh calendars           # List all calendars
./scripts/outlook-calendar.sh free <start> <end>  # Check availability
```

### 创建事件
```bash
./scripts/outlook-calendar.sh create <subj> <start> <end> [location]  # Create event
./scripts/outlook-calendar.sh quick <subject> [time]                  # Quick 1-hour event
```

### 管理事件
```bash
./scripts/outlook-calendar.sh update <id> <field> <value>  # Update (subject/location/start/end)
./scripts/outlook-calendar.sh delete <id>                  # Delete event
```

日期格式：`YYYY-MM-DDTHH:MM`（例如：`2026-01-26T10:00`）

### 示例输出

```bash
$ ./scripts/outlook-mail.sh inbox 3

{
  "n": 1,
  "subject": "Your weekly digest",
  "from": "digest@example.com",
  "date": "2026-01-25T15:44",
  "read": false,
  "id": "icYY6QAIUE26PgAAAA=="
}
{
  "n": 2,
  "subject": "Meeting reminder",
  "from": "calendar@outlook.com",
  "date": "2026-01-25T14:06",
  "read": true,
  "id": "icYY6QAIUE26PQAAAA=="
}

$ ./scripts/outlook-mail.sh read "icYY6QAIUE26PgAAAA=="

{
  "subject": "Your weekly digest",
  "from": { "name": "Digest", "address": "digest@example.com" },
  "to": ["you@hotmail.com"],
  "date": "2026-01-25T15:44:00Z",
  "body": "Here's what happened this week..."
}

$ ./scripts/outlook-mail.sh stats

{
  "folder": "Inbox",
  "total": 14098,
  "unread": 2955
}

$ ./scripts/outlook-calendar.sh today

{
  "n": 1,
  "subject": "Team standup",
  "start": "2026-01-25T10:00",
  "end": "2026-01-25T10:30",
  "location": "Teams",
  "id": "AAMkAGQ5NzE4YjQ3..."
}

$ ./scripts/outlook-calendar.sh create "Lunch with client" "2026-01-26T13:00" "2026-01-26T14:00" "Restaurant"

{
  "status": "event created",
  "subject": "Lunch with client",
  "start": "2026-01-26T13:00",
  "end": "2026-01-26T14:00",
  "id": "AAMkAGQ5NzE4YjQ3..."
}
```

## 令牌刷新

访问令牌约 1 小时后过期。请执行以下命令刷新：

```bash
./scripts/outlook-token.sh refresh
```

## 文件

- `~/.outlook-mcp/config.json` — 客户端 ID 与密钥
- `~/.outlook-mcp/credentials.json` — OAuth 令牌（访问令牌 + 刷新令牌）

## 权限

- `Mail.ReadWrite` — 读取并修改邮件
- `Mail.Send` — 发送邮件
- `Calendars.ReadWrite` — 读取并修改日历事件
- `offline_access` — 刷新令牌（保持登录状态）
- `User.Read` — 基本个人资料信息

## 注意事项

- **邮件 ID**：`id` 字段显示完整消息 ID 的最后 20 个字符。请在 `read`、`mark-read`、`delete` 等命令中使用该 ID。
- **编号结果**：邮件按序编号（n: 1, 2, 3…），便于在对话中快速引用。
- **文本提取**：HTML 格式邮件正文将自动转换为纯文本。
- **令牌过期**：访问令牌约 1 小时后过期。当出现身份验证错误时，请运行 `outlook-token.sh refresh`。
- **近期邮件**：`read`、`mark-read` 等命令将在最近 100 封邮件中搜索指定 ID。

## 故障排除

**“令牌已过期”** → 运行 `outlook-token.sh refresh`

**“授权无效”** → 令牌无效，请重新运行设置脚本：`outlook-setup.sh`

**“权限不足”** → 请前往 Azure 门户 → “API 权限”，检查应用权限配置

**“未找到邮件”** → 该邮件可能早于最近 100 封。请先使用搜索功能定位。

**“未找到文件夹”** → 请确保使用准确的文件夹名称。运行 `folders` 可查看当前可用的文件夹列表。

## 支持的账户类型

- 个人 Microsoft 账户（outlook.com、hotmail.com、live.com）
- 工作/学校账户（Microsoft 365）——可能需要管理员同意

## 更新日志

### v1.3.0
- 新增：**日历支持**（`outlook-calendar.sh`）
  - 查看事件（今日、本周、即将来临）
  - 创建/快速创建事件
  - 更新事件详情（主题、地点、时间）
  - 删除事件
  - 检查可用性（空闲/忙碌）
  - 列出日历
- 新增：`Calendars.ReadWrite` 权限

### v1.2.0
- 新增：`mark-unread` — 将邮件标记为未读
- 新增：`flag/unflag` — 将邮件标记/取消标记为重要
- 新增：`delete` — 将邮件移至垃圾箱
- 新增：`archive` — 归档邮件
- 新增：`move` — 将邮件移至任意文件夹
- 新增：`from` — 按发件人筛选邮件
- 新增：`attachments` — 列出邮件附件
- 新增：`reply` — 回复邮件
- 改进：`send` — 错误处理与状态输出更完善
- 改进：`move` — 文件夹名不区分大小写；出错时自动显示可用文件夹列表

### v1.1.0
- 修复：邮件 ID 现采用唯一后缀（最后 20 个字符）
- 新增：编号结果（n: 1, 2, 3…）
- 改进：HTML 正文自动转为纯文本
- 新增：读取输出中包含 `to` 字段

### v1.0.0
- 初始发布