# Build ClawdbotCN Native Windows Application (Tauri)
# This script builds the native desktop app that replaces ClawdbotService.exe

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Building ClawdbotCN Native App (Tauri)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Setup MSVC environment
Write-Host "[1/5] Setting up MSVC environment..." -ForegroundColor Yellow
$vcvarsPath = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if (-not (Test-Path $vcvarsPath)) {
    Write-Host "ERROR: MSVC Build Tools not found!" -ForegroundColor Red
    Write-Host "Please install Visual Studio Build Tools with C++ support." -ForegroundColor Red
    exit 1
}

# We need to call vcvars64.bat in the same session where cargo runs
# So we'll create a temporary batch file that sets up environment and runs cargo
$tempBat = Join-Path $env:TEMP "build-clawdbot-tauri.bat"

# Step 2: Build Node.js backend
Write-Host "[2/5] Building Node.js backend..." -ForegroundColor Yellow
Push-Location $PSScriptRoot\..\..\
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Backend build failed!" -ForegroundColor Red
    exit 1
}
Pop-Location

# Step 3: Build UI
Write-Host "[3/5] Building UI..." -ForegroundColor Yellow
Push-Location $PSScriptRoot\..\..\ui
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: UI build failed!" -ForegroundColor Red
    exit 1
}
Pop-Location

# Step 4: Build Tauri (Rust)
Write-Host "[4/5] Building Tauri native app..." -ForegroundColor Yellow
Write-Host "  (This may take 5-10 minutes on first build)" -ForegroundColor Gray

$tauriSrc = Join-Path $PSScriptRoot "tauri-src"

# Create batch file that sets up MSVC and builds Tauri
@"
@echo off
call "$vcvarsPath"
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
cd /d "$tauriSrc"
cargo build --release
exit /b %ERRORLEVEL%
"@ | Out-File -FilePath $tempBat -Encoding ASCII

# Run the batch file
cmd /c $tempBat
$buildResult = $LASTEXITCODE
Remove-Item $tempBat

if ($buildResult -ne 0) {
    Write-Host "ERROR: Tauri build failed!" -ForegroundColor Red
    Write-Host "  Check that Rust and MSVC are properly installed." -ForegroundColor Red
    exit 1
}

# Step 5: Copy and rename output
Write-Host "[5/5] Copying output..." -ForegroundColor Yellow

$builtExe = Join-Path $tauriSrc "target\release\clawdbot-windows.exe"
$outputExe = Join-Path $PSScriptRoot "ClawdbotCN.exe"

if (Test-Path $builtExe) {
    Copy-Item $builtExe $outputExe -Force
    $fileSize = [math]::Round((Get-Item $outputExe).Length / 1MB, 2)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host " Build Successful!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Output: $outputExe" -ForegroundColor Green
    Write-Host "  Size: $fileSize MB" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Test the app: .\ClawdbotCN.exe" -ForegroundColor Gray
    Write-Host "  2. Build installer: iscc setup.iss" -ForegroundColor Gray
} else {
    Write-Host "ERROR: Built executable not found at $builtExe" -ForegroundColor Red
    exit 1
}
