---
name: yt-dlp-downloader
name_zh: yt-dlp下载器
description: 使用 yt-dlp 从 YouTube、Bilibili、Twitter 及数千个其他网站下载视频。当用户提供视频 URL 并希望下载视频、提取音频（MP3）、下载字幕，或选择视频画质时使用。触发短语包括：“下载视频”、“download video”、“yt-dlp”、“YouTube”、“B站”、“抖音”、“提取音频”、“extract audio”。
description_zh: 使用 yt-dlp 从 YouTube、Bilibili、Twitter 及数千个其他网站下载视频。当用户提供视频 URL 并希望下载视频、提取音频（MP3）、下载字幕，或选择视频画质时使用。触发短语包括：“下载视频”、“download video”、“yt-dlp”、“YouTube”、“B站”、“抖音”、“提取音频”、“extract audio”。
---
# yt-dlp 视频下载器

使用 yt-dlp 从数千个网站下载视频。

## 前置依赖

下载前，请确认以下依赖已安装：

```bash
# Check yt-dlp
which yt-dlp || echo "yt-dlp not installed. Install with: pip install yt-dlp"

# Check ffmpeg (required for audio extraction and format merging)
which ffmpeg || echo "ffmpeg not installed. Install with: brew install ffmpeg"
```

若尚未安装，请先执行：
```bash
pip install yt-dlp
brew install ffmpeg  # macOS
```

## 快速开始

### 基础下载（最高画质）

```bash
yt-dlp -P "~/Downloads/yt-dlp" "VIDEO_URL"
```

### YouTube 下载（推荐 — 含浏览器 Cookie）

YouTube 常因 403 错误阻止直接下载。请始终为 YouTube 下载提供浏览器 Cookie：

```bash
yt-dlp -P "~/Downloads/yt-dlp" --cookies-from-browser chrome "YOUTUBE_URL"
```

支持的浏览器：`chrome`、`firefox`、`safari`、`edge`、`brave`、`opera`

### 自定义输出路径下载

```bash
yt-dlp -P "/path/to/save" -o "%(title)s.%(ext)s" "VIDEO_URL"
```

## 常见任务

### 1. 下载视频（默认 — 最高画质）

```bash
yt-dlp -P "~/Downloads/yt-dlp" "VIDEO_URL"
```

### 2. 仅提取音频（MP3）

```bash
yt-dlp -P "~/Downloads/yt-dlp" -x --audio-format mp3 "VIDEO_URL"
```

### 3. 下载带字幕的视频

```bash
yt-dlp -P "~/Downloads/yt-dlp" --write-subs --sub-langs all "VIDEO_URL"
```

### 4. 指定画质下载

**720p：**
```bash
yt-dlp -P "~/Downloads/yt-dlp" -f "bestvideo[height<=720]+bestaudio/best[height<=720]" "VIDEO_URL"
```

**1080p：**
```bash
yt-dlp -P "~/Downloads/yt-dlp" -f "bestvideo[height<=1080]+bestaudio/best[height<=1080]" "VIDEO_URL"
```

**最佳可用画质：**
```bash
yt-dlp -P "~/Downloads/yt-dlp" -f "bestvideo+bestaudio/best" "VIDEO_URL"
```

### 5. 列出可用格式（下载前）

```bash
yt-dlp -F "VIDEO_URL"
```

然后按 ID 下载指定格式：
```bash
yt-dlp -P "~/Downloads/yt-dlp" -f FORMAT_ID "VIDEO_URL"
```

### 6. 下载播放列表

```bash
# Download entire playlist
yt-dlp -P "~/Downloads/yt-dlp" -o "%(playlist)s/%(playlist_index)s - %(title)s.%(ext)s" "PLAYLIST_URL"

# Download specific range (e.g., items 1-5)
yt-dlp -P "~/Downloads/yt-dlp" -I 1:5 "PLAYLIST_URL"
```

### 7. 下载带缩略图的视频

```bash
yt-dlp -P "~/Downloads/yt-dlp" --write-thumbnail "VIDEO_URL"
```

