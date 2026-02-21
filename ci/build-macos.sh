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

# 参数解析（支持命名参数和位置参数）
VERSION=""
ARCH="universal"
VALIDATE_FLAG=""
SKIP_DEPLOY=false
DEPLOY_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --arch)    ARCH="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --validate|--validate-full) VALIDATE_FLAG="$1"; shift ;;
    --skip-deploy) SKIP_DEPLOY=true; shift ;;
    --deploy-only) DEPLOY_ONLY=true; shift ;;
    -*)        echo "Unknown option: $1" >&2; exit 1 ;;
    *)
      # Legacy positional args: VERSION ARCH VALIDATE
      if [ -z "$VERSION" ]; then VERSION="$1"
      elif [ "$ARCH" = "universal" ]; then ARCH="$1"
      else VALIDATE_FLAG="$1"
      fi
      shift ;;
  esac
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "macOS 远程构建"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Target: $MAC_USER@$MAC_HOST"
echo "Workspace: $MAC_WORKSPACE"
echo "Version: ${VERSION:-auto}"
echo "Arch: $ARCH"
echo "Validate: ${VALIDATE_FLAG:-basic}"
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
VALIDATE_FLAG="$VALIDATE_FLAG"
SKIP_DEPLOY="$SKIP_DEPLOY"
DEPLOY_ONLY="$DEPLOY_ONLY"

echo "Preparing workspace: \$WORKSPACE"

# 设置 PATH - 确保 node/npm/pnpm 可用
export PATH="/usr/local/lib/nodejs/node-v22.16.0-darwin-arm64/bin:/opt/homebrew/bin:/usr/local/bin:\$PATH"
# 加载环境变量（SSH 非交互式 session 不会自动 source profile）
# NOTE: Must disable set -e before sourcing — .bashrc may contain commands
# that return non-zero (e.g. cargo env), which would abort our script.
set +e
for f in ~/.bash_profile ~/.bashrc ~/.zprofile ~/.profile; do
  [ -f "\$f" ] && source "\$f" 2>/dev/null
done
set -e
# Re-prepend Node v22.16.0 to PATH AFTER profile sourcing, so it takes priority
# over homebrew's Node (which may be a different major version like v25.x)
export PATH="/usr/local/lib/nodejs/node-v22.16.0-darwin-arm64/bin:\$PATH"
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

# ── Auto version bump ──
if [ -z "\$VERSION" ]; then
  # 检查最新 commit 是否已经是 version bump（避免多平台重复 bump）
  LAST_MSG=\$(git log -1 --pretty=%s 2>/dev/null || echo "")
  if echo "\$LAST_MSG" | grep -q "^chore: bump version to "; then
    VERSION=\$(node -p "require('./package.json').version")
    echo "Version already bumped by another builder: \$VERSION (skipping)"
  else
    echo ""
    echo "========================================="
    echo "  Auto Version Bump (patch +1)"
    echo "========================================="
    # 优先用 pnpm tsx
    if command -v pnpm &> /dev/null; then
      pnpm tsx scripts/version-bump.ts patch
    else
      npx tsx scripts/version-bump.ts patch
    fi
    VERSION=\$(node -p "require('./package.json').version")
    echo "Auto-bumped version: \$VERSION"

    # Commit version bump back to repo
    git add package.json apps/desktop/package.json apps/desktop/src-tauri/tauri.conf.json apps/macos/Sources/OpenClaw/Resources/Info.plist
    git commit -m "chore: bump version to \$VERSION" || echo "No changes to commit"
    git push origin master || echo "WARNING: push failed (version may already be pushed)"
    echo "Version bump committed and pushed."
  fi
fi

export VERSION="\$VERSION"

# Tauri 输出路径（根据 target 不同而不同）
case "\$ARCH" in
  arm64)     TAURI_TARGET="aarch64-apple-darwin" ;;
  x64)       TAURI_TARGET="x86_64-apple-darwin" ;;
  universal) TAURI_TARGET="universal-apple-darwin" ;;
  *)         TAURI_TARGET="" ;;
esac

if [ -n "\$TAURI_TARGET" ]; then
  TAURI_BUNDLE_DIR="apps/desktop/src-tauri/target/\$TAURI_TARGET/release/bundle"
