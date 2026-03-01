---
name: gong
name_zh: Gong
description: Gong API，用于搜索通话录音、转录文本及对话智能数据。当处理 Gong 通话录音、销售对话、转录文本、会议数据或对话分析时使用。支持列出通话、获取转录文本、用户管理以及活动统计。
description_zh: Gong API，用于搜索通话录音、转录文本及对话智能数据。当处理 Gong 通话录音、销售对话、转录文本、会议数据或对话分析时使用。支持列出通话、获取转录文本、用户管理以及活动统计。
---
# Gong

访问 Gong 对话智能数据——包括通话、转录文本、用户和分析结果。

## 设置

将凭据存储在 `~/.config/gong/credentials.json` 中：
```json
{
  "base_url": "https://us-XXXXX.api.gong.io",
  "access_key": "YOUR_ACCESS_KEY",
  "secret_key": "YOUR_SECRET_KEY"
}
```

从 Gong 获取凭据：设置 → 生态系统 → API → 创建 API 密钥。

## 认证

```bash
GONG_CREDS=~/.config/gong/credentials.json
GONG_BASE=$(jq -r '.base_url' $GONG_CREDS)
GONG_AUTH=$(jq -r '"\(.access_key):\(.secret_key)"' $GONG_CREDS | base64)

curl -s "$GONG_BASE/v2/endpoint" \
  -H "Authorization: Basic $GONG_AUTH" \
  -H "Content-Type: application/json"
```

## 核心操作

### 列出用户
```bash
curl -s "$GONG_BASE/v2/users" -H "Authorization: Basic $GONG_AUTH" | \
  jq '[.users[] | {id, email: .emailAddress, name: "\(.firstName) \(.lastName)"}]'
```

### 列出通话（支持日期范围）
```bash
curl -s -X POST "$GONG_BASE/v2/calls/extensive" \
  -H "Authorization: Basic $GONG_AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "fromDateTime": "2025-01-01T00:00:00Z",
      "toDateTime": "2025-01-31T23:59:59Z"
    },
    "contentSelector": {}
  }' | jq '{
    total: .records.totalRecords,
    calls: [.calls[] | {
      id: .metaData.id,
      title: .metaData.title,
      started: .metaData.started,
      duration_min: ((.metaData.duration // 0) / 60 | floor),
      url: .metaData.url
    }]
  }'
```

### 获取通话转录文本
```bash
curl -s -X POST "$GONG_BASE/v2/calls/transcript" \
  -H "Authorization: Basic $GONG_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"filter": {"callIds": ["CALL_ID"]}}' | \
  jq '.callTranscripts[0].transcript[] | "\(.speakerName // "Speaker"): \(.sentences[].text)"' -r
```

### 获取通话详情
```bash
curl -s -X POST "$GONG_BASE/v2/calls/extensive" \
  -H "Authorization: Basic $GONG_AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {"callIds": ["CALL_ID"]},
    "contentSelector": {"exposedFields": {"content": true, "parties": true}}
  }' | jq '.calls[0]'
```

### 活动统计
```bash
curl -s -X POST "$GONG_BASE/v2/stats/activity/aggregate" \
  -H "Authorization: Basic $GONG_AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "fromDateTime": "2025-01-01T00:00:00Z",
      "toDateTime": "2025-01-31T23:59:59Z"
    }
  }'
```

## 端点参考

| 端点 | 方法 | 用途 |
|----------|--------|-----|
| `/v2/users` | GET | 列出用户 |
| `/v2/calls/extensive` | POST | 列出/筛选通话 |
| `/v2/calls/transcript` | POST | 获取转录文本 |
| `/v2/stats/activity/aggregate` | POST | 活动统计 |
| `/v2/meetings` | GET | 已安排的会议 |

## 分页

响应中包含用于分页的游标（cursor）：
```json
{"records": {"totalRecords": 233, "cursor": "eyJ..."}}
```

在下一次请求中包含该游标：`{"cursor": "eyJ..."}`

## 日期辅助工具

```bash
# Last 7 days
FROM=$(date -v-7d +%Y-%m-%dT00:00:00Z 2>/dev/null || date -d "7 days ago" +%Y-%m-%dT00:00:00Z)
TO=$(date +%Y-%m-%dT23:59:59Z)
```

## 注意事项

- 速率限制：约每秒 3 次请求  
- 通话 ID 是以字符串形式表示的大整数  
- 通话结束后，转录文本可能需要一定时间才能完成处理  
- 日期格式：ISO 8601（例如：`2025-01-15T00:00:00Z`）