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

# PINNED: must match bytecode compilation Node version exactly (V8 bytecode is version-specific)
NODE_VERSION="22.16.0"

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
    # npm/npx/lib: use arm64 (pure JS, arch-independent)
    NODE_REF_ARCH="arm64"
    ;;
  arm64|x64)
    download_node "$ARCH"
    cp "$NODE_DL_DIR/node-${ARCH}/bin/node" "$RESOURCES_DIR/node/bin/node"
    NODE_REF_ARCH="$ARCH"
    ;;
esac

chmod +x "$RESOURCES_DIR/node/bin/node"

# ── [Fix: npx/npm/lib bundling] ─────────────────────────────────────────────
# macOS MCP 进程需要 npx 来启动 MCP server。
# 只拷 node 单文件会导致用户系统 npx 版本不一致 → MCP 全部报 Connection closed。
# (同样的 Bug 已在 Windows prepare-resources.ps1 修复，现在 macOS 同步修复)
log "  Copying npm/npx/lib from node-${NODE_REF_ARCH}..."
NODE_REF_DIR="$NODE_DL_DIR/node-${NODE_REF_ARCH}"

# Copy npm and npx binaries
for bin in npm npx; do
  if [[ -f "$NODE_REF_DIR/bin/$bin" ]]; then
    cp "$NODE_REF_DIR/bin/$bin" "$RESOURCES_DIR/node/bin/$bin"
    chmod +x "$RESOURCES_DIR/node/bin/$bin"
    log "    Copied bin/$bin"
  else
    warn "    bin/$bin not found in $NODE_REF_DIR/bin/"
  fi
done

# Copy lib/node_modules (npm, corepack) — needed by npm/npx at runtime
if [[ -d "$NODE_REF_DIR/lib/node_modules" ]]; then
  mkdir -p "$RESOURCES_DIR/node/lib"
  cp -R "$NODE_REF_DIR/lib/node_modules" "$RESOURCES_DIR/node/lib/node_modules"
  log "    Copied lib/node_modules/"
else
  warn "    lib/node_modules/ not found in $NODE_REF_DIR — npx may fail"
fi

# Verify npx/npm are present (hard failure — same as Windows fix)
if [[ ! -f "$RESOURCES_DIR/node/bin/npm" ]] || [[ ! -f "$RESOURCES_DIR/node/bin/npx" ]]; then
  err "CRITICAL: npm or npx missing from bundled node/bin/!"
  err "  MCP servers that use npx will fail with 'Connection closed' for all users."
  err "  Source dir: $NODE_REF_DIR/bin/"
  ls "$NODE_REF_DIR/bin/" 2>/dev/null || true
  exit 1
fi
log "  npm/npx bundled OK"

# Clear quarantine and ad-hoc sign for macOS
xattr -cr "$RESOURCES_DIR/node/bin/node" 2>/dev/null || true
codesign --sign - --force "$RESOURCES_DIR/node/bin/node" 2>/dev/null || true

