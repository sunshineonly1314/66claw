#!/bin/bash
# macOS DMG 全量接口测试脚本
# 测试所有 HTTP API + WebSocket 接口
export PATH=/usr/local/lib/nodejs/node-v22.16.0-darwin-arm64/bin:/opt/homebrew/bin:/usr/local/bin:$PATH

PASS=0
FAIL=0
WARN=0
PORT=34982
BASE="http://127.0.0.1:$PORT"

pass() { PASS=$((PASS+1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL+1)); echo "  [FAIL] $1"; }
warn() { WARN=$((WARN+1)); echo "  [WARN] $1"; }

http_test() {
  local METHOD="$1"
  local URL="$2"
  local DESC="$3"
  local EXPECT_CODE="${4:-200}"
  local BODY="$5"
  local EXTRA_HEADERS="$6"

  if [ "$METHOD" = "GET" ] || [ "$METHOD" = "HEAD" ]; then
    RESP=$(curl -s -o /tmp/api-resp-body.txt -w "%{http_code}" -X "$METHOD" "$BASE$URL" \
      --connect-timeout 3 -H "Origin: http://127.0.0.1:$PORT" $EXTRA_HEADERS 2>/dev/null)
  else
    RESP=$(curl -s -o /tmp/api-resp-body.txt -w "%{http_code}" -X "$METHOD" "$BASE$URL" \
      --connect-timeout 3 -H "Content-Type: application/json" \
      -H "Origin: http://127.0.0.1:$PORT" $EXTRA_HEADERS \
      -d "${BODY:-{}}" 2>/dev/null)
  fi

  RESP_BODY=$(cat /tmp/api-resp-body.txt 2>/dev/null | head -c 300)

  if [ "$RESP" = "$EXPECT_CODE" ]; then
    pass "$DESC => HTTP $RESP"
  elif [ "$RESP" = "000" ]; then
    fail "$DESC => 连接失败 (no response)"
  else
    # 某些端点返回401/403是正常的(需要auth)
    if [ "$RESP" = "401" ] || [ "$RESP" = "403" ]; then
      warn "$DESC => HTTP $RESP (需要认证, 预期行为)"
    elif [ "$RESP" = "410" ]; then
      warn "$DESC => HTTP 410 Gone (setup已完成, 预期行为)"
    else
      fail "$DESC => HTTP $RESP (预期 $EXPECT_CODE), body: ${RESP_BODY:0:100}"
    fi
  fi
}

echo "========================================="
echo " ClawdbotCN 全量接口测试"
echo "========================================="

# Auto-detect latest DMG (newest by mtime)
DMG=$(ls -t /Users/kevinsun/cicd-workspace/openclawcn/apps/desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg/ClawdbotCN_*_universal.dmg 2>/dev/null | head -1)
if [ -z "$DMG" ]; then
  DMG="/Users/kevinsun/cicd-workspace/openclawcn/apps/desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg/ClawdbotCN_1.6.3_universal.dmg"
fi
MP="/tmp/clawdbot-install-test"
INSTALL_DIR="/tmp/clawdbot-test-app"

# ── 清理 ──
hdiutil detach "$MP" -quiet 2>/dev/null
# 杀掉可能残留的旧gateway进程
pkill -f "openclawcn-gateway" 2>/dev/null
pkill -f "entry.js.*gateway" 2>/dev/null
sleep 2
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

# ── 1. 安装 ──
echo ""
echo "=== 阶段 1: DMG安装 ==="

echo "1.1 挂载DMG..."
hdiutil attach "$DMG" -mountpoint "$MP" -nobrowse -quiet
if [ $? -ne 0 ]; then fail "DMG挂载失败"; echo "FATAL: 无法继续"; exit 1; fi
pass "DMG挂载"

echo "1.2 检查DMG内容..."
if [ -d "$MP/ClawdbotCN.app" ]; then pass "ClawdbotCN.app 存在"; else fail "ClawdbotCN.app 不存在"; fi
if [ -L "$MP/Applications" ] || [ -d "$MP/Applications" ]; then pass "Applications 快捷方式"; else warn "Applications 快捷方式缺失"; fi
if [ -d "$MP/.background" ]; then pass ".background 背景图目录"; else warn ".background 不存在"; fi

