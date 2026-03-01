---
name: sports-ticker
name_zh: 体育快讯
description: 面向足球、NFL、NBA、NHL、MLB、F1 等多项运动的实时体育赛事提醒。借助免费的 ESPN API 实现实时比分推送。支持追踪全球任意主流联赛中的任意球队。
description_zh: 面向足球、NFL、NBA、NHL、MLB、F1 等多项运动的实时体育赛事提醒。借助免费的 ESPN API 实现实时比分推送。支持追踪全球任意主流联赛中的任意球队。
---
# 体育赛事播报器

跨**多项运动**追踪您喜爱的球队，享受**免费实时提醒**！

支持项目：⚽ 足球 • 🏈 NFL • 🏀 NBA • 🏒 NHL • ⚾ MLB • 🏎️ F1  

## 快速入门

```bash
# Setup
cp config.example.json config.json
python3 scripts/setup.py  # Interactive setup

# Find team IDs (any sport)
python3 scripts/setup.py find "Lakers" basketball
python3 scripts/setup.py find "Chiefs" football
python3 scripts/setup.py find "Barcelona" soccer

# Test
python3 scripts/ticker.py
```

## 配置示例

```json
{
  "teams": [
    {
      "name": "Barcelona",
      "emoji": "🔵🔴",
      "sport": "soccer",
      "espn_id": "83",
      "espn_leagues": ["esp.1", "uefa.champions"]
    },
    {
      "name": "Lakers",
      "emoji": "🏀💜💛",
      "sport": "basketball",
      "espn_id": "13",
      "espn_leagues": ["nba"]
    }
  ]
}
```

## 命令

```bash
# Ticker for all teams
python3 scripts/ticker.py

# Live monitor (for cron)
python3 scripts/live_monitor.py

# League scoreboard
python3 scripts/ticker.py league nba basketball
python3 scripts/ticker.py league nfl football
python3 scripts/ticker.py league eng.1 soccer

# ESPN direct
python3 scripts/espn.py leagues
python3 scripts/espn.py scoreboard nba basketball
python3 scripts/espn.py search "Chiefs" football
```

## 提醒类型

- 🏟️ 比赛开始（开球 / 跳球）  
- ⚽🏈🏀⚾ 得分事件（进球、达阵、三分球、本垒打）  
- 🟥 红牌 / 驱逐出场  
- ⏸️ 中场休息 / 赛段间歇  
- 🏁 终场结果（胜/负/平）  

## ESPN API（免费！）

无需密钥。覆盖所有主流运动及全球 50+ 个联赛。

**支持的运动项目：**  
- 足球：英超、西甲、欧冠、MLS 等 30+ 个联赛  
- 美式橄榄球：NFL  
- 篮球：NBA、WNBA、NCAA  
- 冰球：NHL  
- 棒球：MLB  
- 赛车：一级方程式 F1  