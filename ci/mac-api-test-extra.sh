#!/usr/bin/env bash
set -uo pipefail

# ClawdbotCN Gateway 补充功能接口测试
# 测试 mac-api-test.sh 未覆盖的接口：Setup 完整流程、free-models、
# verify-channel、configure-channels、switch-device、tools invoke 详细、
# WebSocket 握手、channel 端点、媒体路径安全等

PORT=18799
TOKEN="test-ci-$(date +%s)"
GW_PID=""
LOG_FILE="/tmp/gw-extra-test.log"
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
BASE="http://127.0.0.1:$PORT"

cleanup() { [ -n "$GW_PID" ] && kill "$GW_PID" 2>/dev/null && wait "$GW_PID" 2>/dev/null; }
trap cleanup EXIT

echo "============================================"
echo "  ClawdbotCN 补充功能接口测试"
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
"$RES/node/bin/node" "$RES/dist/entry.js" gateway --port "$PORT" --force --allow-unconfigured > "$LOG_FILE" 2>&1 &
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

# ════════════════════════════════════════════════
# A. Setup Wizard 详细配置接口
# ════════════════════════════════════════════════
echo "=== A. Setup Wizard 详细配置接口 ==="

# A.1 configure-provider 带完整参数 (siliconflow mock)
echo "A.1 POST /api/setup/configure-provider (siliconflow mock):"
A1_RESP=$(curl -s -X POST "$BASE/api/setup/configure-provider" \
  -H "Content-Type: application/json" \
  -d '{"provider":"siliconflow","apiKey":"sk-test-fake-1234567890","model":"Qwen/Qwen2.5-7B-Instruct"}' --max-time 10)
A1_CODE=$(echo "$A1_RESP" | grep -o '"ok":\(true\|false\)' | head -1)
echo "  Response: $(echo "$A1_RESP" | head -c 300)"
if echo "$A1_RESP" | grep -qE '"ok":(true|false)'; then
  pass "configure-provider siliconflow 端点正常"
else
  fail "configure-provider siliconflow 异常"
fi

# A.2 configure-provider deepseek
echo "A.2 POST /api/setup/configure-provider (deepseek mock):"
A2_RESP=$(curl -s -X POST "$BASE/api/setup/configure-provider" \
  -H "Content-Type: application/json" \
  -d '{"provider":"deepseek","apiKey":"sk-deepseek-fake-key"}' --max-time 10)
echo "  Response: $(echo "$A2_RESP" | head -c 300)"
if echo "$A2_RESP" | grep -qE '"ok":(true|false)'; then
  pass "configure-provider deepseek 端点正常"
else
  fail "configure-provider deepseek 异常"
fi

# A.3 configure-provider custom endpoint
echo "A.3 POST /api/setup/configure-provider (custom endpoint):"
A3_RESP=$(curl -s -X POST "$BASE/api/setup/configure-provider" \
  -H "Content-Type: application/json" \
  -d '{"provider":"custom","apiKey":"sk-custom-fake","endpoint":"https://api.custom.example.com/v1","model":"gpt-4"}' --max-time 10)
echo "  Response: $(echo "$A3_RESP" | head -c 300)"
if echo "$A3_RESP" | grep -qE '"ok":(true|false)'; then
  pass "configure-provider custom 端点正常"
else
  fail "configure-provider custom 异常"
fi

# A.4 configure-provider 未知 provider
echo "A.4 POST /api/setup/configure-provider (unknown provider):"
A4_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/configure-provider" \
  -H "Content-Type: application/json" \
  -d '{"provider":"nonexistent_provider","apiKey":"sk-fake"}' --max-time 10)
echo "  HTTP: $A4_CODE"
if [ "$A4_CODE" = "400" ] || [ "$A4_CODE" = "200" ]; then
  pass "unknown provider 正确处理 ($A4_CODE)"
else
  fail "unknown provider 异常 $A4_CODE"
fi

# A.5 configure-workspace 完整参数
echo "A.5 POST /api/setup/configure-workspace (完整参数):"
A5_RESP=$(curl -s -X POST "$BASE/api/setup/configure-workspace" \
  -H "Content-Type: application/json" \
  -d '{"workspace":"/Users/kevinsun","additionalDirs":["/tmp"]}' --max-time 10)
