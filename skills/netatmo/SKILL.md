---
name: netatmo
name_zh: Netatmo
description: 控制 Netatmo 恒温器并读取气象站数据。适用于供暖控制（设定温度、切换模式）、检查室内外温度、二氧化碳（CO₂）浓度、湿度、噪音及气压读数。
description_zh: 控制 Netatmo 恒温器并读取气象站数据。适用于供暖控制（设定温度、切换模式）、检查室内外温度、二氧化碳（CO₂）浓度、湿度、噪音及气压读数。
---
# Netatmo

通过 `netatmo` CLI 控制 Netatmo 智能家居设备。

## 配置步骤

凭据存于 `~/.config/netatmo/`：
- `credentials.json`：`{"client_id": "...", "client_secret": "..."}`  
- `tokens.json`：OAuth 令牌（自动刷新）

## 命令列表

```bash
netatmo status              # Full overview (thermostat + all sensors)
netatmo thermostat          # Thermostat details only
netatmo weather             # All sensors including Office
netatmo history             # 7-day temperature history with sparklines
netatmo history --days 14   # Custom period
netatmo set 21              # Set target temp (7-30°C, 3h manual mode)
netatmo mode schedule       # Resume schedule
netatmo mode away           # Away mode (12°C)
netatmo mode hg             # Frost guard (7°C)
netatmo <cmd> --json        # JSON output for any command
```

## 可获取的数据项

| 位置 | 温度 | 湿度 | CO₂ | 噪音 | 气压 | 电量 |
|----------|------|----------|-----|-------|----------|---------|
| 卧室（主） | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| 室外 | ✓ | ✓ | — | — | ✓* | ✓ |
| 客厅 | ✓ | ✓ | ✓ | — | — | ✓ |
| 办公室 | ✓ | — | — | — | — | — |

*气压数据随室外传感器（位于主基站内）一同显示

## 注意事项

- CO₂ 浓度 >1000 ppm 表示通风不良  
- `set` 采用手动模式持续 3 小时，之后自动恢复至预设日程  
- 令牌将在到期时自动刷新  
- 历史数据以 ASCII sparkline 形式展示温度趋势  