## 工作流程

当用户提供视频 URL 时：

1. **识别平台**：
   - YouTube / YouTube Music → **务必使用 `--cookies-from-browser chrome`**
   - 其他网站 → 首先尝试不带 Cookie 的方式

2. **询问用户需求**（若未明确说明）：
   - 仅下载视频？
   - 仅提取音频？
   - 是否需要字幕？
   - 是否有特定画质要求？

3. **根据需求构造命令**

4. **使用 Shell 工具配合 `required_permissions: ["all", "network"]` 执行下载**

5. **错误处理**：
   - HTTP 403 Forbidden → 使用 `--cookies-from-browser` 重试
   - 连接问题 → yt-dlp 支持断点续传，直接重试即可
   - 格式不可用 → 使用 `-F` 列出所有格式，再手动选择

6. **报告结果** —— 返回文件保存路径及任何错误信息

## 示例交互

用户：“帮我下载这个视频 https://www.youtube.com/watch?v=xxx”

响应：
```bash
# YouTube - use cookies to avoid 403 errors
yt-dlp -P "~/Downloads/yt-dlp" --cookies-from-browser chrome "https://www.youtube.com/watch?v=xxx"
```

用户：“下载这个视频的音频 https://www.bilibili.com/video/xxx”

响应：
```bash
# Bilibili - extracting audio as MP3
yt-dlp -P "~/Downloads/yt-dlp" -x --audio-format mp3 "https://www.bilibili.com/video/xxx"
```

用户：“下载这个 Twitter 视频 https://twitter.com/xxx/status/123”

响应：
```bash
# Twitter/X - direct download usually works
yt-dlp -P "~/Downloads/yt-dlp" "https://twitter.com/xxx/status/123"
```

## 支持的网站

yt-dlp 支持数千个网站，包括：
- YouTube、YouTube Music
- Bilibili（B站）
- Twitter/X
- TikTok、Douyin（抖音）
- Vimeo
- Twitch
- 以及其他更多网站……

完整列表：https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md

## 故障排查

### 常见错误及解决方案

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| HTTP 403 Forbidden | YouTube 拒绝未经身份验证的请求 | 使用 `--cookies-from-browser chrome` |
| 视频不可用 | 地理限制或私有视频 | 使用 Cookie 或 VPN |
| 下载中断 | 网络问题 | 重试 — yt-dlp 支持自动续传 |
| 格式不可用 | 请求的格式不存在 | 使用 `-F` 列出可用格式 |

### 错误：“yt-dlp: command not found”
```bash
pip install yt-dlp
```

### 错误：“ffmpeg not found”（音频提取时）
```bash
brew install ffmpeg  # macOS
```

### 错误：HTTP 403 Forbidden（YouTube）

这是 YouTube 最常见的错误。**请始终为 YouTube 下载提供 Cookie：**

```bash
# Recommended approach for YouTube
yt-dlp -P "~/Downloads/yt-dlp" --cookies-from-browser chrome "YOUTUBE_URL"
```

支持的浏览器：`chrome`、`firefox`、`safari`、`edge`、`brave`、`opera`

### 错误：视频不可用或受地理限制
```bash
# Try with cookies from browser
yt-dlp --cookies-from-browser chrome "VIDEO_URL"

# Or use a specific format
yt-dlp -F "VIDEO_URL"  # List formats first
yt-dlp -f FORMAT_ID "VIDEO_URL"
```

### 错误：下载持续失败
```bash
# Update yt-dlp to latest version
pip install -U yt-dlp

# Force IPv4 (sometimes helps with connection issues)
yt-dlp -4 "VIDEO_URL"
```

### 最佳实践

1. **YouTube 下载**：始终使用 `--cookies-from-browser chrome`
2. **大文件下载**：yt-dlp 支持断点续传，中断后重试即可
3. **保持 yt-dlp 更新**：`pip install -U yt-dlp`
4. **不确定时先查格式**：下载前使用 `-F` 查看可用格式