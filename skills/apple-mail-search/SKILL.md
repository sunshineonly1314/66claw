---
name: apple-mail-search
name_zh: 邮件搜索
description: 通过 macOS 上的 SQLite 实现快速 Apple Mail 搜索。按主题、发件人、日期、附件等搜索邮件 —— 结果耗时约 50ms，远优于 AppleScript 的 8 分钟以上。当用户要求查找、搜索或列出邮件时使用。
description_zh: 通过 macOS 上的 SQLite 实现快速 Apple Mail 搜索。按主题、发件人、日期、附件等搜索邮件 —— 结果耗时约 50ms，远优于 AppleScript 的 8 分钟以上。当用户要求查找、搜索或列出邮件时使用。
homepage: https://github.com/steipete/clawdbot
metadata: {"clawdbot":{"emoji":"📬","os":["darwin"],"requires":{"bins":["sqlite3"]}}}
---
# Apple Mail 搜索

通过 SQLite 即时搜索 Apple Mail.app 邮件。耗时约 50ms，远优于 AppleScript 的 8 分钟以上。

## 安装

```bash
# Copy mail-search to your PATH
cp mail-search /usr/local/bin/
chmod +x /usr/local/bin/mail-search
```

## 使用方法

```bash
mail-search subject "invoice"           # Search subjects
mail-search sender "@amazon.com"        # Search by sender email
mail-search from-name "John"            # Search by sender name
mail-search to "recipient@example.com"  # Search sent mail
mail-search unread                      # List unread emails
mail-search attachments                 # List emails with attachments
mail-search attachment-type pdf         # Find PDFs
mail-search recent 7                    # Last 7 days
mail-search date-range 2025-01-01 2025-01-31
mail-search open 12345                  # Open email by ID
mail-search stats                       # Database statistics
```

## 选项

```
-n, --limit N    Max results (default: 20)
-j, --json       Output as JSON
-c, --csv        Output as CSV
-q, --quiet      No headers
--db PATH        Override database path
```

## 示例

```bash
# Find bank statements from last month
mail-search subject "statement" -n 50

# Get unread emails as JSON for processing
mail-search unread --json | jq '.[] | .subject'

# Find all PDFs from a specific sender
mail-search sender "@bankofamerica.com" -n 100 | grep -i statement

# Export recent emails to CSV
mail-search recent 30 --csv > recent_emails.csv
```

## 此工具存在的原因

| 方法 | 13 万封邮件耗时 |
|--------|---------------------|
| AppleScript 遍历 | 8 分钟以上 |
| Spotlight/mdfind | **自 macOS Big Sur 起已失效** |
| SQLite（本工具） | ~50ms |

Apple 在 macOS Big Sur 中移除了 emlx 的 Spotlight 导入器。本工具直接查询 `Envelope Index` SQLite 数据库。

## 技术细节

**数据库：** `~/Library/Mail/V{9,10,11}/MailData/Envelope Index`

**关键表：**
- `messages` —— 邮件元数据（日期、标志位、外键等）
- `subjects` —— 主题行
- `addresses` —— 邮箱地址与显示名称
- `recipients` —— 收件人/抄送映射
- `attachments` —— 附件文件名

**限制：**
- 仅读取（不可撰写/发送）
- 仅含元数据（正文存储在 .emlx 文件中）
- 仅支持 Mail.app（不支持 Outlook 等）

## 高级用法：原始 SQL

如需自定义查询，可直接使用 sqlite3：

```bash
sqlite3 -header -column ~/Library/Mail/V10/MailData/Envelope\ Index "
SELECT m.ROWID, s.subject, a.address
FROM messages m
JOIN subjects s ON m.subject = s.ROWID
LEFT JOIN addresses a ON m.sender = a.ROWID
WHERE s.subject LIKE '%your query%'
ORDER BY m.date_sent DESC
LIMIT 20;
"
```

## 许可证

MIT