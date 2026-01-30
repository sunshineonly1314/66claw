# Clawdbot WSL 环境配置脚本
# 检查并安装 WSL2 环境

# 设置 UTF-8 编码，避免中文乱码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Clawdbot WSL 环境配置" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 检查 WSL 是否已安装
function Test-WSLInstalled {
    try {
        $wslList = wsl --list --quiet 2>$null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

# 检查是否有 Ubuntu 发行版
function Test-UbuntuInstalled {
    try {
        $wslList = wsl --list --quiet 2>$null
        if ($wslList) {
            return $wslList -match "Ubuntu"
        }
        return $false
    } catch {
        return $false
    }
}

# 检查 WSL 版本
function Get-WSLVersion {
    try {
        $status = wsl --status 2>$null
        if ($status -match "默认版本: 2|Default Version: 2") {
            return 2
        }
        return 1
    } catch {
        return 0
    }
}

Write-Host "[1/4] 检查 WSL 状态..." -ForegroundColor Yellow

if (Test-WSLInstalled) {
    Write-Host "  [√] WSL 已安装" -ForegroundColor Green
    
    $wslVersion = Get-WSLVersion
    if ($wslVersion -eq 2) {
        Write-Host "  [√] WSL2 已启用" -ForegroundColor Green
    } else {
        Write-Host "  [!] 正在设置 WSL2 为默认版本..." -ForegroundColor Yellow
        wsl --set-default-version 2
    }
} else {
    Write-Host "  [!] WSL 未安装，正在安装..." -ForegroundColor Yellow
    
    # 启用 WSL 功能
    Write-Host ""
    Write-Host "[2/4] 启用 Windows 功能..." -ForegroundColor Yellow
    
    # 检查并启用 WSL
    $wslFeature = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux
    if ($wslFeature.State -ne "Enabled") {
        Write-Host "  启用 Windows Subsystem for Linux..."
        Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart -WarningAction SilentlyContinue | Out-Null
    }
    
    # 检查并启用虚拟机平台
    $vmFeature = Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform
    if ($vmFeature.State -ne "Enabled") {
        Write-Host "  启用 Virtual Machine Platform..."
        Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart -WarningAction SilentlyContinue | Out-Null
    }
    
    # 安装 WSL
    Write-Host "  安装 WSL..."
    wsl --install --no-distribution
    
    Write-Host ""
    Write-Host "  [!] WSL 已安装，可能需要重启计算机" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[3/4] 检查 Linux 发行版..." -ForegroundColor Yellow

if (Test-UbuntuInstalled) {
    Write-Host "  [√] Ubuntu 已安装" -ForegroundColor Green
} else {
    Write-Host "  [!] 正在安装 Ubuntu..." -ForegroundColor Yellow
    
    # 安装 Ubuntu
    wsl --install -d Ubuntu --no-launch
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [√] Ubuntu 安装成功" -ForegroundColor Green
    } else {
        Write-Host "  [!] Ubuntu 安装可能需要重启后完成" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "[4/4] 检查 systemd..." -ForegroundColor Yellow

# 检查并启用 systemd
try {
    $wslConf = wsl -d Ubuntu -e cat /etc/wsl.conf 2>$null
    if ($wslConf -notmatch "systemd=true") {
        Write-Host "  启用 systemd..." -ForegroundColor Yellow
        wsl -d Ubuntu -e bash -c "echo '[boot]' | sudo tee /etc/wsl.conf > /dev/null && echo 'systemd=true' | sudo tee -a /etc/wsl.conf > /dev/null"
        Write-Host "  [√] systemd 已配置" -ForegroundColor Green
    } else {
        Write-Host "  [√] systemd 已启用" -ForegroundColor Green
    }
} catch {
    Write-Host "  [!] 无法配置 systemd，将在首次启动时配置" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host " WSL 环境配置完成!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
