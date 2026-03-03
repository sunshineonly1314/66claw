#!/bin/bash
# macOS DMG 安装+运行测试脚本
export PATH=/usr/local/lib/nodejs/node-v22.16.0-darwin-arm64/bin:/opt/homebrew/bin:/usr/local/bin:$PATH

echo "========================================="
echo " ClawdbotCN v1.6.2 macOS 安装+运行测试"
echo "========================================="

DMG="/Users/kevinsun/cicd-workspace/openclawcn/apps/desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg/ClawdbotCN_1.6.2_universal.dmg"
MP="/tmp/clawdbot-install-test"
INSTALL_DIR="/tmp/clawdbot-test-app"

# 清理旧测试
hdiutil detach "$MP" -quiet 2>/dev/null
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

echo ""
echo "1. 挂载DMG..."
hdiutil attach "$DMG" -mountpoint "$MP" -nobrowse -quiet
if [ $? -ne 0 ]; then echo "FAIL: 无法挂载DMG"; exit 1; fi
echo "   OK"

echo ""
echo "2. 模拟拖拽安装 (复制.app到测试目录)..."
cp -R "$MP/ClawdbotCN.app" "$INSTALL_DIR/"
hdiutil detach "$MP" -quiet
APP="$INSTALL_DIR/ClawdbotCN.app"
if [ ! -d "$APP" ]; then echo "FAIL: 复制.app失败"; exit 1; fi
APP_SIZE=$(du -sh "$APP" | cut -f1)
echo "   OK: $APP_SIZE"

echo ""
echo "3. 移除quarantine属性..."
xattr -cr "$APP" 2>/dev/null
echo "   OK"

echo ""
echo "4. 启动Node gateway sidecar..."
R="$APP/Contents/Resources/resources"
NODE="$R/node/bin/node"
ENTRY="$R/dist/entry.js"

if [ ! -f "$NODE" ]; then echo "FAIL: node binary不存在 ($NODE)"; exit 1; fi
if [ ! -f "$ENTRY" ]; then echo "FAIL: entry.js不存在 ($ENTRY)"; exit 1; fi

echo "   Node: $($NODE --version)"
echo "   Entry: $ENTRY"

# 设置环境变量
export CLAWDBOT_DATA_DIR="/tmp/clawdbot-test-data"
export CLAWDBOT_LOG_DIR="/tmp/clawdbot-test-logs"
mkdir -p "$CLAWDBOT_DATA_DIR" "$CLAWDBOT_LOG_DIR"

# 复制data文件
if [ -d "$R/data" ]; then
  cp -R "$R/data/"* "$CLAWDBOT_DATA_DIR/" 2>/dev/null
  echo "   Data: copied to $CLAWDBOT_DATA_DIR"
fi

echo ""
echo "5. 启动gateway (后台, 20秒等待)..."
cd "$R"
"$NODE" "$ENTRY" gateway --port 34982 --allow-unconfigured > /tmp/clawdbot-test-stdout.log 2> /tmp/clawdbot-test-stderr.log &
GW_PID=$!
echo "   PID: $GW_PID"

# 等待gateway启动, 每2秒检查一次, 最多等20秒
WAIT_MAX=20
WAIT_COUNT=0
GW_READY=false
while [ $WAIT_COUNT -lt $WAIT_MAX ]; do
  sleep 2
  WAIT_COUNT=$((WAIT_COUNT + 2))
  if ! kill -0 $GW_PID 2>/dev/null; then
    echo "   Gateway进程在 ${WAIT_COUNT}s 时退出"
    break
  fi
  # 检查日志是否有 ready 标记
  if grep -q "ready" /tmp/clawdbot-test-stdout.log 2>/dev/null; then
    GW_READY=true
    echo "   Gateway在 ${WAIT_COUNT}s 内达到 ready 状态"
    break
  fi
  echo "   等待中... ${WAIT_COUNT}s"
done

# 检查进程
if kill -0 $GW_PID 2>/dev/null; then
  echo "   OK: Gateway进程正在运行"

  echo ""
  echo "6. 测试HTTP接口..."
  for PORT in 3000 3001 5173 8080 34982 38080; do
    RESP=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" --connect-timeout 2 2>/dev/null)
    if [ "$RESP" != "000" ]; then
      echo "   Port $PORT /health: HTTP $RESP"
      BODY=$(curl -s "http://localhost:$PORT/health" --connect-timeout 2 2>/dev/null | head -c 200)
      echo "   Response: $BODY"
    fi
    RESP2=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/health" --connect-timeout 2 2>/dev/null)
    if [ "$RESP2" != "000" ]; then
      echo "   Port $PORT /api/health: HTTP $RESP2"
    fi
  done

  # 也测试WebSocket端口
  echo ""
  echo "6b. 测试WebSocket端口..."
  for PORT in 34982 38080; do
    WS_RESP=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" --connect-timeout 2 2>/dev/null)
    echo "   Port $PORT HTTP probe: $WS_RESP"
  done

  echo ""
  echo "7. 检查监听端口..."
  lsof -i -P -n 2>/dev/null | grep "$GW_PID" | head -10

  echo ""
  echo "8. 停止gateway..."
  kill $GW_PID 2>/dev/null
  wait $GW_PID 2>/dev/null
  echo "   OK"
else
  echo "   Gateway进程已退出"
  echo ""
  echo "6. 检查退出前的状态..."
  if [ "$GW_READY" = "true" ]; then
    echo "   Gateway达到了ready状态后退出 (可能是正常的sidecar行为)"
  else
    echo "   Gateway未达到ready状态就退出了"
  fi
fi

echo ""
echo "9. 日志输出..."
echo "   === stdout (最后30行) ==="
tail -30 /tmp/clawdbot-test-stdout.log 2>/dev/null
echo ""
echo "   === stderr (最后30行) ==="
tail -30 /tmp/clawdbot-test-stderr.log 2>/dev/null

echo ""
echo "10. 清理..."
rm -rf "$INSTALL_DIR" "$CLAWDBOT_DATA_DIR" "$CLAWDBOT_LOG_DIR" /tmp/clawdbot-test-*.log

echo ""
echo "========================================="
echo " 测试完成"
echo "========================================="
