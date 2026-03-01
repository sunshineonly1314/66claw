---
name: unraid
name_zh: Unraid
version: 1.0.1
description: "通过 GraphQL API 查询和监控 Unraid 服务器。当用户要求‘检查 Unraid’、‘监控 Unraid’、‘Unraid API’、‘获取 Unraid 状态’、‘检查磁盘温度’、‘读取 Unraid 日志’、‘列出 Unraid 共享’、‘Unraid 阵列状态’、‘Unraid 容器’、‘Unraid 虚拟机’，或提及 Unraid 系统监控、磁盘健康、奇偶校验检查或服务器状态时启用。"
description_zh: 通过 GraphQL API 查询和监控 Unraid 服务器。当用户要求‘检查 Unraid’、‘监控 Unraid’、‘Unraid API’、‘获取 Unraid 状态’、‘检查磁盘温度’、‘读取 Unraid 日志’、‘列出 Unraid 共享’、‘Unraid 阵列状态’、‘Unraid 容器’、‘Unraid 虚拟机’，或提及 Unraid 系统监控、磁盘健康、奇偶校验检查或服务器状态时启用。
---
# Unraid API Skill

通过 GraphQL API 查询并监控 Unraid 服务器。支持全部 27 个只读端点，涵盖系统监控、磁盘健康、日志、容器、VMs 等功能。

## 快速入门

设置您的 Unraid 服务器凭据：

```bash
export UNRAID_URL="https://your-unraid-server/graphql"
export UNRAID_API_KEY="your-api-key"
```

**获取 API 密钥：** 设置 → 管理访问 → API 密钥 → 创建（选择“Viewer”角色）

使用辅助脚本执行任意查询：

```bash
./scripts/unraid-query.sh -q "{ online }"
```

或运行示例脚本：

```bash
./scripts/dashboard.sh              # Complete multi-server dashboard
./examples/disk-health.sh           # Disk temperatures & health
./examples/read-logs.sh syslog 20   # Read system logs
```

## 核心概念

### GraphQL API 结构

Unraid 7.2+ 使用 GraphQL（非 REST）。关键差异如下：
- **单一端点：** 所有查询均通过 `/graphql` 发起
- **按需请求：** 在查询中明确指定所需字段
- **强类型：** 利用内省（introspection）发现可用字段
- **不支持容器日志：** Docker 容器的标准输出日志无法通过 API 获取

### 两类统计资源

- **`info`** —— 静态硬件规格（CPU 型号、核心数、操作系统版本）
- **`metrics`** —— 实时使用率（CPU %、内存 %、当前负载）

监控场景请始终使用 `metrics`；查看规格信息请使用 `info`。

## 常见任务

### 系统监控

**检查服务器是否在线：**
```bash
./scripts/unraid-query.sh -q "{ online }"
```

**获取 CPU 和内存使用率：**
```bash
./scripts/unraid-query.sh -q "{ metrics { cpu { percentTotal } memory { used total percentTotal } } }"
```

**完整仪表板：**
```bash
./scripts/dashboard.sh
```

### 磁盘管理

**检查磁盘健康状况与温度：**
```bash
./examples/disk-health.sh
```

**获取阵列状态：**
```bash
./scripts/unraid-query.sh -q "{ array { state parityCheckStatus { status progress errors } } }"
```

**列出所有物理磁盘（含缓存盘/USB 盘）：**
```bash
./scripts/unraid-query.sh -q "{ disks { name } }"
```

### 存储共享

**列出网络共享：**
```bash
./scripts/unraid-query.sh -q "{ shares { name comment } }"
```

### 日志

**列出可用日志：**
```bash
./scripts/unraid-query.sh -q "{ logFiles { name size modifiedAt } }"
```

**读取日志内容：**
```bash
./examples/read-logs.sh syslog 20
```

### 容器与虚拟机

**列出 Docker 容器：**
```bash
./scripts/unraid-query.sh -q "{ docker { containers { names image state status } } }"
```

**列出虚拟机（VMs）：**
```bash
./scripts/unraid-query.sh -q "{ vms { name state cpus memory } } }"
```

**注意：** 容器标准输出日志 **无法** 通过 API 访问。请通过 SSH 使用 `docker logs` 获取。

### 通知

**获取通知数量：**
```bash
./scripts/unraid-query.sh -q "{ notifications { overview { unread { info warning alert total } } } }"
```

## 辅助脚本用法

`scripts/unraid-query.sh` 辅助脚本支持以下功能：

```bash
# Basic usage
./scripts/unraid-query.sh -u URL -k API_KEY -q "QUERY"

# Use environment variables
export UNRAID_URL="https://unraid.local/graphql"
export UNRAID_API_KEY="your-key"
./scripts/unraid-query.sh -q "{ online }"

# Format options
-f json    # Raw JSON (default)
-f pretty  # Pretty-printed JSON
-f raw     # Just the data (no wrapper)
```

## 补充资源

### 参考文档

详细说明请参阅：
- **`references/endpoints.md`** —— 全部 27 个 API 端点的完整列表
- **`references/troubleshooting.md`** —— 常见错误及解决方案
- **`references/api-reference.md`** —— 字段级详细文档

### 辅助脚本

- **`scripts/unraid-query.sh`** —— 主 GraphQL 查询工具
- **`scripts/dashboard.sh`** —— 自动化多服务器资产清单报告器

## 快速命令参考

```bash
# System status
./scripts/unraid-query.sh -q "{ online metrics { cpu { percentTotal } } }"

# Disk health
./examples/disk-health.sh

# Array status
./scripts/unraid-query.sh -q "{ array { state } }"

# Read logs
./examples/read-logs.sh syslog 20

# Complete dashboard
./scripts/dashboard.sh

# List shares
./scripts/unraid-query.sh -q "{ shares { name } }"

# List containers
./scripts/unraid-query.sh -q "{ docker { containers { names state } } }"
```