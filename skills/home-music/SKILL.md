---
name: home-music
name_zh: 家庭音乐
description: 结合 Spotify 播放与 Airfoil 扬声器路由，控制全屋音乐场景。提供晨间、派对、放松等快捷预设模式。
description_zh: 结合 Spotify 播放与 Airfoil 扬声器路由，控制全屋音乐场景。提供晨间、派对、放松等快捷预设模式。
homepage: local
metadata: {"clawdbot":{"emoji":"🏠","os":["darwin"]}}
triggers:
  - music scene
  - morning music
  - party mode
  - chill music
  - house music
  - stop music
---
```
    ♪ ♫ ♪ ♫ ♪ ♫ ♪ ♫ ♪ ♫ ♪ ♫ ♪ ♫ ♪ ♫ ♪ ♫ ♪ ♫
    
    🏠  H O M E   M U S I C  🎵
    
    ╔══════════════════════════════════════════╗
    ║   Whole-House Music Scenes               ║
    ║   One command. All speakers. Perfect.    ║
    ╚══════════════════════════════════════════╝
    
    ♪ ♫ ♪ ♫ ♪ ♫ ♪ ♫ ♪ ♫ ♪ ♫ ♪ ♫ ♪ ♫ ♪ ♫ ♪ ♫
```

> *"Why click 17 times when one command does the job?"* – Owen 🐸

---

## 🎯 此 skill 的作用是什么？

**Home Music** 将 Spotify 与 Airfoil 结合，打造神奇的音乐场景。只需一条指令，即可让正确的歌单，在正确的扬声器上，以恰到好处的音量播放。

**设想如下：**
- 你醒来 → `home-music morning` → 浴室中响起轻柔旋律  
- 朋友到来 → `home-music party` → 所有扬声器齐奏摇滚乐  
- 是时候放松了 → `home-music chill` → 客厅、卧室处处弥漫慵懒氛围  
- 今日任务结束 → `home-music off` → 归于寂静。安宁。祥和。

---

## 📋 依赖项