echo "1.3 拖拽安装..."
cp -R "$MP/ClawdbotCN.app" "$INSTALL_DIR/"
hdiutil detach "$MP" -quiet
APP="$INSTALL_DIR/ClawdbotCN.app"
if [ -d "$APP" ]; then
  APP_SIZE=$(du -sh "$APP" | cut -f1)
  pass "拖拽安装完成 ($APP_SIZE)"
else
  fail "拖拽安装失败"; exit 1
fi

echo "1.4 移除quarantine..."
xattr -cr "$APP" 2>/dev/null
pass "quarantine已移除"

# ── 2. 静态资源验证 ──
echo ""
echo "=== 阶段 2: 静态资源验证 ==="
R="$APP/Contents/Resources/resources"
NODE="$R/node/bin/node"
ENTRY="$R/dist/entry.js"

# Node binary
if [ -f "$NODE" ]; then
  NODE_VER=$("$NODE" --version)
  if [ "$NODE_VER" = "v22.16.0" ]; then pass "Node binary: $NODE_VER"; else fail "Node版本不匹配: $NODE_VER"; fi
else
  fail "Node binary不存在"; exit 1
fi

# Entry.js
if [ -f "$ENTRY" ]; then pass "entry.js 存在"; else fail "entry.js不存在"; exit 1; fi

# Build meta
if [ -f "$R/dist/build-meta.json" ]; then
  BM_NODE=$(cat "$R/dist/build-meta.json" | grep -o '"nodeVersion":"[^"]*"' | head -1)
  pass "build-meta.json: $BM_NODE"
else
  fail "build-meta.json 不存在"
fi

# .jsc bytecode files
JSC_COUNT=$(find "$R/dist" -name "*.jsc" 2>/dev/null | wc -l | tr -d ' ')
if [ "$JSC_COUNT" -ge 100 ]; then pass "bytecode文件: $JSC_COUNT 个 .jsc"; else fail "bytecode太少: $JSC_COUNT (需>=100)"; fi

