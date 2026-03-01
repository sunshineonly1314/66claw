---
name: digital-ocean
name_zh: DigitalOcean
description: 通过 DO API 管理 Digital Ocean 云服务器（Droplets）、域名及基础设施。
description_zh: 通过 DO API 管理 Digital Ocean 云服务器（Droplets）、域名及基础设施。
homepage: https://docs.digitalocean.com/reference/api/
metadata: {"clawdis":{"emoji":"🌊","requires":{"bins":["uv","curl"],"env":["DO_API_TOKEN"]},"primaryEnv":"DO_API_TOKEN"}}
---
# Digital Ocean 管理

控制 DO 云服务器（Droplets）、域名及基础设施。

## 初始化设置

设置环境变量：
- `DO_API_TOKEN`：您的 Digital Ocean API Token（在 cloud.digitalocean.com/account/api/tokens 创建）

## CLI 命令

```bash
# Account info
uv run {baseDir}/scripts/do.py account

# List all droplets
uv run {baseDir}/scripts/do.py droplets

# Get droplet details
uv run {baseDir}/scripts/do.py droplet <droplet_id>

# List domains
uv run {baseDir}/scripts/do.py domains

# List domain records
uv run {baseDir}/scripts/do.py records <domain>

# Droplet actions
uv run {baseDir}/scripts/do.py power-off <droplet_id>
uv run {baseDir}/scripts/do.py power-on <droplet_id>
uv run {baseDir}/scripts/do.py reboot <droplet_id>
```

## 直接调用 API（curl）

### 列出云服务器（Droplets）
```bash
curl -s -H "Authorization: Bearer $DO_API_TOKEN" \
  "https://api.digitalocean.com/v2/droplets" | jq '.droplets[] | {id, name, status, ip: .networks.v4[0].ip_address}'
```

### 获取账户信息
```bash
curl -s -H "Authorization: Bearer $DO_API_TOKEN" \
  "https://api.digitalocean.com/v2/account" | jq '.account'
```

### 列出域名
```bash
curl -s -H "Authorization: Bearer $DO_API_TOKEN" \
  "https://api.digitalocean.com/v2/domains" | jq '.domains[].name'
```

### 创建云服务器（Droplet）
```bash
curl -s -X POST -H "Authorization: Bearer $DO_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-droplet",
    "region": "nyc1",
    "size": "s-1vcpu-1gb",
    "image": "ubuntu-22-04-x64"
  }' \
  "https://api.digitalocean.com/v2/droplets"
```

### 重启云服务器（Droplet）
```bash
curl -s -X POST -H "Authorization: Bearer $DO_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"reboot"}' \
  "https://api.digitalocean.com/v2/droplets/<DROPLET_ID>/actions"
```

### 添加域名
```bash
curl -s -X POST -H "Authorization: Bearer $DO_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "example.com"}' \
  "https://api.digitalocean.com/v2/domains"
```

## 注意事项

- 执行破坏性操作（如关机、销毁）前务必确认；
- Token 必须具备读写权限，方可执行管理操作；
- API 文档：https://docs.digitalocean.com/reference/api/api-reference/