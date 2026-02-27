# ClawdbotCN 服务器迁移方案

> 编制日期：2026-02-19
> 状态：待执行

---

## 一、目标架构

```
www.obplugins.cn (DNS → 90)
         │
┌────────▼─────────────────────────────────┐
│  90 杭州 121.43.61.90 — 流量入口+应用层    │
│                                          │
│  Nginx :443 (SSL 入口 + upstream 路由)    │
│  Java :8080 (TecbinHome + SkillsProxy)   │
│  前端静态页 /data/frontend/               │
│  镜像包副本 /data/binaries/ releases/     │
│  下载权重: 30%                            │
└──────────┬───────────────────────────────┘
           │ least_conn (0.03s)
┌──────────▼───────────────────────────────┐
│  253 上海 106.15.198.253 — 下载主力+数据层 │
│                                          │
│  Nginx :80 (下载服务, 权重 70%)           │
│  MySQL 裸装 :3306 (tecbinai + obplugins) │
│  镜像包主存储 /data/binaries/ releases/   │
│  FRP :7000 + CI/CD webhook              │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  香港 43.129.194.117 — 纯拉包机           │
│  sync.py → rsync → 253上海 → 90杭州      │
│  (关闭 Java + MySQL, 仅保留 Nginx+sync)  │
└──────────────────────────────────────────┘
```

---

## 二、香港 MySQL 数据备份（核心资产，第一优先）

### 2.1 数据概况

- **MySQL 版本**: 8.0.45 (Docker 容器 `tecbinai-mysql`)
- **密码**: `sunbingood@123`
- **字符集**: utf8mb4 / utf8mb4_unicode_ci
- **Binlog**: ON (binlog.000002, position 55043808)
- **数据目录**: /data/mysql/data (bind mount 到容器)
- **总大小**: 326MB (含系统库), 业务数据 ~17MB

### 2.2 核心表清单

| 表名 | 行数 | 大小 | 重要性 |
|------|------|------|--------|
| **verification_keys** | 1,572 | 0.53MB | 最核心 — 用户秘钥 |
| **key_devices** | 442 | 0.14MB | 最核心 — 设备绑定 |
| **users** | 87 | 0.05MB | 最核心 — 用户账号 |
| **key_sales** | 1 | 0.06MB | 核心 — 销售记录 |
| **app_version_config** | 1 | 0.02MB | 重要 — 版本配置 |
| **system_config** | 1 | 0.03MB | 重要 — 系统配置 |
| **skills** | 578 | 8.80MB | 重要 — 技能列表 |
| **support_qrcode_groups** | 4 | 1.03MB | 一般 |
| **client_feedback** | 32 | 2.59MB | 一般 |
| **system_notifications** | 0 | 0.02MB | 空表 |
| **notification_read_log** | 0 | 0.02MB | 空表 |
| **feedback** | 0 | 0.05MB | 空表 |
| **sync_state** | 1 | 0.03MB | 一般 |
| **request_nonce_log** | 35,682 | 3.52MB | 可清理 — 防重放日志 |

### 2.3 四层备份策略（不停服）

#### 第一层：mysqldump 逻辑备份（主备份）

```bash
# 在香港 43.129.194.117 执行

mkdir -p /root/backup

# --single-transaction: InnoDB 一致性快照, 不锁表, 不停服
docker exec tecbinai-mysql mysqldump \
  -uroot -p'sunbingood@123' \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --set-gtid-purged=OFF \
  --default-character-set=utf8mb4 \
  tecbinai > /root/backup/tecbinai_full_$(date +%Y%m%d_%H%M%S).sql
```

#### 第二层：验证备份完整性

```bash
BACKUP_FILE=$(ls -t /root/backup/tecbinai_full_*.sql | head -1)

# 1. 文件大小 (应 > 500KB)
ls -lh "$BACKUP_FILE"

# 2. 文件尾部有 "Dump completed" (完整标志)
tail -3 "$BACKUP_FILE"

# 3. 14 张表都在
TABLE_COUNT=$(grep -c "CREATE TABLE" "$BACKUP_FILE")
echo "Tables: $TABLE_COUNT (should be 14)"

# 4. 关键表有数据
grep -c "INSERT INTO \`verification_keys\`" "$BACKUP_FILE"
grep -c "INSERT INTO \`users\`" "$BACKUP_FILE"
grep -c "INSERT INTO \`key_devices\`" "$BACKUP_FILE"
```

