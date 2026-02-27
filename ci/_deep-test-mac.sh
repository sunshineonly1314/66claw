#!/usr/bin/env bash
set -uo pipefail

APP_DIR=/Users/kevinsun/cicd-workspace/openclawcn/build/output/ClawdbotCN.app
NODE_BIN="$APP_DIR/Contents/Resources/node/bin/node"
APP_ROOT="$APP_DIR/Contents/Resources/app"
ENTRY_JS="$APP_ROOT/dist/entry.js"
TEST_STATE="/tmp/clawdbot-deep-test"
PORT=18789
TOKEN="deep-test-token-$$"

echo "=== Deep Test Start ==="

# 清理
lsof -ti :$PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1
rm -rf "$TEST_STATE"
mkdir -p "$TEST_STATE/config" "$TEST_STATE/data"

# 最小 config
cat > "$TEST_STATE/openclawcn.json" << 'EOF'
{"gateway":{"mode":"local"}}
EOF

export OPENCLAWCN_STATE_DIR="$TEST_STATE"
export OPENCLAWCN_BUNDLED_PLUGINS_DIR="$APP_ROOT/extensions"
export OPENCLAWCN_BUNDLED_SKILLS_DIR="$APP_ROOT/skills"
export OPENCLAWCN_GATEWAY_TOKEN="$TOKEN"
export OPENCLAWCN_REGION="cn"
export OPENCLAWCN_DESKTOP_MODE=1
export NODE_ENV=production
export PATH="$APP_DIR/Contents/Resources/node/bin:$PATH"

xattr -cr "$APP_DIR/Contents/Resources" 2>/dev/null || true

# ── 1. 启动 Gateway ──
echo ""
echo "=== 1. Gateway Startup ==="
"$NODE_BIN" "$ENTRY_JS" gateway run --port $PORT --allow-unconfigured \
  > /tmp/gw-deep-stdout.log 2> /tmp/gw-deep-stderr.log &
GW_PID=$!
echo "PID=$GW_PID"

# 等端口
PORT_OK=false
for i in $(seq 1 30); do
  sleep 1
  if ! kill -0 $GW_PID 2>/dev/null; then
    echo "CRASHED after ${i}s"
    echo "--- stderr ---"
    tail -30 /tmp/gw-deep-stderr.log 2>/dev/null
    echo "--- stdout ---"
    tail -30 /tmp/gw-deep-stdout.log 2>/dev/null
    exit 1
  fi
  if lsof -i :$PORT -sTCP:LISTEN >/dev/null 2>&1; then
    echo "PORT LISTENING: ${i}s"
    PORT_OK=true
    break
  fi
done

if [ "$PORT_OK" != "true" ]; then
  echo "TIMEOUT waiting for port"
  kill -9 $GW_PID 2>/dev/null || true
  exit 1
fi

