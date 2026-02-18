#!/usr/bin/env bash
# Prepare bundled resources for Tauri desktop build — macOS
# Stages Node.js runtime, backend dist, extensions, skills into apps/desktop/src-tauri/resources/
# Usage: bash scripts/desktop/prepare-resources.sh [arm64|x64|universal]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RESOURCES_DIR="$PROJECT_ROOT/apps/desktop/src-tauri/resources"
ARCH="${1:-universal}"

# Node.js version to download if not cached
NODE_VERSION="22.14.0"

SECONDS=0

echo "========================================"
echo " Tauri Resource Preparation (macOS)"
echo "========================================"
echo "Project root  : $PROJECT_ROOT"
echo "Resources dir : $RESOURCES_DIR"
echo "Architecture  : $ARCH"
echo "Time          : $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Clean previous resources
if [ -d "$RESOURCES_DIR" ]; then
    echo "[Clean] Removing old resources..."
    rm -rf "$RESOURCES_DIR"
    echo "  Done."
fi
mkdir -p "$RESOURCES_DIR"

# ── 1. Node.js runtime ──
step_start=$SECONDS
echo "[1/7] Preparing Node.js runtime..."
NODE_DIR="$RESOURCES_DIR/node"
mkdir -p "$NODE_DIR/bin"

download_node() {
    local target_arch="$1"
    local node_arch
    case "$target_arch" in
        arm64) node_arch="arm64" ;;
        x64)   node_arch="x64" ;;
        *)     node_arch="arm64" ;;  # default to arm64 on Apple Silicon
    esac

    local url="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-${node_arch}.tar.gz"
    local cache_dir="$PROJECT_ROOT/.cache/node"
    local cache_file="$cache_dir/node-v${NODE_VERSION}-darwin-${node_arch}.tar.gz"

    # Use cached download if available
    if [ ! -f "$cache_file" ]; then
        mkdir -p "$cache_dir"
        echo "  Downloading Node.js v${NODE_VERSION} (${node_arch})..."
        curl -fSL "$url" -o "$cache_file"
    else
        echo "  Using cached Node.js v${NODE_VERSION} (${node_arch})"
    fi

    # Extract node binary
    tar -xzf "$cache_file" -C "$NODE_DIR" --strip-components=1
    echo "  OK: node $("$NODE_DIR/bin/node" --version 2>/dev/null || echo 'extracted')"
}

create_universal_node() {
    local arm64_dir="$RESOURCES_DIR/.node-arm64"
    local x64_dir="$RESOURCES_DIR/.node-x64"

    mkdir -p "$arm64_dir" "$x64_dir"

    local arm64_url="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-arm64.tar.gz"
    local x64_url="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-x64.tar.gz"
    local cache_dir="$PROJECT_ROOT/.cache/node"
    mkdir -p "$cache_dir"

    for arch in arm64 x64; do
        local url dir cache_file
        if [ "$arch" = "arm64" ]; then
            url="$arm64_url"
            dir="$arm64_dir"
        else
            url="$x64_url"
            dir="$x64_dir"
        fi
        cache_file="$cache_dir/node-v${NODE_VERSION}-darwin-${arch}.tar.gz"
        if [ ! -f "$cache_file" ]; then
            echo "  Downloading Node.js (${arch})..."
            curl -fSL "$url" -o "$cache_file"
        fi
        tar -xzf "$cache_file" -C "$dir" --strip-components=1
    done

    echo "  Creating universal binary with lipo..."
    cp -R "$arm64_dir/"* "$NODE_DIR/"
    lipo -create "$arm64_dir/bin/node" "$x64_dir/bin/node" -output "$NODE_DIR/bin/node"
    echo "  OK: universal node binary"

    rm -rf "$arm64_dir" "$x64_dir"
}

case "$ARCH" in
    universal) create_universal_node ;;
    arm64|x64) download_node "$ARCH" ;;
    *) echo "ERROR: Unknown arch '$ARCH'"; exit 1 ;;
esac
echo "  [$(( SECONDS - step_start ))s]"

# ── 2. Backend dist ──
step_start=$SECONDS
echo "[2/7] Copying backend dist/..."
if [ -d "$PROJECT_ROOT/dist" ]; then
    cp -R "$PROJECT_ROOT/dist" "$RESOURCES_DIR/dist"
    DIST_SIZE=$(du -sh "$RESOURCES_DIR/dist" | cut -f1)
    # Verify CN encrypted files
    JSC_COUNT=$(find "$RESOURCES_DIR/dist" -name "*.jsc" 2>/dev/null | wc -l | tr -d ' ')
    DISPATCH_OK=$([ -d "$RESOURCES_DIR/dist/dispatch" ] && echo "YES" || echo "NO")
    LICENSE_OK=$([ -d "$RESOURCES_DIR/dist/license" ] && echo "YES" || echo "NO")
    SECURITY_OK=$([ -d "$RESOURCES_DIR/dist/security" ] && echo "YES" || echo "NO")
    echo "  OK: dist/ ($DIST_SIZE) [$(( SECONDS - step_start ))s]"
    echo "  CN encryption check: .jsc=$JSC_COUNT dispatch=$DISPATCH_OK license=$LICENSE_OK security=$SECURITY_OK"
    if [ "$JSC_COUNT" -eq 0 ]; then
        echo "  WARNING: No .jsc bytecode files found! Run 'pnpm build:secure' first."
    fi