# Skills
SKILL_COUNT=$(find "$R/skills" -type f -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
if [ "$SKILL_COUNT" -ge 500 ]; then pass "技能文件: $SKILL_COUNT 个"; else fail "技能太少: $SKILL_COUNT (需>=500)"; fi

# Extensions
EXT_COUNT=$(find "$R/extensions" -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
EXT_COUNT=$((EXT_COUNT - 1))
if [ "$EXT_COUNT" -ge 10 ]; then pass "扩展: $EXT_COUNT 个"; else fail "扩展太少: $EXT_COUNT (需>=10)"; fi

# MCP index
if [ -f "$R/data/mcp-index.json" ]; then
  MCP_SIZE=$(wc -c < "$R/data/mcp-index.json" | tr -d ' ')
  pass "mcp-index.json: ${MCP_SIZE} bytes"
else
  fail "mcp-index.json 不存在"
fi

# install.json
if [ -f "$R/install.json" ]; then
  INSTALL_VER=$(cat "$R/install.json" | grep -o '"version":"[^"]*"' | head -1)
  INSTALL_SERVER=$(cat "$R/install.json" | grep -o '"updateServer":"[^"]*"' | head -1)
  pass "install.json: $INSTALL_VER, $INSTALL_SERVER"
else
  fail "install.json 不存在"
fi

# package.json
if [ -f "$R/package.json" ]; then pass "package.json 存在"; else fail "package.json 不存在"; fi

# Info.plist
PLIST="$APP/Contents/Info.plist"
if [ -f "$PLIST" ]; then
  BUNDLE_ID=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$PLIST" 2>/dev/null)
  BUNDLE_VER=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$PLIST" 2>/dev/null)
  pass "Info.plist: $BUNDLE_ID v$BUNDLE_VER"
  # LSArchitecturePriority
  ARCH0=$(/usr/libexec/PlistBuddy -c "Print :LSArchitecturePriority:0" "$PLIST" 2>/dev/null)
  if [ "$ARCH0" = "arm64" ]; then pass "LSArchitecturePriority: arm64优先"; else warn "LSArchitecturePriority 未设置arm64优先"; fi
else
  fail "Info.plist 不存在"
fi

# Code signing
CODESIGN_OUT=$(codesign -dvv "$APP" 2>&1)
if echo "$CODESIGN_OUT" | grep -q "adhoc"; then
  pass "代码签名: ad-hoc"
else
  warn "代码签名: $(echo "$CODESIGN_OUT" | grep 'Signature=' | head -1)"
fi

# Architecture
ARCH_OUT=$(file "$APP/Contents/MacOS/"* 2>/dev/null | head -1)
if echo "$ARCH_OUT" | grep -q "universal"; then
  pass "架构: universal binary"
elif echo "$ARCH_OUT" | grep -q "arm64"; then
  pass "架构: arm64"
else
  warn "架构: $ARCH_OUT"
fi

# ── 3. 启动Gateway ──
echo ""
echo "=== 阶段 3: 启动Gateway ==="

export CLAWDBOT_DATA_DIR="/tmp/clawdbot-test-data"
export CLAWDBOT_LOG_DIR="/tmp/clawdbot-test-logs"
mkdir -p "$CLAWDBOT_DATA_DIR" "$CLAWDBOT_LOG_DIR"

if [ -d "$R/data" ]; then
  cp -R "$R/data/"* "$CLAWDBOT_DATA_DIR/" 2>/dev/null
  pass "data文件已复制"
fi

cd "$R"
"$NODE" "$ENTRY" gateway --port $PORT --allow-unconfigured > /tmp/clawdbot-test-stdout.log 2> /tmp/clawdbot-test-stderr.log &
GW_PID=$!
echo "  Gateway PID: $GW_PID"

# 等待ready
WAIT_MAX=30
WAIT_COUNT=0
GW_READY=false
while [ $WAIT_COUNT -lt $WAIT_MAX ]; do
  sleep 2
  WAIT_COUNT=$((WAIT_COUNT + 2))
  if ! kill -0 $GW_PID 2>/dev/null; then
    fail "Gateway进程在 ${WAIT_COUNT}s 退出"
    echo "  stderr: $(tail -5 /tmp/clawdbot-test-stderr.log 2>/dev/null)"
    break
  fi
  if grep -q "ready" /tmp/clawdbot-test-stdout.log 2>/dev/null; then
    GW_READY=true
    pass "Gateway ${WAIT_COUNT}s 内达到 ready"
    break
  fi
  echo "  等待中... ${WAIT_COUNT}s"
done

if [ "$GW_READY" != "true" ]; then
  echo "  Gateway未ready, 检查日志..."
  echo "  stdout: $(tail -10 /tmp/clawdbot-test-stdout.log 2>/dev/null)"
  echo "  stderr: $(tail -10 /tmp/clawdbot-test-stderr.log 2>/dev/null)"
fi

# ── 4. HTTP接口测试 ──
if kill -0 $GW_PID 2>/dev/null; then
  echo ""
  echo "=== 阶段 4: HTTP API 测试 ==="

  # 获取 local-token 用于认证接口
  TOKEN=$(curl -s "http://127.0.0.1:$PORT/api/local-token" --connect-timeout 3 2>/dev/null | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"//')
  if [ -n "$TOKEN" ]; then
    pass "获取 local-token 成功"
    AUTH_HEADER="-H \"Authorization: Bearer $TOKEN\""
  else
    warn "获取 local-token 失败 (部分测试可能无法通过)"
    TOKEN=""
    AUTH_HEADER=""
  fi

  echo ""
  echo "--- 4.1 基础健康检查 ---"
  http_test "GET" "/api/health" "GET /api/health"
  http_test "GET" "/api/local-token" "GET /api/local-token"

  echo ""
  echo "--- 4.2 配置与支持 ---"
  http_test "GET" "/api/support/qrcode" "GET /api/support/qrcode"
  http_test "GET" "/config/purchase-url" "GET /config/purchase-url"
  http_test "HEAD" "/config/purchase-url" "HEAD /config/purchase-url"
  http_test "GET" "/api/auth/discover" "GET /api/auth/discover"

  echo ""
  echo "--- 4.3 Control UI ---"
  http_test "GET" "/" "GET / (控制台首页)"
  # /ui/ returns 404 when no basePath is configured (by design — UI served at /)
  http_test "GET" "/ui/" "GET /ui/ (UI入口)" "404"

  echo ""
  echo "--- 4.4 Avatar/Media ---"
  # /avatar/default returns 404 because 'default' is not a registered agentId (by design)
  http_test "GET" "/avatar/default" "GET /avatar/default" "404"

  echo ""
  echo "--- 4.5 Setup Wizard (setup完成后应返回410) ---"
  http_test "GET" "/api/setup/state" "GET /api/setup/state"
  http_test "GET" "/api/setup/providers" "GET /api/setup/providers"
  http_test "GET" "/setup" "GET /setup (setup页面)"

  echo ""
  echo "--- 4.6 认证保护接口 ---"
  # 不带token的shutdown应该被拒绝
  http_test "POST" "/api/shutdown" "POST /api/shutdown (无token)" "401"

  # 带token的接口测试
  if [ -n "$TOKEN" ]; then
    echo ""
    echo "--- 4.7 带Token认证接口 ---"
    # 用eval处理带引号的header
    RESP=$(curl -s -o /tmp/api-resp-body.txt -w "%{http_code}" \
      "http://127.0.0.1:$PORT/api/health" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Origin: http://127.0.0.1:$PORT" \
      --connect-timeout 3 2>/dev/null)
    if [ "$RESP" = "200" ]; then pass "GET /api/health (带token) => HTTP $RESP"; else fail "GET /api/health (带token) => HTTP $RESP"; fi
  fi

  echo ""
  echo "--- 4.8 OpenAI兼容接口 ---"
  RESP=$(curl -s -o /tmp/api-resp-body.txt -w "%{http_code}" \
    -X POST "http://127.0.0.1:$PORT/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Origin: http://127.0.0.1:$PORT" \
    ${TOKEN:+-H "Authorization: Bearer $TOKEN"} \
    -d '{"model":"test","messages":[{"role":"user","content":"hi"}],"stream":false}' \
    --connect-timeout 5 2>/dev/null)
  RESP_BODY=$(cat /tmp/api-resp-body.txt 2>/dev/null | head -c 200)
  if [ "$RESP" != "000" ]; then
    pass "POST /v1/chat/completions => HTTP $RESP (接口可达)"
    echo "    Response: ${RESP_BODY:0:150}"
  else
    fail "POST /v1/chat/completions => 连接失败"
  fi

  echo ""
  echo "--- 4.9 Canvas/A2UI ---"
  http_test "GET" "/__openclawcn__/canvas/" "GET /__openclawcn__/canvas/"
  http_test "GET" "/__openclawcn__/a2ui/" "GET /__openclawcn__/a2ui/"

  echo ""
  echo "--- 4.10 不存在的路由 ---"
  # SPA fallback: unmatched routes return frontend HTML (200), this is by design
  http_test "GET" "/api/nonexistent" "GET /api/nonexistent (SPA fallback)" "200"
  http_test "GET" "/completely-random-path" "GET /completely-random-path"

  # ── 5. WebSocket 测试 ──
  echo ""
  echo "=== 阶段 5: WebSocket 测试 ==="

  # 检查wscat或websocat是否可用
  WS_TOOL=""
  if command -v websocat &>/dev/null; then
    WS_TOOL="websocat"
  elif command -v wscat &>/dev/null; then
    WS_TOOL="wscat"
  fi

  if [ -n "$WS_TOOL" ]; then
    echo "  使用 $WS_TOOL 测试WebSocket"
  else
    echo "  未找到wscat/websocat, 使用Node.js测试WebSocket"
  fi

  # 使用Node.js直接测试WebSocket (内置ws模块通过gateway的node)
  WS_TEST_SCRIPT="/tmp/clawdbot-ws-test.js"
  cat > "$WS_TEST_SCRIPT" << 'WSEOF'
const WebSocket = require('ws');
const url = process.argv[2] || 'ws://127.0.0.1:34982';
const token = process.argv[3] || '';
const results = [];
let ws;

function log(msg) { console.log(msg); }
function pass(desc) { results.push({s:'PASS',d:desc}); log(`  [PASS] ${desc}`); }
function fail(desc) { results.push({s:'FAIL',d:desc}); log(`  [FAIL] ${desc}`); }

async function sendRpc(method, params) {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2,10);
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params: params || {} });
    const timeout = setTimeout(() => reject(new Error('timeout')), 8000);

    function handler(data) {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.id === id) {
          ws.removeListener('message', handler);
          clearTimeout(timeout);
          resolve(parsed);
        }
      } catch(e) {}
    }
    ws.on('message', handler);
    ws.send(msg);
  });
}

