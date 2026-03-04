#!/usr/bin/env bash
# Build ClawdbotCN Desktop Application (Tauri) — macOS
# Usage: bash scripts/desktop/build.sh [--arch universal|arm64|x64]
#
# Corresponds to: scripts/desktop/build.ps1 (Windows)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DESKTOP_DIR="$PROJECT_ROOT/apps/desktop"
TAURI_DIR="$DESKTOP_DIR/src-tauri"

# ── Parse arguments ──
ARCH="${ARCH:-$(uname -m)}"
case "$ARCH" in
  aarch64|arm64) ARCH="arm64" ;;
  x86_64|x64)    ARCH="x64" ;;
  universal)     ARCH="universal" ;;
esac

while [[ $# -gt 0 ]]; do
  case "$1" in
    --arch) ARCH="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

echo "========================================"
echo " Building ClawdbotCN Desktop (Tauri)"
echo " Platform: macOS"
echo "========================================"
echo "Project root : $PROJECT_ROOT"
echo "Tauri source : $TAURI_DIR"
echo "Architecture : $ARCH"
echo ""

# ── Step 1: Verify prerequisites ──
echo "[1/6] Checking prerequisites..."

# Check Rust
if ! command -v cargo &>/dev/null; then
  echo "ERROR: Rust/Cargo not found. Install from https://rustup.rs" >&2
  exit 1
fi
echo "  Cargo : $(cargo --version)"

# Check Xcode Command Line Tools
if ! xcode-select -p &>/dev/null; then
  echo "ERROR: Xcode Command Line Tools not found." >&2
  echo "  Run: xcode-select --install" >&2
  exit 1
fi
echo "  Xcode CLT : $(xcode-select -p)"

# Check pnpm
if ! command -v pnpm &>/dev/null; then
  echo "ERROR: pnpm not found." >&2
  exit 1
fi
echo "  pnpm  : $(pnpm --version)"
echo ""

# ── Step 2a: Base build (tsdown) ──
# Must run first: tsdown clears dist/ before writing, so UI build cannot start yet
echo "[2a/6] Building Node.js backend (base tsdown)..."
(cd "$PROJECT_ROOT" && pnpm build)
echo "  Base build (tsdown) OK"

# ── Step 2b: UI build (MUST complete BEFORE CN bytecode compilation) ──
# UI Vite build imports from extensions/ source .ts/.js files.
# CN bytecode compilation (compile-bytecode.ts) replaces extension .js files with
# CJS bytecode loader stubs that Rollup/Vite cannot parse as ESM.
# Therefore UI build MUST finish before compile-bytecode.ts runs.
echo "[2b/6] Building UI..."
if [[ -f "$PROJECT_ROOT/ui/package.json" ]]; then
  (cd "$PROJECT_ROOT/ui" && pnpm build)
  echo "  UI build OK"
else
  echo "  WARN: ui/package.json not found, skipping"
fi

# ── Step 2c: CN encryption chain (after UI build completes) ──
echo "[2c/6] CN encryption chain..."

# CRITICAL: .jsc bytecode is V8-version-specific. We MUST use the same Node version
# that will ship in the installer. Download the pinned Node now (before compile-bytecode)
# so we can use it for bytecode compilation.
BYTECODE_NODE=""
BYTECODE_NODE_VERSION="22.16.0"
BYTECODE_NODE_CANDIDATES=(
  "$PROJECT_ROOT/build/download-output/node/node-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')/bin/node"
)

# Try to download the pinned Node if not already cached
BYTECODE_ARCH="$(uname -m)"
case "$BYTECODE_ARCH" in
  x86_64) BYTECODE_ARCH="x64" ;;
  aarch64) BYTECODE_ARCH="arm64" ;;
