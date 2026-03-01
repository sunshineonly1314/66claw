---
name: overseerr-request-media
description: 利用用户的 Overseerr 实例请求电影或电视剧。Overseerr 将请求转发至 Sonarr/Radarr。
description_zh: 利用用户的 Overseerr 实例请求电影或电视剧。Overseerr 将请求转发至 Sonarr/Radarr。
---
# Overseerr 请求媒体 Skill

## 目的
利用用户的 Overseerr 实例请求电影或电视剧。Overseerr 将请求转发至 Sonarr/Radarr。

## 要求
环境变量：
- OVERSEERR_URL（示例：https://overseerr.yourdomain.com）
- OVERSEERR_API_KEY

认证请求头：
- X-Api-Key: $OVERSEERR_API_KEY

Overseerr 可根据您配置的 Plex + Sonarr/Radarr 连接，自动判断媒体是否已存在或已被请求。

## 本 skill 支持的用户请求示例
- “请求《星际穿越》”
- “将《星际穿越》添加到 Overseerr”
- “请求《重启人生》第 2 季”
- “请求《办公室》第 2–4 季”

## 工作流程（务必严格遵循）

### 1) 解析用户请求
提取以下信息：
- 标题
- 可选类型提示：movie（电影）或 tv（剧集）
- 可选季数请求：
  - “第 2 季”
  - “第 1–3 季”
  - “第 1 季和第 4 季”

### 2) 在 Overseerr 中搜索
GET 请求：
$OVERSEERR_URL/api/v1/search?query=<URL 编码后的标题>

示例：
curl -s -H "X-Api-Key: $OVERSEERR_API_KEY" \
"$OVERSEERR_URL/api/v1/search?query=interstellar"

### 3) 若结果存在歧义（同名电影 vs 剧集），需向用户澄清
若搜索结果同时包含：
- 一部电影匹配项，以及
- 一部剧集匹配项，
且二者标题相同（或高度相似），

则必须在发起请求前向用户征询选择。

最多展示 2–4 个选项，例如：
- 电影：《标题》（年份）
- 剧集：《标题》（年份）

若用户已提供明确提示（如 “电影”、“剧集”、“tv”、“第 2 季”），则自动选择对应类型。

### 4) 选取最优匹配项
规则如下：
- 优先选择标题完全匹配的结果
- 当存在多个结果时，优先选择人气值最高的结果
- 若用户提供了类型提示（电影 vs 剧集），则严格遵从

### 5) 检查媒体是否已存在（已入库或已被请求）
在创建请求前：
- 检查所选结果中 Overseerr 返回的可用性/请求状态信息（库内状态/可用性/请求状态指示器）
- 若显示该媒体已在媒体库中可用：
  - 不发起请求
  - 回复：“已可用 ✅”
- 若显示该媒体已被请求（pending/processing/approved/requested）：
  - 不重复请求
  - 回复：“已请求 ✅”

若 API 响应未明确指示状态：
- 继续发起请求
- 若 POST 请求因重复/已存在而失败，则回复：“已请求 ✅”

### 6) 创建请求
POST 请求：
$OVERSEERR_URL/api/v1/request

电影 JSON 示例：
{
  "mediaType": "movie",
  "mediaId": <tmdbId>
}

剧集 JSON（全系列）：
{
  "mediaType": "tv",
  "mediaId": <tmdbId>
}

剧集 JSON（特定季）：
{
  "mediaType": "tv",
  "mediaId": <tmdbId>,
  "seasons": [2,3]
}

示例：

电影：
curl -s -X POST \
-H "X-Api-Key: $OVERSEERR_API_KEY" \
-H "Content-Type: application/json" \
"$OVERSEERR_URL/api/v1/request" \
-d '{"mediaType":"movie","mediaId":157336}'

剧集（全系列）：
curl -s -X POST \
-H "X-Api-Key: $OVERSEERR_API_KEY" \
-H "Content-Type: application/json" \
"$OVERSEERR_URL/api/v1/request" \
-d '{"mediaType":"tv","mediaId":71912}'

剧集（第 2 季）：
curl -s -X POST \
-H "X-Api-Key: $OVERSEERR_API_KEY" \
-H "Content-Type: application/json" \
"$OVERSEERR_URL/api/v1/request" \
"$OVERSEERR_URL/api/v1/request" \
-d '{"mediaType":"tv","mediaId":71912,"seasons":[2]}'

### 7) 清晰响应
- 确认已请求的内容
- 若为部分剧集请求，列出具体季数
- 若已请求或已可用，明确告知
- 若无搜索结果，建议用户提供其他拼写或补充上下文

## 输出风格
简洁确认语句：
- “✅ 已请求：《星际穿越》（2014）”
- “✅ 已请求：《重启人生》（第 2 季）”
- “已请求 ✅”
- “已可用 ✅”

## 错误处理
- 若搜索返回 0 条结果：
  - 建议用户尝试其他标题或补充年份
- 若仍存在多个质量相当的匹配项：
  - 请用户从 2–4 个选项中择一确认