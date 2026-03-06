<#
.SYNOPSIS
  Pipeline Phase 5: Generate release packages (full + delta) → upload → verify
.DESCRIPTION
  Calls release-deploy.ts for each platform to generate manifests, full.tar.gz,
  delta packages, then uploads installers via SCP, and verifies accessibility.
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
Set-Location $ProjectRoot

# Load state
if ($StateFile -and (Test-Path $StateFile)) { . $StateFile }
$VERSION = if ($PL_VERSION) { $PL_VERSION } else { (Get-Content "$ProjectRoot\package.json" -Raw | ConvertFrom-Json).version }

Write-Host "[deploy] Version: $VERSION | Platform: $Platform"

# Read config
$configFile = Join-Path $PSScriptRoot "config.json"
$CACHE_DIR = "E:\openclawcn\.release-cache"
if (Test-Path $configFile) {
    try {
        $config = Get-Content $configFile -Raw | ConvertFrom-Json
        if ($config.release.cache_dir) { $CACHE_DIR = $config.release.cache_dir }
    } catch { }
}

$ARCHIVE_DIR = if ($PL_ARCHIVE_DIR) { $PL_ARCHIVE_DIR } else { Join-Path $CACHE_DIR "$VERSION\installers" }

# ══════════════════════════════════════════════
# Step 1: Pre-flight checks
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "[deploy] Step 1: Pre-flight checks"

$deployServer = $env:DEPLOY_SERVER
$deployDomain = $env:DEPLOY_DOMAIN
$deployPort = if ($env:DEPLOY_PORT) { $env:DEPLOY_PORT } else { "22" }

if (-not $deployServer) {
    Write-Host "  ERROR: DEPLOY_SERVER env var not set (format: user@host)" -ForegroundColor Red
    exit 1
}
if (-not $deployDomain) {
    Write-Host "  ERROR: DEPLOY_DOMAIN env var not set" -ForegroundColor Red
    exit 1
}

Write-Host "  Server: $deployServer"
Write-Host "  Domain: $deployDomain"

# SSH connectivity test
$sshTest = ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -p $deployPort $deployServer "echo ok" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Cannot SSH to $deployServer" -ForegroundColor Red
    Write-Host "  $sshTest" -ForegroundColor Red
    exit 1
}
Write-Host "  SSH: OK" -ForegroundColor Green

# Verify archive directory
if (-not (Test-Path $ARCHIVE_DIR)) {
    Write-Host "  ERROR: Archive directory not found: $ARCHIVE_DIR" -ForegroundColor Red
    exit 1
}
Write-Host "  Archive: $ARCHIVE_DIR" -ForegroundColor Green

# ══════════════════════════════════════════════
# Step 2: Generate release packages (release-deploy.ts)
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "[deploy] Step 2: Generate release packages"

$deployLog = Join-Path $LogDir "deploy-release.log"
$deployArgs = @(
    "--import", "tsx",
    "scripts/release-deploy.ts",
    "--version", $VERSION,
    "--server", $deployServer,
    "--port", $deployPort,
    "--domain", $deployDomain,
    "--installers", $ARCHIVE_DIR,
    "--cache-dir", $CACHE_DIR
)

# Add platform flag if not "all"
if ($Platform -ne "all") {
    $deployArgs += @("--platform", $Platform)
}

Write-Host "  Running: node $($deployArgs -join ' ')"
Write-Host "  Log: $deployLog"

$deployOutput = & node @deployArgs 2>&1
$deployExit = $LASTEXITCODE
$deployOutput | Out-File $deployLog -Encoding UTF8

# Show key lines from output
$deployOutput | ForEach-Object {
    $line = "$_"
    if ($line -match "(Step|Upload|Success|Error|FAIL|OK|Done|latest\.json|full\.tar|delta)" -and $line.Length -gt 0) {
        $short = if ($line.Length -gt 120) { $line.Substring(0, 120) + "..." } else { $line }
        Write-Host "  $short" -ForegroundColor DarkGray
    }
}

