#!/usr/bin/env bash
# ============================================================================
# ClawdbotCN macOS Post-Build Validation Script
#
# Performs 5-phase validation of a built .app bundle or DMG:
#   Phase 1: DMG mount / app copy + file structure verification
#   Phase 2: Gateway startup + health check (ready:true)
#   Phase 3: HTTP endpoint verification (/api/health, Control UI, Shutdown auth)
#   Phase 4: WebSocket protocol connectivity (connect + health handshake)
#   Phase 5: Cleanup (graceful shutdown, test state removal)
#
# Usage:
#   # From DMG: mount, extract, validate
#   bash post-build-validation.sh --dmg "build/output/ClawdbotCN-macOS-v2026.2.15-universal.dmg"
#
#   # From .app directory directly (skip DMG mount)
#   bash post-build-validation.sh --app-dir "build/output/ClawdbotCN.app"
#
#   # Skip install, validate existing .app
#   bash post-build-validation.sh --app-dir "/Applications/ClawdbotCN.app" --skip-install
#
#   # With cleanup (remove test app + state after validation)
#   bash post-build-validation.sh --dmg "..." --cleanup
#
# Exit codes:
#   0 = all tests passed
#   1 = one or more tests failed
#   2 = script error (invalid params, missing files)
# ============================================================================

set -uo pipefail

# ============================================================================
# Defaults
# ============================================================================
DMG_PATH=""
APP_DIR=""
INSTALL_DIR=""
LOG_DIR=""
PORT=18789
STARTUP_TIMEOUT=60
READY_TIMEOUT=90
SKIP_INSTALL=false
SKIP_WEBSOCKET=false
CLEANUP=false

# ============================================================================
# Parse arguments
# ============================================================================
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dmg)             DMG_PATH="$2"; shift 2 ;;
    --app-dir)         APP_DIR="$2"; shift 2 ;;
    --install-dir)     INSTALL_DIR="$2"; shift 2 ;;
    --log-dir)         LOG_DIR="$2"; shift 2 ;;
    --port)            PORT="$2"; shift 2 ;;
    --startup-timeout) STARTUP_TIMEOUT="$2"; shift 2 ;;
    --ready-timeout)   READY_TIMEOUT="$2"; shift 2 ;;
    --skip-install)    SKIP_INSTALL=true; shift ;;
    --skip-websocket)  SKIP_WEBSOCKET=true; shift ;;
    --cleanup)         CLEANUP=true; shift ;;
    *)
      echo "ERROR: Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

# ============================================================================
# Counters & helpers
# ============================================================================
PASS_COUNT=0
FAIL_COUNT=0
REPORT_LINES=()
SCRIPT_START=$(date +%s)
GW_PID=""
MOUNT_POINT=""
TOKEN="ci-test-$$-$RANDOM"
BASE_URL="http://127.0.0.1:${PORT}"

phase() {
    echo ""
    echo "=== $* ==="
    REPORT_LINES+=("" "=== $* ===")
}

pass() {
    echo "  [PASS] $*"
    PASS_COUNT=$((PASS_COUNT + 1))
    REPORT_LINES+=("  [PASS] $*")
}

fail() {
    echo "  [FAIL] $*"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    REPORT_LINES+=("  [FAIL] $*")
}

info() {
    echo "  $*"
}

# Cleanup function — always runs on exit
cleanup_on_exit() {
    # Kill gateway if still running
    if [ -n "$GW_PID" ] && kill -0 "$GW_PID" 2>/dev/null; then
        kill -9 "$GW_PID" 2>/dev/null || true
    fi
    # Detach DMG if still mounted
    if [ -n "$MOUNT_POINT" ] && [ -d "$MOUNT_POINT" ]; then
        hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
    fi
}
trap cleanup_on_exit EXIT INT TERM

# ============================================================================
# Parameter validation
# ============================================================================
if [ -z "$DMG_PATH" ] && [ -z "$APP_DIR" ]; then
    echo "ERROR: Either --dmg or --app-dir is required." >&2
    exit 2
fi

