---
name: lg-thinq
name_zh: LG ThinQ
description: "通过 ThinQ API 控制 LG 智能家电。当用户询问其冰箱、洗衣机、干衣机、空调或其他 LG 家电时启用。支持状态查询、温度调节、模式切换（速冷、节能）以及门开关状态监控。"
description_zh: 通过 ThinQ API 控制 LG 智能家电。当用户询问其冰箱、洗衣机、干衣机、空调或其他 LG 家电时启用。支持状态查询、温度调节、模式切换（速冷、节能）以及门开关状态监控。
metadata: {"version":"1.0.0","clawdbot":{"emoji":"🧊","os":["darwin","linux"]}}
---
# LG ThinQ Skill

通过 ThinQ Connect API 控制 LG 智能家居设备。

## 设置

1. 从 https://connect-pat.lgthinq.com 获取个人访问令牌（Personal Access Token）  
2. 存储令牌：`echo "YOUR_TOKEN" > ~/.config/lg-thinq/token`  
3. 存储国家代码：`echo "MX" > ~/.config/lg-thinq/country`  

## 快捷命令

所有脚本均位于该 skill 的 `scripts/` 目录下。请先激活虚拟环境：  
```bash
cd ~/clawd && source .venv/bin/activate
```

### 列出设备  
```bash
python3 skills/lg-thinq/scripts/thinq.py devices
```

### 获取设备状态  
```bash
python3 skills/lg-thinq/scripts/thinq.py status <device_id>
python3 skills/lg-thinq/scripts/thinq.py status fridge  # alias
```

### 控制冰箱  
```bash
# Set fridge temperature (0-6°C)
python3 skills/lg-thinq/scripts/thinq.py fridge-temp 3

# Set freezer temperature (-24 to -14°C typical)
python3 skills/lg-thinq/scripts/thinq.py freezer-temp -15

# Toggle express fridge
python3 skills/lg-thinq/scripts/thinq.py express-fridge on|off

# Toggle express freeze
python3 skills/lg-thinq/scripts/thinq.py express-freeze on|off

# Toggle eco mode
python3 skills/lg-thinq/scripts/thinq.py eco on|off
```

### 洗衣机/干衣机状态  
```bash
python3 skills/lg-thinq/scripts/thinq.py status washer
python3 skills/lg-thinq/scripts/thinq.py status dryer
```

## 支持的设备

| 设备 | 状态查询 | 控制能力 |
|------|----------|----------|
| 冰箱 | ✅ 温度、门开关、运行模式 | ✅ 温度、速冷、节能 |
| WashTower 洗衣机 | ✅ 运行状态、剩余时间 | ⚠️ 功能受限 |
| WashTower 干衣机 | ✅ 运行状态、剩余时间 | ⚠️ 功能受限 |
| 空调 | ✅ 温度、运行模式 | ✅ 温度、运行模式、风扇 |

## 温度范围

- **冰箱**：0°C 至 6°C  
- **冷冻室**：-24°C 至 -14°C（因型号而异）

## 错误处理

- `NOT_CONNECTED_DEVICE`：设备离线，请检查 WiFi 或打开 ThinQ App  
- `INVALID_COMMAND_ERROR`：命令格式错误或参数值超出范围  
- `NOT_PROVIDED_FEATURE`：当前型号不支持该功能  

## 自然语言示例

用户说 → 执行动作：  
- “检查我的冰箱” → `status fridge`  
- “把冰箱设为 5 度” → `fridge-temp 5`  
- “开启速冻模式” → `express-freeze on`  
- “冰箱门开着吗？” → `status fridge`（检查 doorStatus）  
- “洗衣机怎么样了？” → `status washer`  