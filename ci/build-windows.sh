#!/usr/bin/env bash
###############################################################################
# Windows 远程构建脚本
# 通过 SSH 连接到 Windows 机器，先上传 PS1 脚本再执行
# 注意: Windows SSH 默认 shell 是 cmd.exe
###############################################################################

set -e

# 用 PowerShell 封装 ssh/scp（Git bash 里 E: 盘路径不可访问）
SSH="powershell -NoProfile -Command ssh"
SCP="powershell -NoProfile -Command scp"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.json"

# Convert path for Windows if needed (use forward slashes for node require)
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
WIN_HOST=$(node -p "require('$CONFIG_FILE_WIN').builders.windows.host")
WIN_USER=$(node -p "require('$CONFIG_FILE_WIN').builders.windows.user")
WIN_REPO=$(node -p "require('$CONFIG_FILE_WIN').builders.windows.gitee_repo")

# 参数解析（位置参数 + 命名参数）
VERSION=""
SKIP_DEPLOY=false
DEPLOY_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --skip-deploy) SKIP_DEPLOY=true ;;
    --deploy-only) DEPLOY_ONLY=true ;;
    -*)            ;; # ignore unknown flags
    *)
      if [ -z "$VERSION" ]; then VERSION="$arg"; fi
      ;;
  esac
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🪟 Windows 远程构建"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Target: $WIN_USER@$WIN_HOST"
echo "Version: ${VERSION:-auto}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 创建临时 PS1 脚本
TEMP_PS1=$(mktemp /tmp/win-build-XXXXXX.ps1)
cat > "$TEMP_PS1" << PSEOF
\$ErrorActionPreference = 'Stop'
\$WORKSPACE = 'D:\cicd-workspace\openclawcn'
\$REPO = '$WIN_REPO'
\$VERSION = '$VERSION'
\$SKIP_DEPLOY = '$SKIP_DEPLOY'
\$DEPLOY_ONLY = '$DEPLOY_ONLY'

# Fix PATH: Git Bash before WSL bash, pnpm/node available
\$gitBashDir = 'C:\Program Files\Git\bin'
\$gitUsrBin = 'C:\Program Files\Git\usr\bin'
if (Test-Path \$gitBashDir) {
    \$env:PATH = "\$gitBashDir;\$gitUsrBin;" + \$env:PATH
    Write-Host "PATH fix: Git Bash prepended (avoids WSL bash)"
}

Write-Host "Preparing workspace: \$WORKSPACE"
Write-Host "Node: \$(node --version)"
Write-Host "bash: \$(where.exe bash 2>\$null | Select-Object -First 1)"

if (-not (Test-Path \$WORKSPACE)) {
    New-Item -ItemType Directory -Path \$WORKSPACE -Force | Out-Null
}
Set-Location \$WORKSPACE

if (Test-Path '.git') {
    Write-Host "Updating existing repository..."
    git fetch origin
    git reset --hard origin/master
} else {
    Write-Host "Cloning repository from Gitee..."
    git clone \$REPO .
}

Write-Host "Current commit: \$(git rev-parse HEAD)"
Write-Host "Current branch: \$(git branch --show-current)"

Write-Host "Installing dependencies..."
pnpm install --no-frozen-lockfile

# Auto version bump
if (-not \$VERSION) {
    # Check if last commit is already a version bump (avoid multi-platform double bump)
    \$lastMsg = git log -1 --pretty=%s 2>\$null
    if (\$lastMsg -and \$lastMsg.StartsWith("chore: bump version to ")) {
        \$pkgJson = Get-Content 'package.json' -Raw | ConvertFrom-Json
        \$VERSION = \$pkgJson.version
        Write-Host "Version already bumped by another builder: \$VERSION (skipping)"
    } else {
        Write-Host ""
        Write-Host "========================================="
        Write-Host "  Auto Version Bump (patch +1)"
        Write-Host "========================================="
        & node --import tsx scripts/version-bump.ts patch
        \$pkgJson = Get-Content 'package.json' -Raw | ConvertFrom-Json
        \$VERSION = \$pkgJson.version
        Write-Host "Auto-bumped version: \$VERSION"

        # Commit version bump back to repo
        git add package.json apps/desktop/package.json apps/desktop/src-tauri/tauri.conf.json apps/macos/Sources/OpenClaw/Resources/Info.plist
        git commit -m "chore: bump version to \$VERSION"
        try { git push origin master } catch { Write-Host "WARNING: push failed (version may already be pushed)" }
        Write-Host "Version bump committed and pushed."
    }
}

\$tauriOutput = Join-Path \$WORKSPACE 'apps\desktop\src-tauri\target\release\bundle\nsis'

