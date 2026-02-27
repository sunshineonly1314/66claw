$ErrorActionPreference = 'Continue'
$WORKSPACE = 'D:\cicd-workspace\openclawcn'

# Fix PATH
$gitBashDir = 'C:\Program Files\Git\bin'
$gitUsrBin = 'C:\Program Files\Git\usr\bin'
if (Test-Path $gitBashDir) {
    $env:PATH = "$gitBashDir;$gitUsrBin;" + $env:PATH
}

Set-Location $WORKSPACE

# Pull latest
Write-Host "Pulling latest code..."
git fetch origin 2>&1 | Out-Null
git reset --hard origin/master 2>&1 | Out-Null
Write-Host "Commit: $(git rev-parse --short HEAD)"

# Get version
$pkgJson = Get-Content 'package.json' -Raw | ConvertFrom-Json
$VERSION = $pkgJson.version
Write-Host "Version: $VERSION"

# Install deps with pnpm
Write-Host "Installing dependencies..."
pnpm install --no-frozen-lockfile 2>$null

# ── Build ──
Write-Host ""
Write-Host "========================================="
Write-Host "  Full Build (build:secure + Tauri)"
Write-Host "========================================="
$buildScript = Join-Path $WORKSPACE 'scripts\desktop\build.ps1'
& powershell -NoProfile -ExecutionPolicy Bypass -File $buildScript
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed!"
    exit 1
}

$tauriOutput = Join-Path $WORKSPACE 'apps\desktop\src-tauri\target\release\bundle\nsis'
$artifacts = Get-ChildItem -Path "$tauriOutput\*.exe" -ErrorAction SilentlyContinue
if ($artifacts) {
    Write-Host "Build OK:"
    $artifacts | ForEach-Object {
        $mb = [math]::Round($_.Length / 1MB, 1)
        Write-Host ("  {0} ({1} MB)" -f $_.Name, $mb)
    }
} else {
    Write-Host "ERROR: No installer found!"
    exit 1
}

# ── Release Deploy ──
Write-Host ""
Write-Host "========================================="
Write-Host "  Release Deploy"
Write-Host "========================================="

Set-Location $WORKSPACE
Write-Host "CWD: $(Get-Location)"

# Reinstall full deps (build.ps1 uses --omit=dev)
Write-Host "Re-installing full dependencies for release-deploy..."
pnpm install --no-frozen-lockfile 2>$null

$releaseCacheDir = 'E:\openclawcn\.release-cache'
if (-not (Test-Path $releaseCacheDir)) {
    New-Item -ItemType Directory -Path $releaseCacheDir -Force | Out-Null
    Write-Host "Created: $releaseCacheDir"
}

$releaseArgs = @('-v', $VERSION, '--cache-dir', $releaseCacheDir, '--platform', 'windows')
if (-not $env:DEPLOY_SERVER -or -not $env:DEPLOY_DOMAIN) {
    Write-Host "ERROR: DEPLOY_SERVER and DEPLOY_DOMAIN env vars must be set."
    exit 1
}
$releaseArgs += @('--server', $env:DEPLOY_SERVER, '--domain', $env:DEPLOY_DOMAIN)
Write-Host "SCP upload to $($env:DEPLOY_DOMAIN) ENABLED"
$releaseArgs += @('--installers', $tauriOutput)

$ErrorActionPreference = 'Continue'
Write-Host "Running: node --import tsx scripts/release-deploy.ts $($releaseArgs -join ' ')"
& node --import tsx scripts/release-deploy.ts @releaseArgs
$deployExit = $LASTEXITCODE

if ($deployExit -ne 0) {
    Write-Host "WARNING: Release deploy exited with code $deployExit"
} else {
    Write-Host "Release deploy completed!"
}

Write-Host ""
Write-Host "========================================="
Write-Host "  DONE"
Write-Host "========================================="
$finalArtifact = Get-ChildItem -Path "$tauriOutput\*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($finalArtifact) {
    $mb = [math]::Round($finalArtifact.Length / 1MB, 1)
    Write-Host "Installer: $($finalArtifact.Name) ($mb MB)"
}
Write-Host "Release deploy exit: $deployExit"
