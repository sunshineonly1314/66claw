---
name: clawdbot-update-plus
name_zh: 增量更新
description: Clawdbot 的完整备份、更新与恢复工具——涵盖配置、工作区及 skills，并支持自动回滚
description_zh: Clawdbot 的完整备份、更新与恢复工具——涵盖配置、工作区及 skills，并支持自动回滚
version: 2.1.1
metadata: {"clawdbot":{"emoji":"🔄","requires":{"bins":["git","jq","rsync"],"commands":["clawdbot"]}}}
---
# 🔄 Clawdbot Update Plus

一款面向完整 Clawdbot 环境的综合性备份、更新与恢复工具。借助自动回滚、加密备份及云同步功能，全面保护您的配置、工作区及 skills。

## 快速开始

```bash
# Check for available updates
clawdbot-update-plus check

# Create a full backup
clawdbot-update-plus backup

# Update everything (creates backup first)
clawdbot-update-plus update

# Preview changes (no modifications)
clawdbot-update-plus update --dry-run

# Restore from backup
clawdbot-update-plus restore clawdbot-update-2026-01-25-12:00:00.tar.gz
```

## 功能特性

| 功能 | 描述 |
|------|------|
| **完整备份** | 备份整个环境（配置、工作区、skills） |
| **自动备份** | 每次更新前自动创建备份 |
| **自动回滚** | 更新失败时自动回退至上一提交版本 |
| **智能恢复** | 支持恢复全部内容，或仅恢复特定部分（如配置、工作区） |
| **多目录支持** | 为生产/开发 skills 设置独立的更新策略 |
| **加密备份** | 可选 GPG 加密 |
| **云同步** | 通过 rclone 将备份上传至 Google Drive、S3、Dropbox |
| **通知功能** | 通过 WhatsApp、Telegram 或 Discord 接收通知 |
| **模块化架构** | 清晰、易维护的代码结构 |

## 安装方法

```bash
# Via ClawdHub
clawdhub install clawdbot-update-plus --dir ~/.clawdbot/skills

# Or clone manually
git clone https://github.com/hopyky/clawdbot-update-plus.git ~/.clawdbot/skills/clawdbot-update-plus
```

### 添加至 PATH

创建符号链接，使命令可在全局调用：

```bash
mkdir -p ~/bin
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc  # or ~/.bashrc
source ~/.zshrc
ln -sf ~/.clawdbot/skills/clawdbot-update-plus/bin/clawdbot-update-plus ~/bin/clawdbot-update-plus
```

### 依赖项

| 依赖项 | 是否必需 | 用途 |
|--------|----------|------|
| `git` | 是 | 从仓库更新 skills |
| `jq` | 是 | 解析 JSON 配置文件 |
| `rsync` | 是 | 高效文件拷贝 |
| `rclone` | 否 | 云存储同步 |
| `gpg` | 否 | 备份加密 |

## 配置方法

创建 `~/.clawdbot/clawdbot-update.json`：

```json
{
  "backup_dir": "~/.clawdbot/backups",
  "backup_before_update": true,
  "backup_count": 5,
  "backup_paths": [
    {"path": "~/.clawdbot", "label": "config", "exclude": ["backups", "logs", "media", "*.lock"]},
    {"path": "~/clawd", "label": "workspace", "exclude": ["node_modules", ".venv"]}
  ],
  "skills_dirs": [
    {"path": "~/.clawdbot/skills", "label": "prod", "update": true},
    {"path": "~/clawd/skills", "label": "dev", "update": false}
  ],
  "remote_storage": {
    "enabled": false,
    "rclone_remote": "gdrive:",
    "path": "clawdbot-backups"
  },
  "encryption": {
    "enabled": false,
    "gpg_recipient": "your-email@example.com"
  },
  "notifications": {
    "enabled": false,
    "target": "+1234567890",
    "on_success": true,
    "on_error": true
  }
}
```

## 备份路径

通过 `backup_paths` 配置需备份的内容：

| 选项 | 描述 |
|------|------|
| `path` | 待备份目录（支持 `~`） |
| `label` | 日志与恢复时显示的名称 |
| `exclude` | 排除的文件/文件夹 |

### 推荐配置

```json
"backup_paths": [
  {"path": "~/.clawdbot", "label": "config", "exclude": ["backups", "logs", "media"]},
  {"path": "~/clawd", "label": "workspace", "exclude": ["node_modules", ".venv"]}
]
```

## Skills 更新

通过 `skills_dirs` 配置需更新的 skills：

| 选项 | 描述 |
|------|------|
| `path` | Skills 目录 |
| `label` | 日志中显示的名称 |
| `update` | 是否运行 `git pull`（true/false） |

### 推荐配置

