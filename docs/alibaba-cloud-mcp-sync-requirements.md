# MCP 市场索引同步服务 — 阿里云部署需求

## 概述

| 项目 | 说明 |
|------|------|
| **目的** | 每日聚合魔搭社区 + 官方 MCP Registry 的 MCP 服务器元数据，生成静态 JSON 索引文件 |
| **产出** | `mcp-index.json`（~3-5 MB），包含 3000+ MCP 服务器的元数据 |
| **使用方** | OpenClawCN PC 客户端 Gateway 启动时通过 HTTPS GET 拉取 |
| **频率** | 每日凌晨 3:00 运行一次 |
| **数据性质** | 公开元数据（名称、描述、版本、安装方式），不包含 MCP 服务器代码 |

## 1. 环境要求

### 服务器
- 阿里云 ECS（Linux，任意规格，1C1G 即可）
- 磁盘空间 ≥ 1 GB

### 运行时
- **Node.js** ≥ 20（用于运行同步脚本）
- **Python** ≥ 3.10 + **uv**（`pip install uv`，用于启动 `modelscope-mcp-server`）
- **Git**（用于拉取 OpenClawCN 代码仓库）

### 安装 uv (Python 包管理器)
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## 2. 部署步骤

### 2.1 拉取代码
```bash
mkdir -p /opt/openclawcn-mcp-sync
cd /opt/openclawcn-mcp-sync
git clone https://github.com/anthropics/openclawcn.git repo
cd repo
npm install   # 或 pnpm install
```

### 2.2 创建输出目录
```bash
mkdir -p /opt/openclawcn-mcp-sync/output
```

### 2.3 配置环境变量

在 ECS 上设置以下环境变量（建议写入 `/etc/environment` 或 cron 任务中）：

| 变量 | 必填 | 说明 |
|------|------|------|
| `MODELSCOPE_API_TOKEN` | 是 | 魔搭社区 API Token（https://modelscope.cn/my/myaccesstoken 获取） |
| `OUTPUT_DIR` | 是 | 输出目录的绝对路径，如 `/opt/openclawcn-mcp-sync/output` |

### 2.4 配置 cron 定时任务

```bash
crontab -e
```

添加：
```cron
# MCP 市场索引每日同步（凌晨 3:00）
0 3 * * * cd /opt/openclawcn-mcp-sync/repo && \
  MODELSCOPE_API_TOKEN=你的Token \
  OUTPUT_DIR=/opt/openclawcn-mcp-sync/output \
  node --import tsx scripts/mcp-full-sync.ts \
  >> /var/log/mcp-sync.log 2>&1
```

### 2.5 配置日志轮转

```bash
cat > /etc/logrotate.d/mcp-sync << 'EOF'
/var/log/mcp-sync.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
}
EOF
```

## 3. 对外服务要求

将 `/opt/openclawcn-mcp-sync/output/mcp-index.json` 文件通过 HTTPS 对外提供访问。

### 方案 A: 阿里云 OSS + CDN（推荐）
1. 创建 OSS Bucket
2. 配置 CDN 加速域名（如 `mcp-index.openclawcn.com`）
3. 在 cron 同步脚本末尾加一行，将文件上传到 OSS：
   ```bash
   ossutil cp /opt/openclawcn-mcp-sync/output/mcp-index.json oss://your-bucket/mcp-index.json
   ```

### 方案 B: Nginx 静态文件服务
```nginx
server {
    listen 443 ssl;
    server_name mcp-index.openclawcn.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /mcp-index.json {
        alias /opt/openclawcn-mcp-sync/output/mcp-index.json;
        default_type application/json;
        charset utf-8;
        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control "public, max-age=3600";
    }
}
```

### HTTP 响应头要求

| Header | 值 | 说明 |
|--------|---|------|
| `Content-Type` | `application/json; charset=utf-8` | JSON 格式 |
| `Access-Control-Allow-Origin` | `*` | 允许跨域（PC 客户端需要） |
| `Cache-Control` | `public, max-age=3600` | 1 小时缓存（日更数据，允许短暂不一致） |

## 4. 输出文件格式

### `mcp-index.json`（主文件）
```json
{
  "version": 2,
  "generatedAt": "2026-02-17T03:12:34.567Z",
  "itemCount": 3247,
  "sources": {
    "modelscope": 3012,
    "officialRegistry": 487
  },
  "items": [
    {
      "serverId": "filesystem",
      "friendlyName": "文件操作",
      "description": "读取、写入、搜索本地文件和目录",
      "category": "filesystem",
      "tags": ["file", "directory"],
      "version": "2025.1.2",
      "npmPackage": "@modelcontextprotocol/server-filesystem",
      "requiresApiKey": false,
      "platforms": ["windows", "macos", "linux"],
      "isOfficial": true,
      "source": "official-registry"
    }
  ]
}
```

### `sync-report.json`（运行报告）
```json
{
  "timestamp": "2026-02-17T03:12:34.567Z",
  "durationMs": 184230,
  "totalItems": 3247,
  "sources": {
    "modelscope": { "count": 3012, "ok": true },
    "officialRegistry": { "count": 487, "ok": true }
  }
}
```

## 5. 监控告警

| 检查项 | 告警条件 | 说明 |
|--------|---------|------|
| 文件新鲜度 | `mcp-index.json` mtime > 48h | 连续 2 天未更新，同步可能失败 |
| 文件大小 | < 100 KB | 文件异常小，数据可能不完整 |
| 同步日志 | 包含 `FATAL` 或 `ERROR` | 同步脚本报错 |
| HTTP 可用性 | GET 返回非 200 | CDN/Nginx 服务不可用 |

## 6. 安全注意事项

- `MODELSCOPE_API_TOKEN` 不要写入代码仓库或对外暴露
- 输出的 `mcp-index.json` 为公开数据，可安全对外提供
- HTTPS 证书定期续期
- 建议限制 ECS 安全组，只开放 443 端口

## 7. 首次验证

部署完成后，手动运行一次验证：

```bash
cd /opt/openclawcn-mcp-sync/repo
MODELSCOPE_API_TOKEN=你的Token \
  OUTPUT_DIR=/opt/openclawcn-mcp-sync/output \
  node --import tsx scripts/mcp-full-sync.ts --verbose
```

预期输出：
```
[...] === MCP Marketplace Full Sync ===
[...] Fetching from ModelScope + Official Registry...
[...] ModelScope: XXXX items
[...] Official Registry: XXX items
[...] Merged: XXXX total → XXXX unique after dedup
[...] Wrote /opt/openclawcn-mcp-sync/output/mcp-index.json (XXXX items)
[...] === Done in XXs. XXXX MCP servers indexed. ===
```

然后验证 HTTPS 访问：
```bash
curl -I https://mcp-index.openclawcn.com/mcp-index.json
# 应返回 200 OK, Content-Type: application/json
```

## 8. PC 客户端对接

部署完成后，需要在 PC 客户端的 `.env` 中配置：

```
OPENCLAWCN_MCP_INDEX_URL=https://mcp-index.openclawcn.com/mcp-index.json
```

Gateway 启动时会自动从该 URL 拉取最新索引（Tier 0，最高优先级），如果失败会降级到本地数据源。
