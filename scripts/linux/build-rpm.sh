#!/usr/bin/env bash
# ================================================================
# OpenClawCN RPM 包构建脚本
# 构建适用于 CentOS/RHEL/Fedora 的 .rpm 安装包
#
# 用法:
#   ./build-rpm.sh [--arch x64|arm64] [--output DIR]
#
# 依赖:
#   rpmbuild (rpm-build 包)
# ================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# 默认参数
ARCH="x64"
OUTPUT_DIR="${OUTPUT_DIR:-$ROOT_DIR/build/linux-release}"
COMMON_DIR=""
NODE_VERSION="22.16.0"
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

# RPM 架构映射
case "$ARCH" in
  x64|amd64|x86_64) RPM_ARCH="x86_64"; NODE_ARCH="x64" ;;
  arm64|aarch64)     RPM_ARCH="aarch64"; NODE_ARCH="arm64" ;;
  *) echo "不支持的架构: $ARCH" >&2; exit 1 ;;
esac

# 版本
VERSION=$(node -e "console.log(require('$ROOT_DIR/package.json').version)" 2>/dev/null || echo "0.0.0")
RPM_VERSION=$(echo "$VERSION" | sed 's/[^0-9.]//g')
if [[ -z "$RPM_VERSION" ]]; then
  RPM_VERSION="1.0.0"
fi

PKG_NAME="openclawcn"

echo "构建 RPM 包"
echo "  架构: $RPM_ARCH"
echo "  版本: $RPM_VERSION"

# Node.js 下载
if [[ "$MIRROR" == "china" ]]; then
  NODE_BASE="https://npmmirror.com/mirrors/node/v${NODE_VERSION}"
else
  NODE_BASE="https://nodejs.org/dist/v${NODE_VERSION}"
fi

# 创建 rpmbuild 目录结构
RPM_ROOT="$OUTPUT_DIR/.rpm-build-${RPM_ARCH}"
rm -rf "$RPM_ROOT"
mkdir -p "$RPM_ROOT"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}

# 准备源代码 tarball
SRC_DIR="$RPM_ROOT/BUILD/${PKG_NAME}-${RPM_VERSION}"
INSTALL_DIR="$SRC_DIR/opt/openclawcn"
mkdir -p "$INSTALL_DIR" "$SRC_DIR/usr/local/bin" "$SRC_DIR/etc/systemd/user"

# 下载并解压 Node.js
NODE_TARBALL="node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
NODE_CACHE="$OUTPUT_DIR/.cache/${NODE_TARBALL}"
mkdir -p "$OUTPUT_DIR/.cache"

if [[ ! -f "$NODE_CACHE" ]]; then
  echo "下载 Node.js..."
  curl -fsSL "${NODE_BASE}/${NODE_TARBALL}" -o "$NODE_CACHE"
fi

TEMP_NODE="$RPM_ROOT/temp-node"
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
  [[ -d "$ROOT_DIR/dist" ]] && cp -r "$ROOT_DIR/dist" "$INSTALL_DIR/dist"
  cp "$ROOT_DIR/package.json" "$INSTALL_DIR/"
  cd "$INSTALL_DIR"
  export PATH="$INSTALL_DIR/node/bin:$PATH"
  npm install --omit=dev --ignore-scripts 2>&1 | tail -5
fi

# CLI 入口
cat > "$SRC_DIR/usr/local/bin/openclawcn" << 'EOF'
#!/usr/bin/env bash
export PATH="/opt/openclawcn/node/bin:$PATH"
exec /opt/openclawcn/node/bin/node /opt/openclawcn/dist/entry.js "$@"
EOF
chmod +x "$SRC_DIR/usr/local/bin/openclawcn"

# systemd 服务
cat > "$SRC_DIR/etc/systemd/user/openclawcn.service" << EOF
[Unit]
Description=OpenClawCN AI Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/openclawcn
ExecStart=/opt/openclawcn/node/bin/node /opt/openclawcn/dist/entry.js gateway run --port 18789 --allow-unconfigured
ExecReload=/bin/kill -USR1 \$MAINPID
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal
SyslogIdentifier=openclawcn
NoNewPrivileges=true

[Install]
WantedBy=default.target
EOF

# 创建 SPEC 文件
cat > "$RPM_ROOT/SPECS/${PKG_NAME}.spec" << SPEC
Name:           ${PKG_NAME}
Version:        ${RPM_VERSION}
Release:        1%{?dist}
Summary:        OpenClawCN AI Gateway - 个人AI助手网关
License:        MIT
URL:            https://www.tecbinai.com/
AutoReqProv:    no

%description
OpenClawCN 是一个多渠道 AI 助手网关，支持通过
Web界面进行配置，连接多种AI模型和消息渠道。

安装后访问 http://localhost:18789/setup 进行配置。

%install
cp -a %{_builddir}/${PKG_NAME}-${RPM_VERSION}/* %{buildroot}/

%files
%dir /opt/openclawcn
/opt/openclawcn/*
/usr/local/bin/openclawcn
/etc/systemd/user/openclawcn.service

%post
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   OpenClawCN 安装完成！                    ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  快速开始: openclawcn gateway run"
echo "  配置向导: http://localhost:18789/setup"
echo ""
mkdir -p /opt/openclawcn/logs
chmod 755 /opt/openclawcn/logs

%preun
systemctl --user stop openclawcn 2>/dev/null || true
systemctl --user disable openclawcn 2>/dev/null || true
pkill -f "openclawcn.*gateway" 2>/dev/null || true
SPEC

# 构建 RPM
echo "构建 RPM 包..."
rpmbuild --define "_topdir $RPM_ROOT" \
  --define "_builddir $RPM_ROOT/BUILD" \
  --target "$RPM_ARCH" \
  -bb "$RPM_ROOT/SPECS/${PKG_NAME}.spec"

# 复制输出
RPM_FILE=$(find "$RPM_ROOT/RPMS" -name "*.rpm" | head -1)
if [[ -n "$RPM_FILE" ]]; then
  cp "$RPM_FILE" "$OUTPUT_DIR/"
  echo "RPM 包已生成: $OUTPUT_DIR/$(basename "$RPM_FILE")"
  echo "安装方式: sudo rpm -i $(basename "$RPM_FILE")"
fi

# 清理
rm -rf "$RPM_ROOT"
