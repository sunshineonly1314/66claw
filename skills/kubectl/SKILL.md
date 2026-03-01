---
name: kubectl-skill
name_zh: kubectl
description: 通过 kubectl 命令执行并管理 Kubernetes 集群。支持查询资源、部署应用、调试容器、管理配置及监控集群健康状况。适用于处理 Kubernetes 集群、容器、Deployment 或 Pod 诊断等场景。
description_zh: 通过 kubectl 命令执行并管理 Kubernetes 集群。支持查询资源、部署应用、调试容器、管理配置及监控集群健康状况。适用于处理 Kubernetes 集群、容器、Deployment 或 Pod 诊断等场景。
license: MIT
metadata:
  author: Dennis de Vaal <d.devaal@gmail.com>
  version: "1.0.0"
  keywords: "kubernetes,k8s,container,docker,deployment,pods,cluster"
compatibility: 需要已安装的 kubectl 二进制程序（v1.20+）及已配置集群访问权限的活跃 kubeconfig 连接。支持 macOS、Linux 和 Windows（WSL）。
---
# kubectl Skill

使用 `kubectl` 命令行工具执行 Kubernetes 集群管理操作。

## 概述

本 skill 使 agent 能够：  
- **查询资源** — 列出并获取 Pod、Deployment、Service、Node 等资源的详细信息  
- **部署与更新** — 创建、应用、补丁及更新 Kubernetes 资源  
- **调试与排障** — 查看日志、在容器中执行命令、检查事件  
- **管理配置** — 更新 kubeconfig、切换上下文、管理命名空间  
- **监控健康状况** — 检查资源使用率、发布状态、事件及 Pod 状态  
- **执行运维操作** — 缩放 Deployment、排空节点、管理污点（taints）和标签（labels）  

## 前置条件

1. **kubectl 二进制程序** 已安装并可在 PATH 中访问（v1.20+）  
2. **kubeconfig** 文件已配置集群凭据（默认路径：`~/.kube/config`）  
3. 已建立至 Kubernetes 集群的**活跃连接**

## 快速设置

### 安装 kubectl

**macOS：**  
```bash
brew install kubernetes-cli
```

**Linux：**  
```bash
apt-get install -y kubectl  # Ubuntu/Debian
yum install -y kubectl      # RHEL/CentOS
```

**验证安装：**  
```bash
kubectl version --client
kubectl cluster-info  # Test connection
```

## 核心命令

### 查询资源  
```bash
kubectl get pods                    # List all pods in current namespace
kubectl get pods -A                 # All namespaces
kubectl get pods -o wide            # More columns
kubectl get nodes                   # List nodes
kubectl describe pod POD_NAME        # Detailed info with events
```

### 查看日志  
```bash
kubectl logs POD_NAME                # Get logs
kubectl logs -f POD_NAME             # Follow logs (tail -f)
kubectl logs POD_NAME -c CONTAINER   # Specific container
kubectl logs POD_NAME --previous     # Previous container logs
```

### 执行命令  
```bash
kubectl exec -it POD_NAME -- /bin/bash   # Interactive shell
kubectl exec POD_NAME -- COMMAND         # Run single command
```

### 部署应用  
```bash
kubectl apply -f deployment.yaml         # Apply config
kubectl create -f deployment.yaml        # Create resource
kubectl apply -f deployment.yaml --dry-run=client  # Test
```

### 更新应用  
```bash
kubectl set image deployment/APP IMAGE=IMAGE:TAG  # Update image
kubectl scale deployment/APP --replicas=3          # Scale pods
kubectl rollout status deployment/APP              # Check status
kubectl rollout undo deployment/APP                # Rollback
```

### 管理配置  
```bash
kubectl config view                  # Show kubeconfig
kubectl config get-contexts          # List contexts
kubectl config use-context CONTEXT   # Switch context
```

## 常见模式

### 调试 Pod  
```bash
# 1. Identify the issue
kubectl describe pod POD_NAME

# 2. Check logs
kubectl logs POD_NAME
kubectl logs POD_NAME --previous

# 3. Execute debug commands
kubectl exec -it POD_NAME -- /bin/bash

# 4. Check events
kubectl get events --sort-by='.lastTimestamp'
```

