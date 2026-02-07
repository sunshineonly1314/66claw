#!/usr/bin/env bash
# ================================================================
# Clawdbot DEB 包构建脚本
# 构建适用于 Ubuntu/Debian 的 .deb 安装包
#
# 用法:
#   ./build-deb.sh [--arch x64|arm64] [--output DIR]
#
# 依赖:
#   dpkg-deb, fakeroot (可选)
# ================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# 默认参数
ARCH="x64"
OUTPUT_DIR="${OUTPUT_DIR:-$ROOT_DIR/build/linux-release}"
COMMON_DIR=""
NODE_VERSION="22.13.1"
MIRROR=""

# 解析参数
while [[ $# -gt 0 ]]; do
  case $1 in
    --arch)         ARCH="$2";        shift 2 ;;
    --output)       OUTPUT_DIR="$2";  shift 2 ;;
    --common-dir)   COMMON_DIR="$2";  shift 2 ;;
    --node-version) NODE_VERSION="$2"; shift 2 ;;
    --mirror)       MIRROR="$2";      shift 2 ;;
    *) shift ;;
  esac
done

# DEB 架构映射
case "$ARCH" in
  x64|amd64)    DEB_ARCH="amd64"; NODE_ARCH="x64" ;;
  arm64|aarch64) DEB_ARCH="arm64"; NODE_ARCH="arm64" ;;
  *) echo "不支持的架构: $ARCH" >&2; exit 1 ;;
esac

# 版本
VERSION=$(node -e "console.log(require('$ROOT_DIR/package.json').version)" 2>/dev/null || echo "0.0.0")
# DEB 版本格式: 不允许字母开头以外的特殊字符
DEB_VERSION=$(echo "$VERSION" | sed 's/[^0-9.]//g')
if [[ -z "$DEB_VERSION" ]]; then
  DEB_VERSION="1.0.0"
fi

PKG_NAME="clawdbot"
DEB_FILE="${PKG_NAME}_${DEB_VERSION}_${DEB_ARCH}.deb"

echo "构建 DEB 包: $DEB_FILE"
echo "  架构: $DEB_ARCH"
echo "  版本: $DEB_VERSION"

# Node.js 下载 URL
if [[ "$MIRROR" == "china" ]]; then
  NODE_BASE="https://npmmirror.com/mirrors/node/v${NODE_VERSION}"
else
  NODE_BASE="https://nodejs.org/dist/v${NODE_VERSION}"
fi

# 创建 DEB 目录结构
BUILD_DIR="$OUTPUT_DIR/.deb-build-${DEB_ARCH}"
rm -rf "$BUILD_DIR"

INSTALL_DIR="$BUILD_DIR/opt/clawdbot"
BIN_DIR="$BUILD_DIR/usr/local/bin"
SYSTEMD_DIR="$BUILD_DIR/etc/systemd/user"
DEBIAN_DIR="$BUILD_DIR/DEBIAN"

mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$SYSTEMD_DIR" "$DEBIAN_DIR"

# ─── 填充安装内容 ──────────────────────────────────────────────

# 下载并解压 Node.js
NODE_TARBALL="node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
NODE_CACHE="$OUTPUT_DIR/.cache/${NODE_TARBALL}"
mkdir -p "$OUTPUT_DIR/.cache"

if [[ ! -f "$NODE_CACHE" ]]; then
  echo "下载 Node.js..."
  curl -fsSL "${NODE_BASE}/${NODE_TARBALL}" -o "$NODE_CACHE"
fi

TEMP_NODE="$BUILD_DIR/temp-node"
mkdir -p "$TEMP_NODE"
tar -xJf "$NODE_CACHE" -C "$TEMP_NODE"
mv "$TEMP_NODE"/node-* "$INSTALL_DIR/node"
rm -rf "$TEMP_NODE"

# 复制应用文件
if [[ -n "$COMMON_DIR" ]] && [[ -d "$COMMON_DIR" ]]; then
  cp -r "$COMMON_DIR/dist" "$INSTALL_DIR/dist"
  cp "$COMMON_DIR/package.json" "$INSTALL_DIR/"
  cp -r "$COMMON_DIR/node_modules" "$INSTALL_DIR/node_modules"
  [[ -d "$COMMON_DIR/extensions" ]] && cp -r "$COMMON_DIR/extensions" "$INSTALL_DIR/"
  [[ -d "$COMMON_DIR/skills" ]] && cp -r "$COMMON_DIR/skills" "$INSTALL_DIR/"
