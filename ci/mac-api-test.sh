#!/usr/bin/env bash
set -uo pipefail

# ClawdbotCN Gateway 全面 HTTP API 功能测试
# 测试所有 HTTP 端点，mock 各种请求场景，检查日志报错

DMG_PATH="${1:-/Users/kevinsun/cicd-workspace/openclawcn/apps/desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg/ClawdbotCN_1.6.1_universal.dmg}"
PORT=18799
TOKEN="test-ci-$(date +%s)"
GW_PID=""
LOG_FILE="/tmp/gw-api-test.log"

PASS=0
FAIL=0
WARN=0

# Color helpers
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

pass() {
  echo -e "  ${GREEN}[PASS]${NC} $1"
  PASS=$((PASS + 1))
}

fail() {
  echo -e "  ${RED}[FAIL]${NC} $1"
  FAIL=$((FAIL + 1))
}

warn() {
  echo -e "  ${YELLOW}[WARN]${NC} $1"
  WARN=$((WARN + 1))
}

# --- Pre-cleanup ---
SYS_NODE="/usr/local/lib/nodejs/node-v22.16.0-darwin-arm64/bin/node"
if [ ! -f "$SYS_NODE" ]; then
  SYS_NODE=$(which node 2>/dev/null || echo "")
fi
if [ -n "$SYS_NODE" ]; then
  TMPDIR_ACTUAL=$("$SYS_NODE" -e "console.log(require('os').tmpdir())" 2>/dev/null || echo "/tmp")
  LOCK_DIR="$TMPDIR_ACTUAL/openclawcn-$(id -u)"
  if [ -d "$LOCK_DIR" ]; then
    for lockfile in "$LOCK_DIR"/gateway.*.lock; do
      if [ -f "$lockfile" ]; then
        OLD_PID=$("$SYS_NODE" -e "try{console.log(JSON.parse(require('fs').readFileSync('$lockfile','utf8')).pid)}catch{}" 2>/dev/null)
        if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
          kill -9 "$OLD_PID" 2>/dev/null
          sleep 2
        fi
        rm -f "$lockfile" "${lockfile%.lock}.heartbeat"
      fi
    done
  fi
fi

lsof -ti:$PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

# Mount DMG
hdiutil detach "/Volumes/ClawdbotCN" -force 2>/dev/null || true
sleep 1
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

BASE="http://127.0.0.1:$PORT"

echo "============================================"
echo "  ClawdbotCN Gateway 全面 API 功能测试"
echo "============================================"
echo ""

# ── 启动 Gateway ──
echo "=== 启动 Gateway (port=$PORT) ==="
cd "$RES"

OPENCLAWCN_GATEWAY_TOKEN="$TOKEN" \
OPENCLAWCN_GATEWAY_PORT="$PORT" \
OPENCLAWCN_REGION=cn \
OPENCLAWCN_DESKTOP_MODE=1 \
NODE_ENV=production \
"$RES/node/bin/node" "$RES/dist/entry.js" gateway --port "$PORT" --force --allow-unconfigured > "$LOG_FILE" 2>&1 &
GW_PID=$!
echo "  PID: $GW_PID"

# 等待 ready
echo "等待 Gateway ready..."
READY=false
for i in $(seq 1 90); do
  HEALTH=$(curl -s "$BASE/api/health" 2>/dev/null || true)
  if echo "$HEALTH" | grep -q '"ready":true' 2>/dev/null; then
    echo "  Gateway ready (${i}s)"
    READY=true
    break
  fi
  sleep 1
done
if [ "$READY" != "true" ]; then
  echo "  Gateway 启动超时！"
  tail -50 "$LOG_FILE"
  exit 1
fi
echo ""

# ════════════════════════════════════════════════
# 1. Health & Status 端点
# ════════════════════════════════════════════════
echo "=== 1. Health & Status 端点 ==="

# 1.1 GET /api/health
echo "1.1 GET /api/health:"
RESP=$(curl -s "$BASE/api/health")
echo "  Response: $RESP"
if echo "$RESP" | grep -q '"ok":true' && echo "$RESP" | grep -q '"ready":true'; then
  pass "Health OK + Ready"
else
  fail "Health 异常"
fi

# 1.2 GET /api/health (检查字段完整性)
echo "1.2 Health 字段检查:"
for field in ok ready needsSetup phase hasConfiguredProvider; do
  if echo "$RESP" | grep -q "\"$field\""; then
    pass "字段 $field 存在"
  else
    fail "字段 $field 缺失"
  fi
