# Clawdbot Linux 一键安装包构建方案

> 本文档描述 Clawdbot Linux 版本的打包、分发和更新策略。

---

## 目录

- [版本概述](#版本概述)
- [Clawdbot Lite（轻量版）](#clawdbot-lite轻量版)
- [Clawdbot Pro（专业版）](#clawdbot-pro专业版)
- [安装方式对比](#安装方式对比)
- [增量更新机制](#增量更新机制)
- [构建脚本](#构建脚本)
- [安装流程](#安装流程)
- [目录结构](#目录结构)
- [系统要求](#系统要求)
- [常见问题](#常见问题)

---

## 版本概述

| 版本 | 目标场景 | 沙盒类型 | 安装包大小 | 适合用户 |
|------|---------|---------|-----------|---------|
| **Clawdbot Lite** | 独立服务器 / 废弃设备 | Linux 轻量沙盒 (可选) | ~80 MB | 有专用服务器、追求简单 |
| **Clawdbot Pro** | 共享服务器 / 生产环境 | Docker 容器沙盒 | 主程序 ~80MB + Docker 镜像 ~200MB | 需要严格隔离保护 |

### 版本选择指南

```
┌─────────────────────────────────────────────────────────────────────┐
│                      选择适合你的版本                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Q1: 这是什么类型的服务器？                                          │
│                                                                     │
│     A) 专用/废弃服务器 ──► Clawdbot Lite（可关闭沙盒）               │
│        • 只运行 Clawdbot                                            │
│        • 不怕 AI 直接访问系统                                        │
│        • 追求最低资源占用                                            │
│                                                                     │
│     B) 共享/生产服务器 ──► 继续回答 Q2                               │
│        • 还运行其他服务                                              │
│        • 需要保护系统资源                                            │
│        • 多用户环境                                                  │
│                                                                     │
│  Q2: 服务器已经安装了 Docker 吗？                                    │
│                                                                     │
│     A) 已安装 ──► Clawdbot Pro 主程序包 (~80MB)                     │
│     B) 未安装 ──► Clawdbot Pro + Docker 安装脚本                    │
│                   或 使用一键安装脚本自动处理                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 场景决策矩阵

| 服务器类型 | 推荐版本 | 沙盒建议 | 理由 |
|-----------|---------|---------|------|
| **废弃/闲置服务器** | Lite | 可关闭 | 专用设备，风险可控 |
| **专用 Clawdbot 服务器** | Lite | 轻量沙盒 | 基础保护即可 |
| **开发服务器** | Pro | Docker 沙盒 | 保护开发环境 |
| **生产服务器** | Pro | Docker 沙盒 | 严格隔离必需 |
| **多用户服务器** | Pro | Docker 沙盒 | 保护其他用户数据 |
| **容器化环境 (K8s)** | Pro | 容器原生 | 自然隔离 |

---

## Clawdbot Lite（轻量版）

### 产品定位

- **目标用户**：有独立服务器的用户、废弃设备部署、追求轻量安装
- **安全策略**：Linux 原生轻量沙盒（可选）或无沙盒
- **特点**：安装快、资源占用少、无需 Docker

### 轻量沙盒机制

Lite 版采用 Linux 原生安全机制实现轻量沙盒：

| 保护层 | 实现方式 | 保护范围 |
|--------|---------|---------|
| **目录隔离** | chroot / 工作目录限制 | 防止访问系统文件 |
| **用户隔离** | 专用 `clawdbot` 用户 | 最小权限运行 |
| **路径白名单** | AppArmor / seccomp | 限制可访问路径 |
| **命令过滤** | 禁止危险命令 (rm -rf /, dd, etc.) | 防止破坏性操作 |
| **资源限制** | cgroups / ulimit | CPU/内存/进程限制 |
| **网络限制** | iptables (可选) | 限制出站连接 |

#### 沙盒配置文件 (`config/sandbox-lite.json`)

```json
{
  "enabled": true,
  "mode": "lite",
  "workspace": {
    "root": "/opt/clawdbot/workspace",
    "allowedPaths": [
      "/opt/clawdbot/workspace",
      "/opt/clawdbot/temp",
      "/tmp/clawdbot"
    ]
  },
  "user": {
    "name": "clawdbot",
    "group": "clawdbot",
    "home": "/opt/clawdbot"
  },
  "commands": {
    "blocked": [
      "rm -rf /", "dd if=", "mkfs", "fdisk",
      "shutdown", "reboot", "init", "systemctl",
      "passwd", "useradd", "userdel", "chmod 777",
      "chown root", "sudo", "su -"
    ],
    "shellRestricted": true
  },
  "resources": {
    "maxMemoryMB": 512,
    "maxCpuPercent": 50,
    "maxProcesses": 50,
    "maxOpenFiles": 1024
  },
  "network": {
    "restrictOutbound": false,
    "allowedHosts": []
  }
}
```

### 包含组件

| 组件 | 版本 | 压缩大小 | 解压大小 |
|------|------|---------|---------|
| Node.js Portable | v22.x LTS | 20 MB | 70 MB |
| Clawdbot 核心 | latest | 15 MB | 40 MB |
| node_modules (生产依赖) | - | 35 MB | 120 MB |
| 内置扩展 (extensions) | 全部 | 8 MB | 25 MB |
| 轻量沙盒模块 | - | 2 MB | 5 MB |
| 配置脚本 + 服务文件 | - | 1 MB | 2 MB |
| **总计** | - | **~80 MB** | **~260 MB** |

### 安装包格式

| 格式 | 大小 | 说明 | 适用发行版 |
|------|------|------|-----------|
| `clawdbot-lite-vX.X.X-linux-x64.tar.gz` | ~80 MB | 通用压缩包 | 任意 Linux |
| `clawdbot-lite-vX.X.X-linux-arm64.tar.gz` | ~75 MB | ARM 版本 | 树莓派/ARM 服务器 |
| `clawdbot-lite_X.X.X_amd64.deb` | ~85 MB | Debian 包 | Debian/Ubuntu |
| `clawdbot-lite-X.X.X-1.x86_64.rpm` | ~85 MB | RPM 包 | RHEL/CentOS/Fedora |
| AppImage | ~90 MB | 通用可执行 | 任意 Linux |

---

## Clawdbot Pro（专业版）

### 产品定位

- **目标用户**：共享服务器、生产环境、需要严格隔离
- **安全策略**：Docker 容器沙盒（完整隔离）
- **特点**：文件系统、网络、进程完全隔离

### Docker 沙盒机制

Pro 版使用 Docker 容器实现完整沙盒隔离：

| 保护层 | 实现方式 | 保护范围 |
|--------|---------|---------|
| **文件系统隔离** | 容器独立文件系统 | 完全隔离主机文件 |
| **进程隔离** | Linux namespace | 进程互不可见 |
| **网络隔离** | Docker 网络 | 可配置网络策略 |
| **资源限制** | cgroups | CPU/内存限制 |
| **用户隔离** | 非 root 用户运行 | 最小权限原则 |
| **只读根目录** | 容器 rootfs readonly | 防止系统篡改 |

#### 沙盒配置 (`config/sandbox.json`)

```json
{
  "enabled": true,
  "mode": "all",
  "scope": "session",
  "image": "clawdbot-sandbox:bookworm-slim",
  "workspaceAccess": "rw",
  "resources": {
    "memory": "512m",
    "cpus": "2",
    "pidsLimit": 100
  },
  "network": {
    "mode": "none",
    "allowInternet": false
  },
  "security": {
    "readOnlyRootfs": true,
    "noNewPrivileges": true,
    "dropCapabilities": ["ALL"],
    "seccompProfile": "default"
  }
}
```

### 分卷包

#### 包 1：主程序包 (`clawdbot-pro-core`)

| 组件 | 版本 | 压缩大小 |
|------|------|---------|
| Node.js Portable | v22.x LTS | 20 MB |
| Clawdbot 核心 | latest | 15 MB |
| node_modules (生产依赖) | - | 35 MB |
| 内置扩展 (extensions) | 全部 | 8 MB |
| Docker 沙盒配置 | - | 1 MB |
| systemd 服务文件 | - | 1 MB |
| **总计** | - | **~80 MB** |

#### 包 2：Docker 沙盒镜像（可选）

| 组件 | 版本 | 压缩大小 |
|------|------|---------|
| 沙盒 Docker 镜像 (离线) | debian:bookworm-slim | ~80 MB |
| 开发工具镜像 (可选) | 含 git/python/etc | ~150 MB |
| **总计** | - | **~80-230 MB** |

### 安装包格式

| 文件名 | 大小 | 适用场景 |
|--------|------|---------|
| `clawdbot-pro-vX.X.X-linux-x64.tar.gz` | ~80 MB | 已有 Docker |
| `clawdbot-pro-vX.X.X-linux-arm64.tar.gz` | ~75 MB | ARM + Docker |
| `clawdbot-pro_X.X.X_amd64.deb` | ~85 MB | Debian/Ubuntu |
| `clawdbot-pro-X.X.X-1.x86_64.rpm` | ~85 MB | RHEL/CentOS/Fedora |

---

## 安装方式对比

### 快速对比

| 安装方式 | 复杂度 | 适用场景 | 更新方式 |
|---------|--------|---------|---------|
| **一键脚本** | ⭐ | 快速入门 | `clawdbot update` |
| **tar.gz** | ⭐⭐ | 任意 Linux | 手动解压覆盖 |
| **deb/rpm** | ⭐⭐ | 发行版用户 | 包管理器更新 |
| **Docker Compose** | ⭐⭐⭐ | 容器化部署 | `docker-compose pull` |
| **AppImage** | ⭐ | 隔离运行 | 下载新版本 |

### 一键安装脚本

```bash
# Lite 版（推荐废弃/专用服务器）
curl -fsSL https://clawd.bot/install-linux.sh | bash -s -- --lite

# Pro 版（推荐共享/生产服务器）
curl -fsSL https://clawd.bot/install-linux.sh | bash -s -- --pro

# 自动检测并推荐
curl -fsSL https://clawd.bot/install-linux.sh | bash
```

### 安装脚本参数

```bash
# 完整参数
curl -fsSL https://clawd.bot/install-linux.sh | bash -s -- \
  --version latest \        # 版本号或 latest/beta
  --variant lite \          # lite 或 pro
  --sandbox on \            # on/off/docker
  --install-dir /opt/clawdbot \
  --no-service \            # 不安装 systemd 服务
  --no-docker               # Pro 版跳过 Docker 安装
```

---

## 增量更新机制

### 更新策略

| 更新类型 | 触发条件 | 下载内容 | 大小 |
|---------|---------|---------|------|
| **核心更新** | Clawdbot 版本变化 | dist/ + 配置 | ~15 MB |
| **依赖更新** | node_modules 变化 | 差异包 | ~5-30 MB |
| **扩展更新** | extensions 变化 | 单个扩展 | ~1-3 MB |
| **全量更新** | 主版本升级 | 完整包 | ~80 MB |
| **Docker 镜像更新** | 沙盒镜像变化 | docker pull | ~80 MB |

### 自动更新流程

```
systemd timer 触发
      │
      ▼
检查更新 (manifest.json)
      │
      ├─ 无更新 ──► 结束
      │
      └─ 有更新
           │
           ▼
     下载增量包
           │
           ▼
     验证 checksum
           │
           ▼
     停止服务
           │
           ▼
     备份当前版本
           │
           ▼
     应用更新
           │
           ▼
     重启服务
           │
           ▼
     健康检查
```

### 更新命令

```bash
# 检查更新
clawdbot update --check

# 执行更新
clawdbot update

# 更新到特定版本
clawdbot update --version 2026.2.1

# 更新 Docker 沙盒镜像
clawdbot update --sandbox-image
```

---

## 构建脚本

### Lite 版构建脚本

```bash
#!/bin/bash
# scripts/linux/build-lite.sh

set -euo pipefail

VERSION="${1:-1.0.0}"
ARCH="${2:-x64}"
OUTPUT_DIR="${3:-dist/lite}"

echo "========================================"
echo "  Clawdbot Lite 构建脚本 v$VERSION"
echo "========================================"

# 1. 准备目录
BUILD_DIR="$OUTPUT_DIR/clawdbot-lite-$VERSION"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# 2. 下载 Node.js
NODE_VERSION="22.13.0"
if [ "$ARCH" = "arm64" ]; then
    NODE_ARCH="linux-arm64"
else
    NODE_ARCH="linux-x64"
fi
NODE_URL="https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-$NODE_ARCH.tar.gz"

echo "[1/6] 下载 Node.js v$NODE_VERSION ($NODE_ARCH)..."
curl -fsSL "$NODE_URL" | tar -xzf - -C "$BUILD_DIR"
mv "$BUILD_DIR/node-v$NODE_VERSION-$NODE_ARCH" "$BUILD_DIR/node"

# 3. 构建 Clawdbot
echo "[2/6] 构建 Clawdbot 核心..."
pnpm install --omit=dev
pnpm build

# 4. 复制文件
echo "[3/6] 复制应用文件..."
mkdir -p "$BUILD_DIR/app"
cp -r dist/* "$BUILD_DIR/app/dist/"
cp -r node_modules "$BUILD_DIR/app/"
cp package.json "$BUILD_DIR/app/"

# 5. 复制扩展
echo "[4/6] 复制扩展..."
cp -r extensions "$BUILD_DIR/"

# 6. 轻量沙盒配置
echo "[5/6] 配置轻量沙盒..."
mkdir -p "$BUILD_DIR/config"
cp scripts/linux/sandbox-lite.json "$BUILD_DIR/config/"
cp scripts/linux/sandbox-lite.sh "$BUILD_DIR/"
chmod +x "$BUILD_DIR/sandbox-lite.sh"

# 7. 系统服务和启动脚本
echo "[6/6] 创建服务文件..."
cp scripts/linux/clawdbot.service "$BUILD_DIR/"
cp scripts/linux/install.sh "$BUILD_DIR/"
cp scripts/linux/uninstall.sh "$BUILD_DIR/"
chmod +x "$BUILD_DIR/install.sh" "$BUILD_DIR/uninstall.sh"

# 启动器脚本
cat > "$BUILD_DIR/clawdbot" << 'LAUNCHER'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="$SCRIPT_DIR/node/bin:$PATH"
exec node "$SCRIPT_DIR/app/dist/cli/index.js" "$@"
LAUNCHER
chmod +x "$BUILD_DIR/clawdbot"

# 8. 版本信息
cat > "$BUILD_DIR/version.json" << EOF
{
  "version": "$VERSION",
  "variant": "lite",
  "buildDate": "$(date -Iseconds)",
  "nodeVersion": "$NODE_VERSION",
  "arch": "$ARCH"
}
EOF

# 9. 打包
echo "打包中..."
TARBALL="$OUTPUT_DIR/clawdbot-lite-v$VERSION-linux-$ARCH.tar.gz"
tar -czf "$TARBALL" -C "$OUTPUT_DIR" "clawdbot-lite-$VERSION"

# 10. 校验和
sha256sum "$TARBALL" > "$TARBALL.sha256"
SIZE=$(du -h "$TARBALL" | cut -f1)

echo "========================================"
echo "  构建完成！"
echo "  输出: $TARBALL"
echo "  大小: $SIZE"
echo "  SHA256: $(cat "$TARBALL.sha256" | cut -d' ' -f1)"
echo "========================================"
```

### Pro 版构建脚本

```bash
#!/bin/bash
# scripts/linux/build-pro.sh

set -euo pipefail

VERSION="${1:-1.0.0}"
ARCH="${2:-x64}"
OUTPUT_DIR="${3:-dist/pro}"

echo "========================================"
echo "  Clawdbot Pro 构建脚本 v$VERSION"
echo "========================================"

# 1. 准备目录
BUILD_DIR="$OUTPUT_DIR/clawdbot-pro-$VERSION"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# 2. 下载 Node.js
NODE_VERSION="22.13.0"
if [ "$ARCH" = "arm64" ]; then
    NODE_ARCH="linux-arm64"
else
    NODE_ARCH="linux-x64"
fi
NODE_URL="https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-$NODE_ARCH.tar.gz"

echo "[1/7] 下载 Node.js v$NODE_VERSION ($NODE_ARCH)..."
curl -fsSL "$NODE_URL" | tar -xzf - -C "$BUILD_DIR"
mv "$BUILD_DIR/node-v$NODE_VERSION-$NODE_ARCH" "$BUILD_DIR/node"

# 3. 构建 Clawdbot
echo "[2/7] 构建 Clawdbot 核心..."
pnpm install --omit=dev
pnpm build

# 4. 复制文件
echo "[3/7] 复制应用文件..."
mkdir -p "$BUILD_DIR/app"
cp -r dist/* "$BUILD_DIR/app/dist/"
cp -r node_modules "$BUILD_DIR/app/"
cp package.json "$BUILD_DIR/app/"

# 5. 复制扩展
echo "[4/7] 复制扩展..."
cp -r extensions "$BUILD_DIR/"

# 6. Docker 沙盒配置
echo "[5/7] 配置 Docker 沙盒..."
mkdir -p "$BUILD_DIR/config"
mkdir -p "$BUILD_DIR/docker"
cp scripts/linux/sandbox.json "$BUILD_DIR/config/"
cp Dockerfile.sandbox "$BUILD_DIR/docker/"
cp scripts/linux/setup-sandbox.sh "$BUILD_DIR/docker/"
chmod +x "$BUILD_DIR/docker/setup-sandbox.sh"

# 7. Docker 检测脚本
echo "[6/7] 添加 Docker 检测脚本..."
cp scripts/linux/check-docker.sh "$BUILD_DIR/docker/"
cp scripts/linux/install-docker.sh "$BUILD_DIR/docker/"
chmod +x "$BUILD_DIR/docker/"*.sh

# 8. 系统服务
echo "[7/7] 创建服务文件..."
cp scripts/linux/clawdbot.service "$BUILD_DIR/"
cp scripts/linux/install-pro.sh "$BUILD_DIR/install.sh"
cp scripts/linux/uninstall.sh "$BUILD_DIR/"
chmod +x "$BUILD_DIR/install.sh" "$BUILD_DIR/uninstall.sh"

# 启动器
cat > "$BUILD_DIR/clawdbot" << 'LAUNCHER'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="$SCRIPT_DIR/node/bin:$PATH"
exec node "$SCRIPT_DIR/app/dist/cli/index.js" "$@"
LAUNCHER
chmod +x "$BUILD_DIR/clawdbot"

# 9. 版本信息
cat > "$BUILD_DIR/version.json" << EOF
{
  "version": "$VERSION",
  "variant": "pro",
  "buildDate": "$(date -Iseconds)",
  "nodeVersion": "$NODE_VERSION",
  "arch": "$ARCH",
  "requiresDocker": true
}
EOF

# 10. 打包
echo "打包中..."
TARBALL="$OUTPUT_DIR/clawdbot-pro-v$VERSION-linux-$ARCH.tar.gz"
tar -czf "$TARBALL" -C "$OUTPUT_DIR" "clawdbot-pro-$VERSION"

# 11. 校验和
sha256sum "$TARBALL" > "$TARBALL.sha256"
SIZE=$(du -h "$TARBALL" | cut -f1)

echo "========================================"
echo "  构建完成！"
echo "  输出: $TARBALL"
echo "  大小: $SIZE"
echo "  SHA256: $(cat "$TARBALL.sha256" | cut -d' ' -f1)"
echo "========================================"
```

### 构建 Docker 沙盒镜像

```bash
#!/bin/bash
# scripts/linux/build-sandbox-image.sh

set -euo pipefail

VERSION="${1:-latest}"
OUTPUT_DIR="${2:-dist/images}"

echo "构建沙盒 Docker 镜像..."

# 构建镜像
docker build -t clawdbot-sandbox:bookworm-slim -f Dockerfile.sandbox .

# 导出镜像
mkdir -p "$OUTPUT_DIR"
docker save clawdbot-sandbox:bookworm-slim | gzip > "$OUTPUT_DIR/clawdbot-sandbox.tar.gz"

echo "镜像已保存到: $OUTPUT_DIR/clawdbot-sandbox.tar.gz"
echo "大小: $(du -h "$OUTPUT_DIR/clawdbot-sandbox.tar.gz" | cut -f1)"
```

### 构建 DEB 包

```bash
#!/bin/bash
# scripts/linux/build-deb.sh

set -euo pipefail

VERSION="${1:-1.0.0}"
VARIANT="${2:-lite}"  # lite 或 pro
ARCH="${3:-amd64}"

PACKAGE_NAME="clawdbot-$VARIANT"
DEB_DIR="dist/deb/$PACKAGE_NAME-$VERSION"

echo "构建 DEB 包: $PACKAGE_NAME v$VERSION"

# 准备目录结构
rm -rf "$DEB_DIR"
mkdir -p "$DEB_DIR/DEBIAN"
mkdir -p "$DEB_DIR/opt/clawdbot"
mkdir -p "$DEB_DIR/usr/bin"
mkdir -p "$DEB_DIR/etc/systemd/system"

# 复制应用文件
cp -r "dist/$VARIANT/clawdbot-$VARIANT-$VERSION/"* "$DEB_DIR/opt/clawdbot/"

# 创建符号链接
ln -sf /opt/clawdbot/clawdbot "$DEB_DIR/usr/bin/clawdbot"

# 复制 systemd 服务
cp scripts/linux/clawdbot.service "$DEB_DIR/etc/systemd/system/"

# 创建 control 文件
cat > "$DEB_DIR/DEBIAN/control" << EOF
Package: $PACKAGE_NAME
Version: $VERSION
Section: utils
Priority: optional
Architecture: $ARCH
Depends: $([ "$VARIANT" = "pro" ] && echo "docker-ce | docker.io" || echo "")
Maintainer: Clawdbot Team <team@clawdbot.com>
Description: Clawdbot AI Agent ($VARIANT version)
 Clawdbot is an AI-powered automation assistant.
 This is the $VARIANT version with $([ "$VARIANT" = "pro" ] && echo "Docker container sandbox" || echo "lightweight sandbox").
EOF

# 创建安装后脚本
cat > "$DEB_DIR/DEBIAN/postinst" << 'EOF'
#!/bin/bash
set -e

# 创建用户
if ! id clawdbot &>/dev/null; then
    useradd -r -s /bin/false -d /opt/clawdbot clawdbot
fi

# 设置权限
chown -R clawdbot:clawdbot /opt/clawdbot
chmod 755 /opt/clawdbot/clawdbot

# 重载 systemd
systemctl daemon-reload

echo "Clawdbot 安装完成！"
echo "运行 'clawdbot config' 进行配置"
echo "运行 'systemctl start clawdbot' 启动服务"
EOF
chmod 755 "$DEB_DIR/DEBIAN/postinst"

# 构建 DEB
dpkg-deb --build "$DEB_DIR"
mv "$DEB_DIR.deb" "dist/deb/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"

echo "DEB 包已创建: dist/deb/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"
```

### 构建 RPM 包

```bash
#!/bin/bash
# scripts/linux/build-rpm.sh

set -euo pipefail

VERSION="${1:-1.0.0}"
VARIANT="${2:-lite}"  # lite 或 pro
ARCH="${3:-x86_64}"

echo "构建 RPM 包: clawdbot-$VARIANT v$VERSION"

# 创建 RPM 构建目录
RPM_BUILD_DIR="$HOME/rpmbuild"
mkdir -p "$RPM_BUILD_DIR"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}

# 复制源码
TARBALL="dist/$VARIANT/clawdbot-$VARIANT-v$VERSION-linux-x64.tar.gz"
cp "$TARBALL" "$RPM_BUILD_DIR/SOURCES/"

# 创建 SPEC 文件
cat > "$RPM_BUILD_DIR/SPECS/clawdbot-$VARIANT.spec" << EOF
Name:           clawdbot-$VARIANT
Version:        $VERSION
Release:        1%{?dist}
Summary:        Clawdbot AI Agent ($VARIANT version)
License:        Proprietary
URL:            https://clawdbot.com
Source0:        clawdbot-$VARIANT-v%{version}-linux-x64.tar.gz

$([ "$VARIANT" = "pro" ] && echo "Requires:       docker-ce" || echo "")

%description
Clawdbot is an AI-powered automation assistant.
This is the $VARIANT version with $([ "$VARIANT" = "pro" ] && echo "Docker container sandbox" || echo "lightweight sandbox").

%prep
%setup -q -n clawdbot-$VARIANT-%{version}

%install
mkdir -p %{buildroot}/opt/clawdbot
cp -r * %{buildroot}/opt/clawdbot/
mkdir -p %{buildroot}/usr/bin
ln -sf /opt/clawdbot/clawdbot %{buildroot}/usr/bin/clawdbot
mkdir -p %{buildroot}/etc/systemd/system
cp clawdbot.service %{buildroot}/etc/systemd/system/

%files
/opt/clawdbot
/usr/bin/clawdbot
/etc/systemd/system/clawdbot.service

%post
useradd -r -s /bin/false -d /opt/clawdbot clawdbot 2>/dev/null || true
chown -R clawdbot:clawdbot /opt/clawdbot
systemctl daemon-reload
echo "Clawdbot 安装完成！运行 'clawdbot config' 进行配置"

%postun
userdel clawdbot 2>/dev/null || true
systemctl daemon-reload
EOF

# 构建 RPM
rpmbuild -bb "$RPM_BUILD_DIR/SPECS/clawdbot-$VARIANT.spec"

echo "RPM 包已创建: $RPM_BUILD_DIR/RPMS/$ARCH/clawdbot-$VARIANT-$VERSION-1.$ARCH.rpm"
```

---

## 安装流程

### Lite 版安装流程

```
一键脚本 / tar.gz / deb / rpm
              │
              ▼
      ┌───────────────┐
      │  检测系统环境  │
      │  - 发行版     │
      │  - 架构       │
      │  - 权限       │
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │  下载/解压    │
      │  到 /opt/     │
      │  clawdbot     │
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │  创建用户     │
      │  clawdbot     │
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │  配置向导     │
      │  - API Key    │
      │  - 消息渠道   │
      │  - 沙盒设置   │
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │  安装 systemd │
      │  服务         │
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │  启动服务     │
      │  完成安装     │
      └───────────────┘
```

### Pro 版安装流程

```
一键脚本 / tar.gz (需 root)
              │
              ▼
      ┌───────────────┐
      │  检测系统环境  │
      │  - 发行版     │
      │  - 内核版本   │
      │  - cgroup v2  │
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │  检测 Docker  │
      └───────┬───────┘
              │
        已安装?
         /    \
        是     否
        │      │
        │      ▼
        │  ┌───────────────┐
        │  │ 安装 Docker   │
        │  │ (自动/手动)   │
        │  └───────┬───────┘
        │          │
        └────┬─────┘
             │
             ▼
      ┌───────────────┐
      │  拉取/导入    │
      │  沙盒镜像     │
      └───────┬───────┘
             │
             ▼
      ┌───────────────┐
      │  安装主程序   │
      └───────┬───────┘
             │
             ▼
      ┌───────────────┐
      │  配置向导     │
      └───────┬───────┘
             │
             ▼
      ┌───────────────┐
      │  启动服务     │
      │  完成安装     │
      └───────────────┘
```

---

## 目录结构

### Lite 版目录结构

```
/opt/clawdbot/
├── node/                         # Node.js Portable
│   └── bin/
│       ├── node
│       └── npm
├── app/                          # Clawdbot 核心
│   ├── dist/                     # 编译后的代码
│   ├── node_modules/             # 依赖
│   └── package.json
├── extensions/                   # 扩展插件
│   ├── msteams/
│   ├── matrix/
│   └── ...
├── config/                       # 配置文件
│   ├── settings.json             # 主配置
│   ├── sandbox-lite.json         # 轻量沙盒配置
│   └── credentials/              # 凭证 (加密)
├── workspace/                    # 沙盒工作目录
│   └── (用户文件)
├── logs/                         # 日志
├── temp/                         # 临时文件
├── clawdbot                      # 启动器 (符号链接到 /usr/bin)
├── sandbox-lite.sh               # 沙盒脚本
├── install.sh                    # 安装脚本
├── uninstall.sh                  # 卸载脚本
└── version.json                  # 版本信息

/etc/systemd/system/
└── clawdbot.service              # systemd 服务文件
```

### Pro 版目录结构

```
/opt/clawdbot/
├── node/                         # Node.js Portable
│   └── bin/
├── app/                          # Clawdbot 核心
│   ├── dist/
│   ├── node_modules/
│   └── package.json
├── extensions/                   # 扩展插件
├── config/                       # 配置文件
│   ├── settings.json
│   ├── sandbox.json              # Docker 沙盒配置
│   └── credentials/
├── docker/                       # Docker 相关
│   ├── Dockerfile.sandbox        # 沙盒 Dockerfile
│   ├── images/                   # 离线镜像
│   │   └── clawdbot-sandbox.tar.gz
│   ├── check-docker.sh
│   ├── install-docker.sh
│   └── setup-sandbox.sh
├── workspace/                    # 工作目录 (挂载到容器)
├── logs/
├── clawdbot                      # 启动器
├── install.sh
├── uninstall.sh
└── version.json

/etc/systemd/system/
└── clawdbot.service
```

---

## 系统要求

### Lite 版

| 项目 | 最低要求 | 推荐配置 |
|------|---------|---------|
| **操作系统** | Linux (glibc 2.17+) | Ubuntu 22.04 / Debian 12 / RHEL 8+ |
| **内核版本** | 3.10+ | 5.4+ |
| **处理器** | x64 或 arm64 | 2核+ |
| **内存** | 512 MB | 2 GB+ |
| **磁盘空间** | 300 MB | 1 GB+ |
| **网络** | 需要互联网 | 稳定宽带 |

### Pro 版

| 项目 | 最低要求 | 推荐配置 |
|------|---------|---------|
| **操作系统** | Linux (glibc 2.31+) | Ubuntu 22.04 / Debian 12 / RHEL 9+ |
| **内核版本** | 4.15+ (cgroup v2) | 5.10+ |
| **处理器** | x64 或 arm64 | 4核+ |
| **内存** | 2 GB | 4 GB+ |
| **磁盘空间** | 2 GB | 5 GB+ |
| **Docker** | Docker Engine 20.10+ | 最新稳定版 |
| **网络** | 需要互联网 | 稳定宽带 |

### 发行版兼容性

| 发行版 | Lite | Pro | 备注 |
|--------|------|-----|------|
| **Ubuntu 22.04+** | ✅ | ✅ | 官方推荐 |
| **Ubuntu 20.04** | ✅ | ✅ | 需升级内核 (cgroup v2) |
| **Debian 12+** | ✅ | ✅ | 完全支持 |
| **Debian 11** | ✅ | ⚠️ | 需要配置 cgroup v2 |
| **RHEL 9 / Rocky 9** | ✅ | ✅ | 完全支持 |
| **RHEL 8 / CentOS 8** | ✅ | ⚠️ | Docker 需额外配置 |
| **Fedora 38+** | ✅ | ✅ | 完全支持 |
| **Arch Linux** | ✅ | ✅ | 滚动更新 |
| **Alpine** | ⚠️ | ✅ | Lite 需要 glibc |

---

## 版本对比总结

| 对比项 | Clawdbot Lite | Clawdbot Pro |
|--------|--------------|--------------|
| **安装包大小** | ~80 MB | ~80 MB (+ Docker ~80MB 镜像) |
| **安装时间** | 1-2 分钟 | 3-5 分钟 |
| **需要重启** | 否 | 否 |
| **需要 root** | 推荐 | 是 |
| **沙盒类型** | Linux 轻量沙盒 | Docker 容器沙盒 |
| **隔离级别** | ⭐⭐⭐ (中) | ⭐⭐⭐⭐⭐ (高) |
| **磁盘占用** | ~300 MB | ~1-2 GB |
| **内存占用** | ~100 MB | ~200 MB + Docker |
| **适合服务器类型** | 专用/废弃 | 共享/生产 |
| **增量更新** | ✅ 支持 | ✅ 支持 |

---

## 沙盒开关控制

### 开关机制概述

**所有版本都支持开关沙盒保护**，用户可以根据需要启用或关闭沙盒。

| 版本 | 沙盒类型 | 默认状态 | 可关闭 |
|------|---------|---------|--------|
| **Lite** | Linux 轻量沙盒 | ✅ 开启 | ✅ 可关闭 |
| **Pro** | Docker 容器沙盒 | ✅ 开启 | ✅ 可关闭 |

### 沙盒模式

项目内置三种沙盒模式（安装向导中对应三个选项）：

| 模式 | 安装向导名称 | 说明 | 适用场景 |
|------|-------------|------|---------|
| `"all"` | 🛡️ 完全保护 | 所有会话都使用沙盒 | 共享服务器、生产环境 |
| `"non-main"` | 🔒 智能保护（推荐） | 仅非主会话使用沙盒 | 日常使用、推荐默认值 |
| `"off"` | ⚡ 关闭保护 | 关闭沙盒，解锁全部能力 | 废弃设备、专用服务器、懂行高手 |

### 配置方式

#### 方式一：命令行（推荐）

```bash
# 查看当前沙盒配置
clawdbot config get agents.defaults.sandbox.mode

# 关闭沙盒（仅限专用服务器）
clawdbot config set agents.defaults.sandbox.mode off

# 开启完全沙盒
clawdbot config set agents.defaults.sandbox.mode all

# 智能沙盒（仅非主会话）
clawdbot config set agents.defaults.sandbox.mode non-main
```

#### 方式二：配置文件

编辑 `/opt/clawdbot/config/settings.json`：

```json5
{
  "agents": {
    "defaults": {
      "sandbox": {
        // 沙盒模式：off / non-main / all
        "mode": "all",
        
        // 作用范围：session / agent / shared
        "scope": "session",
        
        // 工作区访问：none / ro / rw
        "workspaceAccess": "rw"
      }
    }
  }
}
```

#### 方式三：环境变量

```bash
# 临时关闭沙盒
CLAWDBOT_SANDBOX_MODE=off clawdbot gateway run
```

### Lite 版轻量沙盒配置

编辑 `/opt/clawdbot/config/sandbox-lite.json`：

```json5
{
  // 总开关
  "enabled": true,  // false = 完全关闭轻量沙盒
  
  "mode": "lite",
  
  // 工作目录限制
  "workspace": {
    "root": "/opt/clawdbot/workspace",
    "allowedPaths": [
      "/opt/clawdbot/workspace",
      "/opt/clawdbot/temp"
    ],
    // 是否强制限制在工作目录
    "enforceRoot": true  // false = 可访问任意目录
  },
  
  // 用户隔离
  "user": {
    "enabled": true,
    "name": "clawdbot",
    "dropPrivileges": true
  },
  
  // 命令过滤
  "commands": {
    "blocked": [
      "rm -rf /", "dd if=", "mkfs", "shutdown",
      "reboot", "passwd", "useradd", "sudo"
    ],
    "shellRestricted": true  // false = 允许任意命令
  },
  
  // 资源限制
  "resources": {
    "enabled": true,
    "maxMemoryMB": 512,
    "maxCpuPercent": 50
  }
}
```

**快速开关**：

```bash
# 关闭 Lite 轻量沙盒
clawdbot config set sandbox-lite.enabled false

# 开启 Lite 轻量沙盒
clawdbot config set sandbox-lite.enabled true
```

### Pro 版 Docker 沙盒配置

编辑 `/opt/clawdbot/config/sandbox.json`：

```json5
{
  // Docker 沙盒模式
  "mode": "all",  // off = 关闭 Docker 沙盒
  
  "scope": "session",
  "workspaceAccess": "rw",
  
  // Docker 相关配置
  "docker": {
    "image": "clawdbot-sandbox:bookworm-slim",
    "network": "none",  // none / bridge / host
    "readOnlyRoot": true,
    "memory": "512m",
    "cpus": "2"
  }
}
```

**快速开关**：

```bash
# 关闭 Docker 沙盒
clawdbot config set agents.defaults.sandbox.mode off

# 开启 Docker 沙盒（所有会话）
clawdbot config set agents.defaults.sandbox.mode all
```

### 关闭沙盒的风险提示

当用户尝试关闭沙盒时，CLI 会显示警告：

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  警告：关闭沙盒保护                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  关闭沙盒后，AI Agent 将可以：                               │
│                                                             │
│  • 访问和修改系统上的任何文件                                │
│  • 执行任意系统命令（包括 rm -rf /）                         │
│  • 访问网络和其他系统资源                                    │
│  • 读取其他用户数据                                         │
│                                                             │
│  建议仅在以下情况关闭沙盒：                                  │
│  1. 这是一台专用/废弃服务器                                 │
│  2. 服务器不包含敏感数据                                    │
│  3. 你完全理解风险并愿意承担                                │
│                                                             │
│  [取消]                              [我理解风险，继续关闭] │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 常见问题

### Q1: 什么时候可以不使用沙盒？

**以下场景可以考虑关闭沙盒**：

| 场景 | 关闭沙盒 | 理由 |
|------|---------|------|
| 废弃/闲置服务器 | ✅ 可以 | 设备专用，无敏感数据 |
| 专用 Clawdbot 服务器 | ✅ 可以 | 单一用途，风险可控 |
| 开发/测试服务器 | ⚠️ 谨慎 | 可能有代码/配置需保护 |
| 共享服务器 | ❌ 不推荐 | 需保护其他用户数据 |
| 生产服务器 | ❌ 不推荐 | 需保护生产数据和服务 |

### Q2: 什么时候推荐使用 Docker 沙盒？

**以下场景强烈推荐 Docker 沙盒**：

- ✅ 共享服务器（多用户环境）
- ✅ 生产环境
- ✅ 包含敏感数据的服务器
- ✅ 运行其他重要服务的服务器
- ✅ 需要最高隔离级别

### Q3: Lite 版的轻量沙盒和 Pro 版的 Docker 沙盒有什么区别？

| 对比项 | Lite 轻量沙盒 | Pro Docker 沙盒 |
|--------|-------------|----------------|
| **隔离级别** | 中等 | 完全隔离 |
| **文件系统** | 路径白名单 | 独立文件系统 |
| **进程隔离** | 受限用户 | namespace 隔离 |
| **网络隔离** | iptables (可选) | Docker 网络 |
| **资源占用** | ~100MB 内存 | ~200MB + Docker |
| **适合场景** | 专用服务器 | 共享/生产环境 |

### Q4: 如何在已安装 Docker 的服务器上安装？

```bash
# 只下载主程序包，自动检测 Docker
curl -fsSL https://clawd.bot/install-linux.sh | bash -s -- --pro

# 手动安装
wget https://releases.clawdbot.com/clawdbot-pro-vX.X.X-linux-x64.tar.gz
tar -xzf clawdbot-pro-*.tar.gz
cd clawdbot-pro-*
sudo ./install.sh
```

### Q5: ARM 服务器（树莓派）支持吗？

支持。我们提供 ARM64 版本：

```bash
# ARM64 安装
curl -fsSL https://clawd.bot/install-linux.sh | bash -s -- --arch arm64
```

### Q6: 如何在容器化环境（Docker/Kubernetes）中运行？

```bash
# Docker 方式
docker run -d \
  --name clawdbot \
  -v /path/to/config:/opt/clawdbot/config \
  -v /path/to/workspace:/opt/clawdbot/workspace \
  clawdbot/clawdbot:latest

# Kubernetes Helm Chart
helm repo add clawdbot https://charts.clawdbot.com
helm install clawdbot clawdbot/clawdbot
```

### Q7: 中国用户下载慢怎么办？

我们提供国内镜像：

```bash
# 使用国内镜像安装
curl -fsSL https://cn.clawd.bot/install-linux.sh | bash

# 或手动指定镜像
export CLAWDBOT_MIRROR=https://mirrors.aliyun.com/clawdbot
curl -fsSL https://clawd.bot/install-linux.sh | bash
```

### Q8: 如何配置 systemd 服务？

```bash
# 启动服务
sudo systemctl start clawdbot

# 设置开机启动
sudo systemctl enable clawdbot

# 查看状态
sudo systemctl status clawdbot

# 查看日志
journalctl -u clawdbot -f
```

### Q9: 如何备份和恢复配置？

```bash
# 备份
tar -czf clawdbot-backup.tar.gz /opt/clawdbot/config /opt/clawdbot/workspace

# 恢复
tar -xzf clawdbot-backup.tar.gz -C /
```

### Q10: 如何完全卸载？

```bash
# 停止服务
sudo systemctl stop clawdbot
sudo systemctl disable clawdbot

# 卸载
sudo /opt/clawdbot/uninstall.sh

# 或 (deb)
sudo apt remove clawdbot-lite  # 或 clawdbot-pro

# 或 (rpm)
sudo dnf remove clawdbot-lite  # 或 clawdbot-pro
```

---

## 快速对比表

| 决策因素 | 选择 Lite | 选择 Pro |
|---------|----------|----------|
| **服务器类型** | 专用/废弃 | 共享/生产 |
| **沙盒需求** | 可关闭或轻量 | Docker 完整隔离 |
| **资源预算** | 低配置 | 中高配置 |
| **Docker 现状** | 不想安装 | 已有或愿意安装 |
| **安全要求** | 基础保护 | 严格隔离 |
| **维护复杂度** | 简单 | 需要 Docker 知识 |

---

## 总结建议

1. **废弃服务器**：使用 Lite 版，可以完全关闭沙盒
2. **专用 Clawdbot 服务器**：使用 Lite 版，保持轻量沙盒开启
3. **混合/共享服务器**：使用 Pro 版，强制使用 Docker 沙盒
4. **生产环境**：使用 Pro 版，配置最严格的沙盒策略

---

## 更新日志

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| 1.0.0 | 2026-01-29 | 初始版本，支持 Lite/Pro 双版本 |

---

*文档最后更新：2026-01-29*
