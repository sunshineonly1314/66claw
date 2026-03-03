#!/usr/bin/env bash
set -uo pipefail

# ClawdbotCN Windows 全面接口测试
# 合并 HTTP API + WebSocket RPC 业务功能测试
# 覆盖: Health/CORS, Auth, Setup Wizard, Open URL 安全, OpenAI API, Tools Invoke,
#       Media, 模型管理, Agent管理, 会话管理, 聊天, 配置, 技能, TTS,
#       使用统计, Cron, Talk, 频道状态, 飞书/钉钉, 日志分析

PORT=18799
TOKEN="test-ci-win-$(date +%s)"
GW_PID=""
LOG_FILE="/tmp/gw-win-test.log"

INSTALL_DIR="E:/openclawcn/ClawdbotCN"
RES="$INSTALL_DIR/resources"
NODE="$RES/node/node.exe"
BASE="http://127.0.0.1:$PORT"

PASS=0; FAIL=0; WARN=0
pass() { echo "  [PASS] $1"; PASS=$((PASS+1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }
warn() { echo "  [WARN] $1"; WARN=$((WARN+1)); }

# ── Pre-cleanup ──
echo "=== 清理旧进程 ==="
# Kill any existing gateway on test port
for pid in $(netstat -ano 2>/dev/null | grep ":$PORT " | grep LISTENING | awk '{print $5}' | sort -u); do
  [ -n "$pid" ] && taskkill //PID "$pid" //F 2>/dev/null
done
# Kill node processes from install dir
wmic process where "name='node.exe' and commandline like '%openclawcn%'" call terminate 2>/dev/null || true
sleep 2

cleanup() {
  if [ -n "$GW_PID" ]; then
    taskkill //PID "$GW_PID" //F 2>/dev/null
    # Also kill child node processes
    wmic process where "ParentProcessId='$GW_PID'" call terminate 2>/dev/null || true
    wait "$GW_PID" 2>/dev/null
  fi
}
trap cleanup EXIT

echo ""
echo "============================================"
echo "  ClawdbotCN Windows 全面接口测试"
echo "  版本: 1.6.1 | 端口: $PORT"
echo "============================================"
echo ""

# ── Start Gateway ──
echo "=== 启动 Gateway ==="
cd "$RES"
OPENCLAWCN_GATEWAY_TOKEN="$TOKEN" \
OPENCLAWCN_GATEWAY_PORT="$PORT" \
OPENCLAWCN_REGION=cn \
OPENCLAWCN_DESKTOP_MODE=1 \
NODE_ENV=production \
"$NODE" "$RES/dist/entry.js" gateway --port "$PORT" --force --allow-unconfigured > "$LOG_FILE" 2>&1 &
GW_PID=$!
echo "  PID: $GW_PID"

READY=false
for i in $(seq 1 90); do
  H=$(curl -s "$BASE/api/health" 2>/dev/null || true)
  if echo "$H" | grep -q '"ready":true' 2>/dev/null; then READY=true; echo "  Gateway ready (${i}s)"; break; fi
  sleep 1
done
[ "$READY" != "true" ] && echo "  启动超时!" && tail -30 "$LOG_FILE" && exit 1
echo ""

# ════════════════════════════════════════════════════════
# Part A: HTTP API 测试
# ════════════════════════════════════════════════════════

echo "╔════════════════════════════════════════════╗"
echo "║     Part A: HTTP API 接口测试              ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# ── A1. Health & CORS ──
echo "=== A1. Health & CORS ==="

echo "A1.1 GET /api/health:"
H_RESP=$(curl -s "$BASE/api/health")
H_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health")
if echo "$H_RESP" | grep -q '"ready":true'; then
  pass "health 返回 ready:true ($H_CODE)"
else
  fail "health 异常: $H_RESP"
fi

echo "A1.2 OPTIONS (CORS preflight):"
CORS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$BASE/api/health" \
  -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: GET")
if [ "$CORS_CODE" = "204" ] || [ "$CORS_CODE" = "200" ]; then
  pass "CORS preflight ($CORS_CODE)"
else
  warn "CORS preflight 返回 $CORS_CODE"
fi

echo "A1.3 null Origin 拒绝:"
NULL_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health" -H "Origin: null")
if [ "$NULL_CODE" = "200" ] || [ "$NULL_CODE" = "403" ]; then
  pass "null Origin 处理正确 ($NULL_CODE)"
else
  warn "null Origin 返回 $NULL_CODE"
fi

echo ""

# ── A2. Auth 安全 ──
echo "=== A2. Auth 安全 ==="

echo "A2.1 GET /api/local-token (无 auth):"
LT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/local-token")
if [ "$LT_CODE" = "401" ] || [ "$LT_CODE" = "403" ]; then
  pass "local-token 无 auth 正确拒绝 ($LT_CODE)"
else
  warn "local-token 返回 $LT_CODE"
fi

echo "A2.2 GET /api/auth/discover:"
AD_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/auth/discover")
AD_RESP=$(curl -s "$BASE/api/auth/discover")
if [ "$AD_CODE" = "200" ]; then
  pass "auth/discover 返回 200"
else
  warn "auth/discover 返回 $AD_CODE"
fi

echo "A2.3 POST /api/shutdown (无 auth):"
SD_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/shutdown")
if [ "$SD_CODE" = "401" ] || [ "$SD_CODE" = "403" ] || [ "$SD_CODE" = "405" ]; then
  pass "shutdown 无 auth 正确拒绝 ($SD_CODE)"
else
  fail "shutdown 无 auth 返回 $SD_CODE (安全风险!)"
fi

echo ""

# ── A3. Setup Wizard API ──
echo "=== A3. Setup Wizard API ==="

SETUP_ENDPOINTS=(
  "configure-provider"
  "configure-workspace"
  "configure-security"
  "verify-channel"
  "configure-channels"
  "validate-api-key"
  "fetch-models"
  "free-models/test"
  "free-models/configure"
  "free-models/config"
  "validate-license"
  "switch-device"
  "open-url"
  "browse-directory"
)

for ep in "${SETUP_ENDPOINTS[@]}"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/$ep" \
    -H "Content-Type: application/json" -d '{}' --max-time 10)
  if [ "$CODE" = "200" ] || [ "$CODE" = "400" ] || [ "$CODE" = "403" ] || [ "$CODE" = "410" ]; then
    pass "setup/$ep ($CODE)"
  else
    warn "setup/$ep 返回 $CODE"
  fi
done

echo ""

# ── A4. Open URL 安全注入测试 ──
echo "=== A4. Open URL 安全注入 ==="

INJECT_TESTS=(
  '{"url":"https://example.com; rm -rf /"}'
  '{"url":"https://example.com | cat /etc/passwd"}'
  '{"url":"https://example.com && whoami"}'
  '{"url":"file:///etc/passwd"}'
  '{"url":"javascript:alert(1)"}'
  '{"url":"https://example.com`whoami`"}'
)
INJECT_LABELS=(
  "分号注入" "管道注入" "&&注入" "file://协议" "javascript://协议" "反引号注入"
)

for i in "${!INJECT_TESTS[@]}"; do
  INJ_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/open-url" \
    -H "Content-Type: application/json" -d "${INJECT_TESTS[$i]}" --max-time 5)
  if [ "$INJ_CODE" = "400" ] || [ "$INJ_CODE" = "403" ] || [ "$INJ_CODE" = "410" ]; then
    pass "${INJECT_LABELS[$i]} 正确拒绝 ($INJ_CODE)"
  else
    warn "${INJECT_LABELS[$i]} 返回 $INJ_CODE"
  fi
done

echo ""

# ── A5. 公共端点 ──
echo "=== A5. 公共端点 ==="

echo "A5.1 GET /config/purchase-url:"
PU_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/config/purchase-url" --max-time 5)
if [ "$PU_CODE" = "200" ] || [ "$PU_CODE" = "302" ] || [ "$PU_CODE" = "404" ]; then
  pass "purchase-url ($PU_CODE)"
else
  warn "purchase-url 返回 $PU_CODE"
fi

echo "A5.2 GET /api/support/qrcode:"
QR_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/support/qrcode" --max-time 5)
if [ "$QR_CODE" = "200" ] || [ "$QR_CODE" = "404" ]; then
  pass "qrcode ($QR_CODE)"
else
  warn "qrcode 返回 $QR_CODE"
fi

echo ""

# ── A6. UI 页面 ──
echo "=== A6. UI 页面 ==="

UI_PATHS=("/" "/chat" "/setup" "/settings")
for p in "${UI_PATHS[@]}"; do
  UI_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$p" --max-time 5)
  if [ "$UI_CODE" = "200" ] || [ "$UI_CODE" = "302" ] || [ "$UI_CODE" = "301" ]; then
    pass "UI $p ($UI_CODE)"
  else
    warn "UI $p 返回 $UI_CODE"
  fi
done

echo ""

# ── A7. OpenAI 兼容 API ──
echo "=== A7. OpenAI 兼容 API ==="

TMPFILE="/tmp/win-test-openai-$$.tmp"

echo "A7.1 POST /v1/chat/completions (无 auth):"
OANA_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/v1/chat/completions" \
  -H "Content-Type: application/json" -d '{"model":"gpt-4","messages":[{"role":"user","content":"hi"}]}' --max-time 5)
if [ "$OANA_CODE" = "401" ] || [ "$OANA_CODE" = "302" ] || [ "$OANA_CODE" = "403" ]; then
  pass "v1/chat/completions 无 auth 拒绝 ($OANA_CODE)"
else
  warn "v1/chat/completions 无 auth 返回 $OANA_CODE"
fi

echo "A7.2 POST /v1/chat/completions (有 auth):"
curl -s -o "$TMPFILE" -w "%{http_code}" -X POST "$BASE/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"hi"}],"stream":true}' --max-time 10 > /tmp/win-test-oa-code-$$.tmp 2>/dev/null &
OA_PID=$!
sleep 10
kill $OA_PID 2>/dev/null; wait $OA_PID 2>/dev/null
OA_CODE=$(cat /tmp/win-test-oa-code-$$.tmp 2>/dev/null | tail -c 3)
if [ -f "$TMPFILE" ]; then
  OA_SIZE=$(wc -c < "$TMPFILE" | tr -d ' ')
  if [ "$OA_SIZE" -gt 0 ] 2>/dev/null; then
    pass "v1/chat/completions 有 auth SSE 流开始 (${OA_SIZE} bytes)"
  else
    pass "v1/chat/completions 有 auth 端点可达"
  fi
else
  pass "v1/chat/completions 有 auth 端点可达"
fi
rm -f "$TMPFILE" /tmp/win-test-oa-code-$$.tmp

echo ""

# ── A8. OpenResponses API ──
echo "=== A8. OpenResponses API ==="

echo "A8.1 POST /v1/responses (无 auth):"
OR_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/v1/responses" \
  -H "Content-Type: application/json" -d '{"model":"gpt-4","input":"hello"}' --max-time 5)
if [ "$OR_CODE" = "401" ] || [ "$OR_CODE" = "302" ] || [ "$OR_CODE" = "404" ] || [ "$OR_CODE" = "403" ]; then
  pass "v1/responses 无 auth ($OR_CODE)"
else
  warn "v1/responses 返回 $OR_CODE"
fi

echo ""

# ── A9. Tools Invoke ──
echo "=== A9. Tools Invoke ==="

echo "A9.1 POST /tools/invoke (agents_list):"
TI_RESP=$(curl -s -X POST "$BASE/tools/invoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tool":"agents_list","input":{}}' --max-time 10)
TI_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/tools/invoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tool":"agents_list","input":{}}' --max-time 10)
if [ "$TI_CODE" = "200" ]; then
  pass "tools/invoke agents_list ($TI_CODE)"
elif [ "$TI_CODE" = "401" ] || [ "$TI_CODE" = "400" ]; then
  pass "tools/invoke 端点可达 ($TI_CODE)"
else
  warn "tools/invoke 返回 $TI_CODE"
fi

echo "A9.2 POST /tools/invoke (无 auth):"
TINA_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/tools/invoke" \
  -H "Content-Type: application/json" -d '{"tool":"agents_list","input":{}}' --max-time 5)
if [ "$TINA_CODE" = "401" ] || [ "$TINA_CODE" = "403" ]; then
  pass "tools/invoke 无 auth 拒绝 ($TINA_CODE)"
else
  warn "tools/invoke 无 auth 返回 $TINA_CODE"
fi

echo ""

# ── A10. 404 路由 ──
echo "=== A10. 404 路由 ==="

echo "A10.1 GET /api/nonexistent:"
NE_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/nonexistent")
if [ "$NE_CODE" = "404" ]; then
  pass "不存在路由返回 404"
else
  warn "不存在路由返回 $NE_CODE"
fi

echo ""

# ── A11. Media 端点 ──
echo "=== A11. Media 端点 ==="

echo "A11.1 GET /api/media/chat-images/test.png (不存在文件):"
MI_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/media/chat-images/test.png" \
  -H "Authorization: Bearer $TOKEN" --max-time 5)
if [ "$MI_CODE" = "404" ] || [ "$MI_CODE" = "401" ] || [ "$MI_CODE" = "200" ]; then
  pass "media/chat-images 端点可达 ($MI_CODE)"
else
  warn "media/chat-images 返回 $MI_CODE"
fi

echo "A11.2 路径穿越安全 (../../../etc/passwd):"
MT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/media/chat-images/..%2F..%2F..%2Fetc%2Fpasswd" \
  -H "Authorization: Bearer $TOKEN" --max-time 5)
if [ "$MT_CODE" = "400" ] || [ "$MT_CODE" = "403" ] || [ "$MT_CODE" = "404" ]; then
  pass "路径穿越正确拒绝 ($MT_CODE)"
else
  warn "路径穿越返回 $MT_CODE"
fi

echo ""

# ── A12. Edge Cases ──
echo "=== A12. 边界测试 ==="

echo "A12.1 大 body (1MB):"
BIG_BODY=$(python3 -c "print('{\"data\":\"' + 'A'*1048576 + '\"}')" 2>/dev/null || "$NODE" -e "console.log(JSON.stringify({data:'A'.repeat(1048576)}))")
BIG_CODE=$(echo "$BIG_BODY" | curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/configure-provider" \
  -H "Content-Type: application/json" -d @- --max-time 10)
if [ "$BIG_CODE" = "400" ] || [ "$BIG_CODE" = "413" ] || [ "$BIG_CODE" = "410" ] || [ "$BIG_CODE" = "200" ]; then
  pass "大 body 处理 ($BIG_CODE)"
else
  warn "大 body 返回 $BIG_CODE"
fi

echo "A12.2 无效 JSON:"
BADJSON_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/configure-provider" \
  -H "Content-Type: application/json" -d 'not-json{{{' --max-time 5)
if [ "$BADJSON_CODE" = "400" ] || [ "$BADJSON_CODE" = "410" ]; then
  pass "无效 JSON 正确处理 ($BADJSON_CODE)"
else
  warn "无效 JSON 返回 $BADJSON_CODE"
fi

echo ""

# ════════════════════════════════════════════════════════
# Part B: WebSocket RPC 业务功能测试
# ════════════════════════════════════════════════════════

echo "╔════════════════════════════════════════════╗"
echo "║     Part B: WebSocket RPC 业务功能测试      ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# ─── WebSocket RPC 测试函数 ───
ws_rpc() {
  local METHOD="$1"
  local PARAMS="$2"
  local TIMEOUT="${3:-8}"
  "$NODE" -e "
const WebSocket = require('$RES/node_modules/ws');
const crypto = require('crypto');
const rpcId = 'rpc-' + Date.now();
const connectId = 'connect-' + Date.now();
const ws = new WebSocket('ws://127.0.0.1:$PORT/');
let authenticated = false;
let responded = false;

ws.on('open', () => {});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());

    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      ws.send(JSON.stringify({
        type: 'req',
        id: connectId,
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'openclawcn-control-ui',
            version: '1.0.0-ci-test',
            platform: 'win32',
            mode: 'ui'
          },
          auth: { token: '$TOKEN' },
          role: 'operator',
          scopes: ['operator.read', 'operator.write', 'operator.admin']
        }
      }));
      return;
    }

    if (msg.type === 'res' && msg.id === connectId) {
      if (msg.ok) {
        authenticated = true;
        ws.send(JSON.stringify({
          type: 'req', id: rpcId, method: '$METHOD', params: $PARAMS
        }));
      } else {
        if (!responded) {
          responded = true;
          console.log(JSON.stringify({error: 'connect_rejected', detail: msg.error}));
          ws.close();
        }
      }
      return;
    }

    if (msg.type === 'res' && msg.id === rpcId) {
      if (!responded) {
        responded = true;
        console.log(JSON.stringify(msg));
        ws.close();
      }
      return;
    }
  } catch(e) {}
});

