---
name: postgres
name_zh: PostgreSQL
description: PostgreSQL 数据库管理。执行查询、管理数据库结构（schema）、监控性能。
description_zh: PostgreSQL 数据库管理。执行查询、管理数据库结构（schema）、监控性能。
metadata: {"clawdbot":{"emoji":"🐘","always":true,"requires":{"bins":["curl","jq"]}}}
---
# PostgreSQL 🐘

PostgreSQL 数据库管理工具。

## 初始化配置

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"
```

## 功能特性

- SQL 查询执行
- 数据库结构（schema）管理
- 索引优化
- 备份与恢复
- 性能监控
- 扩展（extension）管理

## 使用示例

```
"Show all tables"
"Run query: SELECT * FROM users"
"Create index on email column"
"Show slow queries"
```

## 命令列表

```bash
psql "$DATABASE_URL" -c "SELECT * FROM users LIMIT 10"
```

## 安全规则

1. **务必**在执行破坏性操作前进行确认  
2. **务必**在修改数据库结构（schema）前完成备份