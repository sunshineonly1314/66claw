# CI/CD 状态检查（SSH 隧道版，替代 check-status.ps1）

Write-Host "=== ClawdbotCN CI/CD 状态检查 (SSH 隧道版) ==="
Write-Host ""

# ── Webhook Server ────────────────────────────────────────────────
Write-Host "--- Webhook Server (port 8888) ---"
$port8888 = Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue
if ($port8888) {
    Write-Host "  Port 8888: LISTENING" -ForegroundColor Green
    $port8888 | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
} else {
    Write-Host "  Port 8888: NOT LISTENING" -ForegroundColor Red
}

# ── SSH 隧道进程 ──────────────────────────────────────────────────
Write-Host "--- SSH Tunnel ---"
$sshProcs = Get-Process ssh -ErrorAction SilentlyContinue | Where-Object {
    # 过滤出我们的 SSH 隧道进程（命令行包含 -N 或目标主机）
    try {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine
        $cmdLine -and ($cmdLine -match "-N" -or $cmdLine -match "106\.15\.198\.253")
    } catch { $false }
}
if ($sshProcs) {
    Write-Host "  SSH processes: $($sshProcs.Count) running" -ForegroundColor Green
    $sshProcs | Select-Object Id,CPU,StartTime | Format-Table -AutoSize
} else {
    Write-Host "  SSH tunnel: NOT RUNNING" -ForegroundColor Red
}

# ── 旧 FRP 进程检查 ──────────────────────────────────────────────
Write-Host "--- Old FRP (should be gone) ---"
$frpcProc = Get-Process frpc -ErrorAction SilentlyContinue
if ($frpcProc) {
    Write-Host "  WARNING: frpc still running (PID: $($frpcProc.Id))" -ForegroundColor Yellow
    Write-Host "  Run: Stop-Process -Name frpc -Force" -ForegroundColor Yellow
} else {
    Write-Host "  frpc: Not running (good)" -ForegroundColor Green
}

# ── 注册表启动项 ──────────────────────────────────────────────────
Write-Host "--- Registry Autostart ---"
$r = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -ErrorAction SilentlyContinue
if ($r."ClawdbotCN-Webhook")   { Write-Host "  Webhook:   OK" -ForegroundColor Green } else { Write-Host "  Webhook:   MISSING" -ForegroundColor Red }
if ($r."ClawdbotCN-SSHTunnel") { Write-Host "  SSHTunnel: OK" -ForegroundColor Green } else { Write-Host "  SSHTunnel: MISSING" -ForegroundColor Red }
if ($r."ClawdbotCN-FRP")       { Write-Host "  FRP (old): STILL EXISTS — run register-startup-ssh.ps1 to clean" -ForegroundColor Yellow } else { Write-Host "  FRP (old): Cleaned" -ForegroundColor Green }

# ── 远程隧道健康检查 ──────────────────────────────────────────────
Write-Host ""
Write-Host "--- Remote Tunnel Health Check ---"
try {
    $remoteHost = if ($env:CI_ALIYUN_IP) { $env:CI_ALIYUN_IP } else { "106.15.198.253" }
    $h = Invoke-WebRequest -Uri "http://${remoteHost}:9999/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "  Tunnel → Webhook: OK" -ForegroundColor Green
    Write-Host "  Response: $($h.Content)"
} catch {
    Write-Host "  Tunnel → Webhook: FAIL (tunnel may be down)" -ForegroundColor Red
    Write-Host "  Error: $_"
}

# ── SSH 隧道日志最后几行 ──────────────────────────────────────────
Write-Host ""
Write-Host "--- Recent SSH Tunnel Logs ---"
$logFile = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "ssh-tunnel.log"
if (Test-Path $logFile) {
    Get-Content $logFile -Tail 5
} else {
    Write-Host "  No log file yet"
}

Write-Host ""
Write-Host "=== Done ==="
