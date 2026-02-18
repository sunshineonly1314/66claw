# ============================================================================
# 启动 Clawdbot Gateway 并确保 UTF-8 编码
# Start Clawdbot Gateway with UTF-8 Encoding
# ============================================================================
#
# 使用方法：
#   .\start-with-utf8.ps1
#
# ============================================================================

param(
    [string]$Command = "gateway run --allow-unconfigured",
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

# 设置 UTF-8 编码
chcp 65001 | Out-Null
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

# 设置环境变量
$env:PYTHONIOENCODING = "utf-8"
$env:NODE_NO_WARNINGS = "1"
$env:FORCE_COLOR = "1"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Clawdbot - UTF-8 编码模式启动" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "编码设置: UTF-8 (65001)" -ForegroundColor Green
Write-Host "命令: $Command" -ForegroundColor Gray
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 查找 clawdbot 可执行文件
$clawdbotPath = $null
$possiblePaths = @(
    "D:\ClawdbotCN\clawdbot.exe",
    "D:\ClawdbotCN\node\node.exe",
    "clawdbot"
)

foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $clawdbotPath = $path
        break
    }
}

if (-not $clawdbotPath) {
    # 尝试从 PATH 查找
    $clawdbotPath = (Get-Command clawdbot -ErrorAction SilentlyContinue).Source
}

if (-not $clawdbotPath) {
    Write-Host "[错误] 找不到 clawdbot 可执行文件" -ForegroundColor Red
    Write-Host ""
    Write-Host "请检查:" -ForegroundColor Yellow
    Write-Host "  1. Clawdbot 是否已安装" -ForegroundColor Gray
    Write-Host "  2. 安装路径是否在 PATH 环境变量中" -ForegroundColor Gray
    Write-Host "  3. 或手动指定路径: .\start-with-utf8.ps1 -ClawdbotPath 'D:\path\to\clawdbot.exe'" -ForegroundColor Gray
    exit 1
}

Write-Host "[信息] 使用: $clawdbotPath" -ForegroundColor Green
Write-Host ""

# 启动 Clawdbot
try {
    if ($clawdbotPath -like "*node.exe") {
        # 使用 Node.js 启动
        $distPath = Join-Path (Split-Path $clawdbotPath -Parent) "..\dist\entry.js"
        if (Test-Path $distPath) {
            & $clawdbotPath $distPath $Command.Split(" ")
        } else {
            Write-Host "[错误] 找不到 dist\entry.js" -ForegroundColor Red
            exit 1
        }
    } else {
        # 直接启动可执行文件
        & $clawdbotPath $Command.Split(" ")
    }
} catch {
    Write-Host ""
    Write-Host "[错误] 启动失败: $_" -ForegroundColor Red
    exit 1
}
