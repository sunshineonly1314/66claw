---
name: salesforce-dx
name_zh: Salesforce DX
description: 使用 `sf` CLI 查询 Salesforce 数据并管理销售管线。支持从简单到复杂的 SOQL 查询、机会管线分析、预测报表、数据导出、结构探索，以及 CRM 数据操作。亦可用于高管工作流，例如按名称查找交易、查找联系人信息以便外联潜在客户、准备管线评审会议、以及将 CRM 数据与其他工具交叉比对。当用户提问涉及 Salesforce、SOQL、管线、机会、预测、CRM 数据、交易查找、潜在客户邮件、客户账户信息或 sf CLI 时触发。
description_zh: 使用 `sf` CLI 查询 Salesforce 数据并管理销售管线。支持从简单到复杂的 SOQL 查询、机会管线分析、预测报表、数据导出、结构探索，以及 CRM 数据操作。亦可用于高管工作流，例如按名称查找交易、查找联系人信息以便外联潜在客户、准备管线评审会议、以及将 CRM 数据与其他工具交叉比对。当用户提问涉及 Salesforce、SOQL、管线、机会、预测、CRM 数据、交易查找、潜在客户邮件、客户账户信息或 sf CLI 时触发。
---
# Salesforce DX — 数据与管线管理

使用 `sf` CLI 查询数据并管理销售管线。

## 前置条件

```bash
# Verify CLI and auth
sf --version
sf org list
```

若未列出任何组织（org），请先完成身份验证：
```bash
sf org login web --alias my-org --set-default
```

## 结构发现（Schema Discovery）

查询前，请先探索可用的对象与字段：

```bash
# List all objects
sf sobject list --target-org my-org

# Describe object fields
sf sobject describe --sobject Opportunity --target-org my-org

# Quick field list (names only)
sf sobject describe --sobject Opportunity --target-org my-org | grep -E "^name:|^type:" 
```

## SOQL 查询

### 基础模式

```bash
# Simple query
sf data query -q "SELECT Id, Name, Amount FROM Opportunity LIMIT 10"

# With WHERE clause
sf data query -q "SELECT Id, Name FROM Opportunity WHERE StageName = 'Closed Won'"

# Date filtering
sf data query -q "SELECT Id, Name FROM Opportunity WHERE CloseDate = THIS_QUARTER"

# Export to CSV
sf data query -q "SELECT Id, Name, Amount FROM Opportunity" --result-format csv > opps.csv
```

### 关系查询

```bash
# Parent lookup (Account from Opportunity)
sf data query -q "SELECT Id, Name, Account.Name, Account.Industry FROM Opportunity"

# Child subquery (Opportunities from Account)
sf data query -q "SELECT Id, Name, (SELECT Id, Name, Amount FROM Opportunities) FROM Account LIMIT 5"
```

### 聚合查询

```bash
# COUNT
sf data query -q "SELECT COUNT(Id) total FROM Opportunity WHERE IsClosed = false"

# SUM and GROUP BY
sf data query -q "SELECT StageName, SUM(Amount) total FROM Opportunity GROUP BY StageName"

# Multiple aggregates
sf data query -q "SELECT StageName, COUNT(Id) cnt, SUM(Amount) total, AVG(Amount) avg FROM Opportunity GROUP BY StageName"
```

### 批量查询（大数据集）

```bash
# Use --bulk for >2000 records
sf data query -q "SELECT Id, Name, Amount FROM Opportunity" --bulk --wait 10
```

## 管线管理

### 管线快照

```bash
# Open pipeline by stage
sf data query -q "SELECT StageName, COUNT(Id) cnt, SUM(Amount) total FROM Opportunity WHERE IsClosed = false GROUP BY StageName ORDER BY StageName"

# Pipeline by owner
sf data query -q "SELECT Owner.Name, SUM(Amount) total FROM Opportunity WHERE IsClosed = false GROUP BY Owner.Name ORDER BY SUM(Amount) DESC"

# Pipeline by close month
sf data query -q "SELECT CALENDAR_MONTH(CloseDate) month, SUM(Amount) total FROM Opportunity WHERE IsClosed = false AND CloseDate = THIS_YEAR GROUP BY CALENDAR_MONTH(CloseDate) ORDER BY CALENDAR_MONTH(CloseDate)"
```

