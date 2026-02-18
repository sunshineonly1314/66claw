#!/usr/bin/env bash
###############################################################################
# Windows 远程构建脚本
# 通过 SSH 连接到 Windows 机器，使用 PowerShell 执行构建
# 注意: Windows SSH 默认 shell 是 cmd.exe，需要显式调用 powershell
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
WIN_REPO=$(node -p "require('$CONFIG_FILE_WIN').builders.windows.gitee_repo" 2>/dev/null || echo "https://gitee.com/sunshine1314/openclawcn.git")

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

# Windows SSH shell 是 cmd.exe，需要用 powershell -Command 执行
# 构建 PowerShell 命令字符串
PS_CMD=$(cat <<PSEOF
\$ErrorActionPreference = 'Stop'
\$WORKSPACE = 'D:\\cicd-workspace\\openclawcn'
\$REPO = '${WIN_REPO}'
\$VERSION = '${VERSION}'
\$MODE = '${MODE}'

Write-Host '📂 Preparing workspace:' \$WORKSPACE
Write-Host '✅ Node:' (node --version)

# 创建工作目录
if (-not (Test-Path \$WORKSPACE)) { New-Item -ItemType Directory -Path \$WORKSPACE -Force | Out-Null }
Set-Location \$WORKSPACE

# 克隆或更新仓库
if (Test-Path '.git') {
    Write-Host '📥 Updating existing repository...'
    git fetch origin
    git reset --hard origin/master
} else {
    Write-Host '📥 Cloning repository from Gitee...'
    git clone \$REPO .
}

Write-Host '✅ Current commit:' (git rev-parse HEAD)
Write-Host '✅ Current branch:' (git branch --show-current)

# 安装依赖
Write-Host '📦 Installing dependencies...'
npm install

# 执行构建
Write-Host '🔨 Starting Windows build...'
\$buildArgs = @('-Mode', \$MODE, '-MaxThreads', '6')
if (\$VERSION) { \$buildArgs += @('-Version', \$VERSION) }

& '.\\build\\scripts\\windows\\build-windows.ps1' @buildArgs

# 检查构建产物
\$artifacts = Get-ChildItem -Path 'E:\\clawdbuild\\ClawdbotCN-Setup-*.exe' -ErrorAction SilentlyContinue
if (\$artifacts) {
    Write-Host '✅ Build completed successfully!'
    \$artifacts | ForEach-Object { Write-Host ('  ' + \$_.Name + ' (' + [math]::Round(\$_.Length/1MB, 1) + ' MB)') }
} else {
    Write-Host '❌ Build failed - no installer found'
    exit 1
}
PSEOF
)

# 通过 SSH 执行远程构建 (用 powershell -Command)
echo "🚀 Executing remote build..."
ssh -o StrictHostKeyChecking=no "$WIN_USER@$WIN_HOST" \
  "powershell -ExecutionPolicy Bypass -Command \"$PS_CMD\""

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
