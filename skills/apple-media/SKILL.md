---
name: apple-media
name_zh: 苹果媒体
description: 通过 pyatv 控制 Apple TV、HomePod 和 AirPlay 设备（扫描、流式传输、播放控制、音量调节、导航）。
description_zh: 通过 pyatv 控制 Apple TV、HomePod 和 AirPlay 设备（扫描、流式传输、播放控制、音量调节、导航）。
homepage: https://github.com/aaronn/clawd-apple-media-skill
metadata: {"clawdbot":{"emoji":"🎛️","requires":{"bins":["atvremote"]},"install":[{"id":"pipx","kind":"download","command":"pipx install pyatv --python python3.13","bins":["atvremote"],"label":"通过 pipx 安装 pyatv（Python 3.13）"}]}}
---
# Apple 媒体遥控器

使用 `atvremote` 从命令行控制 Apple TV、HomePod 和 AirPlay 设备。

## 设置说明

- pyatv 与 Python 3.14+ 存在兼容性问题。安装时请使用 `--python python3.13`（或任意 ≤3.13 的版本）。
- 若安装后 `~/.local/bin` 未加入系统 PATH，请运行：`pipx ensurepath`
- 若默认 Python 版本为 3.14+，也可直接调用：`python3.13 -m pyatv.scripts.atvremote <command>`

## 扫描设备

```bash
atvremote scan
atvremote --scan-hosts 10.0.0.50 scan          # Scan specific IP (faster)
atvremote --scan-hosts 10.0.0.50,10.0.0.51 scan  # Multiple IPs
```

返回本地网络中所有可发现的 Apple TV、HomePod 和 AirPlay 设备，包括其名称、地址、协议及配对状态。

## 指定目标设备

使用 `-n <name>`（设备名称）、`-s <ip>`（地址）或 `-i <id>`（标识符）指定目标设备：
```bash
atvremote -n "Kitchen" <command>
atvremote -s 10.0.0.50 <command>
atvremote -i AA:BB:CC:DD:EE:FF <command>
```

## 播放控制

```bash
atvremote -n "Kitchen" playing           # Now playing info (title, artist, album, position, etc.)
atvremote -n "Kitchen" play              # Resume playback
atvremote -n "Kitchen" pause             # Pause playback (resumable with play)
atvremote -n "Kitchen" play_pause        # Toggle play/pause
atvremote -n "Kitchen" stop              # Stop playback (ends session, cannot resume)
atvremote -n "Kitchen" next              # Next track
atvremote -n "Kitchen" previous          # Previous track
atvremote -n "Kitchen" skip_forward      # Skip forward (~10-30s, app-dependent)
atvremote -n "Kitchen" skip_backward     # Skip backward (~10-30s, app-dependent)
atvremote -n "Kitchen" skip_forward=30   # Skip forward specific seconds
atvremote -n "Kitchen" set_position=120  # Seek to position (seconds)
atvremote -n "Kitchen" set_shuffle=Songs # Shuffle: Off, Songs, Albums
atvremote -n "Kitchen" set_repeat=All    # Repeat: Off, Track, All
```

## 音量调节

```bash
atvremote -n "Kitchen" volume            # Get current volume (0-100)
atvremote -n "Kitchen" set_volume=50     # Set volume (0-100)
atvremote -n "Kitchen" volume_up         # Step up (~2.5%)
atvremote -n "Kitchen" volume_down       # Step down (~2.5%)
```

## 流式传输

将本地文件或 URL 流式传输至设备：
```bash
atvremote -n "Kitchen" stream_file=/path/to/audio.mp3   # Local file
atvremote -n "Kitchen" play_url=http://example.com/stream.mp3  # Remote URL
```

支持常见音频格式（MP3、WAV、AAC、FLAC 等）。

## 电源管理

```bash
atvremote -n "Apple TV" power_state      # Check power state
atvremote -n "Apple TV" turn_on          # Wake device
atvremote -n "Apple TV" turn_off         # Sleep device
```

## 导航（Apple TV）

```bash
atvremote -n "Apple TV" up               # D-pad up
atvremote -n "Apple TV" down             # D-pad down
atvremote -n "Apple TV" left             # D-pad left
atvremote -n "Apple TV" right            # D-pad right
atvremote -n "Apple TV" select           # Press select/enter
atvremote -n "Apple TV" menu             # Back/menu button
atvremote -n "Apple TV" home             # Home button
atvremote -n "Apple TV" home_hold        # Long press home (app switcher)
atvremote -n "Apple TV" top_menu         # Go to main menu
atvremote -n "Apple TV" control_center   # Open control center
atvremote -n "Apple TV" guide            # Show EPG/guide
atvremote -n "Apple TV" channel_up       # Next channel
atvremote -n "Apple TV" channel_down     # Previous channel
atvremote -n "Apple TV" screensaver      # Activate screensaver
```

## 键盘输入（Apple TV）

当文本字段获得焦点时：
```bash
atvremote -n "Apple TV" text_get                 # Get current text
atvremote -n "Apple TV" text_set="search query"  # Replace text
atvremote -n "Apple TV" text_append=" more"      # Append text
atvremote -n "Apple TV" text_clear               # Clear text
```

## 应用控制（Apple TV）

```bash
atvremote -n "Apple TV" app_list                          # List installed apps
atvremote -n "Apple TV" launch_app=com.apple.TVMusic      # Launch by bundle ID or URL
```

## 输出设备（多房间）

管理已连接的音频输出设备（例如：将 HomePod 分组）：
```bash
atvremote -n "Apple TV" output_devices                    # List current output device IDs
atvremote -n "Apple TV" add_output_devices=<device_id>    # Add speaker to group
atvremote -n "Apple TV" remove_output_devices=<device_id> # Remove from group
atvremote -n "Apple TV" set_output_devices=<device_id>    # Set specific output(s)
```

## 推送更新（实时监控）

监听实时播放状态变化：
```bash
atvremote -n "Kitchen" push_updates   # Prints updates as they occur (ENTER to stop)
```

## 配对

部分设备（尤其是 Apple TV）需先完成配对才能进行控制：
```bash
atvremote -n "Living Room" pair                   # Pair (follow PIN prompt)
atvremote -n "Living Room" --protocol airplay pair  # Pair specific protocol
atvremote wizard                                  # Interactive guided setup
```

配对成功后，凭据将自动保存至 `~/.pyatv.conf`。

## 设备信息

```bash
atvremote -n "Kitchen" device_info       # Model, OS version, MAC
atvremote -n "Kitchen" features          # List all supported features
atvremote -n "Kitchen" app               # Current app playing media
```

## 使用提示

- **暂停 vs 停止**：使用 `pause`/`play` 可挂起并恢复播放；`stop` 则完全终止会话——后续需从源端（Siri、家庭 App 等）重新启动播放。
- 标注 “Pairing: NotNeeded” 的 HomePod 可立即开始流式传输。
- Apple TV 通常需预先完成配对（支持的所有协议均需配对）。
- `playing` 命令可显示媒体类型、标题、艺术家、当前播放位置、随机/循环播放状态。
- 对于立体声 HomePod 组合，可通过任一单元的名称进行目标指定。
- 若已知设备 IP 地址，可使用 `--scan-hosts` 实现更快速的目标定位。
- 导航与键盘命令主要适用于 Apple TV（不适用于 HomePod）。