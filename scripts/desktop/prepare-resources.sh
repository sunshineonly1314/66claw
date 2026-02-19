#!/usr/bin/env bash
# Prepare bundled resources for Tauri desktop build — macOS
# Stages Node.js runtime, backend dist, extensions, skills into apps/desktop/src-tauri/resources/
#
# Usage: bash scripts/desktop/prepare-resources.sh [--arch universal|arm64|x64]
#
# Corresponds to: scripts/desktop/prepare-resources.ps1 (Windows)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RESOURCES_DIR="$PROJECT_ROOT/apps/desktop/src-tauri/resources"

# ── Parse arguments ──
ARCH="${ARCH:-$(uname -m)}"
# Normalize: aarch64 → arm64
case "$ARCH" in
  aarch64|arm64) ARCH="arm64" ;;
  x86_64|x64)    ARCH="x64" ;;
  universal)     ARCH="universal" ;;
  *) echo "ERROR: Invalid architecture '$ARCH'. Must be: universal, arm64, x64" >&2; exit 1 ;;
esac

while [[ $# -gt 0 ]]; do
  case "$1" in
    --arch) ARCH="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

NODE_VERSION="${NODE_VERSION:-22.14.0}"

log() { echo "[$(date '+%H:%M:%S')] $*"; }
warn() { echo "WARN: $*" >&2; }
err() { echo "ERROR: $*" >&2; }

echo "========================================"
echo " Tauri Resource Preparation (macOS)"
echo "========================================"
echo "Project root  : $PROJECT_ROOT"
echo "Resources dir : $RESOURCES_DIR"
echo "Architecture  : $ARCH"
echo "Node.js       : v$NODE_VERSION"
echo "Time          : $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Clean previous resources
if [[ -d "$RESOURCES_DIR" ]]; then
  log "[Clean] Removing old resources..."
  rm -rf "$RESOURCES_DIR"
fi
mkdir -p "$RESOURCES_DIR"

TOTAL_START=$(date +%s)

# ── 1. Node.js runtime ──
log "[1/7] Preparing Node.js runtime..."
STEP_START=$(date +%s)

NODE_DL_DIR="$PROJECT_ROOT/build/download-output/node"
mkdir -p "$NODE_DL_DIR"
mkdir -p "$RESOURCES_DIR/node/bin"

download_node() {
  local arch="$1"
  local filename="node-v${NODE_VERSION}-darwin-${arch}.tar.gz"
  local tar_file="$NODE_DL_DIR/$filename"
  local extract_dir="$NODE_DL_DIR/node-${arch}"

  if [[ -f "$extract_dir/bin/node" ]]; then
    log "  Node.js $arch already downloaded"
    return
  fi

  local mirrors=(
    "https://npmmirror.com/mirrors/node/v${NODE_VERSION}/$filename"
    "https://nodejs.org/dist/v${NODE_VERSION}/$filename"
  )

  local ok=false
  for url in "${mirrors[@]}"; do
    log "  Downloading Node.js v${NODE_VERSION} for $arch from ${url%%/node*}..."
    if curl -fSL --connect-timeout 15 --max-time 300 --retry 2 "$url" -o "$tar_file" 2>/dev/null; then
      if gzip -t "$tar_file" 2>/dev/null; then
        ok=true
        break
      else
        warn "Downloaded file is corrupt, trying next mirror..."
        rm -f "$tar_file"
      fi
    else
      warn "Download failed, trying next mirror..."
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
  log "  Node.js $arch downloaded and extracted"
}

case "$ARCH" in
  universal)
    download_node "arm64"
    download_node "x64"
    # Create universal binary with lipo
    log "  Creating universal Node.js binary with lipo..."
    lipo -create \
      "$NODE_DL_DIR/node-arm64/bin/node" \
      "$NODE_DL_DIR/node-x64/bin/node" \
      -output "$RESOURCES_DIR/node/bin/node"
    ;;
  arm64|x64)
    download_node "$ARCH"
    cp "$NODE_DL_DIR/node-${ARCH}/bin/node" "$RESOURCES_DIR/node/bin/node"
    ;;
esac

chmod +x "$RESOURCES_DIR/node/bin/node"

# Clear quarantine and ad-hoc sign for macOS
xattr -cr "$RESOURCES_DIR/node/bin/node" 2>/dev/null || true
codesign --sign - --force "$RESOURCES_DIR/node/bin/node" 2>/dev/null || true

NODE_SIZE=$(du -m "$RESOURCES_DIR/node/bin/node" | cut -f1)
log "  OK: node ($NODE_SIZE MB, $ARCH) [$(( $(date +%s) - STEP_START ))s]"

# ── 2. Backend dist ──
STEP_START=$(date +%s)
log "[2/7] Copying backend dist/..."