#### 第三层：物理文件拷贝（兜底）

```bash
# 拷贝 MySQL 数据目录 (InnoDB 支持热拷贝)
cp -a /data/mysql/data/ /root/backup/mysql_data_physical_$(date +%Y%m%d)/

# 验证大小 (~326MB)
du -sh /root/backup/mysql_data_physical_*/
```

#### 第四层：异地分发（3 个位置）

```bash
BACKUP_FILE=$(ls -t /root/backup/tecbinai_full_*.sql | head -1)

# 发到上海 253
scp "$BACKUP_FILE" root@106.15.198.253:/root/backup/

# 发到杭州 90
scp "$BACKUP_FILE" root@121.43.61.90:/root/backup/

# 发到本地 Windows (在本地执行)
# scp root@43.129.194.117:/root/backup/tecbinai_full_*.sql E:\openclawcn\backup\
```

### 2.4 迁移期间自动备份 (cron)

```bash
# 在香港执行 — 每小时自动备份, 保留 48 小时
(crontab -l 2>/dev/null; cat << 'CRON'
0 * * * * docker exec tecbinai-mysql mysqldump -uroot -p'sunbingood@123' --single-transaction --set-gtid-purged=OFF tecbinai > /root/backup/tecbinai_hourly_$(date +\%Y\%m\%d_\%H).sql 2>/dev/null
5 * * * * find /root/backup/ -name "tecbinai_hourly_*.sql" -mtime +2 -delete
CRON
) | crontab -
```

### 2.5 备份验证清单

```
□ SQL 文件大小 > 500KB
□ 文件末尾有 "Dump completed on 2026-02-XX"
□ CREATE TABLE 数量 = 14
□ verification_keys INSERT 存在
□ users INSERT 存在
□ key_devices INSERT 存在
□ 备份存在于: 香港 + 上海 + 杭州 (3份)
□ 物理备份目录 ~326MB
```

---

## 三、杭州 (90) obplugins MySQL 备份

```bash
# 在杭州 121.43.61.90 执行

mkdir -p /root/backup

docker exec new_mysql mysqldump \
  -uroot -p'MyNewPass123!' \
  --single-transaction \
  --set-gtid-purged=OFF \
  --default-character-set=utf8mb4 \
  obplugins > /root/backup/obplugins_full_$(date +%Y%m%d_%H%M%S).sql

# 验证
ls -lh /root/backup/obplugins_full_*.sql
tail -3 /root/backup/obplugins_full_*.sql

# 发到上海
scp /root/backup/obplugins_full_*.sql root@106.15.198.253:/root/backup/
```

---

## 四、执行步骤

### 步骤 1: 杭州应急 — 加 Swap + 清理磁盘

```bash
# SSH root@121.43.61.90 (密码: sunbingood@123)

# ── 加 2G Swap ──
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 验证
free -h
# Swap: 2.0Gi

# ── 清理磁盘 ──
rm /root/obplugins/data.zip       # 2.3G 旧备份
rm /root/miniconda.sh              # 144MB 安装包
docker rm wewe-rss                 # 已停容器
docker rmi cooderl/wewe-rss:latest # 331MB 镜像

# 验证
df -h
# 预期: 66% → ~55%
```

### 步骤 2: 香港 MySQL 热备份

```bash
# SSH root@43.129.194.117 (密码: Sunbingood123)

# 执行上面第二节的全部备份操作
# 完成后确认验证清单全部通过
```

### 步骤 3: 杭州 obplugins 备份

```bash
# SSH root@121.43.61.90

# 执行上面第三节的备份操作
```

### 步骤 4: 上海裸装 MySQL

