#!/bin/bash
###############################################################################
# OpenClawCN 更新服务器一键配置脚本
#
# 用途: 在阿里云服务器上一键配置 Nginx 文件服务器,用于自动更新系统
#
# 使用方法:
#   1. SSH 登录服务器
#   2. 执行: bash <(curl -fsSL https://raw.githubusercontent.com/.../setup-update-server.sh)
#   或手动下载后执行: bash setup-update-server.sh
#
# 作者: OpenClawCN Team
# 版本: 1.0
###############################################################################

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    error "请使用 root 用户运行此脚本: sudo bash $0"
fi

echo ""
echo "========================================="
echo "  OpenClawCN 更新服务器配置脚本"
echo "========================================="
echo ""

# 1. 检测操作系统
info "检测操作系统..."
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
    info "操作系统: $OS $VERSION"
else
    error "无法检测操作系统"
fi

# 2. 安装 Nginx (如果未安装)
info "检查 Nginx..."
if ! command -v nginx &> /dev/null; then
    info "安装 Nginx..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt update
        apt install -y nginx
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        yum install -y nginx
    else
        error "不支持的操作系统: $OS"
    fi
    info "Nginx 安装完成"
else
    info "Nginx 已安装: $(nginx -v 2>&1)"
fi

# 3. 创建更新文件目录
info "创建更新文件目录..."
mkdir -p /var/www/updates/releases
mkdir -p /var/www/updates/mirrors

# 4. 设置权限
info "设置目录权限..."
chown -R www-data:www-data /var/www/updates 2>/dev/null || \
chown -R nginx:nginx /var/www/updates 2>/dev/null || \
chown -R nobody:nobody /var/www/updates

chmod -R 755 /var/www/updates

# 5. 询问域名或 IP
echo ""
read -p "请输入域名 (直接回车使用服务器IP): " DOMAIN

if [ -z "$DOMAIN" ]; then
    # 自动获取服务器公网 IP
    PUBLIC_IP=$(curl -s ifconfig.me || curl -s icanhazip.com || echo "")
    if [ -z "$PUBLIC_IP" ]; then
        read -p "无法自动获取IP,请手动输入服务器IP: " PUBLIC_IP
    fi
    SERVER_NAME=$PUBLIC_IP
    info "使用 IP: $SERVER_NAME"
else
    SERVER_NAME=$DOMAIN
    info "使用域名: $SERVER_NAME"
fi

# 6. 询问是否配置 HTTPS
echo ""
read -p "是否配置 HTTPS? (需要域名) [y/N]: " USE_HTTPS

# 7. 生成 Nginx 配置
info "生成 Nginx 配置..."

NGINX_CONF="/etc/nginx/sites-available/openclawcn-updates"

if [ "$USE_HTTPS" = "y" ] || [ "$USE_HTTPS" = "Y" ]; then
    # HTTPS 配置 (需要先申请证书)
    cat > $NGINX_CONF <<EOF
# OpenClawCN 更新服务器配置 (HTTPS)
server {
    listen 80;
    server_name $SERVER_NAME;

    # 重定向到 HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $SERVER_NAME;

    # SSL 证书 (需要手动申请)
    # 使用 Let's Encrypt: certbot --nginx -d $SERVER_NAME
    ssl_certificate /etc/letsencrypt/live/$SERVER_NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$SERVER_NAME/privkey.pem;

    # 文件服务根目录
    root /var/www/updates;

    # 允许大文件上传
    client_max_body_size 500M;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript;

    # 静态文件缓存
    location /releases/ {
        # 允许跨域
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, OPTIONS";

        # 浏览器缓存 7 天
        expires 7d;
        add_header Cache-Control "public, immutable";

        # 自动索引 (方便调试)
        autoindex on;
        autoindex_exact_size off;
        autoindex_localtime on;
    }

    # latest.json 不缓存
    location = /releases/latest.json {
        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        expires 0;
    }

    # 健康检查
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }
}
EOF

    warn "HTTPS 证书尚未安装,请稍后执行:"
    echo "   apt install certbot python3-certbot-nginx"
    echo "   certbot --nginx -d $SERVER_NAME"

else
    # HTTP 配置
    cat > $NGINX_CONF <<EOF
# OpenClawCN 更新服务器配置 (HTTP)
server {
    listen 80;
    server_name $SERVER_NAME;

    # 文件服务根目录
    root /var/www/updates;

    # 允许大文件上传
    client_max_body_size 500M;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript;

    # 静态文件缓存
    location /releases/ {
        # 允许跨域
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, OPTIONS";

        # 浏览器缓存 7 天
        expires 7d;
        add_header Cache-Control "public, immutable";

        # 自动索引 (方便调试)
        autoindex on;
        autoindex_exact_size off;
        autoindex_localtime on;
    }

    # latest.json 不缓存
    location = /releases/latest.json {
        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        expires 0;
    }

    # 健康检查
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }
}
EOF
fi

# 8. 启用配置
info "启用 Nginx 配置..."

# 创建软链接 (Debian/Ubuntu)
if [ -d "/etc/nginx/sites-enabled" ]; then
    ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
fi

# 测试配置
if nginx -t; then
    info "Nginx 配置测试通过"
else
    error "Nginx 配置测试失败,请检查配置文件: $NGINX_CONF"
fi

# 9. 重启 Nginx
info "重启 Nginx..."
systemctl restart nginx
systemctl enable nginx

# 10. 防火墙配置
info "配置防火墙..."
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    [ "$USE_HTTPS" = "y" ] && ufw allow 443/tcp
    info "已开放 HTTP 端口"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-service=http
    [ "$USE_HTTPS" = "y" ] && firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
    info "已开放 HTTP 端口"
else
    warn "未检测到防火墙,请手动开放端口 80"
fi

# 11. 创建测试文件
info "创建测试文件..."
cat > /var/www/updates/releases/latest.json <<EOF
{
  "version": "0.0.0",
  "buildTime": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "url": "http://$SERVER_NAME/releases/0.0.0/full.tar.gz",
  "message": "等待首次发布..."
}
EOF

# 12. 完成
echo ""
echo "========================================="
echo "  ✅ 配置完成!"
echo "========================================="
echo ""
info "更新服务器配置信息:"
echo "  - 服务地址: http://$SERVER_NAME"
echo "  - 文件目录: /var/www/updates/releases/"
echo "  - Nginx 配置: $NGINX_CONF"
echo ""
info "测试服务器:"
echo "  curl http://$SERVER_NAME/releases/latest.json"
echo "  curl http://$SERVER_NAME/health"
echo ""
info "下一步:"
echo "  1. 在 GitHub 仓库中配置 Secrets:"
echo "     - UPDATE_SERVER_HOST: $SERVER_NAME"
echo "     - UPDATE_SERVER_USER: root"
echo "     - UPDATE_SERVER_SSH_KEY: (你的SSH私钥)"
echo ""
echo "  2. 打 tag 触发发布:"
echo "     git tag v2026.2.18"
echo "     git push origin v2026.2.18"
echo ""
if [ "$USE_HTTPS" = "y" ]; then
    warn "HTTPS 证书配置:"
    echo "  apt install certbot python3-certbot-nginx"
    echo "  certbot --nginx -d $SERVER_NAME"
    echo ""
fi
echo "========================================="