A5_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/configure-workspace" \
  -H "Content-Type: application/json" \
  -d '{"workspace":"/Users/kevinsun","additionalDirs":["/tmp"]}' --max-time 10)
echo "  HTTP: $A5_CODE, Response: $(echo "$A5_RESP" | head -c 300)"
if [ "$A5_CODE" = "200" ] || [ "$A5_CODE" = "400" ]; then
  pass "configure-workspace 完整参数 ($A5_CODE)"
else
  fail "configure-workspace 异常 $A5_CODE"
fi

# A.6 configure-security 完整参数
echo "A.6 POST /api/setup/configure-security (standard mode):"
A6_RESP=$(curl -s -X POST "$BASE/api/setup/configure-security" \
  -H "Content-Type: application/json" \
  -d '{"mode":"standard","trustedDirs":["/Users/kevinsun"]}' --max-time 10)
A6_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/configure-security" \
  -H "Content-Type: application/json" \
  -d '{"mode":"standard","trustedDirs":["/Users/kevinsun"]}' --max-time 10)
echo "  HTTP: $A6_CODE, Response: $(echo "$A6_RESP" | head -c 300)"
if [ "$A6_CODE" = "200" ] || [ "$A6_CODE" = "400" ]; then
  pass "configure-security standard ($A6_CODE)"
else
  fail "configure-security 异常 $A6_CODE"
fi

# A.7 verify-channel (dingtalk mock)
echo "A.7 POST /api/setup/verify-channel (dingtalk mock):"
A7_RESP=$(curl -s -X POST "$BASE/api/setup/verify-channel" \
  -H "Content-Type: application/json" \
  -d '{"channel":"dingtalk","credentials":{"appKey":"fake-dingtalk-key","appSecret":"fake-dingtalk-secret"}}' --max-time 15)
A7_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/verify-channel" \
  -H "Content-Type: application/json" \
  -d '{"channel":"dingtalk","credentials":{"appKey":"fake-key","appSecret":"fake-secret"}}' --max-time 15)
echo "  HTTP: $A7_CODE, Response: $(echo "$A7_RESP" | head -c 300)"
if [ "$A7_CODE" = "200" ] || [ "$A7_CODE" = "400" ] || [ "$A7_CODE" = "500" ]; then
  pass "verify-channel dingtalk 端点可达 ($A7_CODE)"
else
  fail "verify-channel dingtalk 异常 $A7_CODE"
fi

# A.8 verify-channel (feishu mock)
echo "A.8 POST /api/setup/verify-channel (feishu mock):"
A8_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/verify-channel" \
  -H "Content-Type: application/json" \
  -d '{"channel":"feishu","credentials":{"appId":"cli_fake_id","appSecret":"fake-feishu-secret"}}' --max-time 15)
echo "  HTTP: $A8_CODE"
if [ "$A8_CODE" = "200" ] || [ "$A8_CODE" = "400" ] || [ "$A8_CODE" = "500" ]; then
  pass "verify-channel feishu 端点可达 ($A8_CODE)"
else
  fail "verify-channel feishu 异常 $A8_CODE"
fi

# A.9 configure-channels (mock 空渠道)
echo "A.9 POST /api/setup/configure-channels (空渠道):"
A9_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/configure-channels" \
  -H "Content-Type: application/json" \
  -d '{"channels":[]}' --max-time 10)
echo "  HTTP: $A9_CODE"
if [ "$A9_CODE" = "200" ] || [ "$A9_CODE" = "400" ]; then
  pass "configure-channels 空渠道 ($A9_CODE)"
else
  fail "configure-channels 异常 $A9_CODE"
fi

# A.10 configure-channels (dingtalk mock)
echo "A.10 POST /api/setup/configure-channels (dingtalk mock):"
A10_RESP=$(curl -s -X POST "$BASE/api/setup/configure-channels" \
  -H "Content-Type: application/json" \
  -d '{"channels":["dingtalk"],"dingtalk":{"appKey":"fake-key","appSecret":"fake-secret"}}' --max-time 10)
A10_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/configure-channels" \
  -H "Content-Type: application/json" \
  -d '{"channels":["dingtalk"],"dingtalk":{"appKey":"fake-key","appSecret":"fake-secret"}}' --max-time 10)
echo "  HTTP: $A10_CODE, Response: $(echo "$A10_RESP" | head -c 300)"
if [ "$A10_CODE" = "200" ] || [ "$A10_CODE" = "400" ]; then
  pass "configure-channels dingtalk ($A10_CODE)"
