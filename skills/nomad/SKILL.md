---
name: nomad
name_zh: Nomad
version: 1.0.0
description: 查询 HashiCorp Nomad 集群。列出作业（jobs）、节点（nodes）、分配（allocations）、评估（evaluations）和服务（services）。仅支持只读操作，用于监控与故障排查。
description_zh: 查询 HashiCorp Nomad 集群。列出作业（jobs）、节点（nodes）、分配（allocations）、评估（evaluations）和服务（services）。仅支持只读操作，用于监控与故障排查。
homepage: https://github.com/danfedick/nomad-skill
metadata: {"clawdbot":{"emoji":"📦","requires":{"bins":["nomad"]}}}
---
# Nomad Skill

使用 `nomad` CLI 查询 HashiCorp Nomad 集群。仅支持只读操作，用于监控与故障排查。

## 要求

- 已安装 `nomad` CLI
- 已设置 `NOMAD_ADDR` 环境变量（若未设置，则默认为 http://127.0.0.1:4646）
- 若启用了 ACL，则需提供 `NOMAD_TOKEN`

## 命令

### 作业（Jobs）

列出全部作业：
```bash
nomad job status
```

获取作业详情：
```bash
nomad job status <job-id>
```

作业历史记录：
```bash
nomad job history <job-id>
```

作业部署记录：
```bash
nomad job deployments <job-id>
```

### 分配（Allocations）

列出某作业的所有分配：
```bash
nomad job allocs <job-id>
```

分配详情：
```bash
nomad alloc status <alloc-id>
```

分配日志（stdout）：
```bash
nomad alloc logs <alloc-id>
```

分配日志（stderr）：
```bash
nomad alloc logs -stderr <alloc-id>
```

实时跟踪日志：
```bash
nomad alloc logs -f <alloc-id>
```

### 节点（Nodes）

列出全部节点：
```bash
nomad node status
```

Node details:
```bash
nomad node status <node-id>
```

Node allocations:
```bash
nomad node status -allocs <node-id>
```

### 评估（Evaluations）

列出最近的评估：
```bash
nomad eval list
```

评估详情：
```bash
nomad eval status <eval-id>
```

### 服务（Services）

列出服务（Nomad 原生服务发现）：
```bash
nomad service list
```

服务信息：
```bash
nomad service info <service-name>
```

### 命名空间（Namespaces）

列出命名空间：
```bash
nomad namespace list
```

### 变量（Variables）

列出变量：
```bash
nomad var list
```

获取变量：
```bash
nomad var get <path>
```

### 集群（Cluster）

服务器成员列表：
```bash
nomad server members
```

Agent 信息：
```bash
nomad agent-info
```

## JSON 输出

对大多数命令添加 `-json` 参数可获得 JSON 格式输出：
```bash
nomad job status -json
nomad node status -json
nomad alloc status -json <alloc-id>
```

## 过滤

使用 `-filter` 进行表达式驱动的过滤：
```bash
nomad job status -filter='Status == "running"'
nomad node status -filter='Status == "ready"'
```

## 常见模式

### 查找失败的分配
```bash
nomad job allocs <job-id> | grep -i failed
```

### 获取最新分配的日志
```bash
nomad alloc logs $(nomad job allocs -json <job-id> | jq -r '.[0].ID')
```

### 检查集群健康状态
```bash
nomad server members
nomad node status
```

## 环境变量

- `NOMAD_ADDR` — Nomad API 地址（默认值：http://127.0.0.1:4646）
- `NOMAD_TOKEN` — 用于身份验证的 ACL token
- `NOMAD_NAMESPACE` — 默认命名空间
- `NOMAD_REGION` — 默认区域（region）
- `NOMAD_CACERT` — TLS CA 证书路径
- `NOMAD_CLIENT_CERT` — TLS 客户端证书路径
- `NOMAD_CLIENT_KEY` — TLS 客户端密钥路径

## 注意事项

- 本 skill 为只读型，不支持提交、停止或修改任何作业。
- 如需交互式集群管理，请使用 `nomad-tui`。
- 如需部署作业，请直接使用 `nomad job run <file.nomad.hcl>`。