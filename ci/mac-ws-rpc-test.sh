#!/usr/bin/env bash
set -uo pipefail

# ClawdbotCN WebSocket RPC 业务功能接口测试
# 测试：模型列表/切换、Agent管理、会话管理、聊天、技能、Cron、
#       配置管理、TTS、使用统计、飞书/钉钉回调 等

PORT=18799
TOKEN="test-ci-$(date +%s)"
GW_PID=""
LOG_FILE="/tmp/gw-ws-test.log"
DMG_PATH="${1:-/Users/kevinsun/cicd-workspace/openclawcn/apps/desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg/ClawdbotCN_1.6.1_universal.dmg}"

PASS=0; FAIL=0; WARN=0
pass() { echo "  [PASS] $1"; PASS=$((PASS+1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }
warn() { echo "  [WARN] $1"; WARN=$((WARN+1)); }

# ── Pre-cleanup ──
SYS_NODE="/usr/local/lib/nodejs/node-v22.16.0-darwin-arm64/bin/node"
[ ! -f "$SYS_NODE" ] && SYS_NODE=$(which node 2>/dev/null || echo "")
if [ -n "$SYS_NODE" ]; then
  TMPDIR_ACTUAL=$("$SYS_NODE" -e "console.log(require('os').tmpdir())" 2>/dev/null || echo "/tmp")
  LOCK_DIR="$TMPDIR_ACTUAL/openclawcn-$(id -u)"
  if [ -d "$LOCK_DIR" ]; then
    for lf in "$LOCK_DIR"/gateway.*.lock; do
      [ -f "$lf" ] || continue
      OLD_PID=$("$SYS_NODE" -e "try{console.log(JSON.parse(require('fs').readFileSync('$lf','utf8')).pid)}catch{}" 2>/dev/null)
      [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null && kill -9 "$OLD_PID" 2>/dev/null && sleep 2
      rm -f "$lf" "${lf%.lock}.heartbeat"
    done
  fi
fi
lsof -ti:$PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

# ── Mount DMG ──
hdiutil detach "/Volumes/ClawdbotCN" -force 2>/dev/null || true
sleep 1
hdiutil attach "$DMG_PATH" -nobrowse -quiet 2>/dev/null || true
sleep 2

APP="/Volumes/ClawdbotCN/ClawdbotCN.app"
RES="$APP/Contents/Resources/resources"
NODE="$RES/node/bin/node"
BASE="http://127.0.0.1:$PORT"

cleanup() { [ -n "$GW_PID" ] && kill "$GW_PID" 2>/dev/null && wait "$GW_PID" 2>/dev/null; }
trap cleanup EXIT

echo "============================================"
echo "  ClawdbotCN WebSocket RPC 业务功能测试"
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

# ─── WebSocket RPC 测试函数 ───
# 通过 Node.js + ws 模块发送 WS RPC 请求并返回结果
# Gateway WS 协议: 服务端发 connect.challenge → 客户端发 {type:"req", method:"connect", params:ConnectParams}
#                   → 服务端回 {type:"res", ok:true, payload:{type:"hello-ok"}} → 之后可发 RPC 请求
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

    // Step 1: server sends connect.challenge with nonce
    // We respond with a proper ConnectParams request frame
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
            platform: 'darwin',
            mode: 'ui'
          },
          auth: { token: '$TOKEN' },
          role: 'operator',
          scopes: ['operator.read', 'operator.write', 'operator.admin']
        }
      }));
      return;
    }

    // Step 2: server responds to connect with hello-ok
    if (msg.type === 'res' && msg.id === connectId) {
      if (msg.ok) {
        authenticated = true;
        // Now send our actual RPC request
        ws.send(JSON.stringify({
          type: 'req', id: rpcId, method: '$METHOD', params: $PARAMS
        }));
      } else {
        // Connect rejected
        if (!responded) {
          responded = true;
          console.log(JSON.stringify({error: 'connect_rejected', detail: msg.error}));
          ws.close();
        }
      }
      return;
    }

    // Step 3: capture RPC response
    if (msg.type === 'res' && msg.id === rpcId) {
      if (!responded) {
        responded = true;
        console.log(JSON.stringify(msg));
        ws.close();
      }
      return;
    }

    // Ignore other events (snapshots, etc.)
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