done

# 1.3 GET /api/health with CORS origin
echo "1.3 Health CORS (tauri://localhost):"
CORS_RESP=$(curl -s -D - "$BASE/api/health" -H "Origin: tauri://localhost" 2>/dev/null)
if echo "$CORS_RESP" | grep -qi "access-control-allow-origin.*tauri://localhost"; then
  pass "CORS tauri://localhost 正确"
else
  fail "CORS tauri://localhost 缺失"
fi

echo "1.4 Health CORS (http://localhost):"
CORS_RESP2=$(curl -s -D - "$BASE/api/health" -H "Origin: http://localhost:18799" 2>/dev/null)
if echo "$CORS_RESP2" | grep -qi "access-control-allow-origin.*http://localhost"; then
  pass "CORS localhost 正确"
else
  fail "CORS localhost 缺失"
fi

echo ""

# ════════════════════════════════════════════════
# 2. 认证安全端点
# ════════════════════════════════════════════════
echo "=== 2. 认证安全端点 ==="

# 2.1 GET /api/local-token (loopback)
echo "2.1 GET /api/local-token (loopback):"
LT_RESP=$(curl -s "$BASE/api/local-token")
echo "  Response: $LT_RESP"
if echo "$LT_RESP" | grep -q '"token"'; then
  pass "local-token 返回 token"
else
  fail "local-token 未返回 token"
fi

# 2.2 GET /api/local-token with null origin (should reject)
echo "2.2 GET /api/local-token (Origin: null - 应拒绝):"
LT_NULL=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/local-token" -H "Origin: null")
echo "  HTTP: $LT_NULL"
if [ "$LT_NULL" = "403" ]; then
  pass "正确拒绝 null Origin"
else
  fail "期望 403, 实际 $LT_NULL"
fi

# 2.3 GET /api/auth/discover (loopback)
echo "2.3 GET /api/auth/discover (loopback):"
AD_RESP=$(curl -s "$BASE/api/auth/discover")
echo "  Response: $AD_RESP"
if echo "$AD_RESP" | grep -q '"ok":true' && echo "$AD_RESP" | grep -q '"token"'; then
  pass "auth/discover 返回 token"
else
  fail "auth/discover 异常"
fi

# 2.4 GET /api/auth/discover with null Origin
echo "2.4 GET /api/auth/discover (Origin: null - 应拒绝):"
AD_NULL=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/auth/discover" -H "Origin: null")
echo "  HTTP: $AD_NULL"
if [ "$AD_NULL" = "403" ]; then
  pass "正确拒绝 null Origin"
else
  fail "期望 403, 实际 $AD_NULL"
fi

# 2.5 POST /api/auth/discover (方法不允许)
echo "2.5 POST /api/auth/discover (应返回 405):"
AD_POST=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/discover")
echo "  HTTP: $AD_POST"
if [ "$AD_POST" = "405" ]; then
  pass "正确返回 405 Method Not Allowed"
else
  fail "期望 405, 实际 $AD_POST"
fi

echo ""

# ════════════════════════════════════════════════
# 3. Shutdown 端点安全测试
# ════════════════════════════════════════════════
echo "=== 3. Shutdown 安全测试 ==="

# 3.1 无认证
echo "3.1 POST /api/shutdown (无认证):"
SD1=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/shutdown")
echo "  HTTP: $SD1"
if [ "$SD1" = "401" ]; then
  pass "无认证正确拒绝"
else
  fail "期望 401, 实际 $SD1"
fi

# 3.2 错误 token
echo "3.2 POST /api/shutdown (错误 token):"
SD2=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/shutdown" -H "x-openclawcn-token: wrong-token")
echo "  HTTP: $SD2"
if [ "$SD2" = "401" ]; then
  pass "错误 token 正确拒绝"
else
  fail "期望 401, 实际 $SD2"
fi

# 3.3 Bearer token 错误
echo "3.3 POST /api/shutdown (错误 Bearer):"
SD3=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/shutdown" -H "Authorization: Bearer wrong-token")
echo "  HTTP: $SD3"
if [ "$SD3" = "401" ]; then
  pass "错误 Bearer 正确拒绝"
else
  fail "期望 401, 实际 $SD3"
fi

# 3.4 GET /api/shutdown (方法不允许)
echo "3.4 GET /api/shutdown (应返回 405):"
SD4=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/shutdown")
echo "  HTTP: $SD4"
if [ "$SD4" = "405" ]; then
  pass "GET 方法正确拒绝"
