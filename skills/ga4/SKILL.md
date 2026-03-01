---
name: ga4
name_zh: GA4
description: 通过 Analytics Data API 查询 Google Analytics 4 (GA4) 数据。当您需要提取网站分析数据（例如热门页面、流量来源、用户数、会话数、转化数，或任意 GA4 指标/维度）时使用。支持自定义日期范围和筛选条件。
description_zh: 通过 Analytics Data API 查询 Google Analytics 4 (GA4) 数据。当您需要提取网站分析数据（例如热门页面、流量来源、用户数、会话数、转化数，或任意 GA4 指标/维度）时使用。支持自定义日期范围和筛选条件。
metadata: {"clawdbot":{"emoji":"📊","requires":{"bins":["python3"]}}}
---
# GA4 — Google Analytics 4 数据 API

查询 GA4 属性的分析数据：页面浏览量、会话数、用户数、流量来源、转化数等。

## 初始化设置（仅需一次）

1. 启用 Google Analytics Data API：https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com  
2. 创建 OAuth 凭据，或复用现有的 Google Cloud 项目  
3. 设置环境变量：  
   - `GA4_PROPERTY_ID` — 您的 GA4 属性 ID（纯数字，例如 "123456789"）  
   - `GOOGLE_CLIENT_ID` — OAuth 客户端 ID  
   - `GOOGLE_CLIENT_SECRET` — OAuth 客户端密钥  
   - `GOOGLE_REFRESH_TOKEN` — OAuth 刷新令牌（来自首次授权流程）

## 常用查询示例

### 热门页面（按浏览量排序）
```bash
python3 scripts/ga4_query.py --metric screenPageViews --dimension pagePath --limit 30
```

### 热门页面（含会话数与用户数）
```bash
python3 scripts/ga4_query.py --metrics screenPageViews,sessions,totalUsers --dimension pagePath --limit 20
```

### 流量来源
```bash
python3 scripts/ga4_query.py --metric sessions --dimension sessionSource --limit 20
```

### 首页（着陆页）
```bash
python3 scripts/ga4_query.py --metric sessions --dimension landingPage --limit 30
```

### 自定义日期范围
```bash
python3 scripts/ga4_query.py --metric sessions --dimension pagePath --start 2026-01-01 --end 2026-01-15
```

### 按页面路径筛选
```bash
python3 scripts/ga4_query.py --metric screenPageViews --dimension pagePath --filter "pagePath=~/blog/"
```

## 可用指标（Metrics）

常用指标：`screenPageViews`, `sessions`, `totalUsers`, `newUsers`, `activeUsers`, `bounceRate`, `averageSessionDuration`, `conversions`, `eventCount`

## 可用维度（Dimensions）

常用维度：`pagePath`, `pageTitle`, `landingPage`, `sessionSource`, `sessionMedium`, `sessionCampaignName`, `country`, `city`, `deviceCategory`, `browser`, `date`

## 输出格式

默认：表格格式  
添加 `--json` 参数可输出 JSON 格式  
添加 `--csv` 参数可输出 CSV 格式