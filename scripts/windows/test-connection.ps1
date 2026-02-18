# Test ClawdbotCN Connection
# This script tests if the backend is responding correctly

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "ClawdbotCN Connection Test" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check if port 18789 is listening
Write-Host "[Test 1] Checking port 18789..." -ForegroundColor Yellow
$listening = netstat -ano | Select-String "18789.*LISTENING"
if ($listening) {
    Write-Host "  ✓ Port 18789 is listening" -ForegroundColor Green
    Write-Host "  Process ID: $($listening -replace '.*\s+(\d+)$','$1')" -ForegroundColor Gray
} else {
    Write-Host "  ✗ Port 18789 is NOT listening" -ForegroundColor Red
    exit 1
}

# Test 2: Check ClawdbotCN process
Write-Host ""
Write-Host "[Test 2] Checking ClawdbotCN.exe process..." -ForegroundColor Yellow
$process = Get-Process -Name ClawdbotCN -ErrorAction SilentlyContinue
if ($process) {
    Write-Host "  ✓ ClawdbotCN.exe is running" -ForegroundColor Green
    Write-Host "  PID: $($process.Id)" -ForegroundColor Gray
    Write-Host "  Memory: $([Math]::Round($process.WorkingSet64 / 1MB, 2)) MB" -ForegroundColor Gray
} else {
    Write-Host "  ✗ ClawdbotCN.exe is NOT running" -ForegroundColor Red
}

# Test 3: Check Node.js sidecar
Write-Host ""
Write-Host "[Test 3] Checking Node.js sidecar..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "  ✓ Node.js processes found: $($nodeProcesses.Count)" -ForegroundColor Green
    $totalMem = ($nodeProcesses | Measure-Object WorkingSet64 -Sum).Sum / 1MB
    Write-Host "  Total memory: $([Math]::Round($totalMem, 2)) MB" -ForegroundColor Gray
} else {
    Write-Host "  ✗ No Node.js processes found" -ForegroundColor Red
}

# Test 4: Check sidecar.log
Write-Host ""
Write-Host "[Test 4] Checking sidecar.log..." -ForegroundColor Yellow
if (Test-Path "sidecar.log") {
    $logContent = Get-Content "sidecar.log" -Raw
    if ($logContent -match "listening on ws://") {
        Write-Host "  ✓ Backend gateway started successfully" -ForegroundColor Green
    }
    if ($logContent -match "webchat connected") {
        Write-Host "  ✓ WebSocket connected" -ForegroundColor Green
    }
    if ($logContent -match "agent model: (.+)") {
        Write-Host "  Model: $($matches[1])" -ForegroundColor Gray
    }
} else {
    Write-Host "  ! sidecar.log not found" -ForegroundColor Yellow
}

# Test 5: Try HTTP request
Write-Host ""
Write-Host "[Test 5] Testing HTTP endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:18789" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  ✓ HTTP endpoint responding" -ForegroundColor Green
    Write-Host "  Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "  Note: HTTP endpoint returned: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "  (This is normal - WebSocket gateway may not respond to plain HTTP)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Application Status: " -NoNewline
if ($listening -and $process) {
    Write-Host "RUNNING ✓" -ForegroundColor Green
} else {
    Write-Host "NOT RUNNING ✗" -ForegroundColor Red
}
Write-Host ""
