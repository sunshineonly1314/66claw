# Clawdbot 自动打包和部署脚本 (Windows PowerShell)
# 部署目标: WSL Ubuntu (kslinux@kevinUp)
# 目标路径: /home/clawdbot

# 设置 UTF-8 编码，避免中文乱码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

param(
    [switch]$SkipBuild,
    [switch]$OnlyBuild,
    [string]$WSLHost = "kevinUp",
    [string]$WSLUser = "kslinux",
    [string]$RemotePath = "/home/clawdbot"
)

$ErrorActionPreference = "Stop"

# 颜色输出函数
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Cyan }
function Write-Success { Write-Host "[OK] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $args" -ForegroundColor Red }

# 项目根目录
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path "$ProjectRoot\package.json")) {
    $ProjectRoot = Split-Path -Parent $PSScriptRoot
}

Write-Info "项目根目录: $ProjectRoot"

# 切换到项目根目录
Push-Location $ProjectRoot

try {
    # ========== 步骤 1: 构建项目 ==========
    if (-not $SkipBuild) {
        Write-Info "开始构建项目..."
        
        # 检查 pnpm 是否可用
        if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
            Write-Err "pnpm 未安装，请先安装: npm install -g pnpm"
            exit 1
        }

        # 安装依赖
        Write-Info "安装依赖..."
        pnpm install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) {
            Write-Err "依赖安装失败"
            exit 1
        }

        # 构建
        Write-Info "执行构建..."
        pnpm build
        if ($LASTEXITCODE -ne 0) {
            Write-Err "构建失败"
            exit 1
        }

        # 构建 UI
        Write-Info "构建 UI..."
        pnpm ui:install
        pnpm ui:build
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "UI 构建失败，但将继续部署"
        }

        Write-Success "构建完成"
    } else {
        Write-Info "跳过构建步骤"
    }

    if ($OnlyBuild) {
        Write-Success "仅构建模式，跳过部署"
        exit 0
    }

    # ========== 步骤 2: 准备部署包 ==========
    Write-Info "准备部署包..."
    
    $DeployDir = "$ProjectRoot\scripts\deploy\.deploy-staging"
    if (Test-Path $DeployDir) {
        Remove-Item -Recurse -Force $DeployDir
    }
    New-Item -ItemType Directory -Path $DeployDir -Force | Out-Null

    # 复制必要文件
    $FilesToCopy = @(
        "dist",
        "docs",
        "extensions",
        "assets",
        "skills",
        "patches",
        "scripts",
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        ".npmrc"
    )

    foreach ($item in $FilesToCopy) {
        $source = Join-Path $ProjectRoot $item
        if (Test-Path $source) {
            $dest = Join-Path $DeployDir $item
            if ((Get-Item $source).PSIsContainer) {
                Copy-Item -Recurse -Force $source $dest
            } else {
                Copy-Item -Force $source $dest
            }
            Write-Info "  复制: $item"
        }
    }

    # 复制 UI 目录
    if (Test-Path "$ProjectRoot\ui") {
        Copy-Item -Recurse -Force "$ProjectRoot\ui" "$DeployDir\ui"
        Write-Info "  复制: ui"
    }

    # 复制部署脚本
    Copy-Item -Force "$ProjectRoot\scripts\deploy\setup.sh" "$DeployDir\"
    Copy-Item -Force "$ProjectRoot\scripts\deploy\start.sh" "$DeployDir\"
    Copy-Item -Force "$ProjectRoot\scripts\deploy\stop.sh" "$DeployDir\"
    Copy-Item -Force "$ProjectRoot\scripts\deploy\status.sh" "$DeployDir\"

    Write-Success "部署包准备完成"

    # ========== 步骤 3: 部署到 WSL ==========
    Write-Info "开始部署到 WSL..."
    Write-Info "目标: $WSLUser@$WSLHost:$RemotePath"

    # 将 Windows 路径转换为 WSL 路径
    $WslDeployDir = wsl wslpath -u ($DeployDir -replace '\\', '/')
    
    # 检查 WSL 是否可用
    $wslCheck = wsl -l -v 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Err "WSL 不可用，请确保已安装 WSL"
        exit 1
    }

    # 在 WSL 中执行部署
    Write-Info "创建远程目录..."
    wsl -u $WSLUser bash -c "mkdir -p $RemotePath"

    Write-Info "同步文件到 WSL..."
    wsl -u $WSLUser bash -c "rsync -av --delete '$WslDeployDir/' '$RemotePath/'"
    if ($LASTEXITCODE -ne 0) {
        # rsync 不可用时使用 cp
        Write-Warn "rsync 不可用，使用 cp 复制..."
        wsl -u $WSLUser bash -c "rm -rf '$RemotePath'/* && cp -r '$WslDeployDir'/* '$RemotePath/'"
    }

    Write-Info "设置脚本执行权限..."
    wsl -u $WSLUser bash -c "chmod +x '$RemotePath'/*.sh"

    Write-Info "运行安装脚本..."
    wsl -u $WSLUser bash -c "cd '$RemotePath' && ./setup.sh"
    if ($LASTEXITCODE -ne 0) {
        Write-Err "安装脚本执行失败"
        exit 1
    }

    Write-Success "部署完成!"
    Write-Host ""
    Write-Info "========== 部署信息 =========="
    Write-Info "部署路径: $RemotePath"
    Write-Info "Gateway 端口: 18789"
    Write-Info "Bridge 端口: 18790"
    Write-Host ""
    Write-Info "启动服务: wsl -u $WSLUser bash -c 'cd $RemotePath && ./start.sh'"
    Write-Info "停止服务: wsl -u $WSLUser bash -c 'cd $RemotePath && ./stop.sh'"
    Write-Info "查看状态: wsl -u $WSLUser bash -c 'cd $RemotePath && ./status.sh'"
    Write-Host ""
    Write-Info "Windows 访问地址:"
    Write-Info "  Gateway: http://localhost:18789"
    Write-Info "  Bridge:  http://localhost:18790"

} finally {
    Pop-Location
}
