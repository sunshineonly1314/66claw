---
name: strava
name_zh: Strava
description: 使用 Strava API 加载并分析 Strava 活动、统计数据与训练记录
description_zh: 使用 Strava API 加载并分析 Strava 活动、统计数据与训练记录
homepage: https://developers.strava.com/
metadata: {"clawdbot":{"emoji":"🏃","requires":{"bins":["curl"],"env":["STRAVA_ACCESS_TOKEN"]},"primaryEnv":"STRAVA_ACCESS_TOKEN"}}
---
# Strava Skill

通过 Strava API 加载活动、分析训练数据并追踪健身指标。

## 设置步骤

### 1. 创建 Strava API 应用

1. 访问 https://www.strava.com/settings/api  
2. 创建应用（测试时回调地址使用 `http://localhost`）  
3. 记下您的 **Client ID** 与 **Client Secret**

### 2. 获取初始 OAuth Token

在浏览器中打开以下 URL（将 CLIENT_ID 替换为您的实际值）：  
```
https://www.strava.com/oauth/authorize?client_id=CLIENT_ID&response_type=code&redirect_uri=http://localhost&approval_prompt=force&scope=activity:read_all
```  

授权后，您将被重定向至 `http://localhost/?code=AUTHORIZATION_CODE`  

使用授权码换取 token：  
```bash
curl -X POST https://www.strava.com/oauth/token \
  -d client_id=YOUR_CLIENT_ID \
  -d client_secret=YOUR_CLIENT_SECRET \
  -d code=AUTHORIZATION_CODE \
  -d grant_type=authorization_code
```  

返回结果包含 `access_token` 与 `refresh_token`。

### 3. 配置凭证

添加至 `~/.clawdbot/clawdbot.json`：  
```json
{
  "skills": {
    "entries": {
      "strava": {
        "enabled": true,
        "env": {
          "STRAVA_ACCESS_TOKEN": "your-access-token",
          "STRAVA_REFRESH_TOKEN": "your-refresh-token",
          "STRAVA_CLIENT_ID": "your-client-id",
          "STRAVA_CLIENT_SECRET": "your-client-secret"
        }
      }
    }
  }
}
```  

或使用环境变量：  
```bash
export STRAVA_ACCESS_TOKEN="your-access-token"
export STRAVA_REFRESH_TOKEN="your-refresh-token"
export STRAVA_CLIENT_ID="your-client-id"
export STRAVA_CLIENT_SECRET="your-client-secret"
```  

## 使用方法

### 列出近期活动

获取最近 30 条活动：  
```bash
curl -s -H "Authorization: Bearer ${STRAVA_ACCESS_TOKEN}" \
  "https://www.strava.com/api/v3/athlete/activities?per_page=30"
```  

获取最近 10 条活动：  
```bash
curl -s -H "Authorization: Bearer ${STRAVA_ACCESS_TOKEN}" \
  "https://www.strava.com/api/v3/athlete/activities?per_page=10"
```  

### 按日期筛选活动

获取指定日期之后的活动（Unix 时间戳）：  
```bash
# Activities after Jan 1, 2024
curl -s -H "Authorization: Bearer ${STRAVA_ACCESS_TOKEN}" \
  "https://www.strava.com/api/v3/athlete/activities?after=1704067200"
```  

获取指定日期范围内的活动：  
```bash
# Activities between Jan 1 - Jan 31, 2024
curl -s -H "Authorization: Bearer ${STRAVA_ACCESS_TOKEN}" \
  "https://www.strava.com/api/v3/athlete/activities?after=1704067200&before=1706745600"
```  

### 获取活动详情

获取某条活动的完整详情（替换 ACTIVITY_ID）：  
```bash
curl -s -H "Authorization: Bearer ${STRAVA_ACCESS_TOKEN}" \
  "https://www.strava.com/api/v3/activities/ACTIVITY_ID"
```  

### 获取运动员个人资料