DIST_SOURCE="$PROJECT_ROOT/dist"
if [[ -d "$DIST_SOURCE" ]]; then
  cp -R "$DIST_SOURCE" "$RESOURCES_DIR/dist"
  DIST_SIZE=$(du -sm "$RESOURCES_DIR/dist" | cut -f1)

  # Verify CN encrypted files
  JSC_COUNT=$(find "$RESOURCES_DIR/dist" -name "*.jsc" 2>/dev/null | wc -l | tr -d ' ')
  DISPATCH_EXISTS=$([[ -d "$RESOURCES_DIR/dist/dispatch" ]] && echo "true" || echo "false")
  LICENSE_EXISTS=$([[ -d "$RESOURCES_DIR/dist/license" ]] && echo "true" || echo "false")
  SECURITY_EXISTS=$([[ -d "$RESOURCES_DIR/dist/security" ]] && echo "true" || echo "false")

  log "  OK: dist/ (${DIST_SIZE} MB) [$(( $(date +%s) - STEP_START ))s]"
  if [[ "$JSC_COUNT" -gt 0 ]]; then
    log "  CN encryption check: .jsc=$JSC_COUNT dispatch=$DISPATCH_EXISTS license=$LICENSE_EXISTS security=$SECURITY_EXISTS"
  else
    warn "  No .jsc bytecode files found! Run 'pnpm build:secure' first."
  fi
else
  err "dist/ not found. Run 'pnpm build' first."
  exit 1
fi

# ── 3. Production node_modules ──
STEP_START=$(date +%s)
log "[3/7] Installing production node_modules/..."

# CRITICAL: pnpm uses hardlinks to a global store. cp expands each hardlink
# into an independent file copy: 1.5GB real → 18GB copied.
# Solution: use npm install --prod in a temp dir to get a flat, real node_modules.
TEMP_INSTALL_DIR=$(mktemp -d /tmp/clawdbot-prod-nm-XXXXXX)

log "  Strategy: npm install --omit=dev in temp dir (avoids pnpm hardlink expansion)"
log "  Temp dir: $TEMP_INSTALL_DIR"

# Select fastest npm registry
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

NPM_REGISTRY=$(select_npm_registry)

# Copy package.json and .npmrc to temp dir
cp "$PROJECT_ROOT/package.json" "$TEMP_INSTALL_DIR/package.json"
if [[ -f "$PROJECT_ROOT/.npmrc" ]]; then
  cp "$PROJECT_ROOT/.npmrc" "$TEMP_INSTALL_DIR/.npmrc"
fi

# Run npm install with production deps only
# --omit=optional skips optional peerDependencies (node-llama-cpp, @napi-rs/canvas)
log "  Running npm install --omit=dev --omit=optional (registry: $NPM_REGISTRY)..."
if ! (cd "$TEMP_INSTALL_DIR" && npm install --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund \
    --registry "$NPM_REGISTRY" 2>&1 | tail -5); then
  err "npm install --omit=dev failed"
  rm -rf "$TEMP_INSTALL_DIR"
  exit 1
fi

# Remove packages not needed at runtime (pulled in as transitive deps)
for pkg in typescript @typescript; do
  if [[ -d "$TEMP_INSTALL_DIR/node_modules/$pkg" ]]; then
    log "  Removing unnecessary package: $pkg"
    rm -rf "$TEMP_INSTALL_DIR/node_modules/$pkg"
  fi
done

if [[ -d "$TEMP_INSTALL_DIR/node_modules" ]]; then
  cp -R "$TEMP_INSTALL_DIR/node_modules" "$RESOURCES_DIR/node_modules"
  NM_SIZE=$(du -sm "$RESOURCES_DIR/node_modules" | cut -f1)
  NM_FILES=$(find "$RESOURCES_DIR/node_modules" -type f | wc -l | tr -d ' ')
  log "  OK: node_modules/ (${NM_SIZE} MB, $NM_FILES files) [npm prod] [$(( $(date +%s) - STEP_START ))s]"

  if [[ "$NM_SIZE" -gt 5000 ]]; then
    err "node_modules > 5GB (${NM_SIZE} MB)! Likely hardlink expansion. Aborting."
    rm -rf "$RESOURCES_DIR/node_modules"
    rm -rf "$TEMP_INSTALL_DIR"
    exit 1
  fi
else
  err "npm install produced no node_modules directory"
  rm -rf "$TEMP_INSTALL_DIR"
  exit 1
fi

rm -rf "$TEMP_INSTALL_DIR"

# ── 4. Extensions ──
STEP_START=$(date +%s)
log "[4/7] Copying extensions/..."

EXT_SOURCE="$PROJECT_ROOT/extensions"
if [[ -d "$EXT_SOURCE" ]]; then
  mkdir -p "$RESOURCES_DIR/extensions"
  # Copy excluding node_modules and .turbo
  rsync -a --exclude='node_modules' --exclude='.turbo' --exclude='.git' "$EXT_SOURCE/" "$RESOURCES_DIR/extensions/"
  EXT_COUNT=$(find "$RESOURCES_DIR/extensions" -maxdepth 1 -type d | wc -l | tr -d ' ')
  EXT_COUNT=$((EXT_COUNT - 1))  # subtract the directory itself
  log "  OK: extensions/ ($EXT_COUNT extensions) [$(( $(date +%s) - STEP_START ))s]"