```bash
# SSH root@106.15.198.253 (密码: sunbingood@123)

# ── 安装 MySQL 8.0 ──
yum install -y mysql-server
systemctl enable mysqld
systemctl start mysqld

# ── 内存优化配置 ──
cat > /etc/my.cnf.d/optimize.cnf << 'EOF'
[mysqld]
innodb_buffer_pool_size = 128M
max_connections = 100
performance_schema = OFF
table_open_cache = 200
tmp_table_size = 16M
max_heap_table_size = 16M
character_set_server = utf8mb4
collation_server = utf8mb4_unicode_ci
bind-address = 0.0.0.0
EOF

systemctl restart mysqld

# ── 设置密码 + 创建远程用户 ──
mysqladmin -uroot password 'sunbingood@123'

mysql -uroot -p'sunbingood@123' << 'SQL'
CREATE USER 'clawdbot'@'%' IDENTIFIED BY 'clawdbot_db_2026';
GRANT ALL PRIVILEGES ON tecbinai.* TO 'clawdbot'@'%';
GRANT ALL PRIVILEGES ON obplugins.* TO 'clawdbot'@'%';
FLUSH PRIVILEGES;
SQL

# ── 阿里云安全组 ──
# 控制台放行 TCP 3306, 来源限 121.43.61.90
```

### 步骤 5: 上海装 Nginx + 下载服务

```bash
# SSH root@106.15.198.253

yum install -y nginx
systemctl enable nginx

mkdir -p /data/{releases,binaries}

cat > /etc/nginx/conf.d/download.conf << 'EOF'
server {
    listen 80;
    server_name 106.15.198.253;

    location /releases/ {
        alias /data/releases/;
        default_type application/octet-stream;
        sendfile on;
        tcp_nopush on;
        tcp_nodelay on;
        add_header Cache-Control "public, max-age=3600";
    }

    location /binaries/ {
        alias /data/binaries/;
        default_type application/octet-stream;
        sendfile on;
        tcp_nopush on;
        tcp_nodelay on;
        add_header Cache-Control "public, max-age=86400";
    }

    location /health {
        return 200 'ok';
        add_header Content-Type text/plain;
    }
}
EOF

nginx -t && systemctl start nginx
```

### 步骤 6: 数据导入上海 MySQL

```bash
# SSH root@106.15.198.253

# ── 导入 tecbinai (香港核心数据) ──
mysql -uroot -p'sunbingood@123' -e \
  "CREATE DATABASE tecbinai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

BACKUP_FILE=$(ls -t /root/backup/tecbinai_full_*.sql | head -1)
mysql -uroot -p'sunbingood@123' tecbinai < "$BACKUP_FILE"

# ── 导入 obplugins (杭州包记录) ──
mysql -uroot -p'sunbingood@123' -e \
  "CREATE DATABASE obplugins CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

BACKUP_FILE=$(ls -t /root/backup/obplugins_full_*.sql | head -1)
mysql -uroot -p'sunbingood@123' obplugins < "$BACKUP_FILE"

# ── 验证 ──
mysql -uroot -p'sunbingood@123' -e "
SELECT 'users' AS tbl, COUNT(*) AS cnt FROM tecbinai.users
UNION ALL SELECT 'verification_keys', COUNT(*) FROM tecbinai.verification_keys
UNION ALL SELECT 'key_devices', COUNT(*) FROM tecbinai.key_devices
UNION ALL SELECT 'key_sales', COUNT(*) FROM tecbinai.key_sales;
"
# 期望: users=87, verification_keys=1572, key_devices=442, key_sales=1

mysql -uroot -p'sunbingood@123' -e "USE obplugins; SHOW TABLES;"
```

### 步骤 7: 杭州 Java 改连上海 MySQL

```bash
# SSH root@121.43.61.90

# ── TecbinHome: 改 JDBC 连接 ──
# 编辑 /root/tecbinai/start.sh 或 application.yml
# 把 localhost:3306 → 106.15.198.253:3306
# 数据库用户: clawdbot / clawdbot_db_2026

# ── SkillsProxy: 同理改 JDBC ──
# 编辑 /root/clawdskills/start.sh 或配置
# 把 localhost:33066 → 106.15.198.253:3306

# ── 重启 Java 服务 ──
# (具体命令取决于启动方式)
```

### 步骤 8: 杭州 Nginx 改最终配置

