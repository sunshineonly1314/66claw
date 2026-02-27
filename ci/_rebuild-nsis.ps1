$ErrorActionPreference = 'Stop'
$WORKSPACE = 'D:\cicd-workspace\openclawcn'

# Fix PATH
$gitBashDir = 'C:\Program Files\Git\bin'
$gitUsrBin = 'C:\Program Files\Git\usr\bin'
if (Test-Path $gitBashDir) {
    $env:PATH = "$gitBashDir;$gitUsrBin;" + $env:PATH
}

Set-Location $WORKSPACE

# Pull latest changes (has updated prepare-resources.ps1)
Write-Host "Pulling latest code..."
git fetch origin
git reset --hard origin/master
Write-Host "Current commit: $(git rev-parse --short HEAD)"

# Re-run resource preparation only (skip build:secure and Rust compile)
Write-Host ""
Write-Host "========================================="
Write-Host "  Re-running prepare-resources.ps1"
Write-Host "========================================="
& powershell -NoProfile -ExecutionPolicy Bypass -File "$WORKSPACE\scripts\desktop\prepare-resources.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: prepare-resources.ps1 failed!"
    exit 1
}

# Re-run NSIS packaging only (Rust binary already compiled)
Write-Host ""
Write-Host "========================================="
Write-Host "  Re-running Tauri NSIS packaging"
Write-Host "========================================="

# Need to install tauri CLI in apps/desktop
Push-Location "$WORKSPACE\apps\desktop"
npm install --no-fund --no-audit 2>$null
Pop-Location

# Tauri build (will reuse cached Rust binary, only re-package NSIS)
Push-Location "$WORKSPACE\apps\desktop\src-tauri"
# Touch a resource to force NSIS re-package
$touchFile = "$WORKSPACE\apps\desktop\src-tauri\resources\install.json"
if (Test-Path $touchFile) {
    (Get-Item $touchFile).LastWriteTime = Get-Date
}
Pop-Location

Push-Location "$WORKSPACE\apps\desktop"
npx tauri build 2>&1
$tauriExit = $LASTEXITCODE
Pop-Location

if ($tauriExit -ne 0) {
    Write-Host "ERROR: Tauri build failed with exit code $tauriExit"
    exit 1
}

# Check output
$tauriOutput = "$WORKSPACE\apps\desktop\src-tauri\target\release\bundle\nsis"
$artifacts = Get-ChildItem -Path "$tauriOutput\*.exe" -ErrorAction SilentlyContinue
if ($artifacts) {
    Write-Host ""
    Write-Host "========================================="
    Write-Host "  Build completed!"
    Write-Host "========================================="
    $artifacts | ForEach-Object {
        $mb = [math]::Round($_.Length / 1MB, 1)
        Write-Host ("  {0} ({1} MB)" -f $_.Name, $mb)
    }
} else {
    Write-Host "ERROR: No installer found in $tauriOutput"
    exit 1
}
