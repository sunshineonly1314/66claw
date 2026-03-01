---
name: apple-mail-search-safe
name_zh: 安全邮件搜索
description: 快速且安全的 Apple Mail 搜索，支持邮件正文内容。
description_zh: 快速且安全的 Apple Mail 搜索，支持邮件正文内容。
homepage: https://clawdhub.com/gumadeiras/apple-mail-search-safe
repository: https://github.com/gumadeiras/apple-mail-search-cli
metadata: {"clawdbot":{"emoji":"📧","requires":{"bins":["fruitmail"]},"install":[{"id":"node","kind":"node","package":"apple-mail-search-cli","bins":["fruitmail"],"label":"Install fruitmail CLI (npm)"}]}}
---
# Fruitmail（快速且安全）

基于 SQLite 的快速 Apple Mail.app 搜索工具，支持完整的邮件正文内容。

## 安装

```bash
npm install -g apple-mail-search-cli
```

## 使用方法

```bash
# Complex search
fruitmail search --subject "invoice" --days 30 --unread

# Search by sender
fruitmail sender "@amazon.com"

# List unread emails
fruitmail unread

# Read full email body (supports --json)
fruitmail body 94695

# Open in Mail.app
fruitmail open 94695

# Database stats
fruitmail stats
```

## 命令

| 命令 | 描述 |
|---------|-------------|
| `search` | 使用过滤器执行复杂搜索 |
| `sender <query>` | 按发件人邮箱地址搜索 |
| `unread` | 列出未读邮件 |
| `body <id>` | 读取完整邮件正文（通过 AppleScript） |
| `open <id>` | 在 Mail.app 中打开邮件 |
| `stats` | 数据库统计信息 |

## 搜索选项

```
--subject <text>   Search subject lines
--days <n>         Last N days
--unread           Only unread emails
--limit <n>        Max results (default: 20)
--json             Output as JSON
--copy             Copy DB before query (safest mode)
```

## 示例

```bash
# Find bank statements from last month
fruitmail search --subject "statement" --days 30

# Get unread emails as JSON
fruitmail unread --json | jq '.[] | .subject'

# Find emails from Amazon
fruitmail sender "@amazon.com" --limit 50
```

## 性能

| 方法 | 处理 13 万封邮件耗时 |
|--------|---------------------|
| AppleScript（全量遍历） | 8 分钟以上 |
| SQLite（本工具） | **约 50 毫秒** |

## 技术细节

- **数据库：** `~/Library/Mail/V{9,10,11}/MailData/Envelope Index`
- **查询方式：** SQLite（只读） + AppleScript（用于获取正文内容）
- **安全性：** 只读模式可防止任何修改；可选 `--copy` 模式可用

## 注意事项

- **仅限 macOS** —— 查询 Apple Mail.app 的本地数据库
- **只读访问** —— 可搜索/读取，但无法撰写或发送邮件
- **如需发送邮件：** 请使用 `himalaya` skill（IMAP/SMTP）

## 源代码

https://github.com/gumadeiras/apple-mail-search-cli