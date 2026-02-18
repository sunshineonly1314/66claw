# Fix ClawdbotCN Gateway Crash (0xC0000005 Access Violation)
# This script diagnoses and fixes common causes of gateway crashes

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " ClawdbotCN Gateway Crash Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$InstallDir = "E:\clawdbuild\新建文件夹 (3)\ClawdbotCN"
$LogDir = Join-Path $InstallDir "logs"

# Step 1: Check if install directory exists
Write-Host "[1/8] Checking install directory..." -ForegroundColor Yellow
if (-not (Test-Path $InstallDir)) {
    Write-Host "  ERROR: Install directory not found: $InstallDir" -ForegroundColor Red
    exit 1
}
Write-Host "  OK: Install directory exists" -ForegroundColor Green
Write-Host ""

# Step 2: Check Node.js
Write-Host "[2/8] Checking Node.js..." -ForegroundColor Yellow
$NodeExe = Join-Path $InstallDir "node\node.exe"
if (-not (Test-Path $NodeExe)) {
    Write-Host "  ERROR: Node.js not found at: $NodeExe" -ForegroundColor Red
    Write-Host "  SOLUTION: Reinstall ClawdbotCN or copy node/ from source" -ForegroundColor Yellow
    exit 1
}

# Test Node.js
try {
    $nodeVersion = & $NodeExe --version 2>&1
    Write-Host "  OK: Node.js version $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js executable is corrupted" -ForegroundColor Red
    Write-Host "  SOLUTION: Reinstall ClawdbotCN" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Step 3: Check entry.js
Write-Host "[3/8] Checking entry.js..." -ForegroundColor Yellow
$EntryJs = Join-Path $InstallDir "dist\entry.js"
if (-not (Test-Path $EntryJs)) {
    Write-Host "  ERROR: entry.js not found at: $EntryJs" -ForegroundColor Red
    Write-Host "  SOLUTION: Run 'pnpm build' and copy dist/ to install dir" -ForegroundColor Yellow
    exit 1
}
$entrySize = (Get-Item $EntryJs).Length
Write-Host "  OK: entry.js exists ($entrySize bytes)" -ForegroundColor Green
Write-Host ""

# Step 4: Test basic Node.js load
Write-Host "[4/8] Testing Node.js can load entry.js..." -ForegroundColor Yellow
$testOutput = & $NodeExe -e "try { require('$($EntryJs.Replace('\','\\'))'); console.log('LOAD_OK'); } catch(e) { console.error('LOAD_ERROR:', e.message); }" 2>&1
if ($testOutput -match "LOAD_OK") {
    Write-Host "  OK: entry.js loads successfully" -ForegroundColor Green
} elseif ($testOutput -match "LOAD_ERROR") {
    Write-Host "  ERROR: entry.js failed to load" -ForegroundColor Red
    Write-Host "  Error: $testOutput" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Common causes:" -ForegroundColor Yellow
    Write-Host "  1. Missing node_modules - run 'pnpm install'" -ForegroundColor Yellow
    Write-Host "  2. Native module incompatibility (better-sqlite3, etc.)" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "  WARNING: Unexpected output: $testOutput" -ForegroundColor Yellow
}
Write-Host ""

# Step 5: Check node_modules
Write-Host "[5/8] Checking node_modules..." -ForegroundColor Yellow
$NodeModules = Join-Path $InstallDir "node_modules"
if (-not (Test-Path $NodeModules)) {
    Write-Host "  ERROR: node_modules not found" -ForegroundColor Red
    Write-Host "  SOLUTION: Copy node_modules from project root to install dir" -ForegroundColor Yellow
    exit 1
}

# Check critical native modules
$criticalModules = @(
    "better-sqlite3\build\Release\better_sqlite3.node",
    "@anthropic-ai\sdk"
)

$missingModules = @()
foreach ($mod in $criticalModules) {
    $modPath = Join-Path $NodeModules $mod
    if (-not (Test-Path $modPath)) {
        $missingModules += $mod
    }
}

if ($missingModules.Count -gt 0) {
    Write-Host "  ERROR: Missing critical modules:" -ForegroundColor Red
    $missingModules | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
    Write-Host "  SOLUTION: Run 'pnpm install' in project root, then copy node_modules" -ForegroundColor Yellow
    exit 1
}
Write-Host "  OK: Critical modules present" -ForegroundColor Green
Write-Host ""

# Step 6: Check gateway-output.log for real error
Write-Host "[6/8] Reading gateway-output.log..." -ForegroundColor Yellow
$OutputLog = Join-Path $LogDir "gateway-output.log"
if (Test-Path $OutputLog) {
    $logContent = Get-Content $OutputLog -Tail 20 -ErrorAction SilentlyContinue
    if ($logContent) {
        Write-Host "  Last 20 lines of gateway-output.log:" -ForegroundColor Cyan
        $logContent | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    } else {
        Write-Host "  WARNING: gateway-output.log is empty" -ForegroundColor Yellow
        Write-Host "  This means Node.js crashed before it could write any output" -ForegroundColor Yellow
    }
} else {
    Write-Host "  WARNING: gateway-output.log not found" -ForegroundColor Yellow
}
Write-Host ""

# Step 7: Test gateway with verbose output
Write-Host "[7/8] Testing gateway startup (10 second test)..." -ForegroundColor Yellow
Write-Host "  This will attempt to start the gateway and capture any errors" -ForegroundColor Gray
Write-Host ""

$TestLog = Join-Path $LogDir "fix-test.log"
$env:CLAWDBOT_STATE_DIR = Join-Path $env:APPDATA "ClawdbotCN"
$env:CLAWDBOT_BUNDLED_PLUGINS_DIR = Join-Path $InstallDir "extensions"
$env:CLAWDBOT_BUNDLED_SKILLS_DIR = Join-Path $InstallDir "skills"
$env:CLAWDBOT_BUNDLED_TOOLS_DIR = Join-Path $InstallDir "tools"
$env:CLAWDBOT_GATEWAY_TOKEN = "clawdbot2026"
$env:CLAWDBOT_REGION = "cn"
$env:PATH = (Join-Path $InstallDir "node") + ";" + (Join-Path $InstallDir "tools") + ";" + $env:PATH

# Kill any existing gateway
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -like "*Gateway*" -or $_.CommandLine -like "*entry.js*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "  Starting gateway..." -ForegroundColor Gray
$gwProc = Start-Process -FilePath $NodeExe `
    -ArgumentList "`"$EntryJs`" gateway run --port 18789 --allow-unconfigured --verbose" `
    -WorkingDirectory $InstallDir `
    -RedirectStandardOutput $TestLog `
    -RedirectStandardError $TestLog `
    -PassThru `
    -WindowStyle Hidden

# Wait up to 10 seconds
$waited = 0
$crashed = $false
while ($waited -lt 10) {
    Start-Sleep -Seconds 1
    $waited++

    if ($gwProc.HasExited) {
        $crashed = $true
        Write-Host "  ERROR: Gateway crashed after $waited seconds" -ForegroundColor Red
        Write-Host "  Exit code: $($gwProc.ExitCode)" -ForegroundColor Red
        break
    }

    # Check if port is listening
    $listening = Get-NetTCPConnection -LocalPort 18789 -ErrorAction SilentlyContinue
    if ($listening) {
        Write-Host "  SUCCESS: Gateway started and listening on port 18789!" -ForegroundColor Green
        $gwProc.Kill()
        break
    }
}

if (-not $crashed -and $waited -eq 10) {
    Write-Host "  WARNING: Gateway didn't crash but also didn't start listening" -ForegroundColor Yellow
    $gwProc.Kill()
}

# Show test log
Write-Host ""
Write-Host "  Gateway test log (fix-test.log):" -ForegroundColor Cyan
if (Test-Path $TestLog) {
    Get-Content $TestLog | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
} else {
    Write-Host "    (no output captured)" -ForegroundColor Gray
}
Write-Host ""

# Step 8: Recommendations
Write-Host "[8/8] Diagnosis Summary" -ForegroundColor Yellow
Write-Host ""

if ($crashed) {
    Write-Host "  DIAGNOSIS: Gateway is crashing during startup" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Recommended fixes (in order):" -ForegroundColor Yellow
    Write-Host "  1. Rebuild the project:" -ForegroundColor Cyan
    Write-Host "     cd d:\codeknowledge\clawdbot-main\clawdbot-main" -ForegroundColor Gray
    Write-Host "     pnpm install" -ForegroundColor Gray
    Write-Host "     pnpm build" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Copy fresh files to install directory:" -ForegroundColor Cyan
    Write-Host "     Copy-Item dist/* '$InstallDir\dist\' -Recurse -Force" -ForegroundColor Gray
    Write-Host "     Copy-Item node_modules/* '$InstallDir\node_modules\' -Recurse -Force" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. If still crashing, rebuild native modules:" -ForegroundColor Cyan
    Write-Host "     cd d:\codeknowledge\clawdbot-main\clawdbot-main" -ForegroundColor Gray
    Write-Host "     pnpm rebuild better-sqlite3" -ForegroundColor Gray
    Write-Host "     Copy rebuilt modules to install dir" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  4. If all else fails, do a complete reinstall:" -ForegroundColor Cyan
    Write-Host "     - Delete '$InstallDir'" -ForegroundColor Gray
    Write-Host "     - Run installer from scripts/windows/ClawdbotCN-Setup.exe" -ForegroundColor Gray
} else {
    Write-Host "  DIAGNOSIS: Gateway appears to be working!" -ForegroundColor Green
    Write-Host "  The original crash may have been caused by:" -ForegroundColor Yellow
    Write-Host "  - Corrupted process state (now cleared)" -ForegroundColor Gray
    Write-Host "  - Port conflict (now resolved)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Try starting ClawdbotCN again." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
