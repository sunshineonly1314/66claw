#!/usr/bin/env bash
###############################################################################
# Windows 远程构建脚本
# 通过 SSH 连接到 Windows 机器并执行构建
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

# 解析配置 (使用 node 来解析 JSON)
WIN_HOST=$(node -p "require('$CONFIG_FILE_WIN').builders.windows.host" 2>/dev/null || echo "192.168.0.103")
WIN_USER=$(node -p "require('$CONFIG_FILE_WIN').builders.windows.user" 2>/dev/null || echo "SunBin")
WIN_WORKSPACE=$(node -p "require('$CONFIG_FILE_WIN').builders.windows.workspace" 2>/dev/null || echo "D:\\\\cicd-workspace\\\\openclawcn")
WIN_REPO=$(node -p "require('$CONFIG_FILE_WIN').builders.windows.gitee_repo" 2>/dev/null || echo "git@gitee.com:sunshine1314/openclawcn.git")

# 参数
VERSION="${1:-}"
MODE="${2:-standard}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🪟 Windows 远程构建"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Target: $WIN_USER@$WIN_HOST"
echo "Workspace: $WIN_WORKSPACE"
echo "Version: ${VERSION:-auto}"
echo "Mode: $MODE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 构建远程命令
REMOTE_CMD=$(cat <<'EOF'
set -e

WORKSPACE="$1"
REPO="$2"
VERSION="$3"
MODE="$4"

echo "📂 Preparing workspace: $WORKSPACE"

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
  npm install
fi

# 执行构建
echo "🔨 Starting Windows build..."

BUILD_ARGS="-Mode $MODE"
if [ -n "$VERSION" ]; then
  BUILD_ARGS="$BUILD_ARGS -Version $VERSION"
fi

# 调用 Windows 构建脚本
powershell.exe -ExecutionPolicy Bypass -File ".\build\scripts\windows\build-windows.ps1" $BUILD_ARGS -MaxThreads 6

# 检查构建产物
if ls E:\clawdbuild\ClawdbotCN-Setup-*.exe 1> /dev/null 2>&1; then
  echo "✅ Build completed successfully!"
  ls -lh E:\clawdbuild\ClawdbotCN-Setup-*.exe
else
  echo "❌ Build failed - no installer found"
  exit 1
fi
EOF
)

# 通过 SSH 执行远程构建
echo "🚀 Executing remote build..."
ssh -o StrictHostKeyChecking=no "$WIN_USER@$WIN_HOST" \
  "bash -s" -- "$WIN_WORKSPACE" "$WIN_REPO" "$VERSION" "$MODE" <<< "$REMOTE_CMD"

BUILD_EXIT=$?

if [ $BUILD_EXIT -eq 0 ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ Windows build completed successfully!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # 下载构建产物 (可选)
  ARTIFACTS_DIR="$SCRIPT_DIR/artifacts/windows"
  mkdir -p "$ARTIFACTS_DIR"

  echo "📥 Downloading artifacts to $ARTIFACTS_DIR..."
  scp "$WIN_USER@$WIN_HOST:E:/clawdbuild/ClawdbotCN-Setup-*.exe" "$ARTIFACTS_DIR/" || echo "⚠️  Download failed, but build succeeded"

  exit 0
else
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "❌ Windows build failed!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
