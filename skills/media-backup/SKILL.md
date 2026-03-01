---
name: media-backup
name_zh: 媒体备份
description: 将 Clawdbot 对话中的媒体文件（照片、视频）归档至本地文件夹。兼容任意云同步服务（Dropbox、iCloud、Google Drive、OneDrive）。
description_zh: 将 Clawdbot 对话中的媒体文件（照片、视频）归档至本地文件夹。兼容任意云同步服务（Dropbox、iCloud、Google Drive、OneDrive）。
metadata: {"clawdbot":{"env":["MEDIA_BACKUP_DEST"]}}
---
# 媒体备份

将 Clawdbot 接收的媒体文件简单备份至本地文件夹。无需 API、无需 OAuth——仅执行文件复制。

由于仅向本地文件夹复制文件，因此可与任意云同步服务协同工作。

## 配置

设置目标文件夹：
```bash
export MEDIA_BACKUP_DEST="$HOME/Dropbox/Clawdbot/media"
# or
export MEDIA_BACKUP_DEST="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Clawdbot/media"  # iCloud
# or  
export MEDIA_BACKUP_DEST="$HOME/Google Drive/Clawdbot/media"
```

或在 clawdbot 配置中添加：
```json
{
  "skills": {
    "entries": {
      "media-backup": {
        "env": {
          "MEDIA_BACKUP_DEST": "/path/to/your/folder"
        }
      }
    }
  }
}
```

## 使用方法

```bash
# Run backup
uv run skills/media-backup/scripts/backup.py

# Dry run (preview only)
uv run skills/media-backup/scripts/backup.py --dry-run

# Custom source/destination
uv run skills/media-backup/scripts/backup.py --source ~/.clawdbot/media/inbound --dest ~/Backups/media

# Check status
uv run skills/media-backup/scripts/backup.py status
```

## 工作原理

1. 扫描 `~/.clawdbot/media/inbound/` 中的媒体文件  
2. 按日期组织：`YYYY-MM-DD/filename.jpg`  
3. 依据内容哈希值追踪已归档文件（避免重复）  
4. 您的云服务自动同步该文件夹  

## Cron 配置

每小时执行一次备份：
```
0 * * * * cd ~/clawd && uv run skills/media-backup/scripts/backup.py >> /tmp/media-backup.log 2>&1
```

或通过 Clawdbot 的 cron 任务执行：
```
Run media backup: uv run skills/media-backup/scripts/backup.py
If files archived, reply: 📸 Archived [N] media files
If none, reply: HEARTBEAT_OK
```

## 支持的格式

jpg、jpeg、png、gif、webp、heic、mp4、mov、m4v、webm