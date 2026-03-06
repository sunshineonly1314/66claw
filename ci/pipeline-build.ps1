<#
.SYNOPSIS
  Pipeline Phase 2: Environment check + cleanup + dual-platform parallel build
.DESCRIPTION
  Pre-checks build environment, cleans old artifacts, launches Windows + macOS builds
  in parallel, monitors progress, and pulls artifacts.
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

Write-Host "[build] Version: $VERSION | Platform: $Platform"

# ══════════════════════════════════════════════
# Step 1: Environment pre-check
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "[build] Step 1: Environment pre-check"

$envOk = $true

# Windows local checks
$nodeVer = (& node -v 2>&1).Trim()
$pnpmVer = (& pnpm -v 2>&1).Trim()
Write-Host "  Windows: node=$nodeVer pnpm=$pnpmVer"
if ($nodeVer -notmatch "^v22\.") {
    Write-Host "  ERROR: Node must be v22.x (got $nodeVer)" -ForegroundColor Red
    $envOk = $false
}

$cargoVer = & cargo -V 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: cargo not found" -ForegroundColor Red
    $envOk = $false
} else {
    Write-Host "  Windows: $cargoVer"
}

# macOS checks (SSH to 107)
if ($Platform -in @("all","macos")) {
    Write-Host "  Checking macOS (192.168.0.107)..."
    $macNode = & ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no kevinsun@192.168.0.107 "node -v" 2>&1
    $macSSHExit = $LASTEXITCODE
    if ($macSSHExit -ne 0) {
        Write-Host "  ERROR: Cannot SSH to macOS builder (192.168.0.107)" -ForegroundColor Red
        $envOk = $false
    } else {
        $macPnpm = & ssh -o StrictHostKeyChecking=no kevinsun@192.168.0.107 "pnpm -v" 2>&1
        Write-Host "  macOS:   node=$macNode pnpm=$macPnpm"
        if ($macNode -notmatch "^v22\.") {
            Write-Host "  ERROR: macOS Node must be v22.x (got $macNode)" -ForegroundColor Red
            $envOk = $false
        }
    }
}

if (-not $envOk) {
    Write-Host "  Environment pre-check FAILED" -ForegroundColor Red
    exit 1
}
Write-Host "  Environment OK" -ForegroundColor Green

# ══════════════════════════════════════════════
# Step 2: Cleanup old artifacts
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "[build] Step 2: Cleanup old artifacts"

# Local artifacts
$artifactDirs = @("$PSScriptRoot\artifacts\windows", "$PSScriptRoot\artifacts\macos")
foreach ($dir in $artifactDirs) {
    if (Test-Path $dir) {
        $oldFiles = Get-ChildItem $dir -File | Sort-Object LastWriteTime -Descending | Select-Object -Skip 2
        foreach ($f in $oldFiles) {
            Remove-Item $f.FullName -Force -ErrorAction SilentlyContinue
            Write-Host "  Cleaned: $($f.Name)"
        }
    }
}

# Old logs (> 7 days)
$logRoot = Join-Path $PSScriptRoot "logs"
if (Test-Path $logRoot) {
    $cutoff = (Get-Date).AddDays(-7)
    Get-ChildItem $logRoot -Directory -Filter "pipeline-*" |
        Where-Object { $_.LastWriteTime -lt $cutoff } |
        ForEach-Object {
            Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "  Cleaned log: $($_.Name)"
        }
}

