---
name: wrangler
name_zh: 数据整理器
description: 使用 Wrangler CLI 管理 Cloudflare Workers、KV、D1、R2 及密钥。适用于部署 Worker、管理数据库、存储对象或配置 Cloudflare 资源。涵盖 Worker 部署、KV 命名空间、D1 SQL 数据库、R2 对象存储、密钥管理及日志实时追踪（tailing）。
description_zh: 使用 Wrangler CLI 管理 Cloudflare Workers、KV、D1、R2 及密钥。适用于部署 Worker、管理数据库、存储对象或配置 Cloudflare 资源。涵盖 Worker 部署、KV 命名空间、D1 SQL 数据库、R2 对象存储、密钥管理及日志实时追踪（tailing）。
---
# Cloudflare（Wrangler CLI）

通过 `wrangler` CLI 管理 Cloudflare Workers 及相关服务。

## 前提条件

- 需 Node.js v20+
- 安装方式：`npm install -g wrangler`，或使用项目本地的 `npx wrangler`
- 认证：`wrangler login`（将打开浏览器进行 OAuth）
- 验证：`wrangler whoami`

## 快速参考

### Workers

```bash
# Initialize new worker
wrangler init <name>

# Local development
wrangler dev [script]

# Deploy
wrangler deploy [script]

# List deployments
wrangler deployments list

# View deployment
wrangler deployments view [deployment-id]

# Rollback
wrangler rollback [version-id]

# Delete worker
wrangler delete [name]

# Tail logs (live)
wrangler tail [worker]
```

### 密钥（Secrets）

```bash
# Add/update secret (interactive)
wrangler secret put <key>

# Add secret from stdin
echo "value" | wrangler secret put <key>

# List secrets
wrangler secret list

# Delete secret
wrangler secret delete <key>

# Bulk upload from JSON file
wrangler secret bulk secrets.json
```

### KV（键值存储）

```bash
# Create namespace
wrangler kv namespace create <name>

# List namespaces
wrangler kv namespace list

# Delete namespace
wrangler kv namespace delete --namespace-id <id>

# Put key
wrangler kv key put <key> <value> --namespace-id <id>

# Get key
wrangler kv key get <key> --namespace-id <id>

# Delete key
wrangler kv key delete <key> --namespace-id <id>

# List keys
wrangler kv key list --namespace-id <id>

# Bulk operations (JSON file)
wrangler kv bulk put <file> --namespace-id <id>
wrangler kv bulk delete <file> --namespace-id <id>
```

### D1（SQL 数据库）

```bash
# Create database
wrangler d1 create <name>

# List databases
wrangler d1 list

# Database info
wrangler d1 info <name>

# Execute SQL
wrangler d1 execute <database> --command "SELECT * FROM users"

# Execute SQL file
wrangler d1 execute <database> --file schema.sql

# Local execution (for dev)
wrangler d1 execute <database> --local --command "..."

# Export database
wrangler d1 export <name> --output backup.sql

# Delete database
wrangler d1 delete <name>

# Migrations
wrangler d1 migrations create <database> <name>
wrangler d1 migrations apply <database>
wrangler d1 migrations list <database>
```

### R2（对象存储）

```bash
# Create bucket
wrangler r2 bucket create <name>

# List buckets
wrangler r2 bucket list

# Delete bucket
wrangler r2 bucket delete <name>

# Upload object
wrangler r2 object put <bucket>/<key> --file <path>

# Download object
wrangler r2 object get <bucket>/<key> --file <path>

# Delete object
wrangler r2 object delete <bucket>/<key>
```

### 队列（Queues）

```bash
# Create queue
wrangler queues create <name>

# List queues
wrangler queues list

# Delete queue
wrangler queues delete <name>
```

## 配置文件

Wrangler 支持 TOML 与 JSON/JSONC 两种配置格式：

- `wrangler.toml` —— 传统格式
- `wrangler.json` 或 `wrangler.jsonc` —— 新格式，支持 JSON Schema 自动补全

**⚠️ 重要提示：** 若两者同时存在，JSON 格式优先。请选择一种格式以避免混淆（例如对 TOML 的修改可能被忽略）。

### JSONC 格式（支持 Schema 自动补全）

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "my-worker",
  "main": "src/index.ts",
  "compatibility_date": "2024-12-30"
}
```

### TOML 格式

```toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2024-12-30"
```

含绑定（bindings）配置：

```toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2024-12-30"

# KV binding
[[kv_namespaces]]
binding = "MY_KV"
id = "xxx"

# D1 binding
[[d1_databases]]
binding = "DB"
database_name = "my-db"
database_id = "xxx"

# R2 binding
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "my-bucket"

# Environment variables
[vars]
API_URL = "https://api.example.com"

# Secrets (set via `wrangler secret put`)
# Referenced as env.SECRET_NAME in worker code
```

静态资源（适用于 Next.js 等框架）：

```toml
name = "my-site"
main = ".open-next/worker.js"
compatibility_date = "2024-12-30"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = ".open-next/assets"
binding = "ASSETS"
```

## 常见模式

### 带环境的部署

```bash
wrangler deploy -e production
wrangler deploy -e staging
```

### 自定义域名（通过控制台或 API）

自定义域名必须在 Cloudflare 控制台的 Worker 设置 > 域名与路由中配置，或通过 Cloudflare API 配置。Wrangler 不直接管理自定义域名。

### 本地开发（含绑定）

```bash
# Creates local D1/KV/R2 for dev
wrangler dev --local
```

### 检查部署状态

```bash
wrangler deployments list
wrangler deployments view
```

## Wrangler 不支持的功能

- **DNS 管理** —— 请使用 Cloudflare 控制台或 API 管理 DNS 记录
- **自定义域名** —— 请在控制台（Worker 设置 > 域名与路由）或通过 API 配置
- **SSL 证书** —— 添加自定义域名后，Cloudflare 将自动管理
- **防火墙/WAF 规则** —— 请使用控制台或 API 配置

如需 DNS/域名管理，请参阅 `cloudflare` skill（直接使用 Cloudflare API）。

## 故障排查

| 问题 | 解决方案 |
|-------|----------|
| “Not authenticated”（未认证） | 运行 `wrangler login` |
| Node 版本错误 | 需 Node.js v20+ |
| “No config found”（未找到配置） | 确保配置文件存在（`wrangler.toml` 或 `wrangler.jsonc`），或使用 `-c path/to/config` |
| 配置更改未生效 | 检查是否存在 `wrangler.json`/`wrangler.jsonc` —— JSON 优先于 TOML |
| 绑定未找到 | 检查 `wrangler.toml` 中的绑定是否与代码引用一致 |

## 相关资源

- [Wrangler 文档](https://developers.cloudflare.com/workers/wrangler/)
- [Workers 文档](https://developers.cloudflare.com/workers/)
- [D1 文档](https://developers.cloudflare.com/d1/)
- [R2 文档](https://developers.cloudflare.com/r2/)
- [KV 文档](https://developers.cloudflare.com/kv/)