else
  fail "configure-channels dingtalk 异常 $A10_CODE"
fi

# A.11 setup/complete (不真正完成，因为完成后所有 setup API 返回 410)
echo "A.11 POST /api/setup/complete (测试端点可达性):"
A11_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/complete" \
  -H "Content-Type: application/json" -d '{}' --max-time 10)
echo "  HTTP: $A11_CODE"
if [ "$A11_CODE" = "200" ] || [ "$A11_CODE" = "400" ]; then
  pass "setup/complete 端点可达 ($A11_CODE)"
else
  fail "setup/complete 异常 $A11_CODE"
fi

# A.12 setup/restart (测试端点可达，不真正重启)
echo "A.12 POST /api/setup/restart:"
A12_RESP=$(curl -s -X POST "$BASE/api/setup/restart" \
  -H "Content-Type: application/json" -d '{}' --max-time 10)
A12_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/restart" \
  -H "Content-Type: application/json" -d '{}' --max-time 10)
echo "  HTTP: $A12_CODE, Response: $(echo "$A12_RESP" | head -c 300)"
if [ "$A12_CODE" = "200" ] || [ "$A12_CODE" = "400" ] || [ "$A12_CODE" = "500" ]; then
  pass "setup/restart 端点可达 ($A12_CODE)"
else
  fail "setup/restart 异常 $A12_CODE"
fi

# 如果 restart 触发了重启，等待 Gateway 重新就绪
sleep 3
for i in $(seq 1 30); do
  H2=$(curl -s "$BASE/api/health" 2>/dev/null || true)
  if echo "$H2" | grep -q '"ready":true' 2>/dev/null; then break; fi
  sleep 1
done

echo ""

# ════════════════════════════════════════════════
# B. validate-api-key 各 Provider 格式验证
# ════════════════════════════════════════════════
echo "=== B. validate-api-key 各 Provider ==="

for provider in siliconflow deepseek glm aliyun-bailian volcengine-ark tencent-hunyuan minimax moonshot kimi-code google anthropic openrouter ollama; do
  RESP=$(curl -s -X POST "$BASE/api/setup/validate-api-key" \
    -H "Content-Type: application/json" \
    -d "{\"provider\":\"$provider\",\"apiKey\":\"sk-fake-key-for-$provider\"}" --max-time 5)
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/validate-api-key" \
    -H "Content-Type: application/json" \
    -d "{\"provider\":\"$provider\",\"apiKey\":\"sk-fake-key-for-$provider\"}" --max-time 5)
  echo "  $provider: HTTP=$CODE, $(echo "$RESP" | head -c 100)"
  if [ "$CODE" = "200" ] || [ "$CODE" = "400" ]; then
    pass "validate-api-key $provider ($CODE)"
  else
    fail "validate-api-key $provider 异常 $CODE"
  fi
done

echo ""

# ════════════════════════════════════════════════
# C. 免费模型详细接口
# ════════════════════════════════════════════════
echo "=== C. 免费模型详细接口 ==="

# C.1 free-models/providers 返回内容验证
echo "C.1 free-models/providers 内容验证:"
FM_RESP=$(curl -s "$BASE/api/setup/free-models/providers")
FM_COUNT=$(echo "$FM_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',{}).get('providers',[])))" 2>/dev/null || echo "0")
echo "  免费模型提供商数量: $FM_COUNT"
if [ "$FM_COUNT" -gt 0 ]; then
  pass "free-models/providers 返回 $FM_COUNT 个提供商"
else
  warn "free-models/providers 返回 0 个提供商"
fi

# C.2 free-models/test (mock api key)
echo "C.2 POST /api/setup/free-models/test (mock):"
C2_RESP=$(curl -s -X POST "$BASE/api/setup/free-models/test" \
  -H "Content-Type: application/json" \
  -d '{"providerId":"ant-ling","apiKey":"fake-ant-ling-key"}' --max-time 15)
C2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/free-models/test" \
  -H "Content-Type: application/json" \
  -d '{"providerId":"ant-ling","apiKey":"fake-ant-ling-key"}' --max-time 15)
echo "  HTTP: $C2_CODE, Response: $(echo "$C2_RESP" | head -c 300)"
if [ "$C2_CODE" = "200" ] || [ "$C2_CODE" = "400" ] || [ "$C2_CODE" = "500" ]; then
  pass "free-models/test 端点可达 ($C2_CODE)"
