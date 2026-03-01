---
name: simple-backup
name_zh: 简易备份
description: 将 agent brain（工作区）和 body（状态）备份至本地文件夹，并可选通过 rclone 同步至云端。
description_zh: 将 agent brain（工作区）和 body（状态）备份至本地文件夹，并可选通过 rclone 同步至云端。
metadata: {"clawdbot":{"emoji":"💾","requires":{"bins":["rclone","gpg","tar"]}}}
---
# Simple Backup

一个健壮的备份脚本，具备以下功能：
1.  **暂存（Staging）**：复制 `~/clawd`（工作区）、`~/.clawdbot`（状态）和 `skills/`。
2.  **压缩（Compression）**：生成一个 `.tgz` 归档文件。
3.  **加密（Encryption）**：使用 GPG 进行 AES256 加密（需输入密码）。
4.  **清理（Pruning）**：轮转备份（按日/小时保留策略）。
5.  **同步（Syncing）**：可选地通过 `rclone` 推送至云存储服务。

## 安装配置

1.  **依赖项**：确保已安装 `rclone` 和 `gpg`（参见 `brew install rclone gnupg`）。
2.  **密码设置**：设定加密密码：
    *   环境变量方式：`export BACKUP_PASSWORD="my-secret-password"`
    *   文件方式：`~/.clawdbot/credentials/backup.key`
3.  **云存储（可选）**：配置一个 rclone 远程端：
    ```bash
    rclone config
    ```

## 使用方法

运行备份：
```bash
simple-backup
```

## 配置说明

您可通过环境变量覆盖默认配置：

| 变量 | 默认值 | 描述 |
|----------|---------|-------------|
| `BACKUP_ROOT` | `~/clawd/BACKUPS` | 本地存储路径 |
| `REMOTE_DEST` | （空） | rclone 路径（例如 `gdrive:backups`） |
| `MAX_DAYS` | 7 | 每日备份保留天数 |
| `HOURLY_RETENTION_HOURS` | 24 | 每小时备份保留小时数 |