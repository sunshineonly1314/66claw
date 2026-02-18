# Rebuild ClawdbotCN and fix gateway crash
# This script rebuilds the entire project with fresh native modules

param(
    [string]$InstallPath = ""
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Rebuild ClawdbotCN (Fix Gateway Crash)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get project root
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Write-Host "Project root: $ProjectRoot" -ForegroundColor Gray
Write-Host ""

# Step 1: Clean old build
Write-Host "[1/5] Cleaning old build..." -ForegroundColor Yellow
Push-Location $ProjectRoot

$distPath = Join-Path $ProjectRoot "dist"
if (Test-Path $distPath) {
    Remove-Item $distPath -Recurse -Force
    Write-Host "  Removed old dist/" -ForegroundColor Gray
}

Write-Host ""

# Step 2: Rebuild native modules (this fixes Access Violation errors)
Write-Host "[2/5] Rebuilding native modules..." -ForegroundColor Yellow
Write-Host "  This fixes better-sqlite3 and other native dependencies" -ForegroundColor Gray
Write-Host ""

# Remove better-sqlite3 node file to force rebuild
$sqliteNode = Join-Path $ProjectRoot "node_modules\better-sqlite3\build\Release\better_sqlite3.node"
if (Test-Path $sqliteNode) {
    Remove-Item $sqliteNode -Force
    Write-Host "  Removed old better_sqlite3.node" -ForegroundColor Gray
}

# Rebuild
try {
    & pnpm rebuild better-sqlite3 2>&1 | ForEach-Object {
        Write-Host "  $_" -ForegroundColor DarkGray
    }
    Write-Host "  OK: Native modules rebuilt" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Failed to rebuild native modules" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Build TypeScript
Write-Host "[3/5] Building TypeScript..." -ForegroundColor Yellow
try {
    & pnpm build 2>&1 | ForEach-Object {
        if ($_ -match "error|ERROR|✘") {
            Write-Host "  $_" -ForegroundColor Red
        } else {
            Write-Host "  $_" -ForegroundColor DarkGray
        }
    }

    # Verify dist/entry.js exists
    $entryJs = Join-Path $ProjectRoot "dist\entry.js"
    if (-not (Test-Path $entryJs)) {
        Write-Host "  ERROR: Build failed - dist/entry.js not created" -ForegroundColor Red
        exit 1
    }

    $entrySize = [math]::Round((Get-Item $entryJs).Length / 1KB, 1)
    Write-Host "  OK: Built dist/entry.js ($entrySize KB)" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: TypeScript build failed" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    exit 1
}

Pop-Location
Write-Host ""

# Step 4: Test gateway locally
Write-Host "[4/5] Testing gateway locally..." -ForegroundColor Yellow
Write-Host "  Starting gateway for 5 seconds..." -ForegroundColor Gray

Push-Location $ProjectRoot

# Kill any existing gateway
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    try {
        $cmd = $_.CommandLine
        $cmd -like "*entry.js*" -or $cmd -like "*gateway*"
    } catch {
        $false
    }
} | Stop-Process -Force -ErrorAction SilentlyContinue

# Set env vars
$env:CLAWDBOT_STATE_DIR = Join-Path $env:USERPROFILE ".clawdbot-test"
$env:CLAWDBOT_GATEWAY_TOKEN = "clawdbot2026"
$env:CLAWDBOT_REGION = "cn"

# Start gateway
$testLog = Join-Path $ProjectRoot "logs\rebuild-test.log"
New-Item -ItemType Directory -Path (Join-Path $ProjectRoot "logs") -Force | Out-Null

Write-Host "  Starting gateway..." -ForegroundColor Gray
$gwProc = Start-Process -FilePath "node" `
    -ArgumentList "dist\entry.js gateway run --port 18790 --allow-unconfigured" `
    -WorkingDirectory $ProjectRoot `
    -RedirectStandardOutput $testLog `
    -RedirectStandardError $testLog `
    -PassThru `
    -WindowStyle Hidden

# Wait up to 10 seconds
$waited = 0
$success = $false

while ($waited -lt 10) {
    Start-Sleep -Seconds 1
    $waited++

    if ($gwProc.HasExited) {
        Write-Host "  ERROR: Gateway crashed after $waited seconds!" -ForegroundColor Red
        Write-Host "  Exit code: $($gwProc.ExitCode)" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Test log:" -ForegroundColor Cyan
        if (Test-Path $testLog) {
            Get-Content $testLog | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        }
        Write-Host ""
        Write-Host "  The gateway is still crashing. Possible causes:" -ForegroundColor Yellow
        Write-Host "  1. Missing node_modules - run 'pnpm install'" -ForegroundColor Gray
        Write-Host "  2. Incompatible Node.js version - use Node.js 20.x" -ForegroundColor Gray
        Write-Host "  3. Corrupted installation - delete node_modules and reinstall" -ForegroundColor Gray
        Pop-Location
        exit 1
    }

    # Check if port is listening
    $listening = Get-NetTCPConnection -LocalPort 18790 -ErrorAction SilentlyContinue
    if ($listening) {
        Write-Host "  SUCCESS: Gateway started successfully!" -ForegroundColor Green
        $success = $true
        $gwProc.Kill()
        break
    }
}

if (-not $success -and $waited -eq 10) {
    Write-Host "  WARNING: Gateway didn't crash but also didn't start listening" -ForegroundColor Yellow
    Write-Host "  Check test log for details: $testLog" -ForegroundColor Gray
    $gwProc.Kill()
}

Pop-Location
Write-Host ""

# Step 5: Copy to install directory (if specified)
if ($InstallPath -and (Test-Path $InstallPath)) {
    Write-Host "[5/5] Copying to install directory..." -ForegroundColor Yellow
    Write-Host "  Target: $InstallPath" -ForegroundColor Gray

    # Copy dist
    Write-Host "  Copying dist/..." -ForegroundColor Gray
    $targetDist = Join-Path $InstallPath "dist"
    if (Test-Path $targetDist) {
        Remove-Item $targetDist -Recurse -Force
    }
    Copy-Item (Join-Path $ProjectRoot "dist") $targetDist -Recurse -Force

    # Copy node_modules (only essential production modules to save space)
    Write-Host "  Copying node_modules/..." -ForegroundColor Gray
    Write-Host "    (This may take a few minutes)" -ForegroundColor DarkGray
    $targetModules = Join-Path $InstallPath "node_modules"

    # Key native modules that must be fresh
    $criticalModules = @(
        "better-sqlite3",
        "@anthropic-ai/sdk",
        "@modelcontextprotocol/sdk"
    )

    foreach ($mod in $criticalModules) {
        $src = Join-Path $ProjectRoot "node_modules\$mod"
        $dst = Join-Path $targetModules $mod
        if (Test-Path $src) {
            Write-Host "    Copying $mod..." -ForegroundColor DarkGray
            if (Test-Path $dst) {
                Remove-Item $dst -Recurse -Force
            }
            Copy-Item $src $dst -Recurse -Force
        }
    }

    Write-Host "  OK: Files copied to install directory" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Try running ClawdbotCN now." -ForegroundColor Cyan
} else {
    Write-Host "[5/5] Skipping install directory copy (not specified)" -ForegroundColor Yellow
    Write-Host "  To copy to install directory, run:" -ForegroundColor Gray
    Write-Host "  .\rebuild-and-fix.ps1 -InstallPath 'E:\clawdbuild\YourInstallDir\ClawdbotCN'" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Rebuild Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

if ($success) {
    Write-Host "Gateway is working in the project directory." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Test locally: cd scripts/windows && .\dev-gateway.ps1" -ForegroundColor Gray
    Write-Host "2. Build installer: .\build-native-app.ps1 (if using Tauri)" -ForegroundColor Gray
    Write-Host "   OR: iscc setup.iss (if using C# service)" -ForegroundColor Gray
} else {
    Write-Host "WARNING: Gateway test was inconclusive" -ForegroundColor Yellow
    Write-Host "Check logs\rebuild-test.log for details" -ForegroundColor Gray
}
Write-Host ""
