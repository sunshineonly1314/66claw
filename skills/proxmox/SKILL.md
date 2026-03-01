---
name: proxmox
name_zh: Proxmox
description: 通过 REST API 管理 Proxmox VE 集群。当用户要求列出、启动、停止、重启虚拟机（VM）或 LXC 容器，检查节点状态，创建快照，查看任务，或管理 Proxmox 基础设施时使用。需预先配置 API token 或凭据。
description_zh: 通过 REST API 管理 Proxmox VE 集群。当用户要求列出、启动、停止、重启虚拟机（VM）或 LXC 容器，检查节点状态，创建快照，查看任务，或管理 Proxmox 基础设施时使用。需预先配置 API token 或凭据。
---
# Proxmox VE 管理

## 配置

设置环境变量，或将其存入 `~/.proxmox-credentials`：

```bash
# Option 1: API Token (recommended)
export PROXMOX_HOST="https://192.168.1.100:8006"
export PROXMOX_TOKEN_ID="user@pam!tokenname"
export PROXMOX_TOKEN_SECRET="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Option 2: Credentials file
cat > ~/.proxmox-credentials << 'EOF'
PROXMOX_HOST=https://192.168.1.100:8006
PROXMOX_TOKEN_ID=user@pam!monitoring
PROXMOX_TOKEN_SECRET=your-token-secret
EOF
chmod 600 ~/.proxmox-credentials
```

在 Proxmox 中创建 API token：Datacenter → Permissions → API Tokens → Add（数据中心 → 权限 → API Token → 添加）

## CLI 使用方式

```bash
# Load credentials
source ~/.proxmox-credentials 2>/dev/null

# Auth header for API token
AUTH="Authorization: PVEAPIToken=$PROXMOX_TOKEN_ID=$PROXMOX_TOKEN_SECRET"
```

## 常用操作

### 集群与节点

```bash
# Cluster status
curl -ks -H "$AUTH" "$PROXMOX_HOST/api2/json/cluster/status" | jq

# List nodes
curl -ks -H "$AUTH" "$PROXMOX_HOST/api2/json/nodes" | jq '.data[] | {node, status, cpu, mem: (.mem/.maxmem*100|round)}'

# Node status
curl -ks -H "$AUTH" "$PROXMOX_HOST/api2/json/nodes/{node}/status" | jq
```

### 列出虚拟机与容器

```bash
# All VMs on a node
curl -ks -H "$AUTH" "$PROXMOX_HOST/api2/json/nodes/{node}/qemu" | jq '.data[] | {vmid, name, status, mem: .mem, cpu: (.cpu*100|round)}'

# All LXC containers on a node
curl -ks -H "$AUTH" "$PROXMOX_HOST/api2/json/nodes/{node}/lxc" | jq '.data[] | {vmid, name, status}'

# Cluster-wide resources
curl -ks -H "$AUTH" "$PROXMOX_HOST/api2/json/cluster/resources?type=vm" | jq '.data[] | {node, vmid, name, type, status}'
```

### 虚拟机/容器控制

```bash
# Start VM
curl -ks -X POST -H "$AUTH" "$PROXMOX_HOST/api2/json/nodes/{node}/qemu/{vmid}/status/start"

# Stop VM
curl -ks -X POST -H "$AUTH" "$PROXMOX_HOST/api2/json/nodes/{node}/qemu/{vmid}/status/stop"

# Shutdown VM (graceful)
curl -ks -X POST -H "$AUTH" "$PROXMOX_HOST/api2/json/nodes/{node}/qemu/{vmid}/status/shutdown"

# Reboot VM
curl -ks -X POST -H "$AUTH" "$PROXMOX_HOST/api2/json/nodes/{node}/qemu/{vmid}/status/reboot"

# Same for LXC: replace /qemu/ with /lxc/
```

### 快照

```bash
# List snapshots
curl -ks -H "$AUTH" "$PROXMOX_HOST/api2/json/nodes/{node}/qemu/{vmid}/snapshot" | jq

# Create snapshot
curl -ks -X POST -H "$AUTH" "$PROXMOX_HOST/api2/json/nodes/{node}/qemu/{vmid}/snapshot" \
  -d "snapname=snap1" -d "description=Before update"

# Rollback
curl -ks -X POST -H "$AUTH" "$PROXMOX_HOST/api2/json/nodes/{node}/qemu/{vmid}/snapshot/{snapname}/rollback"

# Delete snapshot
curl -ks -X DELETE -H "$AUTH" "$PROXMOX_HOST/api2/json/nodes/{node}/qemu/{vmid}/snapshot/{snapname}"
```

### 任务与日志

```bash
# Recent tasks
curl -ks -H "$AUTH" "$PROXMOX_HOST/api2/json/nodes/{node}/tasks" | jq '.data[:10] | .[] | {upid, type, status, user}'

# Task log
curl -ks -H "$AUTH" "$PROXMOX_HOST/api2/json/nodes/{node}/tasks/{upid}/log" | jq -r '.data[].t'
```

### 存储

```bash
# List storage
curl -ks -H "$AUTH" "$PROXMOX_HOST/api2/json/nodes/{node}/storage" | jq '.data[] | {storage, type, active, used_fraction: (.used/.total*100|round|tostring + "%")}'

# Storage content
curl -ks -H "$AUTH" "$PROXMOX_HOST/api2/json/nodes/{node}/storage/{storage}/content" | jq
```

### 备份

```bash
# List backups
curl -ks -H "$AUTH" "$PROXMOX_HOST/api2/json/nodes/{node}/storage/{storage}/content?content=backup" | jq

# Start backup
curl -ks -X POST -H "$AUTH" "$PROXMOX_HOST/api2/json/nodes/{node}/vzdump" \
  -d "vmid={vmid}" -d "storage={storage}" -d "mode=snapshot"
```

## 辅助脚本

使用 `scripts/pve.sh` 执行常见操作：

```bash
./scripts/pve.sh status          # Cluster overview
./scripts/pve.sh vms             # List all VMs
./scripts/pve.sh start {vmid}    # Start VM
./scripts/pve.sh stop {vmid}     # Stop VM
```

## 注意事项

- 请将 `{node}`、`{vmid}`、`{storage}`、`{snapname}` 替换为实际值  
- API token 在执行 POST/PUT/DELETE 请求时无需 CSRF token  
- 使用 `-k` 可跳过 SSL 验证（适用于自签名证书）  
- 任务类操作返回 UPID，可用于追踪异步作业  