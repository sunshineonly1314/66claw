# Clawdbot WSL 环境检查脚本

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Clawdbot WSL 环境检查" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# 检查 Windows 版本
Write-Host "[1] Windows 版本" -ForegroundColor Yellow
$osInfo = Get-WmiObject Win32_OperatingSystem
$osVersion = [Version]$osInfo.Version
Write-Host "    版本: $($osInfo.Caption) ($osVersion)"
if ($osVersion.Major -ge 10 -and $osVersion.Build -ge 19041) {
    Write-Host "    [√] 支持 WSL2" -ForegroundColor Green
} else {
    Write-Host "    [×] 需要 Windows 10 2004 或更高版本" -ForegroundColor Red
    $allGood = $false
}

# 检查虚拟化
Write-Host ""
Write-Host "[2] 虚拟化支持" -ForegroundColor Yellow
$hypervisor = (Get-WmiObject Win32_ComputerSystem).HypervisorPresent
if ($hypervisor) {
    Write-Host "    [√] 虚拟化已启用" -ForegroundColor Green
} else {
    Write-Host "    [×] 请在 BIOS 中启用虚拟化 (VT-x/AMD-V)" -ForegroundColor Red
    $allGood = $false
}

# 检查 WSL
Write-Host ""
Write-Host "[3] WSL 状态" -ForegroundColor Yellow
try {
    $wslVersion = wsl --version 2>$null
    if ($wslVersion) {
        Write-Host "    [√] WSL 已安装" -ForegroundColor Green
        $wslVersion -split "`n" | ForEach-Object { Write-Host "    $_" }
    } else {
        Write-Host "    [×] WSL 未安装" -ForegroundColor Red
        Write-Host "    运行: wsl --install" -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host "    [×] WSL 未安装" -ForegroundColor Red
    $allGood = $false
}

# 检查 Ubuntu
Write-Host ""
Write-Host "[4] Ubuntu 发行版" -ForegroundColor Yellow
try {
    $wslList = wsl --list --verbose 2>$null
    if ($wslList -match "Ubuntu") {
        Write-Host "    [√] Ubuntu 已安装" -ForegroundColor Green
        $wslList -split "`n" | Where-Object { $_ -match "Ubuntu" } | ForEach-Object { Write-Host "    $_" }
    } else {
        Write-Host "    [×] Ubuntu 未安装" -ForegroundColor Red
        Write-Host "    运行: wsl --install -d Ubuntu" -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host "    [×] 无法检查发行版" -ForegroundColor Red
    $allGood = $false
}

# 检查 Clawdbot 安装
Write-Host ""
Write-Host "[5] Clawdbot 安装" -ForegroundColor Yellow
try {
    $clawdbotCheck = wsl -d Ubuntu -e bash -c "test -d ~/clawdbot && echo 'installed' || echo 'not-installed'" 2>$null
    if ($clawdbotCheck -eq "installed") {
        Write-Host "    [√] Clawdbot 已部署到 WSL" -ForegroundColor Green
    } else {
        Write-Host "    [×] Clawdbot 未部署" -ForegroundColor Red
        $allGood = $false
    }
} catch {
    Write-Host "    [×] 无法检查 Clawdbot" -ForegroundColor Red
    $allGood = $false
}

# 检查端口
Write-Host ""
Write-Host "[6] 端口状态" -ForegroundColor Yellow
$port = 18789
$listener = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($listener) {
    Write-Host "    [√] 端口 $port 正在监听 (Clawdbot 运行中)" -ForegroundColor Green
} else {
    Write-Host "    [ ] 端口 $port 未使用 (Clawdbot 未运行)" -ForegroundColor Gray
}

# 总结
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host " [√] 环境检查通过！" -ForegroundColor Green
} else {
    Write-Host " [×] 部分检查未通过，请修复上述问题" -ForegroundColor Red
}
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

pause
