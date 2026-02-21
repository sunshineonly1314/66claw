# ClawdBot 日志上报运维中心 - 服务端 API 需求文档

> 给 tecbinhome 服务端（obplugins.cn）的需求文档
> 文档版本：v1.0
> 创建时间：2026-02-21
> 客户端版本：ClawdBot (OpenClawCN) v1.1.10+
> 优先级说明：P0=阻塞发布，P1=发布后尽快，P2=后续迭代

---

## 一、概述

ClawdBot (OpenClawCN) 控制面板的「日志」页面新增「日志上报运维中心」功能。用户在遇到问题时，可以通过该功能一键将日志和问题描述提交到远程运维中心，由运维人员分析后给出回复。用户提交后获得一个 6 位工单码，可随时查询处理进度和回复内容。

### 1.1 功能流程

```
用户在日志页面填写问题描述 + 截图（可选）
        ↓
客户端自动采集最近 500 条日志 + 设备信息
        ↓
POST /api/api/v1/log-report/submit → 服务端存储
        ↓
服务端返回 6 位工单码（如 AB12CD）
        ↓
用户可通过工单码查询进度和回复
GET /api/api/v1/log-report/status?ticketCode=AB12CD
```

### 1.2 API 基础信息

| 项目 | 值 |
|------|-----|
| Base URL | `https://www.obplugins.cn/api/api/v1/log-report` |
| 协议 | HTTPS（必须） |
| 请求格式 | JSON |
| 响应格式 | JSON |
| 字符编码 | UTF-8 |
| 最大请求体 | 10MB |

### 1.3 与现有反馈系统的关系

客户端网关已有 `https://www.obplugins.cn/api/api/v1/feedback/` 反馈接口。日志上报是独立的新功能，但遵循相同的 API 风格和认证方式。两者的区别：

| 对比项 | 反馈系统 (feedback) | 日志上报 (log-report) |
|--------|---------------------|----------------------|
| 用途 | 建议/Bug 反馈 | 运维级别日志诊断 |
| 内容 | 文字描述 + 截图 | 文字描述 + 截图 + **500 条日志** |
| 回复机制 | 无 | **有工单码 + 状态追踪 + 运维回复** |
| 频率限制 | 无特殊限制 | 每设备每天最多 2 次 |
| 数据量 | 较小 | 较大（日志 + 截图，最大 10MB） |

---

## 二、用户端 API 接口详细规范

### 2.1 提交日志报告 `POST /submit` 【P0 必须】

接收来自 ClawdBot 网关的日志报告。

**请求头**:

| Header | 值 | 说明 |
|--------|-----|------|
| Content-Type | `application/json` | 必须 |
| User-Agent | `OpenClawCN-Gateway/1.0` | 必须校验，防止非法调用 |

**请求体** (JSON):