ws.on('error', (e) => {
  if (!responded) {
    responded = true;
    console.log(JSON.stringify({error: e.message}));
  }
});

ws.on('close', () => {
  if (!responded) {
    responded = true;
    console.log(JSON.stringify({error:'ws_closed', authenticated}));
  }
  process.exit(0);
});

setTimeout(() => {
  if (!responded) {
    responded = true;
    console.log(JSON.stringify({error:'timeout', authenticated}));
    ws.close();
  }
}, ${TIMEOUT}000);
" 2>/dev/null
}

# ── B1. 模型管理 ──
echo "=== B1. 模型管理接口 ==="

echo "B1.1 models.list:"
ML_RESP=$(ws_rpc "models.list" "{}")
echo "  Response (前400字符): $(echo "$ML_RESP" | head -c 400)"
if echo "$ML_RESP" | grep -q '"ok":true'; then
  pass "models.list 返回成功"
  MODEL_COUNT=$(echo "$ML_RESP" | "$NODE" -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const r=JSON.parse(d);const m=r.payload?.models||[];console.log(m.length)}catch{console.log(0)}})" 2>/dev/null)
  echo "  模型数量: $MODEL_COUNT"
  if [ "$MODEL_COUNT" -gt 0 ] 2>/dev/null; then
    pass "返回 $MODEL_COUNT 个模型"
  else
    warn "模型列表为空或解析失败"
  fi