NODE_SIZE=$(du -sm "$RESOURCES_DIR/node" | cut -f1)
log "  OK: node runtime ($NODE_SIZE MB, $ARCH, includes npm/npx) [$(( $(date +%s) - STEP_START ))s]"

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

  # Remove private GUI automation tools from dist (must NOT ship in installer)
  GUI_TOOL_FILES=(
    "agents/tools/wechat-send.js"
    "agents/tools/wechat-check.js"
    "agents/tools/wechat-read.js"
    "agents/tools/wecom-send.js"
    "agents/tools/wecom-check.js"
    "agents/tools/wecom-read.js"
    "agents/tools/wecom-auto-reply.js"
    "agents/tools/wecom-broadcast.js"
    "agents/tools/wecom-patrol.js"
    "agents/tools/wecom-group-summary.js"
    "agents/tools/wecom-helpers.js"
    "agents/tools/wecom-cs-config.js"
    "agents/tools/wecom-handoff.js"
    "agents/tools/wecom-ticket.js"
  )
  GUI_REMOVED=0
  for f in "${GUI_TOOL_FILES[@]}"; do
    for ext in "" ".map"; do
      target="$RESOURCES_DIR/dist/${f}${ext}"
      [[ -f "$target" ]] && rm -f "$target" && GUI_REMOVED=$((GUI_REMOVED + 1))
    done
    # Also remove .jsc and .d.ts variants
    jsc_target="$RESOURCES_DIR/dist/${f%.js}.jsc"
    [[ -f "$jsc_target" ]] && rm -f "$jsc_target" && GUI_REMOVED=$((GUI_REMOVED + 1))
    dts_target="$RESOURCES_DIR/dist/${f%.js}.d.ts"
    [[ -f "$dts_target" ]] && rm -f "$dts_target"
  done
  log "  Removed $GUI_REMOVED private GUI automation files from dist/"

  # ── 2b. Create src/infra/safe-rename.js shim for orchestrator extension ──
  # extensions/orchestrator/src/state.jsc (bytecode) resolves the import
  # "../../../src/infra/safe-rename.js" relative to its own directory, which
  # maps to resources/src/infra/safe-rename.js.  The actual file lives at
  # resources/dist/infra/safe-rename.js, so we create a re-export shim.
  mkdir -p "$RESOURCES_DIR/src/infra"
  printf 'module.exports = require("../../dist/infra/safe-rename.js");\n' \
    > "$RESOURCES_DIR/src/infra/safe-rename.js"
  # The main app is ESM — without this package.json, Node treats .js as ESM
  # and the CJS shim fails with "module is not defined".
  printf '{"type":"commonjs"}\n' > "$RESOURCES_DIR/src/package.json"
  log "  Created src/infra/safe-rename.js shim (orchestrator compat)"

  # ── 2c. src/infra/dedupe.js CJS shim ──
  # hook-error-logger.jsc resolves require("../../../src/infra/dedupe.js")
  # relative to extensions/agent-team/src/, mapping to resources/src/infra/dedupe.js.
  cat > "$RESOURCES_DIR/src/infra/dedupe.js" << 'DEDUPEEOF'
function createDedupeCache(options) {
    var ttlMs = Math.max(0, options.ttlMs);
    var maxSize = Math.max(0, Math.floor(options.maxSize));
    var cache = new Map();
    var ops = 0, lastPrune = Date.now();
    var touch = function(k,n) { cache.delete(k); cache.set(k,n); };
    var maybePrune = function(now) {
        if (ttlMs > 0) { cache.forEach(function(t,k) { if (now-t >= ttlMs) cache.delete(k); }); }
        if (maxSize > 0 && cache.size > maxSize) {
            while (cache.size > maxSize) { var k=cache.keys().next().value; if(!k) break; cache.delete(k); }
        }
        if (++ops >= 10 && now-lastPrune >= 100) { ops=0; lastPrune=now; }
    };
    return {
        check: function(key, now) {
            now = now || Date.now();
            if (!key) return false;
            var e = cache.get(key);
            if (e !== undefined && (ttlMs <= 0 || now-e < ttlMs)) { touch(key,now); return true; }
            touch(key,now); maybePrune(now); return false;
        },
        clear: function() { cache.clear(); },
        size: function() { return cache.size; },
    };
}
exports.createDedupeCache = createDedupeCache;
DEDUPEEOF
  log "  Created src/infra/dedupe.js CJS shim (hook-error-logger compat)"

  # ── 2a. Fix rolldown chunk circular dependency in plugin-sdk ──
  # rolldown splits dist/plugin-sdk/index.js into index.js + pi-model-discovery-*.js
  # The chunk file imports { t as __exportAll } from "./index.js", but index.js
  # imports the chunk as a side-effect on line 1.  In ESM, `var __exportAll`
  # (line 63 of index.js) is hoisted as `undefined` during the circular evaluation,
  # causing "TypeError: __exportAll is not a function".
  # Fix: inline __exportAll definition directly in the chunk file so it does
  # not depend on index.js's var being initialized first.
  PLUGIN_SDK_DIR="$RESOURCES_DIR/dist/plugin-sdk"
  CHUNK_FILE=$(ls "$PLUGIN_SDK_DIR"/pi-model-discovery-*.js 2>/dev/null | head -1)
  if [[ -n "$CHUNK_FILE" ]] && grep -q 'import { t as __exportAll } from "./index.js"' "$CHUNK_FILE" 2>/dev/null; then
    sed -i '' 's|import { t as __exportAll } from "./index.js";|var __defProp = Object.defineProperty; var __exportAll = (all, no_symbols) => { let target = {}; for (var name in all) { __defProp(target, name, { get: all[name], enumerable: true }); } if (!no_symbols) { __defProp(target, Symbol.toStringTag, { value: "Module" }); } return target; };|' "$CHUNK_FILE" 2>/dev/null \
      || sed -i 's|import { t as __exportAll } from "./index.js";|var __defProp = Object.defineProperty; var __exportAll = (all, no_symbols) => { let target = {}; for (var name in all) { __defProp(target, name, { get: all[name], enumerable: true }); } if (!no_symbols) { __defProp(target, Symbol.toStringTag, { value: "Module" }); } return target; };|' "$CHUNK_FILE"
    log "  Fixed plugin-sdk chunk circular dependency (inlined __exportAll)"
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

