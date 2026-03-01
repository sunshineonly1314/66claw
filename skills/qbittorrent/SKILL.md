---
name: qbittorrent
name_zh: qBittorrent
version: 1.0.0
description: 使用 qBittorrent 管理种子任务。当用户提出“列出种子任务”、“添加种子”、“暂停种子”、“恢复种子”、“删除种子”、“检查下载状态”、“种子速度”、“qBittorrent 统计信息”，或提及 qBittorrent/qbit 种子管理时启用本 skill。
description_zh: 使用 qBittorrent 管理种子任务。当用户提出“列出种子任务”、“添加种子”、“暂停种子”、“恢复种子”、“删除种子”、“检查下载状态”、“种子速度”、“qBittorrent 统计信息”，或提及 qBittorrent/qbit 种子管理时启用本 skill。
---
# qBittorrent WebUI API

通过 qBittorrent 的 WebUI API（v4.1+）管理种子任务。

## 配置

配置文件：`~/.clawdbot/credentials/qbittorrent/config.json`

```json
{
  "url": "http://localhost:8080",
  "username": "admin",
  "password": "adminadmin"
}
```

## 快速参考

### 列出种子任务

```bash
# All torrents
./scripts/qbit-api.sh list

# Filter by status
./scripts/qbit-api.sh list --filter downloading
./scripts/qbit-api.sh list --filter seeding
./scripts/qbit-api.sh list --filter paused

# Filter by category
./scripts/qbit-api.sh list --category movies
```

筛选参数：`all`、`downloading`、`seeding`、`completed`、`paused`、`active`、`inactive`、`stalled`、`errored`

### 获取种子详情

```bash
./scripts/qbit-api.sh info <hash>
./scripts/qbit-api.sh files <hash>
./scripts/qbit-api.sh trackers <hash>
```

### 添加种子

```bash
# By magnet or URL
./scripts/qbit-api.sh add "magnet:?xt=..." --category movies

# By file
./scripts/qbit-api.sh add-file /path/to/file.torrent --paused
```

### 控制种子任务

```bash
./scripts/qbit-api.sh pause <hash>         # or "all"
./scripts/qbit-api.sh resume <hash>        # or "all"
./scripts/qbit-api.sh delete <hash>        # keep files
./scripts/qbit-api.sh delete <hash> --files  # delete files too
./scripts/qbit-api.sh recheck <hash>
```

### 分类与标签

```bash
./scripts/qbit-api.sh categories
./scripts/qbit-api.sh tags
./scripts/qbit-api.sh set-category <hash> movies
./scripts/qbit-api.sh add-tags <hash> "important,archive"
```

### 传输信息

```bash
./scripts/qbit-api.sh transfer   # global speed/stats
./scripts/qbit-api.sh speedlimit # current limits
./scripts/qbit-api.sh set-speedlimit --down 5M --up 1M
```

### 应用信息

```bash
./scripts/qbit-api.sh version
./scripts/qbit-api.sh preferences
```

## 响应格式

种子对象包含以下字段：
- `hash`、`name`、`state`、`progress`
- `dlspeed`、`upspeed`、`eta`
- `size`、`downloaded`、`uploaded`
- `category`、`tags`、`save_path`

任务状态：`downloading`、`stalledDL`、`uploading`、`stalledUP`、`pausedDL`、`pausedUP`、`queuedDL`、`queuedUP`、`checkingDL`、`checkingUP`、`error`、`missingFiles`