```bash
# SSH root@121.43.61.90

# 备份旧配置
cp /etc/nginx/conf.d/obplugins-proxy.conf \
   /etc/nginx/conf.d/obplugins-proxy.conf.bak.pre-migration

# 写新配置
cat > /etc/nginx/conf.d/obplugins.conf << 'NGINX'
# ── 下载负载均衡池 ──
upstream download_backend {
    least_conn;
    server 127.0.0.1:8880  max_fails=3 fail_timeout=15s;
    server 106.15.198.253:80 weight=2 max_fails=3 fail_timeout=15s;
    keepalive 16;
}

# ── HTTP → HTTPS ──
server {
    listen 80;
    server_name www.obplugins.cn obplugins.cn;
    return 301 https://$host$request_uri;
}

# ── IP 直连 ──
server {
    listen 80;
    server_name 121.43.61.90;
    location / {
        proxy_pass http://127.0.0.1:8880;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# ── 主站 HTTPS ──
server {
    listen 443 ssl http2;
    server_name www.obplugins.cn obplugins.cn;

    ssl_certificate     /etc/nginx/ssl/obplugins.cn/www.obplugins.cn.pem;
    ssl_certificate_key /etc/nginx/ssl/obplugins.cn/www.obplugins.cn.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;

    root /data/frontend;
    index index.html;

    # API → 本地 Java
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }

    # 构建产物下载 → 智能分流 (上海70% 本机30%)
    location /releases/ {
        proxy_pass http://download_backend/releases/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_connect_timeout 5s;
        proxy_read_timeout 300s;
        proxy_next_upstream error timeout http_502 http_503;
    }

    # 二进制镜像下载 → 智能分流
    location /api/binaries/ {
        if ($http_authorization != "Bearer clawdbotCN778") {
            return 401;
        }
        proxy_pass http://download_backend/binaries/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_connect_timeout 5s;
        proxy_read_timeout 300s;
        proxy_next_upstream error timeout http_502 http_503;
    }

    # 静态资源长缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    access_log /var/log/nginx/obplugins.access.log;
    error_log /var/log/nginx/obplugins.error.log;
}

# ── 本机下载服务 (供 upstream) ──
server {
    listen 8880;
    location /releases/ {
        alias /data/releases/;
        default_type application/octet-stream;
        sendfile on;
        tcp_nopush on;
    }
    location /binaries/ {
        alias /data/binaries/;
        default_type application/octet-stream;
        sendfile on;
        tcp_nopush on;
    }
    location /health {
        return 200 'ok';
        add_header Content-Type text/plain;
    }
}
NGINX

# 删除旧配置
rm -f /etc/nginx/conf.d/obplugins-proxy.conf

# 测试 + 生效
nginx -t && systemctl reload nginx
```

### 步骤 9: 杭州关 Docker MySQL

```bash
# SSH root@121.43.61.90

# 只 stop, 不 delete (保留一周回滚用)
docker stop new_mysql
```

### 步骤 10: 香港配 rsync 推送链路

```bash
# SSH root@43.129.194.117

# ── SSH Key 免密 ──
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@106.15.198.253
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@121.43.61.90

# ── 推送脚本 ──
cat > /opt/sync-and-push.sh << 'EOF'
#!/bin/bash
# 1. 从 GitHub 拉包
python3 /opt/binaries-sync/sync.py >> /var/log/binaries-sync/sync.log 2>&1

# 2. 推到上海 (主存储)
rsync -avz --delete /data/binaries/ root@106.15.198.253:/data/binaries/

# 3. 推到杭州 (副本)
rsync -avz --delete /data/binaries/ root@121.43.61.90:/data/binaries/
EOF
chmod +x /opt/sync-and-push.sh

# ── 替换 cron ──
# 删旧的 sync.py cron, 换新的
(crontab -l 2>/dev/null | grep -v sync.py; echo "0 * * * * /opt/sync-and-push.sh >> /var/log/binaries-sync/push.log 2>&1") | crontab -
```

### 步骤 11: 香港瘦身（确认切换稳定后）

```bash
# SSH root@43.129.194.117

# ── 确认杭州已完全接管后再执行 ──

# 关 Java
systemctl stop tecbinai
systemctl disable tecbinai

# 关 MySQL (只 stop, 不 rm, 保留一周)
docker stop tecbinai-mysql

# 删除每小时备份 cron (迁移完成后不再需要)
crontab -l | grep -v tecbinai_hourly | crontab -
```

### 步骤 12: 内核调优 (两台国内服务器都做)

```bash
# 杭州 90 + 上海 253 都执行

cat >> /etc/sysctl.conf << 'EOF'
net.ipv4.tcp_max_syn_backlog = 2048
net.core.somaxconn = 4096
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.ip_local_port_range = 10000 65535
EOF

sysctl -p
```

