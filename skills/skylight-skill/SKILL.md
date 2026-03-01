---
name: skylight
name_zh: 天光技能
description: 与 Skylight 日历智能显示屏交互 —— 管理日历事件、家务任务、清单、任务框条目及奖励。当用户希望查看/创建日历事件、管理家庭家务、操作购物或待办清单、查询奖励积分，或与其 Skylight 智能显示屏交互时使用。
description_zh: 与 Skylight 日历智能显示屏交互 —— 管理日历事件、家务任务、清单、任务框条目及奖励。当用户希望查看/创建日历事件、管理家庭家务、操作购物或待办清单、查询奖励积分，或与其 Skylight 智能显示屏交互时使用。
homepage: https://ourskylight.com
metadata:
  clawdbot:
    emoji: 📅
    requires:
      bins:
        - curl
      env:
        - SKYLIGHT_FRAME_ID
    primaryEnv: SKYLIGHT_EMAIL
---
# Skylight 日历

通过非官方 API 控制 Skylight 日历智能显示屏。

## 设置

设置环境变量：
- `SKYLIGHT_URL`：基础 URL（默认：`https://app.ourskylight.com`）  
- `SKYLIGHT_FRAME_ID`：您的 Frame（家庭）ID —— 登录 [ourskylight.com](https://ourskylight.com/)，点击您的日历，从 URL 末尾复制该数字（例如，从 `https://ourskylight.com/calendar/4197102` 中提取 `4197102`）

**认证（二选一）：**

方案 A —— 邮箱/密码（推荐）：
- `SKYLIGHT_EMAIL`：您的 Skylight 账户邮箱  
- `SKYLIGHT_PASSWORD`：您的 Skylight 账户密码  

方案 B —— 预捕获令牌：
- `SKYLIGHT_TOKEN`：完整的 Authorization 请求头值（例如：`Basic abc123...`）

## 认证

### 方案 A：使用邮箱/密码登录（推荐）

通过邮箱与密码登录生成令牌：

```bash
# Login and get user credentials
LOGIN_RESPONSE=$(curl -s -X POST "$SKYLIGHT_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'"$SKYLIGHT_EMAIL"'",
    "password": "'"$SKYLIGHT_PASSWORD"'",
    "name": "",
    "phone": "",
    "resettingPassword": "false",
    "textMeTheApp": "true",
    "agreedToMarketing": "true"
  }')

# Extract user_id and user_token from response
USER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.data.id')
USER_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.attributes.token')

# Generate Basic auth token (base64 of user_id:user_token)
SKYLIGHT_TOKEN="Basic $(echo -n "${USER_ID}:${USER_TOKEN}" | base64)"

# Now use $SKYLIGHT_TOKEN for all API requests
```

登录端点返回：
- `data.id`：用户 ID  
- `data.attributes.token`：用户令牌  

组合为 `{user_id}:{user_token}` 并进行 Base64 编码，用于 Basic 认证。

### 方案 B：通过代理捕获令牌

若您倾向手动捕获令牌：

1. 安装 Proxyman/Charles/mitmproxy 并信任其根证书  
2. 为 `app.ourskylight.com` 启用 SSL 代理  
3. 登录 Skylight 应用并捕获任意 API 请求  
4. 复制 `Authorization` 请求头值（例如：`Basic <token>`）

令牌在登出后失效；重新登录后需再次捕获。

## API 格式

响应采用 JSON:API 格式，包含 `data`、`included` 和 `relationships` 字段。

## 日历事件

### 列出事件
```bash
curl -s "$SKYLIGHT_URL/api/frames/$SKYLIGHT_FRAME_ID/calendar_events?date_min=2025-01-27&date_max=2025-01-31" \
  -H "Authorization: $SKYLIGHT_TOKEN" \
  -H "Accept: application/json"
```

查询参数：
- `date_min`（必需）：起始日期 YYYY-MM-DD  
- `date_max`（必需）：结束日期 YYYY-MM-DD  
- `timezone`：时区字符串（可选）  
- `include`：相关资源 CSV（`categories,calendar_account,event_notification_setting`）

### 列出源日历
```bash
curl -s "$SKYLIGHT_URL/api/frames/$SKYLIGHT_FRAME_ID/source_calendars" \
  -H "Authorization: $SKYLIGHT_TOKEN"
```

## 家务任务

### 列出家务
```bash
curl -s "$SKYLIGHT_URL/api/frames/$SKYLIGHT_FRAME_ID/chores?after=2025-01-27&before=2025-01-31" \
  -H "Authorization: $SKYLIGHT_TOKEN"
```

查询参数：
- `after`：起始日期 YYYY-MM-DD  
- `before`：结束日期 YYYY-MM-DD  
- `include_late`：是否包含逾期家务（布尔值）  
- `filter`：按 `linked_to_profile` 过滤  

### 创建家务
```bash
curl -s -X POST "$SKYLIGHT_URL/api/frames/$SKYLIGHT_FRAME_ID/chores" \
  -H "Authorization: $SKYLIGHT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "type": "chore",
      "attributes": {
        "summary": "Take out trash",
        "status": "pending",
        "start": "2025-01-28",
        "start_time": "08:00",
        "recurring": false
      },
      "relationships": {
        "category": {
          "data": {"type": "category", "id": "CATEGORY_ID"}
        }
      }
    }
  }'
```

家务属性：
- `summary`：家务标题  
- `status`：`pending` 或 `completed`  
- `start`：日期 YYYY-MM-DD  
- `start_time`：时间 HH:MM（可选）  
- `recurring`：布尔值  
- `recurrence_set`：RRULE 字符串（用于周期性家务）  
- `reward_points`：整数（可选）  
- `emoji_icon`：Emoji（可选）  

## 清单（购物/待办）

### 列出全部清单
```bash
curl -s "$SKYLIGHT_URL/api/frames/$SKYLIGHT_FRAME_ID/lists" \
  -H "Authorization: $SKYLIGHT_TOKEN"
```

### 获取含条目的清单
```bash
curl -s "$SKYLIGHT_URL/api/frames/$SKYLIGHT_FRAME_ID/lists/{listId}" \
  -H "Authorization: $SKYLIGHT_TOKEN"
```

响应包含 `data.attributes.kind`（`shopping` 或 `to_do`）及 `included` 数组（含清单条目）。

清单条目属性：
- `label`：条目文本  
- `status`：`pending` 或 `completed`  
- `section`：分区名称（可选）  
- `position`：排序序号  

## 任务框

### 创建任务框条目
```bash
curl -s -X POST "$SKYLIGHT_URL/api/frames/$SKYLIGHT_FRAME_ID/task_box/items" \
  -H "Authorization: $SKYLIGHT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "type": "task_box_item",
      "attributes": {
        "summary": "Pack lunches"
      }
    }
  }'
```

任务框属性：
- `summary`：任务标题  
- `emoji_icon`：Emoji（可选）  
- `routine`：布尔值（可选）  
- `reward_points`：整数（可选）  

## 分类

### 列出分类
```bash
curl -s "$SKYLIGHT_URL/api/frames/$SKYLIGHT_FRAME_ID/categories" \
  -H "Authorization: $SKYLIGHT_TOKEN"
```

分类用于为家庭成员分配家务。属性包括：
- `label`：分类名称（例如：“妈妈”、“爸爸”、“孩子”）  
- `color`：十六进制颜色 `#RRGGBB`  
- `profile_pic_url`：头像 URL  

## 奖励

### 列出奖励
```bash
curl -s "$SKYLIGHT_URL/api/frames/$SKYLIGHT_FRAME_ID/rewards" \
  -H "Authorization: $SKYLIGHT_TOKEN"
```

可选查询参数：`redeemed_at_min`（datetime），用于按兑换日期过滤。

### 列出奖励积分
```bash
curl -s "$SKYLIGHT_URL/api/frames/$SKYLIGHT_FRAME_ID/reward_points" \
  -H "Authorization: $SKYLIGHT_TOKEN"
```

## Frame 信息

### 获取 Frame 详情
```bash
curl -s "$SKYLIGHT_URL/api/frames/$SKYLIGHT_FRAME_ID" \
  -H "Authorization: $SKYLIGHT_TOKEN"
```

### 列出设备
```bash
curl -s "$SKYLIGHT_URL/api/frames/$SKYLIGHT_FRAME_ID/devices" \
  -H "Authorization: $SKYLIGHT_TOKEN"
```

## 注意事项

- API 为 **非官方且经逆向工程所得**；端点可能变更  
- 令牌在登出后失效；必要时请重新捕获  
- 数据未变更时响应返回 304 Not Modified  
- 使用 `jq` 解析 JSON:API 响应  
- Frame ID 即您的家庭标识符；所有资源均以此为作用域  