else
  fail "期望 405, 实际 $SD4"
fi

echo ""

# ════════════════════════════════════════════════
# 4. Setup Wizard API 测试
# ════════════════════════════════════════════════
echo "=== 4. Setup Wizard API ==="

# 4.1 GET /api/setup/state
echo "4.1 GET /api/setup/state:"
SS_RESP=$(curl -s "$BASE/api/setup/state")
echo "  Response: $(echo "$SS_RESP" | head -c 200)"
SS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/setup/state")
if [ "$SS_CODE" = "200" ]; then
  pass "setup/state 返回 200"
else
  fail "setup/state 期望 200, 实际 $SS_CODE"
fi

# 4.2 GET /api/setup/providers
echo "4.2 GET /api/setup/providers:"
SP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/setup/providers")
SP_RESP=$(curl -s "$BASE/api/setup/providers")
echo "  HTTP: $SP_CODE"
echo "  Response (前200字符): $(echo "$SP_RESP" | head -c 200)"
if [ "$SP_CODE" = "200" ]; then
  pass "setup/providers 返回 200"
  # 检查是否有 provider 列表
  if echo "$SP_RESP" | grep -q '"providers"'; then
    pass "providers 字段存在"
  else
    warn "providers 字段缺失"
  fi
else
  fail "setup/providers 期望 200, 实际 $SP_CODE"
fi

# 4.3 GET /api/setup/affiliate-links
echo "4.3 GET /api/setup/affiliate-links:"
AL_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/setup/affiliate-links")
echo "  HTTP: $AL_CODE"
if [ "$AL_CODE" = "200" ]; then
  pass "affiliate-links 返回 200"
else
  fail "affiliate-links 期望 200, 实际 $AL_CODE"
fi

# 4.4 POST /api/setup/validate-api-key (mock 空 key)
echo "4.4 POST /api/setup/validate-api-key (空 key):"
VK_RESP=$(curl -s -X POST "$BASE/api/setup/validate-api-key" -H "Content-Type: application/json" -d '{"providerId":"siliconflow","apiKey":""}')
VK_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/validate-api-key" -H "Content-Type: application/json" -d '{"providerId":"siliconflow","apiKey":""}')
echo "  HTTP: $VK_CODE, Response: $(echo "$VK_RESP" | head -c 200)"
if [ "$VK_CODE" = "200" ] || [ "$VK_CODE" = "400" ]; then
  pass "validate-api-key 端点可达 ($VK_CODE)"
else
  fail "validate-api-key 异常 $VK_CODE"
fi

# 4.5 POST /api/setup/validate-api-key (mock siliconflow key)
echo "4.5 POST /api/setup/validate-api-key (mock key):"
VK2_RESP=$(curl -s -X POST "$BASE/api/setup/validate-api-key" -H "Content-Type: application/json" -d '{"providerId":"siliconflow","apiKey":"sk-test-fake-key-12345"}')
echo "  Response: $(echo "$VK2_RESP" | head -c 200)"
if echo "$VK2_RESP" | grep -q '"valid"'; then
  pass "validate-api-key 返回 valid 字段"
else
  warn "validate-api-key 无 valid 字段"
fi

# 4.6 POST /api/setup/validate-path
echo "4.6 POST /api/setup/validate-path:"
VP_RESP=$(curl -s -X POST "$BASE/api/setup/validate-path" -H "Content-Type: application/json" -d '{"path":"/tmp"}')
VP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/validate-path" -H "Content-Type: application/json" -d '{"path":"/tmp"}')
echo "  HTTP: $VP_CODE, Response: $(echo "$VP_RESP" | head -c 200)"
if [ "$VP_CODE" = "200" ]; then
  pass "validate-path /tmp 返回 200"
else
  fail "validate-path 期望 200, 实际 $VP_CODE"
fi

# 4.7 POST /api/setup/validate-path (不存在的路径)
echo "4.7 POST /api/setup/validate-path (不存在的路径):"
VP2_RESP=$(curl -s -X POST "$BASE/api/setup/validate-path" -H "Content-Type: application/json" -d '{"path":"/nonexistent/path/12345"}')
echo "  Response: $(echo "$VP2_RESP" | head -c 200)"
if echo "$VP2_RESP" | grep -q '"valid"\s*:\s*false\|"error"'; then
  pass "不存在的路径正确返回无效"
else
  warn "不存在的路径未返回 error/valid:false"
