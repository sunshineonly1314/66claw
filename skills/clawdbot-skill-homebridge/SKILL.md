---
name: homebridge
name_zh: Homebridge技能
description: "通过 Homebridge Config UI X 的 REST API 控制智能家居设备。可用于列出设备、开关设备、调节亮度、颜色或色温等操作。支持灯具、开关、恒温器、风扇及其他由 Homebridge 管理的设备。"
description_zh: 通过 Homebridge Config UI X 的 REST API 控制智能家居设备。可用于列出设备、开关设备、调节亮度、颜色或色温等操作。支持灯具、开关、恒温器、风扇及其他由 Homebridge 管理的设备。
homepage: https://github.com/homebridge/homebridge-config-ui-x
metadata: { "clawdbot": { "emoji": "🏠" } }
---
# Homebridge 控制

通过 Homebridge Config UI X 的 REST API 控制智能家居设备。

## 前置条件

1. 已安装并正在运行带 Config UI X 的 Homebridge  
2. 凭据文件位于 `~/.clawdbot/credentials/homebridge.json`：  
   ```json
   {
     "url": "https://homebridge.local:8581",
     "username": "admin",
     "password": "your-password"
   }
   ```

## API 概览

Homebridge Config UI X 提供 REST API。完整文档请参阅 `{HOMEBRIDGE_URL}/swagger`。

## 认证

所有 API 调用均需 Bearer token。请先获取该 token：

```bash
# Get auth token
TOKEN=$(curl -s -X POST "${HOMEBRIDGE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${HOMEBRIDGE_USERNAME}\",\"password\":\"${HOMEBRIDGE_PASSWORD}\"}" \
  | jq -r '.access_token')
```

## 常见操作

### 列出全部配件（Accessories）

```bash
curl -s "${HOMEBRIDGE_URL}/api/accessories" \
  -H "Authorization: Bearer ${TOKEN}" | jq
```

响应中包含配件的 `uniqueId`、`serviceName`、`type` 及当前 `values`。

### 获取配件布局（房间分组）

```bash
curl -s "${HOMEBRIDGE_URL}/api/accessories/layout" \
  -H "Authorization: Bearer ${TOKEN}" | jq
```

### 控制单个配件

使用 PUT 方法更新配件特性（characteristics）：

```bash
# Turn on a light/switch
curl -s -X PUT "${HOMEBRIDGE_URL}/api/accessories/{uniqueId}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"characteristicType": "On", "value": true}'

# Turn off
curl -s -X PUT "${HOMEBRIDGE_URL}/api/accessories/{uniqueId}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"characteristicType": "On", "value": false}'

# Set brightness (0-100)
curl -s -X PUT "${HOMEBRIDGE_URL}/api/accessories/{uniqueId}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"characteristicType": "Brightness", "value": 50}'

# Set color (Hue: 0-360, Saturation: 0-100)
curl -s -X PUT "${HOMEBRIDGE_URL}/api/accessories/{uniqueId}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"characteristicType": "Hue", "value": 240}'

# Set thermostat target temperature
curl -s -X PUT "${HOMEBRIDGE_URL}/api/accessories/{uniqueId}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"characteristicType": "TargetTemperature", "value": 22}'
```

### 常见特性类型（Characteristic Types）

| 类型                        | 取值         | 描述                   |
| --------------------------- | ------------ | ---------------------- |
| `On`                        | `true`/`false` | 电源状态                   |
| `Brightness`                | `0-100`        | 灯光亮度（%）              |
| `Hue`                       | `0-360`        | 色调（Hue，单位：度）       |
| `Saturation`                | `0-100`        | 饱和度（%）                |
| `ColorTemperature`          | `140-500`      | 色温（Mired）             |
| `TargetTemperature`         | `10-38`        | 恒温器目标温度（°C）         |
| `TargetHeatingCoolingState` | `0-3`          | 0=关闭，1=制热，2=制冷，3=自动   |
| `RotationSpeed`             | `0-100`        | 风扇转速（%）               |
| `Active`                    | `0`/`1`        | 激活状态（适用于风扇等设备）     |

## 使用脚本

为便于操作，可直接使用提供的脚本：

### 列出配件

```bash
scripts/homebridge_api.py list
scripts/homebridge_api.py list --room "Living Room"
scripts/homebridge_api.py list --type Lightbulb
```

### 控制设备

```bash
# Turn on/off
scripts/homebridge_api.py set <uniqueId> On true
scripts/homebridge_api.py set <uniqueId> On false

# Adjust brightness
scripts/homebridge_api.py set <uniqueId> Brightness 75

# Set color
scripts/homebridge_api.py set <uniqueId> Hue 120
scripts/homebridge_api.py set <uniqueId> Saturation 100
```

### 获取配件状态

```bash
scripts/homebridge_api.py get <uniqueId>
```

## 使用提示

- 首先列出全部配件，以查找目标配件的 `uniqueId`  
- `/swagger` 上的 API 文档列出了所有可用端点  
- 特性名称区分大小写（请使用 `On`，而非 `on`）  
- 某些配件可能包含多个服务（services）；请检查响应内容以确认服务类型  
- Token 具有时效性；若收到 401 错误，请重新认证  