# 注册开机启动（SSH 隧道版，替代 frpc 版本）
# 注册两个服务：
#   1. ClawdbotCN-Webhook   — webhook-server (port 8888)
#   2. ClawdbotCN-SSHTunnel — SSH 反向隧道（替代原 ClawdbotCN-FRP）
#
# 同时清理旧的 frpc 注册项

$CiDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RegPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"

# ── 清理旧 FRP 注册项 ─────────────────────────────────────────────
Write-Host "=== 清理旧 FRP 注册项 ==="
if (Get-ItemProperty -Path $RegPath -Name "ClawdbotCN-FRP" -ErrorAction SilentlyContinue) {
    Remove-ItemProperty -Path $RegPath -Name "ClawdbotCN-FRP" -ErrorAction SilentlyContinue
    Write-Host "  Removed: ClawdbotCN-FRP (old frpc)"
} else {
    Write-Host "  ClawdbotCN-FRP not found (already clean)"
}

# 停止旧 frpc 进程
Get-Process frpc -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host ""

# ── 清理旧计划任务 ─────────────────────────────────────────────────
Write-Host "=== 清理旧 FRP 计划任务 ==="
if (Get-ScheduledTask -TaskName "ClawdbotCN-FRP" -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName "ClawdbotCN-FRP" -Confirm:$false
    Write-Host "  Removed scheduled task: ClawdbotCN-FRP"
} else {
    Write-Host "  No old FRP scheduled task found"
}
Write-Host ""

# ── 注册 Webhook Server ───────────────────────────────────────────
Write-Host "=== 注册 Webhook Server ==="
$webhookCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$CiDir\webhook-loop.ps1`""
Set-ItemProperty -Path $RegPath -Name "ClawdbotCN-Webhook" -Value $webhookCmd
Write-Host "  OK: ClawdbotCN-Webhook registered"

# ── 注册 SSH 隧道 ─────────────────────────────────────────────────
Write-Host "=== 注册 SSH 隧道 ==="
$tunnelCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$CiDir\ssh-tunnel-loop.ps1`""
Set-ItemProperty -Path $RegPath -Name "ClawdbotCN-SSHTunnel" -Value $tunnelCmd
Write-Host "  OK: ClawdbotCN-SSHTunnel registered"

# ── 验证 ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== 验证注册项 ==="
$props = Get-ItemProperty -Path $RegPath
if ($props."ClawdbotCN-Webhook") { Write-Host "  Webhook:   OK" } else { Write-Host "  Webhook:   MISSING" }
if ($props."ClawdbotCN-SSHTunnel") { Write-Host "  SSHTunnel: OK" } else { Write-Host "  SSHTunnel: MISSING" }
if ($props."ClawdbotCN-FRP") { Write-Host "  FRP:       STILL EXISTS (should be removed!)" } else { Write-Host "  FRP:       Cleaned" }

Write-Host ""
Write-Host "Done. Both services will auto-start on next login."
Write-Host "To start now, run:"
Write-Host "  Start-Process powershell -ArgumentList '-File', '$CiDir\webhook-loop.ps1' -WindowStyle Hidden"
Write-Host "  Start-Process powershell -ArgumentList '-File', '$CiDir\ssh-tunnel-loop.ps1' -WindowStyle Hidden"