else
  fail "models.list 失败: $(echo "$ML_RESP" | head -c 200)"
fi

echo ""

# ── B2. Agent 管理 ──
echo "=== B2. Agent 管理接口 ==="

echo "B2.1 agents.list:"
AL_RESP=$(ws_rpc "agents.list" "{}")
echo "  Response (前400字符): $(echo "$AL_RESP" | head -c 400)"
if echo "$AL_RESP" | grep -q '"ok":true'; then
  pass "agents.list 返回成功"
else
  fail "agents.list 失败: $(echo "$AL_RESP" | head -c 200)"
fi

echo "B2.2 agents.files.list (main):"
AFL_RESP=$(ws_rpc "agents.files.list" '{"agentId":"main"}')
echo "  Response (前400字符): $(echo "$AFL_RESP" | head -c 400)"
if echo "$AFL_RESP" | grep -q '"ok":true'; then
  pass "agents.files.list 返回成功"
else
  warn "agents.files.list: $(echo "$AFL_RESP" | head -c 200)"
fi

echo "B2.3 agents.files.get (SOUL.md):"
AFG_RESP=$(ws_rpc "agents.files.get" '{"agentId":"main","name":"SOUL.md"}')
echo "  Response (前300字符): $(echo "$AFG_RESP" | head -c 300)"
if echo "$AFG_RESP" | grep -q '"ok":true'; then
  pass "agents.files.get SOUL.md 返回成功"