# Remote cleanup (non-fatal)
if ($Platform -in @("all","windows")) {
    Write-Host "  Cleaning remote Windows builder (102)..."
    ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no sunbin@192.168.0.102 `
        "powershell -Command `"Get-ChildItem 'E:\clawdbuild\ClawdbotCN-Setup-*.exe' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 2 | Remove-Item -Force`"" 2>&1 | Out-Null
}
if ($Platform -in @("all","macos")) {
    Write-Host "  Cleaning remote macOS builder (107)..."
    $macOutput = (& node -p "require('./ci/config.json').builders.macos.output" 2>&1).Trim()
    if ($macOutput) {
        ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no kevinsun@192.168.0.107 `
            "ls -t $macOutput/*.dmg 2>/dev/null | tail -n +3 | xargs rm -f 2>/dev/null" 2>&1 | Out-Null
    }
}
Write-Host "  Cleanup done." -ForegroundColor Green

# ══════════════════════════════════════════════
# Step 3: Launch parallel builds
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "[build] Step 3: Launching builds (platform=$Platform)..."

$winLog = Join-Path $LogDir "build-win.log"
$macLog = Join-Path $LogDir "build-mac.log"
$winJob = $null
$macJob = $null

if ($Platform -in @("all","windows")) {
    Write-Host "  Starting Windows build..."
    $winJob = Start-Job -ScriptBlock {
        param($ScriptDir, $Version, $Log)
        Set-Location (Split-Path $ScriptDir -Parent)
        & bash "$ScriptDir/build-windows.sh" $Version standard --skip-deploy 2>&1 |
            Out-File -FilePath $Log -Encoding UTF8
    } -ArgumentList $PSScriptRoot, $VERSION, $winLog
    Write-Host "  Windows build started (Job $($winJob.Id))" -ForegroundColor Cyan
}

if ($Platform -in @("all","macos")) {
    Write-Host "  Starting macOS build..."
    $macJob = Start-Job -ScriptBlock {
        param($ScriptDir, $Version, $Log)
        Set-Location (Split-Path $ScriptDir -Parent)
        & bash "$ScriptDir/build-macos.sh" --version $Version --arch universal --skip-deploy 2>&1 |
            Out-File -FilePath $Log -Encoding UTF8
    } -ArgumentList $PSScriptRoot, $VERSION, $macLog
    Write-Host "  macOS build started (Job $($macJob.Id))" -ForegroundColor Cyan
}

# ══════════════════════════════════════════════
# Step 4: Monitor progress
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "[build] Step 4: Monitoring builds..."

$buildStart = Get-Date
$monitorKeywords = @("Step", "Phase", "\[", "ERROR", "SUCCESS", "FATAL", "FAIL", "BUILD")
$lastWinLine = 0
$lastMacLine = 0

while ($true) {
    $allDone = $true

    if ($winJob -and $winJob.State -eq "Running") { $allDone = $false }
    if ($macJob -and $macJob.State -eq "Running") { $allDone = $false }

    if ($allDone) { break }

    Start-Sleep -Seconds 30
    $elapsed = [int](New-TimeSpan -Start $buildStart -End (Get-Date)).TotalMinutes

    # Show progress from logs
    foreach ($info in @(
        @{ log = $winLog; label = "WIN"; last = [ref]$lastWinLine },
        @{ log = $macLog; label = "MAC"; last = [ref]$lastMacLine }
    )) {
        if (Test-Path $info.log) {
            $lines = Get-Content $info.log -Encoding UTF8 -ErrorAction SilentlyContinue
            if ($lines -and $lines.Count -gt $info.last.Value) {
                $newLines = $lines[($info.last.Value)..($lines.Count - 1)]
                $info.last.Value = $lines.Count
                foreach ($line in $newLines) {
                    foreach ($kw in $monitorKeywords) {
                        if ($line -match $kw) {
                            $short = if ($line.Length -gt 100) { $line.Substring(0, 100) + "..." } else { $line }
                            Write-Host "  [${elapsed}m] [$($info.label)] $short" -ForegroundColor DarkGray
                            break
                        }
                    }
                }
            }
        }
    }
}

# ══════════════════════════════════════════════
# Step 5: Collect results
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "[build] Step 5: Build results"

$buildOk = $true

if ($winJob) {
    $winResult = Receive-Job -Job $winJob -Wait -ErrorAction SilentlyContinue
    $winExit = if ($winJob.State -eq "Failed") { 1 } else { 0 }
    # Check log for exit code
    if (Test-Path $winLog) {
        $winTail = Get-Content $winLog -Tail 5 -ErrorAction SilentlyContinue
        if ($winTail -match "FAILED|ERROR|exit code: [1-9]") { $winExit = 1 }
    }
    if ($winExit -eq 0) {
        Write-Host "  Windows: OK" -ForegroundColor Green
    } else {
        Write-Host "  Windows: FAILED" -ForegroundColor Red
        if (Test-Path $winLog) {
            Write-Host "  Last 30 lines:" -ForegroundColor Yellow
            Get-Content $winLog -Tail 30 | ForEach-Object { Write-Host "    $_" }
        }
        $buildOk = $false
    }
    Remove-Job $winJob -Force -ErrorAction SilentlyContinue
}

if ($macJob) {
    $macResult = Receive-Job -Job $macJob -Wait -ErrorAction SilentlyContinue
    $macExit = if ($macJob.State -eq "Failed") { 1 } else { 0 }
    if (Test-Path $macLog) {
        $macTail = Get-Content $macLog -Tail 5 -ErrorAction SilentlyContinue
        if ($macTail -match "FAILED|ERROR|exit code: [1-9]") { $macExit = 1 }
    }
    if ($macExit -eq 0) {
        Write-Host "  macOS: OK" -ForegroundColor Green
    } else {
        Write-Host "  macOS: FAILED" -ForegroundColor Red
        if (Test-Path $macLog) {
            Write-Host "  Last 30 lines:" -ForegroundColor Yellow
            Get-Content $macLog -Tail 30 | ForEach-Object { Write-Host "    $_" }
        }
        $buildOk = $false
    }
    Remove-Job $macJob -Force -ErrorAction SilentlyContinue
}

if (-not $buildOk) {
    Write-Host "  Build failed!" -ForegroundColor Red
    exit 1
}

# ══════════════════════════════════════════════
# Step 6: Verify and record artifacts
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "[build] Step 6: Verify artifacts"

$winExe = ""
$macDmg = ""

if ($Platform -in @("all","windows")) {
    $artifactDir = Join-Path $PSScriptRoot "artifacts\windows"
    New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
    $winExe = Get-ChildItem "$artifactDir\ClawdbotCN*Setup*.exe" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $winExe) {
        # Try to pull from remote builder
        Write-Host "  Pulling Windows artifact from remote..."
        scp -o StrictHostKeyChecking=no "sunbin@192.168.0.102:E:/clawdbuild/ClawdbotCN-Setup-*.exe" "$artifactDir/" 2>&1
        $winExe = Get-ChildItem "$artifactDir\ClawdbotCN*Setup*.exe" -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
    }
    if ($winExe -and $winExe.Length -gt 100MB) {
        $winSha = (Get-FileHash $winExe.FullName -Algorithm SHA256).Hash
        Write-Host "  Windows: $($winExe.Name) ($([math]::Round($winExe.Length/1MB))MB)" -ForegroundColor Green
        $winExe = $winExe.FullName
    } else {
        Write-Host "  ERROR: Windows artifact missing or too small" -ForegroundColor Red
        exit 1
    }
}

if ($Platform -in @("all","macos")) {
    $artifactDir = Join-Path $PSScriptRoot "artifacts\macos"
    New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
    $macDmg = Get-ChildItem "$artifactDir\ClawdbotCN*.dmg" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($macDmg -and $macDmg.Length -gt 200MB) {
        $macSha = (Get-FileHash $macDmg.FullName -Algorithm SHA256).Hash
        Write-Host "  macOS: $($macDmg.Name) ($([math]::Round($macDmg.Length/1MB))MB)" -ForegroundColor Green
        $macDmg = $macDmg.FullName
    } else {
        Write-Host "  ERROR: macOS artifact missing or too small" -ForegroundColor Red
        exit 1
    }
}

# Write state
if ($StateFile) {
    $stateLines = @()
    if ($winExe) {
        $stateLines += "`$PL_WIN_EXE = `"$winExe`""
        $stateLines += "`$PL_WIN_SHA256 = `"$winSha`""
    }
    if ($macDmg) {
        $stateLines += "`$PL_MAC_DMG = `"$macDmg`""
        $stateLines += "`$PL_MAC_SHA256 = `"$macSha`""
    }
    Add-Content $StateFile ("`n" + ($stateLines -join "`n"))
}

$buildDuration = [int](New-TimeSpan -Start $buildStart -End (Get-Date)).TotalMinutes
Write-Host ""
Write-Host "[build] Done (${buildDuration} minutes)" -ForegroundColor Green
exit 0
