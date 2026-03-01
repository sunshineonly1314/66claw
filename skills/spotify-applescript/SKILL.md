---
name: spotify-applescript
name_zh: Spotify AppleScript
description: 通过 AppleScript 控制 Spotify 桌面客户端。支持播放歌单、音轨、专辑、播客剧集，并管理播放状态。在 macOS 上与 Spotify 桌面客户端稳定协作，无需 API 密钥或 OAuth 授权。
description_zh: 通过 AppleScript 控制 Spotify 桌面客户端。支持播放歌单、音轨、专辑、播客剧集，并管理播放状态。在 macOS 上与 Spotify 桌面客户端稳定协作，无需 API 密钥或 OAuth 授权。
homepage: https://github.com/andrewjiang/HoloClawd-Open-Firmware
metadata: {"clawdbot":{"emoji":"🎵","os":["darwin"]}}
triggers:
  - spotify
  - play music
  - play playlist
  - play episode
  - pause music
  - next track
  - previous track
---
# Spotify AppleScript 控制

使用 AppleScript 控制 Spotify 桌面客户端。在 macOS 上与 Spotify 桌面客户端稳定协作，不受 API 调用频率限制，亦无需 OAuth 授权。

## 要求

- macOS 上已安装并正在运行 Spotify 桌面客户端  
- 无需额外配置 — 开箱即用  

## 快速入门

```bash
# Play a playlist
spotify play "spotify:playlist:665eC1myDA8iSepZ0HOZdG"
spotify play "https://open.spotify.com/playlist/665eC1myDA8iSepZ0HOZdG"

# Play an episode
spotify play "spotify:episode:5yJKH11UlF3sS3gcKKaUYx"
spotify play "https://open.spotify.com/episode/5yJKH11UlF3sS3gcKKaUYx"

# Play a track
spotify play "spotify:track:7hQJA50XrCWABAu5v6QZ4i"

# Playback control
spotify pause          # Toggle play/pause
spotify next           # Next track
spotify prev           # Previous track
spotify status         # Current track info

# Volume control
spotify volume 50      # Set volume (0-100)
spotify mute           # Mute
spotify unmute         # Unmute
```

## Spotify CLI 封装器

`spotify` 命令是位于 `{baseDir}/spotify.sh` 的封装脚本  

### 命令

| 命令 | 描述 | 示例 |
|---------|------|------|
| `play <uri>` | 播放音轨/专辑/歌单/播客剧集 | `spotify play spotify:track:xxx` |
| `pause` | 切换播放/暂停 | `spotify pause` |
| `next` | 下一首 | `spotify next` |
| `prev` | 上一首 | `spotify prev` |
| `status` | 显示当前音轨信息 | `spotify status` |
| `volume <0-100>` | 设置音量 | `spotify volume 75` |
| `mute` | 静音 | `spotify mute` |
| `unmute` | 取消静音 | `spotify unmute` |

### URI 格式

同时支持 Spotify URI 和 open.spotify.com 网页链接：

- `spotify:track:7hQJA50XrCWABAu5v6QZ4i`  
- `https://open.spotify.com/track/7hQJA50XrCWABAu5v6QZ4i`  
- `spotify:playlist:665eC1myDA8iSepZ0HOZdG`  
- `https://open.spotify.com/playlist/665eC1myDA8iSepZ0HOZdG?si=xxx`  
- `spotify:episode:5yJKH11UlF3sS3gcKKaUYx`  
- `https://open.spotify.com/episode/5yJKH11UlF3sS3gcKKaUYx`  
- `spotify:album:xxx`  
- `spotify:artist:xxx`  

脚本会自动将网页链接转换为 URI。

## 直接 AppleScript 命令

如需更高控制精度，可直接调用 AppleScript：

```bash
# Play
osascript -e 'tell application "Spotify" to play track "spotify:playlist:xxx"'

# Pause/Play toggle
osascript -e 'tell application "Spotify" to playpause'

# Next/Previous
osascript -e 'tell application "Spotify" to next track'
osascript -e 'tell application "Spotify" to previous track'

# Get current track
osascript -e 'tell application "Spotify"
  set trackName to name of current track
  set artistName to artist of current track
  return trackName & " by " & artistName
end tell'

# Get player state
osascript -e 'tell application "Spotify" to player state'

# Set volume (0-100)
osascript -e 'tell application "Spotify" to set sound volume to 75'

# Get current position (in seconds)
osascript -e 'tell application "Spotify" to player position'

# Set position (in seconds)
osascript -e 'tell application "Spotify" to set player position to 30'
```

## 可用属性

```applescript
tell application "Spotify"
  name of current track          -- Track name
  artist of current track        -- Artist name
  album of current track         -- Album name
  duration of current track      -- Duration in ms
  player position                -- Position in seconds
  player state                   -- playing/paused/stopped
  sound volume                   -- 0-100
  repeating                      -- true/false
  repeating enabled              -- true/false
  shuffling                      -- true/false
  shuffling enabled              -- true/false
end tell
```

## 示例

### Agent 使用场景

当用户说：  
- “播放我的 Power Hour 歌单” → 提取歌单 URI 并运行 `spotify play <uri>`  
- “暂停音乐” → 运行 `spotify pause`  
- “下一首” → 运行 `spotify next`  
- “正在播放什么？” → 运行 `spotify status`  

### 播放特定播客剧集

```bash
spotify play https://open.spotify.com/episode/5yJKH11UlF3sS3gcKKaUYx
```

### 获取完整音轨信息

```bash
osascript -e 'tell application "Spotify"
  return "Track: " & (name of current track) & "\nArtist: " & (artist of current track) & "\nAlbum: " & (album of current track) & "\nState: " & (player state as string)
end tell'
```

## 安装

本 skill 自包含。如需使 `spotify` 命令全局可用：

```bash
chmod +x {baseDir}/spotify.sh
sudo ln -sf {baseDir}/spotify.sh /usr/local/bin/spotify
```

或把该 skill 所在目录加入 PATH。

## 故障排查

**“Spotify 发生错误”**  
- 确保 Spotify 桌面客户端正在运行  
- Spotify 必须至少启动过一次，才能接受 AppleScript 命令  

**“播放命令无响应”**  
- 验证 URI 格式是否正确  
- 先尝试在 Spotify 应用内播放该内容，确保其存在  

**“无声音输出”**  
- 检查系统音量与 Spotify 应用音量  
- 确认 Spotify 偏好设置中已选择正确的输出设备  

## 局限性

- 要求 Spotify 桌面客户端处于运行状态  
- 仅限 macOS（依赖 AppleScript）  
- 不支持搜索或浏览资料库（请使用网页界面或应用进行内容发现）  
- 不支持歌单管理（添加/移除音轨）  

如需歌单管理与搜索功能，请使用网页界面，或考虑 `spotify-player` skill（需完成 OAuth 配置）。  