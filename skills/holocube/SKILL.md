---
name: holocube
name_zh: Holocube
description: 使用 HoloClawd 固件控制 GeekMagic HelloCubic-Lite 全息立方体显示器。支持绘图 API、带龙虾吉祥物的番茄钟计时器、GIF 上传及程序化动画。
description_zh: 使用 HoloClawd 固件控制 GeekMagic HelloCubic-Lite 全息立方体显示器。支持绘图 API、带龙虾吉祥物的番茄钟计时器、GIF 上传及程序化动画。
homepage: https://github.com/andrewjiang/HoloClawd-Open-Firmware
metadata: {"clawdbot":{"emoji":"🦞","os":["darwin","linux"]}}
triggers:
  - holocube
  - holo cube
  - holoclawd
  - cubic
  - geekmagic
  - display gif
  - cube animation
  - pomodoro
  - lobster timer
  - water tracker
  - hydration
  - drink water
---
# HoloCube 控制器

通过 REST API 控制搭载 HoloClawd 固件的 GeekMagic HelloCubic-Lite。

**固件：** https://github.com/andrewjiang/HoloClawd-Open-Firmware

## 设备信息

- **型号：** 搭载 HoloClawd 固件的 HelloCubic-Lite  
- **显示屏：** 240×240 像素 ST7789 TFT  
- **默认 IP 地址：** 192.168.7.80（可配置）

## 快速入门

**番茄钟计时器**（Andrew 的本地版本，集成 Spotify）：

```bash
# Run pomodoro timer with lobster mascot (25 min work, 5 min break)
# Uses hardcoded Spotify URIs for focus/break music
cd ~/Bao/clawd && uv run --script pomodoro.py

# With custom task label (max 20 chars)
cd ~/Bao/clawd && uv run --script pomodoro.py --task "BUILD NETWORK"

# Custom timings
cd ~/Bao/clawd && uv run --script pomodoro.py --work 50 --short 10 --long 20

# Disable Spotify
cd ~/Bao/clawd && uv run --script pomodoro.py --no-spotify
```

**绘图 API**（需从代码仓库获取 holocube_client.py）：

```bash
# Draw something on the display
python3 -c "
from holocube_client import HoloCube, Color, draw_lobster
cube = HoloCube('192.168.7.80')
cube.clear(Color.BLACK)
draw_lobster(cube, 120, 120)  # Draw lobster in center
"
```

## Python 客户端库

`holocube_client.py` 模块提供完整的编程式控制能力：

```python
from holocube_client import HoloCube, Color, draw_lobster, draw_confetti

cube = HoloCube("192.168.7.80")

# Drawing primitives
cube.clear("#000000")                              # Clear screen
cube.pixel(x, y, color)                            # Single pixel
cube.line(x0, y0, x1, y1, color)                   # Line
cube.rect(x, y, w, h, color, fill=True)            # Rectangle
cube.circle(x, y, r, color, fill=True)             # Circle
cube.triangle(x0, y0, x1, y1, x2, y2, color)       # Triangle
cube.ellipse(x, y, rx, ry, color, fill=True)       # Ellipse
cube.roundrect(x, y, w, h, r, color, fill=True)    # Rounded rectangle
cube.text(x, y, "Hello", size=3, color="#00ffff")  # Text

# High-level helpers
cube.centered_text(y, "Centered", size=2)
cube.show_message(["Line 1", "Line 2"], colors=[Color.CYAN, Color.WHITE])
cube.show_timer(seconds, label="FOCUS")
cube.show_progress(0.75, label="Loading")

# Lobster mascot
draw_lobster(cube, 120, 120)                       # Normal lobster
draw_lobster(cube, 120, 120, happy=True, frame=0)  # Party mode with confetti
draw_confetti(cube, 120, 120, frame=1)             # Animate confetti
```

## 番茄钟计时器

功能完备的番茄钟计时器，配有可爱的龙虾伙伴。**请使用 Andrew 的本地版本**，地址为 `~/Bao/clawd/pomodoro.py`：

```bash
# Always run from local directory
cd ~/Bao/clawd

# Default: 25 min work, 5 min break (with Spotify)
uv run --script pomodoro.py

# With custom task label
uv run --script pomodoro.py --task "CODE REVIEW"
uv run --script pomodoro.py -t "BUILD NETWORK"

# Custom timings
uv run --script pomodoro.py --work 50 --short 10 --long 20

# Disable Spotify
uv run --script pomodoro.py --no-spotify
```

**Andrew 的版本**（~/Bao/clawd/pomodoro.py）：
- 硬编码的 Spotify URI：
  - 专注时段：`spotify:episode:5yJKH11UlF3sS3gcKKaUYx`  
  - 休息时段：`spotify:episode:4U4OloHPFBNHWt0GOKENVF`  
