#!/usr/bin/env bash
###############################################################################
# Windows 本机构建脚本
# 直接在本机执行 build.ps1，不走 SSH
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 参数解析
VERSION=""
SKIP_DEPLOY=false
DEPLOY_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --skip-deploy) SKIP_DEPLOY=true ;;
    --deploy-only) DEPLOY_ONLY=true ;;
    -*)            ;;
    *)
      if [ -z "$VERSION" ]; then VERSION="$arg"; fi
      ;;
  esac
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🪟 Windows 本机构建"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Project: $PROJECT_ROOT"
echo "Version: ${VERSION:-auto}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$SCRIPT_DIR/logs/build-windows-local-${TIMESTAMP}.log"
mkdir -p "$SCRIPT_DIR/logs"

# 将 PROJECT_ROOT 转为 Windows 路径供 PS1 使用
PROJECT_ROOT_WIN=$(cygpath -w "$PROJECT_ROOT" 2>/dev/null || echo "$PROJECT_ROOT" | sed 's|/d/|D:\\|;s|/|\\|g')
BUILD_PS1_WIN=$(cygpath -w "$PROJECT_ROOT/scripts/desktop/build.ps1" 2>/dev/null || echo "$PROJECT_ROOT/scripts/desktop/build.ps1" | sed 's|/d/|D:\\|;s|/|\\|g')

echo "Build PS1: $BUILD_PS1_WIN"
echo "Log: $LOG_FILE"
echo ""

# 在本机直接执行 build.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "$BUILD_PS1_WIN" 2>&1 | tee "$LOG_FILE"
BUILD_EXIT=${PIPESTATUS[0]}

echo ""
echo "[build-windows.sh] Build exit code: $BUILD_EXIT"

if [ $BUILD_EXIT -eq 0 ]; then
  # Post-build: Pre-Deploy Package Gate
  echo ""
  echo "========================================="
  echo "  Pre-Deploy Package Gate"
  echo "========================================="

  GATE_PASS=true

  # Gate-1: dist/entry.js
  if [ -f "$PROJECT_ROOT/dist/entry.js" ]; then
    echo "  [PASS] dist/entry.js OK"
  else
    echo "  [FAIL] dist/entry.js not found"
    GATE_PASS=false
  fi

  # Gate-2: .jsc bytecode count >= 100
  JSC_COUNT=$(find "$PROJECT_ROOT/dist" -name "*.jsc" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$JSC_COUNT" -ge 100 ]; then
    echo "  [PASS] .jsc bytecode: $JSC_COUNT files (>= 100) OK"
  else
    echo "  [FAIL] .jsc bytecode: only $JSC_COUNT files (< 100)"
    GATE_PASS=false
  fi

  # Gate-3: integrity-hashes.json
  if [ -f "$PROJECT_ROOT/dist/security/integrity-hashes.json" ]; then
    echo "  [PASS] integrity-hashes.json OK"
  else
    echo "  [FAIL] dist/security/integrity-hashes.json not found"
    GATE_PASS=false
  fi

  # Gate-4: control-ui
  if [ -f "$PROJECT_ROOT/dist/control-ui/index.html" ]; then
    echo "  [PASS] control-ui OK"
  else
    echo "  [FAIL] dist/control-ui/index.html not found"
    GATE_PASS=false
  fi

  # Gate-5: extensions (exclude node_modules)
  EXT_COUNT=$(find "$PROJECT_ROOT/extensions" \( -name "*.js" -o -name "*.jsc" \) -not -path "*/node_modules/*" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$EXT_COUNT" -gt 0 ]; then
    echo "  [PASS] extensions: $EXT_COUNT files OK"
  else
    echo "  [FAIL] extensions/ has no .js/.jsc files"
    GATE_PASS=false
  fi

  # Gate-6: workspace templates (AGENTS.md, SOUL.md, etc.)
  # Without these, agent workspace initialization writes empty files and
  # users see "[workspace] Missing workspace template" warnings on every chat.
  RESOURCES_DIR="$PROJECT_ROOT/apps/desktop/src-tauri/resources"
  TMPL_DIR="$RESOURCES_DIR/docs/reference/templates"
  REQUIRED_TEMPLATES="AGENTS.md SOUL.md TOOLS.md IDENTITY.md USER.md HEARTBEAT.md MEMORY.md BOOTSTRAP.md"
  TMPL_MISSING=0
  for tmpl in $REQUIRED_TEMPLATES; do
    if [ ! -f "$TMPL_DIR/$tmpl" ]; then
      echo "  [FAIL] workspace template missing: $tmpl"
      TMPL_MISSING=$((TMPL_MISSING + 1))
    fi
  done
  if [ "$TMPL_MISSING" -eq 0 ]; then
    echo "  [PASS] workspace templates: all 8 present OK"
  else
    echo "  [FAIL] $TMPL_MISSING workspace template(s) missing in resources/docs/reference/templates/"
    GATE_PASS=false
  fi

  # Gate-7: mcp-index.json (MCP marketplace baseline data)
  # Without this, MCP marketplace is empty and skills show "暂不可安装".
  if [ -f "$RESOURCES_DIR/data/mcp-index.json" ]; then
    MCP_SIZE=$(wc -c < "$RESOURCES_DIR/data/mcp-index.json" | tr -d ' ')
    if [ "$MCP_SIZE" -gt 1000 ]; then
      echo "  [PASS] mcp-index.json OK (${MCP_SIZE} bytes)"
    else
      echo "  [FAIL] mcp-index.json too small (${MCP_SIZE} bytes) — likely empty or corrupt"
      GATE_PASS=false
    fi
  else
    echo "  [FAIL] resources/data/mcp-index.json not found"
    GATE_PASS=false
  fi

  # Gate-8: @whiskeysockets/baileys stub (prevents ALL plugins crashing)
  STUB_BASE="$RESOURCES_DIR/node_modules/@whiskeysockets/baileys"
  STUB_OK=true
  for stub_file in package.json index.js index.mjs; do
    stub_path="$STUB_BASE/$stub_file"
    if [ ! -f "$stub_path" ]; then
      echo "  [FAIL] baileys stub missing: $stub_file"
      STUB_OK=false
    else
      stub_size=$(wc -c < "$stub_path" | tr -d ' ')
      if [ "$stub_size" -lt 50 ]; then
        echo "  [FAIL] baileys stub too small (${stub_size}B): $stub_file"
        STUB_OK=false
      fi
    fi
  done
  if [ "$STUB_OK" = "true" ]; then
    echo "  [PASS] @whiskeysockets/baileys stub OK"
  else
    GATE_PASS=false
  fi

  if [ "$GATE_PASS" = "true" ]; then
    echo "  Pre-deploy gate PASSED"
    echo "========================================="
  else
    echo "  Pre-deploy gate FAILED"
    echo "========================================="
    exit 1
  fi

  # 产物列表
  NSIS_DIR="$PROJECT_ROOT/apps/desktop/src-tauri/target/release/bundle/nsis"
  if [ -d "$NSIS_DIR" ]; then
    echo ""
    echo "Artifacts:"
    ls -lh "$NSIS_DIR"/*.exe 2>/dev/null | awk '{print "  " $NF " (" $5 ")"}'
  fi

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ Windows build completed successfully!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
else
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "❌ Windows build failed! (exit $BUILD_EXIT)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