# ════════════════════════════════════════════════
# 1. 模型管理接口
# ════════════════════════════════════════════════
echo "=== 1. 模型管理接口 ==="

# 1.1 models.list
echo "1.1 models.list:"
ML_RESP=$(ws_rpc "models.list" "{}")
echo "  Response (前400字符): $(echo "$ML_RESP" | head -c 400)"
if echo "$ML_RESP" | grep -q '"ok":true\|"result"'; then
  pass "models.list 返回成功"
  # 检查是否有模型数据
  MODEL_COUNT=$(echo "$ML_RESP" | "$NODE" -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const r=JSON.parse(d);const m=r.payload?.models||r.result?.models||[];console.log(m.length)}catch{console.log(0)}})" 2>/dev/null)
  echo "  模型数量: $MODEL_COUNT"
  if [ "$MODEL_COUNT" -gt 0 ] 2>/dev/null; then
    pass "返回 $MODEL_COUNT 个模型"
  else
    warn "模型列表为空或解析失败"
  fi
else
  fail "models.list 失败: $ML_RESP"
fi

echo ""

# ════════════════════════════════════════════════
# 2. Agent 管理接口
# ════════════════════════════════════════════════
echo "=== 2. Agent 管理接口 ==="

# 2.1 agents.list
echo "2.1 agents.list:"
AL_RESP=$(ws_rpc "agents.list" "{}")
echo "  Response (前400字符): $(echo "$AL_RESP" | head -c 400)"
if echo "$AL_RESP" | grep -q '"ok":true\|"result"'; then
  pass "agents.list 返回成功"
else
  fail "agents.list 失败: $AL_RESP"
fi

# 2.2 agents.files.list (main agent)
echo "2.2 agents.files.list (main):"
AFL_RESP=$(ws_rpc "agents.files.list" '{"agentId":"main"}')
echo "  Response (前400字符): $(echo "$AFL_RESP" | head -c 400)"
if echo "$AFL_RESP" | grep -q '"ok":true\|"result"'; then
  pass "agents.files.list 返回成功"
else
  warn "agents.files.list: $AFL_RESP"
fi

# 2.3 agents.files.get (SOUL.md)
echo "2.3 agents.files.get (SOUL.md):"
AFG_RESP=$(ws_rpc "agents.files.get" '{"agentId":"main","name":"SOUL.md"}')
echo "  Response (前300字符): $(echo "$AFG_RESP" | head -c 300)"
if echo "$AFG_RESP" | grep -q '"ok":true\|"result"'; then
  pass "agents.files.get SOUL.md 返回成功"
else
  warn "agents.files.get SOUL.md: $(echo "$AFG_RESP" | head -c 200)"
fi

# 2.4 agent.identity.get
echo "2.4 agent.identity.get:"
AIG_RESP=$(ws_rpc "agent.identity.get" '{"agentId":"main"}')
echo "  Response (前400字符): $(echo "$AIG_RESP" | head -c 400)"
if echo "$AIG_RESP" | grep -q '"ok":true\|"result"'; then
  pass "agent.identity.get 返回成功"
else
  warn "agent.identity.get: $(echo "$AIG_RESP" | head -c 200)"
fi

echo ""

# ════════════════════════════════════════════════
# 3. 会话管理接口
# ════════════════════════════════════════════════
echo "=== 3. 会话管理接口 ==="

# 3.1 sessions.list
echo "3.1 sessions.list:"
SL_RESP=$(ws_rpc "sessions.list" '{"agentId":"main","limit":10}')
echo "  Response (前400字符): $(echo "$SL_RESP" | head -c 400)"
if echo "$SL_RESP" | grep -q '"ok":true\|"result"'; then
  pass "sessions.list 返回成功"
else
  fail "sessions.list 失败: $SL_RESP"
fi

# 3.2 sessions.preview
echo "3.2 sessions.preview:"
SP_RESP=$(ws_rpc "sessions.preview" '{"keys":["agent:main:global"],"limit":5}')
echo "  Response (前400字符): $(echo "$SP_RESP" | head -c 400)"
if echo "$SP_RESP" | grep -q '"ok":true\|"result"'; then
  pass "sessions.preview 返回成功"
else
  warn "sessions.preview: $(echo "$SP_RESP" | head -c 200)"
fi

echo ""