获取已认证运动员的个人资料：  
```bash
curl -s -H "Authorization: Bearer ${STRAVA_ACCESS_TOKEN}" \
  "https://www.strava.com/api/v3/athlete"
```  

### 获取运动员统计数据

获取运动员统计数据（替换 ATHLETE_ID）：  
```bash
curl -s -H "Authorization: Bearer ${STRAVA_ACCESS_TOKEN}" \
  "https://www.strava.com/api/v3/athletes/ATHLETE_ID/stats"
```  

### 分页

翻页操作：  
```bash
# Page 1 (default)
curl -s -H "Authorization: Bearer ${STRAVA_ACCESS_TOKEN}" \
  "https://www.strava.com/api/v3/athlete/activities?page=1&per_page=30"

# Page 2
curl -s -H "Authorization: Bearer ${STRAVA_ACCESS_TOKEN}" \
  "https://www.strava.com/api/v3/athlete/activities?page=2&per_page=30"
```  

## Token 刷新

Access token 每 6 小时过期。使用辅助脚本刷新：  
```bash
bash {baseDir}/scripts/refresh_token.sh
```  

或手动刷新：  
```bash
curl -s -X POST https://www.strava.com/oauth/token \
  -d client_id="${STRAVA_CLIENT_ID}" \
  -d client_secret="${STRAVA_CLIENT_SECRET}" \
  -d grant_type=refresh_token \
  -d refresh_token="${STRAVA_REFRESH_TOKEN}"
```  

响应中包含新的 `access_token` 与 `refresh_token`。请在配置中同时更新这两个 token。

## 常见数据字段

Activity 对象包含以下字段：  
- `name` —— 活动标题  
- `distance` —— 距离（米）  
- `moving_time` —— 移动时间（秒）  
- `elapsed_time` —— 总耗时（秒）  
- `total_elevation_gain` —— 海拔上升（米）  
- `type` —— 活动类型（Run、Ride、Swim 等）  
- `sport_type` —— 具体运动类型  
- `start_date` —— 开始时间（ISO 8601 格式）  
- `average_speed` —— 平均速度（米/秒）  
- `max_speed` —— 最高速度（米/秒）  
- `average_heartrate` —— 平均心率（如可用）  
- `max_heartrate` —— 最高心率（如可用）  
- `kudos_count` —— 获得的点赞数（kudos）

## 速率限制

- **每 15 分钟最多 200 次请求**  
- **每日最多 2000 次请求**  

若触发速率限制，响应头中将包含 `X-RateLimit-*` 字段。

## 使用技巧

- Unix 时间戳转换：Linux 使用 `date -d @TIMESTAMP`，macOS 使用 `date -r TIMESTAMP`  
- 米 → 公里：除以 1000  
- 米 → 英里：除以 1609.34  
- 米/秒 → 公里/小时：乘以 3.6  
- 米/秒 → 英里/小时：乘以 2.237  
- 秒 → 小时：除以 3600  
- JSON 解析：如有 `jq` 可用，推荐使用；否则可用 `grep`/`sed` 进行基础提取  

## 示例

获取上周的跑步活动及其距离：  
```bash
LAST_WEEK=$(date -d '7 days ago' +%s 2>/dev/null || date -v-7d +%s)
curl -s -H "Authorization: Bearer ${STRAVA_ACCESS_TOKEN}" \
  "https://www.strava.com/api/v3/athlete/activities?after=${LAST_WEEK}&per_page=50" \
  | grep -E '"name"|"distance"|"type"'
```  

获取近期活动的总距离：  
```bash
curl -s -H "Authorization: Bearer ${STRAVA_ACCESS_TOKEN}" \
  "https://www.strava.com/api/v3/athlete/activities?per_page=10" \
  | grep -o '"distance":[0-9.]*' | cut -d: -f2 | awk '{sum+=$1} END {print sum/1000 " km"}'
```  

## 错误处理

若收到 401 Unauthorized 错误，说明 access token 已过期，请运行 token 刷新命令。

若收到速率限制错误，请等待限流窗口重置（检查 `X-RateLimit-Usage` 响应头）。