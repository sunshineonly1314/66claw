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

# 参数
VERSION="${1:-}"

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

Write-Host "Preparing workspace: \$WORKSPACE"
Write-Host "Node: \$(node --version)"

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
npm install --no-fund --no-audit

# ── Auto version bump ──
if (-not \$VERSION) {
    # 检查最新 commit 是否已经是 version bump（避免多平台重复 bump）
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

# ── Rust 环境检查 ──
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

\$tauriOutput = Join-Path \$WORKSPACE 'apps\desktop\src-tauri\target\release\bundle\nsis'
\$artifacts = Get-ChildItem -Path "\$tauriOutput\*.exe" -ErrorAction SilentlyContinue
if (\$artifacts) {
    Write-Host "Build completed successfully!"
    \$artifacts | ForEach-Object { Write-Host ("  " + \$_.Name + " (" + [math]::Round(\$_.Length/1MB, 1) + " MB)") }
} else {
    Write-Host "Build failed - no installer found in \$tauriOutput"
    exit 1
}

# ── Release Deploy: 生成增量包 + 上传 ──
Write-Host ""
Write-Host "========================================="
Write-Host "  Release Deploy (Delta + Upload)"
Write-Host "========================================="

# 构建阶段会用 --omit=dev 重装 node_modules，tsx 被移除
# 这里重新安装全部依赖以确保 tsx 可用
Write-Host "Re-installing dev dependencies for release-deploy..."
npm install --no-fund --no-audit 2>\$null

\$releaseCacheDir = 'E:\openclawcn\.release-cache'

# OSS 环境变量检查（从系统环境变量读取）
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
    \$releaseArgs += @('--notify-url', 'https://dl.obplugins.cn/api/v1/release/notify')
} else {
    \$releaseArgs += @('--output-only')
}
\$releaseArgs += @('--installers', \$tauriOutput)

Write-Host "Running: node --import tsx scripts/release-deploy.ts \$(\$releaseArgs -join ' ')"
& node --import tsx scripts/release-deploy.ts @releaseArgs
if (\$LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Release deploy exited with code \$LASTEXITCODE"
    Write-Host "Build artifacts are still available, but delta packages may not have been published."
} else {
    Write-Host "Release deploy completed!"
}
PSEOF

# 上传 PS1 脚本到 Windows
echo "📤 Uploading build script..."
REMOTE_PS1="C:\\Users\\$WIN_USER\\cicd-build.ps1"
$SCP -o StrictHostKeyChecking=no "$TEMP_PS1" "$WIN_USER@$WIN_HOST:cicd-build.ps1"

# 执行远程构建
echo "🚀 Executing remote build..."
$SSH -o StrictHostKeyChecking=no "$WIN_USER@$WIN_HOST" \
  "powershell -ExecutionPolicy Bypass -File C:\\Users\\$WIN_USER\\cicd-build.ps1"

BUILD_EXIT=$?
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
  $SCP "$WIN_USER@$WIN_HOST:$WIN_TAURI_OUTPUT/*.exe" "$ARTIFACTS_DIR/" || echo "⚠️  Download failed, but build succeeded"

  exit 0
else
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "❌ Windows build failed!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
