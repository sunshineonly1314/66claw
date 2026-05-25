# Build ClawdbotCN Desktop Application (Tauri) — Windows
# Usage: powershell -File scripts/desktop/build.ps1

# Use Continue so that stderr output from native commands (e.g. pnpm warnings)
# does not trigger PowerShell's NativeCommandError termination.
# We check $LASTEXITCODE explicitly after each step instead.
$ErrorActionPreference = "Continue"
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

# ── Version consistency check ──
# LESSON LEARNED (v1.6.7): build-info.json showed 1.6.5 because apps/desktop/package.json
# and tauri.conf.json were not bumped before build. Detect this early to abort.
$rootVer = ""
$desktopVer = ""
$tauriVer = ""
try {
    $rootVer    = (Get-Content "$ProjectRoot\package.json"                              -Raw | ConvertFrom-Json).version
    $desktopVer = (Get-Content "$DesktopDir\package.json"                              -Raw | ConvertFrom-Json).version
    $tauriConf  =  Get-Content "$TauriDir\tauri.conf.json"                             -Raw | ConvertFrom-Json
    # tauri.conf.json v2 uses "version" at root; v1 used "package.version" or "productVersion"
    $tauriVer   = if ($tauriConf.version) { $tauriConf.version } `
                  elseif ($tauriConf.productVersion) { $tauriConf.productVersion } `
                  else { $tauriConf.package.version }
} catch {
    Write-Host "ERROR: Failed to read version fields: $_" -ForegroundColor Red
    exit 1
}
Write-Host "  Version check:"
Write-Host "    root package.json      : $rootVer"
Write-Host "    desktop package.json   : $desktopVer"
Write-Host "    tauri.conf.json        : $tauriVer"
if ($rootVer -ne $desktopVer -or $rootVer -ne $tauriVer) {
    Write-Host ""
    Write-Host "ERROR: Version mismatch detected!" -ForegroundColor Red
    Write-Host "  All three files must have the same version before building." -ForegroundColor Red
    Write-Host "  Fix: update apps\desktop\package.json and apps\desktop\src-tauri\tauri.conf.json to $rootVer" -ForegroundColor Yellow
    exit 1
}
Write-Host "  OK: all versions consistent ($rootVer)" -ForegroundColor Green
Write-Host ""

# ── Step 2a: Base build (tsdown) ──
# Must run first: tsdown clears dist/ before writing, so UI build cannot start yet
Write-Host "[2a/6] Building Node.js backend (base tsdown)..." -ForegroundColor Yellow
Push-Location $ProjectRoot
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Base build (tsdown) failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "  Base build (tsdown) OK" -ForegroundColor Green

# ── Step 2a-oem: OEM assets injection (MUST run BEFORE UI build) ──
# apply-oem-assets.ts copies oem/ui/* → ui/public/ so Vite bundles them into dist/control-ui/.
# This MUST run before Step 2b+3 (UI build) otherwise OEM qrcode images won't be in the package.
# Same fix as macOS build.sh (commit a8a9b481cf).
$viteEdForOem = if ($env:VITE_EDITION) { $env:VITE_EDITION } else { "" }
if ($viteEdForOem -eq "overseas") {
    Write-Host "[2a-oem/6] Applying OEM brand assets (VITE_EDITION=overseas)..." -ForegroundColor Yellow
    Push-Location $ProjectRoot
    node --import tsx scripts/apply-oem-assets.ts
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: apply-oem-assets.ts failed!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Host "  OEM assets injected into ui/public/" -ForegroundColor Green
} else {
    Write-Host "[2a-oem/6] VITE_EDITION != overseas - skipping OEM assets"
}

# -- Step 2b+3: Core, extension, and UI build --
Write-Host "[2b+3/6] Building core, extensions, and UI..." -ForegroundColor Yellow

Push-Location $ProjectRoot
pnpm build
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "ERROR: core build failed" -ForegroundColor Red; exit 1 }
pnpm build:cn-extensions
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "ERROR: extension build failed" -ForegroundColor Red; exit 1 }
pnpm verify:extensions
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "ERROR: extension verification failed" -ForegroundColor Red; exit 1 }
pnpm release:changelog
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "ERROR: changelog generation failed" -ForegroundColor Red; exit 1 }
Pop-Location

