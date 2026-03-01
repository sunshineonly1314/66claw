---
name: chromecast
name_zh: Chromecast控制
description: 控制本地网络中的 Chromecast 设备 —— 发现设备、投屏媒体、控制播放、管理队列，以及保存/恢复状态
description_zh: 控制本地网络中的 Chromecast 设备 —— 发现设备、投屏媒体、控制播放、管理队列，以及保存/恢复状态
homepage: https://github.com/skorokithakis/catt
metadata: {"clawdbot":{"emoji":"📺","requires":{"bins":["catt"]},"install":[{"id":"pip","kind":"uv","package":"catt","bins":["catt"],"label":"通过 pip/uv 安装"}]}}
---
# Chromecast 控制

使用 `catt`（Cast All The Things）控制本地网络中的 Chromecast 及 Google Cast 兼容设备。

## 快速参考（Quick Reference）

| 命令 | 描述 |  
|------|------|  
| `catt scan` | 查找网络中所有 Chromecast 设备 |  
| `catt cast <url>` | 投屏视频/音频 |  
| `catt pause` / `play` | 暂停/恢复播放 |  
| `catt stop` | 停止播放 |  
| `catt status` | 查看当前播放信息 |  
| `catt volume <0-100>` | 设置音量 |  

使用 `-d <device>` 按设备名称或 IP 地址指定目标设备。

## 发现与设备管理（Discovery & Device Management）

```bash
# Find all devices
catt scan

# Set a default device (saves to config)
catt -d "Living Room TV" set_default

# Create an alias for easier access
catt -d 192.168.1.163 set_alias tv

# Remove alias or default
catt -d tv del_alias
catt del_default
```

## 媒体投屏（Casting Media）

### 基础投屏（Basic Casting）  
```bash
# Cast from URL (YouTube, Vimeo, and hundreds of yt-dlp supported sites)
catt cast "https://www.youtube.com/watch?v=VIDEO_ID"

# Cast local file
catt cast ./video.mp4

# Cast a website (displays webpage on TV)
catt cast_site "https://example.com"
```

### 高级投屏选项（Advanced Cast Options）  
```bash
# Cast with subtitles
catt cast -s ./subtitles.srt ./video.mp4

# Start at specific timestamp
catt cast -t 01:30:00 "https://youtube.com/watch?v=VIDEO_ID"

# Play random item from playlist
catt cast -r "https://youtube.com/playlist?list=PLAYLIST_ID"

# Play only video (ignore playlist in URL)
catt cast -n "https://youtube.com/watch?v=VIDEO_ID&list=PLAYLIST_ID"

# Disable automatic subtitle loading
catt cast --no-subs ./video.mp4

# Pass yt-dlp options (e.g., select format)
catt cast -y format=best "https://youtube.com/watch?v=VIDEO_ID"

# Block until playback ends (useful for scripts)
catt cast -b "https://example.com/video.mp4"
```

## 播放控制（Playback Control）

```bash
catt play              # Resume playback
catt pause             # Pause playback
catt play_toggle       # Toggle play/pause
catt stop              # Stop playback completely
catt skip              # Skip to end of content

# Seeking
catt seek 300          # Jump to 5 minutes (seconds)
catt seek 01:30:00     # Jump to 1h 30m (HH:MM:SS)
catt ffwd 30           # Fast forward 30 seconds
catt rewind 30         # Rewind 30 seconds
```

## 音量控制（Volume Control）

```bash
catt volume 50         # Set volume to 50%
catt volumeup 10       # Increase by 10
catt volumedown 10     # Decrease by 10
catt volumemute on     # Mute
catt volumemute off    # Unmute
```

## 队列管理（YouTube）（Queue Management (YouTube)）

```bash
# Add video to end of queue
catt add "https://youtube.com/watch?v=VIDEO_ID"

# Add video to play next
catt add -n "https://youtube.com/watch?v=VIDEO_ID"

# Remove video from queue
catt remove "https://youtube.com/watch?v=VIDEO_ID"

# Clear entire queue
catt clear
```

## 状态管理（State Management）

```bash
# Save current state (position, volume, what's playing)
catt save

# Restore saved state later
catt restore
```

## 设备信息（Device Information）

```bash
catt status    # Brief: time, volume, mute status
catt info      # Full: title, URL, player state, media type, etc.
```

## 配置（Configuration）

配置文件路径：`~/.config/catt/catt.cfg`

```ini
[options]
device = Living Room TV

[aliases]
tv = Living Room TV
bedroom = Bedroom Speaker
```

## 网络要求（Network Requirements）

- Chromecast 与计算机需处于同一网络  
- 本地文件投屏时：TCP 端口 45000–47000 必须开放  
- 某些网络屏蔽 mDNS —— 若 `catt scan` 失败，请直接使用 IP 地址  

## 支持的资源来源（Supported Sources）

Catt 内部使用 yt-dlp，支持：  
- YouTube（视频、播放列表、直播）  
- Vimeo、Dailymotion、Twitch  
- 直接视频 URL（MP4、MKV、WebM 等）  
- 本地文件（视频、音频、图片）  
- 数百个其他网站（参见 yt-dlp 支持站点列表）  