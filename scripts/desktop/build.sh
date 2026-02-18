#!/usr/bin/env bash
# Build ClawdbotCN Desktop Application (Tauri) — macOS
# Usage: bash scripts/desktop/build.sh [--arch arm64|x64|universal]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DESKTOP_DIR="$PROJECT_ROOT/apps/desktop"
TAURI_DIR="$DESKTOP_DIR/src-tauri"

# Parse arguments
ARCH="${1:-}"
if [[ "$ARCH" == "--arch" ]]; then
    ARCH="${2:-universal}"
fi
ARCH="${ARCH:-universal}"

echo "========================================"
echo " Building ClawdbotCN Desktop (Tauri)"
echo " Platform: macOS ($ARCH)"
echo "========================================"
echo "Project root : $PROJECT_ROOT"
echo "Tauri source : $TAURI_DIR"
echo ""

# ── Step 1: Verify prerequisites ──
echo "[1/6] Checking prerequisites..."

if ! command -v cargo &>/dev/null; then
    echo "ERROR: Rust/Cargo not found. Install from https://rustup.rs"
    exit 1
fi
echo "  Cargo : $(cargo --version)"

if ! command -v pnpm &>/dev/null; then
    echo "ERROR: pnpm not found."
    exit 1
fi
echo "  pnpm  : $(pnpm --version)"

if ! command -v node &>/dev/null; then
    echo "ERROR: Node.js not found."
    exit 1
fi
echo "  Node  : $(node --version)"
echo ""

# ── Step 2: Build Node.js backend ──
echo "[2/6] Building Node.js backend (pnpm build)..."
(cd "$PROJECT_ROOT" && pnpm build)
echo "  Backend build OK"

# ── Step 3: Build UI ──
echo "[3/6] Building control UI..."
if [ -f "$PROJECT_ROOT/ui/package.json" ]; then
    (cd "$PROJECT_ROOT/ui" && pnpm build)
fi
echo "  UI build OK"

# ── Step 4: Prepare bundled resources ──
echo "[4/6] Preparing bundled resources..."
PREPARE_SCRIPT="$SCRIPT_DIR/prepare-resources.sh"
if [ -f "$PREPARE_SCRIPT" ]; then
    bash "$PREPARE_SCRIPT" "$ARCH"
else
    echo "  WARNING: prepare-resources.sh not found, skipping resource staging."
fi

# ── Step 5: Install Tauri CLI dependencies ──
echo "[5/6] Installing Tauri CLI..."
(cd "$DESKTOP_DIR" && pnpm install)

# ── Step 6: Build Tauri (Rust + bundle) ──
echo "[6/6] Building Tauri native app..."
echo "  (First build may take 5-10 minutes)"

# Set Rust target for cross-compilation if needed
TAURI_ARGS=""
case "$ARCH" in
    arm64)
        export CARGO_BUILD_TARGET="aarch64-apple-darwin"
        TAURI_ARGS="--target aarch64-apple-darwin"
        ;;
    x64)
        export CARGO_BUILD_TARGET="x86_64-apple-darwin"
        TAURI_ARGS="--target x86_64-apple-darwin"
        ;;
    universal)
        TAURI_ARGS="--target universal-apple-darwin"
        ;;
esac

(cd "$DESKTOP_DIR" && pnpm tauri build $TAURI_ARGS)

# ── Done ──
echo ""
echo "========================================"
echo " Build Successful!"
echo "========================================"

DMG=$(find "$TAURI_DIR/target" -name "*.dmg" -type f 2>/dev/null | head -1)
if [ -n "$DMG" ]; then
    DMG_SIZE=$(du -h "$DMG" | cut -f1)
    echo "  DMG  : $DMG"
    echo "  Size : $DMG_SIZE"
else
    echo "  Check: $TAURI_DIR/target/release/bundle/"
fi