if [ -n "$DMG_PATH" ] && [ ! -f "$DMG_PATH" ]; then
    echo "ERROR: DMG not found: $DMG_PATH" >&2
    exit 2
fi

if [ -n "$APP_DIR" ] && [ "$SKIP_INSTALL" = "false" ] && [ ! -d "$APP_DIR" ]; then
    echo "ERROR: App directory not found: $APP_DIR" >&2
    exit 2
fi

# Set defaults for install and log directories
if [ -z "$INSTALL_DIR" ]; then
    INSTALL_DIR="/tmp/clawdbot-validation-$$"
fi

if [ -z "$LOG_DIR" ]; then
    LOG_DIR="$INSTALL_DIR/validation-logs"
fi

mkdir -p "$LOG_DIR" 2>/dev/null || true

# Determine the test app path
# If --app-dir is set and --skip-install, use it directly
# If --app-dir is set without --skip-install, copy it to INSTALL_DIR
# If --dmg is set, mount and extract to INSTALL_DIR
if [ "$SKIP_INSTALL" = "true" ] && [ -n "$APP_DIR" ]; then
    TEST_APP_DIR="$APP_DIR"
elif [ -n "$APP_DIR" ] && [ -z "$DMG_PATH" ]; then
    # --app-dir without --skip-install: use directly (build output scenario)
    TEST_APP_DIR="$APP_DIR"
else
    TEST_APP_DIR="$INSTALL_DIR/ClawdbotCN.app"
fi

echo ""
echo "========================================"
echo "  ClawdbotCN macOS Post-Build Validation"
echo "========================================"
echo ""
info "DMG:           ${DMG_PATH:-N/A}"
info "AppDir:        ${APP_DIR:-N/A}"
info "TestAppDir:    $TEST_APP_DIR"
info "Port:          $PORT"
info "LogDir:        $LOG_DIR"
info "SkipInstall:   $SKIP_INSTALL"
info "SkipWebSocket: $SKIP_WEBSOCKET"

# ============================================================================
# Phase 1: DMG Mount / App Copy + File Structure Verification
# ============================================================================
phase "Phase 1: Installation & File Structure"

# 1a. DMG mount and app extraction (if DMG provided)
if [ -n "$DMG_PATH" ] && [ "$SKIP_INSTALL" = "false" ]; then
    info "Mounting DMG: $DMG_PATH"
    MOUNT_START=$(date +%s)

    MOUNT_OUTPUT=$(hdiutil attach "$DMG_PATH" -nobrowse -noverify -readonly 2>&1)
    MOUNT_EXIT=$?

    if [ $MOUNT_EXIT -ne 0 ]; then
        fail "DMG mount failed (exit: $MOUNT_EXIT)"
        info "Output: $MOUNT_OUTPUT"
        echo "Cannot proceed without mounted DMG." >&2
        exit 2
    fi

    MOUNT_POINT=$(echo "$MOUNT_OUTPUT" | grep "/Volumes/" | awk '{for(i=3;i<=NF;i++) printf "%s%s",$i,(i<NF?" ":"\n")}')
    if [ -z "$MOUNT_POINT" ] || [ ! -d "$MOUNT_POINT" ]; then
        fail "DMG mount point not found"
        exit 2
    fi

    # Find .app in the mounted volume
    DMG_APP=$(find "$MOUNT_POINT" -maxdepth 1 -name "*.app" -print -quit 2>/dev/null)
    if [ -z "$DMG_APP" ]; then
        fail "No .app found in DMG volume at $MOUNT_POINT"
        hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
        MOUNT_POINT=""
        exit 2
    fi

    # Copy .app to test directory
    mkdir -p "$INSTALL_DIR"
    info "Copying $DMG_APP to $TEST_APP_DIR..."
    cp -R "$DMG_APP" "$TEST_APP_DIR"
    CP_EXIT=$?

    # Detach DMG now that we've copied the app
    hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
    MOUNT_POINT=""

    MOUNT_ELAPSED=$(( $(date +%s) - MOUNT_START ))

    if [ $CP_EXIT -eq 0 ] && [ -d "$TEST_APP_DIR" ]; then
        pass "DMG mounted and app extracted (${MOUNT_ELAPSED}s)"
    else
        fail "Failed to copy app from DMG (exit: $CP_EXIT)"
        exit 2
    fi
