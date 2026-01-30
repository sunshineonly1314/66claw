# Clawdbot WSL Windows Installer 构建脚本
# 
# 使用方法:
#   .\build-installer.ps1
#
# 前置要求:
#   1. 安装 Inno Setup: https://jrsoftware.org/isinfo.php
#   2. 已运行 build-standalone.sh 生成 WSL 包
#   3. 或者在 WSL 中运行: ./build-standalone.sh

param(
    [string]$Version = "2026.1.29",
    [switch]$SkipBuildPackage
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Join-Path $ScriptDir "../.."

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Clawdbot WSL Windows Installer Builder" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Inno Setup
$InnoSetupPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $InnoSetupPath)) {
    Write-Host "错误: 未找到 Inno Setup" -ForegroundColor Red
    Write-Host "请从 https://jrsoftware.org/isinfo.php 下载并安装 Inno Setup 6" -ForegroundColor Yellow
    exit 1
}

# 检查/构建 WSL 包
$WslPackageDir = Join-Path $RootDir "build/wsl-standalone/clawdbot"
if (-not (Test-Path $WslPackageDir)) {
    if ($SkipBuildPackage) {
        Write-Host "错误: WSL 包不存在: $WslPackageDir" -ForegroundColor Red
        Write-Host "请先在 WSL 中运行 ./build-standalone.sh" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "步骤 1: 构建 WSL 包..." -ForegroundColor Green
    Write-Host "  在 WSL 中运行 build-standalone.sh..."
    
    # 在 WSL 中构建
    $buildScript = Join-Path $ScriptDir "build-standalone.sh"
    $wslBuildScript = wsl -e wslpath -u $buildScript
    wsl -e bash $wslBuildScript
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "错误: WSL 包构建失败" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "步骤 1: 使用已有的 WSL 包" -ForegroundColor Green
    Write-Host "  路径: $WslPackageDir"
}

# 创建输出目录
$OutputDir = Join-Path $RootDir "buildout/wsl"
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

# 更新 setup.iss 中的版本号
Write-Host ""
Write-Host "步骤 2: 更新版本号..." -ForegroundColor Green
$SetupIss = Join-Path $ScriptDir "setup.iss"
$issContent = Get-Content $SetupIss -Raw
$issContent = $issContent -replace '#define MyAppVersion ".*"', "#define MyAppVersion `"$Version`""
Set-Content $SetupIss -Value $issContent -NoNewline

# 运行 Inno Setup
Write-Host ""
Write-Host "步骤 3: 构建安装程序..." -ForegroundColor Green
& $InnoSetupPath $SetupIss

if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: Inno Setup 构建失败" -ForegroundColor Red
    exit 1
}

# 计算文件大小和校验和
$InstallerPath = Join-Path $OutputDir "Clawdbot-WSL-Setup-v$Version.exe"
if (Test-Path $InstallerPath) {
    $FileSize = [math]::Round((Get-Item $InstallerPath).Length / 1MB, 2)
    $Hash = (Get-FileHash $InstallerPath -Algorithm SHA256).Hash
    
    # 保存校验和
    $Hash | Out-File "$InstallerPath.sha256"
    
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host " 构建完成!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "安装程序: $InstallerPath"
    Write-Host "文件大小: ${FileSize} MB"
    Write-Host "SHA256:   $Hash"
    Write-Host ""
    Write-Host "用户双击运行即可一键安装 Clawdbot 到 WSL2 环境！"
    Write-Host ""
} else {
    Write-Host "错误: 安装程序未生成" -ForegroundColor Red
    exit 1
}