esac
BYTECODE_NODE_DIR="$PROJECT_ROOT/build/download-output/node/node-${BYTECODE_ARCH}"
if [[ ! -f "$BYTECODE_NODE_DIR/bin/node" ]]; then
  echo "  Downloading Node v${BYTECODE_NODE_VERSION} for bytecode compilation..."
  BYTECODE_DL_FILE="node-v${BYTECODE_NODE_VERSION}-darwin-${BYTECODE_ARCH}.tar.gz"
  BYTECODE_MIRRORS=(
    "https://npmmirror.com/mirrors/node/v${BYTECODE_NODE_VERSION}/$BYTECODE_DL_FILE"
    "https://nodejs.org/dist/v${BYTECODE_NODE_VERSION}/$BYTECODE_DL_FILE"
  )
  mkdir -p "$BYTECODE_NODE_DIR"
  BYTECODE_DL_OK=false
  for url in "${BYTECODE_MIRRORS[@]}"; do
    if curl -fSL --connect-timeout 15 --max-time 300 "$url" -o "/tmp/$BYTECODE_DL_FILE" 2>/dev/null; then
      tar -xzf "/tmp/$BYTECODE_DL_FILE" -C "$BYTECODE_NODE_DIR" --strip-components=1
      rm -f "/tmp/$BYTECODE_DL_FILE"
      BYTECODE_DL_OK=true
      break
    fi
  done
  if [[ "$BYTECODE_DL_OK" != "true" ]]; then
    echo "ERROR: Failed to download Node v${BYTECODE_NODE_VERSION} for bytecode compilation!" >&2
    echo "  System node may have incompatible V8 version. Aborting." >&2
    exit 1
  fi
fi
BYTECODE_NODE="$BYTECODE_NODE_DIR/bin/node"

echo "  Bytecode compile using: $BYTECODE_NODE ($($BYTECODE_NODE -v))"

(cd "$PROJECT_ROOT" && \
  pnpm build:cn-compile && \
  pnpm build:cn-extensions && \
  pnpm verify:extensions && \
  node --import tsx scripts/obfuscate-dist.ts && \
  "$BYTECODE_NODE" --import tsx cn/scripts/build/compile-bytecode.ts && \
  pnpm integrity:gen && \
  pnpm release:changelog)
echo "  CN encryption chain OK"

# ── Step 3: UI obfuscation ──
echo "[3/6] Obfuscating UI bundles..."
(cd "$PROJECT_ROOT" && node --import tsx cn/scripts/build/obfuscate-ui.ts)
echo "  UI obfuscation OK"

# ── Step 3b: OEM brand injection (optional) ──
# Set OEM_ID=<name> to apply a brand config from config/oem/<name>.json
# before Tauri bundles. Omit OEM_ID (or set to "default") to use standard brand.
if [[ -n "${OEM_ID:-}" && "${OEM_ID}" != "default" ]]; then
  echo "[3b/6] Applying OEM brand config: $OEM_ID"
  (cd "$PROJECT_ROOT" && node --import tsx scripts/desktop/apply-oem-config.ts)
  echo "  OEM brand config applied"
else
  echo "[3b/6] OEM_ID not set — using default brand (ClawdbotCN)"
fi

# ── Step 3c: Pre-packaging validation (增强版) ──────────────────────────────
# 今天的教训：打包前未充分校验，导致后期发现问题要重打。
# 现在在进入 Tauri 编译（最耗时步骤）前，全面拦截所有已知风险点。
echo "[3c/6] Pre-packaging validation (enhanced)..."
BUILD_OK=true

# [Fix-2a] 版本号三重校验（package.json / tauri.conf.json / install.json）
PKG_VER=$(node -p "require('$PROJECT_ROOT/package.json').version" 2>/dev/null || echo "FAIL")
TAURI_VER=$(node -p "JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/apps/desktop/src-tauri/tauri.conf.json','utf8')).version" 2>/dev/null || echo "FAIL")
DESKTOP_VER=$(node -p "require('$PROJECT_ROOT/apps/desktop/package.json').version" 2>/dev/null || echo "FAIL")
echo "  Version check: pkg=$PKG_VER  tauri=$TAURI_VER  desktop=$DESKTOP_VER"
if [[ "$PKG_VER" == "FAIL" || "$TAURI_VER" == "FAIL" || "$DESKTOP_VER" == "FAIL" ]]; then
  echo "  ERROR: Failed to read version from one or more config files." >&2
  BUILD_OK=false
elif [[ "$PKG_VER" != "$TAURI_VER" || "$PKG_VER" != "$DESKTOP_VER" ]]; then
  echo "  ERROR: Version mismatch! pkg=$PKG_VER tauri=$TAURI_VER desktop=$DESKTOP_VER" >&2
  BUILD_OK=false
