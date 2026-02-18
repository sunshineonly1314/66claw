# ============================================================================
# Windows 控制台编码修复脚本
# Fix Console Encoding Issues on Windows
# ============================================================================
#
# 问题：Windows 控制台默认使用 GBK 编码，导致 UTF-8 中文日志显示为乱码
# 解决：设置控制台为 UTF-8 编码 (代码页 65001)
#
# 使用方法：
#   .\fix-console-encoding.ps1
#
# ============================================================================

$ErrorActionPreference = "Stop"
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Clawdbot - Windows 控制台编码修复" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 检查当前编码
$currentCP = (Get-ItemProperty -Path "HKCU:\Console" -Name "CodePage" -ErrorAction SilentlyContinue).CodePage
Write-Host "[信息] 当前代码页: $currentCP" -ForegroundColor Yellow

if ($currentCP -eq 65001) {
    Write-Host "[成功] 控制台已设置为 UTF-8 编码，无需修复" -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "[修复] 正在设置控制台编码为 UTF-8..." -ForegroundColor Yellow

try {
    # 方案 1: 设置注册表（永久生效）
    Write-Host "  -> 设置注册表项..." -ForegroundColor Gray
    if (!(Test-Path "HKCU:\Console")) {
        New-Item -Path "HKCU:\Console" -Force | Out-Null
    }
    Set-ItemProperty -Path "HKCU:\Console" -Name "CodePage" -Value 65001 -Type DWord

    # 方案 2: 设置当前会话（立即生效）
    Write-Host "  -> 设置当前会话..." -ForegroundColor Gray
    chcp 65001 | Out-Null

    # 方案 3: 设置环境变量（Node.js 应用）
    Write-Host "  -> 设置环境变量..." -ForegroundColor Gray
    [System.Environment]::SetEnvironmentVariable("PYTHONIOENCODING", "utf-8", "User")
    [System.Environment]::SetEnvironmentVariable("NODE_NO_WARNINGS", "1", "User")
    $env:PYTHONIOENCODING = "utf-8"
    $env:NODE_NO_WARNINGS = "1"

    Write-Host ""
    Write-Host "[成功] 控制台编码已修复为 UTF-8" -ForegroundColor Green
    Write-Host ""
    Write-Host "注意事项:" -ForegroundColor Yellow
    Write-Host "  1. 需要重启终端窗口才能完全生效" -ForegroundColor Gray
    Write-Host "  2. 建议使用 Windows Terminal 或 PowerShell 7+" -ForegroundColor Gray
    Write-Host "  3. 避免使用 CMD (cmd.exe)，推荐 PowerShell" -ForegroundColor Gray
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "[错误] 修复失败: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "手动修复方法:" -ForegroundColor Yellow
    Write-Host "  1. 打开注册表编辑器 (regedit)" -ForegroundColor Gray
    Write-Host "  2. 导航到: HKEY_CURRENT_USER\Console" -ForegroundColor Gray
    Write-Host "  3. 新建 DWORD 值: CodePage = 65001" -ForegroundColor Gray
    Write-Host "  4. 重启终端" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# 验证修复结果
Write-Host "验证中文显示:" -ForegroundColor Cyan
Write-Host "  -> 中文测试: 你好，世界！" -ForegroundColor Green
Write-Host "  -> 插件测试: [plugins] [feishu] 飞书渠道插件已注册" -ForegroundColor Green
Write-Host ""

Write-Host "下一步:" -ForegroundColor Cyan
Write-Host "  1. 关闭当前终端窗口" -ForegroundColor Gray
Write-Host "  2. 重新打开 PowerShell 或 Windows Terminal" -ForegroundColor Gray
Write-Host "  3. 启动 Clawdbot 服务" -ForegroundColor Gray
Write-Host ""

exit 0
