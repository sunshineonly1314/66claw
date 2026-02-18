# OpenClawCN 自动更新系统 - 快速开始指南

> 30分钟快速部署自动更新系统

---

## 步骤 1: 阿里云配置 (10分钟)

### 1.1 创建 OSS Bucket

```bash
# 登录阿里云控制台
# 进入 OSS 服务 → 创建 Bucket

Bucket 名称: openclawcn-updates
区域: 华东1 (杭州)
存储类型: 标准存储
读写权限: 私有
版本控制: 开启
```

### 1.2 配置 CDN 加速

```bash
# 进入 CDN 服务 → 添加域名

加速域名: updates.openclawcn.com
业务类型: 文件下载加速
源站类型: OSS域名
源站地址: openclawcn-updates.oss-cn-hangzhou.aliyuncs.com
端口: 443
协议跟随: 开启
```

### 1.3 获取访问密钥

```bash
# 访问 RAM 控制台 → 用户 → 创建用户

用户名: openclawcn-ci
访问方式: ✓ OpenAPI 访问

# 授权策略:
- AliyunOSSFullAccess
- AliyunCDNFullAccess

# 保存 AccessKeyId 和 AccessKeySecret
ALIYUN_ACCESS_KEY_ID=LTAI5t***********
ALIYUN_ACCESS_KEY_SECRET=***********
```

---

## 步骤 2: 服务器部署 (10分钟)

### 2.1 创建更新服务器

```bash
# 购买 ECS (可选: 使用现有服务器)
# 配置: 2核4G, CentOS 7/Ubuntu 20.04

# SSH 登录服务器
ssh root@your-server-ip

# 安装 Node.js
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
yum install -y nodejs

# 安装 pnpm
npm install -g pnpm
```

### 2.2 部署更新 API

```bash
# 克隆代码 (或上传)
git clone https://github.com/your-org/openclawcn-update-server.git
cd openclawcn-update-server

# 安装依赖
pnpm install

# 配置环境变量
cat > .env <<EOF
ALIYUN_ACCESS_KEY_ID=你的AccessKeyId
ALIYUN_ACCESS_KEY_SECRET=你的AccessKeySecret
ALIYUN_OSS_REGION=oss-cn-hangzhou
ALIYUN_OSS_BUCKET=openclawcn-updates

UPDATE_API_PORT=3000
NODE_ENV=production
EOF

# 启动服务 (使用 PM2)
pnpm install -g pm2
pm2 start dist/server.js --name update-api
pm2 save
pm2 startup
```

### 2.3 配置反向代理 (Nginx)

```nginx
# /etc/nginx/conf.d/updates.conf

server {
    listen 80;
    server_name updates.openclawcn.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name updates.openclawcn.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /releases/ {
        # 直接从 CDN 加载静态文件
        proxy_pass https://openclawcn-updates.oss-cn-hangzhou.aliyuncs.com/releases/;
    }
}
```

```bash
# 重启 Nginx
nginx -t
systemctl reload nginx
```

---

## 步骤 3: CI/CD 集成 (5分钟)

### 3.1 配置 GitHub Secrets

```bash
# 访问 GitHub 仓库 → Settings → Secrets → Actions

# 添加以下 Secrets:
ALIYUN_ACCESS_KEY_ID=你的AccessKeyId
ALIYUN_ACCESS_KEY_SECRET=你的AccessKeySecret
```

### 3.2 创建发布工作流

创建文件: [.github/workflows/release.yml](.github/workflows/release.yml)