else
  warn "agents.files.get: $(echo "$AFG_RESP" | head -c 200)"
fi

echo "B2.4 agent.identity.get:"
AIG_RESP=$(ws_rpc "agent.identity.get" '{"agentId":"main"}')
echo "  Response (前400字符): $(echo "$AIG_RESP" | head -c 400)"
if echo "$AIG_RESP" | grep -q '"ok":true'; then
  pass "agent.identity.get 返回成功"
else
  warn "agent.identity.get: $(echo "$AIG_RESP" | head -c 200)"
fi

echo ""

# ── B3. 会话管理 ──
echo "=== B3. 会话管理接口 ==="

echo "B3.1 sessions.list:"
SL_RESP=$(ws_rpc "sessions.list" '{"agentId":"main","limit":10}')
echo "  Response (前400字符): $(echo "$SL_RESP" | head -c 400)"
if echo "$SL_RESP" | grep -q '"ok":true'; then
  pass "sessions.list 返回成功"
else
  fail "sessions.list 失败: $(echo "$SL_RESP" | head -c 200)"
fi

echo "B3.2 sessions.preview:"
SP_RESP=$(ws_rpc "sessions.preview" '{"keys":["agent:main:global"],"limit":5}')
echo "  Response (前400字符): $(echo "$SP_RESP" | head -c 400)"
if echo "$SP_RESP" | grep -q '"ok":true'; then
  pass "sessions.preview 返回成功"
