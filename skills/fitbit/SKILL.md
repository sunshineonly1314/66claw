---
name: fitbit
name_zh: Fitbit
description: 查询 Fitbit 健康数据，包括睡眠、心率、活动量、血氧饱和度（SpO2）和呼吸频率。当用户询问其健身状况、睡眠质量、步数或健康指标时使用。
description_zh: 查询 Fitbit 健康数据，包括睡眠、心率、活动量、血氧饱和度（SpO2）和呼吸频率。当用户询问其健身状况、睡眠质量、步数或健康指标时使用。
homepage: https://www.fitbit.com
metadata:
  clawdbot:
    emoji: "💪"
    requires:
      bins: ["fitbit-cli"]
---
# Fitbit CLI

从 Fitbit 可穿戴设备查询健康与健身数据。

## 命令

### 健康数据

```bash
# Sleep logs (deep, light, REM, awake times)
fitbit-cli -s                    # today
fitbit-cli -s yesterday          # yesterday
fitbit-cli -s last-week          # last 7 days
fitbit-cli -s 2026-01-01         # specific date

# Heart rate time series
fitbit-cli -e                    # today
fitbit-cli -e last-week          # last 7 days

# Blood oxygen (SpO2)
fitbit-cli -o                    # today
fitbit-cli -o last-3-days        # last 3 days

# Active Zone Minutes
fitbit-cli -a                    # today
fitbit-cli -a last-month         # last month

# Breathing rate
fitbit-cli -b                    # today

# Daily activity (steps, calories, distance, floors)
fitbit-cli -t                    # today
fitbit-cli -t yesterday          # yesterday
```

### 账户与设备

```bash
# User profile
fitbit-cli -u

# Connected devices (battery, sync status)
fitbit-cli -d
```

### 日期格式

- 不传参数：今日
- 指定日期：`2026-01-05`
- 日期范围：`2026-01-01,2026-01-05`
- 相对时间：`yesterday`、`last-week`、`last-month`
- 自定义相对时间：`last-2-days`、`last-3-weeks`、`last-2-months`

## 使用示例

**用户提问：“我昨晚睡得怎么样？”**  
```bash
fitbit-cli -s yesterday
```

**用户提问：“我这周的心率情况如何？”**  
```bash
fitbit-cli -e last-week
```

**用户提问：“今天走了多少步？”**  
```bash
fitbit-cli -t
```

**用户提问：“显示我的 SpO2 数值。”**  
```bash
fitbit-cli -o
```

**用户提问：“我的 Fitbit 同步了吗？”**  
```bash
fitbit-cli -d
```

**用户提问：“我上个月的活动量如何？”**  
```bash
fitbit-cli -a last-month
```

## 注意事项

- 仅支持对 Fitbit 数据的只读访问
- 访问令牌自动刷新（8 小时后过期）
- 数据可能存在因设备同步延迟导致的滞后
- 首次设置：`fitbit-cli --init-auth`