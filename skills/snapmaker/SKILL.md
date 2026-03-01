---
name: snapmaker
name_zh: Snapmaker
version: 1.0.0
description: 监控和控制 Snapmaker 3D 打印机（搭载 Moonraker/Klipper 的 U1 型号）。适用于检查打印状态、温度、进度，或控制打印任务（暂停/恢复/取消）。当触发词为“printer”、“3D print”、“Snapmaker”、“print status”、“nozzle temp”、“bed temp”时激活。
description_zh: 监控和控制 Snapmaker 3D 打印机（搭载 Moonraker/Klipper 的 U1 型号）。适用于检查打印状态、温度、进度，或控制打印任务（暂停/恢复/取消）。当触发词为“printer”、“3D print”、“Snapmaker”、“print status”、“nozzle temp”、“bed temp”时激活。
license: MIT
---
# Snapmaker 打印机控制

通过 Moonraker API 控制 Snapmaker U1 打印机。

## 配置

在 `~/clawd/config/snapmaker.json` 处创建配置文件：
```json
{
  "ip": "192.168.x.x",
  "port": 80
}
```

或使用环境变量：
```bash
export SNAPMAKER_IP=192.168.x.x
export SNAPMAKER_PORT=80  # optional, defaults to 80
```

**配置查找顺序：**
1. `SNAPMAKER_IP` 环境变量（优先级最高）
2. `~/clawd/config/snapmaker.json`
3. `~/.config/clawdbot/snapmaker.json`

## 快速命令

### 检查状态
```bash
scripts/snapmaker.py status
```

### 耗材信息
```bash
scripts/snapmaker.py filament
```
显示每个插槽的 RFID 标签数据：材料类型、颜色（十六进制）、温度范围及传感器状态。

### 监控打印（实时）
```bash
scripts/snapmaker.py monitor
```

### 打印控制
```bash
scripts/snapmaker.py pause
scripts/snapmaker.py resume  
scripts/snapmaker.py cancel
```

### 温度
```bash
scripts/snapmaker.py temps
```

## API 参考

U1 型号使用端口 80 上的 Moonraker REST API：

| 端点 | 描述 |
|----------|-------------|
| `/server/info` | 服务器状态 |
| `/printer/info` | 打印机信息 |
| `/printer/objects/query?heater_bed&extruder&print_stats` | 状态 |
| `/printer/print/pause` | 暂停打印 |
| `/printer/print/resume` | 恢复打印 |
| `/printer/print/cancel` | 取消打印 |

## 状态响应字段

- `print_stats.state`：`standby`、`printing`、`paused`、`complete`、`error`
- `print_stats.filename`：当前文件
- `print_stats.print_duration`：已过去秒数
- `virtual_sdcard.progress`：取值范围为 0.0 至 1.0
- `heater_bed.temperature` / `heater_bed.target`：热床温度
- `extruder.temperature` / `extruder.target`：喷嘴温度

## 耗材与传感器数据

查询耗材 RFID 及传感器：
```
/printer/objects/query?filament_detect&filament_motion_sensor%20e0_filament&filament_motion_sensor%20e1_filament&filament_motion_sensor%20e2_filament&filament_motion_sensor%20e3_filament
```

### filament_detect.info[]

含 4 个插槽的数组，每个插槽包含 RFID 标签数据（若无标签则为默认值）：

| 字段 | 描述 |
|-------|-------------|
| `VENDOR` | “Snapmaker” 或无 RFID 时为 “NONE” |
| `MANUFACTURER` | 例如 “Polymaker” |
| `MAIN_TYPE` | 材料类型：“PLA”、“PETG”、“ABS” 等 |
| `SUB_TYPE` | 变体：“SnapSpeed”、“generic” 等 |
| `RGB_1` | 颜色（十进制整数，转换方式：`#${(rgb>>16&0xFF).toString(16)}...`） |
| `ARGB_COLOR` | 含 Alpha 通道的颜色（十进制） |
| `WEIGHT` | 卷轴重量（单位：克） |
| `HOTEND_MIN_TEMP` / `HOTEND_MAX_TEMP` | 喷嘴温度范围 |
| `BED_TEMP` | 推荐热床温度 |
| `OFFICIAL` | 若为官方 Snapmaker 耗材则为 true |

### filament_motion_sensor e{0-3}_filament

| 字段 | 描述 |
|-------|-------------|
| `filament_detected` | 布尔值 — 插槽中是否存在耗材 |
| `enabled` | 布尔值 — 传感器是否启用 |

**注意：** 插槽可能具有 `filament_detected: true`，但 `VENDOR: NONE` — 这表示使用了无 RFID 标签的第三方耗材。