#!/usr/bin/env bash
###############################################################################
# macOS 远程构建脚本
# 通过 SSH 连接到 Mac Mini 并执行构建
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.json"

# Convert path for Windows if needed
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
  CONFIG_FILE_WIN=$(cygpath -w "$CONFIG_FILE" 2>/dev/null || echo "$CONFIG_FILE")
else
  CONFIG_FILE_WIN="$CONFIG_FILE"
fi

# 读取配置
if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ Config file not found: $CONFIG_FILE"
  exit 1
fi

# 解析配置
MAC_HOST=$(node -p "require('$CONFIG_FILE_WIN').builders.macos.host" 2>/dev/null || echo "192.168.0.107")
MAC_USER=$(node -p "require('$CONFIG_FILE_WIN').builders.macos.user" 2>/dev/null || echo "kevinsun")
MAC_WORKSPACE=$(node -p "require('$CONFIG_FILE_WIN').builders.macos.workspace" 2>/dev/null || echo "~/cicd-workspace/openclawcn")
MAC_REPO=$(node -p "require('$CONFIG_FILE_WIN').builders.macos.gitee_repo" 2>/dev/null || echo "git@gitee.com:sunshine1314/openclawcn.git")

# 参数
VERSION="${1:-}"
ARCH="${2:-universal}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🍎 macOS 远程构建"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Target: $MAC_USER@$MAC_HOST"
echo "Workspace: $MAC_WORKSPACE"
echo "Version: ${VERSION:-auto}"
echo "Arch: $ARCH"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 构建远程命令
REMOTE_CMD=$(cat <<'EOF'
set -e

WORKSPACE="$1"
REPO="$2"
VERSION="$3"
ARCH="$4"

echo "📂 Preparing workspace: $WORKSPACE"

# 设置 PATH - 确保 node/npm/pnpm 可用
export PATH="/usr/local/lib/nodejs/node-v22.14.0-darwin-arm64/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
echo "✅ Node: $(node --version 2>/dev/null || echo 'not found')"
echo "✅ pnpm: $(pnpm --version 2>/dev/null || echo 'not found')"

# 创建工作目录
mkdir -p "$WORKSPACE"
cd "$WORKSPACE"

# 克隆或更新仓库
if [ -d ".git" ]; then
  echo "📥 Updating existing repository..."
  git fetch origin
  git reset --hard origin/master
else
  echo "📥 Cloning repository from Gitee..."
  git clone "$REPO" .
fi

echo "✅ Current commit: $(git rev-parse HEAD)"
echo "✅ Current branch: $(git branch --show-current)"

# 安装依赖
echo "📦 Installing dependencies..."
if command -v pnpm &> /dev/null; then
  pnpm install --no-frozen-lockfile
else
  /usr/local/bin/npm install
fi

# 执行构建
echo "🔨 Starting macOS build..."

if [ -f "build/scripts/build-macos-cn.sh" ]; then
  chmod +x build/scripts/build-macos-cn.sh
else
  echo "❌ Build script not found: build/scripts/build-macos-cn.sh"
  ls -la build/scripts/ 2>/dev/null || echo "build/scripts/ not found"
  exit 1
fi

# 如果指定了版本，添加到环境变量
if [ -n "$VERSION" ]; then
  export BUILD_VERSION="$VERSION"
fi

bash build/scripts/build-macos-cn.sh --arch "$ARCH"

# 检查构建产物
if ls build/output/ClawdbotCN-macOS-*.dmg 1> /dev/null 2>&1; then
  echo "✅ Build completed successfully!"
  ls -lh build/output/ClawdbotCN-macOS-*.dmg
else
  echo "❌ Build failed - no DMG found"
  exit 1
fi
EOF
)

# 通过 SSH 执行远程构建
echo "🚀 Executing remote build..."
ssh -o StrictHostKeyChecking=no "$MAC_USER@$MAC_HOST" \
  "bash -s" -- "$MAC_WORKSPACE" "$MAC_REPO" "$VERSION" "$ARCH" <<< "$REMOTE_CMD"

BUILD_EXIT=$?

if [ $BUILD_EXIT -eq 0 ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ macOS build completed successfully!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # 下载构建产物 (可选)
  ARTIFACTS_DIR="$SCRIPT_DIR/artifacts/macos"
  mkdir -p "$ARTIFACTS_DIR"

  echo "📥 Downloading artifacts to $ARTIFACTS_DIR..."
  scp "$MAC_USER@$MAC_HOST:$MAC_WORKSPACE/build/output/ClawdbotCN-macOS-*.dmg" "$ARTIFACTS_DIR/" || echo "⚠️  Download failed, but build succeeded"
  scp "$MAC_USER@$MAC_HOST:$MAC_WORKSPACE/build/output/ClawdbotCN-macOS-*.dmg.sha256" "$ARTIFACTS_DIR/" 2>/dev/null || true

  exit 0
else
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "❌ macOS build failed!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
