---
name: dyson-cli
name_zh: 戴森CLI
description: 通过本地 MQTT 控制戴森空气净化器、风扇及取暖器。当用户提出控制戴森设备、调节风速、设定温度/制热、启用摆动功能，或查询室内温湿度等需求时使用。要求设备与运行 CLI 的终端处于同一 WiFi 网络。
description_zh: 通过本地 MQTT 控制戴森空气净化器、风扇及取暖器。当用户提出控制戴森设备、调节风速、设定温度/制热、启用摆动功能，或查询室内温湿度等需求时使用。要求设备与运行 CLI 的终端处于同一 WiFi 网络。
---
# Dyson CLI

## 前置条件

1. CLI 已安装于 `~/dyson-cli`，并启用虚拟环境（venv）
2. **必须与戴森设备处于同一 WiFi 网络** —— 仅支持本地 MQTT，不支持远程控制

**快速验证：**
```bash
cd ~/dyson-cli && source .venv/bin/activate && dyson list --check
```

## 命令

### 电源控制
```bash
dyson on                      # Turn on
dyson off                     # Turn off
```

### 风扇控制
```bash
dyson fan speed 5             # Speed 1-10
dyson fan speed auto          # Auto mode
dyson fan oscillate on        # Enable oscillation
dyson fan oscillate on -a 90  # 90° sweep (45/90/180/350)
dyson fan oscillate off       # Disable oscillation
```

### 制热控制（Hot+Cool 系列机型）
```bash
dyson heat on                 # Enable heating
dyson heat off                # Disable heating
dyson heat target 22          # Set target temp (°C)
```

### 其他功能
```bash
dyson night on                # Night mode on
dyson night off               # Night mode off
dyson status                  # Show current state
dyson status --json           # JSON output
```

### 多设备支持

使用 `-d <name>` 指定目标设备：
```bash
dyson on -d "Bedroom"
dyson fan speed auto -d "Office"
```

## 常见操作模式

```bash
# "Turn on the Dyson and set to auto"
dyson on && dyson fan speed auto

# "Heat to 23 degrees"
dyson heat on && dyson heat target 23

# "Turn on with gentle oscillation"
dyson on && dyson fan speed 3 && dyson fan oscillate on -a 45

# "What's the current temperature?"
dyson status --json | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"Temp: {d['temperature']-273:.1f}°C, Humidity: {d['humidity']}%\")"
```

## 故障排查

若命令执行失败，请按以下步骤检查：
1. 检查设备在线状态：`dyson list --check`
2. 确保 CLI 终端与戴森设备处于同一 WiFi 网络
3. 若凭证已过期，请重新运行配置流程：`dyson setup`

有关安装、设备配置及完整文档，请参阅 [README.md](README.md)。