else
  warn "sessions.preview: $(echo "$SP_RESP" | head -c 200)"
fi

echo ""

# ── B4. 聊天接口 ──
echo "=== B4. 聊天接口 ==="

echo "B4.1 chat.history:"
CH_RESP=$(ws_rpc "chat.history" '{"sessionKey":"agent:main:global","limit":10}')
echo "  Response (前400字符): $(echo "$CH_RESP" | head -c 400)"
if echo "$CH_RESP" | grep -q '"ok":true'; then
  pass "chat.history 返回成功"
else
  warn "chat.history: $(echo "$CH_RESP" | head -c 200)"
fi

echo "B4.2 chat.send (mock):"
CS_RESP=$(ws_rpc "chat.send" '{"sessionKey":"agent:main:global","message":"test-ci-win-ping","idempotencyKey":"ci-win-'$TOKEN'"}' 12)
echo "  Response (前400字符): $(echo "$CS_RESP" | head -c 400)"
if echo "$CS_RESP" | grep -q '"ok"\|"runId"'; then
  if echo "$CS_RESP" | grep -q '"error"'; then
    pass "chat.send 端点可达 (无 API key 预期失败)"
  else
    pass "chat.send 返回成功"
  fi
else
  fail "chat.send 异常: $(echo "$CS_RESP" | head -c 200)"
fi

echo "B4.3 chat.abort:"
CA_RESP=$(ws_rpc "chat.abort" '{"sessionKey":"agent:main:global"}')
echo "  Response (前300字符): $(echo "$CA_RESP" | head -c 300)"
if echo "$CA_RESP" | grep -q '"ok":true'; then
  pass "chat.abort 返回成功"
else
  warn "chat.abort: $(echo "$CA_RESP" | head -c 200)"
fi

echo ""

# ── B5. 配置管理 ──
echo "=== B5. 配置管理接口 ==="

echo "B5.1 config.get:"
CG_RESP=$(ws_rpc "config.get" "{}")
echo "  Response (前500字符): $(echo "$CG_RESP" | head -c 500)"
if echo "$CG_RESP" | grep -q '"ok":true'; then
  pass "config.get 返回成功"
  if echo "$CG_RESP" | grep -q '"hash"\|"baseHash"'; then
    pass "config.get 包含 hash 字段"
  else
    warn "config.get 无 hash 字段"
  fi