```json
"skills_dirs": [
  {"path": "~/.clawdbot/skills", "label": "prod", "update": true},
  {"path": "~/clawd/skills", "label": "dev", "update": false}
]
```

- **生产环境（Prod）**：自动从 ClawdHub/GitHub 更新  
- **开发环境（Dev）**：仅支持手动更新（保护您的开发工作）  

## 命令列表

### `backup` — 创建完整备份

```bash
clawdbot-update-plus backup
```

### `list-backups` — 列出可用备份

```bash
clawdbot-update-plus list-backups
```

### `update` — 全量更新

```bash
# Standard update (with automatic backup)
clawdbot-update-plus update

# Preview changes only
clawdbot-update-plus update --dry-run

# Skip backup
clawdbot-update-plus update --no-backup

# Force continue even if backup fails
clawdbot-update-plus update --force
```

### `restore` — 从备份恢复

```bash
# Restore everything
clawdbot-update-plus restore backup.tar.gz

# Restore only config
clawdbot-update-plus restore backup.tar.gz config

# Restore only workspace
clawdbot-update-plus restore backup.tar.gz workspace

# Force (no confirmation)
clawdbot-update-plus restore backup.tar.gz --force
```

### `check` — 检查更新

```bash
clawdbot-update-plus check
```

### `install-cron` — 自动更新

```bash
# Install daily at 2 AM
clawdbot-update-plus install-cron

# Custom schedule
clawdbot-update-plus install-cron "0 3 * * 0"  # Sundays at 3 AM

# Remove
clawdbot-update-plus uninstall-cron
```

## 通知功能

更新成功或失败时接收通知：

```json
"notifications": {
  "enabled": true,
  "target": "+1234567890",
  "on_success": true,
  "on_error": true
}
```

目标格式决定通知渠道：  
- `+1234567890` → WhatsApp  
- `@username` → Telegram  
- `channel:123` → Discord  

## 云存储

### 配置 rclone

```bash
# Install
brew install rclone  # macOS
curl https://rclone.org/install.sh | sudo bash  # Linux

# Configure
rclone config
```

### 在配置中启用

```json
"remote_storage": {
  "enabled": true,
  "rclone_remote": "gdrive:",
  "path": "clawdbot-backups"
}
```

## 加密备份

```json
"encryption": {
  "enabled": true,
  "gpg_recipient": "your-email@example.com"
}
```

## 日志

所有操作均记录至 `~/.clawdbot/backups/update.log`：

```
[2026-01-25 20:22:48] === Update started 2026-01-25 20:22:48 ===
[2026-01-25 20:23:39] Creating backup...
[2026-01-25 20:23:39] Backup created: clawdbot-update-2026-01-25-20:22:48.tar.gz (625M)
[2026-01-25 20:23:39] Clawdbot current version: 2026.1.22
[2026-01-25 20:23:41] Starting skills update
[2026-01-25 20:23:41] === Update completed 2026-01-25 20:23:41 ===
[2026-01-25 20:23:43] Notification sent to +1234567890 via whatsapp
```

**日志保留策略**：超过 30 天的日志将自动删除。

## 保留策略（Retention Policy）

| 类型 | 保留期限 | 配置项 |
|------|----------|--------|
| 备份（本地） | 最近 N 个备份 | `backup_count: 5` |
| 备份（远程） | 最近 N 个备份 | 同本地配置 |
| 日志 | 30 天 | 自动执行 |

## 架构（v2.0）

```
bin/
├── clawdbot-update-plus     # Main entry point
└── lib/
    ├── utils.sh             # Logging, helpers
    ├── config.sh            # Configuration
    ├── backup.sh            # Backup functions
    ├── restore.sh           # Restore functions
    ├── update.sh            # Update functions
    ├── notify.sh            # Notifications
    └── cron.sh              # Cron management
```

## 更新日志（Changelog）

### v2.0.0  
- 全面重构架构  
- 模块化设计（共 7 个独立模块）  
- 更清晰的代码库（每个模块约 150 行，相较原单体 >1000 行）  
- 更完善的错误处理  
- 增强恢复功能，支持标签（label）  
- 根据目标格式自动识别通知渠道  
- 修复 `--no-backup` 标志位被忽略的问题  
- 详细日志写入文件并支持自动清理  
- 备份保留策略（本地 + 远程）  

### v1.7.0  
- 支持带标签（label）的智能恢复  
- 自动识别备份格式  

### v1.6.0  
- 新增 `backup_paths`，支持完整环境备份  
- 将备份逻辑与更新逻辑分离  

### v1.5.0  
- 支持多目录（`skills_dirs`）  

### v1.4.0  
- 通过 Clawdbot 消息通道发送通知  

### v1.3.0  
- 新增 `check`、`diff-backups`、`install-cron` 命令  

## 作者

由 **hopyky** 创建  

## 许可证

MIT  