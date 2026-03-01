---
name: sales-bot
description: 将潜在客户捕获至集中化的 Supabase 数据库，并通过 Make.com 自动触发电子邮件自动化流程。
description_zh: 将潜在客户捕获至集中化的 Supabase 数据库，并通过 Make.com 自动触发电子邮件自动化流程。
---
# 潜在客户收件箱自动化器

将潜在客户捕获至集中化的 Supabase 数据库，并通过 Make.com 自动触发电子邮件自动化流程。

## 描述

本 skill 为 Clawd agent 提供一套完整的潜在客户管理系统。它将潜在客户存储于 Supabase 中，通过 Make.com Webhook 触发自动回复邮件，并全程追踪潜在客户生命周期状态，从 “new” 到 “qualified”。

## 配置

```json
{
  "supabaseUrl": "https://your-project.supabase.co",
  "supabaseKey": "eyJ...your-service-role-key",
  "orgId": "550e8400-e29b-41d4-a716-446655440000",
  "defaultPriority": "medium"
}
```

**重要提示**：请使用 Service Role Key（而非 Anon Key），以获得完整的数据库访问权限。

## 操作

### createLead

创建新潜在客户，并自动触发自动化工作流。

**参数：**
- `email`（字符串，必填）：联系人邮箱地址
- `name`（字符串，可选）：联系人姓名
- `phone`（字符串，可选）：电话号码
- `source`（字符串，可选）：来源渠道（默认值："clawd_agent"）
- `priority`（字符串，可选）：优先级，取值为 "low"、"medium"、"high" 或 "urgent"
- `custom_fields`（对象，可选）：任意附加数据

**返回值：**
```json
{
  "success": true,
  "lead_id": "uuid",
  "status": "new",
  "automation_triggered": true,
  "message": "Lead captured. Auto-reply will be sent within 60 seconds."
}
```

**示例：**
```typescript
const result = await skill.createLead({
  email: "customer@example.com",
  name: "Max Mustermann",
  source: "chat_bot",
  custom_fields: { product: "saas_basic" }
});
```

### getLead

获取潜在客户详细信息，包括完整对话历史。

**参数：**
- `id`（字符串，必填）：潜在客户 UUID

**返回值：** 包含 `conversations` 数组和 `reply_pending` 布尔值的潜在客户对象。

### listLeads

支持多种筛选选项的潜在客户列表。

**参数：**
- `status`（字符串，可选）：按状态筛选
- `priority`（字符串，可选）：按优先级筛选
- `limit`（数字，可选）：最大返回数量（默认值：50）
- `dateFrom`（字符串，可选）：ISO 格式日期筛选

**返回值：** 潜在客户数组及总数。

### updateStatus

更新潜在客户生命周期状态。

**参数：**
- `id`（字符串，必填）：潜在客户 UUID
- `status`（字符串，必填）：取值为 "qualified"、"won"、"lost" 等
- `notes`（字符串，可选）：资格判定备注

### addConversation

向潜在客户对话线程中添加人工回复或备注。

**参数：**
- `leadId`（字符串，必填）：潜在客户 UUID
- `content`（字符串，必填）：消息正文
- `subject`（字符串，可选）：主题行

### getAutomationStatus

检查自动回复邮件是否已成功发送。

**参数：**
- `leadId`（字符串，必填）：潜在客户 UUID

**返回值：**
```json
{
  "auto_reply_sent": true,
  "minutes_since_creation": 2,
  "automation_ok": true
}
```

## 使用流程

1. **捕获**：当用户表达兴趣时，调用 `createLead()`
2. **验证**：60–120 秒后，调用 `getAutomationStatus()` 确认自动回复是否已发出
3. **资格判定**：在对话过程中，若客户表现出兴趣，则将其状态更新为 "qualified"
4. **记录**：使用 `addConversation()` 存储你的 agent 回复

## 错误处理

常见错误：
- 邮箱格式无效
- 潜在客户重复（24 小时内）
- 缺少 Supabase 凭据
- 自动化超时（>5 分钟未收到回复）

## 结构定义

潜在客户表（Leads table）：
- id、email、name、phone、source、status、priority
- custom_fields（JSON）、metadata（JSON）
- first_reply_sent_at、created_at

对话表（Conversations table）：
- id、lead_id、direction（inbound/outbound/automated）
- content、subject、channel、sent_at

## 标签

lead、crm、sales、automation、email、supabase

## 版本

1.0.0