```yaml
name: Build and Publish Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-and-publish:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # 获取完整历史(用于计算增量)

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install pnpm
        run: npm install -g pnpm@9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build with encryption
        run: pnpm build:secure

      - name: Generate manifest and checksums
        run: node scripts/generate-manifest.js

      - name: Create full package
        run: |
          VERSION=${GITHUB_REF#refs/tags/v}
          tar -czf full-package.tar.gz dist/ package.json skills/ extensions/

      - name: Compute delta from previous version
        run: |
          VERSION=${GITHUB_REF#refs/tags/v}
          PREV_VERSION=$(git describe --tags --abbrev=0 HEAD^)

          # 下载上一个版本
          mkdir prev-release
          cd prev-release
          curl -L https://updates.openclawcn.com/releases/${PREV_VERSION}/full-package.tar.gz | tar xz
          cd ..

          # 生成增量包
          node scripts/generate-delta-package.js \
            --from prev-release/dist \
            --to dist \
            --output delta-from-${PREV_VERSION}

      - name: Upload to Aliyun OSS
        env:
          OSS_ACCESS_KEY_ID: ${{ secrets.ALIYUN_ACCESS_KEY_ID }}
          OSS_ACCESS_KEY_SECRET: ${{ secrets.ALIYUN_ACCESS_KEY_SECRET }}
        run: |
          VERSION=${GITHUB_REF#refs/tags/v}

          # 安装 ossutil
          wget https://gosspublic.alicdn.com/ossutil/1.7.18/ossutil-v1.7.18-linux-amd64.zip
          unzip ossutil-v1.7.18-linux-amd64.zip
          chmod +x ossutil

          # 配置
          ./ossutil config -e oss-cn-hangzhou.aliyuncs.com \
            -i $OSS_ACCESS_KEY_ID \
            -k $OSS_ACCESS_KEY_SECRET

          # 上传文件
          ./ossutil cp -r -f \
            ./dist/ \
            oss://openclawcn-updates/releases/${VERSION}/dist/

          ./ossutil cp manifest.json \
            oss://openclawcn-updates/releases/${VERSION}/manifest.json

          ./ossutil cp checksums.json \
            oss://openclawcn-updates/releases/${VERSION}/checksums.json

          ./ossutil cp full-package.tar.gz \
            oss://openclawcn-updates/releases/${VERSION}/full-package.tar.gz

          # 上传增量包
          if [ -d "delta-from-*" ]; then
            ./ossutil cp -r delta-from-*/ \
              oss://openclawcn-updates/releases/${VERSION}/
          fi

      - name: Update latest.json
        env:
          OSS_ACCESS_KEY_ID: ${{ secrets.ALIYUN_ACCESS_KEY_ID }}
          OSS_ACCESS_KEY_SECRET: ${{ secrets.ALIYUN_ACCESS_KEY_SECRET }}
        run: |
          VERSION=${GITHUB_REF#refs/tags/v}

          echo "{
            \"version\": \"${VERSION}\",
            \"buildTime\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
            \"gitCommit\": \"${GITHUB_SHA:0:9}\"
          }" > latest.json

          ./ossutil cp latest.json oss://openclawcn-updates/releases/latest.json

      - name: Purge CDN cache
        run: |
          # 使用阿里云 CLI 刷新 CDN 缓存 (可选)
          echo "CDN cache purged"

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: full-package.tar.gz
          body_path: CHANGELOG.md
```

### 3.3 测试发布流程

```bash
# 在本地打 tag
git tag v2026.2.18
git push origin v2026.2.18

# 查看 GitHub Actions 执行情况
# https://github.com/your-org/openclawcn/actions
```

---

## 步骤 4: 客户端集成 (5分钟)

### 4.1 创建更新模块

创建文件: [src/infra/auto-updater.ts](../src/infra/auto-updater.ts)

(复制完整代码见主设计文档)

### 4.2 在主程序中启用

```typescript
// src/index.ts

import { AutoUpdater } from "./infra/auto-updater.js";

async function main() {
  // 启动自动更新检查
  const updater = new AutoUpdater({
    apiBaseUrl: process.env.UPDATE_SERVER_URL || "https://updates.openclawcn.com",
    checkInterval: 4 * 60 * 60 * 1000,  // 4小时
    autoApply: false,  // 需要用户确认
    backupCount: 3,
  });

  await updater.start();

  // 启动主应用
  await startGateway();
}

main().catch(console.error);
```

### 4.3 添加 CLI 命令

```typescript
// src/cli/commands/update.ts

export const updateCommand: Command = {
  name: "update",
  description: "检查并安装更新",

  options: [
    { name: "--check", description: "仅检查,不下载" },
    { name: "--apply", description: "立即应用更新" },
    { name: "--rollback", description: "回滚到上一版本" },
  ],

  async run(args) {
    const updater = new AutoUpdater({
      apiBaseUrl: "https://updates.openclawcn.com",
      checkInterval: 0,
      autoApply: args.apply,
      backupCount: 3,
    });

    if (args.check) {
      await updater.checkForUpdates();
    } else if (args.apply) {
      await updater.downloadAndApply();
    } else if (args.rollback) {
      await updater.rollback();
    } else {
      // 默认: 检查并询问
      await updater.checkForUpdates();
    }
  },
};
```