- 使用 `~/clawd/skills/spotify-applescript/spotify.sh` 进行播放

选项：
- `--task`、`-t`：工作时段显示的任务标签（最多 20 字符，自动转为大写）  
- `--work`：工作时长（分钟，默认：25）  
- `--short`：短休息时长（分钟，默认：5）  
- `--long`：长休息时长（分钟，默认：15）  
- `--sessions`：触发长休息前的工作轮次（默认：4）  
- `--no-spotify`：禁用自动音乐播放  

功能特性：
- 龙虾吉祥物全程注视你工作（专注表情）  
- 休息时段：快乐龙虾搭配闪烁彩纸效果  
- 各轮次之间以闪烁方式提醒  
- 记录已完成的工作轮次  
- 通过 AppleScript（macOS）自动播放 Spotify 音乐  
- 左上角显示水滴图标用于饮水追踪（与 water.py 共享状态）

## 饮水追踪

在左上角显示可爱水滴图标，用于追踪每日饮水量：

```bash
# Show current count
uv run --script {baseDir}/water.py

# Add a glass (+1)
uv run --script {baseDir}/water.py add

# Add multiple glasses
uv run --script {baseDir}/water.py add 2

# Set to specific count
uv run --script {baseDir}/water.py set 5

# Reset to 0
uv run --script {baseDir}/water.py reset

# Change daily goal
uv run --script {baseDir}/water.py goal 10
```

状态持久化保存至 `~/.holocube_water.json`，并每日自动重置。饮水追踪器亦会在番茄钟会话期间显示于左上角。

## 原厂固件工具

### holocube.py — GIF 上传（原厂固件）

```bash
uv run --script holocube.py upload animation.gif
uv run --script holocube.py show animation.gif
uv run --script holocube.py list
```

### gifgen.py — 程序化动画生成器

```bash
uv run --script gifgen.py fire output.gif
uv run --script gifgen.py plasma output.gif
uv run --script gifgen.py matrix output.gif
uv run --script gifgen.py sparkle output.gif
```

## 绘图 API 接口端点

HoloClawd 固件暴露以下 REST 接口端点：

```bash
# Clear screen
curl -X POST http://192.168.7.80/api/v1/draw/clear -d '{"color":"#000000"}'

# Draw shapes
curl -X POST http://192.168.7.80/api/v1/draw/circle -d '{"x":120,"y":120,"r":50,"color":"#ff0000","fill":true}'
curl -X POST http://192.168.7.80/api/v1/draw/rect -d '{"x":10,"y":10,"w":100,"h":50,"color":"#00ff00"}'
curl -X POST http://192.168.7.80/api/v1/draw/triangle -d '{"x0":120,"y0":50,"x1":80,"y1":150,"x2":160,"y2":150,"color":"#0000ff"}'
curl -X POST http://192.168.7.80/api/v1/draw/ellipse -d '{"x":120,"y":120,"rx":60,"ry":30,"color":"#ffff00"}'
curl -X POST http://192.168.7.80/api/v1/draw/line -d '{"x0":0,"y0":0,"x1":240,"y1":240,"color":"#ffffff"}'
curl -X POST http://192.168.7.80/api/v1/draw/text -d '{"x":60,"y":100,"text":"Hello","size":3,"color":"#00ffff"}'

# Batch multiple commands
curl -X POST http://192.168.7.80/api/v1/draw/batch -d '{"commands":[...]}'
```

## 固件

**源码：** https://github.com/andrewjiang/HoloClawd-Open-Firmware

构建与刷写：
```bash
git clone https://github.com/andrewjiang/HoloClawd-Open-Firmware.git
cd HoloClawd-Open-Firmware
pio run                    # Build
curl -X POST -F "file=@.pio/build/esp12e/firmware.bin" http://192.168.7.80/api/v1/ota/fw
```

## 颜色参考

```python
Color.BLACK   = "#000000"
Color.WHITE   = "#ffffff"
Color.RED     = "#ff0000"
Color.GREEN   = "#00ff00"
Color.BLUE    = "#0000ff"
Color.CYAN    = "#00ffff"
Color.MAGENTA = "#ff00ff"
Color.YELLOW  = "#ffff00"
Color.ORANGE  = "#ff6600"
Color.PURPLE  = "#9900ff"
```

## 故障排查

- **无法连接：** 检查 WiFi；设备应位于 192.168.7.80  
- **绘图缓慢：** 每次 HTTP 请求耗时约 50ms；复杂绘图请使用批量 API  
- **屏幕闪烁：** 仅在首帧清除屏幕；文本更新请使用背景色