else
  echo "  OK: all versions consistent at $PKG_VER"
fi

# [Fix-2b] 若外部传入了 VERSION 环境变量，校验一致性
if [[ -n "${VERSION:-}" && "$PKG_VER" != "$VERSION" ]]; then
  echo "  ERROR: Built version ($PKG_VER) != requested VERSION ($VERSION)!" >&2
  BUILD_OK=false
fi

# Check build-meta.json exists (bytecode V8 version record)
if [[ ! -f "$PROJECT_ROOT/dist/build-meta.json" ]]; then
  echo "  ERROR: dist/build-meta.json not found! compile-bytecode.ts may have failed." >&2
  BUILD_OK=false
else
  echo "  OK: build-meta.json exists"
fi

# Check .jsc bytecode files — 今天实际有 161 个 dist .jsc，阈值从 5 调到 100
JSC_COUNT=$(find "$PROJECT_ROOT/dist" -name "*.jsc" 2>/dev/null | wc -l | tr -d ' ')
EXT_JSC_COUNT=$(find "$PROJECT_ROOT/extensions" -name "*.jsc" 2>/dev/null | wc -l | tr -d ' ')
if [[ "$JSC_COUNT" -lt 100 ]]; then
  echo "  ERROR: Only $JSC_COUNT .jsc files in dist/ (expected >= 100). Bytecode compilation may have failed." >&2
  BUILD_OK=false
else
  echo "  OK: $JSC_COUNT dist .jsc + $EXT_JSC_COUNT extensions .jsc = $((JSC_COUNT + EXT_JSC_COUNT)) total"
fi

# Check control-ui was built & has correct chunk count (>=5)
if [[ ! -d "$PROJECT_ROOT/dist/control-ui" ]]; then
  echo "  ERROR: dist/control-ui/ not found. UI build failed." >&2
  BUILD_OK=false
