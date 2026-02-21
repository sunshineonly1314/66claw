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

# ── Step 2: Build Node.js backend + CN encryption ──
echo "[2/6] Building Node.js backend (pnpm build:secure)..."
(cd "$PROJECT_ROOT" && pnpm build:secure)
echo "  Backend build + CN encryption OK"

# ── Step 3: Build UI ──
echo "[3/6] Building control UI..."
if [[ -f "$PROJECT_ROOT/ui/package.json" ]]; then
  (cd "$PROJECT_ROOT/ui" && pnpm build)
fi
echo "  UI build OK"

# ── Step 3b: Obfuscate UI bundles ──
echo "[3b/6] Obfuscating UI bundles..."
(cd "$PROJECT_ROOT" && node --import tsx cn/scripts/build/obfuscate-ui.ts)
OBFUSCATE_EXIT=$?
if [[ $OBFUSCATE_EXIT -ne 0 ]]; then
  echo "ERROR: UI obfuscation failed!" >&2
  exit 1
fi
echo "  UI obfuscation OK"

# ── Step 4: Prepare bundled resources ──
echo "[4/6] Preparing bundled resources..."
PREPARE_SCRIPT="$SCRIPT_DIR/prepare-resources.sh"
if [[ -f "$PREPARE_SCRIPT" ]]; then
  bash "$PREPARE_SCRIPT" --arch "$ARCH"
  PREPARE_EXIT=$?
  if [[ $PREPARE_EXIT -ne 0 ]]; then
    echo "ERROR: Resource preparation failed!" >&2
    exit 1
  fi
else
  echo "  WARNING: prepare-resources.sh not found, skipping resource staging." >&2
fi

# ── Step 5: Install Tauri CLI dependencies ──
echo "[5/6] Installing Tauri CLI..."
if [[ -f "$DESKTOP_DIR/package.json" ]]; then
  (cd "$DESKTOP_DIR" && pnpm install)
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
if [[ -n "$APP_FILE" ]] && [[ -d "$DMG_DIR" ]]; then
  echo "  Rebuilding DMG with signed .app..."
  OLD_DMG=$(find "$DMG_DIR" -name "*.dmg" 2>/dev/null | head -1)
  if [[ -n "$OLD_DMG" ]]; then
    DMG_NAME=$(basename "$OLD_DMG")
    TEMP_DMG_DIR=$(mktemp -d)
    # Create new DMG with the signed .app
    hdiutil create -volname "ClawdbotCN" -srcfolder "$APP_FILE" \
      -ov -format UDZO "$TEMP_DMG_DIR/$DMG_NAME" 2>&1
    if [[ -f "$TEMP_DMG_DIR/$DMG_NAME" ]]; then
      mv "$TEMP_DMG_DIR/$DMG_NAME" "$OLD_DMG"
      echo "  DMG rebuilt with signed .app"
    fi
    rm -rf "$TEMP_DMG_DIR"
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
