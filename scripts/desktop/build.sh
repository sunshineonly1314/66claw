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

# ── Step 2b+3: CN encryption chain + UI build (PARALLEL) ──
# Safe to parallelize because:
#   - CN encryption writes to dist/ (cn-protected-files.json listed files only)
#   - UI build writes to dist/control-ui/ (separate subdir, not touched by CN chain)
#   - obfuscate-dist.ts only processes CN-listed files, NOT dist/control-ui/
#   - obfuscate-ui.ts only processes dist/control-ui/ JS files
echo "[2b+3/6] CN encryption + UI build (parallel)..."

# CN encryption chain (background)
(cd "$PROJECT_ROOT" && \
  pnpm build:cn-compile && \
  pnpm build:cn-extensions && \
  pnpm verify:extensions && \
  node --import tsx scripts/obfuscate-dist.ts && \
  node --import tsx cn/scripts/build/compile-bytecode.ts && \
  pnpm integrity:gen && \
  pnpm release:changelog) &
CN_PID=$!

# UI build + UI obfuscation (background)
(
  if [[ -f "$PROJECT_ROOT/ui/package.json" ]]; then
    (cd "$PROJECT_ROOT/ui" && pnpm build)
  fi
  cd "$PROJECT_ROOT" && node --import tsx cn/scripts/build/obfuscate-ui.ts
) &
UI_PID=$!

# Wait for both
# NOTE: 必须用 set +e，否则 set -e 下 wait 遇到非零退出会直接终止脚本
set +e
wait $CN_PID
CN_EXIT=$?
wait $UI_PID
UI_EXIT=$?
set -e

if [[ $CN_EXIT -ne 0 ]]; then
  echo "ERROR: CN encryption chain failed (exit $CN_EXIT)!" >&2
  exit 1
fi
echo "  CN encryption chain OK"

if [[ $UI_EXIT -ne 0 ]]; then
  echo "ERROR: UI build/obfuscation failed (exit $UI_EXIT)!" >&2
  exit 1
fi
echo "  UI build + obfuscation OK"

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

# Find the .app bundle
if [[ -n "$TAURI_TARGET" ]]; then
  APP_FILE=$(find "$TAURI_DIR/target/$TAURI_TARGET/release/bundle/macos" -name "*.app" -maxdepth 1 2>/dev/null | head -1)
  DMG_DIR="$TAURI_DIR/target/$TAURI_TARGET/release/bundle/dmg"
else
  APP_FILE=$(find "$TAURI_DIR/target/release/bundle/macos" -name "*.app" -maxdepth 1 2>/dev/null | head -1)
  DMG_DIR="$TAURI_DIR/target/release/bundle/dmg"
fi

if [[ -n "$APP_FILE" ]]; then
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
fi

# Rebuild DMG after signing changes (Tauri's DMG may have the unsigned .app)
# Use create-dmg.sh to ensure drag-to-install UI (background image + Applications symlink)
# is always present — plain hdiutil create loses the install guide.
if [[ -n "$APP_FILE" ]]; then
  echo "  Rebuilding DMG with signed .app (with drag-to-install guide)..."
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
fi

# ── Done ──
echo ""
echo "========================================"
echo " Build Successful!"
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
