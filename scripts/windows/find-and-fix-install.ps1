# Find ClawdbotCN install and fix gateway crash
# This script automatically finds the install directory and fixes it

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Find & Fix ClawdbotCN Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Find install directory
Write-Host "[1/3] Finding ClawdbotCN installation..." -ForegroundColor Yellow

$searchPaths = @(
    "E:\clawdbuild",
    "C:\Program Files\ClawdbotCN",
    "C:\Program Files (x86)\ClawdbotCN",
    "$env:LOCALAPPDATA\ClawdbotCN"
)

$installDir = $null

foreach ($basePath in $searchPaths) {
    if (-not (Test-Path $basePath)) { continue }

    Write-Host "  Searching in $basePath..." -ForegroundColor Gray

    # Look for ClawdbotCN directory
    Get-ChildItem $basePath -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $candidateDir = $_.FullName
        $hasNode = Test-Path (Join-Path $candidateDir "node\node.exe")
        $hasDist = Test-Path (Join-Path $candidateDir "dist\entry.js")
        $hasLogs = Test-Path (Join-Path $candidateDir "logs")

        if ($hasNode -and $hasDist -and $hasLogs) {
            $installDir = $candidateDir
            Write-Host "  FOUND: $installDir" -ForegroundColor Green
        }
    }

    if ($installDir) { break }
}

if (-not $installDir) {
    Write-Host "  ERROR: ClawdbotCN installation not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Searched in:" -ForegroundColor Yellow
    $searchPaths | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    Write-Host ""
    Write-Host "  Please specify the install directory manually:" -ForegroundColor Cyan
    Write-Host "  .\rebuild-and-fix.ps1 -InstallPath 'your\install\path'" -ForegroundColor Gray
    exit 1
}

Write-Host ""

# Step 2: Check current state
Write-Host "[2/3] Checking installation state..." -ForegroundColor Yellow

$nodeExe = Join-Path $installDir "node\node.exe"
$entryJs = Join-Path $installDir "dist\entry.js"
$outputLog = Join-Path $installDir "logs\gateway-output.log"

Write-Host "  Install directory: $installDir" -ForegroundColor Gray
Write-Host "  Node.js: $(if (Test-Path $nodeExe) {'OK'} else {'MISSING'})" -ForegroundColor $(if (Test-Path $nodeExe) {'Green'} else {'Red'})
Write-Host "  entry.js: $(if (Test-Path $entryJs) {'OK'} else {'MISSING'})" -ForegroundColor $(if (Test-Path $entryJs) {'Green'} else {'Red'})

# Check gateway output log
if (Test-Path $outputLog) {
    Write-Host ""
    Write-Host "  Last gateway output:" -ForegroundColor Cyan
    Get-Content $outputLog -Tail 10 -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "    $_" -ForegroundColor Gray
    }
}

Write-Host ""

# Step 3: Ask user what to do
Write-Host "[3/3] Fix options:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  The gateway is crashing with Access Violation (0xC0000005)" -ForegroundColor Red
Write-Host "  This is usually caused by corrupted native modules." -ForegroundColor Yellow
Write-Host ""
Write-Host "  What would you like to do?" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [1] Quick fix - Rebuild project and copy files to install dir" -ForegroundColor Green
Write-Host "      (Recommended - fixes native module issues)" -ForegroundColor Gray
Write-Host ""
Write-Host "  [2] Test gateway locally first" -ForegroundColor Yellow
Write-Host "      (Rebuild project and test, don't copy yet)" -ForegroundColor Gray
Write-Host ""
Write-Host "  [3] Just show me the install directory path" -ForegroundColor Cyan
Write-Host "      (I'll fix it manually)" -ForegroundColor Gray
Write-Host ""
Write-Host "  [Q] Quit" -ForegroundColor Gray
Write-Host ""

$choice = Read-Host "Enter your choice (1/2/3/Q)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Rebuilding and copying to install directory..." -ForegroundColor Cyan
        $scriptPath = Join-Path $PSScriptRoot "rebuild-and-fix.ps1"
        & $scriptPath -InstallPath $installDir
    }
    "2" {
        Write-Host ""
        Write-Host "Rebuilding project (test only)..." -ForegroundColor Cyan
        $scriptPath = Join-Path $PSScriptRoot "rebuild-and-fix.ps1"
        & $scriptPath
    }
    "3" {
        Write-Host ""
        Write-Host "Install directory:" -ForegroundColor Cyan
        Write-Host "  $installDir" -ForegroundColor White
        Write-Host ""
        Write-Host "To fix manually:" -ForegroundColor Yellow
        Write-Host "  1. cd d:\codeknowledge\clawdbot-main\clawdbot-main" -ForegroundColor Gray
        Write-Host "  2. pnpm rebuild better-sqlite3" -ForegroundColor Gray
        Write-Host "  3. pnpm build" -ForegroundColor Gray
        Write-Host "  4. Copy dist/* to '$installDir\dist\'" -ForegroundColor Gray
        Write-Host "  5. Copy node_modules\better-sqlite3 to '$installDir\node_modules\better-sqlite3\'" -ForegroundColor Gray
        Write-Host ""
    }
    default {
        Write-Host ""
        Write-Host "Exiting..." -ForegroundColor Gray
    }
}

Write-Host ""
