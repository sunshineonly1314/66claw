# Prepare bundled resources for Tauri desktop build — Windows
# Stages Node.js runtime, backend dist, extensions, skills into apps/desktop/src-tauri/resources/

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..\..").Path
$ResourcesDir = Join-Path $ProjectRoot "apps\desktop\src-tauri\resources"

$totalTimer = [Diagnostics.Stopwatch]::StartNew()

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Tauri Resource Preparation (Windows)"   -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Project root  : $ProjectRoot"
Write-Host "Resources dir : $ResourcesDir"
Write-Host "Time          : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

# Clean previous resources
if (Test-Path $ResourcesDir) {
    Write-Host "[Clean] Removing old resources..." -ForegroundColor Yellow
    Remove-Item $ResourcesDir -Recurse -Force
    Write-Host "  Done."
}
New-Item -ItemType Directory -Force -Path $ResourcesDir | Out-Null

# ── 1. Node.js runtime ──
$stepTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host "[1/7] Copying Node.js runtime..." -ForegroundColor Green
$nodeDir = Join-Path $ResourcesDir "node"
New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null

$nodeSources = @(
    "$ProjectRoot\scripts\windows\node-portable\node.exe",
    "$ProjectRoot\scripts\windows\node\node.exe"
)
$nodeFound = $false
foreach ($src in $nodeSources) {
    if (Test-Path $src) {
        Copy-Item $src "$nodeDir\node.exe" -Force
        $nodeFound = $true
        $size = [math]::Round((Get-Item "$nodeDir\node.exe").Length / 1MB, 2)
        Write-Host "  OK: node.exe ($size MB) from $src [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"
        break
    }
}
if (-not $nodeFound) {
    Write-Host "  WARNING: node.exe not found in known locations." -ForegroundColor Yellow
    Write-Host "  You must manually place node.exe at: $nodeDir\node.exe" -ForegroundColor Yellow
}

