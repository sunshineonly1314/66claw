#!/usr/bin/env bash
set -uo pipefail

# ClawdbotCN 运行时功能测试
# 在 macOS 上从 DMG 挂载的 .app 中启动 Gateway 并测试接口

DMG_PATH="${1:-/Users/kevinsun/cicd-workspace/openclawcn/apps/desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg/ClawdbotCN_1.6.1_universal.dmg}"
PORT=18799
TOKEN="test-ci-$(date +%s)"
GW_PID=""

# --- Pre-cleanup: kill old gateway processes BEFORE mounting DMG ---
# Use system node to read lock files
SYS_NODE="/usr/local/lib/nodejs/node-v22.16.0-darwin-arm64/bin/node"
if [ ! -f "$SYS_NODE" ]; then
  SYS_NODE=$(which node 2>/dev/null || echo "")
fi
if [ -n "$SYS_NODE" ]; then
  TMPDIR_ACTUAL=$("$SYS_NODE" -e "console.log(require('os').tmpdir())" 2>/dev/null || echo "/tmp")
  LOCK_DIR="$TMPDIR_ACTUAL/openclawcn-$(id -u)"
  echo "Pre-cleanup: Lock dir=$LOCK_DIR"
  if [ -d "$LOCK_DIR" ]; then
    for lockfile in "$LOCK_DIR"/gateway.*.lock; do
      if [ -f "$lockfile" ]; then
        OLD_PID=$("$SYS_NODE" -e "try{console.log(JSON.parse(require('fs').readFileSync('$lockfile','utf8')).pid)}catch{}" 2>/dev/null)
        if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
          echo "  杀死旧 gateway 进程 PID=$OLD_PID"
          kill -9 "$OLD_PID" 2>/dev/null
          sleep 2
        fi
        rm -f "$lockfile" "${lockfile%.lock}.heartbeat"
        echo "  已清理 lock: $(basename $lockfile)"
      fi
    done
  fi
fi

# Kill anything on our test port
lsof -ti:$PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

# Unmount any stale ClawdbotCN volume, then re-mount fresh
hdiutil detach "/Volumes/ClawdbotCN" -force 2>/dev/null || true
sleep 1
echo "Mounting DMG: $DMG_PATH"
hdiutil attach "$DMG_PATH" -nobrowse -quiet 2>/dev/null || true
sleep 2

APP="/Volumes/ClawdbotCN/ClawdbotCN.app"
RES="$APP/Contents/Resources/resources"

cleanup() {
  if [ -n "$GW_PID" ]; then
    kill "$GW_PID" 2>/dev/null
    wait "$GW_PID" 2>/dev/null
  fi
}
trap cleanup EXIT

echo "============================================"
echo "  ClawdbotCN 运行时功能测试"
echo "============================================"
echo ""

# ── Phase 1: 文件结构检查 ──
echo "=== Phase 1: 文件结构检查 ==="
PASS=0
FAIL=0

check_file() {
  local path="$1"
  local desc="$2"
  if [ -e "$path" ]; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc — 文件不存在: $path"
    FAIL=$((FAIL + 1))
  fi
}

check_file "$APP/Contents/MacOS/clawdbot-desktop" "Tauri 二进制"
check_file "$RES/node/bin/node" "Node.js 运行时"
check_file "$RES/dist/entry.js" "Gateway 入口"
check_file "$RES/dist/index.js" "主入口"
check_file "$RES/package.json" "package.json"
check_file "$RES/dist/control-ui/index.html" "Control UI"
check_file "$RES/version.json" "版本信息"
check_file "$RES/dist/build-meta.json" "构建元数据"

echo ""
echo "Node.js 版本: $($RES/node/bin/node -v 2>&1)"
echo ".jsc 文件数: $(find "$RES/dist" -name '*.jsc' 2>/dev/null | wc -l | tr -d ' ')"
echo "build-meta.json: $(cat "$RES/dist/build-meta.json" 2>/dev/null)"
echo "version.json: $(cat "$RES/version.json" 2>/dev/null)"

echo ""
echo "Bytecode 加载测试:"
"$RES/node/bin/node" -e "
const fs = require('fs');
const distDir = process.argv[1];
try {
  const jscFiles = fs.readdirSync(distDir + '/license').filter(f => f.endsWith('.jsc'));
  console.log('  license/ .jsc 文件数:', jscFiles.length);
  require(distDir + '/license/index.js');
  console.log('  license/index.js: 加载成功');
} catch(e) {
  console.log('  license/index.js: 加载失败 -', e.message);
}
try {
  require(distDir + '/security/index.js');
  console.log('  security/index.js: 加载成功');
} catch(e) {
  console.log('  security/index.js: 加载失败 -', e.message);
}
" "$RES/dist" 2>&1

# ── Phase 2: Gateway 启动 ──
echo ""
echo "=== Phase 2: Gateway 启动测试 ==="

# 清理旧进程
lsof -ti:$PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

echo "启动 Gateway (port=$PORT)..."
cd "$RES"

# Lock cleanup already done in pre-cleanup phase above

OPENCLAWCN_GATEWAY_TOKEN="$TOKEN" \
OPENCLAWCN_GATEWAY_PORT="$PORT" \
OPENCLAWCN_REGION=cn \
OPENCLAWCN_DESKTOP_MODE=1 \
NODE_ENV=production \
"$RES/node/bin/node" "$RES/dist/entry.js" gateway --port "$PORT" --force --allow-unconfigured > /tmp/gw-test.log 2>&1 &
GW_PID=$!
echo "  PID: $GW_PID"

# 等待端口
echo "等待端口 $PORT 就绪..."
PORT_READY=false
for i in $(seq 1 60); do
  if lsof -i:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  [PASS] 端口已监听 (${i}s)"
    PORT_READY=true
    PASS=$((PASS + 1))
    break
  fi
  sleep 1
