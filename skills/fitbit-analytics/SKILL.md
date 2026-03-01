---
name: fitbit-analytics
name_zh: Fitbit分析
description: Fitbit 健康与健身数据集成。通过 Fitbit Web API 获取步数、心率、睡眠、活动、卡路里及趋势数据。生成自动化健康报告与告警。需配置 FITBIT_CLIENT_ID、FITBIT_CLIENT_SECRET、FITBIT_ACCESS_TOKEN 和 FITBIT_REFRESH_TOKEN。
description_zh: Fitbit 健康与健身数据集成。通过 Fitbit Web API 获取步数、心率、睡眠、活动、卡路里及趋势数据。生成自动化健康报告与告警。需配置 FITBIT_CLIENT_ID、FITBIT_CLIENT_SECRET、FITBIT_ACCESS_TOKEN 和 FITBIT_REFRESH_TOKEN。
metadata: {"clawdbot":{"requires":{"bins":["python3"],"env":["FITBIT_CLIENT_ID","FITBIT_CLIENT_SECRET","FITBIT_ACCESS_TOKEN","FITBIT_REFRESH_TOKEN"]},"homepage":"https://github.com/kesslerio/fitbit-analytics-clawdbot-skill"}}
---
# Fitbit Analytics

## 快速入门

```bash
# Set Fitbit API credentials
export FITBIT_CLIENT_ID="your_client_id"
export FITBIT_CLIENT_SECRET="your_client_secret"
export FITBIT_ACCESS_TOKEN="your_access_token"
export FITBIT_REFRESH_TOKEN="your_refresh_token"

# Generate morning briefing with Active Zone Minutes
python scripts/fitbit_briefing.py

# Fetch daily steps
python scripts/fitbit_api.py steps --days 7

# Get heart rate data
python scripts/fitbit_api.py heartrate --days 7

# Sleep summary
python scripts/fitbit_api.py sleep --days 7

# Generate weekly health report
python scripts/fitbit_api.py report --type weekly

# Get activity summary
python scripts/fitbit_api.py summary --days 7
```

## 使用场景

当满足以下任一条件时，可使用该 skill：
- 获取 Fitbit 指标（步数、卡路里、心率、睡眠）
- 分析随时间变化的活动趋势
- 针对久坐或异常心率设置告警
- 生成每日/每周健康报告

## 核心工作流

### 1. 每日简报
```bash
# Generate morning health briefing (includes Active Zone Minutes)
python scripts/fitbit_briefing.py                    # Today's briefing
python scripts/fitbit_briefing.py --date 2026-01-20  # Specific date
python scripts/fitbit_briefing.py --format brief     # 3-line summary
python scripts/fitbit_briefing.py --format json      # JSON output

# Example output includes:
# - Yesterday's activities (logged exercises)
# - Yesterday's Active Zone Minutes (total, Fat Burn, Cardio, Peak)
# - Today's activity summary (steps, calories, floors, distance)
# - Heart rate (resting, average, zones)
# - Sleep (duration, efficiency, awake episodes)
# - Trends vs 7-day average
```

**示例 JSON 输出：**
```json
{
  "date": "2026-01-21",
  "steps_today": 8543,
  "calories_today": 2340,
  "distance_today": 6.8,
  "floors_today": 12,
  "active_minutes": 47,
  "resting_hr": 58,
  "avg_hr": 72,
  "sleep_hours": 7.2,
  "sleep_efficiency": 89,
  "awake_minutes": 12,
  "yesterday_activities": [
    {"name": "Run", "duration": 35, "calories": 320}
  ],
  "yesterday_azm": {
    "activeZoneMinutes": 61,
    "fatBurnActiveZoneMinutes": 39,
    "cardioActiveZoneMinutes": 22
  }
}
```

**注意：** 心肺负荷（Cardio Load）无法通过 Fitbit API 获取——该功能仅限 Fitbit Premium 用户，且仅在移动应用中可见。

