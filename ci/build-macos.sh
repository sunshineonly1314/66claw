#!/usr/bin/env bash
###############################################################################
# macOS 远程构建脚本
# 通过 SSH 连接到 Mac Mini 并执行构建
# 修复：改用 SCP 上传脚本 + SSH 执行（避免 PowerShell 封装下 stdin 传参失效）
###############################################################################

set -e

# 用 PowerShell 封装 ssh/scp（Git bash 里 E: 盘路径不可访问）
SSH="powershell -NoProfile -Command ssh"
SCP="powershell -NoProfile -Command scp"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.json"

# Convert path for Windows if needed
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
  CONFIG_FILE_WIN=$(cygpath -m "$CONFIG_FILE" 2>/dev/null || echo "$CONFIG_FILE")
else
  CONFIG_FILE_WIN="$CONFIG_FILE"
fi

# 读取配置
if [ ! -f "$CONFIG_FILE" ]; then
  echo "Config file not found: $CONFIG_FILE"
  exit 1
fi

# 解析配置（不使用 fallback 硬编码 IP，强制从 config.json 读取）
MAC_HOST=$(node -p "require('$CONFIG_FILE_WIN').builders.macos.host")
MAC_USER=$(node -p "require('$CONFIG_FILE_WIN').builders.macos.user")
MAC_WORKSPACE=$(node -p "require('$CONFIG_FILE_WIN').builders.macos.workspace")
MAC_REPO=$(node -p "require('$CONFIG_FILE_WIN').builders.macos.gitee_repo")

# 参数
VERSION="${1:-}"
ARCH="${2:-universal}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "macOS 远程构建"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Target: $MAC_USER@$MAC_HOST"
echo "Workspace: $MAC_WORKSPACE"
echo "Version: ${VERSION:-auto}"
echo "Arch: $ARCH"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 创建临时构建脚本（与 Windows 一致的 SCP+SSH 方式）
TEMP_SH=$(mktemp /tmp/mac-build-XXXXXX.sh)
cat > "$TEMP_SH" << SHEOF
#!/usr/bin/env bash
set -e

WORKSPACE="$MAC_WORKSPACE"
REPO="$MAC_REPO"
VERSION="$VERSION"
ARCH="$ARCH"

echo "Preparing workspace: \$WORKSPACE"

# 设置 PATH - 确保 node/npm/pnpm 可用
export PATH="/usr/local/lib/nodejs/node-v22.14.0-darwin-arm64/bin:/opt/homebrew/bin:/usr/local/bin:\$PATH"
echo "Node: \$(node --version 2>/dev/null || echo 'not found')"
echo "pnpm: \$(pnpm --version 2>/dev/null || echo 'not found')"

# 强制 git 用 HTTPS 而非 SSH 访问 GitHub（Mac Mini 没有配置 GitHub SSH key）
# 需要同时覆盖 git:// 和 git+ssh:// 协议，pnpm 可能使用任一种
git config --global url."https://github.com/".insteadOf "git+ssh://git@github.com/"
git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"
git config --global url."https://github.com/".insteadOf "git://github.com/"
git config --global url."https://github.com/".insteadOf "git@github.com:"
echo "Git insteadOf configured: SSH -> HTTPS for github.com"

# 创建工作目录
mkdir -p "\$WORKSPACE"
cd "\$WORKSPACE"

# 克隆或更新仓库
if [ -d ".git" ]; then
  echo "Updating existing repository..."
  git fetch origin
  git reset --hard origin/master
else
  echo "Cloning repository from Gitee..."
  git clone "\$REPO" .
fi

echo "Current commit: \$(git rev-parse HEAD)"
echo "Current branch: \$(git branch --show-current)"

# 安装依赖
# 优先使用 --frozen-lockfile 避免 pnpm 重新 resolve git+ssh 依赖（Mac Mini 没有 GitHub SSH key）
# lockfile 中已有 HTTPS tarball URL，frozen 模式直接使用，不会触发 git ls-remote
echo "Installing dependencies..."
if command -v pnpm &> /dev/null; then
  pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile
else
  /usr/local/bin/npm install
fi

# 执行构建
echo "Starting macOS build..."

if [ -f "build/scripts/build-macos-cn.sh" ]; then
  chmod +x build/scripts/build-macos-cn.sh
else
  echo "ERROR: Build script not found: build/scripts/build-macos-cn.sh"
  ls -la build/scripts/ 2>/dev/null || echo "build/scripts/ not found"
  exit 1
fi

# 如果指定了版本，添加到环境变量
if [ -n "\$VERSION" ]; then
  export BUILD_VERSION="\$VERSION"
fi

# build-macos-cn.sh 已内置 SKIP_CODESIGN=1 默认值，无需 sed patch
SKIP_CODESIGN=1 bash build/scripts/build-macos-cn.sh --arch "\$ARCH"

# 检查构建产物
if ls build/output/ClawdbotCN-macOS-*.dmg 1> /dev/null 2>&1; then
  echo "Build completed successfully!"
  ls -lh build/output/ClawdbotCN-macOS-*.dmg
else
  echo "Build failed - no DMG found"
  exit 1
fi
SHEOF

# 上传构建脚本到 Mac Mini
echo "Uploading build script..."
TEMP_SH_POSIX=$(echo "$TEMP_SH" | sed 's|\\|/|g')
$SCP -o StrictHostKeyChecking=no "$TEMP_SH_POSIX" "$MAC_USER@$MAC_HOST:cicd-build-mac.sh"
if [ $? -ne 0 ]; then
  echo "SCP upload failed"
  rm -f "$TEMP_SH"
  exit 1
fi

# 通过 SSH 执行远程构建
echo "Executing remote build..."
$SSH -o StrictHostKeyChecking=no "$MAC_USER@$MAC_HOST" \
  "bash ~/cicd-build-mac.sh"

BUILD_EXIT=$?
rm -f "$TEMP_SH"

if [ $BUILD_EXIT -eq 0 ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "macOS build completed successfully!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # 下载构建产物
  ARTIFACTS_DIR="$SCRIPT_DIR/artifacts/macos"
  mkdir -p "$ARTIFACTS_DIR"

  echo "Downloading artifacts to $ARTIFACTS_DIR..."
  $SCP "$MAC_USER@$MAC_HOST:$MAC_WORKSPACE/build/output/ClawdbotCN-macOS-*.dmg" "$ARTIFACTS_DIR/" || echo "Download failed, but build succeeded"
  $SCP "$MAC_USER@$MAC_HOST:$MAC_WORKSPACE/build/output/ClawdbotCN-macOS-*.dmg.sha256" "$ARTIFACTS_DIR/" 2>/dev/null || true

  exit 0
else
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "macOS build failed!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