### 部署新版本  
```bash
# 1. Update image
kubectl set image deployment/MY_APP my-app=my-app:v2

# 2. Monitor rollout
kubectl rollout status deployment/MY_APP -w

# 3. Verify
kubectl get pods -l app=my-app

# 4. Rollback if needed
kubectl rollout undo deployment/MY_APP
```

### 为维护准备节点  
```bash
# 1. Drain node (evicts all pods)
kubectl drain NODE_NAME --ignore-daemonsets

# 2. Do maintenance
# ...

# 3. Bring back online
kubectl uncordon NODE_NAME
```

## 输出格式

`--output` (`-o`) 标志支持多种格式：

- `table` — 默认表格格式  
- `wide` — 扩展表格（含额外列）  
- `json` — JSON 格式（配合 `jq` 使用效果更佳）  
- `yaml` — YAML 格式  
- `jsonpath` — JSONPath 表达式  
- `custom-columns` — 自定义输出列  
- `name` — 仅显示资源名称  

**示例：**  
```bash
kubectl get pods -o json | jq '.items[0].metadata.name'
kubectl get pods -o jsonpath='{.items[*].metadata.name}'
kubectl get pods -o custom-columns=NAME:.metadata.name,STATUS:.status.phase
```

## 全局标志（所有命令均支持）

```bash
-n, --namespace=<ns>           # Operate in specific namespace
-A, --all-namespaces           # Operate across all namespaces
--context=<context>            # Use specific kubeconfig context
-o, --output=<format>          # Output format (json, yaml, table, etc.)
--dry-run=<mode>               # Dry-run mode (none, client, server)
-l, --selector=<labels>        # Filter by labels
--field-selector=<selector>    # Filter by fields
-v, --v=<int>                  # Verbosity level (0-9)
```

## Dry-Run 模式

- `--dry-run=client` — 快速客户端侧校验（安全测试命令）  
- `--dry-run=server` — 服务端校验（更准确）  
- `--dry-run=none` — 实际执行（默认）  

**务必先用 `--dry-run=client` 测试：**  
```bash
kubectl apply -f manifest.yaml --dry-run=client
```

## 高级主题

如需查阅详细参考资料、逐命令文档、故障排除指南及高级工作流，请参见：  
- [references/REFERENCE.md](references/REFERENCE.md) — 完整 kubectl 命令参考  
- [scripts/](scripts/) — 常见任务的辅助脚本  

## 实用提示

1. **批量操作时使用标签选择器：**  
   ```bash
   kubectl delete pods -l app=myapp
   kubectl get pods -l env=prod,tier=backend
   ```

2. **实时监视资源：**  
   ```bash
   kubectl get pods -w  # Watch for changes
   ```

3. **使用 `-A` 标志覆盖所有命名空间：**  
   ```bash
   kubectl get pods -A  # See pods everywhere
   ```

4. **保存输出以便后续比对：**  
   ```bash
   kubectl get deployment my-app -o yaml > deployment-backup.yaml
   ```

5. **删除前务必确认：**  
   ```bash
   kubectl delete pod POD_NAME --dry-run=client
   ```

## 获取帮助

```bash
kubectl help                      # General help
kubectl COMMAND --help            # Command help
kubectl explain pods              # Resource documentation
kubectl explain pods.spec         # Field documentation
```

## 环境变量

- `KUBECONFIG` — kubeconfig 文件路径（可包含多个路径，以 `:` 分隔）  
- `KUBECTL_CONTEXT` — 覆盖默认上下文  

## 相关资源

- [官方 kubectl 文档](https://kubernetes.io/docs/reference/kubectl/)  
- [kubectl 速查表](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)  
- [Kubernetes API 参考](https://kubernetes.io/docs/reference/generated/kubernetes-api/)  
- [Agent Skills 规范](https://agentskills.io/)  

---  

**版本：** 1.0.0  
**许可协议：** MIT  
**兼容性：** kubectl v1.20+，Kubernetes v1.20+  