# ClawbotCN macOS 一键安装包构建方案

> 本文档描述 ClawbotCN macOS 版本的打包、分发和更新策略（无证书版本）。

---

## 目录

- [版本概述](#版本概述)
- [系统要求](#系统要求)
- [打包格式](#打包格式)
- [软沙盒机制](#软沙盒机制)
- [构建脚本](#构建脚本)
- [安装流程](#安装流程)
- [目录结构](#目录结构)
- [增量更新机制](#增量更新机制)
- [常见问题](#常见问题)

---

## 版本概述

### 分发限制说明

由于 ClawbotCN 未申请 Apple Developer 证书，存在以下限制：

| 限制项 | 影响 | 解决方案 |
|--------|------|---------|
| 无 Developer ID 签名 | Gatekeeper 阻止运行 | 用户右键打开 / `xattr -cr` |
| 无公证 (Notarization) | 首次运行需额外确认 | 提供详细安装教程 |
| 无原生沙盒 | 无法使用 macOS App Sandbox | 使用软沙盒替代 |

### 版本规格

| 版本 | 目标场景 | 沙盒类型 | 安装包大小 | 适合用户 |
|------|---------|---------|-----------|---------|
| **ClawbotCN Lite** | 通用场景 | 软沙盒（目录隔离） | ~100-150 MB | 所有用户 |

> 💡 **为什么只有一个版本？**
> - 无证书无法使用 macOS 原生沙盒
> - Docker 方案对小白用户过于复杂
> - 软沙盒方案足够应对大多数使用场景

---

## 系统要求

### 最低配置

| 项目 | 最低要求 | 推荐配置 |
|------|---------|---------|
| **操作系统** | macOS 15 (Sequoia) | macOS 15+ |
| **处理器** | Apple Silicon 或 Intel | Apple Silicon (M1+) |
| **内存** | 4 GB | 8 GB+ |
| **磁盘空间** | 500 MB | 1 GB+ |
| **Node.js** | 内置（无需安装） | - |
| **网络** | 需要互联网 | 稳定宽带 |

### 支持的 Mac 设备

#### Apple Silicon (arm64)
- MacBook Air (M1, 2020 及更新)
- MacBook Pro (M1/M2/M3/M4, 2020 及更新)
- Mac mini (M1/M2/M4, 2020 及更新)
- Mac Studio (M1/M2, 2022 及更新)
- iMac (M1/M3/M4, 2021 及更新)
- Mac Pro (M2 Ultra, 2023 及更新)

#### Intel (x64)
- 2017 年及更新的 Intel Mac（需升级到 macOS 15）

### macOS 版本覆盖率参考

| macOS 版本 | 代号 | 发布时间 | 市场占有率 |
|------------|------|---------|-----------|
| macOS 15 | Sequoia | 2024.9 | ~30% |
| macOS 14 | Sonoma | 2023.9 | ~35% |
| macOS 13 | Ventura | 2022.10 | ~20% |
| macOS 12 | Monterey | 2021.10 | ~10% |

> ⚠️ 当前版本要求 macOS 15+，如需支持更多用户，可考虑降低 Swift App 的最低版本要求。

---

## 打包格式

### 推荐格式：ZIP 压缩包

| 格式 | 推荐度 | 说明 |
|------|--------|------|
| **`.zip`** | ⭐⭐⭐⭐⭐ | 最推荐，解压即用，兼容性最好 |
| `.dmg` | ⭐⭐⭐ | 可用，但无签名会多一层警告 |
| `.pkg` | ⭐⭐ | 不推荐，无签名会被完全阻止 |

### 安装包规格

| 文件名 | 大小 | 说明 |
|--------|------|------|
| `ClawbotCN-macOS-vX.X.X-arm64.zip` | ~100 MB | Apple Silicon 版本 |
| `ClawbotCN-macOS-vX.X.X-x64.zip` | ~100 MB | Intel Mac 版本 |
| `ClawbotCN-macOS-vX.X.X-universal.zip` | ~150 MB | 通用版本（两种架构） |

### 包含组件

| 组件 | 版本 | 压缩大小 | 解压大小 |
|------|------|---------|---------|
| Node.js Portable | v22.x LTS | 25 MB | 80 MB |
| ClawbotCN 核心 | latest | 15 MB | 40 MB |
| node_modules (生产依赖) | - | 50 MB | 150 MB |
| 内置扩展 (extensions) | 全部 | 10 MB | 30 MB |
| 软沙盒模块 | - | 2 MB | 5 MB |
| 配置向导 | - | 3 MB | 8 MB |
| **总计** | - | **~105 MB** | **~313 MB** |

---

## 软沙盒机制

### 为什么不使用 Docker？

| 方案 | 需要 Docker | 需要证书 | 小白友好度 | 隔离级别 |
|------|------------|---------|-----------|---------|
| macOS 原生沙盒 | ❌ | ⚠️ **需要** | - | ⭐⭐⭐⭐⭐ |
| Docker 容器沙盒 | ✅ **需要** | ❌ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **软沙盒** | ❌ | ❌ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

**结论**：无证书情况下，软沙盒是最实际的选择。

### 软沙盒保护机制

| 保护层 | 实现方式 | 保护范围 |
|--------|---------|---------|
| **目录隔离** | 工作目录限制在 `~/.clawbotcn/workspace` | 防止访问用户文件 |
| **路径白名单** | 只允许访问指定目录 | 防止目录遍历 |
| **命令过滤** | 禁止危险命令 (sudo, rm -rf 等) | 防止破坏性操作 |
| **网络限制** | 可选的出站限制 | 限制网络访问 |

### 沙盒配置文件 (`config/sandbox-mac.json`)

```json
{
  "enabled": true,
  "mode": "lite",
  "workspace": {
    "root": "~/.clawbotcn/workspace",
    "allowedPaths": [
      "~/.clawbotcn/workspace",
      "~/.clawbotcn/temp",
      "~/.clawbotcn/downloads"
    ],
    "enforceRoot": true
  },
  "commands": {
    "blocked": [
      "sudo",
      "su",
      "rm -rf /",
      "rm -rf ~",
      "rm -rf /*",
      "chmod 777 /",
      "chown",
      "launchctl",
      "diskutil",
      "killall",
      "pkill",
      "shutdown",
      "reboot",
      "defaults write",
      "osascript -e 'tell application \"System Events\"'"
    ],
    "shellRestricted": true,
    "allowedShells": ["/bin/bash", "/bin/zsh", "/bin/sh"]
  },
  "network": {
    "restrictOutbound": false,
    "allowedHosts": []
  },
  "filesystem": {
    "blockedPaths": [
      "/System",
      "/Library",
      "/usr",
      "/bin",
      "/sbin",
      "/private",
      "~/Library",
      "~/Documents",
      "~/Desktop",
      "~/Downloads",
      "~/.ssh",
      "~/.gnupg",
      "~/.*rc",
      "~/.zshrc",
      "~/.bashrc",
      "~/.profile"
    ]
  }
}
```

### 沙盒开关控制

#### 沙盒模式

项目内置三种沙盒模式（安装向导中对应三个选项）：

| 模式 | 安装向导名称 | 说明 | 适用场景 |
|------|-------------|------|---------|
| `"all"` | 🛡️ 完全保护 | 所有操作都在沙盒中 | 有敏感数据、多人共用 |
| `"non-main"` | 🔒 智能保护（推荐） | 主对话正常，后台受限 | 日常使用、工作电脑 |
| `"off"` | ⚡ 关闭保护 | 解锁全部能力，风险自担 | 专用设备、懂行高手 |

#### 配置向导中设置

```
┌─────────────────────────────────────────────────────────────┐
│                    沙盒保护设置                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🛡️ 完全保护                                                │
│    所有操作限制在工作目录，禁止危险命令                      │
│                                                             │
│  🔒 智能保护（推荐）                                  ⭐默认 │
│    主对话正常权限，后台任务受沙盒限制                        │
│                                                             │
│  ⚡ 关闭保护                                    👨‍💻 懂行专用 │
│    AI 拥有完整系统权限，解锁全部能力                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 命令行设置

```bash
# 查看当前沙盒配置
clawbotcn config get agents.defaults.sandbox.mode

# 完全保护
clawbotcn config set agents.defaults.sandbox.mode all

# 智能保护（推荐）
clawbotcn config set agents.defaults.sandbox.mode non-main

# 关闭保护
clawbotcn config set agents.defaults.sandbox.mode off
```

### 关闭沙盒的风险提示

当用户尝试关闭沙盒时，显示警告：

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  警告：关闭沙盒保护                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  关闭沙盒后，AI Agent 将可以：                               │
│                                                             │
│  • 访问和修改 Mac 上的任何文件                               │
│  • 执行任意系统命令                                         │
│  • 访问网络和其他系统资源                                    │
│                                                             │
│  建议仅在以下情况关闭沙盒：                                  │
│  1. 这是一台专用/闲置设备                                   │
│  2. 你完全理解风险并愿意承担                                │
│  3. 有其他安全措施（如网络隔离）                            │
│                                                             │
│  [取消]                              [我理解风险，继续关闭] │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 构建脚本

### 主构建脚本

```bash
#!/bin/bash
# scripts/macos/build-clawbotcn.sh

set -euo pipefail

VERSION="${1:-1.0.0}"
ARCH="${2:-$(uname -m)}"  # arm64 或 x86_64
OUTPUT_DIR="dist/macos"
APP_NAME="ClawbotCN"
BUILD_DIR="$OUTPUT_DIR/$APP_NAME-$VERSION-$ARCH"

echo "========================================"
echo "  ClawbotCN macOS 构建脚本 v$VERSION"
echo "  架构: $ARCH"
echo "========================================"

# 1. 准备目录
echo "[1/8] 准备构建目录..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# 2. 下载 Node.js Portable
NODE_VERSION="22.13.0"
if [[ "$ARCH" == "arm64" ]]; then
    NODE_URL="https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-darwin-arm64.tar.gz"
else
    NODE_URL="https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-darwin-x64.tar.gz"
fi
NODE_TAR="$OUTPUT_DIR/node-$ARCH.tar.gz"

echo "[2/8] 下载 Node.js v$NODE_VERSION ($ARCH)..."
if [[ ! -f "$NODE_TAR" ]]; then
    curl -L "$NODE_URL" -o "$NODE_TAR"
fi
mkdir -p "$BUILD_DIR/node"
tar -xzf "$NODE_TAR" -C "$BUILD_DIR/node" --strip-components=1

# 3. 构建 ClawbotCN
echo "[3/8] 构建 ClawbotCN 核心..."
pnpm install --omit=dev
pnpm build

# 4. 复制应用文件
echo "[4/8] 复制应用文件..."
mkdir -p "$BUILD_DIR/app"
cp -R dist/* "$BUILD_DIR/app/"
cp -R node_modules "$BUILD_DIR/app/"
cp package.json "$BUILD_DIR/app/"

# 5. 复制扩展
echo "[5/8] 复制扩展..."
cp -R extensions "$BUILD_DIR/"

# 6. 配置软沙盒
echo "[6/8] 配置软沙盒..."
mkdir -p "$BUILD_DIR/config"
cat > "$BUILD_DIR/config/sandbox-mac.json" << 'EOF'
{
  "enabled": true,
  "mode": "lite",
  "workspace": {
    "root": "~/.clawbotcn/workspace",
    "allowedPaths": [
      "~/.clawbotcn/workspace",
      "~/.clawbotcn/temp"
    ],
    "enforceRoot": true
  },
  "commands": {
    "blocked": [
      "sudo", "su", "rm -rf /", "rm -rf ~",
      "chmod 777", "chown", "launchctl",
      "diskutil", "killall", "shutdown", "reboot"
    ],
    "shellRestricted": true
  }
}
EOF

# 7. 创建启动脚本
echo "[7/8] 创建启动脚本..."
cat > "$BUILD_DIR/clawbotcn" << 'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="$SCRIPT_DIR/node/bin:$PATH"
export CLAWBOTCN_HOME="$SCRIPT_DIR"
cd "$SCRIPT_DIR/app"
node dist/cli/index.js "$@"
EOF
chmod +x "$BUILD_DIR/clawbotcn"

# 创建 GUI 启动脚本（可选）
cat > "$BUILD_DIR/start-gui.command" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
./clawbotcn gateway run
EOF
chmod +x "$BUILD_DIR/start-gui.command"

# 8. 创建版本信息
echo "[8/8] 创建版本信息..."
cat > "$BUILD_DIR/version.json" << EOF
{
  "version": "$VERSION",
  "variant": "lite",
  "arch": "$ARCH",
  "buildDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "nodeVersion": "$NODE_VERSION",
  "platform": "darwin"
}
EOF

# 打包
echo "打包中..."
cd "$OUTPUT_DIR"
ZIP_NAME="$APP_NAME-macOS-v$VERSION-$ARCH.zip"
zip -r "$ZIP_NAME" "$APP_NAME-$VERSION-$ARCH"

# 计算校验和
HASH=$(shasum -a 256 "$ZIP_NAME" | awk '{print $1}')
echo "$HASH" > "$ZIP_NAME.sha256"

echo "========================================"
echo "  构建完成！"
echo "  输出: $OUTPUT_DIR/$ZIP_NAME"
echo "  大小: $(du -h "$ZIP_NAME" | awk '{print $1}')"
echo "  SHA256: $HASH"
echo "========================================"
```

### 通用版本构建脚本

```bash
#!/bin/bash
# scripts/macos/build-universal.sh

set -euo pipefail

VERSION="${1:-1.0.0}"
OUTPUT_DIR="dist/macos"

echo "构建 Universal 版本..."

# 构建两个架构
./scripts/macos/build-clawbotcn.sh "$VERSION" arm64
./scripts/macos/build-clawbotcn.sh "$VERSION" x86_64

# 合并为通用版本
UNIVERSAL_DIR="$OUTPUT_DIR/ClawbotCN-$VERSION-universal"
mkdir -p "$UNIVERSAL_DIR"

# 使用 arm64 作为基础
cp -R "$OUTPUT_DIR/ClawbotCN-$VERSION-arm64/"* "$UNIVERSAL_DIR/"

# 合并 Node.js（使用 lipo）
echo "合并 Node.js 二进制..."
lipo -create \
    "$OUTPUT_DIR/ClawbotCN-$VERSION-arm64/node/bin/node" \
    "$OUTPUT_DIR/ClawbotCN-$VERSION-x86_64/node/bin/node" \
    -output "$UNIVERSAL_DIR/node/bin/node"

# 更新版本信息
cat > "$UNIVERSAL_DIR/version.json" << EOF
{
  "version": "$VERSION",
  "variant": "lite",
  "arch": "universal",
  "buildDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "platform": "darwin"
}
EOF

# 打包
cd "$OUTPUT_DIR"
ZIP_NAME="ClawbotCN-macOS-v$VERSION-universal.zip"
zip -r "$ZIP_NAME" "ClawbotCN-$VERSION-universal"

echo "Universal 版本构建完成: $ZIP_NAME"
```

---

## 安装流程

### 用户安装教程

```
┌─────────────────────────────────────────────────────────────┐
│               ClawbotCN macOS 安装指南                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  第一步：下载                                               │
│  ─────────                                                  │
│  下载 ClawbotCN-macOS-vX.X.X.zip                           │
│  • Apple Silicon Mac → 下载 arm64 版本                     │
│  • Intel Mac → 下载 x64 版本                               │
│  • 不确定？→ 下载 universal 版本                           │
│                                                             │
│  第二步：解压                                               │
│  ─────────                                                  │
│  双击 ZIP 文件解压，得到 ClawbotCN 文件夹                   │
│                                                             │
│  第三步：移动到合适位置                                     │
│  ─────────                                                  │
│  建议移动到「应用程序」文件夹：                             │
│  /Applications/ClawbotCN                                    │
│                                                             │
│  第四步：首次运行（重要！）                                 │
│  ─────────                                                  │
│                                                             │
│  ⚠️  由于未签名，macOS 会阻止直接运行。请选择以下方式：     │
│                                                             │
│  【方式一】右键打开（推荐小白用户）                         │
│   1. 打开「终端」App                                        │
│   2. 输入以下命令：                                         │
│      xattr -cr /Applications/ClawbotCN                      │
│   3. 回车执行                                               │
│   4. 之后可正常双击 start-gui.command 启动                  │
│                                                             │
│  【方式二】系统设置允许                                     │
│   1. 双击尝试打开（会被阻止）                               │
│   2. 打开「系统设置」→「隐私与安全性」                      │
│   3. 向下滚动找到"ClawbotCN 已被阻止"                       │
│   4. 点击「仍要打开」                                       │
│                                                             │
│  第五步：配置                                               │
│  ─────────                                                  │
│  首次运行会启动配置向导：                                   │
│  • 设置 API Key                                             │
│  • 选择消息渠道                                             │
│  • 配置沙盒保护级别                                         │
│                                                             │
│  ✅ 完成！                                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 一键安装脚本（可选）

提供给用户的辅助安装脚本：

```bash
#!/bin/bash
# install-clawbotcn.sh
# 用法: 将 ClawbotCN 文件夹放到 /Applications 后运行此脚本

APP_PATH="/Applications/ClawbotCN"

echo "🔧 ClawbotCN 安装助手"
echo ""

# 检查是否存在
if [ ! -d "$APP_PATH" ]; then
    echo "❌ 错误: 未找到 $APP_PATH"
    echo "   请先将 ClawbotCN 文件夹移动到「应用程序」文件夹"
    exit 1
fi

# 清除隔离属性
echo "🔓 正在解除 Gatekeeper 限制..."
xattr -cr "$APP_PATH"

# 设置权限
echo "🔑 设置执行权限..."
chmod +x "$APP_PATH/clawbotcn"
chmod +x "$APP_PATH/start-gui.command"
chmod +x "$APP_PATH/node/bin/node"
chmod +x "$APP_PATH/node/bin/npm"

# 创建命令行别名（可选）
echo ""
read -p "是否添加 clawbotcn 到命令行？[Y/n] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    SHELL_RC="$HOME/.zshrc"
    if [ -f "$HOME/.bashrc" ] && [ ! -f "$HOME/.zshrc" ]; then
        SHELL_RC="$HOME/.bashrc"
    fi
    
    echo "" >> "$SHELL_RC"
    echo "# ClawbotCN" >> "$SHELL_RC"
    echo "export PATH=\"$APP_PATH:\$PATH\"" >> "$SHELL_RC"
    echo "✅ 已添加到 $SHELL_RC"
    echo "   请运行 source $SHELL_RC 或重新打开终端"
fi

echo ""
echo "✅ 安装完成！"
echo ""
echo "启动方式："
echo "  • 双击 $APP_PATH/start-gui.command"
echo "  • 或在终端运行: $APP_PATH/clawbotcn"
```

### 安装流程图

```
用户下载 ZIP
      │
      ▼
双击解压 ZIP
      │
      ▼
移动到 /Applications
      │
      ▼
┌─────────────────────┐
│  运行安装脚本       │
│  或手动 xattr -cr   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  首次运行           │
│  配置向导启动       │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  设置 API Key       │
│  选择消息渠道       │
│  配置沙盒级别       │
└─────────┬───────────┘
          │
          ▼
      完成安装
```

---

## 目录结构

### 安装后目录结构

```
/Applications/ClawbotCN/
├── node/                         # Node.js Portable
│   ├── bin/
│   │   ├── node
│   │   └── npm
│   └── lib/
├── app/                          # ClawbotCN 核心
│   ├── dist/                     # 编译后的代码
│   ├── node_modules/             # 依赖
│   └── package.json
├── extensions/                   # 扩展插件
│   ├── msteams/
│   ├── matrix/
│   └── ...
├── config/                       # 配置文件
│   ├── sandbox-mac.json          # 沙盒配置
│   └── settings.json             # 主配置（首次运行后生成）
├── clawbotcn                     # CLI 启动脚本
├── start-gui.command             # GUI 启动脚本（双击运行）
├── install.sh                    # 安装辅助脚本
├── uninstall.sh                  # 卸载脚本
└── version.json                  # 版本信息
```

### 用户数据目录

```
~/.clawbotcn/
├── config/                       # 用户配置
│   ├── settings.json
│   └── credentials/              # 凭证 (加密)
├── workspace/                    # 沙盒工作目录
│   └── (用户项目文件)
├── sessions/                     # 会话记录
├── agents/                       # Agent 数据
├── logs/                         # 日志
├── temp/                         # 临时文件
└── downloads/                    # 下载文件
```

---

## 增量更新机制

### 更新策略

| 更新类型 | 触发条件 | 下载内容 | 大小 |
|---------|---------|---------|------|
| **核心更新** | ClawbotCN 版本变化 | dist/ + 配置 | ~15 MB |
| **依赖更新** | node_modules 变化 | 差异包 | ~10-40 MB |
| **扩展更新** | extensions 变化 | 单个扩展 | ~1-5 MB |
| **全量更新** | 主版本升级 | 完整包 | ~100 MB |

### 更新检查脚本

```bash
#!/bin/bash
# scripts/check-update.sh

CURRENT_VERSION=$(cat /Applications/ClawbotCN/version.json | grep '"version"' | cut -d'"' -f4)
LATEST_URL="https://your-server.com/clawbotcn/latest.json"

echo "当前版本: $CURRENT_VERSION"
echo "检查更新..."

LATEST=$(curl -s "$LATEST_URL")
LATEST_VERSION=$(echo "$LATEST" | grep '"version"' | cut -d'"' -f4)

if [ "$CURRENT_VERSION" != "$LATEST_VERSION" ]; then
    echo "发现新版本: $LATEST_VERSION"
    echo "下载地址: $(echo "$LATEST" | grep '"downloadUrl"' | cut -d'"' -f4)"
else
    echo "已是最新版本"
fi
```

### 更新清单 (`latest.json`)

```json
{
  "version": "1.0.1",
  "releaseDate": "2026-02-01",
  "downloads": {
    "arm64": {
      "url": "https://your-server.com/releases/ClawbotCN-macOS-v1.0.1-arm64.zip",
      "size": 104857600,
      "sha256": "abc123..."
    },
    "x64": {
      "url": "https://your-server.com/releases/ClawbotCN-macOS-v1.0.1-x64.zip",
      "size": 104857600,
      "sha256": "def456..."
    },
    "universal": {
      "url": "https://your-server.com/releases/ClawbotCN-macOS-v1.0.1-universal.zip",
      "size": 157286400,
      "sha256": "ghi789..."
    }
  },
  "releaseNotes": "修复了若干问题，提升了稳定性",
  "minOSVersion": "15.0"
}
```

---

## 卸载

### 卸载脚本

```bash
#!/bin/bash
# uninstall.sh

echo "🗑  ClawbotCN 卸载程序"
echo ""

read -p "是否删除所有用户数据？[y/N] " -n 1 -r
echo

# 删除应用
echo "删除应用程序..."
rm -rf /Applications/ClawbotCN

# 删除用户数据（可选）
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "删除用户数据..."
    rm -rf ~/.clawbotcn
fi

# 清理 PATH（如果添加过）
echo "清理 shell 配置..."
sed -i '' '/ClawbotCN/d' ~/.zshrc 2>/dev/null || true
sed -i '' '/ClawbotCN/d' ~/.bashrc 2>/dev/null || true

echo ""
echo "✅ 卸载完成"
```

---

## 常见问题

### Q1: 双击无法打开，提示"无法验证开发者"怎么办？

这是因为 ClawbotCN 未经过 Apple 签名。解决方法：

**方法一**（推荐）：打开终端，执行：
```bash
xattr -cr /Applications/ClawbotCN
```

**方法二**：
1. 尝试双击打开（会被阻止）
2. 打开「系统设置」→「隐私与安全性」
3. 向下滚动找到 ClawbotCN 的提示
4. 点击「仍要打开」

### Q2: 软沙盒的安全性如何？

软沙盒提供基本保护：
- ✅ 目录隔离：AI 只能访问工作目录
- ✅ 命令过滤：禁止危险系统命令
- ⚠️ 非内核级：无法阻止所有恶意行为

**建议**：在专用设备或虚拟机中运行，不要在存储重要数据的主力 Mac 上关闭沙盒。

### Q3: 如何判断我的 Mac 是什么架构？

点击左上角 Apple 菜单 →「关于本机」：
- 显示 "Apple M1/M2/M3/M4" → 下载 **arm64** 版本
- 显示 "Intel" → 下载 **x64** 版本
- 不确定 → 下载 **universal** 版本

### Q4: 为什么包这么大？

主要组成：
- Node.js 运行时：~25 MB（必需）
- 核心程序：~15 MB
- 依赖库：~50 MB
- 扩展插件：~10 MB

这是便携版的代价，好处是无需用户单独安装 Node.js。

### Q5: 可以关闭沙盒保护吗？

可以，但不推荐：

```bash
clawbotcn config set agents.defaults.sandbox.mode off
```

⚠️ **警告**：关闭后 AI 可访问系统任意位置，仅建议在专用设备上关闭。

### Q6: 如何更新到新版本？

目前需要手动更新：
1. 下载新版本 ZIP
2. 删除旧的 `/Applications/ClawbotCN`
3. 解压新版本到 `/Applications`
4. 运行 `xattr -cr /Applications/ClawbotCN`

用户配置保存在 `~/.clawbotcn`，不会丢失。

### Q7: 支持哪些 macOS 版本？

当前需要 **macOS 15 (Sequoia)** 或更高版本。

较旧的 macOS 版本（如 Monterey、Ventura、Sonoma）暂不支持，因为 Swift App 部分使用了 macOS 15 的 API。

---

## 版本对比总结

### ClawbotCN macOS vs Windows

| 对比项 | macOS | Windows Lite | Windows Pro |
|--------|-------|--------------|-------------|
| **打包格式** | ZIP | ZIP / EXE | ZIP / EXE |
| **安装包大小** | ~100-150 MB | ~140 MB | ~140-760 MB |
| **需要签名** | ❌ | ❌ | ❌ |
| **沙盒类型** | 软沙盒 | 软沙盒 | Docker |
| **隔离级别** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **小白友好** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **首次运行** | 需 xattr 或右键 | 直接运行 | 可能需重启 |

---

## 更新日志

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| 1.0.0 | 2026-01-29 | 初始版本，支持 macOS 15+ |

---

*文档最后更新：2026-01-29*
