---
name: komodo
name_zh: Komodo
description: 管理 Komodo 基础设施 —— 包括服务器、Docker 部署、堆栈（stacks）、构建（builds）与流程（procedures）。当用户询问服务器状态、容器管理、部署、构建或任何与 Komodo 相关的基础设施任务时使用。
description_zh: 管理 Komodo 基础设施 —— 包括服务器、Docker 部署、堆栈（stacks）、构建（builds）与流程（procedures）。当用户询问服务器状态、容器管理、部署、构建或任何与 Komodo 相关的基础设施任务时使用。
---
# Komodo 技能

通过 Komodo Core API 管理服务器、Docker 容器、堆栈、构建与流程。

## 前提条件

设置以下环境变量：
- `KOMODO_ADDRESS` —— Komodo Core URL（例如：`https://komodo.example.com`）  
- `KOMODO_API_KEY` —— API 密钥（以 `K-` 开头）  
- `KOMODO_API_SECRET` —— API 密钥密钥（以 `S-` 开头）

## 快速参考

```bash
# Set env (or source from credentials file)
export KOMODO_ADDRESS="https://komodo.weird.cyou"
export KOMODO_API_KEY="K-..."
export KOMODO_API_SECRET="S-..."

# List resources
python scripts/komodo.py servers
python scripts/komodo.py deployments
python scripts/komodo.py stacks
python scripts/komodo.py builds
python scripts/komodo.py procedures
python scripts/komodo.py repos

# Server operations
python scripts/komodo.py server <name>
python scripts/komodo.py server-stats <name>

# Deployment operations
python scripts/komodo.py deployment <name>
python scripts/komodo.py deploy <name>
python scripts/komodo.py start <name>
python scripts/komodo.py stop <name>
python scripts/komodo.py restart <name>
python scripts/komodo.py logs <name> [lines]

# Stack operations
python scripts/komodo.py stack <name>
python scripts/komodo.py deploy-stack <name>
python scripts/komodo.py start-stack <name>
python scripts/komodo.py stop-stack <name>
python scripts/komodo.py restart-stack <name>
python scripts/komodo.py create-stack <name> <server> <compose.yml> [env_file]
python scripts/komodo.py delete-stack <name>
python scripts/komodo.py stack-logs <name> [service]

# Build operations
python scripts/komodo.py build <name>
python scripts/komodo.py run-build <name>

# Procedure operations
python scripts/komodo.py procedure <name>
python scripts/komodo.py run-procedure <name>
```

## 状态指示符

- 🟢 运行中 / 正常  
- 🔴 已停止  
- ⚪ 未部署（NotDeployed）  
- 🟡 不健康（Unhealthy）  
- 🔄 正在重启  
- 🔨 正在构建  
- ⏳ 等待中（Pending）

## 直接 API 调用

对于 CLI 未覆盖的操作，请使用 curl：

```bash
# Read operation
curl -X POST "$KOMODO_ADDRESS/read/ListServers" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $KOMODO_API_KEY" \
  -H "X-Api-Secret: $KOMODO_API_SECRET" \
  -d '{}'

# Execute operation
curl -X POST "$KOMODO_ADDRESS/execute/Deploy" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $KOMODO_API_KEY" \
  -H "X-Api-Secret: $KOMODO_API_SECRET" \
  -d '{"deployment": "my-deployment"}'
```

## API 参考

读取类端点：`ListServers`、`ListDeployments`、`ListStacks`、`ListBuilds`、`ListProcedures`、`ListRepos`、`GetSystemStats`、`GetLog`  
执行类端点：`Deploy`、`StartDeployment`、`StopDeployment`、`RestartDeployment`、`DeployStack`、`StartStack`、`StopStack`、`RestartStack`、`RunBuild`、`RunProcedure`  
完整 API 文档：https://komo.do/docs