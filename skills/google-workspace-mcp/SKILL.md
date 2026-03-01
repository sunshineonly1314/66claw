---
name: google-workspace
name_zh: Google Workspace MCP
description: 支持 Gmail、Calendar、Drive、Docs、Sheets —— 无需 Google Cloud Console！仅需 OAuth 登录。相比传统 Google API 集成，零配置复杂度。
description_zh: 支持 Gmail、Calendar、Drive、Docs、Sheets —— 无需 Google Cloud Console！仅需 OAuth 登录。相比传统 Google API 集成，零配置复杂度。
metadata: {"clawdbot":{"emoji":"📬","requires":{"bins":["mcporter"]}}}
---
# Google Workspace 访问（无需 Cloud Console！）

**为何选用此 skill？** 传统的 Google API 访问需在 Google Cloud Console 中创建项目、启用 API、创建 OAuth 凭据，并下载 client_secret.json。本 skill 完全跳过所有这些步骤。

使用 `@presto-ai/google-workspace-mcp` —— 只需使用您的 Google 账户登录即可开始使用。

## 核心优势

| 传统方式 | 本 skill |
|----------|-----------|
| 创建 Google Cloud 项目 | ❌ 无需 |
| 启用各独立 API | ❌ 无需 |
| 创建 OAuth 凭据 | ❌ 无需 |
| 下载 client_secret.json | ❌ 无需 |
| 配置重定向 URI | ❌ 无需 |
| **仅需 Google 登录** | ✅ 就是这么简单 |

## 设置（已预先完成）

```bash
npm install -g @presto-ai/google-workspace-mcp
mcporter config add google-workspace --command "npx" --arg "-y" --arg "@presto-ai/google-workspace-mcp" --scope home
```

首次使用时，将自动打开浏览器进行 Google OAuth 登录。凭据将保存于 `~/.config/google-workspace-mcp/`

## 快速命令

### Gmail

```bash
# Search emails
mcporter call --server google-workspace --tool "gmail.search" query="is:unread" maxResults=10

# Get email content
mcporter call --server google-workspace --tool "gmail.get" messageId="<id>"

# Send email
mcporter call --server google-workspace --tool "gmail.send" to="email@example.com" subject="Hi" body="Hello"

# Create draft
mcporter call --server google-workspace --tool "gmail.createDraft" to="email@example.com" subject="Hi" body="Hello"
```

### Calendar

```bash
# List calendars
mcporter call --server google-workspace --tool "calendar.list"

# List events
mcporter call --server google-workspace --tool "calendar.listEvents" calendarId="your@email.com" timeMin="2026-01-27T00:00:00Z" timeMax="2026-01-27T23:59:59Z"

# Create event
mcporter call --server google-workspace --tool "calendar.createEvent" calendarId="your@email.com" summary="Meeting" start='{"dateTime":"2026-01-28T10:00:00Z"}' end='{"dateTime":"2026-01-28T11:00:00Z"}'

# Find free time
mcporter call --server google-workspace --tool "calendar.findFreeTime" attendees='["a@example.com","b@example.com"]' timeMin="2026-01-28T09:00:00Z" timeMax="2026-01-28T18:00:00Z" duration=30
```

### Drive

```bash
# Search files
mcporter call --server google-workspace --tool "drive.search" query="Budget Q3"

# Download file
mcporter call --server google-workspace --tool "drive.downloadFile" fileId="<id>" localPath="/tmp/file.pdf"
```

### Docs

```bash
# Find docs
mcporter call --server google-workspace --tool "docs.find" query="meeting notes"

# Read doc
mcporter call --server google-workspace --tool "docs.getText" documentId="<id>"

# Create doc
mcporter call --server google-workspace --tool "docs.create" title="New Doc" markdown="# Hello"
```

### Sheets

```bash
# Read spreadsheet
mcporter call --server google-workspace --tool "sheets.getText" spreadsheetId="<id>"

# Get range
mcporter call --server google-workspace --tool "sheets.getRange" spreadsheetId="<id>" range="Sheet1!A1:B10"
```

## 可用工具（共 49 个）

**认证（Auth）**：auth.clear、auth.refreshToken  
**Docs**：docs.create、docs.find、docs.getText、docs.insertText、docs.appendText、docs.replaceText、docs.move、docs.extractIdFromUrl  
**Drive**：drive.search、drive.downloadFile、drive.findFolder  
**Sheets**：sheets.getText、sheets.getRange、sheets.find、sheets.getMetadata  
**Slides**：slides.getText、slides.find、slides.getMetadata  
**Calendar**：calendar.list、calendar.listEvents、calendar.getEvent、calendar.createEvent、calendar.updateEvent、calendar.deleteEvent、calendar.findFreeTime、calendar.respondToEvent  
**Gmail**：gmail.search、gmail.get、gmail.send、gmail.createDraft、gmail.sendDraft、gmail.modify、gmail.listLabels、gmail.downloadAttachment  
**Chat**：chat.listSpaces、chat.findSpaceByName、chat.sendMessage、chat.getMessages、chat.sendDm、chat.findDmByEmail、chat.listThreads、chat.setUpSpace  
**People**：people.getUserProfile、people.getMe  
**Time**：time.getCurrentDate、time.getCurrentTime、time.getTimeZone

## 故障排除

### 重新认证
```bash
mcporter call --server google-workspace --tool "auth.clear"
```  
然后运行任意命令以触发重新认证。

### 刷新令牌
```bash
mcporter call --server google-workspace --tool "auth.refreshToken"
```

### 删除凭据
```bash
rm -rf ~/.config/google-workspace-mcp
```