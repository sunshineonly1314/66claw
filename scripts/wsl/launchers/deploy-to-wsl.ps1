# Clawdbot 部署到 WSL 脚本
# 将 Clawdbot 包部署到 WSL 中

# 设置 UTF-8 编码，避免中文乱码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

param(
    [string]$PackagePath = ".\wsl-package",
    [string]$WslDistro = "Ubuntu",
    [string]$InstallPath = "~/clawdbot"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " 部署 Clawdbot 到 WSL" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 检查 WSL 是否可用
Write-Host "[1/4] 检查 WSL..." -ForegroundColor Yellow
try {
    $wslCheck = wsl -d $WslDistro -e echo "ok" 2>$null
    if ($wslCheck -ne "ok") {
        throw "WSL 不可用"
    }
    Write-Host "  [√] WSL ($WslDistro) 可用" -ForegroundColor Green
} catch {
    Write-Host "  [!] 错误: WSL ($WslDistro) 不可用" -ForegroundColor Red
    Write-Host "  请先安装 WSL2 和 Ubuntu" -ForegroundColor Yellow
    exit 1
}

# 获取 WSL 路径
Write-Host ""
Write-Host "[2/4] 准备部署路径..." -ForegroundColor Yellow

$WinPackagePath = (Resolve-Path $PackagePath).Path
Write-Host "  Windows 源路径: $WinPackagePath"

# 转换为 WSL 路径
$WslPackagePath = wsl -d $WslDistro -e wslpath -u "$WinPackagePath"
Write-Host "  WSL 源路径: $WslPackagePath"
Write-Host "  WSL 目标路径: $InstallPath"

# 部署文件
Write-Host ""
Write-Host "[3/4] 复制文件到 WSL..." -ForegroundColor Yellow

# 创建目标目录并复制文件
$deployScript = @"
#!/bin/bash
set -e

# 扩展 ~ 为实际路径
INSTALL_PATH="$InstallPath"
INSTALL_PATH="\${INSTALL_PATH/#\~/\$HOME}"

echo "  目标目录: \$INSTALL_PATH"

# 删除旧安装（如果存在）
if [ -d "\$INSTALL_PATH" ]; then
    echo "  清理旧安装..."
    rm -rf "\$INSTALL_PATH"
fi

# 创建目录
mkdir -p "\$INSTALL_PATH"

# 复制文件
echo "  复制文件..."
cp -r "$WslPackagePath"/* "\$INSTALL_PATH/"

# 设置执行权限
chmod +x "\$INSTALL_PATH"/*.sh 2>/dev/null || true

echo "  [√] 文件复制完成"
"@

# 执行部署脚本
wsl -d $WslDistro -e bash -c $deployScript

Write-Host "  [√] 部署完成" -ForegroundColor Green

# 安装 wslu (可选)
Write-Host ""
Write-Host "[4/4] 配置 WSL 环境..." -ForegroundColor Yellow

$configScript = @"
#!/bin/bash

# 检查并安装 wslu
if ! command -v wslview &> /dev/null; then
    echo "  安装 wslu (用于打开 Windows 浏览器)..."
    sudo apt-get update -qq
    sudo apt-get install -y -qq wslu 2>/dev/null || echo "  [!] wslu 安装跳过"
fi

echo "  [√] 环境配置完成"
"@

try {
    wsl -d $WslDistro -e bash -c $configScript
} catch {
    Write-Host "  [!] wslu 安装跳过（可选组件）" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host " Clawdbot 部署完成!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  安装位置: WSL:$InstallPath" -ForegroundColor Cyan
Write-Host ""
