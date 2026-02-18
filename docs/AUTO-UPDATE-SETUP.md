# OpenClawCN 自动更新系统 - 快速部署指南

> 🎯 零成本方案 - 使用现有服务器 + Nginx + GitHub Actions

---

## 📋 前置要求

- ✅ 一台阿里云服务器 (已有)
- ✅ 已安装 Nginx
- ✅ 已配置域名 (如 `updates.openclawcn.com`)
- ✅ GitHub 仓库有 Actions 权限

---

## 🚀 30分钟完整部署

### 步骤 1: 服务器配置 (5分钟)

```bash
# 1. SSH 登录服务器
ssh root@your-server-ip

# 2. 创建更新文件目录
mkdir -p /var/www/openclawcn-updates/releases
mkdir -p /var/www/openclawcn-updates/skills-mirror
chown -R www-data:www-data /var/www/openclawcn-updates
chmod -R 755 /var/www/openclawcn-updates

# 3. 配置 Nginx
cat > /etc/nginx/sites-available/updates.openclawcn.com <<'EOF'
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

    root /var/www/openclawcn-updates;
    client_max_body_size 500M;

    gzip on;
    gzip_types text/plain application/json application/javascript;

    location /releases/ {
        add_header Access-Control-Allow-Origin *;
        expires 7d;
        autoindex on;
    }

    location = /releases/latest.json {
        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control "no-cache";
        expires 0;
    }

    location /health {
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }
}
EOF

# 4. 启用配置
ln -s /etc/nginx/sites-available/updates.openclawcn.com /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# 5. 申请 SSL 证书 (Let's Encrypt 免费)
apt install certbot python3-certbot-nginx -y
certbot --nginx -d updates.openclawcn.com
```

### 步骤 2: 配置 GitHub Secrets (3分钟)

进入你的 GitHub 仓库:
1. Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. 添加以下 Secrets:

```
Name: UPDATE_SERVER_HOST
Value: updates.openclawcn.com

Name: SERVER_USER
Value: root

Name: SERVER_SSH_KEY
Value: (粘贴你的 SSH 私钥内容)
```

**获取 SSH 私钥**:
```bash
# 在你的本地机器或服务器上
cat ~/.ssh/id_rsa

# 如果没有,先生成:
ssh-keygen -t rsa -b 4096 -C "github-actions"

# 将公钥添加到服务器:
ssh-copy-id root@your-server-ip
```

### 步骤 3: 启用 GitHub Actions (2分钟)

1. 工作流文件已创建: `.github/workflows/release-with-auto-update.yml`
2. 确保仓库启用了 Actions:
   - 进入仓库 Settings → Actions → General
   - 选择 "Allow all actions and reusable workflows"
   - 保存

### 步骤 4: 测试首次发布 (5分钟)

```bash
# 1. 确保代码已提交
git add .
git commit -m "feat: 启用自动更新系统"
git push

# 2. 打版本 tag
git tag v2026.2.18
git push origin v2026.2.18

# 3. 查看 GitHub Actions 执行
# 访问: https://github.com/your-org/openclawcn/actions
# 等待约 5-10 分钟
```

### 步骤 5: 验证部署 (2分钟)

```bash
# 1. 检查 latest.json
curl https://updates.openclawcn.com/releases/latest.json

# 预期输出:
# {
#   "version": "2026.2.18",
#   "buildTime": "2026-02-18T10:00:00Z",
#   "gitCommit": "abc123",
#   "downloadUrl": "https://updates.openclawcn.com/releases/2026.2.18/full-package.tar.gz"
# }

# 2. 检查 manifest.json
curl https://updates.openclawcn.com/releases/2026.2.18/manifest.json

# 3. 检查文件是否存在
curl -I https://updates.openclawcn.com/releases/2026.2.18/full-package.tar.gz
```

---

## 🔄 日常使用

### 发布新版本

```bash
# 1. 修改代码
vim src/some-file.ts

# 2. 提交代码
git add .
git commit -m "fix: 修复某个bug"

# 3. 更新版本号 (可选,如果用 tag 版本号)
vim package.json  # "version": "2026.2.19"

# 4. 打 tag 并推送
git tag v2026.2.19
git push origin v2026.2.19

# 5. 等待自动部署
# GitHub Actions 会自动:
# ✅ 构建加密包
# ✅ 生成增量包
# ✅ 部署到服务器
# ✅ 创建 GitHub Release
```

### 客户端检查更新

```bash
# 用户执行
openclawcn update --check

# 输出:
# 🔍 检查更新...
# 🔔 发现新版本: 2026.2.19
#    当前版本: 2026.2.18
#    下载大小: 3.2 MB (增量)
#    更新内容: 修复某个bug
#
# 运行 'openclawcn update --apply' 安装更新
```

### 应用更新

```bash
openclawcn update --apply

# 流程:
# ⬇️ 下载增量包: 45 个文件
# 💾 备份当前版本...
# 🔧 应用更新...
# 🔍 验证完整性...
# ✅ 更新完成!将在重启后生效
```

---

## 📊 工作流程图

```
开发者 push tag
      ↓
GitHub Actions 触发
      ↓
┌─────────────────────────────┐
│ Job 1: 构建加密包            │
│  - pnpm build:secure        │
│  - 生成 manifest/checksums  │
│  - 打包 full-package.tar.gz │
└─────────────────────────────┘
      ↓
┌─────────────────────────────┐
│ Job 2: 生成增量包            │
│  - 下载上一个版本            │
│  - 对比差异                  │
│  - 生成 delta/              │
└─────────────────────────────┘
      ↓
┌─────────────────────────────┐
│ Job 3: 部署到服务器          │
│  - 准备部署文件              │
│  - SSH + rsync 上传          │
│  - 更新 latest.json         │
└─────────────────────────────┘
      ↓
┌─────────────────────────────┐
│ Job 4: 创建 GitHub Release  │
│  - 附加 full-package.tar.gz │
│  - 生成 Release Notes       │
└─────────────────────────────┘
      ↓
用户客户端自动检测到更新
```

