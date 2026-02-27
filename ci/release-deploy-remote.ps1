# Release Deploy - Remote execution script
# Builds release packages and uploads via SCP to the deploy server.
# Configuration is read from environment variables (see below).
#
# Required env vars:
#   DEPLOY_SERVER  - SSH target (e.g. deploy@server-ip)
#   DEPLOY_DOMAIN  - Public domain (e.g. www.obplugins.cn)
# Optional env vars:
#   CICD_WORKSPACE - Workspace path (default: D:\cicd-workspace\openclawcn)
#   CICD_LOG_DIR   - Log directory (default: $env:USERPROFILE)

$ErrorActionPreference = 'Stop'

# --- Resolve configuration from environment ---
$DEPLOY_SERVER = $env:DEPLOY_SERVER
$DEPLOY_DOMAIN = $env:DEPLOY_DOMAIN
if (-not $DEPLOY_SERVER -or -not $DEPLOY_DOMAIN) {
    Write-Error "ERROR: DEPLOY_SERVER and DEPLOY_DOMAIN environment variables must be set."
    exit 1
}
$WORKSPACE = if ($env:CICD_WORKSPACE) { $env:CICD_WORKSPACE } else { 'D:\cicd-workspace\openclawcn' }
$LOG_DIR = if ($env:CICD_LOG_DIR) { $env:CICD_LOG_DIR } else { $env:USERPROFILE }
$LOG = Join-Path $LOG_DIR 'release-deploy.log'

# Start transcript to capture ALL output
Start-Transcript -Path $LOG -Force

Set-Location $WORKSPACE

# Pull latest code (fail fast if network is down)
Write-Output "Pulling latest code..."
git fetch origin 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "git fetch failed (exit: $LASTEXITCODE). Check network."
    Stop-Transcript; exit 1
}
git reset --hard origin/master 2>&1
Write-Output "Current commit: $(git rev-parse HEAD)"

# Reinstall dev dependencies (build may have replaced with prod-only)
Write-Output "Installing dependencies..."
npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) {
    Write-Error "npm install failed (exit: $LASTEXITCODE)."
    Stop-Transcript; exit 1
}

Write-Output "========================================="
Write-Output "  Release Deploy via SCP"
Write-Output "  Target: $DEPLOY_SERVER ($DEPLOY_DOMAIN)"
Write-Output "========================================="
Write-Output "CWD: $(Get-Location)"
Write-Output "Node: $(node --version)"
Write-Output ""

# Read version - prefer from version bump commit, fallback to package.json
$pkgJson = Get-Content 'package.json' -Raw | ConvertFrom-Json
$VERSION = $pkgJson.version
# Override with actual deployed version if package.json has upstream version
$lastBumpMsg = git log --oneline --grep="chore: bump version to" -1 2>$null
if ($lastBumpMsg -match 'bump version to (\d+\.\d+\.\d+)') {
    $VERSION = $Matches[1]
    Write-Output "Version (from version bump commit): $VERSION"
} else {
    Write-Output "Version (from package.json): $VERSION"
}

# Check installer exists
$installerPattern = "E:\clawdbuild\ClawdbotCN-Setup-*.exe"
$installers = Get-ChildItem -Path $installerPattern -ErrorAction SilentlyContinue
if (-not $installers) {
    Write-Output "ERROR: No installer found matching $installerPattern"
    Stop-Transcript
    exit 1
}
Write-Output "Installer found:"
$installers | ForEach-Object { Write-Output ("  " + $_.Name + " (" + [math]::Round($_.Length/1MB, 1) + " MB)") }
Write-Output ""

# Copy installers to temp dir to avoid EBUSY lock on E:\clawdbuild
$tmpInstallers = 'D:\cicd-workspace\openclawcn\.tmp-installers'
if (Test-Path $tmpInstallers) { Remove-Item $tmpInstallers -Recurse -Force }
New-Item -ItemType Directory -Path $tmpInstallers -Force | Out-Null
Write-Output "Copying installers to temp dir (avoiding file lock)..."
$installers | ForEach-Object {
    Write-Output "  Copying: $($_.Name)..."
    [System.IO.File]::Copy($_.FullName, "$tmpInstallers\$($_.Name)", $true)
    Write-Output "  Done: $($_.Name) ($([math]::Round((Get-Item "$tmpInstallers\$($_.Name)").Length/1MB, 1)) MB)"
}

# Run release-deploy
Write-Output ""
Write-Output "Running release-deploy.ts..."
Write-Output "  --version $VERSION"
Write-Output "  --server $DEPLOY_SERVER --domain $DEPLOY_DOMAIN"
Write-Output "  --platform windows"
Write-Output "  --installers $tmpInstallers"
Write-Output "  --cache-dir E:\clawdbuild\.release-cache"
Write-Output ""

# Use cmd /c to redirect node stdout/stderr to file, avoiding EPIPE on SSH pipe
$nodeLog = Join-Path $LOG_DIR 'release-deploy-node.log'
$cmd = "node --import tsx scripts/release-deploy.ts --version $VERSION --server $DEPLOY_SERVER --domain $DEPLOY_DOMAIN --platform windows --installers $tmpInstallers --cache-dir E:\clawdbuild\.release-cache"
Write-Output "CMD: $cmd"

cmd /c "$cmd > `"$nodeLog`" 2>&1"
$exitCode = $LASTEXITCODE

# Print the captured node output
Write-Output ""
Write-Output "=== Node Output ==="
if (Test-Path $nodeLog) {
    Get-Content $nodeLog | ForEach-Object { Write-Output $_ }
}
Write-Output "=== End Node Output ==="

Write-Output ""
if ($exitCode -eq 0) {
    Write-Output "========================================="
    Write-Output "  Release Deploy SUCCESS"
    Write-Output "========================================="
    Write-Output "Download URL: https://$DEPLOY_DOMAIN/releases/$VERSION/installers/"
} else {
    Write-Output "========================================="
    Write-Output "  Release Deploy FAILED (exit: $exitCode)"
    Write-Output "========================================="
}

Stop-Transcript
exit $exitCode
