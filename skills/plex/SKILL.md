---
name: plex
name_zh: Plex
description: 控制 Plex 媒体服务器 — 浏览媒体库、搜索内容、播放媒体、管理播放状态。
description_zh: 控制 Plex 媒体服务器 — 浏览媒体库、搜索内容、播放媒体、管理播放状态。
homepage: https://plex.tv
metadata: {"clawdis":{"emoji":"🎬","requires":{"bins":["curl"],"env":["PLEX_TOKEN","PLEX_SERVER"]},"primaryEnv":"PLEX_TOKEN"}}
---
# Plex 媒体服务器

通过 Plex API 控制 Plex 媒体服务器。

## 设置

请设置以下环境变量：
- `PLEX_SERVER`：您的 Plex 服务器地址（例如 `http://192.168.1.100:32400`）
- `PLEX_TOKEN`：您的 Plex 认证 Token（可在 plex.tv/claim 页面或 Plex 应用程序的 XML 配置中找到）

## 常用命令

### 获取服务器信息
```bash
curl -s "$PLEX_SERVER/?X-Plex-Token=$PLEX_TOKEN" -H "Accept: application/json"
```

### 浏览媒体库
```bash
curl -s "$PLEX_SERVER/library/sections?X-Plex-Token=$PLEX_TOKEN" -H "Accept: application/json"
```

### 列出媒体库内容
```bash
# Replace 1 with your library section key (from browse above)
curl -s "$PLEX_SERVER/library/sections/1/all?X-Plex-Token=$PLEX_TOKEN" -H "Accept: application/json"
```

### 搜索
```bash
curl -s "$PLEX_SERVER/search?query=SEARCH_TERM&X-Plex-Token=$PLEX_TOKEN" -H "Accept: application/json"
```

### 获取最近添加的媒体
```bash
curl -s "$PLEX_SERVER/library/recentlyAdded?X-Plex-Token=$PLEX_TOKEN" -H "Accept: application/json"
```

### 获取“On Deck”（继续观看）列表
```bash
curl -s "$PLEX_SERVER/library/onDeck?X-Plex-Token=$PLEX_TOKEN" -H "Accept: application/json"
```

### 获取活跃会话（当前正在播放的内容）
```bash
curl -s "$PLEX_SERVER/status/sessions?X-Plex-Token=$PLEX_TOKEN" -H "Accept: application/json"
```

### 列出可用客户端/播放器
```bash
curl -s "$PLEX_SERVER/clients?X-Plex-Token=$PLEX_TOKEN" -H "Accept: application/json"
```

## 媒体库分区类型

- 电影（通常为分区 1）
- 电视剧（通常为分区 2）
- 音乐
- 照片

## 注意事项

- 添加 `-H "Accept: application/json"` 参数可获得 JSON 格式输出（默认为 XML）
- 媒体库分区编号（1、2、3…）因服务器配置而异 —— 请先列出所有分区
- 媒体项的 key 形如 `/library/metadata/12345`
- 在设备上启动播放前，请务必确认操作
- 获取您的 Token 方法：访问 plex.tv → Account（账户）→ Authorized Devices（已授权设备）→ 点击 XML 链接