else
  # 独立构建模式
  [[ -d "$ROOT_DIR/dist" ]] && cp -r "$ROOT_DIR/dist" "$INSTALL_DIR/dist"
  cp "$ROOT_DIR/package.json" "$INSTALL_DIR/"
  [[ -d "$ROOT_DIR/extensions" ]] && cp -r "$ROOT_DIR/extensions" "$INSTALL_DIR/"
  [[ -d "$ROOT_DIR/skills" ]] && cp -r "$ROOT_DIR/skills" "$INSTALL_DIR/"
  cd "$INSTALL_DIR"
  export PATH="$INSTALL_DIR/node/bin:$PATH"
  npm install --omit=dev --ignore-scripts 2>&1 | tail -5
fi

# ─── 创建 CLI 入口 ────────────────────────────────────────────

cat > "$BIN_DIR/clawdbot" << 'EOF'
#!/usr/bin/env bash
# Clawdbot CLI wrapper
export PATH="/opt/clawdbot/node/bin:$PATH"
exec /opt/clawdbot/node/bin/node /opt/clawdbot/dist/entry.js "$@"
EOF
chmod +x "$BIN_DIR/clawdbot"

# ─── 创建 systemd 用户服务 ─────────────────────────────────────

cat > "$SYSTEMD_DIR/clawdbot.service" << EOF
[Unit]
Description=Clawdbot AI Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/clawdbot
ExecStart=/opt/clawdbot/node/bin/node /opt/clawdbot/dist/entry.js gateway run --port 18789 --allow-unconfigured
ExecReload=/bin/kill -USR1 \$MAINPID
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

StandardOutput=journal
StandardError=journal
SyslogIdentifier=clawdbot

NoNewPrivileges=true

[Install]
WantedBy=default.target
EOF

# ─── 创建 DEBIAN 控制文件 ──────────────────────────────────────

# 计算安装大小 (KB)
INSTALLED_SIZE=$(du -sk "$BUILD_DIR" | cut -f1)

cat > "$DEBIAN_DIR/control" << EOF
Package: ${PKG_NAME}
Version: ${DEB_VERSION}
Section: net
Priority: optional
Architecture: ${DEB_ARCH}
Installed-Size: ${INSTALLED_SIZE}
Depends: libc6 (>= 2.17), libstdc++6
Maintainer: Clawdbot Team <support@tecbinai.com>
Homepage: https://www.tecbinai.com/
Description: Clawdbot AI Gateway - 个人AI助手网关
 Clawdbot 是一个多渠道 AI 助手网关，支持通过
 Web界面进行配置，连接多种AI模型和消息渠道。
 .
 安装后访问 http://localhost:18789/setup 进行配置。
EOF

# postinst 脚本
cat > "$DEBIAN_DIR/postinst" << 'EOF'
#!/bin/bash
set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Clawdbot 安装完成！                    ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  快速开始:"
echo "    clawdbot gateway run     # 启动服务"
echo ""
echo "  或安装为系统服务:"
echo "    systemctl --user daemon-reload"
echo "    systemctl --user enable clawdbot"
echo "    systemctl --user start clawdbot"
echo ""
echo "  配置向导: http://localhost:18789/setup"
echo ""

# 创建日志目录 (当前用户可写)
mkdir -p /opt/clawdbot/logs
chmod 755 /opt/clawdbot/logs

exit 0
EOF
chmod +x "$DEBIAN_DIR/postinst"

# prerm 脚本
cat > "$DEBIAN_DIR/prerm" << 'EOF'
#!/bin/bash
set -e

# 停止服务（用户级）
systemctl --user stop clawdbot 2>/dev/null || true
systemctl --user disable clawdbot 2>/dev/null || true

# 停止其他可能运行的实例
pkill -f "clawdbot.*gateway" 2>/dev/null || true

exit 0
EOF
chmod +x "$DEBIAN_DIR/prerm"

# postrm 脚本
cat > "$DEBIAN_DIR/postrm" << 'EOF'
#!/bin/bash
set -e

if [ "$1" = "purge" ]; then
  rm -rf /opt/clawdbot
  echo "已清除 Clawdbot 安装目录"
  echo "配置文件保留在: ~/.clawdbot"
fi

exit 0
EOF
chmod +x "$DEBIAN_DIR/postrm"

# ─── 构建 DEB 包 ──────────────────────────────────────────────

echo "构建 DEB 包..."
if command -v fakeroot &>/dev/null; then
  fakeroot dpkg-deb --build "$BUILD_DIR" "$OUTPUT_DIR/$DEB_FILE"
else
  dpkg-deb --build "$BUILD_DIR" "$OUTPUT_DIR/$DEB_FILE"
fi

# 清理
rm -rf "$BUILD_DIR"

echo "DEB 包已生成: $OUTPUT_DIR/$DEB_FILE"
echo "安装方式: sudo dpkg -i $DEB_FILE"
