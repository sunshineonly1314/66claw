---
name: spotify-cli
description: 一款面向树莓派（或任意 Linux 系统）的简易命令行工具，用于控制 Spotify 播放。
description_zh: 一款面向树莓派（或任意 Linux 系统）的简易命令行工具，用于控制 Spotify 播放。
---
# Spotify CLI

一款面向树莓派（或任意 Linux 系统）的简易命令行工具，用于控制 Spotify 播放。

## 要求

- Python 3  
- Spotify Premium 账户  
- `spotipy` Python 库  
- 在另一台设备（手机、电脑或网页播放器）上打开 Spotify 应用  

## 安装

### 1. 安装依赖项

```bash
pip3 install spotipy --break-system-packages
```

### 2. 创建 Spotify 开发者应用

1. 访问 https://developer.spotify.com/dashboard  
2. 登录后点击 “Create App”  
3. 将重定向 URI 设为 `http://127.0.0.1:8888/callback`  
4. 复制 **Client ID** 与 **Client Secret**  

### 3. 创建配置文件

```bash
mkdir -p ~/.config/spotify-cli
cat << EOF > ~/.config/spotify-cli/config
SPOTIPY_CLIENT_ID=your_client_id
SPOTIPY_CLIENT_SECRET=your_client_secret
SPOTIPY_REDIRECT_URI=http://127.0.0.1:8888/callback
EOF
```

脚本会自动从 `~/.config/spotify-cli/config` 加载凭据。

### 4. 安装脚本

```bash
sudo cp spotify /usr/local/bin/spotify
sudo chmod +x /usr/local/bin/spotify
```

### 5. 认证授权

运行任意命令（例如 `spotify status`）。首次运行时，您将获得一个需在浏览器中打开的 URL。完成授权后，复制重定向 URL（即使页面未加载成功），并在提示时粘贴。

## 命令

| 命令 | 描述 |
|---------|------|
| `spotify search <query>` | 搜索歌曲（显示前 5 条结果） |
| `spotify play <song>` | 搜索并播放歌曲 |
| `spotify pause` | 暂停播放 |
| `spotify resume` | 恢复播放 |
| `spotify next` | 跳至下一首 |
| `spotify prev` | 上一首 |
| `spotify status` | 显示当前播放曲目 |
| `spotify devices` | 列出可用的 Spotify 设备 |

## 示例

```bash
# Search for a song
spotify search "stairway to heaven"

# Play a song (tip: include artist for better results)
spotify play "stairway to heaven led zeppelin"

# Check what's playing
spotify status

# Control playback
spotify pause
spotify resume
spotify next
```

## 最佳实践（面向 AI agents）

代表用户使用本工具时，请遵循：

1. **始终先搜索再播放**。使用 `spotify search "query"` 查看结果。  
2. **确认匹配度** — 向用户核实搜索结果是否符合其预期。  
3. **随后播放** — 确认无误后，使用 `spotify play "exact song name artist"` 并传入搜索结果中正确的标题/艺人信息。  

此举可避免因 Spotify 模糊匹配机制而播放错误歌曲。

**典型工作流：**  
```bash
# User asks: "play voice actor u projected 2"

# Step 1: Search first
spotify search "voice actor u projected 2"
# Results show: "U Projected 2 - Voice Actor, Yarrow.co"

# Step 2: Confirm with user that this is the right song

# Step 3: Play with exact match
spotify play "U Projected 2 Voice Actor"
```

## 注意事项

- 本 CLI 控制的是现有 Spotify 会话的播放行为。您需在另一台设备（手机、电脑或 https://open.spotify.com）上打开 Spotify。  
- CLI 向该设备发送指令 — 音频将在该设备播放，而非树莓派本身。  
- 需要 Spotify Premium 账户方可控制播放。

## 故障排查

### “未找到活跃设备”
请在手机/电脑上打开 Spotify 并播放任意内容，然后重试。

### “未找到设备”
请确保至少一台设备上已打开 Spotify，并登录了同一账户。

### 认证令牌已过期
删除 `~/.cache-*` 文件并重新完成认证。