---

## 🛠️ 故障排查

### 问题 1: GitHub Actions 部署失败

**检查 SSH 连接**:
```bash
# 在本地测试 SSH
ssh root@your-server-ip

# 如果失败,检查:
# 1. SERVER_SSH_KEY 是否正确
# 2. 公钥是否在服务器 ~/.ssh/authorized_keys
# 3. 服务器防火墙是否开放 22 端口
```

### 问题 2: 增量包生成失败

**原因**: 找不到上一个版本

**解决**:
```bash
# 手动上传上一个版本到服务器
scp full-package.tar.gz root@server:/var/www/openclawcn-updates/releases/2026.2.18/

# 或者第一次发布时跳过增量包(会下载完整包)
```

### 问题 3: 客户端无法下载

**检查 CORS**:
```bash
# 确保 Nginx 配置了 CORS
curl -I https://updates.openclawcn.com/releases/latest.json

# 应该看到:
# Access-Control-Allow-Origin: *
```

### 问题 4: SSL 证书过期

**自动续期**:
```bash
# 测试续期
certbot renew --dry-run

# 设置自动续期 (crontab)
0 0 1 * * certbot renew --quiet
```

---

## 📈 监控与维护

### 查看下载统计

```bash
# SSH 登录服务器
ssh root@your-server-ip

# 统计每个版本的下载次数
awk '/full-package.tar.gz/ {print $7}' /var/log/nginx/access.log | sort | uniq -c

# 统计总下载流量
awk '{sum+=$10} END {print "Total: " sum/1024/1024/1024 " GB"}' /var/log/nginx/access.log
```

### 清理旧版本

```bash
# 保留最近 5 个版本
cd /var/www/openclawcn-updates/releases/
ls -t | tail -n +6 | xargs rm -rf

# 或者创建定时任务 (每月清理)
cat > /etc/cron.monthly/cleanup-old-releases <<'EOF'
#!/bin/bash
cd /var/www/openclawcn-updates/releases/
ls -t | tail -n +6 | xargs rm -rf
EOF
chmod +x /etc/cron.monthly/cleanup-old-releases
```

### 磁盘空间监控

```bash
# 检查更新目录大小
du -sh /var/www/openclawcn-updates/

# 设置告警 (当使用超过 10GB 时发邮件)
# 添加到 crontab:
0 0 * * * [ $(du -s /var/www/openclawcn-updates | cut -f1) -gt 10485760 ] && echo "Updates directory > 10GB" | mail -s "Disk Alert" admin@example.com
```

---

## 🎯 高级功能

### 灰度发布

创建多个 latest 文件:

```bash
# latest-stable.json (所有用户)
# latest-beta.json (10% 用户)
# latest-canary.json (内部测试)

# 客户端根据配置选择:
UPDATE_CHANNEL=beta openclawcn update --check
```

### 回滚到旧版本

```bash
# SSH 登录服务器
ssh root@your-server-ip

# 修改 latest.json 指向旧版本
cat > /var/www/openclawcn-updates/releases/latest.json <<EOF
{
  "version": "2026.2.18",
  "buildTime": "2026-02-18T10:00:00Z",
  "gitCommit": "old-commit",
  "downloadUrl": "https://updates.openclawcn.com/releases/2026.2.18/full-package.tar.gz"
}
EOF

# 客户端会在下次检查时自动"降级"到 2026.2.18
```

### 镜像服务器

如果带宽不够,可以部署多个镜像:

```bash
# 客户端随机选择镜像
const mirrors = [
  "https://updates.openclawcn.com",
  "https://updates-cn.openclawcn.com",
  "https://updates-hk.openclawcn.com",
];
```

---

## 💰 成本对比

| 方案 | 月成本 | 优点 | 缺点 |
|------|--------|------|------|
| **阿里云 OSS + CDN** | ¥1332 | 全球加速、高可用 | 成本高 |
| **Nginx 文件服务器** | ¥0 | 零成本、完全可控 | 带宽有限 |

**推荐**: 先用 Nginx 方案,用户量大了再迁移到 OSS + CDN

---

## ✅ 检查清单

部署前确认:

- [ ] 服务器 Nginx 配置正确
- [ ] SSL 证书已申请
- [ ] GitHub Secrets 已配置
- [ ] SSH 密钥可以连接服务器
- [ ] 服务器目录权限正确
- [ ] 防火墙开放 80/443 端口
- [ ] 域名 DNS 解析正确

部署后确认:

- [ ] `latest.json` 可访问
- [ ] `manifest.json` 可访问
- [ ] `full-package.tar.gz` 可下载
- [ ] GitHub Release 已创建
- [ ] 客户端可检查更新
- [ ] 增量更新正常工作

---

## 📚 相关文档

- [完整设计文档](./auto-update-system-design.md)
- [详细实现指南](./auto-update-nginx-simple.md)
- [客户端集成代码](../src/infra/auto-updater-simple.ts)

---

## 🆘 需要帮助?

- 查看 [故障排查](#故障排查) 章节
- 提交 Issue: https://github.com/your-org/openclawcn/issues
- 技术支持: support@openclawcn.com

---

**恭喜!你的自动更新系统已就绪!** 🎉

现在每次打 tag,就会自动:
1. ✅ 构建加密包
2. ✅ 生成增量更新
3. ✅ 部署到服务器
4. ✅ 创建 GitHub Release

用户会自动收到更新提示,一键升级! 🚀
