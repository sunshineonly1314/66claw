---
name: fitbit-health
name_zh: Fitbit健康
description: 通过 CLI 查询 Fitbit 健康数据（活动量、睡眠、心率、体重）。当回答需要 Fitbit 数据的健康/健身类问题，或用户询问其 Fitbit 记录的步数、睡眠、心率或体重时使用。
description_zh: 通过 CLI 查询 Fitbit 健康数据（活动量、睡眠、心率、体重）。当回答需要 Fitbit 数据的健康/健身类问题，或用户询问其 Fitbit 记录的步数、睡眠、心率或体重时使用。
metadata: {"clawdbot":{"emoji":"💪","requires":{"bins":["fitbit"]}}}
---
# Fitbit CLI

从 Fitbit 的 Web API 检索健康与健身数据。

## 设置

1. 在 https://dev.fitbit.com/apps 注册一个应用  
   - OAuth 2.0 应用类型：**个人**  
   - 回调 URL：`http://localhost:18787/callback`  
2. 运行 `fitbit configure` 并输入您的 Client ID  
3. 运行 `fitbit login` 以完成授权  

## 快速参考

```bash
# Setup & auth
fitbit configure              # Set client ID (first time)
fitbit login                  # Authorize via browser
fitbit logout                 # Sign out
fitbit status                 # Check auth status

# Data
fitbit profile                # User profile info
fitbit activity [date]        # Daily activity summary
fitbit activity steps [date]  # Just steps
fitbit summary [date]         # Full daily summary
fitbit today                  # Today's summary (shortcut)
```

## 选项

所有命令均支持以下选项：  
- `--json` — 输出 JSON 格式  
- `--no-color` — 输出纯文本格式  
- `--verbose` — 显示调试信息/HTTP 详情  
- `--tz <zone>` — 覆盖时区（例如：`America/Chicago`）  

## 示例

```bash
# Get today's step count
fitbit activity steps

# Get yesterday's full summary as JSON
fitbit summary 2026-01-25 --json

# Check if authenticated
fitbit status
```

## 注意事项

- 若未指定日期，默认为当天  
- 日期格式：`YYYY-MM-DD` 或 `today`  
- Token 存储于 `~/.config/fitbit-cli/tokens.json`（权限设置为 chmod 600）  
- Token 刷新自动进行