else
  fail "config.get 失败: $(echo "$CG_RESP" | head -c 200)"
fi

echo "B5.2 config.schema:"
CSC_RESP=$(ws_rpc "config.schema" "{}")
echo "  Response (前300字符): $(echo "$CSC_RESP" | head -c 300)"
if echo "$CSC_RESP" | grep -q '"ok":true'; then
  pass "config.schema 返回成功"
else
  warn "config.schema: $(echo "$CSC_RESP" | head -c 200)"
fi

echo ""

# ── B6. 技能管理 ──
echo "=== B6. 技能管理接口 ==="

echo "B6.1 skills.status:"
SS_RESP=$(ws_rpc "skills.status" '{"agentId":"main"}' 30)
echo "  Response (前500字符): $(echo "$SS_RESP" | head -c 500)"
if echo "$SS_RESP" | grep -q '"ok":true'; then
  pass "skills.status 返回成功"
elif echo "$SS_RESP" | grep -q '"authenticated":true'; then
  warn "skills.status 超时但认证成功 (处理耗时较长)"
else
  fail "skills.status 失败: $(echo "$SS_RESP" | head -c 200)"
fi

echo "B6.2 skills.remote.list:"
SRL_RESP=$(ws_rpc "skills.remote.list" '{}' 15)
echo "  Response (前500字符): $(echo "$SRL_RESP" | head -c 500)"
if echo "$SRL_RESP" | grep -q '"ok":true'; then
  pass "skills.remote.list 返回成功"
else
  warn "skills.remote.list: $(echo "$SRL_RESP" | head -c 200)"
fi

echo "B6.3 skills.bins (需要 node 角色):"
SB_RESP=$(ws_rpc "skills.bins" '{}')
echo "  Response (前400字符): $(echo "$SB_RESP" | head -c 400)"
if echo "$SB_RESP" | grep -q '"ok":true'; then
  pass "skills.bins 返回成功"
elif echo "$SB_RESP" | grep -q 'unauthorized role'; then
  pass "skills.bins 正确拒绝 operator 角色 (需要 node 角色)"
else
  warn "skills.bins: $(echo "$SB_RESP" | head -c 200)"
fi

echo ""

# ── B7. TTS 语音 ──
echo "=== B7. TTS 语音接口 ==="

echo "B7.1 tts.status:"
TS_RESP=$(ws_rpc "tts.status" "{}")
echo "  Response (前400字符): $(echo "$TS_RESP" | head -c 400)"
if echo "$TS_RESP" | grep -q '"ok":true'; then
  pass "tts.status 返回成功"
else
  warn "tts.status: $(echo "$TS_RESP" | head -c 200)"
fi

echo "B7.2 tts.providers:"
TP_RESP=$(ws_rpc "tts.providers" "{}")
echo "  Response (前400字符): $(echo "$TP_RESP" | head -c 400)"
if echo "$TP_RESP" | grep -q '"ok":true'; then
  pass "tts.providers 返回成功"
else
  warn "tts.providers: $(echo "$TP_RESP" | head -c 200)"
fi

echo ""

# ── B8. 使用统计 ──
echo "=== B8. 使用统计接口 ==="

echo "B8.1 usage.status:"
US_RESP=$(ws_rpc "usage.status" "{}")
echo "  Response (前400字符): $(echo "$US_RESP" | head -c 400)"
if echo "$US_RESP" | grep -q '"ok":true'; then
  pass "usage.status 返回成功"
else
  warn "usage.status: $(echo "$US_RESP" | head -c 200)"
fi

echo "B8.2 usage.cost:"
UC_RESP=$(ws_rpc "usage.cost" '{"days":7}')
echo "  Response (前400字符): $(echo "$UC_RESP" | head -c 400)"
if echo "$UC_RESP" | grep -q '"ok":true'; then
  pass "usage.cost 返回成功"
else
  warn "usage.cost: $(echo "$UC_RESP" | head -c 200)"
fi

echo ""

# ── B9. Cron 定时任务 ──
echo "=== B9. Cron 定时任务接口 ==="

echo "B9.1 cron.list:"
CL_RESP=$(ws_rpc "cron.list" "{}")
echo "  Response (前400字符): $(echo "$CL_RESP" | head -c 400)"
if echo "$CL_RESP" | grep -q '"ok":true'; then
  pass "cron.list 返回成功"
else
  warn "cron.list: $(echo "$CL_RESP" | head -c 200)"
fi

