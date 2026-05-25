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

# ── Step 2a-oem: OEM assets injection (MUST run BEFORE UI build) ──
# apply-oem-assets.ts copies oem/ui/* → ui/public/ so Vite bundles them.
# Must run before Step 2b (pnpm build in ui/) otherwise images won't be in dist.
if [[ -n "${VITE_EDITION:-}" && "${VITE_EDITION}" == "overseas" ]]; then
  echo "[2a-oem/6] Applying OEM brand assets (VITE_EDITION=overseas)..."
  (cd "$PROJECT_ROOT" && node --import tsx scripts/apply-oem-assets.ts)
  echo "  OEM assets injected into ui/public/"
else
  echo "[2a-oem/6] VITE_EDITION != overseas — skipping OEM assets"
fi

# -- Step 2b+2c: Core, extension, and UI build --
echo "[2b+2c/6] Core + extension + UI build..."
(cd "$PROJECT_ROOT" && \
  pnpm build && \
  pnpm build:cn-extensions && \
  pnpm verify:extensions && \
  pnpm release:changelog)

if [[ -f "$PROJECT_ROOT/ui/package.json" ]]; then
  (cd "$PROJECT_ROOT/ui" && pnpm build)
fi
echo "  Build pipeline OK"

# ── Step 3b: OEM brand injection (optional) ──
# Set OEM_ID=<name> to apply a brand config from config/oem/<name>.json
# before Tauri bundles. Omit OEM_ID (or set to "default") to use standard brand.
if [[ -n "${OEM_ID:-}" && "${OEM_ID}" != "default" ]]; then
  echo "[3b/6] Applying OEM brand config: $OEM_ID"
  (cd "$PROJECT_ROOT" && node --import tsx scripts/desktop/apply-oem-config.ts)
  echo "  OEM brand config applied (tauri.conf.json: productName/identifier/icon)"
  echo "  Note: OEM UI assets (oem/ui/*) were already injected at Step 2a-oem before UI build"
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
  echo "ERROR: prepare-resources.sh not found at $PREPARE_SCRIPT!" >&2
  echo "  Without resources, Tauri build will produce a broken installer." >&2
  exit 1
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

# ── Step 5.6: Pre-Tauri stub & self-ref validation ──
# Verify critical node_modules artifacts that prepare-resources.sh created.
# This catches corruption between prepare-resources and Tauri build (Gap #1).
echo "[5.6/6] Verifying critical stubs before Tauri compile..."
RESOURCES_DIR="$PROJECT_ROOT/apps/desktop/src-tauri/resources"
PRE_TAURI_OK=true

# (a) @whiskeysockets/baileys stub — without this ALL plugins crash
STUB_BASE="$RESOURCES_DIR/node_modules/@whiskeysockets/baileys"
for stub_file in package.json index.js index.mjs; do
  stub_path="$STUB_BASE/$stub_file"
  if [[ ! -f "$stub_path" ]]; then
    echo "  FAIL: baileys stub missing: $stub_file" >&2
    PRE_TAURI_OK=false
  else
    stub_size=$(wc -c < "$stub_path" 2>/dev/null | tr -d ' ')
    if [[ "$stub_size" -lt 50 ]]; then
      echo "  FAIL: baileys stub too small (${stub_size}B): $stub_file" >&2
      PRE_TAURI_OK=false
    fi
  fi
done

# (b) openclawcn self-ref package — without this plugin-sdk resolution fails
if [[ ! -f "$RESOURCES_DIR/node_modules/openclawcn/package.json" ]]; then
  echo "  FAIL: openclawcn self-ref package.json missing" >&2
  PRE_TAURI_OK=false
fi
if [[ ! -f "$RESOURCES_DIR/dist/plugin-sdk/index.js" ]]; then
  echo "  FAIL: dist/plugin-sdk/index.js missing" >&2
  PRE_TAURI_OK=false
fi

if [[ "$PRE_TAURI_OK" == "true" ]]; then
  echo "  Pre-Tauri validation: OK"