# ── 2. Backend dist ──
$stepTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host "[2/7] Copying backend dist/..." -ForegroundColor Green
$distSource = "$ProjectRoot\dist"
if (Test-Path $distSource) {
    Copy-Item $distSource "$ResourcesDir\dist" -Recurse -Force
    $distSize = [math]::Round(((Get-ChildItem "$ResourcesDir\dist" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
    # Verify CN encrypted files
    $jscCount = (Get-ChildItem "$ResourcesDir\dist" -Recurse -Filter "*.jsc" -ErrorAction SilentlyContinue).Count
    $dispatchExists = Test-Path "$ResourcesDir\dist\dispatch"
    $licenseExists = Test-Path "$ResourcesDir\dist\license"
    $securityExists = Test-Path "$ResourcesDir\dist\security"
    Write-Host "  OK: dist/ ($distSize MB) [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"
    Write-Host "  CN encryption check: .jsc=$jscCount dispatch=$dispatchExists license=$licenseExists security=$securityExists" -ForegroundColor $(if ($jscCount -gt 0) { "Green" } else { "Red" })
    if ($jscCount -eq 0) {
        Write-Host "  WARNING: No .jsc bytecode files found! Run 'pnpm build:secure' first." -ForegroundColor Red
    }
} else {
    Write-Host "  ERROR: dist/ not found. Run 'pnpm build' first." -ForegroundColor Red
    exit 1
}

# ── 3. Production node_modules ──
$stepTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host "[3/7] Installing production node_modules/..." -ForegroundColor Green

# Use pnpm deploy to create a clean production-only node_modules
# This avoids pnpm hardlink expansion (18GB -> 1.5GB) from robocopy
$deployDir = Join-Path $env:TEMP "clawdbot-prod-deploy"
if (Test-Path $deployDir) { Remove-Item $deployDir -Recurse -Force }

Write-Host "  Strategy: pnpm deploy --prod (avoids hardlink expansion)"
Push-Location $ProjectRoot
try {
    $deployOutput = pnpm deploy --prod "$deployDir" 2>&1
    Write-Host "  pnpm deploy completed [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"

    if (Test-Path "$deployDir\node_modules") {
        $srcNmSize = [math]::Round(((Get-ChildItem "$deployDir\node_modules" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
        Write-Host "  Deployed node_modules size: $srcNmSize MB"
        Write-Host "  Copying to resources..."
        robocopy "$deployDir\node_modules" "$ResourcesDir\node_modules" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
        $nmSize = [math]::Round(((Get-ChildItem "$ResourcesDir\node_modules" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
        Write-Host "  OK: node_modules/ ($nmSize MB) [production only] [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"
    } else {
        Write-Host "  WARNING: pnpm deploy produced no node_modules, falling back to direct copy..." -ForegroundColor Yellow
        Write-Host "  Deploy output: $deployOutput" -ForegroundColor Yellow
        robocopy "$ProjectRoot\node_modules" "$ResourcesDir\node_modules" /E /XD .cache .turbo /XF *.ts *.map /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
        # Remove broken workspace symlinks/junctions
        Write-Host "  Cleaning broken symlinks..."
        $brokenLinks = 0
        Get-ChildItem "$ResourcesDir\node_modules" -Recurse -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint } |
            Where-Object { -not (Test-Path $_.FullName) } |
            ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue; $brokenLinks++ }
        Write-Host "  Removed $brokenLinks broken symlinks"
        $nmSize = [math]::Round(((Get-ChildItem "$ResourcesDir\node_modules" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
        Write-Host "  OK: node_modules/ ($nmSize MB) [fallback copy] [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"
    }
} catch {
    Write-Host "  ERROR: pnpm deploy failed: $_" -ForegroundColor Red
    Write-Host "  Falling back to direct robocopy..." -ForegroundColor Yellow
    robocopy "$ProjectRoot\node_modules" "$ResourcesDir\node_modules" /E /XD .cache .turbo /XF *.ts *.map /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    $nmSize = [math]::Round(((Get-ChildItem "$ResourcesDir\node_modules" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
    Write-Host "  OK: node_modules/ ($nmSize MB) [error fallback] [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"
} finally {
    Pop-Location
    if (Test-Path $deployDir) { Remove-Item $deployDir -Recurse -Force -ErrorAction SilentlyContinue }
}

# ── 4. Extensions ──
$stepTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host "[4/7] Copying extensions/..." -ForegroundColor Green
$extSource = "$ProjectRoot\extensions"
if (Test-Path $extSource) {
    robocopy "$extSource" "$ResourcesDir\extensions" /E /XD node_modules .turbo /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    $extCount = (Get-ChildItem "$ResourcesDir\extensions" -Directory -ErrorAction SilentlyContinue).Count
    Write-Host "  OK: extensions/ ($extCount extensions) [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"
} else {
    Write-Host "  WARNING: extensions/ not found." -ForegroundColor Yellow
}

# ── 5. Skills ──
$stepTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host "[5/7] Copying skills/..." -ForegroundColor Green
$skillsSources = @(
    "$ProjectRoot\skills-merged",
    "$ProjectRoot\skills"
)
$skillsFound = $false
foreach ($src in $skillsSources) {
    if (Test-Path $src) {
        Copy-Item $src "$ResourcesDir\skills" -Recurse -Force
        $skillsCount = (Get-ChildItem "$ResourcesDir\skills" -Directory -ErrorAction SilentlyContinue).Count
        Write-Host "  OK: skills/ ($skillsCount skills) from $src [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"
        $skillsFound = $true
        break
    }
}
if (-not $skillsFound) {
    Write-Host "  WARNING: skills not found. Skills will be unavailable." -ForegroundColor Yellow
}

# ── 6. Data & docs ──
$stepTimer = [Diagnostics.Stopwatch]::StartNew()
Write-Host "[6/7] Copying data and docs..." -ForegroundColor Green
if (Test-Path "$ProjectRoot\data") {
    Copy-Item "$ProjectRoot\data" "$ResourcesDir\data" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  OK: data/"
}
if (Test-Path "$ProjectRoot\docs-cn\reference\templates") {
    New-Item -ItemType Directory -Force -Path "$ResourcesDir\docs\reference" | Out-Null
    Copy-Item "$ProjectRoot\docs-cn\reference\templates" "$ResourcesDir\docs\reference\templates" -Recurse -Force
    Write-Host "  OK: docs/reference/templates/"
}
Write-Host "  [$($stepTimer.Elapsed.TotalSeconds.ToString('0.0'))s]"

# ── 7. Build metadata ──
Write-Host "[7/7] Copying build metadata..." -ForegroundColor Green
Copy-Item "$ProjectRoot\package.json" "$ResourcesDir\package.json" -Force
Write-Host "  OK: package.json"

# ── Summary ──
$totalSize = [math]::Round(((Get-ChildItem $ResourcesDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
$totalElapsed = $totalTimer.Elapsed
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Resources ready: $totalSize MB"         -ForegroundColor Green
Write-Host " Output: $ResourcesDir"                  -ForegroundColor Green
Write-Host " Time: $($totalElapsed.Minutes)m $($totalElapsed.Seconds)s"  -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Sanity checks
if ($totalSize -gt 5000) {
    Write-Host " WARNING: Resources > 5GB ($totalSize MB). Check for pnpm hardlink expansion!" -ForegroundColor Red
}
if ($totalSize -lt 100) {
    Write-Host " WARNING: Resources < 100MB ($totalSize MB). Likely missing node_modules!" -ForegroundColor Red
}
