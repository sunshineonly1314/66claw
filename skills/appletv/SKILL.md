---
name: appletv
description: 通过 pyatv 库控制 Apple TV。
description_zh: 通过 pyatv 库控制 Apple TV。
---
文件：appletv\SKILL.md  
«CODE_N» 占位符数量：11  

请翻译以下内容（保留所有 «CODE_N» 占位符和 `...` 标记）：

---
name: appletv  
version: 1.0.0  
description: 通过 pyatv 控制 Apple TV。支持播放/暂停、导航、音量调节、应用启动、电源控制以及查看当前播放内容等功能。触发词包括：“Apple TV”、“TV”、“what's playing”（当前正在播放什么）、“pause TV”（暂停电视）、“play TV”（播放电视）、“turn off TV”（关闭电视）。  
license: MIT  
---

# Apple TV 控制

通过 pyatv 库控制 Apple TV。

## 要求

```bash
pipx install pyatv --python python3.11
```

> **Note:** pyatv requires Python ≤3.13. Python 3.14+ has breaking asyncio changes. Use `--python python3.11` or `python3.13` with pipx.

## 配置

配置文件位于 `~/clawd/config/appletv.json`：

```json
{
  "name": "Living Room",
  "id": "DEVICE_ID",
  "ip": "192.168.x.x",
  "credentials": {
    "companion": "...",
    "airplay": "..."
  }
}
```

### 首次配对

```bash
# Find your Apple TV
atvremote scan

# Pair Companion protocol (required)
atvremote --id <DEVICE_ID> --protocol companion pair

# Pair AirPlay protocol (for media)
atvremote --id <DEVICE_ID> --protocol airplay pair
```

将配对凭证保存至配置文件中。

## 快捷命令

### 状态与当前播放内容
```bash
scripts/appletv.py status     # Full status with now playing
scripts/appletv.py playing    # What's currently playing
```

### 播放控制
```bash
scripts/appletv.py play       # Play/resume
scripts/appletv.py pause      # Pause
scripts/appletv.py stop       # Stop
scripts/appletv.py next       # Next track/chapter
scripts/appletv.py prev       # Previous
```

### 导航
```bash
scripts/appletv.py up         # Navigate up
scripts/appletv.py down       # Navigate down
scripts/appletv.py left       # Navigate left
scripts/appletv.py right      # Navigate right
scripts/appletv.py select     # Press select/OK
scripts/appletv.py menu       # Menu button
scripts/appletv.py home       # Home screen
```

### 音量
```bash
scripts/appletv.py volume_up
scripts/appletv.py volume_down
```

### 电源
```bash
scripts/appletv.py turn_on    # Wake from sleep
scripts/appletv.py turn_off   # Put to sleep
scripts/appletv.py power      # Toggle
```

### 应用
```bash
scripts/appletv.py apps       # List installed apps
scripts/appletv.py app Netflix
scripts/appletv.py app YouTube
scripts/appletv.py app "Disney+"
```

### 设备发现
```bash
scripts/appletv.py scan       # Find Apple TVs on network
```

## 示例交互

- “电视上正在播放什么？” → `scripts/appletv.py status`  
- “暂停电视” → `scripts/appletv.py pause`  
- “关闭 Apple TV” → `scripts/appletv.py turn_off`  
- “在电视上打开 Netflix” → `scripts/appletv.py app Netflix`