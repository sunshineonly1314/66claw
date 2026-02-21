#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# OpenClawCN macOS Build Script
#
# Creates a ClawdbotCN.app bundle with CN-only selective encryption:
#   - build:secure → TypeScript + CN-only RC4 obfuscation + integrity hashes
#   - V8 bytecode compilation for bytecode-tier CN files
#   - Integrity hash regeneration (post-bytecode)
#   - .app bundle creation with shell launcher
#   - Optional code signing + DMG creation
#
# Called by: .github/workflows/build-macos-cn.yml
#
# Usage:
#   bash build/scripts/build-macos-cn.sh [--arch universal|arm64|x64] [--jobs N] [--fast]
#
# Environment variables:
#   VERSION          - Version string (default: from package.json)
#   SIGN_IDENTITY    - Signing identity (default: ad-hoc)
#   SKIP_NOTARIZE    - Set to "1" to skip notarization (default: 1)
#   JOBS             - Parallel jobs (default: $(sysctl -n hw.ncpu))
#   USE_CN           - Use CN mirrors for Node download (default: auto)
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/build/output"
BUILD_LOG="$OUTPUT_DIR/build.log"

# Node.js version (must match the version used in CI and Windows builds)
NODE_VERSION="${NODE_VERSION:-22.16.0}"

# ── Parse arguments ──────────────────────────────────────────────────────────

ARCH="${ARCH:-universal}"
FAST_MODE="${FAST_MODE:-false}"
JOBS="${JOBS:-$(sysctl -n hw.ncpu 2>/dev/null || echo 4)}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --arch) ARCH="$2"; shift 2 ;;
    --jobs) JOBS="$2"; shift 2 ;;
    --fast) FAST_MODE="true"; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# Validate ARCH early — reject invalid values before any build work starts.
# Common mistake: CI passes "standard" (Windows build mode) instead of an arch.
case "$ARCH" in
  universal|arm64|x64) ;;
  *)
    echo "ERROR: Invalid architecture '$ARCH'. Must be one of: universal, arm64, x64" >&2
    echo "  Hint: 'standard' is a Windows build mode, not a macOS architecture." >&2
    exit 1
    ;;
esac

# ── Helpers ──────────────────────────────────────────────────────────────────

log() { echo "[$(date '+%H:%M:%S')] $*"; }
log_step() { echo ""; echo "═══════════════════════════════════════════════════════"; echo "  $*"; echo "═══════════════════════════════════════════════════════"; }
warn() { echo "WARN: $*" >&2; }
err() { echo "ERROR: $*" >&2; }

elapsed_since() {
  local start="$1"
  local now
  now=$(date +%s)
  local diff=$((now - start))
  echo "${diff}s"
}

# ── select_npm_registry: probe CN mirrors and pick the fastest reachable one ──
select_npm_registry() {
  local registries=(
    "https://registry.npmmirror.com"
    "https://registry.npm.taobao.org"
    "https://registry.npmjs.org"
  )
  for reg in "${registries[@]}"; do
    if curl -sf --connect-timeout 5 --max-time 8 "$reg/-/ping" >/dev/null 2>&1; then
      echo "$reg"
      return
    fi
  done
  echo "https://registry.npmjs.org"
}

# ── Setup ────────────────────────────────────────────────────────────────────

mkdir -p "$OUTPUT_DIR"
cd "$ROOT_DIR"

VERSION="${VERSION:-$(node -p "require('./package.json').version" 2>/dev/null || echo "0.0.0")}"
APP_NAME="ClawdbotCN"
BUNDLE_ID="cn.openclawcn.mac"

# ── Preflight: disk space check ──
DISK_FREE_MB=$(df -m "$OUTPUT_DIR" 2>/dev/null | awk 'NR==2{print $4}')
if [[ -n "$DISK_FREE_MB" ]] && [[ "$DISK_FREE_MB" -lt 3000 ]]; then
  err "Insufficient disk space: ${DISK_FREE_MB}MB free (need >=3GB)"
  err "Suggestion: rm -rf $OUTPUT_DIR/* build/download-output/*"
  exit 1
fi

# ── Preflight: select npm registry ──
NPM_REGISTRY=$(select_npm_registry)

log "OpenClawCN macOS Build"
log "  Version: $VERSION"
log "  Arch: $ARCH"
log "  Jobs: $JOBS"
log "  Fast mode: $FAST_MODE"
log "  Node.js: v$NODE_VERSION"
log "  Root: $ROOT_DIR"
log "  Disk free: ${DISK_FREE_MB:-unknown}MB"
log "  npm registry: $NPM_REGISTRY"
log ""

# ============================================================================
# Step 1: Install dependencies
# ============================================================================
log_step "Step 1: Install dependencies"
STEP_START=$(date +%s)

if [[ -d "node_modules" ]] && [[ "$FAST_MODE" == "true" ]]; then
  log "Fast mode: skipping npm install (node_modules exists)"
else
  pnpm install --no-frozen-lockfile --ignore-scripts=false 2>&1 || \
    pnpm install --ignore-scripts=false 2>&1