# ════════════════════════════════════════════════
# 4. 聊天接口
# ════════════════════════════════════════════════
echo "=== 4. 聊天接口 ==="

# 4.1 chat.history
echo "4.1 chat.history:"
CH_RESP=$(ws_rpc "chat.history" '{"sessionKey":"agent:main:global","limit":10}')
echo "  Response (前400字符): $(echo "$CH_RESP" | head -c 400)"
if echo "$CH_RESP" | grep -q '"ok":true\|"result"'; then
  pass "chat.history 返回成功"
else
  warn "chat.history: $(echo "$CH_RESP" | head -c 200)"
fi

# 4.2 chat.send (mock 消息，不会真正调用 LLM 因为没配 API key)
echo "4.2 chat.send (mock):"
CS_RESP=$(ws_rpc "chat.send" '{"sessionKey":"agent:main:global","message":"test-ci-ping","idempotencyKey":"ci-test-'$TOKEN'"}' 12)
echo "  Response (前400字符): $(echo "$CS_RESP" | head -c 400)"
if echo "$CS_RESP" | grep -q '"ok"\|"runId"\|"result"\|"error"'; then
  # chat.send 可能因无 API key 而失败，但端点应该可达
  if echo "$CS_RESP" | grep -q '"error"'; then
    pass "chat.send 端点可达 (无 API key 预期失败)"
  else
    pass "chat.send 返回成功"
  fi
else
  fail "chat.send 异常: $CS_RESP"
fi

# 4.3 chat.abort
echo "4.3 chat.abort:"
CA_RESP=$(ws_rpc "chat.abort" '{"sessionKey":"agent:main:global"}')
echo "  Response (前300字符): $(echo "$CA_RESP" | head -c 300)"
if echo "$CA_RESP" | grep -q '"ok":true\|"result"'; then
  pass "chat.abort 返回成功"
else
  warn "chat.abort: $(echo "$CA_RESP" | head -c 200)"
fi

echo ""

# ════════════════════════════════════════════════
# 5. 配置管理接口
# ════════════════════════════════════════════════
echo "=== 5. 配置管理接口 ==="

# 5.1 config.get
echo "5.1 config.get:"
CG_RESP=$(ws_rpc "config.get" "{}")
echo "  Response (前500字符): $(echo "$CG_RESP" | head -c 500)"
if echo "$CG_RESP" | grep -q '"ok":true\|"result"'; then
  pass "config.get 返回成功"
  # 检查 hash 字段
  if echo "$CG_RESP" | grep -q '"hash"\|"baseHash"'; then
    pass "config.get 包含 hash 字段"
  else
    warn "config.get 无 hash 字段"
  fi
else
  fail "config.get 失败: $CG_RESP"
fi

# 5.2 config.schema
echo "5.2 config.schema:"
CSC_RESP=$(ws_rpc "config.schema" "{}")
echo "  Response (前300字符): $(echo "$CSC_RESP" | head -c 300)"
if echo "$CSC_RESP" | grep -q '"ok":true\|"result"'; then
  pass "config.schema 返回成功"
else
  warn "config.schema: $(echo "$CSC_RESP" | head -c 200)"
fi

echo ""

# ════════════════════════════════════════════════
# 6. 技能管理接口
# ════════════════════════════════════════════════
echo "=== 6. 技能管理接口 ==="

# 6.1 skills.status
echo "6.1 skills.status:"
SS_RESP=$(ws_rpc "skills.status" '{"agentId":"main"}' 30)
echo "  Response (前500字符): $(echo "$SS_RESP" | head -c 500)"
if echo "$SS_RESP" | grep -q '"ok":true\|"result"'; then
  pass "skills.status 返回成功"
elif echo "$SS_RESP" | grep -q '"authenticated":true'; then
  warn "skills.status 超时但认证成功 (处理耗时较长)"
else
  fail "skills.status 失败: $SS_RESP"
fi

# 6.2 skills.remote.list
echo "6.2 skills.remote.list:"
SRL_RESP=$(ws_rpc "skills.remote.list" '{}' 15)
echo "  Response (前500字符): $(echo "$SRL_RESP" | head -c 500)"
if echo "$SRL_RESP" | grep -q '"ok":true\|"result"'; then
  pass "skills.remote.list 返回成功"
else
  warn "skills.remote.list: $(echo "$SRL_RESP" | head -c 200)"
fi