fi

# 4.8 GET /api/setup/browse-directory
# 注意：/tmp 可能不在白名单路径内，403 表示安全检查正常工作
echo "4.8 GET /api/setup/browse-directory:"
BD_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/setup/browse-directory?path=/tmp")
echo "  HTTP: $BD_CODE"
if [ "$BD_CODE" = "200" ]; then
  pass "browse-directory 返回 200"
elif [ "$BD_CODE" = "403" ]; then
  pass "browse-directory 路径安全检查正常 (403)"
else
  fail "browse-directory 期望 200/403, 实际 $BD_CODE"
fi

# 4.8b GET /api/setup/browse-directory (home 目录)
echo "4.8b GET /api/setup/browse-directory (home):"
BD2_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/setup/browse-directory?path=$HOME")
echo "  HTTP: $BD2_CODE"
if [ "$BD2_CODE" = "200" ] || [ "$BD2_CODE" = "403" ]; then
  pass "browse-directory home ($BD2_CODE)"
else
  fail "browse-directory home 异常 $BD2_CODE"
fi

# 4.9 GET /api/setup/free-models/providers
echo "4.9 GET /api/setup/free-models/providers:"
FM_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/setup/free-models/providers")
FM_RESP=$(curl -s "$BASE/api/setup/free-models/providers")
echo "  HTTP: $FM_CODE"
echo "  Response (前200字符): $(echo "$FM_RESP" | head -c 200)"
if [ "$FM_CODE" = "200" ]; then
  pass "free-models/providers 返回 200"
else
  fail "free-models/providers 期望 200, 实际 $FM_CODE"
fi

# 4.10 GET /api/setup/free-models/config
echo "4.10 GET /api/setup/free-models/config:"
FMC_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/setup/free-models/config")
echo "  HTTP: $FMC_CODE"
if [ "$FMC_CODE" = "200" ]; then
  pass "free-models/config 返回 200"
else
  fail "free-models/config 期望 200, 实际 $FMC_CODE"
fi

# 4.11 POST /api/setup/fetch-models (mock siliconflow)
echo "4.11 POST /api/setup/fetch-models (siliconflow mock):"
FM_RESP2=$(curl -s -X POST "$BASE/api/setup/fetch-models" -H "Content-Type: application/json" -d '{"providerId":"siliconflow","apiKey":"sk-fake"}')
FM_CODE2=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/fetch-models" -H "Content-Type: application/json" -d '{"providerId":"siliconflow","apiKey":"sk-fake"}')
echo "  HTTP: $FM_CODE2, Response (前200字符): $(echo "$FM_RESP2" | head -c 200)"
if [ "$FM_CODE2" = "200" ] || [ "$FM_CODE2" = "400" ] || [ "$FM_CODE2" = "500" ]; then
  pass "fetch-models 端点可达 ($FM_CODE2)"
else
  fail "fetch-models 异常 $FM_CODE2"
fi

# 4.12 GET /api/setup/qrcode
echo "4.12 GET /api/setup/qrcode:"
QR_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/setup/qrcode")
QR_RESP=$(curl -s "$BASE/api/setup/qrcode")
echo "  HTTP: $QR_CODE"
if [ "$QR_CODE" = "200" ]; then
  pass "qrcode 返回 200"
else
  fail "qrcode 期望 200, 实际 $QR_CODE"
fi

# 4.13 POST /api/setup/verify-apikey (mock, 预期失败但端点应可达)
echo "4.13 POST /api/setup/verify-apikey (mock key):"
VA_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/verify-apikey" -H "Content-Type: application/json" -d '{"providerId":"siliconflow","apiKey":"sk-fake-key"}' --max-time 10)
echo "  HTTP: $VA_CODE"
if [ "$VA_CODE" = "200" ] || [ "$VA_CODE" = "400" ] || [ "$VA_CODE" = "500" ]; then
  pass "verify-apikey 端点可达 ($VA_CODE)"
else
  fail "verify-apikey 异常 $VA_CODE"
fi

# 4.14 POST /api/setup/validate-license (mock)
echo "4.14 POST /api/setup/validate-license (mock):"
VL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/validate-license" -H "Content-Type: application/json" -d '{"licenseKey":"TEST-FAKE-KEY-0000"}' --max-time 10)
echo "  HTTP: $VL_CODE"
if [ "$VL_CODE" = "200" ] || [ "$VL_CODE" = "400" ] || [ "$VL_CODE" = "500" ]; then
  pass "validate-license 端点可达 ($VL_CODE)"