# Build phase (skip when --deploy-only)
if (\$DEPLOY_ONLY -ne 'true') {

# Rust environment check
if (-not (Get-Command "cargo" -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Rust/Cargo not found. Install from https://rustup.rs"
    exit 1
}
Write-Host "Cargo: \$(cargo --version)"

Write-Host "Starting Windows build (Tauri)..."
\$buildScript = Join-Path \$WORKSPACE 'scripts\desktop\build.ps1'
if (-not (Test-Path \$buildScript)) {
    Write-Host "ERROR: Build script not found: \$buildScript"
    Get-ChildItem 'scripts\desktop\' -ErrorAction SilentlyContinue
    exit 1
}

& powershell -NoProfile -ExecutionPolicy Bypass -File \$buildScript
if (\$LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Tauri build failed!"
    exit 1
}

\$artifacts = Get-ChildItem -Path "\$tauriOutput\*.exe" -ErrorAction SilentlyContinue
if (\$artifacts) {
    Write-Host "Build completed successfully!"
    \$artifacts | ForEach-Object { Write-Host ("  " + \$_.Name + " (" + [math]::Round(\$_.Length/1MB, 1) + " MB)") }
} else {
    Write-Host "Build failed - no installer found in \$tauriOutput"
    exit 1
}

} # end DEPLOY_ONLY check

# Release Deploy: generate delta packages + upload
# Skip when --skip-deploy (parallel build mode, upload is serialized by trigger-build.sh)
if (\$SKIP_DEPLOY -ne 'true') {

Write-Host ""
Write-Host "========================================="
Write-Host "  Release Deploy (Delta + Upload)"
Write-Host "========================================="

# Reset CWD back to workspace (build.ps1 subprocess may have changed it)
Set-Location \$WORKSPACE
Write-Host "CWD: \$(Get-Location)"

# Build phase reinstalls with --omit=dev, removing tsx
# Re-install all deps to ensure tsx is available for release-deploy
Write-Host "Re-installing dev dependencies for release-deploy..."
pnpm install --no-frozen-lockfile 2>\$null

\$releaseCacheDir = 'E:\openclawcn\.release-cache'
if (-not (Test-Path \$releaseCacheDir)) {
    New-Item -ItemType Directory -Path \$releaseCacheDir -Force | Out-Null
    Write-Host "Created release cache dir: \$releaseCacheDir"
}

# OSS env var check (read from system environment)
\$ossKeyId = \$env:OSS_ACCESS_KEY_ID
\$ossKeySecret = \$env:OSS_ACCESS_KEY_SECRET
if (-not \$ossKeyId -or -not \$ossKeySecret) {
    Write-Host "WARNING: OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET not set, using --output-only mode"
    Write-Host "Delta packages will be generated locally but NOT uploaded."
}

\$releaseArgs = @()
if (\$VERSION) { \$releaseArgs += @('-v', \$VERSION) }
\$releaseArgs += @('--cache-dir', \$releaseCacheDir)
\$releaseArgs += @('--platform', 'windows')
if (\$ossKeyId -and \$ossKeySecret) {
    \$releaseArgs += @('--oss', '--oss-domain', 'dl.obplugins.cn')
} else {
    \$releaseArgs += @('--output-only')
}
\$releaseArgs += @('--installers', \$tauriOutput)

# Switch to Continue so stderr from node/tsx doesn't trigger PS termination
\$ErrorActionPreference = 'Continue'
Write-Host "Running: node --import tsx scripts/release-deploy.ts \$(\$releaseArgs -join ' ')"
& node --import tsx scripts/release-deploy.ts @releaseArgs
if (\$LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Release deploy exited with code \$LASTEXITCODE"
    Write-Host "Build artifacts are still available, but delta packages may not have been published."
} else {
    Write-Host "Release deploy completed!"
}

} # end SKIP_DEPLOY check
PSEOF

# 上传 PS1 脚本到 Windows
echo "📤 Uploading build script..."
REMOTE_PS1="C:\\Users\\$WIN_USER\\cicd-build.ps1"
scp -o StrictHostKeyChecking=no "$TEMP_PS1" "$WIN_USER@$WIN_HOST:cicd-build.ps1"

# 上传 data/ 目录中的 MCP index 文件（.gitignore 排除了 data/，CI 需要手动传）
DATA_DIR="$SCRIPT_DIR/../data"
if [ -d "$DATA_DIR" ]; then
  echo "📦 Uploading data/ seed files to Windows builder..."
  ssh -o StrictHostKeyChecking=no "$WIN_USER@$WIN_HOST" \
    "if not exist D:\\cicd-workspace\\openclawcn\\data mkdir D:\\cicd-workspace\\openclawcn\\data"
  for df in mcp-index.json mcp-index-enhanced.json mcp-index.db tool-index.sqlite; do
    if [ -f "$DATA_DIR/$df" ]; then
      scp -o StrictHostKeyChecking=no "$DATA_DIR/$df" \
        "$WIN_USER@$WIN_HOST:D:/cicd-workspace/openclawcn/data/$df" && \
        echo "  Uploaded $df" || echo "  Failed to upload $df (non-fatal)"
    fi
  done
else
  echo "⚠️  WARNING: local data/ not found, MCP index will not be bundled"
fi

# 执行远程构建
echo "🚀 Executing remote build..."
# 直接用 ssh 而非 PowerShell 包装，确保退出码正确传递
ssh -o StrictHostKeyChecking=no "$WIN_USER@$WIN_HOST" \
  "powershell -ExecutionPolicy Bypass -File C:\\Users\\$WIN_USER\\cicd-build.ps1"

BUILD_EXIT=$?
echo "[build-windows.sh] Remote SSH exit code: $BUILD_EXIT"
rm -f "$TEMP_PS1"

if [ $BUILD_EXIT -eq 0 ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ Windows build completed successfully!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  ARTIFACTS_DIR="$SCRIPT_DIR/artifacts/windows"
  mkdir -p "$ARTIFACTS_DIR"

  # Tauri NSIS output: D:\cicd-workspace\openclawcn\apps\desktop\src-tauri\target\release\bundle\nsis\
  WIN_TAURI_OUTPUT="D:/cicd-workspace/openclawcn/apps/desktop/src-tauri/target/release/bundle/nsis"

  echo "📥 Downloading artifacts to $ARTIFACTS_DIR..."
  scp "$WIN_USER@$WIN_HOST:$WIN_TAURI_OUTPUT/*.exe" "$ARTIFACTS_DIR/" || echo "⚠️  Download failed, but build succeeded"

  exit 0
else
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "❌ Windows build failed!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
