---
name: airfoil  
description: 通过 Airfoil 从命令行控制 AirPlay 音响设备。支持连接、断开、调节音量及管理多房间音频，全部只需简单 CLI 命令。  
metadata: {"clawdbot":{"emoji":"🔊","os":["darwin"],"requires":{"bins":["osascript"]}}}  
---

# 🔊 Airfoil 技能

```
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║   🎵  A I R F O I L   S P E A K E R   C O N T R O L  🎵  ║
    ║                                                           ║
    ║        Stream audio to any AirPlay speaker                ║
    ║              from your Mac via CLI                        ║
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝
```

> *"Why hop to your Mac when you can croak at it?"* 🐸

---

## 📖 此技能的作用是什么？

**Airfoil 技能**让您直接在终端（或通过 Clawd）全面控制 AirPlay 音响设备——无需触碰鼠标即可完成音响连接、音量调节与状态查询。

**功能特性：**  
- 📡 **`list`** — 列出所有可用音响设备  
- 🔗 **`connect <speaker>`** — 连接到指定音响  
- 🔌 **`disconnect <speaker>`** — 断开与指定音响的连接  
- 🔊 **`volume <speaker> <0-100>`** — 调节音量（0–100%）  
- 📊 **`status`** — 显示当前已连接音响及其音量水平  

---

## ⚙️ 系统要求

| 项目 | 说明 |
|------|------|
| **操作系统** | macOS（依赖 AppleScript） |
| **应用软件** | Rogue Amoeba 开发的 [Airfoil](https://rogueamoeba.com/airfoil/mac/) |
| **价格** | 35 美元（提供免费试用版） |

### 安装步骤

1. **安装 Airfoil：**  
   ```bash
   # Via Homebrew
   brew install --cask airfoil
   
   # Or download from rogueamoeba.com/airfoil/mac/
   ```

2. **启动 Airfoil** 并授予辅助功能权限（系统设置 → 隐私与安全性 → 辅助功能）

3. **技能已就绪！** 🚀

---

## 🛠️ 命令说明

### `list` — 列出全部音响设备

```bash
./airfoil.sh list
```

**输出示例：**  
```
Computer, Andy's M5 Macbook, Sonos Move, Living Room TV
```

---

### `connect <speaker>` — 连接到音响设备

```bash
./airfoil.sh connect "Sonos Move"
```

**输出示例：**  
```
Connected: Sonos Move
```

> 💡 Speaker name must match exactly (case-sensitive!)

---

### `disconnect <speaker>` — 断开音响设备连接

```bash
./airfoil.sh disconnect "Sonos Move"
```

**输出示例：**  
```
Disconnected: Sonos Move
```

---

### `volume <speaker> <0-100>` — 设置音量

```bash
# Set to 40%
./airfoil.sh volume "Sonos Move" 40

# Set to maximum
./airfoil.sh volume "Living Room TV" 100

# Quiet mode for night time
./airfoil.sh volume "Sonos Move" 15
```

**输出示例：**  
```
Volume Sonos Move: 40%
```

---

### `status` — 显示已连接的音响设备

```bash
./airfoil.sh status
```

**输出示例：**  
```
Sonos Move: 40%
Living Room TV: 65%
```

若当前无任何设备连接，则输出：  
```
No speakers connected
```

---

## 🎯 典型使用场景

### 🏠 “客厅播放音乐”  
```bash
./airfoil.sh connect "Sonos Move"
./airfoil.sh volume "Sonos Move" 50
# → Now fire up Spotify/Apple Music and enjoy!
```

### 🎬 “电影之夜设置”  
```bash
./airfoil.sh connect "Living Room TV"
./airfoil.sh volume "Living Room TV" 70
./airfoil.sh disconnect "Sonos Move"  # If still connected
```

### 🌙 “全部关闭”  
```bash
for speaker in "Sonos Move" "Living Room TV"; do
    ./airfoil.sh disconnect "$speaker" 2>/dev/null
done
echo "All speakers disconnected 🌙"
```

---

## 🔧 故障排查

### ❌ “未找到音响设备”

**问题描述：** `execution error: Airfoil got an error: Can't get speaker...`

**解决方法：**  
1. 核对设备名称拼写是否完全一致：`./airfoil.sh list`  
2. 设备名称**区分大小写**（例如 `"sonos move"` ≠ `"Sonos Move"`）  
3. 设备必须与 Mac 处于同一局域网内  
4. 设备需已通电且网络可达  

---

### ❌ “Airfoil 无法启动 / 权限不足”

**问题描述：** AppleScript 无法控制 Airfoil  

**解决方法：**  
1. 打开 **系统设置 → 隐私与安全性 → 辅助功能**  
2. 添加 Terminal（或 iTerm）  
3. 添加 Airfoil  
4. 重启 macOS（有时必需 🙄）  

---

### ❌ “音量调节无效”

**问题描述：** `volume` 命令执行后无响应  

**解决方法：**  
1. 必须先**成功连接**音响，方可调节其音量  
2. 先执行 `connect`，再执行 `volume`  
3. 部分音响设备受硬件端音量限制影响  

---

### ❌ “未安装 Airfoil”

**问题描述：** `execution error: Application isn't running`

**解决方案：**  
```bash
# Start Airfoil
open -a Airfoil

# Or install it
brew install --cask airfoil
```

---

### ❌ “bc: command not found”

**问题描述：** 音量计算失败  

**解决方案：**  
```bash
# Install bc (should be standard on macOS)
brew install bc
```

---

## 📋 已验证兼容的音响设备

以下音响设备均已实测通过：

| 音响设备 | 类型 | 备注 |
|----------|------|------|
| `Computer` | 本地设备 | 始终可用 |
| `Andy's M5 Macbook` | Mac 电脑 | 需处于同一网络中 |
| `Sonos Move` | Sonos 音箱 | 支持蓝牙或 Wi-Fi 连接 |
| `Living Room TV` | Apple TV | 通过 AirPlay 连接 |

> 💡 Use `./airfoil.sh list` to discover your own speakers!

---

## 🔗 与 Clawd 的集成

本技能可完美配合 Clawd 使用！示例如下：

```
"Hey Clawd, connect the Sonos Move"
→ ./airfoil.sh connect "Sonos Move"

"Turn the music down"
→ ./airfoil.sh volume "Sonos Move" 30

"Which speakers are on?"
→ ./airfoil.sh status
```

---

## 📜 更新日志

| 版本号 | 发布日期 | 更新内容 |
|--------|----------|----------|
| 1.0.0 | 2025-01-25 | 初始发布 |
| 1.1.0 | 2025-06-10 | 文档优化 🐸 |
| 1.2.0 | 2025-06-26 | 翻译为英文，适配 ClawdHub！ |

---

## 🐸 致谢

```
  @..@
 (----)
( >__< )   "This skill was crafted with love
 ^^  ^^     by a frog and his human!"
```

**作者：** Andy Steinberger（并得到他的 Clawdbot —— 青蛙 Owen 🐸 的协助）  
**技术支持：** Rogue Amoeba 开发的 [Airfoil](https://rogueamoeba.com/airfoil/mac/)  
**所属项目：** [Clawdbot](https://clawdhub.com) Skills 技能集  

---

<div align="center">

**专为 Clawdbot 社区倾心打造 💚**

*Ribbit!* 🐸

</div>