else
  echo "ERROR: Pre-Tauri validation failed — stubs or critical files missing." >&2
  echo "  This means prepare-resources.sh did not complete correctly." >&2
  exit 1
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
    for chk_dir in dist/gateway dist/agents dist/config dist/security dist/dispatch dist/mcp dist/memory dist/control-ui extensions/agent-team extensions/orchestrator; do
      if [[ ! -d "$DMG_RES/$chk_dir" ]]; then
        echo "  [FAIL] missing dir: $chk_dir"
        DMG_VERIFY_OK=false
        DMG_VERIFY_FAILS="$DMG_VERIFY_FAILS\n  missing: $chk_dir"
      fi
    done

    # [Fix-3e] workspace templates 检查
    DMG_TMPL_DIR="$DMG_RES/docs/reference/templates"
    REQUIRED_TEMPLATES="AGENTS.md SOUL.md TOOLS.md IDENTITY.md USER.md HEARTBEAT.md MEMORY.md BOOTSTRAP.md"
    TMPL_MISSING=0
    for tmpl in $REQUIRED_TEMPLATES; do
      if [[ ! -f "$DMG_TMPL_DIR/$tmpl" ]]; then
        echo "  [FAIL] workspace template missing: $tmpl"
        TMPL_MISSING=$((TMPL_MISSING + 1))
        DMG_VERIFY_FAILS="$DMG_VERIFY_FAILS\n  template missing: $tmpl"
      fi
    done
    if [[ "$TMPL_MISSING" -eq 0 ]]; then
      echo "  [PASS] workspace templates: all 8 present"
    else
      DMG_VERIFY_OK=false
    fi

    # [Fix-3f] mcp-index.json 基线数据检查
    DMG_MCP_INDEX="$DMG_RES/data/mcp-index.json"
    if [[ -f "$DMG_MCP_INDEX" ]]; then
      MCP_SIZE=$(wc -c < "$DMG_MCP_INDEX" | tr -d ' ')
      if [[ "$MCP_SIZE" -gt 1000 ]]; then
        echo "  [PASS] mcp-index.json: ${MCP_SIZE} bytes"
      else
        echo "  [FAIL] mcp-index.json too small (${MCP_SIZE} bytes)"
        DMG_VERIFY_OK=false
        DMG_VERIFY_FAILS="$DMG_VERIFY_FAILS\n  mcp-index.json too small: ${MCP_SIZE} bytes"
      fi
    else
      echo "  [FAIL] mcp-index.json not found in DMG"
      DMG_VERIFY_OK=false
      DMG_VERIFY_FAILS="$DMG_VERIFY_FAILS\n  mcp-index.json missing"
    fi

    # [Fix-3g] @whiskeysockets/baileys stub 存在性 + 内容校验
    # Without this stub, ALL plugins crash with "Cannot find module '@whiskeysockets/baileys'"
    STUB_BASE="$DMG_RES/node_modules/@whiskeysockets/baileys"
    STUB_ALL_OK=true
    for stub_file in package.json index.js index.mjs; do
      if [[ ! -f "$STUB_BASE/$stub_file" ]]; then
        echo "  [FAIL] baileys stub missing: $stub_file"
        STUB_ALL_OK=false
        DMG_VERIFY_FAILS="$DMG_VERIFY_FAILS\n  baileys stub missing: $stub_file"
      else
        dmg_stub_size=$(wc -c < "$STUB_BASE/$stub_file" 2>/dev/null | tr -d ' ')
        if [[ "$dmg_stub_size" -lt 50 ]]; then
          echo "  [FAIL] baileys stub too small in DMG (${dmg_stub_size}B): $stub_file"
          STUB_ALL_OK=false
          DMG_VERIFY_FAILS="$DMG_VERIFY_FAILS\n  baileys stub truncated: $stub_file (${dmg_stub_size}B)"
        fi
      fi
    done
    if [[ "$STUB_ALL_OK" == "true" ]]; then
      echo "  [PASS] @whiskeysockets/baileys stub: package.json + index.js + index.mjs"
    else
      DMG_VERIFY_OK=false
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
