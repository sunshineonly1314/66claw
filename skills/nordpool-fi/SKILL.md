---
name: nordpool-fi
name_zh: Nordpool芬兰电价
description: 提供芬兰每小时电价，并计算最优电动汽车（EV）充电时段（3 小时、4 小时、5 小时）。
description_zh: 提供芬兰每小时电价，并计算最优电动汽车（EV）充电时段（3 小时、4 小时、5 小时）。
metadata: {"tags": ["energy", "finland", "nordpool", "electricity", "ev-charging"]}
---
# Nordpool 芬兰能源价格 🇫🇮

提供芬兰每小时电价，并计算最优电动汽车（EV）充电时段（3 小时、4 小时、5 小时）。

该 skill 通过 Porssisahko.net API 获取芬兰每小时电价数据，自动处理 UTC 与芬兰本地时间之间的时区转换，并为高能耗任务（如 EV 充电）提供实用汇总信息。

## 工具

### nordpool-fi

获取当前电价、每日统计信息及最优充电时段。

**用法：**
`public-skills/nordpool-fi/bin/nordpool-fi.py`

**输出格式（JSON）：**
- `current_price`：当前小时电价（单位：芬尼/千瓦时，snt/kWh）
- `best_charging_windows`：最优连续充电时段（3 小时、4 小时或 5 小时）
- `today_stats`：当日平均价、最低价与最高价

## 示例

获取最优 4 小时充电时段：
```bash
public-skills/nordpool-fi/bin/nordpool-fi.py | jq .best_charging_windows.4h
```