else
  TAURI_BUNDLE_DIR="apps/desktop/src-tauri/target/release/bundle"
fi

DMG_DIR="\$TAURI_BUNDLE_DIR/dmg"
APP_DIR="\$TAURI_BUNDLE_DIR/macos"

# ── 构建阶段（--deploy-only 时跳过） ──
if [ "\$DEPLOY_ONLY" != "true" ]; then

# 确保 Rust/Cargo 可用
source "\$HOME/.cargo/env" 2>/dev/null || true
if command -v cargo &> /dev/null; then
  echo "Cargo: \$(cargo --version)"
else
  echo "ERROR: Rust/Cargo not found. Install from https://rustup.rs"
  exit 1
fi

# 执行构建（Tauri，与 Windows 一致）
echo "Starting macOS build (Tauri)..."

BUILD_SCRIPT="scripts/desktop/build.sh"
if [ -f "\$BUILD_SCRIPT" ]; then
  chmod +x "\$BUILD_SCRIPT"
else
  echo "ERROR: Build script not found: \$BUILD_SCRIPT"
  ls -la scripts/desktop/ 2>/dev/null || echo "scripts/desktop/ not found"
  exit 1
fi

bash "\$BUILD_SCRIPT" --arch "\$ARCH"

# 检查构建产物
if ls "\$DMG_DIR"/*.dmg 1> /dev/null 2>&1; then
  echo "Build completed successfully!"
  ls -lh "\$DMG_DIR"/*.dmg
else
  echo "Build failed - no DMG found in \$DMG_DIR"
  ls -la "\$TAURI_BUNDLE_DIR/" 2>/dev/null || echo "bundle dir not found"
  exit 1
fi

# ── Post-build validation ──
VALIDATION_SCRIPT="scripts/macos/post-build-validation.sh"
APP_BUNDLE="\$(find \$APP_DIR -name '*.app' -maxdepth 1 2>/dev/null | head -1)"
VALIDATION_LOG_DIR="build/output/validation-logs"

if [ -f "\$VALIDATION_SCRIPT" ] && [ -d "\$APP_BUNDLE" ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Running post-build validation..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  chmod +x "\$VALIDATION_SCRIPT"
  mkdir -p "\$VALIDATION_LOG_DIR"

  VALIDATE_ARGS="--app-dir \$APP_BUNDLE --log-dir \$VALIDATION_LOG_DIR"
  if [ "\$VALIDATE_FLAG" != "--validate-full" ]; then
    VALIDATE_ARGS="\$VALIDATE_ARGS --skip-websocket"
  fi

  if bash "\$VALIDATION_SCRIPT" \$VALIDATE_ARGS; then
    echo "Post-build validation: ALL PASSED"
  else
    echo "WARNING: Post-build validation had failures (build artifact still available)"
    if [ -f "\$VALIDATION_LOG_DIR/validation-report.txt" ]; then
      echo "--- Validation Report ---"
      cat "\$VALIDATION_LOG_DIR/validation-report.txt"
      echo "--- End Report ---"
    fi
  fi
else
  echo "Skipping post-build validation (script or .app not found)"
fi

fi # end DEPLOY_ONLY check

# ── Release Deploy: 生成增量包 + 上传（平台模式） ──
# --skip-deploy 时跳过（并行构建模式下，上传由 trigger-build.sh 串行调度）
if [ "\$SKIP_DEPLOY" != "true" ]; then

echo ""
echo "========================================="
echo "  Release Deploy (macOS - Delta + Upload)"
echo "========================================="

RELEASE_CACHE_DIR="\$WORKSPACE/.release-cache"
mkdir -p "\$RELEASE_CACHE_DIR"

# OSS 环境变量检查
OSS_KEY_ID="\${OSS_ACCESS_KEY_ID:-}"
OSS_KEY_SECRET="\${OSS_ACCESS_KEY_SECRET:-}"
if [ -z "\$OSS_KEY_ID" ] || [ -z "\$OSS_KEY_SECRET" ]; then
  echo "WARNING: OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET not set, using --output-only mode"
  echo "Delta packages will be generated locally but NOT uploaded."
fi

RELEASE_ARGS=""
if [ -n "\$VERSION" ]; then
  RELEASE_ARGS="\$RELEASE_ARGS -v \$VERSION"
fi
RELEASE_ARGS="\$RELEASE_ARGS --cache-dir \$RELEASE_CACHE_DIR"
RELEASE_ARGS="\$RELEASE_ARGS --platform macos"
if [ -n "\$OSS_KEY_ID" ] && [ -n "\$OSS_KEY_SECRET" ]; then
  RELEASE_ARGS="\$RELEASE_ARGS --oss --oss-domain dl.obplugins.cn"
  RELEASE_ARGS="\$RELEASE_ARGS --notify-url https://dl.obplugins.cn/api/v1/release/notify"
else
  RELEASE_ARGS="\$RELEASE_ARGS --output-only"
fi
RELEASE_ARGS="\$RELEASE_ARGS --installers \$DMG_DIR"

# 优先用 pnpm tsx（pnpm install 后 npx 可能找不到 tsx）
if command -v pnpm &> /dev/null; then
  TSX_CMD="pnpm tsx"
else
  TSX_CMD="npx tsx"
fi
echo "Running: \$TSX_CMD scripts/release-deploy.ts \$RELEASE_ARGS"
if \$TSX_CMD scripts/release-deploy.ts \$RELEASE_ARGS; then
  echo "Release deploy completed!"
else
  echo "WARNING: Release deploy failed (exit code \$?)"
  echo "Build artifacts are still available, but delta packages may not have been published."
fi

fi # end SKIP_DEPLOY check
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

# 上传 data/ 目录中的 MCP index 文件（.gitignore 排除了 data/，CI 需要手动传）
DATA_DIR="$SCRIPT_DIR/../data"
if [ -d "$DATA_DIR" ]; then
  echo "Uploading data/ seed files to Mac Mini..."
  $SSH -o StrictHostKeyChecking=no "$MAC_USER@$MAC_HOST" \
    "mkdir -p $MAC_WORKSPACE/data"
  for df in mcp-index.json mcp-index-enhanced.json mcp-index.db tool-index.sqlite; do
    if [ -f "$DATA_DIR/$df" ]; then
      $SCP -o StrictHostKeyChecking=no "$DATA_DIR/$df" \
        "$MAC_USER@$MAC_HOST:$MAC_WORKSPACE/data/$df" && \
        echo "  Uploaded $df" || echo "  Failed to upload $df (non-fatal)"
    fi
  done
else
  echo "WARNING: local data/ not found, MCP index will not be bundled"
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

  # Tauri 输出路径（与 ARCH 相关）
  case "$ARCH" in
    arm64)     TAURI_TARGET_LOCAL="aarch64-apple-darwin" ;;
    x64)       TAURI_TARGET_LOCAL="x86_64-apple-darwin" ;;
    universal) TAURI_TARGET_LOCAL="universal-apple-darwin" ;;
    *)         TAURI_TARGET_LOCAL="" ;;
  esac
  if [ -n "$TAURI_TARGET_LOCAL" ]; then
    REMOTE_DMG_DIR="$MAC_WORKSPACE/apps/desktop/src-tauri/target/$TAURI_TARGET_LOCAL/release/bundle/dmg"
  else
    REMOTE_DMG_DIR="$MAC_WORKSPACE/apps/desktop/src-tauri/target/release/bundle/dmg"
  fi

  echo "Downloading artifacts to $ARTIFACTS_DIR..."
  $SCP "$MAC_USER@$MAC_HOST:$REMOTE_DMG_DIR/*.dmg" "$ARTIFACTS_DIR/" || echo "Download failed, but build succeeded"
  $SCP "$MAC_USER@$MAC_HOST:$MAC_WORKSPACE/build/output/validation-logs/validation-report.txt" "$ARTIFACTS_DIR/" 2>/dev/null || true

  # Show validation report if downloaded
  REPORT_FILE="$ARTIFACTS_DIR/validation-report.txt"
  if [ -f "$REPORT_FILE" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Validation Report:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cat "$REPORT_FILE"
  fi

  exit 0
else
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "macOS build failed!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
