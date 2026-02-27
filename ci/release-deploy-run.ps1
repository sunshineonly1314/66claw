# Quick one-shot release deploy. Reads version from package.json.
# Required env vars: DEPLOY_SERVER, DEPLOY_DOMAIN (see release-deploy-remote.ps1)

$ErrorActionPreference = 'Stop'

if (-not $env:DEPLOY_SERVER -or -not $env:DEPLOY_DOMAIN) {
    Write-Error "DEPLOY_SERVER and DEPLOY_DOMAIN environment variables must be set."
    exit 1
}

$WORKSPACE = if ($env:CICD_WORKSPACE) { $env:CICD_WORKSPACE } else { 'D:\cicd-workspace\openclawcn' }
Set-Location $WORKSPACE

# Dynamic version from package.json
$pkgJson = Get-Content 'package.json' -Raw | ConvertFrom-Json
$VERSION = $pkgJson.version

Write-Host "=== Release Deploy Start ==="
Write-Host "CWD: $(Get-Location)"
Write-Host "Node: $(node --version)"
Write-Host "Version: $VERSION"
Write-Host "Upload: SCP to $env:DEPLOY_SERVER ($env:DEPLOY_DOMAIN)"

node --import tsx scripts/release-deploy.ts --version $VERSION --server $env:DEPLOY_SERVER --domain $env:DEPLOY_DOMAIN --skip-delta 2>&1
$exitCode = $LASTEXITCODE
Write-Host ""
Write-Host "=== Release Deploy Exit: $exitCode ==="
exit $exitCode