```json
{
  "id": "rpt-m1abc-x2y3z4",
  "deviceId": "device-xxxx-yyyy",
  "description": "模型无法响应，点击发送后一直转圈没有返回内容",
  "attachments": [
    "data:image/png;base64,iVBORw0KGgo..."
  ],
  "logEntries": [
    "{\"ts\":\"2026-02-21T11:59:58.000Z\",\"level\":\"error\",\"msg\":\"API request failed\"}",
    "{\"ts\":\"2026-02-21T11:59:59.000Z\",\"level\":\"info\",\"msg\":\"Retrying...\"}",
    "..."
  ],
  "context": {
    "version": "1.1.10",
    "platform": "win32",
    "hostname": "KEVINUP",
    "uptime": 3600,
    "timestamp": "2026-02-21T12:00:00.000Z"
  },
  "createdAt": "2026-02-21T12:00:00.000Z"
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 限制 | 说明 |
|------|------|------|------|------|
| `id` | string | 是 | 最长 64 字符 | 客户端生成的报告 ID，格式 `rpt-{timestamp36}-{random}` |
| `deviceId` | string | 是 | 最长 128 字符 | 设备唯一标识，由客户端自动生成，用于频率限制 |
| `description` | string | 是 | 5-2000 字符 | 用户描述的问题现象 |
| `attachments` | string[] | 否 | 最多 3 张，每张最大 1.5MB（客户端限制原始文件 ≤1MB，base64 编码后 ≤1.33MB） | 截图，以 base64 data URL 格式传递 |
| `logEntries` | string[] | 是 | 最多 500 条 | 最近 500 条日志原始行（每行为 JSON 字符串） |
| `context` | object | 是 | - | 设备/环境上下文 |
| `context.version` | string | 是 | 最长 20 字符 | ClawdBot 版本号 |
| `context.platform` | string | 是 | 最长 50 字符 | 操作系统标识（win32/darwin/linux） |
| `context.hostname` | string | 否 | 最长 128 字符 | 主机名 |
| `context.uptime` | number | 否 | >= 0 | 网关运行时长（秒） |
| `context.timestamp` | string | 是 | ISO 8601 | 客户端提交时的时间戳 |
| `createdAt` | string | 是 | ISO 8601 | 报告创建时间 |

**成功响应** (HTTP 200):

```json
{
  "success": true,
  "reportId": "rpt-m1abc-x2y3z4",
  "ticketCode": "AB12CD",
  "message": "报告已提交，工单号: AB12CD"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | boolean | 固定 `true` |
| `reportId` | string | 回传客户端的报告 ID |
| `ticketCode` | string | 服务端生成的 6 位工单码，用户凭此查询进度 |
| `message` | string | 用户可见的提示信息 |

**频率限制响应** (HTTP 429):

```json
{
  "success": false,
  "error": "RATE_LIMITED",
  "message": "每台设备每天最多提交2次日志报告",
  "retryAfter": "2026-02-22T00:00:00.000Z"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `error` | string | 错误码 `RATE_LIMITED` |
| `message` | string | 用户可见的提示 |
| `retryAfter` | string | ISO 8601，下次可提交的时间（次日零点 CST） |

**验证错误响应** (HTTP 400):

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "问题描述至少需要5个字符"
}
```

**服务器内部错误响应** (HTTP 500):

```json
{
  "success": false,
  "error": "INTERNAL_ERROR",
  "message": "服务器内部错误，请稍后重试"
}
```

---

### 2.2 查询报告状态 `GET /status` 【P0 必须】

用户通过工单码查询已提交报告的处理状态和运维回复。

**请求参数** (Query String):

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `ticketCode` | string | 是 | 6 位工单码（大写字母+数字） |

**请求示例**:

```
GET /api/api/v1/log-report/status?ticketCode=AB12CD
```

**成功响应** (HTTP 200):

```json
{
  "success": true,
  "report": {
    "ticketCode": "AB12CD",
    "status": "replied",
    "description": "模型无法响应，点击发送后一直转圈没有返回内容",
    "createdAt": "2026-02-21T12:00:00.000Z",
    "reply": {
      "content": "您的问题是因为API Key额度用完了，请到模型设置页面更换新的API Key。具体操作：设置 → 模型配置 → 选择对应模型 → 更换Key。",
      "repliedAt": "2026-02-21T14:30:00.000Z"
    }
  }
}
```

**状态枚举说明**:

| 状态值 | 含义 | 说明 |
|--------|------|------|
| `pending` | 待处理 | 报告已提交，等待运维人员查看 |
| `analyzing` | 分析中 | 运维人员正在分析日志 |
| `replied` | 已回复 | 运维人员已回复，`reply` 字段非空 |
| `closed` | 已关闭 | 工单已关闭（已解决或无法处理） |

**`reply` 字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `content` | string | 回复内容 |
| `repliedAt` | string | 回复时间（ISO 8601） |

当状态为 `pending` 或 `analyzing` 时，`reply` 字段为 `null`。

**工单码不存在响应** (HTTP 404):

```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "未找到对应的报告，请检查工单号是否正确"
}
```

---

### 2.3 健康检查 `GET /health` 【P0 必须】

客户端用于检测日志上报服务是否可用。

**请求示例**:

```
GET /api/api/v1/log-report/health
```

**响应** (HTTP 200):

```json
{
  "status": "ok",
  "timestamp": "2026-02-21T12:00:00.000Z"
}
```

**服务不可用** (HTTP 503):

```json
{
  "status": "error",
  "timestamp": "2026-02-21T12:00:00.000Z",
  "message": "Database connection failed"
}
```

---

## 三、频率限制规则 【P0 必须】

### 3.1 限制策略

| 项目 | 规则 |
|------|------|
| 限制维度 | 按 `deviceId` 限制，不按 IP |
| 频率上限 | 每台设备每**自然日**最多 2 次提交 |
| 时区 | CST（UTC+8），即每天北京时间 00:00 重置计数 |
| HTTP 状态码 | 超限时返回 `429 Too Many Requests` |
| 错误码 | `RATE_LIMITED` |

### 3.2 实现建议

```sql
-- 检查当日提交次数
SELECT COUNT(*) as cnt
FROM log_reports
WHERE device_id = ?
  AND created_at >= CURDATE()  -- MySQL: 当日零点 (服务器时区需设为 UTC+8)
```

或使用 Redis：

```
Key:   log-report:rate:{deviceId}:{YYYY-MM-DD}
Value: 提交次数
TTL:   48小时（自动清理）
```

---

## 四、工单码生成规则 【P0 必须】

### 4.1 字符集

为避免用户混淆相似字符，工单码使用受限字符集：

| 排除字符 | 原因 |
|----------|------|
| `0` 和 `O` | 数字零与字母 O 容易混淆 |
| `1`、`I`、`L` | 数字一与字母 I、L 容易混淆 |

**最终使用的字符集（29 个字符）**:

```
数字: 2 3 4 5 6 7 8 9
字母: A B C D E F G H J K M N P Q R S T U V W X Y Z
```

### 4.2 编码规格

| 项目 | 值 |
|------|-----|
| 长度 | 6 位 |
| 字符集大小 | 29 |
| 总组合数 | 29^6 = 594,823,321（约 5.9 亿） |
| 碰撞处理 | 生成后查数据库唯一索引，碰撞则重新生成 |

### 4.3 生成算法伪代码

```python
CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"  # 29字符

def generate_ticket_code():
    while True:
        code = ''.join(random.choices(CHARSET, k=6))
        if not db_exists("SELECT 1 FROM log_reports WHERE ticket_code = ?", code):
            return code
```

---

## 五、数据存储设计 【P0 必须】

### 5.1 数据库表结构

建议使用 MySQL 或 PostgreSQL，以下为 MySQL 建表语句：

```sql
CREATE TABLE log_reports (
    -- 主键：客户端生成的报告 ID
    id              VARCHAR(64)     NOT NULL PRIMARY KEY,

    -- 工单码：6位唯一码，用户查询用
    ticket_code     VARCHAR(6)      NOT NULL,

    -- 设备标识：用于频率限制
    device_id       VARCHAR(128)    NOT NULL,

    -- 用户描述的问题现象
    description     TEXT            NOT NULL,

    -- 报告状态
    status          ENUM('pending', 'analyzing', 'replied', 'closed')
                    NOT NULL DEFAULT 'pending',

    -- 运维回复内容（未回复时为 NULL）
    reply_content   TEXT            NULL,

    -- 回复时间
    replied_at      DATETIME        NULL,

    -- 设备/环境上下文信息（JSON 格式）
    context_json    JSON            NOT NULL,

    -- 压缩日志文件的存储路径
    log_entries_path VARCHAR(255)   NOT NULL COMMENT '压缩日志文件路径（gzip）',

    -- 附件文件路径/URL 列表（JSON 数组）
    attachments_json JSON           NULL COMMENT '附件文件路径数组，如 ["/data/attachments/rpt-xxx/1.png"]',

    -- 时间字段
    created_at      DATETIME        NOT NULL,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- 索引
    UNIQUE INDEX    idx_ticket_code (ticket_code),
    INDEX           idx_device_id (device_id),
    INDEX           idx_status (status),
    INDEX           idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 5.2 日志存储

日志条目数据量较大（500 条 JSON 行，可能达到数百 KB），不适合直接存入数据库。建议：

1. 将 `logEntries` 数组拼接为文本，使用 gzip 压缩
2. 存储到本地磁盘或 OSS
3. 文件路径记录在 `log_entries_path` 字段

**存储路径规范**:

```
/data/log-reports/
├── 2026/02/21/
│   ├── rpt-m1abc-x2y3z4/
│   │   ├── logs.jsonl.gz          ← 压缩日志文件
│   │   ├── attachment-1.png       ← 解码后的截图
│   │   ├── attachment-2.png
│   │   └── attachment-3.png
│   └── rpt-m2def-a5b6c7/
│       ├── logs.jsonl.gz
│       └── attachment-1.png
```

### 5.3 附件存储

客户端上传的截图为 base64 data URL 格式，服务端需要：

1. 解析 data URL，提取 MIME 类型和 base64 数据
2. 解码 base64 为二进制文件
3. 存储到磁盘或 OSS
4. 将文件路径/URL 存入 `attachments_json` 字段

**base64 data URL 解析示例**:

```
data:image/png;base64,iVBORw0KGgo...
     ↑ MIME type     ↑ base64 encoded data
```

---

## 六、管理端 API 接口 【P1 发布后尽快】

管理端 API 供运维人员使用，用于查看报告列表、查看详情、回复工单。所有管理端接口需要认证。

### 6.1 认证方式

| 方式 | 说明 |
|------|------|
| Bearer Token | `Authorization: Bearer <admin-token>` |
| 或 Basic Auth | `Authorization: Basic <base64(user:pass)>` |

认证失败返回 HTTP 401:

```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "认证失败，请检查凭据"
}
```

### 6.2 报告列表 `GET /admin/list` 【P1】

分页查询报告列表。

**请求参数** (Query String):

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `status` | string | 否 | 全部 | 按状态筛选：pending/analyzing/replied/closed |
| `deviceId` | string | 否 | - | 按设备 ID 筛选 |
| `page` | number | 否 | 1 | 页码，从 1 开始 |
| `pageSize` | number | 否 | 20 | 每页条数，最大 100 |

**请求示例**:

```
GET /api/api/v1/log-report/admin/list?status=pending&page=1&pageSize=20
Authorization: Bearer xxxxx
```

**响应**:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "rpt-m1abc-x2y3z4",
        "ticketCode": "AB12CD",
        "deviceId": "device-xxxx-yyyy",
        "description": "模型无法响应...",
        "status": "pending",
        "hasAttachments": true,
        "attachmentCount": 2,
        "logEntryCount": 500,
        "context": {
          "version": "1.1.10",
          "platform": "win32",
          "hostname": "KEVINUP"
        },
        "createdAt": "2026-02-21T12:00:00.000Z",
        "updatedAt": "2026-02-21T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 156,
      "totalPages": 8
    }
  }
}
```