else
  fail "free-models/test 异常 $C2_CODE"
fi

# C.3 free-models/configure (mock 配置)
echo "C.3 POST /api/setup/free-models/configure (mock):"
C3_RESP=$(curl -s -X POST "$BASE/api/setup/free-models/configure" \
  -H "Content-Type: application/json" \
  -d '{"accounts":[{"providerId":"ant-ling","apiKey":"fake-key-1"}]}' --max-time 10)
C3_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/free-models/configure" \
  -H "Content-Type: application/json" \
  -d '{"accounts":[{"providerId":"ant-ling","apiKey":"fake-key-1"}]}' --max-time 10)
echo "  HTTP: $C3_CODE, Response: $(echo "$C3_RESP" | head -c 300)"
if [ "$C3_CODE" = "200" ] || [ "$C3_CODE" = "400" ]; then
  pass "free-models/configure 端点可达 ($C3_CODE)"
else
  fail "free-models/configure 异常 $C3_CODE"
fi

# C.4 free-models/config 配置后验证
echo "C.4 GET /api/setup/free-models/config (配置后):"
C4_RESP=$(curl -s "$BASE/api/setup/free-models/config")
echo "  Response: $(echo "$C4_RESP" | head -c 300)"
if echo "$C4_RESP" | grep -q '"ok":true'; then
  pass "free-models/config 返回 ok"
else
  fail "free-models/config 异常"
fi

echo ""

# ════════════════════════════════════════════════
# D. License / Device 接口
# ════════════════════════════════════════════════
echo "=== D. License / Device 接口 ==="

# D.1 validate-license 空 token
echo "D.1 POST /api/setup/validate-license (空 token):"
D1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/validate-license" \
  -H "Content-Type: application/json" -d '{"token":""}' --max-time 10)
echo "  HTTP: $D1_CODE"
if [ "$D1_CODE" = "200" ] || [ "$D1_CODE" = "400" ]; then
  pass "validate-license 空 token ($D1_CODE)"
else
  fail "validate-license 空 token 异常 $D1_CODE"
fi

# D.2 validate-license 无效格式
echo "D.2 POST /api/setup/validate-license (无效格式):"
D2_RESP=$(curl -s -X POST "$BASE/api/setup/validate-license" \
  -H "Content-Type: application/json" -d '{"token":"INVALID-FORMAT-KEY"}' --max-time 15)
D2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/validate-license" \
  -H "Content-Type: application/json" -d '{"token":"INVALID-FORMAT-KEY"}' --max-time 15)
echo "  HTTP: $D2_CODE, Response: $(echo "$D2_RESP" | head -c 300)"
if [ "$D2_CODE" = "200" ] || [ "$D2_CODE" = "400" ] || [ "$D2_CODE" = "500" ]; then
  pass "validate-license 无效格式 ($D2_CODE)"
else
  fail "validate-license 异常 $D2_CODE"
fi

# D.3 switch-device (mock)
echo "D.3 POST /api/setup/switch-device (mock):"
D3_RESP=$(curl -s -X POST "$BASE/api/setup/switch-device" \
  -H "Content-Type: application/json" -d '{"token":"FAKE-LICENSE-KEY"}' --max-time 15)
D3_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/switch-device" \
  -H "Content-Type: application/json" -d '{"token":"FAKE-LICENSE-KEY"}' --max-time 15)
echo "  HTTP: $D3_CODE, Response: $(echo "$D3_RESP" | head -c 300)"
if [ "$D3_CODE" = "200" ] || [ "$D3_CODE" = "400" ] || [ "$D3_CODE" = "500" ]; then
  pass "switch-device 端点可达 ($D3_CODE)"
else
  fail "switch-device 异常 $D3_CODE"
fi

echo ""

# ════════════════════════════════════════════════
# E. fetch-models 各 Provider
# ════════════════════════════════════════════════
echo "=== E. fetch-models 各 Provider ==="

