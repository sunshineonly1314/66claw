# Release Deploy - Remote execution script for KEVINSUN
# Sets OSS env vars and runs release-deploy.ts on the remote build machine
# All output is logged to C:\Users\SunBin\release-deploy.log

$ErrorActionPreference = 'Continue'
$LOG = 'C:\Users\SunBin\release-deploy.log'

# Start transcript to capture ALL output
Start-Transcript -Path $LOG -Force

# ── Set permanent OSS env vars (Machine scope) ──
[Environment]::SetEnvironmentVariable("OSS_ACCESS_KEY_ID", "LTAI5tGbuzYX98dppnUcs2tU", "Machine")
[Environment]::SetEnvironmentVariable("OSS_ACCESS_KEY_SECRET", "1k2GQB7r3wNqsmxivnJWZ6D4PYr1da", "Machine")
[Environment]::SetEnvironmentVariable("OSS_BUCKET", "chuhai-tecbin", "Machine")
[Environment]::SetEnvironmentVariable("OSS_REGION", "oss-cn-hangzhou", "Machine")

# ── Also set for current session ──
$env:OSS_ACCESS_KEY_ID = "LTAI5tGbuzYX98dppnUcs2tU"
$env:OSS_ACCESS_KEY_SECRET = "1k2GQB7r3wNqsmxivnJWZ6D4PYr1da"
$env:OSS_BUCKET = "chuhai-tecbin"
$env:OSS_REGION = "oss-cn-hangzhou"

$WORKSPACE = 'D:\cicd-workspace\openclawcn'
Set-Location $WORKSPACE

# Pull latest code
Write-Output "Pulling latest code..."
git fetch origin 2>&1
git reset --hard origin/master 2>&1
Write-Output "Current commit: $(git rev-parse HEAD)"

# Reinstall dev dependencies (build may have replaced with prod-only)
Write-Output "Installing dependencies..."
npm install --no-fund --no-audit 2>$null

Write-Output "========================================="
Write-Output "  Release Deploy to Aliyun OSS"
Write-Output "========================================="
Write-Output "CWD: $(Get-Location)"
Write-Output "Node: $(node --version)"
Write-Output "OSS AK: $($env:OSS_ACCESS_KEY_ID.Substring(0,8))..."
Write-Output "OSS Bucket: $env:OSS_BUCKET"
Write-Output "OSS Region: $env:OSS_REGION"
Write-Output ""

# Read version from package.json
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

# Ensure ali-oss package is available
Write-Output "Checking ali-oss dependency..."
if (-not (Test-Path "node_modules/ali-oss")) {
    Write-Output "Installing ali-oss..."
    npm install ali-oss --no-save --no-fund --no-audit 2>&1
}

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
Write-Output "  --oss --oss-domain dl.obplugins.cn"
Write-Output "  --platform windows"
Write-Output "  --installers $tmpInstallers"
Write-Output "  --cache-dir E:\clawdbuild\.release-cache"
Write-Output "  --notify-url https://dl.obplugins.cn/api/v1/release/notify"
Write-Output ""

# Use cmd /c to redirect node stdout/stderr to file, avoiding EPIPE on SSH pipe
$nodeLog = 'C:\Users\SunBin\release-deploy-node.log'
$cmd = "node --import tsx scripts/release-deploy.ts --version $VERSION --oss --oss-domain dl.obplugins.cn --platform windows --installers $tmpInstallers --cache-dir E:\clawdbuild\.release-cache --notify-url https://dl.obplugins.cn/api/v1/release/notify"
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
    Write-Output "Download URL: https://dl.obplugins.cn/releases/$VERSION/installers/"
} else {
    Write-Output "========================================="
    Write-Output "  Release Deploy FAILED (exit: $exitCode)"
    Write-Output "========================================="
}

Stop-Transcript
exit $exitCode