# Remove dependencies that have git:// sub-dependencies (unreachable from CN network).
# @whiskeysockets/baileys depends on libsignal-node via git+https://github.com/...
# which requires github.com access for git ls-remote. WhatsApp channel is not needed
# in the desktop app, so we remove it before npm install.
GIT_DEP_PACKAGES=("@whiskeysockets/baileys")
for pkg in "${GIT_DEP_PACKAGES[@]}"; do
  log "  Removing git-dep package from temp package.json: $pkg"
  node -e "
    const fs = require('fs');
    const p = JSON.parse(fs.readFileSync('$TEMP_INSTALL_DIR/package.json', 'utf8'));
    if (p.dependencies && p.dependencies['$pkg']) delete p.dependencies['$pkg'];
    if (p.optionalDependencies && p.optionalDependencies['$pkg']) delete p.optionalDependencies['$pkg'];
    // Also remove from pnpm overrides if present
    if (p.pnpm && p.pnpm.onlyBuiltDependencies) {
      p.pnpm.onlyBuiltDependencies = p.pnpm.onlyBuiltDependencies.filter(d => d !== '$pkg');
    }
    fs.writeFileSync('$TEMP_INSTALL_DIR/package.json', JSON.stringify(p, null, 2) + '\n');
  "
done

# Run npm install with production deps only
# NOTE: Do NOT use --omit=optional here. It can cause transitive dependency
# resolution to skip packages like @aws-sdk/client-bedrock that are required
# at runtime. Optional peerDependencies (node-llama-cpp, @napi-rs/canvas)
# won't be installed anyway since they aren't in the npm dependency tree.
log "  Running npm install --omit=dev (registry: $NPM_REGISTRY)..."
NPM_LOG="$TEMP_INSTALL_DIR/npm-install.log"
if ! (cd "$TEMP_INSTALL_DIR" && npm install --omit=dev --ignore-scripts --no-audit --no-fund \
    --legacy-peer-deps --registry "$NPM_REGISTRY" 2>&1 | tee "$NPM_LOG" | tail -10); then
  err "npm install --omit=dev failed. Full log:"
  cat "$NPM_LOG" | tail -50
  rm -rf "$TEMP_INSTALL_DIR"
  exit 1
fi

# Verify critical runtime dependencies are present
CRITICAL_DEPS=(
  "@aws-sdk/client-bedrock"
  "@aws-sdk/client-bedrock-runtime"
  "express"
  "zod"
)
for dep in "${CRITICAL_DEPS[@]}"; do
  if [[ ! -d "$TEMP_INSTALL_DIR/node_modules/$dep" ]]; then
    err "CRITICAL: $dep missing from production node_modules!"
    err "  This will cause Gateway startup failure. Aborting build."
    cat "$NPM_LOG" | tail -30
    rm -rf "$TEMP_INSTALL_DIR"
    exit 1
  fi
done
log "  Critical deps verified: ${CRITICAL_DEPS[*]}"

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

