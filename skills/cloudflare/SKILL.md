---
name: cloudflare
name_zh: Cloudflare
description: Cloudflare 命令行工具——管理 DNS 记录、清理缓存及控制 Workers 路由。
description_zh: Cloudflare 命令行工具——管理 DNS 记录、清理缓存及控制 Workers 路由。
version: 1.0.0
author: dbhurley
homepage: https://cloudflare.com
metadata:
  clawdis:
    emoji: "🔶"
    requires:
      bins: ["python3", "uv"]
      env:
        - CLOUDFLARE_API_TOKEN
    primaryEnv: CLOUDFLARE_API_TOKEN
---
# Cloudflare 命令行工具

通过 API 管理 Cloudflare 的 DNS、缓存及 Workers。

## 🔑 必需密钥

| 变量 | 描述 | 获取方式 |
|----------|-------------|------------|
| `CLOUDFLARE_API_TOKEN` | 作用域限定的 API 令牌 | Cloudflare → 我的个人资料 → API 令牌 |

**推荐的令牌权限：**
- DNS:Read、DNS:Edit  
- Cache Purge:Purge  
- Workers Routes:Edit  

## ⚙️ 配置

在 `~/.clawdis/clawdis.json` 中配置：
```json
{
  "skills": {
    "cloudflare": {
      "env": {
        "CLOUDFLARE_API_TOKEN": "your-token"
      }
    }
  }
}
```

## 📋 命令

### 验证令牌

```bash
# Test that your token works
uv run {baseDir}/scripts/cloudflare.py verify
```

### 区域（域名）

```bash
# List all zones
uv run {baseDir}/scripts/cloudflare.py zones

# Get zone details
uv run {baseDir}/scripts/cloudflare.py zone <zone_id_or_domain>
```

### DNS 记录

```bash
# List DNS records for a zone
uv run {baseDir}/scripts/cloudflare.py dns list <domain>

# Add DNS record
uv run {baseDir}/scripts/cloudflare.py dns add <domain> --type A --name www --content 1.2.3.4
uv run {baseDir}/scripts/cloudflare.py dns add <domain> --type CNAME --name blog --content example.com

# Update DNS record
uv run {baseDir}/scripts/cloudflare.py dns update <domain> <record_id> --content 5.6.7.8

# Delete DNS record (asks for confirmation)
uv run {baseDir}/scripts/cloudflare.py dns delete <domain> <record_id>

# Delete without confirmation
uv run {baseDir}/scripts/cloudflare.py dns delete <domain> <record_id> --yes
```

### 缓存

```bash
# Purge everything
uv run {baseDir}/scripts/cloudflare.py cache purge <domain> --all

# Purge specific URLs
uv run {baseDir}/scripts/cloudflare.py cache purge <domain> --urls "https://example.com/page1,https://example.com/page2"

# Purge by prefix
uv run {baseDir}/scripts/cloudflare.py cache purge <domain> --prefix "/blog/"
```

### Workers 路由

```bash
# List routes
uv run {baseDir}/scripts/cloudflare.py routes list <domain>

# Add route
uv run {baseDir}/scripts/cloudflare.py routes add <domain> --pattern "*.example.com/*" --worker my-worker
```

## 📤 输出格式

所有命令均支持 `--json` 参数以输出机器可读格式：
```bash
uv run {baseDir}/scripts/cloudflare.py dns list example.com --json
```

## 🔗 常见工作流

### 将域名指向 Vercel
```bash
# Add CNAME for apex
cloudflare dns add example.com --type CNAME --name @ --content cname.vercel-dns.com --proxied false

# Add CNAME for www
cloudflare dns add example.com --type CNAME --name www --content cname.vercel-dns.com --proxied false
```

### 部署后清除缓存
```bash
cloudflare cache purge example.com --all
```

## 📦 安装

```bash
clawdhub install cloudflare
```