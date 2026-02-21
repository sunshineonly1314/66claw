# 设置 CI/CD 服务开机自启（后台静默，无窗口）
# 需要以管理员身份运行

$ErrorActionPreference = "Stop"
$CiDir = "D:\codeknowledge\clawdbot-main\clawdbot-main\ci"

Write-Host "=== 设置 CI/CD 开机自启（后台无窗口）===" -ForegroundColor Cyan

$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

# ── 1. Webhook Server ─────────────────────────────────────────────────────────
Write-Host "`n[1/2] 注册 Webhook Server..." -ForegroundColor Yellow

$webhookAction = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$CiDir\webhook-loop.ps1`"" `
    -WorkingDirectory $CiDir

Register-ScheduledTask `
    -TaskName "ClawdbotCN-Webhook" `
    -Action $webhookAction `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "ClawdbotCN CI/CD Webhook Server (port 8888)" `
    -Force | Out-Null

Write-Host "  OK" -ForegroundColor Green

# ── 2. FRP 客户端 ─────────────────────────────────────────────────────────────
Write-Host "`n[2/2] 注册 FRP 客户端..." -ForegroundColor Yellow

$frpcAction = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$CiDir\frpc-loop.ps1`"" `
    -WorkingDirectory $CiDir

Register-ScheduledTask `
    -TaskName "ClawdbotCN-FRP" `
    -Action $frpcAction `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "ClawdbotCN FRP隧道 (阿里云穿透)" `
    -Force | Out-Null

Write-Host "  OK" -ForegroundColor Green

# ── 立即启动 ──────────────────────────────────────────────────────────────────
Write-Host "`n=== 立即启动服务 ===" -ForegroundColor Cyan

# 停掉旧进程
Get-Process frpc -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process node -ErrorAction SilentlyContinue | Where-Object {
    (Get-WmiObject Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine -like "*webhook-server*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 1

Start-ScheduledTask -TaskName "ClawdbotCN-Webhook"
Start-Sleep -Seconds 3
Start-ScheduledTask -TaskName "ClawdbotCN-FRP"
Start-Sleep -Seconds 5

# ── 验证 ──────────────────────────────────────────────────────────────────────
Write-Host "`n=== 验证 ===" -ForegroundColor Cyan

$port8888 = Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue
if ($port8888) {
    Write-Host "  OK  Webhook Server 8888 端口监听中" -ForegroundColor Green
} else {
    Write-Host "  !!  8888 端口未监听，稍等几秒" -ForegroundColor Yellow
}

$frpcProc = Get-Process frpc -ErrorAction SilentlyContinue
if ($frpcProc) {
    Write-Host "  OK  frpc 运行中 (PID $($frpcProc.Id))" -ForegroundColor Green
} else {
    Write-Host "  !!  frpc 未检测到" -ForegroundColor Yellow
}

Write-Host "`n完成！下次重启后两个服务自动在后台启动，无任何弹窗。" -ForegroundColor Cyan
Write-Host "日志位置:"
Write-Host "  Webhook: $CiDir\webhook.log"
Write-Host "  FRP:     $CiDir\frpc.log"
Write-Host "Gitee Webhook URL: http://106.15.198.253:9999/webhook"
