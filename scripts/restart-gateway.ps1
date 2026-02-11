# Restart ClawdbotCN Gateway
param(
    [string]$DeployDir = "E:\clawdbuild\serve\ClawdbotCN"
)

Write-Host "Stopping existing Gateway processes..." -ForegroundColor Yellow

# Kill all node processes related to ClawdbotCN
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like "*ClawdbotCN*"
} | ForEach-Object {
    Write-Host "  Killing PID: $($_.Id)" -ForegroundColor Red
    Stop-Process -Id $_.Id -Force
}

# Also kill ClawdbotService if running
Get-Process -Name "ClawdbotService" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  Killing ClawdbotService PID: $($_.Id)" -ForegroundColor Red
    Stop-Process -Id $_.Id -Force
}

Start-Sleep -Seconds 2

Write-Host "Starting Gateway..." -ForegroundColor Green
$entryJs = Join-Path $DeployDir "dist\entry.js"
$nodeExe = Join-Path $DeployDir "node-portable\node.exe"

if (-not (Test-Path $nodeExe)) {
    $nodeExe = "node"
}

Write-Host "  Node: $nodeExe"
Write-Host "  Entry: $entryJs"

# Start gateway and capture output for a few seconds
$process = Start-Process -FilePath $nodeExe -ArgumentList $entryJs -WorkingDirectory $DeployDir -PassThru -NoNewWindow -RedirectStandardOutput "$DeployDir\logs\gateway-stdout.log" -RedirectStandardError "$DeployDir\logs\gateway-stderr.log"

Write-Host "  Gateway started, PID: $($process.Id)" -ForegroundColor Green
Write-Host "  Waiting 10 seconds to check status..."

Start-Sleep -Seconds 10

if ($process.HasExited) {
    Write-Host "  FAILED: Gateway exited with code $($process.ExitCode)" -ForegroundColor Red
    Write-Host "  Stderr:" -ForegroundColor Red
    Get-Content "$DeployDir\logs\gateway-stderr.log" -Tail 30 -ErrorAction SilentlyContinue
} else {
    Write-Host "  SUCCESS: Gateway is running (PID: $($process.Id))" -ForegroundColor Green
}