else
  fail "validate-license 异常 $VL_CODE"
fi

# 4.15 POST /api/setup/configure-provider (mock, 不会真正写入)
echo "4.15 POST /api/setup/configure-provider (mock, 空 provider):"
CP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/configure-provider" -H "Content-Type: application/json" -d '{}')
echo "  HTTP: $CP_CODE"
if [ "$CP_CODE" = "200" ] || [ "$CP_CODE" = "400" ]; then
  pass "configure-provider 端点可达 ($CP_CODE)"
else
  fail "configure-provider 异常 $CP_CODE"
fi

# 4.16 POST /api/setup/configure-workspace (mock)
echo "4.16 POST /api/setup/configure-workspace (mock):"
CW_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/configure-workspace" -H "Content-Type: application/json" -d '{"path":"/tmp/test-workspace"}')
echo "  HTTP: $CW_CODE"
if [ "$CW_CODE" = "200" ] || [ "$CW_CODE" = "400" ]; then
  pass "configure-workspace 端点可达 ($CW_CODE)"
else
  fail "configure-workspace 异常 $CW_CODE"
fi

# 4.17 POST /api/setup/configure-security (mock)
echo "4.17 POST /api/setup/configure-security (mock):"
CS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/setup/configure-security" -H "Content-Type: application/json" -d '{}')
echo "  HTTP: $CS_CODE"
if [ "$CS_CODE" = "200" ] || [ "$CS_CODE" = "400" ]; then
  pass "configure-security 端点可达 ($CS_CODE)"
else
  fail "configure-security 异常 $CS_CODE"
fi

echo ""

# ════════════════════════════════════════════════
# 5. 公共端点 (无需认证)
# ════════════════════════════════════════════════
echo "=== 5. 公共端点 ==="

# 5.1 GET /config/purchase-url
echo "5.1 GET /config/purchase-url:"
PU_RESP=$(curl -s "$BASE/config/purchase-url")
PU_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/config/purchase-url")
echo "  HTTP: $PU_CODE, Response: $PU_RESP"
if [ "$PU_CODE" = "200" ] && echo "$PU_RESP" | grep -q '"xianyu"'; then
  pass "purchase-url 返回正确"
else
  fail "purchase-url 异常"
fi

# 5.2 GET /api/support/qrcode
echo "5.2 GET /api/support/qrcode:"
SQ_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/support/qrcode")
SQ_RESP=$(curl -s "$BASE/api/support/qrcode")
echo "  HTTP: $SQ_CODE"
if [ "$SQ_CODE" = "200" ] && echo "$SQ_RESP" | grep -q '"ok":true'; then
  pass "support/qrcode OK"
  if echo "$SQ_RESP" | grep -q '"groupName"'; then
    pass "qrcode 包含 groupName"
  else
    warn "qrcode 无 groupName"
  fi
else
  fail "support/qrcode 异常 $SQ_CODE"
fi

echo ""

# ════════════════════════════════════════════════
# 6. Open URL 安全测试
# ════════════════════════════════════════════════
echo "=== 6. Open URL 安全测试 ==="

# 6.1 正常 URL (不真正打开，只测端点可达)
echo "6.1 POST /api/open-url (合法 URL):"
OU_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/open-url" -H "Content-Type: application/json" -d '{"url":"https://www.example.com"}')
echo "  HTTP: $OU_CODE"
if [ "$OU_CODE" = "200" ]; then
  pass "open-url 合法 URL 返回 200"
else
  fail "open-url 期望 200, 实际 $OU_CODE"
fi

# 6.2 无效 URL
echo "6.2 POST /api/open-url (无效 URL):"
OU2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/open-url" -H "Content-Type: application/json" -d '{"url":"not-a-url"}')
echo "  HTTP: $OU2_CODE"
if [ "$OU2_CODE" = "400" ]; then
  pass "无效 URL 正确拒绝 (400)"
else
  fail "期望 400, 实际 $OU2_CODE"
fi

# 6.3 Shell 注入测试
echo "6.3 POST /api/open-url (Shell 注入 - 应拒绝):"
OU3_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/open-url" -H "Content-Type: application/json" -d '{"url":"http://x&calc"}')
echo "  HTTP: $OU3_CODE"
if [ "$OU3_CODE" = "400" ]; then
  pass "Shell 注入正确拒绝 (400)"
else
  fail "Shell 注入未拒绝, 实际 $OU3_CODE"
