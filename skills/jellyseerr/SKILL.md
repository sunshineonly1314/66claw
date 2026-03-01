---
name: jellyseerr
name_zh: Jellyseerr
description: 通过 Jellyseerr 请求电影和电视剧。当用户希望将媒体添加到其 Plex/Jellyfin 服务器、搜索内容可用性或管理媒体请求时使用。
description_zh: 通过 Jellyseerr 请求电影和电视剧。当用户希望将媒体添加到其 Plex/Jellyfin 服务器、搜索内容可用性或管理媒体请求时使用。
---
# Jellyseerr

通过您的 Jellyseerr 服务器请求电影和电视剧，以实现向 Plex/Jellyfin 的自动下载。

## 设置

配置您的 Jellyseerr 服务器：

```bash
scripts/setup.sh
```

您需要：
- Jellyseerr 服务器 URL
- API 密钥（位于 Jellyseerr 设置 > 常规中）

## 使用方法

请求一部电影：
```bash
scripts/request_movie.py "Movie Name"
```

请求一部电视剧：
```bash
scripts/request_tv.py "TV Show Name"
```

搜索内容：
```bash
scripts/search.py "Content Name"
```

## 示例

请求一部电影：
```bash
scripts/request_movie.py "The Matrix"
```

请求一部电视剧（整季）：
```bash
scripts/request_tv.py "Breaking Bad"
```

请求特定电视剧季数：
```bash
scripts/request_tv.py "Breaking Bad" --season 1
```

## 自动可用性通知

当您所请求的内容上线时，即刻收到通知。

### Webhook（推荐）

如需即时通知，请配置 webhook 集成。完整指南请参阅 [references/WEBHOOK_SETUP.md](references/WEBHOOK_SETUP.md)。

快速配置：
```bash
scripts/install_service.sh  # Run with sudo
```

然后在 Jellyseerr 中配置，使其向 `http://YOUR_IP:8384/` 发送 webhook。

### 轮询（替代方案）

在无法使用 webhook 的环境中，可采用基于 cron 的轮询方式：

```bash
crontab -l > /tmp/cron_backup.txt
echo "* * * * * $(pwd)/scripts/auto_monitor.sh" >> /tmp/cron_backup.txt
crontab /tmp/cron_backup.txt
```

检查待处理的请求：
```bash
scripts/track_requests.py
```

## 配置

编辑 `~/.config/jellyseerr/config.json`：
```json
{
  "server_url": "https://jellyseerr.yourdomain.com",
  "api_key": "your-api-key",
  "auto_approve": true
}
```

## API 参考

Jellyseerr API 文档详见 [references/api.md](references/api.md)。