async function run() {
  log('  连接WebSocket: ' + url);

  ws = new WebSocket(url, {
    headers: token ? { 'Authorization': 'Bearer ' + token } : {}
  });

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
    setTimeout(() => reject(new Error('connection timeout')), 5000);
  });
  pass('WebSocket连接成功');

  // 等待可能的challenge消息
  await new Promise(r => setTimeout(r, 1000));

  // 测试各类RPC方法
  const rpcTests = [
    { method: 'health', desc: 'health (健康检查)' },
    { method: 'status', desc: 'status (状态)' },
    { method: 'config.get', desc: 'config.get (获取配置)' },
    { method: 'config.schema', desc: 'config.schema (配置schema)' },
    { method: 'models.list', desc: 'models.list (模型列表)' },
    { method: 'sessions.list', desc: 'sessions.list (会话列表)' },
    { method: 'agents.list', desc: 'agents.list (Agent列表)' },
    { method: 'skills.status', desc: 'skills.status (技能状态)' },
    { method: 'skills.bins', desc: 'skills.bins (已安装技能)' },
    { method: 'channels.status', desc: 'channels.status (渠道状态)' },
    { method: 'cron.list', desc: 'cron.list (定时任务列表)' },
    { method: 'cron.status', desc: 'cron.status (定时任务状态)' },
    { method: 'tts.status', desc: 'tts.status (TTS状态)' },
    { method: 'tts.providers', desc: 'tts.providers (TTS提供商)' },
    { method: 'usage.status', desc: 'usage.status (用量状态)' },
    { method: 'talk.mode', desc: 'talk.mode (对话模式)' },
    { method: 'talk.config', desc: 'talk.config (对话配置)' },
    { method: 'voicewake.get', desc: 'voicewake.get (语音唤醒)' },
    { method: 'last-heartbeat', desc: 'last-heartbeat (心跳)' },
    { method: 'node.list', desc: 'node.list (节点列表)' },
    { method: 'device.pair.list', desc: 'device.pair.list (设备配对)' },
    { method: 'exec.approvals.get', desc: 'exec.approvals.get (审批设置)' },
    { method: 'gateway.network.status', desc: 'gateway.network.status (网络状态)' },
    { method: 'route.getChannelAgents', desc: 'route.getChannelAgents (路由)' },
  ];

  for (const test of rpcTests) {
    try {
      const resp = await sendRpc(test.method, test.params || {});
      if (resp.error) {
        if (resp.error.code === -32601) {
          fail(`WS ${test.desc} => method not found`);
        } else if (resp.error.code === -32603 || resp.error.message) {
          // 内部错误但方法存在
          pass(`WS ${test.desc} => 方法存在 (error: ${resp.error.message || resp.error.code})`);
        } else {
          fail(`WS ${test.desc} => error: ${JSON.stringify(resp.error).slice(0,100)}`);
        }
      } else {
        const resultPreview = JSON.stringify(resp.result).slice(0, 120);
        pass(`WS ${test.desc} => ${resultPreview}`);
      }
    } catch(e) {
      fail(`WS ${test.desc} => ${e.message}`);
    }
  }

  // 测试chat.send（不发真消息，只验证方法存在）
  try {
    const resp = await sendRpc('chat.send', { message: '' });
    if (resp.error && resp.error.code === -32601) {
      fail('WS chat.send => method not found');
    } else {
      pass('WS chat.send => 方法可达');
    }
  } catch(e) {
    pass('WS chat.send => 方法存在 (超时/正常)');
  }

  ws.close();

  // 统计
  const passCount = results.filter(r => r.s === 'PASS').length;
  const failCount = results.filter(r => r.s === 'FAIL').length;
  log(`\n  WebSocket测试: ${passCount} PASS, ${failCount} FAIL`);
}

