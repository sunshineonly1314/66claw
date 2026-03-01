---
name: cloudflare-api
name_zh: Cloudflare API
description: 连接 Cloudflare API，用于 DNS 管理、隧道配置及区域管理。当用户需要管理域名、DNS 记录或创建隧道时使用。
description_zh: 连接 Cloudflare API，用于 DNS 管理、隧道配置及区域管理。当用户需要管理域名、DNS 记录或创建隧道时使用。
read_when:
  - 用户询问有关 Cloudflare DNS 或域名的问题
  - 用户希望创建或管理 DNS 记录
  - 用户需要设置 Cloudflare 隧道
  - 用户希望列出其 Cloudflare 区域
metadata:
  clawdbot:
    emoji: "☁️"
    requires:
      bins: ["curl", "jq"]
---
# Cloudflare 技能

连接 [Cloudflare](https://cloudflare.com) API，实现 DNS 管理、隧道配置及区域管理。

## 配置

### 1. 获取您的 API 令牌
1. 访问 [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)  
2. 创建具备以下必要权限的令牌：
   - **Zone:Read** — 列出域名  
   - **DNS:Edit** — 管理 DNS 记录  
   - **Account:Cloudflare Tunnel:Edit** — 管理隧道  
3. 复制该令牌  

### 2. 配置
```bash
# Option A: Store in file (recommended)
echo "YOUR_API_TOKEN" > ~/.cloudflare_token
chmod 600 ~/.cloudflare_token

# Option B: Environment variable
export CLOUDFLARE_API_TOKEN="YOUR_API_TOKEN"
```

### 3. 测试连接
```bash
./scripts/setup.sh
```

---

## 命令

### 区域（域名）

```bash
./scripts/zones/list.sh                    # List all zones
./scripts/zones/list.sh --json             # JSON output
./scripts/zones/get.sh example.com         # Get zone details
```

### DNS 记录

```bash
# List records
./scripts/dns/list.sh example.com
./scripts/dns/list.sh example.com --type A
./scripts/dns/list.sh example.com --name api

# Create record
./scripts/dns/create.sh example.com \
  --type A \
  --name api \
  --content 1.2.3.4 \
  --proxied

# Create CNAME
./scripts/dns/create.sh example.com \
  --type CNAME \
  --name www \
  --content example.com \
  --proxied

# Update record
./scripts/dns/update.sh example.com \
  --name api \
  --type A \
  --content 5.6.7.8

# Delete record
./scripts/dns/delete.sh example.com --name api --type A
```

### 隧道

```bash
# List tunnels
./scripts/tunnels/list.sh

# Create tunnel
./scripts/tunnels/create.sh my-tunnel

# Configure tunnel ingress
./scripts/tunnels/configure.sh my-tunnel \
  --hostname app.example.com \
  --service http://localhost:3000

# Get run token
./scripts/tunnels/token.sh my-tunnel

# Delete tunnel
./scripts/tunnels/delete.sh my-tunnel
```

---

## 令牌权限

| 功能 | 所需权限 |
|---------|-------------------|
| 列出区域 | Zone:Read |
| 管理 DNS | DNS:Edit |
| 管理隧道 | Account:Cloudflare Tunnel:Edit |

在以下地址创建令牌：[dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)

---

## 常见工作流

### 将子域名指向服务器
```bash
./scripts/dns/create.sh mysite.com --type A --name api --content 1.2.3.4 --proxied
```

### 为本地服务配置隧道
```bash
# 1. Create tunnel
./scripts/tunnels/create.sh webhook-tunnel

# 2. Configure ingress
./scripts/tunnels/configure.sh webhook-tunnel \
  --hostname hook.mysite.com \
  --service http://localhost:8080

# 3. Add DNS record
TUNNEL_ID=$(./scripts/tunnels/list.sh --name webhook-tunnel --quiet)
./scripts/dns/create.sh mysite.com \
  --type CNAME \
  --name hook \
  --content ${TUNNEL_ID}.cfargotunnel.com \
  --proxied

# 4. Run tunnel
TOKEN=$(./scripts/tunnels/token.sh webhook-tunnel)
cloudflared tunnel run --token $TOKEN
```

---

## 输出格式

| 标志 | 描述 |
|------|-------------|
| `--json` | 返回 API 的原始 JSON |
| `--table` | 格式化表格（默认） |
| `--quiet` | 极简输出（仅 ID） |

---

## 故障排查

| 错误 | 解决方案 |
|-------|----------|
| “未找到 API 令牌” | 运行配置命令，或设置 CLOUDFLARE_API_TOKEN 环境变量 |
| “401 未授权” | 检查令牌是否有效 |
| “403 禁止访问” | 令牌缺少必需权限 |
| “未找到区域” | 确认该域名确属您的账户 |