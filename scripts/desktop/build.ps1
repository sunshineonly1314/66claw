# Build ClawdbotCN Desktop Application (Tauri) — Windows
# Usage: powershell -File scripts/desktop/build.ps1

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..\..").Path
$DesktopDir = Join-Path $ProjectRoot "apps\desktop"
$TauriDir = Join-Path $DesktopDir "src-tauri"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Building ClawdbotCN Desktop (Tauri)"    -ForegroundColor Cyan
Write-Host " Platform: Windows"                      -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Project root : $ProjectRoot"
Write-Host "Tauri source : $TauriDir"
Write-Host ""

# ── Step 1: Verify prerequisites ──
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

# Check Rust
if (-not (Get-Command "cargo" -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Rust/Cargo not found. Install from https://rustup.rs" -ForegroundColor Red
    exit 1
}
Write-Host "  Cargo : $(cargo --version)"

# Check MSVC
$vcvarsPaths = @(
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat",
    "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat",
    "C:\Program Files\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvars64.bat"
)
$vcvarsPath = $null
foreach ($p in $vcvarsPaths) {
    if (Test-Path $p) { $vcvarsPath = $p; break }
}
if (-not $vcvarsPath) {
    Write-Host "ERROR: MSVC Build Tools not found!" -ForegroundColor Red
    Write-Host "  Install Visual Studio Build Tools with C++ workload." -ForegroundColor Red
    exit 1
}
Write-Host "  MSVC  : $vcvarsPath"

# Check pnpm
if (-not (Get-Command "pnpm" -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: pnpm not found." -ForegroundColor Red
    exit 1
}
Write-Host "  pnpm  : $(pnpm --version)"
Write-Host ""

# ── Step 2: Build Node.js backend + CN encryption ──
Write-Host "[2/6] Building Node.js backend (pnpm build:secure)..." -ForegroundColor Yellow
Push-Location $ProjectRoot
pnpm build:secure
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Backend build (secure) failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "  Backend build + CN encryption OK" -ForegroundColor Green

# ── Step 3: Build UI ──
Write-Host "[3/6] Building control UI..." -ForegroundColor Yellow
if (Test-Path "$ProjectRoot\ui\package.json") {
    Push-Location "$ProjectRoot\ui"
    pnpm build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: UI build failed!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
}
Write-Host "  UI build OK" -ForegroundColor Green

# ── Step 4: Prepare bundled resources ──
Write-Host "[4/6] Preparing bundled resources..." -ForegroundColor Yellow
$prepareScript = Join-Path $ScriptDir "prepare-resources.ps1"
if (Test-Path $prepareScript) {
    & $prepareScript
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Resource preparation failed!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  WARNING: prepare-resources.ps1 not found, skipping resource staging." -ForegroundColor Yellow
}

# ── Step 5: Install Tauri CLI dependencies ──
Write-Host "[5/6] Installing Tauri CLI..." -ForegroundColor Yellow
Push-Location $DesktopDir
if (Test-Path "$DesktopDir\package.json") {
    pnpm install
}
Pop-Location

# ── Step 6: Build Tauri (Rust + bundle) ──
Write-Host "[6/6] Building Tauri native app..." -ForegroundColor Yellow
Write-Host "  (First build may take 5-10 minutes)" -ForegroundColor Gray

# Create temp batch to run cargo inside MSVC environment
$tempBat = Join-Path $env:TEMP "build-clawdbot-desktop.bat"
@"
@echo off
call "$vcvarsPath"
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
cd /d "$DesktopDir"
pnpm tauri build
exit /b %ERRORLEVEL%
"@ | Out-File -FilePath $tempBat -Encoding ASCII

cmd /c $tempBat
$buildResult = $LASTEXITCODE
Remove-Item $tempBat -ErrorAction SilentlyContinue

if ($buildResult -ne 0) {
    Write-Host "ERROR: Tauri build failed!" -ForegroundColor Red
    Write-Host "  Check that Rust and MSVC are properly installed." -ForegroundColor Red
    exit 1
}

# ── Done ──
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Build Successful!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

$nsisExe = Get-ChildItem "$TauriDir\target\release\bundle\nsis\*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($nsisExe) {
    $fileSize = [math]::Round($nsisExe.Length / 1MB, 2)
    Write-Host "  Installer : $($nsisExe.FullName)" -ForegroundColor Green
    Write-Host "  Size      : $fileSize MB" -ForegroundColor Green
} else {
    Write-Host "  Check: $TauriDir\target\release\bundle\" -ForegroundColor Yellow
}
