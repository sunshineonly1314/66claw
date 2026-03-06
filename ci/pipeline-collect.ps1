<#
.SYNOPSIS
  Pipeline Phase 4: Archive verified artifacts + SHA256 checksums + history cleanup
.DESCRIPTION
  Copies verified artifacts to E:\openclawcn\.release-cache\{version}\installers\,
  generates checksums, and cleans old versions (keeps last 5).
#>
param(
    [string]$StateFile,
    [string]$LogDir,
    [string]$Platform = "all",
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not $ProjectRoot) { $ProjectRoot = (Resolve-Path "$PSScriptRoot\..").Path }

# Load state
if ($StateFile -and (Test-Path $StateFile)) { . $StateFile }
$VERSION = if ($PL_VERSION) { $PL_VERSION } else { (Get-Content "$ProjectRoot\package.json" -Raw | ConvertFrom-Json).version }

Write-Host "[collect] Version: $VERSION | Platform: $Platform"

# Read config
$configFile = Join-Path $PSScriptRoot "config.json"
$CACHE_DIR = "E:\openclawcn\.release-cache"
if (Test-Path $configFile) {
    try {
        $config = Get-Content $configFile -Raw | ConvertFrom-Json
        if ($config.release.cache_dir) { $CACHE_DIR = $config.release.cache_dir }
    } catch { }
}

$ARCHIVE_DIR = Join-Path $CACHE_DIR "$VERSION\installers"

# ══════════════════════════════════════════════
# Step 1: Confirm artifacts
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "[collect] Step 1: Confirm artifacts"

$hasWin = $false
$hasMac = $false

if ($Platform -in @("all","windows")) {
    if ($PL_WIN_EXE -and (Test-Path $PL_WIN_EXE)) {
        $winSize = [math]::Round((Get-Item $PL_WIN_EXE).Length / 1MB)
        Write-Host "  Windows: $PL_WIN_EXE (${winSize}MB)" -ForegroundColor Green
        $hasWin = $true
    } else {
        Write-Host "  ERROR: Windows artifact not found: $PL_WIN_EXE" -ForegroundColor Red
        exit 1
    }
}

if ($Platform -in @("all","macos")) {
    if ($PL_MAC_DMG -and (Test-Path $PL_MAC_DMG)) {
        $macSize = [math]::Round((Get-Item $PL_MAC_DMG).Length / 1MB)
        Write-Host "  macOS: $PL_MAC_DMG (${macSize}MB)" -ForegroundColor Green
        $hasMac = $true
    } else {
        Write-Host "  ERROR: macOS artifact not found: $PL_MAC_DMG" -ForegroundColor Red
        exit 1
    }
}

# ══════════════════════════════════════════════
# Step 2: Archive to version directory
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "[collect] Step 2: Archive to $ARCHIVE_DIR"

New-Item -ItemType Directory -Force -Path $ARCHIVE_DIR | Out-Null

if ($hasWin) {
    $winDst = Join-Path $ARCHIVE_DIR ([System.IO.Path]::GetFileName($PL_WIN_EXE))
    Copy-Item $PL_WIN_EXE $winDst -Force
    Write-Host "  Copied: $([System.IO.Path]::GetFileName($PL_WIN_EXE))" -ForegroundColor Green
}

if ($hasMac) {
    $macDst = Join-Path $ARCHIVE_DIR ([System.IO.Path]::GetFileName($PL_MAC_DMG))
    Copy-Item $PL_MAC_DMG $macDst -Force
    Write-Host "  Copied: $([System.IO.Path]::GetFileName($PL_MAC_DMG))" -ForegroundColor Green
}

# ══════════════════════════════════════════════
# Step 3: Generate SHA256 checksums
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "[collect] Step 3: Generate checksums"

$checksumFile = Join-Path $ARCHIVE_DIR "checksums.sha256"
$checksumLines = @()

foreach ($file in (Get-ChildItem $ARCHIVE_DIR -File | Where-Object { $_.Name -ne "checksums.sha256" })) {
    $hash = (Get-FileHash $file.FullName -Algorithm SHA256).Hash.ToLower()
    $checksumLines += "$hash  $($file.Name)"
    Write-Host "  $($file.Name): $hash"
}

$checksumLines | Set-Content $checksumFile -Encoding UTF8
Write-Host "  Written: checksums.sha256" -ForegroundColor Green

# ══════════════════════════════════════════════
# Step 4: Clean old versions (keep 5)
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "[collect] Step 4: Clean old versions"

$KEEP_COUNT = 5
if (Test-Path $CACHE_DIR) {
    $allVersions = Get-ChildItem $CACHE_DIR -Directory |
        Where-Object { $_.Name -match '^\d+\.\d+\.\d+' } |
        Sort-Object { [version]($_.Name -replace '[^0-9.]', '') } -Descending

    if ($allVersions.Count -gt $KEEP_COUNT) {
        $toDelete = $allVersions | Select-Object -Skip $KEEP_COUNT
        foreach ($old in $toDelete) {
            Remove-Item $old.FullName -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "  Cleaned: $($old.Name)"
        }
    } else {
        Write-Host "  $($allVersions.Count) version(s) cached — no cleanup needed." -ForegroundColor DarkGray
    }
}

# ══════════════════════════════════════════════
# Step 5: Summary
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "════════════════════════════════════════════"
Write-Host "  Artifact Archive Summary"
Write-Host "  Version:  $VERSION"
Write-Host "  Location: $ARCHIVE_DIR"
if ($hasWin) { Write-Host "  Windows:  $([System.IO.Path]::GetFileName($PL_WIN_EXE)) (${winSize}MB)" }
if ($hasMac) { Write-Host "  macOS:    $([System.IO.Path]::GetFileName($PL_MAC_DMG)) (${macSize}MB)" }
Write-Host "════════════════════════════════════════════"

# Update state
if ($StateFile) {
    Add-Content $StateFile @"

`$PL_ARCHIVE_DIR = "$ARCHIVE_DIR"
"@
}

Write-Host "[collect] Done" -ForegroundColor Green
exit 0
