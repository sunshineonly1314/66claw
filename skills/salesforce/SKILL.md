---
name: salesforce
name_zh: Salesforce
description: "通过 Salesforce CLI（`sf`）查询与管理 Salesforce CRM 数据。支持 SOQL/SOSL 查询、对象结构检查、记录的创建/更新/删除、批量导入/导出、Apex 执行、元数据部署，以及原始 REST API 调用。"
description_zh: 通过 Salesforce CLI（`sf`）查询与管理 Salesforce CRM 数据。支持 SOQL/SOSL 查询、对象结构检查、记录的创建/更新/删除、批量导入/导出、Apex 执行、元数据部署，以及原始 REST API 调用。
homepage: https://developer.salesforce.com/tools/salesforcecli
metadata: {"clawdbot":{"emoji":"☁️","requires":{"bins":["sf"]},"install":[{"id":"npm","kind":"node","package":"@salesforce/cli","bins":["sf"],"label":"Install Salesforce CLI (npm)"}]}}
---
# Salesforce Skill

使用 Salesforce CLI（`sf`）与 Salesforce 组织（org）交互。CLI 在使用前必须完成身份验证。始终添加 `--json` 参数以获得结构化输出。

若系统中未安装 `sf` 二进制文件，请通过 npm（`npm install -g @salesforce/cli`）安装，或从 https://developer.salesforce.com/tools/salesforcecli 下载。安装完成后，请立即运行 `sf org login web` 进行身份验证，以连接到 Salesforce 组织。

## 身份验证与组织管理

### 登录（打开浏览器）
```bash
sf org login web --alias my-org
```

其他登录方式：
```bash
# JWT-based login (CI/automation)
sf org login jwt --client-id <consumer-key> --jwt-key-file server.key --username user@example.com --alias my-org

# Login with an existing access token
sf org login access-token --instance-url https://mycompany.my.salesforce.com

# Login via SFDX auth URL (from a file)
sf org login sfdx-url --sfdx-url-file authUrl.txt --alias my-org
```

### 组织管理
```bash
# List all authenticated orgs
sf org list --json

# Display info about the default org (access token, instance URL, username)
sf org display --json

# Display info about a specific org
sf org display --target-org my-org --json

# Display with SFDX auth URL (sensitive - contains refresh token)
sf org display --target-org my-org --verbose --json

# Open org in browser
sf org open
sf org open --target-org my-org

# Log out
sf org logout --target-org my-org
```

### 配置与别名
```bash
# Set default target org
sf config set target-org my-org

# List all config variables
sf config list

# Get a specific config value
sf config get target-org

# Set an alias
sf alias set prod=user@example.com

# List aliases
sf alias list
```

## 数据查询（SOQL）

通过默认 API 执行标准 SOQL 查询：
```bash
# Basic query
sf data query --query "SELECT Id, Name, Email FROM Contact LIMIT 10" --json

# WHERE clause
sf data query --query "SELECT Id, Name, Amount, StageName FROM Opportunity WHERE StageName = 'Closed Won'" --json

# Relationship queries (parent-to-child)
sf data query --query "SELECT Id, Name, (SELECT LastName, Email FROM Contacts) FROM Account LIMIT 5" --json

# Relationship queries (child-to-parent)
sf data query --query "SELECT Id, Name, Account.Name FROM Contact" --json

# LIKE for text search
sf data query --query "SELECT Id, Name FROM Account WHERE Name LIKE '%Acme%'" --json

# Date filtering
sf data query --query "SELECT Id, Name, CreatedDate FROM Lead WHERE CreatedDate = TODAY" --json

# ORDER BY + LIMIT
sf data query --query "SELECT Id, Name, Amount FROM Opportunity ORDER BY Amount DESC LIMIT 20" --json

# Include deleted/archived records
sf data query --query "SELECT Id, Name FROM Account" --all-rows --json

# Query from a file
sf data query --file query.soql --json

# Tooling API queries (metadata objects like ApexClass, ApexTrigger)
sf data query --query "SELECT Id, Name, Status FROM ApexClass" --use-tooling-api --json

# Output to CSV file
sf data query --query "SELECT Id, Name, Email FROM Contact" --result-format csv --output-file contacts.csv

# Target a specific org
sf data query --query "SELECT Id, Name FROM Account" --target-org my-org --json
```

