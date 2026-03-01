---
name: grounding-lite
name_zh: 谷歌地图轻量锚定MCP
description: 通过 mcporter 实现的 Google Maps Grounding Lite MCP，支持位置搜索、天气查询与路线规划。
description_zh: 通过 mcporter 实现的 Google Maps Grounding Lite MCP，支持位置搜索、天气查询与路线规划。
homepage: https://developers.google.com/maps/ai/grounding-lite
metadata: {"clawdbot":{"emoji":"🗺️","requires":{"bins":["mcporter"],"env":["GOOGLE_MAPS_API_KEY"]},"primaryEnv":"GOOGLE_MAPS_API_KEY","install":[{"id":"node","kind":"node","package":"mcporter","bins":["mcporter"],"label":"Install mcporter (npm)"}]}}
---
# Grounding Lite

Google Maps Grounding Lite MCP 提供 AI 增强的位置数据。该功能目前处于实验阶段（发布前），预览期间免费。

## 设置

1. 启用 API：`gcloud beta services enable mapstools.googleapis.com`
2. 在 [Cloud Console](https://console.cloud.google.com/apis/credentials) 中获取 API 密钥
3. 设置环境变量：`export GOOGLE_MAPS_API_KEY="YOUR_KEY"`
4. 配置 mcporter：
   ```bash
   mcporter config add grounding-lite \
     --url https://mapstools.googleapis.com/mcp \
     --header "X-Goog-Api-Key=$GOOGLE_MAPS_API_KEY" \
     --system
   ```

## 工具

- **search_places**：查找地点、商家、地址。返回含 Google Maps 链接的 AI 摘要。
- **lookup_weather**：当前天气状况及预报（每小时预报覆盖 48 小时，每日预报覆盖 7 天）。
- **compute_routes**：计算行程距离与耗时（不提供逐向导航）。

## 命令

```bash
# Search places
mcporter call grounding-lite.search_places textQuery="pizza near Times Square NYC"

# Weather
mcporter call grounding-lite.lookup_weather location='{"address":"San Francisco, CA"}' unitsSystem=IMPERIAL

# Routes
mcporter call grounding-lite.compute_routes origin='{"address":"SF"}' destination='{"address":"LA"}' travelMode=DRIVE

# List tools
mcporter list grounding-lite --schema
```

## 参数

**search_places**：`textQuery`（必需）、`locationBias`、`languageCode`、`regionCode`

**lookup_weather**：`location`（必需：地址/经纬度/placeId）、`unitsSystem`、`date`、`hour`

**compute_routes**：`origin`、`destination`（必需）、`travelMode`（DRIVE/WALK）

## 注意事项

- 配额限制：search_places 为 100 QPM（每日上限 1,000 次），lookup_weather 与 compute_routes 均为 300 QPM
- 用户界面输出中须包含 Google Maps 链接（归属声明为必需）
- 仅限用于不基于输入数据进行训练的模型