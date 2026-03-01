---
name: database
name_zh: 数据库
description: 数据库管理与查询。连接 SQL 和 NoSQL 数据库，执行查询，并管理数据库结构（schema）。
description_zh: 数据库管理与查询。连接 SQL 和 NoSQL 数据库，执行查询，并管理数据库结构（schema）。
metadata: {"clawdbot":{"emoji":"🗄️","always":true,"requires":{"bins":["curl","jq"]}}}
---
# 数据库 🗄️

数据库管理与查询功能。

## 支持的数据库类型

- PostgreSQL  
- MySQL  
- SQLite  
- MongoDB  
- Redis  

## 功能特性

- 执行 SQL 查询  
- 结构（schema）管理  
- 数据导入/导出  
- 备份与恢复  
- 性能监控  

## 使用示例

```
"Show all tables in database"
"Run query: SELECT * FROM users LIMIT 10"
"Export table to CSV"
```

## 安全规则

1. 对所有 DELETE/DROP 操作，**必须**事先确认  
2. 对不含 WHERE 子句的查询，**必须发出警告**  