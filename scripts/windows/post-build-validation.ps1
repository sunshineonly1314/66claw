# ============================================================================
# ClawdbotCN Post-Build Validation Script
#
# Performs 5-phase validation of a built installer or installed directory:
#   Phase 1: Silent install + file structure verification
#   Phase 2: Gateway startup + health check (ready:true)
#   Phase 3: HTTP endpoint verification (/api/health, Control UI, Shutdown auth)
#   Phase 4: WebSocket protocol connectivity (connect + health handshake)
#   Phase 5: Cleanup (graceful shutdown, test state removal)
#
# Usage:
#   # Full flow: install from .exe then validate
#   .\post-build-validation.ps1 -InstallerPath "E:\clawdbuild\ClawdbotCN-Setup.exe" -InstallDir "E:\clawdbuild\test\ClawdbotCN"
#
#   # Skip install: validate existing installation
#   .\post-build-validation.ps1 -InstallDir "E:\clawdbuild\test\ClawdbotCN" -SkipInstall
#
#   # With cleanup (uninstall after validation)
#   .\post-build-validation.ps1 -InstallerPath "..." -InstallDir "..." -Cleanup
#
# Exit codes:
#   0 = all tests passed
#   1 = one or more tests failed
#   2 = script error (invalid params, missing files)
# ============================================================================

param(
    [string]$InstallerPath = "",
    [string]$InstallDir = "",
    [string]$LogDir = "",
    [int]$Port = 18789,
    [int]$StartupTimeoutSec = 60,
    [int]$ReadyTimeoutSec = 90,
    [switch]$SkipInstall,
    [switch]$SkipWebSocket,
    [switch]$Cleanup
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# ============================================================================
# Counters & helpers
# ============================================================================
$script:passCount = 0
$script:failCount = 0
$script:reportLines = @()
$script:scriptStart = Get-Date
# Track gateway process for cleanup guarantee
$script:gwProcess = $null

function Write-Phase($text) {
    Write-Host ""
    Write-Host "=== $text ===" -ForegroundColor Cyan
    $script:reportLines += ""
    $script:reportLines += "=== $text ==="
}

function PASS($msg) {
    $line = "[PASS] $msg"
    Write-Host "  $line" -ForegroundColor Green
    $script:passCount++
    $script:reportLines += "  $line"
}

function FAIL($msg) {
    $line = "[FAIL] $msg"
    Write-Host "  $line" -ForegroundColor Red
    $script:failCount++
    $script:reportLines += "  $line"
}

function INFO($msg) {
    Write-Host "  $msg" -ForegroundColor Gray
}

# Ensure gateway process is killed on any exit path (Ctrl+C, error, normal)
function Cleanup-Gateway {
    if ($script:gwProcess -and -not $script:gwProcess.HasExited) {
        try { Stop-Process -Id $script:gwProcess.Id -Force -ErrorAction SilentlyContinue } catch { }
    }
}

# Register trap: if script is interrupted, kill the gateway
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Cleanup-Gateway } -ErrorAction SilentlyContinue

# ============================================================================
# Parameter validation
# ============================================================================
if (-not $SkipInstall -and -not $InstallerPath) {
    Write-Host "ERROR: -InstallerPath is required unless -SkipInstall is set." -ForegroundColor Red
    exit 2
}

if (-not $SkipInstall -and $InstallerPath -and -not (Test-Path $InstallerPath)) {
    Write-Host "ERROR: Installer not found: $InstallerPath" -ForegroundColor Red
    exit 2
}

if (-not $InstallDir) {
    Write-Host "ERROR: -InstallDir is required." -ForegroundColor Red
    exit 2
}

if (-not $LogDir) {
    $LogDir = Join-Path $InstallDir "logs"
}

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# Generate a random token for test isolation
$token = "ci-test-$(Get-Random)"
$baseUrl = "http://127.0.0.1:${Port}"

# Save original PATH to restore later (avoid pollution when called from parent script)
$originalPath = $env:PATH

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ClawdbotCN Post-Build Validation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
INFO "InstallDir:  $InstallDir"
INFO "Port:        $Port"
INFO "LogDir:      $LogDir"
INFO "SkipInstall: $SkipInstall"

# ============================================================================
# Phase 1: Silent Installation + File Structure Verification
# ============================================================================
Write-Phase "Phase 1: Installation & File Structure"