fi

# Verify test app dir exists
if [ ! -d "$TEST_APP_DIR" ]; then
    fail "Test app directory does not exist: $TEST_APP_DIR"
    exit 2
fi

# Resolve key paths
CONTENTS="$TEST_APP_DIR/Contents"
RESOURCES="$CONTENTS/Resources"
APP_ROOT="$RESOURCES/app"
NODE_BIN="$RESOURCES/node/bin/node"

# 1b. Critical file verification
CRITICAL_FILES=(
    "Contents/MacOS/ClawdbotCN:Launcher script"
    "Contents/Resources/node/bin/node:Node.js runtime"
    "Contents/Resources/app/dist/entry.js:Gateway entry"
    "Contents/Resources/app/dist/index.js:Main entry"
    "Contents/Resources/app/package.json:Package manifest"
    "Contents/Resources/app/dist/control-ui/index.html:Web UI"
    "Contents/Resources/version.json:Version metadata"
    "Contents/Resources/app/build-meta.json:V8 version guard"
)

FOUND_COUNT=0
TOTAL_COUNT=${#CRITICAL_FILES[@]}

for entry in "${CRITICAL_FILES[@]}"; do
    FILE_PATH="${entry%%:*}"
    FILE_DESC="${entry#*:}"
    FULL_PATH="$TEST_APP_DIR/$FILE_PATH"
    if [ -f "$FULL_PATH" ]; then
        FOUND_COUNT=$((FOUND_COUNT + 1))
    else
        info "Missing: $FILE_PATH ($FILE_DESC)"
    fi
done

if [ "$FOUND_COUNT" -eq "$TOTAL_COUNT" ]; then
    pass "Critical files present ($FOUND_COUNT/$TOTAL_COUNT)"
else
    fail "Critical files missing ($FOUND_COUNT/$TOTAL_COUNT present)"
fi

# 1c. Clear quarantine attributes (matches launcher script behavior)
xattr -cr "$RESOURCES" 2>/dev/null || true
chmod +x "$NODE_BIN" 2>/dev/null || true
chmod +x "$CONTENTS/MacOS/ClawdbotCN" 2>/dev/null || true

# On Apple Silicon, re-sign node binary after clearing quarantine
if [ "$(uname -m)" = "arm64" ] && [ -f "$NODE_BIN" ]; then
    codesign --sign - --force "$NODE_BIN" 2>/dev/null || true
fi

# 1d. Node.js functional verification
if [ -f "$NODE_BIN" ]; then
    NODE_VERSION_OUTPUT=$("$NODE_BIN" --version 2>&1)
    NODE_EXIT=$?
    if [ $NODE_EXIT -eq 0 ]; then
        pass "Node.js functional ($(echo "$NODE_VERSION_OUTPUT" | tr -d '\n'))"
    else
        fail "Node.js not functional (exit code: $NODE_EXIT)"
    fi
else
    fail "Node.js not found at $NODE_BIN"
fi

# 1e. .jsc bytecode load verification
if [ -f "$NODE_BIN" ] && [ -d "$APP_ROOT" ]; then
    JSC_TEST_SCRIPT='
try {
    process.chdir(process.argv[1]);
    require("bytenode");
    const fs = require("fs");
    const path = require("path");
    const dispatchDir = path.join(process.cwd(), "dist", "dispatch");
    if (!fs.existsSync(dispatchDir)) { process.stdout.write("JSC_NONE"); process.exit(0); }
    const jscFiles = fs.readdirSync(dispatchDir).filter(f => f.endsWith(".jsc"));
    if (jscFiles.length === 0) { process.stdout.write("JSC_NONE"); process.exit(0); }
    require(path.join(dispatchDir, jscFiles[0]));
    process.stdout.write("JSC_OK");
} catch(e) {
    process.stdout.write("JSC_FAIL:" + e.message);
    process.exit(1);
}
'
    JSC_RESULT=$("$NODE_BIN" -e "$JSC_TEST_SCRIPT" "$APP_ROOT" 2>&1)
    JSC_EXIT=$?

    if [ $JSC_EXIT -eq 0 ]; then
        if echo "$JSC_RESULT" | grep -q 'JSC_NONE'; then
            info "No .jsc files found in dist/dispatch (skipped)"
            pass ".jsc bytecode check (no .jsc files)"
        else
            pass ".jsc bytecode loads correctly"
        fi
    else
        fail ".jsc bytecode load failed: $JSC_RESULT"
    fi
fi

# 1f. .jsc file count check
if [ -d "$APP_ROOT/dist" ]; then
    JSC_COUNT=$(find "$APP_ROOT/dist" -name "*.jsc" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$JSC_COUNT" -ge 5 ]; then
        pass ".jsc file count ($JSC_COUNT files)"
    else
        fail ".jsc file count: expected >=5, found $JSC_COUNT"
    fi
fi

# ============================================================================
# Phase 2: Gateway Startup + Health Check
# ============================================================================
phase "Phase 2: Gateway Startup"

GATEWAY_READY=false
PORT_LISTENING=false

# 2a. Clean up: kill any process on the test port
EXISTING_PIDS=$(lsof -ti ":$PORT" 2>/dev/null || true)
if [ -n "$EXISTING_PIDS" ]; then
    info "Killing processes on port $PORT..."
    echo "$EXISTING_PIDS" | xargs kill -TERM 2>/dev/null || true
    sleep 2
    # Force-kill if still alive
    REMAINING=$(lsof -ti ":$PORT" 2>/dev/null || true)
    if [ -n "$REMAINING" ]; then
        echo "$REMAINING" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
fi

# 2b. Set environment variables for isolated test
TEST_STATE_DIR="$HOME/Library/Application Support/OpenClawCN-test"
export OPENCLAWCN_STATE_DIR="$TEST_STATE_DIR"
export OPENCLAWCN_BUNDLED_PLUGINS_DIR="$APP_ROOT/extensions"
export OPENCLAWCN_BUNDLED_SKILLS_DIR="$APP_ROOT/skills"
export OPENCLAWCN_BUNDLED_TOOLS_DIR="$RESOURCES/tools"
export OPENCLAWCN_GATEWAY_TOKEN="$TOKEN"
export OPENCLAWCN_REGION="cn"
export OPENCLAWCN_DESKTOP_MODE=1
export NODE_ENV=production

# Save original PATH
ORIGINAL_PATH="$PATH"
export PATH="$RESOURCES/node/bin:$PATH"

# 2c. Create state directories
mkdir -p "$TEST_STATE_DIR/config" 2>/dev/null || true
mkdir -p "$TEST_STATE_DIR/data" 2>/dev/null || true

# 2c-fix. Create minimal config so gateway starts without manual setup
cat > "$TEST_STATE_DIR/openclawcn.json" << 'EOFCFG'
{
  "gateway": {
    "mode": "local"
  }
}
EOFCFG

# 2d. Start Gateway (only if node and entry.js exist)
ENTRY_JS="$APP_ROOT/dist/entry.js"
GW_STDOUT="$LOG_DIR/gateway-stdout.log"
GW_STDERR="$LOG_DIR/gateway-stderr.log"

if [ -f "$NODE_BIN" ] && [ -f "$ENTRY_JS" ]; then
    info "Starting Gateway on port $PORT..."
    "$NODE_BIN" "$ENTRY_JS" gateway run --port "$PORT" --allow-unconfigured \
        > "$GW_STDOUT" 2> "$GW_STDERR" &
    GW_PID=$!

    # 2e. Stage 1: Wait for port to listen
    for i in $(seq 1 "$STARTUP_TIMEOUT"); do
        sleep 1

        if ! kill -0 "$GW_PID" 2>/dev/null; then
            wait "$GW_PID" 2>/dev/null || true
            GW_EXIT=$?
            fail "Gateway crashed (exit code: $GW_EXIT) after ${i}s"
            if [ -f "$GW_STDERR" ]; then
                info "Last 20 lines of stderr:"
                tail -20 "$GW_STDERR" 2>/dev/null | while IFS= read -r line; do info "  $line"; done
            fi
            if [ -f "$GW_STDOUT" ]; then
                info "Last 20 lines of stdout:"
                tail -20 "$GW_STDOUT" 2>/dev/null | while IFS= read -r line; do info "  $line"; done
            fi
            GW_PID=""
            break
        fi

        if lsof -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
            pass "Port $PORT listening (${i}s)"
            PORT_LISTENING=true
            break
        fi
    done

    if [ "$PORT_LISTENING" = "false" ] && [ -n "$GW_PID" ] && kill -0 "$GW_PID" 2>/dev/null; then
        fail "Port $PORT not listening after ${STARTUP_TIMEOUT}s timeout"
    fi
else
    fail "Cannot start Gateway (missing node or entry.js)"
fi

# 2f. Stage 2: Wait for /api/health ready:true
if [ "$PORT_LISTENING" = "true" ]; then
    HEALTH_URL="${BASE_URL}/api/health"
    for i in $(seq 1 "$READY_TIMEOUT"); do
        sleep 1

        if [ -n "$GW_PID" ] && ! kill -0 "$GW_PID" 2>/dev/null; then
            fail "Gateway crashed during health wait"
            GW_PID=""
            break
        fi

        HEALTH=$(curl -sf --connect-timeout 3 --max-time 5 "$HEALTH_URL" 2>/dev/null || true)
        if [ -n "$HEALTH" ]; then
            # Parse JSON using node (curl on macOS doesn't have jq by default)
            HEALTH_OK=$("$NODE_BIN" -pe "JSON.parse('$(echo "$HEALTH" | sed "s/'/\\\\'/g")').ok" 2>/dev/null || echo "")
            HEALTH_READY=$("$NODE_BIN" -pe "JSON.parse('$(echo "$HEALTH" | sed "s/'/\\\\'/g")').ready" 2>/dev/null || echo "")

            if [ "$HEALTH_OK" = "true" ] && [ "$HEALTH_READY" = "true" ]; then
                HEALTH_PID=$("$NODE_BIN" -pe "JSON.parse('$(echo "$HEALTH" | sed "s/'/\\\\'/g")').pid||'?'" 2>/dev/null || echo "?")
                HEALTH_PHASE=$("$NODE_BIN" -pe "JSON.parse('$(echo "$HEALTH" | sed "s/'/\\\\'/g")').phase||'?'" 2>/dev/null || echo "?")
                pass "Gateway ready (${i}s, PID:${HEALTH_PID}, phase:${HEALTH_PHASE})"
                GATEWAY_READY=true
                break
            fi
        fi
    done

    if [ "$GATEWAY_READY" = "false" ] && [ -n "$GW_PID" ] && kill -0 "$GW_PID" 2>/dev/null; then
        fail "Gateway not ready after ${READY_TIMEOUT}s timeout"
    fi
fi

# ============================================================================
# Phase 3: HTTP Endpoint Verification
# ============================================================================
phase "Phase 3: HTTP Endpoints"

if [ "$GATEWAY_READY" = "true" ]; then
    # 3a. Health API
    HEALTH=$(curl -sf "${BASE_URL}/api/health" 2>/dev/null || true)
    if [ -n "$HEALTH" ]; then
        H_OK=$("$NODE_BIN" -pe "JSON.parse('$(echo "$HEALTH" | sed "s/'/\\\\'/g")').ok" 2>/dev/null || echo "")
        H_READY=$("$NODE_BIN" -pe "JSON.parse('$(echo "$HEALTH" | sed "s/'/\\\\'/g")').ready" 2>/dev/null || echo "")
        if [ "$H_OK" = "true" ] && [ "$H_READY" = "true" ]; then
            pass "GET /api/health (ok:true, ready:true)"
        else
            fail "GET /api/health unexpected: ok=$H_OK ready=$H_READY"
        fi
    else
        fail "GET /api/health: no response"
    fi

    # 3b. Control UI HTML
    UI_RESPONSE=$(curl -sf "${BASE_URL}/?token=${TOKEN}" 2>/dev/null || true)
    UI_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "${BASE_URL}/?token=${TOKEN}" 2>/dev/null || echo "0")
    if [ "$UI_CODE" = "200" ] && echo "$UI_RESPONSE" | grep -q '<html'; then
        UI_LEN=${#UI_RESPONSE}
        pass "Control UI HTML ($UI_LEN bytes)"
    else
        fail "Control UI: status=$UI_CODE, html tag not found"
    fi

    # 3c. Setup page
    SETUP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" -L "${BASE_URL}/setup?token=${TOKEN}" 2>/dev/null || echo "0")
    if [ "$SETUP_CODE" = "200" ] || [ "$SETUP_CODE" = "301" ] || [ "$SETUP_CODE" = "302" ]; then
        pass "Setup wizard page ($SETUP_CODE)"
    else
        fail "Setup page: status=$SETUP_CODE"
    fi

    # 3d. Shutdown auth protection (no token should be rejected)
    SHUTDOWN_CODE=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/shutdown" 2>/dev/null || echo "0")
    if [ "$SHUTDOWN_CODE" = "401" ] || [ "$SHUTDOWN_CODE" = "403" ]; then
        pass "Shutdown auth protection ($SHUTDOWN_CODE)"
    elif [ "$SHUTDOWN_CODE" = "000" ] || [ "$SHUTDOWN_CODE" = "0" ]; then
        # curl returns 000 on connection error — try without -sf
        SHUTDOWN_CODE2=$(curl -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/shutdown" 2>/dev/null || echo "0")
        if [ "$SHUTDOWN_CODE2" = "401" ] || [ "$SHUTDOWN_CODE2" = "403" ]; then
            pass "Shutdown auth protection ($SHUTDOWN_CODE2)"
        else
            fail "Shutdown protection: unexpected status $SHUTDOWN_CODE2"
        fi
    else
        fail "Shutdown accepted without auth (status: $SHUTDOWN_CODE)"
    fi
else
    fail "Skipping HTTP tests (Gateway not ready)"
fi

# ============================================================================
# Phase 4: WebSocket Protocol Connectivity
# ============================================================================
phase "Phase 4: WebSocket Protocol"

if [ "$GATEWAY_READY" = "true" ] && [ "$SKIP_WEBSOCKET" = "false" ]; then
    # Generate temporary JS file for WebSocket smoke test
    WS_FILE="/tmp/clawdbot-ws-smoke-$$.js"
    cat > "$WS_FILE" << WSEOF
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:${PORT}');
const timeout = setTimeout(() => { console.log('WS_TIMEOUT'); process.exit(1); }, 20000);

ws.on('open', () => {
    ws.send(JSON.stringify({
        type: 'req', id: 'c1', method: 'connect',
        params: {
            minProtocol: 3, maxProtocol: 3,
            client: { id: 'post-build-smoke', version: 'test',
                      platform: 'darwin', mode: 'cli',
                      instanceId: 'smoke-' + Date.now() },
            locale: 'zh-CN', userAgent: 'post-build-validation',
            role: 'operator',
            scopes: ['operator.read', 'operator.write'],
            caps: [],
            auth: { token: '${TOKEN}' }
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
WSEOF

    # Run the WebSocket test with the app's node (ensures ws module is available)
    WS_OUTPUT=$("$NODE_BIN" "$WS_FILE" 2>&1)
    WS_EXIT=$?
    rm -f "$WS_FILE"

    if [ $WS_EXIT -eq 0 ] && echo "$WS_OUTPUT" | grep -q 'WS_SMOKE_OK'; then
        pass "WebSocket connect + health"
    else
        fail "WebSocket test (exit:$WS_EXIT): $WS_OUTPUT"
    fi
elif [ "$SKIP_WEBSOCKET" = "true" ]; then
    info "Skipping WebSocket test (--skip-websocket)"
else
    fail "Skipping WebSocket test (Gateway not ready)"
fi

# ============================================================================
# Phase 5: Cleanup
# ============================================================================
phase "Phase 5: Cleanup"

# 5a. Graceful shutdown
if [ -n "$GW_PID" ] && kill -0 "$GW_PID" 2>/dev/null; then
    SHUTDOWN_OK=false

    # Try POST /api/shutdown with token
    curl -sf -X POST "${BASE_URL}/api/shutdown" \
        -H "x-openclawcn-token: $TOKEN" \
        --connect-timeout 3 --max-time 5 2>/dev/null || true

    # Wait up to 8 seconds for graceful exit
    for i in $(seq 1 8); do
        if ! kill -0 "$GW_PID" 2>/dev/null; then
            SHUTDOWN_OK=true
            break
        fi
        sleep 1
    done

    if [ "$SHUTDOWN_OK" = "true" ]; then
        pass "Gateway shutdown (graceful)"
    else
        # Force kill as fallback
        kill -9 "$GW_PID" 2>/dev/null || true
        sleep 1
        pass "Gateway shutdown (forced)"
    fi
    GW_PID=""
else
    info "Gateway already exited"
fi

# 5b. Clean up test state directory
if [ -d "$TEST_STATE_DIR" ]; then
    rm -rf "$TEST_STATE_DIR" 2>/dev/null || true
    if [ ! -d "$TEST_STATE_DIR" ]; then
        pass "Test data cleaned"
    else
        info "Warning: Could not fully clean $TEST_STATE_DIR"
    fi
else
    pass "Test data cleaned (no state dir created)"
fi

# 5c. Optional cleanup of test app
if [ "$CLEANUP" = "true" ]; then
    if [ -n "$INSTALL_DIR" ] && [ -d "$INSTALL_DIR" ] && [ "$INSTALL_DIR" != "$APP_DIR" ]; then
        rm -rf "$INSTALL_DIR" 2>/dev/null || true
        info "Test install directory removed: $INSTALL_DIR"
    fi
fi

# ============================================================================
# Restore environment
# ============================================================================
export PATH="$ORIGINAL_PATH"
unset OPENCLAWCN_STATE_DIR 2>/dev/null || true
unset OPENCLAWCN_BUNDLED_PLUGINS_DIR 2>/dev/null || true
unset OPENCLAWCN_BUNDLED_SKILLS_DIR 2>/dev/null || true
unset OPENCLAWCN_BUNDLED_TOOLS_DIR 2>/dev/null || true
unset OPENCLAWCN_GATEWAY_TOKEN 2>/dev/null || true
unset OPENCLAWCN_REGION 2>/dev/null || true

# ============================================================================
# Summary
# ============================================================================
TOTAL_TESTS=$((PASS_COUNT + FAIL_COUNT))
ELAPSED=$(( $(date +%s) - SCRIPT_START ))

if [ "$FAIL_COUNT" -eq 0 ]; then
    COLOR="\033[32m"  # green
else
    COLOR="\033[31m"  # red
fi
RESET="\033[0m"

echo ""
echo -e "${COLOR}========================================${RESET}"
echo -e "${COLOR}  Post-Build Validation Results${RESET}"
echo -e "${COLOR}========================================${RESET}"
echo "  Total:  $TOTAL_TESTS tests"
echo -e "  Passed: \033[32m$PASS_COUNT${RESET}"
if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "  Failed: \033[32m$FAIL_COUNT${RESET}"
else
    echo -e "  Failed: \033[31m$FAIL_COUNT${RESET}"
fi
echo "  Time:   ${ELAPSED}s"
echo -e "${COLOR}========================================${RESET}"
echo ""

# Write report file
REPORT_PATH="$LOG_DIR/validation-report.txt"
{
    for line in "${REPORT_LINES[@]}"; do
        echo "$line"
    done
    echo ""
    echo "========================================"
    echo "  Post-Build Validation Results"
    echo "========================================"
    echo "  Total:  $TOTAL_TESTS tests"
    echo "  Passed: $PASS_COUNT"
    echo "  Failed: $FAIL_COUNT"
    echo "  Time:   ${ELAPSED}s"
    echo "========================================"
} > "$REPORT_PATH"
info "Report saved to: $REPORT_PATH"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
else
    exit 0
fi
