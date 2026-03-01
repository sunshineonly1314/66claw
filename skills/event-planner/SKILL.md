---
name: event-planner
name_zh: 活动策划
description: Plan events (night out, weekend, date night, team outing, meals, trips) by searching venues via Google Places API. Auto-selects best restaurants, bars, activities based on location, budget, party size, and preferences. Generates detailed itinerary with timing and Google Maps link. Use when asked to plan an outing, create an itinerary, find places for events, or organize activities.
description_zh: Plan events (night out, weekend, date night, team outing, meals, trips) by searching venues via Google Places API. Auto-selects best restaurants, bars, activities based on location, budget, party size, and preferences. Generates detailed itinerary with timing and Google Maps link. Use when asked to plan an outing, create an itinerary, find places for events, or organize activities.
homepage: https://github.com/clawdbot/clawdbot
metadata: {"clawdbot":{"emoji":"🎉","requires":{"bins":["uv"],"env":["GOOGLE_PLACES_API_KEY"]},"primaryEnv":"GOOGLE_PLACES_API_KEY","install":[{"id":"uv-brew","kind":"brew","formula":"uv","bins":["uv"],"label":"Install uv (brew)"}]}}
---
# 活动规划师

通过搜索场所并生成含 Google 地图链接的行程，为您规划各类活动。

## 快速开始

规划一场夜间外出：
```bash
uv run {baseDir}/scripts/plan_event.py "night out" \
  --location "Times Square, NYC" \
  --party-size 4 \
  --budget medium \
  --duration 4h
```

规划一个周末白天：
```bash
uv run {baseDir}/scripts/plan_event.py "weekend day" \
  --location "Central Park, NYC" \
  --party-size 2 \
  --budget "$100 per person" \
  --preferences "outdoors, casual dining"
```

规划一次约会之夜：
```bash
uv run {baseDir}/scripts/plan_event.py "date night" \
  --location "SoHo, NYC" \
  --budget high \
  --duration 3h
```

## 活动类型

- **night-out**：晚餐 + 1–2 家酒吧/休息室（3–4 小时）  
- **weekend-day**：早午餐/午餐 + 活动 + 晚餐（6–8 小时）  
- **date-night**：浪漫餐厅 + 甜点/饮品场所（2–3 小时）  
- **team-event**：团体活动 + 晚餐场所（3–5 小时）  
- **lunch**：单家餐厅推荐  
- **dinner**：单家餐厅推荐  
- **trip**：多日行程，每日均有详细安排  

## 参数说明

- `--location`：城市、地址或地标（必需）  
- `--party-size`：人数（默认：2）  
- `--budget`：“low/medium/high” 或 “$X per person”（默认：medium）  
- `--duration`：可用时长（例如：“3h”、“full day”）  
- `--preferences`：逗号分隔的偏好（例如：“vegetarian, outdoor seating, live music”）  
- `--start-time`：起始时间（默认：根据活动类型推断）  
- `--output`：输出格式（text｜json，默认：text）  
- `--date`：目标日期（YYYY-MM-DD 格式），用于按日查询（默认：今日）

## 输出格式

**默认（text）**：含时间轴、场所详情、交通信息及 Google 地图链接的 Markdown 行程  

**JSON**：含全部场所详情、坐标及解析后元数据的结构化数据  

## 局限性说明

- **API 限额**：Google Places API 设有用量配额（请检查您的账单设置）  
- **实时数据**：场所营业时间可能变动；出行前请务必再次确认  
- **预算估算**：基于 Google 的价格等级（0–4 级），非精确费用  
- **交通耗时**：在可用时调用 Google Directions API；否则退化为基于距离的估算，并附加 30% 缓冲  
- **营业时间**：未验证营业时间的场所将显示警告；切勿假定其开放  
- **活动场馆**：文化中心、剧院及活动空间的营业时间可能随当日排期而变化  

## API 要求

活动规划师依赖以下 API：
- **Google Places API（新版）**：必需，用于场所搜索  
- **Google Directions API**：可选但强烈推荐，用于精准交通耗时计算  

两个 API 可共用同一 `GOOGLE_PLACES_API_KEY`（需在 Google Cloud Console 中启用）。

## 错误处理机制

- 位置无效 → 返回错误并提供修正建议  
- 未找到场所 → 自动放宽筛选条件并重试  
- API 调用失败 → 采用指数退避策略重试（最多 3 次）  