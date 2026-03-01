---
name: kallyai
name_zh: KallyAI
description: 通过 KallyAI API 拨打电话 — 一款代表用户致电企业的 AI 电话助理。适用于用户希望电话预订餐厅、预约就诊或向企业进行电话咨询等场景。
description_zh: 通过 KallyAI API 拨打电话 — 一款代表用户致电企业的 AI 电话助理。适用于用户希望电话预订餐厅、预约就诊或向企业进行电话咨询等场景。
metadata: {"clawdbot":{"emoji":"📞","requires":{"bins":["kallyai"]},"install":[{"id":"pip","kind":"uv","package":"kallyai-cli","bins":["kallyai"],"label":"Install via pip"}]}}
---
# KallyAI API 集成

KallyAI 是一款 AI 电话助理，可代表用户致电企业。

## 完整工作流

当用户提出拨打电话请求时：

### 步骤 1：收集通话详情

向用户确认以下信息：
- **电话号码**（必需）  
- **通话目标** — 任务描述（必需）  
- **类别**：餐厅、诊所、酒店或通用（必需）  
- 若为预订类：姓名、日期、时间、人数  

### 步骤 2：用户身份认证

使用 CLI 的 OAuth 流程：  
```
https://api.kallyai.com/v1/auth/cli?redirect_uri=http://localhost:8976/callback
```  

该操作将打开登录页面。完成认证后，用户将被重定向至本地回调地址（localhost callback），并附带令牌：  
```
http://localhost:8976/callback?access_token=<token>&refresh_token=<refresh>&expires_in=3600
```  

启动一个本地 HTTP 服务器，用于捕获回调并提取令牌。

### 步骤 3：发起通话

完成认证后，调用 API 发起通话：  

```
POST https://api.kallyai.com/v1/calls
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "submission": {
    "task_category": "general",
    "task_description": "Ask about store hours and availability",
    "respondent_phone": "+15551234567",
    "language": "en",
    "call_language": "en"
  },
  "timezone": "America/New_York"
}
```  

### 步骤 4：报告结果

响应内容包含：  
```json
{
  "call_id": "uuid",
  "status": "success",
  "highlights": "They have iPhone 15 for €800, good condition",
  "next_steps": "Call back to arrange pickup"
}
```  

**状态值：** `success`、`no_answer`、`busy`、`failed`、`voicemail`、`cancelled`  

---

## CLI 命令参考

### 发起通话

```bash
kallyai -p "+15551234567" -t "Reserve a table for 4 at 8pm" \
  --category restaurant \
  --name "John Smith" \
  --party-size 4 \
  --date "2026-01-28" \
  --time "20:00"
```

| 选项 | 简写 | 描述 |
|------|------|------|
| `--phone` | `-p` | 电话号码（E.164 格式） |
| `--task` | `-t` | AI 需完成的任务描述 |
| `--category` | `-c` | 类别：restaurant（餐厅）、clinic（诊所）、hotel（酒店）或 general（通用） |
| `--language` | `-l` | 语言：en（英语）或 es（西班牙语） |
| `--name` | — | 姓名（用于预订） |
| `--business` | — | 企业名称 |
| `--party-size` | — | 用餐人数（餐厅） |
| `--date` | — | YYYY-MM-DD 格式日期 |
| `--time` | — | HH:MM 格式时间（24 小时制） |

### 账户与用量

```bash
kallyai --usage        # Show minutes/calls remaining
kallyai --subscription # Show subscription status
kallyai --billing      # Open Stripe billing portal
```

### 通话历史记录

```bash
kallyai --history              # List recent calls
kallyai --call-info <ID>       # Get call details
kallyai --transcript <ID>      # Get conversation transcript
```

### 认证管理

```bash
kallyai --login      # Force re-authentication
kallyai --logout     # Clear saved credentials
kallyai --auth-status # Check if logged in
```

---

## 快速参考

**基础 URL：** `https://api.kallyai.com`  

**CLI OAuth URL：** `https://api.kallyai.com/v1/auth/cli?redirect_uri=http://localhost:8976/callback`  

**通话必需字段：**  
| 字段 | 描述 |
|------|------|
| `task_category` | `restaurant`、`clinic`、`hotel`、`general` |
| `task_description` | AI 需完成的任务描述 |
| `respondent_phone` | E.164 格式电话号码（例如 +1234567890） |

**可选字段：**  
| 字段 | 描述 |
|------|------|
| `business_name` | 企业名称 |
| `user_name` | 预订人姓名 |
| `appointment_date` | YYYY-MM-DD 格式日期 |
| `appointment_time` | HH:MM 格式时间（24 小时制） |
| `party_size` | 人数（1–50） |
| `language` | `en` 或 `es` |
| `call_language` | `en` 或 `es` |

## 示例请求

**餐厅预订：**  
```json
{
  "submission": {
    "task_category": "restaurant",
    "task_description": "Reserve table for 4 at 8pm",
    "respondent_phone": "+14155551234",
    "business_name": "Italian Bistro",
    "user_name": "John Smith",
    "party_size": 4,
    "appointment_date": "2026-01-28",
    "appointment_time": "20:00"
  },
  "timezone": "America/New_York"
}
```  

**医疗预约：**  
```json
{
  "submission": {
    "task_category": "clinic",
    "task_description": "Schedule dental checkup",
    "respondent_phone": "+14155551234",
    "user_name": "Jane Doe",
    "time_preference_text": "morning before 11am"
  },
  "timezone": "America/New_York"
}
```  

## 常见错误

| 错误码 | HTTP 状态码 | 应对措施 |
|--------|-------------|----------|
| `quota_exceeded` | 402 | 用户需访问 kallyai.com/pricing 升级账户 |
| `missing_phone_number` | 422 | 提示用户提供电话号码 |
| `emergency_number` | 422 | 不支持拨打 911 或其他紧急服务号码 |
| `country_restriction` | 403 | 当前国家/地区暂不支持 |

## 安全机制

- **令牌存储**：`~/.kallyai_token.json`，权限设为 0600  
- **CSRF 防护**：校验 state 参数  
- **仅限本地回环**：OAuth 重定向地址仅允许 localhost / 127.0.0.1  
- **自动刷新**：令牌过期时自动刷新  