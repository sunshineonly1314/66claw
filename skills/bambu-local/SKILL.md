---
name: bambu-local
name_zh: Bambu 本地
description: 通过 MQTT 本地控制 Bambu Lab 3D 打印机（无需云服务）。支持 A1、A1 Mini、P1P、P1S、X1C。
description_zh: 通过 MQTT 本地控制 Bambu Lab 3D 打印机（无需云服务）。支持 A1、A1 Mini、P1P、P1S、X1C。
homepage: https://github.com/Doridian/OpenBambuAPI
metadata: {"clawdbot":{"emoji":"🖨️","requires":{"bins":["python3"]}}}
---
# Bambu Local — 3D 打印机控制

通过 MQTT 在本地控制 Bambu Lab 打印机，无需依赖云端服务。

## 设置

1. 创建虚拟环境：
```bash
python3 -m venv ~/bambu-env
source ~/bambu-env/bin/activate
pip install paho-mqtt
```

2. 在 skill 文件夹中创建 `config.json`：
```json
{
  "printer_ip": "192.168.x.x",
  "access_code": "xxxxxxxx",
  "serial": "xxxxxxxxxxxx",
  "printer_name": "MyPrinter"
}
```

这些信息需从您的打印机获取：设置 → 仅限局域网模式（访问码），以及设置 → 设备（序列号）。

## 命令

### 状态
```bash
run ~/clawd/skills/bambu-local/bambu status
```

### 灯光
```bash
run ~/clawd/skills/bambu-local/bambu light on
run ~/clawd/skills/bambu-local/bambu light off
```

### 打印控制
```bash
run ~/clawd/skills/bambu-local/bambu print pause
run ~/clawd/skills/bambu-local/bambu print resume
run ~/clawd/skills/bambu-local/bambu print stop
```

### 速度（1=静音，2=标准，3=运动，4=荒谬）
```bash
run ~/clawd/skills/bambu-local/bambu speed 2
```

### 温度
```bash
run ~/clawd/skills/bambu-local/bambu temp --bed 60
run ~/clawd/skills/bambu-local/bambu temp --nozzle 200
```

### G-code
```bash
run ~/clawd/skills/bambu-local/bambu gcode "G28"
```

## 支持的打印机
- Bambu Lab A1 / A1 Mini  
- Bambu Lab P1P / P1S  
- Bambu Lab X1 / X1C