# 等 health ready
READY=false
for i in $(seq 1 30); do
  sleep 1
  H=$(curl -sf http://127.0.0.1:$PORT/api/health 2>/dev/null || true)
  if echo "$H" | grep -q '"ready":true'; then
    echo "READY: ${i}s"
    echo "$H" | python3 -m json.tool 2>/dev/null || echo "$H"
    READY=true
    break
  fi
done

if [ "$READY" != "true" ]; then
  echo "TIMEOUT waiting for ready"
fi

# ── 2. API 端点测试 ──
echo ""
echo "=== 2. API Endpoints ==="

# health
echo -n "GET /api/health: "
curl -sf http://127.0.0.1:$PORT/api/health | python3 -m json.tool 2>/dev/null || echo "FAIL"

# model-config
echo -n "GET /api/model-config: "
MC=$(curl -sf http://127.0.0.1:$PORT/api/model-config 2>/dev/null)
if [ -n "$MC" ]; then
  echo "$MC" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'OK - {len(d.get(\"providers\",d.get(\"models\",[])))} providers/models')" 2>/dev/null || echo "$MC" | head -c 200
else
  echo "FAIL - no response"
fi

# config
echo -n "GET /api/config: "
CFG=$(curl -sf http://127.0.0.1:$PORT/api/config 2>/dev/null)
if [ -n "$CFG" ]; then
  echo "$CFG" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'OK - keys: {list(d.keys())[:8]}')" 2>/dev/null || echo "OK (raw)"
else
  echo "FAIL - no response"
fi

# ── 3. Control UI ──
echo ""
echo "=== 3. Control UI ==="

# 直接访问根路径
echo -n "GET /: "
ROOT_CODE=$(curl -sf -o /dev/null -w "%{http_code}" http://127.0.0.1:$PORT/ 2>/dev/null)
echo "status=$ROOT_CODE"

# 跟随重定向访问
echo -n "GET / (follow redirects): "
ROOT_BODY=$(curl -sfL http://127.0.0.1:$PORT/ 2>/dev/null)
if echo "$ROOT_BODY" | grep -q '<html'; then
  BODY_LEN=${#ROOT_BODY}
  echo "OK - HTML $BODY_LEN bytes"
else
  echo "NO HTML - first 200 chars:"
  echo "$ROOT_BODY" | head -c 200
fi

# setup 页面
echo -n "GET /setup: "
SETUP_CODE=$(curl -sfL -o /dev/null -w "%{http_code}" http://127.0.0.1:$PORT/setup 2>/dev/null)
echo "status=$SETUP_CODE"

# ── 4. WebSocket 测试 ──
echo ""
echo "=== 4. WebSocket ==="

WS_SCRIPT=$(mktemp /tmp/ws-test-XXXXXX.js)
cat > "$WS_SCRIPT" << 'WSEOF'
const WS_URL = 'ws://127.0.0.1:' + process.argv[2];
const TOKEN = process.argv[3] || '';
let WebSocket;
try { WebSocket = require('ws'); } catch(e) {
  // Try app's node_modules
  const appRoot = process.argv[4] || '';
  WebSocket = require(appRoot + '/node_modules/ws');
}
const ws = new WebSocket(WS_URL);
const t = setTimeout(() => { console.log('WS_TIMEOUT'); process.exit(1); }, 15000);
ws.on('open', () => {
  ws.send(JSON.stringify({
    type:'req', id:'c1', method:'connect',
    params:{
      minProtocol:3, maxProtocol:3,
      client:{id:'deep-test',version:'test',platform:'darwin',mode:'cli',instanceId:'test-'+Date.now()},
      locale:'zh-CN', userAgent:'deep-test', role:'operator',
      scopes:['operator.read','operator.write'], caps:[],
      auth:{token:TOKEN}
    }
  }));
});
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type==='res' && msg.id==='c1') {
    if (msg.ok) {
      console.log('WS_CONNECT_OK: protocol=' + (msg.result?.protocol||'?'));
      ws.send(JSON.stringify({type:'req',id:'h1',method:'health'}));
    } else {
      console.log('WS_CONNECT_FAIL: ' + JSON.stringify(msg.error||msg));
    }
  }
  if (msg.type==='res' && msg.id==='h1') {
    if (msg.ok) {
      console.log('WS_HEALTH_OK: ' + JSON.stringify(msg.result).substring(0,200));
    } else {
      console.log('WS_HEALTH_FAIL: ' + JSON.stringify(msg));
    }
    clearTimeout(t);
    ws.close();
    process.exit(0);
  }
});
ws.on('error', (e) => { console.log('WS_ERROR: ' + e.message); process.exit(2); });
WSEOF

"$NODE_BIN" "$WS_SCRIPT" "$PORT" "$TOKEN" "$APP_ROOT" 2>&1
WS_EXIT=$?
rm -f "$WS_SCRIPT"
echo "WS exit code: $WS_EXIT"

# ── 5. .jsc Bytecode 实际加载测试 ──
echo ""
echo "=== 5. Bytecode (.jsc) ==="

JSC_SCRIPT=$(mktemp /tmp/jsc-test-XXXXXX.js)
cat > "$JSC_SCRIPT" << 'JSCEOF'
process.chdir(process.argv[2]);
try {
  require('bytenode');
  const fs = require('fs');
  const path = require('path');
  // 找所有 .jsc 并尝试加载前3个
  const walk = (dir) => {
    let results = [];
    const items = fs.readdirSync(dir, {withFileTypes:true});
    for (const item of items) {
      const p = path.join(dir, item.name);
      if (item.isDirectory()) results = results.concat(walk(p));
      else if (item.name.endsWith('.jsc')) results.push(p);
    }
    return results;
  };
  const jscs = walk(path.join(process.cwd(), 'dist'));
  console.log('Total .jsc files: ' + jscs.length);
  const toTest = jscs.slice(0, 5);
  let ok = 0, fail = 0;
  for (const f of toTest) {
    try {
      require(f);
      ok++;
      console.log('  OK: ' + path.relative(process.cwd(), f));
    } catch(e) {
      fail++;
      console.log('  FAIL: ' + path.relative(process.cwd(), f) + ' - ' + e.message.substring(0,80));
    }
  }
  console.log('Loaded ' + ok + '/' + toTest.length + ' test files');
} catch(e) {
  console.log('BYTECODE_ERROR: ' + e.message);
  process.exit(1);
}
JSCEOF

"$NODE_BIN" "$JSC_SCRIPT" "$APP_ROOT" 2>&1
rm -f "$JSC_SCRIPT"

# ── 6. 错误日志检查 ──
echo ""
echo "=== 6. Error Logs ==="
echo "--- stderr (last 30 lines) ---"
tail -30 /tmp/gw-deep-stderr.log 2>/dev/null || echo "(empty)"
echo "--- stdout warnings/errors ---"
grep -i "error\|warn\|fail\|crash\|uncaught\|unhandled" /tmp/gw-deep-stdout.log 2>/dev/null | tail -20 || echo "(none)"

# ── 7. 扩展 & 技能检查 ──
echo ""
echo "=== 7. Extensions & Skills ==="
echo -n "Extensions: "
ls "$APP_ROOT/extensions/" 2>/dev/null | wc -l | tr -d ' '
ls "$APP_ROOT/extensions/" 2>/dev/null | head -10
echo -n "Skills: "
ls "$APP_ROOT/skills/" 2>/dev/null | wc -l | tr -d ' '
ls "$APP_ROOT/skills/" 2>/dev/null | head -10

# ── 8. 包大小检查 ──
echo ""
echo "=== 8. Size Breakdown ==="
du -sh "$APP_DIR" 2>/dev/null
du -sh "$APP_ROOT/dist" 2>/dev/null
du -sh "$APP_ROOT/dist/control-ui" 2>/dev/null
du -sh "$APP_ROOT/node_modules" 2>/dev/null
du -sh "$APP_DIR/Contents/Resources/node" 2>/dev/null

# ── 清理 ──
echo ""
echo "=== Cleanup ==="
kill -TERM $GW_PID 2>/dev/null || true
sleep 2
kill -9 $GW_PID 2>/dev/null || true
rm -rf "$TEST_STATE"
echo "Done"