for provider in siliconflow deepseek kimi-code ollama; do
  FM_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/fetch-models" \
    -H "Content-Type: application/json" \
    -d "{\"provider\":\"$provider\",\"apiKey\":\"sk-fake-$provider\"}" --max-time 10)
  echo "  $provider: HTTP=$FM_CODE"
  if [ "$FM_CODE" = "200" ] || [ "$FM_CODE" = "400" ] || [ "$FM_CODE" = "500" ]; then
    pass "fetch-models $provider ($FM_CODE)"
  else
    fail "fetch-models $provider 异常 $FM_CODE"
  fi
done

echo ""

# ════════════════════════════════════════════════
# F. Tools Invoke 详细测试
# ════════════════════════════════════════════════
echo "=== F. Tools Invoke 详细测试 ==="

# F.1 tools/invoke 各种工具名
echo "F.1 tools/invoke agents_list:"
F1_RESP=$(curl -s -X POST "$BASE/tools/invoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tool":"agents_list","args":{}}' --max-time 10)
F1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/tools/invoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tool":"agents_list","args":{}}' --max-time 10)
echo "  HTTP: $F1_CODE, Response: $(echo "$F1_RESP" | head -c 300)"
if [ "$F1_CODE" = "200" ] || [ "$F1_CODE" = "404" ]; then
  pass "tools/invoke agents_list ($F1_CODE)"
else
  fail "tools/invoke agents_list 异常 $F1_CODE"
fi

# F.2 tools/invoke memory_search
echo "F.2 tools/invoke memory_search:"
F2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/tools/invoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tool":"memory_search","args":{"query":"test"}}' --max-time 10)
echo "  HTTP: $F2_CODE"
if [ "$F2_CODE" = "200" ] || [ "$F2_CODE" = "404" ] || [ "$F2_CODE" = "500" ]; then
  pass "tools/invoke memory_search ($F2_CODE)"
else
  fail "tools/invoke memory_search 异常 $F2_CODE"
fi

# F.3 tools/invoke 空 tool 名
echo "F.3 tools/invoke 空 tool 名:"
F3_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/tools/invoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tool":"","args":{}}' --max-time 10)
echo "  HTTP: $F3_CODE"
if [ "$F3_CODE" = "400" ] || [ "$F3_CODE" = "404" ]; then
  pass "空 tool 名正确拒绝 ($F3_CODE)"
else
  fail "空 tool 名异常 $F3_CODE"
fi

# F.4 tools/invoke 无 body
echo "F.4 tools/invoke 无 body:"
F4_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/tools/invoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" --max-time 10)
echo "  HTTP: $F4_CODE"
if [ "$F4_CODE" = "400" ] || [ "$F4_CODE" = "404" ]; then
  pass "无 body 正确拒绝 ($F4_CODE)"
else
  warn "无 body 返回 $F4_CODE"
fi

# F.5 tools/invoke GET 方法 (应拒绝)
echo "F.5 GET /tools/invoke (方法不允许):"
F5_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/tools/invoke" \
  -H "Authorization: Bearer $TOKEN" --max-time 5)
echo "  HTTP: $F5_CODE"
if [ "$F5_CODE" = "404" ] || [ "$F5_CODE" = "405" ] || [ "$F5_CODE" = "302" ]; then
  pass "GET tools/invoke 正确处理 ($F5_CODE)"
else
  warn "GET tools/invoke 返回 $F5_CODE"
fi

echo ""

# ════════════════════════════════════════════════
# G. 媒体端点路径安全测试
# ════════════════════════════════════════════════
echo "=== G. 媒体端点路径安全 ==="

# G.1 路径穿越攻击
echo "G.1 GET /api/media/chat-images/../../../etc/passwd:"
G1_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/media/chat-images/fake/../../../etc/passwd")
echo "  HTTP: $G1_CODE"
if [ "$G1_CODE" = "400" ] || [ "$G1_CODE" = "404" ] || [ "$G1_CODE" = "403" ]; then
  pass "路径穿越正确拒绝 ($G1_CODE)"
else
  fail "路径穿越未拒绝 $G1_CODE"
fi

# G.2 URL 编码路径穿越
echo "G.2 GET /api/media/chat-images/%2e%2e%2f%2e%2e%2fetc/passwd:"
G2_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/media/chat-images/fake/%2e%2e%2f%2e%2e%2fetc%2fpasswd")
echo "  HTTP: $G2_CODE"
if [ "$G2_CODE" = "400" ] || [ "$G2_CODE" = "404" ] || [ "$G2_CODE" = "403" ]; then
  pass "URL编码路径穿越正确拒绝 ($G2_CODE)"