else
  warn "extensions/ not found."
fi

# ── 5. Skills ──
STEP_START=$(date +%s)
log "[5/7] Copying skills/..."

SKILLS_FOUND=false
for skills_src in "$PROJECT_ROOT/skills-merged" "$PROJECT_ROOT/skills"; do
  if [[ -d "$skills_src" ]]; then
    cp -R "$skills_src" "$RESOURCES_DIR/skills"
    SKILLS_COUNT=$(find "$RESOURCES_DIR/skills" -maxdepth 1 -type d | wc -l | tr -d ' ')
    SKILLS_COUNT=$((SKILLS_COUNT - 1))
    log "  OK: skills/ ($SKILLS_COUNT skills) from $skills_src [$(( $(date +%s) - STEP_START ))s]"
    SKILLS_FOUND=true
    break
  fi
done
if [[ "$SKILLS_FOUND" != "true" ]]; then
  warn "skills not found. Skills will be unavailable."
fi

# ── 6. Data & docs ──
STEP_START=$(date +%s)
log "[6/7] Copying data and docs..."

if [[ -d "$PROJECT_ROOT/data" ]]; then
  cp -R "$PROJECT_ROOT/data" "$RESOURCES_DIR/data"
  log "  OK: data/"
fi
if [[ -d "$PROJECT_ROOT/docs-cn/reference/templates" ]]; then
  mkdir -p "$RESOURCES_DIR/docs/reference"
  cp -R "$PROJECT_ROOT/docs-cn/reference/templates" "$RESOURCES_DIR/docs/reference/templates"
  log "  OK: docs/reference/templates/"
fi
log "  [$(( $(date +%s) - STEP_START ))s]"

# ── 7. Build metadata ──
log "[7/7] Generating build metadata..."

cp "$PROJECT_ROOT/package.json" "$RESOURCES_DIR/package.json"
log "  OK: package.json"

# Generate install.json for auto-update system
APP_VERSION=$(node -p "require('$PROJECT_ROOT/package.json').version" 2>/dev/null || echo "0.0.0")
cat > "$RESOURCES_DIR/install.json" <<EOF
{"installKind":"installer","updateServer":"https://dl.openclawcn.com","version":"$APP_VERSION"}
EOF
log "  OK: install.json (version=$APP_VERSION)"

# Generate version.json
cat > "$RESOURCES_DIR/version.json" <<EOF
{"version":"$APP_VERSION","buildTime":"$(date -u '+%Y-%m-%dT%H:%M:%SZ')","platform":"macos","arch":"$ARCH"}
EOF
log "  OK: version.json"

# Generate build-meta.json — records Node.js and V8 versions used during build
NODE_BIN="$RESOURCES_DIR/node/bin/node"
if [[ -x "$NODE_BIN" ]]; then
  BUILD_NODE_VERSION=$("$NODE_BIN" -e "process.stdout.write(process.version)" 2>/dev/null || echo "unknown")
  BUILD_V8_VERSION=$("$NODE_BIN" -e "process.stdout.write(process.versions.v8)" 2>/dev/null || echo "unknown")
else
  BUILD_NODE_VERSION=$(node -e "process.stdout.write(process.version)" 2>/dev/null || echo "unknown")
  BUILD_V8_VERSION=$(node -e "process.stdout.write(process.versions.v8)" 2>/dev/null || echo "unknown")
fi
cat > "$RESOURCES_DIR/dist/build-meta.json" <<EOF
{"nodeVersion":"$BUILD_NODE_VERSION","v8Version":"$BUILD_V8_VERSION","buildTime":"$(date -u '+%Y-%m-%dT%H:%M:%SZ')","appVersion":"$APP_VERSION"}
EOF
log "  OK: build-meta.json (node=$BUILD_NODE_VERSION, v8=$BUILD_V8_VERSION)"

# ── Summary ──
TOTAL_SIZE=$(du -sm "$RESOURCES_DIR" | cut -f1)
TOTAL_ELAPSED=$(( $(date +%s) - TOTAL_START ))

echo ""
echo "========================================"
echo " Resources ready: ${TOTAL_SIZE} MB"
echo " Output: $RESOURCES_DIR"
echo " Time: $((TOTAL_ELAPSED / 60))m $((TOTAL_ELAPSED % 60))s"
echo "========================================"

# Sanity checks
if [[ "$TOTAL_SIZE" -gt 5000 ]]; then
  warn "Resources > 5GB (${TOTAL_SIZE} MB). Check for pnpm hardlink expansion!"
fi
if [[ "$TOTAL_SIZE" -lt 100 ]]; then
  warn "Resources < 100MB (${TOTAL_SIZE} MB). Likely missing node_modules!"
fi
