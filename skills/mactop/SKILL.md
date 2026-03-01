---
name: mactop
name_zh: Mactop
description: |
description_zh: |
  使用 mactop 的 TOON 格式，从 Apple Silicon Mac 获取实时硬件指标。
  提供 CPU、内存（RAM）、GPU、功耗、温度、网络、磁盘 I/O 及 Thunderbolt 总线信息。
  当用户需要在 Apple Silicon Mac 上获取系统状态、硬件监控或性能指标时使用。
---
# Mactop 技能

以无头（headless）TOON 模式运行 mactop，并解析其输出以获取硬件指标。

## 前置条件

- **已安装 mactop**：`brew install mactop`
- **PATH 包含 /usr/sbin**：访问 sysctl 所必需

## 使用方法

### 获取全部指标

```bash
mactop --format toon --headless --count 1
```

### 解析关键指标

**CPU 使用率：**
```bash
mactop --format toon --headless --count 1 | grep "^cpu_usage:" | awk '{print $2}'
```

**内存（已用/总量，单位 GB）：**
```bash
mactop --format toon --headless --count 1 | grep -E "^  (Used|Total):" | awk '{printf "%.1f", $2/1073741824}'
```

**GPU 使用率：**
```bash
mactop --format toon --headless --count 1 | grep "^gpu_usage:" | awk '{print $2}'
```

**功耗（总/CPU/GPU，单位瓦特）：**
```bash
mactop --format toon --headless --count 1 | grep -E "^  (TotalPower|CPUPower|GPUPower):" | awk '{print $2}'
```

**热状态（Thermal State）：**
```bash
mactop --format toon --headless --count 1 | grep "^thermal_state:" | awk '{print $2}'
```

**温度：**
```bash
mactop --format toon --headless --count 1 | grep "^  SocTemp:" | awk '{print $2}'
```

**芯片信息：**
```bash
mactop --format toon --headless --count 1 | grep "^  Name:" | awk '{print $2}'
```

**网络 I/O（字节/秒）：**
```bash
mactop --format toon --headless --count 1 | grep -E "^(  InBytesPerSec|  OutBytesPerSec):" | awk '{print $2}'
```

**Thunderbolt 总线：**
```bash
mactop --format toon --headless --count 1 | grep "^    Name:" | awk '{print $2}'
```

## 选项

| 选项 | 描述 |
|------|------|
| `--count N` | 采样次数（默认：1） |
| `--interval MS` | 采样间隔（毫秒，默认：1000） |

## TOON 格式

```
timestamp: "2026-01-25T20:00:00-07:00"
soc_metrics:
  CPUPower: 0.15
  GPUPower: 0.02
  TotalPower: 8.5
  SocTemp: 42.3
memory:
  Total: 25769803776
  Used: 14852408320
  Available: 10917395456
cpu_usage: 5.2
gpu_usage: 1.8
thermal_state: Normal
system_info:
  Name: Apple M4 Pro
  CoreCount: 12
```

## 响应示例

以易读的框格式呈现指标：

```
┌─ Apple M4 Pro ──────────────────────┐
│ CPU:   5.2%  |  RAM: 13.8/24.0 GB  │
│ GPU:   1.8%  |  Power: 8.5W total  │
│ Thermal: Normal  |  SoC: 42.3°C    │
└─────────────────────────────────────┘
```

## 故障排除

- **“sysctl not found”** → 将 `/usr/sbin` 加入 PATH
- **无输出** → 验证 mactop 是否已安装：`which mactop`