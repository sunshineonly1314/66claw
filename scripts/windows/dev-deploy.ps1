# ============================================================================
# ClawdBot Dev Deploy Script
# Build, deploy to real install dir, and restart gateway
# Usage: powershell.exe -File scripts/windows/dev-deploy.ps1
# ============================================================================
param(
    [switch]$SkipBuild,
    [switch]$SkipRestart,
    [string[]]$Only  # Only deploy specific files, e.g. "wechat-send.js","desktop-control.js"
)

$ErrorActionPreference = 'Stop'
$srcBase = 'D:\codeknowledge\clawdbot-main\clawdbot-main'

# --- Step 1: Find real install directory ---
Write-Host "[1/4] Finding install directory..." -ForegroundColor Cyan
$realDir = Get-ChildItem 'E:\clawdbuild' -Filter 'ClawdbotCN' -Recurse -Directory -Depth 2 -ErrorAction SilentlyContinue | Where-Object {
    Test-Path (Join-Path $_.FullName 'package.json')
} | Select-Object -First 1

if (-not $realDir) {
    Write-Host "ERROR: Could not find ClawdbotCN install directory" -ForegroundColor Red
    exit 1
}
$installDir = $realDir.FullName
Write-Host "  Install dir: $installDir" -ForegroundColor Green

# --- Step 2: Build ---
if (-not $SkipBuild) {
    Write-Host "[2/4] Building..." -ForegroundColor Cyan
    Push-Location $srcBase
    try {
        & npm run build 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Build failed!" -ForegroundColor Red
            exit 1
        }
        Write-Host "  Build OK" -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[2/4] Skipping build" -ForegroundColor Yellow
}

# --- Step 3: Deploy files ---
Write-Host "[3/4] Deploying files..." -ForegroundColor Cyan

$allFiles = @(
    @{ Src = 'dist\agents\tools\desktop-control.js'; Label = 'desktop-control.js' },
    @{ Src = 'dist\agents\tools\wechat-send.js'; Label = 'wechat-send.js' },
    @{ Src = 'dist\agents\tools\wechat-check.js'; Label = 'wechat-check.js' },
    @{ Src = 'dist\agents\clawdbot-tools.js'; Label = 'clawdbot-tools.js' },
    @{ Src = 'dist\agents\system-prompt.js'; Label = 'system-prompt.js' },
    @{ Src = 'skills\wechat-desktop\SKILL.md'; Label = 'wechat-desktop-SKILL.md' },
    @{ Src = 'skills\desktop-control\SKILL.md'; Label = 'desktop-control-SKILL.md' }
)

$deployed = 0
foreach ($f in $allFiles) {
    # If -Only is specified, skip files not in the list
    if ($Only -and $Only.Count -gt 0) {
        $match = $false
        foreach ($o in $Only) {
            if ($f.Label -like "*$o*" -or $f.Src -like "*$o*") { $match = $true; break }
        }
        if (-not $match) { continue }
    }

    $srcPath = Join-Path $srcBase $f.Src
    $dstPath = Join-Path $installDir $f.Src  # Same relative path

    if (-not (Test-Path $srcPath)) {
        Write-Host "  SKIP: $($f.Label) (not found)" -ForegroundColor Yellow
        continue
    }

    $dstDir = Split-Path $dstPath -Parent
    if (-not (Test-Path $dstDir)) {
        New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
    }

    Copy-Item -Path $srcPath -Destination $dstPath -Force
    $size = (Get-Item $dstPath).Length
    Write-Host "  OK: $($f.Label) ($size bytes)" -ForegroundColor Green
    $deployed++
}
Write-Host "  Deployed $deployed files" -ForegroundColor Green

# --- Step 4: Restart ---
if (-not $SkipRestart) {
    Write-Host "[4/4] Restarting clawdbot..." -ForegroundColor Cyan

    # Kill existing process via WMI
    $conn = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 18789 }
    if ($conn) {
        $targetPid = $conn[0].OwningProcess
        Write-Host "  Killing PID $targetPid..." -ForegroundColor Yellow
        $proc = Get-WmiObject Win32_Process -Filter "ProcessId=$targetPid" -ErrorAction SilentlyContinue
        if ($proc) {
            $proc.Terminate() | Out-Null
        }
        Start-Sleep -Seconds 2

        # Also kill ClawdbotService.exe if it's parent
        $svcProcs = Get-WmiObject Win32_Process -Filter "Name='ClawdbotService.exe'" -ErrorAction SilentlyContinue
        foreach ($sp in $svcProcs) {
            $sp.Terminate() | Out-Null
        }
        Start-Sleep -Seconds 1
    }

    # Start ClawdbotService.exe
    $svcExe = Join-Path $installDir 'ClawdbotService.exe'
    if (Test-Path $svcExe) {
        Start-Process -FilePath $svcExe -WorkingDirectory $installDir -WindowStyle Normal
        Write-Host "  Started ClawdbotService.exe" -ForegroundColor Green

        # Wait for port 18789
        for ($i = 0; $i -lt 20; $i++) {
            Start-Sleep -Seconds 2
            $newConn = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 18789 }
            if ($newConn) {
                Write-Host "  Gateway UP! PID=$($newConn[0].OwningProcess) on port 18789" -ForegroundColor Green
                Write-Host ""
                Write-Host "=== Deploy + Restart Complete ===" -ForegroundColor Green
                exit 0
            }
        }
        Write-Host "  WARNING: Timeout waiting for gateway" -ForegroundColor Yellow
    } else {
        Write-Host "  ERROR: ClawdbotService.exe not found at $svcExe" -ForegroundColor Red
    }
} else {
    Write-Host "[4/4] Skipping restart" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Deploy Complete ===" -ForegroundColor Green