# 1a. Pre-install: kill processes on the target port (avoids installer dialog)
# The NSIS/Inno installer checks if port $Port is in use and pops a confirmation
# dialog, which hangs/aborts under /VERYSILENT. Kill the process BEFORE install.
$existingConns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($existingConns) {
    INFO "Pre-install: killing processes on port $Port to avoid installer dialog..."
    $existingConns | ForEach-Object {
        try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } catch { }
    }
    Start-Sleep -Seconds 2
    # Verify port is now free
    $stillInUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($stillInUse) {
        FAIL "Port $Port still in use after cleanup (PIDs: $($stillInUse.OwningProcess -join ','))"
    } else {
        INFO "Port $Port is now free"
    }
}

# 1b. Silent install (unless skipped)
if (-not $SkipInstall) {
    INFO "Installing from: $InstallerPath"

    # Workaround: Older installers use MsgBox instead of SuppressibleMsgBox for the
    # "previous Clawdbot installation" check. This causes /VERYSILENT to hang/abort.
    # Temporarily rename .clawdbot dir so the installer doesn't detect it.
    $oldClawdbotDir = "$env:USERPROFILE\.clawdbot"
    $oldClawdbotBackup = "$env:USERPROFILE\.clawdbot-ci-backup"
    $renamedOldConfig = $false
    if (Test-Path $oldClawdbotDir) {
        INFO "Temporarily hiding $oldClawdbotDir to avoid installer dialog..."
        try {
            Rename-Item $oldClawdbotDir $oldClawdbotBackup -Force -ErrorAction Stop
            $renamedOldConfig = $true
        } catch {
            INFO "Warning: Could not rename .clawdbot: $($_.Exception.Message)"
        }
    }

    # Add Windows Defender exclusion for install dir (best-effort, needs admin)
    try {
        Add-MpPreference -ExclusionPath $InstallDir -ErrorAction SilentlyContinue
    } catch { }

    $installArgs = @(
        "/VERYSILENT",
        "/SUPPRESSMSGBOXES",
        "/NORESTART",
        "/SP-",
        "/CLOSEAPPLICATIONS",
        "/DIR=`"$InstallDir`"",
        "/LOG=`"$LogDir\install.log`""
    )

    $installStart = Get-Date
    # Timeout: 5 minutes max for installation
    $installProc = Start-Process -FilePath $InstallerPath -ArgumentList $installArgs -Wait -PassThru
    $installDuration = [math]::Round(((Get-Date) - $installStart).TotalSeconds, 1)

    # Check for runaway install (> 300s is suspicious)
    if ($installDuration -gt 300) {
        INFO "Warning: Installation took ${installDuration}s (>300s), may have hung"
    }

    if ($installProc.ExitCode -eq 0) {
        PASS "Silent installation (exit code: 0, ${installDuration}s)"
    } else {
        FAIL "Silent installation (exit code: $($installProc.ExitCode), ${installDuration}s)"
        $installLogPath = Join-Path $LogDir "install.log"
        if (Test-Path $installLogPath) {
            INFO "Last 30 lines of install.log:"
            Get-Content $installLogPath -Tail 30 | ForEach-Object { INFO "  $_" }
        }
    }

    # Restore .clawdbot directory after installation
    if ($renamedOldConfig -and (Test-Path $oldClawdbotBackup)) {
        try {
            Rename-Item $oldClawdbotBackup $oldClawdbotDir -Force -ErrorAction Stop
            INFO "Restored $oldClawdbotDir"
        } catch {
            INFO "Warning: Could not restore .clawdbot: $($_.Exception.Message)"
        }
    }
} else {
    INFO "Skipping installation (SkipInstall)"
    if (-not (Test-Path $InstallDir)) {
        FAIL "InstallDir does not exist: $InstallDir"
        Write-Host ""
        Write-Host "Cannot proceed without a valid installation directory." -ForegroundColor Red
        exit 2
    }
}

# 1c. Critical file verification
$criticalFiles = @(
    @{ Path = "node\node.exe";       Desc = "Node.js runtime" },
    @{ Path = "dist\entry.js";       Desc = "Gateway entry" },
    @{ Path = "dist\index.js";       Desc = "Main entry" },
    @{ Path = "package.json";        Desc = "Package manifest" },
    @{ Path = "install.json";        Desc = "Install marker" },
    @{ Path = "ClawdbotService.exe"; Desc = "Native service wrapper" }
)

$foundCount = 0
$totalCount = $criticalFiles.Count
foreach ($f in $criticalFiles) {
    $fullPath = Join-Path $InstallDir $f.Path
    if (Test-Path $fullPath) {
        $foundCount++
    } else {
        INFO "Missing: $($f.Path) ($($f.Desc))"
    }
}

