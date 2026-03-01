---
name: coolify
name_zh: Coolify
description: 通过 Coolify API 管理 Coolify 部署、应用、数据库及服务。当用户希望在 Coolify 上部署、启动、停止、重启或管理应用时使用。
description_zh: 通过 Coolify API 管理 Coolify 部署、应用、数据库及服务。当用户希望在 Coolify 上部署、启动、停止、重启或管理应用时使用。
homepage: https://coolify.io
repository: https://github.com/visiongeist/coolifycli
user-invocable: true
metadata: {"clawdbot":{"emoji":"🚀","requires":{"bins":["node"],"env":["COOLIFY_TOKEN","COOLIFY_API_URL"]},"primaryEnv":"COOLIFY_TOKEN"}}
---
# Coolify API Skill

**代码仓库：** [github.com/visiongeist/coolifycli](https://github.com/visiongeist/coolifycli)

通过 Coolify API 对 Coolify 部署、应用、数据库、服务及基础设施进行全方位管理。

## 何时使用本 skill

当用户需要以下操作时，请使用本 skill：
- 将应用部署至 Coolify  
- 管理应用生命周期（启动、停止、重启）  
- 查看应用日志  
- 创建并管理数据库（PostgreSQL、MySQL、MongoDB、Redis 等）  
- 部署 Docker Compose 服务  
- 管理服务器与基础设施  
- 配置环境变量  
- 触发并监控部署  
- 管理 GitHub App 集成  
- 配置 SSH 私钥  

## 前置条件

1. **Coolify API Token** —— 从 Coolify 控制台生成：  
   - 导航至 **Keys & Tokens** → **API tokens**  
   - 创建具备适当权限的 token（`read`、`write`、`deploy`）  
   - 设置 `COOLIFY_TOKEN` 环境变量  

2. **Coolify API URL**（可选）—— 适用于自托管实例：  
   - 设置 `COOLIFY_API_URL` 环境变量（默认值：`https://app.coolify.io/api/v1`）  
   - 示例：`export COOLIFY_API_URL="https://your-coolify.com/api/v1"`  

3. **Node.js 20+** —— 运行 CLI 所必需  

4. **API 访问权限** —— Coolify Cloud（`app.coolify.io`）或自托管实例  

## 快速上手

### 基础命令

```bash
# List all applications
{baseDir}/dist/coolify-cli.cjs applications list

# Get application details
{baseDir}/dist/coolify-cli.cjs applications get --uuid abc-123

# Deploy an application
{baseDir}/dist/coolify-cli.cjs deploy --uuid abc-123 --force

# View application logs
{baseDir}/dist/coolify-cli.cjs applications logs --uuid abc-123

# Restart an application
{baseDir}/dist/coolify-cli.cjs applications restart --uuid abc-123
```

---

## 应用

### 列出应用

```bash
{baseDir}/dist/coolify-cli.cjs applications list
```

**输出：**  
```json
{
  "success": true,
  "data": [
    {
      "uuid": "abc-123",
      "name": "my-app",
      "status": "running",
      "fqdn": "https://app.example.com"
    }
  ],
  "count": 1
}
```

### 获取应用详情

```bash
{baseDir}/dist/coolify-cli.cjs applications get --uuid abc-123
```

### 应用生命周期管理

```bash
# Start
{baseDir}/dist/coolify-cli.cjs applications start --uuid abc-123

# Stop
{baseDir}/dist/coolify-cli.cjs applications stop --uuid abc-123

# Restart
{baseDir}/dist/coolify-cli.cjs applications restart --uuid abc-123
```

### 查看日志

```bash
{baseDir}/dist/coolify-cli.cjs applications logs --uuid abc-123
```

### 环境变量

```bash
# List environment variables
{baseDir}/dist/coolify-cli.cjs applications envs list --uuid abc-123

# Create environment variable
{baseDir}/dist/coolify-cli.cjs applications envs create \
  --uuid abc-123 \
  --key DATABASE_URL \
  --value "postgres://user:pass@host:5432/db" \
  --is-runtime true \
  --is-buildtime false

# Update environment variable
{baseDir}/dist/coolify-cli.cjs applications envs update \
  --uuid abc-123 \
  --env-uuid env-456 \
  --value "new-value"

# Bulk update environment variables
{baseDir}/dist/coolify-cli.cjs applications envs bulk-update \
  --uuid abc-123 \
  --json '{"DATABASE_URL":"postgres://...","API_KEY":"..."}'

# Delete environment variable
{baseDir}/dist/coolify-cli.cjs applications envs delete \
  --uuid abc-123 \
  --env-uuid env-456
```

### 创建应用

```bash
# Public Git repository
{baseDir}/dist/coolify-cli.cjs applications create-public \
  --project-uuid proj-123 \
  --server-uuid server-456 \
  --git-repository "https://github.com/user/repo" \
  --git-branch main \
  --name "My App"

# Private GitHub App
{baseDir}/dist/coolify-cli.cjs applications create-private-github-app \
  --project-uuid proj-123 \
  --server-uuid server-456 \
  --github-app-uuid gh-789 \
  --git-repository "user/repo" \
  --git-branch main

# Dockerfile
{baseDir}/dist/coolify-cli.cjs applications create-dockerfile \
  --project-uuid proj-123 \
  --server-uuid server-456 \
  --dockerfile-location "./Dockerfile" \
  --name "My Docker App"

# Docker Image
{baseDir}/dist/coolify-cli.cjs applications create-dockerimage \
  --project-uuid proj-123 \
  --server-uuid server-456 \
  --docker-image "nginx:latest" \
  --name "Nginx"

# Docker Compose
{baseDir}/dist/coolify-cli.cjs applications create-dockercompose \
  --project-uuid proj-123 \
  --server-uuid server-456 \
  --docker-compose-location "./docker-compose.yml"
```

---

## 数据库

### 列出数据库

```bash
{baseDir}/dist/coolify-cli.cjs databases list
```

### 获取数据库详情

```bash
{baseDir}/dist/coolify-cli.cjs databases get --uuid db-123
```

### 数据库生命周期管理

```bash
# Start
{baseDir}/dist/coolify-cli.cjs databases start --uuid db-123

# Stop
{baseDir}/dist/coolify-cli.cjs databases stop --uuid db-123

# Restart
{baseDir}/dist/coolify-cli.cjs databases restart --uuid db-123

# Delete
{baseDir}/dist/coolify-cli.cjs databases delete --uuid db-123
```

### 创建数据库

```bash
# PostgreSQL
{baseDir}/dist/coolify-cli.cjs databases create-postgresql \
  --project-uuid proj-123 \
  --server-uuid server-456 \
  --name "my-postgres" \
  --postgres-user admin \
  --postgres-password secret \
  --postgres-db myapp

# MySQL
{baseDir}/dist/coolify-cli.cjs databases create-mysql \
  --project-uuid proj-123 \
  --server-uuid server-456 \
  --name "my-mysql"

# MariaDB
{baseDir}/dist/coolify-cli.cjs databases create-mariadb \
  --project-uuid proj-123 \
  --server-uuid server-456 \
  --name "my-mariadb"

# MongoDB
{baseDir}/dist/coolify-cli.cjs databases create-mongodb \
  --project-uuid proj-123 \
  --server-uuid server-456 \
  --name "my-mongo"

# Redis
{baseDir}/dist/coolify-cli.cjs databases create-redis \
  --project-uuid proj-123 \
  --server-uuid server-456 \
  --name "my-redis"

# KeyDB
{baseDir}/dist/coolify-cli.cjs databases create-keydb \
  --project-uuid proj-123 \
  --server-uuid server-456 \
  --name "my-keydb"

# ClickHouse
{baseDir}/dist/coolify-cli.cjs databases create-clickhouse \
  --project-uuid proj-123 \
  --server-uuid server-456 \
  --name "my-clickhouse"

# Dragonfly
{baseDir}/dist/coolify-cli.cjs databases create-dragonfly \
  --project-uuid proj-123 \
  --server-uuid server-456 \
  --name "my-dragonfly"
```

### 备份

```bash
# List backup configurations
{baseDir}/dist/coolify-cli.cjs databases backups list --uuid db-123

# Create backup configuration
{baseDir}/dist/coolify-cli.cjs databases backups create \
  --uuid db-123 \
  --frequency "0 2 * * *" \
  --enabled true

# Get backup details
{baseDir}/dist/coolify-cli.cjs databases backups get \
  --uuid db-123 \
  --backup-uuid backup-456

# Update backup
{baseDir}/dist/coolify-cli.cjs databases backups update \
  --uuid db-123 \
  --backup-uuid backup-456 \
  --frequency "0 3 * * *"

# Trigger manual backup
{baseDir}/dist/coolify-cli.cjs databases backups trigger \
  --uuid db-123 \
  --backup-uuid backup-456

# List backup executions
{baseDir}/dist/coolify-cli.cjs databases backups executions \
  --uuid db-123 \
  --backup-uuid backup-456

# Delete backup configuration
{baseDir}/dist/coolify-cli.cjs databases backups delete \
  --uuid db-123 \
  --backup-uuid backup-456
```

---

## 服务（Docker Compose）

### 列出服务

```bash
{baseDir}/dist/coolify-cli.cjs services list
```

### 获取服务详情

```bash
{baseDir}/dist/coolify-cli.cjs services get --uuid service-123
```

### 服务生命周期管理

```bash
# Start
{baseDir}/dist/coolify-cli.cjs services start --uuid service-123

# Stop
{baseDir}/dist/coolify-cli.cjs services stop --uuid service-123

# Restart
{baseDir}/dist/coolify-cli.cjs services restart --uuid service-123

# Delete
{baseDir}/dist/coolify-cli.cjs services delete --uuid service-123
```

### 创建服务

```bash
{baseDir}/dist/coolify-cli.cjs services create \
  --project-uuid proj-123 \
  --server-uuid server-456 \
  --name "My Service" \
  --docker-compose '{"version":"3.8","services":{"web":{"image":"nginx"}}}'
```

### 环境变量

```bash
# List
{baseDir}/dist/coolify-cli.cjs services envs list --uuid service-123

# Create
{baseDir}/dist/coolify-cli.cjs services envs create \
  --uuid service-123 \
  --key API_KEY \
  --value "secret"

# Update
{baseDir}/dist/coolify-cli.cjs services envs update \
  --uuid service-123 \
  --env-uuid env-456 \
  --value "new-secret"

# Bulk update
{baseDir}/dist/coolify-cli.cjs services envs bulk-update \
  --uuid service-123 \
  --json '{"API_KEY":"secret","DB_HOST":"localhost"}'

# Delete
{baseDir}/dist/coolify-cli.cjs services envs delete \
  --uuid service-123 \
  --env-uuid env-456
```

---

## 部署

### 部署应用

```bash
# Deploy by UUID
{baseDir}/dist/coolify-cli.cjs deploy --uuid abc-123

# Force rebuild
{baseDir}/dist/coolify-cli.cjs deploy --uuid abc-123 --force

# Deploy by tag
{baseDir}/dist/coolify-cli.cjs deploy --tag production

# Instant deploy (skip queue)
{baseDir}/dist/coolify-cli.cjs deploy --uuid abc-123 --instant-deploy
```

### 列出部署

```bash
# List all running deployments
{baseDir}/dist/coolify-cli.cjs deployments list

# List deployments for specific application
{baseDir}/dist/coolify-cli.cjs deployments list-for-app --uuid abc-123
```

### 获取部署详情

```bash
{baseDir}/dist/coolify-cli.cjs deployments get --uuid deploy-456
```

### 取消部署

```bash
{baseDir}/dist/coolify-cli.cjs deployments cancel --uuid deploy-456
```

---

## 服务器

### 列出服务器

```bash
{baseDir}/dist/coolify-cli.cjs servers list
```

### 获取服务器详情

```bash
{baseDir}/dist/coolify-cli.cjs servers get --uuid server-123
```

### 创建服务器

```bash
{baseDir}/dist/coolify-cli.cjs servers create \
  --name "Production Server" \
  --ip "192.168.1.100" \
  --port 22 \
  --user root \
  --private-key-uuid key-456
```

### 更新服务器

```bash
{baseDir}/dist/coolify-cli.cjs servers update \
  --uuid server-123 \
  --name "Updated Name" \
  --description "Production environment"
```

### 验证服务器

```bash
{baseDir}/dist/coolify-cli.cjs servers validate --uuid server-123
```

### 获取服务器资源

```bash
# List all resources on server
{baseDir}/dist/coolify-cli.cjs servers resources --uuid server-123

# Get domains configured on server
{baseDir}/dist/coolify-cli.cjs servers domains --uuid server-123
```

### 删除服务器

```bash
{baseDir}/dist/coolify-cli.cjs servers delete --uuid server-123
```

---

## 项目

### 列出项目

```bash
{baseDir}/dist/coolify-cli.cjs projects list
```

### 获取项目详情

```bash
{baseDir}/dist/coolify-cli.cjs projects get --uuid proj-123
```

### 创建项目

```bash
{baseDir}/dist/coolify-cli.cjs projects create \
  --name "My Project" \
  --description "Production project"
```

### 更新项目

```bash
{baseDir}/dist/coolify-cli.cjs projects update \
  --uuid proj-123 \
  --name "Updated Name"
```

### 删除项目

```bash
{baseDir}/dist/coolify-cli.cjs projects delete --uuid proj-123
```

### 环境

```bash
# List environments
{baseDir}/dist/coolify-cli.cjs projects environments list --uuid proj-123

# Create environment
{baseDir}/dist/coolify-cli.cjs projects environments create \
  --uuid proj-123 \
  --name "staging"

# Get environment details
{baseDir}/dist/coolify-cli.cjs projects environments get \
  --uuid proj-123 \
  --environment staging

# Delete environment
{baseDir}/dist/coolify-cli.cjs projects environments delete \
  --uuid proj-123 \
  --environment staging
```

---

## 团队

### 列出团队

```bash
{baseDir}/dist/coolify-cli.cjs teams list
```

### 获取当前团队

```bash
{baseDir}/dist/coolify-cli.cjs teams current
```

### 获取团队成员

```bash
{baseDir}/dist/coolify-cli.cjs teams members
```

### 根据 ID 获取团队

```bash
{baseDir}/dist/coolify-cli.cjs teams get --id 1
```

---

## 安全（私钥）

### 列出私钥

```bash
{baseDir}/dist/coolify-cli.cjs security keys list
```

### 获取私钥

```bash
{baseDir}/dist/coolify-cli.cjs security keys get --uuid key-123
```

### 创建私钥

```bash
{baseDir}/dist/coolify-cli.cjs security keys create \
  --name "Production Key" \
  --description "SSH key for production servers" \
  --private-key "$(cat ~/.ssh/id_rsa)"
```

### 更新私钥

```bash
{baseDir}/dist/coolify-cli.cjs security keys update \
  --uuid key-123 \
  --name "Updated Key Name"
```

### 删除私钥

```bash
{baseDir}/dist/coolify-cli.cjs security keys delete --uuid key-123
```

---

## GitHub Apps

### 列出 GitHub Apps

```bash
{baseDir}/dist/coolify-cli.cjs github-apps list
```

### 获取 GitHub App

```bash
{baseDir}/dist/coolify-cli.cjs github-apps get --uuid gh-123
```

### 创建 GitHub App

```bash
{baseDir}/dist/coolify-cli.cjs github-apps create \
  --name "My GitHub App" \
  --app-id 123456 \
  --installation-id 789012 \
  --private-key "$(cat github-app-key.pem)"
```

### 更新 GitHub App

```bash
{baseDir}/dist/coolify-cli.cjs github-apps update \
  --uuid gh-123 \
  --name "Updated App Name"
```

### 删除 GitHub App

```bash
{baseDir}/dist/coolify-cli.cjs github-apps delete --uuid gh-123
```

### 列出仓库

```bash
{baseDir}/dist/coolify-cli.cjs github-apps repos --uuid gh-123
```

### 列出分支

```bash
{baseDir}/dist/coolify-cli.cjs github-apps branches \
  --uuid gh-123 \
  --owner myorg \
  --repo myrepo
```

---

## 常见使用场景

### 部署新应用

1. **列出可用服务器：**  
   ```bash
   {baseDir}/dist/coolify-cli.cjs servers list
   ```

2. **创建应用：**  
   ```bash
   {baseDir}/dist/coolify-cli.cjs applications create-public \
     --project-uuid proj-123 \
     --server-uuid server-456 \
     --git-repository "https://github.com/user/repo" \
     --git-branch main \
     --name "My App"
   ```

3. **配置环境变量：**  
   ```bash
   {baseDir}/dist/coolify-cli.cjs applications envs create \
     --uuid <new-app-uuid> \
     --key DATABASE_URL \
     --value "postgres://..." \
     --is-runtime true
   ```

4. **部署：**  
   ```bash
   {baseDir}/dist/coolify-cli.cjs deploy --uuid <new-app-uuid>
   ```

### 配置带备份的数据库

1. **创建数据库：**  
   ```bash
   {baseDir}/dist/coolify-cli.cjs databases create-postgresql \
     --project-uuid proj-123 \
     --server-uuid server-456 \
     --name "production-db"
   ```

2. **配置每日备份：**  
   ```bash
   {baseDir}/dist/coolify-cli.cjs databases backups create \
     --uuid <db-uuid> \
     --frequency "0 2 * * *" \
     --enabled true
   ```

3. **触发手动备份：**  
   ```bash
   {baseDir}/dist/coolify-cli.cjs databases backups trigger \
     --uuid <db-uuid> \
     --backup-uuid <backup-uuid>
   ```

### 监控应用健康状态

1. **检查应用状态：**  
   ```bash
   {baseDir}/dist/coolify-cli.cjs applications get --uuid abc-123
   ```

2. **查看最近日志：**  
   ```bash
   {baseDir}/dist/coolify-cli.cjs applications logs --uuid abc-123
   ```

3. **列出最近部署：**  
   ```bash
   {baseDir}/dist/coolify-cli.cjs deployments list-for-app --uuid abc-123
   ```

---

## 故障排查

### “未配置 API token”

**原因：** `COOLIFY_TOKEN` 环境变量未设置。

**解决方案：**  
```bash
export COOLIFY_TOKEN="your-token-here"
```

或在 Clawdbot 配置文件 `~/.clawdbot/clawdbot.json` 中配置：  
```json
{
  "skills": {
    "entries": {
      "coolify": {
        "apiKey": "your-token-here"
      }
    }
  }
}
```

### “超出速率限制”

**原因：** 短时间内发出过多 API 请求。

**解决方案：** 客户端会自动采用指数退避策略重试。请等待重试，或降低请求频率。

### “未找到应用”

**原因：** UUID 无效或不存在。

**解决方案：**  
```bash
# List all applications to find correct UUID
{baseDir}/dist/coolify-cli.cjs applications list
```

### “connect ECONNREFUSED”

**原因：** 无法连接到 Coolify API。

**自托管解决方案：**  
```bash
# Set custom API URL
export COOLIFY_API_URL="https://your-coolify.example.com/api/v1"
```

**Cloud 解决方案：** 检查网络连接，并确认 `app.coolify.io` 可访问。

### “部署失败”

**原因：** 构建或部署过程中发生错误。

**解决方案：**  
1. 检查部署日志：  
   ```bash
   {baseDir}/dist/coolify-cli.cjs deployments get --uuid deploy-456
   ```

2. 检查应用日志：  
   ```bash
   {baseDir}/dist/coolify-cli.cjs applications logs --uuid abc-123
   ```

3. 验证环境变量是否正确：  
   ```bash
   {baseDir}/dist/coolify-cli.cjs applications envs list --uuid abc-123
   ```

### 未找到 Node.js

**原因：** 未安装 Node.js 或其未加入 PATH。

**解决方案：**  
```bash
# macOS (via Homebrew)
brew install node

# Verify installation
node --version
```

---

## 输出格式

所有命令均返回结构化 JSON：

### 成功响应

```json
{
  "success": true,
  "data": { ... },
  "count": 42
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "type": "APIError",
    "message": "Application not found",
    "hint": "Use 'applications list' to find valid UUIDs"
  }
}
```

---

## 配置

### 环境变量

| 变量 | 是否必需 | 默认值 | 描述 |
|------|----------|--------|------|
| `COOLIFY_TOKEN` | 是 | — | 来自 Coolify 控制台的 API token |
| `COOLIFY_API_URL` | 否 | `https://app.coolify.io/api/v1` | API 基础 URL（适用于自托管） |

### 自托管 Coolify

对于自托管实例，请设置 API URL：

```bash
export COOLIFY_API_URL="https://coolify.example.com/api/v1"
export COOLIFY_TOKEN="your-token-here"
```

---

## 其他资源

- **本 skill 仓库：** https://github.com/visiongeist/coolifycli  
- **Coolify 文档：** https://coolify.io/docs/  
- **API 参考：** 详见 `{baseDir}/references/API.md`  
- **Coolify GitHub：** https://github.com/coollabsio/coolify  
- **Coolify Discord：** https://coollabs.io/discord  

---

## 边界情况与最佳实践

### UUID 与名称

大多数命令要求提供 UUID，而非名称。请始终先使用 `list` 命令查找 UUID：

```bash
# Bad: Using name (will fail)
{baseDir}/dist/coolify-cli.cjs applications get --uuid "my-app"

# Good: Using UUID
{baseDir}/dist/coolify-cli.cjs applications list  # Find UUID first
{baseDir}/dist/coolify-cli.cjs applications get --uuid abc-123
```

### 强制部署

请谨慎使用 `--force` 标志，因其将从头开始重建：

```bash
# Normal deployment (uses cache)
{baseDir}/dist/coolify-cli.cjs deploy --uuid abc-123

# Force rebuild (slower, but ensures clean build)
{baseDir}/dist/coolify-cli.cjs deploy --uuid abc-123 --force
```

### 环境变量更新

更新环境变量后，请重启应用：

```bash
# Update env var
{baseDir}/dist/coolify-cli.cjs applications envs update \
  --uuid abc-123 \
  --env-uuid env-456 \
  --value "new-value"

# Restart to apply changes
{baseDir}/dist/coolify-cli.cjs applications restart --uuid abc-123
```

### 备份频率

使用 cron 表达式设定备份计划：

| 表达式 | 描述 |
|--------|------|
| `0 2 * * *` | 每日凌晨 2 点 |
| `0 */6 * * *` | 每 6 小时一次 |
| `0 0 * * 0` | 每周日凌晨 0 点 |
| `0 0 1 * *` | 每月 1 日凌晨 0 点 |

---

## 总结

本 skill 提供对 Coolify API 的完整访问能力，覆盖以下方面：
- **应用** —— 部署、生命周期管理、日志、环境变量  
- **数据库** —— 8 类数据库、备份、生命周期管理  
- **服务** —— Docker Compose 编排  
- **部署** —— 触发、监控、取消  
- **服务器** —— 基础设施管理与验证  
- **项目** —— 组织与环境管理  
- **团队** —— 访问控制与协作  
- **安全** —— SSH 密钥管理  
- **GitHub Apps** —— 仓库集成  

所有操作均返回结构化 JSON，便于 agent 消费。