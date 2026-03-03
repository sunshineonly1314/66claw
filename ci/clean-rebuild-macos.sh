#!/usr/bin/env bash
###############################################################################
# macOS Clean Rebuild Script v1.6.0
#
# Runs on Mac Mini via SSH. Performs:
#   1. Full cleanup of ALL historical build artifacts
#   2. Git reset + pull latest code
#   3. Pre-flight verification (all extensions, skills, MCP, source files)
#   4. Fresh pnpm install
#   5. scripts/desktop/build.sh (complete build chain):
#      - tsdown base build
#      - CN compile + CN extensions + verify + obfuscate + bytecode + integrity
#      - UI build + UI obfuscation (parallel with CN chain)
#      - prepare-resources + Tauri CLI install
#      - Tauri Rust build → DMG
#   6. Final verification
#
# Requirements:
#   - Node v22.16.0 at /usr/local/lib/nodejs/node-v22.16.0-darwin-arm64/bin
#   - pnpm, Rust/Cargo, Xcode Command Line Tools
#
# Usage:
#   ssh kevinsun@192.168.0.107 'bash ~/clean-rebuild-macos.sh'
###############################################################################

set -euo pipefail

# ═══════════════════════════════════════════════════════
#   CONFIGURATION
# ═══════════════════════════════════════════════════════

WORKSPACE="/Users/kevinsun/cicd-workspace/openclawcn"
VERSION="1.6.0"
ARCH="universal"
NODE_VERSION="22.16.0"

# ── Setup PATH ──
export PATH="/usr/local/lib/nodejs/node-v${NODE_VERSION}-darwin-arm64/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

# Load environment (disable set -e for profile sourcing)
set +e
for f in ~/.zprofile ~/.profile; do
  [ -f "$f" ] && source "$f" 2>/dev/null
done
source "$HOME/.cargo/env" 2>/dev/null
set -e

# Re-pin Node v22.16.0 first (bytecode compatibility)
export PATH="/usr/local/lib/nodejs/node-v${NODE_VERSION}-darwin-arm64/bin:$PATH"

# ── Helpers ──
log() { echo "[$(date '+%H:%M:%S')] $*"; }
log_step() {
  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  $*"
  echo "═══════════════════════════════════════════════════════"
}
err() { echo "ERROR: $*" >&2; }
warn() { echo "WARN: $*" >&2; }

elapsed_since() {
  local start="$1"
  local now
  now=$(date +%s)
  echo "$((now - start))s"
}

BUILD_START=$(date +%s)

log "ClawdbotCN macOS Clean Rebuild"
log "  Version: $VERSION"
log "  Arch: $ARCH"
log "  Node: $(node --version)"
log "  pnpm: $(pnpm --version)"
log "  Cargo: $(cargo --version 2>/dev/null || echo 'not found')"
log ""

# ═══════════════════════════════════════════════════════
#   STEP 0: VERIFY PREREQUISITES
# ═══════════════════════════════════════════════════════
log_step "Step 0: Verify prerequisites"

NODE_ACTUAL=$(node --version)
if [[ "$NODE_ACTUAL" != "v${NODE_VERSION}" ]]; then
  err "Node version mismatch! Expected v${NODE_VERSION}, got $NODE_ACTUAL"
  err "Bytecode compilation REQUIRES exact Node version match."
  exit 1
fi
log "Node v${NODE_VERSION} confirmed"

for tool in pnpm cargo; do
  if ! command -v "$tool" &>/dev/null; then
    err "$tool not found"
    exit 1
  fi
done

if ! xcode-select -p &>/dev/null; then
  err "Xcode Command Line Tools not found"
  exit 1
fi

log "All prerequisites OK"

# ═══════════════════════════════════════════════════════
#   STEP 1: FULL CLEANUP
# ═══════════════════════════════════════════════════════
log_step "Step 1: Full cleanup of ALL historical build artifacts"
STEP_START=$(date +%s)

cd "$WORKSPACE"

# Force git to HTTPS for github.com (no SSH key on Mac Mini)
# Must cover ALL possible SSH URL formats that npm/pnpm dependencies might use
git config --global url."https://github.com/".insteadOf "git+ssh://git@github.com/"
git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"
git config --global url."https://github.com/".insteadOf "git://github.com/"
git config --global url."https://github.com/".insteadOf "git@github.com:"
git config --global url."https://github.com/".insteadOf "git+https://github.com/"
log "Git insteadOf configured: all SSH/git protocols → HTTPS for github.com"