if (Test-Path "$ProjectRoot\ui\package.json") {
    Push-Location "$ProjectRoot\ui"
    if (-not $env:VITE_EDITION) { $env:VITE_EDITION = "cn" }
    pnpm build
    if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "ERROR: UI build failed" -ForegroundColor Red; exit 1 }
    Pop-Location
}
Write-Host "  Build pipeline OK" -ForegroundColor Green

# ── Step 3c: Pre-packaging validation ──
Write-Host "[3c/6] Validating build artifacts..." -ForegroundColor Yellow
$buildOk = $true

# Check control-ui/index.html was built (FATAL — missing causes 'asset not found: index.html' at startup)
# LESSON LEARNED (v1.6.7): partial rebuild that skips prepare-resources.ps1 will leave
# resources/dist/control-ui/ without index.html, causing Tauri to crash on startup.
if (-not (Test-Path "$ProjectRoot\dist\control-ui\index.html")) {
    Write-Host "  ERROR: dist\control-ui\index.html not found!" -ForegroundColor Red
    Write-Host "  This WILL cause 'asset not found: index.html' crash when the app starts." -ForegroundColor Red
    Write-Host "  Run: cd ui && pnpm build" -ForegroundColor Yellow
    $buildOk = $false
} else {
    Write-Host "  OK: dist\control-ui\index.html exists" -ForegroundColor Green
}

# Check entry.js (required by Tauri startup script)
if (-not (Test-Path "$ProjectRoot\dist\entry.js")) {
    Write-Host "  ERROR: dist\entry.js not found! Base build may have failed." -ForegroundColor Red
    $buildOk = $false
} else {
    Write-Host "  OK: dist\entry.js exists" -ForegroundColor Green
}

if (-not $buildOk) {
    Write-Host "FATAL: Build validation failed. Aborting packaging." -ForegroundColor Red
    exit 1
}
Write-Host "  Build validation passed" -ForegroundColor Green

# ── Step 4+5: Prepare resources + Tauri CLI install (PARALLEL) ──
# Safe to parallelize because:
#   - prepare-resources writes to apps/desktop/src-tauri/resources/
#   - Tauri CLI install writes to apps/desktop/node_modules/
#   - Completely separate directories, no conflicts
Write-Host "[4+5/6] Preparing resources + Installing Tauri CLI (parallel)..." -ForegroundColor Yellow

$prepareScript = Join-Path $ScriptDir "prepare-resources.ps1"
$prepProc = $null
$tauriProc = $null

