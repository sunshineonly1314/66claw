---
name: protonmail
name_zh: ProtonMail
description: 通过 IMAP 桥接（Proton Bridge 或 hydroxide）读取、搜索和扫描 ProtonMail 邮箱。包含重要邮件的每日摘要。
description_zh: 通过 IMAP 桥接（Proton Bridge 或 hydroxide）读取、搜索和扫描 ProtonMail 邮箱。包含重要邮件的每日摘要。
metadata: {"clawdbot":{"emoji":"📧","requires":{"bins":["python3"]}}}
---
# ProtonMail Skill（ProtonMail 技能）

通过 IMAP 访问 ProtonMail，支持以下两种方式：
- **Proton Bridge**（官方推荐）
- **hydroxide**（第三方无头方案）

## 设置

### 方案 1：Proton Bridge（Docker）

```bash
# Pull and run
docker run -d --name=protonmail-bridge \
  -v protonmail:/root \
  -p 143:143 -p 1025:25 \
  --restart=unless-stopped \
  shenxn/protonmail-bridge

# Initial login (interactive)
docker run --rm -it -v protonmail:/root shenxn/protonmail-bridge init
# Then: login → enter credentials → info (shows bridge password) → exit
```

### 方案 2：hydroxide（无头模式）

```bash
# Install
git clone https://github.com/emersion/hydroxide.git
cd hydroxide && go build ./cmd/hydroxide

# Login
./hydroxide auth your@email.com

# Run as service
./hydroxide serve
```

## 配置

在 `~/.config/protonmail-bridge/config.env` 创建配置文件：

```bash
PROTONMAIL_HOST=127.0.0.1
PROTONMAIL_PORT=143
PROTONMAIL_USER=your@email.com
PROTONMAIL_PASS=your-bridge-password
```

或直接设置环境变量。

## 使用方法

```bash
# List mailboxes
protonmail.py mailboxes

# Show recent inbox
protonmail.py inbox --limit 10

# Show unread emails
protonmail.py unread

# Search emails
protonmail.py search "keyword"

# Read specific email
protonmail.py read 123
```

## 每日扫描

`daily-scan.py` 脚本依据以下条件识别重要邮件：
- 重要发件人（银行、政府机构、学校等）
- 紧急关键词（德语/英语/荷兰语）

可在脚本中或通过环境变量配置重要匹配模式。

## Sieve 过滤器（ProtonMail）

推荐用于自动分类的 Sieve 过滤器如下：

```sieve
require ["fileinto", "imap4flags"];

# Important emails - flag them
if anyof (
    address :contains "From" ["@bank", "@government"],
    header :contains "Subject" ["Urgent", "Dringend", "Belangrijk"]
) {
    addflag "\\Flagged";
}

# Newsletters - auto-read and move
if anyof (
    address :contains "From" "newsletter@",
    address :contains "From" "noreply@"
) {
    addflag "\\Seen";
    fileinto "Newsletter";
    stop;
}
```