### 成交/失败分析

```bash
# Win rate by stage
sf data query -q "SELECT StageName, COUNT(Id) FROM Opportunity WHERE IsClosed = true GROUP BY StageName"

# Closed won this quarter
sf data query -q "SELECT Id, Name, Amount, CloseDate FROM Opportunity WHERE StageName = 'Closed Won' AND CloseDate = THIS_QUARTER ORDER BY Amount DESC"

# Lost deals with reasons
sf data query -q "SELECT Id, Name, Amount, StageName, Loss_Reason__c FROM Opportunity WHERE StageName = 'Closed Lost' AND CloseDate = THIS_QUARTER"
```

### 预测查询

```bash
# Weighted pipeline (assumes Probability field)
sf data query -q "SELECT StageName, SUM(Amount) gross, SUM(ExpectedRevenue) weighted FROM Opportunity WHERE IsClosed = false GROUP BY StageName"

# Deals closing this month
sf data query -q "SELECT Id, Name, Amount, StageName, CloseDate FROM Opportunity WHERE CloseDate = THIS_MONTH AND IsClosed = false ORDER BY Amount DESC"

# Stale deals (no activity in 30 days)
sf data query -q "SELECT Id, Name, Amount, LastActivityDate FROM Opportunity WHERE IsClosed = false AND LastActivityDate < LAST_N_DAYS:30"
```

## 数据操作

### 创建记录

```bash
sf data create record -s Opportunity -v "Name='New Deal' StageName='Prospecting' CloseDate=2024-12-31 Amount=50000"
```

### 更新记录

```bash
# By ID
sf data update record -s Opportunity -i 006xx000001234 -v "StageName='Negotiation'"

# Bulk update via CSV
sf data upsert bulk -s Opportunity -f updates.csv -i Id --wait 10
```

### 导出/导入

```bash
# Export with relationships
sf data export tree -q "SELECT Id, Name, (SELECT Id, Subject FROM Tasks) FROM Account WHERE Industry = 'Technology'" -d ./export

# Import
sf data import tree -f ./export/Account.json
```

## 用于脚本编写的 JSON 输出

添加 `--json` 参数以获得结构化输出：

```bash
sf data query -q "SELECT Id, Name, Amount FROM Opportunity WHERE IsClosed = false" --json
```

使用 jq 解析：
```bash
sf data query -q "SELECT Id, Name FROM Opportunity LIMIT 5" --json | jq '.result.records[].Name'
```

## 常用日期字面量（Date Literals）

| 字面量 | 含义 |
|--------|------|
| TODAY | 当日 |
| THIS_WEEK | 当周 |
| THIS_MONTH | 当月 |
| THIS_QUARTER | 当季度 |
| THIS_YEAR | 当年 |
| LAST_N_DAYS:n | 过去 n 天 |
| NEXT_N_DAYS:n | 接下来 n 天 |
| LAST_QUARTER | 上一季度 |

## 故障排除

**“Malformed query”（查询格式错误）** —— 请核对字段 API 名称（非显示标签）。使用 `sf sobject describe` 命令验证。

**“QUERY_TIMEOUT”（查询超时）** —— 添加筛选条件、使用 `--bulk`，或添加 `LIMIT` 参数。

**“INVALID_FIELD”（字段无效）** —— 该字段可能不存在于目标对象上，或当前用户配置文件无访问权限。

**结果集过大** —— 对返回记录数超过 2000 条的查询，请使用 `--bulk` 参数。

## 高管工作流

### 快速交易查找

