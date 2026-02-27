$ErrorActionPreference = "Continue"
Write-Host "=== Debug Launch: ClawdbotCN ===" -ForegroundColor Cyan

# Get install dir
$entry = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like "*Clawdbot*" } | Select-Object -First 1
$installDir = Split-Path ($entry.UninstallString -replace '"','') -Parent
$exe = Join-Path $installDir "clawdbot-desktop.exe"

# Kill all previous
Get-Process -Name "clawdbot-desktop","ClawdbotCN" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*ClawdbotCN*" } | Stop-Process -Force
Start-Sleep -Seconds 2

# Launch with console output captured
Write-Host "`n[1] Launching with stdout/stderr capture..." -ForegroundColor Yellow
$stdoutFile = "$env:TEMP\clawdbot_stdout.txt"
$stderrFile = "$env:TEMP\clawdbot_stderr.txt"
$proc = Start-Process -FilePath $exe -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile -PassThru -WindowStyle Normal

# Wait for it to exit or stabilize
Start-Sleep -Seconds 10

$running = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue

Write-Host "`n[2] Process status: $(if ($running) { 'RUNNING' } else { 'EXITED' })" -ForegroundColor $(if ($running) { "Green" } else { "Red" })

# Show stdout
Write-Host "`n[3] STDOUT:" -ForegroundColor Yellow
if (Test-Path $stdoutFile) {
    $stdout = Get-Content $stdoutFile -ErrorAction SilentlyContinue
    if ($stdout) {
        foreach ($line in $stdout) { Write-Host "  $line" }
    } else {
        Write-Host "  (empty)" -ForegroundColor Gray
    }
}

# Show stderr
Write-Host "`n[4] STDERR:" -ForegroundColor Yellow
if (Test-Path $stderrFile) {
    $stderr = Get-Content $stderrFile -ErrorAction SilentlyContinue
    if ($stderr) {
        foreach ($line in $stderr) {
            $color = if ($line -match "error|Error|ERROR|panic|PANIC") { "Red" } elseif ($line -match "warn|WARN") { "Yellow" } else { "Gray" }
            Write-Host "  $line" -ForegroundColor $color
        }
    } else {
        Write-Host "  (empty)" -ForegroundColor Gray
    }
}

# Check Tauri log directory
Write-Host "`n[5] Tauri logs:" -ForegroundColor Yellow
$tauriLogDirs = @(
    "$env:LOCALAPPDATA\com.clawdbot.cn.desktop\logs",
    "$env:LOCALAPPDATA\com.clawdbot.cn.desktop",
    "$env:APPDATA\com.clawdbot.cn.desktop\logs"
)
foreach ($dir in $tauriLogDirs) {
    if (Test-Path $dir) {
        $logFiles = Get-ChildItem $dir -Filter "*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 5
        foreach ($log in $logFiles) {
            Write-Host "  File: $($log.FullName) ($($log.LastWriteTime))" -ForegroundColor White
            $content = Get-Content $log.FullName -Tail 20 -ErrorAction SilentlyContinue
            foreach ($line in $content) { Write-Host "    $line" -ForegroundColor Gray }
        }
    }
}

# Also check Windows Event Log for app crashes
Write-Host "`n[6] Recent crash events:" -ForegroundColor Yellow
$crashes = Get-WinEvent -FilterHashtable @{LogName='Application'; Level=2; StartTime=(Get-Date).AddMinutes(-5)} -MaxEvents 5 -ErrorAction SilentlyContinue |
    Where-Object { $_.Message -like "*clawdbot*" -or $_.Message -like "*ClawdbotCN*" }
foreach ($c in $crashes) {
    Write-Host "  [$($c.TimeCreated)] $($c.Message.Substring(0, [Math]::Min(200, $c.Message.Length)))..." -ForegroundColor Red
}

# Cleanup
Remove-Item $stdoutFile -Force -ErrorAction SilentlyContinue
Remove-Item $stderrFile -Force -ErrorAction SilentlyContinue

Write-Host "`n=== Debug Launch Complete ===" -ForegroundColor Cyan
