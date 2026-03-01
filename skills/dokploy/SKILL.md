---
name: dokploy
name_zh: Dokploy
description: "通过 Dokploy API 管理 Dokploy 的部署、项目、应用与域名。"
description_zh: 通过 Dokploy API 管理 Dokploy 的部署、项目、应用与域名。
emoji: "🐳"
metadata:
  clawdhub:
    requires:
      bins: ["curl", "jq"]
---
# Dokploy 技能

通过 Dokploy API 交互式管理项目、应用、域名与部署。

## 前置条件

1. **运行中的 Dokploy 实例**，且已启用 API 访问  
2. **API 密钥**：需在 `/settings/profile` → “API/CLI 设置” 中生成  
3. 设置环境变量 `DOKPLOY_API_URL`（默认值：`http://localhost:3000`）

## 配置方式

请设置以下环境变量，或使用配置命令：

```bash
# Dokploy instance URL
export DOKPLOY_API_URL="https://your-dokploy-instance.com"

# Your API token
export DOKPLOY_API_KEY="your-generated-api-key"

# Or run the config command
dokploy-config set --url "https://your-dokploy-instance.com" --key "your-api-key"
```

## 项目（Projects）

### 列出全部项目
```bash
dokploy-project list
```

### 获取项目详情
```bash
dokploy-project get <project-id>
```

### 创建新项目
```bash
dokploy-project create --name "My Project" --description "Description here"
```

### 更新项目
```bash
dokploy-project update <project-id> --name "New Name" --description "Updated"
```

### 删除项目
```bash
dokploy-project delete <project-id>
```

## 应用（Applications）

### 列出某项目下的全部应用
```bash
dokploy-app list --project <project-id>
```

### 获取应用详情
```bash
dokploy-app get <application-id>
```

### 创建应用
```bash
dokploy-app create \
  --project <project-id> \
  --name "my-app" \
  --type "docker" \
  --image "nginx:latest"
```

**应用类型：** `docker`、`git`、`compose`

### 触发部署
```bash
dokploy-app deploy <application-id>
```

### 获取部署日志
```bash
dokploy-app logs <application-id> --deployment <deployment-id>
```

### 列出部署记录
```bash
dokploy-app deployments <application-id>
```

### 更新应用
```bash
dokploy-app update <application-id> --name "new-name" --env "KEY=VALUE"
```

### 删除应用
```bash
dokploy-app delete <application-id>
```

## 域名（Domains）

### 列出某应用绑定的全部域名
```bash
dokploy-domain list --application <application-id>
```

### 获取域名详情
```bash
dokploy-domain get <domain-id>
```

### 为应用添加域名
```bash
dokploy-domain create \
  --application <application-id> \
  --domain "app.example.com" \
  --path "/" \
  --port 80
```

### 更新域名
```bash
dokploy-domain update <domain-id> --domain "new.example.com"
```

### 删除域名
```bash
dokploy-domain delete <domain-id>
```

## 环境变量（Environment Variables）

### 列出某应用的所有环境变量
```bash
dokploy-app env list <application-id>
```

### 设置环境变量
```bash
dokploy-app env set <application-id> --key "DATABASE_URL" --value "postgres://..."
```

### 删除环境变量
```bash
dokploy-app env delete <application-id> --key "DATABASE_URL"
```

## 实用命令（Utility Commands）

### 检查 API 连通性
```bash
dokploy-status
```

### 查看当前配置
```bash
dokploy-config show
```

## API 参考文档

基础 URL：`$DOKPLOY_API_URL/api`

| 接口端点 | 方法 | 描述 |
|----------|------|------|
| `/project.all` | GET | 列出全部项目 |
| `/project.create` | POST | 创建项目 |
| `/project.byId` | GET | 根据 ID 获取项目 |
| `/project.update` | PATCH | 更新项目 |
| `/project.delete` | DELETE | 删除项目 |
| `/application.all` | GET | 列出全部应用 |
| `/application.create` | POST | 创建应用 |
| `/application.byId` | GET | 根据 ID 获取应用 |
| `/application.update` | PATCH | 更新应用 |
| `/application.delete` | DELETE | 删除应用 |
| `/application.deploy` | POST | 触发部署 |
| `/deployment.all` | GET | 列出部署记录 |
| `/deployment.byId` | GET | 根据 ID 获取部署 |
| `/deployment.logs` | GET | 获取部署日志 |
| `/domain.all` | GET | 列出全部域名 |
| `/domain.create` | POST | 创建域名 |
| `/domain.update` | PATCH | 更新域名 |
| `/domain.delete` | DELETE | 删除域名 |

## 注意事项

- 所有 API 调用均需携带 `x-api-key` 请求头  
- 在脚本中解析 JSON 时，请使用 `jq` 工具  
- 部分操作需管理员权限  
- 部署为异步操作——请调用状态接口检查进度  