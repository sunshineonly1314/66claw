---
name: meshguard
name_zh: MeshGuard
description: 管理 MeshGuard AI agent 治理功能——agents、策略、审计日志及监控。
description_zh: 管理 MeshGuard AI agent 治理功能——agents、策略、审计日志及监控。
metadata: {"clawdbot":{"requires":{"bins":["curl","jq"]}}}
---
# MeshGuard

AI agent 治理平台。用于管理 agents、策略、审计日志，并监控您的 MeshGuard 实例。

## 配置

首次配置请运行向导：
```bash
bash skills/meshguard/scripts/meshguard-setup.sh
```  
该操作将配置信息（URL、API 密钥、管理员令牌）保存至 `~/.meshguard/config`。

## 环境变量

| 变量 | 描述 |
|------|------|
| `MESHGUARD_URL` | 网关 URL（默认值：`https://dashboard.meshguard.app`） |
| `MESHGUARD_API_KEY` | 用于认证请求的 API 密钥 |
| `MESHGUARD_ADMIN_TOKEN` | 用于组织管理与注册的管理员令牌 |

CLI 会自动加载配置文件 `~/.meshguard/config`。

## CLI 使用方式

所有命令均通过封装脚本执行：  
```bash
bash skills/meshguard/scripts/meshguard-cli.sh <command> [args...]
```

### 状态检查
```bash
meshguard-cli.sh status
```  
返回网关健康状态、版本号及连通性信息。

### Agent 管理
```bash
meshguard-cli.sh agents list                          # List all agents in org
meshguard-cli.sh agents create <name> --tier <tier>   # Create agent (tier: free|pro|enterprise)
meshguard-cli.sh agents get <agent-id>                # Get agent details
meshguard-cli.sh agents delete <agent-id>             # Delete agent
```

### 策略管理
```bash
meshguard-cli.sh policies list                        # List all policies
meshguard-cli.sh policies create <yaml-file>          # Create policy from YAML file
meshguard-cli.sh policies get <policy-id>             # Get policy details
meshguard-cli.sh policies delete <policy-id>          # Delete policy
```

策略 YAML 格式示例：  
```yaml
name: rate-limit-policy
description: Limit agent calls to 100/min
rules:
  - type: rate_limit
    max_requests: 100
    window_seconds: 60
  - type: content_filter
    block_categories: [pii, credentials]
```

### 审计日志
```bash
meshguard-cli.sh audit query                              # Recent audit events
meshguard-cli.sh audit query --agent <name>               # Filter by agent
meshguard-cli.sh audit query --action <action>            # Filter by action type
meshguard-cli.sh audit query --limit 50                   # Limit results
meshguard-cli.sh audit query --agent X --action Y --limit N  # Combined filters
```

支持的操作：`agent.create`、`agent.delete`、`policy.create`、`policy.update`、`policy.delete`、`auth.login`、`auth.revoke`

### 自助注册（Self-Service Signup）
```bash
meshguard-cli.sh signup --name "Acme Corp" --email admin@acme.com
```  
创建新组织并返回 API 凭据。需提供 `MESHGUARD_ADMIN_TOKEN`。

## 工作流示例

**为新 agent 配置 agent 并应用策略：**  
1. 创建 agent：`meshguard-cli.sh agents create my-agent --tier pro`  
2. 创建策略：`meshguard-cli.sh policies create policy.yaml`  
3. 验证配置：`meshguard-cli.sh agents list`  

**调查 agent 活动：**  
1. 查询日志：`meshguard-cli.sh audit query --agent my-agent --limit 20`  
2. 检查 agent 状态：`meshguard-cli.sh agents get <id>`  

## API 参考

完整端点文档请参阅 `skills/meshguard/references/api-reference.md`。