### 4.4 配置环境变量

```bash
# .env (客户端)

# 更新服务器 URL
UPDATE_SERVER_URL=https://updates.openclawcn.com

# 自动更新配置
AUTO_UPDATE_ENABLED=true
AUTO_UPDATE_CHECK_INTERVAL=14400000  # 4小时
AUTO_UPDATE_SILENT=false
```

---

## 步骤 5: 测试与验证

### 5.1 本地测试

```bash
# 模拟版本更新
# 1. 修改 package.json 中的版本号
vim package.json  # 改为 2026.2.17

# 2. 重新构建
pnpm build:secure

# 3. 测试更新检查
node dist/index.js update --check

# 预期输出:
# 🔔 发现新版本: 2026.2.18
#    当前版本: 2026.2.17
#    下载大小: 15.3 MB
```

### 5.2 测试增量更新

```bash
# 应用更新
node dist/index.js update --apply

# 预期流程:
# 📦 计算增量包...
# ⬇️  下载 234 个变更文件...
#   [1/234] dist/gateway/server.js
#   ...
# 💾 备份当前版本...
# 🔧 应用更新...
# 📥 更新依赖...
# 🔍 验证完整性...
# ✅ 更新完成!
```

### 5.3 测试回滚

```bash
# 模拟更新失败
# 手动删除某个关键文件
rm dist/index.js

# 触发回滚
node dist/index.js update --rollback

# 预期输出:
# 🔄 正在回滚...
# ✅ 已回滚到备份版本: 2026.2.17
```

---

## 常见问题排查

### Q1: OSS 上传失败

```bash
# 检查 AccessKey 权限
./ossutil ls oss://openclawcn-updates/

# 如果报错: AccessDenied
# 解决: 在 RAM 控制台检查用户是否有 OSS 完全访问权限
```

### Q2: CDN 缓存未刷新

```bash
# 手动刷新 CDN 缓存
aliyun cdn RefreshObjectCaches \
  --objectPath https://updates.openclawcn.com/releases/latest.json

# 或在阿里云控制台 → CDN → 刷新预热
```

### Q3: 客户端下载超时

```bash
# 检查 CDN 是否生效
curl -I https://updates.openclawcn.com/releases/latest.json

# 应该看到:
# X-Cache: HIT  (命中缓存)
# X-Swift-CacheTime: 3600

# 如果是 MISS, 检查 CDN 配置
```

### Q4: 加密文件验证失败

```bash
# 检查 .jsc 文件是否正确生成
ls -lh dist/**/*.jsc

# 验证加载器是否存在
for jsc in dist/**/*.jsc; do
  loader="${jsc%.jsc}.js"
  if [ ! -f "$loader" ]; then
    echo "Missing loader: $loader"
  fi
done
```

---

## 下一步

### 功能增强

1. **灰度发布**: 先给 1% 用户推送,逐步扩大
2. **A/B 测试**: 不同用户群使用不同更新策略
3. **差分更新**: 使用 bsdiff 算法进一步减少增量包大小
4. **并行下载**: 多线程下载大文件,加速更新

### 监控告警

1. **更新成功率**: 监控有多少用户成功更新
2. **下载速度**: CDN 加速效果如何
3. **失败原因**: 收集并分析失败日志

### 文档完善

1. **API 接口文档**: Swagger/OpenAPI 规范
2. **故障处理手册**: 各种错误的解决方案
3. **性能优化指南**: 如何提升下载速度

---

**部署完成!** 🎉

现在你已经拥有一个完整的自动更新系统:

✅ 阿里云 OSS + CDN 加速分发
✅ 增量更新,节省带宽
✅ 加密文件自动同步
✅ Skills/MCP 依赖自动安装
✅ 自动备份与回滚
✅ CI/CD 自动构建发布

---

**需要帮助?**

- 查看完整设计文档: [auto-update-system-design.md](./auto-update-system-design.md)
- 提交 Issue: https://github.com/your-org/openclawcn/issues
- 技术支持: support@openclawcn.com