### 6.3 报告详情 `GET /admin/detail/:id` 【P1】

获取单个报告的完整详情，包括解压后的日志内容。

**请求示例**:

```
GET /api/api/v1/log-report/admin/detail/rpt-m1abc-x2y3z4
Authorization: Bearer xxxxx
```

**响应**:

```json
{
  "success": true,
  "data": {
    "id": "rpt-m1abc-x2y3z4",
    "ticketCode": "AB12CD",
    "deviceId": "device-xxxx-yyyy",
    "description": "模型无法响应，点击发送后一直转圈没有返回内容",
    "status": "pending",
    "attachments": [
      "https://www.obplugins.cn/data/log-reports/2026/02/21/rpt-m1abc-x2y3z4/attachment-1.png",
      "https://www.obplugins.cn/data/log-reports/2026/02/21/rpt-m1abc-x2y3z4/attachment-2.png"
    ],
    "logEntries": [
      "{\"ts\":\"2026-02-21T11:59:58.000Z\",\"level\":\"error\",\"msg\":\"API request failed\"}",
      "{\"ts\":\"2026-02-21T11:59:59.000Z\",\"level\":\"info\",\"msg\":\"Retrying...\"}",
      "..."
    ],
    "context": {
      "version": "1.1.10",
      "platform": "win32",
      "hostname": "KEVINUP",
      "uptime": 3600,
      "timestamp": "2026-02-21T12:00:00.000Z"
    },
    "reply": null,
    "createdAt": "2026-02-21T12:00:00.000Z",
    "updatedAt": "2026-02-21T12:00:00.000Z"
  }
}
```