if ($deployExit -ne 0) {
    Write-Host ""
    Write-Host "  ERROR: release-deploy.ts failed (exit $deployExit)" -ForegroundColor Red
    Write-Host "  Last 30 lines:" -ForegroundColor Yellow
    $deployOutput | Select-Object -Last 30 | ForEach-Object { Write-Host "    $_" }
    exit 1
}

Write-Host "  Release packages generated + uploaded" -ForegroundColor Green

# ══════════════════════════════════════════════
# Step 3: Upload installers (if not already handled by release-deploy.ts)
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "[deploy] Step 3: Verify installer uploads"

$remoteInstallerDir = "/data/dl/releases/$VERSION/installers"

# Ensure remote directory exists
ssh -o StrictHostKeyChecking=no -p $deployPort $deployServer "mkdir -p $remoteInstallerDir" 2>&1 | Out-Null

$uploadOk = $true

if ($Platform -in @("all","windows") -and $PL_WIN_EXE -and (Test-Path $PL_WIN_EXE)) {
    $winFileName = [System.IO.Path]::GetFileName($PL_WIN_EXE)
    $localWinSha = if ($PL_WIN_SHA256) { $PL_WIN_SHA256 } else { (Get-FileHash $PL_WIN_EXE -Algorithm SHA256).Hash.ToLower() }

    # Check if already uploaded by release-deploy.ts
    $remoteWinSha = ssh -o StrictHostKeyChecking=no -p $deployPort $deployServer "sha256sum $remoteInstallerDir/$winFileName 2>/dev/null | cut -d' ' -f1" 2>&1
    if ($remoteWinSha -and $remoteWinSha.Trim().ToLower() -eq $localWinSha.ToLower()) {
        Write-Host "  Windows installer: already uploaded + verified" -ForegroundColor Green
    } else {
        Write-Host "  Uploading Windows installer..."
        $winExeUnix = ($PL_WIN_EXE -replace '\\', '/')
        scp -o StrictHostKeyChecking=no -P $deployPort $winExeUnix "${deployServer}:${remoteInstallerDir}/" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ERROR: Failed to upload Windows installer" -ForegroundColor Red
            $uploadOk = $false
        } else {
            # Verify
            $remoteWinSha = ssh -o StrictHostKeyChecking=no -p $deployPort $deployServer "sha256sum $remoteInstallerDir/$winFileName | cut -d' ' -f1" 2>&1
            if ($remoteWinSha.Trim().ToLower() -eq $localWinSha.ToLower()) {
                Write-Host "  Windows installer: uploaded + SHA256 verified" -ForegroundColor Green
            } else {
                Write-Host "  ERROR: Windows installer SHA256 mismatch!" -ForegroundColor Red
                Write-Host "    Local:  $localWinSha" -ForegroundColor Red
                Write-Host "    Remote: $($remoteWinSha.Trim())" -ForegroundColor Red
                $uploadOk = $false
            }
        }
    }
}

