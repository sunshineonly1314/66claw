---
name: hytale
description: 使用官方下载器和 screen 管理本地 Hytale 专用服务器。
description_zh: 使用官方下载器和 screen 管理本地 Hytale 专用服务器。
---
# Hytale 服务器技能

使用官方下载器和 screen 管理本地 Hytale 专用服务器。

## 要求
- Java 21+（已安装）
- Screen（已安装）
- Hytale 下载器（用户需自行提供）
- 凭据（用户须在 `~/hytale_server` 中提供 `hytale-downloader-credentials.json`）

## 设置

1. **下载 Hytale 下载器：**
   - 从以下地址获取 zip 包：`https://downloader.hytale.com/hytale-downloader.zip`
   - 解压后，将 `hytale-downloader-linux-amd64` 放入 `~/hytale_server/`。
   - 添加可执行权限：`chmod +x ~/hytale_server/hytale-downloader-linux-amd64`

2. **添加凭据：**
   - 将您的 `hytale-downloader-credentials.json` 放入 `~/hytale_server/`。

## 命令

### `hytale start`
在分离的 screen 会话中启动服务器。
- **运行：** `/home/clawd/.npm-global/lib/node_modules/clawdbot/skills/hytale/hytale.sh start`

### `hytale stop`
优雅地停止服务器。
- **运行：** `/home/clawd/.npm-global/lib/node_modules/clawdbot/skills/hytale/hytale.sh stop`

### `hytale update`
使用 Hytale 下载器下载或更新服务器文件。
- **运行：** `/home/clawd/.npm-global/lib/node_modules/clawdbot/skills/hytale/hytale.sh update`

### `hytale status`
检查服务器进程是否正在运行。
- **运行：** `/home/clawd/.npm-global/lib/node_modules/clawdbot/skills/hytale/hytale.sh status`