### 步骤 13: 全链路验证

```bash
# ── 秘钥校验 ──
curl -sk https://www.obplugins.cn/api/api/v1/license/health
# 期望: {"code":200,"status":"ok"}

# ── Skills API ──
curl -sk https://www.obplugins.cn/api/skills/list | head -100

# ── 下载分流 (连续 10 次看分到哪) ──
for i in $(seq 1 10); do
  curl -sI https://www.obplugins.cn/releases/latest.json 2>/dev/null | grep -i server
done

# ── 大文件下载速度 ──
curl -o /dev/null -w "speed: %{speed_download} bytes/sec\n" \
  -H "Authorization: Bearer clawdbotCN778" \
  https://www.obplugins.cn/api/binaries/ordercli/latest/ordercli-linux-amd64

# ── MySQL 数据完整性 ──
# 在上海 253 执行
mysql -uroot -p'sunbingood@123' -e "
SELECT 'users' AS tbl, COUNT(*) AS cnt FROM tecbinai.users
UNION ALL SELECT 'keys', COUNT(*) FROM tecbinai.verification_keys
UNION ALL SELECT 'devices', COUNT(*) FROM tecbinai.key_devices;
"
# 期望: users=87, keys=1572, devices=442

# ── 故障转移测试 ──
# 关上海 Nginx → 杭州应能独立扛住下载
ssh root@106.15.198.253 "systemctl stop nginx"
curl -sk https://www.obplugins.cn/releases/latest.json
# 应该仍然返回 (走杭州本机 :8880)
ssh root@106.15.198.253 "systemctl start nginx"
```

---

## 五、回滚方案

| 故障 | 回滚操作 | 耗时 |
|------|---------|------|
| 上海 MySQL 数据有误 | 杭州 `docker start new_mysql`, Java 改回连 localhost:33066 | 2分钟 |
| 杭州 Nginx 配错 | `cp obplugins-proxy.conf.bak.pre-migration obplugins-proxy.conf && nginx -s reload` | 10秒 |
| 杭州 Java 连不上上海 | 改回连本地 Docker MySQL | 1分钟 |
| 香港不能关 | 不关, 保持原样, 两边同时跑 | 0 |

**原则: 旧服务只 stop 不 delete, 保留至少一周。**

---

## 六、时间线

| 时间 | 步骤 | 停服 | 风险 |
|------|------|------|------|
| T+0 | 香港 MySQL 热备份 + 验证 + 分发 | 无 | 零 |
| T+10min | 杭州 obplugins 备份 + 分发 | 无 | 零 |
| T+15min | 杭州加 Swap + 清理磁盘 | 无 | 零 |
| T+25min | 上海装 MySQL + Nginx | 无 | 零 |
| T+35min | 上海导入数据 + 验证行数 | 无 | 零 |
| T+40min | **杭州 Java 切换 MySQL 连接** | **~2min** | 中 |
| T+45min | **杭州 Nginx 切新配置** | **~10s** | 中 |
| T+50min | 杭州关 Docker MySQL | 无 | 低 |
| T+55min | 全链路验证 | 无 | — |
| T+1天 | 确认稳定 → 香港关 Java/MySQL | 无 | 低 |
| T+7天 | 清理旧容器/镜像/备份 | 无 | — |

**总停服: ~2 分钟 (Java 重启期间)**

---

## 七、迁移后日常运维

### 包同步链路
```
香港 sync.py (每小时从 GitHub 拉包)
  → rsync → 上海 /data/binaries/ (主)
  → rsync → 杭州 /data/binaries/ (副本)
```

### 构建产物链路
```
Windows/Mac 构建完成
  → SCP → 上海 /data/releases/ (CI/CD 在上海)
  → rsync → 杭州 /data/releases/ (副本)
```

### MySQL 定期备份
```bash
# 上海 253 crontab
0 3 * * * mysqldump -uroot -p'sunbingood@123' --single-transaction tecbinai > /root/backup/tecbinai_daily_$(date +\%Y\%m\%d).sql
0 3 * * * mysqldump -uroot -p'sunbingood@123' --single-transaction obplugins > /root/backup/obplugins_daily_$(date +\%Y\%m\%d).sql
5 3 * * * find /root/backup/ -name "*_daily_*.sql" -mtime +7 -delete
```