fi
log "Dependencies installed ($(elapsed_since $STEP_START))"

# ============================================================================
# Step 1.5: Pre-flight source file check
# ============================================================================
# Verify critical CN source files exist before starting the expensive build.
# Catches common issues: incomplete git push to Gitee, missing new files.
log "Pre-flight check: verifying critical source files..."
PREFLIGHT_FAIL=0
for src_check in \
  src/agents/tools/wechat-send.ts \
  src/agents/tools/wechat-check.ts \
  src/config/cn-mirrors-data.ts \
  src/config/region-cn.ts \
  src/dispatch/engine.ts \
  cn/scripts/build/compile-bytecode.ts \
  cn/scripts/build/obfuscate.config.js \
  config/cn-protected-files.json; do
  if [[ ! -f "$ROOT_DIR/$src_check" ]]; then
    err "Missing critical source file: $src_check"
    PREFLIGHT_FAIL=1
  fi
done
if [[ "$PREFLIGHT_FAIL" -eq 1 ]]; then
  err "Pre-flight check failed. Ensure all CN source files are pushed to the repository."
  exit 1
fi
log "Pre-flight check passed"

# ============================================================================
# Step 2: Build with CN-only encryption
# ============================================================================
log_step "Step 2: build:secure (TypeScript + CN-only obfuscation + integrity)"
STEP_START=$(date +%s)

# build:secure = pnpm build + build:cn-compile + build:cn-extensions
#              + obfuscate-dist.ts + compile-bytecode.ts + integrity:gen + release:changelog
# 已经包含了 bytecode 编译和 integrity 生成，不需要再单独调用
pnpm build:secure 2>&1
log "build:secure completed ($(elapsed_since $STEP_START))"

# Verify .jsc bytecode files were produced
JSC_COUNT=$(find "$ROOT_DIR/dist" -name "*.jsc" 2>/dev/null | wc -l | tr -d ' ')
log "Bytecode verification: found $JSC_COUNT .jsc files in dist/"
if [[ "$JSC_COUNT" -lt 5 ]]; then
  err "Expected at least 5 .jsc files in dist/, found $JSC_COUNT"
  err "Bytecode compilation may have failed. Check build:secure output above."
  exit 1
fi

# ============================================================================
# Step 3: Build UI
# ============================================================================
log_step "Step 3: Build Web UI"
STEP_START=$(date +%s)

pnpm ui:build 2>&1
log "UI build completed ($(elapsed_since $STEP_START))"

# ── Step 3b: Obfuscate UI bundles ──
log "Obfuscating UI bundles..."
node --import tsx cn/scripts/build/obfuscate-ui.ts 2>&1
log "UI obfuscation completed"

# ============================================================================
# Step 4: Download Node.js binaries
# ============================================================================
log_step "Step 4: Download Node.js binaries"
STEP_START=$(date +%s)

NODE_DL_DIR="$ROOT_DIR/build/download-output/node"
mkdir -p "$NODE_DL_DIR"

download_node() {
  local arch="$1"
  local filename="node-v${NODE_VERSION}-darwin-${arch}.tar.gz"
  local tar_file="$NODE_DL_DIR/$filename"
  local extract_dir="$NODE_DL_DIR/node-${arch}"

  if [[ -f "$extract_dir/bin/node" ]]; then
    log "Node.js $arch already downloaded"
    return
  fi

  # CN mirror first, then upstream — mirrors may be faster or the only route in CN network
  local mirrors=(
    "https://npmmirror.com/mirrors/node/v${NODE_VERSION}/$filename"
    "https://nodejs.org/dist/v${NODE_VERSION}/$filename"
  )

  local ok=false
  for url in "${mirrors[@]}"; do
    log "Downloading Node.js v${NODE_VERSION} for $arch from ${url%%/node*}..."
    if curl -fSL --connect-timeout 15 --max-time 300 --retry 2 "$url" -o "$tar_file" 2>/dev/null; then
      # Verify download is a valid gzip
      if gzip -t "$tar_file" 2>/dev/null; then
        ok=true
        break
      else
        warn "Downloaded file is corrupt, trying next mirror..."
        rm -f "$tar_file"
      fi
    else
      warn "Download failed from ${url%%/v*}, trying next mirror..."
      rm -f "$tar_file"
    fi
  done

  if [[ "$ok" != "true" ]]; then
    err "Failed to download Node.js v${NODE_VERSION} for $arch from all mirrors"
    exit 1
  fi

  mkdir -p "$extract_dir"
  tar -xzf "$tar_file" -C "$extract_dir" --strip-components=1
  rm -f "$tar_file"
  log "Node.js $arch downloaded and extracted"
}