else
    echo "  ERROR: dist/ not found. Run 'pnpm build' first."
    exit 1
fi

# ── 3. Production node_modules ──
step_start=$SECONDS
echo "[3/7] Copying production node_modules/..."
if [ -d "$PROJECT_ROOT/node_modules" ]; then
    echo "  Copying node_modules (rsync, this may take a few minutes)..."
    rsync -a --exclude='.cache' --exclude='.turbo' \
        "$PROJECT_ROOT/node_modules/" "$RESOURCES_DIR/node_modules/"
    NM_SIZE=$(du -sh "$RESOURCES_DIR/node_modules" | cut -f1)
    echo "  OK: node_modules/ ($NM_SIZE) [$(( SECONDS - step_start ))s]"

    # Clean broken symlinks (pnpm workspace links)
    echo "  Cleaning broken symlinks..."
    BROKEN_COUNT=0
    while IFS= read -r -d '' link; do
        rm -f "$link"
        BROKEN_COUNT=$((BROKEN_COUNT + 1))
    done < <(find "$RESOURCES_DIR/node_modules" -type l ! -exec test -e {} \; -print0 2>/dev/null)
    echo "  Removed $BROKEN_COUNT broken symlinks"
else
    echo "  WARNING: node_modules not found."
fi

# ── 4. Extensions ──
step_start=$SECONDS
echo "[4/7] Copying extensions/..."
if [ -d "$PROJECT_ROOT/extensions" ]; then
    rsync -a --exclude='node_modules' --exclude='.turbo' \
        "$PROJECT_ROOT/extensions/" "$RESOURCES_DIR/extensions/"
    EXT_COUNT=$(find "$RESOURCES_DIR/extensions" -maxdepth 1 -type d | wc -l | tr -d ' ')
    echo "  OK: extensions/ ($((EXT_COUNT - 1)) extensions) [$(( SECONDS - step_start ))s]"
else
    echo "  WARNING: extensions/ not found."
fi

# ── 5. Skills ──
step_start=$SECONDS
echo "[5/7] Copying skills/..."
SKILLS_FOUND=false
for src in "$PROJECT_ROOT/skills-merged" "$PROJECT_ROOT/skills"; do
    if [ -d "$src" ]; then
        cp -R "$src" "$RESOURCES_DIR/skills"
        SKILL_COUNT=$(find "$RESOURCES_DIR/skills" -maxdepth 1 -type d | wc -l | tr -d ' ')
        echo "  OK: skills/ ($((SKILL_COUNT - 1)) skills) from $src [$(( SECONDS - step_start ))s]"
        SKILLS_FOUND=true
        break
    fi
done
if [ "$SKILLS_FOUND" = "false" ]; then
    echo "  WARNING: skills not found."
fi

# ── 6. Data & docs ──
step_start=$SECONDS
echo "[6/7] Copying data and docs..."
if [ -d "$PROJECT_ROOT/data" ]; then
    cp -R "$PROJECT_ROOT/data" "$RESOURCES_DIR/data" 2>/dev/null || true
    echo "  OK: data/"
fi
if [ -d "$PROJECT_ROOT/docs-cn/reference/templates" ]; then
    mkdir -p "$RESOURCES_DIR/docs/reference"
    cp -R "$PROJECT_ROOT/docs-cn/reference/templates" "$RESOURCES_DIR/docs/reference/templates"
    echo "  OK: docs/reference/templates/"
fi
echo "  [$(( SECONDS - step_start ))s]"

# ── 7. Build metadata ──
echo "[7/7] Copying build metadata..."
cp "$PROJECT_ROOT/package.json" "$RESOURCES_DIR/package.json"
echo "  OK: package.json"

# ── Summary ──
TOTAL_SIZE=$(du -sh "$RESOURCES_DIR" | cut -f1)
TOTAL_SIZE_MB=$(du -sm "$RESOURCES_DIR" | cut -f1)
echo ""
echo "========================================"
echo " Resources ready: $TOTAL_SIZE"
echo " Output: $RESOURCES_DIR"
echo " Time: ${SECONDS}s"
echo "========================================"

# Sanity checks
if [ "$TOTAL_SIZE_MB" -gt 5000 ]; then
    echo " WARNING: Resources > 5GB. Check for unexpected file expansion!"
fi
if [ "$TOTAL_SIZE_MB" -lt 100 ]; then
    echo " WARNING: Resources < 100MB. Likely missing node_modules!"
fi
