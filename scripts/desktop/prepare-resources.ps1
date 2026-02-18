# Prepare bundled resources for Tauri desktop build — Windows
# Stages Node.js runtime, backend dist, extensions, skills into apps/desktop/src-tauri/resources/

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..\..").Path
$ResourcesDir = Join-Path $ProjectRoot "apps\desktop\src-tauri\resources"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Tauri Resource Preparation (Windows)"   -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Project root  : $ProjectRoot"
Write-Host "Resources dir : $ResourcesDir"
Write-Host ""

# Clean previous resources
if (Test-Path $ResourcesDir) {
    Write-Host "[Clean] Removing old resources..." -ForegroundColor Yellow
    Remove-Item $ResourcesDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $ResourcesDir | Out-Null

# ── 1. Node.js runtime ──
Write-Host "[1/7] Copying Node.js runtime..." -ForegroundColor Green
$nodeDir = Join-Path $ResourcesDir "node"
New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null

# Try multiple known locations for portable Node.js
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
        Write-Host "  OK: node.exe ($size MB) from $src"
        break
    }
}
if (-not $nodeFound) {
    Write-Host "  WARNING: node.exe not found in known locations." -ForegroundColor Yellow
    Write-Host "  You must manually place node.exe at: $nodeDir\node.exe" -ForegroundColor Yellow
}

# ── 2. Backend dist ──
Write-Host "[2/7] Copying backend dist/..." -ForegroundColor Green
$distSource = "$ProjectRoot\dist"
if (Test-Path $distSource) {
    Copy-Item $distSource "$ResourcesDir\dist" -Recurse -Force
    $distSize = [math]::Round(((Get-ChildItem "$ResourcesDir\dist" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
    Write-Host "  OK: dist/ ($distSize MB)"
} else {
    Write-Host "  ERROR: dist/ not found. Run 'pnpm build' first." -ForegroundColor Red
    exit 1
}

# ── 3. Production node_modules ──
Write-Host "[3/7] Copying production node_modules/..." -ForegroundColor Green

# Use CLAWDBOT_PROD_DEPS env var if set, otherwise fall back to project node_modules
$nmSources = @()
if ($env:CLAWDBOT_PROD_DEPS -and (Test-Path $env:CLAWDBOT_PROD_DEPS)) {
    $nmSources += "$env:CLAWDBOT_PROD_DEPS\node_modules"
}
$nmSources += "$ProjectRoot\node_modules"
$nmFound = $false
foreach ($src in $nmSources) {
    if (Test-Path $src) {
        Write-Host "  Copying from $src (this may take a few minutes)..."
        robocopy "$src" "$ResourcesDir\node_modules" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
        $nmSize = [math]::Round(((Get-ChildItem "$ResourcesDir\node_modules" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
        Write-Host "  OK: node_modules/ ($nmSize MB)"
        $nmFound = $true
        break
    }
}
if (-not $nmFound) {
    Write-Host "  WARNING: node_modules not found. The sidecar may not start." -ForegroundColor Yellow
}

# ── 4. Extensions ──
Write-Host "[4/7] Copying extensions/..." -ForegroundColor Green
$extSource = "$ProjectRoot\extensions"
if (Test-Path $extSource) {
    robocopy "$extSource" "$ResourcesDir\extensions" /E /XD node_modules .turbo /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    $extCount = (Get-ChildItem "$ResourcesDir\extensions" -Directory -ErrorAction SilentlyContinue).Count
    Write-Host "  OK: extensions/ ($extCount extensions)"
} else {
    Write-Host "  WARNING: extensions/ not found." -ForegroundColor Yellow
}

# ── 5. Skills ──
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
        Write-Host "  OK: skills/ ($skillsCount skills) from $src"
        $skillsFound = $true
        break
    }
}
if (-not $skillsFound) {
    Write-Host "  WARNING: skills not found. Skills will be unavailable." -ForegroundColor Yellow
}

# ── 6. Data & docs ──
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

# ── 7. Build metadata ──
Write-Host "[7/7] Copying build metadata..." -ForegroundColor Green
Copy-Item "$ProjectRoot\package.json" "$ResourcesDir\package.json" -Force
Write-Host "  OK: package.json"

# ── Summary ──
$totalSize = [math]::Round(((Get-ChildItem $ResourcesDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Resources ready: $totalSize MB"         -ForegroundColor Green
Write-Host " Output: $ResourcesDir"                  -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
