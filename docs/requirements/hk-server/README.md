# 香港服务器二进制同步部署包

> 📅 更新日期: 2026-02-06  
> 📦 版本: v1.0

## 方案简介

香港服务器作为 **静态文件服务器**，直连 GitHub 同步 13 个工具的二进制文件，供 OpenClawCN 客户端下载。

```
GitHub Release → 香港服务器 → 用户客户端
                  (同步+托管)     (直接下载)
```

**优势**：
- 香港直连 GitHub 速度快
- 国内访问香港延迟低
- 无需复杂的 API 服务，纯静态文件托管

---

## 快速开始

### 1. 上传文件

将以下文件上传到香港服务器的 `/opt/binaries-sync/` 目录：

```
/opt/binaries-sync/
├── sync_binaries.py      # 同步脚本
├── tools_config.json     # 工具配置
└── README.md             # 本文档
```

### 2. 安装依赖

```bash
pip3 install requests
```

### 3. 创建目录

```bash
sudo mkdir -p /data/binaries
sudo mkdir -p /var/log/binaries-sync
sudo chown $USER:$USER /data/binaries
sudo chown $USER:$USER /var/log/binaries-sync
```

### 4. 首次同步（测试）

```bash
cd /opt/binaries-sync

# 先检查版本（不下载）
python3 sync_binaries.py --check

# 只同步一个工具测试
python3 sync_binaries.py ordercli

# 全量同步
python3 sync_binaries.py
```

### 5. 配置定时任务

```bash
# 添加 cron 任务（每小时同步）
(crontab -l 2>/dev/null; echo "0 * * * * cd /opt/binaries-sync && python3 sync_binaries.py >> /var/log/binaries-sync/cron.log 2>&1") | crontab -
```

---

## 使用说明

### 命令行参数

```bash
# 同步所有工具
python3 sync_binaries.py

# 只同步指定工具
python3 sync_binaries.py ordercli

# 强制重新下载（即使版本相同）
python3 sync_binaries.py --force

# 只检查版本，不下载
python3 sync_binaries.py --check
```

### 目录结构

同步完成后，`/data/binaries/` 结构如下：

```
/data/binaries/
├── ordercli/
│   ├── version.txt           # 当前最新版本号
│   ├── metadata.json         # 工具元信息
│   └── 0.1.0/                # 版本目录
│       ├── darwin-arm64      # macOS ARM64 二进制
│       ├── darwin-arm64.sha256
│       ├── darwin-amd64      # macOS Intel 二进制
│       ├── darwin-amd64.sha256
│       ├── linux-amd64       # Linux 二进制
│       ├── linux-amd64.sha256
│       ├── windows-amd64.exe # Windows 二进制
│       └── windows-amd64.exe.sha256
├── peekaboo/
│   ├── version.txt
│   ├── metadata.json
│   └── 1.2.3/
│       └── ...
└── ...
```

### 日志查看

```bash
# 查看同步日志
tail -f /var/log/binaries-sync/sync.log

# 查看 cron 日志
tail -f /var/log/binaries-sync/cron.log
```

---

## 配置说明

### tools_config.json

```json
{
  "syncConfig": {
    "syncIntervalHours": 1,    // 同步间隔（仅供参考，实际由 cron 控制）
    "maxRetries": 3,           // 下载失败重试次数
    "dataDir": "/data/binaries" // 数据存储目录
  },
  "tools": [
    {
      "name": "ordercli",      // 工具名（存储目录名）
      "repo": "steipete/ordercli", // GitHub 仓库
      "assetPattern": "{name}_{version}_{platform}.tar.gz", // Release 文件名模式
      "platformMapping": {      // 平台名映射
        "darwin-arm64": "darwin_arm64",
        "darwin-amd64": "darwin_amd64"
      },
      "platforms": ["darwin-arm64", "darwin-amd64"], // 支持的平台
      "description": "工具描述"
    }
  ]
}
```

### assetPattern 变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `{name}` | 工具名 | ordercli |
| `{version}` | 版本号（不含 v） | 0.1.0 |
| `{platform}` | 平台标识（经 platformMapping 转换） | darwin_arm64 |

### 常见文件名模式

不同项目的 Release 文件名格式可能不同：

| 模式 | 示例 |
|------|------|
| `{name}_{version}_{platform}.tar.gz` | ordercli_0.1.0_darwin_arm64.tar.gz |
| `{name}-{version}-{platform}.tar.gz` | ordercli-0.1.0-darwin-arm64.tar.gz |
| `{name}-{platform}.tar.gz` | ordercli-darwin-arm64.tar.gz |

请根据实际 Release 文件名调整 `assetPattern` 和 `platformMapping`。

---

## 故障排除

### 问题：找不到 Asset

```
⚠️ 未找到 Asset: ordercli_0.1.0_darwin_arm64.tar.gz
   可用 Assets: ['ordercli-darwin-arm64.tar.gz', ...]
```

**解决**：根据"可用 Assets"调整 `assetPattern`。

### 问题：无 Release

```
⚠️ 仓库无 Release: steipete/xxx
```

**解决**：该仓库可能还没有创建 Release，暂时跳过。

### 问题：下载超时

```
⚠️ 下载超时
```

**解决**：检查网络连接，脚本会自动重试 3 次。

### 问题：磁盘空间不足

```bash
# 清理旧版本（保留最新版）
cd /data/binaries/ordercli
ls -d */ | sort -V | head -n -1 | xargs rm -rf
```

---

## GitHub Token（可选）

设置 GitHub Token 可将 API 限额从 60 次/小时提升到 5000 次/小时：

```bash
export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"
python3 sync_binaries.py
```

或添加到 cron：

```bash
0 * * * * GITHUB_TOKEN="ghp_xxx" cd /opt/binaries-sync && python3 sync_binaries.py >> /var/log/binaries-sync/cron.log 2>&1
```

---

---

## Nginx 静态文件托管配置

同步完成后，用 Nginx 托管 `/data/binaries/` 目录：

```nginx
# /etc/nginx/sites-available/binaries
server {
    listen 80;
    server_name binaries.example.com;  # 替换为实际域名或 IP

    root /data/binaries;
    autoindex on;  # 允许目录浏览（可选）

    location / {
        # 允许跨域（OpenClawCN 客户端需要）
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, OPTIONS';
        
        # 缓存设置
        expires 1h;
        add_header Cache-Control "public, max-age=3600";
    }

    # 健康检查
    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/binaries /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 下载 URL 格式

```
http://服务器IP/ordercli/0.1.0/darwin-arm64
http://服务器IP/ordercli/version.txt
http://服务器IP/ordercli/metadata.json
```

---

## 联系方式

如有问题，请联系开发团队。
