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

(cd "$DESKTOP_DIR" && pnpm tauri build)
BUILD_EXIT=$?

if [[ $BUILD_EXIT -ne 0 ]]; then
  echo "ERROR: Tauri build failed!" >&2
  echo "  Check that Rust and Xcode CLT are properly installed." >&2
  exit 1
fi

# ── Done ──
echo ""
echo "========================================"
echo " Build Successful!"
echo "========================================"

# Check for DMG output
DMG_FILE=$(find "$TAURI_DIR/target/release/bundle/dmg" -name "*.dmg" 2>/dev/null | head -1)
if [[ -n "$DMG_FILE" ]]; then
  DMG_SIZE=$(du -m "$DMG_FILE" | cut -f1)
  echo "  DMG      : $DMG_FILE"
  echo "  Size     : ${DMG_SIZE} MB"
fi

# Check for .app output
APP_FILE=$(find "$TAURI_DIR/target/release/bundle/macos" -name "*.app" -maxdepth 1 2>/dev/null | head -1)
if [[ -n "$APP_FILE" ]]; then
  echo "  App      : $APP_FILE"
fi

if [[ -z "$DMG_FILE" ]] && [[ -z "$APP_FILE" ]]; then
  echo "  Check: $TAURI_DIR/target/release/bundle/"
fi
