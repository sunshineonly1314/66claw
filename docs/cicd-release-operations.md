# OpenClawCN CI/CD & 发版运维手册

> 本文档整合了 CI/CD 全链路、自动更新系统、阿里云服务器部署、增量更新方案的完整说明。
> 适用于版本: 2026.2.x
> 最后更新: 2026-02-19

---

## 目录

1. [架构总览](#1-架构总览)
2. [阿里云服务器配置](#2-阿里云服务器配置)
3. [Nginx 配置](#3-nginx-配置)
4. [本地构建管线](#4-本地构建管线)
5. [一键发版流程](#5-一键发版流程)
6. [增量更新系统](#6-增量更新系统)
7. [客户端更新管线](#7-客户端更新管线)
8. [CHANGELOG 自动生成](#8-changelog-自动生成)
9. [Docker 部署](#9-docker-部署)
10. [安全与加密](#10-安全与加密)
11. [故障排查](#11-故障排查)
12. [附录: 文件清单](#12-附录-文件清单)
13. [Gitee Webhook + FRP 内网穿透本地构建管线](#13-gitee-webhook--frp-内网穿透本地构建管线)

---

## 1. 架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        开发者本机 (Windows/macOS)                    │
│                                                                     │
│  versionrecord.md ← agent 每日追加技术日志                           │
│         │                                                           │
│         ▼                                                           │
│  pnpm build:secure                                                  │
│  ├─ tsdown 编译 TypeScript                                          │
│  ├─ build:cn-compile → CN 加密编译                                   │
│  ├─ build:cn-extensions → 扩展编译                                   │
│  ├─ obfuscate-dist.ts → JavaScript 混淆                             │
│  ├─ compile-bytecode.ts → ByteNode .jsc 字节码加密                   │
│  ├─ integrity:gen → SHA256 完整性哈希                                │
│  └─ release:changelog → CHANGELOG.md 自动生成                       │
│         │                                                           │
│         ▼                                                           │
│  pnpm release:deploy --version X.Y.Z --server root@IP              │
│  pnpm release:deploy --version X.Y.Z --oss                        │
│  ├─ 生成 manifest.json + checksums.json                             │
│  ├─ 生成增量包 delta-from-{旧版本}.tar.gz                            │
│  ├─ 打包 full.tar.gz                                                │
│  ├─ 生成 latest.json (含 changelog + 下载 URL)                      │
│  ├─ 上传: SCP 到 ECS 或 ali-oss 到 OSS                              │
│  └─ 缓存当前 dist/ 到 .release-cache/                               │
└──────────────────┬──────────────────────┬─────────────────────────┘
                   │ SSH/SCP              │ ali-oss SDK
                   ▼                      ▼
┌──────────────────────────────┐  ┌────────────────────────────────┐
│   阿里云 ECS 服务器 (Nginx)   │  │     阿里云 OSS (推荐)          │
│                              │  │                                │
│  /var/www/updates/releases/  │  │  {bucket}/{prefix}/            │
│  ├─ latest.json              │  │  ├─ latest.json                │
│  ├─ 2026.2.20/               │  │  ├─ 2026.2.20/                │
│  │   ├─ full.tar.gz          │  │  │   ├─ full.tar.gz            │
│  │   ├─ delta-from-*.tar.gz  │  │  │   ├─ delta-from-*.tar.gz   │
│  │   ├─ manifest.json        │  │  │   ├─ manifest.json          │
│  │   └─ checksums.json       │  │  │   └─ checksums.json         │
│  └─ ...                      │  │  └─ ...                        │
└──────────────┬───────────────┘  └───────────────┬────────────────┘
               │ HTTPS                             │ HTTPS
               └───────────────┬───────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     用户客户端 (Windows/macOS)                       │
│                                                                     │
│  启动时自动检查更新 (24小时间隔)                                      │
│  ├─ 拉取 latest.json                                                │
│  ├─ 比较版本号                                                       │
│  ├─ 展示更新内容 (changelog)                                         │
│  ├─ 下载 delta 或 full 包                                           │
│  ├─ SHA256 校验                                                      │
│  ├─ 备份 → 应用 → 验证 → 安装依赖                                    │
│  └─ 重启                                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 阿里云服务器配置

### 2.1 服务器规格

| 项目 | 配置 |
|------|------|
| 云服务商 | 阿里云 ECS |
| 地域 | 华东1 (杭州) / 华东2 (上海) |
| 规格 | 2 vCPU / 4 GB RAM (最低) |
| 系统盘 | 40 GB SSD |
| 数据盘 | 100 GB SSD (挂载到 /var/www) |
| 操作系统 | Ubuntu 22.04 LTS |
| 带宽 | 5 Mbps 固定带宽 或 按流量计费 |
| 安全组 | 开放 80, 443, 22 端口 |

### 2.2 服务器初始化

```bash
# === 以 root 登录 ===

# 1. 系统更新
apt update && apt upgrade -y

# 2. 安装基础工具
apt install -y nginx certbot python3-certbot-nginx curl tar gzip

# 3. 创建更新目录
mkdir -p /var/www/updates/releases
chown -R www-data:www-data /var/www/updates

# 4. 配置 SSH 密钥登录 (用于 SCP 上传)
mkdir -p ~/.ssh
# 将 CI/CD 用的公钥添加到 authorized_keys
echo "ssh-rsa AAAA... deploy@openclawcn" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 5. (可选) 创建专用部署用户
adduser --disabled-password deploy
usermod -aG www-data deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
```

### 2.3 域名与 DNS

| 项目 | 值 |
|------|-----|
| 域名 | `updates.openclawcn.com` (示例) |
| DNS 记录 | A 记录 → 阿里云 ECS 公网 IP |
| SSL 证书 | Let's Encrypt (certbot 自动续期) |

```bash
# 申请 SSL 证书
certbot --nginx -d updates.openclawcn.com
# 自动续期 (crontab)
echo "0 0 * * * certbot renew --quiet" | crontab -
```

### 2.4 连接信息模板

> **注意**: 以下为模板，实际值请填写到 GitHub Secrets 中，不要提交到代码库。

```
服务器 IP:       <ECS_PUBLIC_IP>
SSH 端口:        22
登录用户:        root (或 deploy)
SSH 密钥:        存放在 GitHub Secrets → UPDATE_SERVER_SSH_KEY
域名:            updates.openclawcn.com
Nginx root:      /var/www/updates
发布路径:        /var/www/updates/releases/
```

### 2.5 阿里云安全组规则

| 方向 | 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|------|
| 入方向 | TCP | 22 | 本机 IP | SSH 部署 (SCP 上传) |
| 入方向 | TCP | 80 | 0.0.0.0/0 | HTTP (重定向到 HTTPS) |
| 入方向 | TCP | 443 | 0.0.0.0/0 | HTTPS 更新服务 |
| 出方向 | 全部 | 全部 | 0.0.0.0/0 | 默认放行 |

---

## 3. Nginx 配置

### 3.1 完整配置文件

```nginx
# /etc/nginx/sites-available/updates.openclawcn.com

# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name updates.openclawcn.com;
    return 301 https://$host$request_uri;
}

# HTTPS 主配置
server {
    listen 443 ssl http2;
    server_name updates.openclawcn.com;

    # === SSL ===
    ssl_certificate /etc/letsencrypt/live/updates.openclawcn.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/updates.openclawcn.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # === 静态文件根目录 ===
    root /var/www/updates;
    client_max_body_size 500M;

    # === Gzip 压缩 ===
    gzip on;
    gzip_types application/json application/javascript text/plain text/markdown;
    gzip_min_length 1024;

    # === latest.json: 禁止缓存 (客户端每次都拉最新) ===
    location = /releases/latest.json {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Access-Control-Allow-Origin "*";
        try_files $uri =404;
    }

    # === 版本包文件: 长期缓存 ===
    location /releases/ {
        add_header Cache-Control "public, max-age=604800";  # 7 天
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS";
        try_files $uri =404;
    }

    # === 健康检查 ===
    location = /health {
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }

    # === 默认 ===
    location / {
        return 404;
    }
}
```

### 3.2 启用配置

```bash
ln -s /etc/nginx/sites-available/updates.openclawcn.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 3.3 验证

```bash
curl -s https://updates.openclawcn.com/health
# 预期: OK

curl -s https://updates.openclawcn.com/releases/latest.json | jq .version
# 预期: "2026.2.20" (最新版本号)
```

---

## 4. 本地构建管线

### 4.1 `pnpm build` — 标准构建

```
pnpm build
├─ canvas:a2ui:bundle        → 打包 a2ui 画布组件
├─ tsdown                    → TypeScript → JavaScript (dist/)
├─ build:plugin-sdk:dts      → 插件 SDK 类型声明
├─ write-plugin-sdk-entry-dts → 入口类型文件
├─ canvas-a2ui-copy          → 复制画布文件到 dist/
├─ copy-hook-metadata        → 复制 hook 元数据
├─ write-build-info          → 写入构建信息 (版本/时间/commit)
└─ write-cli-compat          → CLI 兼容性入口
```

**输出**: `dist/` 目录，包含所有编译后的 JavaScript 文件。

### 4.2 `pnpm build:secure` — 生产加密构建

```
pnpm build:secure
├─ pnpm build                → 基础构建 (同上)
├─ build:cn-compile          → CN 加密编译 (tsconfig.cn-encrypt.json)
├─ build:cn-extensions       → CN 扩展编译
├─ obfuscate-dist.ts         → JavaScript 混淆 (javascript-obfuscator)
├─ compile-bytecode.ts       → ByteNode 字节码加密 → .jsc 文件
├─ integrity:gen             → SHA256 完整性哈希 → dist/security/integrity-hashes.json
└─ release:changelog         → versionrecord.md → CHANGELOG.md
```

**输出**:
- `dist/` — 加密后的生产文件 (含 .jsc 字节码)
- `dist/security/integrity-hashes.json` — 文件完整性校验
- `CHANGELOG.md` — 用户可读的更新日志

### 4.3 `pnpm release:deploy` — 一键发版

```bash
# === SCP 模式: 上传到自有 ECS 服务器 ===
pnpm release:deploy -v 2026.2.20 -s root@<IP> -d updates.openclawcn.com

# === OSS 模式 (推荐): 上传到阿里云 OSS ===
# 需设置环境变量: OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET
pnpm release:deploy -v 2026.2.20 --oss
pnpm release:deploy -v 2026.2.20 --oss --oss-domain dl.openclawcn.com

# 只生成不上传 (调试用)
pnpm release:deploy -v 2026.2.20 --output-only

# 指定增量基准版本
pnpm release:deploy -v 2026.2.20 --oss --delta-from 2026.2.18,2026.2.19

# 跳过增量包
pnpm release:deploy -v 2026.2.20 --oss --skip-delta
```

**参数**:

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-v, --version` | 版本号 | package.json 中的 version |
| `-s, --server` | 服务器地址 (user@ip) | SCP 模式必填 |
| `-p, --port` | SSH 端口 | 22 |
| `-d, --domain` | 更新 URL 域名 | server IP |
| `--protocol` | URL 协议 | http |
| `--oss` | 使用阿里云 OSS 上传 | false |
| `--oss-domain` | OSS 自定义域名 | OSS 默认域名 |
| `--output-only` | 只生成，不上传 | false |
| `--skip-delta` | 跳过增量包 | false |
| `--skip-upload` | 跳过上传 | false |
| `--delta-from` | 增量基准版本 (逗号分隔) | 自动从缓存检测 |

**OSS 环境变量**:

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OSS_ACCESS_KEY_ID` | 阿里云 AccessKey ID | 必填 |
| `OSS_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret | 必填 |
| `OSS_BUCKET` | Bucket 名称 | `chuhai-tecbin` |
| `OSS_REGION` | OSS 地域 | `oss-cn-hangzhou` |
| `OSS_KEY_PREFIX` | Key 前缀 | `releases` |

**执行步骤**:

```
Step 1/9: 验证前置条件
  - dist/ 存在
  - .jsc 字节码文件存在
  - integrity-hashes.json 存在
  - control-ui/index.html 存在

Step 2/9: 生成 CHANGELOG
  - generate-changelog.ts --version X.Y.Z --inject-marker
  - 在 versionrecord.md 中注入版本标记

Step 3/9: 生成 manifest.json + checksums.json
  - generate-manifest.ts

Step 4/9: 生成增量包
  - 从 .release-cache/ 找到旧版本 dist/
  - 对每个旧版本调用 generate-delta-package.ts
  - 打包为 delta-from-{oldVer}.tar.gz

Step 5/9: 打包 full.tar.gz
  - 包含: dist/ + package.json + skills/ + extensions/
  - 排除: node_modules, .git, *.log

Step 6/9: 准备部署文件
  - 复制 manifest.json, checksums.json
  - 生成 full.tar.gz.sha256

Step 7/9: 生成 latest.json
  - 版本信息 + 下载 URL + 增量包列表 + changelog

Step 8/9: 上传 (SCP 或 OSS)
  - SCP: ssh mkdir → scp 文件到 /var/www/updates/releases/
  - OSS: ali-oss client.put() 到 {bucket}/{prefix}/{version}/
  - 上传 latest.json 到根目录

Step 9/9: 缓存当前 dist/
  - 复制到 .release-cache/{version}/dist/
  - 清理超过 5 个版本的旧缓存
```

---

## 5. 一键发版流程

### 5.1 完整发版 SOP

```bash
# 1. 确保代码在 main 分支，工作区干净
git checkout main && git status

# 2. 更新 package.json 版本号
#    修改 "version": "2026.2.20"

# 3. 构建生产包
pnpm build:secure
# 输出: dist/ (加密) + CHANGELOG.md

# 4. (可选) 构建 UI
pnpm ui:build

# 5. 一键发版部署
# 方式 A: OSS 上传 (推荐)
export OSS_ACCESS_KEY_ID=LTAI5t...
export OSS_ACCESS_KEY_SECRET=xxxxx...
pnpm release:deploy \
  --version 2026.2.20 \
  --oss \
  --oss-domain dl.openclawcn.com

# 方式 B: SCP 上传到 ECS
pnpm release:deploy \
  --version 2026.2.20 \
  --server root@<阿里云IP> \
  --domain updates.openclawcn.com \
  --protocol https

# 6. 验证部署
# OSS 模式:
curl -s https://dl.openclawcn.com/releases/latest.json | jq .
# SCP 模式:
curl -s https://updates.openclawcn.com/releases/latest.json | jq .
# 确认 version 字段正确

# 7. 打 git tag
git add CHANGELOG.md versionrecord.md package.json
git commit -m "release: v2026.2.20"
git tag v2026.2.20
git push origin main --tags
```

### 5.2 首次发版 (无增量包)

```bash
# 首次发版时没有 .release-cache/，会自动跳过增量包
pnpm release:deploy -v 2026.2.15 -s root@<IP> -d updates.openclawcn.com --skip-delta
```

发版后，`dist/` 会被缓存到 `.release-cache/2026.2.15/dist/`，下次发版时自动生成增量包。

---

## 6. 增量更新系统

### 6.1 latest.json Schema

```typescript
interface UpdateServerLatest {
  version: string;                    // "2026.2.20"
  buildTime: string;                  // ISO 8601
  gitCommit: string;                  // "5d5babb"
  nodeVersion: string;                // "v22.14.0"
  url: {
    full: string;                     // https://updates.openclawcn.com/releases/2026.2.20/full.tar.gz
    manifest: string;                 // .../manifest.json
    checksums: string;                // .../checksums.json
  };
  deltas: Array<{
    from: string;                     // "2026.2.18"
    url: string;                      // .../delta-from-2026.2.18.tar.gz
    size: number;                     // bytes
  }>;
  fullSize: number;                   // bytes
  fullSha256: string;                 // SHA256 of full.tar.gz
  changelog: {
    "zh-CN": string;                  // markdown 格式的更新说明
    "en-US": string;
  };
}
```

### 6.2 增量包结构

```
delta-from-2026.2.18/
├─ delta.json          ← 变更清单 (DeltaManifest)
├─ added/              ← 新增文件
│   ├─ dist/new-module.js
│   └─ dist/new-module.jsc
├─ modified/           ← 修改文件
│   ├─ dist/entry.js
│   └─ dist/gateway/server.js
└─ (removed files listed in delta.json)
```

**DeltaManifest**:
```typescript
interface DeltaManifest {
  fromVersion: string;
  toVersion: string;
  generatedAt: string;
  added: Array<{ path: string; sha256: string; size: number }>;
  modified: Array<{ path: string; sha256: string; size: number }>;
  removed: string[];
  totalSize: number;
  totalFiles: number;
}
```

### 6.3 版本缓存机制

```
.release-cache/
├─ 2026.2.20/
│   ├─ dist/           ← 完整 dist/ 快照
│   └─ package.json    ← 用于依赖变更检测
├─ 2026.2.18/
│   ├─ dist/
│   └─ package.json
└─ (最多保留 5 个版本)
```

### 6.4 存储目录结构

**ECS (SCP 模式)**:
```
/var/www/updates/releases/
├─ latest.json
├─ 2026.2.20/
│   ├─ full.tar.gz, full.tar.gz.sha256
│   ├─ delta-from-2026.2.18.tar.gz
│   ├─ manifest.json, checksums.json
└─ ...
```

**OSS (推荐)**:
```
chuhai-tecbin (Bucket, public-read ACL)
└─ releases/                         ← keyPrefix
   ├─ latest.json                    ← 客户端入口
   ├─ 2026.2.20/
   │   ├─ full.tar.gz                ← 完整包 (~50 MB)
   │   ├─ full.tar.gz.sha256
   │   ├─ delta-from-2026.2.18.tar.gz ← 增量包 (~5 MB)
   │   ├─ manifest.json
   │   └─ checksums.json
   └─ ...

# 默认访问 URL:
#   https://chuhai-tecbin.oss-cn-hangzhou.aliyuncs.com/releases/latest.json
# 绑定自定义域名后:
#   https://dl.openclawcn.com/releases/latest.json
```

### 6.5 阿里云 OSS 配置

**Bucket 创建**:
1. 登录 [阿里云 OSS 控制台](https://oss.console.aliyun.com/)
2. 创建 Bucket: `chuhai-tecbin`
3. 地域: 华东1 (杭州) — `oss-cn-hangzhou`
4. 读写权限: **公共读** (Public Read)
5. 存储类型: 标准存储

**自定义域名绑定** (可选):
1. OSS 控制台 → Bucket → 传输管理 → 绑定自定义域名
2. 添加域名: `dl.openclawcn.com`
3. DNS 添加 CNAME 记录: `dl.openclawcn.com` → `chuhai-tecbin.oss-cn-hangzhou.aliyuncs.com`
4. 开启 CDN 加速 (可选, 按需)
5. 开启 HTTPS: 上传 SSL 证书或使用阿里云免费证书

**AccessKey 创建**:
1. 阿里云 → RAM 访问控制 → 创建用户 (程序访问)
2. 授权策略: `AliyunOSSFullAccess` (或自定义 Bucket 级策略)
3. 记录 AccessKey ID 和 Secret

**自定义 RAM 策略** (最小权限, 推荐):
```json
{
  "Version": "1",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["oss:PutObject", "oss:GetObject", "oss:ListObjects"],
    "Resource": [
      "acs:oss:*:*:chuhai-tecbin",
      "acs:oss:*:*:chuhai-tecbin/*"
    ]
  }]
}
```

---

## 7. 客户端更新管线

### 7.1 三种安装模式

| 模式 | 检测条件 | 更新方式 |
|------|----------|----------|
| installer | `install.json` 存在 或 macOS .app 特征 | 从更新服务器下载 delta/full 包 |
| git | `.git/` 目录存在 | `git fetch + rebase/checkout` |
| package | 其他 (npm/pnpm 全局安装) | `pnpm add -g openclawcn@latest` |

### 7.2 Installer 模式更新流程

```
installer-updater.ts
│
├─ 1. checkInstallerUpdate()
│     → GET {updateServer}/releases/latest.json
│     → 比较版本号
│     → 返回 { hasUpdate, latest }
│
├─ 2. 选择更新方式
│     → latest.deltas 中有匹配当前版本的 delta? → delta 模式
│     → 否则 → full 模式
│
├─ 3. downloadFile()
│     → 下载 delta.tar.gz 或 full.tar.gz
│     → 进度回调 onDownloadProgress
│
├─ 4. SHA256 校验 (full 模式)
│     → 比对 fullSha256
│
├─ 5. extractTarGz()
│     → 解压到 .update-temp/
│
├─ 6. 备份
│     → dist/ → .update-backup/dist/
│     → skills/ → .update-backup/skills/
│     → extensions/ → .update-backup/extensions/
│     → package.json → .update-backup/package.json
│
├─ 7. 应用更新
│     → delta: 逐文件添加/修改/删除 + 每文件 SHA256 校验
│     → full: 替换整个 dist/、skills/、extensions/
│
├─ 8. verifyChecksums()
│     → 从服务器下载 checksums.json
│     → 逐文件校验 dist/ 中所有文件
│     → 失败则回滚
│
├─ 9. checkAndInstallDeps()
│     → 对比新旧 package.json dependencies
│     → 有变更则执行 pnpm install --omit=dev
│
└─ 10. 清理 .update-temp/ (保留 .update-backup/ 以备手动回滚)
```

### 7.3 更新内容展示

更新检测和完成时，changelog 会自动展示给用户:

**启动时** (update-startup.ts):
```
[INFO] update available: v2026.2.20 (current v2026.2.15). Run: openclawcn update
[INFO]   更新内容: 3 项新功能、5 项改进、2 项修复
```

**更新完成后** (update.run RPC 响应):
```json
{
  "ok": true,
  "result": { "status": "ok", "mode": "installer" },
  "changelog": {
    "zh-CN": "## 2026.2.20\n### 新功能\n- 智能工具发现...\n### 修复\n- ...",
    "en-US": "..."
  }
}
```

### 7.4 客户端配置

**install.json** (安装包自带):
```json
{
  "updateServer": "https://updates.openclawcn.com"
}
```

**环境变量覆盖**:
```bash
# 优先级高于 install.json
OPENCLAWCN_UPDATE_SERVER=https://updates.openclawcn.com
```

**更新频率配置** (config.json):
```json
{
  "update": {
    "checkOnStart": true,
    "channel": "stable"
  }
}
```

### 7.5 CLI 更新命令

```bash
openclawcn update                    # 自动检测并更新
openclawcn update --channel stable   # 指定频道
openclawcn update --channel beta     # 测试版
openclawcn update status             # 查看当前状态
openclawcn update wizard             # 交互式向导
openclawcn update --json             # 机器可读输出
openclawcn update --no-restart       # 不自动重启
```

---

## 8. CHANGELOG 自动生成

### 8.1 数据流

```
agent 日常工作 (每天多次)
    │
    ▼ version-record skill 追加
versionrecord.md
    │
    ▼ generate-changelog.ts 转换 (规则蒸馏, 非 LLM)
CHANGELOG.md
    │
    ├─ latest.json.changelog       → 客户端展示
    ├─ GitHub Release Notes        → 仓库页面展示
    └─ manifest.json.changelog     → 构建清单
```

### 8.2 转换规则

| 技术类别 | 用户类别 | 是否保留 |
|----------|----------|----------|
| New Feature | 新功能 | 保留 |
| Enhancement | 改进 | 保留 |
| Bug Fix | 修复 | 保留 |
| UI/UX | 界面优化 | 保留 |
| Performance | 性能优化 | 保留 |
| Security | 安全 | 保留 |
| Config | 配置 | 保留 |
| Build | 构建 | 保留 |
| Test | — | **排除** |
| Docs | — | **排除** |
| Architecture | — | **排除** |
| Research | — | **排除** |
| Files Changed/New | — | **排除** |

**过滤规则**:
- 去掉代码块、表格
- 去掉文件路径标题 (含 `.ts`, `.js`, `src/`)
- 去掉性能指标原始数据 (含 `ms`, `QPS`, `entries/sec`)
- 去掉技术 bug ID 前缀 (`[R1-BUG-2]`, `[#2]`)
- 保留: 标题 + 一句话描述

### 8.3 三个自动触发点

| 触发 | 时机 | 注入版本标记 |
|------|------|------------|
| `build:secure` | 每次本地构建 | 否 |
| `release-deploy.ts` Step 2 | 发版部署时 | 是 (`--inject-marker`) |

---

## 9. Docker 部署

### 9.1 Docker Compose

```bash
cd docker/
docker compose up -d
```

**端口**: 18789 (可通过 `OPENCLAWCN_GATEWAY_PORT` 配置)

**Volumes**:
- `openclawcn-data` → `~/.openclawcn` (配置和状态)
- `openclawcn-workspace` → `~/.openclawcn/workspace` (工作区)

### 9.2 Docker 镜像发布

```
push tag v*
    ↓
docker-release.yml
    ├─ build-amd64 (ubuntu-latest)
    ├─ build-arm64 (ubuntu-24.04-arm)
    └─ create-manifest (多架构合并)
    ↓
ghcr.io/<owner>/clawdbot:<version>
```

### 9.3 健康检查

```bash
curl -f http://localhost:18789/health
# 返回 JSON: { "status": "ok", ... }
```

---

## 10. 安全与加密

### 10.1 代码保护层次

| 层次 | 技术 | 文件 |
|------|------|------|
| 1 | JavaScript 混淆 | `scripts/obfuscate-dist.ts` (javascript-obfuscator) |
| 2 | ByteNode 字节码加密 | `cn/scripts/build/compile-bytecode.ts` → `.jsc` |
| 3 | 完整性校验 | `scripts/generate-integrity-hashes.ts` → SHA256 |

### 10.2 更新包安全

- **full.tar.gz**: 下载后 SHA256 校验 (与 latest.json.fullSha256 比对)
- **delta 包**: 每个文件逐一 SHA256 校验 (delta.json 中声明)
- **应用后**: 从服务器下载 checksums.json 再次全量校验
- **失败回滚**: 任何校验失败自动从 `.update-backup/` 恢复

### 10.3 传输安全

- Nginx 强制 HTTPS (HTTP 301 重定向)
- Let's Encrypt 自动续期
- CORS 允许所有来源 (公开下载)

---

## 11. 故障排查

### 11.1 发版失败

| 问题 | 排查 |
|------|------|
| `dist/ 目录不存在` | 先运行 `pnpm build:secure` |
| `未找到 .jsc 字节码文件` | 检查 `compile-bytecode.ts` 是否成功 |
| `SCP 上传失败` | 检查 SSH 密钥、服务器 IP、端口、安全组 |
| `OSS 上传失败` | 检查 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET 环境变量 |
| `OSS AccessDenied` | 检查 RAM 权限、Bucket 名称/地域是否正确 |
| `latest.json URL 包含 PLACEHOLDER` | 使用 `--domain` 参数指定域名 |
| `增量包为 0 文件变更` | `.release-cache/` 中的旧版本与当前版本相同 |

### 11.2 客户端更新失败

| 问题 | 排查 |
|------|------|
| `installer-no-update-server` | 检查 install.json 中的 updateServer 或环境变量 |
| `SHA256 mismatch` | 服务器文件可能损坏，重新上传 |
| `checksum verification failed, rolled back` | 服务器 checksums.json 与文件不匹配 |
| 更新后依赖安装失败 | 手动运行 `pnpm install --omit=dev` |

### 11.3 服务器验证 (ECS)

```bash
# 检查 Nginx 状态
systemctl status nginx

# 检查文件是否上传成功
ls -lh /var/www/updates/releases/latest.json
ls -lh /var/www/updates/releases/<version>/

# 检查 latest.json 内容
cat /var/www/updates/releases/latest.json | jq .

# 检查外部访问
curl -I https://updates.openclawcn.com/releases/latest.json
# 应看到: Cache-Control: no-cache, no-store, must-revalidate

curl -I https://updates.openclawcn.com/releases/<version>/full.tar.gz
# 应看到: Cache-Control: public, max-age=604800
```

### 11.4 OSS 验证

```bash
# 检查 latest.json (默认域名)
curl -s https://chuhai-tecbin.oss-cn-hangzhou.aliyuncs.com/releases/latest.json | jq .version

# 检查 latest.json (自定义域名)
curl -s https://dl.openclawcn.com/releases/latest.json | jq .version

# 检查文件是否可下载
curl -I https://dl.openclawcn.com/releases/<version>/full.tar.gz
# 应看到: HTTP/2 200, Content-Type: application/gzip

# 使用 ossutil 列出文件 (需安装)
ossutil ls oss://chuhai-tecbin/releases/<version>/
```

### 11.5 磁盘空间管理

```bash
# 检查磁盘使用
du -sh /var/www/updates/releases/*

# 清理旧版本 (保留最近 5 个)
cd /var/www/updates/releases
ls -d */ | sort -V | head -n -5 | xargs rm -rf
```

---

## 12. 附录: 文件清单

### 12.1 构建脚本

| 文件 | 用途 |
|------|------|
| `scripts/generate-changelog.ts` | versionrecord.md → CHANGELOG.md |
| `scripts/generate-manifest.ts` | 版本清单 + 校验和 |
| `scripts/generate-delta-package.ts` | 增量包生成 |
| `scripts/release-deploy.ts` | 一键发版部署 |
| `scripts/obfuscate-dist.ts` | JavaScript 混淆 |
| `scripts/generate-integrity-hashes.ts` | 完整性哈希 |
| `cn/scripts/build/compile-bytecode.ts` | ByteNode 加密 |
| `cn/scripts/build/compile-extensions.ts` | CN 扩展编译 |

### 12.2 客户端更新模块

| 文件 | 用途 |
|------|------|
| `src/infra/installer-updater.ts` | Installer 模式更新核心 |
| `src/infra/update-check.ts` | 更新状态检测 |
| `src/infra/update-runner.ts` | 更新执行编排 |
| `src/infra/update-startup.ts` | 启动时更新检查 |
| `src/infra/update-channels.ts` | 频道管理 |
| `src/infra/update-content.ts` | 更新内容展示 |
| `src/infra/restart-sentinel.ts` | 重启状态持久化 |
| `src/infra/restart.ts` | 重启信号协调 |
| `src/gateway/server-methods/update.ts` | RPC 更新接口 |
| `src/cli/update-cli/` | CLI 更新命令 |

### 12.3 构建产物 (gitignore)

```
dist/                   # 编译输出
manifest.json           # 版本清单
checksums.json          # 校验和
CHANGELOG.md            # 自动生成
.release-cache/         # 版本快照缓存
.release-deploy/        # 临时部署目录
.update-temp/           # 客户端更新临时
.update-backup/         # 客户端更新备份
```

---

## 13. Gitee Webhook + FRP 内网穿透本地构建管线

> 本节描述基于 Gitee Webhook → 阿里云 frps → 本地 frpc → webhook-server → SSH 到 Windows/macOS 构建机的完整 CI/CD 管线。
> 该管线用于自动触发本地双平台（Windows + macOS）桌面安装包构建。

### 13.1 网络拓扑

```
┌─────────────────┐
│   Gitee 仓库     │
│ (Push / Tag)     │
└────────┬────────┘
         │ HTTP POST (Webhook)
         ▼
┌─────────────────────────────────────────┐
│   阿里云 ECS (106.15.198.253)            │
│                                          │
│   frps 服务端                             │
│   ├─ :7000  — frp 控制端口               │
│   ├─ :9999  — TCP 代理 → 本地 :8888      │  ← Gitee Webhook 入口
│   └─ :6022  — TCP 代理 → 本地 :22        │  ← Windows SSH 隧道
│                                          │
│   auth.token = "clawbot-frp-2026"        │
└────────┬────────────────────────────────┘
         │ frp TCP tunnel
         ▼
┌─────────────────────────────────────────┐
│   本机 kevinUp (Webhook 服务器)           │
│                                          │
│   frpc 客户端                             │
│   ├─ webhook: 127.0.0.1:8888 → :9999    │
│   └─ windows-ssh: 127.0.0.1:22 → :6022  │
│                                          │
│   webhook-server.js (Node.js/Express)    │
│   ├─ 监听 0.0.0.0:8888                   │
│   ├─ 验证 Gitee 签名                     │
│   ├─ 解析 commit message 构建指令         │
│   └─ SSH 触发远程构建                     │
└────────┬───────────────┬────────────────┘
         │ SSH           │ SSH
         ▼               ▼
┌──────────────────┐  ┌──────────────────┐
│ Windows 构建机    │  │ macOS 构建机      │
│ KEVINSUN         │  │ 192.168.0.107    │
│ (DHCP, hostname) │  │ (静态 IP)         │
│                  │  │                  │
│ User: SunBin     │  │ User: kevinsun   │
│ SSH: 免密登录     │  │ SSH: 免密登录     │
│                  │  │                  │
│ 产物:            │  │ 产物:             │
│ E:\clawdbuild\   │  │ ~/cicd-workspace │
│ ClawdbotCN-      │  │ /clawdbot/build/ │
│ Setup-*.exe      │  │ output/*.dmg     │
└──────────────────┘  └──────────────────┘
```

### 13.2 核心组件说明

#### 13.2.1 frps 服务端（阿里云 ECS）

- **服务器**: 106.15.198.253
- **frps 端口**: 7000（frp 控制协议）
- **认证**: `auth.token = "clawbot-frp-2026"`
- **TCP 代理**:
  - `:9999` → 本地 `:8888`（Gitee Webhook 入口）
  - `:6022` → 本地 `:22`（Windows SSH 隧道，可选）
- **安全组**: 需开放 7000, 9999, 6022 端口

部署脚本: `ci/aliyun-setup.sh`

#### 13.2.2 frpc 客户端（本机 kevinUp）

配置文件: `ci/frpc.toml`

```toml
serverAddr = "106.15.198.253"
serverPort = 7000
auth.token = "clawbot-frp-2026"

# Gitee Webhook 入口
[[proxies]]
name = "webhook"
type = "tcp"
localIP = "127.0.0.1"
localPort = 8888
remotePort = 9999

# Windows SSH 隧道（可选）
[[proxies]]
name = "windows-ssh"
type = "tcp"
localIP = "127.0.0.1"
localPort = 22
remotePort = 6022
```

#### 13.2.3 Webhook 服务器（本机）

文件: `ci/webhook-server.js`

核心功能:
- **Express.json()** 解析 Gitee POST body
- **Gitee 签名验证**: 支持密码模式 (X-Gitee-Token == secret) 和签名模式 (HMAC-SHA256)
- **hostname 动态解析**: DNS lookup 解决 Windows DHCP IP 漂移问题
- **构建并发锁**: 同平台不重复构建
- **超时控制**: settled flag + clearTimeout 避免 Promise 双重 settle
- **路径遍历防护**: `path.basename()` 过滤日志文件名
- **默认双平台并行构建**: `[build]` 或 `[ci]` 默认触发 Windows + macOS

HTTP 端点:
| 端点 | 方法 | 用途 |
|------|------|------|
| `/webhook` | POST | Gitee Webhook 接收 |
| `/health` | GET | 健康检查（含 DNS 解析状态） |
| `/status` | GET | 构建状态页面 |
| `/logs/:filename` | GET | 构建日志查看 |

#### 13.2.4 Windows 构建机

| 项目 | 配置 |
|------|------|
| 主机名 | KEVINSUN（使用 hostname 而非 IP，解决 DHCP 漂移） |
| 用户 | SunBin |
| 工作目录 | `D:\cicd-workspace\openclawcn` |
| 产物目录 | `E:\clawdbuild\` |
| 构建脚本 | `build/scripts/windows/build-windows.ps1` |
| 超时 | 5400 秒 (90 分钟) |
| SSH | 免密登录 (publickey) |

#### 13.2.5 macOS 构建机（Mac Mini）

| 项目 | 配置 |
|------|------|
| IP | 192.168.0.107（静态 IP） |
| 用户 | kevinsun |
| 工作目录 | `~/cicd-workspace/openclawcn` |
| 产物目录 | `~/cicd-workspace/clawdbot/build/output/` |
| 构建脚本 | `build/scripts/build-macos-cn.sh` |
| 超时 | 3600 秒 (60 分钟) |
| SSH | 免密登录 (publickey) |
| Node 路径 | `/usr/local/lib/nodejs/node-v22.14.0-darwin-arm64/bin` |

### 13.3 构建触发规则

#### 13.3.1 Commit Message 指令

| 指令 | 效果 |
|------|------|
| `[build]` 或 `[ci]` | 双平台并行构建（Windows + macOS） |
| `[build windows]` | 仅 Windows 构建 |
| `[build macos]` 或 `[build mac]` | 仅 macOS 构建 |
| `[full]` | 全量构建模式 |
| Tag push (`v*` / `release-*`) | 双平台并行 + 自动提取版本号 |

#### 13.3.2 分支过滤

仅以下分支的 push 会触发构建（在 `ci/config.json` 中配置）:

```json
"auto_trigger": {
  "on_push": true,
  "on_tag": true,
  "branches": ["main", "master", "dev"]
}
```

#### 13.3.3 触发流程

```
1. 开发者 push 到 Gitee (master/main/dev 分支)
2. Gitee 发送 HTTP POST 到 http://106.15.198.253:9999/webhook
3. 请求通过 frp 隧道到达本机 :8888
4. webhook-server.js 验证签名 → 解析 commit message
5. 如果包含 [build] / [ci] / tag push：
   a. 立即返回 200 给 Gitee（避免超时）
   b. 异步触发构建:
      - platform=all → Promise.allSettled 并行构建双平台
      - platform=windows → 仅调用 build-windows.sh
      - platform=macos → 仅调用 build-macos.sh
6. 构建脚本通过 SSH 连接到构建机:
   - Windows: SCP 上传 .ps1 脚本 → SSH 执行
   - macOS: SCP 上传 .sh 脚本 → SSH 执行
7. 构建完成后 SCP 下载产物到 ci/artifacts/
```

### 13.4 构建脚本工作流

#### 13.4.1 Windows 构建 (`ci/build-windows.sh`)

```
1. 从 config.json 读取 Windows 构建机配置
2. 生成临时 .ps1 脚本（内嵌构建逻辑）
3. SCP 上传 .ps1 到 Windows 构建机
4. SSH 执行: powershell -ExecutionPolicy Bypass -File cicd-build.ps1
5. 远程脚本执行:
   a. git fetch + git reset --hard origin/master
   b. npm install
   c. 执行 build/scripts/windows/build-windows.ps1
   d. 检查 E:\clawdbuild\ClawdbotCN-Setup-*.exe
6. 构建成功后 SCP 下载 .exe 到 ci/artifacts/windows/
```

> **重要**: SSH/SCP 使用 `powershell -NoProfile -Command ssh/scp` 封装，因为 Git Bash 无法直接访问 E: 盘路径。

#### 13.4.2 macOS 构建 (`ci/build-macos.sh`)

```
1. 从 config.json 读取 macOS 构建机配置
2. 生成临时 .sh 脚本（设置 PATH 确保 node/pnpm 可用）
3. SCP 上传 .sh 到 Mac Mini
4. SSH 执行: bash ~/cicd-build-mac.sh
5. 远程脚本执行:
   a. git fetch + git reset --hard origin/master
   b. pnpm install（或 npm install）
   c. 执行 build/scripts/build-macos-cn.sh --arch universal
   d. 检查 build/output/ClawdbotCN-macOS-*.dmg
6. 构建成功后 SCP 下载 .dmg 到 ci/artifacts/macos/
```

> **重要**: macOS 使用 SCP+SSH 模式（而非 stdin 管道传脚本），避免 PowerShell 封装下 stdin 传参失效。

### 13.5 开机自启动

本机 (kevinUp) 需要在 Windows 重启后自动启动 webhook-server 和 frpc。双重保障机制:

#### 13.5.1 Windows 计划任务 (`ci/register-tasks.ps1`)

```powershell
# 注册计划任务（开机自动运行）
Register-ScheduledTask -TaskName "ClawdbotCN-Webhook" ...
Register-ScheduledTask -TaskName "ClawdbotCN-FRP" ...
```

#### 13.5.2 注册表启动项 (`ci/register-startup.ps1`)

```powershell
# 备用：注册表 Run 键
Set-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" `
  -Name "ClawdbotCN-Webhook" -Value "..."
Set-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" `
  -Name "ClawdbotCN-FRP" -Value "..."
```

#### 13.5.3 守护循环脚本

| 脚本 | 用途 |
|------|------|
| `ci/webhook-loop.ps1` | 循环启动 webhook-server.js，崩溃自动重启 |
| `ci/frpc-loop.ps1` | 循环启动 frpc，断线自动重连 |
| `ci/run-hidden.vbs` | VBScript 包装，隐藏 PowerShell 窗口 |

### 13.6 Gitee Webhook 签名验证

webhook-server.js 支持两种 Gitee 验证方式:

#### 方式1: 密码模式

```
Header: X-Gitee-Token: <配置的 secret>
验证: token === config.webhook.secret
```

#### 方式2: 签名模式

```
Header: X-Gitee-Token: <HMAC-SHA256 签名的 Base64>
Header: X-Gitee-Timestamp: <毫秒时间戳>
验证: HMAC-SHA256(timestamp + "\n" + secret, secret) → Base64 === token
```

### 13.7 Windows DHCP IP 漂移解决方案

**问题**: Windows 构建机 (KEVINSUN) 使用 DHCP 分配 IP，重启后 IP 可能变化。

**解决方案**:
1. `ci/config.json` 中 Windows host 使用 **hostname** `"KEVINSUN"` 而非 IP 地址
2. `webhook-server.js` 启动时和构建时通过 `dns.lookup()` 动态解析 hostname → IP
3. 所有构建脚本从 `config.json` 读取配置，不使用硬编码 fallback IP
4. `cygpath -m`（而非 `-w`）转换路径，输出 `D:/path` 格式避免 bash 吃掉反斜杠

```javascript
// hostname 动态解析
function resolveHost(host) {
  return new Promise((resolve) => {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host === 'localhost') {
      return resolve(host);
    }
    dns.lookup(host, { family: 4 }, (err, address) => {
      if (err) return resolve(host);
      resolve(address);
    });
  });
}
```

### 13.8 配置文件

核心配置: `ci/config.json`

```json
{
  "gitee": {
    "repo": "https://gitee.com/sunshine1314/openclawcn",
    "ssh_url": "git@gitee.com:sunshine1314/openclawcn.git",
    "branch": "master"
  },
  "builders": {
    "windows": {
      "host": "KEVINSUN",          // hostname（非 IP）
      "port": 22,
      "user": "SunBin",
      "workspace": "/mnt/d/cicd-workspace/openclawcn",
      "output": "/mnt/e/clawdbuild",
      "node_version": "22.14.0",
      "build_script": "build/scripts/windows/build-windows.ps1",
      "enabled": true,
      "timeout": 5400
    },
    "macos": {
      "host": "192.168.0.107",     // 静态 IP
      "port": 22,
      "user": "kevinsun",
      "workspace": "~/cicd-workspace/openclawcn",
      "output": "~/cicd-workspace/clawdbot/build/output",
      "node_version": "22.14.0",
      "build_script": "build/scripts/build-macos-cn.sh",
      "enabled": true,
      "timeout": 3600
    }
  },
  "webhook": {
    "port": 8888,
    "host": "0.0.0.0",
    "secret": "<Gitee Webhook 密码>",
    "auto_trigger": {
      "on_push": true,
      "on_tag": true,
      "branches": ["main", "master", "dev"]
    }
  }
}
```

### 13.9 CI 脚本文件清单

| 文件 | 用途 |
|------|------|
| `ci/config.json` | 中央配置（构建机、Webhook、产物） |
| `ci/webhook-server.js` | Webhook 服务器（Express） |
| `ci/build-windows.sh` | Windows 远程构建脚本 |
| `ci/build-macos.sh` | macOS 远程构建脚本 |
| `ci/frpc.toml` | frpc 客户端配置 |
| `ci/frpc-loop.ps1` | frpc 守护循环 |
| `ci/webhook-loop.ps1` | webhook-server 守护循环 |
| `ci/run-hidden.vbs` | 隐藏窗口运行 PS1 |
| `ci/register-tasks.ps1` | 注册 Windows 计划任务 |
| `ci/register-startup.ps1` | 注册表启动项 |
| `ci/check-status.ps1` | 检查端口/进程/隧道状态 |
| `ci/status.sh` | Bash 版状态检查 |
| `ci/add-gitee-keys.sh` | Gitee SSH 公钥添加助手 |
| `ci/aliyun-setup.sh` | 阿里云 frps 部署脚本 |
| `ci/install-frpc.ps1` | 本地 frpc 安装 |
| `ci/start-frpc.ps1` | 启动 frpc |
| `ci/reinstall-frpc.ps1` | 重装 frpc |
| `ci/test-build.ps1` | 测试构建机连通性 |
| `ci/test-scp.ps1` | 测试 SCP 传输 |
| `ci/test-tunnel.ps1` | 测试 frp 隧道 |
| `ci/test-mac-node.ps1` | 测试 Mac Node.js 环境 |
| `ci/test-webhook-chain.ps1` | 全链路 Webhook 模拟测试 |

### 13.10 运维操作

#### 手动触发构建

```bash
# 方法1: Gitee 提交时带 [build] 标记
git commit -m "feat: xxx [build]" && git push

# 方法2: 直接发送 Webhook
curl -X POST http://106.15.198.253:9999/webhook \
  -H "Content-Type: application/json" \
  -H "X-Gitee-Token: <secret>" \
  -H "X-Gitee-Event: Push Hook" \
  -d '{"ref":"refs/heads/master","commits":[{"message":"[build] manual trigger"}]}'
```

#### 检查服务状态

```powershell
# 健康检查（通过隧道）
Invoke-WebRequest http://106.15.198.253:9999/health

# 本地健康检查
Invoke-WebRequest http://localhost:8888/health

# 端口/进程/隧道状态
powershell ci/check-status.ps1

# SSH 连通性
ssh SunBin@KEVINSUN "hostname"
ssh kevinsun@192.168.0.107 "hostname"
```

#### 查看构建日志

```
http://localhost:8888/status          — 构建状态页面
http://localhost:8888/logs/build-windows.log — Windows 构建日志
http://localhost:8888/logs/build-macos.log   — macOS 构建日志
```

### 13.11 故障排查

| 问题 | 排查方法 |
|------|----------|
| Webhook 收不到请求 | 检查 frpc 是否运行 (`check-status.ps1`)；检查阿里云安全组 9999 端口 |
| Gitee 返回 403 | 检查 webhook secret 是否一致；检查签名验证方式 |
| SSH 连接超时 | 检查构建机 SSH 服务；检查防火墙；用 `test-build.ps1` 测试 |
| Windows IP 变了 | config.json 使用 hostname KEVINSUN，无需修改；检查 DNS 解析 |
| 构建超时 | 检查 config.json timeout 设置；查看构建日志 |
| 产物下载失败 | SCP 通过 PowerShell 封装，检查路径是否正确；手动 SCP 测试 |
| Node 找不到 (macOS) | 检查远程脚本 PATH 设置 (`/usr/local/lib/nodejs/...`) |
| npm 命令截断 | Windows SSH 远程执行可能截断命令，检查 PS1 脚本编码 |