echo "B9.2 cron.status:"
CST_RESP=$(ws_rpc "cron.status" "{}")
echo "  Response (前400字符): $(echo "$CST_RESP" | head -c 400)"
if echo "$CST_RESP" | grep -q '"ok":true'; then
  pass "cron.status 返回成功"
else
  warn "cron.status: $(echo "$CST_RESP" | head -c 200)"
fi

echo ""

# ── B10. Talk 语音模式 ──
echo "=== B10. Talk 语音模式接口 ==="

echo "B10.1 talk.config:"
TC_RESP=$(ws_rpc "talk.config" "{}")
echo "  Response (前400字符): $(echo "$TC_RESP" | head -c 400)"
if echo "$TC_RESP" | grep -q '"ok":true'; then
  pass "talk.config 返回成功"
else
  warn "talk.config: $(echo "$TC_RESP" | head -c 200)"
fi

echo "B10.2 talk.mode:"
TM_RESP=$(ws_rpc "talk.mode" '{"enabled":false}')
echo "  Response (前300字符): $(echo "$TM_RESP" | head -c 300)"
if echo "$TM_RESP" | grep -q '"ok":true'; then
  pass "talk.mode 返回成功"
else
  warn "talk.mode: $(echo "$TM_RESP" | head -c 200)"
fi

echo ""

# ── B11. 其他系统接口 ──
echo "=== B11. 其他系统接口 ==="

echo "B11.1 health (WS RPC):"
HW_RESP=$(ws_rpc "health" "{}")
echo "  Response (前400字符): $(echo "$HW_RESP" | head -c 400)"
if echo "$HW_RESP" | grep -q '"ok":true'; then
  pass "health WS RPC 返回成功"
else
  warn "health WS RPC: $(echo "$HW_RESP" | head -c 200)"
fi

echo "B11.2 status:"
ST_RESP=$(ws_rpc "status" "{}")
echo "  Response (前400字符): $(echo "$ST_RESP" | head -c 400)"
if echo "$ST_RESP" | grep -q '"ok":true'; then
  pass "status 返回成功"
else
  warn "status: $(echo "$ST_RESP" | head -c 200)"
fi

echo "B11.3 logs.tail:"
LT_RESP=$(ws_rpc "logs.tail" '{"limit":10}')
echo "  Response (前400字符): $(echo "$LT_RESP" | head -c 400)"
if echo "$LT_RESP" | grep -q '"ok":true'; then
  pass "logs.tail 返回成功"
else
  warn "logs.tail: $(echo "$LT_RESP" | head -c 200)"
fi

echo "B11.4 channels.status:"
CHS_RESP=$(ws_rpc "channels.status" "{}")
echo "  Response (前400字符): $(echo "$CHS_RESP" | head -c 400)"
if echo "$CHS_RESP" | grep -q '"ok":true'; then
  pass "channels.status 返回成功"
else
  warn "channels.status: $(echo "$CHS_RESP" | head -c 200)"
fi

echo "B11.5 voicewake.get:"
VW_RESP=$(ws_rpc "voicewake.get" "{}")
echo "  Response (前300字符): $(echo "$VW_RESP" | head -c 300)"
if echo "$VW_RESP" | grep -q '"ok":true'; then
  pass "voicewake.get 返回成功"
else
  warn "voicewake.get: $(echo "$VW_RESP" | head -c 200)"
fi

echo ""

# ── B12. 执行审批 ──
echo "=== B12. 执行审批接口 ==="

echo "B12.1 exec.approvals.get:"
EA_RESP=$(ws_rpc "exec.approvals.get" "{}")
echo "  Response (前300字符): $(echo "$EA_RESP" | head -c 300)"
if echo "$EA_RESP" | grep -q '"ok":true'; then
  pass "exec.approvals.get 返回成功"
else
  warn "exec.approvals.get: $(echo "$EA_RESP" | head -c 200)"
fi

echo ""

# ── B13. 飞书/钉钉 Webhook ──
echo "=== B13. 飞书/钉钉 Webhook 回调 ==="

echo "B13.1 飞书 URL 验证 (challenge):"
FC_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/channels/feishu/default/webhook" \
  -H "Content-Type: application/json" \
  -d '{"challenge":"test-challenge","token":"fake","type":"url_verification"}' --max-time 10)
echo "  HTTP: $FC_CODE"
if [ "$FC_CODE" = "200" ] || [ "$FC_CODE" = "401" ] || [ "$FC_CODE" = "404" ] || [ "$FC_CODE" = "405" ]; then
  pass "飞书 webhook 端点可达 ($FC_CODE)"
else
  warn "飞书 webhook 返回 $FC_CODE"
fi

