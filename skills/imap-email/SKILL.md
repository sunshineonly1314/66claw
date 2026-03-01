---
name: imap-email
name_zh: IMAP邮件
description: 通过 IMAP（ProtonMail Bridge、Gmail 等）读取和管理邮件。检查新邮件/未读邮件、获取邮件正文、搜索邮箱、标记为已读/未读。兼容任意 IMAP 服务器，包括 ProtonMail Bridge。
description_zh: 通过 IMAP（ProtonMail Bridge、Gmail 等）读取和管理邮件。检查新邮件/未读邮件、获取邮件正文、搜索邮箱、标记为已读/未读。兼容任意 IMAP 服务器，包括 ProtonMail Bridge。
---
# IMAP 邮件阅读器

通过 IMAP 协议读取、搜索及管理电子邮件。支持 ProtonMail Bridge、Gmail IMAP 及任意标准 IMAP 服务器。

## 快速入门

**检查新邮件：**  
```bash
node skills/imap-email/scripts/imap.js check
```

**获取指定邮件：**  
```bash
node skills/imap-email/scripts/imap.js fetch <uid>
```

**标记为已读：**  
```bash
node skills/imap-email/scripts/imap.js mark-read <uid>
```

**搜索邮箱：**  
```bash
node skills/imap-email/scripts/imap.js search --from "sender@example.com" --unseen
```

## 配置

在 skill 文件夹中创建 `.env`，或设置环境变量：

```bash
IMAP_HOST=127.0.0.1          # Server hostname
IMAP_PORT=1143               # Server port
IMAP_USER=your@email.com
IMAP_PASS=your_password
IMAP_TLS=false               # Use TLS/SSL connection
IMAP_REJECT_UNAUTHORIZED=false  # Set to false for self-signed certs (optional)
IMAP_MAILBOX=INBOX           # Default mailbox
```

**ProtonMail Bridge 配置：**  
- 安装并运行 ProtonMail Bridge  
- IMAP 地址使用 `127.0.0.1:1143`  
- 密码由 Bridge 生成（非您的 ProtonMail 账户密码）  
- TLS 设置：使用 `false`（Bridge 使用 STARTTLS）  
- `REJECT_UNAUTHORIZED`：设为 `false`（Bridge 使用自签名证书）

**Gmail IMAP 配置：**  
- 主机：`imap.gmail.com`  
- 端口：`993`  
- TLS：`true`  
- 启用“允许不够安全的应用访问”或使用应用专用密码  
- `REJECT_UNAUTHORIZED`：可省略，或设为 `true`（默认值）

## 命令

### check  
检查邮箱中的未读/新邮件。

```bash
node scripts/imap.js check [--limit 10] [--mailbox INBOX] [--recent 2h]
```

选项：  
- `--limit <n>`：最多返回条数（默认：10）  
- `--mailbox <name>`：要检查的邮箱（默认：INBOX）  
- `--recent <time>`：仅显示最近 X 时间内的邮件（例如：30m、2h、7d）

返回包含以下字段的 JSON 消息数组：  
- uid、from、subject、date、snippet、flags

### fetch  
根据 UID 获取完整邮件内容。

```bash
node scripts/imap.js fetch <uid> [--mailbox INBOX]
```

返回包含完整正文（纯文本 + HTML）的 JSON。

### search  
使用过滤条件搜索邮件。

```bash
node scripts/imap.js search [options]

Options:
  --unseen           Only unread messages
  --seen             Only read messages
  --from <email>     From address contains
  --subject <text>   Subject contains
  --recent <time>    From last X time (e.g., 30m, 2h, 7d)
  --since <date>     After date (YYYY-MM-DD)
  --before <date>    Before date (YYYY-MM-DD)
  --limit <n>        Max results (default: 20)
  --mailbox <name>   Mailbox to search (default: INBOX)
```

时间格式示例：  
- `30m` = 最近 30 分钟  
- `2h` = 最近 2 小时  
- `7d` = 最近 7 天  

### mark-read / mark-unread  
将消息标记为已读或未读。

```bash
node scripts/imap.js mark-read <uid> [uid2 uid3...]
node scripts/imap.js mark-unread <uid> [uid2 uid3...]
```

### list-mailboxes  
列出所有可用邮箱/文件夹。

```bash
node scripts/imap.js list-mailboxes
```

## Cron 集成

使用 Clawdbot cron 设置周期性邮件检查：

```bash
# Check email every 15 minutes, deliver to iMessage
clawdbot cron add \
  --name "email-check" \
  --cron "*/15 * * * *" \
  --session isolated \
  --message "Check for new ProtonMail emails and summarize them" \
  --deliver \
  --channel imessage \
  --to "+15085600825"
```

在隔离会话中，agent 可执行：  
```bash
node /Users/mike/clawd/skills/imap-email/scripts/imap.js check --limit 5
```

## 工作流示例

**晨间邮件简报：**  
1. 运行 `check --limit 10 --recent 12h`  
2. 汇总前一晚的未读邮件  
3. 将摘要投递至首选通信渠道  

**检查特定发件人的近期邮件：**  
1. 运行 `search --from "important@company.com" --recent 24h`  
2. 如需进一步处理，获取完整内容  
3. 处理完毕后标记为已读  

**每小时紧急邮件检查：**  
1. 运行 `search --recent 1h --unseen`  
2. 按关键词筛选重要邮件  
3. 提取待办事项  
4. 若存在紧急情况，则发送通知  

**周度简报：**  
1. 运行 `search --recent 7d --limit 20`  
2. 汇总本周活动  
3. 生成周度报告  

## 依赖项

在 skill 文件夹中安装：  
```bash
cd skills/imap-email
npm install imap-simple dotenv
```

或全局安装：  
```bash
npm install -g imap-simple dotenv
```

## 安全须知

- 将凭据存于 `.env`（并加入 `.gitignore`）  
- ProtonMail Bridge 的密码 ≠ 您的账户密码  
- 使用 ProtonMail IMAP 时，Bridge 必须处于运行状态  
- 建议为 Gmail 使用应用专用密码  

## 故障排除

**连接超时：**  
- 确认 IMAP 服务器正在运行且可访问  
- 检查主机名/端口配置  
- 测试命令：`telnet <host> <port>`  

**身份验证失败：**  
- 确认用户名（通常为完整邮箱地址）  
- 检查密码是否正确  
- 对于 ProtonMail Bridge：请使用 Bridge 生成的密码，而非账户密码  
- 对于 Gmail：若启用双重验证（2FA），请使用应用专用密码  

**TLS/SSL 错误：**  
- `IMAP_TLS` 设置需与服务器要求一致（true 表示 SSL，false 表示 STARTTLS）  
- 对于自签名证书（如 ProtonMail Bridge）：设置 `IMAP_REJECT_UNAUTHORIZED=false`  
- 确认端口与 TLS 设置匹配（SSL 使用 993 端口，STARTTLS 使用 143 端口）  

**返回空结果：**  
- 确认邮箱名称（区分大小写）  
- 检查搜索条件  
- 使用 `list-mailboxes` 列出所有邮箱  