case "$ARCH" in
  universal)
    # Download arm64 and x64 in parallel
    download_node "arm64" &
    PID_ARM64=$!
    download_node "x64" &
    PID_X64=$!
    DOWNLOAD_FAIL=0
    wait $PID_ARM64 || DOWNLOAD_FAIL=1
    wait $PID_X64   || DOWNLOAD_FAIL=1
    if [[ "$DOWNLOAD_FAIL" -eq 1 ]]; then
      err "One or more Node.js downloads failed"
      exit 1
    fi
    ;;
  arm64)
    download_node "arm64"
    ;;
  x64)
    download_node "x64"
    ;;
esac

log "Node.js download completed ($(elapsed_since $STEP_START))"

# ============================================================================
# Step 5: Create .app bundle
# ============================================================================
log_step "Step 5: Create $APP_NAME.app bundle"
STEP_START=$(date +%s)

APP_DIR="$OUTPUT_DIR/${APP_NAME}.app"
CONTENTS="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"
APP_ROOT="$RESOURCES/app"

rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES/node/bin"
mkdir -p "$APP_ROOT"

# ── Info.plist ──
cat > "$CONTENTS/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleDisplayName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleIdentifier</key>
    <string>${BUNDLE_ID}</string>
    <key>CFBundleVersion</key>
    <string>${VERSION}</string>
    <key>CFBundleShortVersionString</key>
    <string>${VERSION}</string>
    <key>CFBundleExecutable</key>
    <string>${APP_NAME}</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <false/>
    <key>NSHumanReadableCopyright</key>
    <string>OpenClawCN ${VERSION}</string>
    <key>NSAppleEventsUsageDescription</key>
    <string>ClawdbotCN needs Automation access to open browsers and interact with applications.</string>
    <key>NSCameraUsageDescription</key>
    <string>ClawdbotCN uses the camera for visual recognition features.</string>
    <key>NSMicrophoneUsageDescription</key>
    <string>ClawdbotCN uses the microphone for voice input features.</string>
    <key>NSScreenCaptureUsageDescription</key>
    <string>ClawdbotCN uses screen capture for desktop automation features.</string>
    <key>NSLocationUsageDescription</key>
    <string>ClawdbotCN may use location for weather and region-aware features.</string>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoadsInWebContent</key>
        <true/>
        <key>NSAllowsLocalNetworking</key>
        <true/>
    </dict>
</dict>
</plist>
PLIST

echo -n "APPL????" > "$CONTENTS/PkgInfo"

# ── Launcher script ──
cat > "$MACOS_DIR/${APP_NAME}" <<'LAUNCHER'
#!/bin/bash
set -euo pipefail

MACOS_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES="$MACOS_DIR/../Resources"
NODE_BIN="$RESOURCES/node/bin/node"
APP_DIR="$RESOURCES/app"
TOOLS_DIR="$RESOURCES/tools"
STATE_DIR="$HOME/Library/Application Support/OpenClawCN"
LOG_DIR="$HOME/Library/Logs/OpenClawCN"
PORT=18789

export PATH="$RESOURCES/node/bin:${TOOLS_DIR:-}:$PATH"

