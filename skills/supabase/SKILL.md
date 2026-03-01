---
name: supabase
name_zh: Supabase
description: 连接 Supabase 以执行数据库操作、向量搜索和存储。可用于数据存储、SQL 查询执行、基于 pgvector 的相似性搜索，以及表管理。当请求涉及数据库、向量存储、嵌入（embeddings）或明确提及 Supabase 时触发。
description_zh: 连接 Supabase 以执行数据库操作、向量搜索和存储。可用于数据存储、SQL 查询执行、基于 pgvector 的相似性搜索，以及表管理。当请求涉及数据库、向量存储、嵌入（embeddings）或明确提及 Supabase 时触发。
metadata: {"clawdbot":{"requires":{"env":["SUPABASE_URL","SUPABASE_SERVICE_KEY"]}}}
---
# Supabase CLI

与 Supabase 项目交互：执行查询、CRUD 操作、向量搜索及表管理。

## 设置

```bash
# Required
export SUPABASE_URL="https://yourproject.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIs..."

# Optional: for management API
export SUPABASE_ACCESS_TOKEN="sbp_xxxxx"
```

## 快速命令

```bash
# SQL query
{baseDir}/scripts/supabase.sh query "SELECT * FROM users LIMIT 5"

# Insert data
{baseDir}/scripts/supabase.sh insert users '{"name": "John", "email": "john@example.com"}'

# Select with filters
{baseDir}/scripts/supabase.sh select users --eq "status:active" --limit 10

# Update
{baseDir}/scripts/supabase.sh update users '{"status": "inactive"}' --eq "id:123"

# Delete
{baseDir}/scripts/supabase.sh delete users --eq "id:123"

# Vector similarity search
{baseDir}/scripts/supabase.sh vector-search documents "search query" --match-fn match_documents --limit 5

# List tables
{baseDir}/scripts/supabase.sh tables

# Describe table
{baseDir}/scripts/supabase.sh describe users
```

## 命令参考

### query - 执行原始 SQL

```bash
{baseDir}/scripts/supabase.sh query "<SQL>"

# Examples
{baseDir}/scripts/supabase.sh query "SELECT COUNT(*) FROM users"
{baseDir}/scripts/supabase.sh query "CREATE TABLE items (id serial primary key, name text)"
{baseDir}/scripts/supabase.sh query "SELECT * FROM users WHERE created_at > '2024-01-01'"
```

### select - 使用过滤器查询表

```bash
{baseDir}/scripts/supabase.sh select <table> [options]

Options:
  --columns <cols>    Comma-separated columns (default: *)
  --eq <col:val>      Equal filter (can use multiple)
  --neq <col:val>     Not equal filter
  --gt <col:val>      Greater than
  --lt <col:val>      Less than
  --like <col:val>    Pattern match (use % for wildcard)
  --limit <n>         Limit results
  --offset <n>        Offset results
  --order <col>       Order by column
  --desc              Descending order

# Examples
{baseDir}/scripts/supabase.sh select users --eq "status:active" --limit 10
{baseDir}/scripts/supabase.sh select posts --columns "id,title,created_at" --order created_at --desc
{baseDir}/scripts/supabase.sh select products --gt "price:100" --lt "price:500"
```

### insert - 插入行（单行或多行）

```bash
{baseDir}/scripts/supabase.sh insert <table> '<json>'

# Single row
{baseDir}/scripts/supabase.sh insert users '{"name": "Alice", "email": "alice@test.com"}'

# Multiple rows
{baseDir}/scripts/supabase.sh insert users '[{"name": "Bob"}, {"name": "Carol"}]'
```

### update - 更新行

```bash
{baseDir}/scripts/supabase.sh update <table> '<json>' --eq <col:val>

# Example
{baseDir}/scripts/supabase.sh update users '{"status": "inactive"}' --eq "id:123"
{baseDir}/scripts/supabase.sh update posts '{"published": true}' --eq "author_id:5"
```

### upsert - 插入或更新

```bash
{baseDir}/scripts/supabase.sh upsert <table> '<json>'

# Example (requires unique constraint)
{baseDir}/scripts/supabase.sh upsert users '{"id": 1, "name": "Updated Name"}'
```

### delete - 删除行

```bash
{baseDir}/scripts/supabase.sh delete <table> --eq <col:val>

# Example
{baseDir}/scripts/supabase.sh delete sessions --lt "expires_at:2024-01-01"
```

### vector-search - 使用 pgvector 进行相似性搜索

```bash
{baseDir}/scripts/supabase.sh vector-search <table> "<query>" [options]

Options:
  --match-fn <name>     RPC function name (default: match_<table>)
  --limit <n>           Number of results (default: 5)
  --threshold <n>       Similarity threshold 0-1 (default: 0.5)
  --embedding-model <m> Model for query embedding (default: uses OpenAI)

# Example
{baseDir}/scripts/supabase.sh vector-search documents "How to set up authentication" --limit 10

# Requires a match function like:
# CREATE FUNCTION match_documents(query_embedding vector(1536), match_threshold float, match_count int)
```

### tables - 列出所有表

```bash
{baseDir}/scripts/supabase.sh tables
```

### describe - 显示表结构（schema）

```bash
{baseDir}/scripts/supabase.sh describe <table>
```

### rpc - 调用存储过程

```bash
{baseDir}/scripts/supabase.sh rpc <function_name> '<json_params>'

# Example
{baseDir}/scripts/supabase.sh rpc get_user_stats '{"user_id": 123}'
```

## 向量搜索设置

### 1. 启用 pgvector 扩展

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. 创建含 embedding 列的表

```sql
CREATE TABLE documents (
  id bigserial PRIMARY KEY,
  content text,
  metadata jsonb,
  embedding vector(1536)
);
```

### 3. 创建相似性搜索函数

```sql
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 4. 创建索引以提升性能

```sql
CREATE INDEX ON documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

## 环境变量

| 变量 | 是否必需 | 描述 |
|----------|----------|-------------|
| SUPABASE_URL | 是 | 项目 URL（例如：https://xxx.supabase.co） |
| SUPABASE_SERVICE_KEY | 是 | Service role 密钥（具备完全访问权限） |
| SUPABASE_ANON_KEY | 否 | Anon 密钥（受限访问权限） |
| SUPABASE_ACCESS_TOKEN | 否 | 管理 API Token |
| OPENAI_API_KEY | 否 | 用于生成 embeddings |

## 注意事项

- Service role 密钥会绕过 RLS（行级安全性，Row Level Security）
- 客户端侧或受限访问场景请使用 anon 密钥
- 向量搜索依赖 pgvector 扩展
- embeddings 默认使用 OpenAI text-embedding-ada-002（1536 维）