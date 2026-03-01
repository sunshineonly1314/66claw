---
name: k8s-multicluster
name_zh: K8 多集群
description: 管理多个 Kubernetes 集群、切换上下文、执行跨集群操作。适用于多集群协作、环境对比或集群生命周期管理场景。
description_zh: 管理多个 Kubernetes 集群、切换上下文、执行跨集群操作。适用于多集群协作、环境对比或集群生命周期管理场景。
---
# 多集群 Kubernetes 管理

借助 kubectl-mcp-server 的多集群支持能力，实现跨集群操作与上下文管理。

## 上下文管理

### 列出可用上下文
```
list_contexts_tool()
```

### 查看当前上下文
```
kubeconfig_view()  # Shows sanitized kubeconfig
```

### 切换上下文
CLI 方式：`kubectl-mcp-server context <context-name>`

## 跨集群操作

所有 kubectl-mcp-server 工具均支持 `context` 参数：

```python
# Get pods from production cluster
get_pods(namespace="default", context="production-cluster")

# Get pods from staging cluster
get_pods(namespace="default", context="staging-cluster")
```

## 常见多集群模式

### 环境对比

```
# Compare deployment across clusters
compare_namespaces(
    namespace1="production",
    namespace2="staging",
    resource_type="deployment",
    context="production-cluster"
)
```

### 并行查询
同时向多个集群发起查询：

```
# Production cluster
get_pods(namespace="app", context="prod-us-east")
get_pods(namespace="app", context="prod-eu-west")

# Development cluster
get_pods(namespace="app", context="development")
```

### 跨集群健康检查
```
# Check all clusters
for context in ["prod-1", "prod-2", "staging"]:
    get_nodes(context=context)
    get_pods(namespace="kube-system", context=context)
```

## Cluster API（CAPI）管理

用于管理集群生命周期：

### 列出托管集群
```
capi_clusters_list_tool(namespace="capi-system")
```

### 获取集群详情
```
capi_cluster_get_tool(name="prod-cluster", namespace="capi-system")
```

### 获取工作负载集群 kubeconfig
```
capi_cluster_kubeconfig_tool(name="prod-cluster", namespace="capi-system")
```

### 机器（Machine）管理
```
capi_machines_list_tool(namespace="capi-system")
capi_machinedeployments_list_tool(namespace="capi-system")
```

### 扩缩集群
```
capi_machinedeployment_scale_tool(
    name="prod-cluster-md-0",
    namespace="capi-system",
    replicas=5
)
```

详细模式请参阅 [CONTEXT-SWITCHING.md](CONTEXT-SWITCHING.md)。

## 多集群 Helm

向特定集群部署 Chart：
```
install_helm_chart(
    name="nginx",
    chart="bitnami/nginx",
    namespace="web",
    context="production-cluster"
)

list_helm_releases(
    namespace="web",
    context="staging-cluster"
)
```

## 多集群 GitOps

### Flux 跨集群部署
```
flux_kustomizations_list_tool(
    namespace="flux-system",
    context="cluster-1"
)

flux_reconcile_tool(
    kind="kustomization",
    name="apps",
    namespace="flux-system",
    context="cluster-2"
)
```

### ArgoCD 跨集群部署
```
argocd_apps_list_tool(namespace="argocd", context="management-cluster")
```

## 联邦（Federation）模式

### 密钥同步
```
# Read from source cluster
get_secrets(namespace="app", context="source-cluster")

# Apply to target cluster (via manifest)
apply_manifest(secret_manifest, namespace="app", context="target-cluster")
```

### 跨集群服务发现
使用 Cilium ClusterMesh 或 Istio 多集群方案：
```
cilium_nodes_list_tool(context="cluster-1")
istio_proxy_status_tool(context="cluster-2")
```

## 最佳实践

1. **命名规范**：使用具描述性的上下文名称  
   - `prod-us-east-1`、`staging-eu-west-1`  

2. **访问控制**：各环境使用独立 kubeconfig  
   - 生产环境：多数用户仅具只读权限  
   - 开发环境：开发者拥有完整权限  

3. **始终显式指定上下文**：避免意外的跨集群操作  
   ```
   # Explicit is better
   get_pods(namespace="app", context="production")
   ```  

4. **集群分组**：按用途组织集群  
   - 生产环境：`prod-*`  
   - 预发布环境：`staging-*`  
   - 开发环境：`dev-*`  

## 相关 Skills
- [k8s-troubleshoot](../k8s-troubleshoot/SKILL.md) —— 跨集群问题调试  
- [k8s-gitops](../k8s-gitops/SKILL.md) —— GitOps 多集群方案  