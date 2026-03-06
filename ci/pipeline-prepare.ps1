<#
.SYNOPSIS
  Pipeline Phase 1: Git commit + push + version bump
.DESCRIPTION
  Ensures all local changes are committed, pushed to gitee, and version is consistent.
  Lightweight phase — should complete in < 1 minute.
#>
param(
    [string]$StateFile,
    [string]$LogDir,
    [string]$Platform = "all",
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not $ProjectRoot) { $ProjectRoot = (Resolve-Path "$PSScriptRoot\..").Path }
Set-Location $ProjectRoot

Write-Host "[prepare] Working directory: $ProjectRoot"

# ══════════════════════════════════════════════
# Step 1: Git commit + push
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "[prepare] Step 1: Git commit + push"

# Stage changes (exclude sensitive/temp files)
$excludePatterns = @(
    ".env", ".env.*", "credentials*", "*.stackdump",
    "build/", "du.exe.stackdump", "*.tar.gz"
)
$gitStatus = & git status --porcelain 2>&1
$hasChanges = $false
if ($gitStatus) {
    foreach ($line in $gitStatus) {
        $file = ($line -replace '^\s*\S+\s+', '').Trim('"')
        $skip = $false
        foreach ($pat in $excludePatterns) {
            if ($file -like $pat) { $skip = $true; break }
        }
        if (-not $skip -and $file) {
            & git add $file 2>&1 | Out-Null
            $hasChanges = $true
        }
    }
}

if ($hasChanges) {
    $staged = & git diff --cached --stat 2>&1
    if ($staged) {
        Write-Host "  Staged changes:"
        $staged | ForEach-Object { Write-Host "    $_" }

        & git commit -m "[ci] auto-commit before build" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  WARNING: git commit failed (may be nothing to commit)" -ForegroundColor Yellow
        } else {
            Write-Host "  Committed." -ForegroundColor Green
        }
    } else {
        Write-Host "  No staged changes after filtering." -ForegroundColor DarkGray
    }
} else {
    Write-Host "  No changes to commit." -ForegroundColor DarkGray
}

# Push to gitee
Write-Host "  Pushing to gitee..."
$pushResult = & git push gitee master 2>&1
$pushExit = $LASTEXITCODE
if ($pushExit -ne 0) {
    # Try with PAT URL if gitee remote fails
    if ($env:GITEE_PAT) {
        Write-Host "  Retrying push with PAT..." -ForegroundColor Yellow
        & git push "https://sunshine1314:$($env:GITEE_PAT)@gitee.com/sunshine1314/openclawcn.git" master 2>&1
        $pushExit = $LASTEXITCODE
    }
    if ($pushExit -ne 0) {
        Write-Host "  ERROR: git push failed" -ForegroundColor Red
        $pushResult | ForEach-Object { Write-Host "    $_" }
        exit 1
    }
}
Write-Host "  Push OK." -ForegroundColor Green

# ══════════════════════════════════════════════
# Step 2: Version consistency check + bump
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "[prepare] Step 2: Version check + bump"

$pkgJson = Get-Content "$ProjectRoot\package.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$currentVersion = $pkgJson.version
Write-Host "  Current version: $currentVersion"

# Check consistency across 3 files
$desktopPkg = Get-Content "$ProjectRoot\apps\desktop\package.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$tauriConf = Get-Content "$ProjectRoot\apps\desktop\src-tauri\tauri.conf.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$desktopVersion = $desktopPkg.version
$tauriVersion = $tauriConf.version

$consistent = ($currentVersion -eq $desktopVersion) -and ($currentVersion -eq $tauriVersion)

if (-not $consistent) {
    Write-Host "  Version mismatch detected!" -ForegroundColor Yellow
    Write-Host "    package.json:         $currentVersion"
    Write-Host "    desktop/package.json: $desktopVersion"
    Write-Host "    tauri.conf.json:      $tauriVersion"
    Write-Host "  Forcing sync with version-bump.ts set $currentVersion..."
    & pnpm tsx scripts/version-bump.ts set $currentVersion 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: version-bump.ts failed" -ForegroundColor Red
        exit 1
    }
}

# Patch bump for new build
Write-Host "  Bumping patch version..."
& pnpm tsx scripts/version-bump.ts patch 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: version-bump.ts patch failed" -ForegroundColor Red
    exit 1
}

# Read new version
$pkgJson = Get-Content "$ProjectRoot\package.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$newVersion = $pkgJson.version
Write-Host "  New version: $newVersion" -ForegroundColor Green

# Commit + push version bump
& git add package.json apps/desktop/package.json apps/desktop/src-tauri/tauri.conf.json 2>&1
& git commit -m "[ci] bump version to $newVersion" 2>&1
& git push gitee master 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  WARNING: push version bump failed (non-fatal)" -ForegroundColor Yellow
}

# ══════════════════════════════════════════════
# Step 3: Write state
# ══════════════════════════════════════════════
$gitCommit = (& git rev-parse --short HEAD 2>&1).Trim()

if ($StateFile) {
    Add-Content $StateFile @"

`$PL_VERSION = "$newVersion"
`$PL_GIT_COMMIT = "$gitCommit"
"@
}

Write-Host ""
Write-Host "[prepare] Done: v$newVersion ($gitCommit)" -ForegroundColor Green
exit 0