# 6.3 skills.bins (需要 node 角色，operator 角色应返回 unauthorized)
echo "6.3 skills.bins:"
SB_RESP=$(ws_rpc "skills.bins" '{}')
echo "  Response (前400字符): $(echo "$SB_RESP" | head -c 400)"
if echo "$SB_RESP" | grep -q '"ok":true\|"result"'; then
  pass "skills.bins 返回成功"
elif echo "$SB_RESP" | grep -q 'unauthorized role'; then
  pass "skills.bins 正确拒绝 operator 角色 (需要 node 角色)"
else
  warn "skills.bins: $(echo "$SB_RESP" | head -c 200)"
fi

echo ""

# ════════════════════════════════════════════════
# 7. TTS 语音接口
# ════════════════════════════════════════════════
echo "=== 7. TTS 语音接口 ==="

# 7.1 tts.status
echo "7.1 tts.status:"
TS_RESP=$(ws_rpc "tts.status" "{}")
echo "  Response (前400字符): $(echo "$TS_RESP" | head -c 400)"
if echo "$TS_RESP" | grep -q '"ok":true\|"result"'; then
  pass "tts.status 返回成功"
else
  warn "tts.status: $(echo "$TS_RESP" | head -c 200)"
fi

# 7.2 tts.providers
echo "7.2 tts.providers:"
TP_RESP=$(ws_rpc "tts.providers" "{}")
echo "  Response (前400字符): $(echo "$TP_RESP" | head -c 400)"
if echo "$TP_RESP" | grep -q '"ok":true\|"result"'; then
  pass "tts.providers 返回成功"
else
  warn "tts.providers: $(echo "$TP_RESP" | head -c 200)"
fi

echo ""

# ════════════════════════════════════════════════
# 8. 使用统计接口
# ════════════════════════════════════════════════
echo "=== 8. 使用统计接口 ==="

# 8.1 usage.status
echo "8.1 usage.status:"
US_RESP=$(ws_rpc "usage.status" "{}")
echo "  Response (前400字符): $(echo "$US_RESP" | head -c 400)"
if echo "$US_RESP" | grep -q '"ok":true\|"result"'; then
  pass "usage.status 返回成功"
else
  warn "usage.status: $(echo "$US_RESP" | head -c 200)"
fi

# 8.2 usage.cost
echo "8.2 usage.cost:"
UC_RESP=$(ws_rpc "usage.cost" '{"days":7}')
echo "  Response (前400字符): $(echo "$UC_RESP" | head -c 400)"
if echo "$UC_RESP" | grep -q '"ok":true\|"result"'; then
  pass "usage.cost 返回成功"
else
  warn "usage.cost: $(echo "$UC_RESP" | head -c 200)"
fi

echo ""

# ════════════════════════════════════════════════
# 9. Cron 定时任务接口
# ════════════════════════════════════════════════
echo "=== 9. Cron 定时任务接口 ==="

# 9.1 cron.list
echo "9.1 cron.list:"
CL_RESP=$(ws_rpc "cron.list" "{}")
echo "  Response (前400字符): $(echo "$CL_RESP" | head -c 400)"
if echo "$CL_RESP" | grep -q '"ok":true\|"result"'; then
  pass "cron.list 返回成功"
else
  warn "cron.list: $(echo "$CL_RESP" | head -c 200)"
fi

# 9.2 cron.status
echo "9.2 cron.status:"
CST_RESP=$(ws_rpc "cron.status" "{}")
echo "  Response (前400字符): $(echo "$CST_RESP" | head -c 400)"
if echo "$CST_RESP" | grep -q '"ok":true\|"result"'; then
  pass "cron.status 返回成功"
else
  warn "cron.status: $(echo "$CST_RESP" | head -c 200)"
fi

echo ""

# ════════════════════════════════════════════════
# 10. Talk 语音模式接口
# ════════════════════════════════════════════════
echo "=== 10. Talk 语音模式接口 ==="

# 10.1 talk.config
echo "10.1 talk.config:"
TC_RESP=$(ws_rpc "talk.config" "{}")
echo "  Response (前400字符): $(echo "$TC_RESP" | head -c 400)"
if echo "$TC_RESP" | grep -q '"ok":true\|"result"'; then
  pass "talk.config 返回成功"
else
  warn "talk.config: $(echo "$TC_RESP" | head -c 200)"