# Show what we're cleaning
log "Before cleanup:"
for d in dist build/output apps/desktop/src-tauri/target node_modules build/download-output \
         .release-cache apps/macos/.build ui/dist ui/node_modules apps/desktop/node_modules \
         native/build .cache; do
  du -sh "$d" 2>/dev/null || true
done

# Remove ALL build outputs
log "Removing all build artifacts..."
rm -rf dist/
rm -rf build/output/
rm -rf apps/desktop/src-tauri/target/
rm -rf apps/macos/.build/
rm -rf ui/dist/
rm -rf node_modules/
rm -rf apps/desktop/node_modules/
rm -rf ui/node_modules/
rm -rf build/download-output/
rm -rf .release-cache/
rm -rf native/build/
rm -rf .cache/
rm -f config/extension-build-manifest.json
find . -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete 2>/dev/null || true

log "Cleanup completed ($(elapsed_since $STEP_START))"
log "Disk free: $(df -h /Users/kevinsun | tail -1 | awk '{print $4}')"

# ═══════════════════════════════════════════════════════
#   STEP 2: GIT RESET + PULL LATEST
# ═══════════════════════════════════════════════════════
log_step "Step 2: Git reset + pull latest code"
STEP_START=$(date +%s)

git checkout -- . 2>/dev/null || true
git clean -fd 2>/dev/null || true
git fetch origin
git reset --hard origin/master

log "Current commit: $(git log --oneline -1)"
git status --short

# Verify version
ACTUAL_VERSION=$(node -p "require('./package.json').version")
if [[ "$ACTUAL_VERSION" != "$VERSION" ]]; then
  warn "Version mismatch: package.json=$ACTUAL_VERSION, expected=$VERSION"
  VERSION="$ACTUAL_VERSION"
fi
log "Version: $VERSION"
log "Git reset completed ($(elapsed_since $STEP_START))"

# ═══════════════════════════════════════════════════════
#   STEP 3: PRE-FLIGHT SOURCE FILE CHECK
# ═══════════════════════════════════════════════════════
log_step "Step 3: Pre-flight source file verification"

PREFLIGHT_FAIL=0

# Critical CN source files
CRITICAL_FILES=(
  src/config/region-cn.ts
  src/config/cn-mirrors.ts
  src/config/cn-mirrors-data.ts
  src/dispatch/engine.ts
  cn/scripts/build/compile-bytecode.ts
  cn/scripts/build/compile-extensions.ts
  cn/scripts/build/verify-extensions.ts
  cn/scripts/build/obfuscate.config.js
  cn/scripts/build/obfuscate-ui.ts
  config/cn-protected-files.json
  scripts/obfuscate-dist.ts
  scripts/generate-integrity-hashes.ts
  scripts/desktop/build.sh
  scripts/desktop/prepare-resources.sh
)

for src_check in "${CRITICAL_FILES[@]}"; do
  if [[ ! -f "$src_check" ]]; then
    err "Missing: $src_check"
    PREFLIGHT_FAIL=1
  fi
done

# CN extension directories (cn_extension_build)
CN_EXTENSIONS=(openclawwechat agent-team orchestrator memory-core dingtalk feishu)
for ext in "${CN_EXTENSIONS[@]}"; do
  if [[ ! -d "extensions/$ext" ]]; then
    err "Missing CN extension: extensions/$ext"
    PREFLIGHT_FAIL=1
  else
    log "  extensions/$ext: OK"
  fi
done

# All extensions count
TOTAL_EXT=$(ls -d extensions/*/ 2>/dev/null | wc -l | tr -d ' ')
log "Total extensions: $TOTAL_EXT"
if [[ "$TOTAL_EXT" -lt 35 ]]; then
  err "Only $TOTAL_EXT extensions — expected 35+!"
  PREFLIGHT_FAIL=1
fi

# List all extensions for audit
log "Extension inventory:"
ls extensions/ 2>/dev/null | while read -r ext; do
  log "  - $ext"
done

# Skills
TOTAL_SKILLS=$(ls -d skills/*/ 2>/dev/null | wc -l | tr -d ' ')
log "Skills: $TOTAL_SKILLS"
if [[ "$TOTAL_SKILLS" -lt 500 ]]; then
  err "Only $TOTAL_SKILLS skills — expected 500+!"
  PREFLIGHT_FAIL=1
