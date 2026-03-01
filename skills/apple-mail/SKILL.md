---
name: apple-mail
name_zh: 苹果邮件
description: macOS 上的 Apple Mail.app 集成。读取收件箱、搜索邮件、发送邮件、回复邮件，以及通过快速直连（无需枚举）管理消息。
description_zh: macOS 上的 Apple Mail.app 集成。读取收件箱、搜索邮件、发送邮件、回复邮件，以及通过快速直连（无需枚举）管理消息。
metadata: {"clawdbot":{"emoji":"📧","os":["darwin"],"requires":{"bins":["sqlite3"]}}}
---
# Apple Mail

通过 AppleScript 和 SQLite 与 Mail.app 交互。脚本运行位置：`cd {baseDir}`

## 命令

| 命令 | 用法 |
|---------|-------|
| **刷新** | `scripts/mail-refresh.sh [account] [wait_seconds]` |
| 列出最近邮件 | `scripts/mail-list.sh [mailbox] [account] [limit]` |
| 搜索 | `scripts/mail-search.sh "query" [mailbox] [limit]` |
| 快速搜索 | `scripts/mail-fast-search.sh "query" [limit]` |
| 读取邮件 | `scripts/mail-read.sh <message-id> [message-id...]` |
| 删除 | `scripts/mail-delete.sh <message-id> [message-id...]` |
| 标记为已读 | `scripts/mail-mark-read.sh <message-id> [message-id...]` |
| 标记为未读 | `scripts/mail-mark-unread.sh <message-id> [message-id...]` |
| 发送 | `scripts/mail-send.sh "to@email.com" "Subject" "Body" [from-account] [attachment]` ¹ |
| 回复 | `scripts/mail-reply.sh <message-id> "body" [reply-all]` |
| 列出账户 | `scripts/mail-accounts.sh` |
| 列出邮箱 | `scripts/mail-mailboxes.sh [account]` |

## 刷新 Mail

强制 Mail.app 检查新邮件：

```bash
scripts/mail-refresh.sh                    # All accounts, wait up to 10s
scripts/mail-refresh.sh Google             # Specific account only
scripts/mail-refresh.sh "" 5               # All accounts, max 5 seconds
scripts/mail-refresh.sh Google 0           # Google account, no wait
```

**智能同步检测：**
- 脚本监控数据库中的消息数量
- 同步完成时提前返回（连续 2 秒无变化）
- 报告新增消息数量：`Sync complete in 2s (+3 messages)`

**注意事项：**
- Mail.app 必须正在运行（若未运行，脚本将报错）
- `mail-list.sh` 不会自动刷新 — 若需最新数据，请先调用 `mail-refresh.sh`

## 输出格式

列表/搜索结果返回：`ID | ReadStatus | Date | Sender | Subject`  
- `●` = 未读，空白 = 已读

## Gmail 邮箱

⚠️ Gmail 特殊文件夹需添加 `[Gmail]/` 前缀：

| 显示名称 | 实际使用值 |
|----------|------------|
| `Spam` | `[Gmail]/Spam` |
| `Sent Mail` | `[Gmail]/Sent Mail` |
| `All Mail` | `[Gmail]/All Mail` |
| `Trash` | `[Gmail]/Trash` |

自定义标签无需前缀。

## 快速搜索（SQLite）

✨ **现支持 Mail.app 运行时安全执行** —— 首先将数据库复制到临时文件。

```bash
scripts/mail-fast-search.sh "query" [limit]  # ~50ms vs minutes
```

此前要求 Mail.app 必须退出。现通过在查询前将数据库复制至临时文件，实现任意时刻可用。

## 性能说明

**各操作耗时：**
| 操作 | 耗时 | 说明 |
|-----------|------|------|
| `mail-fast-search.sh` | ~50ms | SQLite 查询，最快 |
| `mail-accounts.sh` | <1s | 简单 AppleScript |
| `mail-list.sh` | 1–3s | AppleScript，直接邮箱访问 |
| `mail-send.sh` | 1–2s | 创建并发送邮件 |
| `mail-read.sh` | ~2s | 基于位置优化的查找 |
| `mail-delete.sh` | ~0.5s | 基于位置优化的查找 |
| `mail-mark-*.sh` | ~1.5s | 基于位置优化的查找 |

**优化技术：**  
SQLite 提供账户 UUID 及消息大致位置，AppleScript 直接跳转至该位置，而非从头遍历。

**支持批量操作：**  
- `mail-read.sh 123 456 789` —— 批量读取（各邮件间以分隔符分隔）  
- `mail-delete.sh 123 456 789` —— 批量删除  
- `mail-mark-read.sh 123 456` —— 批量标记为已读  
- `mail-mark-unread.sh 123 456` —— 批量标记为未读  

**⚠️ 无自动刷新：** 脚本读取缓存数据。若需最新邮件，请先调用 `mail-refresh.sh`。

## 邮件管理

**删除邮件：**  
```bash
scripts/mail-delete.sh 12345                    # Delete one
scripts/mail-delete.sh 12345 12346 12347        # Delete multiple
```

**标记为已读/未读：**  
```bash
scripts/mail-mark-read.sh 12345 12346           # Mark as read
scripts/mail-mark-unread.sh 12345               # Mark as unread
```

**批量操作示例：**  
```bash
# Find spam emails
scripts/mail-fast-search.sh "spam" 50 > spam.txt

# Extract IDs and delete them
grep "^[0-9]" spam.txt | cut -d'|' -f1 | xargs scripts/mail-delete.sh
```

## 读取邮件正文

```bash
scripts/mail-read.sh 12345              # Single email
scripts/mail-read.sh 12345 12346 12347  # Multiple emails (separated output)
```

采用基于位置优化的查找（每封邮件约 2 秒）。多封邮件以 `========` 分隔，并在末尾附带摘要。

## 错误

| 错误 | 原因 |
|-------|------|
| `Mail.app is not running` | 请先打开 Mail.app，再运行脚本 |
| `Account not found` | 账户无效 —— 请检查 mail-accounts.sh |
| `Message not found` | ID 无效或已被删除 —— 请通过 mail-list.sh 获取最新 ID |
| `Can't get mailbox` | 名称无效 —— 请检查 mail-mailboxes.sh |
| `Mail database not found` | SQLite 数据库缺失 —— 请检查 ~/Library/Mail/V{9,10,11}/MailData/ |

## 技术细节

**数据库：** `~/Library/Mail/V{9,10,11}/MailData/Envelope Index`

**消息查找方法（已优化）：**  
1. 通过 SQLite 查询账户 UUID、邮箱路径及大致位置  
2. AppleScript 直接访问对应账户（无需遍历）  
3. 搜索从大致位置开始（前后预留 ±5 封邮件缓冲区）  
4. 仅当位置提示失败时，才回退至全邮箱搜索  

**安全性：**  
- 快速搜索会在查询前将数据库复制到临时文件  
- 即使 Mail.app 正在运行亦可安全使用  
- 删除/读取/标记等操作虽查询实时数据库，但访问量极小  

## 注意事项

- 邮件 ID 为内部标识，请始终从列表/搜索结果中获取最新 ID  
- 发送前请确认收件人  
- AppleScript 搜索较慢但全面；SQLite 对元数据查询极快  
- 删除/标记操作支持批量执行（可传入多个 ID）  
- 如需绝对最新的邮件，请在列表前务必先执行刷新  

¹ **已知限制：** Mail.app 会在已发送邮件开头自动添加一个空行。此为 AppleScript / Mail.app 的固有行为，无法绕过。