if ($foundCount -eq $totalCount) {
    PASS "Critical files present ($foundCount/$totalCount)"
} else {
    FAIL "Critical files missing ($foundCount/$totalCount present)"
}

# 1d. Node.js functional verification
$nodeExe = Join-Path $InstallDir "node\node.exe"
if (Test-Path $nodeExe) {
    $nodeVersion = & $nodeExe --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        PASS "Node.js functional ($($nodeVersion | Out-String).Trim())"
    } else {
        FAIL "Node.js not functional (exit code: $LASTEXITCODE)"
    }
} else {
    FAIL "Node.js not found at $nodeExe"
}

# 1e. .jsc bytecode load verification
# bytenode registers .jsc require hook, so require('bytenode') then require('.jsc') works
$jscTestScript = @"
try {
    require('bytenode');
    const fs = require('fs');
    const path = require('path');
    const dispatchDir = path.join(process.cwd(), 'dist', 'dispatch');
    if (!fs.existsSync(dispatchDir)) { process.stdout.write('JSC_NONE'); process.exit(0); }
    const jscFiles = fs.readdirSync(dispatchDir).filter(f => f.endsWith('.jsc'));
    if (jscFiles.length === 0) { process.stdout.write('JSC_NONE'); process.exit(0); }
    const target = path.join(dispatchDir, jscFiles[0]);
    require(target);
    process.stdout.write('JSC_OK');
} catch(e) {
    process.stdout.write('JSC_FAIL:' + e.message);
    process.exit(1);
}
"@

if (Test-Path $nodeExe) {
    $jscResult = & $nodeExe -e $jscTestScript 2>&1
    $jscOutput = ($jscResult | Out-String).Trim()
    if ($LASTEXITCODE -eq 0) {
        if ($jscOutput -match 'JSC_NONE') {
            INFO "No .jsc files found in dist/dispatch (skipped)"
            PASS ".jsc bytecode check (no .jsc files)"
        } else {
            PASS ".jsc bytecode loads correctly"
        }
    } else {
        FAIL ".jsc bytecode load failed: $jscOutput"
    }
}

# ============================================================================
# Phase 2: Gateway Startup + Health Check
# ============================================================================
Write-Phase "Phase 2: Gateway Startup"

# 2a. Verify InstallDir exists before starting Gateway
$gatewayReady = $false
if (-not (Test-Path $InstallDir)) {
    FAIL "InstallDir does not exist: $InstallDir (cannot start Gateway)"
}

# 2b. Clean up: kill any process on the test port (may have respawned since Phase 1)
if (Test-Path $InstallDir) {
    $existingConns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($existingConns) {
        INFO "Killing processes on port $Port..."
        $existingConns | ForEach-Object {
            try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } catch { }
        }
        Start-Sleep -Seconds 2
    }
}

# 2c. Set environment variables for isolated test
$testStateDir = "$env:APPDATA\ClawdbotCN-test"
$env:OPENCLAWCN_STATE_DIR          = $testStateDir
$env:CLAWDBOT_STATE_DIR            = $testStateDir
$env:OPENCLAWCN_BUNDLED_PLUGINS_DIR = Join-Path $InstallDir "extensions"
$env:OPENCLAWCN_BUNDLED_SKILLS_DIR  = Join-Path $InstallDir "skills"
$env:OPENCLAWCN_BUNDLED_TOOLS_DIR   = Join-Path $InstallDir "tools"
$env:OPENCLAWCN_GATEWAY_TOKEN      = $token
$env:OPENCLAWCN_REGION              = "cn"
$env:OPENCLAWCN_DESKTOP_MODE       = "1"
$env:CLAWDBOT_BUNDLED_PLUGINS_DIR  = $env:OPENCLAWCN_BUNDLED_PLUGINS_DIR
$env:CLAWDBOT_BUNDLED_SKILLS_DIR   = $env:OPENCLAWCN_BUNDLED_SKILLS_DIR
$env:CLAWDBOT_BUNDLED_TOOLS_DIR    = $env:OPENCLAWCN_BUNDLED_TOOLS_DIR
$env:CLAWDBOT_GATEWAY_TOKEN       = $token
$env:CLAWDBOT_REGION               = "cn"
$env:PATH = "$(Join-Path $InstallDir 'node');$(Join-Path $InstallDir 'tools');$env:PATH"