对于返回记录数超过 10,000 条的查询，请改用 Bulk API：
```bash
sf data export bulk --query "SELECT Id, Name, Email FROM Contact" --output-file contacts.csv --result-format csv --wait 10
sf data export bulk --query "SELECT Id, Name FROM Account" --output-file accounts.json --result-format json --wait 10
```

## 文本搜索（SOSL）

SOSL 可同时跨多个对象执行搜索：
```bash
# Search for text across objects
sf data search --query "FIND {John Smith} IN ALL FIELDS RETURNING Contact(Name, Email), Lead(Name, Email)" --json

# Search in name fields only
sf data search --query "FIND {Acme} IN NAME FIELDS RETURNING Account(Name, Industry), Contact(Name)" --json

# Search from a file
sf data search --file search.sosl --json

# Output to CSV
sf data search --query "FIND {test} RETURNING Contact(Name)" --result-format csv
```

## 单条记录操作

### 获取单条记录
```bash
# By record ID
sf data get record --sobject Contact --record-id 003XXXXXXXXXXXX --json

# By field match (WHERE-like)
sf data get record --sobject Account --where "Name=Acme" --json

# By multiple fields (values with spaces need single quotes)
sf data get record --sobject Account --where "Name='Universal Containers' Phone='(123) 456-7890'" --json
```

### 创建记录（需先向用户确认）
```bash
sf data create record --sobject Contact --values "FirstName='Jane' LastName='Doe' Email='jane@example.com'" --json

sf data create record --sobject Account --values "Name='New Company' Website=www.example.com Industry='Technology'" --json

# Tooling API object
sf data create record --sobject TraceFlag --use-tooling-api --values "DebugLevelId=7dl... LogType=CLASS_TRACING" --json
```

### 更新记录（需先向用户确认）
```bash
# By ID
sf data update record --sobject Contact --record-id 003XXXXXXXXXXXX --values "Email='updated@example.com'" --json

# By field match
sf data update record --sobject Account --where "Name='Old Acme'" --values "Name='New Acme'" --json

# Multiple fields
sf data update record --sobject Account --record-id 001XXXXXXXXXXXX --values "Name='Acme III' Website=www.example.com" --json
```

### 删除记录（需用户明确确认）
```bash
# By ID
sf data delete record --sobject Account --record-id 001XXXXXXXXXXXX --json

# By field match
sf data delete record --sobject Account --where "Name=Acme" --json
```

## 批量数据操作（Bulk API 2.0）

适用于大规模数据集（数千至数百万条记录）：

### 批量导出
```bash
# Export to CSV
sf data export bulk --query "SELECT Id, Name, Email FROM Contact" --output-file contacts.csv --result-format csv --wait 10

# Export to JSON
sf data export bulk --query "SELECT Id, Name FROM Account" --output-file accounts.json --result-format json --wait 10

# Include soft-deleted records
sf data export bulk --query "SELECT Id, Name FROM Account" --output-file accounts.csv --result-format csv --all-rows --wait 10

# Resume a timed-out export
sf data export resume --job-id 750XXXXXXXXXXXX --json
```

### 批量导入
```bash
# Import from CSV
sf data import bulk --file accounts.csv --sobject Account --wait 10

# Resume a timed-out import
sf data import resume --job-id 750XXXXXXXXXXXX --json
```

### 批量 upsert（插入或更新）
```bash
sf data upsert bulk --file contacts.csv --sobject Contact --external-id Email --wait 10
```

### 批量删除
```bash
# Delete records listed in CSV (CSV must have an Id column)
sf data delete bulk --file records-to-delete.csv --sobject Contact --wait 10
```

### 树形导出/导入（用于关联记录）
```bash
# Export with relationships into JSON tree format
sf data export tree --query "SELECT Id, Name, (SELECT Name, Email FROM Contacts) FROM Account" --json

# Export with a plan file (for multiple objects)
sf data export tree --query "SELECT Id, Name FROM Account" --plan --output-dir export-data

# Import from tree JSON files
sf data import tree --files Account.json,Contact.json

# Import using a plan definition file
sf data import tree --plan Account-Contact-plan.json
```

## 结构检查

```bash
# Describe an object (fields, relationships, picklist values)
sf sobject describe --sobject Account --json

# Describe a custom object
sf sobject describe --sobject MyCustomObject__c --json

# Describe a Tooling API object
sf sobject describe --sobject ApexClass --use-tooling-api --json

# List all objects
sf sobject list --json

# List only custom objects
sf sobject list --sobject custom --json

# List only standard objects
sf sobject list --sobject standard --json
```

