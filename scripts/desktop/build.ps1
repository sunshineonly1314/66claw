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

# ── Step 2b+3: CN encryption chain + UI build (PARALLEL) ──
# Safe to parallelize because:
#   - CN encryption writes to dist/ (cn-protected-files.json listed files only)
#   - UI build writes to dist/control-ui/ (separate subdir, not touched by CN chain)
#   - obfuscate-dist.ts only processes CN-listed files, NOT dist/control-ui/
#   - obfuscate-ui.ts only processes dist/control-ui/ JS files
Write-Host "[2b+3/6] CN encryption + UI build (parallel)..." -ForegroundColor Yellow

# Create temp scripts for parallel execution
$ts = Get-Date -Format 'yyyyMMddHHmmss'
$cnScript = Join-Path $env:TEMP "clawdbot-cn-chain-$ts.ps1"
$uiScript = Join-Path $env:TEMP "clawdbot-ui-build-$ts.ps1"
# Sentinel files for reliable exit code capture (Start-Process ExitCode can be $null)
$cnExitFile = Join-Path $env:TEMP "clawdbot-cn-exit-$ts.txt"
$uiExitFile = Join-Path $env:TEMP "clawdbot-ui-exit-$ts.txt"

# CN encryption chain script
@"
`$ErrorActionPreference = 'Continue'
Set-Location '$ProjectRoot'
`$exitCode = 0
try {
pnpm build:cn-compile
if (`$LASTEXITCODE -ne 0) { throw "build:cn-compile failed" }
pnpm build:cn-extensions
if (`$LASTEXITCODE -ne 0) { throw "build:cn-extensions failed" }
pnpm verify:extensions
if (`$LASTEXITCODE -ne 0) { throw "verify:extensions failed" }
node --import tsx scripts/obfuscate-dist.ts
if (`$LASTEXITCODE -ne 0) { throw "obfuscate-dist failed" }
# Use the bundled Node v22.16.0 for bytecode compilation so .jsc matches the runtime.
# CRITICAL: .jsc bytecode is V8-version-specific. If compiled with a different Node
# version than the one shipped in the installer, the app will crash on startup.
`$bytecodeNode = `$null
`$bytecodeNodeCandidates = @(
    '$ProjectRoot\scripts\windows\node-portable\node.exe',
    '$ProjectRoot\scripts\windows\node\node.exe'
)
foreach (`$candidate in `$bytecodeNodeCandidates) {
    if (Test-Path `$candidate) {
        `$bytecodeNode = `$candidate
        break
    }
}
if (`$bytecodeNode) {
    Write-Host "  Bytecode compile using: `$bytecodeNode"
    & `$bytecodeNode --import tsx cn/scripts/build/compile-bytecode.ts
} else {
    Write-Host "ERROR: No bundled Node 22 found for bytecode compilation!" -ForegroundColor Red
    Write-Host "  System node may have incompatible V8 version. Aborting." -ForegroundColor Red
    Write-Host "  Place node.exe v22.16.0 in one of:" -ForegroundColor Red
    foreach (`$c in `$bytecodeNodeCandidates) { Write-Host "    - `$c" -ForegroundColor Red }
    throw "No bundled Node 22 found"
}
if (`$LASTEXITCODE -ne 0) { throw "compile-bytecode failed" }
pnpm integrity:gen
if (`$LASTEXITCODE -ne 0) { throw "integrity:gen failed" }
pnpm release:changelog
if (`$LASTEXITCODE -ne 0) { throw "release:changelog failed" }
} catch {
    Write-Host "CN chain FAILED: `$_" -ForegroundColor Red
    `$exitCode = 1
}
`$exitCode | Out-File -FilePath '$cnExitFile' -Encoding ASCII -NoNewline
exit `$exitCode
"@ | Out-File -FilePath $cnScript -Encoding UTF8

# UI build + obfuscation script
@"
`$ErrorActionPreference = 'Continue'
`$exitCode = 0
try {
if (Test-Path '$ProjectRoot\ui\package.json') {
    Set-Location '$ProjectRoot\ui'
    pnpm build
    if (`$LASTEXITCODE -ne 0) { throw "ui build failed" }
}
Set-Location '$ProjectRoot'
node --import tsx cn/scripts/build/obfuscate-ui.ts
if (`$LASTEXITCODE -ne 0) { throw "obfuscate-ui failed" }
} catch {
    Write-Host "UI build FAILED: `$_" -ForegroundColor Red
    `$exitCode = 1
}
`$exitCode | Out-File -FilePath '$uiExitFile' -Encoding ASCII -NoNewline
exit `$exitCode
"@ | Out-File -FilePath $uiScript -Encoding UTF8

# Launch both in parallel
$cnProc = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$cnScript`"" -NoNewWindow -PassThru
$uiProc = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$uiScript`"" -NoNewWindow -PassThru

# Wait for both
$cnProc.WaitForExit()
$uiProc.WaitForExit()

# Read exit codes from sentinel files (reliable, unlike Start-Process ExitCode which can be $null)
$cnExit = if (Test-Path $cnExitFile) { [int](Get-Content $cnExitFile -Raw).Trim() } else { 1 }
$uiExit = if (Test-Path $uiExitFile) { [int](Get-Content $uiExitFile -Raw).Trim() } else { 1 }
Write-Host "  CN chain exit: $cnExit, UI build exit: $uiExit"

# Cleanup temp files
Remove-Item $cnScript -Force -ErrorAction SilentlyContinue
Remove-Item $uiScript -Force -ErrorAction SilentlyContinue
Remove-Item $cnExitFile -Force -ErrorAction SilentlyContinue
Remove-Item $uiExitFile -Force -ErrorAction SilentlyContinue

if ($cnExit -ne 0) {
    Write-Host "ERROR: CN encryption chain failed (exit $cnExit)!" -ForegroundColor Red
    exit 1
}
Write-Host "  CN encryption chain OK" -ForegroundColor Green

if ($uiExit -ne 0) {
    Write-Host "ERROR: UI build/obfuscation failed (exit $uiExit)!" -ForegroundColor Red
    exit 1
}
Write-Host "  UI build + obfuscation OK" -ForegroundColor Green

# ── Step 3c: Pre-packaging validation ──
Write-Host "[3c/6] Validating build artifacts..." -ForegroundColor Yellow
$buildOk = $true

# Check build-meta.json exists (bytecode V8 version record)
if (-not (Test-Path "$ProjectRoot\dist\build-meta.json")) {
    Write-Host "  ERROR: dist\build-meta.json not found! compile-bytecode.ts may have failed." -ForegroundColor Red
    $buildOk = $false
} else {
    Write-Host "  OK: build-meta.json exists" -ForegroundColor Green
}

# Check .jsc bytecode files were generated
$jscFiles = Get-ChildItem "$ProjectRoot\dist" -Filter "*.jsc" -Recurse -ErrorAction SilentlyContinue
$jscCount = if ($jscFiles) { $jscFiles.Count } else { 0 }
if ($jscCount -lt 5) {
    Write-Host "  ERROR: Only $jscCount .jsc files found (expected >= 5). Bytecode compilation may have failed." -ForegroundColor Red
    $buildOk = $false
} else {
    Write-Host "  OK: $jscCount .jsc bytecode files" -ForegroundColor Green
}

# Check control-ui was built
if (-not (Test-Path "$ProjectRoot\dist\control-ui")) {
    Write-Host "  WARN: dist\control-ui\ not found. UI build may have failed." -ForegroundColor Yellow
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
    Write-Host "  WARNING: prepare-resources.ps1 not found, skipping." -ForegroundColor Yellow
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
