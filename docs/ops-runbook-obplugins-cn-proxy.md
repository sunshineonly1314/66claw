# 运维手册：obplugins.cn 反向代理部署记录

> **部署日期**：2026-02-09
> **目的**：用已备案的 `www.obplugins.cn`（阿里云国内服务器）反向代理 `www.tecbinai.com`（香港服务器），解决国内用户直连香港不稳定的问题。

---

## 一、架构

```
中国用户浏览器
    │
    ▼
www.obplugins.cn (DNS → 121.43.61.90 阿里云杭州)
    │
    ├─ HTTP  :80   → 301 重定向到 HTTPS
    ├─ HTTPS :443  → Host Nginx 反向代理 → www.tecbinai.com (43.129.194.117 香港腾讯云)
    │                 ├─ /api/*   不缓存，直接透传
    │                 └─ 页面/静态资源  5分钟缓存
    │
    └─ IP 访问 :80 → Host Nginx → Docker Nginx :8880 (skills/binaries 服务)
```

### 服务器信息

| 角色 | IP | 位置 | 系统 |
|------|-----|------|------|
| 阿里云 SkillsProxy | 121.43.61.90 | 杭州 | Alibaba Cloud Linux 3 |
| 腾讯云 HK | 43.129.194.117 | 香港 | CentOS |

### Nginx 层次

| 层 | 端口 | 服务 |
|----|------|------|
| Host Nginx 1.20.1 | 80, 443 | obplugins.cn 反代 + IP 访问转发 |
| Docker Nginx (alpine) | 8880→80 | skills/binaries 静态文件 + Java 后端代理 |

---

## 二、SSL 证书

- **来源**：阿里云免费 DV 证书（DigiCert）
- **域名**：`www.obplugins.cn`
- **验证方式**：DNS TXT 记录 (`_dnsauth.www`)
- **有效期**：1 年（2026-02 ~ 2027-02）
- **服务器路径**：
  - `/etc/nginx/ssl/obplugins.cn/www.obplugins.cn.pem` (644)
  - `/etc/nginx/ssl/obplugins.cn/www.obplugins.cn.key` (600)
- **项目备份**：`yunwei/23452575_www.obplugins.cn_nginx/`

---

## 三、实际部署的配置文件

### 3.1 `/etc/nginx/nginx.conf`

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;

