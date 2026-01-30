# Clawdbot SSH 部署脚本 (通过 SSH 部署到远程 WSL)
# 适用于: 从 Windows 通过 SSH 部署到 WSL Ubuntu
# 目标: kslinux@kevinUp:/home/clawdbot

param(
    [switch]$SkipBuild,
    [switch]$OnlyBuild,
    [string]$SSHHost = "kevinUp",
    [string]$SSHUser = "kslinux",
    [string]$SSHPassword = "sunbingood123",
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
        
        if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
            Write-Err "pnpm 未安装，请先安装: npm install -g pnpm"
            exit 1
        }

        Write-Info "安装依赖..."
        pnpm install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) { Write-Err "依赖安装失败"; exit 1 }

        Write-Info "执行构建..."
        pnpm build
        if ($LASTEXITCODE -ne 0) { Write-Err "构建失败"; exit 1 }

        Write-Info "构建 UI..."
        pnpm ui:install
        pnpm ui:build

        Write-Success "构建完成"
    }

    if ($OnlyBuild) {
        Write-Success "仅构建模式，跳过部署"
        exit 0
    }

    # ========== 步骤 2: 创建部署压缩包 ==========
    Write-Info "创建部署压缩包..."
    
    $TempDir = "$env:TEMP\clawdbot-deploy-$(Get-Date -Format 'yyyyMMddHHmmss')"
    $TarFile = "$TempDir\clawdbot-deploy.tar.gz"
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

    # 使用 tar 打包 (Windows 10+ 内置)
    $FilesToPack = @(
        "dist",
        "docs", 
        "extensions",
        "assets",
        "skills",
        "patches",
        "scripts",
        "ui",
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        ".npmrc",
        "nativedeploy/setup.sh",
        "nativedeploy/start.sh",
        "nativedeploy/stop.sh",
        "nativedeploy/status.sh"
    )

    $ExistingFiles = $FilesToPack | Where-Object { Test-Path (Join-Path $ProjectRoot $_) }
    
    Write-Info "打包文件..."
    tar -czvf $TarFile $ExistingFiles 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Err "打包失败"
        exit 1
    }

    $TarSize = [math]::Round((Get-Item $TarFile).Length / 1MB, 2)
    Write-Success "压缩包大小: ${TarSize}MB"

    # ========== 步骤 3: 上传并部署 ==========
    Write-Info "部署到 $SSHUser@$SSHHost:$RemotePath"
    
    # 检查 sshpass 或使用 ssh-agent
    # 注意: Windows 原生 SSH 不支持 sshpass，建议配置 SSH 密钥
    
    # 方法 1: 使用 scp + ssh (需要交互输入密码或配置密钥)
    Write-Info "上传部署包..."
    
    # 创建远程目录
    ssh "${SSHUser}@${SSHHost}" "mkdir -p $RemotePath"
    
    # 上传压缩包
    scp $TarFile "${SSHUser}@${SSHHost}:$RemotePath/"
    if ($LASTEXITCODE -ne 0) {
        Write-Err "上传失败"
        Write-Warn "如果需要输入密码，建议配置 SSH 密钥认证"
        exit 1
    }

    # 解压并安装
    Write-Info "解压并安装..."
    $RemoteCommands = @"
cd $RemotePath
tar -xzvf clawdbot-deploy.tar.gz
rm -f clawdbot-deploy.tar.gz
mv nativedeploy/*.sh . 2>/dev/null || true
rmdir nativedeploy 2>/dev/null || true
chmod +x *.sh
./setup.sh
"@

    ssh "${SSHUser}@${SSHHost}" $RemoteCommands
    if ($LASTEXITCODE -ne 0) {
        Write-Err "远程安装失败"
        exit 1
    }

    # 清理临时文件
    Remove-Item -Recurse -Force $TempDir

    Write-Success "部署完成!"
    Write-Host ""
    Write-Info "========== 部署信息 =========="
    Write-Info "部署路径: $RemotePath"
    Write-Info "Gateway 端口: 18789"
    Write-Info "Bridge 端口: 18790"
    Write-Host ""
    Write-Info "远程管理命令:"
    Write-Info "  启动: ssh $SSHUser@$SSHHost 'cd $RemotePath && ./start.sh'"
    Write-Info "  停止: ssh $SSHUser@$SSHHost 'cd $RemotePath && ./stop.sh'"
    Write-Info "  状态: ssh $SSHUser@$SSHHost 'cd $RemotePath && ./status.sh'"
    Write-Host ""
    Write-Info "Windows 访问地址:"
    Write-Info "  Gateway: http://localhost:18789"
    Write-Info "  Bridge:  http://localhost:18790"

} finally {
    Pop-Location
}
