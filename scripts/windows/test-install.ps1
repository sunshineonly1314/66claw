# Test ClawdbotCN installation
$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Testing ClawdbotCN Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Find install directory
$installDir = $null
Get-ChildItem "E:\clawdbuild" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $testPath = Join-Path $_.FullName "ClawdbotCN"
    if (Test-Path $testPath) {
        $nodeExe = Join-Path $testPath "node\node.exe"
        if (Test-Path $nodeExe) {
            $installDir = $testPath
        }
    }
}

if (-not $installDir) {
    Write-Host "ERROR: Cannot find ClawdbotCN install directory" -ForegroundColor Red
    exit 1
}

Write-Host "Found install directory:" -ForegroundColor Green
Write-Host "  $installDir" -ForegroundColor White
Write-Host ""

# Stop any running ClawdbotCN
Write-Host "Stopping ClawdbotCN if running..." -ForegroundColor Yellow
Get-Process -Name "ClawdbotCN*" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        $cmd = (Get-WmiObject Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
        if ($cmd -and $cmd -like "*entry.js*") {
            Stop-Process -Id $_.Id -Force
        }
    } catch {}
}
Start-Sleep -Seconds 2
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

# Test gateway manually
Write-Host "Testing Gateway from install directory..." -ForegroundColor Yellow

$nodeExe = Join-Path $installDir "node\node.exe"
$entryJs = Join-Path $installDir "dist\entry.js"

# Set environment
$env:CLAWDBOT_STATE_DIR = "$env:APPDATA\ClawdbotCN"
$env:CLAWDBOT_BUNDLED_PLUGINS_DIR = Join-Path $installDir "extensions"
$env:CLAWDBOT_BUNDLED_SKILLS_DIR = Join-Path $installDir "skills"
$env:CLAWDBOT_BUNDLED_TOOLS_DIR = Join-Path $installDir "tools"
$env:CLAWDBOT_GATEWAY_TOKEN = "clawdbot2026"
$env:CLAWDBOT_REGION = "cn"
$env:PATH = (Join-Path $installDir "node") + ";" + (Join-Path $installDir "tools") + ";" + $env:PATH

Write-Host "  Starting Gateway..." -ForegroundColor Gray

$testLog = Join-Path $installDir "logs\test-install.log"
$proc = Start-Process -FilePath $nodeExe `
    -ArgumentList "`"$entryJs`" gateway run --port 18789 --allow-unconfigured" `
    -WorkingDirectory $installDir `
    -RedirectStandardOutput $testLog `
    -RedirectStandardError $testLog `
    -PassThru `
    -WindowStyle Hidden

# Wait and check
$waited = 0
$success = $false

while ($waited -lt 20) {
    Start-Sleep -Seconds 1
    $waited++

    if ($proc.HasExited) {
        Write-Host ""
        Write-Host "  FAILED: Gateway crashed after $waited seconds!" -ForegroundColor Red
        Write-Host "  Exit code: $($proc.ExitCode)" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Last 30 lines of log:" -ForegroundColor Yellow
        if (Test-Path $testLog) {
            Get-Content $testLog -Tail 30 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
        }
        Write-Host ""
        Write-Host "  You need to rebuild the installer." -ForegroundColor Red
        exit 1
    }

    $conn = Get-NetTCPConnection -LocalPort 18789 -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Host ""
        Write-Host "  SUCCESS: Gateway is running!" -ForegroundColor Green
        Write-Host "  Started in $waited seconds" -ForegroundColor Gray
        $success = $true
        break
    }

    if ($waited -eq 5 -or $waited -eq 10 -or $waited -eq 15) {
        Write-Host "    Waiting... ($waited seconds)" -ForegroundColor DarkGray
    }
}

# Stop test
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue

Write-Host ""

if ($success) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host " Installation is WORKING!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "The fix was successful. You can now:" -ForegroundColor Cyan
    Write-Host "  1. Run ClawdbotCN.exe from install directory" -ForegroundColor Gray
    Write-Host "  2. Or restart the service if running as service" -ForegroundColor Gray
    Write-Host ""
    Write-Host "No need to rebuild the installer!" -ForegroundColor Green
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host " Installation test TIMEOUT" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Gateway didn't start in 20 seconds." -ForegroundColor Yellow
    Write-Host "Check test log:" -ForegroundColor Cyan
    Write-Host "  $testLog" -ForegroundColor White
    Write-Host ""
    Write-Host "You may need to rebuild the installer." -ForegroundColor Yellow
}

Write-Host ""