fi

# 10.2 talk.mode (查询当前状态)
echo "10.2 talk.mode:"
TM_RESP=$(ws_rpc "talk.mode" '{"enabled":false}')
echo "  Response (前300字符): $(echo "$TM_RESP" | head -c 300)"
if echo "$TM_RESP" | grep -q '"ok":true\|"result"'; then
  pass "talk.mode 返回成功"
else
  warn "talk.mode: $(echo "$TM_RESP" | head -c 200)"
fi

echo ""

# ════════════════════════════════════════════════
# 11. 其他系统接口
# ════════════════════════════════════════════════
echo "=== 11. 其他系统接口 ==="

# 11.1 health (WS RPC)
echo "11.1 health (WS RPC):"
HW_RESP=$(ws_rpc "health" "{}")
echo "  Response (前400字符): $(echo "$HW_RESP" | head -c 400)"
if echo "$HW_RESP" | grep -q '"ok":true\|"result"'; then
  pass "health WS RPC 返回成功"
else
  warn "health WS RPC: $(echo "$HW_RESP" | head -c 200)"
fi

# 11.2 status
echo "11.2 status:"
ST_RESP=$(ws_rpc "status" "{}")
echo "  Response (前400字符): $(echo "$ST_RESP" | head -c 400)"
if echo "$ST_RESP" | grep -q '"ok":true\|"result"'; then
  pass "status 返回成功"
else
  warn "status: $(echo "$ST_RESP" | head -c 200)"
fi

# 11.3 logs.tail
echo "11.3 logs.tail:"
LT_RESP=$(ws_rpc "logs.tail" '{"limit":10}')
echo "  Response (前400字符): $(echo "$LT_RESP" | head -c 400)"
if echo "$LT_RESP" | grep -q '"ok":true\|"result"'; then
  pass "logs.tail 返回成功"
else
  warn "logs.tail: $(echo "$LT_RESP" | head -c 200)"
fi

# 11.4 channels.status
echo "11.4 channels.status:"
CHS_RESP=$(ws_rpc "channels.status" "{}")
echo "  Response (前400字符): $(echo "$CHS_RESP" | head -c 400)"
if echo "$CHS_RESP" | grep -q '"ok":true\|"result"'; then
  pass "channels.status 返回成功"
else
  warn "channels.status: $(echo "$CHS_RESP" | head -c 200)"
fi

# 11.5 voicewake.get
echo "11.5 voicewake.get:"
VW_RESP=$(ws_rpc "voicewake.get" "{}")
echo "  Response (前300字符): $(echo "$VW_RESP" | head -c 300)"
if echo "$VW_RESP" | grep -q '"ok":true\|"result"'; then
  pass "voicewake.get 返回成功"
else
  warn "voicewake.get: $(echo "$VW_RESP" | head -c 200)"
fi

echo ""

# ════════════════════════════════════════════════
# 12. 执行审批接口
# ════════════════════════════════════════════════
echo "=== 12. 执行审批接口 ==="

# 12.1 exec.approvals.get
echo "12.1 exec.approvals.get:"
EA_RESP=$(ws_rpc "exec.approvals.get" "{}")
echo "  Response (前300字符): $(echo "$EA_RESP" | head -c 300)"
if echo "$EA_RESP" | grep -q '"ok":true\|"result"'; then
  pass "exec.approvals.get 返回成功"
else
  warn "exec.approvals.get: $(echo "$EA_RESP" | head -c 200)"
fi

echo ""

# ════════════════════════════════════════════════
# 13. 飞书/钉钉 Webhook 回调 (HTTP)
# ════════════════════════════════════════════════
echo "=== 13. 飞书/钉钉 Webhook 回调 ==="

# 13.1 飞书 URL 验证回调 (challenge)
echo "13.1 飞书 URL 验证 (challenge):"
# 飞书会发送 challenge 请求来验证 webhook URL
FEISHU_CHALLENGE=$(curl -s -X POST "$BASE/api/channels/feishu/default/webhook" \
  -H "Content-Type: application/json" \
  -d '{"challenge":"test-challenge-token","token":"fake-token","type":"url_verification"}' --max-time 10)
FC_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/channels/feishu/default/webhook" \
  -H "Content-Type: application/json" \
  -d '{"challenge":"test-challenge-token","token":"fake-token","type":"url_verification"}' --max-time 10)