if (Test-Path $prepareScript) {
    $prepProc = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$prepareScript`"" -NoNewWindow -PassThru
}

if (Test-Path "$DesktopDir\package.json") {
    $tauriInstallScript = Join-Path $env:TEMP "clawdbot-tauri-install-$(Get-Date -Format 'yyyyMMddHHmmss').ps1"
    @"
`$ErrorActionPreference = 'Continue'
Set-Location '$DesktopDir'
pnpm install
if (`$LASTEXITCODE -ne 0) { exit 1 }
"@ | Out-File -FilePath $tauriInstallScript -Encoding UTF8
    $tauriProc = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$tauriInstallScript`"" -NoNewWindow -PassThru
}

if ($prepProc) {
    $prepProc.WaitForExit()
    $prepExit = if ($prepProc.HasExited -and $null -ne $prepProc.ExitCode) { $prepProc.ExitCode } else { 0 }
    if ($prepExit -ne 0) {
        Write-Host "ERROR: Resource preparation failed (exit $prepExit)!" -ForegroundColor Red
        if ($tauriProc -and -not $tauriProc.HasExited) { $tauriProc.Kill() }
        exit 1
    }
    Write-Host "  Resource preparation OK" -ForegroundColor Green
} else {
    Write-Host "ERROR: prepare-resources.ps1 not found at $prepareScript!" -ForegroundColor Red
    Write-Host "  Without resources, Tauri build will produce a broken installer." -ForegroundColor Red
    exit 1
}

if ($tauriProc) {
    $tauriProc.WaitForExit()
    Remove-Item $tauriInstallScript -Force -ErrorAction SilentlyContinue
    $tauriInstallExit = if ($tauriProc.HasExited -and $null -ne $tauriProc.ExitCode) { $tauriProc.ExitCode } else { 0 }
    if ($tauriInstallExit -ne 0) {
        Write-Host "ERROR: Tauri CLI install failed (exit $tauriInstallExit)!" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Tauri CLI install OK" -ForegroundColor Green
}

# ── Step 5.5: Apply OEM config to tauri.conf.json (if OEM_ID set) ──
$oemId = if ($env:OEM_ID) { $env:OEM_ID.Trim() } else { "" }
if ($oemId -and $oemId -ne "") {
    Write-Host "[5.5/6] Applying OEM config: $oemId ..." -ForegroundColor Yellow
    Push-Location $ProjectRoot
    $env:OEM_ID = $oemId
    node --import tsx scripts/desktop/apply-oem-config.ts
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: apply-oem-config.ts failed!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Host "  OEM config applied OK" -ForegroundColor Green
}

# ── Step 5.9: Pre-Tauri hardening (process cleanup + Rust cache + Defender) ──
# LESSON LEARNED (v1.6.7): multiple failures traced to these three root causes.
Write-Host "[5.9/6] Pre-Tauri hardening..." -ForegroundColor Yellow

# a) Kill old clawdbot-desktop.exe to prevent NSIS 'os error 32' (file locked)
# LESSON LEARNED: NSIS fails with "os error 32" if the EXE from a previous install is still running.
$oldProcs = Get-Process -Name "clawdbot-desktop" -ErrorAction SilentlyContinue
if ($oldProcs) {
    Write-Host "  Stopping $($oldProcs.Count) running clawdbot-desktop.exe process(es)..." -ForegroundColor Yellow
    $oldProcs | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 1000
    Write-Host "  OK: old processes terminated" -ForegroundColor Green
} else {
    Write-Host "  OK: no clawdbot-desktop.exe running"
}

# b) Add Windows Defender exclusion for Rust build directory
# LESSON LEARNED: AV real-time scan locks .exe files mid-write, causing 'os error 32'.
Write-Host "  Adding Windows Defender exclusion for Rust target dir..." -ForegroundColor Gray
Add-MpPreference -ExclusionPath "$DesktopDir\src-tauri\target" -ErrorAction SilentlyContinue
Add-MpPreference -ExclusionPath "$TauriDir\target" -ErrorAction SilentlyContinue
Write-Host "  OK: Defender exclusion applied" -ForegroundColor Green

# c) Clean stale Rust build artifacts to avoid '__TAURI_BUNDLE_TYPE variable not found'
# LESSON LEARNED: When tauri.conf.json changes version, old incremental Rust cache gets
# confused about bundle type → build fails. Deleting ONLY the tauri-specific artifacts
# (not the full target/) avoids a full 40-minute recompile while fixing the stale cache.
$rustReleaseDir = "$DesktopDir\src-tauri\target\release"
if (Test-Path $rustReleaseDir) {
    Write-Host "  Cleaning stale Tauri Rust artifacts..." -ForegroundColor Gray
    # Remove the old EXE (file lock source)
    Remove-Item "$rustReleaseDir\clawdbot-desktop.exe" -Force -ErrorAction SilentlyContinue
    # Remove old bundle output (NSIS, DMG, etc.) — forces fresh NSIS generation
    Remove-Item "$rustReleaseDir\bundle" -Recurse -Force -ErrorAction SilentlyContinue
    # Remove tauri-specific build cache (contains the __TAURI_BUNDLE_TYPE env variable)
    Get-ChildItem "$rustReleaseDir\build" -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^(tauri|clawdbot)' } |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    # Remove incremental and deps caches for clawdbot-desktop binary
    Get-ChildItem "$rustReleaseDir\incremental" -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^clawdbot.desktop' } |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Get-ChildItem "$rustReleaseDir\deps" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^clawdbot.desktop' } |
        Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "  OK: stale Tauri artifacts cleaned" -ForegroundColor Green
} else {
    Write-Host "  OK: no existing target/release dir (first build)"
}

# d) Final gate: verify resources/dist/control-ui/index.html before Tauri packages it
# LESSON LEARNED: prepare-resources.ps1 copies dist/ → resources/dist/. If a partial
# rebuild skips prepare-resources.ps1, resources/dist/control-ui/ will be empty and
# Tauri will package an installer that crashes on startup with 'asset not found: index.html'.
$resourcesControlUi = "$TauriDir\resources\dist\control-ui\index.html"
if (-not (Test-Path $resourcesControlUi)) {
    Write-Host ""
    Write-Host "FATAL: resources/dist/control-ui/index.html is MISSING!" -ForegroundColor Red
    Write-Host "  The installer would crash on startup with 'asset not found: index.html'." -ForegroundColor Red
    Write-Host "  This happens when prepare-resources.ps1 was not run (partial rebuild)." -ForegroundColor Red
    Write-Host "  Fix: re-run prepare-resources.ps1 OR copy dist\control-ui to resources\dist\control-ui" -ForegroundColor Yellow
    Write-Host "    cp -r dist\control-ui apps\desktop\src-tauri\resources\dist\control-ui" -ForegroundColor Yellow
    exit 1
}
Write-Host "  OK: resources/dist/control-ui/index.html confirmed present" -ForegroundColor Green

# e) Verify @whiskeysockets/baileys stub exists in resources
# Without this stub, ALL plugins crash with "Cannot find module '@whiskeysockets/baileys'"
$stubBase = "$TauriDir\resources\node_modules\@whiskeysockets\baileys"
$stubOk = $true
foreach ($stubFile in @("package.json", "index.js", "index.mjs")) {
    if (-not (Test-Path "$stubBase\$stubFile")) {
        Write-Host "  FATAL: baileys stub missing: $stubFile" -ForegroundColor Red
        $stubOk = $false
    }
}
if ($stubOk) {
    Write-Host "  OK: @whiskeysockets/baileys stub verified (package.json + index.js + index.mjs)" -ForegroundColor Green
} else {
    Write-Host "  Without this stub, ALL plugins will crash at runtime." -ForegroundColor Red
    Write-Host "  Fix: re-run prepare-resources.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "  Pre-Tauri hardening complete" -ForegroundColor Green
Write-Host ""

# ── Step 6: Build Tauri (Rust + bundle) ──
# NOTE: tauri.conf.json beforeBuildCommand is empty — UI is already built in Step 3
Write-Host "[6/6] Building Tauri native app..." -ForegroundColor Yellow
Write-Host "  (First build may take 5-10 minutes)" -ForegroundColor Gray

# Create temp batch to run cargo inside MSVC environment
# Quote $vcvarsPath inside the bat to handle paths with spaces/parens like "Program Files (x86)"
$tempBat = Join-Path $env:TEMP "build-clawdbot-desktop.bat"
@"
@echo off
call "$vcvarsPath"
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to initialize MSVC environment
    exit /b 1
)
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
cd /d "$DesktopDir"
pnpm tauri build
exit /b %ERRORLEVEL%
"@ | Out-File -FilePath $tempBat -Encoding ASCII

cmd /c $tempBat
$buildResult = $LASTEXITCODE
Remove-Item $tempBat -ErrorAction SilentlyContinue

# Restore tauri.conf.json if OEM was applied
if ($oemId -and $oemId -ne "") {
    Write-Host "  Restoring tauri.conf.json after OEM build..." -ForegroundColor Gray
    Push-Location $ProjectRoot
    node --import tsx scripts/desktop/restore-tauri-conf.ts
    Pop-Location
}

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
if (-not $nsisExe) {
    Write-Host ""
    Write-Host "FATAL: NSIS installer not found after Tauri build!" -ForegroundColor Red
    Write-Host "  Expected at: $TauriDir\target\release\bundle\nsis\*.exe" -ForegroundColor Red
    Write-Host "  Tauri build returned 0 but produced no installer — check build log above." -ForegroundColor Red
    exit 1
}
# Sanity-check installer size: a valid installer should be > 100 MB
# (a near-empty or truncated NSIS package is < 10 MB and will not install correctly)
$fileSizeMB = [math]::Round($nsisExe.Length / 1MB, 2)
if ($nsisExe.Length -lt 100MB) {
    Write-Host "FATAL: NSIS installer is only $fileSizeMB MB (expected > 100 MB)!" -ForegroundColor Red
    Write-Host "  File may be truncated or NSIS packaging was incomplete." -ForegroundColor Red
    exit 1
}
Write-Host "  Installer : $($nsisExe.FullName)" -ForegroundColor Green
Write-Host "  Size      : $fileSizeMB MB" -ForegroundColor Green
Write-Host "  NSIS installer verified OK" -ForegroundColor Green