| 项目 | 原因 | 链接 |
|------|------|------|
| 🍏 **macOS** | 本 skill 使用 AppleScript | — |
| 🟢 **Spotify 桌面应用** | 音乐来源！必须处于运行状态。 | [spotify.com](https://spotify.com) |
| 📡 **Airfoil** | 将音频路由至 AirPlay 扬声器 | [rogueamoeba.com](https://rogueamoeba.com/airfoil/) |
| 🎵 **spotify-applescript** | Clawdbot 中用于控制 Spotify 的 skill | `skills/spotify-applescript/` |

> ⚠️ **Important:** Both Spotify and Airfoil must be running before you start any scenes!

---

## 🎬 场景

### 🌅 晨间模式  
*开启你一天的温柔序曲*

```bash
home-music morning
```
- **扬声器：** Sonos Move  
- **音量：** 40%  
- **歌单：** Morning Playlist（晨间歌单）  
- **氛围：** ☕ 咖啡 + 美好心情  

---

### 🎉 派对模式  
*是时候庆祝啦！*

```bash
home-music party
```
- **扬声器：** 全部（计算机、MacBook、Sonos Move、客厅电视）  
- **音量：** 70%  
- **歌单：** Rock Party Mix（摇滚派对混音）  
- **氛围：** 🤘 邻居们最讨厌这个小技巧  

---

### 😌 放松模式  
*纯粹的放松体验*

```bash
home-music chill
```
- **扬声器：** Sonos Move  
- **音量：** 30%  
- **歌单：** Chill Lounge（慵懒客厅）  
- **氛围：** 🧘 Om……  

---

### 🔇 关闭模式  
*归于寂静*

```bash
home-music off
```
- 暂停 Spotify 播放  
- 断开所有扬声器连接  
- **氛围：** 🤫 终于，宁静与安详  

---

### 📊 状态查询  
*当前正在播放什么？*

```bash
home-music status
```

显示内容包括：
- 当前 Spotify 歌曲  
- 已连接的扬声器  

---

## 🔧 安装

```bash
# Make the script executable
chmod +x ~/clawd/skills/home-music/home-music.sh

# Symlink for global access
sudo ln -sf ~/clawd/skills/home-music/home-music.sh /usr/local/bin/home-music
```

现在，`home-music` 可在终端任意位置直接运行！🎉

---

## 🎨 自定义歌单与场景

### 更换歌单

打开 `home-music.sh` 并查找歌单配置部分：

```bash
# === PLAYLIST CONFIGURATION ===
PLAYLIST_MORNING="spotify:playlist:19n65kQ5NEKgkvSAla5IF6"
PLAYLIST_PARTY="spotify:playlist:37i9dQZF1DXaXB8fQg7xif"
PLAYLIST_CHILL="spotify:playlist:37i9dQZF1DWTwnEm1IYyoj"
```

**如何获取歌单 URI：**  
1. 在 Spotify 中右键点击目标歌单  
2. “分享” → “复制 Spotify URI”  
3. 或复制网页 URL，并提取其中的 `/playlist/` 部分  

### 添加新场景

在 `main` 区块中新增一个 case 分支：

```bash
# In home-music.sh after the "scene_chill" function:

scene_workout() {
    echo "💪 Starting Workout scene..."
    airfoil_set_source_spotify
    airfoil_connect "Sonos Move"
    sleep 0.5
    airfoil_volume "Sonos Move" 0.8
    "$SPOTIFY_CMD" play "spotify:playlist:YOUR_WORKOUT_PLAYLIST"
    "$SPOTIFY_CMD" volume 100
    echo "✅ Workout: Sonos Move @ 80%, Pump it up!"
}

# And in the case block:
    workout)
        scene_workout
        ;;
```

### 可用扬声器列表

```bash
ALL_SPEAKERS=("Computer" "Andy's M5 Macbook" "Sonos Move" "Living Room TV")
```

你可以添加任意 AirPlay 扬声器——只要它在 Airfoil 中可见即可。

---

## 🐛 故障排查

### ❌ “扬声器无法连接”

**检查 1：** Airfoil 是否正在运行？  
```bash
pgrep -x Airfoil || echo "Airfoil is not running!"
```

**检查 2：** 扬声器是否已接入网络？  
- 打开 Airfoil 应用  
- 查看扬声器是否出现在设备列表中  
- 尝试手动连接  

**检查 3：** 扬声器名称是否完全一致？  
- 扬声器名称区分大小写！  
- 打开 Airfoil 并复制其精确名称  

---

### ❌ “无声”

**检查 1：** Spotify 是否正在播放？  
```bash
~/clawd/skills/spotify-applescript/spotify.sh status
```

**检查 2：** Airfoil 的音频源是否正确？  
- 打开 Airfoil  
- 检查“Spotify”是否被选为音频源  
- 若未选中：点击“Source（源）”→ 选择 Spotify  

**检查 3：** 扬声器音量是否过低？  
```bash
# Manually check volume
osascript -e 'tell application "Airfoil" to get volume of (first speaker whose name is "Sonos Move")'
```

---

### ❌ “Spotify 无法启动”

**Spotify 是否已打开？**  
```bash
pgrep -x Spotify || open -a Spotify
```

**spotify-applescript 是否已安装？**  
```bash
ls ~/clawd/skills/spotify-applescript/spotify.sh
```

---

### ❌ “权限被拒绝”

```bash
chmod +x ~/clawd/skills/home-music/home-music.sh
```

---

## 🔊 直接调用 Airfoil 命令

如需手动控制 Airfoil：

```bash
# Connect a speaker
osascript -e 'tell application "Airfoil" to connect to (first speaker whose name is "Sonos Move")'

# Set speaker volume (0.0 - 1.0)
osascript -e 'tell application "Airfoil" to set (volume of (first speaker whose name is "Sonos Move")) to 0.5'

# Disconnect a speaker
osascript -e 'tell application "Airfoil" to disconnect from (first speaker whose name is "Sonos Move")'

# List connected speakers
osascript -e 'tell application "Airfoil" to get name of every speaker whose connected is true'

# Set audio source
osascript -e 'tell application "Airfoil"
    set theSource to (first application source whose name contains "Spotify")
    set current audio source to theSource
end tell'
```

---

## 📁 文件

```
skills/home-music/
├── SKILL.md        # This documentation
└── home-music.sh   # The main script
```

---

## 💡 专业提示

1. **设置别名**，实现更快访问：  
   ```bash
   alias mm="home-music morning"
   alias mp="home-music party"
   alias mc="home-music chill"
   alias mo="home-music off"
   ```

2. **与 Clawdbot 配合使用：**  
   > "Hey, start party mode"  
   > "Put on some chill music"  
   > "Stop the music"

3. **组合场景：** 创建一个 `dinner` 场景，配以爵士乐歌单、音量设为 25%——完美适配宾客来访！

---

## 🐸 致谢

```
╭─────────────────────────────────────────────╮
│                                             │
│   Crafted with 💚 by Owen the Frog 🐸      │
│                                             │
│   "Ribbit. Music makes everything better."  │
│                                             │
╰─────────────────────────────────────────────╯
```

**作者：** Andy Steinberger（并感谢他的 Clawdbot 助手——青蛙 Owen 🐸）  
**版本：** 1.0.0  
**许可证：** MIT  
**栖息地：** 那个长满睡莲的池塘 🪷

---

*这个 skill 是否改善了你的生活？Owen 很喜欢苍蝇哦。🪰*