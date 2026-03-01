---
name: homey
name_zh: Homey
description: Control Athom Homey smart home devices via local (LAN/VPN) or cloud APIs. List/control devices, trigger flows, query zones. Works with Homey Pro, Cloud, and Bridge.
description_zh: Control Athom Homey smart home devices via local (LAN/VPN) or cloud APIs. List/control devices, trigger flows, query zones. Works with Homey Pro, Cloud, and Bridge.
metadata: {"clawdbot":{"requires":{"bins":["homeycli"]},"install":[{"id":"homey-npm","kind":"node","package":".","bins":["homeycli"],"label":"Install Homey CLI"}]}}
---
# Homey 智能家居控制

使用 token 认证，通过本地（LAN/VPN）或云 API 控制 Athom Homey 设备。

## 设置

需 Node.js >= 18。

1. **选择本地或云模式**

   - **本地（LAN/VPN）**：使用 Homey Web App 提供的本地 API 密钥 + Homey IP 地址
   - **云（远程/无头）**：使用开发者工具中生成的云 token

2. **配置**

   **本地模式（当 agent 运行于家庭网络时推荐）：**

   ```bash
   homeycli auth discover-local --save --pick 1
   echo "<LOCAL_API_KEY>" | homeycli auth set-local --stdin
   # or interactive (hidden input): homeycli auth set-local --prompt
   ```

   **云模式（VPS/无头托管场景推荐）：**

   ```bash
   echo "<CLOUD_TOKEN>" | homeycli auth set-token --stdin
   # or interactive (hidden input): homeycli auth set-token --prompt
   ```

   检查状态：

   ```bash
   homeycli auth status
   ```

3. **测试连接**

   ```bash
   homeycli status
   ```

## 命令

### 快照（snapshot，推荐用于 agents）
```bash
homeycli snapshot --json
homeycli snapshot --json --include-flows
```

### 列出设备
```bash
homeycli devices              # Pretty table output
homeycli devices --json       # JSON output for AI parsing (includes latest values)

# Filter by name (returns multiple matches)
homeycli devices --match "kitchen" --json
```

### 控制设备
开关设备：
```bash
homeycli device "Living Room Light" on
homeycli device "Bedroom Lamp" off
```

设置特定 capability：
```bash
homeycli device "Dimmer" set dim 0.5                    # 50% brightness
homeycli device "Thermostat" set target_temperature 21  # Set temperature
homeycli device "RGB Light" set light_hue 0.5           # Hue (0-1)
homeycli device "Lock" set locked true                  # Lock device
```

获取 capability 当前值：
```bash
homeycli device "Thermostat" get measure_temperature
homeycli device "Motion Sensor" get alarm_motion

# Get all values for a device (multi-sensors)
homeycli device "Living Room Air" values
homeycli device "Living Room Air" get
```

### 流程（Automations）
```bash
homeycli flows                        # List all flows
homeycli flows --json                 # JSON output
homeycli flows --match "good" --json  # Filter flows by name
homeycli flow trigger "Good Night"    # Trigger by name
homeycli flow trigger <flow-id>       # Trigger by ID
```

### 区域（Zones，即房间）
```bash
homeycli zones           # List all zones/rooms
homeycli zones --json    # JSON output
```

### 状态
```bash
homeycli status    # Show Homey connection info
```

## 常见 capability

| Capability | 类型 | 描述 | 示例 |
|------------|------|------|------|
| `onoff` | 布尔值 | 电源开关 | `true`, `false` |
| `dim` | 数值 | 亮度（0–1） | `0.5`（50%） |
| `light_hue` | 数值 | 色相（hue，0–1） | `0.33`（绿色） |
| `light_saturation` | 数值 | 饱和度（saturation，0–1） | `1.0`（满饱和） |
| `light_temperature` | 数值 | 色温（0–1） | `0.5`（中性） |
| `target_temperature` | 数值 | 恒温器目标温度（°C） | `21` |
| `measure_temperature` | 数值 | 当前温度（只读） | - |
| `locked` | 布尔值 | 门锁状态 | `true`, `false` |
| `alarm_motion` | 布尔值 | 是否检测到运动（只读） | - |
| `alarm_contact` | 布尔值 | 接触传感器状态（只读） | - |
| `volume_set` | 数值 | 音量（0–1） | `0.5` |

使用 `homeycli devices` 查看各设备支持的 capability。

## 模糊匹配

设备与流程名称支持模糊匹配：
- **精确匹配**：“Living Room Light” → 匹配 “Living Room Light”
- **子串匹配**：“living light” → 匹配 “Living Room Light”
- **Levenshtein 距离匹配**：“livng light” → 匹配 “Living Room Light”（支持拼写容错）

## JSON 模式

对任意命令添加 `--json` 参数，即可获得机器可读输出：
```bash
homeycli devices --json | jq '.[] | select(.class == "light")'
homeycli status --json
```

## 示例

**早晨例行程序：**
```bash
homeycli device "Bedroom Light" on
homeycli device "Bedroom Light" set dim 0.3
homeycli device "Thermostat" set target_temperature 20
```

**检查温度：**
```bash
homeycli device "Living Room" get measure_temperature
```

**触发场景：**
```bash
homeycli flow trigger "Movie Time"
```

**列出全部灯光设备：**
```bash
homeycli devices --json | jq '.[] | select(.class == "light") | .name'
```

## 故障排查

**“未配置认证”**

本地（LAN/VPN）：
- 保存本地配置：`echo "<LOCAL_API_KEY>" | homeycli auth set-local --address http://<homey-ip> --stdin`

云（远程/无头）：
- 保存云 token：`echo "<CLOUD_TOKEN>" | homeycli auth set-token --stdin`
- 云 token 可在 Homey 开发者工具中创建：https://tools.developer.homey.app/api/clients

**“设备未找到” / 匹配模糊**
- 使用 `homeycli devices --json`（或 `homeycli devices --match <query> --json`）列出设备，定位正确 `id`
- 若查询匹配多个设备，CLI 将返回候选 ID，并提示您通过 ID 明确指定设备

**“不支持该 capability”**
- 检查可用 capability：`homeycli devices` 显示各设备支持的功能
- 常见问题：尝试对传感器执行开关操作（应使用 `get` 而非 `set`）

## API 参考

本 CLI 使用官方 `homey-api` npm 包（v3.15.0）。

**认证/连接模式：**

- **本地模式：** `HomeyAPI.createLocalAPI({ address, token })`，使用 Homey Web App 提供的本地 API 密钥。
- **云模式：** `AthomCloudAPI`，使用云 bearer token（PAT）创建会话并访问设备/流程/区域。