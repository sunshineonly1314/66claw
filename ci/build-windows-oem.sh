#!/usr/bin/env bash
###############################################################################
# OEM Windows 构建脚本 (默认白牌，隐藏所有CN自有品牌入口)
#
# 用法:
#   bash ci/build-windows-oem.sh                     # 使用 default OEM
#   OEM_ID=mypartner bash ci/build-windows-oem.sh    # 使用指定OEM配置
#
# 与标准 build-windows.sh 的区别:
#   - VITE_EDITION=overseas  → 隐藏 showPurchaseEntry/showSupportQrcode/showAdaptationNotice
#   - OEM_ID=default         → 加载 config/oem/default.json 品牌配置 (仅改 tauri.conf 元数据)
#   - 其余打包流程完全相同
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

export VITE_EDITION="${VITE_EDITION:-overseas}"
export OEM_ID="${OEM_ID:-default}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🪟 Windows OEM Build"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Project     : $PROJECT_ROOT"
echo "OEM_ID      : $OEM_ID"
echo "VITE_EDITION: $VITE_EDITION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$SCRIPT_DIR/logs/build-windows-oem-${OEM_ID}-${TIMESTAMP}.log"
mkdir -p "$SCRIPT_DIR/logs"

BUILD_PS1_WIN=$(cygpath -w "$PROJECT_ROOT/scripts/desktop/build.ps1" 2>/dev/null || \
  echo "$PROJECT_ROOT/scripts/desktop/build.ps1" | sed 's|/d/|D:\\|;s|/|\\|g')

echo "Build PS1: $BUILD_PS1_WIN"
echo "Log: $LOG_FILE"
echo ""

# 启动 build.ps1，传入 VITE_EDITION 和 OEM_ID 环境变量
powershell -NoProfile -ExecutionPolicy Bypass \
  -Command "
    \$env:VITE_EDITION = '$VITE_EDITION'
    \$env:OEM_ID       = '$OEM_ID'
    & '$BUILD_PS1_WIN'
    exit \$LASTEXITCODE
  " 2>&1 | tee "$LOG_FILE"
BUILD_EXIT=${PIPESTATUS[0]}

echo ""
echo "[build-windows-oem.sh] Build exit code: $BUILD_EXIT"

if [ $BUILD_EXIT -eq 0 ]; then
  echo ""
  echo "========================================="
  echo "  Pre-Deploy Package Gate"
  echo "========================================="
  GATE_PASS=true

  if [ -f "$PROJECT_ROOT/dist/entry.js" ]; then
    echo "  [PASS] dist/entry.js OK"
  else
    echo "  [FAIL] dist/entry.js not found"
    GATE_PASS=false
  fi

  JSC_COUNT=$(find "$PROJECT_ROOT/dist" -name "*.jsc" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$JSC_COUNT" -ge 100 ]; then
    echo "  [PASS] .jsc bytecode: $JSC_COUNT files OK"
  else
    echo "  [FAIL] .jsc bytecode: only $JSC_COUNT files (< 100)"
    GATE_PASS=false
  fi

  if [ -f "$PROJECT_ROOT/dist/security/integrity-hashes.json" ]; then
    echo "  [PASS] integrity-hashes.json OK"
  else
    echo "  [FAIL] dist/security/integrity-hashes.json not found"
    GATE_PASS=false
  fi

  if [ -f "$PROJECT_ROOT/dist/control-ui/index.html" ]; then
    echo "  [PASS] control-ui OK"
  else
    echo "  [FAIL] dist/control-ui/index.html not found"
    GATE_PASS=false
  fi

  EXT_COUNT=$(find "$PROJECT_ROOT/extensions" \( -name "*.js" -o -name "*.jsc" \) \
    -not -path "*/node_modules/*" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$EXT_COUNT" -gt 0 ]; then
    echo "  [PASS] extensions: $EXT_COUNT files OK"
  else
    echo "  [FAIL] extensions/ has no .js/.jsc files"
    GATE_PASS=false
  fi

  # OEM 专项检查：确认 EDITION 常量已注入为 overseas
  EDITION_CHECK=$(grep -c '"overseas"' "$PROJECT_ROOT/dist/control-ui/assets/"*.js 2>/dev/null | \
    awk -F: '{s+=$2} END{print s}' || echo "0")
  if [ "${EDITION_CHECK:-0}" -gt 0 ]; then
    echo "  [PASS] VITE_EDITION=overseas 已注入 control-ui"
  else
    echo "  [WARN] 未在 control-ui/assets/ 中找到 overseas 字符串，请确认 brand 注入"
  fi

  if [ "$GATE_PASS" = "true" ]; then
    echo "  Pre-deploy gate PASSED"
  else
    echo "  Pre-deploy gate FAILED"
    exit 1
  fi
  echo "========================================="

  NSIS_DIR="$PROJECT_ROOT/apps/desktop/src-tauri/target/release/bundle/nsis"
  if [ -d "$NSIS_DIR" ]; then
    echo ""
    echo "Artifacts:"
    ls -lh "$NSIS_DIR"/*.exe 2>/dev/null | awk '{print "  " $NF " (" $5 ")"}'
  fi

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ Windows OEM build ($OEM_ID) completed successfully!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
else
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "❌ Windows OEM build failed! (exit $BUILD_EXIT)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
