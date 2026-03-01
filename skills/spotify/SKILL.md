---
name: spotify
name_zh: Spotify
description: 在 macOS 上控制 Spotify 播放。支持播放/暂停、切歌、调节音量、播放艺人/专辑/歌单。当用户要求播放音乐、控制 Spotify、切换歌曲或调整 Spotify 音量时使用。
description_zh: 在 macOS 上控制 Spotify 播放。支持播放/暂停、切歌、调节音量、播放艺人/专辑/歌单。当用户要求播放音乐、控制 Spotify、切换歌曲或调整 Spotify 音量时使用。
metadata: {"clawdbot":{"emoji":"🎵","requires":{"bins":["spotify"],"os":"darwin"},"install":[{"id":"brew","kind":"brew","packages":["shpotify"],"bins":["spotify"],"label":"安装 spotify CLI（brew）"}]}}
---
# Spotify CLI

在 macOS 上控制 Spotify，无需 API 密钥。

## 命令

```bash
spotify play                     # Resume
spotify pause                    # Pause/toggle
spotify next                     # Next track
spotify prev                     # Previous track
spotify stop                     # Stop

spotify vol up                   # +10%
spotify vol down                 # -10%
spotify vol 50                   # Set to 50%

spotify status                   # Current track info
```

## 按名称播放

1. 在网页中搜索 Spotify URL：`"Daft Punk" site:open.spotify.com`  
2. 从 URL 中提取 ID：`open.spotify.com/artist/4tZwfgrHOc3mvqYlEYSvVi` → ID 为 `4tZwfgrHOc3mvqYlEYSvVi`  
3. 使用 AppleScript 播放：

```bash
# Artist
osascript -e 'tell application "Spotify" to play track "spotify:artist:4tZwfgrHOc3mvqYlEYSvVi"'

# Album
osascript -e 'tell application "Spotify" to play track "spotify:album:4m2880jivSbbyEGAKfITCa"'

# Track
osascript -e 'tell application "Spotify" to play track "spotify:track:2KHRENHQzTIQ001nlP9Gdc"'
```

## 注意事项

- **仅限 macOS** — 依赖 AppleScript  
- Spotify 桌面客户端必须正在运行  
- 可通过 Spotify Connect 与 Sonos 协同工作  