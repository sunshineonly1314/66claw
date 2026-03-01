---
name: yt-api-cli
name_zh: YT API命令行
description: 通过命令行管理您的 YouTube 账户。完整的 YouTube Data API v3 命令行工具 —— 支持视频列表/搜索、上传、播放列表管理等。
description_zh: 通过命令行管理您的 YouTube 账户。完整的 YouTube Data API v3 命令行工具 —— 支持视频列表/搜索、上传、播放列表管理等。
metadata: {"clawdbot":{"emoji":"▶️","os":["darwin","linux"],"requires":{"env":["YT_API_AUTH_TYPE", "YT_API_CLIENT_ID", "YT_API_CLIENT_SECRET"]}}}
---
# yt-api-cli

在终端中管理您的 YouTube 账户。一款完整的 YouTube Data API v3 命令行工具（CLI）。

## 安装

```bash
# Using go install
go install github.com/nerveband/youtube-api-cli/cmd/yt-api@latest

# Or download from releases
curl -L -o yt-api https://github.com/nerveband/youtube-api-cli/releases/latest/download/yt-api-darwin-arm64
chmod +x yt-api
sudo mv yt-api /usr/local/bin/
```

## 配置

### 1. Google Cloud Console 配置

1. 访问 [Google Cloud Console](https://console.cloud.google.com)
2. 创建并启用 YouTube Data API v3
3. 创建 OAuth 2.0 凭据（桌面应用类型）
4. 下载客户端配置文件

### 2. 配置 yt-api

```bash
mkdir -p ~/.yt-api
cat > ~/.yt-api/config.yaml << EOF
default_auth: oauth
default_output: json
oauth:
  client_id: "YOUR_CLIENT_ID"
  client_secret: "YOUR_CLIENT_SECRET"
EOF
```

### 3. 认证

```bash
yt-api auth login  # Opens browser for Google login
yt-api auth status # Check auth state
```

## 命令

### 列表操作

```bash
# List your videos
yt-api list videos --mine

# List channel videos
yt-api list videos --channel-id UC_x5XG1OV2P6uZZ5FSM9Ttw

# List playlists
yt-api list playlists --mine

# List subscriptions
yt-api list subscriptions --mine
```

### 搜索

```bash
# Basic search
yt-api search --query "golang tutorial"

# With filters
yt-api search --query "music" --type video --duration medium --order viewCount
```

### 上传操作

```bash
# Upload video
yt-api upload video ./video.mp4 \
  --title "My Video" \
  --description "Description here" \
  --tags "tag1,tag2" \
  --privacy public

# Upload thumbnail
yt-api upload thumbnail ./thumb.jpg --video-id VIDEO_ID
```

### 播放列表管理

```bash
# Create playlist
yt-api insert playlist --title "My Playlist" --privacy private

# Add video to playlist
yt-api insert playlist-item --playlist-id PLxxx --video-id VIDxxx
```

### 频道操作

```bash
# Get channel info
yt-api list channels --id UCxxx --part snippet,statistics

# Update channel description
yt-api update channel --id UCxxx --description "New description"
```

## 输出格式

```bash
# JSON (default - LLM-friendly)
yt-api list videos --mine

# Table (human-readable)
yt-api list videos --mine -o table

# YAML
yt-api list videos --mine -o yaml

# CSV
yt-api list videos --mine -o csv > videos.csv
```

## 全局标志（Flags）

| 标志 | 缩写 | 描述 |
|------|------|------|
| `--output` | `-o` | 输出格式：json（默认）、yaml、csv、table |
| `--quiet` | `-q` | 抑制 stderr 输出信息 |
| `--config` | | 配置文件路径 |
| `--auth-type` | | 认证方式：oauth（默认）、service-account |

## 环境变量

| 变量 | 描述 |
|------|------|
| `YT_API_AUTH_TYPE` | 认证方式：oauth 或 service-account |
| `YT_API_OUTPUT` | 默认输出格式 |
| `YT_API_CLIENT_ID` | OAuth 客户端 ID |
| `YT_API_CLIENT_SECRET` | OAuth 客户端密钥 |
| `YT_API_CREDENTIALS` | 服务账号 JSON 文件路径 |

## 认证方式

### OAuth 2.0（默认）
适用于交互式场景及访问您自己的 YouTube 账户。

```bash
yt-api auth login  # Opens browser
```

### 服务账号（Service Account）
适用于服务端自动化任务。

```bash
yt-api --auth-type service-account --credentials ./key.json list videos
```

## 快速诊断命令

```bash
yt-api info                      # Full system state
yt-api info --test-connectivity  # Verify API access
yt-api info --test-permissions   # Check credential capabilities
yt-api auth status               # Authentication details
yt-api version                   # Version info
```

## 错误处理

退出码：
- `0` — 成功
- `1` — 通用错误
- `2` — 认证错误
- `3` — API 错误（配额不足、权限不足等）
- `4` — 输入错误

## 面向大语言模型（LLM）与自动化

- 默认输出 JSON 格式
- 结构化错误以 JSON 对象形式返回
- 支持 `--quiet` 模式以便解析
- `--dry-run` 可校验参数而无需实际执行
- 支持标准输入（stdin），可用于管道传输数据

## 注意事项

- 要求有效的 Google Cloud 凭据，且已启用 YouTube Data API v3
- OAuth token 存储于 `~/.yt-api/tokens.json`（权限为 0600）
- 默认输出为 JSON（针对 LLM 优化）
- 支持全部 YouTube Data API v3 资源

## 源码

GitHub：https://github.com/nerveband/youtube-api-cli