# First-launch fix: clear quarantine attributes
if ! "$NODE_BIN" --version >/dev/null 2>&1; then
    xattr -cr "$RESOURCES" 2>/dev/null || true
    chmod +x "$NODE_BIN" 2>/dev/null || true
    [ -d "$TOOLS_DIR" ] && chmod +x "$TOOLS_DIR"/* 2>/dev/null || true

    if [ "$(uname -m)" = "arm64" ]; then
        codesign --sign - --force "$NODE_BIN" 2>/dev/null || true
        if [ -d "$TOOLS_DIR" ]; then
            for tool in "$TOOLS_DIR"/*; do
                [ -f "$tool" ] && codesign --sign - --force "$tool" 2>/dev/null || true
            done
        fi
    fi

    if ! "$NODE_BIN" --version >/dev/null 2>&1; then
        osascript -e 'display dialog "Node.js runtime initialization failed.\n\nTry running in Terminal:\nxattr -cr /Applications/ClawdbotCN.app" with title "ClawdbotCN" buttons {"OK"} default button 1 with icon stop' 2>/dev/null || true
        exit 1
    fi
fi

mkdir -p "$STATE_DIR/config" 2>/dev/null || true
mkdir -p "$STATE_DIR/data" 2>/dev/null || true
mkdir -p "$LOG_DIR" 2>/dev/null || true

export OPENCLAWCN_BUNDLED_SKILLS_DIR="$APP_DIR/skills"
export OPENCLAWCN_BUNDLED_TOOLS_DIR="${TOOLS_DIR:-}"
export OPENCLAWCN_BUNDLED_PLUGINS_DIR="$APP_DIR/extensions"
export OPENCLAWCN_STATE_DIR="$STATE_DIR"
export OPENCLAWCN_DESKTOP_MODE=1
export NODE_ENV=production

# Read our own version
OWN_VERSION=""
if [ -f "$APP_DIR/package.json" ]; then
    OWN_VERSION=$("$NODE_BIN" -pe "require('$APP_DIR/package.json').version" 2>/dev/null || echo "")
fi

if lsof -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    # Check if running instance is same version — if so, just open browser
    RUNNING_VERSION=$(curl -sf --connect-timeout 2 "http://localhost:$PORT/api/health" \
        | "$NODE_BIN" -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).version" 2>/dev/null || echo "")
    if [ -n "$RUNNING_VERSION" ] && [ "$RUNNING_VERSION" = "$OWN_VERSION" ]; then
        open "http://localhost:$PORT/"
        exit 0
    fi
    # Different version or cannot determine — stop old process for upgrade
    echo "$(date) Stopping old instance (v${RUNNING_VERSION:-unknown}) for upgrade to v${OWN_VERSION}..." >> "$LOG_DIR/gateway.log"
    OLD_PIDS=$(lsof -ti ":$PORT" 2>/dev/null || true)
    if [ -n "$OLD_PIDS" ]; then
        echo "$OLD_PIDS" | xargs kill -TERM 2>/dev/null || true
        sleep 2
        # Force-kill if still alive
        REMAINING=$(lsof -ti ":$PORT" 2>/dev/null || true)
        if [ -n "$REMAINING" ]; then
            echo "$REMAINING" | xargs kill -9 2>/dev/null || true
            sleep 1
        fi
    fi
fi

cd "$APP_DIR"
(sleep 3 && open "http://localhost:$PORT/setup") &
exec "$NODE_BIN" dist/entry.js gateway run --port "$PORT" \
    >> "$LOG_DIR/gateway.log" 2>> "$LOG_DIR/gateway-error.log"
LAUNCHER
chmod +x "$MACOS_DIR/${APP_NAME}"

# ── Copy app icon ──
ICON_SRC="$ROOT_DIR/apps/macos/Sources/Clawdbot/Resources/Clawdbot.icns"
if [[ -f "$ICON_SRC" ]]; then
  cp "$ICON_SRC" "$RESOURCES/AppIcon.icns"
fi

# ── Copy Node.js binary ──
case "$ARCH" in
  universal)
    if [[ -f "$NODE_DL_DIR/node-arm64/bin/node" ]] && [[ -f "$NODE_DL_DIR/node-x64/bin/node" ]]; then
      log "Creating universal Node.js binary with lipo..."
      lipo -create \
        "$NODE_DL_DIR/node-arm64/bin/node" \
        "$NODE_DL_DIR/node-x64/bin/node" \
        -output "$RESOURCES/node/bin/node"
    else
      err "Both arm64 and x64 Node binaries required for universal build"
      exit 1
    fi
    ;;
  arm64)
    cp "$NODE_DL_DIR/node-arm64/bin/node" "$RESOURCES/node/bin/node"
    ;;
  x64)
    cp "$NODE_DL_DIR/node-x64/bin/node" "$RESOURCES/node/bin/node"
    ;;
esac
chmod +x "$RESOURCES/node/bin/node"

# ── Copy app dist (includes .jsc bytecode files) ──
cp -R "$ROOT_DIR/dist" "$APP_ROOT/dist"

# Verify .jsc files were copied into the .app bundle
APP_JSC_COUNT=$(find "$APP_ROOT/dist" -name "*.jsc" 2>/dev/null | wc -l | tr -d ' ')
log "Copied dist/ to .app: $APP_JSC_COUNT .jsc files present"
if [[ "$APP_JSC_COUNT" -lt 5 ]]; then
  err "Expected .jsc files in $APP_ROOT/dist/, found $APP_JSC_COUNT"
  err "Check that build:secure completed before this step."
  exit 1
fi

# ── V8 bytecode compatibility verification ──
# Test-load a .jsc file with the bundled Node binary to catch V8 version mismatch early.
# If system Node (used for compile-bytecode.ts) has a different V8 than bundled Node,
# the .jsc files will fail to load at runtime with an unreadable error.
TEST_JSC=$(find "$APP_ROOT/dist" -name "*.jsc" -print -quit 2>/dev/null)
if [[ -n "$TEST_JSC" ]]; then
  log "Verifying V8 bytecode compatibility with bundled Node..."
  if "$RESOURCES/node/bin/node" -e "require('bytenode');require('$TEST_JSC')" 2>/dev/null; then
    log "V8 bytecode compatibility OK"
  else
    # Try loading bytenode from project root (not yet installed in APP_ROOT)
    if "$RESOURCES/node/bin/node" -e "
      const Module = require('module');
      const origResolve = Module._resolveFilename;
      Module._resolveFilename = function(req, parent, isMain, opts) {
        if (req === 'bytenode') return require.resolve('$ROOT_DIR/node_modules/bytenode');
        return origResolve.call(this, req, parent, isMain, opts);
      };
      require('bytenode'); require('$TEST_JSC');
    " 2>/dev/null; then
      log "V8 bytecode compatibility OK (via project bytenode)"
    else
      err "V8 bytecode INCOMPATIBLE: bundled Node v${NODE_VERSION} cannot load .jsc files!"
      err "The system Node that compiled bytecode may have a different V8 version."
      err "Fix: ensure compile-bytecode.ts uses the same Node version as NODE_VERSION=${NODE_VERSION}"
      exit 1
    fi
  fi
fi

# ── Copy package.json (simplified) ──
node -e "
  const pkg = require('./package.json');
  const newPkg = {
    name: pkg.name,
    version: pkg.version,
    type: pkg.type,
    main: pkg.main,
    dependencies: pkg.dependencies
  };
  console.log(JSON.stringify(newPkg, null, 2));
" > "$APP_ROOT/package.json"

# ── Copy extensions ──
if [[ -d "$ROOT_DIR/extensions" ]]; then
  log "Copying extensions..."
  mkdir -p "$APP_ROOT/extensions"
  rsync -a --exclude='node_modules' --exclude='*.test.ts' --exclude='.git' \
    "$ROOT_DIR/extensions/" "$APP_ROOT/extensions/" 2>/dev/null || \
    cp -R "$ROOT_DIR/extensions" "$APP_ROOT/" 2>/dev/null || true
fi

# ── Copy skills ──
if [[ -d "$ROOT_DIR/skills" ]]; then
  log "Copying skills..."
  cp -R "$ROOT_DIR/skills" "$APP_ROOT/skills"
fi

# ── Verify UI dist (built by pnpm ui:build into dist/control-ui/, already copied with dist/) ──
if [[ -f "$APP_ROOT/dist/control-ui/index.html" ]]; then
  UI_SIZE=$(du -sh "$APP_ROOT/dist/control-ui/" 2>/dev/null | awk '{print $1}')
  log "Web UI verified: dist/control-ui/index.html present ($UI_SIZE)"
else
  err "Web UI missing! dist/control-ui/index.html not found in .app bundle."
  err "Check that 'pnpm ui:build' completed successfully in Step 3."
  err "Expected output: $ROOT_DIR/dist/control-ui/index.html"
  exit 1
fi

# ── Copy assets ──
if [[ -d "$ROOT_DIR/assets" ]]; then
  mkdir -p "$APP_ROOT/assets"
  cp -R "$ROOT_DIR/assets" "$APP_ROOT/" 2>/dev/null || true
fi

# ── Copy data (MCP index) ──
mkdir -p "$APP_ROOT/data"
if [[ -d "$ROOT_DIR/data" ]]; then
  cp -R "$ROOT_DIR/data/"* "$APP_ROOT/data/" 2>/dev/null || true
fi
# Verify mcp-index data was bundled (CI uploads data/ via SCP before build).
# Without it, MCP marketplace will be empty until runtime sync.
if [[ -f "$APP_ROOT/data/mcp-index.json" ]]; then
  MCP_ITEMS=$(node -pe "JSON.parse(require('fs').readFileSync('$APP_ROOT/data/mcp-index.json','utf8')).items?.length||0" 2>/dev/null || echo 0)
  log "MCP index bundled: $MCP_ITEMS items"
  if [[ -f "$APP_ROOT/data/mcp-index-enhanced.json" ]]; then
    log "MCP enhanced index bundled (with Chinese translations)"
  fi
else
  warn "mcp-index.json not found in data/ — MCP marketplace will be empty on first launch!"
  warn "Ensure CI uploads data/ files before build (ci/build-macos.sh handles this)."
  # Create minimal fallback so Gateway doesn't error on startup
  echo '{"items":[],"generated":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","seed":true}' \
    > "$APP_ROOT/data/mcp-index.json"
fi

# ── Uninstall helper ──
cat > "$RESOURCES/uninstall.sh" <<'UNINSTALL'
#!/bin/bash
echo "Removing ClawdbotCN..."
rm -rf "/Applications/ClawdbotCN.app"
rm -rf "$HOME/Library/Application Support/OpenClawCN"
rm -rf "$HOME/Library/Logs/OpenClawCN"
echo "ClawdbotCN has been removed."
UNINSTALL
chmod +x "$RESOURCES/uninstall.sh"

# ── Version info (written to both Resources/ and app/ for broad compatibility) ──
VERSION_JSON="{
  \"version\": \"${VERSION}\",
  \"arch\": \"${ARCH}\",
  \"platform\": \"darwin\",
  \"buildDate\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
  \"nodeVersion\": \"${NODE_VERSION}\"
}"
echo "$VERSION_JSON" > "$RESOURCES/version.json"
echo "$VERSION_JSON" > "$APP_ROOT/version.json"

# ── Build metadata (V8 version guard for delta updates) ──
NODE_V8_VERSION=$("$RESOURCES/node/bin/node" -e "console.log(process.versions.v8)" 2>/dev/null || echo "unknown")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
cat > "$APP_ROOT/build-meta.json" <<BMETA
{
  "nodeVersion": "${NODE_VERSION}",
  "v8Version": "${NODE_V8_VERSION}",
  "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "appVersion": "${VERSION}",
  "arch": "${ARCH}",
  "gitCommit": "${GIT_COMMIT}"
}
BMETA
log "build-meta.json: Node ${NODE_VERSION}, V8 ${NODE_V8_VERSION}, commit ${GIT_COMMIT}"

# ── Install marker (for auto-update detection) ──
UPDATE_SERVER="${OPENCLAWCN_UPDATE_SERVER:-https://dl.obplugins.cn}"
cat > "$APP_ROOT/install.json" <<INSTALL_MARKER
{
  "version": "${VERSION}",
  "installTime": "$(date -u +"%Y-%m-%d %H:%M:%S")",
  "firstLaunch": true,
  "updateServer": "${UPDATE_SERVER}"
}
INSTALL_MARKER

log ".app bundle structure created ($(elapsed_since $STEP_START))"

# ============================================================================
# Step 6: Install production dependencies
# ============================================================================
log_step "Step 6: Install production dependencies"
STEP_START=$(date +%s)

cd "$APP_ROOT"

# Exclude large optional packages not needed in macOS desktop bundle
node -e "
  const pkg = require('./package.json');
  const excludeDeps = [
    // Native modules not needed in desktop bundle
    'node-llama-cpp', '@napi-rs/canvas', 'playwright-core',
    '@lydell/node-pty', 'sqlite-vec', 'sharp',
    // Dev/test tools that may leak into dependencies
    'oxlint', 'oxfmt', 'oxlint-tsgolint',
  ];
  const deps = {...pkg.dependencies};
  excludeDeps.forEach(d => delete deps[d]);
  pkg.dependencies = deps;
  delete pkg.optionalDependencies;
  console.log(JSON.stringify(pkg, null, 2));
" > package.json.tmp && mv package.json.tmp package.json

# Find npm-cli.js from downloaded Node.js (not system npm, to avoid version mismatch)
NPM_CLI=""
for try_arch in arm64 x64; do
  NPM_CANDIDATE="$NODE_DL_DIR/node-${try_arch}/lib/node_modules/npm/bin/npm-cli.js"
  if [[ -f "$NPM_CANDIDATE" ]]; then
    NPM_CLI="$NPM_CANDIDATE"
    break
  fi
done
if [[ -z "$NPM_CLI" ]]; then
  NPM_CLI="$(which npm 2>/dev/null || true)"
fi
if [[ -z "$NPM_CLI" ]]; then
  err "Cannot find npm binary for production install"
  exit 1
fi
log "Using npm: $NPM_CLI"

# Use bundled Node for npm install (matches runtime) — with retry + exponential backoff
NPM_MAX_RETRIES=3
NPM_INSTALL_OK=false
for npm_attempt in $(seq 1 $NPM_MAX_RETRIES); do
  log "npm install attempt $npm_attempt/$NPM_MAX_RETRIES (registry: $NPM_REGISTRY)..."
  if "$RESOURCES/node/bin/node" "$NPM_CLI" \
    install --omit=dev --ignore-scripts --no-audit --no-fund \
    --registry "$NPM_REGISTRY" 2>&1; then
    NPM_INSTALL_OK=true
    break
  fi
  if [[ $npm_attempt -eq $NPM_MAX_RETRIES ]]; then
    break
  fi
  sleep_time=$((3 ** npm_attempt))
  warn "npm install attempt $npm_attempt failed, retrying in ${sleep_time}s..."
  rm -rf node_modules 2>/dev/null || true
  "$RESOURCES/node/bin/node" "$NPM_CLI" cache clean --force 2>/dev/null || true
  sleep $sleep_time
done
if [[ "$NPM_INSTALL_OK" != "true" ]]; then
  err "npm install --omit=dev failed after $NPM_MAX_RETRIES attempts"
  err "Troubleshooting: curl -v $NPM_REGISTRY/-/ping"
  exit 1
fi

# Verify critical runtime dependencies are present
CRITICAL_DEPS=(
  "@aws-sdk/client-bedrock"
  "@aws-sdk/client-bedrock-runtime"
  "express"
  "zod"
  "bytenode"
)
for dep in "${CRITICAL_DEPS[@]}"; do
  if [[ ! -d "node_modules/$dep" ]]; then
    err "CRITICAL: $dep missing from production node_modules!"
    err "  This will cause Gateway startup failure. Aborting build."
    exit 1
  fi
done
log "Critical deps verified: ${CRITICAL_DEPS[*]}"

# Aggressive node_modules cleanup
if [[ "$FAST_MODE" != "true" ]]; then
  log "Cleaning up node_modules..."
  find node_modules -name "*.md" -delete 2>/dev/null || true
  find node_modules -name "*.ts" ! -name "*.d.ts" -delete 2>/dev/null || true
  find node_modules -name "*.map" -delete 2>/dev/null || true
  find node_modules -name "LICENSE*" -delete 2>/dev/null || true
  find node_modules -name "CHANGELOG*" -delete 2>/dev/null || true
  find node_modules -name "HISTORY*" -delete 2>/dev/null || true
  find node_modules -name "CONTRIBUTING*" -delete 2>/dev/null || true
  find node_modules -name "AUTHORS*" -delete 2>/dev/null || true
  find node_modules -name ".npmignore" -delete 2>/dev/null || true
  find node_modules -name ".eslint*" -delete 2>/dev/null || true
  find node_modules -name ".prettier*" -delete 2>/dev/null || true
  find node_modules -name "tsconfig*.json" -delete 2>/dev/null || true
  find node_modules -name "*.gyp" -delete 2>/dev/null || true
  find node_modules -name "*.c" -delete 2>/dev/null || true
  find node_modules -name "*.cpp" -delete 2>/dev/null || true
  find node_modules -name "*.h" -delete 2>/dev/null || true
  find node_modules -name "*.o" -delete 2>/dev/null || true
  find node_modules -name "binding.gyp" -delete 2>/dev/null || true

  find node_modules -type d -name "test" -exec rm -rf {} + 2>/dev/null || true
  find node_modules -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
  find node_modules -type d -name "__tests__" -exec rm -rf {} + 2>/dev/null || true
  find node_modules -type d -name "docs" ! -path "*/yaml/*" -exec rm -rf {} + 2>/dev/null || true
  find node_modules -type d -name "doc" ! -path "*/yaml/*" -exec rm -rf {} + 2>/dev/null || true
  find node_modules -type d -name "example" -exec rm -rf {} + 2>/dev/null || true
  find node_modules -type d -name "examples" -exec rm -rf {} + 2>/dev/null || true
  find node_modules -type d -name "coverage" -exec rm -rf {} + 2>/dev/null || true
  find node_modules -type d -name ".github" -exec rm -rf {} + 2>/dev/null || true
  find node_modules -type d -name "benchmark" -exec rm -rf {} + 2>/dev/null || true
  find node_modules -type d -name "fixtures" -exec rm -rf {} + 2>/dev/null || true
  find node_modules -type d -name "android" -exec rm -rf {} + 2>/dev/null || true
  find node_modules -type d -name "ios" -exec rm -rf {} + 2>/dev/null || true
  find node_modules -type d -name "windows" -exec rm -rf {} + 2>/dev/null || true
  find node_modules -type d -name "prebuilds" -exec rm -rf {} + 2>/dev/null || true

  # Remove wrong-arch native binaries
  if [[ "$ARCH" == "arm64" ]]; then
    find node_modules -type d -name "darwin-x64" -exec rm -rf {} + 2>/dev/null || true
  elif [[ "$ARCH" == "x64" ]]; then
    find node_modules -type d -name "darwin-arm64" -exec rm -rf {} + 2>/dev/null || true
  fi
  # For universal, keep both architectures

  # Remove other-platform native module prebuilds (exact platform-arch patterns)
  for plat_arch in linux-x64 linux-arm64 linux-arm linux-s390x linux-ppc64 \
                   win32-x64 win32-arm64 win32-ia32; do
    find node_modules -type d -name "$plat_arch" -exec rm -rf {} + 2>/dev/null || true
  done

  # Remove .d.ts type declarations (not needed at runtime)
  find node_modules -name "*.d.ts" -delete 2>/dev/null || true
  find node_modules -name "*.d.ts.map" -delete 2>/dev/null || true
  find node_modules -name "*.d.mts" -delete 2>/dev/null || true

  rm -rf node_modules/.bin 2>/dev/null || true
  rm -rf node_modules/.package-lock.json 2>/dev/null || true
  find node_modules -type d -empty -delete 2>/dev/null || true

  # Report top-20 largest packages for optimization tracking
  log "Top 20 largest packages in node_modules:"
  du -sh node_modules/*/ 2>/dev/null | sort -rh | head -20 | while read -r line; do
    log "  $line"
  done