按名称或客户账户查找交易：
```bash
# By opportunity name (fuzzy)
sf data query -q "SELECT Id, Name, Amount, StageName, CloseDate, Owner.Name, Account.Name FROM Opportunity WHERE Name LIKE '%Acme%' ORDER BY Amount DESC"

# By account name
sf data query -q "SELECT Id, Name, Amount, StageName, CloseDate FROM Opportunity WHERE Account.Name LIKE '%Microsoft%' AND IsClosed = false"

# Recent deals I own
sf data query -q "SELECT Id, Name, Amount, StageName, CloseDate, Account.Name FROM Opportunity WHERE OwnerId = '<my-user-id>' AND IsClosed = false ORDER BY CloseDate"
```

### 获取外联联系人信息

查找某公司中可供邮件联系的人员：
```bash
# Contacts at an account
sf data query -q "SELECT Id, Name, Email, Phone, Title FROM Contact WHERE Account.Name LIKE '%Acme%'"

# Decision makers (by title)
sf data query -q "SELECT Name, Email, Title, Account.Name FROM Contact WHERE Title LIKE '%CEO%' OR Title LIKE '%VP%' OR Title LIKE '%Director%'"

# Contacts on a specific deal
sf data query -q "SELECT Contact.Name, Contact.Email, Contact.Title, Role FROM OpportunityContactRole WHERE Opportunity.Name LIKE '%Acme%'"
```

### 管线评审会议准备

快速生成高管摘要：
```bash
# Top 10 deals closing this quarter
sf data query -q "SELECT Name, Account.Name, Amount, StageName, CloseDate, Owner.Name FROM Opportunity WHERE CloseDate = THIS_QUARTER AND IsClosed = false ORDER BY Amount DESC LIMIT 10"

# Deals by rep (for 1:1s)
sf data query -q "SELECT Owner.Name, COUNT(Id) deals, SUM(Amount) total FROM Opportunity WHERE IsClosed = false GROUP BY Owner.Name ORDER BY SUM(Amount) DESC"

# Deals needing attention (stale)
sf data query -q "SELECT Name, Amount, StageName, LastActivityDate, Owner.Name FROM Opportunity WHERE IsClosed = false AND LastActivityDate < LAST_N_DAYS:14 ORDER BY Amount DESC LIMIT 10"
```

### 客户账户情报

在通话或会议前：
```bash
# Account overview
sf data query -q "SELECT Id, Name, Industry, BillingCity, Website, OwnerId FROM Account WHERE Name LIKE '%Acme%'"

# All open deals with account
sf data query -q "SELECT Name, Amount, StageName, CloseDate FROM Opportunity WHERE Account.Name LIKE '%Acme%' AND IsClosed = false"

# Recent activities
sf data query -q "SELECT Subject, Status, ActivityDate FROM Task WHERE Account.Name LIKE '%Acme%' ORDER BY ActivityDate DESC LIMIT 5"
```

### 跨工具工作流

**Salesforce + 邮件（通过 gog/gmail）：**  
1. 查找联系人邮箱：`sf data query -q "SELECT Email FROM Contact WHERE Account.Name LIKE '%Acme%'"`  
2. 使用该邮箱地址，借助你的邮件工具起草邮件  

**Salesforce + 日历：**  
1. 查找即将关闭的交易：`sf data query -q "SELECT Name, Account.Name, CloseDate FROM Opportunity WHERE CloseDate = THIS_WEEK"`  
2. 与日历交叉比对，确保已安排后续跟进  

**通话后快速 CRM 更新：**  
```bash
# Log a task
sf data create record -s Task -v "Subject='Call with John' WhatId='<opportunity-id>' Status='Completed' ActivityDate=$(date +%Y-%m-%d)"

# Update opportunity stage
sf data update record -s Opportunity -i <opp-id> -v "StageName='Negotiation' NextStep='Send proposal'"
```

### 查找你的用户 ID

用于 “deals I own” 类查询：
```bash
sf data query -q "SELECT Id, Name FROM User WHERE Email = 'your.email@company.com'"
```  
请将此 ID 保存至本地配置，便于快速引用。

## 参考资料

- **[soql-patterns.md](references/soql-patterns.md)** —— 高级 SOQL 模式（多态关系、半连接、公式字段等）
- **[pipeline-queries.md](references/pipeline-queries.md)** —— 开箱即用的管线与预测查询语句