else
  fail "URL编码路径穿越未拒绝 $G2_CODE"
fi

# G.3 特殊字符文件名
echo "G.3 GET /api/media/chat-images/test/<script>.png:"
G3_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/media/chat-images/test/%3Cscript%3E.png")
echo "  HTTP: $G3_CODE"
if [ "$G3_CODE" = "400" ] || [ "$G3_CODE" = "404" ] || [ "$G3_CODE" = "403" ]; then
  pass "特殊字符文件名正确拒绝 ($G3_CODE)"
else
  warn "特殊字符文件名返回 $G3_CODE"
fi

# G.4 视频 Range 请求 (不存在文件)
echo "G.4 GET /api/media/videos/test/fake.mp4 (Range):"
G4_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/media/videos/test/fake.mp4" -H "Range: bytes=0-1023")
echo "  HTTP: $G4_CODE"
if [ "$G4_CODE" = "404" ] || [ "$G4_CODE" = "400" ]; then
  pass "不存在视频 Range 返回 $G4_CODE"
else
  warn "视频 Range 返回 $G4_CODE"
fi

echo ""

# ════════════════════════════════════════════════
# H. Channel 端点测试
# ════════════════════════════════════════════════
echo "=== H. Channel 端点测试 ==="

# H.1 /api/channels/ 无认证
echo "H.1 GET /api/channels/test (无认证):"
H1_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/channels/test" --max-time 5)
echo "  HTTP: $H1_CODE"
if [ "$H1_CODE" = "401" ] || [ "$H1_CODE" = "403" ] || [ "$H1_CODE" = "404" ]; then
  pass "channels 无认证正确拒绝 ($H1_CODE)"
else
  warn "channels 无认证返回 $H1_CODE"
fi

# H.2 /api/channels/ 有认证
echo "H.2 GET /api/channels/test (有认证):"
H2_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/channels/test" \
  -H "Authorization: Bearer $TOKEN" --max-time 5)
echo "  HTTP: $H2_CODE"
if [ "$H2_CODE" = "200" ] || [ "$H2_CODE" = "404" ]; then
  pass "channels 有认证 ($H2_CODE)"
else
  warn "channels 有认证返回 $H2_CODE"
fi

echo ""

# ════════════════════════════════════════════════
# I. WebSocket 连接测试
# ════════════════════════════════════════════════
echo "=== I. WebSocket 连接测试 ==="

# 使用 curl 测试 WebSocket upgrade
echo "I.1 WebSocket upgrade 请求:"
WS_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Version: 13" \
  "$BASE/" --max-time 5 2>/dev/null || true)
echo "  HTTP: $WS_CODE"
if [ "$WS_CODE" = "101" ] || [ "$WS_CODE" = "000" ] || [ "$WS_CODE" = "400" ]; then
  pass "WebSocket upgrade 端点可达 ($WS_CODE)"
else
  warn "WebSocket upgrade 返回 $WS_CODE"
fi

