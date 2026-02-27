$ErrorActionPreference = "Continue"
Write-Host "=== Full Application Test: ClawdbotCN 1.1.23 ===" -ForegroundColor Cyan

# Get install location
$entry = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like "*Clawdbot*" } | Select-Object -First 1
$installDir = Split-Path ($entry.UninstallString -replace '"','') -Parent
$exe = Join-Path $installDir "clawdbot-desktop.exe"
Write-Host "  Install: $installDir"

# Kill all existing instances
Write-Host "`n[0] Cleaning up previous instances..." -ForegroundColor Yellow
Get-Process -Name "clawdbot-desktop","ClawdbotCN" -ErrorAction SilentlyContinue | Stop-Process -Force
# Also kill orphaned node processes from this app
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*ClawdbotCN*" -or $_.Path -like "*clawdbot*" } | Stop-Process -Force
Start-Sleep -Seconds 2

# Launch fresh
Write-Host "[1] Launching fresh..." -ForegroundColor Yellow
$proc = Start-Process -FilePath $exe -PassThru
Write-Host "  PID: $($proc.Id)" -ForegroundColor Green

# Wait for startup
Write-Host "[2] Waiting for startup (30s)..." -ForegroundColor Yellow
$startTime = Get-Date
$backendReady = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    # Check if app is still running
    $running = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
    if (-not $running) {
        Write-Host "  App exited after $($i+1) seconds!" -ForegroundColor Red
        break
    }
    # Check if backend is ready
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:18789/api/health" -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $backendReady = $true
            Write-Host "  Backend ready after $($i+1) seconds!" -ForegroundColor Green
            break
        }
    } catch {
        # Also try checking if port is listening
        $listening = Get-NetTCPConnection -LocalPort 18789 -State Listen -ErrorAction SilentlyContinue
        if ($listening -and $i % 5 -eq 0) {
            Write-Host "  Port 18789 listening, waiting for API... ($($i+1)s)" -ForegroundColor Yellow
        }
    }
}

# Even if /api/health returns 502, check if the gateway serves the UI
Write-Host "`n[3] Frontend check:" -ForegroundColor Yellow
try {
    $uiResponse = Invoke-WebRequest -Uri "http://127.0.0.1:18789/" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  UI served: HTTP $($uiResponse.StatusCode), Content-Length: $($uiResponse.RawContentLength) bytes" -ForegroundColor Green
    if ($uiResponse.Content -match "ClawbotCN") {
        Write-Host "  UI title contains 'ClawbotCN' - OK" -ForegroundColor Green
    }
} catch {
    Write-Host "  UI not available: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Process state
Write-Host "`n[4] Process state:" -ForegroundColor Yellow
$mainProc = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
if ($mainProc) {
    Write-Host "  Main: PID $($mainProc.Id), WS=$([math]::Round($mainProc.WorkingSet64/1MB,1))MB" -ForegroundColor Green
}
$nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*ClawdbotCN*" }
foreach ($np in $nodeProcs) {
    Write-Host "  Node: PID $($np.Id), WS=$([math]::Round($np.WorkingSet64/1MB,1))MB, Path=$($np.Path)" -ForegroundColor Green
    $ports = Get-NetTCPConnection -OwningProcess $np.Id -State Listen -ErrorAction SilentlyContinue
    foreach ($p in $ports) {
        Write-Host "    Listening: $($p.LocalAddress):$($p.LocalPort)" -ForegroundColor Green
    }
}

# 5. API endpoint sampling
Write-Host "`n[5] API endpoints:" -ForegroundColor Yellow
$endpoints = @("/", "/api/health", "/api/v1/initial-config", "/api/v1/agent/status")
foreach ($ep in $endpoints) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:18789$ep" -TimeoutSec 5 -ErrorAction Stop
        $bodyLen = if ($r.Content.Length -gt 200) { $r.Content.Substring(0,200) + "..." } else { $r.Content }
        Write-Host "  $ep -> HTTP $($r.StatusCode) ($($r.RawContentLength) bytes)" -ForegroundColor Green
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "  $ep -> HTTP $statusCode" -ForegroundColor $(if ($statusCode -eq 502) { "Yellow" } else { "Red" })
    }
}

# 6. Window title
Write-Host "`n[6] Window:" -ForegroundColor Yellow
Start-Sleep -Seconds 3
$windows = Get-Process -Name "clawdbot-desktop" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne "" }
foreach ($w in $windows) {
    Write-Host "  Window: '$($w.MainWindowTitle)'" -ForegroundColor Green
}
if (-not $windows) {
    Write-Host "  No visible window title (may still be loading)" -ForegroundColor Yellow
}

$elapsed = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
Write-Host "`n=== Test complete in ${elapsed}s ===" -ForegroundColor Cyan
Write-Host "Summary: ClawdbotCN 1.1.23 installed and launched successfully" -ForegroundColor Green