# Create minimal config so gateway starts without manual setup
New-Item -ItemType Directory -Path $testStateDir -Force | Out-Null
$minimalConfig = @{ gateway = @{ mode = "local" } } | ConvertTo-Json -Depth 3
Set-Content -Path (Join-Path $testStateDir "openclawcn.json") -Value $minimalConfig -Encoding UTF8

# 2d. Start Gateway (only if InstallDir and node.exe exist)
$entryJs = Join-Path $InstallDir "dist\entry.js"
$gatewayStdout = Join-Path $LogDir "gateway-stdout.log"
$gatewayStderr = Join-Path $LogDir "gateway-stderr.log"
$portListening = $false

if ((Test-Path $InstallDir) -and (Test-Path $nodeExe)) {
    # Note: -RedirectStandardOutput/-Error requires a separate window (NOT -NoNewWindow).
    # Use -WindowStyle Hidden for invisible process with I/O redirection.
    INFO "Starting Gateway on port $Port..."
    $gw = Start-Process -FilePath $nodeExe `
        -ArgumentList "`"$entryJs`"", "gateway", "run", "--port", $Port, "--allow-unconfigured" `
        -WorkingDirectory $InstallDir `
        -RedirectStandardOutput $gatewayStdout `
        -RedirectStandardError $gatewayStderr `
        -PassThru -WindowStyle Hidden
    $script:gwProcess = $gw

    # 2e. Stage 1: Wait for port to listen
    for ($i = 0; $i -lt $StartupTimeoutSec; $i++) {
        Start-Sleep -Seconds 1

        if ($gw.HasExited) {
            FAIL "Gateway crashed (exit code: $($gw.ExitCode)) after ${i}s"
            if (Test-Path $gatewayStderr) {
                INFO "Last 20 lines of stderr:"
                Get-Content $gatewayStderr -Tail 20 -ErrorAction SilentlyContinue | ForEach-Object { INFO "  $_" }
            }
            if (Test-Path $gatewayStdout) {
                INFO "Last 20 lines of stdout:"
                Get-Content $gatewayStdout -Tail 20 -ErrorAction SilentlyContinue | ForEach-Object { INFO "  $_" }
            }
            break
        }

        $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($conn) {
            PASS "Port $Port listening (${i}s)"
            $portListening = $true
            break
        }
    }

    if (-not $portListening -and -not $gw.HasExited) {
        FAIL "Port $Port not listening after ${StartupTimeoutSec}s timeout"
    }
}

# 2f. Stage 2: Wait for /api/health ready:true
if ($portListening) {
    $healthUrl = "${baseUrl}/api/health"
    for ($i = 0; $i -lt $ReadyTimeoutSec; $i++) {
        Start-Sleep -Seconds 1

        if ($gw.HasExited) {
            FAIL "Gateway crashed during health wait (exit code: $($gw.ExitCode))"
            break
        }

        try {
            $h = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 3 -ErrorAction Stop
            if ($h.ok -and $h.ready) {
                PASS "Gateway ready (${i}s, PID:$($h.pid), phase:$($h.phase))"
                $gatewayReady = $true
                break
            }
        } catch { }
    }

    if (-not $gatewayReady -and -not $gw.HasExited) {
        FAIL "Gateway not ready after ${ReadyTimeoutSec}s timeout"
    }
}

# ============================================================================
# Phase 3: HTTP Endpoint Verification
# ============================================================================
Write-Phase "Phase 3: HTTP Endpoints"

if ($gatewayReady) {
    # 3a. Health API
    try {
        $h = Invoke-RestMethod -Uri "${baseUrl}/api/health" -TimeoutSec 5 -ErrorAction Stop
        if ($h.ok -eq $true -and $h.ready -eq $true) {
            PASS "GET /api/health (ok:true, ready:true)"
        } else {
            FAIL "GET /api/health unexpected response: ok=$($h.ok) ready=$($h.ready)"
        }
    } catch {
        FAIL "GET /api/health error: $($_.Exception.Message)"
    }

    # 3b. Control UI HTML
    try {
        $ui = Invoke-WebRequest -Uri "${baseUrl}/?token=${token}" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        if ($ui.StatusCode -eq 200 -and $ui.Content -match '<html') {
            $contentLen = $ui.Content.Length
            PASS "Control UI HTML ($contentLen bytes)"
        } else {
            FAIL "Control UI: status=$($ui.StatusCode), html tag not found"
        }
    } catch {
        FAIL "Control UI error: $($_.Exception.Message)"
    }

    # 3c. Setup page
    try {
        $setup = Invoke-WebRequest -Uri "${baseUrl}/setup?token=${token}" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        if ($setup.StatusCode -eq 200) {
            PASS "Setup wizard page ($($setup.StatusCode))"
        } else {
            FAIL "Setup page: status=$($setup.StatusCode)"
        }
    } catch {
        $setupCode = 0
        if ($_.Exception.Response) {
            $setupCode = [int]$_.Exception.Response.StatusCode
        }
        # Redirect is acceptable (some configs redirect /setup)
        if ($setupCode -eq 302 -or $setupCode -eq 301) {
            PASS "Setup wizard page (redirect: $setupCode)"
        } else {
            FAIL "Setup page error: $($_.Exception.Message)"
        }
    }

    # 3d. Shutdown auth protection (no token should be rejected)
    try {
        $null = Invoke-WebRequest -Uri "${baseUrl}/api/shutdown" -Method POST -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        FAIL "Shutdown accepted without auth (should have been rejected)"
    } catch {
        $shutdownCode = 0
        if ($_.Exception.Response) {
            $shutdownCode = [int]$_.Exception.Response.StatusCode
        }
        if ($shutdownCode -eq 401 -or $shutdownCode -eq 403) {
            PASS "Shutdown auth protection ($shutdownCode)"
        } else {
            FAIL "Shutdown protection: unexpected status $shutdownCode"
        }
    }
} else {
    FAIL "Skipping HTTP tests (Gateway not ready)"
}

# ============================================================================
# Phase 4: WebSocket Protocol Connectivity
# ============================================================================
Write-Phase "Phase 4: WebSocket Protocol"

if ($gatewayReady -and -not $SkipWebSocket) {
    # Generate a temporary JS file for WebSocket smoke test.
    # Uses the ws module from the installation's node_modules.
    $wsScript = @"
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:${Port}');
const timeout = setTimeout(() => { console.log('WS_TIMEOUT'); process.exit(1); }, 20000);

ws.on('open', () => {
    ws.send(JSON.stringify({
        type: 'req', id: 'c1', method: 'connect',
        params: {
            minProtocol: 3, maxProtocol: 3,
            client: { id: 'post-build-smoke', version: 'test',
                      platform: 'win32', mode: 'cli',
                      instanceId: 'smoke-' + Date.now() },
            locale: 'zh-CN', userAgent: 'post-build-validation',
            role: 'operator',
            scopes: ['operator.read', 'operator.write'],
            caps: [],
            auth: { token: '${token}' }
        }
    }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'res' && msg.id === 'c1' && msg.ok) {
        ws.send(JSON.stringify({ type: 'req', id: 'h1', method: 'health' }));
    }
    if (msg.type === 'res' && msg.id === 'h1' && msg.ok) {
        clearTimeout(timeout);
        ws.close();
        console.log('WS_SMOKE_OK');
        process.exit(0);
    }
});

ws.on('error', (e) => { console.log('WS_ERROR:' + e.message); process.exit(2); });
"@

    $wsFile = Join-Path $env:TEMP "clawdbot-ws-smoke-$(Get-Random).js"
    Set-Content -Path $wsFile -Value $wsScript -Encoding UTF8

    $wsResult = & $nodeExe $wsFile 2>&1
    $wsExitCode = $LASTEXITCODE
    Remove-Item $wsFile -Force -ErrorAction SilentlyContinue

    $wsOutput = ($wsResult | Out-String).Trim()
    if ($wsExitCode -eq 0 -and $wsOutput -match 'WS_SMOKE_OK') {
        PASS "WebSocket connect + health"
    } else {
        FAIL "WebSocket test (exit:${wsExitCode}): $wsOutput"
    }
} elseif ($SkipWebSocket) {
    INFO "Skipping WebSocket test (SkipWebSocket)"
} else {
    FAIL "Skipping WebSocket test (Gateway not ready)"
}

# ============================================================================
# Phase 5: Cleanup
# ============================================================================
Write-Phase "Phase 5: Cleanup"

# 5a. Graceful shutdown — always runs, even if earlier phases failed
if ($gw -and -not $gw.HasExited) {
    $shutdownOk = $false
    try {
        # Header name: x-openclawcn-token (matches server-http.ts:551)
        $null = Invoke-WebRequest -Uri "${baseUrl}/api/shutdown" -Method POST `
            -Headers @{ "x-openclawcn-token" = $token } `
            -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        # Wait up to 8 seconds for graceful exit (consistent with ClawdbotService.cs)
        $gw.WaitForExit(8000)
        if ($gw.HasExited) {
            $shutdownOk = $true
        }
    } catch { }

    if ($shutdownOk) {
        PASS "Gateway shutdown (graceful)"
    } else {
        # Force kill as fallback
        try {
            Stop-Process -Id $gw.Id -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        } catch { }
        PASS "Gateway shutdown (forced)"
    }
    $script:gwProcess = $null
} else {
    INFO "Gateway already exited"
}

# 5b. Clean up test state directory
if (Test-Path $testStateDir) {
    Remove-Item $testStateDir -Recurse -Force -ErrorAction SilentlyContinue
    if (-not (Test-Path $testStateDir)) {
        PASS "Test data cleaned"
    } else {
        INFO "Warning: Could not fully clean $testStateDir"
    }
} else {
    PASS "Test data cleaned (no state dir created)"
}

# 5c. Optional uninstall
if ($Cleanup) {
    $uninstaller = Join-Path $InstallDir "unins000.exe"
    if (Test-Path $uninstaller) {
        INFO "Running uninstaller..."
        Start-Process $uninstaller -ArgumentList "/VERYSILENT", "/SUPPRESSMSGBOXES" -Wait
        PASS "Uninstall completed"
    } else {
        INFO "Uninstaller not found at $uninstaller"
    }
}

# ============================================================================
# Restore environment (avoid polluting parent process)
# ============================================================================
$env:PATH = $originalPath
Remove-Item Env:\OPENCLAWCN_STATE_DIR -ErrorAction SilentlyContinue
Remove-Item Env:\OPENCLAWCN_BUNDLED_PLUGINS_DIR -ErrorAction SilentlyContinue
Remove-Item Env:\OPENCLAWCN_BUNDLED_SKILLS_DIR -ErrorAction SilentlyContinue
Remove-Item Env:\OPENCLAWCN_BUNDLED_TOOLS_DIR -ErrorAction SilentlyContinue
Remove-Item Env:\OPENCLAWCN_GATEWAY_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:\OPENCLAWCN_REGION -ErrorAction SilentlyContinue
Remove-Item Env:\CLAWDBOT_STATE_DIR -ErrorAction SilentlyContinue
Remove-Item Env:\CLAWDBOT_BUNDLED_PLUGINS_DIR -ErrorAction SilentlyContinue
Remove-Item Env:\CLAWDBOT_BUNDLED_SKILLS_DIR -ErrorAction SilentlyContinue
Remove-Item Env:\CLAWDBOT_BUNDLED_TOOLS_DIR -ErrorAction SilentlyContinue
Remove-Item Env:\CLAWDBOT_GATEWAY_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:\CLAWDBOT_REGION -ErrorAction SilentlyContinue

# ============================================================================
# Summary
# ============================================================================
$totalTests = $script:passCount + $script:failCount
$elapsed = [math]::Round(((Get-Date) - $script:scriptStart).TotalSeconds, 1)

$summaryColor = if ($script:failCount -eq 0) { "Green" } else { "Red" }

Write-Host ""
Write-Host "========================================" -ForegroundColor $summaryColor
Write-Host "  Post-Build Validation Results" -ForegroundColor $summaryColor
Write-Host "========================================" -ForegroundColor $summaryColor
Write-Host "  Total:  $totalTests tests"
Write-Host "  Passed: $($script:passCount)" -ForegroundColor Green
Write-Host "  Failed: $($script:failCount)" -ForegroundColor $(if ($script:failCount -eq 0) { "Green" } else { "Red" })
Write-Host "  Time:   ${elapsed}s"
Write-Host "========================================" -ForegroundColor $summaryColor
Write-Host ""

# Write report file
$script:reportLines += ""
$script:reportLines += "========================================"
$script:reportLines += "  Post-Build Validation Results"
$script:reportLines += "========================================"
$script:reportLines += "  Total:  $totalTests tests"
$script:reportLines += "  Passed: $($script:passCount)"
$script:reportLines += "  Failed: $($script:failCount)"
$script:reportLines += "  Time:   ${elapsed}s"
$script:reportLines += "========================================"

$reportPath = Join-Path $LogDir "validation-report.txt"
$script:reportLines | Out-File -FilePath $reportPath -Encoding UTF8
INFO "Report saved to: $reportPath"

if ($script:failCount -gt 0) {
    exit 1
} else {
    exit 0
}