if ($Platform -in @("all","macos") -and $PL_MAC_DMG -and (Test-Path $PL_MAC_DMG)) {
    $macFileName = [System.IO.Path]::GetFileName($PL_MAC_DMG)
    $localMacSha = if ($PL_MAC_SHA256) { $PL_MAC_SHA256 } else { (Get-FileHash $PL_MAC_DMG -Algorithm SHA256).Hash.ToLower() }

    $remoteMacSha = ssh -o StrictHostKeyChecking=no -p $deployPort $deployServer "sha256sum $remoteInstallerDir/$macFileName 2>/dev/null | cut -d' ' -f1" 2>&1
    if ($remoteMacSha -and $remoteMacSha.Trim().ToLower() -eq $localMacSha.ToLower()) {
        Write-Host "  macOS installer: already uploaded + verified" -ForegroundColor Green
    } else {
        Write-Host "  Uploading macOS installer..."
        $macDmgUnix = ($PL_MAC_DMG -replace '\\', '/')
        scp -o StrictHostKeyChecking=no -P $deployPort $macDmgUnix "${deployServer}:${remoteInstallerDir}/" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ERROR: Failed to upload macOS installer" -ForegroundColor Red
            $uploadOk = $false
        } else {
            $remoteMacSha = ssh -o StrictHostKeyChecking=no -p $deployPort $deployServer "sha256sum $remoteInstallerDir/$macFileName | cut -d' ' -f1" 2>&1
            if ($remoteMacSha.Trim().ToLower() -eq $localMacSha.ToLower()) {
                Write-Host "  macOS installer: uploaded + SHA256 verified" -ForegroundColor Green
            } else {
                Write-Host "  ERROR: macOS installer SHA256 mismatch!" -ForegroundColor Red
                Write-Host "    Local:  $localMacSha" -ForegroundColor Red
                Write-Host "    Remote: $($remoteMacSha.Trim())" -ForegroundColor Red
                $uploadOk = $false
            }
        }
    }
}

if (-not $uploadOk) {
    Write-Host "  Installer upload verification FAILED" -ForegroundColor Red
    exit 1
}

# ══════════════════════════════════════════════
# Step 4: Verify public accessibility
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "[deploy] Step 4: Verify public accessibility"

$protocol = "https"
$latestUrl = "${protocol}://${deployDomain}/releases/latest.json"
$versionUrl = "${protocol}://${deployDomain}/releases/${VERSION}/manifest.json"

$verifyOk = $true

# latest.json
try {
    $resp = Invoke-WebRequest -Uri $latestUrl -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
    if ($resp.StatusCode -eq 200) {
        $latestData = $resp.Content | ConvertFrom-Json
        if ($latestData.version -eq $VERSION) {
            Write-Host "  latest.json: OK (version=$VERSION)" -ForegroundColor Green
        } else {
            Write-Host "  latest.json: version mismatch (got $($latestData.version), expected $VERSION)" -ForegroundColor Yellow
            # Non-fatal: platform mode may not have merged yet
        }
    } else {
        Write-Host "  latest.json: HTTP $($resp.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  latest.json: not accessible yet (may need server merge)" -ForegroundColor Yellow
    Write-Host "    URL: $latestUrl" -ForegroundColor DarkGray
    # Non-fatal for platform mode
}

# manifest.json
try {
    $resp = Invoke-WebRequest -Uri $versionUrl -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
    if ($resp.StatusCode -eq 200) {
        Write-Host "  manifest.json: OK" -ForegroundColor Green
    } else {
        Write-Host "  manifest.json: HTTP $($resp.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  manifest.json: not accessible" -ForegroundColor Yellow
    Write-Host "    URL: $versionUrl" -ForegroundColor DarkGray
}

# ══════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "════════════════════════════════════════════"
Write-Host "  Deploy Summary"
Write-Host "  Version: $VERSION"
Write-Host "  Server:  $deployServer"
Write-Host "  Domain:  $deployDomain"
Write-Host "  Log:     $deployLog"
Write-Host "════════════════════════════════════════════"

# Write report
$reportFile = Join-Path $LogDir "deploy-report.txt"
@"
ClawdbotCN Pipeline Deploy Report
Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Version: $VERSION
Server: $deployServer
Domain: $deployDomain
"@ | Set-Content $reportFile -Encoding UTF8

# Update state
if ($StateFile) {
    Add-Content $StateFile @"

`$PL_DEPLOY_SERVER = "$deployServer"
`$PL_DEPLOY_DOMAIN = "$deployDomain"
`$PL_DEPLOY_URL = "${protocol}://${deployDomain}/releases/${VERSION}/"
"@
}

Write-Host "[deploy] Done" -ForegroundColor Green
exit 0