include /usr/share/nginx/modules/*.conf;

events {
    worker_connections 1024;
}

http {
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile            on;
    tcp_nopush          on;
    tcp_nodelay         on;
    keepalive_timeout   65;
    types_hash_max_size 4096;

    include             /etc/nginx/mime.types;
    default_type        application/octet-stream;

    # 反代页面缓存（5min TTL, max 100MB）
    proxy_cache_path /var/cache/nginx/obplugins levels=1:2
                     keys_zone=obplugins_cache:10m max_size=100m inactive=10m;

    include /etc/nginx/conf.d/*.conf;
}
```

### 3.2 `/etc/nginx/conf.d/obplugins-proxy.conf`

```nginx
# --- IP 访问：转发到 Docker Nginx (skills/binaries) ---
server {
    listen 80;
    server_name 121.43.61.90;

    location / {
        proxy_pass http://127.0.0.1:8880;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 10s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}

# --- obplugins.cn HTTP → HTTPS 重定向 ---
server {
    listen 80;
    server_name www.obplugins.cn obplugins.cn;
    return 301 https://$host$request_uri;
}

# --- obplugins.cn HTTPS 反向代理 ---
server {
    listen 443 ssl http2;
    server_name www.obplugins.cn obplugins.cn;

    ssl_certificate     /etc/nginx/ssl/obplugins.cn/www.obplugins.cn.pem;
    ssl_certificate_key /etc/nginx/ssl/obplugins.cn/www.obplugins.cn.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # 通用代理头
    proxy_http_version 1.1;
    proxy_set_header Host www.tecbinai.com;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    proxy_ssl_server_name on;
    proxy_ssl_name www.tecbinai.com;
    proxy_ssl_protocols TLSv1.2 TLSv1.3;
    proxy_connect_timeout 10s;
    proxy_send_timeout 30s;
    proxy_read_timeout 60s;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # API 请求 - 不缓存，直接透传
    location /api/ {
        proxy_pass https://www.tecbinai.com;
        proxy_cache off;
        proxy_no_cache 1;
    }

    # 静态资源 - 缓存 5 分钟
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass https://www.tecbinai.com;
        proxy_cache obplugins_cache;
        proxy_cache_valid 200 5m;
        proxy_cache_valid 301 302 1m;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        proxy_cache_lock on;
        add_header X-Cache-Status $upstream_cache_status;
    }

    # HTML 页面 - 缓存 5 分钟 + 域名替换
    location / {
        proxy_pass https://www.tecbinai.com;

        proxy_cache obplugins_cache;
        proxy_cache_valid 200 5m;
        proxy_cache_valid 301 302 1m;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        proxy_cache_lock on;
        add_header X-Cache-Status $upstream_cache_status;

        sub_filter 'www.tecbinai.com' 'www.obplugins.cn';
        sub_filter_once off;
        sub_filter_types text/html text/css application/javascript;
    }

    access_log /var/log/nginx/obplugins-proxy.access.log;
    error_log  /var/log/nginx/obplugins-proxy.error.log;
}
```

### 3.3 Docker Nginx 配置（`/root/obplugins/nginx.conf`）

无变化，仍然是 skills/binaries 服务配置。仅端口从 `80:80` 改为 `8880:80`。

---

## 四、代码变更

客户端代码中为中国区用户添加了 obplugins.cn 作为优先回退：

| 文件 | 变更 |
|------|------|
| `src/gateway/license-check.ts` | `apiFallbackUrls` 第一条改为 `https://www.obplugins.cn/api/api/v1/license` |
| `src/gateway/server-methods/feedback.ts` | 新增 `FEEDBACK_API_CN_FALLBACK_URL`，CN 区先走 obplugins.cn |
| `src/license/support-qrcode.ts` | 购买链接 CN 区先走 obplugins.cn |
| `ui/src/ui/i18n/locales/zh-CN.ts` | `brand.tecbinaiUrl` → `https://www.obplugins.cn` |
| `ui/src/ui/i18n/locales/en.ts` | `brand.tecbinaiUrl` → `https://www.obplugins.cn` |
| `ui/src/ui/app-render.ts` | 页面链接 href → obplugins.cn |
| `ui/src/ui/views/overview.ts` | 页面链接 href → obplugins.cn |
| `ui/src/ui/license/license-dialogs.ts` | 购买链接 href → obplugins.cn |
| `ui/public/install-guide.html` | 所有链接 → obplugins.cn |

**逻辑**：`detectChinaRegion()` 为 true 时，优先走 obplugins.cn，失败再回退 tecbinai.com 直连。

---

## 五、阿里云安全组

需放行的端口：

| 协议 | 端口 | 来源 | 用途 |
|------|------|------|------|
| TCP | 22 | 0.0.0.0/0 | SSH |
| TCP | 80 | 0.0.0.0/0 | HTTP（skills IP 访问 + HTTPS 重定向） |
| TCP | 443 | 0.0.0.0/0 | HTTPS（obplugins.cn 反代） |

---

## 六、部署验证清单

```bash
# 1. Skills API 正常（通过 IP）
curl -H "Authorization: Bearer openclawcnCN778" http://121.43.61.90/api/binaries/gh/windows-x64/gh_2.86.0_windows_amd64.zip
# 期望：200

# 2. HTTP → HTTPS 重定向
curl -sI http://www.obplugins.cn/
# 期望：301 Location: https://www.obplugins.cn/

# 3. 授权 API（不缓存）
curl -sk https://www.obplugins.cn/api/api/v1/license/health
# 期望：{"code":200,"status":"ok"}

# 4. 首页（缓存）
curl -sk -D - https://www.obplugins.cn/ | grep X-Cache
# 第1次：X-Cache-Status: MISS
# 第2次：X-Cache-Status: HIT

# 5. 页面域名替换
curl -sk https://www.obplugins.cn/ | grep -c obplugins.cn
# 期望：> 0
```

---

## 七、运维操作

### 清除缓存

```bash
# 清除所有缓存
rm -rf /var/cache/nginx/obplugins/*
nginx -s reload
```

### 查看日志

```bash
tail -f /var/log/nginx/obplugins-proxy.access.log
tail -f /var/log/nginx/obplugins-proxy.error.log
```

### 重启服务

```bash
# Host Nginx
systemctl restart nginx

# Docker Nginx (skills)
docker restart nginx
```

### 备份还原

```bash
# nginx.conf 备份在 /etc/nginx/nginx.conf.bak.orig
cp /etc/nginx/nginx.conf.bak.orig /etc/nginx/nginx.conf
nginx -t && systemctl reload nginx
```

---

## 八、注意事项

1. **SSL 证书续期**：阿里云免费证书 1 年有效（~2027-02），到期前重新申请并替换 `/etc/nginx/ssl/obplugins.cn/` 下的文件
2. **带宽成本**：所有流量经阿里云中转，注意监控出入流量
3. **备案合规**：确保中转内容符合 ICP 备案要求
4. **Docker 容器重建**：如 Docker Nginx 被重建，需确保端口映射为 `8880:80`（不是 `80:80`）
5. **缓存策略**：页面和静态资源缓存 5 分钟，API 请求不缓存。如需调整，修改 `proxy_cache_valid` 值
