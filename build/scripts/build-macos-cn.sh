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
NODE_VERSION="${NODE_VERSION:-22.14.0}"

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

# ── Helpers ──────────────────────────────────────────────────────────────────

log() { echo "[$(date '+%H:%M:%S')] $*"; }
log_step() { echo ""; echo "═══════════════════════════════════════════════════════"; echo "  $*"; echo "═══════════════════════════════════════════════════════"; }
err() { echo "ERROR: $*" >&2; }

elapsed_since() {
  local start="$1"
  local now
  now=$(date +%s)
  local diff=$((now - start))
  echo "${diff}s"
}

# ── Setup ────────────────────────────────────────────────────────────────────

mkdir -p "$OUTPUT_DIR"
cd "$ROOT_DIR"

VERSION="${VERSION:-$(node -p "require('./package.json').version" 2>/dev/null || echo "0.0.0")}"
APP_NAME="ClawdbotCN"
BUNDLE_ID="cn.openclawcn.mac"

log "OpenClawCN macOS Build"
log "  Version: $VERSION"
log "  Arch: $ARCH"
log "  Jobs: $JOBS"
log "  Fast mode: $FAST_MODE"
log "  Node.js: v$NODE_VERSION"
log "  Root: $ROOT_DIR"
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

# ============================================================================
# Step 4: Download Node.js binaries
# ============================================================================
log_step "Step 4: Download Node.js binaries"
STEP_START=$(date +%s)

NODE_DL_DIR="$ROOT_DIR/build/download-output/node"
mkdir -p "$NODE_DL_DIR"

download_node() {
  local arch="$1"
  local url="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-${arch}.tar.gz"
  local tar_file="$NODE_DL_DIR/node-v${NODE_VERSION}-darwin-${arch}.tar.gz"
  local extract_dir="$NODE_DL_DIR/node-${arch}"

  if [[ -f "$extract_dir/bin/node" ]]; then
    log "Node.js $arch already downloaded"
    return
  fi

  log "Downloading Node.js v${NODE_VERSION} for $arch..."
  curl -fsSL "$url" -o "$tar_file"
  mkdir -p "$extract_dir"
  tar -xzf "$tar_file" -C "$extract_dir" --strip-components=1
  rm -f "$tar_file"
  log "Node.js $arch downloaded"
}

case "$ARCH" in
  universal)
    download_node "arm64"
    download_node "x64"
    ;;
  arm64)
    download_node "arm64"
    ;;
  x64)
    download_node "x64"
    ;;
  *)
    err "Unknown architecture: $ARCH"
    exit 1
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
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <false/>
    <key>NSHumanReadableCopyright</key>
    <string>OpenClawCN ${VERSION}</string>
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
export NODE_ENV=production

if lsof -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    open "http://localhost:$PORT/"
    exit 0
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

# ── Copy UI dist ──
if [[ -d "$ROOT_DIR/ui/dist" ]]; then
  log "Copying UI dist..."
  mkdir -p "$APP_ROOT/ui"
  cp -R "$ROOT_DIR/ui/dist" "$APP_ROOT/ui/dist"
fi

# ── Copy assets ──
if [[ -d "$ROOT_DIR/assets" ]]; then
  mkdir -p "$APP_ROOT/assets"
  cp -R "$ROOT_DIR/assets" "$APP_ROOT/" 2>/dev/null || true
fi

# ── Copy data (MCP index) ──
if [[ -d "$ROOT_DIR/data" ]]; then
  cp -R "$ROOT_DIR/data" "$APP_ROOT/data"
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

# ── Version info ──
cat > "$RESOURCES/version.json" <<VINFO
{
  "version": "${VERSION}",
  "arch": "${ARCH}",
  "platform": "darwin",
  "buildDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "nodeVersion": "${NODE_VERSION}"
}
VINFO

# ── Install marker (for auto-update detection) ──
UPDATE_SERVER="${OPENCLAWCN_UPDATE_SERVER:-http://47.98.123.45}"
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

# Exclude large optional packages
node -e "
  const pkg = require('./package.json');
  const excludeDeps = [
    'node-llama-cpp', '@napi-rs/canvas', 'playwright-core',
    '@lydell/node-pty', 'sqlite-vec', 'sharp'
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

# Use bundled Node for npm install (matches runtime)
if ! "$RESOURCES/node/bin/node" "$NPM_CLI" \
  install --omit=dev --ignore-scripts --no-audit --no-fund 2>&1; then
  err "npm install --omit=dev failed"
  exit 1
fi

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

  rm -rf node_modules/.bin 2>/dev/null || true
  find node_modules -type d -empty -delete 2>/dev/null || true
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
du -sh "$APP_DIR/Contents/Resources/app/node_modules" 2>/dev/null | awk '{print "    node_modules: " $1}' || true
du -sh "$APP_DIR" 2>/dev/null | awk '{print "    Total .app:   " $1}' || true
du -sh "$DMG_OUTPUT" 2>/dev/null | awk '{print "    DMG:          " $1}' || true
echo ""
echo "  Encryption:"
echo "    CN files: RC4 obfuscation + V8 bytecode (bytecode tier)"
echo "    CN extensions: RC4 obfuscation (obfuscate tier)"
echo "    Upstream code: NOT encrypted (open-source)"
echo "════════════════════════════════════════════════════════════"
