---
name: zoho
name_zh: Zoho
description: 与 Zoho CRM 和 Zoho Projects API 交互。适用于管理交易（deals）、联系人（contacts）、潜在客户（leads）、任务（tasks）、项目（projects）、里程碑（milestones）或任何 Zoho 工作区数据。当用户提及 Zoho、CRM、deals、pipeline、projects、tasks 或 milestones 时触发。
description_zh: 与 Zoho CRM 和 Zoho Projects API 交互。适用于管理交易（deals）、联系人（contacts）、潜在客户（leads）、任务（tasks）、项目（projects）、里程碑（milestones）或任何 Zoho 工作区数据。当用户提及 Zoho、CRM、deals、pipeline、projects、tasks 或 milestones 时触发。
---
# Zoho 集成（CRM + Projects）

## 快速入门

使用 `zoho` CLI 封装器 —— 它会自动处理 OAuth token 刷新与缓存。

```bash
zoho help          # Show all commands
zoho token         # Print current access token (auto-refreshes)
```

## 认证（Authentication）

凭证存储于 `/root/clawd/skills/zoho/.env`：
```
ZOHO_CLIENT_ID=...
ZOHO_CLIENT_SECRET=...
ZOHO_REFRESH_TOKEN=...
ZOHO_ORG_ID=...
ZOHO_API_DOMAIN=https://www.zohoapis.com
ZOHO_ACCOUNTS_URL=https://accounts.zoho.com
```

- 访问令牌（access tokens）自动刷新，并缓存 50 分钟
- Token 缓存路径：`/root/clawd/skills/zoho/.token_cache`
- API 域名因数据中心而异（如 .com、.eu、.in、.com.au、.jp）

### 首次配置步骤
1. 在 https://api-console.zoho.com/ 注册 → 创建“基于服务器的应用”（Server-based app）
2. 获取授权码（auth code）→ 兑换为刷新令牌（refresh token）
3. 将凭证存入 `.env`

## CRM 命令

```bash
# List records from any module
zoho crm list Deals
zoho crm list Deals "page=1&per_page=5&sort_by=Created_Time&sort_order=desc"
zoho crm list Contacts
zoho crm list Leads

# Get a specific record
zoho crm get Deals 1234567890

# Search with criteria
zoho crm search Deals "(Stage:equals:Closed Won)"
zoho crm search Contacts "(Email:contains:@acme.com)"
zoho crm search Leads "(Lead_Source:equals:Web)"

# Create a record
zoho crm create Contacts '{"data":[{"Last_Name":"Smith","First_Name":"John","Email":"j@co.com"}]}'
zoho crm create Deals '{"data":[{"Deal_Name":"New Project","Stage":"Qualification","Amount":50000}]}'

# Update a record
zoho crm update Deals 1234567890 '{"data":[{"Stage":"Closed Won"}]}'

# Delete a record
zoho crm delete Deals 1234567890
```

### CRM 模块（Modules）
Leads（潜在客户）、Contacts（联系人）、Accounts（客户公司）、Deals（交易）、Tasks（任务）、Events（事件）、Calls（通话）、Notes（备注）、Products（产品）、Quotes（报价单）、Sales_Orders（销售订单）、Purchase_Orders（采购订单）、Invoices（发票）

### 搜索操作符（Search Operators）
equals（等于）、not_equal（不等于）、starts_with（开头为）、contains（包含）、not_contains（不包含）、in（在列表中）、not_in（不在列表中）、between（介于之间）、greater_than（大于）、less_than（小于）

## Projects 命令

```bash
# List all projects
zoho proj list

# Get project details
zoho proj get 12345678

# Tasks
zoho proj tasks 12345678
zoho proj create-task 12345678 "name=Fix+login+bug&priority=High&start_date=01-27-2026"
zoho proj update-task 12345678 98765432 "percent_complete=50"

# Other
zoho proj milestones 12345678
zoho proj tasklists 12345678
zoho proj bugs 12345678
zoho proj timelogs 12345678
```

### 任务字段（Task Fields）
name（名称）、start_date（开始日期，格式：MM-DD-YYYY）、end_date（结束日期）、priority（优先级，可选值：None/Low/Medium/High）、owner（负责人）、description（描述）、tasklist_id（所属任务列表 ID）、percent_complete（完成百分比）

## 原始 API 调用（Raw API Calls）

对于子命令未覆盖的场景：
```bash
# Get field definitions for a module
zoho raw GET /crm/v7/settings/fields?module=Deals

# Get org info
zoho raw GET /crm/v7/org

# Custom modules
zoho raw GET /crm/v7/Custom_Module
```

## 使用模式（Usage Patterns）

### 当 Shreef 询问交易（deals）/销售漏斗（pipeline）时
```bash
zoho crm list Deals "sort_by=Created_Time&sort_order=desc&per_page=10" | jq '.data[] | {Deal_Name, Stage, Amount, Closing_Date}'
```

### 当检查项目进度时
```bash
# Get all projects, then drill into tasks
zoho proj list | jq '.projects[] | {name, status, id: .id_string}'
zoho proj tasks <project_id> | jq '.tasks[] | {name, status: .status.name, percent_complete, priority}'
```

### 当根据对话内容创建任务时
```bash
zoho proj create-task <project_id> "name=Task+description&priority=High&start_date=MM-DD-YYYY&end_date=MM-DD-YYYY"
```

## 速率限制（Rate Limits）
- CRM：100 次请求/分钟
- Projects：依订阅计划而异
- Token 刷新：请避免不必要的调用（已自动缓存）

## 参考资料（References）
- [CRM API 字段说明](references/crm-api.md)
- [Projects API 端点说明](references/projects-api.md)