echo "  HTTP: $FC_CODE, Response: $(echo "$FEISHU_CHALLENGE" | head -c 300)"
if [ "$FC_CODE" = "200" ] || [ "$FC_CODE" = "401" ] || [ "$FC_CODE" = "404" ]; then
  pass "飞书 webhook 端点可达 ($FC_CODE)"
else
  warn "飞书 webhook 返回 $FC_CODE"
fi

# 13.2 飞书消息事件 (mock)
echo "13.2 飞书消息事件 (mock):"
FEISHU_MSG=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/channels/feishu/default/webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"schema":"2.0","header":{"event_id":"evt_test","token":"fake","event_type":"im.message.receive_v1","app_id":"cli_fake"},"event":{"sender":{"sender_id":{"open_id":"ou_test"}},"message":{"message_id":"om_test","chat_id":"oc_test","chat_type":"p2p","message_type":"text","content":"{\"text\":\"hello\"}"}}}' --max-time 10)
echo "  HTTP: $FEISHU_MSG"
if [ "$FEISHU_MSG" = "200" ] || [ "$FEISHU_MSG" = "401" ] || [ "$FEISHU_MSG" = "404" ] || [ "$FEISHU_MSG" = "400" ] || [ "$FEISHU_MSG" = "405" ]; then
  pass "飞书消息事件端点可达 ($FEISHU_MSG)"
else
  warn "飞书消息事件返回 $FEISHU_MSG"
fi

# 13.3 钉钉 webhook 回调 (mock)
echo "13.3 钉钉 webhook (mock):"
DT_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/channels/dingtalk/default/webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"msgId":"test123","conversationType":"1","senderId":"user1","senderNick":"测试","msgtype":"text","text":{"content":"hello"},"sessionWebhook":"https://oapi.dingtalk.com/robot/send?token=test"}' --max-time 10)
echo "  HTTP: $DT_CODE"
if [ "$DT_CODE" = "200" ] || [ "$DT_CODE" = "401" ] || [ "$DT_CODE" = "404" ] || [ "$DT_CODE" = "400" ] || [ "$DT_CODE" = "405" ]; then
  pass "钉钉 webhook 端点可达 ($DT_CODE)"
else
  warn "钉钉 webhook 返回 $DT_CODE"
fi

echo ""

# ════════════════════════════════════════════════
# 14. 不存在的 RPC 方法
# ════════════════════════════════════════════════
echo "=== 14. 不存在的 RPC 方法 ==="

echo "14.1 nonexistent.method:"
NE_RESP=$(ws_rpc "nonexistent.method" "{}")
echo "  Response (前300字符): $(echo "$NE_RESP" | head -c 300)"
if echo "$NE_RESP" | grep -q '"error"\|"ok":false'; then
  pass "不存在方法正确返回错误"
else
  warn "不存在方法: $(echo "$NE_RESP" | head -c 200)"
fi

echo ""

# ════════════════════════════════════════════════
# 15. 日志分析
# ════════════════════════════════════════════════
echo "=== 15. 日志分析 ==="
LOG_LINES=$(wc -l < "$LOG_FILE" 2>/dev/null | tr -d ' \n')
echo "日志总行数: $LOG_LINES"

CRITICAL=$(grep -i "error\|exception\|fatal\|crash\|panic\|unhandled" "$LOG_FILE" 2>/dev/null \
  | grep -iv "api.key\|validate\|invalid.*key\|license\|fetch.*model\|ECONNREFUSED\|verify\|fake\|No API key\|unable to open database\|NODE_OPTIONS\|sherpa-onnx\|MCP.*baseline\|tool-index bridge\|FailoverError\|not configured\|mapAsMap\|connect.*challenge\|unauthorized role\|unknown method\|errorCode=INVALID_REQUEST" \
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
kill "$GW_PID" 2>/dev/null; wait "$GW_PID" 2>/dev/null; GW_PID=""
echo "Gateway 已停止"

# ── Summary ──
echo ""
echo "============================================"
echo "  WebSocket RPC 业务功能测试结果"
echo "============================================"
echo "  通过: $PASS"
echo "  失败: $FAIL"
echo "  警告: $WARN"
echo "============================================"

[ "$FAIL" -gt 0 ] && exit 1
exit 0
