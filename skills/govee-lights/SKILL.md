---
name: govee-lights
name_zh: Govee灯
description: 通过 Govee API 控制 Govee 智能灯具。支持开关灯、调节亮度、设置颜色及场景。适用于：(1) 按名称控制单个灯具或灯具组，(2) 设置颜色与亮度，(3) 管理设备状态
description_zh: 通过 Govee API 控制 Govee 智能灯具。支持开关灯、调节亮度、设置颜色及场景。适用于：(1) 按名称控制单个灯具或灯具组，(2) 设置颜色与亮度，(3) 管理设备状态
---
# Govee 灯具控制

使用自然语言命令控制 Govee 智能灯具。

## 快速参考

| 命令 | 示例 |
|---------|---------|
| 列出设备 | `python3 scripts/govee.py list` |
| 开灯 | `python3 scripts/govee.py on "lamp"` |
| 关灯 | `python3 scripts/govee.py off "lamp"` |
| 调节亮度 | `python3 scripts/govee.py brightness "lamp" 75` |
| 设置颜色 | `python3 scripts/govee.py color "lamp" 255 100 50` |

## 自然语言指令模式

- “打开 [设备名称]”
- “关闭 [设备名称]”
- “将 [设备名称] 的亮度设为 [数值]%”
- “将 [设备名称] 设为 [颜色名称或 RGB 值]”
- “调暗/调亮 [设备名称]”

## 配置步骤

1. 从 [Govee 开发者门户](https://developer.govee.com/) 获取 API 密钥
2. 设置环境变量：`export GOVEE_API_KEY="your-key"`
3. 安装依赖项：`pip3 install requests`

## 使用示例

```bash
# List all devices
python3 scripts/govee.py list

# Control lights
python3 scripts/govee.py on "living room"
python3 scripts/govee.py off bedroom
python3 scripts/govee.py brightness "desk lamp" 50

# Set colors (RGB 0-255)
python3 scripts/govee.py color "strip" 255 0 0      # Red
python3 scripts/govee.py color "strip" 0 255 0      # Green
python3 scripts/govee.py color "strip" 255 165 0    # Orange
```

## 故障排除

常见问题详见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。