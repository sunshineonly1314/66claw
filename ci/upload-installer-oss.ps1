# Upload installer .exe to server via SCP
# Handles file lock by waiting/retrying via robocopy

$ErrorActionPreference = 'Continue'
$LOG = Join-Path $env:USERPROFILE 'upload-installer.log'
Start-Transcript -Path $LOG -Force

$WORKSPACE = 'D:\cicd-workspace\openclawcn'
Set-Location $WORKSPACE

$server = $env:DEPLOY_SERVER
if (-not $server) {
    Write-Output "ERROR: DEPLOY_SERVER environment variable must be set."
    Stop-Transcript; exit 1
}

$pkgJson = Get-Content 'package.json' -Raw | ConvertFrom-Json
$VERSION = $pkgJson.version
Write-Output "Version: $VERSION"

# Find installer
$installerFile = Get-ChildItem -Path "E:\clawdbuild\ClawdbotCN-Setup-*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $installerFile) {
    Write-Output "ERROR: No installer found"
    Stop-Transcript
    exit 1
}
Write-Output "Installer: $($installerFile.FullName) ($([math]::Round($installerFile.Length/1MB, 1)) MB)"

# Check what's locking the file
Write-Output ""
Write-Output "Checking file locks..."
$handles = Get-Process | Where-Object {
    try { $_.Modules | Where-Object { $_.FileName -like "*ClawdbotCN-Setup*" } } catch {}
}
if ($handles) {
    Write-Output "Processes using the file:"
    $handles | ForEach-Object { Write-Output "  PID=$($_.Id) Name=$($_.ProcessName)" }
} else {
    Write-Output "No process found locking the file via modules."
}

# Try to copy using robocopy (handles locks better than .NET)
$tmpDir = 'D:\cicd-workspace\openclawcn\.tmp-installers'
if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

Write-Output ""
Write-Output "Copying with robocopy..."
robocopy (Split-Path $installerFile.FullName) $tmpDir $installerFile.Name /R:3 /W:5 /NFL /NDL
$robocopyExit = $LASTEXITCODE
Write-Output "Robocopy exit: $robocopyExit"

if ($robocopyExit -lt 8) {
    # robocopy: 0=no copy needed, 1=copied, <8 = success
    $copiedFile = Join-Path $tmpDir $installerFile.Name
    if (Test-Path $copiedFile) {
        $copiedSize = (Get-Item $copiedFile).Length
        Write-Output "Copied: $copiedFile ($([math]::Round($copiedSize/1MB, 1)) MB)"
    } else {
        Write-Output "ERROR: Robocopy succeeded but file not found at $copiedFile"
        Stop-Transcript
        exit 1
    }
} else {
    Write-Output "ERROR: Robocopy failed (exit: $robocopyExit), trying direct upload from source..."
    $copiedFile = $installerFile.FullName
}

# Upload to server via SCP
Write-Output ""
Write-Output "Uploading to server via SCP..."

$remoteDir = "/data/dl/releases/$VERSION/installers"
Write-Output "  File: $copiedFile"
Write-Output "  Remote: ${server}:${remoteDir}/"

ssh $server "mkdir -p $remoteDir"
scp $copiedFile "${server}:${remoteDir}/"
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Output ""
    Write-Output "========================================="
    Write-Output "  Installer Upload SUCCESS"
    Write-Output "========================================="
    $domain = if ($env:DEPLOY_DOMAIN) { $env:DEPLOY_DOMAIN } else { "www.obplugins.cn" }
    Write-Output "Download: https://$domain/releases/$VERSION/installers/$($installerFile.Name)"

    # Post-upload integrity check
    $localHash = (Get-FileHash -Path $copiedFile -Algorithm SHA256).Hash
    Write-Output "  Local SHA256: $localHash"
    Write-Output "  Verifying remote integrity..."
    $remoteHash = ssh $server "sha256sum $remoteDir/$($installerFile.Name)" 2>$null
    if ($remoteHash) {
        $remoteHashValue = ($remoteHash -split '\s+')[0].ToUpper()
        if ($remoteHashValue -eq $localHash) {
            Write-Output "  Integrity OK: SHA256 matches"
        } else {
            Write-Output "  INTEGRITY MISMATCH! Local=$localHash Remote=$remoteHashValue"
            $exitCode = 1
        }
    } else {
        Write-Output "  WARNING: Could not verify remote hash (sha256sum not available on server)"
    }
} else {
    Write-Output ""
    Write-Output "========================================="
    Write-Output "  Installer Upload FAILED (exit: $exitCode)"
    Write-Output "========================================="
}

Stop-Transcript
exit $exitCode