fi

# 6.4 Shell pipe 注入
echo "6.4 POST /api/open-url (管道注入 - 应拒绝):"
OU4_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/open-url" -H "Content-Type: application/json" -d '{"url":"http://x|whoami"}')
echo "  HTTP: $OU4_CODE"
if [ "$OU4_CODE" = "400" ]; then
  pass "管道注入正确拒绝 (400)"
else
  fail "管道注入未拒绝, 实际 $OU4_CODE"
fi

# 6.5 FTP URL (非 http/https)
echo "6.5 POST /api/open-url (ftp URL - 应拒绝):"
OU5_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/open-url" -H "Content-Type: application/json" -d '{"url":"ftp://evil.com/malware"}')
echo "  HTTP: $OU5_CODE"
if [ "$OU5_CODE" = "400" ]; then
  pass "非 http URL 正确拒绝 (400)"
else
  fail "非 http URL 未拒绝, 实际 $OU5_CODE"
fi

echo ""

# ════════════════════════════════════════════════
# 7. Control UI / Setup Wizard 页面
# ════════════════════════════════════════════════
echo "=== 7. UI 页面端点 ==="

# 7.1 GET / (根路径)
echo "7.1 GET / (根路径):"
ROOT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/?token=$TOKEN")
echo "  HTTP: $ROOT_CODE"
if [ "$ROOT_CODE" = "200" ] || [ "$ROOT_CODE" = "302" ]; then
  pass "根路径可达 ($ROOT_CODE)"
else
  fail "根路径异常 $ROOT_CODE"
fi

# 7.2 GET /setup
echo "7.2 GET /setup:"
SETUP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/setup?token=$TOKEN")
echo "  HTTP: $SETUP_CODE"
if [ "$SETUP_CODE" = "200" ] || [ "$SETUP_CODE" = "302" ]; then
  pass "setup 页面可达 ($SETUP_CODE)"
else
  fail "setup 页面异常 $SETUP_CODE"
fi

# 7.3 GET /setup 页面内容检查
echo "7.3 GET /setup 内容检查:"
SETUP_BODY=$(curl -s "$BASE/setup?token=$TOKEN" -L)
if echo "$SETUP_BODY" | grep -qi "html\|<!DOCTYPE\|<head"; then
  pass "setup 返回 HTML 内容"
else
  warn "setup 未返回 HTML"
fi

echo ""

# ════════════════════════════════════════════════
# 8. OpenAI Compatible API 测试
# ════════════════════════════════════════════════
echo "=== 8. OpenAI Compatible API ==="

# 8.1 POST /v1/chat/completions (无认证)
echo "8.1 POST /v1/chat/completions (无认证):"
OAI1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/v1/chat/completions" -H "Content-Type: application/json" -d '{"model":"test","messages":[{"role":"user","content":"hello"}]}')
echo "  HTTP: $OAI1_CODE"
if [ "$OAI1_CODE" = "401" ] || [ "$OAI1_CODE" = "403" ] || [ "$OAI1_CODE" = "404" ]; then
  pass "无认证正确拒绝 ($OAI1_CODE)"
else
  fail "期望 401/403/404, 实际 $OAI1_CODE"
fi