else
  UI_JS=$(find "$PROJECT_ROOT/dist/control-ui/assets" -name "*.js" 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$UI_JS" -lt 5 ]]; then
    echo "  ERROR: dist/control-ui/assets has only $UI_JS .js files (expected >=5)." >&2
    BUILD_OK=false
  else
    echo "  OK: control-ui built ($UI_JS JS chunks)"
  fi
fi

# [Fix-2c] 完整性哈希文件存在性（今天验证中发现是关键指标）
if [[ ! -f "$PROJECT_ROOT/dist/security/integrity-hashes.json" ]]; then
  echo "  ERROR: integrity-hashes.json not found! integrity:gen may have failed." >&2
  BUILD_OK=false
else
  HASH_COUNT=$(node -e "try{console.log(Object.keys(JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/dist/security/integrity-hashes.json','utf8'))).length)}catch{console.log(0)}" 2>/dev/null || echo 0)
  if [[ "$HASH_COUNT" -lt 50 ]]; then
    echo "  ERROR: integrity-hashes.json has only $HASH_COUNT entries (expected >=50)." >&2
    BUILD_OK=false
  else
    echo "  OK: integrity-hashes.json ($HASH_COUNT entries)"
  fi
fi

# [Fix-2d] 关键 .jsc 模块可被 bytenode 加载（快速 smoke test，用 build 环境的 node）
BYTECODE_SMOKE_OK=true
SMOKE_NODE="${BYTECODE_NODE:-node}"
for smoke_jsc in \
  dist/config/region-cn.jsc \
  dist/license/index.jsc \
  dist/security/index.jsc \
  dist/dispatch/engine.jsc \
  extensions/agent-team/index.jsc \
  extensions/orchestrator/index.jsc
do
  if [[ -f "$PROJECT_ROOT/$smoke_jsc" ]]; then
    SMOKE_RESULT=$("$SMOKE_NODE" -e "
      const b = require('$PROJECT_ROOT/node_modules/bytenode');
      try { b.runBytecodeFile('$PROJECT_ROOT/$smoke_jsc'); process.stdout.write('OK'); }
      catch(e) { process.stdout.write('ERR:'+e.message.split('\n')[0].substring(0,80)); process.exit(1); }
    " 2>/dev/null)
    if [[ "$SMOKE_RESULT" != "OK" ]]; then
      echo "  ERROR: bytenode smoke fail: $smoke_jsc -- $SMOKE_RESULT" >&2
      BYTECODE_SMOKE_OK=false
      BUILD_OK=false
    fi
  fi
done
[[ "$BYTECODE_SMOKE_OK" == "true" ]] && echo "  OK: bytenode smoke tests passed"

if [[ "$BUILD_OK" != "true" ]]; then
  echo "FATAL: Pre-packaging validation failed. Aborting before Tauri compile (saves 30-60 min)." >&2
  exit 1
fi
echo "  Pre-packaging validation passed ✓"

# ── Step 4+5: Prepare resources + Tauri CLI install (PARALLEL) ──
# Safe to parallelize because:
#   - prepare-resources writes to apps/desktop/src-tauri/resources/
#   - Tauri CLI install writes to apps/desktop/node_modules/
#   - Completely separate directories, no conflicts
echo "[4+5/6] Preparing resources + Installing Tauri CLI (parallel)..."

PREPARE_SCRIPT="$SCRIPT_DIR/prepare-resources.sh"
if [[ -f "$PREPARE_SCRIPT" ]]; then
  bash "$PREPARE_SCRIPT" --arch "$ARCH" &
  PREP_PID=$!
else
  echo "  WARNING: prepare-resources.sh not found, skipping resource staging." >&2
  PREP_PID=""
fi

if [[ -f "$DESKTOP_DIR/package.json" ]]; then
  (cd "$DESKTOP_DIR" && pnpm install) &
  TAURI_CLI_PID=$!
else
  TAURI_CLI_PID=""
fi

# Wait for both
# NOTE: 必须用 set +e，否则 set -e 下 wait 遇到非零退出会直接终止脚本
set +e
if [[ -n "$PREP_PID" ]]; then
  wait $PREP_PID
  PREP_EXIT=$?
else
  PREP_EXIT=0
fi

if [[ -n "$TAURI_CLI_PID" ]]; then
  wait $TAURI_CLI_PID
  TAURI_CLI_EXIT=$?
else
  TAURI_CLI_EXIT=0
fi
set -e

if [[ $PREP_EXIT -ne 0 ]]; then
  echo "ERROR: Resource preparation failed (exit $PREP_EXIT)!" >&2
  exit 1
fi
[[ -n "$PREP_PID" ]] && echo "  Resource preparation OK"

if [[ $TAURI_CLI_EXIT -ne 0 ]]; then
  echo "ERROR: Tauri CLI install failed (exit $TAURI_CLI_EXIT)!" >&2
  exit 1
fi
[[ -n "$TAURI_CLI_PID" ]] && echo "  Tauri CLI install OK"

# ── Step 5.5: Re-sync integrity hashes into resources/ before Tauri build ──
# WHY: prepare-resources.sh copies dist/ → resources/dist/ early (step [2/7]).
# However, during [4+5] parallel phase, additional npm/pnpm install calls inside
# prepare-resources.sh may trigger lifecycle hooks that re-run the CN encryption
# chain (compile-bytecode + integrity:gen), overwriting src/security/integrity-root-hash.ts
# with a NEW hash (HASH_NEW). Tauri then compiles HASH_NEW into the binary.
# But resources/dist/security/integrity-hashes.json still holds the OLD content
# (from the initial copy), so sha256(hashes.json_OLD) ≠ HASH_NEW → fatal at startup.
# Fix: run integrity:gen one final time right before Tauri build, then copy the
# resulting hashes files into resources/ so binary and disk stay in sync.
echo "[5.5/6] Re-syncing integrity hashes (final, before Tauri compile)..."
(cd "$PROJECT_ROOT" && pnpm integrity:gen)
INTEGRITY_RESYNC_EXIT=$?
if [[ $INTEGRITY_RESYNC_EXIT -ne 0 ]]; then
  echo "ERROR: integrity:gen re-sync failed!" >&2
  exit 1
fi

# CRITICAL: integrity:gen updates src/security/integrity-root-hash.ts but does NOT
# recompile it to dist/security/integrity-root-hash.js. The Gateway reads the .js
# file at runtime and checks the hardcoded hash constant. We must recompile it now.
# Also touch the file so cargo detects the change and recompiles the Rust binary.
echo "  Recompiling integrity-root-hash.ts → dist/security/integrity-root-hash.js..."
(cd "$PROJECT_ROOT" && pnpm tsdown --entry src/security/integrity-root-hash.ts --out-dir dist/security --no-dts --no-clean 2>/dev/null || \
  node --import tsx scripts/build-integrity-root-hash.ts 2>/dev/null || \
  node -e "
    const fs=require('fs'), path=require('path');
    const src=fs.readFileSync('src/security/integrity-root-hash.ts','utf8');
    const match=src.match(/INTEGRITY_ROOT_HASH\s*=\s*\"([0-9a-f]{64})\"/);
    if(!match) { console.error('hash not found in .ts'); process.exit(1); }
    const hash=match[1];
    const h1=hash.slice(0,32), h2=hash.slice(32);
    // Rewrite integrity-root-hash.js with updated hash (same obfuscation pattern)
    const existing=fs.readFileSync('dist/security/integrity-root-hash.js','utf8');
    const updated=existing.replace(/\"[0-9a-f]{32}\"\+\"[0-9a-f]{32}\"/, '\"'+h1+'\"'+'+\"'+h2+'\"');
    fs.writeFileSync('dist/security/integrity-root-hash.js', updated, 'utf8');
    console.log('  Patched integrity-root-hash.js with hash: '+h1+'...');
  ")
# Touch the .ts so cargo's file-change detection forces Rust recompile
touch "$PROJECT_ROOT/src/security/integrity-root-hash.ts" 2>/dev/null || true

RESOURCES_SECURITY="$PROJECT_ROOT/apps/desktop/src-tauri/resources/dist/security"
if [[ -d "$RESOURCES_SECURITY" ]]; then
  cp "$PROJECT_ROOT/dist/security/integrity-hashes.json" "$RESOURCES_SECURITY/integrity-hashes.json"
  cp "$PROJECT_ROOT/dist/security/integrity-hashes-root.json" "$RESOURCES_SECURITY/integrity-hashes-root.json"
  cp "$PROJECT_ROOT/dist/security/integrity-root-hash.js" "$RESOURCES_SECURITY/integrity-root-hash.js" 2>/dev/null || true
  FINAL_HASH=$(node -e "try{const r=require('$RESOURCES_SECURITY/integrity-hashes-root.json');console.log(r.hash.slice(0,16)+'...')}catch{console.log('?')}" 2>/dev/null || echo "?")
  echo "  Integrity re-sync OK — HASH_FINAL=${FINAL_HASH}"
else
  echo "  WARN: resources/dist/security/ not found — skipping copy (resources may be staged differently)"
fi

# ── Step 6: Build Tauri (Rust + bundle) ──
echo "[6/6] Building Tauri native app..."
echo "  (First build may take 5-10 minutes)"

# Map ARCH to Rust target triple for cross-compilation / universal binary
TAURI_TARGET=""
case "$ARCH" in
  arm64)     TAURI_TARGET="aarch64-apple-darwin" ;;
  x64)       TAURI_TARGET="x86_64-apple-darwin" ;;
  universal) TAURI_TARGET="universal-apple-darwin" ;;
esac

if [[ -n "$TAURI_TARGET" ]]; then
  echo "  Rust target: $TAURI_TARGET"
  (cd "$DESKTOP_DIR" && pnpm tauri build --target "$TAURI_TARGET")
else
  (cd "$DESKTOP_DIR" && pnpm tauri build)
fi
BUILD_EXIT=$?

if [[ $BUILD_EXIT -ne 0 ]]; then
  echo "ERROR: Tauri build failed!" >&2
  echo "  Check that Rust and Xcode CLT are properly installed." >&2
  exit 1
fi

# ── Step 7: Post-build fixups (macOS) ──
echo ""
echo "[7/7] Post-build: ad-hoc signing + LSArchitecturePriority..."

# Determine DMG and .app locations
if [[ -n "$TAURI_TARGET" ]]; then
  MACOS_BUNDLE_DIR="$TAURI_DIR/target/$TAURI_TARGET/release/bundle/macos"
  DMG_DIR="$TAURI_DIR/target/$TAURI_TARGET/release/bundle/dmg"
else
  MACOS_BUNDLE_DIR="$TAURI_DIR/target/release/bundle/macos"
  DMG_DIR="$TAURI_DIR/target/release/bundle/dmg"
fi

APP_FILE=$(find "$MACOS_BUNDLE_DIR" -name "*.app" -maxdepth 1 2>/dev/null | head -1)

# Tauri v2 may clean the .app after creating the DMG.
# If .app is gone, extract it from the Tauri-generated DMG for signing + DMG rebuild.
EXTRACTED_FROM_DMG=false
if [[ -z "$APP_FILE" ]]; then
  TAURI_DMG=$(find "$DMG_DIR" -name "*.dmg" 2>/dev/null | head -1)
  if [[ -n "$TAURI_DMG" ]]; then
    echo "  .app was cleaned by Tauri — extracting from DMG for post-processing..."
    EXTRACT_MOUNT="/tmp/clawdbot-extract-$$"
    mkdir -p "$MACOS_BUNDLE_DIR"
    hdiutil attach "$TAURI_DMG" -mountpoint "$EXTRACT_MOUNT" -nobrowse -quiet
    MOUNTED_APP=$(find "$EXTRACT_MOUNT" -name "*.app" -maxdepth 1 2>/dev/null | head -1)
    if [[ -n "$MOUNTED_APP" ]]; then
      cp -R "$MOUNTED_APP" "$MACOS_BUNDLE_DIR/"
      APP_FILE="$MACOS_BUNDLE_DIR/$(basename "$MOUNTED_APP")"
      EXTRACTED_FROM_DMG=true
      echo "  Extracted: $(basename "$MOUNTED_APP")"
    fi
    hdiutil detach "$EXTRACT_MOUNT" -quiet 2>/dev/null || true
  fi
fi

if [[ -z "$APP_FILE" ]]; then
  echo "  WARNING: No .app bundle found — skipping post-build fixups"
else
  # Inject LSArchitecturePriority into Info.plist (arm64 preferred over x86_64)
  PLIST="$APP_FILE/Contents/Info.plist"
  if [[ -f "$PLIST" ]]; then
    /usr/libexec/PlistBuddy -c "Add :LSArchitecturePriority array" "$PLIST" 2>/dev/null || true
    /usr/libexec/PlistBuddy -c "Add :LSArchitecturePriority:0 string arm64" "$PLIST" 2>/dev/null || true
    /usr/libexec/PlistBuddy -c "Add :LSArchitecturePriority:1 string x86_64" "$PLIST" 2>/dev/null || true
    echo "  LSArchitecturePriority: arm64, x86_64"
  fi

  # Apply ad-hoc code signing (no Apple Developer cert, but Gatekeeper needs at least this)
  echo "  Applying ad-hoc code signature..."
  codesign --force --deep --sign - "$APP_FILE" 2>&1 || echo "  WARNING: ad-hoc signing failed (non-fatal)"
  echo "  Ad-hoc signature applied"

  # Remove quarantine attribute
  xattr -cr "$APP_FILE" 2>/dev/null || true

  # Rebuild DMG with signed .app + drag-to-install UI (background image + Applications symlink)
  echo "  Rebuilding DMG with signed .app + drag-to-install guide..."
  CREATE_DMG_SCRIPT="$PROJECT_ROOT/scripts/create-dmg.sh"
  OLD_DMG=$(find "$DMG_DIR" -name "*.dmg" 2>/dev/null | head -1)
  DMG_OUT="${OLD_DMG:-$DMG_DIR/ClawdbotCN.dmg}"
  mkdir -p "$(dirname "$DMG_OUT")"
  if [[ -f "$CREATE_DMG_SCRIPT" ]]; then
    bash "$CREATE_DMG_SCRIPT" "$APP_FILE" "$DMG_OUT"
    echo "  DMG rebuilt with drag-to-install guide"
  else
    echo "  WARNING: scripts/create-dmg.sh not found, falling back to plain hdiutil"
    hdiutil create -volname "ClawdbotCN" -srcfolder "$APP_FILE" \
      -ov -format UDZO "$DMG_OUT" 2>&1
  fi

  # Clean up extracted .app if we pulled it from DMG (it's now inside the rebuilt DMG)
  if [[ "$EXTRACTED_FROM_DMG" == "true" ]]; then
    rm -rf "$APP_FILE"
  fi
fi

# ── Restore tauri.conf.json if OEM config was applied ──
if [[ -n "${OEM_ID:-}" && "${OEM_ID}" != "default" ]]; then
  echo "Restoring tauri.conf.json to original state..."
  (cd "$PROJECT_ROOT" && node --import tsx scripts/desktop/restore-tauri-conf.ts)
fi

# ── Done ──
echo ""
echo "========================================"
echo " Build Successful!"
if [[ -n "${OEM_ID:-}" && "${OEM_ID}" != "default" ]]; then
  echo " OEM      : $OEM_ID"
fi
echo "========================================"

# Show output info
DMG_FILE=$(find "$DMG_DIR" -name "*.dmg" 2>/dev/null | head -1)
if [[ -n "$DMG_FILE" ]]; then
  DMG_SIZE=$(du -m "$DMG_FILE" | cut -f1)
  echo "  DMG      : $DMG_FILE"
  echo "  Size     : ${DMG_SIZE} MB"
  echo "  SHA256   : $(shasum -a 256 "$DMG_FILE" | cut -d' ' -f1)"
fi

if [[ -n "$APP_FILE" ]]; then
  echo "  App      : $APP_FILE"
  # Verify signature
  codesign -dvv "$APP_FILE" 2>&1 | grep -E "Signature=|Authority=" | head -3 || true
fi

if [[ -z "${DMG_FILE:-}" ]] && [[ -z "${APP_FILE:-}" ]]; then
  echo "  Check: $TAURI_DIR/target/release/bundle/"
fi

# ── [健壮性 Fix-3] DMG 内全量验证 ─────────────────────────────────────────────
# 今天的教训：构建完后才发现有 4 项误判，浪费时间排查。
# 现在直接挂载 DMG，在最终产物上做全量 .jsc 可加载测试 + 版本号验证，
# 零容忍：任何真实失败立刻报错，让 CI 能在本次构建就知道结果。
if [[ -n "${DMG_FILE:-}" && -f "$DMG_FILE" ]]; then
  echo ""
  echo "========================================"
  echo " [Fix-3] DMG 全量内置验证"
  echo "========================================"
  DMG_VERIFY_MOUNT="/tmp/clawdbot-dmg-verify-$$"
  mkdir -p "$DMG_VERIFY_MOUNT"
  hdiutil attach "$DMG_FILE" -mountpoint "$DMG_VERIFY_MOUNT" -nobrowse -quiet 2>/dev/null
  DMG_ATTACH_OK=$?

  if [[ $DMG_ATTACH_OK -eq 0 ]]; then
    trap "hdiutil detach '$DMG_VERIFY_MOUNT' -force 2>/dev/null; rm -rf '$DMG_VERIFY_MOUNT'" EXIT

    DMG_APP=$(find "$DMG_VERIFY_MOUNT" -name "*.app" -maxdepth 1 2>/dev/null | head -1)
    DMG_RES="$DMG_APP/Contents/Resources/resources"
    DMG_NODE=""
    for np in "$DMG_RES/node/bin/node" "$DMG_RES/node/node"; do
      [[ -f "$np" ]] && DMG_NODE="$np" && break
    done

    DMG_VERIFY_OK=true
    DMG_VERIFY_FAILS=""

    # [Fix-3a] 版本号验证 — 今天 install.json 路径是 resources/install.json，不是 dist/install.json
    DMG_VER_FILE="$DMG_RES/install.json"
    if [[ -f "$DMG_VER_FILE" ]]; then
      DMG_VER=$(python3 -c "import json; print(json.load(open('$DMG_VER_FILE'))['version'])" 2>/dev/null || echo "FAIL")
      EXPECTED_VER=$(node -p "require('$PROJECT_ROOT/package.json').version" 2>/dev/null || echo "?")
      if [[ "$DMG_VER" == "$EXPECTED_VER" ]]; then
        echo "  [PASS] DMG version: $DMG_VER"
      else
        echo "  [FAIL] DMG version mismatch: DMG=$DMG_VER expected=$EXPECTED_VER"
        DMG_VERIFY_OK=false
        DMG_VERIFY_FAILS="$DMG_VERIFY_FAILS\n  version mismatch: DMG=$DMG_VER expected=$EXPECTED_VER"
      fi
    else
      echo "  [FAIL] install.json not found at $DMG_VER_FILE"
      DMG_VERIFY_OK=false
      DMG_VERIFY_FAILS="$DMG_VERIFY_FAILS\n  install.json not found"
    fi

    # [Fix-3b] 全量 .jsc 文件可加载验证
    if [[ -n "$DMG_NODE" ]]; then
      JSC_TOTAL=0; JSC_FAIL=0
      while IFS= read -r jsc_file; do
        JSC_TOTAL=$((JSC_TOTAL+1))
        JSCR=$("$DMG_NODE" -e "
          const b=require('$DMG_RES/node_modules/bytenode');
          try{b.runBytecodeFile('$jsc_file');process.stdout.write('OK');}
          catch(e){process.stdout.write('ERR:'+e.message.split('\n')[0].substring(0,80));process.exit(1);}
        " 2>/dev/null)
        if [[ "$JSCR" != "OK" ]]; then
          REL="${jsc_file#$DMG_RES/}"
          echo "  [FAIL] jsc: $REL -- $JSCR"
          JSC_FAIL=$((JSC_FAIL+1))
          DMG_VERIFY_FAILS="$DMG_VERIFY_FAILS\n  jsc fail: $REL"
          DMG_VERIFY_OK=false
        fi
      done < <(find "$DMG_RES/dist" "$DMG_RES/extensions" -name "*.jsc" 2>/dev/null | sort)
      echo "  [$([ $JSC_FAIL -eq 0 ] && echo PASS || echo FAIL)] jsc 全量验证: $JSC_TOTAL 个, 失败 $JSC_FAIL 个"
    else
      echo "  [WARN] DMG node binary not found, skipping .jsc load tests"
    fi

    # [Fix-3c] 关键目录存在性（正确路径：dist/ 在 resources/ 下，install.json 在 resources/ 根）
    for chk_dir in dist/gateway dist/agents dist/config dist/security dist/license dist/dispatch dist/mcp dist/memory dist/control-ui extensions/agent-team extensions/orchestrator; do
      if [[ ! -d "$DMG_RES/$chk_dir" ]]; then
        echo "  [FAIL] missing dir: $chk_dir"
        DMG_VERIFY_OK=false
        DMG_VERIFY_FAILS="$DMG_VERIFY_FAILS\n  missing: $chk_dir"
      fi
    done

    # [Fix-3d] integrity-hashes 条目数校验
    DMG_HASH_FILE="$DMG_RES/dist/security/integrity-hashes.json"
    if [[ -f "$DMG_HASH_FILE" ]]; then
      DMG_HASH_COUNT=$(python3 -c "import json; print(len(json.load(open('$DMG_HASH_FILE'))))" 2>/dev/null || echo 0)
      if [[ "$DMG_HASH_COUNT" -ge 50 ]]; then
        echo "  [PASS] integrity-hashes.json: $DMG_HASH_COUNT entries"
      else
        echo "  [FAIL] integrity-hashes.json only $DMG_HASH_COUNT entries (expected >=50)"
        DMG_VERIFY_OK=false
        DMG_VERIFY_FAILS="$DMG_VERIFY_FAILS\n  integrity-hashes: only $DMG_HASH_COUNT entries"
      fi
    fi

    hdiutil detach "$DMG_VERIFY_MOUNT" -force 2>/dev/null || true
    trap - EXIT

    echo ""
    if [[ "$DMG_VERIFY_OK" == "true" ]]; then
      echo "  DMG 全量验证: 全部通过 ✓"
    else
      echo "  DMG 全量验证: 失败！"
      echo -e "$DMG_VERIFY_FAILS"
      echo "ERROR: DMG verification failed. The package has problems." >&2
      exit 1
    fi
  else
    echo "  WARN: 无法挂载 DMG 进行验证 (hdiutil exit $DMG_ATTACH_OK)"
  fi
fi
