---
name: k8s-capi
name_zh: K8s CAPI
description: 使用 Cluster API 进行 Kubernetes 集群的生命周期管理，包括集群部署、扩缩容与升级。适用于管理集群基础设施或执行多集群操作。
description_zh: 使用 Cluster API 进行 Kubernetes 集群的生命周期管理，包括集群部署、扩缩容与升级。适用于管理集群基础设施或执行多集群操作。
---
# Cluster API 生命周期管理

使用 kubectl-mcp-server 的 Cluster API 工具（共 11 个工具）管理 Kubernetes 集群。

## 检查安装状态

```python
capi_detect_tool()
```

## 列出集群

```python
# List all CAPI clusters
capi_clusters_list_tool(namespace="default")

# Shows:
# - Cluster name
# - Phase (Provisioning, Provisioned, Deleting)
# - Infrastructure ready
# - Control plane ready
```

## 获取集群详情

```python
capi_cluster_get_tool(name="my-cluster", namespace="default")

# Shows:
# - Spec (control plane, infrastructure)
# - Status (phase, conditions)
# - Network configuration
```

## 获取集群 kubeconfig

```python
# Get kubeconfig for workload cluster
capi_cluster_kubeconfig_tool(name="my-cluster", namespace="default")

# Returns kubeconfig to access the cluster
```

## 节点（Machines）

### 列出节点

```python
capi_machines_list_tool(namespace="default")

# Shows:
# - Machine name
# - Cluster
# - Phase (Running, Provisioning, Failed)
# - Provider ID
# - Version
```

### 获取节点详情

```python
capi_machine_get_tool(name="my-cluster-md-0-xxx", namespace="default")
```

## 节点部署（Machine Deployments）

### 列出节点部署

```python
capi_machinedeployments_list_tool(namespace="default")

# Shows:
# - Deployment name
# - Cluster
# - Replicas (ready/total)
# - Version
```

### 扩缩容节点部署

```python
# Scale worker nodes
capi_machinedeployment_scale_tool(
    name="my-cluster-md-0",
    namespace="default",
    replicas=5
)
```

## 节点集（Machine Sets）

```python
capi_machinesets_list_tool(namespace="default")
```

## 节点健康检查

```python
capi_machinehealthchecks_list_tool(namespace="default")

# Health checks automatically remediate unhealthy machines
```

## 集群类（Cluster Classes）

```python
# List cluster templates
capi_clusterclasses_list_tool(namespace="default")

# ClusterClasses define reusable cluster configurations
```

## 创建集群

```python
kubectl_apply(manifest="""
apiVersion: cluster.x-k8s.io/v1beta1
kind: Cluster
metadata:
  name: my-cluster
  namespace: default
spec:
  clusterNetwork:
    pods:
      cidrBlocks:
      - 192.168.0.0/16
    services:
      cidrBlocks:
      - 10.96.0.0/12
  controlPlaneRef:
    apiVersion: controlplane.cluster.x-k8s.io/v1beta1
    kind: KubeadmControlPlane
    name: my-cluster-control-plane
  infrastructureRef:
    apiVersion: infrastructure.cluster.x-k8s.io/v1beta1
    kind: AWSCluster
    name: my-cluster
""")
```

## 创建节点部署

```python
kubectl_apply(manifest="""
apiVersion: cluster.x-k8s.io/v1beta1
kind: MachineDeployment
metadata:
  name: my-cluster-md-0
  namespace: default
spec:
  clusterName: my-cluster
  replicas: 3
  selector:
    matchLabels:
      cluster.x-k8s.io/cluster-name: my-cluster
  template:
    spec:
      clusterName: my-cluster
      version: v1.28.0
      bootstrap:
        configRef:
          apiVersion: bootstrap.cluster.x-k8s.io/v1beta1
          kind: KubeadmConfigTemplate
          name: my-cluster-md-0
      infrastructureRef:
        apiVersion: infrastructure.cluster.x-k8s.io/v1beta1
        kind: AWSMachineTemplate
        name: my-cluster-md-0
""")
```

## 集群生命周期工作流

### 部署新集群
```python
1. kubectl_apply(cluster_manifest)
2. capi_clusters_list_tool(namespace)  # Wait for Provisioned
3. capi_cluster_kubeconfig_tool(name, namespace)  # Get access
```

### 扩缩容工作节点
```python
1. capi_machinedeployments_list_tool(namespace)
2. capi_machinedeployment_scale_tool(name, namespace, replicas)
3. capi_machines_list_tool(namespace)  # Monitor
```

### 升级集群
```python
1. # Update control plane version
2. # Update machine deployment version
3. capi_machines_list_tool(namespace)  # Monitor rollout
```

## 故障排查

### 集群卡在部署阶段

```python
1. capi_cluster_get_tool(name, namespace)  # Check conditions
2. capi_machines_list_tool(namespace)  # Check machine status
3. get_events(namespace)  # Check events
4. # Check infrastructure provider logs
```

### 节点失败

```python
1. capi_machine_get_tool(name, namespace)
2. get_events(namespace)
3. # Common issues:
   # - Cloud provider quota
   # - Invalid machine template
   # - Network issues
```

## 相关 Skills

- [k8s-multicluster](../k8s-multicluster/SKILL.md) — 多集群操作
- [k8s-operations](../k8s-operations/SKILL.md) — kubectl 操作