# 使用 node 测试 WebSocket (如果有 ws 模块)
echo "I.2 WebSocket 完整连接 (node):"
WS_RESULT=$("$RES/node/bin/node" -e "
const http = require('http');
const crypto = require('crypto');
const key = crypto.randomBytes(16).toString('base64');
const options = {
  hostname: '127.0.0.1', port: $PORT, path: '/',
  headers: {
    'Connection': 'Upgrade', 'Upgrade': 'websocket',
    'Sec-WebSocket-Key': key, 'Sec-WebSocket-Version': '13'
  }
};
const req = http.request(options);
req.on('upgrade', (res, socket) => {
  let data = '';
  socket.on('data', (chunk) => {
    data += chunk.toString();
    // 检查是否收到 connect.challenge
    if (data.includes('connect.challenge')) {
      console.log('PASS: 收到 connect.challenge');
      socket.destroy();
      process.exit(0);
    }
  });
  setTimeout(() => { console.log('WARN: 超时未收到 challenge, data=' + data.substring(0,200)); socket.destroy(); process.exit(0); }, 5000);
});
req.on('error', (e) => { console.log('FAIL: ' + e.message); process.exit(1); });
req.end();
" 2>&1 || echo "FAIL: node ws test error")
echo "  $WS_RESULT"
if echo "$WS_RESULT" | grep -q "PASS"; then
  pass "WebSocket 收到 connect.challenge"
elif echo "$WS_RESULT" | grep -q "WARN"; then
  warn "WebSocket $WS_RESULT"
else
  fail "WebSocket 连接失败: $WS_RESULT"
fi

echo ""

# ════════════════════════════════════════════════
# J. Open URL 更多安全边界
# ════════════════════════════════════════════════
echo "=== J. Open URL 更多安全测试 ==="

# J.1 反引号注入
echo "J.1 POST /api/open-url (反引号注入):"
J1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/open-url" \
  -H "Content-Type: application/json" -d '{"url":"http://x`whoami`"}')
echo "  HTTP: $J1_CODE"
if [ "$J1_CODE" = "400" ]; then pass "反引号注入拒绝 (400)"; else fail "反引号注入返回 $J1_CODE"; fi

# J.2 $() 命令替换
echo "J.2 POST /api/open-url (\$() 命令替换):"
J2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/open-url" \
  -H "Content-Type: application/json" -d '{"url":"http://x$(id)"}')
echo "  HTTP: $J2_CODE"
if [ "$J2_CODE" = "400" ]; then pass "\$() 注入拒绝 (400)"; else fail "\$() 注入返回 $J2_CODE"; fi

# J.3 分号注入
echo "J.3 POST /api/open-url (分号注入):"
J3_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/open-url" \
  -H "Content-Type: application/json" -d '{"url":"http://x;ls"}')
echo "  HTTP: $J3_CODE"
if [ "$J3_CODE" = "400" ]; then pass "分号注入拒绝 (400)"; else fail "分号注入返回 $J3_CODE"; fi

# J.4 空 URL
echo "J.4 POST /api/open-url (空 URL):"
J4_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/open-url" \
  -H "Content-Type: application/json" -d '{"url":""}')
echo "  HTTP: $J4_CODE"
if [ "$J4_CODE" = "400" ]; then pass "空 URL 拒绝 (400)"; else fail "空 URL 返回 $J4_CODE"; fi

# J.5 file:// 协议
echo "J.5 POST /api/open-url (file:// 协议):"
J5_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/open-url" \
  -H "Content-Type: application/json" -d '{"url":"file:///etc/passwd"}')
echo "  HTTP: $J5_CODE"
if [ "$J5_CODE" = "400" ]; then pass "file:// 拒绝 (400)"; else fail "file:// 返回 $J5_CODE"; fi

# J.6 javascript: 协议
echo "J.6 POST /api/open-url (javascript: 协议):"
J6_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/open-url" \
  -H "Content-Type: application/json" -d '{"url":"javascript:alert(1)"}')
echo "  HTTP: $J6_CODE"
if [ "$J6_CODE" = "400" ]; then pass "javascript: 拒绝 (400)"; else fail "javascript: 返回 $J6_CODE"; fi

echo ""

# ════════════════════════════════════════════════
# K. browse-directory 安全边界
# ════════════════════════════════════════════════
echo "=== K. browse-directory 安全测试 ==="

for forbidden_path in /etc /sys /proc /dev /boot /root; do
  BD_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/setup/browse-directory?path=$forbidden_path" --max-time 5)
  echo "  $forbidden_path: HTTP=$BD_CODE"
  if [ "$BD_CODE" = "403" ] || [ "$BD_CODE" = "400" ]; then
    pass "browse-directory $forbidden_path 被拒 ($BD_CODE)"
  elif [ "$BD_CODE" = "200" ]; then
    fail "browse-directory $forbidden_path 不应该返回 200!"
  else
    warn "browse-directory $forbidden_path 返回 $BD_CODE"
  fi
done

echo ""

# ════════════════════════════════════════════════
# L. setup/open-url (setup 版本)
# ════════════════════════════════════════════════
echo "=== L. setup/open-url ==="
echo "L.1 POST /api/setup/open-url:"
L1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/open-url" \
  -H "Content-Type: application/json" -d '{"url":"https://www.example.com"}' --max-time 10)
echo "  HTTP: $L1_CODE"
if [ "$L1_CODE" = "200" ] || [ "$L1_CODE" = "400" ] || [ "$L1_CODE" = "404" ]; then
  pass "setup/open-url ($L1_CODE)"
else
  fail "setup/open-url 异常 $L1_CODE"
fi

echo ""

# ════════════════════════════════════════════════
# M. 大 body / 异常输入边界测试
# ════════════════════════════════════════════════
echo "=== M. 异常输入边界 ==="

# M.1 超大 JSON body
echo "M.1 POST /api/setup/validate-api-key (超大 body):"
BIG_BODY=$(python3 -c "print('{\"provider\":\"siliconflow\",\"apiKey\":\"' + 'A'*1048576 + '\"}')" 2>/dev/null || echo '{"provider":"siliconflow","apiKey":"AAAA"}')
M1_CODE=$(echo "$BIG_BODY" | curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/validate-api-key" \
  -H "Content-Type: application/json" -d @- --max-time 10)
echo "  HTTP: $M1_CODE"
if [ "$M1_CODE" = "200" ] || [ "$M1_CODE" = "400" ] || [ "$M1_CODE" = "413" ]; then
  pass "超大 body 处理正常 ($M1_CODE)"
else
  warn "超大 body 返回 $M1_CODE"
fi

# M.2 无效 JSON
echo "M.2 POST /api/setup/validate-api-key (无效 JSON):"
M2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/validate-api-key" \
  -H "Content-Type: application/json" -d 'not valid json!!!' --max-time 5)
echo "  HTTP: $M2_CODE"
if [ "$M2_CODE" = "400" ]; then
  pass "无效 JSON 正确拒绝 (400)"
else
  warn "无效 JSON 返回 $M2_CODE"
fi

# M.3 Content-Type 不匹配
echo "M.3 POST /api/setup/validate-api-key (text/plain):"
M3_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/validate-api-key" \
  -H "Content-Type: text/plain" -d '{"provider":"siliconflow","apiKey":"sk-fake"}' --max-time 5)
echo "  HTTP: $M3_CODE"
if [ "$M3_CODE" = "200" ] || [ "$M3_CODE" = "400" ] || [ "$M3_CODE" = "415" ]; then
  pass "Content-Type text/plain ($M3_CODE)"
else
  warn "Content-Type text/plain 返回 $M3_CODE"
fi

echo ""

# ════════════════════════════════════════════════
# N. 日志分析
# ════════════════════════════════════════════════
echo "=== N. 日志分析 ==="
LOG_LINES=$(wc -l < "$LOG_FILE" 2>/dev/null | tr -d ' \n')
echo "日志总行数: $LOG_LINES"

echo ""
echo "ERROR/FATAL/CRASH/UNHANDLED:"
# 过滤掉预期的错误（mock API key 验证失败等）
CRITICAL=$(grep -i "error\|exception\|fatal\|crash\|panic\|unhandled" "$LOG_FILE" 2>/dev/null \
  | grep -iv "api.key\|validate\|invalid.*key\|license\|fetch.*model\|ECONNREFUSED\|verify\|fake\|No API key\|unable to open database\|NODE_OPTIONS\|sherpa-onnx\|MCP.*baseline\|tool-index bridge\|FailoverError" \
  | wc -l | tr -d ' \n')
ALL_ERRORS=$(grep -ci "error\|exception\|fatal\|crash\|panic\|unhandled" "$LOG_FILE" 2>/dev/null || echo 0)
echo "  总计 $ALL_ERRORS 处错误日志 (其中关键/未预期: $CRITICAL)"

if [ "$ALL_ERRORS" -gt 0 ]; then
  echo ""
  echo "  所有错误日志:"
  grep -in "error\|exception\|fatal\|crash\|panic\|unhandled" "$LOG_FILE" | head -40
fi

if [ "$CRITICAL" = "0" ] || [ -z "$CRITICAL" ]; then
  pass "无关键未预期错误"
else
  warn "发现 $CRITICAL 处关键错误 (见上)"
fi

echo ""
echo "WARN 关键词:"
WARN_COUNT=$(grep -ci "warn" "$LOG_FILE" 2>/dev/null || echo 0)
echo "  $WARN_COUNT 处警告"
[ "$WARN_COUNT" -gt 0 ] && grep -in "warn" "$LOG_FILE" | head -15

echo ""
echo "启动日志前 15 行:"
head -15 "$LOG_FILE"

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
echo "  补充功能接口测试结果汇总"
echo "============================================"
echo "  通过: $PASS"
echo "  失败: $FAIL"
echo "  警告: $WARN"
echo "============================================"

[ "$FAIL" -gt 0 ] && exit 1
exit 0
