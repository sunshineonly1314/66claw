# Clawdbot pkg build script (Windows)
# Usage: .\scripts\pkg-build.ps1 [-Target win-x64] [-SkipBuild]

param(
    [string]$Target = "win-x64",
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================"
Write-Host " Clawdbot pkg build - Target: $Target"
Write-Host "========================================"
Write-Host ""

# Target config
$TargetMap = @{
    "win-x64" = "node22-win-x64"
    "mac-arm64" = "node22-macos-arm64"
    "mac-x64" = "node22-macos-x64"
    "linux-x64" = "node22-linux-x64"
}

if (-not $TargetMap.ContainsKey($Target)) {
    Write-Host "ERROR: Unsupported target: $Target" -ForegroundColor Red
    exit 1
}

$pkgTarget = $TargetMap[$Target]
$outputDir = "build/pkg/$Target"
$outputFile = "$outputDir/clawdbot"
if ($Target -eq "win-x64") {
    $outputFile = "$outputDir/clawdbot.exe"
}

# 1. Production build
if (-not $SkipBuild) {
    Write-Host "[1/5] Production build..." -ForegroundColor Cyan
    pnpm build:prod
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Production build failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "OK: Production build complete" -ForegroundColor Green
}

# 2. Create output directory
Write-Host "[2/5] Preparing output directory..." -ForegroundColor Cyan
if (Test-Path $outputDir) {
    Remove-Item -Path $outputDir -Recurse -Force
}
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
Write-Host "OK: $outputDir" -ForegroundColor Green

# 3. pkg build
Write-Host "[3/5] pkg packaging..." -ForegroundColor Cyan
npx pkg . --target $pkgTarget --output $outputFile --compress GZip
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: pkg packaging failed" -ForegroundColor Red
    exit 1
}
Write-Host "OK: $outputFile" -ForegroundColor Green

# 4. Copy native modules
Write-Host "[4/5] Copying native modules..." -ForegroundColor Cyan
$nativeDir = "$outputDir/native"
New-Item -ItemType Directory -Path $nativeDir -Force | Out-Null

# Sharp
Get-ChildItem -Path "node_modules/@img/sharp-win32-x64/*.node" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName -Destination $nativeDir -Force
    Write-Host "  $($_.Name)"
}

# SQLite-vec
Get-ChildItem -Path "node_modules/sqlite-vec/**/*.node" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName -Destination $nativeDir -Force
    Write-Host "  $($_.Name)"
}

# node-pty
Get-ChildItem -Path "node_modules/@lydell/node-pty/build/Release/*.node" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName -Destination $nativeDir -Force
    Write-Host "  $($_.Name)"
}

Write-Host "OK: Native modules copied" -ForegroundColor Green

# 5. Copy extensions
Write-Host "[5/5] Copying extensions..." -ForegroundColor Cyan
$extDir = "$outputDir/extensions"
if (Test-Path "extensions") {
    Copy-Item -Path "extensions" -Destination $extDir -Recurse -Force
    Write-Host "OK: Extensions copied" -ForegroundColor Green
}

# Done
Write-Host ""
Write-Host "========================================"
Write-Host " Build complete!"
Write-Host " Output: $outputDir"
Write-Host "========================================"
Write-Host ""

# Show file size
$exeFile = Get-Item $outputFile -ErrorAction SilentlyContinue
if ($exeFile) {
    $sizeMB = [math]::Round($exeFile.Length / 1MB, 2)
    Write-Host "Executable size: $sizeMB MB"
}
