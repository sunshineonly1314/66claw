---
name: oura-analytics
name_zh: Oura分析
description: Oura Ring 数据集成与分析。从 Oura Cloud API 获取睡眠分数、准备度、活动量、HRV 及趋势数据。生成自动化报告、睡眠质量与生产力/事件的相关性分析，并针对低恢复日触发告警。需配置 OURA_API_TOKEN（获取地址：cloud.ouraring.com）。
description_zh: Oura Ring 数据集成与分析。从 Oura Cloud API 获取睡眠分数、准备度、活动量、HRV 及趋势数据。生成自动化报告、睡眠质量与生产力/事件的相关性分析，并针对低恢复日触发告警。需配置 OURA_API_TOKEN（获取地址：cloud.ouraring.com）。
metadata: {"clawdbot":{"requires":{"bins":["python3"],"env":["OURA_API_TOKEN"]},"homepage":"https://github.com/kesslerio/oura-analytics-clawdbot-skill"}}
---
# Oura Analytics

## 快速入门

```bash
# Set Oura API token
export OURA_API_TOKEN="your_personal_access_token"

# Fetch sleep data (last 7 days)
python {baseDir}/scripts/oura_api.py sleep --days 7

# Get readiness summary
python {baseDir}/scripts/oura_api.py readiness --days 7

# Generate weekly report
python {baseDir}/scripts/oura_api.py report --type weekly
```

## 适用场景

当您需要以下功能时，请使用本 skill：  
- 获取 Oura Ring 各项指标（睡眠、准备度、活动量、HRV）  
- 分析长期恢复趋势  
- 关联睡眠质量与生产力/事件  
- 设置低准备度日的自动化告警  
- 生成日/周/月健康报告  

## 核心工作流

### 1. 数据获取  
```bash
export PYTHONPATH="{baseDir}/scripts"
python - <<'PY'
from oura_api import OuraClient

client = OuraClient(token="YOUR_TOKEN")
sleep_data = client.get_sleep(start_date="2026-01-01", end_date="2026-01-16")
readiness_data = client.get_readiness(start_date="2026-01-01", end_date="2026-01-16")
print(len(sleep_data), len(readiness_data))
PY
```

### 2. 趋势分析  
```bash
export PYTHONPATH="{baseDir}/scripts"
python - <<'PY'
from oura_api import OuraClient, OuraAnalyzer

client = OuraClient(token="YOUR_TOKEN")
sleep_data = client.get_sleep(start_date="2026-01-01", end_date="2026-01-16")
readiness_data = client.get_readiness(start_date="2026-01-01", end_date="2026-01-16")

analyzer = OuraAnalyzer(sleep_data, readiness_data)
avg_sleep = analyzer.average_metric(sleep_data, "score")
avg_readiness = analyzer.average_metric(readiness_data, "score")
trend = analyzer.trend(sleep_data, "average_hrv")
print(avg_sleep, avg_readiness, trend)
PY
```

### 3. 告警  
```bash
python {baseDir}/scripts/alerts.py --days 7 --readiness 60 --efficiency 80
```

## 运行环境

必需：  
- `OURA_API_TOKEN`

可选（用于告警、报告、时区、输出等）：  
- `TELEGRAM_BOT_TOKEN`  
- `TELEGRAM_CHAT_ID`  
- `USER_TIMEZONE`  
- `OURA_OUTPUT_DIR`

## 脚本

- `scripts/oura_api.py` —— Oura Cloud API 封装器，含 OuraAnalyzer 和 OuraReporter 类  
- `scripts/alerts.py` —— 基于阈值的通知脚本（CLI：`python {baseDir}/scripts/alerts.py --days 7 --readiness 60`）  
- `scripts/weekly_report.py` —— 周报生成器  

## 参考资料

- `references/api.md` —— Oura Cloud API 文档  
- `references/metrics.md` —— 指标定义与解释  

## 自动化（Cron 任务）

Cron 任务在 Clawdbot 网关中配置，而非本仓库。请将以下任务添加至您的 Clawdbot 设置中：

### 每日晨间简报（上午 8:00）
```bash
clawdbot cron add \
  --name "Daily Oura Health Report (Hybrid)" \
  --cron "0 8 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --wake next-heartbeat \
  --deliver \
  --channel telegram \
  --target "<YOUR_TELEGRAM_CHAT_ID>" \
  --message "Run the daily Oura health report with hybrid format: Execute bash /path/to/your/scripts/daily-oura-report-hybrid.sh"
```

### 每周睡眠报告（周日 8:00）
```bash
clawdbot cron add \
  --name "Weekly Oura Sleep Report" \
  --cron "0 8 * * 0" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --wake next-heartbeat \
  --deliver \
  --channel telegram \
  --target "<YOUR_TELEGRAM_CHAT_ID>" \
  --message "Run weekly Oura sleep report: bash /path/to/your/oura-weekly-sleep-alert.sh"
```

### 每日 Obsidian 笔记（上午 8:15）
```bash
clawdbot cron add \
  --name "Daily Obsidian Note" \
  --cron "15 8 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --wake next-heartbeat \
  --message "Create daily Obsidian note with Oura data. Run: source /path/to/venv/bin/activate && python /path/to/daily-note.py"
```

**注意：** 请将 `/path/to/your/` 替换为您实际路径，`<YOUR_TELEGRAM_CHAT_ID>` 替换为您 Telegram 频道/群组 ID。