fi

# Final .jsc integrity check after all cleanup
POST_CLEANUP_JSC=$(find "$APP_ROOT/dist" -name "*.jsc" 2>/dev/null | wc -l | tr -d ' ')
log "Post-cleanup .jsc count: $POST_CLEANUP_JSC"
if [[ "$POST_CLEANUP_JSC" -lt 5 ]]; then
  err ".jsc files were lost during cleanup! Expected >=5, found $POST_CLEANUP_JSC"
  exit 1
fi

# Verify bytenode is present in production node_modules
if [[ ! -d "node_modules/bytenode" ]]; then
  err "bytenode missing from production node_modules!"
  err "bytecode loader stubs require bytenode at runtime."
  err "Check that bytenode is in dependencies (not devDependencies) in package.json."
  exit 1
fi

cd "$ROOT_DIR"
log "Production dependencies installed ($(elapsed_since $STEP_START))"

# ============================================================================
# Step 7: Code signing
# NOTE: 我们没有购买 Apple Developer 证书（$99/年），所以默认跳过签名。
#       未签名的 app 用户首次运行需要：右键 → 打开，或到系统设置 → 安全性 → 允许。
#       如果将来购买了证书，设置 SKIP_CODESIGN=0 SIGN_IDENTITY="Developer ID Application: xxx"
# ============================================================================
log_step "Step 7: Code signing"
STEP_START=$(date +%s)

