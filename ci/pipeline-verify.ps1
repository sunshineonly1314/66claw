<#
.SYNOPSIS
  Pipeline Phase 3: Runtime verification — install, start Gateway, test APIs
.DESCRIPTION
  Installs the built package, starts Gateway on a test port, runs HTTP + WebSocket
  tests on both Windows and macOS. Only tests runtime behavior (file integrity
  already validated by build scripts).
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

# Load state
if ($StateFile -and (Test-Path $StateFile)) { . $StateFile }

$PASS = 0; $FAIL = 0; $WARN = 0
function Test-Pass { param($msg) $script:PASS++; Write-Host "  [PASS] $msg" -ForegroundColor Green }
function Test-Fail { param($msg) $script:FAIL++; Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Test-Warn { param($msg) $script:WARN++; Write-Host "  [WARN] $msg" -ForegroundColor Yellow }

$TEST_PORT = 19099
$TOKEN = "pipeline-test-token-$(Get-Date -Format 'yyyyMMdd')"
$BASE_URL = "http://127.0.0.1:$TEST_PORT"
$GW_PID = $null
$INSTALL_DIR = "E:\openclawcn\pipeline-test"
$TEST_STATE_DIR = Join-Path $env:TEMP "pipeline-test-state-$(Get-Date -Format 'yyyyMMddHHmmss')"

# ══════════════════════════════════════════════
# Windows Runtime Verification
# ══════════════════════════════════════════════
if ($Platform -in @("all","windows") -and $PL_WIN_EXE -and (Test-Path $PL_WIN_EXE)) {

    Write-Host ""
    Write-Host "[verify] Windows runtime verification"
    Write-Host "  Installer: $PL_WIN_EXE"

    # ── Step 1: Silent install ──
    Write-Host "[verify] Step 1: Silent install to $INSTALL_DIR"
    if (Test-Path $INSTALL_DIR) {
        Write-Host "  Cleaning previous test install..."
        Remove-Item $INSTALL_DIR -Recurse -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }

    & "$PL_WIN_EXE" /S "/D=$INSTALL_DIR" 2>&1
    # Wait for installer to finish
    $installerName = [System.IO.Path]::GetFileNameWithoutExtension($PL_WIN_EXE)
    for ($i = 0; $i -lt 120; $i++) {
        $proc = Get-Process -Name $installerName -ErrorAction SilentlyContinue
        if (-not $proc) { break }
        Start-Sleep -Seconds 2
    }

    $winInstallOk = $false
    if (Test-Path "$INSTALL_DIR\resources\dist\entry.js") {
        Test-Pass "Silent install completed"
        $winInstallOk = $true
    } else {
        Test-Fail "Silent install failed — entry.js not found"
        Write-Host "  Install dir contents:" -ForegroundColor Yellow
        if (Test-Path $INSTALL_DIR) { Get-ChildItem $INSTALL_DIR -Recurse -Depth 2 | Select-Object -First 20 | ForEach-Object { Write-Host "    $($_.FullName)" } }
    }

    $RES = "$INSTALL_DIR\resources"
    $NODE = "$RES\node\node.exe"

  if ($winInstallOk) {
    # ── Step 2: Start Gateway ──
    Write-Host "[verify] Step 2: Starting Gateway on port $TEST_PORT"

    # Kill anything on test port
    $existingPids = netstat -ano 2>$null | Select-String ":$TEST_PORT\s" | ForEach-Object {
        ($_ -split '\s+')[-1]
    } | Sort-Object -Unique
    foreach ($pid in $existingPids) {
        if ($pid -and $pid -ne "0") {
            taskkill /PID $pid /F 2>$null | Out-Null
        }
    }
    Start-Sleep -Seconds 1

    New-Item -ItemType Directory -Force -Path $TEST_STATE_DIR | Out-Null
    $gwLog = Join-Path $LogDir "verify-gateway.log"

    $env:OPENCLAWCN_STATE_DIR = $TEST_STATE_DIR
    $env:OPENCLAWCN_GATEWAY_TOKEN = $TOKEN
    $env:OPENCLAWCN_GATEWAY_PORT = "$TEST_PORT"
    $env:OPENCLAWCN_DESKTOP_MODE = "1"
    $env:OPENCLAWCN_NO_RESPAWN = "1"
    $env:NODE_ENV = "production"

    $gwProcess = Start-Process -FilePath $NODE `
        -ArgumentList "`"$RES\dist\entry.js`" gateway --port $TEST_PORT --allow-unconfigured" `
        -WorkingDirectory $RES -PassThru -NoNewWindow `
        -RedirectStandardOutput $gwLog -RedirectStandardError (Join-Path $LogDir "verify-gateway-err.log")
    $GW_PID = $gwProcess.Id
    Write-Host "  Gateway PID: $GW_PID"

    # ── Step 3: Wait for ready ──
    Write-Host "[verify] Step 3: Waiting for Gateway ready..."
    $ready = $false
    for ($i = 1; $i -le 90; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri "$BASE_URL/api/health" -TimeoutSec 3 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($resp.Content -match '"ready":\s*true') {
                $ready = $true
                Write-Host "  Gateway ready (${i}s)" -ForegroundColor Green
                break
            }
        } catch { }
        Start-Sleep -Seconds 1
    }

    if (-not $ready) {
        Test-Fail "Gateway failed to start within 90s"
        if (Test-Path $gwLog) {
            Write-Host "  Last 20 lines of gateway log:" -ForegroundColor Yellow
            Get-Content $gwLog -Tail 20 | ForEach-Object { Write-Host "    $_" }
        }
    } else {
        Test-Pass "Gateway started and ready"

        # ── Step 4: HTTP tests ──
        Write-Host "[verify] Step 4: HTTP API tests"

        # Health
        try {
            $h = Invoke-WebRequest -Uri "$BASE_URL/api/health" -UseBasicParsing -TimeoutSec 5
            if ($h.StatusCode -eq 200 -and $h.Content -match '"ready":\s*true') {
                Test-Pass "GET /api/health → 200 + ready:true"
            } else {
                Test-Fail "GET /api/health → $($h.StatusCode)"
            }
        } catch { Test-Fail "GET /api/health → exception: $_" }

        # UI homepage
        try {
            $ui = Invoke-WebRequest -Uri "$BASE_URL/" -UseBasicParsing -TimeoutSec 5
            if ($ui.StatusCode -eq 200 -and $ui.Content -match "<html") {
                Test-Pass "GET / → 200 + HTML"
            } else {
                Test-Fail "GET / → $($ui.StatusCode)"
            }
        } catch { Test-Fail "GET / → exception: $_" }

        # CORS preflight
        try {
            $cors = Invoke-WebRequest -Uri "$BASE_URL/api/health" -Method OPTIONS `
                -Headers @{ Origin = "http://localhost:5173"; "Access-Control-Request-Method" = "GET" } `
                -UseBasicParsing -TimeoutSec 5
            if ($cors.Headers["Access-Control-Allow-Origin"]) {
                Test-Pass "OPTIONS /api/health → CORS headers present"
            } else {
                Test-Warn "OPTIONS /api/health → no CORS headers"
            }
        } catch { Test-Warn "OPTIONS /api/health → $_" }

        # ── Step 5: WebSocket RPC tests ──
        Write-Host "[verify] Step 5: WebSocket RPC tests"

        # Use Node.js for WebSocket testing (ws module available in bundled node_modules)
        $wsTestScript = @"
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:$TEST_PORT/ws');
const results = [];
let reqId = 1;

function rpc(method) {
  return new Promise((resolve) => {
    const id = reqId++;
    const timeout = setTimeout(() => resolve({ method, ok: false, error: 'timeout' }), 8000);
    const handler = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          clearTimeout(timeout);
          ws.removeListener('message', handler);
          resolve({ method, ok: !msg.error, preview: JSON.stringify(msg.result || msg.error).substring(0, 80) });
        }
      } catch {}
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params: {} }));
  });
}

ws.on('open', async () => {
  // Auth
  ws.send(JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'auth', params: { token: '$TOKEN' } }));
  await new Promise(r => setTimeout(r, 1000));

  const methods = ['health', 'status', 'models.list', 'agents.list', 'config.get', 'sessions.list', 'skills.status', 'mcp.servers.list'];
  for (const m of methods) {
    results.push(await rpc(m));
  }
  console.log(JSON.stringify(results));
  ws.close();
  process.exit(0);
});

ws.on('error', (err) => {
  console.log(JSON.stringify([{ method: 'connect', ok: false, error: err.message }]));
  process.exit(1);
});

setTimeout(() => { console.log(JSON.stringify([{ method: 'timeout', ok: false, error: 'ws connect timeout' }])); process.exit(1); }, 15000);
"@

        $wsTestFile = Join-Path $env:TEMP "pipeline-ws-test.js"
        $wsTestScript | Set-Content $wsTestFile -Encoding UTF8

        $wsOutput = & $NODE $wsTestFile 2>&1
        if ($wsOutput) {
            try {
                $wsResults = $wsOutput | Where-Object { $_ -match '^\[' } | Select-Object -First 1 | ConvertFrom-Json
                foreach ($r in $wsResults) {
                    if ($r.ok) {
                        Test-Pass "RPC $($r.method) → OK"
                    } else {
                        Test-Fail "RPC $($r.method) → $($r.error)"
                    }
                }
            } catch {
                Test-Fail "WebSocket test parse error: $wsOutput"
            }
        } else {
            Test-Fail "WebSocket test returned no output"
        }

        Remove-Item $wsTestFile -Force -ErrorAction SilentlyContinue
    }

  } # end if ($winInstallOk)

    # ── Step 6: Cleanup ──
    Write-Host "[verify] Step 6: Cleanup"
    if ($GW_PID) {
        Stop-Process -Id $GW_PID -Force -ErrorAction SilentlyContinue
        # Kill child processes
        Get-CimInstance Win32_Process -Filter "ParentProcessId='$GW_PID'" -ErrorAction SilentlyContinue |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        Write-Host "  Gateway stopped."
    }

    # Clean env vars
    Remove-Item env:OPENCLAWCN_STATE_DIR -ErrorAction SilentlyContinue
    Remove-Item env:OPENCLAWCN_GATEWAY_TOKEN -ErrorAction SilentlyContinue
    Remove-Item env:OPENCLAWCN_GATEWAY_PORT -ErrorAction SilentlyContinue
    Remove-Item env:OPENCLAWCN_DESKTOP_MODE -ErrorAction SilentlyContinue
    Remove-Item env:OPENCLAWCN_NO_RESPAWN -ErrorAction SilentlyContinue

    # Remove test install
    if (Test-Path $INSTALL_DIR) {
        # Kill any remaining node processes from the test install
        Get-Process -Name "node" -ErrorAction SilentlyContinue |
            Where-Object { $_.Path -and $_.Path.StartsWith($INSTALL_DIR) } |
            Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Remove-Item $INSTALL_DIR -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  Test install cleaned."
    }
    Remove-Item $TEST_STATE_DIR -Recurse -Force -ErrorAction SilentlyContinue
}

# ══════════════════════════════════════════════
# macOS Runtime Verification (SSH to 107)
# ══════════════════════════════════════════════
# macOS verification runs independently of Windows result
if ($Platform -in @("all","macos") -and $PL_MAC_DMG -and (Test-Path $PL_MAC_DMG)) {

    Write-Host ""
    Write-Host "[verify] macOS runtime verification (SSH to 107)"

    # Upload DMG to Mac and run test-macos-full-api.sh
    $dmgName = [System.IO.Path]::GetFileName($PL_MAC_DMG)
    $macTestScript = Join-Path $PSScriptRoot "test-macos-full-api.sh"

    if (Test-Path $macTestScript) {
        Write-Host "  Uploading DMG to Mac..."
        $dmgPathUnix = ($PL_MAC_DMG -replace '\\', '/')
        scp -o StrictHostKeyChecking=no $dmgPathUnix "kevinsun@192.168.0.107:/tmp/$dmgName" 2>&1

        Write-Host "  Uploading test script..."
        $testScriptUnix = ($macTestScript -replace '\\', '/')
        scp -o StrictHostKeyChecking=no $testScriptUnix "kevinsun@192.168.0.107:/tmp/pipeline-mac-test.sh" 2>&1

        Write-Host "  Running macOS API tests..."
        $macTestLog = Join-Path $LogDir "verify-macos.log"
        $macTestOutput = ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 kevinsun@192.168.0.107 `
            "chmod +x /tmp/pipeline-mac-test.sh && DMG_PATH=/tmp/$dmgName bash /tmp/pipeline-mac-test.sh" 2>&1
        $macTestExit = $LASTEXITCODE
        $macTestOutput | Out-File $macTestLog -Encoding UTF8

        # Count PASS/FAIL from output
        $macPass = ($macTestOutput | Select-String "\[PASS\]").Count
        $macFail = ($macTestOutput | Select-String "\[FAIL\]").Count
        $macWarn = ($macTestOutput | Select-String "\[WARN\]").Count

        $PASS += $macPass
        $FAIL += $macFail
        $WARN += $macWarn

        if ($macTestExit -eq 0) {
            Write-Host "  macOS tests: $macPass PASS, $macFail FAIL, $macWarn WARN" -ForegroundColor Green
        } else {
            Write-Host "  macOS tests FAILED (exit $macTestExit): $macPass PASS, $macFail FAIL" -ForegroundColor Red
            $macTestOutput | Select-String "\[FAIL\]" | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        }

        # Cleanup remote
        ssh -o StrictHostKeyChecking=no kevinsun@192.168.0.107 "rm -f /tmp/$dmgName /tmp/pipeline-mac-test.sh" 2>&1 | Out-Null
    } else {
        Test-Warn "test-macos-full-api.sh not found — skipping macOS runtime tests"
    }
}

# ══════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════
Write-Host ""
Write-Host "════════════════════════════════════════════"
Write-Host "  Verification Results"
Write-Host "  PASS: $PASS | FAIL: $FAIL | WARN: $WARN"
Write-Host "════════════════════════════════════════════"

# Write report
$reportFile = Join-Path $LogDir "verify-report.txt"
@"
ClawdbotCN Pipeline Verify Report
Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Version: $PL_VERSION
PASS: $PASS | FAIL: $FAIL | WARN: $WARN
"@ | Set-Content $reportFile -Encoding UTF8

# Update state
if ($StateFile) {
    Add-Content $StateFile @"

`$PL_VERIFY_PASS = $PASS
`$PL_VERIFY_FAIL = $FAIL
`$PL_VERIFY_WARN = $WARN
"@
}

if ($FAIL -gt 0) {
    Write-Host "  Runtime verification FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "[verify] Done" -ForegroundColor Green
exit 0
