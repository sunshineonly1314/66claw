---
name: k8s-backup
name_zh: K8s 备份
description: 使用 Velero 进行 Kubernetes 备份与恢复。适用于创建备份、恢复应用、管理灾难恢复，或在集群之间迁移工作负载。
description_zh: 使用 Velero 进行 Kubernetes 备份与恢复。适用于创建备份、恢复应用、管理灾难恢复，或在集群之间迁移工作负载。
---
# 使用 Velero 进行 Kubernetes 备份

使用 kubectl-mcp-server 的 Velero 工具管理备份与恢复。

## 检查 Velero 安装状态

```python
# Detect Velero
velero_detect_tool()

# List backup locations
velero_backup_locations_list_tool()
```

## 创建备份

```python
# Backup entire namespace
velero_backup_create_tool(
    name="my-backup",
    namespaces=["default", "app-namespace"]
)

# Backup with label selector
velero_backup_create_tool(
    name="app-backup",
    namespaces=["default"],
    label_selector="app=my-app"
)

# Backup excluding resources
velero_backup_create_tool(
    name="config-backup",
    namespaces=["default"],
    exclude_resources=["pods", "replicasets"]
)

# Backup with TTL
velero_backup_create_tool(
    name="daily-backup",
    namespaces=["production"],
    ttl="720h"  # 30 days
)
```

## 列出并描述备份

```python
# List all backups
velero_backups_list_tool()

# Get backup details
velero_backup_get_tool(name="my-backup")

# Check backup status
# - New: Backup request created
# - InProgress: Backup running
# - Completed: Backup successful
# - Failed: Backup failed
# - PartiallyFailed: Some items failed
```

## 从备份中恢复

```python
# Full restore
velero_restore_create_tool(
    name="my-restore",
    backup_name="my-backup"
)

# Restore to different namespace
velero_restore_create_tool(
    name="my-restore",
    backup_name="my-backup",
    namespace_mappings={"old-ns": "new-ns"}
)

# Restore specific resources
velero_restore_create_tool(
    name="config-restore",
    backup_name="my-backup",
    include_resources=["configmaps", "secrets"]
)

# Restore excluding resources
velero_restore_create_tool(
    name="partial-restore",
    backup_name="my-backup",
    exclude_resources=["persistentvolumeclaims"]
)
```

## 列出并监控恢复操作

```python
# List restores
velero_restores_list_tool()

# Get restore details
velero_restore_get_tool(name="my-restore")
```

## 定时备份

```python
# List schedules
velero_schedules_list_tool()

# Get schedule details
velero_schedule_get_tool(name="daily-backup")

# Create schedule (via kubectl)
kubectl_apply(manifest="""
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: daily-backup
  namespace: velero
spec:
  schedule: "0 2 * * *"  # 2 AM daily
  template:
    includedNamespaces:
    - production
    ttl: 720h
""")
```

## 灾难恢复工作流

### 创建灾难恢复（DR）备份
```python
1. velero_backup_create_tool(
       name="dr-backup-$(date)",
       namespaces=["production"]
   )
2. velero_backup_get_tool(name="dr-backup-...")  # Wait for completion
```

### 恢复到新集群
```python
1. velero_detect_tool()  # Verify Velero installed
2. velero_backups_list_tool()  # Find backup
3. velero_restore_create_tool(
       name="dr-restore",
       backup_name="dr-backup-..."
   )
4. velero_restore_get_tool(name="dr-restore")  # Monitor
```

## 相关 Skills

- [k8s-multicluster](../k8s-multicluster/SKILL.md) — 多集群操作
- [k8s-incident](../k8s-incident/SKILL.md) — 事件响应