# OpenClawCN Update Server

OpenClawCN 自动更新服务器 - 基于阿里云 OSS + Express.js

## 功能特性

✅ **增量更新**: 智能计算版本差异,仅下载变更文件
✅ **加密文件支持**: 自动处理 V8 bytecode (.jsc) 文件
✅ **依赖管理**: 自动同步 Skills/MCP 依赖
✅ **CDN 加速**: 通过阿里云 CDN 全球加速
✅ **签名验证**: 数字签名确保更新包完整性
✅ **断点续传**: 支持大文件断点续传
✅ **回滚机制**: 自动备份,支持一键回滚

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
vim .env
```

```bash
# .env
ALIYUN_ACCESS_KEY_ID=你的AccessKeyId
ALIYUN_ACCESS_KEY_SECRET=你的AccessKeySecret
ALIYUN_OSS_REGION=oss-cn-hangzhou
ALIYUN_OSS_BUCKET=openclawcn-updates

UPDATE_API_PORT=3000
UPDATE_API_HOST=0.0.0.0
NODE_ENV=production
```

### 3. 启动服务

#### 开发模式

```bash
pnpm dev
```

#### 生产模式

```bash
# 构建
pnpm build

# 使用 PM2 启动
pnpm pm2:start

# 查看日志
pnpm pm2:logs
```

## API 文档

### 1. 检查更新

```http
GET /api/check-update?version=2026.2.15&platform=win32
```

**响应示例**:

```json
{
  "hasUpdate": true,
  "current": "2026.2.15",
  "latest": "2026.2.20",
  "downloadSize": 15728640,
  "changelog": {
    "zh-CN": "修复了XX bug,新增了YY功能",
    "en-US": "Fixed XX bug, added YY feature"
  },
  "releaseDate": "2026-02-20T08:30:00Z",
  "critical": false
}
```

### 2. 计算增量

```http
POST /api/compute-delta
Content-Type: application/json

{
  "fromVersion": "2026.2.15",
  "toVersion": "2026.2.20"
}
```

**响应示例 (增量包)**:

```json
{
  "files": [
    {
      "path": "dist/gateway/server.js",
      "sha256": "abc123...",
      "size": 12345,
      "url": "https://openclawcn-updates.oss-cn-hangzhou.aliyuncs.com/..."
    }
  ],
  "removed": ["dist/old-file.js"],
  "totalSize": 15728640
}
```

**响应示例 (完整包)**:

```json
{
  "fullPackage": true,
  "url": "https://openclawcn-updates.oss-cn-hangzhou.aliyuncs.com/releases/2026.2.20/full-package.tar.gz"
}
```

### 3. 获取依赖清单

```http
GET /api/dependencies/2026.2.20
```

**响应示例**:

```json
{
  "npm": {
    "changed": ["@anthropic-ai/sdk@1.0.5"],
    "added": ["new-package@1.0.0"],
    "removed": ["old-package"]
  },
  "skills": {
    "updated": ["github", "jira"],
    "added": ["notion"]
  },
  "mcp": {
    "updated": ["filesystem"],
    "added": ["database"]
  }
}
```

### 4. Skills 镜像代理

```http
GET /registry/@openclawcn-skill/github/1.0.5
```

返回 tarball 文件流

### 5. 健康检查

```http
GET /health
```

**响应示例**:

```json
{
  "status": "ok",
  "timestamp": "2026-02-20T10:30:00Z"
}
```

## 部署指南

### 使用 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name updates.openclawcn.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name updates.openclawcn.com;

    ssl_certificate /etc/letsencrypt/live/updates.openclawcn.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/updates.openclawcn.com/privkey.pem;

    # API 请求代理到 Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态文件从 CDN 加载
    location /releases/ {
        proxy_pass https://openclawcn-updates.oss-cn-hangzhou.aliyuncs.com/releases/;
        proxy_cache_valid 200 7d;
    }

    # Skills 镜像
    location /registry/ {
        proxy_pass http://127.0.0.1:3000;
    }

    # 健康检查
    location /health {
        proxy_pass http://127.0.0.1:3000;
    }
}
```

### 使用 Docker 部署

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod

COPY . .

RUN pnpm build

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

```bash
# 构建镜像
docker build -t openclawcn-update-server .

# 运行容器
docker run -d \
  --name update-server \
  -p 3000:3000 \
  -e ALIYUN_ACCESS_KEY_ID=xxx \
  -e ALIYUN_ACCESS_KEY_SECRET=xxx \
  -e ALIYUN_OSS_BUCKET=openclawcn-updates \
  --restart unless-stopped \
  openclawcn-update-server
```

## 监控与日志

### 日志查看

```bash
# PM2 日志
pm2 logs update-api

# 系统日志 (systemd)
journalctl -u update-api -f
```

### 性能监控

```bash
# PM2 监控
pm2 monit

# 内存使用
pm2 show update-api
```

### 告警配置

推荐使用:
- **阿里云云监控**: 监控 OSS 流量、CDN 流量
- **Sentry**: 应用错误追踪
- **Prometheus + Grafana**: 自定义性能指标

## 故障排查

### 问题 1: OSS 连接失败

```bash
# 检查网络连通性
curl https://openclawcn-updates.oss-cn-hangzhou.aliyuncs.com

# 检查 AccessKey 权限
aliyun oss ls oss://openclawcn-updates/
```

### 问题 2: CDN 缓存未刷新

```bash
# 手动刷新 CDN 缓存
aliyun cdn RefreshObjectCaches \
  --objectPath https://updates.openclawcn.com/releases/latest.json
```

### 问题 3: 签名 URL 过期

签名 URL 默认 1 小时有效,如果客户端下载慢可以延长:

```typescript
// server.ts
const url = oss.signatureUrl(objectKey, { expires: 7200 });  // 2小时
```

## 安全建议

1. **HTTPS Only**: 强制使用 HTTPS,防止中间人攻击
2. **Access Key 轮换**: 定期更换 OSS Access Key
3. **速率限制**: 使用 express-rate-limit 防止滥用
4. **CORS 配置**: 限制允许的来源域名
5. **日志审计**: 记录所有更新请求,定期审查

## 成本优化

1. **OSS 生命周期**: 旧版本自动归档到低频存储
2. **CDN 缓存**: 延长缓存时间,减少回源
3. **压缩传输**: 启用 Brotli/Gzip 压缩
4. **按需下载**: 仅下载必要的增量文件

## 开发者贡献

欢迎提交 Pull Request!

```bash
# Fork 仓库
git clone https://github.com/your-username/openclawcn-update-server.git
cd openclawcn-update-server

# 创建分支
git checkout -b feature/your-feature

# 提交代码
git commit -m "Add your feature"
git push origin feature/your-feature

# 创建 Pull Request
```

## License

MIT License

## 相关链接

- [完整设计文档](../auto-update-system-design.md)
- [快速开始指南](../auto-update-quick-start.md)
- [阿里云 OSS 文档](https://help.aliyun.com/product/31815.html)
- [阿里云 CDN 文档](https://help.aliyun.com/product/27099.html)

---

**需要帮助?** support@openclawcn.com
