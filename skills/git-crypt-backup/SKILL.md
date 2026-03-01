---
name: git-crypt-backup
name_zh: Git加密备份
description: 使用 git-crypt 加密，将 Clawdbot 工作区和配置备份至 GitHub。适用于每日自动备份或手动备份/恢复操作。
description_zh: 使用 git-crypt 加密，将 Clawdbot 工作区和配置备份至 GitHub。适用于每日自动备份或手动备份/恢复操作。
---
# Git-Crypt 备份

将 Clawdbot 工作区（`~/clawd`）和配置（`~/.clawdbot`）自动备份至 GitHub，并通过 git-crypt 加密敏感文件。

## 设置

### 1. 创建 GitHub 仓库（推荐设为私有）

```bash
# Create two private repos on GitHub:
# - <username>/clawdbot-workspace
# - <username>/clawdbot-config
```

### 2. 初始化 git-crypt

```bash
# Install git-crypt
brew install git-crypt  # macOS
# apt install git-crypt  # Linux

# Workspace repo
cd ~/clawd
git init
git-crypt init
git remote add origin git@github.com:<username>/clawdbot-workspace.git

# Config repo
cd ~/.clawdbot
git init
git-crypt init
git remote add origin git@github.com:<username>/clawdbot-config.git
```

### 3. 配置加密规则

**工作区 `.gitattributes`：**  
```
SOUL.md filter=git-crypt diff=git-crypt
USER.md filter=git-crypt diff=git-crypt
HEARTBEAT.md filter=git-crypt diff=git-crypt
MEMORY.md filter=git-crypt diff=git-crypt
memory/** filter=git-crypt diff=git-crypt
```

**配置 `.gitattributes`：**  
```
clawdbot.json filter=git-crypt diff=git-crypt
.env filter=git-crypt diff=git-crypt
credentials/** filter=git-crypt diff=git-crypt
telegram/** filter=git-crypt diff=git-crypt
identity/** filter=git-crypt diff=git-crypt
agents/**/sessions/** filter=git-crypt diff=git-crypt
nodes/** filter=git-crypt diff=git-crypt
```

**配置 `.gitignore`：**  
```
*.bak
*.bak.*
.DS_Store
logs/
media/
browser/
subagents/
memory/
update-check.json
*.lock
```

### 4. 导出密钥（至关重要！）

```bash
mkdir -p ~/clawdbot-keys
cd ~/clawd && git-crypt export-key ~/clawdbot-keys/workspace.key
cd ~/.clawdbot && git-crypt export-key ~/clawdbot-keys/config.key
```

⚠️ **请安全保管这些密钥**（1Password、iCloud 钥匙串、USB 存储设备等）

### 5. 首次提交并推送

```bash
cd ~/clawd && git add -A && git commit -m "Initial backup" && git push -u origin main
cd ~/.clawdbot && git add -A && git commit -m "Initial backup" && git push -u origin main
```

## 每日备份

运行 `scripts/backup.sh`：

```bash
~/clawd/skills/git-crypt-backup/scripts/backup.sh
```

或配置 cron 任务以实现自动每日备份。

## 在新机器上恢复

```bash
# 1. Clone repos
git clone git@github.com:<username>/clawdbot-workspace.git ~/clawd
git clone git@github.com:<username>/clawdbot-config.git ~/.clawdbot

# 2. Unlock with keys
cd ~/clawd && git-crypt unlock /path/to/workspace.key
cd ~/.clawdbot && git-crypt unlock /path/to/config.key
```

## 加密内容说明

| 仓库 | 已加密 | 明文 |
|------|--------|------|
| 工作区 | SOUL/USER/HEARTBEAT/MEMORY.md、memory/** | AGENTS.md、IDENTITY.md、TOOLS.md、drafts/** |
| 配置 | clawdbot.json、.env、credentials/**、sessions/** | cron/jobs.json、settings/** |