### 2. 数据获取（CLI）
```bash
# Available commands:
python scripts/fitbit_api.py steps --days 7
python scripts/fitbit_api.py calories --days 7
python scripts/fitbit_api.py heartrate --days 7
python scripts/fitbit_api.py sleep --days 7
python scripts/fitbit_api.py summary --days 7
python scripts/fitbit_api.py report --type weekly
```

### 3. 数据获取（Python API）
```bash
export PYTHONPATH="{baseDir}/scripts"
python - <<'PY'
from fitbit_api import FitbitClient

client = FitbitClient()  # Uses env vars for credentials

# Fetch data (requires start_date and end_date)
steps_data = client.get_steps(start_date="2026-01-01", end_date="2026-01-16")
hr_data = client.get_heartrate(start_date="2026-01-01", end_date="2026-01-16")
sleep_data = client.get_sleep(start_date="2026-01-01", end_date="2026-01-16")
activity_summary = client.get_activity_summary(start_date="2026-01-01", end_date="2026-01-16")
PY
```

### 4. 分析
```bash
export PYTHONPATH="{baseDir}/scripts"
python - <<'PY'
from fitbit_api import FitbitAnalyzer

analyzer = FitbitAnalyzer(steps_data, hr_data)
summary = analyzer.summary()
print(summary)  # Returns: avg_steps, avg_resting_hr, step_trend
PY
```

### 5. 告警
```bash
python {baseDir}/scripts/alerts.py --days 7 --steps 8000 --sleep 7
```

## 脚本

- `scripts/fitbit_api.py` — Fitbit Web API 封装器、CLI 工具及分析模块  
- `scripts/fitbit_briefing.py` — 早间简报 CLI（支持文本/简要/JSON 输出）  
- `scripts/alerts.py` — 基于阈值的通知脚本  

## 可用 API 方法

| 方法 | 描述 |
|--------|-------------|
| `get_steps(start, end)` | 每日步数统计 |
| `get_calories(start, end)` | 每日消耗卡路里 |
| `get_distance(start, end)` | 每日行走距离 |
| `get_activity_summary(start, end)` | 活动汇总信息 |
| `get_heartrate(start, end)` | 心率数据 |
| `get_sleep(start, end)` | 睡眠数据 |
| `get_sleep_stages(start, end)` | 详细睡眠阶段数据 |
| `get_spo2(start, end)` | 血氧水平（SpO₂） |
| `get_weight(start, end)` | 体重测量值 |
| `get_active_zone_minutes(start, end)` | 主动区域分钟数（AZM）细分 |

## 参考资料

- `references/api.md` — Fitbit Web API 文档  
- `references/metrics.md` — 各指标定义与解读说明  

## 认证方式

Fitbit API 采用 OAuth 2.0 认证机制：
1. 在 https://dev.fitbit.com/apps 创建应用  
2. 获取 client_id 与 client_secret  
3. 完成 OAuth 流程以获取 access_token 和 refresh_token  
4. 通过环境变量设置或直接传入脚本  

## 环境依赖

必需配置：
- `FITBIT_CLIENT_ID`  
- `FITBIT_CLIENT_SECRET`  
- `FITBIT_ACCESS_TOKEN`  
- `FITBIT_REFRESH_TOKEN`  

## 自动化（Cron 任务）

Cron 任务在 Clawdbot 的网关中配置，而非本仓库内。请将以下任务添加至您的 Clawdbot 配置中：

### 每日早间简报（上午 8:00）
```bash
clawdbot cron add \
  --name "Morning Fitbit Health Report" \
  --cron "0 8 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --wake next-heartbeat \
  --deliver \
  --channel telegram \
  --target "<YOUR_TELEGRAM_CHAT_ID>" \
  --message "python3 /path/to/your/scripts/fitbit_briefing.py --format text"
```

**注意：** 请将 `/path/to/your/` 替换为您的实际路径，并将 `<YOUR_TELEGRAM_CHAT_ID>` 替换为您真实的 Telegram 频道/群组 ID。