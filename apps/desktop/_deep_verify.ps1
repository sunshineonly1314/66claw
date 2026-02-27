$ErrorActionPreference = "Continue"
Write-Host "=== Deep Verification: ClawdbotCN 1.1.23 ===" -ForegroundColor Cyan

# 1. Process tree check
Write-Host "`n[1] Process tree:" -ForegroundColor Yellow
$mainProc = Get-Process -Name "clawdbot-desktop" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($mainProc) {
    Write-Host "  Main: PID $($mainProc.Id), WorkingSet: $([math]::Round($mainProc.WorkingSet64/1MB,1))MB, CPU: $($mainProc.CPU)s" -ForegroundColor Green

    # Find all descendant processes
    function Get-DescendantProcesses($parentPid) {
        $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $parentPid" -ErrorAction SilentlyContinue
        foreach ($child in $children) {
            [PSCustomObject]@{
                PID = $child.ProcessId
                Name = $child.Name
                Cmd = if ($child.CommandLine.Length -gt 120) { $child.CommandLine.Substring(0,120) + "..." } else { $child.CommandLine }
            }
            Get-DescendantProcesses $child.ProcessId
        }
    }

    $descendants = Get-DescendantProcesses $mainProc.Id
    if ($descendants) {
        foreach ($d in $descendants) {
            Write-Host "  |- PID $($d.PID): $($d.Name)" -ForegroundColor White
            Write-Host "     CMD: $($d.Cmd)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  No child processes" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ClawdbotCN main process NOT running!" -ForegroundColor Red
}

# 2. Port listening check (19002 is the expected backend port)
Write-Host "`n[2] Network listening ports:" -ForegroundColor Yellow
$nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
foreach ($np in $nodeProcs) {
    if ($np.Path -like "*Clawdbot*" -or $np.Path -like "*clawdbot*") {
        Write-Host "  Node process: PID $($np.Id), Path: $($np.Path)" -ForegroundColor Green
        $listeners = Get-NetTCPConnection -OwningProcess $np.Id -State Listen -ErrorAction SilentlyContinue
        foreach ($l in $listeners) {
            Write-Host "    Listening: $($l.LocalAddress):$($l.LocalPort)" -ForegroundColor Green
        }
    }
}

# Also check port 19002 directly
$port19002 = Get-NetTCPConnection -LocalPort 19002 -State Listen -ErrorAction SilentlyContinue
if ($port19002) {
    Write-Host "  Port 19002: LISTENING (PID $($port19002.OwningProcess))" -ForegroundColor Green
} else {
    Write-Host "  Port 19002: NOT listening" -ForegroundColor Yellow
    # Check what ports are listening from node processes
    foreach ($np in $nodeProcs) {
        $listeners = Get-NetTCPConnection -OwningProcess $np.Id -State Listen -ErrorAction SilentlyContinue
        foreach ($l in $listeners) {
            Write-Host "  node PID $($np.Id) listening on $($l.LocalAddress):$($l.LocalPort)" -ForegroundColor Yellow
        }
    }
}

# 3. Check log files
Write-Host "`n[3] Log files:" -ForegroundColor Yellow
$logDirs = @(
    "$env:LOCALAPPDATA\com.clawdbot.cn.desktop\logs",
    "$env:LOCALAPPDATA\com.clawdbot.cn.desktop"
)
foreach ($logDir in $logDirs) {
    if (Test-Path $logDir) {
        $logs = Get-ChildItem $logDir -Filter "*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 5
        foreach ($log in $logs) {
            Write-Host "  $($log.Name) ($($log.LastWriteTime), $([math]::Round($log.Length/1KB,1))KB)" -ForegroundColor White
            # Show last 10 lines
            $content = Get-Content $log.FullName -Tail 10 -ErrorAction SilentlyContinue
            foreach ($line in $content) {
                $color = if ($line -match "error|ERROR|Error") { "Red" } elseif ($line -match "warn|WARN") { "Yellow" } else { "Gray" }
                Write-Host "    $line" -ForegroundColor $color
            }
        }
    }
}

# 4. Check Tauri webview logs
Write-Host "`n[4] Tauri/WebView2 data:" -ForegroundColor Yellow
$wv2Dir = "$env:LOCALAPPDATA\com.clawdbot.cn.desktop\EBWebView"
if (Test-Path $wv2Dir) {
    $wv2Size = (Get-ChildItem $wv2Dir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    Write-Host "  WebView2 data: $([math]::Round($wv2Size/1MB,1))MB" -ForegroundColor Green
}

# 5. Try HTTP health check on localhost:19002
Write-Host "`n[5] Backend health check:" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:19002" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  HTTP $($response.StatusCode) from localhost:19002" -ForegroundColor Green
} catch {
    $err = $_.Exception.Message
    if ($err -match "Unable to connect") {
        Write-Host "  Backend not reachable on port 19002 (may use different port or not started yet)" -ForegroundColor Yellow
    } else {
        Write-Host "  HTTP Error: $err" -ForegroundColor Yellow
    }
}

# 6. Check window title to verify UI loaded
Write-Host "`n[6] Window check:" -ForegroundColor Yellow
$windows = Get-Process -Name "clawdbot-desktop" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne "" }
foreach ($w in $windows) {
    Write-Host "  Window: '$($w.MainWindowTitle)' (PID $($w.Id))" -ForegroundColor Green
}
if (-not $windows) {
    # Also check for webview processes
    $allProcs = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like "*clawdbot*" -or $_.ProcessName -like "*Clawdbot*" }
    foreach ($p in $allProcs) {
        Write-Host "  Process: $($p.ProcessName) PID=$($p.Id) Title='$($p.MainWindowTitle)' WS=$([math]::Round($p.WorkingSet64/1MB,1))MB" -ForegroundColor White
    }
}

Write-Host "`n=== Deep Verification Complete ===" -ForegroundColor Cyan
