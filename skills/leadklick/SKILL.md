---
name: leadklick
description: 将潜在线索捕获至集中式 Supabase 数据库，并自动触发 Make.com 邮件自动化流程。
description_zh: 将潜在线索捕获至集中式 Supabase 数据库，并自动触发 Make.com 邮件自动化流程。
---
# 潜在线索收件箱自动化器

将潜在线索捕获至集中式 Supabase 数据库，并自动触发 Make.com 邮件自动化流程。

## 描述

本 skill 为 Clawd agents 提供完整的潜在线索管理系统。它将线索存储于 Supabase，通过 Make.com webhook 触发自动回复邮件，并全程追踪线索生命周期，从 “new” 到 “qualified”。

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

## 动作

### createLead

创建新线索，并自动触发自动化工作流。

**参数：**  
- `email`（字符串，必填）：联系人邮箱地址  
- `name`（字符串，可选）：联系人姓名  
- `phone`（字符串，可选）：电话号码  
- `source`（字符串，可选）：来源渠道（默认值："clawd_agent"）  
- `priority`（字符串，可选）："low"、"medium"、"high"、"urgent"  
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

获取线索详情，包括完整对话历史。

**参数：**  
- `id`（字符串，必填）：线索 UUID  

**返回值：** 包含 `conversations` 数组和 `reply_pending` 布尔值的线索对象。

### listLeads

按条件筛选并列出线索。

**参数：**  
- `status`（字符串，可选）：按状态筛选  
- `priority`（字符串，可选）：按优先级筛选  
- `limit`（数字，可选）：最大返回数量（默认值：50）  
- `dateFrom`（字符串，可选）：ISO 格式日期筛选  

**返回值：** 线索数组及总数。

### updateStatus

更新线索生命周期状态。

**参数：**  
- `id`（字符串，必填）：线索 UUID  
- `status`（字符串，必填）："qualified"、"won"、"lost" 等  
- `notes`（字符串，可选）：甄别备注  

### addConversation

向线索对话线程中添加手动回复或备注。

**参数：**  
- `leadId`（字符串，必填）：线索 UUID  
- `content`（字符串，必填）：消息正文  
- `subject`（字符串，可选）：主题行  

### getAutomationStatus

检查自动回复邮件是否已成功发送。

**参数：**  
- `leadId`（字符串，必填）：线索 UUID  

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
2. **验证**：等待 60–120 秒后，调用 `getAutomationStatus()` 确认自动回复是否发出  
3. **甄别**：在对话过程中，若用户表现出兴趣，则将其状态更新为 "qualified"  
4. **记录**：使用 `addConversation()` 存储您的 agent 回复  

## 错误处理

常见错误：  
- 邮箱格式无效  
- 24 小时内存在重复线索  
- 缺少 Supabase 凭据  
- 自动化超时（>5 分钟未收到回复）  

## 结构定义

线索表（Leads table）：  
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