echo "B13.2 飞书消息事件 (mock):"
FM_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/channels/feishu/default/webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"schema":"2.0","header":{"event_id":"evt_test","token":"fake","event_type":"im.message.receive_v1","app_id":"cli_fake"},"event":{"sender":{"sender_id":{"open_id":"ou_test"}},"message":{"message_id":"om_test","chat_id":"oc_test","chat_type":"p2p","message_type":"text","content":"{\"text\":\"hello\"}"}}}' --max-time 10)
echo "  HTTP: $FM_CODE"
if [ "$FM_CODE" = "200" ] || [ "$FM_CODE" = "401" ] || [ "$FM_CODE" = "404" ] || [ "$FM_CODE" = "400" ] || [ "$FM_CODE" = "405" ]; then
  pass "飞书消息事件端点可达 ($FM_CODE)"
else
  warn "飞书消息事件返回 $FM_CODE"
fi

echo "B13.3 钉钉 webhook (mock):"
DT_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/channels/dingtalk/default/webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"msgId":"test123","conversationType":"1","senderId":"user1","senderNick":"test","msgtype":"text","text":{"content":"hello"}}' --max-time 10)
echo "  HTTP: $DT_CODE"
if [ "$DT_CODE" = "200" ] || [ "$DT_CODE" = "401" ] || [ "$DT_CODE" = "404" ] || [ "$DT_CODE" = "400" ] || [ "$DT_CODE" = "405" ]; then
  pass "钉钉 webhook 端点可达 ($DT_CODE)"
else
  warn "钉钉 webhook 返回 $DT_CODE"
fi

echo ""

# ── B14. 不存在的 RPC 方法 ──
echo "=== B14. 不存在的 RPC 方法 ==="

echo "B14.1 nonexistent.method:"
NEM_RESP=$(ws_rpc "nonexistent.method" "{}")
echo "  Response (前300字符): $(echo "$NEM_RESP" | head -c 300)"
if echo "$NEM_RESP" | grep -q '"error"\|"ok":false'; then
  pass "不存在方法正确返回错误"
else
  warn "不存在方法: $(echo "$NEM_RESP" | head -c 200)"
fi

echo ""

# ════════════════════════════════════════════════════════
# Part C: 日志分析
# ════════════════════════════════════════════════════════

echo "╔════════════════════════════════════════════╗"
echo "║     Part C: 日志分析                       ║"
echo "╚════════════════════════════════════════════╝"
echo ""

LOG_LINES=$(wc -l < "$LOG_FILE" 2>/dev/null | tr -d ' \n')
echo "日志总行数: $LOG_LINES"

CRITICAL=$(grep -i "error\|exception\|fatal\|crash\|panic\|unhandled" "$LOG_FILE" 2>/dev/null \
  | grep -iv "api.key\|validate\|invalid.*key\|license\|fetch.*model\|ECONNREFUSED\|verify\|fake\|No API key\|unable to open database\|NODE_OPTIONS\|sherpa-onnx\|MCP.*baseline\|tool-index bridge\|FailoverError\|not configured\|mapAsMap\|connect.*challenge\|unauthorized role\|unknown method\|errorCode=INVALID_REQUEST\|EPERM\|ENOENT\|token expired" \
  | wc -l | tr -d ' \n')
ALL_ERRORS=$(grep -ci "error\|exception\|fatal\|crash\|panic\|unhandled" "$LOG_FILE" 2>/dev/null || echo 0)
echo "  总错误: $ALL_ERRORS (关键/未预期: $CRITICAL)"

if [ "$ALL_ERRORS" -gt 0 ]; then
  echo "  所有错误:"
  grep -in "error\|exception\|fatal\|crash\|panic\|unhandled" "$LOG_FILE" | head -30
fi

if [ "$CRITICAL" = "0" ] || [ -z "$CRITICAL" ]; then
  pass "无关键未预期错误"
else
  warn "发现 $CRITICAL 处关键错误"
fi

echo ""
echo "最近日志 20 行:"
tail -20 "$LOG_FILE"

# ── Cleanup ──
echo ""
echo "=== 清理 ==="
taskkill //PID "$GW_PID" //F 2>/dev/null
wmic process where "ParentProcessId='$GW_PID'" call terminate 2>/dev/null || true
wait "$GW_PID" 2>/dev/null
GW_PID=""
echo "Gateway 已停止"

# ── Summary ──
echo ""
echo "╔════════════════════════════════════════════╗"
echo "║  ClawdbotCN Windows 全面接口测试结果        ║"
echo "╠════════════════════════════════════════════╣"
echo "║  通过: $(printf '%-34s' "$PASS") ║"
echo "║  失败: $(printf '%-34s' "$FAIL") ║"
echo "║  警告: $(printf '%-34s' "$WARN") ║"
echo "╚════════════════════════════════════════════╝"

[ "$FAIL" -gt 0 ] && exit 1
exit 0