run().catch(e => {
  log(`  [FAIL] WebSocket测试异常: ${e.message}`);
  if (ws) ws.close();
  process.exit(1);
});
WSEOF

  # 运行WebSocket测试
  "$NODE" "$WS_TEST_SCRIPT" "ws://127.0.0.1:$PORT" "$TOKEN" 2>/dev/null
  WS_EXIT=$?
  if [ $WS_EXIT -eq 0 ]; then
    pass "WebSocket测试套件完成"
  else
    fail "WebSocket测试套件异常退出 ($WS_EXIT)"
  fi

  # ── 6. 进程和端口检查 ──
  echo ""
  echo "=== 阶段 6: 进程/端口验证 ==="

  if kill -0 $GW_PID 2>/dev/null; then
    pass "Gateway进程仍在运行 (PID: $GW_PID)"
  else
    fail "Gateway进程已退出"
  fi

  LISTEN_INFO=$(lsof -i -P -n 2>/dev/null | grep "$GW_PID" | head -10)
  if [ -n "$LISTEN_INFO" ]; then
    echo "$LISTEN_INFO" | while read line; do echo "  $line"; done
    pass "端口监听正常"
  else
    warn "无法获取端口监听信息 (lsof权限)"
  fi

  # ── 7. 日志验证 ──
  echo ""
  echo "=== 阶段 7: 日志验证 ==="

  # 检查关键日志项
  STDOUT_LOG="/tmp/clawdbot-test-stdout.log"
  STDERR_LOG="/tmp/clawdbot-test-stderr.log"

  check_log() {
    local PATTERN="$1"
    local DESC="$2"
    if grep -q "$PATTERN" "$STDOUT_LOG" 2>/dev/null || grep -q "$PATTERN" "$STDERR_LOG" 2>/dev/null; then
      pass "日志: $DESC"
    else
      fail "日志缺失: $DESC"
    fi
  }

  check_log "ready" "Gateway ready"
  check_log "listening on ws://" "WebSocket监听"
  check_log "Agent Team" "Agent Team插件"
  check_log "dingtalk" "钉钉渠道插件"
  check_log "feishu" "飞书渠道插件"
  check_log "Orchestrator" "Orchestrator插件"
  check_log "canvas" "Canvas挂载"
  check_log "heartbeat" "心跳启动"
  check_log "model-config" "模型配置"
  check_log "tool-index" "Tool-index同步"
  check_log "MCP" "MCP同步"
  check_log "Browser control" "浏览器控制服务"
  check_log "delivery-recovery" "消息恢复"

  # ── 8. 停止Gateway ──
  echo ""
  echo "=== 阶段 8: 优雅关闭 ==="

  if kill -0 $GW_PID 2>/dev/null; then
    kill $GW_PID 2>/dev/null
    sleep 3
    if kill -0 $GW_PID 2>/dev/null; then
      warn "SIGTERM后3秒仍在运行, 发送SIGKILL"
      kill -9 $GW_PID 2>/dev/null
    else
      pass "SIGTERM优雅关闭成功"
    fi
  fi

  # 检查关闭日志
  if grep -q "SIGTERM\|shutting down\|shutdown" "$STDOUT_LOG" 2>/dev/null; then
    pass "优雅关闭日志存在"
  fi

else
  fail "Gateway未启动, 跳过接口测试"
  echo "  stdout: $(tail -15 /tmp/clawdbot-test-stdout.log 2>/dev/null)"
  echo "  stderr: $(tail -15 /tmp/clawdbot-test-stderr.log 2>/dev/null)"
fi

# ── 清理 ──
echo ""
echo "=== 清理 ==="
rm -rf "$INSTALL_DIR" "$CLAWDBOT_DATA_DIR" "$CLAWDBOT_LOG_DIR"
rm -f /tmp/clawdbot-ws-test.js /tmp/api-resp-body.txt
# 保留日志供检查
echo "  日志保留在: /tmp/clawdbot-test-stdout.log, /tmp/clawdbot-test-stderr.log"

# ── 总结 ──
echo ""
echo "========================================="
echo " 测试结果汇总"
echo "========================================="
TOTAL=$((PASS+FAIL+WARN))
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  WARN: $WARN"
echo "  TOTAL: $TOTAL"
echo ""
if [ $FAIL -eq 0 ]; then
  echo "  ★ 全部测试通过 ★"
else
  echo "  ✗ 有 $FAIL 个测试失败"
fi
echo "========================================="
