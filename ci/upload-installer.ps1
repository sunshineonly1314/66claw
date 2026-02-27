Set-Location D:\cicd-workspace\openclawcn

Write-Host "=== Upload Installer to Server via SCP ==="

# Read version from package.json instead of hardcoding
$pkgJson = Get-Content 'package.json' -Raw | ConvertFrom-Json
$VERSION = $pkgJson.version
Write-Host "Version (from package.json): $VERSION"

# Find installer by glob pattern instead of hardcoded path
$installerFile = Get-ChildItem -Path "E:\clawdbuild\ClawdbotCN-Setup-*-x64.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $installerFile) {
    Write-Host "ERROR: No installer found matching E:\clawdbuild\ClawdbotCN-Setup-*-x64.exe"
    exit 1
}

$remoteDir = "/data/dl/releases/$VERSION/installers"
$server = $env:DEPLOY_SERVER
if (-not $server) {
    Write-Host "ERROR: DEPLOY_SERVER environment variable must be set."
    exit 1
}

$size = $installerFile.Length
Write-Host "Uploading: $($installerFile.FullName)"
Write-Host "  Size: $([math]::Round($size / 1MB, 1)) MB"
Write-Host "  To: ${server}:${remoteDir}/"

# Compute local SHA256 before upload
$localHash = (Get-FileHash -Path $installerFile.FullName -Algorithm SHA256).Hash
Write-Host "  Local SHA256: $localHash"

ssh $server "mkdir -p $remoteDir"
scp $installerFile.FullName "${server}:${remoteDir}/"
$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    $fileName = $installerFile.Name
    Write-Host "Upload complete!"
    $domain = if ($env:DEPLOY_DOMAIN) { $env:DEPLOY_DOMAIN } else { "www.obplugins.cn" }
    Write-Host "  URL: https://$domain/releases/$VERSION/installers/$fileName"

    # Post-upload integrity check: compare remote SHA256 with local
    Write-Host "  Verifying remote integrity..."
    $remoteHash = ssh $server "sha256sum $remoteDir/$fileName" 2>$null
    if ($remoteHash) {
        $remoteHashValue = ($remoteHash -split '\s+')[0].ToUpper()
        if ($remoteHashValue -eq $localHash) {
            Write-Host "  Integrity OK: SHA256 matches" -ForegroundColor Green
        } else {
            Write-Host "  INTEGRITY MISMATCH! Local=$localHash Remote=$remoteHashValue" -ForegroundColor Red
            $exitCode = 1
        }
    } else {
        Write-Host "  WARNING: Could not verify remote hash (sha256sum not available on server)" -ForegroundColor Yellow
    }
} else {
    Write-Host "Upload FAILED (exit: $exitCode)"
}
Write-Host "=== Upload Exit: $exitCode ==="
exit $exitCode