fi

# MCP data
if [[ -f "data/mcp-index.json" ]]; then
  MCP_ITEMS=$(node -pe "JSON.parse(require('fs').readFileSync('data/mcp-index.json','utf8')).items?.length||0" 2>/dev/null || echo 0)
  log "MCP index: $MCP_ITEMS items"
  if [[ "$MCP_ITEMS" -lt 1000 ]]; then
    err "MCP index only $MCP_ITEMS items — expected 1000+!"
    PREFLIGHT_FAIL=1
  fi
else
  err "Missing data/mcp-index.json!"
  PREFLIGHT_FAIL=1
fi

# MCP enhanced index
ENHANCED_COUNT=$(ls data/mcp-index-enhanced*.json 2>/dev/null | wc -l | tr -d ' ')
log "MCP enhanced indexes: $ENHANCED_COUNT files"

# Bytecode target directories
for bdir in src/dispatch src/license src/security src/memory; do
  if [[ ! -d "$bdir" ]]; then
    err "Missing bytecode dir: $bdir"
    PREFLIGHT_FAIL=1
  else
    FILE_COUNT=$(find "$bdir" -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')
    log "  $bdir: $FILE_COUNT .ts files"
  fi
done

if [[ "$PREFLIGHT_FAIL" -eq 1 ]]; then
  err "Pre-flight FAILED. Fix issues above before building."
  exit 1
fi
log "Pre-flight: ALL PASSED"

# ═══════════════════════════════════════════════════════
#   STEP 4: INSTALL DEPENDENCIES
# ═══════════════════════════════════════════════════════
log_step "Step 4: Install dependencies (fresh pnpm install)"
STEP_START=$(date +%s)

pnpm install --no-frozen-lockfile 2>&1 || pnpm install 2>&1
log "Dependencies installed ($(elapsed_since $STEP_START))"

# ═══════════════════════════════════════════════════════
#   STEP 5: FULL BUILD (scripts/desktop/build.sh)
#
#   This script executes the COMPLETE build chain:
#   [2a/6] pnpm build (tsdown — base TypeScript compilation)
#   [2b+3/6] PARALLEL:
#     - CN encryption: cn-compile + cn-extensions + verify + obfuscate + bytecode + integrity + changelog
#     - UI: vite build + UI obfuscation
#   [4+5/6] PARALLEL:
#     - prepare-resources.sh (stage dist/, extensions/, skills/, data/ into Tauri resources)
#     - Tauri CLI install (apps/desktop pnpm install)
#   [6/6] Tauri build (Rust compilation + .app bundle + DMG)
#   [7/7] Post-build: ad-hoc signing + LSArchitecturePriority
# ═══════════════════════════════════════════════════════
log_step "Step 5: Full desktop build (build + encrypt + UI + Tauri → DMG)"
STEP_START=$(date +%s)

BUILD_SCRIPT="scripts/desktop/build.sh"
chmod +x "$BUILD_SCRIPT"
bash "$BUILD_SCRIPT" --arch "$ARCH"

log "Desktop build completed ($(elapsed_since $STEP_START))"

# ═══════════════════════════════════════════════════════
#   STEP 6: FINAL VERIFICATION
# ═══════════════════════════════════════════════════════
log_step "Step 6: Final verification"

VERIFY_FAIL=0

# Find DMG
case "$ARCH" in
  arm64)     TAURI_TARGET="aarch64-apple-darwin" ;;
  x64)       TAURI_TARGET="x86_64-apple-darwin" ;;
  universal) TAURI_TARGET="universal-apple-darwin" ;;
  *)         TAURI_TARGET="" ;;
esac

if [[ -n "$TAURI_TARGET" ]]; then
  DMG_DIR="apps/desktop/src-tauri/target/$TAURI_TARGET/release/bundle/dmg"
else
  DMG_DIR="apps/desktop/src-tauri/target/release/bundle/dmg"
fi

DMG_FILE=$(find "$DMG_DIR" -name "*.dmg" 2>/dev/null | head -1)