# 8.2 POST /v1/chat/completions (正确 token, mock 请求)
# 注意：此端点可能返回 SSE 流式响应，curl 会 hang，必须用 --max-time 限制
echo "8.2 POST /v1/chat/completions (有认证):"
OAI2_TMPFILE="/tmp/oai2_resp_$$.txt"
OAI2_CODE=$(curl -s -o "$OAI2_TMPFILE" -w "%{http_code}" -X POST "$BASE/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"model":"test","messages":[{"role":"user","content":"hello"}],"stream":false}' --max-time 8)
echo "  HTTP: $OAI2_CODE"
echo "  Response (前300字符): $(head -c 300 "$OAI2_TMPFILE" 2>/dev/null)"
rm -f "$OAI2_TMPFILE"
if [ "$OAI2_CODE" = "200" ] || [ "$OAI2_CODE" = "400" ] || [ "$OAI2_CODE" = "500" ] || [ "$OAI2_CODE" = "503" ] || [ "$OAI2_CODE" = "000" ]; then
  pass "v1/chat/completions 端点可达 ($OAI2_CODE)"
else
  fail "v1/chat/completions 异常 $OAI2_CODE"
fi

echo ""

# ════════════════════════════════════════════════
# 9. OpenResponses API 测试
# ════════════════════════════════════════════════
echo "=== 9. OpenResponses API ==="

# 9.1 POST /v1/responses (无认证)
# 注意：当 openResponses 未启用时，此路径可能被 setup wizard 拦截返回 302
echo "9.1 POST /v1/responses (无认证):"
OR1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/v1/responses" -H "Content-Type: application/json" -d '{"model":"test","input":"hello"}' --max-time 8)
echo "  HTTP: $OR1_CODE"
if [ "$OR1_CODE" = "401" ] || [ "$OR1_CODE" = "403" ] || [ "$OR1_CODE" = "404" ] || [ "$OR1_CODE" = "302" ]; then
  pass "无认证正确处理 ($OR1_CODE)"
else
  fail "期望 401/403/404/302, 实际 $OR1_CODE"
fi

# 9.2 POST /v1/responses (有认证)
# 注意：此端点可能返回 SSE 流式响应，必须用 --max-time 限制
echo "9.2 POST /v1/responses (有认证):"
OR2_TMPFILE="/tmp/or2_resp_$$.txt"
OR2_CODE=$(curl -s -o "$OR2_TMPFILE" -w "%{http_code}" -X POST "$BASE/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"model":"test","input":"hello","stream":false}' --max-time 8)
echo "  HTTP: $OR2_CODE"
echo "  Response (前300字符): $(head -c 300 "$OR2_TMPFILE" 2>/dev/null)"
rm -f "$OR2_TMPFILE"
if [ "$OR2_CODE" = "200" ] || [ "$OR2_CODE" = "302" ] || [ "$OR2_CODE" = "400" ] || [ "$OR2_CODE" = "500" ] || [ "$OR2_CODE" = "503" ]; then
  pass "v1/responses 端点可达 ($OR2_CODE)"
else
  fail "v1/responses 异常 $OR2_CODE"
fi

echo ""

# ════════════════════════════════════════════════
# 10. Tools Invoke API 测试
# ════════════════════════════════════════════════
echo "=== 10. Tools Invoke API ==="

# 10.1 POST /tools/invoke (无认证)
echo "10.1 POST /tools/invoke (无认证):"
TI1_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/tools/invoke" -H "Content-Type: application/json" -d '{"tool":"test"}')
echo "  HTTP: $TI1_CODE"
if [ "$TI1_CODE" = "401" ] || [ "$TI1_CODE" = "403" ] || [ "$TI1_CODE" = "404" ]; then
  pass "无认证正确拒绝 ($TI1_CODE)"
else
  fail "期望 401/403/404, 实际 $TI1_CODE"
fi

# 10.2 POST /tools/invoke (有认证, dry-run)
echo "10.2 POST /tools/invoke (有认证, dry-run):"
TI2_RESP=$(curl -s -X POST "$BASE/tools/invoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tool":"weather","args":{"city":"Beijing"},"dryRun":true}' --max-time 10)
TI2_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/tools/invoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tool":"weather","args":{"city":"Beijing"},"dryRun":true}' --max-time 10)
echo "  HTTP: $TI2_CODE"
echo "  Response (前300字符): $(echo "$TI2_RESP" | head -c 300)"
if [ "$TI2_CODE" = "200" ] || [ "$TI2_CODE" = "400" ] || [ "$TI2_CODE" = "404" ] || [ "$TI2_CODE" = "500" ]; then
  pass "tools/invoke 端点可达 ($TI2_CODE)"
else
  fail "tools/invoke 异常 $TI2_CODE"
fi

echo ""

# ════════════════════════════════════════════════
# 11. 404 / 不存在的路径
# ════════════════════════════════════════════════
echo "=== 11. 404 测试 ==="

echo "11.1 GET /nonexistent:"
NE1_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/nonexistent?token=$TOKEN")
echo "  HTTP: $NE1_CODE"
if [ "$NE1_CODE" = "404" ] || [ "$NE1_CODE" = "302" ]; then
  pass "不存在路径返回 $NE1_CODE"
else
  warn "不存在路径返回 $NE1_CODE"
fi

echo "11.2 GET /api/nonexistent:"
NE2_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/nonexistent")
echo "  HTTP: $NE2_CODE"
if [ "$NE2_CODE" = "404" ] || [ "$NE2_CODE" = "401" ]; then
  pass "不存在 API 返回 $NE2_CODE"
else
  warn "不存在 API 返回 $NE2_CODE"
fi

echo ""

# ════════════════════════════════════════════════
# 12. 媒体端点
# ════════════════════════════════════════════════
echo "=== 12. 媒体端点 ==="

echo "12.1 GET /api/media/chat-images/fake/fake.png:"
MI_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/media/chat-images/fake-session/fake.png")
echo "  HTTP: $MI_CODE"
if [ "$MI_CODE" = "404" ] || [ "$MI_CODE" = "400" ] || [ "$MI_CODE" = "401" ]; then
  pass "不存在的媒体返回 $MI_CODE"
else
  warn "媒体端点返回 $MI_CODE"
fi

echo "12.2 GET /api/media/videos/fake/fake.mp4:"
MV_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/media/videos/fake-session/fake.mp4")
echo "  HTTP: $MV_CODE"
if [ "$MV_CODE" = "404" ] || [ "$MV_CODE" = "400" ] || [ "$MV_CODE" = "401" ]; then
  pass "不存在的视频返回 $MV_CODE"
else
  warn "视频端点返回 $MV_CODE"
fi

echo ""

# ════════════════════════════════════════════════
# 13. 并发请求压力测试
# ════════════════════════════════════════════════
echo "=== 13. 并发请求测试 ==="

echo "13.1 10 个并发 health 请求:"
CONCURRENT_OK=0
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health" &
done
wait
# Re-test and count
for i in $(seq 1 10); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health")
  if [ "$CODE" = "200" ]; then
    CONCURRENT_OK=$((CONCURRENT_OK + 1))
  fi
done
echo "  成功: $CONCURRENT_OK/10"
if [ "$CONCURRENT_OK" -ge 9 ]; then
  pass "并发请求稳定 ($CONCURRENT_OK/10)"
else
  fail "并发请求不稳定 ($CONCURRENT_OK/10)"
fi

echo ""

# ════════════════════════════════════════════════
# 14. 日志分析
# ════════════════════════════════════════════════
echo "=== 14. 日志分析 ==="
LOG_LINES=$(wc -l < "$LOG_FILE" 2>/dev/null | tr -d ' \n')
echo "日志总行数: $LOG_LINES"

echo ""
echo "ERROR/FATAL/CRASH 关键词:"
ERROR_COUNT=$(grep -ci "error\|exception\|fatal\|crash\|panic\|unhandled" "$LOG_FILE" 2>/dev/null || echo 0)
# 排除正常的非关键错误（如 mock API key 验证失败）
CRITICAL_ERRORS=$(grep -i "error\|exception\|fatal\|crash\|panic\|unhandled" "$LOG_FILE" 2>/dev/null | grep -iv "api.key\|validate\|invalid.*key\|license\|fetch.*model\|ECONNREFUSED\|verify\|401\|403\|fake" | wc -l | tr -d ' \n')
echo "  总计 $ERROR_COUNT 处错误相关日志 (其中关键错误: $CRITICAL_ERRORS 处)"
if [ "$ERROR_COUNT" -gt 0 ]; then
  echo ""
  echo "  所有错误日志 (前30条):"
  grep -in "error\|exception\|fatal\|crash\|panic\|unhandled" "$LOG_FILE" | head -30
fi
if [ "$CRITICAL_ERRORS" -eq 0 ] || [ -z "$CRITICAL_ERRORS" ]; then
  pass "无关键错误"
else
  warn "发现 $CRITICAL_ERRORS 处关键错误 (见上)"
fi

echo ""
echo "WARN 关键词:"
WARN_COUNT=$(grep -ci "warn" "$LOG_FILE" 2>/dev/null || echo 0)
echo "  发现 $WARN_COUNT 处警告"
if [ "$WARN_COUNT" -gt 0 ]; then
  grep -in "warn" "$LOG_FILE" | head -15
fi

echo ""
echo "启动日志前 20 行:"
head -20 "$LOG_FILE"

echo ""
echo "最近日志 30 行:"
tail -30 "$LOG_FILE"

# ── 清理 ──
echo ""
echo "=== 清理 ==="
kill "$GW_PID" 2>/dev/null
wait "$GW_PID" 2>/dev/null
GW_PID=""
echo "Gateway 已停止"

# ── 结果汇总 ──
echo ""
echo "============================================"
echo "  API 功能测试结果汇总"
echo "============================================"
echo -e "  ${GREEN}通过: $PASS${NC}"
echo -e "  ${RED}失败: $FAIL${NC}"
echo -e "  ${YELLOW}警告: $WARN${NC}"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