SIGN_IDENTITY="${SIGN_IDENTITY:-}"
# 默认跳过签名 — 我们没有 Apple Developer 签名证书
SKIP_CODESIGN="${SKIP_CODESIGN:-1}"

if [[ "$SKIP_CODESIGN" == "1" ]]; then
  log "Skipping code signing (no Apple Developer certificate). Users need to right-click → Open on first launch."
elif [[ -n "$SIGN_IDENTITY" ]]; then
  log "Signing with identity: $SIGN_IDENTITY"
  ALLOW_ADHOC_SIGNING=0 bash "$ROOT_DIR/scripts/codesign-mac-app.sh" "$APP_DIR"
else
  log "Ad-hoc signing (no developer certificate)"
  ALLOW_ADHOC_SIGNING=1 SKIP_TEAM_ID_CHECK=1 DISABLE_LIBRARY_VALIDATION=1 bash "$ROOT_DIR/scripts/codesign-mac-app.sh" "$APP_DIR"
fi

log "Code signing completed ($(elapsed_since $STEP_START))"

# ============================================================================
# Step 8: Create DMG
# ============================================================================
log_step "Step 8: Create DMG"
STEP_START=$(date +%s)

DMG_OUTPUT="$OUTPUT_DIR/${APP_NAME}-macOS-v${VERSION}-${ARCH}.dmg"