# ── 3b. Apply pnpm patches to production node_modules ──
# pnpm patchedDependencies only apply during pnpm install, not npm install.
# We must manually apply patches from the patches/ directory.
# Patch filename format: @scope__pkg@version.patch → @scope/pkg
#                         pkg@version.patch       → pkg
PATCHES_DIR="$PROJECT_ROOT/patches"
if [[ -d "$PATCHES_DIR" ]]; then
  PATCH_COUNT=0
  for patch_file in "$PATCHES_DIR"/*.patch; do
    [[ -f "$patch_file" ]] || continue
    # Derive npm package name from pnpm patch filename
    base="$(basename "$patch_file" .patch)"           # e.g. @mariozechner__pi-coding-agent@0.52.12
    pkg_with_ver="${base}"
    # Strip trailing @version (last @ segment)
    pkg_name="${pkg_with_ver%@*}"                      # e.g. @mariozechner__pi-coding-agent
    # Convert double-underscore back to slash for scoped packages
    pkg_name="${pkg_name//__//}"                        # e.g. @mariozechner/pi-coding-agent
    pkg_dir="$RESOURCES_DIR/node_modules/$pkg_name"
    if [[ ! -d "$pkg_dir" ]]; then
      warn "  Patch target not found, skipping: $pkg_name ($(basename "$patch_file"))"
      continue
    fi
    log "  Applying patch to $pkg_name: $(basename "$patch_file")"
    # Check if patch is already applied (dry-run with --reverse)
    if (cd "$pkg_dir" && patch -p1 --reverse --dry-run --batch < "$patch_file" >/dev/null 2>&1); then
      log "    Already applied, skipping: $(basename "$patch_file")"
      PATCH_COUNT=$((PATCH_COUNT + 1))
    elif (cd "$pkg_dir" && patch -p1 --forward --batch < "$patch_file"); then
      PATCH_COUNT=$((PATCH_COUNT + 1))
    else
      err "  FAILED to apply patch: $(basename "$patch_file") to $pkg_name"
      err "  This may cause runtime crashes. Check if package version matches patch."
    fi
  done
  if [[ "$PATCH_COUNT" -gt 0 ]]; then
    log "  Applied $PATCH_COUNT patch(es) to production node_modules"
  fi
fi

# NOTE: Fix A (openclawcn self-ref package) moved to after step 4c (stub injection)
# to prevent npm install in step 4b from wiping the package.

# NOTE: Stub injection for @whiskeysockets/baileys moved to after step 4b
# (extension dependency install) to prevent npm install from overwriting stubs.

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

  # ── 4a. Remove .ts source files from compiled extensions ──
  # Extensions listed in cn_extension_build have pre-compiled .js files.
  # If .ts files remain, the plugin discovery (index.ts > index.js priority)
  # will load the .ts via jiti, which fails in the packaged environment because
  # the bundled openclawcn/plugin-sdk uses chunk references that jiti cannot resolve.
  CN_EXT_DIRS=$(node -e "
    const cfg = require('$PROJECT_ROOT/config/cn-protected-files.json');
    (cfg.cn_extension_build?.directories || []).forEach(d => console.log(d));
  " 2>/dev/null || true)
  TS_REMOVED=0
  while IFS= read -r ext_rel; do
    [[ -z "$ext_rel" ]] && continue
    ext_abs="$RESOURCES_DIR/$ext_rel"
    if [[ -d "$ext_abs" ]]; then
      while IFS= read -r ts_file; do
        rm -f "$ts_file"
        TS_REMOVED=$((TS_REMOVED + 1))
      done < <(find "$ext_abs" -name '*.ts' -not -name '*.d.ts' 2>/dev/null)
    fi
  done <<< "$CN_EXT_DIRS"
  if [[ "$TS_REMOVED" -gt 0 ]]; then
    log "  Removed $TS_REMOVED .ts source files from compiled extensions (keeps .js only)"
  fi

  # Also rewrite package.json "extensions" entries from .ts to .js
  # so that plugin discovery resolves to the compiled .js files.
  PKG_REWRITTEN=0
  while IFS= read -r ext_rel; do
    [[ -z "$ext_rel" ]] && continue
    ext_pkg="$RESOURCES_DIR/${ext_rel}package.json"
    if [[ -f "$ext_pkg" ]]; then
      if grep -q '\.ts"' "$ext_pkg" 2>/dev/null; then
        sed -i '' 's/\.ts"/\.js"/g' "$ext_pkg" 2>/dev/null || sed -i 's/\.ts"/\.js"/g' "$ext_pkg"
        PKG_REWRITTEN=$((PKG_REWRITTEN + 1))
      fi
    fi
  done <<< "$CN_EXT_DIRS"
  if [[ "$PKG_REWRITTEN" -gt 0 ]]; then
    log "  Rewrote $PKG_REWRITTEN package.json files (.ts → .js references)"
  fi

  # ── 4b. Install extension-specific dependencies into bundled node_modules ──
  # Extensions have their own package.json with deps (e.g. dingtalk-stream,
  # qq-bot-sdk) not in the main package.json. Install them into the shared
  # resources/node_modules so extensions can require() them at runtime.
  log "  Installing extension dependencies..."
  EXT_DEPS_MISSING=()
  for ext_dir in "$EXT_SOURCE"/*/; do
    ext_pkg="$ext_dir/package.json"
    if [[ -f "$ext_pkg" ]]; then
      # Extract dependency names and versions from package.json
      deps=$(node -e "
        const p = require('$ext_pkg');
        const deps = p.dependencies || {};
        for (const [name, ver] of Object.entries(deps)) {
          console.log(name + '@' + ver);
        }
      " 2>/dev/null || true)
      while IFS= read -r dep; do
        [[ -z "$dep" ]] && continue
        dep_name="${dep%%@*}"
        # Handle scoped packages (@scope/name@version)
        if [[ "$dep" == @* ]]; then
          dep_name="@${dep#@}"
          dep_name="${dep_name%@*}"
        fi
        if [[ ! -d "$RESOURCES_DIR/node_modules/$dep_name" ]]; then
          EXT_DEPS_MISSING+=("$dep")
        fi
      done <<< "$deps"
    fi
  done

  if [[ ${#EXT_DEPS_MISSING[@]} -gt 0 ]]; then
    # Deduplicate
    UNIQUE_DEPS=($(printf '%s\n' "${EXT_DEPS_MISSING[@]}" | sort -u))
    log "  Missing extension deps: ${UNIQUE_DEPS[*]}"
    (
      cd "$RESOURCES_DIR"
      # Use a sanitized package.json: remove deps with git:// sub-deps
      # (e.g. @whiskeysockets/baileys → libsignal-node via git+ssh://github.com,
      #        @vector-im/matrix-bot-sdk → @niceboybao/libsignal-protocol via git+ssh)
      node -e "
        const fs = require('fs');
        const p = JSON.parse(fs.readFileSync('$PROJECT_ROOT/package.json', 'utf8'));
        const gitDeps = ['@whiskeysockets/baileys'];
        gitDeps.forEach(d => { delete (p.dependencies||{})[d]; delete (p.optionalDependencies||{})[d]; });
        if (p.pnpm && p.pnpm.onlyBuiltDependencies) {
          p.pnpm.onlyBuiltDependencies = p.pnpm.onlyBuiltDependencies.filter(d => !gitDeps.includes(d));
        }
        fs.writeFileSync('$RESOURCES_DIR/package.json', JSON.stringify(p, null, 2) + '\n');
      "
      # Ensure git uses HTTPS for github.com (no SSH key available in CI)
      git config --global url."https://github.com/".insteadOf "ssh://git@github.com/" 2>/dev/null || true
      # Filter out deps that have git+ssh sub-dependencies (cause npm install to fail)
      FILTERED_DEPS=()
      GIT_SSH_DEPS="@vector-im/matrix-bot-sdk @matrix-org/matrix-sdk-crypto-nodejs"
      for dep in "${UNIQUE_DEPS[@]}"; do
        dep_name="${dep%%@[0-9]*}"
        dep_name="${dep_name%%@^*}"
        skip=false
        for git_dep in $GIT_SSH_DEPS; do
          if [[ "$dep_name" == "$git_dep" ]]; then
            log "  Skipping $dep (has git+ssh sub-deps)"
            skip=true
            break
          fi
        done
        if [[ "$skip" == "false" ]]; then
          FILTERED_DEPS+=("$dep")
        fi
      done
      if [[ ${#FILTERED_DEPS[@]} -gt 0 ]]; then
        if npm install "${FILTERED_DEPS[@]}" --no-save --ignore-scripts --no-audit --no-fund \
            --legacy-peer-deps --registry "$NPM_REGISTRY" 2>&1 | tail -5; then
          log "  OK: installed ${#FILTERED_DEPS[@]} extension deps"
        else
          warn "npm install for extension deps failed (non-fatal, continuing)"
        fi
      else
        log "  All filtered deps skipped (git+ssh sub-deps)"
      fi
    ) || warn "Extension dependency install subshell failed (non-fatal)"
  else
    log "  All extension deps already present in node_modules"
  fi
else
  warn "extensions/ not found."
fi

# ── 4c. Inject stub modules for stripped packages ──
# MUST run AFTER step 4b (extension dependency install) to prevent npm from
# overwriting stubs with broken/incomplete real packages.
# The plugin-sdk bundle has require("@whiskeysockets/baileys") calls (WhatsApp
# onboarding adapter marked as external). Without a stub, ALL plugins crash
# with "Cannot find module '@whiskeysockets/baileys'" even if they have nothing
# to do with WhatsApp.
STUB_PACKAGES=("@whiskeysockets/baileys")
for stub_pkg in "${STUB_PACKAGES[@]}"; do
  stub_dir="$RESOURCES_DIR/node_modules/$stub_pkg"
  # Force-create (overwrite if exists) — npm install may have left a broken copy
  mkdir -p "$stub_dir"
  # CJS+ESM stub with named exports required by plugin-sdk ESM imports
  # (e.g. `import { DisconnectReason } from '@whiskeysockets/baileys'`)
  cat > "$stub_dir/package.json" <<'STUBPKG'
{"name":"@whiskeysockets/baileys","version":"0.0.0-stub","main":"index.js","exports":{".":{"require":"./index.js","import":"./index.mjs","default":"./index.mjs"}},"description":"Stub: WhatsApp channel not available in desktop builds"}
STUBPKG
  cat > "$stub_dir/index.js" <<'STUBJS'
function noop() {}
var DisconnectReason = {loggedOut:"loggedOut",connectionClosed:"connectionClosed",connectionLost:"connectionLost",connectionReplaced:"connectionReplaced",timedOut:"timedOut",forbidden:"403",badSession:"bad session",restartRequired:"restart required",multideviceMismatch:"multidevice mismatch"};
exports.DisconnectReason = DisconnectReason;
exports.fetchLatestBaileysVersion = async function() { return {version:[2,3000,0],isLatest:true}; };
exports.makeCacheableSignalKeyStore = function(store) { return store||{}; };
exports.makeWASocket = function() { return {}; };
exports.useMultiFileAuthState = async function() { return {state:{},saveCreds:noop}; };
exports.proto = {};
exports.default = exports;
module.exports = Object.assign(noop, exports);
STUBJS
  cat > "$stub_dir/index.mjs" <<'STUBMJS'
function noop() {}
export const DisconnectReason = {loggedOut:"loggedOut",connectionClosed:"connectionClosed",connectionLost:"connectionLost",connectionReplaced:"connectionReplaced",timedOut:"timedOut",forbidden:"403",badSession:"bad session",restartRequired:"restart required",multideviceMismatch:"multidevice mismatch"};
export const fetchLatestBaileysVersion = async function() { return {version:[2,3000,0],isLatest:true}; };
export const makeCacheableSignalKeyStore = function(store) { return store||{}; };
export const makeWASocket = function() { return {}; };
export const useMultiFileAuthState = async function() { return {state:{},saveCreds:noop}; };
export const proto = {};
export default {};
STUBMJS
  log "  Injected stub module: $stub_pkg (CJS+ESM, force-overwrite)"
done

# Verify all stub packages were actually written (prevents silent failure)
for stub_pkg in "${STUB_PACKAGES[@]}"; do
  stub_dir="$RESOURCES_DIR/node_modules/$stub_pkg"
  for stub_file in package.json index.js index.mjs; do
    stub_path="$stub_dir/$stub_file"
    if [[ ! -f "$stub_path" ]]; then
      err "CRITICAL: Stub file missing: $stub_path"
      err "  Without this stub, ALL plugins will crash at runtime."
      exit 1
    fi
    stub_size=$(wc -c < "$stub_path" 2>/dev/null | tr -d ' ')
    if [[ "$stub_size" -lt 50 ]]; then
      err "CRITICAL: Stub file too small (${stub_size} bytes): $stub_path"
      err "  File may be empty or truncated. ALL plugins will crash."
      exit 1
    fi
  done
  log "  Verified stub: $stub_pkg (package.json + index.js + index.mjs, content OK)"
done

# ── 4d. Fix A: openclawcn self-referencing package ──
# MUST run AFTER step 4b (npm install) — otherwise npm install wipes this package.
# Extensions compiled as .jsc call require('openclawcn/plugin-sdk').
# In packaged build there is no pnpm workspace — node_modules/openclawcn/ must
# exist with plugin-sdk so the resolution works.
# NOTE: Do NOT use symlink — Tauri DMG bundler drops symlinks silently. Real copy only.
SELF_PKG_DIR="$RESOURCES_DIR/node_modules/openclawcn"
mkdir -p "$SELF_PKG_DIR/dist"
cp "$PROJECT_ROOT/package.json" "$SELF_PKG_DIR/package.json"
if [[ -d "$RESOURCES_DIR/dist/plugin-sdk" ]]; then
  cp -R "$RESOURCES_DIR/dist/plugin-sdk" "$SELF_PKG_DIR/dist/plugin-sdk"
  log "  Created openclawcn self-referencing package (plugin-sdk real copy) [Fix A]"
else
  warn "  Fix A: dist/plugin-sdk not found — openclawcn self-ref package incomplete"
fi

# ── 5. Skills ──
STEP_START=$(date +%s)
log "[5/7] Copying skills/..."

# Skills that must NOT be bundled (WeChat/WeCom desktop automation — in skills-private/)
EXCLUDED_SKILLS="wechat-desktop wecom-desktop"

SKILLS_FOUND=false
mkdir -p "$RESOURCES_DIR/skills"
for skills_src in "$PROJECT_ROOT/skills-merged" "$PROJECT_ROOT/skills" "$PROJECT_ROOT/full-skills"; do
  if [[ -d "$skills_src" ]]; then
    for skill_dir in "$skills_src"/*/; do
      skill_name=$(basename "$skill_dir")
      if echo "$EXCLUDED_SKILLS" | grep -qw "$skill_name"; then
        continue
      fi
      # Skip if already copied from a higher-priority source (merge without overwrite)
      if [[ -d "$RESOURCES_DIR/skills/$skill_name" ]]; then
        continue
      fi
      cp -R "$skill_dir" "$RESOURCES_DIR/skills/$skill_name"
    done
    # Copy top-level files (README, index, etc.)
    find "$skills_src" -maxdepth 1 -type f -exec cp {} "$RESOURCES_DIR/skills/" \;
    SKILLS_COUNT=$(find "$RESOURCES_DIR/skills" -maxdepth 1 -type d | wc -l | tr -d ' ')
    SKILLS_COUNT=$((SKILLS_COUNT - 1))
    log "  OK: skills/ ($SKILLS_COUNT skills total) merged from $skills_src [$(( $(date +%s) - STEP_START ))s]"
    SKILLS_FOUND=true
  fi
done
# NOTE: skills-private/ is intentionally NOT copied (contains wechat-desktop, wecom-desktop)
if [[ "$SKILLS_FOUND" != "true" ]]; then
  err "skills/ directory not found! Skills page will be empty."
  exit 1
fi
# Verify minimum skills count
BUNDLED_SKILLS=$(find "$RESOURCES_DIR/skills" -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
BUNDLED_SKILLS=$((BUNDLED_SKILLS - 1))
if [[ "$BUNDLED_SKILLS" -lt 500 ]]; then
  err "Only $BUNDLED_SKILLS skills bundled — expected 500+. Check git push completeness."
  exit 1
fi

# ── 6. Data & docs ──
STEP_START=$(date +%s)
log "[6/7] Copying data and docs..."

if [[ -d "$PROJECT_ROOT/data" ]]; then
  mkdir -p "$RESOURCES_DIR/data"
  # Copy selective seed data (not user runtime data like sessions, logs)
  # SECURITY: Never include clawdbot.json (contains channel secrets, API keys),
  #           agents/ (contains auth-profiles with API keys, session logs),
  #           identity/ (contains device-auth tokens).
  #           These are user-specific runtime data, not distributable seed data.
  SEED_FILES=(
    "mcp-index.db"
    "mcp-index.json"
    "tool-index.sqlite"
    "skill-availability-dictionary.json"
    "skill-availability-schema.json"
    "skill-verification-needed.json"
    "skills-availability-dictionary.json"
    "skills-availability-dictionary-enriched.json"
    "README-skill-availability.md"
  )
  SEED_DIRS=("subagents" "qrcodes")
  for f in "${SEED_FILES[@]}"; do
    if [[ -f "$PROJECT_ROOT/data/$f" ]]; then
      src="$PROJECT_ROOT/data/$f"
      dst="$RESOURCES_DIR/data/$f"
      case "$f" in
        *.db|*.sqlite)
          # Fix D: Use VACUUM INTO for clean checkpoint copy of WAL-mode SQLite DB
          # Direct cp of a WAL-mode DB copies an inconsistent snapshot when -wal/-shm exist
          # NODE_PATH must include production node_modules where better-sqlite3 is installed
          if NODE_PATH="$RESOURCES_DIR/node_modules" node -e "
const Database = require('better-sqlite3');
try {
  const db = new Database('$src', {readonly:true});
  db.exec(\"VACUUM INTO '$dst'\");
  db.close();
  process.exit(0);
} catch(e) {
  process.stderr.write('VACUUM failed: '+e.message+'\n');
  process.exit(1);
}" 2>/dev/null; then
            log "  VACUUM INTO: $f (clean checkpoint copy)"
          else
            cp "$src" "$dst"
            warn "  VACUUM INTO failed for $f — used direct cp (WAL corruption possible)"
          fi
          ;;
        *)
          cp "$src" "$dst"
          ;;
      esac
    fi
  done
  # Copy mcp-index-enhanced (any version: v4, v5, etc.)
  for enhanced in "$PROJECT_ROOT"/data/mcp-index-enhanced*.json; do
    [[ -f "$enhanced" ]] && cp "$enhanced" "$RESOURCES_DIR/data/$(basename "$enhanced")"
  done
  for d in "${SEED_DIRS[@]}"; do
    if [[ -d "$PROJECT_ROOT/data/$d" ]]; then
      cp -R "$PROJECT_ROOT/data/$d" "$RESOURCES_DIR/data/$d"
    fi
  done
  # Ensure mcp-index.json exists (Gateway warns if missing).
  # A minimal seed is enough — runtime sync will fetch the full index.
  if [[ ! -f "$RESOURCES_DIR/data/mcp-index.json" ]]; then
    log "  Creating minimal mcp-index.json seed (full index synced at runtime)"
    echo '{"items":[],"generated":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","seed":true}' \
      > "$RESOURCES_DIR/data/mcp-index.json"
  fi
  # Verify MCP index has enough items
  MCP_ITEMS=$(node -pe "JSON.parse(require('fs').readFileSync('$RESOURCES_DIR/data/mcp-index.json','utf8')).items?.length||0" 2>/dev/null || echo 0)
  if [[ "$MCP_ITEMS" -lt 1000 ]]; then
    err "MCP index only has $MCP_ITEMS items — expected 1000+. MCP page will be nearly empty!"
    exit 1
  fi
  log "  MCP index: $MCP_ITEMS items"
  # Check enhanced index
  ENHANCED_COUNT=$(ls "$RESOURCES_DIR"/data/mcp-index-enhanced*.json 2>/dev/null | wc -l | tr -d ' ')
  [[ "$ENHANCED_COUNT" -gt 0 ]] && log "  MCP enhanced index: $ENHANCED_COUNT files" || warn "  No mcp-index-enhanced*.json — Chinese translations missing"
  # Fix D (WAL cleanup): Remove WAL/SHM residual files after copy
  # VACUUM INTO should produce clean files, but guard against any fallback cp paths
  find "$RESOURCES_DIR/data" \( -name "*.db-wal" -o -name "*.db-shm" \
      -o -name "*.sqlite-wal" -o -name "*.sqlite-shm" \) 2>/dev/null | xargs rm -f 2>/dev/null || true
  log "  Removed WAL/SHM residual files from data/"
  DATA_SIZE=$(du -sh "$RESOURCES_DIR/data" 2>/dev/null | cut -f1)
  log "  OK: data/ ($DATA_SIZE, seed data only)"
fi
# 🔥 P0 修复: 先复制 docs/reference/templates/ 作为 base，再用 CN 版本覆盖
# 之前只从 docs-cn/ 复制（目录只有 .gitkeep），导致模板缺失，chat 无法使用
if [[ -d "$PROJECT_ROOT/docs/reference/templates" ]]; then
  mkdir -p "$RESOURCES_DIR/docs/reference"
  cp -R "$PROJECT_ROOT/docs/reference/templates" "$RESOURCES_DIR/docs/reference/templates"
  log "  OK: docs/reference/templates/ (base)"
fi
# CN overlay: 覆盖上游模板（如果有 CN 本地化版本）
if [[ -d "$PROJECT_ROOT/cn/docs-cn/reference/templates" ]]; then
  mkdir -p "$RESOURCES_DIR/docs/reference/templates"
  cp -f "$PROJECT_ROOT/cn/docs-cn/reference/templates/"* "$RESOURCES_DIR/docs/reference/templates/" 2>/dev/null || true
  log "  OK: docs/reference/templates/ (CN overlay)"
fi
log "  [$(( $(date +%s) - STEP_START ))s]"

# ── 7. Build metadata ──
log "[7/7] Generating build metadata..."

cp "$PROJECT_ROOT/package.json" "$RESOURCES_DIR/package.json"
log "  OK: package.json"

# Generate install.json for auto-update system
APP_VERSION=$(node -p "require('$PROJECT_ROOT/package.json').version" 2>/dev/null || echo "0.0.0")
cat > "$RESOURCES_DIR/install.json" <<EOF
{"installKind":"installer","updateServer":"https://www.obplugins.cn","version":"$APP_VERSION"}
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
  # CRITICAL: Do NOT fall back to system node — its V8 version may differ from the
  # bundled node, causing build-meta.json to record wrong versions.
  err "Bundled node binary not found at $NODE_BIN"
  err "Cannot generate accurate build-meta.json. Aborting."
  exit 1
fi
mkdir -p "$RESOURCES_DIR/dist"
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