done
if [ "$PORT_READY" != "true" ]; then
  echo "  [FAIL] 端口 $PORT 超时未监听 (60s)"
  FAIL=$((FAIL + 1))
  echo "  === 日志最后 50 行 ==="
  tail -50 /tmp/gw-test.log
  echo ""
  echo "=== 测试结果: $PASS PASS / $FAIL FAIL ==="
  exit 1
fi

# 等待 ready
echo "等待 Gateway ready..."
READY=false
for i in $(seq 1 90); do
  HEALTH=$(curl -s "http://127.0.0.1:$PORT/api/health" 2>/dev/null || true)
  if echo "$HEALTH" | grep -q '"ready":true' 2>/dev/null; then
    echo "  [PASS] Gateway ready (${i}s)"
    echo "  Health: $HEALTH"
    READY=true
    PASS=$((PASS + 1))
    break
  fi
  sleep 1
done
if [ "$READY" != "true" ]; then
  echo "  [FAIL] Gateway 未就绪 (90s)"
  echo "  Last health: $HEALTH"
  FAIL=$((FAIL + 1))
  echo "  === 日志最后 50 行 ==="
  tail -50 /tmp/gw-test.log
fi

# ── Phase 3: HTTP 接口 ──
echo ""
echo "=== Phase 3: HTTP 接口测试 ==="

# 3.1 Health
echo "1. GET /api/health:"
HEALTH_RESP=$(curl -s "http://127.0.0.1:$PORT/api/health" 2>/dev/null)
echo "  Response: $HEALTH_RESP"
if echo "$HEALTH_RESP" | grep -q '"ok":true' 2>/dev/null; then
  echo "  [PASS]"
  PASS=$((PASS + 1))
else
  echo "  [FAIL]"
  FAIL=$((FAIL + 1))
fi

# 3.2 Control UI
echo "2. GET / (Control UI):"
UI_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/?token=$TOKEN" 2>/dev/null)
echo "  HTTP Status: $UI_CODE"
if [ "$UI_CODE" = "200" ]; then
  echo "  [PASS]"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] 期望 200, 实际 $UI_CODE"
  FAIL=$((FAIL + 1))
fi

# 3.3 Setup
echo "3. GET /setup:"
SETUP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/setup?token=$TOKEN" 2>/dev/null)
echo "  HTTP Status: $SETUP_CODE"
if [ "$SETUP_CODE" = "200" ] || [ "$SETUP_CODE" = "302" ]; then
  echo "  [PASS]"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] 期望 200/302, 实际 $SETUP_CODE"
  FAIL=$((FAIL + 1))
fi

# 3.4 Shutdown 无认证
echo "4. POST /api/shutdown (无认证):"
SHUTDOWN_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://127.0.0.1:$PORT/api/shutdown" 2>/dev/null)
echo "  HTTP Status: $SHUTDOWN_CODE"
if [ "$SHUTDOWN_CODE" = "401" ] || [ "$SHUTDOWN_CODE" = "403" ]; then
  echo "  [PASS] 正确拒绝无认证请求"
  PASS=$((PASS + 1))
else
  echo "  [WARN] 期望 401/403, 实际 $SHUTDOWN_CODE"
fi

# 3.5 Shutdown 错误 token
echo "5. POST /api/shutdown (错误 token):"
SHUTDOWN_CODE2=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://127.0.0.1:$PORT/api/shutdown" -H "x-openclawcn-token: wrong-token" 2>/dev/null)
echo "  HTTP Status: $SHUTDOWN_CODE2"
if [ "$SHUTDOWN_CODE2" = "401" ] || [ "$SHUTDOWN_CODE2" = "403" ]; then
  echo "  [PASS] 正确拒绝错误 token"
  PASS=$((PASS + 1))
else
  echo "  [WARN] 期望 401/403, 实际 $SHUTDOWN_CODE2"
fi

# ── Phase 4: 日志分析 ──
echo ""
echo "=== Phase 4: 日志分析 ==="
LOG_LINES=$(wc -l < /tmp/gw-test.log | tr -d ' ')
echo "日志总行数: $LOG_LINES"

echo ""
echo "ERROR/FATAL 关键词:"
ERROR_COUNT=$(grep -ci "error\|exception\|fatal\|crash\|panic" /tmp/gw-test.log 2>/dev/null || echo 0)
if [ "$ERROR_COUNT" -gt 0 ]; then
  echo "  发现 $ERROR_COUNT 处错误相关日志:"
  grep -in "error\|exception\|fatal\|crash\|panic" /tmp/gw-test.log | head -20
else
  echo "  无错误 [PASS]"
  PASS=$((PASS + 1))
fi

echo ""
echo "WARN 关键词:"
WARN_COUNT=$(grep -ci "warn" /tmp/gw-test.log 2>/dev/null || echo 0)
echo "  发现 $WARN_COUNT 处警告"
if [ "$WARN_COUNT" -gt 0 ]; then
  grep -in "warn" /tmp/gw-test.log | head -10
fi

echo ""
echo "启动日志前 20 行:"
head -20 /tmp/gw-test.log

echo ""
echo "最近日志 20 行:"
tail -20 /tmp/gw-test.log

# ── Phase 5: 清理 ──
echo ""
echo "=== Phase 5: 清理 ==="
kill "$GW_PID" 2>/dev/null
wait "$GW_PID" 2>/dev/null
GW_PID=""
echo "Gateway 已停止"

# ── 结果汇总 ──
echo ""
echo "============================================"
echo "  测试结果汇总"
echo "============================================"
echo "  通过: $PASS"
echo "  失败: $FAIL"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