bash "$ROOT_DIR/scripts/create-dmg.sh" "$APP_DIR" "$DMG_OUTPUT"

# Generate SHA256
shasum -a 256 "$DMG_OUTPUT" | awk '{print $1}' > "${DMG_OUTPUT}.sha256"

log "DMG created ($(elapsed_since $STEP_START))"

# ============================================================================
# Step 9: Notarization (optional)
# ============================================================================
if [[ "${SKIP_NOTARIZE:-1}" != "1" ]] && [[ -n "$SIGN_IDENTITY" ]]; then
  log_step "Step 9: Apple notarization"
  STEP_START=$(date +%s)

  if [[ -f "$ROOT_DIR/scripts/notarize-mac-artifact.sh" ]]; then
    bash "$ROOT_DIR/scripts/notarize-mac-artifact.sh" "$DMG_OUTPUT"
    log "Notarization completed ($(elapsed_since $STEP_START))"
  else
    log "WARN: notarize-mac-artifact.sh not found, skipping"
  fi
else
  log "Skipping notarization (SKIP_NOTARIZE=${SKIP_NOTARIZE:-1})"
fi

# ============================================================================
# Step 10: Post-build validation (non-blocking)
# ============================================================================
VALIDATION_SCRIPT="$ROOT_DIR/scripts/macos/post-build-validation.sh"
if [[ -f "$VALIDATION_SCRIPT" ]]; then
  log_step "Step 10: Post-build validation"
  STEP_START=$(date +%s)
  chmod +x "$VALIDATION_SCRIPT"
  if bash "$VALIDATION_SCRIPT" --app-dir "$APP_DIR" --log-dir "$OUTPUT_DIR/validation-logs"; then
    log "Post-build validation passed ($(elapsed_since $STEP_START))"
  else
    warn "Post-build validation FAILED ($? tests failed) — build artifact still available"
  fi
