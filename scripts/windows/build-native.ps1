# ============================================================================
# Clawdbot Windows Native Build Script
# ============================================================================
# Usage: .\build-native.ps1 [-Clean] [-Test] [-OutputDir "E:\clawdbuild"]
# ============================================================================

param(
    [string]$OutputDir = "E:\clawdbuild",
    [switch]$Clean,      # Clean previous build before building
    [switch]$Test,       # Run test installation after build
    [switch]$SkipBuild   # Skip build, only do cleanup/test
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..\..").Path

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host "   Clawdbot Windows Native Build" -ForegroundColor Cyan
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# Step 1: Stop running Gateway processes
# ============================================================================
Write-Host "[1/5] Stopping running Gateway processes..." -ForegroundColor Yellow

# Kill any node processes that might be Clawdbot Gateway
$gatewayProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -match "Clawdbot" -or $_.CommandLine -match "clawdbot|gateway"
}

if ($gatewayProcesses) {
    Write-Host "  Found $($gatewayProcesses.Count) Gateway process(es), stopping..."
    $gatewayProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Also check port 18789
$portCheck = netstat -ano 2>$null | Select-String ":18789.*LISTENING"
if ($portCheck) {
    $procId = ($portCheck -split '\s+')[-1]
    Write-Host "  Port 18789 in use by PID $procId, killing..."
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

Write-Host "  [OK] Gateway processes stopped" -ForegroundColor Green

# ============================================================================
# Step 2: Clean previous build output
# ============================================================================
Write-Host ""
Write-Host "[2/5] Cleaning previous build..." -ForegroundColor Yellow

$installerPath = Join-Path $OutputDir "ClawdbotSetup-*.exe"
$existingInstallers = Get-ChildItem $installerPath -ErrorAction SilentlyContinue

if ($existingInstallers) {
    foreach ($installer in $existingInstallers) {
        Write-Host "  Removing: $($installer.Name)"
        Remove-Item $installer.FullName -Force
    }
}

# Clean test directory if exists
$testDir = Join-Path $OutputDir "test"
if (Test-Path $testDir) {
    Write-Host "  Removing test directory: $testDir"
    Remove-Item $testDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "  [OK] Previous build cleaned" -ForegroundColor Green

# ============================================================================
# Step 3: Build installer (unless -SkipBuild)
# ============================================================================
if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "[3/5] Building installer..." -ForegroundColor Yellow
    
    $setupIss = Join-Path $ScriptDir "setup.iss"
    if (-not (Test-Path $setupIss)) {
        Write-Host "  [ERROR] setup.iss not found: $setupIss" -ForegroundColor Red
        exit 1
    }
    
    $isccPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
    if (-not (Test-Path $isccPath)) {
        Write-Host "  [ERROR] Inno Setup not found: $isccPath" -ForegroundColor Red
        exit 1
    }
    
    $startTime = Get-Date
    & $isccPath $setupIss
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] Build failed!" -ForegroundColor Red
        exit 1
    }
    
    $buildTime = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
    Write-Host "  [OK] Build completed in $buildTime seconds" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[3/5] Skipping build (-SkipBuild)" -ForegroundColor Gray
}

# ============================================================================
# Step 4: Show build result
# ============================================================================
Write-Host ""
Write-Host "[4/5] Build result:" -ForegroundColor Yellow

$newInstaller = Get-ChildItem (Join-Path $OutputDir "ClawdbotSetup-*.exe") -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($newInstaller) {
    $sizeMB = [math]::Round($newInstaller.Length / 1MB, 2)
    Write-Host "  File: $($newInstaller.FullName)" -ForegroundColor Cyan
    Write-Host "  Size: $sizeMB MB" -ForegroundColor Cyan
} else {
    Write-Host "  [WARN] No installer found in $OutputDir" -ForegroundColor Yellow
}

# ============================================================================
# Step 5: Run test installation (if -Test)
# ============================================================================
if ($Test -and $newInstaller) {
    Write-Host ""
    Write-Host "[5/5] Running test installation..." -ForegroundColor Yellow
    
    $testInstallDir = Join-Path $OutputDir "test\Clawdbot"
    $logFile = Join-Path $OutputDir "test\install.log"
    
    # Ensure test directory exists
    New-Item -ItemType Directory -Path (Join-Path $OutputDir "test") -Force | Out-Null
    
    Write-Host "  Installing to: $testInstallDir"
    Write-Host "  Log file: $logFile"
    
    $installStart = Get-Date
    Start-Process $newInstaller.FullName -ArgumentList "/DIR=$testInstallDir", "/SILENT", "/LOG=$logFile" -Wait
    $installTime = [math]::Round(((Get-Date) - $installStart).TotalSeconds, 1)
    
    # Check result
    if (Test-Path (Join-Path $testInstallDir "node_modules")) {
        Write-Host "  [OK] Test installation completed in $installTime seconds" -ForegroundColor Green
        
        # Quick verification
        $nodeExe = Join-Path $testInstallDir "node\node.exe"
        $entryJs = Join-Path $testInstallDir "dist\entry.js"
        if ((Test-Path $nodeExe) -and (Test-Path $entryJs)) {
            $version = & $nodeExe $entryJs --version 2>&1 | Select-Object -First 1
            Write-Host "  Clawdbot version: $version" -ForegroundColor Cyan
        }
    } else {
        Write-Host "  [WARN] node_modules not found, check install log" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "[5/5] Skipping test installation (use -Test to enable)" -ForegroundColor Gray
}

# ============================================================================
# Done
# ============================================================================
Write-Host ""
Write-Host "  ========================================" -ForegroundColor Green
Write-Host "   Build Complete!" -ForegroundColor Green
Write-Host "  ========================================" -ForegroundColor Green
Write-Host ""

if ($newInstaller) {
    Write-Host "  Output: $($newInstaller.FullName)" -ForegroundColor Cyan
}
Write-Host ""