## 执行 Apex 代码

```bash
# Execute Apex from a file
sf apex run --file script.apex --json

# Run interactively (type code, press Ctrl+D to execute)
sf apex run

# Run Apex tests
sf apex run test --test-names MyTestClass --json

# Get test results
sf apex get test --test-run-id 707XXXXXXXXXXXX --json

# View Apex logs
sf apex list log --json
sf apex get log --log-id 07LXXXXXXXXXXXX
```

## REST API（高级）

发起任意经身份验证的 REST API 调用：
```bash
# GET request
sf api request rest 'services/data/v62.0/limits' --json

# List API versions
sf api request rest '/services/data/' --json

# Create a record via REST
sf api request rest '/services/data/v62.0/sobjects/Account' --method POST --body '{"Name":"REST Account","Industry":"Technology"}' --json

# Update a record via REST (PATCH)
sf api request rest '/services/data/v62.0/sobjects/Account/001XXXXXXXXXXXX' --method PATCH --body '{"BillingCity":"San Francisco"}' --json

# GraphQL query
sf api request graphql --body '{"query":"{ uiapi { query { Account { edges { node { Name { value } } } } } } }"}' --json

# Custom headers
sf api request rest '/services/data/v62.0/limits' --header 'Accept: application/xml'

# Save response to file
sf api request rest '/services/data/v62.0/limits' --stream-to-file limits.json
```

## 元数据部署与检索

```bash
# Deploy metadata to an org
sf project deploy start --source-dir force-app --json

# Deploy specific metadata components
sf project deploy start --metadata ApexClass:MyClass --json

# Retrieve metadata from an org
sf project retrieve start --metadata ApexClass --json

# Check deploy status
sf project deploy report --job-id 0AfXXXXXXXXXXXX --json

# Generate a new Salesforce DX project
sf project generate --name my-project

# List metadata components in the org
sf project list ignored --json
```

## 诊断

```bash
# Run CLI diagnostics
sf doctor

# Check CLI version
sf version

# See what is new
sf whatsnew
```

## 常用 SOQL 模式

```sql
-- Count records
SELECT COUNT() FROM Contact WHERE AccountId = '001XXXXXXXXXXXX'

-- Aggregate query
SELECT StageName, COUNT(Id), SUM(Amount) FROM Opportunity GROUP BY StageName

-- Date literals
SELECT Id, Name FROM Lead WHERE CreatedDate = LAST_N_DAYS:30

-- Subquery (semi-join)
SELECT Id, Name FROM Account WHERE Id IN (SELECT AccountId FROM Contact WHERE Email LIKE '%@acme.com')

-- Polymorphic lookup
SELECT Id, Who.Name, Who.Type FROM Task WHERE Who.Type = 'Contact'

-- Multiple WHERE conditions
SELECT Id, Name, Amount FROM Opportunity WHERE Amount > 10000 AND StageName != 'Closed Lost' AND CloseDate = THIS_QUARTER
```

## 安全守则（Guardrails）

- **始终使用 `--json`** 以确保输出结构化、可解析。
- **禁止未经用户明确确认即创建、更新或删除记录**。执行前须先描述操作内容并征得用户同意。
- **禁止删除记录**，除非用户明确要求且确认了具体要删除的记录（或记录集合）。
- **禁止未经用户审阅文件/查询并确认即执行批量删除或批量导入**。
- 对查询使用 `LIMIT` 以避免返回过多数据。建议起始值为 `LIMIT 10`，仅在用户确有需要时再增加。
- 对于返回记录数超过 10,000 条的查询，请使用 `sf data export bulk` 而非 `sf data query`。
- 当用户要求“查找”或“搜索”单个对象时，请使用 SOQL `WHERE ... LIKE '%term%'`；当需跨多个对象搜索时，请使用 SOSL `sf data search`。
- 当用户拥有多个组织（org）时，请使用 `--target-org <alias>`；若存在歧义，请主动询问用户目标组织。
- 若身份验证失败或会话过期，请引导用户执行 `sf org login web`。
- Bulk API 2.0 对 SOQL 存在限制（不支持 `COUNT()` 等聚合函数）。此类场景请改用标准 `sf data query`。
- 在描述对象（`sf sobject describe`）时，JSON 输出可能非常庞大。请为用户总结关键字段、必填字段及关联关系，切勿直接输出原始 JSON。