# 6a. DMG
if [[ -n "$DMG_FILE" ]] && [[ -f "$DMG_FILE" ]]; then
  DMG_SIZE=$(du -m "$DMG_FILE" | cut -f1)
  DMG_SHA=$(shasum -a 256 "$DMG_FILE" | cut -d' ' -f1)
  log "DMG: $DMG_FILE (${DMG_SIZE}MB)"
  log "SHA256: $DMG_SHA"
else
  err "DMG not found in $DMG_DIR!"
  ls -la "$DMG_DIR/" 2>/dev/null || true
  VERIFY_FAIL=1
fi

# 6b. Bytecode (.jsc)
FINAL_JSC=$(find dist -name "*.jsc" 2>/dev/null | wc -l | tr -d ' ')
log "Bytecode .jsc files: $FINAL_JSC"
if [[ "$FINAL_JSC" -lt 5 ]]; then
  err "Insufficient .jsc files: $FINAL_JSC (expected 5+)"
  VERIFY_FAIL=1
fi

# Verify bytecode in each critical directory
for bc_dir in dist/dispatch dist/license dist/security dist/memory; do
  if [[ -d "$bc_dir" ]]; then
    BC_COUNT=$(find "$bc_dir" -name "*.jsc" 2>/dev/null | wc -l | tr -d ' ')
    log "  $bc_dir: $BC_COUNT .jsc"
    if [[ "$BC_COUNT" -lt 1 ]]; then
      err "$bc_dir has NO .jsc files!"
      VERIFY_FAIL=1
    fi
  else
    err "$bc_dir directory missing from dist!"
    VERIFY_FAIL=1
  fi
done

# 6c. CN extensions compiled
for cn_ext in "${CN_EXTENSIONS[@]}"; do
  EXT_JS=$(find "extensions/$cn_ext" -name "*.js" 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$EXT_JS" -lt 1 ]]; then
    err "Extension $cn_ext: no compiled .js files!"
    VERIFY_FAIL=1
  else
    log "  extensions/$cn_ext: $EXT_JS .js"
  fi
done

# 6d. UI
if [[ -f "dist/control-ui/index.html" ]]; then
  UI_SIZE=$(du -sh dist/control-ui/ 2>/dev/null | awk '{print $1}')
  log "  Web UI: OK ($UI_SIZE)"
else
  err "Web UI missing!"
  VERIFY_FAIL=1
fi

# 6e. Integrity hashes
if [[ -f "dist/integrity-hashes.json" ]]; then
  HASH_COUNT=$(node -pe "Object.keys(JSON.parse(require('fs').readFileSync('dist/integrity-hashes.json','utf8'))).length" 2>/dev/null || echo 0)
  log "  Integrity hashes: $HASH_COUNT entries"
else
  warn "  No integrity-hashes.json"
fi

# 6f. Changelog
if [[ -f "CHANGELOG.md" ]]; then
  log "  CHANGELOG.md: OK"
fi

if [[ "$VERIFY_FAIL" -eq 1 ]]; then
  err "Final verification FAILED!"
  exit 1
fi

log "Final verification: ALL PASSED"

# ═══════════════════════════════════════════════════════
#   SUMMARY
# ═══════════════════════════════════════════════════════
TOTAL_TIME=$(elapsed_since $BUILD_START)

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ClawdbotCN v${VERSION} macOS Build — SUCCESS"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "  Version:    $VERSION"
echo "  Arch:       $ARCH"
echo "  Node:       v${NODE_VERSION}"
echo "  Build time: $TOTAL_TIME"
echo ""
if [[ -n "${DMG_FILE:-}" ]]; then
echo "  DMG:        $DMG_FILE"
echo "  DMG Size:   ${DMG_SIZE}MB"
echo "  SHA256:     $DMG_SHA"
fi
echo ""
echo "  Protection:"
echo "    Bytecode (.jsc):  $FINAL_JSC files"
echo "    Dirs protected:   dispatch, license, security, memory"
echo "    Ext protected:    agent-team, orchestrator (bytecode)"
echo "    Obfuscation:      All CN code (RC4)"
echo "    UI:               Obfuscated (RC4)"
echo ""
echo "  Content:"
echo "    Extensions:       $TOTAL_EXT"
echo "    Skills:           $TOTAL_SKILLS"
echo "    MCP Items:        $MCP_ITEMS"
echo ""
echo "════════════════════════════════════════════════════════════"
