---
name: homeassistant
name_zh: Home Assistant
description: 控制 Home Assistant —— 智能插座、灯具、场景、自动化。
description_zh: 控制 Home Assistant —— 智能插座、灯具、场景、自动化。
homepage: https://www.home-assistant.io/
metadata: {"clawdis":{"emoji":"🏠","requires":{"bins":["curl"],"env":["HA_TOKEN"]},"primaryEnv":"HA_TOKEN"}}
---
# Home Assistant

通过 Home Assistant API 控制智能家居设备。

## 设置

配置环境变量：
- `HA_URL`：你的 Home Assistant 地址（例如 `http://192.168.1.100:8123`）  
- `HA_TOKEN`：长期有效访问令牌（在 HA → Profile → Long-Lived Access Tokens 中创建）

## 快捷命令

### 按领域列出实体
```bash
curl -s "$HA_URL/api/states" -H "Authorization: Bearer $HA_TOKEN" | \
  jq -r '.[] | select(.entity_id | startswith("switch.")) | .entity_id'
```

### 开启/关闭
```bash
# Turn on
curl -s -X POST "$HA_URL/api/services/switch/turn_on" \
  -H "Authorization: Bearer $HA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "switch.office_lamp"}'

# Turn off
curl -s -X POST "$HA_URL/api/services/switch/turn_off" \
  -H "Authorization: Bearer $HA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "switch.office_lamp"}'
```

### 控制灯具
```bash
# Turn on with brightness
curl -s -X POST "$HA_URL/api/services/light/turn_on" \
  -H "Authorization: Bearer $HA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "light.living_room", "brightness_pct": 80}'
```

### 触发场景
```bash
curl -s -X POST "$HA_URL/api/services/scene/turn_on" \
  -H "Authorization: Bearer $HA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "scene.movie_time"}'
```

### 调用任意服务
```bash
curl -s -X POST "$HA_URL/api/services/{domain}/{service}" \
  -H "Authorization: Bearer $HA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "...", ...}'
```

### 获取实体状态
```bash
curl -s "$HA_URL/api/states/{entity_id}" -H "Authorization: Bearer $HA_TOKEN"
```

## 实体领域

- `switch.*` —— 智能插座、通用开关  
- `light.*` —— 灯具（如 Hue、LIFX 等）  
- `scene.*` —— 预配置场景  
- `automation.*` —— 自动化  
- `climate.*` —— 恒温器  
- `cover.*` —— 百叶窗、车库门  
- `media_player.*` —— 电视、扬声器  
- `sensor.*` —— 温度、湿度等传感器  

## 注意事项

- API 默认返回 JSON 格式  
- 长期有效令牌不会过期——请妥善保管  
- 建议先使用 list 命令测试实体 ID  