### 6.4 回复报告 `POST /admin/reply` 【P1】

运维人员对报告进行回复。回复后状态自动变为 `replied`，用户可通过工单码查询到回复内容。

**请求体**:

```json
{
  "reportId": "rpt-m1abc-x2y3z4",
  "content": "您的问题是因为API Key额度用完了，请到模型设置页面更换新的API Key。",
  "status": "replied"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `reportId` | string | 是 | 报告 ID |
| `content` | string | 是 | 回复内容（1-5000 字符） |
| `status` | string | 否 | 可选，设置报告状态。默认 `replied`，也可设为 `closed` |

**响应**:

```json
{
  "success": true,
  "message": "回复已发送",
  "data": {
    "reportId": "rpt-m1abc-x2y3z4",
    "ticketCode": "AB12CD",
    "status": "replied",
    "repliedAt": "2026-02-21T14:30:00.000Z"
  }
}
```

---

## 七、请求验证规则 【P0 必须】

### 7.1 提交接口 (`POST /submit`) 验证清单

| 序号 | 验证项 | 规则 | 错误信息 |
|------|--------|------|----------|
| 1 | Content-Type | 必须为 `application/json` | "Content-Type 必须为 application/json" |
| 2 | User-Agent | 必须包含 `OpenClawCN-Gateway` | "非法请求来源" |
| 3 | 请求体大小 | 不超过 10MB | "请求体过大" |
| 4 | `id` | 非空，最长 64 字符 | "报告ID无效" |
| 5 | `deviceId` | 非空，最长 128 字符 | "设备ID无效" |
| 6 | `description` | 非空，5-2000 字符 | "问题描述至少需要5个字符" / "问题描述不能超过2000个字符" |
| 7 | `attachments` | 可选，最多 3 项 | "最多只能上传3张图片" |
| 8 | `attachments[]` 单项 | 必须以 `data:image/` 开头，解码后不超过 3MB | "图片格式无效" / "单张图片不能超过3MB" |
| 9 | `logEntries` | 非空数组，最多 500 条 | "日志条目不能为空" / "日志条目最多500条" |
| 10 | `context.version` | 非空 | "版本号不能为空" |
| 11 | `context.platform` | 非空 | "平台信息不能为空" |
| 12 | `context.timestamp` | 合法 ISO 8601 | "时间戳格式无效" |
| 13 | `createdAt` | 合法 ISO 8601 | "创建时间格式无效" |
| 14 | 频率限制 | 当日该 deviceId 提交次数 < 2 | "每台设备每天最多提交2次日志报告" |

### 7.2 查询接口 (`GET /status`) 验证清单

| 序号 | 验证项 | 规则 | 错误信息 |
|------|--------|------|----------|
| 1 | `ticketCode` | 非空，6 位，仅含合法字符 | "工单号格式无效" |
| 2 | 存在性 | 数据库中存在该工单码 | "未找到对应的报告，请检查工单号是否正确" |

---

## 八、安全要求 【P0 必须】

### 8.1 输入安全

| 项目 | 要求 |
|------|------|
| XSS 防护 | 所有文本输入（description、reply_content）存储前进行 HTML 转义，防止在管理后台渲染时执行恶意脚本 |
| SQL 注入 | 使用参数化查询（预编译语句），禁止字符串拼接 SQL |
| 文件路径注入 | 附件存储路径由服务端生成，不使用客户端传入的任何文件名 |
| base64 验证 | 解码附件时验证是否为合法图片格式（PNG/JPEG/GIF/WebP） |

### 8.2 传输安全

| 项目 | 要求 |
|------|------|
| HTTPS | 所有接口必须通过 HTTPS 访问 |
| CORS | 如需跨域，仅允许 ClawdBot 网关来源 |

### 8.3 管理端安全

| 项目 | 要求 |
|------|------|
| 认证 | 所有 `/admin/*` 接口必须验证 Bearer Token 或 Basic Auth |
| 审计日志 | 记录管理端的所有操作（查看详情、回复等） |
| Token 管理 | 管理员 Token 应定期轮换 |

---

## 九、数据保留策略 【P2 后续迭代】

### 9.1 保留周期

| 数据类型 | 保留时长 | 说明 |
|----------|----------|------|
| 完整报告（含日志、附件） | 90 天 | 90 天后自动删除压缩日志文件和附件图片 |
| 摘要记录 | 1 年 | 仅保留 id、ticket_code、device_id、description、status、created_at 等字段，用于统计分析 |
| 摘要记录（归档后） | 永久保留或按策略清理 | 可选 |

### 9.2 自动清理任务

建议使用定时任务（cron）每日执行：

```
# 每天凌晨 3:00 (CST) 执行清理
0 3 * * * /path/to/cleanup-log-reports.sh
```

清理逻辑：

1. 查询 `created_at < NOW() - INTERVAL 90 DAY` 的报告
2. 删除对应的日志压缩文件（`log_entries_path`）
3. 删除对应的附件文件（`attachments_json` 中的路径）
4. 将 `log_entries_path` 和 `attachments_json` 字段置为 NULL
5. 查询 `created_at < NOW() - INTERVAL 1 YEAR` 的报告，删除整行记录

---

## 十、监控与告警 【P2 后续迭代】

### 10.1 日志记录

所有提交请求应记录以下信息：

```
[2026-02-21T12:00:00+08:00] LOG-REPORT SUBMIT
  reportId=rpt-m1abc-x2y3z4
  deviceId=device-xxxx-yyyy
  descLen=45
  attachments=2
  logEntries=500
  ip=1.2.3.4
  ua=OpenClawCN-Gateway/1.0
  result=SUCCESS ticketCode=AB12CD
```

### 10.2 告警规则

| 指标 | 阈值 | 告警方式 |
|------|------|----------|
| 提交速率 | > 100 次/小时 | 邮件/钉钉通知（可能存在滥用） |
| 存储空间 | 附件+日志总量 > 10GB | 邮件通知 |
| 错误率 | 5xx 错误率 > 5% | 邮件/钉钉通知 |
| 响应时间 | P99 > 5s | 邮件通知 |

### 10.3 统计看板（可选）

建议统计以下指标：

- 每日/每周提交量趋势
- 报告状态分布（pending / analyzing / replied / closed）
- 平均回复时长
- 设备分布（按 platform 统计）
- 版本分布（按 context.version 统计）

---

## 十一、错误码汇总

| HTTP 状态码 | 错误码 | 含义 |
|-------------|--------|------|
| 200 | - | 请求成功 |
| 400 | `VALIDATION_ERROR` | 请求参数验证失败 |
| 401 | `UNAUTHORIZED` | 管理端认证失败 |
| 404 | `NOT_FOUND` | 工单码不存在 |
| 413 | `PAYLOAD_TOO_LARGE` | 请求体超过 10MB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Content-Type 不正确 |
| 429 | `RATE_LIMITED` | 频率限制 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

## 十二、接口测试用例

### 12.1 正常提交

```bash
curl -X POST https://www.obplugins.cn/api/api/v1/log-report/submit \
  -H "Content-Type: application/json" \
  -H "User-Agent: OpenClawCN-Gateway/1.0" \
  -d '{
    "id": "rpt-test-001",
    "deviceId": "device-test-001",
    "description": "测试问题描述，模型无法响应",
    "attachments": [],
    "logEntries": ["{\"ts\":\"2026-02-21T12:00:00Z\",\"level\":\"info\",\"msg\":\"test\"}"],
    "context": {
      "version": "1.1.10",
      "platform": "win32",
      "timestamp": "2026-02-21T12:00:00.000Z"
    },
    "createdAt": "2026-02-21T12:00:00.000Z"
  }'

# 预期: HTTP 200, success=true, 返回 ticketCode
```

### 12.2 查询状态

```bash
curl "https://www.obplugins.cn/api/api/v1/log-report/status?ticketCode=AB12CD"

# 预期: HTTP 200, success=true, 返回 report 对象
```

### 12.3 健康检查

```bash
curl "https://www.obplugins.cn/api/api/v1/log-report/health"

# 预期: HTTP 200, status="ok"
```

### 12.4 频率限制测试

```bash
# 同一 deviceId 第三次提交
# 预期: HTTP 429, error="RATE_LIMITED"
```

### 12.5 验证错误测试

```bash
# description 少于 5 个字符
curl -X POST https://www.obplugins.cn/api/api/v1/log-report/submit \
  -H "Content-Type: application/json" \
  -H "User-Agent: OpenClawCN-Gateway/1.0" \
  -d '{
    "id": "rpt-test-002",
    "deviceId": "device-test-001",
    "description": "短",
    "logEntries": ["test"],
    "context": {"version":"1.1.10","platform":"win32","timestamp":"2026-02-21T12:00:00.000Z"},
    "createdAt": "2026-02-21T12:00:00.000Z"
  }'

# 预期: HTTP 400, error="VALIDATION_ERROR"
```

---

## 十三、实施优先级与排期建议

| 阶段 | 内容 | 优先级 | 预估工时 |
|------|------|--------|----------|
| 第一阶段 | `POST /submit` + `GET /status` + `GET /health` + 数据库建表 + 工单码生成 + 频率限制 | P0 | 2-3 天 |
| 第二阶段 | `GET /admin/list` + `GET /admin/detail/:id` + `POST /admin/reply` + 管理端认证 | P1 | 1-2 天 |
| 第三阶段 | 数据清理定时任务 + 监控告警 + 统计看板 | P2 | 1-2 天 |

---

## 附录 A：完整 API 路径汇总

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/api/v1/log-report/submit` | User-Agent 校验 | 提交日志报告 |
| GET | `/api/api/v1/log-report/status` | 无 | 查询报告状态 |
| GET | `/api/api/v1/log-report/health` | 无 | 健康检查 |
| GET | `/api/api/v1/log-report/admin/list` | Bearer/Basic Auth | 报告列表 |
| GET | `/api/api/v1/log-report/admin/detail/:id` | Bearer/Basic Auth | 报告详情 |
| POST | `/api/api/v1/log-report/admin/reply` | Bearer/Basic Auth | 回复报告 |

## 附录 B：客户端代码参考

客户端网关已有反馈系统实现，日志上报功能将参照相同模式开发。参考文件：

- 反馈系统：`src/gateway/server-methods/feedback.ts`
- 设备 ID 获取：`src/license/device-id.js` → `getDeviceId()`
- 请求头：`User-Agent: OpenClawCN-Gateway/1.0`
- 超时时间：30 秒（与反馈系统一致）