else
  log "Skipping post-build validation (script not found: $VALIDATION_SCRIPT)"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Build Complete!"
echo "════════════════════════════════════════════════════════════"
echo "  App:     $APP_DIR"
echo "  DMG:     $DMG_OUTPUT"
echo "  SHA256:  $(cat "${DMG_OUTPUT}.sha256")"
echo ""
echo "  Size breakdown:"
du -sh "$APP_DIR/Contents/Resources/node" 2>/dev/null | awk '{print "    Node.js:      " $1}' || true
du -sh "$APP_DIR/Contents/Resources/app/dist" 2>/dev/null | awk '{print "    dist/:        " $1}' || true
du -sh "$APP_DIR/Contents/Resources/app/dist/control-ui" 2>/dev/null | awk '{print "    Web UI:       " $1}' || true
du -sh "$APP_DIR/Contents/Resources/app/extensions" 2>/dev/null | awk '{print "    extensions/:  " $1}' || true
du -sh "$APP_DIR/Contents/Resources/app/skills" 2>/dev/null | awk '{print "    skills/:      " $1}' || true
du -sh "$APP_DIR/Contents/Resources/app/node_modules" 2>/dev/null | awk '{print "    node_modules: " $1}' || true
du -sh "$APP_DIR" 2>/dev/null | awk '{print "    Total .app:   " $1}' || true
du -sh "$DMG_OUTPUT" 2>/dev/null | awk '{print "    DMG:          " $1}' || true
echo ""
echo "  Encryption:"
echo "    CN files: RC4 obfuscation + V8 bytecode (bytecode tier)"
echo "    CN extensions: RC4 obfuscation (obfuscate tier)"
echo "    Upstream code: NOT encrypted (open-source)"
echo "════════════════════════════════════════════════════════════"
